/* B.2 teacher-designed, quantitative extension. The single-atom journey remains unchanged. */
(function(global) {
  'use strict';
  const KEY='aplab:openscied:b2-carbon-journey:budget:v1';
  const TYPES={
    carbon:{units:'carbon units', title:'Carbon ledger', icon:'C', pools:{air:'Atmosphere', ocean:'Ocean', plants:'Living plants', peat:'Peat'}},
    energy:{units:'energy units', title:'Energy ledger', icon:'E', pools:{plants:'Chemical: plants', peat:'Chemical: peat', heat:'Thermal: dispersed'}}
  };
  const TRIALS=[{id:'noFire', key:'baseline', label:'Without fire'}, {id:'fire', key:'fire', label:'With peat fire'}];
  const icon=(id,label)=>'<span class="cb-ledger-icon cb-ledger-icon--'+id+'" aria-hidden="true">'+label+'</span>';
  const el=(tag,classname,value)=>{
    const n=document.createElement(tag);
    if(classname)n.className=classname;
    if(value!=null)n.textContent=value;
    return n;
  };
  const safeText=text=>typeof text==='string'?text.slice(0,2000):'';
  const empty=()=>({v:1,position:-1,furthest:-1,prediction:'',explanation:''});
  const sum=values=>Object.values(values).reduce((result,value)=>result+value,0);
  const signed=value=>value>0?'+'+value:value<0?'−'+Math.abs(value):'0';
  const landscape=`
    <svg class="cb-landscape" viewBox="0 0 730 182" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cb-sky" x2="0" y2="1"><stop stop-color="#122c36"/><stop offset="1" stop-color="#6c8272"/></linearGradient>
        <linearGradient id="cb-earth" x2="0" y2="1"><stop stop-color="#7e6145"/><stop offset="1" stop-color="#2e2525"/></linearGradient>
        <radialGradient id="cb-embers"><stop stop-color="#f9bd62" stop-opacity=".72"/><stop offset="1" stop-color="#d85736" stop-opacity="0"/></radialGradient>
        <pattern id="cb-strata" width="56" height="18" patternUnits="userSpaceOnUse"><path d="M0 10q12-3 21 0t35 1M13 15h14m17-11h9" stroke="#d7b183" stroke-opacity=".31" stroke-width="1" fill="none"/></pattern>
        <g id="cb-tree">
          <path d="M8 42V19l-2 6H1l5-9H3l4-5H4L8 0l4 11H9l4 5h-3l6 9H9v17Z" fill="currentColor"/>
        </g>
      </defs>
      <path fill="url(#cb-sky)" d="M0 0h730v182H0z"/>
      <path fill="#c2b47c" opacity=".32" d="M434 46a18 18 0 1 1 36 0 18 18 0 1 1-36 0"/>
      <path fill="#61796c" d="m0 77 72-10 77 9 112-25 89 29 79-17 85 13 65-26 151 37v19H0z"/>
      <path fill="#354c47" d="m0 85 111 7 75-11 95 10 72-13 100 15 83-9 53 7 73-16 68 20v30H0z"/>
      <g style="color:#243d37">
        <use href="#cb-tree" transform="translate(337 72) scale(.72)"/><use href="#cb-tree" transform="translate(358 64) scale(.9)"/><use href="#cb-tree" transform="translate(372 79) scale(.56)"/>
        <use href="#cb-tree" transform="translate(492 65) scale(.92)"/><use href="#cb-tree" transform="translate(505 74) scale(.8)"/><use href="#cb-tree" transform="translate(526 54) scale(1.16)"/>
        <use href="#cb-tree" transform="translate(552 62) scale(.98)"/><use href="#cb-tree" transform="translate(568 73) scale(.78)"/><use href="#cb-tree" transform="translate(654 61) scale(.99)"/>
      </g>
      <path fill="url(#cb-earth)" d="M0 112q111-14 201-2t147 0 155 0 227-5v77H0Z"/>
      <path fill="url(#cb-strata)" d="M0 126q199-12 282 4t210-4 238 0v56H0Z"/>
      <path d="M0 116q131-14 218-2t161 1 152-1 199-4M0 155q181-11 266 2t158 1 173-5 133-2" stroke="#cca785" stroke-opacity=".55" fill="none"/>
      <ellipse class="cb-glow" cx="604" cy="145" rx="83" ry="31" fill="url(#cb-embers)"/>
      <path class="cb-emberline" d="m565 147 16-3 5 7 20-10 12 3 17-8 21 2m-86 20 18 2 24-8 21 3 13-4" stroke="#e58a51" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;
  const template=`
    <header class="cb-intro">${landscape}<div class="cb-intro-text">
      <p class="cb-eyebrow">B.2 model extension · Simulated</p>
      <h2 id="cb-title" tabindex="-1">Carbon &amp; Energy Budget</h2>
      <p>Compare two bogs that start the same. Only one burns. Follow where the carbon goes and how the energy changes form.</p>
    </div></header>
    <div class="cb-setup" id="cb-setup">
      <div class="cb-panel cb-prediction">
        <label for="cb-prediction">Predict: If peat burns, what happens to carbon in the air and the energy stored in peat?</label>
        <textarea id="cb-prediction" rows="2" maxlength="2000" placeholder="I predict…"></textarea>
      </div>
      <div class="cb-panel cb-control" id="cb-controls">
        <div id="cb-stage" data-stage-index="-1"><strong id="cb-stage-name">Same start. One difference.</strong><p id="cb-stage-description">Run the two trials together to trace what moves and what changes form.</p></div>
        <div class="cb-actions"><button id="cb-start" class="btn btn--primary" type="button">Start both trials</button>
          <button id="cb-prev" class="btn" type="button" hidden>Previous</button>
          <button id="cb-next" class="btn btn--primary" type="button" hidden>Next checkpoint</button>
        </div>
      </div>
    </div>
    <div class="cb-pair" id="cb-comparison" hidden></div>
    <section class="cb-panel cb-explain" id="cb-explain" aria-labelledby="cb-explain-title" hidden>
      <div class="cb-writing">
        <h3 id="cb-explain-title">Explain the difference</h3>
        <label for="cb-explanation">How can both trials have the same total carbon but different amounts in the atmosphere? Explain what happened to the chemical energy in peat, too. Use numbers from both ledgers.</label>
        <textarea id="cb-explanation" rows="4" maxlength="2000" placeholder="My evidence shows…"></textarea>
      </div>
      <div class="cb-evidence" id="cb-explain-evidence"></div>
      <p class="small cb-report-note">Ready to turn it in? <strong>Preview report</strong> includes your Journey and Budget work. <strong>Download budget evidence</strong> saves just this comparison.</p>
    </section>
    <details class="cb-panel cb-detail" id="cb-log" hidden><summary>Full checkpoint data</summary><div id="cb-log-data"></div></details>
    <details class="cb-panel cb-detail"><summary>What this model tracks</summary>
      <p>These values are made-up model units, not field observations or measurements in grams or joules. Carbon units count the same carbon across four reservoirs. Energy units track stored chemical energy and energy transferred as heat to the surroundings; sunlight is an input, not a store. This extension uses the lesson’s processes but does not change the original dice journey.</p>
    </details>
    <div class="cb-tools"><button id="cb-download" class="btn" type="button" disabled>Download budget evidence</button>
      <button id="cb-reset" class="btn" type="button" disabled>Start a new budget…</button>
      <p id="cb-download-status" class="cb-download-status"></p></div>
    <details class="cb-panel cb-detail" id="cb-download-fallback" hidden><summary>Copy the budget evidence instead</summary>
      <label for="cb-copy">Text to copy</label><textarea id="cb-copy" rows="5" readonly></textarea>
    </details>
    <p id="cb-save-status" class="cb-save-status" role="status" hidden></p>
    <dialog id="cb-reset-dialog" aria-labelledby="cb-reset-title">
      <form method="dialog"><h3 id="cb-reset-title">Start a new budget?</h3>
        <p>This clears the comparison and your responses here. Your atom journey stays unchanged.</p>
        <div class="cb-actions"><button class="btn" value="cancel" autofocus>Keep my work</button>
        <button class="btn btn--primary" id="cb-confirm-reset" value="reset">Clear budget only</button></div>
      </form>
    </dialog>`;
  const transfers={
    carbon:{air:'Atmosphere',ocean:'Ocean',plants:'Plants',peat:'Peat'},
    energy:{sunlight:'Sunlight',plants:'Plant chemical energy',peat:'Peat chemical energy',heat:'Dispersed thermal energy'}
  };
  function buildFrames(model) {
    const states=[model.create()];
    const max=Math.max(8,(model.STEPS?.length||0)+2);
    while(!states.at(-1).done && states.length<=max) {
      const last=states.at(-1), next=model.step(last);
      if(!next || next===last || next.index===last.index) break;
      states.push(next);
    }
    return states;
  }
  function savedBudget(last, session) {
    let original=null;
    try {
      original=session ? session.read(KEY) : localStorage.getItem(KEY);
      if(original===null)return {memory:empty(),preserve:false,original};
      const data=JSON.parse(original);
      if(data && data.v===1 && Number.isInteger(data.position) && Number.isInteger(data.furthest) &&
        data.position>=-1 && data.furthest>=data.position && data.furthest<=last &&
        typeof data.prediction==='string' && typeof data.explanation==='string') {
        return {memory:{v:1,position:data.position,furthest:data.furthest,prediction:safeText(data.prediction),explanation:safeText(data.explanation)},preserve:false,original};
      }
    } catch (_) {}
    return {memory:empty(),preserve:true,original};
  }
  function budgetData(memory,frames,model,backup=null) {
    if(memory.furthest<0&&!memory.prediction.trim()&&!memory.explanation.trim()&&backup===null)return null;
    return {
      simulated:true, units:{carbon:'carbon model units',energy:'energy model units'}, ...memory,
      checkpoints:frames.slice(0,memory.furthest+1).map((frame,index)=>({
        index, title:index ? model.STEPS[index-1]?.title || 'Checkpoint '+index : 'Starting budgets',
        baseline:frame.baseline, fire:frame.fire
      })),
      ...(backup!==null ? {unreadableBackup:backup} : {})
    };
  }
  function readExport(saveSession) {
    const model=global.CarbonBudgetLogic;
    if(!model||!saveSession)return null;
    const frames=buildFrames(model), saved=savedBudget(frames.length-1,saveSession);
    return budgetData(saved.memory,frames,model,saved.preserve?saved.original:null);
  }
  function mount(host,{announce=()=>{},journeyEvidence=()=>'',saveSession,reportStudent=()=>null}={}) {
    const model=global.CarbonBudgetLogic;
    if(!host || !model)return null;
    if(host.__carbonBudgetUI)return host.__carbonBudgetUI;
    host.classList.add('cb-app');
    host.innerHTML=template;
    const q=id=>host.querySelector('#'+id);
    const frames=buildFrames(model), last=frames.length-1;
    const fireIndex=frames.findIndex(f=>f.fire.ledger.at(-1)?.id==='peat-fire');
    let {memory,preserve,original}=savedBudget(last,saveSession);
    const saveNote=q('cb-save-status');
    function status(message) {
      saveNote.hidden=!message;
      saveNote.textContent=message;
    }
    function conflict(result) {
      if(!result || result.ok || result.reason==='unavailable') return false;
      status((result.reason==='erased'?'The budget was cleared in another tab.':'The budget was changed in another tab.')+
        ' This tab will not overwrite it. Download your open work before reloading.');
      return true;
    }
    function save() {
      if(preserve)return false;
      const result=saveSession?.write(KEY,JSON.stringify({...memory,lastVisitedAt:Date.now()}));
      if(result?.ok){status('');return true;}
      if(!conflict(result))status('This browser blocked saving. Download or copy your work before closing.');
      return false;
    }
    if(preserve)status('Earlier budget progress could not be read and was not overwritten. Download or copy any new work before closing.');
    if(saveSession){
      const guard=global.OpenSciEdSaveSession;
      conflict(saveSession.check(KEY));
      global.addEventListener('storage',event=>{
        if(!event.key||[KEY,guard.globalKey,guard.scopeKey('b2-carbon-journey'),guard.resetKey(KEY)].includes(event.key)){
          conflict(saveSession.check(KEY));
        }
      });
    }
    function descriptor(position) {
      if(position<1)return {title:'Starting budgets',description:'Check that both trials begin with the same amounts. Advance the two trials together.'};
      const entry=model.STEPS[position-1]||{};
      return {title:entry.title || entry.label || 'Checkpoint '+position,
        description:entry.description || entry.note || entry.text || ''};
    }
    function energyTotal(energy) {return energy.plants+energy.peat+energy.heat;}
    const scale={
      carbon:Math.max(...frames.flatMap(f=>TRIALS.flatMap(({key})=>Object.values(f[key].carbon))))||1,
      energy:Math.max(...frames.flatMap(f=>TRIALS.flatMap(({key})=>Object.keys(TYPES.energy.pools).map(pool=>f[key].energy[pool]))))||1
    };
    function poolRow(key,label,value,max,format='stock') {
      const item=el('div','cb-pool cb-pool--'+format);
      item.dataset.pool=key;item.dataset.units=String(value);
      const lane=el('dt','cb-pool-label',label);
      const measure=el('dd','cb-pool-measure');
      measure.append(el('strong','cb-amount',value));
      if(format==='stock'){
        const bar=el('span','cb-bar'), fill=el('span','cb-fill');
        bar.setAttribute('aria-hidden','true');fill.style.width=(100*value/max)+'%';bar.append(fill);measure.append(bar);
      }
      item.append(lane,measure);
      return item;
    }
    function transferLabel(kind, move) {
      if(!move || move.amount===0)return 'No tracked transfer';
      const names=transfers[kind];
      return names[move.from]+' → '+names[move.to]+' · '+move.amount+' '+TYPES[kind].units;
    }
    function ledger(kind, branch) {
      const def=TYPES[kind], data=branch[kind], frame=el('div','cb-ledger');
      frame.dataset.ledger=kind;
      const heading=el('div','cb-ledger-top');
      heading.innerHTML=icon(kind,def.icon);
      heading.append(el('h4','',def.title),el('span','cb-unit',def.units));frame.append(heading);
      const list=el('dl','cb-pools');
      Object.entries(def.pools).forEach(([key,label])=>list.append(poolRow(key,label,data[key],scale[kind])));
      if(kind==='carbon')list.append(poolRow('total','Total carbon',sum(data),1,'total'));
      else {
        list.append(poolRow('accounted','Stored + transferred',energyTotal(data),1,'total'),
          poolRow('sunlight','Sunlight in so far',data.sunlight,1,'input'));
      }
      const current=branch.ledger.at(-1);
      if(current){
        const transfer=el('p','cb-transfer',transferLabel(kind,current[kind]));
        transfer.dataset.from=current[kind].from||'';
        transfer.dataset.to=current[kind].to||'';
        transfer.dataset.units=String(current[kind].amount);
        frame.append(transfer);
      } else frame.append(el('p','cb-transfer','Starting amounts'));
      frame.append(list);
      return frame;
    }
    function trialCard(trial, branch) {
      const card=el('section','cb-panel cb-trial');
      card.dataset.budgetTrial=trial.id;
      const title=el('header','cb-trial-heading');
      title.append(el('h3','',trial.label),el('span','cb-trial-chip',trial.id==='fire'?'Fire trial':'Comparison trial'));
      card.append(title);
      const ledgers=el('div','cb-ledgers');ledgers.append(ledger('carbon',branch),ledger('energy',branch));
      card.append(ledgers);
      return card;
    }
    function checkpointTable(position){
      const host=q('cb-log-data');
      if(position<0){host.replaceChildren();return;}
      const makeTable=(kind,columns) => {
        const def=TYPES[kind];
        const table=el('table','cb-table');
        table.append(el('caption','',def.title+' · '+def.units));
        const headings=el('thead'), first=el('tr');
        ['Checkpoint and trial',...columns.map(c=>c[1])].forEach((text)=>{
          const th=el('th','',text);th.scope='col';first.append(th);
        });
        headings.append(first);table.append(headings);
        const body=el('tbody');
        frames.slice(0,position+1).forEach((state,index)=>TRIALS.forEach(({key,label})=>{
          const row=el('tr'), stage=el('th');
          stage.scope='row';stage.append(el('strong','',descriptor(index).title),el('span','',label));
          row.append(stage);
          const branch=state[key], values=branch[kind];
          columns.forEach(([pool])=>row.append(el('td','',pool==='total'?sum(values):pool==='accounted'?energyTotal(values):values[pool])));
          body.append(row);
        }));
        table.append(body);return table;
      };
      host.replaceChildren(makeTable('carbon',[...Object.entries(TYPES.carbon.pools),['total','Total']]),
        makeTable('energy',[...Object.entries(TYPES.energy.pools),['sunlight','Sunlight in'],['accounted','Stored + transferred']]));
    }
    function finalEvidence(){
      const compare=el('dl','cb-evidence-grid');
      const end=frames[last];
      const readings=[
        ['air','Carbon in air',end.baseline.carbon.air,end.fire.carbon.air,'carbon units'],
        ['peat','Carbon in peat',end.baseline.carbon.peat,end.fire.carbon.peat,'carbon units'],
        ['chemical','Chemical energy in peat',end.baseline.energy.peat,end.fire.energy.peat,'energy units'],
        ['heat','Thermal energy transferred',end.baseline.energy.heat,end.fire.energy.heat,'energy units']
      ];
      readings.forEach(([pool,label,no,fire,unit])=>{
        const row=el('div','cb-reading');row.dataset.comparePool=pool;row.dataset.noFire=no;row.dataset.fire=fire;
        const name=el('dt','',label), val=el('dd');
        const without=el('strong','',no), withFire=el('strong','',fire);
        without.setAttribute('aria-label','Without fire: '+no);
        withFire.setAttribute('aria-label','With peat fire: '+fire);
        const arrow=el('span','cb-reading-arrow','→');arrow.setAttribute('aria-hidden','true');
        const values=el('span','cb-reading-values');values.append(without,arrow,withFire);
        val.append(values,el('span','cb-reading-unit',unit));row.append(name,val);compare.append(row);
      });
      const head=el('h4','','Final evidence'), key=el('p','cb-evidence-key','Without fire → With peat fire');
      const target=q('cb-explain-evidence');
      target.replaceChildren(head,key,compare);
      const journey=safeText(journeyEvidence()).trim();
      if(journey)target.append(el('p','cb-journey-link','From your atom journey: '+journey));
    }
    function draw(){
      const position=memory.position, running=position>=0, atEnd=running && position===last;
      host.dataset.budgetStarted=running?'true':'false';
      host.dataset.budgetFire=fireIndex>=0&&position>=fireIndex?'true':'false';
      q('cb-stage').dataset.stageIndex=String(position);
      if(running){
        const phase=descriptor(position);
        q('cb-stage-name').textContent=phase.title+' · '+(position+1)+' of '+frames.length;
        q('cb-stage-description').textContent=phase.description;
      } else {
        q('cb-stage-name').textContent='Same start. One difference.';
        q('cb-stage-description').textContent='Run the two trials together to trace what moves and what changes form.';
      }
      q('cb-start').hidden=running;
      q('cb-prev').hidden=!running||position===0;
      q('cb-next').hidden=!running||atEnd;
      q('cb-comparison').hidden=!running;
      if(running){
        const active=frames[position], area=q('cb-comparison');
        area.replaceChildren(...TRIALS.map(trial=>trialCard(trial,active[trial.key])));
      }
      const hasEvidence=memory.furthest===last;
      q('cb-explain').hidden=!hasEvidence;
      if(hasEvidence)finalEvidence();
      q('cb-log').hidden=!running;
      if(q('cb-log').open)checkpointTable(memory.furthest);
      refreshTools();
      return atEnd;
    }
    function go(position){
      if(position<0||position>last)return;
      memory.position=position; memory.furthest=Math.max(memory.furthest,position);
      const atEnd=draw();save();
      const {title}=descriptor(position);
      announce((position===0?'Both trials started. ':'')+title+'. '+(atEnd?'Final evidence is available with your explanation.':'Checkpoint '+(position+1)+' of '+frames.length+'.'));
      if(position===0)q('cb-next').focus({preventScroll:true});
      else if(atEnd)q('cb-stage').focus({preventScroll:true});
    }
    function exportReport(){
      if(memory.position<0&&!memory.prediction.trim()&&!memory.explanation.trim())return '';
      const lines=['Carbon & Energy Budget (simulated model units)','Matched trials: without fire and with peat fire. Not measured field data.'];
      const student=reportStudent(preserve);
      if(student?.name)lines.push('Name: '+student.name);
      if(student?.period)lines.push('Class period: '+student.period);
      if(memory.prediction.trim())lines.push('Prediction: '+memory.prediction.trim());
      if(memory.furthest>=0){
        lines.push('Last checkpoint reached: '+descriptor(memory.furthest).title);
        const current=frames[memory.furthest];
        TRIALS.forEach(({key,label})=>{
          const {carbon:c,energy:e}=current[key];
          lines.push(label+': air '+c.air+', ocean '+c.ocean+', plants '+c.plants+', peat '+c.peat+'; '+sum(c)+' total carbon units.');
          lines.push('  Energy units: chemical in plants '+e.plants+', chemical in peat '+e.peat+', thermal transferred '+e.heat+', sunlight input '+e.sunlight+'.');
        });
        if(memory.furthest===last)lines.push('Both trials: '+energyTotal(current.baseline.energy)+' energy units stored or transferred, including '+current.baseline.energy.sunlight+' that entered from sunlight.');
        const {baseline,fire}=current;
        lines.push('Fire minus no-fire: air carbon '+signed(fire.carbon.air-baseline.carbon.air)+', peat carbon '+signed(fire.carbon.peat-baseline.carbon.peat)+
          '; peat chemical energy '+signed(fire.energy.peat-baseline.energy.peat)+', thermal energy transferred '+signed(fire.energy.heat-baseline.energy.heat)+'.');
      }
      if(memory.explanation.trim())lines.push('Explanation: '+memory.explanation.trim());
      return lines.join('\n');
    }
    function refreshTools() {
      const hasWork=memory.position>=0||Boolean(memory.prediction.trim()||memory.explanation.trim()||original);
      q('cb-download').disabled=!hasWork;
      q('cb-reset').disabled=!hasWork;
    }
    function download() {
      const result=exportReport(), filename=result?'Carbon-Energy-Budget.txt':'Carbon-Budget-preserved-save.txt';
      const text=result || (preserve&&original) || '';
      if(!text)return;
      const fallback=q('cb-download-fallback');
      fallback.hidden=false;q('cb-copy').value=text;
      const note=q('cb-download-status');
      let url,link;
      try {
        link=el('a');
        if(!('download' in link))throw new Error('Download attribute unavailable');
        url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
        link.href=url;link.download=filename;link.hidden=true;
        host.append(link);link.click();
        note.textContent='Download requested: '+filename+'. Check your downloads, or copy the text below.';
      } catch(_) {
        fallback.open=true;
        note.textContent='The download could not start. Copy the text below to save your work.';
      } finally {
        link?.remove();
        if(url)setTimeout(()=>URL.revokeObjectURL(url),30000);
      }
      announce(note.textContent);
    }
    function reset() {
      const result=saveSession?.reset(KEY);
      if(!result?.ok){if(!conflict(result))status('Budget progress could not be cleared here.');return false;}
      original=null;preserve=false;memory=empty();status('');
      q('cb-prediction').value='';q('cb-explanation').value='';
      q('cb-copy').value='';q('cb-download-status').textContent='';
      q('cb-download-fallback').open=false;q('cb-download-fallback').hidden=true;
      q('cb-log').open=false;q('cb-log-data').replaceChildren();
      const pair=q('cb-comparison');pair.replaceChildren();
      q('cb-explain-evidence').replaceChildren();
      draw();return true;
    }
    q('cb-stage').tabIndex=-1;
    q('cb-start').addEventListener('click',()=>go(0));
    q('cb-prev').addEventListener('click',()=>go(memory.position-1));
    q('cb-next').addEventListener('click',()=>go(memory.position+1));
    q('cb-log').addEventListener('toggle',()=>{if(q('cb-log').open)checkpointTable(memory.furthest);});
    ['prediction','explanation'].forEach(field=>{
      const input=q('cb-'+field);
      input.value=memory[field];
      input.addEventListener('input',()=>{memory[field]=safeText(input.value);save();refreshTools();});
    });
    const dialog=q('cb-reset-dialog');
    q('cb-download').addEventListener('click',download);
    q('cb-reset').addEventListener('click',()=>{
      dialog.returnValue='';
      dialog.showModal();
    });
    dialog.addEventListener('close',()=>{
      if(dialog.returnValue==='reset'&&reset()){
        q('cb-start').focus({preventScroll:true});
        announce('Budget cleared. Your atom journey was not changed.');
      }
    });
    const api=Object.freeze({update:draw,report:exportReport,reset,exportData:()=>budgetData(memory,frames,model,preserve?original:null)});
    host.__carbonBudgetUI=api;
    draw();
    return api;
  }
  global.CarbonBudgetUI=Object.freeze({mount,readExport});
})(window);
