import AsyncStorage from '@react-native-async-storage/async-storage';

import { isGameState, type GameState } from './engine';

const KEY = { game: 'overclock.game', best: 'overclock.best', haptics: 'overclock.haptics' };
export const SAVE_VERSION = 1;

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

export function parseSave(raw: string | null): SavedGame | null {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  if (!('v' in data)) return isGameState(data) ? { game: data, startBest: data.best } : null;
  const { v, game, startBest } = data as { v: unknown; game: unknown; startBest: unknown };
  if (v !== SAVE_VERSION || !isGameState(game)) return null;
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
