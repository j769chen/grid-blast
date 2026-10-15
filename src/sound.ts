import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type Sfx = 'lift' | 'rotate' | 'place' | 'spark' | 'clear' | 'blast' | 'perfect' | 'over';

const SOURCES: Record<Sfx, number> = {
  lift: require('../assets/sounds/lift.wav'),
  rotate: require('../assets/sounds/rotate.wav'),
  place: require('../assets/sounds/place.wav'),
  spark: require('../assets/sounds/spark.wav'),
  clear: require('../assets/sounds/clear.wav'),
  blast: require('../assets/sounds/blast.wav'),
  perfect: require('../assets/sounds/perfect.wav'),
  over: require('../assets/sounds/over.wav'),
};

const COMBO_STEPS = 6;

export const comboRate = (combo: number) => 2 ** (Math.min(Math.max(combo - 1, 0), COMBO_STEPS) / COMBO_STEPS);

let players: Record<Sfx, AudioPlayer> | null = null;

export function loadSounds() {
  if (players) return players;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  const made = {} as Record<Sfx, AudioPlayer>;
  for (const kind of Object.keys(SOURCES) as Sfx[]) {
    made[kind] = createAudioPlayer(SOURCES[kind]);
    made[kind].shouldCorrectPitch = false;
  }
  players = made;
  return made;
}

export function play(on: boolean, kind: Sfx, rate = 1) {
  if (!on) return;
  const p = loadSounds()[kind];
  p.setPlaybackRate(rate);
  p.seekTo(0).catch(() => {});
  p.play();
}
