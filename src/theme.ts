import { N, type Port } from './engine';

export const C = {
  mask: '#0f5a3b',
  maskDeep: '#083a26',
  maskDark: '#052b1c',
  pad: '#d4ad62',
  padFaint: 'rgba(212,173,98,0.13)',
  padEdge: 'rgba(212,173,98,0.28)',
  padRing: 'rgba(212,173,98,0.5)',
  padLine: 'rgba(212,173,98,0.55)',
  copper: '#d08a4c',
  silk: '#eef2e6',
  silkDim: 'rgba(238,242,230,0.75)',
  silkLine: 'rgba(238,242,230,0.22)',
  silkFill: 'rgba(238,242,230,0.08)',
  ink: '#04140d',
  danger: '#c93a46',
  trace: '#fff1c7',
  traceGlow: '#ffd27a',
  circuit: '#944dff',
  surge: '#ff5fd2',
  surgeTrace: '#ffc2f4',
  surgeText: '#ffb3f3',
  comboText: '#7fefff',
  scrim: 'rgba(3,20,13,0.72)',
};

export const PART_COLORS = ['#ff4d5e', '#ffa62b', '#ffe14d', '#4da3ff', '#3fe0ff', '#ff5fd2', '#eef3ff'];

export const F = {
  medium: 'ChakraPetch_500Medium',
  semi: 'ChakraPetch_600SemiBold',
  bold: 'ChakraPetch_700Bold',
  mono: 'ShareTechMono_400Regular',
};

export interface Metrics {
  size: number;
  pad: number;
  gut: number;
  field: number;
  gap: number;
  cell: number;
  pitch: number;
  mini: number;
  miniGap: number;
  b: number;
  glow: number;
}

export function metrics(width: number, height: number): Metrics {
  const size = Math.max(120, Math.min(width - 20, 440, (height - 168) / 1.36));
  const pad = Math.round(size * 0.02);
  const gut = Math.round(size * 0.05);
  const field = size - pad * 2 - gut * 2;
  const gap = Math.max(2, Math.round(size * 0.007));
  const cell = (field - gap * (N - 1)) / N;
  return {
    size,
    pad,
    gut,
    field,
    gap,
    cell,
    pitch: cell + gap,
    mini: (size / N) * 0.44,
    miniGap: 2,
    b: size * 0.008,
    glow: size * 0.02,
  };
}

export const span = (cells: number, m: Metrics) => cells * m.pitch - m.gap;

export function portCentre({ side, at }: Port, m: Metrics) {
  const along = at * m.pitch + m.cell / 2;
  const out = side === 'left' || side === 'top' ? -m.gut / 2 : m.field + m.gut / 2;
  return side === 'left' || side === 'right' ? { x: out, y: along } : { x: along, y: out };
}

export const glow = (color: string, radius: number, opacity = 1) =>
  `0 0 ${radius * 2}px ${color}${
    opacity < 1
      ? Math.round(opacity * 255)
          .toString(16)
          .padStart(2, '0')
      : ''
  }`;
