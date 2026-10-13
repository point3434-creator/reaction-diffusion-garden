// Excitable tissue (Barkley's model), CPU, toroidal grid, same shape as the garden's sim.
// u is the voltage, v the recovery. A cell fires when its neighbours push it over a threshold
// that rises with v, then it must rest. Pigment rides the wavefront: a cell being excited takes
// the colour of the neighbours exciting it, so each stimulus founds a wave of its own colour.
function createHeart(w, h) {
  const n = w * h;
  const sim = {
    kind: 'heart', w, h,
    U: new Float32Array(n), V: new Float32Array(n), U2: new Float32Array(n),
    PR: new Float32Array(n), PG: new Float32Array(n), PB: new Float32Array(n),
    scar: new Uint8Array(n),
    R: new Float32Array(n), G: new Float32Array(n), Bl: new Float32Array(n), A: new Float32Array(n),
    XL: new Int32Array(w), XR: new Int32Array(w),
    ecg: 0,
  };
  for (let x = 0; x < w; x++) { sim.XL[x] = (x - 1 + w) % w; sim.XR[x] = (x + 1) % w; }
  sim.PR.fill(1 / 3); sim.PG.fill(1 / 3); sim.PB.fill(1 / 3);

  // p: { a, b, eps, rec, dt, D } — D is the diffusion in cells² per time unit, rec how fast tissue recovers.
  sim.step = function (p, steps) {
    const { w, h, XL, XR, V, PR, PG, PB, scar } = sim;
    const a = p.a, b = p.b, k = p.dt / p.eps, dt = p.dt * (p.rec || 1), dD = p.dt * p.D;
    let mean = 0;
    for (let s = 0; s < steps; s++) {
      const U = sim.U, U2 = sim.U2;
      mean = 0;
      for (let y = 0; y < h; y++) {
        const yc = y * w, yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w;
        for (let x = 0; x < w; x++) {
          const i = yc + x;
          if (scar[i]) { U2[i] = 0; continue; }
          const xl = XL[x], xr = XR[x];
          const l = yc + xl, r = yc + xr, up = yu + x, dn = yd + x;
          const ul = U[l], ur = U[r], uu = U[up], ud = U[dn];
          const u = U[i], v = V[i];
          const lap = -u + 0.2 * (ul + ur + uu + ud) + 0.05 * (U[yu + xl] + U[yu + xr] + U[yd + xl] + U[yd + xr]);
          const uth = (v + b) / a;
          let un;
          if (u < 0.02 && lap > 0) {
            // being excited by neighbours: take the colour of whoever is doing the exciting
            const a1 = yu + xl, a2 = yu + xr, a3 = yd + xl, a4 = yd + xr;
            const d1 = U[a1] * 0.5, d2 = U[a2] * 0.5, d3 = U[a3] * 0.5, d4 = U[a4] * 0.5;
            const ws = ul + ur + uu + ud + d1 + d2 + d3 + d4;
            if (ws > 1e-3) {
              PR[i] = (PR[l] * ul + PR[r] * ur + PR[up] * uu + PR[dn] * ud + PR[a1] * d1 + PR[a2] * d2 + PR[a3] * d3 + PR[a4] * d4) / ws;
              PG[i] = (PG[l] * ul + PG[r] * ur + PG[up] * uu + PG[dn] * ud + PG[a1] * d1 + PG[a2] * d2 + PG[a3] * d3 + PG[a4] * d4) / ws;
              PB[i] = (PB[l] * ul + PB[r] * ur + PB[up] * uu + PB[dn] * ud + PB[a1] * d1 + PB[a2] * d2 + PB[a3] * d3 + PB[a4] * d4) / ws;
            }
          }
          if (u < 1e-4) {
            un = 0;
          } else if (u < uth) {
            un = u / (1 + k * (1.002 - u) * (uth - u));   // the small floor lets a cell at exactly 1 come down
          } else {
            const g = k * u * (u - uth);
            un = (u + g) / (1 + g);
          }
          un += dD * lap;
          if (un < 0) un = 0; else if (un > 1) un = 1;
          U2[i] = un;
          V[i] = v + dt * (u - v);
          mean += un;
        }
      }
      sim.U = U2; sim.U2 = U;
    }
    sim.ecg = mean / n;
    sim.sync();
  };

  // The render arrays: pigment × voltage (with a floor so the colour survives for the refractory wash),
  // and the recovery variable in A, with scars marked as -1.
  sim.sync = function () {
    const { U, V, PR, PG, PB, R, G, Bl, A, scar } = sim;
    for (let i = 0; i < n; i++) {
      const u = U[i] + 1e-4;
      R[i] = PR[i] * u; G[i] = PG[i] * u; Bl[i] = PB[i] * u;
      A[i] = scar[i] ? -1 : V[i];
    }
  };

  sim.clear = function () {
    sim.U.fill(0); sim.V.fill(0); sim.scar.fill(0);
    sim.PR.fill(1 / 3); sim.PG.fill(1 / 3); sim.PB.fill(1 / 3);
    sim.sync();
  };

  // Paint a stimulus (u = 1 in a colour), or scar tissue when erase is set.
  sim.paint = function (cx, cy, rad, erase, pig) {
    const { w, h, U, PR, PG, PB, scar } = sim;
    const r2 = rad * rad;
    const x0 = Math.floor(cx - rad), x1 = Math.ceil(cx + rad);
    const y0 = Math.floor(cy - rad), y1 = Math.ceil(cy + rad);
    const pr = pig ? pig[0] : 1 / 3, pg = pig ? pig[1] : 1 / 3, pb = pig ? pig[2] : 1 / 3;
    for (let y = y0; y <= y1; y++) {
      const yy = ((y % h) + h) % h;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = yy * w + ((x % w) + w) % w;
        if (erase) { scar[i] = 1; U[i] = 0; }
        else if (!scar[i]) { U[i] = 1; PR[i] = pr; PG[i] = pg; PB[i] = pb; }
      }
    }
    sim.sync();
  };

  // A wave that is excited on one side only: a line of voltage with refractory tissue beside it.
  // Its free ends curl into spirals.
  sim.brokenWave = function (cx, cy, len, angle, pig) {
    const { w, h, U, V, PR, PG, PB, scar } = sim;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const nx = -sa, ny = ca;   // normal: the refractory side
    const R = len * 0.5 + 10;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
      const yy = ((y % h) + h) % h;
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const i = yy * w + ((x % w) + w) % w;
        if (scar[i]) continue;
        const dx = x - cx, dy = y - cy;
        const along = dx * ca + dy * sa, across = dx * nx + dy * ny;
        if (Math.abs(along) > len * 0.5) continue;
        if (across >= 0 && across < 2.5) { U[i] = 1; PR[i] = pig[0]; PG[i] = pig[1]; PB[i] = pig[2]; }
        else if (across < 0 && across > -9) { V[i] = Math.max(V[i], 0.55); }
      }
    }
    sim.sync();
  };

  // A shock: every living cell fires at once, so every cell rests at once.
  sim.shock = function () {
    const { U, scar } = sim;
    for (let i = 0; i < n; i++) if (!scar[i]) U[i] = 1;
    sim.sync();
  };

  sim.seed = function () {};

  sim.resample = function (nw, nh) {
    const next = createHeart(nw, nh);
    for (let y = 0; y < nh; y++) {
      const sy = Math.min(sim.h - 1, Math.floor(y * sim.h / nh));
      for (let x = 0; x < nw; x++) {
        const sx = Math.min(sim.w - 1, Math.floor(x * sim.w / nw));
        const si = sy * sim.w + sx, di = y * nw + x;
        next.U[di] = sim.U[si]; next.V[di] = sim.V[si]; next.scar[di] = sim.scar[si];
        next.PR[di] = sim.PR[si]; next.PG[di] = sim.PG[si]; next.PB[di] = sim.PB[si];
      }
    }
    next.sync();
    return next;
  };

  sim.sync();
  return sim;
}
if (typeof module !== 'undefined') module.exports = { createHeart };
