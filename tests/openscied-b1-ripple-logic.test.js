'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),M=require('../openscied-b1-ripple-logic.js');
test('paired scenarios are reproducible and hold everything but visits constant initially',()=>{
 const base=M.run(317,100),low=M.run(317,50);
 a.deepEqual(low,M.run(317,50));a.deepEqual(low[0],base[0]);
 a.deepEqual(low[1],{...base[1],herd:50});a.ok(base.every(row=>Object.values(row).every(n=>n===100)));
});
test('modeled effects travel in order, and grazing and nutrient inputs oppose each other',()=>{
 const low=M.run(317,50);
 a.ok(low[2].dung<100&&low[2].predators<100&&low[2].grass>100);
 a.equal(low[2].beetles,100);a.ok(low[3].beetles<100);
 a.equal(low[3].soil,100);a.ok(low[4].soil<100);
 a.equal(low[4].grass,low[3].grass);a.ok(low[5].grass<low[4].grass);
 for(let seed=0;seed<100;seed++)a.ok(M.run(seed,50).every(row=>Object.values(row).every(n=>Number.isInteger(n)&&n>=0&&n<=200)));
 a.notDeepEqual(M.run(0,50),M.run(2,50));
});
test('links use exact directions and invalid inputs cannot become observed data',()=>{
 a.ok(M.correct([1,1,1,1,-1,1]));a.ok(!M.correct([1,1,1,1,1,1]));a.ok(!M.correct([]));
 for(const seed of [-1,2.1,NaN,2**32])a.throws(()=>M.run(seed),RangeError);
 a.throws(()=>M.run(3,70),RangeError);
});
