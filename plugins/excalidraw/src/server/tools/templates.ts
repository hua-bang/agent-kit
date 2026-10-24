import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DrawingStore } from '../../storage/drawings.js';
import { idSchema, sceneOf, sceneSchema, titleSchema } from '../../shared/schemas.js';
import { TEMPLATE_IDS, templateName, withPlaceholders } from '../../shared/templates.js';
import { readonly, writable } from '../constants.js';
import { guarded } from '../result.js';

const language = z.enum(['zh-CN', 'en']).default('en');

/** Built-in presets plus the user's own templates (saved from a drawing or a scene). */
export function registerTemplateTools(server: McpServer, store: DrawingStore) {
  server.registerTool('list_templates', {
    description: 'List starter templates: built-in presets (by name) and the user\'s own saved templates (by UUID, with when to use them). Pass either id as create_drawing\'s template.',
    inputSchema: {}, annotations: readonly,
  }, () => guarded(async () => ({
    builtIn: TEMPLATE_IDS.map(id => ({ id, name: templateName(id), nameZh: templateName(id, 'zh-CN') })),
    ...await store.listTemplates(),
  })));
  server.registerTool('read_template', {
    description: 'Read one of the user\'s own templates, including its scene.',
    inputSchema: { id: idSchema }, annotations: readonly,
  }, ({ id }) => guarded(async () => ({ template: await store.readTemplate(id) })));
  server.registerTool('save_template', {
    description: 'Save a reusable template to the user\'s "My templates", from a drawing (drawingId, its latest saved scene) or a scene. '
      + 'Use when the user asks to keep a diagram as a template, e.g. after drawing a draft from their description. '
      + 'placeholders: true replaces every text with a numbered placeholder, keeping only structure and colours.',
    inputSchema: {
      name: titleSchema, description: z.string().trim().max(500).default(''),
      drawingId: idSchema.optional(), scene: sceneSchema.optional(),
      placeholders: z.boolean().default(false), language,
    },
    annotations: writable,
  }, ({ name, description, drawingId, scene, placeholders, language }) => guarded(async () => {
    if (!drawingId === !scene) throw new Error('Pass exactly one of drawingId or scene');
    let source = scene ?? sceneOf(await store.read(drawingId!));
    if (placeholders) source = withPlaceholders(source, language);
    const { scene: saved, ...template } = await store.createTemplate(name, description, source);
    return { template: { ...template, elementCount: saved.elements.length } };
  }));
  server.registerTool('delete_template', {
    description: 'Delete one of the user\'s own templates, only when the user explicitly asks. The file moves to the local trash folder.',
    inputSchema: { id: idSchema }, annotations: { ...writable, destructiveHint: true },
  }, ({ id }) => guarded(async () => ({ deleted: await store.deleteTemplate(id) })));
}
