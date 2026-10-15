import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Audio from 'expo-audio';

import { loadSounds, play } from '../sound';

type Player = { seekTo: jest.Mock; play: jest.Mock };

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
    const heard = players().filter((p) => p.play.mock.calls.length);
    expect(heard).toHaveLength(1);
    expect(heard[0].play).toHaveBeenCalledTimes(2);
    expect(heard[0].seekTo.mock.calls).toEqual([[0], [0]]);
  });

  it('shrugs off a failed seek without an unhandled rejection', async () => {
    loadSounds().blast.seekTo = jest.fn(() => Promise.reject(new Error('not loaded')));
    expect(() => play(true, 'blast')).not.toThrow();
    await new Promise((done) => setTimeout(done, 0));
  });
});
