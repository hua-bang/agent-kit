// Writes the showcase cases through the plugin's tools, then captures each in the real editor.
// Usage (from plugins/excalidraw, after npm run build): node promo/gallery.mjs <outDir> [en]
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { chromium } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { allCases } from './cases.mjs';
import { allCasesEn } from './cases-en.mjs';
const EN = process.argv[3] === 'en';
const ui = EN ? { back: 'Drawings', heading: 'Drawings', locale: 'en-US' } : { back: '图纸列表', heading: '图纸库', locale: 'zh-CN' };

const OUT = process.argv[2];
const W = 1600, H = 1000;
const dir = await mkdtemp(join(tmpdir(), 'excalidraw-gallery-'));
const client = new Client({ name: 'gallery', version: '1' });
let browser, http;
const call = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); if (r.isError) throw new Error(`${name}: ${r.content[0].text}`); return r.structuredContent; };
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/server/index.js'], env: { ...process.env, EXCALIDRAW_PLUGIN_DIR: dir }, stderr: 'pipe' }));
  const cases = EN ? allCasesEn() : allCases();
  for (const c of cases) {
    let doc = (await call('create_drawing', { title: c.title, scene: { elements: c.steps[0] } })).document;
    for (const upsert of c.steps.slice(1)) doc = (await call('patch_drawing', { id: doc.plugin.id, expectedRevision: doc.plugin.revision, upsert })).document;
    console.log(c.title, 'revision', doc.plugin.revision, 'elements', doc.elements.length);
  }
  const bundle = await build({ configFile: false, logLevel: 'silent', build: { write: false, lib: { entry: 'promo/host.ts', formats: ['es'] } } });
  const hostScript = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(x => x.type === 'chunk').code;
  const library = (await client.readResource({ uri: 'ui://excalidraw/library.html' })).contents[0].text;
  http = createServer(async (req, res) => {
    if (req.url === '/host.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(hostScript); }
    else if (req.url.startsWith('/app?')) { res.setHeader('Content-Type', 'text/html'); res.end(library); }
    else if (req.url === '/tool') { let body = ''; for await (const chunk of req) body += chunk; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(await client.callTool(JSON.parse(body)))); }
    else { res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style><script>window.dims={width:${W},height:${H}};window.locale='${ui.locale}'</script><iframe sandbox="allow-scripts allow-same-origin"></iframe><script type="module" src="/host.js"></script>`); }
  });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const frame = page.frameLocator('iframe');
  await page.goto(`http://127.0.0.1:${http.address().port}/`);
  await frame.locator('.drawing img').nth(cases.length - 1).waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${OUT}/library.png` });
  for (const [i, c] of cases.entries()) {
    await frame.getByRole('button', { name: new RegExp(c.title.replace(/[()（）《》]/g, '.')) }).click();
    await frame.locator('.excalidraw canvas.interactive').first().waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/case-${i + 1}.png` });
    await frame.getByRole('button', { name: ui.back, exact: true }).click();
    await frame.getByRole('heading', { name: ui.heading }).waitFor();
  }
  console.log('captured', cases.length);
} finally {
  await browser?.close(); await client.close(); if (http) await new Promise(resolve => http.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
