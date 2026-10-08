import { createPlot, scale, dot, cssVar } from './lib/canvas.js';
import { createLoop } from './lib/loop.js';
import { MLP } from './ml/mlp.js';
import { makeRng } from './lib/rng.js';
import { reducedMotion } from './lib/motion.js';

/**
 * Hero background: amber data points drift slowly while a small neural
 * network (1 → 16 → 1) keeps re-fitting them in real time. Not decoration —
 * it's a live preview of everything this page is about.
 */
export function mountHero(header) {
  const host = document.createElement('div');
  host.className = 'hero__bg';
  header.prepend(host);
  const rng = makeRng(11);
  const N = 42;
  const xs = Array.from({ length: N }, (_, i) => -1 + (2 * i) / (N - 1) + (rng() - 0.5) * 0.04);
  const noise = xs.map(() => rng.normal() * 0.08);
  let t = 0;
  const target = (x) => 0.55 * Math.sin(2.6 * x + t) + 0.25 * Math.sin(5.1 * x - 0.7 * t);
  const net = new MLP([1, 16, 1], { output: 'linear', seed: 5 });
  let X = [], Y = [];
  const sample = () => { X = xs.map((x) => [x]); Y = xs.map((x, i) => [target(x) + noise[i]]); };
  sample();
  for (let i = 0; i < 1500; i++) net.step(X, Y, 0.05, 0.9);

  const plot = createPlot(host, {
    fill: true,
    draw(ctx, w, h) {
      const wide = w > 860;
      const left = wide ? w * 0.54 : 0;
      const sx = scale(-1.05, 1.05, left + 20, w - 20);
      const sy = scale(-1.2, 1.2, h * (wide ? 0.82 : 0.98), h * (wide ? 0.3 : 0.84));
      const err = cssVar('--error'), model = cssVar('--model'), data = cssVar('--data');
      ctx.globalAlpha = wide ? 1 : 0.55;
      ctx.strokeStyle = err; ctx.lineWidth = 1.5; ctx.globalAlpha *= 0.6;
      for (let i = 0; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(sx(xs[i]), sy(Y[i][0])); ctx.lineTo(sx(xs[i]), sy(net.predict1([xs[i]]))); ctx.stroke();
      }
      ctx.globalAlpha = wide ? 1 : 0.55;
      ctx.save();
      ctx.strokeStyle = model; ctx.lineWidth = 3; ctx.shadowColor = model; ctx.shadowBlur = 18;
      ctx.beginPath();
      for (let px = 0; px <= 120; px++) {
        const x = -1.05 + (2.1 * px) / 120;
        const y = sy(net.predict1([x]));
        px ? ctx.lineTo(sx(x), y) : ctx.moveTo(sx(x), y);
      }
      ctx.stroke();
      ctx.restore();
      for (let i = 0; i < N; i++) dot(ctx, sx(xs[i]), sy(Y[i][0]), 3.5, data, { glow: 8 });
      ctx.globalAlpha = 1;
    },
  });
  plot.canvas.setAttribute('aria-hidden', 'true');
  if (reducedMotion()) return;
  const loop = createLoop(host, (dt) => {
    t += dt * 0.35;
    sample();
    for (let i = 0; i < 4; i++) net.step(X, Y, 0.05, 0.9);
    plot.draw();
  });
  loop.play();
}
