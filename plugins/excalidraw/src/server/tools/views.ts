import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { DrawingStore } from '../../storage/drawings.js';
import { z } from 'zod';
import { idSchema, sceneSchema, titleSchema } from '../../shared/schemas.js';
import { TEMPLATE_IDS, templateScene, type TemplateId } from '../../shared/templates.js';
import { config } from '../config.js';
import { LIBRARY_URI, PANEL_URI, UI_URI, readonly, writable } from '../constants.js';
import { guarded } from '../result.js';

/** Tools that open an App view: the library (entrypoints) and fixed-ID drawing cards. */
export function registerViewTools(server: McpServer, store: DrawingStore) {
  const ui = { resourceUri: UI_URI };
  // Declared on the tool so hosts record UI info with each call (Codex keeps it in history
  // as mcpAppUi) and can render the card from a past call, not only from the live result.
  const card = { ui, 'openai/ui': { preferredModelDisplayMode: 'inline' } };
  // Sidebar: one library for the whole app. The side panel is a separate tool and page, because an
  // App cannot tell which entrypoint opened it, and only the panel belongs to one conversation.
  registerAppTool(server, 'open_library', {
    title: 'Agentic Excalidraw', description: 'Open the dedicated local drawing library, intended for the Sidebar. If the host cannot show it, this explicit library tool can open a library App. Use open_drawing for conversation cards.',
    inputSchema: {}, annotations: readonly,
    _meta: { ui: { resourceUri: LIBRARY_URI }, ...(config.sidebar ? { 'openai/ui': { entrypoints: [{ type: 'global' }] } } : {}) },
  }, () => guarded(async () => ({ view: 'library', ...await store.list() })));
  if (config.thread) registerAppTool(server, 'open_panel', {
    title: 'Agentic Excalidraw', description: 'Open the drawing library beside this conversation. Drawings opened there are grouped as this conversation\'s. Opened by the user from the conversation side panel.',
    inputSchema: {}, annotations: readonly,
    _meta: { ui: { resourceUri: PANEL_URI }, 'openai/ui': { entrypoints: [{ type: 'thread' }] } },
  }, () => guarded(async () => ({ view: 'library', ...await store.list() })));
  registerAppTool(server, 'open_drawing', {
    description: 'Open a specific drawing in the inline Agentic Excalidraw MCP App.',
    inputSchema: { id: idSchema }, _meta: card, annotations: readonly,
  }, ({ id }) => guarded(async () => ({ document: await store.read(id) })));
  registerAppTool(server, 'create_drawing', {
    description: 'Create a local drawing and show it as a fixed-ID card that opens straight in the editor. Optional scene contains Excalidraw elements; '
      + `or pass template (a built-in ${TEMPLATE_IDS.join(', ')} in language zh-CN or en, or the UUID of one of the user's own templates from list_templates) to start from an editable starter diagram, then read and patch it to fit; omit both for a blank canvas.`,
    inputSchema: {
      title: titleSchema, scene: sceneSchema.optional(),
      template: z.union([z.enum(TEMPLATE_IDS), idSchema]).optional(), language: z.enum(['zh-CN', 'en']).default('en'),
    }, annotations: writable, _meta: card,
  }, ({ title, scene, template, language }) => guarded(async () => {
    if (scene && template) throw new Error('Pass either scene or template, not both');
    const fromTemplate = !template ? scene
      : (TEMPLATE_IDS as readonly string[]).includes(template) ? templateScene(template as TemplateId, { locale: language })
      : (await store.readTemplate(template)).scene;
    return { document: await store.create(title, fromTemplate) };
  }));
}
