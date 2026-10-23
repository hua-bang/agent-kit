import { describe, expect, it } from 'vitest';
import { sceneSchema } from '../src/shared/schemas';
import { TEMPLATE_IDS, templateName, templateScene } from '../src/shared/templates';

type Ref = { id: string; type: string };
type Binding = { elementId: string } | null;

describe('starter templates', () => {
  for (const id of TEMPLATE_IDS) for (const locale of ['zh-CN', 'en'] as const) {
    it(`${id} (${locale}) is a valid scene with two-way bindings`, () => {
      const scene = templateScene(id, { locale });
      expect(() => sceneSchema.parse(scene)).not.toThrow();
      expect(scene.elements.length).toBeGreaterThan(3);
      const byId = new Map(scene.elements.map(e => [e.id, e as Record<string, unknown>]));
      for (const element of byId.values()) {
        expect(element.roughness).toBe(1);
        if (element.type === 'text') {
          expect(element.fontFamily).toBe(1);
          expect(String(element.text).length).toBeGreaterThan(0);
        }
        // Labels sit in their containers, and containers list them back.
        const container = element.containerId as string | null | undefined;
        if (container) expect((byId.get(container)!.boundElements as Ref[]).some(ref => ref.id === element.id)).toBe(true);
        for (const binding of [element.startBinding, element.endBinding] as Binding[]) {
          if (!binding) continue;
          expect((byId.get(binding.elementId)!.boundElements as Ref[]).some(ref => ref.id === element.id && ref.type === 'arrow')).toBe(true);
        }
        for (const ref of (element.boundElements as Ref[] | null) ?? []) expect(byId.has(ref.id)).toBe(true);
      }
    });
  }

  it('prefixes IDs and offsets positions for inserting into an existing drawing', () => {
    const plain = templateScene('flowchart');
    const moved = templateScene('flowchart', { idPrefix: 'x1-', x: 500, y: -40 });
    expect(moved.elements.every(e => e.id.startsWith('x1-'))).toBe(true);
    const at = (x: number, y: number) => [Math.round(x * 10), Math.round(y * 10)];
    expect(moved.elements.map(e => at(e.x - 500, e.y + 40))).toEqual(plain.elements.map(e => at(e.x, e.y)));
    const arrow = moved.elements.find(e => e.type === 'arrow') as Record<string, { elementId: string }>;
    expect(arrow.startBinding.elementId.startsWith('x1-')).toBe(true);
  });

  it('localizes labels and names', () => {
    const texts = (locale: 'zh-CN' | 'en') => templateScene('kanban', { locale }).elements.filter(e => e.type === 'text').map(e => (e as Record<string, unknown>).text);
    expect(texts('zh-CN')).toContain('进行中');
    expect(texts('en')).toContain('Doing');
    expect(templateName('mindmap', 'zh-CN')).toBe('思维导图');
    expect(templateName('mindmap')).toBe('Mind map');
  });

  it('is deterministic', () => {
    expect(JSON.stringify(templateScene('architecture'))).toBe(JSON.stringify(templateScene('architecture')));
  });
});
