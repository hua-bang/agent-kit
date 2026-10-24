import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const dir = await mkdtemp(join(tmpdir(), 'excalidraw-stdio-'));
let client;
async function connect() {
  client = new Client({ name: 'smoke-test', version: '1' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/server/index.js'],
    env: { ...process.env, EXCALIDRAW_PLUGIN_DIR: dir }, stderr: 'pipe' }));
}
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, JSON.stringify(result)); return result.structuredContent;
}
try {
  await connect();
  assert.equal(client.getServerVersion().name, 'local-excalidraw');
  assert.equal(client.getServerVersion().title, 'Agentic Excalidraw');
  const tools = await client.listTools(); assert.equal(tools.tools.length, 17);
  assert.equal(tools.tools.find(t => t.name === 'open_library').title, 'Agentic Excalidraw');
  assert.equal(tools.tools.find(t => t.name === 'open_panel').title, 'Agentic Excalidraw');
  assert.equal(tools.tools.find(t => t.name === 'mention_drawings').title, 'Agentic Excalidraw');
  const resources = await client.listResources(); assert.equal(resources.resources.length, 3);
  assert.equal(tools.tools.find(t => t.name === 'open_library')._meta.ui.resourceUri, 'ui://excalidraw/library.html');
  // Sidebar (global) and conversation panel (thread) entrypoints are on by default, on separate tools, with a monochrome SVG server icon.
  assert.deepEqual(tools.tools.find(t => t.name === 'open_library')._meta['openai/ui'], { entrypoints: [{ type: 'global' }] });
  assert.deepEqual(tools.tools.find(t => t.name === 'open_panel')._meta['openai/ui'], { entrypoints: [{ type: 'thread' }] });
  const icon = client.getServerVersion().icons[0];
  assert.equal(icon.mimeType, 'image/svg+xml');
  assert.match(Buffer.from(icon.src.split(',')[1], 'base64').toString(), /viewBox="0 0 20 20"[^>]*stroke="currentColor"/);
  assert.equal(tools.tools.find(t => t.name === 'open_drawing')._meta.ui.resourceUri, 'ui://excalidraw/editor.html');
  assert.deepEqual(tools.tools.find(t => t.name === 'create_drawing')._meta['openai/ui'], { preferredModelDisplayMode: 'inline' });
  const libraryHtml = await client.readResource({ uri: 'ui://excalidraw/library.html' });
  assert.ok(libraryHtml.contents[0].text.includes('name="excalidraw-surface" content="library"'));
  const panelHtml = await client.readResource({ uri: 'ui://excalidraw/panel.html' });
  assert.ok(panelHtml.contents[0].text.includes('name="excalidraw-surface" content="panel"'));
  assert.deepEqual(panelHtml.contents[0]._meta['openai/ui'].availableDisplayModes, ['inline', 'fullscreen']);
  const html = await client.readResource({ uri: resources.resources[0].uri });
  assert.ok(html.contents[0].text.includes('<!doctype html>'));
  assert.ok(html.contents[0].text.includes('<title>Agentic Excalidraw</title>'));
  assert.ok(resources.resources.every(r => r.name.startsWith('Agentic Excalidraw ')));
  assert.ok(!html.contents[0].text.match(/<script[^>]*>/)?.[0].includes('src='));
  const { document: doc } = await call('create_drawing', { title: '集成验证' });
  const id = doc.plugin.id;
  // Presets: a template creates a ready diagram; a template plus a scene is refused.
  const preset = (await call('create_drawing', { title: '模板验证', template: 'flowchart', language: 'zh-CN' })).document;
  assert.equal(preset.elements.find(e => e.id === 'start-label').text, '开始');
  const both = await client.callTool({ name: 'create_drawing', arguments: { title: 'x', template: 'kanban', scene: { elements: [] } } });
  assert.equal(both.isError, true);
  // The user's own templates: save from a drawing (optionally as placeholders), list, create from, delete.
  const mine = (await call('save_template', { name: '发版流程', description: '每次发版', drawingId: preset.plugin.id, placeholders: true, language: 'zh-CN' })).template;
  const listedTemplates = await call('list_templates', {});
  assert.equal(listedTemplates.builtIn.length, 6);
  assert.deepEqual(listedTemplates.templates.map(t => t.name), ['发版流程']);
  const fromMine = (await call('create_drawing', { title: '用我的模板', template: mine.id })).document;
  assert.equal(fromMine.elements.find(e => e.id === 'start-label').text, '[文字 1]');
  await call('delete_template', { id: mine.id });
  assert.equal((await call('list_templates', {})).templates.length, 0);
  await call('delete_drawing', { id: fromMine.plugin.id, expectedRevision: fromMine.plugin.revision });
  await call('delete_drawing', { id: preset.plugin.id, expectedRevision: preset.plugin.revision });
  // Composer @-mentions: host-only search returns resource links that read back the drawing.
  const mention = tools.tools.find(t => t.name === 'mention_drawings');
  assert.deepEqual(mention._meta['openai/extensions'], { 'mentions/search': {} });
  assert.deepEqual(mention._meta.ui.visibility, ['app']);
  const { items } = await call('mention_drawings', { query: '集成' });
  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'resource_link');
  assert.equal(items[0].uri, `excalidraw://drawings/${id}`);
  assert.equal(items[0].name, '集成验证');
  assert.equal((await call('mention_drawings', { query: '' })).items.length, 1);
  assert.equal((await call('mention_drawings', { query: '不存在' })).items.length, 0);
  assert.ok((await client.listResources()).resources.some(r => r.uri === items[0].uri), 'Drawings are listed as resources');
  const linked = await client.readResource({ uri: items[0].uri });
  assert.equal(JSON.parse(linked.contents[0].text).plugin.id, id);
  await assert.rejects(client.readResource({ uri: 'excalidraw://drawings/not-a-uuid' }));
  const box = { id: 'box', type: 'rectangle', x: 20, y: 30, width: 180, height: 90 };
  await call('patch_drawing', { id, expectedRevision: 1, upsert: [box] });
  const conflict = await client.callTool({ name: 'save_drawing', arguments: { id, expectedRevision: 1, scene: { elements: [] } } });
  assert.equal(conflict.isError, true);
  await client.close(); await connect();
  const reopened = await call('read_drawing', { id });
  assert.equal(reopened.document.elements[0].x, 20);
  assert.equal(reopened.document.plugin.revision, 2);
  const updated = await call('save_drawing', { id, expectedRevision: 2, scene: { elements: [{ ...box, x: 350 }] } });
  await call('patch_drawing', { id, expectedRevision: updated.document.plugin.revision, upsert: [{ ...box, id: 'new', x: 600 }] });
  const patched = await call('read_drawing', { id });
  assert.equal(patched.document.elements.find(e => e.id === 'box').x, 350);
  assert.equal(patched.document.elements.length, 2);
  // Node-level edits keep connectors bound; the model reads the outline as text, not the raw scene.
  await call('edit_drawing', { id, expectedRevision: patched.document.plugin.revision, operations: [
    { op: 'connect', from: 'box', to: 'new', label: '调用' }, { op: 'move', ids: ['new'], dy: 200 }] });
  const read = await client.callTool({ name: 'read_drawing', arguments: { id } });
  const { outline, document } = JSON.parse(read.content[0].text);
  assert.equal(document.elements, undefined, 'The raw scene stays out of the model text');
  assert.deepEqual(outline.connectors, [{ id: 'box-new', from: 'box', to: 'new', label: '调用' }]);
  assert.deepEqual(outline.issues, []);
  const latest = read.structuredContent;
  assert.equal(latest.document.elements.length, 4);
  assert.equal((await call('list_drawings')).drawings.length, 1);
  assert.equal((await call('delete_drawing', { id, expectedRevision: latest.document.plugin.revision })).deleted.id, id);
  assert.equal((await call('list_drawings')).drawings.length, 0);
  const item = { id: 'lib-1', status: 'unpublished', created: 1, elements: [box] };
  assert.equal((await call('save_library', { libraryItems: [item] })).saved, 1);
  assert.deepEqual((await call('read_library')).libraryItems, [item]);
  console.log('PASS: real stdio handshake, resource, @-mention search and drawing resources, create, template presets, user templates, patch, node-level edit and outline, conflict, process restart, user-position preservation, delete, personal library');
} finally { await client?.close(); await rm(dir, { recursive: true, force: true }); }
