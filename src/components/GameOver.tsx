import { useEffect, useRef, useState, type Ref } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { shareText, streakText, type DailyRecord } from '../daily';
import { fmt } from '../format';
import { C, F } from '../theme';

interface GameOverProps {
  visible: boolean;
  score: number;
  best: number;
  newBest: boolean;
  daily: DailyRecord | null;
  onAgain: () => void;
}

function ShareButton({ record, ref }: { record: DailyRecord; ref: Ref<View> }) {
  const [copied, setCopied] = useState(false);
  const share = () => {
    const message = shareText(record);
    Share.share({ message }).catch((e: unknown) => {
      if (e instanceof Error && e.name === 'AbortError') return;
      navigator.clipboard?.writeText(message).then(
        () => setCopied(true),
        () => {},
      );
    });
  };
  return (
    <Pressable
      ref={ref}
      onPress={share}
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Result copied' : 'Share result'}
      style={({ pressed }) => [styles.btn, styles.wide, pressed && styles.pressed]}
    >
      <Text style={styles.btnText}>{copied ? 'Copied' : 'Share'}</Text>
    </Pressable>
  );
}

export function GameOver({ visible, score, best, newBest, daily, onAgain }: GameOverProps) {
  const first = useRef<View>(null);
  useEffect(() => {
    if (visible && Platform.OS === 'web') first.current?.focus();
  }, [visible]);
  if (!visible) return null;
  return (
    <View style={styles.scrim} aria-modal>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{daily ? `Daily #${daily.day}` : 'Short circuit'}</Text>
        <Text style={styles.sub}>No part fits the board.</Text>
        <Text style={styles.final} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(score)}
        </Text>
        <Text style={styles.best}>{daily ? streakText(daily.streak) : `Peak ${fmt(best)}`}</Text>
        {newBest && !daily && <Text style={styles.newBest}>New peak score!</Text>}
        {daily && <ShareButton record={daily} ref={first} />}
        <Pressable
          ref={daily ? undefined : first}
          onPress={onAgain}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btn, daily && [styles.wide, styles.quiet], pressed && styles.pressed]}
        >
          <Text style={[styles.btnText, daily && styles.quietText]}>{daily ? 'Back to endless' : 'Play again'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: C.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    paddingTop: 26,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.padLine,
    backgroundColor: C.maskDark,
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1.7, textTransform: 'uppercase', color: C.silkDim },
  sub: { fontFamily: F.medium, fontSize: 15, color: C.silkDim },
  final: { marginTop: 6, fontFamily: F.bold, fontSize: 56, color: C.silk, fontVariant: ['tabular-nums'] },
  best: { fontFamily: F.semi, fontSize: 19, color: C.pad },
  newBest: { fontFamily: F.bold, fontSize: 15, color: C.pad },
  btn: { marginTop: 14, paddingVertical: 13, paddingHorizontal: 30, borderRadius: 6, backgroundColor: C.pad },
  pressed: { transform: [{ translateY: 2 }] },
  wide: { alignSelf: 'stretch', alignItems: 'center' },
  quiet: { marginTop: 4, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.silkLine },
  btnText: { fontFamily: F.bold, fontSize: 18, letterSpacing: 1, textTransform: 'uppercase', color: C.ink },
  quietText: { color: C.silk },
});
