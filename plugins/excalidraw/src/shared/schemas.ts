import { z } from 'zod';

export const idSchema = z.string().uuid();
const finite = z.number().finite();
export const elementSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(['rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line', 'freedraw', 'image', 'frame', 'magicframe', 'embeddable', 'iframe']),
  x: finite, y: finite, width: finite.nonnegative(), height: finite.nonnegative(),
}).passthrough().refine(e => !['iframe', 'embeddable', 'magicframe'].includes(e.type), 'Embedded/remote content is not supported');
export const sceneSchema = z.object({
  elements: z.array(elementSchema).max(20_000),
  appState: z.object({
    viewBackgroundColor: z.string().max(100).optional(),
    gridSize: finite.optional(),
    gridStep: finite.optional(),
    gridModeEnabled: z.boolean().optional(),
  }).default({}),
  files: z.record(z.string(), z.object({
    id: z.string(),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    dataURL: z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/),
    created: finite,
    lastRetrieved: finite.optional(),
  })).default({}),
}).superRefine((scene, ctx) => {
  const ids = new Set<string>();
  for (const element of scene.elements) {
    if (ids.has(element.id)) ctx.addIssue({ code: 'custom', message: 'Duplicate element ID' });
    ids.add(element.id);
    if (element.type === 'image' && !element.isDeleted &&
        (typeof element.fileId !== 'string' || !scene.files[element.fileId])) {
      ctx.addIssue({ code: 'custom', message: 'Image is missing its local file data' });
    }
  }
  for (const [key, file] of Object.entries(scene.files)) {
    if (key !== file.id) ctx.addIssue({ code: 'custom', message: 'File ID mismatch' });
  }
});
export const titleSchema = z.string().trim().min(1).max(160);
export const documentSchema = z.object({
  type: z.literal('excalidraw'), version: z.literal(2), source: z.string(),
  elements: sceneSchema.shape.elements,
  appState: sceneSchema.shape.appState,
  files: sceneSchema.shape.files,
  plugin: z.object({ id: idSchema, title: titleSchema, revision: z.number().int().positive(), createdAt: z.string(), updatedAt: z.string() }),
});
export type Scene = z.infer<typeof sceneSchema>;
export type Drawing = z.infer<typeof documentSchema>;
export type DrawingSummary = Drawing['plugin'];
export const emptyScene: Scene = { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} };
export function sceneOf(doc: Drawing): Scene { return { elements: doc.elements, appState: doc.appState, files: doc.files }; }
