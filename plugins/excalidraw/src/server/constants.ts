export const UI_URI = 'ui://excalidraw/editor.html';
export const LIBRARY_URI = 'ui://excalidraw/library.html';
// The library as a conversation side panel: same page, plus a "this conversation" group.
export const PANEL_URI = 'ui://excalidraw/panel.html';
// Each drawing is also a readable resource, so @-mentions and resource links resolve to its content.
export const drawingUri = (id: string) => `excalidraw://drawings/${id}`;
export const DRAWING_MIME = 'application/vnd.excalidraw+json';
// Sidebar icon per the OpenAI entrypoint guidelines: monochrome SVG, currentColor,
// 20x20 viewport, 1.33px strokes. Served as the server icon, which hosts use for
// entrypoints when a tool has no icon of its own.
export const SIDEBAR_ICON = {
  src: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"><rect x="2.67" y="3.33" width="14.67" height="13.33" rx="2.67"/><path d="M5.33 12.67c1.6-3.6 3.2-4.4 4-2.8s1.8 2.8 2.8 1.1 1.2-3.4 2.53-4.3"/></svg>').toString('base64'),
  mimeType: 'image/svg+xml',
  sizes: ['any'],
};
export const readonly = { readOnlyHint: true, openWorldHint: false };
export const writable = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
