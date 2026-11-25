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

test('a recovery export keeps the last trusted label after sign-out, without recording identity', () => {
  const f = fixture({ [carbon]:'{"rows":[4,2]}' });
  let identity = { name:'First Learner', period:'2', private:'omit' };
  const get = S.reportIdentity(f.open(C, [carbon]), [carbon], () => identity);
  assert.deepEqual(get(), { name:'First Learner', period:'2' });
  identity = { name:'First Learner', period:'3' };
  assert.equal(get().period, '3', 'an intact editor can pick up a class correction');
  f.erase(null, [carbon]);
  identity = { name:'Next Learner', period:'5' };
  assert.deepEqual(get(), { name:'First Learner', period:'3' });
  const isolated = get(); isolated.name = 'Changed copy';
  assert.equal(get().name, 'First Learner', 'export cannot mutate the remembered label');
  assert.equal(f.data.has(carbon), false);
  assert.ok([...f.data.values()].every(v => !v.includes('Learner')));
});

test('anonymous recovery stays unassigned if only a related activity record changed', () => {
  const f = fixture();
  let identity = null;
  const get = S.reportIdentity(f.open(C, [carbon, budget]), [carbon, budget], () => identity);
  const nextEditor = f.open(C, [budget]);
  nextEditor.write(budget, '{"trial":7}');
  identity = { name:'Different Student', period:'6' };
  assert.equal(get(), null);
  f.storage.removeItem(budget);
  assert.equal(get(), null, 'a conflict does not disappear if a record happens to match again');
});

test('an epoch that changes during the identity lookup cannot relabel the old work', () => {
  const f = fixture({ [carbon]:'{"rows":[2]}' });
  let changed = false;
  const get = S.reportIdentity(f.open(C, [carbon]), [carbon], () => {
    if (!changed) return {name:'Original',period:'1'};
    f.erase(null, [carbon]);
    return {name:'New Name',period:'8'};
  });
  changed = true;
  assert.deepEqual(get(), {name:'Original',period:'1'});
});

test('a forced recovery uses the captured label without trusting a changed identity', () => {
  const f = fixture();
  let identity = {name:'Current',period:'1'};
  const get = S.reportIdentity(f.open(D, [dna]), [dna], () => identity);
  identity = {name:'Elsewhere',period:'3'};
  assert.equal(get(true).name, 'Current');
  assert.equal(get().name, 'Elsewhere', 'forced recovery does not mark an intact session permanently stale');
  assert.equal(S.reportIdentity(null, [dna], () => identity)(), null);
});

test('a scoped reset rejects unrelated work before creating any reset marker', () => {
  const f = fixture({ [carbon]:'journey work', [budget]:'budget work', [dna]:'DNA work' });
  const writer = f.open(D, [dna]);
  assert.deepEqual(f.erase(C, [budget, dna]), { ok:false, reason:'changed' });
  assert.equal(f.storage.getItem(S.scopeKey(C)), null);
  assert.equal(f.storage.getItem(carbon), 'journey work');
  assert.equal(f.storage.getItem(budget), 'budget work');
  assert.equal(f.storage.getItem(dna), 'DNA work');
  assert.deepEqual(writer.write(dna, 'updated DNA work'), { ok:true });
});

test('a failed write in one notebook cannot erase another activity or redraw its dataset', () => {
  const hybrid = 'aplab:openscied:b5-hybrid:v1';
  const raw = '{"v":1,"id":"00AB1234","rolls":40,"answers":{"claim":"saved claim"}}';
  const f = fixture({ [hybrid]:raw, [dna]:'{"complete":true}' });
  const writer = f.open('b5-hybrid',[hybrid]);
  f.deny(hybrid);
  assert.equal(writer.write(hybrid,raw).ok,true,'unchanged state needs no disk write');
  assert.deepEqual(writer.write(hybrid,'{"attempt":"new answer"}'),{ok:false,reason:'unavailable'});
  assert.equal(f.storage.getItem(S.globalKey),null);
  assert.equal(f.open('b5-hybrid',[hybrid]).read(hybrid),raw);
  assert.equal(f.open(D,[dna]).read(dna),'{"complete":true}');
  assert.equal(fixture().open('b5-hybrid',[hybrid]).read(hybrid),null,'a separate profile does not share saved work');
});
