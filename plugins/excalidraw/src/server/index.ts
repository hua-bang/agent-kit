import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
const server = createServer();
await server.connect(new StdioServerTransport());
// stdout is exclusively reserved for MCP JSON-RPC.
