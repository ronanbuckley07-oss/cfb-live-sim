import { createPlot, scale, drawGrid, dot, cssVar } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { createTimeline } from '../../lib/timeline.js';
import { h, button, slider, readout, fmtAuto } from '../../lib/ui.js';
import { sampleData, fitPoly, predict, mse, truth } from '../../ml/poly.js';
import './chapter.css';

const MAX_DEG = 13;
const START_N = 12;
const POINTS_PER_SEC = 4;

export default {
  id: 'memorizing-vs-learning',
  title: 'Memorizing vs. learning',
  mount(root) {
    let seed = 8;
    let { pool, test } = sampleData(seed);
    let n = START_N, degree = 3, showTruth = false;
    let sweep = [], w = [];

    root.append(h('div', { class: 'prose reveal', html: `
      <p>So far, a better fit has always meant a better model. Here's where that stops being true.</p>
      <p>The <span class="term term--data">solid dots</span> are days the model learns from. The <span class="term term--data">hollow dots</span>
      are days we hide from it, and only use afterwards to check its predictions — like a surprise exam.</p>
      <p>Drag the <strong>complexity</strong> slider to give the model more freedom to bend. Watch both error numbers.</p>` }));

    const lab = h('div', { class: 'lab reveal' });
    root.append(lab);
    const gridEl = h('div', { class: 'lab__grid lab__grid--split' });
    lab.append(gridEl);
    const left = h('div'), right = h('div', { class: 'ch5-side' });
    gridEl.append(left, right);

    // ---------- fit plot ----------
    const fitPlot = createPlot(left, {
      aspect: 0.66, min: 260, max: 500,
      draw(ctx, wd, hgt) {
        const sx = scale(-1, 1, 12, wd - 12), sy = scale(-1.6, 1.6, hgt - 12, 12);
        drawGrid(ctx, sx, sy, { xTicks: [-0.5, 0, 0.5], yTicks: [-1, 0, 1], w: wd, h: hgt, labels: false });
        const data = cssVar('--data'), model = cssVar('--model');
        if (showTruth) {
          ctx.setLineDash([3, 5]); ctx.strokeStyle = cssVar('--ink-2'); ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= 200; i++) { const x = -1 + i / 100; i ? ctx.lineTo(sx(x), sy(truth(x))) : ctx.moveTo(sx(x), sy(truth(x))); }
          ctx.stroke(); ctx.setLineDash([]);
        }
        for (const p of test) dot(ctx, sx(p.x), sy(p.y), 4, data, { glow: 0, hollow: true });
        // the model, clipped to the plot
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, wd, hgt); ctx.clip();
        ctx.strokeStyle = model; ctx.lineWidth = 3; ctx.shadowColor = model; ctx.shadowBlur = 14; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 400; i++) {
          const x = -1 + i / 200;
          const y = Math.max(-40, Math.min(40, predict(w, x)));
          i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y));
        }
        ctx.stroke();
        ctx.restore();
        for (const p of pool.slice(0, n)) dot(ctx, sx(p.x), sy(p.y), 5, data, { glow: 8 });
        if (zone() === 'memorizing') {
          ctx.strokeStyle = cssVar('--error'); ctx.lineWidth = 3;
          ctx.strokeRect(1.5, 1.5, wd - 3, hgt - 3);
        }
      },
    });
    fitPlot.canvas.setAttribute('role', 'img');
    fitPlot.canvas.setAttribute('aria-label', 'Training points, hidden test points, and the fitted curve.');
    const legend = h('div', { class: 'ch5-legend', html:
      '<span><i class="swatch" style="background:var(--data)"></i>learned from</span>' +
      '<span><i class="swatch swatch--hollow"></i>hidden test days</span>' +
      '<span><i class="ln" style="background:var(--model)"></i>model</span>' });
    left.append(legend);

    // ---------- error vs complexity ----------
    const trainOut = readout('Error on learned days', 'data');
    const testOut = readout('Error on hidden days', 'error');
    const verdict = h('div', { class: 'verdict', 'aria-live': 'polite' });
    right.append(h('div', { class: 'readouts' }, trainOut.el, testOut.el), verdict);
    right.append(h('p', { class: 'caption', style: 'margin:6px 0 4px' }, 'Both errors for every complexity (log scale):'));
    const sweepPlot = createPlot(right, {
      aspect: 0.62, min: 180, max: 260,
      draw(ctx, wd, hgt) {
        if (!sweep.length) return;
        const lo = 1e-3, hi = Math.max(10, ...sweep.map((s) => s.test));
        const sx = scale(0, MAX_DEG, 14, wd - 14);
        const ly = (v) => Math.log10(Math.max(lo, Math.min(hi, v)));
        const sy = scale(Math.log10(lo), Math.log10(hi), hgt - 22, 10);
        const errC = cssVar('--error'), dataC = cssVar('--data'), ink3 = cssVar('--ink-3');
        // memorizing zone: complexity where hidden-day error is far above its best
        const best = Math.min(...sweep.map((s) => s.test));
        ctx.fillStyle = 'rgba(255,93,115,0.10)';
        sweep.forEach((s, d) => { if (s.test > best * 2.5 && d > sweep.findIndex((t) => t.test === best)) ctx.fillRect(sx(d - 0.5), 0, sx(1) - sx(0), hgt - 22); });
        ctx.fillStyle = ink3; ctx.font = '10px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
        for (const d of [0, 3, 6, 9, 12]) ctx.fillText(String(d), sx(d), hgt - 6);
        const line = (key, col, dash) => {
          ctx.save(); ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 6;
          ctx.beginPath(); sweep.forEach((s, d) => (d ? ctx.lineTo(sx(d), sy(ly(s[key]))) : ctx.moveTo(sx(d), sy(ly(s[key]))))); ctx.stroke(); ctx.restore();
        };
        line('train', dataC, [5, 4]);
        line('test', errC, []);
        // current complexity
        ctx.strokeStyle = cssVar('--learn'); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx(degree), 4); ctx.lineTo(sx(degree), hgt - 22); ctx.stroke();
        dot(ctx, sx(degree), sy(ly(sweep[degree].test)), 4.5, errC, { glow: 8 });
        dot(ctx, sx(degree), sy(ly(sweep[degree].train)), 4.5, dataC, { glow: 8 });
        // direct labels
        ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'right';
        ctx.fillStyle = errC; ctx.fillText('hidden days', wd - 16, sy(ly(sweep[MAX_DEG].test)) + (sweep[MAX_DEG].test > hi * 0.5 ? 14 : -8));
        const yTest = sy(ly(sweep[MAX_DEG].test)), yTrain = sy(ly(sweep[MAX_DEG].train));
        ctx.fillStyle = dataC; ctx.fillText('learned days', wd - 16, Math.abs(yTest - yTrain) < 18 ? yTrain + 16 : yTrain - 6);
        ctx.textAlign = 'left'; ctx.fillStyle = ink3; ctx.fillText('complexity →', 16, hgt - 26);
      },
    });
    sweepPlot.canvas.setAttribute('role', 'img');
    sweepPlot.canvas.setAttribute('aria-label', 'Chart of training error and test error against model complexity.');

    // ---------- controls ----------
    const degSl = slider({ label: 'Complexity', min: 0, max: MAX_DEG, step: 1, value: degree, format: (v) => String(v), onInput: (v) => { degree = v; refit(); rebuildHistory(); } });
    const truthBtn = button('Reveal the true pattern', () => { showTruth = !showTruth; truthBtn.setLabel(showTruth ? 'Hide the true pattern' : 'Reveal the true pattern', '◌'); fitPlot.draw(); }, { icon: '◌' });
    const newBtn = button('New days', () => { loop.pause(); seed++; ({ pool, test } = sampleData(seed)); n = START_N; tl.reset(); recordNow(true); refit(); }, { icon: '⤨', ariaLabel: 'Draw a fresh random sample of days' });
    const moreBtn = button('Collect more data', () => {
      if (loop.playing) { loop.pause(); return; }
      const past = tl.rewindHere();
      if (past) n = past.state.n;
      if (n >= pool.length) { n = START_N; tl.reset(); recordNow(true); }
      loop.play();
    }, { primary: true, icon: '▶' });
    lab.append(h('div', { class: 'controls' }, degSl.el), h('div', { class: 'controls' }, moreBtn, newBtn, truthBtn));

    let acc = 0;
    const loop = createLoop(lab, (dt) => {
      acc += dt * POINTS_PER_SEC;
      if (acc < 1) return;
      acc = 0;
      n++;
      refit();
      recordNow();
      if (n >= pool.length) return false;
    });
    loop.onChange((p) => moreBtn.setLabel(p ? 'Pause' : 'Collect more data', p ? '❚❚' : '▶'));

    const tl = createTimeline(lab, {
      title: 'Data timeline — errors as more days are collected',
      unit: 'day',
      logY: true,
      series: [
        { key: 'train', label: 'learned', color: '--data', dash: true },
        { key: 'test', label: 'hidden', color: '--error' },
      ],
      onScrubStart: () => loop.pause(),
      onView: (st) => { n = st.n; refit(); },
    });
    // Days collected so far, so the timeline can be recomputed when the complexity changes.
    let history = [];
    function recordNow(force = false) {
      if (force) history = [];
      history.push(n);
      tl.record(n, { train: sweep[degree].train, test: sweep[degree].test }, { n }, force);
    }
    function errorsAt(k) {
      const train = pool.slice(0, k), wd = fitPoly(train, degree);
      return { train: mse(wd, train), test: mse(wd, test) };
    }
    function rebuildHistory() {
      if (loop.playing) loop.pause();
      const viewing = n;
      history = history.filter((k) => k <= viewing);
      tl.reset();
      history.forEach((k, i) => tl.record(k, errorsAt(k), { n: k }, true));
    }

    function zone() {
      if (!sweep.length) return '';
      const best = Math.min(...sweep.map((s) => s.test));
      const bestD = sweep.findIndex((s) => s.test === best);
      const s = sweep[degree];
      if (s.test <= best * 1.6) return 'good';
      return degree < bestD ? 'simple' : 'memorizing';
    }

    function refit() {
      const train = pool.slice(0, n);
      sweep = Array.from({ length: MAX_DEG + 1 }, (_, d) => { const wd = fitPoly(train, d); return { w: wd, train: mse(wd, train), test: mse(wd, test) }; });
      w = sweep[degree].w;
      trainOut.set(fmtAuto(sweep[degree].train));
      testOut.set(fmtAuto(sweep[degree].test));
      const z = zone();
      verdict.className = `verdict verdict--${z}`;
      verdict.innerHTML = {
        simple: '<strong>Too simple.</strong> It misses the pattern on every day, seen or not.',
        good: '<strong>Just right.</strong> It captures the pattern and predicts the hidden days well.',
        memorizing: `<strong>Memorizing!</strong> It threads through the ${n} learned days, wiggles included, and fails the hidden ones.`,
      }[z];
      fitPlot.draw();
      sweepPlot.draw();
    }

    root.append(h('div', { class: 'prose reveal', html: `
      <p>At high complexity the curve passes almost exactly through every learned dot, so its error on them drops toward zero.
      But those dots contain random noise — a cold snap, a festival — and the curve bends to fit that noise too. On the
      hidden days it's wildly wrong. That's <span class="term term--error">overfitting</span>: memorizing the examples instead of
      learning the pattern behind them.</p>
      <p>Now set complexity high and press <strong>Collect more data</strong>. With more days to learn from, there's much less room to
      memorize, and even a flexible model settles down to the real pattern. Scrub the timeline back to see the moment it changes.</p>
      <p>This is why machine-learning researchers always keep a <span class="term term--data">test set</span> locked away, and why
      more data is often the best medicine. A model is only useful if it does well on examples it has never seen.</p>` }));

    refit();
    recordNow(true);
    (window.__ml ??= {}).ch5 = { get n() { return n; }, get sweep() { return sweep; }, setDegree: (d) => { degree = d; degSl.set(d); refit(); }, zone, get playing() { return loop.playing; }, timeline: tl };
  },
};
