import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { loadSaved } from '../storage';

let crash = true;

function Screen() {
  if (crash) throw new Error('corrupt board');
  return <Text>Playing</Text>;
}

beforeEach(async () => {
  crash = true;
  await AsyncStorage.clear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('replaces a crashed game with a recovery screen, then starts over without the saved game', async () => {
    await AsyncStorage.setItem('overclock.game', 'crashes the board');
    await AsyncStorage.setItem('overclock.best', '900');
    await loadSaved();
    await render(
      <ErrorBoundary>
        <Screen />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    crash = false;
    await fireEvent.press(screen.getByRole('button', { name: 'New game' }));
    expect(await screen.findByText('Playing')).toBeTruthy();
    expect(await AsyncStorage.getItem('overclock.game')).toBeNull();
    expect(await AsyncStorage.getItem('overclock.best')).toBe('900');
  });
});
