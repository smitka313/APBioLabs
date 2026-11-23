/* Lesson 7 companion UI. Game rules and persistence validation are in serengeti-logic.js. */
(function () {
  'use strict';
  const L = window.SerengetiLogic, qs = s => document.querySelector(s);
  if (!L) { qs('#sg-load-error').hidden = false; return; }
  const S = 'aplab:openscied-b1-serengeti:preview-v1';
  const LABEL = {wildebeest:'Wildebeest', hyena:'Hyenas', lion:'Lions'};
  const SINGULAR = {wildebeest:'Wildebeest', hyena:'Hyena', lion:'Lion'};
  const TYPES = {individual:'Individual', smallGroup:'Small group', herd:'Herd', clan:'Clan', pride:'Pride'};
  const BLANK = () => ({question:'', evidence:'', claim:'', limits:''});
  const fields = {question:'#sg-question', evidence:'#sg-evidence-choice', claim:'#sg-claim', limits:'#sg-limits'};
  const node = (tag, className, txt) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (txt != null) element.textContent = String(txt);
    return element;
  };
  const signed = v => v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0';
  const seasonName = i => L.SEASONS[i] || 'Winter';
  const tokenType = x => TYPES[x] || '';
  const freshSeed = () => window.crypto && window.crypto.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(1))[0] : Date.now() >>> 0;
  const roleName = role => LABEL[role] || 'All roles';
  let state = null, answers = BLANK(), saveUnavailable = false, preserveRaw = false, page = 'play', optionId = '', chosenPhase = '';
  let currentMoveToken = '', scene = null, currentOptions = [], currentPhase = '';
  // UI-only metadata. The engine action log and random state are not modified.
  let huntReview = null, huntStart = null, decision = null, cardChangedCells = [];
  let huntDetails = Object.create(null);
  const app = qs('#sg-play'), shape = qs('#sg-scene');
  const resetConfirm = qs('#sg-confirm'), instructions = qs('#sg-instructions');
  const sameCell = (a,b) => Boolean(a && b && a.x === b.x && a.y === b.y);
  const currentCellOptions = x => x && (x.to || x.cell || x.position || (x.cells && x.cells[0]));
  const moving = o => Boolean(o.tokenId && o.to);
  const cellKey = c => c.x + ':' + c.y;
  const gridCellLabel = c => 'column ' + (c.x+1) + ', row ' + (c.y+1);
  const travelCard = p => p.kind === 'card' && p.card?.effect === 'commute';
  function placementLabel(o, markers) {
    const marker=markers.find(m=>m.option.id===o.id)?.cell;
    if (!marker) return o.label.replace(/ · starts near [^·]+/, '');
    const index=Number(o.id.replace('placement-',''))+1;
    return (o.singleSurvivor?'Single survivor':'Formation '+index)+' · map marker: '+gridCellLabel(marker)
      +(o.cornerFallback?' · corner-contact fallback':'');
  }
  const describeToken = t => (SINGULAR[t.species] || 'Animal') + ' ' + tokenType(t.type).toLowerCase();

  // The official migration rule moves the survivors as a formation. Assign each legal
  // plan a distinct map marker when available; show all its squares once chosen.
  function planMarkers(options) {
    const matched = new Map();
    function assign(o, seen) {
      for (const c of o.cells || []) {
        const k = cellKey(c);
        if (seen.has(k)) continue;
        seen.add(k);
        const existing = matched.get(k);
        if (!existing || assign(existing.option, seen)) {
          matched.set(k, {option:o, cell:c});
          return true;
        }
      }
      return false;
    }
    options.slice().reverse().forEach(o => assign(o, new Set()));
    return Array.from(matched.values());
  }
  function mapChoices(tokens) {
    const sources = [];
    const legal = [];
    const byId = new Map(tokens.map(t => [t.id,t]));
    if (currentPhase === 'migration') {
      planMarkers(currentOptions).forEach(({option,cell}) => legal.push({option,cell}));
    } else {
      const seen = new Set();
      for (const option of currentOptions) {
        if (moving(option)) {
          const token = byId.get(option.tokenId);
          if (token && !seen.has(token.id)) {
            sources.push(token); seen.add(token.id);
          }
          if (currentMoveToken === option.tokenId) legal.push({option,cell:option.to});
        } else {
          const cell = currentCellOptions(option) || byId.get(option.tokenId)?.cell;
          if (cell) legal.push({option,cell});
        }
      }
    }
    return {sources,legal,byId};
  }
  const squareName = cell => cell ? (cell.x + 1) + ', ' + (cell.y + 1) : 'unknown square';
  const preyTokens = st => st.tokens.filter(t=>t.species==='wildebeest');
  const pairCount = value => value + ' eligible ' + (value===1?'pair':'pairs');
  const noHuntReason = key => ({
    noPrey:'No wildebeest tokens remain on the board.',
    noHunters:'There are no individual or small-group predator tokens to hunt.',
    noEligibleHunters:'The remaining individual and small-group predators lack their territory’s clan or pride.',
    noAdjacentPair:'No eligible predator shares a side with a wildebeest token.'
  }[key] || 'No eligible pairings remain.');
  function accountHunt(before,after) {
    const battle=after.lastBattle, oldPrey=preyTokens(before), newPrey=preyTokens(after);
    const index=after.log.length-1;
    const removed=oldPrey.find(t=>t.id===battle.removedId);
    const oldIds=new Set(oldPrey.map(t=>t.id));
    const added=newPrey.filter(t=>!oldIds.has(t.id));
    const cells=[];
    if(removed)cells.push({...removed.cell,change:'removed'});
    for(const t of added)cells.push({...t.cell,change:'added'});
    let message;
    if(battle.winner==='prey')message='The wildebeest escaped. No change to tokens or population.';
    else if(removed && added.length===2 && removed.type==='smallGroup'){
      message='Replaced the wildebeest small-group token at square '+squareName(removed.cell)
        +' with individual tokens at squares '+added.map(t=>squareName(t.cell)).join(' and ')+'.'
        +' Board tokens: '+oldPrey.length+' → '+newPrey.length+' (+1). Population: −1. One small group represents three wildebeest; two survived as individuals.';
    }else if(removed){
      message='Removed the wildebeest '+tokenType(removed.type).toLowerCase()+' at square '+squareName(removed.cell)+'.'
        +(battle.preyId!==removed.id?' The attacked token stayed on the board.':'')+' Population: '+signed(battle.change)+'.';
    }else message='The predator won the roll, but there was no eligible loss to apply. No tokens or population changed.';
    huntDetails[index]=message;
    huntReview={index,cells};
  }
  function activeReview() {
    if (!huntReview || !state?.lastBattle || huntReview.index!==state.log.length-1) return null;
    const row=state.log[huntReview.index];
    return row?.kind==='hunt' ? {...huntReview,row,battle:state.lastBattle,message:huntDetails[huntReview.index] || row.description} : null;
  }
  function moveReadiness(st, role) {
    const readiness=L.huntReadiness(st,role);
    return { ...readiness, count:readiness.pairings.length };
  }
  function huntRibbon(initial,remaining) {
    const parts=[];
    if(Number.isInteger(initial))parts.push(pairCount(initial)+' at the start of this phase');
    if(Number.isInteger(remaining))parts.push(pairCount(remaining)+' currently available');
    return parts.length ? parts.join(' · ')+'. Pairings can change when tokens move, are removed, or split.' : '';
  }
  function decisionFor(type,before,after,prior,choice,noCardTarget,beforeReady) {
    const priorTokens=new Map((before?.tokens||[]).map(t=>[t.id,t]));
    const nextTokens=new Map(after.tokens.map(t=>[t.id,t]));
    const tokenData = t => t ? {id:t.id,cell:t.cell,type:t.type,species:t.species,territory:t.territory} : null;
    const moved = type==='start' || type==='migrate' ? [] : [...new Set([...priorTokens.keys(),...nextTokens.keys()])].flatMap(id=>{
      const from=priorTokens.get(id), to=nextTokens.get(id);
      return from && to && sameCell(from.cell,to.cell) ? [] : [{before:tokenData(from),after:tokenData(to)}];
    }).slice(0,12);
    const card=prior?.card || (type==='draw' ? L.phase(after).card : null);
    const option=choice ? {id:choice.id,label:choice.label,tokenId:choice.tokenId,to:choice.to,
      cornerFallback:Boolean(choice.cornerFallback),singleSurvivor:Boolean(choice.singleSurvivor)} : null;
    return {type,logLength:after.log.length,season:after.season,previousSeason:before?.season,
      priorKind:prior?.kind,role:prior?.role,card:card ? {id:card.id,title:card.title,effect:card.effect,text:card.text} : null,
      noCardTarget,skippedReason:beforeReady?.blocked,count:beforeReady?.count,option,moved};
  }
  const notifyTurn = () => app.dispatchEvent(new CustomEvent('sg:turnchange',{bubbles:true}));


  // This preview save has its own namespace and never stores a student's name.
  let originalSave = null;
  try {
    originalSave = localStorage.getItem(S);
    const payload = originalSave === null ? null : JSON.parse(originalSave);
    if (originalSave !== null && (!payload || payload.v !== 1 || !Object.prototype.hasOwnProperty.call(payload,'game') || !payload.answers || typeof payload.answers !== 'object')) {
      preserveRaw = true;
    } else if (payload) {
      if (payload.game !== null) {
        state = L.restore(payload.game);
        if (!state) preserveRaw = true;
      }
      Object.keys(fields).forEach(key => {
        if (payload.answers && typeof payload.answers[key] === 'string') answers[key] = payload.answers[key].slice(0, 750);
      });
      if (['play','evidence','analyze'].includes(payload.page)) page = payload.page;
      if(state && payload.huntDetails && typeof payload.huntDetails==='object'){
        for(const [i,message] of Object.entries(payload.huntDetails)){
          if(state.log[Number(i)]?.kind==='hunt'&&typeof message==='string')huntDetails[i]=message.slice(0,560);
        }
      }
      if(state && Number.isInteger(payload.huntReview?.index)&&Array.isArray(payload.huntReview.cells)){
        const {index,cells} = payload.huntReview;
        huntReview={index,event:Boolean(payload.huntReview.event),cells:cells.filter(c=>Number.isInteger(c?.x)&&c.x>=0&&c.x<17&&Number.isInteger(c.y)&&c.y>=0&&c.y<21&&['removed','added'].includes(c.change)).slice(0,3)};
      }
      const d=payload.turnDecision;
      if(state && d && d.season===state.season && d.logLength===state.log.length &&
        ['start','migrate','draw','resolveCard','movePredator','beginHunts','roll','nextSeason'].includes(d.type) &&
        Array.isArray(d.moved) && d.moved.length<=12 && d.moved.every(x=>x && typeof x==='object') &&
        JSON.stringify(d).length<9000) decision=d;
      if(state&&payload.huntStart?.season===state.season&&['hyena','lion'].includes(payload.huntStart.role)&&Number.isInteger(payload.huntStart.count))huntStart=payload.huntStart;
    }
  } catch (_) {
    if (originalSave !== null) preserveRaw = true;
    else saveUnavailable = true;
  }
  let sample = L.create(32737);
  if (window.SerengetiScene && typeof window.SerengetiScene.mount === 'function') {
    try { scene = window.SerengetiScene.mount(shape, {onCell: selectByCell, onCancel: clearBoardSelection}); } catch (_) { scene = null; }
  }
  if (!scene) {
    shape.classList.add('sg-no-scene');
    shape.replaceChildren(node('p', '', 'The field map did not load. Use the turn controls and the legal move list to keep playing.'));
  }

  function say(message) { qs('#sg-live').textContent = message; }
  function save() {
    if (preserveRaw) {
      qs('#sg-save').textContent = 'An unreadable save was preserved. New changes will not save until you confirm Restart game.';
      qs('#sg-recover').hidden = false;
      qs('#sg-save-warning').hidden = false;
      return;
    }
    qs('#sg-recover').hidden = true;
    qs('#sg-save-warning').hidden = true;
    try {
      localStorage.setItem(S, JSON.stringify({v:1,game:state,answers,page,huntReview,huntStart,huntDetails,turnDecision:decision}));
      saveUnavailable = false;
    } catch (_) { saveUnavailable = true; }
    qs('#sg-save').textContent = saveUnavailable ? 'This browser blocked saving. Download your work before closing.' : state ? 'Progress saved on this device.' : 'Progress stays in this browser only.';
  }
  function openPage(target, moveFocus) {
    if (!['play','evidence','analyze'].includes(target)) return;
    page = target;
    ['play','evidence','analyze'].forEach(k => { qs('#sg-' + k).hidden = k !== page; });
    document.querySelectorAll('.sg-tabs [data-page]').forEach(b => {
      if (b.dataset.page === page) b.setAttribute('aria-current','page');
      else b.removeAttribute('aria-current');
    });
    if (page !== 'play') renderEvidence();
    if (moveFocus) {
      const targetHeading = qs(page === 'play' ? '#sg-action-title' : '#sg-' + page + '-title');
      targetHeading.focus({preventScroll:true});
      if (qs('.sg-toolbar').getBoundingClientRect().top < 0) qs('.sg-toolbar').scrollIntoView({block:'start'});
    }
    save();
  }
  function clearBoardSelection() {
    if (!currentMoveToken && !optionId) return;
    currentMoveToken = ''; optionId = '';
    paint(false);
    say('Selection cleared.');
  }
  function selectByCell(x,y) {
    if (!state) return;
    const cell = x && typeof x === 'object' ? x : {x,y};
    const {sources,legal} = mapChoices(state.tokens);
    const source = sources.find(t => sameCell(cell, t.cell));
    if (source) {
      if (currentMoveToken === source.id) { clearBoardSelection(); return; }
      currentMoveToken = source.id;
      optionId = '';
      paint(false);
      const total = currentOptions.filter(o=>moving(o) && o.tokenId===source.id).length;
      say(describeToken(source) + ' selected. Choose a marked square. ' + total + ' available.');
      return;
    }
    const choice = legal.find(entry => sameCell(cell,entry.cell))?.option;
    if (!choice) return;
    if (moving(choice) && choice.tokenId === currentMoveToken) {
      run(currentPhase === 'card' ? 'resolveCard' : 'movePredator', choice.id);
      return;
    }
    optionId = choice.id;
    currentMoveToken = '';
    paint(false);
    const foundMarker=currentPhase==='migration' ? placementLabel(choice,planMarkers(currentOptions)) : choice.label;
    say('Selected ' + foundMarker + '. Confirm with the turn button.');
  }
  function button(id, label, invoke, tone, actionType) {
    const b = node('button', tone || 'sg-cta', label);
    b.type = 'button'; b.id = id;
    if (actionType) b.dataset.action = actionType;
    b.addEventListener('click', invoke);
    return b;
  }
  function run(type, choice) {
    const focused = document.activeElement && document.activeElement.id;
    const current = focused && document.getElementById(focused);
    const oldTop = current && current.getBoundingClientRect().top;
    if (activeReview()) return;
    const before = state, prior = L.phase(before);
    const beforeReady = type==='beginHunts' ? moveReadiness(before,prior.role) : null;
    const chosen = (prior.options||[]).find(o=>o.id===choice) || prior.options?.[0];
    const noCardTarget = type==='resolveCard' && !(prior.options||[]).some(o=>o.id!=='stay');
    try { state = L.act(state, choice == null || choice === '' ? {type} : {type, optionId: choice}); }
    catch (_) { state = before; say('That move is not available. Choose a listed option.'); return; }
    if (!state || state === before) { state = before; say('That move is not available now.'); return; }
    decision=decisionFor(type,before,state,prior,chosen,noCardTarget,beforeReady);
    optionId = ''; currentMoveToken = ''; cardChangedCells = [];
    if (type==='resolveCard') {
      const oldTokens=new Map(before.tokens.map(t=>[t.id,t])), newTokens=new Map(state.tokens.map(t=>[t.id,t]));
      before.tokens.filter(t=>!newTokens.has(t.id)).forEach(t=>cardChangedCells.push({...t.cell,change:'removed'}));
      state.tokens.forEach(t=>{
        const old=oldTokens.get(t.id);
        if(!old)cardChangedCells.push({...t.cell,change:'added'});
        else if(!sameCell(t.cell,old.cell))cardChangedCells.push({...t.cell,change:'moved'});
      });
    }
    const nextPhase=L.phase(state);
    if(type==='beginHunts'){
      huntStart=prior.role ? {season:before.season,role:prior.role,count:beforeReady.count} : null;
    }else if(type==='resolveCard'){
      if(nextPhase.kind==='hunt')huntStart={season:state.season,role:nextPhase.role,count:moveReadiness(state,nextPhase.role).count};
    }else if(type==='nextSeason')huntStart=null;
    if(type==='roll'&&state.log.length>before.log.length&&state.log[state.log.length-1]?.kind==='hunt'){
      accountHunt(before,state);
      huntReview.event=Boolean(prior.event);
    }
    save();
    if (type==='roll') window.SerengetiDice?.markRoll();
    paint(true);
    if (focused && /^sg-(start|next|move)/.test(focused)) {
      const next = qs('#sg-next') || qs('#sg-action-title');
      next.focus({preventScroll:true});
      if (matchMedia('(max-width: 700px)').matches && oldTop > 0 && oldTop < innerHeight && scrollY > 0) {
        const newTop = next.getBoundingClientRect().top;
        if (newTop < 0 || newTop + next.offsetHeight > innerHeight) window.scrollBy(0, newTop - oldTop);
      }
    }
  }
  function acknowledgeHunt() {
    if (!activeReview()) return;
    huntReview=null;
    save();
    paint(true);
    (qs('#sg-next') || qs('#sg-action-title')).focus({preventScroll:true});
  }
  const outcomeText = winner => {
    if (winner === 'prey' || winner === 'wildebeest') return 'Wildebeest escaped';
    if (winner === 'predator') return 'Predator succeeded';
    return winner && LABEL[winner] ? LABEL[winner] + ' succeeded' : '';
  };
  function describeRow(entry,index) {
    if (!entry) return '';
    const extras = [entry.preyType && 'Wildebeest: ' + tokenType(entry.preyType),
      entry.predatorType && (SINGULAR[entry.predatorSpecies || entry.role] || 'Predator') + ': ' + tokenType(entry.predatorType),
      outcomeText(entry.winner)].filter(Boolean);
    return [huntDetails[index] || entry.description || '', ...extras].filter(Boolean).join(' · ');
  }
  function rawSummary() { return state ? L.results(state) : {population:null,seasons:[]}; }
  function paint(announce) {
    const st = state || sample;
    const underlying = state ? L.phase(state) : {kind:'setup'};
    const review = activeReview();
    const reviewHasNext = review && underlying.kind==='hunt' && underlying.role===review.row.role;
    const p = review ? {kind:'huntReview',role:review.row.role,battle:review.battle} : underlying;
    const activeRole = p.role || {migration:'wildebeest',hyenaMove:'hyena',lionMove:'lion'}[p.kind] || null;
    const last = state && state.log.length ? state.log[state.log.length - 1] : null;
    qs('#sg-evidence-count').textContent = state ? state.log.length : 0;
    const season = Number.isInteger(st.season) ? st.season : 0;
    const key = [p.kind, season, activeRole, p.card && p.card.id].join(':');
    if (chosenPhase !== key) { optionId = ''; currentMoveToken = ''; chosenPhase = key; }
    currentPhase = p.kind;
    currentOptions = Array.isArray(p.options) ? p.options : [];

    const seasonStrip = qs('#sg-season-strip');
    seasonStrip.replaceChildren(...L.SEASONS.map((name, i) => {
      const d = node('div', 'sg-season');
      d.append(node('i','',i < season || p.kind === 'complete' ? '✓' : i + 1),node('span','',name),
        node('small','',i === season && p.kind !== 'complete' ? 'Current' : i < season || p.kind === 'complete' ? 'Done' : 'Turn ' + (i + 1)));
      if (i === season && p.kind !== 'complete') d.setAttribute('aria-current','step');
      return d;
    }));
    qs('#sg-rolebar').replaceChildren(...L.ROLES.map(role => {
      const d = node('div','sg-role'); d.append(node('b','',roleName(role)),node('em','',role === activeRole ? 'Your turn' : p.kind === 'setup' ? 'Player role' : ''));
      if (role === activeRole) d.setAttribute('aria-current','true');
      return d;
    }));
    const tokens = st.tokens || [], currentPrey = tokens.filter(t => t.species === 'wildebeest');
    qs('#sg-board-title').textContent = seasonName(season) + ' range';
    qs('#sg-board-caption').textContent = 'Season ' + (season + 1) + ' of 4 · Markers represent individuals, small groups, herds, clans or prides.'
      +(p.kind==='migration' || last?.kind==='migration' ? ' Lines join the starting and ending squares on this board, not the animals’ exact paths.' : '');
    qs('#sg-metrics').replaceChildren(...[['Wildebeest tokens',currentPrey.length],['Individuals',currentPrey.filter(t=>t.type==='individual').length],['Small groups',currentPrey.filter(t=>t.type==='smallGroup').length],['Herds',currentPrey.filter(t=>t.type==='herd').length]].map(([label,count]) => {
      const v = node('div','sg-stat'); v.append(node('strong','',count),node('span','',label)); return v;
    }));
    const map = mapChoices(tokens);
    const selected = currentOptions.find(o => o.id === optionId);
    const source = map.byId.get(currentMoveToken);
    const optionMarker = map.legal.find(e=>e.option === selected)?.cell;
    const selectedCells = selected?.cells || [];
    const selectedCell = optionMarker || currentCellOptions(selected) || map.byId.get(selected?.tokenId)?.cell;
    const battle = p.battle || st.battle;
    const pos = battle && (battle.preyCell || tokens.find(t => t.id === battle.preyId)?.cell);
    const predPos = battle && (battle.predatorCell || tokens.find(t => t.id === battle.predatorId)?.cell);
    const migrationPreview = p.kind==='migration'
      ? selectedCells.map((destination,i)=>({id:currentPrey[i]?.id,from:currentPrey[i]?.cell,to:destination})) : [];
    const proximity=qs('#sg-map-proximity');
    if(proximity){
      const migrationNote=p.kind==='migration' || (p.kind==='card' && last?.kind==='migration');
      proximity.hidden=!migrationNote;
      if(migrationNote){
        let board=st, label='At this range';
        if(p.kind==='migration' && selectedCells.length===currentPrey.length && selectedCells.length){
          const moved=new Map(currentPrey.map((token,i)=>[token.id,selectedCells[i]]));
          board={...st,tokens:st.tokens.map(t=>moved.has(t.id)?{...t,cell:moved.get(t.id)}:t)};
          label='This placement would put';
        } else if(p.kind==='migration') label='Before the move';
        const hyena=moveReadiness(board,'hyena').count, lion=moveReadiness(board,'lion').count;
        proximity.textContent=label+': '+hyena+' hyena and '+lion+' lion '+(hyena+lion===1?'pair':'pairs')+' within hunting range.';
      }
    }
    const huntPresentation = battle && (p.kind==='hunt' || review) ? {
      predatorId:battle.predatorId,preyId:battle.preyId,species:activeRole,round:battle.rounds?.at(-1),
      roundNumber:battle.rounds?.length||0,revealed:Boolean(review),winner:review?battle.winner:null,
      preyDice:battle.preyDice,predatorDice:battle.predatorDice
    } : null;
    qs('#sg-board-access').textContent = review ? 'Highlighted squares show the finished hunt. '+review.message
      : p.kind === 'hunt' && battle ? 'The highlighted wildebeest token is involved in the current hunt.'
      : source ? describeToken(source) + ' selected. Choose a dashed destination to move it. Select the piece again or press Escape to clear.'
      : map.sources.length ? 'Select an outlined piece, then choose a dashed destination. You can also use the move list.'
      : p.kind === 'migration' && map.legal.length ? 'Choose a dashed marker to preview a herd placement, then confirm below.'
      : map.legal.length ? 'Choose a marked square or use the turn controls.'
      : 'Each token’s marker identifies the type of group.';
    if (scene) scene.update({stage:p.kind, season, tokens, predatorPosition:predPos, herd:currentPrey.filter(t=>t.type==='herd').length,
      legalCells:map.legal.map(e=>e.cell), sourceCells:map.sources.map(t=>t.cell), selectedTokenId:source?.id,
      selected:selectedCell, selectedCells, position:pos, wet:season===0 || season===1,
      grass:currentPrey.length, reveal:p.kind === 'hunt'||Boolean(review),
      floodedCells:L.floodedCells(st),lastChangedCells:review?.cells || cardChangedCells,
      migrationPreview,huntPresentation,eventCardOpen:Boolean(p.card)});
    const interact = qs('#sg-interactive'), actions = qs('#sg-actions'), dice = qs('#sg-dice');
    interact.replaceChildren(); actions.replaceChildren();
    let showedDice = false;
    const showDice = (details, species, finished) => {
      showedDice = Boolean(details);
      if (window.SerengetiDice) window.SerengetiDice.render(dice,{battle:details,species,finished,season});
      else { dice.replaceChildren(); paintDice(details,species,dice,finished); }
    };
    app.dataset.phase = p.kind;
    let title = '', desc = '', phaseLabel = '', note = '';
    const chooseDestination = Boolean(source && !optionId);
    const advance = (label,type) => {
      const next=button('sg-next',label,()=>run(type, optionId),null,type);
      if (type === 'resolveCard') next.disabled = chooseDestination;
      actions.append(next);
    };

    if (p.kind === 'setup') {
      phaseLabel = 'Set up'; title = 'One device, three roles';
      desc = 'Assign one role to each player or team. You will collect evidence together, not compete for an overall winner.';
      const list = node('div','sg-card');
      list.append(node('h3','','A year in the ecosystem'),node('p','','Set up in winter, then play four seasons: migrate, draw three cards, and resolve hyena and lion hunts.'));
      interact.append(list);
      actions.append(button('sg-start','Start winter', () => { state=L.create(freshSeed()); decision=decisionFor('start',null,state,null,null,false,null); optionId=''; chosenPhase=''; save(); paint(true); (qs('#sg-next') || qs('#sg-action-title')).focus({preventScroll:true}); },null,'start'));
    } else if (p.kind === 'migration') {
      phaseLabel = '1 · Migration'; title = season === 0 ? 'Place the winter herd' : 'Move to the ' + seasonName(season).toLowerCase() + ' range';
      desc = season === 0 ? 'Place the starting wildebeest tokens in the winter range.' : 'Move the surviving wildebeest into this season’s range.';
      if (currentOptions.length) {
        const markers=planMarkers(currentOptions);
        interact.append(chooser(currentOptions.map(o=>({...o,label:placementLabel(o,markers)})),'Legal placement','Use suggested formation'));
      }
      advance(season === 0 ? 'Place winter herd' : 'Migrate wildebeest','migrate');
      note = currentOptions.some(o => o.cornerFallback) ? 'Board-fit exception: a corner may count as touching when side-by-side placements do not fit.' : currentPrey.length === 1 ? 'Only one wildebeest token survives, so it has no neighbor.' : currentPrey.length === 0 ? 'No wildebeest tokens remain to migrate.' : 'Each token shares a side with another; separate groups are allowed.';
    } else if (p.kind === 'card') {
      phaseLabel = '2 · Event cards'; title = p.card ? (p.card.title || 'Read and apply the card') : roleName(activeRole) + ' draw a card';
      desc = p.card ? 'Apply this event even when it affects a different role.' : 'Pass the device to this role to reveal the next event.';
      if (p.card) {
        const c = node('article','sg-card');
        c.dataset.cardId = p.card.id; c.dataset.cardRole = activeRole; c.dataset.cardSeason = String(season);
        c.append(node('h3','', 'Drawn by ' + roleName(activeRole)),node('p','',p.card.text || p.card.description || p.card.body || p.card.title || ''));
        interact.append(c);
        if (travelCard(p) && currentOptions.some(moving)) {
          interact.append(travelChooser(currentOptions,tokens));
          desc = 'Choose a hyena group, then pick one of its legal destinations, or choose to stay.';
        } else if (currentOptions.length) interact.append(chooser(currentOptions,'Choose how to apply it'));
      }
      const noTarget = p.card && !currentOptions.some(o=>o.id!=='stay');
      if(noTarget)note='No legal target or move is available. Continue without changing the board.';
      advance(p.card ? (noTarget ? 'Continue without a board change' : 'Apply event') : 'Draw event card', p.card ? 'resolveCard' : 'draw');
    } else if (p.kind === 'hyenaMove' || p.kind === 'lionMove') {
      phaseLabel = activeRole === 'hyena' ? '3 · Hyenas hunt' : '4 · Lions hunt';
      title = 'Check ' + (activeRole === 'hyena' ? 'hyena' : 'lion') + ' positions';
      desc = 'Only eligible individual or small-group tokens beside wildebeest can hunt. Clans and prides do not roll.';
      if (currentOptions.length) {
        interact.append(chooser(currentOptions,'Optional one-space move'));
        const move=button('sg-move','Use selected move',()=>run('movePredator',optionId || currentOptions[0].id),'sg-plain','movePredator');
        move.disabled=chooseDestination;
        actions.append(move);
      }
      const otherRole=activeRole==='hyena'?'lion':'hyena';
      const ready=moveReadiness(st,activeRole), other=moveReadiness(st,otherRole);
      const ownLabel=activeRole==='hyena'?'Hyenas':'Lions';
      note = 'Eligible on this board: '+ownLabel+' '+ready.count+'; '+roleName(otherRole)+' '+other.count+'.'
        +' A predator and wildebeest must share a side. Pairings can change when tokens move, are removed, or split.'
        +(!ready.count?' '+noHuntReason(ready.blocked):'');
      if (ready.count) {
        const pairList=node('details','sg-card');
        pairList.append(node('summary','',pairCount(ready.count)+' for '+ownLabel.toLowerCase()));
        const rows=node('ul');
        ready.pairings.forEach(b=>rows.append(node('li','',
          tokenType(b.predatorType)+' at '+squareName(b.predatorCell)+' → wildebeest '+tokenType(b.preyType).toLowerCase()+' at '+squareName(b.preyCell))));
        pairList.append(rows);
        interact.append(pairList);
      }
      actions.append(button('sg-next',ready.count?'Begin '+activeRole+' hunts':'Continue without '+activeRole+' hunts',()=>run('beginHunts'),null,'beginHunts'));
    } else if (review) {
      phaseLabel = (review.event ? 'Event-card hunt' : activeRole === 'hyena' ? 'Hyena hunt' : 'Lion hunt')+' · Result';
      title = (SINGULAR[activeRole] || 'Predator')+' vs. wildebeest';
      desc = huntMatchup(battle);
      note = (outcomeText(battle.winner)||'Hunt resolved')+'. '+review.message;
      if (battle.change===-1 && review.cells.filter(cell=>cell.change==='added').length===2) {
        const reading=node('div','sg-hunt-reading'); reading.id='sg-hunt-reading';
        const markers=node('span'), loss=node('span');
        markers.append(node('small','','Board pieces'),node('strong','','1 small-group token → 2 individual tokens'));
        loss.append(node('small','','Wildebeest population'),node('strong','','1 wildebeest lost'));
        reading.append(markers,loss); interact.append(reading);
      }
      showDice(battle,activeRole,true);
      actions.append(button('sg-next',reviewHasNext?'Next hunt':'Done',acknowledgeHunt,null,'huntReview'));
    } else if (p.kind === 'hunt') {
      phaseLabel = p.event ? '2 · Event-card hunt' : activeRole === 'hyena' ? '3 · Hyenas hunt' : '4 · Lions hunt';
      title = 'Resolve a hunt';
      const species = activeRole;
      if (species) title = SINGULAR[species] + ' vs. wildebeest';
      const rounds = battle && Array.isArray(battle.rounds) ? battle.rounds : [];
      desc = huntMatchup(battle);
      showDice(battle,species,false);
      advance(rounds.length ? 'Roll remaining dice' : 'Roll hunt dice','roll');
      const initial=huntStart?.season===season&&huntStart.role===activeRole ? huntStart.count : null;
      note = huntRibbon(initial,moveReadiness(st,activeRole).count)+' Lower dice are removed; ties and unmatched dice stay.';
    } else if (p.kind === 'seasonEnd') {
      phaseLabel = 'Turn complete'; title = seasonName(season) + ' is complete';
      desc = 'Review this season’s evidence. The records carry forward to the next season.';
      advance(season === L.SEASONS.length-1 ? 'Finish the year' : 'Continue to ' + seasonName(season+1),'nextSeason');
      actions.append(button('sg-view-season','View evidence',()=>openPage('evidence',true),'sg-plain'));
    } else if (p.kind === 'complete') {
      phaseLabel = 'Year complete'; title = 'Four seasons, one shared record';
      desc = 'No one wins the game. Use the seasonal totals and the event history to explain what changed.';
      actions.append(button('sg-next','Analyze your evidence',()=>openPage('analyze',true)),button('sg-view-season','View evidence',()=>openPage('evidence',true),'sg-plain'));
    }
    if (travelCard(p) && currentOptions.some(moving)) {
      qs('#sg-next').disabled = !currentOptions.some(o=>o.id===optionId);
    }
    if (map.sources.length) {
      desc += chooseDestination ? ' Tap a dashed square to move the selected piece.' : ' Tap an outlined piece to show its moves.';
      if (chooseDestination) actions.append(button('sg-clear-piece','Clear piece selection',clearBoardSelection,'sg-plain'));
    }
    if (!showedDice) { dice.hidden = true; if (dice.firstElementChild) dice.replaceChildren(); }
    qs('#sg-phase').textContent = phaseLabel;
    qs('#sg-action-title').textContent = title;
    qs('#sg-action-copy').textContent = desc;
    qs('#sg-turn-note').textContent = note;
    const primary = qs('#sg-next') || qs('#sg-start');
    const explanation = window.SerengetiTurn?.explain({
      state,phase:p,underlying,decision,review,readiness:activeRole==='hyena'||activeRole==='lion'?moveReadiness(st,activeRole):null,
      nextLabel:primary?.textContent,priorLabel:title,selected,selectedToken:source,activeRole,
      selectionPending:chooseDestination,primaryDisabled:Boolean(primary?.disabled),
      selectedLabel:selected && (p.kind==='migration' ? placementLabel(selected,planMarkers(currentOptions)) : selected.label),
      last,lastHuntMessage:last?.kind==='hunt' ? huntDetails[state.log.length-1] : '',
      seasonName:seasonName(season),nextSeasonName:season<L.SEASONS.length-1 ? seasonName(season+1) : null
    }) || {what:review?.message||last?.description||title,why:note||desc,next:primary?.textContent||''};
    qs('#sg-last').textContent = explanation.what;
    const why = qs('#sg-update-why'), next = qs('#sg-update-next');
    if (why) why.textContent = explanation.why;
    if (next) next.textContent = explanation.next;
    if (announce) say([explanation.what,explanation.why,explanation.next].filter(Boolean).join(' '));
    const finish=qs('#sg-finish'), totals=qs('#sg-finish-totals');
    if(finish)finish.hidden=p.kind!=='complete';
    if(totals&&p.kind==='complete'){
      const summary=rawSummary();
      const headline=node('p','','Board tokens: '+sample.tokens.filter(t=>t.species==='wildebeest').length+' → '+currentPrey.length
        +'. Population change: '+signed(summary.change)+' wildebeest from the start. Token totals count game pieces, not individual animals.');
      if(updateFieldReport('sg-finish-report')) totals.replaceChildren(headline);
      else totals.replaceChildren(headline,compareCards(summary));
    } else updateFieldReport('sg-finish-report',false);
    if (page !== 'play') renderEvidence();
    notifyTurn();
  }
  function travelChooser(options,tokens) {
    const group=Array.from(new Set(options.filter(moving).map(o=>o.tokenId)));
    const panel=node('div','sg-travel-pick');
    const groupLabel=node('label','sg-chooser','1. Hyena group'); const groupMenu=node('select'); groupMenu.id='sg-travel-piece';
    const destLabel=node('label','sg-chooser','2. Destination'); const destMenu=node('select'); destMenu.id='sg-options';
    const opt=(el,value,label)=>{ const item=node('option','',label); item.value=value; el.append(item); };
    opt(groupMenu,'','Choose a hyena group');
    group.forEach(id=>{
      const token=tokens.find(t=>t.id===id);
      if (token) opt(groupMenu,id,'Small group at '+gridCellLabel(token.cell));
    });
    if(options.some(o=>o.id==='stay')) opt(groupMenu,'stay','Stay in place (do not move a group)');
    groupMenu.value=optionId==='stay'?'stay':currentMoveToken;
    opt(destMenu,'','Choose a destination');
    if(currentMoveToken) options.filter(o=>o.tokenId===currentMoveToken&&o.to).forEach(o=>opt(destMenu,o.id,gridCellLabel(o.to)));
    destMenu.disabled=!currentMoveToken;
    destMenu.value=options.some(o=>o.id===optionId&&o.tokenId===currentMoveToken)?optionId:'';
    groupMenu.addEventListener('change',()=>{
      currentMoveToken=group.includes(groupMenu.value)?groupMenu.value:'';
      optionId=groupMenu.value==='stay'?'stay':'';
      paint(false);
      qs('#sg-travel-piece')?.focus({preventScroll:true});
    });
    destMenu.addEventListener('change',()=>{
      optionId=options.some(o=>o.id===destMenu.value&&o.tokenId===currentMoveToken)?destMenu.value:'';
      paint(false);
      qs('#sg-options')?.focus({preventScroll:true});
    });
    groupLabel.append(groupMenu); destLabel.append(destMenu); panel.append(groupLabel,destLabel);
    return panel;
  }
  function chooser(options, title, suggested='Use suggested option') {
    const wrap = node('label','sg-chooser',title);
    const menu = node('select'); menu.id = 'sg-options';
    if (options.length) menu.append(node('option','',suggested));
    if (menu.firstElementChild) menu.firstElementChild.value = '';
    options.forEach(o => {
      const e = node('option','',o.label || o.id); e.value = o.id; menu.append(e);
    });
    menu.value = options.some(o => o.id === optionId) ? optionId : '';
    menu.addEventListener('change', () => {
      optionId = menu.value;
      const found = options.find(o => o.id === optionId);
      currentMoveToken = found && moving(found) ? found.tokenId : '';
      paint(false);
      qs('#sg-options')?.focus({preventScroll:true});
    });
    wrap.append(menu);
    return wrap;
  }
  function huntMatchup(battle) {
    if(!battle)return 'Compare the predator and wildebeest dice, highest to lowest.';
    return tokenType(battle.predatorType)+' at square '+squareName(battle.predatorCell)+' against wildebeest '
      +tokenType(battle.preyType).toLowerCase()+' at square '+squareName(battle.preyCell)+'.';
  }
  function paintDice(battle, species, el, finished) {
    if (!battle) return;
    const rows = Array.isArray(battle.rounds) ? battle.rounds : [];
    const round = rows[rows.length-1];
    const counts = {prey:Number(battle.preyDice) || 0,predator:Number(battle.predatorDice) || 0};
    const makeDice = (side, label) => {
      const row = node('div','sg-dice-row'); row.append(node('b','',label));
      const tray = node('div','sg-dice-track');
      const dieValues = round && Array.isArray(round[side]) ? round[side] : Array(counts[side]).fill(null);
      dieValues.forEach((v,i) => {
        const die = node('span','sg-die',v == null ? '?' : v);
        const pair = round && round.pairs && round.pairs[i];
        const other = pair && pair[side === 'prey' ? 'predator' : 'prey'];
        const lost = typeof other === 'number' && other > v;
        die.dataset.side = side;
        if (lost) die.dataset.out = 'yes';
        die.setAttribute('aria-label', v == null ? 'Die ready' : String(v) + (lost ? ', removed' : ', remains'));
        tray.append(die);
      });
      row.append(tray); return row;
    };
    el.hidden = false;
    if (finished) el.append(node('p','sg-kicker','Final roll · hunt result'));
    el.append(makeDice('prey','Wildebeest'),makeDice('predator',SINGULAR[species] || 'Predator'));
    if (round) el.append(node('p','sg-dice-result','Round ' + rows.length + ' · Dice left: wildebeest ' + round.preyRemaining + ', predator ' + round.predatorRemaining));
  }
  function recordName(r) { return r.title || (r.kind === 'hunt' ? (SINGULAR[r.role] || 'Predator') + ' hunt' : 'Board event'); }
  function compareCards(summary) {
    const list = node('ul','sg-totals');
    L.SEASONS.forEach((name,i) => {
      const s = (summary.seasons || []).find(x => x.season === i) || null;
      const li = node('li');
      li.append(node('span','',name),node('strong','',s ? signed(s.start) + ' → ' + signed(s.end == null ? summary.change : s.end) : 'Not started'));
      if (s) li.append(node('span','','Cards ' + signed(s.cardChange) + ' · Hunts ' + signed(s.huntChange)));
      list.append(li);
    });
    return list;
  }
  const fieldReports = new Map();
  function updateFieldReport(id, show = true) {
    const host=qs('#'+id);
    if(!host || !window.SerengetiFieldReport) return false;
    host.hidden=!show;
    if(!show) { fieldReports.get(id)?.update(null); return true; }
    if(!fieldReports.has(id)) fieldReports.set(id,window.SerengetiFieldReport.mount(host));
    fieldReports.get(id)?.update(state);
    return true;
  }
  function renderEvidence() {
    const visualReport=updateFieldReport('sg-evidence-report',Boolean(state))&&Boolean(state);
    const rows = state ? state.log : [];
    const summary = rawSummary();
    const es = qs('#sg-evidence-body'), aside = qs('#sg-analysis-data'), selected = qs('#sg-evidence-choice');
    const overview = node('section','sg-panel sg-ledger');
    overview.append(node('h3','','Cumulative wildebeest change by season'),compareCards(summary));
    const log = node('section','sg-panel sg-ledger');
    log.append(node('h3','','Event and hunt history'));
    if (rows.length) {
      const list = node('ol','sg-rows');
      rows.forEach((r,i) => {
        const li = node('li');
        const head = node('div'); head.append(node('strong','',recordName(r)),node('br'),node('small','',seasonName(r.season) + ' · ' + (r.kind === 'hunt' ? 'Hunt' : r.kind === 'migration' ? 'Migration' : 'Event card')));
        li.append(head,node('span','sg-change',signed(r.change) + ' · ' + signed(r.population) + ' cumulative'));
        const desc = describeRow(r,i);
        if (desc) li.append(node('p','',desc));
        list.append(li);
      });
      log.append(list);
    } else log.append(node('p','','Play a turn to begin recording evidence.'));
    es.replaceChildren(...(visualReport?[log]:[overview,log]));
    aside.replaceChildren(compareCards(summary));
    const empty = node('option','','Choose evidence'); empty.value = '';
    selected.replaceChildren(empty,...rows.map((r,i) => {
      const o = node('option','',seasonName(r.season) + ' · ' + recordName(r) + ' (' + signed(r.change) + ')');
      o.value = String(i); return o;
    }));
    selected.value = answers.evidence;
    qs('#sg-selected').textContent = selectionText(rows);
  }
  function selectionText(rows) {
    if (!answers.evidence || !rows || !rows[Number(answers.evidence)]) return '';
    const r = rows[Number(answers.evidence)];
    const before = r.population - r.change;
    const desc = describeRow(r,Number(answers.evidence));
    return 'Cumulative change: ' + signed(before) + ' → ' + signed(r.population) + ' (event change ' + signed(r.change) + ').' + (desc ? ' ' + desc : '');
  }
  function evidenceFile() {
    const rows = state ? state.log : [];
    const summary = rawSummary();
    const lines = ['Serengeti Board Game · Lesson 7','SIMULATED; evidence shows cumulative change from the starting population, not field counts.','','Season totals'];
    if (!summary.seasons?.length) lines.push('No season started yet.');
    (summary.seasons || []).forEach(s => lines.push(seasonName(s.season)+': '+signed(s.start)+' → '+signed(s.end == null ? summary.change : s.end)+' · Cards '+signed(s.cardChange)+' · Hunts '+signed(s.huntChange)));
    lines.push('','Event and hunt history');
    if (!rows.length) lines.push('No events recorded yet.');
    rows.forEach((r,i) => lines.push(seasonName(r.season)+' · '+recordName(r)+' · '+signed(r.change)+' · '+signed(r.population)+' cumulative · '+describeRow(r,i)));
    lines.push('','Investigation question: '+answers.question,'Evidence: '+selectionText(rows),'Explanation: '+answers.claim,'Further test: '+answers.limits);
    return {name:'Serengeti-game-evidence.txt',text:lines.join('\n')};
  }
  function preservedFile() {
    return originalSave === null ? null : {name:'Serengeti-preserved-save.txt',text:originalSave};
  }
  function offerFile(file, status, fallback = null) {
    if (fallback) {
      fallback.hidden = false;
      fallback.querySelector('textarea').value = file.text;
    }
    let url, link, started = false;
    try {
      link = node('a');
      if (!('download' in link)) throw new Error('Download attribute unavailable.');
      url = URL.createObjectURL(new Blob([file.text],{type:'text/plain;charset=utf-8'}));
      link.href = url; link.download = file.name; link.hidden = true;
      status.parentElement.append(link);
      link.click();
      started = true;
    } catch (_) {
      if (fallback) fallback.open = true;
    } finally {
      if (link) link.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url),30000);
    }
    const message = started ? 'Download requested: '+file.name+'. Check your browser’s downloads.'
      : fallback ? 'The download could not start. Copy the text below to keep your work.'
        : 'The download could not start. Your previous save is unchanged; use the copy option in the restart dialog.';
    status.textContent = message;
    // The main live region is outside the modal and inert while it is open.
    if (status.closest('dialog[open]')) status.focus({preventScroll:true});
    else say(message);
  }
  qs('#sg-download').addEventListener('click',()=>offerFile(evidenceFile(),qs('#sg-download-status'),qs('#sg-download-fallback')));
  qs('#sg-restart-download').addEventListener('click',()=>offerFile(preserveRaw ? preservedFile() || evidenceFile() : evidenceFile(),
    qs('#sg-restart-download-status'),qs('#sg-restart-download-fallback')));
  document.querySelectorAll('[data-page]').forEach(el => { el.addEventListener('click', () => openPage(el.dataset.page,true)); });
  Object.keys(fields).forEach(key => {
    const field = qs(fields[key]); field.value = answers[key];
    field.addEventListener(key==='evidence'?'change':'input',() => {
      answers[key]=field.value;
      if(key==='evidence') qs('#sg-selected').textContent=selectionText(state&&state.log);
      save();
    });
  });
  qs('#sg-replay')?.addEventListener('click',()=>qs('#sg-restart').click());
  qs('#sg-restart').addEventListener('click',() => {
    resetConfirm.returnValue = '';
    qs('#sg-restart-download').textContent = preserveRaw ? 'Download preserved save' : 'Download evidence before restarting';
    qs('#sg-restart-download-status').textContent = '';
    const fallback = qs('#sg-restart-download-fallback');
    fallback.hidden = true; fallback.open = false;
    resetConfirm.showModal();
  });
  resetConfirm.addEventListener('close',()=>{
    if (resetConfirm.returnValue!=='restart') return;
    if (preserveRaw) {
      try { localStorage.setItem(S, JSON.stringify({v:1,game:null,answers:BLANK(),page:'play'})); }
      catch (_) { say('Restart could not replace this save. The previous data is still preserved.'); return; }
    }
    state=null; page='play'; optionId=''; chosenPhase=''; answers=BLANK();
    huntReview=null; huntStart=null; huntDetails=Object.create(null); decision=null; cardChangedCells=[];
    preserveRaw=false; originalSave=null;
    Object.keys(fields).forEach(k=>{qs(fields[k]).value='';});
    qs('#sg-download-status').textContent = '';
    const fallback = qs('#sg-download-fallback');
    fallback.hidden = true; fallback.open = false; fallback.querySelector('textarea').value = '';
    openPage('play',false); paint(false); save();
    qs('#sg-start').focus({preventScroll:true}); say('Game reset. Ready to start again.');
  });
  qs('#sg-recover').addEventListener('click',()=>{
    const file = preservedFile();
    if (file) offerFile(file,qs('#sg-save'));
  });
  const toggleMap=qs('#sg-toggle-map'), game=qs('.sg-game');
  toggleMap.addEventListener('click',()=>{
    const collapsed=game.classList.toggle('sg-map-collapsed');
    toggleMap.setAttribute('aria-expanded',String(!collapsed));
    toggleMap.textContent=collapsed?'Show map':'Hide map';
  });
  qs('#sg-help').addEventListener('click',()=>instructions.showModal());
  const theme = qs('#sg-theme'), modes=['auto','light','dark'];
  let mode=document.documentElement.dataset.theme || 'auto';
  const updateTheme=()=>{theme.textContent='Theme: '+mode[0].toUpperCase()+mode.slice(1);};
  updateTheme();
  theme.addEventListener('click',()=>{
    mode=modes[(modes.indexOf(mode)+1)%modes.length];
    if(mode==='auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme=mode;
    try{localStorage.setItem('aplab:pref:theme',mode);}catch(_){}
    updateTheme();
  });
  openPage(page,false);
  paint(false);
})();
