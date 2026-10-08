// Per-chapter checks used by e2e.mjs. Each receives (page, ok, viewport).
const shot = (page, sel, name) => page.locator(sel).screenshot({ path: `shots/${name}.png` });

export default {
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
