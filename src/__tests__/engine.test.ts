import { describe, expect, it } from '@jest/globals';

import {
  anyMove,
  blastCells,
  cellIndex,
  circuitPath,
  COLOR_COUNT,
  difficulty,
  fits,
  fullLines,
  isGameState,
  makePiece,
  MIN_CIRCUIT,
  minCircuit,
  N,
  newGame,
  newTray,
  pickTerminals,
  placePiece,
  RAMP,
  portCell,
  repairGame,
  rotate,
  SHAPES,
  shortestCircuit,
  SIDES,
  spinPiece,
  turnsToFit,
  type GameState,
  type Piece,
  type PlaceResult,
  type Terminals,
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
    terminals: { plus: { side: 'left', at: 3 }, minus: { side: 'top', at: 3 } },
    tray,
    score: 0,
    best: 0,
    combo: 0,
    idle: 0,
    over: false,
    ...over,
  };
}

function randomPlay(seed: number, moves: number, check: (before: GameState, res: PlaceResult) => void) {
  const rand = seeded(seed);
  let s = newGame(0, rand);
  for (let move = 0; move < moves; move++) {
    if (s.over) s = newGame(s.best, rand);
    const options: [number, number, number][] = [];
    s.tray.forEach((p, i) => {
      if (!p) return;
      for (let r = 0; r <= N - p.h; r++)
        for (let c = 0; c <= N - p.w; c++) if (fits(s.grid, p, r, c)) options.push([i, r, c]);
    });
    if (!options.length) {
      const left = s.tray.flatMap((p, i) => (p ? [i] : []));
      s = spinPiece(s, left[Math.floor(rand() * left.length)])!;
      continue;
    }
    const [i, r, c] = options[Math.floor(rand() * options.length)];
    const res = placePiece(s, i, r, c, rand)!;
    check(s, res);
    s = res.state;
  }
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

  it('refuses a part that overlaps or overhangs, an empty socket, and a finished game, without touching the state', () => {
    const s = blank([bar(3), null, single()]);
    s.grid[cellIndex(0, 2)] = 1;
    const before = JSON.stringify(s);
    expect(placePiece(s, 0, 0, 0)).toBeNull();
    expect(placePiece(s, 0, 0, 6)).toBeNull();
    expect(placePiece(s, 1, 4, 4)).toBeNull();
    expect(placePiece({ ...s, over: true }, 2, 4, 4)).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
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
    for (let seed = 1; seed <= 5; seed++) {
      const s = newGame(1234, seeded(seed));
      expect(isGameState(s)).toBe(true);
      expect(s.best).toBe(1234);
      expect(s.grid.some((v) => v >= 0)).toBe(true);
      expect(fullLines(s.grid)).toEqual({ rows: [], cols: [] });
      expect(s.tray).toHaveLength(3);
    }
  });
});

describe('isGameState', () => {
  const corrupt = (path: string, value: unknown) => {
    const s = JSON.parse(JSON.stringify(newGame(0, seeded(7))));
    const keys = path.split('.');
    const last = keys.pop()!;
    const parent = keys.reduce((o, k) => o[k], s);
    if (value === undefined) delete parent[last];
    else parent[last] = value;
    return s;
  };

  it('rejects anything that is not an object', () => {
    expect(isGameState(null)).toBe(false);
    expect(isGameState('{}')).toBe(false);
  });

  const part = (over: Partial<Record<keyof Piece, unknown>>) => ({ ...single(), ...over });

  it('accepts the sample save it corrupts below', () => {
    expect(isGameState(corrupt('tray.0', part({})))).toBe(true);
  });

  it.each([
    ['no combo', 'combo', undefined],
    ['a score that is not a number', 'score', 'NaN'],
    ['a negative peak', 'best', -1],
    ['a fractional idle count', 'idle', 1.5],
    ['no game-over flag', 'over', undefined],
    ['a short board', 'grid', Array(N * N - 1).fill(-1)],
    ['an unknown colour on the board', 'grid.0', 99],
    ['a short core list', 'cores', Array(N * N - 1).fill(null)],
    ['a core that is not a kind', 'cores.0', true],
    ['two sockets', 'tray', [null, null]],
    ['a part with no squares', 'tray.0', part({ cells: [] })],
    ['a part with flat squares', 'tray.0', part({ cells: [0, 0] })],
    ['a part with a square outside its box', 'tray.0', part({ cells: [[1, 0]] })],
    ['a part in an unknown colour', 'tray.0', part({ c: COLOR_COUNT })],
    ['a core past the end of its part', 'tray.0', part({ core: 1 })],
    ['an unknown core kind on a part', 'tray.0', part({ coreKind: 'huge' })],
    ['no terminals', 'terminals', undefined],
    ['a terminal off the end of an edge', 'terminals.plus.at', N],
    ['a terminal on an unknown side', 'terminals.plus.side', 'middle'],
    ['a power-out terminal with no position', 'terminals.minus', { side: 'top' }],
  ])('rejects a save with %s', (_, path, value) => {
    expect(isGameState(corrupt(path, value))).toBe(false);
  });
});

describe('random play', () => {
  it('keeps every move saveable, with the score, board, cores and terminals consistent', () => {
    randomPlay(5, 400, (before, res) => {
      const s = res.state;
      expect(isGameState(JSON.parse(JSON.stringify(s)))).toBe(true);
      expect(s.score).toBe(before.score + res.gained);
      expect(s.best).toBe(Math.max(before.best, s.score));
      expect(fullLines(s.grid)).toEqual({ rows: [], cols: [] });
      expect(circuitPath(s.grid, s.terminals)).toBeNull();
      expect(s.cores.every((kind, k) => !kind || s.grid[k] >= 0)).toBe(true);
      expect(res.cleared.every(({ idx }) => s.grid[idx] < 0)).toBe(true);
      expect(s.over).toBe(!anyMove(s));
    });
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

  it('multiplies only the line points by the combo, not the core blast', () => {
    const s = blank([single(), single(), single()], { combo: 1 });
    for (let r = 1; r < N; r++) s.grid[cellIndex(r, 2)] = 0;
    s.cores[cellIndex(4, 2)] = 'line';
    s.grid[cellIndex(4, 6)] = 3;
    s.grid[cellIndex(5, 6)] = 3;
    const res = placePiece(s, 0, 0, 2, seeded())!;
    expect(res.state.combo).toBe(2);
    expect(res.gained).toBe(10 + 100 * 2 + 40);
  });
});

describe('dealing', () => {
  it('does not deal while parts remain', () => {
    const s = blank([single(), bar(2), null]);
    const res = placePiece(s, 0, 0, 0, seeded())!;
    expect(res.dealt).toBe(false);
    expect(res.state.tray).toEqual([null, s.tray[1], null]);
  });

  it('only puts cores on parts of two or more squares', () => {
    const rand = seeded(9);
    const cored = Array.from({ length: 2000 }, () => newTray(Array(N * N).fill(-1), rand))
      .flat()
      .filter((p) => p.core >= 0);
    expect(cored.length).toBeGreaterThan(0);
    expect(cored.every((p) => p.cells.length > 1)).toBe(true);
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
  const terminals: Terminals = { plus: { side: 'left', at: 4 }, minus: { side: 'top', at: 3 } };
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

  it('takes the shorter route when a longer detour also connects', () => {
    const s = wired();
    [
      [4, 1],
      [4, 2],
      [4, 3],
      [4, 4],
      [3, 4],
      [2, 4],
      [1, 4],
      [0, 4],
    ].forEach(([r, c]) => (s.grid[cellIndex(r, c)] = 3));
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

  it('also clears every filled square touching the path, at 40 each', () => {
    const s = wired(2);
    s.grid[cellIndex(1, 1)] = 3;
    s.grid[cellIndex(5, 0)] = 3;
    const res = placePiece(s, 0, 2, 0, seeded())!;
    expect(res.state.grid[cellIndex(1, 1)]).toBe(-1);
    expect(res.state.grid[cellIndex(5, 0)]).toBe(-1);
    expect(res.state.grid[cellIndex(6, 6)]).toBe(4);
    expect(res.gained).toBe(10 + route.length * 50 + 2 * 40);
  });

  it('detonates cores on the path and around it', () => {
    const s = wired(2);
    s.cores[cellIndex(0, 1)] = 'line';
    s.grid[cellIndex(5, 1)] = 5;
    s.grid[cellIndex(5, 0)] = 3;
    s.cores[cellIndex(5, 0)] = 'area';
    s.grid[cellIndex(6, 2)] = 5;
    const res = placePiece(s, 0, 2, 0, seeded())!;
    expect(res.surges).toEqual(
      expect.arrayContaining([
        { idx: cellIndex(0, 1), kind: 'line' },
        { idx: cellIndex(5, 0), kind: 'area' },
      ]),
    );
    expect(res.state.grid[cellIndex(5, 1)]).toBe(-1);
    expect(res.state.grid[cellIndex(6, 2)]).toBe(5);
    expect(res.gained).toBe(10 + route.length * 50 + 2 * 40);
  });

  it('scores the path and the squares around it at face value whatever the combo', () => {
    const s = { ...wired(2), combo: 2 };
    s.grid[cellIndex(1, 1)] = 3;
    const res = placePiece(s, 0, 2, 0, seeded())!;
    expect(res.state.combo).toBe(3);
    expect(res.gained).toBe(10 + route.length * 50 + 40);
  });

  it('adds the circuit to line clears in the same move', () => {
    const s = wired(2);
    for (let c = 1; c < N; c++) s.grid[cellIndex(2, c)] = 1;
    const res = placePiece(s, 0, 2, 0, seeded())!;
    expect(res.lineCount).toBe(1);
    expect(res.gained).toBe(10 + 100 + route.length * 50);
  });

  it('never deals terminals that are already connected or closer than a 7-square circuit', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const g = newGame(0, seeded(seed));
      expect(circuitPath(g.grid, g.terminals)).toBeNull();
      expect(shortestCircuit(g.terminals)).toBeGreaterThanOrEqual(MIN_CIRCUIT);
    }
    const s = wired();
    expect(circuitPath(s.grid, pickTerminals(s.grid, seeded(5)))).toBeNull();
  });

  it('never picks a pair the board already connects', () => {
    const { grid } = wired();
    for (let k = 0; k < 1000; k++)
      expect(
        circuitPath(
          grid,
          pickTerminals(grid, () => k / 1000),
        ),
      ).toBeNull();
  });

  it('can deal either terminal beside any square on any edge', () => {
    const grid = Array<number>(N * N).fill(-1);
    const plus = new Set<string>();
    const minus = new Set<string>();
    for (let k = 0; k < 2000; k++) {
      const t = pickTerminals(grid, () => k / 2000);
      expect(shortestCircuit(t)).toBeGreaterThanOrEqual(MIN_CIRCUIT);
      plus.add(`${t.plus.side} ${t.plus.at}`);
      minus.add(`${t.minus.side} ${t.minus.at}`);
    }
    expect(plus.size).toBe(SIDES.length * N);
    expect(minus.size).toBe(SIDES.length * N);
  });

  it('connects terminals on the right and bottom edges', () => {
    const edges: Terminals = { plus: { side: 'right', at: 2 }, minus: { side: 'bottom', at: 4 } };
    const wire: [number, number][] = [
      [2, 7],
      [3, 7],
      [4, 7],
      [5, 7],
      [6, 7],
      [7, 7],
      [7, 6],
      [7, 5],
      [7, 4],
    ];
    const grid = Array<number>(N * N).fill(-1);
    wire.forEach(([r, c]) => (grid[cellIndex(r, c)] = 1));
    expect(portCell(edges.plus)).toBe(cellIndex(2, 7));
    expect(portCell(edges.minus)).toBe(cellIndex(7, 4));
    expect(shortestCircuit(edges)).toBe(wire.length);
    expect(circuitPath(grid, edges)).toEqual(wire.map(([r, c]) => cellIndex(r, c)));
  });

  it('moves both terminals to new spots after a circuit', () => {
    for (let k = 0; k < 30; k++) {
      const res = placePiece(wired(2), 0, 2, 0, () => (k + 0.5) / 30)!;
      expect(res.circuit).toHaveLength(route.length);
      expect(res.wired).toEqual(terminals);
      const ports = [res.state.terminals.plus, res.state.terminals.minus];
      expect(ports).not.toContainEqual(terminals.plus);
      expect(ports).not.toContainEqual(terminals.minus);
    }
  });
});

describe('repairGame', () => {
  it('moves terminals that are too close or already connected, and drops cores on empty squares', () => {
    const close = blank([single(), null, null], {
      terminals: { plus: { side: 'left', at: 0 }, minus: { side: 'top', at: 0 } },
    });
    close.cores[cellIndex(3, 3)] = 'line';
    const fixed = repairGame(close);
    expect(shortestCircuit(fixed.terminals)).toBeGreaterThanOrEqual(MIN_CIRCUIT);
    expect(fixed.cores[cellIndex(3, 3)]).toBeNull();

    const terminals: Terminals = { plus: { side: 'left', at: 0 }, minus: { side: 'left', at: 7 } };
    const connected = blank([single(), null, null], { terminals });
    for (let r = 0; r < N; r++) connected.grid[cellIndex(r, 0)] = 1;
    const moved = repairGame(connected);
    expect(circuitPath(moved.grid, moved.terminals)).toBeNull();
  });

  it('leaves a sound game unchanged', () => {
    const g = newGame(0, seeded(2));
    g.cores[g.grid.findIndex((v) => v >= 0)] = 'area';
    expect(repairGame(g)).toEqual(g);
  });
});

describe('difficulty ramp', () => {
  it('starts once the score passes the ramp and tops out at its end', () => {
    expect(difficulty(0)).toBe(0);
    expect(difficulty(RAMP.from)).toBe(0);
    expect(difficulty((RAMP.from + RAMP.to) / 2)).toBe(0.5);
    expect(difficulty(RAMP.to)).toBe(1);
    expect(difficulty(RAMP.to * 10)).toBe(1);
  });

  it('deals bigger parts and fewer cores at full difficulty', () => {
    const grid = Array<number>(N * N).fill(-1);
    const deal = (level: number) => {
      const rand = seeded(11);
      const parts = Array.from({ length: 400 }, () => newTray(grid, rand, level)).flat();
      return {
        cells: parts.reduce((a, p) => a + p.cells.length, 0) / parts.length,
        cores: parts.filter((p) => p.core >= 0).length,
      };
    };
    const easy = deal(0);
    const hard = deal(1);
    expect(hard.cells).toBeGreaterThan(easy.cells + 0.5);
    expect(hard.cores).toBeLessThan(easy.cores * 0.6);
  });

  it('deals the next set at the difficulty of the score just reached', () => {
    const cellsPerPart = (score: number) => {
      const rand = seeded(3);
      const parts = Array.from(
        { length: 300 },
        () => placePiece(blank([single(), null, null], { score }), 0, 7, 7, rand)!.state.tray,
      ).flat();
      return parts.reduce((a, p) => a + p!.cells.length, 0) / parts.length;
    };
    expect(cellsPerPart(RAMP.to)).toBeGreaterThan(cellsPerPart(0) + 0.3);
  });

  it('moves terminals farther apart after a circuit at a high score', () => {
    const terminals: Terminals = { plus: { side: 'left', at: 4 }, minus: { side: 'top', at: 3 } };
    const s = blank([single(), single(), single()], { terminals, score: RAMP.to });
    [
      [4, 0],
      [3, 0],
      [1, 0],
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ].forEach(([r, c]) => (s.grid[cellIndex(r, c)] = 2));
    for (let seed = 1; seed <= 20; seed++) {
      const res = placePiece(s, 0, 2, 0, seeded(seed))!;
      expect(res.circuit.length).toBeGreaterThan(0);
      expect(shortestCircuit(res.state.terminals)).toBeGreaterThanOrEqual(minCircuit(1));
    }
  });
});
