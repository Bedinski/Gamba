import type { PulledCard, Tier } from './types';
import { DEFAULT_ODDS, openPack, PACKS_PER_BOX, type PackOdds, type Pools } from './packs';
import { boxPrice, pullPrice, PRICES, type PriceBook } from './prices';
import type { Rng } from './rng';

/** The chase tiers a box report counts, rarest last. */
export const BOX_TIERS: Tier[] = ['epic', 'altRune', 'altArt', 'overnumbered', 'signature', 'ultimate'];

/** Open a sealed 24-pack box. Packs are independent rolls at the published rates. */
export function openBox(pools: Pools, odds: PackOdds = DEFAULT_ODDS, rng: Rng = Math.random): PulledCard[][] {
  return Array.from({ length: PACKS_PER_BOX }, () => openPack(pools, odds, rng));
}

/** What one pack in a box costs when you buy the sealed box. */
export function boxPackCost(setId: string, book: PriceBook = PRICES): number {
  return boxPrice(setId, book) / PACKS_PER_BOX;
}

/** How many cards of each chase tier a box actually held. */
export function countTiers(packs: PulledCard[][]): Record<Tier, number> {
  const out = {} as Record<Tier, number>;
  for (const t of BOX_TIERS) out[t] = 0;
  for (const pack of packs) for (const p of pack) if (p.card.tier in out) out[p.card.tier]++;
  return out;
}

/**
 * Expected count of each chase tier in a box, worked out from the pack odds and
 * which pools this set actually has (a set with no Ultimates expects none).
 */
export function expectedPerBox(pools: Pools, odds: PackOdds = DEFAULT_ODDS, packs = PACKS_PER_BOX): Record<Tier, number> {
  const has = (t: Tier) => pools[t].length > 0;
  const showcase: [Tier, number][] = [
    ['ultimate', odds.ultimatePerPack],
    ['signature', odds.signaturePerPack],
    ['overnumbered', odds.overnumberedPerPack],
    ['altArt', odds.altArtPerPack],
  ];
  const pShowcase = showcase.reduce((a, [t, p]) => a + (has(t) ? p : 0), 0);
  const fs = odds.foilSlot;
  const foilEpic = fs.epic / (fs.common + fs.uncommon + fs.rare + fs.epic);
  const epicSlot = has('epic') ? odds.epicPerRareSlot : 0;

  const out = {} as Record<Tier, number>;
  for (const t of BOX_TIERS) out[t] = 0;
  for (const [t, p] of showcase) out[t] = has(t) ? p * packs : 0;
  // Rare slot 1, rare slot 2 when it isn't upgraded to a showcase card, and the foil slot.
  out.epic = has('epic') ? (epicSlot + (1 - pShowcase) * epicSlot + foilEpic) * packs : 0;
  out.altRune = has('altRune') ? odds.runeAlt * packs : 0;
  return out;
}

/** Total market value of a box at today's prices. */
export function boxValue(setId: string, packs: PulledCard[][], book: PriceBook = PRICES): number {
  let v = 0;
  for (const pack of packs) for (const p of pack) v += pullPrice(setId, p, book);
  return v;
}

/** Values of `n` simulated boxes, sorted ascending — the yardstick for "how lucky was that?". */
export function simulateBoxValues(setId: string, pools: Pools, n: number, rng: Rng = Math.random, book: PriceBook = PRICES): number[] {
  const values: number[] = [];
  for (let i = 0; i < n; i++) values.push(boxValue(setId, openBox(pools, DEFAULT_ODDS, rng), book));
  return values.sort((a, b) => a - b);
}

/** Share of `sorted` values strictly below `v` (ties count half), 0..1. */
export function percentileOf(sorted: number[], v: number): number {
  if (!sorted.length) return 0.5;
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return (below + equal / 2) / sorted.length;
}

/** "avg 6.7" for common chase tiers, "1 in 30 boxes" for the rare ones. */
export function formatExpected(e: number): string {
  if (e <= 0) return '—';
  if (e >= 0.5) return `avg ${e.toFixed(1)}`;
  return `1 in ${Math.max(2, Math.round(1 / e))} boxes`;
}
