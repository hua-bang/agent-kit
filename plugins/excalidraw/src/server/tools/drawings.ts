import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DrawingStore } from '../../storage/drawings.js';
import { elementSchema, idSchema, libraryItemsSchema, sceneSchema, titleSchema, type Drawing } from '../../shared/schemas.js';
import { operationSchema, outlineScene } from '../../shared/graph.js';
import { TONE_NAMES } from '../../shared/elements.js';
import { readonly, writable } from '../constants.js';
import { guarded } from '../result.js';

// The model reads a drawing through its outline (nodes, connectors, labels, IDs); the full scene rides in structuredContent.
const withOutline = (document: Drawing) => ({ document, outline: outlineScene(document) });

/** Data tools without a UI: list, read and revision-checked writes. */
export function registerDrawingTools(server: McpServer, store: DrawingStore) {
  server.registerTool('list_drawings', { description: 'List locally saved drawings without opening a UI.', inputSchema: {}, annotations: readonly },
    () => guarded(() => store.list()));
  server.registerTool('read_drawing', {
    description: 'Read the latest revision before editing. Returns an outline of the drawing: nodes (id, type, label, position, size, colour), '
      + 'connectors (id, from/to node IDs or free [x, y] ends, label), free texts and issues such as unbound arrows. '
      + 'The full Excalidraw scene, with embedded images, is in the structured result; pass elementIds to also get those elements\' complete JSON as text.',
    inputSchema: { id: idSchema, elementIds: z.array(z.string()).max(200).optional() }, annotations: readonly,
  }, ({ id, elementIds }) => guarded(async () => {
    const document = await store.read(id);
    const wanted = new Set(elementIds ?? []);
    return { ...withOutline(document), ...(elementIds ? { elements: document.elements.filter(e => wanted.has(e.id)) } : {}) };
  }));
  server.registerTool('edit_drawing', {
    description: 'Preferred way to change a diagram: node-level operations, applied in order, that keep labels inside their shapes and arrows bound to them. '
      + 'Ops: add_node {id, label, shape?, x/y or near {id, side: right|left|above|below, gap?}, width?, height?, color?}; '
      + 'connect {from, to, label?, id?, dashed?, arrowhead?: end|both|none, color?} draws a bound arrow; reconnect {id, from?, to?} moves an arrow\'s ends to other nodes; '
      + 'label {id, text} sets, adds or (with "") removes the label of a node or connector, or the text of a text element; '
      + 'move {ids, dx/dy} or {ids: [one], x, y}: labels and attached arrows follow; update {id, x?, y?, width?, height?, color?, style?} merges fields; '
      + 'remove {ids, keepConnectors?} also removes their labels and the arrows attached to them. '
      + `Colours: ${TONE_NAMES.join(', ')}. style merges other Excalidraw fields (strokeStyle, fontSize…). `
      + 'Needs expectedRevision from the latest read; returns the new outline.',
    inputSchema: { id: idSchema, expectedRevision: z.number().int().positive(), operations: z.array(operationSchema).min(1).max(500) },
    annotations: { ...writable, destructiveHint: true },
  }, ({ id, expectedRevision, operations }) => guarded(async () => withOutline(await store.edit(id, expectedRevision, operations))));
  server.registerTool('save_drawing', {
    description: 'Save a complete scene with expectedRevision. Rejects stale writes; no force overwrite. Preserves five backups.',
    inputSchema: { id: idSchema, expectedRevision: z.number().int().positive(), scene: sceneSchema, title: titleSchema.optional() },
    annotations: { ...writable, destructiveHint: true },
  }, ({ id, expectedRevision, scene, title }) => guarded(async () => ({ document: await store.save(id, expectedRevision, scene, title) })));
  server.registerTool('patch_drawing', {
    description: 'Low-level edit: read first, then upsert complete Excalidraw elements by ID and/or delete IDs. Untouched elements and files are preserved. '
      + 'Arrows bound to a shape that moved or resized are rerouted, labels of removed shapes are removed and boundElements are kept two-way. '
      + 'Prefer edit_drawing for adding, connecting, relabelling, moving or removing nodes. For image changes use save_drawing with complete files.',
    inputSchema: { id: idSchema, expectedRevision: z.number().int().positive(), upsert: z.array(elementSchema).max(20_000).default([]), removeIds: z.array(z.string()).default([]) },
    annotations: { ...writable, destructiveHint: true },
  }, ({ id, expectedRevision, upsert, removeIds }) => guarded(async () => withOutline(await store.patch(id, expectedRevision, upsert, removeIds))));
  server.registerTool('delete_drawing', {
    description: 'Delete a drawing only when the user explicitly asks. Requires expectedRevision from the latest read or list. The file moves to the local trash folder and is no longer listed.',
    inputSchema: { id: idSchema, expectedRevision: z.number().int().positive() },
    annotations: { ...writable, destructiveHint: true },
  }, ({ id, expectedRevision }) => guarded(async () => ({ deleted: await store.delete(id, expectedRevision) })));
  // The editor's personal library ("素材库"). Called by the App only; hidden from the model.
  const appOnly = { ui: { visibility: ['app'] } };
  server.registerTool('read_library', { description: 'Read the personal Excalidraw library. Called by the App, not by the model.', inputSchema: {}, annotations: readonly, _meta: appOnly },
    () => guarded(async () => ({ libraryItems: await store.readLibrary() })));
  server.registerTool('save_library', {
    description: 'Replace the personal Excalidraw library. Called by the App, not by the model.',
    inputSchema: { libraryItems: libraryItemsSchema }, annotations: { ...writable, destructiveHint: true }, _meta: appOnly,
  }, ({ libraryItems }) => guarded(async () => ({ saved: await store.saveLibrary(libraryItems) })));
}
