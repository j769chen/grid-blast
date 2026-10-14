import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useFonts } from '@expo-google-fonts/chakra-petch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import App from '../../App';
import * as storage from '../storage';

jest.mock('@expo-google-fonts/chakra-petch', () => ({ useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hide: jest.fn() }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem('overclock.helpSeen', 'true');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App', () => {
  it.each<[string, ReturnType<typeof useFonts>]>([
    ['load', [true, null]],
    ['fail to load', [false, new Error('font')]],
  ])('hides the splash screen and shows the game once the fonts %s', async (_, fonts) => {
    jest.mocked(useFonts).mockReturnValue(fonts);
    await render(<App />);
    expect(await screen.findByLabelText(/^U1, /)).toBeTruthy();
    expect(SplashScreen.hide).toHaveBeenCalled();
  });

  it('keeps the splash screen up and the game unmounted while the fonts are loading', async () => {
    const load = jest.spyOn(storage, 'loadSaved');
    jest.mocked(useFonts).mockReturnValue([false, null]);
    await render(<App />);
    expect(load).not.toHaveBeenCalled();
    expect(SplashScreen.hide).not.toHaveBeenCalled();
  });
});
