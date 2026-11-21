import setsJson from '../data/sets.json';
import type { Card, SetInfo, Tier } from './types';
import { buildPools, type Pools } from './packs';
import { validateCards, validatePools } from './validate';

export const SETS = setsJson as SetInfo[];

export interface SetTheme {
  tagline: string;
  /** primary, secondary, glow */
  colors: [string, string, string];
}

export const THEMES: Record<string, SetTheme> = {
  OGN: { tagline: 'Where every legend begins', colors: ['#1d3b8f', '#d9a441', '#7fb2ff'] },
  SFD: { tagline: 'Bound by spirit, forged in battle', colors: ['#0f5a5c', '#7de0c4', '#5fffd7'] },
  UNL: { tagline: 'Let the beasts run wild', colors: ['#7a1f12', '#ff9a3c', '#ff6a3d'] },
  VEN: { tagline: 'Every blade remembers', colors: ['#3d0f2e', '#e0435d', '#ff4f7a'] },
  RAD: { tagline: 'Shine brighter than the rift', colors: ['#2e1a5e', '#ffd36b', '#ff8de1'] },
};

const loaders = import.meta.glob<{ default: unknown }>('../data/[A-Z]*.json');

export interface LoadedSet {
  info: SetInfo;
  cards: Card[];
  pools: Pools;
}

const cache = new Map<string, Promise<LoadedSet>>();

async function loadRaw(id: string): Promise<Card[]> {
  const loader = loaders[`../data/${id}.json`];
  if (!loader) throw new Error(`Unknown set ${id}`);
  return validateCards((await loader()).default, id);
}

export function loadSet(id: string): Promise<LoadedSet> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const info = SETS.find((s) => s.id === id);
      if (!info) throw new Error(`Unknown set ${id}`);
      const cards = await loadRaw(id);
      const fallbackRunes = cards.some((c) => c.tier === 'rune') ? [] : await loadRaw('OGN').then((c) => c.filter((x) => x.tier === 'rune' || x.tier === 'altRune'));
      const pools = buildPools(cards, fallbackRunes);
      validatePools(pools, id);
      return { info, cards, pools };
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Pick cover art for the pack wrappers: showcase champions first, then epics. */
export function coverCards(set: LoadedSet, n = 3): Card[] {
  const order: Tier[] = ['altArt', 'epic', 'rare'];
  const out: Card[] = [];
  for (const t of order) {
    for (const c of set.pools[t]) {
      if (out.length >= n) break;
      if (c.type === 'Unit' && !out.some((o) => o.name.split(/[,-]/)[0] === c.name.split(/[,-]/)[0])) out.push(c);
    }
  }
  return out;
}

/** Sized image URL for either image host the card data uses. */
export function IMG(url: string, w: number): string {
  if (url.includes('tcgplayer-cdn')) return `${url}_${w <= 200 ? '200w' : w <= 400 ? '400w' : 'in_1000x1000'}.jpg`;
  return `${url}?accountingTag=RB&w=${w}&fm=webp&q=85`;
}
