import { memo, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DragShared, Preview } from '../drag';
import { COL_LABELS, describeCell, ROW_LABELS } from '../describe';
import { fits, N, portCell, samePort, type CoreKind, type Piece, type Port, type Terminals } from '../engine';
import { C, F, PART_COLORS, portCentre, type Metrics } from '../theme';
import type { FxSpec } from '../fx';
import { FxLayer } from './Fx';
import { Led, Pad, PortSign } from './Led';
import { ShadowLayer } from './Shadow';

interface BoardProps {
  grid: number[];
  cores: (CoreKind | null)[];
  preview: Preview | null;
  m: Metrics;
  fieldRef: Ref<View>;
  onBoardLayout: () => void;
  fx: FxSpec[];
  tray: (Piece | null)[];
  drag: DragShared;
  placing: Piece | null;
  onPlaceAt: (r: number, c: number) => void;
  terminals: Terminals;
}

const PLACE = [{ name: 'activate' as const, label: 'Place here' }];

function Terminal({ sign, port, m }: { sign: string; port: Port; m: Metrics }) {
  const { x, y } = portCentre(port, m);
  const origin = m.pad + m.gut;
  return (
    <View
      aria-hidden
      style={[
        styles.terminal,
        { left: origin + x - m.gut / 2, top: origin + y - m.gut / 2, width: m.gut, height: m.gut },
      ]}
    >
      <PortSign sign={sign} size={m.gut * 0.8} />
    </View>
  );
}

type CellsProps = Pick<BoardProps, 'grid' | 'cores' | 'preview' | 'm' | 'placing' | 'onPlaceAt' | 'terminals'>;

const Cells = memo(function Cells({ grid, cores, preview, m, placing, onPlaceAt, terminals }: CellsProps) {
  const plusCell = portCell(terminals.plus);
  const minusCell = portCell(terminals.minus);
  const cells = [];
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N);
    const c = i % N;
    const lit = preview?.get(i);
    const color = lit ?? (grid[i] >= 0 ? PART_COLORS[grid[i]] : null);
    const core = color ? cores[i] : null;
    const open = !!placing && fits(grid, placing, r, c);
    cells.push(
      <View
        key={i}
        accessible
        accessibilityLabel={describeCell(
          r,
          c,
          grid[i],
          cores[i],
          i === plusCell ? 'next to power in' : i === minusCell ? 'next to power out' : '',
        )}
        accessibilityRole={open ? 'button' : undefined}
        accessibilityHint={
          placing
            ? open
              ? 'Places the chosen part with its top-left corner here'
              : "The chosen part doesn't fit here"
            : undefined
        }
        accessibilityActions={open ? PLACE : undefined}
        onAccessibilityAction={open ? () => onPlaceAt(r, c) : undefined}
        style={{ position: 'absolute', left: c * m.pitch, top: r * m.pitch }}
      >
        {color ? (
          <Led color={color} size={m.cell} b={m.b} glow={m.glow} core={core} bright={!!lit} mark={lit === C.circuit} />
        ) : (
          <Pad size={m.cell} />
        )}
      </View>,
    );
  }

  return <>{cells}</>;
});

export const Board = memo(function Board({
  grid,
  cores,
  preview,
  m,
  fieldRef,
  onBoardLayout,
  fx,
  tray,
  drag,
  placing,
  onPlaceAt,
  terminals,
}: BoardProps) {
  const origin = m.pad + m.gut;
  const labelSize = m.size * 0.03;
  const taken = (side: Port['side'], at: number) =>
    samePort(terminals.plus, { side, at }) || samePort(terminals.minus, { side, at });

  return (
    <View onLayout={onBoardLayout} style={styles.outline}>
      <View style={[styles.board, { width: m.size, height: m.size }]}>
        <Text
          aria-hidden
          style={[
            styles.silk,
            { left: m.pad, top: m.pad, width: m.gut, height: m.gut, lineHeight: m.gut, fontSize: m.size * 0.02 },
          ]}
        >
          OC-1
        </Text>
        {COL_LABELS.map((label, c) =>
          taken('top', c) ? null : (
            <Text
              aria-hidden
              key={label}
              style={[
                styles.silk,
                {
                  left: origin + c * m.pitch,
                  top: m.pad,
                  width: m.cell,
                  height: m.gut,
                  lineHeight: m.gut,
                  fontSize: labelSize,
                },
              ]}
            >
              {label}
            </Text>
          ),
        )}
        {ROW_LABELS.map((label, r) =>
          taken('left', r) ? null : (
            <Text
              aria-hidden
              key={label}
              style={[
                styles.silk,
                {
                  left: m.pad,
                  top: origin + r * m.pitch,
                  width: m.gut,
                  height: m.cell,
                  lineHeight: m.cell,
                  fontSize: labelSize,
                },
              ]}
            >
              {label}
            </Text>
          ),
        )}
        <Terminal sign="+" port={terminals.plus} m={m} />
        <Terminal sign="−" port={terminals.minus} m={m} />
        <View
          ref={fieldRef}
          style={{ position: 'absolute', left: origin, top: origin, width: m.field, height: m.field }}
        >
          <Cells
            grid={grid}
            cores={cores}
            preview={preview}
            m={m}
            placing={placing}
            onPlaceAt={onPlaceAt}
            terminals={terminals}
          />
          <ShadowLayer tray={tray} m={m} drag={drag} />
          <FxLayer items={fx} m={m} />
        </View>
        <View pointerEvents="none" style={styles.edge} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  outline: { padding: 4, borderRadius: 12, borderWidth: 1, borderColor: C.silkLine, backgroundColor: C.maskDeep },
  board: { borderRadius: 8, backgroundColor: C.maskDark },
  edge: { ...StyleSheet.absoluteFill, borderRadius: 8, borderWidth: 1, borderColor: C.padLine },
  terminal: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  silk: { position: 'absolute', textAlign: 'center', color: C.silkDim, fontFamily: F.mono },
});
