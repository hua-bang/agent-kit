import { useEffect, useRef, useState } from 'react';
import { CaptureUpdateAction, Excalidraw, MainMenu, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import { applyDocumentTheme, type McpUiTheme } from '@modelcontextprotocol/ext-apps';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { bridge, callTool } from './bridge';
import { Preview } from './Preview';
import { IconBack, IconCanvas, IconCopy, IconDownload, IconPlus, IconRefresh, IconSearch } from './icons';
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
  // Excalidraw normalises a scene when it mounts; that first change is not a user edit.
  const baseline = useRef(true);
  const saving = useRef(false);
  const editCounter = useRef(0);
  const conflict = useRef(false);
  const [status, setStatus] = useState('连接宿主中');
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
    setDoc(next); setTitle(next.plugin.title); setError(''); setStatus('已保存');
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
      if (dirty.current || saving.current) { setError('收到新的图纸结果，当前有未保存修改。请先保存或导出，再重新打开目标图纸。'); return; }
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
      if (context.containerDimensions || context.displayMode) applyFill();
      // OpenAI hosts clear this when the user removes the context attachment.
      if ((context as Record<string, unknown>)['openai/modelContext'] === null) dismissedContext.current = sentContext.current;
    };
    bridge.connect().then(() => {
      if (!mounted.current) return;
      const hostTheme = bridge.getHostContext()?.theme;
      if (hostTheme) setTheme(hostTheme);
      applyFill();
      setConnected(true); setStatus('已连接');
      // A tool result may arrive with the handshake. Do not replace its document.
      if (isLibrary) void refreshLibrary();
    }).catch(e => { setError(`无法连接 MCP 宿主：${e.message}。请从支持 MCP Apps 的宿主打开此界面。`); setStatus('未连接'); });
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let previousWidth = window.innerWidth;
    let timer: ReturnType<typeof setTimeout>;
    const resize = () => {
      if (Math.abs(window.innerWidth - previousWidth) < 100) return;
      previousWidth = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(() => api.current?.scrollToContent(undefined, { fitToViewport: true }), 150);
    };
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); clearTimeout(timer); };
  }, []);
  async function refreshLibrary() {
    setRefreshing(true);
    try { const data = await callTool<Library>('list_drawings'); if (mounted.current) setLibrary(data); }
    catch (e) { if (mounted.current) setError(String(e)); }
    finally { if (mounted.current) setRefreshing(false); }
  }
  async function save() {
    if (!current.current || !draft.current || !dirty.current || saving.current || conflict.current) return;
    saving.current = true; setStatus('正在保存');
    const target = current.current;
    const generation = editCounter.current;
    try {
      const result = await callTool<{ document: Drawing }>('save_drawing', {
        id: target.plugin.id, expectedRevision: target.plugin.revision, scene: draft.current, title: title.trim() || target.plugin.title,
      });
      current.current = result.document;
      setDoc(result.document);
      dirty.current = generation !== editCounter.current;
      setStatus(dirty.current ? '有未保存修改' : '已保存');
      setError('');
    } catch (e) {
      conflict.current = true; // Stop retry storms. Keep the unsaved draft available for export.
      setStatus('保存暂停，修改仍在编辑器中'); setError(String(e));
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
      if (!current.current || dirty.current || saving.current || checking || conflict.current) return;
      checking = true;
      const id = current.current.plugin.id;
      try {
        const result = await callTool<{ document: Drawing }>('read_drawing', { id });
        if (current.current?.plugin.id === id && !dirty.current && !saving.current && result.document.plugin.revision > current.current.plugin.revision) load(result.document);
      } catch (e) { setError(`刷新失败：${String(e)}`); }
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
      const context = describeView(isLibrary, doc, library, query);
      if (!context || context.key === dismissedContext.current) return;
      dismissedContext.current = null;
      sentContext.current = context.key;
      void bridge.updateModelContext(context.params).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [connected, doc?.plugin.id, doc?.plugin.revision, doc?.plugin.title, library, query]);

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
  function changed() { dirty.current = true; editCounter.current++; setStatus('有未保存修改'); }

  async function leaveEditor() {
    await save();
    if (dirty.current || saving.current) throw new Error('请先保存修改，或导出草稿后重新载入。');
    api.current = null;
    setNotice(''); // Notices describe the editor session; do not carry them back to the list.
    current.current = null; setDoc(null); setLibrary(null); await refreshLibrary();
  }
  const matches = library?.drawings.filter(d => d.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? [];
  const tone = /暂停|未连接|失败/.test(status) ? 'error' : /正在保存|未保存/.test(status) ? 'pending' : /已保存/.test(status) ? 'ok' : 'idle';
  // Autosave makes "saved" the normal state: announce it to screen readers, show only the exceptions.
  const statusPill = <span className={`status tone-${tone}`} role="status" aria-live="polite">{tone === 'ok' ? <span className="sr-only">{status}</span> : <><i aria-hidden="true" />{status}</>}</span>;
  const messages = <>
    {error && <div className="banner error" role="alert"><span>{error}</span>{!doc && connected && isLibrary && <button className="tool" onClick={() => void refreshLibrary()}>重试</button>}</div>}
    {notice && <div className="banner notice" role="status">{notice}</div>}
  </>;
  // A drawing always opens in the editor: the library enters it from the list, a conversation card shows it directly.
  return <main className={`app ${isLibrary ? 'library-surface' : 'drawing-surface'} ${doc ? 'is-editing' : ''}`}>
    <a className="skip-link" href="#main-content">跳到图纸内容</a>
    {doc ? <>
      <header className="editor-bar">
        {isLibrary && <button className="ghost back" disabled={busy} onClick={() => void action(leaveEditor)}><IconBack />图纸列表</button>}
        <input aria-label="图纸名称" className="title" value={title} maxLength={160} onChange={e => { setTitle(e.target.value); changed(); }} />
        {statusPill}
        {/* Autosave covers the normal case; the button only appears while work is unsaved or paused. */}
        {(tone === 'pending' || tone === 'error') && <button className="tool save" disabled={busy} onClick={() => { conflict.current = false; void save(); }}>保存</button>}
      </header>
      {messages}
      <section id="main-content" className="editor" aria-label="Excalidraw 编辑器">
      <Excalidraw key={editorKey}
        excalidrawAPI={value => { api.current = value; }}
        initialData={{ ...restore({ ...sceneOf(doc), appState: { ...doc.appState, currentItemFontFamily: 2 } } as unknown as Parameters<typeof restore>[0], null, null), scrollToContent: true }}
        langCode="zh-CN" autoFocus={false} aiEnabled={false} theme={theme}
        onLinkOpen={(_element, event) => event.preventDefault()}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false }, tools: { image: true } }}
        onChange={(elements, appState, files) => {
          try {
            const scene = sceneSchema.parse({ elements, appState, files });
            if (baseline.current) { baseline.current = false; draft.current = scene; return; }
            if (JSON.stringify(scene) !== JSON.stringify(draft.current)) {
              draft.current = scene; changed();
            }
          } catch (e) { conflict.current = true; setError(`无法自动保存此场景，请导出草稿：${String(e)}`); }
        }}>
        <MainMenu>
          <MainMenu.Item icon={<IconDownload />} onSelect={download}>导出</MainMenu.Item>
          {isLibrary && <MainMenu.Item icon={<IconCopy />} disabled={busy} onSelect={() => void action(async () => {
            await save();
            if (dirty.current || saving.current) throw new Error('请先保存修改，再复制图纸。');
            const source = current.current!;
            load((await callTool<{ document: Drawing }>('create_drawing', { title: source.plugin.title.slice(0, 155) + ' 副本', scene: sceneOf(source) })).document);
            setNotice('已打开独立副本，原图保持不变。');
          })}>复制为新图</MainMenu.Item>}
          <MainMenu.Item icon={<IconRefresh />} disabled={busy} onSelect={() => void action(async () => {
            if (saving.current) throw new Error('请等待保存结束');
            if (dirty.current && !window.confirm('放弃尚未保存的修改，重新载入本地图纸？建议先导出草稿。')) return;
            load((await callTool<{ document: Drawing }>('read_drawing', { id: current.current!.plugin.id })).document);
          })}>重新载入</MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>
      </section>
    </> : isLibrary ? <>
      <header className="library-head">
        <h1>图纸库</h1>
        {library && <span className="count">{query ? `${matches.length} / ${library.drawings.length}` : library.drawings.length}</span>}
        <button className="tool icon-button" aria-label="刷新" title="刷新" disabled={!connected || busy || refreshing} onClick={() => void refreshLibrary()}><IconRefresh className={refreshing ? 'spin' : ''} /></button>
      </header>
      {messages}
      <section id="main-content" className="library" aria-label="图纸库">
        <div className="toolbar">
          <label className="search"><IconSearch />
            <input type="search" aria-label="搜索图纸" placeholder="搜索" value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} />
          </label>
          <div className="composer" role="group" aria-label="新建图纸">
            <input aria-label="新图纸名称" placeholder="新图纸名称" value={newTitle} maxLength={160} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.parentElement?.querySelector('button')?.click(); }} />
            <button type="button" className="primary" disabled={!connected || busy} onClick={() => void action(async () => {
              load((await callTool<{ document: Drawing }>('create_drawing', { title: newTitle.trim() || '未命名图纸' })).document);
              setNewTitle(''); setNotice('');
            })}><IconPlus />新建图纸</button>
          </div>
        </div>
        {!library ? <p className="empty-state" role="status">{error ? '无法读取图纸，请重试。' : connected ? '读取本地图纸中' : '等待 MCP 宿主连接'}</p> : <>
          {library.warnings.length > 0 && <p className="banner error inline" role="alert">{library.warnings.length} 个图纸文件无法读取，原文件未修改。</p>}
          <div className="drawing-grid" aria-busy={refreshing}>
            {matches.slice(0, limit).map(d => <button className="drawing" key={d.id} disabled={busy || refreshing} onClick={() => void action(async () => {
              load((await callTool<{ document: Drawing }>('read_drawing', { id: d.id })).document); setNotice('');
            })}><Preview summary={d} dark={theme === 'dark'} /><span className="drawing-info"><strong>{d.title}</strong><span className="meta">{relativeTime(d.updatedAt)}</span></span></button>)}
          </div>
          {matches.length > limit && <button className="tool more" onClick={() => setLimit(value => value + 20)}>显示更多图纸</button>}
          {!library.drawings.length && <div className="empty-state"><span className="empty-icon"><IconCanvas /></span><strong>从一张空白图纸开始</strong><p>新建图纸，或让 Agent 帮你画。</p></div>}
          {!!library.drawings.length && !matches.length && <div className="empty-state"><p>没有匹配的图纸。</p><button className="tool" onClick={() => setQuery('')}>清除搜索</button></div>}
        </>}
      </section>
    </> : <section id="main-content" className="card waiting" role="status">
      <span className="empty-icon"><IconCanvas /></span>
      <span>{connected ? '等待图纸，请让 Agent 打开或新建一张图。' : '连接 MCP 宿主中'}</span>
    </section>}
  </main>;
}

/**
 * Text plus structured data describing the current view, for ui/update-model-context.
 * `key` identifies the view (not its contents) so a removed attachment stays removed until it changes.
 * `openai/title` labels the composer attachment on OpenAI hosts; other hosts ignore it.
 */
function describeView(isLibrary: boolean, doc: Drawing | null, library: Library | null, query: string) {
  const block = (title: string, text: string) => ({ type: 'text' as const, text, _meta: { 'openai/title': title } });
  const drawing = (d: DrawingSummary) => ({ id: d.id, title: d.title, revision: d.revision, updatedAt: d.updatedAt });
  if (doc) {
    const view = 'editor';
    const text = `The user has the local Excalidraw drawing "${doc.plugin.title}" open in the editor `
      + `(id ${doc.plugin.id}, revision ${doc.plugin.revision}, ${doc.elements.filter(e => !e.isDeleted).length} elements). `
      + 'Call read_drawing with this id for its latest content before describing or changing it; use patch_drawing with the latest revision to edit.'
      + ' The editor autosaves about every 1.2 seconds.';
    return { key: `${view}:${doc.plugin.id}`, params: {
      content: [block(`Excalidraw · ${doc.plugin.title}`, text)],
      structuredContent: { app: 'local-excalidraw', view, drawing: drawing(doc.plugin) },
    } };
  }
  if (!isLibrary || !library) return null;
  const needle = query.toLocaleLowerCase();
  const shown = library.drawings.filter(d => d.title.toLocaleLowerCase().includes(needle));
  const listed = shown.slice(0, 50);
  const text = [
    `The user is viewing the local Excalidraw drawing library: ${library.drawings.length} drawing(s)`
      + (query ? `, filtered by "${query}" to ${shown.length}` : '') + ', most recently updated first.',
    ...listed.map(d => `- "${d.title}" (id ${d.id}, revision ${d.revision}, updated ${d.updatedAt})`),
    ...(shown.length > listed.length ? [`- …and ${shown.length - listed.length} more; call list_drawings for all.`] : []),
    'Call read_drawing with an id to see a drawing\'s content.',
  ].join('\n');
  return { key: `library:${query}`, params: {
    content: [block(`Excalidraw 图纸库 · ${query ? `${shown.length}/` : ''}${library.drawings.length} 张`, text)],
    structuredContent: { app: 'local-excalidraw', view: 'library', query, total: library.drawings.length, drawings: listed.map(drawing) },
  } };
}

/** A host-fixed height (sidebar, fullscreen) means the editor should fit it, not grow past it. */
function applyFill() {
  const context = bridge.getHostContext();
  const fixed = !!context?.containerDimensions && 'height' in context.containerDimensions || context?.displayMode === 'fullscreen';
  document.documentElement.toggleAttribute('data-fill', fixed);
}

const relativeFormat = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });
function relativeTime(iso: string) {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return '刚刚';
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, 'minute');
  if (Math.abs(minutes) < 24 * 60) return relativeFormat.format(Math.round(minutes / 60), 'hour');
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
