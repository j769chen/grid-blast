import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useToday } from '../useToday';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 20, 23, 59, 30));
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useToday', () => {
  it('moves to the next day at local midnight while the app stays open', async () => {
    const { result } = await renderHook(() => useToday());
    expect(result.current).toBe(7);
    await act(async () => {
      jest.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(7);
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(result.current).toBe(8);
  });

  it('checks the date again when the app comes back to the foreground', async () => {
    const handlers: ((s: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
      handlers.push(handler);
      return { remove: () => {} } as never;
    });
    const { result } = await renderHook(() => useToday());
    jest.setSystemTime(new Date(2026, 9, 25, 9));
    await act(async () => handlers.forEach((h) => h('background')));
    expect(result.current).toBe(7);
    await act(async () => handlers.forEach((h) => h('active')));
    expect(result.current).toBe(12);
  });

  it('stops listening once unmounted', async () => {
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove } as never);
    const { unmount } = await renderHook(() => useToday());
    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
