import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { ghostFrame, type DragShared } from '../drag';
import { COLORS, type Piece } from '../engine';
import type { Metrics } from '../theme';
import { Led } from './Led';

function GhostPiece({ p, i, m, drag }: { p: Piece; i: number; m: Metrics; drag: DragShared }) {
  const style = useAnimatedStyle(() => {
    const active = drag.slot.get() === i;
    const held = !active && drag.pending.get() === i;
    const f = active ? ghostFrame(drag, i) : drag.pendingFrame.get();
    const shown = active || held;
    return {
      opacity: shown ? 1 : 0,
      left: shown ? f.x : -9999,
      top: shown ? f.y : -9999,
    };
  });
  return (
    <Animated.View
      testID={`ghost-${i}`}
      pointerEvents="none"
      style={[styles.ghost, { width: p.w * m.pitch - m.gap, height: p.h * m.pitch - m.gap }, style]}
    >
      {p.cells.map(([r, c], k) => (
        <View key={k} style={{ position: 'absolute', left: c * m.pitch, top: r * m.pitch }}>
          <Led color={COLORS[p.c]} size={m.cell} b={m.b} glow={m.glow} core={k === p.core} />
        </View>
      ))}
    </Animated.View>
  );
}

export const GhostLayer = memo(function GhostLayer({
  tray,
  m,
  drag,
}: {
  tray: (Piece | null)[];
  m: Metrics;
  drag: DragShared;
}) {
  return <>{tray.map((p, i) => (p ? <GhostPiece key={i} p={p} i={i} m={m} drag={drag} /> : null))}</>;
});

const styles = StyleSheet.create({
  ghost: { position: 'absolute' },
});
