'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8')
  .replace(/<link[^>]*>/g, '')
  .replace('  // ---- go ----', 'window.audit = { state, getSim: () => sim, frame, seedFromImage, getPainting: () => painting, audioRenderBudget, fitCanvas, ensureCtx, music }; \n  // ---- go ----');
let browser;
test.before(async () => {
  const options = { headless: true };
  if (process.env.CI) options.args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  browser = await chromium.launch(options);
});
test.after(async () => { if (browser) await browser.close(); });

async function open(t, mode = '2d') {
  const page = await browser.newPage({ viewport: mode === '2d' ? { width: 900, height: 650 } : { width: 640, height: 480 } });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluate(mode => {
    if (mode === '2d') {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/.test(type) ? null : original.call(this, type, ...args);
      };
    } else if (mode === 'shader-failure') {
      const original = WebGL2RenderingContext.prototype.getShaderParameter;
      WebGL2RenderingContext.prototype.getShaderParameter = function (shader, parameter) {
        return parameter === this.COMPILE_STATUS ? false : original.call(this, shader, parameter);
      };
    }
  }, mode);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    if (window.audit) window.audit.state.paused = true;
  });
  return { page, errors };
}

test('audio headroom reduces only the drawing buffer and restores it without resizing the simulation', async t => {
  const { page, errors } = await open(t, 'webgl');
  const result = await page.evaluate(() => {
    const a = window.audit, canvas = document.querySelector('#view'), sim = a.getSim();
    const initial = canvas.width;
    for (let i = 0; i < 100; i++) a.audioRenderBudget.sample(80, true);
    a.fitCanvas(); const reduced = canvas.width;
    const sameSim = sim === a.getSim();
    a.audioRenderBudget.sample(16.7, false); a.fitCanvas();
    let requested;
    window.AudioContext = new Proxy(window.AudioContext, { construct(Target, args) { requested = args[0]; return new Target(...args); } });
    a.ensureCtx();
    return { initial, reduced, restored: canvas.width, sameSim, requested, audioState: a.music.actx.state };
  });
  assert.ok(result.reduced < result.initial / 2);
  assert.equal(result.restored, result.initial); assert.equal(result.sameSim, true);
  assert.equal(result.requested.latencyHint, 'playback');
  assert.ok(['running', 'suspended'].includes(result.audioState));
  assert.deepEqual(errors, []);
});

test('Current photo seeds the dish from a decoded image', async t => {
  const { page, errors } = await open(t);
  const mass = await page.evaluate(async () => {
    document.querySelector('[data-chem="current"]').click();
    const image = new Image();
    image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="white"/><rect x="30" y="30" width="50" height="50" fill="black"/></svg>');
    await image.decode();
    const random = Math.random;
    Math.random = () => 0.1;
    try { window.audit.seedFromImage(image); } finally { Math.random = random; }
    const s = window.audit.getSim();
    return s.R.reduce((a, v, i) => a + v + s.G[i] + s.Bl[i], 0);
  });
  assert.ok(mass > 0, 'photo must leave nonempty chemical seeds');
  assert.deepEqual(errors, []);
});

test('Current offers only supported presets and tools, including keyboard selection', async t => {
  const { page, errors } = await open(t);
  await page.evaluate(() => document.querySelector('[data-chem="current"]').click());
  assert.equal(await page.getByRole('button', { name: 'Atlas', exact: true }).count(), 0);
  assert.equal(await page.locator('#stirBtn').isVisible(), false);
  await page.keyboard.press('9');
  assert.equal(await page.evaluate(() => window.audit.state.atlas), false);
  await page.evaluate(() => document.querySelector('[data-chem="garden"]').click());
  assert.equal(await page.getByRole('button', { name: 'Atlas', exact: true }).count(), 1);
  assert.equal(await page.locator('#stirBtn').isVisible(), true);
  assert.deepEqual(errors, []);
});

test('an over-budget two-step frame reduces to one step', async t => {
  const { page } = await open(t);
  const steps = await page.evaluate(() => {
    const a = window.audit;
    a.getSim().step = () => { const end = performance.now() + 30; while (performance.now() < end) {} };
    a.state.steps = a.state.stepsEff = 2;
    a.state.paused = false;
    a.frame(performance.now());
    a.state.paused = true;
    return a.state.stepsEff;
  });
  assert.equal(steps, 1);
});

test('a second touch neither joins nor terminates the active stroke', async t => {
  const { page, errors } = await open(t);
  const result = await page.evaluate(() => {
    const canvas = document.getElementById('view'), s = window.audit.getSim();
    // Synthetic pointer IDs have no native capture; only stub that platform boundary.
    canvas.setPointerCapture = () => {};
    s.clear();
    const rect = canvas.getBoundingClientRect();
    const emit = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', clientX: rect.left + x, clientY: rect.top + y, bubbles: true
    }));
    const mass = () => s.R.reduce((a, v, i) => a + v + s.G[i] + s.Bl[i], 0);
    emit('pointerdown', 1, 80, 80);
    const first = mass();
    emit('pointerdown', 2, 250, 250);
    const second = mass();
    emit('pointerup', 2, 250, 250);
    const stillPainting = window.audit.getPainting();
    emit('pointermove', 1, 120, 80);
    const moved = mass();
    emit('pointerup', 1, 120, 80);
    return { first, second, moved, stillPainting, ended: !window.audit.getPainting() };
  });
  assert.equal(result.second, result.first, 'secondary pointer must not paint');
  assert.equal(result.stillPainting, true, 'secondary release must not stop first pointer');
  assert.ok(result.moved > result.first, 'first pointer must continue painting');
  assert.equal(result.ended, true);
  assert.deepEqual(errors, []);
});

test('shader setup failure falls back to a usable 2D canvas', async t => {
  const { page, errors } = await open(t, 'shader-failure');
  assert.deepEqual(errors, [], 'setup failure must not abort the app');
  const result = await page.evaluate(() => {
    const canvas = document.getElementById('view');
    window.audit.getSim().clear();
    const before = window.audit.getSim().R.reduce((a, v) => a + v, 0);
    document.getElementById('seed').click();
    const after = window.audit.getSim().R.reduce((a, v) => a + v, 0);
    return { twoD: !!canvas.getContext('2d'), before, after };
  });
  assert.equal(result.twoD, true);
  assert.ok(result.after > result.before);
  await page.mouse.move(80, 80);
  await page.mouse.down();
  assert.equal(await page.evaluate(() => window.audit.getPainting()), true);
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.audit.getPainting()), false);
});

test('WebGL context restoration preserves the dish and resumes rendering', async t => {
  const { page, errors } = await open(t, 'webgl');
  const initial = await page.evaluate(() => {
    const gl = document.getElementById('view').getContext('webgl2');
    if (!gl) return null;
    window.restoreExtension = gl.getExtension('WEBGL_lose_context');
    if (!window.restoreExtension) return null;
    document.querySelector('[data-tab="look"]').click();
    document.querySelector('[data-light="stage"]').click();
    window.audit.frame(performance.now());
    const s = window.audit.getSim();
    window.beforeLoss = s;
    return { mass: s.R.reduce((a, v) => a + v, 0) };
  });
  assert.ok(initial, 'WebGL2 and the loss test extension are required for this regression');
  const prevented = await page.evaluate(() => new Promise(resolve => {
    document.getElementById('view').addEventListener('webglcontextlost', event => resolve(event.defaultPrevented), { once: true });
    window.restoreExtension.loseContext();
  }));
  assert.equal(prevented, true, 'application must request restoration');
  await page.evaluate(() => {
    window.restored = false;
    document.getElementById('view').addEventListener('webglcontextrestored', () => { window.restored = true; }, { once: true });
    window.restoreExtension.restoreContext();
  });
  await page.waitForFunction(() => window.restored, null, { timeout: 10000 });
  const result = await page.evaluate(() => {
    window.audit.frame(performance.now());
    const s = window.audit.getSim(), gl = document.getElementById('view').getContext('webgl2');
    const pixels = new Uint8Array(4 * gl.drawingBufferWidth * gl.drawingBufferHeight);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return { same: s === window.beforeLoss, mass: s.R.reduce((a, v) => a + v, 0), error: gl.getError(), rendered: pixels.some((v, i) => i % 4 !== 3 && v > 0) };
  });
  assert.equal(result.same, true);
  assert.equal(result.mass, initial.mass);
  assert.equal(result.error, 0);
  assert.equal(result.rendered, true);
  assert.deepEqual(errors, []);
});

test('failed shader setup during restoration hides unavailable lighting controls', async t => {
  const { page, errors } = await open(t, 'webgl');
  await page.evaluate(async () => {
    const canvas = document.getElementById('view'), gl = canvas.getContext('webgl2');
    window.restoreExtension = gl.getExtension('WEBGL_lose_context');
    await new Promise(resolve => {
      canvas.addEventListener('webglcontextlost', resolve, { once: true });
      window.restoreExtension.loseContext();
    });
  });
  await page.evaluate(() => {
    const canvas = document.getElementById('view');
    const original = WebGL2RenderingContext.prototype.getShaderParameter;
    WebGL2RenderingContext.prototype.getShaderParameter = function (shader, parameter) {
      return parameter === this.COMPILE_STATUS ? false : original.call(this, shader, parameter);
    };
    window.restored = false;
    canvas.addEventListener('webglcontextrestored', () => { window.restored = true; }, { once: true });
    window.restoreExtension.restoreContext();
  });
  await page.waitForFunction(() => window.restored, null, { timeout: 10000 });
  const result = await page.evaluate(() => {
    window.audit.frame(performance.now());
    return {
      twoD: !!document.getElementById('view').getContext('2d'),
      materialsHidden: document.getElementById('materials').hidden,
      lightsHidden: document.getElementById('lights').hidden
    };
  });
  assert.equal(result.twoD, true);
  assert.equal(result.materialsHidden, true);
  assert.equal(result.lightsHidden, true);
  assert.deepEqual(errors, []);
});
