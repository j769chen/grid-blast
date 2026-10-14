import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makePiece, N, type GameState } from '../engine';
import Game from '../Game';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Error: 'error' },
}));

const safeArea = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const activate = { nativeEvent: { actionName: 'activate' } };
const wait = (ms: number) => act(() => new Promise<void>((done) => setTimeout(done, ms)));

function circuitGame(): GameState {
  const grid = Array<number>(N * N).fill(-1);
  for (let c = 0; c <= 6; c++) if (c !== 3) grid[c] = 0;
  return {
    grid,
    cores: Array(N * N).fill(null),
    terminals: { plus: { side: 'left', at: 0 }, minus: { side: 'top', at: 6 } },
    tray: [makePiece(0, 1), makePiece(0, 2), makePiece(0, 3)],
    score: 0,
    best: 0,
    combo: 0,
    idle: 0,
    over: false,
  };
}

async function mount() {
  await AsyncStorage.setItem('overclock.helpSeen', 'true');
  await AsyncStorage.setItem('overclock.game', JSON.stringify({ v: 6, game: circuitGame(), startBest: 0 }));
  await render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <Game />
    </SafeAreaProvider>,
  );
  await screen.findByLabelText(/^U1, /);
}

const slot = (n: number) => screen.getByLabelText(new RegExp(`^U${n}, `));
const restart = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'New game' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm new game' }));
};

describe('Game', () => {
  let announce: jest.SpiedFunction<typeof AccessibilityInfo.announceForAccessibility>;

  beforeEach(async () => {
    await AsyncStorage.clear();
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    jest.mocked(Haptics.impactAsync).mockClear();
  });
  afterEach(() => announce.mockRestore());

  it('says when a second activation puts a chosen part back', async () => {
    await mount();
    await fireEvent(slot(1), 'accessibilityAction', activate);
    await fireEvent(slot(1), 'accessibilityAction', activate);
    expect(slot(1).props.accessibilityState).toEqual({ selected: false });
    expect(announce.mock.calls.map(([text]) => text)).toEqual(['Chose U1. Pick a board square.', 'Put back U1.']);
  });

  it('asks for confirmation before restarting and says so', async () => {
    await mount();
    await fireEvent.press(screen.getByRole('button', { name: 'New game' }));
    expect(screen.getByRole('button', { name: 'Confirm new game' })).toBeTruthy();
    expect(announce).toHaveBeenLastCalledWith('Tap again to start a new game.');
  });

  it('forgets the chosen part when a new game starts', async () => {
    await mount();
    await fireEvent(slot(1), 'accessibilityAction', activate);
    await restart();
    expect(slot(1).props.accessibilityState).toEqual({ selected: false });
  });

  it('drops a pending circuit haptic when the game restarts', async () => {
    await mount();
    await fireEvent(slot(1), 'accessibilityAction', activate);
    await fireEvent(screen.getByLabelText('A4, empty'), 'accessibilityAction', activate);
    expect(announce).toHaveBeenLastCalledWith(expect.stringContaining('Circuit complete.'));
    await restart();
    jest.mocked(Haptics.impactAsync).mockClear();
    await wait(400);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
