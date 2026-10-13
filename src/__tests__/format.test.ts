import { describe, expect, it } from '@jest/globals';

import { fmt } from '../format';

describe('fmt', () => {
  it('adds thousands separators', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(1234567)).toBe('1,234,567');
  });
});
