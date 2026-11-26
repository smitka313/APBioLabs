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

test('new report-bearing classroom checks promote saved evidence but not visits',()=>{
  for(const [scope,base,extra] of [
    ['b3-screening',{seed:419,plan:{screen:'hub'}},{practice:{'1:mobile:mobile:mobile:none':1}}],
    ['b5-wapusk',{fields:{}},{scaleDraft:['park']}],
    ['b5-wapusk',{fields:{}},{scaleCheck:[]}],
    ['b4-hawksbeard',{prediction:'city'},{denominatorChoice:'soil'}],
    ['b4-rat-generations',{prediction:'same'},{analysisAttempt:'rats'}],
    ['b2-peat-bog-lab',{trials:[{}]},{fields:{'graph-answer':'A warming trend'}}]
  ]){
    const f=fixture(),path='/openscied-'+scope+'.html';
    const key='aplab:openscied:'+(scope==='b2-peat-bog-lab'?'b2-peat-bog':scope)+':v1';
    f.storage.setItem(key,JSON.stringify({...base,lastVisitedAt:95}));
    const editor=resume.connect(f.storage,f.clock,{scope}), dashboard=resume.connect(f.storage,f.clock);
    editor.snapshot(path,'open');
    f.at(120);
    f.storage.setItem(key,JSON.stringify({...base,...extra,lastVisitedAt:120}));
    editor.snapshot(path,'save');
    assert.equal(dashboard.snapshot(path).changed,120,scope);
    f.at(160);
    f.storage.setItem(key,JSON.stringify({...base,...extra,lastVisitedAt:160}));
    editor.snapshot(path,'exit');
    assert.equal(dashboard.snapshot(path).changed,120,scope+' does not promote another visit');
  }
});

test('after Start over, re-entering the exact same answer is a new save',()=>{
  const f=fixture(), editor=resume.connect(f.storage,f.clock,{scope:'b1-migration'}),
    dashboard=resume.connect(f.storage,f.clock), session=guard.open(f.storage,'b1-migration',[m],()=>String(f.clock()));
  const identical=JSON.stringify({notes:[{text:'A note'}]});
  editor.snapshot(migration,'open');
  globalThis.OpenSciEdResume={recordSave:()=>editor.snapshot(migration,'save')};
  try{
    f.at(110);assert.ok(session.write(m,identical).ok);
    assert.equal(dashboard.snapshot(migration).changed,110);
    f.at(120);assert.ok(session.reset(m).ok);
    assert.equal(dashboard.snapshot(migration).changed,0);
    f.at(130);assert.ok(session.write(m,identical).ok);
    assert.equal(dashboard.snapshot(migration).changed,130);
  }finally{delete globalThis.OpenSciEdResume;}
});

test('a late tracker cannot turn a view-only write into freshly saved evidence',()=>{
  const f=fixture(), path='/openscied-b1-migration', active=resume.connect(f.storage,f.clock,{scope:'b1-migration'});
  const prior=JSON.stringify({answers:{claim:'same work'},lastVisitedAt:90,page:'explore'});
  const raw=JSON.stringify({answers:{claim:'same work'},lastVisitedAt:250,page:'explain'});
  f.at(250);f.storage.setItem(m,raw);
  active.snapshot(path,'save',{key:m,previous:prior,raw,at:250,scope:'b1-migration',epoch:[null,null,null]});
  active.snapshot(path,'open');
  assert.equal(active.snapshot(path).changed,90);
  assert.equal(active.snapshot(path).opened,250);
});

test('the first meaningful edit made before tracker startup keeps its edit time',()=>{
  const f=fixture(), path='/openscied-b1-migration', editor=guard.open(f.storage,'b1-migration',[m]);
  const raw=JSON.stringify({answers:{claim:'new evidence'}});
  assert.equal(editor.write(m,raw).ok,true);
  const start=Date.now();f.at(start+200);
  const active=resume.connect(f.storage,f.clock,{scope:'b1-migration'});
  let handled=0;
  guard.flushResumeWrites(transition=>{
    handled++;
    active.snapshot(path,'save',transition);
  });
  active.snapshot(path,'open');
  assert.equal(handled,1);
  const stamp=active.snapshot(path).changed;
  assert.ok(stamp>0&&stamp<=start);
  assert.equal(active.snapshot(path).opened,start+200);
});

test('a deferred save from a cleared workspace cannot promote the next student’s work',()=>{
  const f=fixture(), path='/openscied-b1-migration', active=resume.connect(f.storage,f.clock,{scope:'b1-migration'});
  const draft=JSON.stringify({answers:{claim:'matching words'},lastVisitedAt:90});
  f.storage.setItem(m,draft);
  assert.equal(guard.erase(f.storage,null,[m]).ok,true);
  f.at(250);f.storage.setItem(m,draft);
  assert.deepEqual(active.snapshot(path,'save',{key:m,previous:null,raw:draft,at:100,scope:'b1-migration',epoch:[null,null,null]}),{});
  assert.equal(f.storage.getItem(resume.META_KEY+':b1-migration'),null);
});

test('a dashboard receiving the raw storage event first waits for the new save receipt',()=>{
  const f=fixture(), path='/openscied-b1-migration';
  const old=JSON.stringify({answers:{claim:'Prior observation.'},lastVisitedAt:90});
  const next=JSON.stringify({answers:{claim:'Revised observation.'},lastVisitedAt:200});
  const activity=resume.connect(f.storage,f.clock,{scope:'b1-migration'});
  const dashboard=resume.connect(f.storage,f.clock);
  f.storage.setItem(m,old);
  activity.snapshot(path,'open');
  f.at(200);f.storage.setItem(m,next);
  assert.equal(dashboard.snapshot(path).changed,90,'raw route timestamp is not a save receipt');
  activity.snapshot(path,'save',{key:m,previous:old,raw:next,at:200,scope:'b1-migration',epoch:[null,null,null]});
  assert.equal(dashboard.snapshot(path).changed,200);
});
