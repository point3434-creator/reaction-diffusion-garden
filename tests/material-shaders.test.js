'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const shader = fs.readFileSync(path.join(root, 'src/frag.glsl'), 'utf8');
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
  await page.evaluate(({ shader, size, plateau }) => {
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
    gl.uniform2f(uniform('uTexSize'), side, side);
    gl.uniform3f(uniform('uBg'), 0.015, 0.02, 0.03);
    gl.uniform1f(uniform('uLineage'), 1); gl.uniform1f(uniform('uGlow'), 0.5); gl.uniform1f(uniform('uBump'), 6);
    gl.viewport(0, 0, size, size);
    window.renderMaterial = (material, time) => {
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
  }, { shader, size, plateau });
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

  test(`Electricity has narrow blue/yellow filaments on every blob at ${size}px`, async t => {
    const page = await fixture(t, size);
    const m = await page.evaluate(() => window.measureMaterial(9, 4.25));
    await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-electricity-${size}.png`) });
    console.log('electricity', size, JSON.stringify(m));
    assert.ok(m.blueFraction > 0.003, 'blue filaments are visible');
    assert.ok(m.yellowFraction > 0.003, 'yellow filaments are visible');
    assert.ok(m.brightFraction > 0.005 && m.brightFraction < 0.4, 'bright cores occupy a minority of the surface');
    assert.ok(m.blobs.every(b => b.colored / b.pixels > 0.005), 'small and large blobs each carry electric filaments');
    assert.ok(m.farLitFraction < 0.001, 'filaments do not cross distant empty background');
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

test('Electricity moves continuously across the former 20 Hz strobe boundary', async t => {
  const page = await fixture(t, 256);
  const movement = await page.evaluate(() => ({
    boundary: window.materialDifference(9, 4.2499, 4.2501),
    nearby: window.materialDifference(9, 4.2501, 4.2503),
    animation: window.materialDifference(9, 4.25, 4.75)
  }));
  console.log('electricity motion', JSON.stringify(movement));
  assert.ok(movement.animation > 0.05, 'filaments visibly travel over time');
  assert.ok(movement.boundary < 0.15 && movement.boundary < movement.nearby * 5 + 0.02,
    'crossing a former strobe boundary cannot abruptly change the whole effect');
});

test('Electric filaments stay narrow across a broad flat surface', async t => {
  const page = await fixture(t, 512, true);
  const m = await page.evaluate(() => window.measureMaterial(9, 4.25));
  await page.locator('canvas').screenshot({ path: path.join(artifacts, `${snapshot}-electricity-flat-512.png`) });
  console.log('electricity flat surface', JSON.stringify(m));
  assert.ok(m.foreground > 512 * 512 * 0.4, 'fixture must exercise a broad surface with a flat interior');
  assert.ok(m.blueFraction > 0.003 && m.yellowFraction > 0.003, 'both filament colors survive flat normals');
  assert.ok(m.brightFraction > 0.005 && m.brightFraction < 0.4, 'electricity must not fill the entire flat surface');
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

test('The assembled garden offers Lava and Electricity as working WebGL materials', async t => {
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
  for (const name of ['Lava', 'Electricity']) {
    await page.locator('#mats button').filter({ hasText: new RegExp('^' + name + '$') }).evaluate(button => button.click());
    assert.equal(await page.locator('#mats button[aria-pressed="true"]').textContent(), name);
  }
  assert.deepEqual(errors, []);
});
