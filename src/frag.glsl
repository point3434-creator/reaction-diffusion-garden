#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uField;
uniform sampler2D uLut;
uniform vec2 uTexSize;
uniform vec3 uBg;
uniform float uLightTheme;
uniform float uLineage;
uniform float uGlow;
uniform float uBump;
uniform int uMat;
uniform float uTime;
uniform float uLutFlip;
uniform float uBeat;
uniform float uHue;
uniform float uHeart;
uniform vec2 uTilt;
in vec2 vUv;
out vec4 outColor;

const float E0 = 0.09;
const float BPK = 0.34;

vec4 cubicW(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}

// Smooth (B-spline) bicubic sample built from four bilinear fetches.
vec4 fieldAt(vec2 uv) {
  vec2 coords = uv * uTexSize - 0.5;
  vec2 fxy = fract(coords);
  coords -= fxy;
  vec4 xc = cubicW(fxy.x);
  vec4 yc = cubicW(fxy.y);
  vec4 c = coords.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = (c + vec4(xc.yw, yc.yw) / s) / uTexSize.xxyy;
  vec4 s0 = texture(uField, off.xz);
  vec4 s1 = texture(uField, off.yz);
  vec4 s2 = texture(uField, off.xw);
  vec4 s3 = texture(uField, off.yw);
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

float bsum(vec4 c) { return c.r + c.g + c.b; }

// Turn the concentration bump into a dome: vertical at the edge, flat on top.
float heightOf(float b) {
  float q = clamp((b - E0) / (BPK - E0), 0.0, 1.0);
  return sqrt(max(0.0, 1.0 - (1.0 - q) * (1.0 - q)));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
// The field averaged around a ring: a cheap blur for glows.
vec4 ringC(vec2 uv, vec2 px, float r, float phase) {
  vec4 s = vec4(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982 + phase;
    s += texture(uField, uv + vec2(cos(a), sin(a)) * px * r);
  }
  return s * 0.125;
}
// Turn a colour's hue by an angle: a rotation about the grey axis.
vec3 hueTurn(vec3 c, float a) {
  const vec3 k = vec3(0.57735027);
  float ca = cos(a), sa = sin(a);
  return clamp(c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca), 0.0, 1.0);
}
// Graph paper under the dish, in grid cells: a line every five cells.
float gridAt(vec2 p) {
  vec2 f = abs(fract(p * 0.2) - 0.5) * 5.0;
  return 1.0 - smoothstep(0.1, 0.45, min(f.x, f.y));
}
// Heat to colour. A lineage burns its own hue, dark through hue to white-hot; a palette burns its ramp.
vec3 flameCol(float x, vec3 hue) {
  vec3 a = hue * smoothstep(0.0, 0.45, x) * (0.25 + 0.75 * smoothstep(0.1, 0.7, x));
  a = mix(a, vec3(1.0, 0.98, 0.92), smoothstep(0.72, 1.0, x));
  vec3 l = texture(uLut, vec2(mix(x, 1.0 - x, uLutFlip), 0.5)).rgb * smoothstep(0.0, 0.08, x);
  return mix(l, a, uLineage);
}

void main() {
  vec2 px = 1.0 / uTexSize;
  vec4 c = fieldAt(vUv);
  float b = bsum(c);
  float o = 0.5;
  float hL = heightOf(bsum(fieldAt(vUv - vec2(px.x * o, 0.0))));
  float hR = heightOf(bsum(fieldAt(vUv + vec2(px.x * o, 0.0))));
  float hU = heightOf(bsum(fieldAt(vUv - vec2(0.0, px.y * o))));
  float hD = heightOf(bsum(fieldAt(vUv + vec2(0.0, px.y * o))));
  float h = heightOf(b);
  vec3 N = normalize(vec3(-(hR - hL) * uBump, -(hD - hU) * uBump, 2.0 * o));

  // the lights live in the room; tilting the phone moves them across the dish
  vec3 L = normalize(vec3(-0.45 + uTilt.x, -0.55 + uTilt.y, 0.7));
  vec3 Vv = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + Vv);
  vec3 L2 = normalize(vec3(0.6 + 0.5 * uTilt.x, -0.3 + 0.5 * uTilt.y, 0.55));
  vec3 H2 = normalize(L2 + Vv);
  vec3 Lc = normalize(vec3(0.5 + uTilt.x, 0.62 + uTilt.y, 0.6));
  float ndl = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 160.0);
  float spec2 = pow(max(dot(N, H2), 0.0), 14.0);
  float fres = 1.0 - clamp(N.z, 0.0, 1.0);
  float caus = pow(max(dot(N, Lc), 0.0), 22.0);

  float m = max(c.r, max(c.g, c.b));
  vec3 pig = m > 1e-5 ? c.rgb / m : vec3(1.0);
  pig = hueTurn(pig, uHue);
  float q = clamp((b - E0) / (BPK - E0), 0.0, 1.0);
  vec3 lutc = hueTurn(texture(uLut, vec2(0.45 + 0.5 * q, 0.5)).rgb, uHue);
  vec3 tint = mix(lutc, pig, uLineage);
  // The opaque materials read the single-hue palettes from their saturated middle.
  vec3 tintP = mix(hueTurn(texture(uLut, vec2(0.55 + 0.25 * q, 0.5)).rgb, uHue), pig, uLineage);
  float lt = uLightTheme;

  float mask = smoothstep(E0 - 0.012, E0 + 0.012, b);
  float bS = bsum(texture(uField, vUv - vec2(1.3, 1.5) * px));
  float shadow = smoothstep(E0 - 0.05, E0 + 0.01, bS) * (1.0 - mask);
  float halo = smoothstep(E0 - 0.07, E0, b) * (1.0 - mask);
  vec3 bg = uBg * (1.0 - shadow * mix(0.45, 0.22, lt)) + tint * halo * 0.10 * (1.0 - lt);
  float grain = vnoise(gl_FragCoord.xy * 0.45) * 0.6 + vnoise(gl_FragCoord.xy * 0.12) * 0.4;
  vec3 paper = uBg * (0.965 + 0.05 * grain);

  vec3 col = vec3(0.0);
  if (uMat == 0) {
    // ---- glass ----
    if (lt > 0.5) {
      // coloured glass on paper: light passes through, thicker glass is deeper
      col = uBg * tint * (1.0 - 0.33 * h);
      col *= 0.85 + 0.15 * ndl;
      float rim = fres * fres * 0.7;
      col = mix(col, col * 0.35, rim);
      float line = smoothstep(0.35, 0.5, fres) * (1.0 - smoothstep(0.5, 0.65, fres)) * 0.35;
      col = mix(col, vec3(0.97), line);
      col += (tint * 0.3 + 0.35) * caus;
      col += vec3(spec * (0.85 + 0.4 * uGlow) + spec2 * 0.18);
    } else {
      // lit glass against the dark: reflective rim, hot highlight, a caustic on the far side
      col = tint * (0.18 + 0.42 * ndl) + tint * 0.28 * (1.0 - h);
      float fr = fres * fres * fres * (0.5 + 0.2 * uGlow);
      col = mix(col, vec3(0.9, 0.95, 1.0), fr);
      col += tint * caus * (0.8 + 0.4 * uGlow) + vec3(0.3) * caus;
      col += vec3(1.0, 1.0, 0.95) * (spec * (1.0 + 0.5 * uGlow) + spec2 * 0.22);
    }
  } else if (uMat == 1) {
    // ---- quicksilver: a mirror reflecting a small studio ----
    vec3 Rv = vec3(2.0 * N.z * N.x, 2.0 * N.z * N.y, 2.0 * N.z * N.z - 1.0);
    float up = -Rv.y;
    float back = -Rv.z;
    vec3 env = mix(vec3(0.04, 0.04, 0.055), vec3(0.60, 0.66, 0.76), smoothstep(-1.0, 1.0, up));
    env *= 1.0 - 0.45 * smoothstep(0.0, 1.0, back);
    env += vec3(0.30, 0.31, 0.34) * smoothstep(0.2, 1.0, Rv.z);
    env += vec3(1.0, 0.98, 0.93) * smoothstep(0.72, 0.88, dot(Rv, normalize(vec3(-0.25 + uTilt.x, -0.7 + uTilt.y, 0.66)))) * 1.5;
    env += vec3(0.75, 0.82, 0.95) * smoothstep(0.84, 0.96, dot(Rv, normalize(vec3(0.75, 0.1, 0.65)))) * 0.6;
    env += vec3(0.5, 0.33, 0.2) * smoothstep(0.5, 0.95, dot(Rv, normalize(vec3(0.0, 0.85, -0.5)))) * 0.35;
    env *= mix(1.0, 1.2, lt);
    vec3 metal = mix(vec3(0.94, 0.95, 0.97), tintP, 0.6);
    col = metal * env + vec3(1.0) * spec * 0.6 + metal * spec2 * 0.15;
    bg = uBg * (1.0 - shadow * mix(0.5, 0.3, lt));
  } else if (uMat == 2) {
    // ---- velvet: a dark body, bright where the light grazes the nap ----
    float wrap = max(0.0, (dot(N, L) + 0.5) / 1.5);
    float nap = 0.9 + 0.2 * vnoise(gl_FragCoord.xy * 0.35);
    float sheen = pow(fres, 1.3);
    vec3 body = tintP * mix(0.40, 0.50, lt);
    vec3 sheenCol = mix(vec3(1.0, 0.97, 0.92), tintP, 0.35);
    col = body * (0.35 + 0.65 * wrap) * nap;
    col += sheenCol * sheen * (0.75 + 0.3 * uGlow) * (0.55 + 0.45 * wrap);
    col += tintP * 0.2 * pow(ndl, 3.0);
    bg = uBg * (1.0 - shadow * mix(0.5, 0.3, lt));
  } else if (uMat == 3) {
    // ---- wax: light gets in, and glows back out through the thin edges ----
    float wrap = max(0.0, (dot(N, L) + 0.6) / 1.6);
    vec3 base = mix(tintP, vec3(1.0, 0.96, 0.88), 0.22);
    float thin = 1.0 - h;
    float through = max(dot(-N, L) * 0.5 + 0.5, 0.0);
    float sss = thin * (0.4 + 0.6 * through);
    col = base * (mix(0.30, 0.42, lt) + 0.55 * wrap);
    col += base * sss * 0.55 + tintP * thin * 0.18;
    col *= 1.0 - 0.12 * h;
    col += vec3(1.0, 0.98, 0.95) * pow(max(dot(N, H), 0.0), 18.0) * 0.26 + vec3(1.0) * spec * 0.22;
    col += base * caus * 0.18;
    bg = uBg * (1.0 - shadow * mix(0.32, 0.16, lt));
    bg = mix(bg, bg * tintP, halo * 0.25 * lt) + tintP * halo * 0.14 * (1.0 - lt);
  } else if (uMat == 4) {
    // ---- neon: a hot tube just inside the edge, dark glass within, a halo without ----
    float bright = 0.8 + 0.6 * uGlow;
    float t1 = (q - 0.14) / 0.11;
    float t2 = (q - 0.14) / 0.30;
    float tube = exp(-t1 * t1);
    float wide = exp(-t2 * t2);
    vec3 hot = mix(tintP, vec3(1.0), 0.72);
    col = tintP * 0.05 + vec3(0.015, 0.02, 0.03);
    col += tintP * wide * 0.6 * bright;
    col += hot * tube * 1.25 * bright;
    col += vec3(1.0) * spec * 0.2;
    vec4 gc = 0.5 * (ringC(vUv, px, 2.5, 0.0) + ringC(vUv, px, 5.0, 0.39));
    float gm = max(gc.r, max(gc.g, gc.b));
    vec3 gpig = hueTurn(gm > 1e-6 ? gc.rgb / gm : vec3(1.0), uHue);
    vec3 glowTint = mix(tintP, gpig, uLineage);
    float glowOut = smoothstep(0.0, 0.22, bsum(gc));
    bg = uBg + glowTint * (glowOut * 0.38 + halo * 0.45) * bright;
  } else if (uMat == 5) {
    // ---- watercolour: pigment pools at the edge and settles into the grain ----
    vec2 gp = vUv * uTexSize;
    float gran = 0.55 * vnoise(gp * 0.55 + 7.0) + 0.3 * vnoise(gp * 1.3 + 3.0) + 0.15 * vnoise(gl_FragCoord.xy * 0.5);
    float blotch = vnoise(gp * 0.09 + 11.0);
    float edge = smoothstep(0.0, 0.2, q) * (1.0 - smoothstep(0.2, 0.6, q));
    float dens = 0.40 + 0.22 * (1.0 - q) + 0.40 * edge;
    dens *= (0.72 + 0.5 * gran) * (0.85 + 0.3 * blotch);
    vec3 pigc = pow(mix(tintP, vec3(dot(tintP, vec3(0.3, 0.5, 0.2))), 0.15) * 0.92, vec3(1.15));
    col = paper * mix(vec3(1.0), pigc, clamp(dens, 0.0, 1.0));
    float line = smoothstep(0.0, 0.05, q) * (1.0 - smoothstep(0.05, 0.16, q));
    col *= 1.0 - 0.18 * line;
    col *= 1.0 - 0.10 * smoothstep(0.7, 1.0, q) * gran;
    mask = smoothstep(E0 - 0.03, E0 + 0.015, b);
    bg = paper * mix(vec3(1.0), pigc, halo * 0.3 * (0.8 + 0.4 * gran));
  } else if (uMat == 6) {
    // ---- letterpress: pressed into the paper, lit from the upper left ----
    vec3 Nd = vec3(-N.x, -N.y, N.z);
    float rel = dot(Nd, L) / L.z;
    vec3 ink = mix(paper * 1.6 + tintP * 0.26, paper * mix(vec3(1.0), tintP, 0.38), lt);
    float amp = mix(1.0, 0.45, lt);
    col = ink * clamp(1.0 + amp * (rel - 1.0), mix(0.25, 0.45, lt), 2.4);
    col *= 1.0 - 0.08 * h;
    col += vec3(1.0) * pow(max(dot(Nd, H), 0.0), 50.0) * mix(0.16, 0.08, lt);
    bg = paper;
  } else if (uMat == 7) {
    // ---- fire: the body is embers, and every point looks down the screen for the blob burning below it ----
    vec2 gp = vUv * uTexSize;
    float t = uTime;
    // tongues: tall narrow features scrolling upward, and a per-column flicker
    float colN = vnoise(vec2(gp.x * 0.22 + t * 0.3, t * 1.4));
    float tongue = vnoise(vec2(gp.x * 0.5, gp.y * 0.12 + t * 2.4));
    float tongue2 = vnoise(vec2(gp.x * 1.1 + 4.0, gp.y * 0.3 + t * 3.6));
    float flick = 0.5 * colN + 0.3 * tongue + 0.2 * tongue2;
    float reach = 6.0 + 18.0 * flick * flick;
    float heat = 0.0;
    vec4 src = c;
    for (int k = 0; k < 12; k++) {
      float d = (float(k) + 0.5) * 1.6;
      float wob = (vnoise(vec2(gp.x * 0.4 + float(k) * 0.7, gp.y * 0.25 - d * 0.2 + t * 1.6)) - 0.5) * (1.0 + 0.25 * d);
      vec4 smp = texture(uField, vUv + vec2(wob, d) * px);
      float hk = smoothstep(E0 * 0.7, BPK * 0.7, bsum(smp)) * clamp(1.0 - d / reach, 0.0, 1.0);
      if (hk > heat) { heat = hk; src = smp; }
    }
    heat = clamp(heat * (0.45 + 0.65 * smoothstep(0.2, 0.8, tongue)) * (0.7 + 0.5 * tongue2), 0.0, 1.0);
    float sm = max(src.r, max(src.g, src.b));
    vec3 fhue = hueTurn(sm > 1e-5 ? src.rgb / sm : vec3(1.0), uHue);
    vec3 flame = flameCol(pow(heat, 0.85), fhue);
    float pulse = 0.75 + 0.25 * vnoise(gp * 0.35 + vec2(t * 0.6, t * 0.9));
    float crust = smoothstep(0.3, 0.8, vnoise(gp * 0.7 + vec2(0.0, t * 0.2)));
    vec3 body = flameCol(0.14 + 0.36 * q * pulse, tintP) * (0.4 + 0.6 * crust);
    col = body + flame * 1.0 + vec3(1.0, 0.9, 0.7) * spec * 0.1;
    bg = uBg + flame * 1.15 + flameCol(0.3, tintP) * halo * 0.5;
  } else if (uMat == 8) {
    // ---- ice: tinted ice with frost veins, glints that twinkle, and a cold mist around it ----
    vec2 gp = vUv * uTexSize;
    float t = uTime;
    vec3 iceCol = mix(vec3(0.78, 0.90, 1.0), tintP, 0.35);
    vec3 deep = mix(vec3(0.16, 0.42, 0.78), tintP * 0.5, 0.4);
    float r1 = 1.0 - abs(2.0 * vnoise(gp * 0.3 + t * 0.03) - 1.0);
    float r2 = 1.0 - abs(2.0 * vnoise(gp * 0.75 - t * 0.02 + 5.0) - 1.0);
    float veins = smoothstep(0.86, 0.99, r1) * 0.8 + smoothstep(0.9, 1.0, r2) * 0.45;
    float frost = (0.25 + 0.75 * (1.0 - h)) * (0.6 * vnoise(gp * 1.4 + 9.0) + 0.4 * vnoise(gp * 3.0 + 2.0));
    if (lt > 0.5) {
      col = uBg * mix(iceCol, deep, 0.5 * h) * (0.9 + 0.1 * ndl);
    } else {
      col = mix(iceCol * 0.12, deep, h * 0.75) + iceCol * (0.06 + 0.22 * ndl);
    }
    col += iceCol * veins * mix(0.55, -0.15, lt);
    col = mix(col, vec3(0.95, 0.98, 1.0), frost * 0.5);
    col = mix(col, vec3(0.9, 0.96, 1.0), fres * fres * 0.65);
    col += vec3(1.0) * spec * 1.0 + vec3(0.8, 0.9, 1.0) * spec2 * 0.25;
    float sp = hash12(floor(gl_FragCoord.xy * 0.5) + 0.5);
    float tw = 0.5 + 0.5 * sin(t * 4.0 + sp * 80.0);
    col += vec3(1.0) * step(0.99, sp) * tw * tw * tw * (0.5 + 0.7 * h);
    float mist = vnoise(gp * 0.15 + vec2(t * 0.12, -t * 0.08)) * vnoise(gp * 0.4 - vec2(t * 0.05, t * 0.1) + 3.0);
    float near = smoothstep(0.0, 0.15, bsum(ringC(vUv, px, 6.0, 0.0)) + halo);
    bg = uBg * (1.0 - shadow * mix(0.3, 0.15, lt));
    bg = mix(bg, mix(bg, vec3(0.85, 0.93, 1.0), 0.55), near * mist * 1.1 * (1.0 - lt));
    bg = mix(bg, bg * vec3(0.88, 0.94, 1.0), near * mist * 0.8 * lt);
  } else if (uMat == 10) {
    // ---- iridescent: a thin film whose thickness follows the dome and drifts, so the colours swirl ----
    vec2 gp = vUv * uTexSize;
    float t = uTime;
    float swirl = 0.65 * vnoise(gp * 0.07 + vec2(t * 0.08, -t * 0.06)) + 0.35 * vnoise(gp * 0.17 - vec2(t * 0.03, t * 0.09) + 7.0);
    float own = dot(tintP, vec3(0.45, 0.3, 0.25));
    float d = 150.0 + 380.0 * h + 220.0 * swirl + 240.0 * own;
    float cosT = sqrt(max(0.0, 1.0 - (1.0 - N.z * N.z) / 1.7689));
    vec3 ph = 16.7133 * d * cosT / vec3(650.0, 532.0, 450.0);
    vec3 R = 0.5 - 0.5 * cos(ph);
    vec3 refl = R * (0.45 + 0.55 * fres * fres);
    vec3 lightCol = vec3(1.0, 0.98, 0.95) * (0.6 + 0.4 * ndl);
    // on paper the film mostly takes colour away (what it reflects, the paper does not get); against the dark it gives it
    if (lt > 0.5) col = uBg * (1.0 - refl * 0.9) * (0.88 + 0.12 * ndl) + refl * lightCol * 0.2;
    else col = uBg * 0.6 + refl * lightCol * 1.3 + tintP * 0.05;
    col = mix(col, vec3(0.9, 0.95, 1.0), pow(fres, 6.0) * 0.45);
    col += vec3(1.0) * spec * (0.8 + 0.3 * uGlow) + vec3(1.0) * spec2 * 0.12;
    bg = uBg * (1.0 - shadow * mix(0.3, 0.12, lt)) + tintP * halo * 0.05 * (1.0 - lt);
  } else if (uMat == 11) {
    // ---- contour: the field's own level lines, lit like neon, drifting outward ----
    float t = uTime;
    float s = b < E0 ? log(max(b, 1e-5)) : log(E0) + (b - E0) * 11.0;
    float v = s * 0.45 + t * 0.2;
    float dv = fwidth(v) + 1e-4;
    float dist = abs(fract(v) - 0.5) / dv;
    float core = 1.0 - smoothstep(0.35, 1.1, dist);
    float glow = exp(-dist * dist * 0.025);
    float fade = smoothstep(-9.5, -3.0, s);
    vec3 lineCol = mix(tintP, vec3(1.0), 0.4 + 0.3 * (1.0 - h));
    float bright = 0.85 + 0.5 * uGlow;
    col = tintP * 0.06 + vec3(0.01, 0.015, 0.03) + tintP * 0.08 * (1.0 - h);
    col += (lineCol * core * 1.25 + tintP * glow * 0.3) * bright;
    col += vec3(1.0) * spec * 0.12;
    bg = uBg + (lineCol * core * 1.1 + tintP * glow * 0.3) * fade * bright + tintP * halo * 0.08;
  } else if (uMat == 12) {
    // ---- prism: clear glass over graph paper; the dome bends blue more than red ----
    vec2 gp = vUv * uTexSize;
    vec3 kc = vec3(0.7, 1.0, 1.35) * 2.8;
    vec3 grid = vec3(gridAt(gp - N.xy * kc.r), gridAt(gp - N.xy * kc.g), gridAt(gp - N.xy * kc.b));
    vec3 glassT = mix(vec3(1.0), tint, 0.45);
    vec3 floorCol = mix(uBg + grid * 0.22, uBg * (1.0 - grid * 0.4), lt);
    col = floorCol * glassT * (0.92 + 0.08 * ndl) + tint * 0.08 * (1.0 - lt);
    vec3 rimC = vec3(
      smoothstep(0.28, 0.46, fres) * (1.0 - smoothstep(0.46, 0.58, fres)),
      smoothstep(0.34, 0.52, fres) * (1.0 - smoothstep(0.52, 0.64, fres)),
      smoothstep(0.40, 0.58, fres) * (1.0 - smoothstep(0.58, 0.70, fres)));
    col += rimC * mix(0.6, 0.45, lt);
    vec3 Hr = normalize(L + Vv + vec3(0.03, 0.02, 0.0));
    vec3 Hb = normalize(L + Vv - vec3(0.03, 0.02, 0.0));
    vec3 specC = vec3(pow(max(dot(N, Hr), 0.0), 160.0), spec, pow(max(dot(N, Hb), 0.0), 160.0));
    col += specC * (0.9 + 0.4 * uGlow) + vec3(spec2) * 0.15;
    col += (tint * 0.3 + 0.3) * caus * 0.5;
    col = mix(col, col * 0.5, fres * fres * 0.5 * lt);
    float g0 = gridAt(gp);
    bg = mix(uBg + g0 * 0.05, uBg * (1.0 - g0 * 0.12), lt) * (1.0 - shadow * mix(0.4, 0.2, lt));
  } else {
    // ---- electricity: arcs that hug the edge, jitter, flicker and strobe; plasma within ----
    vec2 gp = vUv * uTexSize;
    float t = uTime;
    vec3 arcCol = mix(vec3(0.55, 0.72, 1.0), tintP, 0.55);
    vec3 hotCol = mix(arcCol, vec3(1.0), 0.8);
    float strobe = 0.55 + 0.45 * hash12(vec2(floor(t * 20.0), 1.0));
    // the arc is an iso-line of the field, read through a jitter that is large and slow plus small and quick
    vec2 jag = (vec2(vnoise(gp * 0.12 + vec2(0.0, t * 6.0)), vnoise(gp * 0.12 + vec2(t * 5.0, 50.0))) - 0.5) * 6.0
             + (vec2(vnoise(gp * 0.45 + vec2(0.0, t * 13.0) + 9.0), vnoise(gp * 0.45 + vec2(t * 11.0, 70.0))) - 0.5) * 1.6;
    float bj = bsum(texture(uField, vUv + jag * px));
    float lv1 = E0 + 0.03 + 0.05 * vnoise(vec2(t * 3.0, 7.0));
    float lv2 = E0 * (0.25 + 0.4 * vnoise(vec2(t * 2.3, 3.0)));
    float d1 = (bj - lv1) / 0.03;
    float d2 = (bj - lv2) / 0.011;
    float on1 = smoothstep(0.42, 0.56, vnoise(gp * 0.08 + vec2(t * 4.0, 0.0)));
    float on2 = smoothstep(0.5, 0.64, vnoise(gp * 0.07 + vec2(0.0, t * 3.0) + 20.0));
    float arcIn = (exp(-d1 * d1) + 0.35 * exp(-d1 * d1 * 0.12)) * on1 * strobe;
    float arcOut = (exp(-d2 * d2) + 0.35 * exp(-d2 * d2 * 0.25)) * on2 * strobe * smoothstep(0.004, 0.02, bj);
    float t2 = (q - 0.14) / 0.3;
    float wide = exp(-t2 * t2);
    // plasma: drifting filaments inside the glass
    float fil = 1.0 - abs(2.0 * vnoise(gp * 0.22 + vec2(t * 0.7, -t * 0.4)) - 1.0);
    float fil2 = 1.0 - abs(2.0 * vnoise(gp * 0.4 - vec2(t * 0.3, t * 0.8) + 4.0) - 1.0);
    float plasma = pow(fil, 5.0) * 0.8 + pow(fil2, 7.0) * 0.5;
    col = arcCol * 0.05 + vec3(0.01, 0.015, 0.03);
    col += arcCol * wide * 0.3 * strobe;
    col += arcCol * plasma * q * (0.4 + 0.4 * strobe);
    col += (hotCol * 1.5 + arcCol * 0.5) * (arcIn + arcOut);
    col += vec3(1.0) * spec * 0.15;
    vec4 gc = 0.5 * (ringC(vUv, px, 2.5, 0.0) + ringC(vUv, px, 5.0, 0.39));
    float gm = max(gc.r, max(gc.g, gc.b));
    vec3 gpig = hueTurn(gm > 1e-6 ? gc.rgb / gm : vec3(1.0), uHue);
    vec3 glowTint = mix(arcCol, mix(vec3(0.55, 0.72, 1.0), gpig, 0.55), uLineage);
    float glowOut = smoothstep(0.0, 0.22, bsum(gc));
    bg = uBg + glowTint * (glowOut * 0.22 + halo * 0.3) * strobe + (mix(glowTint, vec3(1.0), 0.8) * 1.5 + glowTint * 0.5) * arcOut;
  }
  // the beat: the blobs flare (or, on paper, deepen) and throw a little light around them
  col *= 1.0 + uBeat * mix(0.4, -0.15, lt);
  bg += tint * halo * uBeat * 0.35 * (1.0 - lt);
  bg = mix(bg, bg * tint, halo * uBeat * 0.3 * lt);
  if (uHeart > 0.5) {
    float scar = step(c.a, -0.5);
    if (uHeart < 1.5) {
      // tissue that has just fired is still resting: a wash of the wave's colour that fades as it recovers
      float v = clamp(c.a, 0.0, 1.0) * (1.0 - scar);
      bg = mix(bg, mix(bg, tintP, 0.3) + 0.045, v * (1.0 - lt));
      bg = mix(bg, bg * mix(vec3(1.0), tintP, 0.3) * 0.92, v * lt);
      // scar tissue: dead, rough and dull
      float rough = 0.7 + 0.3 * vnoise(gl_FragCoord.xy * 0.35);
      bg = mix(bg, mix(uBg * 2.2 + 0.05, uBg * 0.72, lt) * rough, scar);
    } else if (uHeart < 2.5) {
      // a smooth potential shows as a bowl: deeper where the particle would rather be
      float pot = clamp(-c.a, 0.0, 0.45) / 0.45 * (1.0 - scar);
      bg = mix(bg, mix(bg * 0.45 + vec3(0.02, 0.03, 0.05), bg * 0.8, lt), pot);
      // walls: hard, smooth, pale
      bg = mix(bg, mix(uBg * 2.6 + 0.12, uBg * 0.62, lt), scar);
    } else {
      // food: a pool of what the mould eats, in its own colour, deeper while there is more of it
      float fd = clamp(-c.a, 0.0, 0.45) / 0.45 * (1.0 - scar);
      vec3 pool = mix(bg * 0.5 + tintP * 0.22, bg * mix(vec3(1.0), tintP, 0.5) * 0.86, lt);
      bg = mix(bg, pool, fd);
      // walls: hard, smooth, pale
      bg = mix(bg, mix(uBg * 2.6 + 0.12, uBg * 0.62, lt), scar);
    }
    mask *= 1.0 - scar;
  }
  outColor = vec4(mix(bg, col, mask), 1.0);
}
