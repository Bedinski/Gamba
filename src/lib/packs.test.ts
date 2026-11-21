import { describe, expect, it } from 'vitest';
import { DEFAULT_ODDS, PACK_SIZE, PACKS_PER_BOX, bestRank, buildPools, openPack, TIER_RANK } from './packs';
import { seeded } from './rng';
import { loadSet, SETS } from './sets';
import type { Card, Tier } from './types';
import { validateOdds } from './validate';

function fake(tier: Tier, n: number): Card[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${tier}-${i}`,
    name: `${tier} ${i}`,
    number: i,
    tier,
    rarity: tier,
    type: 'Unit',
    domains: [],
    tags: [],
    image: 'https://example.com/x.png',
    artist: null,
    landscape: false,
    text: null,
    flavour: null,
  }));
}

const FAKE = [
  ...fake('common', 20),
  ...fake('uncommon', 20),
  ...fake('rare', 20),
  ...fake('epic', 10),
  ...fake('altArt', 5),
  ...fake('overnumbered', 5),
  ...fake('signature', 5),
  ...fake('ultimate', 1),
  ...fake('rune', 6),
  ...fake('altRune', 6),
];

describe('openPack structure', () => {
  const pools = buildPools(FAKE);

  it('always produces 7C / 3U / 1 rune / 1 foil / 2 rare+', () => {
    const rng = seeded(1);
    for (let i = 0; i < 2000; i++) {
      const pack = openPack(pools, DEFAULT_ODDS, rng);
      expect(pack).toHaveLength(PACK_SIZE);
      const slots = pack.map((p) => p.slot);
      expect(slots.filter((s) => s === 'common')).toHaveLength(7);
      expect(slots.filter((s) => s === 'uncommon')).toHaveLength(3);
      expect(slots.filter((s) => s === 'rune')).toHaveLength(1);
      expect(slots.filter((s) => s === 'foil')).toHaveLength(1);
      expect(slots.filter((s) => s === 'rare')).toHaveLength(2);

      for (const p of pack) {
        if (p.slot === 'common') expect(p.card.tier).toBe('common');
        if (p.slot === 'uncommon') expect(p.card.tier).toBe('uncommon');
        if (p.slot === 'rune') expect(['rune', 'altRune']).toContain(p.card.tier);
        if (p.slot === 'foil') {
          expect(p.foil).toBe(true);
          expect(['common', 'uncommon', 'rare', 'epic']).toContain(p.card.tier);
        }
        if (p.slot === 'rare') {
          expect(p.foil).toBe(true); // every Rare and Epic is foil
          expect(TIER_RANK[p.card.tier]).toBeGreaterThanOrEqual(TIER_RANK.rare);
        }
      }
    }
  });

  it('never repeats a common or uncommon within one pack', () => {
    const rng = seeded(2);
    for (let i = 0; i < 500; i++) {
      const pack = openPack(pools, DEFAULT_ODDS, rng);
      const c = pack.filter((p) => p.slot === 'common' || p.slot === 'uncommon').map((p) => p.card.id);
      expect(new Set(c).size).toBe(c.length);
      const r = pack.filter((p) => p.slot === 'rare').map((p) => p.card.id);
      expect(r[0]).not.toBe(r[1]);
    }
  });

  it('holds at most one ultimate and saves the best card for last', () => {
    const rng = seeded(3);
    for (let i = 0; i < 2000; i++) {
      const pack = openPack(pools, DEFAULT_ODDS, rng);
      expect(pack.filter((p) => p.card.tier === 'ultimate').length).toBeLessThanOrEqual(1);
      expect(TIER_RANK[pack[pack.length - 1].card.tier]).toBe(
        Math.max(...pack.filter((p) => p.slot === 'rare').map((p) => TIER_RANK[p.card.tier])),
      );
    }
  });

  it('is deterministic for a given seed', () => {
    const a = openPack(pools, DEFAULT_ODDS, seeded(42)).map((p) => p.card.id);
    const b = openPack(pools, DEFAULT_ODDS, seeded(42)).map((p) => p.card.id);
    expect(a).toEqual(b);
  });

  it('uses fallback runes when a set has none', () => {
    const noRunes = FAKE.filter((c) => c.tier !== 'rune' && c.tier !== 'altRune');
    const p = buildPools(noRunes, fake('rune', 6));
    expect(p.rune).toHaveLength(6);
    expect(openPack(p, DEFAULT_ODDS, seeded(5)).find((x) => x.slot === 'rune')).toBeTruthy();
  });

  it('falls back to a rare when a showcase pool is empty', () => {
    const p = buildPools(FAKE.filter((c) => !['altArt', 'overnumbered', 'signature', 'ultimate'].includes(c.tier)));
    const rng = seeded(9);
    for (let i = 0; i < 1000; i++) {
      for (const card of openPack(p, DEFAULT_ODDS, rng)) expect(['altArt', 'ultimate'].includes(card.card.tier)).toBe(false);
    }
  });
});

describe('pull rates match the published odds', () => {
  const pools = buildPools(FAKE);
  const N = 200_000;
  const rng = seeded(1234);
  let packsWithEpic = 0;
  let alt = 0;
  let over = 0;
  let sig = 0;
  let foilRare = 0;
  for (let i = 0; i < N; i++) {
    const pack = openPack(pools, DEFAULT_ODDS, rng);
    if (pack.some((p) => p.slot === 'rare' && p.card.tier === 'epic')) packsWithEpic++;
    if (pack.some((p) => p.card.tier === 'altArt')) alt++;
    if (pack.some((p) => p.card.tier === 'overnumbered')) over++;
    if (pack.some((p) => p.card.tier === 'signature')) sig++;
    if (pack.some((p) => p.slot === 'foil' && (p.card.tier === 'rare' || p.card.tier === 'epic'))) foilRare++;
  }

  it('epics appear in roughly 1 of 4 packs', () => {
    expect(packsWithEpic / N).toBeGreaterThan(0.21);
    expect(packsWithEpic / N).toBeLessThan(0.26);
  });
  it('alt arts appear about twice per 24-pack box', () => {
    expect((alt / N) * PACKS_PER_BOX).toBeGreaterThan(1.8);
    expect((alt / N) * PACKS_PER_BOX).toBeLessThan(2.2);
  });
  it('overnumbered (incl. signatures) appear about once per three boxes', () => {
    const perThreeBoxes = ((over + sig) / N) * PACKS_PER_BOX * 3;
    expect(perThreeBoxes).toBeGreaterThan(0.85);
    expect(perThreeBoxes).toBeLessThan(1.15);
  });
  it('about one in ten overnumbers is a signature', () => {
    expect(sig / (over + sig)).toBeGreaterThan(0.07);
    expect(sig / (over + sig)).toBeLessThan(0.13);
  });
  it('the foil slot upgrades to rare-or-better around 13% of the time', () => {
    expect(foilRare / N).toBeGreaterThan(0.11);
    expect(foilRare / N).toBeLessThan(0.15);
  });
});

describe('real set data', () => {
  it('default odds are valid', () => {
    expect(() => validateOdds(DEFAULT_ODDS)).not.toThrow();
  });

  it('includes every booster set', () => {
    expect(SETS.map((s) => s.id)).toEqual(['OGN', 'SFD', 'UNL', 'VEN']);
  });

  for (const s of SETS) {
    it(`${s.id} loads, validates and opens 500 legal packs`, async () => {
      const set = await loadSet(s.id);
      expect(set.pools.common.length).toBeGreaterThanOrEqual(7);
      expect(set.pools.rare.length).toBeGreaterThan(10);
      expect(set.pools.altArt.length).toBeGreaterThan(0);
      const rng = seeded(s.id.charCodeAt(0));
      for (let i = 0; i < 500; i++) {
        const pack = openPack(set.pools, DEFAULT_ODDS, rng);
        expect(pack).toHaveLength(PACK_SIZE);
        expect(bestRank(pack)).toBeGreaterThanOrEqual(TIER_RANK.rare);
      }
    });
  }

  it('Unleashed contains exactly one Ultimate (Baron Nashor)', async () => {
    const set = await loadSet('UNL');
    expect(set.pools.ultimate.map((c) => c.name)).toEqual(['Baron Nashor (Ultimate)']);
  });

  it('only Unleashed can contain an Ultimate', async () => {
    for (const id of ['OGN', 'SFD', 'VEN']) expect((await loadSet(id)).pools.ultimate).toHaveLength(0);
  });
});
