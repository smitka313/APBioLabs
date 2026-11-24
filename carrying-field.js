/* OpenSciEd B.1 Lesson 5, Wildebeest Population Data, adapted there from
   Hopcraft et al. (2015). Exact nonblank values from the classroom source
   table. Original scatter illustration: no estimates added between points. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.CarryingField=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='aplab:openscied:b1-carrying-capacity:field:v1';
  const DATA=Object.freeze([
    [1961,263362],[1963,356124],[1965,439124],[1967,483292],[1971,692777],
    [1972,773014],[1977,1400000],[1978,1248934],[1980,1337979],[1982,1208711],
    [1984,1337879],[1986,1146340],[1991,1221783],[1994,917204],[1999,1296944],
    [2000,1245222],[2003,1183966],[2006,1239164],[2009,1272233],[2012,1361548]
  ].map(([year,population])=>Object.freeze({year,population})));
  const TIME=Object.freeze([
    {id:'1961-1977',start:1961,end:1977,label:'1961–1977 · Long increase',hint:'The lesson describes cattle vaccination reducing rinderpest, a disease that had limited the herd. A rising population is consistent with that change, but the graph alone cannot isolate its cause.'},
    {id:'1977-1978',start:1977,end:1978,label:'1977–1978 · One-year decline',hint:'The herd shrank in a single year. Food competition is one possible explanation from the model. A population drop by itself does not identify the limiting factor.'},
    {id:'1978-2012',start:1978,end:2012,label:'1978–2012 · Overall change amid fluctuations',hint:'A small overall rate can hide big changes within the interval, including the low 1994 estimate. An endpoint comparison is not a prediction of change in every year.'},
    {id:'1994-1999',start:1994,end:1999,label:'1994–1999 · What does the data gap hide?',gap:true}
  ].map(Object.freeze));
  const GAP=Object.freeze([
    {value:'by-1999',label:'The population had recovered by the next plotted observation in 1999; the graph cannot tell us exactly when.'},
    {value:'1998',label:'The graph shows that the population recovered in 1998.'},
    {value:'every-year',label:'The graph shows that the population rose by the same amount every year from 1994 to 1999.'}
  ].map(Object.freeze));
  const round=(n)=>Math.round(n);
  const number=n=>n.toLocaleString('en-US',{maximumFractionDigits:2});
  const signed=n=>(n>0?'+':n<0?'−':'')+number(Math.abs(n));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const find=id=>TIME.find(t=>t.id===id);
  const points=(from,to)=>[DATA.find(p=>p.year===from),DATA.find(p=>p.year===to)];
  function rate(start,end){
    const [a,b]=points(start,end);
    if(!a||!b||start>=end)return null;
    const change=b.population-a.population,years=end-start;
    return {start,end,first:a.population,last:b.population,change,years,rate:change/years};
  }
  function parseRate(raw){
    if(typeof raw!=='string')return null;
    const text=raw.trim().replace(/−/g,'-');
    if(!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text))return null;
    const n=Number(text.replace(/,/g,''));
    return Number.isFinite(n)?n:null;
  }
  function checkRate(id,answer){
    const t=find(id),value=parseRate(answer);
    if(!t||t.gap)return null;
    const r=rate(t.start,t.end);
    if(value===null)return {code:'invalid',detail:'Enter a number in wildebeest per year. You can use a leading minus sign for a decline.'};
    if(Math.sign(value)!==Math.sign(r.rate)){
      return {code:'incorrect',detail:'Check the sign. The later population is '+(r.change>0?'larger':'smaller')+', so later minus earlier is '+(r.change>0?'positive':'negative')+'.'};
    }
    // Accept at most one whole individual per year around the unrounded
    // result so a rounded or truncated hand calculation works.
    if(Math.abs(value-r.rate)>1)return {code:'incorrect',detail:'Check the steps: subtract the '+t.start+' population from the '+t.end+' population, then divide by '+r.years+' '+(r.years===1?'year':'years')+'.'};
    return {code:'correct',detail:'Correct. ('+number(r.last)+' − '+number(r.first)+') ÷ '+r.years+' ≈ '+signed(round(r.rate))+' wildebeest per year.',hint:t.hint};
  }
  function checkGap(choice){
    if(!GAP.some(o=>o.value===choice))return {code:'invalid',detail:'Choose the statement best supported by the two plotted points.'};
    const detail='The 1994 estimate is 917,204; the next plotted estimate is 1,296,944 in 1999. The graph shows recovery by 1999, but without 1995–98 observations it cannot show when recovery began or when the drought ended.';
    return {code:choice==='by-1999'?'correct':'incorrect',detail:(choice==='by-1999'?'Correct. ':'Recheck the gap. ')+detail};
  }
  const fresh=()=>({v:1,interval:TIME[0].id,secant:false,entries:{}});
  const blank=()=>({answer:'',reason:'',checked:false});
  function restore(raw){
    if(raw===null)return fresh();
    try{
      const x=JSON.parse(raw);
      if(x?.v!==1||!find(x.interval)||typeof x.secant!=='boolean'||!x.entries||typeof x.entries!=='object'||Array.isArray(x.entries))return null;
      const entries={};
      for(const [id,item] of Object.entries(x.entries)){
        if(!find(id)||typeof item?.answer!=='string'||item.answer.length>25||typeof item.reason!=='string'||item.reason.length>1200||typeof item.checked!=='boolean')return null;
        entries[id]={answer:item.answer,reason:item.reason,checked:item.checked};
      }
      return {v:1,interval:x.interval,secant:x.secant,entries};
    }catch(_){return null;}
  }

  const MAX=1500000,X0=69,X1=676,Y0=27,Y1=232;
  const x=year=>X0+(year-1960)*(X1-X0)/54;
  const y=pop=>Y1-(pop/MAX)*(Y1-Y0);
  const endpoint=t=>[t.start,t.end];
  function plot(t,secant){
    const yearTicks=[1960,1970,1980,1990,2000,2010];
    const popTicks=[0,500000,1000000,1500000];
    const [a,b]=points(t.start,t.end);
    const line=secant&&!t.gap?`<line id="cc-field-secant" x1="${x(a.year)}" y1="${y(a.population)}" x2="${x(b.year)}" y2="${y(b.population)}"/>`:'';
    return `<svg id="cc-field-chart" width="710" height="280" viewBox="0 0 710 280" role="img" aria-labelledby="cc-field-svg-title cc-field-svg-desc">
      <title id="cc-field-svg-title">Wildebeest population estimates, 1961–2012</title>
      <desc id="cc-field-svg-desc">Twenty separate published population estimates, not simulated. Highlighted endpoints are ${t.start} and ${t.end}. There are no plotted values from 1995 through 1998. Exact values are in the table below.</desc>
      <rect class="cc-field-gap" x="${x(1994.5)}" y="${Y0}" width="${x(1998.5)-x(1994.5)}" height="${Y1-Y0}"/>
      ${popTicks.map(n=>`<line class="cc-field-grid" x1="${X0}" x2="${X1}" y1="${y(n)}" y2="${y(n)}"/><text x="${X0-8}" y="${y(n)+4}" text-anchor="end">${n?number(n/1000000)+' M':'0'}</text>`).join('')}
      ${yearTicks.map(n=>`<line class="cc-field-grid" x1="${x(n)}" x2="${x(n)}" y1="${Y0}" y2="${Y1}"/><text x="${x(n)}" y="253" text-anchor="middle">${n}</text>`).join('')}
      <path class="cc-field-axis" d="M${X0} ${Y0}V${Y1}H${X1}"/>
      <text class="cc-field-axis-label" x="${X0}" y="18">Wildebeest</text>
      <text class="cc-field-axis-label" x="${(X0+X1)/2}" y="275" text-anchor="middle">Year</text>
      ${line}
      ${DATA.map(p=>{const isEnd=endpoint(t).includes(p.year);return `<g data-field-year="${p.year}" data-population="${p.population}"${isEnd?' data-endpoint':''}>
        <title>${p.year}: ${number(p.population)} wildebeest</title>
        ${isEnd?`<circle class="cc-field-ring" cx="${x(p.year)}" cy="${y(p.population)}" r="9"/>`:''}
        <circle class="cc-field-dot" cx="${x(p.year)}" cy="${y(p.population)}" r="${isEnd?5:4.5}"/><circle class="cc-field-tap" cx="${x(p.year)}" cy="${y(p.population)}" r="11"/>
      </g>`;}).join('')}</svg>`;
  }
  function table(t){
    return `<div id="cc-field-data" class="cc-table-wrap"><table>
      <caption>Classroom field estimates · 20 plotted entries</caption>
      <thead><tr><th scope="col">Year</th><th scope="col">Estimated wildebeest</th></tr></thead>
      <tbody>${DATA.map(p=>`<tr data-field-row="${p.year}"${endpoint(t).includes(p.year)?' data-endpoint':''}><th scope="row">${p.year}</th><td>${number(p.population)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function mount(host,{announce,getSaveSession,onSaveConflict}={}){
    if(!host)return null;
    const store=host.ownerDocument?.defaultView||globalThis;
    let state=fresh(),storage='ok',inspection='',openTable=false;
    try{const from=restore(getSaveSession?.() ? getSaveSession().read(KEY) : store.localStorage.getItem(KEY));if(from)state=from;else storage='preserved';}
    catch(_){storage='blocked';}
    host.classList.add('cc-field-ui');
    const $=s=>host.querySelector(s);
    const record=()=>state.entries[state.interval]||blank();
    const speak=message=>announce?.(message);
    function persist(){
      if(storage==='preserved')return;
      let result;
      try{result=getSaveSession?.()?.write(KEY,JSON.stringify(state));}catch(_){}
      storage=result?.ok?'ok':'blocked';
      if(!result?.ok)onSaveConflict?.(result);
    }
    const warning=()=>storage==='preserved'?'The earlier field record could not be read and was preserved. Export this session’s work before leaving.':storage==='blocked'?'Field work cannot save on this device. Export it before leaving.':'';
    function currentResult(t,entry){return entry.checked?(t.gap?checkGap(entry.answer):checkRate(t.id,entry.answer)):null;}
    function feedback(){
      const t=find(state.interval), entry=record(), result=currentResult(t,entry);
      const el=$('#cc-rate-feedback'), hint=$('#cc-rate-hint'), warn=$('#cc-field-save-note');
      if(el){el.dataset.fieldState=result?.code||'unchecked';el.textContent=result?.detail||(t.gap?'Compare the two observations before checking the statement.':'Enter your signed average rate, then check it.');}
      if(hint){hint.textContent=result?.hint||'';hint.hidden=!hint.textContent;}
      if(warn){warn.textContent=warning();warn.hidden=!warn.textContent;}
    }
    function draw(){
      const t=find(state.interval),item=record();
      host.innerHTML=`<div class="cc-field-grid-layout">
        <div class="cc-panel cc-content">
          <p class="cc-tag">Source evidence · Not simulated</p><h3>Serengeti wildebeest population, 1961–2012</h3>
          <p class="cc-caption">OpenSciEd B.1 Lesson 5 classroom scatterplot data, adapted from Hopcraft et al. (2015). Only supplied estimates are plotted; the shaded area marks the 1995–98 gap.</p>
          <label class="cc-field-label" for="cc-interval">Choose an interval
          <select id="cc-interval">${TIME.map(x=>`<option value="${x.id}"${t.id===x.id?' selected':''}>${x.label}</option>`).join('')}</select></label>
          ${plot(t,state.secant)}
          <div class="cc-field-key"><span><i class="cc-field-key-dot" aria-hidden="true"></i> Published estimate</span><span><i class="cc-field-key-ring" aria-hidden="true"></i> Selected endpoints</span><span><i class="cc-field-key-gap" aria-hidden="true"></i> 1995–98 gap</span></div>
          ${t.gap?'':`<label class="cc-field-secant-toggle"><input id="cc-field-show-secant" type="checkbox"${state.secant?' checked':''}> Show endpoint comparison line <span class="cc-caption">(not observations between endpoints)</span></label>`}
          <p id="cc-field-inspection" class="cc-caption">${esc(inspection||'Tap a point or open the data table for its exact estimate.')}</p>
          <details id="cc-field-details"${openTable?' open':''}><summary>Exact values · 20 points</summary>${table(t)}</details>
          <p class="cc-caption">A 1993 point is not plotted. The 1994 estimate follows the documented 1993 drought; the next plotted year is 1999. No 2004 point is shown, so the longer activity uses the plotted 2012 endpoint.</p>
        </div>
        <div class="cc-panel cc-content cc-field-work">
          <p class="cc-tag">${t.gap?'Read missing evidence':'Calculate from evidence'}</p>
          <h3>${t.gap?'What can we say about recovery?':'Average population change'}</h3>
          ${t.gap?`<p>Based on the points before and after the gap, choose the defensible claim.</p>
            <label class="cc-field-label" for="cc-field-gap-choice">What does the graph show?
            <select id="cc-field-gap-choice"><option value="">Choose a claim</option>${GAP.map(o=>`<option value="${o.value}"${item.answer===o.value?' selected':''}>${o.label}</option>`).join('')}</select></label>`:
          `<p>Find the populations at both highlighted endpoints. Divide the change in population (later minus earlier) by the years between the endpoints.</p>
            <label class="cc-field-label" for="cc-rate-answer">Your signed rate · wildebeest per year
            <input id="cc-rate-answer" type="text" inputmode="text" maxlength="25" value="${esc(item.answer)}" autocomplete="off" aria-describedby="cc-rate-feedback" placeholder="Enter a number, with − for decline"></label>`}
          <button type="button" class="cc-primary" id="cc-rate-check">${t.gap?'Check the claim':'Check my rate'}</button>
          <p id="cc-rate-feedback" class="cc-field-feedback"${typeof announce==='function'?'':' role="status"'}></p>
          <p id="cc-rate-hint" class="cc-field-hint" hidden></p>
          <label class="cc-field-label" for="cc-field-reasoning">Explain your reasoning <span class="cc-caption">Use evidence from the graph.</span>
          <textarea id="cc-field-reasoning" rows="3" maxlength="1200">${esc(item.reason)}</textarea></label>
          <p id="cc-field-save-note" class="cc-caption" hidden></p>
        </div></div>`;
      feedback();
    }
    const focus=id=>$('#'+id)?.focus({preventScroll:true});
    function rememberToggles(){openTable=$('#cc-field-details')?.open===true;}
    host.addEventListener('change',e=>{
      const id=e.target.id;
      if(id==='cc-interval'&&find(e.target.value)){
        rememberToggles();state.interval=e.target.value;inspection='';persist();draw();focus(id);
      }else if(id==='cc-field-show-secant'){
        rememberToggles();state.secant=e.target.checked;persist();draw();focus(id);
      }else if(id==='cc-field-gap-choice'){
        state.entries[state.interval]={...record(),answer:e.target.value,checked:false};persist();feedback();
      }
    });
    host.addEventListener('input',e=>{
      if(e.target.id==='cc-rate-answer'){
        state.entries[state.interval]={...record(),answer:e.target.value.slice(0,25),checked:false};
      }else if(e.target.id==='cc-field-reasoning'){
        state.entries[state.interval]={...record(),reason:e.target.value.slice(0,1200)};
      }else return;
      persist();feedback();
    });
    function check(){
      const t=find(state.interval);
      state.entries[state.interval]={...record(),checked:true};persist();feedback();
      const r=currentResult(t,record());if(r)speak(r.detail);
    }
    host.addEventListener('keydown',e=>{
      if(e.target.id==='cc-rate-answer'&&e.key==='Enter'){e.preventDefault();check();}
    });
    host.addEventListener('click',e=>{
      if(e.target.closest?.('#cc-rate-check')){check();return;}
      const p=e.target.closest?.('[data-field-year]');
      if(p){
        const v=DATA.find(row=>String(row.year)===p.dataset.fieldYear);
        if(v){inspection=v.year+': '+number(v.population)+' estimated wildebeest.';$('#cc-field-inspection').textContent=inspection;}
      }
    });
    function report(){
      return TIME.flatMap(t=>{
        const entry=state.entries[t.id];
        if(!entry||!entry.answer.trim()&&!entry.reason.trim())return [];
        const answer=t.gap?(GAP.find(x=>x.value===entry.answer)?.label||'Not selected'):entry.answer.trim()?entry.answer.trim()+' wildebeest/year':'Not entered';
        const result=currentResult(t,entry);
        return [t.label+'\n'+(t.gap?'Claim':'Student rate')+': '+answer+'\n'+
          (entry.reason.trim()?'Reasoning: '+entry.reason.trim()+'\n':'')+
          (result?.code==='correct'?'Source check: supported.':result?.code==='incorrect'?'Source check: revisit the evidence.':'Source check: not checked.')];
      }).join('\n\n');
    }
    function reset(){
      state=fresh();inspection='';openTable=false;
      storage='ok';
      draw();
    }
    draw();
    return {update:()=>feedback(),report,reset};
  }
  return Object.freeze({mount,key:KEY,DATA,TIME,rate,parseRate,checkRate,checkGap});
});
