import type { SharedValue } from 'react-native-reanimated';

import { circuitArc, circuitPath, N, type Lines, type Terminals } from './engine';

export const DRAG_GAIN = 1.4;
export const LIFT_CELLS = 1.93;
export const SNAP_RADIUS = 1;
export const NO_CELL = -1;
export const OFFSCREEN = -9999;
export const NO_TERMINALS: Terminals = { plus: { side: 'left', at: 0 }, minus: { side: 'left', at: 0 } };

export interface Point {
  x: number;
  y: number;
}

export interface Clears extends Lines {
  circuit: number[];
}

export interface Slot extends Point {
  w: number;
  h: number;
}

export interface SlotGeo {
  w: number;
  h: number;
  pw: number;
  ph: number;
  cells: number[];
}

export interface DragShared {
  slot: SharedValue<number>;
  touch: SharedValue<Point>;
  origin: SharedValue<Point>;
  pitch: SharedValue<number>;
  mouse: SharedValue<boolean>;
  geo: SharedValue<(SlotGeo | null)[]>;
  landing: SharedValue<(Point | null)[]>;
  slots: SharedValue<Slot[]>;
  missFrom: SharedValue<Point[]>;
  back: SharedValue<number[]>;
  shrink: SharedValue<number[]>;
  target: SharedValue<number>;
  lines: SharedValue<Clears>;
  terminals: SharedValue<Terminals>;
}

export function returnFrame(d: DragShared, i: number) {
  'worklet';
  const t = d.back.get()[i];
  const g = d.geo.get()[i];
  if (t >= 1 || !g) return null;
  const from = d.missFrom.get()[i];
  const s = d.slots.get()[i];
  const x = s.x + s.w / 2 - g.w / 2;
  const y = s.y + s.h / 2 - g.h / 2;
  return { x: from.x + (x - from.x) * t, y: from.y + (y - from.y) * t, scale: 1 + (d.shrink.get()[i] - 1) * t };
}

export function ghostFrame(d: DragShared, i: number): Point {
  'worklet';
  const g = d.geo.get()[i];
  if (!g) return { x: OFFSCREEN, y: OFFSCREEN };
  const t = d.touch.get();
  const o = d.origin.get();
  const mouse = d.mouse.get();
  const gain = mouse ? 1 : DRAG_GAIN;
  const cx = o.x + (t.x - o.x) * gain;
  const cy = o.y + (t.y - o.y) * gain - (mouse ? 0 : d.pitch.get() * LIFT_CELLS);
  return { x: cx - g.w / 2, y: cy - g.h / 2 };
}

export function encodeCell(r: number, c: number) {
  'worklet';
  return r * N + c;
}

export function decodeCell(code: number) {
  return { r: Math.floor(code / N), c: code % N };
}

export function nearestCell(grid: number[], g: SlotGeo, fr: number, fc: number) {
  'worklet';
  let best = NO_CELL;
  let bestD = SNAP_RADIUS * SNAP_RADIUS + 1e-6;
  const r0 = Math.max(0, Math.floor(fr - SNAP_RADIUS));
  const r1 = Math.min(N - g.ph, Math.ceil(fr + SNAP_RADIUS));
  const c0 = Math.max(0, Math.floor(fc - SNAP_RADIUS));
  const c1 = Math.min(N - g.pw, Math.ceil(fc + SNAP_RADIUS));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const d = (r - fr) * (r - fr) + (c - fc) * (c - fc);
      if (d >= bestD) continue;
      let ok = true;
      for (let k = 0; k < g.cells.length && ok; k += 2) ok = grid[(r + g.cells[k]) * N + c + g.cells[k + 1]] < 0;
      if (ok) {
        best = encodeCell(r, c);
        bestD = d;
      }
    }
  }
  return best;
}

export function targetCell(frame: Point, field: Point, pitch: number, grid: number[], g: SlotGeo | null) {
  'worklet';
  if (!g) return NO_CELL;
  return nearestCell(grid, g, (frame.y - field.y) / pitch, (frame.x - field.x) / pitch);
}

export function completedLines(grid: number[], g: SlotGeo | null, code: number, t: Terminals): Clears {
  'worklet';
  const rows: number[] = [];
  const cols: number[] = [];
  if (!g || code === NO_CELL || grid.length !== N * N) return { rows, cols, circuit: [] };
  const r0 = Math.floor(code / N);
  const c0 = code % N;
  const placed = grid.slice();
  for (let k = 0; k < g.cells.length; k += 2) placed[(r0 + g.cells[k]) * N + c0 + g.cells[k + 1]] = 0;
  for (let i = 0; i < N; i++) {
    let row = true;
    let col = true;
    for (let j = 0; j < N; j++) {
      if (placed[i * N + j] < 0) row = false;
      if (placed[j * N + i] < 0) col = false;
    }
    if (row) rows.push(i);
    if (col) cols.push(i);
  }
  const path = circuitPath(placed, t) ?? [];
  return { rows, cols, circuit: [...path, ...circuitArc(placed, path)] };
}

export function sameLines(a: Clears, b: Clears) {
  'worklet';
  return a.rows.join() === b.rows.join() && a.cols.join() === b.cols.join() && a.circuit.join() === b.circuit.join();
}
