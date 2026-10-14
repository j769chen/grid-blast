import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { circuitPath, newGame } from '../engine';
import { loadSaved, parseSave, saveGame, SAVE_VERSION } from '../storage';

const game = (best = 0) => newGame(best, () => 0.5);
const stored = (key: string) => AsyncStorage.getItem(key);
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('parseSave', () => {
  it('rejects missing, malformed and unknown-version saves', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('{not json')).toBeNull();
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION + 1, game: game(), startBest: 0 }))).toBeNull();
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION, game: { ...game(), tray: [] }, startBest: 0 }))).toBeNull();
  });

  it('reads a versioned save and clamps its starting best', () => {
    const g = { ...game(), score: 900, best: 900 };
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION, game: g, startBest: 400 }))).toEqual({
      game: g,
      startBest: 400,
    });
    expect(parseSave(JSON.stringify({ v: SAVE_VERSION, game: g, startBest: 5000 }))?.startBest).toBe(900);
  });

  it('reads a legacy unversioned save', () => {
    const g = { ...game(), best: 300 };
    expect(parseSave(JSON.stringify(g))).toEqual({ game: g, startBest: 300 });
  });
});

describe('version 1 saves', () => {
  it('migrate boolean cores to line cores', () => {
    const g = game();
    const old = {
      ...g,
      cores: g.cores.map((_, k) => k === 9),
      tray: g.tray.map((p) => {
        if (!p) return p;
        const { coreKind: _kind, ...rest } = p;
        return rest;
      }),
    };
    for (const raw of [JSON.stringify({ v: 1, game: old, startBest: 0 }), JSON.stringify(old)]) {
      const parsed = parseSave(raw)!;
      expect(parsed.game.cores[9]).toBe('line');
      expect(parsed.game.cores.filter(Boolean)).toHaveLength(1);
      expect(parsed.game.tray.every((p) => !p || p.coreKind === 'line')).toBe(true);
    }
  });
});

describe('version 2 saves', () => {
  it('gain unconnected terminals', () => {
    const { terminals: _t, ...old } = game();
    const parsed = parseSave(JSON.stringify({ v: 2, game: old, startBest: 0 }))!;
    expect(parsed.game.terminals.row).toBeGreaterThanOrEqual(3);
    expect(circuitPath(parsed.game.grid, parsed.game.terminals)).toBeNull();
  });
});

describe('loadSaved and saveGame', () => {
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

  it('does not overwrite saves it failed to read', async () => {
    await AsyncStorage.setItem('overclock.best', '900');
    await AsyncStorage.setItem('overclock.game', 'kept');
    const fail = () => Promise.reject(new Error('io'));
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(fail).mockImplementationOnce(fail);
    const loaded = await loadSaved();
    expect(loaded).toEqual({ saved: null, best: 0, haptics: true });
    saveGame({ ...game(), score: 50, best: 50 }, 0);
    await flush();
    expect(await stored('overclock.best')).toBe('900');
    expect(await stored('overclock.game')).toBe('kept');
  });
});
