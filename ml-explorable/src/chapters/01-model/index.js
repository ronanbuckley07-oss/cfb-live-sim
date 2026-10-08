import { createPlot, scale, drawGrid, dot, onDrag, cssVar } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { createTimeline } from '../../lib/timeline.js';
import { h, button, readout, fmt } from '../../lib/ui.js';
import { iceCreamData, LinearModel } from '../../ml/linear.js';
import './chapter.css';

const X0 = 8, X1 = 37, Y0 = -5, Y1 = 115;
const HX1 = 12, HX2 = 33;           // where the two drag handles sit
const LR = 0.04;                    // learning rate for "let the computer try"
const STEPS_PER_SEC = 40;           // slow enough to watch each nudge

export default {
  id: 'what-is-a-model',
  title: 'What is a model?',
  mount(root) {
    const data = iceCreamData();
    const model = new LinearModel(data);
    model.setThrough(HX1, 78, HX2, 34); // start deliberately wrong

    root.append(h('div', { class: 'prose reveal', html: `
      <p>An ice-cream stand writes down two numbers every day: how hot it was, and how many cones it sold.
      Each <span class="term term--data">amber dot</span> below is one day.</p>
      <p>The owner wants to <strong>predict</strong> tomorrow's sales from tomorrow's weather forecast.
      A simple way: draw a straight line through the dots, then read sales off the line.</p>
      <p><strong>Try it.</strong> Drag the two handles on the <span class="term term--model">blue line</span> to fit the dots as well as you can.
      The <span class="term term--error">red lines</span> show how far off your line is for each day — and the meter adds them all up.</p>` }));

    const lab = h('div', { class: 'lab reveal' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid lab__grid--split' });
    lab.append(grid);
    const left = h('div');
    const right = h('div', { class: 'ch1-side' });
    grid.append(left, right);

    // --- readouts ---
    const errOut = readout('Error', 'error');
    const meterFill = h('div', { class: 'meter__fill' });
    errOut.el.append(h('div', { class: 'meter', role: 'presentation' }, meterFill));
    const missOut = readout('Typical miss (cones)', 'error');
    const bestOut = readout('Your best error', 'data');
    const slopeOut = readout('Slope', 'model');
    right.append(h('div', { class: 'readouts' }, errOut.el, missOut.el, bestOut.el, slopeOut.el));
    const say = h('p', { class: 'ch1-say', 'aria-live': 'polite' }, 'Drag a handle to begin.');
    right.append(say);

    let userBest = Infinity;
    let dragging = null; // 'h1' | 'h2' | 'body'
    let dragOffset = 0;
    let running = false;
    let step = 0;
    let lastGrad = [0, 0];

    // --- plot ---
    let sx, sy;
    const plot = createPlot(left, {
      aspect: 0.66, min: 260, max: 520,
      draw(ctx, w, hgt) {
        sx = scale(X0, X1, 34, w - 14);
        sy = scale(Y0, Y1, hgt - 26, 14);
        drawGrid(ctx, sx, sy, { xTicks: [10, 15, 20, 25, 30, 35], yTicks: [0, 25, 50, 75, 100], w, h: hgt });
        ctx.fillStyle = cssVar('--ink-3');
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('temperature (°C) →', w - 14, hgt - 32);
        ctx.textAlign = 'left';
        ctx.fillText('↑ cones sold', 38, 26);

        const errC = cssVar('--error'), modelC = cssVar('--model'), dataC = cssVar('--data'), learnC = cssVar('--learn');
        // residuals: the error made on each day
        ctx.strokeStyle = errC; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
        for (const p of data) {
          ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.y)); ctx.lineTo(sx(p.x), sy(model.predict(p.x))); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // the model
        ctx.save();
        ctx.strokeStyle = modelC; ctx.lineWidth = 3; ctx.shadowColor = modelC; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(sx(X0), sy(model.predict(X0))); ctx.lineTo(sx(X1), sy(model.predict(X1))); ctx.stroke();
        ctx.restore();
        for (const p of data) dot(ctx, sx(p.x), sy(p.y), 5, dataC, { glow: 8 });

        // While the computer learns, violet arrows show where each handle will move next.
        if (running && tl.live) {
          const na = model.a - LR * lastGrad[0] * 6, nc = model.c - LR * lastGrad[1] * 6;
          for (const hx of [HX1, HX2]) {
            const y0 = sy(model.predict(hx)), y1 = sy(model.predict(hx, na, nc));
            if (Math.abs(y1 - y0) > 3) arrow(ctx, sx(hx), y0, y1, learnC);
          }
        }
        for (const [hx, id] of [[HX1, 'h1'], [HX2, 'h2']]) {
          const px = sx(hx), py = sy(model.predict(hx));
          ctx.beginPath(); ctx.arc(px, py, dragging === id ? 13 : 11, 0, Math.PI * 2);
          ctx.fillStyle = cssVar('--bg'); ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = modelC; ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fillStyle = modelC; ctx.fill();
        }
      },
    });
    plot.canvas.setAttribute('role', 'img');
    plot.canvas.setAttribute('aria-label', 'Scatter plot of temperature against cones sold, with a draggable straight line.');
    const hint = h('div', { class: 'plot__hint ch1-hint' }, 'drag the ◯ handles');
    plot.wrap.append(hint);

    function arrow(ctx, x, y0, y1, col) {
      const dir = Math.sign(y1 - y0);
      ctx.save();
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5; ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(x + 18, y0); ctx.lineTo(x + 18, y1 - dir * 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 18, y1); ctx.lineTo(x + 12, y1 - dir * 9); ctx.lineTo(x + 24, y1 - dir * 9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    function update() {
      const mse = model.loss();
      errOut.set(fmt(mse, 0));
      missOut.set(fmt(Math.sqrt(mse), 1));
      meterFill.style.width = Math.min(100, (Math.sqrt(mse) / 45) * 100) + '%';
      slopeOut.set(`${fmt(model.realSlope(), 2)}/°C`);
      bestOut.set(Number.isFinite(userBest) ? fmt(userBest, 0) : '–');
      plot.draw();
    }

    // --- dragging ---
    const handleY = (hx) => sy(model.predict(hx));
    onDrag(plot.canvas, {
      down(p) {
        const d1 = Math.hypot(p.x - sx(HX1), p.y - handleY(HX1));
        const d2 = Math.hypot(p.x - sx(HX2), p.y - handleY(HX2));
        if (Math.min(d1, d2) < 30) dragging = d1 < d2 ? 'h1' : 'h2';
        else if (Math.abs(p.y - sy(model.predict(sx.invert(p.x)))) < 26) { dragging = 'body'; dragOffset = p.y - sy(model.predict(sx.invert(p.x))); }
        else return false;
        loop.pause();
        running = false;
        tl.reset();
        hint.style.opacity = 0;
        plot.canvas.style.cursor = 'grabbing';
      },
      move(p) {
        const y = Math.max(Y0, Math.min(Y1, sy.invert(p.y)));
        const y1 = model.predict(HX1), y2 = model.predict(HX2);
        if (dragging === 'h1') model.setThrough(HX1, y, HX2, y2);
        else if (dragging === 'h2') model.setThrough(HX1, y1, HX2, y);
        else {
          const dy = sy.invert(p.y - dragOffset) - model.predict(sx.invert(p.x));
          model.setThrough(HX1, y1 + dy, HX2, y2 + dy);
        }
        userBest = Math.min(userBest, model.loss());
        say.textContent = 'Keep going — can you get the error lower?';
        update();
      },
      up() { dragging = null; plot.canvas.style.cursor = ''; update(); },
      hover(p) {
        const near = Math.min(Math.hypot(p.x - sx(HX1), p.y - handleY(HX1)), Math.hypot(p.x - sx(HX2), p.y - handleY(HX2))) < 30;
        plot.canvas.style.cursor = near ? 'grab' : '';
      },
    });

    // --- the computer tries: real gradient descent, one step per frame ---
    let acc = 0;
    const loop = createLoop(lab, (dt) => {
      acc += dt * STEPS_PER_SEC;
      if (acc < 1) return;
      acc -= 1;
      lastGrad = model.step(LR);
      step++;
      tl.record(step, { loss: model.loss() }, { a: model.a, c: model.c });
      update();
      const gNorm = Math.hypot(...lastGrad);
      if (gNorm < 3e-4 || step > 2000) {
        running = false;
        const best = model.loss();
        say.innerHTML = `Done after <strong>${step}</strong> small steps. Computer's error: <strong style="color:var(--error)">${fmt(best, 0)}</strong>` +
          (Number.isFinite(userBest) ? ` — yours was <strong style="color:var(--data)">${fmt(userBest, 0)}</strong>.` : '.') +
          ' Scrub the timeline to watch how it got there.';
        update();
        return false;
      }
    });
    loop.onChange((p) => goBtn.setLabel(p ? 'Pause' : (running ? 'Continue' : 'Let the computer try'), p ? '❚❚' : '▶'));

    const goBtn = button('Let the computer try', () => {
      if (loop.playing) { loop.pause(); return; }
      const past = tl.rewindHere();
      if (past) { model.a = past.state.a; model.c = past.state.c; step = past.step; running = true; }
      if (!running) {
        tl.reset();
        step = 0;
        tl.record(0, { loss: model.loss() }, { a: model.a, c: model.c }, true);
        running = true;
      }
      say.textContent = 'Each step, the computer checks which way to tilt and shift the line to shrink the error, then nudges it a little.';
      hint.style.opacity = 0;
      loop.play();
    }, { primary: true, icon: '▶' });
    const resetBtn = button('Scramble line', () => {
      loop.pause(); running = false; tl.reset();
      const r = () => 10 + Math.random() * 90;
      model.setThrough(HX1, r(), HX2, r());
      say.textContent = 'A fresh, random line. Fit it yourself, or let the computer try.';
      update();
    }, { icon: '⤨' });
    right.append(h('div', { class: 'controls' }, goBtn, resetBtn));

    const tl = createTimeline(lab, {
      title: 'Training timeline — error over time',
      onScrubStart: () => loop.pause(),
      onView: (s) => { model.a = s.a; model.c = s.c; update(); },
    });

    root.append(h('div', { class: 'prose reveal', html: `
      <p>That line is a <span class="term term--model">model</span>: a simple rule that turns something we know
      (temperature) into a guess about something we don't (sales). The amber dots are its
      <span class="term term--data">training data</span>.</p>
      <p>The number on the meter is the model's <span class="term term--error">error</span>. We measure each red miss,
      square it (so big misses count a lot more than small ones), and average them. Statisticians call this the
      <em>mean squared error</em>.</p>
      <p>When you pressed the button, the computer didn't "see" the answer. It started from your line and
      repeatedly asked one question: <strong>which small nudge makes the error go down?</strong> The violet arrows
      showed that nudge. Scrub the timeline back to the start and you can watch it happen frame by frame.</p>` }));
    root.append(h('div', { class: 'callout reveal', html:
      '<strong>In one sentence:</strong> machine learning is choosing a model, measuring how wrong it is, and adjusting it step by step to be less wrong.' }));

    update();
    // Read-only hook for the automated checks in tests/e2e.mjs.
    (window.__ml ??= {}).ch1 = { model, get step() { return step; }, get running() { return running; }, timeline: tl };
  },
};
