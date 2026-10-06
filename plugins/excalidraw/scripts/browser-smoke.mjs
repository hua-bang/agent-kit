import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { chromium } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const dir = await mkdtemp(join(tmpdir(), 'excalidraw-browser-'));
const client = new Client({ name: 'browser-test', version: '1' });
let browser, http;
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/server/index.js'], env: { ...process.env, EXCALIDRAW_PLUGIN_DIR: dir }, stderr: 'pipe' }));
  const bundle = await build({ configFile: false, logLevel: 'silent', build: { write: false, lib: { entry: 'scripts/browser-host.ts', formats: ['es'] } } });
  const hostScript = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(x => x.type === 'chunk').code;
  const resources = {};
  for (const surface of ['drawing', 'library']) {
    const uri = `ui://excalidraw/${surface === 'drawing' ? 'editor' : 'library'}.html`;
    resources[surface] = (await client.readResource({ uri })).contents[0].text;
  }
  http = createServer(async (req, res) => {
    try {
      if (req.url === '/host.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(hostScript); }
      else if (req.url.startsWith('/app?')) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; worker-src blob:");
        res.end(resources[new URL(req.url, 'http://localhost').searchParams.get('surface')]);
      } else if (req.url === '/tool') {
        let body = ''; for await (const chunk of req) body += chunk;
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(await client.callTool(JSON.parse(body))));
      } else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><iframe title="editor" style="border:0;width:100%;height:850px" sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"></iframe><script type="module" src="/host.js"></script>'); }
    } catch (error) { res.statusCode = 500; res.end(String(error)); }
  });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
  const errors = []; const external = []; page.on('console', m => { if (m.type() === 'error') console.error('BROWSER', m.text().slice(0,1000)); });
  page.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR', e.message); });
  page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith('http://127.0.0.1:')) external.push(req.url()); });
  await page.goto(`http://127.0.0.1:${http.address().port}`);
  const frame = page.frameLocator('iframe');
  // Drawing actions live in Excalidraw's main menu, not the header.
  const menuItem = async name => {
    await frame.locator('[data-testid="main-menu-trigger"]').click();
    return frame.getByRole('button', { name, exact: true });
  };
  await frame.getByText('从一张空白图纸开始').waitFor();
  await frame.getByLabel('新图纸名称').fill('浏览器实际编辑验证');
  await frame.getByRole('button', { name: '新建图纸', exact: true }).click();
  await frame.getByLabel('图纸名称', { exact: true }).waitFor({ timeout: 12000 }).catch(async e => { console.error(await frame.locator('body').innerText()); throw e; });
  await frame.locator('.excalidraw canvas.interactive').first().waitFor();
  // Draw using Excalidraw's native keyboard tool and pointer gestures.
  await frame.locator('.excalidraw canvas.interactive').first().click({ position: { x: 350, y: 230 } });
  await page.keyboard.press('r');
  const bounds = await frame.locator('.excalidraw canvas.interactive').first().boundingBox();
  await page.mouse.move(bounds.x + 220, bounds.y + 160);
  await page.mouse.down(); await page.mouse.move(bounds.x + 430, bounds.y + 290, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(2200);
  const listed = await client.callTool({ name: 'list_drawings', arguments: {} });
  const id = listed.structuredContent.drawings[0].id;
  let saved = (await client.callTool({ name: 'read_drawing', arguments: { id } })).structuredContent.document;
  assert.ok(saved.elements.some(e => e.type === 'rectangle'), 'Pointer-drawn rectangle was persisted');
  const original = saved.elements.find(e => e.type === 'rectangle');
  // The optional conversion UI must be absent, not merely fail on click.
  await frame.locator('.App-toolbar__extra-tools-trigger').click();
  const extraTools = await frame.locator('.App-toolbar__extra-tools-dropdown').innerText();
  assert.doesNotMatch(extraTools, /Mermaid|Generate|AI/i);
  await frame.locator('.App-toolbar__extra-tools-trigger').click();
  // Dispatch a real clipboard event through the editor's paste pipeline.
  // This exercises upstream detection, our converter replacement and persistence.
  for (const text of ['flowchart TD\n  A[开始] --> B[结束]', '普通文本 clipboard regression']) {
    await frame.locator('canvas.interactive').first().click({ position: { x: 500, y: 400 } });
    await frame.locator('canvas.interactive').first().evaluate((canvas, value) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', value);
      canvas.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    }, text);
    await page.waitForTimeout(2400);
    saved = (await client.callTool({ name: 'read_drawing', arguments: { id } })).structuredContent.document;
    const pasted = saved.elements.filter(e => e.type === 'text' && !e.isDeleted).map(e => e.text).join('\n');
    assert.ok(pasted.includes(text), `Pasted source is preserved as editable text: ${text}`);
  }
  await client.callTool({ name: 'patch_drawing', arguments: { id, expectedRevision: saved.plugin.revision, upsert: [{ id: 'agent-box', type: 'ellipse', x: original.x + 300, y: original.y, width: 120, height: 90 }] } });
  await page.waitForTimeout(6500);
  saved = (await client.callTool({ name: 'read_drawing', arguments: { id } })).structuredContent.document;
  assert.equal(saved.elements.find(e => e.id === original.id).x, original.x);
  assert.ok(saved.elements.some(e => e.id === 'agent-box'));
  await mkdir('.test-output', { recursive: true });
  await page.screenshot({ path: '.test-output/editor-desktop.png' });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.test-output/editor-mobile.png' });
  const overflow = await page.frames()[1].evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, 'No horizontal document overflow at 375px');
  await frame.getByRole('button', { name: '图纸列表', exact: true }).click();
  await frame.getByRole('button', { name: /浏览器实际编辑验证/ }).waitFor();
  await frame.getByRole('button', { name: /浏览器实际编辑验证/ }).click();
  await frame.getByLabel('图纸名称', { exact: true }).waitFor({ timeout: 12000 }).catch(async e => { console.error(await frame.locator('body').innerText()); throw e; });
  // Library copy creates independent identity and keeps the original untouched.
  assert.equal(await frame.getByRole('button', { name: '保存', exact: true }).count(), 0, 'Save button hidden while autosaved');
  await (await menuItem('复制为新图')).click();
  await frame.getByText('已打开独立副本，原图保持不变。').waitFor();
  const copies = (await client.callTool({ name: 'list_drawings', arguments: {} })).structuredContent.drawings;
  assert.equal(copies.length, 2);
  const copy = copies.find(d => d.id !== id);
  await frame.getByLabel('图纸名称', { exact: true }).fill('独立副本');
  await frame.getByRole('button', { name: '图纸列表', exact: true }).click();
  await frame.getByRole('button', { name: /独立副本/ }).waitFor();
  assert.equal(await frame.getByText('已打开独立副本，原图保持不变。').count(), 0, 'Copy notice does not linger on the list');
  // The library reports its visible drawings to the model (ui/update-model-context).
  await page.waitForFunction(() => window.modelContext?.structuredContent?.view === 'library' && window.modelContext.structuredContent.total === 2);
  const libraryContext = await page.evaluate(() => window.modelContext);
  assert.match(libraryContext.content[0].text, /独立副本/);
  assert.ok(libraryContext.structuredContent.drawings.some(d => d.id === copy.id), 'Model context lists drawing IDs');
  await frame.getByLabel('搜索图纸').fill('不存在的图纸');
  await frame.getByText('没有匹配的图纸。').waitFor();
  await frame.getByRole('button', { name: '清除搜索' }).click();
  await frame.locator('.drawing img').first().waitFor();
  await page.screenshot({ path: '.test-output/library-mobile.png' });
  await page.setViewportSize({ width: 1200, height: 950 });
  await page.screenshot({ path: '.test-output/library-desktop.png' });
  saved = (await client.callTool({ name: 'read_drawing', arguments: { id } })).structuredContent.document;
  assert.equal(saved.plugin.title, '浏览器实际编辑验证');
  const revisionBeforePreview = saved.plugin.revision;

  // Conversation entry is a preview, never a library or live editor.
  await page.goto(`http://127.0.0.1:${http.address().port}/?drawing=${id}`);
  await frame.getByRole('button', { name: '展开编辑', exact: true }).waitFor();
  await frame.locator('.scene-preview img').waitFor();
  assert.equal(await frame.getByLabel('图纸库', { exact: true }).count(), 0);
  assert.equal(await frame.locator('.excalidraw').count(), 0);
  await page.waitForTimeout(1600);
  assert.equal((await client.callTool({ name: 'read_drawing', arguments: { id } })).structuredContent.document.plugin.revision, revisionBeforePreview, 'Opening preview never writes a revision');
  await page.screenshot({ path: '.test-output/preview-desktop.png' });
  // A host delivering unrelated tool results must not retarget this card.
  const otherResult = await client.callTool({ name: 'read_drawing', arguments: { id: copy.id } });
  await page.evaluate(result => window.deliverResult(result), otherResult);
  await page.evaluate(() => window.deliverResult({ content: [], structuredContent: { view: 'library' } }));
  await page.waitForTimeout(250);
  assert.equal(await frame.getByRole('heading', { name: '浏览器实际编辑验证', exact: true }).count(), 1);
  await frame.getByRole('button', { name: '展开编辑', exact: true }).click();
  // The open drawing, not a library, is what the card reports to the model.
  await page.waitForFunction(id => window.modelContext?.structuredContent?.view === 'editor' && window.modelContext.structuredContent.drawing.id === id, id);
  await frame.getByLabel('图纸名称', { exact: true }).fill('对话编辑后的图纸');
  assert.equal(await frame.getByRole('button', { name: '图纸列表', exact: true }).count(), 0);
  await frame.getByRole('button', { name: '返回预览', exact: true }).click();
  await frame.getByRole('heading', { name: '对话编辑后的图纸', exact: true }).waitFor();
  const afterEdit = (await client.callTool({ name: 'read_drawing', arguments: { id } })).structuredContent.document;
  assert.equal(afterEdit.plugin.title, '对话编辑后的图纸');
  assert.equal((await client.callTool({ name: 'read_drawing', arguments: { id: copy.id } })).structuredContent.document.plugin.title, '独立副本');
  // Latest revision propagates to the same preview without a remount or ID switch.
  await client.callTool({ name: 'save_drawing', arguments: { id, expectedRevision: afterEdit.plugin.revision, title: 'Agent 更新后的图纸', scene: { elements: afterEdit.elements, appState: afterEdit.appState, files: afterEdit.files } } });
  await frame.getByRole('heading', { name: 'Agent 更新后的图纸', exact: true }).waitFor({ timeout: 9000 });
  await page.setViewportSize({ width: 375, height: 900 });
  await frame.locator('.scene-preview img').waitFor();
  await page.screenshot({ path: '.test-output/preview-mobile.png' });
  assert.equal(await page.frames()[1].evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Long mixed-language names still fit at narrow width.
  await frame.getByRole('button', { name: '展开编辑', exact: true }).click();
  await frame.getByLabel('图纸名称', { exact: true }).fill('Architecture系统设计'.repeat(8));
  await frame.getByRole('button', { name: '返回预览', exact: true }).click();
  await frame.getByRole('button', { name: '展开编辑', exact: true }).waitFor();
  assert.equal(await page.frames()[1].evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '.test-output/preview-long-title.png' });
  // A stale edit stays in the editor; return cannot discard it silently.
  await frame.getByRole('button', { name: '展开编辑', exact: true }).click();
  await page.waitForTimeout(1600);
  const conflictBase = (await client.callTool({ name: 'read_drawing', arguments: { id } })).structuredContent.document;
  await frame.getByLabel('图纸名称', { exact: true }).fill('尚未保存的冲突草稿');
  await client.callTool({ name: 'patch_drawing', arguments: { id, expectedRevision: conflictBase.plugin.revision, upsert: [{ id: 'concurrent', type: 'rectangle', x: 700, y: 30, width: 100, height: 70 }] } });
  await frame.getByRole('button', { name: '保存', exact: true }).click();
  await frame.getByRole('alert').waitFor();
  await frame.getByRole('button', { name: '返回预览', exact: true }).click();
  assert.equal(await frame.getByLabel('图纸名称', { exact: true }).inputValue(), '尚未保存的冲突草稿');
  const downloadWait = page.waitForEvent('download');
  await (await menuItem('导出')).click();
  assert.ok((await downloadWait).suggestedFilename().endsWith('.excalidraw'));
  page.once('dialog', dialog => dialog.accept());
  await (await menuItem('重新载入')).click();
  await page.waitForTimeout(500);
  await frame.getByRole('button', { name: '返回预览', exact: true }).click();
  await frame.getByRole('button', { name: '展开编辑', exact: true }).waitFor();

  // Use a deliberately composed fixture for visual QA, not overlapping paste-regression text.
  const elements = [];
  for (const [index, label] of ['用户请求', 'Agent', '本地图纸'].entries()) {
    const x = index * 240;
    elements.push({ id: `qa-box-${index}`, type: 'rectangle', x, y: 40, width: 170, height: 100, strokeColor: '#343434', backgroundColor: '#f5f5f5', fillStyle: 'solid', strokeWidth: 1, roughness: 1 });
    elements.push({ id: `qa-label-${index}`, type: 'text', x: x + 35, y: 78, width: 100, height: 25, text: label, originalText: label, fontSize: 20, fontFamily: 2, textAlign: 'center', verticalAlign: 'top', lineHeight: 1.25 });
    if (index < 2) elements.push({ id: `qa-arrow-${index}`, type: 'arrow', x: x + 180, y: 90, width: 50, height: 0, points: [[0, 0], [50, 0]], endArrowhead: 'arrow', strokeWidth: 1 });
  }
  const qa = (await client.callTool({ name: 'create_drawing', arguments: { title: '本地协作流程', scene: { elements } } })).structuredContent.document;
  await page.setViewportSize({ width: 1000, height: 950 });
  await page.goto(`http://127.0.0.1:${http.address().port}/?drawing=${qa.plugin.id}`);
  await frame.locator('.scene-preview img').waitFor();
  await page.screenshot({ path: '.test-output/qa-preview-desktop.png' });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: '.test-output/qa-preview-mobile.png' });
  await frame.getByRole('button', { name: '展开编辑', exact: true }).click();
  await frame.locator('.excalidraw canvas.interactive').first().waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.test-output/qa-editor-mobile.png' });
  await page.goto(`http://127.0.0.1:${http.address().port}`);
  await frame.locator('.drawing img').first().waitFor();
  await page.screenshot({ path: '.test-output/qa-library-mobile.png' });
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  assert.deepEqual(external, [], 'No external network requests');
  console.log('PASS: sandboxed official MCP App bridge, real Excalidraw pointer edit, autosave, Mermaid menu removal and Mermaid/plain-text paste, agent patch, reopen, 375px overflow, library thumbnails/search/copy, fixed-ID conversation preview/edit/return, live preview updates, no external requests');
} finally {
  await browser?.close(); await client.close(); if (http) await new Promise(resolve => http.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
