import { useEffect, useRef } from 'react';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { bridge } from './bridge';
import type { Messages } from '../ui/i18n';
import type { Drawing, DrawingSummary } from '../../shared/schemas';
import type { Library } from '../library/useLibrary';

type View = { t: Messages; isLibrary: boolean; doc: Drawing | null; library: Library | null; query: string; session: string[] };

/**
 * Tool calls made by this view never reach the model on their own. Report what
 * is on screen so the user can refer to "this list" or "this drawing" in chat.
 * Each update replaces the previous one; hosts without support are skipped.
 * If the user removes the attachment, stay quiet until they move to another view.
 */
export function useModelContext(connected: boolean, view: View) {
  const sent = useRef<string | null>(null);
  const dismissed = useRef<string | null>(null);
  const { t, doc, library, query, session } = view;
  useEffect(() => {
    if (!connected || !bridge.getHostCapabilities()?.updateModelContext?.text) return;
    const timer = setTimeout(() => {
      const context = describeView(view);
      if (!context || context.key === dismissed.current) return;
      dismissed.current = null;
      sent.current = context.key;
      void bridge.updateModelContext(context.params).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [connected, doc?.plugin.id, doc?.plugin.revision, doc?.plugin.title, library, query, t, session]);
  return {
    /** OpenAI hosts clear `openai/modelContext` when the user removes the context attachment. */
    hostContextChanged(context: McpUiHostContext) {
      if ((context as Record<string, unknown>)['openai/modelContext'] === null) dismissed.current = sent.current;
    },
  };
}

/**
 * Text plus structured data describing the current view, for ui/update-model-context.
 * `key` identifies the view (not its contents) so a removed attachment stays removed until it changes.
 * `openai/title` labels the composer attachment on OpenAI hosts; other hosts ignore it.
 */
function describeView({ t, isLibrary, doc, library, query, session }: View) {
  const block = (title: string, text: string) => ({ type: 'text' as const, text, _meta: { 'openai/title': title } });
  const drawing = (d: DrawingSummary) => ({ id: d.id, title: d.title, revision: d.revision, updatedAt: d.updatedAt });
  if (doc) {
    const view = 'editor';
    const text = `The user has the Agentic Excalidraw drawing "${doc.plugin.title}" open in the editor `
      + `(id ${doc.plugin.id}, revision ${doc.plugin.revision}, ${doc.elements.filter(e => !e.isDeleted).length} elements). `
      + 'Call read_drawing with this id for its latest content before describing or changing it; use patch_drawing with the latest revision to edit.'
      + ' The editor autosaves about every 1.2 seconds.'
      + (isLibrary && session.length > 1 ? ` Drawings opened in this panel, newest first: ${session.join(', ')}.` : '');
    return { key: `${view}:${doc.plugin.id}`, params: {
      content: [block(`Agentic Excalidraw · ${doc.plugin.title}`, text)],
      structuredContent: { app: 'local-excalidraw', view, drawing: drawing(doc.plugin), ...(isLibrary ? { session } : {}) },
    } };
  }
  if (!isLibrary || !library) return null;
  const needle = query.toLocaleLowerCase();
  const shown = library.drawings.filter(d => d.title.toLocaleLowerCase().includes(needle));
  const listed = shown.slice(0, 50);
  const text = [
    `The user is viewing the Agentic Excalidraw drawing library: ${library.drawings.length} drawing(s)`
      + (query ? `, filtered by "${query}" to ${shown.length}` : '') + ', most recently updated first.',
    ...(session.length ? [`Opened in this panel (this conversation), newest first: ${session.join(', ')}.`] : []),
    ...listed.map(d => `- "${d.title}" (id ${d.id}, revision ${d.revision}, updated ${d.updatedAt})`),
    ...(shown.length > listed.length ? [`- …and ${shown.length - listed.length} more; call list_drawings for all.`] : []),
    'Call read_drawing with an id to see a drawing\'s content.',
  ].join('\n');
  return { key: `library:${query}`, params: {
    content: [block(t.libraryContextTitle(`${query ? `${shown.length}/` : ''}${library.drawings.length}`), text)],
    structuredContent: { app: 'local-excalidraw', view: 'library', query, total: library.drawings.length, drawings: listed.map(drawing), session },
  } };
}
