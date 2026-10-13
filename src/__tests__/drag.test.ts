import { describe, expect, it } from '@jest/globals';

import { decodeCell, encodeCell, nearestCell, NO_CELL, type SlotGeo } from '../drag';
import { N } from '../engine';

const empty = () => Array<number>(N * N).fill(-1);
const square: SlotGeo = { w: 0, h: 0, pw: 2, ph: 2, cells: [0, 0, 0, 1, 1, 0, 1, 1] };
const at = (code: number) => (code === NO_CELL ? null : decodeCell(code));

describe('nearestCell', () => {
  it('picks the closest cell rather than biasing upward', () => {
    expect(at(nearestCell(empty(), square, 3.45, 2))).toEqual({ r: 3, c: 2 });
    expect(at(nearestCell(empty(), square, 3.55, 2))).toEqual({ r: 4, c: 2 });
  });

  it('shows a target when hovering just above or left of the board', () => {
    expect(at(nearestCell(empty(), square, -0.8, 3))).toEqual({ r: 0, c: 3 });
    expect(at(nearestCell(empty(), square, 2, -0.7))).toEqual({ r: 2, c: 0 });
  });

  it('falls back to the nearest open spot when the rounded one is blocked', () => {
    const grid = empty();
    grid[2 * N + 3] = 0;
    expect(at(nearestCell(grid, square, 2.3, 2.2))).toEqual({ r: 3, c: 2 });
  });

  it('returns no cell when nothing fits within a cell of the piece', () => {
    expect(nearestCell(empty(), square, -1.5, 3)).toBe(NO_CELL);
    const full = Array<number>(N * N).fill(0);
    expect(nearestCell(full, square, 3, 3)).toBe(NO_CELL);
  });

  it('round-trips cell codes', () => {
    expect(decodeCell(encodeCell(0, 7))).toEqual({ r: 0, c: 7 });
  });
});
