import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logIncoming } from './debug.js';
const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
logIncoming(transport);
// stdout is exclusively reserved for MCP JSON-RPC.
