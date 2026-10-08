/**
 * A HiDPI canvas that fills its container's width and keeps an aspect ratio.
 * `draw(ctx, w, h)` is called on every resize; call `plot.draw()` to redraw.
 */
export function createPlot(container, { aspect = 0.62, min = 220, max = 560, fill = false, draw = () => {} } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'plot';
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  container.appendChild(wrap);
  const ctx = canvas.getContext('2d');

  const plot = { wrap, canvas, ctx, w: 0, h: 0, dpr: 1, drawFn: draw };

  function resize() {
    const w = Math.max(1, wrap.clientWidth);
    // fill: take the height CSS gives the wrapper instead of using an aspect ratio
    const h = fill ? Math.max(1, wrap.clientHeight) : Math.round(Math.min(max, Math.max(min, w * aspect)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === plot.w && h === plot.h && dpr === plot.dpr) return;
    plot.w = w; plot.h = h; plot.dpr = dpr;
    if (!fill) wrap.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    plot.draw();
  }

  plot.draw = () => {
    if (!plot.w) return;
    ctx.setTransform(plot.dpr, 0, 0, plot.dpr, 0, 0);
    ctx.clearRect(0, 0, plot.w, plot.h);
    plot.drawFn(ctx, plot.w, plot.h);
  };

  new ResizeObserver(resize).observe(wrap);
  resize();
  return plot;
}

/** Linear map from a data domain to a pixel range (with inverse). */
export function scale(d0, d1, r0, r1) {
  const k = (r1 - r0) / (d1 - d0);
  const f = (v) => r0 + (v - d0) * k;
  f.invert = (p) => d0 + (p - r0) / k;
  return f;
}

/** Light grid + optional axis tick labels for a data-space plot. */
export function drawGrid(ctx, sx, sy, { xTicks = [], yTicks = [], w, h, labels = true } = {}) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(140,160,200,0.08)';
  ctx.fillStyle = 'rgba(170,180,200,0.55)';
  ctx.font = '11px "JetBrains Mono", monospace';
  for (const x of xTicks) {
    const px = Math.round(sx(x)) + 0.5;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
    if (labels) { ctx.textAlign = 'center'; ctx.fillText(fmtTick(x), px, h - 6); }
  }
  for (const y of yTicks) {
    const py = Math.round(sy(y)) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
    if (labels) { ctx.textAlign = 'left'; ctx.fillText(fmtTick(y), 6, py - 4); }
  }
  ctx.restore();
}

const fmtTick = (v) => (Math.abs(v) >= 1000 ? (v / 1000) + 'k' : String(+v.toFixed(2)));

/** Glowing dot. */
export function dot(ctx, x, y, r, color, { glow = 10, hollow = false } = {}) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (hollow) { ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
  else { ctx.fillStyle = color; ctx.fill(); }
  ctx.restore();
}

/**
 * Pointer dragging on an element (mouse + touch + pen) with pointer capture.
 * Handlers receive {x, y} in CSS pixels relative to the element.
 */
export function onDrag(el, { down, move, up, hover } = {}) {
  let active = false;
  const pos = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  el.addEventListener('pointerdown', (e) => {
    const accept = down ? down(pos(e), e) : true;
    if (accept === false) return;
    active = true;
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (active) move && move(pos(e), e);
    else hover && hover(pos(e), e);
  });
  const end = (e) => {
    if (!active) return;
    active = false;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    up && up(pos(e), e);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/** Read a CSS custom property (colors live in tokens.css, not in JS). */
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
