import { createPlot, onDrag, cssVar } from './canvas.js';
import { h, button, slider, fmtAuto } from './ui.js';
import { reducedMotion } from './motion.js';

const PAD_L = 8, PAD_R = 8, PAD_T = 10, PAD_B = 16;

/**
 * The shared "time" element. While a model trains, the chapter calls
 * `record(step, values, state)` with real snapshots of its parameters. The
 * timeline plots each value over time and lets the reader scrub back to any
 * moment, replay the whole run, or rewind and continue from the past.
 *
 *   series:  [{ key: 'loss', label: 'error', color: '--error' }, ...]
 *   onView(state, { live }) is called whenever the viewed moment changes.
 */
export function createTimeline(container, {
  title = 'Training timeline',
  unit = 'step',
  series = [{ key: 'loss', label: 'error', color: '--error' }],
  logY = false,
  maxPoints = 500,
  onView = () => {},
  onScrubStart = () => {},
} = {}) {
  let entries = [];
  let stride = 1;
  let viewIndex = null; // null = following live training
  let replayRaf = 0;

  const statusEl = h('span', { class: 'timeline__status', 'aria-live': 'polite' });
  const root = h('div', { class: 'timeline' },
    h('div', { class: 'timeline__head' },
      h('span', { class: 'timeline__title' }, title),
      statusEl));
  container.append(root);

  const chartHost = h('div', { class: 'timeline__chart' });
  root.append(chartHost);
  const plot = createPlot(chartHost, { aspect: 0.16, min: 84, max: 110, draw });

  const scrub = slider({
    label: 'Time',
    ariaLabel: 'Scrub through training time',
    min: 0, max: 1, step: 1, value: 0,
    accent: 'var(--learn)',
    format: () => '',
    onInput: (v) => { stopReplay(); onScrubStart(); view(v); },
  });
  const replayBtn = button('Replay', () => replay(), { icon: '↺' });
  const liveBtn = button('Latest', () => goLive(), { icon: '⇥', ariaLabel: 'Jump to latest moment' });
  root.append(h('div', { class: 'timeline__row' }, scrub.el, replayBtn, liveBtn));

  // Dragging directly on the chart scrubs too.
  const toIndex = (x) => {
    if (!entries.length) return 0;
    const lastStep = entries[entries.length - 1].step || 1;
    const step = ((x - PAD_L) / Math.max(1, plot.w - PAD_L - PAD_R)) * lastStep;
    let best = 0;
    for (let i = 0; i < entries.length; i++) if (Math.abs(entries[i].step - step) < Math.abs(entries[best].step - step)) best = i;
    return best;
  };
  onDrag(plot.canvas, {
    down: (p) => { if (!entries.length) return false; stopReplay(); onScrubStart(); view(toIndex(p.x)); },
    move: (p) => view(toIndex(p.x)),
  });

  function yRange() {
    let lo = Infinity, hi = -Infinity;
    for (const e of entries) for (const s of series) {
      const v = e.values[s.key];
      if (!Number.isFinite(v)) continue;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    if (!Number.isFinite(lo)) return [0, 1];
    if (logY) { lo = Math.max(lo, 1e-4); return [Math.log10(lo), Math.log10(Math.max(hi, lo * 1.01))]; }
    return [Math.min(0, lo), hi > lo ? hi : lo + 1];
  }

  function draw(ctx, w, hgt) {
    ctx.fillStyle = 'rgba(140,160,200,0.05)';
    ctx.fillRect(0, hgt - PAD_B, w, 1);
    if (entries.length < 1) {
      ctx.fillStyle = cssVar('--ink-3');
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Press play to start the clock — every moment of training is recorded here.', PAD_L + 4, hgt / 2 + 4);
      return;
    }
    const lastStep = entries[entries.length - 1].step || 1;
    const [y0, y1] = yRange();
    const X = (s) => PAD_L + (s / lastStep) * (w - PAD_L - PAD_R);
    const Y = (v) => {
      if (!Number.isFinite(v)) return PAD_T;
      const t = logY ? Math.log10(Math.max(v, 1e-4)) : v;
      const k = (t - y0) / (y1 - y0 || 1);
      return hgt - PAD_B - Math.min(1.05, Math.max(0, k)) * (hgt - PAD_B - PAD_T);
    };
    for (const s of series) {
      const col = cssVar(s.color);
      ctx.beginPath();
      entries.forEach((e, i) => {
        const x = X(e.step), y = Y(e.values[s.key]);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // cursor
    const i = viewIndex ?? entries.length - 1;
    const e = entries[i];
    const cx = X(e.step);
    const learn = cssVar('--learn');
    ctx.strokeStyle = learn; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, PAD_T - 4); ctx.lineTo(cx, hgt - PAD_B); ctx.stroke();
    for (const s of series) {
      ctx.beginPath(); ctx.arc(cx, Y(e.values[s.key]), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = cssVar('--bg'); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = cssVar(s.color); ctx.stroke();
    }
    ctx.fillStyle = cssVar('--ink-3');
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.fillText(`0`, PAD_L, hgt - 3);
    ctx.textAlign = 'right'; ctx.fillText(`${lastStep.toLocaleString()} ${unit}s`, w - PAD_R, hgt - 3);
    ctx.textAlign = 'left';
  }

  function status() {
    if (!entries.length) { statusEl.textContent = 'not started'; liveBtn.disabled = true; return; }
    const i = viewIndex ?? entries.length - 1;
    const e = entries[i];
    const vals = series.map((s) => `${s.label} ${fmtAuto(e.values[s.key])}`).join(' · ');
    statusEl.innerHTML = '';
    statusEl.append(
      viewIndex == null ? h('span', { class: 'live' }, '● now ') : h('span', {}, '⏮ past '),
      `${unit} ${e.step.toLocaleString()} · ${vals}`);
    liveBtn.disabled = viewIndex == null;
  }

  function sync() {
    scrub.setMax(Math.max(1, entries.length - 1));
    scrub.set(viewIndex ?? entries.length - 1);
    scrub.input.disabled = entries.length < 2;
    replayBtn.disabled = entries.length < 2;
    status();
    plot.draw();
  }

  function view(i) {
    if (!entries.length) return;
    i = Math.max(0, Math.min(entries.length - 1, Math.round(i)));
    viewIndex = i === entries.length - 1 && !replayRaf ? null : i;
    sync();
    onView(entries[i].state, { live: viewIndex == null });
  }

  function goLive() {
    stopReplay();
    if (!entries.length) return;
    viewIndex = null;
    sync();
    onView(entries[entries.length - 1].state, { live: true });
  }

  function stopReplay() { if (replayRaf) { cancelAnimationFrame(replayRaf); replayRaf = 0; } }

  function replay() {
    if (entries.length < 2) return;
    stopReplay();
    onScrubStart();
    if (reducedMotion()) { view(0); return; } // let the reader scrub by hand instead
    const dur = Math.min(6000, 1500 + entries.length * 8);
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      // ease-out so the dramatic early learning gets more screen time
      const i = Math.round((1 - Math.pow(1 - k, 2)) * (entries.length - 1));
      replayRaf = k < 1 ? requestAnimationFrame(tick) : 0;
      view(i);
      if (!replayRaf) goLive();
    };
    replayRaf = requestAnimationFrame(tick);
  }

  const tl = {
    /** Record a real snapshot. Decimates old history so memory stays bounded. */
    record(step, values, state, force = false) {
      const last = entries[entries.length - 1];
      if (!force && last && step - last.step < stride) return;
      entries.push({ step, values, state });
      if (entries.length > maxPoints) {
        const lastEntry = entries[entries.length - 1];
        entries = entries.filter((_, i) => i % 2 === 0);
        if (entries[entries.length - 1] !== lastEntry) entries.push(lastEntry);
        stride *= 2;
        if (viewIndex != null) viewIndex = Math.floor(viewIndex / 2);
      }
      if (viewIndex == null) sync();
    },
    reset() { stopReplay(); entries = []; stride = 1; viewIndex = null; sync(); },
    /** Is the reader looking at the present (not a past moment)? */
    get live() { return viewIndex == null && !replayRaf; },
    get length() { return entries.length; },
    /** If the reader rewound, drop the "future" and return the state to resume from. */
    rewindHere() {
      stopReplay();
      if (viewIndex == null) return null;
      entries = entries.slice(0, viewIndex + 1);
      viewIndex = null;
      sync();
      return entries[entries.length - 1];
    },
    redraw: () => plot.draw(),
  };
  sync();
  return tl;
}
