import { describe, expect, it } from '@jest/globals';

import { cellIndex, makePiece, N, placePiece, type GameState, type Piece } from '../engine';
import { buildFx } from '../fx';
import { metrics, span } from '../theme';

const m = metrics(390, 800);
const single = () => makePiece(0, 0);

function state(tray: (Piece | null)[], over: Partial<GameState> = {}): GameState {
  return {
    grid: Array(N * N).fill(-1),
    cores: Array(N * N).fill(null),
    terminals: { row: 3, col: 3 },
    tray,
    score: 0,
    best: 0,
    combo: 0,
    idle: 0,
    over: false,
    ...over,
  };
}

const texts = (s: GameState, r: number, c: number) =>
  buildFx(
    placePiece(s, 0, r, c, () => 0.5)!,
    m,
  ).flatMap((it) => ('text' in it ? [`${it.kind}:${it.text}`] : []));

describe('buildFx', () => {
  it('adds nothing when no line clears', () => {
    expect(buildFx(placePiece(state([single(), single(), single()]), 0, 3, 3)!, m)).toEqual([]);
  });

  it('shows points for a single clear, and praise plus combo for a double', () => {
    const one = state([single(), single(), single()], { combo: 0 });
    for (let c = 1; c < N; c++) one.grid[c] = 1;
    one.grid[cellIndex(5, 5)] = 2;
    expect(texts(one, 0, 0)).toEqual(['points:+110']);

    const two = state([single(), single(), single()], { combo: 1 });
    for (let i = 0; i < N - 1; i++) {
      two.grid[cellIndex(7, i)] = 1;
      two.grid[cellIndex(i, 7)] = 1;
    }
    two.grid[cellIndex(5, 5)] = 2;
    expect(texts(two, 7, 7)).toEqual(['points:+610', 'praise:Double!', 'combo:Combo 2']);
  });

  it('headlines surges and board clears', () => {
    const surge = state([single(), single(), single()]);
    for (let c = 1; c < N; c++) surge.grid[c] = 1;
    surge.cores[3] = 'line';
    surge.grid[cellIndex(5, 3)] = 2;
    surge.grid[cellIndex(6, 6)] = 2;
    expect(texts(surge, 0, 0)).toContain('praise:Surge!');

    const clear = state([single(), single(), single()]);
    for (let c = 1; c < N; c++) clear.grid[c] = 1;
    expect(texts(clear, 0, 0)).toContain('praise:Board clear!');
  });

  it('draws one trace per cleared line and one burst per cleared cell', () => {
    const s = state([single(), single(), single()]);
    for (let c = 1; c < N; c++) s.grid[c] = 1;
    s.grid[cellIndex(5, 5)] = 2;
    const items = buildFx(placePiece(s, 0, 0, 0)!, m);
    expect(items.filter((it) => it.kind === 'trace' && it.axis === 'h')).toHaveLength(1);
    expect(items.filter((it) => it.kind === 'burst')).toHaveLength(N);
    expect(new Set(items.map((it) => it.id)).size).toBe(items.length);
  });

  it('draws a 3×3 blast square for an area core', () => {
    const s = state([single(), single(), single()]);
    for (let c = 1; c < N; c++) s.grid[c] = 1;
    s.cores[4] = 'area';
    s.grid[cellIndex(5, 5)] = 2;
    const items = buildFx(placePiece(s, 0, 0, 0)!, m);
    const blast = items.find((it) => it.kind === 'blast');
    expect(blast).toMatchObject({ x: 3 * m.pitch, y: 0, w: span(3, m), h: span(2, m) });
    expect(items.some((it) => it.kind === 'trace' && it.surge)).toBe(false);
  });

  it('sparks along a completed circuit and headlines it', () => {
    const s = state([single(), single(), single()], { terminals: { row: 3, col: 3 } });
    [
      [3, 0],
      [2, 0],
      [1, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [6, 6],
    ].forEach(([r, c]) => (s.grid[cellIndex(r, c)] = 2));
    const res = placePiece(s, 0, 0, 0, () => 0.5)!;
    const items = buildFx(res, m);
    expect(items.filter((it) => it.kind === 'spark')).toHaveLength(res.circuit.length);
    expect(texts(s, 0, 0)).toContain('praise:Circuit!');
  });
});
