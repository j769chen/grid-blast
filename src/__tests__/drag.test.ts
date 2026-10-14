import { describe, expect, it } from '@jest/globals';
import type { SharedValue } from 'react-native-reanimated';

import {
  completedLines,
  decodeCell,
  DRAG_GAIN,
  encodeCell,
  ghostFrame,
  returnFrame,
  LIFT_CELLS,
  nearestCell,
  NO_CELL,
  targetCell,
  type DragShared,
  type Point,
  type SlotGeo,
} from '../drag';
import { N, type Lines } from '../engine';

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

describe('nearestCell radius', () => {
  it('uses Euclidean distance, so diagonal offsets beyond one cell miss', () => {
    expect(nearestCell(empty(), square, -0.8, -0.8)).toBe(NO_CELL);
    expect(at(nearestCell(empty(), square, -0.6, -0.6))).toEqual({ r: 0, c: 0 });
    expect(at(nearestCell(empty(), square, -1, 0))).toEqual({ r: 0, c: 0 });
  });
});

const sv = <T>(value: T) => ({ get: () => value }) as unknown as SharedValue<T>;

function drag(touch: { x: number; y: number }, mouse: boolean, back = [1, 1, 1]): DragShared {
  return {
    slot: sv(0),
    touch: sv(touch),
    origin: sv({ x: 100, y: 500 }),
    pitch: sv(40),
    mouse: sv(mouse),
    geo: sv<(SlotGeo | null)[]>([{ ...square, w: 78, h: 78 }, null, null]),
    landing: sv<(Point | null)[]>([null, null, null]),
    slots: sv([
      { x: 20, y: 600, w: 120, h: 100 },
      { x: 150, y: 600, w: 120, h: 100 },
      { x: 280, y: 600, w: 120, h: 100 },
    ]),
    missFrom: sv([
      { x: 200, y: 300 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]),
    back: sv(back),
    shrink: sv(0.5),
    target: sv(NO_CELL),
    lines: sv<Lines>({ rows: [], cols: [] }),
  };
}

describe('ghostFrame', () => {
  it('centres a touch-dragged part above the finger and moves it by the gain', () => {
    const f = ghostFrame(drag({ x: 110, y: 480 }, false), 0);
    expect(f.x + 39).toBeCloseTo(100 + 10 * DRAG_GAIN);
    expect(f.y + 39).toBeCloseTo(500 - 20 * DRAG_GAIN - 40 * LIFT_CELLS);
  });

  it('keeps a mouse-dragged part on the cursor', () => {
    const f = ghostFrame(drag({ x: 110, y: 480 }, true), 0);
    expect(f).toEqual({ x: 110 - 39, y: 480 - 39 });
  });

  it('parks a slot with no part offscreen', () => {
    expect(ghostFrame(drag({ x: 0, y: 0 }, false), 1).x).toBeLessThan(-1000);
  });
});

describe('targetCell', () => {
  it('converts the part frame to board cells', () => {
    const field = { x: 20, y: 100 };
    expect(at(targetCell({ x: 20 + 2.2 * 40, y: 100 + 3.4 * 40 }, field, 40, empty(), square))).toEqual({ r: 3, c: 2 });
    expect(targetCell({ x: 0, y: 0 }, field, 40, empty(), null)).toBe(NO_CELL);
  });
});

describe('returnFrame', () => {
  it('flies a missed part from where it was dropped to its socket, shrinking as it goes', () => {
    expect(returnFrame(drag({ x: 0, y: 0 }, false, [0, 1, 1]), 0)).toEqual({ x: 200, y: 300, scale: 1 });
    const mid = returnFrame(drag({ x: 0, y: 0 }, false, [0.5, 1, 1]), 0)!;
    expect(mid.scale).toBeCloseTo(0.75);
    const end = { x: 20 + 60 - 39, y: 600 + 50 - 39 };
    expect(mid.x).toBeCloseTo((200 + end.x) / 2);
    expect(mid.y).toBeCloseTo((300 + end.y) / 2);
  });

  it('is idle once the return finishes or for an empty slot', () => {
    expect(returnFrame(drag({ x: 0, y: 0 }, false), 0)).toBeNull();
    expect(returnFrame(drag({ x: 0, y: 0 }, false, [1, 0, 1]), 1)).toBeNull();
  });
});

describe('completedLines', () => {
  it('lists the rows and columns a placement would complete', () => {
    const grid = empty();
    for (let c = 2; c < N; c++) grid[c] = 1;
    for (let r = 2; r < N; r++) grid[r * N + 1] = 1;
    expect(completedLines(grid, square, encodeCell(0, 0))).toEqual({ rows: [0], cols: [1] });
  });

  it('is empty with no target, no part, or nothing completed', () => {
    expect(completedLines(empty(), square, NO_CELL)).toEqual({ rows: [], cols: [] });
    expect(completedLines(empty(), null, encodeCell(0, 0))).toEqual({ rows: [], cols: [] });
    expect(completedLines(empty(), square, encodeCell(3, 3))).toEqual({ rows: [], cols: [] });
  });
});
