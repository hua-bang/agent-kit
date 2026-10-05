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
} catch {
  // The server bundle includes its dependencies; only the build output is required.
  console.error('Local Excalidraw is not built. Install from the prebuilt release branch, or run npm ci && npm run build in the plugin directory, then restart the host. Startup never installs or builds automatically.');
  process.exit(1);
}
await import('../dist/server/index.js');
