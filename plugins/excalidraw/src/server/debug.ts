import { appendFileSync } from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z } from 'zod';
import { config } from './config.js';
import { readonly } from './constants.js';

// Host probe, only with EXCALIDRAW_DEBUG_LOG: the app reports its host context here so it lands in the log.
export function registerDebugTool(server: McpServer) {
  if (!config.debugLog) return;
  server.registerTool('debug_host_context', {
    description: 'Debug only: records the app host context. Called by the app, not by the model.',
    inputSchema: { surface: z.string(), hostContext: z.unknown() }, annotations: readonly,
    _meta: { ui: { visibility: ['app'] } },
  }, () => ({ content: [] }));
}

// Appends each incoming request's method and _meta, to see what a host sends beyond the spec
// (e.g. any conversation identifier). Call after connect, which installs the server's handler.
export function logIncoming(transport: Transport) {
  const path = config.debugLog;
  if (!path) return;
  const receive = transport.onmessage;
  transport.onmessage = message => {
    const params = 'params' in message ? message.params as Record<string, unknown> | undefined : undefined;
    try {
      appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), method: 'method' in message ? message.method : 'response',
        tool: params?.name, _meta: params?._meta,
        ...(params?.name === 'debug_host_context' ? { arguments: params.arguments } : {}) }) + '\n');
    } catch { /* never break the protocol for a probe */ }
    receive?.(message);
  };
}
