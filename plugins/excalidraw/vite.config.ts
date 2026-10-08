import { defineConfig, type Plugin } from 'vite';
import { withoutMermaidMenu } from './build/without-mermaid';
import { thirdPartyNotices } from './build/notices';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
// Only fonts whose redistribution terms were verified are shipped (see licenses/FONTS.md).
const clearedFamilies = new Set(['Assistant', 'ComicShanns', 'Lilita', 'Nunito', 'Virgil']);
// Families without verified terms are served by a cleared face instead. Xiaolai is
// also too large (12 MiB) for common stdio limits; CJK falls back to system fonts.
const substitutes: Record<string, string> = {
  Excalifont: 'Virgil/Virgil-Regular.woff2', // Excalifont's predecessor, same hand-drawn style
  Cascadia: 'ComicShanns/ComicShanns-Regular-279a7b317d12eb88de06167bd672b4b4.woff2', // Latin monospace subset
  Liberation: 'Assistant/Assistant-Regular.woff2',
  Xiaolai: 'Assistant/Assistant-Regular.woff2',
};
// Excalidraw's runtime font URLs are string literals, not imports. Inline them
// so a sandboxed MCP resource does not need an external font CDN.
function localFonts(): Plugin {
  return { name: 'excalidraw-local-fonts', enforce: 'pre', transform(code, id) {
    if (!id.includes('@excalidraw/excalidraw/dist/') || !id.endsWith('.js')) return;
    // One shared constant per font file, so a face substituted for many subsets is inlined once.
    const consts = new Map<string, string>();
    const transformed = code.replace(/(["'])\.\/fonts\/([^"'/]+)\/([^"']+\.woff2)\1/g, (_match, _quote, family: string, file: string) => {
      const source = substitutes[family] ?? `${family}/${file}`;
      if (!clearedFamilies.has(source.split('/')[0])) throw new Error(`Font family without verified license: ${family}`);
      const path = resolve(dirname(id), 'fonts', source);
      if (!existsSync(path)) throw new Error('Missing editor font: ' + source);
      if (!consts.has(source)) consts.set(source, `__localFont${consts.size}`);
      return consts.get(source)!;
    });
    const header = [...consts].map(([source, name]) =>
      `const ${name}="data:font/woff2;base64,${readFileSync(resolve(dirname(id), 'fonts', source)).toString('base64')}";\n`).join('');
    return header + transformed;
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
  resolve: { alias: [{ find: /^@excalidraw\/mermaid-to-excalidraw$/, replacement: resolve(import.meta.dirname, 'src/app/ui/mermaid-text-fallback.ts') }] },
  plugins: [withoutMermaidMenu(), localFonts(), react(), viteSingleFile(), lightweightBudget(), thirdPartyNotices()],
  build: { outDir: 'dist/ui', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
