import { z } from 'zod';
import { ConflictError } from '../storage/drawings.js';
import type { Drawing } from '../shared/schemas.js';

// Text for the model stays small (document metadata only); the full payload rides in structuredContent.
export const result = (data: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: JSON.stringify('document' in data
    ? { document: (data.document as Drawing).plugin } : data) }], structuredContent: data,
});
/** Run a tool body and turn failures into readable tool errors; conflicts carry the current revision. */
export async function guarded(fn: () => Promise<Record<string, unknown>>) {
  try { return result(await fn()); }
  catch (error) {
    const message = error instanceof z.ZodError ? 'Invalid drawing data: ' + error.issues.map(i => i.message).join('; ')
      : error instanceof Error && 'code' in error && error.code === 'ENOENT' ? 'Drawing not found'
      : error instanceof Error ? error.message : 'Operation failed';
    return { isError: true, content: [{ type: 'text' as const, text: message }],
      structuredContent: { error: message, ...(error instanceof ConflictError ? { currentRevision: error.currentRevision } : {}) } };
  }
}
