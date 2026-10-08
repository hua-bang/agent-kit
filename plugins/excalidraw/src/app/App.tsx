import { useEffect, useState } from 'react';
import { callTool } from './host/bridge';
import { useHost } from './host/useHost';
import { useModelContext } from './host/modelContext';
import { useSession } from './host/session';
import { useDrawing } from './drawing/useDrawing';
import { Editor } from './drawing/Editor';
import { useLibrary } from './library/useLibrary';
import { LibraryView } from './library/LibraryView';
import { useLocale } from './ui/useLocale';
import { IconCanvas } from './ui/icons';
import type { Drawing } from '../shared/schemas';

/**
 * Composes the surface. The library (Sidebar, conversation panel) lists drawings and
 * enters the editor; a conversation card shows one drawing in the editor directly.
 */
export function App() {
  // Entry surface is assigned by the resource, never inferred from a session or viewport.
  const isLibrary = document.querySelector('meta[name="excalidraw-surface"]')?.getAttribute('content') === 'library';
  const [notice, setNotice] = useState('');
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
      if (isLibrary) session.restore();
      // A tool result may arrive with the handshake. Do not replace its document.
      if (isLibrary) void library.refresh();
    },
    failed(message) { drawing.setError(t.connectFailed(message)); drawing.setStatus('disconnected'); },
  });
  const { locale, t, toggle: toggleLocale } = useLocale(host.hostLocale);
  const drawing = useDrawing({ connected: host.connected, isLibrary, t, onLoaded: isLibrary ? session.remember : undefined });
  const { doc, error } = drawing;
  const library = useLibrary(host.connected, isLibrary && !doc, message => drawing.setError(message));
  const modelContext = useModelContext(host.connected, { t, isLibrary, doc, library: library.library, query, session: session.session });

  async function action(work: () => Promise<void>) {
    setBusy(true); drawing.setError('');
    try { await work(); } catch (e) { drawing.setError(String(e)); } finally { setBusy(false); }
  }
  const open = async (tool: string, args: Record<string, unknown>) => drawing.load((await callTool<{ document: Drawing }>(tool, args)).document);
  const messages = <>
    {error && <div className="banner error" role="alert"><span>{error}</span>{!doc && host.connected && isLibrary && <button className="tool" onClick={() => void library.refresh()}>{t.retry}</button>}</div>}
    {notice && <div className="banner notice" role="status">{notice}</div>}
  </>;
  return <main lang={locale} className={`app ${isLibrary ? 'library-surface' : 'drawing-surface'} ${doc ? 'is-editing' : ''}`}>
    <a className="skip-link" href="#main-content">{t.skipLink}</a>
    {doc ? <Editor drawing={drawing} doc={doc} isLibrary={isLibrary} t={t} locale={locale} theme={host.theme}
      busy={busy} action={work => void action(work)} onNotice={setNotice} toggleLocale={toggleLocale} messages={messages}
      onBack={() => void action(async () => {
        await drawing.close();
        setNotice(''); // Notices describe the editor session; do not carry them back to the list.
        library.setLibrary(null); await library.refresh();
      })} />
    : isLibrary ? <LibraryView library={library.library} session={session.session} query={query} setQuery={setQuery}
      t={t} locale={locale} theme={host.theme} connected={host.connected} busy={busy} refreshing={library.refreshing} failed={!!error}
      onOpen={id => void action(async () => { await open('read_drawing', { id }); setNotice(''); })}
      onCreate={(title, created) => void action(async () => { await open('create_drawing', { title }); created(); setNotice(''); })}
      onRefresh={() => void library.refresh()} toggleLocale={toggleLocale} messages={messages} />
    : <section id="main-content" className={`card waiting ${slowStart ? '' : 'is-quiet'}`} role="status">
      <span className="empty-icon"><IconCanvas /></span>
      <span>{host.connected ? t.waitingDrawing : t.connecting}</span>
    </section>}
  </main>;
}
