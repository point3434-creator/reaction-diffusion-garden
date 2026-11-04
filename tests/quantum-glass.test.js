'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('Quantum glass transmits its configurable floor and keeps controls isolated and saved', async t => {
  const options = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 0.5 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8').replace(/<link[^>]*>/g, '')
    .replace('  // ---- go ----', 'window.qAudit = { state, getSim: () => sim, getGL: () => gl, render, textures: () => materialTexturesReady };\n  // ---- go ----');
  await page.route('https://**/*', route => route.abort());
  await page.route('http://garden.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://garden.test/');
  await page.getByRole('button', { name: 'Quantum', exact: true }).click();
  await page.getByRole('tab', { name: 'Look', exact: true }).click();
  assert.equal(await page.locator('#quantumFloor').count(), 1);
  assert.equal(await page.locator('#quantumFloor').isVisible(), true);
  await page.evaluate(async () => { qAudit.state.paused = true; await qAudit.textures(); });
  assert.equal(await page.evaluate(() => qAudit.getGL() instanceof WebGL2RenderingContext), true);
  await page.locator('#qFloorColor').fill('#18384d');
  await page.locator('#qFloorGrid').check();
  const measure = () => page.evaluate(() => {
    const s = qAudit.getSim(); s.clear();
    // A broad slab lets us distinguish clear faces from beveled edges.
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) s.A[y * s.w + x] = x > s.w * 0.3 && x < s.w * 0.55 ? -1 : 0;
    qAudit.render();
    const gl = qAudit.getGL(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const bytes = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    if (gl.getError()) throw new Error('Quantum render failed');
    const stats = { face: [], edge: [], floor: [] };
    for (let y = Math.round(h * 0.2); y < h * 0.7; y++) for (let x = 0; x < w; x++) {
      const key = x > w * 0.4 && x < w * 0.45 ? 'face' : x > w * 0.29 && x < w * 0.32 ? 'edge' : x > w * 0.1 && x < w * 0.2 ? 'floor' : null;
      if (key) stats[key].push((bytes[(y * w + x) * 4] + bytes[(y * w + x) * 4 + 1] + bytes[(y * w + x) * 4 + 2]) / 3);
    }
    return Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { mean: v.reduce((a, b) => a + b, 0) / v.length, spread: Math.max(...v) - Math.min(...v) }]));
  });
  const grid = await measure();
  assert.ok(grid.face.spread > 2, 'floor grid remains visible through the face');
  assert.ok(grid.edge.mean > grid.face.mean + 4, 'beveled edges catch more light than the clear face');
  await page.locator('#qFloorGrid').uncheck();
  const plain = await measure();
  assert.ok(grid.floor.spread > plain.floor.spread + 2, 'floor pattern can be disabled');
  await page.locator('#qFloorColor').fill('#627988');
  const lighter = await measure();
  assert.ok(lighter.face.mean > plain.face.mean + 20, 'glass transmits a changed floor colour');
  await page.reload();
  await page.getByRole('tab', { name: 'Look', exact: true }).click();
  assert.equal(await page.locator('#qFloorColor').inputValue(), '#627988');
  assert.equal(await page.locator('#qFloorGrid').isChecked(), false);
  await page.getByRole('tab', { name: 'Dish', exact: true }).click();
  await page.getByRole('button', { name: 'Mould', exact: true }).click();
  assert.equal(await page.locator('#quantumFloor').isVisible(), false);
  assert.deepEqual(errors, []);
});
