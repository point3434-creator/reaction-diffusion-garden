// Optional path tracer. Installed in the app closure before startup, like garden-update.js.
var pathTrace = {
  mode: 'realtime', quality: 'preview', available: false, reason: '', resources: null,
  history: createPathTraceHistory(), frozen: null, statusAt: 0
};

var PATH_DISPLAY = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uImage;
uniform vec4 uLamp[3];
uniform vec3 uLampCol[3];
uniform vec2 uMarkerScale;
in vec2 vUv;
out vec4 outColor;
void main() {
  // RGBA32F is intentionally NEAREST; manual interpolation needs no float-linear extension.
  ivec2 size = textureSize(uImage, 0);
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * vec2(size) - 0.5;
  ivec2 at = ivec2(floor(p)); vec2 f = fract(p);
  vec3 a = texelFetch(uImage, clamp(at, ivec2(0), size - 1), 0).rgb;
  vec3 b = texelFetch(uImage, clamp(at + ivec2(1, 0), ivec2(0), size - 1), 0).rgb;
  vec3 c = texelFetch(uImage, clamp(at + ivec2(0, 1), ivec2(0), size - 1), 0).rgb;
  vec3 d = texelFetch(uImage, clamp(at + ivec2(1), ivec2(0), size - 1), 0).rgb;
  vec3 x = max(vec3(0.0), mix(mix(a, b, f.x), mix(c, d, f.x), f.y));
  x = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  x = pow(x, vec3(1.0 / 2.2));
  // These rings are the existing lamp drag handles, drawn after radiance is displayed.
  for (int i = 0; i < 3; i++) {
    if (uLamp[i].w < 0.5) continue;
    float r = length((vUv - uLamp[i].xy) * uMarkerScale);
    float ring = smoothstep(0.76, 0.9, r) - smoothstep(1.0, 1.14, r);
    float core = 1.0 - smoothstep(0.28, 0.42, r);
    x = mix(x, mix(uLampCol[i], vec3(1.0), 0.6), max(ring * 0.9, core));
  }
  outColor = vec4(x, 1.0);
}
`;

function pathRestoreGL() {
  if (!gl || glLost) return;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(glProgram); gl.bindVertexArray(glVao);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, glLut);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, heightTex);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0);
}

function pathDeleteTarget(target) {
  if (!target || !gl) return;
  gl.deleteTexture(target.texture); gl.deleteFramebuffer(target.framebuffer);
}

function pathReleaseTargets() {
  var r = pathTrace.resources;
  if (!r) return;
  pathDeleteTarget(r.surface);
  r.targets.forEach(pathDeleteTarget);
  r.surface = null; r.targets = []; r.width = r.height = 0;
  pathTrace.history.reset();
}

function pathDispose() {
  var r = pathTrace.resources;
  if (!r || !gl) return;
  pathReleaseTargets();
  if (r.trace) gl.deleteProgram(r.trace.program);
  if (r.display) gl.deleteProgram(r.display.program);
  if (r.vao) gl.deleteVertexArray(r.vao);
  if (r.buffer) gl.deleteBuffer(r.buffer);
  pathTrace.resources = null;
}

function pathProgram(fragment, names) {
  var program = gl.createProgram(), shaders = [];
  try {
    [VERT, fragment].forEach(function (source, i) {
      var shader = gl.createShader(i ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER);
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Path shader compilation failed');
      gl.attachShader(program, shader);
    });
    gl.bindAttribLocation(program, 0, 'aPos'); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Path shader linking failed');
    var uniforms = {};
    names.forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });
    return { program: program, uniforms: uniforms };
  } catch (error) {
    gl.deleteProgram(program); throw error;
  } finally {
    shaders.forEach(function (shader) { gl.deleteShader(shader); });
  }
}

function pathCreateResources() {
  if (pathTrace.resources) return pathTrace.resources;
  var r = { targets: [], surface: null, width: 0, height: 0, read: 0 };
  pathTrace.resources = r; // Own every allocation immediately, including partial failure.
  r.trace = pathProgram(PATH_FRAG, ['uField', 'uChem', 'uSurface', 'uPrevious', 'uTexSize', 'uResolution',
    'uBump', 'uGlow', 'uLightTheme', 'uBg', 'uMat', 'uLight', 'uBounces', 'uSamples',
    'uSeed', 'uTilt', 'uLamp', 'uLampCol', 'uSun', 'uSunCol']);
  r.display = pathProgram(PATH_DISPLAY, ['uImage', 'uLamp', 'uLampCol', 'uMarkerScale']);
  r.vao = gl.createVertexArray(); gl.bindVertexArray(r.vao);
  r.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, r.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return r;
}

function pathTarget(width, height, format) {
  var target = { texture: gl.createTexture(), framebuffer: gl.createFramebuffer() };
  try {
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE || gl.getError() !== gl.NO_ERROR) {
      throw new Error('Floating-point path tracing target is unavailable');
    }
    return target;
  } catch (error) { pathDeleteTarget(target); throw error; }
}

function pathEnsureTargets(r, size) {
  if (r.width === size.width && r.height === size.height && r.gridW === sim.w && r.gridH === sim.h) return false;
  pathReleaseTargets();
  r.surface = pathTarget(sim.w * 2, sim.h * 2, gl.RGBA16F);
  r.targets.push(pathTarget(size.width, size.height, gl.RGBA32F));
  r.targets.push(pathTarget(size.width, size.height, gl.RGBA32F));
  r.width = size.width; r.height = size.height; r.gridW = sim.w; r.gridH = sim.h; r.read = 0;
  return true;
}

function pathControls(force) {
  var host = $('rendering');
  if (!host) return;
  var selected = pathTrace.mode === 'path';
  host.querySelectorAll('[data-renderer]').forEach(function (button) {
    button.setAttribute('aria-pressed', String(button.dataset.renderer === pathTrace.mode));
    if (button.dataset.renderer === 'path') button.disabled = !pathTrace.available;
  });
  $('pathTraceOptions').hidden = !selected;
  host.querySelectorAll('[data-path-quality]').forEach(function (button) {
    button.setAttribute('aria-pressed', String(button.dataset.pathQuality === pathTrace.quality));
  });
  var now = performance.now();
  if (!force && now - pathTrace.statusAt < 500) return;
  pathTrace.statusAt = now;
  var text;
  if (!pathTrace.available) text = 'Path tracing is unavailable on this device. Real-time rendering is active.';
  else if (!selected) text = 'Responsive rendering for play. Path traced adds reflections, refraction and indirect light.';
  else if (!state.paused || music.on) text = 'Live preview · Pause & refine for a clearer still image.';
  else text = pathTrace.history.samples.toLocaleString() + ' samples · ' + (pathTrace.history.samples >= 4096 ? 'Refinement complete.' : 'Refining the still image…');
  $('pathTraceStatus').textContent = text;
}

function initializePathTracing() {
  // Context-restored handles belong to the old context and must never be reused.
  pathTrace.resources = null; pathTrace.history.reset(); pathTrace.frozen = null;
  pathTrace.available = !!(gl && gl.getExtension('EXT_color_buffer_float'));
  pathTrace.reason = pathTrace.available ? '' : 'Floating-point rendering is unavailable';
  if (!pathTrace.available) pathTrace.mode = 'realtime';
  pathControls(true);
}

function setPathTraceMode(mode) {
  pathTrace.mode = mode === 'path' && pathTrace.available ? 'path' : 'realtime';
  pathTrace.history.reset(); pathTrace.frozen = null;
  if (pathTrace.mode === 'realtime') { pathReleaseTargets(); pathRestoreGL(); }
  pathControls(true);
}

function pathScene(dark) {
  var frozen = state.paused && !music.on;
  if (!frozen) pathTrace.frozen = null;
  if (frozen && !pathTrace.frozen) pathTrace.frozen = {
    time: performance.now() / 1000, bump: 5.5 + 3 * music.beat,
    hue: music.hueAng, glow: music.on ? music.loud : 0.3
  };
  var snapshot = pathTrace.frozen || {
    time: performance.now() / 1000, bump: 5.5 + 3 * music.beat,
    hue: music.hueAng, glow: music.on ? music.loud : 0.3
  };
  var bd = backdropFor(dark), bg = hex(bd.bg).map(function (v) { return Math.fround(v / 255); });
  var n = lampsOn(), lamps = [], colors = [], sun = [0, 0, 1], sunColor = [1, 1, 1];
  for (var i = 0; i < 3; i++) {
    lamps.push(Math.fround(state.lamps[i].x), Math.fround(state.lamps[i].y), Math.fround(lampHeightCells()), i < n ? 1 : 0);
    colors.push.apply(colors, n === 1 ? LAMP_WARM : STAGE[i]);
  }
  if (state.light === 'sun') {
    var az = snapshot.time * Math.PI / 24;
    var el = (24 + 13 * Math.sin(snapshot.time * Math.PI / 15.5)) * Math.PI / 180;
    sun = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)].map(Math.fround);
    var warm = smooth(11, 37, el * 180 / Math.PI);
    sunColor = [1, 0.62 + 0.33 * warm, 0.36 + 0.5 * warm].map(Math.fround);
  }
  return {
    bg: bg, lightTheme: bd.light ? 1 : 0, palette: state.palette,
    chem: sim.kind === 'heart' ? 1 : sim.kind === 'quantum' ? 2 : sim.kind === 'mould' ? 3 : 0,
    material: MATERIALS[state.material].id, light: n ? 1 : state.light === 'sun' ? 2 : 0,
    bump: Math.fround(snapshot.bump), hue: Math.fround(snapshot.hue), glow: Math.fround(snapshot.glow),
    // Quantize the values sent to the shader, so asymptotic tilt easing can settle.
    tilt: [state.tilt.x, state.tilt.y].map(function (v) { return Math.fround(Math.round(v * 10000) / 10000); }),
    lamps: lamps, lampColors: colors, sun: sun, sunColor: sunColor
  };
}

function pathUploadField() {
  var changed = false, n = sim.w * sim.h, fb = fieldBuf;
  var fields = [sim.R, sim.G, sim.Bl, sim.A];
  for (var i = 0; i < n; i++) for (var c = 0; c < 4; c++) {
    var j = i * 4 + c, value = Math.fround(fields[c][i]);
    if (fb[j] !== value) changed = true;
    fb[j] = value;
  }
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, sim.w, sim.h, gl.RGBA, gl.FLOAT, fb);
  return changed;
}

function pathDrawSurface(r, scene) {
  gl.useProgram(glProgram); gl.bindVertexArray(glVao);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, glLut);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.surface.framebuffer);
  gl.viewport(0, 0, sim.w * 2, sim.h * 2);
  gl.uniform2f(glU.uTexSize, sim.w, sim.h);
  gl.uniform1f(glU.uLineage, PALETTES[state.palette].lineage ? 1 : 0);
  gl.uniform1f(glU.uHue, scene.hue); gl.uniform1i(glU.uMat, scene.material);
  gl.uniform1f(glU.uHeart, scene.chem);
  gl.uniform1i(glU.uPass, 2); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.uniform1i(glU.uPass, 0);
}

function pathDrawSample(r, scene, moving) {
  var u = r.trace.uniforms, write = 1 - r.read;
  gl.useProgram(r.trace.program); gl.bindVertexArray(r.vao);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, r.surface.texture);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, r.targets[r.read].texture);
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.targets[write].framebuffer);
  gl.viewport(0, 0, r.width, r.height);
  gl.uniform1i(u.uField, 0); gl.uniform1i(u.uChem, scene.chem);
  gl.uniform1i(u.uSurface, 2); gl.uniform1i(u.uPrevious, 3);
  gl.uniform2f(u.uTexSize, sim.w, sim.h); gl.uniform2f(u.uResolution, r.width, r.height);
  gl.uniform1f(u.uBump, scene.bump); gl.uniform1f(u.uGlow, scene.glow);
  gl.uniform1f(u.uLightTheme, scene.lightTheme); gl.uniform3fv(u.uBg, scene.bg);
  gl.uniform1i(u.uMat, scene.material); gl.uniform1i(u.uLight, scene.light);
  // Glass → floor → glass needs five scattering events before the path can
  // reach the sky. Keep a sixth event even in preview so glass stays transparent.
  gl.uniform1i(u.uBounces, !moving && pathTrace.quality === 'fine' ? 8 : 6);
  gl.uniform1i(u.uSamples, pathTrace.history.samples); gl.uniform1ui(u.uSeed, pathTrace.history.seed);
  gl.uniform2fv(u.uTilt, scene.tilt); gl.uniform4fv(u.uLamp, scene.lamps); gl.uniform3fv(u.uLampCol, scene.lampColors);
  gl.uniform3fv(u.uSun, scene.sun); gl.uniform3fv(u.uSunCol, scene.sunColor);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  r.read = write; pathTrace.history.commit();
}

function pathPresent(r, scene) {
  var u = r.display.uniforms;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(r.display.program); gl.bindVertexArray(r.vao);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, r.targets[r.read].texture);
  gl.uniform1i(u.uImage, 3); gl.uniform4fv(u.uLamp, scene.lamps); gl.uniform3fv(u.uLampCol, scene.lampColors);
  var rect = canvas.getBoundingClientRect();
  gl.uniform2f(u.uMarkerScale, rect.width / (LAMP_GRAB * 0.5), rect.height / (LAMP_GRAB * 0.5));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function renderPathTraced(dark) {
  if (pathTrace.mode !== 'path' || !pathTrace.available || !gl || glLost) return false;
  try {
    var moving = !state.paused || music.on;
    var size = pathTraceSize(canvas.width, canvas.height, pathTrace.quality, moving);
    var r = pathCreateResources(), resized = pathEnsureTargets(r, size);
    var changed = pathUploadField(), scene = pathScene(dark);
    var key = JSON.stringify([scene, r.width, r.height, sim.w, sim.h, pathTrace.quality]);
    if (pathTrace.history.begin(key, changed || resized, moving)) pathDrawSurface(r, scene);
    if (pathTrace.history.samples < 4096) pathDrawSample(r, scene, moving);
    pathPresent(r, scene); pathControls(false);
    return true;
  } catch (error) {
    pathTrace.reason = String(error.message || error);
    console.warn('Path tracing disabled:', pathTrace.reason);
    pathDispose(); pathTrace.available = false; pathTrace.mode = 'realtime';
    pathControls(true);
    return false;
  } finally { pathRestoreGL(); }
}

(function installPathTracing() {
  try { if (localStorage.getItem('garden.pathQuality') === 'fine') pathTrace.quality = 'fine'; } catch (e) {}
  var host = document.createElement('div'); host.className = 'group'; host.id = 'rendering';
  host.innerHTML = '<h3 class="eyebrow">Rendering</h3><div class="seg" id="renderModes" role="group" aria-label="Rendering"><button class="chip" type="button" data-renderer="realtime" aria-pressed="true">Real-time</button><button class="chip" type="button" data-renderer="path" aria-pressed="false" aria-describedby="pathTraceStatus" disabled>Path traced</button></div><div id="pathTraceOptions" hidden><div class="chips" role="group" aria-label="Path tracing quality"><button class="chip" type="button" data-path-quality="preview" aria-pressed="true">Preview</button><button class="chip" type="button" data-path-quality="fine" aria-pressed="false">Fine</button></div><div class="actions"><button class="act" id="pathTraceRefine" type="button" title="Pause motion and sound to refine a still image">Pause &amp; refine</button></div><p class="note">Preview settles faster. Fine traces more bounces at a higher resolution. Moving scenes can look grainy.</p></div><p class="note" id="pathTraceStatus" aria-live="off"></p>';
  var pane = document.querySelector('[data-pane="look"]'); pane.insertBefore(host, pane.firstChild);
  host.querySelectorAll('[data-renderer]').forEach(function (button) {
    button.addEventListener('click', function () { setPathTraceMode(this.dataset.renderer); });
  });
  host.querySelectorAll('[data-path-quality]').forEach(function (button) {
    button.addEventListener('click', function () {
      pathTrace.quality = this.dataset.pathQuality; pathTrace.history.reset();
      try { localStorage.setItem('garden.pathQuality', pathTrace.quality); } catch (e) {}
      pathControls(true);
    });
  });
  $('pathTraceRefine').addEventListener('click', function () {
    if (!state.paused) $('pause').click();
    if (music.on) stopMusic();
    pathTrace.frozen = null; pathTrace.history.reset(); pathControls(true);
  });
})();
