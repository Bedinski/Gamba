/** Lightweight full-screen canvas particle engine (additive blending). */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  kind: 'spark' | 'dot' | 'star' | 'ember';
  spin: number;
  rot: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface Converge {
  x: number;
  y: number;
  color: string;
  rate: number;
  radius: number;
  acc: number;
}

export interface BurstOpts {
  x: number;
  y: number;
  count?: number;
  colors?: string[];
  speed?: number;
  life?: number;
  size?: number;
  gravity?: number;
  kind?: Particle['kind'];
  spread?: number;
  angle?: number;
  drag?: number;
}

class FxEngine {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private converges = new Map<string, Converge>();
  private ambientColor = '#ffcf7a';
  private ambientRate = 0.6;
  private ambientAcc = 0;
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', this.resize);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  detach() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.canvas = null;
    this.ctx = null;
  }

  private resize = () => {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  setAmbient(color: string, rate = 0.6) {
    this.ambientColor = color;
    this.ambientRate = rate;
  }

  burst(o: BurstOpts) {
    const count = Math.round((o.count ?? 40) * (this.reduced ? 0.3 : 1));
    const colors = o.colors ?? ['#ffd27a', '#fff'];
    const speed = o.speed ?? 6;
    const spread = o.spread ?? Math.PI * 2;
    const angle = o.angle ?? 0;
    for (let i = 0; i < count; i++) {
      const a = angle - spread / 2 + Math.random() * spread;
      const s = speed * (0.25 + Math.random() * 0.9);
      const life = (o.life ?? 900) * (0.5 + Math.random() * 0.7);
      this.parts.push({
        x: o.x,
        y: o.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        max: life,
        size: (o.size ?? 3) * (0.5 + Math.random()),
        color: colors[i % colors.length],
        gravity: o.gravity ?? 0.08,
        drag: o.drag ?? 0.965,
        kind: o.kind ?? 'spark',
        spin: (Math.random() - 0.5) * 0.3,
        rot: Math.random() * Math.PI,
      });
    }
  }

  ring(x: number, y: number, color: string, maxR = 260, life = 700, width = 6) {
    this.rings.push({ x, y, r: 0, maxR, life, max: life, color, width });
  }

  /** Continuous particles drawn toward a point (used for "charging" a reveal). */
  converge(key: string, x: number, y: number, color: string, rate = 2, radius = 260) {
    this.converges.set(key, { x, y, color, rate, radius, acc: 0 });
  }

  stopConverge(key: string) {
    this.converges.delete(key);
  }

  trail(x: number, y: number, color: string) {
    this.burst({ x, y, count: 3, colors: [color, '#fff'], speed: 2.5, life: 450, size: 2.2, gravity: 0.05 });
  }

  private tick = (now: number) => {
    const dt = Math.min(48, now - this.last);
    this.last = now;
    const k = dt / 16.67;
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);

    // ambient embers rising from the bottom
    this.ambientAcc += this.ambientRate * k * (this.reduced ? 0.2 : 1);
    while (this.ambientAcc >= 1) {
      this.ambientAcc -= 1;
      const life = 5000 + Math.random() * 5000;
      this.parts.push({
        x: Math.random() * this.w,
        y: this.h + 10,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.3 + Math.random() * 0.8),
        life,
        max: life,
        size: 0.8 + Math.random() * 2,
        color: Math.random() < 0.3 ? '#ffffff' : this.ambientColor,
        gravity: 0,
        drag: 1,
        kind: 'ember',
        spin: 0,
        rot: Math.random() * 6.28,
      });
    }

    for (const c of this.converges.values()) {
      c.acc += c.rate * k;
      while (c.acc >= 1) {
        c.acc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = c.radius * (0.7 + Math.random() * 0.5);
        const life = 600 + Math.random() * 300;
        const steps = life / 16.67;
        this.parts.push({
          x: c.x + Math.cos(a) * r,
          y: c.y + Math.sin(a) * r,
          vx: (-Math.cos(a) * r) / steps,
          vy: (-Math.sin(a) * r) / steps,
          life,
          max: life,
          size: 1.5 + Math.random() * 2.5,
          color: Math.random() < 0.25 ? '#fff' : c.color,
          gravity: 0,
          drag: 1,
          kind: 'spark',
          spin: 0,
          rot: 0,
        });
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    const alive: Particle[] = [];
    for (const p of this.parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vx *= Math.pow(p.drag, k);
      p.vy = p.vy * Math.pow(p.drag, k) + p.gravity * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.rot += p.spin * k;
      const t = p.life / p.max;
      ctx.globalAlpha = p.kind === 'ember' ? Math.min(1, t * 3) * Math.min(1, (1 - t) * 6) * 0.7 : Math.min(1, t * 1.6);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.kind === 'spark') {
        ctx.lineWidth = p.size * t + 0.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx.stroke();
      } else if (p.kind === 'star') {
        const s = p.size * (0.4 + t);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(s * 0.25, s * 0.25, s * 2.4, 0);
          ctx.quadraticCurveTo(s * 0.25, -s * 0.25, 0, 0);
        }
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'ember' ? 1 : t), 0, Math.PI * 2);
        ctx.fill();
      }
      alive.push(p);
    }
    this.parts = alive.length > 2500 ? alive.slice(-2500) : alive;

    this.rings = this.rings.filter((r) => {
      r.life -= dt;
      if (r.life <= 0) return false;
      const t = 1 - r.life / r.max;
      r.r = r.maxR * (1 - Math.pow(1 - t, 3));
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      return true;
    });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.raf = requestAnimationFrame(this.tick);
  };
}

export const fx = new FxEngine();

/** Centre of an element in viewport coordinates. */
export function centerOf(el: Element | null): { x: number; y: number } {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
