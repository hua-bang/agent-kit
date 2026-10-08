import { useEffect, useRef, useState } from 'react';
import { exportToBlob, restore } from '@excalidraw/excalidraw';
import { callTool } from '../host/bridge';
import type { Messages, PreviewState } from '../ui/i18n';
import { cachedThumbnail, thumbnail, thumbnailKey } from './thumbnails';
import { sceneOf, type Drawing, type DrawingSummary } from '../../shared/schemas';

/** Library thumbnail, rasterized with the real SDK; never inject drawing text as HTML or SVG. */
export function Preview({ summary, dark = false, t }: { summary: DrawingSummary; dark?: boolean; t: Messages }) {
  const container = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const key = thumbnailKey(summary.id, summary.revision, dark);
  const [image, setImage] = useState(() => cachedThumbnail(key) ?? '');
  const [state, setState] = useState<PreviewState>(() => cachedThumbnail(key) === '' ? 'empty' : 'loading');
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
    // A newer revision keeps showing the previous image until its own is ready.
    void thumbnail(key, async () => {
      const source = (await callTool<{ document: Drawing }>('read_drawing', { id: summary.id })).document;
      if (!source.elements.some(element => !element.isDeleted)) return '';
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
      return url;
    }, () => cancelled).then(url => {
      if (cancelled || url === null) return;
      setImage(url); setState(url ? 'loading' : 'empty');
    }).catch(() => { if (!cancelled) { setImage(''); setState('unavailable'); } });
    return () => { cancelled = true; };
  }, [visible, key]);
  return <span className="scene-preview" ref={container}>
    {image ? <img src={image} alt={t.previewAlt(summary.title)} /> : <span className="preview-placeholder">{t.preview[state]}</span>}
  </span>;
}
