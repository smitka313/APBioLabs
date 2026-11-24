/* Student-facing record of the Lesson 3 model. The engine owns every count and pairing. */
(() => {
  'use strict';
  const M=window.RatGenerationsLogic, B=window.RatCrossBuilder, $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const KEY='aplab:openscied:b4-rat-generations:v1', STEPS=['predict','model','analyze','explain'];
  const PRED={increase:'Increase',same:'Stay about the same',decrease:'Decrease'};
  const METRICS={population:'Population size',carrier:'% showing resistance',allele:'% of allele copies that are R'};
  const TOKEN='assets/rat-generations-token.svg', SVG='http://www.w3.org/2000/svg';
  const $answer=$$('[data-rg-answer]'), fields={name:100,period:24};
  const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
  const svg=(tag,attrs={})=>{const n=document.createElementNS(SVG,tag);for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,String(v));return n;};
  const set=(id,text)=>{const el=$('#rg-'+id);if(el)el.textContent=text;};
  const announce=(text,quiet=false)=>{const live=$('#rg-status');live.classList.toggle('sr-only',quiet);live.textContent=text;};
  if (!M||!B){announce('The model did not load. Please reload this page.');return;}
  const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
  const tidy=(value,n)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,n):'';
  const freshSeed=()=>{try{return window.crypto.getRandomValues(new Uint32Array(1))[0];}catch(_){return (Date.now()+Math.random()*0x100000000)>>>0;}};
  const trialId=seed=>'RG-'+seed.toString(16).toUpperCase().padStart(8,'0');
  const percent=(n,d)=>d?new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(100*n/d)+'%':'Not defined';
  const fraction=(n,d)=>d?n+' / '+d+' ('+percent(n,d)+')':'Not defined';
  const selectionName={born:'Born',survived:'Survived'};
  const newRecord=()=>({v:1,seed:freshSeed(),step:'predict',action:0,lastVisitedAt:0,prediction:'',answers:{},person:{},metric:'population',analysisChecked:false,analysisAttempt:'',crosses:{},activePair:''});
  const scope='b4-rat-generations', guard=window.OpenSciEdSaveSession;
  let session;
  try {session=guard?.open(window.localStorage,scope,[KEY]);} catch (_) {}
  const sharedReportIdentity=guard?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.() ?? null) ?? (()=>null);
  let state=newRecord(), model, invalid=false, writeBlocked=false, viewAction=null, activePair='', warned='';
  function decode(raw) {
    const s=JSON.parse(raw);
    const trial=s&&M.restore({v:s.v,seed:s.seed,step:s.action});
    if (!trial || (s.prediction!==''&&!own(PRED,s.prediction)) || s.action>0&&!s.prediction ||
      !s.answers||typeof s.answers!=='object'||Array.isArray(s.answers)) throw Error('Unrecognized record');
    const safe={...newRecord(),seed:s.seed,action:s.action,prediction:s.prediction};
    safe.step=STEPS.includes(s.step)?s.step:'predict';
    safe.lastVisitedAt=Number.isFinite(s.lastVisitedAt)?s.lastVisitedAt:0;
    for (const el of $answer) if (typeof s.answers[el.dataset.rgAnswer]==='string') safe.answers[el.dataset.rgAnswer]=s.answers[el.dataset.rgAnswer].slice(0,2400);
    for (const [key,n] of Object.entries(fields)) if(typeof s.person?.[key]==='string')safe.person[key]=tidy(s.person[key],n);
    if(own(METRICS,s.metric))safe.metric=s.metric;
    safe.analysisChecked=s.analysisChecked===true&&trial.done;
    if(trial.done)safe.analysisAttempt=safe.analysisChecked?'alleles':
      ['rats','r','alleles'].includes(s.analysisAttempt)?s.analysisAttempt:'';
    safe.crosses=B.cleanMap(s.crosses);
    if(typeof s.activePair==='string'&&/^g[2-5]-pair[1-9][0-9]?$/.test(s.activePair))safe.activePair=s.activePair;
    return safe;
  }
  try {
    const raw=session?.read(KEY) ?? null;
    if(raw!==null)try{state=decode(raw);}catch(_){invalid=true;}
  } catch(_){writeBlocked=true;}
  model=M.restore({v:1,seed:state.seed,step:state.action});
  function notSaved(reason) {
    writeBlocked=true;
    const text=reason==='changed' ? 'A newer copy of this activity was saved in another tab. This tab will not overwrite it.' :
      reason==='erased' ? 'Saved work was cleared on this device. This tab will not bring it back.' :
      'This browser could not save the work in this tab.';
    const message=text+' Download a copy before closing this tab.';
    $('#rg-save-warning').hidden=false;set('save-warning-text',message);
    set('save','Not saved · download a copy');
    if(warned!==message) {warned=message;announce(message);}
    return false;
  }
  function saved() {
    invalid=false;writeBlocked=false;warned='';
    sharedReportIdentity();
    $('#rg-save-warning').hidden=true;set('save','Work saved on this device.');
    return true;
  }
  function save() {
    state.lastVisitedAt=Date.now();
    if(invalid){set('save','An older record is preserved. Download this trial before leaving.');return false;}
    const result=session?.write(KEY,JSON.stringify(state));
    return result?.ok ? saved() : notSaved(result?.reason);
  }
  function available(step) {
    return step==='predict'||(step==='model'&&!!state.prediction)||(['analyze','explain'].includes(step)&&model.done);
  }
  function go(step,{focus=true,persist=true}={}) {
    if(!available(step))return;
    if(step!==state.step)announce('');
    state.step=step;
    for(const section of $$('[data-rg-step]'))section.hidden=section.dataset.rgStep!==step;
    gates();
    if(location.hash!=='#'+step)history.replaceState(null,'','#'+step);
    if(persist)save();
    if(focus){$('#rg-'+step+'-title').focus({preventScroll:true});$('#rg-'+step).scrollIntoView({block:'start'});}
  }
  function gates() {
    const done={predict:!!state.prediction,model:model.done,analyze:state.analysisChecked,
      explain:['claim','evidence','limits'].every(key=>state.answers[key]?.trim())};
    $('#rg-step-hint').hidden=model.done;
    set('step-hint',state.prediction?'Finish the colony model to unlock Analyze and Explain.':'Save your prediction to unlock the colony model.');
    for(const b of $$('[data-rg-go]')) {
      const wanted=b.dataset.rgGo;
      b.disabled=!available(wanted);
      if(b.closest('.rg-steps')){
        if(wanted===state.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
        b.toggleAttribute('data-ose-complete',Boolean(done[wanted]));
        if(done[wanted])b.setAttribute('aria-description','Complete');
        else if(b.disabled)b.setAttribute('aria-description',wanted==='model'?'Save your prediction first.':'Finish the colony model first.');
        else b.removeAttribute('aria-description');
      }
    }
  }
  function snapshots(s=model) {
    return s.generations.flatMap(g=>[
      {generation:g.generation,phase:'born',counts:g.counts,born:g.counts.total,pairs:g.pairs},
      ...(g.survivorCounts?[{generation:g.generation,phase:'survived',counts:g.survivorCounts,born:g.counts.total,pairs:g.pairs}]:[])
    ]);
  }
  function button(text,onClick,attrs={},cls='') {
    const b=node('button',text,cls);b.type='button';
    for(const [key,value] of Object.entries(attrs))b.setAttribute(key,value);
    b.addEventListener('click',onClick);return b;
  }
  function colony(host,counts) {
    const group=node('div','','rg-colony');
    for(const label of M.GENOTYPES){
      const n=counts[label], card=node('div','','rg-genotype');
      card.dataset.rgGenotype=label;
      const h=node('header'), count=node('b',String(n));count.dataset.rgCount=label;
      h.append(node('span',label),count);
      const tokens=node('div','','rg-tokens');tokens.setAttribute('aria-hidden','true');
      for(let i=0;i<Math.min(n,8);i++){
        const icon=node('img');icon.src=TOKEN;icon.alt='';icon.width=29;icon.height=24;tokens.append(icon);
      }
      if(n>8)tokens.append(node('span','+'+(n-8),'rg-excess'));
      if(n===0)tokens.append(node('span','None','rg-excess'));
      card.append(h,node('small',label==='BB'?'Not resistant':'Resistant'),tokens);
      group.append(card);
    }
    host.replaceChildren(group);
  }
  function needsCross(){
    if(viewAction!==null||M.preview(model)?.action!=='breed')return false;
    const assigned=M.step(model).generations.at(-1).pairs;
    return assigned.length>0&&!assigned.some(pair=>B.complete(state.crosses[pair.id]));
  }
  function crossGate(){
    const gated=needsCross();
    const next=$('#rg-next'), near=$('#rg-produce');
    next.disabled=gated;
    near.hidden=viewAction!==null||M.preview(model)?.action!=='breed';
    near.disabled=gated;
    near.textContent=next.textContent;
    set('produce-hint',!near.hidden&&gated?'Build one square above to unlock this action.':'');
    $('#rg-cross-gate').hidden=!gated;
    $('#rg-cross-jump').hidden=!gated;
    set('cross-gate',gated?'Build one Punnett square for this generation to unlock Produce. Choose any assigned pair.':'');
  }
  let burrow, nextMotion=false;
  function drawBurrow(record,row,pair,workbench,showMotion){
    const host=$('#rg-burrow'), api=window.RatBurrow;
    if(!host||!api?.mount)return;
    const assigned=workbench?pair:null, progress=assigned?state.crosses[assigned.id]:null;
    const selection=row.survivorCounts?{born:row.born,survivors:row.survivors}:null;
    const opts={rats:selection?row.survivors:row.born,pair:assigned,progress,
      onParent:(role,ratId)=>workbench?.placeParent?.(role,ratId)===true,canMove:!!assigned,
      announce:message=>announce(message,true),
      phase:record.generation===1?'start':record.phase,counts:record.counts,selection,animate:showMotion};
    if(burrow)burrow.update(opts);else burrow=api.mount(host,opts);
    const helper=assigned?'Drag the two numbered rats into their matching nest spots. You can also select a rat and then its spot.':
      selection?'Compare the earlier colony and the rats that survived this model step.':
      record.generation===1?'The colony starts with four rats. Look for the selected pair.':
      'The nursery shows the offspring in this snapshot. Use the timeline to review earlier groups.';
    set('burrow-help',helper);
    $('#rg-workbench-link').hidden=!pair;
  }
  function pairs(record,past,row,showMotion) {
    let crossList=record.pairs, future=false, target=record.generation;
    const next=M.preview(model);
    if(!past&&next?.action==='breed'){
      const forecast=M.step(model).generations.at(-1);
      crossList=forecast.pairs;target=forecast.generation;future=true;
    }
    const host=$('#rg-pairs'), box=$('#rg-punnett');host.replaceChildren();box.replaceChildren();
    if(!crossList.length){host.append(node('p','No pairings have been recorded for this snapshot.'));drawBurrow(record,row,null,null,showMotion);return;}
    host.append(node('p',future?'Pairs ready to produce Generation '+target+'.':'Pairs that produced Generation '+target+'.'));
    const register=node('div','','rg-pair-list');host.append(register);
    const requested=past?activePair:state.activePair;
    const focusId=crossList.some(p=>p.id===requested)?requested:crossList[0].id;
    for(const [i,p] of crossList.entries()) {
      const b=button('Pair '+(i+1)+' · '+p.parents.map(parent=>parent.genotype).join(' × '),()=>{
        activePair=p.id;if(!past){state.activePair=p.id;save();}show(p);for(const other of register.children)other.setAttribute('aria-pressed',String(other===b));
      },{'data-rg-pair':p.id,'aria-pressed':String(p.id===focusId)},'rg-pair');
      register.append(b);
    }
    function show(p) {
      if(future){
        const workbench=B.mount(box,{
          pair:p,progress:state.crosses[p.id],required:needsCross(),tokenUrl:TOKEN,
          announce:message=>announce(message,true),
          onChange:progress=>{state.crosses[p.id]=progress;state.activePair=p.id;save();crossGate();drawBurrow(record,row,p,workbench,false);}
        });
        drawBurrow(record,row,p,workbench,showMotion);
        showMotion=false;
        if(crossList.some(pair=>pair.reused))box.append(node('p','The parent group was odd, so one parent is used in two pairings.','rg-muted'));
        return;
      }
      const [first,second]=p.parents.map(parent=>parent.genotype);
      const grid=node('div','','rg-cross');grid.setAttribute('role','img');
      grid.setAttribute('aria-label',first+' crossed with '+second+'. Expected offspring: '+p.cells.join(', ')+'.');
      for(const [i,label] of ['×',...second,first[0],p.cells[0],p.cells[1],first[1],p.cells[2],p.cells[3]].entries()){
        const cell=node('span',label);cell.setAttribute('aria-hidden','true');
        if([4,5,7,8].includes(i))cell.dataset.rgCell=label;
        grid.append(cell);
      }
      box.replaceChildren(node('p',first+' × '+second+' · one expected offspring per box'),grid);
      drawBurrow(record,row,p,null,showMotion);showMotion=false;
      if(crossList.some(pair=>pair.reused))box.append(node('p','The parent group was odd, so one parent is used in two pairings.','rg-muted'));
    }
    show(crossList.find(p=>p.id===focusId));
  }
  function renderModel() {
    const chosen=viewAction??state.action;
    const view=chosen===state.action?model:M.restore({v:1,seed:state.seed,step:chosen});
    const events=snapshots(view), entry=events.at(-1), row=view.generations.at(-1);
    const next=M.preview(model), previous=M.STEPS[chosen-1];
    set('trial-id','Dataset ID: '+trialId(state.seed));
    const steps=$('#rg-timeline');steps.replaceChildren();
    const labels=['G1 start','G2 born','G3 born','G3 survived','G4 born','G4 survived','G5 born'];
    for(const [i,label] of labels.entries()){
      const b=button(label,()=>{
        viewAction=i===state.action?null:i;activePair='';renderModel();
        $('#rg-timeline [data-rg-snapshot="'+i+'"]')?.focus({preventScroll:true});
      },{'data-rg-snapshot':i,'aria-pressed':String(chosen===i)});
      b.disabled=i>state.action;steps.append(b);
    }
    const event=$('#rg-events');
    event.dataset.rgAction=chosen;event.dataset.rgGeneration=entry.generation;event.dataset.rgPhase=entry.phase;
    set('event-stage','Generation '+entry.generation+' · '+(entry.phase==='survived'?'After selection':entry.generation===1?'Starting colony':entry.generation===5?'Final birth record':'Birth record'));
    let title, why;
    if(!previous){title='Four rats start the trial';why='One rat is RB. No selection pressure is applied while you produce Generations 2 and 3.';}
    else if(previous.action==='select'){
      title='Selection changed which rats survived';
      const n=entry.counts.total;
      why=n+' of '+entry.born+' survived. In this model, only RR and RB survive this selection step, so those rats can parent the next generation.';
    }else{
      title='Generation '+entry.generation+' offspring recorded';
      why=entry.counts.total+' offspring replaced the parent generation. Each pair contributed four expected offspring.';
      if(entry.generation===3)why+=' This is the last count before selection begins.';
      if(entry.generation===5)why+=' This final record is offspring, not an additional survivor count.';
    }
    set('event-title',title);set('event-explanation',why);
    set('colony-title','Generation '+entry.generation+' · '+(entry.generation===1?'Start':selectionName[entry.phase]));
    colony($('#rg-colony'),entry.counts);
    const pressure=$('#rg-selection-record');
    if(row.survivorCounts){
      const n=row.survivorCounts.total;
      pressure.replaceChildren(node('p','Survival: '+fraction(n,row.counts.total)+'. The original '+row.counts.total+' births remain in the evidence table.','rg-selection-note'));
    }else pressure.replaceChildren();
    const action=$('#rg-next');
    action.hidden=chosen===state.action&&model.done;
    action.textContent=chosen!==state.action?'Back to current snapshot':next?.action==='select'?'Apply modeled selection to Generation '+next.generation:next?.title||'';
    $('#rg-model-analyze').hidden=chosen!==state.action||!model.done;
    const animate=nextMotion;nextMotion=false;
    pairs(entry,chosen!==state.action,row,animate);crossGate();
  }
  function metricVal(row,key){
    const c=row.counts;return key==='population'?c.total:key==='carrier'?c.carrierFraction:c.redAlleleFraction;
  }
  function table(host,rows){
    const t=node('table','','rg-data-table');
    t.createCaption().textContent='Your model snapshots · simulated';
    const columns=['Group','RR','RB','BB','Rats','% resistant','% R copies','Survival'];
    const h=t.createTHead().insertRow();
    columns.forEach(label=>{const th=node('th',label);th.scope='col';h.append(th);});
    const body=t.createTBody();
    for(const {generation,phase,counts:c,born} of rows){
      const tr=body.insertRow();tr.dataset.rgGeneration=generation;tr.dataset.rgPhase=phase;
      const label=node('th','G'+generation+' '+(generation===1?'start':selectionName[phase].toLowerCase()));label.scope='row';tr.append(label);
      for(const key of M.GENOTYPES){const cell=node('td',String(c[key]));cell.dataset.rgCount=key;tr.append(cell);}
      for(const [key,text] of [['population',String(c.total)],['carrier',fraction(c.carriers,c.total)],['allele',fraction(c.redAlleles,c.total*2)],['survival',phase==='survived'?fraction(c.total,born):'Not applied']]){
        const cell=node('td',text);cell.dataset.rgMeasure=key;tr.append(cell);
      }
    }
    host.replaceChildren(t);
  }
  let chartView, chartLabels, chartRows;
  function chart(rows){
    const host=$('#rg-chart'), metrics=$('#rg-metrics');
    if(!metrics.children.length) for(const [key,title] of Object.entries(METRICS)){
      metrics.append(button(title,()=>{state.metric=key;chart(rows);save();},{'data-rg-metric':key,'aria-pressed':'false'}));
    }
    for(const b of metrics.children)b.setAttribute('aria-pressed',String(b.dataset.rgMetric===state.metric));
    const k=state.metric,n=k==='population';
    const labels=rows.map(r=>'G'+r.generation+(r.phase==='survived'?' S':''));
    if(window.Lab?.chart){
      let graph=host.querySelector('.rg-shared-chart');
      const decorate=()=>{
        const plot=graph.querySelector('svg');
        if(!plot)return;
        plot.setAttribute('aria-label',chartLabels);
        [...plot.querySelectorAll('rect > title')].forEach((label,i)=>{
          if(chartRows[i])label.parentElement.classList.add('rg-chart-'+chartRows[i].phase);
        });
      };
      if(!graph){
        graph=node('div','','rg-shared-chart');
        host.append(graph,node('p','Solid bars: start or births. Outlined bars (S): after selection.','rg-plot-key'));
        if(window.MutationObserver)new MutationObserver(decorate).observe(graph,{childList:true});
      }
      chartRows=rows;
      chartLabels=METRICS[k]+' by model snapshot. '+rows.map((r,i)=>labels[i]+': '+(n?metricVal(r,k):percent(metricVal(r,k)??0,1))).join('; ');
      const options={type:'bar',responsive:true,height:282,xLabel:'Generation snapshot',
        yLabel:n?'Number of rats':k==='carrier'?'Rats showing resistance (%)':'R allele copies (%)',
        categories:labels,yMin:0,yMax:n?Math.max(4,Math.ceil(Math.max(...rows.map(r=>r.counts.total))/4)*4):100,
        series:[{color:'var(--accent)',points:rows.map((r,i)=>({x:labels[i],y:(n?1:100)*(metricVal(r,k)??0)}))}]};
      if(chartView)chartView.update(options);else chartView=window.Lab.chart(graph,options);
      decorate();return;
    }
    const max=n?Math.max(4,Math.ceil(Math.max(...rows.map(r=>r.counts.total))/4)*4):1;
    const left=42,top=12,bottom=151,right=416;
    const p=rows.map((r,i)=>[left+(right-left)*i/Math.max(1,rows.length-1),bottom-(bottom-top)*(metricVal(r,k)??0)/max]);
    const g=svg('svg',{viewBox:'0 0 430 179',role:'img','aria-label':METRICS[k]+' by model snapshot. '+rows.map((r,i)=>labels[i]+': '+(n?metricVal(r,k):percent(metricVal(r,k)??0,1))).join('; '),class:'rg-chart-canvas'});
    for(let i=0;i<=4;i++){
      const y=bottom-(bottom-top)*i/4;
      const label=svg('text',{x:left-6,y:y+4,'text-anchor':'end',class:'rg-chart-label'});
      label.textContent=n?String(max*i/4):String(i*25)+'%';
      g.append(svg('line',{x1:left,x2:right,y1:y,y2:y,class:'rg-chart-axis'}),label);
    }
    for(const [i,[x,y]] of p.entries()){
      if(i>0)g.append(svg('line',{x1:p[i-1][0],y1:p[i-1][1],x2:x,y2:y,class:'rg-chart-line'+(rows[i].phase==='survived'?' rg-chart-selection':'')}));
    }
    for(const [i,[x,y]] of p.entries()){
      const point=rows[i].phase==='survived'?svg('rect',{x:x-4,y:y-4,width:8,height:8,class:'rg-chart-survived'}):svg('circle',{cx:x,cy:y,r:4.2,class:'rg-chart-born'});
      const label=svg('text',{x,y:170,'text-anchor':'middle',class:'rg-chart-label'});
      label.textContent=labels[i];g.append(point,label);
    }
    host.replaceChildren(g,node('p','● Start or births · □ S = after selection','rg-plot-key'));
  }
  function evidence(){
    if(!model.done)return;
    const rows=snapshots();
    table($('#rg-analysis-table'),rows);table($('#rg-evidence-table'),rows);chart(rows);
    const last=rows.at(-1), third=rows.find(r=>r.generation===3&&r.phase==='born'), surv=rows.find(r=>r.generation===3&&r.phase==='survived');
    const list=node('ul','','rg-evidence-list');
    for(const r of [third,surv,last])list.append(node('li','G'+r.generation+' '+selectionName[r.phase].toLowerCase()+': '+r.counts.total+' rats; '+fraction(r.counts.carriers,r.counts.total)+' show resistance.'));
    $('#rg-evidence-summary').replaceChildren(list);
  }
  function render(){
    gates();renderModel();evidence();
  }
  function advance() {
    if(viewAction!==null){viewAction=null;activePair='';renderModel();$('#rg-next').focus({preventScroll:true});return;}
    if(model.done||!state.prediction||needsCross())return;
    model=M.step(model);state.action=model.step;activePair='';state.activePair='';nextMotion=true;save();render();
    announce($('#rg-event-title').textContent+'. '+$('#rg-event-explanation').textContent,true);
    if(model.done)$('#rg-model-analyze').focus({preventScroll:true});
  }
  const person=()=>({...sharedReportIdentity(),...state.person});
  function fill() {
    for(const r of $$('input[name=rg-prediction]'))r.checked=r.value===state.prediction;
    for(const f of $answer)f.value=state.answers[f.dataset.rgAnswer]||'';
    fillPerson();
  }
  function fillPerson(){
    const labels=person();for(const key of Object.keys(fields))$('#rg-'+key).value=labels[key]||'';
  }
  function submissionReport(){
    const missing=[];
    if(!state.prediction)missing.push('Save a prediction.');
    if(!model.done)missing.push('Finish the colony model through Generation 5.');
    if(!state.analysisAttempt)missing.push('Try the Analyze quick check.');
    for(const [id,label] of [['claim','claim'],['evidence','evidence response'],['limits','model limits response']])
      if(!state.answers[id]?.trim())missing.push('Write your '+label+'.');

    const quickSelection=state.analysisAttempt &&
      $('input[name="rg-concept"][value="'+state.analysisAttempt+'"]')?.labels?.[0]?.textContent?.trim();
    const sections=[{title:'Prediction, analysis, and explanation',items:[
      {type:'answer',prompt:$('#rg-prediction legend')?.textContent?.trim()||'Prediction',value:PRED[state.prediction]||''},
      ...$answer.map(f=>({type:'answer',prompt:f.labels?.[0]?.textContent?.trim()||f.dataset.rgAnswer,value:state.answers[f.dataset.rgAnswer]||''})),
      {type:'answer',prompt:$('#rg-check legend')?.textContent?.trim()||'Analyze quick check · selected denominator',value:quickSelection||''}
    ]}];
    const keyResults=[], simItems=[{type:'text',text:'These are modeled colony snapshots, not measured animal outcomes. R is the red resistance allele, and the model treats RR and RB as resistant and BB as not resistant. Each rat carries two allele copies.'}];
    const records=snapshots();
    if(state.action){
      const rows=records.map(({generation,phase,counts:c,born})=>[
        generation+' · '+selectionName[phase],'RR '+c.RR+' / RB '+c.RB+' / BB '+c.BB,c.total,fraction(c.carriers,c.total),fraction(c.redAlleles,c.total*2),phase==='survived'?fraction(c.total,born):'Not applicable'
      ]);
      const first=records[0], last=records.at(-1);
      for(const [label,rec] of [['Starting R-allele frequency',first],['Latest R-allele frequency · G'+last.generation+' '+selectionName[last.phase],last]])
        keyResults.push({label,value:fraction(rec.counts.redAlleles,rec.counts.total*2),note:'R copies / total allele copies in this simulated snapshot.'});
      simItems.push({type:'table',title:'Generation record',columns:['Generation and stage','Genotype counts','Total rats','Resistant / total','R copies / total copies','Survived / born'],rows});
    } else simItems.push({type:'text',text:'No model actions recorded yet.'});

    const preview=M.preview(model)?.action==='breed'?M.step(model).generations.at(-1):null;
    const generations=preview?[...model.generations,preview]:model.generations;
    const crosses=[], inProgress=[];
    for(const g of generations)for(const pair of g.pairs||[]){
      const cross=state.crosses[pair.id];
      if(B.complete(cross))crosses.push([g.generation,pair.id,pair.parents.map(rat=>rat.genotype).join(' × '),pair.cells.join(', ')]);
      else if(cross) {
        const placed=[...cross.parents,...cross.headers,...cross.cells.flat()].filter(Boolean).length;
        if(placed)inProgress.push([g.generation,pair.id,placed+' of 14 placements']);
      }
    }
    if(crosses.length)simItems.push({type:'table',title:'Punnett squares you built · expected model outcomes',columns:['Generation produced','Pair','Parent genotypes','Four cells'],rows:crosses});
    else simItems.push({type:'text',text:'No completed Punnett square recorded yet.'});
    if(inProgress.length)simItems.push({type:'table',title:'Partially built Punnett squares',columns:['Generation produced','Pair','Recorded work'],rows:inProgress});
    sections.push({title:'Rat colony evidence · simulated',items:simItems});
    const {name,period}=person();
    return {title:'Rat Generations',unit:'OpenSciEd Biology B.4 · Lesson 3',source:'Independent OpenSciEd companion by Robert Smitka. Generations and outcomes come from a simplified model.',
      status:invalid||!session?.check(KEY)?.ok?'recovery':missing.length?'draft':'final',missing,student:{name:name||'',period:period||''},datasetId:trialId(state.seed),keyResults,sections};
  }
  function report(){
    const p=person(), lines=['RAT GENERATIONS · SIMULATED MODEL','OpenSciEd Biology B.4 Lesson 3 companion · Robert Smitka','',
      'Name: '+(p.name||''),'Class period: '+(p.period||''),'Dataset ID: '+trialId(state.seed),'Prediction: '+(PRED[state.prediction]||'Not recorded'),
      '','GENERATION RECORD'];
    for(const {generation,phase,counts:c,born} of snapshots())lines.push(
      'G'+generation+' '+selectionName[phase]+': RR '+c.RR+', RB '+c.RB+', BB '+c.BB+'; '+c.total+' rats; '+
      fraction(c.carriers,c.total)+' showing resistance; '+fraction(c.redAlleles,c.total*2)+' R allele copies'+
      (phase==='survived'?'; survival '+fraction(c.total,born):'')+'.');
    lines.push('','MY RESPONSES');
    for(const f of $answer)lines.push(f.labels?.[0]?.textContent?.trim()||f.dataset.rgAnswer,state.answers[f.dataset.rgAnswer]||'[No response yet]','');
    lines.push('This model does not supply measured animal outcomes or predict a real population.');
    return lines.join('\n');
  }
  function copy(failed=false){
    const dlg=$('#rg-copy-dialog'), out=$('#rg-copy-text');out.value=report();
    set('copy-hint',(failed?'The download did not start. ':'')+'Select the text and use Copy on your device.');
    if(!dlg.open)dlg.showModal();out.focus();out.select();
  }
  function download(){
    try{
      const url=URL.createObjectURL(new Blob([report()],{type:'text/plain;charset=utf-8'})), a=node('a');
      a.href=url;a.download='rat-generations-investigation.txt';document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);announce('Download requested. If no file appears, choose Copy investigation.');
    }catch(_){copy(true);}
  }
  for(const b of $$('[data-rg-go]'))b.addEventListener('click',()=>go(b.dataset.rgGo));
  $('#rg-prediction').addEventListener('submit',ev=>{
    ev.preventDefault();const choice=$('input[name=rg-prediction]:checked')?.value;
    if(own(PRED,choice)){state.prediction=choice;go('model');}
  });
  // Native printing clips text to the textarea's visible rows. Use plain text on paper.
  const printAnswers = [];
  window.addEventListener('beforeprint',()=>{
    fillPerson();
    for(const [entry,output] of printAnswers)output.textContent=entry.value;
  });
  for(const entry of $answer){
    const output=node('div','','rg-print-answer');
    entry.after(output);
    printAnswers.push([entry,output]);
    entry.addEventListener('input',()=>{state.answers[entry.dataset.rgAnswer]=entry.value.slice(0,2400);save();gates();});
    entry.addEventListener('blur',()=>{entry.scrollTop=0;});
    // The browser can leave the top of the text scrolled after placing the caret at
    // the start. Keep the full first line and its padding visible on this shortcut.
    entry.addEventListener('keyup',event=>{
      const start=(event.key==='Home'&&(event.ctrlKey||event.metaKey))||
        (event.key==='ArrowUp'&&event.metaKey);
      if(start&&!event.altKey&&!event.shiftKey&&entry.selectionStart===0&&entry.selectionEnd===0)entry.scrollTop=0;
    });
  }
  for(const [key,limit] of Object.entries(fields))$('#rg-'+key).addEventListener('input',e=>{state.person[key]=tidy(e.currentTarget.value,limit);save();});
  $('#rg-next').addEventListener('click',advance);
  $('#rg-produce').addEventListener('click',()=>{advance();$('#rg-event-title').focus({preventScroll:true});});
  if(state.analysisChecked){
    $('input[name=rg-concept][value=alleles]').checked=true;
    set('check-feedback','Complete. The denominator counts every allele copy, two per rat.');
  }
  $('#rg-check').addEventListener('submit',e=>{
    e.preventDefault();
    const selected=$('input[name=rg-concept]:checked')?.value;
    const msg=selected==='alleles'?'Right. The denominator counts every allele copy of this gene, two per rat.':
      selected==='rats'?'Not quite. The number of rats is the denominator for the fraction showing resistance. For allele frequency, count two copies per rat.':
      selected==='r'?'Not quite. R copies are the numerator. The denominator counts both R and B copies.':'Choose a denominator first.';
    if(selected)state.analysisAttempt=selected;
    state.analysisChecked=selected==='alleles';save();gates();
    set('check-feedback',msg);announce(msg,true);
  });
  $('#rg-download').addEventListener('click',download);$('#rg-download-tab').addEventListener('click',download);$('#rg-copy').addEventListener('click',()=>copy());
  $('#rg-copy-select').addEventListener('click',async()=>{
    const field=$('#rg-copy-text');field.focus();field.select();
    try {await navigator.clipboard.writeText(field.value);set('copy-hint','Copied.');}
    catch (_){set('copy-hint','Selected. Use Copy on your device.');}
  });
  for(const b of $$('[data-rg-close]'))b.addEventListener('click',()=>b.closest('dialog').close());
  $('#rg-reset').addEventListener('click',()=>$('#rg-reset-dialog').showModal());
  $('#rg-confirm-reset').addEventListener('click',()=>{
    const next={...newRecord(),lastVisitedAt:Date.now()},result=session?.reset(KEY,JSON.stringify(next));
    if(!result?.ok) {$('#rg-reset-dialog').close();return notSaved(result?.reason);}
    state=next;model=M.create(state.seed);viewAction=null;activePair='';set('check-feedback','');
    for(const name of ['analysis-table','evidence-table','evidence-summary','metrics'])$('#rg-'+name).replaceChildren();
    for(const r of $$('input[name=rg-concept]'))r.checked=false;
    fill();render();saved();$('#rg-reset-dialog').close();go('predict',{persist:false});
    if(!writeBlocked)announce('A new trial is ready to start.');
  });
  window.addEventListener('hashchange',()=>{
    const hash=location.hash.slice(1);
    if(STEPS.includes(hash))go(available(hash)?hash:state.step);
  });
  fill();colony($('#rg-start-colony'),M.create(0).generations[0].counts);render();
  const request=location.hash.slice(1);
  go(available(request)?request:available(state.step)?state.step:'predict',{focus:false,persist:false});
  if(invalid)set('save','An older record is preserved. Download this trial before leaving.');
  const monitorSave=()=>{
    const result=session?.check(KEY);
    if(!result?.ok) notSaved(result?.reason);
  };
  window.addEventListener('storage',event=>{
    if(!event.key||event.key===KEY||(guard&&[guard.globalKey,guard.scopeKey(scope),guard.resetKey(KEY)].includes(event.key))) monitorSave();
  });
  window.addEventListener('pageshow',monitorSave);
  monitorSave();
  window.OpenSciEdSubmission?.mount({target:"#rg-submission-report",collect:submissionReport,filename:"rat-generations-investigation"});
})();
