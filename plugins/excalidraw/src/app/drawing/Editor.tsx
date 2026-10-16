import { useState, type ReactNode } from 'react';
import { Excalidraw, MainMenu, restore, serializeAsJSON, useHandleLibrary } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types';
import type { McpUiTheme } from '@modelcontextprotocol/ext-apps';
import { bridge, callTool, openExternal } from '../host/bridge';
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
  // Excalidraw's personal library lives in the plugin data folder, so it survives reopening and is shared by every view.
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  useHandleLibrary({ excalidrawAPI, adapter: {
    load: async () => ({ libraryItems: (await callTool<{ libraryItems: LibraryItems }>('read_library')).libraryItems }),
    save: async ({ libraryItems }) => { await callTool('save_library', { libraryItems }); },
  } });
  // Unsaved edits that cannot be saved as they are (conflict, deleted drawing) or that a reload would drop.
  const [reloadAsked, setReloadAsked] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const stuck = status === 'paused' || (reloadAsked && drawing.unsaved);
  const resolve = (work: () => Promise<void>) => action(async () => { await work(); setReloadAsked(false); setConfirmingDiscard(false); });
  const tone = status === 'paused' || status === 'disconnected' ? 'error' : status === 'saving' || status === 'unsaved' ? 'pending' : status === 'saved' ? 'ok' : 'idle';
  async function download() {
    const source = drawing.current;
    if (!source) return;
    const content = api.current ? serializeAsJSON(api.current.getSceneElements(), api.current.getAppState(), api.current.getFiles(), 'local') : JSON.stringify(source);
    const name = source.plugin.title.replace(/[\\/:*?"<>|]/g, '_') + '.excalidraw';
    // Host sandboxes usually block iframe downloads silently, so ask the host to save the file when it can.
    if (bridge.getHostCapabilities()?.downloadFile) {
      try {
        const { isError } = await bridge.downloadFile({ contents: [{ type: 'resource', resource: { uri: `file:///${encodeURIComponent(name)}`, mimeType: 'application/json', text: content } }] });
        if (!isError) return; // isError also covers the user cancelling the host's own dialog.
        onNotice(t.exportNotStarted); return;
      } catch { /* Fall back to a direct download. */ }
    }
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' })); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    // A blocked download raises no error the page can see; say what to do if nothing happened.
    onNotice(t.exportFallback);
  }
  return <>
    <header className="editor-bar">
      {isLibrary && <button className="ghost back" disabled={busy} onClick={onBack}><IconBack />{t.backToList}</button>}
      <input aria-label={t.titleLabel} className="title" value={drawing.title} maxLength={160} onChange={e => drawing.rename(e.target.value)} onBlur={drawing.restoreTitle} />
      {/* Autosave makes "saved" the normal state: announce it to screen readers, show only the exceptions. */}
      <span className={`status tone-${tone}`} role="status" aria-live="polite">{tone === 'ok' ? <span className="sr-only">{t.status[status]}</span> : <><i aria-hidden="true" />{t.status[status]}</>}</span>
      {/* Autosave covers the normal case; the button only appears while work is unsaved or paused. */}
      {(tone === 'pending' || tone === 'error') && !stuck && <button className="tool save" disabled={busy} onClick={drawing.retry}>{t.save}</button>}
    </header>
    {stuck && <div className="banner error resolve" role="alert">
      <span>{status === 'paused' ? drawing.error || t.conflict : t.unsavedReload}</span>
      <span className="resolve-actions">
        <button type="button" className="tool" disabled={busy} onClick={() => resolve(drawing.saveAsCopy)}>{t.keepAsCopy}</button>
        {confirmingDiscard
          ? <><button type="button" className="danger" disabled={busy} autoFocus onClick={() => resolve(drawing.discard)}>{t.confirmDiscard}</button>
            <button type="button" className="tool" onClick={() => setConfirmingDiscard(false)}>{t.cancel}</button></>
          : <button type="button" className="tool" disabled={busy} onClick={() => setConfirmingDiscard(true)}>{t.discardMine}</button>}
      </span>
    </div>}
    {!stuck && messages}
    <section id="main-content" className={`editor ${viewport.fitting ? 'is-fitting' : ''}`} aria-label={t.editorLabel}>
    <Excalidraw key={viewport.editorKey}
      excalidrawAPI={value => { api.current = value; setExcalidrawAPI(value); viewport.mounted(value); }}
      // New shapes and text default to the hand-drawn style: sketchy lines and Virgil
      // (the face this build actually renders, so drawings look the same in Excalidraw).
      initialData={{ ...restore({ ...sceneOf(doc), appState: { ...doc.appState, currentItemFontFamily: 1, currentItemRoughness: 1 } } as unknown as Parameters<typeof restore>[0], null, null) }}
      langCode={locale} autoFocus={false} aiEnabled={false} theme={theme}
      onScrollChange={viewport.scrolled}
      onLinkOpen={(element, event) => {
        // The sandbox blocks new windows; external links go through the host. Element links (#…) stay inside Excalidraw.
        if (!/^https?:\/\//i.test(element.link ?? '')) return;
        event.preventDefault();
        void openExternal(element.link!).then(opened => { if (!opened) onNotice(t.linkUnavailable(element.link!)); });
      }}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false }, tools: { image: true } }}
      onChange={(elements, appState, files) => {
        try { drawing.edited(sceneSchema.parse({ elements, appState, files })); }
        catch (e) { drawing.stopSaving(t.cannotAutosave(String(e))); }
      }}>
      <MainMenu>
        <MainMenu.Item icon={<IconDownload />} onSelect={() => void download()}>{t.export}</MainMenu.Item>
        {isLibrary && <MainMenu.Item icon={<IconCopy />} disabled={busy} onSelect={() => action(async () => {
          await drawing.save();
          if (drawing.unsaved || drawing.busySaving) throw new Error(t.saveBeforeCopy);
          const source = drawing.current!;
          drawing.load((await callTool<{ document: Drawing }>('create_drawing', { title: source.plugin.title.slice(0, 160 - t.copySuffix.length) + t.copySuffix, scene: sceneOf(source) })).document);
          onNotice(t.copyOpened);
        })}>{t.duplicate}</MainMenu.Item>}
        <MainMenu.Item icon={<IconRefresh />} disabled={busy} onSelect={() => action(async () => {
          if (drawing.busySaving) throw new Error(t.waitForSave);
          // No window.confirm: host sandboxes often block it, which made reload silently do nothing.
          if (drawing.unsaved) { setReloadAsked(true); return; }
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
