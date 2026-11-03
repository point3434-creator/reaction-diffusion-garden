'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const shader = fs.readFileSync(path.join(root, 'src/frag.glsl'), 'utf8');
const shellAssetDir = path.join(root, 'src/crystal-shell-assets');
const shellTextures = JSON.parse(fs.readFileSync(path.join(shellAssetDir, 'manifest.json'), 'utf8')).files
  .map(asset => 'data:image/png;base64,' + fs.readFileSync(path.join(shellAssetDir, asset.file)).toString('base64'));
const amberTexture = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, 'src/amber-flow-assets/surface.jpg')).toString('base64');
const materialTextureLoader = fs.readFileSync(path.join(root, 'src/material-textures.js'), 'utf8');
const artifacts = path.join(root, 'test-results/materials');
const snapshot = process.env.MATERIAL_SNAPSHOT || 'after';
let browser;
test.before(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const options = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  browser = await chromium.launch(options);
});
test.after(async () => { if (browser) await browser.close(); });

// Four isolated domes of different radii expose both whole-blob fills and effects that
// miss smaller blobs. The deliberately cool pigment/palette must not turn lava green.
async function fixture(t, size, plateau = false) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  t.after(() => page.close());
  await page.setContent('<style>body{margin:0}canvas{display:block}</style><canvas></canvas>');
  await page.addScriptTag({ content: materialTextureLoader });
  await page.evaluate(async ({ shader, size, plateau, shellTextures, amberTexture }) => {
    const canvas = document.querySelector('canvas');
    canvas.width = canvas.height = size;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('These material tests require real WebGL2; a 2D fallback cannot pass.');
    if (!gl.getExtension('OES_texture_float_linear')) throw new Error('Float texture interpolation unavailable.');
    const program = gl.createProgram();
    for (const [type, text] of [
      [gl.VERTEX_SHADER, '#version 300 es\nin vec2 aPos;out vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.,1.);}'],
      [gl.FRAGMENT_SHADER, shader]
    ]) {
      const stage = gl.createShader(type);
      gl.shaderSource(stage, text); gl.compileShader(stage);
      if (!gl.getShaderParameter(stage, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(stage));
      gl.attachShader(program, stage);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const side = 128;
    const domes = [[25, 26, 12], [82, 28, 20], [30, 84, 19], [92, 91, 11]];
    function concentration(x, y) {
      if (plateau) return 0.32 * Math.min(1, Math.max(0, Math.min(x - 18, 110 - x, y - 18, 110 - y) / 4));
      return Math.max(...domes.map(([cx, cy, r]) => 0.34 * Math.pow(Math.max(0, 1 - ((x - cx) ** 2 + (y - cy) ** 2) / r ** 2), 1.3)));
    }
    const field = new Float32Array(side * side * 4);
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const b = concentration(x + 0.5, y + 0.5), i = (y * side + x) * 4;
      field[i] = b * 0.08; field[i + 1] = b * 0.58; field[i + 2] = b * 0.34;
    }
    function texture(unit, width, height, data) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
      for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
      for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    }
    texture(0, side, side, field);
    texture(1, 2, 1, new Float32Array([0.05, 0.35, 0.65, 1, 0.1, 0.8, 1, 1]));
    texture(2, 1, 1, new Float32Array([0, 0, 0, 1]));
    const uniform = name => gl.getUniformLocation(program, name);
    gl.uniform1i(uniform('uField'), 0); gl.uniform1i(uniform('uLut'), 1); gl.uniform1i(uniform('uHeight'), 2);
    gl.uniform1i(uniform('uShellPebbles'), 3); gl.uniform1i(uniform('uShellEnvironment'), 4);
    gl.uniform1i(uniform('uAmberSurface'), 5);
    if (!await loadMaterialTextures(gl, shellTextures, amberTexture)) throw new Error('Material textures did not load');
    gl.uniform2f(uniform('uTexSize'), side, side);
    gl.uniform3f(uniform('uBg'), 0.015, 0.02, 0.03);
    gl.uniform1f(uniform('uLineage'), 1); gl.uniform1f(uniform('uGlow'), 0.5); gl.uniform1f(uniform('uBump'), 6);
    gl.viewport(0, 0, size, size);
    window.setMaterialTilt = (x, y) => gl.uniform2f(uniform('uTilt'), x, y);
    window.renderMaterial = (material, time, background = [0.015, 0.02, 0.03]) => {
      gl.uniform3fv(uniform('uBg'), background);
      gl.uniform1i(uniform('uMat'), material); gl.uniform1f(uniform('uTime'), time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const pixels = new Uint8Array(size * size * 4);
      gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL draw/readback failed.');
      return pixels;
    };
    window.measureMaterial = (material, time) => {
      const pixels = window.renderMaterial(material, time);
      const counts = { foreground: 0, hot: 0, dark: 0, blue: 0, yellow: 0, bright: 0, far: 0, farLit: 0 };
      const blobs = domes.map(() => ({ pixels: 0, colored: 0 }));
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const fx = (x + 0.5) * side / size, fy = (y + 0.5) * side / size;
        const i = (y * size + x) * 4, [r, g, b] = pixels.slice(i, i + 3);
        const blue = b > 80 && b > r * 1.35;
        const yellow = r > 100 && g > 70 && b < Math.min(r, g) * 0.8;
        if (concentration(fx, fy) > 0.12) {
          counts.foreground++;
          if (r > 150 && g > 40 && r > g * 1.2 && g > b * 1.4) counts.hot++;
          if (Math.max(r, g, b) < 65) counts.dark++;
          if (blue) counts.blue++;
          if (yellow) counts.yellow++;
          if (Math.max(r, g, b) > 140) counts.bright++;
          const bi = domes.findIndex(([cx, cy, radius]) => (fx - cx) ** 2 + (fy - cy) ** 2 < radius ** 2);
          if (bi >= 0) { blobs[bi].pixels++; if (blue || yellow) blobs[bi].colored++; }
        }
        const far = plateau ? fx < 13 || fx > 115 || fy < 13 || fy > 115
          : domes.every(([cx, cy, radius]) => Math.hypot(fx - cx, fy - cy) > radius + 5);
        if (far) {
          counts.far++; if (Math.max(Math.abs(r - 4), Math.abs(g - 5), Math.abs(b - 8)) > 3) counts.farLit++;
        }
      }
      return { ...counts, blobs, hotFraction: counts.hot / counts.foreground, darkFraction: counts.dark / counts.foreground,
        blueFraction: counts.blue / counts.foreground, yellowFraction: counts.yellow / counts.foreground,
        brightFraction: counts.bright / counts.foreground, farLitFraction: counts.farLit / counts.far };
    };
    window.materialDifference = (material, a, b) => {
      const first = window.renderMaterial(material, a), second = window.renderMaterial(material, b);
      let total = 0;
      for (let i = 0; i < first.length; i += 4) for (let c = 0; c < 3; c++) total += Math.abs(first[i + c] - second[i + c]);
      return total / (size * size * 3);
    };
  }, { shader, size, plateau, shellTextures, amberTexture });
  return page;
}

for (const size of [256, 512]) {
  test(`Lava contrasts glowing warm turbulence with dark pockets at ${size}px`, async t => {
    const page = await fixture(t, size);
    const m = await page.evaluate(() => window.measureMaterial(7, 4.25));
    await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-lava-${size}.png`) });
    console.log('lava', size, JSON.stringify(m));
    assert.ok(m.foreground > size * size * 0.05, 'fixture must contain visible domes');
    assert.ok(m.hotFraction > 0.015, 'orange/gold molten regions remain hot even with cool lineage colors');
    assert.ok(m.darkFraction > 0.10, 'visible dark pockets give the turbulent molten surface contrast');
    assert.ok(m.farLitFraction < 0.001, 'lava remains localized to blobs rather than sending flames across empty space');
  });

  test(`Voronesque Gem has multicolored reflective cells on small and large domes at ${size}px`, async t => {
    const page = await fixture(t, size);
    const m = await page.evaluate(() => {
      const pixels = window.renderMaterial(9, 4.25), hues = [0, 0, 0];
      for (let i = 0; i < pixels.length; i += 4) {
        const c = pixels.slice(i, i + 3);
        for (let k = 0; k < 3; k++) if (c[k] > 80 && c[k] > Math.max(c[(k + 1) % 3], c[(k + 2) % 3]) * 1.15) hues[k]++;
      }
      return { ...window.measureMaterial(9, 4.25), hues };
    });
    await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-voronesque-gem-${size}.png`) });
    console.log('voronesque gem', size, JSON.stringify(m));
    assert.ok(m.hues.filter(n => n / m.foreground > .01).length >= 3, 'red, green and blue reflections survive the cool pigment palette');
    assert.ok(m.brightFraction > .02 && m.brightFraction < .95, 'the surface has reflections and shaded cells');
    assert.ok(m.blobs.every(b => b.colored / b.pixels > .01), 'each dome carries colored reflections');
    assert.ok(m.farLitFraction < .001, 'the reflective material stays on the blobs');
  });
}

test('Lava visibly flows without abrupt temporal jumps', async t => {
  const page = await fixture(t, 256);
  const movement = await page.evaluate(() => ({
    shortStep: window.materialDifference(7, 4.2499, 4.2501),
    animation: window.materialDifference(7, 4.25, 4.75)
  }));
  console.log('lava motion', JSON.stringify(movement));
  assert.ok(movement.animation > 0.05, 'molten turbulence visibly evolves over half a second');
  assert.ok(movement.shortStep < 0.15 && movement.shortStep < movement.animation * 0.02 + 0.01,
    'a tiny time step must produce a small change instead of a whole-surface flash');
});

test('Lava retains hot and dark detail across a broad flat surface', async t => {
  const page = await fixture(t, 512, true);
  const m = await page.evaluate(() => window.measureMaterial(7, 4.25));
  await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-lava-flat-512.png`) });
  console.log('lava flat surface', JSON.stringify(m));
  assert.ok(m.foreground > 512 * 512 * 0.4, 'fixture must exercise a broad surface with a flat interior');
  assert.ok(m.hotFraction > 0.015 && m.darkFraction > 0.10, 'flat interiors retain both molten regions and dark pockets');
  assert.ok(m.farLitFraction < 0.001, 'surface turbulence leaves the distant background clean');
});

test('Voronesque Gem cells move smoothly and retain detail on a flat surface', async t => {
  const page = await fixture(t, 512, true);
  const m = await page.evaluate(() => ({
    ...window.measureMaterial(9, 4.25),
    short: window.materialDifference(9, 4.25, 4.2501),
    motion: window.materialDifference(9, 4.25, 4.75)
  }));
  await page.evaluate(() => window.renderMaterial(9, 4.25));
  await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-voronesque-gem-flat-512.png`) });
  console.log('voronesque flat surface', JSON.stringify(m));
  assert.ok(m.foreground > 512 * 512 * .4, 'fixture exercises a broad flat interior');
  assert.ok(m.brightFraction > .02 && m.brightFraction < .95, 'reflections keep contrast on flat surfaces');
  assert.ok(m.motion > .05 && m.short < .15, 'the sculpted cells move without whole-frame flashes');
  assert.ok(m.farLitFraction < .001, 'the distant background remains clear');
});

test('A saved Fire material preference restores the replacement Lava material', async t => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  t.after(() => page.close());
  const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8')
    .replace(/<link[^>]*>/g, '')
    .replace('  // ---- go ----', 'window.materialAudit = { state, getGL: () => gl };\n  // ---- go ----');
  await page.route('https://**/*', route => route.abort());
  await page.route('http://garden.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.addInitScript(() => localStorage.setItem('garden.material', 'Fire'));
  await page.goto('http://garden.test/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { window.materialAudit.state.paused = true; });
  assert.equal(await page.evaluate(() => window.materialAudit.getGL() instanceof WebGL2RenderingContext), true);
  assert.equal(await page.locator('#mats button[aria-pressed="true"]').textContent(), 'Lava');
});

test('Black Opal retains its dark body with localized multicolored fire', async t => {
  const page = await fixture(t, 512);
  const result = await page.evaluate(() => {
    function measure(id) {
      const pixels = window.renderMaterial(id, 4.25);
      let total = 0, sum = 0, dark = 0, fire = 0;
      const hues = [0, 0, 0];
      // Only the inner portions of the four independently defined test domes.
      const domes = [[25, 26, 7], [82, 28, 12], [30, 84, 11], [92, 91, 6]];
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        if (!domes.some(([cx, cy, r]) => ((x + .5) / 4 - cx) ** 2 + ((y + .5) / 4 - cy) ** 2 < r * r)) continue;
        const i = (y * 512 + x) * 4, rgb = Array.from(pixels.slice(i, i + 3));
        const hi = Math.max(...rgb), lo = Math.min(...rgb);
        sum += rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; total++;
        if (hi < 75) dark++;
        if (hi - lo > 30 && hi > 80) { fire++; hues[rgb.indexOf(hi)]++; }
      }
      return { mean: sum / total, dark: dark / total, fire: fire / total, hues: hues.map(n => n / total),
        outside: window.measureMaterial(id, 4.25).farLitFraction };
    }
    return { black: measure(13) };
  });
  for (const [name, id] of [['black', 13]]) {
    await page.evaluate(id => window.renderMaterial(id, 4.25), id);
    await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-${name}-opal-512.png`) });
  }
  console.log('opal bodies', JSON.stringify(result));
  assert.ok(result.black.dark > .20, 'black opal retains visible charcoal potch between flashes');
  for (const m of [result.black]) {
    assert.ok(m.fire > .04 && m.fire < .8, 'color patches share the stone with its body color');
    assert.ok(m.hues.every(n => n > .002), 'red, green and blue flashes are present');
    assert.ok(m.outside < .001, 'fire is inside the stones, with no grid or colored glow on the floor');
  }
});

test('Black Opal responds smoothly to lighting without clock-driven color cycling', async t => {
  const page = await fixture(t, 512);
  const result = await page.evaluate(() => {
    const compare = (a, b) => {
      let sum = 0;
      for (let i = 0; i < a.length; i++) if (i % 4 !== 3) sum += Math.abs(a[i] - b[i]);
      return sum / (512 * 512 * 3);
    };
    return [13].map(id => {
      const still = window.renderMaterial(id, 4.25);
      const later = window.renderMaterial(id, 40);
      window.setMaterialTilt(.0001, 0);
      const small = window.renderMaterial(id, 4.25);
      window.setMaterialTilt(.65, -.25);
      const moved = window.renderMaterial(id, 4.25);
      window.setMaterialTilt(0, 0);
      return { id, clock: compare(still, later), small: compare(still, small), moved: compare(still, moved) };
    });
  });
  console.log('opal lighting', JSON.stringify(result));
  for (const m of result) {
    assert.equal(m.clock, 0, 'the internal pattern is fixed under fixed lighting');
    assert.ok(m.moved > .2, 'moving the light changes visible play-of-color');
    assert.ok(m.small < .1, 'small light motion cannot cause whole-stone flashing');
  }
});

test('Studio materials persist, work offline, migrate old choices, and restore after context loss', async t => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8')
    .replace(/<link[^>]*>/g, '')
    .replace('  // ---- go ----', 'window.materialAudit = { state, render, getGL: () => gl, ready: () => materialTexturesReady };\n  // ---- go ----');
  const remoteTextures = [];
  page.on('request', request => { if (request.url().includes('shadertoy.com')) remoteTextures.push(request.url()); });
  await page.route('https://**/*', route => route.abort());
  await page.route('http://garden.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.addInitScript(() => {
    if (!localStorage.getItem('garden.material')) localStorage.setItem('garden.material', 'Gemstone');
  });
  await page.goto('http://garden.test/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="look"]').click();
  assert.equal(await page.getByRole('button', { name: 'Gemstone', exact: true }).count(), 0);
  assert.equal(await page.locator('#mats [aria-pressed="true"]').textContent(), 'Black Opal');
  for (const [old, replacement] of [['White Opal', 'Crystal Shell'], ['Opal Shift', 'Crystal Shell'], ['Electricity', 'Voronesque Gem']]) {
    await page.evaluate(old => localStorage.setItem('garden.material', old), old);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-tab="look"]').click();
    assert.equal(await page.locator('#mats [aria-pressed="true"]').textContent(), replacement);
    assert.equal(await page.getByRole('button', { name: old, exact: true }).count(), 0);
  }
  for (const name of ['Crystal Shell', 'Gold Ripple', 'Black Opal', 'Amber Flow', 'Voronesque Gem']) {
    const choice = page.getByRole('button', { name, exact: true });
    await choice.click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-tab="look"]').click();
    assert.equal(await choice.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.materialAudit.ready()), true, 'embedded textures decode offline');
    const modes = await page.evaluate(() => {
      const a = window.materialAudit, gl = a.getGL();
      if (!gl) throw new Error('Materials require working WebGL2');
      a.state.paused = true;
      return Array.from(document.querySelectorAll('[data-light]'), button => {
        button.click(); a.render();
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return { mode: button.dataset.light, error: gl.getError(), visible: pixels.some((v, i) => i % 4 !== 3 && v > 0) };
      });
    });
    assert.ok(modes.length >= 4);
    assert.ok(modes.every(mode => mode.error === 0 && mode.visible), JSON.stringify(modes));
  }
  for (const name of ['Crystal Shell', 'Amber Flow', 'Voronesque Gem']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.evaluate(() => {
      const audit = window.materialAudit, extension = audit.getGL().getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('Context-loss test requires WEBGL_lose_context');
      audit.oldReady = audit.ready();
      extension.loseContext();
      setTimeout(() => extension.restoreContext(), 100);
    });
    await page.waitForFunction(() => window.materialAudit.ready() !== window.materialAudit.oldReady);
    assert.equal(await page.evaluate(() => window.materialAudit.ready()), true, 'restored context gets fresh textures');
    assert.equal(await page.evaluate(() => { materialAudit.render(); return materialAudit.getGL().getError(); }), 0);
  }
  assert.deepEqual(remoteTextures, [], 'material assets are embedded, never fetched from Shadertoy at runtime');
  assert.deepEqual(errors, []);
});

for (const size of [256, 512]) {
  test(`Gold Ripple has moving gold reflections confined to the blobs at ${size}px`, async t => {
    const page = await fixture(t, size);
    const m = await page.evaluate(() => window.measureMaterial(15, 4.25));
    await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-gold-ripple-${size}.png`) });
    const movement = await page.evaluate(() => ({
      short: window.materialDifference(15, 4.25, 4.2501),
      flowing: window.materialDifference(15, 4.25, 4.75)
    }));
    console.log('gold ripple', size, JSON.stringify({ ...m, movement }));
    assert.ok(m.yellowFraction > .20, 'gold remains warm even with a cool pigment palette');
    assert.ok(m.blobs.every(b => b.colored / b.pixels > .10), 'large and small blobs both carry gold');
    assert.ok(m.farLitFraction < .001, 'gold does not cover the empty dish');
    assert.ok(movement.flowing > .05 && movement.short < .15, 'ripples evolve smoothly over time');
  });
}

test('Crystal Shell exposes green interiors through purple reflective shells and moves smoothly', async t => {
  const page = await fixture(t, 512);
  const m = await page.evaluate(() => {
    const pixels = window.renderMaterial(14, 4.25);
    let purple = 0, green = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b] = pixels.slice(i, i + 3);
      if (r > 40 && b > 40 && Math.min(r, b) > g * 1.12) purple++;
      if (g > 40 && g > Math.max(r, b) * 1.12) green++;
    }
    return { ...window.measureMaterial(14, 4.25), purple, green,
      short: window.materialDifference(14, 4.25, 4.2501), motion: window.materialDifference(14, 4.25, 4.75) };
  });
  await page.evaluate(() => window.renderMaterial(14, 4.25));
  await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-crystal-shell-512.png`) });
  console.log('crystal shell', JSON.stringify(m));
  assert.ok(m.purple / m.foreground > .04 && m.green / m.foreground > .04, 'both original layer colors are visible');
  assert.ok(m.brightFraction > .02 && m.brightFraction < .90, 'reflections retain shaded recesses');
  assert.ok(m.farLitFraction < .001, 'the shell stays on the garden blobs');
  assert.ok(m.motion > .05 && m.short < .15, 'the displaced layers move continuously');
});

for (const size of [256, 512]) {
  test(`Amber Flow has warm moving glass with localized reflections at ${size}px`, async t => {
    const page = await fixture(t, size);
    const m = await page.evaluate(() => {
      const pixels = window.renderMaterial(16, 4.25);
      let warm = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b] = pixels.slice(i, i + 3);
        if (r > 60 && r > g * 1.12 && r > b * 1.15) warm++;
      }
      return { ...window.measureMaterial(16, 4.25), warm,
        short: window.materialDifference(16, 4.25, 4.2501), motion: window.materialDifference(16, 4.25, 4.75) };
    });
    await page.evaluate(() => window.renderMaterial(16, 4.25));
    await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-amber-flow-${size}.png`) });
    console.log('amber flow', size, JSON.stringify(m));
    assert.ok(m.warm / m.foreground > .05, 'the original texture produces amber tones despite the cool pigment palette');
    assert.ok(m.brightFraction > .02 && m.brightFraction < .90, 'glass retains both reflection and shadow');
    assert.ok(m.farLitFraction < .001, 'the texture remains on the blobs');
    assert.ok(m.motion > .05 && m.short < .15, 'the texture flow evolves continuously');
  });
}

test('The assembled garden offers Lava and Voronesque Gem as working WebGL materials', async t => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8')
    .replace(/<link[^>]*>/g, '')
    .replace('  // ---- go ----', 'window.materialAudit = { state, getGL: () => gl };\n  // ---- go ----');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { window.materialAudit.state.paused = true; });
  assert.equal(await page.evaluate(() => window.materialAudit.getGL() instanceof WebGL2RenderingContext), true,
    'the actual garden must initialize WebGL rather than silently falling back');
  assert.equal(await page.locator('#mats button').filter({ hasText: /^Lava$/ }).count(), 1);
  assert.equal(await page.locator('#mats button').filter({ hasText: /^Fire$/ }).count(), 0);
  for (const name of ['Lava', 'Voronesque Gem']) {
    await page.locator('#mats button').filter({ hasText: new RegExp('^' + name + '$') }).evaluate(button => button.click());
    assert.equal(await page.locator('#mats button[aria-pressed="true"]').textContent(), name);
  }
  assert.deepEqual(errors, []);
});
