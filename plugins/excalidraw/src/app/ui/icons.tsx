// Minimal stroke icons drawn locally; no icon font or CDN request.
import type { ReactNode } from 'react';
type Props = { className?: string };
const svg = (path: ReactNode) => ({ className }: Props) =>
  <svg className={`icon ${className ?? ''}`} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{path}</svg>;

export const IconBack = svg(<path d="M15 18l-6-6 6-6" />);
export const IconPlus = svg(<path d="M12 5v14M5 12h14" />);
export const IconSearch = svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const IconRefresh = svg(<><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20v-4h-4" /></>);
export const IconDownload = svg(<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>);
export const IconCopy = svg(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>);
export const IconLanguage = svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" /></>);
export const IconCanvas = svg(<><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 15c2-4 4-4 5-1s3 3 5-2" /></>);
export const IconTrash = svg(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>);
export const IconIdeas = svg(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>);
export const IconChat = svg(<path d="M5 18l-1 3 4-2h9a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v9" />);
// One glyph per starter template.
export const templateIcons = {
  flowchart: svg(<><rect x="8" y="3" width="8" height="5" rx="1" /><rect x="8" y="16" width="8" height="5" rx="1" /><path d="M12 8v8" /></>),
  architecture: svg(<><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></>),
  mindmap: svg(<><circle cx="12" cy="12" r="3" /><path d="M9.5 10.5L5 6M14.5 10.5L19 6M9.5 13.5L5 18M14.5 13.5L19 18" /></>),
  sequence: svg(<><path d="M6 3v18M18 3v18" strokeDasharray="2 2" /><path d="M6 8h12M15 5l3 3-3 3M18 15H6M9 12l-3 3 3 3" /></>),
  kanban: svg(<><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="6" rx="1" /></>),
  matrix: svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 3v18M3 12h18" /></>),
};
