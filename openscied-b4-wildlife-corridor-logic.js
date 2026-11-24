/* Wildlife Corridor Lab: fictional, neutral, one-locus island model.
   The two habitat patches always contain twelve diploid individuals each.
   A barrier changes where parents may come from, not survival or reproduction
   rates. All four alleles have the same inheritance probability. There is no
   selection, mutation, immigration from outside the two patches, or forecast. */
(function (root, factory) {
  'use strict';
  const logic = factory();
  if (typeof module === 'object' && module.exports) module.exports = logic;
  else root.WildlifeCorridorLogic = logic;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';

  const VERSION = 1, PATCH_SIZE = 12, GENERATIONS = 8;
  const VARIANTS = Object.freeze(['A', 'B', 'C', 'D']);
  const CONDITIONS = Object.freeze(Object.fromEntries([
    ['connected','Connected habitat',0.25],
    ['road','Road barrier',0],
    ['corridor','Limited corridor',0.10]
  ].map(([id,label,migrationChance])=>[id,Object.freeze({id,label,migrationChance})])));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object,key);

  function rngFor(seed, generation) {
    // A separate stream for each generation. Every case consumes the same
    // source, donor, and chromosome draw for each slot, even when the road
    // makes crossing impossible. The cases begin with identical individuals.
    let state = (seed ^ Math.imul(generation + 1, 0x9e3779b9)) >>> 0;
    return () => {
      let t = state = (state + 0x6d2b79f5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function validSeed(seed) { return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff; }
  function validGeneration(generation) { return Number.isInteger(generation) && generation >= 0 && generation <= GENERATIONS; }
  function validCondition(condition) { return typeof condition === 'string' && own(CONDITIONS,condition); }

  function initialPatches(seed) {
    const draw = rngFor(seed,0);
    return ['A','D'].map(local=> {
      // Hold founding counts fixed, but randomize the positions of individuals.
      // In each patch: 12 copies of its local variant, 8 B, and 4 C.
      const pairs = [[local,local,3],[local,'B',4],[local,'C',2],['B','B',2],['C','C',1]];
      const individuals = pairs.flatMap(([a,b,n])=>Array.from({length:n},()=>({alleles:[a,b],origins:null})));
      for (let i=individuals.length-1; i>0; i--) {
        const j=Math.floor(draw()*(i+1));
        [individuals[i],individuals[j]]=[individuals[j],individuals[i]];
      }
      return individuals;
    });
  }
  function variantCounts() { return Object.fromEntries(VARIANTS.map(variant=>[variant,0])); }
  function countPatch(individuals, patch) {
    const counts = variantCounts();
    let heterozygotes=0, crossPatchContributions=0;
    for (const individual of individuals) {
      const [a,b]=individual.alleles;
      counts[a]++; counts[b]++;
      if (a!==b) heterozygotes++;
      if (individual.origins) crossPatchContributions+=individual.origins.filter(origin=>origin!==patch).length;
    }
    return {
      population:individuals.length,
      variantCounts:counts,
      diversity:VARIANTS.filter(allele=>counts[allele]>0).length,
      // Observed fraction of individuals carrying two different variants,
      // not the count of variants and not a model of new mutation.
      heterozygosity:heterozygotes/individuals.length,
      crossPatchContributions
    };
  }
  function summarize(state) {
    const patches = state.patches.map(countPatch);
    const counts = variantCounts();
    for (const variant of VARIANTS) counts[variant]=patches[0].variantCounts[variant]+patches[1].variantCounts[variant];
    return {
      generation:state.generation,
      patches,
      population:patches[0].population+patches[1].population,
      variantCounts:counts,
      diversity:VARIANTS.filter(variant=>counts[variant]>0).length,
      // Equal patch census sizes, so the mean is the observed overall fraction.
      heterozygosity:(patches[0].heterozygosity+patches[1].heterozygosity)/2,
      crossPatchContributions:patches[0].crossPatchContributions+patches[1].crossPatchContributions
    };
  }

  function create(seed,condition='connected') {
    if (!validSeed(seed)) throw new RangeError('Choose a whole-number seed from 0 to 4294967295.');
    if (!validCondition(condition)) throw new RangeError('Choose one of the three habitat conditions.');
    const state = {v:VERSION,seed,condition,generation:0,patches:initialPatches(seed),history:[]};
    state.history.push(summarize(state));
    return state;
  }
  function advance(state) {
    if (!state || state.v!==VERSION || !validSeed(state.seed) || !validGeneration(state.generation) || !validCondition(state.condition)) {
      throw new TypeError('Start or restore a model run before advancing.');
    }
    if (state.generation===GENERATIONS) return state;
    const generation=state.generation+1, draw=rngFor(state.seed,generation);
    const chance=CONDITIONS[state.condition].migrationChance;
    const patches=[0,1].map(patch=>Array.from({length:PATCH_SIZE},()=>{
      const origins=[], alleles=[];
      let firstParent=null;
      for (let copy=0; copy<2; copy++) {
        const origin=draw()<chance?1-patch:patch;
        const donorDraw=draw(), inherited=draw()<0.5?0:1;
        // When both parents come from the same patch, choose two distinct
        // adults without changing the number of random draws in any scenario.
        const sameSource=copy===1&&origins[0]===origin;
        let parent=Math.floor(donorDraw*(PATCH_SIZE-Number(sameSource)));
        if (sameSource&&parent>=firstParent) parent++;
        if (copy===0) firstParent=parent;
        origins.push(origin);
        alleles.push(state.patches[origin][parent].alleles[inherited]);
      }
      return {alleles,origins};
    }));
    const next={v:VERSION,seed:state.seed,condition:state.condition,generation,patches,history:state.history.slice()};
    next.history.push(summarize(next));
    return next;
  }
  function run(seed,condition='connected',generations=GENERATIONS) {
    if (!validGeneration(generations)) throw new RangeError('Choose a recorded generation from 0 to '+GENERATIONS+'.');
    let state=create(seed,condition);
    for (let i=0; i<generations; i++) state=advance(state);
    return state;
  }
  function restore(saved) {
    // Persist only reproducible inputs. Never treat cached results as observations.
    if (!saved || saved.v!==VERSION || !validSeed(saved.seed) || !validCondition(saved.condition) || !validGeneration(saved.generation)) return null;
    return run(saved.seed,saved.condition,saved.generation);
  }

  return Object.freeze({CONDITIONS,GENERATIONS,PATCH_SIZE,VARIANTS,create,advance,summarize,run,restore});
});
