// Cubic Complex Ginzburg–Landau: A_t = A + (1+i*b) ΔA - (1+i*c)|A|²A.
// U/V are the physical complex field; R/G/Bl are only its surface visualization.
// Periodic five-point Laplacian, explicit midpoint; UI limits |b|,|c| <= 2, dt=.04.
var CGL_PRESETS = [
  { name: 'Spiral Bloom', b: 0.3, c: 1.4 },
  { name: 'Wave Garden', b: 0.8, c: 0.4 },
  { name: 'Phase Storm', b: 1.6, c: -1.2 }
];

function createCGL(w, h) {
  const n = w * h, tau = Math.PI * 2;
  const sim = { kind: 'cgl', w, h, time: 0,
    U: new Float32Array(n), V: new Float32Array(n),
    R: new Float32Array(n), G: new Float32Array(n), Bl: new Float32Array(n), A: new Float32Array(n) };
  const midU = new Float32Array(n), midV = new Float32Array(n);
  const left = new Int32Array(w), right = new Int32Array(w);
  for (let x = 0; x < w; x++) { left[x] = (x + w - 1) % w; right[x] = (x + 1) % w; }
  sim.A.fill(1);

  // Evaluate at u/v, adding the derivative to the start of the time step.
  function advance(u, v, outU, outV, b, c, dt) {
    for (let y = 0; y < h; y++) {
      const row = y * w, up = ((y + h - 1) % h) * w, down = ((y + 1) % h) * w;
      for (let x = 0; x < w; x++) {
        const i = row + x, a = u[i], z = v[i], rho = a * a + z * z;
        const lu = u[row + left[x]] + u[row + right[x]] + u[up + x] + u[down + x] - 4 * a;
        const lv = v[row + left[x]] + v[row + right[x]] + v[up + x] + v[down + x] - 4 * z;
        outU[i] = sim.U[i] + dt * (a + lu - b * lv - rho * (a - c * z));
        outV[i] = sim.V[i] + dt * (z + lv + b * lu - rho * (z + c * a));
      }
    }
  }
  sim.step = function (p, steps) {
    const dt = p.dt === undefined ? 0.04 : p.dt;
    for (let s = 0; s < steps; s++) {
      advance(sim.U, sim.V, midU, midV, p.b, p.c, dt / 2);
      // Midpoint reads only its temporary field, so writing U/V here is safe.
      advance(midU, midV, sim.U, sim.V, p.b, p.c, dt);
      sim.time += dt;
    }
    sim.updateDisplay();
  };
  sim.updateDisplay = function () {
    for (let i = 0; i < n; i++) {
      const a = sim.U[i], z = sim.V[i], amplitude = Math.hypot(a, z);
      if (amplitude < 1e-8) { sim.R[i] = sim.G[i] = sim.Bl[i] = 0; continue; }
      const phase = Math.atan2(z, a), crest = 0.5 + 0.5 * a / amplitude;
      const height = 0.38 * Math.min(amplitude, 1) * (0.04 + 0.96 * crest * crest);
      const r = 0.55 + 0.45 * Math.cos(phase);
      const g = 0.55 + 0.45 * Math.cos(phase - tau / 3);
      const b = 0.55 + 0.45 * Math.cos(phase + tau / 3), scale = height / (r + g + b);
      sim.R[i] = r * scale; sim.G[i] = g * scale; sim.Bl[i] = b * scale;
    }
  };
  sim.clear = function () {
    sim.U.fill(0); sim.V.fill(0); sim.R.fill(0); sim.G.fill(0); sim.Bl.fill(0); sim.time = 0;
  };
  sim.seed = function (preset = 0, rng = Math.random) {
    sim.clear();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, X = tau * x / w, Y = tau * y / h;
      let phase, amplitude;
      if (preset === 2) {
        phase = rng() * tau; amplitude = 0.25 + 0.25 * rng();
      } else if (preset === 1) {
        phase = 3 * X + 2 * Y + 0.8 * Math.sin(Y); amplitude = 0.95;
      } else {
        const sx = Math.sin(X), sy = Math.sin(Y), radius = Math.hypot(sx, sy);
        phase = Math.atan2(sy, sx) - radius * Math.min(w, h) / 12;
        amplitude = Math.tanh(radius * Math.min(w, h) / 8);
      }
      sim.U[i] = amplitude * Math.cos(phase); sim.V[i] = amplitude * Math.sin(phase);
    }
    sim.updateDisplay();
  };
  sim.paint = function (cx, cy, radius, erase, pigment) {
    const phase = pigment ? Math.atan2(pigment[1] - pigment[2], 2 * pigment[0] - pigment[1] - pigment[2]) : sim.time;
    const a = 0.95 * Math.cos(phase), z = 0.95 * Math.sin(phase);
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const d = ((x - cx) ** 2 + (y - cy) ** 2) / (radius * radius);
        if (d >= 1) continue;
        const weight = (1 - d) ** 2, i = ((y % h + h) % h) * w + (x % w + w) % w;
        sim.U[i] += ((erase ? 0 : a) - sim.U[i]) * weight;
        sim.V[i] += ((erase ? 0 : z) - sim.V[i]) * weight;
      }
    }
    sim.updateDisplay();
  };
  sim.resample = function (nw, nh) {
    const next = createCGL(nw, nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const sx = x * w / nw, sy = y * h / nh, x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0, x1 = (x0 + 1) % w, y1 = (y0 + 1) % h;
      for (const name of ['U', 'V']) {
        const a = sim[name];
        next[name][y * nw + x] = (1 - fy) * ((1 - fx) * a[y0 * w + x0] + fx * a[y0 * w + x1]) +
          fy * ((1 - fx) * a[y1 * w + x0] + fx * a[y1 * w + x1]);
      }
    }
    next.time = sim.time; next.updateDisplay(); return next;
  };
  return sim;
}
if (typeof module !== 'undefined') module.exports = { createCGL, CGL_PRESETS };
