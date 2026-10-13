import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { C, F, type Metrics } from '../theme';
import { Led } from './Led';

export interface FxSpec {
  id: number;
  kind: 'burst' | 'traceH' | 'traceV' | 'ring' | 'points' | 'praise' | 'combo';
  x: number;
  y: number;
  w?: number;
  h?: number;
  color?: string;
  delay?: number;
  text?: string;
  surge?: boolean;
}

const DURATION: Record<FxSpec['kind'], number> = {
  burst: 500,
  traceH: 450,
  traceV: 450,
  ring: 600,
  points: 900,
  praise: 1100,
  combo: 900,
};
export const FX_LIFETIME = 1700;

function range(v: Animated.Value, inputRange: number[], outputRange: number[] | string[]) {
  return v.interpolate({ inputRange, outputRange: outputRange as number[] });
}

function FxItem({ it, m }: { it: FxSpec; m: Metrics }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: DURATION[it.kind],
      delay: it.delay ?? 0,
      easing: it.kind === 'burst' ? Easing.in(Easing.quad) : Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [v, it.kind, it.delay]);

  const box = { position: 'absolute' as const, left: it.x, top: it.y, width: it.w, height: it.h };

  if (it.kind === 'burst') {
    return (
      <Animated.View
        style={[
          box,
          {
            opacity: range(v, [0, 0.35, 1], [1, 1, 0]),
            transform: [
              { scale: range(v, [0, 0.35, 1], [1, 1.15, 0.1]) },
              { rotate: range(v, [0, 0.35, 1], ['0deg', '0deg', '25deg']) },
            ],
          },
        ]}
      >
        <Led color={it.color ?? C.silk} size={it.w ?? 0} b={m.b} />
        <Animated.View style={[styles.flash, { opacity: range(v, [0, 0.35], [0.8, 0]) }]} />
      </Animated.View>
    );
  }

  if (it.kind === 'traceH' || it.kind === 'traceV') {
    const horizontal = it.kind === 'traceH';
    return (
      <Animated.View
        style={[
          box,
          styles.trace,
          it.surge && styles.surgeTrace,
          {
            transformOrigin: horizontal ? 'left' : 'top',
            opacity: range(v, [0, 0.45, 1], [1, 0.95, 0]),
            transform: [
              horizontal
                ? { scaleX: range(v, [0, 0.45, 1], [0, 1, 1]) }
                : { scaleY: range(v, [0, 0.45, 1], [0, 1, 1]) },
            ],
          },
        ]}
      />
    );
  }

  if (it.kind === 'ring') {
    return (
      <Animated.View
        style={[
          box,
          styles.ring,
          {
            borderRadius: it.w ?? 0,
            opacity: range(v, [0, 1], [1, 0]),
            transform: [{ scale: range(v, [0, 1], [0.2, 5]) }],
          },
        ]}
      />
    );
  }

  const fontSize = m.size * (it.kind === 'praise' ? 0.11 : it.kind === 'combo' ? 0.06 : 0.07);
  const textStyle =
    it.kind === 'praise'
      ? [styles.praise, { color: it.surge ? C.surgeText : C.pad }]
      : it.kind === 'combo'
        ? styles.combo
        : styles.points;
  const motion =
    it.kind === 'praise'
      ? {
          opacity: range(v, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
          transform: [
            { scale: range(v, [0, 0.2, 0.35, 1], [0.4, 1.1, 1, 1]) },
            { translateY: range(v, [0.8, 1], [0, -fontSize * 0.3]) },
          ],
        }
      : {
          opacity: range(v, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
          transform: [{ translateY: range(v, [0, 1], [10, -40]) }],
        };

  return (
    <Animated.Text
      numberOfLines={1}
      style={[
        styles.pop,
        textStyle,
        { fontSize, left: it.x - m.field / 2, top: it.y - fontSize * 0.65, width: m.field },
        motion,
      ]}
    >
      {it.text}
    </Animated.Text>
  );
}

export function FxLayer({ items, m }: { items: FxSpec[]; m: Metrics }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((it) => (
        <FxItem key={it.id} it={it} m={m} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flash: { ...StyleSheet.absoluteFill, borderRadius: 3, backgroundColor: '#fff' },
  trace: {
    borderRadius: 4,
    backgroundColor: C.trace,
    shadowColor: C.traceGlow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  surgeTrace: { backgroundColor: C.surgeTrace, shadowColor: C.surge },
  ring: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: C.surge,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  pop: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: F.bold,
    color: C.silk,
    textShadowColor: C.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 1,
  },
  points: {},
  praise: { textTransform: 'uppercase', letterSpacing: 1 },
  combo: { fontFamily: F.mono, color: C.comboText },
});
