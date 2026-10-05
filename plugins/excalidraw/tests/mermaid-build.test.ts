import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { removeMermaidMenu } from '../build/without-mermaid';

describe('pinned editor Mermaid UI removal', () => {
  it.each(['dev', 'prod'])('removes only the disabled menu in %s', mode => {
    const source = readFileSync(new URL(`../node_modules/@excalidraw/excalidraw/dist/${mode}/index.js`, import.meta.url), 'utf8');
    const result = removeMermaidMenu(source);
    // The command palette retains its label but is gated by aiEnabled=false.
    const occurrences = (text: string) => text.split('toolBar.mermaidToExcalidraw').length - 1;
    expect(occurrences(result)).toBe(occurrences(source) - 1);
    expect(result).toContain('toolBar.embeddable');
    expect(result).toContain('toolBar.frame');
    expect(result).toContain('toolBar.laser');
  });
  it('fails closed when the upstream integration boundary changes', () => {
    expect(() => removeMermaidMenu('upstream changed')).toThrow('changed');
  });
});
