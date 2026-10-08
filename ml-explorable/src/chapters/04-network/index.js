import { createPlot, scale, cssVar } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { createTimeline } from '../../lib/timeline.js';
import { h, button, slider, segmented, readout, fmt } from '../../lib/ui.js';
import { MLP } from '../../ml/mlp.js';
import { DATASETS } from '../../ml/datasets.js';
import './chapter.css';

const G = 44;                 // resolution of the prediction grid behind the points
const STEPS_PER_FRAME = 4;
const MAX_STEPS = 6000;

export default {
  id: 'a-neural-network',
  title: 'A neural network',
  mount(root) {
    const cfg = { dataset: 'xor', hidden: 4, layers: 1, lr: 0.3, seed: 1 };
    let data, X, Y, net, step = 0, grid, done = false, checkpoints = [];

    root.append(h('div', { class: 'prose reveal', html: `
      <p>One neuron draws one straight line. So let's use <strong>several</strong> neurons, each drawing its own line, and feed
      their answers into a final neuron that combines them. That's a <span class="term term--model">neural network</span>.</p>
      <p>Below, each dot is a <span class="term term--data">data point</span> from one of two groups — amber circles or green triangles.
      The network has to learn which group any spot on the map belongs to. The background shows its current guess, and the
      <span class="term term--model">glowing line</span> is where it changes its mind. "Four corners" is the tricky puzzle from the last chapter.</p>
      <p>Press play and watch the boundary form.</p>` }));

    const lab = h('div', { class: 'lab reveal' });
    root.append(lab);
    const gridEl = h('div', { class: 'lab__grid lab__grid--split' });
    lab.append(gridEl);
    const left = h('div'), right = h('div', { class: 'ch4-side' });
    gridEl.append(left, right);

    // ---------- main map ----------
    const off = document.createElement('canvas');
    off.width = G; off.height = G;
    const offCtx = off.getContext('2d');
    const img = offCtx.createImageData(G, G);
    const toWorld = (i) => -1.1 + (2.2 * (i + 0.5)) / G;

    const map = createPlot(left, {
      aspect: 1, min: 280, max: 560,
      draw(ctx, w, hgt) {
        if (!grid) return;
        const sx = scale(-1.1, 1.1, 0, w), sy = scale(-1.1, 1.1, hgt, 0);
        // background: the network's prediction everywhere
        const A = [245, 181, 68], B = [79, 209, 165], base = [14, 20, 32];
        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
          const p = grid.out[j * G + i];
          const k = Math.min(1, Math.abs(p - 0.5) * 2) * 0.5;
          const c = p >= 0.5 ? B : A;
          const o = ((G - 1 - j) * G + i) * 4;
          img.data[o] = base[0] + (c[0] - base[0]) * k;
          img.data[o + 1] = base[1] + (c[1] - base[1]) * k;
          img.data[o + 2] = base[2] + (c[2] - base[2]) * k;
          img.data[o + 3] = 255;
        }
        offCtx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(off, 0, 0, w, hgt);
        // decision boundary (p = 0.5) via marching squares
        const model = cssVar('--model');
        ctx.save();
        ctx.strokeStyle = model; ctx.lineWidth = 2.5; ctx.shadowColor = model; ctx.shadowBlur = 12;
        ctx.beginPath();
        contour(grid.out, G, 0.5, (x0, y0, x1, y1) => {
          ctx.moveTo(sx(toWorld(x0)), sy(toWorld(y0)));
          ctx.lineTo(sx(toWorld(x1)), sy(toWorld(y1)));
        });
        ctx.stroke();
        ctx.restore();
        // points: shape + colour encode the group
        const ca = cssVar('--data'), cb = cssVar('--data-2'), bg = cssVar('--bg');
        for (const p of data) {
          const x = sx(p.x[0]), y = sy(p.x[1]);
          const wrong = (net.predict1(p.x) >= 0.5 ? 1 : 0) !== p.y;
          ctx.lineWidth = 1.5; ctx.strokeStyle = wrong ? '#fff' : bg;
          ctx.beginPath();
          if (p.y) { ctx.moveTo(x, y - 5.5); ctx.lineTo(x + 5, y + 3.5); ctx.lineTo(x - 5, y + 3.5); ctx.closePath(); ctx.fillStyle = cb; }
          else { ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fillStyle = ca; }
          ctx.fill(); ctx.stroke();
        }
      },
    });
    map.canvas.setAttribute('role', 'img');
    map.canvas.setAttribute('aria-label', 'Two groups of points with the network\'s predicted regions shaded behind them and its decision boundary drawn as a glowing line.');

    // ---------- side: readouts + network diagram ----------
    const stepOut = readout('Step', 'learn'), lossOut = readout('Error', 'error'), accOut = readout('Accuracy', 'model');
    right.append(h('div', { class: 'readouts' }, stepOut.el, lossOut.el, accOut.el));
    const say = h('p', { class: 'ch4-say', 'aria-live': 'polite' });
    right.append(say);
    right.append(h('p', { class: 'caption', style: 'margin:4px 0 6px' }, 'Inside the network: each square is one neuron, showing what it responds to across the whole map.'));
    const diagram = createPlot(right, { aspect: 0.8, min: 200, max: 330, draw: drawDiagram });
    diagram.canvas.setAttribute('role', 'img');
    diagram.canvas.setAttribute('aria-label', 'Network diagram: inputs, hidden neurons shown as small maps, and the output, connected by weighted lines.');

    // ---------- controls ----------
    const playBtn = button('Play', () => toggle(), { primary: true, icon: '▶' });
    const stepBtn = button('Step', () => { loop.pause(); resumeFromTimeline(); train(1); }, { icon: '⇥' });
    const resetBtn = button('New start', () => { cfg.seed++; rebuild(); }, { icon: '↺', ariaLabel: 'Restart with new random weights' });
    const dsSeg = segmented(Object.entries(DATASETS).map(([k, d]) => [k, d.label]), cfg.dataset, (k) => { cfg.dataset = k; rebuild(); }, 'Dataset');
    const layerSeg = segmented([[1, '1 layer'], [2, '2 layers']], cfg.layers, (k) => { cfg.layers = k; rebuild(); }, 'Hidden layers');
    const hiddenSl = slider({ label: 'Neurons per layer', min: 1, max: 12, step: 1, value: cfg.hidden, format: (v) => String(v), onInput: (v) => { cfg.hidden = v; rebuild(); } });
    const lrSl = slider({ label: 'Learning rate', min: 0.01, max: 1, step: 0.01, value: cfg.lr, accent: 'var(--learn)', onInput: (v) => { cfg.lr = v; } });
    lab.append(
      h('div', { class: 'controls' }, playBtn, stepBtn, resetBtn, dsSeg.el),
      h('div', { class: 'controls' }, layerSeg.el, hiddenSl.el, lrSl.el));

    const tl = createTimeline(lab, {
      title: 'Training timeline — error over time',
      maxPoints: 300,
      onScrubStart: () => loop.pause(),
      onView: (st) => { net.setState(st); refresh(); },
    });

    // ---------- training ----------
    const loop = createLoop(lab, () => {
      train(STEPS_PER_FRAME);
      if (done) return false;
    });
    loop.onChange((p) => playBtn.setLabel(p ? 'Pause' : 'Play', p ? '❚❚' : '▶'));

    function rebuild() {
      loop.pause();
      data = DATASETS[cfg.dataset].make();
      X = data.map((p) => p.x); Y = data.map((p) => [p.y]);
      const sizes = [2, ...Array(cfg.layers).fill(cfg.hidden), 1];
      net = new MLP(sizes, { seed: cfg.seed });
      step = 0; done = false; checkpoints = [];
      tl.reset();
      tl.record(0, { loss: net.loss(X, Y) }, net.getState(), true);
      refresh();
    }
    function resumeFromTimeline() {
      const past = tl.rewindHere();
      if (past) { net.setState(past.state); step = past.step; done = false; checkpoints = []; }
    }
    function toggle() {
      if (loop.playing) { loop.pause(); return; }
      if (done) { cfg.seed++; rebuild(); }
      resumeFromTimeline();
      loop.play();
    }
    function train(n) {
      for (let i = 0; i < n; i++) { net.step(X, Y, cfg.lr, 0.9); step++; }
      const loss = net.loss(X, Y);
      tl.record(step, { loss }, net.getState());
      if (!Number.isFinite(loss)) done = true;
      if (accuracy() === 1 && loss < 0.03) done = true;
      if (step >= MAX_STEPS) done = true;
      // Give up once the error has clearly stopped improving (a plateau).
      if (step % 500 < n) checkpoints.push(loss);
      const k = checkpoints.length;
      if (k >= 4 && accuracy() < 1 && loss > checkpoints[k - 4] * 0.97) done = true;
      refresh();
    }
    const accuracy = () => data.reduce((n, p) => n + ((net.predict1(p.x) >= 0.5 ? 1 : 0) === p.y), 0) / data.length;

    function computeGrid() {
      const L = net.L, hiddenActs = [];
      for (let l = 1; l < L; l++) hiddenActs.push(Array.from({ length: net.sizes[l] }, () => new Float32Array(G * G)));
      const out = new Float32Array(G * G);
      const x = [0, 0];
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        x[0] = toWorld(i); x[1] = toWorld(j);
        out[j * G + i] = net.forward(x)[0];
        for (let l = 1; l < L; l++) for (let n = 0; n < net.sizes[l]; n++) hiddenActs[l - 1][n][j * G + i] = net.acts[l][n];
      }
      grid = { out, hiddenActs };
    }

    function refresh() {
      computeGrid();
      const loss = net.loss(X, Y), acc = accuracy();
      stepOut.set(step.toLocaleString());
      lossOut.set(fmt(loss, 3));
      accOut.set(`${Math.round(acc * 100)}%`);
      const params = net.paramCount;
      if (!tl.live) say.textContent = 'Looking back in time. Scrub to watch the boundary change, or press play to continue training from this moment.';
      else if (done && acc === 1) say.textContent = `Every point classified correctly after ${step.toLocaleString()} steps, using ${params} adjustable numbers.`;
      else if (done) say.textContent = `Gave up at ${Math.round(acc * 100)}% after ${step.toLocaleString()} steps. This network is too small for this pattern — try more neurons or another layer.`;
      else if (step === 0) say.textContent = `${params} weights and biases, all random. Press play to train.`;
      else say.textContent = 'Training: every step nudges all the weights a little downhill on the error landscape.';
      map.draw();
      diagram.draw();
    }

    function drawDiagram(ctx, w, hgt) {
      if (!grid) return;
      const sizes = net.sizes, L = net.L;
      const maxN = Math.max(...sizes.slice(1, -1), 2);
      const T = Math.max(10, Math.min(30, (hgt - 20) / maxN - 6));
      const OUT = Math.min(64, T * 2.2);
      const x0 = 18, x1 = w - OUT / 2 - 8;
      const colX = sizes.map((_, l) => x0 + ((x1 - x0) * l) / L);
      const ys = sizes.map((n, l) => {
        const sz = l === 0 ? 12 : l === L ? OUT : T;
        const gap = l === 0 ? 50 : sz + 6;
        const total = (n - 1) * gap;
        return Array.from({ length: n }, (_, i) => hgt / 2 - total / 2 + i * gap);
      });
      // weights
      const modelC = cssVar('--model'), errC = cssVar('--error');
      for (let l = 0; l < L; l++) {
        const W = net.W[l], nIn = sizes[l];
        for (let o = 0; o < sizes[l + 1]; o++) for (let i = 0; i < nIn; i++) {
          const v = W[o * nIn + i];
          ctx.strokeStyle = v >= 0 ? modelC : errC;
          ctx.globalAlpha = Math.min(0.9, 0.12 + Math.abs(v) / 4);
          ctx.lineWidth = Math.min(5, 0.4 + Math.abs(v) * 0.9);
          ctx.beginPath(); ctx.moveTo(colX[l], ys[l][i]); ctx.lineTo(colX[l + 1], ys[l + 1][o]); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      // inputs
      ctx.font = '11px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
      ys[0].forEach((y, i) => {
        ctx.beginPath(); ctx.arc(colX[0], y, 9, 0, Math.PI * 2); ctx.fillStyle = cssVar('--bg-inset'); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = cssVar('--data'); ctx.stroke();
        ctx.fillStyle = cssVar('--ink-2'); ctx.fillText(i ? 'y' : 'x', colX[0], y + 4);
      });
      // hidden neurons as thumbnails of their activation across the map
      for (let l = 1; l < L; l++) ys[l].forEach((y, n) => thumb(ctx, grid.hiddenActs[l - 1][n], colX[l] - T / 2, y - T / 2, T, true));
      thumb(ctx, grid.out, colX[L] - OUT / 2, ys[L][0] - OUT / 2, OUT, false);
    }

    // small canvas reused for thumbnails
    const tc = document.createElement('canvas'); tc.width = G; tc.height = G;
    const tctx = tc.getContext('2d'); const timg = tctx.createImageData(G, G);
    function thumb(ctx, vals, x, y, size, tanh) {
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const v = vals[j * G + i];
        const k = tanh ? (v + 1) / 2 : v;
        const o = ((G - 1 - j) * G + i) * 4;
        if (tanh) { timg.data[o] = 14 + 63 * k; timg.data[o + 1] = 20 + 206 * k; timg.data[o + 2] = 32 + 223 * k; }
        else {
          const c = v >= 0.5 ? [79, 209, 165] : [245, 181, 68]; const a = Math.min(1, Math.abs(v - 0.5) * 2) * 0.8;
          timg.data[o] = 14 + (c[0] - 14) * a; timg.data[o + 1] = 20 + (c[1] - 20) * a; timg.data[o + 2] = 32 + (c[2] - 32) * a;
        }
        timg.data[o + 3] = 255;
      }
      tctx.putImageData(timg, 0, 0);
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, y, size, size, 4); ctx.clip();
      ctx.imageSmoothingEnabled = true; ctx.drawImage(tc, x, y, size, size);
      ctx.restore();
      ctx.lineWidth = 1; ctx.strokeStyle = cssVar('--line-strong');
      ctx.beginPath(); ctx.roundRect(x, y, size, size, 4); ctx.stroke();
    }

    root.append(h('div', { class: 'prose reveal', html: `
      <p>Look at the little squares in the middle of the diagram. Each <strong>hidden neuron</strong> still only draws one soft straight edge
      — you can see it as the boundary between dark and bright. The output neuron then mixes those edges together, and
      mixing straight edges is enough to carve out circles, corners and even spirals.</p>
      <p>Every coloured line between neurons is a weight, and <strong>all</strong> of them were adjusted together by the same
      downhill-stepping you met in chapter 2. The trick for working out which way to nudge each weight is called
      <span class="term term--learn">backpropagation</span>: the error at the output is passed backwards through the network,
      so each weight learns how much it was to blame.</p>
      <p>Try the spirals with 4 neurons, then with 8. Too few neurons and the network simply can't draw a shape that complicated —
      the timeline flattens out well above zero. Stacking a second layer usually learns it faster: this is the "deep" in
      <span class="term term--model">deep learning</span>.</p>` }));

    rebuild();
    (window.__ml ??= {}).ch4 = {
      get step() { return step; }, get done() { return done; }, accuracy, get playing() { return loop.playing; },
      loss: () => net.loss(X, Y), timeline: tl,
    };
  },
};

/** Marching squares: calls seg(x0,y0,x1,y1) in grid coordinates for the iso-line of `v` at `level`. */
function contour(v, n, level, seg) {
  const at = (i, j) => v[j * n + i];
  const lerp = (a, b) => (level - a) / (b - a);
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    const code = (a > level) | ((b > level) << 1) | ((c > level) << 2) | ((d > level) << 3);
    if (code === 0 || code === 15) continue;
    const pts = [];
    if ((a > level) !== (b > level)) pts.push([i + lerp(a, b), j]);
    if ((b > level) !== (c > level)) pts.push([i + 1, j + lerp(b, c)]);
    if ((c > level) !== (d > level)) pts.push([i + 1 - lerp(c, d), j + 1]);
    if ((d > level) !== (a > level)) pts.push([i, j + 1 - lerp(d, a)]);
    for (let k = 0; k + 1 < pts.length; k += 2) seg(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]);
  }
}
