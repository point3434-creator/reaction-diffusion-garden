'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCGL, CGL_PRESETS } = require('../src/cgl.js');

function random(seed = 42) {
  return () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
}
function finite(sim) {
  for (const field of [sim.U, sim.V, sim.R, sim.G, sim.Bl]) {
    assert.ok(field.every(Number.isFinite), 'all physical and display channels are finite');
  }
  assert.ok(Math.max(...sim.U.map((u, i) => u * u + sim.V[i] ** 2)) < 4, 'amplitude stays bounded without clipping');
}

test('zero remains zero, and clear removes physical and display fields', () => {
  const s = createCGL(24, 20);
  s.step({ b: 1, c: -1, dt: 0.04 }, 30);
  assert.ok(s.U.every(v => v === 0) && s.V.every(v => v === 0));
  s.seed(0, random()); s.clear();
  for (const a of [s.U, s.V, s.R, s.G, s.Bl]) assert.ok(a.every(v => v === 0));
});

test('uniform oscillation matches analytic amplitude relaxation and phase rotation', () => {
  const s = createCGL(16, 12), rho0 = 0.36, c = 1.2, time = 2;
  s.U.fill(Math.sqrt(rho0));
  s.step({ b: 1.5, c, dt: 0.01 }, time / 0.01);
  const den = 1 + rho0 * (Math.exp(2 * time) - 1);
  const amplitude = Math.sqrt(rho0 * Math.exp(2 * time) / den);
  const phase = -c * Math.log(den) / 2;
  assert.ok(Math.abs(s.U[0] - amplitude * Math.cos(phase)) < 0.0006);
  assert.ok(Math.abs(s.V[0] - amplitude * Math.sin(phase)) < 0.0006);
  assert.ok(s.U.every(v => v === s.U[0]));
});

test('periodic plane wave follows its discrete Laplacian frequency and saturation', () => {
  const s = createCGL(32, 24), k = 2 * Math.PI / 32, b = 0.7, c = -0.9;
  const q = 2 * (1 - Math.cos(k)), amplitude = Math.sqrt(1 - q), time = 1;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    s.U[y * s.w + x] = amplitude * Math.cos(k * x);
    s.V[y * s.w + x] = amplitude * Math.sin(k * x);
  }
  s.step({ b, c, dt: 0.01 }, 100);
  const phase = -(b * q + c * (1 - q)) * time;
  assert.ok(Math.abs(s.U[0] - amplitude * Math.cos(phase)) < 0.0003);
  assert.ok(Math.abs(s.V[0] - amplitude * Math.sin(phase)) < 0.0003);
});

test('halving the time step converges toward the same field', () => {
  const snapshots = [0.04, 0.02, 0.01].map(dt => {
    const s = createCGL(32, 24); s.seed(2, random());
    s.step({ b: 2, c: -2, dt }, Math.round(2 / dt)); return s;
  });
  function error(a, b) { return a.U.reduce((v, u, i) => v + (u - b.U[i]) ** 2 + (a.V[i] - b.V[i]) ** 2, 0); }
  assert.ok(error(snapshots[1], snapshots[2]) < error(snapshots[0], snapshots[2]) / 4);
});

test('all presets and exposed parameter corners remain bounded over long runs', () => {
  const cases = CGL_PRESETS.concat([-2, 2].flatMap(b => [-2, 2].map(c => ({ b, c }))));
  for (const [i, p] of cases.entries()) {
    const s = createCGL(32, 32); s.seed(i % 3, random());
    s.step({ b: p.b, c: p.c, dt: 0.04 }, 2500); finite(s);
    const heights = s.R.map((v, j) => v + s.G[j] + s.Bl[j]);
    assert.ok(Math.max(...heights) - Math.min(...heights) > 0.04, 'evolved waves retain surface contrast');
  }
});

test('painting a cleared field, erasing and resizing preserve a usable simulation', () => {
  const s = createCGL(32, 24);
  s.paint(1, 12, 5, false, [0.1, 0.6, 0.3]);
  assert.ok(s.U.some(v => v !== 0));
  assert.ok(s.U[12 * 32 + 31] !== 0, 'brush wraps across periodic edge');
  s.step({ b: 0.3, c: 1.4, dt: 0.04 }, 25);
  const resized = s.resample(48, 36);
  assert.equal(resized.kind, 'cgl'); assert.equal(resized.U.length, 48 * 36);
  assert.ok(resized.R.some(v => v > 0)); finite(resized);
  resized.paint(2, 18, 4, true); finite(resized);
  resized.clear(); resized.paint(20, 20, 4, false); finite(resized);
});
