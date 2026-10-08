import { useEffect, useRef, useState } from 'react';
import { CaptureUpdateAction, restore } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { callTool } from '../host/bridge';
import type { Messages, Status } from '../ui/i18n';
import { documentSchema, sceneSchema, sceneOf, type Drawing, type Scene } from '../../shared/schemas';
import { useViewport } from './viewport';

type Options = {
  connected: boolean;
  /** A conversation card binds to one drawing; the library may open any. */
  isLibrary: boolean;
  t: Messages;
  onLoaded?(id: string): void;
};

/**
 * One open drawing: load, autosave, conflict stop, and live agent updates.
 * The saved revision is the source of truth; local edits are a draft on top of it.
 */
export function useDrawing({ connected, isLibrary, t, onLoaded }: Options) {
  const tRef = useRef(t); tRef.current = t; // For callbacks registered once.
  const [doc, setDoc] = useState<Drawing | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState('');
  const boundId = useRef<string | null>(null);
  const current = useRef<Drawing | null>(null);
  const draft = useRef<Scene | null>(null);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const dirty = useRef(false);
  // Excalidraw normalises a scene when it mounts; that first change is not a user edit.
  const baseline = useRef(true);
  const saving = useRef(false);
  const editCounter = useRef(0);
  const conflict = useRef(false);
  const viewport = useViewport(api);

  function load(next: Drawing) {
    // A newer revision of the open drawing (agent edit, reload) replaces the scene in
    // place so zoom, scroll and the active tool stay put; only a different drawing remounts.
    const editor = current.current?.plugin.id === next.plugin.id ? api.current : null;
    current.current = next; draft.current = sceneOf(next); dirty.current = false; conflict.current = false;
    baseline.current = true;
    editCounter.current++;
    setDoc(next); setTitle(next.plugin.title); setError(''); setStatus('saved');
    onLoaded?.(next.plugin.id);
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
      viewport.remount();
    }
  }
  /** A drawing delivered by a tool result; ignored when stale, or for a card bound to another drawing. */
  function receive(document: unknown) {
    const next = documentSchema.parse(document);
    if (!isLibrary && boundId.current && boundId.current !== next.plugin.id) return;
    if (!isLibrary) boundId.current = next.plugin.id;
    if (current.current?.plugin.id === next.plugin.id && current.current.plugin.revision >= next.plugin.revision) return;
    if (dirty.current || saving.current) { setError(tRef.current.incomingWhileDirty); return; }
    load(next);
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
        const latest = (await callTool<{ drawings: Drawing['plugin'][] }>('list_drawings')).drawings.find(d => d.id === id);
        if (latest && latest.revision <= (current.current?.plugin.revision ?? Infinity)) return;
        const result = await callTool<{ document: Drawing }>('read_drawing', { id });
        if (fresh() && result.document.plugin.revision > current.current!.plugin.revision) load(result.document);
      } catch (e) { setError(tRef.current.refreshFailed(String(e))); }
      finally { checking = false; }
      // The metadata list is served from the server's cache, so a short interval keeps agent edits feeling live.
    }, 2000);
    return () => clearInterval(timer);
  }, [connected]);
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  function changed() { dirty.current = true; editCounter.current++; setStatus('unsaved'); }
  return {
    doc, title, status, error, setStatus, setError, viewport, api,
    load, receive, save, changed,
    rename(next: string) { setTitle(next); changed(); },
    /** Editor onChange: the first change after mounting is the baseline, not an edit. */
    edited(scene: Scene) {
      if (baseline.current) { baseline.current = false; draft.current = scene; return; }
      if (JSON.stringify(scene) !== JSON.stringify(draft.current)) { draft.current = scene; changed(); }
    },
    /** The scene cannot be autosaved (invalid data); stop saving but keep the editor open. */
    stopSaving(message: string) { conflict.current = true; setError(message); },
    /** Retry after a pause, e.g. once the user resolves a conflict by saving manually. */
    retry() { conflict.current = false; void save(); },
    /** Save, then close the editor. Throws while work is still unsaved. */
    async close() {
      await save();
      if (dirty.current || saving.current) throw new Error(t.saveBeforeLeaving);
      api.current = null;
      current.current = null; setDoc(null);
    },
    get current() { return current.current; },
    get busySaving() { return saving.current; },
    get unsaved() { return dirty.current; },
    /** Leaving the list for another view: only when nothing is pending. */
    get idle() { return !dirty.current && !saving.current; },
  };
}
