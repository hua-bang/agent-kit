import { useEffect, useState } from 'react';
import { bridge, callTool, openExternal } from './host/bridge';
import { useHost } from './host/useHost';
import { useModelContext } from './host/modelContext';
import { useSession } from './host/session';
import { useDrawing } from './drawing/useDrawing';
import { Editor } from './drawing/Editor';
import { useLibrary } from './library/useLibrary';
import { useTemplates } from './library/useTemplates';
import { LibraryView } from './library/LibraryView';
import { useLocale } from './ui/useLocale';
import { IconCanvas } from './ui/icons';
import type { Drawing, TemplateSummary } from '../shared/schemas';

/**
 * How long a notice stays. `info` fades after a few seconds; `agent` ("sent to the chat")
 * closes when the agent's change to the drawing arrives, or after a longer wait;
 * `sticky` carries something to act on (a rejected message, a link to copy) and waits for ×.
 */
export type NoticeKind = 'info' | 'agent' | 'sticky';
const NOTICE_MS: Record<Exclude<NoticeKind, 'sticky'>, number> = { info: 6000, agent: 20000 };

/**
 * Composes the surface. The library (Sidebar, conversation panel) lists drawings and
 * enters the editor; a conversation card shows one drawing in the editor directly.
 */
export function App() {
  // Entry surface is assigned by the resource, never inferred from a session or viewport.
  // The conversation panel is the library plus a "this conversation" group.
  const surface = document.querySelector('meta[name="excalidraw-surface"]')?.getAttribute('content');
  const isPanel = surface === 'panel';
  const isLibrary = surface === 'library' || isPanel;
  const [notice, setNoticeState] = useState<{ text: string; kind: NoticeKind } | null>(null);
  const setNotice = (text: string, kind: NoticeKind = 'info') => setNoticeState(text ? { text, kind } : null);
  useEffect(() => {
    if (!notice || notice.kind === 'sticky') return;
    const timer = setTimeout(() => setNoticeState(null), NOTICE_MS[notice.kind]);
    return () => clearTimeout(timer);
  }, [notice]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  // Most cards connect and load within a moment; only explain the wait if it actually takes a while.
  const [slowStart, setSlowStart] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlowStart(true), 800); return () => clearTimeout(timer); }, []);
  const session = useSession();
  const host = useHost({
    toolResult(payload) {
      try {
        if (payload.document) drawing.receive(payload.document);
        else if (isLibrary && payload.view === 'library' && drawing.idle) void drawing.close().then(library.refresh);
      } catch (e) { drawing.setError(String(e)); }
    },
    hostContextChanged(context) { modelContext.hostContextChanged(context); },
    connected() {
      drawing.setStatus('connected');
      if (isPanel) session.restore();
      // A tool result may arrive with the handshake. Do not replace its document.
      if (isLibrary) void library.refresh();
    },
    failed(message) { drawing.setError(t.connectFailed(message)); drawing.setStatus('disconnected'); },
  });
  const { locale, t, toggle: toggleLocale } = useLocale(host.hostLocale);
  // Excalidraw's own external links (help dialog and similar) try to open a new window, which host sandboxes block.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      // Element links (Excalidraw's link popup) go through onLinkOpen in the editor instead.
      if (!anchor || anchor.closest('.excalidraw-hyperlinkContainer') || !/^https?:/i.test(anchor.href) || new URL(anchor.href).origin === location.origin) return;
      event.preventDefault();
      void openExternal(anchor.href).then(opened => { if (!opened) setNotice(t.linkUnavailable(anchor.href), 'sticky'); });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [t]);
  const drawing = useDrawing({ connected: host.connected, isLibrary, t, onLoaded(id) {
    if (isPanel) session.remember(id);
    // The agent's edit has landed, so "sent to the chat" is done.
    setNoticeState(current => current?.kind === 'agent' ? null : current);
  } });
  const { doc, error } = drawing;
  const library = useLibrary(host.connected, isLibrary && !doc, message => drawing.setError(message));
  const templates = useTemplates(host.connected);
  // A drawing or template the agent saved shows up with the next library change.
  useEffect(() => { if (library.library) void templates.refresh(); }, [library.library, templates.refresh]);
  const canAsk = host.connected && !!bridge.getHostCapabilities()?.message;
  const modelContext = useModelContext(host.connected, { t, isLibrary, doc, library: library.library, query, session: session.session });

  async function action(work: () => Promise<void>) {
    setBusy(true); drawing.setError('');
    try { await work(); } catch (e) { drawing.setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const open = async (tool: string, args: Record<string, unknown>) => drawing.load((await callTool<{ document: Drawing }>(tool, args)).document);
  const messages = <>
    {error && <div className="banner error" role="alert"><span>{error}</span>{!doc && host.connected && isLibrary && <button className="tool" onClick={() => void library.refresh()}>{t.retry}</button>}</div>}
    {notice && <div className="banner notice" role="status"><span>{notice.text}</span><button type="button" className="ghost icon-button dismiss" aria-label={t.dismiss} title={t.dismiss} onClick={() => setNotice('')}>×</button></div>}
  </>;
  return <main lang={locale} className={`app ${isLibrary ? 'library-surface' : 'drawing-surface'} ${doc ? 'is-editing' : ''}`}>
    <a className="skip-link" href="#main-content">{t.skipLink}</a>
    {doc ? <Editor drawing={drawing} doc={doc} isLibrary={isLibrary} t={t} locale={locale} theme={host.theme}
      busy={busy} action={work => void action(work)} onNotice={setNotice} templates={templates.templates} refreshTemplates={templates.refresh} toggleLocale={toggleLocale} messages={messages}
      onBack={() => void action(async () => {
        await drawing.close();
        setNotice(''); // Notices describe the editor session; do not carry them back to the list.
        library.setLibrary(null); await library.refresh();
      })} />
    : isLibrary ? <LibraryView library={library.library} session={session.session} query={query} setQuery={setQuery}
      t={t} locale={locale} theme={host.theme} connected={host.connected} busy={busy} refreshing={library.refreshing} failed={!!error}
      onOpen={id => void action(async () => { await open('read_drawing', { id }); setNotice(''); })}
      templates={templates.templates} canAsk={canAsk}
      onDeleteTemplate={(template: TemplateSummary) => void action(async () => {
        await callTool('delete_template', { id: template.id });
        setNotice(t.templateDeleted(template.name)); await templates.refresh();
      })}
      onGenerate={(description, sent) => void action(async () => {
        const { isError } = await bridge.sendMessage({ role: 'user', content: [{ type: 'text', text: t.generatePrompt(description) }] });
        if (isError) setNotice(t.messageRejected, 'sticky'); else setNotice(t.generateSent, 'agent');
        if (!isError) sent();
      })}
      onCreate={(title, created, template) => void action(async () => { await open('create_drawing', { title, ...(template ? { template, language: locale } : {}) }); created(); setNotice(''); })}
      onDelete={d => void action(async () => {
        await callTool('delete_drawing', { id: d.id, expectedRevision: d.revision });
        setNotice(t.deleted(d.title)); await library.refresh();
      })}
      onRefresh={() => void library.refresh()} toggleLocale={toggleLocale} messages={messages} />
    : <section id="main-content" className={`card waiting ${slowStart ? '' : 'is-quiet'}`} role="status">
      <span className="empty-icon"><IconCanvas /></span>
      <span>{host.connected ? t.waitingDrawing : t.connecting}</span>
    </section>}
  </main>;
}
