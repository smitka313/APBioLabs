'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const L=require('../openscied-b4-rat-generations-logic.js');

const tuple=c=>[c.RR,c.RB,c.BB];
const actionIds=['breed-2','breed-3','expose-3','breed-4','expose-4','breed-5'];
function flow(seed) {
  let state=L.create(seed);
  const history=[state], actions=[];
  while (!state.done) {
    actions.push(L.preview(state).id);
    history.push(state=L.step(state));
  }
  assert.deepEqual(actions,actionIds);
  return history;
}
const finals=seed=>flow(seed).at(-1);

test('all Punnett crosses produce the prescribed four-cell genotype counts',()=>{
  const references={RR:{RR:[4,0,0],RB:[2,2,0],BB:[0,4,0]},
    RB:{RR:[2,2,0],RB:[1,2,1],BB:[0,2,2]},BB:{RR:[0,4,0],RB:[0,2,2],BB:[0,0,4]}};
  for (const a of ['RR','RB','BB']) for (const b of ['RR','RB','BB']) {
    const cells=L.cross(a,b);
    assert.equal(cells.length,4);
    assert.deepEqual(tuple(L.summarize(cells.map(genotype=>({genotype})))),references[a][b]);
  }
  assert.throws(()=>L.cross('BR','RR'),TypeError);
});

test('independent litter sampling shows chance variation without touching lesson outcomes',()=>{
  const baseline=flow(5).at(-1);
  const expected=new Set(['RB','BB']), seen=new Set(); let copies=0;
  for(let seed=0;seed<32;seed++)for(let draw=0;draw<32;draw++){
    const litter=L.sampleLitter('RB','BB',seed,draw);
    assert.deepEqual(litter,L.sampleLitter('RB','BB',seed,draw));
    assert.equal(litter.pups.length,4);
    assert.ok(litter.pups.every(g=>expected.has(g)));
    assert.equal(litter.counts.redAlleles,litter.pups.filter(g=>g==='RB').length);
    assert.equal(litter.counts.redAlleleFraction,litter.counts.redAlleles/8);
    seen.add(litter.counts.redAlleles);copies+=litter.counts.redAlleles;
  }
  assert.deepEqual([...seen].sort(),[0,1,2,3,4]);
  assert.ok(Math.abs(copies/(32*32)-2)<0.1,'mean agrees with independently calculated expectation of 2 R copies');
  assert.deepEqual(L.sampleLitter('RR','BB',0).pups,['RB','RB','RB','RB']);
  assert.throws(()=>L.sampleLitter('RB','BB',0,-1),RangeError);
  assert.deepEqual(flow(5).at(-1),baseline,'optional sample does not modify lesson outcomes');
});
test('the working model shows the rationale, biological mechanism, and limits up front',()=>{
  const fs=require('node:fs'), path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'..','openscied-b4-rat-generations.html'),'utf8');
  const main=html.slice(html.indexOf('<section id="rg-model"'),html.indexOf('<div class="rg-timeline"'));
  assert.match(main,/In Part 1.*In Part 2.*same Generation 3 cohort/s);
  assert.match(main,/protein involved in blood clotting.*Exposure doesn’t give a rat an R allele/s);
  assert.match(html,/<section class="rg-panel rg-concept" aria-labelledby="rg-drift-title">/);
});

test('the first three generations remain unexposed; carrier and allele frequencies are distinct',()=>{
  const a=flow(0), b=flow(5);
  for (const steps of [a,b]) {
    assert.deepEqual(steps[0].generations[0].counts,{
      RR:0,RB:1,BB:3,total:4,carriers:1,carrierFraction:1/4,redAlleles:1,blueAlleles:7,
      redAlleleFraction:1/8,blueAlleleFraction:7/8
    });
    assert.deepEqual(tuple(steps[1].generations[1].counts),[0,2,6]);
    for (const row of steps[2].generations) {
      assert.equal(row.survivors,null);
      assert.equal(row.survivorCounts,null);
      assert.equal(row.counts.redAlleleFraction,1/8,'no red allele-frequency shift before modeled selection');
      assert.equal(row.counts.redAlleles+row.counts.blueAlleles,2*row.counts.total);
    }
  }
  assert.deepEqual(tuple(a[2].generations[2].counts),[0,4,12]);
  assert.deepEqual(tuple(b[2].generations[2].counts),[1,2,13]);
  assert.equal(a[2].generations[2].counts.carrierFraction,4/16);
  assert.equal(b[2].generations[2].counts.carrierFraction,3/16);
});

test('exposure retains G3 and G4 newborn records and filters only BB',()=>{
  const steps=flow(5);
  for (const i of [3,5]) {
    const before=steps[i-1].generations.at(-1), after=steps[i].generations.at(-1);
    assert.equal(before.generation,i===3?3:4);
    assert.equal(before.born,after.born);
    assert.equal(before.counts,after.counts);
    assert.equal(before.survivors,null);
    assert.deepEqual(after.survivors,before.born.filter(r=>r.genotype!=='BB'));
    assert.equal(after.survivorCounts.carrierFraction,1);
    assert.equal(after.survivorCounts.BB,0);
  }
  const result=steps.at(-1);
  assert.deepEqual(result.generations.map(row=>row.survivorCounts?.total??null),[null,null,3,7,null]);
  assert.deepEqual(tuple(result.generations[4].counts),[9,6,1]);
  assert.equal(result.generations[4].survivors,null,'the last row is newborns, not an extra exposure');
  assert.equal(L.preview(result),null);
  assert.equal(L.step(result),result);
});

test('random pairing uses only the eligible cohort; an odd group reuses just one parent',()=>{
  const found=new Set();
  for (let seed=0;seed<256;seed++) {
    const r=finals(seed).generations;
    found.add(tuple(r[2].counts).join());
    for (const [i,row] of r.entries()) {
      if (!i) continue;
      const eligible=r[i-1].survivors??r[i-1].born;
      const byId=new Map(eligible.map(rat=>[rat.id,0]));
      assert.equal(row.pairs.length,Math.ceil(eligible.length/2));
      assert.equal(row.born.length,4*row.pairs.length);
      assert.equal(new Set(row.born.map(rat=>rat.id)).size,row.born.length);
      assert.deepEqual(row.pairs.flatMap(p=>p.offspring),row.born);
      for (const pair of row.pairs) {
        assert.notEqual(pair.parents[0].id,pair.parents[1].id);
        for (const parent of pair.parents) {
          assert.ok(byId.has(parent.id),'unexposed or surviving adults only');
          byId.set(parent.id,byId.get(parent.id)+1);
        }
        assert.deepEqual(pair.cells,pair.offspring.map(rat=>rat.genotype));
      }
      const more=[...byId.values()].filter(count=>count===2);
      assert.ok([...byId.values()].every(count=>count===1||count===2));
      assert.equal(more.length,eligible.length%2);
      assert.equal(row.pairs.filter(pair=>pair.reused).length,eligible.length%2);
      if (eligible.length%2) {
        const [a,b]=row.pairs.slice(-2);
        assert.equal(a.parents[0].id,b.parents[0].id);
        assert.notEqual(a.parents[1].id,b.parents[1].id);
      }
    }
  }
  assert.deepEqual([...found].sort(),['0,4,12','1,2,13']);
});

test('completed results vary by seed, compact restores by replay, and invalid saves are rejected',()=>{
  const a=flow(0), b=flow(5);
  assert.notDeepEqual(a.at(-1),b.at(-1));
  for (const s of [...a,...b,...flow(0xffffffff)]) {
    const data=L.serialize(s);
    assert.deepEqual(Object.keys(data).sort(),['seed','step','v']);
    assert.deepEqual(L.restore(JSON.stringify(data)),s);
    assert.deepEqual(L.restore({...data,generations:[{invented:true}]}),s);
    assert.ok(Object.isFrozen(s.generations));
    assert.ok(Object.isFrozen(s.generations.at(-1).counts));
  }
  assert.throws(()=>L.create(-1),RangeError);
  for (const data of [null,'','{',{}, {v:2,seed:0,step:0},{v:1,seed:2**32,step:0},
    {v:1,seed:0,step:-1},{v:1,seed:0,step:7},{v:1,seed:0,step:2.5}]) assert.equal(L.restore(data),null);
});

// Exercise the real activity gate rather than reimplementing it in an assertion.
test('the next breeding event requires all assigned squares without rewriting old generations',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const M=require('../openscied-b4-rat-generations-logic');
  const B=require('../openscied-b4-rat-cross-builder');
  const controller=fs.readFileSync(path.join(__dirname,'../openscied-b4-rat-generations.js'),'utf8');
  const start=controller.indexOf('  function nextCrossProgress(');
  const from=start<0?controller.indexOf('  function needsCross('):start;
  const gate=controller.slice(from,controller.indexOf('  function crossGate(',from));
  const context={M,B,viewAction:null,state:{crosses:{}},model:M.step(M.create(5))};
  const gated=()=>vm.runInNewContext(gate+'; needsCross();',{...context});
  const full={parents:[true,true],headers:[true,true,true,true],cells:Array.from({length:4},()=>[true,true])};
  const assigned=M.step(context.model).generations.at(-1).pairs;
  assert.equal(assigned.length,4);
  context.state.crosses['g2-pair1']=full;
  assert.equal(gated(),true,'work from a past generation does not complete a new pair');
  context.state.crosses[assigned[0].id]=full;
  assert.equal(gated(),true,'one finished square does not unlock Generation 3');
  for(const cross of assigned.slice(1))context.state.crosses[cross.id]=full;
  assert.equal(gated(),false,'every currently assigned square unlocks the generation');
  context.model=M.step(context.model);
  context.state.crosses={};
  assert.equal(gated(),false,'a legacy save at an existing selection event is never sent back');
  context.model=M.step(context.model);
  assert.equal(gated(),true,'the next upcoming breeding event still requires its own squares');
  context.viewAction=0;
  assert.equal(gated(),false,'the historical timeline never requires rebuilding an old square');
});
