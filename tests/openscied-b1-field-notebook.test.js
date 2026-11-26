'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../openscied-b1-field-notebook-logic.js');

test('five unique stations with lesson source references, and no automatic evidence on entry',()=>{
  assert.deepEqual(M.stations.map(s=>s.id),['habitats','biodiversity','movement','conservation','people']);
  assert.equal(new Set(M.stations.map(s=>s.place)).size,5);
  assert.ok(M.stations.every(s=>s.evidence && s.prompt && M.references[s.id]));
  assert.deepEqual(M.progress(M.clean(null)),{questions:false,used:0,evidence:false,ready:false,complete:false,started:false,done:0});
});

test('duplicate questions do not unlock stations, and a note plus pin on one station counts once',()=>{
  const s=M.clean({v:1,fields:{question1:'Who decided?',question2:' who decided? ',movement:'Herds moved beyond the park.'},
    pins:['movement','movement','nope'],finished:true});
  assert.equal(M.progress(s).questions,false);
  assert.equal(M.progress(s).used,1);
  s.fields.question2='What did researchers notice?';
  assert.equal(M.progress(s).evidence,false);
  s.pins.push('people');
  assert.equal(M.progress(s).evidence,true);
  assert.equal(M.progress(s).complete,false);
});

test('completion requires two distinct stations, a claim, a question, and Finish',()=>{
  const s=M.clean({v:1,fields:{question1:'Why protect it?',question2:'What changed?',claim:'The herds left the park.',wonder:'Where did they head?'},pins:['movement','people']});
  assert.equal(M.progress(s).done,2);
  assert.equal(M.progress(s).ready,true);
  s.finished=true;assert.equal(M.progress(s).done,3);
  assert.equal(M.progress(M.clean(JSON.parse(JSON.stringify(s)))).complete,true);
  s.pins.pop();assert.equal(M.progress(s).complete,false);
});

test('malformed work is not treated as empty and unknown fields do not affect the notebook',()=>{
  assert.throws(()=>M.clean({v:1,fields:[]}),/Invalid notebook/);
  assert.throws(()=>M.clean({v:99,fields:{}}),/Invalid notebook/);
  const s=M.clean({v:1,fields:{unrelated:'unknown',wonder:'€'.repeat(2000)}, step:'missing'});
  assert.deepEqual(Object.keys(s.fields),['wonder']);
  assert.equal(s.fields.wonder.length,M.limit);
  assert.equal(s.step,'orient');
});

test('all four original videos are optional, caption-preferred in-page players with a fallback',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../openscied-b1-field-notebook.html'),'utf8');
  const ids=['Pg35n6elF3Y','iPyB3Gw6fBY','7JOk6ivcuco','cVj4883yzeO'];
  const frames=[...html.matchAll(/<template><iframe[^>]+\/embed\/([\w-]+)\?cc_load_policy=1[^>]*><\/iframe><\/template>/g)].map(m=>m[1]);
  assert.deepEqual(frames,ids);
  ids.forEach(id=>assert.ok(html.includes('https://youtu.be/'+id+'"')));
});
