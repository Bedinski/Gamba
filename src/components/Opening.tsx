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

const FLING = {
  exit: (d: number) => ({ x: d * 700, y: -120, rotate: d * 28, opacity: 0, transition: { duration: 0.42, ease: [0.3, 0, 0.6, 1] } }),
};

type Phase = 'choose' | 'ready' | 'tearing' | 'reveal' | 'summary';

interface Props {
  set: LoadedSet;
  collection: Collection;
  onRecord: (setId: string, pack: PulledCard[]) => void;
  onExit: () => void;
  onCollection: () => void;
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

export function Opening({ set, collection, onRecord, onExit, onCollection, onInspect }: Props) {
  const [pack, setPack] = useState<PulledCard[]>(() => roll(set));
  const [phase, setPhase] = useState<Phase>('choose');
  const [chosen, setChosen] = useState(0);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState(0);
  const [shake, setShake] = useState(0);
  const covers = useMemo(() => coverCards(set, 3), [set]);
  const theme = THEMES[set.info.id];

  useEffect(() => {
    for (const p of pack) {
      const img = new Image();
      img.src = IMG(p.card.image, 500);
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

  return (
    <div className={`stage ${shake ? 'shake-' + (shake % 2) : ''}`}>
      <header className="topbar">
        <button className="ghost" onClick={onExit}>
          ← Sets
        </button>
        <div className="topbar-title">
          <span>{set.info.name}</span>
        </div>
        <button className="ghost" onClick={onCollection}>
          Collection
        </button>
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
            <p className="hint">7 Commons · 3 Uncommons · 1 Foil · 2 Rare or better · 1 Rune</p>
          </motion.div>
        )}

        {(phase === 'ready' || phase === 'tearing') && (
          <motion.div key="ready" className="ready" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
            <TearablePack set={set} cover={covers[chosen]} layoutId={`pack-${chosen}`} aura={aura} torn={phase === 'tearing'} onTear={tear} />
          </motion.div>
        )}

        {phase === 'reveal' && (
          <motion.div key="reveal" className="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RevealStack pack={pack} newIds={newIds} onDone={() => setPhase('summary')} onShake={() => setShake((s) => s + 1)} onFlash={() => setFlash((f) => f + 1)} />
          </motion.div>
        )}

        {phase === 'summary' && (
          <motion.div key="summary" className="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Summary pack={pack} newIds={newIds} onInspect={onInspect} />
            <motion.div className="actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.9 } }}>
              <button className="primary" onClick={again}>
                Open Another
              </button>
              <button className="secondary" onClick={onCollection}>
                View Collection
              </button>
            </motion.div>
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
  pack: PulledCard[];
  newIds: Set<string>;
  onDone: () => void;
  onShake: () => void;
  onFlash: () => void;
}

function RevealStack({ pack, newIds, onDone, onShake, onFlash }: RevealProps) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [charging, setCharging] = useState(false);
  const [showcase, setShowcase] = useState<{ tier: Tier; key: number } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const cur = pack[idx];
  const needsFlip = (i: number) => rankOf(pack[i]) >= FLIP_RANK && !flipped.has(i);

  // Card arrival effects
  useEffect(() => {
    if (!cur) return;
    const rank = rankOf(cur);
    const t = window.setTimeout(() => {
      const c = centerOf(topRef.current);
      if (needsFlip(idx)) {
        fx.converge('charge', c.x, c.y, TIER_STYLE[cur.card.tier].color, rank >= SHOWCASE_RANK ? 4 : 2.5, 280);
      } else if (rank >= TIER_RANK.rare || cur.foil) {
        sfx.reveal(rank);
        fx.burst({ x: c.x, y: c.y, count: rank >= TIER_RANK.rare ? 50 : 22, colors: burstColors(cur.card.tier), speed: 7, kind: 'star', size: 2.5, gravity: 0.04 });
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
    if (busy.current || now - lastAdvance.current < 280) return;
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
    window.setTimeout(() => {
      fx.stopConverge('charge');
      setCharging(false);
      setFlipped((f) => new Set(f).add(idx));
      const c = centerOf(topRef.current);
      sfx.reveal(rank);
      fx.burst({ x: c.x, y: c.y, count: rank >= SHOWCASE_RANK ? 220 : 120, colors: burstColors(tier), speed: rank >= SHOWCASE_RANK ? 16 : 11, life: 1400, size: 3.5, kind: 'spark', gravity: 0.1 });
      fx.burst({ x: c.x, y: c.y, count: 40, colors: burstColors(tier), speed: 5, life: 1800, kind: 'star', size: 3, gravity: 0.02 });
      fx.ring(c.x, c.y, TIER_STYLE[tier].color, 420, 800, 8);
      if (rank >= SHOWCASE_RANK) {
        window.setTimeout(() => fx.ring(c.x, c.y, '#ffffff', 600, 1000, 4), 140);
        setShowcase({ tier, key: idx });
        onShake();
        onFlash();
        window.setTimeout(() => setShowcase(null), 2200);
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
    <div className="reveal-wrap">
      <div className="reveal-top">
        <span className="counter">
          {Math.min(idx + 1, pack.length)} <small>/ {pack.length}</small>
        </span>
        <button className="ghost" onClick={skip}>
          Skip ⏭
        </button>
      </div>

      <AnimatePresence>
        {showcase && (
          <motion.div key={showcase.key} className="showcase" style={vars({ '--tier': TIER_STYLE[showcase.tier].color })} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }}>
            <div className="showcase-rays" />
            <motion.div className="showcase-banner" initial={{ scale: 2.2, opacity: 0, letterSpacing: '0.6em' }} animate={{ scale: 1, opacity: 1, letterSpacing: '0.18em' }} transition={{ type: 'spring', stiffness: 140, damping: 14 }}>
              {TIER_STYLE[showcase.tier].label}
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
                  <span className="pill glow" style={vars({ '--tier': TIER_STYLE[cur.card.tier].color })}>
                    Something special…
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

/* ------------------------------------------------------------------------- */

function Summary({ pack, newIds, onInspect }: { pack: PulledCard[]; newIds: Set<string>; onInspect: (p: PulledCard) => void }) {
  const best = pack.reduce((b, p) => (rankOf(p) > rankOf(b) ? p : b));
  return (
    <div className="summary-wrap">
      <motion.h2 className="prompt" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        Pack Results
      </motion.h2>
      <motion.p className="hint" initial={{ opacity: 0 }} animate={{ opacity: 0.8 }}>
        Best pull: <b style={{ color: TIER_STYLE[best.card.tier].color }}>{best.card.name}</b> · {newIds.size} new
      </motion.p>
      <div className="summary-grid">
        {pack.map((p, i) => (
          <motion.button
            key={i}
            className={`summary-card r${rankOf(p)}`}
            initial={{ opacity: 0, y: 30, rotateY: 90 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -8, scale: 1.05, zIndex: 3 }}
            onClick={() => onInspect(p)}
            style={vars({ '--tier': TIER_STYLE[p.card.tier].color })}
          >
            <CardView card={p.card} foil={p.foil} res={300} shimmer={rankOf(p) >= TIER_RANK.epic} />
            {newIds.has(p.card.id) && <span className="badge-new">NEW</span>}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
