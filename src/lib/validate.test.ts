import { describe, expect, it } from 'vitest';
import { DataError, validateCards, validateOdds, validatePools } from './validate';
import { DEFAULT_ODDS, buildPools } from './packs';

const good = {
  id: 'ogn-001-298',
  name: 'Test',
  number: 1,
  tier: 'common',
  rarity: 'Common',
  type: 'Unit',
  domains: ['Fury'],
  tags: [],
  image: 'https://cmsassets.rgpub.io/x.png',
  artist: null,
  landscape: false,
  text: null,
  flavour: null,
};

describe('validateCards', () => {
  it('accepts well-formed data', () => {
    expect(validateCards([good], 'T')).toHaveLength(1);
  });
  it('rejects non-arrays', () => {
    expect(() => validateCards({}, 'T')).toThrow(DataError);
  });
  it('rejects missing fields', () => {
    expect(() => validateCards([{ ...good, name: '' }], 'T')).toThrow(/name/);
    expect(() => validateCards([{ ...good, number: '1' }], 'T')).toThrow(/number/);
  });
  it('rejects unknown tiers', () => {
    expect(() => validateCards([{ ...good, tier: 'mythic' }], 'T')).toThrow(/tier/);
  });
  it('rejects insecure image urls', () => {
    expect(() => validateCards([{ ...good, image: 'http://x/y.png' }], 'T')).toThrow(/https/);
  });
  it('rejects duplicate ids', () => {
    expect(() => validateCards([good, good], 'T')).toThrow(/duplicate/);
  });
});

describe('validatePools', () => {
  it('rejects a set that cannot fill a pack', () => {
    const pools = buildPools(validateCards([good], 'T'));
    expect(() => validatePools(pools, 'T')).toThrow(/common/);
  });
});

describe('validateOdds', () => {
  it('rejects out-of-range probabilities', () => {
    expect(() => validateOdds({ ...DEFAULT_ODDS, altArtPerPack: 1.5 })).toThrow(DataError);
    expect(() => validateOdds({ ...DEFAULT_ODDS, runeFoil: -0.1 })).toThrow(DataError);
  });
  it('rejects showcase odds summing above 1', () => {
    expect(() => validateOdds({ ...DEFAULT_ODDS, altArtPerPack: 0.6, overnumberedPerPack: 0.6 })).toThrow(/sum/);
  });
  it('rejects empty foil weights', () => {
    expect(() => validateOdds({ ...DEFAULT_ODDS, foilSlot: { common: 0, uncommon: 0, rare: 0, epic: 0 } })).toThrow(/foil/);
  });
});
