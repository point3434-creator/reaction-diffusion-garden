// Open the page headlessly, pick a chemistry, preset and material, let it run, and save a screenshot.
// npm install && node tools/screenshot.js [chemistry] [preset] [material] [theme] [width] [height] [seconds] [size]
//   e.g. node tools/screenshot.js garden Spots Contour dark 1280 800 8 small
// Software WebGL is slow (a few frames a second), so the dish evolves less than it would live.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const [chem = 'garden', preset = 'Coral', material = 'Glass', theme = 'dark', width = '1000', height = '640', seconds = '6', sizeArg = 'large'] = process.argv.slice(2);
const size = sizeArg === 'fill' ? 'large' : sizeArg;   // Fill, from when Size shrank the dish, was the full-size pattern
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: +width, height: +height }, colorScheme: theme })).newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'web', 'index.html'));
  await page.waitForTimeout(500);
  const chip = { garden: 'Garden', heart: 'Heart', quantum: 'Quantum', mould: 'Mould' }[chem];
  if (chip && chip !== 'Garden') await page.getByRole('button', { name: chip, exact: true }).click();
  await page.getByRole('button', { name: preset, exact: true }).click();
  await page.getByRole('tab', { name: 'Look' }).click();
  await page.getByRole('button', { name: material, exact: true }).click();
  if (size !== 'large') await page.getByRole('button', { name: size[0].toUpperCase() + size.slice(1), exact: true }).click();
  await page.getByRole('tab', { name: 'Dish' }).click();
  await page.waitForTimeout(+seconds * 1000);
  const file = path.join(OUT, `${chem}-${preset}-${material}-${theme}${size === 'large' ? '' : '-' + size}.png`.replace(/\s+/g, '-').toLowerCase());
  await page.screenshot({ path: file });
  console.log('saved', path.relative(process.cwd(), file));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
