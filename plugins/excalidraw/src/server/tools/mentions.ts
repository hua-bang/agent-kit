import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DrawingStore } from '../../storage/drawings.js';
import { DRAWING_MIME, drawingUri, readonly } from '../constants.js';
import { describeDrawing } from '../resources.js';

// OpenAI composer at-mentions: the host calls this as the user types "@…"; it is hidden from the model.
export function registerMentionTool(server: McpServer, store: DrawingStore) {
  server.registerTool('mention_drawings', {
    title: 'Agentic Excalidraw',
    description: 'Typeahead search for @-mentioning local drawings. Called by the host composer, not by the model.',
    inputSchema: { query: z.string().max(200).default('') },
    annotations: readonly,
    _meta: { 'openai/extensions': { 'mentions/search': {} }, ui: { visibility: ['app'] } },
  }, async ({ query }) => {
    try {
      const needle = query.trim().toLocaleLowerCase();
      const items = (await store.list()).drawings
        .filter(d => d.title.toLocaleLowerCase().includes(needle)).slice(0, 20)
        .map(d => ({ type: 'resource_link' as const, uri: drawingUri(d.id), name: d.title, mimeType: DRAWING_MIME, description: describeDrawing(d) }));
      return { content: [], structuredContent: { items } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed';
      return { isError: true, content: [{ type: 'text' as const, text: message }] };
    }
  });
}
