import type { Tier } from './types';
import { TIER_RANK } from './packs';

export interface TierStyle {
  label: string;
  color: string;
  /** Secondary color used in bursts. */
  accent: string;
}

export const TIER_STYLE: Record<Tier, TierStyle> = {
  common: { label: 'Common', color: '#b8c0d0', accent: '#ffffff' },
  rune: { label: 'Rune', color: '#c9b37a', accent: '#fff3c8' },
  uncommon: { label: 'Uncommon', color: '#4fe3a7', accent: '#c6ffe9' },
  rare: { label: 'Rare', color: '#4fa8ff', accent: '#c9e6ff' },
  epic: { label: 'Epic', color: '#b86bff', accent: '#f0d9ff' },
  altRune: { label: 'Alt-Art Rune', color: '#ffb347', accent: '#fff0c9' },
  altArt: { label: 'Alternate Art', color: '#ffb347', accent: '#fff0c9' },
  overnumbered: { label: 'Overnumbered', color: '#ff6fd0', accent: '#ffe0f6' },
  signature: { label: 'Signature', color: '#ffe066', accent: '#ffffff' },
  ultimate: { label: 'Ultimate', color: '#ff4d5e', accent: '#ffe066' },
};

/** Cards at or above this rank arrive face-down and must be flipped. */
export const FLIP_RANK = TIER_RANK.epic;
/** Cards at or above this rank get the full-screen "showcase" treatment. */
export const SHOWCASE_RANK = TIER_RANK.altArt;

export const RAINBOW = ['#ff4d6d', '#ffb347', '#ffe066', '#4fe3a7', '#4fa8ff', '#b86bff'];

export function burstColors(tier: Tier): string[] {
  const s = TIER_STYLE[tier];
  if (TIER_RANK[tier] >= TIER_RANK.signature) return [...RAINBOW, '#ffffff'];
  return [s.color, s.accent, '#ffffff'];
}
