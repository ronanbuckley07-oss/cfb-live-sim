/**
 * requestAnimationFrame loop that does a little work per frame so the page
 * never freezes. It auto-pauses while `el` is scrolled off screen or the tab
 * is hidden, and resumes when it comes back (if it was playing).
 */
export function createLoop(el, tick) {
  let playing = false;
  let visible = true;
  let raf = 0;
  let last = 0;
  const listeners = new Set();

  const frame = (t) => {
    raf = 0;
    if (!playing || !visible) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
    last = t;
    const keepGoing = tick(dt);
    if (keepGoing === false) { loop.pause(); return; }
    raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (playing && visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  };
  const emit = () => listeners.forEach((f) => f(playing));

  if (el && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    }, { rootMargin: '100px' }).observe(el);
  }
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    kick();
  });

  const loop = {
    get playing() { return playing; },
    play() { if (!playing) { playing = true; emit(); } kick(); },
    pause() {
      if (playing) { playing = false; emit(); }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },
    toggle() { playing ? loop.pause() : loop.play(); },
    onChange(f) { listeners.add(f); },
  };
  return loop;
}
