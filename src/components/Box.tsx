import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { vars } from '../lib/css';
import { BOX_TIERS, countTiers, expectedPerBox, formatExpected, percentileOf, simulateBoxValues } from '../lib/box';
import { PACKS_PER_BOX } from '../lib/packs';
import { boxPrice, money, packPrice } from '../lib/prices';
import { TIER_STYLE } from '../lib/rarity';
import { IMG, THEMES, type LoadedSet } from '../lib/sets';
import { centerOf, fx } from '../lib/fx';
import { sfx } from '../lib/sound';
import type { Card, PulledCard } from '../lib/types';
import { PackArt } from './PackArt';

const SIM_BOXES = 1000;

/* ------------------------------------------------------------------------- */

interface ReadyProps {
  set: LoadedSet;
  covers: Card[];
  onOpen: () => void;
}

/** The sealed box: tap it, the lid flies off, packs spill out, then results. */
export function BoxReady({ set, covers, onOpen }: ReadyProps) {
  const [opening, setOpening] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const theme = THEMES[set.info.id];
  const box = boxPrice(set.info.id);
  const perPack = box / PACKS_PER_BOX;
  const loose = packPrice(set.info.id);
  const saving = loose - perPack;

  const open = () => {
    if (opening) return;
    setOpening(true);
    sfx.tear();
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      const y = r.top + r.height * 0.18;
      fx.burst({ x: r.left + r.width / 2, y, count: 120, colors: [theme.colors[1], theme.colors[2], '#fff'], speed: 10, angle: -Math.PI / 2, spread: Math.PI * 0.8, gravity: 0.14, kind: 'star', size: 3 });
      fx.ring(r.left + r.width / 2, y, theme.colors[2], r.width * 1.2, 700, 6);
    }
    window.setTimeout(() => sfx.whoosh(), 250);
    window.setTimeout(onOpen, 1150);
  };

  return (
    <div className="box-stage">
      <motion.h2 className="prompt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: opening ? 0 : 1, y: 0 }}>
        Booster Box
      </motion.h2>
      <motion.button
        ref={ref}
        className={`booster-box ${opening ? 'opening' : ''}`}
        onClick={open}
        aria-label={`Open a ${set.info.name} booster box`}
        style={vars({ '--c0': theme.colors[0], '--c1': theme.colors[1], '--c2': theme.colors[2] })}
        initial={{ opacity: 0, y: 60, scale: 0.9 }}
        animate={opening ? { y: [0, -6, 6, 0], scale: 1, opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={opening ? { duration: 0.35 } : { type: 'spring', stiffness: 160, damping: 18 }}
        whileHover={opening ? undefined : { scale: 1.03, rotate: -1 }}
        whileTap={opening ? undefined : { scale: 0.98 }}
      >
        {/* Packs waiting inside; they rise out once the lid is off. */}
        <div className="box-packs" aria-hidden>
          {covers.slice(0, 3).map((c, i) => (
            <motion.div
              key={c.id}
              className="box-pack"
              initial={false}
              animate={opening ? { y: '-62%', rotate: (i - 1) * 14, x: `${(i - 1) * 46}%`, opacity: [1, 1, 0] } : { y: 0, rotate: 0, x: `${(i - 1) * 30}%`, opacity: 1 }}
              transition={opening ? { delay: 0.25 + i * 0.07, duration: 0.85, times: [0, 0.7, 1], ease: [0.2, 0.8, 0.3, 1] } : { duration: 0.2 }}
            >
              <PackArt set={set.info} cover={c} />
            </motion.div>
          ))}
        </div>
        <motion.div
          className="box-lid"
          animate={opening ? { y: -220, rotate: -14, x: 40, opacity: 0 } : { y: 0, rotate: 0, x: 0, opacity: 1 }}
          transition={{ duration: 0.75, ease: [0.2, 0.7, 0.3, 1] }}
        >
          <span className="box-lid-logo">RIFTBOUND</span>
        </motion.div>
        <div className="box-front">
          {covers[0] && <img src={IMG(covers[0].image, 600)} alt="" draggable={false} />}
          <div className="box-front-shade" />
          <div className="box-label">
            <span className="box-set">{set.info.name}</span>
            <span className="box-meta">Booster Display · {PACKS_PER_BOX} Packs</span>
          </div>
          <div className="pack-sheen" />
        </div>
      </motion.button>
      <motion.div className="box-price" animate={{ opacity: opening ? 0 : 1 }}>
        <b className="gold">{money(box)}</b> sealed · {money(perPack)} a pack
        <span className="muted">
          {' '}
          ({Math.abs(saving) < 0.005 ? 'same as' : saving > 0 ? `${money(saving)} less than` : `${money(-saving)} more than`} a loose pack)
        </span>
      </motion.div>
      <motion.p className="hint" animate={{ opacity: opening ? 0 : 0.8 }}>
        Tap the box to crack it open
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

interface ReportProps {
  set: LoadedSet;
  packs: PulledCard[][];
  value: number;
}

/** How this box stacked up: chase-tier counts vs. average, and a luck percentile. */
export function BoxReport({ set, packs, value }: ReportProps) {
  const setId = set.info.id;
  const counts = useMemo(() => countTiers(packs), [packs]);
  const expected = useMemo(() => expectedPerBox(set.pools), [set.pools]);
  const [sims, setSims] = useState<number[] | null>(null);
  const luckRef = useRef<HTMLDivElement>(null);

  // A thousand simulated boxes, off the critical path so the reveal stays smooth.
  useEffect(() => {
    const t = window.setTimeout(() => setSims(simulateBoxValues(setId, set.pools, SIM_BOXES)), 60);
    return () => window.clearTimeout(t);
  }, [setId, set.pools]);

  const pct = sims ? percentileOf(sims, value) : null;
  const median = sims ? sims[Math.floor(sims.length / 2)] : null;

  useEffect(() => {
    if (pct === null || pct < 0.9) return;
    const c = centerOf(luckRef.current);
    fx.burst({ x: c.x, y: c.y, count: 70, colors: ['#ffe066', '#fff3c8', '#ffffff'], speed: 8, kind: 'star', size: 3, gravity: 0.12 });
  }, [pct]);

  const tiers = BOX_TIERS.filter((t) => expected[t] > 0 || counts[t] > 0);
  const luckLabel = pct === null ? 'Comparing to 1,000 boxes…' : pct >= 0.5 ? `Luckier than ${Math.round(pct * 100)}% of boxes` : `Unluckier than ${Math.round((1 - pct) * 100)}% of boxes`;

  return (
    <motion.section className="box-report" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <h3 className="section-title">Box report</h3>
      <div className="box-luck" ref={luckRef}>
        <div className={`box-luck-label ${pct !== null && pct >= 0.5 ? 'good' : ''}`}>{luckLabel}</div>
        <div className="box-luck-track" role="meter" aria-label="Box value percentile" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct === null ? undefined : Math.round(pct * 100)}>
          <div className="box-luck-mid" />
          {pct !== null && <motion.div className="box-luck-dot" initial={{ left: '0%' }} animate={{ left: `${Math.min(98, Math.max(2, pct * 100))}%` }} transition={{ type: 'spring', stiffness: 90, damping: 16 }} />}
        </div>
        <div className="box-luck-scale">
          <span>Worst</span>
          <span>{median !== null ? `Typical box ${money(median)}` : ' '}</span>
          <span>Best</span>
        </div>
      </div>
      <div className="box-tiers" style={vars({ '--n': tiers.length })}>
        {tiers.map((t) => {
          const n = counts[t];
          const e = expected[t];
          const delta = n - e;
          const mood = e >= 0.5 ? (delta >= 1 ? 'up' : delta <= -1 ? 'down' : '') : n > 0 ? 'up' : '';
          return (
            <div key={t} className={`box-tier ${mood}`} style={vars({ '--tier': TIER_STYLE[t].color })}>
              <span className="box-tier-n">{n}</span>
              <span className="box-tier-name">{TIER_STYLE[t].label}</span>
              <span className="box-tier-exp">
                {mood === 'up' ? '▲ ' : mood === 'down' ? '▼ ' : ''}
                {formatExpected(e)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="hint box-note">Each pack is rolled independently at the published pull rates; real boxes may be collated more evenly.</p>
    </motion.section>
  );
}
