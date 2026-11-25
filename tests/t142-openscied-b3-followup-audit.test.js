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

function controllerSlice(name, start, end, env, use) {
  const source=content('openscied-b3-'+name+'.js');
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'controller slice exists');
  return JSON.parse(JSON.stringify(vm.runInNewContext(source.slice(a,b)+'\n'+use,env)));
}

test('Cancer exhibit exports retain the selected answers alongside the chart values',()=>{
  const selected={access:'falling',diagnosis:'rising','test-cost':''};
  const rows={access:[['Under $25,000','29.3%'],['$50,000–$74,999','12.6%']],
    diagnosis:[['Persistent poverty','46.6%'],['Other neighborhoods','58.2%']]};
  const answer={access:'It generally goes down.',diagnosis:'Less common in neighborhoods with persistent poverty.'};
  const notes=controllerSlice('cancer-rates','  function checkedCaseNotes(){','  function report(){',{
    state:{casework:selected}, $:id=>{
      const key=id.split('-')[1];
      return id.endsWith('-answer')?{options:[{value:selected[key],textContent:answer[key]}]}:{
        querySelectorAll:()=>rows[key].map(([group,amount])=>({querySelector:s=>({textContent:s==='span'?group:amount})})),
        querySelector:()=>({textContent:'Published source'})
      };
    }
  },'checkedCaseNotes()');
  assert.deepEqual(notes.map(note=>[note.letter,note.answer,note.rows]),[
    ['D',answer.access,rows.access],['E',answer.diagnosis,rows.diagnosis]
  ]);
});

test('Exhibit E is pinnable without implying unknown stages were late',()=>{
  const L=load('openscied-b3-cancer-rates-logic.js'),D=load('openscied-b3-cancer-rates-data.js');
  const pin=L.comparison(D,{view:'stage',measure:'early-share',a:'persistent',b:'other'});
  assert.equal(pin.a['early-share'],46.6);
  assert.equal(pin.b['early-share'],58.2);
  assert.equal(pin.difference,11.6);
  assert.equal(pin.a.diagnosed,101820);
  assert.equal(L.comparison(D,{view:'stage',measure:'late-share',a:'persistent',b:'other'}),null);
});

test('Cell Cycle chooses an age-only pair instead of a confounded first and last set',()=>{
  const groups=[
    {id:'1',age:20,tissue:'skin',size:'small'},
    {id:'2',age:40,tissue:'skin',size:'small'},
    {id:'3',age:60,tissue:'skin',size:'large'}
  ];
  const pair=controllerSlice('cell-cycle','  const comparisonKeys=','  function renderTrials(){',{groups},'controlledPair(groups,"age")');
  assert.deepEqual(pair,groups.slice(0,2));
});

test('Cell Cycle revision CTA gates on three responses, not keywords or arrow formatting',()=>{
  const fields={'model-revision':{value:'I revised the checkpoint in my model.'},'model-limit':{value:''},'model-prediction':{value:'Try another tissue.'},
    'analysis-next':{},'analysis-next-bottom':{},'analysis-finish-hint':{}};
  const r=controllerSlice('cell-cycle','  function updateAnalysisControls(){','  /* "Your data"',{analysisPage:3,$:key=>fields[key.slice(1)],fields},`
    updateAnalysisControls();
    const initiallyDisabled=fields['analysis-next'].disabled;
    fields['model-limit'].value='Does not show immune responses.';
    updateAnalysisControls();
    [initiallyDisabled,fields['analysis-next'].disabled,fields['analysis-next-bottom'].disabled,fields['analysis-next'].textContent]
  `);
  assert.deepEqual(r,[true,false,false,'Go to Wrap up →']);
});

test('Screening distinguishes ready, complete and editable recommendations',()=>{
  const fields=Object.fromEntries(['finish','edit-recommendation','claim','limit','finished'].map(id=>[id,{}]));
  const r=controllerSlice('screening','  function renderFinish(){','  function nav(step)',{
    $:id=>fields[id],fields,ready:()=>true,hasRecommendation:()=>true
  },`let done=false;const complete=()=>done;
    renderFinish(); const readyState=[fields.finish.disabled,fields.finish.hidden];
    done=true;renderFinish(); [readyState,fields.finish.hidden,fields['edit-recommendation'].hidden,fields.claim.readOnly,fields.finished.textContent]`);
  assert.deepEqual(r.slice(0,4),[[false,false],true,false,true]);
  assert.match(r[4],/Nothing is sent automatically/);
});

test('p53 core response IDs exclude partner feedback without losing the form',()=>{
  const peer={id:'peer-notes',tagName:'TEXTAREA',matches:()=>false,closest:s=>s==='[data-optional-peer]'};
  const core={id:'core-response',tagName:'TEXTAREA',matches:()=>false,closest:()=>false};
  const ids=controllerSlice('dna-p53','  function responseIds() {','  function wire() {',
    {$$:()=>[peer,core],optionalPeer:x=>Boolean(x.closest('[data-optional-peer]'))},'responseIds()');
  assert.deepEqual(ids,['core-response']);
});

test('Inheritance model tables label both gamete sets and retain real dose and fair-test selections',()=>{
  const state={meiosis:{runs:[{crossing:true,gametes:['AC','AD','BC','BD']}]},
    planner:{conditions:[{group:1,dark:true}],controls:['yeast','distance','days','agar','time']},
    yeast:{dishes:[{group:1,label:'SPF 30',strain:'wild',dose:0.5,colonies:14}]}};
  const result=controllerSlice('inheritance-environment','  function meiosisNodes() {','  const BOXES = ',{
    state,num:Number.isFinite,table:(title,columns,rows)=>({title,columns,rows}),el:(_a,_b,text)=>text,
  },'[meiosisNodes(),plannerNodes(),yeastNodes()]');
  assert.equal(result[0][0].rows[0][1],'No run recorded');
  assert.equal(result[0][0].rows[1][1],'AC, AD, BC, BD');
  assert.match(result[1][1],/UV time \(among exposed dishes\)/);
  assert.equal(result[2][0].rows[0][3],'0.50');
});
