/* Exact browser-controller slices with small synthetic input to exercise report semantics.
   The browser progression suites exercise the actual controls, reload and downloads. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.U3_FIXTURE_ROOT || path.resolve(__dirname,'..');
const load = name => require(path.join(root,name));
const content = name => fs.readFileSync(path.join(root,name),'utf8');

test('Published unavailable numbers are not eligible Cancer comparisons; zero difference still counts', () => {
  const L=load('openscied-b3-cancer-rates-logic.js');
  const D=load('openscied-b3-cancer-rates-data.js');
  const missing=L.comparison(D,{view:'michigan',measure:'late-rate',a:'26001',b:'26005'});
  assert.equal(missing.difference,null); // Actual unavailable Alcona rate, not a 0.
  assert.equal(L.isNumericComparison(missing),false);
  assert.equal(L.isNumericComparison({difference:0}),true);
  assert.equal(L.isNumericComparison(null),false);
});

test('A Cancer question revision remains independent of the committed question', () => {
  const L=load('openscied-b3-cancer-rates-logic.js');
  assert.equal(L.hasPendingQuestion({question:'Original question',questionDraft:'Revised question'}),true);
  assert.equal(L.hasPendingQuestion({question:'Original question',questionDraft:''}),true);
  assert.equal(L.hasPendingQuestion({question:'Original question',questionDraft:' Original question '}),false);
  assert.equal(L.hasPendingQuestion({question:'Original question',questionDraft:null}),false);
});

function lesson9(prior) {
  const file=content('openscied-b3-inheritance-environment.js');
  const code=file.slice(file.indexOf('  function submissionReport() {'),file.indexOf('  window.OpenSciEdSubmission?.mount'));
  const raw=vm.runInNewContext(code+'\nsubmissionReport()',{
    state:{skin:{viewed:{white:true}},planner:{ready:true},yeast:{dishes:[{colonies:12}]},
      question:{ok:true,text:'What changes the number of colonies?'}},
    picks:()=>[{id:'family-question',question:'Unanswered family prompt',value:''},...prior,
      {id:'cer-claim',question:'What happened?',value:'a',answer:'More UV, fewer colonies.'},
      {id:'cer-reason',question:'Why?',value:'a',answer:'UV damages DNA.'}],
    chips:()=>[{id:'cer-evidence',question:'Evidence',chosen:['Fewer colonies under UV']}],
    textAnswers:()=>[{id:'wrap-sentence',prompt:'Wrap-up',answer:'UV matters.'}],
    orderSeq:()=>[], L:{checkOrder:()=>({status:'unanswered'})}, STEP_LABELS:{},
    SECTIONS:['overview','ideas','envideas'], $$:(selector,section)=>section?
      [{dataset:{id:'family-question'}},{dataset:{id:'family-earlier'}}]:
      [{id:'overview'},{id:'ideas'},{id:'envideas'}],
    BOXES:Array.from({length:6},(_,i)=>['model'+i,()=>[]]),
    saveSession:{check:()=>({ok:true})}, studentIdentity:()=>null, KEY:'example'
  });
  return JSON.parse(JSON.stringify(raw));
}
test('Lesson 9 report excludes unassigned, untouched family prompts and model rows',()=>{
  const r=lesson9([]);
  assert.equal(r.status,'final');
  assert.match(r.title,/Lesson 9/);
  assert.doesNotMatch(JSON.stringify(r),/Unanswered family prompt|Lakita|Two-gene|Earlier Lesson 8/);
  assert.equal(r.keyResults[1].value,'2 of 2');
});
test('Lesson 9 report retains prior family work under a separate title',()=>{
  const r=lesson9([{id:'family-earlier',question:'Earlier response prompt',value:'a',answer:'My earlier response'}]);
  const earlier=r.sections.find(s=>s.title.startsWith('Earlier Lesson 8'));
  assert.equal(earlier?.items[0]?.value,'My earlier response');
  assert.doesNotMatch(JSON.stringify(r.sections.filter(s=>s!==earlier)),/My earlier response/);
});
