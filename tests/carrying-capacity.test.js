'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const L=require('../carrying-logic');

test('Lesson 5 starts with 2 wildebeest and 18 grass roles, and gives one offspring for two survivors',()=>{
  const s=L.create();
  assert.equal(L.available(s),18);
  assert.deepEqual(L.preview(s),{starting:2,grassRoles:18,grassAvailable:18});
  assert.deepEqual(L.step(s).rows[0],{round:1,starting:2,grassRoles:18,grassAvailable:18,survivors:2,deaths:0,births:1,ending:3,grassNext:17,grassEaten:2,grassUneaten:16,grassUnavailable:0});
  assert.equal(s.rows.length,0);
});

test('shortage matches one food role per survivor, deaths switch to grass and births round down',()=>{
  // A source-guided manual count: 13 wildebeest, 7 grass; 7 fed, 6 unfed, 3 births.
  const s=L.create({startingPopulation:13});
  assert.deepEqual(L.step(s).rows[0],{round:1,starting:13,grassRoles:7,grassAvailable:7,survivors:7,deaths:6,births:3,ending:10,grassNext:10,grassEaten:7,grassUneaten:0,grassUnavailable:0});
  // The handout uses "less than" and "greater than"; equality has one match for each animal.
  const even=L.step(L.create({startingPopulation:10})).rows[0];
  assert.equal(even.survivors,10);assert.equal(even.deaths,0);assert.equal(even.ending,15);
});

test('baseline and single-variable comparison produce different traced cycles',()=>{
  const base=L.run(L.BASELINE),compare=L.run(L.COMPARISON);
  assert.deepEqual(L.summary(base).populations,[2,3,4,6,9,13,10,15,7,10,15,7,10]);
  assert.deepEqual(L.summary(compare).populations,[2,3,4,6,9,7,9,7,9,7,9,7,9]);
  assert.deepEqual(L.summary(base).cycle,{firstRound:6,repeatRound:9,values:[10,15,7],min:7,max:15});
  assert.deepEqual(L.summary(compare).cycle,{firstRound:4,repeatRound:6,values:[9,7],min:7,max:9});
  assert.equal(L.summary(base).firstShortageRound,6);
  assert.equal(L.summary(compare).firstShortageRound,5);
  for(const key of ['roleSlots','startingPopulation'])assert.equal(base[key],compare[key]);
  assert.equal(compare.rows[0].grassAvailable,9);
  assert.equal(compare.rows[4].grassAvailable,5,'round down fractional grass roles');
});

test('all role combinations keep the model finite, conserve slots, and never create grass or animals from an empty pathway',()=>{
  for(const roleSlots of [2,3,20,41,120])for(const grassPercent of [0,25,50,75,100])for(let startingPopulation=0;startingPopulation<=roleSlots;startingPopulation++){
    const s=L.run({roleSlots,grassPercent,startingPopulation},15);
    for(const r of s.rows){
      assert.ok(r.starting+r.grassRoles===roleSlots);
      assert.ok([r.survivors,r.deaths,r.births,r.ending,r.grassNext,r.grassUneaten].every(n=>Number.isInteger(n)&&n>=0));
      assert.equal(r.ending+r.grassNext,roleSlots);
      assert.equal(r.grassNext,r.grassRoles+r.deaths-r.births);
      assert.equal(r.grassEaten+r.grassUneaten+r.grassUnavailable,r.grassRoles);
      assert.equal(r.survivors+r.deaths,r.starting);
    }
  }
  assert.equal(L.run({grassPercent:0},2).rows[1].ending,0);
  assert.throws(()=>L.create({grassPercent:NaN}),RangeError);
  assert.throws(()=>L.create({roleSlots:3,startingPopulation:4}),RangeError);
  assert.throws(()=>L.run(L.BASELINE,16),RangeError);
});

test('saved trials restore exactly and inconsistent records fail safely',()=>{
  const s=L.run(L.COMPARISON,9);
  assert.deepEqual(L.restore(JSON.stringify(s)),s);
  assert.equal(L.restore({...s,population:100}),null);
  assert.equal(L.restore({...s,rows:s.rows.map((r,i)=>i? r : {...r,births:100})}),null);
  assert.equal(L.restore({...s,version:3}),null);
  assert.equal(L.restore('{unreadable'),null);
});

test('research excerpt cites the primary table and computes rates using years elapsed',()=>{
  const {rows,method,url}=L.EVIDENCE;
  assert.equal(rows.length,34);
  assert.equal(rows[0].year,1961);assert.equal(rows.at(-1).year,1994);
  assert.equal(rows.find(r=>r.year===1977).population,1440000);
  assert.equal(rows.find(r=>r.year===1978).population,1248934);
  assert.equal(rows.find(r=>r.year===1993).completeness,'survival-derived estimate');
  assert.equal(rows.at(-1).population,917204);
  assert.match(method, /censuses and interpolated values/);
  assert.match(url, /^https:\/\/doi.org\//);
  assert.deepEqual(L.historicalRate(1961,1977),{start:1961,end:1977,startPopulation:263362,endPopulation:1440000,years:16,change:1176638,rate:73539.875});
  assert.equal(L.historicalRate(1993,1994).rate,-292267);
  assert.equal(L.historicalRate(1977,1977),null);
  assert.equal(L.historicalRate(1961,2010),null);
});
