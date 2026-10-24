import { describe, expect, it } from 'vitest';
import { boundsOf, findFreeSpot } from '../src/app/drawing/placement';

const view = { x: 0, y: 0, width: 1000, height: 800 };
const size = { width: 300, height: 200 };

describe('template placement', () => {
  it('centres in the view when that area is free', () => {
    expect(findFreeSpot([{ x: 2000, y: 0, width: 100, height: 100 }], size, view)).toEqual({ x: 350, y: 300 });
  });
  it('picks a free spot near the view centre instead of the far right of the drawing', () => {
    const taken = [{ x: 300, y: 250, width: 400, height: 300 }, { x: 5000, y: 0, width: 100, height: 100 }];
    const at = findFreeSpot(taken, size, view);
    const overlaps = at.x < 740 && at.x + 300 > 260 && at.y < 590 && at.y + 200 > 210;
    expect(overlaps).toBe(false);
    expect(Math.hypot(at.x - 350, at.y - 300)).toBeLessThan(600);
  });
  it('measures arrows by their points', () => {
    expect(boundsOf({ x: 100, y: 100, width: 50, height: 50, points: [[0, 0], [-50, 50]] })).toEqual({ x: 50, y: 100, width: 50, height: 50 });
  });
});
