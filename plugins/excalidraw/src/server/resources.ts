import { readFile } from 'node:fs/promises';
import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { DrawingStore } from '../storage/drawings.js';
import { idSchema, type Drawing } from '../shared/schemas.js';
import { config } from './config.js';
import { DRAWING_MIME, LIBRARY_URI, PANEL_URI, UI_URI, drawingUri } from './constants.js';

export const describeDrawing = (d: Drawing['plugin']) => `Revision ${d.revision}, updated ${d.updatedAt}`;

/** The two App pages share one build; a meta tag tells the page which surface it is. */
export function registerAppPages(server: McpServer, htmlPath: URL) {
  const debug = config.debugLog ? '<meta name="excalidraw-debug" content="1">' : '';
  for (const [uri, surface] of [[UI_URI, 'drawing'], [LIBRARY_URI, 'library'], [PANEL_URI, 'panel']] as const) {
    registerAppResource(server, `Agentic Excalidraw ${surface}`, uri, {}, async () => ({ contents: [{
      uri, mimeType: RESOURCE_MIME_TYPE,
      text: (await readFile(htmlPath, 'utf8')).replace('<head>', `<head><meta name="excalidraw-surface" content="${surface}">${debug}`),
      _meta: {
        ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } },
        // Every page works inline and fullscreen; hosts use this to pick where to render it.
        'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' },
      },
    }] }));
  }
}

export function registerDrawingResources(server: McpServer, store: DrawingStore) {
  server.registerResource('drawing', new ResourceTemplate('excalidraw://drawings/{id}', {
    list: async () => ({ resources: (await store.list()).drawings.map(d => ({
      uri: drawingUri(d.id), name: d.title, mimeType: DRAWING_MIME, description: describeDrawing(d),
    })) }),
  }), {
    title: 'Agentic Excalidraw drawing',
    description: 'A locally saved drawing: standard .excalidraw JSON plus a plugin field with id, title and revision. Use read_drawing/patch_drawing to edit.',
    mimeType: DRAWING_MIME,
  }, async (uri, { id }) => ({
    contents: [{ uri: uri.href, mimeType: DRAWING_MIME, text: JSON.stringify(await store.read(idSchema.parse(id))) }],
  }));
}
