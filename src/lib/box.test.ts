import { describe, expect, it } from 'vitest';
import { BOX_TIERS, boxPackCost, countTiers, expectedPerBox, formatExpected, openBox, percentileOf, simulateBoxValues } from './box';
import { PACKS_PER_BOX } from './packs';
import { boxPrice, packPrice, PRICES, validatePriceBook } from './prices';
import { entryFor, priceOf } from './ledger';
import { seeded } from './rng';
import { loadSet, SETS } from './sets';

describe('box break', () => {
  it('opens 24 full packs', async () => {
    const set = await loadSet('OGN');
    const box = openBox(set.pools, undefined, seeded(1));
    expect(box).toHaveLength(PACKS_PER_BOX);
    expect(box.every((p) => p.length === 14)).toBe(true);
  });

  it.each(SETS.map((s) => s.id))('%s: expected chase-tier counts match a long simulation', async (id) => {
    const set = await loadSet(id);
    const expected = expectedPerBox(set.pools);
    const rng = seeded(42);
    const boxes = 600;
    const totals = Object.fromEntries(BOX_TIERS.map((t) => [t, 0])) as Record<string, number>;
    for (let i = 0; i < boxes; i++) {
      const c = countTiers(openBox(set.pools, undefined, rng));
      for (const t of BOX_TIERS) totals[t] += c[t];
    }
    for (const t of BOX_TIERS) {
      const avg = totals[t] / boxes;
      // Poisson-ish tolerance: 4 standard errors, plus a little slack for rare tiers.
      const tol = 4 * Math.sqrt(Math.max(expected[t], 0.01) / boxes) + 0.02;
      expect(Math.abs(avg - expected[t]), `${id} ${t}: sim ${avg.toFixed(3)} vs ${expected[t].toFixed(3)}`).toBeLessThan(tol);
    }
    // Headline rates from the collation notes: ~2 alt arts and ~6 epics per box.
    if (set.pools.altArt.length) expect(expected.altArt).toBeCloseTo(2, 5);
    expect(expected.epic).toBeGreaterThan(5);
    expect(expected.epic).toBeLessThan(8);
  });

  it('expects nothing from tiers a set does not have', async () => {
    const set = await loadSet('OGN');
    const pools = { ...set.pools, ultimate: [] };
    expect(expectedPerBox(pools).ultimate).toBe(0);
  });

  it('prices a box from the sealed display, falling back to 24 loose packs', () => {
    for (const s of SETS) {
      expect(boxPrice(s.id)).toBeGreaterThan(0);
      expect(boxPackCost(s.id) * PACKS_PER_BOX).toBeCloseTo(boxPrice(s.id), 6);
    }
    const book = validatePriceBook({ sets: { X: { pack: 5, cards: {} }, Y: { pack: 5, box: 99.5, cards: {} }, Z: { pack: 5, box: -3, cards: {} } } });
    expect(boxPrice('X', book)).toBe(120);
    expect(boxPrice('Y', book)).toBe(99.5);
    expect(boxPrice('Z', book)).toBe(120);
  });

  it('every set in the price book has a real box price', () => {
    for (const s of SETS) expect(PRICES.sets[s.id]?.box, s.id).toBeGreaterThan(0);
  });

  it('records box packs at the per-pack box cost', async () => {
    const set = await loadSet('RAD');
    const [pack] = openBox(set.pools, undefined, seeded(3));
    const perPack = boxPackCost('RAD');
    expect(priceOf('RAD', pack, undefined, perPack).cost).toBeCloseTo(perPack, 6);
    expect(entryFor('RAD', pack, 0, undefined, perPack).cost).toBeCloseTo(perPack, 6);
    expect(entryFor('RAD', pack, 0).cost).toBe(packPrice('RAD'));
  });

  it('ranks a box against simulated boxes', async () => {
    const set = await loadSet('VEN');
    const sims = simulateBoxValues('VEN', set.pools, 200, seeded(9));
    expect(sims).toHaveLength(200);
    for (let i = 1; i < sims.length; i++) expect(sims[i]).toBeGreaterThanOrEqual(sims[i - 1]);
    expect(percentileOf(sims, -1)).toBe(0);
    expect(percentileOf(sims, Infinity)).toBe(1);
    expect(percentileOf([1, 2, 3, 4], 2.5)).toBe(0.5);
    expect(percentileOf([1, 2, 2, 3], 2)).toBe(0.5);
    expect(percentileOf([], 5)).toBe(0.5);
  });

  it('formats expectations for common and rare tiers', () => {
    expect(formatExpected(6.66)).toBe('avg 6.7');
    expect(formatExpected(0.6)).toBe('avg 0.6');
    expect(formatExpected(24 / 72 - 24 / 720)).toBe('1 in 3 boxes');
    expect(formatExpected(24 / 720)).toBe('1 in 30 boxes');
    expect(formatExpected(0)).toBe('—');
  });
});
