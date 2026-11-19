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
  function blankGame(){return {schema:2,mode:'solo',players:1,round:0,active:0,turns:0,complete:false,playersState:[],chanceDeck:[],logs:[],lastDice:[],roundResults:{},event:{title:'Your cell is ready',copy:'Choose your players and start Round 1 to begin.',icon:'🧬',kicker:'Cell cycle'}};}
  const state={game:blankGame(),trials:[],fields:{},quick:''};
  function readStore(){
    try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d&&d.v===1){if(d.game&&d.game.schema===2)state.game=Object.assign(blankGame(),d.game);if(Array.isArray(d.trials))state.trials=d.trials;if(d.fields)state.fields=d.fields;if(d.quick)state.quick=d.quick;}}
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
  const track=[{type:'start',phase:'start',label:'START',note:'Begin'}];
  for(let i=1;i<=6;i++)track.push({type:'space',phase:'g1',label:'G1',note:'Growth',chance:i%2===1});
  track.push({type:'checkpoint',phase:'g1',label:'G1 CHECK',note:'Checkpoint'});
  for(let i=1;i<=7;i++)track.push({type:'space',phase:'s',label:'S',note:'Copy DNA',chance:i%2===0});
  for(let i=1;i<=8;i++)track.push({type:'space',phase:'g2',label:'G2',note:'Prepare',chance:i%2===0});
  track.push({type:'checkpoint',phase:'g2',label:'G2 CHECK',note:'Checkpoint'});
  for(let i=1;i<=5;i++)track.push({type:'space',phase:'m',label:'M · '+i,note:'Need '+i,need:i,chance:i%2===1});
  track.push({type:'checkpoint',phase:'m',label:'M CHECK',note:'Divide'});
  track.push({type:'finish',phase:'finish',label:'DIVIDE',note:'Daughter cells'});
  const playerColors=['#58d4b4','#ffcb62','#70baff','#fc8fa3'];
  const resourceNames={nutrients:'Nutrients',proteins:'Proteins',organelles:'Organelles',chromosomes:'Chromosomes'};
  const zeroScore=function(){return {nutrients:0,proteins:0,organelles:0,chromosomes:0};};
  const chanceCards=[
    {id:'bonus',title:'p53 is responding',copy:'The cell gets one extra roll. Roll all four dice again without moving.',icon:'🛡️'},
    {id:'bonus',title:'A repair response helps',copy:'The cell gets one extra roll. Roll all four dice again without moving.',icon:'🛡️'},
    {id:'bonus',title:'The cell-cycle response holds',copy:'The cell gets one extra roll. Roll all four dice again without moving.',icon:'🛡️'},
    {id:'bonus',title:'The cell-cycle response holds',copy:'The cell gets one extra roll. Roll all four dice again without moving.',icon:'🛡️'},
    {id:'bonus',title:'A repair response helps',copy:'The cell gets one extra roll. Roll all four dice again without moving.',icon:'🛡️'},
    {id:'reset',title:'DNA damage is detected',copy:'The model cell exits the cycle and starts again with a new cell. Its scorecard resets.',icon:'🧬'},
    {id:'reset',title:'DNA damage is detected',copy:'The model cell exits the cycle and starts again with a new cell. Its scorecard resets.',icon:'🧬'},
    {id:'skip',title:'A checkpoint response is missed',copy:'This cell loses its next turn while the cycle continues to be checked.',icon:'⏸️'},
    {id:'advance',title:'A checkpoint is bypassed',copy:'With the response disrupted, the cell moves ahead three spaces without checking what it passed.',icon:'⚠️'},
    {id:'bypass',title:'A checkpoint is bypassed',copy:'The cell moves beyond the next checkpoint without checking its scorecard.',icon:'⚠️'},
    {id:'dna',title:'DNA copying is completed',copy:'The model cell completes the chromosome-copying requirement for this round.',icon:'🧬'},
    {id:'skipTwo',title:'Two checkpoints are missed',copy:'The disrupted response lets the cell pass two checkpoints without a scorecard check.',icon:'⚠️'},
    {id:'unchecked',title:'Division happens without a checkpoint check',copy:'The cell reaches division without the usual checkpoint requirements being checked. This is an unchecked model outcome, not a cancer diagnosis.',icon:'⚠️'}
  ];
  function shuffledDeck(){
    const deck=chanceCards.map(function(card,i){return i;});
    for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const v=deck[i];deck[i]=deck[j];deck[j]=v;}
    return deck;
  }
  function makePlayer(i){return {id:i+1,pos:0,score:zeroScore(),status:'playing',divisions:0,unchecked:0,restarts:0,bypassed:0,skipTurns:0,bonusRolls:0};}
  function roundName(round){return round===1?'Round 1 · checkpoints working':'Round 2 · checkpoint response disrupted';}
  function checkpointFor(pos){
    if(pos<7)return 'g1';
    if(pos<23)return 'g2';
    if(pos<29)return 'm';
    return 'done';
  }
  function nextCheckpoint(pos){
    for(const n of [7,23,29])if(n>pos)return n;
    return 30;
  }
  function setEvent(title,copy,icon,kicker){
    state.game.event={title:title,copy:copy,icon:icon||'🧬',kicker:kicker||'Cell cycle'};
  }
  function addLog(text){
    const g=state.game;g.logs.push(text);if(g.logs.length>80)g.logs.shift();
  }
  function renderDice(){
    const dice=state.game.lastDice||[],tray=$('#dice-tray');
    const faces={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
    tray.innerHTML='';
    for(let d=0;d<4;d++){
      const die=document.createElement('div');die.className='die'+(state.game.rolling?' rolling':'');die.setAttribute('aria-label',dice[d]?'Die '+(d+1)+': '+dice[d]:'Die '+(d+1)+': not rolled');
      const face=document.createElement('div');face.className='die-face';
      if(!dice[d]){const q=document.createElement('span');q.className='die-value';q.textContent='?';face.appendChild(q);}
      else for(let p=0;p<9;p++){const dot=document.createElement('i');if(faces[dice[d]].includes(p))dot.className='die-pip';face.appendChild(dot);}
      die.appendChild(face);tray.appendChild(die);
    }
    $('#turn-count').textContent='Turn '+Math.max(1,state.game.turns);
  }
  function renderBoard(){
    const g=state.game,rows=[track.slice(0,11),track.slice(11,22).reverse(),track.slice(22)];
    const board=$('#cell-board');board.innerHTML='';
    rows.forEach(function(row,rowIndex){
      const wrap=document.createElement('div');wrap.className='board-row row-'+(rowIndex+1);
      row.forEach(function(tile){
        const pos=track.indexOf(tile),tokens=g.playersState.filter(function(p){return p.pos===pos;});
        const cell=document.createElement('div');
        const style=tile.type==='checkpoint'?'check':tile.type==='start'?'start':tile.type==='finish'?'finish':tile.phase;
        const active=tokens.some(function(p){return g.playersState[g.active]&&p.id===g.playersState[g.active].id&&p.status==='playing';});
        cell.className='board-tile phase-'+style+(tile.chance&&g.round===2?' chance-space':'')+(active?' tile-active':'');
        cell.setAttribute('aria-label',(pos+1)+'. '+tile.label+(tile.chance&&g.round===2?', chance card space':'')+(tokens.length?', '+tokens.map(p=>'Player '+p.id).join(', '):''));
        cell.innerHTML='<span class="tile-number">'+(pos===0?'START':String(pos).padStart(2,'0'))+'</span><strong class="tile-label">'+tile.label+'</strong><small class="tile-note">'+(tile.chance&&g.round===2?'Chance card':tile.note)+'</small><span class="tile-tokens">'+tokens.map(function(p){return '<i class="cell-token token-'+p.id+'" title="Player '+p.id+'" aria-label="Player '+p.id+'">'+p.id+'</i>';}).join('')+'</span>';
        wrap.appendChild(cell);
      });
      if(rowIndex===2)for(let i=row.length;i<11;i++){const gap=document.createElement('div');gap.className='board-gap';wrap.appendChild(gap);}
      board.appendChild(wrap);
    });
  }
  function renderScorecards(){
    const g=state.game;
    $('#scorecards').innerHTML=g.playersState.map(function(p,index){
      const active=index===g.active&&p.status==='playing';
      const status=p.status==='finished'?'Done':p.bonusRolls?'Bonus roll':p.skipTurns?'Turn skipped':'Playing';
      return '<div class="player-score'+(active?' is-active':'')+(p.status==='finished'?' is-done':'')+'"><div class="score-player"><i class="cell-token token-'+p.id+'">'+p.id+'</i><span>Player '+p.id+'</span><small>'+status+'</small></div>'+
        '<div class="score-cell"><strong>'+p.score.nutrients+'</strong><small>Nutrients</small></div>'+
        '<div class="score-cell"><strong>'+p.score.proteins+'</strong><small>Proteins</small></div>'+
        '<div class="score-cell"><strong>'+p.score.organelles+'</strong><small>Organelles</small></div>'+
        '<div class="score-cell"><strong>'+p.score.chromosomes+'</strong><small>DNA copies</small></div></div>';
    }).join('');
  }
  function getTarget(p){
    if(p.pos===23)return 1;
    if(p.pos>=24&&p.pos<=27)return p.pos-22;
    return null;
  }
  function checkpointState(p,key){
    const s=p.score;
    if(key==='g1')return {title:'G1 checkpoint',subtitle:'Pass with at least 3 nutrients, proteins, and organelles.',items:[['Nutrients',s.nutrients,3],['Proteins',s.proteins,3],['Organelles',s.organelles,3]]};
    if(key==='g2')return {title:'G2 checkpoint',subtitle:'Pass with 4 chromosome copies and at least 1 of each material.',items:[['Chromosomes',s.chromosomes,4],['Nutrients',s.nutrients,1],['Proteins',s.proteins,1],['Organelles',s.organelles,1]]};
    if(key==='m')return {title:'M checkpoint',subtitle:'Confirm the cell met the material and DNA requirements before division.',items:[['G1 materials',Math.min(s.nutrients,s.proteins,s.organelles),3],['DNA copies',s.chromosomes,4],['G2 materials',Math.min(s.nutrients,s.proteins,s.organelles),1]]};
    return {title:'Cycle complete',subtitle:'The model cell reached division.',items:[['Division',p.divisions,1],['Unchecked',p.unchecked,0]]};
  }
  function renderCheckpoint(){
    const g=state.game,p=g.playersState[g.active];if(!p)return;
    const key=checkpointFor(p.pos),stateFor=checkpointState(p,key);
    $('#checkpoint-title').textContent='Next checkpoint · '+stateFor.title;
    $('#checkpoint-subtitle').textContent=stateFor.subtitle;
    $('#checkpoint-requirements').innerHTML=stateFor.items.map(function(x){const met=x[1]>=x[2];return '<span class="requirement'+(met?' met':'')+'"><span>'+x[0]+'</span><strong>'+x[1]+' / '+x[2]+'</strong></span>';}).join('');
    $('#checkpoint-status').textContent=key==='done'?'Finished':key==='g1'?'G1 ahead':key==='g2'?'G2 ahead':'M phase ahead';
    $('#checkpoint-card').classList.toggle('checkpoint-ready',stateFor.items.every(x=>x[1]>=x[2]));
  }
  function phaseLabel(p){
    const tile=track[p.pos];
    if(tile.type==='checkpoint')return tile.phase.toUpperCase()+' checkpoint';
    if(tile.type==='finish')return 'Division complete';
    if(tile.type==='start')return 'Ready at start';
    return tile.phase.toUpperCase()+(tile.phase==='g1'?' · Growth':tile.phase==='s'?' · DNA copying':tile.phase==='g2'?' · Preparation':' · Division');
  }
  function turnInstruction(p){
    if(p.bonusRolls>0)return 'Bonus roll: roll four dice again without moving.';
    const need=getTarget(p);
    if(need!==null)return 'To move forward, roll a '+need+' on any die. If you miss it, stay here this turn.';
    return 'Move one space forward, then roll all four dice. The dice do not set the number of spaces.';
  }
  function currentSummary(p,dice){
    const found=[];
    for(const v of [1,2,3,4]){const n=dice.filter(x=>x===v).length;if(n)found.push(n+' × '+({1:'nutrient',2:'protein',3:'organelle',4:'chromosome copy'})[v]);}
    return found.length?found.join(' · '):'No materials collected';
  }
  function renderHistory(){
    const logs=state.game.logs.slice(-24).reverse();
    $('#history-count').textContent=state.game.logs.length+' '+(state.game.logs.length===1?'turn':'turns');
    $('#turn-history').innerHTML=logs.map(function(line){return '<li>'+line+'</li>';}).join('');
  }
  function finishIfAll(){
    const g=state.game;
    if(!g.playersState.length||!g.playersState.every(function(p){return p.status==='finished';}))return false;
    g.complete=true;
    const totals={divisions:0,unchecked:0,restarts:0,bypassed:0};
    g.playersState.forEach(function(p){totals.divisions+=p.divisions;totals.unchecked+=p.unchecked;totals.restarts+=p.restarts;totals.bypassed+=p.bypassed;});
    g.roundResults[g.round]=totals;
    setEvent(roundName(g.round)+' complete','Every model cell reached the end of this round. Compare how the checkpoints and chance events shaped the path.','🏁','Round complete');
    return true;
  }
  function renderSummary(){
    const g=state.game,el=$('#round-summary');
    if(!g.complete){el.hidden=true;el.innerHTML='';return;}
    const r=g.roundResults[g.round]||{divisions:0,unchecked:0,restarts:0,bypassed:0};
    let html='<span class="game-kicker">Round '+g.round+' results</span><h3>What happened to the cells?</h3><p>Completed model divisions: <strong>'+r.divisions+'</strong> · Unchecked divisions: <strong>'+r.unchecked+'</strong> · Restarted after damage: <strong>'+r.restarts+'</strong> · Checkpoints bypassed: <strong>'+r.bypassed+'</strong></p>';
    if(g.round===1)html+='<p>Round 1 uses functioning checkpoint responses. Start Round 2 with the same group to add the chance-card disruptions.</p><button class="btn btn--primary" id="start-round2-from-summary" type="button">Play Round 2 with disrupted responses</button>';
    if(g.round===2&&g.roundResults[1]){
      const a=g.roundResults[1],b=r;
      html+='<div class="table-wrap"><table class="data round-compare"><caption>Round 1 and Round 2 comparison</caption><thead><tr><th>What the group observed</th><th>Round 1</th><th>Round 2</th></tr></thead><tbody><tr><th>Completed divisions</th><td>'+a.divisions+'</td><td>'+b.divisions+'</td></tr><tr><th>Divisions without a checkpoint check</th><td>'+a.unchecked+'</td><td>'+b.unchecked+'</td></tr><tr><th>Cells restarted after damage</th><td>'+a.restarts+'</td><td>'+b.restarts+'</td></tr><tr><th>Checkpoints bypassed</th><td>'+a.bypassed+'</td><td>'+b.bypassed+'</td></tr></tbody></table></div><p>A bypassed checkpoint can let a cell keep moving when it has not met the model’s requirements. That outcome shows one possible process; it does not mean that one division or one DNA change equals cancer.</p>';
    }
    el.innerHTML=html;el.hidden=false;
  }
  function renderGame(){
    const g=state.game,setup=$('#game-setup'),panel=$('#game-panel');
    setup.hidden=!!g.round;panel.hidden=!g.round;
    $('#start-round1').hidden=!!g.round;
    $('#start-round2').hidden=true;
    if(!g.round)return;
    const p=g.playersState[g.active]||g.playersState.find(function(x){return x.status==='playing';});
    if(!p)return;
    $('#round-label').textContent=roundName(g.round);
    $('#active-player-label').textContent=p.status==='finished'?'Round complete':'Player '+p.id+'’s turn';
    $('#turn-instruction').textContent=turnInstruction(p);
    $('#phase-label').textContent=phaseLabel(p);
    $('#position-label').textContent='Space '+(p.pos+1)+' · '+track[p.pos].label;
    $('#dice-prompt').textContent=turnInstruction(p);
    $('#dice-result').textContent=g.lastDice.length?'Last roll: '+currentSummary(p,g.lastDice):'Four dice are ready. Roll when it is your turn.';
    $('#roll-dice').textContent=p.bonusRolls?'🎲 Roll bonus dice':'🎲 Roll 4 dice';
    $('#roll-dice').disabled=!!g.rolling||g.complete;
    $('#roll-dice').hidden=g.complete;
    $('#event-icon').textContent=g.event.icon||'🧬';
    $('#event-kicker').textContent=g.event.kicker||'Cell cycle';
    $('#event-title').textContent=g.event.title||'Your turn';
    $('#event-copy').textContent=g.event.copy||'Move one space and roll four dice.';
    renderDice();renderBoard();renderScorecards();renderCheckpoint();renderHistory();renderSummary();
    $('#restart-round').hidden=!g.complete;
    $('#reset-game').hidden=!g.complete;
  }
  function startRound(round,mode,players){
    const old=state.game,selectedMode=mode||($('input[name="game-mode"]:checked')||{}).value||old.mode||'solo';
    const count=Number(players|| (selectedMode==='group'?$('#group-size').value:1))||1;
    const results=Object.assign({},old.roundResults||{});
    state.game={schema:2,mode:selectedMode,players:count,round:round,active:0,turns:0,complete:false,playersState:Array.from({length:count},function(_,i){return makePlayer(i);}),chanceDeck:round===2?shuffledDeck():[],logs:[],lastDice:[],roundResults:results,event:{title:'Round '+round+' begins',copy:round===1?'Move each cell through the cycle and check its materials at G1 and G2.':'Same board, new chance events. Some checkpoint responses may be disrupted.',icon:'🎲',kicker:roundName(round)}};
    save();renderGame();
  }
  function drawChance(p){
    const g=state.game;
    if(!g.chanceDeck.length)g.chanceDeck=shuffledDeck();
    const idx=g.chanceDeck.shift();g.chanceDeck.push(idx);
    const card=chanceCards[idx];
    setEvent(card.title,card.copy,card.icon,'Cellular chance card');
    addLog('Player '+p.id+': '+card.title+'.');
    if(card.id==='bonus'){p.bonusRolls++;return true;}
    if(card.id==='reset'){
      p.pos=0;p.score=zeroScore();p.restarts++;p.bonusRolls=0;
      setEvent(card.title,card.copy,card.icon,'Cellular chance card');
    }else if(card.id==='skip'){p.skipTurns++;}
    else if(card.id==='advance'){
      const dest=Math.min(30,p.pos+3);p.bypassed+= [7,23,29].filter(function(n){return n>p.pos&&n<=dest;}).length;p.pos=dest;
      if(p.pos===30){p.status='finished';p.divisions++;p.unchecked++;setEvent('Unchecked division in the model','The cell passed the final checkpoint without the normal check. This is a model outcome, not a diagnosis.','⚠️','Checkpoint bypassed');}
    }else if(card.id==='bypass'){
      const cp=nextCheckpoint(p.pos);p.bypassed++;
      if(cp>=29){p.pos=30;p.status='finished';p.divisions++;p.unchecked++;setEvent('Division without a checkpoint check','The model cell bypassed the final checkpoint. This shows why cell-cycle controls matter; it does not predict cancer.','⚠️','Checkpoint bypassed');}
      else p.pos=cp+1;
    }else if(card.id==='dna'){p.score.chromosomes=Math.max(4,p.score.chromosomes);}
    else if(card.id==='skipTwo'){
      const next=nextCheckpoint(p.pos),second=nextCheckpoint(next);p.bypassed+=2;
      if(second>=29){p.pos=30;p.status='finished';p.divisions++;p.unchecked++;setEvent('Division without a checkpoint check','Two checkpoint checks were bypassed in this model cell.','⚠️','Checkpoint bypassed');}
      else p.pos=second+1;
    }else if(card.id==='unchecked'){
      p.pos=30;p.status='finished';p.divisions++;p.unchecked++;
      setEvent('Division without a checkpoint check','The cell reached division without meeting the normal checkpoint requirements. This is a model outcome, not a cancer diagnosis.','⚠️','Checkpoint bypassed');
    }
    return false;
  }
  function restartCell(p,copy){
    p.restarts++;p.pos=0;p.score=zeroScore();p.bonusRolls=0;
    setEvent('The cell restarts at the beginning',copy,'🧬','Checkpoint response');
  }
  function checkCheckpoint(p){
    const s=p.score;
    if(p.pos===7){
      const values=[s.nutrients,s.proteins,s.organelles];
      if(values.includes(0)){restartCell(p,'A material category is still at zero. In Round 1, p53 stops this damaged model cell and it starts again.');return;}
      if(values.includes(1)){p.pos=Math.max(0,p.pos-5);setEvent('G1 checkpoint: move back 5 spaces','At least one material is present only once. The cell must gather more before it can pass.','↩️','Checkpoint response');return;}
      if(values.includes(2)){p.pos=Math.max(0,p.pos-3);setEvent('G1 checkpoint: move back 3 spaces','At least one material is present only twice. The cell returns to gather more.','↩️','Checkpoint response');return;}
      setEvent('G1 checkpoint passed','The cell has at least three nutrients, proteins, and organelles. It can continue to copy its DNA.','✅','Checkpoint passed');return;
    }
    if(p.pos===23){
      if(!s.nutrients||!s.proteins||!s.organelles){restartCell(p,'A required material is missing. The model cell starts again.');return;}
      if(s.chromosomes<4){p.pos=8;setEvent('G2 checkpoint: return to S phase','The cell needs at least four chromosome copies. Return to the first S space and keep copying DNA.','↩️','Checkpoint response');return;}
      setEvent('G2 checkpoint passed','The cell has enough DNA copies and at least one of each material. It can prepare for division.','✅','Checkpoint passed');return;
    }
    if(p.pos===29){
      const ok=s.nutrients>=3&&s.proteins>=3&&s.organelles>=3&&s.chromosomes>=4;
      if(!ok){
        p.pos=s.chromosomes<4?8:(s.nutrients<3||s.proteins<3||s.organelles<3?1:15);
        setEvent('M checkpoint: gather what is missing','The cell has not met every requirement. It returns to the phase where it needs more materials.','↩️','Checkpoint response');return;
      }
      p.pos=30;p.status='finished';p.divisions++;
      setEvent('The model cell completes division','The cell met the model’s requirements and divides into daughter cells. The game does not label a division as cancer.','🧬','Division complete');
    }
  }
  function scoreRoll(p,dice){
    const tile=track[p.pos],phase=tile.phase;
    if(phase==='g1'||phase==='g2'){
      dice.forEach(function(v){if(v===1)p.score.nutrients++;if(v===2)p.score.proteins++;if(v===3)p.score.organelles++;});
    }else if(phase==='s')dice.forEach(function(v){if(v===4)p.score.chromosomes++;});
  }
  function activeNext(index){
    const g=state.game,n=g.playersState.length;
    for(let step=1;step<=n;step++){
      const i=(index+step)%n,p=g.playersState[i];
      if(p.status!=='playing')continue;
      if(p.skipTurns>0){p.skipTurns--;addLog('Player '+p.id+' loses a turn; the next player rolls.');setEvent('This turn is skipped','A chance event costs this cell one turn.','⏸️','Turn skipped');continue;}
      g.active=i;return;
    }
    finishIfAll();
  }
  function rollDice(){
    const g=state.game,p=g.playersState[g.active];
    if(!p||p.status!=='playing'||g.complete||g.rolling)return;
    g.rolling=true;renderDice();$('#roll-dice').disabled=true;
    window.setTimeout(function(){
      const dice=Array.from({length:4},function(){return 1+Math.floor(Math.random()*6);});
      g.rolling=false;g.lastDice=dice;g.turns++;
      const bonus=p.bonusRolls>0;
      let moved=false,missed=null;
      if(bonus)p.bonusRolls--;
      else{
        const need=getTarget(p);
        if(need!==null){
          if(dice.includes(need)){p.pos=Math.min(30,p.pos+1);moved=true;}
          else missed=need;
        }else{p.pos=Math.min(30,p.pos+1);moved=true;}
      }
      if(moved||bonus)scoreRoll(p,dice);
      const landed=p.pos;
      const summary=currentSummary(p,dice);
      let message='Roll: '+summary+'.';
      if(missed!==null)message='No '+missed+' rolled. The cell stays on its space this turn. Roll: '+summary+'.';
      if(bonus)message='Bonus roll—your token stays put. '+summary+'.';
      setEvent(bonus?'Bonus dice added':missed!==null?'The cell waits for the needed roll':'Materials collected',message,'🎲','Four-dice roll');
      addLog('Player '+p.id+' · '+phaseLabel(p)+' · ['+dice.join(', ')+'] · '+message);
      if(moved&&[7,23,29].includes(p.pos))checkCheckpoint(p);
      else if(moved&&g.round===2&&track[landed].chance){
        const keepTurn=drawChance(p);
        if(keepTurn&&p.status==='playing'){g.active=p.id-1;}
      }
      finishIfAll();
      const bonusRemains=p.bonusRolls>0&&p.status==='playing'&&!g.complete;
      if(!bonusRemains&&!g.complete)activeNext(g.active);
      if(g.complete)finishIfAll();
      save();renderGame();
    },480);
  }
  function resetRound(){
    if(!window.confirm('Restart this round? The current round’s scorecards will be cleared.'))return;
    startRound(state.game.round,state.game.mode,state.game.players);
  }
  function resetGame(){
    if(!window.confirm('Set up a new game? Round results and the current board will be cleared.'))return;
    state.game=blankGame();save();renderGame();
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
    readStore();restoreFields();renderTrials();renderGame();
    $('#age-slider').addEventListener('input',function(){$('#age-value').textContent=this.value;save();});
    $$('input[name="game-mode"]').forEach(function(el){el.addEventListener('change',function(){$('#group-size-wrap').hidden=this.value!=='group';save();});});
    $('#start-round1').addEventListener('click',function(){startRound(1);});
    $('#start-round2').addEventListener('click',function(){startRound(2);});
    $('#roll-dice').addEventListener('click',rollDice);
    $('#restart-round').addEventListener('click',resetRound);
    $('#reset-game').addEventListener('click',resetGame);
    $('#round-summary').addEventListener('click',function(event){if(event.target&&event.target.id==='start-round2-from-summary')startRound(2,state.game.mode,state.game.players);});
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
    save();
  }  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();