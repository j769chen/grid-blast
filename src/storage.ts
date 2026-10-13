import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GameState } from './engine';

const KEY = { game: 'overclock.game', best: 'overclock.best', haptics: 'overclock.haptics' };

export interface Saved {
  game: unknown;
  best: number;
  haptics: boolean;
}

function parse(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function loadSaved(): Promise<Saved> {
  const [game, best, haptics] = await Promise.all(
    [KEY.game, KEY.best, KEY.haptics].map((k) => AsyncStorage.getItem(k).catch(() => null)),
  );
  return { game: parse(game), best: Number(best) || 0, haptics: haptics !== 'false' };
}

export function saveGame(s: GameState) {
  AsyncStorage.setItem(KEY.game, JSON.stringify(s)).catch(() => {});
  AsyncStorage.setItem(KEY.best, String(s.best)).catch(() => {});
}

export function saveHaptics(on: boolean) {
  AsyncStorage.setItem(KEY.haptics, String(on)).catch(() => {});
}
