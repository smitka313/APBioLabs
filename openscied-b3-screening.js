(() => {
  'use strict';
  const M=window.ScreeningLogic, api=window.OpenSciEdSaveSession, KEY='aplab:openscied:b3-screening:v1';
  const $=id=>document.getElementById('sd-'+id), say=t=>{$('status').textContent=t;};
  const el=(tag,t)=>Object.assign(document.createElement(tag),{textContent:t??''});
  const cost=n=>n+' cr', label=z=>M.names[z]||'Supply rack';
  const newSeed=()=>M.equitySeed(()=>crypto.getRandomValues(new Uint32Array(1))[0]);
  const fresh=()=>({v:1,seed:null,caseMode:'equity',plan:{...M.baseline},started:false,trial:null,claim:'',limit:'',finished:false,step:'map',caseId:null,caseAnswers:{},caseChecks:[],practice:{},lastVisitedAt:0});
  const cleanPlan=p=>Object.fromEntries(M.pieces.map(k=>[k,M.zones.includes(p?.[k])?p[k]:null]));
  const str=x=>typeof x==='string'?x.slice(0,1800):'';
  const ready=()=>!!s.trial&&cases.every(p=>s.caseChecks.includes(p.id));
  const hasRecommendation=()=>Boolean(s.claim.trim()&&s.limit.trim());
  const complete=()=>ready()&&hasRecommendation()&&s.finished;
  let s=fresh(), session, recovery=false, selected='', view='base', patient=1, animation=0;
  const same=(a,b)=>M.pieces.every(k=>a[k]===b[k]);
  try{
    session=api.open(localStorage,'b3-screening',[KEY],undefined,{routeMetadata:['step','lastVisitedAt','caseId']});const raw=session.read(KEY);
    if(raw!==null){
      const x=JSON.parse(raw);
      if(x?.v!==1||!Number.isInteger(x.seed)||x.seed<0||x.seed>4294967295)throw Error('Invalid save');
      const trial=cleanPlan(x.trial);
      s={...s,seed:x.seed,caseMode:x.caseMode==='equity'?'equity':'legacy',plan:x.started?cleanPlan(x.plan):{...M.baseline},started:x.started===true,trial:x.started&&!M.validate(trial)&&!same(trial,M.baseline)?trial:null,caseId:x.caseId,caseAnswers:x.caseAnswers,caseChecks:Array.isArray(x.caseChecks)?x.caseChecks:[],practice:x.practice&&typeof x.practice==='object'&&!Array.isArray(x.practice)?x.practice:{},claim:str(x.claim),limit:str(x.limit),finished:x.finished===true,lastVisitedAt:Number(x.lastVisitedAt)||0,step:x.step==='explain'?'explain':'map'};
    }else{s.seed=newSeed();if(!session.write(KEY,JSON.stringify({v:1,seed:s.seed,caseMode:s.caseMode})).ok)recovery=true;}
    if(s.trial)view='trial';

  }catch(_){recovery=true;}
  if(s.seed===null)s.seed=newSeed();
  const datasetId='SD-'+s.seed.toString(16).toUpperCase().padStart(8,'0');
  $('dataset').textContent='Dataset '+datasetId+' · Patient numbers usually differ from student to student. Your district stays with your saved work in this browser. Start over draws a new district.';
  const curated=s.caseMode==='equity'?M.equityCases(s.seed):[];
  const equity=curated.length===3;
  const cases=equity?curated:M.scenarios(s.seed);
  if(!equity)$('mission-rules').textContent='Stay within the 720-credit clinic budget and get more people all the care they need than the hospital plan did.';
  const caseIds=cases.map(p=>p.id);
  s.caseId=caseIds.includes(s.caseId)?s.caseId:caseIds[0];
  patient=s.caseId;
  if(s.trial){
    const a=M.run(s.seed,M.baseline).patients,b=M.run(s.seed,s.trial).patients;
    s.caseChecks=caseIds.filter(id=>s.caseChecks.includes(id)&&M.comparison(a[id-1],b[id-1])===s.caseAnswers?.[id]);
  }else s.caseChecks=[];
  if(!ready()){s.step='map';s.finished=false;}
  const student=api?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
  function savable(){return !recovery&&!!session?.check(KEY).ok;}
  function notice(){$('save').textContent=savable()?'Progress stays on this device unless you choose to download a report.':'This tab can’t save over work on this device. Use Preview report to keep a recovery copy.';}
  function save(){s.lastVisitedAt=Date.now();const r=!recovery&&session?.write(KEY,JSON.stringify(s));notice();if(r?.ok)student();else say('Could not save. Preview your report to keep a recovery copy.');return !!r?.ok;}
  function saySafe(t){if(savable())say(t);}
  function dl(items){const d=el('dl');for(const [k,v] of items)d.append(el('dt',k),el('dd',v));return d;}
  const art={
    screen:'<path d="M11 8h34v35H11z" fill="#cde9dc" stroke="#387d77" stroke-width="2"/><path d="M20 5h16v7H20zM24 16h8v6h6v7h-6v6h-8v-6h-6v-7h6z" fill="#387d77"/>',
    machine:'<path d="M15 4h28l-2 21H13z" fill="#213e55" stroke="#75acb4" stroke-width="2"/><path d="M20 18q9-19 16 0Z" fill="#92d1bd"/><path d="M24 25v14m-11 3h29m-23-9h18" fill="none" stroke="#6494a0" stroke-width="4"/><circle cx="16" cy="44" r="3" fill="#253e59"/><circle cx="40" cy="44" r="3" fill="#253e59"/>',
    operator:'<circle cx="28" cy="13" r="8" fill="#ddae86"/><path d="M16 44V30q0-10 12-10t12 10v14Z" fill="#96d1bf" stroke="#2d7878" stroke-width="2"/><path d="M25 28v12m-5-6h10" stroke="#245667" stroke-width="2" />',
    rides:'<path d="M6 13h44v7q-9 5 0 10v8H6v-8q9-5 0-10z" fill="#ffd18b" stroke="#886346" stroke-width="2"/><path d="M30 15v20m-17-5 4-10h8l3 10z" fill="none" stroke="#5e4a55" stroke-width="2" />'
  };
  const probe=$('probe'), massAt=61, massRadius=16;
  const svgNS='http://www.w3.org/2000/svg';
  let marked=false,markedAt=null;
  for(let i=0;i<255;i++){
    const dot=document.createElementNS(svgNS,'circle');
    dot.setAttribute('cx',String((i*127+19)%320));dot.setAttribute('cy',String((i*43+Math.floor(i/8)*17)%151));
    dot.setAttribute('r',String(.35+(i%5)*.23));dot.setAttribute('fill',i%4===0?'#c9d0d4':'#858f98');
    dot.setAttribute('opacity',String(.2+(i%7)*.08));$('speckle').append(dot);
  }
  function drawProbe(){
    const at=Number(probe.value), x=30+2.6*at, distance=Math.abs(at-massAt);
    const onMass=distance<massRadius;
    $('probe-graphic').setAttribute('transform','translate('+x+' 0)');
    $('plane').setAttribute('x1',x);$('plane').setAttribute('x2',x);
    $('sonogram-mass').setAttribute('visibility',onMass?'visible':'hidden');
    const slice=onMass?Math.sqrt(1-(distance/massRadius)**2):0;
    $('dark-shape').setAttribute('rx',Math.max(3,27*slice));$('dark-shape').setAttribute('ry',Math.max(3,17*slice));
    for(const id of ['point','point-text'])$(id).setAttribute('visibility',onMass&&marked?'visible':'hidden');
    const status=onMass?'A darker oval is visible in this slice.':'Only the usual layers are visible in this slice.';
    $('probe-note').textContent=status;
    $('probe-position').textContent='Position '+at+' / 100';
    $('sonogram').setAttribute('aria-label','Simulated ultrasound image. '+status);
    probe.setAttribute('aria-valuetext',at+' of 100. '+status);
    return onMass;
  }
  function moveProbe(){
    marked=false;$('scan-feedback').hidden=true;drawProbe();
  }
  probe.oninput=moveProbe;
  $('mark').onclick=()=>{
    marked=drawProbe();
    if(marked){markedAt=Number(probe.value);$('probe-return').hidden=false;}
    drawProbe();
    const msg=$('scan-feedback');msg.hidden=false;
    msg.textContent=marked?'You found the simulated mass. Different echoes made its outline stand out from nearby tissue. This image shows a shape, not a cancer diagnosis.':'This slice only shows tissue layers. Sweep farther and watch for a new shape. One slice can miss a mass.';
    msg.focus({preventScroll:true});
  };
  $('probe-return').onclick=()=>{
    if(markedAt===null)return;
    probe.value=markedAt;marked=true;drawProbe();$('scan-feedback').hidden=false;
    $('scan-feedback').textContent='Returned to marked slice '+markedAt+'. This image shows a shape, not a diagnosis.';
  };
  const tissue=$('tissue');
  function positionProbe(e){
    const box=tissue.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*320;
    probe.value=Math.max(0,Math.min(100,Math.round((x-30)/2.6)));moveProbe();
  }
  tissue.onpointerdown=e=>{
    if(!e.isPrimary||e.button!==0)return;
    tissue.setPointerCapture(e.pointerId);positionProbe(e);
  };
  tissue.onpointermove=e=>{if(tissue.hasPointerCapture(e.pointerId))positionProbe(e);};
  drawProbe();
  const toolButtons={};
  function place(zone,key=selected){
    if(!s.started||!key)return;
    const dest=zone==='rack'?null:zone;
    const keys=key==='team'?['machine','operator']:[key], name=key==='team'?'Ultrasound team':M.names[key];
    if(key==='team'&&!dest){saySafe('Put the ultrasound team at the hospital or the mobile clinic.');return;}
    if(keys.every(k=>s.plan[k]===dest)){saySafe(name+' is already at '+label(dest)+'.');return;}
    const wasOver=M.total(s.plan)>M.budget;
    clearTrip();selected='';for(const k of keys)s.plan[k]=dest;
    save();drawSetup();
    saySafe(name+' moved to '+label(dest)+'. '+$('setup-note').textContent);
    if(key==='team'&&dest==='mobile')$('run').focus({preventScroll:false});
    else toolButtons[key].focus({preventScroll:true});
    if(!wasOver&&M.total(s.plan)>M.budget)budgetPopup();
  }
  function drag(b,key){
    let start,ghost,hot,block=false;
    b.addEventListener('click',e=>{if(block&&e.detail){e.preventDefault();e.stopImmediatePropagation();}},true);
    b.onpointerdown=e=>{if(!e.isPrimary||e.button!==0||b.disabled)return;start=[e.clientX,e.clientY,e.pointerId];block=false;b.setPointerCapture(e.pointerId);};
    b.onpointermove=e=>{
      if(!start||e.pointerId!==start[2])return;
      if(!ghost&&Math.hypot(e.clientX-start[0],e.clientY-start[1])>7){
        ghost=b.cloneNode(true);ghost.removeAttribute('id');ghost.classList.add('sd-ghost');ghost.tabIndex=-1;ghost.setAttribute('aria-hidden','true');document.body.append(ghost);
      }
      if(!ghost)return;
      ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';hot?.classList.remove('sd-hover');
      hot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-zone]');hot?.classList.add('sd-hover');
    };
    const end=e=>{
      if(!start||start[2]!==e.pointerId)return;
      start=null;if(!ghost)return;
      ghost.remove();ghost=null;hot?.classList.remove('sd-hover');hot=null;block=true;
      if(e.type!=='pointerup')return;
      const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-zone]');
      if(target)place(target.dataset.zone,key);else saySafe('Drop the piece on a site or the return-to-rack target.');
    };
    b.onpointerup=end;b.onpointercancel=end;b.onlostpointercapture=end;
  }
  for(const k of M.pieces){
    const b=el('button');b.type='button';b.className='sd-piece';b.id='sd-tool-'+k;
    b.innerHTML='<svg aria-hidden="true" viewBox="0 0 56 48">'+art[k]+'</svg>';
    b.append(el('strong',M.names[k]),el('small'));$('tools').append(b);toolButtons[k]=b;drag(b,k);
    b.onclick=()=>{clearTrip();selected=selected===k?'':k;drawSetup();if(selected)saySafe('Choose a site for '+M.names[k].toLowerCase()+'.');};
  }
  const team=$('tool-team');toolButtons.team=team;drag(team,'team');
  team.onclick=()=>{clearTrip();selected=selected==='team'?'':'team';drawSetup();if(selected)saySafe('Choose the mobile clinic on the map.');};
  $('move-team').onclick=()=>place('mobile','team');
  $('summary-link').onclick=()=>$('journey-title').focus();
  for(const b of document.querySelectorAll('[data-zone]'))b.onclick=()=>{
    if(selected)place(b.dataset.zone);
    else if(s.started)saySafe('Pick a piece below the map first.');
  };
  const clinicLabels={screening:'Screening team',acquisition:'Ultrasound acquisition',maintenance:'Ultrasound maintenance',staffing:'Trained ultrasound staff',transport:'Ride program'};
  function clinicRows(r){return Object.entries(r.costs).map(([k,n])=>[clinicLabels[k],cost(n)]);}
  function popup(tone,kicker,title,message,lines,button='Continue',focusBack=document.activeElement){
    const dialog=$('mission-dialog'), items=el('ul');
    dialog.dataset.tone=tone;
    const symbol=tone==='warning'?'<path d="M32 20v15m0 5v1" stroke="#704126" stroke-width="4" stroke-linecap="round" fill="none"/>':'<path d="m22 32 7 7 14-15" stroke="#255744" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    $('popup-seal').innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m20 43-3 18 13-5 9 5 5-18" fill="currentColor" opacity=".45"/><path d="m32 3 7 4 8 1 4 7 7 5 0 8 3 7-5 6-2 8-8 3-6 5-8-2-8 2-6-5-8-3-2-8-5-6 3-7v-8l7-5 4-7 8-1Z" fill="currentColor" opacity=".22"/><circle cx="32" cy="31" r="22" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".62"/>'+symbol+'</svg>';
    $('popup-kicker').textContent=kicker;$('popup-title').textContent=title;
    $('popup-message').textContent=message;
    items.append(...lines.map(line=>el('li',line)));
    $('popup-evidence').replaceChildren(items);
    $('popup-close').textContent=button;
    $('edit-plan').hidden=true;
    dialog.onclose=()=>{if(focusBack?.getClientRects().length&&!focusBack.disabled)focusBack.focus({preventScroll:true});};
    dialog.showModal();
  }
  $('edit-plan').onclick=()=>{
    const dialog=$('mission-dialog');
    dialog.onclose=null;dialog.close();
    $('advanced').open=true;$('advanced').querySelector('summary').focus();
  };
  function budgetPopup(){
    const used=M.total(s.plan);
    const lines=clinicRows({costs:M.costs(s.plan)}).filter(([,value])=>value!==cost(0)).map(([name,value])=>name+': '+value);
    popup('warning','Clinic budget check','Over the clinic budget',
      'This plan costs '+cost(used)+' against a '+cost(M.budget)+' limit. Cut at least '+cost(used-M.budget)+' before you can run it.',
      lines,'Revise my plan');
  }
  function drawSites(plan){
    for(const z of M.zones){
      const list=M.pieces.filter(k=>plan[k]===z).map(k=>({screen:'Screening',machine:'Ultrasound',operator:'Sonographer',rides:'Rides'})[k]);
      $(z+'-items').textContent=list.join(' · ')||'No tools placed';
    }
  }
  function drawSetup(){
    for(const k of M.pieces){
      const b=toolButtons[k];b.disabled=!s.started;b.setAttribute('aria-pressed',String(selected===k));
      b.querySelector('small').textContent=label(s.plan[k]);
    }
    drawSites(s.plan);
    const invalid=M.validate(s.plan),notChanged=s.started&&same(s.plan,M.baseline),unchanged=s.trial&&same(s.trial,s.plan);
    const moved=s.plan.machine==='mobile'&&s.plan.operator==='mobile';
    const stage=!s.started?1:s.trial?3:2;
    $('stage').textContent='Step '+stage+' of 3';
    $('action-title').textContent=stage===1?'Watch the hospital plan':stage===2?'Try the mobile clinic':'Compare the two plans';
    $('action-help').textContent=stage===1?'Start with your three patient cards.':stage===2?(moved?'The team is in place. Test it with the same patients.':'Move the ultrasound team to the mobile clinic.'):'Check what happened to each of your three patients.';
    $('map-grid').hidden=!s.started;
    const runDock=$(s.started?'run-dock':'intake-action');
    if($('run').parentElement!==runDock)runDock.append($('run'));
    $('task').textContent=stage===1?'Meet your three patients before you run a plan.':stage===2?'Move one team. Keep screening at the hospital.':'Compare access and cost before choosing a plan.';
    $('quick').hidden=stage!==2;$('advanced').hidden=stage!==3;
    $('cost-details').hidden=stage===1;
    $('summary-link').hidden=stage!==3;
    team.setAttribute('aria-pressed',String(selected==='team'));
    team.querySelector('small').textContent=moved?'Mobile clinic':'Hospital';
    $('move-team').disabled=moved;
    const used=M.total(s.plan);$('budget').textContent=' · '+used+' / '+M.budget+' cr';
    const gauge=$('clinic-gauge');gauge.style.setProperty('--used',Math.min(100,100*used/M.budget)+'%');
    gauge.dataset.over=String(used>M.budget);
    $('clinic').replaceChildren(...dl(clinicRows({costs:M.costs(s.plan)})).children);
    $('setup-note').textContent=invalid||(notChanged?'Move the team to test a different plan.':unchanged?'This plan is already recorded.':'Plan fits the budget.');
    $('setup-note').hidden=!invalid;
    $('run').hidden=stage===3&&!!unchanged;
    $('run').disabled=!!(invalid||notChanged||unchanged);
    $('run').textContent=stage===1?'Run hospital plan':stage===2?'Test mobile clinic':'Run updated plan';
  }
  const get=(plan)=>M.run(s.seed,plan);
  const result=()=>get(view==='trial'&&s.trial?s.trial:M.baseline);
  const outcomes={'screen-missed':'Missed screening',screened:'Screening only','follow-up-missed':'Missed follow-up',imaged:'Ultrasound completed'};
  const markers={'screen-missed':'×',screened:'✓','follow-up-missed':'!',imaged:'◆'};
  const need=p=>p.needed?'Screening + ultrasound follow-up':'Screening only';
  const income=p=>p.monthlyIncome.toLocaleString('en-US')+' cr/month';
  const visits={screen:'Screening',scan:'Ultrasound follow-up'};
  const mobilePractice={...M.baseline,machine:'mobile',operator:'mobile'};
  const plansForPractice=()=>({base:M.baseline,trial:s.trial||mobilePractice,local:{...mobilePractice,screen:'mobile'}});
  const needKinds=p=>p.needed?['screen','scan']:['screen'];
  const practicePlan=()=>plansForPractice()[$('pay-plan').value];
  const walletKey=()=>[quoteCase.id,...M.pieces.map(k=>practicePlan()[k]??'none')].join(':');
  let quoteCase=null,wallet={credits:0,next:0};
  const quoteRows=q=>[['Test fee',cost(q.fee)],['Drive'+(q.ride?' after voucher':''),cost(q.travel)],['Time away (valued in credits)',cost(q.timeCost)],['Budget used',cost(q.total)]];
  function quoteTile(kind,zone,q){
    const tile=el('article');tile.className='sd-visit';
    tile.append(el('strong',visits[kind]+' · '+label(zone)),el('p',q.miles+' mi one way · '+q.time+' h for the trip and visit'),dl(quoteRows(q)));
    return tile;
  }
  function visitQuote(p,kind,plan){
    const zone=kind==='screen'?plan.screen:plan.machine;
    return M.quote(p,zone,kind,plan);
  }
  function itemizedQuote(p,plan,title){
    const d=el('details'),grid=el('div');d.className='sd-deeper';grid.className='sd-visit-grid';
    for(const kind of needKinds(p)){
      const q=visitQuote(p,kind,plan);grid.append(quoteTile(kind,q.place,q));
    }
    d.append(el('summary',title),grid);return d;
  }
  function drawWallet(animate=false){
    const p=quoteCase, next=needKinds(p)[wallet.next], plan=plansForPractice()[$('pay-plan').value];
    const trialOption=$('pay-plan').querySelector('option[value=trial]');
    trialOption.textContent=s.trial?'Recorded redesign · '+label(s.trial.screen)+' screening · '+label(s.trial.machine)+' ultrasound':
      'Mobile ultrasound · hospital screening';
    const bar=el('div'), fill=el('span');
    bar.className='sd-wallet-bar';bar.setAttribute('aria-hidden','true');bar.append(fill);
    const percent=(v)=>100*v/p.means+'%';
    fill.style.setProperty('--balance',percent(animate?wallet.previous:wallet.credits));
    const target=percent(wallet.credits);
    if(animate)requestAnimationFrame(()=>requestAnimationFrame(()=>fill.style.setProperty('--balance',target)));
    const balance=el('p',cost(wallet.credits)+' of '+cost(p.means)+' left');balance.className='sd-balance';
    $('wallet').replaceChildren(balance,bar,el('p',(next?'Next: '+label(visitQuote(p,next,plan).place)+' · ':'')+p.hours+' h available per visit'));
    $('book').hidden=!next;
    $('book').disabled=!next;
    $('book').textContent=next?'Try booking '+visits[next].toLowerCase():'';
    $('path-complete').hidden=!!next;
  }
  function loadWallet(note=''){
    const p=quoteCase, plan=practicePlan(), k=walletKey(), steps=s.practice[k];
    wallet={credits:p.means,next:0};
    for(const kind of needKinds(p).slice(0,Number.isInteger(steps)&&steps>0?steps:0)){
      const tx=M.checkout(visitQuote(p,kind,plan),wallet.credits,p.hours);
      if(!tx.ok)break;
      wallet.next++;wallet.credits=tx.remaining;
    }
    $('pay-result').textContent=note+(wallet.next?' '+wallet.next+(savable()?' booking(s) saved for this plan.':' booking(s) in this tab. Check the save notice before reloading.'):'');
    drawWallet();
  }
  const costToggles=[];
  // The selected sheet is tab-local UI state; bookings themselves remain in the
  // guarded activity record. A different district can never inherit this view.
  const practiceViewKey=KEY+':practice-view';
  function keepPracticeView(){
    try{
      if(quoteCase)sessionStorage.setItem(practiceViewKey,JSON.stringify({datasetId,id:quoteCase.id,plan:$('pay-plan').value}));
      else sessionStorage.removeItem(practiceViewKey);
    }catch(_){ /* Booking saves do not depend on session storage. */ }
  }
  function openQuote(p,{restoring=false,plan='base'}={}){
    const close=!restoring&&quoteCase===p&&!$('quote-board').hidden;
    for(const [i,b] of costToggles.entries())b.setAttribute('aria-expanded',String(!close&&p===cases[i]));
    $('quote-board').hidden=close;
    if(close){quoteCase=null;keepPracticeView();return;}
    quoteCase=p;$('quote-title').textContent='Patient '+p.id+' · '+p.place+' cost sheet';
    const grid=el('div');grid.className='sd-visit-grid';
    for(const kind of ['screen','scan'])for(const zone of M.zones){
      grid.append(quoteTile(kind,zone,M.quote(p,zone,kind,M.baseline)));
    }
    $('price-sheet').replaceChildren(el('p','Price estimates for both sites, before vouchers. A service can be booked only at the site shown under “Next” for the selected plan.'),
      el('p','This patient: '+p.value+' cr per hour away; '+(p.routeExtra?'detour adds 1 hour and 3 credits to each visit.':'no detour charge.')),grid);
    $('pay-plan').value=Object.hasOwn(plansForPractice(),plan)?plan:'base';
    loadWallet();
    if(!restoring){keepPracticeView();$('quote-title').focus();}
  }
  function restorePracticeView(){
    if(s.step!=='map')return;
    try{
      const saved=JSON.parse(sessionStorage.getItem(practiceViewKey));
      const p=saved?.datasetId===datasetId&&cases.find(c=>c.id===saved.id);
      if(p)openQuote(p,{restoring:true,plan:saved.plan});
    }catch(_){ /* No usable tab-local view. The activity record is still intact. */ }
  }
  $('pay-plan').onchange=()=>{keepPracticeView();loadWallet('Switched practice plans. Each plan keeps its own bookings.');};
  $('pay-reset').onclick=()=>{
    const key=walletKey(),before=s.practice[key];
    delete s.practice[key];
    if(save())loadWallet('Practice bookings cleared for this patient and plan only.');
    else if(before!==undefined)s.practice[key]=before;
  };
  $('book').onclick=()=>{
    if(!quoteCase)return;
    const p=quoteCase, kinds=needKinds(p), kind=kinds[wallet.next];
    if(!kind)return;
    const q=visitQuote(p,kind,plansForPractice()[$('pay-plan').value]);
    const tx=M.checkout(q,wallet.credits,p.hours);
    if(!tx.ok){
      const hurdles=[tx.moneyShort&&cost(tx.moneyShort)+' short',tx.timeShort&&tx.timeShort+' h more than the patient has'].filter(Boolean);
      const differing=Array.from($('pay-plan').options).filter(o=>o.value!==$('pay-plan').value).find(o=>{
        const alt=visitQuote(p,kind,plansForPractice()[o.value]);
        return alt.total<q.total||alt.time<q.time;
      });
      const hint=differing?' Compare “'+differing.textContent+'” for a cheaper or shorter visit. Each plan keeps its own bookings.':' None of these practice options lowers this visit’s cost or time. When editing your clinic plan, try changing the service location or adding a ride voucher (cost only).';
      $('pay-result').textContent='Could not book '+visits[kind].toLowerCase()+': '+hurdles.join(' and ')+'. No credits used.'+hint;
      popup('warning','Patient '+p.id+' · '+p.place,tx.moneyShort?'Over this patient’s care budget':'Not enough time for this visit',
        visits[kind]+' needs '+cost(q.total)+' and '+q.time+' h. This patient has '+cost(wallet.credits)+' left and '+p.hours+' h available. '+hurdles.join(' and ')+'. No credits were used.'+hint,
        quoteRows(q).slice(0,3).map(([k,v])=>k+': '+v),'Back to the cost sheet');
      return;
    }
    wallet={next:wallet.next+1,credits:tx.remaining,previous:wallet.credits};
    s.practice[walletKey()]=wallet.next;
    const persisted=save();
    drawWallet(true);
    $('pay-result').textContent=visits[kind]+' booked: '+cost(q.total)+' used. '+(wallet.next===kinds.length?'Care pathway complete.':'Try booking the follow-up next.')+
      (persisted?'':' This booking is only in this tab. Use Preview report to keep a recovery copy before reloading.');
    if(wallet.next===kinds.length){
      const a=get(M.baseline).patients[p.id-1],isAlt=$('pay-plan').value!=='base';
      const improved=isAlt&&!milestone(a);
      popup('success','Patient '+p.id+' · '+p.place,improved?'You opened a path to care!':'Care booked within budget!',
        'This patient could book every needed visit, with '+cost(wallet.credits)+' left.'+(improved?' The hospital plan left this same patient short of the care they needed.':''),
        [cost(p.means-wallet.credits)+' used out of '+cost(p.means),'Time fit within the patient’s '+p.hours+' h available per visit.'],
        'Keep planning',$('pay-reset'));
    }
  };
  const portraits=[
    ['#274756','#d9a47e','#403232','#83bdbe','M23 34c-1-18 8-25 20-25s22 8 20 25l-7-2-2-11-12 8-13-1-1 8z'],
    ['#4e4e62','#a96648','#352a37','#b5b6dc','M24 39c-8-13-3-21 4-23 2-10 9-11 15-8 9-5 19 2 19 9 8 4 7 14 1 20l-5-1-2-13-13 7-13-3-2 10z'],
    ['#3a594f','#efc39a','#735348','#b8c882','M24 38c-5-17 2-26 12-30 13-5 26 3 28 18v12l-7-2-1-12-9 2-9-4-11 7z']
  ];
  function avatar(i){
    const [bg,skin,hair,shirt,path]=portraits[i],wrap=el('div');wrap.className='sd-avatar';
    wrap.innerHTML='<svg viewBox="0 0 86 82" aria-hidden="true"><rect width="86" height="82" rx="10" fill="'+bg+'"/><circle cx="43" cy="36" r="31" fill="#fff7d3" opacity=".13"/><path d="M7 64h72m-72-8h72" stroke="#f8f0d7" opacity=".18"/><path d="M11 82v-9c3-12 18-20 32-20s30 8 32 20v9z" fill="'+shirt+'"/><path d="M43 60 26 57l6 15 11-9 12 9 5-15z" fill="#f3f0d3" opacity=".67"/><path d="M35 49h16v11l-8 5-8-5z" fill="'+skin+'"/><path d="M31 27q12-13 25 0l2 16q-4 13-15 13T28 43z" fill="'+skin+'"/><path d="M43 35h1l2 10-4 1m-3 4q4 2 8 0" fill="none" stroke="'+hair+'" stroke-width="1.25" stroke-linecap="round" opacity=".72"/><path d="M33 38h2m16 0h2" stroke="'+hair+'" stroke-width="2" stroke-linecap="round"/><path d="'+path+'" fill="'+hair+'"/><path d="M16 74h5m44 0h5" stroke="'+bg+'" opacity=".45" stroke-width="1.3"/></svg>';
    return wrap;
  }
  for(const [i,p] of cases.entries()){
    const card=el('article');card.className='sd-profile';
    const k=el('p','Case '+(i+1));k.className='sd-stage';
    const distances=el('ul');distances.append(el('li','Hospital: '+p.distances.hub+' mi'),el('li','Mobile clinic: '+p.distances.mobile+' mi'));
    const head=el('div'),stamp=el('div');head.className='sd-case-head';
    if(equity)k.textContent+=' · '+(p.means>=100?'Higher income':'Lower income');
    stamp.append(k,el('h4','Patient '+p.id+' · '+p.place));head.append(avatar(i),stamp);
    const pathway=el('p',need(p));pathway.className='sd-pathway';
    card.append(head,pathway,el('p','Income: '+income(p)+' · Care budget: '+cost(p.means)),el('p','Time available per visit: '+p.hours+' h'),distances);
    const quoteButton=el('button','Open cost sheet');quoteButton.type='button';quoteButton.className='btn';
    quoteButton.setAttribute('aria-label','Open cost sheet for Case '+(i+1)+' · '+p.place);
    quoteButton.setAttribute('aria-controls','sd-quote-board');quoteButton.setAttribute('aria-expanded','false');quoteButton.onclick=()=>openQuote(p);
    costToggles.push(quoteButton);card.append(quoteButton);
    $('profiles').append(card);
    const b=el('button');b.type='button';b.className='btn';b.onclick=()=>{
      s.caseId=patient=p.id;save();$('case-feedback').textContent='';drawCases();drawPatient();trip(false);
    };
    const tr=el('tr'), th=el('th');th.scope='row';th.append(b);tr.append(th,el('td'),el('td'));$('cases').append(tr);
  }
  const milestone=(p)=>p.outcome==='screened'||p.outcome==='imaged';
  function drawDecision(celebrate){
    const a=get(M.baseline).patients,b=s.trial?get(s.trial).patients:null;
    const counts=[0,0];
    for(const [i,tr] of [...$('cases').rows].entries()){
      const id=caseIds[i],checked=s.caseChecks.includes(id);
      const chosen=id===s.caseId, button=tr.querySelector('button');
      button.textContent='Case '+(i+1)+' · '+cases[i].place+(checked?' ✓':'');
      button.setAttribute('aria-label','Case '+(i+1)+' · '+cases[i].place+(checked?' · checked':''));
      button.setAttribute('aria-pressed',String(chosen));
      for(const [j,p] of [a[id-1],b?.[id-1]].entries()){
        const td=tr.cells[j+1];
        if(!checked||!p){td.replaceChildren(el('span',!p?'Not run yet':'Answer correctly to reveal'));td.className='sd-unresolved';continue;}
        const finished=milestone(p);
        if(finished)counts[j]++;
        const tag=el('strong',finished?'✓ Care reached':'! Care missed');tag.className='sd-decision-stamp';
        td.replaceChildren(tag,el('small',outcomes[p.outcome]));td.className=celebrate===id?'sd-reveal':'';
      }
    }
    const n=s.caseChecks.length;
    $('decision-score').textContent=n?'Among the '+n+' checked: '+counts[0]+' reached needed care with the hospital plan · '+counts[1]+' with the redesign.':s.trial?'Choose a case to see its details below. Answer its comparison correctly to fill that row on the board.':'Run a redesign, then choose a case to compare both plans.';
  }
  let attainable;
  const bestGain=()=>attainable??=(M.bestGain(s.seed));
  const dispatchScore=()=>M.mission(get(M.baseline),get(s.trial),equity?cases:[]);
  const bestAttainable=score=>!equity&&!score.won&&score.left>=0&&score.helped.length===score.lost.length&&bestGain()===0;
  function showMission(score){
    const won=score.won, tiedBest=bestAttainable(score);
    const lines=[];
    const named=score.helped.find(p=>caseIds.includes(p.id))||score.helped[0];
    if(named)lines.push('Patient '+named.id+' in '+named.place+' missed needed care in the hospital plan and reached it with your redesign.');
    lines.push(score.helped.length+' newly reached needed care in the 30-patient district; '+score.lost.length+' lost access they previously had.');
    if(score.lost.length)lines.push('Lost access: '+score.lost.map(p=>'Patient '+p.id+' ('+p.place+')').join(', ')+'.');
    if(equity)lines.push(score.featuredComplete+' of 3 featured patients got every needed visit.');
    if(tiedBest)lines.push('No permitted redesign gets more patients all the care they need in this district. Use the cost sheets to compare travel, time, and trade-offs.');
    else if(!won)lines.push('Try moving services or adding ride vouchers, or use the cost sheets to explain why the result did not improve.');
    else if(score.lost.length)lines.push('This is a net gain, not a win for everyone. Use the board and cost sheets to explain who is still left out.');
    popup('success','Dispatch mission results',won?'Mission won!':tiedBest?'Best attainable result!':'Budget met. Access goal not met yet.',
      'Your redesign stayed within '+cost(M.budget)+' with '+cost(score.left)+' to spare.'+(won?' More patients got all the care they needed than with the hospital plan.' :equity&&score.featuredComplete<3?' Keep testing: this plan did not get all three featured patients to the care they needed.':' The number of patients who reached needed care did not go up.'),
      lines,'Review my evidence',$('to-explain'));
    $('edit-plan').hidden=won;
  }
  function drawCases(){
    $('case-progress').textContent=s.trial?s.caseChecks.length+' of 3 comparisons checked.':'Hospital results are ready. Test the redesign to compare all three.';
    drawDecision();
    const scoreBox=$('mission-score');
    scoreBox.hidden=!ready();$('lost-access').hidden=true;
    if(ready()){
      const score=dispatchScore();
      if(score.lost.length){
        $('lost-access').hidden=false;
        $('lost-access').textContent='Lost access: '+score.lost.map(p=>'Patient '+p.id+' ('+p.place+')').join(', ')+'.';
      }
      scoreBox.textContent=(score.won?'✓ Mission won':bestAttainable(score)?'✓ Best attainable result':'Budget met · Access goal not met')+' · '+score.helped.length+' gained access · '+score.lost.length+' lost access · '+cost(score.left)+' left'+(equity?' · '+score.featuredComplete+'/3 featured patients got needed care':'');
    }
    story($('story'),s.caseId);
    $('case-form').hidden=!s.trial;
    $('case-pick').value=comparisonLabels[s.caseAnswers?.[s.caseId]]?s.caseAnswers[s.caseId]:'';
  }
  function drawPatient(){
    const r=result(),p=r.patients[patient-1],box=$('patient');
    for(const [i,b] of [...$('patients').children].entries()){
      const c=r.patients[i];b.textContent=c.id+' '+markers[c.outcome];b.setAttribute('aria-pressed',String(i+1===patient));b.setAttribute('aria-label','Patient '+c.id+', '+c.place+': '+outcomes[c.outcome]);
    }
    box.replaceChildren(el('h4','Patient '+p.id+' · '+p.place+' · '+outcomes[p.outcome]),el('p',p.reason),el('p','Available: '+cost(p.means)+' and '+p.hours+' h per visit. Burden from completed visits: '+cost(p.paid)+'.'));
    for(const [t,v] of [['Screening',p.screen],['Ultrasound follow-up',p.scan]])if(v){
      const detail=el('details');detail.append(el('summary',t+' at '+label(v.place)+': '+cost(v.total)+' · '+v.time+' h · '+v.miles+' mi one way'),dl([['Test fee',cost(v.fee)],['Travel after any ride voucher',cost(v.travel)],['Time away, valued in credits',cost(v.timeCost)]]));box.append(detail);
    }
  }
  const patientBtns=[];
  for(let i=1;i<=30;i++){const b=el('button');b.type='button';b.onclick=()=>{patient=i;drawPatient();trip(true);};patientBtns.push(b);}
  $('patients').append(...patientBtns);
  const home=[[170,141],[180,512],[820,486]], sites={hub:[750,141],mobile:[470,365]};
  function route(a,b){
    if(a===b)return [a];
    const crossroads=sites.mobile;
    return a===crossroads||b===crossroads?[a,b]:[a,crossroads,b];
  }
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  function clearTrip(){cancelAnimationFrame(animation);$('traveler').hidden=true;$('map-event').hidden=true;$('route').setAttribute('visibility','hidden');}
  function marker(at,p,stalled){
    const e=$('traveler');$('traveler-id').textContent=stalled?'!':String(p.id);e.dataset.stalled=String(stalled);
    e.style.setProperty('--x',at[0]/10+'%');e.style.setProperty('--y',at[1]/6.4+'%');e.hidden=false;
  }
  function trip(scroll){
    clearTrip();const p=result().patients[patient-1], start=home[p.z], stops=[start];
    if(p.outcome!=='screen-missed')stops.push(...route(start,sites[p.screen.place]).slice(1));
    const split=stops.length-1;
    let followStart=split;
    if(p.outcome==='imaged'||p.outcome==='follow-up-missed'){
      stops.push(...route(sites[p.screen.place],start).slice(1));
      followStart=stops.length-1;
      if(p.outcome==='imaged')stops.push(...route(start,sites[p.scan.place]).slice(1));
    }
    const end=stops.at(-1), last=p.outcome.endsWith('missed');
    const event=$('map-event');event.hidden=false;drawSites(view==='trial'&&s.trial?s.trial:M.baseline);
    const planName=view==='base'?'Hospital plan · ':'Redesign · ';
    const ending=planName+'Patient '+p.id+': '+outcomes[p.outcome]+'. '+p.reason;
    if(scroll)$('board').scrollIntoView({block:'nearest',behavior:'auto'});
    $('route').setAttribute('points',stops.map(pt=>pt.join(',')).join(' '));$('route').setAttribute('visibility',stops.length>1?'visible':'hidden');
    if(reduce.matches||stops.length===1){marker(end,p,last);event.textContent=ending;return;}
    const startAt=performance.now(), ms=660;
    function tick(t){
      const n=Math.min(stops.length-1,(t-startAt)/ms),i=Math.floor(n);
      if(i===stops.length-1){marker(end,p,last);event.textContent=ending;return;}
      const a=stops[i],b=stops[i+1],f=n-i;
      marker([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],p,false);
      event.textContent=planName+'Patient '+p.id+(i<split?' is traveling to screening.':i<followStart?' is heading home after screening.':' is traveling to ultrasound follow-up.');
      animation=requestAnimationFrame(tick);
    }
    animation=requestAnimationFrame(tick);
  }
  $('view').onchange=()=>{view=$('view').value;drawPatient();trip(false);};$('replay').onclick=()=>{patient=s.caseId;drawPatient();trip(true);};
  function comparisons(){
    const a=get(M.baseline), b=s.trial?get(s.trial):null;
    const row=(title,f)=>[title,f(a),b?f(b):'Not yet tested'];
    return [row('Completed screening (out of 30)',r=>r.screened),
      row('Referred for ultrasound',r=>r.referred),row('Completed ultrasound',r=>r.imaged),
      row('Missed ultrasound after referral',r=>r.referred-r.imaged),
      row('Network’s clinic cost',r=>cost(r.clinic)),row('Patient costs, including time (completed visits)',r=>cost(r.outlay)),
      ...M.places.map((p,i)=>row(p+': completed ultrasound',r=>r.areas[i].imaged))];
  }
  const cols=['Simulated outcome','Hospital plan','Your redesign'];
  function table(host){
    function make(rows,caption){
      const t=el('table');t.className='sd-table';const thead=el('thead'),th=el('tr'),body=el('tbody');
      for(const c of cols){const cell=el('th',c);cell.scope='col';th.append(cell);}thead.append(th);
      for(const row of rows){const tr=el('tr'), first=el('th',row[0]);first.scope='row';tr.append(first,...row.slice(1).map(x=>el('td',x)));body.append(tr);}
      t.append(el('caption',caption),thead,body);return t;
    }
    if(!s.trial){host.replaceChildren();return;}
    const rows=comparisons(), details=el('details');details.className='sd-deeper';
    details.append(el('summary','Show more numbers'),make(rows,'All simulated results'),el('p','Lower total patient burden can mean fewer people got care, not that the trip was easier.'));
    host.replaceChildren(make([rows[2],rows[4],rows[5]],'Same fictional patients, two plans'),details);
  }
  function story(host,id){
    const a=get(M.baseline).patients[id-1];
    const b=s.trial?get(s.trial).patients[id-1]:null;
    const line=(name,p)=>{
      const text=el('p');text.append(el('strong',name+': '+outcomes[p.outcome]+'. '),document.createTextNode(p.reason));
      if(p.scan)text.append(document.createTextNode(' The follow-up visit would take '+p.scan.time+' h and cost '+cost(p.scan.total)+' in fees, travel and time.'));
      return text;
    };
    const profile=cases.find(p=>p.id===id);
    host.replaceChildren(el('h4','Patient '+id+' · '+a.place));
    if(profile)host.append(el('p',need(profile)+' · Income: '+income(profile)+' · Care budget: '+cost(profile.means)),el('p','One way: '+profile.distances.hub+' mi to hospital · '+profile.distances.mobile+' mi to mobile clinic'));
    host.append(line('Hospital plan',a));
    if(b){
      host.append(line('Redesign',b));
      const screen=label(s.trial.screen), scan=label(s.trial.machine);
      host.append(el('p','Recorded redesign: screening at '+screen+'; ultrasound follow-up at '+scan+'. The practice cost sheet is a separate what-if and does not move either service in the recorded plan.'));
    }
    if(profile){
      host.append(itemizedQuote(profile,M.baseline,'Hospital plan: itemized visit costs'));
      if(b)host.append(itemizedQuote(profile,s.trial,'Redesign: itemized visit costs'));
    }
  }
  function render(){
    const explain=s.step==='explain'&&ready();
    $('map-section').hidden=explain;$('explain-section').hidden=!explain;
    for(const b of document.querySelectorAll('[data-sd-step]')){
      b.disabled=b.dataset.sdStep==='explain'&&!ready();
      if((b.dataset.sdStep==='explain')===explain)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
    }
    $('journeys').hidden=!s.started;$('to-explain').disabled=!ready();$('to-explain').hidden=!s.trial;$('unlock-explain').hidden=!s.trial||ready();
    $('view').options[1].disabled=!s.trial;$('view').value=view;
    if(s.started){drawPatient();drawCases();table($('results'));}
    if(s.trial){
      table($('evidence'));$('case-evidence').replaceChildren(...cases.map((p,i)=>{
        const d=el('details');d.className='sd-deeper';d.open=i===0;
        const body=el('div');body.className='sd-story';story(body,p.id);
        d.append(el('summary','Case '+(i+1)+' · '+p.place),body);return d;
      }));
    }
    renderFinish();
    drawSetup();
  }
  function renderFinish(){
    const done=complete(), canFinish=ready()&&hasRecommendation();
    $('finish').hidden=done;
    $('finish').disabled=!canFinish||done;
    $('edit-recommendation').hidden=!done;
    for(const k of ['claim','limit'])$(k).readOnly=done;
    $('finished').textContent=done?'Investigation complete. Preview and download your report to turn in. Nothing is sent automatically.':
      canFinish?'Ready to finish. Finish investigation saves your completed report.':'Write both responses to finish.';
  }
  function nav(step){
    if(step==='explain'&&!ready())return;
    clearTrip();s.step=step;save();render();$(step+'-title').focus();
  }
  $('run').onclick=()=>{
    if($('run').disabled)return;
    const previousChecks=s.caseChecks.length;
    clearTrip();
    if(!s.started){
      s.started=true;view='base';
      patient=s.caseId;
    }
    else{
      s.trial={...s.plan};view='trial';s.finished=false;patient=s.caseId;
      const baseline=get(M.baseline).patients, revised=get(s.trial).patients;
      s.caseChecks=s.caseChecks.filter(id=>s.caseAnswers?.[id]===M.comparison(baseline[id-1],revised[id-1]));
    }
    $('case-feedback').textContent='';
    if(quoteCase){
      $('pay-plan').options[1].textContent=s.trial?'Your recorded redesign':'Mobile ultrasound · hospital screening';
      loadWallet('Practice bookings are kept separately for each plan.');
    }
    save();render();trip(false);
    (s.trial?$('journey-title'):$('action-title')).focus();
    saySafe(view==='base'?'Hospital plan recorded. Watch the selected patient, then move the ultrasound team.':previousChecks?'Redesign recorded. '+s.caseChecks.length+' of '+previousChecks+' earlier answers still match. Recheck changed results before submitting.':'Redesign recorded. Choose a case and compare the two plans.');
    if(view==='trial'&&ready())showMission(dispatchScore());
  };
  const comparisonLabels={base:'Hospital only',trial:'Redesign only',both:'Both plans',neither:'Neither plan'};
  $('case-form').onsubmit=e=>{
    e.preventDefault();if(!s.trial||!$('case-pick').value)return;
    const id=s.caseId, a=get(M.baseline).patients[id-1], b=get(s.trial).patients[id-1];
    const answer=M.comparison(a,b), choice=$('case-pick').value;
    if(choice!==answer){
      s.caseAnswers={...s.caseAnswers,[id]:choice};s.caseChecks=s.caseChecks.filter(x=>x!==id);s.finished=false;save();render();
      const explain=(name,p)=>name+': '+(milestone(p)?'all needed care completed.':p.reason);
      $('case-feedback').textContent='Not quite. '+explain('Hospital',a)+' '+explain('Redesign',b);
      return;
    }
    const wasReady=ready();
    s.caseAnswers={...s.caseAnswers,[id]:choice};
    if(!s.caseChecks.includes(id))s.caseChecks.push(id);
    save();render();drawDecision(id);
    $('case-feedback').textContent=ready()?'Correct. All three comparisons are checked. You can now recommend a plan.':'Correct. Choose an unchecked case to compare next.';
    if(!wasReady&&ready())showMission(dispatchScore());
  };
  for(const b of document.querySelectorAll('[data-sd-step]'))b.onclick=()=>nav(b.dataset.sdStep);
  $('to-explain').onclick=()=>nav('explain');
  for(const k of ['claim','limit']){$(k).value=s[k];$(k).oninput=()=>{s[k]=str($(k).value);s.finished=false;save();renderFinish();};}
  $('finish').onclick=()=>{
    if(!ready()||!hasRecommendation()||complete())return;
    s.finished=true;
    const ok=save();
    if(!ok)s.finished=false;
    renderFinish();
    if(ok)$('finished').focus();
  };
  $('edit-recommendation').onclick=()=>{
    s.finished=false;save();renderFinish();$('claim').focus();
  };
  $('reset').onclick=()=>$('dialog').showModal();
  $('clear').onclick=()=>{const r=session?.reset(KEY,JSON.stringify({v:1,seed:newSeed(),caseMode:'equity'}));if(r?.ok)location.reload();else{$('dialog').close();say('Could not reset this activity from this tab.');}};
  window.addEventListener('storage',notice);window.addEventListener('pageshow',notice);
  render();notice();restorePracticeView();
  function collectReport(){
    const missing=[!s.started&&'Run the hospital plan.',!s.trial&&'Run a redesign.',!ready()&&'Check all three patient comparisons.',!complete()&&'Write both recommendations and finish.'].filter(Boolean);
    const comparison=s.started?[{type:'table',title:'Fictional district results',columns:cols,rows:comparisons()}]:[];
    const plan=s.trial?[{type:'table',title:'Clinic costs by plan',columns:['Clinic expense','Hospital plan','Redesign'],rows:clinicRows(get(M.baseline)).map(([k,v],i)=>[k,v,clinicRows(get(s.trial))[i][1]])},{type:'table',title:'Recorded redesign',columns:['Equipment or support','Location'],rows:M.pieces.map(k=>[M.names[k],label(s.trial[k])])}]:[];
    const a=get(M.baseline).patients,b=s.trial?get(s.trial).patients:null;
    const score=s.trial&&dispatchScore();
    const missionItems=score?[{type:'table',title:'Dispatch mission results',columns:['Measure','Result'],rows:[
      ['Clinic credits remaining',cost(score.left)],...(equity?[['Featured patients who reached needed care',score.featuredComplete+' / 3']]:[]),['Patients newly reaching needed care',String(score.helped.length)],
      ['Patients losing access they previously had',String(score.lost.length)],['Mission result',score.won?'Won: within budget with a net gain in access':bestAttainable(score)?'Best attainable: within budget and matched the highest access total':equity&&score.featuredComplete<3?'Within budget; not all featured patients reached needed care':'Within budget; no net gain in access']
    ]}]:[];
    const caseItems=[{type:'table',title:'Three patient scenarios',columns:['Patient / town','Income and care budget','Care needed','Hospital / mobile one-way distance','Hospital plan','Redesign'],rows:cases.map(p=>[
      'Patient '+p.id+' · '+p.place,income(p)+' · '+cost(p.means),need(p),p.distances.hub+' mi / '+p.distances.mobile+' mi',
      s.started?outcomes[a[p.id-1].outcome]:'Not yet tested',b?outcomes[b[p.id-1].outcome]:'Not yet tested'
    ])}];
    const choices=[{type:'table',title:'Your comparison answers',columns:['Patient','Selected answer','Status'],rows:cases.map(p=>[
      'Patient '+p.id,comparisonLabels[s.caseAnswers?.[p.id]]||'Not answered',s.caseChecks.includes(p.id)?'Correct for this plan':'Needs review'
    ])}];
    const losses=score?.lost.length?[{type:'text',text:'Lost access: '+score.lost.map(p=>'Patient '+p.id+' ('+p.place+')').join(', ')+'.'}]:[];
    const priceItems=s.started?[{type:'table',title:'Itemized patient cost sheets (planned visits, not necessarily completed)',columns:['Case / plan','Service and site','Drive','Test fee','Time away','Budget used'],rows:cases.flatMap((p,i)=>(s.trial?[['Hospital',M.baseline],['Redesign',s.trial]]:[['Hospital',M.baseline]]).flatMap(([planName,plan])=>needKinds(p).map(kind=>{
      const q=visitQuote(p,kind,plan);return ['Case '+(i+1)+' / '+planName,visits[kind]+' · '+label(q.place),
        q.miles+' mi one way · '+cost(q.travel),cost(q.fee),q.time+' h · '+cost(q.timeCost),cost(q.total)];
    })))}]:[];
    const practiceRows=Object.entries(s.practice).flatMap(([key,count])=>{
      const [id,...sites]=key.split(':'),p=cases.find(c=>String(c.id)===id);
      if(!p||sites.length!==M.pieces.length||sites.some(z=>z!=='none'&&!M.zones.includes(z))||!Number.isInteger(count)||count<1||count>needKinds(p).length)return [];
      return [['Patient '+p.id+' · '+p.place,M.pieces.map((k,i)=>M.names[k]+': '+label(sites[i])).join('; '),needKinds(p).slice(0,count).map(kind=>visits[kind]).join(' + ')]];
    });
    const practiceItems=practiceRows.length?[{type:'table',title:'Practice cost-sheet bookings (not district results)',columns:['Patient','Practice plan setup','Visits booked'],rows:practiceRows}]:[];
    return {title:'Cancer Screening Design Lab',unit:'OpenSciEd Biology B.3 · Engineering extension',source:'Fictional classroom simulation. Costs in made-up credits. No real patient records or cancer diagnosis.',status:!savable()?'recovery':complete()?'final':'draft',student:student(),datasetId,missing,
      sections:[{title:'Evidence',items:[...caseItems,...choices,...losses,...missionItems,...comparison,...plan,...priceItems,...practiceItems]},
      {title:'My recommendation',items:[{type:'answer',prompt:'Which plan would you fund?',value:s.claim},{type:'answer',prompt:'Who might still get left out?',value:s.limit}]}]};
  }
  window.OpenSciEdSubmission?.mount({target:'#sd-report',filename:'cancer-screening-design',collect:collectReport});
  $('copy-report').onclick=async()=>{
    const r=collectReport(), lines=[r.title,r.datasetId,r.unit,r.source];
    if(r.student?.name)lines.push('Name: '+r.student.name);
    if(r.student?.period)lines.push('Class period: '+r.student.period);
    lines.push('Status: '+r.status);
    if(r.missing.length)lines.push('Remaining: '+r.missing.join(' '));
    for(const sec of r.sections){
      lines.push('',sec.title);
      for(const item of sec.items){
        if(item.type==='table')lines.push(item.title,item.columns.join(' | '),...item.rows.map(row=>row.join(' | ')));
        else if(item.type==='answer')lines.push(item.prompt,item.value||'Not answered');
        else lines.push(item.text);
      }
    }
    const contents=lines.join('\n');
    try{await navigator.clipboard.writeText(contents);$('copy-fallback').hidden=true;say('Report text copied.');}
    catch(_){$('copy-fallback').hidden=false;$('copy-text').value=contents;$('copy-text').select();say('Clipboard unavailable. Copy the selected report text manually.');}
  };
})();
