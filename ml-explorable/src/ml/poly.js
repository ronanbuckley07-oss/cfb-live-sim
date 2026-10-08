import { makeRng } from '../lib/rng.js';

/** The hidden "true" pattern for chapter 5, and noisy samples from it. */
export const truth = (x) => 0.6 * Math.sin(2.4 * x + 0.4) + 0.25 * x;

/**
 * A pool of training days (revealed a few at a time) plus a fixed set of
 * test days the model never trains on.
 */
export function sampleData(seed = 4, nPool = 80, nTest = 60, noise = 0.16) {
  const rng = makeRng(seed);
  const pt = () => { const x = rng() * 1.9 - 0.95; return { x, y: truth(x) + rng.normal() * noise }; };
  return { pool: Array.from({ length: nPool }, pt), test: Array.from({ length: nTest }, pt) };
}

/**
 * Chebyshev features T0..Td(x). Same curves as 1, x, x², … but numerically
 * much better behaved, so the exact fit stays stable at high degree.
 */
export function features(x, d) {
  const f = new Float64Array(d + 1);
  f[0] = 1;
  if (d >= 1) f[1] = x;
  for (let k = 2; k <= d; k++) f[k] = 2 * x * f[k - 1] - f[k - 2];
  return f;
}

/** Least-squares fit of a degree-d polynomial (tiny ridge only for numerical safety). */
export function fitPoly(points, d, ridge = 1e-9) {
  const n = d + 1;
  const A = Array.from({ length: n }, () => new Float64Array(n + 1));
  for (const p of points) {
    const f = features(p.x, d);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += f[i] * f[j];
      A[i][n] += f[i] * p.y;
    }
  }
  for (let i = 0; i < n; i++) A[i][i] += ridge;
  return solve(A, n);
}

export const predict = (w, x) => { const f = features(x, w.length - 1); let s = 0; for (let i = 0; i < w.length; i++) s += w[i] * f[i]; return s; };
export const mse = (w, pts) => pts.reduce((s, p) => s + (predict(w, p.x) - p.y) ** 2, 0) / pts.length;

/** Gaussian elimination with partial pivoting on an augmented matrix. */
function solve(A, n) {
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = A[r][c] / d;
      if (k) for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j];
    }
  }
  return Array.from({ length: n }, (_, i) => A[i][n] / (A[i][i] || 1e-12));
}
