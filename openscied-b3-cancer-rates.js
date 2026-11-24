/* Local, source-linked investigation. No student work leaves the device. */
(()=>{
  'use strict';
  const D=window.CancerRatesData,L=window.CancerRatesLogic,KEY='aplab:openscied:b3-cancer-rates:v1';
  const steps=['predict','explore','explain'], views=Object.keys(D), svgNS='http://www.w3.org/2000/svg';
  const $=id=>document.getElementById('cr-'+id), all=selector=>[...document.querySelectorAll(selector)], finite=Number.isFinite;
  const spec={
    types:{title:'Published U.S. cancer rankings',caption:'2021 U.S. Cancer Statistics, from OpenSciEd’s two published Top 10 charts. Female- and male-specific rates use their respective populations. “Not in top 10” does not mean zero.',pair:['breast','lung'],measures:['incidence','mortality']},
    states:{title:'New cancer diagnoses by state',caption:'2019–2023 average annual counts and age-adjusted diagnosis rates. All cancer sites, ages, races and ethnicities, and both sexes.',pair:['CA','KY'],measures:['incidence','count']},
    poverty:{title:'Cancer rates and socioeconomic data',caption:'Each point is a state or D.C. Diagnosis rates are from 2019–2023; poverty and income are Census estimates for 2023. A pattern across states does not establish a cause or describe any individual.',pair:['KY','NM'],measures:['incidence','poverty','income']},
    michigan:{title:'Michigan: screening and diagnosis',caption:'County mammography estimates describe women ages 50–74 who reported a mammogram in the past two years. Cancer rates cover females of all ages. These are different populations, not matched patient records.',pair:['26125','26163'],measures:['late-rate','late-share','screening','incidence','income']},
    race:{title:'Cancer rates by race and ethnicity',caption:'2018–2022, U.S. registries, age-adjusted annual rates. These are reporting groups, not genetic categories. The American Indian / Alaska Native diagnosis rate covers designated counties, while its death rate has nationwide coverage and a correction for misclassification.',pair:['white','black'],measures:['incidence','mortality']}
  };
  const labels={incidence:'Diagnosis rate',mortality:'Death rate',count:'Avg. annual diagnoses',poverty:'Poverty rate',income:'Median household income','late-rate':'Late-stage rate','late-share':'Share diagnosed late',screening:'Mammography use'};
  const unit={incidence:'per 100,000',mortality:'per 100,000',count:'diagnoses per year',poverty:'of people below poverty',income:'2023 dollars','late-rate':'per 100,000 females','late-share':'of diagnosed cases',screening:'of women ages 50–74'};
  const predictions={same:'I predicted the same cancer would lead both rankings.',different:'I predicted different cancers would lead.',unsure:'I was not sure whether the rankings would match.'};
  const str=(v,n)=>typeof v==='string'?v.slice(0,n):'';
  const number=(v,precision=0)=>v.toLocaleString('en-US',{minimumFractionDigits:precision,maximumFractionDigits:precision});
  const value=(v,key)=>!finite(v)?(['late-rate','late-share','screening','income','incidence'].includes(key)&&state.view==='michigan'?'Unavailable':'Not in top 10'):['poverty','late-share','screening'].includes(key)?number(v,1)+'%':key==='income'?'$'+number(v):number(v,key==='count'?0:1);
  const full=(v,key)=>!finite(v)?value(v,key):value(v,key)+' '+unit[key];
  const newSetting=view=>({measure:view==='michigan'?'late-rate':'incidence',a:spec[view].pair[0],b:spec[view].pair[1],sort:view==='michigan'?'late-rate':'incidence',dir:'desc',query:'',rows:12,region:'all',x:'screening'});
  const defaults={labels:true,marks:true,benchmark:true,'pair-only':false,trend:false};
  const designItems={access:'Access evidence',cost:'Prototype cost ($)',visible:'Trials with visible target',trials:'Total trials',quality:'Image quality',durability:'Durability',recommendation:'Design recommendation and remaining evidence'};
  const exhibits=['access','diagnosis','test-cost'];
  const exhibitValues=Object.fromEntries(exhibits.map(k=>[k,[...$('income-'+k).querySelectorAll('.cr-income-bar')].map(row=>Number(row.dataset.value))]));
  const testCostRows=[...$('income-test-cost').querySelectorAll('.cr-income-bar')].map(row=>({
    group:row.dataset.group,label:row.querySelector('.cr-group-name').textContent,value:Number(row.dataset.value)
  }));
  const testCostValue=group=>testCostRows.find(row=>row.group===group).value;
  const directions={
    access:L.exhibitTrend(exhibitValues.access),
    diagnosis:L.exhibitTrend(exhibitValues.diagnosis),
    'test-cost':testCostRows.every(row=>row.value>0)?'longer':'shorter'
  };
  const fresh=()=>({casework:{access:'',diagnosis:'','test-cost':'',question:'',questionDraft:null,opened:false},design:Object.fromEntries(Object.keys(designItems).map(k=>[k,''])),step:'predict',view:'types',slot:'a',socio:'poverty',prediction:{choice:'',reason:'',locked:false},evidence:[],claim:'',limits:'',completed:false,person:{name:'',period:''},layer:{...defaults},settings:Object.fromEntries(views.map(v=>[v,newSetting(v)])),lastVisitedAt:0});
  let state=fresh(), invalid=false, blocked=false;
  function clean(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid record');
    const next=fresh();
    if(views.includes(raw.view))next.view=raw.view;
    if(raw.slot==='b')next.slot='b';
    if(raw.socio==='income')next.socio='income';
    const pr=raw.prediction;
    if(Object.hasOwn(predictions,pr?.choice)){next.prediction.choice=pr.choice;next.prediction.locked=pr.locked===true;}
    next.prediction.reason=str(pr?.reason,1200);
    for(const k of exhibits)if(directions[k]&&raw.casework?.[k]===directions[k])next.casework[k]=directions[k];
    next.casework.question=str(raw.casework?.question,500);
    next.casework.questionDraft=typeof raw.casework?.questionDraft==='string'?str(raw.casework.questionDraft,500):null;
    next.casework.opened=raw.casework?.opened===true&&!!next.casework.question.trim();
    for(const k of Object.keys(designItems))next.design[k]=str((raw.design ?? raw.ret)?.[k],1600);
    next.claim=str(raw.claim,1600);next.limits=str(raw.limits,1600);
    for(const k of ['name','period'])next.person[k]=str(raw.person?.[k],k==='name'?100:24);
    for(const k of Object.keys(defaults))if(typeof raw.layer?.[k]==='boolean')next.layer[k]=raw.layer[k];
    for(const v of views){
      const s=raw.settings?.[v], dest=next.settings[v], rows=D[v].rows, measures=spec[v].measures;
      if(measures.includes(s?.measure))dest.measure=s.measure;
      if(['name',...measures].includes(s?.sort))dest.sort=s.sort;
      if(s?.dir==='asc')dest.dir='asc';
      for(const k of ['a','b'])if(rows.some(r=>r.id===s?.[k]))dest[k]=s[k];
      dest.query=str(s?.query,80);
      if(['urban','rural'].includes(s?.region))dest.region=s.region;
      if(s?.x==='income')dest.x='income';
      if(Number.isInteger(s?.rows))dest.rows=Math.max(12,Math.min(60,s.rows));
    }
    if(Array.isArray(raw.evidence))next.evidence=raw.evidence.filter(p=>L.comparison(D,p)).slice(0,8).map(p=>({view:p.view,measure:p.measure,a:p.a,b:p.b,context:cleanContext(p.context)}));
    next.completed=raw.completed===true&&next.evidence.length>0&&!!next.claim.trim()&&!!next.limits.trim();
    if((next.prediction.locked||next.casework.opened)&&raw.step==='explore')next.step='explore';
    if((next.prediction.locked||next.casework.opened)&&next.evidence.length&&raw.step==='explain')next.step='explain';
    next.lastVisitedAt=finite(raw.lastVisitedAt)?raw.lastVisitedAt:0;
    return next;
  }
  function cleanContext(p){return {x:p?.x==='income'?'income':'poverty',trend:p?.trend===true,query:str(p?.query,80),region:['urban','rural'].includes(p?.region)?p.region:'all'};}
  try{const saved=localStorage.getItem(KEY);if(saved!==null){try{state=clean(JSON.parse(saved));}catch(_){invalid=true;}}}catch(_){blocked=true;}
  function save(){
    state.lastVisitedAt=Date.now();
    if(invalid){$('save').textContent='A previous record was preserved. Download this investigation before leaving.';return;}
    try{localStorage.setItem(KEY,JSON.stringify(state));blocked=false;$('save').textContent='Work saved on this device.';}
    catch(_){blocked=true;$('save').textContent='This browser could not save your work. Download it before leaving.';}
  }
  const node=(tag,t,cl)=>{const el=document.createElement(tag);if(t!==undefined)el.textContent=t;if(cl)el.className=cl;return el;};
  const svg=(tag,attrs={},t)=>{const el=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(t!==undefined)el.textContent=t;return el;};
  const option=(v,t)=>{const el=node('option',t);el.value=v;return el;};
  const current=()=>state.settings[state.view];
  const isMI=()=>state.view==='michigan';
  const scatterView=()=>state.view==='poverty'||isMI();
  const miMeasures=()=>spec.michigan.measures.filter(k=>D.michigan.rows.some(r=>finite(r[k])));
  const inRegion=(rows,s)=>!isMI()||s.region==='all'?rows:rows.filter(r=>r.region?.toLowerCase()===s.region);
  const other=()=>({types:'mortality',states:'count',poverty:state.socio,race:'mortality'}[state.view]);
  const text=(id,s)=>{const e=$(id);if(e.textContent!==s)e.textContent=s;};
  const announce=s=>text('status',s);
  function source(el,prefix,links,suffix=''){
    el.replaceChildren(document.createTextNode(prefix));
    links.forEach(([t,url],i)=>{
      if(i)el.append(document.createTextNode(' · '));
      const a=node('a',t);a.href=url;el.append(a);
    });
    el.append(document.createTextNode(suffix));
  }
  source($('source-types'),'Type rankings (2021): ',[['OpenSciEd B.3 Student Edition',D.types.source]],' (printed p. '+D.types.sourcePrintedPage+'). U.S. Cancer Statistics (CDC and NCI), as shown in the lesson. Missing rates are not zero.');
  source($('source-states'),'State diagnoses (2019–2023): ',[['State Cancer Profiles (CDC and NCI)',D.states.source]],'. All cancer sites; rate per 100,000 uses the 2000 U.S. standard age distribution.');
  source($('source-poverty'),'State economic estimates (2023 ACS one-year): ',[['Poverty Appendix Table 1',D.poverty.source],['Household Income Table 1',D.poverty.incomeSource.source]],'. The Census estimates cover a different period than the diagnosis data. Both are estimates, not exact counts of personal circumstances.');
  source($('source-race'),'Race and ethnicity (2018–2022): ',[['ACS Cancer Facts & Figures 2026, Table 9 (diagnoses)',D.race.incidence.url],['2025, Table 9 (deaths)',D.race.mortality.url]],'. '+D.race.notes);
  source($('source-michigan'),'Michigan screening and diagnosis data: ',Object.entries(D.michigan.sources).map(([k,url])=>[k,url]),'. '+D.michigan.period);
  const rowTag=r=>r.group==='female'?' · female population':r.group==='male'?' · male population':'';
  const aiCaveat='Diagnosis data: designated counties only. Death data: nationwide, adjusted for race misclassification.';
  const badge=(r,s)=>(r.id===s.a?'● A · ':'')+(r.id===s.b?'◆ B · ':'');
  function firstResult(){
    const tops=['incidence','mortality'].map(k=>L.sortRows(D.types.rows,k)[0]);
    const [a,b]=tops;
    return 'The top cancers differ. '+a.name+' leads new diagnoses ('+full(a.incidence,'incidence')+rowTag(a)+'); '+b.name+' leads deaths ('+full(b.mortality,'mortality')+').';
  }
  function available(step){return step==='predict'||((state.prediction.locked||state.casework.opened)&&(step==='explore'||(step==='explain'&&state.evidence.length>0)));}
  function goto(step,focus=true){
    if(!steps.includes(step)||!available(step))return;
    state.step=step;
    try{history.replaceState(null,'',step==='predict'?location.pathname+location.search:'#'+step);}catch(_){}
    save();render();announce('');
    if(focus)$(step+'-title').focus();
  }
  function render(){
    for(const step of steps){
      document.getElementById(step).hidden=step!==state.step;
      const b=document.querySelector('[data-step="'+step+'"]');
      b.disabled=!available(step);
      if(step===state.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
    }
    $('prediction').value=state.prediction.choice;$('reason').value=state.prediction.reason;
    $('prediction').disabled=state.prediction.locked;$('reason').readOnly=state.prediction.locked;
    $('lock').disabled=!state.prediction.choice; $('lock').textContent=state.prediction.locked?'Return to the data':'Lock prediction & open the data';
    for(const where of ['explore','explain']){
      $('question-'+where).hidden=!state.casework.opened;
      text('question-'+where+'-text',state.casework.question);
    }
    if(state.step==='explore')renderExplore();
    if(state.step==='explain')renderExplain();
  }
  function renderSelect(el,items,selected){
    const signature=items.map(([k])=>k).join('|');
    if(el.dataset.options!==signature){el.replaceChildren(...items.map(([k,t])=>option(k,t)));el.dataset.options=signature;}
    el.value=selected;
  }
  function renderExplore(){
    const v=state.view,s=current(),rows=D[v].rows;const allowed=v==='poverty'?['incidence',state.socio]:isMI()?miMeasures():spec[v].measures;
    if(!allowed.includes(s.measure))s.measure=allowed[0];
    if(!['name',...allowed].includes(s.sort))s.sort=s.measure;
    $('view').value=v;$('search').value=s.query;$('socio').value=state.socio;
    $('socio-control').hidden=v!=='poverty';
    $('mi-context').hidden=$('mi-region-label').hidden=!isMI();$('mi-region').value=s.region;
    $('mi-x-label').hidden=!isMI()||!miMeasures().includes('income');$('mi-x').value=s.x;
    text('measure-label',v==='poverty'?'Rank and pin by':'Graph and rank by');
    for(const el of all('input[name="cr-slot"]'))el.checked=el.value===state.slot;
    renderSelect($('measure'),allowed.map(k=>[k,labels[k]]),s.measure);
    const opts=L.sortRows(rows,'name','asc').map(r=>[r.id,r.name]);
    renderSelect($('compare-a'),opts,s.a);renderSelect($('compare-b'),opts,s.b);
    $('verdict').hidden=!state.prediction.locked;if(state.prediction.locked)text('verdict',predictions[state.prediction.choice]+' '+firstResult());text('view-source',spec[v].caption+(isMI()?' '+D.michigan.period:''));
    text('pin-count',state.evidence.length+' comparison'+(state.evidence.length===1?'':'s')+' pinned');
    text('chart-title',spec[v].title);
    text('chart-unit',v==='poverty'?'Diagnosis rate per 100,000':unit[s.measure]);
    for(const k of Object.keys(defaults))$(k).checked=state.layer[k];
    $('trend').parentElement.hidden=!scatterView()||(isMI()&&s.measure===(miMeasures().includes('income')?s.x:'screening'));
    $('benchmark').parentElement.hidden=isMI()||v==='types'||(v==='states'&&s.measure==='count');
    text('chart-key','● A and ◆ B are your picks. '+(v==='poverty'?'Use the table for exact values. A trend line summarizes the visible dots, not a cause.':'Bars start at zero. Your picks stay visible while you search. Use the table for the complete list.'));
    renderChart();renderPair();renderTable();
    $('to-explain').disabled=!state.evidence.length;
  }
  function pick(id,ref=null){
    const s=current(),r=D[state.view].rows.find(x=>x.id===id);
    if(!r)return;
    s[state.slot]=id;
    save();renderExplore();announce('Picked '+r.name+' for '+state.slot.toUpperCase()+'.');
    if(scatterView()){
      const summary=isMI()?[...new Set([s.x,s.measure])].map(k=>labels[k]+': '+full(r[k],k)).join('; '):labels[state.socio]+': '+full(r[state.socio],state.socio)+'; diagnosis rate: '+full(r.incidence,'incidence');
      text('inspect',r.name+' · '+summary);
    }
    if(ref==='table')$('table').querySelector('[data-pick="'+id+'"]')?.focus({preventScroll:true});
    if(ref==='bar')$('chart').querySelector('[data-chart-row="'+id+'"]')?.focus({preventScroll:true});
  }
  function plotRows(){
    const s=current(),v=state.view,rows=L.sortRows(inRegion(D[v].rows,s),s.measure,'desc',s.query);
    if(scatterView())return state.layer['pair-only']?rows.filter(r=>[s.a,s.b].includes(r.id)):rows;
    const picks=D[v].rows.filter(r=>[s.a,s.b].includes(r.id));
    if(state.layer['pair-only'])return picks;
    const shown=rows.filter(r=>finite(r[s.measure])).slice(0,6);
    return shown.concat(picks.filter(r=>!shown.includes(r)));
  }
  function benchmark(){
    const v=state.view,k=current().measure;
    if(!state.layer.benchmark)return null;
    if(v==='race')return D.race.benchmark[k];
    if(v==='states'&&k==='incidence')return D.states.national.incidence;
    if(v==='poverty')return D.states.national.incidence;
    return null;
  }
  function renderChart(){
    const v=state.view,s=current(),rows=plotRows(),box=$('chart'),base=benchmark();
    text('inspect','');
    if(!rows.length){box.replaceChildren(node('p','No points or bars match this search. Clear the search to see the data.','cr-chart-hint'));return;}
    if(scatterView()){scatter(box,rows,base);return;}
    const m=s.measure,max=Math.max(1,finite(base)?base:0,...D[v].rows.map(r=>finite(r[m])?r[m]:0));
    const ul=node('ul',undefined,'cr-bars');
    for(const r of rows){
      const li=node('li'),b=node('button',undefined,'cr-bar');b.type='button';b.dataset.chartRow=r.id;
      if(r.id===s.a)b.classList.add('is-selected','is-a');
      if(r.id===s.b)b.classList.add('is-selected','is-b');
      b.setAttribute('aria-label',badge(r,s)+r.name+': '+full(r[m],m)+'. Pick for '+state.slot.toUpperCase());
      const mark=node('span',undefined,'cr-bar-fill'),track=node('span',undefined,'cr-bar-track');
      if(state.layer.marks&&finite(r[m])){mark.style.width=(100*r[m]/max)+'%';track.append(mark);}
      if(finite(base)){const line=node('span',undefined,'cr-baseline');line.style.left=(100*base/max)+'%';track.append(line);}
      track.setAttribute('aria-hidden','true');
      const label=node('span',badge(r,s)+r.name),num=node('span',state.layer.labels?value(r[m],m):'','cr-number');
      label.setAttribute('aria-hidden','true');num.setAttribute('aria-hidden','true');
      b.append(label,track,num);b.addEventListener('click',()=>pick(r.id,'bar'));li.append(b);ul.append(li);
    }
    box.replaceChildren(ul);
    if(finite(base))text('inspect','Dashed reference: U.S. overall '+full(base,m)+'.');
  }
  function scatter(box,rows,base){
    const s=current(),mi=isMI(),key=mi?(miMeasures().includes('income')?s.x:'screening'):state.socio;
    const yKey=mi?s.measure:'incidence';
    if(mi&&s.measure===key){renderMICounts(box,rows,key);return;}
    const matched=rows.filter(r=>finite(r[key])&&finite(r[yKey]));
    if(!matched.length){box.replaceChildren(node('p','No matching rows have both measures. Try another county or look at the table.','cr-chart-hint'));return;}
    const scale=(values,step)=>{const lo=Math.floor(Math.min(...values)/step)*step,hi=Math.ceil(Math.max(...values)/step)*step;return [lo,Math.max(lo+step*2,hi)];};
    const allRows=mi?D.michigan.rows:rows;
    const [xlo,xhi]=mi?scale(allRows.map(r=>r[key]).filter(finite),key==='income'?20000:5):(key==='income'?[50000,110000]:[5,20]);
    const yStep=yKey==='income'?20000:10;
    const [ylo,yhi]=mi?scale(allRows.map(r=>r[yKey]).filter(finite),yStep):[300,560];
    const [left,right,top,bottom]=[76,554,20,224];
    const x=n=>left+(n-xlo)/(xhi-xlo)*(right-left),y=n=>bottom-(n-ylo)/(yhi-ylo)*(bottom-top);
    const chart=svg('svg',{class:'cr-scatter',viewBox:'0 0 580 276',role:'img','aria-labelledby':'cr-scatter-title cr-scatter-description'});
    chart.append(svg('title',{id:'cr-scatter-title'},mi?'Michigan counties: '+labels[key]+' and '+labels[yKey]:('State '+(key==='income'?'household income':'poverty')+' and cancer diagnosis rates')));
    chart.append(svg('desc',{id:'cr-scatter-description'},matched.length+' points. Exact values and keyboard selection are in the table and A and B controls.'));
    const line=(x1,y1,x2,y2,cl)=>svg('line',{x1,y1,x2,y2,class:cl});
    const ticks=(lo,hi,step)=>Array.from({length:Math.round((hi-lo)/step)+1},(_,i)=>lo+i*step);
    const xTicks=mi?ticks(xlo,xhi,key==='income'?20000:5):key==='income'?[50000,65000,80000,95000,110000]:[5,10,15,20];
    const yTicks=mi?ticks(ylo,yhi,yStep):[300,350,400,450,500,550];
    for(const t of xTicks){
      chart.append(line(x(t),top,x(t),bottom,'cr-gridline'),svg('text',{x:x(t),y:247,'text-anchor':'middle'},key==='income'?'$'+t/1000+'k':t+'%'));
    }
    for(const t of yTicks){
      chart.append(line(left,y(t),right,y(t),'cr-gridline'),svg('text',{x:left-7,y:y(t)+4,'text-anchor':'end'},yKey==='income'?'$'+t/1000+'k':t));
    }
    chart.append(line(left,top,left,bottom,'cr-axis'),line(left,bottom,right,bottom,'cr-axis'));
    chart.append(svg('text',{x:(left+right)/2,y:272,'text-anchor':'middle',class:'cr-axis-title'},key==='income'?'Median household income (2023 $)':mi?'Mammogram in prior 2 years (%)':'People below poverty (%)'));
    chart.append(svg('text',{x:17,y:128,transform:'rotate(-90 17 128)','text-anchor':'middle',class:'cr-axis-title'},mi?(yKey==='late-share'?'Diagnosed late (%)':yKey==='late-rate'?'Late-stage cases per 100,000':yKey==='screening'?'Mammography use (%)':yKey==='income'?'Median income (2023 $)':'Diagnoses per 100,000'):'Diagnoses per 100,000'));
    if(finite(base))chart.append(line(left,y(base),right,y(base),'cr-reference'));
    const showFit=state.layer.trend;
    const fit=showFit?L.fitLine(matched,key,yKey):null;
    if(fit){
      const clip=svg('clipPath',{id:'cr-scatter-plot'});
      clip.append(svg('rect',{x:left,y:top,width:right-left,height:bottom-top}));
      chart.append(clip);
      const trend=line(x(fit.min),y(fit.intercept+fit.slope*fit.min),x(fit.max),y(fit.intercept+fit.slope*fit.max),'cr-fit');
      trend.setAttribute('clip-path','url(#cr-scatter-plot)');chart.append(trend);
    }
    for(const r of [...matched].sort((a,b)=>Number([s.a,s.b].includes(a.id))-Number([s.a,s.b].includes(b.id)))){
      if(!state.layer.marks)continue;
      const px=x(r[key]),py=y(r[yKey]),isA=r.id===s.a,isB=r.id===s.b;
      const rural=mi&&r.region?.toLowerCase()==='rural';
      const shape=isB?svg('polygon',{points:[[px,py-8],[px+8,py],[px,py+8],[px-8,py]].map(pair=>pair.join(',')).join(' ')}):rural&&!isA?svg('rect',{x:px-5.5,y:py-5.5,width:11,height:11}):svg('circle',{cx:px,cy:py,r:isA?7:5.8});
      shape.setAttribute('class','cr-point'+(isA?' is-a':'')+(isB?' is-b':'')+(rural?' cr-rural':''));shape.dataset.point=r.id;
      const hint=r.name+': '+full(r[key],key)+'; '+full(r[yKey],yKey)+(mi?' · '+r.region:'')+'.';
      shape.append(svg('title',{},hint));shape.addEventListener('pointerenter',()=>text('inspect',hint));shape.addEventListener('click',()=>pick(r.id));
      chart.append(shape);
      if(state.layer.labels&&(isA||isB))chart.append(svg('text',{x:px+(px>right-40?-8:9),y:py-9,'text-anchor':px>right-40?'end':'start',class:'cr-selected-label'},mi?r.name.replace(/ County$/,''):r.id));
    }
    box.replaceChildren(chart);
    const baseText=finite(base)?'Dashed amber: U.S. diagnosis-rate reference ('+value(base,'incidence')+'). ':'';
    const fitText=fit?'Dashed purple: straight-line fit for '+fit.n+(mi?' visible counties (':' visible states or D.C. (')+(Math.abs(fit.slope)<1e-12?'flat':fit.slope>0?'slopes up':'slopes down')+').':(showFit?'Trend line needs at least three visible locations with different x values.':'');
    text('chart-key','● A and ◆ B are your picks. '+baseText+fitText+(mi?' Squares are rural; circles are urban except A/B markers.':'')+' A fitted line summarizes the points; it does not prove a cause.');
  }
  function renderMICounts(box,rows,key){
    const max=key==='screening'?100:Math.max(...D.michigan.rows.map(r=>r.income||0));
    const s=current(),ul=node('ul',undefined,'cr-bars');
    for(const r of rows.filter(r=>finite(r[key])).slice(0,12)){
      const li=node('li'),b=node('button',undefined,'cr-bar');b.type='button';b.dataset.chartRow=r.id;
      if(r.id===s.a)b.classList.add('is-selected','is-a');
      if(r.id===s.b)b.classList.add('is-selected','is-b');
      b.setAttribute('aria-label',r.name+': '+full(r[key],key)+'. Pick for '+state.slot.toUpperCase());
      const track=node('span',undefined,'cr-bar-track'),bar=node('span',undefined,'cr-bar-fill');
      bar.style.width=(100*r[key]/max)+'%';if(state.layer.marks)track.append(bar);
      b.append(node('span',badge(r,s)+r.name),track,node('span',state.layer.labels?value(r[key],key):'','cr-number'));
      b.addEventListener('click',()=>pick(r.id,'bar'));li.append(b);ul.append(li);
    }
    box.replaceChildren(ul.childElementCount?ul:node('p','No estimates match this filter.'));
    text('chart-key','Bars start at zero. '+(key==='screening'?'Estimates are for women ages 50–74 with a mammogram in the past two years.':'Estimated median household income in 2023 dollars.')+' Use the table for more rows.');
  }
  function formatPair(r,k,v){
    const out=full(r[k],k)+(k==='incidence'&&v==='poverty'?' diagnoses':k==='incidence'&&v==='michigan'&&finite(r[k])?' females':'');
    return out+((v==='types'&&finite(r[k]))?rowTag(r):'');
  }
  function renderPair(){
    const v=state.view,s=current(),holder=$('pair-values');
    const picks=['a','b'].map(k=>D[v].rows.find(r=>r.id===s[k]));
    const second=other();
    const cards=picks.map((r,i)=>{
      const el=node('div',undefined,'cr-pair-card'+(i?' is-b':''));
      el.append(node('strong',(i?'◆ B · ':'● A · ')+r.name+(isMI()?' · '+r.region:'')));
      if(isMI()){
        for(const k of miMeasures())el.append(node('p',labels[k]+': '+formatPair(r,k,v)));
        if(finite(r.annualAllCount))el.append(node('p','Average all-stage cases per year: '+r.annualAllCount+'.','cr-muted'));
        if(r.allCI?.every(finite))el.append(node('p','All-stage rate range (95% CI): '+r.allCI.map(n=>number(n,1)).join('–')+'.','cr-muted'));
        if(finite(r.annualLateCount))el.append(node('p','Average late-stage cases per year: '+r.annualLateCount+'.','cr-muted'));
        if(r.lateCI?.every(finite))el.append(node('p','Late-stage rate range (95% CI): '+r.lateCI.map(n=>number(n,1)).join('–')+'.','cr-muted'));
        if(r.incomeCI?.every(finite))el.append(node('p','Income estimate range (90% CI): $'+r.incomeCI.map(n=>number(n)).join('–$')+'.','cr-muted'));
        if(r.screeningCI?.every(finite))el.append(node('p','Mammography range (95% CI): '+r.screeningCI.map(n=>number(n,1)).join('–')+'%.','cr-muted'));
      }else el.append(node('p',labels.incidence+': '+formatPair(r,'incidence',v)),node('p',labels[second]+': '+formatPair(r,second,v)));
      if(v==='poverty'){const margin=second==='income'?'$'+number(r.incomeMarginOfError):number(r.povertyMarginOfError,1)+' percentage points';el.append(node('p','Census margin of error: ±'+margin+'.','cr-muted'));}
      if(v==='race'&&r.id==='ai-an')el.append(node('p',aiCaveat,'cr-muted'));
      return el;
    });
    const comparison=L.comparison(D,{view:v,measure:s.measure,a:s.a,b:s.b});
    const gap=comparison?.difference;
    let msg=!comparison?'Choose two different rows to pin.':(gap===null?'At least one source value is missing. Do not treat the missing rate as zero.':'');
    if(finite(gap))msg=labels[s.measure]+' gap: '+(['poverty','late-share','screening'].includes(s.measure)?number(gap,1)+' percentage points':full(gap,s.measure))+'.';
    if(comparison&&v==='types'&&picks[0].group!==picks[1].group&&finite(gap))msg+=' Read the population labels before comparing rates.';
    holder.replaceChildren(...cards,node('p',msg,'cr-gap'));
    const duplicate=state.evidence.some(p=>p.view===v&&p.measure===s.measure&&[p.a,p.b].includes(s.a)&&[p.a,p.b].includes(s.b));
    $('pin').disabled=!comparison||state.evidence.length>=8||duplicate;
    $('pin').textContent=duplicate?'Comparison already pinned':state.evidence.length>=8?'Notebook full (8 pins)':'Pin this comparison';
  }
  function renderTable(){
    const v=state.view,s=current(),rows=inRegion(D[v].rows,s),k=isMI()?'late-share':other(),first=isMI()?(['incidence','income'].includes(s.measure)?s.measure:'late-rate'):'incidence',ranks=L.rankRows(rows,s.measure);
    $('third-head').hidden=!isMI();$('first-sort').dataset.sort=first;text('first-label',labels[first]);
    $('other-sort').dataset.sort=k;text('other-label',labels[k]); 
    for(const b of all('#cr-table [data-sort]')){
      const active=b.dataset.sort===s.sort, th=b.closest('th');
      if(active)th.setAttribute('aria-sort',s.dir==='asc'?'ascending':'descending');else th.removeAttribute('aria-sort');
      b.lastElementChild.textContent=active?(s.dir==='asc'?' ↑':' ↓'):'';
    }
    const visible=L.sortRows(rows,s.sort,s.dir,s.query),tbody=$('table').tBodies[0];
    const rendered=visible.slice(0,s.rows).map(r=>{
      const tr=node('tr');tr.dataset.rowId=r.id;
      if(r.id===s.a)tr.classList.add('is-a'); if(r.id===s.b)tr.classList.add('is-b');
      const th=node('th');th.scope='row';const b=node('button',badge(r,s)+r.name);b.type='button';b.dataset.pick=r.id;b.addEventListener('click',()=>pick(r.id,'table'));th.append(b);
      if(v==='types'&&r.group!=='all')th.append(node('small',rowTag(r).slice(3),'cr-muted cr-row-note'));
      if(isMI())th.append(node('small',r.region,'cr-muted cr-row-note'));
      const dia=node('td',value(r[first],first));dia.dataset.value=first;
      const alt=node('td',value(r[k],k));alt.dataset.value=k;
      tr.append(node('td',ranks[r.id]===undefined?'—':String(ranks[r.id])),th,dia,alt);if(isMI())tr.append(node('td',value(r.screening,'screening')));return tr;
    });
    if(!rendered.length){const r=node('tr'),td=node('td','No rows match. Clear your search to see all rows.');td.colSpan=isMI()?5:4;r.append(td);rendered.push(r);}
    tbody.replaceChildren(...rendered);text('row-count','Showing '+Math.min(visible.length,s.rows)+' of '+visible.length+' matching rows');
    $('more').hidden=visible.length<=s.rows;
  }
  function evidenceText(p){
    const pair=L.comparison(D,p);
    if(!pair)return '';
    const pairStr=r=>r.name+': '+labels[p.measure].toLowerCase()+' '+formatPair(r,p.measure,p.view);
    let extra='';
    if(p.view==='michigan'){
      const readings=r=>r.name+' ('+r.region+'): '+spec.michigan.measures.filter(k=>finite(r[k])).map(k=>labels[k]+' '+full(r[k],k)).join(', ')+(r.lateCI?.every(finite)?'; late-stage 95% CI '+r.lateCI.join('–'):'')+(r.screeningCI?.every(finite)?'; mammography 95% CI '+r.screeningCI.join('–')+'%':'');
      return spec.michigan.title+' · '+D.michigan.period+' Pinned by '+labels[p.measure].toLowerCase()+'. '+readings(pair.a)+' | '+readings(pair.b)+'. County comparisons cannot measure individual access or prove a cause.';
    }
    if(p.view==='poverty'){
      const co=cleanContext(p.context),x=co.x;
      extra=' · Scatterplot: '+pair.a.name+' '+full(pair.a[x],x)+' and '+pair.b.name+' '+full(pair.b[x],x)+'; diagnoses '+full(pair.a.incidence,'incidence')+' and '+full(pair.b.incidence,'incidence')+'.';
      const rows=L.sortRows(D.poverty.rows,'incidence','desc',co.query);
      if(co.trend){const fit=L.fitLine(rows,x);if(fit)extra+=' Trend fit on '+fit.n+' matching locations ('+(Math.abs(fit.slope)<1e-12?'flat':fit.slope>0?'upward':'downward')+'); not causal.';}
    }else if(p.view==='race'&&[p.a,p.b].includes('ai-an'))extra=' · '+aiCaveat;
    const period=p.view==='poverty'?'Cancer 2019–2023; Census 2023':D[p.view].period;
    return spec[p.view].title+' ('+period+') · '+pairStr(pair.a)+' | '+pairStr(pair.b)+extra;
  }
  const testCostEvidence=row=>row.label+': +'+row.value+' months';
  function renderExplain(){
    $('explain-test-cost').hidden=!state.casework['test-cost'];
    $('explain-test-cost-values').replaceChildren(...(state.casework['test-cost']?testCostRows.map(row=>node('li',testCostEvidence(row))):[]));
    $('claim').value=state.claim;$('limits').value=state.limits;
    $('explain-prediction').hidden=!state.prediction.locked;
    if(state.prediction.locked)text('explain-prediction',predictions[state.prediction.choice]+' '+(state.prediction.reason?'Reason: '+state.prediction.reason:'')+' '+firstResult());
    const list=$('evidence-list');
    list.replaceChildren(...state.evidence.map((p,i)=>{
      const li=node('li'),b=node('button','Remove pin','btn btn--sm');b.type='button';
      b.setAttribute('aria-label','Remove pin '+(i+1));
      b.addEventListener('click',()=>{
        state.evidence.splice(i,1);state.completed=false;
        if(!state.evidence.length)goto('explore');else{save();renderExplain();list.querySelector('button')?.focus();}
        announce('Removed the comparison.');
      });
      li.append(node('p',evidenceText(p)),b);return li;
    }));
    $('design-review').hidden=!state.evidence.some(p=>p.view==='michigan');
    for(const k of Object.keys(designItems))$('design-'+k).value=state.design[k];
    renderCompletion();
  }
  function renderCompletion(){
    $('finish').disabled=state.completed||!(state.claim.trim()&&state.limits.trim()&&state.evidence.length);
    $('done').hidden=!state.completed;
  }
  function report(){
    const lines=['Cancer Rates Data Dive — Investigation','Name: '+state.person.name,'Class period: '+state.person.period,'','PREDICTION',predictions[state.prediction.choice]||'Not recorded',state.prediction.reason,state.prediction.locked?firstResult():'',...(state.casework.opened?['','INVESTIGATION QUESTION',state.casework.question]:[]),...(state.casework['test-cost']?[
      '','EXHIBIT F: THE COST OF GETTING TESTED',
      'Estimated extra months after a switch to higher deductibles versus matched women staying on lower-deductible plans; higher-poverty U.S. neighborhoods, 2004–2014.',
      ...testCostRows.map(testCostEvidence),
      'Source: '+$('test-cost-source').href
    ]:[]),'','PINNED EVIDENCE',...state.evidence.map((p,i)=>(i+1)+'. '+evidenceText(p)),'','CLAIM',state.claim,'','LIMITS AND NEXT EVIDENCE',state.limits,'',...(state.evidence.some(p=>p.view==='michigan')?['ULTRASOUND DESIGN REVIEW (classroom testing, not clinical validation)',...Object.entries(designItems).filter(([k])=>state.design[k].trim()).map(([k,title])=>title+': '+state.design[k]),'','MICHIGAN EVIDENCE SOURCES',...Object.entries(D.michigan.sources).map(([k,url])=>k+': '+url),'']:[]),'SOURCES','Type rankings: '+D.types.source+' (printed p. 65)','States: '+D.states.source,'Census poverty: '+D.poverty.source,'Census household income: '+D.poverty.incomeSource.source,'Race and ethnicity diagnosis rates: '+D.race.incidence.url,'Race and ethnicity death rates: '+D.race.mortality.url,'','Population averages are not individual predictions or explanations of cause.'];
    return lines.join('\n')+'\n';
  }
  function syncIdentity(){for(const k of ['name','period'])$(k).value=state.person[k];}
  for(const b of all('[data-step]'))b.addEventListener('click',()=>goto(b.dataset.step));
  $('prediction').addEventListener('change',()=>{state.prediction.choice=$('prediction').value;save();$('lock').disabled=!state.prediction.choice;});
  $('reason').addEventListener('input',()=>{if(!state.prediction.locked){state.prediction.reason=$('reason').value;save();}});
  $('lock').addEventListener('click',()=>{if(state.prediction.choice){state.prediction.locked=true;goto('explore');}});
  $('view').addEventListener('change',()=>{state.view=$('view').value;save();renderExplore();announce('Now showing '+spec[state.view].title+'.');});
  $('mi-x').addEventListener('change',()=>{current().x=$('mi-x').value;save();renderExplore();announce('Michigan scatterplot x-axis updated.');});
  $('mi-region').addEventListener('change',()=>{current().region=$('mi-region').value;current().rows=12;save();renderExplore();announce('County filter updated.');});
  $('socio').addEventListener('change',()=>{state.socio=$('socio').value;if(current().measure!=='incidence')current().measure=state.socio;if(current().sort!=='name'&&current().sort!=='incidence')current().sort=state.socio;save();renderExplore();announce('Scatterplot now uses '+labels[state.socio].toLowerCase()+'.');});
  $('measure').addEventListener('change',()=>{const s=current();s.measure=$('measure').value;s.sort=s.measure;s.dir='desc';save();renderExplore();announce('Ranking by '+labels[s.measure].toLowerCase()+'.');});
  $('search').addEventListener('input',()=>{current().query=$('search').value;current().rows=12;save();renderChart();renderTable();});
  for(const k of Object.keys(defaults))$(k).addEventListener('change',()=>{state.layer[k]=$(k).checked;save();renderChart();if(k==='trend')announce(state.layer.trend?'Trend line requested. Read the chart caption for its fit.':'Trend line hidden.');});
  for(const el of all('input[name="cr-slot"]'))el.addEventListener('change',()=>{state.slot=el.value;save();renderChart();});
  for(const k of ['a','b'])$('compare-'+k).addEventListener('change',()=>{state.slot=k;pick($('compare-'+k).value);});
  for(const b of all('#cr-table [data-sort]'))b.addEventListener('click',()=>{
    const s=current(),k=b.dataset.sort;
    s.dir=s.sort===k?(s.dir==='asc'?'desc':'asc'):(k==='name'?'asc':'desc');s.sort=k;save();renderTable();announce('Table sorted '+(s.dir==='asc'?'ascending':'descending')+' by '+(labels[k]||'name')+'.');
  });
  $('more').addEventListener('click',()=>{
    const s=current(),next=s.rows;s.rows+=12;save();renderTable();
    $('table').tBodies[0].rows[next]?.querySelector('button')?.focus();
  });
  $('pin').addEventListener('click',()=>{
    const s=current(),view=state.view;
    const p={view,measure:s.measure,a:s.a,b:s.b,context:{x:state.socio,trend:state.layer.trend&&!state.layer['pair-only'],query:s.query,region:s.region}};
    if($('pin').disabled||!L.comparison(D,p))return;
    state.evidence.push(p);state.completed=false;save();renderExplore();announce('Comparison pinned. You can now use it in Explain.');
    $('to-explain').focus({preventScroll:true});
  });
  $('to-explain').addEventListener('click',()=>goto('explain'));
  for(const k of ['claim','limits'])$(k).addEventListener('input',()=>{state[k]=$(k).value;state.completed=false;save();renderCompletion();});
  $('finish').addEventListener('click',()=>{if(!$('finish').disabled){state.completed=true;save();renderCompletion();announce('Investigation complete. Download your work if you need to turn it in.');$('download').focus();}});
  for(const k of Object.keys(designItems))$('design-'+k).addEventListener('input',()=>{state.design[k]=$('design-'+k).value;save();});
  for(const k of ['name','period'])$(k).addEventListener('input',()=>{state.person[k]=$(k).value;save();});
  $('download').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([report()],{type:'text/plain;charset=utf-8'})),a=node('a');
    a.href=url;a.download='cancer-rates-investigation.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);announce('Investigation downloaded.');
  });
  $('reset').addEventListener('click',()=>$('reset-dialog').showModal());
  $('reset-confirm').addEventListener('click',()=>{
    try{localStorage.removeItem(KEY);invalid=false;blocked=false;}catch(_){blocked=true;}
    state=fresh();syncCasefile();syncIdentity();$('reset-dialog').close();
    try{history.replaceState(null,'',location.pathname+location.search);}catch(_){}
    text('save','Work stays on this device unless you download it.');render();announce('Investigation reset.');$('predict-title').focus();
  });
  const figure=$('chart').closest('figure'),home=document.createComment('Interactive chart position'),dialog=$('chart-dialog');
  figure.before(home);
  $('enlarge').addEventListener('click',()=>{
    $('chart-host').append(figure);
    $('enlarge').hidden=true;$('zoom').value='1';$('chart').style.removeProperty('width');
    $('plot-scroll').tabIndex=0;dialog.showModal();
  });
  $('zoom').addEventListener('change',()=>{
    const zoom=Number($('zoom').value);$('chart').style.width=(zoom*100)+'%';$('plot-scroll').scrollLeft=0;
  });
  $('chart-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    home.after(figure);$('plot-scroll').removeAttribute('tabindex');$('enlarge').hidden=false;$('chart').style.removeProperty('width');
    $('enlarge').focus({preventScroll:true});
  });
  // Supplemental evidence cards leave the existing prediction and explorer state intact.
  const casefile=$('income-cards'), question=$('income-question'), followup=$('income-followup');
  const caseDialog=$('case-dialog'), questionJump=$('case-question-jump');
  const mapWindow=$('lesson1-map-scroll'), mapZoom=$('lesson1-map-zoom');
  let caseOpener=null, focusQuestion=false;
  const caseTabs=['lesson1-diagnoses','lesson1-deaths','lesson1-map',...exhibits.map(k=>'income-'+k)];
  const checkedCount=()=>exhibits.filter(k=>state.casework[k]===directions[k]&&directions[k]).length;
  // Keep drafts and submitted questions from the earlier two-check case file usable.
  const mayWriteQuestion=()=>checkedCount()===exhibits.length||
    (!!state.casework.access&&!!state.casework.diagnosis&&
      Boolean(state.casework.opened||state.casework.questionDraft?.trim()));
  function updateFollowup(){
    const count=checkedCount(), ready=mayWriteQuestion();
    followup.hidden=!ready;
    $('income-explore').disabled=!ready||!question.value.trim();
    questionJump.disabled=!ready;
    text('income-progress',count+' of '+exhibits.length+' comparisons checked. '+(ready
      ?'You can write or revise your follow-up question.':'Check all three to unlock the next step.'));
    for(const k of exhibits){
      const cover=$('income-'+k+'-tab');
      const checked=!!state.casework[k];
      cover.dataset.checked=String(checked);
      cover.dataset.resume=String(count>0&&!checked&&!state.casework.opened);
      cover.querySelector('.cr-dossier-link').textContent=checked?'✓ Checked • reopen':cover.dataset.resume==='true'?'Resume here ↗':'Open exhibit ↗';
    }
  }
  function setMapZoom(zoomed){
    mapWindow.dataset.zoomed=String(zoomed);
    mapZoom.setAttribute('aria-pressed',String(zoomed));
    mapZoom.textContent=zoomed?'Fit map to window':'Zoom map';
    if(zoomed)mapWindow.tabIndex=0;
    else{mapWindow.removeAttribute('tabindex');mapWindow.scrollLeft=0;}
  }
  function showExhibit(k,opener){
    if(!caseTabs.includes(k))return;
    for(const id of caseTabs)$(id).hidden=id!==k;
    const title=$(k+'-title');
    caseDialog.setAttribute('aria-labelledby',title.id);
    text('case-position','Exhibit '+(caseTabs.indexOf(k)+1)+' of '+caseTabs.length);
    text('case-live','');
    setMapZoom(false);
    if(!caseDialog.open){
      caseOpener=opener??$(k+'-tab');focusQuestion=false;
      caseDialog.showModal();
    }
    caseDialog.scrollTop=0;
    title.focus({preventScroll:true});
  }
  $('case-close').addEventListener('click',()=>caseDialog.close());
  caseDialog.addEventListener('close',()=>{
    const target=focusQuestion?question:caseOpener;
    caseOpener=null;focusQuestion=false;text('case-live','');
    if(target?.isConnected)target.focus(target===question?{}:{preventScroll:true});
  });
  mapZoom.addEventListener('click',()=>setMapZoom(mapZoom.getAttribute('aria-pressed')!=='true'));
  questionJump.addEventListener('click',()=>{
    if(!mayWriteQuestion())return;
    focusQuestion=true;caseDialog.close();
  });
  function feedbackFor(k,right,guess){
    if(k==='test-cost'){
      const reason='Compared with similar women staying on lower-deductible plans, the higher-deductible group reached the diagnostic imaging benchmark '+testCostValue('imaging')+' months later, the biopsy benchmark '+testCostValue('biopsy')+' months later, and the early-stage diagnosis benchmark '+testCostValue('diagnosis')+' months later.';
      return right?'That matches the graph. '+reason+' Lowering what patients pay could remove one barrier to timely testing.'
        :guess==='accuracy'?'Not quite. The study compared how soon people received care, not which test was more accurate. Try again.'
        :'Not quite. The bars show extra months, not months saved. Try again.';
    }
    const values=exhibitValues[k],direction=directions[k];
    const from=number(values[0],1)+'%', to=number(values.at(-1),1)+'%';
    if(k==='diagnosis'){
      const reason='Early-stage diagnosis was less common in neighborhoods with persistent poverty ('+from+') than in other neighborhoods ('+to+'), a gap of '+number(Math.abs(values[0]-values.at(-1)),1)+' percentage points. This comparison does not tell us why.';
      return right?'That matches the graph. '+reason:'Not quite. Compare the two labeled percentages. '+reason+' Try again.';
    }
    const movement=direction==='rising'?'rises':direction==='falling'?'falls':'stays level';
    const reason='From the lowest to the highest income group shown, the percentage '+movement+' from '+from+' to '+to+'.';
    return right?'That matches the graph. '+reason:'Not quite. Compare the first and last bars. '+reason+' Try again.';
  }
  function syncCasefile(){
    question.value=state.casework.questionDraft??state.casework.question;
    for(const k of exhibits){
      const id='income-'+k,fb=$(id+'-feedback'),correct=!!state.casework[k];
      $(id+'-answer').value=state.casework[k];$(id+'-check').disabled=!correct;
      fb.hidden=!correct;fb.textContent=correct?feedbackFor(k,true):'';
      if(correct)fb.dataset.result='correct';else delete fb.dataset.result;
    }
    updateFollowup();
  }
  for(const id of caseTabs)$(id+'-tab').addEventListener('click',event=>showExhibit(id,event.currentTarget));
  for(const b of all('[data-case-next]'))b.addEventListener('click',()=>showExhibit(b.dataset.caseNext));
  question.addEventListener('input',()=>{
    state.casework.questionDraft=str(question.value,500);save();updateFollowup();
  });
  followup.addEventListener('submit',event=>{
    event.preventDefault();
    if(!mayWriteQuestion()||!question.value.trim())return;
    const next=question.value.trim();
    if(next!==state.casework.question)state.completed=false;
    state.casework.question=next;state.casework.questionDraft=null;state.casework.opened=true;
    casefile.open=false;goto('explore');
  });
  for(const k of exhibits){
    const id='income-'+k, answer=$(id+'-answer'), check=$(id+'-check'), feedback=$(id+'-feedback');
    answer.addEventListener('change',()=>{
      feedback.hidden=true;feedback.textContent='';check.disabled=!answer.value||!directions[k];
      if(state.casework[k]){state.casework[k]='';save();}
      updateFollowup();
    });
    check.addEventListener('click',()=>{
      if(!answer.value||!directions[k])return;
      const right=answer.value===directions[k];
      if(right){state.casework[k]=directions[k];save();}
      feedback.textContent=feedbackFor(k,right,answer.value);
      feedback.dataset.result=right?'correct':'retry';feedback.hidden=false;
      updateFollowup();
      text('case-live',feedback.textContent+(checkedCount()===exhibits.length?' All three comparisons checked. You can now write a follow-up question.':''));
    });
  }
  syncCasefile();
  const hash=location.hash.slice(1);
  if(hash==='cr-income-cards')casefile.open=true;
  const exhibitHash=hash==='cr-income-screening'?'income-diagnosis':['cr-income-race-stage','cr-income-rural-stage'].includes(hash)?'income-test-cost':hash.startsWith('cr-')?hash.slice(3):'';
  if(caseTabs.includes(exhibitHash)){casefile.open=true;showExhibit(exhibitHash);}
  if(steps.includes(hash)&&available(hash))state.step=hash;
  if(blocked)text('save','Browser storage is unavailable. Download your work before leaving.');
  if(invalid)text('save','A previous record was preserved. Download this investigation before leaving.');
  syncIdentity();render();
})();
