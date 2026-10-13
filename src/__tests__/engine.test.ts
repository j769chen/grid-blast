import { describe, expect, it } from '@jest/globals';

import {
  fmt,
  fits,
  isGameState,
  makePiece,
  MAX_CHARGE,
  N,
  newGame,
  placePiece,
  rotate,
  SHAPES,
  spinPiece,
  type GameState,
  type Piece,
} from '../engine';

const shapeIndex = (w: number, h: number, n: number) => SHAPES.findIndex((s) => s.w === w && s.h === h && s.cells.length === n);
const single = () => makePiece(0, 0);
const bar = (len: number) => makePiece(shapeIndex(len, 1, len), 1);

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function blank(tray: (Piece | null)[], over: Partial<GameState> = {}): GameState {
  return {
    grid: Array(N * N).fill(-1),
    cores: Array(N * N).fill(false),
    tray,
    score: 0,
    best: 0,
    combo: 0,
    idle: 0,
    charge: 3,
    over: false,
    ...over,
  };
}

describe('rotate', () => {
  it('turns an L clockwise', () => {
    const l: Piece = { w: 2, h: 3, cells: [[0, 0], [1, 0], [2, 0], [2, 1]], c: 0, core: 3 };
    const r = rotate(l);
    expect(r.w).toBe(3);
    expect(r.h).toBe(2);
    expect(r.cells).toEqual([[0, 2], [0, 1], [0, 0], [1, 0]]);
    expect(r.core).toBe(3);
  });

  it('returns to the start after four turns', () => {
    const p = makePiece(shapeIndex(3, 2, 4), 2);
    expect(rotate(rotate(rotate(rotate(p))))).toEqual(p);
  });
});

describe('fits', () => {
  it('rejects out-of-bounds and occupied positions', () => {
    const s = blank([null, null, null]);
    const p = bar(3);
    expect(fits(s.grid, p, 0, 5)).toBe(true);
    expect(fits(s.grid, p, 0, 6)).toBe(false);
    expect(fits(s.grid, p, -1, 0)).toBe(false);
    s.grid[2] = 4;
    expect(fits(s.grid, p, 0, 0)).toBe(false);
  });
});

describe('placePiece', () => {
  it('scores cells placed with no clear and resets combo after 3 idle moves', () => {
    const s = blank([single(), single(), single()], { combo: 2, idle: 2 });
    const res = placePiece(s, 0, 4, 4, seeded())!;
    expect(res.gained).toBe(10);
    expect(res.state.combo).toBe(0);
    expect(res.state.tray[0]).toBeNull();
  });

  it('clears a full row, refunds a charge, and applies the combo', () => {
    const s = blank([single(), single(), single()], { combo: 1, charge: MAX_CHARGE });
    for (let c = 1; c < N; c++) s.grid[c] = 3;
    s.grid[N * 5] = 2;
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.lineCount).toBe(1);
    expect(res.gained).toBe(10 + 100 * 2);
    expect(res.state.combo).toBe(2);
    expect(res.state.charge).toBe(MAX_CHARGE);
    expect(res.state.grid.slice(0, N).every((v) => v < 0)).toBe(true);
    expect(res.perfect).toBe(false);
  });

  it('scores multi-line clears as 50·n·(n+1) and awards a board clear', () => {
    const s = blank([single(), single(), single()]);
    for (let i = 0; i < N; i++) {
      if (i !== 0) s.grid[i] = 1;
      if (i !== 0) s.grid[i * N] = 1;
    }
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.lineCount).toBe(2);
    expect(res.perfect).toBe(true);
    expect(res.gained).toBe(10 + 300 + 3000);
  });

  it('detonates a core in a cleared row across its column, and chains', () => {
    const s = blank([single(), single(), single()]);
    for (let c = 1; c < N; c++) s.grid[c] = 0;
    s.cores[3] = true;
    for (let r = 1; r < 7; r++) s.grid[r * N + 3] = 5;
    s.cores[6 * N + 3] = true;
    s.grid[6 * N + 7] = 2;
    s.grid[7 * N + 0] = 2;
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.surges).toEqual([3, 6 * N + 3]);
    expect(res.state.grid[6 * N + 7]).toBe(-1);
    expect(res.state.grid[7 * N + 0]).toBe(2);
    expect(res.state.cores.some(Boolean)).toBe(false);
    expect(res.lineCount).toBe(1);
    expect(res.gained).toBe(10 + 100 + 7 * 40);
  });

  it('deals a new tray once all three parts are used', () => {
    const s = blank([single(), null, null]);
    const res = placePiece(s, 0, 7, 7, seeded())!;
    expect(res.dealt).toBe(true);
    expect(res.state.tray.every((p) => p !== null)).toBe(true);
  });

  it('ends the game when nothing fits, even after affordable rotations', () => {
    const s = blank([single(), bar(5), null], { charge: 1 });
    for (let i = 0; i < N * N; i++) s.grid[i] = ((i % N) + Math.floor(i / N)) % 2 === 0 ? -1 : 1;
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.state.over).toBe(true);
  });
});

describe('spinPiece', () => {
  it('rotates and spends a charge', () => {
    const s = blank([bar(3), single(), single()], { charge: 1 });
    const next = spinPiece(s, 0)!;
    expect(next.charge).toBe(0);
    expect(next.tray[0]!.h).toBe(3);
    expect(spinPiece(next, 0)).toBeNull();
  });
});

describe('newGame', () => {
  it('produces a valid starting state with no full lines', () => {
    const s = newGame(1234, seeded(42));
    expect(isGameState(s)).toBe(true);
    expect(s.best).toBe(1234);
    expect(s.grid.some((v) => v >= 0)).toBe(true);
    expect(s.tray).toHaveLength(3);
  });
});

describe('fmt', () => {
  it('adds thousands separators', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(1234567)).toBe('1,234,567');
  });
});
