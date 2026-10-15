import { describe, expect, it } from '@jest/globals';

import { advanceDaily, dailyRand, dayNumber, finishDaily, shareText, startDaily } from '../daily';
import type { PlaceResult } from '../engine';

describe('dayNumber', () => {
  it('counts local calendar days from launch, whatever the hour or daylight saving', () => {
    expect(dayNumber(new Date(2026, 9, 14, 0, 0))).toBe(1);
    expect(dayNumber(new Date(2026, 9, 14, 23, 59))).toBe(1);
    expect(dayNumber(new Date(2026, 9, 20, 12))).toBe(7);
    expect(dayNumber(new Date(2026, 10, 1, 12))).toBe(19);
    expect(dayNumber(new Date(2026, 10, 2, 0, 30))).toBe(20);
    expect(dayNumber(new Date(2027, 2, 15, 12))).toBe(153);
  });
});

describe('daily runs', () => {
  it('give everyone the same opening for a day, and a different one the next day', () => {
    expect(startDaily(5)).toEqual(startDaily(5));
    expect(startDaily(6).game).not.toEqual(startDaily(5).game);
  });

  it('draw the same deals for the same move on the same day', () => {
    const draw = (day: number, move: number) => {
      const rand = dailyRand(day, move);
      return [rand(), rand(), rand()];
    };
    expect(draw(9, 3)).toEqual(draw(9, 3));
    expect(draw(9, 4)).not.toEqual(draw(9, 3));
    expect(draw(10, 3)).not.toEqual(draw(9, 3));
  });

  it('count moves and completed circuits', () => {
    const run = startDaily(3);
    const plain = { state: run.game, circuit: [] as number[] } as PlaceResult;
    const wired = { state: run.game, circuit: [1, 2, 3] } as PlaceResult;
    expect(advanceDaily(advanceDaily(run, plain), wired)).toMatchObject({ moves: 2, circuits: 1 });
  });
});

describe('finishDaily', () => {
  const run = { ...startDaily(10), circuits: 2 };

  it('extends the streak only from yesterday', () => {
    expect(finishDaily(null, run)).toEqual({ day: 10, score: 0, circuits: 2, streak: 1 });
    expect(finishDaily({ day: 9, score: 500, circuits: 1, streak: 4 }, run).streak).toBe(5);
    expect(finishDaily({ day: 8, score: 500, circuits: 1, streak: 4 }, run).streak).toBe(1);
  });
});

describe('shareText', () => {
  it('sums up the day', () => {
    expect(shareText({ day: 12, score: 14320, circuits: 1, streak: 5 })).toBe(
      'Overclock Daily #12\n⚡ 14,320 points\n🔌 1 circuit\n🔥 5-day streak',
    );
    expect(shareText({ day: 3, score: 0, circuits: 0, streak: 1 })).toContain('🔌 0 circuits');
  });
});
