'use strict';
// Render the real synth at unity user volume with reproducible noise and timing.
// node tools/render-beats.js [output-directory] [beats-source.js]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SAMPLE_RATE = 44100;
const SEED = 20261016;
const BARS = 8;
const surroundings = `
var music = { actx: null, analyser: null };
function ensureCtx() { return true; }
function stopMusic() {}
function setMusicOn() {}
function say() {}
function $(id) { return document.getElementById(id); }
window.setInterval = function () { return 0; };
window.seedRandom = function (seed) {
  Math.random = function () { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
};
`;

async function openSynth(browser, source) {
  const page = await browser.newPage();
  await page.setContent('<div id="beatChips"></div>');
  await page.addScriptTag({ content: surroundings + source });
  return page;
}

function browserOptions() {
  const options = { headless: true };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  return options;
}

async function renderBeat(page, index, bars = BARS) {
  const result = await page.evaluate(async ({ index, bars, sampleRate, seed }) => {
    seedRandom(seed);
    const B = BEATS[index], start = 0.08, activeEnd = start + bars * 240 / B.bpm;
    const ac = new OfflineAudioContext(2, Math.ceil((activeEnd + 2) * sampleRate), sampleRate);
    music.actx = ac; music.analyser = ac.createAnalyser();
    beats.built = false; beats.volume = 1; bx = {};
    // Use live initialization, but schedule a bounded sequence without wall-clock timers.
    const tick = beatTick; beatTick = function () {};
    startBeat(index); beatTick = tick;
    for (let step = 0; step < bars * 16; step++) scheduleStep(step, start + step * 60 / B.bpm / 4);
    if (bx.crackle) bx.crackle.stop(activeEnd);
    const buffer = await ac.startRendering(), n = buffer.length;
    const floats = new Float32Array(n * 2);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < n; i++) floats[2 * i + channel] = data[i];
    }
    const bytes = new Uint8Array(floats.buffer); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return { name: B.name, bpm: B.bpm, start, activeEnd, data: btoa(binary) };
  }, { index, bars, sampleRate: SAMPLE_RATE, seed: SEED });
  const bytes = Buffer.from(result.data, 'base64');
  const samples = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const { data, ...metadata } = result;
  return { ...metadata, samples, metrics: measure(samples, result.start, result.activeEnd) };
}

const db = value => value > 0 ? 20 * Math.log10(value) : -160;

// Average Hann-windowed FFT band energy over both channels. These describe
// balance, not perceptual quality; they are not a substitute for auditioning.
function bandEnergy(samples, first, last) {
  const size = 8192, edges = [0, 30, 120, 300, 1000, 4000, 12000, SAMPLE_RATE / 2];
  const energy = new Array(edges.length - 1).fill(0);
  for (let offset = first; offset + size <= last; offset += size) {
    for (let channel = 0; channel < 2; channel++) {
      const re = new Float64Array(size), im = new Float64Array(size);
      for (let i = 0; i < size; i++) re[i] = samples[2 * (offset + i) + channel] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
      for (let i = 1, j = 0; i < size; i++) {
        let bit = size >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) [re[i], re[j]] = [re[j], re[i]];
      }
      for (let width = 2; width <= size; width *= 2) {
        const angle = -2 * Math.PI / width;
        for (let base = 0; base < size; base += width) {
          for (let j = 0; j < width / 2; j++) {
            const a = base + j, b = a + width / 2, wr = Math.cos(angle * j), wi = Math.sin(angle * j);
            const tr = wr * re[b] - wi * im[b], ti = wr * im[b] + wi * re[b];
            re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          }
        }
      }
      for (let k = 0; k <= size / 2; k++) {
        const frequency = k * SAMPLE_RATE / size;
        let band = edges.findIndex(edge => edge > frequency) - 1;
        if (band < 0) band = energy.length - 1;
        energy[band] += (re[k] ** 2 + im[k] ** 2) * (k === 0 || k === size / 2 ? 1 : 2);
      }
    }
  }
  const total = energy.reduce((a, b) => a + b, 0);
  return Object.fromEntries(energy.map((value, i) => [`${edges[i]}-${edges[i + 1]}Hz`, total ? value / total : 0]));
}

function measure(samples, start, activeEnd) {
  const first = Math.round(start * SAMPLE_RATE), last = Math.round(activeEnd * SAMPLE_RATE);
  let peak = 0, squares = 0, sum = 0, nonFinite = 0, clippedSamples = 0, tailSquares = 0;
  const tailStart = samples.length - SAMPLE_RATE; // Final half second, both channels.
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    if (!Number.isFinite(value)) { nonFinite++; continue; }
    peak = Math.max(peak, Math.abs(value));
    if (Math.abs(value) >= 1) clippedSamples++;
    if (i >= first * 2 && i < last * 2) { squares += value * value; sum += value; }
    if (i >= tailStart) tailSquares += value * value;
  }
  const count = (last - first) * 2, rms = Math.sqrt(squares / count);
  const windows = [];
  for (let offset = first * 2; offset + SAMPLE_RATE / 5 <= last * 2; offset += SAMPLE_RATE / 5) {
    let energy = 0;
    for (let i = offset; i < offset + SAMPLE_RATE / 5; i++) energy += samples[i] ** 2;
    windows.push(Math.sqrt(energy / (SAMPLE_RATE / 5)));
  }
  windows.sort((a, b) => a - b);
  return { peak, peakDbfs: db(peak), rms, rmsDbfs: db(rms), crestDb: db(peak / rms),
    dc: sum / count, acRmsDbfs: db(Math.sqrt(Math.max(0, rms * rms - (sum / count) ** 2))),
    nonFinite, clippedSamples, tailRmsDbfs: db(Math.sqrt(tailSquares / SAMPLE_RATE)),
    windowRangeDb: db(windows[Math.floor(windows.length * 0.9)] / windows[Math.floor(windows.length * 0.1)]),
    bandEnergy: bandEnergy(samples, first, last) };
}

function wav(samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8); header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function main() {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'out'));
  const sourceFile = path.resolve(process.argv[3] || path.join(ROOT, 'src', 'beats.js'));
  const source = fs.readFileSync(sourceFile, 'utf8');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'source-snapshot.js'), source);
  const browser = await chromium.launch(browserOptions());
  const report = { sourceFile, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    browser: browser.version(), sampleRate: SAMPLE_RATE, seed: SEED, bars: BARS, beats: [] };
  const previews = [];
  try {
    const page = await openSynth(browser, source);
    const count = await page.evaluate(() => BEATS.length);
    for (let i = 0; i < count; i++) {
      const { samples, ...result } = await renderBeat(page, i);
      const filename = result.name.toLowerCase().replace(/[^a-z]+/g, '-') + '.wav';
      fs.writeFileSync(path.join(out, filename), wav(samples));
      // Four-bar excerpts with short fades and gaps make one compact audition file.
      const preview = samples.slice(0, Math.round((result.start + 960 / result.bpm) * SAMPLE_RATE) * 2);
      const fade = Math.round(0.08 * SAMPLE_RATE) * 2;
      for (let j = 0; j < fade; j++) preview[preview.length - fade + j] *= 1 - j / fade;
      previews.push(preview);
      if (i < count - 1) previews.push(new Float32Array(Math.round(0.3 * SAMPLE_RATE) * 2));
      report.beats.push({ ...result, filename });
      console.log(`${result.name}: peak ${result.metrics.peakDbfs.toFixed(2)} dBFS, RMS ${result.metrics.rmsDbfs.toFixed(2)} dBFS, crest ${result.metrics.crestDb.toFixed(2)} dB`);
    }
    const sampler = new Float32Array(previews.reduce((length, clip) => length + clip.length, 0));
    let offset = 0;
    for (const clip of previews) { sampler.set(clip, offset); offset += clip.length; }
    fs.writeFileSync(path.join(out, 'garden-hypnotic-sampler.wav'), wav(sampler));
    fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(report, null, 2) + '\n');
  } finally { await browser.close(); }
}

module.exports = { openSynth, browserOptions, renderBeat, measure, SAMPLE_RATE, SEED };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
