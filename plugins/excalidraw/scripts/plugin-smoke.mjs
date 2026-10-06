import assert from 'node:assert/strict';
import { readFile, access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Optional argument tests the actual installed plugin cache instead of source.
const root = resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)));
const json = async p => JSON.parse(await readFile(join(root, p), 'utf8'));
const manifest = await json('plugin.json');
assert.equal(manifest.name, 'excalidraw');
assert.equal(manifest.version, (await json('package.json')).version);
assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
const skill = await readFile(join(root, 'skills/excalidraw/SKILL.md'), 'utf8');
assert.match(skill, /^---\nname: excalidraw\ndescription: /);
assert.match(skill, /local-excalidraw/);
const config = (await json('mcp.json')).mcpServers['local-excalidraw'];
assert.equal(config.type, 'stdio');
assert.equal(config.command, 'node');
const args = config.args.map(s => s.replaceAll('${PLUGIN_ROOT}', root));
await access(args[0]);
const data = await mkdtemp(join(tmpdir(), 'excalidraw-plugin-data-'));
const client = new Client({ name: 'plugin-package-test', version: '0.1.0' });
try {
  await client.connect(new StdioClientTransport({
    command: process.execPath, args, cwd: tmpdir(),
    env: { ...process.env, EXCALIDRAW_PLUGIN_DIR: data },
  }));
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8);
  const created = await client.callTool({ name: 'create_drawing', arguments: { title: 'Plugin package smoke' } });
  assert.ok(!created.isError);
  const doc = created.structuredContent.document;
  const read = await client.callTool({ name: 'read_drawing', arguments: { id: doc.plugin.id } });
  assert.equal(read.structuredContent.document.plugin.title, 'Plugin package smoke');
  const ui = await client.readResource({ uri: 'ui://excalidraw/editor.html' });
  assert.ok(ui.contents[0].text.length > 1_000_000);
  console.log('PASS: plugin manifest, bundled skill, portable MCP entry, unrelated cwd, drawing read/write and UI resource');
} finally {
  await client.close();
  await rm(data, { recursive: true, force: true });
}
