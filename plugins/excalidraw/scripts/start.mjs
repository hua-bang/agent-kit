import { access } from 'node:fs/promises';

// Resolve against this package, never the host's working directory.
// No installation, network requests or builds occur during MCP startup.
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error('Local Excalidraw requires Node.js 22+ (Node 24 recommended).');
  process.exit(1);
}
try {
  await access(new URL('../dist/server/index.js', import.meta.url));
  await access(new URL('../dist/ui/index.html', import.meta.url));
  await import.meta.resolve('@modelcontextprotocol/sdk/server/mcp.js');
} catch {
  console.error('Local Excalidraw is not built or dependencies are missing. In the installed plugin directory, run npm ci && npm run build, then restart the host. Installation downloads dependencies and runs lifecycle scripts; startup never installs automatically.');
  process.exit(1);
}
await import('../dist/server/index.js');
