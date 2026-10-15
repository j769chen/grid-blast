import { describe, expect, it } from '@jest/globals';

import { newGame, type PlaceResult, type Surge } from '../engine';
import { average, emptyStats, recordDaily, recordGame, recordMove } from '../stats';

const move = (over: Partial<PlaceResult> & { combo?: number } = {}) => {
  const { combo = 0, ...res } = over;
  return {
    state: { ...newGame(0, () => 0.5), combo },
    lineCount: 0,
    circuit: [] as number[],
    surges: [] as Surge[],
    perfect: false,
    ...res,
  } as PlaceResult;
};

describe('recordMove', () => {
  it('adds up lines, circuits and emptied boards', () => {
    const stats = [
      move({ lineCount: 2, combo: 1 }),
      move({ circuit: [1, 2, 3], combo: 2 }),
      move({ lineCount: 1, perfect: true, combo: 3 }),
      move(),
    ].reduce(recordMove, emptyStats());
    expect(stats).toMatchObject({ lines: 3, circuits: 1, perfects: 1 });
  });

  it('keeps the best combo and the most cores set off by one move', () => {
    const chain = (n: number) => Array.from({ length: n }, (_, idx): Surge => ({ idx, kind: 'line' }));
    const stats = [
      move({ combo: 4, surges: chain(1) }),
      move({ combo: 5, surges: chain(3) }),
      move({ combo: 0, surges: chain(2) }),
    ].reduce(recordMove, emptyStats());
    expect(stats).toMatchObject({ bestCombo: 5, bestChain: 3 });
  });
});

describe('recordGame', () => {
  it('counts games and averages their final scores', () => {
    expect(average(emptyStats())).toBe(0);
    const stats = [1000, 2500, 0].reduce(recordGame, emptyStats());
    expect(stats).toMatchObject({ games: 3, total: 3500 });
    expect(average(stats)).toBe(1167);
  });
});

describe('recordDaily', () => {
  it('counts dailies and keeps the best score and streak', () => {
    const stats = [
      { day: 4, score: 900, circuits: 1, streak: 3 },
      { day: 5, score: 400, circuits: 0, streak: 4 },
      { day: 9, score: 600, circuits: 2, streak: 1 },
    ].reduce(recordDaily, emptyStats());
    expect(stats).toMatchObject({ dailies: 3, bestDaily: 900, bestStreak: 4 });
  });
});
