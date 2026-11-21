import { describe, expect, it } from 'vitest';
import { EMPTY_COLLECTION, addPack, newCardIds, ownedCount, parseCollection } from './collection';
import type { PulledCard } from './types';

const pull = (id: string): PulledCard => ({
  card: { id, name: id, number: 1, tier: 'common', rarity: 'Common', type: 'Unit', domains: [], tags: [], image: 'https://x', artist: null, landscape: false, text: null, flavour: null },
  foil: false,
  slot: 'common',
});

describe('collection', () => {
  it('adds pulls and counts packs without mutating', () => {
    const a = addPack(EMPTY_COLLECTION, 'OGN', [pull('a'), pull('b'), pull('a')]);
    expect(a.cards.OGN).toEqual({ a: 2, b: 1 });
    expect(a.packsOpened.OGN).toBe(1);
    expect(EMPTY_COLLECTION.cards).toEqual({});
    const b = addPack(a, 'OGN', [pull('c')]);
    expect(ownedCount(b, 'OGN')).toBe(3);
    expect(b.packsOpened.OGN).toBe(2);
    expect(a.cards.OGN.c).toBeUndefined();
  });

  it('identifies new cards', () => {
    const a = addPack(EMPTY_COLLECTION, 'OGN', [pull('a')]);
    expect([...newCardIds(a, 'OGN', [pull('a'), pull('z')])]).toEqual(['z']);
  });

  it('parses stored data defensively', () => {
    expect(parseCollection(null)).toEqual(EMPTY_COLLECTION);
    expect(parseCollection('not json')).toEqual(EMPTY_COLLECTION);
    expect(parseCollection('42')).toEqual(EMPTY_COLLECTION);
    const parsed = parseCollection(JSON.stringify({ cards: { OGN: { a: 2, b: 'x', c: -1 } }, packsOpened: { OGN: 3, SFD: 'no' } }));
    expect(parsed).toEqual({ cards: { OGN: { a: 2 } }, packsOpened: { OGN: 3 } });
  });
});
