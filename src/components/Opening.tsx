import { vars } from '../lib/css';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { bestRank, openPack, rankOf, TIER_RANK } from '../lib/packs';
import { coverCards, IMG, THEMES, type LoadedSet } from '../lib/sets';
import type { PulledCard, Tier } from '../lib/types';
import { newCardIds, type Collection } from '../lib/collection';
import { burstColors, FLIP_RANK, SHOWCASE_RANK, TIER_STYLE } from '../lib/rarity';
import { centerOf, fx } from '../lib/fx';
import { sfx } from '../lib/sound';
import { CardBack, CardView } from './CardView';
import { PackArt } from './PackArt';
import { boxPrice, packPrice, pullPrice, money } from '../lib/prices';
import { boxPackCost, boxValue } from '../lib/box';
import { PACKS_PER_BOX } from '../lib/packs';
import { BIG_HIT_VALUE, HIT_VALUE, JACKPOT_VALUE } from '../lib/hype';
import { PriceTag, ValueMeter } from './Money';
import { BulkResults, Summary } from './Results';
import { BoxReady, BoxReport } from './Box';

const FLING = {
  // pointerEvents: a card flying away must not swallow quick taps meant for the next one.
  exit: (d: number) => ({ x: d * 700, y: -120, rotate: d * 28, opacity: 0, pointerEvents: 'none' as const, transition: { duration: 0.42, ease: [0.3, 0, 0.6, 1] } }),
};

type Phase = 'choose' | 'ready' | 'tearing' | 'reveal' | 'summary' | 'bulk' | 'boxReady' | 'box';

export const BULK_COUNT = 10;
const GOLD = ['#ffe066', '#ffd27a', '#fff3c8', '#ffffff'];

interface Props {
  set: LoadedSet;
  collection: Collection;
  onRecord: (setId: string, pack: PulledCard[], cost?: number) => void;
  onExit: () => void;
  onCollection: () => void;
  onStats: () => void;
  onInspect: (p: PulledCard) => void;
}

/** Roll a pack. In dev, `?force=<tier>` swaps the last card for one of that tier (for testing VFX). */
function roll(set: LoadedSet): PulledCard[] {
  const pack = openPack(set.pools);
  const force = import.meta.env.DEV ? (new URLSearchParams(location.search).get('force') as Tier | null) : null;
  const pool = force ? set.pools[force] : undefined;
  if (pool?.length) pack[pack.length - 1] = { card: pool[Math.floor(Math.random() * pool.length)], foil: true, slot: 'rare' };
  return pack;
}

function tierOfBest(pack: PulledCard[]): Tier {
  return pack.reduce((best, p) => (rankOf(p) > TIER_RANK[best] ? p.card.tier : best), pack[0].card.tier);
}

export function Opening({ set, collection, onRecord, onExit, onCollection, onStats, onInspect }: Props) {
  const [pack, setPack] = useState<PulledCard[]>(() => roll(set));
  const [bulk, setBulk] = useState<PulledCard[][]>([]);
  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState<Phase>('choose');
  const [chosen, setChosen] = useState(0);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState(0);
  const [shake, setShake] = useState(0);
  const covers = useMemo(() => coverCards(set, 3), [set]);
  const theme = THEMES[set.info.id];

  useEffect(() => {
    for (const p of pack) {
      for (const url of [p.card.image, ...(p.card.fallbackImages ?? []).slice(0, 1)]) {
        const img = new Image();
        img.src = IMG(url, 500);
      }
    }
  }, [pack]);

  useEffect(() => {
    fx.setAmbient(theme.colors[2], 0.5);
  }, [theme]);

  const best = tierOfBest(pack);
  const aura = bestRank(pack) >= TIER_RANK.epic ? TIER_STYLE[best].color : theme.colors[2];

  const tear = useCallback(
    (el: HTMLElement | null) => {
      setNewIds(newCardIds(collection, set.info.id, pack));
      onRecord(set.info.id, pack);
      sfx.tear();
      const r = el?.getBoundingClientRect();
      if (r) {
        const y = r.top + r.height * TEAR_Y;
        for (let i = 0; i <= 8; i++) {
          fx.burst({ x: r.left + (r.width * i) / 8, y, count: 14, colors: [theme.colors[1], theme.colors[2], '#fff'], speed: 7, angle: -Math.PI / 2, spread: Math.PI * 0.9, gravity: 0.12 });
        }
        fx.ring(r.left + r.width / 2, y, theme.colors[2], r.width, 600, 5);
      }
      setFlash((f) => f + 1);
      setShake((s) => s + 1);
      setPhase('tearing');
      window.setTimeout(() => setPhase('reveal'), 850);
    },
    [collection, onRecord, pack, set.info.id, theme],
  );

  const again = () => {
    setPack(roll(set));
    setPhase('choose');
  };

  const ripBulk = () => {
    const packs = Array.from({ length: BULK_COUNT }, () => roll(set));
    setNewIds(newCardIds(collection, set.info.id, packs.flat()));
    for (const p of packs) onRecord(set.info.id, p);
    sfx.tear();
    window.setTimeout(() => sfx.tear(), 120);
    setFlash((f) => f + 1);
    setShake((s) => s + 1);
    setBulk(packs);
    setRunId((n) => n + 1);
    setPhase('bulk');
  };

  const breakBox = () => {
    const packs = Array.from({ length: PACKS_PER_BOX }, () => roll(set));
    const perPack = boxPackCost(set.info.id);
    setNewIds(newCardIds(collection, set.info.id, packs.flat()));
    for (const p of packs) onRecord(set.info.id, p, perPack);
    setFlash((f) => f + 1);
    setShake((s) => s + 1);
    setBulk(packs);
    setRunId((n) => n + 1);
    setPhase('box');
  };

  const cost = packPrice(set.info.id);
  const boxCost = boxPrice(set.info.id);
  const actions = (
    <motion.div className="actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 1.6 } }}>
      {phase === 'box' ? (
        <>
          <button className="primary" onClick={() => setPhase('boxReady')}>
            📦 Break Another Box
          </button>
          <button className="secondary" onClick={again}>
            Open a Pack
          </button>
        </>
      ) : (
        <button className="primary" onClick={again}>
          Open Another
        </button>
      )}
      <button className="secondary bolt" onClick={ripBulk}>
        ⚡ Rip {BULK_COUNT} · {money(cost * BULK_COUNT)}
      </button>
      {phase !== 'box' && (
        <button className="secondary box-btn" onClick={() => setPhase('boxReady')}>
          📦 Box · {money(boxCost)}
        </button>
      )}
    </motion.div>
  );

  return (
    <div className={`stage ${shake ? 'shake-' + (shake % 2) : ''}`}>
      <header className="topbar">
        <button className="ghost" onClick={onExit}>
          ← Sets
        </button>
        <div className="topbar-title">
          <span>{set.info.name}</span>
        </div>
        <div className="topbar-actions">
          <button className="ghost" onClick={onStats}>
            Stats
          </button>
          <button className="ghost" onClick={onCollection}>
            Collection
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {phase === 'choose' && (
          <motion.div key="choose" className="choose" exit={{ opacity: 0, transition: { duration: 0.25 } }}>
            <motion.h2 className="prompt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              Choose a pack
            </motion.h2>
            <div className="fan">
              {covers.map((c, i) => (
                <motion.button
                  key={c.id}
                  className="fan-pack"
                  initial={{ opacity: 0, y: 80, rotate: 0 }}
                  animate={{ opacity: 1, y: [0, -8, 0], rotate: (i - 1) * 8, x: (i - 1) * 12 }}
                  transition={{ opacity: { delay: i * 0.08 }, y: { duration: 3, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }, rotate: { type: 'spring', delay: i * 0.08 } }}
                  whileHover={{ scale: 1.06, rotate: 0, zIndex: 5 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    sfx.whoosh();
                    setChosen(i);
                    setPhase('ready');
                  }}
                  aria-label={`Open pack ${i + 1}`}
                >
                  <motion.div layoutId={`pack-${i}`}>
                    <PackArt set={set.info} cover={c} />
                  </motion.div>
                </motion.button>
              ))}
            </div>
            <p className="hint">
              7 Commons · 3 Uncommons · 1 Foil · 2 Rare or better · 1 Rune · <b className="gold">{money(cost)}</b> per pack
            </p>
            <div className="choose-bulk">
              <button className="secondary bolt" onClick={ripBulk}>
                ⚡ Rip {BULK_COUNT} packs · {money(cost * BULK_COUNT)}
              </button>
              <button className="secondary box-btn" onClick={() => setPhase('boxReady')}>
                📦 Break a box · {money(boxCost)}
              </button>
            </div>
          </motion.div>
        )}

        {(phase === 'ready' || phase === 'tearing') && (
          <motion.div key="ready" className="ready" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
            <TearablePack set={set} cover={covers[chosen]} layoutId={`pack-${chosen}`} aura={aura} torn={phase === 'tearing'} onTear={tear} />
          </motion.div>
        )}

        {phase === 'reveal' && (
          <motion.div key="reveal" className="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RevealStack setId={set.info.id} pack={pack} newIds={newIds} onDone={() => setPhase('summary')} onShake={() => setShake((s) => s + 1)} onFlash={() => setFlash((f) => f + 1)} />
          </motion.div>
        )}

        {phase === 'summary' && (
          <motion.div key="summary" className="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Summary setId={set.info.id} pack={pack} newIds={newIds} onInspect={onInspect} />
            {actions}
          </motion.div>
        )}

        {phase === 'bulk' && (
          <motion.div key={`bulk-${runId}`} className="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BulkResults setId={set.info.id} packs={bulk} newIds={newIds} onInspect={onInspect} />
            {actions}
          </motion.div>
        )}

        {phase === 'boxReady' && (
          <motion.div key="boxReady" className="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
            <BoxReady set={set} covers={covers} onOpen={breakBox} />
          </motion.div>
        )}

        {phase === 'box' && (
          <motion.div key={`box-${runId}`} className="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BulkResults
              setId={set.info.id}
              packs={bulk}
              newIds={newIds}
              onInspect={onInspect}
              title="Box Break"
              packCost={boxPackCost(set.info.id)}
              box
              report={<BoxReport set={set} packs={bulk} value={boxValue(set.info.id, bulk)} />}
            />
            {actions}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flash > 0 && <motion.div key={flash} className="flash" initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }} />}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

interface TearProps {
  set: LoadedSet;
  cover: PulledCard['card'] | undefined;
  layoutId: string;
  aura: string;
  torn: boolean;
  onTear: (el: HTMLElement | null) => void;
}

const TEAR_Y = 0.09;
const TEAR_NEEDED = 0.7;

function TearablePack({ set, cover, layoutId, aura, torn, onTear }: TearProps) {
  const ref = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ min: number; max: number; active: boolean; lastSound: number }>({ min: 0, max: 0, active: false, lastSound: 0 });
  const [cut, setCut] = useState<{ min: number; max: number } | null>(null);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setCut({ min: 0, max: 1 });
    onTear(ref.current);
  }, [onTear]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const rel = (e: RPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), r };
  };

  const down = (e: RPointerEvent) => {
    if (done.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const { x } = rel(e);
    drag.current = { min: x, max: x, active: true, lastSound: 0 };
    setCut({ min: x, max: x });
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current;
    const { x, r } = rel(e);
    const py = (e.clientY - r.top) / r.height;
    floatRef.current?.style.setProperty('--rx', `${(0.5 - py) * (d.active ? 4 : 14)}deg`);
    floatRef.current?.style.setProperty('--ry', `${(x - 0.5) * (d.active ? 4 : 18)}deg`);
    floatRef.current?.style.setProperty('--px', `${x * 100}%`);
    floatRef.current?.style.setProperty('--py', `${py * 100}%`);
    if (!d.active || done.current) return;
    d.min = Math.min(d.min, x);
    d.max = Math.max(d.max, x);
    setCut({ min: d.min, max: d.max });
    fx.trail(e.clientX, r.top + r.height * TEAR_Y, aura);
    const now = performance.now();
    if (now - d.lastSound > 55) {
      d.lastSound = now;
      sfx.scratch();
    }
    if (d.max - d.min >= TEAR_NEEDED) finish();
  };
  const up = () => {
    drag.current.active = false;
    if (!done.current) setCut(null);
  };
  const leave = () => {
    floatRef.current?.style.setProperty('--rx', '0deg');
    floatRef.current?.style.setProperty('--ry', '0deg');
  };

  return (
    <div className="tear-wrap">
      <motion.div className="prompt" animate={{ opacity: torn ? 0 : 1 }}>
        Swipe across the top to open
      </motion.div>
      <motion.div layoutId={layoutId} className="tear-pack" ref={ref} transition={{ type: 'spring', stiffness: 160, damping: 22 }}>
        <div className="pack-aura" style={vars({ '--aura': aura })} />
        <div className={`tear-float ${torn ? '' : 'floating'}`} ref={floatRef}>
          {torn && <motion.div className="tear-rays" style={vars({ '--aura': aura })} initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: [0, 1, 0], scale: [0.3, 1.3, 1.7] }} transition={{ duration: 1.1 }} />}
          {/* body that drops away after the burst */}
          <motion.div
            className="tear-part bottom"
            animate={torn ? { y: [0, -6, 4, 0, 560], opacity: [1, 1, 1, 1, 0] } : { y: 0, opacity: 1 }}
            transition={torn ? { duration: 1.05, times: [0, 0.1, 0.2, 0.45, 1], ease: 'easeIn' } : { duration: 0.2 }}
          >
            <PackArt set={set.info} cover={cover} aura={aura} />
          </motion.div>
          {/* top strip that rips away */}
          <motion.div
            className="tear-part top"
            animate={torn ? { y: -160, x: 90, rotate: -18, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.85, ease: [0.2, 0.7, 0.3, 1] }}
          >
            <PackArt set={set.info} cover={cover} aura={aura} />
          </motion.div>
        </div>
        {!torn && (
          <>
            <div className="tear-line" style={{ top: `${TEAR_Y * 100}%` }}>
              <span className="tear-hint" />
            </div>
            {cut && <div className="tear-cut" style={{ top: `${TEAR_Y * 100}%`, left: `${cut.min * 100}%`, width: `${(cut.max - cut.min) * 100}%` }} />}
            <div className="tear-hit" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={leave} />
          </>
        )}
      </motion.div>
      <motion.p className="hint keyboard-hint" animate={{ opacity: torn ? 0 : 0.7 }}>
        or press Space
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

interface RevealProps {
  setId: string;
  pack: PulledCard[];
  newIds: Set<string>;
  onDone: () => void;
  onShake: () => void;
  onFlash: () => void;
}

function RevealStack({ setId, pack, newIds, onDone, onShake, onFlash }: RevealProps) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [charging, setCharging] = useState(false);
  const [showcase, setShowcase] = useState<{ tier: Tier; key: number; value: number } | null>(null);
  const [profitPop, setProfitPop] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const crossed = useRef(false);
  const celebrating = useRef(false);

  const values = useMemo(() => pack.map((p) => pullPrice(setId, p)), [setId, pack]);
  const cost = packPrice(setId);
  const cur = pack[idx];
  // Rare-by-tier OR rare-by-price cards arrive face down.
  const needsFlip = (i: number) => (rankOf(pack[i]) >= FLIP_RANK || values[i] >= BIG_HIT_VALUE) && !flipped.has(i);
  const isShowcase = (i: number) => rankOf(pack[i]) >= SHOWCASE_RANK || values[i] >= JACKPOT_VALUE;
  const revealed = values.slice(0, idx).reduce((a, b) => a + b, 0) + (cur && !needsFlip(idx) ? values[idx] : 0);

  // Crossing into profit is its own moment.
  useEffect(() => {
    if (crossed.current || revealed < cost || revealed === 0) return;
    crossed.current = true;
    const t = window.setTimeout(() => {
      const c = centerOf(meterRef.current);
      sfx.profit();
      fx.burst({ x: c.x, y: c.y, count: 90, colors: ['#34d37a', '#b9ffd6', ...GOLD], speed: 10, kind: 'star', size: 3, gravity: 0.15, life: 1400 });
      fx.ring(c.x, c.y, '#34d37a', 300, 700, 5);
      if (!celebrating.current) setProfitPop((n) => n + 1);
    }, 450);
    return () => window.clearTimeout(t);
  }, [revealed, cost]);

  const coinFx = (v: number) => {
    const c = centerOf(topRef.current);
    sfx.coin();
    fx.burst({ x: c.x, y: c.y - 40, count: v >= BIG_HIT_VALUE ? 90 : 45, colors: GOLD, speed: v >= BIG_HIT_VALUE ? 12 : 8, kind: 'star', size: 3, gravity: 0.2, spread: Math.PI * 1.2, angle: -Math.PI / 2, life: 1300 });
  };

  // Card arrival effects
  useEffect(() => {
    if (!cur) return;
    const rank = rankOf(cur);
    const t = window.setTimeout(() => {
      const c = centerOf(topRef.current);
      if (needsFlip(idx)) {
        const color = rank >= FLIP_RANK ? TIER_STYLE[cur.card.tier].color : '#ffe066';
        fx.converge('charge', c.x, c.y, color, isShowcase(idx) ? 4 : 2.5, 280);
      } else {
        if (rank >= TIER_RANK.rare || cur.foil) {
          sfx.reveal(rank);
          fx.burst({ x: c.x, y: c.y, count: rank >= TIER_RANK.rare ? 50 : 22, colors: burstColors(cur.card.tier), speed: 7, kind: 'star', size: 2.5, gravity: 0.04 });
        }
        if (values[idx] >= HIT_VALUE) window.setTimeout(() => coinFx(values[idx]), 120);
      }
    }, 180);
    return () => {
      window.clearTimeout(t);
      fx.stopConverge('charge');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (idx >= pack.length) onDone();
  }, [idx, pack.length, onDone]);

  const lastAdvance = useRef(0);
  const dragged = useRef(false);
  const advance = (d: number) => {
    const now = performance.now();
    if (busy.current || now - lastAdvance.current < 180) return;
    lastAdvance.current = now;
    setDir(d);
    sfx.whoosh();
    setIdx((i) => i + 1);
  };

  const flip = () => {
    if (busy.current) return;
    busy.current = true;
    setCharging(true);
    sfx.charge();
    const tier = cur.card.tier;
    const rank = rankOf(cur);
    const value = values[idx];
    const big = isShowcase(idx);
    window.setTimeout(() => {
      fx.stopConverge('charge');
      setCharging(false);
      setFlipped((f) => new Set(f).add(idx));
      const c = centerOf(topRef.current);
      sfx.reveal(rank);
      fx.burst({ x: c.x, y: c.y, count: big ? 220 : 120, colors: burstColors(tier), speed: big ? 16 : 11, life: 1400, size: 3.5, kind: 'spark', gravity: 0.1 });
      fx.burst({ x: c.x, y: c.y, count: 40, colors: burstColors(tier), speed: 5, life: 1800, kind: 'star', size: 3, gravity: 0.02 });
      fx.ring(c.x, c.y, TIER_STYLE[tier].color, 420, 800, 8);
      if (value >= HIT_VALUE) window.setTimeout(() => coinFx(value), 200);
      if (big) {
        if (value >= JACKPOT_VALUE) window.setTimeout(() => sfx.jackpot(), 150);
        window.setTimeout(() => fx.ring(c.x, c.y, '#ffffff', 600, 1000, 4), 140);
        celebrating.current = true;
        setShowcase({ tier, key: idx, value });
        onShake();
        onFlash();
        window.setTimeout(() => {
          celebrating.current = false;
          setShowcase(null);
        }, 2200);
      }
      window.setTimeout(() => (busy.current = false), 450);
    }, 650);
  };

  const onTap = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (!cur) return;
    if (needsFlip(idx)) flip();
    else advance(1);
  };

  const skip = () => {
    fx.stopConverge('charge');
    onDone();
  };

  const visible = pack.slice(idx, idx + 4);

  return (
    <div className={`reveal-wrap ${showcase ? "celebrating" : ""}`}>
      <div className="reveal-top">
        <span className="counter">
          {Math.min(idx + 1, pack.length)} <small>/ {pack.length}</small>
        </span>
        <ValueMeter ref={meterRef} value={revealed} cost={cost} />
        <button className="ghost" onClick={skip}>
          Skip ⏭
        </button>
      </div>
      <AnimatePresence>
        {profitPop > 0 && (
          <motion.div
            key={profitPop}
            className="profit-toast"
            initial={{ opacity: 0, y: 20, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -20], scale: [0.6, 1.1, 1, 1] }}
            transition={{ duration: 2.2, times: [0, 0.15, 0.8, 1] }}
          >
            ▲ IN THE GREEN!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showcase && (
          <motion.div key={showcase.key} className="showcase" style={vars({ '--tier': TIER_STYLE[showcase.tier].color })} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }}>
            <div className="showcase-rays" />
            <motion.div className="showcase-banner" initial={{ scale: 2.2, opacity: 0, letterSpacing: '0.6em' }} animate={{ scale: 1, opacity: 1, letterSpacing: '0.18em' }} transition={{ type: 'spring', stiffness: 140, damping: 14 }}>
              {showcase.value >= JACKPOT_VALUE ? 'Jackpot' : TIER_STYLE[showcase.tier].label}
              <motion.span className="showcase-price" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                {money(showcase.value)}
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="stack">
        <AnimatePresence custom={dir}>
          {visible
            .map((p, k) => {
              const i = idx + k;
              const isTop = k === 0;
              const faceDown = needsFlip(i);
              const rank = rankOf(p);
              return (
                <motion.div
                  key={i}
                  ref={isTop ? topRef : undefined}
                  className={`stack-card ${isTop ? 'top' : ''} ${isTop && charging ? 'charging' : ''} ${isTop && faceDown ? 'facedown' : ''}`}
                  style={vars({ zIndex: 10 - k, '--tier': TIER_STYLE[p.card.tier].color })}
                  custom={dir}
                  initial={i === 0 ? { y: 300, opacity: 0, scale: 0.8 } : false}
                  animate={{ y: k * -10, scale: 1 - k * 0.04, opacity: k > 2 ? 0 : 1, rotate: k === 0 ? 0 : (i % 2 ? 1.5 : -1.5) * k, transition: { type: 'spring', stiffness: 260, damping: 26, delay: i === 0 ? 0.1 : 0 } }}
                  variants={FLING}
                  exit="exit"
                  drag={isTop && !faceDown}
                  dragElastic={0.7}
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  onDragStart={() => (dragged.current = true)}
                  onDragEnd={(_, info) => {
                    window.setTimeout(() => (dragged.current = false), 0);
                    if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) advance(info.offset.x > 0 ? 1 : -1);
                  }}
                  onTap={isTop ? onTap : undefined}
                  whileDrag={{ scale: 1.04, rotate: 0 }}
                >
                  <div className="shaker">
                    <motion.div className="flipper" initial={false} animate={{ rotateY: faceDown ? 180 : 0 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
                      <div className="face front">
                        <CardView card={p.card} foil={p.foil} shimmer={isTop && (p.foil || rank >= TIER_RANK.rare)} tilt={isTop} />
                      </div>
                      <div className="face back">
                        <CardBack />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })
            .reverse()}
        </AnimatePresence>
      </div>

      <div className="reveal-info">
        {cur && (
            <motion.div key={`${idx}-${needsFlip(idx)}`} className="card-caption" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {needsFlip(idx) ? (
                <>
                  <span className="pill glow" style={vars({ '--tier': rankOf(cur) >= FLIP_RANK ? TIER_STYLE[cur.card.tier].color : '#ffe066' })}>
                    {rankOf(cur) >= FLIP_RANK ? 'Something special…' : '💰 Something valuable…'}
                  </span>
                  <span className="caption-name">Tap to reveal</span>
                </>
              ) : (
                <>
                  <span className="pill" style={vars({ '--tier': TIER_STYLE[cur.card.tier].color })}>
                    {TIER_STYLE[cur.card.tier].label}
                    {cur.foil && rankOf(cur) < TIER_RANK.rare ? ' · Foil' : ''}
                  </span>
                  {newIds.has(cur.card.id) && <span className="pill new">New</span>}
                  <PriceTag value={values[idx]} />
                  <span className="caption-name">{cur.card.name}</span>
                </>
              )}
            </motion.div>
          )}
        <p className="hint">{cur && needsFlip(idx) ? 'Tap the card' : 'Swipe or tap for the next card'}</p>
      </div>
    </div>
  );
}
