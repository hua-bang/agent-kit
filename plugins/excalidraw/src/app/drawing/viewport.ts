import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

/**
 * Fit each newly opened drawing, and refit on large resizes only until the user
 * pans or zooms (sidebar tabs are resized often; their view is theirs).
 */
export function useViewport(api: RefObject<ExcalidrawImperativeAPI | null>) {
  const lastFit = useRef(0);
  const moved = useRef(false);
  const [editorKey, setEditorKey] = useState(0);
  // A freshly mounted editor paints one frame at 100% before it is fitted; keep it hidden until then.
  const [fitting, setFitting] = useState(true);
  function fit(editor: ExcalidrawImperativeAPI, animate = false) {
    lastFit.current = Date.now(); moved.current = false;
    fitContent(editor, animate);
  }
  useEffect(() => {
    // Fallback: never leave the editor hidden if the fit callback does not arrive.
    const timer = setTimeout(() => setFitting(false), 1500);
    return () => clearTimeout(timer);
  }, [editorKey]);
  useEffect(() => {
    let previousWidth = window.innerWidth;
    let timer: ReturnType<typeof setTimeout>;
    const resize = () => {
      if (Math.abs(window.innerWidth - previousWidth) < 100) return;
      previousWidth = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(() => { if (api.current && !moved.current) fit(api.current, true); }, 150);
    };
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); clearTimeout(timer); };
  }, []);
  return {
    editorKey, fitting,
    /** Remount the editor for a different drawing; it stays hidden until fitted. */
    remount() { setFitting(true); setEditorKey(k => k + 1); },
    /** Open each drawing fitted to the visible area (after layout has sized the canvas). */
    mounted(editor: ExcalidrawImperativeAPI) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (api.current !== editor) return;
        fit(editor);
        requestAnimationFrame(() => { if (api.current === editor) setFitting(false); });
      }));
    },
    scrolled() { if (Date.now() - lastFit.current > 500) moved.current = true; },
  };
}

/** Fit the whole drawing into view, leaving a margin; never zoom small drawings past 100%. */
function fitContent(editor: ExcalidrawImperativeAPI, animate = false) {
  if (!editor.getSceneElements().length) return;
  editor.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.9, maxZoom: 1, animate, duration: 300 });
}
