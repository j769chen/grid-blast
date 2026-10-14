import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Haptics from 'expo-haptics';

import { buzz, type Buzz } from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Error: 'error' },
}));

const played = () => [
  ...jest.mocked(Haptics.selectionAsync).mock.calls.map(() => 'selection'),
  ...jest.mocked(Haptics.impactAsync).mock.calls.map(([style]) => `impact ${style}`),
  ...jest.mocked(Haptics.notificationAsync).mock.calls.map(([type]) => `notification ${type}`),
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buzz', () => {
  it.each<[Buzz, string]>([
    ['select', 'selection'],
    ['light', 'impact light'],
    ['medium', 'impact medium'],
    ['heavy', 'impact heavy'],
    ['error', 'notification error'],
  ])('plays %s as %s', (kind, expected) => {
    buzz(true, kind);
    expect(played()).toEqual([expected]);
  });

  it('stays silent while vibration is off', () => {
    for (const kind of ['select', 'light', 'medium', 'heavy', 'error'] as const) buzz(false, kind);
    expect(played()).toEqual([]);
  });

  it('shrugs off devices that cannot vibrate, without an unhandled rejection', async () => {
    jest.mocked(Haptics.impactAsync).mockRejectedValueOnce(new Error('Haptics are not available'));
    expect(() => buzz(true, 'heavy')).not.toThrow();
    await new Promise((done) => setTimeout(done, 0));
  });
});
