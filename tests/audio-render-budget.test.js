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
