import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';
import { makeMutable } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Board } from '../components/Board';
import { Help } from '../components/Help';
import { Hud } from '../components/Hud';
import { Tray } from '../components/Tray';
import { describeCell, describePiece, describePlacement, PART_NAMES } from '../describe';
import { NO_CELL, OFFSCREEN, type Clears, type DragShared, type Point, type SlotGeo } from '../drag';
import { cellIndex, COLOR_COUNT, makePiece, N, placePiece, type CoreKind, type Piece, type Terminals } from '../engine';
import { metrics, PART_COLORS } from '../theme';

const m = metrics(390, 800);
const single = (): Piece => makePiece(0, 0);
const activate = { nativeEvent: { actionName: 'activate' } };

function drag(): DragShared {
  const slots = [0, 1, 2];
  return {
    slot: makeMutable(-1),
    touch: makeMutable({ x: 0, y: 0 }),
    origin: makeMutable({ x: 0, y: 0 }),
    pitch: makeMutable(m.pitch),
    mouse: makeMutable(false),
    geo: makeMutable<(SlotGeo | null)[]>(slots.map(() => null)),
    landing: makeMutable<(Point | null)[]>(slots.map(() => null)),
    slots: makeMutable(slots.map(() => ({ x: 0, y: 0, w: 0, h: 0 }))),
    missFrom: makeMutable(slots.map(() => ({ x: OFFSCREEN, y: OFFSCREEN }))),
    back: makeMutable(slots.map(() => 1)),
    shrink: makeMutable([0.5, 0.5, 0.5]),
    target: makeMutable(NO_CELL),
    lines: makeMutable<Clears>({ rows: [], cols: [], circuit: [] }),
  };
}

async function board(
  placing: Piece | null,
  terminals: Terminals = { plus: { side: 'left', at: 4 }, minus: { side: 'top', at: 2 } },
) {
  const onPlaceAt = jest.fn();
  const grid = Array<number>(N * N).fill(-1);
  const cores = Array<CoreKind | null>(N * N).fill(null);
  grid[cellIndex(1, 1)] = 0;
  cores[cellIndex(1, 1)] = 'area';
  await render(
    <Board
      grid={grid}
      cores={cores}
      preview={null}
      m={m}
      fieldRef={null}
      onBoardLayout={() => {}}
      fx={[]}
      tray={[null, null, null]}
      drag={drag()}
      placing={placing}
      onPlaceAt={onPlaceAt}
      terminals={terminals}
    />,
  );
  return onPlaceAt;
}

describe('screen reader descriptions', () => {
  it('names parts and squares', () => {
    expect(describePiece({ ...makePiece(3, 1), core: 0, coreKind: 'line' })).toBe(
      'orange 3-cell part, 3 wide by 1 tall, line core',
    );
    expect(describeCell(0, 0, -1, null)).toBe('A1, empty');
    expect(describeCell(7, 7, 6, 'area')).toBe('H8, white, area core');
  });

  it('has a name and a colour for every part colour', () => {
    expect(PART_NAMES).toHaveLength(COLOR_COUNT);
    expect(PART_COLORS).toHaveLength(COLOR_COUNT);
  });

  it('sums up a placement', () => {
    const grid = Array<number>(N * N).fill(-1);
    for (let c = 1; c < N; c++) grid[c] = 2;
    grid[cellIndex(5, 5)] = 1;
    const res = placePiece(
      {
        grid,
        cores: Array(N * N).fill(null),
        terminals: { plus: { side: 'left', at: 7 }, minus: { side: 'top', at: 7 } },
        tray: [single(), single(), single()],
        score: 0,
        best: 0,
        combo: 0,
        idle: 0,
        over: false,
      },
      0,
      0,
      0,
    )!;
    expect(describePlacement(res)).toBe('Placed. 1 line cleared. Score 110.');
  });
});

describe('Board', () => {
  it('reads every square', async () => {
    await board(null);
    expect(screen.getByLabelText('A1, empty')).toBeTruthy();
    expect(screen.getByLabelText('B2, red, area core')).toBeTruthy();
    expect(screen.getByLabelText('E1, empty, next to power in')).toBeTruthy();
    expect(screen.getByLabelText('A3, empty, next to power out')).toBeTruthy();
    expect(screen.getByLabelText('A1, empty').props.accessibilityActions).toBeUndefined();
  });

  it('marks the squares next to terminals on the right and bottom edges', async () => {
    await board(null, { plus: { side: 'right', at: 4 }, minus: { side: 'bottom', at: 2 } });
    expect(screen.getByLabelText('E8, empty, next to power in')).toBeTruthy();
    expect(screen.getByLabelText('H3, empty, next to power out')).toBeTruthy();
  });

  it('places the chosen part on a square where it fits', async () => {
    const onPlaceAt = await board(single());
    await fireEvent(screen.getByLabelText('C4, empty'), 'accessibilityAction', activate);
    expect(onPlaceAt).toHaveBeenCalledWith(2, 3);
    expect(screen.getByLabelText('B2, red, area core').props.accessibilityActions).toBeUndefined();
  });
});

describe('Tray', () => {
  it('lets a screen reader choose a part', async () => {
    const onSelect = jest.fn();
    const tray = [single(), null, makePiece(3, 4)];
    await render(
      <Tray
        tray={tray}
        grid={Array(N * N).fill(-1)}
        m={m}
        anims={[0, 1, 2].map(() => ({ key: 0, kind: 'deal' as const }))}
        gestures={[0, 1, 2].map(() => Gesture.Pan())}
        slotRefs={[0, 1, 2].map(() => null)}
        onTrayLayout={() => {}}
        drag={drag()}
        onRotate={() => {}}
        selected={2}
        onSelect={onSelect}
      />,
    );
    await fireEvent(screen.getByLabelText('U1, red 1-cell part, 1 wide by 1 tall'), 'accessibilityAction', activate);
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(screen.getByLabelText('U2, empty').props.accessibilityActions).toBeUndefined();
    expect(screen.getByLabelText(/^U3, cyan 3-cell part/).props['aria-selected']).toBe(true);
    expect(screen.getByLabelText(/^U3, cyan/).props.accessibilityActions).toEqual([
      { name: 'activate', label: 'Choose' },
    ]);
  });
});

const safeArea = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function help(hapticsOn: boolean, onClose = () => {}, onToggleHaptics = () => {}) {
  return render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <Help visible onClose={onClose} hapticsOn={hapticsOn} onToggleHaptics={onToggleHaptics} />
    </SafeAreaProvider>,
  );
}

describe('Help', () => {
  it('opens from the top bar', async () => {
    const onHelp = jest.fn();
    await render(<Hud score={0} best={0} armed={false} m={m} onHelp={onHelp} onRestart={() => {}} />);
    await fireEvent.press(screen.getByRole('button', { name: 'How to play' }));
    expect(onHelp).toHaveBeenCalled();
  });

  it('explains the rules and closes', async () => {
    const onClose = jest.fn();
    await help(true, onClose);
    for (const title of ['How to play', 'Place parts', 'Rotate', 'Circuits', 'Cores', 'Scoring']) {
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
    }
    expect(screen.getByLabelText('4 lines at once: 1,000')).toBeTruthy();
    expect(screen.getByLabelText('Emptying the board: 3,000')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('holds the vibration setting', async () => {
    const onToggleHaptics = jest.fn();
    await help(false, () => {}, onToggleHaptics);
    const toggle = screen.getByRole('switch', { name: 'Vibration', checked: false });
    expect(screen.getByText('Vibration off')).toBeTruthy();
    await fireEvent.press(toggle);
    expect(onToggleHaptics).toHaveBeenCalled();
  });
});
