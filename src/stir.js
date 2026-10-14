// Stirring: a fluid flow on the same torus as the garden, after Jos Stam's "stable fluids" (1999), which
// carries the chemicals along while they keep reacting; a few pressure sweeps a frame keep it close to
// incompressible. Velocity is in cells per frame. A drag pushes the fluid; the flow slows by itself and then
// sleeps, so a still dish costs nothing.
function createFlow(w, h) {
  const n = w * h;
  const flow = {
    w, h,
    u: new Float32Array(n), v: new Float32Array(n), u2: new Float32Array(n), v2: new Float32Array(n),
    p: new Float32Array(n), div: new Float32Array(n),
    XL: new Int32Array(w), XR: new Int32Array(w), YU: new Int32Array(h), YD: new Int32Array(h),
    speed: 0,   // the fastest cell after the last frame, in cells per frame
  };
  for (let x = 0; x < w; x++) { flow.XL[x] = (x - 1 + w) % w; flow.XR[x] = (x + 1) % w; }
  for (let y = 0; y < h; y++) { flow.YU[y] = ((y - 1 + h) % h) * w; flow.YD[y] = ((y + 1) % h) * w; }

  // Push the fluid at (cx, cy) toward (dx, dy) cells per frame, with a soft round footprint of radius rad.
  flow.push = function (cx, cy, dx, dy, rad) {
    const { u, v } = flow, r = Math.ceil(rad * 2), inv = 1 / (rad * rad);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      const yy = ((y % h) + h) % h;
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const ex = x - cx, ey = y - cy, g = Math.exp(-(ex * ex + ey * ey) * inv);
        if (g < 0.01) continue;
        const i = yy * w + ((x % w) + w) % w;
        u[i] += (dx - u[i]) * g; v[i] += (dy - v[i]) * g;   // the fluid under the stroke takes the stroke's velocity
      }
    }
    flow.speed = Math.max(flow.speed, Math.sqrt(dx * dx + dy * dy));
  };

  // Carry fields along the flow for one frame: each cell takes what was upstream of it (semi-Lagrangian,
  // bilinear), so the step is stable however fast the stroke. srcs and dsts are lists of fields.
  flow.carry = function (srcs, dsts) {
    const { u, v } = flow, m = srcs.length;
    for (let y = 0; y < h; y++) {
      const yc = y * w;
      for (let x = 0; x < w; x++) {
        const i = yc + x, du = u[i], dv = v[i];
        if (du * du + dv * dv < 1e-6) { for (let k = 0; k < m; k++) dsts[k][i] = srcs[k][i]; continue; }
        const sx = x - du, sy = y - dv;
        let x0 = Math.floor(sx), y0 = Math.floor(sy);
        const fx = sx - x0, fy = sy - y0;
        while (x0 < 0) x0 += w; while (x0 >= w) x0 -= w;
        while (y0 < 0) y0 += h; while (y0 >= h) y0 -= h;
        const x1 = x0 + 1 === w ? 0 : x0 + 1, r0 = y0 * w, r1 = (y0 + 1 === h ? 0 : y0 + 1) * w;
        const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
        const i00 = r0 + x0, i01 = r0 + x1, i10 = r1 + x0, i11 = r1 + x1;
        for (let k = 0; k < m; k++) { const s = srcs[k]; dsts[k][i] = a * s[i00] + b * s[i01] + c * s[i10] + d * s[i11]; }
      }
    }
  };

  // One frame of the flow: it carries itself along, sheds whatever would compress it (a pressure solve by
  // over-relaxed red–black sweeps, warm-started from the last frame), and keeps a share keep of its speed.
  flow.step = function (keep, sweeps) {
    if (flow.speed < 0.02) { if (flow.speed > 0) flow.clear(); return false; }
    const { u, v, u2, v2, p, div, XL, XR, YU, YD } = flow;
    flow.carry([u, v], [u2, v2]);
    for (let y = 0; y < h; y++) {
      const yc = y * w, yu = YU[y], yd = YD[y];
      for (let x = 0; x < w; x++) div[yc + x] = 0.5 * (u2[yc + XR[x]] - u2[yc + XL[x]] + v2[yd + x] - v2[yu + x]);
    }
    const om = 1.7;
    for (let k = 0; k < sweeps; k++) {
      for (let colour = 0; colour < 2; colour++) {
        for (let y = 0; y < h; y++) {
          const yc = y * w, yu = YU[y], yd = YD[y];
          for (let x = (y + colour) & 1; x < w; x += 2) {
            const i = yc + x;
            const g = 0.25 * (p[yc + XL[x]] + p[yc + XR[x]] + p[yu + x] + p[yd + x] - div[i]);
            p[i] += om * (g - p[i]);
          }
        }
      }
    }
    let top = 0;
    for (let y = 0; y < h; y++) {
      const yc = y * w, yu = YU[y], yd = YD[y];
      for (let x = 0; x < w; x++) {
        const i = yc + x;
        const nu = (u2[i] - 0.5 * (p[yc + XR[x]] - p[yc + XL[x]])) * keep;
        const nv = (v2[i] - 0.5 * (p[yd + x] - p[yu + x])) * keep;
        u[i] = nu; v[i] = nv;
        const s2 = nu * nu + nv * nv; if (s2 > top) top = s2;
      }
    }
    flow.speed = Math.sqrt(top);
    return true;
  };

  flow.clear = function () { flow.u.fill(0); flow.v.fill(0); flow.p.fill(0); flow.speed = 0; };
  return flow;
}
if (typeof module !== 'undefined') module.exports = { createFlow };
