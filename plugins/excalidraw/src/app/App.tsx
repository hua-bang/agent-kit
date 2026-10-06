import { useEffect, useRef, useState } from 'react';
import { CaptureUpdateAction, Excalidraw, MainMenu, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import { applyDocumentTheme, type McpUiTheme } from '@modelcontextprotocol/ext-apps';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { bridge, callTool } from './bridge';
import { Preview } from './Preview';
import { messagesFor, pickLocale, storedLocale, storeLocale, type Locale, type Messages, type Status } from './i18n';
import { IconBack, IconCanvas, IconCopy, IconDownload, IconLanguage, IconPlus, IconRefresh, IconSearch } from './icons';
import { documentSchema, sceneSchema, sceneOf, type Drawing, type DrawingSummary, type Scene } from '../shared/schemas';

type Library = { drawings: DrawingSummary[]; warnings: string[] };
type Payload = { document?: Drawing; view?: string };
export function App() {
  // Entry surface is assigned by the resource, never inferred from a session or viewport.
  const isLibrary = document.querySelector('meta[name="excalidraw-surface"]')?.getAttribute('content') === 'library';
  const boundId = useRef<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(false);
  const [doc, setDoc] = useState<Drawing | null>(null);
  const current = useRef<Drawing | null>(null);
  const draft = useRef<Scene | null>(null);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const dirty = useRef(false);
  // Viewport: fit each newly opened drawing, and refit on large resizes only until
  // the user pans or zooms (sidebar tabs are resized often; their view is theirs).
  const lastFit = useRef(0);
  const viewportMoved = useRef(false);
  function fit(editor: ExcalidrawImperativeAPI) {
    lastFit.current = Date.now(); viewportMoved.current = false;
    fitContent(editor);
  }
  // Excalidraw normalises a scene when it mounts; that first change is not a user edit.
  const baseline = useRef(true);
  const saving = useRef(false);
  const editCounter = useRef(0);
  const conflict = useRef(false);
  const [hostLocale, setLocale] = useState<Locale>(() => pickLocale());
  const [chosenLocale, setChosenLocale] = useState<Locale | null>(storedLocale);
  const locale = chosenLocale ?? hostLocale;
  function toggleLocale() { const next = locale === 'en' ? 'zh-CN' : 'en'; storeLocale(next); setChosenLocale(next); }
  const t = messagesFor(locale);
  const tRef = useRef(t); tRef.current = t; // For callbacks registered once.
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState('');
  const [library, setLibrary] = useState<Library | null>(null);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const mounted = useRef(true);
  const handlers = useRef({ receive: (_: Payload) => {} });
  const sentContext = useRef<string | null>(null);
  const dismissedContext = useRef<string | null>(null);
  const [theme, setTheme] = useState<McpUiTheme>(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  useEffect(() => applyDocumentTheme(theme), [theme]);

  function load(next: Drawing) {
    // A newer revision of the open drawing (agent edit, reload) replaces the scene in
    // place so zoom, scroll and the active tool stay put; only a different drawing remounts.
    const editor = current.current?.plugin.id === next.plugin.id ? api.current : null;
    current.current = next; draft.current = sceneOf(next); dirty.current = false; conflict.current = false;
    baseline.current = true;
    editCounter.current++;
    setDoc(next); setTitle(next.plugin.title); setError(''); setStatus('saved');
    if (editor) {
      const scene = restore(sceneOf(next) as unknown as Parameters<typeof restore>[0], null, null);
      editor.addFiles(Object.values(scene.files));
      // Not undoable: Ctrl+Z must not silently revert someone else's saved change.
      editor.updateScene({ elements: scene.elements, appState: { viewBackgroundColor: scene.appState.viewBackgroundColor }, captureUpdate: CaptureUpdateAction.NEVER });
      // The editor's own copy of the new scene is the baseline; no mount-time change follows.
      baseline.current = false;
      draft.current = sceneSchema.parse({ elements: editor.getSceneElementsIncludingDeleted(), appState: editor.getAppState(), files: editor.getFiles() });
    } else {
      api.current = null;
      setEditorKey(k => k + 1);
    }
  }
  handlers.current.receive = payload => {
    if (payload.document) {
      const next = documentSchema.parse(payload.document);
      if (!isLibrary && boundId.current && boundId.current !== next.plugin.id) return;
      if (!isLibrary) boundId.current = next.plugin.id;
      if (current.current?.plugin.id === next.plugin.id && current.current.plugin.revision >= next.plugin.revision) return;
      if (dirty.current || saving.current) { setError(tRef.current.incomingWhileDirty); return; }
      load(next);
    } else if (isLibrary && payload.view === 'library' && !dirty.current && !saving.current) {
      current.current = null; setDoc(null); void refreshLibrary();
    }
  };
  useEffect(() => {
    mounted.current = true;
    bridge.ontoolresult = result => {
      try { if (!result.isError && result.structuredContent) handlers.current.receive(result.structuredContent); }
      catch (e) { setError(String(e)); }
    };
    bridge.onhostcontextchanged = context => {
      if (context.theme) setTheme(context.theme);
      if (context.locale) setLocale(pickLocale(context.locale));
      if (context.containerDimensions || context.displayMode) applyFill();
      // OpenAI hosts clear this when the user removes the context attachment.
      if ((context as Record<string, unknown>)['openai/modelContext'] === null) dismissedContext.current = sentContext.current;
    };
    bridge.connect().then(() => {
      if (!mounted.current) return;
      const hostTheme = bridge.getHostContext()?.theme;
      if (hostTheme) setTheme(hostTheme);
      setLocale(pickLocale(bridge.getHostContext()?.locale));
      applyFill();
      setConnected(true); setStatus('connected');
      // A tool result may arrive with the handshake. Do not replace its document.
      if (isLibrary) void refreshLibrary();
    }).catch(e => { setError(tRef.current.connectFailed(e.message)); setStatus('disconnected'); });
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let previousWidth = window.innerWidth;
    let timer: ReturnType<typeof setTimeout>;
    const resize = () => {
      if (Math.abs(window.innerWidth - previousWidth) < 100) return;
      previousWidth = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(() => { if (api.current && !viewportMoved.current) fit(api.current); }, 150);
    };
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); clearTimeout(timer); };
  }, []);
  // Keep the list current while it is on screen (agents create and edit drawings from chat).
  // Silent: no spinner or disabled cards, and state only changes when something did.
  useEffect(() => {
    if (!connected || !isLibrary || doc) return;
    let polling = false;
    const poll = async () => {
      if (polling || document.visibilityState !== 'visible') return;
      polling = true;
      try {
        const next = await fetchLibrary();
        if (next) setLibrary(previous => previous && librarySignature(previous) === librarySignature(next) ? previous : next);
      } catch { /* The manual refresh button reports errors. */ }
      finally { polling = false; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void poll(); };
    const timer = setInterval(() => void poll(), 5000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [connected, doc]);
  // Polling and manual refresh can overlap; only the most recently started request may update the list.
  const listRequest = useRef(0);
  async function fetchLibrary() {
    const request = ++listRequest.current;
    const data = await callTool<Library>('list_drawings');
    return mounted.current && request === listRequest.current ? data : null;
  }
  async function refreshLibrary() {
    setRefreshing(true);
    try { const data = await fetchLibrary(); if (data) setLibrary(data); }
    catch (e) { if (mounted.current) setError(String(e)); }
    finally { if (mounted.current) setRefreshing(false); }
  }
  async function save() {
    if (!current.current || !draft.current || !dirty.current || saving.current || conflict.current) return;
    saving.current = true; setStatus('saving');
    const target = current.current;
    const generation = editCounter.current;
    try {
      const result = await callTool<{ document: Drawing }>('save_drawing', {
        id: target.plugin.id, expectedRevision: target.plugin.revision, scene: draft.current, title: title.trim() || target.plugin.title,
      });
      current.current = result.document;
      setDoc(result.document);
      dirty.current = generation !== editCounter.current;
      setStatus(dirty.current ? 'unsaved' : 'saved');
      setError('');
    } catch (e) {
      conflict.current = true; // Stop retry storms. Keep the unsaved draft available for export.
      setStatus('paused'); setError(String(e));
    } finally { saving.current = false; }
  }
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => { void saveRef.current(); }, 1200);
    return () => clearInterval(timer);
  }, [connected]);
  useEffect(() => {
    if (!connected) return;
    let checking = false;
    const timer = setInterval(async () => {
      if (!current.current || dirty.current || saving.current || checking || conflict.current || document.visibilityState !== 'visible') return;
      checking = true;
      const id = current.current.plugin.id;
      const fresh = () => current.current?.plugin.id === id && !dirty.current && !saving.current;
      try {
        // Compare revisions through the light metadata list; fetch the full scene (with images) only when it changed.
        const latest = (await callTool<Library>('list_drawings')).drawings.find(d => d.id === id);
        if (latest && latest.revision <= (current.current?.plugin.revision ?? Infinity)) return;
        const result = await callTool<{ document: Drawing }>('read_drawing', { id });
        if (fresh() && result.document.plugin.revision > current.current!.plugin.revision) load(result.document);
      } catch (e) { setError(tRef.current.refreshFailed(String(e))); }
      finally { checking = false; }
    }, 5000);
    return () => clearInterval(timer);
  }, [connected]);
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  // Tool calls made by this view never reach the model on their own. Report what
  // is on screen so the user can refer to "this list" or "this drawing" in chat.
  // Each update replaces the previous one; hosts without support are skipped.
  // If the user removes the attachment, stay quiet until they move to another view.
  useEffect(() => {
    if (!connected || !bridge.getHostCapabilities()?.updateModelContext?.text) return;
    const timer = setTimeout(() => {
      const context = describeView(t, isLibrary, doc, library, query);
      if (!context || context.key === dismissedContext.current) return;
      dismissedContext.current = null;
      sentContext.current = context.key;
      void bridge.updateModelContext(context.params).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [connected, doc?.plugin.id, doc?.plugin.revision, doc?.plugin.title, library, query, locale]);

  async function action(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  function download() {
    if (!current.current) return;
    const content = api.current ? serializeAsJSON(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles(), 'local') : JSON.stringify(current.current);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = current.current.plugin.title.replace(/[\\/:*?"<>|]/g, '_') + '.excalidraw'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function changed() { dirty.current = true; editCounter.current++; setStatus('unsaved'); }

  async function leaveEditor() {
    await save();
    if (dirty.current || saving.current) throw new Error(t.saveBeforeLeaving);
    api.current = null;
    setNotice(''); // Notices describe the editor session; do not carry them back to the list.
    current.current = null; setDoc(null); setLibrary(null); await refreshLibrary();
  }
  const matches = library?.drawings.filter(d => d.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? [];
  const tone = status === 'paused' || status === 'disconnected' ? 'error' : status === 'saving' || status === 'unsaved' ? 'pending' : status === 'saved' ? 'ok' : 'idle';
  // Autosave makes "saved" the normal state: announce it to screen readers, show only the exceptions.
  const statusPill = <span className={`status tone-${tone}`} role="status" aria-live="polite">{tone === 'ok' ? <span className="sr-only">{t.status[status]}</span> : <><i aria-hidden="true" />{t.status[status]}</>}</span>;
  const messages = <>
    {error && <div className="banner error" role="alert"><span>{error}</span>{!doc && connected && isLibrary && <button className="tool" onClick={() => void refreshLibrary()}>{t.retry}</button>}</div>}
    {notice && <div className="banner notice" role="status">{notice}</div>}
  </>;
  // A drawing always opens in the editor: the library enters it from the list, a conversation card shows it directly.
  return <main lang={locale} className={`app ${isLibrary ? 'library-surface' : 'drawing-surface'} ${doc ? 'is-editing' : ''}`}>
    <a className="skip-link" href="#main-content">{t.skipLink}</a>
    {doc ? <>
      <header className="editor-bar">
        {isLibrary && <button className="ghost back" disabled={busy} onClick={() => void action(leaveEditor)}><IconBack />{t.backToList}</button>}
        <input aria-label={t.titleLabel} className="title" value={title} maxLength={160} onChange={e => { setTitle(e.target.value); changed(); }} />
        {statusPill}
        {/* Autosave covers the normal case; the button only appears while work is unsaved or paused. */}
        {(tone === 'pending' || tone === 'error') && <button className="tool save" disabled={busy} onClick={() => { conflict.current = false; void save(); }}>{t.save}</button>}
      </header>
      {messages}
      <section id="main-content" className="editor" aria-label={t.editorLabel}>
      <Excalidraw key={editorKey}
        excalidrawAPI={value => {
          api.current = value;
          // Open each drawing fitted to the visible area (after layout has sized the canvas).
          requestAnimationFrame(() => requestAnimationFrame(() => { if (api.current === value) fit(value); }));
        }}
        // New shapes and text default to the hand-drawn style: sketchy lines and Virgil
        // (the face this build actually renders, so drawings look the same in Excalidraw).
        initialData={{ ...restore({ ...sceneOf(doc), appState: { ...doc.appState, currentItemFontFamily: 1, currentItemRoughness: 1 } } as unknown as Parameters<typeof restore>[0], null, null) }}
        langCode={locale} autoFocus={false} aiEnabled={false} theme={theme}
        onScrollChange={() => { if (Date.now() - lastFit.current > 500) viewportMoved.current = true; }}
        onLinkOpen={(_element, event) => event.preventDefault()}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false }, tools: { image: true } }}
        onChange={(elements, appState, files) => {
          try {
            const scene = sceneSchema.parse({ elements, appState, files });
            if (baseline.current) { baseline.current = false; draft.current = scene; return; }
            if (JSON.stringify(scene) !== JSON.stringify(draft.current)) {
              draft.current = scene; changed();
            }
          } catch (e) { conflict.current = true; setError(tRef.current.cannotAutosave(String(e))); }
        }}>
        <MainMenu>
          <MainMenu.Item icon={<IconDownload />} onSelect={download}>{t.export}</MainMenu.Item>
          {isLibrary && <MainMenu.Item icon={<IconCopy />} disabled={busy} onSelect={() => void action(async () => {
            await save();
            if (dirty.current || saving.current) throw new Error(t.saveBeforeCopy);
            const source = current.current!;
            load((await callTool<{ document: Drawing }>('create_drawing', { title: source.plugin.title.slice(0, 160 - t.copySuffix.length) + t.copySuffix, scene: sceneOf(source) })).document);
            setNotice(t.copyOpened);
          })}>{t.duplicate}</MainMenu.Item>}
          <MainMenu.Item icon={<IconRefresh />} disabled={busy} onSelect={() => void action(async () => {
            if (saving.current) throw new Error(t.waitForSave);
            if (dirty.current && !window.confirm(t.confirmReload)) return;
            load((await callTool<{ document: Drawing }>('read_drawing', { id: current.current!.plugin.id })).document);
          })}>{t.reload}</MainMenu.Item>
          <MainMenu.Item icon={<IconLanguage />} title={t.switchLanguageLabel} onSelect={toggleLocale}>{t.switchLanguage}</MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>
      </section>
    </> : isLibrary ? <>
      <header className="library-head" aria-label="Agentic Excalidraw">
        <h1>{t.library}</h1>
        {library && <span className="count">{query ? `${matches.length} / ${library.drawings.length}` : library.drawings.length}</span>}
        <button className="tool" lang={locale === 'en' ? 'zh-CN' : 'en'} title={t.switchLanguageLabel} onClick={toggleLocale}><IconLanguage />{t.switchLanguage}</button>
        <button className="tool icon-button" aria-label={t.refresh} title={t.refresh} disabled={!connected || busy || refreshing} onClick={() => void refreshLibrary()}><IconRefresh className={refreshing ? 'spin' : ''} /></button>
      </header>
      {messages}
      <section id="main-content" className="library" aria-label={t.library}>
        <div className="toolbar">
          <label className="search"><IconSearch />
            <input type="search" aria-label={t.searchLabel} placeholder={t.searchPlaceholder} value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} />
          </label>
          <div className="composer" role="group" aria-label={t.newDrawingGroup}>
            <input aria-label={t.newTitleLabel} placeholder={t.newTitleLabel} value={newTitle} maxLength={160} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.parentElement?.querySelector('button')?.click(); }} />
            <button type="button" className="primary" disabled={!connected || busy} onClick={() => void action(async () => {
              load((await callTool<{ document: Drawing }>('create_drawing', { title: newTitle.trim() || t.untitled })).document);
              setNewTitle(''); setNotice('');
            })}><IconPlus />{t.newDrawing}</button>
          </div>
        </div>
        {!library ? <p className="empty-state" role="status">{error ? t.libraryLoadFailed : connected ? t.libraryLoading : t.waitingHost}</p> : <>
          {library.warnings.length > 0 && <p className="banner error inline" role="alert">{t.unreadable(library.warnings.length)}</p>}
          <div className="drawing-grid" aria-busy={refreshing}>
            {matches.slice(0, limit).map(d => <button className="drawing" key={d.id} disabled={busy || refreshing} onClick={() => void action(async () => {
              load((await callTool<{ document: Drawing }>('read_drawing', { id: d.id })).document); setNotice('');
            })}><Preview summary={d} dark={theme === 'dark'} t={t} /><span className="drawing-info"><strong>{d.title}</strong><span className="meta">{relativeTime(d.updatedAt, locale, t)}</span></span></button>)}
          </div>
          {matches.length > limit && <button className="tool more" onClick={() => setLimit(value => value + 20)}>{t.showMore}</button>}
          {!library.drawings.length && <div className="empty-state"><span className="empty-icon"><IconCanvas /></span><strong>{t.emptyTitle}</strong><p>{t.emptyHint}</p></div>}
          {!!library.drawings.length && !matches.length && <div className="empty-state"><p>{t.noMatches}</p><button className="tool" onClick={() => setQuery('')}>{t.clearSearch}</button></div>}
        </>}
      </section>
    </> : <section id="main-content" className="card waiting" role="status">
      <span className="empty-icon"><IconCanvas /></span>
      <span>{connected ? t.waitingDrawing : t.connecting}</span>
    </section>}
  </main>;
}

/**
 * Text plus structured data describing the current view, for ui/update-model-context.
 * `key` identifies the view (not its contents) so a removed attachment stays removed until it changes.
 * `openai/title` labels the composer attachment on OpenAI hosts; other hosts ignore it.
 */
function describeView(t: Messages, isLibrary: boolean, doc: Drawing | null, library: Library | null, query: string) {
  const block = (title: string, text: string) => ({ type: 'text' as const, text, _meta: { 'openai/title': title } });
  const drawing = (d: DrawingSummary) => ({ id: d.id, title: d.title, revision: d.revision, updatedAt: d.updatedAt });
  if (doc) {
    const view = 'editor';
    const text = `The user has the Agentic Excalidraw drawing "${doc.plugin.title}" open in the editor `
      + `(id ${doc.plugin.id}, revision ${doc.plugin.revision}, ${doc.elements.filter(e => !e.isDeleted).length} elements). `
      + 'Call read_drawing with this id for its latest content before describing or changing it; use patch_drawing with the latest revision to edit.'
      + ' The editor autosaves about every 1.2 seconds.';
    return { key: `${view}:${doc.plugin.id}`, params: {
      content: [block(`Agentic Excalidraw · ${doc.plugin.title}`, text)],
      structuredContent: { app: 'local-excalidraw', view, drawing: drawing(doc.plugin) },
    } };
  }
  if (!isLibrary || !library) return null;
  const needle = query.toLocaleLowerCase();
  const shown = library.drawings.filter(d => d.title.toLocaleLowerCase().includes(needle));
  const listed = shown.slice(0, 50);
  const text = [
    `The user is viewing the Agentic Excalidraw drawing library: ${library.drawings.length} drawing(s)`
      + (query ? `, filtered by "${query}" to ${shown.length}` : '') + ', most recently updated first.',
    ...listed.map(d => `- "${d.title}" (id ${d.id}, revision ${d.revision}, updated ${d.updatedAt})`),
    ...(shown.length > listed.length ? [`- …and ${shown.length - listed.length} more; call list_drawings for all.`] : []),
    'Call read_drawing with an id to see a drawing\'s content.',
  ].join('\n');
  return { key: `library:${query}`, params: {
    content: [block(t.libraryContextTitle(`${query ? `${shown.length}/` : ''}${library.drawings.length}`), text)],
    structuredContent: { app: 'local-excalidraw', view: 'library', query, total: library.drawings.length, drawings: listed.map(drawing) },
  } };
}

function librarySignature(library: Library) {
  return JSON.stringify([library.warnings.length, library.drawings.map(d => [d.id, d.revision, d.title])]);
}

/** Fit the whole drawing into view, leaving a margin; never zoom small drawings past 100%. */
function fitContent(editor: ExcalidrawImperativeAPI) {
  if (!editor.getSceneElements().length) return;
  editor.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.9, maxZoom: 1 });
}

/** A host-fixed height (sidebar, fullscreen) means the editor should fit it, not grow past it. */
function applyFill() {
  const context = bridge.getHostContext();
  const fixed = !!context?.containerDimensions && 'height' in context.containerDimensions || context?.displayMode === 'fullscreen';
  document.documentElement.toggleAttribute('data-fill', fixed);
}

function relativeTime(iso: string, locale: Locale, t: Messages) {
  const relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return t.justNow;
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, 'minute');
  if (Math.abs(minutes) < 24 * 60) return relativeFormat.format(Math.round(minutes / 60), 'hour');
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
