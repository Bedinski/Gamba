import { baseName, withFallbackImages } from './sets';
import type { Card, Tier } from './types';

const card = (id: string, name: string, tier: Tier): Card =>
  ({ id, name, tier, number: 0, rarity: '', type: 'Unit', domains: [], tags: [], image: `img/${id}`, artist: '', landscape: false, text: '', flavour: '' }) as Card;

describe('fallback art', () => {
  it('strips variant suffixes from names', () => {
    expect(baseName('Kayn, Unleashed (Heartsteel Signature)')).toBe('Kayn, Unleashed');
    expect(baseName('Mind Rune (R03a)')).toBe('Mind Rune');
    expect(baseName('Defy')).toBe('Defy');
  });

  it('points a signature at its overnumbered art first, and alt runes at sibling alt runes', () => {
    const cards = withFallbackImages([
      card('182', 'Kayn, Unleashed', 'overnumbered'),
      card('182*', 'Kayn, Unleashed (Heartsteel Signature)', 'signature'),
      card('r03', 'Mind Rune', 'rune'),
      card('r03a', 'Mind Rune (R03a)', 'altRune'),
      card('r03b', 'Mind Rune (R03b)', 'altRune'),
      card('7', 'Defy', 'common'),
    ]);
    const by = Object.fromEntries(cards.map((c) => [c.id, c.fallbackImages]));
    expect(by['182*']).toEqual(['img/182']);
    expect(by['r03a']).toEqual(['img/r03b', 'img/r03']);
    expect(by['7']).toBeUndefined();
  });

  it('gives every real signature card in Radiance a fallback', async () => {
    const { loadSet } = await import('./sets');
    const set = await loadSet('RAD');
    const sigs = set.cards.filter((c) => c.tier === 'signature');
    expect(sigs.length).toBeGreaterThan(0);
    for (const c of sigs) expect(c.fallbackImages?.length, c.name).toBeGreaterThan(0);
  });
});
