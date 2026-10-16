'use strict';
// Run the real player against native browser Blob URLs and a short silent WAV.
// Assemble in memory so this also exercises edits to src/ before publishing the page.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const assembled = spawnSync(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-B', '-c',
  "import sys; from tools.splice import PAGE, splice; sys.stdout.buffer.write(splice(PAGE.read_text(encoding='utf-8')).encode('utf-8'))"
], { cwd: root, encoding: 'utf8' });
assert.equal(assembled.status, 0, assembled.stderr);
const html = assembled.stdout.replace(/<link[^>]*>/g, '');
const wav = Buffer.alloc(44 + 8000 * 2 * 30);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const namedFile = { name: 'Liquid_Bloom.mp3', mimeType: 'audio/wav', buffer: wav };

async function openPlayer(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.evaluate(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /^(webgl2?|experimental-webgl)$/.test(type) ? null : getContext.call(this, type, ...args);
    };
    // Observe the real, detached media element; playback and URL handling stay native.
    const Audio = window.Audio;
    window.Audio = function (...args) { window.testAudio = new Audio(...args); return window.testAudio; };
  });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.locator('#pause').click();
  await page.locator('[data-tab="sound"]').click();
  await page.locator('#gardenAudioFiles').setInputFiles(namedFile);
  await page.locator('#gardenScorePlay').click();
  await page.waitForFunction(() => testAudio.readyState >= 2 && !testAudio.paused);
  return page;
}

async function readable(page, url) {
  return page.evaluate(async url => {
    try { return (await (await fetch(url)).arrayBuffer()).byteLength; } catch (_) { return 0; }
  }, url);
}

(async () => {
  const options = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options);
  const cases = [
    ['ordinary song selection preserves the library recording', async page => {
      const url = await page.evaluate(() => testAudio.src);
      await page.locator('#file').setInputFiles({ ...namedFile, name: 'ordinary.wav' });
      assert.equal(await readable(page, url), wav.length, 'ordinary song picker revoked a library-owned URL');
      await page.locator('#gardenScorePlay').click();
      await page.waitForFunction(url => testAudio.src === url && !testAudio.paused && !testAudio.error, url);
    }],
    ['persisted pagehide preserves imported recordings', async page => {
      const url = await page.evaluate(() => testAudio.src);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      assert.equal(await readable(page, url), wav.length, 'cached page retained a revoked recording URL');
    }],
    ['final pagehide releases imported recordings', async page => {
      const url = await page.evaluate(() => testAudio.src);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
      assert.equal(await readable(page, url), 0);
    }],
    ['replacing a playing recording switches to its new URL', async page => {
      const old = await page.evaluate(() => testAudio.src);
      await page.locator('#gardenAudioFiles').setInputFiles(namedFile);
      assert.notEqual(await page.evaluate(() => testAudio.src), old, 'player still points at the revoked recording');
      await page.waitForFunction(() => testAudio.readyState >= 2 && !testAudio.paused && !testAudio.error);
      assert.equal(await readable(page, old), 0, 'replaced recording URL leaked');
      assert.equal(await readable(page, await page.evaluate(() => testAudio.src)), wav.length);
    }],
    ['replacing a paused recording preserves its paused state', async page => {
      await page.locator('#gardenScorePlay').click();
      const old = await page.evaluate(() => testAudio.src);
      await page.locator('#gardenAudioFiles').setInputFiles(namedFile);
      assert.notEqual(await page.evaluate(() => testAudio.src), old, 'paused player still points at the revoked recording');
      assert.equal(await page.evaluate(() => testAudio.paused), true);
      await page.locator('#gardenScorePlay').click();
      await page.waitForFunction(() => testAudio.readyState >= 2 && !testAudio.paused && !testAudio.error);
    }]
  ];
  let failures = 0;
  try {
    for (const [name, check] of cases) {
      let page;
      try { page = await openPlayer(browser); await check(page); console.log('PASS ' + name); }
      catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.message); }
      finally { if (page) await page.close(); }
    }
  } finally { await browser.close(); }
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
