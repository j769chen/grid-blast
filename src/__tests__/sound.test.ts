import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Audio from 'expo-audio';

import { comboRate, loadSounds, play } from '../sound';

type Player = { seekTo: jest.Mock; play: jest.Mock; setPlaybackRate: jest.Mock; shouldCorrectPitch: boolean };

const players = () => jest.mocked(Audio.createAudioPlayer).mock.results.map((r) => r.value as unknown as Player);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('play', () => {
  it('loads nothing while off, then loads every sound once, mixed with other audio and muted by the silent switch', () => {
    play(false, 'clear');
    expect(Audio.createAudioPlayer).not.toHaveBeenCalled();
    expect(Audio.setAudioModeAsync).not.toHaveBeenCalled();
    play(true, 'clear');
    play(true, 'clear');
    expect(Audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
    });
    expect(players()).toHaveLength(8);
    expect(players().every((p) => !p.shouldCorrectPitch)).toBe(true);
    const heard = players().filter((p) => p.play.mock.calls.length);
    expect(heard).toHaveLength(1);
    expect(heard[0].play).toHaveBeenCalledTimes(2);
    expect(heard[0].seekTo.mock.calls).toEqual([[0], [0]]);
    expect(heard[0].setPlaybackRate.mock.calls).toEqual([[1], [1]]);
  });

  it('plays at the given rate, which shifts the pitch', () => {
    play(true, 'clear', 1.5);
    expect(loadSounds().clear.setPlaybackRate).toHaveBeenLastCalledWith(1.5);
    play(true, 'clear');
    expect(loadSounds().clear.setPlaybackRate).toHaveBeenLastCalledWith(1);
  });

  it('shrugs off a failed seek without an unhandled rejection', async () => {
    loadSounds().blast.seekTo = jest.fn(() => Promise.reject(new Error('not loaded')));
    expect(() => play(true, 'blast')).not.toThrow();
    await new Promise((done) => setTimeout(done, 0));
  });
});

describe('comboRate', () => {
  it('rises a whole tone per combo step, up to an octave', () => {
    expect(comboRate(0)).toBe(1);
    expect(comboRate(1)).toBe(1);
    expect(comboRate(2)).toBeCloseTo(2 ** (2 / 12));
    expect(comboRate(4)).toBeCloseTo(Math.SQRT2);
    expect(comboRate(7)).toBe(2);
    expect(comboRate(12)).toBe(2);
  });
});
