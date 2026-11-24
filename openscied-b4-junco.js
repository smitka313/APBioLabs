/* Lesson 4 companion. Published graphs and simulated field trials are kept separate. */
(() => {
  'use strict';
  const D = window.JUNCO_DATA;
  if (!D || !window.Lab?.chart) {
    const status=document.getElementById('ju-live');
    if(status)status.textContent='The study data could not load. Reload this page to try again.';
    return;
  }
  const key='aplab:openscied:b4-junco:v1';
  const steps=['field','aviary','cort'];
  const choices={same:'About the same',higher:'Higher for city birds',lower:'Lower for city birds'};
  const sites={urban:'UC San Diego',mountain:'Mt. Laguna'};
  const fieldLabels={foraging:'Birds looking for food',incubating:'Females sitting on eggs'};
  const aviaryLabels={female:'Females',male:'Males'};
  const $=id=>document.getElementById('ju-'+id);
  const cleanText=(v,n)=>typeof v==='string'?v.slice(0,n):'';
  const pick=(v,valid,d)=>valid.includes(v)?v:d;
  const blank=()=>({step:'field',prediction:'',revealed:false,reason:'',observation:'',claim:'',limits:'',person:{},fieldGroup:'foraging',aviaryGroup:'female',filter:'all',fit:false,lastVisitedAt:0});
  const scope='b4-junco', guard=window.OpenSciEdSaveSession;
  let session;
  try {session=guard?.open(window.localStorage,scope,[key]);} catch (_) {}
  let state=blank(), invalid=false, warned='';
  try{
    const saved=session?.read(key) ?? null, raw=JSON.parse(saved ?? 'null');
    if(saved!==null&&(!raw||typeof raw!=='object'||Array.isArray(raw))) throw Error('Unreadable notebook');
    if(raw && typeof raw==='object'){
      state.prediction=pick(raw.prediction,Object.keys(choices),'');
      state.revealed=raw.revealed===true&&!!state.prediction;
      state.step=pick(raw.step,state.revealed?steps:steps.slice(0,2),'field');
      for(const [k,n] of [['reason',900],['observation',900],['claim',1600],['limits',1600]])state[k]=cleanText(raw[k],n);
      for(const [k,n] of [['name',100],['period',24]])if(typeof raw.person?.[k]==='string')state.person[k]=cleanText(raw.person[k],n);
      state.fieldGroup=pick(raw.fieldGroup,Object.keys(fieldLabels),'foraging');
      state.aviaryGroup=pick(raw.aviaryGroup,Object.keys(aviaryLabels),'female');
      state.filter=pick(raw.filter,['all',...Object.keys(sites)],'all');
      state.fit=raw.fit===true;
      if(window.JuncoFlight)state.sim=window.JuncoFlight.clean(raw.sim,D.field.rows);
    }
  }catch(_){invalid=true;}
  function notSaved(reason) {
    const text=reason==='unreadable' ? 'The previous notebook could not be read and has not been overwritten.' :
      reason==='changed' ? 'A newer copy of this activity was saved in another tab. This tab will not overwrite it.' :
      reason==='erased' ? 'Saved work was cleared on this device. This tab will not bring it back.' :
      'This browser could not save the work in this tab.';
    const message=text+' Download a copy before closing this tab.';
    $('save-warning').hidden=false;$('save-warning-text').textContent=message;
    if(warned!==message) {warned=message;say(message);}
    return false;
  }
  function save(){
    state.lastVisitedAt=Date.now();
    if(invalid)return notSaved('unreadable');
    const result=session?.write(key,JSON.stringify(state));
    if(!result?.ok) return notSaved(result?.reason);
    warned='';$('save-warning').hidden=true;return true;
  }
  function say(s){$('live').textContent=s;}
  const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n):'—';
  const mk=(tag,t)=>Object.assign(document.createElement(tag),{textContent:t??''});
  const nav=[...document.querySelectorAll('[data-step]')];
  const seriesColors=['var(--ju-city)','var(--ju-mtn)'];
  const charts={};
  function graph(which,options){
    const opts={simTag:false,responsive:true,height:340,...options};
    if(charts[which])charts[which].update(opts);
    else charts[which]=Lab.chart($(which),opts);
  }
  function tableInto(host,headers,rows){
    const table=mk('table'), head=mk('thead'), tr=mk('tr'), body=mk('tbody');
    headers.forEach(v=>{const th=mk('th',v);th.scope='col';tr.append(th);});
    head.append(tr);table.append(head,body);
    rows.forEach(values=>{const row=mk('tr');values.forEach(v=>row.append(mk('td',v)));body.append(row);});
    host.replaceChildren(table);
  }
  const errName=d=>d.errorLabel||'SE';
  const groupRows=(data,group)=>data.rows.filter(r=>r.group==null||r.group===group);
  const rowData=r=>[sites[r.site],fmt(r.mean),fmt(r.se),r.n??'—'];
  function summary(kind,group){
    const d=D[kind],rows=groupRows(d,group);
    const domain=kind==='field'?rows:d.rows;
    const hasError=rows.some(row=>Number.isFinite(row.se));
    const yMax=Math.max(0.1,...domain.map(r=>r.mean+(Number.isFinite(r.se)?r.se:0)));
    const yMin=Math.min(0,...domain.map(r=>r.mean-(Number.isFinite(r.se)?r.se:0)));
    graph(kind+'-chart',{type:'bar',categories:['Mean by population'],xLabel:'Population of origin',yLabel:kind==='field'?'Flight-initiation distance ('+d.unit+')':'Mean exploration score (PC1)',yMin:yMin<0?Math.floor(yMin*1.12*2)/2:0,yMax:Math.ceil(yMax*1.12*2)/2,
      series:['urban','mountain'].map((site,i)=>({name:sites[site],color:seriesColors[i],points:rows.filter(r=>r.site===site).map(r=>({x:'Mean by population',y:r.mean,err:Number.isFinite(r.se)?r.se:0}))}))});
    const headers=hasError?['Population','Mean',errName(d),'n']:['Population','Mean','n'];
    tableInto($(kind+'-table'),headers,rows.map(row=>hasError?rowData(row):[sites[row.site],fmt(row.mean),row.n??'—']));
    $(kind+'-note').textContent=[d.note,hasError?'Error bars show '+errName(d)+'.':'',kind==='field'?'The distance scale changes with the selected group.':''].filter(Boolean).join(' ');
  }
  function corr(rows){
    if(rows.length<3)return null;
    const ax=rows.reduce((a,p)=>a+p.x,0)/rows.length,ay=rows.reduce((a,p)=>a+p.y,0)/rows.length;
    let xy=0,xx=0,yy=0;
    rows.forEach(p=>{const x=p.x-ax,y=p.y-ay;xy+=x*y;xx+=x*x;yy+=y*y;});
    return xx&&yy?xy/Math.sqrt(xx*yy):null;
  }
  const points=D.cort.rows.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  const identified=points.some(p=>p.site==='urban')&&points.some(p=>p.site==='mountain');
  function cort(){
    const d=D.cort;
    $('cort-tools').hidden=!points.length;
    $('filter').disabled=!identified;
    $('filter').closest('label').hidden=!identified;
    $('cort-details').hidden=!points.length;
    $('chart').hidden=!points.length;
    if(!points.length){
      $('cort-status').textContent=d.note||'Individual bird records are not available for plotting. See the original study for the published relationship.';
      return;
    }
    const rows=points.filter(p=>!identified||state.filter==='all'||p.site===state.filter);
    const yName='Individual exploration score (PC1)', xName=d.xLabel||'CORT';
    const graphSeries=identified?(state.filter==='all'?Object.keys(sites):[state.filter]).map(site=>({name:sites[site],color:seriesColors[Object.keys(sites).indexOf(site)],points:rows.filter(p=>p.site===site),line:false,dots:true,fit:state.fit?'linear':undefined})):[{name:'All plotted birds',points:rows,line:false,dots:true,fit:state.fit?'linear':undefined}];
    const ext=(axis,f)=>Math.max(1,Math.ceil(Math.max(...points.map(p=>p[axis]))*1.06/f)*f);
    graph('chart',{type:'xy',xLabel:xName,yLabel:yName,xMin:Math.min(0,...points.map(p=>p.x)),xMax:ext('x',d.xStep||10),yMin:Math.min(0,...points.map(p=>p.y)),yMax:ext('y',d.yStep||5),series:graphSeries});
    $('cort-x').textContent=xName;
    const tbody=$('cort-table').tBodies[0];
    tbody.replaceChildren(...rows.map(p=>{
      const tr=mk('tr');tr.dataset.site=p.site||'all';
      [sites[p.site]||'Not identified',fmt(p.x),fmt(p.y)].forEach(v=>tr.append(mk('td',v)));return tr;
    }));
    const r=corr(rows);
    $('cort-status').textContent=[rows.length+' birds shown'+(Number.isFinite(r)?'; correlation r = '+fmt(r)+'.':'.'),d.note].filter(Boolean).join(' ');
  }
  function pairLine(d,group,caption){
    const pairs=groupRows(d,group).map(row=>sites[row.site]+' '+fmt(row.mean));
    return caption+': '+pairs.join(' vs. ')+' ('+d.unit+').';
  }
  function evidenceLines(){
    return [pairLine(D.field,state.fieldGroup,fieldLabels[state.fieldGroup]),pairLine(D.aviary,state.aviaryGroup,aviaryLabels[state.aviaryGroup])];
  }
  function evidence(){
    $('evidence').replaceChildren(...evidenceLines().map(s=>mk('p',s)));
    $('saved-observation').textContent=state.observation.trim()?'Your field note: '+state.observation:'';
  }
  function completion(){
    const done={field:!!state.observation.trim(),aviary:state.revealed,cort:!!(state.claim.trim()&&state.limits.trim())};
    $('step-hint').hidden=state.revealed;
    for(const btn of nav){
      const step=btn.dataset.step;
      btn.toggleAttribute('data-ose-complete',done[step]);
      if(done[step])btn.setAttribute('aria-description','Complete');
      else if(step==='cort'&&!state.revealed)btn.setAttribute('aria-description','Save your prediction and reveal the shared-aviary results first.');
      else btn.removeAttribute('aria-description');
    }
  }
  function draw(focus=false){
    for(const step of steps)document.getElementById(step).hidden=step!==state.step;
    for(const btn of nav){
      if(btn.dataset.step===state.step)btn.setAttribute('aria-current','step');
      else btn.removeAttribute('aria-current');
      btn.disabled=btn.dataset.step==='cort'&&!state.revealed;
    }
    completion();
    $('field-group').value=state.fieldGroup;$('aviary-group').value=state.aviaryGroup;
    $('prediction').value=state.prediction;$('prediction').disabled=state.revealed;
    $('reason').readOnly=state.revealed;
    $('reveal').disabled=state.revealed||!state.prediction;
    $('reveal').textContent=state.revealed?'Prediction saved':'Save prediction and reveal results';
    $('aviary-results').hidden=!state.revealed;
    $('prediction-reminder').textContent=state.prediction?'Your prediction: '+choices[state.prediction]+'.':'';
    if(state.step==='field')summary('field',state.fieldGroup);
    if(state.step==='aviary'&&state.revealed)summary('aviary',state.aviaryGroup);
    if(state.step==='cort'){cort();evidence();}
    if(focus)$(state.step+'-title').focus();
  }
  function go(step,focus=true){
    if(!steps.includes(step)||(step==='cort'&&!state.revealed))return false;
    if(state.step==='aviary'&&step!=='aviary'){
      resetAviaryRoutine?.();
      say('');
    }
    state.step=step;
    history.replaceState(null,'','#'+step);
    save();draw(focus);return true;
  }
  for(const btn of nav)btn.addEventListener('click',()=>go(btn.dataset.step));
  // This cutaway illustrates the controlled setup. It adds no data and never changes saved progress.
  function wireAviaryScene(){
    const art=$('aviary-art'), detail=$('aviary-detail'), replay=$('aviary-replay');
    const caption=$('aviary-routine-caption'), label=$('aviary-replay-label');
    if(!art||!detail||!replay||!caption||!label)return;
    const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const stages=[...art.querySelectorAll('[data-aviary-stage]')];
    const phases={
      idle:['Try a sample care routine.', 'Watch what stays the same in both enclosures.'],
      approach:['1. Approach both enclosures.', 'The caretaker brings the same scoop to each enclosure.'],
      refill:['2. Refill both dishes.', 'Food goes into the dish in each enclosure.'],
      matched:['3. Same routine for both groups.', 'Both dishes are full. The birds hop closer in this illustration; their reactions were not measured here.']
    };
    let timer;
    const controls=[...art.querySelectorAll('[data-aviary-control]')];
    const notes={
      housing:['Matched housing:', 'Birds from the two populations lived separately under the same housing conditions, including similar numbers of birds per unit of floor space.'],
      food:['Matched food:', 'The matching dishes represent the same food conditions in the home aviaries. Later, dishes in the unfamiliar test room held wood shavings, not food.'],
      people:['Matched exposure to people:', 'Both populations had the same exposure to researchers and animal care staff. The replay illustrates that control, not the birds’ measured behavior.']
    };
    function show(key,announce=true){
      if(!Object.hasOwn(notes,key))return;
      art.dataset.control=key;
      for(const button of controls)button.setAttribute('aria-pressed',String(button.dataset.aviaryControl===key));
      const [title,note]=notes[key];
      detail.replaceChildren(mk('strong',title),document.createTextNode(' '+note));
      if(announce)say(title+' '+note);
    }
    function phase(key,announce=true){
      art.dataset.routine=key;
      for(const stage of stages){
        if(stage.dataset.aviaryStage===key)stage.setAttribute('aria-current','step');
        else stage.removeAttribute('aria-current');
      }
      const [title,note]=phases[key];
      caption.replaceChildren(mk('strong',title),document.createTextNode(' '+note));
      label.textContent=key==='idle'?'Play caretaker routine':
        reducedMotion?.matches&&key!=='matched'?'Show next step':'Replay caretaker routine';
      if(announce)say(title+' '+note);
    }
    function reset(){
      window.clearTimeout(timer);
      // Snap to the start so Replay works even if pressed during the approach.
      art.classList.add('is-resetting');
      phase('idle',false);
      void art.offsetWidth;
      art.classList.remove('is-resetting');
    }
    for(const button of controls)button.addEventListener('click',()=>{
      reset();
      show(button.dataset.aviaryControl);
    });
    replay.addEventListener('click',()=>{
      if(reducedMotion?.matches&&art.dataset.routine==='approach'){phase('refill');return;}
      if(reducedMotion?.matches&&art.dataset.routine==='refill'){phase('matched');return;}
      reset();
      show('people',false);
      phase('approach');
      if(reducedMotion?.matches)return;
      timer=window.setTimeout(()=>{
        phase('refill');
        timer=window.setTimeout(()=>phase('matched'),1600);
      },1250);
    });
    // Change modes without leaving old animation state or action labels on screen.
    reducedMotion?.addEventListener?.('change',reset);
    return reset;
  }
  const resetAviaryRoutine=wireAviaryScene();
  $('to-aviary').addEventListener('click',()=>go('aviary'));
  $('to-cort').addEventListener('click',()=>go('cort'));
  // Native printing clips text to the textarea's visible rows. Use plain text on paper.
  const printAnswers=[];
  window.addEventListener('beforeprint',()=>{
    for(const [entry,output] of printAnswers)output.textContent=entry.value;
  });
  for(const [id,k,max] of [['field-entry','observation',900],['reason','reason',900],['claim','claim',1600],['limits','limits',1600]]){
    const el=$(id),output=mk('div');
    output.className='ju-print-answer';
    el.after(output);
    printAnswers.push([el,output]);
    el.value=state[k];
    el.addEventListener('blur',()=>{el.scrollTop=0;});
    el.addEventListener('input',()=>{state[k]=cleanText(el.value,max);save();completion();});
  }
  $('field-group').addEventListener('change',e=>{state.fieldGroup=pick(e.target.value,Object.keys(fieldLabels),'foraging');save();draw();});
  $('aviary-group').addEventListener('change',e=>{state.aviaryGroup=pick(e.target.value,Object.keys(aviaryLabels),'female');save();draw();});
  $('prediction').addEventListener('change',e=>{if(!state.revealed){state.prediction=pick(e.target.value,Object.keys(choices),'');save();draw();}});
  $('reveal').addEventListener('click',()=>{
    if(!state.prediction||state.revealed)return;
    resetAviaryRoutine?.();
    state.revealed=true;save();draw();
    $('aviary-results-title').focus();say('Aviary results revealed. The hormone clue is now available.');
  });
  $('filter').value=state.filter;$('fit').checked=state.fit;
  $('filter').addEventListener('change',e=>{state.filter=pick(e.target.value,['all',...Object.keys(sites)],'all');save();cort();say($('cort-status').textContent);});
  $('fit').addEventListener('change',e=>{state.fit=e.target.checked;save();cort();});
  const shared=window.Lab?.identity?.get?.()||{};
  for(const [k,max] of [['name',100],['period',24]]){
    const field=$(k);field.value=state.person[k]??shared[k]??'';
    field.addEventListener('input',()=>{state.person[k]=cleanText(field.value,max);save();});
  }
  function submissionReport(){
    const missing=[];
    if(!state.observation.trim())missing.push('Write a field observation.');
    if(!state.revealed)missing.push('Save an aviary prediction and reveal the results.');
    if(!state.claim.trim())missing.push('Write your explanation using study evidence.');
    if(!state.limits.trim())missing.push('Write a limit or follow-up question.');
    const answer=(id,key)=>({type:'answer',prompt:$(id).labels?.[0]?.textContent?.trim()||id,value:state[key]});
    const responses=[answer('field-entry','observation'),
      {type:'answer',prompt:$('prediction').labels?.[0]?.textContent?.trim()||'Aviary prediction',value:choices[state.prediction]||''},
      answer('reason','reason'),answer('claim','claim'),answer('limits','limits')];
    const sections=[{title:'Field report · your observations and explanation',items:responses}];
    const keyResults=[];
    function dataSection(data,group,label,title){
      const rows=groupRows(data,group);
      const hasSE=rows.some(row=>Number.isFinite(row.se));
      keyResults.push({label,value:rows.map(row=>sites[row.site]+' '+fmt(row.mean)).join(' vs. '),unit:data.unit,note:'Approximate published group means.'});
      return {title,items:[
        {type:'table',title:label,columns:['Population','Mean ('+data.unit+')',...(hasSE?[errName(data)]:[]),'Birds (n)'],
          rows:rows.map(row=>hasSE?rowData(row):[sites[row.site],fmt(row.mean),row.n??'Not reported'])},
        {type:'text',text:data.note},{type:'text',text:data.source+': '+data.url}
      ]};
    }
    sections.push(dataSection(D.field,state.fieldGroup,fieldLabels[state.fieldGroup],'Field distance · published evidence'));
    if(state.revealed){
      sections.push(dataSection(D.aviary,state.aviaryGroup,aviaryLabels[state.aviaryGroup],'Shared aviary · published evidence'));
      const d=D.cort, rows=points.filter(p=>!identified||state.filter==='all'||p.site===state.filter), r=corr(rows);
      const items=[
        {type:'text',text:d.note},
        {type:'text',text:'CORT and exploration can be related without CORT causing the behavior. The shared aviary does not prove that a difference was inherited.'}
      ];
      if(d.published)items.push({type:'text',text:d.published.note+' Published model: n = '+d.published.n+', R² = '+d.published.rSquared+', P = '+d.published.p+'.'});
      if(rows.length){
        if(Number.isFinite(r))items.push({type:'text',text:'Selected classroom points: n = '+rows.length+', correlation r = '+fmt(r)+'. This is not the published model result.'});
        items.push({type:'table',title:'Classroom points approximated from the published figure',
          columns:[...(identified?['Population']:[]),d.xLabel||'CORT','Individual exploration score (PC1)'],
          rows:rows.map(row=>[...(identified?[sites[row.site]||'Not identified']:[]),fmt(row.x),fmt(row.y)])});
      }
      items.push({type:'text',text:d.source+': '+d.url});
      sections.push({title:'Hormone and exploration clue · published evidence',items});
    }
    if(state.sim?.results?.length&&window.JuncoFlight?.distance)sections.push({title:'Optional walk-up trials · simulated, not published observations',items:[
      {type:'table',title:'Completed virtual observations',columns:['Trial','Population','Context','Distance at takeoff (m)'],
        rows:state.sim.results.map(row=>[row.id,sites[row.site],fieldLabels[row.group],window.JuncoFlight.distance(row.group,row.step)])},
      {type:'text',text:'Virtual individual trials are illustrative and are not part of the published sample.'}
    ]});
    return {title:'Junco Investigation',unit:'OpenSciEd Biology B.4 · Lesson 4',source:'Independent OpenSciEd companion by Robert Smitka. Published evidence from Atwell et al. (2012) is separate from optional simulated trials.',
      status:invalid||!session?.check(key)?.ok?'recovery':missing.length?'draft':'final',missing,
      student:{name:$('name').value.trim(),period:$('period').value.trim()},keyResults,sections};
  }
  function download(){
    const view=identified?sites[state.filter]||'Both populations':'All plotted birds';
    const body=['Junco Investigation — Field report','Name: '+$('name').value.trim(),'Class period: '+$('period').value.trim(),'','PUBLISHED STUDY EVIDENCE',...evidenceLines(),
      '', 'My observation: '+state.observation,'My prediction: '+(choices[state.prediction]||'Not recorded'),'My reasoning: '+state.reason,
      '', 'Hormone graph: '+view,$('cort-status').textContent,'','My explanation:',state.claim,'','Limits or next question:',state.limits,'',
      ...(window.JuncoFlight?.report(state.sim)??[]),
      ...[D.field,D.aviary,D.cort].map(d=>d.source+' — '+d.url)].join('\n')+'\n';
    const a=mk('a'),url=URL.createObjectURL(new Blob([body],{type:'text/plain;charset=utf-8'}));
    a.href=url;a.download='junco-field-report.txt';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);say('Field report downloaded.');
  }
  $('download').addEventListener('click',download);
  $('download-tab').addEventListener('click',download);
  const dataSources=$('source-data');
  [D.field,D.aviary,D.cort].forEach((d,i)=>{
    if(!d.url)return;
    const a=mk('a',d.source||['Field data','Aviary data','CORT data'][i]);
    a.href=d.url;if(i)dataSources.append(' · ');dataSources.append(a);
  });
  if(window.JuncoFlight)window.JuncoFlight.mount({state,field:D.field.rows,save,say});
  const requested=location.hash.slice(1);
  if(steps.includes(requested)&&(requested!=='cort'||state.revealed))state.step=requested;
  draw();
  if(requested==='cort'&&!state.revealed)say('Make a prediction and reveal the aviary results before opening the hormone clue.');
  if(invalid)notSaved('unreadable');
  const monitorSave=()=>{
    const result=session?.check(key);
    if(!result?.ok) notSaved(result?.reason);
  };
  window.addEventListener('storage',event=>{
    if(!event.key||event.key===key||(guard&&[guard.globalKey,guard.scopeKey(scope),guard.resetKey(key)].includes(event.key))) monitorSave();
  });
  window.addEventListener('pageshow',monitorSave);
  monitorSave();
  window.OpenSciEdSubmission?.mount({target:"#ju-submission-report",collect:submissionReport,filename:"junco-field-report"});
})();
