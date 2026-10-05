import { defineConfig, type Plugin } from 'vite';
import { withoutMermaidMenu } from './build/without-mermaid';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
// Excalidraw's runtime font URLs are string literals, not imports. Inline them
// so a sandboxed MCP resource does not need an external font CDN.
function localFonts(): Plugin {
  return { name: 'excalidraw-local-fonts', enforce: 'pre', transform(code, id) {
    if (!id.includes('@excalidraw/excalidraw/dist/') || !id.endsWith('.js')) return;
    let needsFallback = false;
    const transformed = code.replace(/(["'])\.\/fonts\/([^"']+\.woff2)\1/g, (_match, quote, file) => {
      // The 12 MiB Xiaolai font alone exceeds common stdio message limits.
      // Use Liberation's Latin face, with system CJK fallback for missing glyphs.
      if (file.startsWith('Xiaolai/')) { needsFallback = true; return '__localCjkFallback'; }
      const path = resolve(dirname(id), 'fonts', file);
      if (!existsSync(path)) throw new Error('Missing editor font: ' + file);
      return quote + 'data:font/woff2;base64,' + readFileSync(path).toString('base64') + quote;
    });
    const fallback = needsFallback ? 'const __localCjkFallback="data:font/woff2;base64,' + readFileSync(resolve(dirname(id), 'fonts/Liberation/LiberationSans-Regular.woff2')).toString('base64') + '";\n' : '';
    return fallback + transformed;
  } };
}
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Fail the build if a dependency upgrade bypasses the converter replacement.
function lightweightBudget(): Plugin {
  return {
    name: 'excalidraw-lightweight-budget',
    enforce: 'post', // Run after viteSingleFile has inlined the JS/CSS assets.
    generateBundle(_options, bundle) {
      const forbidden = /\/node_modules\/(?:@excalidraw\/mermaid-to-excalidraw|@mermaid-js\/[^/]+|mermaid|cytoscape(?:-[^/]+)?|katex)\//;
      for (const id of this.getModuleIds()) {
        if (forbidden.test(id.replaceAll('\\', '/'))) this.error(`Unexpected Mermaid dependency: ${id}`);
      }
      for (const asset of Object.values(bundle)) {
        if (asset.type === 'asset' && asset.fileName === 'index.html') {
          const bytes = typeof asset.source === 'string' ? Buffer.byteLength(asset.source) : asset.source.byteLength;
          if (bytes > 5_700_000) this.error(`UI exceeds the 5.70 MB raw HTML budget: ${bytes} bytes`);
        }
      }
    },
  };
}
export default defineConfig({
  resolve: { alias: [{ find: /^@excalidraw\/mermaid-to-excalidraw$/, replacement: resolve(import.meta.dirname, 'src/app/mermaid-text-fallback.ts') }] },
  plugins: [withoutMermaidMenu(), localFonts(), react(), viteSingleFile(), lightweightBudget()],
  build: { outDir: 'dist/ui', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
