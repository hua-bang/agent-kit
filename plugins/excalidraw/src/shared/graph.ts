import { z } from 'zod';
import type { Scene } from './schemas.js';
import { GAP, TONES, TONE_NAMES, center, edgeToward, elementDefaults, measure, round, type Box, type Tone } from './elements.js';

/**
 * A drawing as a graph of nodes and connectors, for agents. Raw Excalidraw JSON spreads one
 * connection over three elements (an arrow's bindings and both shapes' boundElements) and
 * stores arrow geometry separately from the shapes, so edits by hand easily break a diagram.
 * `outlineScene` gives the compact view to read; `editScene` applies node-level operations
 * and `reconcileElements` keeps labels, bindings and arrow geometry consistent after any write.
 */

type El = Record<string, unknown> & { id: string; type: string; x: number; y: number; width: number; height: number };
type Point = [number, number];
type Ref = { id: string; type: string };
type Binding = { elementId: string; focus?: number; gap?: number } | null | undefined;

const LINEAR = new Set(['arrow', 'line']);
const isLinear = (e: El) => LINEAR.has(e.type);
const isLive = (e: El) => !e.isDeleted;
const r = (value: number) => Math.round(value);
const bindingOf = (value: unknown) => (value && typeof value === 'object' && typeof (value as Binding)!.elementId === 'string' ? value as NonNullable<Binding> : null);
const refsOf = (e: El) => (Array.isArray(e.boundElements) ? e.boundElements as Ref[] : []);
const pointsOf = (e: El): Point[] => (Array.isArray(e.points) && e.points.length ? e.points as Point[] : [[0, 0], [e.width, e.height]]);
const absolute = (e: El): Point[] => pointsOf(e).map(([px, py]) => [e.x + px, e.y + py]);

// ---------------------------------------------------------------- outline

export type Outline = {
  nodes: Record<string, unknown>[];
  connectors: Record<string, unknown>[];
  texts: Record<string, unknown>[];
  other: Record<string, unknown>[];
  issues: string[];
};

/** The drawing as nodes, connectors and free texts with their IDs, labels and positions. Compact enough to read whole. */
export function outlineScene(scene: Pick<Scene, 'elements'>): Outline {
  const elements = (scene.elements as El[]).filter(isLive);
  const byId = new Map(elements.map(e => [e.id, e]));
  const labelOf = (e: El) => {
    const ref = refsOf(e).find(ref => ref.type === 'text' && byId.get(ref.id)?.containerId === e.id);
    const text = ref ? byId.get(ref.id) : elements.find(t => t.type === 'text' && t.containerId === e.id);
    return text ? String(text.originalText ?? text.text ?? '') : undefined;
  };
  const shapes = elements.filter(e => !isLinear(e) && e.type !== 'text' && e.type !== 'freedraw');
  const outline: Outline = { nodes: [], connectors: [], texts: [], other: [], issues: [] };
  for (const e of elements) {
    const extra = {
      ...(typeof e.frameId === 'string' ? { frame: e.frameId } : {}),
      ...(Array.isArray(e.groupIds) && e.groupIds.length ? { groups: e.groupIds } : {}),
      ...(e.locked ? { locked: true } : {}),
    };
    if (e.type === 'text') {
      if (typeof e.containerId === 'string') {
        if (!byId.has(e.containerId)) outline.issues.push(`text ${e.id} belongs to missing container ${e.containerId}`);
        continue;
      }
      const inside = smallestContaining(shapes, e);
      outline.texts.push({ id: e.id, text: e.text, x: r(e.x), y: r(e.y), ...(inside ? { over: inside.id } : {}), ...extra });
    } else if (isLinear(e)) {
      const points = absolute(e);
      const ends = (['start', 'end'] as const).map((side, i) => {
        const binding = bindingOf(e[`${side}Binding`]);
        const point = i ? points[points.length - 1] : points[0];
        if (binding) {
          if (!byId.has(binding.elementId)) outline.issues.push(`${e.type} ${e.id} ${side} is bound to missing element ${binding.elementId}`);
          return binding.elementId;
        }
        const near = e.type === 'arrow' ? nearestShape(shapes, point) : undefined;
        if (near) outline.issues.push(`arrow ${e.id} ${side} touches ${near.id} but is not bound, so it will not follow that shape; reconnect it`);
        return [r(point[0]), r(point[1])];
      });
      const label = labelOf(e);
      outline.connectors.push({
        id: e.id, ...(e.type === 'line' ? { type: 'line' } : {}), from: ends[0], to: ends[1],
        ...(label !== undefined ? { label } : {}),
        ...(points.length > 2 ? { bends: points.length - 2 } : {}), ...(e.elbowed ? { elbowed: true } : {}),
        ...(e.strokeStyle && e.strokeStyle !== 'solid' ? { style: e.strokeStyle } : {}),
        ...(e.type === 'arrow' && (e.startArrowhead || !e.endArrowhead) ? { heads: [e.startArrowhead ?? null, e.endArrowhead ?? null] } : {}),
        ...extra,
      });
    } else if (shapes.includes(e)) {
      const label = labelOf(e);
      outline.nodes.push({
        id: e.id, type: e.type, ...(label !== undefined ? { label } : {}),
        x: r(e.x), y: r(e.y), w: r(e.width), h: r(e.height),
        ...(toneOf(e) ? { color: toneOf(e) } : {}), ...(typeof e.opacity === 'number' && e.opacity < 100 ? { opacity: e.opacity } : {}),
        ...extra,
      });
    } else outline.other.push({ id: e.id, type: e.type, x: r(e.x), y: r(e.y), w: r(e.width), h: r(e.height), ...extra });
    for (const ref of refsOf(e)) if (!byId.has(ref.id)) outline.issues.push(`${e.id} lists missing bound element ${ref.id}`);
  }
  return outline;
}

function toneOf(e: El): Tone | undefined {
  return TONE_NAMES.find(tone => TONES[tone][0] === e.strokeColor && (TONES[tone][1] === e.backgroundColor || e.backgroundColor === 'transparent'))
    ?? TONE_NAMES.find(tone => TONES[tone][1] === e.backgroundColor);
}

const contains = (box: El, [px, py]: Point, margin = 0) =>
  px >= box.x - margin && px <= box.x + box.width + margin && py >= box.y - margin && py <= box.y + box.height + margin;
function smallestContaining(shapes: El[], text: El) {
  const middle = center(text);
  return shapes.filter(s => s.type !== 'frame' && contains(s, middle)).sort((a, b) => a.width * a.height - b.width * b.height)[0];
}
function nearestShape(shapes: El[], point: Point) {
  return shapes.filter(s => s.type !== 'frame' && contains(s, point, GAP * 2)).sort((a, b) => a.width * a.height - b.width * b.height)[0];
}

// ---------------------------------------------------------------- operations

const id = z.string().min(1).max(200);
const finite = z.number().finite();
const color = z.enum(TONE_NAMES as [Tone, ...Tone[]]);
// Extra Excalidraw fields to merge as they are (strokeStyle, fillStyle, fontSize…), never id/type or links.
const style = z.record(z.string(), z.unknown()).optional();
const shape = z.enum(['rectangle', 'ellipse', 'diamond']);

export const operationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_node'), id, label: z.string().max(2000).optional(), shape: shape.default('rectangle'),
    x: finite.optional(), y: finite.optional(), width: finite.positive().optional(), height: finite.positive().optional(),
    near: z.object({ id, side: z.enum(['right', 'left', 'above', 'below']), gap: finite.nonnegative().default(80) }).optional(),
    color: color.optional(), style,
  }),
  z.object({
    op: z.literal('connect'), id: id.optional(), from: id, to: id, label: z.string().max(2000).optional(),
    color: color.optional(), dashed: z.boolean().optional(), arrowhead: z.enum(['end', 'both', 'none']).default('end'), style,
  }),
  z.object({ op: z.literal('reconnect'), id, from: id.optional(), to: id.optional() }),
  z.object({ op: z.literal('label'), id, text: z.string().max(2000) }),
  z.object({
    op: z.literal('move'), ids: z.array(id).min(1),
    x: finite.optional(), y: finite.optional(), dx: finite.optional(), dy: finite.optional(),
  }),
  z.object({
    op: z.literal('update'), id, color: color.optional(),
    x: finite.optional(), y: finite.optional(), width: finite.positive().optional(), height: finite.positive().optional(), style,
  }),
  z.object({ op: z.literal('remove'), ids: z.array(id).min(1), keepConnectors: z.boolean().default(false) }),
]);
export type Operation = z.infer<typeof operationSchema>;

const PROTECTED = new Set(['id', 'type', 'containerId', 'boundElements', 'startBinding', 'endBinding', 'frameId', 'isDeleted', 'version', 'versionNonce']);

/** Apply node-level operations in order. Labels, bindings and connector geometry are kept consistent. */
export function editScene(elements: Scene['elements'], operations: Operation[]): Scene['elements'] {
  const before = elements as El[];
  let next = before.map(e => ({ ...e })) as El[];
  const index = () => new Map(next.map(e => [e.id, e]));
  let byId = index();
  // Connector geometry the caller set on purpose; reconcile must not reroute it.
  const pinned = new Set<string>();
  const get = (key: string, where: string) => {
    const e = byId.get(key);
    if (!e || e.isDeleted) throw new Error(`${where}: no element with id "${key}"`);
    return e;
  };
  const add = (e: El) => {
    if (byId.has(e.id)) throw new Error(`An element with id "${e.id}" already exists`);
    next.push(e); byId.set(e.id, e);
  };
  const freshId = (base: string) => { let key = base, n = 2; while (byId.has(key)) key = `${base}-${n++}`; return key; };
  const labelOf = (container: El) => next.find(t => t.type === 'text' && t.containerId === container.id && isLive(t));
  const setLabel = (container: El, text: string, fontSize: number) => {
    const existing = labelOf(container);
    if (!text) {
      if (existing) { next = next.filter(e => e !== existing); byId = index(); }
      return;
    }
    if (existing) { Object.assign(existing, { text, originalText: text }, measure(text, Number(existing.fontSize) || fontSize, Number(existing.lineHeight) || 1.25)); return; }
    add({ ...elementDefaults(`${container.id}-label`), id: freshId(`${container.id}-label`), type: 'text', x: container.x, y: container.y,
      ...measure(text, fontSize), text, originalText: text, fontSize, fontFamily: 1, lineHeight: 1.25,
      textAlign: 'center', verticalAlign: 'middle', containerId: container.id, autoResize: true } as El);
  };
  const fitLabel = (node: El) => {
    // Grow a node around its centre when its label would not fit; Excalidraw clips text beyond the box.
    const label = labelOf(node);
    if (!label) return;
    const pad = node.type === 'rectangle' ? 24 : 48;
    const width = Math.max(node.width, label.width + pad), height = Math.max(node.height, label.height + pad / 2);
    if (width === node.width && height === node.height) return;
    Object.assign(node, { x: round(node.x - (width - node.width) / 2), y: round(node.y - (height - node.height) / 2), width, height });
  };
  const paint = (e: El, tone: Tone | undefined) => {
    if (!tone) return;
    e.strokeColor = TONES[tone][0];
    if (!isLinear(e) && e.type !== 'text') e.backgroundColor = TONES[tone][1];
  };
  const merge = (e: El, fields: Record<string, unknown> | undefined) => {
    for (const [key, value] of Object.entries(fields ?? {})) if (!PROTECTED.has(key)) e[key] = value;
  };
  const translate = (e: El, dx: number, dy: number) => { e.x = round(e.x + dx); e.y = round(e.y + dy); };
  const bindable = (e: El, where: string) => {
    if (isLinear(e)) throw new Error(`${where}: "${e.id}" is a connector (${e.type}); connect shapes or text`);
    return e;
  };

  operations.forEach((op, i) => {
    const where = `operation ${i + 1} (${op.op})`;
    switch (op.op) {
      case 'add_node': {
        const size = op.label ? measure(op.label, 20) : { width: 0, height: 0 };
        const pad = op.shape === 'rectangle' ? 40 : 80;
        const width = op.width ?? Math.max(160, size.width + pad), height = op.height ?? Math.max(op.shape === 'diamond' ? 110 : 80, size.height + pad / 2);
        let { x, y } = op;
        if (op.near) {
          const ref = get(op.near.id, where), gap = op.near.gap;
          const [cx, cy] = center(ref as Box);
          x ??= op.near.side === 'right' ? ref.x + ref.width + gap : op.near.side === 'left' ? ref.x - gap - width : cx - width / 2;
          y ??= op.near.side === 'below' ? ref.y + ref.height + gap : op.near.side === 'above' ? ref.y - gap - height : cy - height / 2;
        }
        if (x === undefined || y === undefined) throw new Error(`${where}: give x and y, or near`);
        const [stroke, fill] = TONES[op.color ?? 'blue'];
        const node = { ...elementDefaults(op.id), id: op.id, type: op.shape, x: round(x), y: round(y), width, height,
          strokeColor: stroke, backgroundColor: fill, roundness: op.shape === 'rectangle' ? { type: 3 } : { type: 2 } } as El;
        merge(node, op.style);
        add(node);
        if (op.label) setLabel(node, op.label, 20);
        break;
      }
      case 'connect': {
        const from = bindable(get(op.from, where), where), to = bindable(get(op.to, where), where);
        const key = op.id ?? freshId(`${op.from}-${op.to}`);
        const arrow = { ...elementDefaults(key), id: key, type: 'arrow', x: from.x, y: from.y, width: 0, height: 0,
          points: [[0, 0], [0, 0]], lastCommittedPoint: null, roundness: { type: 2 }, elbowed: false,
          startBinding: { elementId: from.id, focus: 0, gap: GAP }, endBinding: { elementId: to.id, focus: 0, gap: GAP },
          startArrowhead: op.arrowhead === 'both' ? 'arrow' : null, endArrowhead: op.arrowhead === 'none' ? null : 'arrow',
          strokeStyle: op.dashed ? 'dashed' : 'solid' } as El;
        paint(arrow, op.color);
        merge(arrow, op.style);
        add(arrow);
        route(arrow, byId);
        if (op.label) setLabel(arrow, op.label, 16);
        break;
      }
      case 'reconnect': {
        const arrow = get(op.id, where);
        if (arrow.type !== 'arrow') throw new Error(`${where}: "${op.id}" is not an arrow`);
        if (!op.from && !op.to) throw new Error(`${where}: give from and/or to`);
        if (op.from) arrow.startBinding = { elementId: bindable(get(op.from, where), where).id, focus: 0, gap: GAP };
        if (op.to) arrow.endBinding = { elementId: bindable(get(op.to, where), where).id, focus: 0, gap: GAP };
        route(arrow, byId);
        break;
      }
      case 'label': {
        const target = get(op.id, where);
        if (target.type === 'text') {
          if (!op.text) throw new Error(`${where}: use remove to delete text "${op.id}"`);
          Object.assign(target, { text: op.text, originalText: op.text }, measure(op.text, Number(target.fontSize) || 20, Number(target.lineHeight) || 1.25));
        } else {
          setLabel(target, op.text, isLinear(target) ? 16 : 20);
          if (!isLinear(target)) fitLabel(target);
        }
        break;
      }
      case 'move': {
        if ((op.x !== undefined || op.y !== undefined) && op.ids.length > 1) throw new Error(`${where}: x/y move one element; use dx/dy for several`);
        const moving = new Set<string>();
        for (const key of op.ids) {
          const e = get(key, where);
          moving.add(e.id);
          // A frame carries its children along.
          if (e.type === 'frame') for (const child of next) if (child.frameId === e.id) moving.add(child.id);
        }
        const first = byId.get(op.ids[0])!;
        const dx = op.dx ?? (op.x !== undefined ? op.x - first.x : 0), dy = op.dy ?? (op.y !== undefined ? op.y - first.y : 0);
        for (const key of moving) {
          const e = byId.get(key)!;
          if (e.type === 'text' && typeof e.containerId === 'string') continue; // Labels follow their container.
          translate(e, dx, dy);
        }
        // A connector moved explicitly keeps its shape; free ends are not rerouted.
        for (const key of moving) if (isLinear(byId.get(key)!)) pinned.add(key);
        break;
      }
      case 'update': {
        const e = get(op.id, where);
        merge(e, op.style);
        paint(e, op.color);
        for (const key of ['x', 'y', 'width', 'height'] as const) if (op[key] !== undefined) e[key] = op[key];
        if (op.style && 'points' in op.style && isLinear(e)) pinned.add(e.id);
        if (e.type === 'text' && op.style && 'text' in op.style) e.originalText = e.text;
        break;
      }
      case 'remove': {
        const gone = new Set<string>();
        for (const key of op.ids) gone.add(get(key, where).id);
        if (!op.keepConnectors) for (const e of next) {
          if (isLinear(e) && [e.startBinding, e.endBinding].some(b => gone.has(bindingOf(b)?.elementId ?? ''))) gone.add(e.id);
        }
        for (const e of next) if (e.type === 'text' && gone.has(e.containerId as string)) gone.add(e.id);
        next = next.filter(e => !gone.has(e.id)); byId = index();
        break;
      }
    }
  });
  return reconcileElements(before as Scene['elements'], next as Scene['elements'], pinned);
}

// ---------------------------------------------------------------- consistency

const geometry = (e: El) => `${e.x},${e.y},${e.width},${e.height},${e.angle ?? 0}`;

/**
 * Make a written scene consistent, the way the editor does when a person drags a shape:
 * - labels of removed containers go with them; bindings to removed elements are dropped;
 * - every shape lists exactly the labels and arrows bound to it (`boundElements`);
 * - arrows bound to a shape that moved or resized are rerouted to its edge, unless `pinned`;
 * - labels are re-centred in containers that moved, resized or got a new text;
 * - changed elements get a new version.
 */
export function reconcileElements(beforeElements: Scene['elements'], afterElements: Scene['elements'], pinned = new Set<string>()): Scene['elements'] {
  const before = new Map((beforeElements as El[]).map(e => [e.id, e]));
  let next = (afterElements as El[]).map(e => ({ ...e }));
  const liveIds = () => new Set(next.filter(isLive).map(e => e.id));
  let live = liveIds();
  // Labels whose container this write removed are removed too; others just lose the dangling link.
  next = next.filter(e => !(e.type === 'text' && isLive(e) && typeof e.containerId === 'string' && !live.has(e.containerId) && before.has(e.containerId)));
  live = liveIds();
  const byId = new Map(next.map(e => [e.id, e]));
  for (const e of next) {
    if (e.type === 'text' && typeof e.containerId === 'string' && !live.has(e.containerId)) e.containerId = null;
    if (isLinear(e)) for (const side of ['startBinding', 'endBinding'] as const) {
      const binding = bindingOf(e[side]);
      if (binding && (!live.has(binding.elementId) || isLinear(byId.get(binding.elementId)!))) e[side] = null;
    }
  }
  // Two-way links: rebuild boundElements from the labels and arrows that point at each element, keeping order.
  const pointing = new Map<string, Ref[]>();
  const point = (target: string, ref: Ref) => { if (!pointing.has(target)) pointing.set(target, []); if (!pointing.get(target)!.some(x => x.id === ref.id)) pointing.get(target)!.push(ref); };
  for (const e of next) {
    if (!isLive(e)) continue;
    if (e.type === 'text' && typeof e.containerId === 'string') point(e.containerId, { id: e.id, type: 'text' });
    if (e.type === 'arrow') for (const side of ['startBinding', 'endBinding'] as const) {
      const binding = bindingOf(e[side]);
      if (binding) point(binding.elementId, { id: e.id, type: 'arrow' });
    }
  }
  for (const e of next) {
    const wanted = pointing.get(e.id) ?? [];
    const current = refsOf(e);
    const kept = current.filter(ref => wanted.some(w => w.id === ref.id && w.type === ref.type));
    const merged = [...kept, ...wanted.filter(w => !kept.some(k => k.id === w.id))];
    if (merged.length !== current.length || merged.some((ref, i) => ref.id !== current[i].id || ref.type !== current[i].type)) {
      e.boundElements = merged;
    }
  }
  // Reroute arrows attached to shapes that are new or whose geometry changed, or whose own bindings changed.
  const moved = new Set(next.filter(e => !isLinear(e) && (!before.has(e.id) || geometry(before.get(e.id)!) !== geometry(e))).map(e => e.id));
  const rerouted = new Set<string>();
  for (const e of next) {
    if (e.type !== 'arrow' || !isLive(e) || pinned.has(e.id)) continue;
    const old = before.get(e.id);
    const ends = [bindingOf(e.startBinding), bindingOf(e.endBinding)];
    const rebound = !old || JSON.stringify([bindingOf(old.startBinding)?.elementId, bindingOf(old.endBinding)?.elementId]) !== JSON.stringify(ends.map(b => b?.elementId));
    const geometryChanged = old && (geometry(old) !== geometry(e) || JSON.stringify(old.points) !== JSON.stringify(e.points));
    // A new or rebound arrow whose caller wrote its own points keeps them.
    if ((rebound && !geometryChanged && old) || ends.some(b => b && moved.has(b.elementId)) || (!old && ends.some(Boolean) && isDegenerate(e))) {
      route(e, byId); rerouted.add(e.id);
    }
  }
  // Re-centre labels whose container changed or whose text changed.
  for (const e of next) {
    if (e.type !== 'text' || !isLive(e) || typeof e.containerId !== 'string') continue;
    const container = byId.get(e.containerId)!;
    const old = before.get(e.id);
    const changed = !old || old.text !== e.text || old.containerId !== e.containerId || moved.has(container.id) || rerouted.has(container.id);
    if (changed && !pinned.has(e.id)) placeLabel(e, container);
  }
  // New versions for what changed, so editors treat them as updates.
  const now = Date.now();
  return next.map(e => {
    const old = before.get(e.id);
    if (!old || JSON.stringify(old) === JSON.stringify(e)) return e;
    const version = typeof old.version === 'number' && (e.version === undefined || e.version === old.version) ? old.version + 1 : e.version;
    return { ...e, version, versionNonce: Math.floor(Math.random() * 2 ** 31), updated: now };
  }) as Scene['elements'];
}

const isDegenerate = (e: El) => pointsOf(e).every(([px, py]) => px === 0 && py === 0);

/**
 * Point a bound arrow at its shapes' edges. A straight arrow aims centre to centre; an arrow
 * with bends keeps its inner points and only moves the bound ends.
 */
function route(arrow: El, byId: Map<string, El>) {
  const points = absolute(arrow);
  const shapeAt = (b: Binding) => {
    const target = bindingOf(b) && byId.get(bindingOf(b)!.elementId);
    return target && !isLinear(target) && isLive(target) ? target : undefined;
  };
  const start = shapeAt(arrow.startBinding as Binding), end = shapeAt(arrow.endBinding as Binding);
  const last = points.length - 1;
  const gapOf = (b: unknown) => bindingOf(b)?.gap ?? GAP;
  if (points.length < 2) points.push([...points[0]]);
  const startAim: Point = points.length > 2 ? points[1] : end ? center(end as Box) : points[Math.max(last, 1)];
  const endAim: Point = points.length > 2 ? points[points.length - 2] : start ? center(start as Box) : points[0];
  if (start) points[0] = edgeToward(start as Box, startAim, gapOf(arrow.startBinding));
  if (end) points[points.length - 1] = edgeToward(end as Box, endAim, gapOf(arrow.endBinding));
  if (start) arrow.startBinding = { ...bindingOf(arrow.startBinding)!, focus: 0 };
  if (end) arrow.endBinding = { ...bindingOf(arrow.endBinding)!, focus: 0 };
  const [x0, y0] = points[0];
  const relative = points.map(([px, py]) => [round(px - x0), round(py - y0)] as Point);
  const xs = relative.map(p => p[0]), ys = relative.map(p => p[1]);
  Object.assign(arrow, { x: x0, y: y0, points: relative, width: round(Math.max(...xs) - Math.min(...xs)), height: round(Math.max(...ys) - Math.min(...ys)) });
}

/** Centre a label in its shape, or on its connector's middle, as Excalidraw lays out bound text. */
function placeLabel(label: El, container: El) {
  let cx: number, cy: number;
  if (isLinear(container)) {
    const points = absolute(container);
    const mid = Math.floor(points.length / 2);
    [cx, cy] = points.length % 2 ? points[mid] : [(points[mid - 1][0] + points[mid][0]) / 2, (points[mid - 1][1] + points[mid][1]) / 2];
  } else [cx, cy] = center(container as Box);
  label.x = round(cx - label.width / 2);
  label.y = round(cy - label.height / 2);
}
