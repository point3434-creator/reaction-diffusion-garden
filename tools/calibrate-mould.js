// Measure the slime mould: how much trail each preset lays, how much of the dish it covers, whether the
// network is one piece, and how much of the food it has reached. Draws each preset to tools/out/mould-*.png.
// node tools/calibrate-mould.js [steps]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createMould } = require('../src/mould.js');

const W = 300, H = 170, STEPS = parseInt(process.argv[2] || '1500', 10);
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

// what the page uses, preset by preset
const BASE = { ss: 1, blur: 1, eat: 0.0001, scentW: 0.5, scentFade: 0.002 };
const PRESETS = [
  { name: 'Forage', sa: 22.5, ra: 45, so: 9, dep: 0.3, decay: 0.08, pop: 0.06, setup: (s, p) => { colony(s, p, 0.08); dots(s, 8, 0.022); } },
  { name: 'Railway', sa: 22.5, ra: 45, so: 9, dep: 0.3, decay: 0.08, pop: 0.08, eat: 0, setup: (s, p) => { colony(s, p, 0.06); ring(s, 10, 0.36, 0.02); dots(s, 4, 0.016, 0.18); } },
  { name: 'Veins', sa: 45, ra: 45, so: 6, dep: 0.2, decay: 0.12, pop: 0.12, setup: (s, p) => { s.populate(Math.round(p.pop * s.w * s.h)); } },
  { name: 'Hyphae', sa: 11, ra: 22, so: 5, dep: 0.2, decay: 0.12, blur: 0.75, pop: 0.05, setup: (s, p) => { colony(s, p, 0.04); } },
  { name: 'Cells', sa: 90, ra: 45, so: 6, dep: 0.2, decay: 0.1, pop: 0.1, setup: (s, p) => { s.populate(Math.round(p.pop * s.w * s.h)); } },
];
const params = (p) => ({ ...BASE, sa: p.sa, ra: p.ra, so: p.so, dep: p.dep, decay: p.decay, blur: p.blur || BASE.blur, eat: typeof p.eat === 'number' ? p.eat : BASE.eat });

let seed = 12345;
function rng() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function hue(h) { h = (((h % 360) + 360) % 360) / 60; const x = 1 - Math.abs(h % 2 - 1); const r = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x]; const c = r.map((v) => v * 0.9 + 0.1), s = c[0] + c[1] + c[2]; return [c[0] / s, c[1] / s, c[2] / s]; }
function colony(s, p, frac) { s.populate(Math.round(p.pop * s.w * s.h), s.w * 0.5, s.h * 0.5, Math.min(s.w, s.h) * frac); }
function dots(s, k, r, inner) {
  for (let i = 0; i < k; i++) {
    const x = inner ? s.w * 0.5 + (rng() - 0.5) * 2 * inner * s.w : rng() * s.w, y = inner ? s.h * 0.5 + (rng() - 0.5) * 2 * inner * s.h : rng() * s.h;
    s.paint(x, y, Math.min(s.w, s.h) * r * (0.7 + rng() * 0.8), false, hue(rng() * 360));
  }
}
function ring(s, k, rad, r) {
  const m = Math.min(s.w, s.h), wide = s.w / s.h > 1.3 ? 1.4 : 1;
  for (let i = 0; i < k; i++) {
    const a = i / k * Math.PI * 2 + (rng() - 0.5) * 0.3, rr = rad * m * (0.85 + 0.3 * rng());
    s.paint(s.w * 0.5 + rr * Math.cos(a) * wide, s.h * 0.5 + rr * Math.sin(a), m * r * (0.7 + rng() * 0.8), false, hue(i / k * 360));
  }
}

function metrics(s) {
  const n = s.w * s.h, E0 = 0.09;   // E0 is where the renderer's dome begins
  let mass = 0, covered = 0, foodCells = 0, reached = 0;
  const on = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const b = s.R[i] + s.G[i] + s.Bl[i];
    mass += b;
    if (b > E0) { covered++; on[i] = 1; }
    if (s.food[i] > 0) { foodCells++; if (b > E0 || s.occ[i]) reached++; }
  }
  // connected pieces of the network (4-neighbour flood fill on the torus), and the biggest piece's share
  const seen = new Uint8Array(n), stack = new Int32Array(n);
  let pieces = 0, biggest = 0;
  for (let i = 0; i < n; i++) {
    if (!on[i] || seen[i]) continue;
    pieces++; let sp = 0, size = 0; stack[sp++] = i; seen[i] = 1;
    while (sp) {
      const j = stack[--sp]; size++;
      const x = j % s.w, y = (j / s.w) | 0;
      const nb = [y * s.w + (x + 1) % s.w, y * s.w + (x - 1 + s.w) % s.w, ((y + 1) % s.h) * s.w + x, ((y - 1 + s.h) % s.h) * s.w + x];
      for (const q of nb) if (on[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
    }
    if (size > biggest) biggest = size;
  }
  return { mass: +(mass / n).toFixed(4), covered: +(covered / n).toFixed(3), pieces, biggest: +(biggest / Math.max(1, covered)).toFixed(2), food: foodCells, reached: foodCells ? +(reached / foodCells).toFixed(2) : null };
}

// ---- a minimal PNG writer, so the pictures need no dependency ----
const CRC = new Int32Array(256);
for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[i] = c; }
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
// The dish as the lineage palette draws it against the dark, scaled up so the veins are legible.
function picture(s, file, scale) {
  const w = s.w * scale, h = s.h * scale, rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y / scale) | 0) * s.w + ((x / scale) | 0);
    const r = s.R[i], g = s.G[i], bb = s.Bl[i], b = r + g + bb, m = Math.max(r, g, bb, 1e-6);
    let or = 7, og = 19, ob = 31;
    if (s.wall[i]) { or = og = ob = 70; }
    else if (s.food[i] > 0) { or = 7 + 40 * s.food[i]; og = 19 + 30 * s.food[i]; ob = 31 + 20 * s.food[i]; }
    const t = Math.min(1, b * 2.5), k = (0.42 + 0.58 * t) * Math.min(1, t / 0.28);
    or = or * (1 - k) + 255 * (r / m) * k; og = og * (1 - k) + 255 * (g / m) * k; ob = ob * (1 - k) + 255 * (bb / m) * k;
    const j = (y * w + x) * 3; rgb[j] = or; rgb[j + 1] = og; rgb[j + 2] = ob;
  }
  writePNG(file, w, h, rgb);
}

for (const pr of PRESETS) {
  seed = 12345;
  const s = createMould(W, H); s.rng = rng;
  pr.setup(s, pr);
  const p = params(pr), t0 = Date.now();
  let done = 0;
  for (const m of [150, 500, STEPS]) {
    s.step(p, m - done); done = m;
    console.log(pr.name.padEnd(8), String(m).padStart(5), 'steps', JSON.stringify(metrics(s)));
    picture(s, path.join(OUT, `mould-${pr.name.toLowerCase()}-${m}.png`), 3);
  }
  console.log(pr.name.padEnd(8), 'agents', s.count, 'ms/step', ((Date.now() - t0) / STEPS).toFixed(2), '(the page runs about three steps a frame)');
}
console.log('pictures in', path.relative(process.cwd(), OUT));
