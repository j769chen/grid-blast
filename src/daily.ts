import { newGame, seeded, type GameState, type PlaceResult } from './engine';
import { fmt } from './format';

export interface DailyRun {
  day: number;
  moves: number;
  circuits: number;
  game: GameState;
}

export interface DailyRecord {
  day: number;
  score: number;
  circuits: number;
  streak: number;
}

const LAUNCH = Date.UTC(2026, 9, 14);
const DAY_MS = 86_400_000;

export const dayNumber = (d: Date) =>
  Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - LAUNCH) / DAY_MS) + 1;

export const dailyRand = (day: number, move: number) =>
  seeded(Math.imul(day, 0x9e3779b1) ^ Math.imul(move + 1, 0x85ebca6b));

export const startDaily = (day: number): DailyRun => ({
  day,
  moves: 0,
  circuits: 0,
  game: newGame(0, dailyRand(day, -1)),
});

export const advanceDaily = (run: DailyRun, res: PlaceResult): DailyRun => ({
  ...run,
  moves: run.moves + 1,
  circuits: run.circuits + (res.circuit.length ? 1 : 0),
  game: res.state,
});

export const finishDaily = (prev: DailyRecord | null, run: DailyRun): DailyRecord => ({
  day: run.day,
  score: run.game.score,
  circuits: run.circuits,
  streak: prev?.day === run.day - 1 ? prev.streak + 1 : 1,
});

export const currentStreak = (r: DailyRecord | null, today: number) => (r && r.day >= today - 1 ? r.streak : 0);

export const streakText = (streak: number) => `${streak}-day streak`;

export const shareText = (r: DailyRecord) =>
  [
    `Overclock Daily #${r.day}`,
    `⚡ ${fmt(r.score)} points`,
    `🔌 ${r.circuits} circuit${r.circuits === 1 ? '' : 's'}`,
    `🔥 ${streakText(r.streak)}`,
  ].join('\n');
