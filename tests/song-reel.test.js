'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '../web');
const recordings = ['Liquid_Bloom.mp3', 'Mycelium_Dream_Violin.mp3', 'Prism_Orchard.mp3', 'Neon_Thistle.mp3', 'Velvet_Circuit.mp3'];
const builtInCount = recordings.length + 6;
let browser, server;

function recording(name = 'custom.wav', seconds = 12) {
  const buffer = Buffer.alloc(44 + 8000 * 2 * seconds);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(buffer.length - 44, 40);
  return { name, mimeType: 'audio/wav', buffer };
}

test.before(async () => {
  const allowed = new Map([['/', 'index.html'], ...recordings.map(name => ['/audio/' + name, 'audio/' + name])]);
  server = http.createServer((req, res) => {
    const file = allowed.get(new URL(req.url, 'http://localhost').pathname);
    if (!file) { res.writeHead(404).end(); return; }
    const bytes = fs.readFileSync(path.join(root, file));
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
    const headers = { 'Content-Type': file.endsWith('.mp3') ? 'audio/mpeg' : 'text/html; charset=utf-8', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' };
    if (range) headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + bytes.length;
    res.writeHead(range ? 206 : 200, headers);
    res.end(bytes.subarray(start, end + 1));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const options = { headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  browser = await chromium.launch(options);
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function showSound(page) {
  if (page.viewportSize().width < 880 && !await page.locator('#panel').evaluate(element => element.classList.contains('open'))) {
    await page.locator('#handle').click();
  }
  // The selected tab survives reload, so reveal the dish control before pausing it.
  await page.locator('[data-tab="dish"]').click();
  if (await page.locator('#pause').getAttribute('aria-pressed') !== 'true') await page.locator('#pause').click();
  await page.locator('[data-tab="sound"]').click();
}

async function open(t, storageUnavailable = false, viewport = { width: 1280, height: 900 }) {
  // A fresh context isolates each case's real IndexedDB; reload keeps this context.
  const page = await browser.newPage({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  page.setDefaultTimeout(5000);
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'song library interactions must not throw'));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(storageUnavailable => {
    const OriginalAudio = window.Audio;
    window.Audio = function (...args) { window.testAudio = new OriginalAudio(...args); return window.testAudio; };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
    };
    // This case alone models a browser policy that rejects storage access.
    if (storageUnavailable) IDBFactory.prototype.open = function () { throw new DOMException('Storage unavailable', 'SecurityError'); };
  }, storageUnavailable);
  await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
  await showSound(page);
  return page;
}

async function ready(page) {
  await page.waitForFunction(() => !document.getElementById('gardenAudioLoad').disabled);
}

async function importSongs(page, files, count) {
  await ready(page);
  await page.locator('#gardenAudioFiles').setInputFiles(files);
  await page.waitForFunction(count => document.querySelectorAll('#gardenScoreLibrary button').length === count, count);
  await ready(page);
}

async function playImported(page, index, duration) {
  await page.locator('#gardenScoreLibrary button').nth(index).click();
  await page.locator('#gardenScorePlay').click();
  await page.waitForFunction(duration => !testAudio.paused && !testAudio.error && testAudio.currentTime > 0 && Math.abs(testAudio.duration - duration) < 0.1, duration);
}

async function title(page, expected) {
  await page.waitForFunction(expected => document.getElementById('gardenScoreTitle').textContent.trim() === expected, expected);
}

async function reload(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await showSound(page);
  await ready(page);
}

async function readable(page, url) {
  return page.evaluate(async url => {
    try { return (await (await fetch(url)).arrayBuffer()).byteLength; } catch (_) { return 0; }
  }, url);
}

test('the song reel confines eleven tracks to a vertically scrollable list of about five rows', async t => {
  const page = await open(t);
  const geometry = await page.locator('#gardenScoreLibrary').evaluate(element => {
    const buttons = [...element.querySelectorAll('button')];
    const box = element.getBoundingClientRect();
    return {
      count: buttons.length,
      scrollHeight: element.scrollHeight,
      height: element.clientHeight,
      rows: buttons.filter(button => { const row = button.getBoundingClientRect(); return row.top >= box.top && row.bottom <= box.bottom; }).length,
      oneColumn: buttons.every(button => Math.abs(button.getBoundingClientRect().left - buttons[0].getBoundingClientRect().left) < 2)
    };
  });
  assert.equal(geometry.count, builtInCount);
  assert.ok(geometry.scrollHeight > geometry.height, 'the song list must scroll instead of displaying all tracks at once');
  assert.ok(geometry.rows >= 4 && geometry.rows <= 6, 'the compact reel should show about five rows');
  assert.equal(geometry.oneColumn, true, 'tracks form one vertical reel');
});

test('a nearby Play control starts and pauses the selected song in sync with the main transport', async t => {
  const page = await open(t);
  await ready(page);
  const nearby = page.locator('#gardenLibraryPlay');
  assert.equal(await nearby.count(), 1, 'the reel needs its own nearby Play/Pause control');
  await page.locator('#gardenScoreLibrary button').nth(1).click();
  await title(page, 'Mycelium Dream · Violin');
  await nearby.click();
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentSrc.endsWith('/Mycelium_Dream_Violin.mp3') && testAudio.currentTime > 0);
  assert.equal(await page.locator('#gardenScorePlay').textContent(), 'Pause');
  assert.match(await nearby.textContent(), /Pause$/);
  assert.equal(await nearby.getAttribute('aria-pressed'), 'true');
  await nearby.click();
  await page.waitForFunction(() => testAudio.paused);
  assert.equal(await page.locator('#gardenScorePlay').textContent(), 'Play');
  assert.match(await nearby.textContent(), /Play$/);
  assert.equal(await nearby.getAttribute('aria-pressed'), 'false');
  await page.locator('#gardenScorePlay').click();
  await page.waitForFunction(() => !testAudio.paused && document.getElementById('gardenLibraryPlay').getAttribute('aria-pressed') === 'true' && /Pause$/.test(document.getElementById('gardenLibraryPlay').textContent));
  const control = await nearby.boundingBox(), reel = await page.locator('#gardenScoreLibrary').boundingBox();
  assert.ok(control.y + control.height <= reel.y && reel.y - (control.y + control.height) < 80, 'the shared control stays immediately above the reel');
});

test('double-clicking a paused recording selects and starts it immediately', async t => {
  const page = await open(t);
  await ready(page);
  await page.locator('#gardenScoreLibrary button').nth(1).dblclick();
  await title(page, 'Mycelium Dream · Violin');
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentSrc.endsWith('/Mycelium_Dream_Violin.mp3') && testAudio.currentTime > 0);
  assert.equal(await page.locator('#gardenScorePlay').textContent(), 'Pause');
});

test('double-clicking a paused live beat selects and starts synthesis immediately', async t => {
  const page = await open(t);
  await ready(page);
  await page.locator('#gardenScoreLibrary button').nth(5).dblclick();
  await title(page, 'Dewdrop Swing');
  await page.waitForFunction(() => document.querySelector('#beatChips button').getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('#gardenScorePlay').textContent(), 'Pause');
  assert.equal(await page.evaluate(() => testAudio.paused), true);
});

test('wheel and desktop dragging scroll the reel without changing playback', async t => {
  const page = await open(t);
  await ready(page);
  await page.locator('#gardenScorePlay').click();
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentTime > 0);
  const source = await page.evaluate(() => testAudio.currentSrc);
  const list = page.locator('#gardenScoreLibrary');
  await list.hover();
  await page.mouse.wheel(0, 180);
  await page.waitForFunction(() => document.getElementById('gardenScoreLibrary').scrollTop > 0);
  await title(page, 'Liquid Bloom');
  await list.evaluate(element => { element.scrollTop = 0; });
  await list.scrollIntoViewIfNeeded();
  const box = await list.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 10, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById('gardenScoreLibrary').scrollTop > 20);
  await title(page, 'Liquid Bloom');
  assert.equal(await page.evaluate(() => testAudio.currentSrc), source);
  assert.equal(await page.evaluate(() => testAudio.paused), false);
  // A new deliberate click after a drag must not be swallowed by click suppression.
  await list.locator('button').nth(1).click();
  await title(page, 'Mycelium Dream · Violin');
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentSrc.endsWith('/Mycelium_Dream_Violin.mp3'));
});

test('releasing the mouse outside the reel ends an unstarted drag', async t => {
  const page = await open(t);
  await ready(page);
  const list = page.locator('#gardenScoreLibrary');
  await list.scrollIntoViewIfNeeded();
  const box = await list.boundingBox();
  const before = await list.evaluate(element => element.scrollTop);
  await page.mouse.move(box.x + box.width / 2, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 10, box.y + 90);
  await page.mouse.up();
  await page.mouse.move(box.x + box.width / 2, box.y + 30);
  assert.equal(await list.evaluate(element => element.scrollTop), before, 'hovering after release must not resume an old drag');
  assert.equal(await list.evaluate(element => element.classList.contains('dragging')), false);
  assert.equal(await page.locator('#gardenScorePlay').textContent(), 'Play', 'dragging must never start playback');
  await page.locator('#gardenScoreLibrary button').nth(1).focus();
  await page.keyboard.press('Enter');
  await title(page, 'Mycelium Dream · Violin');
});

test('a canceled drag does not swallow the next keyboard selection', async t => {
  const page = await open(t);
  await ready(page);
  const list = page.locator('#gardenScoreLibrary');
  await list.scrollIntoViewIfNeeded();
  const box = await list.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 20, { steps: 5 });
  assert.equal(await list.evaluate(element => element.classList.contains('dragging')), true);
  // Supply the cancellation sent when a browser loses the pointer stream.
  await list.evaluate(element => {
    element.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true }));
    if (element.hasPointerCapture(1)) element.releasePointerCapture(1);
  });
  await page.mouse.move(box.x + box.width + 10, box.y + 20);
  await page.mouse.up();
  await list.locator('button').nth(1).focus();
  await page.keyboard.press('Enter');
  await title(page, 'Mycelium Dream · Violin');
});

test('native keyboard activation selects a track outside the initial five visible rows', async t => {
  const page = await open(t);
  await ready(page);
  const last = page.locator('#gardenScoreLibrary button').nth(builtInCount - 1);
  await last.focus();
  await page.keyboard.press('Space');
  await title(page, 'Neon Canopy');
  assert.equal(await last.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#gardenScorePlay').textContent(), 'Play');
  const visible = await last.evaluate(button => {
    const row = button.getBoundingClientRect(), list = button.parentElement.getBoundingClientRect();
    return row.top >= list.top - 1 && row.bottom <= list.bottom + 1;
  });
  assert.equal(visible, true, 'keyboard focus reveals the selected row inside the reel');
  const first = page.locator('#gardenScoreLibrary button').first();
  await first.focus();
  await page.keyboard.press('Enter');
  await title(page, 'Liquid Bloom');
  for (const [key, index] of [['ArrowDown', 1], ['End', builtInCount - 1], ['ArrowUp', builtInCount - 2], ['Home', 0]]) {
    await page.keyboard.press(key);
    assert.equal(await page.locator('#gardenScoreLibrary button').nth(index).evaluate(button => button === document.activeElement), true, key + ' moves focus through the reel');
    await title(page, 'Liquid Bloom');
    assert.equal(await first.getAttribute('aria-pressed'), 'true', key + ' must not activate a song');
  }
});

test('a forty-one-track mobile library stays bounded with its last song reachable and searchable', async t => {
  const page = await open(t, false, { width: 390, height: 844 });
  const files = Array.from({ length: 30 }, (_, index) => recording('added-' + String(index + 1).padStart(2, '0') + '.wav', 1));
  const totalTracks = builtInCount + files.length;
  await importSongs(page, files, totalTracks);
  const list = page.locator('#gardenScoreLibrary');
  const geometry = await list.evaluate(element => ({
    height: element.clientHeight,
    fullHeight: element.scrollHeight,
    width: element.clientWidth,
    fullWidth: element.scrollWidth,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth
  }));
  assert.ok(geometry.height >= 200 && geometry.height <= 300, 'a larger library must retain a compact reel');
  assert.ok(geometry.fullHeight > geometry.height * 5, 'the larger library scrolls within its bounded viewport');
  assert.ok(geometry.fullWidth <= geometry.width + 1, 'song rows must not overflow horizontally');
  assert.ok(geometry.pageWidth <= geometry.viewportWidth + 1, 'mobile page must not gain horizontal scrolling');
  await list.locator('button').last().click();
  await title(page, 'added-30');
  assert.ok(await list.evaluate(element => element.scrollTop) > 0, 'the last song is reachable by scrolling the reel');
  await page.locator('#gardenSongSearch').fill('added-30');
  assert.equal(await page.locator('#gardenScoreLibrary button:not([hidden])').count(), 1);
  assert.equal(await page.locator('#gardenLibraryCount').textContent(), '1 of ' + totalTracks + ' tracks');
  assert.match(await page.locator('#gardenScoreLibrary button:not([hidden])').textContent(), /added-30/);
  await page.locator('#gardenSongSearch').fill('');
  await list.locator('button').last().click();
  await page.locator('#gardenAudioLoad').scrollIntoViewIfNeeded();
  const screenshots = path.resolve(__dirname, '../test-results/song-reel');
  fs.mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, 'mobile-forty-one-tracks.png') });
});

test('search filters the reel and count without replacing the playing selection', async t => {
  const page = await open(t);
  await ready(page);
  await page.locator('#gardenScorePlay').click();
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentTime > 0);
  const source = await page.evaluate(() => testAudio.currentSrc);
  await page.locator('#gardenSongSearch').fill('marigold');
  assert.equal(await page.locator('#gardenScoreLibrary button:not([hidden])').count(), 1);
  assert.match(await page.locator('#gardenScoreLibrary button:not([hidden])').textContent(), /Marigold Brass/);
  assert.equal(await page.locator('#gardenLibraryCount').textContent(), '1 of ' + builtInCount + ' tracks');
  await title(page, 'Liquid Bloom');
  assert.equal(await page.evaluate(() => testAudio.currentSrc), source);
  assert.equal(await page.evaluate(() => testAudio.paused), false);
  await page.locator('#gardenSongSearch').fill('no such song here');
  assert.equal(await page.locator('#gardenScoreLibrary button:not([hidden])').count(), 0);
  assert.equal(await page.locator('#gardenLibraryCount').textContent(), '0 of ' + builtInCount + ' tracks');
  await page.locator('#gardenSongSearch').fill('');
  assert.equal(await page.locator('#gardenScoreLibrary button:not([hidden])').count(), builtInCount);
  assert.equal(await page.locator('#gardenLibraryCount').textContent(), builtInCount + ' tracks');
  assert.equal(await page.locator('#gardenScoreLibrary button').first().getAttribute('aria-pressed'), 'true');
});

test('arbitrary added songs join Next and natural-end progression after the built-in tracks', async t => {
  const page = await open(t);
  await importSongs(page, [recording(), recording('another.wav', 18)], builtInCount + 2);
  assert.equal(await page.locator('#gardenLibraryCount').textContent(), (builtInCount + 2) + ' tracks');
  assert.match(await page.locator('#gardenLibraryStatus').textContent(), /saved|stored/i);
  await page.locator('#gardenScoreLibrary button').nth(builtInCount - 1).click();
  await page.locator('#gardenScoreNext').click();
  await title(page, 'custom');
  await page.locator('#gardenScorePlay').click();
  await page.waitForFunction(() => !testAudio.paused && Math.abs(testAudio.duration - 12) < 0.1);
  await page.evaluate(() => { testAudio.currentTime = testAudio.duration - 0.5; });
  await page.waitForFunction(() => !testAudio.seeking && testAudio.currentTime > 11);
  await title(page, 'another');
  await page.waitForFunction(() => !testAudio.paused && Math.abs(testAudio.duration - 18) < 0.1);
  await page.locator('#gardenScoreNext').click();
  await title(page, 'Liquid Bloom');
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentSrc.endsWith('/Liquid_Bloom.mp3'));
});

test('saved imports survive a same-origin reload and play only after a user request', async t => {
  const page = await open(t);
  await importSongs(page, recording(), builtInCount + 1);
  assert.equal(await page.evaluate(() => testAudio.paused), true, 'import must not start playback');
  await playImported(page, builtInCount, 12);
  const source = await page.evaluate(() => testAudio.currentSrc);
  assert.ok(source.startsWith('blob:'));
  await reload(page);
  assert.equal(await page.locator('#gardenScoreLibrary button').count(), builtInCount + 1);
  assert.equal(await page.evaluate(() => testAudio.paused), true, 'restore must not autoplay');
  await playImported(page, builtInCount, 12);
  assert.notEqual(await page.evaluate(() => testAudio.currentSrc), source, 'reload reconstructs a usable URL from the saved recording');
});

test('reimporting an added filename replaces one entry and persists the new recording', async t => {
  const page = await open(t);
  await importSongs(page, recording(), builtInCount + 1);
  await playImported(page, builtInCount, 12);
  const source = await page.evaluate(() => testAudio.currentSrc);
  await importSongs(page, recording('custom.wav', 18), builtInCount + 1);
  await page.waitForFunction(() => !testAudio.paused && Math.abs(testAudio.duration - 18) < 0.1);
  assert.notEqual(await page.evaluate(() => testAudio.currentSrc), source);
  assert.equal(await readable(page, source), 0, 'the replaced object URL is released');
  await reload(page);
  assert.equal(await page.locator('#gardenScoreLibrary button').count(), builtInCount + 1);
  await playImported(page, builtInCount, 18);
});

test('a matching original filename remains a replacement and is restored after reload', async t => {
  const page = await open(t);
  await importSongs(page, recording('Liquid_Bloom.mp3'), builtInCount);
  await playImported(page, 0, 12);
  await title(page, 'Liquid Bloom');
  assert.equal(await page.locator('#gardenSongRemove').isVisible(), false, 'the original track stays in the built-in library');
  await reload(page);
  assert.equal(await page.locator('#gardenScoreLibrary button').count(), builtInCount);
  await playImported(page, 0, 12);
});

test('removing the playing added song stops it, revokes its URL, and persists removal', async t => {
  const page = await open(t);
  await importSongs(page, recording(), builtInCount + 1);
  await playImported(page, builtInCount, 12);
  const source = await page.evaluate(() => testAudio.currentSrc);
  await page.locator('#gardenSongRemove').click();
  await page.waitForFunction(count => document.querySelectorAll('#gardenScoreLibrary button').length === count && /removed/i.test(document.getElementById('gardenLibraryStatus').textContent), builtInCount);
  assert.equal(await page.evaluate(() => testAudio.paused), true);
  assert.equal(await page.locator('#gardenScorePlay').textContent(), 'Play');
  assert.equal(await readable(page, source), 0);
  assert.equal(await page.locator('#gardenSongRemove').isVisible(), false);
  await reload(page);
  assert.equal(await page.locator('#gardenScoreLibrary button').count(), builtInCount);
});

test('removing an added selection preserves independent external song playback', async t => {
  const page = await open(t);
  await importSongs(page, recording(), builtInCount + 1);
  await playImported(page, builtInCount, 12);
  await page.locator('#file').setInputFiles(recording('external.wav', 18));
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentTime > 0);
  const source = await page.evaluate(() => testAudio.currentSrc);
  await page.locator('#gardenSongRemove').click();
  await page.waitForFunction(count => document.querySelectorAll('#gardenScoreLibrary button').length === count, builtInCount);
  assert.equal(await page.evaluate(() => testAudio.currentSrc), source);
  assert.equal(await page.evaluate(() => testAudio.paused), false, 'removing a library item must not stop an independent source');
});

test('removing the former song keeps an active microphone stream listening', async t => {
  const page = await open(t);
  await importSongs(page, recording(), builtInCount + 1);
  await playImported(page, builtInCount, 12);
  await page.locator('#micBtn').click();
  await page.waitForFunction(() => document.getElementById('track').textContent.includes('Listening to the room'));
  assert.equal(await page.evaluate(() => testAudio.paused), true);
  await page.locator('#gardenSongRemove').click();
  await page.waitForFunction(count => document.querySelectorAll('#gardenScoreLibrary button').length === count, builtInCount);
  assert.match(await page.locator('#track').textContent(), /Listening to the room/, 'removing the paused song must not stop microphone input');
  assert.equal(await page.locator('#musicOff').isVisible(), true, 'the independent microphone remains active');
});

test('unavailable browser storage leaves an honest session-only playable import', async t => {
  const page = await open(t, true);
  await importSongs(page, recording(), builtInCount + 1);
  assert.match(await page.locator('#gardenLibraryStatus').textContent(), /could not save|this session|session only/i);
  await playImported(page, builtInCount, 12);
  await reload(page);
  assert.equal(await page.locator('#gardenScoreLibrary button').count(), builtInCount, 'failed persistence must not be presented as a saved import');
});
