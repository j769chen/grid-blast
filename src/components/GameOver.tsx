import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fmt } from '../format';
import { C, F } from '../theme';

interface GameOverProps {
  visible: boolean;
  score: number;
  best: number;
  newBest: boolean;
  onAgain: () => void;
}

export function GameOver({ visible, score, best, newBest, onAgain }: GameOverProps) {
  if (!visible) return null;
  return (
    <View style={styles.scrim} aria-modal>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Short circuit</Text>
        <Text style={styles.sub}>No part fits the board.</Text>
        <Text style={styles.final} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(score)}
        </Text>
        <Text style={styles.best}>Peak {fmt(best)}</Text>
        {newBest && <Text style={styles.newBest}>New peak score!</Text>}
        <Pressable
          onPress={onAgain}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btn, pressed && { transform: [{ translateY: 2 }] }]}
        >
          <Text style={styles.btnText}>Play again</Text>
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
    borderColor: 'rgba(212,173,98,0.55)',
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
  btnText: { fontFamily: F.bold, fontSize: 18, letterSpacing: 1, textTransform: 'uppercase', color: C.ink },
});
