import { memo, useEffect, useMemo, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { describePiece } from '../describe';
import { overBuffer, type DragShared } from '../drag';
import { BUFFER, turnsToFit, type Piece } from '../engine';
import { BUFFER_SCALE, C, F, glow, PART_COLORS, type Metrics } from '../theme';
import { RotateIcon } from './Icons';
import { Led } from './Led';

const CHOOSE = [{ name: 'activate' as const, label: 'Choose' }];
const CHOOSE_OR_STORE = [...CHOOSE, { name: 'store', label: 'Store in buffer' }];

export interface SlotAnim {
  key: number;
  kind: 'deal' | 'spin';
}

function MiniPiece({ p, m, kind, index }: { p: Piece; m: Metrics; kind: SlotAnim['kind']; index: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    const deal = kind === 'deal';
    v.set(
      withDelay(deal ? index * 50 : 0, withTiming(1, { duration: deal ? 300 : 220, easing: Easing.out(Easing.cubic) })),
    );
  }, [v, kind, index]);
  const motion = useAnimatedStyle(() =>
    kind === 'deal'
      ? {
          opacity: v.get(),
          transform: [
            { translateY: interpolate(v.get(), [0, 1], [24, 0]) },
            { scale: interpolate(v.get(), [0, 1], [0.6, 1]) },
          ],
        }
      : {
          opacity: 1,
          transform: [
            { rotate: `${interpolate(v.get(), [0, 1], [-90, 0])}deg` },
            { scale: interpolate(v.get(), [0, 1], [0.85, 1]) },
          ],
        },
  );

  const step = m.mini + m.miniGap;
  return (
    <Animated.View style={[{ width: p.w * step - m.miniGap, height: p.h * step - m.miniGap }, motion]}>
      {p.cells.map(([r, c], k) => (
        <View key={k} style={{ position: 'absolute', left: c * step, top: r * step }}>
          <Led
            color={PART_COLORS[p.c]}
            size={m.mini}
            b={m.size * 0.0045}
            glow={m.size * 0.012}
            core={k === p.core ? p.coreKind : null}
          />
        </View>
      ))}
    </Animated.View>
  );
}

function HideWhileDragged({ i, drag, children }: { i: number; drag: DragShared; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({
    opacity: drag.slot.get() === i || drag.landing.get()[i] || drag.back.get()[i] < 1 ? 0 : 1,
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

interface TrayProps {
  tray: (Piece | null)[];
  grid: number[];
  m: Metrics;
  anims: SlotAnim[];
  gestures: PanGesture[];
  slotRefs: Ref<View>[];
  onTrayLayout: () => void;
  drag: DragShared;
  onRotate: (i: number) => void;
  selected: number | null;
  onSelect: (i: number) => void;
  buffer: Piece | null;
  stashed: boolean;
  onStash: (i: number) => void;
}

export const Tray = memo(function Tray({
  tray,
  grid,
  m,
  anims,
  gestures,
  slotRefs,
  onTrayLayout,
  drag,
  onRotate,
  selected,
  onSelect,
  buffer,
  stashed,
  onStash,
}: TrayProps) {
  const turns = tray.map((p) => (p ? turnsToFit(grid, p) : -1));
  const small = useMemo(() => ({ ...m, mini: m.mini * BUFFER_SCALE, miniGap: m.miniGap * BUFFER_SCALE }), [m]);
  const bufferFits = !!buffer && turnsToFit(grid, buffer) >= 0;
  return (
    <View onLayout={onTrayLayout} style={[styles.dock, { width: m.size }]}>
      <View style={[styles.row, { height: m.size * 0.34 }]}>
        {tray.map((p, i) => (
          <GestureDetector key={i} gesture={gestures[i]}>
            <View
              ref={slotRefs[i]}
              accessible
              accessibilityRole={p ? 'button' : undefined}
              accessibilityLabel={p ? `U${i + 1}, ${describePiece(p)}` : `U${i + 1}, empty`}
              accessibilityHint={p ? 'Chooses this part, then pick a board square to place it' : undefined}
              accessibilityState={{ selected: selected === i }}
              accessibilityActions={p ? (stashed ? CHOOSE : CHOOSE_OR_STORE) : undefined}
              onAccessibilityAction={
                p ? (e) => (e.nativeEvent.actionName === 'store' ? onStash(i) : onSelect(i)) : undefined
              }
              style={[styles.slot, selected === i && styles.chosen]}
            >
              <Text style={styles.label}>U{i + 1}</Text>
              {p && (
                <HideWhileDragged i={i} drag={drag}>
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
          const ready = !!p && turns[i] > 0;
          return (
            <View key={i} style={styles.rotCell}>
              <Pressable
                onPress={() => onRotate(i)}
                disabled={!p}
                accessibilityRole="button"
                accessibilityLabel={`Rotate U${i + 1}`}
                accessibilityState={{ disabled: !p }}
                accessibilityElementsHidden={!p}
                importantForAccessibility={p ? 'auto' : 'no-hide-descendants'}
                style={({ pressed }) => [styles.rot, ready && styles.rotReady, { opacity: !p ? 0 : pressed ? 0.7 : 1 }]}
              >
                <RotateIcon color={ready ? C.pad : C.silk} />
                <Text style={[styles.rotText, ready && { color: C.pad }]}>Rotate</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={[styles.row, styles.bufferRow, { height: m.size * 0.2 }]}>
        <GestureDetector gesture={gestures[BUFFER]}>
          <BufferSocket
            slotRef={slotRefs[BUFFER]}
            drag={drag}
            label={buffer ? `Buffer, ${describePiece(buffer)}` : 'Buffer, empty'}
            selected={selected === BUFFER}
            onSelect={buffer ? () => onSelect(BUFFER) : undefined}
          >
            <Text style={styles.label}>BUF</Text>
            {buffer && (
              <HideWhileDragged i={BUFFER} drag={drag}>
                <View style={{ opacity: bufferFits ? 1 : 0.3 }}>
                  <MiniPiece key={anims[BUFFER].key} p={buffer} m={small} kind={anims[BUFFER].kind} index={0} />
                </View>
              </HideWhileDragged>
            )}
          </BufferSocket>
        </GestureDetector>
        <View style={styles.bufferSide}>
          <Text style={[styles.bufferNote, stashed && styles.bufferUsed]}>
            {stashed ? 'Buffer used this set' : 'Drag a part here to store it · 1 swap per set'}
          </Text>
          <Pressable
            onPress={() => onRotate(BUFFER)}
            disabled={!buffer}
            accessibilityRole="button"
            accessibilityLabel="Rotate buffer"
            accessibilityState={{ disabled: !buffer }}
            style={({ pressed }) => [styles.rot, styles.rotSmall, { opacity: !buffer ? 0.35 : pressed ? 0.7 : 1 }]}
          >
            <RotateIcon color={C.silk} />
            <Text style={styles.rotText}>Rotate</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

function BufferSocket({
  slotRef,
  drag,
  label,
  selected,
  onSelect,
  children,
}: {
  slotRef: Ref<View>;
  drag: DragShared;
  label: string;
  selected: boolean;
  onSelect?: () => void;
  children: ReactNode;
}) {
  const hover = useAnimatedStyle(() => {
    const over = overBuffer(drag, drag.slot.get());
    return { borderColor: over ? C.pad : C.padEdge, backgroundColor: over ? C.padFaint : 'transparent' };
  });
  return (
    <Animated.View
      ref={slotRef}
      accessible
      accessibilityRole={onSelect ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={onSelect ? 'Chooses the stored part, then pick a board square to place it' : undefined}
      accessibilityState={{ selected }}
      accessibilityActions={onSelect ? CHOOSE : undefined}
      onAccessibilityAction={onSelect}
      style={[styles.slot, styles.buffer, selected && styles.chosen, hover]}
    >
      {children}
    </Animated.View>
  );
}

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
  chosen: { borderStyle: 'solid', borderWidth: 2, borderColor: C.pad },
  bufferRow: { marginTop: 4 },
  buffer: { flex: 1, borderColor: C.padEdge },
  bufferSide: { flex: 2, justifyContent: 'center', alignItems: 'flex-start', gap: 8, paddingLeft: 4 },
  bufferNote: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: C.silkDim },
  bufferUsed: { color: C.danger },
  rotSmall: { height: 30 },
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
    boxShadow: glow(C.pad, 8, 0.6),
  },
  rotText: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: C.silk },
});
