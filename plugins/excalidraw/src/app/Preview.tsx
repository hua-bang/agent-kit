import { useEffect, useRef, useState } from 'react';
import { exportToBlob, restore } from '@excalidraw/excalidraw';
import { callTool } from './bridge';
import { sceneOf, type Drawing, type DrawingSummary } from '../shared/schemas';

/** Rasterize with the real SDK; never inject drawing text as HTML or SVG. */
export function Preview({ document: doc, summary, dark = false }: { document?: Drawing; summary?: DrawingSummary; dark?: boolean }) {
  const container = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(!!doc);
  const [image, setImage] = useState('');
  const [state, setState] = useState('读取预览中');
  useEffect(() => {
    if (doc || !container.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [doc]);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let url = '';
    setImage(''); setState('读取预览中');
    void (async () => {
      const source = doc ?? (await callTool<{ document: Drawing }>('read_drawing', { id: summary!.id })).document;
      if (cancelled) return;
      if (!source.elements.some(element => !element.isDeleted)) { setState('空白图纸'); return; }
      const restored = restore(sceneOf(source) as unknown as Parameters<typeof restore>[0], null, null);
      // Default white paper is drawn by the card itself so it can follow the host theme.
      const background = String(source.appState.viewBackgroundColor ?? '#ffffff').toLowerCase();
      const exportBackground = !['#ffffff', '#fff', 'white', 'transparent'].includes(background);
      const blob = await exportToBlob({ ...restored, appState: { ...restored.appState, exportBackground, exportWithDarkMode: dark, exportEmbedScene: false }, maxWidthOrHeight: doc ? 1600 : 480, mimeType: 'image/png' });
      if (cancelled) return;
      url = URL.createObjectURL(blob); setImage(url);
    })().catch(() => { if (!cancelled) setState('预览不可用，可打开编辑'); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [visible, doc, dark, summary?.id, summary?.revision]);
  return <span className="scene-preview" ref={container}>
    {image ? <img src={image} alt={`${doc?.plugin.title ?? summary?.title}的图纸预览`} /> : <span className="preview-placeholder">{state}</span>}
  </span>;
}
