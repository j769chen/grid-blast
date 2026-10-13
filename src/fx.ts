import type { FxSpec } from './components/Fx';
import { N, type PlaceResult } from './engine';
import { fmt } from './format';
import { PART_COLORS, type Metrics } from './theme';

const PRAISE = ['', '', 'Double!', 'Triple!', 'Quad!', 'Overload!', 'Meltdown!'];

let fxId = 0;

export function buildFx(res: PlaceResult, m: Metrics): FxSpec[] {
  const items: FxSpec[] = [];
  if (!res.lineCount) return items;
  const add = (it: Omit<FxSpec, 'id'>) => items.push({ ...it, id: ++fxId });

  res.lines.rows.forEach((r) => add({ kind: 'traceH', x: 0, y: r * m.pitch, w: m.field, h: m.cell }));
  res.lines.cols.forEach((c) => add({ kind: 'traceV', x: c * m.pitch, y: 0, w: m.cell, h: m.field }));
  res.surges.forEach((k, n) => {
    const kr = Math.floor(k / N);
    const kc = k % N;
    const delay = 120 + n * 120;
    add({ kind: 'traceH', x: 0, y: kr * m.pitch, w: m.field, h: m.cell, delay, surge: true });
    add({ kind: 'traceV', x: kc * m.pitch, y: 0, w: m.cell, h: m.field, delay, surge: true });
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
