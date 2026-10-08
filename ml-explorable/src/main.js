import './styles/tokens.css';
import './styles/base.css';
import './styles/controls.css';
import { h } from './lib/ui.js';
import { mountHero } from './hero.js';

import ch1 from './chapters/01-model/index.js';
import ch2 from './chapters/02-descent/index.js';
import ch3 from './chapters/03-neuron/index.js';
import ch4 from './chapters/04-network/index.js';
import ch5 from './chapters/05-overfitting/index.js';

// Reorder or add chapters here. Each exports { id, title, mount(el) }.
const chapters = [ch1, ch2, ch3, ch4, ch5];

mountHero(document.querySelector('.hero'));

const main = document.getElementById('chapters');

chapters.forEach((ch, i) => {
  const body = h('div', { class: 'chapter__body' });
  const section = h('section', { class: 'chapter', id: ch.id, 'aria-labelledby': `${ch.id}-title` },
    h('div', { class: 'reveal' },
      h('div', { class: 'chapter__num' }, ch.kicker ?? `Chapter ${i + 1}`),
      h('h2', { id: `${ch.id}-title` }, ch.title)),
    body);
  main.append(section);
  ch.mount(body);
});

// Scroll-triggered reveals (instant when reduced motion is on — handled in CSS).
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
