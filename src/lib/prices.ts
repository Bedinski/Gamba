import pricesJson from '../data/prices.json';
import type { PulledCard } from './types';

/** [normal market, foil market, TCGplayer productId] */
export type PriceRow = [number | null, number | null, number];

export interface SetPrices {
  pack: number | null;
  packProductId: number | null;
  cards: Record<string, PriceRow>;
}

export interface PriceBook {
  updatedAt: string;
  source: string;
  sets: Record<string, SetPrices>;
}

/** Used when a set has no sealed-pack market price (roughly MSRP). */
export const FALLBACK_PACK_PRICE = 4.99;

export function validatePriceBook(raw: unknown): PriceBook {
  const book = raw as Partial<PriceBook>;
  if (!book || typeof book !== 'object' || typeof book.sets !== 'object' || book.sets === null) {
    return { updatedAt: '', source: '', sets: {} };
  }
  const sets: PriceBook['sets'] = {};
  for (const [id, s] of Object.entries(book.sets)) {
    if (!s || typeof s !== 'object') continue;
    const cards: SetPrices['cards'] = {};
    for (const [cid, row] of Object.entries(s.cards ?? {})) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
      cards[cid] = [num(row[0]), num(row[1]), Number(row[2]) || 0];
    }
    sets[id] = { pack: typeof s.pack === 'number' && s.pack > 0 ? s.pack : null, packProductId: s.packProductId ?? null, cards };
  }
  return { updatedAt: String(book.updatedAt ?? ''), source: String(book.source ?? ''), sets };
}

export const PRICES = validatePriceBook(pricesJson);

export function packPrice(setId: string, book: PriceBook = PRICES): number {
  return book.sets[setId]?.pack ?? FALLBACK_PACK_PRICE;
}

/** Market value of one card; foils use the foil price when there is one. */
export function cardPrice(setId: string, cardId: string, foil: boolean, book: PriceBook = PRICES): number {
  const row = book.sets[setId]?.cards[cardId];
  if (!row) return 0;
  const [normal, foilPrice] = row;
  return (foil ? (foilPrice ?? normal) : (normal ?? foilPrice)) ?? 0;
}

export function pullPrice(setId: string, p: PulledCard, book: PriceBook = PRICES): number {
  return cardPrice(setId, p.card.id, p.foil, book);
}

export function tcgplayerUrl(setId: string, cardId: string, book: PriceBook = PRICES): string | null {
  const pid = book.sets[setId]?.cards[cardId]?.[2];
  return pid ? `https://www.tcgplayer.com/product/${pid}` : null;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function money(n: number, compact = false): string {
  return compact && Math.abs(n) >= 1000 ? usdCompact.format(n) : usd.format(n);
}

/** "+$1.23" / "−$1.23" — sign always shown so profit never relies on color alone. */
export function signedMoney(n: number): string {
  const s = usd.format(Math.abs(n));
  return n > 0.004 ? `+${s}` : n < -0.004 ? `−${s}` : s;
}

export function signedPct(r: number): string {
  const v = Math.round(r * 1000) / 10;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
}
