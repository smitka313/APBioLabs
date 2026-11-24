'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const L=require('../openscied-b3-dna-workshop-logic.js');
const fs=require('node:fs'), path=require('node:path');
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

test('molecule sprite directly draws every referenced symbol and does not duplicate base geometries',()=>{
  const art=fs.readFileSync(path.join(__dirname,'../assets/dna-workshop-molecules.svg'),'utf8');
  const symbols=Object.fromEntries([...art.matchAll(/<symbol id="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g)]
    .map(([,id,drawing])=>[id,drawing.trim()]));
  const expect=['phosphate','sugar-deoxyribose','sugar-ribose','base-a','amino-met','amino-ala','amino-phe'];
  const families=[['dna','atcg'],['rna','aucg']].map(([kind,bases])=>
    [...bases].map(base=>'nucleotide-'+kind+'-'+base));
  for(const id of [...expect,...families.flat()]){
    assert.match(symbols[id]||'',/<(?:path|circle)\b/,id+' draws its own shapes');
    assert.doesNotMatch(symbols[id],/<use\b/,id+' does not depend on a nested reference');
  }
  for(const family of families){
    assert.equal(new Set(family.map(id=>symbols[id])).size,family.length,
      'different base labels have different schematics');
  }
});

test('actual DNA Workshop response and section navigation cannot overwrite newer or erased work',()=>{
  const vm=require('node:vm'), S=require('../openscied-save-session.js');
  const app=fs.readFileSync(path.join(__dirname,'../openscied-b3-dna-workshop.js'),'utf8');
  const key='aplab:openscied:b3-dna-workshop:v1', scope='b3-dna-workshop';
  const data=new Map();
  const storage={ getItem:key=>data.get(key)??null,setItem:(key,raw)=>data.set(key,raw),removeItem:key=>data.delete(key) };
  function tab(hash){
    const nodes=new Map(), events=new Map(), downloads=[];
    function element(){return { textContent:'',value:'',dataset:{},style:{}, events:{},
      classList:{remove(){},add(){},toggle(){}},
      addEventListener(type,fn){this.events[type]=fn;},
      setAttribute(){},removeAttribute(){},append(){},replaceChildren(){},focus(){},scrollIntoView(){},
      click(){if(this.download)downloads.push(this.download);else this.events.click?.();},
      remove(){},querySelector:get,querySelectorAll:()=>[] };
    }
    function get(s){ if(!nodes.has(s))nodes.set(s,element());return nodes.get(s); }
    const window={DNAWorkshopLogic:L,OpenSciEdSaveSession:S,
      Lab:{identity:{get:()=>JSON.parse(storage.getItem('aplab:student'))}},
      addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);} };
    const document={ querySelector:get,querySelectorAll:()=>[],createElement:element,createElementNS:element,body:element() };
    const location={hash};
    const Blob=function(parts){downloads.push(parts.join(''));};
    const env={ window,document,localStorage:storage,location,history:{replaceState(a,b,value){location.hash=value;}},
      Blob,URL:{createObjectURL:()=>'blob:fictional',revokeObjectURL(){}},setTimeout(){} };
    vm.runInNewContext(app,env);
    return {get,downloads,next(value){location.hash=value;events.get('hashchange').forEach(fn=>fn());},
      storageEvent(key){events.get('storage')?.forEach(fn=>fn({key}));} };
  }
  const scopeSteps=['nucleotide','build','copy','rna','chain','sort'];
  const first=solve('nucleotide');
  const all=L.STAGES.reduce((p,s)=>solve(s.id,p),L.create());
  const record=(progress,stage)=>JSON.stringify({v:1,step:stage,progress:L.serialize(progress),
    actions:Object.keys(progress.placed),answers:{},person:{},lastVisitedAt:17});
  storage.setItem(key,record(first,'nucleotide'));
  const older=tab('#nucleotide');
  storage.setItem(key,record(all,'sort'));
  const newer=tab('#sort');
  const retained=storage.getItem(key);
  older.next('#build');
  assert.equal(storage.getItem(key),retained);
  assert.match(older.get('#dw-save-conflict').textContent,/changed in another tab/);
  assert.equal(scopeSteps.filter(step=>L.complete(step,L.restore(JSON.parse(retained).progress))).length,6);
  assert.equal(S.erase(storage,scope,[key]).ok,true);
  newer.storageEvent(S.scopeKey(scope));
  newer.next('#nucleotide');
  assert.equal(storage.getItem(key),null);
  assert.match(newer.get('#dw-save-conflict').textContent,/cleared in another tab/);
  newer.get('#dw-response').events.input({target:{value:'Local answer to download'}});
  assert.equal(storage.getItem(key),null);
  newer.get('#dw-download').click();
  assert.match(newer.downloads[0],/Local answer to download/);

  storage.setItem('aplab:student',JSON.stringify({name:'Current QA',period:'4'}));
  const fresh=tab('#nucleotide');
  assert.equal(fresh.get('#dw-name').value,'Current QA');
  assert.equal(fresh.get('#dw-period').value,'4');
  fresh.get('#dw-response').events.input({target:{value:'An answer with inherited sign-in'}});
  assert.deepEqual(JSON.parse(storage.getItem(key)).person,{},'inherited fields are not stored as personal overrides');
  fresh.get('#dw-name').events.input({target:{value:'Teacher override'}});
  storage.setItem('aplab:student',JSON.stringify({name:'Changed QA',period:'5'}));fresh.storageEvent('aplab:student');
  assert.equal(fresh.get('#dw-name').value,'Teacher override');
  assert.equal(fresh.get('#dw-period').value,'5');
  fresh.get('#dw-download').click();
  assert.match(fresh.downloads[0],/Name: Teacher override/);
  assert.match(fresh.downloads[0],/Class period: 5/);
});
