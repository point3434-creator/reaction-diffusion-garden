'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname, '../src/pathtrace-state.js');

test('path tracing has a bounded render budget and scene-aware history', () => {
  assert.ok(fs.existsSync(source), 'path tracing state support is not implemented');
  const { pathTraceSize, createPathTraceHistory } = require(source);
  for (const [w, h] of [[3840, 2160], [390, 844], [1, 12000], [12000, 1], [640, 480]]) {
    for (const quality of ['preview', 'fine']) for (const moving of [false, true]) {
      const size = pathTraceSize(w, h, quality, moving);
      const budget = moving ? 98304 : quality === 'fine' ? 786432 : 262144;
      assert.ok(size.width >= 1 && size.height >= 1);
      assert.ok(size.width <= w && size.height <= h, 'never supersample beyond the display');
      assert.ok(size.width * size.height <= budget, 'respect the path tracing pixel budget');
      assert.ok(Number.isInteger(size.width) && Number.isInteger(size.height));
    }
  }
  const history = createPathTraceHistory();
  assert.equal(history.begin('scene A', false, false), true);
  history.commit(); history.commit();
  assert.equal(history.samples, 2);
  assert.equal(history.begin('scene A', false, false), false);
  assert.equal(history.samples, 2, 'static frames retain samples');
  assert.equal(history.begin('scene B', false, false), true);
  assert.equal(history.samples, 0, 'material, light or target changes discard old radiance');
  history.commit();
  assert.equal(history.begin('scene B', true, false), true);
  assert.equal(history.samples, 0, 'painting or simulation changes discard history');
  const seed = history.seed;
  history.commit();
  history.begin('scene B', false, true);
  assert.equal(history.samples, 0, 'moving frames never accumulate stale geometry');
  assert.notEqual(history.seed, seed, 'random seeds advance even when history is reset');
  for (let i = 0; i < 5000; i++) history.commit();
  assert.equal(history.samples, 4096, 'stop refining at the documented sample limit');
  history.reset();
  assert.equal(history.samples, 0);
  assert.equal(history.begin('scene B', false, false), true, 'reset invalidates the scene key');
});
