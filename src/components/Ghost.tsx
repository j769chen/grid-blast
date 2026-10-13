import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { ghostFrame, OFFSCREEN, type DragShared } from '../drag';
import type { Piece } from '../engine';
import { PART_COLORS, span, type Metrics } from '../theme';
import { Led } from './Led';

function GhostPiece({ p, i, m, drag }: { p: Piece; i: number; m: Metrics; drag: DragShared }) {
  const style = useAnimatedStyle(() => {
    const f = drag.slot.get() === i ? ghostFrame(drag, i) : drag.landing.get()[i];
    return {
      opacity: f ? 1 : 0,
      left: f ? f.x : OFFSCREEN,
      top: f ? f.y : OFFSCREEN,
    };
  });
  return (
    <Animated.View
      testID={`ghost-${i}`}
      pointerEvents="none"
      style={[styles.ghost, { width: span(p.w, m), height: span(p.h, m) }, style]}
    >
      {p.cells.map(([r, c], k) => (
        <View key={k} style={{ position: 'absolute', left: c * m.pitch, top: r * m.pitch }}>
          <Led color={PART_COLORS[p.c]} size={m.cell} b={m.b} glow={m.glow} core={k === p.core} />
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
