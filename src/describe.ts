import { N, type CoreKind, type Piece } from './engine';

export const PART_NAMES = ['red', 'orange', 'yellow', 'blue', 'cyan', 'pink', 'white'];
export const COL_LABELS = Array.from({ length: N }, (_, c) => String(c + 1));
export const ROW_LABELS = Array.from({ length: N }, (_, r) => String.fromCharCode(65 + r));

const CORE_NAMES: Record<CoreKind, string> = { line: 'line core', area: 'area core' };

export function describePiece(p: Piece) {
  const core = p.core >= 0 ? `, ${CORE_NAMES[p.coreKind]}` : '';
  return `${PART_NAMES[p.c]} ${p.cells.length}-cell part, ${p.w} wide by ${p.h} tall${core}`;
}

export function describeCell(r: number, c: number, color: number, core: CoreKind | null) {
  const name = `${ROW_LABELS[r]}${COL_LABELS[c]}`;
  if (color < 0) return `${name}, empty`;
  return `${name}, ${PART_NAMES[color]}${core ? `, ${CORE_NAMES[core]}` : ''}`;
}
