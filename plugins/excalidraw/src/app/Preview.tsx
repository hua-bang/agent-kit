import { useEffect, useRef, useState } from 'react';
import { exportToBlob, restore } from '@excalidraw/excalidraw';
import { callTool } from './bridge';
import { sceneOf, type Drawing, type DrawingSummary } from '../shared/schemas';

/** Library thumbnail, rasterized with the real SDK; never inject drawing text as HTML or SVG. */
export function Preview({ summary, dark = false }: { summary: DrawingSummary; dark?: boolean }) {
  const container = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [image, setImage] = useState('');
  const [state, setState] = useState('读取预览中');
  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setImage(''); setState('读取预览中');
    void (async () => {
      const source = (await callTool<{ document: Drawing }>('read_drawing', { id: summary.id })).document;
      if (cancelled) return;
      if (!source.elements.some(element => !element.isDeleted)) { setState('空白图纸'); return; }
      const restored = restore(sceneOf(source) as unknown as Parameters<typeof restore>[0], null, null);
      // Default white paper is drawn by the card itself so it can follow the host theme.
      const background = String(source.appState.viewBackgroundColor ?? '#ffffff').toLowerCase();
      const exportBackground = !['#ffffff', '#fff', 'white', 'transparent'].includes(background);
      const blob = await exportToBlob({ ...restored, appState: { ...restored.appState, exportBackground, exportWithDarkMode: dark, exportEmbedScene: false }, maxWidthOrHeight: 480, mimeType: 'image/png' });
      // Host CSPs commonly allow data: images but not blob:, so inline the PNG.
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (!cancelled) setImage(url);
    })().catch(() => { if (!cancelled) setState('预览不可用，可打开编辑'); });
    return () => { cancelled = true; };
  }, [visible, dark, summary.id, summary.revision]);
  return <span className="scene-preview" ref={container}>
    {image ? <img src={image} alt={`${summary.title}的图纸预览`} /> : <span className="preview-placeholder">{state}</span>}
  </span>;
}
