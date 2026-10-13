# Grid Blast

A Block Blast–style block puzzle that runs in the browser. No build step, no dependencies.

## Play

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Rules

- Drag pieces from the tray onto the 8×8 board.
- Fill a row or column to clear it. Rows and columns clear together.
- When all three pieces are used, a new set is dealt.
- The game ends when none of the remaining pieces fit.

## Scoring

- 1 point per block placed.
- Clearing n lines in one move scores 5·n·(n+1) (10, 30, 60, 100…), multiplied by the current combo.
- The combo grows with each clearing move and resets after 3 moves in a row without a clear.
- Emptying the whole board adds 300.

Best score, the game in progress, and the sound setting are saved in `localStorage`.
