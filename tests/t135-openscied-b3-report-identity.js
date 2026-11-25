/* Stale-editor export attribution: run the production builders for all five openscied-b3- activities.
   Fake identities and fake localStorage only; no student records or browser required. */
'use strict';
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Save = require('../openscied-save-session.js');
const CancerRatesLogic = require('../openscied-b3-cancer-rates-logic.js');
const cases = {
  'cancer-rates': {build:'report', next:'displayIdentity', identity:'displayIdentity', identityNext:'syncIdentity', text:true},
  'cell-cycle': {build:'download', end:'  // "Clear this activity"', identity:'studentIdentity', identityNext:'ANALYSIS_PROMPTS', constNext:true},
  'dna-p53': {build:'download', end:'  // Same rule', identity:'studentIdentity', identityNext:'hash32'},
  'dna-workshop': {build:'report', next:'download', text:true, workshop:true},
  'inheritance-environment': {build:'download', end:'  // Same rule', identity:'studentIdentity', identityNext:'num', constNext:true}
};
const excerpt = (src, start, end) => {
  const a = src.indexOf(start), b = src.indexOf(end, a + start.length);
  if (a === -1 || b === -1) throw Error('Source slice missing: ' + start + ' → ' + end);
  return src.slice(a, b);
};
let total = 0, pass = 0;
function check(ok, msg) {
  total++;
  if (ok) pass++;
  console.log((ok ? 'ok:   ' : 'FAIL: ') + msg);
}
for (const [name, spec] of Object.entries(cases)) {
  const scope = 'b3-' + name, isCancer = name === 'cancer-rates';
  const source = readFileSync(path.join(__dirname, '..', 'openscied-' + scope + '.js'), 'utf8');
  const key = 'aplab:openscied:' + scope + ':v1';
  const init = spec.workshop
    ? excerpt(source,"  const scope=",'  function conflict(')
    : excerpt(source,'  const saveScope','  const unavailableSave');
  const readIdentity = spec.workshop ? excerpt(source,'  const sharedIdentity','  function refreshIdentity(')
    : excerpt(source,'  function '+spec.identity+'(', '\n  '+(spec.constNext ? 'const ' : 'function ')+spec.identityNext);
  const builder = (isCancer ? excerpt(source,'  function checkedCaseNotes()','  function report()') : '') +
    excerpt(source,'  function '+spec.build+'(', spec.end || '  function '+spec.next+'(');
  function makeTab(initialPerson, override = {}) {
    let identity = initialPerson, exportText = '';
    const disk = new Map([[key, '{"test":"old saved work"}']]);
    const storage = { getItem:k=>disk.get(k)??null, setItem(k,v){disk.set(k,v);}, removeItem(k){disk.delete(k);} };
    const answer = 'Student A observation, still in the old tab';
    const questionDraft = 'Student A question revision, still in the old tab';
    const state = {
      answers:{intro:answer}, progress:{placed:{}}, fields:{shortAnswer:answer}, claim:answer, limits:'',
      prediction:{}, casework:{notes:{},...(isCancer?{opened:true,question:'Student A’s original question',questionDraft}: {})}, evidence:[], person:{name:'',period:'',...override},
      game:{}, trials:[], legacy:{}, expression:{}, question:null
    };
    const $ = () => ({href:''}), sourceLink = {source:'model',sourcePrintedPage:65,url:'https://example.test/data'};
    const context = {
      KEY:key, window:{localStorage:storage,OpenSciEdSaveSession:Save,Lab:{identity:{get:()=>identity}}},
      localStorage:storage, M:{}, state, invalid:false, decode:()=>state,
      $,
      D:{types:sourceLink,states:sourceLink,poverty:{...sourceLink,incomeSource:sourceLink},race:{incidence:sourceLink,mortality:sourceLink}},
      predictions:{}, isComplete:()=>false, lessonNotes:[], str:x=>String(x??''),
      STEPS:['intro'], LESSON:{intro:{title:'Introduction'}}, model:()=>({slots:[]}),
      save(){}, MAKING_SENSE_ROWS:[], MAKING_SENSE_PROMPTS:[], roundEvidence:()=>[],
      cardResult:()=>({}), parseVal:()=>'', CHECK_ROWS:[], RESPONSE_IDS:[], optionalWriting:()=>[],
      L:isCancer?CancerRatesLogic:{forkSummary:()=>null,explanationLevel:()=>null}, selfFlags:()=>[], SCENE_IDS:[],
      picks:()=>({}), chips:()=>[], textAnswers:()=>({}), orderSeq:()=>[],
      Blob:function(chunks){exportText=chunks.join('');},
      URL:{createObjectURL:()=>'',revokeObjectURL(){}}, setTimeout(){},
      document:{createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}}
    };
    context.Lab = context.window.Lab;
    vm.createContext(context);
    vm.runInContext([init,readIdentity,builder].join('\n'),context,{filename:'openscied-'+scope+'.js'});
    return {
      update(next){identity=next;},
      clear(){Save.erase(storage,null,[key]);},
      replace(){storage.setItem(key,'{"test":"newer tab save"}');},
      report(){
        if (spec.text) {
          const lines = context.report();
          return {name:/^Name: (.*)$/m.exec(lines)?.[1],period:/^Class period: (.*)$/m.exec(lines)?.[1],text:lines};
        }
        context.download();
        return {...JSON.parse(exportText).student,text:exportText};
      },
      answer, questionDraft,
    };
  }
  const old = {name:'Student A',period:'2'}, corrected = {name:'Student Aa',period:'3'}, newer = {name:'Student B',period:'7'};
  const a = makeTab(old);
  a.update(corrected);
  let output = a.report();
  check(output.name===corrected.name && output.period===corrected.period, scope+' honors current correction while save is valid');
  a.clear(); a.update(null);
  output = a.report();
  check(output.name===corrected.name && output.period===corrected.period && output.text.includes(a.answer),
    scope+' keeps the old open work attributed to its previous name immediately after sign-out');
  a.update(newer);
  output = a.report();
  check(output.name===corrected.name && output.period===corrected.period && !output.text.includes(newer.name),
    scope+' does not relabel previous work after next student signs in');
  if (isCancer) {
    check(output.text.includes('QUESTION DRAFT (NOT SUBMITTED)') && output.text.includes(a.questionDraft),
      scope+' keeps the saved question revision in the original student’s recovery export');
  }
  const replaced = makeTab(old);
  replaced.replace(); replaced.update(newer);
  check(replaced.report().name===old.name, scope+' rejects new identity fallback once another tab replaced its guarded record');
  const anonymous = makeTab(null);
  anonymous.clear(); anonymous.update(newer);
  output = anonymous.report();
  check(!output.name && !output.period && output.text.includes(anonymous.answer),
    scope+' keeps anonymous recovery anonymous instead of using the next identity');
  if (name==='cancer-rates' || spec.workshop) {
    const explicit = makeTab(old,{name:'My activity label'});
    explicit.clear(); explicit.update(newer);
    output = explicit.report();
    check(output.name==='My activity label' && output.period===old.period,
      scope+' keeps an explicit activity field and protects the shared fallback for the other field');
  }
}
console.log('t135-openscied-b3-report-identity: '+pass+'/'+total+' checks passed');
if (pass !== total) process.exitCode = 1;
