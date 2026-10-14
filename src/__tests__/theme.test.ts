import { describe, expect, it } from '@jest/globals';

import { metrics } from '../theme';

describe('metrics', () => {
  it('shrinks the board so everything fits in a short window', () => {
    for (const [w, h] of [
      [844, 390],
      [740, 360],
    ]) {
      expect(metrics(w, h).size * 1.36 + 168).toBeLessThanOrEqual(h);
    }
  });
});
