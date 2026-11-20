(function(){
  'use strict';
  const KEY='aplab:openscied:b3-cell-cycle:v1';
  const $=function(s,root){return (root||document).querySelector(s);};
  const $$=function(s,root){return Array.from((root||document).querySelectorAll(s));};
  function blankGame(){return {schema:3,mode:'solo',players:1,round:0,active:0,turns:0,complete:false,playersState:[],chanceDeck:[],logs:[],lastDice:[],lastRollSummary:'',roundResults:{},chanceNotice:null,checkpointNotice:null,event:{title:'Your cell is ready',copy:'Choose your players and start Round 1 to begin.',icon:'🧬',kicker:'Cell cycle'}};}
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
  // Lesson 3 Making Sense (Round 1 handout table, Round 2 handout questions, and the Teacher Edition's limits discussion).
  const MAKING_SENSE_ROWS=[['g1','Phase: G1'],['g1cp','G1 Checkpoint'],['s','Phase: S'],['g2','Phase: G2'],['g2cp','G2 Checkpoint'],['m','Phase: M'],['mcp','M Checkpoint']];
  const MAKING_SENSE_PROMPTS=[
    ['Round 2 · 1. What happened in Round 2 that was different from in Round 1?','ms-r2-q1'],
    ['Round 2 · 2. How did the differences change the outcome of the game?','ms-r2-q2'],
    ['Round 2 · 3. How was the role of p53 different?','ms-r2-q3'],
    ['Round 2 · 4. How does this game help answer the question, How do non-cancer cells become cancer cells?','ms-r2-q4'],
    ['Model limits · What did the model help us explain?','ms-limits-explain'],
    ['Model limits · What questions do we still have that the model COULD NOT help us answer?','ms-limits-could-not'],
    ['Model limits · How can we make progress on those questions?','ms-limits-progress']
  ];
  const MAKING_SENSE_IDS=MAKING_SENSE_ROWS.reduce(function(a,r){return a.concat(['ms-r1-'+r[0]+'-happened','ms-r1-'+r[0]+'-represent']);},[]).concat(MAKING_SENSE_PROMPTS.map(function(x){return x[1];}));
  // Every written-response field, saved with the work so the OpenSciEd dashboard counts what this activity asks.
  const RESPONSE_IDS=MAKING_SENSE_IDS.concat(ANALYSIS_PROMPTS.map(function(x){return x[1];}));
  function readStore(){
    try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d&&d.v===1){hadSaved=true;if(d.game&&d.game.schema===3){state.game=Object.assign(blankGame(),d.game);(state.game.playersState||[]).forEach(function(p){p.score=p.score||zeroScore();});}
      // Games saved under the earlier rules (schema 2) used a different board. Keep which rounds were completed, marked
      // as earlier results, and start the board fresh.
      else if(d.game&&d.game.schema===2){const old=d.game.roundResults||{},kept={};for(const n of [1,2])if(old[n])kept[n]={legacy:true};state.game=Object.assign(blankGame(),{mode:d.game.mode||'solo',players:d.game.players||1,roundResults:kept});}if(Array.isArray(d.trials))state.trials=d.trials;if(d.fields)state.fields=d.fields;if(d.quick)state.quick=d.quick;if(d.mechanism)state.mechanism=d.mechanism;if(SECTIONS.includes(d.lastSection))state.lastSection=d.lastSection;}}
    catch(e){}
  }
  let cleared=false,hadSaved=false;
  function save(){
    if(cleared)return;
    try{
      state.fields={};
      $$('input[type=radio]:checked,input[type=checkbox],#age-slider,textarea,select').forEach(function(el){
        if(el.name==='prediction')return;
        if(el.type==='checkbox')state.fields[el.id]=el.checked;
        else if(el.type==='radio')state.fields[el.name]=el.value;
        else state.fields[el.id]=el.value;
      });
      const section=location.hash.slice(1);if(SECTIONS.includes(section))state.lastSection=section;
      localStorage.setItem(KEY,JSON.stringify({v:1,game:state.game,trials:state.trials,fields:state.fields,responseIds:RESPONSE_IDS,quick:state.quick,mechanism:state.mechanism,lastSection:state.lastSection,lastVisitedAt:Date.now()}));
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
  // Board: the OpenSciEd B.3 Lesson 3 game board, in order. START, 6 G1, G1 Checkpoint, 8 S, 8 G2, G2 Checkpoint,
  // 5 M ("Must Roll" 1-5), M Checkpoint, FINISH. Light-blue squares (chance:true) draw a Cellular Chance card in Round 2.
  const track=[{type:'start',phase:'start',label:'START'}];
  for(let i=1;i<=6;i++)track.push({type:'space',phase:'g1',n:i,of:6,label:'G1 space '+i,chance:i%2===0});
  track.push({type:'checkpoint',phase:'g1',label:'G1 Checkpoint'});
  for(let i=1;i<=8;i++)track.push({type:'space',phase:'s',n:i,of:8,label:'S space '+i,chance:i%2===1});
  for(let i=1;i<=8;i++)track.push({type:'space',phase:'g2',n:i,of:8,label:'G2 space '+i,chance:i%2===1});
  track.push({type:'checkpoint',phase:'g2',label:'G2 Checkpoint'});
  for(let i=1;i<=5;i++)track.push({type:'space',phase:'m',n:i,of:5,roll:i,label:'M space '+i+' · Must roll '+i,chance:i%2===0});
  track.push({type:'checkpoint',phase:'m',label:'M Checkpoint'});
  track.push({type:'finish',phase:'finish',label:'FINISH'});
  const at=function(type,phase){return track.findIndex(function(t){return t.type===type&&(!phase||t.phase===phase);});};
  const G1CP=at('checkpoint','g1'),S1=G1CP+1,G2CP=at('checkpoint','g2'),MCP=at('checkpoint','m'),FINISH=at('finish'),CHECKPOINTS=[G1CP,G2CP,MCP];
  // The paper game runs for a set class time (15 minutes). The web version gives each player a fixed number of turns.
  const TURNS_PER_ROUND=75;
  const BOX={g1:5,s:4,g2:5};
  const zeroScore=function(){return {g1:{nutrients:0,proteins:0,organelles:0},s:{chromosomes:0},g2:{nutrients:0,proteins:0,organelles:0}};};
  // Each card also carries a short effect label (not printed on the card) shown under its title in the card dialog, the
  // turn event and the history: several printed cards share a title ("p53 is working well!") but do different things.
  // Round 2 Cellular Chance cards, worded as printed in Teacher Reference: Game Cards 2. The printed set has 14 cards
  // (three "destroys your cell" cards); the Round 2 handout and the Teacher Edition call for 13, so this deck has two.
  const WELL='p53 is working well!',NOT='p53 is not working!';
  const chanceCards=[
    {id:'extra',label:'Extra roll',title:WELL,copy:'You get an extra roll!',icon:'🛡️'},
    {id:'extra',label:'Extra roll',title:WELL,copy:'You get an extra roll!',icon:'🛡️'},
    {id:'extra',label:'Extra roll',title:WELL,copy:'You get an extra roll!',icon:'🛡️'},
    {id:'extra',label:'Extra roll',title:WELL,copy:'You get an extra roll!',icon:'🛡️'},
    {id:'extra',label:'Extra roll',title:WELL,copy:'You get an extra roll!',icon:'🛡️'},
    {id:'destroy',label:'Cell destroyed',title:WELL,copy:'p53 detects damage to your DNA and destroys your cell. Go back to the start.',icon:'🛡️'},
    {id:'destroy',label:'Cell destroyed',title:WELL,copy:'p53 detects damage to your DNA and destroys your cell. Go back to the start.',icon:'🛡️'},
    {id:'dna',label:'DNA filled',title:WELL,copy:'You fill all your DNA requirements for this round!',icon:'🧬'},
    {id:'lose',label:'Lose a turn',title:NOT,copy:'p53 will not let you pass. You lose a turn!',icon:'⚠️'},
    {id:'ahead3',label:'Move ahead 3',title:NOT,copy:'Move ahead 3 spaces.',icon:'⚠️'},
    {id:'skipNext',label:'Skip next checkpoint',title:NOT,copy:'Move your game piece to the space after the next checkpoint without checking your scorecard.',icon:'⚠️'},
    {id:'skipTwo',label:'Skip two checkpoints',title:NOT,copy:'Skip ahead two checkpoints and check your scorecard. If there’s only one checkpoint left, skip to the final checkpoint and check your scorecard.',icon:'⚠️'},
    {id:'finish',label:'Move to FINISH: red chip',title:NOT,copy:'Move directly to Finish. Collect a new RED cell chip and start the game again.',icon:'⚠️'}
  ];
  // Checkpoint cards, worded exactly as printed in Teacher Reference: Game Cards 1 (front of each card; the back shows
  // p53). Each printed line is a list of [text, bold] runs, matching the card's bold type. `outcome` names the line's
  // result so the card dialog can highlight the one that applies; `rows` are the scorecard values each card checks.
  // The cards are presentation only: checkCheckpoint() below is still the rule. The M card prints no line for an
  // incomplete scorecard; this game's rule for that case (destroyed by p53) is shown as a separate, labelled note.
  const DESTROYED_RUNS=[['A 0 in any category, ',false],['YOU HAVE BEEN DESTROYED by p53 AND MUST GO BACK TO THE START.',true]];
  const CHECKPOINT_CARDS={
    g1:{title:'G1 Checkpoint',intro:'Check your scorecard. If you have:',lines:[
      {outcome:'pass',runs:[['At least 3 nutrients, 3 proteins, and 3 organelles, YOU PASS THE CHECKPOINT.',false]]},
      {outcome:'back3',runs:[['2 in any category, GO BACK 3 SPACES.',false]]},
      {outcome:'back5',runs:[['1 in any category, GO BACK 5 SPACES.',false]]},
      {outcome:'destroyed',runs:DESTROYED_RUNS}],
      why:'p53 checks that the cell has grown and gathered enough before it makes new chromosomes.'},
    g2:{title:'G2 Checkpoint',intro:'Check your scorecard. If you have:',lines:[
      {outcome:'pass',runs:[['At least 4 DNA and at least 1 nutrient, 1 protein, and 1 organelle, YOU PASS THE CHECKPOINT.',false]]},
      {outcome:'backS',runs:[['Fewer than 4 DNA, GO BACK TO THE FIRST SPACE.',false]]},
      {outcome:'destroyed',runs:DESTROYED_RUNS}],
      why:'p53 checks the chromosomes and materials once more, so a cell does not start dividing without them.'},
    m:{title:'M Checkpoint',intro:'Double-check your scorecard. Make sure you have:',lines:[
      {req:'g1',runs:[['G1: at least 3 nutrients, 3 proteins, and 3 organelles.',false]]},
      {req:'s',runs:[['S: at least 4 DNA.',false]]},
      {req:'g2',runs:[['G2: at least 1 nutrient, 1 protein, and 1 organelle.',false]]},
      {outcome:'divided',runs:[['YOU SUCCESSFULLY DIVIDED!',true],[' Take a new blue cell chip!',false]]}],
      why:'This is the last check before one cell becomes two. When p53 is working, only cells with everything they need divide.'}
  };
  const CHECKPOINT_LABELS={pass:'Pass',back3:'Back 3 spaces',back5:'Back 5 spaces',backS:'Back to first S space',destroyed:'Destroyed by p53: back to START',divided:'Divided: blue cell chip'};
  function shuffledDeck(){
    const deck=chanceCards.map(function(card,i){return i;});
    for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const v=deck[i];deck[i]=deck[j];deck[j]=v;}
    return deck;
  }
  function makePlayer(i){return {id:i+1,pos:0,score:zeroScore(),status:'playing',turnsUsed:0,blue:0,red:0,destroyed:0,sentBack:0,skipped:0,skipTurns:0,bonusRolls:0,lastChip:null};}
  function roundName(round){return round===1?'Round 1 · p53 is working':'Round 2 · Cellular Chance cards';}
  function nextCheckpoint(pos){for(const n of CHECKPOINTS)if(n>pos)return n;return FINISH;}
  function setEvent(title,copy,icon,kicker){state.game.event={title:title,copy:copy,icon:icon||'🧬',kicker:kicker||'Cell cycle'};}
  function addLog(text){const g=state.game;g.logs.push(text);if(g.logs.length>120)g.logs.shift();}
  function where(pos){const t=track[pos];return t.type==='space'?t.phase.toUpperCase()+' space '+t.n+' of '+t.of:t.label;}
  function renderDice(){
    if(window.CellCycleScene)window.CellCycleScene.rolling(!!state.game.rolling);
    const p=state.game.playersState[state.game.active];
    $('#turn-count').textContent=p?'Turn '+Math.min(TURNS_PER_ROUND,p.turnsUsed+(p.status==='playing'&&!p.bonusRolls?1:0))+' of '+TURNS_PER_ROUND:'Turn 1 of '+TURNS_PER_ROUND;
  }
  function renderBoard(){
    if(window.CellCycleScene)window.CellCycleScene.update(state.game,track);
    const p=state.game.playersState[state.game.active];
    const daughters=p&&p.pos===FINISH?daughterText(p):'';
    $('#scene-description').textContent=p?'Player '+p.id+' is on '+where(p.pos)+'. '+(daughters?daughters+' ':'')+turnInstruction(p)+' Chips: '+p.blue+' blue (non-cancer cells), '+p.red+' red (cancer cells in this game model).':'Choose players to start. The board and cell model are shown above.';
    const canvas=$('#cycle-scene');
    if(canvas){if(!canvas.dataset.baseLabel)canvas.dataset.baseLabel=canvas.getAttribute('aria-label')||'';canvas.setAttribute('aria-label',canvas.dataset.baseLabel+(daughters?' Magnified view now: '+daughters:''));}
  }
  // What the magnified view shows after a division (matches the caption drawn by cell-cycle-scene.js).
  function daughterText(p){
    return p.lastChip==='red'
      ?'Daughter cells · one carries changed DNA (game model). One daughter cell has a changed chromosome, drawn red with a dashed outline and labelled CHANGED; the other has the original chromosomes.'
      :'Daughter cells · identical DNA. Both daughter cells have the same chromosome set.';
  }
  function chipText(p){return '<span class="chip-tally"><i class="chip chip-blue" aria-hidden="true"></i>'+p.blue+' blue <i class="chip chip-red" aria-hidden="true"></i>'+p.red+' red</span>';}
  function renderScorecards(){
    const g=state.game;
    $('#scorecards').innerHTML=g.playersState.map(function(p,index){
      const active=index===g.active&&p.status==='playing';
      const status=p.status==='done'?'Turns used up':p.bonusRolls?'Extra roll':p.skipTurns?'Loses next turn':'Turn '+Math.min(TURNS_PER_ROUND,p.turnsUsed+1)+' of '+TURNS_PER_ROUND;
      const row=function(label,vals,thresholds){return '<div class="score-phase-row"><strong>'+label+'</strong>'+vals.map(function(x,i){const na=x===null,met=!na&&x>=thresholds[i];return '<span class="'+(na?'score-na':met?'score-met':'')+'">'+(na?'—':'<b>'+x+'</b>'+(met?'<i class="score-check" aria-hidden="true">✓</i><span class="sr-only"> met</span>':''))+'</span>';}).join('')+'</div>';};
      return '<div class="player-score player-color-'+p.id+(active?' is-active':'')+(p.status==='done'?' is-done':'')+'"><div class="score-player"><i class="cell-token token-'+p.id+'">'+p.id+'</i><span>Player '+p.id+'</span><small>'+status+'</small></div>'+
        '<p class="score-chips">Cell chips: '+chipText(p)+'</p>'+
        '<div class="score-phase-head"><span>Phase</span><span>Nutrients</span><span>Proteins</span><span>Organelles</span><span>Chromosomes</span></div>'+
        row('G1',[p.score.g1.nutrients,p.score.g1.proteins,p.score.g1.organelles,null],[3,3,3,0])+
        row('S',[null,null,null,p.score.s.chromosomes],[0,0,0,4])+
        row('G2',[p.score.g2.nutrients,p.score.g2.proteins,p.score.g2.organelles,null],[1,1,1,0])+'</div>';
    }).join('');
  }
  const minOf=function(o){return Math.min(o.nutrients,o.proteins,o.organelles);};
  function fullScorecard(s){return minOf(s.g1)>=3&&s.s.chromosomes>=4&&minOf(s.g2)>=1;}
  function checkpointState(p,key){
    const s=p.score;
    if(key===G1CP)return {title:'G1 Checkpoint',subtitle:'Pass with at least 3 nutrients, 3 proteins and 3 organelles. A 2 in any category: go back 3 spaces. A 1: go back 5 spaces. A 0: destroyed by p53, back to the START.',items:[['Nutrients',s.g1.nutrients,3],['Proteins',s.g1.proteins,3],['Organelles',s.g1.organelles,3]]};
    if(key===G2CP)return {title:'G2 Checkpoint',subtitle:'Pass with at least 4 DNA and at least 1 nutrient, 1 protein and 1 organelle. Fewer than 4 DNA: back to the first S space. A 0 in any category: destroyed by p53, back to the START.',items:[['DNA',s.s.chromosomes,4],['Nutrients',s.g2.nutrients,1],['Proteins',s.g2.proteins,1],['Organelles',s.g2.organelles,1]]};
    if(key===MCP)return {title:'M Checkpoint',subtitle:'Double-check the whole scorecard. If it is complete, the cell divides: take a new blue cell chip.',items:[['G1 · 3 of each',minOf(s.g1),3],['S · DNA',s.s.chromosomes,4],['G2 · 1 of each',minOf(s.g2),1]]};
    // A red chip is a cell that divided without passing every check: say so instead of a plain "divided".
    return {title:'FINISH',subtitle:p.lastChip==='red'?'The cell divided anyway: cancer cell in this game model (red chip). The next turn starts a new cell.':'The cell divided: a non-cancer cell (blue chip). The next turn starts a new cell.',items:[['Blue chips',p.blue,0],['Red chips',p.red,0]]};
  }
  function renderCheckpoint(){
    const g=state.game,p=g.playersState[g.active];if(!p)return;
    // Always the upcoming checkpoint. A piece standing on a checkpoint has already been checked there (a cell that
    // fails is moved off it), so the panel moves on to the next one instead of repeating the checkpoint just passed.
    const key=p.pos===FINISH?FINISH:nextCheckpoint(p.pos),st=checkpointState(p,key);
    $('#checkpoint-title').textContent=(key===FINISH?'':'Next checkpoint · ')+st.title;
    $('#checkpoint-subtitle').textContent=st.subtitle;
    $('#checkpoint-requirements').innerHTML=st.items.map(function(x){const met=x[2]>0&&x[1]>=x[2];return '<span class="requirement'+(met?' met':'')+'"><span>'+(x[2]?(met?'✓ ':'○ '):'')+x[0]+'</span><strong>'+x[1]+(x[2]?' / '+x[2]:'')+'</strong><span class="requirement-meter"><span style="width:'+(x[2]?Math.min(100,100*x[1]/x[2]):0)+'%"></span></span></span>';}).join('');
    $('#checkpoint-status').textContent=p.status==='done'?'Turns used up':key===FINISH?(p.lastChip==='red'?'Divided anyway · red chip':'Divided · blue chip'):key===G1CP?'G1 Checkpoint ahead':key===G2CP?'G2 Checkpoint ahead':'M Checkpoint ahead';
    $('#checkpoint-card').classList.toggle('checkpoint-ready',st.items.every(function(x){return !x[2]||x[1]>=x[2];}));
    $('#checkpoint-card').setAttribute('aria-label','Player '+p.id+' '+st.title+': '+st.subtitle);
  }
  function phaseLabel(p){
    const tile=track[p.pos];
    if(tile.type==='checkpoint')return tile.label;
    if(tile.type==='finish')return p.lastChip==='red'?'FINISH · divided anyway (red chip)':'FINISH · cell divided';
    if(tile.type==='start')return 'START';
    return tile.phase.toUpperCase()+(tile.phase==='g1'?' · Grow & gather':tile.phase==='s'?' · Collect chromosomes':tile.phase==='g2'?' · Grow & gather':' · Must roll '+tile.roll);
  }
  function nextNeed(p){const t=track[p.pos+1];return t&&t.phase==='m'&&t.type==='space'?t.roll:null;}
  function turnInstruction(p){
    if(p.status==='done')return 'This player has used all '+TURNS_PER_ROUND+' turns for the round.';
    if(p.bonusRolls>0)return 'Extra roll! Roll all four dice again without moving.';
    if(p.pos===FINISH)return 'New cell: move to the first G1 space and roll all four dice. Your scorecard starts empty.';
    if(p.pos===0)return 'Move to the first G1 space and roll all four dice.';
    const next=track[p.pos+1];
    if(next.type==='checkpoint')return 'Move onto the '+next.label+' and turn over the card: p53 checks your scorecard.';
    const need=nextNeed(p);
    if(need)return 'Roll all four dice. You must roll a '+need+' to move to M space '+need+'. If you do not, you do not move this turn.';
    return 'Move one space, then roll all four dice. The numbers you roll do not tell you how many spaces to move.';
  }
  function rollLabel(p){
    if(!p||p.status!=='playing')return 'Roll four dice';
    if(p.bonusRolls)return 'Take your extra roll';
    const next=track[p.pos+1];
    if(p.pos!==FINISH&&next&&next.type==='checkpoint')return 'Turn over the '+next.label+' card';
    return 'Roll four dice';
  }
  function collectSummary(tile,dice){
    if(tile.phase==='g1'||tile.phase==='g2'){
      const n=dice.filter(x=>x===1).length,pr=dice.filter(x=>x===2).length,o=dice.filter(x=>x===3).length;
      const out=[];if(n)out.push('Nutrients ×'+n);if(pr)out.push('Proteins ×'+pr);if(o)out.push('Organelles ×'+o);
      return out.length?'Checked off on Phase '+tile.phase.toUpperCase()+': '+out.join(', ')+'.':'No 1, 2 or 3 this roll, so nothing to check off in Phase '+tile.phase.toUpperCase()+'.';
    }
    if(tile.phase==='s'){const n=dice.filter(x=>x===4).length;return n?'Checked off on Phase S: Chromosomes ×'+n+'.':'No 4 this roll, so no chromosome to check off.';}
    return '';
  }
  function renderHistory(){
    // The list holds events (rolls, checkpoint cards, chance cards, lost turns), newest first; say exactly that.
    const logs=state.game.logs.slice().reverse(),n=logs.length;
    $('#history-count').textContent=plural(n,'event')+' · newest first'+(n>=120?' (latest 120 kept)':'');
    $('#turn-history').innerHTML=logs.map(function(line){return '<li>'+line+'</li>';}).join('');
  }
  function tally(players,turns){
    const r={blue:0,red:0,destroyed:0,sentBack:0,skipped:0,turns:turns,players:players.length};
    players.forEach(function(p){r.blue+=p.blue;r.red+=p.red;r.destroyed+=p.destroyed;r.sentBack+=p.sentBack;r.skipped+=p.skipped;});
    return r;
  }
  function pct(part,whole){return whole?Math.round(100*part/whole)+'%':'—';}
  // A round ends in one of two ways (a division never ends it: the player takes a chip and starts a new cell):
  // every player reaches the turn cap ('turns'), or the group presses "End this round now" ('early').
  function finishRound(endedBy){
    const g=state.game;
    g.complete=true;g.roundResults[g.round]=Object.assign(tally(g.playersState,g.turns),{endedBy:endedBy||'turns',playerTurns:g.playersState.map(function(p){return Math.min(TURNS_PER_ROUND,p.turnsUsed);}),
      perPlayer:g.playersState.map(function(p){return {id:p.id,blue:p.blue,red:p.red,destroyed:p.destroyed,sentBack:p.sentBack,skipped:p.skipped,turns:Math.min(TURNS_PER_ROUND,p.turnsUsed)};})});
    g.endNotice=true;   // show the Round complete / Game over dialog until it is dismissed (kept across a reload)
    const r=g.roundResults[g.round];
    setEvent(roundName(g.round)+' complete',roundEndReason(r)+' Cells made this round: '+plural(r.blue,'blue chip')+' (non-cancer cells) and '+plural(r.red,'red chip')+' (cancer cells in this game model).','🏁','Round complete');
  }
  // Why the round ended, with the real turn counts. Older saves have no endedBy: say only what is known.
  function roundEndReason(r){
    if(!r||r.legacy)return 'Round complete.';
    const turns=Array.isArray(r.playerTurns)?r.playerTurns:null;
    const counts=turns?(turns.length===1?'Turns used: '+turns[0]+' of '+TURNS_PER_ROUND+'.':'Turns used: '+turns.map(function(n,i){return 'Player '+(i+1)+' '+n;}).join(', ')+' (of '+TURNS_PER_ROUND+' each).'):'';
    if(r.endedBy==='early')return 'The round was ended early with “End this round now”. '+counts;
    if(r.endedBy==='turns')return (turns&&turns.length===1?'The round ended when the player used all ':'The round ended when every player had used all ')+TURNS_PER_ROUND+' turns (the turn limit). A division does not end the round.';
    return 'Round complete.';
  }
  function plural(n,word,many){return n+' '+(n===1?word:(many||word+'s'));}
  function finishIfAll(){
    const g=state.game;
    if(!g.playersState.length||g.complete||!g.playersState.every(function(p){return p.status==='done';}))return g.complete;
    finishRound();return true;
  }
  function roundEvidence(n){
    const g=state.game,saved=g.roundResults[n];
    if(saved)return Object.assign({inProgress:false},saved);
    if(g.round!==n||!g.playersState.length)return null;
    return Object.assign({inProgress:true},tally(g.playersState,g.turns));
  }
  function evidenceLine(n,r){
    if(r.legacy)return 'Round '+n+': played with an earlier version of the game rules (no chip counts).';
    const made=r.blue+r.red;
    return 'Round '+n+(r.inProgress?' (in progress)':' (complete)')+': '+plural(r.blue,'blue chip')+' (non-cancer cells), '+plural(r.red,'red chip')+' (cancer cells in this game model); '+pct(r.red,made)+' of the '+(made===1?'1 new cell was a cancer cell':made+' new cells were cancer cells')+'. Destroyed by p53: '+r.destroyed+'. Sent back by a checkpoint: '+r.sentBack+'. Checkpoints skipped: '+r.skipped+'.';
  }
  function resultsTable(rounds){
    const head='<thead><tr><th>Cells and events</th>'+rounds.map(function(x){return '<th>Round '+x[0]+'</th>';}).join('')+'</tr></thead>';
    const row=function(label,fn){return '<tr><th>'+label+'</th>'+rounds.map(function(x){return '<td>'+(x[1].legacy?'—':fn(x[1]))+'</td>';}).join('')+'</tr>';};
    return '<div class="table-wrap"><table class="data round-compare"><caption>Cell chips collected'+(rounds.length>1?': Round 1 and Round 2':'')+'</caption>'+head+'<tbody>'+
      row('Blue chips · non-cancer cells',r=>r.blue)+row('Red chips · cancer cells (game model)',r=>r.red)+
      row('Percent of new cells that were non-cancer',r=>pct(r.blue,r.blue+r.red))+row('Percent of new cells that were cancer cells',r=>pct(r.red,r.blue+r.red))+
      row('Cells destroyed by p53',r=>r.destroyed)+row('Times a checkpoint sent a cell back',r=>r.sentBack)+row('Checkpoints skipped (p53 not working)',r=>r.skipped)+
      row('Turns taken (including extra rolls)',r=>r.turns)+'</tbody></table></div>';
  }
  function renderSummary(){
    const g=state.game,el=$('#round-summary');
    if(!g.complete){el.hidden=true;el.innerHTML='';return;}
    const r=g.roundResults[g.round];
    let html='<span class="game-kicker">Round '+g.round+' results</span><h3>What cells did your group make?</h3><p class="round-end-reason">'+roundEndReason(r)+'</p>';
    const rounds=[[1,g.roundResults[1]],[2,g.roundResults[2]]].filter(function(x){return x[1];});
    html+=resultsTable(g.round===2?rounds:[[g.round,r]]);
    if(g.round===1)html+='<p>Every new cell in Round 1 is a blue chip: p53 checked each cell at every checkpoint. Fill in the Round 1 Making Sense table below, then play Round 2 with the same group.</p><button class="btn btn--primary" id="start-round2-from-summary" type="button">Play Round 2 · Cellular Chance cards</button>';
    else html+='<p>In this game model, a red chip is a cancer cell: a cell that divided when p53 was not working. These percentages come from the game’s cards and dice, not from real people. Cancer is not inevitable, and a game result is not a diagnosis.</p>';
    el.innerHTML=html;el.hidden=false;
  }
  // The effect label for a card notice; notices saved before labels existed are matched by their printed text.
  function cardLabel(n){
    if(!n)return '';if(n.label)return n.label;
    const c=chanceCards[n.card]||chanceCards.find(function(x){return x.title===n.title&&x.copy===n.copy;});
    return c?c.label:'';
  }
  function renderChanceReveal(){
    const g=state.game,notice=g.chanceNotice;
    let overlay=$('#chance-reveal');
    if(!overlay){
      overlay=document.createElement('div');overlay.id='chance-reveal';overlay.className='chance-reveal';overlay.hidden=true;
      overlay.innerHTML='<div class="chance-reveal-panel" role="dialog" aria-modal="true" aria-labelledby="chance-reveal-title" aria-describedby="chance-reveal-label chance-reveal-copy chance-reveal-effect"><span class="chance-reveal-kicker">ROUND 2 · CELLULAR CHANCE CARD</span><div class="chance-reveal-art" aria-hidden="true"><span id="chance-reveal-icon">🧬</span></div><p class="chance-reveal-player" id="chance-reveal-player"></p><h2 id="chance-reveal-title"></h2><p id="chance-reveal-label" class="chance-reveal-label"></p><p id="chance-reveal-copy" class="chance-reveal-copy"></p><p id="chance-reveal-effect" class="chance-reveal-effect"></p><p class="chance-reveal-note">A game-model event. Cancer is not inevitable, and nothing in this game is a diagnosis.</p><button class="btn btn--primary" type="button" id="chance-reveal-ack">Follow the card &amp; continue</button></div>';
      document.body.appendChild(overlay);
      $('#chance-reveal-ack').addEventListener('click',followCard);
      overlay.addEventListener('keydown',function(e){if(e.key==='Tab'){e.preventDefault();$('#chance-reveal-ack').focus();}});
    }
    overlay.hidden=!notice;
    overlay.classList.toggle('is-not-working',!!notice&&notice.title===NOT);
    if(!notice)return;
    $('#chance-reveal-icon').textContent=notice.icon||'🧬';
    $('#chance-reveal-player').textContent='Player '+notice.player+' drew a card';
    $('#chance-reveal-title').textContent=notice.title;
    $('#chance-reveal-label').textContent=cardLabel(notice);
    $('#chance-reveal-copy').textContent=notice.copy;
    $('#chance-reveal-effect').textContent=notice.effect||'';
    $('#chance-reveal-ack').focus();
  }
  // Checkpoint card dialog: the printed card (Teacher Reference: Game Cards 1), the player's scorecard checked against
  // it, and the line that applies. Like a chance card it is two steps: while it is open the board and scorecard show the
  // cell as it was when the card was turned over; "Follow the card & continue" (or Escape) then applies it once.
  const P53_SVG='<svg class="checkpoint-card-p53" viewBox="0 0 80 64" aria-hidden="true" focusable="false"><path d="M40 5c8-3 15 2 16 9 7-3 15 1 16 9 1 7-4 11-9 12 5 4 6 11 1 16-5 5-12 4-16 0-2 7-9 10-15 8-6-2-8-7-7-12-6 3-13 1-16-5-3-7 1-12 6-14-6-3-8-10-4-15 4-6 11-6 16-2 1-4 5-7 12-6z" fill="#8fd3f2" stroke="#2c7fb0" stroke-width="2.4" stroke-linejoin="round"/><path d="M30 17c5-4 13-3 16 2M53 22c5 1 9 5 8 10M26 42c3 3 9 4 13 2" fill="none" stroke="#c9ecfb" stroke-width="3" stroke-linecap="round" opacity=".9"/><text x="40" y="38" text-anchor="middle" font-size="14" font-weight="700" fill="#0b3550" font-family="Arial, sans-serif">p53</text></svg>';
  function checkpointRows(phase,s){
    const row=function(name,have,need,met){return {name:name,have:have,need:need,met:met};};
    const n=function(x,word){return x+' '+(x===1?word:word+'s');};
    if(phase==='g1')return [['Nutrients','nutrients'],['Proteins','proteins'],['Organelles','organelles']].map(function(c){const v=s.g1[c[1]];return row(c[0],String(v),'at least 3',v>=3);});
    if(phase==='g2')return [row('DNA (Phase S)',String(s.s.chromosomes),'at least 4',s.s.chromosomes>=4)].concat([['Nutrients','nutrients'],['Proteins','proteins'],['Organelles','organelles']].map(function(c){const v=s.g2[c[1]];return row(c[0]+' (Phase G2)',String(v),'at least 1',v>=1);}));
    const three=function(o){return n(o.nutrients,'nutrient')+', '+n(o.proteins,'protein')+', '+n(o.organelles,'organelle');};
    return [row('G1',three(s.g1),'at least 3 of each',minOf(s.g1)>=3),row('S',s.s.chromosomes+' DNA','at least 4 DNA',s.s.chromosomes>=4),row('G2',three(s.g2),'at least 1 of each',minOf(s.g2)>=1)];
  }
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function runsHtml(runs){return runs.map(function(r){return r[1]?'<strong>'+esc(r[0])+'</strong>':esc(r[0]);}).join('');}
  function renderCheckpointReveal(){
    const g=state.game,n=g.checkpointNotice;
    let overlay=$('#checkpoint-reveal');
    if(!overlay){
      overlay=document.createElement('div');overlay.id='checkpoint-reveal';overlay.className='chance-reveal checkpoint-reveal';overlay.hidden=true;
      overlay.innerHTML='<div class="checkpoint-card-panel" id="checkpoint-card-panel" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="checkpoint-reveal-title" aria-describedby="checkpoint-reveal-effect"><div class="checkpoint-card-band"><div class="checkpoint-card-heading"><span class="checkpoint-card-kicker" id="checkpoint-reveal-kicker"></span><h2 id="checkpoint-reveal-title"></h2><p class="checkpoint-card-player" id="checkpoint-reveal-player"></p></div>'+P53_SVG+'</div><div class="checkpoint-card-face"><p class="checkpoint-card-printed-label">Printed card</p><p class="checkpoint-card-intro" id="checkpoint-reveal-intro"></p><ul class="checkpoint-card-lines" id="checkpoint-reveal-lines"></ul></div><p class="checkpoint-card-line checkpoint-card-house" id="checkpoint-reveal-house" hidden></p><h3 class="checkpoint-card-subhead">Your scorecard</h3><ul class="checkpoint-card-checks" id="checkpoint-reveal-checks"></ul><p class="checkpoint-card-result" id="checkpoint-reveal-effect"></p><p class="checkpoint-card-why" id="checkpoint-reveal-why"></p><button class="btn btn--primary" type="button" id="checkpoint-reveal-ack">Follow the card &amp; continue</button></div>';
      document.body.appendChild(overlay);
      $('#checkpoint-reveal-ack').addEventListener('click',followCheckpoint);
      overlay.addEventListener('keydown',function(e){
        // Focus stays in the card: the button, plus the card itself when it is taller than the window (so it can be
        // scrolled with the arrow keys).
        if(e.key==='Tab'){e.preventDefault();const panel=$('#checkpoint-card-panel'),ack=$('#checkpoint-reveal-ack');
          if(document.activeElement===ack&&panel.scrollHeight>panel.clientHeight+1)panel.focus();else ack.focus();}
        // Escape closes the card the only way it can close: by following it. Stop it here so it does not also close
        // the enlarged board behind the card.
        if(e.key==='Escape'){e.preventDefault();e.stopPropagation();followCheckpoint();}
      });
    }
    overlay.hidden=!n;
    if(!n)return;
    const card=CHECKPOINT_CARDS[n.phase],p=g.playersState.find(function(x){return x.id===n.player;});
    if(!card||!p)return;
    $('#checkpoint-card-panel').className='checkpoint-card-panel cp-'+n.phase;
    $('#checkpoint-reveal-kicker').textContent='ROUND '+(n.round||g.round)+' · CHECKPOINT CARD';
    $('#checkpoint-reveal-title').textContent=card.title;
    $('#checkpoint-reveal-player').textContent='Player '+n.player+' turned over the card';
    $('#checkpoint-reveal-intro').textContent=card.intro;
    const chip='<span class="checkpoint-card-label">'+esc(n.label)+'</span>';
    const marker='<span class="checkpoint-card-marker">▶ Applies to you</span>';
    $('#checkpoint-reveal-lines').innerHTML=card.lines.map(function(line){
      const on=!!line.outcome&&line.outcome===n.outcome;
      return '<li class="checkpoint-card-line'+(on?' is-applies':'')+(line.req?' is-requirement':'')+'"'+(on?' data-applies="true"':'')+'>'+(on?marker+' ':'')+'<span class="checkpoint-card-text">'+runsHtml(line.runs)+'</span>'+(on?' '+chip:'')+'</li>';
    }).join('');
    // The M card prints no outcome for an incomplete scorecard: say this game's rule, marked as not printed.
    const house=n.phase==='m'&&n.outcome==='destroyed',houseEl=$('#checkpoint-reveal-house');
    houseEl.hidden=!house;houseEl.classList.toggle('is-applies',house);
    houseEl.innerHTML=house?marker+' <span class="checkpoint-card-text">Not printed on the card (this game’s rule): if the double-check finds anything missing, p53 does not let the cell divide. The cell is destroyed and goes back to the START.</span> '+chip:'';
    $('#checkpoint-reveal-checks').innerHTML=checkpointRows(n.phase,p.score).map(function(r){
      return '<li class="checkpoint-check '+(r.met?'is-met':'is-short')+'"><span class="checkpoint-check-glyph" aria-hidden="true">'+(r.met?'✓':'✗')+'</span><span class="checkpoint-check-name">'+esc(r.name)+'</span><span class="checkpoint-check-have">'+esc(r.have)+' <span class="checkpoint-check-need">(need '+esc(r.need)+')</span></span><span class="checkpoint-check-verdict">'+(r.met?'Met':'Not met')+'</span></li>';
    }).join('');
    $('#checkpoint-reveal-effect').innerHTML='<strong>Result: '+esc(n.label)+'.</strong> '+esc(n.effect||'');
    $('#checkpoint-reveal-why').innerHTML='<strong>Why this checkpoint matters:</strong> '+esc(card.why);
    $('#checkpoint-card-panel').scrollTop=0;$('#checkpoint-reveal-ack').focus({preventScroll:true});
  }
  function renderPhaseGuide(p){
    const guide=$('#phase-guide');if(!guide)return;
    const phaseOf=function(pos){const ph=track[pos]&&track[pos].phase;return ph==='start'?'g1':ph==='finish'?'done':ph;};
    const cur=p?phaseOf(p.pos):null,s=p&&p.score;
    const status={
      g1:s?{met:minOf(s.g1)>=3,text:s.g1.nutrients+'/3 · '+s.g1.proteins+'/3 · '+s.g1.organelles+'/3'}:null,
      s:s?{met:s.s.chromosomes>=4,text:s.s.chromosomes+'/4 DNA'}:null,
      g2:s?{met:minOf(s.g2)>=1,text:s.g2.nutrients+'/1 · '+s.g2.proteins+'/1 · '+s.g2.organelles+'/1'}:null,
      m:s?{met:false,text:cur==='m'&&track[p.pos].type==='space'?'on Must roll '+track[p.pos].roll:'roll 1–5 in order'}:null};
    guide.querySelectorAll('.phase-card').forEach(function(card){
      const ph=card.dataset.phase,st=status[ph],isCur=ph===cur;
      card.classList.toggle('is-current',isCur);card.classList.toggle('is-met',!!(st&&st.met));
      if(isCur)card.setAttribute('aria-current','step');else card.removeAttribute('aria-current');
      card.querySelector('.phase-status').textContent=!st?'':(st.met?'✓ met':(isCur?'Now · ':'')+st.text);
    });
  }
  function renderGame(){
    const g=state.game,setup=$('#game-setup'),panel=$('#game-panel');
    $('#cell-game').classList.toggle('game-running',!!g.round);
    setup.hidden=!!g.round;panel.hidden=false;panel.classList.toggle('is-pregame',!g.round);
    $('#start-round1').hidden=!!g.round;
    $('#start-round2').hidden=true;
    const legacy=$('#legacy-game-note');if(legacy)legacy.hidden=!(!g.round&&g.roundResults&&Object.keys(g.roundResults).length);
    if(!g.round){renderPhaseGuide(null);renderChanceReveal();renderCheckpointReveal();renderDice();renderBoard();renderSummary();fitGameViewport();return;}
    const p=g.playersState[g.active]||g.playersState.find(function(x){return x.status==='playing';})||g.playersState[0];
    if(!p)return;
    $('#round-label').textContent=roundName(g.round);
    $('#active-player-label').textContent=g.complete?'Round complete':'Player '+p.id+'’s turn';
    const cpWait=g.checkpointNotice&&CHECKPOINT_CARDS[g.checkpointNotice.phase]?'Follow the '+CHECKPOINT_CARDS[g.checkpointNotice.phase].title+' card to continue.':'';
    $('#turn-instruction').textContent=g.complete?roundEndReason(g.roundResults[g.round])+' See the cell chips below.':cpWait||turnInstruction(p);
    $('#phase-label').textContent=phaseLabel(p);
    $('#position-label').textContent=where(p.pos);
    $('#dice-prompt').textContent=g.complete?'Round complete.':cpWait||turnInstruction(p);
    $('#dice-result').textContent=g.lastRollSummary||'Four dice are ready. Roll when it is your turn.';
    $('#roll-dice').textContent=rollLabel(p);
    $('#roll-dice').disabled=!!g.rolling||g.complete;
    $('#roll-dice').hidden=g.complete;
    $('#turn-event').classList.toggle('is-card',g.event.kicker==='Cellular Chance card');
    $('#turn-event').classList.toggle('is-red',/red cell chip|RED cell chip|cancer cell/i.test(g.event.title));
    $('#event-icon').textContent=g.event.icon||'🧬';
    $('#event-kicker').textContent=g.event.kicker||'Cell cycle';
    $('#event-title').textContent=g.event.title||'Your turn';
    const label=g.event.kicker==='Cellular Chance card'?(g.event.label||cardLabel({title:g.event.title,copy:(g.event.copy||'').split(' Follow the card')[0]})):(g.event.label||'');
    $('#event-label').textContent=label;$('#event-label').hidden=!label;
    const notices=(g.event.notices||[]).join(' ');$('#event-notice').textContent=notices;$('#event-notice').hidden=!notices;
    $('#event-copy').textContent=g.event.copy||'Move one space and roll four dice.';
    renderDice();renderBoard();renderScorecards();renderCheckpoint();renderPhaseGuide(p);renderHistory();renderSummary();renderChanceReveal();renderCheckpointReveal();renderRoundEnd();
    $('#restart-round').hidden=!g.round;
    $('#reset-game').hidden=!g.round;
    $('#end-round').hidden=!g.round||g.complete;
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
  // The one live region for the game: each turn's result and whose turn is next.
  function announce(text){const el=$('#game-announcer');if(el)el.textContent=text;}
  function turnAnnouncement(){
    const g=state.game,notices=(g.event&&g.event.notices||[]).join(' ');if(g.complete)return (notices?notices+' ':'')+roundEndAnnouncement();
    const next=g.playersState[g.active];
    return (notices?notices+' ':'')+(next&&next.status==='playing'?'Player '+next.id+'’s turn'+(next.bonusRolls?' (extra roll)':'')+'.':'');
  }
  function startRound(round,mode,players){
    const old=state.game,selectedMode=mode||($('input[name="game-mode"]:checked')||{}).value||old.mode||'solo';
    const count=Number(players|| (selectedMode==='group'?$('#group-size').value:1))||1;
    const results=round===2&&old.roundResults&&old.roundResults[1]?{1:old.roundResults[1]}:{};
    state.game={schema:3,mode:selectedMode,players:count,round:round,active:0,turns:0,complete:false,playersState:Array.from({length:count},function(_,i){return makePlayer(i);}),chanceDeck:round===2?shuffledDeck():[],logs:[],lastDice:[],lastRollSummary:'',roundResults:results,chanceNotice:null,checkpointNotice:null,event:{title:'Round '+round+' begins',copy:round===1?'Each player has '+TURNS_PER_ROUND+' turns. Every time your cell divides you collect a new blue cell chip and start a new cell.':'Same board and checkpoint cards. Every time you land on a light-blue square, draw a Cellular Chance card and follow it.',icon:'🎲',kicker:roundName(round)}};
    save();renderGame();announce(state.game.event.title+'. '+turnAnnouncement());$('#roll-dice').focus({preventScroll:true});
  }
  function newCell(p){p.score=zeroScore();p.lastChip=null;}
  function destroy(p,why){p.pos=0;newCell(p);p.destroyed++;addLog('Player '+p.id+': '+why);}
  function collectChip(p,color,how){
    p.pos=FINISH;p.lastChip=color;
    if(color==='red'){p.red++;setEvent('Cancer cell: take a RED cell chip',how+' In this game model the new cell is a cancer cell (red chip). Your next turn starts a new cell.','🔴','Cell divided');}
    else{p.blue++;setEvent('YOU SUCCESSFULLY DIVIDED! Take a new blue cell chip!',how+' Your next turn starts a new cell on the first G1 space.','🔵','Cell divided');}
    addLog('Player '+p.id+' collected a '+(color==='red'?'RED (cancer cell)':'blue (non-cancer)')+' cell chip.');
  }
  // A cell that reaches FINISH without the M Checkpoint check divides anyway. It becomes a cancer cell (red chip) if it
  // lacks anything on its scorecard: the source's "cancer cells form when a cell passes checkpoints without the requirements".
  function arriveUnchecked(p){
    if(fullScorecard(p.score))collectChip(p,'blue','The cell skipped the M Checkpoint, but its scorecard was complete.');
    else collectChip(p,'red','The cell skipped the M Checkpoint with requirements missing from its scorecard.');
  }
  // Which printed line of the checkpoint card applies to this scorecard. It mirrors checkCheckpoint(), which stays the
  // rule; tests check that the two agree for every case.
  function checkpointOutcome(p,pos){
    const s=p.score;
    if(pos===G1CP){const m=minOf(s.g1);return m===0?'destroyed':m===1?'back5':m===2?'back3':'pass';}
    if(pos===G2CP)return Math.min(minOf(s.g2),s.s.chromosomes)===0?'destroyed':s.s.chromosomes<4?'backS':'pass';
    return fullScorecard(s)?'divided':'destroyed';
  }
  function checkCheckpoint(p){
    const s=p.score,pos=p.pos;
    if(pos===G1CP){
      const m=minOf(s.g1);
      if(m===0){destroy(p,'destroyed by p53 at the G1 Checkpoint.');setEvent('G1 Checkpoint: YOU HAVE BEEN DESTROYED by p53','A 0 in a category. p53 destroyed the cell. Go back to the START with a new scorecard.','🛑','Checkpoint card');return;}
      if(m===1){p.pos=G1CP-5;p.sentBack++;addLog('Player '+p.id+' went back 5 spaces from the G1 Checkpoint.');setEvent('G1 Checkpoint: GO BACK 5 SPACES','A 1 in a category. p53 sends the cell back to keep gathering. Your scorecard keeps its check marks.','↩️','Checkpoint card');return;}
      if(m===2){p.pos=G1CP-3;p.sentBack++;addLog('Player '+p.id+' went back 3 spaces from the G1 Checkpoint.');setEvent('G1 Checkpoint: GO BACK 3 SPACES','A 2 in a category. p53 sends the cell back to keep gathering. Your scorecard keeps its check marks.','↩️','Checkpoint card');return;}
      addLog('Player '+p.id+' passed the G1 Checkpoint.');setEvent('G1 Checkpoint: YOU PASS THE CHECKPOINT','At least 3 nutrients, 3 proteins and 3 organelles. p53 lets the cell move on to Phase S.','✅','Checkpoint passed');return;
    }
    if(pos===G2CP){
      if(Math.min(minOf(s.g2),s.s.chromosomes)===0){destroy(p,'destroyed by p53 at the G2 Checkpoint.');setEvent('G2 Checkpoint: YOU HAVE BEEN DESTROYED by p53','A 0 in a category. p53 destroyed the cell. Go back to the START with a new scorecard.','🛑','Checkpoint card');return;}
      if(s.s.chromosomes<4){p.pos=S1;p.sentBack++;addLog('Player '+p.id+' went back to the first S space (fewer than 4 DNA).');setEvent('G2 Checkpoint: GO BACK TO THE FIRST SPACE','Fewer than 4 DNA. p53 sends the cell back to the first S space to finish its chromosomes. Your scorecard keeps its check marks.','↩️','Checkpoint card');return;}
      addLog('Player '+p.id+' passed the G2 Checkpoint.');setEvent('G2 Checkpoint: YOU PASS THE CHECKPOINT','At least 4 DNA and 1 nutrient, 1 protein and 1 organelle. To move on to M you must roll a 1.','✅','Checkpoint passed');return;
    }
    if(pos===MCP){
      if(fullScorecard(s)){addLog('Player '+p.id+' passed the M Checkpoint.');collectChip(p,'blue','M Checkpoint: the double-checked scorecard is complete.');return;}
      // The M card lists what the cell must have but not what happens otherwise; with p53 checking, the cell does not divide.
      destroy(p,'destroyed by p53 at the M Checkpoint (scorecard incomplete).');
      setEvent('M Checkpoint: destroyed by p53','The double-check found requirements missing from the scorecard (a checkpoint was skipped earlier). p53 is checking here, so the cell does not divide. Go back to the START with a new scorecard.','🛑','Checkpoint card');
    }
  }
  // Turning over a checkpoint card on a turn (the piece moves onto the checkpoint). The result is worked out on a copy of
  // the game so the card's result line matches what "Follow the card & continue" then does.
  function openCheckpoint(p){
    const g=state.game,pos=p.pos,phase=track[pos].phase,card=CHECKPOINT_CARDS[phase],outcome=checkpointOutcome(p,pos);
    const copy=JSON.parse(JSON.stringify(g));let effect='';
    try{state.game=copy;const q=copy.playersState.find(function(x){return x.id===p.id;});checkCheckpoint(q);
      effect=copy.event.copy+(q.pos!==pos&&q.pos!==0&&q.pos!==FINISH?' Your piece moves to '+where(q.pos)+'.':'');}
    finally{state.game=g;}
    g.checkpointNotice={pending:true,player:p.id,pos:pos,phase:phase,outcome:outcome,label:CHECKPOINT_LABELS[outcome],effect:effect,round:g.round};
    setEvent(card.title+' card','p53 checks the scorecard. Follow the card to continue.','🔍','Checkpoint card');
  }
  function moveTo(p,dest){
    // Move a card's distance. Checkpoints jumped over are not checked (p53 is not working); a checkpoint landed on is.
    const passed=CHECKPOINTS.filter(function(n){return n>p.pos&&n<dest;}).length;
    p.skipped+=passed;p.pos=Math.min(FINISH,dest);
    if(p.pos===FINISH)arriveUnchecked(p);
    else if(CHECKPOINTS.includes(p.pos))checkCheckpoint(p);
    return passed;
  }
  // Drawing a card and following it are two steps. While the card dialog is open the board, scorecard and turn
  // counter show the cell as it was when the card was drawn; "Follow the card & continue" then applies the effect
  // and finishes the turn. The dialog's effect line is worked out on a copy of the game, so it matches what happens.
  function drawChance(p){
    const g=state.game;
    if(!g.chanceDeck.length)g.chanceDeck=shuffledDeck();
    const idx=g.chanceDeck.shift();g.chanceDeck.push(idx);   // the card goes back on the bottom of the stack
    const card=chanceCards[idx];
    addLog('Player '+p.id+' drew a Cellular Chance card · '+card.label+': “'+card.title+' '+card.copy+'”');
    setEvent(card.title,card.copy+' Follow the card to continue.',card.icon,'Cellular Chance card');state.game.event.label=card.label;
    const real=state.game,copy=JSON.parse(JSON.stringify(real));let effect='';
    try{state.game=copy;effect=applyChance(copy.playersState.find(function(x){return x.id===p.id;}),card);}finally{state.game=real;}
    g.chanceNotice={pending:true,card:idx,player:p.id,title:card.title,label:card.label,copy:card.copy,effect:effect,icon:card.icon};
  }
  function applyChance(p,card){
    const g=state.game;
    let effect='';
    setEvent(card.title,card.copy,card.icon,'Cellular Chance card');
    if(card.id==='extra'){p.bonusRolls++;effect='Roll all four dice again without moving.';}
    else if(card.id==='destroy'){destroy(p,'destroyed by p53 (Cellular Chance card).');effect='The cell is destroyed. Your piece goes back to the START with a new scorecard.';}
    else if(card.id==='dna'){p.score.s.chromosomes=BOX.s;effect='All 4 Chromosomes boxes in Phase S are checked off.';}
    else if(card.id==='lose'){p.skipTurns++;effect='Your next turn is skipped.';}
    else if(card.id==='ahead3'){const n=moveTo(p,p.pos+3);effect='Now on '+where(p.pos)+'.'+(n?' A checkpoint was skipped without a check.':'');}
    else if(card.id==='skipNext'){const cp=nextCheckpoint(p.pos);p.skipped++;p.pos=Math.min(FINISH,cp+1);if(p.pos===FINISH)arriveUnchecked(p);effect=(cp===MCP?'The M Checkpoint was skipped: the cell went straight to FINISH.':'The '+track[cp].label+' was skipped without a check. Now on '+where(p.pos)+'.');}
    else if(card.id==='skipTwo'){
      const ahead=CHECKPOINTS.filter(function(n){return n>p.pos;}),dest=ahead.length>=2?ahead[1]:ahead[0];
      p.skipped+=ahead.length>=2?1:0;p.pos=dest;
      effect=(ahead.length>=2?'Skipped the '+track[ahead[0]].label+'. ':'Only one checkpoint was left. ')+'Now on the '+track[dest].label+', checking the scorecard.';
      const cardEvent=state.game.event;checkCheckpoint(p);
      effect+=' '+state.game.event.title+'.';state.game.event=cardEvent;
    }
    else if(card.id==='finish'){collectChip(p,'red','p53 is not working: the cell moved directly to FINISH.');effect='Player '+p.id+' collects a RED cell chip: a cancer cell in this game model. The next turn starts a new cell.';state.game.event={title:card.title,copy:card.copy,icon:card.icon,kicker:'Cellular Chance card'};}
    if(card.id==='ahead3'||card.id==='skipNext'){/* moveTo/arriveUnchecked may have replaced the event: keep the card on top */
      const e=state.game.event;if(e.kicker!=='Cellular Chance card'){effect+=' '+e.title+'.';}
      state.game.event={title:card.title,copy:card.copy,icon:card.icon,kicker:'Cellular Chance card'};
    }
    if(card.id==='destroy')state.game.event={title:card.title,copy:card.copy,icon:card.icon,kicker:'Cellular Chance card'};
    state.game.event.copy=card.copy+' '+effect;state.game.event.label=card.label;
    addLog('Player '+p.id+' followed the card · '+card.label+': '+effect);
    return effect;
  }
  function scoreRoll(p,dice){
    const tile=track[p.pos];if(tile.type!=='space')return;
    if(tile.phase==='g1'||tile.phase==='g2'){const b=p.score[tile.phase];dice.forEach(function(v){if(v===1)b.nutrients=Math.min(BOX[tile.phase],b.nutrients+1);if(v===2)b.proteins=Math.min(BOX[tile.phase],b.proteins+1);if(v===3)b.organelles=Math.min(BOX[tile.phase],b.organelles+1);});}
    else if(tile.phase==='s')dice.forEach(function(v){if(v===4)p.score.s.chromosomes=Math.min(BOX.s,p.score.s.chromosomes+1);});
  }
  function useTurn(p){p.turnsUsed++;if(p.turnsUsed>=TURNS_PER_ROUND&&!p.bonusRolls){p.status='done';p.skipTurns=0;}}
  function activeNext(index){
    const g=state.game,n=g.playersState.length;
    for(let guard=0;guard<n*TURNS_PER_ROUND+n;guard++){
      const i=(index+1+guard)%n,p=g.playersState[i];
      if(p.status!=='playing')continue;
      // A lost turn ("p53 will not let you pass. You lose a turn!") is used up here: say so in the history, the turn
      // event and the announcer, so the turn counter's jump is explained.
      if(p.skipTurns>0){p.skipTurns--;useTurn(p);const msg='Player '+p.id+' loses this turn (chance card).';addLog(msg);(g.event.notices=g.event.notices||[]).push(msg);continue;}
      g.active=i;return;
    }
    finishIfAll();
  }
  const rand=function(){return 1+Math.floor(Math.random()*6);};
  function playTurn(p){
    // Returns {dice, text}: what this turn did. The caller handles chance cards, turn order and saving.
    const g=state.game;
    if(p.bonusRolls>0){
      p.bonusRolls--;
      const dice=[rand(),rand(),rand(),rand()],need=nextNeed(p),tile=track[p.pos];
      if(need){if(dice.includes(need)){p.pos++;return {dice,text:'Extra roll: rolled the '+need+' needed. Move to M space '+need+'.',moved:true};}return {dice,text:'Extra roll: no '+need+' this time.'};}
      if(tile.type==='space'){scoreRoll(p,dice);return {dice,text:'Extra roll. '+collectSummary(tile,dice)};}
      return {dice,text:'Extra roll: nothing to collect on this space.'};
    }
    useTurn(p);
    if(p.pos===FINISH){newCell(p);p.pos=0;}
    const next=track[p.pos+1];
    if(next.type==='checkpoint'){p.pos++;openCheckpoint(p);return {dice:[],text:'Turned over the '+next.label+' card.',checkpoint:true};}
    const dice=[rand(),rand(),rand(),rand()];
    if(next.type==='space'&&next.phase==='m'){
      if(!dice.includes(next.roll))return {dice,text:'You must roll a '+next.roll+' to move to M space '+next.roll+'. No '+next.roll+' this turn, so the cell does not move.'};
      p.pos++;return {dice,text:'Rolled the '+next.roll+' needed. The cell moves to M space '+next.roll+'.',moved:true};
    }
    p.pos++;scoreRoll(p,dice);
    return {dice,text:'Moved to '+where(p.pos)+'. '+collectSummary(next,dice),moved:true};
  }
  // The end of a turn, once any card drawn on it has been followed: extra rolls, the turn limit and the next player.
  function endTurn(p){
    const g=state.game;
    if(p.status==='done'&&p.bonusRolls)p.status='playing';
    if(p.turnsUsed>=TURNS_PER_ROUND&&!p.bonusRolls)p.status='done';
    if(!(p.bonusRolls>0&&p.status==='playing'))activeNext(g.active);
    finishIfAll();
  }
  function afterTurnFocus(){
    const g=state.game;
    if(g.chanceNotice)$('#chance-reveal-ack').focus();else if(g.checkpointNotice)$('#checkpoint-reveal-ack').focus({preventScroll:true});else if(g.complete&&$('#round-end-dialog').open)$('#round-end-title').focus();else if(g.complete)$('#round-summary').focus();else $('#roll-dice').focus({preventScroll:true});
  }
  function rollDice(){
    const g=state.game,p=g.playersState[g.active];
    if(!p||p.status!=='playing'||g.complete||g.rolling||g.chanceNotice||g.checkpointNotice)return;
    const checkpointTurn=!p.bonusRolls&&p.pos!==FINISH&&track[p.pos+1].type==='checkpoint';
    g.rolling=!checkpointTurn;renderDice();$('#roll-dice').disabled=true;
    window.setTimeout(function(){
      if(state.game!==g)return;
      g.rolling=false;g.turns++;
      const before=p.pos,result=playTurn(p);
      g.lastDice=result.dice;
      if(!result.checkpoint)setEvent(result.dice.length?'Rolled '+result.dice.join(', '):'Turn',result.text,'🎲','Four-dice roll');
      if(!result.checkpoint)addLog('Player '+p.id+(result.dice.length?' rolled ['+result.dice.join(', ')+']':'')+': '+result.text);
      if(result.moved&&g.round===2&&p.pos!==before&&track[p.pos].chance)drawChance(p);
      const dicePart=result.dice.length?'Dice ['+result.dice.join(', ')+']. ':'';
      if(g.chanceNotice){
        g.lastRollSummary=dicePart+result.text+' Then: Cellular Chance card: '+g.chanceNotice.title+' '+g.chanceNotice.copy;
        g.chanceNotice.rollText=dicePart+result.text;
      }else if(g.checkpointNotice){
        g.lastRollSummary=result.text;   // the card's result is said once, when it is followed
      }else{
        g.lastRollSummary=dicePart+(g.event.kicker==='Four-dice roll'?result.text:g.event.title+'. '+g.event.copy);
        endTurn(p);
      }
      save();renderGame();renderAnalysisReference();
      announce('Player '+p.id+(result.dice.length?' rolled '+result.dice.join(', '):'')+'. '+g.lastRollSummary.replace(/^Dice \[[^\]]*\]\. /,'')+(g.chanceNotice||g.checkpointNotice?'':' '+turnAnnouncement()));
      afterTurnFocus();
    },checkpointTurn?120:480);
  }
  // "Follow the card & continue": apply the card drawn this turn, then finish the turn. A notice saved by an older
  // version (already applied when drawn) is simply closed.
  function followCard(){
    const g=state.game,n=g.chanceNotice;
    g.chanceNotice=null;
    let said='';
    if(n&&n.pending&&chanceCards[n.card]){
      const p=g.playersState.find(function(x){return x.id===n.player;});
      if(p){
        const card=chanceCards[n.card],effect=applyChance(p,card);
        g.lastRollSummary=(n.rollText?n.rollText+' Then: ':'')+card.title+' '+card.copy+' '+effect;
        endTurn(p);
        said='Player '+p.id+' followed the card: '+card.title+' '+effect;
      }
    }
    save();renderGame();renderAnalysisReference();
    if(said)announce(said+' '+turnAnnouncement());
    afterTurnFocus();
  }
  // "Follow the card & continue" on a checkpoint card: apply it (once: the notice is cleared before it is applied and
  // saved with it), then finish the turn. The result goes to the turn event, the history and the announcer as before.
  function followCheckpoint(){
    const g=state.game,n=g.checkpointNotice;
    if(!n)return;
    g.checkpointNotice=null;
    let said='';
    const p=n.pending&&g.playersState.find(function(x){return x.id===n.player;});
    if(p){
      if(p.pos===n.pos){checkCheckpoint(p);g.event.label=n.label;}
      g.lastRollSummary=g.event.title+'. '+g.event.copy;
      endTurn(p);
      said='Player '+p.id+'. '+g.lastRollSummary;
    }
    save();renderGame();renderAnalysisReference();
    if(said)announce(said+' '+turnAnnouncement());
    afterTurnFocus();
  }
  // Round complete (Round 1) / Game over (Round 2): a modal dialog with the reason the round ended, each player's
  // results (no winner: the OpenSciEd game has none) and one clear next step. Escape or Close dismisses it.
  const STAT_ROWS=[['blue','Blue chips · non-cancer cells'],['red','Red chips · cancer cells (game model)'],['destroyed','Cells destroyed by p53'],['sentBack','Times sent back by a checkpoint'],['skipped','Checkpoints skipped'],['turns','Turns used']];
  function playerRows(r){
    if(!r||r.legacy)return null;
    if(Array.isArray(r.perPlayer))return r.perPlayer;
    return r.players===1?[{id:1,blue:r.blue,red:r.red,destroyed:r.destroyed,sentBack:r.sentBack,skipped:r.skipped,turns:Array.isArray(r.playerTurns)?r.playerTurns[0]:null}]:null;
  }
  const cellOf=function(v){return v===null||v===undefined?'—':String(v);};
  function roundEndAnnouncement(){
    const g=state.game,r=g.roundResults[g.round];
    const who=(playerRows(r)||[]).map(function(x){return 'Player '+x.id+': '+plural(x.blue,'blue chip')+', '+plural(x.red,'red chip')+'.';}).join(' ');
    if(g.round===1)return 'Round 1 complete. '+roundEndReason(r)+' '+who+' Next step: Start Round 2.';
    const totals=[1,2].map(function(n){const x=g.roundResults[n];if(!x||x.legacy)return '';const made=x.blue+x.red;return 'Round '+n+': '+pct(x.blue,made)+' non-cancer cells, '+pct(x.red,made)+' cancer cells.';}).join(' ');
    return 'Game over. '+roundEndReason(r)+' '+who+' '+totals+' Next steps: the Making Sense questions, or set up a new game.';
  }
  function roundEndHtml(){
    const g=state.game,r=g.roundResults[g.round],over=g.round===2,esc=function(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
    let html='<span class="game-kicker">'+(over?'Round 1 and Round 2 played':roundName(1))+'</span><h2 id="round-end-title" tabindex="-1">'+(over?'Game over':'Round 1 complete')+'</h2>';
    html+='<p class="round-end-reason">'+esc(roundEndReason(r))+'</p>';
    if(!over){
      const rows=playerRows(r)||[];
      html+='<div class="table-wrap"><table class="data round-end-table"><caption>Round 1 results for each player</caption><thead><tr><th scope="col">Result</th>'+rows.map(function(x){return '<th scope="col">Player '+x.id+'</th>';}).join('')+(rows.length>1?'<th scope="col">All players</th>':'')+'</tr></thead><tbody>'+
        STAT_ROWS.map(function(s){return '<tr><th scope="row">'+s[1]+'</th>'+rows.map(function(x){return '<td>'+cellOf(x[s[0]])+'</td>';}).join('')+(rows.length>1?'<td>'+(s[0]==='turns'?rows.reduce(function(a,x){return a+(x.turns||0);},0):r[s[0]])+'</td>':'')+'</tr>';}).join('')+'</tbody></table></div>';
      html+='<p class="small">There is no winner: compare what happened to each cell. In Round 2, Cellular Chance cards can stop p53 from working. Play it with the same group.</p>';
      html+='<div class="row round-end-actions"><button class="btn btn--primary" type="button" id="round-end-next">Start Round 2</button><button class="btn" type="button" id="round-end-close">Close</button></div>';
      return html;
    }
    const r1=g.roundResults[1],a=playerRows(r1)||[],b=playerRows(r)||[];
    const ids=b.map(function(x){return x.id;}).concat(a.map(function(x){return x.id;}).filter(function(id){return !b.some(function(x){return x.id===id;});}));
    html+='<p class="small">Round 1: '+esc(r1?roundEndReason(r1):'not recorded.')+'</p>';
    html+='<div class="round-end-players">'+ids.map(function(id){
      const x=a.find(function(q){return q.id===id;})||{},y=b.find(function(q){return q.id===id;})||{};
      return '<div class="table-wrap"><table class="data round-end-table"><caption>Player '+id+'</caption><thead><tr><th scope="col">Result</th><th scope="col">Round 1</th><th scope="col">Round 2</th></tr></thead><tbody>'+
        STAT_ROWS.map(function(s){return '<tr><th scope="row">'+s[1]+'</th><td>'+cellOf(x[s[0]])+'</td><td>'+cellOf(y[s[0]])+'</td></tr>';}).join('')+'</tbody></table></div>';
    }).join('')+'</div>';
    const col=function(x,fn){return '<td>'+(!x||x.legacy?'—':fn(x))+'</td>';};
    html+='<div class="table-wrap"><table class="data round-end-table round-end-totals"><caption>All players together (class-style totals)</caption><thead><tr><th scope="col">Cells</th><th scope="col">Round 1</th><th scope="col">Round 2</th></tr></thead><tbody>'+
      [['New cells made',function(x){return x.blue+x.red;}],['Blue chips · non-cancer cells',function(x){return x.blue;}],['Red chips · cancer cells (game model)',function(x){return x.red;}],['Percent non-cancer cells',function(x){return pct(x.blue,x.blue+x.red);}],['Percent cancer cells',function(x){return pct(x.red,x.blue+x.red);}]]
        .map(function(row){return '<tr><th scope="row">'+row[0]+'</th>'+col(r1,row[1])+col(r,row[1])+'</tr>';}).join('')+'</tbody></table></div>';
    html+='<p class="small">There is no winner. These percentages come from the game’s cards and dice, not from real people: cancer is not inevitable, and a game result is not a diagnosis.</p>';
    html+='<div class="row round-end-actions"><button class="btn btn--primary" type="button" id="round-end-next">Answer the Making Sense questions</button><button class="btn" type="button" id="round-end-new">Set up a new game</button><button class="btn" type="button" id="round-end-close">Close</button></div>';
    return html;
  }
  function renderRoundEnd(){
    const dialog=$('#round-end-dialog');if(!dialog)return;
    const g=state.game;
    if(!(g.round&&g.complete&&g.endNotice)){if(dialog.open)dialog.close();return;}
    if(dialog.open&&dialog.dataset.round===String(g.round))return;
    dialog.dataset.round=String(g.round);
    $('#round-end-body').innerHTML=roundEndHtml();
    if(!dialog.open)dialog.showModal();
    $('#round-end-title').focus();
  }
  function closeRoundEnd(then){
    const dialog=$('#round-end-dialog');
    state.game.endNotice=false;save();
    if(dialog.open)dialog.close();
    if(then)then();else $('#round-summary').focus();
  }
  function endRoundNow(){
    confirmGameReset('End this round now?','Every player stops here, and the cell chips collected so far are recorded as this round’s results. Use this when your class timer runs out.',function(){
      const g=state.game;g.playersState.forEach(function(p){p.status='done';p.bonusRolls=0;p.skipTurns=0;});g.chanceNotice=null;g.checkpointNotice=null;finishRound('early');save();renderGame();renderAnalysisReference();announce(turnAnnouncement());afterTurnFocus();
    },'End round');
  }
  function resetRound(){
    confirmGameReset('Restart this round?', 'This clears the current round’s board and scorecards. Your growth trials and written answers stay saved.',function(){startRound(state.game.round,state.game.mode,state.game.players);renderAnalysisReference();});
  }
  function resetGame(){
    confirmGameReset('Set up a new game?', 'This clears both game rounds and returns to player setup. Your growth trials and written answers stay saved.',function(){state.game=blankGame();save();renderGame();renderAnalysisReference();$('#start-round1').focus();});
  }
  function confirmGameReset(title,copy,action,label){
    const dialog=$('#game-reset-dialog');
    $('#game-reset-title').textContent=title;$('#game-reset-description').textContent=copy;$('#confirm-game-reset').textContent=label||'Confirm reset';
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
    fillTrialSelect();
    $('#replay-growth').disabled=!groups.length;
    renderCancerJump();
    renderComparison();renderAnalysisReference();renderReport();
  }
  // The Trial picker beside "Replay a recorded set": all trials of the set in turn, or one trial on its own.
  function fillTrialSelect(){
    const el=$('#replay-trial');if(!el)return;
    const g=trialGroups()[Number($('#replay-set').value)],current=el.value;
    el.innerHTML='';
    const add=function(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;el.appendChild(o);};
    if(!g){add('all','All three trials');el.disabled=true;return;}
    add('all',g.trials.length===1?'The trial':'All '+(g.trials.length===3?'three':g.trials.length)+' trials');
    g.trials.forEach(function(t,k){add(String(k),'Trial '+(k+1)+' · '+plural(t.divisions,'division')+(t.modelVersion===2&&t.cancerCount?' · '+plural(t.cancerCount,'cancer-state cell'):''));});
    el.disabled=false;el.value=Array.from(el.options).some(function(o){return o.value===current;})?current:'all';
  }
  // The first cancer-state (magenta) cell recorded in any trial, newest set first: where and when it appeared.
  function firstCancerCell(){
    const groups=trialGroups();
    for(let gi=groups.length-1;gi>=0;gi--){
      const g=groups[gi];
      for(let k=0;k<g.trials.length;k++){
        const t=g.trials[k];if(t.modelVersion!==2||!t.cancerCount||!Array.isArray(t.timeline))continue;
        const row=t.timeline.find(function(r){return r.newCancerCells&&r.newCancerCells.length;});
        if(row)return {group:g,trial:k,year:row.year,unit:row.newCancerCells[0]};
      }
    }
    return null;
  }
  function renderCancerJump(){
    const btn=$('#jump-cancer');if(!btn)return;
    const hit=firstCancerCell();btn.hidden=!hit;
    if(hit)btn.textContent='Jump to a trial with a cancer-state cell (Set '+hit.group.index+', trial '+(hit.trial+1)+', age '+hit.year+')';
  }
  function jumpToCancer(){
    const hit=firstCancerCell();if(!hit||!window.GrowthModelScene)return;
    $('#replay-set').value=hit.group.id;fillTrialSelect();$('#replay-trial').value=String(hit.trial);
    window.GrowthModelScene.inspectAt(hit.group.trials,hit.trial,hit.year,hit.unit);
    $('#growth-status').textContent='Set '+hit.group.index+', trial '+(hit.trial+1)+' at age '+hit.year+': the first cancer-state cell (unit '+(hit.unit+1)+') appeared here and is selected in the inspector. Use the arrow keys or the recorded-age slider to look before and after.';
    $('#growth-scene').focus({preventScroll:true});
    $('#growth-stage').scrollIntoView({block:'nearest'});
  }
  let analysisPage=0;
  function showAnalysisPage(index){
    analysisPage=Math.max(0,Math.min(3,index));
    $$('#analyze [data-analysis-page]').forEach(el=>{el.hidden=Number(el.dataset.analysisPage)!==analysisPage;});
    $('#analysis-page-status').textContent='Part '+(analysisPage+1)+' of 4 · '+['Compare data','Look for patterns','Explain mechanisms','Revise your model'][analysisPage];
    for(const id of ['analysis-prev','analysis-prev-bottom'])$('#'+id).disabled=analysisPage===0;
    for(const id of ['analysis-next','analysis-next-bottom']){$('#'+id).disabled=analysisPage===3;}
  }
  /* "Your data" beside each Analyze question: the exact recorded numbers that question asks students to use. */
  function renderQuestionEvidence(){
    const groups=trialGroups(),a=groups[Number(($('#compare-a')||{}).value)],b=groups[Number(($('#compare-b')||{}).value)];
    const settings=g=>'age '+g.age+' · '+labelBody(g.size)+' body · '+labelTissue(g.tissue);
    const counts=g=>g.trials.map(t=>t.divisions).join(', ')+' divisions (mean '+g.mean.toFixed(1)+')';
    const rounds=[1,2].map(n=>{const r=roundEvidence(n);if(!r)return 'Round '+n+': not played yet.';
      return 'Round '+n+(r.inProgress?' (in progress)':'')+': '+r.blue+' blue and '+r.red+' red cell chips; destroyed by p53: '+r.destroyed+'; sent back: '+r.sentBack+'; checkpoints skipped: '+r.skipped+'.';});
    const none=['Run three trials in the growth model to collect data for this question.'];
    const lines={
      'analysis-design':groups.length<2?['Collect two sets in the growth model, then choose them in the comparison above.']:(a&&b&&a.id!==b.id?['Set '+a.index+': '+settings(a)+'.','Set '+b.index+': '+settings(b)+'.','Changed: '+(['age','size','tissue'].filter(k=>a[k]!==b[k]).map(k=>({age:'age',size:'body size',tissue:'cell type'})[k]).join(', ')||'nothing (same settings)')+'.']:['Choose two different sets in the comparison above.']),
      'analysis-variation':groups.length?[(a||groups[groups.length-1])].map(g=>'Set '+g.index+' ('+settings(g)+'): trials '+counts(g)+', range '+g.min+'–'+g.max+'.'):none,
      'analysis-celltypes':(()=>{if(!groups.length)return none;const by={};groups.forEach(g=>{(by[g.tissue]=by[g.tissue]||[]).push(g);});const keys=Object.keys(by);
        const out=keys.map(k=>labelTissue(k)+': '+by[k].map(g=>'Set '+g.index+' mean '+g.mean.toFixed(1)+' (age '+g.age+', '+labelBody(g.size).toLowerCase()+' body)').join('; ')+'.');
        if(keys.length<2)out.push('You have tested one cell type so far. Run a set with a different cell type at the same age and body size.');return out;})(),
      'explanation':(()=>{if(!groups.length)return none;const out=groups.slice().sort((x,y)=>x.age-y.age||String(x.size).localeCompare(String(y.size))).map(g=>'Set '+g.index+': '+settings(g)+' → mean '+g.mean.toFixed(1)+' divisions.');
        if(!groups.some(x=>groups.some(y=>x!==y&&x.tissue===y.tissue&&(x.age!==y.age)!==(x.size!==y.size))))out.push('To see a pattern, run a set that changes only age or only body size.');return out;})(),
      'analysis-cancer':groups.length?groups.map(g=>'Set '+g.index+' ('+settings(g)+'): cancer-state units '+g.trials.map(t=>t.modelVersion===2?t.cancerCount:'not recorded').join(', ')+'.'):none,
      'analysis-checkpoints':rounds,
      'model-revision':(groups.length?groups.map(g=>'Set '+g.index+': '+settings(g)+' → mean '+g.mean.toFixed(1)+'.'):none).concat(rounds),
      'model-prediction':groups.length?groups.map(g=>'Set '+g.index+': '+settings(g)+' → mean '+g.mean.toFixed(1)+'.'):none
    };
    Object.keys(lines).forEach(id=>{
      const field=document.getElementById(id);if(!field)return;
      let box=document.getElementById('qe-'+id);
      if(!box){box=document.createElement('div');box.className='q-evidence';box.id='qe-'+id;
        const h=document.createElement('p');h.className='q-evidence-title';h.textContent='Your data';box.appendChild(h);
        const list=document.createElement('ul');box.appendChild(list);field.parentNode.insertBefore(box,field);}
      const list=box.querySelector('ul');list.replaceChildren(...lines[id].map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
    });
  }
  function renderAnalysisReference(){
    renderQuestionEvidence();
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
    for(const n of [1,2]){const r=roundEvidence(n);if(!r)continue;const p=document.createElement('p');p.textContent=evidenceLine(n,r);out.appendChild(p);}
    const note=document.createElement('p');note.className='small';note.textContent='Game chips and model counts come from game rules and invented teaching units, not measured cancer risk. Magenta cells represent the growth model’s state after three control changes.';out.appendChild(note);
  }
  function renderComparison(){
    const groups=trialGroups(),a=groups[Number($('#compare-a').value)],b=groups[Number($('#compare-b').value)],out=$('#comparison-evidence');
    renderQuestionEvidence();
    out.innerHTML='';
    $('#sentence-evidence').textContent='Sentence starter: “When I changed ___, the mean changed from ___ to ___ divisions. This matters because ___.”';
    function para(text,className){const p=document.createElement('p');if(className)p.className=className;p.textContent=text;out.appendChild(p);}
    if(groups.length<2||!a||!b){para('Collect two sets to reveal your evidence comparison.');return;}
    if(a.id===b.id){para('Choose two different sets to compare.');return;}
    const changed=['age','size','tissue'].filter(k=>a[k]!==b[k]),names={age:'modeled age',size:'modeled body size',tissue:'cell type'};
    const title=document.createElement('h3');title.textContent=changed.length===1?'One setting changed: '+names[changed[0]]:changed.length?'More than one setting changed':'Same settings, separate trials';out.appendChild(title);
    const display=document.createElement('div');display.className='comparison-means';
    for(const g of [a,b]){const el=document.createElement('div'),n=document.createElement('strong'),label=document.createElement('span'),range=document.createElement('small');n.textContent=g.mean.toFixed(1);label.textContent='Set '+g.index+' mean divisions';range.textContent='Range '+g.min+'–'+g.max+' · '+g.trials.length+' trials';el.append(n,label,range);display.appendChild(el);}out.appendChild(display);
    // From the means as displayed (one decimal), so the difference always matches the two numbers on screen.
    const shown=g=>Number(g.mean.toFixed(1)),diff=Number((shown(b)-shown(a)).toFixed(1));
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
    identity.textContent=student?'Student: '+student.name+(student.period?' · Class period: '+student.period:''):'Student name not entered. Sign in on the Biology Companion Activities dashboard before submitting.';
    report.appendChild(identity);
    const list=document.createElement('ul');list.className='report-checks';
    const msDone=MAKING_SENSE_IDS.filter(id=>$('#'+id)&&$('#'+id).value.trim()).length;
    const labels=['Round 1: '+(state.game.roundResults[1]?'completed':'not completed'),'Round 2: '+(state.game.roundResults[2]?'completed':'not completed'),msDone+' of '+MAKING_SENSE_IDS.length+' Lesson 3 Making Sense responses written',groups.length+' model set'+(groups.length===1?'':'s')+' recorded',ANALYSIS_PROMPTS.filter(item=>$('#'+item[1]).value.trim()).length+' of '+ANALYSIS_PROMPTS.length+' analysis responses written'];
    labels.forEach(t=>{const li=document.createElement('li');li.textContent=t;list.appendChild(li);});report.appendChild(list);
    if(groups.length){const wrap=document.createElement('div');wrap.className='table-wrap';const table=document.createElement('table');table.className='data';table.innerHTML='<caption>Recorded sets</caption><thead><tr><th>Set</th><th>Settings</th><th>Trial divisions</th><th>Mean</th><th>Cancer-state units by trial</th></tr></thead>';const body=document.createElement('tbody');
      groups.forEach(g=>{const row=document.createElement('tr');[String(g.index),'Age '+g.age+' / '+labelBody(g.size)+' / '+labelTissue(g.tissue),g.trials.map(t=>t.divisions).join(', '),g.mean.toFixed(1),g.trials.map(t=>t.modelVersion===2?String(t.cancerCount):'—').join(', ')].forEach(text=>{const td=document.createElement('td');td.textContent=text;row.appendChild(td);});body.appendChild(row);});table.appendChild(body);wrap.appendChild(table);report.appendChild(wrap);}
    for(const n of [1,2]){const r=roundEvidence(n);if(!r)continue;const row=document.createElement('p');row.className='report-round';row.textContent=evidenceLine(n,r);report.appendChild(row);}
    const ms=document.createElement('h4');ms.textContent='Lesson 3 · Making sense of the Cell Game';report.appendChild(ms);
    const msWrap=document.createElement('div');msWrap.className='table-wrap';const msTable=document.createElement('table');msTable.className='data report-making-sense';
    msTable.innerHTML='<caption>Round 1: Making Sense</caption><thead><tr><th>Phase or checkpoint</th><th>What happened in the game during this phase/checkpoint?</th><th>What do you think it could represent in a cell?</th></tr></thead>';
    const msBody=document.createElement('tbody');
    MAKING_SENSE_ROWS.forEach(function(row){const tr=document.createElement('tr');const th=document.createElement('th');th.textContent=row[1];tr.appendChild(th);for(const part of ['happened','represent']){const td=document.createElement('td');td.textContent=($('#ms-r1-'+row[0]+'-'+part)||{value:''}).value.trim()||'Not answered yet.';tr.appendChild(td);}msBody.appendChild(tr);});
    msTable.appendChild(msBody);msWrap.appendChild(msTable);report.appendChild(msWrap);
    for(const [label,id] of MAKING_SENSE_PROMPTS){const h=document.createElement('h4');h.textContent=label;const p=document.createElement('p');p.className='report-answer';p.textContent=($('#'+id)||{value:''}).value.trim()||'Not answered yet.';report.append(h,p);}
    for(const [label,id] of ANALYSIS_PROMPTS.concat([['One model limitation','model-limit']])){const h=document.createElement('h4');h.textContent=label;const p=document.createElement('p');p.className='report-answer';p.textContent=$('#'+id).value.trim()||'Not answered yet.';report.append(h,p);}
    const note=document.createElement('p');note.className='small muted';note.textContent='Simplified teaching model. Divisions are DNA-copying opportunities; these counts are not human measurements or cancer probabilities. The cancer state uses three explicitly modeled control changes and deliberately accelerated teaching rules.';report.appendChild(note);
  }
  function runTrials(){
    const s=settings(),trials=[];
    for(let i=0;i<3;i++)trials.push(simulateOne(s.age,s.size,s.tissue));
    state.trials.push(...trials);renderTrials();
    const last=String(trialGroups().length-1);$('#replay-set').value=last;$('#compare-b').value=last;fillTrialSelect();
    renderComparison();save();
    if(window.GrowthModelScene)window.GrowthModelScene.play(trials);
  }
  function download(){
    save();
    const makingSense={round1Table:MAKING_SENSE_ROWS.map(function(r){return {row:r[1],whatHappened:state.fields['ms-r1-'+r[0]+'-happened']||'',couldRepresent:state.fields['ms-r1-'+r[0]+'-represent']||''};}),questions:MAKING_SENSE_PROMPTS.map(function(x){return {prompt:x[0],answer:state.fields[x[1]]||''};})};
    const payload={format:'openscied-b3-cell-cycle-progress-v1',exportedAt:new Date().toISOString(),student:studentIdentity(),game:state.game,cellChips:{round1:roundEvidence(1),round2:roundEvidence(2)},lesson3MakingSense:makingSense,
      // Each trial also names its set (Set 1, 2, …: three trials each, in the order they were run) and its trial number
      // within that set, as in the data table. Every earlier field is kept, so older readers of this file still work.
      simulationTrials:state.trials.map(function(t,i){return Object.assign({},t,{setNumber:Math.floor(i/3)+1,trialInSet:i%3+1});}),answers:state.fields};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cell-cycle-cancer-model-work.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  // "Clear this activity" clears what the dashboard's Clear clears for this activity (its saved record), then reloads a
  // fresh activity at the Overview. The student's name and class period are shared with the whole site and stay saved,
  // as they do on the dashboard. Uses the page's own confirm dialog (window.confirm can be suppressed by the browser).
  function clearActivity(){
    // Blank the fields first so a browser that restores form values on reload cannot save the old answers again.
    $$('textarea').forEach(function(el){el.value='';});
    $$('input[type=checkbox],input[type=radio]').forEach(function(el){el.checked=el.defaultChecked;});
    $$('select').forEach(function(el){Array.from(el.options).forEach(function(o){o.selected=o.defaultSelected;});});
    $$('input[type=range]').forEach(function(el){el.value=el.defaultValue;});
    cleared=true;
    try{localStorage.removeItem(KEY);}catch(e){}
    try{history.replaceState(null,'',location.pathname+location.search+'#overview');}catch(e){}
    window.location.reload();
  }
  function reset(){
    confirmGameReset('Clear this activity?','This erases this activity’s saved game rounds, growth-model trials and written answers from this browser and starts the activity fresh. Your name and class period stay saved. Download your work first if you want to keep a copy.',clearActivity,'Clear this activity');
  }
  function wire(){
    readStore();state.game.rolling=false;restoreFields();renderTrials();renderGame();renderCellType();showAnalysisPage(0);
    window.addEventListener('hashchange',save);
    window.addEventListener('resize',function(){fitGameViewport();renderBoard();},{passive:true});
    document.addEventListener('companion:show',function(){requestAnimationFrame(fitGameViewport);});
    $('#cancel-game-reset').addEventListener('click',function(){$('#game-reset-dialog').close();});
    // Round complete / Game over dialog: Escape (the dialog's cancel) and Close dismiss it; the buttons give the next step.
    $('#round-end-dialog').addEventListener('cancel',function(event){event.preventDefault();closeRoundEnd();});
    $('#round-end-dialog').addEventListener('click',function(event){
      const id=event.target&&event.target.id;
      if(id==='round-end-close')closeRoundEnd();
      else if(id==='round-end-next'&&state.game.round===1)closeRoundEnd(function(){startRound(2,state.game.mode,state.game.players);renderAnalysisReference();});
      else if(id==='round-end-next')closeRoundEnd(function(){
        if($('#cell-board').classList.contains('scene-expanded'))$('#enlarge-scene').click();
        const h=$('#making-sense-title');h.tabIndex=-1;h.scrollIntoView({block:'start'});h.focus({preventScroll:true});
      });
      else if(id==='round-end-new')closeRoundEnd(resetGame);
    });
    $('#age-slider').addEventListener('input',function(){$('#age-value').textContent=this.value;if(window.GrowthModelScene)window.GrowthModelScene.configure(settings());save();});
    ['body-size','tissue-rate'].forEach(id=>$('#'+id).addEventListener('change',function(){renderCellType();if(window.GrowthModelScene)window.GrowthModelScene.configure(settings());}));
    if(window.GrowthModelScene)window.GrowthModelScene.configure(settings());
    $('#growth-scene').addEventListener('growth-playback',function(event){
      const d=event.detail,has=state.trials.length>0;
      $('#growth-age').textContent=d.year;$('#growth-scrub').max=d.target;$('#growth-scrub').value=d.year;
      $('#growth-scrub').disabled=!has||!d.hasHistory||d.type==='settings';$('#pause-growth').disabled=!has||!d.hasHistory||d.type==='settings';
      $('#pause-growth').textContent=d.playing?'Pause playback':'Resume playback';
      if(d.type==='start')$('#growth-status').textContent=d.only?'Playing trial '+d.trial+' on its own. Years are compressed into seconds.':'Playing three recorded trials. Years are compressed into seconds.';
      if(d.type==='complete')$('#growth-status').textContent=d.only?'Playback of trial '+d.trial+' complete. Choose another trial or replay the set.':'Playback complete. All three trials are saved; compare their counts below.';
      if(d.type==='settings')$('#growth-status').textContent='Settings changed. Run three trials to record this setup.';
      if(d.type==='scrub')$('#growth-status').textContent='Trial '+d.trial+' at age '+d.year+': '+plural(d.divisions,'recorded division')+'.'+(d.hasCancerState?' '+plural(d.cancerCount,'cancer-state unit')+' in this teaching model.':' Cancerous state was not tracked in this earlier trial.');
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
      if(event.key==='Escape'&&!document.querySelector('dialog[open]')){$('#enlarge-growth').click();$('#enlarge-growth').focus();}
      if(event.key==='Tab'){
        const first=$('#enlarge-growth'),last=$('#growth-scene');
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });

    $('#growth-scrub').addEventListener('input',function(){if(window.GrowthModelScene)window.GrowthModelScene.scrub(Number(this.value));});
    $('#replay-growth').addEventListener('click',function(){
      const g=trialGroups()[Number($('#replay-set').value)],which=$('#replay-trial').value;if(!g||!window.GrowthModelScene)return;
      if(which==='all')window.GrowthModelScene.play(g.trials);else window.GrowthModelScene.play(g.trials,{start:Number(which),only:true});
    });
    $('#replay-set').addEventListener('change',fillTrialSelect);
    $('#jump-cancer').addEventListener('click',jumpToCancer);
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
      if(event.key==='Escape'&&!document.querySelector('dialog[open]'))$('#enlarge-scene').click();   // an open dialog takes Escape first
      if(event.key==='Tab'){
        const controls=Array.from($('#cell-board').querySelectorAll('button:not([hidden]):not(:disabled)'));
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    $('#restart-round').addEventListener('click',resetRound);
    $('#end-round').addEventListener('click',endRoundNow);
    $('#reset-game').addEventListener('click',resetGame);
    $('#round-summary').addEventListener('click',function(event){if(event.target&&event.target.id==='start-round2-from-summary')startRound(2,state.game.mode,state.game.players);});
    // The bottom buttons also bring the start of the new part into view, so students never scroll back up to find it.
    const toPartTop=()=>{const nav=$('#analysis-page-status').closest('.analysis-page-nav');if(nav)nav.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
    $('#analysis-prev').addEventListener('click',()=>showAnalysisPage(analysisPage-1));
    $('#analysis-next').addEventListener('click',()=>showAnalysisPage(analysisPage+1));
    $('#analysis-prev-bottom').addEventListener('click',()=>{showAnalysisPage(analysisPage-1);toPartTop();});
    $('#analysis-next-bottom').addEventListener('click',()=>{showAnalysisPage(analysisPage+1);toPartTop();});
    // Phones: the evidence panel starts folded so the questions come first; wide screens keep it open beside them.
    const refToggle=$('#analysis-reference-toggle');if(refToggle&&matchMedia('(max-width: 850px)').matches)refToggle.open=false;
    $('#run-trials').addEventListener('click',runTrials);
    const clearTrials=function(){state.trials=[];if(window.GrowthModelScene)window.GrowthModelScene.configure(settings());renderTrials();save();};
    $('#clear-trials').addEventListener('click',function(){if(!state.trials.length){clearTrials();return;}confirmGameReset('Clear the growth-model results?','This removes every recorded trial set. The board game and your written answers stay saved.',clearTrials,'Clear model results');});
    // Feedback belongs to the answer it judged: clear it (on screen and in storage) when the choice changes.
    [['quick-check','quick','#background-feedback'],['mechanism-check','mechanism','#mechanism-feedback']].forEach(function(item){
      $$('input[name="'+item[0]+'"]').forEach(function(el){el.addEventListener('change',function(){state[item[1]]='';$(item[2]).textContent='';save();});});
    });
    $('#check-background').addEventListener('click',function(){
      const choice=$('input[name="quick-check"]:checked');
      const out=$('#background-feedback');
      if(!choice){out.textContent='Choose one idea first.';return;}
      // Each wrong answer says why it is wrong, so a retry teaches rather than guesses.
      state.quick=choice.value==='b'?'Yes. Checkpoints can pause cell division when a cell needs to respond. p53 is one important part of a larger control system.'
        :choice.value==='a'?'Try again. Why not: most cell divisions make healthy cells. Cells copy their DNA very accurately and repair most copying mistakes, and cancer usually needs several changes to genes that control the cell cycle, so a single division does not create cancer.'
        :'Try again. Why not: p53 is one important control, but not the only one. Many other proteins also control division, including growth-signal proteins, other tumor-suppressor proteins and the checkpoint proteins themselves.';
      out.textContent=state.quick;save();
    });
    $('#check-mechanism').addEventListener('click',function(){
      const choice=$('input[name="mechanism-check"]:checked');
      const out=$('#mechanism-feedback');
      if(!choice){out.textContent='Choose one idea first.';return;}
      state.mechanism=choice.value==='a'?'Yes. A bypass can let a cell continue with damage or missing requirements, so daughter cells may inherit problems. That raises concern, but it does not guarantee cancer.'
        :choice.value==='b'?'Try again. Why not: every healthy cell passes checkpoints each time it divides. A cell that passes with a problem can hand that problem to its daughter cells, but becoming cancerous usually takes several changes, not one checkpoint.'
        :'Try again. Why not: p53 is one control among many. Other checkpoint proteins, DNA-repair systems and the immune system can also stop or remove a cell with problems.';
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
    // Only refresh an existing record on load. Saving a blank page (e.g. right after "Clear this activity") would make
    // the dashboard report the activity as started.
    if(hadSaved)save();else renderReport();
  }  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
