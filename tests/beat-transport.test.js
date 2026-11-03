'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Use the real synth and browser audio nodes; only the surrounding page UI is omitted.
const source = fs.readFileSync(path.join(__dirname, '../src/beats.js'), 'utf8');
const surroundings = `
  var music = { actx: null, analyser: null, on: false };
  function $(id) { return document.getElementById(id); }
  function ensureCtx() {
    if (!music.actx) {
      music.actx = new AudioContext();
      music.analyser = music.actx.createAnalyser();
    }
    if (music.actx.state === 'suspended') music.actx.resume();
    return true;
  }
  function stopMusic() { stopBeat(); setMusicOn(false); }
  function setMusicOn(on) { music.on = on; }
  function say() {}
`;
let browser;
before(async () => {
  const options = { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  browser = await chromium.launch(options);
});
after(async () => { if (browser) await browser.close(); });

async function withSynth(check) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.setContent('<div id="beatChips"></div>');
    await page.addScriptTag({ content: surroundings + source });
    await check(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

test('a delayed scheduler skips overdue notes instead of bursting them together', () => withSynth(async page => {
  const result = await page.evaluate(() => {
    startBeat(5); clearInterval(beats.timer);
    const calls = []; scheduleStep = (step, time) => calls.push({ step, time });
    beats.nextT = music.actx.currentTime - 1.5; beats.step = 0;
    const now = music.actx.currentTime, originalNext = beats.nextT;
    beatTick();
    return { calls, now, originalNext, stepDuration: 60 / BEATS[5].bpm / 4 };
  });
  assert.ok(result.calls.length > 0 && result.calls.length < 8, 'only the future scheduling window is queued');
  assert.ok(result.calls.every(c => c.time >= result.now + 0.025), 'humanized notes retain enough future headroom');
  for (const c of result.calls) assert.ok(Math.abs(c.time - (result.originalNext + c.step * result.stepDuration)) < 1e-8, 'recovery keeps the musical grid');
}));

test('pausing freezes the sequence and resuming continues the selected beat', () => withSynth(async page => {
  assert.equal(await page.evaluate(() => typeof pauseBeat), 'function');
  assert.equal(await page.evaluate(() => typeof resumeBeat), 'function');
  await page.evaluate(() => startBeat(0));
  await page.waitForFunction(() => beats.step >= 3);
  const paused = await page.evaluate(() => {
    window.oldOutput = bx.out;
    pauseBeat();
    return { on: beats.on, paused: beats.paused, idx: beats.idx, step: beats.step,
      timer: beats.timer, gain: oldOutput.gain.value, musicOn: music.on };
  });
  assert.equal(paused.on, false);
  assert.equal(paused.paused, true);
  assert.equal(paused.idx, 0);
  assert.equal(paused.timer, null);
  assert.equal(paused.gain, 0);
  assert.equal(paused.musicOn, false);
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(() => beats.step), paused.step);
  await page.evaluate(() => resumeBeat());
  await page.waitForFunction(step => beats.step > step, paused.step);
  assert.deepEqual(await page.evaluate(() => ({ on: beats.on, paused: beats.paused, idx: beats.idx,
    oldGain: oldOutput.gain.value, musicOn: music.on })),
  { on: true, paused: false, idx: 0, oldGain: 0, musicOn: true });
}));

test('volume persists through pause and stop while retired voices stay muted', () => withSynth(async page => {
  assert.equal(await page.evaluate(() => typeof setBeatVolume), 'function');
  const gains = await page.evaluate(() => {
    setBeatVolume(0.4);
    startBeat(1);
    var first = bx.out, playing = first.gain.value;
    pauseBeat();
    setBeatVolume(0.2);
    var pausedGain = first.gain.value;
    resumeBeat();
    var resumed = bx.out.gain.value;
    stopBeat();
    setBeatVolume(0.6);
    startBeat(2);
    return { playing: playing, paused: pausedGain, resumed: resumed, next: bx.out.gain.value,
      retired: first.gain.value };
  });
  assert.ok(Math.abs(gains.playing - 0.22) < 1e-6);
  assert.equal(gains.paused, 0);
  assert.ok(Math.abs(gains.resumed - 0.11) < 1e-6);
  assert.ok(Math.abs(gains.next - 0.33) < 1e-6);
  assert.equal(gains.retired, 0);
}));

test('Neon Canopy keeps eight bars through pause and resume while earlier tracks restore four', () => withSynth(async page => {
  const phrase = await page.evaluate(() => {
    const neon = BEATS.findIndex(beat => beat.name === 'Neon Canopy');
    if (neon < 0) throw new Error('Neon Canopy is missing');
    startBeat(neon);
    const started = beats.bars;
    pauseBeat();
    const paused = beats.bars;
    resumeBeat();
    const resumed = { bars: beats.bars, idx: beats.idx, on: beats.on };
    const earlier = [];
    for (let index = 0; index < neon; index++) {
      startBeat(neon);
      startBeat(index);
      earlier.push(beats.bars);
    }
    stopBeat();
    return { neon, started, paused, resumed, earlier };
  });
  assert.equal(phrase.neon, 5);
  assert.equal(phrase.started, 8);
  assert.equal(phrase.paused, 8);
  assert.deepEqual(phrase.resumed, { bars: 8, idx: 5, on: true });
  assert.deepEqual(phrase.earlier, [4, 4, 4, 4, 4]);
}));

test('stop resets a paused beat and immediate restart cannot unmute its tails', () => withSynth(async page => {
  assert.equal(await page.evaluate(() => typeof pauseBeat), 'function');
  const result = await page.evaluate(() => {
    startBeat(0);
    var oldOutput = bx.out;
    pauseBeat();
    stopBeat();
    var stopped = { on: beats.on, paused: beats.paused, idx: beats.idx, step: beats.step, timer: beats.timer };
    resumeBeat();
    var resumedAfterStop = beats.on;
    startBeat(3);
    return { stopped: stopped, resumedAfterStop: resumedAfterStop, idx: beats.idx,
      oldGain: oldOutput.gain.value, newGain: bx.out.gain.value };
  });
  assert.deepEqual(result.stopped, { on: false, paused: false, idx: -1, step: 0, timer: null });
  assert.equal(result.resumedAfterStop, false);
  assert.equal(result.idx, 3);
  assert.equal(result.oldGain, 0);
  assert.ok(Math.abs(result.newGain - 0.55) < 1e-6);
}));

test('direct offline beatBuild retains audible default output for the renderer', () => withSynth(async page => {
  const result = await page.evaluate(async () => {
    music.actx = new OfflineAudioContext(1, 22050, 22050);
    music.analyser = music.actx.createAnalyser();
    beatBuild();
    beats.idx = 0;
    bx.drumLP.frequency.value = BEATS[0].bus.drumLP;
    bx.musicLP.frequency.value = BEATS[0].bus.musicLP;
    scheduleStep(0, 0.05);
    var gain = bx.out.gain.value;
    var rendered = await music.actx.startRendering();
    var samples = rendered.getChannelData(0);
    var peak = 0;
    for (var i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    return { gain: gain, peak: peak };
  });
  assert.ok(Math.abs(result.gain - 0.55) < 1e-6);
  assert.ok(result.peak > 0.01, 'direct renderer path must still produce audible samples');
}));
