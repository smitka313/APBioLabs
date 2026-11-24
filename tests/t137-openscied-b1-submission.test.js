'use strict';
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const root = process.env.B1_REPORT_ROOT || require('node:path').resolve(__dirname,'..');
const files = {
  migration:['function reportText(kind)', 'migration-submission', 'download-report'],
  'carrying-capacity':['const report =', 'cc-submission', 'cc-download'],
  serengeti:['function evidenceFile()', 'sg-submission', 'sg-download']
};
const source=(name,ext)=>readFileSync(root+'/openscied-b1-'+name+'.'+ext,'utf8');
function collect(name,context){
  const js=source(name,'js');
  const helper=name==='migration'?js.indexOf('  function unsavedMonthDrafts('):-1;
  const start=helper>=0?helper:js.indexOf('  function submissionData('), end=js.indexOf('\n  '+files[name][0],start);
  assert.ok(start>=0&&end>start,'activity provides its classroom adapter');
  const key=workKeys[name][0];
  return vm.runInNewContext(js.slice(start,end)+'\nsubmissionData()',{
    KEY:key,S:key,keys:workKeys[name],saveSession:{check:()=>({ok:true})},...context
  });
}
const plain=value=>JSON.parse(JSON.stringify(value));
const workKeys={
  migration:['aplab:openscied:b1-migration:v1'],
  'carrying-capacity':['aplab:openscied-b1-carrying-capacity:run-v1',
    ...['habitat','range','field'].map(part=>'aplab:openscied:b1-carrying-capacity:'+part+':v1')],
  serengeti:['aplab:openscied-b1-serengeti:preview-v1']
};
const Save=require('../openscied-save-session.js');
function checkRetired(name, context, scenario) {
  const keys=workKeys[name], records=new Map(keys.map(k=>[k,'{"v":1}']));
  const storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
  const saveSession=Save.open(storage,'b1-'+name,keys);
  let student={name:'Earlier fictional student',period:'2'};
  const reportIdentity=Save.reportIdentity(saveSession,keys,()=>student);
  const collectReport=()=>collect(name,{...context,saveSession,reportIdentity});
  assert.equal(collectReport().status,'final');
  if(scenario==='changed') storage.setItem(keys.at(-1),'{"v":1,"more":true}');
  else Save.erase(storage,null,keys);
  student={name:'Next fictional student',period:'7'};
  assert.equal(saveSession.check(keys.at(-1)).reason,scenario);
  const copy=collectReport();
  assert.equal(copy.status,'recovery');
  assert.equal(copy.student.name,'Earlier fictional student');
  assert.match(copy.missing.join(' '),/Download it before reloading/);
  assert.equal(storage.getItem(keys.at(-1)),scenario==='changed'?'{"v":1,"more":true}':null);
}


test('Unit 1 offers one visible-step report slot and hides legacy downloads in a closed disclosure',()=>{
  for(const [slug,[,target,legacy]] of Object.entries(files)){
    const page=source(slug,'html'), js=source(slug,'js');
    assert.ok(page.indexOf('openscied-submission-report.js')>=0&&page.indexOf('openscied-submission-report.js')<page.indexOf('openscied-b1-'+slug+'.js'));
    assert.match(page,new RegExp('href="openscied-submission-report.css"'));
    for(const id of [target,legacy])assert.equal(page.match(new RegExp('id="'+id+'"','g'))?.length,1);
    const slot=page.indexOf('<div data-ose-report-final></div>');
    assert.ok(slot>=0&&slot===page.lastIndexOf('<div data-ose-report-final></div>'));
    assert.ok(slot<page.indexOf('id="'+legacy+'"'));
    assert.doesNotMatch(page,new RegExp('href="#'+target+'"'));
    const disclosure=page.match(/<details([^>]*data-ose-report-legacy[^>]*)>\s*<summary>Other downloads and backups<\/summary>([\s\S]*?)<\/details>/);
    assert.ok(disclosure&&disclosure[2].includes('id="'+legacy+'"'));
    assert.doesNotMatch(disclosure[1],/\bopen\b/);
    assert.match(page,new RegExp('<div id="'+target+'" tabindex="-1"></div>\\s*</main>'));
    assert.match(js,new RegExp("target:'#"+target+"',collect:submissionData"));
  }
});

test('Migration separates saved observation coverage from visits, gives evidence its source and labels recovery',()=>{
  const prompts=Array.from({length:10},(_,i)=>['q'+i,'Question '+i]);
  const months=Array.from({length:12},(_,i)=>i);
  const state={visited:months,notes:[{id:'rainfall-example',title:'Published data',text:'Selected field data'}],
    answers:Object.fromEntries(prompts.map(([id])=>[id,'A response']))};
  const ctx={state, RESPONSES:prompts, L:{MONTHS:require('../migration-logic.js').MONTHS,monthsWithNotes:n=>n.filter(x=>x.obs).map(x=>x.month)},
    ANNUAL:[{region:'North',rain:1310,occupancy:6}],ANNUAL_SOURCE:'Classroom data',ANNUAL_URL:'https://openscied.org/',
    reportIdentity:recovery=>recovery?null:{name:'Original student',period:'2'},corrupt:false,displayNoteText:n=>n.text};
  let r=collect('migration',ctx);
  assert.equal(r.status,'draft');
  assert.match(r.missing[0],/0 of 12/);
  assert.deepEqual(plain(r.sections.at(-1).items[0].rows),[['North',1310,6]]);
  state.notes.push(...months.map(month=>({id:'month-'+month,title:'Month '+month,text:'Observation',obs:true,month})));
  r=collect('migration',ctx);
  assert.equal(r.status,'final'); assert.equal(r.student.name,'Original student'); assert.equal(r.datasetId,undefined);
  checkRetired('migration',ctx,'erased');
  r=collect('migration',{...ctx,corrupt:true});
  assert.equal(r.status,'recovery'); assert.equal(r.student,null);
});

test('Migration draft and recovery files preserve new month drafts and revisions separately from saved notes',()=>{
  const L=require('../migration-logic.js'),KEY=workKeys.migration[0],RESPONSES=[['q','A prompt']];
  const note=L.upsertMonthlyNote([],0,'January prior saved note').notes;
  const saved=L.upsertMonthlyNote(note,3,'April already recorded').notes;
  const state={notes:saved,answers:{q:'A response'},observations:{
    0:'January revised draft',3:'  April already recorded  ',7:'  ',8:'September new draft',12:'Out of range'
  }};
  const map=new Map([[KEY,JSON.stringify(state)]]);
  const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const saveSession=Save.open(storage,'b1-migration',[KEY]);
  let who={name:'First fictional student',period:'2'};
  const reportIdentity=Save.reportIdentity(saveSession,[KEY],()=>who);
  const ctx={state,KEY,L,RESPONSES,saveSession,reportIdentity,corrupt:false,displayNoteText:L.notebookText};
  const drafts=report=>report.sections.find(s=>s.title==='Month drafts · not in the notebook');
  let report=collect('migration',ctx);
  assert.equal(report.status,'draft');
  assert.equal(report.keyResults[0].value,'2 / 12');
  assert.match(report.sections[0].items[0].value,/January prior saved note/);
  assert.deepEqual(plain(drafts(report)?.items.slice(1)??null),[
    {type:'answer',prompt:'January · draft revision',value:'January revised draft'},
    {type:'answer',prompt:'September · draft observation',value:'September new draft'}
  ]);
  assert.match(drafts(report).items[0].text,/do not count as saved month notes/);
  Save.erase(storage,null,[KEY]);
  who={name:'Different fictional student',period:'7'};
  report=collect('migration',ctx);
  assert.equal(report.status,'recovery');
  assert.equal(report.student.name,'First fictional student');
  assert.equal(report.student.period,'2');
  assert.ok(drafts(report).items.some(d=>d.value==='January revised draft'));
  assert.ok(drafts(report).items.some(d=>d.value==='September new draft'));
  assert.equal(storage.getItem(KEY),null);
  const js=source('migration','js');
  const from=js.includes('  function unsavedMonthDrafts(')?'  function unsavedMonthDrafts(':'  function submissionData(';
  const exports=vm.runInNewContext(js.slice(js.indexOf(from),js.indexOf('  function textCopy('))+
    '\n[reportText("investigation"),reportText("notebook")]',ctx);
  for(const file of exports){
    assert.match(file,/Name: First fictional student/);
    assert.match(file,/January prior saved note/);
    assert.match(file,/MONTH DRAFTS \(NOT IN THE NOTEBOOK\)/);
    assert.match(file,/January · draft revision\nJanuary revised draft/);
    assert.match(file,/September · draft observation\nSeptember new draft/);
    assert.doesNotMatch(file,/Different fictional student|Out of range/);
    assert.equal(file.match(/April already recorded/g)?.length,1);
  }
});

test('Saved month drafts stop being drafts without changing assignment completion rules',()=>{
  const L=require('../migration-logic.js'),RESPONSES=[['q','A prompt']];
  const state={notes:[],answers:{q:'A response'},observations:{}};
  L.MONTHS.forEach((month,i)=>{
    state.observations[i]=month+' note';
    state.notes=L.upsertMonthlyNote(state.notes,i,state.observations[i]).notes;
  });
  state.observations[4]='May revision';
  const ctx={state,L,RESPONSES,corrupt:false,reportIdentity:()=>null,displayNoteText:L.notebookText};
  let report=collect('migration',ctx);
  assert.equal(report.status,'final');
  assert.equal(report.keyResults[0].value,'12 / 12');
  assert.equal(report.sections.at(-1).title,'Month drafts · not in the notebook');
  state.notes=L.upsertMonthlyNote(state.notes,4,state.observations[4]).notes;
  report=collect('migration',ctx);
  assert.equal(report.status,'final');
  assert.equal(report.keyResults[0].value,'12 / 12');
  assert.ok(!report.sections.some(s=>s.title.startsWith('Month drafts')));
  assert.match(report.sections[0].items[4].value,/May revision/);
});

test('Carrying Capacity requires two full runs, prediction and only required explanations, with separated evidence',()=>{
  const row={round:12,starting:5,grassAvailable:8,survivors:5,births:2,deaths:0,ending:7};
  const revised={round:12,grassPercent:50,population:7,rows:[row]};
  const state={baseline:{...revised,grassPercent:100}, comparison:{...revised,round:11},answers:{claim:'A claim',prediction:'A prediction'}};
  const ctx={state,ROUNDS:12,requiredQuestions:['claim'],questions:['claim','habitat-claim'],
    compareText:()=>state.comparison.round===12?'Simulated comparison':'', preservedSave:false,
    range:{report:()=>''},habitat:{report:()=>''},field:{report:()=> 'Two survey years compared'},
    reportIdentity:()=>({name:'Original student',period:'2'}),$:(id)=>({textContent:id})};
  let r=collect('carrying-capacity',ctx);
  assert.equal(r.status,'draft'); assert.match(r.missing[0],/11 of 12/);
  state.comparison.round=12;
  r=collect('carrying-capacity',ctx);
  assert.equal(r.status,'final');
  assert.equal(r.missing.length,0);
  assert.deepEqual(plain(r.sections[1].items[0].rows),[[12,5,8,5,2,0,7]]);
  assert.match(r.sections[4].title,/not simulated/);
  assert.equal(r.sections[4].items[0].text,'Two survey years compared');
  checkRetired('carrying-capacity',ctx,'changed');
  state.answers.prediction=' ';
  assert.equal(collect('carrying-capacity',ctx).status,'draft');
  assert.equal(collect('carrying-capacity',{...ctx,preservedSave:true}).status,'recovery');
});

test('Serengeti needs the four-season run, valid selected evidence and both explanations; optional question and checks do not gate',()=>{
  const row={season:0,change:-1,population:-1,title:'Lion hunt',description:'Simulated capture'};
  const ctx={state:{step:'seasonEnd',season:3,log:[row]},rawSummary:()=>({seasons:[{season:0,start:0,end:-1,cardChange:0,huntChange:-1}],change:-1}),
    selectionText:rows=>ctx.answers.evidence!==''&&rows[Number(ctx.answers.evidence)]?'Selected evidence '+rows[0].title:'',
    answers:{question:'',evidence:'0',claim:'Hunt affected the herd.',limits:'Try a different year.'},
    preserveRaw:false,conceptProgress:{},window:{},roleSetup:{mode:'shared'},reportIdentity:recovery=>recovery?null:{name:'Device student',period:'3'},
    seasonName:()=> 'Winter',signed:value=>String(value),recordName:r=>r.title,describeRow:r=>r.description};
  assert.equal(collect('serengeti',ctx).status,'draft');
  ctx.state.step='complete';
  let r=collect('serengeti',ctx);
  assert.equal(r.status,'final');assert.equal(r.student,null);assert.equal(r.datasetId,undefined);
  assert.equal(r.allowIdentityEdit,false);
  assert.match(r.sections[0].items[0].text,/group record/);
  assert.equal(r.sections[3].items[0].value,'Selected evidence Lion hunt');
  assert.equal(r.sections[2].items[0].rows[0][4],'Simulated capture');
  ctx.roleSetup.mode='solo';
  r=collect('serengeti',ctx);assert.equal(r.student.name,'Device student');
  assert.equal(r.allowIdentityEdit,true);
  checkRetired('serengeti',ctx,'changed');
  ctx.answers.evidence='26';
  r=collect('serengeti',ctx);assert.equal(r.status,'draft');assert.match(r.missing[0],/Choose an event or hunt/);
  r=collect('serengeti',{...ctx,preserveRaw:true});
  assert.equal(r.status,'recovery');assert.equal(r.student,null);
});


test('Unit 1 writing shows actual assignment requirements and the modeled forecast window',()=>{
  const migration=source('migration','html'), migrationLogic=source('migration','js');
  assert.match(migration,/one observation for each of the 12 months.*10 prompts/);
  assert.match(migration,/Filter cards by month/);
  assert.match(migration,/All three group lines overlap/);
  assert.match(migrationLogic,/In June or July, how did anthrax percentages compare across the three groups/);
  const carry=source('carrying-capacity','html'), logic=source('carrying-capacity','js');
  assert.match(carry,/finish both 12-round grass runs.*five required Explain questions/);
  assert.match(carry,/range study, field calculations, and habitat challenge are additional practice/);
  assert.match(carry,/Look at rounds 7–12.*rounds 13–18/);
  assert.match(logic,/ranged from .*Compare the range and repeating values/);
});

test('Serengeti comparisons hold predator species and group size constant, only using recorded hunts',()=>{
  const js=source('serengeti','js'), start=js.indexOf('  const huntDice ='), end=js.indexOf('  function renderHuntPair',start);
  assert.ok(start>=0&&end>start);
  const { huntPair, historyOptionText }=vm.runInNewContext(js.slice(start,end)+'\n({huntPair,historyOptionText})',{
    SINGULAR:{lion:'Lion',hyena:'Hyena'},tokenType:t=>t==='smallGroup'?'Small group':t||'',
    seasonName:()=> 'Winter', outcomeText:()=>'Wildebeest escaped',recordName:r=>r.title, signed:x=>String(x)
  });
  const hunt=(role,predatorType,preyType)=>({kind:'hunt',role,predatorType,preyType,season:0,change:0,winner:'prey'});
  const rows=[hunt('lion','smallGroup','herd'),hunt('hyena','smallGroup','individual'),hunt('lion','individual','individual'),
    {kind:'card',title:'Flood'},hunt('lion','smallGroup','individual')];
  assert.equal(huntPair(rows.slice(0,4)).length,0);
  assert.deepEqual(plain(huntPair(rows,4).map(h=>h.index)),[4,0]);
  assert.match(historyOptionText(rows[0],0),/Record 1 · Winter · Lion small group vs. wildebeest herd · Wildebeest escaped/);
  assert.match(historyOptionText(rows[4],4),/Record 5.*wildebeest individual/);
  assert.notEqual(historyOptionText(rows[0],0),historyOptionText(rows[0],1));
});
