import type { ReactNode } from 'react';
import { Excalidraw, MainMenu, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import type { McpUiTheme } from '@modelcontextprotocol/ext-apps';
import { callTool } from '../host/bridge';
import type { Locale, Messages } from '../ui/i18n';
import { IconBack, IconCopy, IconDownload, IconLanguage, IconRefresh } from '../ui/icons';
import { sceneSchema, sceneOf, type Drawing } from '../../shared/schemas';
import type { useDrawing } from './useDrawing';

type Props = {
  drawing: ReturnType<typeof useDrawing>;
  doc: Drawing;
  /** The library can go back to its list and duplicate; a conversation card cannot. */
  isLibrary: boolean;
  t: Messages; locale: Locale; theme: McpUiTheme;
  busy: boolean;
  action(work: () => Promise<void>): void;
  onBack(): void;
  onNotice(message: string): void;
  toggleLocale(): void;
  messages: ReactNode;
};

export function Editor({ drawing, doc, isLibrary, t, locale, theme, busy, action, onBack, onNotice, toggleLocale, messages }: Props) {
  const { status, viewport, api } = drawing;
  const tone = status === 'paused' || status === 'disconnected' ? 'error' : status === 'saving' || status === 'unsaved' ? 'pending' : status === 'saved' ? 'ok' : 'idle';
  function download() {
    const source = drawing.current;
    if (!source) return;
    const content = api.current ? serializeAsJSON(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles(), 'local') : JSON.stringify(source);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = source.plugin.title.replace(/[\\/:*?"<>|]/g, '_') + '.excalidraw'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <header className="editor-bar">
      {isLibrary && <button className="ghost back" disabled={busy} onClick={onBack}><IconBack />{t.backToList}</button>}
      <input aria-label={t.titleLabel} className="title" value={drawing.title} maxLength={160} onChange={e => drawing.rename(e.target.value)} />
      {/* Autosave makes "saved" the normal state: announce it to screen readers, show only the exceptions. */}
      <span className={`status tone-${tone}`} role="status" aria-live="polite">{tone === 'ok' ? <span className="sr-only">{t.status[status]}</span> : <><i aria-hidden="true" />{t.status[status]}</>}</span>
      {/* Autosave covers the normal case; the button only appears while work is unsaved or paused. */}
      {(tone === 'pending' || tone === 'error') && <button className="tool save" disabled={busy} onClick={drawing.retry}>{t.save}</button>}
    </header>
    {messages}
    <section id="main-content" className={`editor ${viewport.fitting ? 'is-fitting' : ''}`} aria-label={t.editorLabel}>
    <Excalidraw key={viewport.editorKey}
      excalidrawAPI={value => { api.current = value; viewport.mounted(value); }}
      // New shapes and text default to the hand-drawn style: sketchy lines and Virgil
      // (the face this build actually renders, so drawings look the same in Excalidraw).
      initialData={{ ...restore({ ...sceneOf(doc), appState: { ...doc.appState, currentItemFontFamily: 1, currentItemRoughness: 1 } } as unknown as Parameters<typeof restore>[0], null, null) }}
      langCode={locale} autoFocus={false} aiEnabled={false} theme={theme}
      onScrollChange={viewport.scrolled}
      onLinkOpen={(_element, event) => event.preventDefault()}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false }, tools: { image: true } }}
      onChange={(elements, appState, files) => {
        try { drawing.edited(sceneSchema.parse({ elements, appState, files })); }
        catch (e) { drawing.stopSaving(t.cannotAutosave(String(e))); }
      }}>
      <MainMenu>
        <MainMenu.Item icon={<IconDownload />} onSelect={download}>{t.export}</MainMenu.Item>
        {isLibrary && <MainMenu.Item icon={<IconCopy />} disabled={busy} onSelect={() => action(async () => {
          await drawing.save();
          if (drawing.unsaved || drawing.busySaving) throw new Error(t.saveBeforeCopy);
          const source = drawing.current!;
          drawing.load((await callTool<{ document: Drawing }>('create_drawing', { title: source.plugin.title.slice(0, 160 - t.copySuffix.length) + t.copySuffix, scene: sceneOf(source) })).document);
          onNotice(t.copyOpened);
        })}>{t.duplicate}</MainMenu.Item>}
        <MainMenu.Item icon={<IconRefresh />} disabled={busy} onSelect={() => action(async () => {
          if (drawing.busySaving) throw new Error(t.waitForSave);
          if (drawing.unsaved && !window.confirm(t.confirmReload)) return;
          drawing.load((await callTool<{ document: Drawing }>('read_drawing', { id: drawing.current!.plugin.id })).document);
        })}>{t.reload}</MainMenu.Item>
        <MainMenu.Item icon={<IconLanguage />} title={t.switchLanguageLabel} onSelect={toggleLocale}>{t.switchLanguage}</MainMenu.Item>
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
    </Excalidraw>
    </section>
  </>;
}
