'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../web');
const tracks = ['Liquid_Bloom.mp3', 'Mycelium_Dream_Violin.mp3', 'Prism_Orchard.mp3', 'Neon_Thistle.mp3', 'Velvet_Circuit.mp3'];

test('all five bundled recordings play through the existing soundtrack controls', async () => {
  const allowed = new Map([['/', 'index.html'], ...tracks.map(name => ['/audio/' + name, 'audio/' + name])]);
  const server = http.createServer((req, res) => {
    const file = allowed.get(new URL(req.url, 'http://localhost').pathname);
    if (!file) { res.writeHead(404).end(); return; }
    const bytes = fs.readFileSync(path.join(root, file));
    res.writeHead(200, { 'Content-Type': file.endsWith('.mp3') ? 'audio/mpeg' : 'text/html; charset=utf-8', 'Content-Length': bytes.length });
    res.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const options = { headless: true };
    if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(options);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', route => route.abort());
    await page.addInitScript(() => {
      const OriginalAudio = window.Audio;
      window.Audio = function (...args) { window.testAudio = new OriginalAudio(...args); return window.testAudio; };
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
      };
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('#pause').click();
    await page.locator('[data-tab="sound"]').click();
    assert.equal(await page.locator('#gardenScoreLibrary button').count(), 5);
    assert.equal(await page.locator('#beatChips button').count(), 5, 'keep the original synthesized beats');
    for (let i = 0; i < tracks.length; i++) {
      await page.locator('#gardenScoreLibrary button').nth(i).click();
      await page.locator('#gardenScorePlay').click();
      await page.waitForFunction(name => testAudio.currentSrc.endsWith('/' + name) &&
        !testAudio.error && !testAudio.paused && testAudio.currentTime > 0, tracks[i], { timeout: 15000 });
      const media = await page.evaluate(() => ({ duration: testAudio.duration, error: testAudio.error }));
      assert.ok(Number.isFinite(media.duration) && media.duration > 30, tracks[i] + ' must decode as a full recording');
      assert.equal(media.error, null);
      console.log(tracks[i] + ': playback started, duration ' + media.duration.toFixed(2) + ' s');
      await page.locator('#gardenScorePlay').click();
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
