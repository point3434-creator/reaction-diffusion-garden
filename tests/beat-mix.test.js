'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { openSynth, browserOptions, renderBeat, SAMPLE_RATE, SEED } = require('../tools/render-beats');

const source = fs.readFileSync(process.env.BEAT_SOURCE || path.join(__dirname, '../src/beats.js'), 'utf8');
let browser;
before(async () => { browser = await chromium.launch(browserOptions()); });
after(async () => { if (browser) await browser.close(); });

test('Rhodes tremolo fades with the note envelope before its oscillator stops', async t => {
  const page = await openSynth(browser, source);
  try {
    const levels = await page.evaluate(async ({ sampleRate, seed }) => {
      seedRandom(seed);
      const ac = new OfflineAudioContext(1, sampleRate * 1.4, sampleRate);
      music.actx = ac; music.analyser = ac.createAnalyser(); beats.built = false; bx = {};
      beatBuild();
      // Hear the voice dry, independent of compressor gain and room decay.
      bx.out.disconnect();
      bx.music.disconnect(); bx.music.gain.value = 1; bx.music.connect(ac.destination);
      bx.verbSend.disconnect();
      rhodes(0.05, ch('F3', 'Ab3', 'C4', 'Eb4'), 0.5, false);
      const data = (await ac.startRendering()).getChannelData(0);
      function rms(start, end) {
        const first = Math.round(start * sampleRate), last = Math.round(end * sampleRate);
        let energy = 0;
        for (let i = first; i < last; i++) energy += data[i] ** 2;
        return Math.sqrt(energy / (last - first));
      }
      return { sustain: rms(0.1, 0.3), release: rms(1.1, 1.2) };
    }, { sampleRate: SAMPLE_RATE, seed: SEED });
    const decayDb = 20 * Math.log10(levels.release / levels.sustain);
    t.diagnostic(`Rhodes release/sustain: ${decayDb.toFixed(2)} dB`);
    assert.ok(decayDb < -25, `release should be at least 25 dB below sustain before stop; measured ${decayDb.toFixed(2)} dB`);
  } finally { await page.close(); }
});

test('all six beats render finite, audible, dynamic audio with headroom', async () => {
  const page = await openSynth(browser, source);
  try {
    const count = await page.evaluate(() => BEATS.length);
    assert.equal(count, 6);
    for (let i = 0; i < count; i++) {
      const { name, metrics } = await renderBeat(page, i, 4);
      assert.equal(metrics.nonFinite, 0, `${name}: nonfinite samples`);
      assert.equal(metrics.clippedSamples, 0, `${name}: clipped samples`);
      assert.ok(Math.abs(metrics.dc) < 0.001, `${name}: excessive DC offset ${metrics.dc.toFixed(5)}`);
      assert.ok(metrics.peakDbfs <= -1, `${name}: less than 1 dB of peak headroom`);
      assert.ok(metrics.rmsDbfs > -30 && metrics.rmsDbfs < -8, `${name}: implausible average level ${metrics.rmsDbfs.toFixed(2)} dBFS`);
      assert.ok(metrics.crestDb > 5, `${name}: flattened dynamics, crest ${metrics.crestDb.toFixed(2)} dB`);
      assert.ok(metrics.tailRmsDbfs < -55, `${name}: sustained sound after notes and room have decayed`);
    }
  } finally { await page.close(); }
});

test('Neon Canopy keeps a fast, audible quarter-note pulse across its eight-bar phrase', async t => {
  const page = await openSynth(browser, source);
  try {
    const index = await page.evaluate(() => BEATS.findIndex(beat => beat.name === 'Neon Canopy'));
    assert.ok(index >= 0, 'Neon Canopy is available');
    const { samples, bpm, start, metrics } = await renderBeat(page, index, 16);
    assert.ok(bpm >= 120, 'the new dance track has a fast tempo');
    assert.equal(await page.evaluate(() => beats.bars), 8, 'the live scheduler uses the full eight-bar phrase');
    assert.equal(metrics.nonFinite, 0);
    assert.equal(metrics.clippedSamples, 0);
    assert.ok(metrics.peakDbfs <= -1, 'the full phrase retains 1 dB of peak headroom');
    assert.ok(Math.abs(metrics.dc) < 0.001, 'the full phrase has no substantial DC offset');
    assert.ok(metrics.tailRmsDbfs < -55, 'the full phrase decays cleanly');

    // Measure the rendered mix, not the drum pattern string. A 150 Hz low-pass
    // isolates the pulse; compare each attack with the gap before offbeat bass.
    const low = new Float32Array(samples.length / 2);
    const alpha = 1 - Math.exp(-2 * Math.PI * 150 / SAMPLE_RATE);
    let filtered = 0;
    for (let i = 0; i < low.length; i++) {
      filtered += alpha * ((samples[2 * i] + samples[2 * i + 1]) / 2 - filtered);
      low[i] = filtered;
    }
    function energy(begin, end) {
      const first = Math.round(begin * SAMPLE_RATE), last = Math.round(end * SAMPLE_RATE);
      let sum = 0;
      for (let i = first; i < last; i++) sum += low[i] ** 2;
      return sum / (last - first);
    }
    const contrasts = [];
    for (let beat = 0; beat < 64; beat++) {
      const onset = start + beat * 60 / bpm;
      contrasts.push(10 * Math.log10(energy(onset + 0.015, onset + 0.12) / energy(onset + 0.16, onset + 0.22)));
    }
    const strongPulses = contrasts.filter(value => value > 3).length;
    const median = contrasts.slice().sort((a, b) => a - b)[32];
    t.diagnostic(`Low-band pulse contrast: median ${median.toFixed(2)} dB; ${strongPulses}/64 attacks above 3 dB`);
    // Judge recurrent audible attacks. The full-mix median also changes with
    // the melody's register; the unchanged backing alone measures below 6 dB.
    assert.ok(strongPulses >= 60, 'at least 60 of 64 rendered kicks rise clearly above their following gap');
  } finally { await page.close(); }
});
