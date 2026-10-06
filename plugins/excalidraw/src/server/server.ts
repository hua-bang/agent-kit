import { readFile } from 'node:fs/promises';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { DrawingStore, ConflictError } from '../storage/drawings.js';
import { idSchema, titleSchema, sceneSchema, elementSchema, type Drawing } from '../shared/schemas.js';

export const UI_URI = 'ui://excalidraw/editor.html';
// Sidebar icon per the OpenAI entrypoint guidelines: monochrome SVG, currentColor,
// 20x20 viewport, 1.33px strokes. Served as the server icon, which hosts use for
// entrypoints when a tool has no icon of its own.
const SIDEBAR_ICON = {
  src: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"><rect x="2.67" y="3.33" width="14.67" height="13.33" rx="2.67"/><path d="M5.33 12.67c1.6-3.6 3.2-4.4 4-2.8s1.8 2.8 2.8 1.1 1.2-3.4 2.53-4.3"/></svg>').toString('base64'),
  mimeType: 'image/svg+xml',
  sizes: ['any'],
};
export const LIBRARY_URI = 'ui://excalidraw/library.html';
// Each drawing is also a readable resource, so @-mentions and resource links resolve to its content.
export const drawingUri = (id: string) => `excalidraw://drawings/${id}`;
const DRAWING_MIME = 'application/vnd.excalidraw+json';
export function createServer(store = new DrawingStore(), htmlPath = new URL('../ui/index.html', import.meta.url)) {
  const server = new McpServer({ name: 'local-excalidraw', version: '0.1.0', icons: [SIDEBAR_ICON] });
  const ui = { resourceUri: UI_URI };
  const readonly = { readOnlyHint: true, openWorldHint: false };
  const writable = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
  const result = (data: Record<string, unknown>) => ({
    content: [{ type: 'text' as const, text: JSON.stringify('document' in data
      ? { document: (data.document as Drawing).plugin } : data) }], structuredContent: data,
  });
  const guarded = async (fn: () => Promise<Record<string, unknown>>) => {
    try { return result(await fn()); }
    catch (error) {
      const message = error instanceof z.ZodError ? 'Invalid drawing data: ' + error.issues.map(i => i.message).join('; ')
        : error instanceof Error && 'code' in error && error.code === 'ENOENT' ? 'Drawing not found'
        : error instanceof Error ? error.message : 'Operation failed';
      return { isError: true, content: [{ type: 'text' as const, text: message }],
        structuredContent: { error: message, ...(error instanceof ConflictError ? { currentRevision: error.currentRevision } : {}) } };
    }
  };
  for (const [uri, surface] of [[UI_URI, 'drawing'], [LIBRARY_URI, 'library']] as const) {
    registerAppResource(server, `Excalidraw ${surface}`, uri, {}, async () => ({ contents: [{
      uri, mimeType: RESOURCE_MIME_TYPE,
      text: (await readFile(htmlPath, 'utf8')).replace('<head>', `<head><meta name="excalidraw-surface" content="${surface}">`),
      _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } } },
    }] }));
  }
  const describe = (d: Drawing['plugin']) => `Revision ${d.revision}, updated ${d.updatedAt}`;
  server.registerResource('drawing', new ResourceTemplate('excalidraw://drawings/{id}', {
    list: async () => ({ resources: (await store.list()).drawings.map(d => ({
      uri: drawingUri(d.id), name: d.title, mimeType: DRAWING_MIME, description: describe(d),
    })) }),
  }), {
    title: 'Excalidraw drawing',
    description: 'A locally saved drawing: standard .excalidraw JSON plus a plugin field with id, title and revision. Use read_drawing/patch_drawing to edit.',
    mimeType: DRAWING_MIME,
  }, async (uri, { id }) => ({
    contents: [{ uri: uri.href, mimeType: DRAWING_MIME, text: JSON.stringify(await store.read(idSchema.parse(id))) }],
  }));
  // OpenAI composer at-mentions: the host calls this as the user types "@…"; it is hidden from the model.
  server.registerTool('mention_drawings', {
    title: 'Excalidraw 图纸',
    description: 'Typeahead search for @-mentioning local drawings. Called by the host composer, not by the model.',
    inputSchema: { query: z.string().max(200).default('') },
    annotations: readonly,
    _meta: { 'openai/extensions': { 'mentions/search': {} }, ui: { visibility: ['app'] } },
  }, async ({ query }) => {
    try {
      const needle = query.trim().toLocaleLowerCase();
      const items = (await store.list()).drawings
        .filter(d => d.title.toLocaleLowerCase().includes(needle)).slice(0, 20)
        .map(d => ({ type: 'resource_link' as const, uri: drawingUri(d.id), name: d.title, mimeType: DRAWING_MIME, description: describe(d) }));
      return { content: [], structuredContent: { items } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed';
      return { isError: true, content: [{ type: 'text' as const, text: message }] };
    }
  });
  registerAppTool(server, 'open_library', {
    title: 'Excalidraw 图纸库', description: 'Open the dedicated local drawing library, intended for Sidebar. If the host cannot show Sidebar, this explicit library tool can open a library App. Use open_drawing for conversation cards.',
    inputSchema: {}, annotations: readonly,
    _meta: { ui: { resourceUri: LIBRARY_URI }, ...(process.env.EXCALIDRAW_ENABLE_SIDEBAR === '0' ? {} : { 'openai/ui': { entrypoints: [{ type: 'global' }] } }) },
  }, () => guarded(async () => ({ view: 'library', ...await store.list() })));
  server.registerTool('list_drawings', { description: 'List locally saved drawings without opening a UI.', inputSchema: {}, annotations: readonly },
    () => guarded(() => store.list()));
  registerAppTool(server, 'open_drawing', {
    description: 'Open a specific drawing in the inline Excalidraw MCP App.',
    inputSchema: { id: idSchema }, _meta: { ui }, annotations: readonly,
  }, ({ id }) => guarded(async () => ({ document: await store.read(id) })));
  server.registerTool('read_drawing', {
    description: 'Read the latest scene and revision before editing. Includes locally embedded image data.',
    inputSchema: { id: idSchema }, annotations: readonly,
  }, ({ id }) => guarded(async () => ({ document: await store.read(id) })));
  registerAppTool(server, 'create_drawing', {
    description: 'Create a local drawing and show it as a fixed-ID card that opens straight in the editor. Optional scene contains Excalidraw elements; omit for a blank canvas.',
    inputSchema: { title: titleSchema, scene: sceneSchema.optional() }, annotations: writable, _meta: { ui },
  }, ({ title, scene }) => guarded(async () => ({ document: await store.create(title, scene) })));
  server.registerTool('save_drawing', {
    description: 'Save a complete scene with expectedRevision. Rejects stale writes; no force overwrite. Preserves five backups.',
    inputSchema: { id: idSchema, expectedRevision: z.number().int().positive(), scene: sceneSchema, title: titleSchema.optional() },
    annotations: { ...writable, destructiveHint: true },
  }, ({ id, expectedRevision, scene, title }) => guarded(async () => ({ document: await store.save(id, expectedRevision, scene, title) })));
  server.registerTool('patch_drawing', {
    description: 'Read first, then upsert complete Excalidraw elements by ID and/or delete IDs. Untouched elements and files are preserved. For image changes use save_drawing with complete files.',
    inputSchema: { id: idSchema, expectedRevision: z.number().int().positive(), upsert: z.array(elementSchema).max(20_000).default([]), removeIds: z.array(z.string()).default([]) },
    annotations: { ...writable, destructiveHint: true },
  }, ({ id, expectedRevision, upsert, removeIds }) => guarded(async () => {
    const doc = await store.read(id);
    if (doc.plugin.revision !== expectedRevision) throw new ConflictError(doc.plugin.revision);
    const changes = new Map(upsert.map(e => [e.id, e]));
    const removed = new Set(removeIds);
    const elements = doc.elements.filter(e => !removed.has(e.id)).map(e => {
      const next = changes.get(e.id); changes.delete(e.id); return next ?? e;
    });
    for (const next of changes.values()) if (!removed.has(next.id)) elements.push(next);
    return { document: await store.save(id, expectedRevision, { elements, appState: doc.appState, files: doc.files }) };
  }));
  return server;
}
