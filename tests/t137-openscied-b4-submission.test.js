/* Exercise each controller's exact submission adapter with real deterministic model data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const root=path.resolve(__dirname,'..');
const L=require('../openscied-b4-hawksbeard-logic');
const M=require('../openscied-b4-rat-generations-logic');
const B=require('../openscied-b4-rat-cross-builder');
const D=require('../openscied-b4-junco-data');
const flight=require('../openscied-b4-junco-flight');
const source=slug=>fs.readFileSync(path.join(root,'openscied-b4-'+slug+'.js'),'utf8');
const between=(src,first,last)=>{
  const start=src.indexOf(first), end=src.indexOf(last,start+first.length);
  assert.ok(start>=0&&end>start,'Controller block must be present: '+first);
  return src.slice(start,end);
};
const input=(prefix,id)=>({dataset:{[prefix+'Answer']:id},labels:[{textContent:'Prompt for '+id}]});
const selector=()=>({textContent:'Original prompt',labels:[{textContent:'Original response choice'}]});
const sections=r=>r.sections.map(s=>s.title);
const table=(r,title)=>r.sections.flatMap(s=>s.items).find(i=>i.type==='table'&&i.title===title);
function collect(slug,prefix,bind,helpers='') {
  const src=source(slug);
  const block=between(src,'function submissionReport()',slug==='junco'?'function download()':'function report()');
  const registration=src.match(/window\.OpenSciEdSubmission\?\.mount\(\{target:[^\n]+/)[0];
  let collect;
  bind.window={...bind.window,OpenSciEdSubmission:{mount(data){
    assert.equal(data.target,'#'+prefix+'-submission-report');
    assert.equal(typeof data.collect,'function');
    collect=data.collect;
  }}};
  vm.runInNewContext(helpers+block+registration,bind);
  assert.ok(collect);
  return ()=>JSON.parse(JSON.stringify(collect()));
}

test('Unit 4 includes one persistent mount and preserves legacy and stale-tab recovery actions',()=>{
  for(const [slug,prefix] of [['hawksbeard','hb'],['rat-generations','rg'],['junco','ju']]){
    const html=fs.readFileSync(path.join(root,'openscied-b4-'+slug+'.html'),'utf8');
    assert.ok(html.includes('href="openscied-submission-report.css"'));
    assert.ok(html.indexOf('src="openscied-submission-report.js"')<html.indexOf('src="openscied-b4-'+slug+'.js"'));
    assert.ok(html.lastIndexOf('</section>')<html.indexOf('id="'+prefix+'-submission-report"'));
    assert.equal((html.match(new RegExp('id="'+prefix+'-submission-report"','g'))||[]).length,1);
    assert.ok(html.includes('href="#'+prefix+'-submission-report"'));
    assert.ok(html.includes('id="'+prefix+'-download"')&&html.includes('id="'+prefix+'-download-tab"'));
  }
});

test('Hawksbeard carries accurate simulated pairs and reports without requiring a correct prediction',()=>{
  const state={seed:42,released:0,prediction:'',answers:{}};
  const trial=L.makeTrial(state.seed), SITES=['field','city'], types=L.TYPES;
  let current=true;
  const src=source('hawksbeard');
  const helpers=between(src,'function currentSummary()','function summary(')+
    between(src,'function recordedAnswers()','function renderCompletion(');
  const report=collect('hawksbeard','hb',{
    state,trial,SITES,TYPES:Object.fromEntries(types.map(t=>[t,t])),PAIRS:L.PLANTS,L,running:false,KEY:'key',preserved:false,
    session:{check:()=>({ok:current})}, choices:{city:'City'}, $:selector, datasetId:s=>'HB-'+s,
    siteName:s=>s==='city'?'City':'Field',typeName:t=>t,fraction:(n,d)=>n+' / '+d, tally:(type)=>L.summarize(trial[type].filter(r=>r.plant<=state.released)),
    research:'Published experiment',researchScope:'Separate from these simulated trials',PAPER:'published source',
    reportPerson:()=>({name:'First student',period:'1'}), answerInputs:['reflection','claim','evidence','limits'].map(id=>input('hb',id))
  },helpers);
  assert.equal(report().status,'draft');
  assert.equal(report().keyResults.length,0);
  state.prediction='city';state.released=3;
  assert.equal(table(report(),'Matched plant pairs recorded').rows.length,3);
  assert.ok(!sections(report()).some(s=>s.startsWith('Published')));
  state.released=L.PLANTS;
  Object.assign(state.answers,{reflection:'trial notes',claim:'my claim',evidence:'student evidence',limits:'my limit'});
  const final=report(), hits=L.summarize(trial.field);
  assert.equal(final.status,'final');
  assert.equal(final.keyResults[0].value,hits.byType.nonfeathery.landed+' / '+hits.landed);
  assert.deepEqual(table(final,'Released seeds and landings by environment').rows[0].slice(2,5),
    [hits.byType.feathery.landed,hits.byType.feathery.released,hits.byType.feathery.missed]);
  assert.ok(sections(final).some(s=>s.startsWith('Published research')));
  current=false;
  assert.equal(report().status,'recovery');
  assert.equal(report().student.name,'First student');
  assert.ok(JSON.stringify(report()).includes('student evidence'));
});

test('Rat Generations includes attempted, not graded, analysis and exact snapshots and built crosses',()=>{
  const state={seed:42,action:6,prediction:'decrease',analysisAttempt:'rats',analysisChecked:false,
    answers:{claim:'my claim',evidence:'my evidence',limits:'my limit'},crosses:{}};
  const model=M.restore({v:1,seed:state.seed,step:state.action});
  const pair=model.generations[1].pairs[0];
  state.crosses[pair.id]={parents:[true,true],headers:[true,true,true,true],cells:Array.from({length:4},()=>[true,true])};
  const src=source('rat-generations');
  const report=collect('rat-generations','rg',{
    state,model,M,B,invalid:false,KEY:'key',PRED:{decrease:'Decrease'},$:selector,session:{check:()=>({ok:true})},
    person:()=>({name:'Report name',period:'2'}),trialId:s=>'RG-'+s,selectionName:{born:'Born',survived:'Survived'},
    fraction:(n,d)=>n+' / '+d,$answer:['reason','claim','evidence','limits'].map(id=>input('rg',id))
  },between(src,'function snapshots(','function button('));
  const r=report();
  assert.equal(r.status,'final','A checked but incorrect selection is an attempt, not a missing response');
  assert.equal(r.sections[0].items.at(-1).value,'Original response choice');
  assert.ok(!JSON.stringify(r).includes('Correct'));
  assert.equal(table(r,'Generation record').rows.length,model.generations.length+model.generations.filter(g=>g.survivors).length);
  assert.equal(table(r,'Punnett squares you built · expected model outcomes').rows[0][3],pair.cells.join(', '));
  state.analysisAttempt='';
  assert.equal(report().status,'draft');
  assert.deepEqual(report().missing,['Try the Analyze quick check.']);
});

test('Junco does not leak unrevealed evidence and distinguishes published and illustrative records',()=>{
  const field=D.field.rows, valid=flight.endStep(9,1,'urban','foraging',field);
  const state={observation:'Field note',prediction:'',reason:'',claim:'',limits:'',fieldGroup:'foraging',aviaryGroup:'female',filter:'all',
    revealed:false,sim:{results:[{id:1,site:'urban',group:'foraging',step:valid}]}};
  const points=D.cort.rows.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  const src=source('junco');
  const report=collect('junco','ju',{
    D,state,points,identified:false,invalid:false,key:'key', session:{check:()=>({ok:true})},choices:{same:'About the same'},
    sites:{urban:'UC San Diego',mountain:'Mt. Laguna'},fieldLabels:{foraging:'Birds looking for food'},aviaryLabels:{female:'Females'},
    $:id=>({value:id==='name'?'Student label':'3',labels:[{textContent:id}]}),fmt:String,window:{JuncoFlight:flight}
  },between(src,'const errName=','function summary(')+between(src,'function corr(','const points='));
  assert.equal(report().status,'draft');
  assert.ok(sections(report()).some(s=>s.includes('Field distance')));
  assert.ok(!sections(report()).some(s=>s.includes('Hormone')||s.includes('aviary')));
  assert.equal(table(report(),'Completed virtual observations').rows[0].at(-1),flight.distance('foraging',valid));
  Object.assign(state,{prediction:'same',revealed:true,claim:'My explanation',limits:'A limitation'});
  assert.equal(report().status,'final');
  assert.equal(report().student.name,'Student label');
  assert.ok(sections(report()).some(s=>s.includes('Hormone')));
  const plotted=table(report(),'Classroom points approximated from the published figure');
  if(points.length){
    assert.equal(plotted.rows.length,points.length);
    assert.ok(!plotted.columns.includes('Population'),'No population attribution is invented for pooled source data');
  }
});
