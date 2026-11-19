(function(){
  'use strict';
  const KEY='aplab:openscied:b3-cell-cycle:v1';
  const $=function(s,root){return (root||document).querySelector(s);};
  const $$=function(s,root){return Array.from((root||document).querySelectorAll(s));};
  const scenarios=[
    {title:'A steady cycle',text:'The cell has the materials it needs. DNA was copied, and no problem was detected.',expected:'continue',good:'The cell can continue through the cycle and divide.',disrupted:'The cell continues through the cycle and divides.'},
    {title:'Not enough materials',text:'The cell is missing some of the materials it needs to grow and divide.',expected:'pause',good:'Cell-cycle controls pause the cycle while the cell responds to the shortage.',disrupted:'In this simplified model, a disrupted checkpoint lets the cycle continue even though materials are missing.'},
    {title:'DNA damage that may be repaired',text:'A check finds DNA damage that may be repairable before division.',expected:'pause',good:'The cycle pauses while the cell responds to the damage. If repair succeeds, the cell may continue later.',disrupted:'The disrupted response may let the cell continue before the damage is resolved. A DNA change could be copied into daughter cells.'},
    {title:'Severe DNA damage',text:'A check finds serious DNA damage that cannot be repaired.',expected:'stop',good:'The cell stops before dividing. A cell with severe damage should not simply pass it to daughter cells.',disrupted:'The disrupted response may allow the cell to continue with serious damage. This could pass a DNA change to daughter cells; it does not by itself mean cancer.'}
  ];
  const labels={continue:'Continue toward division',pause:'Pause for a check or response',stop:'Stop before dividing'};
  const state={game:{mode:'solo',players:1,round:0,card:0,player:1,awaiting:false,done:false,logs:[]},trials:[],fields:{},quick:''};
  function readStore(){
    try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d&&d.v===1){if(d.game)state.game=Object.assign(state.game,d.game);if(Array.isArray(d.trials))state.trials=d.trials;if(d.fields)state.fields=d.fields;if(d.quick)state.quick=d.quick;}}
    catch(e){}
  }
  function save(){
    try{
      state.fields={};
      $$('input[type=radio]:checked,input[type=checkbox],textarea,select').forEach(function(el){
        if(el.name==='prediction')return;
        if(el.type==='checkbox')state.fields[el.id]=el.checked;
        else if(el.type==='radio')state.fields[el.name]=el.value;
        else state.fields[el.id]=el.value;
      });
      localStorage.setItem(KEY,JSON.stringify({v:1,game:state.game,trials:state.trials,fields:state.fields,quick:state.quick}));
      $('#save-status').textContent='Saved on this device.';
    }catch(e){$('#save-status').textContent='This browser could not save your work. Download a copy before leaving.';}
  }
  function restoreFields(){
    Object.keys(state.fields||{}).forEach(function(id){
      const value=state.fields[id];
      if(id==='quick-check'||id==='game-mode'){
        const el=$('input[name="'+id+'"][value="'+CSS.escape(value)+'"]');if(el)el.checked=true;
      }else{
        const el=document.getElementById(id);
        if(el){if(el.type==='checkbox')el.checked=!!value;else el.value=value;}
      }
    });
    const mode=$('input[name="game-mode"]:checked');
    $('#group-size-wrap').hidden=!mode||mode.value!=='group';
    if(state.quick)$('#background-feedback').textContent=state.quick;
    $('#age-value').textContent=$('#age-slider').value;
  }
  function resultFor(card,round){
    const s=scenarios[card];
    if(round===1)return {kind:s.expected,text:s.good};
    if(card===0)return {kind:'continue',text:s.disrupted};
    if(card===1)return {kind:'continue',text:s.disrupted};
    if(card===2)return {kind:'continue',text:s.disrupted};
    return {kind:'continue',text:s.disrupted};
  }
  function roundName(round){return round===1?'Round 1 · controls working':'Round 2 · checkpoint response disrupted';}
  function renderGame(){
    const g=state.game,panel=$('#game-panel');
    if(!g.round){panel.hidden=true;return;}
    panel.hidden=false;
    $$('input[name="game-mode"]').forEach(function(el){el.disabled=true;});
    $('#group-size').disabled=true;
    $('#prediction-set').hidden=false;
    $('#prediction-set').disabled=false;
    $('#reveal-outcome').hidden=false;
    $('#next-scenario').hidden=true;
    $('#game-feedback').hidden=true;
    $('#round-summary').hidden=true;
    $('#round-label').textContent=roundName(g.round);
    $('#player-label').textContent=g.mode==='group'?'Player '+g.player+' of '+g.players:'Solo play';
    $('#card-label').textContent='Condition '+Math.min(g.card+1,4)+' of 4';
    if(g.done||g.card>=4){showSummary();return;}
    const sc=scenarios[g.card];
    $('#scenario-title').textContent=sc.title;
    $('#scenario-text').textContent=sc.text;
    $('#round-rule').textContent=g.round===1?
      'Round 1: Assume cell-cycle controls are working. Predict whether the cell continues, pauses, or stops.':
      'Round 2: One checkpoint response is disrupted. Predict how the cell may respond to the same condition.';
    $$('input[name="prediction"]').forEach(function(el){el.checked=false;});
    if(g.awaiting){
      const last=g.logs[g.logs.length-1];
      if(last&&last.round===g.round&&last.card===g.card&&last.player===g.player){
        $('input[name="prediction"][value="'+last.prediction+'"]').checked=true;
        $('#prediction-set').disabled=true;
        $('#reveal-outcome').hidden=true;
        displayOutcome(last);
        $('#next-scenario').hidden=false;
        $('#next-scenario').textContent=g.card===3?'Finish this round':'Next condition';
      }
    }
  }
  function startRound(round){
    const mode=$('input[name="game-mode"]:checked').value;
    const count=mode==='group'?Number($('#group-size').value):1;
    const previousLogs=state.game.logs||[];
    state.game={mode:mode,players:count,round:round,card:0,player:1,awaiting:false,done:false,logs:round===2?previousLogs:[]};
    $('#start-round1').hidden=true;
    $('#start-round2').hidden=true;
    renderGame();save();
  }
  function displayOutcome(log){
    const r=resultFor(log.card,log.round),matches=log.matches;
    const box=$('#game-feedback');box.hidden=false;
    box.innerHTML='<h4>'+ (matches?'Your prediction matches this model.':'Compare your prediction with the model.') +'</h4><p><strong>Model response:</strong> '+r.text+'</p><p><strong>Why:</strong> '+(log.round===1?'Working controls can pause the cycle so the cell can respond before division.':'When a checkpoint response is disrupted, a cell may continue before a problem is resolved. The model shows a possible pathway, not a diagnosis.')+'</p>';
  }
  function reveal(){
    const g=state.game;
    if(!g.round||g.card>=4||g.awaiting)return;
    const selected=$('input[name="prediction"]:checked');
    if(!selected){$('#game-feedback').hidden=false;$('#game-feedback').textContent='Choose a prediction first. You can change it before revealing the model response.';return;}
    const r=resultFor(g.card,g.round);
    const log={round:g.round,card:g.card,player:g.player,prediction:selected.value,outcome:r.kind,matches:selected.value===r.kind};
    g.logs.push(log);g.awaiting=true;
    $('#prediction-set').disabled=true;
    $('#reveal-outcome').hidden=true;
    displayOutcome(log);
    $('#next-scenario').hidden=false;
    $('#next-scenario').textContent=g.card===3?'Finish this round':'Next condition';
    save();
  }
  function countsFor(round){
    const logs=state.game.logs.filter(function(x){return x.round===round;});
    return {
      continue:logs.filter(x=>x.outcome==='continue').length,
      pause:logs.filter(x=>x.outcome==='pause').length,
      stop:logs.filter(x=>x.outcome==='stop').length,
      carried:logs.filter(x=>x.card>=2&&x.outcome==='continue'&&round===2).length,
      predictions:logs.length
    };
  }
  function showSummary(){
    const g=state.game;
    g.done=true;
    $('#scenario-title').textContent=roundName(g.round)+' complete';
    $('#scenario-text').textContent=g.mode==='group'?'Compare the group’s outcomes. This is shared evidence, not a competition.':'Review the four model responses before continuing.';
    $('#round-rule').textContent='The model does not award points. Look for how the cell’s condition and checkpoint response changed the outcome.';
    $('#prediction-set').hidden=true;$('#reveal-outcome').hidden=true;$('#game-feedback').hidden=true;$('#next-scenario').hidden=true;
    const c=countsFor(g.round),sum=$('#round-summary');
    let comparison='';
    if(g.round===2){
      const a=countsFor(1),b=countsFor(2);
      comparison='<div class="table-wrap"><table class="data"><caption>Compare the two rounds</caption><thead><tr><th>Outcome</th><th>Round 1</th><th>Round 2</th></tr></thead><tbody><tr><th>Continued toward division</th><td>'+a.continue+'</td><td>'+b.continue+'</td></tr><tr><th>Paused</th><td>'+a.pause+'</td><td>'+b.pause+'</td></tr><tr><th>Stopped before division</th><td>'+a.stop+'</td><td>'+b.stop+'</td></tr><tr><th>Possible DNA changes carried forward</th><td>'+a.carried+'</td><td>'+b.carried+'</td></tr></tbody></table></div>';
    }
    sum.hidden=false;
    sum.innerHTML='<h3>Round summary</h3><ul><li>Conditions that continued toward division: <strong>'+c.continue+'</strong></li><li>Conditions that paused: <strong>'+c.pause+'</strong></li><li>Conditions that stopped before division: <strong>'+c.stop+'</strong></li>'+(g.round===2?'<li>Conditions where a DNA change might be passed on: <strong>'+c.carried+'</strong></li>':'')+'</ul>'+comparison+'<p>One DNA change is not the same as cancer. Cancer usually involves multiple changes and interactions over time.</p>';
    if(g.round===1){$('#start-round2').hidden=false;$('#start-round2').textContent='Compare with Round 2';}
    else{$('#start-round2').hidden=true;}
    save();
  }
  function nextScenario(){
    const g=state.game;
    if(!g.awaiting)return;
    g.awaiting=false;g.card++;
    if(g.card>=4){g.done=true;showSummary();return;}
    if(g.mode==='group')g.player=(g.player%g.players)+1;
    renderGame();save();
  }
  function labelBody(v){return ({small:'Smaller',average:'Average',large:'Larger'})[v]||v;}
  function labelTissue(v){return ({slow:'Slow-dividing',medium:'Moderate-dividing',fast:'Fast-dividing'})[v]||v;}
  function simulateOne(age,size,tissue){
    const cellUnits={small:20,average:30,large:40}[size];
    const probability={slow:0.05,medium:0.12,fast:0.25}[tissue];
    let divisions=0;
    const years=Math.max(0,age-20);
    for(let y=0;y<years;y++)for(let c=0;c<cellUnits;c++)if(Math.random()<probability)divisions++;
    return {age:age,size:size,tissue:tissue,divisions:divisions,opportunities:divisions};
  }
  function renderTrials(){
    const body=$('#trial-rows');
    if(!state.trials.length){body.innerHTML='<tr><td colspan="6">Run trials to collect results.</td></tr>';$('#trial-chart').innerHTML='<p class="muted small">A comparison graph will appear after you run trials.</p>';return;}
    body.innerHTML='';
    state.trials.forEach(function(t,i){
      const tr=document.createElement('tr');
      [String(i+1),String(t.age),labelBody(t.size),labelTissue(t.tissue),String(t.divisions),String(t.opportunities)].forEach(function(v){const td=document.createElement('td');td.textContent=v;tr.appendChild(td);});
      body.appendChild(tr);
    });
    const max=Math.max(1,...state.trials.map(x=>x.divisions)),w=680,h=210,pad=36,bar=Math.min(42,(w-pad*2)/state.trials.length-6),gap=(w-pad*2-bar*state.trials.length)/Math.max(1,state.trials.length-1);
    let svg='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Bar graph of modeled cell divisions for '+state.trials.length+' trials"><title>Modeled cell-division events</title><line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+(w-pad)+'" y2="'+(h-pad)+'" stroke="currentColor"/><text x="'+pad+'" y="18" fill="currentColor" font-size="13">Modeled cell divisions</text>';
    state.trials.forEach(function(t,i){const bh=Math.max(2,(h-pad*2)*(t.divisions/max)),x=pad+i*(bar+gap),y=h-pad-bh;svg+='<rect x="'+x+'" y="'+y+'" width="'+bar+'" height="'+bh+'" rx="4" fill="var(--s1)"/><text x="'+(x+bar/2)+'" y="'+(y-5)+'" text-anchor="middle" fill="currentColor" font-size="12">'+t.divisions+'</text><text x="'+(x+bar/2)+'" y="'+(h-10)+'" text-anchor="middle" fill="currentColor" font-size="11">T'+(i+1)+'</text>';});
    svg+='</svg>';$('#trial-chart').innerHTML=svg;
  }
  function runTrials(){
    const age=Number($('#age-slider').value),size=$('#body-size').value,tissue=$('#tissue-rate').value;
    for(let i=0;i<3;i++)state.trials.push(simulateOne(age,size,tissue));
    renderTrials();save();
  }
  function download(){
    const payload={format:'openscied-b3-cell-cycle-progress-v1',exportedAt:new Date().toISOString(),game:state.game,simulationTrials:state.trials,answers:state.fields};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cell-cycle-cancer-model-work.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  function reset(){
    if(!window.confirm('Clear this activity’s saved work from this browser?'))return;
    localStorage.removeItem(KEY);window.location.reload();
  }
  function wire(){
    readStore();restoreFields();renderTrials();
    $('#age-slider').addEventListener('input',function(){$('#age-value').textContent=this.value;save();});
    $$('input[name="game-mode"]').forEach(function(el){el.addEventListener('change',function(){$('#group-size-wrap').hidden=this.value!=='group';save();});});
    $('#start-round1').addEventListener('click',function(){startRound(1);});
    $('#start-round2').addEventListener('click',function(){startRound(2);});
    $('#reveal-outcome').addEventListener('click',reveal);
    $('#next-scenario').addEventListener('click',nextScenario);
    $('#run-trials').addEventListener('click',runTrials);
    $('#clear-trials').addEventListener('click',function(){state.trials=[];renderTrials();save();});
    $('#check-background').addEventListener('click',function(){
      const choice=$('input[name="quick-check"]:checked');
      const out=$('#background-feedback');
      if(!choice){out.textContent='Choose one idea first.';return;}
      state.quick=choice.value==='b'?'Yes. Checkpoints can pause cell division when a cell needs to respond. p53 is one important part of a larger control system.':'Try again. Cell division does not always cause cancer, and p53 is not the only cell-cycle control.';
      out.textContent=state.quick;save();
    });
    const evidence=$$('#analyze input[type="checkbox"]');
    evidence.forEach(function(el){el.addEventListener('change',function(){
      const selected=evidence.filter(x=>x.checked),bad=$('#ev-guarantee').checked;
      $('#evidence-hint').textContent=bad?'Recheck that statement: the model does not show every division causing cancer.':selected.length?'Compare your selected evidence with your results table.':'Choose evidence that matches your table.';
      save();
    });});
    $('#download-work').addEventListener('click',download);
    $('#print-work').addEventListener('click',function(){window.print();});
    $('#reset-work').addEventListener('click',reset);
    $$('input,textarea,select').forEach(function(el){el.addEventListener('change',save);el.addEventListener('input',save);});
    if(state.game.round){$('#start-round1').hidden=true;if(state.game.round===2)$('#start-round2').hidden=true;renderGame();}
    save();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();