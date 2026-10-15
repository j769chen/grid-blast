import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyRecord, DailyRun } from './daily';
import { isGameState, N, pickTerminals, repairGame, type GameState } from './engine';
import { emptyStats, type Stats } from './stats';

const KEY = {
  game: 'overclock.game',
  best: 'overclock.best',
  haptics: 'overclock.haptics',
  sound: 'overclock.sound',
  help: 'overclock.helpSeen',
  daily: 'overclock.daily',
  record: 'overclock.dailyRecord',
  stats: 'overclock.stats',
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
  sound: boolean;
  helpSeen: boolean;
  daily: DailyRun | null;
  record: DailyRecord | null;
  stats: Stats;
}

const UNREAD = Number.POSITIVE_INFINITY;
let storedBest = UNREAD;
let gameWritable = false;
let dailyWritable = false;
let statsWritable = false;

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

function parseJson(raw: string | null): Record<string, unknown> | null {
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const isVersion = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= SAVE_VERSION;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export function parseSave(raw: string | null): SavedGame | null {
  const data = parseJson(raw);
  if (!data) return null;
  if (!('v' in data)) {
    const legacy = migrate(data, 1);
    return isGameState(legacy) ? { game: repairGame(legacy), startBest: legacy.best } : null;
  }
  const { v, game: stored, startBest } = data;
  if (!isVersion(v)) return null;
  const game = migrate(stored, v);
  if (!isGameState(game)) return null;
  const start = typeof startBest === 'number' && startBest >= 0 && startBest <= game.best ? startBest : game.best;
  return { game: repairGame(game), startBest: start };
}

export function parseDaily(raw: string | null): DailyRun | null {
  const data = parseJson(raw);
  const run = data?.run as Record<string, unknown> | undefined;
  if (!run || !isVersion(data?.v)) return null;
  const game = migrate(run.game, data.v);
  if (![run.day, run.moves, run.circuits].every(isCount) || !isGameState(game)) return null;
  return {
    day: run.day as number,
    moves: run.moves as number,
    circuits: run.circuits as number,
    game: repairGame(game),
  };
}

export function parseRecord(raw: string | null): DailyRecord | null {
  const r = parseJson(raw);
  if (!r || ![r.day, r.score, r.circuits, r.streak].every(isCount)) return null;
  return { day: r.day as number, score: r.score as number, circuits: r.circuits as number, streak: r.streak as number };
}

export function parseStats(raw: string | null): Stats {
  const data = parseJson(raw);
  const stats = emptyStats();
  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const v = data?.[key];
    if (isCount(v)) stats[key] = v;
  }
  return stats;
}

export async function loadSaved(): Promise<Saved> {
  const [game, best, haptics, sound, help, daily, record, stats] = await Promise.all([
    read(KEY.game),
    read(KEY.best),
    read(KEY.haptics),
    read(KEY.sound),
    read(KEY.help),
    read(KEY.daily),
    read(KEY.record),
    read(KEY.stats),
  ]);
  gameWritable = game !== FAILED;
  dailyWritable = daily !== FAILED && record !== FAILED;
  statsWritable = stats !== FAILED;
  const stored = best === FAILED ? -1 : Number(best);
  const bestNum = Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
  storedBest = best === FAILED ? UNREAD : bestNum;
  return {
    saved: game === FAILED ? null : parseSave(game),
    best: bestNum,
    haptics: haptics !== 'false',
    sound: sound !== 'false',
    helpSeen: help === FAILED || help === 'true',
    daily: daily === FAILED ? null : parseDaily(daily),
    record: record === FAILED ? null : parseRecord(record),
    stats: stats === FAILED ? emptyStats() : parseStats(stats),
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

export function saveDaily(run: DailyRun) {
  if (dailyWritable) AsyncStorage.setItem(KEY.daily, JSON.stringify({ v: SAVE_VERSION, run })).catch(() => {});
}

export function saveRecord(record: DailyRecord) {
  if (dailyWritable) AsyncStorage.setItem(KEY.record, JSON.stringify(record)).catch(() => {});
}

export function saveStats(stats: Stats) {
  if (statsWritable) AsyncStorage.setItem(KEY.stats, JSON.stringify(stats)).catch(() => {});
}

export function saveHaptics(on: boolean) {
  AsyncStorage.setItem(KEY.haptics, String(on)).catch(() => {});
}

export function saveSound(on: boolean) {
  AsyncStorage.setItem(KEY.sound, String(on)).catch(() => {});
}

export function saveHelpSeen() {
  AsyncStorage.setItem(KEY.help, 'true').catch(() => {});
}

export async function clearSavedGame() {
  if (gameWritable) await AsyncStorage.removeItem(KEY.game).catch(() => {});
}
