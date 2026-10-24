/**
 * Element primitives shared by the templates and by agent edits: hand-drawn defaults,
 * Excalidraw's palette, text sizing and where a connector meets a shape.
 */

// Excalidraw's own palette (stroke, light fill); the editor inverts these in dark mode.
export const TONES = {
  blue: ['#1971c2', '#a5d8ff'], green: ['#2f9e44', '#b2f2bb'], yellow: ['#f08c00', '#ffec99'],
  red: ['#e03131', '#ffc9c9'], violet: ['#6741d9', '#d0bfff'], gray: ['#495057', '#e9ecef'],
} as const;
export type Tone = keyof typeof TONES;
export const TONE_NAMES = Object.keys(TONES) as Tone[];

/** Space between a bound arrow's tip and its shape, as Excalidraw leaves it. */
export const GAP = 8;

export type Box = { id: string; type: string; x: number; y: number; width: number; height: number };

/** The fields every element needs, with the hand-drawn look. */
export function elementDefaults(id: string) {
  return {
    angle: 0, strokeColor: TONES.gray[0], backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2,
    strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null,
    seed: seed(id), version: 1, versionNonce: seed(`${id}:nonce`), isDeleted: false, boundElements: [],
    updated: 1, link: null, locked: false,
  };
}

/** Generous text box: CJK glyphs are about one em wide, Latin about 0.6 em (the skill's sizing rule). */
export function measure(text: string, fontSize: number, lineHeight = 1.25) {
  const lines = text.split('\n');
  const width = Math.max(...lines.map(line => [...line].reduce((sum, ch) => sum + (/[⺀-￿]/.test(ch) ? 1 : 0.6), 0)));
  return { width: Math.ceil(width * fontSize) + 4, height: Math.ceil(lines.length * fontSize * lineHeight) };
}

export const center = (box: Box): [number, number] => [box.x + box.width / 2, box.y + box.height / 2];

/** Where the line from a shape's centre towards a point leaves the shape, plus the binding gap. */
export function edgeToward(from: Box, [tx, ty]: [number, number], gap = GAP): [number, number] {
  const [cx, cy] = center(from);
  const dx = tx - cx, dy = ty - cy;
  const rx = from.width / 2 || 1, ry = from.height / 2 || 1;
  const t = !dx && !dy ? 0
    : from.type === 'ellipse' ? 1 / Math.hypot(dx / rx, dy / ry)
    : from.type === 'diamond' ? 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry)
    : Math.min(dx ? rx / Math.abs(dx) : Infinity, dy ? ry / Math.abs(dy) : Infinity);
  const length = Math.hypot(dx, dy) || 1;
  return [round(cx + dx * t + dx / length * gap), round(cy + dy * t + dy / length * gap)];
}

/** Where the line between two shape centres leaves `from`. */
export const edge = (from: Box, to: Box) => edgeToward(from, center(to));

export const round = (value: number) => Math.round(value * 100) / 100;

/** Stable per-element seed, so an element always renders the same hand-drawn strokes. */
export function seed(text: string) {
  let hash = 2166136261;
  for (const ch of text) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2_000_000_000 + 1;
}
