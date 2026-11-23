'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../carrying-logic.js');
const range = require('../carrying-range.js');
const trial = (grassPercent, rounds = 12) => model.run({grassPercent},rounds);
test('the estimate only uses the highlighted late rounds after a complete trial',()=>{
  assert.equal(range.dataset(trial(100,11)),null);
  const baseline = range.dataset(trial(100));
  assert.deepEqual(baseline.points.map(p=>[p.round,p.ending]),[[7,15],[8,7],[9,10],[10,15],[11,7],[12,10]]);
  assert.deepEqual(baseline.series[0],{round:0,ending:2});
  assert.equal(baseline.series.length,13);
});
test('the model accepts a small band around a typical level rather than the highest peak',()=>{
  const points = range.dataset(trial(100)).points;
  for (const x of [10,10.5,11,12]) assert.equal(range.judgeEstimate(points,x).code,'correct');
  for (const x of [7,9.5,12.5,15]) assert.equal(range.judgeEstimate(points,x).code,'incorrect');
  assert.equal(range.judgeEstimate(points,NaN),null);
});
test('the selected comparison determines its own center and feedback, rather than using baseline answers',()=>{
  const a = range.dataset(trial(75)).points, b = range.dataset(trial(50)).points;
  assert.equal(range.judgeEstimate(a,10.5).code,'correct');
  assert.equal(range.judgeEstimate(a,12).code,'incorrect');
  assert.equal(range.judgeEstimate(b,8).code,'correct');
  assert.equal(range.judgeEstimate(b,11).code,'incorrect');
  assert.equal(range.readRange(b,7,8).code,'supported');
  assert.equal(range.readRange(b,8,7).code,'reversed');
  assert.equal(range.readRange(b,8,8).code,'same-point');
});
test('a singular late spike is not the top of a repeating range',()=>{
  const pts=[7,9,7,9,30,8].map((ending,i)=>({round:i+7,ending}));
  assert.equal(range.judgeEstimate(pts,8).code,'correct');
  assert.equal(range.judgeEstimate(pts,30).code,'incorrect');
  assert.equal(range.readRange(pts,7,11).code,'recheck');
});
