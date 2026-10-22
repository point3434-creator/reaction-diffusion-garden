#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uSurface;
uniform sampler2D uPrevious;
uniform sampler2D uField;
uniform vec2 uTexSize;
uniform vec2 uResolution;
uniform float uBump;
uniform float uGlow;
uniform float uLightTheme;
uniform vec3 uBg;
uniform int uMat;
uniform int uChem; // 0 garden/current, 1 heart, 2 quantum, 3 mould
uniform int uLight;
uniform int uBounces;
uniform int uSamples;
uniform uint uSeed;
uniform vec2 uTilt;
uniform vec4 uLamp[3];
uniform vec3 uLampCol[3];
uniform vec3 uSun;
uniform vec3 uSunCol;
in vec2 vUv;
out vec4 outColor;

const float PI = 3.141592653589793;
const float FAR = 1e20;
const float EPS = 0.0004; // world units are simulation cells
const float FLOOR_Z = -0.35;
const int MAX_CELLS = 1024;

// kind: -1 none, 0 closed heightfield, 1 floor, 2 sampled lamp.
// tint is linear reflectance for surfaces, radiance for a lamp.
struct RayHit { float t; vec3 normal; vec3 tint; int kind; };

uint randomState;
float randomFloat() {
  randomState ^= randomState << 13;
  randomState ^= randomState >> 17;
  randomState ^= randomState << 5;
  return float(randomState >> 8) * (1.0 / 16777216.0);
}
vec3 toLinear(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 cosineDirection(vec3 n) {
  float r = sqrt(randomFloat()), a = 2.0 * PI * randomFloat();
  vec3 tangent = normalize(cross(abs(n.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0), n));
  return normalize(tangent * (r * cos(a)) + cross(n, tangent) * (r * sin(a)) + n * sqrt(max(0.0, 1.0 - r * r)));
}
vec3 offsetRay(vec3 p, vec3 geometricNormal, vec3 direction) {
  return p + geometricNormal * (dot(geometricNormal, direction) >= 0.0 ? EPS : -EPS);
}

// The prepass has top-down vUv, while a framebuffer's texel Y points up.
// Texels are mesh vertices: first/last vertices lie exactly on the dish bounds.
vec4 vertexData(ivec2 p) {
  ivec2 size = textureSize(uSurface, 0);
  vec4 value = texelFetch(uSurface, ivec2(p.x, size.y - 1 - p.y), 0);
  return vec4(clamp(value.r, 0.0, 1.0) * uBump, value.gba);
}
void cellData(ivec2 cell, out vec4 a, out vec4 b, out vec4 c, out vec4 d) {
  a = vertexData(cell);
  b = vertexData(cell + ivec2(1, 0));
  c = vertexData(cell + ivec2(1, 1));
  d = vertexData(cell + ivec2(0, 1));
}
void meshAt(vec2 p, out float height, out vec3 normal, out vec3 tint) {
  ivec2 cells = textureSize(uSurface, 0) - 1;
  vec2 spacing = uTexSize / vec2(cells);
  vec2 grid = clamp(p / spacing, vec2(0.0), vec2(cells));
  ivec2 cell = clamp(ivec2(floor(grid)), ivec2(0), cells - 1);
  vec2 f = grid - vec2(cell);
  vec4 a, b, c, d; cellData(cell, a, b, c, d);
  a.gba = toLinear(a.gba); b.gba = toLinear(b.gba);
  c.gba = toLinear(c.gba); d.gba = toLinear(d.gba);
  vec4 value;
  if (f.x >= f.y) {
    value = a * (1.0 - f.x) + b * (f.x - f.y) + c * f.y;
    normal = normalize(vec3(-(b.r - a.r) / spacing.x, -(c.r - b.r) / spacing.y, 1.0));
  } else {
    value = a * (1.0 - f.y) + c * f.x + d * (f.y - f.x);
    normal = normalize(vec3(-(c.r - d.r) / spacing.x, -(d.r - a.r) / spacing.y, 1.0));
  }
  height = value.r; tint = value.gba;
}
bool clipAxis(float origin, float direction, float low, float high, inout float nearT, inout float farT) {
  if (abs(direction) < 1e-10) return origin >= low && origin <= high;
  float a = (low - origin) / direction, b = (high - origin) / direction;
  nearT = max(nearT, min(a, b)); farT = min(farT, max(a, b));
  return farT >= nearT;
}
bool intersectTriangle(vec3 origin, vec3 direction, vec3 a, vec3 b, vec3 c,
                       float lowT, float highT, out float t, out vec3 weights) {
  vec3 e1 = b - a, e2 = c - a, p = cross(direction, e2);
  float det = dot(e1, p);
  if (abs(det) < 1e-10) return false;
  vec3 s = origin - a, q = cross(s, e1);
  float u = dot(s, p) / det, v = dot(direction, q) / det;
  t = dot(e2, q) / det;
  weights = vec3(1.0 - u - v, u, v);
  return min(weights.x, min(weights.y, weights.z)) >= -1e-5 && t > EPS * 0.25 && t >= lowT - EPS * 0.25 && t <= highT + EPS * 0.25;
}
void boundaryHit(vec3 origin, vec3 direction, float t, vec3 n, inout RayHit hit) {
  if (t <= EPS * 0.25 || t >= hit.t) return;
  vec3 p = origin + direction * t;
  if (any(lessThan(p.xy, vec2(-EPS))) || any(greaterThan(p.xy, uTexSize + EPS))) return;
  float height; vec3 normal, tint; meshAt(p.xy, height, normal, tint);
  if (height <= 0.0 || p.z < -EPS * 0.25 || p.z > height + EPS * 0.25) return;
  hit = RayHit(t, n, tint, 0);
}

// Exact intersections with a finite triangle mesh, its base, and its side walls.
// A traversal that exhausts the budget is NOT a miss: callers absorb that path.
bool traceSolid(vec3 origin, vec3 direction, float tMax, out RayHit hit, out bool exhausted) {
  hit = RayHit(tMax, vec3(0.0), vec3(0.0), -1); exhausted = false;
  float nearT = 0.0, farT = tMax;
  if (!clipAxis(origin.x, direction.x, 0.0, uTexSize.x, nearT, farT) ||
      !clipAxis(origin.y, direction.y, 0.0, uTexSize.y, nearT, farT) ||
      !clipAxis(origin.z, direction.z, 0.0, uBump, nearT, farT) || farT <= EPS * 0.25) return false;
  if (abs(direction.z) > 1e-10) boundaryHit(origin, direction, -origin.z / direction.z, vec3(0.0, 0.0, -1.0), hit);
  if (abs(direction.x) > 1e-10) {
    boundaryHit(origin, direction, -origin.x / direction.x, vec3(-1.0, 0.0, 0.0), hit);
    boundaryHit(origin, direction, (uTexSize.x - origin.x) / direction.x, vec3(1.0, 0.0, 0.0), hit);
  }
  if (abs(direction.y) > 1e-10) {
    boundaryHit(origin, direction, -origin.y / direction.y, vec3(0.0, -1.0, 0.0), hit);
    boundaryHit(origin, direction, (uTexSize.y - origin.y) / direction.y, vec3(0.0, 1.0, 0.0), hit);
  }
  ivec2 cells = textureSize(uSurface, 0) - 1;
  vec2 spacing = uTexSize / vec2(cells);
  // Nudge only the cell selection, never the tested ray or intersection interval.
  vec2 p = (origin.xy + direction.xy * (nearT + EPS * 0.25)) / spacing;
  ivec2 cell = clamp(ivec2(floor(p)), ivec2(0), cells - 1);
  ivec2 stepCell = ivec2(sign(direction.xy));
  vec2 nextT = vec2(FAR), deltaT = vec2(FAR);
  if (stepCell.x != 0) {
    nextT.x = ((float(cell.x) + (stepCell.x > 0 ? 1.0 : 0.0)) * spacing.x - origin.x) / direction.x;
    deltaT.x = spacing.x / abs(direction.x);
  }
  if (stepCell.y != 0) {
    nextT.y = ((float(cell.y) + (stepCell.y > 0 ? 1.0 : 0.0)) * spacing.y - origin.y) / direction.y;
    deltaT.y = spacing.y / abs(direction.y);
  }
  float startT = nearT;
  for (int i = 0; i < MAX_CELLS; i++) {
    float endT = min(min(nextT.x, nextT.y), min(farT, hit.t));
    vec4 a, b, c, d; cellData(cell, a, b, c, d);
    vec2 lo = vec2(cell) * spacing, hi = lo + spacing;
    vec3 pa = vec3(lo, a.r), pb = vec3(hi.x, lo.y, b.r);
    vec3 pc = vec3(hi, c.r), pd = vec3(lo.x, hi.y, d.r);
    float t; vec3 w;
    if (max(a.r, max(b.r, c.r)) > 0.0 && intersectTriangle(origin, direction, pa, pb, pc, startT, endT, t, w) && t < hit.t) {
      hit = RayHit(t, normalize(cross(pb - pa, pc - pa)), toLinear(a.gba) * w.x + toLinear(b.gba) * w.y + toLinear(c.gba) * w.z, 0);
    }
    if (max(a.r, max(c.r, d.r)) > 0.0 && intersectTriangle(origin, direction, pa, pc, pd, startT, min(endT, hit.t), t, w) && t < hit.t) {
      hit = RayHit(t, normalize(cross(pc - pa, pd - pa)), toLinear(a.gba) * w.x + toLinear(c.gba) * w.y + toLinear(d.gba) * w.z, 0);
    }
    if (hit.kind >= 0 && hit.t <= endT + EPS * 0.25) return true;
    if (endT >= farT) return hit.kind >= 0;
    bool stepX = nextT.x <= nextT.y;
    bool stepY = nextT.y <= nextT.x;
    startT = min(nextT.x, nextT.y);
    if (stepX) { cell.x += stepCell.x; nextT.x += deltaT.x; }
    if (stepY) { cell.y += stepCell.y; nextT.y += deltaT.y; }
    if (any(lessThan(cell, ivec2(0))) || any(greaterThanEqual(cell, cells))) return hit.kind >= 0;
  }
  exhausted = true;
  hit.kind = -1;
  return false;
}

vec3 floorTint(vec2 p) {
  vec3 c = toLinear(uBg);
  if (uMat == 12) {
    vec2 line = abs(fract(p * 0.2 + 0.5) - 0.5) * 5.0;
    float grid = 1.0 - smoothstep(0.045, 0.11, min(line.x, line.y));
    c = mix(c, mix(vec3(0.11), c * 0.45, uLightTheme), grid * 0.7);
  }
  c = clamp(c, vec3(0.008), vec3(0.9));
  if (uChem > 0 && all(greaterThanEqual(p, vec2(0.0))) && all(lessThanEqual(p, uTexSize))) {
    vec2 uv = p / uTexSize;
    // CPU field rows already use the dish's top-down coordinates. Only the
    // framebuffer-produced surface texture needs a Y flip.
    float metadata = texture(uField, uv).a;
    vec3 tint = texture(uSurface, vec2(uv.x, 1.0 - uv.y)).gba;
    float scar = step(metadata, -0.5), light = uLightTheme;
    vec3 bg = uBg;
    if (uChem == 1) {
      float recovery = clamp(metadata, 0.0, 1.0) * (1.0 - scar);
      bg = mix(bg, mix(bg, tint, 0.3) + 0.045, recovery * (1.0 - light));
      bg = mix(bg, bg * mix(vec3(1.0), tint, 0.3) * 0.92, recovery * light);
      // Fixed world-space grain stays stationary across samples and reflections.
      vec3 grain = fract(vec3(floor(p * 3.0).xyx) * 0.1031);
      grain += dot(grain, grain.yzx + 33.33);
      float rough = 0.7 + 0.3 * fract((grain.x + grain.y) * grain.z);
      bg = mix(bg, mix(uBg * 2.2 + 0.05, uBg * 0.72, light) * rough, scar);
    } else {
      float amount = clamp(-metadata, 0.0, 0.45) / 0.45 * (1.0 - scar);
      vec3 pool = uChem == 2 ? mix(bg * 0.45 + vec3(0.02, 0.03, 0.05), bg * 0.8, light) :
        mix(bg * 0.5 + tint * 0.22, bg * mix(vec3(1.0), tint, 0.5) * 0.86, light);
      bg = mix(bg, pool, amount);
      bg = mix(bg, mix(uBg * 2.6 + 0.12, uBg * 0.62, light), scar);
    }
    // Preserve the existing annotation contrast above the floor's visibility
    // minimum; clamping the annotated color to that minimum would erase dark
    // potentials and food. Annotations change reflectance, never scene geometry.
    c = clamp(c + toLinear(bg) - toLinear(uBg), vec3(0.0), vec3(0.9));
  }
  return c;
}
float lampRadius(int i) { return max(0.8, uLamp[i].z * 0.12); }
vec3 lampEmission(int i) { return max(uLampCol[i], vec3(0.0)) * 32.0; }
void traceLamps(vec3 origin, vec3 direction, inout RayHit hit) {
  if (uLight != 1 || abs(direction.z) < 1e-10) return;
  for (int i = 0; i < 3; i++) {
    if (uLamp[i].w < 0.5) continue;
    float t = (uLamp[i].z - origin.z) / direction.z;
    vec2 d = origin.xy + direction.xy * t - uLamp[i].xy * uTexSize;
    if (t > EPS * 0.25 && t < hit.t && dot(d, d) <= lampRadius(i) * lampRadius(i))
      hit = RayHit(t, vec3(0.0, 0.0, -1.0), lampEmission(i), 2);
  }
}
bool traceScene(vec3 origin, vec3 direction, float tMax, out RayHit hit, out bool exhausted) {
  // Limit mesh traversal to the first floor/light candidate, if any.
  RayHit other = RayHit(tMax, vec3(0.0), vec3(0.0), -1);
  if (abs(direction.z) > 1e-10) {
    float t = (FLOOR_Z - origin.z) / direction.z;
    if (t > EPS * 0.25 && t < other.t) other = RayHit(t, vec3(0.0, 0.0, 1.0), floorTint(origin.xy + direction.xy * t), 1);
  }
  traceLamps(origin, direction, other);
  bool found = traceSolid(origin, direction, other.t, hit, exhausted);
  if (exhausted) return false;
  if (!found) hit = other;
  return hit.kind >= 0;
}
RayHit primaryHit(vec3 origin) {
  float h; vec3 n, tint; meshAt(origin.xy, h, n, tint);
  RayHit hit;
  if (h > 0.0) hit = RayHit(origin.z - h, n, tint, 0);
  else hit = RayHit(origin.z - FLOOR_Z, vec3(0.0, 0.0, 1.0), floorTint(origin.xy), 1);
  traceLamps(origin, vec3(0.0, 0.0, -1.0), hit);
  return hit;
}

// Exact unpolarized dielectric Fresnel reflectance, including total internal reflection.
float fresnelDielectric(float cosIncident, float etaI, float etaT) {
  float ci = clamp(abs(cosIncident), 0.0, 1.0), eta = etaI / etaT;
  float sinT2 = eta * eta * max(0.0, 1.0 - ci * ci);
  if (sinT2 >= 1.0) return 1.0;
  float ct = sqrt(max(0.0, 1.0 - sinT2));
  float rs = (etaI * ci - etaT * ct) / max(etaI * ci + etaT * ct, 1e-10);
  float rp = (etaT * ci - etaI * ct) / max(etaT * ci + etaI * ct, 1e-10);
  return clamp(0.5 * (rs * rs + rp * rp), 0.0, 1.0);
}
bool dielectricMaterial() { return uMat == 0 || uMat == 8 || uMat == 10 || uMat == 12; }
float materialIor() { return uMat == 8 ? 1.31 : uMat == 10 ? 1.34 : uMat == 12 ? 1.53 : 1.5; }
vec3 absorption(vec3 tint) {
  float saturation = uMat == 10 ? 0.2 : uMat == 8 ? 0.35 : 0.7;
  return -log(clamp(mix(vec3(0.98), tint, saturation), vec3(0.025), vec3(0.999))) / 6.0;
}
vec3 diffuseColor(RayHit hit) {
  if (hit.kind == 1) return hit.tint;
  vec3 c = hit.tint;
  if (uMat == 2) c *= 0.65;
  if (uMat == 3) c = mix(c, vec3(0.9, 0.78, 0.6), 0.18);
  if (uMat == 5 || uMat == 6) c = mix(toLinear(uBg), c, 0.65);
  return clamp(c, vec3(0.01), vec3(0.9));
}
vec3 surfaceEmission(RayHit hit, vec3 p) {
  if (hit.kind != 0 || !(uMat == 4 || uMat == 7 || uMat == 9 || uMat == 11)) return vec3(0.0);
  float h = clamp(p.z / max(uBump, 0.001), 0.0, 1.0);
  float q = 1.0 - sqrt(max(0.0, 1.0 - h * h));
  float band = uMat == 4 ? exp(-pow((q - 0.14) / 0.11, 2.0)) :
    uMat == 11 ? pow(0.5 + 0.5 * cos(q * PI * 12.0), 12.0) : h;
  return mix(hit.tint, vec3(1.0), band * 0.35) * (0.25 + 2.5 * band) * (0.7 + max(0.0, uGlow));
}
const float SUN_COS = 0.9996875163; // angular radius 0.025 radians
vec3 sunEmission() { return max(uSunCol, vec3(0.0)) * (2.2 / (PI * (1.0 - SUN_COS * SUN_COS))); }
vec3 environment(vec3 d, bool includeSun) {
  float sky = clamp(d.z * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(vec3(0.025, 0.03, 0.045), vec3(0.28, 0.35, 0.46), sky);
  if (uLight == 0) {
    vec3 key = normalize(vec3(-0.45 + uTilt.x, -0.55 + uTilt.y, 0.8));
    vec3 fill = normalize(vec3(0.7 + uTilt.x * 0.3, 0.35 + uTilt.y * 0.3, 0.7));
    c += vec3(5.0, 4.65, 4.1) * pow(max(0.0, dot(d, key)), 28.0);
    c += vec3(1.5, 1.8, 2.3) * pow(max(0.0, dot(d, fill)), 18.0);
  } else {
    c *= 0.4;
    if (uLight == 2 && includeSun && dot(d, normalize(uSun)) >= SUN_COS) c += sunEmission();
  }
  return c;
}
bool unoccluded(vec3 p, vec3 normal, vec3 direction, float distance) {
  RayHit obstruction; bool exhausted;
  bool blocked = traceScene(offsetRay(p, normal, direction), direction, max(EPS, distance - EPS * 3.0), obstruction, exhausted);
  return !blocked && !exhausted;
}
vec3 directLight(vec3 p, vec3 n, vec3 albedo) {
  if (uLight == 1) {
    int count = 0;
    for (int i = 0; i < 3; i++) if (uLamp[i].w >= 0.5) count++;
    if (count == 0) return vec3(0.0);
    int selected = min(int(randomFloat() * float(count)), count - 1), lamp = 0;
    for (int i = 0; i < 3; i++) {
      if (uLamp[i].w >= 0.5) { if (selected == 0) { lamp = i; break; } selected--; }
    }
    float radius = lampRadius(lamp), r = radius * sqrt(randomFloat()), a = 2.0 * PI * randomFloat();
    vec3 point = vec3(uLamp[lamp].xy * uTexSize + r * vec2(cos(a), sin(a)), uLamp[lamp].z);
    vec3 delta = point - p;
    float distance2 = dot(delta, delta), distance = sqrt(distance2);
    vec3 wi = delta / max(distance, EPS);
    float cosSurface = max(0.0, dot(n, wi)), cosLight = abs(wi.z);
    if (cosSurface <= 0.0 || cosLight <= 0.0 || !unoccluded(p, n, wi, distance)) return vec3(0.0);
    // PDF in solid angle: distance^2 / (cos(light) * disk area * active lamps).
    float inversePdf = float(count) * PI * radius * radius * cosLight / max(distance2, EPS);
    return albedo * (cosSurface / PI) * lampEmission(lamp) * inversePdf;
  }
  if (uLight == 2) {
    vec3 axis = normalize(uSun);
    vec3 tangent = normalize(cross(abs(axis.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0), axis));
    float z = mix(SUN_COS, 1.0, randomFloat()), a = 2.0 * PI * randomFloat();
    float r = sqrt(max(0.0, 1.0 - z * z));
    vec3 wi = normalize(axis * z + tangent * (r * cos(a)) + cross(axis, tangent) * (r * sin(a)));
    float cosine = max(0.0, dot(n, wi));
    if (cosine <= 0.0 || !unoccluded(p, n, wi, FAR)) return vec3(0.0);
    return albedo * (cosine / PI) * sunEmission() * (2.0 * PI * (1.0 - SUN_COS));
  }
  return vec3(0.0);
}

vec3 pathSample(vec2 uv) {
  float cameraZ = uBump + 1.0;
  if (uLight == 1) for (int i = 0; i < 3; i++) if (uLamp[i].w >= 0.5) cameraZ = max(cameraZ, uLamp[i].z + 1.0);
  vec3 origin = vec3(uv * uTexSize, cameraZ), direction = vec3(0.0, 0.0, -1.0);
  vec3 radiance = vec3(0.0), throughput = vec3(1.0), sigmaA = vec3(0.0);
  bool inside = false, specularBounce = true;
  // Up to 6/8 scattering events, followed by an emission/escape evaluation.
  for (int bounce = 0; bounce <= 8; bounce++) {
    RayHit hit; bool exhausted = false;
    bool found;
    if (bounce == 0) { hit = primaryHit(origin); found = true; }
    else found = traceScene(origin, direction, FAR, hit, exhausted);
    if (exhausted) break;
    if (!found) { if (!inside) radiance += throughput * environment(direction, specularBounce); break; }
    if (inside) throughput *= exp(-sigmaA * hit.t);
    vec3 p = origin + direction * hit.t;
    if (hit.kind == 2) {
      // Lamp paths from a diffuse vertex are already covered by direct sampling.
      if (specularBounce) radiance += throughput * hit.tint;
      break;
    }
    radiance += throughput * surfaceEmission(hit, p);
    if (bounce >= uBounces) break;
    bool front = dot(direction, hit.normal) < 0.0;
    vec3 n = front ? hit.normal : -hit.normal;
    if (hit.kind == 0 && dielectricMaterial()) {
      float ior = materialIor(), etaI = front ? 1.0 : ior, etaT = front ? ior : 1.0;
      float eta = etaI / etaT, reflectance = fresnelDielectric(-dot(direction, n), etaI, etaT);
      if (randomFloat() < reflectance) direction = reflect(direction, n);
      else {
        direction = refract(direction, n, eta);
        // Fresnel branch probability cancels its BSDF coefficient. Radiance
        // transmission still carries eta^2, which cancels over an entry/exit pair.
        throughput *= eta * eta;
        inside = front;
        sigmaA = inside ? absorption(hit.tint) : vec3(0.0);
      }
      specularBounce = true;
    } else if (hit.kind == 0 && uMat == 1) {
      throughput *= mix(vec3(0.94, 0.95, 0.97), hit.tint, 0.6);
      direction = reflect(direction, n);
      specularBounce = true;
    } else {
      vec3 albedo = diffuseColor(hit);
      radiance += throughput * directLight(p, n, albedo);
      direction = cosineDirection(n);
      throughput *= albedo; // Lambertian f*cos/pdf cancels to albedo.
      specularBounce = false;
    }
    direction = normalize(direction);
    origin = offsetRay(p, hit.normal, direction);
    if (max(throughput.r, max(throughput.g, throughput.b)) < 1e-8) break;
  }
  return max(radiance, vec3(0.0));
}
void main() {
  uvec2 pixel = uvec2(gl_FragCoord.xy);
  randomState = (pixel.x * 1973u + pixel.y * 9277u + uSeed * 26699u) | 1u;
  randomFloat(); randomFloat();
  vec2 jitter = vec2(randomFloat(), randomFloat()) - 0.5;
  vec2 uv = clamp(vUv + jitter / max(uResolution, vec2(1.0)), vec2(0.0), vec2(1.0));
  vec3 sampleValue = pathSample(uv);
  // Linear HDR mean. The display pass alone performs tone mapping and encoding.
  if (uSamples > 0) {
    vec3 previous = texelFetch(uPrevious, ivec2(gl_FragCoord.xy), 0).rgb;
    sampleValue = previous + (sampleValue - previous) / float(uSamples + 1);
  }
  outColor = vec4(sampleValue, 1.0);
}
