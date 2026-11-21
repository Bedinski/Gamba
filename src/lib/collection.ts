import type { PulledCard } from './types';

export interface Collection {
  /** setId → cardId → copies owned */
  cards: Record<string, Record<string, number>>;
  packsOpened: Record<string, number>;
}

export const EMPTY_COLLECTION: Collection = { cards: {}, packsOpened: {} };

export function addPack(col: Collection, setId: string, pack: PulledCard[]): Collection {
  const setCards = { ...(col.cards[setId] ?? {}) };
  for (const p of pack) setCards[p.card.id] = (setCards[p.card.id] ?? 0) + 1;
  return {
    cards: { ...col.cards, [setId]: setCards },
    packsOpened: { ...col.packsOpened, [setId]: (col.packsOpened[setId] ?? 0) + 1 },
  };
}

/** Card ids in `pack` that were not owned before it was opened. */
export function newCardIds(before: Collection, setId: string, pack: PulledCard[]): Set<string> {
  const owned = before.cards[setId] ?? {};
  return new Set(pack.filter((p) => !owned[p.card.id]).map((p) => p.card.id));
}

export function ownedCount(col: Collection, setId: string): number {
  return Object.keys(col.cards[setId] ?? {}).length;
}

/** Parse untrusted stored JSON, falling back to an empty collection. */
export function parseCollection(raw: string | null): Collection {
  if (!raw) return EMPTY_COLLECTION;
  try {
    const v = JSON.parse(raw) as Partial<Collection>;
    if (typeof v !== 'object' || v === null) return EMPTY_COLLECTION;
    const cards: Collection['cards'] = {};
    for (const [set, entries] of Object.entries(v.cards ?? {})) {
      if (typeof entries !== 'object' || entries === null) continue;
      cards[set] = {};
      for (const [id, n] of Object.entries(entries)) {
        if (typeof n === 'number' && Number.isFinite(n) && n > 0) cards[set][id] = Math.floor(n);
      }
    }
    const packsOpened: Collection['packsOpened'] = {};
    for (const [set, n] of Object.entries(v.packsOpened ?? {})) {
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) packsOpened[set] = Math.floor(n);
    }
    return { cards, packsOpened };
  } catch {
    return EMPTY_COLLECTION;
  }
}
