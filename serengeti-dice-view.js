/* Hunt dice presentation only. Reads the engine's sorted comparisons; never rolls or changes game state. */
(function (root) {
  'use strict';
  const PIPS = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  const ANIM = 'data-dice-animate';
  const sourceViews = new WeakMap(), mirrorViews = new WeakMap();
  let pending = false, rollId = 0;
  function markRoll() { pending = true; }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function make(doc, tag, classes, text) {
    const e = doc.createElement(tag);
    if (classes) e.className = classes;
    if (text != null) e.textContent = text;
    return e;
  }
  function label(side, species) {
    if (side === 'prey') return 'Wildebeest';
    return species === 'hyena' ? 'Hyena' : species === 'lion' ? 'Lion' : 'Predator';
  }
  function outcome(round, side, index) {
    if (!round) return 'ready';
    const pair = round.pairs && round.pairs[index];
    if (!pair) return 'unmatched';
    if (pair.winner === 'tie') return 'tie';
    return pair.winner === side ? 'kept' : 'removed';
  }
  const descriptions = {kept:'higher, kept', removed:'lower, removed', tie:'tied, kept', unmatched:'unmatched, kept'};
  const symbols = {kept:'✓', removed:'×', tie:'=', unmatched:'·'};
  function face(doc, side, value, result, index, animate) {
    const die = make(doc,'span','sg-die sg-pip-die');
    die.dataset.side = side;
    die.dataset.result = result;
    die.dataset.dieIndex = String(index);
    if (result === 'removed') die.dataset.out = 'yes';
    die.setAttribute('role','img');
    die.setAttribute('aria-label',value == null ? 'Die ready' : String(value) + ', ' + descriptions[result]);
    if (animate) die.setAttribute(ANIM,'');
    if (value == null) {
      const ready = make(doc,'span','sg-die-ready','?');
      ready.setAttribute('aria-hidden','true');
      die.append(ready);
    } else {
      die.dataset.value = String(value);
      const art = make(doc,'span','sg-die-pips');
      art.setAttribute('aria-hidden','true');
      for (const position of PIPS[value] || []) {
        const pip = make(doc,'i','sg-die-pip');
        pip.style.gridArea = (1 + Math.floor(position / 3)) + ' / ' + (1 + position % 3);
        art.append(pip);
      }
      die.append(art);
      const number = make(doc,'span','sg-visually-hidden',value);
      number.setAttribute('aria-hidden','true'); // kept in DOM for study/extraction; role=img owns the spoken label.
      die.append(number);
      const badge = make(doc,'span','sg-die-mark',symbols[result]);
      badge.setAttribute('aria-hidden','true'); die.append(badge);
    }
    return die;
  }
  function makeSide(doc, side, battle, round, species, animate) {
    const row = make(doc,'div','sg-dice-row');
    const caption = make(doc,'b','',label(side,species));
    const tray = make(doc,'div','sg-dice-track');
    const count = side === 'prey' ? battle.preyDice : battle.predatorDice;
    const values = round && Array.isArray(round[side]) ? round[side] : Array.from({length:Math.max(0,Math.min(3,Number(count)||0))},()=>null);
    values.forEach((value,i)=>tray.append(face(doc,side,value,outcome(round,side,i),i,animate)));
    row.append(caption,tray); return row;
  }
  function comparisons(doc, round, species) {
    const list = make(doc,'ul','sg-dice-comparisons');
    list.setAttribute('aria-label','Matched dice comparisons');
    (round.pairs || []).forEach(a => {
      let content;
      if (a.winner === 'tie') content = a.prey + ' = ' + a.predator + ': both kept';
      else {
        const winningNum = a[a.winner], losingNum = a[a.winner === 'prey' ? 'predator' : 'prey'];
        content = label(a.winner,species) + ' ' + winningNum + ' beats ' + losingNum;
      }
      const item = make(doc,'li','sg-dice-comparison',content);
      item.dataset.result = a.winner;
      list.append(item);
    });
    const unmatched = Math.abs(round.prey.length - round.predator.length);
    if (unmatched) list.append(make(doc,'li','sg-dice-comparison',unmatched+' unmatched '+(unmatched===1?'die stays':'dice stay')));
    return list;
  }
  function render(target,{battle,species,finished=false,season=0}={}) {
    if (!target || !battle) return;
    const rows = Array.isArray(battle.rounds) ? battle.rounds : [];
    const round = rows[rows.length-1];
    const fresh = pending && !!round;
    if (fresh) { pending = false; rollId += 1; }
    const doc = target.ownerDocument;
    const key = JSON.stringify([season,battle.predatorId,battle.preyId,species,finished,rows.length,round,battle.predatorDice,battle.preyDice]);
    const previous = sourceViews.get(target);
    target.hidden = false;
    target.setAttribute('data-dice-view','');
    if (!fresh && previous && previous.key === key && target.firstElementChild) return;
    const serial = fresh ? rollId : previous && previous.key === key ? previous.serial : 0;
    sourceViews.set(target,{key,serial});
    const animate = fresh && !reducedMotion();
    const content = [];
    if (finished) content.push(make(doc,'p','sg-kicker','Previous hunt · final roll'));
    content.push(makeSide(doc,'prey',battle,round,species,animate),makeSide(doc,'predator',battle,round,species,animate));
    if (round) {
      content.push(comparisons(doc,round,species));
      content.push(make(doc,'p','sg-dice-result','Round '+rows.length+' · Dice left: wildebeest '+round.preyRemaining+', predator '+round.predatorRemaining));
    } else {
      content.push(make(doc,'p','sg-dice-result','Roll to compare highest dice first.'));
    }
    target.replaceChildren(...content);
  }
  function mirror(source,target) {
    if (!target) return;
    target.hidden = !source || source.hidden;
    if (target.hidden) { mirrorViews.delete(target); target.replaceChildren(); return; }
    const current = sourceViews.get(source);
    const previous = mirrorViews.get(target);
    if (current && previous && current.key===previous.key && current.serial===previous.serial && target.firstElementChild) return;
    const animate = !!(previous && current && current.serial && current.serial!==previous.serial && !reducedMotion());
    target.setAttribute('data-dice-view','');
    target.replaceChildren(...Array.from(source.children,child=>{
      const copy = child.cloneNode(true);
      for (const item of copy.querySelectorAll('['+ANIM+']')) {
        if (!animate) item.removeAttribute(ANIM);
      }
      if (!animate) copy.removeAttribute(ANIM);
      return copy;
    }));
    if (current) mirrorViews.set(target,current);
  }
  function forget(target) { if (target) mirrorViews.delete(target); }
  root.SerengetiDice = {markRoll,render,mirror,forget};
})(typeof window !== 'undefined' ? window : globalThis);
