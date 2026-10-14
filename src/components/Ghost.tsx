import { memo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type AnimatedStyle } from 'react-native-reanimated';

import { ghostFrame, OFFSCREEN, returnFrame, type DragShared, type Point } from '../drag';
import type { Piece } from '../engine';
import { PART_COLORS, span, type Metrics } from '../theme';
import { Led } from './Led';

function at(f: Point | null) {
  'worklet';
  return { opacity: f ? 1 : 0, left: f ? f.x : OFFSCREEN, top: f ? f.y : OFFSCREEN };
}

function PieceView({ p, m, style, testID }: { p: Piece; m: Metrics; style: AnimatedStyle<ViewStyle>; testID: string }) {
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[styles.ghost, { width: span(p.w, m), height: span(p.h, m) }, style]}
    >
      {p.cells.map(([r, c], k) => (
        <View key={k} style={{ position: 'absolute', left: c * m.pitch, top: r * m.pitch }}>
          <Led color={PART_COLORS[p.c]} size={m.cell} b={m.b} glow={m.glow} core={k === p.core ? p.coreKind : null} />
        </View>
      ))}
    </Animated.View>
  );
}

const DraggedPiece = memo(function DraggedPiece({
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
  const style = useAnimatedStyle(() => at(drag.slot.get() === i ? ghostFrame(drag, i) : null));
  return <PieceView p={p} m={m} style={style} testID={`ghost-${i}`} />;
});

const LandingPiece = memo(function LandingPiece({
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
  const { landing } = drag;
  const style = useAnimatedStyle(() => at(landing.get()[i]));
  return <PieceView p={p} m={m} style={style} testID={`landing-${i}`} />;
});

const ReturningPiece = memo(function ReturningPiece({
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
  const style = useAnimatedStyle(() => {
    const f = drag.slot.get() === i ? null : returnFrame(drag, i);
    return { ...at(f), transform: [{ scale: f ? f.scale : 1 }] };
  });
  return <PieceView p={p} m={m} style={style} testID={`return-${i}`} />;
});

export const GhostLayer = memo(function GhostLayer({
  tray,
  held,
  m,
  drag,
}: {
  tray: (Piece | null)[];
  held: (Piece | null)[];
  m: Metrics;
  drag: DragShared;
}) {
  return (
    <>
      {held.map((p, i) => (p ? <LandingPiece key={`held-${i}`} p={p} i={i} m={m} drag={drag} /> : null))}
      {tray.map((p, i) => (p ? <ReturningPiece key={`return-${i}`} p={p} i={i} m={m} drag={drag} /> : null))}
      {tray.map((p, i) => (p ? <DraggedPiece key={`drag-${i}`} p={p} i={i} m={m} drag={drag} /> : null))}
    </>
  );
});

const styles = StyleSheet.create({
  ghost: { position: 'absolute' },
});
