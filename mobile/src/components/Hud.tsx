import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { fmt, MAX_CHARGE } from '../engine';
import { C, F, type Metrics } from '../theme';
import { RestartIcon, VibrateIcon } from './Icons';

interface HudProps {
  score: number;
  best: number;
  charge: number;
  hapticsOn: boolean;
  armed: boolean;
  shakeKey: number;
  m: Metrics;
  onToggleHaptics: () => void;
  onRestart: () => void;
}

function useCountUp(target: number) {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      if (cur.current === target) return;
      const diff = target - cur.current;
      cur.current += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.12));
      setShown(cur.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

export const Hud = memo(function Hud({ score, best, charge, hapticsOn, armed, shakeKey, m, onToggleHaptics, onRestart }: HudProps) {
  const shown = useCountUp(score);
  const [shake] = useState(() => new Animated.Value(0));
  const [bump] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!shakeKey) return;
    Animated.sequence(
      [-5, 5, -3, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 60, useNativeDriver: true })),
    ).start();
  }, [shakeKey, shake]);

  useEffect(() => {
    if (!score) return;
    bump.setValue(1.1);
    Animated.spring(bump, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [score, bump]);

  return (
    <View style={[styles.hud, { width: m.size }]}>
      <View style={styles.side}>
        <Text style={styles.silk}>Peak</Text>
        <Text style={styles.best} numberOfLines={1} adjustsFontSizeToFit>{fmt(best)}</Text>
      </View>
      <View style={styles.center}>
        <Animated.Text
          style={[styles.score, { fontSize: Math.min(54, Math.max(38, m.size * 0.12)), maxWidth: m.size * 0.46, transform: [{ scale: bump }] }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLiveRegion="polite"
        >
          {fmt(shown)}
        </Animated.Text>
        <Animated.View style={[styles.charge, { transform: [{ translateX: shake }] }]} accessibilityLabel={`Rotation charges: ${charge} of ${MAX_CHARGE}`}>
          <Text style={styles.silk}>Rot</Text>
          <View style={styles.pips}>
            {Array.from({ length: MAX_CHARGE }, (_, i) => (
              <View key={i} style={[styles.pip, i < charge && styles.pipOn]} />
            ))}
          </View>
        </Animated.View>
      </View>
      <View style={[styles.side, styles.tools]}>
        <Pressable onPress={onToggleHaptics} accessibilityRole="button" accessibilityLabel={hapticsOn ? 'Turn vibration off' : 'Turn vibration on'} style={styles.btn}>
          <VibrateIcon color={C.silk} off={!hapticsOn} />
        </Pressable>
        <Pressable onPress={onRestart} accessibilityRole="button" accessibilityLabel="New game" style={[styles.btn, armed && styles.armed]}>
          {armed ? <Text style={styles.btnText}>Restart?</Text> : <RestartIcon color={C.silk} />}
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  hud: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, gap: 2 },
  tools: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  center: { alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  silk: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: C.silkDim },
  best: { fontFamily: F.bold, fontSize: 20, color: C.pad, fontVariant: ['tabular-nums'] },
  score: { fontFamily: F.bold, color: C.silk, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(255,226,161,0.35)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } },
  charge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pips: { flexDirection: 'row', gap: 3, padding: 2, borderWidth: 1, borderColor: C.silkDim, borderRadius: 3 },
  pip: { width: 10, height: 8, borderRadius: 1, backgroundColor: 'rgba(238,242,230,0.12)' },
  pipOn: { backgroundColor: C.pad, shadowColor: C.pad, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  btn: { height: 36, minWidth: 36, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: C.silkLine, backgroundColor: C.silkFill, alignItems: 'center', justifyContent: 'center' },
  armed: { backgroundColor: C.danger, borderColor: C.danger },
  btnText: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.silk },
});
