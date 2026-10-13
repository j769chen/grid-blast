import { memo, useEffect, useState, type ReactNode, type Ref } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import type { Point } from '../drag';
import { turnsToFit, type Piece } from '../engine';
import { C, F, PART_COLORS, type Metrics } from '../theme';
import { RotateIcon } from './Icons';
import { Led } from './Led';

export interface SlotAnim {
  key: number;
  kind: 'deal' | 'spin';
}

function MiniPiece({ p, m, kind, index }: { p: Piece; m: Metrics; kind: SlotAnim['kind']; index: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: kind === 'deal' ? 300 : 220,
      delay: kind === 'deal' ? index * 50 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, kind, index]);

  const step = m.mini + m.miniGap;
  const transform =
    kind === 'deal'
      ? [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
        ]
      : [
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
        ];

  return (
    <Animated.View
      style={{
        width: p.w * step - m.miniGap,
        height: p.h * step - m.miniGap,
        opacity: kind === 'deal' ? v : 1,
        transform,
      }}
    >
      {p.cells.map(([r, c], k) => (
        <View key={k} style={{ position: 'absolute', left: c * step, top: r * step }}>
          <Led color={PART_COLORS[p.c]} size={m.mini} b={m.size * 0.0045} glow={m.size * 0.012} core={k === p.core} />
        </View>
      ))}
    </Animated.View>
  );
}

function HideWhileDragged({
  i,
  dragSlot,
  landing,
  children,
}: {
  i: number;
  dragSlot: SharedValue<number>;
  landing: SharedValue<(Point | null)[]>;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ opacity: dragSlot.get() === i || landing.get()[i] ? 0 : 1 }));
  return <Reanimated.View style={style}>{children}</Reanimated.View>;
}

interface TrayProps {
  tray: (Piece | null)[];
  grid: number[];
  charge: number;
  m: Metrics;
  anims: SlotAnim[];
  gestures: PanGesture[];
  slotRefs: Ref<View>[];
  onTrayLayout: () => void;
  dragSlot: SharedValue<number>;
  landing: SharedValue<(Point | null)[]>;
  onRotate: (i: number) => void;
}

export const Tray = memo(function Tray({
  tray,
  grid,
  charge,
  m,
  anims,
  gestures,
  slotRefs,
  onTrayLayout,
  dragSlot,
  landing,
  onRotate,
}: TrayProps) {
  const turns = tray.map((p) => (p ? turnsToFit(grid, p, charge) : -1));
  return (
    <View onLayout={onTrayLayout} style={[styles.dock, { width: m.size }]}>
      <View style={[styles.row, { height: m.size * 0.34 }]}>
        {tray.map((p, i) => (
          <GestureDetector key={i} gesture={gestures[i]}>
            <View ref={slotRefs[i]} style={styles.slot}>
              <Text style={styles.label}>U{i + 1}</Text>
              {p && (
                <HideWhileDragged i={i} dragSlot={dragSlot} landing={landing}>
                  <View style={{ opacity: turns[i] < 0 ? 0.3 : 1 }}>
                    <MiniPiece key={anims[i].key} p={p} m={m} kind={anims[i].kind} index={i} />
                  </View>
                </HideWhileDragged>
              )}
            </View>
          </GestureDetector>
        ))}
      </View>
      <View style={styles.row}>
        {tray.map((p, i) => {
          const disabled = !p || charge < 1;
          const ready = !!p && turns[i] > 0;
          return (
            <View key={i} style={styles.rotCell}>
              <Pressable
                onPress={() => onRotate(i)}
                disabled={!p}
                accessibilityRole="button"
                accessibilityLabel={`Rotate U${i + 1}`}
                accessibilityHint={charge < 1 ? 'No rotation charges left' : undefined}
                accessibilityState={{ disabled: !p }}
                accessibilityElementsHidden={!p}
                importantForAccessibility={p ? 'auto' : 'no-hide-descendants'}
                style={({ pressed }) => [
                  styles.rot,
                  ready && !disabled && styles.rotReady,
                  { opacity: !p ? 0 : disabled ? 0.35 : pressed ? 0.7 : 1 },
                ]}
              >
                <RotateIcon color={ready && !disabled ? C.pad : C.silk} />
                <Text style={[styles.rotText, ready && !disabled && { color: C.pad }]}>Rotate</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dock: { gap: 6 },
  row: { flexDirection: 'row', gap: 8 },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.silkLine,
    borderRadius: 6,
  },
  label: {
    position: 'absolute',
    top: 4,
    left: 6,
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: C.silkDim,
  },
  rotCell: { flex: 1, alignItems: 'center' },
  rot: {
    height: 34,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(238,242,230,0.25)',
    backgroundColor: C.silkFill,
  },
  rotReady: {
    borderColor: C.pad,
    shadowColor: C.pad,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  rotText: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: C.silk },
});
