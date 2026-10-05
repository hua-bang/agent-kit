// Minimal stroke icons drawn locally; no icon font or CDN request.
import type { ReactNode } from 'react';
type Props = { className?: string };
const svg = (path: ReactNode) => ({ className }: Props) =>
  <svg className={`icon ${className ?? ''}`} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{path}</svg>;

export const IconBack = svg(<path d="M15 18l-6-6 6-6" />);
export const IconPlus = svg(<path d="M12 5v14M5 12h14" />);
export const IconSearch = svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const IconRefresh = svg(<><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20v-4h-4" /></>);
export const IconPencil = svg(<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>);
export const IconSave = svg(<><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>);
export const IconDownload = svg(<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>);
export const IconCopy = svg(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>);
export const IconLock = svg(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
export const IconCanvas = svg(<><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 15c2-4 4-4 5-1s3 3 5-2" /></>);
