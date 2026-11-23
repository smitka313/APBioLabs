/* Predict, collect five matched plant releases, compare, then explain.
 * Measured research results are separate from this model's soil landing proxy. */
(() => {
  'use strict';
  const L = window.HawksLogic, $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  if (!L) {
    const warning = $('#hb-status');
    if (warning) warning.textContent = 'The model could not load. Reload this page and try again.';
    return;
  }
  const KEY = 'aplab:openscied:b4-hawksbeard:v1', PAIRS = L.PLANTS;
  const PAGES = ['predict','release','compare','explain'], SITES = ['field','city'];
  const TYPES = {feathery:'Feathery',nonfeathery:'Nonfeathery'};
  const choices = {field:'Field',city:'City',same:'About the same'};
  const PAPER = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2268839/';
  const research = 'In one urban patch experiment in Montpellier, France, the estimated share of nonfeathery seeds was '+Math.round(L.published.plot.before*100)+'% before dispersal and '+Math.round(L.published.plot.landed*100)+'% among seeds captured in the patch afterward.';
  const researchScope = 'These are two stages of the same published urban experiment, not field-versus-city bars, and are not part of your model trial.';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SV = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}) => {
    const node = document.createElementNS(SV, tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  };
  const txt = (tag, value, cls) => {
    const node = document.createElement(tag);
    node.textContent = String(value);
    if (cls) node.className = cls;
    return node;
  };
  const announce = value => { const target = $('#hb-status'); if (target) target.textContent = value; };
  const setText = (selector, value) => { const target = $(selector); if (target) target.textContent = value; };
  const isOwn = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
  const answerInputs = $$('[data-hb-answer]');
  function newSeed() {
    try { return window.crypto.getRandomValues(new Uint32Array(1))[0]; }
    catch (_) { return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0; }
  }
  const fresh = () => ({v:1,seed:newSeed(),page:'predict',lastSection:'predict',lastVisitedAt:0,prediction:'',released:0,answers:{}});
  function restore(raw) {
    const s = JSON.parse(raw);
    if (s?.v !== 1 || !Number.isInteger(s.seed) || s.seed < 0 || s.seed > 4294967295 ||
        !Number.isInteger(s.released) || s.released < 0 || s.released > PAIRS ||
        (s.prediction !== '' && !isOwn(choices,s.prediction)) || (s.released > 0 && !s.prediction) ||
        !s.answers || typeof s.answers !== 'object' || Array.isArray(s.answers)) throw Error('Unreadable save');
    const answers = {};
    for (const f of answerInputs) {
      const k = f.dataset.hbAnswer;
      if (typeof s.answers[k] === 'string') answers[k] = s.answers[k].slice(0,8000);
    }
    return {...s,answers,page:PAGES.includes(s.page) ? s.page : 'predict'};
  }
  let state = fresh(), preserved = false, blocked = false, running = false, frame = 0, trial;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      try { state = restore(raw); } catch (_) { preserved = true; }
    }
  } catch (_) { blocked = true; }
  function save(replacing = false) {
    state.lastSection = state.page;
    state.lastVisitedAt = Date.now();
    if (preserved && !replacing) {
      setText('#hb-save-status','An older trial is preserved. Download this session before leaving.');
      return false;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      blocked = false;
      preserved = false;
      setText('#hb-save-status','Work saved on this device');
      return true;
    } catch (_) {
      blocked = true;
      setText('#hb-save-status',preserved ? 'Older work preserved; this trial did not save' : 'Not saved · download a copy');
      announce('This browser could not save this trial. Download or copy your report before leaving.');
      return false;
    }
  }
  const siteName = site => site === 'field' ? 'Field' : 'City';
  const typeName = type => TYPES[type];
  const percent = (n,d) => d ? (100*n/d).toLocaleString('en-US',{maximumFractionDigits:1})+'%' : 'Not applicable';
  const fraction = (n,d) => d ? n+' / '+d+' ('+percent(n,d)+')' : n+' / '+d+' (no denominator)';
  const records = (site, count = state.released) => trial[site].filter(r => r.plant <= count);
  const tally = (site, count = state.released) => L.summarize(records(site,count));
  const ready = page => page === 'predict' || (page === 'release' ? !!state.prediction : state.released === PAIRS);
  function go(page,{focus=true,persist=true} = {}) {
    if (!PAGES.includes(page) || !ready(page)) {
      if (focus) announce(!state.prediction ? 'Save a prediction first.' : 'Release all five matched plant pairs first.');
      if (focus) return false;
      page = state.prediction ? 'release' : 'predict';
    }
    state.page = page;
    for (const p of PAGES) { const panel = $('#hb-'+p); if (panel) panel.hidden = p !== page; }
    for (const button of $$('.hb-steps [data-hb-go]')) {
      const target = button.dataset.hbGo;
      if (target === page) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    }
    if (location.hash !== '#'+page) history.replaceState(null,'','#'+page);
    if (persist) save();
    if (focus) $('#hb-'+page+'-title')?.focus({preventScroll:true});
    if (focus) $('#hb-'+page)?.scrollIntoView({block:'start'});
    return true;
  }

  // Both scenes map the engine's normalized coordinates to the same art space.
  // Animation offsets are illustrative; each endpoint remains exactly as modeled.
  const W = 640, H = 350;
  const at = p => [p.x*W,p.y*H];
  const cap = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  function drawScene(host,site) {
    const layout = L.layouts[site], city = site === 'city';
    const titleId = 'hb-scene-'+site+'-title', descId = 'hb-scene-'+site+'-desc';
    const canvas = svg('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-labelledby':titleId+' '+descId,class:'hb-scene-svg'});
    const title = svg('title',{id:titleId}), desc = svg('desc',{id:descId});
    title.textContent = siteName(site)+' seed release from above';
    canvas.append(title,desc);
    const defs = svg('defs');
    const soil = svg('pattern',{id:'hb-soil-'+site,width:27,height:23,patternUnits:'userSpaceOnUse'});
    soil.append(svg('rect',{width:27,height:23,fill:city?'#776044':'#4c633a'}),
      svg('path',{d:'M2 14l7-2M15 5l5 2M20 18l3-1',fill:'none',stroke:city?'#a38b65':'#819056','stroke-width':1.2,opacity:.72}));
    defs.append(soil);
    canvas.append(defs,svg('rect',{width:W,height:H,fill:city?'#5a6970':'#899264'}));
    if (city) {
      for (const y of [59,118,178,237,296]) canvas.append(svg('path',{d:'M0 '+y+'H640',stroke:'#a4aaad','stroke-width':1,opacity:.46}));
      for (const x of [78,172,285,405,531]) canvas.append(svg('path',{d:'M'+x+' 0V350',stroke:'#3c4c54','stroke-width':2,opacity:.46}));
    } else {
      for (const x of [25,96,182,469,541,615]) canvas.append(svg('path',{d:'M'+x+' 350q-15-24 2-38m0 34q3-20 13-24',stroke:'#557045','stroke-width':2,fill:'none',opacity:.7}));
    }
    const soils = svg('g',{'aria-hidden':'true',class:'hb-scene-soil'});
    for (const patch of layout.soil) {
      soils.append(svg('rect',{x:patch.x*W,y:patch.y*H,width:patch.width*W,height:patch.height*H,
        fill:'url(#hb-soil-'+site+')',stroke:city?'#d5bc83':'#c5d49d','stroke-width':2}));
    }
    canvas.append(soils);
    const [rx,ry] = at(layout.release);
    const plant = svg('g',{transform:'translate('+rx+' '+ry+')','aria-hidden':'true',class:'hb-scene-plant'});
    plant.append(svg('circle',{r:16,fill:'#2d492f',stroke:'#ffffdf','stroke-width':1.6}),
      svg('path',{d:'M-11 3Q-7-8 0 0 5-12 10-4 8 6 0 4-2 11-11 3Z',fill:'#93b57e',stroke:'#172c24','stroke-width':1}),
      svg('circle',{r:3.5,fill:'#f8dc67',stroke:'#3a401f','stroke-width':1}));
    canvas.append(plant);
    const wind = layout.wind;
    const norm = Math.hypot(wind.dx,wind.dy) || 1, gx = wind.dx / norm, gy = wind.dy / norm;
    const cx = W - 74, cy = 27, wx = cx + gx*34, wy = cy + gy*18;
    const windKey = svg('g',{'aria-hidden':'true',class:'hb-scene-wind'});
    windKey.append(svg('rect',{x:W-142,y:7,width:134,height:40,rx:7,fill:'#172f34',opacity:.94}));
    const label = svg('text',{x:W-133,y:32,fill:'#f2fbef','font-family':'system-ui,sans-serif','font-size':16});
    label.textContent = 'Wind';
    windKey.append(label,svg('path',{d:'M'+cx+' '+cy+'L'+wx+' '+wy+'m'+(-gx*8+gy*5)+' '+(-gy*8-gx*4)+'L'+wx+' '+wy+'l'+(-gx*8-gy*5)+' '+(-gy*8+gx*4),
      fill:'none',stroke:'#f2fbef','stroke-width':2.2,'stroke-linecap':'round','stroke-linejoin':'round'}));
    const past = svg('g',{'aria-hidden':'true',class:'hb-scene-past'});
    const current = svg('g',{'aria-hidden':'true',class:'hb-scene-current'});
    canvas.append(past,current,windKey);
    host.replaceChildren(canvas);
    return {site,desc,past,current};
  }
  const scenes = $$('[data-hb-scene]').filter(host => SITES.includes(host.dataset.hbScene)).map(host=>drawScene(host,host.dataset.hbScene));
  function mark(record,flying=false) {
    const feathery = record.type === 'feathery';
    const g = svg('g',{class:'hb-seed hb-seed-'+record.type,'data-hb-seed':record.id});
    if (!flying) {
      g.dataset.hbLand = record.land;
      if (record.landed) g.append(svg('circle',{r:8,fill:'none',stroke:'#e8ffd1','stroke-width':1.35}));
      else g.append(svg('path',{d:'M-8 -8l4 4m0-4l-4 4',stroke:'#ffdcca','stroke-width':1.6,fill:'none'}));
    }
    if (feathery) {
      g.append(svg('path',{d:'M0 4V-1M0-2l-4-3m4 3-2-5m2 5 2-5m-2 5 4-3',fill:'none',stroke:'#15282b','stroke-width':3,'stroke-linecap':'round'}),
        svg('path',{d:'M0 4V-1M0-2l-4-3m4 3-2-5m2 5 2-5m-2 5 4-3',fill:'none',stroke:'#fffbe8','stroke-width':1.6,'stroke-linecap':'round'}));
    } else {
      g.append(svg('path',{d:'M0-4 3.8 0 0 4-3.8 0Z',fill:'#ffc862',stroke:'#292824','stroke-width':1.2}));
    }
    return g;
  }
  function place(node,record,p=1,arc=true) {
    const [x0,y0] = at(record.start), [x1,y1] = at(record.end);
    // Seeds outside the modeled view stop at the boundary; their soil miss is kept.
    const x = cap(x0 + (x1-x0)*p, 2, W-2);
    const y = cap(y0 + (y1-y0)*p - (arc ? 23*Math.sin(Math.PI*p)*p : 0), 2, H-2);
    node.setAttribute('transform','translate('+x.toFixed(2)+' '+y.toFixed(2)+')');
  }
  function settled(count = state.released) {
    for (const scene of scenes) {
      const area = siteName(scene.site);
      const old = records(scene.site,Math.max(0,count-1)).map(r=>{const m=mark(r);place(m,r);return m;});
      const now = count ? records(scene.site,count).filter(r=>r.plant === count).map(r=>{const m=mark(r);place(m,r);return m;}) : [];
      scene.past.replaceChildren(...old);
      scene.current.replaceChildren(...now);
      const stats = tally(scene.site,count);
      scene.desc.textContent = (scene.site === 'field' ? 'Broad area of suitable soil. ' : 'Small soil patches separated by pavement. ') +
        count+' of '+PAIRS+' matched pairs released. '+area+': '+stats.landed+' of '+stats.released+' model seeds landed on soil.';
    }
  }
  function animate(pair,done) {
    if (motion.matches || !scenes.length) { settled(pair);done();return; }
    settled(pair-1);
    const items = [];
    for (const scene of scenes) {
      // Move the previous batch out of the current layer, retaining its final positions.
      scene.past.append(...scene.current.children);
      const batch = trial[scene.site].filter(r => r.plant === pair);
      batch.forEach((record,i)=>{
        const node=mark(record,true);
        place(node,record,0);
        scene.current.append(node);
        items.push({record,node,delay:Math.min(i*16,250)});
      });
    }
    let start;
    function tick(clock) {
      if (start == null) start = clock;
      const elapsed = clock-start;
      for (const item of items) {
        const t = cap((elapsed-item.delay)/(item.record.type==='feathery'?675:455),0,1);
        place(item.node,item.record,1-Math.pow(1-t,1.5));
      }
      if (elapsed < 940 && !motion.matches) frame=requestAnimationFrame(tick);
      else { frame=0;settled(pair);done(); }
    }
    frame=requestAnimationFrame(tick);
  }

  function currentSummary() {
    const field=tally('field'), city=tally('city');
    return {field,city};
  }
  function summary(host,stats) {
    if (!host) return;
    const list=txt('div','','hb-tally-grid');
    for (const site of SITES) {
      const s=stats[site], card=txt('div','','hb-tally-card');
      card.dataset.hbTally=site;
      card.append(txt('strong',siteName(site)),txt('span',s.landed+' of '+s.released+' seeds landed on soil.','hb-tally-total'),
        txt('span','Nonfeathery share among soil landings: '+fraction(s.byType.nonfeathery.landed,s.landed)+'.','hb-tally-share'));
      list.append(card);
    }
    host.replaceChildren(list);
  }
  function table(host,stats) {
    if (!host) return;
    const t=txt('table','','hb-data-table');
    t.createCaption().textContent='Your model results · seed counts and percentages';
    const header=t.createTHead().insertRow();
    for (const s of ['Environment','Seed type','On soil / released','Outside soil','Share of soil landings']) {
      const th=txt('th',s);th.scope='col';header.append(th);
    }
    const body=t.createTBody();
    for (const site of SITES) {
      for (const type of Object.keys(TYPES)) {
        const s=stats[site], r=s.byType[type], row=body.insertRow();
        row.dataset.hbResult=site+'-'+type;
        row.dataset.hbReleased=r.released;
        row.dataset.hbLanded=r.landed;
        row.dataset.hbOutside=r.missed;
        const th=txt('th',siteName(site));th.scope='row';row.append(th);
        for (const value of [typeName(type),fraction(r.landed,r.released),r.missed,fraction(r.landed,s.landed)]) {
          row.append(txt('td',value));
        }
      }
    }
    host.replaceChildren(t);
  }
  function chart(host,stats) {
    if (!host) return;
    const figure=txt('figure','','hb-share-chart');
    figure.append(txt('figcaption','Share of seeds that landed on soil, by type (%)'));
    const axis=txt('div','','hb-chart-axis');
    axis.setAttribute('aria-hidden','true');
    for (const tick of ['0%','25%','50%','75%','100%']) axis.append(txt('span',tick));
    figure.append(axis);
    for (const site of SITES) {
      const s=stats[site], row=txt('div','','hb-chart-row');
      row.append(txt('strong',siteName(site)));
      const bar=txt('div','','hb-chart-bar');bar.setAttribute('aria-hidden','true');
      for (const type of Object.keys(TYPES)) {
        const val=s.byType[type].landed;
        const part=txt('span','','hb-chart-part hb-chart-'+type);
        part.style.flexBasis=(s.landed?100*val/s.landed:0)+'%';
        bar.append(part);
      }
      row.append(bar,txt('span',s.landed ?
        'Feathery '+percent(s.byType.feathery.landed,s.landed)+' · Nonfeathery '+percent(s.byType.nonfeathery.landed,s.landed) :
        'No soil landings in this run; a share cannot be found.','hb-chart-values'));
      figure.append(row);
    }
    host.replaceChildren(figure);
  }
  function published(host) {
    if (!host || host.dataset.hbPrepared) return;
    host.dataset.hbPrepared = 'true';
    const preexisting = host.closest('details');
    const panel=txt('div','','hb-source-body');
    panel.append(txt('p',research),txt('p',researchScope));
    if (!preexisting) {
      const details=txt('details','','hb-published-details');
      const citation=txt('a','Cheptou and colleagues (2008) · read the study');
      citation.href=PAPER;
      citation.target='_blank';citation.rel='noopener noreferrer';
      panel.append(citation);
      details.append(txt('summary','Published research · not model data'),panel);
      host.replaceChildren(details);
    } else host.replaceChildren(panel);
  }
  function compareCheck(host,city) {
    if (!host || host.firstElementChild) return;
    const check=txt('details','','hb-denominator-check');
    check.append(txt('summary','Quick check: Which total belongs on the bottom?'));
    const group=txt('fieldset','','hb-denominator-choices');
    group.append(txt('legend','To find the nonfeathery share of city soil landings, which denominator should you use?'));
    const feedback=txt('p','','hb-denominator-feedback');
    feedback.hidden=true;
    for (const [id,label] of [
      ['all','All seeds released in the city'],
      ['type','Only nonfeathery seeds released in the city'],
      ['soil','All seeds that landed on soil in the city']
    ]) {
      const option=txt('label',label), input=txt('input','');
      input.type='radio';input.name='hb-denominator';input.value=id;
      option.prepend(input);group.append(option);
      input.addEventListener('change',()=>{
        const base=id==='all' ? 'That total includes seeds that landed outside soil.' :
          id==='type' ? 'That total would tell you the soil-landing rate for nonfeathery seeds.' : 'Right: compare seeds that landed on soil, not every seed released.';
        const suffix=' Your city result is '+fraction(city.byType.nonfeathery.landed,city.landed)+' of the soil landings.';
        feedback.hidden=false;
        feedback.textContent=base+suffix;
        announce(feedback.textContent);
      });
    }
    check.append(group,feedback);
    host.append(check);
  }
  function forecast(host) {
    if (!host) return;
    const p=txt('p','Your prediction: '+choices[state.prediction]+'. Would you keep or change it after seeing the model? Cite one fraction.','hb-forecast-reflection');
    const old=host.querySelector('.hb-forecast-reflection');
    if (old) old.replaceWith(p);
    else host.append(p);
  }
  function showReleaseResult() {
    const round=state.released;
    const next=$('#hb-release-next');
    setText('#hb-round',(running?round-1:round)+' of '+PAIRS+' matched pairs released');
    if (next) {
      next.disabled=running || round>=PAIRS;
      next.textContent=running ? 'Releasing plant pair '+round+'…' : round === PAIRS ? 'All five pairs released' : 'Release plant pair '+(round+1);
    }
    const host=$('#hb-release-summary');
    if (host) {
      if (round === 0 || running) host.textContent = running ? 'Watch the same seed paths over both maps.' : 'Ready to release the same batch of seeds in both environments.';
      else {
        const parts=SITES.map(site=>{
          const s=L.summarize(trial[site].filter(r=>r.plant===round));
          return siteName(site)+' '+s.landed+' of '+s.released+' ('+s.byType.feathery.landed+' feathery, '+s.byType.nonfeathery.landed+' nonfeathery)';
        });
        host.textContent='Plant pair '+round+' · landings on soil: '+parts.join(' · ')+'.';
      }
    }
  }
  function gates() {
    for (const b of $$('button[data-hb-go], a[data-hb-go], button[data-hb-page], a[data-hb-page]')) {
      const target=b.dataset.hbPage||b.dataset.hbGo;
      const ok=ready(target) && (!running || !['compare','explain'].includes(target));
      if ('disabled' in b) b.disabled=!ok;
      b.setAttribute('aria-disabled',String(!ok));
    }
  }
  function render() {
    gates();
    showReleaseResult();
    if (state.prediction) setText('#hb-prediction-feedback','Prediction saved: '+choices[state.prediction]+'. You can change it and test your thinking with the model.');
    else setText('#hb-prediction-feedback','');
    if (!running && state.released === PAIRS) {
      const s=currentSummary();
      summary($('#hb-compare-summary'),s);table($('#hb-compare-table'),s);chart($('#hb-compare-chart'),s);
      summary($('#hb-explain-summary'),s);table($('#hb-explain-table'),s);chart($('#hb-explain-chart'),s);
      forecast($('#hb-forecast-reflection')||$('#hb-compare-summary'));
      compareCheck($('#hb-compare-check'),s.city);
      for (const host of $$('#hb-published, [data-hb-published]')) {
        host.hidden=false;published(host);
      }
    } else {
      for (const host of $$('#hb-published, [data-hb-published]')) host.hidden=true;
      for (const id of ['compare-summary','compare-table','compare-chart','explain-summary','explain-table','explain-chart','compare-check','forecast-reflection']) $('#hb-'+id)?.replaceChildren();
    }
  }
  function release() {
    if (!state.prediction || running || state.released>=PAIRS) return;
    running=true;
    state.released+=1;
    const pair=state.released;
    const keepFocus=document.activeElement===$('#hb-release-next');
    save();
    render();
    animate(pair,()=>{
      running=false;
      render();
      announce(pair===PAIRS ? 'All five matched pairs are recorded. Compare your results.' :
        'Plant pair '+pair+' recorded. '+$('#hb-release-summary')?.textContent);
      if (keepFocus && state.page==='release' && (document.activeElement===document.body || document.activeElement===$('#hb-release-next'))) {
        const next = pair===PAIRS ? $('[data-hb-go="compare"]', $('#hb-release')) : $('#hb-release-next');
        next?.focus({preventScroll:true});
      }
    });
  }
  function report() {
    const person=window.Lab?.identity?.get?.() || {};
    const lines=['HAWKSBEARD WIND LAB','OpenSciEd Biology B.4 · Lesson 2 companion','Created by Robert Smitka',
      '', 'Name: '+(person.name||''), 'Class period: '+(person.period||''),
      'Dataset: HB-'+state.seed.toString(16).toUpperCase().padStart(8,'0'),
      '', 'Prediction: '+(choices[state.prediction]||'Not recorded'),
      'Matched plant pairs released: '+state.released+' of '+PAIRS,
      '', 'YOUR MODEL RESULTS · SIMULATED', 'Soil landing is a proxy for opportunity to germinate, not a measure of survival or reproduction.'];
    const s=currentSummary();
    for (const site of SITES) {
      for (const type of Object.keys(TYPES)) {
        const r=s[site].byType[type];
        lines.push(siteName(site)+' · '+typeName(type)+': '+fraction(r.landed,r.released)+' on soil; '+r.missed+' outside soil; '+
          fraction(r.landed,s[site].landed)+' of soil landings.');
      }
    }
    if (state.released) {
      lines.push('','MATCHED PAIR RECORD');
      for (let i=1;i<=state.released;i++) {
        lines.push('Plant pair '+i+': '+SITES.map(site=>{
          const stats=L.summarize(trial[site].filter(r=>r.plant===i));
          return siteName(site)+' '+stats.landed+' / '+stats.released+' on soil';
        }).join(' · '));
      }
    }
    if (state.released===PAIRS) lines.push('','PUBLISHED RESEARCH · NOT SIMULATED',research,researchScope,'Source (Cheptou et al., 2008): '+PAPER);
    lines.push('','MY RESPONSES');
    for (const input of answerInputs){
      const id=input.dataset.hbAnswer;
      const title=(input.labels?.[0]?.textContent || id).trim();
      lines.push(title,state.answers[id]||'[No response yet]','');
    }
    return lines.join('\n');
  }
  function copyText(failed=false) {
    const d=$('#hb-copy-dialog'), f=$('#hb-copy-text');
    if (!d || !f) { announce('The report could not open in this browser.');return; }
    f.value=report();
    setText('#hb-copy-hint',(failed?'The file could not be downloaded. ':'')+'Select the report text and use your device’s Copy command.');
    if (!d.open) d.showModal();
    f.focus();f.select();
  }
  function download() {
    try {
      const url=URL.createObjectURL(new Blob([report()],{type:'text/plain;charset=utf-8'}));
      const a=txt('a','');a.href=url;a.download='hawksbeard-wind-lab.txt';document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      announce('Download requested. If no file appears, choose View text to copy.');
    } catch (_) { copyText(true); }
  }
  function fillInputs() {
    for (const field of $$('input[name="hb-prediction"]')) field.checked=field.value===state.prediction;
    for (const f of answerInputs) f.value=state.answers[f.dataset.hbAnswer] || '';
  }
  function reset() {
    if (frame) {cancelAnimationFrame(frame);frame=0;}
    running=false;
    state=fresh();trial=L.makeTrial(state.seed);
    save(true);fillInputs();render();settled();
    $('#hb-reset-dialog')?.close();go('predict',{persist:false});
    if (!blocked) announce('Started a new matched trial on this device.');
  }

  for (const b of $$('button[data-hb-go], a[data-hb-go], button[data-hb-page], a[data-hb-page]')) b.addEventListener('click', event=>{
    event.preventDefault();
    if (b.getAttribute('aria-disabled')==='true') {announce(!state.prediction?'Save a prediction before releasing seeds.':'Release all five matched plant pairs first.');return;}
    go(b.dataset.hbPage||b.dataset.hbGo);
  });
  $('#hb-prediction')?.addEventListener('submit',event=>{
    event.preventDefault();
    const choice=$('input[name="hb-prediction"]:checked',event.currentTarget)?.value;
    if (!isOwn(choices,choice)) {announce('Choose field, city, or about the same first.');return;}
    state.prediction=choice;render();go('release');
    if (!blocked&&!preserved) announce('Prediction saved. Release your first matched pair when ready.');
  });
  for (const f of answerInputs) f.addEventListener('input',()=>{
    state.answers[f.dataset.hbAnswer]=f.value.slice(0,8000);save();
  });
  $('#hb-release-next')?.addEventListener('click',release);
  $('#hb-download')?.addEventListener('click',download);
  $('#hb-copy')?.addEventListener('click',()=>copyText(false));
  $('#hb-copy-select')?.addEventListener('click',async ()=>{
    const f=$('#hb-copy-text');if (!f) return;
    f.focus(); f.select();
    try {
      await navigator.clipboard.writeText(f.value);
      setText('#hb-copy-hint','Copied. Paste the report wherever you want to keep it.');
    } catch (_) {
      setText('#hb-copy-hint','The text is selected. Use your device’s Copy command.');
    }
  });
  $('#hb-restart')?.addEventListener('click',()=>$('#hb-reset-dialog')?.showModal());
  $('#hb-reset-confirm')?.addEventListener('click',event=>{event.preventDefault();reset();});
  for (const b of $$('[data-hb-close]')) b.addEventListener('click',event=>{
    event.preventDefault();b.closest('dialog')?.close();
  });
  window.addEventListener('hashchange',()=>{
    const target=location.hash.slice(1);
    if (PAGES.includes(target) && !go(target)) go(state.page,{focus:false,persist:false});
  });
  try { if ($('#hb-identity')) window.Lab?.identity?.mount?.('#hb-identity'); } catch (_) {}
  trial=L.makeTrial(state.seed);
  fillInputs();
  settled();
  render();
  const requested=location.hash.slice(1);
  const page=PAGES.includes(requested) && ready(requested) ? requested : state.page;
  go(page,{focus:false,persist:false});
  if (preserved) {
    setText('#hb-save-status','Unreadable saved trial preserved');
    announce('The earlier record is unreadable and has not been overwritten. Download your current session before leaving or explicitly restart.');
  } else if (blocked) {
    setText('#hb-save-status','Device storage unavailable');
    announce('This browser cannot access saved work. Download your report before closing the page.');
  }
})();
