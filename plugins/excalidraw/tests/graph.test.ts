import { describe, expect, it } from 'vitest';
import { sceneSchema, type Scene } from '../src/shared/schemas';
import { editScene, operationSchema, outlineScene, reconcileElements, type Operation } from '../src/shared/graph';
import { patchElements } from '../src/storage/drawings';
import { templateScene } from '../src/shared/templates';

type Loose = Record<string, any>;
const ops = (list: unknown[]) => list.map(op => operationSchema.parse(op)) as Operation[];
const byId = (elements: Scene['elements']) => new Map(elements.map(e => [e.id, e as Loose]));

/** Every link is two-way and every bound arrow end sits just outside its shape. */
function expectConsistent(elements: Scene['elements']) {
  expect(() => sceneSchema.parse({ elements, appState: {}, files: {} })).not.toThrow();
  const map = byId(elements);
  for (const e of map.values()) {
    if (e.containerId) expect(map.get(e.containerId)!.boundElements.some((ref: Loose) => ref.id === e.id)).toBe(true);
    for (const ref of e.boundElements ?? []) {
      const other = map.get(ref.id)!;
      expect(other).toBeDefined();
      if (ref.type === 'text') expect(other.containerId).toBe(e.id);
      else expect([other.startBinding?.elementId, other.endBinding?.elementId]).toContain(e.id);
    }
    if (e.type !== 'arrow') continue;
    const points = e.points.map(([x, y]: number[]) => [e.x + x, e.y + y]);
    for (const [binding, [px, py]] of [[e.startBinding, points[0]], [e.endBinding, points[points.length - 1]]] as const) {
      if (!binding) continue;
      const shape = map.get(binding.elementId)!;
      expect(shape.boundElements.some((ref: Loose) => ref.id === e.id && ref.type === 'arrow')).toBe(true);
      // Within the gap of the shape's box, not floating somewhere else.
      expect(px).toBeGreaterThanOrEqual(shape.x - 12); expect(px).toBeLessThanOrEqual(shape.x + shape.width + 12);
      expect(py).toBeGreaterThanOrEqual(shape.y - 12); expect(py).toBeLessThanOrEqual(shape.y + shape.height + 12);
    }
  }
}

describe('outline', () => {
  it('describes a diagram as nodes and connectors with labels', () => {
    const outline = outlineScene(templateScene('flowchart'));
    expect(outline.nodes.map(n => n.id)).toEqual(['start', 'step', 'check', 'fix', 'done']);
    expect(outline.nodes.find(n => n.id === 'check')).toMatchObject({ type: 'diamond', label: 'Passed?', color: 'yellow' });
    expect(outline.connectors).toContainEqual({ id: 'check-fix', from: 'check', to: 'fix', label: 'No' });
    expect(outline.texts).toEqual([]);
    expect(outline.issues).toEqual([]);
  });

  it('flags arrows that touch a shape without being bound, and free text over shapes', () => {
    const scene = sceneSchema.parse({ elements: [
      { id: 'a', type: 'rectangle', x: 0, y: 0, width: 100, height: 60 },
      { id: 'note', type: 'text', x: 20, y: 20, width: 40, height: 20, text: 'hi' },
      { id: 'loose', type: 'arrow', x: 104, y: 30, width: 200, height: 0, points: [[0, 0], [200, 0]] },
    ], appState: {}, files: {} });
    const outline = outlineScene(scene);
    expect(outline.connectors[0]).toMatchObject({ id: 'loose', from: [104, 30], to: [304, 30] });
    expect(outline.issues[0]).toMatch(/loose start touches a but is not bound/);
    expect(outline.texts[0]).toMatchObject({ id: 'note', over: 'a' });
  });
});

describe('edit operations', () => {
  const flow = () => templateScene('flowchart').elements;

  it('adds a node next to another and connects it with a labelled, bound arrow', () => {
    const next = editScene(flow(), ops([
      { op: 'add_node', id: 'audit', label: 'Write audit log', near: { id: 'done', side: 'right' }, color: 'violet' },
      { op: 'connect', from: 'done', to: 'audit', label: 'then' },
    ]));
    expectConsistent(next);
    const map = byId(next);
    const done = map.get('done')!, audit = map.get('audit')!;
    expect(audit.x).toBe(done.x + done.width + 80);
    expect(audit.y + audit.height / 2).toBeCloseTo(done.y + done.height / 2);
    expect(map.get('audit-label')).toMatchObject({ text: 'Write audit log', containerId: 'audit' });
    expect(outlineScene({ elements: next }).connectors).toContainEqual({ id: 'done-audit', from: 'done', to: 'audit', label: 'then' });
  });

  it('moves a node with its label and reroutes every attached arrow', () => {
    const before = byId(flow());
    const next = editScene(flow(), ops([{ op: 'move', ids: ['fix'], dx: 200, dy: 300 }]));
    expectConsistent(next);
    const map = byId(next);
    expect(map.get('fix')!.x).toBe(before.get('fix')!.x + 200);
    expect(map.get('fix-label')!.x).toBe(before.get('fix-label')!.x + 200);
    for (const arrow of ['check-fix', 'fix-step']) {
      expect(map.get(arrow)!.points).not.toEqual(before.get(arrow)!.points);
      expect(map.get(arrow)!.version).toBe(before.get(arrow)!.version + 1);
    }
    // The "No" label stays on its arrow's middle.
    const arrow = map.get('check-fix')!, label = map.get('check-fix-label')!;
    const [end] = arrow.points.slice(-1);
    expect(label.x + label.width / 2).toBeCloseTo(arrow.x + end[0] / 2, 0);
    // Untouched elements are untouched.
    expect(map.get('start')).toEqual(before.get('start'));
  });

  it('removes a node with its label and connectors, leaving no dangling references', () => {
    const next = editScene(flow(), ops([{ op: 'remove', ids: ['fix'] }]));
    expectConsistent(next);
    const ids = next.map(e => e.id);
    for (const gone of ['fix', 'fix-label', 'check-fix', 'check-fix-label', 'fix-step']) expect(ids).not.toContain(gone);
    expect(byId(next).get('step')!.boundElements.map((ref: Loose) => ref.id)).toEqual(['step-label', 'start-step', 'step-check']);
  });

  it('can keep connectors as free arrows when removing a node', () => {
    const next = editScene(flow(), ops([{ op: 'remove', ids: ['fix'], keepConnectors: true }]));
    expectConsistent(next);
    expect(byId(next).get('fix-step')).toMatchObject({ startBinding: null, endBinding: { elementId: 'step' } });
  });

  it('reconnects an arrow end and relabels, growing a node that is too small', () => {
    const next = editScene(flow(), ops([
      { op: 'reconnect', id: 'check-fix', to: 'start' },
      { op: 'label', id: 'step', text: 'Validate the incoming request payload' },
      { op: 'label', id: 'start-step', text: 'go' },
      { op: 'label', id: 'check-done', text: '' },
    ]));
    expectConsistent(next);
    const map = byId(next);
    expect(map.get('check-fix')!.endBinding.elementId).toBe('start');
    expect(map.get('fix')!.boundElements.map((ref: Loose) => ref.id)).toEqual(['fix-label', 'fix-step']);
    expect(map.get('step')!.width).toBeGreaterThanOrEqual(map.get('step-label')!.width + 24);
    expect(map.get('start-step-label')).toMatchObject({ text: 'go', containerId: 'start-step', fontSize: 16 });
    expect(map.has('check-done-label')).toBe(false);
  });

  it('updates fields and colours without touching links', () => {
    const next = editScene(flow(), ops([{ op: 'update', id: 'done', color: 'red', width: 260, style: { strokeStyle: 'dashed', id: 'hijack' } }]));
    expectConsistent(next);
    expect(byId(next).get('done')).toMatchObject({ id: 'done', strokeColor: '#e03131', backgroundColor: '#ffc9c9', strokeStyle: 'dashed', width: 260 });
  });

  it('names the failing operation', () => {
    expect(() => editScene(flow(), ops([{ op: 'label', id: 'step', text: 'x' }, { op: 'connect', from: 'step', to: 'nope' }])))
      .toThrow('operation 2 (connect): no element with id "nope"');
    expect(() => editScene(flow(), ops([{ op: 'add_node', id: 'step', x: 0, y: 0 }]))).toThrow(/already exists/);
    expect(() => editScene(flow(), ops([{ op: 'connect', from: 'step', to: 'check-fix' }]))).toThrow(/is a connector/);
  });

  it('keeps a large connected diagram consistent through many edits', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => ({ op: 'add_node', id: `n${i}`, label: `Node ${i}`, x: (i % 6) * 260, y: Math.floor(i / 6) * 180 }));
    const edges = Array.from({ length: 29 }, (_, i) => ({ op: 'connect', from: `n${i}`, to: `n${(i * 7 + 3) % 30}` }));
    let elements = editScene([], ops([...nodes, ...edges]));
    elements = editScene(elements, ops([{ op: 'move', ids: ['n0', 'n1', 'n2'], dy: 900 }, { op: 'remove', ids: ['n10'] }, { op: 'label', id: 'n5', text: 'Renamed' }]));
    expectConsistent(elements);
    expect(outlineScene({ elements }).issues).toEqual([]);
  });
});

describe('patch reconciliation', () => {
  const flow = () => templateScene('flowchart').elements;

  it('reroutes bound arrows when a patch moves a shape', () => {
    const elements = flow();
    const step = byId(elements).get('step')!;
    const next = reconcileElements(elements, patchElements(elements, [{ ...step, x: step.x - 300 } as Scene['elements'][number]], []));
    expectConsistent(next);
    expect(byId(next).get('step-label')!.x).toBe(byId(elements).get('step-label')!.x - 300);
  });

  it('removes labels of removed shapes and unbinds their arrows', () => {
    const elements = flow();
    const next = reconcileElements(elements, patchElements(elements, [], ['fix']));
    expectConsistent(next);
    const map = byId(next);
    expect(map.has('fix-label')).toBe(false);
    expect(map.get('check-fix')!.endBinding).toBeNull();
  });

  it('completes one-sided links an agent wrote', () => {
    const elements = flow();
    const next = reconcileElements(elements, patchElements(elements, [
      { id: 'note', type: 'rectangle', x: 600, y: 0, width: 120, height: 60 },
      { id: 'note-label', type: 'text', x: 0, y: 0, width: 40, height: 25, text: 'Note', containerId: 'note' },
      { id: 'note-link', type: 'arrow', x: 0, y: 0, width: 0, height: 0, points: [[0, 0], [0, 0]], startBinding: { elementId: 'fix', focus: 0, gap: 8 }, endBinding: { elementId: 'note', focus: 0, gap: 8 } },
    ] as Scene['elements'], []));
    expectConsistent(next);
    expect(byId(next).get('note-link')!.points[1][0]).toBeGreaterThan(0);
  });
});
