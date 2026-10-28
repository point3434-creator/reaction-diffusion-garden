'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8')
  .replace(/<link[^>]*>/g, '')
  .replace('</style>', '#view { width: 160px !important; height: 120px !important; }</style>')
  .replace('  // ---- go ----', 'window.pathAudit = { state, music, render, frame, getSim: () => sim, getGL: () => gl, getPath: () => pathTrace, mainProgram: () => glProgram, mainVao: () => glVao, setupGrid };\n  // ---- go ----');
let browser;
test.before(async () => {
  const options = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'] };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  browser = await chromium.launch(options);
});
test.after(async () => { if (browser) await browser.close(); });

async function open(t, failure) {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(failure => {
    // Drive frames explicitly: every assertion sees a complete draw, without timing races.
    window.requestAnimationFrame = () => 0;
    if (failure === '2d') {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
      };
    }
    if (failure === 'extension') {
      const getExtension = WebGL2RenderingContext.prototype.getExtension;
      WebGL2RenderingContext.prototype.getExtension = function (name) {
        return name === 'EXT_color_buffer_float' ? null : getExtension.call(this, name);
      };
    }
  }, failure);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const a = pathAudit;
    a.state.paused = true;
    a.music.beat = 0; a.music.hueAng = 0; a.music.on = false;
    a.state.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    document.querySelector('[data-tab="look"]').click();
    document.querySelector('[data-light="studio"]').click();
    const s = a.getSim(); s.clear();
    s.paint(s.w * 0.36, s.h * 0.4, Math.min(s.w, s.h) * 0.12, false, [0.7, 0.2, 0.1]);
    s.paint(s.w * 0.62, s.h * 0.6, Math.min(s.w, s.h) * 0.1, false, [0.1, 0.4, 0.5]);
    a.render();
  });
  return { page, errors };
}

async function enable(page) {
  await page.evaluate(() => document.querySelector('[data-renderer="path"]').click());
}

async function draw(page, count = 1) {
  return page.evaluate(count => {
    for (let i = 0; i < count; i++) pathAudit.render();
    const p = pathAudit.getPath(), gl = pathAudit.getGL(), r = p.resources;
    // Observe production GL state before test readback can alter it.
    const restored = gl && {
      framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) === null,
      program: gl.getParameter(gl.CURRENT_PROGRAM) === pathAudit.mainProgram(),
      vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING) === pathAudit.mainVao(),
      activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE) === gl.TEXTURE0
    };
    let finite = true, max = 0, min = Infinity, displayError = 0;
    if (r && r.targets.length) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const display = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, display);
      gl.bindFramebuffer(gl.FRAMEBUFFER, r.targets[r.read].framebuffer);
      const pixels = new Float32Array(r.width * r.height * 4);
      gl.readPixels(0, 0, r.width, r.height, gl.RGBA, gl.FLOAT, pixels);
      for (let i = 0; i < pixels.length; i++) if (i % 4 !== 3) {
        finite = finite && Number.isFinite(pixels[i]); max = Math.max(max, pixels[i]); min = Math.min(min, pixels[i]);
      }
      if (r.width === gl.drawingBufferWidth && r.height === gl.drawingBufferHeight && pathAudit.state.light === 'studio') {
        // The documented ACES fitted display transform must preserve pixel location;
        // an upside-down, blank or stale presentation fails against HDR readback.
        for (let i = 0; i < pixels.length; i++) if (i % 4 !== 3) {
          const x = Math.max(0, pixels[i]);
          const mapped = Math.max(0, Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
          displayError = Math.max(displayError, Math.abs(display[i] - Math.pow(mapped, 1 / 2.2) * 255));
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    return { mode: p.mode, available: p.available, reason: p.reason, samples: p.history.samples,
      quality: p.quality, bounces: r && gl.getUniform(r.trace.program, r.trace.uniforms.uBounces),
      seed: p.history.seed, width: r && r.width, height: r && r.height, finite, max, min,
      error: gl && gl.getError(), restored, displayError };
  }, count);
}

test('path tracing is opt-in, renders real HDR pixels, refines, and switches back', async t => {
  const { page, errors } = await open(t);
  assert.equal(await page.evaluate(() => pathAudit.getPath().mode), 'realtime');
  assert.equal(await page.locator('[data-renderer="path"]').isDisabled(), false);
  await enable(page);
  const first = await draw(page);
  assert.equal(first.mode, 'path', first.reason);
  assert.equal(first.samples, 1);
  assert.equal(first.bounces, 6, 'preview keeps the complete glass-floor-glass light path');
  assert.ok(first.finite && first.max > first.min && first.max > 0, 'trace produces nonflat finite radiance');
  assert.equal(first.error, 0);
  assert.deepEqual(first.restored, { framebuffer: true, program: true, vao: true, activeTexture: true });
  assert.ok(first.displayError <= 2, 'present the traced image with correct orientation and display encoding');
  assert.equal((await draw(page, 3)).samples, 4);
  // Keep the real presented pixels as a CI artifact for visual inspection.
  // Read in the same task as the draw; the default framebuffer is not preserved.
  const preview = await page.evaluate(() => {
    for (let i = 0; i < 28; i++) pathAudit.render();
    const gl = pathAudit.getGL(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'), image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) image.data.set(pixels.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const output = path.join(__dirname, '../test-results/path-tracing');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'presented-preview.png'), Buffer.from(preview, 'base64'));
  await page.evaluate(() => document.querySelector('[data-renderer="realtime"]').click());
  const result = await page.evaluate(() => {
    pathAudit.render();
    const gl = pathAudit.getGL(), pixels = new Uint8Array(160 * 120 * 4);
    gl.readPixels(0, 0, 160, 120, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return { error: gl.getError(), pixels: pixels.some((v, i) => i % 4 !== 3 && v > 0), mode: pathAudit.getPath().mode };
  });
  assert.deepEqual(result, { error: 0, pixels: true, mode: 'realtime' });
  assert.deepEqual(errors, []);
});

test('painting, palette, material, lights, quality and resize invalidate old samples', async t => {
  const { page, errors } = await open(t);
  await enable(page);
  const changes = [
    () => { const s = pathAudit.getSim(); s.paint(s.w * 0.8, s.h * 0.2, 4, false, [0.1, 0.8, 0.1]); },
    () => document.querySelector('#discs').children[1].click(),
    () => document.querySelector('#mats').children[1].click(),
    () => document.querySelector('[data-light="lamp"]').click(),
    () => { pathAudit.state.lamps[0].x += 0.08; },
    () => document.querySelector('[data-path-quality="fine"]').click(),
    () => { const c = document.getElementById('view'); c.width = 144; c.height = 108; }
  ];
  for (const change of changes) {
    await draw(page, 2);
    await page.evaluate(change);
    const next = await draw(page);
    assert.equal(next.mode, 'path', next.reason);
    assert.equal(next.samples, 1, change.toString());
    assert.equal(next.bounces, next.quality === 'fine' ? 8 : 6);
    assert.equal(next.error, 0);
  }
  assert.deepEqual(errors, []);
});

test('motion resets history but advances noise, and paused sun can converge', async t => {
  const { page, errors } = await open(t);
  await enable(page);
  await page.evaluate(() => { pathAudit.state.paused = false; });
  const a = await draw(page), b = await draw(page);
  assert.equal(a.samples, 1); assert.equal(b.samples, 1);
  assert.equal(b.bounces, 6, 'live preview retains glass transmission');
  assert.notEqual(a.seed, b.seed);
  assert.ok(b.width * b.height <= 98304);
  await page.evaluate(() => {
    pathAudit.state.paused = true;
    document.querySelector('[data-light="sun"]').click();
  });
  await draw(page);
  assert.equal((await draw(page, 3)).samples, 4, 'pause freezes sun position for progressive refinement');
  await page.evaluate(() => { pathAudit.music.on = true; pathAudit.music.loud = 0.7; });
  assert.equal((await draw(page)).samples, 1, 'active sound invalidates still history');
  await page.evaluate(() => { pathAudit.music.on = false; });
  assert.deepEqual(errors, []);
});

test('path tracing preserves tissue, potential, food and wall markers in other dishes', async t => {
  const { page, errors } = await open(t);
  await enable(page);
  const results = await page.evaluate(() => {
    const results = [];
    for (const chem of ['heart', 'quantum', 'mould']) {
      document.querySelector('[data-chem="' + chem + '"]').click();
      const s = pathAudit.getSim(), p = pathAudit.getPath();
      s.R.fill(0); s.G.fill(0); s.Bl.fill(0); s.A.fill(0);
      function image(alpha) {
        s.A.fill(alpha); p.history.reset(); p.history.seed = 12345; pathAudit.render();
        const gl = pathAudit.getGL(), r = p.resources;
        gl.bindFramebuffer(gl.FRAMEBUFFER, r.targets[r.read].framebuffer);
        const pixels = new Float32Array(r.width * r.height * 4);
        gl.readPixels(0, 0, r.width, r.height, gl.RGBA, gl.FLOAT, pixels);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return pixels;
      }
      const plain = image(0), marker = image(chem === 'heart' ? 0.5 : -0.3), wall = image(-1);
      const difference = pixels => pixels.reduce((total, value, i) => total + Math.abs(value - plain[i]), 0) / pixels.length;
      results.push({ chem, marker: difference(marker), wall: difference(wall) });
    }
    return results;
  });
  for (const result of results) {
    assert.ok(result.marker > 0.001, result.chem + ' marker disappeared');
    assert.ok(result.wall > 0.001, result.chem + ' wall/scar disappeared');
  }
  assert.deepEqual(errors, []);
});

test('the actual paused frame loop refines while residual sound values decay', async t => {
  const { page, errors } = await open(t);
  await enable(page);
  const result = await page.evaluate(() => {
    pathAudit.music.beat = 0.8;
    pathAudit.music.hueAng = 1;
    pathAudit.music.hueTarget = 0;
    for (let i = 0; i < 4; i++) pathAudit.frame(performance.now());
    return { samples: pathAudit.getPath().history.samples, beat: pathAudit.music.beat, hue: pathAudit.music.hueAng };
  });
  assert.equal(result.samples, 4);
  assert.ok(result.beat < 0.8 && result.hue < 1, 'exercise the real animation updates');
  assert.deepEqual(errors, []);
});

for (const mode of ['2d', 'extension']) test(mode + ' fallback keeps the dish usable and disables only path tracing', async t => {
  const { page, errors } = await open(t, mode);
  assert.equal(await page.locator('[data-renderer="path"]').isDisabled(), true);
  const result = await page.evaluate(() => {
    const s = pathAudit.getSim(); s.clear(); document.getElementById('seed').click(); pathAudit.render();
    return { mass: s.R.reduce((a, v) => a + v, 0), mode: pathAudit.getPath().mode, gl: !!pathAudit.getGL() };
  });
  assert.ok(result.mass > 0);
  assert.equal(result.mode, 'realtime');
  assert.equal(result.gl, mode !== '2d');
  assert.deepEqual(errors, []);
});

for (const failure of ['compile', 'framebuffer']) test('path ' + failure + ' failure preserves the real-time renderer', async t => {
  const { page, errors } = await open(t);
  await page.evaluate(failure => {
    const gl = pathAudit.getGL();
    if (failure === 'compile') {
      const original = gl.getShaderParameter.bind(gl);
      gl.getShaderParameter = (shader, parameter) => parameter === gl.COMPILE_STATUS ? false : original(shader, parameter);
    } else gl.checkFramebufferStatus = () => gl.FRAMEBUFFER_UNSUPPORTED;
    document.querySelector('[data-renderer="path"]').click();
    pathAudit.render();
  }, failure);
  const result = await draw(page);
  assert.equal(result.mode, 'realtime');
  assert.equal(result.available, false);
  assert.equal(result.error, 0);
  assert.equal(await page.locator('[data-renderer="path"]').isDisabled(), true);
  assert.deepEqual(errors, []);
});

test('context loss rebuilds path targets and preserves the simulated dish', async t => {
  const { page, errors } = await open(t);
  await enable(page); await draw(page, 2);
  await page.evaluate(async () => {
    window.beforePathLoss = pathAudit.getSim();
    window.pathLoss = pathAudit.getGL().getExtension('WEBGL_lose_context');
    const canvas = document.getElementById('view');
    await new Promise(resolve => { canvas.addEventListener('webglcontextlost', resolve, { once: true }); pathLoss.loseContext(); });
  });
  await page.evaluate(() => {
    window.pathRestored = false;
    document.getElementById('view').addEventListener('webglcontextrestored', () => { window.pathRestored = true; }, { once: true });
    pathLoss.restoreContext();
  });
  await page.waitForFunction(() => window.pathRestored, null, { timeout: 10000, polling: 50 });
  assert.equal(await page.evaluate(() => pathAudit.getSim() === window.beforePathLoss), true);
  const result = await draw(page, 2);
  assert.equal(result.mode, 'path', result.reason);
  assert.equal(result.samples, 2);
  assert.equal(result.error, 0);
  assert.deepEqual(errors, []);
});
