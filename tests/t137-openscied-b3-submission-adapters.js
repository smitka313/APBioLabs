/* Test the five production openscied-b3- submission collectors with synthetic activity data. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const draft = 'draft', final = 'final', recovery = 'recovery';
let checked = 0;
function check(value, description) {
  assert.ok(value, description); checked++; console.log('ok: ' + description);
}
const root = path.join(__dirname,'..'), answer = 'My synthetic student answer <not markup>';
const configuration = [
  ['cancer-rates', 'cr-download', () => {
    const datum={source:'OpenSciEd synthetic fixture',period:'2021 fixture',url:'https://example.test/source'};
    const casework={opened:false,notes:{},questionDraft:answer};
    const state={prediction:{locked:false,choice:'a',reason:answer},casework,evidence:[],claim:'',limits:'',design:{}};
    return {state,ctx:{
      invalid:false,blocked:false,caseMarks:()=>Array(6).fill(casework.opened),canFinish:()=>state.completed,isComplete:()=>state.completed,
      displayIdentity:()=>({name:'Custom name',period:'2'}),predictions:{a:'Different'},
      lessonNotes:['diagnoses','deaths','map'],testCostRows:[{label:'First event',value:1}],$(){return {href:datum.url};},
      designItems:{access:'Access evidence'},formatPair:()=> '18.2 per 100,000',evidenceText:()=> 'Published result',
      L:{comparison:()=>({a:{name:'Group A'},b:{name:'Group B'}})},spec:{types:{title:'Ranking'}}, labels:{incidence:'Diagnosis rate'},
      D:{types:datum,states:datum,poverty:{...datum,incomeSource:datum},race:{incidence:datum,mortality:datum}}
    },finish(){
      Object.assign(state,{completed:true,claim:answer,limits:'Association is not causation.'});
      Object.assign(casework,{opened:true,question:answer,'test-cost':true}); state.prediction.locked=true;state.evidence.push({view:'types',measure:'incidence'});
    },specific:s=>s.student.name==='Custom name' && JSON.stringify(s.sections).includes('per 100,000')};
  }],
  ['cell-cycle','download-work',() => {
    const state={game:{roundResults:{}},quick:'Recorded',mechanism:'Recorded'};
    const rows=[['g1','Phase: G1']], sense=['ms-r1-g1-happened','ms-r1-g1-represent'], ids=[...sense,'analysis'];
    const groups=[],fields={analysis:answer};
    return {state,ctx:{
      $:sel=>({value:fields[sel.slice(1)]||''}),roundEvidence:n=>state.game.roundResults[n],trialGroups:()=>groups,
      setLabel:g=>'Set '+g.index,MAKING_SENSE_ROWS:rows,MAKING_SENSE_IDS:sense,MAKING_SENSE_PROMPTS:[],ANALYSIS_PROMPTS:[['Analysis','analysis']],RESPONSE_IDS:ids
    },finish(){
      state.game.roundResults={1:{legacy:true},2:{blue:0,red:0,destroyed:3,turns:7,endedBy:'early'}};
      const settings=[{age:50,size:'average',tissue:'skin'}, {age:50,size:'average',tissue:'skin'}];
      for (const [i,c] of settings.entries()) groups.push({index:i+1,...c,trials:Array(3).fill({...c,divisions:0,modelVersion:2,cancerCount:0}),mean:0,changes:[null,0,0]});
      sense.forEach(id=>fields[id]=answer);
    },beforeMore:s=>s.status===draft && s.missing.some(x=>x.includes('differ only in age')),
    more(){
      for (const c of [{age:70,size:'average',tissue:'skin'}, {age:50,size:'large',tissue:'skin'}, {age:50,size:'average',tissue:'colon'}]){
        groups.push({index:groups.length+1,...c,trials:Array(3).fill({...c,divisions:0,modelVersion:2,cancerCount:0}),mean:0,changes:[null,0,0]});
      }
    },specific:s=>JSON.stringify(s.sections).includes('Ended early') && JSON.stringify(s.sections).includes('Not recorded')};
  }],
  ['dna-p53','download-work',() => {
    const state={fork:null,expression:{runs:[]},legacy:{retired:answer}}, answers={a:answer};
    const table={caption:{textContent:'DNA evidence'},tHead:{rows:[{cells:[{textContent:'Strand'}]}]},tBodies:[{rows:[{cells:[{textContent:'Top'}]}]}]};
    return {state,ctx:{
      L:{forkSummary:x=>x},RESPONSE_IDS:['a','b'],labelFor:id=>id,answerFor:id=>answers[id],
      forkDataNodes:()=>state.fork?[{querySelector:()=>table}]:[],expressionDataNodes:()=>[],optionalWriting:()=>[['Optional',answer]],
      OLD_LABELS:{retired:'Earlier response'}
    },finish(){state.fork={hasBefore:true,hasAfter:true,p53:{a:{tried:1}}};state.expression.runs.push({strand:'A'},{strand:'A'});answers.b='My paired-strand comparison.';},
    beforeMore:s=>s.status===draft && s.missing.some(x=>x.includes('strands B, C')),
    more(){state.expression.runs.push({strand:'B'},{strand:'C'});},
    specific:s=>JSON.stringify(s.sections).includes('Earlier saved responses') && JSON.stringify(s.sections).includes('DNA evidence')};
  }],
  ['dna-workshop','dw-download',() => {
    const state={person:{period:'4'},answers:{build:answer},progress:{placed:{}}},steps=['build','copy'];
    return {state,ctx:{invalid:false,blocked:false,sharedIdentity:()=>({name:'Student name',period:'2'}),STEPS:steps,
      LESSON:{build:{title:'Build',prompt:'What did you build?'},copy:{title:'Copy',prompt:'What did you copy?'}},
      complete:id=>id in state.progress.placed,model:id=>({slots:[{id}]}),evidence:id=>[{label:id,result:'A–T'}]
    },finish(){state.progress.placed={build:'A',copy:'T'};},
    specific:s=>s.student.period==='4' && JSON.stringify(s.sections).includes('A–T')};
  }],
  ['inheritance-environment','download-work',() => {
    const state={pedigree:{},planner:{},yeast:{},question:null},answers=[{id:'wrap-sentence',prompt:'Genes and chance',answer}],choices=[{id:'exit-q1',question:'What varied?',answer:'',value:''}],sequence=[];
    const selectedChips = [];
    return {state,ctx:{picks:()=>choices,chips:()=>[{id:'cer-evidence',question:'Evidence chips',chosen:selectedChips}],
      textAnswers:()=>answers,orderSeq:()=>sequence,BOXES:[],L:{checkOrder:r=>({status:r.length?'correct':'empty'})},
      STEP_LABELS:{copy:'DNA copied'}
    },finish(){
      Object.assign(state,{skin:{viewed:{black:true}},planner:{ready:true},yeast:{dishes:[{colonies:0}]},question:{text:'My testable question',ok:true}});
    },beforeMore:s=>s.status===draft && s.missing.some(x=>x.includes('claim, evidence and reasoning')),
    more(){
      choices.push({id:'cer-claim',value:'a',question:'Claim',answer:'I noticed a difference.'},{id:'cer-reason',value:'a',question:'Reason',answer:'My dish evidence.'});
      selectedChips.push('My observation');
    },specific:s=>s.title==='Environment & UV Evidence · Lesson 9' && JSON.stringify(s.sections).includes('My observation') && JSON.stringify(s.sections).includes('Eide and Weinstock')};
  }]
];
for (const [activity,legacy,fixture] of configuration) {
  const name='openscied-b3-'+activity;
  const source=fs.readFileSync(path.join(root,name+'.js'),'utf8');
  const html=fs.readFileSync(path.join(root,name+'.html'),'utf8');
  const ctor=source.indexOf('  function submissionReport()'), mount=source.indexOf('\n  window.OpenSciEdSubmission?.mount',ctor);
  check(ctor >= 0 && mount > ctor,'has a live adapter: ' + activity);
  const launch=html.indexOf('id="ose-submission-report"');
  check(launch>0 && html.indexOf('id="'+legacy+'"')>0 && html.includes('href="openscied-submission-report.css"') &&
    html.indexOf('src="openscied-submission-report.js"') < html.indexOf('src="'+name+'.js?'),
    'loads the submission layer and retains the original export: ' + activity);
  const backups = html.match(/<details class="ose-report-other"><summary>Other downloads and backups<\/summary>[\s\S]*?<\/details>/);
  check(backups?.[0].includes('id="'+legacy+'"'), 'legacy control is inside one collapsed backup menu: ' + activity);
  const finals = [...html.matchAll(/data-ose-report-final/g)];
  check(finals.length === (activity === 'dna-workshop' ? 0 : 1), 'single final launcher slot only when needed: ' + activity);

  if (['cell-cycle','dna-p53','inheritance-environment'].includes(activity)) {
    check(launch>html.lastIndexOf('</section>',html.indexOf('</main>')),'partial report launcher is outside hidden steps: '+activity);
  }
  let current=true;
  const config=fixture(), sandbox={
    KEY:'test',saveSession:{check:()=>({ok:current,reason:current?null:'erased'})},studentIdentity:()=>({name:'Trusted fallback',period:'2'}),
    state:config.state,...config.ctx
  };
  vm.createContext(sandbox);vm.runInContext(source.slice(ctor,mount),sandbox);
  const initial=sandbox.submissionReport();
  check(initial.status===draft && initial.missing.length>0 && JSON.stringify(initial.sections).includes(answer),'retains actual partial work in a draft: '+activity);
  config.finish();
  if (config.beforeMore) check(config.beforeMore(sandbox.submissionReport()), 'does not mark a report final without the assigned evidence: '+activity);
  config.more?.();
  const ready=sandbox.submissionReport();
  check(ready.status===final && !ready.missing.length && config.specific(ready),'final requires work and reports real evidence: '+activity);
  current=false;
  const stale=sandbox.submissionReport();
  check(stale.status===recovery && JSON.stringify(stale.student)===JSON.stringify(ready.student) && JSON.stringify(stale.sections)===JSON.stringify(ready.sections),
    'stale report remains recoverable and cannot be falsely final: '+activity);
  check(!ready.datasetId && ready.source && ready.keyResults.length && ready.sections.length,'adds evidence provenance, but never fabricates an identifier: '+activity);
}
console.log('t137-openscied-b3-submission-adapters: '+checked+' checks passed');
