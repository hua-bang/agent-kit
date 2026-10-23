import { useEffect, useRef } from 'react';
import type { Locale, Messages, PromptId } from '../ui/i18n';
import { IconChat, templateIcons } from '../ui/icons';
import { TEMPLATE_IDS, templateName, type TemplateId } from '../../shared/templates';

type Props = {
  t: Messages; locale: Locale;
  /** Nothing drawn yet: offer to plan with the AI instead of editing what is there. */
  empty: boolean;
  selected: number;
  /** The host accepts chat messages from the view (MCP Apps `message` capability). */
  canAsk: boolean;
  busy: boolean;
  onInsert(id: TemplateId): void;
  onAsk(prompt: PromptId): void;
  onClose(): void;
};

/** Suggested next steps for this canvas: AI follow-ups that fit what is selected, and templates to insert. */
export function Ideas({ t, locale, empty, selected, canAsk, busy, onInsert, onAsk, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Close on Escape or a press anywhere else, including the canvas; the toggle button handles itself.
    const press = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!panel.current?.contains(target) && !target?.closest?.('.ideas-toggle')) onClose();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', press, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', press, true); document.removeEventListener('keydown', key); };
  }, [onClose]);
  const prompts: PromptId[] = empty ? ['ideate'] : selected ? ['expand', 'rewrite', 'tidySelection'] : ['tidy', 'complete', 'explain', 'restyle'];
  return <div className="ideas-panel" ref={panel} role="dialog" aria-label={t.ideasLabel}>
    <h2>{selected && !empty ? t.askAiSelection(selected) : t.askAi}</h2>
    {canAsk
      ? <div className="ideas-list">{prompts.map(id => <button key={id} type="button" className="tool" disabled={busy} onClick={() => onAsk(id)}><IconChat />{t.prompts[id].label}</button>)}</div>
      : <p className="meta">{t.askAiUnavailable}</p>}
    <h2>{t.insertTemplate}</h2>
    <div className="ideas-grid">
      {TEMPLATE_IDS.map(id => { const Icon = templateIcons[id]; return <button key={id} type="button" className="tool" disabled={busy} onClick={() => onInsert(id)}><Icon />{templateName(id, locale)}</button>; })}
    </div>
  </div>;
}
