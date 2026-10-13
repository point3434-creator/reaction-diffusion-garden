// Measure the heart model: plane-wave speed and width, spiral period, and whether a shock quiets fibrillation.
// node tools/calibrate-heart.js
const { createHeart } = require('../src/heart.js');

const P = { a: 0.75, b: 0.06, eps: 0.02, rec: 0.35, dt: 0.05, D: 5.0 };   // what the page uses

function planeWave(p, W = 300, H = 60) {
  const s = createHeart(W, H);
  for (let y = 0; y < H; y++) for (let x = 18; x < 21; x++) s.U[y * W + x] = 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < 18; x++) s.V[y * W + x] = 0.6;
  s.sync();
  const y = H >> 1;
  let t = 0, front0 = null, t0 = 0;
  for (let it = 0; it < 4000; it++) {
    s.step(p, 1); t += p.dt;
    let front = -1, back = -1;
    for (let x = W - 1; x >= 0; x--) if (s.U[y * W + x] > 0.5) { front = x; break; }
    for (let x = 0; x < W; x++) if (s.U[y * W + x] > 0.5) { back = x; break; }
    if (front > 60 && front0 === null) { front0 = front; t0 = t; }
    if (front > 200) return { speed: (front - front0) / (t - t0), width: front - back };
    if (front < 0 && it > 50) return { died: true, t };
  }
  return { slow: true };
}

function spiral(p, W = 300, H = 200, T = 400) {
  const s = createHeart(W, H);
  s.brokenWave(W * 0.5, H * 0.5, H * 0.5, Math.PI / 2, [1, 0, 0]);
  const px = Math.round(W * 0.5 + 40), py = Math.round(H * 0.5 + 30);
  let t = 0, prev = 0, fires = [], alive = 0;
  for (let it = 0; it < Math.round(T / p.dt); it++) {
    s.step(p, 1); t += p.dt;
    const u = s.U[py * W + px];
    if (u > 0.5 && prev <= 0.5) fires.push(t);
    prev = u;
    if (s.ecg > 0.002) alive = t;
  }
  const iv = fires.slice(-6).map((v, i, a) => (i ? v - a[i - 1] : null)).filter(Boolean);
  return { fires: fires.length, period: iv.length ? iv.reduce((a, b) => a + b, 0) / iv.length : null, lastAlive: alive };
}

function shock(p, W = 300, H = 200) {
  const s = createHeart(W, H);
  for (let k = 0; k < 6; k++) s.brokenWave(Math.random() * W, Math.random() * H, 60, Math.random() * 6.28, [1, 0, 0]);
  for (let i = 0; i < 1200; i++) s.step({ ...p, b: 0.04 }, 1);
  const before = s.ecg;
  s.shock();
  for (let i = 0; i < 1600; i++) s.step({ ...p, b: 0.04 }, 1);
  return { ecgBefore: before, ecgAfter: s.ecg };
}

console.log('parameters', JSON.stringify(P));
console.log('plane wave', JSON.stringify(planeWave(P)), '(cells per time unit; the page runs about 12 time units a second)');
console.log('spiral', JSON.stringify(spiral(P)));
console.log('shock', JSON.stringify(shock(P)), '(ecgAfter should be 0)');
