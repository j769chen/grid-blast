import { memo, useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { CoreKind } from '../engine';
import { C, glow as halo, NATIVE_DRIVER } from '../theme';

const pulse = new Animated.Value(0);
let pulsing = false;

function startPulse() {
  if (pulsing) return;
  pulsing = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]),
  ).start(() => {
    pulsing = false;
  });
}

function Core({ size, kind }: { size: number; kind: CoreKind }) {
  useEffect(startPulse, []);
  const box = size * 0.46;
  return (
    <View
      style={[
        styles.core,
        kind === 'area' && { borderRadius: box, borderColor: C.surge, borderWidth: 2 },
        { width: box, height: box, left: (size - box) / 2 - 1, top: (size - box) / 2 - 1 },
      ]}
    >
      <Animated.View
        style={{
          width: box * 0.44,
          height: box * 0.44,
          borderRadius: box,
          backgroundColor: kind === 'area' ? C.surge : '#fff',
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
        }}
      />
    </View>
  );
}

interface LedProps {
  color: string;
  size: number;
  b: number;
  glow?: number;
  core?: CoreKind | null;
  dim?: boolean;
  bright?: boolean;
}

export const Led = memo(function Led({ color, size, b, glow = 0, core = null, dim = false, bright = false }: LedProps) {
  return (
    <View
      style={[
        styles.led,
        { width: size, height: size, backgroundColor: color, opacity: dim ? 0.45 : 1 },
        glow > 0 && { boxShadow: halo(color, glow, 0.7) },
      ]}
    >
      <View style={[styles.shade, { height: b * 1.3 }]} />
      <View style={[styles.shine, { height: b }]} />
      <View
        style={[
          styles.halo,
          { width: size * 0.6, height: size * 0.6, borderRadius: size, left: size * 0.2 - 1, top: size * 0.14 - 1 },
        ]}
      />
      <View
        style={[
          styles.spot,
          { width: size * 0.2, height: size * 0.2, borderRadius: size, left: size * 0.4 - 1, top: size * 0.34 - 1 },
        ]}
      />
      {bright && <View style={styles.bright} />}
      {core && <Core size={size} kind={core} />}
    </View>
  );
});

export const Pad = memo(function Pad({ size }: { size: number }) {
  const hole = size * 0.38;
  return (
    <View style={[styles.pad, { width: size, height: size }]}>
      <View
        style={{
          width: hole,
          height: hole,
          borderRadius: hole,
          borderWidth: Math.max(1, size * 0.04),
          borderColor: C.padRing,
          backgroundColor: C.maskDark,
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  led: { borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  shine: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: 'rgba(255,255,255,0.3)' },
  halo: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.2)' },
  spot: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.85)' },
  bright: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.18)' },
  core: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: C.pad,
    backgroundColor: C.ink,
  },
  pad: {
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.padEdge,
    backgroundColor: C.padFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
