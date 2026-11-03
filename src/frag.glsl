#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uField;
uniform sampler2D uLut;
uniform sampler2D uShellPebbles;
uniform samplerCube uShellEnvironment;
uniform sampler2D uAmberSurface;
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
uniform int uLight;        // 0 the room's own lights, 1 lamps over the dish, 2 a low sun going round
uniform vec4 uLamp[3];     // a lamp: where it hangs over the dish (uv), its height in cells, and 1 if it is on
uniform vec3 uLampCol[3];
uniform float uLampR;      // a lamp's marker, in cells
uniform vec3 uSun;         // toward the sun
uniform vec3 uSunCol;
uniform int uPass;         // 1 draws the domes' heights for the rays, into uHeight; 0 draws the dish
uniform sampler2D uHeight; // those heights, smoothed, at twice the grid's resolution
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
// A dome as the rays see it: the same height, but without the vertical wall at its edge, which would make a
// ragged edge on every shadow.
float blockerOf(float b) {
  float q = clamp((b - E0 + 0.02) / (BPK - E0 + 0.02), 0.0, 1.0);
  return q * (2.0 - q);
}
// How a material lets light through: x how deeply its own colour tints the light, and y how much it dims all
// of it, both for each cell of dome crossed; z how much it spreads the light, softening the shadow; w 1 if any
// light gets through at all. Glass and prism are clear, ice is frosted, a soap film barely there, and wax lets a
// soft glow through.
vec4 seeThrough(int m) {
  if (m == 0) return vec4(0.5, 0.012, 1.0, 1.0);
  if (m == 12) return vec4(0.2, 0.008, 1.0, 1.0);
  if (m == 8) return vec4(0.18, 0.03, 2.5, 1.0);
  if (m == 10) return vec4(0.10, 0.02, 1.3, 1.0);
  if (m == 3) return vec4(0.25, 0.08, 3.0, 1.0);
  return vec4(0.0, 0.0, 1.0, 0.0);
}
// A dome as a lens: x how brightly it gathers light toward the middle of its shadow, y how much light the rim
// bends away, z how much more it bends blue than red.
vec3 lensOf(int m) {
  if (m == 0) return vec3(1.2, 0.6, 0.0);
  if (m == 12) return vec3(1.0, 0.5, 0.15);
  if (m == 8) return vec3(0.4, 0.3, 0.0);
  if (m == 10) return vec3(0.0, 0.1, 0.0);
  return vec3(0.0);
}
// How much of a light gets here, and in what colour, ray-traced: march from the surface toward the light across
// the height map and see how close the domes in between come to the ray. Behind an opaque dome nothing gets
// through; a see-through one tints and dims the light by how far the ray travels inside it. Soft across a band
// as wide as the light looks from here (spread, as a slope). d points at the light, in cells, with z up.
vec3 lightReach(vec2 uv, float z0, vec3 d, float spread) {
  if (d.z <= 0.0) return vec3(0.0);
  float run = length(d.xy);
  if (run < 1e-3) return vec3(1.0);
  float rise = d.z / run;
  // past tMax the ray is above every dome, so nothing further on can block it
  float tMax = min(run, (uBump - z0) / rise);
  if (tMax <= 0.0) return vec3(1.0);
  vec2 dir = d.xy / run / uTexSize;
  vec4 st = seeThrough(uMat);
  spread *= st.z;
  float slant = sqrt(1.0 + rise * rise);   // the ray's length for each cell it crosses the dish
  // the steps start a third of a cell apart, where a dome's steep wall decides the shadow's edge, and grow by a
  // fifth each time, so the twenty-first lands about 74 cells out
  float dt = 0.33, t = dt;
  float vis = 1.0;
  vec3 depth = vec3(0.0);   // how much of each colour the domes crossed have taken out (optical depth)
  float hit = 0.0, core = 0.0;   // whether the ray went through a dome, and how near its peak
  for (int k = 0; k < 21; k++) {
    if (t > tMax) break;
    vec2 at = uv + dir * t;
    vec4 hc = texture(uHeight, vec2(at.x, 1.0 - at.y));
    float clear = clamp(0.5 + 0.5 * (z0 + 0.3 + rise * t - hc.r * uBump) / ((t + 1.0) * spread), 0.0, 1.0);
    if (st.w > 0.5) {
      depth += (st.x * (1.0 - hc.gba) + st.y) * (1.0 - clear) * dt * slant;
      hit = max(hit, 1.0 - clear);
      core = max(core, (1.0 - clear) * hc.r);
      if (min(depth.r, min(depth.g, depth.b)) > 7.0) break;   // nothing more gets through
    } else {
      vis = min(vis, clear);
      if (vis <= 0.0) break;
    }
    dt *= 1.2;
    t += dt;
  }
  if (st.w > 0.5) {
    // the dome bends what it lets through toward the middle of its shadow: brighter where the ray crossed near its
    // peak, darker where it only clipped the rim (prism: blue a little further in than red)
    vec3 ln = lensOf(uMat);
    vec3 kc = core + vec3(-ln.z, 0.0, ln.z);
    vec3 lens = 1.0 + hit * (ln.x * smoothstep(0.7, 1.0, kc) - ln.y * (1.0 - smoothstep(0.25, 0.7, kc)));
    return exp(-depth) * lens;
  }
  return vec3(vis * vis * (3.0 - 2.0 * vis));
}
// How shiny each material is under a lamp: the strength of the lamp's own highlight on it.
float glossOf(int m) {
  if (m == 9) return 0.9;
  if (m == 13) return 0.65;
  if (m == 14) return 0.8;
  if (m == 15) return 1.0;
  if (m == 16) return 0.9;
  if (m == 0 || m == 8 || m == 12) return 1.0;
  if (m == 1) return 1.3;
  if (m == 10) return 0.9;
  if (m == 3) return 0.35;
  if (m == 5) return 0.0;
  if (m == 2 || m == 6 || m == 7) return 0.1;
  return 0.2;
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
// BEGIN CRYSTAL SHELL ADAPTATION
// Ray Marching Experiment 43, Stephane Cuillerdier (@Aiekick), 2016.
// https://www.shadertoy.com/view/lstXRl
// This adaptation: CC BY-NC-SA 3.0, https://creativecommons.org/licenses/by-nc-sa/3.0/
// Original lighting credits Inigo Quilez: https://www.shadertoy.com/view/Xds3zN
// Changes: map the two displaced layers onto the garden height field, retain the
// original textures and reflection/refraction weights, use garden lighting, and
// replace camera/sphere marching and step-count brightness with bounded shading.
vec4 crystalShellLayers(vec2 gp, vec3 normal) {
  vec2 uv = gp * 0.022 + normal.xy * 0.12;
  vec2 drift = vec2(uTime * 0.1);
  float outerNoise = texture(uShellPebbles, uv + drift).r;
  float innerNoise = texture(uShellPebbles, uv * 2.0 + normal.xy * 0.08 + drift).r;
  // Original radii: outer 4.78 - d1, inner wall 4.5 + d1, core 4.5 - d2.
  // The purple shell opens wherever its two walls meet (d1 >= 0.14).
  float d1 = outerNoise * 0.3, d2 = innerNoise * 0.3;
  float shell = 1.0 - smoothstep(0.13, 0.15, d1);
  float depth = mix(0.28 + d2, d1, shell);
  return vec4(shell, outerNoise, innerNoise, depth);
}
vec3 studioEnvironment(vec3 ray) {
  // Tilt the y-up studio over the z-up dish so its softbox catches curved edges.
  return texture(uShellEnvironment, vec3(ray.x, 0.8 * ray.z + 0.6 * ray.y, 0.6 * ray.z - 0.8 * ray.y)).rgb;
}
vec3 crystalShellColor(vec4 layers, vec3 normal, vec3 light, float sunSeen) {
  vec3 viewRay = vec3(0.0, 0.0, -1.0);
  vec3 reflection = reflect(viewRay, normal);
  vec3 refraction = refract(viewRay, normal, 0.7);
  vec3 optics = studioEnvironment(reflection) * 0.45
              + studioEnvironment(refraction) * 0.8;
  vec3 tint = mix(layers.z * vec3(0.2, 0.5, 0.2), layers.y * vec3(0.5, 0.2, 0.5), layers.x);
  float cavity = mix(0.45 + 0.45 * smoothstep(0.15, 0.23, layers.y * 0.3), 1.0, layers.x);
  float diffuse = max(dot(normal, light), 0.0);
  float ambient = clamp(0.5 + 0.5 * normal.z, 0.0, 1.0);
  float dome = smoothstep(-0.1, 0.1, reflection.z);
  float fresnel = pow(clamp(1.0 + dot(normal, viewRay), 0.0, 1.0), 2.0);
  float highlight = pow(max(dot(reflection, light), 0.0), 16.0)
                  * (uLight == 1 ? 0.0 : sunSeen);
  vec3 lighting = 1.2 * diffuse * vec3(1.0, 0.9, 0.6)
                + 1.2 * highlight * diffuse * vec3(1.0, 0.9, 0.6)
                + (0.3 * ambient + 0.4 * dome) * vec3(0.5, 0.7, 1.0) * cavity
                + vec3(0.4 * fresnel * cavity + 0.02);
  vec3 color = mix(optics * lighting, tint, 0.5) * cavity * 1.6;
  return pow(clamp(color, 0.0, 1.0), vec3(0.85));
}
// END CRYSTAL SHELL ADAPTATION
// BEGIN AMBER FLOW ADAPTATION
// Ray Marching Experiment 35, Stephane Cuillerdier (@Aiekick), 2015.
// https://www.shadertoy.com/view/4t2SWW (based on https://www.shadertoy.com/view/llSSWD)
// This adaptation: CC BY-NC-SA 3.0, https://creativecommons.org/licenses/by-nc-sa/3.0/
// Changes: apply the original animated texture/displacement to the garden height
// field, share its studio cubemap, and refract the view ray through a smooth coat.
// The garden supplies the geometry and lights instead of the sphere tracer/camera.
vec4 amberFlowSurface(vec2 gp) {
  float t = uTime * 1.5;
  vec2 uv = gp * 0.0025;
  uv.x -= t * 0.015;
  uv.y += sin(uv.x * 46.5 + t) * 0.12;
  // Preserve the source's breathing texture blur, with a pixel-footprint floor.
  float footprint = max(length(dFdx(uv)), length(dFdy(uv))) * float(textureSize(uAmberSurface, 0).x);
  float lod = max(4.0 * (sin(t) * 0.5 + 0.5), log2(max(footprint, 1.0)));
  vec3 color = textureLod(uAmberSurface, uv, lod).rgb;
  // Defined equivalent of the source's reversed-edge smoothstep.
  color = 1.0 - smoothstep(color, color + 0.5, vec3(0.71));
  float depth = 1.0 - smoothstep(0.0, 1.0, dot(color, vec3(0.3)));
  return vec4(color, depth);
}
vec3 amberFlowColor(vec4 surface, vec3 normal, vec3 light, float sunSeen) {
  vec3 viewRay = vec3(0.0, 0.0, -1.0);
  vec3 reflection = reflect(viewRay, normal);
  vec3 refraction = refract(viewRay, normal, 1.0 / 1.2);
  vec3 optics = studioEnvironment(reflection) * 0.6 + studioEnvironment(refraction) * 0.8;
  float diffuse = max(dot(normal, light), 0.0);
  float ambient = clamp(0.5 + 0.5 * normal.z, 0.0, 1.0);
  float dome = smoothstep(-0.1, 0.1, reflection.z);
  float fresnel = pow(clamp(1.0 + dot(normal, viewRay), 0.0, 1.0), 2.0);
  float highlight = pow(max(dot(reflection, light), 0.0), 16.0) * (uLight == 1 ? 0.0 : sunSeen);
  float cavity = 1.0 - surface.a * 0.25;
  vec3 lighting = 1.2 * diffuse * vec3(1.0, 0.9, 0.6)
                + 1.2 * highlight * diffuse * vec3(1.0, 0.9, 0.6)
                + (0.3 * ambient + 0.4 * dome) * vec3(0.5, 0.7, 1.0) * cavity
                + vec3(0.4 * fresnel * cavity + 0.02);
  return mix(optics * lighting, surface.rgb, 0.5);
}
// END AMBER FLOW ADAPTATION
// Adapted from the user-supplied Liquid Gold demo. Keep its three-stage flow;
// soften the fine octaves so small garden domes read as liquid rather than glitter.
float goldNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec4 corners = vec4(dot(i, vec2(127.1, 311.7)), dot(i + vec2(1, 0), vec2(127.1, 311.7)),
                      dot(i + vec2(0, 1), vec2(127.1, 311.7)), dot(i + vec2(1, 1), vec2(127.1, 311.7)));
  corners = fract(sin(corners) * 43758.5453);
  return mix(mix(corners.x, corners.y, f.x), mix(corners.z, corners.w, f.x), f.y);
}
float goldFbm(vec2 p, float t) {
  float value = 0.0, amplitude = 0.5, frequency = 1.0;
  for (int i = 0; i < 4; i++) {
    value += amplitude * goldNoise(p * frequency + t);
    frequency *= 2.18;
    amplitude *= 0.4;
    p += vec2(1.7, 9.2);
  }
  return value;
}
float goldWarpedField(vec2 p, float t) {
  vec2 q = vec2(goldFbm(p, t * 0.5), goldFbm(p + vec2(5.2, 1.3), t * 0.5));
  vec2 r = vec2(goldFbm(p + 3.0 * q + vec2(1.7, 9.2), t * 0.7),
                goldFbm(p + 3.0 * q + vec2(8.3, 2.8), t * 0.7));
  return goldFbm(p + 2.5 * r, t * 0.4) + length(q) * 0.4 + length(r) * 0.3;
}
// Ordered silica domains produce different reflection bands at different angles.
// Two warped, partly buried layers approximate their irregular play-of-color;
// the smooth cabochon normal is left intact. Pattern coordinates never depend on time.
// Appearance reference: https://www.gia.edu/opal-quality-factor
vec3 opalFire(vec2 gp, vec3 normal, vec3 light, float height) {
  vec3 fire = vec3(0.0);
  vec3 halfLight = normalize(light + vec3(0.0, 0.0, 1.0));
  for (int layer = 0; layer < 2; layer++) {
    float depth = float(layer);
    vec2 p = (gp + normal.xy * (0.65 + 1.3 * depth) * height) * (0.32 + depth * 0.32);
    p += vec2(vnoise(gp * 0.29 + depth * 13.0), vnoise(gp * 0.31 + 27.0)) * 1.7;
    p += vec2(vnoise(gp * 0.83 + 8.0), vnoise(gp * 0.79 + depth * 9.0)) * 0.45;
    p += depth * vec2(17.3, 9.1);
    vec2 cell = floor(p), seed = vec2(0.0);
    float first = 1e5, second = 1e5;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 at = cell + vec2(x, y);
      vec2 point = at + 0.12 + 0.76 * vec2(hash12(at), hash12(at + 37.2));
      float d = dot(p - point, p - point);
      if (d < first) { second = first; first = d; seed = at; }
      else second = min(second, d);
    }
    vec2 orientation = vec2(vnoise(seed * 0.38 + 7.0), vnoise(seed * 0.38 + 43.0)) - 0.5;
    orientation += (vec2(hash12(seed + 7.0), hash12(seed + 43.0)) - 0.5) * 0.35;
    vec3 domain = normalize(normal + vec3(orientation * 1.45, 0.3));
    float alignment = max(dot(domain, halfLight), 0.0);
    float wavelength = 410.0 + 310.0 * vnoise(seed * 0.38 + 91.0)
      + 90.0 * (hash12(seed + 91.0) - 0.5) - 130.0 * (1.0 - alignment)
      + 18.0 * (vnoise(p * 3.0) - 0.5);
    vec3 band = (vec3(615.0, 535.0, 460.0) - wavelength) / vec3(40.0, 32.0, 29.0);
    vec3 spectral = exp(-0.5 * band * band);
    float flash = pow(alignment, 12.0 + 20.0 * hash12(seed + 16.0));
    float border = smoothstep(0.0, 0.15, second - first);
    float islands = smoothstep(0.22, 0.52, vnoise(gp * 0.18 + depth * 29.0));
    float flecks = smoothstep(0.20, 0.72, vnoise(gp * 1.4 + depth * 8.0) * 0.6 + vnoise(p * 2.7) * 0.4);
    // Suppress the fine layer before its details become smaller than a screen pixel.
    float resolved = 1.0 - smoothstep(0.65, 1.3, max(length(dFdx(p)), length(dFdy(p))));
    fire += spectral * flash * (0.45 + 0.55 * border) * islands * (0.20 + 0.80 * flecks)
      * mix(1.15, 0.55, depth) * resolved;
  }
  return fire;
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
// The colour a see-through dome gives the light crossing it, as each material shows its colour.
vec3 filterOf(vec4 c, float b) {
  float m = max(c.r, max(c.g, c.b));
  vec3 pig = hueTurn(m > 1e-5 ? c.rgb / m : vec3(1.0), uHue);
  float q = clamp((b - E0) / (BPK - E0), 0.0, 1.0);
  vec3 tint = mix(hueTurn(texture(uLut, vec2(0.45 + 0.5 * q, 0.5)).rgb, uHue), pig, uLineage);
  vec3 tintP = mix(hueTurn(texture(uLut, vec2(0.55 + 0.25 * q, 0.5)).rgb, uHue), pig, uLineage);
  if (uMat == 8) return mix(vec3(0.78, 0.90, 1.0), tintP, 0.35);
  if (uMat == 3) return mix(tintP, vec3(1.0, 0.96, 0.88), 0.22);
  if (uMat == 10) return mix(vec3(1.0), tintP, 0.3);
  return tint;
}
// Graph paper under the dish, in grid cells: a line every five cells.
float gridAt(vec2 p) {
  vec2 f = abs(fract(p * 0.2) - 0.5) * 5.0;
  return 1.0 - smoothstep(0.1, 0.45, min(f.x, f.y));
}
// Interpolate lattice slices so the heat rolls through the height of each dome.
float lavaNoise(vec3 p) {
  float z = floor(p.z), f = fract(p.z);
  f = f * f * (3.0 - 2.0 * f);
  return mix(vnoise(p.xy + vec2(37.0, 17.0) * z),
             vnoise(p.xy + vec2(37.0, 17.0) * (z + 1.0)), f);
}
// BEGIN VORONESQUE GEM ADAPTATION
// Voronesque Gem, Stephane Cuillerdier (@Aiekick), 2016.
// https://www.shadertoy.com/view/XsdXDX
// Voronesque function by Shane; original tuned via XShade (funparadigm.com/xshade/).
// This adaptation: CC BY-NC-SA 3.0, https://creativecommons.org/licenses/by-nc-sa/3.0/
// Changes: wrap the displaced sphere coordinates onto each garden dome, vary the
// cells across the dish, filter normals by pixel footprint, and use garden lights.
// Retain the source's drifting cells, orbiting color frame, and two-layer shading.
float voronesque(vec3 p) {
  vec3 i = floor(p + dot(p, vec3(0.333333)));
  p -= i - dot(i, vec3(0.166666));
  vec3 i1 = step(0.0, p - p.yzx), i2 = max(i1, 1.0 - i1.zxy);
  i1 = min(i1, 1.0 - i1.zxy);
  vec3 p1 = p - i1 + 0.166666, p2 = p - i2 + 0.333333, p3 = p - 0.5;
  vec3 rnd = vec3(5.46, 62.8, 164.98);
  vec4 v = max(0.5 - vec4(dot(p, p), dot(p1, p1), dot(p2, p2), dot(p3, p3)), 0.0);
  vec4 d = vec4(dot(i, rnd), dot(i + i1, rnd), dot(i + i2, rnd), dot(i + 1.0, rnd));
  d = fract(sin(d) * 1000.0) * v * 2.0;
  return max(max(d.x, d.y), max(d.z, d.w));
}
float voronesqueDistance(vec3 p, vec3 offset) {
  return length(p) - 1.6 + sqrt(voronesque(p + offset) * 0.5);
}
vec3 voronesqueNormal(vec3 p, vec3 offset, float prec) {
  vec2 e = vec2(-1.0, 1.0) * prec;
  return normalize(e.yxx * voronesqueDistance(p + e.yxx, offset)
                 + e.xxy * voronesqueDistance(p + e.xxy, offset)
                 + e.xyx * voronesqueDistance(p + e.xyx, offset)
                 + e.yyy * voronesqueDistance(p + e.yyy, offset));
}
vec3 voronesqueShade(vec3 p, vec3 normal, vec3 viewRay, float distance, vec3 weights) {
  vec3 radial = normalize(p);
  vec3 tint = normalize(mix(vec3(max(0.0, 2.3 - distance)), radial, 0.8));
  vec3 reflection = texture(uShellEnvironment, reflect(viewRay, normal)).rgb;
  float shine = pow(clamp(0.35 + dot(normal, radial) * 0.6, 0.0, 1.0), 30.0);
  return (tint * reflection * weights.x + shine * weights.y) * weights.z;
}
// END VORONESQUE GEM ADAPTATION

void main() {
  // the heights the rays read, from the smooth (bicubic) field: read from the grid itself, every shadow's edge
  // would be ragged a cell at a time
  // and, for see-through materials, the colour each dome gives the light crossing it
  if (uPass == 1) { vec4 c1 = fieldAt(vUv); float b1 = bsum(c1); outColor = vec4(blockerOf(b1), filterOf(c1, b1)); return; }
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
  mat3 gemFrame = mat3(1.0);
  vec3 gemPosition = vec3(0.0, 0.0, 1.0), gemOffset = vec3(0.0), gemNormal = N;
  float gemPrecision = 0.01;
  if (uMat == 9) {
    float angle = uTime * 0.1;
    vec3 camera = normalize(vec3(cos(angle) * 2.0, 1.0, sin(angle) * 2.0));
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), -camera));
    gemFrame = mat3(right, cross(-camera, right), camera);
    gemPosition = gemFrame * N * 1.45;
    gemOffset = vec3(vUv * uTexSize * 0.035, uTime * 0.2);
    gemPrecision = clamp(max(length(dFdx(gemPosition)), length(dFdy(gemPosition))) * 0.5, 0.01, 0.12);
    gemNormal = voronesqueNormal(gemPosition, gemOffset, gemPrecision);
    N = normalize(transpose(gemFrame) * gemNormal);
  }
  vec4 shellLayers = vec4(0.0);
  if (uMat == 14) {
    vec2 gp = vUv * uTexSize;
    shellLayers = crystalShellLayers(gp, N);
    // Recesses and shell walls perturb the normal used by every garden light.
    // Central samples avoid the 2x2 steps that screen derivatives give steep rims.
    vec2 slope = vec2(
      crystalShellLayers(gp + vec2(0.2, 0.0), N).w - crystalShellLayers(gp - vec2(0.2, 0.0), N).w,
      crystalShellLayers(gp + vec2(0.0, 0.2), N).w - crystalShellLayers(gp - vec2(0.0, 0.2), N).w) / 0.4;
    N = normalize(vec3(N.xy + slope * (uBump / 4.78) * N.z, N.z));
  }
  float goldField = 0.0;
  if (uMat == 15) {
    vec2 surface = vUv * uTexSize * 0.045;
    goldField = goldWarpedField(surface, uTime * 0.4);
    // Screen derivatives give the ripple slope without evaluating the expensive
    // field three times. Preserve the dome silhouette and use this normal for all lights.
    vec2 stepSize = vec2(dFdx(surface.x), dFdy(surface.y));
    vec2 slope = vec2(dFdx(goldField), dFdy(goldField))
      / (sign(stepSize) * max(abs(stepSize), vec2(0.00001)));
    N = normalize(vec3(N.xy - slope * 0.16 * N.z, N.z));
  }
  vec4 amberSurface = vec4(0.0);
  if (uMat == 16) {
    vec2 gp = vUv * uTexSize;
    amberSurface = amberFlowSurface(gp);
    vec2 slope = vec2(
      amberFlowSurface(gp + vec2(0.2, 0.0)).a - amberFlowSurface(gp - vec2(0.2, 0.0)).a,
      amberFlowSurface(gp + vec2(0.0, 0.2)).a - amberFlowSurface(gp - vec2(0.0, 0.2)).a) / 0.4;
    N = normalize(vec3(N.xy + slope * (uBump / 4.5) * N.z, N.z));
  }

  // the lights live in the room; tilting the phone moves them across the dish
  vec3 L = normalize(vec3(-0.45 + uTilt.x, -0.55 + uTilt.y, 0.7));
  vec3 Vv = vec3(0.0, 0.0, 1.0);
  // Lamps and the sun light the dish themselves. E is the light arriving here as a multiple of the room's own,
  // after a ray toward each light has looked for domes in the way; glint is the lamps' own highlights.
  vec3 E = vec3(1.0), glint = vec3(0.0);
  float sunSeen = 1.0;
  float z0 = h * uBump;
  if (uLight == 1) {
    E = vec3(mix(0.16, 0.34, uLightTheme));
    vec3 toward = vec3(0.0, 0.0, 0.02);
    for (int i = 0; i < 3; i++) {
      if (uLamp[i].w < 0.5) continue;
      vec3 d = vec3((uLamp[i].xy - vUv) * uTexSize, uLamp[i].z - z0);
      float r2 = dot(d, d);
      vec3 Li = d * inversesqrt(r2);
      // inverse square, 1 at the lamp's foot; the lamp is about a sixth of its height across
      vec3 Ii = uLampCol[i] * (uLamp[i].z * uLamp[i].z / r2) * lightReach(vUv, z0, d, 0.08 * uLamp[i].z * inversesqrt(r2) + 0.01);
      E += Ii * max(dot(N, Li), 0.0) * mix(4.5, 2.1, uLightTheme);
      toward += Li * dot(Ii, vec3(0.3, 0.5, 0.2));
      glint += Ii * pow(max(dot(N, normalize(Li + Vv)), 0.0), 300.0);
    }
    L = normalize(toward);
  } else if (uLight == 2) {
    vec3 sunReach = lightReach(vUv, z0, uSun * 4000.0, 0.05);
    sunSeen = dot(sunReach, vec3(0.3, 0.5, 0.2));
    E = mix(vec3(0.34, 0.40, 0.52), vec3(0.45, 0.48, 0.56), uLightTheme) + uSunCol * sunReach * max(dot(N, uSun), 0.0) * mix(1.7, 1.25, uLightTheme);
    L = uSun;
  }
  vec3 H = normalize(L + Vv);
  vec3 L2 = normalize(vec3(0.6 + 0.5 * uTilt.x, -0.3 + 0.5 * uTilt.y, 0.55));
  vec3 H2 = normalize(L2 + Vv);
  vec3 Lc = normalize(vec3(0.5 + uTilt.x, 0.62 + uTilt.y, 0.6));
  float ndl = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 160.0);
  float spec2 = pow(max(dot(N, H2), 0.0), 14.0);
  float fres = 1.0 - clamp(N.z, 0.0, 1.0);
  float caus = pow(max(dot(N, Lc), 0.0), 22.0);
  // under lamps each lamp makes its own highlight; in sunshine the sun's goes out where a dome hides the sun
  spec *= uLight == 1 ? 0.0 : sunSeen;
  spec2 *= uLight == 0 ? 1.0 : 0.5;

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
  float shadow = smoothstep(E0 - 0.05, E0 + 0.01, bS) * (1.0 - mask) * (uLight == 0 ? 1.0 : 0.0);   // lamps and sun cast real ones
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
    // ---- lava: rolling hot ridges and dark pockets on the existing domes ----
    // Visual reference: Duke's Pyroclastic fireball, https://www.shadertoy.com/view/MtXSzS
    // Our height field supplies the surface; no separate sphere or ray march is needed.
    vec2 gp = vUv * uTexSize;
    float t = uTime;
    vec3 p = vec3(gp * 0.19, h * 2.4) + vec3(0.04, -0.24, 0.12) * t;
    vec2 warp = vec2(lavaNoise(p * 0.65), lavaNoise(p * 0.65 + 13.7)) - 0.5;
    p.xy += warp * 1.8 + N.xy * 0.35;
    float turbulence = abs(2.0 * lavaNoise(p) - 1.0) * 0.65;
    turbulence += abs(2.0 * lavaNoise(p * 2.03 + 7.1) - 1.0) * 0.25;
    turbulence += abs(2.0 * lavaNoise(p * 4.09 + 21.2) - 1.0) * 0.10;
    float heat = clamp(1.04 - turbulence * 1.55, 0.0, 1.0);
    col = mix(vec3(0.075, 0.008, 0.006), vec3(0.52, 0.025, 0.002), smoothstep(0.12, 0.50, heat));
    col = mix(col, vec3(1.15, 0.16, 0.008), smoothstep(0.46, 0.72, heat));
    col = mix(col, vec3(1.35, 0.84, 0.14), smoothstep(0.70, 0.91, heat));
    col = mix(col, vec3(1.45, 1.30, 0.95), smoothstep(0.89, 1.0, heat));
    col *= 0.72 + 0.28 * h;
    col = col / (vec3(1.0) + col * 0.25);
    bg = uBg + vec3(0.34, 0.055, 0.004) * halo * 0.45;
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
  } else if (uMat == 13) {
    // ---- polished black opal: smooth skin above internal spectral patches ----
    vec2 gp = vUv * uTexSize;
    float cloud = vnoise(gp * 0.18) * 0.65 + vnoise(gp * 0.43 + 11.0) * 0.35;
    float wrap = clamp((dot(N, L) + 0.45) / 1.45, 0.0, 1.0);
    vec3 body = vec3(0.022, 0.028, 0.035);
    body *= (0.30 + 0.70 * wrap) * (0.82 + 0.18 * cloud);
    vec3 fire = opalFire(gp, N, L, h) * (0.45 + 0.55 * ndl);
    col = body + fire * 1.1;
    vec3 reflection = reflect(-Vv, N);
    float softbox = pow(max(dot(reflection, normalize(L + vec3(0.05, -0.10, 0.25))), 0.0), 48.0);
    float coat = (softbox * 0.65 + spec * 0.45) * (1.0 + uBeat * 0.08);
    col += vec3(1.0, 0.98, 0.94) * coat + vec3(0.045, 0.055, 0.065) * pow(fres, 3.0);
    col = pow(clamp(col, 0.0, 1.0), vec3(0.65));
    bg = uBg * (1.0 - shadow * 0.55);
  } else if (uMat == 14) {
    // Crystal Shell uses the CC BY-NC-SA adaptation credited above.
    col = crystalShellColor(shellLayers, N, L, sunSeen);
    bg = uBg * (1.0 - shadow * 0.55);
  } else if (uMat == 15) {
    // ---- Gold Ripple: moving molten reflections from the Liquid Gold demo ----
    vec3 goldBase = vec3(0.83, 0.61, 0.22), goldBright = vec3(1.0, 0.84, 0.45);
    vec3 goldDeep = vec3(0.55, 0.35, 0.08), goldShadow = vec3(0.18, 0.10, 0.02);
    vec3 whiteHot = vec3(1.0, 0.97, 0.88);
    float fieldNorm = smoothstep(0.3, 1.8, goldField);
    vec3 baseColor = mix(goldShadow, goldDeep, smoothstep(0.0, 0.3, fieldNorm));
    baseColor = mix(baseColor, goldBase, smoothstep(0.3, 0.6, fieldNorm));
    baseColor = mix(baseColor, goldBright, smoothstep(0.6, 0.9, fieldNorm));
    vec3 L3 = normalize(vec3(0.0, 0.8, 0.5));
    float s1 = pow(max(dot(N, H), 0.0), 120.0) * (uLight == 1 ? 0.0 : sunSeen);
    float s2 = pow(max(dot(N, H2), 0.0), 80.0) * (uLight == 0 ? 1.0 : 0.0);
    float s3 = pow(max(dot(N, normalize(L3 + Vv)), 0.0), 200.0) * (uLight == 0 ? 1.0 : 0.0);
    vec3 diffuse = baseColor * (ndl * 0.5 + max(dot(N, L2), 0.0) * 0.3 + max(dot(N, L3), 0.0) * 0.2);
    vec3 highlights = mix(goldBright, whiteHot, s1) * s1 * 1.2
                    + mix(goldBright, whiteHot, s2 * 0.5) * s2 * 0.6
                    + mix(goldBright, whiteHot, s3) * s3 * 1.5;
    float metalFresnel = 0.8 + 0.2 * pow(fres, 5.0);
    float reflectionY = N.y * 0.5 + 0.5;
    vec3 environment = mix(vec3(0.12, 0.07, 0.02), vec3(0.45, 0.30, 0.12), reflectionY);
    environment = mix(environment, vec3(0.7, 0.55, 0.25), smoothstep(0.6, 1.0, reflectionY));
    col = diffuse * 0.4 + highlights * metalFresnel * (1.0 + uBeat * 0.12)
        + environment * metalFresnel * 0.5 + baseColor * 0.12;
    float ripple = goldNoise(vUv * uTexSize * 0.3 + uTime * 0.8);
    col += whiteHot * smoothstep(0.6, 0.9, ripple * ripple) * 0.08 * metalFresnel;
    col += goldBright * pow(fres, 5.0) * 0.12;
    col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
    col = pow(max(col, vec3(0.0)), vec3(0.95, 1.0, 1.08));
    bg = uBg * (1.0 - shadow * 0.55);
  } else if (uMat == 16) {
    col = amberFlowColor(amberSurface, N, L, sunSeen);
    bg = uBg * (1.0 - shadow * 0.55);
  } else {
    // Voronesque Gem (material 9): the original reflective outer and inner layers.
    vec3 viewRay = -gemFrame[2];
    float distance = 2.3 - dot(gemPosition, gemFrame[2]);
    vec3 outer = voronesqueShade(gemPosition, gemNormal, viewRay, distance, vec3(0.9, 0.0, 1.0));
    vec3 innerPosition = gemPosition + viewRay;
    vec3 innerNormal = voronesqueNormal(innerPosition, gemOffset, gemPrecision);
    vec3 inner = voronesqueShade(innerPosition, innerNormal, viewRay, 1.0, vec3(1.0, 1.0, 3.0));
    inner = clamp(inner, 0.0, 1.0 / 0.55);
    col = texture(uShellEnvironment, viewRay).rgb + mix(outer, inner, 0.45);
    col += vec3(1.0, 0.98, 0.95) * spec * 0.25 * (1.0 + uBeat * 0.08);
    bg = uBg * (1.0 - shadow * 0.55);
  }
  // the beat: the blobs flare (or, on paper, deepen) and throw a little light around them
  if (uMat != 9 && uMat != 13 && uMat != 14 && uMat != 15 && uMat != 16) {
    col *= 1.0 + uBeat * mix(0.4, -0.15, lt);
    bg += tint * halo * uBeat * 0.35 * (1.0 - lt);
    bg = mix(bg, bg * tint, halo * uBeat * 0.3 * lt);
  }
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
  vec3 outc = mix(bg, col, mask);
  if (uLight > 0) {
    // what glows keeps most of its own light; everything else is lit by what arrives, and a dark floor is lifted a
    // little so that light and shadow show on it
    float emis = (uMat == 4 || uMat == 7 || uMat == 11) ? 0.6 : 0.0;
    outc += vec3(0.065, 0.07, 0.075) * (1.0 - mask) * (1.0 - uLightTheme) * (1.0 - emis / 0.6);
    outc = outc * mix(E, vec3(1.0), emis) + glint * mask * glossOf(uMat) * mix(1.6, 1.0, uLightTheme);
    // up to the room's own brightness nothing changes; brighter light rolls off toward white
    float Y = dot(outc, vec3(0.2126, 0.7152, 0.0722));
    float Yc = Y < 0.75 ? Y : 0.75 + 0.25 * (1.0 - exp(-(Y - 0.75) * 4.0));
    outc = outc * (Yc / max(Y, 1e-4));
    outc = mix(outc, vec3(1.0), smoothstep(0.9, 1.0, Yc) * smoothstep(1.0, 3.0, Y) * 0.6);
  }
  if (uLight == 1) {
    // each lamp, seen from above: a bulb in its own colour, a glow, and a ring to take hold of
    vec3 ringCol = mix(vec3(1.0), vec3(0.12), uLightTheme);
    for (int i = 0; i < 3; i++) {
      if (uLamp[i].w < 0.5) continue;
      float dl = length((uLamp[i].xy - vUv) * uTexSize) / uLampR;
      outc += uLampCol[i] * exp(-dl * dl * 0.35) * 0.3;
      outc = mix(outc, mix(uLampCol[i], vec3(1.0), 0.7), 1.0 - smoothstep(0.4, 0.58, dl));
      outc = mix(outc, ringCol, (smoothstep(0.84, 0.94, dl) - smoothstep(1.0, 1.1, dl)) * 0.85);
    }
  }
  outColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}
