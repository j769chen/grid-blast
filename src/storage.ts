import AsyncStorage from '@react-native-async-storage/async-storage';

import { isGameState, N, pickTerminals, type GameState } from './engine';

const KEY = { game: 'overclock.game', best: 'overclock.best', haptics: 'overclock.haptics' };
export const SAVE_VERSION = 3;

export interface SavedGame {
  game: GameState;
  startBest: number;
}

export interface Saved {
  saved: SavedGame | null;
  best: number;
  haptics: boolean;
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

export function parseSave(raw: string | null): SavedGame | null {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  if (!('v' in data)) {
    const legacy = fromV2(fromV1(data));
    return isGameState(legacy) ? { game: legacy, startBest: legacy.best } : null;
  }
  const { v, game: stored, startBest } = data as { v: unknown; game: unknown; startBest: unknown };
  const game = v === 1 ? fromV2(fromV1(stored)) : v === 2 ? fromV2(stored) : stored;
  if ((v !== 1 && v !== 2 && v !== SAVE_VERSION) || !isGameState(game)) return null;
  const start = typeof startBest === 'number' && startBest >= 0 && startBest <= game.best ? startBest : game.best;
  return { game, startBest: start };
}

export async function loadSaved(): Promise<Saved> {
  const [game, best, haptics] = await Promise.all([read(KEY.game), read(KEY.best), read(KEY.haptics)]);
  gameWritable = game !== FAILED;
  const bestNum = best === FAILED ? 0 : Math.max(0, Number(best) || 0);
  storedBest = best === FAILED ? UNREAD : bestNum;
  return {
    saved: game === FAILED ? null : parseSave(game),
    best: bestNum,
    haptics: haptics !== 'false',
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

export function clearSavedGame() {
  return AsyncStorage.removeItem(KEY.game).catch(() => {});
}
