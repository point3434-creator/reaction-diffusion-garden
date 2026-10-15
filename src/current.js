// Liquid Current: prescribed transport plus the existing Gray-Scott chemistry.
// This is an artistic flow field, not a complete Navier-Stokes solver.
function bilerpWrap(arr, x, y, w, h) {
  x = (x % w + w) % w; y = (y % h + h) % h;
  var x0 = Math.floor(x), y0 = Math.floor(y), x1 = (x0 + 1) % w, y1 = (y0 + 1) % h;
  var tx = x - x0, ty = y - y0;
  var i00 = y0 * w + x0, i10 = y0 * w + x1, i01 = y1 * w + x0, i11 = y1 * w + x1;
  var a = arr[i00] * (1 - tx) + arr[i10] * tx;
  var b = arr[i01] * (1 - tx) + arr[i11] * tx;
  return a * (1 - ty) + b * ty;
}
function currentField(x, y, w, h, t, spin) {
  var tau = Math.PI * 2;
  var X = x / w * tau, Y = y / h * tau;
  var tt = t * (0.45 + 1.15 * spin);
  var vx = 1.12 * Math.cos(1.85 * Y + 0.8 * Math.sin(1.1 * X + tt * 0.77))
         - 0.65 * Math.sin(0.93 * (X + Y) - tt * 0.62)
         + 0.35 * Math.cos(2.15 * X - 1.55 * Y + tt * 0.28);
  var vy = 1.06 * Math.sin(1.68 * X - 0.72 * Math.cos(1.18 * Y - tt * 0.84))
         + 0.62 * Math.cos(0.98 * (X - Y) + tt * 0.58)
         + 0.28 * Math.sin(1.45 * X + 2.1 * Y - tt * 0.34);
  return [vx, vy];
}

// Semi-Lagrangian advection carries both chemicals and pigments, then the
// Gray-Scott reaction-diffusion grows within the moving ribbon.
function createCurrent(w, h) {
  var n = w * h;
  var sim = {
    kind: 'current', w: w, h: h,
    A: new Float32Array(n), R: new Float32Array(n), G: new Float32Array(n), Bl: new Float32Array(n),
    A2: new Float32Array(n), R2: new Float32Array(n), G2: new Float32Array(n), Bl2: new Float32Array(n),
    XL: new Int32Array(w), XR: new Int32Array(w), time: 0
  };
  for (var x = 0; x < w; x++) { sim.XL[x] = (x - 1 + w) % w; sim.XR[x] = (x + 1) % w; }
  sim.clear = function () { sim.A.fill(1); sim.R.fill(0); sim.G.fill(0); sim.Bl.fill(0); sim.time = 0; };
  sim.paint = function (cx, cy, rad, erase, pig) {
    var r2 = rad * rad;
    var x0 = Math.floor(cx - rad), x1 = Math.ceil(cx + rad), y0 = Math.floor(cy - rad), y1 = Math.ceil(cy + rad);
    var pr = pig ? pig[0] : 1 / 3, pg = pig ? pig[1] : 1 / 3, pb = pig ? pig[2] : 1 / 3;
    for (var y = y0; y <= y1; y++) {
      var yy = ((y % h) + h) % h;
      for (var x = x0; x <= x1; x++) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        var i = yy * w + ((x % w) + w) % w;
        if (erase) { sim.R[i] = 0; sim.G[i] = 0; sim.Bl[i] = 0; sim.A[i] = 1; }
        else { sim.R[i] = pr; sim.G[i] = pg; sim.Bl[i] = pb; sim.A[i] = Math.max(0.55, sim.A[i] * 0.94); }
      }
    }
  };
  sim.seed = function (count, rng) {
    rng = rng || Math.random;
    var r = Math.max(2.6, Math.min(sim.w, sim.h) * 0.015);
    for (var s = 0; s < count; s++) sim.paint(rng() * sim.w, rng() * sim.h, r * (0.72 + rng() * 0.95), false, huePigment(rng() * 360));
  };
  sim.step = function (f, k, steps, flowStrength, spin) {
    var A = sim.A, R = sim.R, G = sim.G, Bl = sim.Bl;
    var A2 = sim.A2, R2 = sim.R2, G2 = sim.G2, Bl2 = sim.Bl2;
    var kf = k + f;
    for (var s = 0; s < steps; s++) {
      sim.time += 0.012 + 0.016 * spin;
      var back = 0.42 * flowStrength;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var v = currentField(x, y, w, h, sim.time, spin);
          var sx = x - v[0] * back, sy = y - v[1] * back;
          var i = y * w + x;
          A2[i] = bilerpWrap(A, sx, sy, w, h);
          R2[i] = bilerpWrap(R, sx, sy, w, h);
          G2[i] = bilerpWrap(G, sx, sy, w, h);
          Bl2[i] = bilerpWrap(Bl, sx, sy, w, h);
        }
      }
      for (y = 0; y < h; y++) {
        var yc = y * w, yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w;
        for (x = 0; x < w; x++) {
          var i0 = yc + x, xl = sim.XL[x], xr = sim.XR[x];
          var l = yc + xl, r = yc + xr, u = yu + x, d = yd + x;
          var ul = yu + xl, ur = yu + xr, dl = yd + xl, dr = yd + xr;
          var a = A2[i0], br = R2[i0], bg = G2[i0], bb = Bl2[i0], b = br + bg + bb;
          var lapA = -a + 0.2 * (A2[l] + A2[r] + A2[u] + A2[d]) + 0.05 * (A2[ul] + A2[ur] + A2[dl] + A2[dr]);
          var lapR = -br + 0.2 * (R2[l] + R2[r] + R2[u] + R2[d]) + 0.05 * (R2[ul] + R2[ur] + R2[dl] + R2[dr]);
          var lapG = -bg + 0.2 * (G2[l] + G2[r] + G2[u] + G2[d]) + 0.05 * (G2[ul] + G2[ur] + G2[dl] + G2[dr]);
          var lapB = -bb + 0.2 * (Bl2[l] + Bl2[r] + Bl2[u] + Bl2[d]) + 0.05 * (Bl2[ul] + Bl2[ur] + Bl2[dl] + Bl2[dr]);
          var grow = a * b - kf;
          var edgeSoft = 0.012 * flowStrength;
          var na = a + (lapA - a * b * b + f * (1 - a)) + edgeSoft * (1 - a) * 0.12;
          var nr = br + (0.5 * lapR + grow * br);
          var ng = bg + (0.5 * lapG + grow * bg);
          var nb = bb + (0.5 * lapB + grow * bb);
          A[i0] = na < 0 ? 0 : (na > 1 ? 1 : na);
          // Cap total B while preserving its pigment shares, as in the garden.
          var pr = nr < 0 ? 0 : nr, pg = ng < 0 ? 0 : ng, pb = nb < 0 ? 0 : nb;
          var sb = pr + pg + pb, sc = sb > 1 ? 1 / sb : 1;
          R[i0] = pr * sc; G[i0] = pg * sc; Bl[i0] = pb * sc;
        }
      }
    }
  };
  sim.resample = function (nw, nh) {
    var next = createCurrent(nw, nh);
    next.time = sim.time;
    for (var y = 0; y < nh; y++) {
      var sy = Math.min(sim.h - 1, Math.floor(y * sim.h / nh));
      for (var x = 0; x < nw; x++) {
        var sx = Math.min(sim.w - 1, Math.floor(x * sim.w / nw));
        var si = sy * sim.w + sx, di = y * nw + x;
        next.A[di] = sim.A[si]; next.R[di] = sim.R[si]; next.G[di] = sim.G[si]; next.Bl[di] = sim.Bl[si];
      }
    }
    return next;
  };
  sim.clear();
  return sim;
}
if (typeof module !== 'undefined') module.exports = { createCurrent, currentField, bilerpWrap };
