# Overclock (mobile)

React Native version of Overclock, built with Expo SDK 57. Same rules and scoring as the web game in the repo root.

## Run it on your phone

1. Install Expo Go from the App Store or Google Play.
2. From this folder:

   ```sh
   npm install
   npx expo start
   ```

3. Scan the QR code with the camera (iOS) or Expo Go (Android).

## Scripts

```sh
npm test            # engine unit tests (Jest)
npm run lint        # ESLint via expo lint
npm run typecheck   # tsc --noEmit
```

## Layout

```
App.tsx                 font loading, safe-area provider
src/engine.ts           pure game logic: pieces, rotation, line clears, cores, scoring
src/Game.tsx            game screen: state, dragging, effects, persistence, haptics
src/theme.ts            colors, fonts, board sizing
src/components/         Board, Tray, Hud, Fx, GameOver, Led, Background, Icons
src/__tests__/          engine tests
```

## Differences from the web version

- Haptics replace the synth sounds. The HUD toggle turns vibration on or off.
- Saved games use AsyncStorage instead of localStorage, so web and mobile progress are separate.
