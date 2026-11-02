'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const sourcePath = path.resolve(__dirname, '../src/song-library.js');
const origin = 'http://garden-song-library.test';
let browser;

test.before(async () => {
  const options = { headless: true };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  browser = await chromium.launch(options);
});

test.after(async () => { if (browser) await browser.close(); });

async function open(t, beforeLoad) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route(origin + '/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Song storage</title>' }));
  return loadPage(context, beforeLoad);
}

async function loadPage(context, beforeLoad) {
  const page = await context.newPage();
  await page.goto(origin);
  if (beforeLoad) await page.evaluate(beforeLoad);
  if (fs.existsSync(sourcePath)) await page.addScriptTag({ content: fs.readFileSync(sourcePath, 'utf8') });
  assert.equal(await page.evaluate(() => typeof gardenSongStore), 'object', 'the song library API must initialize');
  return page;
}

async function songs(page) {
  return page.evaluate(async () => Promise.all((await gardenSongStore.load()).map(async song => ({
    keys: Object.keys(song).sort(), filename: song.filename, type: song.blob.type, text: await song.blob.text()
  }))));
}

test('saved song bytes and metadata survive closing the page and opening another', async t => {
  const page = await open(t);
  assert.deepEqual(await songs(page), []);
  assert.equal(await page.evaluate(() => gardenSongStore.put(new File(['song bytes'], 'My Song.wav', { type: 'audio/wav' }))), undefined);
  const context = page.context();
  await page.close();
  const reopened = await loadPage(context);
  assert.deepEqual(await songs(reopened), [{ keys: ['blob', 'filename'], filename: 'My Song.wav', type: 'audio/wav', text: 'song bytes' }]);
});

test('importing the same filename with different case replaces its stored bytes', async t => {
  const page = await open(t);
  await page.evaluate(async () => {
    await gardenSongStore.put(new File(['first'], 'Tune.mp3', { type: 'audio/mpeg' }));
    await gardenSongStore.put(new File(['replacement'], 'TUNE.MP3', { type: 'audio/mpeg' }));
  });
  assert.deepEqual(await songs(page), [{ keys: ['blob', 'filename'], filename: 'TUNE.MP3', type: 'audio/mpeg', text: 'replacement' }]);
});

test('removing a filename is case insensitive and persists without removing other songs', async t => {
  const page = await open(t);
  assert.equal(await page.evaluate(async () => {
    await gardenSongStore.put(new File(['remove me'], 'Remove.mp3'));
    await gardenSongStore.put(new File(['keep me'], 'Keep.ogg'));
    return gardenSongStore.remove('REMOVE.MP3');
  }), undefined);
  const reopened = await loadPage(page.context());
  assert.deepEqual(await songs(reopened), [{ keys: ['blob', 'filename'], filename: 'Keep.ogg', type: '', text: 'keep me' }]);
});

for (const mode of ['absent', 'security blocked']) {
  test('storage ' + mode + ' rejects calls without crashing module initialization', async t => {
    const page = await open(t, mode === 'absent'
      ? () => Object.defineProperty(window, 'indexedDB', { value: undefined })
      : () => Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } }));
    const outcomes = await page.evaluate(async () => {
      const results = await Promise.allSettled([
        gardenSongStore.load(), gardenSongStore.put(new File(['song'], 'song.mp3')), gardenSongStore.remove('song.mp3')
      ]);
      return results.map(result => ({ status: result.status, name: result.reason?.name, message: result.reason?.message }));
    });
    assert.ok(outcomes.every(outcome => outcome.status === 'rejected'), 'unavailable persistence must not report success');
    for (const outcome of outcomes) {
      if (mode === 'security blocked') assert.equal(outcome.name, 'SecurityError');
      else assert.match(outcome.message, /unavailable|not supported/i);
    }
  });
}

test('a native database open failure rejects the caller', async t => {
  const page = await open(t, () => new Promise((resolve, reject) => {
    const request = indexedDB.open('garden-song-library', 2);
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  }));
  const result = await page.evaluate(() => gardenSongStore.load().then(() => 'resolved', error => error.name));
  assert.equal(result, 'VersionError');
});

for (const operation of ['put', 'remove']) {
  test(operation + ' rejects when its transaction aborts after the request succeeds', async t => {
    const page = await open(t);
    const result = await page.evaluate(async operation => {
      await gardenSongStore.put(new File(['original'], 'song.mp3'));
      const method = operation === 'put' ? 'put' : 'delete';
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (...args) {
        const request = original.apply(this, args);
        request.addEventListener('success', () => request.transaction.abort());
        return request;
      };
      try {
        const pending = operation === 'put'
          ? gardenSongStore.put(new File(['replacement'], 'song.mp3'))
          : gardenSongStore.remove('song.mp3');
        return await pending.then(() => 'resolved', error => error.name + ': ' + error.message);
      } finally { IDBObjectStore.prototype[method] = original; }
    }, operation);
    assert.match(result, /abort/i, 'a successful request cannot acknowledge an aborted write');
    assert.deepEqual(await songs(page), [{ keys: ['blob', 'filename'], filename: 'song.mp3', type: '', text: 'original' }]);
  });
}

test('native storage quota failure rejects the import and leaves no saved song', async t => {
  const page = await open(t);
  await page.evaluate(() => gardenSongStore.load());
  const session = await page.context().newCDPSession(page);
  await session.send('Storage.overrideQuotaForOrigin', { origin, quotaSize: 1 });
  const result = await page.evaluate(() => gardenSongStore.put(new File([new Uint8Array(65536)], 'full.wav'))
    .then(() => 'resolved', error => error.name));
  assert.equal(result, 'QuotaExceededError');
  assert.deepEqual(await songs(page), []);
});
