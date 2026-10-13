export const N = 8;
export const MAX_CHARGE = 5;
export const START_CHARGE = 3;
export const CORE_CHANCE = 0.4;
export const PTS = { cell: 10, line: 100, core: 40, perfect: 3000 };
export const COLORS = ['#ff4d5e', '#ffa62b', '#ffe14d', '#4da3ff', '#3fe0ff', '#ff5fd2', '#eef3ff'];

export type Rand = () => number;
export type Cell = [number, number];

export interface Piece {
  w: number;
  h: number;
  cells: Cell[];
  c: number;
  core: number;
}

export interface GameState {
  grid: number[];
  cores: boolean[];
  tray: (Piece | null)[];
  score: number;
  best: number;
  combo: number;
  idle: number;
  charge: number;
  over: boolean;
}

export interface Lines {
  rows: number[];
  cols: number[];
}

export interface PlaceResult {
  state: GameState;
  gained: number;
  lines: Lines;
  lineCount: number;
  lineSet: Set<number>;
  cleared: { idx: number; color: number }[];
  surges: number[];
  perfect: boolean;
  dealt: boolean;
  center: { r: number; c: number };
}

const DEFS: [number, string[]][] = [
  [0.35, ['#']],
  [1, ['##']], [1, ['#', '#']],
  [1, ['###']], [1, ['#', '#', '#']],
  [0.9, ['####']], [0.9, ['#', '#', '#', '#']],
  [0.55, ['#####']], [0.55, ['#', '#', '#', '#', '#']],
  [1.2, ['##', '##']],
  [0.45, ['###', '###', '###']],
  [0.75, ['###', '###']], [0.75, ['##', '##', '##']],
  [0.8, ['##', '#.']], [0.8, ['##', '.#']], [0.8, ['#.', '##']], [0.8, ['.#', '##']],
  [0.45, ['###', '#..', '#..']], [0.45, ['###', '..#', '..#']], [0.45, ['#..', '#..', '###']], [0.45, ['..#', '..#', '###']],
  [0.6, ['#.', '#.', '##']], [0.6, ['.#', '.#', '##']], [0.6, ['##', '#.', '#.']], [0.6, ['##', '.#', '.#']],
  [0.6, ['###', '#..']], [0.6, ['###', '..#']], [0.6, ['#..', '###']], [0.6, ['..#', '###']],
  [0.6, ['###', '.#.']], [0.6, ['.#.', '###']], [0.6, ['#.', '##', '#.']], [0.6, ['.#', '##', '.#']],
  [0.5, ['##.', '.##']], [0.5, ['.##', '##.']], [0.5, ['#.', '##', '.#']], [0.5, ['.#', '##', '#.']],
  [0.25, ['#.', '.#']], [0.25, ['.#', '#.']],
];

export const SHAPES = DEFS.map(([weight, rows]) => {
  const cells: Cell[] = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
  return { w: rows[0].length, h: rows.length, cells, weight };
});
const TOTAL = SHAPES.reduce((a, s) => a + s.weight, 0);

function pickShape(rand: Rand) {
  let x = rand() * TOTAL;
  for (let i = 0; i < SHAPES.length; i++) {
    x -= SHAPES[i].weight;
    if (x <= 0) return i;
  }
  return 0;
}

function shuffle<T>(a: T[], rand: Rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makePiece(shape: number, color: number): Piece {
  const s = SHAPES[shape];
  return { w: s.w, h: s.h, cells: s.cells.map(([r, c]) => [r, c]), c: color, core: -1 };
}

export function rotate(p: Piece): Piece {
  return { ...p, w: p.h, h: p.w, cells: p.cells.map(([r, c]) => [c, p.h - 1 - r]) };
}

export function fits(grid: number[], p: Piece, r: number, c: number) {
  if (r < 0 || c < 0 || r + p.h > N || c + p.w > N) return false;
  return p.cells.every(([dr, dc]) => grid[(r + dr) * N + c + dc] < 0);
}

export function canPlace(grid: number[], p: Piece) {
  for (let r = 0; r <= N - p.h; r++) for (let c = 0; c <= N - p.w; c++) if (fits(grid, p, r, c)) return true;
  return false;
}

export function turnsToFit(grid: number[], p: Piece, maxTurns: number) {
  let q = p;
  for (let k = 0; k <= Math.min(3, maxTurns); k++) {
    if (canPlace(grid, q)) return k;
    q = rotate(q);
  }
  return -1;
}

export function anyMove(s: GameState) {
  return s.tray.some((p) => p !== null && turnsToFit(s.grid, p, s.charge) >= 0);
}

export function fullLines(grid: number[]): Lines {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < N; i++) {
    let row = true;
    let col = true;
    for (let j = 0; j < N; j++) {
      if (grid[i * N + j] < 0) row = false;
      if (grid[j * N + i] < 0) col = false;
    }
    if (row) rows.push(i);
    if (col) cols.push(i);
  }
  return { rows, cols };
}

export function lineCells({ rows, cols }: Lines) {
  const set = new Set<number>();
  rows.forEach((r) => { for (let c = 0; c < N; c++) set.add(r * N + c); });
  cols.forEach((c) => { for (let r = 0; r < N; r++) set.add(r * N + c); });
  return set;
}

export function newTray(grid: number[], charge: number, rand: Rand = Math.random): Piece[] {
  for (let t = 0; t < 40; t++) {
    const colors = shuffle([0, 1, 2, 3, 4, 5, 6], rand);
    const tray = [0, 1, 2].map((i) => makePiece(pickShape(rand), colors[i]));
    if (rand() < CORE_CHANCE) {
      const options = tray.filter((p) => p.cells.length > 1);
      if (options.length) {
        const p = options[Math.floor(rand() * options.length)];
        p.core = Math.floor(rand() * p.cells.length);
      }
    }
    if (tray.some((p) => turnsToFit(grid, p, charge) >= 0)) return tray;
  }
  return [0, 1, 2].map((i) => makePiece(0, i));
}

function seed(rand: Rand) {
  let grid: number[] = Array(N * N).fill(-1);
  let placed = 0;
  for (let tries = 0; tries < 200 && placed < 4; tries++) {
    const p = makePiece(pickShape(rand), Math.floor(rand() * COLORS.length));
    if (p.cells.length > 5) continue;
    const r = Math.floor(rand() * (N - p.h + 1));
    const c = Math.floor(rand() * (N - p.w + 1));
    if (!fits(grid, p, r, c)) continue;
    const g = grid.slice();
    p.cells.forEach(([dr, dc]) => { g[(r + dr) * N + c + dc] = p.c; });
    const lines = fullLines(g);
    if (lines.rows.length || lines.cols.length) continue;
    grid = g;
    placed++;
  }
  return grid;
}

export function newGame(best: number, rand: Rand = Math.random): GameState {
  const grid = seed(rand);
  return {
    grid,
    cores: Array(N * N).fill(false),
    tray: newTray(grid, START_CHARGE, rand),
    score: 0,
    best,
    combo: 0,
    idle: 0,
    charge: START_CHARGE,
    over: false,
  };
}

export function spinPiece(s: GameState, i: number): GameState | null {
  const p = s.tray[i];
  if (s.over || !p || s.charge < 1) return null;
  const tray = s.tray.slice();
  tray[i] = rotate(p);
  const next = { ...s, tray, charge: s.charge - 1 };
  return { ...next, over: !anyMove(next) };
}

export function placePiece(s: GameState, i: number, r: number, c: number, rand: Rand = Math.random): PlaceResult | null {
  const p = s.tray[i];
  if (s.over || !p || !fits(s.grid, p, r, c)) return null;

  const grid = s.grid.slice();
  const cores = s.cores.slice();
  p.cells.forEach(([dr, dc], k) => {
    const idx = (r + dr) * N + c + dc;
    grid[idx] = p.c;
    if (k === p.core) cores[idx] = true;
  });

  let gained = p.cells.length * PTS.cell;
  let { combo, idle, charge } = s;
  const lines = fullLines(grid);
  const lineCount = lines.rows.length + lines.cols.length;
  const lineSet = lineCells(lines);
  const surges: number[] = [];
  const cleared: { idx: number; color: number }[] = [];
  let perfect = false;

  if (lineCount) {
    const hit = new Set(lineSet);
    const seen = new Set<number>();
    const queue = [...hit].filter((k) => cores[k]);
    while (queue.length) {
      const k = queue.shift()!;
      if (seen.has(k)) continue;
      seen.add(k);
      surges.push(k);
      const kr = Math.floor(k / N);
      const kc = k % N;
      for (let j = 0; j < N; j++) {
        for (const x of [kr * N + j, j * N + kc]) {
          if (grid[x] < 0 || hit.has(x)) continue;
          hit.add(x);
          if (cores[x]) queue.push(x);
        }
      }
    }
    const extra = hit.size - lineSet.size;
    combo += 1;
    idle = 0;
    charge = Math.min(MAX_CHARGE, charge + 1);
    gained += (PTS.line * lineCount * (lineCount + 1) / 2) * combo + extra * PTS.core;
    hit.forEach((k) => {
      cleared.push({ idx: k, color: grid[k] });
      grid[k] = -1;
      cores[k] = false;
    });
    perfect = grid.every((v) => v < 0);
    if (perfect) gained += PTS.perfect;
  } else {
    idle += 1;
    if (idle >= 3) combo = 0;
  }

  let tray = s.tray.slice();
  tray[i] = null;
  const dealt = tray.every((x) => !x);
  if (dealt) tray = newTray(grid, charge, rand);

  const score = s.score + gained;
  const next: GameState = { grid, cores, tray, score, best: Math.max(s.best, score), combo, idle, charge, over: false };
  next.over = !anyMove(next);

  return {
    state: next,
    gained,
    lines,
    lineCount,
    lineSet,
    cleared,
    surges,
    perfect,
    dealt,
    center: { r: r + p.h / 2, c: c + p.w / 2 },
  };
}

export function previewCells(s: GameState, p: Piece, r: number, c: number) {
  const g = s.grid.slice();
  const ghost: number[] = [];
  p.cells.forEach(([dr, dc]) => {
    const i = (r + dr) * N + c + dc;
    g[i] = p.c;
    ghost.push(i);
  });
  return { ghost, hint: [...lineCells(fullLines(g))] };
}

export function isGameState(x: unknown): x is GameState {
  const g = x as GameState;
  return !!g && Array.isArray(g.grid) && g.grid.length === N * N
    && Array.isArray(g.cores) && g.cores.length === N * N
    && Array.isArray(g.tray) && g.tray.length === 3
    && g.tray.every((p) => p === null || Array.isArray(p.cells))
    && typeof g.score === 'number' && typeof g.charge === 'number';
}

export const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
