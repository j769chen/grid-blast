import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, PointerType } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Background } from './components/Background';
import { Board, type Preview } from './components/Board';
import { FX_LIFETIME, type FxSpec } from './components/Fx';
import { GameOver } from './components/GameOver';
import { GhostLayer } from './components/Ghost';
import { Hud } from './components/Hud';
import { Tray, type SlotAnim } from './components/Tray';
import { decodeCell, ghostFrame, nearestCell, NO_CELL, type DragShared, type SlotGeo } from './drag';
import {
  anyMove,
  COLORS,
  fits,
  fmt,
  isGameState,
  N,
  newGame,
  placePiece,
  previewCells,
  spinPiece,
  type GameState,
  type Piece,
  type PlaceResult,
} from './engine';
import { C, F, metrics, type Metrics } from './theme';

const KEY = { game: 'overclock.game', best: 'overclock.best', haptics: 'overclock.haptics' };
const PRAISE = ['', '', 'Double!', 'Triple!', 'Quad!', 'Overload!', 'Meltdown!'];

type Buzz = 'select' | 'light' | 'medium' | 'heavy' | 'warning' | 'error';

function buzz(on: boolean, kind: Buzz) {
  if (!on) return;
  const run =
    kind === 'select' ? Haptics.selectionAsync()
    : kind === 'light' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    : kind === 'medium' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    : kind === 'heavy' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    : kind === 'warning' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  run.catch(() => {});
}

function targetCell(f: { x: number; y: number }, fl: { x: number; y: number; pitch: number }, grid: number[], g: SlotGeo | null) {
  'worklet';
  if (!g) return NO_CELL;
  return nearestCell(grid, g, (f.y - fl.y) / fl.pitch, (f.x - fl.x) / fl.pitch);
}

let fxId = 0;

function buildFx(res: PlaceResult, m: Metrics): FxSpec[] {
  const items: FxSpec[] = [];
  if (!res.lineCount) return items;
  const add = (it: Omit<FxSpec, 'id'>) => items.push({ ...it, id: ++fxId });
  const span = m.pitch * N - m.gap;

  res.lines.rows.forEach((r) => add({ kind: 'traceH', x: 0, y: r * m.pitch, w: span, h: m.cell }));
  res.lines.cols.forEach((c) => add({ kind: 'traceV', x: c * m.pitch, y: 0, w: m.cell, h: span }));
  res.surges.forEach((k, n) => {
    const kr = Math.floor(k / N);
    const kc = k % N;
    const delay = 120 + n * 120;
    add({ kind: 'traceH', x: 0, y: kr * m.pitch, w: span, h: m.cell, delay, surge: true });
    add({ kind: 'traceV', x: kc * m.pitch, y: 0, w: m.cell, h: span, delay, surge: true });
    add({ kind: 'ring', x: kc * m.pitch, y: kr * m.pitch, w: m.cell, h: m.cell, delay });
  });

  const { r: pr, c: pc } = res.center;
  res.cleared.forEach(({ idx, color }) => {
    const r = Math.floor(idx / N);
    const c = idx % N;
    const dist = Math.hypot(r - pr, c - pc);
    add({ kind: 'burst', x: c * m.pitch, y: r * m.pitch, w: m.cell, h: m.cell, color: COLORS[color], delay: res.lineSet.has(idx) ? dist * 28 : 260 + dist * 20 });
  });

  add({ kind: 'points', x: pc * m.pitch, y: pr * m.pitch, text: `+${fmt(res.gained)}` });
  const surges = res.surges.length;
  const headline = res.perfect ? 'Board clear!'
    : surges > 1 ? `Surge ×${surges}!`
    : surges ? 'Surge!'
    : res.lineCount >= 2 ? PRAISE[Math.min(res.lineCount, PRAISE.length - 1)] : '';
  let y = m.pitch * 3.2;
  if (headline) {
    add({ kind: 'praise', x: m.pitch * 4, y, text: headline, surge: surges > 0 && !res.perfect });
    y += m.pitch * 1.2;
  }
  if (res.state.combo >= 2) add({ kind: 'combo', x: m.pitch * 4, y, text: `Combo ${res.state.combo}` });
  return items;
}

export default function Game() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const m = useMemo(() => metrics(width, height - insets.top - insets.bottom), [width, height, insets.top, insets.bottom]);

  const [state, setState] = useState<GameState | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fx, setFx] = useState<FxSpec[]>([]);
  const [overVisible, setOverVisible] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [anims, setAnims] = useState<SlotAnim[]>(() => [0, 1, 2].map(() => ({ key: 0, kind: 'deal' as const })));
  const [armed, setArmed] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [released, setReleased] = useState({ seq: 0, slot: -1 });

  const stateRef = useRef<GameState | null>(null);
  const mRef = useRef(m);
  const hapticsRef = useRef(true);
  const startBest = useRef(0);
  const dragRef = useRef<{ i: number; p: Piece } | null>(null);
  const rootRef = useRef<View>(null);
  const fieldRef = useRef<View>(null);
  const slotRef0 = useRef<View>(null);
  const slotRef1 = useRef<View>(null);
  const slotRef2 = useRef<View>(null);
  const slotRefs = useMemo(() => [slotRef0, slotRef1, slotRef2], []);

  const dragSlot = useSharedValue(-1);
  const touch = useSharedValue({ x: 0, y: 0 });
  const origin = useSharedValue({ x: 0, y: 0 });
  const finger = useSharedValue({ x: 0, y: 0 });
  const pitch = useSharedValue(m.pitch);
  const geo = useSharedValue<(SlotGeo | null)[]>([null, null, null]);
  const field = useSharedValue({ x: 0, y: 0, pitch: m.pitch });
  const grid = useSharedValue<number[]>([]);
  const slots = useSharedValue([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
  const enabled = useSharedValue(false);
  const moved = useSharedValue(false);
  const mouse = useSharedValue(false);
  const drop = useSharedValue({ seq: 0, slot: -1, code: NO_CELL });
  const pending = useSharedValue(-1);
  const pendingFrame = useSharedValue({ x: -9999, y: -9999 });
  const drag = useMemo<DragShared>(
    () => ({ slot: dragSlot, touch, origin, pitch, mouse, geo, pending, pendingFrame }),
    [dragSlot, touch, origin, pitch, mouse, geo, pending, pendingFrame],
  );

  useEffect(() => { mRef.current = m; }, [m]);
  useEffect(() => { hapticsRef.current = hapticsOn; }, [hapticsOn]);

  useEffect(() => {
    geo.set((state?.tray ?? [null, null, null]).map((p) => (p ? { w: p.w * m.pitch - m.gap, h: p.h * m.pitch - m.gap, pw: p.w, ph: p.h, cells: p.cells.flat() } : null)));
    grid.set(state?.grid ?? []);
    pitch.set(m.pitch);
    enabled.set(!!state && !state.over);
  }, [state, m, geo, grid, pitch, enabled]);

  useEffect(() => {
    if (released.seq && pending.get() === released.slot) pending.set(-1);
  }, [released, pending]);

  const apply = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
    AsyncStorage.setItem(KEY.game, JSON.stringify(next)).catch(() => {});
    AsyncStorage.setItem(KEY.best, String(next.best)).catch(() => {});
  }, []);

  const dealAll = useCallback(() => setAnims((a) => a.map((x) => ({ key: x.key + 1, kind: 'deal' }))), []);

  const startGame = useCallback((best: number) => {
    startBest.current = best;
    apply(newGame(best));
    setOverVisible(false);
    setFx([]);
    dealAll();
  }, [apply, dealAll]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [g, b, h] = await Promise.all([KEY.game, KEY.best, KEY.haptics].map((k) => AsyncStorage.getItem(k).catch(() => null)));
      if (!alive) return;
      const best = Number(b) || 0;
      if (h === 'false') setHapticsOn(false);
      let saved: unknown = null;
      try { saved = g ? JSON.parse(g) : null; } catch { saved = null; }
      if (isGameState(saved) && !saved.over) {
        const s = { ...saved, best: Math.max(saved.best, best) };
        startBest.current = s.best;
        apply({ ...s, over: !anyMove(s) });
      } else {
        startGame(best);
      }
    })();
    return () => { alive = false; };
  }, [apply, startGame]);

  const over = state?.over ?? false;
  useEffect(() => {
    if (!over) return;
    const t = setTimeout(() => {
      const s = stateRef.current;
      setNewBest(!!s && s.score > 0 && s.score > startBest.current);
      setOverVisible(true);
      buzz(hapticsRef.current, 'error');
    }, 900);
    return () => clearTimeout(t);
  }, [over]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2200);
    return () => clearTimeout(t);
  }, [armed]);

  const place = useCallback((i: number, r: number, c: number) => {
    const s = stateRef.current;
    if (!s) return;
    const res = placePiece(s, i, r, c);
    if (!res) return;
    apply(res.state);
    if (res.dealt) dealAll();
    const items = buildFx(res, mRef.current);
    if (items.length) {
      const ids = new Set(items.map((it) => it.id));
      setFx((f) => [...f, ...items]);
      setTimeout(() => setFx((f) => f.filter((it) => !ids.has(it.id))), FX_LIFETIME);
    }
    buzz(hapticsRef.current, !res.lineCount ? 'light' : res.surges.length || res.perfect ? 'heavy' : 'medium');
  }, [apply, dealAll]);

  const spin = useCallback((i: number) => {
    const s = stateRef.current;
    if (!s || s.over || !s.tray[i] || dragRef.current) return;
    const next = spinPiece(s, i);
    if (!next) {
      setShakeKey((k) => k + 1);
      buzz(hapticsRef.current, 'warning');
      return;
    }
    apply(next);
    setAnims((a) => a.map((x, k) => (k === i ? { key: x.key + 1, kind: 'spin' } : x)));
    buzz(hapticsRef.current, 'select');
  }, [apply]);

  const measureLayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    fieldRef.current?.measureLayout(root, (x, y) => field.set({ x, y, pitch: mRef.current.pitch }));
    const next: ({ x: number; y: number } | null)[] = [null, null, null];
    slotRefs.forEach((ref, i) => ref.current?.measureLayout(root, (x, y) => {
      next[i] = { x, y };
      if (next.every((v) => v)) slots.set(next as { x: number; y: number }[]);
    }));
  }, [field, slots, slotRefs]);

  useEffect(() => { measureLayout(); });

  const onDragStart = useCallback((i: number) => {
    const p = stateRef.current?.tray[i];
    if (!p) return;
    dragRef.current = { i, p };
    setPreview(null);
    buzz(hapticsRef.current, 'select');
  }, []);

  const onDragCell = useCallback((code: number) => {
    const d = dragRef.current;
    const s = stateRef.current;
    if (!d || !s || code === NO_CELL) {
      setPreview(null);
      return;
    }
    const { r, c } = decodeCell(code);
    if (!fits(s.grid, d.p, r, c)) {
      setPreview(null);
      return;
    }
    const pv = previewCells(s, d.p, r, c);
    const core = d.p.core >= 0 ? d.p.cells[d.p.core] : null;
    setPreview({
      ghost: new Set(pv.ghost),
      hint: new Set(pv.hint),
      color: COLORS[d.p.c],
      coreIdx: core ? (r + core[0]) * N + c + core[1] : -1,
    });
  }, []);

  const onDragEnd = useCallback((i: number, code: number) => {
    if (dragRef.current?.i === i) {
      dragRef.current = null;
      setPreview(null);
    }
    if (code !== NO_CELL) {
      const { r, c } = decodeCell(code);
      place(i, r, c);
    }
    setReleased((v) => ({ seq: v.seq + 1, slot: i }));
  }, [place]);

  useAnimatedReaction(
    () => dragSlot.get(),
    (slot, prev) => {
      if (slot >= 0 && slot !== prev) scheduleOnRN(onDragStart, slot);
    },
  );

  useAnimatedReaction(
    () => drop.get(),
    (d, prev) => {
      if (prev && d.seq !== prev.seq) scheduleOnRN(onDragEnd, d.slot, d.code);
    },
  );

  useAnimatedReaction(
    () => {
      const i = dragSlot.get();
      if (i < 0) return NO_CELL;
      const f = ghostFrame(drag, i);
      return targetCell(f, field.get(), grid.get(), geo.get()[i]);
    },
    (code, prev) => {
      if (code !== prev && dragSlot.get() >= 0) scheduleOnRN(onDragCell, code);
    },
  );

  const gestures = useMemo(() => [0, 1, 2].map((i) => Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      if (!enabled.get() || !geo.get()[i] || dragSlot.get() !== -1 || pending.get() === i) return;
      const s = slots.get()[i];
      const start = { x: s.x + e.x, y: s.y + e.y };
      origin.set(start);
      touch.set(start);
      finger.set({ x: e.absoluteX, y: e.absoluteY });
      moved.set(false);
      mouse.set(e.pointerType === PointerType.MOUSE);
      dragSlot.set(i);
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
      const code = success && moved.get() ? targetCell(f, field.get(), grid.get(), geo.get()[i]) : NO_CELL;
      pendingFrame.set(f);
      pending.set(i);
      dragSlot.set(-1);
      drop.set({ seq: drop.get().seq + 1, slot: i, code });
    })), [slots, geo, enabled, dragSlot, origin, finger, touch, moved, mouse, drop, drag, field, grid, pending, pendingFrame]);

  const toggleHaptics = useCallback(() => {
    const next = !hapticsOn;
    setHapticsOn(next);
    AsyncStorage.setItem(KEY.haptics, String(next)).catch(() => {});
    buzz(next, 'select');
  }, [hapticsOn]);

  const restart = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.over || armed) {
      setArmed(false);
      startGame(s.best);
    } else {
      setArmed(true);
    }
  }, [armed, startGame]);

  if (!state) {
    return (
      <View style={styles.root}>
        <Background />
      </View>
    );
  }

  return (
    <View ref={rootRef} onLayout={measureLayout} style={styles.root}>
      <Background />
      <View style={[styles.column, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <Hud
          score={state.score}
          best={state.best}
          charge={state.charge}
          hapticsOn={hapticsOn}
          armed={armed}
          shakeKey={shakeKey}
          m={m}
          onToggleHaptics={toggleHaptics}
          onRestart={restart}
        />
        <Board grid={state.grid} cores={state.cores} preview={preview} m={m} fieldRef={fieldRef} onFieldLayout={measureLayout} fx={fx} />
        <Tray
          tray={state.tray}
          grid={state.grid}
          charge={state.charge}
          m={m}
          anims={anims}
          gestures={gestures}
          slotRefs={slotRefs}
          onSlotLayout={measureLayout}
          dragSlot={dragSlot}
          pending={pending}
          onRotate={spin}
        />
        <Text style={[styles.note, { width: m.size }]}>
          Each rotation costs 1 charge. Clearing lines recharges. Cores blast their whole row and column.
        </Text>
      </View>
      <GhostLayer tray={state.tray} m={m} drag={drag} />
      <GameOver visible={overVisible} score={state.score} best={state.best} newBest={newBest} onAgain={() => startGame(state.best)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.maskDeep },
  column: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 16 },
  note: { fontFamily: F.mono, fontSize: 10.5, lineHeight: 16, letterSpacing: 0.8, textAlign: 'center', textTransform: 'uppercase', color: C.silkDim },
});
