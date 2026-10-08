// Runtime switches, read once from the MCP server process environment.
export const config = {
  // Sidebar (global) and conversation side panel (thread) entrypoints are on unless set to '0'.
  sidebar: process.env.EXCALIDRAW_ENABLE_SIDEBAR !== '0',
  thread: process.env.EXCALIDRAW_ENABLE_THREAD !== '0',
  // Host probe: a file path enables request logging and the debug_host_context tool.
  debugLog: process.env.EXCALIDRAW_DEBUG_LOG || '',
};
