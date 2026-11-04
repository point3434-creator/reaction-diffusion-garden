'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAudioRenderBudget } = require('../src/audio-render-budget.js');

test('normal playback keeps full resolution while sustained slow frames reduce rendering work', () => {
  const budget = createAudioRenderBudget();
  for (let i = 0; i < 300; i++) budget.sample(16.7, true);
  assert.equal(budget.scale, 1);
  budget.sample(120, true);
  assert.equal(budget.scale, 1, 'one transient must not blur the scene');
  for (let i = 0; i < 100; i++) budget.sample(80, true);
  assert.equal(budget.scale, 0.4);
  for (let i = 0; i < 700; i++) budget.sample(16.7, true);
  assert.ok(budget.scale > 0.4 && budget.scale <= 1, 'spare rendering capacity restores detail gradually');
  budget.sample(16.7, false);
  assert.equal(budget.scale, 1, 'stopping music restores the normal drawing budget');
});

test('background gaps and invalid timestamps do not change the rendering budget', () => {
  const budget = createAudioRenderBudget();
  for (const dt of [0, -10, NaN, Infinity, 5000]) budget.sample(dt, true);
  assert.equal(budget.scale, 1);
});

test('expensive scenes yield animation opportunities during playback instead of staying continuously busy', () => {
  const budget = createAudioRenderBudget();
  let rendered = 0;
  for (let frame = 0; frame < 60; frame++) {
    if (budget.shouldRender(true)) { rendered++; budget.didRender(24, true); }
  }
  assert.equal(rendered, 30, 'expensive CPU work must leave alternating animation opportunities free');
  assert.equal(budget.shouldRender(false), true, 'stopping audio must release a pending visual wait');
  budget.didRender(2, false);
  for (let frame = 0; frame < 60; frame++) {
    assert.equal(budget.shouldRender(true), true, 'fast scenes retain their normal animation cadence');
    budget.didRender(2, true);
  }
  for (let frame = 0; frame < 100; frame++) budget.sample(80, true);
  budget.didRender(2, true);
  assert.equal(budget.shouldRender(true), false, 'GPU pressure needs a pause even if command submission is quick');
  assert.equal(budget.shouldRender(true), true, 'the next opportunity resumes without a catch-up burst');
});
