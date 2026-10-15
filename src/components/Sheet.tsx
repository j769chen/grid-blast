import { useRef, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F } from '../theme';

interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}

export function Sheet({ visible, title, onClose, footer, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.scrim, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={[styles.card, { maxHeight: height - insets.top - insets.bottom - 32 }]}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.content}
            indicatorStyle="white"
            onLayout={() => scroll.current?.flashScrollIndicators()}
          >
            {children}
          </ScrollView>
          <View style={styles.footer}>{footer}</View>
        </View>
      </View>
    </Modal>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function Note({ children }: { children: string }) {
  return <Text style={styles.note}>{children}</Text>;
}

export function SheetButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, pressed && { transform: [{ translateY: 2 }] }]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: C.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  card: {
    width: '100%',
    maxWidth: 420,
    paddingTop: 20,
    paddingBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.padLine,
    backgroundColor: C.maskDark,
  },
  title: { fontFamily: F.bold, fontSize: 22, color: C.silk, textAlign: 'center', marginBottom: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 8, gap: 18 },
  section: { gap: 8 },
  heading: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1.7, textTransform: 'uppercase', color: C.pad },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  label: { flex: 1, fontFamily: F.medium, fontSize: 15, lineHeight: 20, color: C.silk },
  value: {
    fontFamily: F.semi,
    fontSize: 15,
    lineHeight: 20,
    color: C.pad,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  note: { fontFamily: F.medium, fontSize: 14, lineHeight: 19, color: C.silkDim },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: C.silkLine,
  },
  btn: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 6,
    backgroundColor: C.pad,
  },
  btnText: { fontFamily: F.bold, fontSize: 17, letterSpacing: 1, textTransform: 'uppercase', color: C.ink },
});
