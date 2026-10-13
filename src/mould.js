// A slime mould (Jones's agent model of Physarum polycephalum), CPU, toroidal grid, same shape as the garden's sim.
// Thousands of agents each look ahead at three points, turn toward the strongest trail, step, and lay trail
// where they land; the trail blurs and fades every step. Food leaks a scent that spreads farther and fades
// slower, so it can be smelled from a distance. Trail is laid in three pigments, so the render arrays are
// the trail itself, and an agent on food takes the food's colour, so each vein ends up wearing the colour
// of what it feeds on.
const MOULD_DIRS = 1024;   // headings are integers around the circle, so turning is arithmetic and the trig is a table
const MOULD_COS = new Float32Array(MOULD_DIRS), MOULD_SIN = new Float32Array(MOULD_DIRS);
for (let i = 0; i < MOULD_DIRS; i++) { MOULD_COS[i] = Math.cos(i * 2 * Math.PI / MOULD_DIRS); MOULD_SIN[i] = Math.sin(i * 2 * Math.PI / MOULD_DIRS); }
const MOULD_FLOOR = 0.07;  // the faint stain of trail a food patch keeps, below the renderer's dome threshold, so it shows its colour

function createMould(w, h) {
  const n = w * h;
  const sim = {
    kind: 'mould', w, h,
    R: new Float32Array(n), G: new Float32Array(n), Bl: new Float32Array(n), A: new Float32Array(n),
    R2: new Float32Array(n), G2: new Float32Array(n), Bl2: new Float32Array(n),
    scent: new Float32Array(n), scent2: new Float32Array(n),
    food: new Float32Array(n), FR: new Float32Array(n), FG: new Float32Array(n), FB: new Float32Array(n),
    wall: new Uint8Array(n), occ: new Uint8Array(n),
    ax: new Float32Array(0), ay: new Float32Array(0), ah: new Int32Array(0), ai: new Int32Array(0),
    pr: new Float32Array(0), pg: new Float32Array(0), pb: new Float32Array(0), count: 0,
    XL: new Int32Array(w), XR: new Int32Array(w),
    rng: Math.random, ecg: 0,
  };
  for (let x = 0; x < w; x++) { sim.XL[x] = (x - 1 + w) % w; sim.XR[x] = (x + 1) % w; }

  // p: { sa, ra, so, ss, dep, decay, blur, eat, scentW, scentFade }
  //   sa, ra  sensor and turning angles in degrees; so the sensing distance in cells; ss the step in cells
  //   dep     trail laid per step; decay the fraction of trail lost per step; blur how much of a 3×3 mean is mixed in
  //   eat     food taken per agent-visit; scentW the scent at a food cell; scentFade the fraction of scent lost per step
  sim.step = function (p, steps) {
    const { w, h, food, FR, FG, FB, wall, occ, XL, XR, rng } = sim;
    const ax = sim.ax, ay = sim.ay, ah = sim.ah, ai = sim.ai, pr = sim.pr, pg = sim.pg, pb = sim.pb, count = sim.count;
    const sa = Math.round(p.sa / 360 * MOULD_DIRS), ra = Math.round(p.ra / 360 * MOULD_DIRS);
    const so = p.so, ss = p.ss, dep = p.dep, eat = p.eat, scentW = p.scentW;
    const keep = 1 - p.decay, keepS = 1 - p.scentFade, bl = p.blur, bk = 1 - p.blur;
    let mass = 0;
    for (let s = 0; s < steps; s++) {
      const R = sim.R, G = sim.G, Bl = sim.Bl, scent = sim.scent;
      // ---- the agents: sense, turn, step, lay trail ----
      for (let k = 0; k < count; k++) {
        let x = ax[k], y = ay[k], d = ah[k];
        const ci = ai[k];
        if (wall[ci]) {
          // walled in by a stroke: the mould pulls this bit of itself elsewhere
          occ[ci] = 0;
          x = rng() * w; y = rng() * h; d = (rng() * MOULD_DIRS) | 0;
          const ni = (y | 0) * w + (x | 0);
          ax[k] = x; ay[k] = y; ah[k] = d; ai[k] = ni; occ[ni] = 1;
          continue;
        }
        const dl = (d - sa + MOULD_DIRS) % MOULD_DIRS, dr = (d + sa) % MOULD_DIRS;
        let xi = (x + so * MOULD_COS[d] + w) | 0, yi = (y + so * MOULD_SIN[d] + h) | 0;
        if (xi >= w) xi -= w; if (yi >= h) yi -= h;
        let j = yi * w + xi;
        const f = R[j] + G[j] + Bl[j] + scent[j];
        xi = (x + so * MOULD_COS[dl] + w) | 0; yi = (y + so * MOULD_SIN[dl] + h) | 0;
        if (xi >= w) xi -= w; if (yi >= h) yi -= h;
        j = yi * w + xi;
        const l = R[j] + G[j] + Bl[j] + scent[j];
        xi = (x + so * MOULD_COS[dr] + w) | 0; yi = (y + so * MOULD_SIN[dr] + h) | 0;
        if (xi >= w) xi -= w; if (yi >= h) yi -= h;
        j = yi * w + xi;
        const r = R[j] + G[j] + Bl[j] + scent[j];
        if (f > l && f > r) { /* straight on */ }
        else if (f < l && f < r) d = rng() < 0.5 ? (d - ra + MOULD_DIRS) % MOULD_DIRS : (d + ra) % MOULD_DIRS;
        else if (l > r) d = (d - ra + MOULD_DIRS) % MOULD_DIRS;
        else if (r > l) d = (d + ra) % MOULD_DIRS;
        let nx = x + ss * MOULD_COS[d], ny = y + ss * MOULD_SIN[d];
        if (nx < 0) nx += w; else if (nx >= w) nx -= w;
        if (ny < 0) ny += h; else if (ny >= h) ny -= h;
        const ni = (ny | 0) * w + (nx | 0);
        if (ni !== ci && (wall[ni] || occ[ni])) {
          // blocked: stay put and face a new way
          d = (rng() * MOULD_DIRS) | 0;
        } else {
          occ[ci] = 0; occ[ni] = 1;
          x = nx; y = ny; ai[k] = ni;
          const fd = food[ni];
          if (fd > 0) {
            // eating: take on the food's colour, and use some of it up
            pr[k] += (FR[ni] - pr[k]) * 0.5; pg[k] += (FG[ni] - pg[k]) * 0.5; pb[k] += (FB[ni] - pb[k]) * 0.5;
            if (eat > 0) food[ni] = fd - eat > 0.02 ? fd - eat : 0;
          }
          R[ni] += dep * pr[k]; G[ni] += dep * pg[k]; Bl[ni] += dep * pb[k];
        }
        ax[k] = x; ay[k] = y; ah[k] = d;
      }
      // ---- the trail blurs and fades; the scent spreads and is topped up by food ----
      const R2 = sim.R2, G2 = sim.G2, Bl2 = sim.Bl2, S2 = sim.scent2, A = sim.A;
      mass = 0;
      for (let y = 0; y < h; y++) {
        const yc = y * w, yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w;
        for (let x = 0; x < w; x++) {
          const i = yc + x, xl = XL[x], xr = XR[x];
          const l = yc + xl, r = yc + xr, u = yu + x, dn = yd + x, ul = yu + xl, ur = yu + xr, dl = yd + xl, dr = yd + xr;
          const fd = food[i];
          let v = keep * (bk * R[i] + bl * (R[i] + R[l] + R[r] + R[u] + R[dn] + R[ul] + R[ur] + R[dl] + R[dr]) / 9);
          const fr = MOULD_FLOOR * fd * FR[i]; if (v < fr) v = fr; else if (v > 1) v = 1;
          R2[i] = v; mass += v;
          v = keep * (bk * G[i] + bl * (G[i] + G[l] + G[r] + G[u] + G[dn] + G[ul] + G[ur] + G[dl] + G[dr]) / 9);
          const fg = MOULD_FLOOR * fd * FG[i]; if (v < fg) v = fg; else if (v > 1) v = 1;
          G2[i] = v; mass += v;
          v = keep * (bk * Bl[i] + bl * (Bl[i] + Bl[l] + Bl[r] + Bl[u] + Bl[dn] + Bl[ul] + Bl[ur] + Bl[dl] + Bl[dr]) / 9);
          const fb = MOULD_FLOOR * fd * FB[i]; if (v < fb) v = fb; else if (v > 1) v = 1;
          Bl2[i] = v; mass += v;
          v = keepS * (scent[i] + scent[l] + scent[r] + scent[u] + scent[dn] + scent[ul] + scent[ur] + scent[dl] + scent[dr]) / 9;
          const sv = scentW * fd; if (v < sv) v = sv;
          S2[i] = wall[i] ? 0 : v;
          A[i] = wall[i] ? -1 : -0.45 * fd;
        }
      }
      sim.R = R2; sim.G = G2; sim.Bl = Bl2; sim.R2 = R; sim.G2 = G; sim.Bl2 = Bl;
      sim.scent = S2; sim.scent2 = scent;
    }
    sim.ecg = mass / n;
  };

  // A marks walls (-1) and food (a dip, deeper the more there is); the trail draws itself.
  sim.sync = function () {
    const { A, wall, food } = sim;
    for (let i = 0; i < n; i++) A[i] = wall[i] ? -1 : -0.45 * food[i];
  };

  // Give the mould its body: count agents in a disc, or everywhere when no disc is given. Colourless until they eat.
  sim.populate = function (count, cx, cy, rad) {
    const { w, h, rng, occ, wall } = sim;
    occ.fill(0);
    sim.ax = new Float32Array(count); sim.ay = new Float32Array(count); sim.ah = new Int32Array(count); sim.ai = new Int32Array(count);
    sim.pr = new Float32Array(count); sim.pg = new Float32Array(count); sim.pb = new Float32Array(count);
    sim.pr.fill(1 / 3); sim.pg.fill(1 / 3); sim.pb.fill(1 / 3);
    for (let k = 0; k < count; k++) {
      let x, y, tries = 0;
      do {
        if (rad) { const a = rng() * Math.PI * 2, r = rad * Math.sqrt(rng()); x = cx + r * Math.cos(a); y = cy + r * Math.sin(a); x = ((x % w) + w) % w; y = ((y % h) + h) % h; }
        else { x = rng() * w; y = rng() * h; }
      } while (wall[(y | 0) * w + (x | 0)] && ++tries < 20);
      const i = (y | 0) * w + (x | 0);
      sim.ax[k] = x; sim.ay[k] = y; sim.ah[k] = (rng() * MOULD_DIRS) | 0; sim.ai[k] = i; occ[i] = 1;
    }
    sim.count = count;
  };

  // Trail, scent, food and walls go; the mould itself stays, colourless again.
  sim.clear = function () {
    sim.R.fill(0); sim.G.fill(0); sim.Bl.fill(0); sim.scent.fill(0); sim.food.fill(0); sim.wall.fill(0);
    sim.pr.fill(1 / 3); sim.pg.fill(1 / 3); sim.pb.fill(1 / 3);
    sim.sync();
  };

  // Paint food in a colour, or a wall when erase is set. Food does not go over walls.
  sim.paint = function (cx, cy, rad, erase, pig) {
    const { w, h, food, FR, FG, FB, wall, R, G, Bl } = sim;
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
        if (erase) { wall[i] = 1; food[i] = 0; R[i] = 0; G[i] = 0; Bl[i] = 0; }
        else if (!wall[i]) { food[i] = 1; FR[i] = pr; FG[i] = pg; FB[i] = pb; }
      }
    }
    sim.sync();
  };

  // Drop a few bits of food, each in its own colour.
  sim.seed = function (count, rng) {
    rng = rng || sim.rng;
    const r = Math.max(2.5, Math.min(sim.w, sim.h) * 0.022);
    for (let s = 0; s < count; s++) {
      sim.paint(rng() * sim.w, rng() * sim.h, r * (0.7 + rng() * 0.8), false, huePigment(rng() * 360));
    }
  };

  // Resize the grid, keeping the maps (nearest-neighbour) and the mould (scaled).
  sim.resample = function (nw, nh) {
    const next = createMould(nw, nh);
    next.rng = sim.rng;
    for (let y = 0; y < nh; y++) {
      const sy = Math.min(sim.h - 1, Math.floor(y * sim.h / nh));
      for (let x = 0; x < nw; x++) {
        const sx = Math.min(sim.w - 1, Math.floor(x * sim.w / nw));
        const si = sy * sim.w + sx, di = y * nw + x;
        next.R[di] = sim.R[si]; next.G[di] = sim.G[si]; next.Bl[di] = sim.Bl[si]; next.scent[di] = sim.scent[si];
        next.food[di] = sim.food[si]; next.FR[di] = sim.FR[si]; next.FG[di] = sim.FG[si]; next.FB[di] = sim.FB[si];
        next.wall[di] = sim.wall[si];
      }
    }
    const c = sim.count;
    next.ax = new Float32Array(c); next.ay = new Float32Array(c); next.ah = Int32Array.from(sim.ah); next.ai = new Int32Array(c);
    next.pr = Float32Array.from(sim.pr); next.pg = Float32Array.from(sim.pg); next.pb = Float32Array.from(sim.pb);
    for (let k = 0; k < c; k++) {
      const x = Math.min(nw - 1e-3, sim.ax[k] * nw / sim.w), y = Math.min(nh - 1e-3, sim.ay[k] * nh / sim.h), i = (y | 0) * nw + (x | 0);
      next.ax[k] = x; next.ay[k] = y; next.ai[k] = i; next.occ[i] = 1;
    }
    next.count = c;
    next.sync();
    return next;
  };

  sim.sync();
  return sim;
}
if (typeof module !== 'undefined') module.exports = { createMould };
