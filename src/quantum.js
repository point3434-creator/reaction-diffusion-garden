// The Schrödinger equation on the same grid (ħ = m = 1, one cell = one unit of length).
// ψ is complex; Visscher's scheme steps its real and imaginary parts a half step apart, which keeps
// the probability from leaking. |ψ|² is drawn as the hill, the phase of ψ as the hue.
function createQuantum(w, h) {
  const n = w * h;
  const sim = {
    kind: 'quantum', w, h,
    Re: new Float32Array(n), Im: new Float32Array(n),
    wall: new Uint8Array(n), Vs: new Float32Array(n), damp: new Float32Array(n),
    R: new Float32Array(n), G: new Float32Array(n), Bl: new Float32Array(n), A: new Float32Array(n),
    XL: new Int32Array(w), XR: new Int32Array(w),
    gain: 1, screen: new Float32Array(h), total: 0,
    reversed: false,   // running backwards: what is stored is the conjugate of what is shown
  };
  for (let x = 0; x < w; x++) { sim.XL[x] = (x - 1 + w) % w; sim.XR[x] = (x + 1) % w; }

  // p: { dt, V0 } — V0 is the height of painted walls; smooth potentials live in Vs.
  sim.step = function (p, steps) {
    const { w, h, Re, Im, wall, Vs, XL, XR, damp } = sim;
    const dt = p.dt, V0 = p.V0;
    for (let s = 0; s < steps; s++) {
      for (let y = 0; y < h; y++) {
        const yc = y * w, yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w;
        for (let x = 0; x < w; x++) {
          const i = yc + x;
          const im = Im[i];
          const lap = Im[yc + XL[x]] + Im[yc + XR[x]] + Im[yu + x] + Im[yd + x] - 4 * im;
          Re[i] += dt * (-0.5 * lap + (wall[i] ? V0 : Vs[i]) * im);
        }
      }
      for (let y = 0; y < h; y++) {
        const yc = y * w, yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w;
        for (let x = 0; x < w; x++) {
          const i = yc + x;
          const re = Re[i];
          const lap = Re[yc + XL[x]] + Re[yc + XR[x]] + Re[yu + x] + Re[yd + x] - 4 * re;
          Im[i] -= dt * (-0.5 * lap + (wall[i] ? V0 : Vs[i]) * re);
        }
      }
      // absorbing edges (where a preset asks for them) quietly swallow what reaches them
      if (sim.hasDamp) for (let i = 0; i < n; i++) { const d = damp[i]; if (d > 0) { Re[i] *= 1 - d; Im[i] *= 1 - d; } }
    }
    sim.sync();
  };

  // Turn time around. Running the Schrödinger equation backwards is running the conjugate of ψ forwards,
  // and because Visscher's scheme keeps Im half a step ahead of Re, the half step Im last took is undone
  // first: Im ← −(Im + dt·H·Re). Doing it twice gives back exactly what you started with, so forward steps
  // after a reversal retrace the ones before it. Only damping (the absorbing edges) does not retrace.
  sim.reverse = function (p) {
    const { w, h, Re, Im, wall, Vs, XL, XR } = sim;
    const dt = p.dt, V0 = p.V0;
    for (let y = 0; y < h; y++) {
      const yc = y * w, yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w;
      for (let x = 0; x < w; x++) {
        const i = yc + x, re = Re[i];
        const lap = Re[yc + XL[x]] + Re[yc + XR[x]] + Re[yu + x] + Re[yd + x] - 4 * re;
        Im[i] = -(Im[i] + dt * (-0.5 * lap + (wall[i] ? V0 : Vs[i]) * re));
      }
    }
    sim.reversed = !sim.reversed;
    sim.sync();
  };

  // Render arrays: hue from the phase, brightness from the density, with a slow automatic gain so a
  // packet that has spread thin stays visible. A marks walls (-1) and dips for smooth potentials.
  sim.sync = function () {
    const { w, h, Re, Im, wall, Vs, R, G, Bl, A, screen } = sim;
    let max = 0, total = 0;
    for (let i = 0; i < n; i++) { const d = Re[i] * Re[i] + Im[i] * Im[i]; if (d > max) max = d; total += d; }
    sim.total = total;
    const target = max > 1e-7 ? Math.min(400, 0.42 / max) : sim.gain;
    sim.gain += (target - sim.gain) * 0.08;
    const g = sim.gain;
    const x0 = Math.floor(w * 0.82);
    for (let y = 0; y < h; y++) {
      let col = 0;
      const yc = y * w;
      for (let x = 0; x < w; x++) {
        const i = yc + x;
        const re = Re[i], im = Im[i], d = re * re + im * im;
        if (x >= x0) col += d;
        if (d < 1e-9) { R[i] = 0; G[i] = 0; Bl[i] = 0; }
        else {
          const inv = 1 / Math.sqrt(d), c = re * inv, s = (sim.reversed ? -im : im) * inv;   // shown as the film run backwards
          let b = d * g; if (b > 1) b = 1;
          // a hue wheel from the phase, without an atan: the three shares always sum to one
          R[i] = (0.5 + 0.5 * c) * b / 1.5;
          G[i] = (0.5 + 0.5 * (-0.5 * c + 0.8660254 * s)) * b / 1.5;
          Bl[i] = (0.5 + 0.5 * (-0.5 * c - 0.8660254 * s)) * b / 1.5;
        }
        A[i] = wall[i] ? -1 : -Math.min(0.45, Vs[i] * 0.6);
      }
      screen[y] += (col - screen[y]) * 0.15;
    }
  };

  sim.clear = function () {
    sim.Re.fill(0); sim.Im.fill(0); sim.wall.fill(0); sim.Vs.fill(0); sim.damp.fill(0); sim.hasDamp = false; sim.screen.fill(0); sim.gain = 1; sim.reversed = false;
    sim.sync();
  };

  // The brush paints walls (erase mode); otherwise it does nothing here — packets are thrown.
  sim.paint = function (cx, cy, rad, erase) {
    if (!erase) return;
    const { w, h, Re, Im, wall } = sim;
    const r2 = rad * rad;
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
      const yy = ((y % h) + h) % h;
      for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = yy * w + ((x % w) + w) % w;
        wall[i] = 1; Re[i] = 0; Im[i] = 0;
      }
    }
    sim.sync();
  };

  // A Gaussian packet with momentum (kx, ky): a particle thrown. Peak density 0.45 before the gain.
  sim.packet = function (x0, y0, kx, ky, sx, sy) {
    const { w, h, Re, Im, wall } = sim;
    const amp = 0.67, rx = Math.ceil(sx * 4), ry = Math.ceil(sy * 4);
    for (let y = Math.floor(y0 - ry); y <= Math.ceil(y0 + ry); y++) {
      const yy = ((y % h) + h) % h, dy = y - y0;
      for (let x = Math.floor(x0 - rx); x <= Math.ceil(x0 + rx); x++) {
        const dx = x - x0;
        const i = yy * w + ((x % w) + w) % w;
        if (wall[i]) continue;
        const g = amp * Math.exp(-(dx * dx / (4 * sx * sx) + dy * dy / (4 * sy * sy)));
        if (g < 1e-4) continue;
        const ph = kx * dx + ky * dy;
        Re[i] += g * Math.cos(ph); Im[i] += g * Math.sin(ph);
      }
    }
    sim.sync();
  };

  // Absorbing strips along the left and right edges, ramped so they do not reflect themselves.
  sim.absorbEdges = function (frac) {
    const { w, h, damp } = sim, d0 = Math.max(4, Math.floor(w * frac));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      if (e < d0) { const u = (d0 - e) / d0; damp[y * w + x] = 0.08 * u * u; }
    }
    sim.hasDamp = true;
  };
  // A line of wall with gaps: the slits.
  sim.wallLine = function (x, thick, gaps) {
    const { w, h, wall, Re, Im } = sim;
    for (let y = 0; y < h; y++) {
      let open = false;
      for (let k = 0; k < gaps.length; k++) if (Math.abs(y - gaps[k][0]) < gaps[k][1]) open = true;
      if (open) continue;
      for (let t = 0; t < thick; t++) { const i = y * w + ((Math.round(x) + t) % w); wall[i] = 1; Re[i] = 0; Im[i] = 0; }
    }
    sim.sync();
  };

  sim.seed = function (count, rng) {
    rng = rng || Math.random;
    const s = Math.max(5, Math.min(sim.w, sim.h) * 0.04);
    for (let k = 0; k < count; k++) {
      const a = rng() * Math.PI * 2, m = 0.3 + rng() * 0.4;
      sim.packet(rng() * sim.w, rng() * sim.h, Math.cos(a) * m, Math.sin(a) * m, s, s);
    }
  };

  sim.resample = function (nw, nh) {
    const next = createQuantum(nw, nh);
    for (let y = 0; y < nh; y++) {
      const sy = Math.min(sim.h - 1, Math.floor(y * sim.h / nh));
      for (let x = 0; x < nw; x++) {
        const sx = Math.min(sim.w - 1, Math.floor(x * sim.w / nw));
        const si = sy * sim.w + sx, di = y * nw + x;
        next.Re[di] = sim.Re[si]; next.Im[di] = sim.Im[si]; next.wall[di] = sim.wall[si]; next.Vs[di] = sim.Vs[si]; next.damp[di] = sim.damp[si];
      }
    }
    next.gain = sim.gain; next.hasDamp = sim.hasDamp; next.reversed = sim.reversed;
    next.sync();
    return next;
  };

  sim.sync();
  return sim;
}
if (typeof module !== 'undefined') module.exports = { createQuantum };
