import type { PhysicsTokens } from "./tokens";

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Hermite smoothstep of x across [a, b]. */
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

export type SpringOptions = { k?: number; c?: number; eps?: number };

/**
 * Damped spring, semi-implicit Euler. `k`/`c` default to the live tokens so a
 * tuner can retune motion while it runs.
 */
export class Spring {
  x: number;
  v = 0;
  target: number;
  k?: number;
  c?: number;
  eps: number;

  constructor(x = 0, { k, c, eps = 0.0005 }: SpringOptions = {}) {
    this.x = this.target = x;
    this.k = k;
    this.c = c;
    this.eps = eps;
  }

  step(dt: number, tokens: PhysicsTokens) {
    if (tokens.reduceMotion) return this.snap(this.target);
    const k = this.k ?? tokens.springStiffness, c = this.c ?? tokens.springDamping;
    this.v += (k * (this.target - this.x) - c * this.v) * dt;
    this.x += this.v * dt;
    if (Math.abs(this.v) < this.eps * 10 && Math.abs(this.target - this.x) < this.eps) this.snap(this.target);
  }

  snap(x: number) {
    this.x = this.target = x;
    this.v = 0;
  }

  get settled() {
    return this.v === 0 && this.x === this.target;
  }
}

export type FrameCallback = (dt: number, now: number) => void;

/** One shared rAF loop; components subscribe instead of running their own. */
class Ticker {
  private subs = new Set<FrameCallback>();
  private raf = 0;
  private last = 0;

  add(fn: FrameCallback) {
    this.subs.add(fn);
    if (!this.raf && typeof requestAnimationFrame === "function") {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
    return () => this.remove(fn);
  }

  remove(fn: FrameCallback) {
    this.subs.delete(fn);
    if (!this.subs.size && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private loop = (now: number) => {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    this.subs.forEach(fn => fn(dt, now));
    this.raf = this.subs.size ? requestAnimationFrame(this.loop) : 0;
  };
}

export const ticker = new Ticker();
