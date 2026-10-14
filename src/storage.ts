import AsyncStorage from '@react-native-async-storage/async-storage';

import { isGameState, N, pickTerminals, type GameState } from './engine';

const KEY = {
  game: 'overclock.game',
  best: 'overclock.best',
  haptics: 'overclock.haptics',
  help: 'overclock.helpSeen',
};
export const SAVE_VERSION = 6;

export interface SavedGame {
  game: GameState;
  startBest: number;
}

export interface Saved {
  saved: SavedGame | null;
  best: number;
  haptics: boolean;
  helpSeen: boolean;
}

const UNREAD = Number.POSITIVE_INFINITY;
let storedBest = UNREAD;
let gameWritable = false;

const FAILED = Symbol('read failed');

function read(key: string): Promise<string | null | typeof FAILED> {
  return AsyncStorage.getItem(key).catch(() => FAILED);
}

function fromV1(x: unknown): unknown {
  if (!x || typeof x !== 'object') return x;
  const g = x as Record<string, unknown>;
  return {
    ...g,
    cores: Array.isArray(g.cores) ? g.cores.map((v) => (v === true ? 'line' : v === false ? null : v)) : g.cores,
    tray: Array.isArray(g.tray)
      ? g.tray.map((p) => (p && typeof p === 'object' && !('coreKind' in p) ? { ...p, coreKind: 'line' } : p))
      : g.tray,
  };
}

function fromV2(x: unknown): unknown {
  if (!x || typeof x !== 'object' || 'terminals' in x) return x;
  const g = x as Record<string, unknown>;
  const grid = Array.isArray(g.grid) && g.grid.length === N * N ? (g.grid as number[]) : [];
  return { ...g, terminals: pickTerminals(grid) };
}

function fromV4(x: unknown): unknown {
  if (!x || typeof x !== 'object') return x;
  const g = x as Record<string, unknown>;
  const t = g.terminals as Record<string, unknown> | null;
  if (!t || typeof t !== 'object' || !('row' in t)) return x;
  return { ...g, terminals: { plus: { side: 'left', at: t.row }, minus: { side: 'top', at: t.col } } };
}

function fromV5(x: unknown): unknown {
  if (!x || typeof x !== 'object') return x;
  const { buffer, stashed: _stashed, ...g } = x as Record<string, unknown>;
  const tray = Array.isArray(g.tray) ? g.tray.slice() : g.tray;
  if (buffer && Array.isArray(tray)) {
    const free = tray.indexOf(null);
    if (free >= 0) tray[free] = buffer;
  }
  return { ...g, tray };
}

const keep = (x: unknown) => x;
const MIGRATIONS = [fromV1, fromV2, keep, fromV4, fromV5];
const migrate = (game: unknown, from: number) => MIGRATIONS.slice(from - 1).reduce((g, step) => step(g), game);

export function parseSave(raw: string | null): SavedGame | null {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  if (!('v' in data)) {
    const legacy = migrate(data, 1);
    return isGameState(legacy) ? { game: legacy, startBest: legacy.best } : null;
  }
  const { v, game: stored, startBest } = data as { v: unknown; game: unknown; startBest: unknown };
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > SAVE_VERSION) return null;
  const game = migrate(stored, v);
  if (!isGameState(game)) return null;
  const start = typeof startBest === 'number' && startBest >= 0 && startBest <= game.best ? startBest : game.best;
  return { game, startBest: start };
}

export async function loadSaved(): Promise<Saved> {
  const [game, best, haptics, help] = await Promise.all([
    read(KEY.game),
    read(KEY.best),
    read(KEY.haptics),
    read(KEY.help),
  ]);
  gameWritable = game !== FAILED;
  const bestNum = best === FAILED ? 0 : Math.max(0, Number(best) || 0);
  storedBest = best === FAILED ? UNREAD : bestNum;
  return {
    saved: game === FAILED ? null : parseSave(game),
    best: bestNum,
    haptics: haptics !== 'false',
    helpSeen: help === FAILED || help === 'true',
  };
}

export function saveGame(game: GameState, startBest: number) {
  if (gameWritable) {
    AsyncStorage.setItem(KEY.game, JSON.stringify({ v: SAVE_VERSION, game, startBest })).catch(() => {});
  }
  if (game.best > storedBest) {
    storedBest = game.best;
    AsyncStorage.setItem(KEY.best, String(game.best)).catch(() => {});
  }
}

export function saveHaptics(on: boolean) {
  AsyncStorage.setItem(KEY.haptics, String(on)).catch(() => {});
}

export function saveHelpSeen() {
  AsyncStorage.setItem(KEY.help, 'true').catch(() => {});
}

export function clearSavedGame() {
  return AsyncStorage.removeItem(KEY.game).catch(() => {});
}
