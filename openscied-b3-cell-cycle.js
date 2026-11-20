(function(){
  'use strict';
  const KEY='aplab:openscied:b3-cell-cycle:v1';
  const $=function(s,root){return (root||document).querySelector(s);};
  const $$=function(s,root){return Array.from((root||document).querySelectorAll(s));};
  function blankGame(){return {schema:2,mode:'solo',players:1,round:0,active:0,turns:0,complete:false,playersState:[],chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},event:{title:'Your cell is ready',copy:'Choose your players and start Round 1 to begin.',icon:'🧬',kicker:'Cell cycle'}};}
  const SECTIONS=['overview','background','cell-game','growth-model','analyze','submit'];
  const state={game:blankGame(),trials:[],fields:{},quick:'',mechanism:'',lastSection:'overview'};
  function studentIdentity(){return window.Lab&&Lab.identity?Lab.identity.get():null;}
  const ANALYSIS_PROMPTS=[
    ['Fair test and controlled settings','analysis-design'],
    ['Variation across repeated trials','analysis-variation'],
    ['Comparison of named cell types','analysis-celltypes'],
    ['Effect of age or body size','explanation'],
    ['Evidence before the cancerous model state','analysis-cancer'],
    ['Connection to cell-cycle checkpoints','analysis-checkpoints'],
    ['My revised model','model-revision'],
    ['New prediction and an unanswered question','model-prediction']
  ];
  function readStore(){
    try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d&&d.v===1){if(d.game&&d.game.schema===2){state.game=Object.assign(blankGame(),d.game);(state.game.playersState||[]).forEach(function(p){p.score=p.score||zeroScore();p.score.m=p.score.m||{attachments:0};});}if(Array.isArray(d.trials))state.trials=d.trials;if(d.fields)state.fields=d.fields;if(d.quick)state.quick=d.quick;if(d.mechanism)state.mechanism=d.mechanism;if(SECTIONS.includes(d.lastSection))state.lastSection=d.lastSection;}}
    catch(e){}
  }
  function save(){
    try{
      state.fields={};
      $$('input[type=radio]:checked,input[type=checkbox],#age-slider,textarea,select').forEach(function(el){
        if(el.name==='prediction')return;
        if(el.type==='checkbox')state.fields[el.id]=el.checked;
        else if(el.type==='radio')state.fields[el.name]=el.value;
        else state.fields[el.id]=el.value;
      });
      const section=location.hash.slice(1);if(SECTIONS.includes(section))state.lastSection=section;
      localStorage.setItem(KEY,JSON.stringify({v:1,game:state.game,trials:state.trials,fields:state.fields,quick:state.quick,mechanism:state.mechanism,lastSection:state.lastSection,lastVisitedAt:Date.now()}));
      $('#save-status').textContent='Saved on this device.';
      renderReport();
    }catch(e){$('#save-status').textContent='This browser could not save your work. Download a copy before leaving.';}
  }
  function restoreFields(){
    Object.keys(state.fields||{}).forEach(function(id){
      const value=state.fields[id];
      if(id==='quick-check'||id==='game-mode'||id==='mechanism-check'){
        const el=$('input[name="'+id+'"][value="'+CSS.escape(value)+'"]');if(el)el.checked=true;
      }else{
        const el=document.getElementById(id);
        if(el){if(el.type==='checkbox')el.checked=!!value;else el.value=id==='tissue-rate'?({slow:'brain',medium:'skin',fast:'colon'}[value]||value):value;}
      }
    });
    const mode=$('input[name="game-mode"]:checked');
    $('#group-size-wrap').hidden=!mode||mode.value!=='group';
    if(state.quick)$('#background-feedback').textContent=state.quick;
    if(state.mechanism)$('#mechanism-feedback').textContent=state.mechanism;
    $('#age-value').textContent=$('#age-slider').value;
  }
  const track=[{type:'start',phase:'start',label:'START',note:'Begin'}];
  for(let i=1;i<=6;i++)track.push({type:'space',phase:'g1',label:'G1',note:'Growth',chance:i%2===1});
  track.push({type:'checkpoint',phase:'g1',label:'G1 CHECK',note:'Checkpoint'});
  for(let i=1;i<=7;i++)track.push({type:'space',phase:'s',label:'S',note:'Copy DNA',chance:i%2===0});
  for(let i=1;i<=8;i++)track.push({type:'space',phase:'g2',label:'G2',note:'Prepare',chance:i%2===0});
  track.push({type:'checkpoint',phase:'g2',label:'G2 CHECK',note:'Checkpoint'});
  for(let i=1;i<=5;i++)track.push({type:'space',phase:'m',label:'M · '+i,note:i<=4?'Attach spindle':'Check alignment',need:i<=4?'spindle':null,chance:i%2===1});
  track.push({type:'checkpoint',phase:'m',label:'M CHECK',note:'Spindle check'});
  track.push({type:'finish',phase:'finish',label:'DIVIDE',note:'Daughter cells'});
  const playerColors=['#58d4b4','#ffcb62','#70baff','#fc8fa3'];
  const zeroScore=function(){return {g1:{nutrients:0,proteins:0,organelles:0},s:{chromosomes:0},g2:{nutrients:0,proteins:0,organelles:0},m:{attachments:0}};};
  const chanceCards=[
    {id:'bonus',title:'p53 is responding',copy:'p53 helps respond to DNA damage by pausing the cell cycle while the cell responds. In this teaching model, that response gives the cell one extra roll without moving.',icon:'🛡️'},
    {id:'bonus',title:'A repair response helps',copy:'The cell gets one extra roll. Roll all four dice again without moving.',icon:'🛡️'},
    {id:'bonus',title:'The cell-cycle response holds',copy:'The cell gets one extra roll. Roll all four dice again without moving.',icon:'🛡️'},
    {id:'bonus',title:'The cell-cycle response holds',copy:'The cell gets one extra roll. Roll all four dice again without moving.',icon:'🛡️'},
    {id:'bonus',title:'A repair response helps',copy:'The cell gets one extra roll. Roll all four dice again without moving.',icon:'🛡️'},
    {id:'reset',title:'DNA damage is detected',copy:'The model cell exits the cycle and starts again with a new cell. Its scorecard resets.',icon:'🧬'},
    {id:'reset',title:'DNA damage is detected',copy:'The model cell exits the cycle and starts again with a new cell. Its scorecard resets.',icon:'🧬'},
    {id:'skip',title:'A checkpoint response is missed',copy:'This cell loses its next turn while the cycle continues to be checked.',icon:'⏸️'},
    {id:'advance',title:'A checkpoint is bypassed',copy:'With the response disrupted, the cell moves ahead three spaces without checking what it passed.',icon:'⚠️'},
    {id:'bypass',title:'A checkpoint is bypassed',copy:'The cell moves beyond the next checkpoint without checking its scorecard.',icon:'⚠️'},
    {id:'dna',title:'DNA copying is completed',copy:'DNA copies can only be added during S phase. If this card appears in S, the model completes the four-copy requirement; in other phases, no copies are added.',icon:'🧬'},
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
    if(pos<=7)return 'g1';
    if(pos<=23)return 'g2';
    if(pos<=29)return 'm';
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
    if(window.CellCycleScene)window.CellCycleScene.rolling(!!state.game.rolling);
    $('#turn-count').textContent=state.game.turns+' '+(state.game.turns===1?'roll':'rolls');
  }
  function renderBoard(){
    if(window.CellCycleScene)window.CellCycleScene.update(state.game,track);
    const p=state.game.playersState[state.game.active];
    $('#scene-description').textContent=p?'Player '+p.id+' is on '+track[p.pos].label+'. '+turnInstruction(p):'Choose players to start. The board and cell model are shown above.';
  }
  function renderScorecards(){
    const g=state.game;
    $('#scorecards').innerHTML=g.playersState.map(function(p,index){
      const active=index===g.active&&p.status==='playing';
      const status=p.status==='finished'?'Division complete':p.bonusRolls?'Bonus roll':p.skipTurns?'Turn skipped':'Playing';
      const row=function(label,vals,thresholds){return '<div class="score-phase-row"><strong>'+label+'</strong>'+vals.map(function(x,i){const na=x===null,met=!na&&x>=thresholds[i];return '<span class="'+(na?'score-na':met?'score-met':'')+'">'+(na?'—':'<b>'+x+'</b>')+'</span>';}).join('')+'</div>';};
      return '<div class="player-score player-color-'+p.id+(active?' is-active':'')+(p.status==='finished'?' is-done':'')+'"><div class="score-player"><i class="cell-token token-'+p.id+'">'+p.id+'</i><span>Player '+p.id+'</span><small>'+status+'</small></div>'+
        '<div class="score-phase-head"><span>Phase</span><span>Nutrients</span><span>Proteins</span><span>Organelles</span><span>DNA / M</span></div>'+ 
        row('G1',[p.score.g1.nutrients,p.score.g1.proteins,p.score.g1.organelles,null],[3,3,3,0])+
        row('S',[null,null,null,p.score.s.chromosomes],[0,0,0,4])+
        row('G2',[p.score.g2.nutrients,p.score.g2.proteins,p.score.g2.organelles,null],[1,1,1,0])+
        row('M',[null,null,null,p.score.m.attachments],[0,0,0,4])+'</div>';
    }).join('');
  }
  function waitingAtG2(p){const s=p.score;return p.pos===23&&s.s.chromosomes>=4&&(s.g2.nutrients<1||s.g2.proteins<1||s.g2.organelles<1);}
  function getTarget(p){
    if(p.pos>=24&&p.pos<=27)return 'spindle';
    if(p.pos===29&&p.score.m.attachments<4)return 'spindle';
    return null;
  }
  function checkpointState(p,key){
    const s=p.score;
    if(key==='g1')return {title:'G1 checkpoint',subtitle:'Pass with at least 3 of each G1 material.',items:[['Nutrients',s.g1.nutrients,3],['Proteins',s.g1.proteins,3],['Organelles',s.g1.organelles,3]]};
    if(key==='g2')return {title:'G2 checkpoint',subtitle:'Pass with 4 DNA copies and at least 1 of each G2 material.',items:[['DNA copies',s.s.chromosomes,4],['Nutrients',s.g2.nutrients,1],['Proteins',s.g2.proteins,1],['Organelles',s.g2.organelles,1]]};
    if(key==='m')return {title:'M checkpoint',subtitle:'Check the earlier requirements and confirm all four modeled chromosomes are attached to the spindle.',items:[['G1 materials',Math.min(s.g1.nutrients,s.g1.proteins,s.g1.organelles),3],['DNA copies',s.s.chromosomes,4],['G2 materials',Math.min(s.g2.nutrients,s.g2.proteins,s.g2.organelles),1],['Spindle attachments',s.m.attachments,4]]};
    return {title:'Cycle complete',subtitle:'The model cell reached division.',items:[['Divisions completed',p.divisions,1]]};
  }
  function renderCheckpoint(){
    const g=state.game,p=g.playersState[g.active];if(!p)return;
    const key=checkpointFor(p.pos),stateFor=checkpointState(p,key);
    $('#checkpoint-title').textContent='Next checkpoint · '+stateFor.title;
    $('#checkpoint-subtitle').textContent=stateFor.subtitle;
    $('#checkpoint-requirements').innerHTML=stateFor.items.map(function(x){const met=x[1]>=x[2];return '<span class="requirement'+(met?' met':'')+'"><span>'+(met?'✓ ':'○ ')+x[0]+'</span><strong>'+x[1]+' / '+x[2]+'</strong><span class="requirement-meter"><span style="width:'+Math.min(100,100*x[1]/Math.max(1,x[2]))+'%"></span></span></span>';}).join('');
    $('#checkpoint-status').textContent=key==='done'?'Finished':key==='g1'?'G1 ahead':key==='g2'?'G2 ahead':'M phase ahead';
    $('#checkpoint-card').classList.toggle('checkpoint-ready',stateFor.items.every(x=>x[1]>=x[2]));
    $('#checkpoint-card').setAttribute('aria-label','Player '+p.id+' '+stateFor.title+': '+stateFor.subtitle);
  }
  function phaseLabel(p){
    const tile=track[p.pos];
    if(tile.type==='checkpoint')return tile.phase.toUpperCase()+' checkpoint';
    if(tile.type==='finish')return 'Division complete';
    if(tile.type==='start')return 'Ready at start';
    return tile.phase.toUpperCase()+(tile.phase==='g1'?' · Growth':tile.phase==='s'?' · DNA copying':tile.phase==='g2'?' · Preparation':' · Spindle attachment');
  }
  function turnInstruction(p){
    if(p.bonusRolls>0)return 'Bonus roll: roll four dice again without moving.';
    if(p.pos===7&&(p.score.g1.nutrients<3||p.score.g1.proteins<3||p.score.g1.organelles<3))return 'G1 checkpoint pause: roll here to gather missing materials. Your cell stays at the checkpoint.';
    if(waitingAtG2(p))return 'G2 checkpoint pause: roll here to gather at least one of each G2 material. Your cell stays at the checkpoint.';
    const need=getTarget(p);
    if(need==='spindle')return 'M phase: roll a 5 or 6 on any die to model one chromosome attaching to the spindle. If you miss, stay here.';
    if(need!==null)return 'To move forward, roll a '+need+' on any die. If you miss it, stay here this turn.';
    return 'Move one space forward, then roll all four dice. The dice do not set the number of spaces.';
  }
  function currentSummary(tile,dice,required,missed,bonus,waitingG2){
    const phase=tile.phase;
    if(required==='spindle')return missed===null?'A 5 or 6 models a chromosome attaching to the spindle. One modeled attachment is recorded.':'No 5 or 6 this turn; no chromosome attachment is recorded.';
    if(required!==null)return missed===null?'Matched the required '+required+' on an M-phase die. The cell moves forward.':'Needed a '+required+' on any die; no match this turn.';
    if(tile.type==='checkpoint'&&phase==='g1')return 'The cycle is paused at G1. Roll results add any nutrients, proteins, and organelles the cell still needs.';
    if(tile.type==='checkpoint'&&phase==='g2'&&dice.length&&waitingG2)return 'The cycle is paused at G2. Roll results add any nutrients, proteins, and organelles the cell still needs.';
    if(tile.type==='checkpoint')return 'Checkpoint reached. Check the scorecard; this space does not collect materials.';
    if(phase==='g1'||phase==='g2'){
      const n=dice.filter(x=>x===1).length,pr=dice.filter(x=>x===2).length,o=dice.filter(x=>x===3).length;
      const out=[];if(n)out.push('Nutrients ×'+n);if(pr)out.push('Proteins ×'+pr);if(o)out.push('Organelles ×'+o);
      return (bonus?'Bonus roll. ':'')+(out.length?'Collected: '+out.join(', ')+'.':'No G1/G2 materials collected on this roll.');
    }
    if(phase==='s'){const n=dice.filter(x=>x===4).length;return (bonus?'Bonus roll. ':'')+(n?'DNA copies ×'+n+' collected.':'No chromosome copies collected on this roll.');}
    if(phase==='m')return 'M phase: the model tracks chromosome attachment to the spindle before division.';
    return 'Checkpoint space: this roll does not collect materials.';
  }
  function renderHistory(){
    const logs=state.game.logs.slice(-24).reverse();
    $('#history-count').textContent=state.game.turns+' '+(state.game.turns===1?'roll':'rolls');
    $('#turn-history').innerHTML=logs.map(function(line){return '<li>'+line+'</li>';}).join('');
  }
  function finishIfAll(){
    const g=state.game;
    if(!g.playersState.length||!g.playersState.every(function(p){return p.status==='finished';}))return false;
    g.complete=true;
    const totals={divisions:0,unchecked:0,restarts:0,bypassed:0,rolls:g.turns};
    g.playersState.forEach(function(p){totals.divisions+=p.divisions;totals.unchecked+=p.unchecked;totals.restarts+=p.restarts;totals.bypassed+=p.bypassed;});
    g.roundResults[g.round]=totals;
    setEvent(roundName(g.round)+' complete','Every model cell reached the end of this round. Compare how the checkpoints and chance events shaped the path.','🏁','Round complete');
    return true;
  }
  function roundEvidence(n){
    const g=state.game;
    if(g.roundResults[n])return Object.assign({inProgress:false},g.roundResults[n]);
    if(g.round!==n||!g.playersState.length)return null;
    const r={divisions:0,unchecked:0,restarts:0,bypassed:0,rolls:g.turns,inProgress:true};
    g.playersState.forEach(p=>{r.divisions+=p.divisions;r.unchecked+=p.unchecked;r.restarts+=p.restarts;r.bypassed+=p.bypassed;});
    return r;
  }
  function renderSummary(){
    const g=state.game,el=$('#round-summary');
    if(!g.complete){el.hidden=true;el.innerHTML='';return;}
    const r=g.roundResults[g.round]||{divisions:0,unchecked:0,restarts:0,bypassed:0};
    let html='<span class="game-kicker">Round '+g.round+' results</span><h3>What happened to the cells?</h3><p>Dice rolls taken: <strong>'+r.rolls+'</strong> · Completed model divisions: <strong>'+r.divisions+'</strong> · Unchecked divisions: <strong>'+r.unchecked+'</strong> · Restarted after damage: <strong>'+r.restarts+'</strong> · Checkpoints bypassed: <strong>'+r.bypassed+'</strong></p>';
    if(g.round===1)html+='<p>Round 1 uses functioning checkpoint responses. Start Round 2 with the same group to add the chance-card disruptions.</p><button class="btn btn--primary" id="start-round2-from-summary" type="button">Play Round 2 with disrupted responses</button>';
    if(g.round===2&&g.roundResults[1]){
      const a=g.roundResults[1],b=r;
      html+='<div class="table-wrap"><table class="data round-compare"><caption>Round 1 and Round 2 comparison</caption><thead><tr><th>What the group observed</th><th>Round 1</th><th>Round 2</th></tr></thead><tbody><tr><th>Dice rolls</th><td>'+a.rolls+'</td><td>'+b.rolls+'</td></tr><tr><th>Completed divisions</th><td>'+a.divisions+'</td><td>'+b.divisions+'</td></tr><tr><th>Divisions without a checkpoint check</th><td>'+a.unchecked+'</td><td>'+b.unchecked+'</td></tr><tr><th>Cells restarted after damage</th><td>'+a.restarts+'</td><td>'+b.restarts+'</td></tr><tr><th>Checkpoints bypassed</th><td>'+a.bypassed+'</td><td>'+b.bypassed+'</td></tr></tbody></table></div><p>A bypassed checkpoint can let a cell keep moving when it has not met the model’s requirements. That outcome shows one possible process; it does not mean that one division or one DNA change equals cancer.</p>';
    }
    el.innerHTML=html;el.hidden=false;
  }
  function renderChanceReveal(){
    const g=state.game,notice=g.chanceNotice;
    let overlay=$('#chance-reveal');
    if(!overlay){
      overlay=document.createElement('div');overlay.id='chance-reveal';overlay.className='chance-reveal';overlay.hidden=true;
      overlay.innerHTML='<div class="chance-reveal-panel" role="dialog" aria-modal="true" aria-labelledby="chance-reveal-title" aria-describedby="chance-reveal-copy"><span class="chance-reveal-kicker">✦ ROUND 2 · CELLULAR CHANCE ✦</span><div class="chance-reveal-art" aria-hidden="true"><span id="chance-reveal-icon">🧬</span></div><p class="chance-reveal-player" id="chance-reveal-player"></p><h2 id="chance-reveal-title"></h2><p id="chance-reveal-copy"></p><p class="chance-reveal-note">This is a cell-cycle model event, not a cancer diagnosis.</p><button class="btn btn--primary" type="button" id="chance-reveal-ack">Acknowledge card & continue</button></div>';
      document.body.appendChild(overlay);
      $('#chance-reveal-ack').addEventListener('click',function(){state.game.chanceNotice=null;save();renderChanceReveal();if(state.game.complete)$('#round-summary').focus();else $('#roll-dice').focus();});
      overlay.addEventListener('keydown',function(e){if(e.key==='Tab'){e.preventDefault();$('#chance-reveal-ack').focus();}});
    }
    overlay.hidden=!notice;
    if(!notice)return;
    $('#chance-reveal-icon').textContent=notice.icon||'🧬';
    $('#chance-reveal-player').textContent='Player '+notice.player+' drew a card';
    $('#chance-reveal-title').textContent=notice.title;
    $('#chance-reveal-copy').textContent=notice.copy;
    $('#chance-reveal-ack').focus();
  }
  function renderGame(){
    const g=state.game,setup=$('#game-setup'),panel=$('#game-panel');
    $('#cell-game').classList.toggle('game-running',!!g.round);
    setup.hidden=!!g.round;panel.hidden=false;panel.classList.toggle('is-pregame',!g.round);
    $('#start-round1').hidden=!!g.round;
    $('#start-round2').hidden=true;
    if(!g.round){renderChanceReveal();renderDice();renderBoard();renderSummary();fitGameViewport();return;}
    const p=g.playersState[g.active]||g.playersState.find(function(x){return x.status==='playing';});
    if(!p)return;
    $('#round-label').textContent=roundName(g.round);
    $('#active-player-label').textContent=p.status==='finished'?'Round complete':'Player '+p.id+'’s turn';
    $('#turn-instruction').textContent=turnInstruction(p);
    $('#phase-label').textContent=phaseLabel(p);
    $('#position-label').textContent='Space '+(p.pos+1)+' · '+track[p.pos].label;
    $('#dice-prompt').textContent=turnInstruction(p);
    $('#dice-result').textContent=g.lastDice.length?(g.lastRollSummary||'See the turn result below.'):'Four dice are ready. Roll when it is your turn.';
    $('#roll-dice').textContent=p.bonusRolls?'Roll bonus dice':'Roll four dice';
    $('#roll-dice').disabled=!!g.rolling||g.complete;
    $('#roll-dice').hidden=g.complete;
    $('#turn-event').classList.toggle('is-card',g.event.kicker==='Cellular chance card');
    $('#event-icon').textContent=g.event.icon||'🧬';
    $('#event-kicker').textContent=g.event.kicker||'Cell cycle';
    $('#event-title').textContent=g.event.title||'Your turn';
    $('#event-copy').textContent=g.event.copy||'Move one space and roll four dice.';
    renderDice();renderBoard();renderScorecards();renderCheckpoint();renderHistory();renderSummary();renderChanceReveal();
    $('#restart-round').hidden=!g.round;
    $('#reset-game').hidden=!g.round;
    fitGameViewport();
  }
  function fitGameViewport(){
    const active=!!state.game.round&&($('#cell-game').classList.contains('is-current')||location.hash==='#cell-game');
    document.body.classList.toggle('cell-game-active',active);
    if(!active||window.innerWidth<1100||$('#cell-board').classList.contains('scene-expanded'))return;
    const board=$('#cell-board'),nav=$('.step-nav');
    const top=Math.max(board.getBoundingClientRect().top,(nav?nav.getBoundingClientRect().bottom:0)+10);
    $('#game-panel').style.setProperty('--game-scene-height',Math.max(300,Math.min(780,window.innerHeight-top-18))+'px');
  }
  function startRound(round,mode,players){
    const old=state.game,selectedMode=mode||($('input[name="game-mode"]:checked')||{}).value||old.mode||'solo';
    const count=Number(players|| (selectedMode==='group'?$('#group-size').value:1))||1;
    const results=round===2&&old.roundResults&&old.roundResults[1]?{1:old.roundResults[1]}:{};
    state.game={schema:2,mode:selectedMode,players:count,round:round,active:0,turns:0,complete:false,playersState:Array.from({length:count},function(_,i){return makePlayer(i);}),chanceDeck:round===2?shuffledDeck():[],logs:[],lastDice:[],lastRollSummary:'',roundResults:results,event:{title:'Round '+round+' begins',copy:round===1?'Move each cell through the cycle and check its materials at G1 and G2.':'Same board, new chance events. Some checkpoint responses may be disrupted.',icon:'🎲',kicker:roundName(round)}};
    save();renderGame();$('#roll-dice').focus({preventScroll:true});
  }
  function drawChance(p){
    const g=state.game;
    if(!g.chanceDeck.length)g.chanceDeck=shuffledDeck();
    const idx=g.chanceDeck.shift();g.chanceDeck.push(idx);
    const card=chanceCards[idx];
    let cardCopy=card.copy;
    if(card.id==='dna'){
      if(track[p.pos].phase==='s')p.score.s.chromosomes=Math.max(4,p.score.s.chromosomes);
      else cardCopy='This card appeared outside S phase, so it adds no DNA copies. In this model, DNA copying happens only in S phase.';
    }
    g.chanceNotice={player:p.id,title:card.title,copy:cardCopy,icon:card.icon};
    setEvent(card.title,cardCopy,card.icon,'Cellular chance card');
    addLog('Player '+p.id+': '+card.title+'.');
    if(card.id==='bonus'){p.bonusRolls++;return true;}
    if(card.id==='reset'){
      p.pos=0;p.score=zeroScore();p.restarts++;p.bonusRolls=0;
      setEvent(card.title,cardCopy,card.icon,'Cellular chance card');
    }else if(card.id==='skip'){p.skipTurns++;}
    else if(card.id==='advance'){
      const dest=Math.min(30,p.pos+3);p.bypassed+= [7,23,29].filter(function(n){return n>p.pos&&n<=dest;}).length;p.pos=dest;
      if(p.pos===30){p.status='finished';p.divisions++;p.unchecked++;setEvent('Unchecked division in the model','The cell passed the final checkpoint without the normal check. This is a model outcome, not a diagnosis.','⚠️','Checkpoint bypassed');}
    }else if(card.id==='bypass'){
      const cp=nextCheckpoint(p.pos);p.bypassed++;
      if(cp>=29){p.pos=30;p.status='finished';p.divisions++;p.unchecked++;setEvent('Division without a checkpoint check','The model cell bypassed the final checkpoint. This shows why cell-cycle controls matter; it does not predict cancer.','⚠️','Checkpoint bypassed');}
      else p.pos=cp+1;
    }
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
  function checkCheckpoint(p){
    const s=p.score;
    if(p.pos===7){
      const values=[s.g1.nutrients,s.g1.proteins,s.g1.organelles];
      if(values.some(function(x){return x<3;})){addLog('Player '+p.id+' paused at the G1 checkpoint to gather missing materials.');setEvent('G1 checkpoint: cell-cycle pause','The cell stays at the checkpoint while it gathers any missing nutrients, proteins, or organelles. A checkpoint pauses progression; it does not rewind the cell.','⏸️','Checkpoint response');return;}
      addLog('Player '+p.id+' passed the G1 checkpoint.');setEvent('G1 checkpoint passed','The G1 scorecard has at least three nutrients, proteins, and organelles. The cell can continue to S phase.','✅','Checkpoint passed');return;
    }
    if(p.pos===23){
      const values=[s.g2.nutrients,s.g2.proteins,s.g2.organelles];
      if(s.s.chromosomes<4){p.pos=8;addLog('Player '+p.id+' returned to S phase for more DNA copying.');setEvent('G2 checkpoint: return to S phase','The S-phase scorecard has fewer than four chromosome copies. Return to the first S space and copy DNA again.','↩️','Checkpoint response');return;}
      if(values.some(function(x){return x<1;})){addLog('Player '+p.id+' paused at the G2 checkpoint to gather missing materials.');setEvent('G2 checkpoint: cell-cycle pause','The cell stays at the checkpoint while it gathers at least one of each G2 material. A checkpoint pauses progression; it does not restart the cell.','⏸️','Checkpoint response');return;}
      addLog('Player '+p.id+' passed the G2 checkpoint.');setEvent('G2 checkpoint passed','The cell has at least four chromosome copies and at least one of each G2 material. It can move toward division.','✅','Checkpoint passed');return;
    }
    if(p.pos===29){
      const ok=s.g1.nutrients>=3&&s.g1.proteins>=3&&s.g1.organelles>=3&&s.s.chromosomes>=4&&s.g2.nutrients>=1&&s.g2.proteins>=1&&s.g2.organelles>=1;
      if(s.m.attachments<4){setEvent('M checkpoint: spindle attachment incomplete','The cell waits at the M checkpoint until all four modeled chromosome units are attached. A 5 or 6 on any die records one attachment; this is a simplified stand-in for the real spindle-assembly checkpoint.','⏸️','Checkpoint response');return;}
      if(!ok){
        p.pos=s.s.chromosomes<4?8:(s.g1.nutrients<3||s.g1.proteins<3||s.g1.organelles<3?1:15);
        addLog('Player '+p.id+' returned to gather missing materials before M phase.');
        setEvent('M checkpoint: gather what is missing','The scorecard does not yet meet every phase requirement. The cell returns to gather what is missing.','↩️','Checkpoint response');return;
      }
      p.pos=30;p.status='finished';p.divisions++;
      addLog('Player '+p.id+' completed a regulated model division.');
      setEvent('The model cell completes division','The cell met the G1, S, and G2 requirements and divides into daughter cells. A completed division is not the same as cancer.','🧬','Division complete');
    }
  }
  function scoreRoll(p,dice,required){
    const tile=track[p.pos],phase=tile.phase;
    if(tile.type==='checkpoint'&&(phase==='g1'||phase==='g2')){
      const bucket=p.score[phase];
      dice.forEach(function(v){if(v===1)bucket.nutrients++;if(v===2)bucket.proteins++;if(v===3)bucket.organelles++;});
    }else if(tile.type==='space'&&(phase==='g1'||phase==='g2')){
      const bucket=p.score[phase];
      dice.forEach(function(v){if(v===1)bucket.nutrients++;if(v===2)bucket.proteins++;if(v===3)bucket.organelles++;});
    }else if(tile.type==='space'&&phase==='s')dice.forEach(function(v){if(v===4)p.score.s.chromosomes++;});
    if(required==='spindle'&&(dice.includes(5)||dice.includes(6)))p.score.m.attachments++;
  }
  function activeNext(index){
    const g=state.game,n=g.playersState.length;
    let skipped=0;
    for(let step=1;step<=n;step++){
      const i=(index+step)%n,p=g.playersState[i];
      if(p.status!=='playing')continue;
      if(p.skipTurns>0){p.skipTurns--;skipped++;addLog('Player '+p.id+' loses a turn; the next player rolls.');continue;}
      g.active=i;return;
    }
    if(finishIfAll())return;
    // Every other player used up a skipped turn. Hand the dice to the next player who is still playing; the player
    // who just finished (index) may no longer be playing, and giving them the dice would leave the round stuck.
    let next=index;
    for(let step=1;step<=n;step++){const i=(index+step)%n;if(g.playersState[i].status==='playing'){next=i;break;}}
    g.active=next;
    if(skipped)setEvent('The group has completed its skipped turns','Every other active player lost a turn to a chance event. Player '+g.playersState[next].id+' rolls next.','⏸️','Turn skipped');
  }
  function rollDice(){
    const g=state.game,p=g.playersState[g.active];
    if(!p||p.status!=='playing'||g.complete||g.rolling||g.chanceNotice)return;
    g.rolling=true;renderDice();$('#roll-dice').disabled=true;
    window.setTimeout(function(){
      if(state.game!==g)return;
      const dice=Array.from({length:4},function(){return 1+Math.floor(Math.random()*6);});
      g.rolling=false;g.lastDice=dice;g.turns++;
      const bonus=p.bonusRolls>0,required=bonus?null:getTarget(p),startPos=p.pos;
      const waitingG1=startPos===7&&(p.score.g1.nutrients<3||p.score.g1.proteins<3||p.score.g1.organelles<3);
      const waitingG2=waitingAtG2(p),waiting=waitingG1||waitingG2;
      let moved=false,missed=null,attachmentRecorded=false;
      if(bonus)p.bonusRolls--;
      else if(waiting){/* A checkpoint pause holds the cell in place while it gathers G1 or G2 materials. */}
      else if(required!==null){
        const matched=required==='spindle'?(dice.includes(5)||dice.includes(6)):dice.includes(required);
        if(matched){attachmentRecorded=required==='spindle';if(startPos!==29){p.pos=Math.min(30,p.pos+1);moved=true;}}
        else missed=required;
      }else{p.pos=Math.min(30,p.pos+1);moved=true;}
      const rollPos=bonus?startPos:p.pos;
      if(moved||bonus||waiting||attachmentRecorded)scoreRoll(p,dice,required);
      const landed=p.pos,summary=currentSummary(track[rollPos],dice,required,missed,bonus,waitingG2);
      g.lastRollSummary=summary;
      let message=summary;
      if(missed!==null)message=(missed==='spindle'?'No 5 or 6 rolled.':'No '+missed+' rolled.')+' The cell stays on its space this turn. '+summary;
      if(bonus)message='Bonus roll—your token stays put. '+summary;
      setEvent(bonus?'Bonus dice added':missed!==null?'The cell waits for the needed roll':'Materials collected',message,'🎲','Four-dice roll');
      addLog('Player '+p.id+' · '+phaseLabel(p)+' · ['+dice.join(', ')+'] · '+message);
      if((moved&&[7,23,29].includes(p.pos))||(waiting&&[7,23].includes(p.pos))||(attachmentRecorded&&p.pos===29))checkCheckpoint(p);
      else if(moved&&g.round===2&&track[landed].chance){
        const keepTurn=drawChance(p);
        if(keepTurn&&p.status==='playing'){g.active=p.id-1;}
      }
      if(p.pos===30&&p.status==='playing'){
        p.status='finished';p.divisions++;p.unchecked++;
        addLog('Player '+p.id+' completed a model division after bypassing the final checkpoint.');
        setEvent('Division after a bypassed checkpoint','This model cell reached division after a chance event bypassed the final check.','⚠️','Checkpoint bypassed');
      }
      if(p.pos!==landed||g.chanceNotice||g.event.kicker==='Checkpoint response'||g.event.kicker==='Checkpoint passed'||p.status==='finished'){
        g.lastRollSummary='Dice ['+dice.join(', ')+']. '+g.event.title+': '+g.event.copy;
      }
      finishIfAll();
      const bonusRemains=p.bonusRolls>0&&p.status==='playing'&&!g.complete;
      if(!bonusRemains&&!g.complete)activeNext(g.active);
      if(g.complete)finishIfAll();
      save();renderGame();renderAnalysisReference();
      if(g.chanceNotice)$('#chance-reveal-ack').focus();else if(g.complete)$('#round-summary').focus();else $('#roll-dice').focus({preventScroll:true});
    },480);
  }
  function resetRound(){
    confirmGameReset('Restart this round?', 'This clears the current round’s board and scorecards. Your growth trials and written answers stay saved.',function(){startRound(state.game.round,state.game.mode,state.game.players);renderAnalysisReference();});
  }
  function resetGame(){
    confirmGameReset('Set up a new game?', 'This clears both game rounds and returns to player setup. Your growth trials and written answers stay saved.',function(){state.game=blankGame();save();renderGame();renderAnalysisReference();$('#start-round1').focus();});
  }
  function confirmGameReset(title,copy,action){
    const dialog=$('#game-reset-dialog');
    $('#game-reset-title').textContent=title;$('#game-reset-description').textContent=copy;
    $('#confirm-game-reset').onclick=function(){dialog.close();action();};
    dialog.showModal();
  }
  function labelBody(v){return ({small:'Smaller',average:'Average',large:'Larger'})[v]||v;}
  function labelTissue(v){return window.GrowthCellTypes.profile(v).short;}
  function simulateOne(age,size,tissue){return window.GrowthCellTypes.simulate(age,size,tissue);}
  function renderCellType(){
    const p=window.GrowthCellTypes.profile($('#tissue-rate').value);
    $('#cell-type-description').textContent=p.description||'This is an earlier model setting.';
  }
  function settings(){return {age:Number($('#age-slider').value),size:$('#body-size').value,tissue:$('#tissue-rate').value};}
  function trialGroups(){
    const groups=[];
    for(let i=0;i<state.trials.length;i+=3){
      const trials=state.trials.slice(i,i+3),t=trials[0],values=trials.map(t=>t.divisions);
      groups.push({id:String(groups.length),index:groups.length+1,age:t.age,size:t.size,tissue:t.tissue,trials:trials,mean:values.reduce((a,b)=>a+b,0)/values.length,min:Math.min(...values),max:Math.max(...values)});
    }return groups;
  }
  function setLabel(g){return 'Set '+g.index+' · age '+g.age+' · '+labelBody(g.size)+' · '+labelTissue(g.tissue);}
  function fillSelect(el,groups,fallback){
    const current=el.value||state.fields[el.id];
    el.innerHTML='';
    groups.forEach(g=>{const option=document.createElement('option');option.value=g.id;option.textContent=setLabel(g);el.appendChild(option);});
    el.disabled=groups.length===0;
    if(groups.length)el.value=groups.some(g=>g.id===current)?current:String(fallback);
  }
  function renderTrials(){
    const body=$('#trial-rows'),groups=trialGroups();body.innerHTML='';
    if(!state.trials.length)body.innerHTML='<tr><td colspan="7">Run trials to collect results.</td></tr>';
    state.trials.forEach(function(t,i){
      const tr=document.createElement('tr');
      ['Set '+(Math.floor(i/3)+1)+' / '+(i%3+1),String(t.age),labelBody(t.size),labelTissue(t.tissue),String(t.divisions),String(t.opportunities),t.modelVersion===2?String(t.cancerCount):'—'].forEach(function(v){const td=document.createElement('td');td.textContent=v;tr.appendChild(td);});
      body.appendChild(tr);
    });
    if(window.GrowthModelScene)window.GrowthModelScene.chart(groups);
    const last=groups[groups.length-1];
    $('#set-summary').textContent=last?setLabel(last)+': '+last.trials.map(t=>t.divisions).join(', ')+' divisions. Mean '+last.mean.toFixed(1)+'; range '+last.min+'–'+last.max+'.'+(last.trials.every(t=>t.modelVersion===2)?' Cancer-state units by trial: '+last.trials.map(t=>t.cancerCount).join(', ')+'.':' Cancerous state was not tracked in these earlier trials.'):'Run a set to begin your comparison.';
    fillSelect($('#compare-a'),groups,0);fillSelect($('#compare-b'),groups,Math.max(0,groups.length-1));
    fillSelect($('#replay-set'),groups,Math.max(0,groups.length-1));
    $('#replay-growth').disabled=!groups.length;
    renderComparison();renderAnalysisReference();renderReport();
  }
  let analysisPage=0;
  function showAnalysisPage(index){
    analysisPage=Math.max(0,Math.min(2,index));
    $$('#analyze [data-analysis-page]').forEach(el=>{el.hidden=Number(el.dataset.analysisPage)!==analysisPage;});
    $('#analysis-page-status').textContent='Part '+(analysisPage+1)+' of 3 · '+['Compare data','Explain mechanisms','Revise your model'][analysisPage];
    for(const id of ['analysis-prev','analysis-prev-bottom'])$('#'+id).disabled=analysisPage===0;
    for(const id of ['analysis-next','analysis-next-bottom']){$('#'+id).disabled=analysisPage===2;}
  }
  function renderAnalysisReference(){
    const out=$('#analysis-reference-data');if(!out)return;
    const groups=trialGroups();out.replaceChildren();
    const heading=document.createElement('h4');heading.textContent='Growth-model results';out.appendChild(heading);
    if(!groups.length){const p=document.createElement('p');p.textContent='Run three trials in the Growth Model to collect evidence for these questions.';out.appendChild(p);}
    groups.forEach(g=>{
      const box=document.createElement('div');box.className='analysis-evidence-set';
      const title=document.createElement('strong');title.textContent=setLabel(g);box.appendChild(title);
      const trials=document.createElement('p');trials.textContent='Trial divisions: '+g.trials.map(t=>t.divisions).join(' · ')+' | Mean: '+g.mean.toFixed(1);box.appendChild(trials);
      const bar=document.createElement('div');bar.className='analysis-evidence-bar';bar.setAttribute('aria-hidden','true');const fill=document.createElement('span');fill.style.width=Math.max(2,100*g.mean/Math.max(1,...groups.map(x=>x.mean)))+'%';bar.appendChild(fill);box.appendChild(bar);
      const cancer=document.createElement('p');cancer.textContent='Cancer-state units: '+g.trials.map(t=>t.modelVersion===2?t.cancerCount:'not recorded').join(' · ');box.appendChild(cancer);out.appendChild(box);
    });
    const game=document.createElement('h4');game.textContent='Cell-cycle game evidence';out.appendChild(game);
    for(const n of [1,2]){const r=roundEvidence(n);if(!r)continue;const p=document.createElement('p');p.textContent='Round '+n+(r.inProgress?' (in progress)':' (complete)')+': '+r.rolls+' rolls; '+r.divisions+' divisions; '+r.bypassed+' checkpoints bypassed; '+r.unchecked+' unchecked divisions; '+r.restarts+' restarts.';out.appendChild(p);}
    const note=document.createElement('p');note.className='small';note.textContent='Model counts are invented teaching units, not measured cancer risk. Magenta cells represent the model state after three control changes.';out.appendChild(note);
  }
  function renderComparison(){
    const groups=trialGroups(),a=groups[Number($('#compare-a').value)],b=groups[Number($('#compare-b').value)],out=$('#comparison-evidence');
    out.innerHTML='';
    $('#sentence-evidence').textContent='Sentence starter: “When I changed ___, the mean changed from ___ to ___ divisions. This matters because ___.”';
    function para(text,className){const p=document.createElement('p');if(className)p.className=className;p.textContent=text;out.appendChild(p);}
    if(groups.length<2||!a||!b){para('Collect two sets to reveal your evidence comparison.');return;}
    if(a.id===b.id){para('Choose two different sets to compare.');return;}
    const changed=['age','size','tissue'].filter(k=>a[k]!==b[k]),names={age:'modeled age',size:'modeled body size',tissue:'cell type'};
    const title=document.createElement('h3');title.textContent=changed.length===1?'One setting changed: '+names[changed[0]]:changed.length?'More than one setting changed':'Same settings, separate trials';out.appendChild(title);
    const display=document.createElement('div');display.className='comparison-means';
    for(const g of [a,b]){const el=document.createElement('div'),n=document.createElement('strong'),label=document.createElement('span'),range=document.createElement('small');n.textContent=g.mean.toFixed(1);label.textContent='Set '+g.index+' mean divisions';range.textContent='Range '+g.min+'–'+g.max+' · '+g.trials.length+' trials';el.append(n,label,range);display.appendChild(el);}out.appendChild(display);
    const diff=b.mean-a.mean;
    para('The second mean is '+(diff===0?'the same.':Math.abs(diff).toFixed(1)+(diff>0?' divisions higher.':' divisions lower.')),'comparison-difference');
    if(changed.length>1)para('You changed '+changed.map(k=>names[k]).join(' and ')+'. Try another set changing only one setting so you can connect the difference to that setting.');
    else if(!changed.length)para('Repeated trials vary even with identical settings. That is why we compare several trials.');
    else if(a.min<=b.max&&b.min<=a.max)para('The trial ranges overlap. These recorded results show variation; collect more evidence before deciding how clear the pattern is.');
    else para('The recorded trial ranges do not overlap in this comparison. Use the numbers as evidence, and remember that three trials are a small sample.');
    $('#sentence-evidence').textContent='Use your evidence: “'+(changed.length===1?'When I changed '+names[changed[0]]:'Between Set '+a.index+' and Set '+b.index)+', the mean changed from '+a.mean.toFixed(1)+' to '+b.mean.toFixed(1)+' divisions. Each division creates another opportunity to copy DNA, so…”';
    if(changed.length===1&&changed[0]==='tissue')$('#sentence-evidence').textContent='These sets compare cell types (Question 3). For Question 4, choose two sets that change age or body size while keeping the other settings the same.';
  }
  function renderReport(){
    const report=$('#investigation-report');if(!report)return;
    const groups=trialGroups();report.innerHTML='';
    const kicker=document.createElement('div');kicker.className='eyebrow';kicker.textContent='Cell cycle & growth · My evidence';report.appendChild(kicker);
    const h=document.createElement('h3');h.textContent='Your investigation, at a glance.';report.appendChild(h);
    const student=studentIdentity(),identity=document.createElement('p');identity.className='report-student';
    identity.textContent=student?'Student: '+student.name+(student.period?' · Class period: '+student.period:''):'Student name not entered. Sign in on the OpenSciEd dashboard before submitting.';
    report.appendChild(identity);
    const list=document.createElement('ul');list.className='report-checks';
    const labels=['Round 1: '+(state.game.roundResults[1]?'completed':'not completed'),'Round 2: '+(state.game.roundResults[2]?'completed':'not completed'),groups.length+' model set'+(groups.length===1?'':'s')+' recorded',ANALYSIS_PROMPTS.filter(item=>$('#'+item[1]).value.trim()).length+' of '+ANALYSIS_PROMPTS.length+' analysis responses written'];
    labels.forEach(t=>{const li=document.createElement('li');li.textContent=t;list.appendChild(li);});report.appendChild(list);
    if(groups.length){const wrap=document.createElement('div');wrap.className='table-wrap';const table=document.createElement('table');table.className='data';table.innerHTML='<caption>Recorded sets</caption><thead><tr><th>Set</th><th>Settings</th><th>Trial divisions</th><th>Mean</th><th>Cancer-state units by trial</th></tr></thead>';const body=document.createElement('tbody');
      groups.forEach(g=>{const row=document.createElement('tr');[String(g.index),'Age '+g.age+' / '+labelBody(g.size)+' / '+labelTissue(g.tissue),g.trials.map(t=>t.divisions).join(', '),g.mean.toFixed(1),g.trials.map(t=>t.modelVersion===2?String(t.cancerCount):'—').join(', ')].forEach(text=>{const td=document.createElement('td');td.textContent=text;row.appendChild(td);});body.appendChild(row);});table.appendChild(body);wrap.appendChild(table);report.appendChild(wrap);}
    for(const n of [1,2]){const r=roundEvidence(n);if(!r)continue;const row=document.createElement('p');row.className='report-round';row.textContent='Round '+n+(r.inProgress?' (in progress)':' (complete)')+': '+r.rolls+' rolls, '+r.divisions+' completed divisions, '+r.unchecked+' unchecked divisions, '+r.bypassed+' checkpoints bypassed, '+r.restarts+' restarts.';report.appendChild(row);}
    for(const [label,id] of ANALYSIS_PROMPTS.concat([['One model limitation','model-limit']])){const h=document.createElement('h4');h.textContent=label;const p=document.createElement('p');p.className='report-answer';p.textContent=$('#'+id).value.trim()||'Not answered yet.';report.append(h,p);}
    const note=document.createElement('p');note.className='small muted';note.textContent='Simplified teaching model. Divisions are DNA-copying opportunities; these counts are not human measurements or cancer probabilities. The cancer state uses three explicitly modeled control changes and deliberately accelerated teaching rules.';report.appendChild(note);
  }
  function runTrials(){
    const s=settings(),trials=[];
    for(let i=0;i<3;i++)trials.push(simulateOne(s.age,s.size,s.tissue));
    state.trials.push(...trials);renderTrials();
    const last=String(trialGroups().length-1);$('#replay-set').value=last;$('#compare-b').value=last;
    renderComparison();save();
    if(window.GrowthModelScene)window.GrowthModelScene.play(trials);
  }
  function download(){
    save();
    const payload={format:'openscied-b3-cell-cycle-progress-v1',exportedAt:new Date().toISOString(),student:studentIdentity(),game:state.game,simulationTrials:state.trials,answers:state.fields};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cell-cycle-cancer-model-work.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  function reset(){
    if(!window.confirm('Clear this activity’s saved work from this browser?'))return;
    localStorage.removeItem(KEY);window.location.reload();
  }
  function wire(){
    readStore();state.game.rolling=false;restoreFields();renderTrials();renderGame();renderCellType();showAnalysisPage(0);
    window.addEventListener('hashchange',save);
    window.addEventListener('resize',function(){fitGameViewport();renderBoard();},{passive:true});
    document.addEventListener('companion:show',function(){requestAnimationFrame(fitGameViewport);});
    $('#cancel-game-reset').addEventListener('click',function(){$('#game-reset-dialog').close();});
    $('#age-slider').addEventListener('input',function(){$('#age-value').textContent=this.value;if(window.GrowthModelScene)window.GrowthModelScene.configure(settings());save();});
    ['body-size','tissue-rate'].forEach(id=>$('#'+id).addEventListener('change',function(){renderCellType();if(window.GrowthModelScene)window.GrowthModelScene.configure(settings());}));
    if(window.GrowthModelScene)window.GrowthModelScene.configure(settings());
    $('#growth-scene').addEventListener('growth-playback',function(event){
      const d=event.detail,has=state.trials.length>0;
      $('#growth-age').textContent=d.year;$('#growth-scrub').max=d.target;$('#growth-scrub').value=d.year;
      $('#growth-scrub').disabled=!has||!d.hasHistory||d.type==='settings';$('#pause-growth').disabled=!has||!d.hasHistory||d.type==='settings';
      $('#pause-growth').textContent=d.playing?'Pause playback':'Resume playback';
      if(d.type==='start')$('#growth-status').textContent='Playing three recorded trials. Years are compressed into seconds.';
      if(d.type==='complete')$('#growth-status').textContent='Playback complete. All three trials are saved; compare their counts below.';
      if(d.type==='settings')$('#growth-status').textContent='Settings changed. Run three trials to record this setup.';
      if(d.type==='scrub')$('#growth-status').textContent='Trial '+d.trial+' at age '+d.year+': '+d.divisions+' recorded divisions.'+(d.hasCancerState?' '+d.cancerCount+' cancer-state units in this teaching model.':' Cancerous state was not tracked in this earlier trial.');
      if(d.type==='pause')$('#growth-status').textContent=d.playing?'Playback resumed.':'Playback paused. Drag the recorded-age slider to inspect the history.';
    });
    $('#pause-growth').addEventListener('click',function(){if(window.GrowthModelScene)window.GrowthModelScene.pause();});
    $('#enlarge-growth').addEventListener('click',function(){
      const expanded=$('#growth-stage').classList.toggle('growth-expanded');
      this.setAttribute('aria-pressed',String(expanded));this.textContent=expanded?'Close enlarged model ×':'Enlarge model ↗';
      $('#growth-stage').setAttribute('role',expanded?'dialog':'group');
      if(expanded)$('#growth-stage').setAttribute('aria-modal','true');else $('#growth-stage').removeAttribute('aria-modal');
      document.body.classList.toggle('growth-open',expanded);
    });
    document.addEventListener('keydown',function(event){
      if(!$('#growth-stage').classList.contains('growth-expanded'))return;
      if(event.key==='Escape'){$('#enlarge-growth').click();$('#enlarge-growth').focus();}
      if(event.key==='Tab'){
        const first=$('#enlarge-growth'),last=$('#growth-scene');
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });

    $('#growth-scrub').addEventListener('input',function(){if(window.GrowthModelScene)window.GrowthModelScene.scrub(Number(this.value));});
    $('#replay-growth').addEventListener('click',function(){const g=trialGroups()[Number($('#replay-set').value)];if(g&&window.GrowthModelScene)window.GrowthModelScene.play(g.trials);});
    ['compare-a','compare-b'].forEach(id=>$('#'+id).addEventListener('change',function(){renderComparison();save();}));
    $$('input[name="game-mode"]').forEach(function(el){el.addEventListener('change',function(){$('#group-size-wrap').hidden=this.value!=='group';save();});});
    $('#start-round1').addEventListener('click',function(){startRound(1);});
    $('#start-round2').addEventListener('click',function(){startRound(2);});
    $('#roll-dice').addEventListener('click',rollDice);
    $('#enlarge-scene').addEventListener('click',function(){
      const expanded=$('#cell-board').classList.toggle('scene-expanded');
      this.setAttribute('aria-pressed',String(expanded));this.textContent=expanded?'Close enlarged model ×':'Enlarge model ↗';
      document.body.classList.toggle('scene-open',expanded);
      $('#cell-board').setAttribute('role',expanded?'dialog':'group');
      if(expanded)$('#cell-board').setAttribute('aria-modal','true');else $('#cell-board').removeAttribute('aria-modal');
    });
    document.addEventListener('keydown',function(event){
      if(!$('#cell-board').classList.contains('scene-expanded'))return;
      if(event.key==='Escape')$('#enlarge-scene').click();
      if(event.key==='Tab'){
        const controls=Array.from($('#cell-board').querySelectorAll('button:not([hidden]):not(:disabled)'));
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    $('#restart-round').addEventListener('click',resetRound);
    $('#reset-game').addEventListener('click',resetGame);
    $('#round-summary').addEventListener('click',function(event){if(event.target&&event.target.id==='start-round2-from-summary')startRound(2,state.game.mode,state.game.players);});
    for(const id of ['analysis-prev','analysis-prev-bottom'])$('#'+id).addEventListener('click',()=>showAnalysisPage(analysisPage-1));
    for(const id of ['analysis-next','analysis-next-bottom'])$('#'+id).addEventListener('click',()=>showAnalysisPage(analysisPage+1));
    $('#run-trials').addEventListener('click',runTrials);
    $('#clear-trials').addEventListener('click',function(){if(state.trials.length&&!window.confirm('Clear the growth-model results? The board game and your explanation will stay saved.'))return;state.trials=[];if(window.GrowthModelScene)window.GrowthModelScene.configure(settings());renderTrials();save();});
    $('#check-background').addEventListener('click',function(){
      const choice=$('input[name="quick-check"]:checked');
      const out=$('#background-feedback');
      if(!choice){out.textContent='Choose one idea first.';return;}
      state.quick=choice.value==='b'?'Yes. Checkpoints can pause cell division when a cell needs to respond. p53 is one important part of a larger control system.':'Try again. Cell division does not always cause cancer, and p53 is not the only cell-cycle control.';
      out.textContent=state.quick;save();
    });
    $('#check-mechanism').addEventListener('click',function(){
      const choice=$('input[name="mechanism-check"]:checked');
      const out=$('#mechanism-feedback');
      if(!choice){out.textContent='Choose one idea first.';return;}
      state.mechanism=choice.value==='a'?'Yes. A bypass can let a cell continue with damage or missing requirements, so daughter cells may inherit problems. That raises concern, but it does not guarantee cancer.':'Try again. A bypass can let a cell pass on problems to daughter cells, but one bypass does not automatically cause cancer, and p53 is one part of a larger control system.';
      out.textContent=state.mechanism;save();
    });
    const evidence=$$('#analyze input[type="checkbox"]');
    evidence.forEach(function(el){el.addEventListener('change',function(){
      const selected=evidence.filter(x=>x.checked),bad=$('#ev-guarantee').checked;
      $('#evidence-hint').textContent=bad?'Recheck that statement: the model does not show every division causing cancer.':selected.length?'Compare your selected evidence with your results table.':'Choose evidence that matches your table.';
      save();
    });});
    $('#download-work').addEventListener('click',download);
    $('#print-work').addEventListener('click',function(){renderReport();window.print();});
    $('#reset-work').addEventListener('click',reset);
    $$('input,textarea,select').forEach(function(el){el.addEventListener('change',save);el.addEventListener('input',save);});
    save();
  }  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
