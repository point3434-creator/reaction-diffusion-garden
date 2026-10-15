'use strict';
const assert = require('node:assert/strict');
const { createCurrent, currentField, bilerpWrap } = require('../src/current.js');
let tests = 0;
function test(name, fn) { fn(); tests++; console.log('PASS ' + name); }
test('current field uses no external constants', () => {
  for (const [x,y] of [[0,0],[5,8],[16,12]]) {
    assert.ok(currentField(x,y,16,12,1,.65).every(Number.isFinite));
  }
});
test('wrapping and bilinear interpolation', () => {
  const a = new Float32Array([0,1,2,3]);
  assert.equal(bilerpWrap(a,0,0,2,2), 0);
  assert.equal(bilerpWrap(a,2,0,2,2), 0);
  assert.equal(bilerpWrap(a,.5,.5,2,2), 1.5);
  assert.equal(bilerpWrap(a,-1,-1,2,2), 3);
});
test('empty dish remains empty', () => {
  const s = createCurrent(32,24);
  s.step(.0367,.0649,10,.85,.65);
  assert.ok(s.A.every(x => x === 1));
  assert.ok(s.R.every(x => x === 0));
});
test('painted current evolves and stays finite and bounded', () => {
  const s = createCurrent(32,24);
  s.paint(10,12,3,false,[.7,.2,.1]);
  const before = Array.from(s.R);
  for (let i=0;i<100;i++) s.step(.0367,.0649,3,.85,.65);
  for (const k of ['A','R','G','Bl']) assert.ok(s[k].every(x => Number.isFinite(x) && x>=0 && x<=1));
  assert.notDeepEqual(Array.from(s.R),before);
});
test('total B stays bounded when several pigments grow together', () => {
  const s = createCurrent(32,24);
  s.paint(16,12,6,false,[1/3,1/3,1/3]);
  for (let step=0;step<20;step++) {
    s.step(.0367,.0649,1,.85,.65);
    for (let i=0;i<s.A.length;i++) {
      const b = s.R[i]+s.G[i]+s.Bl[i];
      assert.ok(Number.isFinite(b) && b>=0 && b<=1+1e-6, `total B=${b} at cell ${i}, step ${step}`);
    }
  }
});
test('pigment decomposition does not change the chemistry', () => {
  for (const flow of [0,.85]) {
    const red = createCurrent(32,24), yellow = createCurrent(32,24);
    red.paint(16,12,6,false,[1/1.2,.1/1.2,.1/1.2]);
    yellow.paint(16,12,6,false,[1/2.1,1/2.1,.1/2.1]);
    for (let step=0;step<10;step++) {
      red.step(.0367,.0649,1,flow,.65); yellow.step(.0367,.0649,1,flow,.65);
      for (let i=0;i<red.A.length;i++) {
        const redB = red.R[i]+red.G[i]+red.Bl[i], yellowB = yellow.R[i]+yellow.G[i]+yellow.Bl[i];
        assert.ok(Math.abs(red.A[i]-yellow.A[i]) < 1e-5, `A depends on pigment at cell ${i}, step ${step}`);
        assert.ok(Math.abs(redB-yellowB) < 1e-5, `B depends on pigment at cell ${i}, step ${step}`);
      }
    }
  }
});
test('flow strength changes actual chemical fields', () => {
  const a=createCurrent(32,24), b=createCurrent(32,24);
  for (const s of [a,b]) s.paint(10,12,3,false,[.7,.2,.1]);
  a.step(.0367,.0649,12,0,.65); b.step(.0367,.0649,12,1,.65);
  assert.notDeepEqual(Array.from(a.R),Array.from(b.R));
});
test('resize preserves type, time and data', () => {
  const s=createCurrent(32,24); s.paint(10,12,3,false,[1,0,0]); s.step(.0367,.0649,4,.85,.65);
  const r=s.resample(40,30);
  assert.equal(r.kind,'current'); assert.equal(r.time,s.time); assert.equal(r.A.length,1200);
  assert.ok(r.R.some(x => x>0)); r.step(.0367,.0649,1,.85,.65);
  assert.ok(r.A.every(Number.isFinite));
});
test('clear resets fields and flow clock', () => {
  const s=createCurrent(32,24);s.paint(2,3,2,false,[1,0,0]);s.step(.0367,.0649,2,2,1.8);s.clear();
  assert.equal(s.time,0);assert.ok(s.A.every(x=>x===1));assert.ok(s.R.every(x=>x===0));
});
console.log(`${tests} Current tests passed`);
