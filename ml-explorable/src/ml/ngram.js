/**
 * A tiny next-word model: count which words follow which, then turn the
 * counts into probabilities. It blends three "memories":
 *   trigram  – what followed the last two words
 *   bigram   – what followed the last word
 *   unigram  – how common each word is overall (with a little smoothing,
 *              so no word is ever completely impossible)
 * When a longer memory has little evidence, it leans on the shorter one.
 */

export function tokenize(text) {
  return text.toLowerCase().replace(/[“”"]/g, ' ').match(/[a-z']+|[.,!?]/g) || [];
}

export class NGram {
  constructor(vocab) {
    this.vocab = vocab;                 // every word the model could ever say
    this.reset();
  }

  reset() {
    this.uni = new Map(); this.bi = new Map(); this.tri = new Map();
    this.total = 0; this.tokens = [];
  }

  /** Read one more word (updates all the counts). */
  add(word) {
    const t = this.tokens;
    inc(this.uni, word);
    this.total++;
    if (t.length >= 1) inc2(this.bi, t[t.length - 1], word);
    if (t.length >= 2) inc2(this.tri, t[t.length - 2] + ' ' + t[t.length - 1], word);
    t.push(word);
  }

  /** Probability of every candidate word after `context` (array of words). */
  distribution(context) {
    const parts = this.parts(context);
    const probs = new Map();
    for (const w of this.vocab) probs.set(w, this.mix(parts, w));
    const { triN, biN, triC, biC } = parts;
    return { probs, used: triN ? 'two' : biN ? 'one' : 'none', triN, biN, triC, biC };
  }

  /** Probability of one word after `context` (fast path used for scoring). */
  prob(context, w) { return this.mix(this.parts(context), w); }

  parts(context) {
    const a = context[context.length - 2], b = context[context.length - 1];
    const triC = a && b ? this.tri.get(a + ' ' + b) : null;
    const biC = b ? this.bi.get(b) : null;
    const triN = triC ? sum(triC) : 0, biN = biC ? sum(biC) : 0;
    // How much to trust a memory: more if the context was seen often, less if
    // many different words followed it (Witten–Bell smoothing).
    const trust = (n, kinds) => (n ? n / (n + kinds) : 0);
    return { triC, biC, triN, biN, l3: trust(triN, triC ? triC.size : 0), l2: trust(biN, biC ? biC.size : 0) };
  }

  mix({ triC, biC, triN, biN, l3, l2 }, w) {
    const alpha = 0.5, V = this.vocab.length;
    const pUni = ((this.uni.get(w) || 0) + alpha) / (this.total + alpha * V);
    const pBi = l2 * (biN ? (biC.get(w) || 0) / biN : 0) + (1 - l2) * pUni;
    return l3 * (triN ? (triC.get(w) || 0) / triN : 0) + (1 - l3) * pBi;
  }

  /**
   * Perplexity on unseen text: roughly "how many words is the model torn
   * between, on average?" Lower is better.
   */
  perplexity(tokens) {
    let logSum = 0, n = 0;
    for (let i = 2; i < tokens.length; i++) {
      const p = this.prob(tokens.slice(i - 2, i), tokens[i]) || 1e-9;
      logSum += Math.log(p); n++;
    }
    return Math.exp(-logSum / n);
  }
}

const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const inc2 = (m, k, w) => { let inner = m.get(k); if (!inner) m.set(k, (inner = new Map())); inc(inner, w); };
const sum = (m) => { let s = 0; for (const v of m.values()) s += v; return s; };

/**
 * Split a text into a reading order (most sentences) and held-out sentences
 * (every `every`-th one) used only to measure how well the model predicts
 * text it has never read.
 */
export function splitText(text, every = 7) {
  const sentences = text.trim().split(/(?<=[.!?]["”]?)\s+/);
  const read = [], held = [];
  sentences.forEach((s, i) => (i % every === every - 1 ? held : read).push(...tokenize(s)));
  return { read, held };
}
