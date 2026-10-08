import { makeRng } from '../lib/rng.js';

/**
 * Story data for chapters 1–2: temperature (°C) vs ice-cream cones sold.
 * A real trend plus honest noise.
 */
export function iceCreamData(seed = 7, n = 18) {
  const rng = makeRng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = 11 + (i / (n - 1)) * 23 + (rng() - 0.5) * 1.6;
    const y = 3.1 * x - 22 + rng.normal() * 9;
    pts.push({ x, y: Math.max(2, y) });
  }
  return pts;
}

/**
 * Linear regression y = slope·x + intercept, trained by gradient descent on
 * mean squared error. Internally x and y are centred and scaled (u, v) so
 * that plain gradient descent behaves well — the same trick real libraries
 * use. Parameters a (slope) and c (intercept) live in that scaled space.
 */
export class LinearModel {
  constructor(points) {
    this.points = points;
    const n = points.length;
    const mean = (f) => points.reduce((s, p) => s + f(p), 0) / n;
    this.xm = mean((p) => p.x);
    this.ym = mean((p) => p.y);
    this.xs = Math.sqrt(mean((p) => (p.x - this.xm) ** 2)) || 1;
    this.ys = Math.sqrt(mean((p) => (p.y - this.ym) ** 2)) || 1;
    this.u = points.map((p) => (p.x - this.xm) / this.xs);
    this.v = points.map((p) => (p.y - this.ym) / this.ys);
    this.a = 0;
    this.c = 0;
  }

  /** Mean squared error in the scaled space. */
  lossScaled(a = this.a, c = this.c) {
    let s = 0;
    for (let i = 0; i < this.u.length; i++) {
      const r = a * this.u[i] + c - this.v[i];
      s += r * r;
    }
    return s / this.u.length;
  }

  /** Mean squared error in real units (cones²). Same minimum, just rescaled. */
  loss(a = this.a, c = this.c) { return this.lossScaled(a, c) * this.ys * this.ys; }

  /** Exact gradient of the scaled MSE with respect to (a, c). */
  grad(a = this.a, c = this.c) {
    let da = 0, dc = 0;
    const n = this.u.length;
    for (let i = 0; i < n; i++) {
      const r = a * this.u[i] + c - this.v[i];
      da += 2 * r * this.u[i];
      dc += 2 * r;
    }
    return [da / n, dc / n];
  }

  /** One step of gradient descent. Returns the gradient that was used. */
  step(lr) {
    const [da, dc] = this.grad();
    this.a -= lr * da;
    this.c -= lr * dc;
    return [da, dc];
  }

  /** Best possible line, solved exactly (used only to check our answers). */
  optimum() {
    let su = 0, suv = 0;
    for (let i = 0; i < this.u.length; i++) { su += this.u[i] ** 2; suv += this.u[i] * this.v[i]; }
    return { a: suv / su, c: 0 };
  }

  predict(x, a = this.a, c = this.c) {
    return this.ym + this.ys * (a * (x - this.xm) / this.xs + c);
  }

  /** Set the line so it passes through two points (used when dragging). */
  setThrough(x1, y1, x2, y2) {
    const u1 = (x1 - this.xm) / this.xs, v1 = (y1 - this.ym) / this.ys;
    const u2 = (x2 - this.xm) / this.xs, v2 = (y2 - this.ym) / this.ys;
    this.a = (v2 - v1) / (u2 - u1);
    this.c = v1 - this.a * u1;
  }

  /** Slope in real units (cones per °C). */
  realSlope(a = this.a) { return (a * this.ys) / this.xs; }
}
