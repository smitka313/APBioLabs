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
  const js=source(name,'js'), start=js.indexOf('  function submissionData('), end=js.indexOf('\n  '+files[name][0],start);
  assert.ok(start>=0&&end>start,'activity provides its classroom adapter');
  return vm.runInNewContext(js.slice(start,end)+'\nsubmissionData()',context);
}
const plain=value=>JSON.parse(JSON.stringify(value));

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
  const ctx={state, RESPONSES:prompts, L:{monthsWithNotes:n=>n.filter(x=>x.obs).map(x=>x.month)},
    ANNUAL:[{region:'North',rain:1310,occupancy:6}],ANNUAL_SOURCE:'Classroom data',ANNUAL_URL:'https://openscied.org/',
    reportIdentity:recovery=>recovery?null:{name:'Original student',period:'2'},corrupt:false,displayNoteText:n=>n.text};
  let r=collect('migration',ctx);
  assert.equal(r.status,'draft');
  assert.match(r.missing[0],/0 of 12/);
  assert.deepEqual(plain(r.sections.at(-1).items[0].rows),[['North',1310,6]]);
  state.notes.push(...months.map(month=>({id:'month-'+month,title:'Month '+month,text:'Observation',obs:true,month})));
  r=collect('migration',ctx);
  assert.equal(r.status,'final'); assert.equal(r.student.name,'Original student'); assert.equal(r.datasetId,undefined);
  r=collect('migration',{...ctx,corrupt:true});
  assert.equal(r.status,'recovery'); assert.equal(r.student,null);
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
  assert.match(r.sections[0].items[0].text,/group record/);
  assert.equal(r.sections[3].items[0].value,'Selected evidence Lion hunt');
  assert.equal(r.sections[2].items[0].rows[0][4],'Simulated capture');
  ctx.roleSetup.mode='solo';
  r=collect('serengeti',ctx);assert.equal(r.student.name,'Device student');
  ctx.answers.evidence='26';
  r=collect('serengeti',ctx);assert.equal(r.status,'draft');assert.match(r.missing[0],/Choose an event or hunt/);
  r=collect('serengeti',{...ctx,preserveRaw:true});
  assert.equal(r.status,'recovery');assert.equal(r.student,null);
});
