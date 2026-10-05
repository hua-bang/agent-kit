import { describe, expect, it } from 'vitest';
import { parseMermaidToExcalidraw } from '../src/app/mermaid-text-fallback';

describe('Mermaid-free clipboard compatibility', () => {
  it.each([
    'flowchart TD\n  A[开始] --> B[结束]',
    'sequenceDiagram\n  Alice->>Bob: Hello',
    'graph TD\n invalid syntax " <script>plain text</script>',
  ])('preserves source verbatim as editable text: %s', async source => {
    const result = await parseMermaidToExcalidraw(source);
    expect(result).toEqual({
      elements: [{ type: 'text', text: source, x: 0, y: 0, fontFamily: 2 }],
      files: {},
    });
  });
});
