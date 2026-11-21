import { vars } from '../lib/css';
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Card } from '../lib/types';
import { IMG } from '../lib/sets';
import { TIER_STYLE } from '../lib/rarity';
import { TIER_RANK } from '../lib/packs';

interface Props {
  card: Card;
  foil?: boolean;
  /** Image width to request from the CDN. */
  res?: number;
  /** Follow the pointer with a 3D tilt + glare. */
  tilt?: boolean;
  /** Animate the foil sheen on its own (no pointer needed). */
  shimmer?: boolean;
  className?: string;
  style?: CSSProperties;
  dim?: boolean;
}

export function CardView({ card, foil, res = 500, tilt, shimmer, className = '', style, dim }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const rank = TIER_RANK[card.tier];
  const holo = foil || rank >= TIER_RANK.rare;
  // Walk through fallback art when an image is missing; reset whenever the card changes.
  const [failed, setFailed] = useState({ id: card.id, n: 0 });
  const attempt = failed.id === card.id ? failed.n : 0;
  const sources = [card.image, ...(card.fallbackImages ?? [])];
  const src = sources[attempt];

  const onMove = (e: PointerEvent) => {
    const el = ref.current;
    if (!el || !tilt) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--px', `${px * 100}%`);
    el.style.setProperty('--py', `${py * 100}%`);
    el.style.setProperty('--rx', `${(0.5 - py) * 22}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 26}deg`);
    el.style.setProperty('--hyp', `${Math.min(1, Math.hypot(px - 0.5, py - 0.5) * 2)}`);
    el.classList.add('is-active');
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.classList.remove('is-active');
  };

  return (
    <div
      ref={ref}
      className={`card tier-${card.tier} ${holo ? 'holo' : ''} ${shimmer ? 'shimmer' : ''} ${tilt ? 'tiltable' : ''} ${dim ? 'dim' : ''} ${className}`}
      style={vars({ '--tier': TIER_STYLE[card.tier].color }, style)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div className="card-inner">
        {src ? (
          <img
            key={src}
            className={card.landscape ? 'landscape' : ''}
            src={IMG(src, res)}
            alt={card.name}
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={() => setFailed({ id: card.id, n: attempt + 1 })}
          />
        ) : (
          <div className="card-missing">
            <span>{card.name}</span>
            <small>{TIER_STYLE[card.tier].label}</small>
          </div>
        )}
        {holo && <div className="foil" />}
        {rank >= TIER_RANK.altArt && <div className="sparkle" />}
        <div className="glare" />
      </div>
    </div>
  );
}

export function CardBack({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`card card-back ${className}`} style={style}>
      <div className="card-inner">
        <div className="back-pattern" />
        <div className="back-emblem">
          <svg viewBox="0 0 100 100" aria-hidden>
            <defs>
              <linearGradient id="bg-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffe3a3" />
                <stop offset="0.5" stopColor="#d9a441" />
                <stop offset="1" stopColor="#7a5520" />
              </linearGradient>
            </defs>
            <path d="M50 4 L92 50 L50 96 L8 50 Z" fill="none" stroke="url(#bg-g)" strokeWidth="3" />
            <path d="M50 16 L80 50 L50 84 L20 50 Z" fill="none" stroke="url(#bg-g)" strokeWidth="1.5" opacity="0.7" />
            <path d="M50 30 L66 50 L50 70 L34 50 Z" fill="url(#bg-g)" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="url(#bg-g)" strokeWidth="0.8" opacity="0.5" />
          </svg>
          <span>RIFTBOUND</span>
        </div>
        <div className="glare" />
      </div>
    </div>
  );
}
