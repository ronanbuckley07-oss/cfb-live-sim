import { createLoop } from '../../lib/loop.js';
import { createTimeline } from '../../lib/timeline.js';
import { h, button, slider, readout } from '../../lib/ui.js';
import { FABLES } from '../../ml/fables.js';
import { tokenize, NGram, splitText } from '../../ml/ngram.js';
import { makeRng } from '../../lib/rng.js';
import './chapter.css';

const TOP = 8;
const WORDS_PER_SEC = 160;
const RECORD_EVERY = 20;
const CHIPS = ['the fox', 'the lion was', 'slow and', 'a little', 'said the'];

export default {
  id: 'next-word',
  title: 'How chatbots guess the next word',
  mount(root) {
    const { read, held } = splitText(FABLES);
    const vocab = [...new Set(tokenize(FABLES))];
    const model = new NGram(vocab);
    const rng = makeRng(42);
    let k = 0;            // how many words the model has read
    let temperature = 1;

    root.append(h('div', { class: 'prose reveal', html: `
      <p>Chatbots like ChatGPT or Claude write one word at a time. Before each word, the model produces a list of
      <strong>probabilities</strong> for what might come next, picks one, adds it to the text, and repeats.</p>
      <p>Here is a tiny version of that idea. This model has read ten short fables (about 1,300 words) and simply
      <strong>counted</strong> which words tend to follow which. Type a few words and see what it expects next. Click a bar to add that word.</p>` }));

    const lab = h('div', { class: 'lab reveal' });
    root.append(lab);
    const gridEl = h('div', { class: 'lab__grid lab__grid--split' });
    lab.append(gridEl);
    const left = h('div', { class: 'ch6-main' }), right = h('div', { class: 'ch6-side' });
    gridEl.append(left, right);

    // ---------- prompt ----------
    const input = h('input', { class: 'text-input', type: 'text', value: 'the fox', 'aria-label': 'Your words', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    input.addEventListener('input', () => update());
    const chips = h('div', { class: 'chips' }, CHIPS.map((c) => h('button', { type: 'button', class: 'chip', onClick: () => { input.value = c; update(); } }, c)));
    left.append(h('label', { class: 'ch6-label' }, 'Your words'), input, chips);

    const evidence = h('p', { class: 'ch6-evidence', 'aria-live': 'polite' });
    const bars = h('div', { class: 'bars', role: 'list', 'aria-label': 'Most likely next words' });
    left.append(h('div', { class: 'ch6-label' }, 'What comes next?'), bars, evidence);

    const tempSl = slider({ label: 'Temperature', min: 0.2, max: 2, step: 0.05, value: 1, accent: 'var(--learn)', onInput: (v) => { temperature = v; update(); } });
    const topBtn = button('Add likeliest word', () => append(current[0].w), { icon: '+' });
    const sampleBtn = button('Roll the dice', () => append(sample()), { primary: true, icon: '⚄', ariaLabel: 'Add a randomly chosen word, weighted by probability' });
    const writeBtn = button('Write 12 words', () => { for (let i = 0; i < 12; i++) { update(false); append(sample(), false); } update(); }, { icon: '✎' });
    const clearBtn = button('Clear', () => { input.value = ''; update(); input.focus(); }, { icon: '⌫' });
    left.append(h('div', { class: 'controls' }, sampleBtn, topBtn, writeBtn, clearBtn), h('div', { class: 'controls' }, tempSl.el));
    left.append(h('p', { class: 'caption' }, 'Temperature reshapes the odds before rolling the dice: low = play it safe, high = take chances. At 1 the bars show the model\'s own probabilities.'));

    // ---------- the model reading ----------
    right.append(h('div', { class: 'ch6-label' }, 'What the model has read'));
    const strip = h('div', { class: 'reading', 'aria-hidden': 'true' });
    right.append(strip);
    const readOut = readout('Words read', 'data');
    const pplOut = readout('Torn between', 'error');
    right.append(h('div', { class: 'readouts' }, readOut.el, pplOut.el));
    right.append(h('p', { class: 'caption' }, '"Torn between" measures how unsure the model is on sentences it never read: on average it is as uncertain as if choosing among this many words. Lower is better.'));
    const readBtn = button('Read from scratch', () => {
      if (loop.playing) { loop.pause(); return; }
      const past = tl.rewindHere();
      if (past) setK(past.state.k);
      else if (k >= read.length) { setK(0); tl.reset(); tl.record(0, { ppl: model.perplexity(held) }, { k: 0 }, true); }
      loop.play();
    }, { icon: '▶' });
    right.append(h('div', { class: 'controls' }, readBtn));

    let acc = 0;
    const loop = createLoop(lab, (dt) => {
      acc += dt * WORDS_PER_SEC;
      const n = Math.floor(acc);
      acc -= n;
      for (let i = 0; i < n && k < read.length; i++) {
        model.add(read[k++]);
        if (k % RECORD_EVERY === 0 || k === read.length) tl.record(k, { ppl: model.perplexity(held) }, { k }, true);
      }
      update();
      if (k >= read.length) return false;
    });
    loop.onChange((p) => readBtn.setLabel(p ? 'Pause' : k >= read.length ? 'Read from scratch' : 'Keep reading', p ? '❚❚' : '▶'));

    const tl = createTimeline(lab, {
      title: 'Reading timeline — how unsure it is on unseen sentences',
      unit: 'word',
      series: [{ key: 'ppl', label: 'torn between', color: '--error' }],
      onScrubStart: () => loop.pause(),
      onView: (st) => { setK(st.k); update(); },
    });

    function setK(n) {
      model.reset();
      for (let i = 0; i < n; i++) model.add(read[i]);
      k = n;
    }

    // Pre-compute the full reading history (real counts at every point), so the
    // reader can scrub back immediately; "Read from scratch" replays it live.
    tl.record(0, { ppl: model.perplexity(held) }, { k: 0 }, true);
    while (k < read.length) {
      model.add(read[k++]);
      if (k % RECORD_EVERY === 0 || k === read.length) tl.record(k, { ppl: model.perplexity(held) }, { k }, true);
    }

    // ---------- predictions ----------
    let current = [], dist = null, pplK = -1;
    function context() { return tokenize(input.value).slice(-2); }
    function predictions() {
      dist = model.distribution(context());
      const items = [...dist.probs].map(([w, p]) => ({ w, p: Math.pow(p, 1 / temperature) }));
      const z = items.reduce((s, it) => s + it.p, 0);
      items.forEach((it) => (it.p /= z));
      items.sort((a, b) => b.p - a.p);
      return items;
    }
    function sample() {
      let r = rng(), all = predictions();
      for (const it of all) { r -= it.p; if (r <= 0) return it.w; }
      return all[0].w;
    }
    function append(word, redraw = true) {
      const v = input.value.replace(/\s+$/, '');
      input.value = /^[.,!?]$/.test(word) || !v ? v + word : v + ' ' + word;
      input.scrollLeft = input.scrollWidth; // keep the newest words in view
      if (redraw) update();
    }
    const show = (w) => ({ '.': '. (full stop)', ',': ', (comma)', '!': '!', '?': '?' }[w] || w);

    function update(redraw = true) {
      current = predictions();
      if (!redraw) return;
      const top = current.slice(0, TOP), max = top[0].p;
      bars.replaceChildren(...top.map((it) => {
        const b = h('button', { type: 'button', class: 'bar', role: 'listitem', 'aria-label': `${show(it.w)}: ${(it.p * 100).toFixed(1)} percent. Add this word.` },
          h('span', { class: 'bar__word' }, show(it.w)),
          h('span', { class: 'bar__track' }, h('span', { class: 'bar__fill', style: `width:${(it.p / max) * 100}%` })),
          h('span', { class: 'bar__pct' }, `${(it.p * 100).toFixed(it.p < 0.1 ? 1 : 0)}%`));
        b.addEventListener('click', () => append(it.w));
        return b;
      }));
      const ctx = context();
      const q = (s) => `<strong>“${s}”</strong>`;
      if (k === 0) evidence.innerHTML = 'It hasn\'t read anything yet, so every word is equally likely. It knows nothing.';
      else if (dist.used === 'two') evidence.innerHTML = `It has seen ${q(ctx.join(' '))} ${dist.triN} time${dist.triN > 1 ? 's' : ''}; the bars mostly reflect what came next on those occasions.`;
      else if (dist.used === 'one') evidence.innerHTML = (ctx.length > 1 ? `It never saw ${q(ctx.join(' '))}, so it ` : 'It ') + `falls back on what followed ${q(ctx[ctx.length - 1])} (seen ${dist.biN} time${dist.biN > 1 ? 's' : ''}).`;
      else evidence.innerHTML = ctx.length ? `It has never seen ${q(ctx[ctx.length - 1])} followed by anything, so it just guesses common words.` : 'With no words to go on, it guesses the most common words.';
      readOut.set(k.toLocaleString());
      if (pplK !== k) { pplK = k; pplOut.set(`${Math.round(model.perplexity(held))} words`); }
      // reading strip: a window of the text around the current reading position
      const from = Math.max(0, k - 26), to = Math.min(read.length, k + 10);
      strip.replaceChildren(...read.slice(from, to).map((w, i) => h('span', { class: from + i < k ? (from + i === k - 1 ? 'is-now' : 'is-read') : '' }, w + ' ')));
    }

    root.append(h('div', { class: 'prose reveal', html: `
      <p>Try <em>slow and</em> — it's almost certain the next word is "steady", because that's what it read. Try
      <em>the lion was</em>, then roll the dice a few times. It sometimes writes things that sound right, and sometimes
      wanders into nonsense, because it only ever looks at the last two words.</p>
      <p>Scrub the reading timeline to the start: with nothing read, every word is equally likely. As it reads, it gets
      steadily less surprised by sentences it has never seen. That is <span class="term term--learn">learning from data</span>, in its simplest form.</p>` }));
    root.append(h('div', { class: 'callout callout--honest reveal', html: `
      <strong>How this differs from a real chatbot.</strong> This is a word-counting toy called an <em>n-gram model</em>, and it can only
      repeat word pairs it has literally seen. A large language model (LLM) is a huge neural network — billions of the weights you trained in
      chapter 4 — that has read a large part of the internet. It works on pieces of words called <em>tokens</em>, can take thousands
      of earlier words into account at once, and learns its predictions by gradient descent rather than counting.
      But the core job is the same one you see here: <strong>given the text so far, put a probability on every possible next token</strong>.` }));

    update();
    (window.__ml ??= {}).ch6 = {
      get k() { return k; }, total: read.length, top: () => current[0], get playing() { return loop.playing; },
      perplexity: () => model.perplexity(held), timeline: tl,
    };
  },
};
