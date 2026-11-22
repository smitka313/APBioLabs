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
  let currentMoveToken = '', lastLogLength = 0, scene = null, currentOptions = [];
  const app = qs('#sg-play'), shape = qs('#sg-scene');
  const resetConfirm = qs('#sg-confirm'), instructions = qs('#sg-instructions');
  const currentCellOptions = x => x && (x.to || x.cell || x.position || (x.cells && x.cells[0]));

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
    }
  } catch (_) {
    if (originalSave !== null) preserveRaw = true;
    else saveUnavailable = true;
  }
  let sample = L.create(32737);
  if (window.SerengetiScene && typeof window.SerengetiScene.mount === 'function') {
    try { scene = window.SerengetiScene.mount(shape, {onCell: selectByCell}); } catch (_) { scene = null; }
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
      localStorage.setItem(S, JSON.stringify({v:1,game:state,answers,page}));
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
  function selectByCell(x,y) {
    if (!state) return;
    if (x && typeof x === 'object') { y = x.y; x = x.x; }
    const g = currentOptions.find(o => {
      const cell = currentCellOptions(o);
      const token = state.tokens.find(t => t.id === o.tokenId);
      return cell ? cell.x === x && cell.y === y : token && token.cell.x === x && token.cell.y === y;
    });
    if (!g) return;
    optionId = g.id;
    currentMoveToken = g.tokenId || '';
    paint(false);
    const input = qs('#sg-options');
    if (input) input.focus({preventScroll:true});
    say('Selected ' + g.label + '. Confirm with the turn button.');
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
    const before = state;
    try { state = L.act(state, choice == null || choice === '' ? {type} : {type, optionId: choice}); }
    catch (_) { state = before; say('That move is not available. Choose a listed option.'); return; }
    if (!state || state === before) { state = before; say('That move is not available now.'); return; }
    optionId = ''; currentMoveToken = '';
    save();
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
  const outcomeText = winner => {
    if (winner === 'prey' || winner === 'wildebeest') return 'Wildebeest escaped';
    if (winner === 'predator') return 'Predator succeeded';
    return winner && LABEL[winner] ? LABEL[winner] + ' succeeded' : '';
  };
  function describeRow(entry) {
    if (!entry) return '';
    const extras = [entry.preyType && 'Wildebeest: ' + tokenType(entry.preyType),
      entry.predatorType && (SINGULAR[entry.predatorSpecies || entry.role] || 'Predator') + ': ' + tokenType(entry.predatorType),
      outcomeText(entry.winner)].filter(Boolean);
    return [entry.description || '', ...extras].filter(Boolean).join(' · ');
  }
  function rawSummary() { return state ? L.results(state) : {population:null,seasons:[]}; }
  function paint(announce) {
    const st = state || sample;
    const p = state ? L.phase(state) : {kind:'setup'};
    const activeRole = p.role || {migration:'wildebeest',hyenaMove:'hyena',lionMove:'lion'}[p.kind] || null;
    const last = state && state.log.length ? state.log[state.log.length - 1] : null;
    const newRow = state && state.log.length > lastLogLength;
    qs('#sg-evidence-count').textContent = state ? state.log.length : 0;
    const season = Number.isInteger(st.season) ? st.season : 0;
    const key = [p.kind, season, activeRole, p.card && p.card.id].join(':');
    if (chosenPhase !== key) { optionId = ''; currentMoveToken = ''; chosenPhase = key; }
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
    qs('#sg-board-caption').textContent = 'Season ' + (season + 1) + ' of 4 · Markers represent individuals, small groups, herds, clans or prides.';
    qs('#sg-metrics').replaceChildren(...[['Wildebeest tokens',currentPrey.length],['Individuals',currentPrey.filter(t=>t.type==='individual').length],['Small groups',currentPrey.filter(t=>t.type==='smallGroup').length],['Herds',currentPrey.filter(t=>t.type==='herd').length]].map(([label,count]) => {
      const v = node('div','sg-stat'); v.append(node('strong','',count),node('span','',label)); return v;
    }));
    const legalCells = currentOptions.map(o => currentCellOptions(o) || (tokens.find(t => t.id === o.tokenId) || {}).cell).filter(Boolean);
    const selected = currentOptions.find(o => o.id === optionId);
    const battle = p.battle || st.battle;
    const lastBattle = last && last.kind === 'hunt' ? st.lastBattle : null;
    const pos = battle && (tokens.find(t => t.id === battle.preyId) || {}).cell;
    const predPos = battle && (tokens.find(t => t.id === battle.predatorId) || {}).cell;
    qs('#sg-board-access').textContent = p.kind === 'hunt' && battle ? 'The highlighted wildebeest token is involved in the current hunt.' : currentOptions.length ? 'Choose a marked square or use the turn controls.' : 'Each token’s marker identifies the type of group.';
    if (scene) scene.update({stage:p.kind, season, tokens, predatorPosition:predPos, herd:currentPrey.filter(t=>t.type==='herd').length,
      legalCells, selected:currentCellOptions(selected), position:pos, wet:season===0 || season===1,
      grass:currentPrey.length, reveal:p.kind === 'hunt'});
    const interact = qs('#sg-interactive'), actions = qs('#sg-actions'), dice = qs('#sg-dice');
    interact.replaceChildren(); actions.replaceChildren(); dice.replaceChildren(); dice.hidden = true;
    app.dataset.phase = p.kind;
    let title = '', desc = '', phaseLabel = '', note = '';
    const advance = (label,type) => actions.append(button('sg-next',label,()=>run(type, optionId),null,type));

    if (p.kind === 'setup') {
      phaseLabel = 'Set up'; title = 'One device, three roles';
      desc = 'Assign one role to each player or team. You will collect evidence together, not compete for an overall winner.';
      const list = node('div','sg-card');
      list.append(node('h3','','A year in the ecosystem'),node('p','','Set up in winter, then play four seasons: migrate, draw three cards, and resolve hyena and lion hunts.'));
      interact.append(list);
      actions.append(button('sg-start','Start winter', () => { state=L.create(freshSeed()); optionId=''; chosenPhase=''; save(); paint(true); (qs('#sg-next') || qs('#sg-action-title')).focus({preventScroll:true}); },null,'start'));
    } else if (p.kind === 'migration') {
      phaseLabel = '1 · Migration'; title = season === 0 ? 'Place the winter herd' : 'Move to the ' + seasonName(season).toLowerCase() + ' range';
      desc = season === 0 ? 'Place the starting wildebeest tokens in the winter range.' : 'Move the surviving wildebeest into this season’s range.';
      if (currentOptions.length) interact.append(chooser(currentOptions,'Legal placement'));
      advance(season === 0 ? 'Place winter herd' : 'Migrate wildebeest','migrate');
      note = currentOptions.some(o => o.cornerFallback) ? 'Board-fit exception: a corner may count as touching when side-by-side placements do not fit.' : currentPrey.length === 1 ? 'Only one wildebeest token survives, so it has no neighbor.' : currentPrey.length === 0 ? 'No wildebeest tokens remain to migrate.' : 'Each token shares a side with another; separate groups are allowed.';
    } else if (p.kind === 'card') {
      phaseLabel = '2 · Event cards'; title = p.card ? (p.card.title || 'Read and apply the card') : roleName(activeRole) + ' draw a card';
      desc = p.card ? 'Apply this event even when it affects a different role.' : 'Pass the device to this role to reveal the next event.';
      if (p.card) {
        const c = node('article','sg-card');
        c.append(node('h3','', 'Drawn by ' + roleName(activeRole)),node('p','',p.card.text || p.card.description || p.card.body || p.card.title || ''));
        interact.append(c);
        if (currentOptions.length) interact.append(chooser(currentOptions,'Choose how to apply it'));
      }
      advance(p.card ? 'Apply event' : 'Draw event card', p.card ? 'resolveCard' : 'draw');
    } else if (p.kind === 'hyenaMove' || p.kind === 'lionMove') {
      phaseLabel = activeRole === 'hyena' ? '3 · Hyenas hunt' : '4 · Lions hunt';
      title = 'Check ' + (activeRole === 'hyena' ? 'hyena' : 'lion') + ' positions';
      desc = 'Only eligible individual or small-group tokens beside wildebeest can hunt. Clans and prides do not roll.';
      if (currentOptions.length) {
        interact.append(chooser(currentOptions,'Optional one-space move'));
        actions.append(button('sg-move','Use selected move',()=>run('movePredator',optionId || currentOptions[0].id),'sg-plain','movePredator'));
      }
      actions.append(button('sg-next','Begin ' + (activeRole === 'hyena' ? 'hyena' : 'lion') + ' hunts',()=>run('beginHunts'),null,'beginHunts'));
      note = 'You can leave tokens where they are and begin hunting.';
    } else if (p.kind === 'hunt') {
      phaseLabel = p.event ? '2 · Event-card hunt' : activeRole === 'hyena' ? '3 · Hyenas hunt' : '4 · Lions hunt';
      title = 'Resolve a hunt';
      const prey = battle && tokens.find(t=>t.id===battle.preyId);
      const pred = battle && tokens.find(t=>t.id===battle.predatorId);
      const species = pred && pred.species || activeRole;
      if (species) title = SINGULAR[species] + ' vs. wildebeest';
      const rounds = battle && Array.isArray(battle.rounds) ? battle.rounds : [];
      desc = [pred && tokenType(pred.type), prey && 'wildebeest ' + tokenType(prey.type).toLowerCase()].filter(Boolean).join(' against ') || 'Compare the predator and wildebeest dice, highest to lowest.';
      const showFinalRoll = lastBattle && !rounds.length;
      paintDice(showFinalRoll ? lastBattle : battle, showFinalRoll ? last.role : species, dice, showFinalRoll);
      if (currentOptions.length) interact.append(chooser(currentOptions,'Choose the next eligible hunt'));
      advance(rounds.length ? 'Roll remaining dice' : 'Roll hunt dice','roll');
      note = 'Lower dice are removed; ties and unmatched dice stay.';
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
    if (lastBattle && p.kind !== 'complete' && !(battle && battle.rounds && battle.rounds.length)) {
      if (p.kind !== 'hunt') paintDice(lastBattle, last.role, dice, true);
      note = (outcomeText(last.winner) || last.title || 'Hunt recorded') + ' · Wildebeest ' + signed(last.change) + '. ' + note;
    }
    qs('#sg-phase').textContent = phaseLabel;
    qs('#sg-action-title').textContent = title;
    qs('#sg-action-copy').textContent = desc;
    qs('#sg-turn-note').textContent = note;
    qs('#sg-last').textContent = last ? seasonName(last.season) + ' · ' + (last.title || roleName(last.role)) + ' · Wildebeest ' + signed(last.change) + ' · ' + signed(last.population) + ' cumulative' : 'Completed events and hunts will appear here.';
    if (state) lastLogLength = state.log.length;
    if (announce) say(newRow ? qs('#sg-last').textContent + '. ' + title : title + '. ' + desc);
    if (page !== 'play') renderEvidence();
  }
  function chooser(options, title) {
    const wrap = node('label','sg-chooser',title);
    const menu = node('select'); menu.id = 'sg-options';
    if (options.length) menu.append(node('option','','Use suggested option'));
    if (menu.firstElementChild) menu.firstElementChild.value = '';
    options.forEach(o => {
      const e = node('option','',o.label || o.id); e.value = o.id; menu.append(e);
    });
    menu.value = options.some(o => o.id === optionId) ? optionId : '';
    menu.addEventListener('change', () => {
      optionId = menu.value;
      const found = options.find(o => o.id === optionId);
      currentMoveToken = found && found.tokenId || '';
    });
    wrap.append(menu);
    return wrap;
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
    if (finished) el.append(node('p','sg-kicker','Previous hunt · final roll'));
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
  function renderEvidence() {
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
        const desc = describeRow(r);
        if (desc) li.append(node('p','',desc));
        list.append(li);
      });
      log.append(list);
    } else log.append(node('p','','Play a turn to begin recording evidence.'));
    es.replaceChildren(overview,log);
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
    const desc = describeRow(r);
    return 'Cumulative change: ' + signed(before) + ' → ' + signed(r.population) + ' (event change ' + signed(r.change) + ').' + (desc ? ' ' + desc : '');
  }
  function downloadWork() {
    const rows = state ? state.log : [];
    const summary = rawSummary();
    const lines = ['Serengeti Board Game · Lesson 7','SIMULATED; evidence shows cumulative change from the starting population, not field counts.','','Season totals'];
    (summary.seasons || []).forEach(s => lines.push(seasonName(s.season)+': '+signed(s.start)+' → '+signed(s.end == null ? summary.change : s.end)+' · Cards '+signed(s.cardChange)+' · Hunts '+signed(s.huntChange)));
    lines.push('','Event and hunt history');
    rows.forEach(r => lines.push(seasonName(r.season)+' · '+recordName(r)+' · '+signed(r.change)+' · '+signed(r.population)+' cumulative · '+describeRow(r)));
    lines.push('','Investigation question: '+answers.question,'Evidence: '+selectionText(rows),'Explanation: '+answers.claim,'Further test: '+answers.limits);
    const url = URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));
    const a = node('a'); a.href=url; a.download='Serengeti-game-evidence.txt';
    document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.querySelectorAll('[data-page]').forEach(el => { el.addEventListener('click', () => openPage(el.dataset.page,true)); });
  Object.keys(fields).forEach(key => {
    const field = qs(fields[key]); field.value = answers[key];
    field.addEventListener(key==='evidence'?'change':'input',() => {
      answers[key]=field.value;
      if(key==='evidence') qs('#sg-selected').textContent=selectionText(state&&state.log);
      save();
    });
  });
  qs('#sg-restart').addEventListener('click',() => { resetConfirm.returnValue = ''; resetConfirm.showModal(); });
  resetConfirm.addEventListener('close',()=>{
    if (resetConfirm.returnValue!=='restart') return;
    if (preserveRaw) {
      try { localStorage.setItem(S, JSON.stringify({v:1,game:null,answers:BLANK(),page:'play'})); }
      catch (_) { say('Restart could not replace this save. The previous data is still preserved.'); return; }
    }
    state=null; page='play'; lastLogLength=0; optionId=''; chosenPhase=''; answers=BLANK();
    preserveRaw=false; originalSave=null;
    Object.keys(fields).forEach(k=>{qs(fields[k]).value='';});
    openPage('play',false); paint(false); save();
    qs('#sg-start').focus({preventScroll:true}); say('Game reset. Ready to start again.');
  });
  qs('#sg-recover').addEventListener('click',()=>{
    if (originalSave === null) return;
    const url = URL.createObjectURL(new Blob([originalSave],{type:'text/plain;charset=utf-8'}));
    const a=node('a');a.href=url;a.download='Serengeti-preserved-save.txt';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
