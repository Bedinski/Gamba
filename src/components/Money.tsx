import { motion } from 'framer-motion';
import { forwardRef } from 'react';
import { BIG_HIT_VALUE, HIT_VALUE, JACKPOT_VALUE, useAnimatedNumber } from '../lib/hype';
import { money, signedMoney, signedPct } from '../lib/prices';

export function priceClass(v: number): string {
  return v >= JACKPOT_VALUE ? 'jackpot' : v >= BIG_HIT_VALUE ? 'big' : v >= HIT_VALUE ? 'hit' : '';
}

/** A card's market price as a chip; bigger values get louder styling. */
export function PriceTag({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`price-tag ${priceClass(value)} ${className}`} title="TCGplayer market price">
      {value >= HIT_VALUE && <span aria-hidden>💰</span>}
      {money(value)}
    </span>
  );
}

export function AnimatedMoney({ value, from, duration, signed }: { value: number; from?: number; duration?: number; signed?: boolean }) {
  const v = useAnimatedNumber(value, duration, from);
  return <>{signed ? signedMoney(v) : money(v)}</>;
}

/** Running pack value vs. what the pack cost, shown during the reveal. */
export const ValueMeter = forwardRef<HTMLDivElement, { value: number; cost: number }>(function ValueMeter({ value, cost }, ref) {
  const shown = useAnimatedNumber(value, 600);
  const scale = Math.max(cost * 1.6, shown * 1.05, 0.01);
  const profit = shown >= cost;
  return (
    <div className={`value-meter ${profit ? 'profit' : ''}`} ref={ref}>
      <div className="vm-row">
        <span className="vm-label">Pack value</span>
        <span className="vm-value">
          {money(shown)} <small>/ {money(cost)} paid</small>
        </span>
      </div>
      <div className="vm-track" role="meter" aria-valuemin={0} aria-valuemax={scale} aria-valuenow={shown} aria-label="Pack value versus cost">
        <div className="vm-fill" style={{ width: `${Math.min(100, (shown / scale) * 100)}%` }} />
        <div className="vm-cost" style={{ left: `${(cost / scale) * 100}%` }}>
          <span>cost</span>
        </div>
      </div>
      <div className="vm-status">
        {profit ? (
          <span className="good">▲ In profit {signedMoney(shown - cost)}</span>
        ) : (
          <span className="muted">{money(cost - shown)} to break even</span>
        )}
      </div>
    </div>
  );
});

/** Big animated value / cost / profit readout for pack results. */
export function ProfitHero({ value, cost, label = 'Pack value', delay = 0 }: { value: number; cost: number; label?: string; delay?: number }) {
  const net = value - cost;
  const roi = cost > 0 ? net / cost : 0;
  const win = net >= 0;
  const verdict = roi >= 2 ? 'Massive pull!' : win ? 'Profit!' : roi > -0.25 ? 'So close' : roi > -0.6 ? 'Better luck next pack' : 'Ouch';
  return (
    <motion.div
      className={`profit-hero ${win ? 'win' : 'loss'}`}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 180, damping: 18 }}
    >
      <div className="ph-main">
        <span className="ph-label">{label}</span>
        <span className="ph-value">
          <AnimatedMoney value={value} from={0} duration={1400} />
        </span>
      </div>
      <div className="ph-side">
        <div>
          <span className="ph-label">Cost</span>
          <span className="ph-num">{money(cost)}</span>
        </div>
        <div>
          <span className="ph-label">Net</span>
          <span className={`ph-num ${win ? 'good' : 'bad'}`}>
            {win ? '▲' : '▼'} {signedMoney(net)}
          </span>
        </div>
        <div>
          <span className="ph-label">Return</span>
          <span className={`ph-num ${win ? 'good' : 'bad'}`}>{signedPct(roi)}</span>
        </div>
      </div>
      <motion.div className="ph-verdict" initial={{ opacity: 0, scale: 1.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: delay + 1.3, type: 'spring', stiffness: 260, damping: 14 }}>
        {verdict}
      </motion.div>
    </motion.div>
  );
}
