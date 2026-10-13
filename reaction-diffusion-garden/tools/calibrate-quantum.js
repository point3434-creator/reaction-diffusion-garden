// Measure the quantum model: packet speed and norm, double-slit fringes, tunnelling, the trap's orbit, stability.
// node tools/calibrate-quantum.js
const { createQuantum } = require('../src/quantum.js');

const W = 300, H = 200, P = { dt: 0.1, V0: 1.0 };
function centroid(s) {
  let sx = 0, sy = 0, st = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, d = s.Re[i] ** 2 + s.Im[i] ** 2; sx += x * d; sy += y * d; st += d; }
  return [sx / st, sy / st, st];
}
function split(s, xs) {
  let r = 0, l = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = s.Re[y * W + x] ** 2 + s.Im[y * W + x] ** 2; if (x > xs) r += d; else l += d; }
  return r / (r + l);
}

let s = createQuantum(W, H);
s.packet(60, 100, 0.7, 0, 8, 8);
let c0 = centroid(s);
for (let i = 0; i < 400; i++) s.step(P, 1);
let c1 = centroid(s);
console.log('free packet: speed', ((c1[0] - c0[0]) / 40).toFixed(3), 'cells/time (the lattice gives sin k = 0.644 for k = 0.7); norm ratio', (c1[2] / c0[2]).toFixed(4));

s = createQuantum(W, H);
s.absorbEdges(0.1);
s.wallLine(165, 3, [[100 - 15, 5], [100 + 15, 5]]);
s.packet(70, 100, 0.7, 0, 6, 30);
for (let i = 0; i < 2000; i++) s.step(P, 1);
const prof = Array.from(s.screen).filter((v, i) => i >= 40 && i <= 160 && i % 8 === 0).map((v) => (v * 1e3).toFixed(2));
console.log('double slit, detector profile across the middle rows:', prof.join(' '));

for (const V0 of [0.32, 0.4, 0.6]) {
  s = createQuantum(W, H); s.wallLine(165, 2, []); s.packet(70, 100, 0.7, 0, 8, 24);
  for (let i = 0; i < 2400; i++) s.step({ dt: 0.1, V0 }, 1);
  console.log('tunnel: barrier', V0, '(packet energy about 0.24) transmitted', split(s, 168).toFixed(3));
}

s = createQuantum(W, H);
const cx = W / 2, cy = H / 2, w2 = 1.2 / (0.35 * H) ** 2;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) s.Vs[y * W + x] = Math.min(2, 0.5 * w2 * ((x - cx) ** 2 + (y - cy) ** 2));
s.packet(cx + 44, cy, 0, 0.6, 7, 7);
const pts = [];
for (let i = 0; i < 2000; i++) { s.step(P, 1); if (i % 250 === 249) { const c = centroid(s); pts.push(`(${(c[0] - cx).toFixed(0)},${(c[1] - cy).toFixed(0)})`); } }
console.log('trap: period', (2 * Math.PI / Math.sqrt(w2)).toFixed(0), 'time units; centroid every 25:', pts.join(' '));

s = createQuantum(W, H); s.wallLine(165, 3, [[100, 8]]); s.packet(60, 100, 0.8, 0, 8, 20);
for (let i = 0; i < 1500; i++) s.step({ dt: 0.1, V0: 1.5 }, 1);
const c = centroid(s);
console.log('walls at the slider maximum stable:', isFinite(c[2]) && c[2] < 1e4);
