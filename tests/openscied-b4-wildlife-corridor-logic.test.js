'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../openscied-b4-wildlife-corridor-logic.js');

const cases=['connected','road','corridor'], total=L.PATCH_SIZE*2;
function independentCounts(patches) {
  const counts={A:0,B:0,C:0,D:0};
  for(const patch of patches) for(const individual of patch) for(const allele of individual.alleles) counts[allele]++;
  return counts;
}
const distinctVariants=counts=>Object.values(counts).filter(n=>n>0).length;

test('all comparison cases start with the same two diploid populations and precise founding counts',()=>{
  for (const seed of [0,1,42,0xffffffff]) {
    const [connected,road,corridor]=cases.map(c=>L.create(seed,c));
    assert.deepEqual(connected.patches,road.patches);
    assert.deepEqual(connected.patches,corridor.patches);
    assert.deepEqual(connected.history,road.history);
    const start=connected.history[0];
    assert.equal(start.generation,0);
    assert.equal(start.population,24);
    assert.deepEqual(start.variantCounts,{A:12,B:16,C:8,D:12});
    assert.deepEqual(start.patches.map(p=>p.variantCounts),[{A:12,B:8,C:4,D:0},{A:0,B:8,C:4,D:12}]);
    assert.deepEqual(start.patches.map(p=>[p.population,p.diversity,p.heterozygosity]),[[12,3,0.5],[12,3,0.5]]);
    assert.equal(start.diversity,4,'unique variants across both patches are not the sum of the patch richness');
    assert.equal(start.crossPatchContributions,0);
  }
});

test('generation evidence exactly matches independent counts and every allele comes from its recorded source',()=>{
  for (let seed=0;seed<32;seed++) for (const condition of cases) {
    let earlier=L.create(seed,condition);
    for (let generation=1;generation<=L.GENERATIONS;generation++) {
      const state=L.advance(earlier), actual=L.summarize(state);
      assert.equal(state.generation,generation);
      assert.equal(actual.population,total);
      assert.deepEqual(actual.variantCounts,independentCounts(state.patches));
      assert.equal(actual.diversity,distinctVariants(actual.variantCounts));
      assert.ok(actual.diversity<=earlier.history.at(-1).diversity);
      assert.deepEqual(state.history.at(-1),actual);
      const prior=earlier.patches.map(p=>new Set(p.flatMap(i=>i.alleles)));
      const counts=[0,0];
      state.patches.forEach((patch,index)=>{
        assert.equal(patch.length,L.PATCH_SIZE);
        const heterozygotes=patch.reduce((n,individual)=>n+Number(individual.alleles[0]!==individual.alleles[1]),0);
        assert.equal(actual.patches[index].heterozygosity,heterozygotes/patch.length);
        assert.deepEqual(actual.patches[index].variantCounts,independentCounts([patch]));
        for(const individual of patch) {
          assert.equal(individual.alleles.length,2);
          assert.equal(individual.origins.length,2);
          individual.origins.forEach((origin,slot)=>{
            assert.ok(origin===0||origin===1);
            assert.ok(prior[origin].has(individual.alleles[slot]),'no new variants created by movement or inheritance');
            if(origin!==index) counts[index]++;
          });
        }
        assert.equal(actual.patches[index].crossPatchContributions,counts[index]);
      });
      assert.equal(actual.crossPatchContributions,counts[0]+counts[1]);
      earlier=state;
    }
  }
});

test('the road never lets the patch-restricted founding variants cross',()=>{
  for (let seed=0;seed<64;seed++) {
    const {history}=L.run(seed,'road');
    for (const step of history) {
      assert.equal(step.crossPatchContributions,0);
      assert.equal(step.patches[0].variantCounts.D,0);
      assert.equal(step.patches[1].variantCounts.A,0);
    }
  }
});

test('paired conditions consume the same cross-patch draws without making a result inevitable',()=>{
  let fullyConnected=0, limited=0;
  const repeats=100, slots=repeats*L.GENERATIONS*total*2;
  for(let seed=0;seed<repeats;seed++) {
    let f=L.create(seed,'connected'), c=L.create(seed,'corridor');
    for(let n=0;n<L.GENERATIONS;n++) {
      f=L.advance(f); c=L.advance(c);
      for(let patch=0;patch<2;patch++) for(let i=0;i<L.PATCH_SIZE;i++) for(let copy=0;copy<2;copy++) {
        const crossing=f.patches[patch][i].origins[copy]!==patch;
        const corridor=c.patches[patch][i].origins[copy]!==patch;
        assert.ok(!corridor||crossing,'paired runs share the same parent-origin draw for each slot');
        fullyConnected+=Number(crossing); limited+=Number(corridor);
      }
    }
  }
  assert.ok(Math.abs(fullyConnected/slots-L.CONDITIONS.connected.migrationChance)<0.02);
  assert.ok(Math.abs(limited/slots-L.CONDITIONS.corridor.migrationChance)<0.02);
  const gains=L.run(42,'corridor',1).history[1];
  assert.equal(gains.patches[0].diversity,4);
  assert.equal(gains.patches[1].diversity,4);
  const notGuaranteed=L.run(0,'corridor');
  assert.ok(notGuaranteed.history.at(-1).crossPatchContributions>0);
  assert.ok(notGuaranteed.history.at(-1).diversity<L.run(0,'road').history.at(-1).diversity);
  assert.ok(L.run(73,'corridor').history.slice(1).some(step=>step.crossPatchContributions===0));
});

test('model state remains stable when stepped, rerun or restored',()=>{
  const active=L.run(217,'corridor',4);
  const before=JSON.stringify(active);
  assert.deepEqual(L.advance(active),L.run(217,'corridor',5));
  assert.equal(JSON.stringify(active),before,'advancing does not mutate the prior visual state');
  assert.deepEqual(L.restore(JSON.parse(before)),active);
  const badCache={v:1,seed:217,condition:'corridor',generation:4,patches:[],history:[{population:999}]};
  assert.deepEqual(L.restore(badCache),active,'discard cached observations and reconstruct from seed/settings');
  const end=L.run(217,'corridor');
  assert.deepEqual(L.advance(end),end);
});

test('invalid controls and unsupported save versions do not fabricate evidence',()=>{
  for (const seed of [-1,0xffffffff+1,2.5,NaN,Infinity,'12']) assert.throws(()=>L.create(seed),/seed/);
  for (const caseId of ['random','constructor','__proto__',42]) assert.throws(()=>L.create(42,caseId),/habitat/);
  for (const n of [-1,L.GENERATIONS+1,1.5]) assert.throws(()=>L.run(42,'road',n),/generation/);
  for(const raw of [null,{}, {v:2,seed:1,condition:'road',generation:0},
    {v:1,seed:1,condition:'fake',generation:0},{v:1,seed:1,condition:'road',generation:20}]) assert.equal(L.restore(raw),null);
  assert.throws(()=>L.advance(null), /Start or restore/);
});
