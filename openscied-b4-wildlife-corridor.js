/* Fictional habitats and neutral variants, not measured animal movements or a forecast.
   Only the experimental settings and student work are saved; every plotted value is rebuilt from the same seed. */
(() => {
  'use strict';
  const M=window.WildlifeCorridorLogic, saveAPI=window.OpenSciEdSaveSession;
  const KEY='aplab:openscied:b4-wildlife-corridor:v1', SCOPE='b4-wildlife-corridor';
  const STEPS=['predict','model','explain'];
  const CONDITIONS=['connected','road','corridor'];
  const LABEL={connected:'Connected habitat',road:'Road, no crossing',corridor:'Road with crossing'};
  const PRED={connected:'More similar in connected habitat',same:'About the same',divided:'More similar with the road and no crossing'};
  const $=(sel,root=document)=>root.querySelector(sel), $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
  const by=id=>$('#wc-'+id);
  const make=(tag,text,className)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;};
  const set=(id,text)=>{const el=by(id);if(el)el.textContent=text;};
  const show=(id,visible)=>{const el=by(id);if(el)el.hidden=!visible;};
  const announce=text=>set('status',text);
  if(!M){announce('The model did not load. Reload this page to try again.');return;}
  const END=M.GENERATIONS, MAX=2400;
  const seed=()=>{try{return window.crypto.getRandomValues(new Uint32Array(1))[0];}catch(_){return (Date.now()+Math.random()*0x100000000)>>>0;}};
  const labelId=n=>'WC-AA-'+n.toString(16).toUpperCase().padStart(8,'0');
  const newState=()=>({v:1,model:'Aa',seed:seed(),step:'predict',prediction:null,generations:{baseline:0,corridor:0},crossing:-1,claim:'',limits:'',finished:false,lastVisitedAt:0});
  const text=value=>typeof value==='string'?value.slice(0,MAX):'';
  const choice=value=>Object.prototype.hasOwnProperty.call(PRED,value);
  let session;
  try{session=saveAPI?.open(window.localStorage,SCOPE,[KEY]);}catch(_){}
  const reportIdentity=saveAPI?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
  let state=newState(), badRecord=false, oldRecord=false, warned='', selected=false, process='', timer=0;
  let models={}, inspectedHabitat=null, inspectedOffspring=null;
  function decode(raw){
    const s=JSON.parse(raw), a=s?.generations?.baseline, b=s?.generations?.corridor;
    const valid=n=>Number.isInteger(n)&&n>=0&&n<=END;
    if(s?.v===1&&s.model===undefined){oldRecord=true;return newState();}
    if(s?.model!=='Aa'||s?.v!==1||!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||!valid(a)||!valid(b)||![-1,1].includes(s.crossing)||
       ((s.crossing===1||b>0)&&a!==END)||(b>0&&s.crossing!==1))throw Error('Unrecognized investigation');
    const prediction=choice(s.prediction?.choice)&&text(s.prediction.reason).trim()?{choice:s.prediction.choice,reason:text(s.prediction.reason)}:null;
    if(a>0&&!prediction)throw Error('Unrecognized investigation');
    return {v:1,model:'Aa',seed:s.seed,step:STEPS.includes(s.step)?s.step:'predict',prediction,generations:{baseline:a,corridor:b},crossing:s.crossing,
      claim:text(s.claim),limits:text(s.limits),finished:s.finished===true&&b===END&&!!text(s.claim).trim()&&!!text(s.limits).trim(),
      lastVisitedAt:Number.isFinite(s.lastVisitedAt)?s.lastVisitedAt:0};
  }
  try{const raw=session?.read(KEY)??null;if(raw!==null)try{state=decode(raw);}catch(_){badRecord=true;}}catch(_){}
  function restoreModels(){
    models={connected:M.run(state.seed,'connected',state.generations.baseline),
      road:M.run(state.seed,'road',state.generations.baseline),corridor:M.run(state.seed,'corridor',state.generations.corridor)};
  }
  function notSaved(reason){
    const msg=(reason==='erased'?'Work was cleared on this device. This tab won’t restore the old copy.':reason==='changed'?
      'A newer copy was saved in another tab. This tab won’t overwrite it.':reason==='invalid'?
      'A saved copy could not be read. This tab won’t overwrite it.':'This browser could not save your work.')+' Download a draft or recovery copy for your records.';
    set('save-warning-text',msg);show('save-warning',true);set('save','Not saved');
    if(msg!==warned){warned=msg;announce(msg);}
    return false;
  }
  function saved(){oldRecord=false;warned='';show('save-warning',false);set('save','Saved on this device');reportIdentity();return true;}
  function save(){
    state.lastVisitedAt=Date.now();
    if(badRecord)return notSaved('invalid');
    const result=session?.write(KEY,JSON.stringify(state));
    return result?.ok?saved():notSaved(result?.reason);
  }
  function monitor(){
    const check=session?.check(KEY);
    if(badRecord||!check?.ok)notSaved(badRecord?'invalid':check?.reason);
  }
  const available=step=>step==='predict'||step==='model'&&!!state.prediction||step==='explain'&&state.generations.corridor===END;
  function go(step,{focus=true}={}){
    if(!available(step))return;
    if(step!=='model')pause(false);
    state.step=step;
    for(const section of $$('[data-wc-step]'))section.hidden=section.dataset.wcStep!==step;
    for(const btn of $$('[data-wc-go]')){
      btn.disabled=!available(btn.dataset.wcGo);
      if(btn.dataset.wcGo===step)btn.setAttribute('aria-current','step');else btn.removeAttribute('aria-current');
    }
    if(location.hash!=='#'+step)history.replaceState(null,'','#'+step);
    if(focus){by(step+'-title')?.focus({preventScroll:true});by(step)?.scrollIntoView({block:'start'});}
  }
  const conditionSummary=id=>M.summarize(models[id]);
  const experimentIds=()=>state.generations.corridor>0?CONDITIONS:state.generations.baseline>0?CONDITIONS.slice(0,2):[];
  const copies=(s,i,allele)=>Number(s.patches[i].variantCounts[allele]);
  const gap=s=>Math.abs(copies(s,0,'A')-copies(s,1,'A'));
  const patchCounts=(s,i)=>copies(s,i,'A')+' A, '+copies(s,i,'a')+' a';
  const recordedIds=()=>experimentIds().filter(id=>models[id].generation===END);
  const stats=s=>[patchCounts(s,0),patchCounts(s,1),gap(s),s.crossPatchContributions];
  const finalRows=(ids=recordedIds())=>ids.map(id=>[LABEL[id],...stats(conditionSummary(id))]);
  const headers=['West: allele copies','East: allele copies','Gap in A copies','Copies from the other side'];
  const endHeaders=['Habitat at generation '+END,...headers];
  const startingNote='At the start: West had 20 A and 4 a; East had 4 A and 20 a. Each patch has 24 copies total. A smaller gap means the two patches are more similar.';
  function table(host,caption,cols,rows){
    if(!host)return;
    const t=make('table',null,'wc-data-table'), h=make('thead'), hr=make('tr'), body=make('tbody');
    t.append(make('caption',caption));t.append(h,body);h.append(hr);
    for(const col of cols){const th=make('th',col);th.scope='col';hr.append(th);}
    for(const row of rows){
      const tr=make('tr');
      row.forEach((cell,i)=>{const td=make(i?'td':'th',cell);if(i)td.dataset.label=cols[i];else td.scope='row';tr.append(td);});
      body.append(tr);
    }
    host.append(t);
  }
  const genotypeOf=alleles=>alleles.slice().sort().join('/');
  const patchName=patch=>patch===0?'West':'East';
  const position=(patch,index)=>[(patch===0?10:60)+(index%4)*9.5,37+Math.floor(index/4)*14];
  const animalName=(patch,index)=>patchName(patch)+' '+(index+1);
  function hidePair(board){
    const host=by('pair-'+board);
    if(host){host.hidden=true;host.replaceChildren();}
  }
  function drawMates(detail,animate,replay=false){
    const board=detail.condition==='connected'?'connected':'road';
    const host=by('pair-'+board);
    if(!host)return;
    const key=JSON.stringify([detail.condition,detail.generation,detail.patch,detail.animal]);
    if(host.dataset.trace===key&&!host.hidden&&!replay)return;
    host.dataset.trace=key;
    host.hidden=false;
    host.dataset.animated=String(animate);
    host.replaceChildren();
    const [x,y]=position(detail.patch,detail.animal);
    const joint=[detail.patch===0?34:66,50];
    detail.parents.forEach((parent,i)=>{
      const origin=detail.origins[i], [fromX,fromY]=position(origin,parent.index);
      const actor=make('span',null,'wc-mate wc-mate-parent');
      actor.dataset.coat=parent.genotype.includes('A')?'dark':'light';
      actor.dataset.crossing=String(origin!==detail.patch);
      for(const [key,value] of Object.entries({x:fromX,y:fromY,mx:joint[0]+(i===0?-6:6),my:joint[1],
          vx:origin!==detail.patch?50:(fromX+joint[0])/2,vy:origin!==detail.patch?50:(fromY+joint[1])/2})){
        actor.style.setProperty('--wc-'+key,value+'%');
      }
      actor.append(make('span',i===0?'P1':'P2','wc-mate-tag'),make('span',genotypeOf(parent.genotype),'wc-mate-gene'));
      host.append(actor);
      const copy=make('span',detail.alleles[i],'wc-map-copy');
      copy.dataset.parent=String(i+1);
      copy.style.setProperty('--wc-copy-start',(joint[0]+(i===0?-8:8))+'%');
      copy.style.setProperty('--wc-copy-end',(joint[0]+(i===0?-2:2))+'%');
      host.append(copy);
    });
    const child=make('span',null,'wc-mate wc-mate-child');
    for(const [key,value] of Object.entries({x,y,mx:joint[0],my:joint[1]}))child.style.setProperty('--wc-'+key,value+'%');
    child.append(make('span','Offspring','wc-mate-tag'),make('span',genotypeOf(detail.alleles),'wc-mate-gene'));
    host.append(child);
  }
  // Show two inherited copies from one real offspring record, not a separate simulation.
  // The path represents inheritance; it does not imply that an allele crosses a road alone.
  function renderMix(host, detail, animate=true){
    if(!host)return;
    if(!detail||!detail.generation||!detail.alleles?.every(a=>a==='A'||a==='a')||
       detail.alleles.length!==2||detail.origins?.length!==2){
      host.hidden=true;
      delete host.dataset.wcMixKey;
      return;
    }
    const {condition,patch,alleles,origins,generation}=detail;
    const key=JSON.stringify([condition,patch,generation,detail.animal,alleles,origins]);
    host.hidden=false;
    if(host.dataset.wcMixKey===key)return;
    host.dataset.wcMixKey=key;
    const zone=p=>p===0?'West':'East';
    const names={connected:'Connected habitat',road:'Road, no crossing',corridor:'Road with crossing'};
    const genotype=genotypeOf(alleles);
    const otherCount=origins.filter(origin=>origin!==patch).length;
    const traffic=otherCount>0?(condition==='corridor'?'A parent from the other side can contribute a copy when the crossing connects the patches.':
      'A parent from the other patch contributed a copy. That’s gene flow.'):
      'Both copies in this offspring came from parents in the same patch.';
    const heading=make('h3','Watch inheritance');
    const sub=make('p',(names[condition]||'Modeled habitat')+' · Generation '+generation+' · Offspring '+animalName(patch,detail.animal),'wc-mix-context');
    const path=make('div',null,'wc-mix-grid');
    path.setAttribute('aria-hidden','true');
    path.dataset.animated=String(animate);
    for(let i=0;i<2;i++){
      const origin=origins[i], allele=alleles[i], other=origin!==patch;
      const parent=make('div',null,'wc-mix-parent');
      const adult=detail.parents[i];
      parent.append(make('strong','Parent '+(i+1)+': '+animalName(origin,adult.index)),make('span','Genotype '+genotypeOf(adult.genotype),'wc-mix-location'),
        make('span',allele,'wc-mix-allele'));
      const lane=make('div',null,'wc-mix-lane');
      lane.dataset.other=String(other);
      if(other&&condition==='corridor')lane.dataset.road='true';
      const travel=make('span',null,'wc-mix-travel');
      travel.append(make('span',allele,'wc-mix-allele'));
      lane.append(travel);
      path.append(parent,lane);
    }
    const offspring=make('div',null,'wc-mix-offspring');
    offspring.append(make('strong','Offspring'),make('span',genotype,'wc-mix-genotype'),make('span',zone(patch)+' patch','wc-mix-location'));
    path.append(offspring);
    const summary=make('p',animalName(origins[0],detail.parents[0].index)+' ('+genotypeOf(detail.parents[0].genotype)+') passes '+alleles[0]+'. '+
      animalName(origins[1],detail.parents[1].index)+' ('+genotypeOf(detail.parents[1].genotype)+') passes '+alleles[1]+
      '. Their offspring in the '+zone(patch)+' patch is '+genotype+'. '+traffic,'wc-mix-summary');
    host.replaceChildren(heading,sub,path,summary);
  }
  function offspringFor(id,index=null){
    const m=models[id];
    const individuals=m.patches.flatMap((patch,zone)=>patch.map((animal,i)=>({...animal,patch:zone,animal:i})));
    const cross=individuals.findIndex(a=>a.origins?.some(origin=>origin!==a.patch));
    const selected=index??Math.max(0,cross);
    return {index:selected,detail:{...individuals[selected],condition:id,generation:m.generation}};
  }
  function showInheritance(replay=false){
    const auto=state.generations.corridor>0||process==='corridor'?'corridor':'connected';
    const id=inspectedHabitat&&models[inspectedHabitat].generation>0?inspectedHabitat:auto;
    const m=models[id], host=by('mix'), which=by('mix-habitat'), pick=by('mix-offspring');
    if(!host)return;
    if(!m.generation){
      renderMix(host,null);show('mix-actions',false);
      for(const board of ['connected','road'])hidePair(board);
      return;
    }
    const {index,detail}=offspringFor(id,inspectedOffspring);
    if(which){
      const cases=CONDITIONS.filter(c=>models[c].generation>0);
      if(which.dataset.options!==cases.join(',')){
        which.replaceChildren(...cases.map(c=>{const opt=make('option',LABEL[c]);opt.value=c;return opt;}));
        which.dataset.options=cases.join(',');
      }
      which.value=id;which.disabled=!!process;
    }
    if(pick){
      if(pick.dataset.options===undefined){
        pick.replaceChildren(...m.patches.flatMap((patch,zone)=>patch.map((_,i)=>{
          const opt=make('option',animalName(zone,i));opt.value=String(zone*M.PATCH_SIZE+i);return opt;
        })));
        pick.dataset.options='ready';
      }
      pick.value=String(index);pick.disabled=!!process;
    }
    const animate=!reduced();
    // The first experiment advances the two populations together. Even a
    // road with zero gene flow still has parents and offspring on each side.
    const paired=process==='baseline'||(!replay&&!inspectedHabitat&&inspectedOffspring===null&&id==='connected'&&models.road.generation>0);
    if(paired){
      drawMates(offspringFor('connected').detail,animate);
      drawMates(offspringFor('road').detail,animate);
    }else{
      hidePair(id==='connected'?'road':'connected');
      drawMates(detail,animate,replay);
    }
    if(replay)delete host.dataset.wcMixKey;
    renderMix(host,detail,animate);
    show('mix-actions',true);
  }
  function renderMap(id,board){
    const m=models[id], s=conditionSummary(id), map=by('map-'+board), layer=by('tokens-'+board);
    if(!map||!layer)return;
    set('map-'+board+'-readout',LABEL[id]+' · Generation '+m.generation+' · West: '+patchCounts(s,0)+' · East: '+patchCounts(s,1)+(m.generation?' · '+s.crossPatchContributions+' copies inherited from the other patch':''));
    layer.replaceChildren();
    layer.setAttribute('aria-hidden','true');
    layer.classList.toggle('wc-tokens-moving',!!process);
    for(const [patch,individuals] of m.patches.entries()){
      for(const [i,a] of individuals.entries()){
        const dot=make('span',genotypeOf(a.alleles),'wc-token'), [x,y]=position(patch,i);
        dot.style.setProperty('--wc-x',x+'%');dot.style.setProperty('--wc-y',y+'%');
        dot.dataset.coat=a.alleles.includes('A')?'dark':'light';
        if(a.origins?.some(origin=>origin!==patch))dot.dataset.connected='true';
        layer.append(dot);
      }
    }
    map.dataset.condition=id;
    map.dataset.crossing=String(state.crossing===1&&board==='road'&&!(state.generations.corridor>0&&id==='road'));
  }
  function renderResults(){
    const ids=experimentIds(), host=by('results'), next=by('explain-evidence');
    if(host){
      host.replaceChildren();
      if(!ids.length)host.append(make('p','Run the matched habitats to see how many copies of A and a each patch has.','wc-note'));
      else {
        table(host,'Latest result in each modeled habitat',['Habitat','Generation',...headers],ids.map(id=>{
          const s=conditionSummary(id);return [LABEL[id],models[id].generation,...stats(s)];
        }));
        host.append(make('p',startingNote,'wc-note'));
      }
    }
    if(next){
      next.replaceChildren();
      if(state.generations.corridor===END){
        table(next,'Your evidence · same starting animals, '+END+' generations',endHeaders,finalRows());
        next.append(make('p',startingNote,'wc-note'));
      }
    }
  }
  function gates(){
    for(const btn of $$('[data-wc-go]')){
      btn.disabled=!available(btn.dataset.wcGo);
      if(btn.dataset.wcGo===state.step)btn.setAttribute('aria-current','step');else btn.removeAttribute('aria-current');
    }
    const baseline=state.generations.baseline, corridor=state.generations.corridor, hasCrossing=state.crossing===1;
    const baselineButton=by('run-baseline'), crossingButton=by('run-crossing'), tile=by('crossing-tile');
    if(baselineButton){baselineButton.disabled=!state.prediction||baseline===END||process==='corridor';
      baselineButton.textContent=process==='baseline'?'Pause the matched habitats':baseline===END?'Matched habitats complete':baseline?'Continue matched habitats':'Run both habitats';}
    if(crossingButton){crossingButton.disabled=baseline!==END||!hasCrossing||corridor===END||process==='baseline';
      crossingButton.textContent=process==='corridor'?'Pause the crossing model':corridor===END?'Crossing model complete':corridor?'Continue with the crossing':'Run with the crossing';}
    if(tile){tile.disabled=baseline!==END||corridor>0||process==='corridor';tile.draggable=!tile.disabled;tile.setAttribute('aria-pressed',String(selected));}
    for(const slot of $$('[data-wc-crossing-slot]')){
      slot.disabled=baseline!==END||corridor>0||process==='corridor';
      slot.setAttribute('aria-pressed',String(hasCrossing&&slot.dataset.wcCrossingSlot==='1'));
    }
    set('model-hint',!state.prediction?'Save a prediction to open the maps.':baseline<END?'Run the same starting animals in both habitats through generation '+END+' to unlock the crossing.':
      !hasCrossing?'Drag or select the crossing tile, then choose a place that joins the two patches.':corridor<END?
        'Run from generation 0 again with the same starting animals. Only the crossing changes.':'All three habitat runs are ready to compare. Open Explain to use your results.');
    const finish=by('finish');
    if(finish){finish.disabled=corridor!==END||!state.claim.trim()||!state.limits.trim()||state.finished;
      finish.textContent=state.finished?'Investigation complete':'Finish investigation';}
    set('finish-hint',state.finished?'Open the student report to check or download your work.':
      'Write both responses before you finish.');
    set('dataset',labelId(state.seed));
  }
  function render(){
    renderMap('connected','connected');
    renderMap(state.generations.corridor>0&&inspectedHabitat!=='road'?'corridor':'road','road');
    showInheritance();
    renderResults();
    gates();
    const lock=state.generations.baseline>0||!!process;
    for(const input of $$('[name="wc-prediction"]'))input.disabled=lock;
    if(by('reason'))by('reason').readOnly=lock;
    const predict=by('prediction-form')?.querySelector('[type="submit"]');
    if(predict){predict.hidden=lock;predict.disabled=lock;}
    show('return-model',lock);
  }
  function pause(inform=true){
    if(!process)return;
    const which=process;
    window.clearTimeout(timer);timer=0;process='';
    if(inform){render();announce('Paused at generation '+state.generations[which]+'. Continue when you are ready.');}
  }
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function play(which){
    if(process===which)return pause();
    if(process||!available('model')||which==='corridor'&&(state.generations.baseline!==END||state.crossing!==1)||state.generations[which]>=END)return;
    process=which;inspectedHabitat=null;inspectedOffspring=null;
    if(which==='corridor'&&state.generations.corridor===0){
      // Give the reset to the matched starting population a visible frame before the first generation.
      renderMap('corridor','road');
      showInheritance();
      gates();
    }else render();
    announce(which==='baseline'?'Running two habitats from the same start.':'Restarting the road habitat with the crossing and the same starting animals.');
    const step=()=>{
      if(process!==which)return;
      state.generations[which]=reduced()?END:state.generations[which]+1;
      const finished=state.generations[which]===END;
      if(finished){process='';timer=0;}
      restoreModels();render();
      const ok=save();
      if(finished){
        if(ok)announce(which==='baseline'?'Matched runs complete. Now place a crossing to test whether it changes the outcome.':
          'Crossing run complete. Open Explain to compare your three results.');
        return;
      }
      timer=window.setTimeout(step,1500);
    };
    // Save each observed generation so reloading never wipes a partial run.
    timer=window.setTimeout(step,reduced()?0:1500);
  }
  function selectTile(next){
    if(state.generations.baseline!==END||state.generations.corridor>0||process==='corridor')return;
    selected=next;
    if(!next&&state.crossing===1){
      state.crossing=-1;
      if(save())announce('Crossing removed. You can place it again before running the model.');
      render();return;
    }
    gates();
    announce(next?'Crossing selected. Choose a marked spot on the road where both trails meet.':'Crossing selection cleared.');
  }
  function place(slot,dragged=false){
    if(state.generations.baseline!==END||state.generations.corridor>0||process==='corridor')return;
    if(!selected&&!dragged&&state.crossing!==1){announce('Select the crossing tile first, then choose a road spot.');return;}
    if(slot!==1){
      announce(slot===0?'The rocky north bank has no path into both patches. Look for two trail ends.':
        'The south cut does not reach both patch trails. Look for two trail ends.');return;
    }
    state.crossing=1;selected=true;
    const ok=save();render();
    if(ok)announce('Crossing placed where the two trails meet. Run again with the same starting animals.');
  }
  function submissionReport(){
    const missing=[];
    if(!state.prediction)missing.push('Save a prediction and its reason.');
    if(state.generations.baseline!==END)missing.push('Run both matched habitats through generation '+END+'.');
    if(state.generations.corridor!==END)missing.push('Place a crossing and run it through generation '+END+'.');
    if(!state.claim.trim())missing.push('Write your evidence-based claim.');
    if(!state.limits.trim())missing.push('Explain a limit of the model.');
    if(!state.finished)missing.push('Choose Finish investigation.');
    const notes=[{type:'text',text:'All values come from a seeded classroom model of fictional animals. Each patch has '+M.PATCH_SIZE+' animals with two inherited copies each. Population size is held fixed, so the differences are in allele counts and gene flow, not survival. A is dominant for coat appearance only.'}];
    for(const id of experimentIds()){
      const m=models[id];
      const rows=m.history.map(s=>[s.generation,...stats(s)]);
      notes.push({type:'table',title:LABEL[id]+' · generation record',columns:['Generation',...endHeaders.slice(1)],rows});
    }
    const student=reportIdentity()||{};
    return {title:'Wildlife Corridor Lab',unit:'OpenSciEd Biology B.4 · Lessons 8–9 supplemental',source:'Independent OpenSciEd companion by Robert Smitka. Fictional habitat and modeled inheritance, not field data.',
      status:badRecord||!session?.check(KEY)?.ok?'recovery':missing.length?'draft':'final',missing,
      student:{name:student.name||'',period:student.period||''},datasetId:labelId(state.seed),keyResults:finalRows().map(row=>({
        label:row[0]+' · generation '+END,value:'West: '+row[1]+'; East: '+row[2],note:'Gap: '+row[3]+' A copies. '+row[4]+' copies from the other side in this generation.'})),
      sections:[{title:'My prediction and explanation',items:[
        {type:'answer',prompt:'Which setup will make the allele counts more similar across the two patches?',value:PRED[state.prediction?.choice]||''},
        {type:'answer',prompt:'What is your prediction based on?',value:state.prediction?.reason||''},
        {type:'answer',prompt:'What does your comparison show? Cite numbers from two setups.',value:state.claim},
        {type:'answer',prompt:'What can’t this model tell you about a real crossing?',value:state.limits}
      ]},{title:'My simulated evidence',items:notes}]};
  }
  function fill(){
    for(const el of $$('[name="wc-prediction"]')){
      if(el.matches('select'))el.value=state.prediction?.choice||'';
      else el.checked=el.value===state.prediction?.choice;
    }
    for(const key of ['reason','claim','limits'])if(by(key))by(key).value=(key==='reason'?state.prediction?.reason:state[key])||'';
  }
  for(const btn of $$('[data-wc-go]'))btn.addEventListener('click',()=>{
    const step=btn.dataset.wcGo;if(!available(step))return;
    go(step);
    render();
    // View navigation alone does not become fresh progress or revive an erased record.
  });
  by('prediction-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    if(state.generations.baseline>0||process)return;
    const pick=$('[name="wc-prediction"]:checked')||$('select[name="wc-prediction"]'), reason=text(by('reason')?.value).trim();
    if(!choice(pick?.value)||!reason){announce('Choose a prediction and give a reason first.');return;}
    state.prediction={choice:pick.value,reason};go('model');render();
    if(save())announce('Prediction saved. Run the matched habitats.');
  });
  by('mix-habitat')?.addEventListener('change',e=>{
    if(CONDITIONS.includes(e.target.value)&&models[e.target.value].generation>0){
      inspectedHabitat=e.target.value;inspectedOffspring=null;
      renderMap(state.generations.corridor>0&&inspectedHabitat!=='road'?'corridor':'road','road');
      showInheritance(true);
    }
  });
  by('mix-offspring')?.addEventListener('change',e=>{
    const index=Number(e.target.value);
    if(Number.isInteger(index)&&index>=0&&index<M.PATCH_SIZE*2){inspectedOffspring=index;showInheritance(true);}
  });
  by('replay-mix')?.addEventListener('click',()=>{
    showInheritance(true);
    const active=by('pair-road')?.hidden?'connected':'road';
    by('map-'+active)?.scrollIntoView({block:'center',behavior:'instant'});
  });
  by('run-baseline')?.addEventListener('click',()=>play('baseline'));
  by('run-crossing')?.addEventListener('click',()=>play('corridor'));
  by('crossing-tile')?.addEventListener('click',()=>selectTile(!selected));
  by('crossing-tile')?.addEventListener('dragstart',e=>{
    if(e.currentTarget.disabled){e.preventDefault();return;}
    e.dataTransfer.setData('text/plain','wc-crossing-tile');e.dataTransfer.effectAllowed='move';
    selected=true;gates();
  });
  for(const slot of $$('[data-wc-crossing-slot]')){
    slot.addEventListener('click',()=>place(Number(slot.dataset.wcCrossingSlot)));
    slot.addEventListener('dragover',e=>{if(!slot.disabled&&selected){e.preventDefault();e.dataTransfer.dropEffect='move';}});
    slot.addEventListener('drop',e=>{
      if(slot.disabled||e.dataTransfer.getData('text/plain')!=='wc-crossing-tile')return;
      e.preventDefault();place(Number(slot.dataset.wcCrossingSlot),true);
    });
  }
  for(const key of ['claim','limits'])by(key)?.addEventListener('input',e=>{
    state[key]=text(e.target.value);
    if(state.finished&&!state[key].trim())state.finished=false;
    save();gates();
  });
  by('finish')?.addEventListener('click',()=>{
    if(state.generations.corridor!==END||!state.claim.trim()||!state.limits.trim())return;
    state.finished=true;gates();
    if(save())announce('Investigation complete. Your student report is ready.');
  });
  by('reset')?.addEventListener('click',()=>by('reset-dialog')?.showModal());
  by('confirm-reset')?.addEventListener('click',()=>{
    const next=newState(), result=session?.reset(KEY,JSON.stringify(next));
    if(!result?.ok){by('reset-dialog')?.close();notSaved(result?.reason);return;}
    by('reset-dialog')?.close();
    pause(false);state=next;selected=false;inspectedHabitat=null;inspectedOffspring=null;badRecord=false;restoreModels();fill();go('predict');render();saved();
    announce('A new investigation is ready.');
  });
  window.addEventListener('hashchange',()=>{
    const asked=location.hash.slice(1);
    go(available(asked)?asked:state.step,{focus:false});render();
  });
  window.addEventListener('storage',e=>{
    if(!e.key||e.key===KEY||(saveAPI&&[saveAPI.globalKey,saveAPI.scopeKey(SCOPE),saveAPI.resetKey(KEY)].includes(e.key)))monitor();
  });
  window.addEventListener('pageshow',monitor);
  restoreModels();fill();selected=state.crossing===1;
  const initial=location.hash.slice(1);
  go(available(initial)?initial:available(state.step)?state.step:'predict',{focus:false});
  render();monitor();
  if(oldRecord)announce("This model now uses A and a. The older preview used a different question, so start with a fresh prediction.");
  const report=window.OpenSciEdSubmission?.mount({target:'#wc-report',collect:submissionReport,filename:'wildlife-corridor-investigation'});
  by('recovery')?.addEventListener('click',()=>report?.open());
})();
