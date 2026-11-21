import { vars } from '../lib/css';
import { useRef, type CSSProperties, type PointerEvent } from 'react';
import type { Card, SetInfo } from '../lib/types';
import { IMG, THEMES } from '../lib/sets';

/** Serrated (crimped) top and bottom edges as a clip-path polygon. */
function crimpPath(teeth = 22, depth = 1.6): string {
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * 100;
    pts.push(`${x}% ${i % 2 ? depth : 0}%`);
  }
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * 100;
    pts.push(`${x}% ${100 - (i % 2 ? depth : 0)}%`);
  }
  return `polygon(${pts.join(',')})`;
}
const CRIMP = crimpPath();

interface Props {
  set: SetInfo;
  cover?: Card;
  tilt?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Glow color hint (best rarity inside). */
  aura?: string;
}

export function PackArt({ set, cover, tilt, className = '', style, aura }: Props) {
  const theme = THEMES[set.id];
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: PointerEvent) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty('--px', `${px * 100}%`);
    ref.current.style.setProperty('--py', `${py * 100}%`);
    ref.current.style.setProperty('--rx', `${(0.5 - py) * 16}deg`);
    ref.current.style.setProperty('--ry', `${(px - 0.5) * 20}deg`);
  };
  const onLeave = () => {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  };

  return (
    <div
      ref={ref}
      className={`pack ${className}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={vars({ '--c0': theme.colors[0], '--c1': theme.colors[1], '--c2': theme.colors[2], '--aura': aura ?? theme.colors[2] }, style)}
    >
      <div className="pack-body" style={{ clipPath: CRIMP }}>
        <div className="pack-bg" />
        <div className="pack-crimp top" />
        <div className="pack-crimp bottom" />
        <div className="pack-logo">
          <span className="pack-logo-main">RIFTBOUND</span>
          <span className="pack-logo-sub">Trading Card Game</span>
        </div>
        <div className="pack-window">
          {cover && <img src={IMG(cover.image, 600)} alt="" draggable={false} />}
          <div className="pack-window-shade" />
        </div>
        <div className="pack-title">
          <span className="pack-set">{set.name}</span>
          <span className="pack-meta">Booster Pack · 14 Cards</span>
        </div>
        <div className="pack-sheen" />
        <div className="pack-glint" />
      </div>
    </div>
  );
}
