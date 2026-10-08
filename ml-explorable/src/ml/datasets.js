import { makeRng } from '../lib/rng.js';

/** 2D classification datasets in [-1, 1]². Each point: { x: [x1, x2], y: 0 | 1 }. */
export const DATASETS = {
  circles: { label: 'Circles', make: circles },
  xor: { label: 'Four corners', make: xor },
  spiral: { label: 'Spirals', make: spirals },
};

function circles(n = 200, seed = 1) {
  const rng = makeRng(seed);
  return Array.from({ length: n }, (_, i) => {
    const inner = i % 2 === 0;
    const r = inner ? rng() * 0.42 : 0.62 + rng() * 0.3;
    const t = rng() * Math.PI * 2;
    return { x: [r * Math.cos(t) + rng.normal() * 0.03, r * Math.sin(t) + rng.normal() * 0.03], y: inner ? 1 : 0 };
  });
}

function xor(n = 200, seed = 2) {
  const rng = makeRng(seed);
  return Array.from({ length: n }, () => {
    let a = rng() * 2 - 1, b = rng() * 2 - 1;
    // keep a small gap around the axes so the four groups are clear
    a += Math.sign(a) * 0.08; b += Math.sign(b) * 0.08;
    return { x: [a * 0.9, b * 0.9], y: a * b > 0 ? 1 : 0 };
  });
}

function spirals(n = 240, seed = 3) {
  const rng = makeRng(seed);
  const turns = 1.4;
  return Array.from({ length: n }, (_, i) => {
    const cls = i % 2;
    const k = Math.floor(i / 2) / (n / 2);           // 0 → 1 along the arm
    const t = k * turns * Math.PI * 2;
    const r = 0.08 + k * 0.84;
    const ang = t + cls * Math.PI;
    return { x: [r * Math.cos(ang) + rng.normal() * 0.02, r * Math.sin(ang) + rng.normal() * 0.02], y: cls };
  });
}
