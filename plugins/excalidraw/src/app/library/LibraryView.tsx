import { useState, type ReactNode } from 'react';
import type { McpUiTheme } from '@modelcontextprotocol/ext-apps';
import type { Locale, Messages } from '../ui/i18n';
import { IconCanvas, IconLanguage, IconPlus, IconRefresh, IconSearch, IconTrash, templateIcons } from '../ui/icons';
import { TEMPLATE_IDS, templateName, type TemplateId } from '../../shared/templates';
import type { DrawingSummary } from '../../shared/schemas';
import { Preview } from './Preview';
import type { Library } from './useLibrary';

type Props = {
  library: Library | null;
  /** Drawings opened in this panel, newest first. */
  session: string[];
  query: string; setQuery(query: string): void;
  t: Messages; locale: Locale; theme: McpUiTheme;
  connected: boolean; busy: boolean; refreshing: boolean; failed: boolean;
  onOpen(id: string): void;
  /** Create and open a drawing, blank or from a starter template; `created` runs only on success. */
  onCreate(title: string, created: () => void, template?: TemplateId): void;
  /** Delete a drawing after the user confirmed on its card. */
  onDelete(drawing: DrawingSummary): void;
  onRefresh(): void;
  toggleLocale(): void;
  messages: ReactNode;
};

export function LibraryView({ library, session, query, setQuery, t, locale, theme, connected, busy, refreshing, failed, onOpen, onCreate, onDelete, onRefresh, toggleLocale, messages }: Props) {
  const [limit, setLimit] = useState(20);
  const [newTitle, setNewTitle] = useState('');
  // The card awaiting delete confirmation. Inline, because sandboxed host frames may block window.confirm.
  const [confirming, setConfirming] = useState<string | null>(null);
  const matches = library?.drawings.filter(d => d.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? [];
  // Without a search, drawings opened in this panel come first; a search always shows one flat list.
  const pinned = query ? [] : session.flatMap(id => matches.filter(d => d.id === id));
  const others = matches.filter(d => !pinned.includes(d));
  const card = (d: DrawingSummary) => <div className="drawing-card" key={d.id}>
    <button className="drawing" disabled={busy || refreshing} onClick={() => onOpen(d.id)}>
      <Preview summary={d} dark={theme === 'dark'} t={t} />
      <span className="drawing-info"><strong>{d.title}</strong><span className="meta">{relativeTime(d.updatedAt, locale, t)}</span></span>
    </button>
    {confirming === d.id
      ? <div className="delete-confirm" role="group" aria-label={t.deleteLabel(d.title)} onKeyDown={e => { if (e.key === 'Escape') setConfirming(null); }}>
        <span>{t.deletePrompt}</span>
        <button type="button" className="tool" autoFocus onClick={() => setConfirming(null)}>{t.cancel}</button>
        <button type="button" className="danger" disabled={!connected || busy} onClick={() => { setConfirming(null); onDelete(d); }}>{t.delete}</button>
      </div>
      : <button type="button" className="tool icon-button card-delete" aria-label={t.deleteLabel(d.title)} title={t.delete} disabled={!connected || busy} onClick={() => setConfirming(d.id)}><IconTrash /></button>}
  </div>;
  return <>
    <header className="library-head" aria-label="Agentic Excalidraw">
      <h1>{t.library}</h1>
      {library && <span className="count">{query ? `${matches.length} / ${library.drawings.length}` : library.drawings.length}</span>}
      <button className="tool" lang={locale === 'en' ? 'zh-CN' : 'en'} title={t.switchLanguageLabel} onClick={toggleLocale}><IconLanguage />{t.switchLanguage}</button>
      <button className="tool icon-button" aria-label={t.refresh} title={t.refresh} disabled={!connected || busy || refreshing} onClick={onRefresh}><IconRefresh className={refreshing ? 'spin' : ''} /></button>
    </header>
    {messages}
    <section id="main-content" className="library" aria-label={t.library}>
      <div className="toolbar">
        <label className="search"><IconSearch />
          <input type="search" aria-label={t.searchLabel} placeholder={t.searchPlaceholder} value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} />
        </label>
        <div className="composer" role="group" aria-label={t.newDrawingGroup}>
          <input aria-label={t.newTitleLabel} placeholder={t.newTitleLabel} value={newTitle} maxLength={160} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.parentElement?.querySelector('button')?.click(); }} />
          <button type="button" className="primary" disabled={!connected || busy} onClick={() => onCreate(newTitle.trim() || t.untitled, () => setNewTitle(''))}><IconPlus />{t.newDrawing}</button>
        </div>
      </div>
      <div className="templates" role="group" aria-label={t.fromTemplate}>
        <span className="meta">{t.fromTemplate}</span>
        {TEMPLATE_IDS.map(id => { const Icon = templateIcons[id]; return <button key={id} type="button" className="tool" disabled={!connected || busy}
          onClick={() => onCreate(newTitle.trim() || templateName(id, locale), () => setNewTitle(''), id)}><Icon />{templateName(id, locale)}</button>; })}
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
        {!library.drawings.length && <div className="empty-state"><span className="empty-icon"><IconCanvas /></span><strong>{t.emptyTitle}</strong><p>{t.emptyHint}</p></div>}
        {!!library.drawings.length && !matches.length && <div className="empty-state"><p>{t.noMatches}</p><button className="tool" onClick={() => setQuery('')}>{t.clearSearch}</button></div>}
      </>}
    </section>
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
