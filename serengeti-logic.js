/* OpenSciEd B.1 Lesson 7: General Game Instructions (pp. 1–6), Event Cards
   (pp. 1–9), Serengeti Game Board and Game Data Collection.
   Board plays with abstract population: the official hunt changes it by -1.
   Cumulative change is relative to the original board (unknown herd sizes).
   Hunts and placement use shared edges (General Instructions pp. 2, 5).
   When the full group cannot fit by edges on the digitized board, a labeled
   digital placement fallback allows corners. We use one shared draw pile. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(() => require('./serengeti-scene').BOARD);
  else root.SerengetiLogic = factory(() => root.SerengetiScene.BOARD);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getBoard) {
  'use strict';
  const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'];
  const ROLES = ['wildebeest', 'hyena', 'lion'];
  const LABELS = { wildebeest: 'Wildebeest', hyena: 'Hyena', lion: 'Lion', individual: 'Individual', smallGroup: 'Small group', herd: 'Herd', clan: 'Clan', pride: 'Pride' };
  const DIE_COUNTS = { individual: 1, smallGroup: 2, herd: 3 };
  const card = (id, title, effect, text) => ({ id, title, effect, text });
  const CARDS = [
    card('old-sick', 'An older wildebeest is caught', 'removeWildebeest', 'A lioness kills a wildebeest that was having trouble keeping up with the herd because it was old and sick. Remove 1 individual wildebeest token from the gameboard.'),
    card('slow-calf', 'A calf falls behind', 'removeWildebeest', 'A small group of spotted hyenas kill a young wildebeest calf that was too slow to keep up with the rest of the herd. Remove one individual wildebeest token from the gameboard.'),
    card('short-grasses', 'Short grass gives a clear view', 'wildebeestFlee', 'A small group of wildebeest grazing in an area where the grasses are short and allow them to easily spot predators. Move one of your small group wildebeest tokens up to 3 spaces away from a predator token.'),
    card('stomping', 'Stomping scares a predator away', 'scare', 'A small group of wildebeest notice a predator approaching, and they display aggressive behaviors like stomping on the ground. They successfully scare away the predator. Pick one spotted hyena or lion token that is near one of your small group wildebeest tokens and move it up to 2 spaces away from your wildebeest token. The predator token must stay within its territory.'),
    card('hyena-cub-dies', 'A hyena cub does not survive', 'removeHyena', 'A spotted hyena cub does not survive. Remove one of the individual hyena tokens from the gameboard.'),
    card('hyena-commute', 'Hyenas travel to find food', 'commute', 'A small group of spotted hyenas commute to find food. You can move one of your small group hyena tokens up to 6 spaces away from its territory for this round only. If you are able to place it next to a wildebeest token, use the hunting rules. Next round, your hyena token needs to return to its original territory.'),
    card('hyena-cub-survives', 'A hyena cub survives', 'addHyena', 'A spotted hyena cub is born and survives despite the high chance that they would die during birth. Add an individual hyena token to any one of your territories.'),
    card('landslide', 'A landslide displaces a clan', 'removeClan', 'A landslide forces a spotted hyena clan to leave their territory. Remove one hyena clan token from the gameboard. Now none of the remaining individual or small group tokens within the territory you removed the token from can hunt.'),
    card('isolated-newborn', 'Hyenas catch an isolated newborn', 'removeWildebeest', 'A small group of spotted hyenas go for a hunt and successfully capture a newborn wildebeest that was isolated from the herd. Remove 1 individual wildebeest token from the gameboard.'),
    card('isolated-adult', 'Lionesses catch a separated adult', 'removeWildebeest', 'A small group of lionesses successfully stalk and take down an adult wildebeest that was separated from the herd. Remove one individual wildebeest token from the gameboard.'),
    card('flood-a', 'Flood displaces a lion pride', 'removePride', 'A flood forces a lion pride to leave their territory. Remove one lion pride clan token from the gameboard. Now none of the remaining individual or small group tokens within the territory you removed the token from can hunt.'),
    card('drought-a', 'Drought brings animals closer', 'lionDrought', 'A drought results in water sources drying up, so predators and prey are more likely to come into contact. Move one of your lion tokens one space closer to a wildebeest token. If you are able to place it next to a wildebeest token, use the hunting rules.'),
    card('flood-b', 'Flood displaces a lion pride', 'removePride', 'A flood forces a lion pride to leave their territory. Remove one lion pride clan token from the gameboard. Now none of the remaining individual or small group tokens within the territory you removed the token from can hunt.'),
    card('drought-b', 'Drought brings animals closer', 'lionDrought', 'A drought results in water sources drying up, so predators and prey are more likely to come into contact. Move one of your lion tokens one space closer to a wildebeest token. If you are able to place it next to a wildebeest token, use the hunting rules.'),
    card('lion-cubs', 'Lionesses give birth', 'addLion', 'Several lionesses give birth to cubs. Add one small group lion token to any one of your territories.'),
    card('lion-stalk', 'Lions stalk through tall grass', 'lionStalk', 'A small group of lions use the grassy landscape to hide as they stalk and sneak up on some wildebeest. Move one of your small group lion tokens 1 space closer to a wildebeest token. If you are able to place your token next to a wildebeest token, use the hunting rules.'),
    card('lion-dies', 'A wildebeest fights back', 'removeLion', 'A lion dies while trying to take down a wildebeest that defended itself. Remove one individual lion token from the game board.')
  ];
  const CARDS_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
  const key = c => c.x + ',' + c.y;
  const name = t => LABELS[t.species] + ' · ' + LABELS[t.type];
  const cellLabel = c => String(c.x + 1) + ', ' + String(c.y + 1);
  const byCell = (a, b) => a.y - b.y || a.x - b.x;
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const nearest = (cell, other) => Math.min(...other.map(c => distance(cell, c)));
  const within = (a, b) => distance(a, b) === 1;
  const clone = value => JSON.parse(JSON.stringify(value));
  let cachedRows, cachedMap;
  function geometry() {
    const rows = getBoard();
    if (rows === cachedRows) return cachedMap;
    const cells = rows.flat().filter(c => c && !c.blocked).map(c => ({ ...c }));
    const cellMap = new Map(cells.map(c => [key(c), c]));
    const adj = c => [[1,0],[-1,0],[0,1],[0,-1]].map(([x,y]) => cellMap.get((c.x+x) + ',' + (c.y+y))).filter(Boolean).sort(byCell);
    const grazingAdj = c => [-1,0,1].flatMap(dy=>[-1,0,1].filter(dx=>dx||dy).map(dx=>cellMap.get((c.x+dx)+','+(c.y+dy)))).filter(Boolean).sort(byCell);
    const territories = {};
    for (const species of ['hyena', 'lion']) {
      const seen = new Set(), groups = [];
      for (const cell of cells.filter(c => c.territory === species).sort(byCell)) {
        if (seen.has(key(cell))) continue;
        const id = species + '-' + (groups.length + 1), group = [], queue = [cell];
        seen.add(key(cell));
        while (queue.length) {
          const current = queue.shift();
          group.push(current);
          current.home = id;
          for (const n of adj(current)) if (n.territory === species && !seen.has(key(n))) { seen.add(key(n)); queue.push(n); }
        }
        groups.push(group.sort(byCell));
      }
      territories[species] = groups;
    }
    cachedRows = rows;
    cachedMap = { cells, cellMap, adj, grazingAdj, territories, grazing: SEASONS.map((_, i) => cells.filter(c => c.season === i && !c.territory).sort(byCell)) };
    return cachedMap;
  }
  function rand(s, size) {
    let x = s.rng >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    s.rng = x >>> 0;
    return Math.floor(s.rng / 4294967296 * size);
  }
  function shuffle(s, values) {
    const out = values.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = rand(s, i + 1); [out[i],out[j]] = [out[j],out[i]]; }
    return out;
  }
  const pos = c => ({ x: c.x, y: c.y });
  function add(s, species, type, cell, territory = null) {
    const token = { id: species[0] + (++s.nextId), species, type, cell: pos(cell), territory };
    s.tokens.push(token);
    return token;
  }
  const of = (s, species, type) => s.tokens.filter(t => t.species === species && (!type || t.type === type));
  const tokenAt = (s, id) => s.tokens.find(t => t.id === id);
  const mapCells = ts => ts.map(t => t.cell);
  const remove = (s, id) => { s.tokens = s.tokens.filter(t => t.id !== id); };
  const free = (s, c, ignore = []) => !s.tokens.some(t => !ignore.includes(t.id) && (key(t.cell) === key(c) || (t.awayFrom && key(t.awayFrom) === key(c))));
  // The official group-to-two-individuals hunt rule implies three animals per small group.
  // No herd size is specified; none are removed by the published loss rules.
  const KNOWN_START = 11 + 3 * 6;
  function population(s) { return of(s,'wildebeest','individual').length + 3 * of(s,'wildebeest','smallGroup').length - KNOWN_START; }
  function log(s, entry) { s.log.push({ season: s.season, change: 0, population: population(s), ...entry }); }
  function component(cells, first, count, depthFirst = false, adjacency = geometry().adj) {
    const available = new Set(cells.map(key)), chosen = [], queue = [first], seen = new Set([key(first)]);
    while (queue.length && chosen.length < count) {
      const c = depthFirst ? queue.pop() : queue.shift();
      chosen.push(c);
      for (const n of adjacency(c)) if (available.has(key(n)) && !seen.has(key(n))) { queue.push(n); seen.add(key(n)); }
    }
    return chosen;
  }
  function placements(s) {
    const ws = of(s,'wildebeest'), ignore = ws.map(t => t.id);
    const available = geometry().grazing[s.season].filter(c => free(s, c, ignore));
    if (!ws.length) return [{ id: 'placement-0', label: 'No surviving wildebeest to move', cells: [] }];
    if (ws.length === 1) return available.slice(0,5).map((c,i)=>({ id:'placement-'+i,label:'Single survivor · square '+cellLabel(c),cells:[pos(c)], singleSurvivor:true }));
    const g = geometry();
    const edgePlans = placementPlans(available, ws.length, g.adj, false);
    return edgePlans.length ? edgePlans : placementPlans(available, ws.length, g.grazingAdj, true);
  }
  function placementPlans(available, count, adjacency, cornerFallback) {
    const unique = new Set(), plans = [];
    const groups = [], placed = new Set();
    for (const c of available) {
      if (placed.has(key(c))) continue;
      const group = component(available,c,available.length,false,adjacency);
      group.forEach(x=>placed.add(key(x)));
      if (group.length>=2) groups.push(group);
    }
    function divide(sortedGroups, left, at = 0) {
      if (!left) return [];
      if (at === sortedGroups.length) return null;
      const max = Math.min(sortedGroups[at].length,left);
      for (let n=max;n>=0;n--) {
        if (n===1 || left-n===1) continue;
        const tail=divide(sortedGroups,left-n,at+1);
        if(tail) return [n,...tail];
      }
      return null;
    }
    for (let order = 0; order < groups.length; order++) {
      const preference=groups.slice(order).concat(groups.slice(0,order)), counts=divide(preference,count);
      if(!counts) continue;
      for(const deep of [false,true]) for (const alternate of [false,true]) {
        const cells=counts.flatMap((n,i)=>n?component(preference[i],alternate?preference[i].at(-1):preference[i][0],n,deep,adjacency):[]);
        const set=cells.map(key).sort().join('|');
        if (cells.length !== count || unique.has(set)) continue;
        unique.add(set);
        plans.push({ id:'placement-'+plans.length, label:'Placement '+(plans.length+1)+' · starts near '+cellLabel(cells[0])+(cornerFallback?' · corner-contact fallback':''), cells:cells.map(pos), cornerFallback });
        if(plans.length>=5) return plans;
      }
    }
    return plans;
  }
  function create(seed = 1) {
    const rng = (Number(seed) >>> 0) || 0x9e3779b9;
    const s = { version: 1, seed: rng, rng, season: 0, step: 'migration', nextId: 0, deck: [], cardIndex: 0, cardId: null, tokens: [], log: [], seasons: [], battle: null, usedPairs: [], eventHunter: null, moved: [], huntRole: null, lastBattle: null };
    const g = geometry();
    for (const [species, anchor, individuals, groups] of [['hyena','clan',8,5],['lion','pride',7,7]]) {
      const homes = g.territories[species];
      for (const territory of homes) add(s, species, anchor, territory[0], territory[0].home);
      const rest = shuffle(s, homes.flatMap(territory => territory.slice(1)));
      if (rest.length < individuals + groups) throw new Error('Predator territory cannot hold the official setup.');
      for (let i = 0; i < individuals + groups; i++) add(s, species, i < groups ? 'smallGroup' : 'individual', rest[i], rest[i].home);
    }
    const winter = g.grazing[0];
    const positions = winter.map(c => component(winter,c,21)).find(arr => arr.length === 21);
    if (!positions) throw new Error('Winter grazing territory cannot hold the official setup.');
    const kinds = shuffle(s, Array(11).fill('individual').concat(Array(6).fill('smallGroup'),Array(4).fill('herd')));
    positions.forEach((c,i) => add(s,'wildebeest',kinds[i],c));
    s.deck = shuffle(s,CARDS.map(c=>c.id));
    s.seasons[0] = { season: 0, start: population(s), end: null };
    return s;
  }
  function eligible(s, t) {
    if (!t || !['individual','smallGroup'].includes(t.type) || t.species === 'wildebeest') return false;
    return of(s,t.species,t.species === 'hyena' ? 'clan' : 'pride').some(a => a.territory === t.territory);
  }
  function reachable(s, start, radius, allows = () => true) {
    const { adj } = geometry(), found = [], visited = new Set([key(start)]), queue = [[start, 0]];
    while (queue.length) {
      const [c, d] = queue.shift();
      if (d === radius) continue;
      for (const n of adj(c)) {
        if (visited.has(key(n)) || !allows(n) || !free(s,n)) continue;
        visited.add(key(n)); queue.push([n,d+1]); found.push(n);
      }
    }
    return found;
  }
  function option(id, label, data = {}) { return { id, label, ...data }; }
  const moveOption = (t,c) => option(t.id+':'+key(c), name(t)+' at '+cellLabel(t.cell)+' → '+cellLabel(c), { tokenId:t.id,to:pos(c) });
  const removeOption = t => option(t.id, name(t)+' at '+cellLabel(t.cell), { tokenId:t.id });
  function cardOptions(s, c) {
    const tokens = s.tokens, wb = of(s,'wildebeest'), prey = mapCells(wb);
    const { cells } = geometry();
    const targets = {
      removeWildebeest: ['wildebeest','individual'], removeHyena:['hyena','individual'],
      removeLion:['lion','individual'], removeClan:['hyena','clan'], removePride:['lion','pride']
    }[c.effect];
    if (targets) return of(s,...targets).map(removeOption);
    if (c.effect === 'addHyena' || c.effect === 'addLion') {
      const species = c.effect === 'addHyena' ? 'hyena' : 'lion';
      return cells.filter(x=>x.territory===species && free(s,x)).map(x=>option(key(x), LABELS[species]+' territory · square '+cellLabel(x), { to:pos(x), territory:x.home }));
    }
    if (c.effect === 'wildebeestFlee') {
      const predators = mapCells(tokens.filter(t=>t.species!=='wildebeest'));
      return of(s,'wildebeest','smallGroup').flatMap(t=>reachable(s,t.cell,3,x=>x.season===s.season && !x.territory)
        .filter(x=>predators.length && nearest(x,predators)>nearest(t.cell,predators)).map(x=>moveOption(t,x)));
    }
    if (c.effect === 'scare') {
      const groups = mapCells(of(s,'wildebeest','smallGroup'));
      return tokens.filter(t=>t.species!=='wildebeest' && nearest(t.cell,groups)<=2 && !t.awayFrom)
        .flatMap(t=>reachable(s,t.cell,2,x=>x.home===t.territory)
          .filter(x=>nearest(x,groups)>nearest(t.cell,groups)).map(x=>moveOption(t,x)));
    }
    if (c.effect === 'commute') {
      const paths = of(s,'hyena','smallGroup').filter(t=>eligible(s,t)&&!t.awayFrom).flatMap(t=>{
        const home = cells.filter(x=>x.home===t.territory);
        return reachable(s,t.cell,6).filter(x=>x.home!==t.territory && nearest(x,home)<=6)
          .sort((a,b)=>nearest(a,prey)-nearest(b,prey)||byCell(a,b)).map(x=>moveOption(t,x));
      });
      return paths.sort((a,b)=>nearest(a.to,prey)-nearest(b.to,prey)).concat(option('stay','Do not move a token'));
    }
    if (c.effect === 'lionDrought' || c.effect === 'lionStalk') {
      return of(s,'lion',c.effect==='lionStalk'?'smallGroup':undefined).flatMap(t=>reachable(s,t.cell,1,x=>x.home===t.territory)
        .filter(x=>nearest(x,prey)<nearest(t.cell,prey)).map(x=>moveOption(t,x)));
    }
    return [];
  }
  function predatorMoves(s, role) {
    const prey = mapCells(of(s,'wildebeest'));
    return of(s,role).filter(t=>eligible(s,t)&&!s.moved.includes(t.id)&&!t.awayFrom).flatMap(t =>
      reachable(s,t.cell,1,x=>x.home===t.territory).filter(x=>nearest(x,prey)<nearest(t.cell,prey)).map(x=>moveOption(t,x)));
  }
  function candidateHunts(s, role, singleId = null) {
    return of(s,role).filter(t=>eligible(s,t)&&(!singleId||t.id===singleId)).flatMap(p =>
      of(s,'wildebeest').filter(w=>within(p.cell,w.cell) && !s.usedPairs.includes(p.id+':'+w.id))
        .map(w=>({ predatorId:p.id, preyId:w.id, predatorName:name(p), preyName:name(w), predatorType:p.type, preyType:w.type,
          predatorCell:p.cell, preyCell:w.cell, predatorDice:DIE_COUNTS[p.type], preyDice:DIE_COUNTS[w.type], rounds:[] })));
  }
  function activeCandidate(s) { return candidateHunts(s,s.huntRole,s.eventHunter)[0] || null; }
  function phase(s) {
    if (s.step==='complete') return { kind:'complete' };
    if (s.step==='migration') return { kind:'migration',options:placements(s) };
    if (s.step==='card') {
      const c = s.cardId ? CARDS_BY_ID[s.cardId] : null;
      return { kind:'card', role:ROLES[(s.cardIndex - (c ? 1 : 0)) % ROLES.length], card:c, options:c ? cardOptions(s,c) : [] };
    }
    if (s.step==='move') return { kind:s.huntRole==='hyena'?'hyenaMove':'lionMove', role:s.huntRole, options:predatorMoves(s,s.huntRole) };
    if (s.step==='hunt') {
      const battle = s.battle || activeCandidate(s);
      return { kind:'hunt', role:s.huntRole, battle, event:s.eventHunter!==null, canRoll:!!battle, lastBattle:s.lastBattle };
    }
    return { kind:'seasonEnd', lastBattle:s.lastBattle };
  }
  function settleHuntPhase(s) {
    if (activeCandidate(s)) return;
    if (s.eventHunter) {
      s.eventHunter=null; s.usedPairs=[]; s.huntRole=null;
      nextCard(s);
    } else if (s.huntRole==='hyena') {
      s.huntRole='lion'; s.step='move'; s.moved=[]; s.usedPairs=[];
    } else { s.step='seasonEnd'; s.seasons[s.season].end=population(s); }
  }
  function nextCard(s) {
    s.cardId=null;
    if (s.cardIndex % ROLES.length === 0) { s.huntRole='hyena'; s.step='move'; s.moved=[]; }
    else s.step='card';
  }
  const sorted = dice => dice.slice().sort((a,b)=>b-a);
  function compareDice(predator, prey) {
    const pd=sorted(predator), wd=sorted(prey), pairs=[];
    let predatorRemaining=pd.length, preyRemaining=wd.length;
    for (let i=0;i<Math.min(pd.length,wd.length);i++) {
      const winner=pd[i]===wd[i]?'tie':pd[i]>wd[i]?'predator':'prey';
      pairs.push({predator:pd[i],prey:wd[i],winner});
      if(winner==='prey') predatorRemaining--;
      if(winner==='predator') preyRemaining--;
    }
    return {predator:pd,prey:wd,pairs,predatorRemaining,preyRemaining};
  }
  function lostOne(s, attackedId) {
    const individuals = of(s,'wildebeest','individual');
    const individual = individuals.find(t=>t.id===attackedId) || individuals[0];
    if (individual) { remove(s,individual.id); return { removedId:individual.id, description:'Removed one individual wildebeest.' }; }
    const groups = of(s,'wildebeest','smallGroup');
    const group = groups.find(t=>t.id===attackedId) || groups[0];
    if (group) {
      const another = geometry().grazing[s.season].filter(x=>free(s,x)).sort((a,b)=>distance(a,group.cell)-distance(b,group.cell)||byCell(a,b))[0];
      if (another) {
        remove(s,group.id); add(s,'wildebeest','individual',group.cell); add(s,'wildebeest','individual',another);
        return { removedId:group.id, description:'Replaced one small group with two individual wildebeest.' };
      }
    }
    return { removedId:null, description:'No legal removal is specified for the remaining tokens. The board stays unchanged.' };
  }
  function resolveEvent(s,c,selection) {
    const before=population(s);
    let description='No legal target was available.', hunting=null;
    if (selection && selection.id!=='stay') {
      if (c.effect.startsWith('remove')) {
        const t=tokenAt(s,selection.tokenId);
        remove(s,t.id); description='Removed '+name(t).toLowerCase()+' at '+cellLabel(t.cell)+'.';
      } else if (c.effect.startsWith('add')) {
        const species=c.effect==='addHyena'?'hyena':'lion', t=add(s,species,species==='hyena'?'individual':'smallGroup',selection.to,selection.territory);
        description='Added '+name(t).toLowerCase()+' at '+cellLabel(t.cell)+'.';
      } else {
        const t=tokenAt(s,selection.tokenId);
        if(c.effect==='commute') t.awayFrom=pos(t.cell);
        t.cell=selection.to; description=name(t)+' moved to square '+cellLabel(t.cell)+'.';
        if(['commute','lionDrought','lionStalk'].includes(c.effect) && eligible(s,t) && of(s,'wildebeest').some(w=>within(w.cell,t.cell))) hunting=t;
      }
    } else if(selection?.id==='stay') description='No token moved.';
    log(s,{kind:'card',role:ROLES[(s.cardIndex-1)%ROLES.length],cardId:c.id,title:c.title,description,change:population(s)-before});
    if(hunting) { s.step='hunt'; s.huntRole=hunting.species; s.eventHunter=hunting.id; s.usedPairs=[]; }
    else nextCard(s);
  }
  function act(original, action) {
    const s=clone(original), p=phase(s), { type, optionId }=action || {};
    const choices=p.options || [], choice=optionId===undefined?choices[0]:choices.find(x=>x.id===optionId);
    if(optionId!==undefined && !choice) throw new Error('That choice is unavailable.');
    if(p.kind==='migration' && type==='migrate') {
      if(!choice) throw new Error('No connected placement is available in this season.');
      of(s,'wildebeest').forEach((t,i)=>{t.cell=choice.cells[i];});
      const placementNote = choice.cornerFallback ? ' The digitized range cannot fit all surviving tokens with edge contact, so this draft allows corner contact here.' : choice.singleSurvivor ? ' The only surviving token cannot touch another.' : '';
      const summary = s.season===0?'The herd begins in its winter grazing area.':'The surviving wildebeest move into their '+SEASONS[s.season].toLowerCase()+' grazing area.';
      log(s,{kind:'migration',role:'wildebeest',title:s.season===0?'Winter setup':'Wildebeest migration',description:summary+placementNote,cornerFallback:!!choice.cornerFallback});
      s.step='card';
    } else if(p.kind==='card' && type==='draw' && !p.card) {
      s.cardId=s.deck[s.cardIndex++];
      if(!s.cardId) throw new Error('The event pile is empty.');
    } else if(p.kind==='card' && type==='resolveCard' && p.card) {
      resolveEvent(s,p.card,choice);
    } else if(['hyenaMove','lionMove'].includes(p.kind) && type==='movePredator' && choice) {
      const t=tokenAt(s,choice.tokenId); t.cell=choice.to; s.moved.push(t.id);
    } else if(['hyenaMove','lionMove'].includes(p.kind) && type==='beginHunts') {
      s.step='hunt'; s.usedPairs=[]; s.lastBattle=null; settleHuntPhase(s);
    } else if(p.kind==='hunt' && type==='roll' && p.battle) {
      const b=s.battle || { ...p.battle, rounds:[] };
      const dice=n=>Array.from({length:n},()=>1+rand(s,6));
      const row=compareDice(dice(b.predatorDice),dice(b.preyDice));
      b.rounds.push(row); b.predatorDice=row.predatorRemaining; b.preyDice=row.preyRemaining;
      if(b.predatorDice && b.preyDice) s.battle=b;
      else {
        const winner=b.predatorDice?'predator':'prey', before=population(s);
        const removal=winner==='predator'?lostOne(s,b.preyId):{removedId:null,description:'The wildebeest escapes. No tokens move.'};
        s.lastBattle={...b,winner,change:population(s)-before,...removal};
        log(s,{kind:'hunt',role:s.huntRole,predatorSpecies:s.huntRole,preyType:b.preyType,predatorType:b.predatorType,
          winner,title:LABELS[s.huntRole]+' hunt · '+(winner==='prey'?'prey escapes':'predator succeeds'),
          description:removal.description,change:s.lastBattle.change,attackedId:b.preyId,removedId:removal.removedId,rounds:b.rounds});
        s.battle=null; s.usedPairs.push(b.predatorId+':'+b.preyId); settleHuntPhase(s);
      }
    } else if(p.kind==='seasonEnd' && type==='nextSeason') {
      if(s.season===3) s.step='complete';
      else {
        s.season++; s.seasons[s.season]={season:s.season,start:population(s),end:null};
        for(const t of of(s,'hyena')) if(t.awayFrom) { t.cell=t.awayFrom; delete t.awayFrom; }
        s.step='migration'; s.lastBattle=null; s.moved=[]; s.usedPairs=[]; s.huntRole=null;
      }
    } else throw new Error('That action is not available.');
    return s;
  }
  function results(s) {
    const seasons=s.seasons.map(v=>{
      const rows=s.log.filter(r=>r.season===v.season), total=kind=>rows.filter(x=>x.kind===kind).reduce((n,x)=>n+x.change,0);
      return {...v,cardChange:total('card'),huntChange:total('hunt'),
        hyenaWins:rows.filter(x=>x.role==='hyena'&&x.winner==='predator').length,
        lionWins:rows.filter(x=>x.role==='lion'&&x.winner==='predator').length};
    });
    return {population:population(s),seasons,change:population(s)-s.seasons[0].start,
      groups:Object.fromEntries(['individual','smallGroup','herd'].map(type=>[type,of(s,'wildebeest',type).length]))};
  }
  function restore(raw) {
    try {
      const s=typeof raw==='string'?JSON.parse(raw):clone(raw);
      if(!s||s.version!==1||!Number.isInteger(s.season)||s.season<0||s.season>3||
        !['migration','card','move','hunt','seasonEnd','complete'].includes(s.step)||
        !Number.isInteger(s.rng)||!Array.isArray(s.tokens)||!Array.isArray(s.log)||!Array.isArray(s.seasons)||
        !Array.isArray(s.deck)||s.deck.length!==CARDS.length||new Set(s.deck).size!==CARDS.length||
        s.deck.some(id=>!CARDS_BY_ID[id])||s.tokens.some(t=>!ROLES.includes(t.species)||!LABELS[t.type]||!geometry().cellMap.has(key(t.cell)))) return null;
      return s;
    } catch (_) { return null; }
  }
  return {SEASONS,ROLES,LABELS,CARDS,create,restore,phase,act,results,compareDice};
});
