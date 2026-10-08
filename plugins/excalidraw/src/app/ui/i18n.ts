// UI strings. A language the user picked wins, then the host's BCP 47 `locale`, then the browser language.
// Chinese tags get zh-CN, everything else English. Text sent to the model stays English.
export type Locale = 'zh-CN' | 'en';
export type Status = 'connecting' | 'connected' | 'disconnected' | 'saved' | 'saving' | 'unsaved' | 'paused';
export type PreviewState = 'loading' | 'empty' | 'unavailable';

const zh = {
  status: { connecting: '连接宿主中', connected: '已连接', disconnected: '未连接', saved: '已保存', saving: '正在保存', unsaved: '有未保存修改', paused: '保存暂停，修改仍在编辑器中' } satisfies Record<Status, string>,
  preview: { loading: '读取预览中', empty: '空白图纸', unavailable: '预览不可用，可打开编辑' } satisfies Record<PreviewState, string>,
  previewAlt: (title: string) => `${title}的图纸预览`,
  incomingWhileDirty: '收到新的图纸结果，当前有未保存修改。请先保存或导出，再重新打开目标图纸。',
  connectFailed: (message: string) => `无法连接 MCP 宿主：${message}。请从支持 MCP Apps 的宿主打开此界面。`,
  refreshFailed: (message: string) => `刷新失败：${message}`,
  saveBeforeLeaving: '请先保存修改，或导出草稿后重新载入。',
  saveBeforeCopy: '请先保存修改，再复制图纸。',
  waitForSave: '请等待保存结束',
  confirmReload: '放弃尚未保存的修改，重新载入本地图纸？建议先导出草稿。',
  cannotAutosave: (message: string) => `无法自动保存此场景，请导出草稿：${message}`,
  copySuffix: ' 副本',
  copyOpened: '已打开独立副本，原图保持不变。',
  untitled: '未命名图纸',
  retry: '重试',
  skipLink: '跳到图纸内容',
  backToList: '图纸列表',
  titleLabel: '图纸名称',
  save: '保存',
  editorLabel: 'Agentic Excalidraw 编辑器',
  export: '导出',
  duplicate: '复制为新图',
  reload: '重新载入',
  library: '图纸库',
  thisConversation: '本会话',
  recent: '最近',
  refresh: '刷新',
  searchLabel: '搜索图纸',
  searchPlaceholder: '搜索',
  newDrawingGroup: '新建图纸',
  newTitleLabel: '新图纸名称',
  newDrawing: '新建图纸',
  libraryLoadFailed: '无法读取图纸，请重试。',
  libraryLoading: '读取本地图纸中',
  waitingHost: '等待 MCP 宿主连接',
  unreadable: (count: number) => `${count} 个图纸文件无法读取，原文件未修改。`,
  showMore: '显示更多图纸',
  emptyTitle: '从一张空白图纸开始',
  emptyHint: '新建图纸，或让 Agent 帮你画。',
  noMatches: '没有匹配的图纸。',
  clearSearch: '清除搜索',
  waitingDrawing: '等待图纸，请让 Agent 打开或新建一张图。',
  connecting: '连接 MCP 宿主中',
  justNow: '刚刚',
  libraryContextTitle: (count: string) => `Agentic Excalidraw 图纸库 · ${count} 张`,
  switchLanguage: 'English',
  switchLanguageLabel: '切换到英文',
  toolFailed: '工具调用失败',
  noStructuredData: '工具没有返回结构化数据',
};

export type Messages = typeof zh;

const en: Messages = {
  status: { connecting: 'Connecting to host', connected: 'Connected', disconnected: 'Not connected', saved: 'Saved', saving: 'Saving', unsaved: 'Unsaved changes', paused: 'Saving paused; changes are still in the editor' },
  preview: { loading: 'Loading preview', empty: 'Blank drawing', unavailable: 'Preview unavailable; open to edit' },
  previewAlt: title => `Preview of ${title}`,
  incomingWhileDirty: 'A newer drawing arrived while you have unsaved changes. Save or export first, then reopen that drawing.',
  connectFailed: message => `Cannot connect to the MCP host: ${message}. Open this view from a host that supports MCP Apps.`,
  refreshFailed: message => `Refresh failed: ${message}`,
  saveBeforeLeaving: 'Save your changes first, or export the draft and reload.',
  saveBeforeCopy: 'Save your changes before duplicating.',
  waitForSave: 'Wait for saving to finish',
  confirmReload: 'Discard unsaved changes and reload the local drawing? Exporting the draft first is recommended.',
  cannotAutosave: message => `Cannot autosave this scene; please export the draft: ${message}`,
  copySuffix: ' copy',
  copyOpened: 'Opened an independent copy; the original is unchanged.',
  untitled: 'Untitled drawing',
  retry: 'Retry',
  skipLink: 'Skip to drawing',
  backToList: 'Drawings',
  titleLabel: 'Drawing title',
  save: 'Save',
  editorLabel: 'Agentic Excalidraw editor',
  export: 'Export',
  duplicate: 'Duplicate as new',
  reload: 'Reload',
  library: 'Drawings',
  thisConversation: 'This conversation',
  recent: 'Recent',
  refresh: 'Refresh',
  searchLabel: 'Search drawings',
  searchPlaceholder: 'Search',
  newDrawingGroup: 'New drawing',
  newTitleLabel: 'New drawing title',
  newDrawing: 'New drawing',
  libraryLoadFailed: 'Could not read drawings. Please retry.',
  libraryLoading: 'Loading local drawings',
  waitingHost: 'Waiting for the MCP host',
  unreadable: count => `${count} drawing file(s) could not be read; the files were left unchanged.`,
  showMore: 'Show more drawings',
  emptyTitle: 'Start with a blank drawing',
  emptyHint: 'Create a drawing, or ask the agent to draw one.',
  noMatches: 'No matching drawings.',
  clearSearch: 'Clear search',
  waitingDrawing: 'Waiting for a drawing. Ask the agent to open or create one.',
  connecting: 'Connecting to the MCP host',
  justNow: 'just now',
  libraryContextTitle: count => `Agentic Excalidraw drawings · ${count}`,
  switchLanguage: '中文',
  switchLanguageLabel: 'Switch to Chinese',
  toolFailed: 'Tool call failed',
  noStructuredData: 'The tool returned no structured data',
};

const messages: Record<Locale, Messages> = { 'zh-CN': zh, en };

export function pickLocale(tag?: string): Locale {
  return /^zh(-|$)/i.test(tag || navigator.language) ? 'zh-CN' : 'en';
}

// Remembered per browser profile. Sandboxed hosts may deny storage; the choice then lasts until the view closes.
const storageKey = 'agentic-excalidraw.locale';
export function storedLocale(): Locale | null {
  try { const value = localStorage.getItem(storageKey); return value === 'zh-CN' || value === 'en' ? value : null; }
  catch { return null; }
}
export function storeLocale(locale: Locale) {
  try { localStorage.setItem(storageKey, locale); } catch { /* Storage unavailable. */ }
}

export function messagesFor(locale: Locale): Messages {
  return messages[locale];
}
