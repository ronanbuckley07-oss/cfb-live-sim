// Per-chapter checks used by e2e.mjs. Each receives (page, ok, viewport).
const shot = (page, sel, name) => page.locator(sel).screenshot({ path: `shots/${name}.png` });

const checks = {
  async ch1(page, ok, vp) {
    const sec = page.locator('#what-is-a-model');
    await sec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const canvas = sec.locator('.plot canvas').first();
    const box = await canvas.boundingBox();
    const before = await page.evaluate(() => window.__ml.ch1.model.loss());

    // Drag the left handle using a real pointer gesture.
    const h = await page.evaluate(() => {
      const m = window.__ml.ch1.model; return { y12: m.predict(12) };
    });
    // handle position in px: recompute from the plot's scales (x 8..37 → 34..w-14, y -5..115 → h-26..14)
    const hx = box.x + 34 + ((12 - 8) / 29) * (box.width - 48);
    const hy = box.y + (box.height - 26) - ((h.y12 + 5) / 120) * (box.height - 40);
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx, hy + box.height * 0.3, { steps: 8 });
    await page.mouse.up();
    const afterDrag = await page.evaluate(() => window.__ml.ch1.model.loss());
    ok(Math.abs(afterDrag - before) > 1, `dragging a handle changes the error (${before.toFixed(0)} → ${afterDrag.toFixed(0)})`);
    const errText = await sec.locator('.readout--error .readout__v').first().textContent();
    ok(Number(errText) === Math.round(afterDrag), `error meter shows the live loss (${errText})`);

    await sec.getByRole('button', { name: /let the computer try/i }).click();
    await page.waitForFunction(() => !window.__ml.ch1.running, null, { timeout: 20000 });
    const r = await page.evaluate(() => {
      const m = window.__ml.ch1.model; const o = m.optimum();
      return { loss: m.loss(), best: m.loss(o.a, o.c), steps: window.__ml.ch1.step, snaps: window.__ml.ch1.timeline.length };
    });
    ok(r.loss < r.best * 1.01, `gradient descent converges to the best line (${r.loss.toFixed(1)} vs optimum ${r.best.toFixed(1)}, ${r.steps} steps)`);
    ok(r.snaps > 20, `timeline recorded ${r.snaps} snapshots`);

    // Scrub to the start of the timeline: the model must go back to its early state.
    const slider = sec.locator('.timeline input[type=range]');
    await slider.evaluate((el) => { el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const early = await page.evaluate(() => window.__ml.ch1.model.loss());
    ok(early > r.loss * 1.5, `scrubbing back in time restores the earlier, worse model (${early.toFixed(0)})`);
    await shot(page, '#what-is-a-model .lab', `ch1-${vp.name}`);
    // return to latest
    await sec.getByRole('button', { name: /latest/i }).click();
  },
};

checks.ch2 = async (page, ok, vp) => {
  const sec = page.locator('#getting-less-wrong');
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const get = () => page.evaluate(() => { const c = window.__ml.ch2; const o = c.model.optimum(); return { a: c.model.a, opt: o.a, status: c.status, step: c.step, loss: c.model.loss(c.model.a, 0), best: c.model.loss(o.a, 0) }; });

  await sec.getByRole('button', { name: 'Just right' }).click();
  await sec.getByRole('button', { name: /^.?\s*Play/ }).click();
  await page.waitForFunction(() => window.__ml.ch2.status === 'converged', null, { timeout: 20000 });
  let r = await get();
  ok(Math.abs(r.a - r.opt) < 0.01, `"just right" step size reaches the valley floor in ${r.step} steps`);
  await page.locator('#getting-less-wrong .lab').screenshot({ path: `shots/ch2-good-${vp.name}.png` });

  await sec.getByRole('button', { name: 'Too big' }).click();
  await sec.getByRole('button', { name: /^.?\s*Play/ }).click();
  await page.waitForFunction(() => window.__ml.ch2.status === 'diverged', null, { timeout: 30000 });
  r = await get();
  ok(r.status === 'diverged', `"too big" step size really diverges (after ${r.step} steps)`);
  await page.locator('#getting-less-wrong .lab').screenshot({ path: `shots/ch2-wild-${vp.name}.png` });

  // Rewind to an early moment, switch to a good step size and resume: it should recover.
  const slider = sec.locator('.timeline input[type=range]');
  await slider.evaluate((el) => { el.value = 3; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const rewound = await get();
  ok(Math.abs(rewound.a) < 5, `scrubbing back restores an early, sane slope (${rewound.a.toFixed(2)})`);
  await page.evaluate(() => window.__ml.ch2.setLr(0.15));
  await sec.getByRole('button', { name: /^.?\s*Play/ }).click();
  await page.waitForFunction(() => window.__ml.ch2.status === 'converged', null, { timeout: 20000 });
  r = await get();
  ok(Math.abs(r.a - r.opt) < 0.01, `rewinding and lowering the step size recovers and converges (step ${r.step})`);

  await sec.getByRole('button', { name: 'Too small' }).click();
  await sec.getByRole('button', { name: /^.?\s*Play/ }).click();
  await page.waitForTimeout(2500);
  r = await get();
  ok(r.status === 'running' && r.step > 8 && r.loss > r.best * 1.5, `"too small" is still crawling after ${r.step} steps`);
  await sec.getByRole('button', { name: /pause/i }).click();
};

checks.ch3 = async (page, ok, vp) => {
  const sec = page.locator('#a-single-neuron');
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const out = () => sec.locator('.neuron-svg .node--out + text').textContent();
  const before = await out();
  const w1 = sec.getByRole('slider', { name: 'Weight 1' });
  await w1.evaluate((el) => { el.value = -4; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const after = await out();
  ok(before !== after, `moving a weight slider updates the output instantly (${before} → ${after})`);
  const stroke = await sec.locator('.neuron-svg .wire').first().evaluate((el) => el.style.stroke);
  ok(/error/.test(stroke), 'a negative weight turns its wire red');

  await sec.getByRole('button', { name: /let it learn/i }).click();
  await page.waitForFunction(() => !window.__ml.ch3.playing, null, { timeout: 30000 });
  let r = await page.evaluate(() => [0, 1, 2, 3].map((i) => window.__ml.ch3.predictCorner(i)).join(''));
  ok(r === '0010', `the neuron learns "sunny and calm" (predictions ${r})`);
  await page.locator('#a-single-neuron .lab').screenshot({ path: `shots/ch3-${vp.name}.png` });

  await sec.getByRole('button', { name: 'The tricky one' }).click();
  await sec.getByRole('button', { name: /let it learn/i }).click();
  await page.waitForFunction(() => !window.__ml.ch3.playing, null, { timeout: 30000 });
  r = await page.evaluate(() => ({ p: [0, 1, 2, 3].map((i) => window.__ml.ch3.predictCorner(i)).join(''), loss: window.__ml.ch3.neuron.loss([[0, 0], [0, 1], [1, 0], [1, 1]], [[0], [1], [1], [0]]) }));
  ok(r.p !== '0110' && r.loss > 0.45, `a single neuron cannot learn the tricky one (predictions ${r.p}, error stuck at ${r.loss.toFixed(2)})`);
  await page.locator('#a-single-neuron .lab').screenshot({ path: `shots/ch3-xor-${vp.name}.png` });
};

checks.ch4 = async (page, ok, vp) => {
  const sec = page.locator('#a-neural-network');
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const run = async (dataset, neurons, layers) => {
    await sec.getByRole('button', { name: dataset }).click();
    await sec.getByRole('button', { name: layers === 2 ? '2 layers' : '1 layer' }).click();
    await sec.getByRole('slider', { name: 'Neurons per layer' }).evaluate((el, n) => { el.value = n; el.dispatchEvent(new Event('input', { bubbles: true })); }, neurons);
    const t0 = Date.now();
    await sec.getByRole('button', { name: /^.?\s*Play/ }).click();
    await page.waitForFunction(() => window.__ml.ch4.done, null, { timeout: 120000 });
    return page.evaluate((secs) => ({ acc: window.__ml.ch4.accuracy(), step: window.__ml.ch4.step, loss: window.__ml.ch4.loss(), secs }), (Date.now() - t0) / 1000);
  };
  let r = await run('Circles', 4, 1);
  ok(r.acc === 1, `circles: 4 neurons reach ${Math.round(r.acc * 100)}% in ${r.step} steps (${r.secs.toFixed(1)}s)`);
  r = await run('Four corners', 4, 1);
  ok(r.acc === 1, `four corners: ${Math.round(r.acc * 100)}% in ${r.step} steps (${r.secs.toFixed(1)}s)`);
  await page.locator('#a-neural-network .lab').screenshot({ path: `shots/ch4-xor-${vp.name}.png` });
  r = await run('Spirals', 8, 2);
  ok(r.acc >= 0.98, `spirals: 2×8 network reaches ${Math.round(r.acc * 100)}% in ${r.step} steps (${r.secs.toFixed(1)}s)`);
  await page.locator('#a-neural-network .lab').screenshot({ path: `shots/ch4-spiral-${vp.name}.png` });
  // Scrub back to the start: the boundary must return to its untrained state.
  await sec.locator('.timeline input[type=range]').evaluate((el) => { el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const early = await page.evaluate(() => window.__ml.ch4.accuracy());
  ok(early < 0.8, `scrubbing to step 0 shows the untrained network (${Math.round(early * 100)}%)`);
  await page.locator('#a-neural-network .lab').screenshot({ path: `shots/ch4-spiral-start-${vp.name}.png` });
  if (vp.name === 'desktop') {
    r = await run('Spirals', 2, 1);
    ok(r.acc < 0.9, `spirals: a 2-neuron network can't do it (${Math.round(r.acc * 100)}% after ${r.step} steps)`);
  }
};

export default checks;
