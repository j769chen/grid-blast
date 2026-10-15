import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Haptics from 'expo-haptics';

import { buzz } from '../haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Error: 'error' },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buzz', () => {
  it('stays silent while vibration is off', () => {
    for (const kind of ['select', 'light', 'medium', 'heavy', 'error'] as const) buzz(false, kind);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('shrugs off devices that cannot vibrate, without an unhandled rejection', async () => {
    jest.mocked(Haptics.impactAsync).mockRejectedValueOnce(new Error('Haptics are not available'));
    expect(() => buzz(true, 'heavy')).not.toThrow();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
    await new Promise((done) => setTimeout(done, 0));
  });
});
