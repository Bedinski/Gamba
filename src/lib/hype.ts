import { useEffect, useRef, useState } from 'react';

/**
 * Value thresholds that drive reveal excitement. Picked from simulated pull data:
 * a pack's best card clears $5 in roughly the top 10% of packs, $20 in a few percent,
 * and $75 well under 1%.
 */
export const HIT_VALUE = 5;
export const BIG_HIT_VALUE = 20;
export const JACKPOT_VALUE = 75;

/** Smoothly animates a number toward `target` (ease-out), for count-up displays. */
export function useAnimatedNumber(target: number, duration = 700, from?: number): number {
  const [value, setValue] = useState(from ?? target);
  const current = useRef(from ?? target);

  useEffect(() => {
    const start = current.current;
    const delta = target - start;
    if (Math.abs(delta) < 0.005) {
      current.current = target;
      setValue(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      current.current = start + delta * eased;
      setValue(current.current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
