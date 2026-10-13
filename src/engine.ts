export const N = 8;
export const TRAY_SIZE = 3;
export const COLOR_COUNT = 7;
export const CORE_CHANCE = 0.4;
export const PTS = { cell: 10, line: 100, core: 40, perfect: 3000 };

export type Rand = () => number;

export const cellIndex = (r: number, c: number) => r * N + c;
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
  [1, ['##']],
  [1, ['#', '#']],
  [1, ['###']],
  [1, ['#', '#', '#']],
  [0.9, ['####']],
  [0.9, ['#', '#', '#', '#']],
  [0.55, ['#####']],
  [0.55, ['#', '#', '#', '#', '#']],
  [1.2, ['##', '##']],
  [0.45, ['###', '###', '###']],
  [0.75, ['###', '###']],
  [0.75, ['##', '##', '##']],
  [0.8, ['##', '#.']],
  [0.8, ['##', '.#']],
  [0.8, ['#.', '##']],
  [0.8, ['.#', '##']],
  [0.45, ['###', '#..', '#..']],
  [0.45, ['###', '..#', '..#']],
  [0.45, ['#..', '#..', '###']],
  [0.45, ['..#', '..#', '###']],
  [0.6, ['#.', '#.', '##']],
  [0.6, ['.#', '.#', '##']],
  [0.6, ['##', '#.', '#.']],
  [0.6, ['##', '.#', '.#']],
  [0.6, ['###', '#..']],
  [0.6, ['###', '..#']],
  [0.6, ['#..', '###']],
  [0.6, ['..#', '###']],
  [0.6, ['###', '.#.']],
  [0.6, ['.#.', '###']],
  [0.6, ['#.', '##', '#.']],
  [0.6, ['.#', '##', '.#']],
  [0.5, ['##.', '.##']],
  [0.5, ['.##', '##.']],
  [0.5, ['#.', '##', '.#']],
  [0.5, ['.#', '##', '#.']],
  [0.25, ['#.', '.#']],
  [0.25, ['.#', '#.']],
];

export const SHAPES = DEFS.map(([weight, rows]) => {
  const cells: Cell[] = [];
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === '#') cells.push([r, c]);
    }),
  );
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
  return p.cells.every(([dr, dc]) => grid[cellIndex(r + dr, c + dc)] < 0);
}

export function canPlace(grid: number[], p: Piece) {
  for (let r = 0; r <= N - p.h; r++) for (let c = 0; c <= N - p.w; c++) if (fits(grid, p, r, c)) return true;
  return false;
}

export function turnsToFit(grid: number[], p: Piece) {
  let q = p;
  for (let k = 0; k < 4; k++) {
    if (canPlace(grid, q)) return k;
    q = rotate(q);
  }
  return -1;
}

export function anyMove(s: GameState) {
  return s.tray.some((p) => p !== null && turnsToFit(s.grid, p) >= 0);
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
  rows.forEach((r) => {
    for (let c = 0; c < N; c++) set.add(r * N + c);
  });
  cols.forEach((c) => {
    for (let r = 0; r < N; r++) set.add(r * N + c);
  });
  return set;
}

export function newTray(grid: number[], rand: Rand = Math.random): Piece[] {
  for (let t = 0; t < 40; t++) {
    const colors = shuffle(
      Array.from({ length: COLOR_COUNT }, (_, k) => k),
      rand,
    );
    const tray = Array.from({ length: TRAY_SIZE }, (_, i) => makePiece(pickShape(rand), colors[i]));
    if (rand() < CORE_CHANCE) {
      const options = tray.filter((p) => p.cells.length > 1);
      if (options.length) {
        const p = options[Math.floor(rand() * options.length)];
        p.core = Math.floor(rand() * p.cells.length);
      }
    }
    if (tray.some((p) => turnsToFit(grid, p) >= 0)) return tray;
  }
  return Array.from({ length: TRAY_SIZE }, (_, i) => makePiece(0, i));
}

function seed(rand: Rand) {
  let grid: number[] = Array(N * N).fill(-1);
  let placed = 0;
  for (let tries = 0; tries < 200 && placed < 4; tries++) {
    const p = makePiece(pickShape(rand), Math.floor(rand() * COLOR_COUNT));
    if (p.cells.length > 5) continue;
    const r = Math.floor(rand() * (N - p.h + 1));
    const c = Math.floor(rand() * (N - p.w + 1));
    if (!fits(grid, p, r, c)) continue;
    const g = grid.slice();
    p.cells.forEach(([dr, dc]) => {
      g[cellIndex(r + dr, c + dc)] = p.c;
    });
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
    tray: newTray(grid, rand),
    score: 0,
    best,
    combo: 0,
    idle: 0,
    over: false,
  };
}

export function spinPiece(s: GameState, i: number): GameState | null {
  const p = s.tray[i];
  if (s.over || !p) return null;
  const tray = s.tray.slice();
  tray[i] = rotate(p);
  return { ...s, tray };
}

export function placePiece(
  s: GameState,
  i: number,
  r: number,
  c: number,
  rand: Rand = Math.random,
): PlaceResult | null {
  const p = s.tray[i];
  if (s.over || !p || !fits(s.grid, p, r, c)) return null;

  const grid = s.grid.slice();
  const cores = s.cores.slice();
  p.cells.forEach(([dr, dc], k) => {
    const idx = cellIndex(r + dr, c + dc);
    grid[idx] = p.c;
    if (k === p.core) cores[idx] = true;
  });

  let gained = p.cells.length * PTS.cell;
  let { combo, idle } = s;
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
    gained += ((PTS.line * lineCount * (lineCount + 1)) / 2) * combo + extra * PTS.core;
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
  if (dealt) tray = newTray(grid, rand);

  const score = s.score + gained;
  const next: GameState = { grid, cores, tray, score, best: Math.max(s.best, score), combo, idle, over: false };
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
  const ghost = p.cells.map(([dr, dc]) => cellIndex(r + dr, c + dc));
  ghost.forEach((i) => {
    g[i] = p.c;
  });
  return { ghost, hint: [...lineCells(fullLines(g))], core: p.core >= 0 ? ghost[p.core] : -1 };
}

const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

function isPiece(x: unknown): x is Piece {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  if (!isInt(p.w, 1, N) || !isInt(p.h, 1, N) || !isInt(p.c, 0, COLOR_COUNT - 1)) return false;
  const { w, h, cells } = p;
  if (!Array.isArray(cells) || !cells.length) return false;
  const ok = cells.every((cell) => Array.isArray(cell) && isInt(cell[0], 0, h - 1) && isInt(cell[1], 0, w - 1));
  return ok && isInt(p.core, -1, cells.length - 1);
}

export function isGameState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false;
  const g = x as Record<string, unknown>;
  const { grid, cores, tray } = g;
  return (
    Array.isArray(grid) &&
    grid.length === N * N &&
    grid.every((v) => isInt(v, -1, COLOR_COUNT - 1)) &&
    Array.isArray(cores) &&
    cores.length === N * N &&
    cores.every((v) => typeof v === 'boolean') &&
    Array.isArray(tray) &&
    tray.length === TRAY_SIZE &&
    tray.every((p) => p === null || isPiece(p)) &&
    isInt(g.score, 0, Number.MAX_SAFE_INTEGER) &&
    isInt(g.best, 0, Number.MAX_SAFE_INTEGER) &&
    isInt(g.combo, 0, Number.MAX_SAFE_INTEGER) &&
    isInt(g.idle, 0, Number.MAX_SAFE_INTEGER) &&
    typeof g.over === 'boolean'
  );
}
