import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { rankOf, TIER_RANK } from '../lib/packs';
import { priceOf } from '../lib/ledger';
import { money } from '../lib/prices';
import { TIER_STYLE } from '../lib/rarity';
import { JACKPOT_VALUE, HIT_VALUE } from '../lib/hype';
import { centerOf, fx } from '../lib/fx';
import { sfx } from '../lib/sound';
import { vars } from '../lib/css';
import type { PulledCard } from '../lib/types';
import { CardView } from './CardView';
import { PriceTag, ProfitHero } from './Money';

const GOLD = ['#ffe066', '#ffd27a', '#fff3c8', '#ffffff'];

/** Celebrate (or commiserate) once the hero's count-up finishes. */
function useOutcomeFx(heroRef: React.RefObject<HTMLDivElement>, net: number, best: number, delayMs: number) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const c = centerOf(heroRef.current);
      if (best >= JACKPOT_VALUE) sfx.jackpot();
      if (net >= 0) {
        sfx.profit();
        fx.burst({ x: c.x, y: c.y, count: 160, colors: GOLD, speed: 14, life: 1600, size: 3.5, kind: 'star', gravity: 0.18, spread: Math.PI, angle: -Math.PI / 2 });
        fx.ring(c.x, c.y, '#34d37a', 380, 800, 6);
      } else {
        sfx.miss();
      }
    }, delayMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

interface SummaryProps {
  setId: string;
  pack: PulledCard[];
  newIds: Set<string>;
  onInspect: (p: PulledCard) => void;
}

export function Summary({ setId, pack, newIds, onInspect }: SummaryProps) {
  const priced = useMemo(() => priceOf(setId, pack), [setId, pack]);
  const heroRef = useRef<HTMLDivElement>(null);
  const topIdx = useMemo(() => new Set(priced.values.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).filter(([v]) => v >= 1).map(([, i]) => i)), [priced]);
  useOutcomeFx(heroRef, priced.profit, priced.best.value, 1450);

  return (
    <div className="summary-wrap">
      <motion.h2 className="prompt" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        Pack Results
      </motion.h2>
      <div ref={heroRef}>
        <ProfitHero value={priced.value} cost={priced.cost} />
      </div>
      <motion.p className="hint" initial={{ opacity: 0 }} animate={{ opacity: 0.85 }}>
        Top card: <b style={{ color: TIER_STYLE[priced.best.tier].color }}>{pack.find((p) => p.card.id === priced.best.id)?.card.name}</b> · {money(priced.best.value)} · {newIds.size} new
      </motion.p>
      <div className="summary-grid">
        {pack.map((p, i) => (
          <motion.button
            key={i}
            className={`summary-card r${rankOf(p)} ${topIdx.has(i) ? 'top-value' : ''}`}
            initial={{ opacity: 0, y: 30, rotateY: 90 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -8, scale: 1.05, zIndex: 3 }}
            onClick={() => onInspect(p)}
            style={vars({ '--tier': TIER_STYLE[p.card.tier].color })}
          >
            <CardView card={p.card} foil={p.foil} res={300} shimmer={rankOf(p) >= TIER_RANK.epic || priced.values[i] >= HIT_VALUE} />
            {newIds.has(p.card.id) && <span className="badge-new">NEW</span>}
            <PriceTag value={priced.values[i]} className="on-card" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

interface BulkProps {
  setId: string;
  packs: PulledCard[][];
  newIds: Set<string>;
  onInspect: (p: PulledCard) => void;
  title?: string;
  /** Per-pack cost when it isn't the loose-pack price (box breaks). */
  packCost?: number;
  /** Box break: 24 slimmer bars, faster pacing, and `report` once every pack is in. */
  box?: boolean;
  report?: ReactNode;
}

const BULK_STEP_MS = 260;
const BOX_STEP_MS = 150;

/** "$5" / "$123" — whole dollars so 24 labels fit under a box's bars. */
const wholeDollars = (v: number) => (v >= 1000 ? money(v, true) : `$${Math.round(v)}`);

export function BulkResults({ setId, packs, newIds, onInspect, title, packCost, box, report }: BulkProps) {
  const priced = useMemo(() => packs.map((p) => priceOf(setId, p, undefined, packCost)), [setId, packs, packCost]);
  const total = priced.reduce((a, p) => a + p.value, 0);
  const cost = priced.reduce((a, p) => a + p.cost, 0);
  const [shown, setShown] = useState(0);
  // Scale to the packs revealed so far, so the chart never hints at a hit that hasn't landed yet.
  const maxPack = Math.max(priced[0]?.cost ?? 1, ...priced.slice(0, shown).map((p) => p.value));
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const done = shown >= packs.length;

  const hits = useMemo(
    () =>
      packs
        .flatMap((pack, pi) => pack.map((p, ci) => ({ p, v: priced[pi].values[ci], key: `${pi}-${ci}` })))
        .filter((h) => h.v >= 0.5 || TIER_RANK[h.p.card.tier] >= TIER_RANK.epic)
        .sort((a, b) => b.v - a.v)
        .slice(0, box ? 21 : 14),
    [packs, priced, box],
  );

  // Pop each pack's bar in sequence.
  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => {
      const p = priced[shown];
      const c = centerOf(barRefs.current[shown]);
      if (p.value >= p.cost) {
        sfx.coin();
        fx.burst({ x: c.x, y: c.y, count: 40, colors: GOLD, speed: 8, kind: 'star', size: 2.5, gravity: 0.12 });
      } else {
        sfx.tap();
      }
      if (p.best.value >= JACKPOT_VALUE) fx.ring(c.x, c.y, '#ffe066', 220, 700, 5);
      setShown((s) => s + 1);
    }, shown === 0 ? 400 : box ? BOX_STEP_MS : BULK_STEP_MS);
    return () => window.clearTimeout(t);
  }, [shown, done, priced, box]);

  const best = hits[0];

  return (
    <div className="summary-wrap bulk">
      <motion.h2 className="prompt" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        {title ?? `${packs.length} Pack Rip`}
      </motion.h2>

      <div className={`bulk-bars ${box ? 'box' : ''}`} role="list" aria-label="Value of each pack">
        {priced.map((p, i) => {
          const win = p.value >= p.cost;
          return (
            <div key={i} className="bulk-col" role="listitem" aria-label={`Pack ${i + 1}: ${money(p.value)}`}>
              <div className="bulk-bar-area">
                {done && <motion.div className="bulk-cost-line" style={{ bottom: `${(p.cost / maxPack) * 100}%` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} />}
                <motion.div
                  ref={(el) => (barRefs.current[i] = el)}
                  className={`bulk-bar ${win ? 'win' : ''}`}
                  initial={{ height: 0 }}
                  animate={{ height: i < shown ? `${Math.max(2, (p.value / maxPack) * 100)}%` : 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                />
              </div>
              <span className={`bulk-val ${i < shown ? 'on' : ''} ${win ? 'good' : ''}`}>{i < shown ? (box ? wholeDollars(p.value) : money(p.value, true)) : '·'}</span>
            </div>
          );
        })}
      </div>

      {done && (
        <>
          <div ref={heroRef}>
            <BulkOutcome total={total} cost={cost} best={best?.v ?? 0} heroRef={heroRef} />
          </div>
          <motion.p className="hint" initial={{ opacity: 0 }} animate={{ opacity: 0.85 }}>
            {priced.filter((p) => p.value >= p.cost).length} of {packs.length} packs paid for themselves · {newIds.size} new cards
          </motion.p>
          {report}
          <h3 className="section-title">Top pulls</h3>
          <div className="summary-grid">
            {hits.map((h, i) => (
              <motion.button
                key={h.key}
                className={`summary-card r${rankOf(h.p)} ${i < 3 ? 'top-value' : ''}`}
                initial={{ opacity: 0, y: 30, rotateY: 90 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                transition={{ delay: 0.3 + 0.06 * i, type: 'spring', stiffness: 200, damping: 20 }}
                whileHover={{ y: -8, scale: 1.05, zIndex: 3 }}
                onClick={() => onInspect(h.p)}
                style={vars({ '--tier': TIER_STYLE[h.p.card.tier].color })}
              >
                <CardView card={h.p.card} foil={h.p.foil} res={300} shimmer={h.v >= HIT_VALUE} />
                {newIds.has(h.p.card.id) && <span className="badge-new">NEW</span>}
                <PriceTag value={h.v} className="on-card" />
              </motion.button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BulkOutcome({ total, cost, best, heroRef }: { total: number; cost: number; best: number; heroRef: React.RefObject<HTMLDivElement> }) {
  useOutcomeFx(heroRef, total - cost, best, 1450);
  return <ProfitHero value={total} cost={cost} label="Total value" />;
}
