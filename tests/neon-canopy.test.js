'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('Neon Canopy drives recurring pulses in the real Neon renderer', async t => {
  const options = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options);
  t.after(() => browser.close());
  // SwiftShader must keep pace with live audio; this test checks pulse timing.
  // Material appearance is covered separately at full resolution in material-shaders.test.js.
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 0.125 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8')
    .replace(/<link[^>]*>/g, '')
    .replace('function analyse(now) {', 'function analyse(now) { neonAudit.frames++;')
    .replace('  // ---- go ----', 'window.neonAudit = { music, state, frame, frames: 0, getGL: () => gl };\n  // ---- go ----');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { neonAudit.state.paused = true; });
  assert.equal(await page.evaluate(() => neonAudit.getGL() instanceof WebGL2RenderingContext), true);
  const decay = await page.evaluate(() => {
    const raf = window.requestAnimationFrame, result = [];
    // Advance visual time deterministically without creating extra animation loops.
    window.requestAnimationFrame = () => 0;
    try {
      for (const frames of [1, 3, 12]) {
        const start = performance.now();
        neonAudit.music.lastKick = start; neonAudit.music.beat = 1;
        for (let i = 1; i <= frames; i++) neonAudit.frame(start + i * 200 / frames);
        result.push(neonAudit.music.beat);
      }
    } finally {
      window.requestAnimationFrame = raf;
      neonAudit.music.lastKick = 0; neonAudit.music.beat = 0;
    }
    return result;
  });
  for (const level of decay) assert.ok(Math.abs(level - Math.pow(0.86, 13)) < 1e-6,
    '200 ms of pulse decay must be identical regardless of dropped visual frames');
  await page.getByRole('tab', { name: 'Look', exact: true }).click();
  await page.getByRole('button', { name: 'Neon', exact: true }).click();
  assert.equal(await page.locator('#mats button[aria-pressed="true"]').textContent(), 'Neon');
  await page.getByRole('tab', { name: 'Sound', exact: true }).click();
  await page.getByRole('button', { name: 'Neon Canopy', exact: true }).dblclick();
  // Fill the 40-frame history twice: startup's empty average can mask a broken detector.
  await page.waitForFunction(() => neonAudit.frames >= 80 && neonAudit.music.kicks >= 2, null, { timeout: 10000 });
  await page.evaluate(() => {
    const audit = neonAudit;
    audit.firstKick = audit.music.kicks;
    audit.minimum = 1; audit.maximum = 0;
    audit.monitor = setInterval(() => {
      audit.minimum = Math.min(audit.minimum, audit.music.beat);
      audit.maximum = Math.max(audit.maximum, audit.music.beat);
    }, 16);
  });
  await page.waitForFunction(() => neonAudit.music.kicks >= neonAudit.firstKick + 6, null, { timeout: 10000 });
  const result = await page.evaluate(() => {
    clearInterval(neonAudit.monitor);
    return { kicks: neonAudit.music.kicks, minimum: neonAudit.minimum, maximum: neonAudit.maximum };
  });
  t.diagnostic(JSON.stringify(result));
  assert.ok(result.maximum > 0.6 && result.minimum < 0.25,
    'the Neon pulse must repeatedly rise and decay');
  assert.deepEqual(errors, []);
  const out = path.join(__dirname, '../test-results/neon-canopy');
  fs.mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'jukebox-neon-canopy.png') });
  await page.getByRole('button', { name: 'Pause Neon Canopy', exact: true }).click();
});
