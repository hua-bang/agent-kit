import { useCallback, useState, type ReactNode } from 'react';
import { CaptureUpdateAction, Excalidraw, MainMenu, WelcomeScreen, restore, serializeAsJSON, useHandleLibrary } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types';
import type { McpUiTheme } from '@modelcontextprotocol/ext-apps';
import { bridge, callTool, openExternal } from '../host/bridge';
import type { Locale, Messages, PromptId } from '../ui/i18n';
import { IconBack, IconChat, IconCopy, IconDownload, IconIdeas, IconLanguage, IconRefresh, IconSave, IconTemplate, templateIcons } from '../ui/icons';
import { TEMPLATE_IDS, relocateScene, templateName, templateScene, type TemplateId } from '../../shared/templates';
import { sceneSchema, sceneOf, type CustomTemplate, type Drawing, type Scene, type TemplateSummary } from '../../shared/schemas';
import type { useDrawing } from './useDrawing';
import { Ideas } from './Ideas';
import { boundsOf, contains, findFreeSpot } from './placement';
import type { NoticeKind } from '../App';

type Props = {
  drawing: ReturnType<typeof useDrawing>;
  doc: Drawing;
  /** The library can go back to its list and duplicate; a conversation card cannot. */
  isLibrary: boolean;
  t: Messages; locale: Locale; theme: McpUiTheme;
  busy: boolean;
  action(work: () => Promise<void>): void;
  onBack(): void;
  onNotice(message: string, kind?: NoticeKind): void;
  toggleLocale(): void;
  messages: ReactNode;
  /** The user's own templates, to insert like presets. */
  templates: TemplateSummary[];
  refreshTemplates(): Promise<void>;
};

export function Editor({ drawing, doc, isLibrary, t, locale, theme, busy, action, onBack, onNotice, toggleLocale, messages, templates, refreshTemplates }: Props) {
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
  // What the canvas holds, for suggestions that fit it. Updated only when it changes, not on every pointer move.
  const [empty, setEmpty] = useState(() => !doc.elements.some(e => !e.isDeleted));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const closeIdeas = useCallback(() => setIdeasOpen(false), []);
  const canAsk = !!bridge.getHostCapabilities()?.message;
  /**
   * Add a starter diagram where the user is looking, as one undoable step: centred in the visible
   * area when that is free, else in the nearest free spot. The view moves only if it lands out of sight.
   */
  function place(name: string, key: string, build: (at: { idPrefix: string; x: number; y: number }) => Scene) {
    const editor = api.current;
    if (!editor) return;
    setIdeasOpen(false);
    const existing = editor.getSceneElements();
    const idPrefix = `${key}-${Date.now().toString(36)}-`;
    const draft = build({ idPrefix, x: 0, y: 0 }).elements.map(boundsOf);
    const size = draft.length ? { width: Math.max(...draft.map(r => r.x + r.width)) - Math.min(...draft.map(r => r.x)), height: Math.max(...draft.map(r => r.y + r.height)) - Math.min(...draft.map(r => r.y)) } : { width: 0, height: 0 };
    const { scrollX, scrollY, zoom, width, height } = editor.getAppState();
    const view = { x: -scrollX, y: -scrollY, width: width / zoom.value, height: height / zoom.value };
    const at = findFreeSpot(existing.map(e => boundsOf(e as Parameters<typeof boundsOf>[0])), size, view);
    const scene = build({ idPrefix, ...at });
    editor.addFiles(Object.values(scene.files) as never);
    const added = restore({ elements: scene.elements } as unknown as Parameters<typeof restore>[0], null, null, { repairBindings: true }).elements;
    editor.updateScene({ elements: [...editor.getSceneElementsIncludingDeleted(), ...added], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
    if (!existing.length) editor.scrollToContent(added, { fitToViewport: true, viewportZoomFactor: 0.9, maxZoom: 1, animate: true });
    else if (!contains(view, { ...at, ...size })) {
      // Keep the zoom when the template fits the view; zoom out only as far as needed when it does not.
      const fits = size.width <= view.width && size.height <= view.height;
      editor.scrollToContent(added, fits ? { animate: true } : { fitToViewport: true, viewportZoomFactor: 0.9, maxZoom: zoom.value, animate: true });
    }
    // A blank, unnamed drawing takes the template's name.
    if (!existing.length && drawing.title === t.untitled) drawing.rename(name);
    onNotice(t.templateInserted(name));
  }
  const insertTemplate = (id: TemplateId) => place(templateName(id, locale), id, at => templateScene(id, { locale, ...at }));
  const insertCustom = (summary: TemplateSummary) => action(async () => {
    const { template } = await callTool<{ template: CustomTemplate }>('read_template', { id: summary.id });
    place(template.name, 'tpl', at => relocateScene(template.scene, at));
  });
  // Save this drawing as one of the user's templates, from an inline form (host sandboxes may block window.prompt).
  const [savingTemplate, setSavingTemplate] = useState<{ name: string; description: string; placeholders: boolean } | null>(null);
  const saveTemplate = () => action(async () => {
    const form = savingTemplate!;
    await drawing.save();
    if (drawing.unsaved || drawing.busySaving) throw new Error(t.waitForSave);
    const name = form.name.trim() || drawing.title.trim() || t.untitled;
    await callTool('save_template', { name, description: form.description.trim(), drawingId: drawing.current!.plugin.id, placeholders: form.placeholders, language: locale });
    setSavingTemplate(null);
    await refreshTemplates();
    onNotice(t.templateSaved(name));
  });
  /** Ask the AI to draw a template from a description, through the chat. */
  const generate = (description: string) => action(async () => {
    setIdeasOpen(false);
    const { isError } = await bridge.sendMessage({ role: 'user', content: [{ type: 'text', text: t.generatePrompt(description) }] });
    if (isError) onNotice(t.messageRejected, 'sticky'); else onNotice(t.generateSent, 'agent');
  });
  /** Post a follow-up about this drawing to the chat as the user, once the latest edits are saved for the agent to read. */
  function ask(prompt: PromptId | { change: string }) {
    setIdeasOpen(false);
    action(async () => {
      await drawing.save();
      const source = drawing.current!;
      const target = { title: drawing.title.trim() || source.plugin.title, id: source.plugin.id, ids: selectedIds };
      const text = typeof prompt === 'string' ? t.prompts[prompt].text(target) : t.changePrompt(target, prompt.change);
      const { isError } = await bridge.sendMessage({ role: 'user', content: [{ type: 'text', text }] });
      if (isError) onNotice(t.messageRejected, 'sticky'); else onNotice(t.messageSent, 'agent');
    });
  }
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
      <button type="button" className={`tool ideas-toggle ${ideasOpen ? 'is-open' : ''}`} aria-expanded={ideasOpen} aria-haspopup="dialog" title={t.ideasLabel} onClick={() => { if (!ideasOpen) void refreshTemplates(); setIdeasOpen(open => !open); }}><IconIdeas />{t.ideas}</button>
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
    {/* Not a <form>: sandboxed host frames without allow-forms drop submit events. */}
    {savingTemplate && <div className="banner notice template-form" role="group" aria-label={t.saveAsTemplate}
      onKeyDown={e => { if (e.key === 'Escape') setSavingTemplate(null); if (e.key === 'Enter' && !e.nativeEvent.isComposing && (e.target as HTMLElement).tagName === 'INPUT') saveTemplate(); }}>
      <strong>{t.saveAsTemplate}</strong>
      <label><span>{t.templateNameLabel}</span><input autoFocus value={savingTemplate.name} maxLength={160} onChange={e => setSavingTemplate({ ...savingTemplate, name: e.target.value })} /></label>
      <label><span>{t.templateDescLabel}</span><input value={savingTemplate.description} maxLength={500} placeholder={t.templateDescPlaceholder} onChange={e => setSavingTemplate({ ...savingTemplate, description: e.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={savingTemplate.placeholders} onChange={e => setSavingTemplate({ ...savingTemplate, placeholders: e.target.checked })} /><span>{t.templatePlaceholders}</span></label>
      <span className="resolve-actions">
        <button type="button" className="tool" onClick={() => setSavingTemplate(null)}>{t.cancel}</button>
        <button type="button" className="primary" disabled={busy || empty} onClick={saveTemplate}>{t.saveTemplate}</button>
      </span>
    </div>}
    {!stuck && messages}
    <section id="main-content" className={`editor ${viewport.fitting ? 'is-fitting' : ''}`} aria-label={t.editorLabel}>
    {ideasOpen && <Ideas t={t} locale={locale} empty={empty} selected={selectedIds.length} canAsk={canAsk} busy={busy}
      templates={templates} onInsert={insertTemplate} onInsertCustom={insertCustom} onAsk={ask} onGenerate={generate} onDescribe={change => ask({ change })} onClose={closeIdeas} />}
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
        void openExternal(element.link!).then(opened => { if (!opened) onNotice(t.linkUnavailable(element.link!), 'sticky'); });
      }}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false, toggleTheme: false }, tools: { image: true } }}
      onChange={(elements, appState, files) => {
        const isEmpty = !elements.some(e => !e.isDeleted);
        if (isEmpty !== empty) setEmpty(isEmpty);
        const selection = Object.keys(appState.selectedElementIds).filter(id => appState.selectedElementIds[id]);
        if (selection.join() !== selectedIds.join()) setSelectedIds(selection);
        try { drawing.edited(sceneSchema.parse({ elements, appState, files })); }
        catch (e) { drawing.stopSaving(t.cannotAutosave(String(e))); }
      }}>
      {/* Shown by Excalidraw only while the canvas is empty. */}
      <WelcomeScreen>
        <WelcomeScreen.Hints.MenuHint />
        <WelcomeScreen.Hints.ToolbarHint />
        <WelcomeScreen.Center>
          <WelcomeScreen.Center.Heading>{t.startFromTemplate}</WelcomeScreen.Center.Heading>
          <WelcomeScreen.Center.Menu>
            {TEMPLATE_IDS.map(id => { const Icon = templateIcons[id]; return <WelcomeScreen.Center.MenuItem key={id} icon={<Icon />} onSelect={() => insertTemplate(id)}>{templateName(id, locale)}</WelcomeScreen.Center.MenuItem>; })}
            {templates.slice(0, 3).map(template => <WelcomeScreen.Center.MenuItem key={template.id} icon={<IconTemplate />} onSelect={() => insertCustom(template)}>{template.name}</WelcomeScreen.Center.MenuItem>)}
            {canAsk && <WelcomeScreen.Center.MenuItem icon={<IconChat />} onSelect={() => ask('ideate')}>{t.prompts.ideate.label}</WelcomeScreen.Center.MenuItem>}
          </WelcomeScreen.Center.Menu>
        </WelcomeScreen.Center>
      </WelcomeScreen>
      <MainMenu>
        <MainMenu.Item icon={<IconDownload />} onSelect={() => void download()}>{t.export}</MainMenu.Item>
        {isLibrary && <MainMenu.Item icon={<IconCopy />} disabled={busy} onSelect={() => action(async () => {
          await drawing.save();
          if (drawing.unsaved || drawing.busySaving) throw new Error(t.saveBeforeCopy);
          const source = drawing.current!;
          drawing.load((await callTool<{ document: Drawing }>('create_drawing', { title: source.plugin.title.slice(0, 160 - t.copySuffix.length) + t.copySuffix, scene: sceneOf(source) })).document);
          onNotice(t.copyOpened);
        })}>{t.duplicate}</MainMenu.Item>}
        <MainMenu.Item icon={<IconSave />} disabled={busy || empty} onSelect={() => setSavingTemplate({ name: drawing.title.trim(), description: '', placeholders: false })}>{t.saveAsTemplate}</MainMenu.Item>
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
