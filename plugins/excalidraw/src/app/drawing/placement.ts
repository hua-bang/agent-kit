export type Rect = { x: number; y: number; width: number; height: number };

const MARGIN = 40;

/** Scene-space bounding box of an element; lines and arrows extend by their points, which may go negative. */
export function boundsOf(e: { x: number; y: number; width: number; height: number; points?: readonly (readonly number[])[] }): Rect {
  if (!e.points?.length) return { x: e.x, y: e.y, width: e.width, height: e.height };
  const xs = e.points.map(p => e.x + p[0]), ys = e.points.map(p => e.y + p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + MARGIN && b.x < a.x + a.width + MARGIN && a.y < b.y + b.height + MARGIN && b.y < a.y + a.height + MARGIN;

/**
 * Top-left corner for a new block of `size`: centred in the visible area when that is free,
 * otherwise the free spot nearest to the centre of the view, searched in growing rings.
 * Falls back to the right of everything drawn.
 */
export function findFreeSpot(taken: Rect[], size: { width: number; height: number }, view: Rect): { x: number; y: number } {
  const cx = view.x + view.width / 2 - size.width / 2, cy = view.y + view.height / 2 - size.height / 2;
  const free = (x: number, y: number) => !taken.some(rect => overlaps(rect, { x, y, ...size }));
  if (free(cx, cy)) return { x: cx, y: cy };
  const step = Math.max(40, Math.max(size.width, size.height) / 3);
  const reach = Math.max(view.width, view.height) * 1.5;
  for (let ring = 1; ring * step <= reach; ring++) {
    let best: { x: number; y: number; d: number } | null = null;
    for (let i = -ring; i <= ring; i++) for (const [dx, dy] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
      const x = cx + dx * step, y = cy + dy * step, d = Math.hypot(dx, dy);
      if ((!best || d < best.d) && free(x, y)) best = { x, y, d };
    }
    if (best) return { x: best.x, y: best.y };
  }
  if (!taken.length) return { x: cx, y: cy };
  return { x: Math.max(...taken.map(r => r.x + r.width)) + 120, y: Math.min(...taken.map(r => r.y)) };
}

export const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
