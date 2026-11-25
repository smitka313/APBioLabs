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

test('Unit 4 has one report tray, one final slot, and keeps backup controls separate',()=>{
  for(const [slug,prefix,finalId] of [['hawksbeard','hb','hb-explain'],['rat-generations','rg','rg-explain'],['junco','ju','cort']]){
    const html=fs.readFileSync(path.join(root,'openscied-b4-'+slug+'.html'),'utf8');
    const mount='id="'+prefix+'-submission-report"';
    const slot='data-ose-report-final';
    const script='src="openscied-submission-report.js"';
    assert.ok(html.includes('href="openscied-submission-report.css"'));
    assert.ok(html.includes(script)&&html.indexOf(script)<html.indexOf('src="openscied-b4-'+slug+'.js"'));
    assert.equal(html.split(mount).length-1,1,slug+' has one early report mount');
    assert.ok(html.lastIndexOf('</section>')<html.indexOf(mount),slug+' keeps the early mount outside gated steps');
    assert.equal(html.split(slot).length-1,1,slug+' has one slot for the same report tray');
    const final=html.indexOf('<section id="'+finalId+'"');
    assert.ok(final>=0&&final<html.indexOf(slot)&&html.indexOf(slot)<html.lastIndexOf('</section>'),slug+' puts the slot in the final activity step');
    assert.ok(!html.includes('href="#'+prefix+'-submission-report"')&&!html.includes('ose-submission-jump'),slug+' has no redundant report jump');

    const disclosure=html.match(new RegExp('<details\\b([^>]*\\bid="'+prefix+'-other-downloads"[^>]*)>([\\s\\S]*?)</details>'));
    assert.ok(disclosure,slug+' has a native backups disclosure');
    assert.doesNotMatch(disclosure[1],/\bopen\b/,slug+' keeps the backup controls collapsed by default');
    assert.match(disclosure[2],/<summary>Other downloads and backups<\/summary>/);
    const download='id="'+prefix+'-download"';
    assert.ok(disclosure[2].includes(download)&&html.split(download).length===2,slug+' keeps the text download only in backups');
    if(prefix!=='ju'){
      const copy='id="'+prefix+'-copy"';
      assert.ok(disclosure[2].includes(copy)&&html.split(copy).length===2,slug+' keeps text copy only in backups');
    }
    const recovery=between(html,'<aside id="'+prefix+'-save-warning"','</aside>');
    const backup='id="'+prefix+'-download-tab"';
    assert.ok(recovery.includes(backup)&&html.split(backup).length===2&&!recovery.includes('<details'),slug+' keeps stale-work recovery accessible outside the backups disclosure');
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
    denominatorPrompt:'Which denominator?',denominatorChoices:{soil:'All seeds that landed on soil in the city',type:'Only nonfeathery seeds released in the city'},
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
  state.denominatorChoice='type';
  const final=report(), hits=L.summarize(trial.field);
  assert.ok(final.sections[0].items.some(item=>item.prompt==='Which denominator?'&&item.value==='Only nonfeathery seeds released in the city'),
    'Word collects the chosen response, not a replacement answer');
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

test('Rat Generations keeps the attempted answer in draft and includes exact snapshots and built crosses in both formats',()=>{
  const state={seed:42,action:6,prediction:'decrease',analysisAttempt:'rats',analysisChecked:false,
    answers:{claim:'my claim',evidence:'my evidence',limits:'my limit'},crosses:{}};
  const model=M.restore({v:1,seed:state.seed,step:state.action});
  const pair=model.generations[1].pairs[0];
  state.crosses[pair.id]={parents:[true,true],headers:[true,true,true,true],cells:Array.from({length:4},()=>[true,true])};
  const src=source('rat-generations');
  const bind={
    state,model,M,B,invalid:false,KEY:'key',PRED:{decrease:'Decrease'},$:selector,session:{check:()=>({ok:true})},
    person:()=>({name:'Report name',period:'2'}),trialId:s=>'RG-'+s,selectionName:{born:'Born',survived:'Survived'},
    fraction:(n,d)=>n+' / '+d,$answer:['reason','claim','evidence','limits'].map(id=>input('rg',id))
  };
  const helpers=between(src,'function snapshots(','function button(')+
    between(src,'function analysisSelection()','function submissionReport()');
  const report=collect('rat-generations','rg',bind,helpers);
  const legacy=()=>vm.runInNewContext(helpers+between(src,'function report()','function copy(')+'report();',bind);
  const r=report();
  assert.equal(r.status,'draft','An incorrect selection is kept as an attempt but does not finish Analyze');
  assert.equal(r.sections[0].items.at(-1).value,'Original response choice');
  assert.ok(!JSON.stringify(r).includes('Correct'));
  assert.match(legacy(),/ANALYZE QUICK CHECK · SAVED ANSWER\nOriginal prompt\nOriginal response choice/);
  assert.ok(!legacy().includes('Correct'),'TXT describes the wrong attempt without grading it');
  assert.equal(table(r,'Generation record').rows.length,model.generations.length+model.generations.filter(g=>g.survivors).length);
  assert.equal(table(r,'Punnett squares you built · expected model outcomes').rows[0][3],pair.cells.join(', '));
  assert.ok(legacy().includes(pair.cells.join(', '))&&legacy().includes(pair.id),'TXT includes the same Punnett square data');
  state.analysisChecked=true;state.analysisAttempt='alleles';
  assert.equal(report().status,'final','A correct check plus the required responses completes the report');
  state.analysisChecked=false;state.analysisAttempt='';
  assert.equal(report().status,'draft');
  assert.deepEqual(report().missing,['Use the feedback to answer the Analyze quick check correctly.']);
  assert.ok(!legacy().includes('ANALYZE QUICK CHECK'),'No saved attempt is not printed as a response');
});

test('Junco does not leak unrevealed evidence and distinguishes published and illustrative records',()=>{
  const field=D.field.rows, valid=flight.endStep(9,1,'urban','foraging',field);
  const state={observation:'Field note',prediction:'',reason:'',claim:'',limits:'',fieldGroup:'foraging',aviaryGroup:'female',filter:'all',
    revealed:false,notebookSeed:491,sim:{results:[{id:1,site:'urban',group:'foraging',step:valid}]}};
  const points=D.cort.rows.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  const src=source('junco');
  const bind={
    D,state,points,identified:false,invalid:false,key:'key', session:{check:()=>({ok:true})},choices:{same:'About the same'},
    sites:{urban:'UC San Diego',mountain:'Mt. Laguna'},fieldLabels:{foraging:'Birds looking for food',incubating:'Females sitting on eggs'},aviaryLabels:{female:'Females',male:'Males'},
    datasetId:seed=>'JU-'+seed.toString(16).toUpperCase().padStart(8,'0'),
    $:id=>({value:id==='name'?'Student label':'3',labels:[{textContent:id}],textContent:'STALE DOM SENTINEL'}),
    fmt:value=>Number.isFinite(value)?String(Number(value.toFixed(2))):String(value),window:{JuncoFlight:flight}
  };
  const helpers=between(src,'const errName=','function summary(')+between(src,'function corr(','const points=')+
    between(src,'function cortReading(','function cort()');
  const report=collect('junco','ju',bind,helpers);
  const legacy=()=>vm.runInNewContext(helpers+between(src,'function pairLine(','function evidence()')+
    between(src,'function submissionReport()','function download()')+'plainTextReport();',{...bind});
  assert.equal(report().status,'draft');
  assert.ok(sections(report()).some(s=>s.includes('Field distance')));
  assert.ok(!sections(report()).some(s=>s.includes('Hormone')||s.includes('aviary')));
  assert.equal(table(report(),'Completed virtual observations').rows[0].at(-1),flight.distance('foraging',valid));
  const draftText=legacy();
  assert.match(draftText,/Not revealed yet/);
  assert.ok(draftText.includes(state.observation)&&draftText.includes(D.field.url)&&draftText.includes('Optional walk-up trials'));
  assert.ok(!draftText.includes(D.aviary.url)&&!draftText.includes(D.cort.url)&&!draftText.includes('Aviary exploration ·'));
  assert.ok(!draftText.includes('STALE DOM SENTINEL'));
  Object.assign(state,{prediction:'same',revealed:true,claim:'My explanation',limits:'A limitation'});
  assert.equal(report().status,'final');
  assert.equal(report().student.name,'Student label');
  assert.ok(sections(report()).some(s=>s.includes('Hormone')));
  const fullText=legacy();
  assert.ok(fullText.includes(D.aviary.url)&&fullText.includes(D.cort.url)&&fullText.includes(state.claim)&&fullText.includes(state.limits));
  assert.match(fullText,/40 birds shown; correlation r = -0\.53/);
  assert.match(fullText,/Dataset ID: JU-000001EB/);
  assert.equal(report().datasetId,'JU-000001EB');
  assert.ok(fullText.includes('R² = 0.21')&&fullText.includes('P = 0.021'),'TXT carries the same published-model note as Word');
  for(const [label,name,mean] of [['Birds looking for food','Mt. Laguna','13.5'],['Females sitting on eggs','UC San Diego','0.36'],['Females','Mt. Laguna','-0.65'],['Males','UC San Diego','0.8']]){
    assert.ok(table(report(),label).rows.some(row=>row[0]===name&&row[1]===mean));
    assert.ok(fullText.includes(name+' | '+mean));
    assert.ok(fullText.includes(label));
  }
  assert.ok(!fullText.includes('STALE DOM SENTINEL'),'Backup summaries come from the captured state even when CORT was not rendered');
  const plotted=table(report(),'Classroom points approximated from the published figure');
  if(points.length){
    assert.equal(plotted.rows.length,points.length);
    assert.equal(fullText.split('Individual exploration score (PC1)')[1].split(D.cort.source+':')[0]
      .split('\n').filter(line=>/^\d+ \|/.test(line)).length,points.length,'TXT contains every plotted row');
    assert.equal(plotted.columns[0],'Bird (dot)','Pooled evidence numbers dots rather than suggesting an identified population');
    assert.deepEqual(plotted.rows.map(row=>row[0]),points.map((_,i)=>i+1));
    assert.ok(!plotted.columns.includes('Population'),'No population attribution is invented for pooled source data');
  }
});
