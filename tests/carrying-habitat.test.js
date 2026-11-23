'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const H=require('../carrying-habitat-logic');
const matchAll=state=>state.animals.reduce((s,a)=>H.match(s,a.id,a.need),state);
const finishAll=state=>H.finish(matchAll(state));
const counts=s=>{const r=H.summary(s);return [r.starting,r.survivors,r.deaths,r.births,r.ending];};

test('every scenario uses an identical 8-card herd and changes only the named stock against baseline',()=>{
  const base=H.create(), controls=Object.keys(base.stocks);
  for(const [id,resource] of [['low-food','food'],['drought','water'],['shelter-loss','shelter']]){
    const state=H.create(id);
    assert.deepEqual(state.animals,base.animals);
    assert.deepEqual(controls.filter(k=>state.stocks[k]!==base.stocks[k]),[resource]);
    assert.deepEqual(H.comparison(id).changes,[{resource,baseline:base.stocks[resource],scenario:state.stocks[resource]}]);
  }
  assert.deepEqual(H.comparison('balanced').changes,[]);
  assert.equal(H.comparison('made-up'),null);
});

test('only a matching, unassigned animal can use an available unit, and completion requires all possible matches',()=>{
  const a=H.create('drought');
  assert.equal(H.status(a).legalCount,6);
  assert.equal(H.match(a,'a1','water'),a); // a1 needs food.
  assert.equal(H.finish(a),a);
  const b=H.match(a,'a2','water');
  assert.equal(a.remaining.water,1);
  assert.equal(b.remaining.water,0);
  assert.equal(H.status(b).legalCount,5);
  assert.equal(H.match(b,'a2','water'),b); // duplicate
  assert.equal(H.match(b,'a5','water'),b); // used last water station
  assert.equal(H.match(b,'no-such-animal','food'),b);
  assert.equal(H.match(b,'a1','cover'),b);
  assert.equal(H.summary(b).deaths,null);
  assert.equal(H.summary(b).ending,null);
  const ready=matchAll(b);
  assert.deepEqual(H.status(ready),{remaining:2,legalCount:0,canFinish:true,complete:false,canContinue:false});
  const done=H.finish(ready);
  assert.equal(done.history.length,1);
  assert.equal(H.finish(done),done);
  assert.equal(H.match(done,'a5','water'),done);
});

test('results follow directly from final matching; different limiting factors yield the same count here',()=>{
  const full=finishAll(H.create());
  assert.deepEqual(counts(full),[8,8,0,4,12]);
  assert.deepEqual(H.summary(full).limiting,[]);
  const expected={food:[3,1,1,2,0],water:[3,1,1,2,0],shelter:[2,0,0,2,0]};
  for(const [scenario,resource] of [['low-food','food'],['drought','water'],['shelter-loss','shelter']]){
    const result=finishAll(H.create(scenario)),s=H.summary(result),b=s.byResource[resource];
    assert.deepEqual(counts(result),[8,6,2,3,9]);
    assert.deepEqual(s.limiting,[resource]);
    assert.deepEqual([b.needed,b.available,b.matched,b.unmatched,b.unused],expected[resource]);
  }
});

test('next generation uses the simulated next population, carries survivors, and renews fixed stocks',()=>{
  const done=finishAll(H.create('drought')), result=H.nextGeneration(done);
  const survivors=new Set(done.matches.map(m=>m.animalId));
  assert.equal(result.generation,2);
  assert.equal(result.animals.length,H.summary(done).ending);
  assert.deepEqual(result.animals.filter(a=>a.id.startsWith('a')),done.animals.filter(a=>survivors.has(a.id)));
  assert.deepEqual(result.animals.slice(-3),[{id:'g2-b1',need:'food'},{id:'g2-b2',need:'water'},{id:'g2-b3',need:'shelter'}]);
  assert.deepEqual(result.remaining,done.stocks);
  assert.deepEqual(result.matches,[]);
  assert.equal(H.nextGeneration(result),result);
  let state=H.create();
  for(let i=1;i<=H.MAX_GENERATIONS;i++){
    state=finishAll(state);
    assert.equal(state.generation,i);
    assert.equal(state.history.length,i);
    if(i<H.MAX_GENERATIONS)state=H.nextGeneration(state);
  }
  assert.equal(H.status(state).canContinue,false);
  assert.equal(H.nextGeneration(state),state);
});

test('matching order changes which animals survive a shortage, not the terminal counts',()=>{
  const initial=H.create('drought');
  const forward=finishAll(initial);
  const reverse=H.finish(initial.animals.slice().reverse().reduce((s,a)=>H.match(s,a.id,a.need),initial));
  assert.deepEqual(counts(forward),counts(reverse));
  assert.notEqual(forward.matches.find(m=>m.resource==='water').animalId,reverse.matches.find(m=>m.resource==='water').animalId);
});

test('restore replays valid partial and complete generations and rejects changed solver inputs or impossible moves',()=>{
  const first=finishAll(H.create('low-food'));
  assert.deepEqual(H.restore(JSON.stringify(first)),first);
  const next=H.nextGeneration(first);
  const partial=H.match(next,'g2-b3','shelter');
  assert.deepEqual(H.restore(partial),partial);
  const final=finishAll(next);
  assert.deepEqual(H.restore(final),final);
  assert.equal(H.restore({...partial,remaining:{food:100,water:4,shelter:2}}),null);
  assert.equal(H.restore({...partial,matches:[{animalId:'g2-b3',resource:'water'}]}),null);
  assert.equal(H.restore({...first,history:[{generation:1,matches:[]}]}),null);
  assert.equal(H.restore({...next,scenarioId:'invalid'}),null);
  assert.equal(H.restore('{broken'),null);
});
