import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { Gesture, PointerType } from 'react-native-gesture-handler';
import { Easing, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import type { Preview } from './components/Board';
import {
  completedLines,
  decodeCell,
  ghostFrame,
  NO_CELL,
  overBuffer,
  sameLines,
  targetCell,
  type DragShared,
  type Clears,
  type Point,
  type Slot,
  type SlotGeo,
} from './drag';
import { BUFFER, cellIndex, N, parts, SOURCES, type GameState, type Piece, type Terminals } from './engine';
import type { Buzz } from './haptics';
import { BUFFER_SCALE, PART_COLORS, span, type Metrics } from './theme';

const SLOTS = Array.from({ length: SOURCES }, (_, i) => i);
const DONE = SLOTS.map(() => 1);
const RETURN = { duration: 200, easing: Easing.out(Easing.cubic) };

interface DragEvent {
  slot: number;
  code: number;
  end: boolean;
  stash: boolean;
}

interface Options {
  state: GameState | null;
  stateRef: RefObject<GameState | null>;
  m: Metrics;
  onPlace: (i: number, r: number, c: number) => void;
  onStash: (i: number) => void;
  haptic: (kind: Buzz) => void;
}

export function useDragGestures({ state, stateRef, m, onPlace, onStash, haptic }: Options) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [held, setHeld] = useState<(Piece | null)[]>(SLOTS.map(() => null));
  const [releaseSeq, setReleaseSeq] = useState(0);
  const released = useRef<number[]>([]);
  const dragRef = useRef<{ i: number; p: Piece } | null>(null);
  const rootRef = useRef<View>(null);
  const fieldRef = useRef<View>(null);
  const slotViews = useRef<(View | null)[]>([]);
  const slotRefs = useMemo(
    () =>
      SLOTS.map((i) => (view: View | null) => {
        slotViews.current[i] = view;
      }),
    [],
  );

  const dragSlot = useSharedValue(-1);
  const touch = useSharedValue<Point>({ x: 0, y: 0 });
  const origin = useSharedValue<Point>({ x: 0, y: 0 });
  const finger = useSharedValue<Point>({ x: 0, y: 0 });
  const pitch = useSharedValue(m.pitch);
  const geo = useSharedValue<(SlotGeo | null)[]>(SLOTS.map(() => null));
  const field = useSharedValue<Point>({ x: 0, y: 0 });
  const grid = useSharedValue<number[]>([]);
  const slots = useSharedValue<Slot[]>(SLOTS.map(() => ({ x: 0, y: 0, w: 0, h: 0 })));
  const missFrom = useSharedValue<Point[]>(SLOTS.map(() => ({ x: 0, y: 0 })));
  const back = useSharedValue(DONE);
  const shrink = useSharedValue(SLOTS.map(() => (m.mini + m.miniGap) / m.pitch));
  const target = useSharedValue(NO_CELL);
  const lines = useSharedValue<Clears>({ rows: [], cols: [], path: [] });
  const terminals = useSharedValue<Terminals>({ row: -1, col: -1 });
  const enabled = useSharedValue(false);
  const moved = useSharedValue(false);
  const mouse = useSharedValue(false);
  const landing = useSharedValue<(Point | null)[]>(SLOTS.map(() => null));
  const events = useSharedValue<DragEvent[]>([]);
  const canStash = useSharedValue(false);
  const drag = useMemo<DragShared>(
    () => ({
      slot: dragSlot,
      touch,
      origin,
      pitch,
      mouse,
      geo,
      landing,
      slots,
      missFrom,
      back,
      shrink,
      target,
      lines,
      terminals,
      canStash,
    }),
    [
      dragSlot,
      touch,
      origin,
      pitch,
      mouse,
      geo,
      landing,
      slots,
      missFrom,
      back,
      shrink,
      target,
      lines,
      terminals,
      canStash,
    ],
  );

  useEffect(() => {
    geo.set(
      (state ? parts(state) : SLOTS.map(() => null)).map((p) =>
        p ? { w: span(p.w, m), h: span(p.h, m), pw: p.w, ph: p.h, cells: p.cells.flat() } : null,
      ),
    );
    grid.set(state?.grid ?? []);
    terminals.set(state?.terminals ?? { row: -1, col: -1 });
    pitch.set(m.pitch);
    shrink.set(SLOTS.map((k) => ((m.mini + m.miniGap) / m.pitch) * (k === BUFFER ? BUFFER_SCALE : 1)));
    enabled.set(!!state && !state.over);
    canStash.set(!!state && !state.over && !state.stashed);
  }, [state, m, geo, grid, terminals, pitch, shrink, enabled, canStash]);

  useEffect(() => {
    const done = released.current.splice(0);
    if (!done.length) return;
    scheduleOnUI(() => {
      'worklet';
      landing.set(landing.get().map((f, k) => (done.includes(k) ? null : f)));
    });
  }, [releaseSeq, landing]);

  const measureLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    fieldRef.current?.measureLayout(root, (x, y) => field.set({ x, y }));
    const next: (Slot | null)[] = SLOTS.map(() => null);
    slotViews.current.forEach((view, i) =>
      view?.measureLayout(root, (x, y, w, h) => {
        next[i] = { x, y, w, h };
        if (next.every((v): v is Slot => v !== null)) slots.set(next);
      }),
    );
  }, [field, slots]);

  const onDragStart = useCallback(
    (i: number) => {
      const s = stateRef.current;
      const p = s ? parts(s)[i] : null;
      if (!p) return;
      dragRef.current = { i, p };
      setPreview(null);
      setHeld((h) => h.map((x, k) => (k === i ? p : x)));
      haptic('select');
    },
    [stateRef, haptic],
  );

  const onLines = useCallback(
    (next: Clears) => {
      const d = dragRef.current;
      const s = stateRef.current;
      if (!d || !s || (!next.rows.length && !next.cols.length && !next.path.length)) {
        setPreview(null);
        return;
      }
      const hint = new Set<number>();
      for (let j = 0; j < N; j++) {
        next.rows.forEach((r) => s.grid[cellIndex(r, j)] >= 0 && hint.add(cellIndex(r, j)));
        next.cols.forEach((c) => s.grid[cellIndex(j, c)] >= 0 && hint.add(cellIndex(j, c)));
      }
      next.path.forEach((k) => s.grid[k] >= 0 && hint.add(k));
      setPreview({ hint, color: PART_COLORS[d.p.c] });
    },
    [stateRef],
  );

  const onDragEnd = useCallback(
    (i: number, code: number, stash: boolean) => {
      if (dragRef.current?.i === i) {
        dragRef.current = null;
        setPreview(null);
      }
      if (stash) onStash(i);
      else if (code !== NO_CELL) {
        const { r, c } = decodeCell(code);
        onPlace(i, r, c);
      }
      released.current.push(i);
      setReleaseSeq((n) => n + 1);
    },
    [onPlace, onStash],
  );

  const onDragEvents = useCallback(
    (list: DragEvent[]) => list.forEach((e) => (e.end ? onDragEnd(e.slot, e.code, e.stash) : onDragStart(e.slot))),
    [onDragStart, onDragEnd],
  );

  const isDragging = useCallback(() => dragRef.current !== null, []);

  useAnimatedReaction(
    () => events.get(),
    (list) => {
      if (!list.length) return;
      events.set([]);
      scheduleOnRN(onDragEvents, list);
    },
  );

  useAnimatedReaction(
    () => {
      const i = dragSlot.get();
      if (i < 0 || !moved.get()) return NO_CELL;
      return targetCell(ghostFrame(drag, i), field.get(), pitch.get(), grid.get(), geo.get()[i]);
    },
    (code, prev) => {
      if (code === prev) return;
      target.set(code);
      const i = dragSlot.get();
      const next = completedLines(grid.get(), i < 0 ? null : geo.get()[i], code, terminals.get());
      if (sameLines(next, lines.get())) return;
      lines.set(next);
      scheduleOnRN(onLines, next);
    },
  );

  const gestures = useMemo(
    () =>
      SLOTS.map((i) =>
        Gesture.Pan()
          .minDistance(0)
          .maxPointers(1)
          .onBegin((e) => {
            if (!enabled.get() || !geo.get()[i] || dragSlot.get() !== -1 || landing.get()[i]) return;
            if (back.get()[i] < 1) {
              back.set(back.get().map((t, k) => (k === i ? 1 : t)));
              back.set(withTiming(DONE, RETURN));
            }
            const s = slots.get()[i];
            const start = { x: s.x + e.x, y: s.y + e.y };
            origin.set(start);
            touch.set(start);
            finger.set({ x: e.absoluteX, y: e.absoluteY });
            moved.set(false);
            mouse.set(e.pointerType === PointerType.MOUSE);
            dragSlot.set(i);
            events.set([...events.get(), { slot: i, code: NO_CELL, end: false, stash: false }]);
          })
          .onUpdate((e) => {
            if (dragSlot.get() !== i) return;
            const o = origin.get();
            const f0 = finger.get();
            const dx = e.absoluteX - f0.x;
            const dy = e.absoluteY - f0.y;
            if (!moved.get() && Math.hypot(dx, dy) > 8) moved.set(true);
            touch.set({ x: o.x + dx, y: o.y + dy });
          })
          .onFinalize((_e, success) => {
            if (dragSlot.get() !== i) return;
            const f = ghostFrame(drag, i);
            const code =
              success && moved.get() ? targetCell(f, field.get(), pitch.get(), grid.get(), geo.get()[i]) : NO_CELL;
            const stash = code === NO_CELL && success && moved.get() && overBuffer(drag, i);
            if (code !== NO_CELL || stash) {
              landing.set(landing.get().map((prev, k) => (k === i ? f : prev)));
            } else {
              missFrom.set(missFrom.get().map((prev, k) => (k === i ? f : prev)));
              back.set(back.get().map((t, k) => (k === i ? 0 : t)));
              back.set(withTiming(DONE, RETURN));
            }
            dragSlot.set(-1);
            events.set([...events.get(), { slot: i, code, end: true, stash }]);
          }),
      ),
    [
      slots,
      geo,
      enabled,
      dragSlot,
      origin,
      finger,
      touch,
      moved,
      mouse,
      drag,
      field,
      pitch,
      grid,
      landing,
      missFrom,
      back,
      events,
    ],
  );

  return { rootRef, fieldRef, slotRefs, measureLayout, gestures, drag, held, preview, isDragging };
}
