import { describe, expect, it } from '@jest/globals';

import {
  anyMove,
  BUFFER,
  blastCells,
  cellIndex,
  circuitPath,
  fits,
  isGameState,
  makePiece,
  N,
  newGame,
  newTray,
  pickTerminals,
  placePiece,
  rotate,
  SHAPES,
  spinPiece,
  stashPiece,
  turnsToFit,
  type GameState,
  type Piece,
} from '../engine';

const shapeIndex = (w: number, h: number, n: number) =>
  SHAPES.findIndex((s) => s.w === w && s.h === h && s.cells.length === n);
const single = () => makePiece(0, 0);
const bar = (len: number) => makePiece(shapeIndex(len, 1, len), 1);

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function onlyOpen(open: [number, number][]) {
  const grid = Array<number>(N * N).fill(0);
  open.forEach(([r, c]) => (grid[cellIndex(r, c)] = -1));
  return grid;
}

const column3: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
];

function blank(tray: (Piece | null)[], over: Partial<GameState> = {}): GameState {
  return {
    grid: Array(N * N).fill(-1),
    cores: Array(N * N).fill(null),
    terminals: { row: 3, col: 3 },
    tray,
    buffer: null,
    stashed: false,
    score: 0,
    best: 0,
    combo: 0,
    idle: 0,
    over: false,
    ...over,
  };
}

describe('rotate', () => {
  it('turns an L clockwise', () => {
    const l: Piece = {
      w: 2,
      h: 3,
      cells: [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
      ],
      c: 0,
      core: 3,
      coreKind: 'line',
    };
    const r = rotate(l);
    expect(r.w).toBe(3);
    expect(r.h).toBe(2);
    expect(r.cells).toEqual([
      [0, 2],
      [0, 1],
      [0, 0],
      [1, 0],
    ]);
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

  it('clears a full row and applies the combo', () => {
    const s = blank([single(), single(), single()], { combo: 1 });
    for (let c = 1; c < N; c++) s.grid[c] = 3;
    s.grid[N * 5] = 2;
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.lineCount).toBe(1);
    expect(res.gained).toBe(10 + 100 * 2);
    expect(res.state.combo).toBe(2);
    expect(res.state.grid.slice(0, N).every((v) => v < 0)).toBe(true);
    expect(res.perfect).toBe(false);
  });

  it('scores multi-line clears as 50·n·(n+1) and awards a board clear', () => {
    const s = blank([single(), single(), single()]);
    for (let i = 0; i < N - 1; i++) {
      s.grid[cellIndex(7, i)] = 1;
      s.grid[cellIndex(i, 7)] = 1;
    }
    const res = placePiece(s, 0, 7, 7, seeded())!;
    expect(res.circuit).toEqual([]);
    expect(res.lineCount).toBe(2);
    expect(res.perfect).toBe(true);
    expect(res.gained).toBe(10 + 300 + 3000);
  });

  it('detonates a core in a cleared row across its column, and chains', () => {
    const s = blank([single(), single(), single()]);
    for (let c = 1; c < N; c++) s.grid[c] = 0;
    s.cores[3] = 'line';
    for (let r = 1; r < 7; r++) s.grid[r * N + 3] = 5;
    s.cores[6 * N + 3] = 'line';
    s.grid[6 * N + 7] = 2;
    s.grid[7 * N + 0] = 2;
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.surges).toEqual([
      { idx: 3, kind: 'line' },
      { idx: 6 * N + 3, kind: 'line' },
    ]);
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

  it('ends the game when nothing fits in any rotation', () => {
    const s = blank([single(), bar(5), null]);
    for (let i = 0; i < N * N; i++) s.grid[i] = ((i % N) + Math.floor(i / N)) % 2 === 0 ? -1 : 1;
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.state.over).toBe(true);
  });
});

describe('spinPiece', () => {
  it('rotates as often as you like', () => {
    let s = blank([bar(3), single(), single()]);
    for (let turn = 1; turn <= 10; turn++) {
      s = spinPiece(s, 0)!;
      expect(s.tray[0]!.h).toBe(turn % 2 ? 3 : 1);
    }
    expect(s.score).toBe(0);
  });

  it('does nothing for an empty socket or a finished game', () => {
    expect(spinPiece(blank([null, single(), single()]), 0)).toBeNull();
    expect(spinPiece(blank([bar(3), null, null], { over: true }), 0)).toBeNull();
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

describe('isGameState', () => {
  const valid = () => newGame(0, seeded(7));
  const tweak = (fn: (s: Record<string, unknown>) => void) => {
    const s = JSON.parse(JSON.stringify(valid()));
    fn(s);
    return s;
  };

  it('accepts every state reached in play', () => {
    const rand = seeded(11);
    let s = valid();
    for (let move = 0; move < 300; move++) {
      if (s.over) s = newGame(s.best, rand);
      const options: [number, number, number][] = [];
      s.tray.forEach((p, i) => {
        if (!p) return;
        for (let r = 0; r <= N - p.h; r++)
          for (let c = 0; c <= N - p.w; c++) if (fits(s.grid, p, r, c)) options.push([i, r, c]);
      });
      if (!options.length) {
        const i = s.tray.findIndex((p) => p);
        s = spinPiece(s, i) ?? newGame(s.best, rand);
      } else {
        const [i, r, c] = options[Math.floor(rand() * options.length)];
        s = placePiece(s, i, r, c, rand)!.state;
      }
      expect(isGameState(JSON.parse(JSON.stringify(s)))).toBe(true);
    }
  });

  it('rejects corrupt saves', () => {
    expect(isGameState(null)).toBe(false);
    expect(isGameState('{}')).toBe(false);
    expect(isGameState(tweak((s) => delete s.combo))).toBe(false);
    expect(isGameState(tweak((s) => (s.score = 'NaN')))).toBe(false);
    expect(isGameState(tweak((s) => ((s.grid as number[])[0] = 99)))).toBe(false);
    expect(isGameState(tweak((s) => ((s.tray as Piece[])[0].cells = [1, 2] as unknown as Piece['cells'])))).toBe(false);
    expect(isGameState(tweak((s) => ((s.tray as Piece[])[0].cells = [[9, 9]])))).toBe(false);
    expect(isGameState(tweak((s) => ((s.tray as Piece[])[0].core = 99)))).toBe(false);
    expect(isGameState(tweak((s) => (s.tray as unknown[]).pop()))).toBe(false);
    expect(isGameState(tweak((s) => ((s.cores as unknown[])[0] = true)))).toBe(false);
    expect(isGameState(tweak((s) => delete s.terminals))).toBe(false);
    expect(isGameState(tweak((s) => (s.buffer = { w: 1 })))).toBe(false);
    expect(isGameState(tweak((s) => delete s.stashed))).toBe(false);
    expect(isGameState(tweak((s) => (s.terminals = { row: 9, col: 3 })))).toBe(false);
    expect(isGameState(tweak((s) => ((s.tray as Piece[])[0].coreKind = 'huge' as Piece['coreKind'])))).toBe(false);
  });
});

describe('saves from the charge era', () => {
  it('still load, ignoring the old charge count', () => {
    expect(isGameState({ ...newGame(0, seeded(3)), charge: 2 })).toBe(true);
  });
});

describe('combo', () => {
  it('survives two moves without a clear, and a clear resets the idle count', () => {
    const s = blank([single(), single(), single()], { combo: 3, idle: 0 });
    const one = placePiece(s, 0, 4, 4, seeded())!.state;
    const two = placePiece(one, 1, 4, 6, seeded())!.state;
    expect([one.combo, two.combo, two.idle]).toEqual([3, 3, 2]);
    for (let c = 1; c < N; c++) two.grid[cellIndex(7, c)] = 1;
    const res = placePiece(two, 2, 7, 0, seeded())!;
    expect(res.state.combo).toBe(4);
    expect(res.state.idle).toBe(0);
    expect(res.gained).toBe(10 + 100 * 4);
  });
});

describe('cores', () => {
  it('detonates a core in a cleared column across its row', () => {
    const s = blank([single(), single(), single()]);
    for (let r = 1; r < N; r++) s.grid[cellIndex(r, 2)] = 0;
    s.cores[cellIndex(4, 2)] = 'line';
    s.grid[cellIndex(4, 6)] = 3;
    s.grid[cellIndex(5, 6)] = 3;
    const res = placePiece(s, 0, 0, 2, seeded())!;
    expect(res.surges).toEqual([{ idx: cellIndex(4, 2), kind: 'line' }]);
    expect(res.state.grid[cellIndex(4, 6)]).toBe(-1);
    expect(res.state.grid[cellIndex(5, 6)]).toBe(3);
    expect(res.gained).toBe(10 + 100 + 40);
  });
});

describe('dealing', () => {
  it('does not deal while parts remain', () => {
    const s = blank([single(), bar(2), null]);
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.dealt).toBe(false);
    expect(res.state.tray).toEqual([null, s.tray[1], null]);
  });

  it('always deals a set with a part that fits', () => {
    const grid = onlyOpen([[3, 3]]);
    for (let seed = 1; seed <= 25; seed++) {
      const tray = newTray(grid, seeded(seed));
      expect(tray.some((p) => turnsToFit(grid, p) >= 0)).toBe(true);
    }
  });
});

describe('turnsToFit and game over', () => {
  it('counts the rotations a part needs to fit', () => {
    const grid = onlyOpen(column3);
    expect(turnsToFit(grid, rotate(bar(3)))).toBe(0);
    expect(turnsToFit(grid, bar(3))).toBe(1);
    expect(turnsToFit(grid, bar(4))).toBe(-1);
  });

  it('is not over while some rotation makes a part fit', () => {
    const s = blank([bar(3), null, null], { grid: onlyOpen(column3) });
    expect(anyMove(s)).toBe(true);
    expect(anyMove({ ...s, tray: [bar(4), null, null] })).toBe(false);
  });

  it('never ends the game by rotating', () => {
    const s = blank([rotate(bar(3)), null, null], { grid: onlyOpen(column3) });
    const next = spinPiece(s, 0)!;
    expect(next.over).toBe(false);
    expect(anyMove(next)).toBe(true);
  });
});

describe('area cores', () => {
  const rowZeroBut = (open: number) => {
    const s = blank([single(), single(), single()]);
    for (let c = 0; c < N; c++) if (c !== open) s.grid[cellIndex(0, c)] = 1;
    return s;
  };

  it('blast the 3×3 square around them when their line clears', () => {
    const s = rowZeroBut(0);
    s.cores[cellIndex(0, 4)] = 'area';
    [
      [1, 3],
      [1, 4],
      [1, 5],
      [2, 4],
      [1, 6],
    ].forEach(([r, c]) => (s.grid[cellIndex(r, c)] = 2));
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.surges).toEqual([{ idx: cellIndex(0, 4), kind: 'area' }]);
    expect([cellIndex(1, 3), cellIndex(1, 4), cellIndex(1, 5)].map((k) => res.state.grid[k])).toEqual([-1, -1, -1]);
    expect(res.state.grid[cellIndex(2, 4)]).toBe(2);
    expect(res.state.grid[cellIndex(1, 6)]).toBe(2);
    expect(res.gained).toBe(10 + 100 + 3 * 40);
  });

  it('chain into line cores and vice versa', () => {
    const s = rowZeroBut(0);
    s.cores[cellIndex(0, 4)] = 'area';
    s.grid[cellIndex(1, 5)] = 3;
    s.cores[cellIndex(1, 5)] = 'line';
    s.grid[cellIndex(1, 0)] = 3;
    s.grid[cellIndex(6, 5)] = 3;
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.surges.map((x) => x.kind)).toEqual(['area', 'line']);
    expect(res.state.grid[cellIndex(1, 0)]).toBe(-1);
    expect(res.state.grid[cellIndex(6, 5)]).toBe(-1);
    expect(res.state.cores.every((k) => k === null)).toBe(true);
  });

  it('can be placed as part of a piece and clamp at the board edge', () => {
    const s = rowZeroBut(0);
    s.tray[0] = { ...single(), core: 0, coreKind: 'area' };
    s.grid[cellIndex(1, 0)] = 4;
    s.grid[cellIndex(1, 1)] = 4;
    s.grid[cellIndex(1, 2)] = 4;
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.surges).toEqual([{ idx: cellIndex(0, 0), kind: 'area' }]);
    expect(res.state.grid[cellIndex(1, 0)]).toBe(-1);
    expect(res.state.grid[cellIndex(1, 1)]).toBe(-1);
    expect(res.state.grid[cellIndex(1, 2)]).toBe(4);
  });

  it('cover 9 cells in the middle and 4 in a corner', () => {
    expect(new Set(blastCells(cellIndex(3, 3), 'area')).size).toBe(9);
    expect(new Set(blastCells(cellIndex(0, 0), 'area')).size).toBe(4);
    expect(new Set(blastCells(cellIndex(3, 3), 'line')).size).toBe(2 * N - 1);
  });

  it('are dealt alongside line cores', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      newTray(Array(N * N).fill(-1), seeded(seed)).forEach((p) => p.core >= 0 && kinds.add(p.coreKind));
    }
    expect([...kinds].sort()).toEqual(['area', 'line']);
  });
});

describe('circuits', () => {
  const terminals = { row: 4, col: 3 };
  const route: [number, number][] = [
    [4, 0],
    [3, 0],
    [2, 0],
    [1, 0],
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ];
  const wired = (skip = -1) => {
    const s = blank([single(), single(), single()], { terminals });
    route.forEach(([r, c], k) => k !== skip && (s.grid[cellIndex(r, c)] = 2));
    s.grid[cellIndex(6, 6)] = 4;
    return s;
  };

  it('finds the shortest chain of filled squares between the terminals', () => {
    const s = wired();
    s.grid[cellIndex(1, 1)] = 2;
    expect(circuitPath(s.grid, terminals)).toEqual(route.map(([r, c]) => cellIndex(r, c)));
  });

  it('needs an unbroken chain touching both terminals', () => {
    expect(circuitPath(wired(2).grid, terminals)).toBeNull();
    expect(circuitPath(wired(0).grid, terminals)).toBeNull();
    expect(circuitPath(wired(7).grid, terminals)).toBeNull();
  });

  it('clears the path, scores 50 per square, counts as a clear and moves the terminals', () => {
    const s = wired(2);
    const res = placePiece(s, 0, 2, 0, seeded())!;
    expect(res.circuit).toHaveLength(route.length);
    expect(route.every(([r, c]) => res.state.grid[cellIndex(r, c)] === -1)).toBe(true);
    expect(res.gained).toBe(10 + route.length * 50);
    expect(res.state.combo).toBe(1);
    expect(res.state.terminals).not.toEqual(terminals);
    expect(circuitPath(res.state.grid, res.state.terminals)).toBeNull();
  });

  it('detonates cores on the path', () => {
    const s = wired(2);
    s.cores[cellIndex(0, 1)] = 'area';
    s.grid[cellIndex(1, 2)] = 5;
    const res = placePiece(s, 0, 2, 0, seeded())!;
    expect(res.surges).toEqual([{ idx: cellIndex(0, 1), kind: 'area' }]);
    expect(res.state.grid[cellIndex(1, 2)]).toBe(-1);
    expect(res.gained).toBe(10 + route.length * 50 + 40);
  });

  it('adds the circuit to line clears in the same move', () => {
    const s = wired(2);
    for (let c = 1; c < N; c++) s.grid[cellIndex(2, c)] = 1;
    const res = placePiece(s, 0, 2, 0, seeded())!;
    expect(res.lineCount).toBe(1);
    expect(res.gained).toBe(10 + 100 + route.length * 50);
  });

  it('never deals terminals that are already connected', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const g = newGame(0, seeded(seed));
      expect(circuitPath(g.grid, g.terminals)).toBeNull();
      expect(g.terminals.row).toBeGreaterThanOrEqual(3);
      expect(g.terminals.col).toBeGreaterThanOrEqual(3);
    }
    const s = wired();
    expect(circuitPath(s.grid, pickTerminals(s.grid, seeded(5)))).toBeNull();
  });
});

describe('buffer', () => {
  it('stores a part, once per set', () => {
    const s = blank([single(), bar(2), bar(3)]);
    const next = stashPiece(s, 1, seeded())!;
    expect(next.buffer).toEqual(bar(2));
    expect(next.tray).toEqual([single(), null, bar(3)]);
    expect(next.stashed).toBe(true);
    expect(stashPiece(next, 0, seeded())).toBeNull();
  });

  it('swaps with a part already stored', () => {
    const s = blank([single(), bar(2), bar(3)], { buffer: bar(4) });
    const next = stashPiece(s, 2, seeded())!;
    expect(next.buffer).toEqual(bar(3));
    expect(next.tray[2]).toEqual(bar(4));
  });

  it('deals a new set when the last part is stored, which resets the limit', () => {
    const s = blank([null, null, bar(3)]);
    const next = stashPiece(s, 2, seeded())!;
    expect(next.buffer).toEqual(bar(3));
    expect(next.tray.every((p) => p !== null)).toBe(true);
    expect(next.stashed).toBe(false);
  });

  it('places from the buffer without dealing or resetting the limit', () => {
    const s = blank([single(), null, null], { buffer: bar(2), stashed: true });
    const res = placePiece(s, BUFFER, 4, 4, seeded())!;
    expect(res.state.buffer).toBeNull();
    expect(res.state.tray).toEqual([single(), null, null]);
    expect(res.dealt).toBe(false);
    expect(res.state.stashed).toBe(true);
  });

  it('resets the limit when a new set is dealt', () => {
    const s = blank([single(), null, null], { buffer: bar(2), stashed: true });
    const res = placePiece(s, 0, 4, 4, seeded())!;
    expect(res.dealt).toBe(true);
    expect(res.state.stashed).toBe(false);
    expect(res.state.buffer).toEqual(bar(2));
  });

  it('rotates the stored part', () => {
    const s = blank([single(), null, null], { buffer: bar(3) });
    expect(spinPiece(s, BUFFER)!.buffer!.h).toBe(3);
  });

  it('keeps the game going while the stored part fits', () => {
    const grid = onlyOpen([[2, 2]]);
    const s = blank([bar(2), null, null], { grid, buffer: single() });
    expect(anyMove(s)).toBe(true);
    expect(anyMove({ ...s, buffer: null })).toBe(false);
  });
});
