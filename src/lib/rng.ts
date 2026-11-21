export type Rng = () => number;

/** Small, fast seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('pick() from empty list');
  return items[Math.floor(rng() * items.length)];
}

/** Pick `n` distinct items (falls back to repeats only if the pool is too small). */
export function pickDistinct<T>(items: readonly T[], n: number, rng: Rng): T[] {
  if (items.length === 0) throw new Error('pickDistinct() from empty list');
  if (items.length < n) return Array.from({ length: n }, () => pick(items, rng));
  const copy = items.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
