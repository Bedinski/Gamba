/** Tiny procedural sound effects via Web Audio — no audio files needed. */

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('rb-muted') === '1';
  } catch {
    return false;
  }
})();

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('rb-muted', m ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(c: AudioContext, dur: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function env(c: AudioContext, g: GainNode, peak: number, attack: number, dur: number, t0 = c.currentTime) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', peak = 0.12, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  env(c, g, peak, 0.01, dur, t0);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  /** Short scrape while dragging the tear line. */
  scratch() {
    const c = ac();
    if (!c) return;
    const n = noise(c, 0.06);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500 + Math.random() * 2000;
    const g = c.createGain();
    env(c, g, 0.05, 0.005, 0.06);
    n.connect(f).connect(g).connect(c.destination);
    n.start();
  },
  tear() {
    const c = ac();
    if (!c) return;
    const n = noise(c, 0.5);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.setValueAtTime(800, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(4000, c.currentTime + 0.35);
    const g = c.createGain();
    env(c, g, 0.35, 0.01, 0.45);
    n.connect(f).connect(g).connect(c.destination);
    n.start();
    tone(110, 0.6, 'sine', 0.25);
    tone(220, 0.8, 'triangle', 0.06, 0.05);
  },
  whoosh() {
    const c = ac();
    if (!c) return;
    const n = noise(c, 0.3);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(2200, c.currentTime + 0.22);
    const g = c.createGain();
    env(c, g, 0.12, 0.03, 0.28);
    n.connect(f).connect(g).connect(c.destination);
    n.start();
  },
  /** Rising shimmer while a rare card charges. */
  charge() {
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.6);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    env(c, g, 0.05, 0.3, 0.65);
    o.connect(f).connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.7);
  },
  /** Chime whose brightness scales with rarity rank (0–7). */
  reveal(rank: number) {
    const base = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const notes = rank >= 4 ? [0, 2, 4, 5] : rank >= 3 ? [0, 2, 4] : rank >= 2 ? [0, 4] : [0];
    notes.forEach((n, i) => {
      tone(base[n] * (rank >= 5 ? 1.5 : 1), 0.9 + rank * 0.1, 'triangle', 0.07, i * 0.07);
      tone(base[n] * 2, 0.6, 'sine', 0.03, i * 0.07);
    });
    if (rank >= 4) tone(65, 1.4, 'sine', 0.3);
  },
  tap() {
    tone(880, 0.08, 'sine', 0.04);
  },
  /** Bright coin "ting" for a valuable card. */
  coin() {
    tone(1975.5, 0.18, 'square', 0.025);
    tone(2637, 0.35, 'sine', 0.07, 0.06);
  },
  /** Cash-register flourish when a pack crosses into profit. */
  profit() {
    const c = ac();
    if (!c) return;
    const n = noise(c, 0.08);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3000;
    const g = c.createGain();
    env(c, g, 0.12, 0.002, 0.08);
    n.connect(f).connect(g).connect(c.destination);
    n.start();
    [1318.5, 1568, 2093, 2637].forEach((fq, i) => tone(fq, 0.5, 'triangle', 0.06, 0.05 + i * 0.07));
  },
  /** Big jackpot fanfare. */
  jackpot() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((fq, i) => {
      tone(fq, 1.2, 'triangle', 0.07, i * 0.09);
      tone(fq * 2, 0.8, 'sine', 0.025, i * 0.09);
    });
    tone(55, 1.8, 'sine', 0.35);
  },
  /** Soft descending tone for a losing pack. */
  miss() {
    tone(392, 0.25, 'sine', 0.05);
    tone(293.66, 0.45, 'sine', 0.05, 0.12);
  },
};
