const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** True when the reader has asked the OS for less motion. */
export const reducedMotion = () => !!(mq && mq.matches);
