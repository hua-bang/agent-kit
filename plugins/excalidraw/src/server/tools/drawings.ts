import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DrawingStore } from '../../storage/drawings.js';
import { elementSchema, idSchema, sceneSchema, titleSchema } from '../../shared/schemas.js';
import { readonly, writable } from '../constants.js';
import { guarded } from '../result.js';

/** Data tools without a UI: list, read and revision-checked writes. */
export function registerDrawingTools(server: McpServer, store: DrawingStore) {
  server.registerTool('list_drawings', { description: 'List locally saved drawings without opening a UI.', inputSchema: {}, annotations: readonly },
    () => guarded(() => store.list()));
  server.registerTool('read_drawing', {
    description: 'Read the latest scene and revision before editing. Includes locally embedded image data.',
    inputSchema: { id: idSchema }, annotations: readonly,
  }, ({ id }) => guarded(async () => ({ document: await store.read(id) })));
  server.registerTool('save_drawing', {
    description: 'Save a complete scene with expectedRevision. Rejects stale writes; no force overwrite. Preserves five backups.',
    inputSchema: { id: idSchema, expectedRevision: z.number().int().positive(), scene: sceneSchema, title: titleSchema.optional() },
    annotations: { ...writable, destructiveHint: true },
  }, ({ id, expectedRevision, scene, title }) => guarded(async () => ({ document: await store.save(id, expectedRevision, scene, title) })));
  server.registerTool('patch_drawing', {
    description: 'Read first, then upsert complete Excalidraw elements by ID and/or delete IDs. Untouched elements and files are preserved. For image changes use save_drawing with complete files.',
    inputSchema: { id: idSchema, expectedRevision: z.number().int().positive(), upsert: z.array(elementSchema).max(20_000).default([]), removeIds: z.array(z.string()).default([]) },
    annotations: { ...writable, destructiveHint: true },
  }, ({ id, expectedRevision, upsert, removeIds }) => guarded(async () => ({ document: await store.patch(id, expectedRevision, upsert, removeIds) })));
}
