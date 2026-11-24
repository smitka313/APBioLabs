'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../openscied-save-session.js');
const carbon = 'aplab:openscied:b2-carbon-journey:v1';
const budget = 'aplab:openscied:b2-carbon-journey:budget:v1';
const dna = 'aplab:openscied:b3-dna-workshop:v1';
const C = 'b2-carbon-journey';
const D = 'b3-dna-workshop';

function fixture(saved = {}) {
  const data = new Map(Object.entries(saved));
  let count = 0, block = '';
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem(key, raw) { if(key===block) throw Error('fictional denied write'); data.set(key, String(raw)); },
    removeItem: key => data.delete(key)
  };
  const stamp = () => 'fixture-' + ++count;
  return { data, storage, stamp, deny(key) { block = key; },
    open: (scope, keys) => S.open(storage, scope, keys, stamp),
    erase: (scope, keys) => S.erase(storage, scope, keys, stamp)
  };
}
test('dashboard global ERASE cannot be undone by either stale Carbon tab, even with no original save', () => {
  const f = fixture();
  const previouslyEmpty = f.open(C, [carbon]);
  assert.equal(previouslyEmpty.read(carbon), null);
  f.storage.setItem(carbon, '{"rows":[1]}');
  const older = f.open(C, [carbon]);
  f.storage.setItem(carbon, '{"rows":[1,2,3,4,5,6]}');
  const newer = f.open(C, [carbon]);
  assert.deepEqual(f.erase(null, [carbon]), { ok:true });
  assert.deepEqual(previouslyEmpty.write(carbon, '{}'), { ok:false, reason:'erased' });
  assert.deepEqual(older.write(carbon, older.read(carbon)), { ok:false, reason:'erased' });
  assert.deepEqual(newer.write(carbon, newer.read(carbon)), { ok:false, reason:'erased' });
  assert.equal(f.storage.getItem(carbon), null);
  assert.deepEqual(f.open(C, [carbon]).write(carbon, '{"fresh":true}'), { ok:true });
});
test('dashboard activity erase invalidates all its editors but leaves unrelated work and active tabs alone', () => {
  const f = fixture({ [carbon]:'older', [budget]:'older', [dna]:'older', 'aplab:student':'keep' });
  const journeyTab = f.open(C, [carbon,budget]);
  const dnaTab = f.open(D, [dna]);
  assert.deepEqual(f.erase(C, [carbon,budget]), { ok:true });
  assert.deepEqual(journeyTab.write(carbon, 'stale'), { ok:false, reason:'erased' });
  assert.deepEqual(journeyTab.write(budget, 'stale'), { ok:false, reason:'erased' });
  assert.equal(f.storage.getItem('aplab:student'), 'keep');
  assert.equal(f.storage.getItem(dna), 'older');
  assert.deepEqual(dnaTab.write(dna, 'new'), { ok:true });
});
test('ordinary cross-tab replacement cannot be overwritten by an older editor', () => {
  const f = fixture({ [dna]:'{"steps":1}' });
  const a = f.open(D, [dna]), b = f.open(D, [dna]);
  assert.deepEqual(b.write(dna, '{"steps":6}'), { ok:true });
  assert.deepEqual(a.write(dna, '{"steps":2}'), { ok:false, reason:'changed' });
  assert.equal(a.read(dna), '{"steps":1}');
  assert.equal(f.storage.getItem(dna), '{"steps":6}');
  assert.deepEqual(b.write(dna, '{"steps":6,"answer":"more"}'), { ok:true });
});
test('older non-guarded pages or browser deletion can still be observed before saving', () => {
  const f = fixture({ [dna]:'snapshot' });
  const a = f.open(D, [dna]);
  f.storage.removeItem(dna);
  assert.deepEqual(a.write(dna, 'stale'), { ok:false, reason:'erased' });
  assert.equal(f.storage.getItem(dna), null);
});
test('confirmed in-activity reset invalidates old editors for only the reset key', () => {
  const f = fixture({ [budget]:'original budget' });
  const active = f.open(C, [carbon,budget]);
  const older = f.open(C, [carbon,budget]);
  assert.deepEqual(active.reset(carbon, 'new seed'), { ok:true });
  assert.deepEqual(older.write(carbon, 'previously empty tab'), { ok:false, reason:'erased' });
  assert.deepEqual(older.write(budget, 'next budget step'), { ok:true });
  assert.deepEqual(active.write(carbon, 'first roll'), { ok:true });
  assert.equal(f.storage.getItem(carbon), 'first roll');
});
test('sign-out first invalidates even when no work keys exist; normal preferences survive', () => {
  const f = fixture({ 'aplab:pref:theme':'dark', 'aplab:student':'fictional' });
  const tab = f.open(D, [dna]);
  assert.deepEqual(S.invalidate(f.storage, null, f.stamp), { ok:true });
  f.storage.removeItem('aplab:student');
  assert.equal(f.storage.getItem('aplab:pref:theme'), 'dark');
  assert.equal(f.storage.getItem('aplab:student'), null);
  assert.deepEqual(tab.write(dna, 'stale'), { ok:false, reason:'erased' });
});
test('failed marker write does not erase the previous data', () => {
  const f = fixture({ [dna]:'keep' });
  f.deny(S.globalKey);
  assert.deepEqual(f.erase(null, [dna]), { ok:false, reason:'unavailable' });
  assert.equal(f.storage.getItem(dna), 'keep');
});
