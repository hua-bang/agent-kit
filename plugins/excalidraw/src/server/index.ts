import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { appendFileSync } from 'node:fs';
const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
// Host probe: EXCALIDRAW_DEBUG_LOG=<file> appends each incoming request's method and _meta,
// to see what a host sends beyond the spec (e.g. any conversation identifier).
const debugLog = process.env.EXCALIDRAW_DEBUG_LOG;
if (debugLog) {
  const receive = transport.onmessage;
  transport.onmessage = message => {
    const params = 'params' in message ? message.params as Record<string, unknown> | undefined : undefined;
    try {
      appendFileSync(debugLog, JSON.stringify({ at: new Date().toISOString(), method: 'method' in message ? message.method : 'response',
        tool: params?.name, _meta: params?._meta,
        ...(params?.name === 'debug_host_context' ? { arguments: params.arguments } : {}) }) + '\n');
    } catch { /* never break the protocol for a probe */ }
    receive?.(message);
  };
}
// stdout is exclusively reserved for MCP JSON-RPC.
