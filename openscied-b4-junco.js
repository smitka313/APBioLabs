/* Lesson 4 companion. This is a study-data explorer, not a simulation. */
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
  const blank=()=>({step:'field',prediction:'',revealed:false,reason:'',observation:'',claim:'',limits:'',fieldGroup:'foraging',aviaryGroup:'female',filter:'all',fit:false,lastVisitedAt:0});
  let state=blank(), canSave=true;
  try{
    const raw=JSON.parse(localStorage.getItem(key) || 'null');
    if(raw && typeof raw==='object'){
      state.prediction=pick(raw.prediction,Object.keys(choices),'');
      state.revealed=raw.revealed===true&&!!state.prediction;
      state.step=pick(raw.step,state.revealed?steps:steps.slice(0,2),'field');
      for(const [k,n] of [['reason',900],['observation',900],['claim',1600],['limits',1600]])state[k]=cleanText(raw[k],n);
      state.fieldGroup=pick(raw.fieldGroup,Object.keys(fieldLabels),'foraging');
      state.aviaryGroup=pick(raw.aviaryGroup,Object.keys(aviaryLabels),'female');
      state.filter=pick(raw.filter,['all',...Object.keys(sites)],'all');
      state.fit=raw.fit===true;
      if(window.JuncoFlight)state.sim=window.JuncoFlight.clean(raw.sim,D.field.rows);
    }
  }catch(e){canSave=false;}
  function save(){
    state.lastVisitedAt=Date.now();
    if(canSave){try{localStorage.setItem(key,JSON.stringify(state));}catch(_){canSave=false;}}
    if(!canSave)$('live').textContent='This browser could not save your notebook. Download a report before you leave.';
  }
  function say(s){if(canSave)$('live').textContent=s;}
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
    graph(kind+'-chart',{type:'bar',categories:Object.values(sites),xLabel:'Population of origin',yLabel:kind==='field'?'Flight distance ('+d.unit+')':'Exploration score',yMin:yMin<0?Math.floor(yMin*1.12*2)/2:0,yMax:Math.ceil(yMax*1.12*2)/2,
      series:[{name:'Population mean',points:rows.map(r=>({x:sites[r.site],y:r.mean,err:Number.isFinite(r.se)?r.se:0}))}]});
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
    const yName=d.yLabel||'Exploration score', xName=d.xLabel||'CORT';
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
  function draw(focus=false){
    for(const step of steps)document.getElementById(step).hidden=step!==state.step;
    for(const btn of nav){
      if(btn.dataset.step===state.step)btn.setAttribute('aria-current','step');
      else btn.removeAttribute('aria-current');
      btn.disabled=btn.dataset.step==='cort'&&!state.revealed;
    }
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
    state.step=step;
    history.replaceState(null,'','#'+step);
    save();draw(focus);return true;
  }
  for(const btn of nav)btn.addEventListener('click',()=>go(btn.dataset.step));
  $('to-aviary').addEventListener('click',()=>go('aviary'));
  $('to-cort').addEventListener('click',()=>go('cort'));
  for(const [id,k,max] of [['field-entry','observation',900],['reason','reason',900],['claim','claim',1600],['limits','limits',1600]]){
    const el=$(id);
    el.value=state[k];
    el.addEventListener('input',()=>{state[k]=cleanText(el.value,max);save();});
  }
  $('field-group').addEventListener('change',e=>{state.fieldGroup=pick(e.target.value,Object.keys(fieldLabels),'foraging');save();draw();});
  $('aviary-group').addEventListener('change',e=>{state.aviaryGroup=pick(e.target.value,Object.keys(aviaryLabels),'female');save();draw();});
  $('prediction').addEventListener('change',e=>{if(!state.revealed){state.prediction=pick(e.target.value,Object.keys(choices),'');save();draw();}});
  $('reveal').addEventListener('click',()=>{
    if(!state.prediction||state.revealed)return;
    state.revealed=true;save();draw();
    $('aviary-results-title').focus();say('Aviary results revealed. The hormone clue is now available.');
  });
  $('filter').value=state.filter;$('fit').checked=state.fit;
  $('filter').addEventListener('change',e=>{state.filter=pick(e.target.value,['all',...Object.keys(sites)],'all');save();cort();say($('cort-status').textContent);});
  $('fit').addEventListener('change',e=>{state.fit=e.target.checked;save();cort();});
  $('download').addEventListener('click',()=>{
    const view=identified?sites[state.filter]||'Both populations':'All plotted birds';
    const body=['Junco Investigation — Field report','Published study evidence, not simulated data.','',...evidenceLines(),
      '', 'My observation: '+state.observation,'My prediction: '+(choices[state.prediction]||'Not recorded'),'My reasoning: '+state.reason,
      '', 'Hormone graph: '+view,$('cort-status').textContent,'','My explanation:',state.claim,'','Limits or next question:',state.limits,'',
      ...(window.JuncoFlight?.report(state.sim)??[]),
      ...[D.field,D.aviary,D.cort].map(d=>d.source+' — '+d.url)].join('\n')+'\n';
    const a=mk('a'),url=URL.createObjectURL(new Blob([body],{type:'text/plain;charset=utf-8'}));
    a.href=url;a.download='junco-field-report.txt';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);say('Field report downloaded.');
  });
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
})();
