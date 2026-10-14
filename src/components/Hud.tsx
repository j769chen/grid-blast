import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fmt } from '../format';
import { C, F, type Metrics } from '../theme';
import { RestartIcon } from './Icons';

interface HudProps {
  score: number;
  best: number;
  armed: boolean;
  m: Metrics;
  onHelp: () => void;
  onRestart: () => void;
}

const COUNT_MS = 450;
const COUNT_STEP = 60;

function useCountUp(target: number) {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    if (from === target) return;
    const start = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / COUNT_MS);
      cur.current = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
      setShown(cur.current);
      if (k === 1) clearInterval(id);
    }, COUNT_STEP);
    return () => clearInterval(id);
  }, [target]);
  return shown;
}

export const Hud = memo(function Hud({ score, best, armed, m, onHelp, onRestart }: HudProps) {
  const shown = useCountUp(score);
  const bump = useSharedValue(1);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));

  useEffect(() => {
    if (!score) return;
    bump.set(withSequence(withTiming(1.1, { duration: 0 }), withSpring(1, { stiffness: 230, damping: 16 })));
  }, [score, bump]);

  return (
    <View style={[styles.hud, { width: m.size }]}>
      <View style={styles.side} accessible accessibilityLabel={`Peak score ${fmt(best)}`}>
        <Text style={styles.silk}>Peak</Text>
        <Text style={styles.best} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(best)}
        </Text>
      </View>
      <View style={styles.center}>
        <Animated.Text
          style={[
            styles.score,
            {
              fontSize: Math.min(54, Math.max(38, m.size * 0.12)),
              maxWidth: m.size * 0.46,
            },
            bumpStyle,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`Score ${fmt(score)}`}
        >
          {fmt(shown)}
        </Animated.Text>
      </View>
      <View style={[styles.side, styles.tools]}>
        <Pressable onPress={onHelp} accessibilityRole="button" accessibilityLabel="How to play" style={styles.btn}>
          <Text style={styles.help}>?</Text>
        </Pressable>
        <Pressable
          onPress={onRestart}
          accessibilityRole="button"
          accessibilityLabel="New game"
          style={[styles.btn, armed && styles.armed]}
        >
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
  score: {
    fontFamily: F.bold,
    color: C.silk,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(255,226,161,0.35)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  btn: {
    height: 36,
    minWidth: 36,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.silkLine,
    backgroundColor: C.silkFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  armed: { backgroundColor: C.danger, borderColor: C.danger },
  btnText: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: C.silk },
  help: { fontFamily: F.bold, fontSize: 19, lineHeight: 22, color: C.silk },
});
