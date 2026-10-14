import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';
import { makeMutable } from 'react-native-reanimated';

import { Board } from '../components/Board';
import { Tray } from '../components/Tray';
import { describeCell, describePiece } from '../describe';
import { NO_CELL, OFFSCREEN, type Clears, type DragShared, type Point, type SlotGeo } from '../drag';
import { cellIndex, makePiece, N, type CoreKind, type Piece, type Terminals } from '../engine';
import { metrics } from '../theme';

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
    shrink: makeMutable([0.5, 0.5, 0.5, 0.3]),
    target: makeMutable(NO_CELL),
    lines: makeMutable<Clears>({ rows: [], cols: [], circuit: [] }),
    terminals: makeMutable<Terminals>({ plus: { side: 'left', at: 4 }, minus: { side: 'top', at: 4 } }),
    canStash: makeMutable(true),
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
    const onStash = jest.fn();
    await render(
      <Tray
        tray={tray}
        grid={Array(N * N).fill(-1)}
        m={m}
        anims={[0, 1, 2, 3].map(() => ({ key: 0, kind: 'deal' as const }))}
        gestures={[0, 1, 2, 3].map(() => Gesture.Pan())}
        slotRefs={[0, 1, 2, 3].map(() => null)}
        onTrayLayout={() => {}}
        drag={drag()}
        onRotate={() => {}}
        selected={2}
        onSelect={onSelect}
        buffer={makePiece(1, 5)}
        stashed={false}
        onStash={onStash}
      />,
    );
    await fireEvent(screen.getByLabelText('U1, red 1-cell part, 1 wide by 1 tall'), 'accessibilityAction', activate);
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(screen.getByLabelText('U2, empty').props.accessibilityActions).toBeUndefined();
    expect(screen.getByLabelText(/^U3, cyan 3-cell part/).props.accessibilityState).toEqual({ selected: true });
    await fireEvent(screen.getByLabelText(/^U3, cyan/), 'accessibilityAction', {
      nativeEvent: { actionName: 'store' },
    });
    expect(onStash).toHaveBeenCalledWith(2);
    await fireEvent(
      screen.getByLabelText('Buffer, pink 2-cell part, 2 wide by 1 tall'),
      'accessibilityAction',
      activate,
    );
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
