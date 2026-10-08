import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { DrawingStore } from '../../storage/drawings.js';
import { idSchema, sceneSchema, titleSchema } from '../../shared/schemas.js';
import { config } from '../config.js';
import { LIBRARY_URI, UI_URI, readonly, writable } from '../constants.js';
import { guarded } from '../result.js';

/** Tools that open an App view: the library (entrypoints) and fixed-ID drawing cards. */
export function registerViewTools(server: McpServer, store: DrawingStore) {
  const ui = { resourceUri: UI_URI };
  const entrypoints = [
    ...(config.sidebar ? [{ type: 'global' }] : []),
    ...(config.thread ? [{ type: 'thread' }] : []),
  ];
  registerAppTool(server, 'open_library', {
    title: 'Agentic Excalidraw 图纸库', description: 'Open the dedicated local drawing library, intended for the Sidebar and the conversation side panel. If the host cannot show either, this explicit library tool can open a library App. Use open_drawing for conversation cards.',
    inputSchema: {}, annotations: readonly,
    _meta: { ui: { resourceUri: LIBRARY_URI }, ...(entrypoints.length ? { 'openai/ui': { entrypoints } } : {}) },
  }, () => guarded(async () => ({ view: 'library', ...await store.list() })));
  registerAppTool(server, 'open_drawing', {
    description: 'Open a specific drawing in the inline Agentic Excalidraw MCP App.',
    inputSchema: { id: idSchema }, _meta: { ui }, annotations: readonly,
  }, ({ id }) => guarded(async () => ({ document: await store.read(id) })));
  registerAppTool(server, 'create_drawing', {
    description: 'Create a local drawing and show it as a fixed-ID card that opens straight in the editor. Optional scene contains Excalidraw elements; omit for a blank canvas.',
    inputSchema: { title: titleSchema, scene: sceneSchema.optional() }, annotations: writable, _meta: { ui },
  }, ({ title, scene }) => guarded(async () => ({ document: await store.create(title, scene) })));
}
