import { useEffect, useRef, useState } from 'react';
import type { Locale, Messages, PromptId } from '../ui/i18n';
import { IconChat, IconTemplate, templateIcons } from '../ui/icons';
import { TEMPLATE_IDS, templateName, type TemplateId } from '../../shared/templates';
import type { TemplateSummary } from '../../shared/schemas';

type Props = {
  t: Messages; locale: Locale;
  /** Nothing drawn yet: offer to plan with the AI instead of editing what is there. */
  empty: boolean;
  selected: number;
  /** The host accepts chat messages from the view (MCP Apps `message` capability). */
  canAsk: boolean;
  busy: boolean;
  templates: TemplateSummary[];
  onInsert(id: TemplateId): void;
  onInsertCustom(template: TemplateSummary): void;
  onAsk(prompt: PromptId): void;
  /** Ask the AI to draw a new template from a description. */
  onGenerate(description: string): void;
  /** Ask the AI to change this drawing as described. */
  onDescribe(text: string): void;
  onClose(): void;
};

/** Suggested next steps for this canvas: AI follow-ups that fit what is selected, and templates to insert. */
export function Ideas({ t, locale, empty, selected, canAsk, busy, templates, onInsert, onInsertCustom, onAsk, onGenerate, onDescribe, onClose }: Props) {
  const [description, setDescription] = useState('');
  // A blank canvas is a good moment to make a new template; a drawn one is about changing what is there.
  const generate = () => { if (description.trim()) (empty ? onGenerate : onDescribe)(description.trim()); };
  const inputLabel = empty ? t.generateTemplate : t.describeChange;
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
    {templates.length > 0 && <>
      <h2>{t.myTemplates}</h2>
      <div className="ideas-grid">
        {templates.map(template => <button key={template.id} type="button" className="tool" disabled={busy} title={template.description || template.name} onClick={() => onInsertCustom(template)}><IconTemplate />{template.name}</button>)}
      </div>
    </>}
    {canAsk && <>
      <h2>{inputLabel}</h2>
      <div className="ideas-generate">
        <input aria-label={inputLabel} placeholder={empty ? t.generatePlaceholder : t.describeChangePlaceholder} value={description} maxLength={500}
          onChange={e => setDescription(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) generate(); }} />
        <button type="button" className="primary" disabled={busy || !description.trim()} onClick={generate}>{t.generateSend}</button>
      </div>
    </>}
  </div>;
}
