import type { Card, PulledCard, Tier } from './types';
import { pick, pickDistinct, type Rng } from './rng';

/**
 * Booster collation, from Riot's "Collectability in Riftbound: Origins" and
 * "The Unleashed Overview" articles:
 *   7 Common · 3 Uncommon · 1 Foil (any C/U/R/E) · 2 Rare-or-better · 1 Rune
 * Rates (a display box holds 24 packs):
 *   Epic            ≈ 1 in 4 packs (replaces a rare slot; two are possible)
 *   Alt art         ≈ 2 per box       → 1/12 packs
 *   Overnumbered    ≈ 1 per 3 boxes   → 1/72 packs
 *   Signature       ≈ 1 in 10 overnumbers → 1/720 packs
 *   Ultimate        < 0.1% of packs (Unleashed)
 * Every Rare and Epic is foil.
 */
export const PACK_SIZE = 14;
export const PACKS_PER_BOX = 24;

export interface PackOdds {
  /** Chance each Rare+ slot is an Epic instead of a Rare. */
  epicPerRareSlot: number;
  /** Per-pack chances that the second Rare+ slot upgrades to a showcase card. */
  altArtPerPack: number;
  overnumberedPerPack: number;
  signaturePerPack: number;
  ultimatePerPack: number;
  /** Foil slot rarity weights (normalised). */
  foilSlot: { common: number; uncommon: number; rare: number; epic: number };
  /** Rune slot: chance of foil basic rune, chance of alt-art rune. */
  runeFoil: number;
  runeAlt: number;
}

// 1 - (1 - p)^2 = 1/4  →  p ≈ 0.134
export const DEFAULT_ODDS: PackOdds = {
  epicPerRareSlot: 1 - Math.sqrt(0.75),
  altArtPerPack: 1 / 12,
  overnumberedPerPack: 1 / 72 - 1 / 720,
  signaturePerPack: 1 / 720,
  ultimatePerPack: 1 / 1200,
  foilSlot: { common: 0.6, uncommon: 0.27, rare: 0.1, epic: 0.03 },
  runeFoil: 0.15,
  runeAlt: 1 / 72,
};

export type Pools = Record<Tier, Card[]>;

export function buildPools(cards: Card[], fallbackRunes: Card[] = []): Pools {
  const pools = {} as Pools;
  for (const t of ['common', 'uncommon', 'rare', 'epic', 'altArt', 'overnumbered', 'signature', 'ultimate', 'rune', 'altRune'] as Tier[]) {
    pools[t] = [];
  }
  for (const c of cards) pools[c.tier].push(c);
  // Sets without their own basic runes use the base set's runes in the rune slot.
  if (pools.rune.length === 0) {
    for (const c of fallbackRunes) pools[c.tier].push(c);
  }
  return pools;
}

/** Higher = rarer. Used for reveal order and pack "aura". */
export const TIER_RANK: Record<Tier, number> = {
  common: 0,
  rune: 0,
  uncommon: 1,
  rare: 2,
  altRune: 3,
  epic: 3,
  altArt: 4,
  overnumbered: 5,
  signature: 6,
  ultimate: 7,
};

export function rankOf(p: PulledCard): number {
  return TIER_RANK[p.card.tier];
}

function weighted<K extends string>(weights: Record<K, number>, rng: Rng): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    if ((r -= w) < 0) return k;
  }
  return entries[entries.length - 1][0];
}

function rareSlot(pools: Pools, odds: PackOdds, rng: Rng): Card {
  const tier: Tier = pools.epic.length && rng() < odds.epicPerRareSlot ? 'epic' : 'rare';
  return pick(pools[tier], rng);
}

/** Roll the showcase upgrade for the second Rare+ slot, or null for none. */
function showcaseUpgrade(pools: Pools, odds: PackOdds, rng: Rng): Card | null {
  const r = rng();
  const ladder: [Tier, number][] = [
    ['ultimate', odds.ultimatePerPack],
    ['signature', odds.signaturePerPack],
    ['overnumbered', odds.overnumberedPerPack],
    ['altArt', odds.altArtPerPack],
  ];
  let acc = 0;
  for (const [tier, p] of ladder) {
    acc += p;
    if (r < acc) return pools[tier].length ? pick(pools[tier], rng) : null;
  }
  return null;
}

export function openPack(pools: Pools, odds: PackOdds = DEFAULT_ODDS, rng: Rng = Math.random): PulledCard[] {
  const commons = pickDistinct(pools.common, 7, rng).map((card): PulledCard => ({ card, foil: false, slot: 'common' }));
  const uncommons = pickDistinct(pools.uncommon, 3, rng).map((card): PulledCard => ({ card, foil: false, slot: 'uncommon' }));

  let foilTier = weighted(odds.foilSlot, rng) as Tier;
  if (!pools[foilTier].length) foilTier = 'common';
  const foil: PulledCard = { card: pick(pools[foilTier], rng), foil: true, slot: 'foil' };

  let rune: PulledCard;
  const runeRoll = rng();
  if (pools.altRune.length && runeRoll < odds.runeAlt) {
    rune = { card: pick(pools.altRune, rng), foil: true, slot: 'rune' };
  } else {
    rune = { card: pick(pools.rune, rng), foil: runeRoll < odds.runeAlt + odds.runeFoil, slot: 'rune' };
  }

  const rare1 = rareSlot(pools, odds, rng);
  let rare2 = showcaseUpgrade(pools, odds, rng) ?? rareSlot(pools, odds, rng);
  if (rare2.id === rare1.id && pools.rare.length > 1) {
    while (rare2.id === rare1.id) rare2 = rareSlot(pools, odds, rng);
  }
  const rares = [rare1, rare2]
    .map((card): PulledCard => ({ card, foil: true, slot: 'rare' }))
    .sort((a, b) => rankOf(a) - rankOf(b));

  // Reveal order: bulk first, the best stuff saved for last.
  return [...commons, ...uncommons, rune, foil, ...rares];
}

export function bestRank(pack: PulledCard[]): number {
  return Math.max(...pack.map(rankOf));
}
