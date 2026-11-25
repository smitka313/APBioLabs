'use strict';
(()=>{
const D=window.IceAgeEvidence,$=id=>document.getElementById('ice-'+id),all=q=>[...document.querySelectorAll(q)];
const KEY='aplab:openscied:b5-speciation:v1', routes=['cycles','fossils','traits','argument'];
const prompts={first:'First argument: when, where and why?',needed:'What evidence would strengthen the first argument?',fossilNote:'How do the fossils support or challenge the first argument?',traitNote:'How could an inherited trait affect reproduction over generations?',revised:'Revised argument with climate, fossil and genetic evidence, reasoning and limits',future:'Lesson 5 bridge: a model revision and a Driving Question Board question'};
const mk=(tag,t,cls)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;if(cls)n.className=cls;return n;};
const button=(t,cls='btn')=>{const n=mk('button',t,cls);n.type='button';return n;};
const art=(kind='brown')=>{const im=mk('img');im.src='assets/openscied-bear-profile-'+kind+'.svg';im.alt='';im.draggable=false;return im;};
const ids=Object.keys(D.habitats), phases=['cold','warm'];
const clean=(text,k)=>typeof text==='string'?text.slice(0,k==='revised'?5000:3000):'';
const array=(v,len,max)=>[...new Set(Array.isArray(v)?v.filter(x=>Number.isInteger(x)&&x>=0&&x<max):[])].slice(0,len);
const pos=v=>[0,1,2].map(i=>ids.includes(v?.[i])?v[i]:null);
const fresh=()=>({v:1,rosterVersion:2,id:Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase(),step:'cycles',lastVisitedAt:0,period:1,phase:'cold',moves:{cold:pos(),warm:pos()},mathDraft:['',''],mathChecked:false,locked:false,pins:[],genes:[],choices:{north:null,south:null},answers:{},limit:false,limitChoice:null,finished:false});
let s=fresh(),session,failed=false,selected=-1,selectedTrait=-1,site=0,videoLoaded=false,replayTimer,writingStarted=false;
try{
 session=window.OpenSciEdSaveSession?.open(localStorage,'b5-speciation',[KEY]);
 const raw=session?.read(KEY);
 if(raw){
   const v=JSON.parse(raw);
   if(v?.v!==1||!/^[A-F0-9]{8}$/.test(v.id))throw Error('Invalid saved notebook');
   s.id=v.id;s.rosterVersion=v.rosterVersion===2?2:1;s.step=routes.includes(v.step)?v.step:'cycles';s.lastVisitedAt=Number(v.lastVisitedAt)||0;
   s.period=Number.isInteger(v.period)&&D.periods[v.period]?v.period:1;s.phase=phases.includes(v.phase)?v.phase:'cold';
   for(const phase of phases)s.moves[phase]=pos(v.moves?.[phase]);
   s.mathDraft=[0,1].map(i=>typeof v.mathDraft?.[i]==='string'&&/^\d{0,8}$/.test(v.mathDraft[i])?v.mathDraft[i]:'');
   for(const k of Object.keys(prompts))s.answers[k]=clean(v.answers?.[k],k);
   s.mathChecked=v.mathChecked===true&&isMathCorrect();
   s.locked=v.locked===true&&readyCycles();
   s.pins=array(v.pins,8,8);s.genes=array(v.genes,3,3);
   for(const k of ['north','south']){const n=v.choices?.[k];s.choices[k]=Number.isInteger(n)&&n>=0&&n<6?n:null;}
   s.limit=v.limit===true;
   s.limitChoice=Object.hasOwn(D.conclusion.choices,v.limitChoice)?v.limitChoice:s.limit?'possible':null;
   s.finished=v.finished===true&&readyFinal();writingStarted=true;
 }
}catch(_){failed=true;}
const readIdentity=window.OpenSciEdSaveSession?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
const canSave=()=>!failed&&session?.check(KEY).ok;
const tell=t=>{$('status').textContent=t;};
function save(){
 writingStarted=true;s.lastVisitedAt=Date.now();
 s.matches={north:suitable('north'),south:suitable('south')};
 if(!canSave()||!session.write(KEY,JSON.stringify(s)).ok)$('save').textContent='This tab cannot save. Keep a copy of your report before closing.';
}
function workChanged(){s.finished=false;save();controls();}
function p(){return D.periods[s.period];}
function completePhase(k){return s.moves[k].every(Boolean);}
function isMathCorrect(){return [false,true].every((warm,i)=>Number(s.mathDraft[i])===D.generations(p(),warm));}
function written(k){return Boolean(s.answers[k]?.trim());}
function readyCycles(){return completePhase('cold')&&completePhase('warm')&&s.mathChecked&&written('first')&&written('needed');}
function readyFossils(){return ['Polar','Brown'].every(b=>s.pins.some(i=>D.fossils[i].bear===b))&&written('fossilNote');}
function candidate(k){return s.choices[k]===null?null:D.roster(s.id,s.rosterVersion)[s.choices[k]];}
function suitable(k){const c=candidate(k);return Boolean(c&&D.suitability(k,c).supported);}
function readyTraits(){return s.genes.length===3&&written('traitNote')&&(
 s.rosterVersion===1?s.choices.north!==null&&s.choices.south!==null:suitable('north')&&suitable('south'));}
function doneCount(){return Number(s.locked)+Number(s.locked&&readyFossils())+Number(s.locked&&readyFossils()&&readyTraits())+Number(s.finished);}
function readyFinal(){return s.locked&&readyFossils()&&readyTraits()&&s.limit&&written('revised')&&written('future');}
function gate(route){
 const i=routes.indexOf(route);
 return i===0||(i>=1&&s.locked&&(i===1||readyFossils()&&(i===2||readyTraits())));
}
function nextHint(){
 if(!completePhase('cold')||!completePhase('warm'))return 'Place all three bears in both phases. You can move them again before saving.';
 if(!s.mathChecked)return 'Check both generation estimates.';
 if(!written('first')||!written('needed'))return 'Write your first argument and say what other evidence you need.';
 return 'Ready. Saving keeps this map and first argument as evidence for your revision.';
}
function controls(){
 const done=doneCount();
 $('progress').textContent=done+' of 4 steps complete.'+(!s.locked?' Save your first argument to open the fossil archive.':!readyFossils()?' Pin both fossil types and write a comparison to unlock traits.':!readyTraits()?' Open all three gene cards and test both habitats to unlock revision.':s.finished?' Investigation complete. Your final report is ready.':'');
 all('[data-step]').forEach(b=>{b.disabled=!gate(b.dataset.step);if(b.dataset.step===s.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 all('[data-go]').forEach(b=>b.disabled=!gate(b.dataset.go));
 $('gate-cycles').textContent=s.locked?'First argument saved. To revise it, use Step 4.':nextHint();
 $('gate-fossils').textContent=readyFossils()?'':'Pin one polar bear fossil and one brown bear fossil, then write a comparison.';
 $('gate-traits').textContent=readyTraits()?'':'Read the three cards, choose a bear with the model’s habitat clue on each side, and write your reasoning.';
 $('gate-argument').textContent=s.finished?'Investigation complete. Preview your final report below. Use Edit saved work to make changes.':readyFinal()?'Ready to finish.':'Write your revision and Lesson 5 response, then answer the conclusion check correctly.';
 $('finish').disabled=!readyFinal()||s.finished;
 $('finish').hidden=s.finished;$('edit').hidden=!s.finished;
 $('backup').disabled=!writingStarted;
 for(const k of ['revised','future'])$(k).readOnly=s.finished;
 all('input[name=ice-limit]').forEach(n=>n.disabled=s.finished);
 $('reset').disabled=!canSave()||!writingStarted;
 $('lock').disabled=!s.locked&&!readyCycles();
 $('lock').textContent=s.locked?'Open my fossil archive →':'Save first argument and open fossils →';
 $('period').disabled=s.locked;
 all('.ice-timeline button').forEach(b=>b.disabled=s.locked&&Number(b.dataset.interval)!==s.period);
 all('#ice-bear-tray button,#ice-destinations button,[id^="ice-g-"],#ice-math,#ice-first,#ice-needed').forEach(b=>b.disabled=s.locked);
}
function go(k,focus=true){
 if(!gate(k))return;
 s.step=k;routes.forEach(r=>document.getElementById(r).hidden=r!==k);
 if(location.hash!=='#'+k)history.replaceState(null,'','#'+k);
 if(focus&&writingStarted)save();
 if(k==='argument')recap();
 if(k==='fossils')$('fossil-first').textContent=s.answers.first||'';
 controls();
 if(focus){tell('');document.getElementById(k+'-title').focus();}
}
const date=(warm)=>warm?[p().end,p().next]:[p().from,p().end];
const span=(warm)=>{const [a,b]=date(warm);return D.fmt(a*1000)+' → '+(b?D.fmt(b*1000)+' years ago':'present day');};
function updateDates(){
 $('period').value=String(s.period);
 $('map').dataset.phase=s.phase;
 $('dates').textContent=(s.phase==='cold'?'Glacial: ':'Interglacial: ')+span(s.phase==='warm')+'.';
 all('[data-phase]').filter(b=>b.tagName==='BUTTON').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.phase===s.phase)));
 all('.ice-timeline button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.interval)===s.period&&(b.hasAttribute('data-warm')===(s.phase==='warm')))));
 $('placement').textContent=phases.map(k=>{
   const n=s.moves[k].filter(Boolean).length;
   return (k==='cold'?'Glacial':'Interglacial')+': '+n+' of 3 placed';
 }).join(' · ')+'. '+(selected>=0?'Bear '+(selected+1)+' selected.':'');
 for(const b of all('#ice-bear-tray button')){
   const i=Number(b.dataset.bear),where=s.moves[s.phase][i];
   b.setAttribute('aria-pressed',String(selected===i));
   b.setAttribute('aria-label','Bear '+(i+1)+': '+(where?D.habitats[where].short:'waiting to be placed'));
   b.querySelector('small').textContent=where?D.habitats[where].short:'Not placed';
 }
 const pile={north:0,south:0,edge:0};
 all('#ice-map-bears span').forEach((b,i)=>{
   const loc=s.moves[s.phase][i];const previous=s.phase==='warm'?s.moves.cold[i]:null;
   const h=D.habitats[loc||previous];const n=loc?pile[loc]++:i;
   b.style.setProperty('--x',(h?h.x+((n-1)*8):11+i*10)+'%');
   b.style.setProperty('--y',(h?h.y+14:90)+'%');
   b.style.opacity=loc?'1':previous?'.45':'0';
 });
 controls();
}
function changePhase(k,announce=true){
 s.phase=k;selected=-1;if(writingStarted)save();updateDates();
 if(announce)tell(k==='cold'?'Glacial map: land ice expands.':'Interglacial map: land ice retreats. Compare the possible habitats.');
}
D.periods.forEach((period,i)=>{
 const o=mk('option',period.id+' · '+period.from+'–'+period.end+' thousand years ago');o.value=i;$('period').append(o);
 phases.forEach((kind,j)=>{
  const warm=j===1,b=button(warm?'☼':period.id,'');
  b.dataset.interval=i;if(warm)b.dataset.warm='';
  b.setAttribute('aria-label',period.id+' '+(warm?'following interglacial period: '+period.end+' to '+period.next:'glacial period: '+period.from+' to '+period.end)+' thousand years ago');
  b.style.setProperty('--duration',String((warm?period.end-period.next:period.from-period.end)));b.style.setProperty('--column',String(i+1));
  b.onclick=()=>{if(replayTimer){clearTimeout(replayTimer);replayTimer=null;}pickPeriod(i,kind);};$('timeline').append(b);
 });
});
function pickPeriod(i,phase){
 if(s.locked&&i!==s.period)return;
 if(i!==s.period){
  s.period=i;s.mathDraft=['',''];s.mathChecked=false;
  $('g-cold').value='';$('g-warm').value='';$('math-feedback').textContent='Period changed. Your habitat placements stay; check the new dates.';
 }
 changePhase(phase,false);
}
$('period').onchange=e=>pickPeriod(Number(e.target.value),'cold');
all('.ice-phase button[data-phase]').forEach(b=>b.onclick=()=>{clearTimeout(replayTimer);changePhase(b.dataset.phase);});
$('replay').onclick=()=>{
 clearTimeout(replayTimer);changePhase('cold',false);
 tell('Starting with expanded land ice. Watch for habitat that reopens as it retreats.');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 replayTimer=setTimeout(()=>changePhase('warm'),reduce?0:650);
};
function dnd(n,mime,choose){
 n.ondragover=e=>{if(!Array.from(e.dataTransfer.types).includes(mime))return;e.preventDefault();n.dataset.hover='';e.dataTransfer.dropEffect='move';};
 n.ondragleave=()=>delete n.dataset.hover;
 n.ondrop=e=>{delete n.dataset.hover;const value=e.dataTransfer.getData(mime);if(value==='')return;e.preventDefault();choose(Number(value));};
}
function draggable(n,i,mime){
 n.draggable=true;n.ondragstart=e=>{if(n.disabled){e.preventDefault();return;}e.dataTransfer.setData(mime,String(i));e.dataTransfer.effectAllowed='move';};
}
for(let i=0;i<3;i++){
 const b=button(undefined,'btn ice-chip');b.dataset.bear=i;
 const text=mk('span');text.append(mk('strong','Bear '+(i+1)),mk('br'),mk('small','Not placed'));b.append(art(),text);
 b.onclick=()=>{selected=selected===i?-1:i;updateDates();tell(selected===i?'Bear '+(i+1)+' selected. Choose a map location.':'Bear deselected.');};
 draggable(b,i,'application/x-ice-map-bear');$('bear-tray').append(b);
 const token=mk('span',undefined,'ice-map-bear');token.append(art(),String(i+1));$('map-bears').append(token);
}
function place(loc,i){
 if(s.locked)return;
 if(![0,1,2].includes(i)){tell('Select a bear from the tray first, then choose a map location.');return;}
 s.moves[s.phase][i]=loc;selected=-1;save();updateDates();tell('Bear '+(i+1)+' is at '+D.habitats[loc].name+' in the '+(s.phase==='cold'?'glacial':'interglacial')+' map.');
}
for(const [id,h] of Object.entries(D.habitats)){
 const n=button(h.short,'ice-zone');n.dataset.habitat=id;n.style.left=h.x+'%';n.style.top=h.y+'%';
 n.setAttribute('aria-label','Place bear at '+h.name);n.onclick=()=>place(id,selected);
 dnd(n,'application/x-ice-map-bear',i=>place(id,i));$('destinations').append(n);
}
['g-cold','g-warm'].forEach((id,i)=>{
 const n=$(id);n.value=s.mathDraft[i];
 n.oninput=()=>{s.mathDraft[i]=n.value;s.mathChecked=false;$('math-feedback').textContent='';workChanged();};
});
$('math').onclick=()=>{
 s.mathChecked=isMathCorrect();const c=D.fmt(D.years(p(),false)),w=D.fmt(D.years(p(),true));
 const msg=s.mathChecked?'Both estimates match this time window. A single cycle can span thousands of bear generations.':'Not yet. The dates are '+c+' years apart for the glacial period and '+w+' years apart for the interglacial period. Divide each by 11.35 and round.';
 $('math-feedback').textContent=msg;save();controls();tell(s.mathChecked?'Both generation estimates passed.':'Recheck the two estimates. See the year counts beside the math check.');
};
$('lock').onclick=()=>{if(!s.locked&&!readyCycles())return;if(!s.locked){s.locked=true;save();}go('fossils');};
$('video').addEventListener('toggle',()=>{
 if(!$('video').open||videoLoaded)return;
 const iframe=mk('iframe');iframe.title='Summer ice minimum from 18,000 years ago to today';iframe.src='https://www.youtube-nocookie.com/embed/Q0KgdNk--iU';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';$('player').append(iframe);videoLoaded=true;
});
function drawFossil(){
 const f=D.fossils[site],file=$('fossil-file'),pin=s.pins.includes(site);
 const h=mk('h3',f.name),b=button(pin?'Remove pin':'Pin this site');
 b.id='ice-pin';b.setAttribute('aria-pressed',String(pin));
 b.onclick=()=>{
  const replacing=s.pins.filter(i=>D.fossils[i].bear===f.bear&&i!==site);
  if(pin)s.pins=s.pins.filter(i=>i!==site);
  else s.pins=[...s.pins.filter(i=>D.fossils[i].bear!==f.bear),site];
  workChanged();drawFossil();$('pin').focus();
  tell((pin?'Removed pin: ':'Pinned ')+f.name+'.'+(!pin&&replacing.length?' This replaced the earlier '+f.bear.toLowerCase()+' bear pin.':''));
 };
 file.replaceChildren(art(f.bear.toLowerCase()),h,mk('p',f.bear+' bear fossil · '+f.age+' years old'),b);
 $('fossil-select').value=String(site);
 all('.ice-marker').forEach((n,i)=>n.setAttribute('aria-pressed',String(i===site)));
 const ul=mk('ul');
 for(const i of s.pins){const f=D.fossils[i];ul.append(mk('li',f.name+' · '+f.bear+' bear · '+f.age+' years old'));}
 $('pins').replaceChildren(s.pins.length?ul:mk('p','No sites pinned yet.'));
 controls();
}
const svg=(n,attributes)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',n);for(const [k,v] of Object.entries(attributes))e.setAttribute(k,v);return e;};
D.fossils.forEach((f,i)=>{
 const b=button(String(i+1),'ice-marker');b.dataset.kind=f.bear;b.style.left=f.px+'%';b.style.top=f.py+'%';
 b.setAttribute('aria-label','Site '+(i+1)+': '+f.name+', '+f.bear.toLowerCase()+' bear');
 b.onclick=()=>{site=i;drawFossil();tell(f.name+': '+f.bear+' bear fossil, '+f.age+' years old.');};
 $('markers').append(b);
 const o=mk('option',(i+1)+'. '+f.name);o.value=i;$('fossil-select').append(o);
 $('leaders').append(svg('line',{x1:f.x*9,y1:f.y*3.9,x2:f.px*9,y2:f.py*3.9}),svg('circle',{cx:f.x*9,cy:f.y*3.9,r:4}));
});
$('fossil-select').onchange=e=>{site=Number(e.target.value);drawFossil();};
const roster=D.roster(s.id,s.rosterVersion), labels={north:'Snowy coast · seal prey',south:'Southern land · varied foods'}, geneIcon={fur:'◒',food:'◆',heat:'✦'};
D.genes.forEach((g,i)=>{
 const d=mk('details'),t=mk('summary'),icon=mk('span',geneIcon[g.icon],'ice-gene-icon');icon.setAttribute('aria-hidden','true');
 t.append(icon,g.id+' · '+g.trait);d.append(t,mk('p','Comparison: '+g.common+' / '+g.variant+'.'),mk('p',g.clue));
 d.addEventListener('toggle',()=>{if(d.open&&!s.genes.includes(i)){s.genes.push(i);save();controls();}});
 $('genes').append(d);
});
function names(card){return D.genes.map((g,i)=>g.id+': '+(card.variants[i]?g.variant:g.common));}
for(const c of roster){
 const b=button(undefined);b.dataset.trait=c.id;b.append(art(),mk('strong','Bear '+(c.id+1)),mk('span',c.variants.map(v=>v?'◆':'○').join(' '),'ice-symbols'));
 b.setAttribute('aria-label','Bear '+(c.id+1)+'. '+names(c).join('. '));
 b.title=names(c).join(' · ');b.onclick=()=>{selectedTrait=selectedTrait===c.id?-1:c.id;drawTraits();tell(selectedTrait===c.id?'Bear '+(c.id+1)+' selected. '+names(c).join('. ')+'. Choose a habitat.':'Bear deselected.');};
 draggable(b,c.id,'application/x-ice-trait-bear');$('roster').append(b);
}
$('roster').after(mk('p','Symbols in LYST, APOB, ARID5B order: ○ common form · ◆ variant. Select a bear to read all three traits.','ice-caption'));
for(const [id,label] of Object.entries(labels)){
 const card=mk('div',undefined,'ice-habitat'),b=button(label),result=mk('p','No candidate yet.','ice-caption');result.id='ice-hab-'+id;
 const scene=mk('div',undefined,'ice-habitat-scene');scene.dataset.habitat=id;const candidate=art();candidate.hidden=true;scene.append(candidate);card.append(scene);
 b.onclick=()=>matchTrait(id,selectedTrait);dnd(b,'application/x-ice-trait-bear',i=>matchTrait(id,i));
 card.append(b,result);$('trait-destinations').append(card);
}
function drawTraits(){
 all('#ice-roster button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.trait)===selectedTrait)));
 for(const k of Object.keys(labels)){
  const i=s.choices[k],result=$('hab-'+k);
  const scene=result.parentElement.querySelector('.ice-habitat-scene'),candidate=scene.firstChild;
  candidate.hidden=i===null;
  if(i!==null)candidate.src='assets/openscied-bear-profile-'+(roster[i].variants[0]?'polar':'brown')+'.svg';
  const feedback=i===null?null:D.suitability(k,roster[i]);
  result.textContent=i===null?'No candidate yet.':'Bear '+(i+1)+' · '+names(roster[i]).join(' · ')+'. '+feedback.note;
  result.dataset.match=feedback===null?'':feedback.supported?'supported':'retry';
 }
}
function matchTrait(k,i){
 if(!Number.isInteger(i)||!roster[i]){tell('Choose a candidate bear first, and then choose a habitat.');return;}
 s.choices[k]=i;selectedTrait=-1;workChanged();drawTraits();
 const candidate=$('hab-'+k).parentElement.querySelector('.ice-habitat-scene img');
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)candidate.animate([{transform:'translateX(-28px)',opacity:.2},{transform:'translateX(0)',opacity:1}],{duration:460,easing:'ease-out'});
 tell('Bear '+(i+1)+' placed in '+labels[k]+'. '+D.suitability(k,roster[i]).note);
}
function recap(){
 $('first-recap').textContent=s.answers.first||'';
 const lines=[
  p().id+' glacial: '+span(false)+' · '+D.fmt(D.generations(p()))+' generations.',
  'Following warm period: '+span(true)+' · '+D.fmt(D.generations(p(),true))+' generations.',
  ...phases.map(k=>(k==='cold'?'Glacial map: ':'Interglacial map: ')+s.moves[k].map((v,i)=>'Bear '+(i+1)+' at '+(D.habitats[v]?.short||'not placed')).join(', ')+'.'),
  ...s.pins.map(i=>{const f=D.fossils[i];return f.name+' · '+f.bear+' bear fossil · '+f.age+' years old.';}),
  ...s.genes.map(i=>D.genes[i].id+' — '+D.genes[i].clue),
  ...Object.keys(labels).filter(k=>s.choices[k]!==null).map(k=>labels[k]+': Bear '+(s.choices[k]+1)+' · '+names(roster[s.choices[k]]).join(' · ')+'.')
 ];
 const ul=mk('ul');for(const line of lines)ul.append(mk('li',line));
 $('evidence-recap').replaceChildren(mk('h3','Evidence you collected'),ul,...['fossilNote','traitNote'].filter(written).flatMap(k=>[mk('h3',k==='fossilNote'?'Your fossil comparison':'Your selection reasoning'),mk('p',s.answers[k])]));
}
all('[data-answer]').forEach(n=>{
 const k=n.dataset.answer;n.value=s.answers[k]||'';
 n.oninput=()=>{s.answers[k]=clean(n.value,k);workChanged();};
});
function showVerdict(){
 const out=$('limit-feedback');out.textContent=s.limitChoice?D.conclusion.feedback[s.limitChoice]:'';
 out.dataset.result=s.limitChoice?(s.limit?'correct':'incorrect'):'';
}
all('input[name=ice-limit]').forEach(n=>{
 n.checked=n.value===s.limitChoice;
 n.onchange=()=>{
  if(!n.checked||s.finished)return;
  s.limitChoice=n.value;s.limit=n.value==='possible';showVerdict();workChanged();tell(D.conclusion.feedback[n.value]);
 };
});
showVerdict();
$('finish').onclick=()=>{if(!readyFinal())return;s.finished=true;save();controls();$('edit').focus();tell('Investigation complete. Your final report is ready.');};
$('edit').onclick=()=>{
 if(!s.finished)return;
 s.finished=false;save();controls();$('revised').focus();
 tell('Editing reopened. Your work is still here. Edit this response, or use Find fossils or Test traits to update evidence. Finish again when you are ready.');
};
$('reset').onclick=()=>{$('confirm').value='';$('erase').disabled=true;$('reset-feedback').textContent='';$('reset-dialog').showModal();};
$('cancel').onclick=()=>$('reset-dialog').close();
$('confirm').oninput=e=>{$('erase').disabled=e.target.value!=='ERASE';};
$('reset-form').onsubmit=e=>{
 e.preventDefault();if($('confirm').value!=='ERASE')return;
 if(!canSave()||!session.reset(KEY).ok){$('reset-feedback').textContent='Could not clear this notebook. Reload and try again.';return;}
 history.replaceState(null,'',location.pathname+location.search);location.reload();
};
all('[data-step],[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.step||b.dataset.go));
window.Lab?.identity?.mount?.('#ice-identity',{compact:true,sharedDevice:true});
drawFossil();drawTraits();updateDates();
const hash=location.hash.slice(1);
go(gate(hash)?hash:gate(s.step)?s.step:routes.findLast(gate),false);
if(!canSave())$('save').textContent='This browser could not open a saved notebook. Save a copy of your report before closing.';
function collectReport(){
 const missing=[];if(!s.locked)missing.push('Save first argument.');if(!readyFossils())missing.push('Compare two kinds of fossils.');if(!readyTraits())missing.push('Compare inherited traits in two habitats.');if(!s.finished)missing.push('Finish the investigation.');
 const response=k=>({type:'answer',prompt:prompts[k],value:s.answers[k]});
 return {title:'Ice Age Bear Speciation Explorer',unit:'OpenSciEd B.5 · Lesson 4 companion',source:'OpenSciEd B.5 Lesson 4: Glacial and Interglacial Periods, Bear Fossils Map and Genetic Bear Data. Only the habitat placements and trait-card combinations are simulated.',status:!canSave()?'recovery':s.finished?'final':'draft',student:readIdentity(),datasetId:'ICE-'+s.id,missing,sections:[
  {title:'Climate model and first argument',items:[
   {type:'table',columns:['Cycle','Phase','Selected interval','Years','Generations'],rows:phases.map(k=>[p().id,k==='cold'?'Glacial':'Interglacial',span(k==='warm'),D.fmt(D.years(p(),k==='warm')),s.mathChecked?D.fmt(D.generations(p(),k==='warm')):'Not checked'])},
   {type:'table',columns:['Model bear','Glacial placement','Interglacial placement'],rows:[0,1,2].map(i=>['Bear '+(i+1),...phases.map(k=>D.habitats[s.moves[k][i]]?.name||'Not placed')])},response('first'),response('needed')]},
  {title:'Fossil evidence',items:[
   {type:'table',columns:['Location','Bear','Estimated age (years)'],rows:s.pins.map(i=>{const f=D.fossils[i];return[f.name,f.bear,f.age];})},response('fossilNote')]},
  {title:'Inherited traits and habitats',items:[
   ...s.genes.map(i=>({type:'text',text:D.genes[i].id+' — '+D.genes[i].clue})),
   ...Object.keys(labels).filter(k=>s.choices[k]!==null).map(k=>({type:'answer',prompt:labels[k],value:'Bear '+(s.choices[k]+1)+' · '+names(roster[s.choices[k]]).join(' · ')})),response('traitNote')]},
  {title:'Revision and next questions',items:[
   response('revised'),response('future'),{type:'answer',prompt:D.conclusion.question,value:s.limitChoice?D.conclusion.choices[s.limitChoice]+' '+D.conclusion.feedback[s.limitChoice]:''},
   {type:'text',text:'The map is schematic. Bear cards model possible effects on reproduction, not measured survival. Ancient DNA indicates later gene flow between the lineages.'}]}
 ]};
}
window.OpenSciEdSubmission?.mount({target:'#ice-report',filename:'ice-age-bear-speciation',collect:collectReport});
window.OpenSciEdB5ReportFiles?.bindHTML($('save-html'),collectReport,'ice-age-bear-speciation',tell);
$('backup').onclick=()=>{
 if(!writingStarted)return;
 const report=collectReport();
 const payload={
  format:'ice-age-bear-speciation-backup-v2',exportedAt:new Date().toISOString(),student:report.student,datasetId:report.datasetId,
  progress:{completed:doneCount(),total:4,summary:doneCount()+' of 4 steps complete',status:report.status},
  selectedCycle:p().id,climate:phases.map((k,i)=>({phase:k==='cold'?'Glacial':'Interglacial',
   cycle:p().id,fromYearsAgo:date(i===1)[0]*1000,toYearsAgo:date(i===1)[1]*1000,years:D.years(p(),i===1),
   generations:s.mathChecked?D.generations(p(),i===1):null,
   placements:s.moves[k].map((v,i)=>({bear:'Bear '+(i+1),habitat:D.habitats[v]?.name??null}))})),
  fossilPins:s.pins.map(i=>{const f=D.fossils[i];return {location:f.name,bear:f.bear,youngestYears:f.young,oldestYears:f.old};}),
  conclusionCheck:{question:D.conclusion.question,response:s.limitChoice?D.conclusion.choices[s.limitChoice]:null,
   verdict:s.limitChoice?(s.limit?'Correct':'Try again'):'Not answered',feedback:s.limitChoice?D.conclusion.feedback[s.limitChoice]:null},
  title:report.title,unit:report.unit,source:report.source,missing:report.missing,report:report.sections
 };
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
 const a=mk('a');a.href=url;a.download='ice-age-bear-speciation-backup.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
 tell('Downloaded the JSON backup for this activity.');
};
})();
