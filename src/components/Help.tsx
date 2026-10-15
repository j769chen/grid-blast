import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COMBO_GRACE, lineScore, PTS, RAMP } from '../engine';
import { fmt } from '../format';
import { C, F, PART_COLORS } from '../theme';
import { CalendarIcon, RotateIcon, SoundIcon, VibrateIcon } from './Icons';
import { Led, PortSign } from './Led';
import { Note, Row, Section, Sheet, SheetButton } from './Sheet';

interface HelpProps {
  visible: boolean;
  onClose: () => void;
  hapticsOn: boolean;
  onToggleHaptics: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

const ICON = 22;
const SCORING: [string, string][] = [
  ['Each square placed', fmt(PTS.cell)],
  ...[1, 2, 3, 4].map((n): [string, string] => [`${n} line${n > 1 ? 's' : ''} at once`, fmt(lineScore(n))]),
  ['Each square on a circuit path', fmt(PTS.circuit)],
  ['Each square touching the path, outside cleared lines', fmt(PTS.arc)],
  ['Each extra square a core blasts', fmt(PTS.core)],
  ['Emptying the board', fmt(PTS.perfect)],
];

function Item({ icon, children }: { icon?: ReactNode; children: string }) {
  return (
    <View style={styles.item}>
      <View style={styles.icon}>{icon ?? <View style={styles.dot} />}</View>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

function Setting({ label, on, onToggle, icon }: { label: string; on: boolean; onToggle: () => void; icon: ReactNode }) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={4}
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={on}
      style={styles.setting}
    >
      <View style={styles.toggle}>{icon}</View>
      <Text style={styles.settingText}>{`${label} ${on ? 'on' : 'off'}`}</Text>
    </Pressable>
  );
}

export const Help = memo(function Help({
  visible,
  onClose,
  hapticsOn,
  onToggleHaptics,
  soundOn,
  onToggleSound,
}: HelpProps) {
  return (
    <Sheet
      visible={visible}
      title="How to play"
      onClose={onClose}
      footer={
        <>
          <View style={styles.settings}>
            <Setting
              label="Sound"
              on={soundOn}
              onToggle={onToggleSound}
              icon={<SoundIcon color={C.silk} off={!soundOn} />}
            />
            <Setting
              label="Vibration"
              on={hapticsOn}
              onToggle={onToggleHaptics}
              icon={<VibrateIcon color={C.silk} off={!hapticsOn} />}
            />
          </View>
          <SheetButton label="Got it" onPress={onClose} />
        </>
      }
    >
      <Section title="Place parts">
        <Item>Drag a part from the three sockets onto the board. Place all three to get a new set.</Item>
        <Item>Fill a row or column to clear it. Rows and columns clear together.</Item>
        <Item>The game ends when no part fits anywhere, in any rotation.</Item>
        <Item>{`Past ${fmt(RAMP.from)} points it gets harder: bigger parts, fewer cores and longer circuits.`}</Item>
      </Section>
      <Section title="Rotate">
        <Item icon={<RotateIcon size={18} color={C.silk} />}>
          Tap Rotate under a part to turn it. Rotations are free and unlimited.
        </Item>
        <Item icon={<RotateIcon size={18} color={C.pad} />}>
          A glowing Rotate button means the part only fits after turning. A greyed-out part doesn&apos;t fit at all.
        </Item>
      </Section>
      <Section title="Circuits">
        <Item icon={<PortSign sign="+" size={18} />}>
          Power in (+) and power out (−) sit beside the board, each next to one square.
        </Item>
        <Item icon={<PortSign sign="−" size={18} />}>
          Fill both of those squares and join them with filled squares touching edge to edge.
        </Item>
        <Item icon={<Led color={C.circuit} size={ICON} b={2} bright mark />}>
          The path and every filled square touching it clear. While you drag, they light up violet with a lightning
          mark.
        </Item>
        <Item>Both terminals then move somewhere new.</Item>
      </Section>
      <Section title="Cores">
        <Item icon={<Led color={PART_COLORS[1]} size={ICON} b={2} core="line" />}>
          A line core blasts its whole row and column.
        </Item>
        <Item icon={<Led color={PART_COLORS[3]} size={ICON} b={2} core="area" />}>
          An area core blasts the 3×3 square around it.
        </Item>
        <Item>A core goes off when it&apos;s cleared, and its blast can set off other cores.</Item>
      </Section>
      <Section title="Daily circuit">
        <Item icon={<CalendarIcon size={18} color={C.silk} />}>
          Tap the calendar for today&apos;s daily circuit. Everyone gets the same starting board and parts.
        </Item>
        <Item>You get one try a day. Finish it on consecutive days to build a streak, then share your result.</Item>
      </Section>
      <Section title="Scoring">
        {SCORING.map(([what, pts]) => (
          <Row key={what} label={what} value={pts} />
        ))}
        <Note>
          {`Line points are multiplied by your combo, which goes up by 1 with every move that clears something. It resets after ${COMBO_GRACE} moves in a row without a clear.`}
        </Note>
      </Section>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  icon: { width: ICON, minHeight: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.silkDim },
  body: { flex: 1, fontFamily: F.medium, fontSize: 15, lineHeight: 20, color: C.silk },
  settings: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggle: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.silkLine,
    backgroundColor: C.silkFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: { fontFamily: F.mono, fontSize: 12, letterSpacing: 1.3, textTransform: 'uppercase', color: C.silkDim },
});
