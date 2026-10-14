export const N = 8;
export const TRAY_SIZE = 3;
export const BUFFER = TRAY_SIZE;
export const SOURCES = TRAY_SIZE + 1;
export const COLOR_COUNT = 7;
export const CORE_CHANCE = 0.4;
export const AREA_CHANCE = 0.5;
export const PTS = { cell: 10, line: 100, core: 40, circuit: 50, perfect: 3000 };
export const MIN_CIRCUIT = 7;

export type Rand = () => number;

export const cellIndex = (r: number, c: number) => r * N + c;
export type Cell = [number, number];
export type CoreKind = 'line' | 'area';

export interface Piece {
  w: number;
  h: number;
  cells: Cell[];
  c: number;
  core: number;
  coreKind: CoreKind;
}

export interface Surge {
  idx: number;
  kind: CoreKind;
}

export interface Terminals {
  row: number;
  col: number;
}

export interface GameState {
  grid: number[];
  cores: (CoreKind | null)[];
  terminals: Terminals;
  tray: (Piece | null)[];
  buffer: Piece | null;
  stashed: boolean;
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
  surges: Surge[];
  circuit: number[];
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
  return { w: s.w, h: s.h, cells: s.cells.map(([r, c]) => [r, c]), c: color, core: -1, coreKind: 'line' };
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

export function parts(s: GameState): (Piece | null)[] {
  return [...s.tray, s.buffer];
}

export function anyMove(s: GameState) {
  return parts(s).some((p) => p !== null && turnsToFit(s.grid, p) >= 0);
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

export function blastCells(k: number, kind: CoreKind) {
  const r = Math.floor(k / N);
  const c = k % N;
  const out: number[] = [];
  if (kind === 'line') {
    for (let j = 0; j < N; j++) out.push(cellIndex(r, j), cellIndex(j, c));
    return out;
  }
  for (let rr = Math.max(0, r - 1); rr <= Math.min(N - 1, r + 1); rr++) {
    for (let cc = Math.max(0, c - 1); cc <= Math.min(N - 1, c + 1); cc++) out.push(cellIndex(rr, cc));
  }
  return out;
}

export function neighbours(k: number) {
  'worklet';
  const r = Math.floor(k / N);
  const c = k % N;
  const out: number[] = [];
  if (r > 0) out.push(k - N);
  if (r < N - 1) out.push(k + N);
  if (c > 0) out.push(k - 1);
  if (c < N - 1) out.push(k + 1);
  return out;
}

export function circuitPath(grid: number[], t: Terminals): number[] | null {
  'worklet';
  const start = t.row * N;
  const goal = t.col;
  if (grid[start] < 0 || grid[goal] < 0) return null;
  const prev: number[] = new Array(N * N).fill(-2);
  prev[start] = -1;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const k = queue[head];
    if (k === goal) {
      const path: number[] = [];
      for (let x = k; x >= 0; x = prev[x]) path.push(x);
      return path.reverse();
    }
    for (const x of neighbours(k)) {
      if (grid[x] < 0 || prev[x] !== -2) continue;
      prev[x] = k;
      queue.push(x);
    }
  }
  return null;
}

export function circuitArc(grid: number[], path: number[]): number[] {
  'worklet';
  const out: number[] = [];
  for (const k of path) {
    for (const x of neighbours(k)) {
      if (grid[x] >= 0 && !path.includes(x) && !out.includes(x)) out.push(x);
    }
  }
  return out;
}

export function pickTerminals(grid: number[], rand: Rand = Math.random, avoid?: Terminals): Terminals {
  const all: Terminals[] = [];
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) if (row + col + 1 >= MIN_CIRCUIT) all.push({ row, col });
  }
  const open = all.filter((t) => !circuitPath(grid, t));
  const moved = open.filter((t) => !avoid || (t.row !== avoid.row && t.col !== avoid.col));
  const pool = moved.length ? moved : open.length ? open : all;
  return pool[Math.floor(rand() * pool.length)];
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
        p.coreKind = rand() < AREA_CHANCE ? 'area' : 'line';
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
  const tray = newTray(grid, rand);
  return {
    grid,
    cores: Array(N * N).fill(null),
    terminals: pickTerminals(grid, rand),
    tray,
    buffer: null,
    stashed: false,
    score: 0,
    best,
    combo: 0,
    idle: 0,
    over: false,
  };
}

export function spinPiece(s: GameState, i: number): GameState | null {
  const p = parts(s)[i];
  if (s.over || !p) return null;
  if (i === BUFFER) return { ...s, buffer: rotate(p) };
  const tray = s.tray.slice();
  tray[i] = rotate(p);
  return { ...s, tray };
}

export function stashPiece(s: GameState, i: number, rand: Rand = Math.random): GameState | null {
  const p = s.tray[i];
  if (s.over || s.stashed || i === BUFFER || !p) return null;
  let tray = s.tray.slice();
  tray[i] = s.buffer;
  let stashed = true;
  if (tray.every((x) => !x)) {
    tray = newTray(s.grid, rand);
    stashed = false;
  }
  const next = { ...s, tray, buffer: p, stashed };
  return { ...next, over: !anyMove(next) };
}

export function placePiece(
  s: GameState,
  i: number,
  r: number,
  c: number,
  rand: Rand = Math.random,
): PlaceResult | null {
  const p = parts(s)[i];
  if (s.over || !p || !fits(s.grid, p, r, c)) return null;

  const grid = s.grid.slice();
  const cores = s.cores.slice();
  p.cells.forEach(([dr, dc], k) => {
    const idx = cellIndex(r + dr, c + dc);
    grid[idx] = p.c;
    if (k === p.core) cores[idx] = p.coreKind;
  });

  let gained = p.cells.length * PTS.cell;
  let { combo, idle } = s;
  const lines = fullLines(grid);
  const lineCount = lines.rows.length + lines.cols.length;
  const lineSet = lineCells(lines);
  const circuit = circuitPath(grid, s.terminals) ?? [];
  const base = new Set([...lineSet, ...circuit]);
  const surges: Surge[] = [];
  const cleared: { idx: number; color: number }[] = [];
  let perfect = false;

  if (base.size) {
    const hit = new Set([...base, ...circuitArc(grid, circuit)]);
    const seen = new Set<number>();
    const queue = [...hit].filter((k) => cores[k]);
    while (queue.length) {
      const k = queue.shift()!;
      const kind = cores[k];
      if (seen.has(k) || !kind) continue;
      seen.add(k);
      surges.push({ idx: k, kind });
      for (const x of blastCells(k, kind)) {
        if (grid[x] < 0 || hit.has(x)) continue;
        hit.add(x);
        if (cores[x]) queue.push(x);
      }
    }
    const extra = hit.size - base.size;
    combo += 1;
    idle = 0;
    gained += ((PTS.line * lineCount * (lineCount + 1)) / 2) * combo + extra * PTS.core + circuit.length * PTS.circuit;
    hit.forEach((k) => {
      cleared.push({ idx: k, color: grid[k] });
      grid[k] = -1;
      cores[k] = null;
    });
    perfect = grid.every((v) => v < 0);
    if (perfect) gained += PTS.perfect;
  } else {
    idle += 1;
    if (idle >= 3) combo = 0;
  }

  let tray = s.tray.slice();
  if (i !== BUFFER) tray[i] = null;
  const dealt = tray.every((x) => !x);
  if (dealt) tray = newTray(grid, rand);

  const terminals = circuit.length ? pickTerminals(grid, rand, s.terminals) : s.terminals;
  const score = s.score + gained;
  const next: GameState = {
    grid,
    cores,
    terminals,
    tray,
    buffer: i === BUFFER ? null : s.buffer,
    stashed: dealt ? false : s.stashed,
    score,
    best: Math.max(s.best, score),
    combo,
    idle,
    over: false,
  };
  next.over = !anyMove(next);

  return {
    state: next,
    gained,
    lines,
    lineCount,
    lineSet,
    cleared,
    surges,
    circuit,
    perfect,
    dealt,
    center: { r: r + p.h / 2, c: c + p.w / 2 },
  };
}

const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

const isCoreKind = (v: unknown): v is CoreKind => v === 'line' || v === 'area';

function isPiece(x: unknown): x is Piece {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  if (!isInt(p.w, 1, N) || !isInt(p.h, 1, N) || !isInt(p.c, 0, COLOR_COUNT - 1)) return false;
  const { w, h, cells } = p;
  if (!Array.isArray(cells) || !cells.length) return false;
  const ok = cells.every((cell) => Array.isArray(cell) && isInt(cell[0], 0, h - 1) && isInt(cell[1], 0, w - 1));
  return ok && isInt(p.core, -1, cells.length - 1) && isCoreKind(p.coreKind);
}

export function isGameState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false;
  const g = x as Record<string, unknown>;
  const { grid, cores, tray, terminals } = g;
  const t = terminals as Record<string, unknown> | null;
  return (
    Array.isArray(grid) &&
    grid.length === N * N &&
    grid.every((v) => isInt(v, -1, COLOR_COUNT - 1)) &&
    Array.isArray(cores) &&
    cores.length === N * N &&
    cores.every((v) => v === null || isCoreKind(v)) &&
    Array.isArray(tray) &&
    tray.length === TRAY_SIZE &&
    tray.every((p) => p === null || isPiece(p)) &&
    (g.buffer === null || isPiece(g.buffer)) &&
    typeof g.stashed === 'boolean' &&
    isInt(g.score, 0, Number.MAX_SAFE_INTEGER) &&
    isInt(g.best, 0, Number.MAX_SAFE_INTEGER) &&
    isInt(g.combo, 0, Number.MAX_SAFE_INTEGER) &&
    isInt(g.idle, 0, Number.MAX_SAFE_INTEGER) &&
    typeof g.over === 'boolean' &&
    !!t &&
    typeof t === 'object' &&
    isInt(t.row, 0, N - 1) &&
    isInt(t.col, 0, N - 1)
  );
}
