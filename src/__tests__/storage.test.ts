import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { startDaily } from '../daily';
import { cellIndex, circuitPath, MIN_CIRCUIT, newGame, shortestCircuit, type Terminals } from '../engine';
import {
  clearSavedGame,
  loadSaved,
  parseDaily,
  parseRecord,
  parseSave,
  parseStats,
  saveDaily,
  saveGame,
  saveHaptics,
  saveHelpSeen,
  saveRecord,
  saveSound,
  saveStats,
  SAVE_VERSION,
} from '../storage';
import { emptyStats } from '../stats';

const game = (best = 0) => newGame(best, () => 0.5);
const stored = (key: string) => AsyncStorage.getItem(key);
const flush = () => new Promise((r) => setTimeout(r, 0));

async function withFailedReads(keys: string[], run: () => Promise<void>) {
  const getItem = jest.mocked(AsyncStorage.getItem);
  const real = getItem.getMockImplementation()!;
  getItem.mockImplementation((key) => (keys.includes(key) ? Promise.reject(new Error('io')) : real(key)));
  try {
    await run();
  } finally {
    getItem.mockImplementation(real);
  }
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('parseSave', () => {
  it('rejects missing, malformed and unknown-version saves', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('{not json')).toBeNull();
    for (const v of [0, SAVE_VERSION + 1, 2.5, String(SAVE_VERSION)]) {
      expect(parseSave(JSON.stringify({ v, game: game(), startBest: 0 }))).toBeNull();
    }
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION, game: { ...game(), tray: [] }, startBest: 0 }))).toBeNull();
  });

  it('reads a versioned save and clamps its starting best', () => {
    const g = { ...game(), score: 900, best: 900 };
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION, game: g, startBest: 400 }))).toEqual({
      game: g,
      startBest: 400,
    });
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION, game: g, startBest: 5000 }))?.startBest).toBe(900);
    for (const startBest of [-1, '400', null]) {
      expect(parseSave(JSON.stringify({ v: SAVE_VERSION, game: g, startBest }))?.startBest).toBe(900);
    }
  });

  it('reads a legacy unversioned save', () => {
    const g = { ...game(), best: 300 };
    expect(parseSave(JSON.stringify(g))).toEqual({ game: g, startBest: 300 });
  });

  it('repairs a legacy save whose terminals are already connected', () => {
    const terminals: Terminals = { plus: { side: 'left', at: 0 }, minus: { side: 'top', at: 6 } };
    const g = { ...game(), terminals };
    for (let c = 0; c < 8; c++) g.grid[cellIndex(0, c)] = c < 7 ? 1 : -1;
    expect(circuitPath(g.grid, terminals)).not.toBeNull();
    const parsed = parseSave(JSON.stringify(g))!;
    expect(circuitPath(parsed.game.grid, parsed.game.terminals)).toBeNull();
  });
});

describe('version 1 saves', () => {
  it('migrate boolean cores to line cores', () => {
    const g = game();
    const filled = g.grid.findIndex((v) => v >= 0);
    const old = {
      ...g,
      cores: g.cores.map((_, k) => k === filled),
      tray: g.tray.map((p) => {
        if (!p) return p;
        const { coreKind: _kind, ...rest } = p;
        return rest;
      }),
    };
    for (const raw of [JSON.stringify({ v: 1, game: old, startBest: 0 }), JSON.stringify(old)]) {
      const parsed = parseSave(raw)!;
      expect(parsed.game.cores[filled]).toBe('line');
      expect(parsed.game.cores.filter(Boolean)).toHaveLength(1);
      expect(parsed.game.tray.every((p) => !p || p.coreKind === 'line')).toBe(true);
    }
  });

  it('from before terminals migrate through every version to a playable game', () => {
    const { terminals: _t, ...g } = game();
    const filled = g.grid.findIndex((v) => v >= 0);
    const old = {
      ...g,
      cores: g.cores.map((_, k) => k === filled),
      tray: g.tray.map((p) => {
        if (!p) return p;
        const { coreKind: _kind, ...rest } = p;
        return rest;
      }),
    };
    const parsed = parseSave(JSON.stringify({ v: 1, game: old, startBest: 0 }))!;
    expect(parsed.game.cores[filled]).toBe('line');
    expect(parsed.game.tray.every((p) => !p || p.coreKind === 'line')).toBe(true);
    expect(shortestCircuit(parsed.game.terminals)).toBeGreaterThanOrEqual(MIN_CIRCUIT);
    expect(circuitPath(parsed.game.grid, parsed.game.terminals)).toBeNull();
  });
});

describe('version 2 saves', () => {
  it('gain unconnected terminals', () => {
    const { terminals: _t, ...old } = game();
    const parsed = parseSave(JSON.stringify({ v: 2, game: old, startBest: 0 }))!;
    expect(shortestCircuit(parsed.game.terminals)).toBeGreaterThanOrEqual(MIN_CIRCUIT);
    expect(circuitPath(parsed.game.grid, parsed.game.terminals)).toBeNull();
  });
});

describe('version 5 saves', () => {
  it('move a stored part into an empty tray slot and drop the buffer', () => {
    const g = game();
    const stored = g.tray[0];
    const old = { ...g, tray: [null, g.tray[1], g.tray[2]], buffer: stored, stashed: true };
    const parsed = parseSave(JSON.stringify({ v: 5, game: old, startBest: 0 }))!;
    expect(parsed.game.tray).toEqual([stored, g.tray[1], g.tray[2]]);
    expect(parsed.game).not.toHaveProperty('buffer');
    expect(parsed.game).not.toHaveProperty('stashed');
  });

  it('drop the stored part when the tray is full', () => {
    const g = game();
    const parsed = parseSave(
      JSON.stringify({ v: 5, game: { ...g, buffer: g.tray[0], stashed: false }, startBest: 0 }),
    )!;
    expect(parsed.game.tray).toEqual(g.tray);
  });
});

describe('version 4 saves', () => {
  it('get new terminals when the old row and column were too close for a circuit', () => {
    const old = { ...game(), terminals: { row: 1, col: 1 } };
    const parsed = parseSave(JSON.stringify({ v: 4, game: old, startBest: 0 }))!;
    expect(shortestCircuit(parsed.game.terminals)).toBeGreaterThanOrEqual(MIN_CIRCUIT);
  });

  it('turn row and column terminals into left and top edge terminals', () => {
    const old = { ...game(), terminals: { row: 5, col: 2 } };
    const parsed = parseSave(JSON.stringify({ v: 4, game: old, startBest: 0 }))!;
    expect(parsed.game.terminals).toEqual({ plus: { side: 'left', at: 5 }, minus: { side: 'top', at: 2 } });
  });
});

describe('loadSaved and saveGame', () => {
  it('load back exactly the game that was saved', async () => {
    const base = game();
    const g = { ...base, score: 1234, best: 1234, combo: 2, idle: 1, tray: [null, base.tray[1], base.tray[2]] };
    g.cores[g.grid.findIndex((v) => v >= 0)] = 'area';
    await loadSaved();
    saveGame(g, 250);
    await flush();
    expect((await loadSaved()).saved).toEqual({ game: g, startBest: 250 });
  });

  it('writes a versioned game and only raises the stored best', async () => {
    await AsyncStorage.setItem('overclock.best', '500');
    expect((await loadSaved()).best).toBe(500);
    saveGame({ ...game(), score: 200, best: 200 }, 0);
    await flush();
    expect(await stored('overclock.best')).toBe('500');
    expect(JSON.parse((await stored('overclock.game'))!)).toMatchObject({ v: SAVE_VERSION, startBest: 0 });
    saveGame({ ...game(), score: 600, best: 600 }, 0);
    await flush();
    expect(await stored('overclock.best')).toBe('600');
  });

  it('ignores a stored best that is not a whole number in range', async () => {
    for (const raw of ['1e400', '1e17', '12.5', '-3', 'abc']) {
      await AsyncStorage.setItem('overclock.best', raw);
      expect((await loadSaved()).best).toBe(0);
    }
    await AsyncStorage.setItem('overclock.best', '500');
    expect((await loadSaved()).best).toBe(500);
  });

  it('only clears a saved game it was able to read', async () => {
    await AsyncStorage.setItem('overclock.game', 'kept');
    await withFailedReads(['overclock.game'], async () => {
      await loadSaved();
    });
    await clearSavedGame();
    expect(await stored('overclock.game')).toBe('kept');
    await loadSaved();
    await clearSavedGame();
    expect(await stored('overclock.game')).toBeNull();
  });

  it('does not overwrite saves it failed to read', async () => {
    await AsyncStorage.setItem('overclock.best', '900');
    await AsyncStorage.setItem('overclock.game', 'kept');
    await withFailedReads(['overclock.game', 'overclock.best'], async () => {
      expect(await loadSaved()).toEqual({
        saved: null,
        best: 0,
        haptics: true,
        sound: true,
        helpSeen: false,
        daily: null,
        record: null,
        stats: emptyStats(),
      });
    });
    saveGame({ ...game(), score: 50, best: 50 }, 0);
    await flush();
    expect(await stored('overclock.best')).toBe('900');
    expect(await stored('overclock.game')).toBe('kept');
  });
});

describe('vibration setting', () => {
  it('is on until switched off, and remembers each change', async () => {
    expect((await loadSaved()).haptics).toBe(true);
    saveHaptics(false);
    await flush();
    expect((await loadSaved()).haptics).toBe(false);
    saveHaptics(true);
    await flush();
    expect((await loadSaved()).haptics).toBe(true);
  });
});

describe('sound setting', () => {
  it('is on until switched off, and remembers each change', async () => {
    expect((await loadSaved()).sound).toBe(true);
    saveSound(false);
    await flush();
    expect((await loadSaved()).sound).toBe(false);
    saveSound(true);
    await flush();
    expect((await loadSaved()).sound).toBe(true);
  });
});

describe('help panel flag', () => {
  it('is unset until the panel has been seen', async () => {
    expect((await loadSaved()).helpSeen).toBe(false);
    saveHelpSeen();
    await flush();
    expect(await stored('overclock.helpSeen')).toBe('true');
    expect((await loadSaved()).helpSeen).toBe(true);
  });

  it('counts as seen when it cannot be read, so the panel never reopens on every launch', async () => {
    await withFailedReads(['overclock.helpSeen'], async () => {
      expect((await loadSaved()).helpSeen).toBe(true);
    });
  });
});

describe('daily circuit', () => {
  it('keeps the run in progress and the last result', async () => {
    const run = { ...startDaily(7), moves: 4, circuits: 1 };
    const record = { day: 6, score: 1200, circuits: 2, streak: 3 };
    expect(await loadSaved()).toMatchObject({ daily: null, record: null });
    saveDaily(run);
    saveRecord(record);
    await flush();
    expect(await loadSaved()).toMatchObject({ daily: run, record });
  });

  it('ignores damaged saves', () => {
    const run = startDaily(7);
    for (const raw of ['nope', '{}', JSON.stringify({ v: SAVE_VERSION + 1, run })]) expect(parseDaily(raw)).toBeNull();
    expect(parseDaily(JSON.stringify({ v: SAVE_VERSION, run: { ...run, day: -1 } }))).toBeNull();
    expect(parseDaily(JSON.stringify({ v: SAVE_VERSION, run: { ...run, game: { score: 3 } } }))).toBeNull();
    expect(parseRecord(JSON.stringify({ day: 7, score: 10, circuits: 0 }))).toBeNull();
    expect(parseRecord(JSON.stringify({ day: 7, score: 10.5, circuits: 0, streak: 1 }))).toBeNull();
  });

  it('does not overwrite daily saves it failed to read', async () => {
    await AsyncStorage.setItem('overclock.daily', 'kept');
    await withFailedReads(['overclock.dailyRecord'], async () => {
      await loadSaved();
    });
    saveDaily(startDaily(7));
    saveRecord({ day: 7, score: 10, circuits: 0, streak: 1 });
    await flush();
    expect(await stored('overclock.daily')).toBe('kept');
    expect(await stored('overclock.dailyRecord')).toBeNull();
  });
});

describe('stats', () => {
  const stats = { ...emptyStats(), games: 4, total: 9000, lines: 31, bestCombo: 6, bestStreak: 2 };

  it('start at zero and keep every change', async () => {
    expect((await loadSaved()).stats).toEqual(emptyStats());
    saveStats(stats);
    await flush();
    expect((await loadSaved()).stats).toEqual(stats);
  });

  it('read damaged or partial saves as zero for each bad number', () => {
    expect(parseStats(null)).toEqual(emptyStats());
    expect(parseStats('nope')).toEqual(emptyStats());
    expect(parseStats(JSON.stringify({ games: 3, lines: -1, circuits: 2.5, total: '90' }))).toEqual({
      ...emptyStats(),
      games: 3,
    });
  });

  it('are not overwritten when they could not be read', async () => {
    await AsyncStorage.setItem('overclock.stats', 'kept');
    await withFailedReads(['overclock.stats'], async () => {
      expect((await loadSaved()).stats).toEqual(emptyStats());
    });
    saveStats(stats);
    await flush();
    expect(await stored('overclock.stats')).toBe('kept');
  });
});
