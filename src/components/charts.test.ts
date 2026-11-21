import { describe, expect, it } from 'vitest';
import { niceTicks } from './charts';

describe('niceTicks', () => {
  it('always spans the full data range', () => {
    for (const [lo, hi, n] of [
      [0, 8, 3],
      [0, 1, 5],
      [-37.2, 12.4, 4],
      [-0.3, 0, 4],
      [0, 3711, 5],
      [5, 5, 4],
    ]) {
      const t = niceTicks(lo, hi, n);
      expect(t[0]).toBeLessThanOrEqual(lo);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(hi);
      expect(t.length).toBeLessThan(15);
    }
  });

  it('uses round steps', () => {
    expect(niceTicks(0, 8, 3)).toEqual([0, 5, 10]);
    expect(niceTicks(-30, 10, 4)).toEqual([-30, -20, -10, 0, 10]);
  });
});
