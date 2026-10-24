import { useState, type ReactNode } from 'react';
import type { McpUiTheme } from '@modelcontextprotocol/ext-apps';
import type { Locale, Messages } from '../ui/i18n';
import { IconCanvas, IconChat, IconLanguage, IconPlus, IconRefresh, IconSearch, IconTrash } from '../ui/icons';
import { TEMPLATE_IDS, templateName, templateScene, type TemplateId } from '../../shared/templates';
import type { CustomTemplate, DrawingSummary, TemplateSummary } from '../../shared/schemas';
import { callTool } from '../host/bridge';
import { Preview, ScenePreview } from './Preview';
import type { Library } from './useLibrary';

type Props = {
  library: Library | null;
  /** Drawings opened in this panel, newest first. */
  session: string[];
  query: string; setQuery(query: string): void;
  t: Messages; locale: Locale; theme: McpUiTheme;
  connected: boolean; busy: boolean; refreshing: boolean; failed: boolean;
  onOpen(id: string): void;
  /** The user's own templates. */
  templates: TemplateSummary[];
  /** The host accepts chat messages from the view, so the AI can be asked to draw a template. */
  canAsk: boolean;
  /** Create and open a drawing, blank or from a preset or one of the user's templates; `created` runs only on success. */
  onCreate(title: string, created: () => void, template?: TemplateId | string): void;
  onDeleteTemplate(template: TemplateSummary): void;
  /** Ask the AI in the chat to draw a template from a description; `sent` runs only on success. */
  onGenerate(description: string, sent: () => void): void;
  /** Delete a drawing after the user confirmed on its card. */
  onDelete(drawing: DrawingSummary): void;
  onRefresh(): void;
  toggleLocale(): void;
  messages: ReactNode;
};

export function LibraryView({ library, session, query, setQuery, t, locale, theme, connected, busy, refreshing, failed, templates, canAsk, onOpen, onCreate, onDeleteTemplate, onGenerate, onDelete, onRefresh, toggleLocale, messages }: Props) {
  // Drawings and templates are separate tabs: templates get full cards without crowding the drawing list.
  const [tab, setTab] = useState<'drawings' | 'templates'>('drawings');
  const [description, setDescription] = useState('');
  const generate = () => { if (description.trim()) onGenerate(description.trim(), () => setDescription('')); };
  const [limit, setLimit] = useState(20);
  const [newTitle, setNewTitle] = useState('');
  // The card awaiting delete confirmation (a drawing or template id). Inline, because sandboxed host frames may block window.confirm.
  const [confirming, setConfirming] = useState<string | null>(null);
  const dark = theme === 'dark';
  const matches = library?.drawings.filter(d => d.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? [];
  // Without a search, drawings opened in this panel come first; a search always shows one flat list.
  const pinned = query ? [] : session.flatMap(id => matches.filter(d => d.id === id));
  const others = matches.filter(d => !pinned.includes(d));
  /** A card with a thumbnail, a title and a meta line, plus an optional delete corner with inline confirmation. */
  const cardShell = (key: string, title: string, meta: string, preview: ReactNode, open: () => void, remove?: { label: string; prompt: string; run(): void }) => <div className="drawing-card" key={key}>
    <button className="drawing" disabled={busy || refreshing} onClick={open}>
      {preview}
      <span className="drawing-info"><strong>{title}</strong>{meta && <span className="meta">{meta}</span>}</span>
    </button>
    {remove && (confirming === key
      ? <div className="delete-confirm" role="group" aria-label={remove.label} onKeyDown={e => { if (e.key === 'Escape') setConfirming(null); }}>
        <span>{remove.prompt}</span>
        <button type="button" className="tool" autoFocus onClick={() => setConfirming(null)}>{t.cancel}</button>
        <button type="button" className="danger" disabled={!connected || busy} onClick={() => { setConfirming(null); remove.run(); }}>{t.delete}</button>
      </div>
      : <button type="button" className="tool icon-button card-delete" aria-label={remove.label} title={t.delete} disabled={!connected || busy} onClick={() => setConfirming(key)}><IconTrash /></button>)}
  </div>;
  const card = (d: DrawingSummary) => cardShell(d.id, d.title, relativeTime(d.updatedAt, locale, t), <Preview summary={d} dark={dark} t={t} />,
    () => onOpen(d.id), { label: t.deleteLabel(d.title), prompt: t.deletePrompt, run: () => onDelete(d) });
  const presetCard = (id: TemplateId) => cardShell(`preset-${id}`, templateName(id, locale), t.presetHints[id],
    <ScenePreview cacheId={`preset-${id}-${locale}`} revision={1} dark={dark} t={t} alt={templateName(id, locale)} load={async () => templateScene(id, { locale })} />,
    () => onCreate(templateName(id, locale), () => {}, id));
  const templateCard = (template: TemplateSummary) => cardShell(template.id, template.name, template.description,
    <ScenePreview cacheId={template.id} revision={1} dark={dark} t={t} alt={template.name}
      load={async () => (await callTool<{ template: CustomTemplate }>('read_template', { id: template.id })).template.scene} />,
    () => onCreate(template.name, () => {}, template.id),
    { label: t.deleteTemplateLabel(template.name), prompt: t.deleteTemplatePrompt, run: () => onDeleteTemplate(template) });
  const tabButton = (value: typeof tab, label: string, count: number | undefined) => <button type="button" role="tab" id={`tab-${value}`} aria-controls="main-content"
    aria-selected={tab === value} className={tab === value ? 'is-active' : ''} onClick={() => { setTab(value); setConfirming(null); }}>
    {label}{count !== undefined && <span className="count">{tab === value && value === 'drawings' && query && library ? `${matches.length} / ${count}` : count}</span>}
  </button>;
  return <>
    <header className="library-head" aria-label="Agentic Excalidraw">
      <h1 className="sr-only">{t.library}</h1>
      <div className="view-tabs" role="tablist" aria-label={t.library}>
        {tabButton('drawings', t.drawingsTab, library?.drawings.length)}
        {tabButton('templates', t.templatesTab, TEMPLATE_IDS.length + templates.length)}
      </div>
      <button className="tool" lang={locale === 'en' ? 'zh-CN' : 'en'} title={t.switchLanguageLabel} onClick={toggleLocale}><IconLanguage />{t.switchLanguage}</button>
      <button className="tool icon-button" aria-label={t.refresh} title={t.refresh} disabled={!connected || busy || refreshing} onClick={onRefresh}><IconRefresh className={refreshing ? 'spin' : ''} /></button>
    </header>
    {messages}
    {tab === 'templates' ? <section id="main-content" className="library" role="tabpanel" aria-labelledby="tab-templates">
      {canAsk && <div className="toolbar generate-row" role="group" aria-label={t.generateTemplate}>
        <label className="search"><IconChat />
          <input aria-label={t.generateTemplate} placeholder={t.generatePlaceholder} value={description} maxLength={500}
            onChange={e => setDescription(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) generate(); }} />
        </label>
        <button type="button" className="primary" disabled={!connected || busy || !description.trim()} onClick={generate}>{t.generateSend}</button>
      </div>}
      <h2 className="group-title">{t.myTemplates}</h2>
      {templates.length
        ? <div className="drawing-grid">{templates.map(templateCard)}</div>
        : <p className="meta template-empty">{canAsk ? t.myTemplatesEmpty : t.myTemplatesEmptyNoAi}</p>}
      <h2 className="group-title">{t.presets}</h2>
      <div className="drawing-grid">{TEMPLATE_IDS.map(presetCard)}</div>
    </section>
    : <section id="main-content" className="library" role="tabpanel" aria-labelledby="tab-drawings">
      <div className="toolbar">
        <label className="search"><IconSearch />
          <input type="search" aria-label={t.searchLabel} placeholder={t.searchPlaceholder} value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} />
        </label>
        <div className="composer" role="group" aria-label={t.newDrawingGroup}>
          <input aria-label={t.newTitleLabel} placeholder={t.newTitleLabel} value={newTitle} maxLength={160} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.parentElement?.querySelector('button')?.click(); }} />
          <button type="button" className="primary" disabled={!connected || busy} onClick={() => onCreate(newTitle.trim() || t.untitled, () => setNewTitle(''))}><IconPlus />{t.newDrawing}</button>
        </div>
      </div>
      {!library ? <p className="empty-state" role="status">{failed ? t.libraryLoadFailed : connected ? t.libraryLoading : t.waitingHost}</p> : <>
        {library.warnings.length > 0 && <p className="banner error inline" role="alert">{t.unreadable(library.warnings.length)}</p>}
        {pinned.length > 0 && <>
          <h2 className="group-title">{t.thisConversation}</h2>
          <div className="drawing-grid" aria-busy={refreshing}>{pinned.map(card)}</div>
          <h2 className="group-title">{t.recent}</h2>
        </>}
        <div className="drawing-grid" aria-busy={refreshing}>
          {others.slice(0, limit).map(card)}
        </div>
        {others.length > limit && <button className="tool more" onClick={() => setLimit(value => value + 20)}>{t.showMore}</button>}
        {!library.drawings.length && <div className="empty-state"><span className="empty-icon"><IconCanvas /></span><strong>{t.emptyTitle}</strong><p>{t.emptyHint}</p>
          <button type="button" className="tool" onClick={() => setTab('templates')}>{t.browseTemplates}</button></div>}
        {!!library.drawings.length && !matches.length && <div className="empty-state"><p>{t.noMatches}</p><button className="tool" onClick={() => setQuery('')}>{t.clearSearch}</button></div>}
      </>}
    </section>}
  </>;
}

function relativeTime(iso: string, locale: Locale, t: Messages) {
  const relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return t.justNow;
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, 'minute');
  if (Math.abs(minutes) < 24 * 60) return relativeFormat.format(Math.round(minutes / 60), 'hour');
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
