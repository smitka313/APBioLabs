/* Hands-on optional carrying-capacity extension. The separate Lesson 5 grass
   model is not used or changed. All state stays on this device. */
(function (root) {
  'use strict';
  const L=root.CarryingHabitat;
  const KEY='aplab:openscied:b1-carrying-capacity:habitat:v1';
  const NAMES={food:'Food',water:'Water',shelter:'Shelter'};
  const NEED={food:'forage',water:'drinking water',shelter:'shade or cover'};
  const EDIT={food:'Less food',water:'Less water',shelter:'Less shelter'};
  const PREDICTIONS=['none','food','water','shelter'];
  const GLYPHS={
    food:'<path d="M6 17Q3 7 18 5q1 11-7 13l-4 1m0 2 7-8m-4 5-1-5m2 3 5-2"/>',
    water:'<path d="M12 3C10 7 5 12 5 16a7 7 0 0 0 14 0c0-4-5-9-7-13Z"/><path d="M8 16q0 3 3 4"/>',
    shelter:'<path d="M12 3 20 7v6q0 5-8 8-8-3-8-8V7Z"/><path d="M7 13q1-4 5-4t5 4H7m5 0v4"/>'
  };
  const ANIMAL='<path d="M11 10q2-4 7-4 2 0 5 2l9 1q4 0 5 3t-3 6l-8 1-8-1-4 2-4-3-4 3-3-1 1-4 4-4 3-1Zm5 8-3 6-1 4m7-10-2 7 1 3m12-10 2 7-1 3m1-10 4 5v5m1-15q4 1 2 5m-29 1 2 4"/><path d="M6 14Q0 11 3 7 4 6 5 8m1 6Q13 9 11 5 10 4 9 6"/><circle cx="7.5" cy="13.2" r=".55" fill="currentColor" stroke="none"/>';
  const blank=()=>({v:1,scenario:'',prediction:'',a:null,b:null});
  const scenario=id=>L.SCENARIOS.find(s=>s.id===id);
  const chosen=id=>id!=='balanced'&&scenario(id);
  const name=r=>NAMES[r]||'';
  const numeral=id=>id.startsWith('a')?id.slice(1):id;
  const text=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const unit=n=>n===1?'unit':'units';
  function glyph(resource){
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+GLYPHS[resource]+'</svg>';
  }
  const animalIcon='<svg viewBox="0 0 42 30" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+ANIMAL+'</svg>';
  function restore(raw) {
    if(raw===null)return blank();
    try{
      const s=JSON.parse(raw);
      if(s?.v!==1 || (s.scenario!==''&&!chosen(s.scenario)) || (s.prediction!==''&&!PREDICTIONS.includes(s.prediction)))return null;
      const a=s.a===null?null:L.restore(s.a),b=s.b===null?null:L.restore(s.b);
      if((s.a!==null&&!a)||(s.b!==null&&!b)||
        (a&&(a.scenarioId!=='balanced'||a.generation!==1||!chosen(s.scenario)||!PREDICTIONS.includes(s.prediction)))||
        (b&&(b.generation!==1||b.scenarioId!==s.scenario||a?.phase!=='complete')))return null;
      return {v:1,scenario:s.scenario,prediction:s.prediction,a,b};
    }catch(_){return null;}
  }
  function describe(row){
    if(!row.limiting.length)return 'No resource limited survival in this trial. Every animal found the resource on its card.';
    return row.limiting.map(r=>{
      const x=row.byResource[r];
      return name(r)+' was a limiting factor: '+x.needed+' animals needed '+NEED[r]+', but only '+x.available+' '+unit(x.available)+' '+(x.available===1?'was':'were')+' available. '+x.unmatched+' '+(x.unmatched===1?'animal went':'animals went')+' unmatched.';
    }).join(' ');
  }
  const short=(label,x)=>label+': '+x.starting+' at start; '+x.survivors+' survived; '+x.deaths+' unmatched; '+x.births+' calves; next herd '+x.ending+'. '+describe(x);
  function compareText(state){
    if(!state.a || !state.b || state.a.phase!=='complete'||state.b.phase!=='complete')return '';
    const change=L.comparison(state.scenario).changes[0], a=L.summary(state.a), b=L.summary(state.b);
    const growth=b.ending>b.starting&&b.ending<a.ending?' Trial B’s herd still grew from '+b.starting+' to '+b.ending+'; the shortage slowed growth rather than making the entire population shrink.':'';
    return 'Both trials began with the same '+a.starting+' animals and the same needs. Only '+name(change.resource).toLowerCase()+' changed: '+change.baseline+' to '+change.scenario+' '+unit(change.scenario)+'. The next herd went from '+a.ending+' to '+b.ending+' across the trials.'+growth+' Extra units at another station could not meet an animal’s assigned need.';
  }
  function reportText(state){
    const a=state.a?.phase==='complete'&&L.summary(state.a), b=state.b?.phase==='complete'&&L.summary(state.b);
    if(!a)return '';
    const pred=state.prediction==='none'?'No resource':name(state.prediction);
    return ['Prediction for Trial B: '+pred+' would limit survival.',
      short('Trial A · Balanced habitat',a),
      b&&short('Trial B · '+scenario(state.scenario).label,b),
      b&&compareText(state)].filter(Boolean).join('\n');
  }

  function mount(host,{announce}={}){
    if(!host||!L)return null;
    let state=blank(),storage='ok',raw=null;
    try{raw=root.localStorage.getItem(KEY);const s=restore(raw);if(s)state=s;else storage='preserved';}
    catch(_){storage='blocked';}
    let selected='',gesture=null,ghost=null,suppress=null,lastMessage='',recent='';
    host.classList.add('cc-habitat-ui');
    const $=s=>host.querySelector(s), $$=s=>Array.from(host.querySelectorAll(s));
    const active=()=>state.b?.phase==='match'?state.b:state.a?.phase==='match'?state.a:null;
    const trialName=()=>state.b?'Trial B':'Trial A';
    const currentCard=id=>active()?.animals.find(a=>a.id===id);
    const selectStart=()=>!!chosen(state.scenario)&&PREDICTIONS.includes(state.prediction);
    function tell(message) {
      lastMessage=message;
      const target=$('#cc-habitat-live');
      if(target)target.textContent=message;
      if(typeof announce==='function')announce(message);
    }
    function persist(){
      if(storage==='preserved')return;
      try{root.localStorage.setItem(KEY,JSON.stringify(state));storage='ok';}
      catch(_){storage='blocked';}
    }
    function focus(selector){$(selector)?.focus({preventScroll:true});}
    function storageNote(){
      if(storage==='preserved')return '<p class="cc-habitat-notice">The saved habitat record could not be read. It has been preserved. This session will not save until you reset the challenge.</p>';
      if(storage==='blocked')return '<p class="cc-habitat-notice">This browser could not save the habitat work. Keep the page open and download your investigation before leaving.</p>';
      return '';
    }
    function reset(){
      selected='';recent='';lastMessage='';state=blank();
      try{root.localStorage.removeItem(KEY);storage='ok';}catch(_){storage='blocked';}
      draw();
    }
    function setup(){
      const options=L.SCENARIOS.slice(1).map(s=>{
        const change=L.comparison(s.id).changes[0];
        return '<option value="'+s.id+'"'+(s.id===state.scenario?' selected':'')+'>'+EDIT[change.resource]+' · '+change.baseline+' to '+change.scenario+' units</option>';
      }).join('');
      return `<div class="cc-habitat-setup">
        <div><p class="cc-habitat-eyebrow">Plan a fair comparison</p><h3>Keep the herd. Change one resource.</h3>
        <p>Trial A uses a balanced habitat. In Trial B, the same eight wildebeest face one change. Each needs the resource shown on its card.</p></div>
        <div class="cc-habitat-form">
          <label for="cc-habitat-resource">What will you change in Trial B?
          <select id="cc-habitat-resource"><option value="">Choose a resource change</option>${options}</select></label>
          <label for="cc-habitat-prediction">Which resource, if any, will limit survival in Trial B?
          <select id="cc-habitat-prediction"><option value="">Make a prediction</option><option value="none"${state.prediction==='none'?' selected':''}>None · all will find what they need</option>${L.RESOURCES.map(r=>`<option value="${r}"${state.prediction===r?' selected':''}>${name(r)}</option>`).join('')}</select></label>
          <button type="button" class="cc-primary" id="cc-habitat-start"${selectStart()?'':' disabled'}>Start Trial A</button>
        </div></div>`;
    }
    function station(trial,r){
      const stock=trial.remaining[r],max=trial.stocks[r];
      const chips=Array.from({length:max},(_,i)=>`<i data-used="${i>=stock}"></i>`).join('');
      return `<button type="button" data-habitat-resource="${r}" data-empty="${stock===0}" aria-label="${name(r)}, ${stock} ${unit(stock)} left">
        <span class="cc-habitat-emblem">${glyph(r)}</span>
        <strong>${name(r)}</strong><span class="cc-habitat-stock" data-habitat-stock="${r}" data-habitat-remaining="${stock}">${stock} left <small>of ${max}</small></span>
        <span class="cc-habitat-chips" aria-hidden="true">${chips||'<i data-used="true"></i>'}</span>
      </button>`;
    }
    function tile(a,match){
      const attr=match?'data-habitat-match':'data-habitat-animal';
      const head=match?'<div ':'<button type="button" aria-pressed="false" ';
      return `${head}${attr}="${a.id}" data-habitat-need="${a.need}"${match&&a.id===recent?' data-just-match':''} class="cc-habitat-animal${match?' cc-habitat-matched':''}">
        <span class="cc-habitat-beast">${animalIcon}<span>Wildebeest ${numeral(a.id)}</span></span>
        <span class="cc-habitat-need">${glyph(a.need)} ${match?'Found':'Needs'} ${name(a.need).toLowerCase()}${match?' ✓':''}</span>
      ${match?'</div>':'</button>'}`;
    }
    function statusText(){
      return `<p id="cc-habitat-live" class="cc-habitat-status"${typeof announce==='function'?'':' role="status"'}>${text(lastMessage)}</p>`;
    }
    function board(trial){
      const info=L.status(trial),sc=scenario(trial.scenarioId);
      return `<div class="cc-habitat-board">
        <div class="cc-habitat-boardhead"><div><p class="cc-habitat-eyebrow" id="cc-habitat-phase">${trialName()} · ${sc.label}</p><h3 id="cc-habitat-board-title" tabindex="-1">Match animals to habitat resources</h3></div><strong id="cc-habitat-pending">${trial.matches.length} of ${trial.animals.length} matched</strong></div>
        <p id="cc-habitat-instructions">Drag a card to its station, or select an animal and then choose a station. With the keyboard, use Tab and Enter or Space.</p>
        <div class="cc-habitat-stations" role="group" aria-label="Resource stations">${L.RESOURCES.map(r=>station(trial,r)).join('')}</div>
        <div class="cc-habitat-messages"><p id="cc-habitat-selection">No animal selected.</p>${statusText()}</div>
        <div class="cc-habitat-animals" role="group" aria-label="Wildebeest cards">${trial.animals.map(a=>tile(a,trial.matches.find(m=>m.animalId===a.id))).join('')}</div>
        <div class="cc-habitat-controls"><p>${info.canFinish?(info.remaining?'No more matches fit. Finish to see what happens to the unmatched animals.':'Every animal found its resource. Finish to see the next herd.'):'Keep matching while stations have what an animal needs.'}</p>
        <button type="button" class="cc-primary" id="cc-habitat-finish"${info.canFinish?'':' disabled'}>Finish ${trialName()}</button></div>
      </div>`;
    }
    function scores(title,state){
      const x=L.summary(state),matchIds=new Set(state.matches.map(m=>m.animalId));
      const unmatched=state.animals.filter(a=>!matchIds.has(a.id));
      const data=[['Starting herd',x.starting],['Survived',x.survivors],['Unmatched',x.deaths],['Calves',x.births],['Next herd',x.ending]];
      return `<article class="cc-habitat-outcome"><h4>${title}</h4>
        <dl>${data.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <p>${describe(x)}</p>${unmatched.length?`<p class="cc-habitat-unmatched">Unmatched cards: ${unmatched.map(a=>numeral(a.id)+' ('+name(a.need).toLowerCase()+')').join(', ')}. In this model, they do not survive.</p>`:''}
        <p class="cc-habitat-note">${x.survivors} survivors + ${x.births} ${x.births===1?'calf':'calves'} = ${x.ending} in the next herd.</p>
      </article>`;
    }
    function results(){
      const complete=state.b?.phase==='complete',limit=complete?L.summary(state.b).limiting:[];
      const pred=state.prediction==='none'?'no limiting resource':name(state.prediction).toLowerCase();
      const matched=complete&&(limit.length===0?state.prediction==='none':limit.includes(state.prediction));
      const change=L.comparison(state.scenario).changes[0], x=L.summary(complete?state.b:state.a);
      return `<div id="cc-habitat-result" class="cc-habitat-result" tabindex="-1" data-starting="${x.starting}" data-survivors="${x.survivors}" data-deaths="${x.deaths}" data-births="${x.births}" data-ending="${x.ending}">
        <p class="cc-habitat-eyebrow" id="cc-habitat-phase">${complete?'Comparison complete':'Trial A complete'}</p>
        <h3>${complete?'What changed when one resource became scarce?':'What happened in the balanced habitat?'}</h3>
        ${complete?`<div id="cc-habitat-comparison" class="cc-habitat-comparison">${scores('Trial A · Balanced habitat',state.a)}${scores('Trial B · '+scenario(state.scenario).label,state.b)}</div>
          <p class="cc-habitat-lesson"><strong>A limiting factor restricts survival, reproduction, or population growth.</strong> ${compareText(state)}</p><p>You predicted ${pred}. ${matched?'This result supports your prediction.':'This result does not match your prediction. Compare how many animals needed '+name(change.resource).toLowerCase()+' with how many units were available.'}</p>`:
          `${scores('Trial A · Balanced habitat',state.a)}<p>Trial B will keep these same eight animals and the same needs. Only ${name(change.resource).toLowerCase()} will change, from ${change.baseline} to ${change.scenario} ${unit(change.scenario)}.</p>
          <button type="button" class="cc-primary" id="cc-habitat-compare">Start Trial B · Same herd</button>`}
      </div>`;
    }
    function draw(){
      const trial=active();
      const header='<p class="cc-habitat-note"><strong>A model, not field counts.</strong> A card names one immediate need this round. Real wildebeest need food, water and habitat that offers shelter, such as shade or cover.</p>';
      const recap=trial===state.b&&state.a?.phase==='complete'&&trial?'<p class="cc-habitat-note">Trial A next herd: <strong>'+L.summary(state.a).ending+'</strong>. Trial B starts with the original herd, not its offspring.</p>':'';
      const screen=trial?board(trial):state.a?results():setup();
      host.innerHTML=header+storageNote()+screen+recap+`
        ${trial?'':statusText()}
        ${state.a?`<div class="cc-habitat-reset"><button type="button" id="cc-habitat-clear">Reset habitat challenge</button></div>`:''}
        <dialog id="cc-habitat-reset-dialog" aria-labelledby="cc-habitat-reset-title"><h3 id="cc-habitat-reset-title">Reset the habitat challenge?</h3><p>This clears both habitat trials and your prediction, but keeps your other investigation work.</p>
        <div class="cc-habitat-controls"><form method="dialog"><button autofocus>Keep my work</button></form><button type="button" id="cc-habitat-reset-confirm">Clear habitat trials</button></div></dialog>`;
    }
    function selectAnimal(id,keyboard=false){
      const animal=currentCard(id);
      if(!animal||active().matches.some(m=>m.animalId===id))return;
      selected=id;
      $$('[data-habitat-animal]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.habitatAnimal===id)));
      $('#cc-habitat-selection').textContent='Wildebeest '+numeral(id)+' selected. It needs '+NEED[animal.need]+'.';
      tell('Wildebeest '+numeral(id)+' selected. Choose a resource station.');
      if(keyboard)focus('[data-habitat-resource]');
    }
    function clearSelection(){
      selected='';
      $$('[data-habitat-animal]').forEach(node=>node.setAttribute('aria-pressed','false'));
      const p=$('#cc-habitat-selection');if(p)p.textContent='No animal selected.';
    }
    function tryMatch(id,resource){
      const trial=active(),animal=currentCard(id);
      if(!trial||!L.RESOURCES.includes(resource))return;
      if(!animal){tell('Choose a wildebeest first, then a station.');return;}
      const changed=L.match(trial,animal.id,resource);
      if(changed===trial){
        if(animal.need!==resource)tell('Wildebeest '+numeral(id)+' needs '+NEED[animal.need]+'. '+name(resource)+' cannot meet that need.');
        else if(trial.remaining[resource]===0)tell('No '+name(resource).toLowerCase()+' remains. Wildebeest '+numeral(id)+' is still unmatched.');
        else tell('This wildebeest has already been matched.');
        return;
      }
      const selector='[data-habitat-resource="'+resource+'"]';
      const keyboard=document.activeElement===$(selector);
      if(trial===state.a)state.a=changed;else state.b=changed;
      selected='';recent=id;persist();draw();
      tell('Wildebeest '+numeral(id)+' matched with '+name(resource).toLowerCase()+'. '+changed.remaining[resource]+' '+unit(changed.remaining[resource])+' left.'+(L.status(changed).canFinish?' You can finish the trial.':''));
      if(keyboard)focus(selector);
    }
    host.addEventListener('change',e=>{
      if(e.target.id==='cc-habitat-resource')state.scenario=chosen(e.target.value)?e.target.value:'';
      else if(e.target.id==='cc-habitat-prediction')state.prediction=PREDICTIONS.includes(e.target.value)?e.target.value:'';
      else return;
      persist();$('#cc-habitat-start').disabled=!selectStart();
    });
    host.addEventListener('click',e=>{
      const control=e.target.closest('button');if(!control||!host.contains(control))return;
      if(control.dataset.habitatAnimal||control.dataset.habitatResource){
        if(e.detail!==0&&suppress?.id===control.dataset.habitatAnimal&&Date.now()<suppress.until){suppress=null;e.preventDefault();return;}
        if(control.dataset.habitatAnimal)selectAnimal(control.dataset.habitatAnimal,e.detail===0);
        else tryMatch(selected,control.dataset.habitatResource);
        return;
      }
      if(control.id==='cc-habitat-start'&&!state.a&&selectStart()){
        state.a=L.create('balanced');lastMessage='';persist();draw();focus('#cc-habitat-board-title');
      }
      if(control.id==='cc-habitat-compare'&&state.a?.phase==='complete'&&!state.b){
        state.b=L.create(state.scenario);lastMessage='';recent='';persist();draw();focus('#cc-habitat-board-title');
      }
      if(control.id==='cc-habitat-finish'){
        const trial=active(),done=trial&&L.finish(trial);
        if(!done||done===trial)return;
        if(trial===state.a)state.a=done;else state.b=done;
        selected='';lastMessage='';persist();draw();
        const x=L.summary(done);tell(trialName()+' complete. '+x.survivors+' survived. Next herd: '+x.ending+'.');
        focus('#cc-habitat-result');
      }
      if(control.id==='cc-habitat-clear')$('#cc-habitat-reset-dialog').showModal();
      if(control.id==='cc-habitat-reset-confirm'){reset();tell('Habitat challenge reset.');focus('#cc-habitat-resource');}
    });
    host.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&selected&&!$('#cc-habitat-reset-dialog')?.open){
        const id=selected;clearSelection();tell('Selection cleared.');focus('[data-habitat-animal="'+id+'"]');
      }
    });
    function targetAt(x,y){const n=document.elementFromPoint(x,y)?.closest('[data-habitat-resource]');return n&&host.contains(n)?n:null;}
    function over(target){$$('[data-habitat-resource]').forEach(n=>n.toggleAttribute('data-over',n===target));}
    function endDrag(){gesture=null;over(null);ghost?.remove();ghost=null;}
    // One captured pointer path works across mouse, pen and touch. The
    // click/tap and keyboard route remains independent of dragging.
    host.addEventListener('pointerdown',e=>{
      if(!e.isPrimary||e.button!==0)return;
      const card=e.target.closest('[data-habitat-animal]');
      if(!card||gesture)return;
      suppress=null;
      gesture={pointer:e.pointerId,id:card.dataset.habitatAnimal,x:e.clientX,y:e.clientY,drag:false};
      card.setPointerCapture?.(e.pointerId);
    });
    host.addEventListener('pointermove',e=>{
      if(!gesture||gesture.pointer!==e.pointerId)return;
      if(!gesture.drag&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<10)return;
      if(!gesture.drag){
        gesture.drag=true;selectAnimal(gesture.id);
        ghost=document.createElement('div');ghost.className='cc-habitat-ghost';ghost.setAttribute('aria-hidden','true');
        ghost.textContent='Wildebeest '+numeral(gesture.id);host.append(ghost);
      }
      ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';
      over(targetAt(e.clientX,e.clientY));
    });
    host.addEventListener('pointerup',e=>{
      if(!gesture||gesture.pointer!==e.pointerId)return;
      const was=gesture, target=was.drag&&targetAt(e.clientX,e.clientY);
      endDrag();
      if(was.drag){suppress={id:was.id,until:Date.now()+400};if(target)tryMatch(was.id,target.dataset.habitatResource);}
    });
    host.addEventListener('pointercancel',endDrag);
    host.addEventListener('lostpointercapture',e=>{if(gesture?.pointer===e.pointerId)endDrag();});
    draw();
    return {report:()=>reportText(state),reset};
  }

  root.CarryingHabitatUI=Object.freeze({mount,key:KEY});
})(window);
