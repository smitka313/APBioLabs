'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const L=require('../openscied-b3-dna-workshop-logic.js');
const place=(p,id,value)=>{
  const result=L.place(p,id,value);
  assert.equal(result.ok,true,result.error);
  return result.progress;
};
function solve(id,p=L.create()){
  for(const slot of L.stage(id).slots)p=place(p,slot.id,slot.expected);
  return p;
}
const read=(row,p)=>row.bases.map((_,i)=>L.getValue(row,i,p)).join('');

test('pairing board has four active bases, opposite directions, and a fully complementary toy duplex',()=>{
  const s=L.stage('pair'), [a,b]=s.rows;
  assert.deepEqual(a.direction,['5′','3′']);
  assert.deepEqual(b.direction,['3′','5′']);
  assert.deepEqual(s.slots.map(slot=>[slot.index,slot.expected]),[[0,'T'],[1,'A'],[2,'C'],[4,'G']]);
  const blank=L.create();
  assert.equal(L.getValue('pair-lower',0,blank),null);
  assert.equal(L.getValue('pair-lower',3,blank),'C');
  assert.equal(L.complete('pair',blank),false);
  const p=solve('pair'), dnaComplement={A:'T',T:'A',C:'G',G:'C'};
  assert.equal(read(a,p),'ATGGCTTTTTAA');
  assert.equal(read(b,p),'TACCGAAAAATT');
  assert.equal([...read(a,p)].map(c=>dnaComplement[c]).join(''),read(b,p));
  assert.ok(L.complete('build',p));
});

test('replication is semiconservative: there are two new strands and the two original strands are in different daughters',()=>{
  const s=L.stage('copy');
  const initial=L.create();
  const p=solve('copy',initial);
  assert.equal(s.rows.filter(r=>r.origin==='original').length,2);
  assert.equal(s.rows.filter(r=>r.origin==='new').length,2);
  for(const daughter of ['A','B']){
    const rows=s.rows.filter(row=>row.daughter===daughter);
    assert.equal(rows.length,2);
    assert.equal(rows.filter(r=>r.origin==='original').length,1);
    assert.equal(rows.filter(r=>r.origin==='new').length,1);
    assert.deepEqual(rows.map(r=>r.direction),[['5′','3′'],['3′','5′']]);
    assert.deepEqual(rows.map(r=>read(r,p)),['ATGGCTTTTTAA','TACCGAAAAATT']);
    const newRow=rows.find(row=>row.origin==='new');
    assert.equal(newRow.bases.filter(base=>base.value===null).length,2);
  }
  assert.equal(L.snapshot(initial).daughterA,null);
  assert.equal(L.snapshot(initial).daughterB,null);
});

test('transcription uses one 3′→5′ DNA template to build 5′→3′ mRNA with U instead of T',()=>{
  const [template,mrna]=L.stage('transcribe').rows, p=solve('rna');
  assert.deepEqual(template.direction,['3′','5′']);
  assert.deepEqual(mrna.direction,['5′','3′']);
  assert.equal(read(template,p),'TACCGAAAAATT');
  const rnaMatch={T:'A',A:'U',C:'G',G:'C'};
  assert.equal([...read(template,p)].map(c=>rnaMatch[c]).join(''),'AUGGCUUUUUAA');
  assert.equal(read(mrna,p),'AUGGCUUUUUAA');
  assert.equal(L.snapshot(p).mrna,'AUGGCUUUUUAA');
  assert.doesNotMatch(read(mrna,p),/T/);
  assert.equal(L.place(p,'rna-product-1','T').ok,false);
});

test('translation reads AUG GCU UUU UAA, producing Met, Ala and Phe without a fourth amino acid',()=>{
  const [codons,product]=L.stage('chain').rows;
  assert.deepEqual(codons.bases.map(b=>b.value),['AUG','GCU','UUU','UAA']);
  assert.deepEqual(codons.direction,['5′','3′']);
  assert.equal(product.bases.every(b=>b.value===null),true);
  const p=solve('translate');
  assert.deepEqual(product.bases.map((_,i)=>L.getValue(product,i,p)),['Met','Ala','Phe','Stop']);
  assert.deepEqual(L.snapshot(p).amino,['Met','Ala','Phe']);
  assert.equal(L.snapshot(p).stop,true);
  assert.equal(L.CODONS[3].amino,null);
  const stopOnly=place(L.create(),'chain-product-3','Stop');
  assert.deepEqual(L.snapshot(stopOnly).amino,[]);
  assert.equal(L.complete('chain',stopOnly),false);
  const laterOnly=place(L.create(),'chain-product-2','Phe');
  assert.deepEqual(L.snapshot(laterOnly).amino,[],'partial chain is never shown out of order');
});

test('sort names each starting material and product without changing earlier placements',()=>{
  const intermediate=solve('copy');
  const selected=L.stage('sort');
  assert.deepEqual(selected.slots.map(s=>[s.id,s.expected]),[
    ['sort-copy','copy-product'],['sort-rna','rna-product'],['sort-chain','chain-product']
  ]);
  assert.equal(L.place(intermediate,'sort-copy','rna-product').progress,intermediate);
  const p=solve('sort',intermediate);
  assert.ok(L.complete('sort',p));
  assert.ok(L.complete('copy',p));
  assert.equal(L.complete('transcribe',p),false);
});

test('placements only fill real slots, preserve earlier state, and restore safely',()=>{
  const p=L.create(), q=place(p,'pair-lower-0','T');
  const no=L.place(q,'pair-lower-1','G');
  assert.equal(no.ok,false);
  assert.equal(no.progress,q);
  assert.equal(L.getValue('pair-lower',0,p),null);
  assert.equal(L.getValue('pair-lower',0,q),'T');
  assert.equal(L.getValue('pair-lower',1,q),null);
  assert.ok(Object.isFrozen(q.placed));
  assert.equal(L.place(q,'pair-upper-0','A').ok,false);
  assert.equal(L.check('copy','pair-lower-0','T').ok,false);
  assert.equal(L.check('build','pair-lower-0','T').ok,true);
  assert.equal(L.place(q,'pair-lower-0','T').progress,q);
  assert.deepEqual(L.restore(JSON.stringify(L.serialize(q))),q);
  assert.deepEqual(L.restore(null),p);
  for(const bad of ['{','null',{v:0,placed:{}},{v:1,placed:[]},{v:1,placed:{'pair-lower-0':'G'}},
    {v:1,placed:{'pair-upper-0':'A'}},JSON.parse('{"v":1,"placed":{"__proto__":true}}')]){
    assert.equal(L.restore(bad),null);
  }
});

test('nucleotide is the first step, with three separate active components and sugar as the only connector',()=>{
  const s=L.stage('nucleotide');
  assert.deepEqual(L.STAGES.map(x=>x.id),['nucleotide','pair','copy','transcribe','translate','sort']);
  assert.deepEqual(s.slots.map(x=>[x.id,x.expected]),[
    ['nucleotide-phosphate','phosphate'],['nucleotide-sugar','sugar'],['nucleotide-base','base']
  ]);
  assert.deepEqual(s.schematic.nodes.map(x=>[x.id,x.slotId]),s.slots.map(x=>[x.expected,x.id]));
  assert.deepEqual(s.schematic.bonds,[['phosphate','sugar'],['sugar','base']]);
  assert.equal(s.schematic.nodes.find(x=>x.id==='sugar').label,'Deoxyribose (DNA sugar)');
  assert.equal(s.schematic.nodes.find(x=>x.id==='base').label,'Adenine (A)');
  let p=L.create();
  assert.equal(L.complete('nucleotide',p),false);
  for(const [i,slot] of s.slots.entries()){
    assert.equal(L.getValue(slot.row,0,p),null,'every component remains unplaced until the student places it');
    for(const choice of slot.choices.filter(c=>c!==slot.expected)){
      const wrong=L.place(p,slot.id,choice);
      assert.equal(wrong.ok,false);
      assert.equal(wrong.progress,p);
    }
    p=place(p,slot.id,slot.expected);
    assert.equal(L.complete('nucleotide',p),i===2);
  }
  assert.equal(L.check('nucleotide','nucleotide-base','A').ok,false,'a loose base letter is not the component tile');
});

test('earlier v1 saves retain completed later steps while the new nucleotide step is empty',()=>{
  const legacy={v:1,placed:{'pair-lower-0':'T','pair-lower-1':'A','pair-lower-2':'C','pair-lower-4':'G','copy-daughter-a-new-2':'C','chain-product-3':'Stop'}};
  const existing=L.restore(JSON.stringify(legacy));
  assert.deepEqual(L.serialize(existing),legacy);
  assert.equal(L.complete('pair',existing),true);
  assert.equal(L.complete('nucleotide',existing),false);
  const updated=solve('nucleotide',existing);
  assert.equal(L.complete('nucleotide',updated),true);
  for(const [id,value] of Object.entries(legacy.placed))assert.equal(updated.placed[id],value);
  assert.equal(L.restore({v:1,placed:{'nucleotide-sugar':'base'}}),null);
});
