'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('Resonance integrates presets, painting, music, resizing and saved mode with real WebGL', async t => {
  const options = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 800, height: 700 }, deviceScaleFactor: 0.25 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8').replace(/<link[^>]*>/g, '')
    .replace('  // ---- go ----', 'window.cglAudit = { state, music, getSim: () => sim, getGL: () => gl, plant, clearPatch };\n  // ---- go ----');
  await page.route('https://**/*', route => route.abort());
  await page.route('http://garden.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://garden.test/');
  assert.equal(await page.getByRole('button', { name: 'Resonance', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Resonance', exact: true }).click();
  await page.evaluate(() => { cglAudit.state.paused = true; });
  assert.equal(await page.evaluate(() => cglAudit.getGL() instanceof WebGL2RenderingContext), true);
  assert.deepEqual(await page.locator('#presets button').allTextContents(), ['Spiral Bloom', 'Wave Garden', 'Phase Storm']);
  assert.equal(await page.locator('#lab1').textContent(), 'dispersion');
  assert.equal(await page.locator('#lab2').textContent(), 'twist');
  for (const selector of ['#map', '#ecg', '#photoBtn', '#stirBtn', '#paceBtn']) assert.equal(await page.locator(selector).isVisible(), false);
  const fingerprints = [];
  for (const name of ['Spiral Bloom', 'Wave Garden', 'Phase Storm']) {
    await page.getByRole('button', { name, exact: true }).click();
    fingerprints.push(await page.evaluate(() => {
      const s = cglAudit.getSim(); s.step({ b: cglAudit.state.cb, c: cglAudit.state.cc }, 40);
      if (![...s.U, ...s.V].every(Number.isFinite)) throw new Error('Non-finite CGL field');
      return Array.from(s.R.slice(0, 20));
    }));
  }
  assert.notDeepEqual(fingerprints[0], fingerprints[1]); assert.notDeepEqual(fingerprints[1], fingerprints[2]);
  await page.locator('#feed').evaluate(el => { el.value = '-1.25'; el.dispatchEvent(new Event('input')); });
  await page.locator('#kill').evaluate(el => { el.value = '0.75'; el.dispatchEvent(new Event('input')); });
  assert.deepEqual(await page.evaluate(() => [cglAudit.state.cb, cglAudit.state.cc]), [-1.25, 0.75]);
  const before = await page.evaluate(() => cglAudit.getSim().time);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => cglAudit.getSim().time), before, 'pause freezes the field');
  await page.evaluate(() => { cglAudit.state.paused = false; });
  await page.waitForFunction(t0 => cglAudit.getSim().time > t0, before);
  await page.evaluate(() => { cglAudit.state.paused = true; });
  await page.setViewportSize({ width: 420, height: 760 });
  await page.waitForFunction(() => cglAudit.getSim().h > cglAudit.getSim().w);
  assert.deepEqual(await page.evaluate(() => [cglAudit.state.cb, cglAudit.state.cc]), [-1.25, 0.75]);
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(() => cglAudit.getSim().U.some(v => v !== 0)), false);
  await page.mouse.click(130, 100);
  assert.equal(await page.evaluate(() => cglAudit.getSim().U.some(v => v !== 0)), true);
  await page.evaluate(() => { cglAudit.getSim().clear(); cglAudit.plant(0.8); cglAudit.clearPatch(0.8); });
  assert.equal(await page.evaluate(() => cglAudit.getSim().R.some(v => v > 0)), true, 'audio impulse creates a bounded CGL disturbance');
  await page.keyboard.press('n');
  await page.getByRole('tab', { name: 'Look', exact: true }).click();
  for (const name of ['Black Opal', 'Neon', 'Crystal Shell']) {
    await page.getByRole('button', { name, exact: true }).click();
    assert.equal(await page.locator('#mats button[aria-pressed="true"]').textContent(), name);
  }
  await page.reload();
  assert.equal(await page.locator('#chem button[aria-pressed="true"]').textContent(), 'Resonance');
  assert.equal(await page.evaluate(() => cglAudit.getSim().kind), 'cgl');
  await page.getByRole('tab', { name: 'Dish', exact: true }).click();
  await page.getByRole('button', { name: 'Quantum', exact: true }).click();
  assert.equal(await page.evaluate(() => cglAudit.getSim().kind), 'quantum');
  await page.getByRole('button', { name: 'Garden', exact: true }).click();
  assert.equal(await page.locator('#lab1').textContent(), 'feed');
  assert.equal(await page.evaluate(() => cglAudit.getSim().kind), 'garden');
  assert.deepEqual(errors, []);
});
