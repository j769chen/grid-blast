import { memo, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, N } from '../engine';
import { C, F, type Metrics } from '../theme';
import { FxLayer, type FxSpec } from './Fx';
import { Led, Pad } from './Led';

export interface Preview {
  ghost: Set<number>;
  hint: Set<number>;
  color: string;
  coreIdx: number;
}

interface BoardProps {
  grid: number[];
  cores: boolean[];
  preview: Preview | null;
  m: Metrics;
  fieldRef: Ref<View>;
  onFieldLayout: () => void;
  fx: FxSpec[];
}

const COLS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const Board = memo(function Board({ grid, cores, preview, m, fieldRef, onFieldLayout, fx }: BoardProps) {
  const origin = m.pad + m.gut;
  const labelSize = m.size * 0.03;

  const cells = [];
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N);
    const c = i % N;
    let color: string | null = null;
    let core = false;
    let dim = false;
    let bright = false;
    if (preview?.hint.has(i)) {
      color = preview.color;
      bright = true;
      core = cores[i] || i === preview.coreIdx;
    } else if (preview?.ghost.has(i)) {
      color = preview.color;
      dim = true;
      core = i === preview.coreIdx;
    } else if (grid[i] >= 0) {
      color = COLORS[grid[i]];
      core = cores[i];
    }
    cells.push(
      <View key={i} style={{ position: 'absolute', left: c * m.pitch, top: r * m.pitch }}>
        {color ? (
          <Led color={color} size={m.cell} b={m.b} glow={m.glow} core={core} dim={dim} bright={bright} />
        ) : (
          <Pad size={m.cell} />
        )}
      </View>,
    );
  }

  return (
    <View style={styles.outline}>
      <View style={[styles.board, { width: m.size, height: m.size }]}>
        <Text
          style={[
            styles.silk,
            { left: m.pad, top: m.pad, width: m.gut, height: m.gut, lineHeight: m.gut, fontSize: m.size * 0.02 },
          ]}
        >
          OC-1
        </Text>
        {COLS.map((label, c) => (
          <Text
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
        {ROWS.map((label, r) => (
          <Text
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
          onLayout={onFieldLayout}
          style={{ position: 'absolute', left: origin, top: origin, width: m.field, height: m.field }}
        >
          {cells}
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
