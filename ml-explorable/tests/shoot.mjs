// Screenshot helper: node tests/shoot.mjs <selector> <name> [width]
import { chromium } from 'playwright-core';
const [sel = 'body', name = 'page', width = '1280'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: +width, height: 900 }, deviceScaleFactor: 1 });
await p.goto(process.env.URL || 'http://localhost:5173/', { waitUntil: 'networkidle' });
await p.locator(sel).first().scrollIntoViewIfNeeded();
await p.waitForTimeout(+(process.env.WAIT || 1200));
await p.locator(sel).first().screenshot({ path: `shots/${name}.png` });
await b.close();
