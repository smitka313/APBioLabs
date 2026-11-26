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
  const trackerCode=file.slice(file.indexOf('  function progressTracker()'),file.indexOf('  function textAnswers()'));
  const tracker={fields:[{parentElement:{textContent:'How melanin protects.'},checked:true}]};
  const raw=vm.runInNewContext(trackerCode+code+'\nsubmissionReport()',{
    state:{skin:{viewed:{white:true}},planner:{ready:true},yeast:{dishes:[{colonies:12}]},
      question:{ok:true,text:'What changes the number of colonies?'}},
    picks:()=>[{id:'family-question',question:'Unanswered family prompt',value:''},...prior,
      {id:'cer-claim',question:'What happened?',value:'a',answer:'More UV, fewer colonies.'},
      {id:'cer-reason',question:'Why?',value:'a',answer:'UV damages DNA.'}],
    chips:()=>[{id:'cer-evidence',question:'Evidence',chosen:['Fewer colonies under UV']}],
    textAnswers:()=>[{id:'wrap-sentence',prompt:'Wrap-up',answer:'UV matters.'}],
    orderSeq:()=>[], L:{checkOrder:()=>({status:'unanswered'})}, STEP_LABELS:{},
    SECTIONS:['overview','ideas','envideas'], $:selector=>selector==='fieldset.tracker[data-id="tracker"]'?tracker:null,
    $$:(selector,section)=>section===tracker?tracker.fields:section?
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
  assert.deepEqual(r.sections.find(s=>s.title==='My progress tracker')?.items[0]?.rows,[['How melanin protects.','Checked']]);
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


test('Screening shows current counts after rechecking instead of the earlier redesign snapshot',()=>{
  const s={caseChecks:[]},caseIds=[1,2,3];
  const results=controllerSlice('screening','  const comparisonCount=','  function drawCases(){',{
    s,caseIds,ready:()=>s.caseChecks.length===caseIds.length
  },`const counts=[redesignStatus()];s.caseChecks=[1,2,3];counts.push(redesignStatus());
    s.caseChecks=[1,3];counts.push(redesignStatus());counts`);
  assert.match(results[0],/0 of 3.*remaining cases/);
  assert.match(results[1],/3 of 3.*All comparisons are current/);
  assert.match(results[2],/2 of 3.*remaining cases/);
});

test('Screening provides ordered and honest trip steps when driving is stopped or completed',()=>{
  const card={place:'North Fork',screen:{place:'hub'},scan:{place:'mobile'}};
  const route=controllerSlice('screening','  function itinerary(p){','  function drawItinerary(',{
    card, label:k=>k==='hub'?'the hospital':'the mobile clinic'
  },`['screen-missed','follow-up-missed','imaged'].map(outcome=>itinerary({...card,outcome}))`);
  assert.equal(route[0].length,2);
  assert.match(route[0].at(-1),/^No drive to the hospital/);
  assert.equal(route[1].length,4);
  assert.match(route[1].at(-1),/^No follow-up drive to the mobile clinic/);
  assert.equal(route[2].length,4);
  assert.match(route[2].at(-1),/^Drive to the mobile clinic for ultrasound follow-up/);
});

test('Inheritance attributes graph evidence and keeps a contradicted dish claim visibly unsupported',()=>{
  const L=load('openscied-b3-inheritance-logic.js');
  const dish=(spf,colonies)=>({strain:'sensitive',spf,dose:15/spf,colonies,minutes:15});
  const verdicts=controllerSlice('inheritance-environment','  const EV_KEY =','  function renderClaim(speak)',{
    L,num:Number.isFinite,dishes:[dish(15,180),dish(30,140),dish(50,100)]
  },'evidenceVerdicts(dishes)');
  assert.equal(verdicts['cer-ev-3'].status,'unsupported');
  assert.match(verdicts['cer-ev-3'].message,/UV-sensitive dishes do not show this/);
  assert.equal(verdicts['cer-ev-4'].status,'supported');
  assert.match(verdicts['cer-ev-4'].message,/White-labeled graph.*not proof of cause/);
});

test('Cell Cycle distinguishes the round limit count from the actions count',()=>{
  const r={playerTurns:[18],turns:22};
  const values=controllerSlice('cell-cycle','  const TURN_LIMIT_LABEL=','  // Why the round ended,',{
    r
  },'[TURN_LIMIT_LABEL,ACTION_LABEL,turnSlots(r),r.turns,turnSlots({turns:22}),TURN_COUNT_NOTE]');
  assert.deepEqual(values.slice(2,5),[18,22,'Not recorded']);
  assert.match(values[0],/including skipped turns/);
  assert.match(values[1],/including extra rolls/);
  assert.match(values[5],/checkpoint-card flips/);
});

test('A visible p53 (c) control registers a test after the strand is repaired',()=>{
  const scene=content('dna-replication-scene.js');
  const code=scene.slice(scene.indexOf('    function doP53(v, k)'),scene.indexOf('    function doReset()'));
  const L=load('openscied-b3-dna-p53-logic.js');
  const result=vm.runInNewContext(`let held={},busy=false,lastResult='',saved=0;
    const anim={},sites={top:'cc'},p53={c:{tried:0,removed:0}};
    const stage=()=> 'complete',persist=()=>saved++,say=()=>{},refresh=()=>{},dur=()=>0;
    ${code}
    doP53('c','top');[p53.c.tried,p53.c.removed,sites.top,saved,lastResult]`,
    {L,NAME:{top:'top strand'},P53_PATH:{c:true}});
  assert.deepEqual([...result.slice(0,4)],[1,0,'cc',1]);
  assert.match(result[4],/no substitution there/);
});
