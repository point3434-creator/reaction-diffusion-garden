'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '../web');
const recordings = ['Liquid_Bloom.mp3', 'Mycelium_Dream_Violin.mp3', 'Prism_Orchard.mp3', 'Neon_Thistle.mp3', 'Velvet_Circuit.mp3'];
const titles = ['Liquid Bloom', 'Mycelium Dream · Violin', 'Prism Orchard', 'Neon Thistle', 'Velvet Circuit', 'Dewdrop Swing', 'Sunlit Fern', 'Bramble Breaks', 'Moonlit Moss', 'Marigold Brass', 'Neon Canopy'];
const builtInCount = titles.length;
let browser, server;

test.before(async () => {
  const allowed = new Map([['/', 'index.html'], ...recordings.map(name => ['/audio/' + name, 'audio/' + name])]);
  server = http.createServer((req, res) => {
    const file = allowed.get(new URL(req.url, 'http://localhost').pathname);
    if (!file) { res.writeHead(404).end(); return; }
    const bytes = fs.readFileSync(path.join(root, file));
    // Native media seeking needs the same byte-range contract as static hosting.
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

async function open(t, useClock = false) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(5000);
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'jukebox interactions must not throw'));
  await page.route('https://**/*', route => route.abort());
  if (useClock) await page.clock.install();
  await page.addInitScript(() => {
    const OriginalAudio = window.Audio;
    window.Audio = function (...args) { window.testAudio = new OriginalAudio(...args); return window.testAudio; };
    // Observe the native analysis signal; synthesis and audio routing stay real.
    const createAnalyser = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function (...args) {
      window.testAnalyser = createAnalyser.apply(this, args);
      return window.testAnalyser;
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
    };
  });
  await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('#pause').click();
  await page.locator('[data-tab="sound"]').click();
  // Freeze after setup so real-time callbacks cannot race fastForward and rewind the clock.
  if (useClock) await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  return page;
}

async function selected(page, index) {
  await page.waitForFunction(({ index, title }) => {
    const buttons = document.querySelectorAll('#gardenScoreLibrary button');
    return buttons[index]?.getAttribute('aria-pressed') === 'true' &&
      document.getElementById('gardenScoreTitle').textContent === title;
  }, { index, title: titles[index] });
  assert.equal(await page.locator('#gardenScoreLibrary [aria-pressed="true"]').count(), 1);
}

async function playing(page) {
  await page.waitForFunction(() => document.getElementById('gardenScorePlay').textContent.trim() === 'Pause');
}

async function paused(page) {
  await page.waitForFunction(() => document.getElementById('gardenScorePlay').textContent.trim() === 'Play');
}

async function start(page, index) {
  await page.locator('#gardenScoreLibrary button').nth(index).click();
  await selected(page, index);
  await page.locator('#gardenScorePlay').click();
  await playing(page);
}

async function setRange(page, id, value) {
  await page.locator(id).evaluate((element, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function nearEnd(page) {
  await page.waitForFunction(() => Number.isFinite(testAudio.duration) && testAudio.duration > 0 && !testAudio.paused);
  await page.evaluate(() => { testAudio.currentTime = testAudio.duration - 0.5; });
  await page.waitForFunction(() => !testAudio.seeking && testAudio.currentTime > testAudio.duration - 1);
}

async function signal(page, audible) {
  await page.waitForFunction(audible => {
    const samples = new Float32Array(testAnalyser.fftSize);
    testAnalyser.getFloatTimeDomainData(samples);
    const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    return audible ? peak > 0.001 : peak < 0.000001;
  }, audible, { timeout: 5000 });
}

test('one visible library offers five recordings followed by six live beats', async t => {
  const page = await open(t);
  const tracks = page.locator('#gardenScoreLibrary button');
  assert.equal(await tracks.count(), builtInCount, 'all built-in tracks belong in the common library');
  for (const track of await tracks.all()) assert.equal(await track.isVisible(), true);
  assert.equal(await page.locator('#beats').isVisible(), false, 'the old separate beat player is hidden');
  assert.equal(await page.locator('#beatChips button').count(), builtInCount - recordings.length, 'legacy beat bindings remain available');
  for (let index = 0; index < titles.length; index++) {
    await tracks.nth(index).click();
    await selected(page, index);
    await paused(page);
  }
});

test('Previous and Next wrap across both source types while preserving pause', async t => {
  const page = await open(t);
  await page.locator('#gardenScorePrev').click();
  await selected(page, builtInCount - 1);
  await paused(page);
  await page.locator('#gardenScoreNext').click();
  await selected(page, 0);
  await paused(page);
  await page.locator('#gardenScoreLibrary button').nth(4).click();
  await page.locator('#gardenScoreNext').click();
  await selected(page, 5);
  await paused(page);
  await page.locator('#gardenScorePrev').click();
  await selected(page, 4);
  await paused(page);
});

test('paused Next keeps the stale legacy song transport hidden', async t => {
  const page = await open(t);
  await start(page, 0);
  await page.locator('#gardenScorePlay').click();
  await paused(page);
  await page.locator('#gardenScoreNext').click();
  await selected(page, 1);
  await paused(page);
  assert.equal(await page.locator('#songPlay').isVisible(), false, 'only the jukebox Play control should be visible');
  const replacement = { name: recordings[0], mimeType: 'audio/mpeg', buffer: fs.readFileSync(path.join(root, 'audio', recordings[0])) };
  await page.locator('#gardenAudioFiles').setInputFiles(replacement);
  await page.locator('#gardenScoreNext').click();
  await selected(page, 2);
  assert.equal(await page.locator('#songPlay').isVisible(), false, 'replacing an unselected recording must not expose its old bundled source');
  await start(page, 0);
  await page.locator('#gardenScorePlay').click();
  await page.locator('#gardenScoreNext').click();
  await page.locator('#gardenAudioFiles').setInputFiles(replacement);
  await page.locator('#gardenScoreNext').click();
  await selected(page, 2);
  assert.equal(await page.locator('#songPlay').isVisible(), false, 'a replaced local source must also remain owned by the jukebox');
});

test('microphone status remains visible after interrupting a recording', async t => {
  const page = await open(t);
  await start(page, 0);
  await page.locator('#micBtn').click();
  await page.waitForFunction(() => document.getElementById('track').textContent.includes('Listening to the room'));
  await paused(page);
  assert.equal(await page.evaluate(() => testAudio.paused), true);
  assert.equal(await page.locator('#track').isVisible(), true, 'the active microphone status must be visible');
});

test('one transport switches between a recording and live synthesis without overlap', async t => {
  const page = await open(t);
  await start(page, 4);
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentTime > 0);
  await page.locator('#gardenScoreNext').click();
  await selected(page, 5);
  await playing(page);
  assert.equal(await page.evaluate(() => testAudio.paused), true, 'recording stops before the live beat starts');
  assert.equal(await page.locator('#beatChips button').nth(0).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#gardenScoreSeek').isDisabled(), true, 'live synthesis cannot seek');
  await signal(page, true);
  await page.locator('#gardenScorePlay').click();
  await paused(page);
  await signal(page, false);
  await page.locator('#gardenScorePlay').click();
  await playing(page);
  await signal(page, true);
  await page.locator('#gardenScorePrev').click();
  await selected(page, 4);
  await playing(page);
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentSrc.endsWith('/Velvet_Circuit.mp3'));
  assert.equal(await page.locator('#beatChips [aria-pressed="true"]').count(), 0, 'no live beat remains active');
  assert.equal(await page.locator('#gardenScoreSeek').isDisabled(), false);
});

test('recording pause preserves position and shared seek and restart move playback', async t => {
  const page = await open(t);
  await start(page, 0);
  await page.waitForFunction(() => testAudio.currentTime > 0);
  await setRange(page, '#gardenScoreSeek', 500);
  await page.waitForFunction(() => Math.abs(testAudio.currentTime / testAudio.duration - 0.5) < 0.02);
  await page.locator('#gardenScorePlay').click();
  await paused(page);
  const position = await page.evaluate(() => testAudio.currentTime);
  await page.locator('#gardenScorePlay').click();
  await playing(page);
  assert.ok(Math.abs(await page.evaluate(() => testAudio.currentTime) - position) < 2, 'resume retains the paused position');
  await page.locator('#gardenScoreRestart').click();
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentTime < 2);
});

test('natural recording completion advances through recordings and into live beats', async t => {
  const page = await open(t);
  await page.locator('#gardenScoreLoop').uncheck();
  await start(page, 0);
  await nearEnd(page);
  await selected(page, 1);
  await playing(page);
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentSrc.endsWith('/Mycelium_Dream_Violin.mp3'));
  await page.locator('#gardenScoreLibrary button').nth(4).click();
  await playing(page);
  await nearEnd(page);
  await selected(page, 5);
  await playing(page);
  assert.equal(await page.evaluate(() => testAudio.paused), true);
  await signal(page, true);
});

test('Repeat current keeps the recording selected after its natural end', async t => {
  const page = await open(t);
  await page.locator('#gardenScoreLoop').check();
  await start(page, 0);
  await nearEnd(page);
  await page.waitForFunction(() => !testAudio.paused && testAudio.currentTime < 2);
  await selected(page, 0);
  await playing(page);
});

test('live beats advance after 120 active seconds and exclude paused time', async t => {
  const page = await open(t, true);
  await page.locator('#gardenScoreLoop').uncheck();
  await start(page, 5);
  await page.clock.fastForward(60000);
  await selected(page, 5);
  await page.locator('#gardenScorePlay').click();
  await paused(page);
  await page.clock.fastForward(300000);
  await selected(page, 5);
  await paused(page);
  await page.locator('#gardenScorePlay').click();
  await page.clock.fastForward(58000);
  await selected(page, 5);
  await page.clock.fastForward(3000);
  await selected(page, 6);
  await playing(page);
});

test('Repeat current restarts a live beat interval before auto-next resumes', async t => {
  const page = await open(t, true);
  await page.locator('#gardenScoreLoop').check();
  await start(page, 5);
  await page.clock.fastForward(121000);
  await selected(page, 5);
  await playing(page);
  await page.locator('#gardenScoreLoop').uncheck();
  await page.clock.fastForward(117000);
  await selected(page, 5);
  await page.clock.fastForward(4000);
  await selected(page, 6);
  await playing(page);
});

test('Restart resets the active live beat interval', async t => {
  const page = await open(t, true);
  await page.locator('#gardenScoreLoop').uncheck();
  await start(page, 5);
  await page.clock.fastForward(90000);
  await page.locator('#gardenScoreRestart').click();
  await page.clock.fastForward(90000);
  await selected(page, 5);
  await page.clock.fastForward(31000);
  await selected(page, 6);
});

test('Shuffle changes the next-track order without selecting the current track', async t => {
  const page = await open(t);
  await page.evaluate(() => {
    let seed = 19687;
    Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  });
  await page.locator('#gardenScoreShuffle').click();
  const visited = [0];
  for (let i = 0; i < 12; i++) {
    await page.locator('#gardenScoreNext').click();
    const index = await page.locator('#gardenScoreLibrary button').evaluateAll(buttons => buttons.findIndex(button => button.getAttribute('aria-pressed') === 'true'));
    assert.ok(index >= 0 && index < builtInCount);
    assert.notEqual(index, visited[visited.length - 1], 'shuffle must choose another track');
    await paused(page);
    visited.push(index);
  }
  assert.ok(visited.some((index, step) => step > 0 && index !== (visited[step - 1] + 1) % builtInCount), 'enabled shuffle must affect playback order');
  await page.locator('#gardenScoreShuffle').click();
  await page.locator('#gardenScoreLibrary button').nth(0).click();
  await page.locator('#gardenScoreNext').click();
  await selected(page, 1);
});

test('the shared volume controls both native recording and synthesized output', async t => {
  const page = await open(t);
  await setRange(page, '#gardenScoreVolume', 0.3);
  await start(page, 0);
  assert.equal(await page.evaluate(() => testAudio.volume), 0.3);
  await page.locator('#gardenScoreLibrary button').nth(5).click();
  await playing(page);
  await signal(page, true);
  await setRange(page, '#gardenScoreVolume', 0);
  await signal(page, false);
  await setRange(page, '#gardenScoreVolume', 0.6);
  await signal(page, true);
  await page.locator('#gardenScoreLibrary button').nth(0).click();
  await playing(page);
  assert.equal(await page.evaluate(() => testAudio.volume), 0.6);
});

test('microphone input interrupts a live beat and cancels its automatic advance', async t => {
  const page = await open(t, true);
  await page.locator('#gardenScoreLoop').uncheck();
  await start(page, 5);
  await page.clock.fastForward(90000);
  await page.locator('#micBtn').click();
  await page.waitForFunction(() => document.getElementById('track').textContent.includes('Listening to the room'));
  await paused(page);
  assert.equal(await page.locator('#beatChips [aria-pressed="true"]').count(), 0);
  await page.clock.fastForward(180000);
  await selected(page, 5);
  await paused(page);
  assert.match(await page.locator('#track').textContent(), /Listening to the room/);
});

test('an ordinary song file interrupts live playback without later jukebox takeover', async t => {
  const page = await open(t, true);
  await page.locator('#gardenScoreLoop').uncheck();
  await start(page, 5);
  await page.clock.fastForward(90000);
  await page.locator('#file').setInputFiles({ name: 'ordinary.mp3', mimeType: 'audio/mpeg', buffer: fs.readFileSync(path.join(root, 'audio', recordings[0])) });
  await page.waitForFunction(() => testAudio.currentSrc.startsWith('blob:') && !testAudio.paused && testAudio.currentTime > 0);
  await paused(page);
  assert.equal(await page.locator('#beatChips [aria-pressed="true"]').count(), 0);
  const source = await page.evaluate(() => testAudio.currentSrc);
  await page.clock.fastForward(180000);
  await selected(page, 5);
  await paused(page);
  assert.equal(await page.evaluate(() => testAudio.currentSrc), source);
  assert.equal(await page.evaluate(() => testAudio.paused), false);
});
