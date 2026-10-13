import type { SharedValue } from 'react-native-reanimated';

import { N } from './engine';

export const DRAG_GAIN = 1.4;
export const LIFT_CELLS = 1.93;
export const SNAP_RADIUS = 1;
export const NO_CELL = -1;
export const OFFSCREEN = -9999;

export interface Point {
  x: number;
  y: number;
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
  pending: SharedValue<number>;
  pendingFrame: SharedValue<Point>;
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
