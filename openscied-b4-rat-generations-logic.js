/*
 * OpenSciEd Biology B.4 Lesson 3, Rat Modeling Investigation (10/23/26),
 * Parts 1–2, and Rat Cross Model Key generation diagram. The original lesson
 * uses random pairings and the expected four-cell Punnett distribution for a
 * pair, not four separately sampled births. Our seed makes the pairings
 * repeatable. Parent cohorts do not carry over after producing the next row.
 *
 * This is a classroom genetics model, not a pest-control model or a model of
 * particular real animals. The lesson's binary exposure removes BB only. No
 * dose, contact conditions, practical use, relative advantage among RR/RB,
 * or actual survival probability is modeled. No mutations are added after
 * Generation 1. The key records Generation 5 births before another exposure.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RatGenerationsLogic = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GENOTYPES = Object.freeze(['RR', 'RB', 'BB']);
  const STEPS = Object.freeze([
    {id:'breed-2', action:'breed', from:1, generation:2, title:'Produce Generation 2'},
    {id:'breed-3', action:'breed', from:2, generation:3, title:'Produce Generation 3'},
    {id:'expose-3', action:'select', from:3, generation:3, title:'Compare survival in Generation 3'},
    {id:'breed-4', action:'breed', from:3, generation:4, title:'Produce Generation 4'},
    {id:'expose-4', action:'select', from:4, generation:4, title:'Compare survival in Generation 4'},
    {id:'breed-5', action:'breed', from:4, generation:5, title:'Produce Generation 5'}
  ].map(Object.freeze));
  const validSeed = seed => Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
  const rat = (id, genotype) => Object.freeze({id,genotype});
  const empty = Object.freeze([]);

  function summarize(rats) {
    const counts = {RR:0,RB:0,BB:0};
    for (const item of rats) {
      if (!GENOTYPES.includes(item?.genotype)) throw new TypeError('Unknown rat genotype');
      counts[item.genotype]++;
    }
    const total = counts.RR + counts.RB + counts.BB;
    const carriers = counts.RR + counts.RB;
    const redAlleles = 2*counts.RR + counts.RB, blueAlleles = 2*counts.BB + counts.RB;
    return Object.freeze({...counts,total,carriers,carrierFraction:total?carriers/total:null,redAlleles,blueAlleles,
      redAlleleFraction:total?redAlleles/(2*total):null,blueAlleleFraction:total?blueAlleles/(2*total):null});
  }
  function cross(a,b) {
    if (!GENOTYPES.includes(a) || !GENOTYPES.includes(b)) throw new TypeError('Choose an RR, RB, or BB genotype');
    return Object.freeze([...a].flatMap(first => [...b].map(second => first===second ? first+second : 'RB')));
  }
  function row(generation,born,pairs=empty) {
    const recipients = Object.freeze(born);
    return Object.freeze({generation,born:recipients,counts:summarize(recipients),survivors:null,survivorCounts:null,pairs});
  }
  function create(seed=0) {
    if (!validSeed(seed)) throw new RangeError('A model seed must be an unsigned 32-bit integer');
    const founders = ['RB','BB','BB','BB'].map((genotype,index)=>rat('g1-r'+(index+1),genotype));
    return Object.freeze({v:1,seed:seed>>>0,step:0,done:false,generations:Object.freeze([row(1,founders)])});
  }
  function preview(state) { return STEPS[state.step] || null; }
  function stream(seed,generation) {
    // Isolated stream per generation, for repeatable pairings after restoring.
    let word=(seed ^ Math.imul(generation,0x9e3779b9))>>>0;
    return () => {
      word=(word+0x6d2b79f5)>>>0;
      let num=word;
      num=Math.imul(num^(num>>>15),num|1);
      num^=num+Math.imul(num^(num>>>7),num|61);
      return ((num^(num>>>14))>>>0)/4294967296;
    };
  }
  // Optional chance comparison only. Independently sample one of four equally
  // probable Punnett cells per pup, with replacement; never change lesson counts.
  function sampleLitter(a,b,seed,draw=0) {
    if(!validSeed(seed)||!validSeed(draw))throw new RangeError('Invalid sample seed or draw');
    const cells=cross(a,b), internalSeed=(seed ^ 0x4729a96b)>>>0;
    const random=stream(internalSeed,draw);
    const pups=Object.freeze(Array.from({length:cells.length},()=>cells[Math.floor(random()*cells.length)]));
    return Object.freeze({pups,counts:summarize(pups.map(genotype=>({genotype})))});
  }
  function shuffle(group, random) {
    const copy=[...group];
    for (let i=copy.length-1;i>0;i--) {
      const j=Math.floor(random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }
  function breed(parent,generation,seed) {
    const cohort=shuffle(parent.survivors ?? parent.born,stream(seed,generation));
    const pairs=[],born=[];
    function pair(first,second,reused=false) {
      const cells=cross(first.genotype,second.genotype);
      const offspring=Object.freeze(cells.map((g,i)=>rat('g'+generation+'-r'+(born.length+i+1),g)));
      pairs.push(Object.freeze({id:'g'+generation+'-pair'+(pairs.length+1),parents:Object.freeze([first,second]),
        cells,offspring,reused}));
      born.push(...offspring);
    }
    // In an odd cohort reserve the last three as a trio. The first of those
    // three is assigned the sperm-parent role for both pairings; the other two
    // are each assigned the egg-parent role once. No independent sex simulation.
    const odd = cohort.length % 2 === 1 && cohort.length >= 3;
    const regular = odd ? cohort.length-3 : cohort.length;
    for (let i=0;i+1<regular;i+=2) pair(cohort[i],cohort[i+1]);
    if (odd) {
      pair(cohort[regular],cohort[regular+1]);
      pair(cohort[regular],cohort[regular+2],true);
    }
    return row(generation,born,Object.freeze(pairs));
  }
  function select(current) {
    const survivors=Object.freeze(current.born.filter(animal=>animal.genotype!=='BB'));
    return Object.freeze({...current,survivors,survivorCounts:summarize(survivors)});
  }
  function step(state) {
    if (state?.v!==1 || !validSeed(state.seed) || !Number.isInteger(state.step) ||
        state.step<0 || state.step>STEPS.length || !Array.isArray(state.generations))
      throw new TypeError('Invalid Rat Generations state');
    const next=preview(state);
    if (!next) return state;
    const source=state.generations.at(-1);
    if (source?.generation!==next.from) throw new TypeError('Invalid source generation');
    const generations=next.action==='breed'
      ? [...state.generations,breed(source,next.generation,state.seed)]
      : [...state.generations.slice(0,-1),select(source)];
    const index=state.step+1;
    return Object.freeze({v:1,seed:state.seed,step:index,done:index===STEPS.length,generations:Object.freeze(generations)});
  }
  function serialize(state) { return {v:1,seed:state.seed,step:state.step}; }
  function restore(raw) {
    try {
      const value=typeof raw==='string'?JSON.parse(raw):raw;
      if (value?.v!==1 || !validSeed(value.seed) || !Number.isInteger(value.step) || value.step<0 || value.step>STEPS.length)
        return null;
      let state=create(value.seed);
      while (state.step<value.step) state=step(state);
      return state;
    } catch (_) { return null; }
  }
  return Object.freeze({create,step,preview,serialize,restore,summarize,cross,sampleLitter,STEPS,GENOTYPES});
});
