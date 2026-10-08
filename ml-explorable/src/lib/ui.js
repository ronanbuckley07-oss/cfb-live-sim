/** Tiny DOM builders for the shared, touch-friendly controls. */

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

export function slider({ label, min, max, step = 'any', value, format = (v) => v.toFixed(2), accent = 'var(--model)', onInput, ariaLabel }) {
  const valueEl = h('output', { class: 'slider__value' });
  const input = h('input', { type: 'range', min, max, step, 'aria-label': ariaLabel || label });
  input.style.setProperty('--accent', accent);
  const el = h('label', { class: 'slider' }, h('span', { class: 'slider__label' }, label), input, valueEl);
  const paint = () => {
    const v = +input.value;
    valueEl.textContent = format(v);
    input.style.setProperty('--fill', ((v - min) / (max - min)) * 100 + '%');
  };
  input.value = value;
  paint();
  input.addEventListener('input', () => { paint(); onInput && onInput(+input.value); });
  return {
    el, input,
    get value() { return +input.value; },
    set(v) { input.value = v; paint(); },
    setMax(m) { max = m; input.max = m; paint(); },
  };
}

export function button(label, onClick, { primary = false, icon, ariaLabel } = {}) {
  const b = h('button', { class: 'btn' + (primary ? ' btn--primary' : ''), type: 'button', onClick, 'aria-label': ariaLabel });
  b.setLabel = (text, ico) => {
    b.replaceChildren();
    if (ico) b.append(h('span', { class: 'ico', 'aria-hidden': 'true' }, ico));
    b.append(text);
  };
  b.setLabel(label, icon);
  return b;
}

export function segmented(options, value, onChange, ariaLabel) {
  const el = h('div', { class: 'seg', role: 'group', 'aria-label': ariaLabel });
  const btns = options.map(([val, text]) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(val === value) }, text);
    b.addEventListener('click', () => set(val, true));
    el.append(b);
    return [val, b];
  });
  function set(v, fire) {
    value = v;
    for (const [val, b] of btns) b.setAttribute('aria-pressed', String(val === v));
    if (fire) onChange(v);
  }
  return { el, set, get value() { return value; } };
}

export function readout(label, kind = '') {
  const v = h('div', { class: 'readout__v', 'aria-live': 'off' }, '–');
  const el = h('div', { class: 'readout' + (kind ? ` readout--${kind}` : '') }, h('div', { class: 'readout__k' }, label), v);
  return { el, set(text) { v.textContent = text; } };
}

/** Format with sensible precision for its size (962 · 31.4 · 0.042). */
export const fmtAuto = (v) => (!Number.isFinite(v) ? '∞' : Math.abs(v) >= 1e4 ? v.toExponential(1) : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));

export const fmt = (v, d = 2) => (Number.isFinite(v) ? (Math.abs(v) >= 1e4 ? v.toExponential(1) : v.toFixed(d)) : '∞');
