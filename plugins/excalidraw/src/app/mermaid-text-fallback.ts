/**
 * Build-time replacement for the optional Mermaid converter, not a parser.
 * Excalidraw 0.18.1 calls this API when pasted text resembles Mermaid, even
 * with aiEnabled=false. Preserve that text as one editable text element.
 * Keep this boundary covered when upgrading the pinned editor dependency.
 */
export async function parseMermaidToExcalidraw(definition: string) {
  return {
    elements: [{ type: 'text' as const, text: definition, x: 0, y: 0, fontFamily: 1 }],
    files: {},
  };
}
