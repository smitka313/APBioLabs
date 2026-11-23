/* Expanded board. The original map and game state remain the single source of truth. */
(function () {
  'use strict';
  const find = id => document.getElementById(id);
  const open = find('sg-board-open'), modal = find('sg-board-dialog'), close = find('sg-board-close');
  const map = find('sg-scene'), viewport = find('sg-board-viewport'), slot = find('sg-board-slot');
  const cardButton = find('sg-expanded-view-card');
  if (!open || !modal || !map || !close || typeof modal.showModal !== 'function') return;
  const control = document.querySelector('.sg-control');
  const home = map.parentNode, anchor = document.createComment('live Serengeti board returns here');
  home.insertBefore(anchor,map);
  let scale = 1, pending = false, previousAnnouncement = '', previousCard = '', previousResult = '';
  const phases = {min:1,max:2.5,step:.25};
  const make = (tag, cls, content) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content) el.textContent = content;
    return el;
  };
  const read = id => {
    const el = find(id);
    return el ? el.textContent.trim() : '';
  };
  function setZoom(next) {
    const x = (viewport.scrollLeft + viewport.clientWidth/2) / Math.max(1,viewport.scrollWidth);
    const y = (viewport.scrollTop + viewport.clientHeight/2) / Math.max(1,viewport.scrollHeight);
    scale = Math.min(phases.max,Math.max(phases.min,next));
    slot.style.setProperty('--sg-board-scale',String(scale));
    viewport.toggleAttribute('data-zoomed',scale!==1);
    find('sg-board-zoom-out').disabled = scale <= phases.min;
    find('sg-board-zoom-in').disabled = scale >= phases.max;
    find('sg-board-fit').setAttribute('aria-label','Reset map zoom to fit. Current scale '+Math.round(scale*100)+' percent');
    if (scale===1) { viewport.scrollLeft=0; viewport.scrollTop=0; }
    else {
      viewport.scrollLeft = x * viewport.scrollWidth - viewport.clientWidth/2;
      viewport.scrollTop = y * viewport.scrollHeight - viewport.clientHeight/2;
    }
  }
  function mirrorActions() {
    const newer = find('sg-expanded-actions');
    const originals = find('sg-actions');
    const buttons = originals ? Array.from(originals.querySelectorAll('button')) : [];
    newer.replaceChildren(...buttons.map((source,index) => {
      const mirror = make('button',source.className,source.textContent);
      const suffix = source.id.replace(/^sg-/,'') || ('action-'+index);
      mirror.id = 'sg-expanded-'+suffix;
      mirror.type = 'button';
      mirror.disabled = source.disabled;
      if (source.dataset.action) mirror.dataset.action = source.dataset.action;
      if (source.hasAttribute('aria-label')) mirror.setAttribute('aria-label',source.getAttribute('aria-label'));
      mirror.addEventListener('click', () => {
        const current = find(source.id);
        if (!current || current.disabled) return;
        const navigates = source.id==='sg-view-season' || (!source.dataset.action && source.id==='sg-next');
        if (navigates) modal.close();
        current.click();
        if (!navigates) scheduleSync();
      });
      return mirror;
    }));
  }
  function mirrorChooser() {
    const target = find('sg-expanded-options');
    const selectors = [['sg-travel-piece','sg-expanded-travel-piece'],['sg-options','sg-expanded-select']];
    target.replaceChildren(...selectors.flatMap(([id,mirrorId])=>{
      const original=find(id);
      if(!original||original.hidden) return [];
      const label=make('label','sg-chooser'), choice=original.cloneNode(true);
      const oldLabel=original.labels&&original.labels[0];
      const labelText=oldLabel&&Array.from(oldLabel.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
      label.append(document.createTextNode(labelText||original.getAttribute('aria-label')||'Choose a board action'));
      choice.id=mirrorId; choice.removeAttribute('aria-labelledby'); choice.value=original.value;
      choice.addEventListener('change',()=>{
        const active=find(id);
        if(!active||active.disabled||!Array.from(active.options).some(o=>o.value===choice.value)) return;
        active.value=choice.value; active.dispatchEvent(new Event('change',{bubbles:true}));
      });
      label.append(choice); return [label];
    }));
  }
  function mirrorDice() {
    const original = find('sg-dice'), target = find('sg-expanded-dice');
    if (window.SerengetiDice) { window.SerengetiDice.mirror(original,target); return; }
    target.hidden = !original || original.hidden;
    if (target.hidden) { target.replaceChildren(); return; }
    target.replaceChildren(...Array.from(original.children,child=>{
      const copy = child.cloneNode(true);
      if (copy.id) copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
      return copy;
    }));
  }
  function activeCardReopen() {
    const interactive = find('sg-interactive');
    return interactive && interactive.querySelector('.sg-event-reopen');
  }
  function mirrorContext() {
    const target = find('sg-expanded-context');
    const details = find('sg-expanded-details');
    const card = find('sg-interactive') && find('sg-interactive').querySelector('article.sg-card');
    const printed = card && card.querySelector('p');
    const cardText = printed && printed.textContent.trim();
    const original = activeCardReopen();
    if (cardButton) {
      cardButton.hidden = !original || original.hidden;
      cardButton.disabled = !!(original && original.disabled);
      if (original && original.hasAttribute('aria-controls')) cardButton.setAttribute('aria-controls',original.getAttribute('aria-controls'));
      else cardButton.removeAttribute('aria-controls');
    }
    const copy = [read('sg-action-copy'), cardText, read('sg-turn-note')].filter(Boolean);
    target.replaceChildren(...copy.map(text=>make('p','',text)));
    details.hidden = !copy.length;
    find('sg-expanded-summary').textContent = card ? 'Read event card' : 'Turn instructions';
    const cardKey = cardText || '';
    if (cardKey!==previousCard) details.open=false;
    previousCard=cardKey;
  }
  function sync() {
    if (!modal.open) return;
    const active = document.activeElement;
    const focusedId = active && /^(sg-expanded-(next|move|select|travel-piece|start|view-season))$/.test(active.id) ? active.id : null;
    const header = read('sg-board-title') || 'Expanded board';
    const phase = read('sg-phase'), title = read('sg-action-title');
    const player = find('sg-rolebar') && find('sg-rolebar').querySelector('[aria-current=true] b');
    find('sg-board-dialog-title').textContent = header;
    find('sg-expanded-phase').textContent = phase;
    find('sg-expanded-action-title').textContent = title;
    find('sg-expanded-player').textContent = player ? player.textContent + ' turn' : '';
    const result = read('sg-last');
    const count = read('sg-evidence-count');
    const actualResult = Boolean(result && count !== '0');
    const resultPanel = find('sg-expanded-last');
    const resultText = find('sg-expanded-last-text');
    const resultKey = count + ':' + result;
    resultPanel.hidden = !actualResult;
    if (resultKey !== previousResult || resultText.textContent !== result) {
      resultText.textContent = actualResult ? result : '';
      if (actualResult && previousResult && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        resultPanel.getAnimations?.().forEach(animation=>animation.cancel());
        resultPanel.animate?.([{backgroundColor:'var(--sg-accent-soft)'},{backgroundColor:'var(--sg-paper)'}],{duration:530,easing:'ease-out'});
      }
      previousResult = resultKey;
    }
    const sourceReading=find('sg-hunt-reading'), reading=find('sg-expanded-reading');
    if(reading){
      reading.hidden=!sourceReading;
      if(sourceReading){
        const copy=sourceReading.cloneNode(true); copy.removeAttribute('id'); reading.replaceChildren(copy);
      }else if(reading.firstElementChild)reading.replaceChildren();
    }
    mirrorContext(); mirrorDice(); mirrorChooser(); mirrorActions();
    if (focusedId) {
      const replacement = find(focusedId) || find('sg-expanded-next') || close;
      if (!replacement.disabled) replacement.focus({preventScroll:true});
    }
    const nextAnnouncement = [phase,title,read('sg-live')].filter(Boolean).join('. ');
    if (nextAnnouncement!==previousAnnouncement) {
      find('sg-expanded-announcement').textContent=nextAnnouncement;
      previousAnnouncement=nextAnnouncement;
    }
  }
  function scheduleSync() {
    if (pending || !modal.open) return;
    pending = true;
    queueMicrotask(()=>{pending=false; sync();});
  }
  open.addEventListener('click',()=>{
    if (modal.open || !map.querySelector('svg.sg-map')) return;
    previousAnnouncement=''; previousCard=''; previousResult='';
    slot.append(map);
    try { modal.showModal(); }
    catch (_) { home.insertBefore(map,anchor.nextSibling); return; }
    setZoom(1);
    sync();
  });
  close.addEventListener('click',()=>modal.close());
  if (cardButton) cardButton.addEventListener('click',()=>{
    const original = activeCardReopen();
    if (original && !original.hidden && !original.disabled) original.click();
  });
  modal.addEventListener('close',()=>{
    window.SerengetiDice?.forget(find('sg-expanded-dice'));
    home.insertBefore(map,anchor.nextSibling);
    if (!open.closest('[hidden]')) open.focus({preventScroll:true});
  });
  find('sg-board-zoom-in').addEventListener('click',()=>setZoom(scale+phases.step));
  find('sg-board-zoom-out').addEventListener('click',()=>setZoom(scale-phases.step));
  find('sg-board-fit').addEventListener('click',()=>setZoom(1));
  document.addEventListener('sg:turnchange',scheduleSync);
  if (control && typeof MutationObserver==='function') {
    const observer = new MutationObserver(scheduleSync);
    observer.observe(control,{subtree:true,childList:true,characterData:true,attributes:true});
  }
})();
