// Chat-first English promo: the user talks to an agent, and drawings arrive as MCP App cards in the chat.
// Records the real plugin (stdio server, official AppBridge per card, real Excalidraw). The chat UI and the
// agent's replies are scripted; the drawings are written through the plugin's own tools.
// Usage (from plugins/excalidraw, after npm run build): COVER_DIR=<dir with pr.png, book.png> node promo/record-zh.mjs <outDir> <durations.json> <lines.json>
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, readdir, rename, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { chromium } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { prFlowZh as prFlow, statements as statementsEn, transformer as transformerEn, sunzi as artOfWar } from './cases.mjs';

const OUT = process.argv[2];
const VOICE = JSON.parse(await readFile(process.argv[3], 'utf8'));
const W = 1280, H = 720, CARD_W = 860, CARD_H = 430;
const dir = await mkdtemp(join(tmpdir(), 'excalidraw-promo-'));
const client = new Client({ name: 'promo', version: '1' });
let browser, http;
const reads = new Map(); // read_drawing calls per drawing id: the editor reads only after a revision changed
const call = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); if (r.isError) throw new Error(r.content[0].text); return r.structuredContent; };
const merge = steps => steps.flat();

const APP_H = 640, BAND = H - APP_H, PANEL_W = 470;
const ICON = '<svg viewBox="0 0 20 20" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.67" y="3.33" width="14.67" height="13.33" rx="2.67"/><path d="M5.33 12.67c1.6-3.6 3.2-4.4 4-2.8s1.8 2.8 2.8 1.1 1.2-3.4 2.53-4.3"/></svg>';
const STAGE = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=Noto+Sans+SC:wght@400;500;700;900&display=swap"><style>
  :root { --bg: #f6f6f3; --side: #ecece7; --ink: #1b1e24; --muted: #6b7079; --line: #dedfd8; --you: #e8590c; --agent: #0c8599; --bubble: #ffffff; }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #0f1012; color: var(--ink); font-family: 'Noto Sans SC', 'WenQuanYi Zen Hei', sans-serif; }
  body.dark { --bg: #17191d; --side: #1f2227; --ink: #eceef2; --muted: #9aa0aa; --line: #2c3038; --bubble: #262a31; }
  .app { position: absolute; left: 0; top: 0; width: ${W}px; height: ${APP_H}px; display: grid; grid-template-columns: 64px 1fr; background: var(--bg); transition: background .6s; }
  .rail { background: var(--side); border-right: 1px solid var(--line); display: grid; align-content: start; justify-items: center; gap: 10px; padding: 16px 0; }
  .rail .app-btn { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; color: var(--muted); }
  .rail .app-btn.on { background: var(--bubble); color: var(--ink); box-shadow: 0 0 0 1px var(--line); }
  .rail .dot { width: 22px; height: 22px; border-radius: 6px; background: var(--muted); opacity: .35; }
  .rail .tip { position: absolute; left: 70px; top: 70px; background: var(--ink); color: var(--bg); font-size: 12px; padding: 5px 9px; border-radius: 6px; opacity: 0; transition: opacity .2s; white-space: nowrap; }
  .rail .tip.on { opacity: 1; }
  .main { display: grid; grid-template-rows: auto 1fr auto; min-height: 0; min-width: 0; }
  .top { height: 44px; display: flex; align-items: center; padding: 0 20px; font-size: 13px; color: var(--muted); border-bottom: 1px solid var(--line); }
  .top b { color: var(--ink); margin-right: 10px; font-weight: 600; }
  .thread { overflow-y: auto; scroll-behavior: smooth; padding: 22px 0 14px; scrollbar-width: none; }
  .thread::-webkit-scrollbar { display: none; }
  .col { width: min(${CARD_W}px, calc(100% - 48px)); margin: 0 auto; display: grid; gap: 14px; }
  .msg { display: flex; gap: 12px; align-items: flex-start; animation: in .35s ease both; }
  .msg.you { justify-content: flex-end; }
  .msg.you p { background: var(--ink); color: var(--bg); border-radius: 18px 18px 4px 18px; max-width: 560px; }
  .msg p { margin: 0; padding: 10px 16px; font-size: 15px; line-height: 1.5; }
  .msg.agent p { padding-left: 0; }
  .avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--agent); flex: none; margin-top: 7px; display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 700; }
  .tool { font-size: 12px; color: var(--muted); margin: -6px 0 0 40px; font-family: 'DejaVu Sans Mono', monospace; animation: in .3s ease both; }
  .card { margin-left: 40px; height: ${CARD_H}px; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: #fff; animation: in .4s ease both; box-shadow: 0 6px 24px rgba(0,0,0,.06); }
  .card iframe, .panel iframe { border: 0; width: 100%; height: 100%; display: block; }
  .composer { padding: 8px 0 16px; }
  .box { width: min(${CARD_W}px, calc(100% - 48px)); margin: 0 auto; display: flex; align-items: center; gap: 10px; background: var(--bubble); border: 1px solid var(--line); border-radius: 16px; padding: 10px 10px 10px 18px; font-size: 15px; min-height: 48px; }
  .box span { flex: 1; color: var(--ink); }
  .box span:empty::before { content: '给 AI 发消息'; color: var(--muted); }
  .box i { width: 28px; height: 28px; border-radius: 50%; background: var(--ink); opacity: .25; transition: opacity .2s; }
  .box.ready i { opacity: 1; }
  /* Global entrypoint: the plugin's page takes over the whole main area, like an app opened from the sidebar. */
  .page { position: absolute; left: 64px; top: 0; right: 0; height: ${APP_H}px; background: var(--bubble); opacity: 0; pointer-events: none; transition: opacity .35s ease; display: grid; grid-template-rows: 44px 1fr; }
  .page.open { opacity: 1; pointer-events: auto; }
  .page header { display: flex; align-items: center; gap: 8px; padding: 0 20px; font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--line); color: var(--ink); }
  .page iframe { border: 0; width: 100%; height: 100%; display: block; }
  .band { position: absolute; left: 0; right: 0; top: ${APP_H}px; height: ${BAND}px; background: #0f1012; display: grid; place-items: center; }
  .band p { margin: 0; color: #f1f2ee; font-size: 22px; letter-spacing: .01em; opacity: 0; transition: opacity .25s; text-align: center; max-width: 1100px; }
  .band p.on { opacity: 1; }
  @keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  /* Cover (design A): paper, black type, one highlighter accent, a real drawing from the plugin. */
  .cover { position: fixed; inset: 0; background: #fdfcf8; color: #16181c; z-index: 5; transition: opacity .7s; font-family: 'Bricolage Grotesque', 'Noto Sans SC', sans-serif; }
  .cover.off { opacity: 0; pointer-events: none; }
  .cover h1 { position: absolute; left: 72px; top: 92px; margin: 0; font-size: 92px; font-weight: 800; letter-spacing: -.02em; line-height: .95; }
  .cover p { position: absolute; left: 76px; top: 316px; margin: 0; width: 470px; font-size: 30px; line-height: 1.3; font-weight: 500; color: #3c4048; }
  .cover .mark { background: linear-gradient(transparent 58%, #ffd43b 58%, #ffd43b 92%, transparent 92%); padding: 0 .08em; }
  .cover small { position: absolute; left: 76px; bottom: 64px; font-size: 15px; color: #7a7e86; letter-spacing: .04em; }
  .cover code { position: absolute; left: 76px; top: 420px; font-family: 'DejaVu Sans Mono', monospace; font-size: 14px; background: #16181c; color: #f3f4ef; padding: 14px 18px; border-radius: 10px; line-height: 1.7; white-space: pre; }
  .cover .shot { position: absolute; width: 700px; right: -40px; top: 250px; transform: rotate(-2deg); border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 1px 0 rgba(0,0,0,.05), 0 30px 60px rgba(20,22,26,.18); }
  .cover .shot img { display: block; width: 100%; }
  .cover.end .shot { width: 640px; top: 120px; right: -30px; transform: rotate(2deg); }
  #cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; z-index: 10; pointer-events: none; transition: opacity .3s; filter: drop-shadow(0 2px 2px rgba(0,0,0,.25)); }
  #cursor.agent { opacity: 0; }
  .ripple { position: fixed; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; border: 3px solid var(--you); z-index: 9; animation: ripple .5s ease-out forwards; pointer-events: none; }
  @keyframes ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
</style></head><body>
  <div class="app">
    <nav class="rail"><div class="app-btn on"><span class="dot"></span></div><div class="app-btn" id="appIcon">${ICON}</div><div class="app-btn"><span class="dot"></span></div><span class="tip" id="tip">Agentic Excalidraw</span></nav>
    <section class="main"><div class="top"><b>和 AI 一起画图</b>为本视频制作的演示对话宿主，不是真实产品</div>
      <div class="thread" id="thread"><div class="col" id="col"></div></div>
      <div class="composer"><div class="box" id="box"><span id="input"></span><i></i></div></div></section>
  </div>
  <section class="page" id="page"><header>${ICON}<span>Agentic Excalidraw</span></header><iframe id="side" sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"></iframe></section>
  <div class="band"><p id="sub"></p></div>
  <div class="cover" id="cover"><h1>Agentic<br>Excalidraw</h1><p>一块你和 <span class="mark">AI 助手</span>共用的白板。</p><small>本地优先 · MCP APPS 插件</small><div class="shot"><img src="/cover/pr.png"></div></div>
  <svg id="cursor" class="agent" viewBox="0 0 22 22"><path d="M3 2l15 8.5-6.6 1.6L8.5 19z" fill="#fff" stroke="#1b1e24" stroke-width="1.6" stroke-linejoin="round"/></svg>
  <script>window.locale = 'zh-CN'</script><script type="module" src="/host.js"></script>
</body></html>`;

try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/server/index.js'], env: { ...process.env, EXCALIDRAW_PLUGIN_DIR: dir }, stderr: 'pipe' }));
  const bundle = await build({ configFile: false, logLevel: 'silent', build: { write: false, lib: { entry: 'promo/host-chat.ts', formats: ['es'] } } });
  const hostScript = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(x => x.type === 'chunk').code;
  const editor = (await client.readResource({ uri: 'ui://excalidraw/editor.html' })).contents[0].text;
  const library = (await client.readResource({ uri: 'ui://excalidraw/library.html' })).contents[0].text;
  http = createServer(async (req, res) => {
    try {
      if (req.url === '/host.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(hostScript); }
      else if (req.url.startsWith('/cover/')) { res.setHeader('Content-Type', 'image/png'); res.end(readFileSync(join(process.env.COVER_DIR, req.url.slice(7)))); }
      else if (req.url.startsWith('/app?')) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; worker-src blob:");
        res.end(req.url.includes('surface=library') ? library : editor);
      } else if (req.url === '/tool') {
        let body = ''; for await (const chunk of req) body += chunk;
        const request = JSON.parse(body);
        if (request.name === 'read_drawing') reads.set(request.arguments.id, (reads.get(request.arguments.id) ?? 0) + 1);
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(await client.callTool(request)));
      } else { res.setHeader('Content-Type', 'text/html'); res.end(STAGE); }
    } catch (error) { res.statusCode = 500; res.end(String(error)); }
  });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));

  browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {});
  const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
  const page = await context.newPage();
  const videoStart = Date.now();
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  const wait = ms => page.waitForTimeout(ms);
  let cx = W / 2, cy = H / 2;
  const cursorTo = async (x, y, ms = 600) => {
    const steps = Math.max(8, Math.round(ms / 16));
    const x0 = cx, y0 = cy;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      cx = x0 + (x - x0) * e; cy = y0 + (y - y0) * e;
      await page.evaluate(([x, y]) => { const c = document.getElementById('cursor'); c.style.transform = `translate(${x - 3}px, ${y - 2}px)`; }, [cx, cy]);
      await page.mouse.move(cx, cy);
      await wait(16);
    }
  };
  const ripple = (x, y) => page.evaluate(([x, y]) => { const r = document.createElement('div'); r.className = 'ripple'; r.style.left = x + 'px'; r.style.top = y + 'px'; document.body.append(r); setTimeout(() => r.remove(), 600); }, [x, y]);
  const clickOn = async (locator, ms = 700) => {
    const b = await locator.boundingBox();
    await cursorTo(b.x + b.width / 2, b.y + b.height / 2, ms);
    await ripple(cx, cy); await page.mouse.down(); await page.mouse.up();
  };
  const drag = async (x1, y1, x2, y2) => {
    await cursorTo(x1, y1, 500);
    await page.mouse.down();
    await cursorTo(x2, y2, 700);
    await page.mouse.up();
  };


  const LINES = JSON.parse(await readFile(process.argv[4], 'utf8'));
  const cues = {};
  const subtitle = text => page.evaluate(t => { const p = document.getElementById('sub'); p.classList.remove('on'); setTimeout(() => { p.textContent = t; if (t) p.classList.add('on'); }, 120); }, text);
  // A narrated line: its exact words appear as the subtitle while it is spoken. Returns a wait-for-end.
  const say = async (key, { sub = true } = {}) => {
    cues[key] = (Date.now() - videoStart) / 1000;
    if (sub) await subtitle(LINES[key]);
    const ends = Date.now() + VOICE[key] * 1000 + 250;
    return async () => { await wait(Math.max(0, ends - Date.now())); if (sub) await subtitle(''); };
  };
  const cover = (html, cls = '') => page.evaluate(([html, cls]) => { const c = document.getElementById('cover'); if (html) { c.innerHTML = html; c.className = `cover ${cls}`; } else c.classList.add('off'); }, [html, cls]);
  const scrollDown = () => page.evaluate(() => { const t = document.getElementById('thread'); t.scrollTop = t.scrollHeight; });
  // The user types into the composer and sends; the text becomes a chat bubble.
  const ask = async text => {
    const box = page.locator('#box');
    const b = await box.boundingBox();
    await cursorTo(b.x + 120, b.y + b.height / 2, 450);
    await ripple(cx, cy);
    for (let i = 1; i <= text.length; i += 2) { await page.evaluate(t => { document.getElementById('input').textContent = t; }, text.slice(0, i)); await wait(16); }
    await page.evaluate(t => { document.getElementById('input').textContent = t; document.getElementById('box').classList.add('ready'); }, text);
    await wait(250);
    await cursorTo(b.x + b.width - 27, b.y + b.height / 2, 300);
    await ripple(cx, cy);
    await page.evaluate(t => {
      document.getElementById('input').textContent = ''; document.getElementById('box').classList.remove('ready');
      const m = document.createElement('div'); m.className = 'msg you'; m.innerHTML = '<p></p>'; m.firstChild.textContent = t;
      document.getElementById('col').append(m);
    }, text);
    await scrollDown();
    await wait(450);
  };
  // The agent replies (streamed), optionally names the tool it used and shows the resulting card.
  let cards = 0;
  const reply = async (text, tool) => {
    await page.evaluate(() => { const m = document.createElement('div'); m.className = 'msg agent'; m.innerHTML = '<span class="avatar">A</span><p></p>'; document.getElementById('col').append(m); });
    for (let i = 2; i <= text.length + 1; i += 3) {
      await page.evaluate(t => { const ps = document.querySelectorAll('.msg.agent p'); ps[ps.length - 1].textContent = t; }, text.slice(0, i));
      await wait(16);
    }
    await scrollDown();
    if (!tool) return;
    await page.evaluate(t => { const d = document.createElement('div'); d.className = 'tool'; d.textContent = t; document.getElementById('col').append(d); }, `调用了 local-excalidraw · ${tool.name}`);
    const n = ++cards;
    await page.evaluate(n => { const c = document.createElement('div'); c.className = 'card'; c.innerHTML = `<iframe id="card${n}" sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"></iframe>`; document.getElementById('col').append(c); }, n);
    await scrollDown();
    await wait(500);
    const id = await page.evaluate(([n, name, args]) => window.mountCard(document.getElementById(`card${n}`), name, args), [n, tool.name, tool.args]);
    const frame = page.frameLocator(`#card${n}`);
    await frame.locator('.excalidraw canvas.interactive').first().waitFor({ timeout: 20000 });
    await scrollDown();
    return { id, frame, n };
  };
  // The agent edits a drawing; the card picks the new revision up on its next check (every 5 s).
  const agentWrite = async (id, upsert) => {
    const doc = (await call('read_drawing', { id })).document;
    const before = reads.get(id) ?? 0;
    const next = (await call('patch_drawing', { id, expectedRevision: doc.plugin.revision, upsert })).document;
    for (let n = 0; n < 140 && (reads.get(id) ?? 0) === before; n++) await wait(50);
    await wait(300);
    return next;
  };
  const steps = c => c.steps;

  // 0 — Title
  await page.goto(`http://127.0.0.1:${http.address().port}/`);
  await wait(300);
  let end = await say('s0', { sub: false });
  await end();
  await cover('');
  await page.evaluate(([x, y]) => { const c = document.getElementById('cursor'); c.style.transform = `translate(${x}px, ${y}px)`; c.classList.remove('agent'); }, [cx, cy]);
  await wait(400);

  // 1 — Ask in plain words (spoken while typing)
  end = await say('s1');
  await ask('画一下 PR 是怎么合并的，包括检查失败了怎么办。');
  await end();
  // 2 — The card arrives in the chat (spoken once it is on screen)
  const pr = prFlow();
  const prCard = await reply('画好了，已经存成你电脑上的一张图，可以直接在这里改。', { name: 'create_drawing', args: { title: pr.title, scene: { elements: merge(steps(pr)) } } });
  await wait(500);
  end = await say('s2');
  await end();
  // 3 — The user draws on it (spoken as they start)
  const canvas = await prCard.frame.locator('.excalidraw canvas.interactive').first().boundingBox();
  const bounds = { x: -40, y: -40, w: 1120, h: 500 };
  const zoom = Math.min(1, Math.min(canvas.width / bounds.w, canvas.height / bounds.h) * 0.9);
  const toScreen = (sx, sy) => [canvas.x + canvas.width / 2 + (sx - (bounds.x + bounds.w / 2)) * zoom, canvas.y + canvas.height / 2 + (sy - (bounds.y + bounds.h / 2)) * zoom];
  end = await say('s3');
  await clickOn(prCard.frame.locator('[data-testid="toolbar-rectangle"]'), 400);
  const [ax, ay] = toScreen(10, 330), [bx, by] = toScreen(190, 400);
  await drag(ax, ay, bx, by);
  await page.keyboard.press('Escape');
  await end();
  await wait(1200); // autosave
  // 4 — The agent builds on it (spoken after the change shows)
  await ask('把我新画的框标成「先开草稿」，连到第一步。');
  await page.evaluate(() => document.getElementById('cursor').classList.add('agent'));
  await reply('好了：你的框已经标好并连上，其他地方都没动。');
  const prDoc = (await call('read_drawing', { id: prCard.id })).document;
  const mine = prDoc.elements.find(e => e.type === 'rectangle' && !e.isDeleted && !e.boundElements?.length && e.id !== 'sheet');
  await agentWrite(prCard.id, [
    { ...mine, backgroundColor: '#e9ecef', fillStyle: 'solid', boundElements: [{ type: 'text', id: 'mine-t' }] },
    { id: 'mine-t', type: 'text', x: mine.x + 6, y: mine.y + mine.height / 2 - 11, width: mine.width - 12, height: 22, text: '先开草稿', originalText: '先开草稿', fontSize: 18, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', lineHeight: 1.25, containerId: mine.id },
    { id: 'mine-a', type: 'arrow', x: mine.x + mine.width / 2, y: mine.y, width: 1, height: mine.y - 226, points: [[0, 0], [0, -(mine.y - 226)]], strokeColor: '#1e1e1e', strokeStyle: 'dashed', strokeWidth: 2, roughness: 1, endArrowhead: 'arrow' },
  ]);
  end = await say('s4');
  await end();
  await page.evaluate(() => document.getElementById('cursor').classList.remove('agent'));

  // 5, 6 — Deeper (spoken once each card is up)
  await ask('再讲讲财报的三张表是怎么对上的。');
  const fin = statementsEn();
  await reply('三张表按数字一一连起来，底部算了六个常用指标。公司和数字都是虚构的。', { name: 'create_drawing', args: { title: fin.title, scene: { elements: merge(steps(fin)) } } });
  await wait(300);
  end = await say('s5');
  await end();
  await ask('把《Attention Is All You Need》这篇论文拆成一页。');
  const paper = transformerEn();
  await reply('从问题、模型到证据，从左到右排开，还放大了多头注意力。', { name: 'create_drawing', args: { title: paper.title, scene: { elements: merge(steps(paper)) } } });
  await wait(300);
  end = await say('s6');
  await end();

  // 7 — A whole book, laid out live (spoken while it is being drawn)
  await ask('把《孙子兵法》按篇拆成一张图。');
  const book = artOfWar();
  await page.evaluate(() => document.getElementById('cursor').classList.add('agent'));
  const bookCard = await reply('先搭框架，再填十三篇，最后串起贯穿全书的思想。', { name: 'create_drawing', args: { title: book.title, scene: { elements: book.steps[0] } } });
  end = await say('s7');
  for (const pass of book.steps.slice(1)) await agentWrite(bookCard.id, pass);
  await end();
  await wait(600);
  // 8 — Zoom in (spoken as it starts)
  await page.evaluate(() => document.getElementById('cursor').classList.remove('agent'));
  const bookCanvas = await bookCard.frame.locator('.excalidraw canvas.interactive').first().boundingBox();
  await cursorTo(bookCanvas.x + bookCanvas.width * 0.3, bookCanvas.y + bookCanvas.height * 0.5, 400);
  end = await say('s8');
  await page.keyboard.down('Control');
  for (let i = 0; i < 11; i++) { await page.mouse.wheel(0, -20); await wait(40); }
  await page.keyboard.up('Control');
  await end();
  await wait(400);

  // 9 — The global entrypoint: the sidebar icon opens the plugin as a full page (spoken once it is open)
  const icon = page.locator('#appIcon');
  await page.evaluate(() => document.getElementById('tip').classList.add('on'));
  await clickOn(icon, 500);
  await page.evaluate(() => { document.getElementById('tip').classList.remove('on'); document.querySelector('.rail .app-btn.on').classList.remove('on'); document.getElementById('appIcon').classList.add('on'); document.getElementById('page').classList.add('open'); });
  await page.evaluate(() => window.mountSidebar(document.getElementById('side')));
  const side = page.frameLocator('#side');
  await side.locator('.drawing img').nth(3).waitFor({ timeout: 20000 });
  await wait(300);
  end = await say('s9');
  await cursorTo(640, 300, 700);
  await end();
  // 10 — Open a drawing full page (spoken as the user picks it)
  end = await say('s10');
  await clickOn(side.getByRole('button', { name: /PR 合并流程/ }), 450);
  await side.locator('.excalidraw canvas.interactive').first().waitFor();
  await end();
  await wait(900);
  // 11 — Theme and language (spoken as they change)
  end = await say('s11');
  await page.evaluate(() => { document.body.classList.add('dark'); return window.setHostTheme('dark'); });
  await wait(900);
  await clickOn(side.getByRole('button', { name: '图纸列表', exact: true }), 400);
  await side.getByRole('heading', { name: '图纸库' }).waitFor();
  await clickOn(side.getByRole('button', { name: 'English', exact: true }), 400);
  await end();
  await wait(1000);

  // 12 — End card (the card shows the same points)
  await page.evaluate(() => document.getElementById('cursor').classList.add('agent'));
  await cover(`<h1>Agentic<br>Excalidraw</h1>
    <p>存在本地，自动保存，<span class="mark">不会被悄悄覆盖</span>。</p>
    <code>codex plugin marketplace add hua-bang/agent-kit --ref release
codex plugin add excalidraw@agent-kit-local</code>
    <small>GITHUB.COM/HUA-BANG/AGENT-KIT · MIT · 非 Excalidraw 官方插件，与其团队无隶属关系</small>
    <div class="shot"><img src="/cover/book.png"></div>`, 'end');
  await wait(500);
  end = await say('s12', { sub: false });
  await end();
  await wait(1500);
  await context.close();
  const [video] = (await readdir(OUT)).filter(f => f.endsWith('.webm') && f !== 'promo.webm');
  await rename(join(OUT, video), join(OUT, 'promo.webm'));
  await writeFile(join(OUT, 'cues.json'), JSON.stringify(cues, null, 1));
  console.log('recorded', JSON.stringify(cues));
} finally {
  await browser?.close(); await client.close(); if (http) await new Promise(resolve => http.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
