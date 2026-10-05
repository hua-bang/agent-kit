import { useEffect, useRef, useState } from 'react';
import { Excalidraw, MainMenu, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { bridge, callTool } from './bridge';
import { Preview } from './Preview';
import { documentSchema, sceneSchema, sceneOf, type Drawing, type DrawingSummary, type Scene } from '../shared/schemas';

type Library = { drawings: DrawingSummary[]; warnings: string[] };
type Payload = { document?: Drawing; view?: string };
export function App() {
  // Entry surface is assigned by the resource, never inferred from a session or viewport.
  const isLibrary = document.querySelector('meta[name="excalidraw-surface"]')?.getAttribute('content') === 'library';
  const boundId = useRef<string | null>(null);
  const [editing, setEditing] = useState(isLibrary);
  const [limit, setLimit] = useState(20);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const expandButton = useRef<HTMLButtonElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const [connected, setConnected] = useState(false);
  const [doc, setDoc] = useState<Drawing | null>(null);
  const current = useRef<Drawing | null>(null);
  const draft = useRef<Scene | null>(null);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const dirty = useRef(false);
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

  function load(next: Drawing) {
    current.current = next; draft.current = sceneOf(next); dirty.current = false; conflict.current = false;
    editCounter.current++; api.current = null;
    setDoc(next); setTitle(next.plugin.title); setError(''); setStatus(`已保存 · r${next.plugin.revision}`);
    setEditorKey(k => k + 1);
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
    bridge.connect().then(() => {
      if (!mounted.current) return;
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
      setStatus(dirty.current ? '有未保存修改' : `已保存 · r${result.document.plugin.revision}`);
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
    if (isLibrary) {
      current.current = null; setDoc(null); setLibrary(null); await refreshLibrary();
    } else {
      setEditing(false);
      requestAnimationFrame(() => expandButton.current?.focus());
    }
  }
  function expand() {
    setEditing(true);
    requestAnimationFrame(() => titleInput.current?.focus());
  }
  const matches = library?.drawings.filter(d => d.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? [];
  return <main className={`app ${isLibrary ? 'library-surface' : 'drawing-surface'} ${doc && editing ? 'is-editing' : ''}`}>
    <a className="skip-link" href="#main-content">跳到图纸内容</a>
    <header className="app-header">
      {doc && editing ? <>
        <button className="back" disabled={busy} onClick={() => void action(leaveEditor)}>{isLibrary ? '图纸列表' : '返回预览'}</button>
        <input ref={titleInput} aria-label="图纸名称" className="title" value={title} maxLength={160} onChange={e => { setTitle(e.target.value); changed(); }} />
      </> : doc ? <div className="heading"><span className="eyebrow">Excalidraw</span><h1>{doc.plugin.title}</h1></div>
        : <div className="heading"><h1>Excalidraw</h1><span className="muted">{isLibrary ? '本地图纸' : '图纸预览'}</span></div>}
      {doc ? <span className="status" role="status" aria-live="polite">{status}</span>
        : isLibrary && <button disabled={!connected || busy || refreshing} onClick={() => void refreshLibrary()}>{refreshing ? '读取中' : '刷新'}</button>}
    </header>
    {error && <div className="error" role="alert">{error}{!doc && connected && isLibrary && <button onClick={() => void refreshLibrary()}>重试</button>}</div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {doc && editing ? <>
      <div className="editor-actions" aria-label="图纸操作">
        <button disabled={busy} onClick={() => { conflict.current = false; void save(); }}>保存</button>
        <button onClick={download}>导出</button>
        {isLibrary && <button disabled={busy} onClick={() => void action(async () => {
          await save();
          if (dirty.current || saving.current) throw new Error('请先保存修改，再复制图纸。');
          const source = current.current!;
          load((await callTool<{ document: Drawing }>('create_drawing', { title: source.plugin.title.slice(0, 155) + ' 副本', scene: sceneOf(source) })).document);
          setNotice('已打开独立副本，原图保持不变。');
        })}>复制为新图</button>}
        <button disabled={busy} onClick={() => void action(async () => {
          if (saving.current) throw new Error('请等待保存结束');
          if (dirty.current && !window.confirm('放弃尚未保存的修改，重新载入本地图纸？建议先导出草稿。')) return;
          load((await callTool<{ document: Drawing }>('read_drawing', { id: current.current!.plugin.id })).document);
        })}>重新载入</button>
      </div>
      <section id="main-content" className="editor" aria-label="Excalidraw 编辑器">
      <Excalidraw key={editorKey}
        excalidrawAPI={value => { api.current = value; }}
        initialData={{ ...restore({ ...sceneOf(doc), appState: { ...doc.appState, currentItemFontFamily: 2 } } as unknown as Parameters<typeof restore>[0], null, null), scrollToContent: true }}
        langCode="zh-CN" autoFocus={false} aiEnabled={false}
        onLinkOpen={(_element, event) => event.preventDefault()}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false }, tools: { image: true } }}
        onChange={(elements, appState, files) => {
          try {
            const scene = sceneSchema.parse({ elements, appState, files });
            if (JSON.stringify(scene) !== JSON.stringify(draft.current)) {
              draft.current = scene; changed();
            }
          } catch (e) { conflict.current = true; setError(`无法自动保存此场景，请导出草稿：${String(e)}`); }
        }}>
        <MainMenu><MainMenu.DefaultItems.ClearCanvas /><MainMenu.DefaultItems.ChangeCanvasBackground /></MainMenu>
      </Excalidraw>
      </section>
    </> : doc ? <section id="main-content" className="drawing-preview" aria-label="图纸预览">
      <button className="preview-open" onClick={expand} aria-label={`展开编辑 ${doc.plugin.title}`}><Preview document={doc} /></button>
      <div className="preview-actions"><span className="muted">可继续手动编辑</span><button ref={expandButton} className="primary" onClick={expand}>展开编辑</button></div>
    </section> : isLibrary ? <section id="main-content" className="library" aria-label="图纸库">
      <div className="create-row" role="group" aria-label="新建图纸">
        <input aria-label="新图纸名称" placeholder="新图纸名称" value={newTitle} maxLength={160} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.parentElement?.querySelector('button')?.click(); }} />
        <button type="button" className="primary" disabled={!connected || busy} onClick={() => void action(async () => {
          load((await callTool<{ document: Drawing }>('create_drawing', { title: newTitle.trim() || '未命名图纸' })).document);
          setNewTitle(''); setNotice('');
        })}>新建图纸</button>
      </div>
      <input type="search" className="search" aria-label="搜索图纸" placeholder="搜索图纸" value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} />
      <div className="list-caption"><span>{query ? '搜索结果' : '最近修改'}</span><span>{library ? `${matches.length} 张` : '读取中'}</span></div>
      {!library ? <p className="empty-state" role="status">{error ? '无法读取图纸，请重试。' : connected ? '读取本地图纸中' : '等待 MCP 宿主连接'}</p> : <>
        {library.warnings.length > 0 && <p role="alert">{library.warnings.length} 个图纸文件无法读取，原文件未修改。</p>}
        <div className="drawing-list" aria-busy={refreshing}>
          {matches.slice(0, limit).map(d => <button className="drawing" key={d.id} disabled={busy || refreshing} onClick={() => void action(async () => {
            load((await callTool<{ document: Drawing }>('read_drawing', { id: d.id })).document); setNotice('');
          })}><Preview summary={d} /><span className="drawing-info"><strong>{d.title}</strong><span>r{d.revision} · {new Date(d.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span></span><span className="row-arrow" aria-hidden="true">›</span></button>)}
        </div>
        {matches.length > limit && <button className="more" onClick={() => setLimit(value => value + 20)}>显示更多图纸</button>}
        {!library.drawings.length && <div className="empty-state"><strong>从一张空白图纸开始</strong><p>新建图纸，或让 Agent 帮你画。</p></div>}
        {!!library.drawings.length && !matches.length && <div className="empty-state"><p>没有匹配的图纸。</p><button onClick={() => setQuery('')}>清除搜索</button></div>}
      </>}
    </section> : <section id="main-content" className="empty-state" role="status">{connected ? '等待图纸，请让 Agent 打开或新建一张图。' : '连接 MCP 宿主中'}</section>}
    {isLibrary && <footer>保存在本机<span>Excalidraw</span></footer>}
  </main>;
}
