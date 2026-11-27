'use strict';
(()=>{
const D=window.ArcticBearData,$=k=>document.getElementById('hy-'+k),all=q=>[...document.querySelectorAll(q)];
const KEY='aplab:openscied:b5-hybrid:v1',routes=['ice','family','model','claim'],assignments={
 prediction:'What does your comparison suggest about how much time bears might have to adapt?',
 evidence:'Why might ranges overlap? What can the pedigree show that encounter data cannot?',
 claim:'Could hybrids thrive? Cite a simulation count and explain a habitat trade-off.',
 limit:'What does the real pedigree show? What can neither source tell you about the future?'
};
const checks={saved:'Not yet. The pedigree shows that some hybrids existed and one reproduced. It does not show that hybridization will save polar bears.',
 clue:'Correct. The real family shows that hybrids can occur and that at least one reproduced; future survival is unknown.',
 forecast:'Not yet. The model combines four inherited variants. It does not predict any wild bear’s lifespan.'};
const checkChoices={saved:'Hybrid bears are proof polar bears will be saved.',clue:'Some hybrids can reproduce, but this doesn’t tell us how many will survive in the future.',forecast:'Four coin flips predict how long a wild bear will live.'};
const years=[...new Set(D.graph.flatMap(g=>g.values.map(([y])=>y)))].sort((a,b)=>a-b);
const point=(g,yr)=>g.values.find(([y])=>y===yr)?.[1];
const gText=(yr)=>D.graph.filter(g=>g.key==='low'||g.key==='highest').map(g=>g.label+': ≈'+point(g,yr).toFixed(1)+' million km²').join(' · ');
const n=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const btn=(text)=>{const e=n('button',text,'btn');e.type='button';return e;};
const svg=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
const art=(k)=>{const e=n('img');e.alt='';e.src='assets/openscied-hybrid-'+(k==='back'?'hybrid':k)+'.svg';return e;};
function table(headers,rows,title,scroll=false){
 const t=n('table'),head=t.createTHead().insertRow();t.append(n('caption',title,'sr-only'));
 headers.forEach(h=>{const th=n('th',h);th.scope='col';head.append(th);});
 const body=t.createTBody();
 for(const r of rows){const tr=body.insertRow();r.forEach((x,i)=>{const td=n(i===0?'th':'td',String(x??'—'));if(i===0)td.scope='row';tr.append(td);});}
 if(!scroll)return t;
 const d=n('div',undefined,'hy-scroll');d.tabIndex=0;d.setAttribute('role','region');d.setAttribute('aria-label',title);d.append(t);return d;
}
const newId=()=>Array.from(crypto.getRandomValues(new Uint8Array(4)),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
const fresh=()=>({v:1,id:null,step:'ice',lastVisitedAt:0,year:null,islands:[],traces:[],rolls:0,answers:{},verdict:null,finished:false});
let s=fresh(),session,failed=false,started=false,legacy=false,year=2022,encounter='brown',familyChoice='',picked=null;
const shown=new Set(D.graph.map(g=>g.key));
try{
 session=window.OpenSciEdSaveSession?.open(localStorage,'b5-hybrid',[KEY],undefined,{routeMetadata:['step','lastVisitedAt']});
 const raw=session?.read(KEY);
 if(raw){
  const v=JSON.parse(raw);
  if(v?.v!==1||!/^[A-F0-9]{8}$/.test(v.id))throw Error('Invalid saved record');
  s.id=v.id;s.lastSavedAt=window.OpenSciEdB5Workspace.timestamp(v.lastSavedAt);s.step=routes.includes(v.step)?v.step:'ice';s.lastVisitedAt=Number(v.lastVisitedAt)||0;
  s.year=validYear(v.year)?v.year:null;
  s.islands=cleanArray(v.islands,['banks','victoria']);s.traces=cleanArray(v.traces,D.family.filter(k=>k.parents).map(k=>k.id));
  s.rolls=Number.isInteger(v.rolls)?Math.min(40,Math.max(0,v.rolls)):0;s.verdict=Object.hasOwn(checks,v.verdict)?v.verdict:null;
  for(const k of Object.keys(assignments))s.answers[k]=clean(v.answers?.[k],k);
  s.finished=v.finished===true&&readyClaim();
  started=!!(s.lastVisitedAt||s.year||s.islands.length||s.traces.length||s.rolls||Object.values(s.answers).some(Boolean)||s.verdict);
  legacy=Boolean(s.year||s.islands.length||s.traces.length||s.rolls||Object.values(s.answers).some(x=>x.trim())||s.verdict);
  year=s.year??2022;
 }else if(session){
  // Reserve the dataset before showing it. A seed without work is not a started lab.
  s.id=newId();
  if(!session.write(KEY,JSON.stringify({v:1,id:s.id})).ok)failed=true;
 }
}catch(_){failed=true;}
if(s.id===null)s.id=newId();
const canSave=()=>!failed&&session?.check(KEY).ok;
const identity=window.OpenSciEdSaveSession?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
const say=t=>{$('status').textContent=t;};
function clean(v,k){return typeof v==='string'?v.slice(0,k==='claim'?5000:4000):'';}
function cleanArray(v,options){return [...new Set(Array.isArray(v)?v.filter(x=>options.includes(x)):[])];}
function validYear(y){return years.includes(y)&&y>2022;}
function written(k){return Boolean(s.answers[k]?.trim());}
function readyIce(){return validYear(s.year)&&written('prediction');}
function readyFamily(){return s.islands.length===2&&[1,2].every(g=>D.family.some(k=>k.group===g&&s.traces.includes(k.id)))&&written('evidence');}
function readyClaim(){return readyIce()&&readyFamily()&&s.rolls===40&&written('claim')&&written('limit')&&s.verdict==='clue';}
function gate(step){const idx=routes.indexOf(step);return idx===0||(idx>0&&readyIce()&&(idx===1||(readyFamily()&&(idx===2||s.rolls===40))));}
function completeSteps(){const ice=readyIce(),family=ice&&readyFamily();return [ice,family,family&&s.rolls===40,s.finished];}
function done(){return completeSteps().filter(Boolean).length;}
const receipt=window.OpenSciEdB5Workspace.mount({output:$('save'),key:KEY,session,canSave,restored:()=>legacy,getRecord:()=>s});
let writeFailed=false;
function saveStatus(){
 const savable=canSave()&&!writeFailed;
 const notice=$('recovery'),focused=notice.contains(document.activeElement);
 notice.hidden=!!savable;
 if(focused&&savable)$('reset').focus();
 $('reset').disabled=!canSave()||!started;
 receipt.refresh();
}
function save(workChanged=true){
 started=true;s.lastVisitedAt=Date.now();
 writeFailed=!receipt.write(workChanged);
 saveStatus();
}
function changed(){s.finished=false;save();controls();}
function controls(){
 const detail=!readyIce()?'Pin a future year and write a prediction.':!readyFamily()?'Open both islands, trace one offspring in each generation, and compare the evidence.':s.rolls<40?'Record all ten matings.':s.finished?'Investigation complete.':'Use your evidence to finish your claim.';
 $('progress').textContent=done()+' of 4 steps complete. '+detail;
 $('ice-hint').textContent=readyIce()?'':'Pin a future year and write your prediction to unlock the family evidence.';
 $('family-hint').textContent=readyFamily()?'':'Visit both islands, trace one first-generation and one backcross offspring, and write your evidence note.';
 $('model-hint').textContent=s.rolls===40?'Ten simulated offspring recorded.':Math.floor(s.rolls/4)+' of 10 offspring recorded · '+s.rolls+' of 40 coin flips.';
 $('claim-hint').textContent=s.finished?'Investigation complete. Preview your report or choose Edit saved work.':readyClaim()?'Ready to finish.':'Write both responses and check the conclusion.';
 $('finish').disabled=!readyClaim()||s.finished;$('finish').hidden=s.finished;$('edit').hidden=!s.finished;
 saveStatus();$('backup').disabled=!started;
 for(const k of ['claim','limit'])$(k).readOnly=s.finished;
 all('input[name=hy-check]').forEach(e=>e.disabled=s.finished);
 const completed=completeSteps();
 all('[data-step],[data-go]').forEach(b=>{
   b.disabled=!gate(b.dataset.step||b.dataset.go);
   if(b.hasAttribute('data-step')){
     if(b.dataset.step===s.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
     b.toggleAttribute('data-nav-step-complete',Boolean(completed[routes.indexOf(b.dataset.step)]));
   }
 });
}
function go(k,focus=true){
 if(!gate(k))return;
 s.step=k;routes.forEach(r=>document.getElementById(r).hidden=r!==k);
 if(location.hash!=='#'+k)history.replaceState(null,'','#'+k);
 if(focus&&started)save(false);if(k==='claim')recap();controls();
 if(focus){say('');document.getElementById(k+'-title').focus();}
}
all('[data-step],[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go||b.dataset.step));
const colors={obs:'var(--ink)',low:'var(--s3)',mid:'var(--s1)',high:'var(--s2)',highest:'var(--s4)'};
const dashes={solid:'none',long:'13 6',short:'7 5',dots:'2 5','dash-dot':'14 5 2 5'};
D.graph.forEach(g=>{
 const b=btn(g.label);b.setAttribute('aria-pressed','true');
 b.onclick=()=>{if(shown.has(g.key))shown.delete(g.key);else shown.add(g.key);
  if(!shown.size)shown.add(g.key);b.setAttribute('aria-pressed',String(shown.has(g.key)));chart();
 };
 $('legend').append(b);
});
function chart(){
 const el=svg('svg',{viewBox:'0 0 700 355','aria-hidden':'true'}),x=y=>62+(y-1980)*(603/120),Y=v=>300-v*40;
 const text=(str,a)=>{const q=svg('text',a);q.textContent=str;el.append(q);};
 el.append(svg('rect',{class:'hy-threshold',x:62,y:Y(1),width:603,height:40,rx:2}));
 for(const p of [0,1,2,3,4,5,6]){
  el.append(svg('line',{class:'hy-gridline',x1:62,x2:665,y1:Y(p),y2:Y(p)}));text(p,{x:52,y:Y(p)+5,'text-anchor':'end'});
 }
 for(const yr of [1980,2000,2020,2040,2060,2080,2100])text(yr,{x:x(yr),y:324,'text-anchor':'middle'});
 text('September sea-ice area (million km²)',{x:61,y:36});
 text('Year',{x:365,y:351,'text-anchor':'middle'});
 el.append(svg('line',{class:'hy-cursor',x1:x(year),x2:x(year),y1:58,y2:300}));
 const values=[];
 for(const g of D.graph.filter(g=>shown.has(g.key))){
  el.append(svg('polyline',{points:g.values.map(([a,b])=>x(a)+','+Y(b)).join(' '),fill:'none',stroke:colors[g.key],'stroke-width':3,'stroke-dasharray':dashes[g.style],'stroke-linecap':'round'}));
  const q=point(g,year);if(q!==undefined){
   el.append(svg('circle',{cx:x(year),cy:Y(q),r:6,fill:colors[g.key],stroke:'var(--surface)','stroke-width':'2'}));
   const card=n('div');card.append(n('strong',g.label),n('span','≈ '+q.toFixed(1)+' million km²'));values.push(card);
  }
 }
 $('chart').replaceChildren(el);$('year-label').value=String(year);
 $('year').setAttribute('aria-valuetext',String(year));$('year').value=years.indexOf(year);
 $('chart-values').replaceChildren(...(values.length?values:[n('p','The selected lines have no reading for this year.')]));
 $('pin-year').disabled=!validYear(year);
 $('pin-note').textContent=s.year?s.year+' pinned. '+gText(s.year):validYear(year)?'Pin '+year+' to keep the low and high comparison.':'Choose a year after 2022 to compare projections.';
}
$('enlarge').onclick=()=>{$('large-graph').replaceChildren($('chart').firstChild.cloneNode(true));$('graph-dialog').showModal();};
$('close-graph').onclick=()=>$('graph-dialog').close();
$('year').max=years.length-1;$('year').oninput=e=>{year=years[Number(e.target.value)];chart();};
$('pin-year').onclick=()=>{if(!validYear(year))return;s.year=year;changed();chart();say(year+' climate comparison pinned.');};
$('table').append(table(['Year',...D.graph.map(g=>g.label)],years.map(y=>[y,...D.graph.map(g=>point(g,y)?.toFixed(1)??'—')]),'Approximate September sea-ice area, million km²',true));
const islandDesc={
 banks:'Banks Island: the 2006 unusual bear was genetically confirmed as a first-generation hybrid.',
 victoria:'Victoria Island: researchers traced sampled bears to the same polar bear mother and two brown bear fathers.'
};
all('.hy-island').forEach(b=>b.onclick=()=>{
 const key=b.dataset.island;if(!s.islands.includes(key)){s.islands.push(key);changed();}
 b.dataset.visited='true';$('map-readout').textContent=islandDesc[key]+' Schematic map, not a movement record.';say(islandDesc[key]);
});
all('button[data-ice]').forEach(b=>b.onclick=()=>{
 $('map').dataset.ice=b.dataset.ice;all('button[data-ice]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));
 const msg=b.dataset.ice==='more'?'With more seasonal sea ice, a polar bear can spend more time offshore.':'Less sea ice can bring polar bears onto land where they may encounter brown bears.';
 $('map-readout').textContent=msg+' The positions illustrate a possibility, not a tracked movement or forecast.';say(msg);
});
function drawPedigree(){
 const specimen=D.family.find(x=>x.id===familyChoice);
 all('#hy-pedigree button').forEach(b=>{b.dataset.parent=String(specimen?.parents?.includes(b.dataset.family)??false);b.setAttribute('aria-pressed',String(b.dataset.family===familyChoice));});
 if(!specimen)return;
 const label=id=>D.family.find(x=>x.id===id).label;
 $('trace').textContent=specimen.parents?specimen.label+' had these parents: '+specimen.parents.map(label).join(' + ')+'.':specimen.label+' is one of the original parents.';
}
['Original parents','First-generation hybrids (F1)','Hybrid × brown bear offspring (backcross)'].forEach((name,g)=>{
 $('pedigree').append(n('strong',name));const row=n('div',undefined,'hy-tree-row');$('pedigree').append(row);
 for(const a of D.family.filter(k=>k.group===g)){
  const b=btn();b.append(art(a.kind),n('span',a.label));b.dataset.family=a.id;
  b.onclick=()=>{familyChoice=a.id;if(a.parents&&!s.traces.includes(a.id)){s.traces.push(a.id);changed();}drawPedigree();say($('trace').textContent);};row.append(b);
 }
});
function encounters(){
 const i=encounter==='polar'?1:3;
 $('counts').replaceChildren(table(['Polar bear group','Aggressive','Submissive','Total'],D.interactions.map(r=>[r[0],r[i],r[i+1],r[i]+r[i+1]]),'Observed encounters with '+(encounter==='polar'?'polar bears':'brown bears')));
}
$('encounter').onchange=e=>{encounter=e.target.value;encounters();};
const bits=()=>D.flips(s.id,s.rolls),cohort=()=>D.cohort(s.id,s.rolls),round=()=>Math.min(9,Math.max(0,Math.ceil((s.rolls||1)/4)-1));
const face=b=>b===0?'Heads':'Tails';
function showModel(){
 const rows=cohort(),r=round(),f=bits().slice(r*4,r*4+4);
 $('round').textContent='Mating '+(r+1)+' of 10 · '+f.length+' of 4 variants revealed';
 $('flip').disabled=s.rolls>=40;
 $('flip').textContent=s.rolls===40?'All 40 flips recorded':s.rolls%4===0&&s.rolls>0?'Next mating · Flip for LYST':'Flip for '+D.traits[s.rolls%4].key;
 const left=4-s.rolls%4,nextMating=Math.floor(s.rolls/4)+1;
 $('remaining').hidden=$('shortcut-note').hidden=s.rolls===40;
 $('shortcut-note').textContent='Finish this mating flips the '+left+' '+(left===1?'coin still needed':'coins still needed')+' for mating '+nextMating+'.';
 $('coin').textContent=s.rolls?(bits().at(-1)===0?'H':'T'):'?';
 $('cub').dataset.born=String(f.length===4);$('cub').dataset.coat=f[0]===1?'light':'mixed';
 $('inheritance').replaceChildren(table(['Gene','Polar contribution','Brown contribution','Model result'],D.traits.map((t,i)=>[t.key,t.polar,f[i]===undefined?'Not flipped':face(f[i])+': '+t.brown[f[i]],f[i]===undefined?'Waiting':D.phenotype(i,f[i])]),'Mating '+(r+1)+' model traits'));
 const buttons=[];
 rows.forEach((_,i)=>{
  const b=btn(String(i+1));b.setAttribute('aria-label','Inspect offspring '+(i+1));b.setAttribute('aria-pressed',String(picked===i));
  b.onclick=()=>{picked=i;all('#hy-cohort button').forEach((x,k)=>x.setAttribute('aria-pressed',String(k===i)));offspring();say('Showing offspring '+(i+1)+'.');};buttons.push(b);
 });
 $('cohort').replaceChildren(...buttons);offspring();
}
function offspring(){
 const row=cohort()[picked??-1];
 $('offspring').textContent=row?'Offspring '+(picked+1)+': '+D.traits.map((t,i)=>t.key+' — '+D.phenotype(i,row[i])).join(' · ')+'.':'No offspring selected. A completed mating adds one to the notebook.';
 $('habitat-note').textContent=$('habitat').value==='land'?'On warmer, exposed land, making less heat may matter during activity. Compare the NOS3 model outcomes; they do not tell you who survives.':'On snow and sea ice, lighter pigment may help camouflage and stored fat may insulate. Compare LYST and ARID5B.';
}
$('habitat').onchange=offspring;
function runFlips(count){
 if(s.rolls>=40)return;
 const before=s.rolls;s.rolls=Math.min(40,s.rolls+count);
 if(Math.floor(before/4)!==Math.floor(s.rolls/4))picked=Math.floor(s.rolls/4)-1;
 changed();showModel();
 const last=s.rolls-1,bit=bits().at(-1),t=D.traits[last%4];
 const message=(count===1?'Coin: '+face(bit)+'. Brown parent passed '+t.brown[bit].toLowerCase()+' for '+t.key+'. ':'Mating flips recorded. ')+(s.rolls%4===0?'Offspring '+(s.rolls/4)+' is in your notebook.':'Read the inherited copies and continue.');
 $('model-feedback').textContent=message;say(message);
 const coin=$('coin'),bench=$('bench');
 coin.classList.remove('flipping');bench.classList.remove('reveal');void coin.offsetWidth;
 coin.classList.add('flipping');if(s.rolls%4===0)bench.classList.add('reveal');
 if(s.rolls===40)document.querySelector('[data-go=claim]').focus();
}
$('flip').onclick=()=>runFlips(1);
$('remaining').onclick=()=>runFlips(4-s.rolls%4);
function summaries(){
 const rows=cohort();
 return D.traits.flatMap((t,i)=>{
  const counts=t.out.map((out,b)=>[out,rows.filter(row=>row[i]===b).length]);
  return counts.map(([out,c])=>[t.key,out,c]);
 });
}
function recap(){
 const t=$('evidence-recap');
 t.replaceChildren(n('p',s.year?s.year+' climate comparison: '+gText(s.year)+'.':''),n('p',s.answers.prediction??''),n('p',s.answers.evidence??''),n('p','Real family: four F1 hybrids and four backcross offspring, all from one family.'));
 $('summary').replaceChildren(table(['Gene','Simulated trait','Out of 10'],summaries(),'Simulated trait counts'));
}
all('[data-answer]').forEach(el=>{const k=el.dataset.answer;el.value=s.answers[k]??'';el.oninput=()=>{s.answers[k]=clean(el.value,k);changed();};});
function showCheck(){
 const e=$('check-feedback');e.textContent=s.verdict?checks[s.verdict]:'';e.dataset.result=s.verdict?(s.verdict==='clue'?'ok':'retry'):'';
}
all('input[name=hy-check]').forEach(e=>{e.checked=e.value===s.verdict;e.onchange=()=>{if(!e.checked||s.finished)return;s.verdict=e.value;changed();showCheck();say(checks[s.verdict]);};});
$('finish').onclick=()=>{if(!readyClaim())return;s.finished=true;save();controls();$('edit').focus();say('Investigation complete. Preview your report below.');};
$('edit').onclick=()=>{changed();$('claim').focus();say('Editing reopened. Your model and evidence are still here.');};
$('reset').onclick=()=>{$('erase').value='';$('confirm').disabled=true;$('reset-error').textContent='';$('reset-dialog').showModal();};
$('cancel').onclick=()=>$('reset-dialog').close();
$('erase').oninput=()=>{$('confirm').disabled=$('erase').value!=='ERASE';};
$('reset-form').onsubmit=e=>{e.preventDefault();if($('erase').value!=='ERASE')return;
 if(!canSave()||!session.reset(KEY,JSON.stringify({v:1,id:newId()})).ok){$('reset-error').textContent='Could not clear this notebook. Reload and try again.';return;}
 history.replaceState(null,'',location.pathname+location.search);location.reload();
};
function report(){
 const answer=k=>({type:'answer',prompt:assignments[k],value:s.answers[k]});
 const missing=[];if(!readyIce())missing.push('Pin a year and write the climate prediction.');if(!readyFamily())missing.push('Trace the family and write the evidence note.');if(s.rolls<40)missing.push('Complete ten matings.');if(!s.finished)missing.push('Finish the claim.');
 return {title:'Arctic Bear Futures & Hybridization',unit:'OpenSciEd B.5 · Lesson 6 companion',
 source:'OpenSciEd B.5 Lesson 6: Future Predictions, Mating Between Bear Species, Making Sense of Matings and Hybridization Model. Climate points are approximate readings; the documented family is real; the classroom cohort is simulated.',
 status:(!canSave()||writeFailed)?'recovery':s.finished?'final':'draft',student:identity(),datasetId:'HY-'+s.id,missing,sections:[
 {title:'Climate evidence',items:[{type:'answer',prompt:'Pinned year and approximate September sea-ice area',value:s.year?s.year+' · '+gText(s.year):''},answer('prediction'),{type:'text',text:'These September area values are not directly comparable to the Wapusk chart’s annual minimum extent. Area counts the ice-covered share; extent counts whole qualifying grid cells.'}]},
 {title:'Documented family and encounters',items:[{type:'answer',prompt:'Islands visited',value:s.islands.map(k=>k==='banks'?'Banks Island':'Victoria Island').join(', ')},{type:'answer',prompt:'Family branches traced',value:s.traces.map(k=>D.family.find(a=>a.id===k).label).join(', ')},answer('evidence')]},
 {title:'Ten-mating classroom model',items:[{type:'text',text:s.rolls+' of 40 independent model coin flips. Real survival and mating rates are not modeled.'},
 {type:'table',columns:['Offspring','LYST','APOB','ARID5B','NOS3'],rows:cohort().map((row,i)=>['Bear '+(i+1),...row.map((b,j)=>face(b)+': '+D.phenotype(j,b))])},
 {type:'table',columns:['Gene','Simulated trait','Count'],rows:summaries()}]},
 {title:'Claim, reasoning and limits',items:[answer('claim'),answer('limit'),{type:'answer',prompt:'Which conclusion matches the evidence?',value:s.verdict?checkChoices[s.verdict]+' '+checks[s.verdict]:''}]}
 ]};
}
function downloadJSON(){
 const r=report(), yearRow=s.year==null?undefined:years.find(y=>y===s.year);
 const payload={format:'arctic-bear-futures-backup-v2',exportedAt:new Date().toISOString(),
   student:r.student,datasetId:r.datasetId,status:r.status,title:r.title,unit:r.unit,source:r.source,missing:r.missing,
   progress:{completed:done(),total:4},pinnedYear:s.year,
   climate:{measure:'September sea-ice area',unit:'million km²',pinnedValues:yearRow==null?[]:D.graph.flatMap(g=>{
     const value=point(g,yearRow);return value==null?[]:[{series:g.label,value,kind:g.key==='obs'?'observed':'projected'}];
   })},flips:s.rolls,coinFlips:D.coinFlipDetails(s.id,s.rolls),conditions:summaries(),report:r.sections};
 window.OpenSciEdB5ReportFiles?.download(JSON.stringify(payload,null,2),'application/json','arctic-bear-futures-backup.json');
 say('Downloaded the Lesson 6 '+(r.status==='recovery'?'recovery file.':'backup.'));
}
$('backup').onclick=downloadJSON;
$('save-recovery').onclick=downloadJSON;
$('open-current').onclick=()=>$('recovery-dialog').showModal();
$('keep-recovery').onclick=()=>$('recovery-dialog').close();
$('confirm-reload').onclick=()=>location.reload();
window.addEventListener('storage',e=>{
 const api=window.OpenSciEdSaveSession;
 if(!e.key||e.key===KEY||e.key===api?.globalKey||e.key===api?.scopeKey('b5-hybrid')||e.key===api?.resetKey(KEY))saveStatus();
});
for(const b of all('.hy-island'))b.dataset.visited=String(s.islands.includes(b.dataset.island));
window.Lab?.identity?.mount?.('#hy-identity',{compact:true,sharedDevice:true});
chart();drawPedigree();encounters();showModel();showCheck();
const hash=location.hash.slice(1);go(gate(hash)?hash:gate(s.step)?s.step:routes.findLast(gate),false);
window.OpenSciEdB5ReportFiles?.bindHTML($('save-html'),report,'arctic-bear-futures',say);
window.OpenSciEdSubmission?.mount({target:'#hy-report',filename:'arctic-bear-futures',collect:report});
})();
