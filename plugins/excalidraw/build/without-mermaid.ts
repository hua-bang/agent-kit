import type { Plugin } from 'vite';

/**
 * Excalidraw 0.18.1 exposes no Mermaid-specific UI flag: aiEnabled=false
 * hides AI/command-palette actions but leaves this toolbar item visible.
 * Remove only that item and its now-empty section heading at build time.
 * Match stable semantic strings (not chunk hashes or minified identifiers),
 * require exactly one match, and fail closed on an upstream layout change.
 */
export function removeMermaidMenu(code: string): string {
  const item = /\b[\w$]+\(\s*[\w$]+\.Item,\s*\{\s*onSelect:\s*\(\)\s*=>\s*[\w$]+\.setOpenDialog\(\{\s*name:\s*"ttd",\s*tab:\s*"mermaid"\s*\}\),\s*icon:\s*[\w$]+,\s*"data-testid":\s*"toolbar-embeddable",\s*children:\s*[\w$]+\("toolBar\.mermaidToExcalidraw"\)\s*\}\s*\)/g;
  const heading = /\b[\w$]+\("div",\s*\{\s*style:\s*\{\s*margin:\s*"6px 0",\s*fontSize:\s*14,\s*fontWeight:\s*600\s*\},\s*children:\s*"Generate"\s*\}\)/g;
  for (const [label, pattern] of [['Mermaid menu', item], ['Generate heading', heading]] as const) {
    if ([...code.matchAll(pattern)].length !== 1) {
      throw new Error(`Excalidraw ${label} changed; review the Mermaid-free integration before upgrading`);
    }
    code = code.replace(pattern, 'null');
  }
  return code;
}

export function withoutMermaidMenu(): Plugin {
  return {
    name: 'excalidraw-without-mermaid-menu',
    enforce: 'pre',
    transform(code, id) {
      if (/\/@excalidraw\/excalidraw\/dist\/(dev|prod)\/index\.js$/.test(id.replaceAll('\\', '/'))) {
        return removeMermaidMenu(code);
      }
    },
  };
}
