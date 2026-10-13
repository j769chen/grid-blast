import { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type EasingFunction } from 'react-native';

import { FX_DURATION, type Fx, type FxSpec } from '../fx';
import { C, F, NATIVE_DRIVER, type Metrics } from '../theme';
import { Led } from './Led';

const EASE_IN = Easing.in(Easing.quad);
const EASE_OUT = Easing.out(Easing.quad);

type Of<K extends Fx['kind']> = Extract<Fx, { kind: K }>;

function useProgress(kind: Fx['kind'], delay = 0, easing: EasingFunction = EASE_OUT) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: FX_DURATION[kind],
      delay,
      easing,
      useNativeDriver: NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [v, kind, delay, easing]);
  return v;
}

const box = (fx: { x: number; y: number; w: number; h: number }) =>
  ({ position: 'absolute', left: fx.x, top: fx.y, width: fx.w, height: fx.h }) as const;

function Burst({ fx, m }: { fx: Of<'burst'>; m: Metrics }) {
  const v = useProgress('burst', fx.delay, EASE_IN);
  const motion = useMemo(
    () => ({
      opacity: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1, 0] }),
      transform: [
        { scale: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.15, 0.1] }) },
        { rotate: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: ['0deg', '0deg', '25deg'] }) },
      ],
    }),
    [v],
  );
  const flash = useMemo(() => ({ opacity: v.interpolate({ inputRange: [0, 0.35], outputRange: [0.8, 0] }) }), [v]);
  return (
    <Animated.View style={[box(fx), motion]}>
      <Led color={fx.color} size={fx.w} b={m.b} />
      <Animated.View style={[styles.flash, flash]} />
    </Animated.View>
  );
}

function Trace({ fx }: { fx: Of<'trace'> }) {
  const v = useProgress('trace', fx.delay);
  const horizontal = fx.axis === 'h';
  const motion = useMemo(() => {
    const grow = v.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 1, 1] });
    return {
      transformOrigin: horizontal ? 'left' : 'top',
      opacity: v.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 0.95, 0] }),
      transform: [horizontal ? { scaleX: grow } : { scaleY: grow }],
    };
  }, [v, horizontal]);
  return <Animated.View style={[box(fx), styles.trace, fx.surge && styles.surgeTrace, motion]} />;
}

function Ring({ fx }: { fx: Of<'ring'> }) {
  const v = useProgress('ring', fx.delay);
  const motion = useMemo(
    () => ({
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 5] }) }],
    }),
    [v],
  );
  return <Animated.View style={[box(fx), styles.ring, { borderRadius: fx.w }, motion]} />;
}

function Blast({ fx }: { fx: Of<'blast'> }) {
  const v = useProgress('blast', fx.delay);
  const motion = useMemo(
    () => ({
      opacity: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.95, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.4, 1.05, 1.15] }) }],
    }),
    [v],
  );
  return <Animated.View style={[box(fx), styles.blast, motion]} />;
}

const TEXT_SIZE = { points: 0.07, combo: 0.06, praise: 0.11 };

function Pop({ fx, m }: { fx: Of<'points' | 'combo' | 'praise'>; m: Metrics }) {
  const v = useProgress(fx.kind);
  const fontSize = m.size * TEXT_SIZE[fx.kind];
  const praise = fx.kind === 'praise';
  const motion = useMemo(
    () =>
      praise
        ? {
            opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { scale: v.interpolate({ inputRange: [0, 0.2, 0.35, 1], outputRange: [0.4, 1.1, 1, 1] }) },
              { translateY: v.interpolate({ inputRange: [0.8, 1], outputRange: [0, -fontSize * 0.3] }) },
            ],
          }
        : {
            opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, -40] }) }],
          },
    [v, praise, fontSize],
  );
  const look =
    fx.kind === 'praise'
      ? [styles.praise, { color: fx.surge ? C.surgeText : C.pad }]
      : fx.kind === 'combo' && styles.combo;
  return (
    <Animated.Text
      numberOfLines={1}
      style={[
        styles.pop,
        look,
        { fontSize, left: fx.x - m.field / 2, top: fx.y - fontSize * 0.65, width: m.field },
        motion,
      ]}
    >
      {fx.text}
    </Animated.Text>
  );
}

function FxItem({ fx, m }: { fx: FxSpec; m: Metrics }) {
  switch (fx.kind) {
    case 'burst':
      return <Burst fx={fx} m={m} />;
    case 'trace':
      return <Trace fx={fx} />;
    case 'ring':
      return <Ring fx={fx} />;
    case 'blast':
      return <Blast fx={fx} />;
    default:
      return <Pop fx={fx} m={m} />;
  }
}

export const FxLayer = memo(function FxLayer({ items, m }: { items: FxSpec[]; m: Metrics }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((fx) => (
        <FxItem key={fx.id} fx={fx} m={m} />
      ))}
    </View>
  );
});

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
  blast: {
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,194,244,0.55)',
    shadowColor: C.surge,
    shadowOpacity: 1,
    shadowRadius: 14,
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
  praise: { textTransform: 'uppercase', letterSpacing: 1 },
  combo: { fontFamily: F.mono, color: C.comboText },
});
