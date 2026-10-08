import { createPlot, scale, onDrag, cssVar } from '../../lib/canvas.js';
import { createLoop } from '../../lib/loop.js';
import { createTimeline } from '../../lib/timeline.js';
import { h, button, slider, segmented, readout, fmt } from '../../lib/ui.js';
import { MLP } from '../../ml/mlp.js';
import './chapter.css';

const ACT = {
  step: { name: 'Step', f: (z) => (z >= 0 ? 1 : 0), lo: 0, hi: 1 },
  sigmoid: { name: 'Sigmoid', f: (z) => 1 / (1 + Math.exp(-z)), lo: 0, hi: 1 },
  relu: { name: 'ReLU', f: (z) => Math.max(0, z), lo: 0, hi: 4 },
};
// Four example days for the challenges: [sunny, windy] → beach day?
const CORNERS = [[0, 0], [0, 1], [1, 0], [1, 1]];
const TASKS = {
  calm: { label: 'Sunny and calm', targets: [0, 0, 1, 0] },
  tricky: { label: 'The tricky one', targets: [0, 1, 1, 0] },
};
const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => { const el = document.createElementNS(SVGNS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };

export default {
  id: 'a-single-neuron',
  title: 'A single neuron',
  mount(root) {
    const s = { x1: 0.8, x2: 0.3, w1: 3, w2: -2.5, b: -0.5, act: 'sigmoid' };
    let task = 'calm';

    root.append(h('div', { class: 'prose reveal', html: `
      <p>A line can only do so much. To build models that can recognise faces or translate languages, we need a more
      flexible building block. Meet the <strong>artificial neuron</strong> — loosely inspired by brain cells, but really just a tiny calculator.</p>
      <p>This one decides whether it's a beach day. It gets two <span class="term term--data">inputs</span>: how sunny it is
      and how windy it is (0 = not at all, 1 = very). It multiplies each input by a <span class="term term--model">weight</span>
      — how much it cares about that input — adds them up with a starting nudge called the <span class="term term--model">bias</span>,
      then squashes the total into a final answer.</p>
      <p>Move the sliders. Thick wires mean a big weight; <span class="term term--model">blue</span> wires push the answer up,
      <span class="term term--error">red</span> wires pull it down.</p>` }));

    const lab = h('div', { class: 'lab reveal' });
    root.append(lab);
    const grid = h('div', { class: 'lab__grid lab__grid--even' });
    lab.append(grid);
    const left = h('div'), right = h('div');
    grid.append(left, right);

    // ---------- the diagram ----------
    const D = svg('svg', { viewBox: '0 0 520 300', class: 'neuron-svg', role: 'img', 'aria-label': 'Diagram of a neuron: two inputs and a bias flow along weighted wires into a sum, then an activation function, then the output.' });
    left.append(D);
    const P = { x1: [52, 80], x2: [52, 200], b: [200, 272], sum: [250, 140], act: [362, 140], out: [470, 140] };
    const wire = (from) => { const p = svg('path', { class: 'wire', d: `M${from[0]},${from[1]} C${(from[0] + P.sum[0]) / 2},${from[1]} ${(from[0] + P.sum[0]) / 2},${P.sum[1]} ${P.sum[0] - 30},${P.sum[1]}` }); D.append(p); return p; };
    const w1Path = wire(P.x1), w2Path = wire(P.x2);
    const bPath = svg('path', { class: 'wire', d: `M${P.b[0]},${P.b[1] - 16} Q${P.b[0] + 20},${P.sum[1] + 50} ${P.sum[0] - 10},${P.sum[1] + 26}` });
    D.append(bPath);
    D.append(svg('path', { class: 'wire wire--plain', d: `M${P.sum[0] + 30},${P.sum[1]} L${P.act[0] - 46},${P.act[1]}` }));
    D.append(svg('path', { class: 'wire wire--plain', d: `M${P.act[0] + 46},${P.act[1]} L${P.out[0] - 30},${P.out[1]}` }));
    const label = (x, y, text, cls = 'svg-label') => { const t = svg('text', { x, y, class: cls }); t.textContent = text; D.append(t); return t; };
    const node = (p, r, cls) => { const c = svg('circle', { cx: p[0], cy: p[1], r, class: cls }); D.append(c); return c; };
    const x1Node = node(P.x1, 26, 'node node--data'), x2Node = node(P.x2, 26, 'node node--data');
    const x1Val = label(P.x1[0], P.x1[1] + 5, '', 'svg-val'), x2Val = label(P.x2[0], P.x2[1] + 5, '', 'svg-val');
    label(P.x1[0], P.x1[1] - 36, 'sunny'); label(P.x2[0], P.x2[1] + 46, 'windy');
    const w1Lab = label(150, 82, '', 'svg-w'), w2Lab = label(150, 214, '', 'svg-w');
    node(P.b, 16, 'node node--bias'); label(P.b[0], P.b[1] + 4, 'b', 'svg-val svg-val--small');
    const bLab = label(P.b[0] - 62, P.b[1] + 4, '', 'svg-w');
    node(P.sum, 30, 'node node--sum'); const sumVal = label(P.sum[0], P.sum[1] + 5, '', 'svg-val');
    label(P.sum[0], P.sum[1] - 40, 'add up');
    D.append(svg('rect', { x: P.act[0] - 46, y: P.act[1] - 36, width: 92, height: 72, rx: 10, class: 'node node--act' }));
    const actCurve = svg('path', { class: 'act-curve' }); D.append(actCurve);
    const actDot = svg('circle', { r: 4.5, class: 'act-dot' }); D.append(actDot);
    const actName = label(P.act[0], P.act[1] - 46, '');
    const outNode = node(P.out, 28, 'node node--out'); const outVal = label(P.out[0], P.out[1] + 5, '', 'svg-val');
    label(P.out[0], P.out[1] - 40, 'output');

    // ---------- controls ----------
    const sl = {};
    const mk = (key, label, min, max, accent) => { sl[key] = slider({ label, min, max, step: 0.01, value: s[key], accent, onInput: (v) => { s[key] = v; stopLearning(); update(); } }); return sl[key].el; };
    const actSeg = segmented(Object.entries(ACT).map(([k, a]) => [k, a.name]), s.act, (k) => { s.act = k; stopLearning(); update(); }, 'Activation function');
    left.append(
      h('div', { class: 'controls controls--grid' },
        mk('x1', 'Sunny', 0, 1, 'var(--data)'), mk('x2', 'Windy', 0, 1, 'var(--data)'),
        mk('w1', 'Weight 1', -6, 6, 'var(--model)'), mk('w2', 'Weight 2', -6, 6, 'var(--model)'),
        mk('b', 'Bias', -6, 6, 'var(--model)')),
      h('div', { class: 'controls' }, h('span', { class: 'slider__label' }, 'Squash with'), actSeg.el));

    // ---------- the decision map ----------
    right.append(h('p', { class: 'caption ch3-cap' }, 'Every possible day, coloured by the neuron\'s answer. Drag the amber dot to change the inputs.'));
    let sx, sy;
    const map = createPlot(right, {
      aspect: 1, min: 240, max: 400,
      draw(ctx, w, hgt) {
        sx = scale(-0.1, 1.1, 30, w - 12); sy = scale(-0.1, 1.1, hgt - 30, 12);
        const res = 4, a = ACT[s.act];
        const model = cssVar('--model');
        for (let px = 0; px < w; px += res) for (let py = 0; py < hgt; py += res) {
          const o = (a.f(s.w1 * sx.invert(px + res / 2) + s.w2 * sy.invert(py + res / 2) + s.b) - a.lo) / (a.hi - a.lo);
          ctx.fillStyle = `rgba(77,226,255,${0.04 + 0.5 * Math.min(1, Math.max(0, o))})`;
          ctx.fillRect(px, py, res, res);
        }
        // boundary where the sum is exactly zero
        ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(232,236,244,0.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (Math.abs(s.w2) > 1e-6) { const y = (x) => -(s.w1 * x + s.b) / s.w2; ctx.moveTo(sx(-0.1), sy(y(-0.1))); ctx.lineTo(sx(1.1), sy(y(1.1))); }
        else if (Math.abs(s.w1) > 1e-6) { const x = -s.b / s.w1; ctx.moveTo(sx(x), 0); ctx.lineTo(sx(x), hgt); }
        ctx.stroke(); ctx.restore();
        ctx.fillStyle = cssVar('--ink-3'); ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right'; ctx.fillText('sunny →', w - 12, hgt - 10);
        ctx.save(); ctx.translate(14, 16); ctx.rotate(Math.PI / 2); ctx.textAlign = 'left'; ctx.fillText('windy →', 0, 0); ctx.restore();
        // the four example days
        CORNERS.forEach(([cx, cy], i) => {
          const want = TASKS[task].targets[i];
          const got = predictCorner(i);
          const x = sx(cx), y = sy(cy);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = got === want ? model : cssVar('--error');
          ctx.fillStyle = want ? cssVar('--data') : cssVar('--bg');
          ctx.beginPath(); ctx.rect(x - 9, y - 9, 18, 18); ctx.fill(); ctx.stroke();
        });
        // the current input
        const ix = sx(s.x1), iy = sy(s.x2);
        ctx.save(); ctx.shadowColor = cssVar('--data'); ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(ix, iy, 9, 0, Math.PI * 2); ctx.fillStyle = cssVar('--data'); ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.arc(ix, iy, 9, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = cssVar('--bg'); ctx.stroke();
      },
    });
    map.canvas.setAttribute('role', 'img');
    map.canvas.setAttribute('aria-label', 'Map of all input combinations shaded by the neuron output, with the dividing line and four example days.');
    onDrag(map.canvas, {
      down: (p) => { if (Math.hypot(p.x - sx(s.x1), p.y - sy(s.x2)) > 34) return false; },
      move: (p) => {
        s.x1 = Math.max(0, Math.min(1, sx.invert(p.x))); s.x2 = Math.max(0, Math.min(1, sy.invert(p.y)));
        sl.x1.set(s.x1); sl.x2.set(s.x2); update();
      },
    });

    const scoreOut = readout('Example days right', 'model');
    const taskSeg = segmented(Object.entries(TASKS).map(([k, t]) => [k, t.label]), task, (k) => { task = k; stopLearning(); tl.reset(); update(); }, 'Challenge');
    right.append(h('div', { class: 'ch3-legend', html:
      '<span><i class="sq sq--yes"></i>should say yes</span><span><i class="sq"></i>should say no</span><span><i class="sq sq--bad"></i>red border = neuron gets it wrong</span>' }));
    right.append(h('div', { class: 'controls' }, taskSeg.el), h('div', { class: 'readouts', style: 'margin-top:12px' }, scoreOut.el));
    const say = h('p', { class: 'ch3-say', 'aria-live': 'polite' });
    right.append(say);

    // ---------- letting the neuron learn the four example days ----------
    const neuron = new MLP([2, 1], { output: 'sigmoid' });
    const X = CORNERS, Y = () => TASKS[task].targets.map((t) => [t]);
    let step = 0;
    const syncNeuron = () => { neuron.W[0][0] = s.w1; neuron.W[0][1] = s.w2; neuron.b[0][0] = s.b; };
    const pull = () => { s.w1 = neuron.W[0][0]; s.w2 = neuron.W[0][1]; s.b = neuron.b[0][0]; for (const k of ['w1', 'w2', 'b']) sl[k].set(Math.max(-6, Math.min(6, s[k]))); };
    const loop = createLoop(lab, () => {
      for (let i = 0; i < 4; i++) { neuron.step(X, Y(), 0.5, 0.9); step++; }
      // keep the weights within the sliders' reach so the diagram stays honest
      for (const arr of [neuron.W[0], neuron.b[0]]) for (let i = 0; i < arr.length; i++) arr[i] = Math.max(-6, Math.min(6, arr[i]));
      pull();
      tl.record(step, { loss: neuron.loss(X, Y()) }, { w1: s.w1, w2: s.w2, b: s.b });
      update();
      if (step >= 1200) return false;
    });
    loop.onChange((p) => learnBtn.setLabel(p ? 'Pause' : 'Let it learn', p ? '❚❚' : '▶'));
    const learnBtn = button('Let it learn', () => {
      if (loop.playing) { loop.pause(); return; }
      if (s.act !== 'sigmoid') { s.act = 'sigmoid'; actSeg.set('sigmoid'); }
      const past = tl.rewindHere();
      if (past) { Object.assign(s, past.state); step = past.step; }
      else if (step >= 1200 || tl.length === 0) { tl.reset(); step = 0; }
      syncNeuron();
      if (tl.length === 0) tl.record(0, { loss: neuron.loss(X, Y()) }, { w1: s.w1, w2: s.w2, b: s.b }, true);
      loop.play();
    }, { primary: true, icon: '▶' });
    right.append(h('div', { class: 'controls' }, learnBtn));
    const tl = createTimeline(lab, {
      title: 'Training timeline — error on the four example days',
      onScrubStart: () => loop.pause(),
      onView: (st) => { Object.assign(s, st); for (const k of ['w1', 'w2', 'b']) sl[k].set(s[k]); update(); },
    });
    function stopLearning() { if (loop.playing) loop.pause(); }

    function z(x1 = s.x1, x2 = s.x2) { return s.w1 * x1 + s.w2 * x2 + s.b; }
    function predictCorner(i) { const a = ACT[s.act]; return (a.f(z(...CORNERS[i])) - a.lo) / (a.hi - a.lo) >= 0.5 ? 1 : 0; }

    function update() {
      const a = ACT[s.act];
      const sum = z(), out = a.f(sum);
      x1Val.textContent = s.x1.toFixed(2); x2Val.textContent = s.x2.toFixed(2);
      x1Node.style.setProperty('--glow', s.x1); x2Node.style.setProperty('--glow', s.x2);
      for (const [p, w, lab, txt] of [[w1Path, s.w1, w1Lab, '× '], [w2Path, s.w2, w2Lab, '× '], [bPath, s.b, bLab, 'bias ']]) {
        p.style.strokeWidth = 1 + Math.abs(w) * 1.6;
        p.style.stroke = w >= 0 ? 'var(--model)' : 'var(--error)';
        p.style.opacity = 0.35 + Math.min(0.65, Math.abs(w) / 4);
        lab.textContent = `${txt}${fmt(w, 1).replace(/^-0\.0$/, '0.0')}`;
        lab.style.fill = w >= 0 ? 'var(--model)' : 'var(--error)';
      }
      sumVal.textContent = fmt(sum, 1).replace(/^-0\.0$/, '0.0');
      // activation mini-plot: z from −6..6 mapped into the box
      const bx = (t) => P.act[0] - 38 + ((t + 6) / 12) * 76;
      const by = (v) => P.act[1] + 26 - ((v - a.lo) / (a.hi - a.lo)) * 52;
      let d = '';
      for (let i = 0; i <= 60; i++) { const t = -6 + (12 * i) / 60; d += `${i ? 'L' : 'M'}${bx(t).toFixed(1)},${by(Math.min(a.hi, a.f(t))).toFixed(1)}`; }
      actCurve.setAttribute('d', d);
      const zc = Math.max(-6, Math.min(6, sum));
      actDot.setAttribute('cx', bx(zc)); actDot.setAttribute('cy', by(Math.min(a.hi, a.f(zc))));
      actName.textContent = `squash: ${a.name.toLowerCase()}`;
      outVal.textContent = fmt(out, 2);
      outNode.style.setProperty('--glow', Math.min(1, (out - a.lo) / (a.hi - a.lo)));

      const right_ = CORNERS.reduce((n, _, i) => n + (predictCorner(i) === TASKS[task].targets[i]), 0);
      scoreOut.set(`${right_} / 4`);
      if (loop.playing || tl.length) {
        say.textContent = task === 'calm'
          ? (right_ === 4 ? 'Learned it. A single straight cut separates the beach day from the rest.' : 'Adjusting its weights by gradient descent…')
          : (right_ === 4 ? 'Solved!' : `Stuck at ${right_}/4 — watch the timeline flatten out. No straight line can put both amber squares on one side and both dark squares on the other, so it hedges toward 50/50.`);
      } else {
        say.textContent = task === 'calm'
          ? 'Can you set the sliders so the neuron says yes only for the sunny, calm day? Or let it learn.'
          : 'Now say yes when it\'s sunny or windy — but not both. Try it, then let it learn.';
      }
      map.draw();
    }

    root.append(h('div', { class: 'prose reveal', html: `
      <p>The dashed line on the map is where the neuron changes its mind. Notice it is <strong>always straight</strong>, whatever
      you do with the sliders: weights tilt it, the bias slides it. A single neuron is really just our line from chapter 1, wearing a costume.</p>
      <p>The squashing step is called the <span class="term term--model">activation function</span>. "Sigmoid" gives a smooth 0-to-1 answer,
      "step" a hard yes/no, and "ReLU" (short for <em>rectified linear unit</em>) simply cuts off anything negative — it's the most popular choice in modern networks.</p>
      <p>On the tricky challenge, learning gets stuck no matter how long it runs. To bend that straight line, we need
      to wire neurons <strong>together</strong>.</p>` }));

    update();
    (window.__ml ??= {}).ch3 = { state: s, get step() { return step; }, setTask: (k) => taskSeg.set(k, true), predictCorner, get playing() { return loop.playing; }, neuron, timeline: tl };
  },
};
