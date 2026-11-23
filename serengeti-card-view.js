/* Presentation only: reading, dismissing, and reopening a card never advances the game. */
(function () {
  'use strict';
  const rules = window.SerengetiLogic;
  const panel = document.querySelector('#sg-interactive');
  if (!rules || !panel || !window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) return;

  const beats = {
    removeWildebeest: ['Population loss', 'Select an individual wildebeest token to remove.'],
    wildebeestFlee: ['Wildebeest movement', 'Choose a legal square for a small group to move away from a predator.'],
    scare: ['Predator movement', 'Choose a nearby predator and move it away within its own territory.'],
    removeHyena: ['Hyena population', 'Select an individual hyena token to remove.'],
    commute: ['Temporary movement', 'Choose where a small group of hyenas travels this season. If it reaches a hunting position, resolve the hunt on the board.'],
    addHyena: ['Hyena population', 'Choose a free spot in hyena territory for the new individual.'],
    removeClan: ['Territory change', 'Select a clan to remove. The remaining tokens there cannot hunt.'],
    removePride: ['Territory change', 'Select a pride to remove. The remaining tokens there cannot hunt.'],
    lionDrought: ['Predator movement', 'Choose a legal move toward wildebeest. If the lion can hunt from there, roll on the board.'],
    addLion: ['Lion population', 'Choose a free spot in lion territory for the new small group.'],
    lionStalk: ['Predator movement', 'Choose a legal move for a small group. If it can hunt from there, roll on the board.'],
    removeLion: ['Lion population', 'Select an individual lion token to remove.']
  };
  // Original field-guide illustrations. The seasonal colors are illustrative; the
  // event controls the local weather/terrain and never changes a game rule.
  const palette = [
    ['#52757d','#c7ded4','#86a567','#435d50','#edddad','#415342'],
    ['#5f8183','#d2e6c5','#87a75b','#47665e','#fae4b1','#46613d'],
    ['#937354','#f6d094','#bb985c','#6d684f','#fff1bd','#67573b'],
    ['#604f69','#e5a8a0','#aa8356','#575862','#ffdfb0','#5a503f']
  ];
  const artDirection = {
    'old-sick': ['hunt','lion','adult'],
    'slow-calf': ['hunt','hyena','calf'],
    'short-grasses': ['short','lion','group'],
    stomping: ['stomp','hyena','group'],
    'hyena-cub-dies': ['quiet','hyena','cub'],
    'hyena-commute': ['track','hyena','pair'],
    'hyena-cub-survives': ['family','hyena','cub'],
    landslide: ['rock','hyena','pair'],
    'isolated-newborn': ['hunt','hyena','calf'],
    'isolated-adult': ['stalk','lion','adult'],
    'flood-a': ['water','lion','pair'],
    'flood-b': ['water','lion','pair'],
    'drought-a': ['dry','lion','adult'],
    'drought-b': ['dry','lion','adult'],
    'lion-cubs': ['family','lion','pair'],
    'lion-stalk': ['stalk','lion','group'],
    'lion-dies': ['standoff','lion','adult']
  };
  function animal(species,x,y,scale=1,face=1,young=false) {
    const [base,shade,lit,fur] = ({
      wildebeest: ['#746155','#363944','#ae8b65','#37323a'],
      hyena: ['#b39058','#575053','#d8b883','#654a40'],
      lion: ['#bf9455','#785139','#efc587','#5f4335']
    })[species];
    const skin = 'url(#sg-art-'+species+')';
    const paw = fur;
    const common = '<ellipse cx="-2" cy="27" rx="44" ry="5" fill="#252830" opacity=".22"/>';
    let body;
    if (species==='wildebeest') {
      body =
        '<path fill="'+shade+'" d="M-23 2l-7 13-2 12h-4l1-12 4-16m39-1 6 10-1 17h-5l-1-14-6-7"/>'+
        '<path fill="'+skin+'" stroke="'+shade+'" stroke-width=".9" d="M-40-7Q-37-18-20-19L-3-20Q9-25 21-21L32-17 39-19 48-14 47-9 41-8 36-3 28-2 23 1 21 14 16 27h-5l2-15-2-9-11 1-10 3-12-4-7 11-3 13h-5l1-15 4-11-5-2-4 9-7 5-2-4 5-5z"/>'+
        '<path fill="'+lit+'" opacity=".65" d="M-34-13Q-15-22 7-21L16-19Q0-16-12-17L-29-13z"/>'+
        '<path d="M17-19q-10 9-9 20m3-21q-9 8-9 19m2-17q-8 7-8 17m2-16q-7 7-8 15m3-15q-7 7-8 13" stroke="'+fur+'" stroke-width="1.6" opacity=".72" fill="none" stroke-linecap="round"/>'+
        '<path fill="'+fur+'" d="M8-22q9-5 18 0l5 5-4 1-4-2-3 3-3-3-3 2-3-2-4 1zM26-9l7 4 1 8-4 4-1-4-2-1-3-5zM41-12l6-2 3 2-2 4-6 1z"/>'+
        (young?'':'<path d="M38-16q-11 0-13-5-2-4 2-7m16 11q7-4 6-9" fill="none" stroke="#dfc9a3" stroke-width="2.8" stroke-linecap="round"/>')+
        '<path d="M-39-6q-3 12-10 12" stroke="'+shade+'" stroke-width="2" fill="none" stroke-linecap="round"/>'+
        '<circle cx="39" cy="-13" r="1.1" fill="#282025"/><path fill="'+paw+'" d="M-37 24h6l-1 4h-7zm47 0h6v4h-7z"/>';
    } else if (species==='hyena') {
      body =
        '<path fill="'+shade+'" d="M-25 5l-5 10 2 12h-5l-3-12 4-12m42-6 5 7 2 22h-5l-4-16-5-6"/>'+
        '<path fill="'+skin+'" stroke="'+shade+'" stroke-width=".9" d="M-40-2Q-32-12-20-12Q-8-15 1-21 9-23 20-19L27-16 33-13 44-8 46-3 41 1 33 1 29 5 24 4 20 9 18 28h-5l-4-15 1-7-12 2-9-1-8 7-1 14h-5l-2-15 2-7-7-1-6 6-10 5-3-4 8-7z"/>'+
        '<path fill="'+lit+'" opacity=".64" d="M-31-5q14-3 31-13 9-6 16-2-8 3-11 8-15 6-34 11z"/>'+
        '<path fill="'+fur+'" d="M-4-18q11-8 20-4l8 5-7-1-3 2-5-2-3 2-3-1-4 2zM33-8l11 1 2 4-4 4h-8l-3-3z"/>'+
        '<path fill="'+lit+'" stroke="'+fur+'" stroke-width="1.4" d="M24-17q-4-6 0-9 5-3 7 4l-1 7zm9 2q0-6 3-5 3 1 1 7z"/>'+
        '<g fill="'+fur+'" opacity=".83"><circle cx="-29" cy="-4" r="1.8"/><circle cx="-26" cy="3" r="1.5"/><circle cx="-19" cy="-5" r="2.1"/><circle cx="-12" cy="0" r="1.8"/><circle cx="-10" cy="-9" r="1.7"/><circle cx="-4" cy="-5" r="2.15"/><circle cx="1" cy="2" r="1.5"/><circle cx="4" cy="-12" r="2.5"/><circle cx="7" cy="-3" r="1.6"/><circle cx="14" cy="-10" r="1.9"/><circle cx="15" cy="4" r="1.4"/><circle cx="-24" cy="9" r="1.3"/><circle cx="20" cy="-5" r="1.3"/></g>'+
        '<circle cx="34" cy="-10" r="1.3" fill="#2d231f"/><path fill="'+paw+'" d="M-26 25h6v4h-7zm38 0h7v4h-7z"/>';
    } else {
      body =
        '<path d="M-36-4Q-53-1-54-10q-2-7 6-10" stroke="'+shade+'" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M-49-21q6-4 8 0l-4 4-5 1z" fill="'+fur+'"/>'+
        '<path fill="'+shade+'" d="M-24 3l-2 13-2 11h-6l3-13-2-11m46-4 8 9 1 19h-5l-4-15-6-6"/>'+
        '<path fill="'+skin+'" stroke="'+shade+'" stroke-width=".9" d="M-39-5Q-32-16-19-16L2-14 16-17 21-22 29-23 35-18 38-15 47-12 47-7 43-5 34-5 30-2 24-3 18 8 17 27h-6l-1-14-3-6-10-2-13-1-8 7-1 16h-6l-2-14 3-7-6-2z"/>'+
        '<path fill="'+lit+'" opacity=".73" d="M-34-8q9-9 24-6l14 2 15-4q-5 5-15 7-18-4-38 1zM36-12l10 2v3l-6 2-6-1z"/>'+
        '<path fill="'+lit+'" stroke="'+fur+'" stroke-width="1" d="M26-20q-5-2-4-6 2-2 5-1 4 2 3 6z"/>'+
        '<circle cx="36" cy="-14" r="1.1" fill="#2d2322"/><path d="m39-8 12 1m-12 1 10 3" stroke="'+fur+'" stroke-width=".6"/>'+
        '<path fill="'+paw+'" opacity=".8" d="M-33 25h9v3h-10zm43 0h8v3H10z"/>';
    }
    return '<g transform="translate('+x+' '+y+') scale('+(scale*face)+' '+scale+')">'+common+body+'</g>';
  }
  function picture(card, season) {
    const [sky,haze,field,hills,sun,earth] = palette[season] || palette[0];
    const [type,species,casting] = artDirection[card.id] || ['short','wildebeest','group'];
    const dry=type==='dry', wet=type==='water', rocky=type==='rock';
    const motion=type==='track'?'stride':type==='stomp'?'step':type==='stalk'?'stalk':'';
    const sceneGround = dry ? '#9a7453' : wet ? '#587978' : earth;
    const defs =
      '<defs><linearGradient id="sg-art-sky" x2="0" y2="1"><stop stop-color="'+sky+'"/><stop offset="1" stop-color="'+haze+'"/></linearGradient>'+
      '<linearGradient id="sg-art-ground" x2="0" y2="1"><stop stop-color="'+field+'"/><stop offset="1" stop-color="'+sceneGround+'"/></linearGradient>'+
      '<radialGradient id="sg-art-sun"><stop stop-color="'+sun+'" stop-opacity=".78"/><stop offset="1" stop-color="'+sun+'" stop-opacity="0"/></radialGradient>'+
      '<linearGradient id="sg-art-wildebeest" x2="0" y2="1"><stop stop-color="#ad8c6b"/><stop offset=".5" stop-color="#78665c"/><stop offset="1" stop-color="#494952"/></linearGradient>'+
      '<linearGradient id="sg-art-hyena" x2="0" y2="1"><stop stop-color="#dbc189"/><stop offset=".58" stop-color="#b3905b"/><stop offset="1" stop-color="#73604c"/></linearGradient>'+
      '<linearGradient id="sg-art-lion" x2="0" y2="1"><stop stop-color="#dfbc7c"/><stop offset=".55" stop-color="#bd9058"/><stop offset="1" stop-color="#865d41"/></linearGradient></defs>';
    const tree = (x,y,z) => '<g transform="translate('+x+' '+y+') scale('+z+')" fill="'+hills+'"><path d="M-3 1 0-31-8-44-5-47 5-34 15-48 18-45 8-32 6 1z"/><path d="M-40-44q-2-8 12-10 5-8 18-6 13-11 29-1 16-2 21 7 16 2 14 10l-37 3z"/><path d="M-2-31-20-47m25 11 21-12" stroke="'+hills+'" stroke-width="3" fill="none"/></g>';
    const dryBed = Array.from({length:11},(_,i)=>{
      const x=i*45+((i*13)%16),y=154+(i%3)*9;
      return '<path d="M'+(x-27)+' '+y+'l17-5 12 4 14-4m-14 4 5 8m-17-12-7-7" stroke="#eac492" stroke-width="1.05" opacity=".73" fill="none"/>';
    }).join('');
    const water = '<path d="M0 158Q96 140 137 143t62 10q40 16 76 8 77-17 145-25V194H0Z" fill="#4d8286"/><path d="M0 159q92-15 135-13t62 11q40 16 79 9 74-19 144-22" stroke="#c3ded1" stroke-width="2" fill="none"/>'+
      '<g data-motion="water" stroke="#d6e9da" stroke-width="1.35" opacity=".75">'+Array.from({length:12},(_,i)=>'<path d="M'+(i*40%414)+' '+(163+(i%3)*11)+'h'+(11+i*7%21)+'"/>').join('')+'</g>';
    const slide = '<path d="M0 125 55 63 99 72 122 106 153 126 99 130 73 113 45 133Z" fill="#715b50"/><path d="M0 125 55 63 69 85 59 102 73 113 45 133Z" fill="#a2836c"/>'+
      '<g fill="#c6a683" stroke="#756051" stroke-width=".8">'+Array.from({length:12},(_,i)=>{
        const x=87+i*7.1,y=90+i*4.3+(i%3)*4,z=4+(i*3)%7;
        return '<path d="M'+x+' '+(y-z)+'l'+z+' '+(z*.75)+'-2 '+z+'-'+z+' -3z"/>';
      }).join('')+'</g>';
    const grassBlades = (n,y0,range,color,opacity=.62) => '<g stroke="'+color+'" stroke-width="1" fill="none" opacity="'+opacity+'">'+Array.from({length:n},(_,i)=>{
      const x=(i*83+17)%425,y=y0+(i*19)%range,h=type==='stalk'? 8+i*7%14 : type==='short'||dry ? 2+i*3%5 : 5+i*3%10;
      return '<path d="M'+x+' '+y+'q-1 -'+(h*.6)+' -'+(h*.4)+' -'+h+'m'+(h*.4)+' '+h+'q1 -'+(h*.64)+' '+(h*.45)+' -'+(h*.87)+'"/>';
    }).join('')+'</g>';
    let figures;
    if (['short','stomp','hunt','stalk','standoff','dry'].includes(type)) {
      const trail=type==='stalk'||type==='hunt', left=trail?106:118;
      const group=casting==='group'?animal('wildebeest',left-40,123,.51,1)+animal('wildebeest',left+36,121,.57,1):'';
      const calf=casting==='calf'?animal('wildebeest',left+38,144,.49,1,true):'';
      const adult=animal('wildebeest',left,139,type==='hunt'?.87:1.07,trail?1:-1);
      const pred=animal(species,type==='dry'?327:299,146,1.05,-1) +(type==='stalk'?animal(species,353,138,.7,-1):'');
      figures = type==='stomp' ? '<g data-motion="step">'+group+adult+'</g><g data-motion="retreat">'+pred+'</g>' : group+calf+adult+'<g data-motion="'+motion+'">'+pred+'</g>';
    } else if (type==='family'||type==='quiet') {
      figures=animal(species,175,140,1.16,1)+
        (type==='family'?animal(species,232,153,.53,-1,true)+(casting==='pair'?animal(species,277,151,.42,-1,true):''):animal(species,299,138,.67,-1));
    } else {
      figures='<g data-motion="'+motion+'">'+animal(species,216,141,1.11,1)+animal(species,310,139,.78,1)+'</g>';
    }
    const breeze = dry ? '<g data-motion="glint" fill="'+sun+'" opacity=".23"><path d="M246 144q29-7 59 0-28 4-59 0z"/><path d="M280 150q28-5 52 0-23 3-52 0z"/></g>' : '';
    return '<svg viewBox="0 0 420 194" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+defs+
      '<path d="M0 0h420v194H0Z" fill="url(#sg-art-sky)"/><circle cx="320" cy="43" r="56" fill="url(#sg-art-sun)"/><circle cx="320" cy="43" r="19" fill="'+sun+'" opacity=".83"/>'+
      '<path d="M15 40q65-15 128-3 38-10 82-3-49 11-100 8-63 9-110-2zM252 64q54-11 102-4 31-7 60-2-47 10-91 8-40 8-71-2z" fill="'+haze+'" opacity=".4"/>'+
      '<path d="M0 99l28-12 49 8 64-20 41 13 34-2 31 11 45-29 44 10 44-16 40 20v59H0Z" fill="'+hills+'" opacity=".42"/>'+
      '<path d="M0 110q43-13 86-7t102 0q68-18 113-8 60-19 119-3v71H0Z" fill="'+hills+'" opacity=".67"/>'+
      '<g opacity=".66">'+tree(51,112,.93)+tree(97,120,.52)+tree(354,113,.64)+'</g>'+
      '<path d="M0 120q79-15 201-4 113-19 219-8v86H0Z" fill="url(#sg-art-ground)"/>'+
      (rocky?slide:'')+(dry?dryBed:'')+(wet?water:'')+breeze+
      (wet?'':grassBlades(dry?20:42,124,28,earth,.49))+
      figures+(wet?'':grassBlades(type==='stalk'?28:22,159,26,type==='stalk'?'#bfb069':'#cfbb84',.69))+
      '<path d="M0 191q91-18 152-5 112-9 268 0v8H0Z" fill="'+earth+'" opacity=".55"/>'+
      '</svg>';
  }

  const dialog = document.createElement('dialog');
  dialog.id = 'sg-event-modal';
  dialog.className = 'sg-event-modal';
  dialog.setAttribute('aria-labelledby','sg-event-title');
  // Static markup only; printed card text and labels are set below with textContent.
  dialog.innerHTML = '<div class="sg-event-shell"><header class="sg-event-head"><p id="sg-event-kicker"></p><button type="button" class="sg-event-x" aria-label="Close event card">×</button></header><div id="sg-event-art" class="sg-event-art"></div><div class="sg-event-body"><h2 id="sg-event-title"></h2><p id="sg-event-wording"></p><section class="sg-event-effect" aria-label="Apply this card"><strong id="sg-event-effect-title"></strong><p id="sg-event-effect-text"></p></section><button type="button" class="sg-event-continue" autofocus>Continue to board</button></div></div>';
  document.body.append(dialog);
  const within = s => dialog.querySelector(s);
  const close = within('.sg-event-x');
  const proceed = within('.sg-event-continue');
  close.addEventListener('click', () => dialog.close());
  proceed.addEventListener('click', () => dialog.close());

  const expandedBoard = () => document.querySelector('#sg-board-dialog[open]');
  const boardFocus = () => expandedBoard()
    ? document.querySelector('#sg-expanded-select') || document.querySelector('#sg-expanded-next')
    : document.querySelector('#sg-options') || document.querySelector('#sg-next');
  let previous = '', focusAfterClose = null;
  dialog.addEventListener('close', () => {
    const board = expandedBoard();
    const target = focusAfterClose?.isConnected && (!board || board.contains(focusAfterClose)) ? focusAfterClose : boardFocus();
    focusAfterClose = null;
    if (target) target.focus({ preventScroll:true });
  });
  function show(card, season, role, returnTo) {
    if (dialog.open || document.querySelector('dialog[open]:not(#sg-board-dialog)')) return;
    focusAfterClose = returnTo;
    const [label,effect] = beats[card.effect] || ['Event','Use the options on the board to apply this event.'];
    within('#sg-event-kicker').textContent = (rules.SEASONS[season] || 'Serengeti')+' · Event card'+(role ? ' · '+(rules.LABELS[role] || role)+' drew' : '');
    within('#sg-event-title').textContent = card.title;
    within('#sg-event-wording').textContent = card.text;
    within('#sg-event-effect-title').textContent = label;
    within('#sg-event-effect-text').textContent = effect;
    within('#sg-event-art').innerHTML = picture(card,season);
    dialog.showModal();
    proceed.focus({preventScroll:true});
  }
  function readArticle(article) {
    if (!article) return null;
    const card = rules.CARDS.find(c => c.id === article.dataset.cardId)
      || rules.CARDS.find(c => c.text === article.querySelector('p')?.textContent);
    if (!card) return null;
    const active = document.querySelector('#sg-season-strip [aria-current="step"] span')?.textContent;
    const season = article.dataset.cardSeason === undefined ? rules.SEASONS.indexOf(active) : Number(article.dataset.cardSeason);
    const role = article.dataset.cardRole || rules.ROLES.find(r=>article.querySelector('h3')?.textContent.endsWith(rules.LABELS[r]));
    return { card, season, role };
  }
  function sync(automatically) {
    const article = panel.querySelector('article.sg-card');
    const state = readArticle(article);
    if (!state) { previous = ''; return; }
    const {card,season,role} = state;
    if (!article.querySelector('.sg-event-reopen')) {
      const reopen = document.createElement('button');
      reopen.type = 'button';
      reopen.id = 'sg-view-card';
      reopen.textContent = 'View illustrated card';
      reopen.className = 'sg-event-reopen';
      reopen.addEventListener('click', () => show(card,season,role,expandedBoard() ? document.querySelector('#sg-expanded-view-card') : reopen));
      article.append(reopen);
    }
    const current = [card.id,season,role].join(':');
    if (automatically && current !== previous) show(card,season,role,boardFocus());
    previous = current;
  }
  sync(false); // Pending card from a saved game is reopenable, not forcibly reopened.
  new MutationObserver(() => sync(true)).observe(panel,{childList:true});
})();
