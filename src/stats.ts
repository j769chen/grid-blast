import type { DailyRecord } from './daily';
import type { PlaceResult } from './engine';

export interface Stats {
  games: number;
  total: number;
  lines: number;
  circuits: number;
  bestCombo: number;
  bestChain: number;
  perfects: number;
  dailies: number;
  bestDaily: number;
  bestStreak: number;
}

export const emptyStats = (): Stats => ({
  games: 0,
  total: 0,
  lines: 0,
  circuits: 0,
  bestCombo: 0,
  bestChain: 0,
  perfects: 0,
  dailies: 0,
  bestDaily: 0,
  bestStreak: 0,
});

export const recordMove = (s: Stats, res: PlaceResult): Stats => ({
  ...s,
  lines: s.lines + res.lineCount,
  circuits: s.circuits + (res.circuit.length ? 1 : 0),
  bestCombo: Math.max(s.bestCombo, res.state.combo),
  bestChain: Math.max(s.bestChain, res.surges.length),
  perfects: s.perfects + (res.perfect ? 1 : 0),
});

export const recordGame = (s: Stats, score: number): Stats => ({ ...s, games: s.games + 1, total: s.total + score });

export const recordDaily = (s: Stats, r: DailyRecord): Stats => ({
  ...s,
  dailies: s.dailies + 1,
  bestDaily: Math.max(s.bestDaily, r.score),
  bestStreak: Math.max(s.bestStreak, r.streak),
});

export const average = (s: Stats) => (s.games ? Math.round(s.total / s.games) : 0);
