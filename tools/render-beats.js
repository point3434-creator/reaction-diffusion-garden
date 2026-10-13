// Render each of the five beats to a WAV through the real engine, offline, and report levels and balance.
// npm install && node tools/render-beats.js      (writes tools/out/<beat>.wav)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

// The engine expects the page's surroundings; stub the few things it touches.
const stubs = `
var music = { actx: null, analyser: null };
function ensureCtx() { return true; }
function stopMusic() {}
function setMusicOn() {}
function say(m) { window.__said = m; }
function $(id) { return document.getElementById(id); }
`;
const tail = `
window.renderBeat = function (i, seconds) {
  var ac = new OfflineAudioContext(2, 44100 * seconds, 44100);
  music.actx = ac; music.analyser = ac.createAnalyser();
  beats.built = false; bx = {};
  beatBuild();
  var B = BEATS[i];
  beats.idx = i; beats.on = true; beats.step = 0; beats.lastLead = null;
  bx.drumLP.frequency.value = B.bus.drumLP; bx.musicLP.frequency.value = B.bus.musicLP;
  bx.drumShape.curve = softCurve(B.bus.grit); bx.verbGain.gain.value = B.bus.verb;
  crackleStart();
  var st = 60 / B.bpm / 4, t = 0.05, step = 0;
  while (t < seconds - 0.5) { scheduleStep(step, t); step++; t += st; }
  return ac.startRendering().then(function (buf) {
    var L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, out = new Int16Array(n * 2);
    for (var k = 0; k < n; k++) { out[2 * k] = Math.max(-1, Math.min(1, L[k])) * 32767; out[2 * k + 1] = Math.max(-1, Math.min(1, R[k])) * 32767; }
    var bytes = new Uint8Array(out.buffer), s = '';
    for (var j = 0; j < bytes.length; j += 8192) s += String.fromCharCode.apply(null, bytes.subarray(j, j + 8192));
    return btoa(s);
  });
};
`;
const harness = path.join(OUT, 'harness.html');
fs.writeFileSync(harness, '<!doctype html><html><body><div id="beatChips"></div><script>' + stubs + fs.readFileSync(path.join(ROOT, 'src', 'beats.js'), 'utf8') + tail + '</script></body></html>');

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24);
  h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function report(pcm) {
  const n = pcm.length / 4; let peak = 0, sq = 0;
  for (let i = 0; i < n; i++) { const v = (pcm.readInt16LE(i * 4) + pcm.readInt16LE(i * 4 + 2)) / 65536; peak = Math.max(peak, Math.abs(v)); sq += v * v; }
  return 'peak ' + peak.toFixed(2) + ' rms ' + Math.sqrt(sq / n).toFixed(3);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('file://' + harness);
  const n = await page.evaluate(() => BEATS.length);
  for (let i = 0; i < n; i++) {
    const name = await page.evaluate((i) => BEATS[i].name, i);
    const pcm = Buffer.from(await page.evaluate((i) => window.renderBeat(i, 14), i), 'base64');
    const file = path.join(OUT, name.toLowerCase().replace(/[^a-z]+/g, '-') + '.wav');
    fs.writeFileSync(file, wav(pcm));
    console.log(name.padEnd(16), report(pcm), '->', path.relative(ROOT, file));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
