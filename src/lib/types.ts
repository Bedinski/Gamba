export const TIERS = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'altArt',
  'overnumbered',
  'signature',
  'ultimate',
  'rune',
  'altRune',
] as const;

export type Tier = (typeof TIERS)[number];

export interface Card {
  id: string;
  name: string;
  number: number;
  tier: Tier;
  rarity: string;
  type: string;
  domains: string[];
  tags: string[];
  image: string;
  artist: string | null;
  landscape: boolean;
  text: string | null;
  flavour: string | null;
  /** TCGplayer product id, for sets sourced from TCGplayer's catalog. */
  tcgplayerId?: number;
  /** Same-name variants whose art can stand in if this card's image is not published yet. */
  fallbackImages?: string[];
}

export interface SetInfo {
  id: string;
  name: string;
  releasedOn: string | null;
}

export type SlotKind = 'common' | 'uncommon' | 'foil' | 'rune' | 'rare';

export interface PulledCard {
  card: Card;
  foil: boolean;
  slot: SlotKind;
}
