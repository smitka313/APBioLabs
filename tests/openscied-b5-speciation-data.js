'use strict';
const assert=require('node:assert/strict'),D=require('../openscied-b5-speciation-data.js');
assert.deepEqual(D.periods.map(p=>[p.from,p.end,p.next]),[[680,626,550],[550,535,470],[470,425,380],[380,335,285],[285,245,190],[190,135,75],[75,15,0]]);
assert.equal(D.years(D.periods[1]),15000);
assert.equal(D.years(D.periods[1],true),65000);
assert.equal(D.generations(D.periods[1]),1322);
assert.equal(D.generations(D.periods[1],true),5727);
assert.equal(D.generations(D.periods[6]),5286);
assert.deepEqual(D.fossils.map(f=>[f.bear,f.young,f.old]),[['Polar',70000,110000],['Polar',110000,130000],['Brown',10000,12000],['Brown',3900,37500],['Brown',550000,550000],['Brown',480000,480000],['Brown',11000,11000],['Brown',340000,340000]]);
assert.deepEqual(D.genes.map(g=>g.id),['LYST','APOB','ARID5B']);
for(let i=1;i<128;i++){
 const seed=i.toString(16).padStart(8,'0'),r=D.roster(seed);
 assert.deepEqual(D.roster(seed),r);
 assert.equal(r.length,6);
 assert.equal(r.some(c=>c.variants.every(Boolean)),true);
 assert.equal(r.some(c=>c.variants.every(n=>!n)),true);
 assert(r.every(c=>c.variants.length===3&&c.variants.every(n=>typeof n==='boolean')));
}
assert.notDeepEqual(D.roster('AAAAAAAB'),D.roster('23456789'));
console.log('B.5 Lesson 4 data: source intervals, generation calculations, all eight fossil ages and seeded model chips pass.');
