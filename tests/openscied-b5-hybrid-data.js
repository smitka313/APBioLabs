'use strict';
const assert=require('node:assert/strict'),D=require('../openscied-b5-hybrid-data.js');
assert.deepEqual(D.interactions,[['Lone adult male',19,76,1,61],['Lone adult female',10,17,0,9],['Female with cubs',41,19,4,15],['Subadult',6,26,0,8]]);
assert.deepEqual(D.family.filter(r=>r.group===1).map(r=>r.parents),[['p','a'],['p','a'],['p','b'],['p','b']]);
assert.deepEqual(D.family.filter(r=>r.group===2).map(r=>r.parents),[['f4','a'],['f4','a'],['f4','a'],['f4','b']]);
assert.equal(Math.round(26/D.generationYears),2);assert.equal(Math.round(56/D.generationYears),5);
assert.equal(D.flips('01020304',40).join(''),'0111001101010000000100011000101010010000');
assert.deepEqual(D.cohort('01020304',7),[[0,1,1,1]]);
assert.equal(D.cohort('01020304',400).length,10);
assert.equal(D.graph.find(g=>g.key==='obs').values.at(-1)[0],2022);
assert.deepEqual(D.graph.slice(1).map(g=>g.values.at(-1)),[[2100,1.7],[2100,.9],[2100,.3],[2100,.2]]);
assert.deepEqual(D.traits.map(t=>t.key),['LYST','APOB','ARID5B','NOS3']);
for(const t of D.traits){assert.equal(t.brown.length,2);assert.equal(t.out.length,2);assert(t.polar);}
for(let i=0;i<97;i++){
 const id=i.toString(16).padStart(8,'0'),rows=D.cohort(id,40);
 assert.deepEqual(rows.flat(),D.flips(id,40));assert.equal(rows.length,10);
 assert(D.flips(id,40).every(x=>x===0||x===1));
}
console.log('Lesson 6 data contracts passed: source counts and parentage, scenario points, and 10 × 4 stable coin flips.');
