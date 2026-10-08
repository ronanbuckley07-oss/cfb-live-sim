import { createPlot, scale, drawGrid, dot, cssVar } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { createTimeline } from '../../lib/timeline.js';
import { reducedMotion } from '../../lib/motion.js';
import { h, button, slider, segmented, readout, fmt, fmtAuto } from '../../lib/ui.js';
import { iceCreamData, LinearModel } from '../../ml/linear.js';
import './chapter.css';

// Loss as a function of the slope only: the line pivots around the centre of
// the data, where the best intercept sits. So this curve is an exact slice
// through the real error surface, not an illustration.
const A0 = -1.6, A1 = 2.6;          // slope range shown (scaled units)
const START_A = -1.25;
const STEPS_PER_SEC = 6;
const PRESETS = { slow: 0.02, good: 0.15, wild: 1.04 };

export default {
  id: 'getting-less-wrong',
  title: 'Learning by getting less wrong',
  mount(root) {
    const model = new LinearModel(iceCreamData());
    model.c = 0;
    model.a = START_A;
    const L = (a) => model.loss(a, 0);
    const dL = (a) => model.grad(a, 0)[0] * model.ys * model.ys; // gradient in the same units as the plotted loss
    const Lmax = L(A0);

    root.append(h('div', { class: 'prose reveal', html: `
      <p>Every possible line has an error score. So instead of looking at one line at a time, we can draw
      <strong>all of them at once</strong>: tilt the line from steep-downhill to steep-uphill and plot the error for each tilt.</p>
      <p>That gives the <span class="term term--error">red curve</span> below — a landscape of wrongness.
      The best line sits at the bottom of the valley. The <span class="term term--learn">violet ball</span> is our current line.</p>
      <p>The computer can't see the whole landscape. All it can feel is <strong>how steep the ground is right under the ball</strong>
      (the dashed line). So it does the obvious thing: take a step downhill, then feel again. Press play.</p>` }));

    const lab = h('div', { class: 'lab reveal' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid lab__grid--split' });
    lab.append(grid);
    const left = h('div'), right = h('div', { class: 'ch2-side' });
    grid.append(left, right);

    let step = 0;
    let trail = [START_A];
    let anim = null;              // { from, to, t } tween between steps
    let status = 'ready';         // ready | running | converged | diverged
    let lr = PRESETS.good;
    const displayA = () => (anim ? anim.from + (anim.to - anim.from) * easeOut(anim.t) : model.a);
    const easeOut = (t) => 1 - (1 - t) * (1 - t);
    const clampA = (a) => Math.max(A0, Math.min(A1, a));

    // --- the landscape ---
    let sx, sy;
    const plot = createPlot(left, {
      aspect: 0.62, min: 260, max: 480,
      draw(ctx, w, hgt) {
        sx = scale(A0, A1, 30, w - 16);
        sy = scale(-Lmax * 0.1, Lmax * 1.05, hgt - 26, 16);
        const xt = [-1, 0, 1, 2];
        drawGrid(ctx, sx, sy, { xTicks: xt, yTicks: [], w, h: hgt, labels: false });
        const ink3 = cssVar('--ink-3'), err = cssVar('--error'), learn = cssVar('--learn');
        ctx.fillStyle = ink3; ctx.font = '11px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
        for (const a of xt) ctx.fillText(fmt(model.realSlope(a), 1), sx(a), hgt - 8);
        ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText('tilt of the line (cones per °C) →', w - 16, 26);
        ctx.textAlign = 'left'; ctx.fillText('↑ error', 34, 26);

        // valley
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) { const a = A0 + ((A1 - A0) * i) / 200; i ? ctx.lineTo(sx(a), sy(L(a))) : ctx.moveTo(sx(a), sy(L(a))); }
        ctx.save();
        ctx.strokeStyle = err; ctx.lineWidth = 2.5; ctx.shadowColor = err; ctx.shadowBlur = 12; ctx.stroke();
        ctx.restore();
        ctx.lineTo(sx(A1), hgt); ctx.lineTo(sx(A0), hgt); ctx.closePath();
        const g = ctx.createLinearGradient(0, 0, 0, hgt);
        g.addColorStop(0, 'rgba(255,93,115,0.10)'); g.addColorStop(1, 'rgba(255,93,115,0)');
        ctx.fillStyle = g; ctx.fill();

        // bottom of the valley
        const best = model.optimum().a;
        ctx.setLineDash([2, 4]); ctx.strokeStyle = ink3; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx(best), sy(L(best))); ctx.lineTo(sx(best), hgt - 26); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = ink3; ctx.textAlign = 'center'; ctx.font = '11px Inter, sans-serif';
        ctx.fillText('best line', sx(best), sy(L(best)) + 24);

        // trail of past positions (shows zig-zagging when the step is too big)
        const pts = trail.slice(-40).map((a) => [sx(clampA(a)), sy(Math.min(L(a), Lmax * 1.05))]);
        ctx.strokeStyle = 'rgba(167,139,250,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        pts.forEach(([x, y], i) => dot(ctx, x, y, 2.5, `rgba(167,139,250,${0.25 + (0.5 * i) / pts.length})`, { glow: 0 }));

        const a = displayA();
        const offChart = a < A0 || a > A1 || L(a) > Lmax * 1.05;
        const bx = sx(clampA(a)), by = sy(Math.min(L(a), Lmax * 1.05));
        if (!offChart && !anim) {
          // tangent: the local steepness the computer can feel
          const k = dL(a);
          const run = 0.35;
          ctx.setLineDash([6, 5]); ctx.strokeStyle = learn; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(sx(a - run), sy(L(a) - k * run)); ctx.lineTo(sx(a + run), sy(L(a) + k * run)); ctx.stroke(); ctx.setLineDash([]);
          // the step it is about to take
          const next = a - lr * model.grad(a, 0)[0];
          if (Math.abs(sx(next) - bx) > 6) {
            const ax = sx(clampA(next));
            ctx.save(); ctx.strokeStyle = learn; ctx.fillStyle = learn; ctx.lineWidth = 2; ctx.shadowColor = learn; ctx.shadowBlur = 8;
            const ay = by - 22, dir = Math.sign(ax - bx);
            ctx.beginPath(); ctx.moveTo(bx, ay); ctx.lineTo(ax - dir * 6, ay); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - dir * 9, ay - 5); ctx.lineTo(ax - dir * 9, ay + 5); ctx.closePath(); ctx.fill();
            ctx.restore();
          }
        }
        dot(ctx, bx, by, 9, learn, { glow: 22 });
        if (offChart) {
          ctx.fillStyle = learn; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = a > A1 ? 'right' : 'left';
          ctx.fillText('off the chart!', bx + (a > A1 ? -14 : 14), by + 4);
        }
      },
    });
    plot.canvas.setAttribute('role', 'img');
    plot.canvas.setAttribute('aria-label', 'Error curve for every tilt of the line, with a ball showing the current line rolling downhill.');

    // --- the line itself (small inset) ---
    const data = model.points;
    const inset = createPlot(right, {
      aspect: 0.62, min: 160, max: 240,
      draw(ctx, w, hgt) {
        const ix = scale(8, 37, 10, w - 10), iy = scale(-5, 115, hgt - 10, 10);
        drawGrid(ctx, ix, iy, { xTicks: [10, 20, 30], yTicks: [0, 50, 100], w, h: hgt, labels: false });
        const a = displayA();
        const errC = cssVar('--error'), mC = cssVar('--model');
        ctx.strokeStyle = errC; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
        for (const p of data) { ctx.beginPath(); ctx.moveTo(ix(p.x), iy(p.y)); ctx.lineTo(ix(p.x), iy(model.predict(p.x, a, 0))); ctx.stroke(); }
        ctx.globalAlpha = 1;
        ctx.save(); ctx.strokeStyle = mC; ctx.lineWidth = 2.5; ctx.shadowColor = mC; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(ix(8), iy(model.predict(8, a, 0))); ctx.lineTo(ix(37), iy(model.predict(37, a, 0))); ctx.stroke(); ctx.restore();
        for (const p of data) dot(ctx, ix(p.x), iy(p.y), 3.5, cssVar('--data'), { glow: 6 });
      },
    });
    inset.canvas.setAttribute('role', 'img');
    inset.canvas.setAttribute('aria-label', 'The line that the ball represents, drawn over the data.');
    right.append(h('div', { class: 'caption' }, 'The line the ball stands for, pivoting as it learns.'));

    const stepOut = readout('Step', 'learn');
    const errOut = readout('Error', 'error');
    const gradOut = readout('Steepness', 'learn');
    right.append(h('div', { class: 'readouts' }, stepOut.el, errOut.el, gradOut.el));
    const say = h('p', { class: 'ch2-say', 'aria-live': 'polite' });
    right.append(say);

    // --- controls ---
    const lrSlider = slider({
      label: 'Step size', min: Math.log10(0.005), max: Math.log10(1.2), step: 0.001, value: Math.log10(lr),
      accent: 'var(--learn)', format: (v) => (10 ** v).toFixed(3),
      onInput: (v) => { lr = 10 ** v; presets.set(null); plot.draw(); },
    });
    const presets = segmented([['slow', 'Too small'], ['good', 'Just right'], ['wild', 'Too big']], 'good', (k) => {
      lr = PRESETS[k]; lrSlider.set(Math.log10(lr)); restart();
    }, 'Step size presets');
    const playBtn = button('Play', () => toggle(), { primary: true, icon: '▶' });
    const stepBtn = button('One step', () => { loop.pause(); prepareResume(); doStep(); }, { icon: '⇥' });
    const resetBtn = button('Reset', () => restart(), { icon: '↺' });
    lab.append(h('div', { class: 'controls' }, playBtn, stepBtn, resetBtn, presets.el), h('div', { class: 'controls' }, lrSlider.el));

    // --- training ---
    function doStep() {
      if (status === 'diverged' || status === 'converged') return false;
      const from = model.a;
      model.step(lr);
      model.c = 0;
      step++;
      trail.push(model.a);
      anim = reducedMotion() ? null : { from, to: model.a, t: 0 };
      tl.record(step, { loss: L(model.a) }, { a: model.a, trail: trail.slice(-40) });
      const g = Math.abs(model.grad(model.a, 0)[0]);
      if (!Number.isFinite(model.a) || Math.abs(model.a) > 40) status = 'diverged';
      else if (g < 2e-3) status = 'converged';
      else status = 'running';
      update();
      return true;
    }

    let acc = 0;
    const loop = createLoop(lab, (dt) => {
      if (anim) { anim.t = Math.min(1, anim.t + dt * STEPS_PER_SEC); if (anim.t >= 1) anim = null; }
      acc += dt * STEPS_PER_SEC;
      if (acc >= 1 && !anim) { acc = 0; if (!doStep()) { draw(); return false; } }
      if (status === 'diverged' || status === 'converged') { if (!anim) { draw(); return false; } }
      draw();
    });
    loop.onChange((p) => playBtn.setLabel(p ? 'Pause' : 'Play', p ? '❚❚' : '▶'));

    function prepareResume() {
      const past = tl.rewindHere();
      if (past) { model.a = past.state.a; trail = past.state.trail.slice(); step = past.step; status = 'running'; anim = null; }
      if (tl.length === 0) tl.record(0, { loss: L(model.a) }, { a: model.a, trail: trail.slice() }, true);
    }
    function toggle() {
      if (loop.playing) { loop.pause(); return; }
      if (status === 'diverged' || status === 'converged') restart(false);
      prepareResume();
      loop.play();
    }
    function restart(redraw = true) {
      loop.pause();
      model.a = START_A; step = 0; trail = [START_A]; anim = null; status = 'ready';
      tl.reset();
      if (redraw) update();
    }

    function draw() { plot.draw(); inset.draw(); }
    function update() {
      stepOut.set(String(step));
      errOut.set(Number.isFinite(L(model.a)) && L(model.a) < 1e7 ? fmt(L(model.a), 0) : '∞');
      const g = dL(model.a);
      gradOut.set(Number.isFinite(g) && Math.abs(g) < 1e7 ? fmtAuto(g) : '∞');
      const msgs = {
        ready: 'Pick a step size and press play.',
        running: lr < 0.06 ? 'Tiny steps: safe, but it will take ages to reach the bottom.'
          : lr > 0.55 ? 'Big steps: it leaps right over the valley floor and zig-zags…'
          : 'Each step: feel the slope, move downhill in proportion to how steep it is.',
        converged: `Reached the bottom in ${step} steps. Try a different step size — or rewind the timeline and change it mid-way.`,
        diverged: 'Each leap overshoots further than the last — the error explodes. This is called diverging.',
      };
      say.textContent = msgs[status];
      draw();
    }

    const tl = createTimeline(lab, {
      title: 'Training timeline — error over time',
      logY: true,
      onScrubStart: () => loop.pause(),
      onView: (s) => { model.a = s.a; trail = s.trail.slice(); anim = null; update(); },
    });

    root.append(h('div', { class: 'prose reveal', html: `
      <p>What you just watched is called <span class="term term--learn">gradient descent</span>. The
      <em>gradient</em> is just the steepness under the ball, and <em>descent</em> means we keep stepping downhill.
      The red curve is called the <span class="term term--error">loss function</span> — "loss" is the field's word for error.</p>
      <p>The step size has a name too: the <span class="term term--learn">learning rate</span>. Too small and learning crawls.
      Too big and every step overshoots the bottom, sometimes so badly that things spiral out of control.
      Picking it well is one of the everyday chores of machine learning.</p>
      <p>Real models have millions of knobs instead of one, so their landscape has millions of directions. But the recipe
      is exactly the same: feel the slope in every direction at once, and step downhill.</p>` }));

    update();
    (window.__ml ??= {}).ch2 = {
      model, get status() { return status; }, get step() { return step; }, timeline: tl,
      setLr(v) { lr = v; lrSlider.set(Math.log10(v)); },
    };
  },
};
