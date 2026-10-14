# Overclock

A block puzzle set on a circuit board, for iOS, Android and the web. Built with Expo SDK 57 and React Native.

## Play

```sh
npm install
npx expo start
```

- Phone: install Expo Go from the App Store or Google Play, then scan the QR code with the camera (iOS) or Expo Go (Android).
- Browser: press `w` in the Expo terminal, or run `npx expo start --web`.
- Static web build: `npx expo export -p web` writes a self-contained site to `dist/`.

## Rules

- A new game starts with a few parts already on the board.
- Drag parts from the three sockets (U1–U3) onto the 8×8 board.
- Fill a row or column to clear it. Rows and columns clear together.
- When all three parts are placed, a new set is dealt. Every new set has at least one part that fits in some rotation.
- The game ends when no remaining part fits in any rotation.

## Rotation

- Press the Rotate button under a part to turn it 90° clockwise. Rotations are free and unlimited.
- A glowing Rotate button means that part only fits after rotating. A greyed-out part doesn't fit in any rotation.

## Cores

- Some sets include a part with a glowing core cell. Cores come in two kinds:
  - **Line cores** (gold square frame) blast their entire row and column.
  - **Area cores** (round, with a pink centre) blast the 3×3 square around them.
- A core detonates when a cleared line contains it.
- A core caught in another core's blast detonates as well, so cores of either kind can chain.

## Scoring

- 10 points per cell placed.
- Clearing n lines in one move scores 50·n·(n+1) (100, 300, 600, 1,000…), multiplied by the current combo.
- Each extra cell destroyed by a core adds 40.
- The combo grows with each clearing move and resets after 3 moves in a row without a clear.
- Emptying the whole board adds 3,000.

Peak score, the game in progress, and the vibration setting are saved on the device (AsyncStorage, which is `localStorage` on the web).

## Dragging

- Touch: the part's centre floats about two cells above your finger and moves 1.4× as far, so your finger stays clear of where it lands.
- Mouse: the part sits on the cursor and moves with it 1:1.
- The shadow and the drop use the nearest open spot within one cell of the part.

## Scripts

```sh
npm test            # unit tests (Jest)
npm run lint        # ESLint via expo lint
npm run typecheck   # tsc --noEmit
```

## Layout

```
App.tsx                 font loading, safe-area provider
src/Game.tsx            game screen: state transitions, timers, layout
src/engine.ts           pure game logic: pieces, rotation, line clears, cores, scoring
src/drag.ts             drag geometry and nearest-spot targeting (worklets)
src/useDragGestures.ts  pan gestures, shared values, layout measuring, placement preview
src/fx.ts               builds the line-clear effects for a placement
src/storage.ts          saved game, peak score and vibration setting
src/haptics.ts          vibration patterns
src/theme.ts            colors, fonts, board sizing
src/format.ts           number formatting
src/components/         Board, Tray, Ghost, Shadow, Hud, Fx, GameOver, Led, ErrorBoundary, Background, Icons
src/__tests__/          unit tests
```
