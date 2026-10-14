import { memo, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DragShared } from '../drag';
import { COL_LABELS, describeCell, ROW_LABELS } from '../describe';
import { fits, N, type CoreKind, type Piece } from '../engine';
import { C, F, PART_COLORS, type Metrics } from '../theme';
import type { FxSpec } from '../fx';
import { FxLayer } from './Fx';
import { Led, Pad } from './Led';
import { ShadowLayer } from './Shadow';

export interface Preview {
  hint: Set<number>;
  color: string;
}

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
}

const PLACE = [{ name: 'activate' as const, label: 'Place here' }];

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
}: BoardProps) {
  const origin = m.pad + m.gut;
  const labelSize = m.size * 0.03;

  const cells = [];
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N);
    const c = i % N;
    const bright = !!preview?.hint.has(i);
    const color = bright ? preview!.color : grid[i] >= 0 ? PART_COLORS[grid[i]] : null;
    const core = color ? cores[i] : null;
    const open = !!placing && fits(grid, placing, r, c);
    cells.push(
      <View
        key={i}
        accessible
        accessibilityLabel={describeCell(r, c, grid[i], cores[i])}
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
          <Led color={color} size={m.cell} b={m.b} glow={m.glow} core={core} bright={bright} />
        ) : (
          <Pad size={m.cell} />
        )}
      </View>,
    );
  }

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
        {COL_LABELS.map((label, c) => (
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
        ))}
        {ROW_LABELS.map((label, r) => (
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
        ))}
        <View
          ref={fieldRef}
          style={{ position: 'absolute', left: origin, top: origin, width: m.field, height: m.field }}
        >
          {cells}
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
  edge: { ...StyleSheet.absoluteFill, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,173,98,0.55)' },
  silk: { position: 'absolute', textAlign: 'center', color: C.silkDim, fontFamily: F.mono },
});
