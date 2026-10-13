# Overclock

A block puzzle set on a circuit board, for the browser. No build step, no dependencies.

## Play

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

A React Native version lives in [`mobile/`](mobile/README.md).

## Rules

- Drag parts from the three sockets (U1–U3) onto the 8×8 board.
- Fill a row or column to clear it. Rows and columns clear together.
- When all three parts are placed, a new set is dealt.
- The game ends when no remaining part fits, counting rotations you can still afford.

## Rotation charges

- Press the Rotate button under a part to turn it 90° clockwise. Each rotation costs 1 charge.
- You start with 3 charges and hold at most 5. Every move that clears a line refunds 1.
- A glowing Rotate button means that part only fits after rotating. A greyed-out part can't fit with the charges you have.

## Cores

- Some sets include a part with a glowing core cell.
- When a cleared line contains a core, the core blasts its entire row and column too.
- A core caught in that blast detonates as well, so cores can chain.

## Scoring

- 10 points per cell placed.
- Clearing n lines in one move scores 50·n·(n+1) (100, 300, 600, 1,000…), multiplied by the current combo.
- Each extra cell destroyed by a core adds 40.
- The combo grows with each clearing move and resets after 3 moves in a row without a clear.
- Emptying the whole board adds 3,000.

Peak score, the game in progress, and the sound setting are saved in `localStorage`.
