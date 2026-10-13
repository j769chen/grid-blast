import { N, type PlaceResult } from './engine';
import { fmt } from './format';
import { PART_COLORS, span, type Metrics } from './theme';

const PRAISE = ['', '', 'Double!', 'Triple!', 'Quad!', 'Overload!', 'Meltdown!'];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  delay?: number;
}

interface Label {
  x: number;
  y: number;
  text: string;
}

export type Fx =
  | ({ kind: 'burst'; color: string } & Box)
  | ({ kind: 'trace'; axis: 'h' | 'v'; surge: boolean } & Box)
  | ({ kind: 'ring' } & Box)
  | ({ kind: 'blast' } & Box)
  | ({ kind: 'points' | 'combo' } & Label)
  | ({ kind: 'praise'; surge: boolean } & Label);

export type FxSpec = Fx & { id: number };

export const FX_DURATION: Record<Fx['kind'], number> = {
  burst: 500,
  trace: 450,
  ring: 600,
  blast: 550,
  points: 900,
  praise: 1100,
  combo: 900,
};
export const FX_LIFETIME = 1700;

let fxId = 0;

export function buildFx(res: PlaceResult, m: Metrics): FxSpec[] {
  const items: FxSpec[] = [];
  if (!res.lineCount) return items;
  const add = (it: Fx) => items.push({ ...it, id: ++fxId });

  res.lines.rows.forEach((r) =>
    add({ kind: 'trace', axis: 'h', surge: false, x: 0, y: r * m.pitch, w: m.field, h: m.cell }),
  );
  res.lines.cols.forEach((c) =>
    add({ kind: 'trace', axis: 'v', surge: false, x: c * m.pitch, y: 0, w: m.cell, h: m.field }),
  );
  res.surges.forEach(({ idx, kind }, n) => {
    const kr = Math.floor(idx / N);
    const kc = idx % N;
    const delay = 120 + n * 120;
    if (kind === 'line') {
      add({ kind: 'trace', axis: 'h', surge: true, x: 0, y: kr * m.pitch, w: m.field, h: m.cell, delay });
      add({ kind: 'trace', axis: 'v', surge: true, x: kc * m.pitch, y: 0, w: m.cell, h: m.field, delay });
    } else {
      const r0 = Math.max(0, kr - 1);
      const c0 = Math.max(0, kc - 1);
      const rows = Math.min(N - 1, kr + 1) - r0 + 1;
      const cols = Math.min(N - 1, kc + 1) - c0 + 1;
      add({ kind: 'blast', x: c0 * m.pitch, y: r0 * m.pitch, w: span(cols, m), h: span(rows, m), delay });
    }
    add({ kind: 'ring', x: kc * m.pitch, y: kr * m.pitch, w: m.cell, h: m.cell, delay });
  });

  const { r: pr, c: pc } = res.center;
  res.cleared.forEach(({ idx, color }) => {
    const r = Math.floor(idx / N);
    const c = idx % N;
    const dist = Math.hypot(r - pr, c - pc);
    add({
      kind: 'burst',
      x: c * m.pitch,
      y: r * m.pitch,
      w: m.cell,
      h: m.cell,
      color: PART_COLORS[color],
      delay: res.lineSet.has(idx) ? dist * 28 : 260 + dist * 20,
    });
  });

  add({ kind: 'points', x: pc * m.pitch, y: pr * m.pitch, text: `+${fmt(res.gained)}` });
  const surges = res.surges.length;
  const headline = res.perfect
    ? 'Board clear!'
    : surges > 1
      ? `Surge ×${surges}!`
      : surges
        ? 'Surge!'
        : res.lineCount >= 2
          ? PRAISE[Math.min(res.lineCount, PRAISE.length - 1)]
          : '';
  let y = m.pitch * 3.2;
  if (headline) {
    add({ kind: 'praise', x: m.pitch * 4, y, text: headline, surge: surges > 0 && !res.perfect });
    y += m.pitch * 1.2;
  }
  if (res.state.combo >= 2) add({ kind: 'combo', x: m.pitch * 4, y, text: `Combo ${res.state.combo}` });
  return items;
}
