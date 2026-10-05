// Minimal stroke icons drawn locally; no icon font or CDN request.
import type { ReactNode } from 'react';
type Props = { className?: string };
const svg = (path: ReactNode) => ({ className }: Props) =>
  <svg className={`icon ${className ?? ''}`} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{path}</svg>;

export const IconBack = svg(<path d="M15 18l-6-6 6-6" />);
export const IconPlus = svg(<path d="M12 5v14M5 12h14" />);
export const IconSearch = svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const IconRefresh = svg(<><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 20v-4h-4" /></>);
export const IconCanvas = svg(<><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 15c2-4 4-4 5-1s3 3 5-2" /></>);
