import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DrawingStore } from '../storage/drawings.js';
import { SIDEBAR_ICON } from './constants.js';
import { registerAppPages, registerDrawingResources } from './resources.js';
import { registerViewTools } from './tools/views.js';
import { registerDrawingTools } from './tools/drawings.js';
import { registerMentionTool } from './tools/mentions.js';
import { registerDebugTool } from './debug.js';

export { UI_URI, LIBRARY_URI, drawingUri } from './constants.js';

/** Assemble the server. Tools validate input and call the store; the store owns data and revision rules. */
export function createServer(store = new DrawingStore(), htmlPath = new URL('../ui/index.html', import.meta.url)) {
  const server = new McpServer({ name: 'local-excalidraw', title: 'Agentic Excalidraw', version: '0.1.0', icons: [SIDEBAR_ICON] });
  registerAppPages(server, htmlPath);
  registerDrawingResources(server, store);
  registerMentionTool(server, store);
  registerViewTools(server, store);
  registerDrawingTools(server, store);
  registerDebugTool(server);
  return server;
}
