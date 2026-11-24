(() => {
  'use strict';
  const M=window.ScreeningLogic, api=window.OpenSciEdSaveSession, KEY='aplab:openscied:b3-screening:v1';
  const $=id=>document.getElementById('sd-'+id), say=t=>{$('status').textContent=t;};
  const el=(tag,t)=>Object.assign(document.createElement(tag),{textContent:t??''});
  const cost=n=>n+' cr', label=z=>M.names[z]||'Supply rack';
  const fresh=()=>({v:1,seed:crypto.getRandomValues(new Uint32Array(1))[0],plan:{...M.baseline},started:false,trial:null,claim:'',limit:'',finished:false,step:'map',caseId:null,caseAnswers:{},caseChecks:[],lastVisitedAt:0});
  const cleanPlan=p=>Object.fromEntries(M.pieces.map(k=>[k,M.zones.includes(p?.[k])?p[k]:null]));
  const str=x=>typeof x==='string'?x.slice(0,1800):'';
  const ready=()=>!!s.trial&&cases.every(p=>s.caseChecks.includes(p.id));
  const complete=()=>ready()&&s.claim.trim()&&s.limit.trim()&&s.finished;
  let s=fresh(), session, recovery=false, selected='', view='base', patient=1, animation=0;
  const same=(a,b)=>M.pieces.every(k=>a[k]===b[k]);
  try{
    session=api.open(localStorage,'b3-screening',[KEY]);const raw=session.read(KEY);
    if(raw!==null){
      const x=JSON.parse(raw);
      if(x?.v!==1||!Number.isInteger(x.seed)||x.seed<0||x.seed>4294967295)throw Error('Invalid save');
      const trial=cleanPlan(x.trial);
      s={...s,seed:x.seed,plan:x.started?cleanPlan(x.plan):{...M.baseline},started:x.started===true,trial:x.started&&!M.validate(trial)&&!same(trial,M.baseline)?trial:null,caseId:x.caseId,caseAnswers:x.caseAnswers,caseChecks:Array.isArray(x.caseChecks)?x.caseChecks:[],claim:str(x.claim),limit:str(x.limit),finished:x.finished===true,lastVisitedAt:Number(x.lastVisitedAt)||0,step:x.step==='explain'?'explain':'map'};
    }else session.write(KEY,JSON.stringify({v:1,seed:s.seed}));
    if(s.trial)view='trial';

  }catch(_){recovery=true;}
  const cases=M.scenarios(s.seed);
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
  let marked=false;
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
    $('sonogram').setAttribute('aria-label','Simulated ultrasound image. '+status);
    probe.setAttribute('aria-valuetext',at+' of 100. '+status);
    return onMass;
  }
  function moveProbe(){
    marked=false;$('scan-feedback').hidden=true;drawProbe();
  }
  probe.oninput=moveProbe;
  $('mark').onclick=()=>{
    marked=drawProbe();drawProbe();
    const msg=$('scan-feedback');msg.hidden=false;
    msg.textContent=marked?'You found the simulated mass. Different echoes made its outline stand out from nearby tissue. This image shows a shape, not a cancer diagnosis.':'This slice only shows tissue layers. Sweep farther and watch for a new shape. One slice can miss a mass.';
    msg.focus({preventScroll:true});
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
    clearTrip();selected='';for(const k of keys)s.plan[k]=dest;
    save();drawSetup();
    saySafe(name+' moved to '+label(dest)+'. '+$('setup-note').textContent);
    if(key==='team'&&dest==='mobile')$('run').focus({preventScroll:false});
    else toolButtons[key].focus({preventScroll:true});
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
  for(const [i,p] of cases.entries()){
    const card=el('article');card.className='sd-profile';
    const k=el('p','Case '+(i+1));k.className='sd-stage';
    const distances=el('ul');distances.append(el('li','Hospital: '+p.distances.hub+' mi'),el('li','Mobile clinic: '+p.distances.mobile+' mi'));
    card.append(k,el('h4','Patient '+p.id+' · '+p.place),el('p',need(p)),el('p','Income: '+income(p)+' · Care budget: '+cost(p.means)),el('p','Time available per visit: '+p.hours+' h'),distances);
    $('profiles').append(card);
    const b=el('button');b.type='button';b.className='btn';b.onclick=()=>{
      s.caseId=patient=p.id;save();$('case-feedback').textContent='';drawCases();drawPatient();trip(false);
    };
    $('cases').append(b);
  }
  function drawCases(){
    $('case-progress').textContent=s.trial?s.caseChecks.length+' of 3 comparisons checked.':'Hospital results are ready. Test the redesign to compare all three.';
    const idx=caseIds.indexOf(s.caseId);
    for(const [i,b] of [...$('cases').children].entries()){
      const done=s.caseChecks.includes(caseIds[i]);
      b.textContent='Case '+(i+1)+(done?' ✓':'');b.setAttribute('aria-label','Case '+(i+1)+' · '+cases[i].place+(done?' · checked':''));
      b.setAttribute('aria-pressed',String(i===idx));
    }
    story($('story'),s.caseId);
    $('case-form').hidden=!s.trial;
    $('case-pick').value=s.caseChecks.includes(s.caseId)?s.caseAnswers[s.caseId]:'';
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
    const e=$('traveler');e.textContent=stalled?'!':String(p.id);e.dataset.stalled=String(stalled);
    e.style.setProperty('--x',at[0]/10+'%');e.style.setProperty('--y',at[1]/6.4+'%');e.hidden=false;
  }
  function trip(scroll){
    clearTrip();const p=result().patients[patient-1], start=home[p.z], stops=[start];
    if(p.outcome!=='screen-missed')stops.push(...route(start,sites[p.screen.place]).slice(1));
    const split=stops.length-1;
    if(p.outcome==='imaged')stops.push(...route(sites[p.screen.place],sites[p.scan.place]).slice(1));
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
      event.textContent=planName+'Patient '+p.id+(i<split?' is traveling to screening.':' is traveling to ultrasound follow-up.');
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
    if(b)host.append(line('Redesign',b));
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
    $('finish').disabled=!(ready()&&s.claim.trim()&&s.limit.trim())||!!complete();
    $('finished').textContent=complete()?'Investigation complete. Preview your report before submitting it.':'Write both responses to finish.';
    drawSetup();
  }
  function nav(step){
    if(step==='explain'&&!ready())return;
    clearTrip();s.step=step;save();render();$(step+'-title').focus();
  }
  $('run').onclick=()=>{
    if($('run').disabled)return;
    clearTrip();
    if(!s.started){
      s.started=true;view='base';
      patient=s.caseId;
    }
    else{s.trial={...s.plan};view='trial';s.finished=false;s.caseChecks=[];s.caseAnswers={};patient=s.caseId;}
    $('case-feedback').textContent='';
    save();render();trip(false);
    (s.trial?$('journey-title'):$('action-title')).focus();
    saySafe(view==='base'?'Hospital plan recorded. Watch the selected patient, then move the ultrasound team.':'Redesign recorded. Compare all three patients.');
  };
  $('case-form').onsubmit=e=>{
    e.preventDefault();if(!s.trial||!$('case-pick').value)return;
    const id=s.caseId, a=get(M.baseline).patients[id-1], b=get(s.trial).patients[id-1];
    const answer=M.comparison(a,b), choice=$('case-pick').value;
    if(choice!==answer){
      $('case-feedback').textContent='Not quite. Check each result above. This patient needs '+need(cases.find(p=>p.id===id)).toLowerCase()+'.';
      return;
    }
    s.caseAnswers={...s.caseAnswers,[id]:choice};
    if(!s.caseChecks.includes(id))s.caseChecks.push(id);
    save();render();
    $('case-feedback').textContent=ready()?'Correct. All three comparisons are checked. You can now recommend a plan.':'Correct. Choose an unchecked case to compare next.';
  };
  for(const b of document.querySelectorAll('[data-sd-step]'))b.onclick=()=>nav(b.dataset.sdStep);
  $('to-explain').onclick=()=>nav('explain');
  for(const k of ['claim','limit']){$(k).value=s[k];$(k).oninput=()=>{s[k]=str($(k).value);s.finished=false;save();$('finish').disabled=!(ready()&&s.claim.trim()&&s.limit.trim());$('finished').textContent='Write both responses to finish.';};}
  $('finish').onclick=()=>{if($('finish').disabled)return;s.finished=true;save();render();saySafe('Report ready.');};
  $('reset').onclick=()=>$('dialog').showModal();
  $('clear').onclick=()=>{const r=session?.reset(KEY,JSON.stringify({v:1,seed:fresh().seed}));if(r?.ok)location.reload();else{$('dialog').close();say('Could not reset this activity from this tab.');}};
  window.addEventListener('storage',notice);window.addEventListener('pageshow',notice);
  render();notice();
  window.OpenSciEdSubmission?.mount({target:'#sd-report',filename:'cancer-screening-design',collect:()=>{
    const missing=[!s.started&&'Run the hospital plan.',!s.trial&&'Run a redesign.',!ready()&&'Check all three patient comparisons.',!complete()&&'Write both recommendations and finish.'].filter(Boolean);
    const comparison=s.started?[{type:'table',title:'Fictional district results',columns:cols,rows:comparisons()}]:[];
    const plan=s.trial?[{type:'table',title:'Clinic costs by plan',columns:['Clinic expense','Hospital plan','Redesign'],rows:clinicRows(get(M.baseline)).map(([k,v],i)=>[k,v,clinicRows(get(s.trial))[i][1]])},{type:'table',title:'Recorded redesign',columns:['Equipment or support','Location'],rows:M.pieces.map(k=>[M.names[k],label(s.trial[k])])}]:[];
    const a=get(M.baseline).patients,b=s.trial?get(s.trial).patients:null;
    const caseItems=[{type:'table',title:'Three patient scenarios',columns:['Patient / town','Income and visit budget','Care needed','Hospital / mobile one-way distance','Hospital plan','Redesign','Comparison'],rows:cases.map(p=>[
      'Patient '+p.id+' · '+p.place,income(p)+' · '+cost(p.means),need(p),p.distances.hub+' mi / '+p.distances.mobile+' mi',
      s.started?outcomes[a[p.id-1].outcome]:'Not yet tested',b?outcomes[b[p.id-1].outcome]:'Not yet tested',s.caseChecks.includes(p.id)?'Checked':'Not yet checked'
    ])}];
    return {title:'Cancer Screening Design Lab',unit:'OpenSciEd Biology B.3 · Engineering extension',source:'Fictional classroom simulation. Costs in made-up credits. No real patient records or cancer diagnosis.',status:!savable()?'recovery':complete()?'final':'draft',student:student(),datasetId:'SD-'+s.seed.toString(16).toUpperCase().padStart(8,'0'),missing,
      sections:[{title:'Evidence',items:[...caseItems,...comparison,...plan]},
      {title:'My recommendation',items:[{type:'answer',prompt:'Which plan would you fund?',value:s.claim},{type:'answer',prompt:'Who might still get left out?',value:s.limit}]}]};
  }});
})();
