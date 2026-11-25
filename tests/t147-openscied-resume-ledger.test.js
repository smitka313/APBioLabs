'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const resume = require('../openscied-resume.js');
const guard = require('../openscied-save-session.js');
function fixture() {
  const entries=new Map();
  const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,String(v)),removeItem:k=>entries.delete(k)};
  let now=100;
  return {storage,entries,clock:()=>now,at:value=>{now=value;}};
}
const migration='/openscied-b1-migration.html', journey='/openscied-b2-carbon-journey.html';
const m='aplab:openscied:b1-migration:v1', j='aplab:openscied:b2-carbon-journey:v1';
test('dashboard is read-only and independent activity visits update independent metadata keys',()=>{
  const f=fixture(), a=resume.connect(f.storage,f.clock,{scope:'b1-migration'}),
    b=resume.connect(f.storage,f.clock,{scope:'b2-carbon-journey'}),
    dashboard=resume.connect(f.storage,f.clock);
  f.storage.setItem(m,JSON.stringify({answers:{claim:'mine'},lastVisitedAt:90}));
  f.storage.setItem(j,JSON.stringify({answers:{claim:'the carbon cycle'},lastVisitedAt:95}));
  const before=[...f.entries];
  assert.equal(dashboard.snapshot(migration).changed,90);
  assert.equal(dashboard.snapshot(journey).changed,95);
  assert.deepEqual([...f.entries],before,'reading dashboard cards writes no bookkeeping');
  a.snapshot(migration,'open');f.at(105);b.snapshot(journey,'open');
  f.at(120);f.storage.setItem(m,JSON.stringify({answers:{claim:'mine'},lastVisitedAt:120,step:'explain'}));
  a.snapshot(migration,'exit');
  assert.equal(dashboard.snapshot(migration).changed,90,'switching views does not beat newer saved work');
  assert.equal(dashboard.snapshot(journey).opened,105);
  assert.equal(f.entries.has(resume.META_KEY),false,'tabs never rewrite one shared ledger');
  assert.equal([...f.entries.keys()].filter(resume.isMetaKey).length,2);
});
test('an old activity cannot restore its timestamp after its scoped results were erased',()=>{
  const f=fixture(), a=resume.connect(f.storage,f.clock,{scope:'b1-migration'}),
    dashboard=resume.connect(f.storage,f.clock);
  f.storage.setItem(m,JSON.stringify({answers:{claim:'old'},lastVisitedAt:90}));
  a.snapshot(migration,'open');
  assert.equal(guard.erase(f.storage,'b1-migration',[m]).ok,true);
  f.at(200);f.storage.setItem(m,JSON.stringify({answers:{claim:'new'},lastVisitedAt:180}));
  assert.deepEqual(a.snapshot(migration,'exit'),{});
  assert.deepEqual(dashboard.snapshot(migration),{changed:180,opened:0,legacy:180});
});
