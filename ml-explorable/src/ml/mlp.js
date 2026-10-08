import { makeRng } from '../lib/rng.js';

/**
 * A small fully-connected neural network ("multi-layer perceptron").
 *
 *   sizes:  e.g. [2, 8, 1]  → 2 inputs, one hidden layer of 8, 1 output
 *   output: 'sigmoid' for yes/no classification (cross-entropy loss)
 *           'linear'  for predicting a number (squared-error loss)
 *
 * Hidden layers use tanh. Training is plain backpropagation + gradient
 * descent with momentum, written out longhand so it can be read.
 */
export class MLP {
  constructor(sizes, { output = 'sigmoid', seed = 1 } = {}) {
    this.sizes = sizes;
    this.output = output;
    this.L = sizes.length - 1;
    const rng = makeRng(seed);
    this.W = []; this.b = []; this.vW = []; this.vb = [];
    for (let l = 0; l < this.L; l++) {
      const nIn = sizes[l], nOut = sizes[l + 1];
      const W = new Float64Array(nIn * nOut);
      const s = Math.sqrt(1 / nIn);
      for (let i = 0; i < W.length; i++) W[i] = rng.normal() * s; // W[o * nIn + i]
      this.W.push(W);
      this.b.push(new Float64Array(nOut));
      this.vW.push(new Float64Array(W.length));
      this.vb.push(new Float64Array(nOut));
    }
    // scratch buffers for activations
    this.acts = sizes.map((n) => new Float64Array(n));
  }

  /** Run the network. Returns the output activations (reused buffer). */
  forward(x) {
    const acts = this.acts;
    for (let i = 0; i < this.sizes[0]; i++) acts[0][i] = x[i];
    for (let l = 0; l < this.L; l++) {
      const W = this.W[l], b = this.b[l], a = acts[l], out = acts[l + 1];
      const nIn = this.sizes[l], nOut = this.sizes[l + 1];
      const last = l === this.L - 1;
      for (let o = 0; o < nOut; o++) {
        let z = b[o];
        for (let i = 0; i < nIn; i++) z += W[o * nIn + i] * a[i];
        out[o] = !last ? Math.tanh(z) : this.output === 'sigmoid' ? 1 / (1 + Math.exp(-z)) : z;
      }
    }
    return acts[this.L];
  }

  /** Convenience: single-output prediction. */
  predict1(x) { return this.forward(x)[0]; }

  /** Average loss over a dataset. X: arrays of inputs, Y: arrays of targets. */
  loss(X, Y) {
    let s = 0;
    for (let n = 0; n < X.length; n++) {
      const out = this.forward(X[n]);
      for (let k = 0; k < out.length; k++) {
        const p = out[k], y = Y[n][k];
        if (this.output === 'sigmoid') {
          const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
          s -= y * Math.log(q) + (1 - y) * Math.log(1 - q);
        } else s += 0.5 * (p - y) ** 2;
      }
    }
    return s / X.length;
  }

  /** Backpropagation: average gradients of the loss over a batch. */
  gradients(X, Y) {
    const gW = this.W.map((w) => new Float64Array(w.length));
    const gb = this.b.map((b) => new Float64Array(b.length));
    const deltas = this.sizes.map((n) => new Float64Array(n));
    for (let n = 0; n < X.length; n++) {
      const out = this.forward(X[n]);
      // With sigmoid+cross-entropy or linear+squared-error, the output error signal is simply (prediction − target).
      const dL = deltas[this.L];
      for (let k = 0; k < out.length; k++) dL[k] = out[k] - Y[n][k];
      for (let l = this.L - 1; l >= 0; l--) {
        const nIn = this.sizes[l], nOut = this.sizes[l + 1];
        const a = this.acts[l], d = deltas[l + 1], W = this.W[l];
        for (let o = 0; o < nOut; o++) {
          gb[l][o] += d[o];
          for (let i = 0; i < nIn; i++) gW[l][o * nIn + i] += d[o] * a[i];
        }
        if (l > 0) {
          const dPrev = deltas[l];
          for (let i = 0; i < nIn; i++) {
            let s = 0;
            for (let o = 0; o < nOut; o++) s += W[o * nIn + i] * d[o];
            dPrev[i] = s * (1 - a[i] * a[i]); // derivative of tanh
          }
        }
      }
    }
    const inv = 1 / X.length;
    for (let l = 0; l < this.L; l++) {
      for (let i = 0; i < gW[l].length; i++) gW[l][i] *= inv;
      for (let i = 0; i < gb[l].length; i++) gb[l][i] *= inv;
    }
    return { gW, gb };
  }

  /** One gradient-descent step (with momentum) on a batch. */
  step(X, Y, lr = 0.1, momentum = 0.9) {
    const { gW, gb } = this.gradients(X, Y);
    for (let l = 0; l < this.L; l++) {
      const W = this.W[l], vW = this.vW[l], b = this.b[l], vb = this.vb[l];
      for (let i = 0; i < W.length; i++) { vW[i] = momentum * vW[i] - lr * gW[l][i]; W[i] += vW[i]; }
      for (let i = 0; i < b.length; i++) { vb[i] = momentum * vb[i] - lr * gb[l][i]; b[i] += vb[i]; }
    }
  }

  /** Copy of all parameters (for the training timeline). */
  getState() {
    return { W: this.W.map((w) => w.slice()), b: this.b.map((b) => b.slice()) };
  }

  setState(s) {
    s.W.forEach((w, l) => this.W[l].set(w));
    s.b.forEach((b, l) => this.b[l].set(b));
    this.vW.forEach((v) => v.fill(0));
    this.vb.forEach((v) => v.fill(0));
  }

  get paramCount() { return this.W.reduce((s, w) => s + w.length, 0) + this.b.reduce((s, b) => s + b.length, 0); }
}
