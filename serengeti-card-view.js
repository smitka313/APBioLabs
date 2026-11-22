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
  const palette = [
    ['#445f63','#c5dad1','#7b9d8d','#344e48','#eecb7c'],
    ['#537b73','#deebc3','#89aa71','#35564e','#ffe29e'],
    ['#876b42','#fbc578','#cc9d50','#584f35','#fff1b6'],
    ['#594c62','#e8a27a','#aa805e','#48473e','#ffe1b0']
  ];

  function picture(card, season) {
    const [sky,sun,grass,hill,light] = palette[season] || palette[0];
    const sculpt = (animal,x,y,scale,fill) => {
      const outlines = {
        wildebeest: 'M-35-6Q-29-18-19-19L4-16Q15-17 22-11L28-2 38 2 35 8 27 8 22 4 15 1 12 15 9 24 5 24 7 11 4 3-7 3-12 15-15 24-20 24-18 11-21 3-25 3-30 24-34 24-33 11-35 3-42 9-44 6Z',
        lion: 'M-32 1-25-4Q-18-11-7-11L10-12Q17-24 27-21 36-19 37-8L41-6 38-1 31 2 25 1 22 8 21 22 16 22 15 9 10 10 8 24 3 24 1 9-12 7-19 10-21 23-26 23-25 9-30 5-37 7-46 0-45-7-40-8-40-3Z',
        hyena: 'M-37-2-26-8-18-10Q-6-24 9-20L18-14 21-19 25-18 27-12 34-7 39-6 37-1 27 3 18 1 13 7 12 24 8 24 7 10 1 6-14 4-19 10-20 23-25 23-24 9-29 6-34 12-40 14-42 11Z'
      };
      const horn = animal === 'wildebeest' ? '<path d="M27-3Q22-9 25-15M28-2Q35-8 34-15" fill="none" stroke="#eecfa4" stroke-width="2.5" stroke-linecap="round"/><path d="M18-4L28 7L22 13Z" fill="#231d22"/>' : '';
      const details = animal === 'lion' ? '<path d="M15-13Q17-24 27-22 35-20 34-14L30-9 24 2 19 7 16 3 13-6Z" fill="#543a31" opacity=".72"/>' : animal === 'hyena' ? '<g fill="#251f28" opacity=".65"><circle cx="-14" cy="-10" r="2"/><circle cx="-6" cy="-5" r="1.8"/><circle cx="1" cy="-12" r="2"/><circle cx="7" cy="-6" r="1.7"/></g>' : horn;
      return '<g transform="translate('+x+' '+y+') scale('+scale+' '+Math.abs(scale)+')"><path d="'+outlines[animal]+'" fill="'+fill+'"/>'+details+'</g>';
    };
    const icon = (symbol,x,y) => {
      const items = {
        flood:'<path d="M-31 5q12-14 24 0t24 0t24 0M-29 16q12-13 24 0t24 0t23 0M-15-8q8-8 16 0t16 0" fill="none" stroke="#d9f8ed" stroke-width="4" stroke-linecap="round"/>',
        landslide:'<path d="M-35 20 2-28 36 20Z" fill="#6d5548" stroke="#ecc096" stroke-width="2"/><path d="M5-11l13 12m-23-6 13 12m-20-3 10 10" stroke="#ffe0a8" stroke-width="3" stroke-linecap="round"/>',
        commute:'<path d="M-27 12Q-2-23 29-1m-6-16L31 0l-18 7" fill="none" stroke="#fff0bb" stroke-width="4" stroke-linecap="round" stroke-dasharray="7 5"/>',
        drought:'<path d="M-37 13-23 5-15 13-5 4-2-5 9 5 26 0 37 8M-15 13l-2 10m21-12 5 11" fill="none" stroke="#fce4b0" stroke-width="3" stroke-linecap="round"/><circle cy="-19" r="10" fill="#ffe29e"/>',
        grass:'<path d="M-28 17q8-9 3-27m-3 27q6-10 14-14m3 16q5-13 2-30m-2 30q7-14 15-18m2 17Q14 5 25-4M6 18q1-10 0-21" fill="none" stroke="#e7f0b6" stroke-width="3" stroke-linecap="round"/>',
        hunt:'<path d="M-28 8Q0-26 28 8 0 31-28 8Z" fill="none" stroke="#f3d5a7" stroke-width="3"/><circle cy="6" r="7" fill="#f3d5a7"/>',
        cub:'<path d="M0 15-19-3C-34-26-2-29 0-15 2-29 34-26 19-3Z" fill="#efc795" opacity=".9"/>'
      };
      return '<g transform="translate('+x+' '+y+')">'+items[symbol]+'</g>';
    };
    const effect = card.effect;
    const predator = effect.toLowerCase().includes('hyena') || ['slow-calf','isolated-newborn','landslide','hyena-commute'].includes(card.id) ? 'hyena' : 'lion';
    const scene = effect === 'removePride' ? 'flood' : effect === 'removeClan' ? 'landslide' : effect === 'commute' ? 'commute'
      : effect === 'lionDrought' ? 'drought' : ['lionStalk','scare','wildebeestFlee'].includes(effect) ? 'grass'
        : ['addHyena','addLion','removeHyena'].includes(effect) ? 'cub' : 'hunt';
    const speciesPair = ['wildebeestFlee','scare','removeWildebeest','lionDrought','lionStalk','removeLion'].includes(effect);
    const foreground = speciesPair ? sculpt('wildebeest',102,139,1.27,'#342a28')+sculpt(predator,308,145,-1.14,'#754f32')
      : sculpt(predator,108,138,1.35,'#544137')+sculpt(predator,281,154,-0.78,'#866246');
    return '<svg viewBox="0 0 420 178" role="presentation" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">'+
      '<rect width="420" height="178" fill="'+sky+'"/>'+
      '<circle cx="332" cy="43" r="30" fill="'+sun+'"/><circle cx="332" cy="43" r="22" fill="'+light+'" opacity=".78"/>'+
      '<path d="M0 105Q79 52 154 103T287 104Q367 67 420 106V178H0Z" fill="'+hill+'"/>'+
      '<path d="M0 115Q119 92 243 119T420 106V178H0Z" fill="'+grass+'"/>'+
      '<path d="M0 153Q112 135 263 152T420 146V178H0Z" fill="'+hill+'" opacity=".58"/>'+
      '<path d="M38 157l-9-14m9 14 7-16m330 18-4-16m4 16 8-12m-167 19-3-15m3 15 7-18" fill="none" stroke="'+light+'" stroke-width="2" opacity=".65"/>'+
      '<circle cx="208" cy="85" r="34" fill="'+hill+'" opacity=".75"/>'+icon(scene,208,85)+foreground+'</svg>';
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
