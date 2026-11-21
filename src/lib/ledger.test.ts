import { describe, expect, it } from 'vitest';
import { appendEntry, computeStats, entryFor, histogram, LEDGER_CAP, parseLedger, priceOf, type LedgerEntry } from './ledger';
import { cardPrice, packPrice, PRICES, signedMoney, signedPct, validatePriceBook, type PriceBook } from './prices';
import { DEFAULT_ODDS, openPack } from './packs';
import { seeded } from './rng';
import { loadSet, SETS } from './sets';
import type { PulledCard, Tier } from './types';

const book: PriceBook = {
  updatedAt: '2026-01-01',
  source: 'test',
  sets: {
    T: {
      pack: 5,
      packProductId: 1,
      cards: { a: [1, 3, 10], b: [null, 8, 11], c: [0.25, null, 12] },
    },
  },
};

const pull = (id: string, foil = false, tier: Tier = 'common'): PulledCard => ({
  card: { id, name: id, number: 1, tier, rarity: 'x', type: 'Unit', domains: [], tags: [], image: 'https://x', artist: null, landscape: false, text: null, flavour: null },
  foil,
  slot: 'common',
});

const entry = (cost: number, value: number, set = 'T', bestValue = 1): LedgerEntry => ({
  t: 1,
  set,
  cost,
  value,
  best: { id: 'a', value: bestValue, tier: 'rare' },
});

describe('prices', () => {
  it('uses foil price for foils and falls back across variants', () => {
    expect(cardPrice('T', 'a', false, book)).toBe(1);
    expect(cardPrice('T', 'a', true, book)).toBe(3);
    expect(cardPrice('T', 'b', false, book)).toBe(8); // no normal → foil
    expect(cardPrice('T', 'c', true, book)).toBe(0.25); // no foil → normal
    expect(cardPrice('T', 'zzz', true, book)).toBe(0);
    expect(cardPrice('NOPE', 'a', true, book)).toBe(0);
  });

  it('falls back to MSRP-ish pack price when unknown', () => {
    expect(packPrice('T', book)).toBe(5);
    expect(packPrice('NOPE', book)).toBe(4.99);
  });

  it('formats signed values without relying on color', () => {
    expect(signedMoney(1.5)).toBe('+$1.50');
    expect(signedMoney(-2)).toBe('−$2.00');
    expect(signedMoney(0)).toBe('$0.00');
    expect(signedPct(0.256)).toBe('+25.6%');
    expect(signedPct(-0.5)).toBe('−50.0%');
  });

  it('sanitises a malformed price book', () => {
    expect(validatePriceBook(null).sets).toEqual({});
    const v = validatePriceBook({ sets: { X: { pack: -1, cards: { a: [1, 'x', 5], b: 'nope' } } } });
    expect(v.sets.X.pack).toBeNull();
    expect(v.sets.X.cards).toEqual({ a: [1, null, 5] });
  });
});

describe('pack pricing', () => {
  it('sums card values and computes profit and ROI', () => {
    const p = priceOf('T', [pull('a', true), pull('b'), pull('c')], book);
    expect(p.value).toBe(11.25);
    expect(p.cost).toBe(5);
    expect(p.profit).toBe(6.25);
    expect(p.roi).toBeCloseTo(1.25);
    expect(p.best).toEqual({ id: 'b', value: 8, tier: 'common' });
  });

  it('builds a ledger entry', () => {
    const e = entryFor('T', [pull('c')], 123, book);
    expect(e).toEqual({ t: 123, set: 'T', cost: 5, value: 0.25, best: { id: 'c', value: 0.25, tier: 'common' } });
  });
});

describe('computeStats', () => {
  it('handles an empty ledger', () => {
    const s = computeStats([]);
    expect(s.packs).toBe(0);
    expect(s.roi).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.bestPack).toBeNull();
  });

  it('aggregates totals, win rate, streaks and per-set breakdown', () => {
    const ledger = [entry(5, 2), entry(5, 9, 'T', 7), entry(5, 6), entry(4, 1, 'U'), entry(5, 5)];
    const s = computeStats(ledger);
    expect(s.packs).toBe(5);
    expect(s.spent).toBe(24);
    expect(s.value).toBe(23);
    expect(s.net).toBe(-1);
    expect(s.roi).toBeCloseTo(-1 / 24);
    expect(s.winRate).toBeCloseTo(3 / 5);
    expect(s.bestStreak).toBe(2);
    expect(s.streak).toBe(1);
    expect(s.bestPack?.value).toBe(9);
    expect(s.biggestHit?.value).toBe(7);
    expect(s.cumulative.map((c) => c.net)).toEqual([-3, 1, 2, -1, -1]);
    expect(s.bySet.find((b) => b.set === 'U')).toMatchObject({ packs: 1, spent: 4, value: 1, net: -3 });
    expect(computeStats(ledger, 'U').packs).toBe(1);
  });
});

describe('ledger storage', () => {
  it('caps its length', () => {
    let l: LedgerEntry[] = Array.from({ length: LEDGER_CAP }, () => entry(1, 1));
    l = appendEntry(l, entry(9, 9));
    expect(l).toHaveLength(LEDGER_CAP);
    expect(l[l.length - 1].cost).toBe(9);
  });

  it('parses stored data defensively', () => {
    expect(parseLedger(null)).toEqual([]);
    expect(parseLedger('{oops')).toEqual([]);
    expect(parseLedger('{}')).toEqual([]);
    const good = entry(5, 6);
    const parsed = parseLedger(JSON.stringify([good, { ...good, cost: -1 }, { ...good, best: { id: 'x', value: 1, tier: 'mythic' } }, 'junk']));
    expect(parsed).toEqual([good]);
  });
});

describe('histogram', () => {
  it('bins values into nice equal-width buckets covering every value', () => {
    const h = histogram([0.5, 1, 2.2, 3.9, 11.5], 5);
    expect(h.reduce((a, b) => a + b.count, 0)).toBe(5);
    expect(h[0].from).toBe(0);
    expect(h[h.length - 1].to).toBeGreaterThanOrEqual(11.5);
    expect(histogram([])).toEqual([]);
  });
});

describe('real price data', () => {
  it('prices every card in every set', async () => {
    for (const s of SETS) {
      const set = await loadSet(s.id);
      const priced = set.cards.filter((c) => PRICES.sets[s.id]?.cards[c.id]);
      expect(priced.length / set.cards.length).toBeGreaterThan(0.95);
      expect(PRICES.sets[s.id]?.pack).toBeGreaterThan(0);
    }
  });

  it('expected pack value is plausible for every set', async () => {
    for (const s of SETS) {
      const set = await loadSet(s.id);
      const rng = seeded(7);
      let total = 0;
      const N = 4000;
      for (let i = 0; i < N; i++) total += priceOf(s.id, openPack(set.pools, DEFAULT_ODDS, rng)).value;
      const ev = total / N;
      // Sealed packs trade near their expected value; a large gap means mis-tiered cards
      // (e.g. pricey overnumbers sitting in the regular rare pool).
      expect(ev / packPrice(s.id)).toBeGreaterThan(0.5);
      expect(ev / packPrice(s.id)).toBeLessThan(2.5);
    }
  });
});
