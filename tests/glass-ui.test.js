'use strict';
// UI regression suite. Run after tools/splice.py. The documented Canvas2D fallback
// isolates layout/input checks from slow software-GPU compilation in headless CI.
// This is not a GPU performance test or an audio-quality test.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(process.env.GARDEN_UI_PAGE || path.join(root, 'web/index.html'), 'utf8').replace(/<link[^>]*>/g, '');
const checks = fs.readFileSync(path.join(__dirname, 'ui-checks.js'), 'utf8');
const out = path.join(root, 'test-results/glass-ui');
fs.mkdirSync(out, { recursive:true });
(async () => {
  const options = {headless:true, args:['--no-sandbox','--disable-dev-shm-usage']};
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options);
  let assertions = 0;
  const results = [];
  try {
    for (const theme of ['dark', 'light']) for (const [width,height] of [[1440,1000],[2560,1440],[390,844],[320,680],[844,390]]) {
      const page = await browser.newPage({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce'});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.evaluate(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type,...args) {
          return /^(webgl2?|experimental-webgl)$/.test(type) ? null : original.call(this,type,...args);
        };
      });
      await page.setContent(html, {waitUntil:'domcontentloaded', timeout:20000});
      await page.evaluate(() => {
        const pause = document.getElementById('pause');
        if (pause && pause.getAttribute('aria-pressed') !== 'true') pause.click();
        document.getElementById('panel').classList.add('open');
      });
      const evaluated = await page.evaluate('(' + checks + ')()');
      for (const c of evaluated) { assert.ok(c.pass, `${theme} ${width}: ${c.name}: ${c.detail}`); assertions++; }
      for (const name of ['look','sound','why','dish']) {
        await page.locator(`[data-tab="${name}"]`).click();
        assert.ok(await page.locator(`[data-pane="${name}"]`).isVisible(), name + ' pane'); assertions++;
      }
      const current = page.locator('[data-chem="current"]');
      if (await current.count()) {
        await current.click();
        assert.ok(await page.locator('#flowWrap').isVisible(), 'Current controls visible'); assertions++;
        await page.locator('#flowStrength').evaluate(input => {input.value='1.2';input.dispatchEvent(new Event('input',{bubbles:true}));});
        assert.equal(await page.locator('#flowStrengthOut').textContent(),'1.20'); assertions++;
      }
      assert.deepEqual(errors, [], 'JavaScript errors'); assertions++;
      await page.screenshot({path:path.join(out,`${theme}-${width}.png`)});
      results.push({theme,width,height,checks:evaluated,errors});
      // Focus hides the entire decorated panel, never leaves orphaned vines on the artwork.
      await page.evaluate(() => document.querySelector('.app').classList.add('focus'));
      assert.equal(await page.locator('#panel').isVisible(),false); assertions++;
      assert.equal(await page.locator('.panel-botany').first().isVisible(),false); assertions++;
      await page.close();
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({assertions,results},null,2));
    console.log(`${assertions} UI assertions passed across 10 viewport/theme combinations (Canvas2D fallback).`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
