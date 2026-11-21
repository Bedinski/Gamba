import { useEffect, useRef, useState, type ReactNode } from 'react';
import { money, signedMoney, signedPct } from '../lib/prices';

/* Chart tokens (dark surface). Profit/loss is polarity: green above zero, red below,
 * always paired with a sign and ▲/▼ so meaning never relies on color alone. */
export const C = {
  good: '#34d37a',
  bad: '#ff5a5f',
  seq: '#3987e5',
  grid: 'rgba(255,255,255,0.07)',
  axis: 'rgba(255,255,255,0.18)',
  text2: '#a39cc4',
  surface: '#120f22',
};

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** ~`count` "nice" ticks whose range always covers [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; ; v += step) {
    out.push(Math.round(v * 1e6) / 1e6);
    if (v >= max - step * 1e-9 || out.length > 50) break;
  }
  return out;
}

const compact = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `$${a % 1 ? a.toFixed(a < 10 ? 2 : 0) : a}`;
  return n < 0 ? `−${s}` : s;
};

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 90), width - 90);
  return (
    <div className="chart-tip" style={{ left, top: y }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ line */

export interface NetPoint {
  i: number;
  net: number;
  label: string;
  value: number;
  cost: number;
}

export function NetLineChart({ points, height = 260 }: { points: NetPoint[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 58, r: 14, t: 14, b: 30 };
  const iw = Math.max(10, width - m.l - m.r);
  const ih = height - m.t - m.b;
  const n = points.length;

  const ys = points.map((p) => p.net);
  const lo = Math.min(0, ...ys);
  const hi = Math.max(0, ...ys);
  const pad = (hi - lo || 1) * 0.08;
  const ticks = niceTicks(lo - pad, hi + pad, 4);
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const sx = (i: number) => m.l + (n ? (i / n) * iw : 0);
  const sy = (v: number) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
  const zeroY = sy(0);

  const pts = [{ x: sx(0), y: sy(0) }, ...points.map((p) => ({ x: sx(p.i), y: sy(p.net) }))];
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1].x.toFixed(1)},${zeroY.toFixed(1)}L${pts[0].x.toFixed(1)},${zeroY.toFixed(1)}Z`;
  const zeroOffset = Math.min(1, Math.max(0, (zeroY - m.t) / ih));
  const xTicks = n ? niceTicks(0, n, Math.min(6, n)).filter((t) => t <= n && Number.isInteger(t)) : [];

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!n) return;
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * n);
    setHover(Math.min(n, Math.max(1, i)));
  };
  const hp = hover ? points[hover - 1] : null;

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Running profit over ${n} packs, now ${signedMoney(ys[n - 1] ?? 0)}`}>
          <defs>
            <linearGradient id="pl-stroke" x1="0" y1={m.t} x2="0" y2={m.t + ih} gradientUnits="userSpaceOnUse">
              <stop offset={zeroOffset} stopColor={C.good} />
              <stop offset={zeroOffset} stopColor={C.bad} />
            </linearGradient>
            <linearGradient id="pl-fill" x1="0" y1={m.t} x2="0" y2={m.t + ih} gradientUnits="userSpaceOnUse">
              <stop offset={0} stopColor={C.good} stopOpacity={0.32} />
              <stop offset={zeroOffset} stopColor={C.good} stopOpacity={0.04} />
              <stop offset={zeroOffset} stopColor={C.bad} stopOpacity={0.04} />
              <stop offset={1} stopColor={C.bad} stopOpacity={0.32} />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? C.axis : C.grid} strokeDasharray={t === 0 ? '4 4' : undefined} />
              <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="axis-label">
                {compact(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={height - 8} textAnchor="middle" className="axis-label">
              {t === 0 ? '' : `#${t}`}
            </text>
          ))}
          {n > 0 && (
            <>
              <path d={area} fill="url(#pl-fill)" />
              <path d={line} fill="none" stroke="url(#pl-stroke)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={4.5} fill={ys[n - 1] >= 0 ? C.good : C.bad} stroke={C.surface} strokeWidth={2} />
            </>
          )}
          {hp && (
            <g pointerEvents="none">
              <line x1={sx(hp.i)} x2={sx(hp.i)} y1={m.t} y2={m.t + ih} stroke="rgba(255,255,255,0.35)" />
              <circle cx={sx(hp.i)} cy={sy(hp.net)} r={5} fill={hp.net >= 0 ? C.good : C.bad} stroke={C.surface} strokeWidth={2} />
            </g>
          )}
          <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ cursor: 'crosshair' }} />
        </svg>
      )}
      {hp && (
        <Tooltip x={sx(hp.i)} y={Math.max(4, sy(hp.net) - 86)} width={width}>
          <b>
            Pack #{hp.i} · {hp.label}
          </b>
          <span>
            Pulled {money(hp.value)} for {money(hp.cost)}
          </span>
          <span className={hp.net >= 0 ? 'good' : 'bad'}>
            {hp.net >= 0 ? '▲' : '▼'} Running {signedMoney(hp.net)}
          </span>
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ diverging bars */

export interface RoiRow {
  key: string;
  label: string;
  roi: number;
  net: number;
  packs: number;
}

export function RoiBars({ rows }: { rows: RoiRow[] }) {
  const max = Math.max(0.25, ...rows.map((r) => Math.abs(r.roi)));
  return (
    <div className="roi-bars" role="table" aria-label="Return by set">
      {rows.map((r) => {
        const w = (Math.abs(r.roi) / max) * 50;
        const win = r.roi >= 0;
        return (
          <div className="roi-row" role="row" key={r.key} title={`${r.label}: ${signedPct(r.roi)} (${signedMoney(r.net)}) over ${r.packs} packs`}>
            <span className="roi-label" role="rowheader">
              {r.label}
              <small>{r.packs} packs</small>
            </span>
            <span className="roi-track" role="cell">
              <span className="roi-zero" />
              <span className={`roi-bar ${win ? 'win' : 'loss'}`} style={win ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />
            </span>
            <span className={`roi-val ${win ? 'good' : 'bad'}`} role="cell">
              {win ? '▲' : '▼'} {signedPct(r.roi)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ histogram */

export function Histogram({ bins, marker, markerLabel, height = 220 }: { bins: { from: number; to: number; count: number }[]; marker?: number; markerLabel?: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const m = { l: 40, r: 10, t: 22, b: 30 };
  const iw = Math.max(10, width - m.l - m.r);
  const ih = height - m.t - m.b;
  const maxX = bins.length ? bins[bins.length - 1].to : 1;
  const maxC = Math.max(1, ...bins.map((b) => b.count));
  const yt = niceTicks(0, maxC, 3).filter((t) => Number.isInteger(t));
  const ymax = yt[yt.length - 1] || 1;
  const sx = (v: number) => m.l + (v / maxX) * iw;
  const sy = (c: number) => m.t + ih - (c / ymax) * ih;
  const bw = bins.length ? iw / bins.length : 0;
  const hb = hover !== null ? bins[hover] : null;

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Distribution of pack values">
          {yt.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? C.axis : C.grid} />
              <text x={m.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="axis-label">
                {t}
              </text>
            </g>
          ))}
          {bins.map((b, i) => {
            const x = sx(b.from) + 1;
            const w = Math.max(1, bw - 2);
            const h = Math.max(0, m.t + ih - sy(b.count));
            const r = Math.min(4, w / 2, h);
            const y = sy(b.count);
            // Rounded top, square base anchored to the baseline.
            const d = h > 0 ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z` : '';
            return (
              <g key={i}>
                {d && <path d={d} fill={C.seq} opacity={hover === null || hover === i ? 1 : 0.45} />}
                <rect x={sx(b.from)} y={m.t} width={bw} height={ih} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
              </g>
            );
          })}
          {niceTicks(0, maxX, Math.min(5, bins.length)).filter((t) => t <= maxX).map((t) => (
            <text key={t} x={sx(t)} y={height - 8} textAnchor="middle" className="axis-label">
              {compact(t)}
            </text>
          ))}
          {marker !== undefined && marker <= maxX && (
            <g pointerEvents="none">
              <line x1={sx(marker)} x2={sx(marker)} y1={m.t - 6} y2={m.t + ih} stroke="#ffe066" strokeWidth={1.5} strokeDasharray="4 3" />
              <text x={sx(marker) + 6} y={m.t - 8} className="axis-label marker-label">
                {markerLabel}
              </text>
            </g>
          )}
        </svg>
      )}
      {hb && (
        <Tooltip x={sx((hb.from + hb.to) / 2)} y={Math.max(0, sy(hb.count) - 56)} width={width}>
          <b>
            {money(hb.from)} – {money(hb.to)}
          </b>
          <span>
            {hb.count} pack{hb.count === 1 ? '' : 's'}
          </span>
        </Tooltip>
      )}
    </div>
  );
}
