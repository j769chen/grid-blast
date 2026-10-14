import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { NO_CELL, OFFSCREEN, type Clears, type DragShared } from '../drag';
import { N, type Piece } from '../engine';
import { PART_COLORS, span, type Metrics } from '../theme';
import { Led } from './Led';

function lit(target: number, lines: Clears, dr: number, dc: number) {
  'worklet';
  if (target === NO_CELL) return false;
  const r = Math.floor(target / N) + dr;
  const c = (target % N) + dc;
  return lines.rows.includes(r) || lines.cols.includes(c) || lines.circuit.includes(r * N + c);
}

function ShadowCell({ p, k, m, drag }: { p: Piece; k: number; m: Metrics; drag: DragShared }) {
  const [dr, dc] = p.cells[k];
  const cell = useAnimatedStyle(() => ({ opacity: lit(drag.target.get(), drag.lines.get(), dr, dc) ? 1 : 0.45 }));
  const glare = useAnimatedStyle(() => ({ opacity: lit(drag.target.get(), drag.lines.get(), dr, dc) ? 1 : 0 }));
  return (
    <Animated.View style={[styles.cell, { left: dc * m.pitch, top: dr * m.pitch }, cell]}>
      <Led color={PART_COLORS[p.c]} size={m.cell} b={m.b} glow={m.glow} core={k === p.core ? p.coreKind : null} />
      <Animated.View style={[styles.glare, glare]} />
    </Animated.View>
  );
}

const ShadowPiece = memo(function ShadowPiece({
  p,
  i,
  m,
  drag,
}: {
  p: Piece;
  i: number;
  m: Metrics;
  drag: DragShared;
}) {
  const place = useAnimatedStyle(() => {
    const code = drag.target.get();
    const on = drag.slot.get() === i && code !== NO_CELL;
    return {
      opacity: on ? 1 : 0,
      left: on ? (code % N) * m.pitch : OFFSCREEN,
      top: on ? Math.floor(code / N) * m.pitch : OFFSCREEN,
    };
  });
  return (
    <Animated.View
      testID={`shadow-${i}`}
      pointerEvents="none"
      style={[styles.piece, { width: span(p.w, m), height: span(p.h, m) }, place]}
    >
      {p.cells.map((_, k) => (
        <ShadowCell key={k} p={p} k={k} m={m} drag={drag} />
      ))}
    </Animated.View>
  );
});

export const ShadowLayer = memo(function ShadowLayer({
  tray,
  m,
  drag,
}: {
  tray: (Piece | null)[];
  m: Metrics;
  drag: DragShared;
}) {
  return <>{tray.map((p, i) => (p ? <ShadowPiece key={i} p={p} i={i} m={m} drag={drag} /> : null))}</>;
});

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
  cell: { position: 'absolute' },
  glare: { ...StyleSheet.absoluteFill, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
});
