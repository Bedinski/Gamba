import { TIERS, type Card } from './types';
import type { PackOdds, Pools } from './packs';

export class DataError extends Error {}

const TIER_SET = new Set<string>(TIERS);

/** Validate raw JSON card data and return it typed. Throws DataError on bad input. */
export function validateCards(data: unknown, setId: string): Card[] {
  if (!Array.isArray(data)) throw new DataError(`${setId}: card data is not an array`);
  const seen = new Set<string>();
  data.forEach((c, i) => {
    const where = `${setId}[${i}]`;
    if (typeof c !== 'object' || c === null) throw new DataError(`${where}: not an object`);
    const card = c as Record<string, unknown>;
    for (const key of ['id', 'name', 'image', 'type', 'rarity'] as const) {
      if (typeof card[key] !== 'string' || !(card[key] as string).length) {
        throw new DataError(`${where}: missing "${key}"`);
      }
    }
    if (typeof card.number !== 'number') throw new DataError(`${where}: missing "number"`);
    if (!TIER_SET.has(card.tier as string)) throw new DataError(`${where}: unknown tier "${String(card.tier)}"`);
    if (!/^https:\/\//.test(card.image as string)) throw new DataError(`${where}: image must be https`);
    if (!Array.isArray(card.domains)) throw new DataError(`${where}: domains must be an array`);
    if (seen.has(card.id as string)) throw new DataError(`${where}: duplicate id ${String(card.id)}`);
    seen.add(card.id as string);
  });
  return data as Card[];
}

/** Ensure the pools can actually fill every pack slot. */
export function validatePools(pools: Pools, setId: string): void {
  const need: [keyof Pools, number][] = [
    ['common', 7],
    ['uncommon', 3],
    ['rare', 2],
    ['rune', 1],
  ];
  for (const [tier, n] of need) {
    if (pools[tier].length < n) throw new DataError(`${setId}: needs at least ${n} ${tier} cards, has ${pools[tier].length}`);
  }
}

export function validateOdds(odds: PackOdds): void {
  const probs: [string, number][] = [
    ['epicPerRareSlot', odds.epicPerRareSlot],
    ['altArtPerPack', odds.altArtPerPack],
    ['overnumberedPerPack', odds.overnumberedPerPack],
    ['signaturePerPack', odds.signaturePerPack],
    ['ultimatePerPack', odds.ultimatePerPack],
    ['runeFoil', odds.runeFoil],
    ['runeAlt', odds.runeAlt],
  ];
  for (const [k, p] of probs) {
    if (!(p >= 0 && p <= 1)) throw new DataError(`odds.${k} must be within [0, 1]`);
  }
  const showcase = odds.altArtPerPack + odds.overnumberedPerPack + odds.signaturePerPack + odds.ultimatePerPack;
  if (showcase > 1) throw new DataError('showcase odds sum above 1');
  if (odds.runeFoil + odds.runeAlt > 1) throw new DataError('rune odds sum above 1');
  const w = Object.values(odds.foilSlot);
  if (w.some((x) => x < 0) || w.reduce((a, b) => a + b, 0) <= 0) throw new DataError('foil slot weights invalid');
}
