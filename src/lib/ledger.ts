import type { PulledCard, Tier } from './types';
import { packPrice, pullPrice, PRICES, type PriceBook } from './prices';
import { TIER_RANK } from './packs';

/** One opened pack, priced at the moment it was opened. */
export interface LedgerEntry {
  t: number;
  set: string;
  cost: number;
  value: number;
  best: { id: string; value: number; tier: Tier };
}

export const LEDGER_CAP = 10_000;

export function priceOf(setId: string, pack: PulledCard[], book: PriceBook = PRICES) {
  const values = pack.map((p) => pullPrice(setId, p, book));
  const value = round2(values.reduce((a, b) => a + b, 0));
  const cost = packPrice(setId, book);
  let bi = 0;
  values.forEach((v, i) => {
    if (v > values[bi] || (v === values[bi] && TIER_RANK[pack[i].card.tier] > TIER_RANK[pack[bi].card.tier])) bi = i;
  });
  return {
    values,
    value,
    cost,
    profit: round2(value - cost),
    roi: cost > 0 ? (value - cost) / cost : 0,
    best: { id: pack[bi].card.id, value: values[bi], tier: pack[bi].card.tier },
  };
}

export function entryFor(setId: string, pack: PulledCard[], t = Date.now(), book: PriceBook = PRICES): LedgerEntry {
  const { value, cost, best } = priceOf(setId, pack, book);
  return { t, set: setId, cost, value, best };
}

export function appendEntry(ledger: LedgerEntry[], e: LedgerEntry): LedgerEntry[] {
  const next = [...ledger, e];
  return next.length > LEDGER_CAP ? next.slice(next.length - LEDGER_CAP) : next;
}

export interface Stats {
  packs: number;
  spent: number;
  value: number;
  net: number;
  roi: number;
  /** Share of packs worth at least what they cost. */
  winRate: number;
  avgValue: number;
  bestPack: LedgerEntry | null;
  biggestHit: (LedgerEntry['best'] & { set: string; t: number }) | null;
  /** Running net after each pack. */
  cumulative: { i: number; net: number; entry: LedgerEntry }[];
  bySet: { set: string; packs: number; spent: number; value: number; net: number; roi: number }[];
  /** Longest run of consecutive profitable packs, and the current run. */
  bestStreak: number;
  streak: number;
}

export function computeStats(ledger: LedgerEntry[], set?: string): Stats {
  const entries = set ? ledger.filter((e) => e.set === set) : ledger;
  let spent = 0;
  let value = 0;
  let wins = 0;
  let bestPack: LedgerEntry | null = null;
  let biggestHit: Stats['biggestHit'] = null;
  let streak = 0;
  let bestStreak = 0;
  const cumulative: Stats['cumulative'] = [];
  const bySet = new Map<string, { packs: number; spent: number; value: number }>();

  entries.forEach((e, i) => {
    spent += e.cost;
    value += e.value;
    const won = e.value >= e.cost;
    if (won) wins++;
    streak = won ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
    if (!bestPack || e.value - e.cost > bestPack.value - bestPack.cost) bestPack = e;
    if (!biggestHit || e.best.value > biggestHit.value) biggestHit = { ...e.best, set: e.set, t: e.t };
    cumulative.push({ i: i + 1, net: round2(value - spent), entry: e });
    const s = bySet.get(e.set) ?? { packs: 0, spent: 0, value: 0 };
    s.packs++;
    s.spent += e.cost;
    s.value += e.value;
    bySet.set(e.set, s);
  });

  const n = entries.length;
  return {
    packs: n,
    spent: round2(spent),
    value: round2(value),
    net: round2(value - spent),
    roi: spent > 0 ? (value - spent) / spent : 0,
    winRate: n ? wins / n : 0,
    avgValue: n ? round2(value / n) : 0,
    bestPack,
    biggestHit,
    cumulative,
    bySet: [...bySet.entries()].map(([s, v]) => ({
      set: s,
      packs: v.packs,
      spent: round2(v.spent),
      value: round2(v.value),
      net: round2(v.value - v.spent),
      roi: v.spent > 0 ? (v.value - v.spent) / v.spent : 0,
    })),
    bestStreak,
    streak,
  };
}

/** Bucket pack values into `bins` equal-width bins from 0 to the max value. */
export function histogram(values: number[], bins = 12): { from: number; to: number; count: number }[] {
  if (!values.length) return [];
  const max = Math.max(...values, 1);
  const width = niceStep(max / bins);
  const n = Math.max(1, Math.ceil(max / width));
  const out = Array.from({ length: n }, (_, i) => ({ from: i * width, to: (i + 1) * width, count: 0 }));
  for (const v of values) out[Math.min(n - 1, Math.floor(v / width))].count++;
  return out;
}

function niceStep(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 0.01))));
  const m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** Parse untrusted stored JSON into ledger entries, dropping anything malformed. */
export function parseLedger(raw: string | null): LedgerEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    return v
      .filter(
        (e) =>
          e &&
          typeof e === 'object' &&
          ok(e.t) &&
          typeof e.set === 'string' &&
          ok(e.cost) &&
          ok(e.value) &&
          e.best &&
          typeof e.best.id === 'string' &&
          ok(e.best.value) &&
          e.best.tier in TIER_RANK,
      )
      .slice(-LEDGER_CAP) as LedgerEntry[];
  } catch {
    return [];
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
