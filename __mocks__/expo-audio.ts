import { jest } from '@jest/globals';

export const setAudioModeAsync = jest.fn(() => Promise.resolve());
export const createAudioPlayer = jest.fn(() => ({ seekTo: jest.fn(() => Promise.resolve()), play: jest.fn() }));
