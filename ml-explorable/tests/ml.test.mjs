import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MLP } from '../src/ml/mlp.js';
import { LinearModel, iceCreamData } from '../src/ml/linear.js';

// Compare backprop gradients against slow finite differences.
for (const output of ['sigmoid', 'linear']) {
  test(`MLP backprop matches numerical gradient (${output})`, () => {
    const net = new MLP([2, 5, 3, 1], { output, seed: 3 });
    const X = [[0.3, -0.7], [1.2, 0.4], [-0.5, 0.9]];
    const Y = output === 'sigmoid' ? [[1], [0], [1]] : [[0.4], [-1.1], [2]];
    const { gW, gb } = net.gradients(X, Y);
    const eps = 1e-6;
    for (let l = 0; l < net.L; l++) {
      for (const [arr, g] of [[net.W[l], gW[l]], [net.b[l], gb[l]]]) {
        for (let i = 0; i < arr.length; i++) {
          const old = arr[i];
          arr[i] = old + eps; const lp = net.loss(X, Y);
          arr[i] = old - eps; const lm = net.loss(X, Y);
          arr[i] = old;
          const num = (lp - lm) / (2 * eps);
          assert.ok(Math.abs(num - g[i]) < 1e-6, `layer ${l} param ${i}: ${num} vs ${g[i]}`);
        }
      }
    }
  });
}

test('MLP learns XOR', () => {
  const net = new MLP([2, 4, 1], { seed: 2 });
  const X = [[-1, -1], [-1, 1], [1, -1], [1, 1]], Y = [[0], [1], [1], [0]];
  for (let i = 0; i < 2000; i++) net.step(X, Y, 0.1, 0.9);
  for (let n = 0; n < 4; n++) assert.equal(Math.round(net.predict1(X[n])), Y[n][0]);
});

test('linear gradient descent reaches the exact least-squares line', () => {
  const m = new LinearModel(iceCreamData());
  m.a = -2; m.c = 1;
  for (let i = 0; i < 500; i++) m.step(0.04);
  const o = m.optimum();
  assert.ok(Math.abs(m.a - o.a) < 1e-4 && Math.abs(m.c - o.c) < 1e-4);
});

import { NGram, tokenize, splitText } from '../src/ml/ngram.js';
import { FABLES } from '../src/ml/fables.js';

test('n-gram probabilities sum to 1 and perplexity falls with more reading', () => {
  const { read, held } = splitText(FABLES);
  const m = new NGram([...new Set(tokenize(FABLES))]);
  const p0 = m.perplexity(held);
  read.forEach((w) => m.add(w));
  for (const ctx of [[], ['the'], ['slow', 'and'], ['zzz', 'qqq']]) {
    const total = [...m.distribution(ctx).probs.values()].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `sums to ${total} for ${ctx}`);
  }
  assert.ok(m.perplexity(held) < p0 / 2);
});
