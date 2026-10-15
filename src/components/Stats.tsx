import { memo } from 'react';

import { fmt } from '../format';
import { average, type Stats as StatsData } from '../stats';
import { Note, Row, Section, Sheet, SheetButton } from './Sheet';

interface StatsProps {
  visible: boolean;
  onClose: () => void;
  stats: StatsData;
  peak: number;
  streak: number;
}

export const Stats = memo(function Stats({ visible, onClose, stats, peak, streak }: StatsProps) {
  return (
    <Sheet visible={visible} title="Stats" onClose={onClose} footer={<SheetButton label="Done" onPress={onClose} />}>
      <Section title="Endless">
        <Row label="Games played" value={fmt(stats.games)} />
        <Row label="Average score" value={fmt(average(stats))} />
        <Row label="Peak score" value={fmt(peak)} />
        <Note>A game counts when no part fits, or when you restart after placing a part.</Note>
      </Section>
      <Section title="Daily circuit">
        <Row label="Dailies played" value={fmt(stats.dailies)} />
        <Row label="Best daily score" value={fmt(stats.bestDaily)} />
        <Row label="Current streak" value={fmt(streak)} />
        <Row label="Best streak" value={fmt(stats.bestStreak)} />
      </Section>
      <Section title="All games">
        <Row label="Lines cleared" value={fmt(stats.lines)} />
        <Row label="Circuits completed" value={fmt(stats.circuits)} />
        <Row label="Best combo" value={fmt(stats.bestCombo)} />
        <Row label="Most cores in one move" value={fmt(stats.bestChain)} />
        <Row label="Boards emptied" value={fmt(stats.perfects)} />
      </Section>
    </Sheet>
  );
});
