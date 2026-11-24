/* Optional field-notebook exercise for the digital Lesson 5 grass runs.
   It never changes a trial or computes real Serengeti carrying capacity. */
(function (root) {
  'use strict';
  const KEY='aplab:openscied:b1-carrying-capacity:range:v1';
  const NAMES={baseline:'Baseline',comparison:'Comparison'};
  const MODES=Object.keys(NAMES), X0=43, X1=538, Y0=28, Y1=167;
  const shown=n=>Number.isInteger(n)?String(n):n.toFixed(1);
  const escape=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const fresh=()=>({v:1,trial:'baseline',baseline:null,comparison:null,note:''});
  const validRound=n=>Number.isInteger(n)&&n>=7&&n<=12;
  const label=(kind,entry)=>NAMES[kind]+(entry?.percent==null?'':' · '+entry.percent+'% grass');
  function dataset(raw) {
    if(!Array.isArray(raw?.rows))return null;
    const rows=Array.from({length:6},(_,i)=>raw.rows.find(row=>row?.round===7+i));
    if(rows.some(r=>!r||!Number.isSafeInteger(r.ending)||r.ending<0))return null;
    const points=rows.map(({round,ending})=>({round,ending}));
    const series=raw.rows.filter(r=>Number.isInteger(r?.round)&&r.round>=1&&r.round<=12&&Number.isSafeInteger(r.ending)&&r.ending>=0)
      .map(({round,ending})=>({round,ending})).sort((a,b)=>a.round-b.round);
    if(Number.isSafeInteger(raw.startingPopulation)&&raw.startingPopulation>=0)series.unshift({round:0,ending:raw.startingPopulation});
    const peak=Math.max(...series.map(p=>p.ending));
    const roles=Number.isInteger(raw.roleSlots)&&raw.roleSlots>=2&&raw.roleSlots<=120?raw.roleSlots:0;
    const startLine=Math.max(4,Math.ceil((peak+1)/4)*4)/2;
    // Use the same role-based population scale as the population-over-time chart.
    const maximum=Math.max(4,Math.ceil(Math.max(roles,peak)/4)*4);
    const percent=Number.isInteger(raw.grassPercent)&&raw.grassPercent>=0&&raw.grassPercent<=100?raw.grassPercent:null;
    const fingerprint=JSON.stringify([percent,raw.roleSlots??null,raw.startingPopulation??null,points.map(p=>p.ending)]);
    return {points,series,maximum,startLine,percent,fingerprint};
  }
  function repeatedBand(points) {
    const counts=new Map();
    points.forEach(p=>counts.set(p.ending,(counts.get(p.ending)||0)+1));
    const repeat=[...counts.keys()].filter(k=>counts.get(k)>1).sort((a,b)=>a-b);
    const values=[...counts.keys()].sort((a,b)=>a-b);
    return {low:(repeat.length?repeat:values)[0],high:(repeat.length?repeat:values).at(-1),counts,hasRepeat:repeat.length>0,flat:values.length===1};
  }
  function readRange(points,lowRound,highRound) {
    const low=points.find(p=>p.round===lowRound), high=points.find(p=>p.round===highRound);
    if(!low||!high)return {code:'partial',low,high,message:'Mark one low and one high from rounds 7–12. Look for values that appear more than once.'};
    const endpoint=low.ending===high.ending?String(low.ending):low.ending+'–'+high.ending;
    if(low.round===high.round)return {code:'same-point',low,high,message:'Choose two different rounds. If the population stayed level, use two rounds with the same value.'};
    if(low.ending>high.ending)return {code:'reversed',low,high,message:'Your low point is above your high point. Read the herd sizes next to the round numbers and try again.'};
    const ref=repeatedBand(points);
    if(low.ending===ref.low&&high.ending===ref.high){
      const wording=ref.flat?'Both marks show the same population. These six rounds stayed at '+endpoint+' wildebeest.':ref.hasRepeat?'Your marks bracket the repeated late values: '+endpoint+' wildebeest.':'Your marks bracket these six observed values: '+endpoint+' wildebeest. None repeat, so this sample does not establish a typical band.';
      return {code:'supported',low,high,message:wording+' This is a model estimate, not a fixed limit or a real Serengeti count.'};
    }
    const actions=[];
    if(low.ending>ref.low)actions.push('Include the '+(ref.hasRepeat?'repeated low values':'lower points')+'.');
    if(high.ending<ref.high)actions.push('Include the '+(ref.hasRepeat?'repeated high values':'higher points')+'.');
    if(low.ending<ref.low||high.ending>ref.high)actions.push('One of your marks is outside the repeated values. A one-time extreme is not the best evidence for a typical band.');
    return {code:'recheck',low,high,message:actions.join(' ')||'Check which values recur in the late rounds and revise your marks.'};
  }
  function judgeEstimate(points,guess){
    const band=repeatedBand(points),middle=(band.low+band.high)/2;
    // A one-unit margin for broad swings; narrow bands need a closer mark
    // so a high or low endpoint alone is not treated as the middle.
    const tolerance=Math.min(1,Math.max(.5,(band.high-band.low)/4));
    if(!Number.isFinite(guess))return null;
    const direction=guess<middle?'up':'down';
    if(Math.abs(guess-middle)>tolerance)return {code:'incorrect',middle,tolerance,message:'Not yet. Move the line '+direction+' toward the center of the late points. A single peak or dip does not represent the typical level.'};
    const evidence=band.flat?'The late rounds stayed near '+shown(middle)+' wildebeest.':band.hasRepeat?'It is near the middle of the repeated late swings, '+band.low+' to '+band.high+' wildebeest.':'It is near the middle of the observed late points. None of their values repeat, so this sample does not establish a typical level.';
    return {code:'correct',middle,tolerance,low:band.low,high:band.high,message:'Correct for this model estimate. '+evidence+' This estimate is within '+(tolerance===1?'1 wildebeest':tolerance===.5?'half a wildebeest':'three quarters of a wildebeest')+' of the middle. It is not a measured Serengeti carrying capacity.'};
  }
  const yAt=(guess,maximum)=>Y1-(Y1-Y0)*guess/maximum;
  const xAt=round=>X0+(X1-X0)*round/12;
  function plot(entry,estimate){
    const max=entry.maximum, line=yAt(estimate,max), shade=xAt(6.5);
    const grid=[0,1,2,3,4].map(i=>{
      const value=max*i/4,y=yAt(value,max);
      return `<line class="cc-range-grid" x1="${X0}" x2="${X1}" y1="${y}" y2="${y}"/><text x="${X0-7}" y="${y+4}" text-anchor="end">${value}</text>`;
    }).join('');
    const marks=[0,3,6,9,12].map(r=>`<text x="${xAt(r)}" y="188" text-anchor="middle">${r}</text>`).join('');
    const points=entry.series.map(p=>xAt(p.round)+','+yAt(p.ending,max)).join(' ');
    return `<svg id="cc-range-plot" viewBox="0 0 560 212" width="560" height="212" role="img" aria-labelledby="cc-range-plot-title cc-range-plot-desc"
        data-y-max="${max}" data-y-top="${Y0}" data-y-bottom="${Y1}">
      <title id="cc-range-plot-title">Simulated wildebeest population by round</title>
      <desc id="cc-range-plot-desc">The points are ${entry.series.map(p=>'round '+p.round+': '+p.ending).join('; ')}. Rounds 7 through 12 are highlighted. Use the keyboard slider below to move your estimate line.</desc>
      <rect class="cc-range-late" x="${shade}" y="${Y0}" width="${X1-shade}" height="${Y1-Y0}"/>
      <rect id="cc-range-accepted-band" x="${shade}" width="${X1-shade}" height="0" aria-hidden="true" hidden/>
      <text class="cc-range-plot-head" x="${X0}" y="18">Wildebeest</text>
      <text class="cc-range-plot-head" x="${(X1+shade)/2}" y="18" text-anchor="middle">Focus: rounds 7–12</text>
      ${grid}<path class="cc-range-axis" d="M${X0} ${Y0}V${Y1}H${X1}"/>
      <polyline class="cc-range-series" points="${points}"/>
      ${entry.series.map(p=>`<circle class="cc-range-point" cx="${xAt(p.round)}" cy="${yAt(p.ending,max)}" r="${p.round>=7?4:3}"/>`).join('')}
      ${marks}<text class="cc-range-plot-head" x="${(X0+X1)/2}" y="205" text-anchor="middle">Round</text>
      <line class="cc-range-grab" aria-hidden="true" x1="${X0}" x2="${X1}" y1="${line}" y2="${line}"/>
      <line id="cc-range-line" class="cc-range-guess" x1="${X0}" x2="${X1}" y1="${line}" y2="${line}"/>
      <circle id="cc-range-handle" class="cc-range-handle" cx="${(X0+X1)/2}" cy="${line}" r="7"/>
      </svg>`;
  }
  function restore(raw) {
    if(raw===null)return fresh();
    try{
      const saved=JSON.parse(raw);
      if(saved?.v!==1||!MODES.includes(saved.trial)||typeof saved.note!=='string'||saved.note.length>1000)return null;
      const out={...fresh(),trial:saved.trial,note:saved.note};
      for(const k of MODES){
        const p=saved[k];
        if(p===null)continue;
        if(typeof p?.for!=='string'||p.for.length>220||!(p.low===null||validRound(p.low))||!(p.high===null||validRound(p.high)))return null;
        const guess=p.guess??null;
        if(guess!==null&&(!Number.isFinite(guess)||guess<0||guess>124||guess*2%1!==0))return null;
        out[k]={for:p.for,low:p.low,high:p.high,guess,locked:p.locked===true&&guess!==null};
      }
      return out;
    }catch(_){return null;}
  }

  function mount(host,{announce,onMarks}={}){
    if(!host)return null;
    let state=fresh(),status='ok',trials={baseline:null,comparison:null},graphKey='',paintKey='',pointer=null;
    try{const saved=restore(root.localStorage.getItem(KEY));if(saved)state=saved;else status='preserved';}
    catch(_){status='blocked';}
    host.classList.add('cc-range');
    const $=s=>host.querySelector(s);
    const saved=k=>state[k]?.for===trials[k]?.fingerprint?state[k]:null;
    const interpretation=k=>trials[k]&&readRange(trials[k].points,saved(k)?.low,saved(k)?.high);
    const populated=()=>MODES.some(k=>trials[k]);
    const estimateFor=k=>saved(k)?.guess??null;
    const lockFor=k=>saved(k)?.locked===true;
    const estimateState=k=>trials[k]&&lockFor(k)?judgeEstimate(trials[k].points,estimateFor(k)):null;
    function persist(){
      if(status==='preserved')return;
      try{root.localStorage.setItem(KEY,JSON.stringify(state));status='ok';}
      catch(_){status='blocked';}
    }
    function storageCopy(){
      if(status==='preserved')return 'The earlier range study could not be read and was kept. Changes in this session will not overwrite it. Download your notes before leaving.';
      if(status==='blocked')return 'The range study could not save on this device. Download your notes before leaving.';
      return '';
    }
    function emitMarks(){
      const k=state.trial, r=interpretation(k), prefix=NAMES[k];
      const marks=[];
      if(estimateFor(k)!==null)marks.push({y:estimateFor(k),label:prefix+' estimate'});
      else if(r?.low && r?.high && r.low.ending===r.high.ending)marks.push({y:r.low.ending,label:prefix+' low & high'});
      else {
        if(r?.low)marks.push({y:r.low.ending,label:prefix+' low'});
        if(r?.high)marks.push({y:r.high.ending,label:prefix+' high'});
      }
      const signature=JSON.stringify([k,trials[k]?.fingerprint,saved(k)?.low,saved(k)?.high,marks]);
      if(signature===graphKey)return;
      graphKey=signature;onMarks?.(marks);
    }
    function pickOptions(entry,kind){
      const data=trials[entry], round=saved(entry)?.[kind]??null;
      return '<option value="">Choose a late round</option>'+data.points.map(r=>'<option value="'+r.round+'"'+(round===r.round?' selected':'')+'>Round '+r.round+' · '+r.ending+' wildebeest</option>').join('');
    }
    function readiness(){
      return populated()?'Drag the dashed line to the level the herd fluctuates around, then lock in your estimate.':'Finish 12 grass-model rounds to mark points here. Rounds 7–12 focus on the later pattern, not the early growth.';
    }
    function compareCopy(){
      const a=estimateState('baseline'),b=estimateState('comparison');
      if(!trials.baseline||!trials.comparison)return 'Run the grass comparison too. Keep the starting herd and model rules the same, and change grass availability.';
      if(a?.code!=='correct'||b?.code!=='correct')return 'Lock and check an estimate for each trial. Did the typical level shift when grass availability changed?';
      return 'With '+(trials.comparison.percent===null?'the comparison setting':trials.comparison.percent+'% of grass roles available')+', compare the two estimates. Each survivor needs food. Changing the grass available can change the number that survives and the number of calves, shifting the level the herd fluctuates around. A single peak is not a fixed carrying capacity.';
    }
    function updateEstimate(){
      const k=state.trial, entry=trials[k];
      if(!entry)return;
      const guess=estimateFor(k),value=guess??entry.startLine, y=yAt(value,entry.maximum);
      const line=$('#cc-range-line'),grab=$('.cc-range-grab'),handle=$('#cc-range-handle'),slider=$('#cc-range-slider');
      for(const el of [line,grab])if(el){el.setAttribute('y1',y);el.setAttribute('y2',y);}
      handle?.setAttribute('cy',y);
      if(slider){slider.value=value;slider.setAttribute('aria-valuetext',shown(value)+' wildebeest'+(guess===null?', starting line not chosen':''));}
      const number=$('#cc-range-line-value'), button=$('#cc-range-lock'), feedback=$('#cc-range-estimate-feedback'),checked=estimateState(k);
      if(number)number.textContent=guess===null?'Starting line: '+shown(value)+' wildebeest (move to choose)':'Your estimate: '+shown(value)+' wildebeest';
      const accepted=$('#cc-range-accepted-band'),caption=$('#cc-range-confirmed'),supported=checked?.code==='correct';
      if(accepted){
        accepted.toggleAttribute('hidden',!supported);
        if(supported){
          const upper=yAt(checked.high,entry.maximum), lower=yAt(checked.low,entry.maximum);
          accepted.setAttribute('y',upper);accepted.setAttribute('height',Math.max(3,lower-upper));
        }
      }
      if(caption){
        caption.hidden=!supported;
        if(supported){
          const bounds=checked.low===checked.high?shown(checked.low):checked.low+'–'+checked.high;
          caption.textContent='Late-round band: '+bounds+' wildebeest.';
          caption.dataset.low=checked.low;caption.dataset.high=checked.high;
        }else{caption.textContent='';delete caption.dataset.low;delete caption.dataset.high;}
      }
      if(button)button.disabled=guess===null;
      if(feedback){feedback.dataset.rangeState=checked?.code||'unlocked';feedback.textContent=checked?.message||(guess===null?'Read the late swings, move the line, then lock in your estimate.':'Ready to check. Select “Lock in my estimate.”');}
    }
    function updateFeedback(){
      const k=state.trial,r=interpretation(k);
      updateEstimate();
      const feedback=$('#cc-range-feedback'),band=$('#cc-range-band'),comparison=$('#cc-range-comparison'),note=$('#cc-range-storage');
      if(feedback&&r){feedback.textContent=r.message;feedback.dataset.rangeState=r.code;}
      if(band&&r){
        const mark=(p,which)=>p?which+' '+p.ending+' (round '+p.round+')':which+' not marked';
        band.textContent='Your marks · '+mark(r.low,'low')+' · '+mark(r.high,'high');
        if(r.low)band.dataset.low=r.low.ending;else delete band.dataset.low;
        if(r.high)band.dataset.high=r.high.ending;else delete band.dataset.high;
      }
      if(note){note.textContent=storageCopy();note.hidden=!note.textContent;}
      if(comparison){
        comparison.textContent=compareCopy();
        for(const mode of MODES){
          const card=$('[data-range-summary="'+mode+'"]'),m=interpretation(mode);
          if(!card)continue;
          const checked=estimateState(mode),g=estimateFor(mode);
          card.textContent=g!==null?shown(g)+' wildebeest · '+(checked?.code==='correct'?'supported':checked?'recheck estimate':'not locked yet'):m?.low&&m?.high?m.low.ending+'–'+m.high.ending+' wildebeest'+(m.code==='supported'?'':' · marks to recheck'):trials[mode]?'Not marked yet':'Trial not ready';
        }
      }
    }
    function draw(){
      const k=state.trial, table=trials[k];
      const renderKey=JSON.stringify([k,MODES.map(id=>trials[id]?.fingerprint),status]);
      if(renderKey===paintKey){updateFeedback();return;}
      paintKey=renderKey;
      host.innerHTML=`<div class="cc-range-head"><div><p class="cc-tag">Range study · Simulated model</p><h3 id="cc-range-title">Estimate the late-round range</h3></div><span class="cc-range-window" aria-hidden="true">7–12</span></div>
        <p class="cc-caption">Carrying capacity describes what resources can support over time. A population can fluctuate around it. Look for repeated highs and lows, not just the single biggest result.</p>
        <p id="cc-range-storage" class="cc-range-limit"${storageCopy()?'':' hidden'}>${storageCopy()}</p>
        <p id="cc-range-readiness">${readiness()}</p>
        ${populated()?`<div class="cc-range-task"><label for="cc-range-trial">Trial to inspect
          <select id="cc-range-trial">${MODES.map(mode=>`<option value="${mode}"${k===mode?' selected':''}${trials[mode]?'':' disabled'}>${label(mode,trials[mode])}${trials[mode]?'':' · finish 12 rounds'}</option>`).join('')}</select></label>
          ${table?`<div class="cc-range-workbench">${plot(table,estimateFor(k)??table.startLine)}
          <div class="cc-range-estimate-controls">
          <label for="cc-range-slider">Move your carrying-capacity estimate <output id="cc-range-line-value" for="cc-range-slider"></output></label>
          <input type="range" id="cc-range-slider" min="0" max="${table.maximum}" step=".5" value="${estimateFor(k)??table.startLine}" aria-describedby="cc-range-estimate-feedback">
          <button type="button" class="cc-primary" id="cc-range-lock">Lock in my estimate</button>
          <p id="cc-range-confirmed" class="cc-range-marks" hidden></p>
          <p id="cc-range-estimate-feedback" class="cc-range-feedback"${typeof announce==='function'?'':' role="status"'}></p></div></div>
          <details class="cc-range-detail"><summary>Optional: mark the late low and high</summary>
          <table class="cc-range-table">
            <caption class="cc-sr">Simulated late-round herd sizes for ${label(k,table)}</caption>
            <thead><tr><th scope="col">Round</th>${table.points.map(p=>`<th scope="col">${p.round}</th>`).join('')}</tr></thead>
            <tbody><tr><th scope="row">Herd size</th>${table.points.map(p=>`<td data-range-round="${p.round}">${p.ending}</td>`).join('')}</tr></tbody>
          </table>
          <div class="cc-range-pickers"><label for="cc-range-low">Mark a low point <select id="cc-range-low" aria-describedby="cc-range-band cc-range-feedback">${pickOptions(k,'low')}</select></label>
          <label for="cc-range-high">Mark a high point <select id="cc-range-high" aria-describedby="cc-range-band cc-range-feedback">${pickOptions(k,'high')}</select></label></div>
          <p id="cc-range-band" class="cc-range-marks"></p><p id="cc-range-feedback" class="cc-range-feedback"${typeof announce==='function'?'':' role="status"'}></p></details>`:''}
          <div class="cc-range-compare" aria-label="Your trial estimates"><dl>${MODES.map(mode=>`<div><dt>${label(mode,trials[mode])}</dt><dd data-range-summary="${mode}"></dd></div>`).join('')}</dl>
          <p id="cc-range-comparison"></p></div>
          <label for="cc-range-estimate">What does this range suggest? <span class="cc-caption">Optional</span></label>
          <textarea id="cc-range-estimate" maxlength="1000" rows="2" placeholder="Name the range and explain how the grass setting may affect it.">${escape(state.note)}</textarea>
        </div>`:''}`;
      updateFeedback();
    }
    function update({baseline,comparison}={}){
      trials={baseline:dataset(baseline),comparison:dataset(comparison)};
      if(!trials[state.trial]&&populated())state.trial=trials.baseline?'baseline':'comparison';
      draw();emitMarks();
    }
    function report(){
      const lines=[];
      for(const mode of MODES){
        const r=interpretation(mode), checked=estimateState(mode), guess=estimateFor(mode);
        if(guess!==null)lines.push(label(mode,trials[mode])+': carrying-capacity estimate '+shown(guess)+' wildebeest'+(checked?.code==='correct'?' (supported by the late simulation; late band '+(checked.low===checked.high?shown(checked.low):checked.low+'–'+checked.high)+' wildebeest)':checked?' (needs rechecking)':' (not locked)')+'.');
        if(!r?.low&&!r?.high)continue;
        const read=(p,name)=>p?name+' '+p.ending+' (round '+p.round+')':name+' not marked';
        lines.push(label(mode,trials[mode])+': '+read(r.low,'low')+', '+read(r.high,'high')+'.'+(r.code==='supported'?'':' Marks are incomplete or need rechecking.'));
      }
      if(state.note.trim())lines.push('Student estimate or reasoning: '+state.note.trim());
      return lines.join('\n');
    }
    function reset(){
      state=fresh();pointer=null;try{root.localStorage.removeItem(KEY);status='ok';}catch(_){status='blocked';}
      paintKey='';graphKey='';draw();emitMarks();
    }
    host.addEventListener('change',e=>{
      const {id,value}=e.target;
      if(id==='cc-range-trial'&&MODES.includes(value)&&trials[value]){
        state.trial=value;persist();draw();$('#cc-range-trial')?.focus({preventScroll:true});emitMarks();announce?.('Now inspecting '+label(value,trials[value])+'.');return;
      }
      const kind=id==='cc-range-low'?'low':id==='cc-range-high'?'high':'';
      const k=state.trial,entry=trials[k];
      if(!kind||!entry)return;
      const round=value===''?null:Number(value);
      if(round!==null&&!validRound(round))return;
      state[k]={for:entry.fingerprint,low:null,high:null,...(saved(k)||{}),[kind]:round};
      persist();updateFeedback();emitMarks();announce?.(interpretation(k).message);
    });
    function selectEstimate(value,saveNow=true){
      const k=state.trial,entry=trials[k];
      if(!entry||!Number.isFinite(value))return;
      const step=Math.max(0,Math.min(entry.maximum,Math.round(value*2)/2));
      if(estimateFor(k)===step)return;
      state[k]={for:entry.fingerprint,low:null,high:null,...(saved(k)||{}),guess:step,locked:false};
      if(saveNow)persist();
      updateFeedback();emitMarks();
    }
    function estimateFromPointer(e,svg){
      const rect=svg.getBoundingClientRect();
      if(!rect.height)return;
      const y=(e.clientY-rect.top)*212/rect.height,max=trials[state.trial]?.maximum;
      if(max!=null)selectEstimate((Y1-y)/(Y1-Y0)*max,false);
    }
    host.addEventListener('pointerdown',e=>{
      const svg=e.target.closest?.('#cc-range-plot');
      if(!svg||('button' in e&&e.button!==0)||pointer!==null)return;
      pointer=e.pointerId;svg.setPointerCapture?.(e.pointerId);
      estimateFromPointer(e,svg);
    });
    host.addEventListener('pointermove',e=>{
      const svg=$('#cc-range-plot');
      if(svg&&pointer===e.pointerId)estimateFromPointer(e,svg);
    });
    const finishPointer=e=>{
      if(pointer!==e.pointerId)return;
      pointer=null;persist();updateFeedback();
    };
    host.addEventListener('pointerup',finishPointer);
    host.addEventListener('pointercancel',finishPointer);
    host.addEventListener('click',e=>{
      if(e.target.closest?.('#cc-range-lock')==null)return;
      const k=state.trial,pick=saved(k);
      if(pick?.guess==null)return;
      state[k]={...pick,locked:true};persist();updateFeedback();announce?.(estimateState(k).message);
    });
    host.addEventListener('input',e=>{
      if(e.target.id==='cc-range-slider'){selectEstimate(Number(e.target.value));return;}
      if(e.target.id!=='cc-range-estimate')return;
      state.note=e.target.value.slice(0,1000);persist();updateFeedback();
    });
    draw();
    return {update,report,reset};
  }

  const api=Object.freeze({mount,key:KEY,dataset,readRange,judgeEstimate});
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CarryingRange=api;
})(typeof window!=='undefined'?window:globalThis);
