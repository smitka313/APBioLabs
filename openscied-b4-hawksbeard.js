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
  const announce = (value,{quiet=false}={}) => {
    const target = $('#hb-status');
    if (target) {
      target.classList?.toggle('sr-only',quiet);
      target.textContent = value;
    }
  };
  const setText = (selector, value) => { const target = $(selector); if (target) target.textContent = value; };
  const isOwn = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
  const answerInputs = $$('[data-hb-answer]');
  const denominatorPrompt='To find the nonfeathery share of city soil landings, which denominator should you use?';
  const denominatorChoices={
    all:'All seeds released in the city',
    type:'Only nonfeathery seeds released in the city',
    soil:'All seeds that landed on soil in the city'
  };
  function newSeed() {
    try { return window.crypto.getRandomValues(new Uint32Array(1))[0]; }
    catch (_) { return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0; }
  }
  const DETAIL_IDS=['hb-method','hb-published','hb-denominator-check'];
  const PERSON_LIMITS={name:100,period:24};
  const fresh = () => ({v:1,seed:newSeed(),page:'predict',lastSection:'predict',lastVisitedAt:0,prediction:'',released:0,denominatorChoice:'',answers:{},person:{},disclosures:{}});
  const cleanField = (value,max) => value.trim().replace(/\s+/g,' ').slice(0,max);
  const datasetId = seed => 'HB-'+seed.toString(16).toUpperCase().padStart(8,'0');
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
    const person={},disclosures={};
    for (const [field,max] of Object.entries(PERSON_LIMITS)) {
      if (typeof s.person?.[field]==='string') person[field]=cleanField(s.person[field],max);
    }
    for (const id of DETAIL_IDS) {
      if (typeof s.disclosures?.[id]==='boolean') disclosures[id]=s.disclosures[id];
    }
    return {...s,denominatorChoice:s.released===PAIRS&&isOwn(denominatorChoices,s.denominatorChoice)?s.denominatorChoice:'',answers,person,disclosures,page:PAGES.includes(s.page) ? s.page : 'predict'};
  }
  const scope='b4-hawksbeard', guard=window.OpenSciEdSaveSession;
  let session;
  // Other tabs can browse lessons or open help without changing the saved trial.
  // The save guard still rejects any change to work/identity or any explicit reset.
  try {session=guard?.open(window.localStorage,scope,[KEY],undefined,{
    routeMetadata:['page','lastSection','lastVisitedAt','disclosures']
  });} catch (_) {}
  const sharedReportIdentity=guard?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.() ?? null) ?? (()=>null);
  let state = fresh(), preserved = false, blocked = false, running = false, frame = 0, trial;
  let warned='';
  try {
    const raw = session?.read(KEY) ?? null;
    if (raw !== null) {
      try { state = restore(raw); } catch (_) { preserved = true; }
    }
  } catch (_) { blocked = true; }
  function notSaved(reason) {
    blocked=true;
    const text=reason==='changed' ? 'A newer copy of this activity was saved in another tab. This tab will not overwrite it.' :
      reason==='erased' ? 'Saved work was cleared on this device. This tab will not bring it back.' :
      'This browser could not save the work in this tab.';
    const message=text+' Download a copy before closing this tab.';
    $('#hb-save-warning').hidden=false;
    setText('#hb-save-warning-text',message);
    setText('#hb-save-status','Not saved · download a copy');
    if(warned!==message) {warned=message;announce(message);}
    return false;
  }
  function saved() {
    blocked=false;preserved=false;warned='';
    sharedReportIdentity();
    $('#hb-save-warning').hidden=true;
    setText('#hb-save-status','Work saved on this device');
    return true;
  }
  function save() {
    state.lastSection = state.page;
    state.lastVisitedAt = Date.now();
    if (preserved) {
      setText('#hb-save-status','An older trial is preserved. Download this session before leaving.');
      return false;
    }
    const result=session?.write(KEY,JSON.stringify(state));
    return result?.ok ? saved() : notSaved(result?.reason);
  }
  const siteName = site => site === 'field' ? 'Field' : 'City';
  const typeName = type => TYPES[type];
  const percent = (n,d) => d ? (100*n/d).toLocaleString('en-US',{maximumFractionDigits:1})+'%' : 'Not applicable';
  const fraction = (n,d) => d ? n+' / '+d+' ('+percent(n,d)+')' : n+' / '+d+' (no denominator)';
  const records = (site, count = state.released) => trial[site].filter(r => r.plant <= count);
  const tally = (site, count = state.released) => L.summarize(records(site,count));
  const ready = page => page === 'predict' || (page === 'release' ? !!state.prediction :
    state.released === PAIRS && (page !== 'explain' || !!state.answers.reflection?.trim()));
  const nextStepHint = () => !state.prediction ? 'Save a prediction first.' :
    state.released < PAIRS ? 'Release all five matched plant pairs first.' :
      'Write your comparison reflection before opening Explain.';
  function go(page,{focus=true,persist=true} = {}) {
    if (!PAGES.includes(page) || !ready(page)) {
      if (focus) announce(nextStepHint());
      if (focus) return false;
      page = ready('compare') ? 'compare' : state.prediction ? 'release' : 'predict';
    }
    if (page!==state.page) announce('');
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
  // Ground textures, paths in flight, and marks clarify the experiment without
  // changing patch membership, positions, or how any landing is counted.
  const W = 640, H = 350;
  const at = p => [p.x*W,p.y*H];
  const cap = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  function drawScene(host,site) {
    const layout=L.layouts[site], city=site==='city', stem='hb-'+site;
    const titleId='hb-scene-'+site+'-title', descId='hb-scene-'+site+'-desc';
    const canvas=svg('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-labelledby':titleId+' '+descId,class:'hb-scene-svg'});
    const title=svg('title',{id:titleId}), desc=svg('desc',{id:descId});
    title.textContent=siteName(site)+' seed release from above';
    canvas.append(title,desc);
    const defs=svg('defs');
    const gradient=(id,top,bottom)=>{
      const shade=svg('linearGradient',{id,x1:0,x2:1,y1:0,y2:1});
      shade.append(svg('stop',{offset:0,'stop-color':top}),svg('stop',{offset:1,'stop-color':bottom}));
      defs.append(shade);
    };
    gradient(stem+'-ground',city?'#84928e':'#898b60',city?'#526469':'#4b6444');
    gradient(stem+'-bed',city?'#815f3f':'#687844',city?'#513d30':'#3f5639');
    const soil=svg('pattern',{id:stem+'-soil',width:63,height:47,patternUnits:'userSpaceOnUse'});
    soil.append(svg('path',{d:city?'M2 18l6-2m4 19l7 2m11-28 5-2m14 21 8-1m-8 13 4 1':'M3 20l9-4m13 10 5-7m16-15 7 3m-7 29 7-2',
      fill:'none',stroke:city?'#c79f68':'#9ba768','stroke-width':1.4,opacity:.53}));
    const flecks=city?[[3,7,1],[19,25,1.8],[25,41,1],[39,15,1.5],[59,42,1.7]]:[[5,39,1.3],[17,8,1.4],[29,37,1.4],[46,22,1.2],[57,8,1.1]];
    for (const [cx,cy,r] of flecks) soil.append(svg('circle',{cx,cy,r,fill:city?'#392d28':'#334a2b',opacity:.58}));
    defs.append(soil);
    canvas.append(defs,svg('rect',{width:W,height:H,fill:'url(#'+stem+'-ground)'}));

    const scenery=svg('g',{class:'hb-scene-scenery','aria-hidden':'true'});
    if (city) {
      // Street edge and curb above the two measured soil footprints.
      scenery.append(svg('rect',{width:W,height:57,fill:'#394950'}),
        svg('path',{d:'M0 21H640',stroke:'#bfbe94','stroke-width':2,'stroke-dasharray':'33 24',opacity:.55}),
        svg('path',{d:'M0 53H640',stroke:'#1f3035','stroke-width':7,opacity:.52}),
        svg('path',{d:'M0 59H640M0 293H640',stroke:'#c1bfb1','stroke-width':7}),
        svg('path',{d:'M0 64H640M0 289H640',stroke:'#46565a','stroke-width':2,opacity:.85}),
        svg('rect',{y:299,width:W,height:51,fill:'#44555a',opacity:.78}),
        svg('path',{d:'M0 320H640',stroke:'#788781','stroke-width':2,opacity:.55}));
      for (const y of [87,134,181,228,275]) scenery.append(svg('path',{d:'M0 '+y+'H640',stroke:'#e1e1cc','stroke-width':1.35,opacity:.34}));
      for (let ci=0;ci<6;ci++) for (let x=ci%2===0?53:108;x<W;x+=111) {
        const y=64+ci*39;
        scenery.append(svg('path',{d:'M'+x+' '+y+'v39',stroke:'#263a40','stroke-width':1.25,opacity:.28}));
      }
      for (const x of [37,605]) {
        scenery.append(svg('rect',{x,y:309,width:20,height:18,rx:2,fill:'#273a41',stroke:'#86908a','stroke-width':1}));
        scenery.append(svg('path',{d:'M'+(x+5)+' 311v14m5-14v14m5-14v14',stroke:'#89988e','stroke-width':1,opacity:.7}));
      }
    } else {
      scenery.append(svg('path',{d:'M-20 284C119 249 212 305 346 283S567 270 673 222L663 359H-20Z',fill:'#334e38',opacity:.72}),
        svg('path',{d:'M0 65C143 8 306 51 418 30S571 24 640 12',fill:'none',stroke:'#d1bc77','stroke-width':14,opacity:.22}),
        svg('path',{d:'M0 297C118 275 232 324 347 292S565 281 640 259',fill:'none',stroke:'#afaf6b','stroke-width':4,opacity:.42}));
      for (let i=0;i<18;i++) {
        const x=(21+i*79)%W, y=i%2===0?46+(i%4)*6:314+(i%5)*4;
        scenery.append(svg('path',{transform:'translate('+x+' '+y+')',d:'M-10 0Q-7-10-11-15M0 0Q5-10 1-18m2 15q4-9 10-11',
          fill:'none',stroke:i%2===0?'#d1bd7e':'#9baf74','stroke-width':2,'stroke-linecap':'round',opacity:.68}));
      }
    }
    canvas.append(scenery);

    const soils=svg('g',{'aria-hidden':'true',class:'hb-scene-soil'});
    for (const patch of layout.soil) {
      const bounds={x:patch.x*W,y:patch.y*H,width:patch.width*W,height:patch.height*H};
      soils.append(svg('rect',{...bounds,fill:'url(#'+stem+'-bed)',stroke:city?'#d6b788':'#b1bf82',
          'stroke-width':city?3.2:2.4,'data-hb-footprint':patch.id}),
        svg('rect',{...bounds,fill:'url(#'+stem+'-soil)'}));
      if (city) {
        const left=bounds.x, right=left+bounds.width, top=bounds.y, bottom=top+bounds.height;
        soils.append(svg('path',{d:'M'+left+' '+top+'H'+right+'M'+left+' '+top+'V'+bottom,
          stroke:'#eee0bb','stroke-width':2,'stroke-linecap':'square',opacity:.66}));
      }
    }
    canvas.append(soils);

    const [rx,ry]=at(layout.release);
    const plant=svg('g',{transform:'translate('+rx+' '+ry+')','aria-hidden':'true',class:'hb-scene-plant','data-hb-plant-state':'ready'});
    const pulse=svg('circle',{r:31,fill:'none',stroke:'#fcdf70','stroke-width':3.5,opacity:0,class:'hb-launch-pulse'});
    plant.append(svg('circle',{r:25,fill:'#233b2c',opacity:.8,stroke:'#e4d8a0','stroke-width':2,'stroke-dasharray':'4 4'}),
      svg('path',{d:'M-37 0h7m60 0h7M0-37v7m0 60v7',stroke:'#ffdf7a','stroke-width':3,fill:'none','stroke-linecap':'round'}),
      pulse);
    for(const a of [0,82,166,244]) plant.append(svg('path',{d:'M0-3C-8-7-9-18 0-22c8 6 8 14 0 19 Z',transform:'rotate('+a+')',
      fill:'#8da960',stroke:'#34432a','stroke-width':1.3}));
    plant.append(svg('circle',{r:7,fill:'#f9db65',stroke:'#5e4b29','stroke-width':1.7}),
      svg('circle',{r:2.9,fill:'#846226'}));

    const wind=layout.wind;
    const norm=Math.hypot(wind.dx,wind.dy)||1, gx=wind.dx/norm, gy=wind.dy/norm;
    const cx=W-90, cy=37, wx=cx+gx*53, wy=cy+gy*14;
    const windKey=svg('g',{'aria-hidden':'true',class:'hb-scene-wind'});
    windKey.append(svg('rect',{x:W-215,y:8,width:204,height:57,rx:10,fill:'#1d3338',stroke:'#d2dec7','stroke-width':1.8}));
    const label=svg('text',{x:W-202,y:47,fill:'#f6fae9','font-family':'system-ui,sans-serif','font-size':32,'font-weight':700});
    label.textContent='Wind';
    windKey.append(label,svg('path',{d:'M'+cx+' '+cy+'L'+wx+' '+wy+'m'+(-gx*12+gy*8)+' '+(-gy*12-gx*7)+'L'+wx+' '+wy+'l'+(-gx*12-gy*8)+' '+(-gy*12+gx*7),
      fill:'none',stroke:'#f6fae9','stroke-width':3.8,'stroke-linecap':'round','stroke-linejoin':'round'}));
    const trails=svg('g',{'aria-hidden':'true',class:'hb-scene-trails'});
    const past=svg('g',{'aria-hidden':'true',class:'hb-scene-past'});
    const current=svg('g',{'aria-hidden':'true',class:'hb-scene-current'});
    canvas.append(windKey,trails,plant,past,current);
    host.replaceChildren(canvas);
    return {site,desc,trails,plant,pulse,past,current};
  }
  const scenes=$$('[data-hb-scene]').filter(host=>SITES.includes(host.dataset.hbScene)).map(host=>drawScene(host,host.dataset.hbScene));
  function seedGlyph(type, earlier=false) {
    const feathery=type==='feathery';
    if (earlier) return [feathery
      ? svg('circle',{r:4.7,fill:'#f3eedc',stroke:'#233337','stroke-width':2})
      : svg('path',{d:'M0-5 5 0 0 5-5 0Z',fill:'#e8b864',stroke:'#252e2c','stroke-width':2})];
    if (feathery) {
      const d='M0 8V-1m0-1-8-6m8 6-4-10m4 10 4-10m-4 10 8-6';
      return [svg('path',{d,fill:'none',stroke:'#162c30','stroke-width':7,'stroke-linecap':'round'}),
        svg('path',{d,fill:'none',stroke:'#fffbe8','stroke-width':3.9,'stroke-linecap':'round'})];
    }
    return [svg('path',{d:'M0-9 7.5 0 0 9-7.5 0Z',fill:'#ffc55e',stroke:'#352f26','stroke-width':2.7}),
      svg('path',{d:'M0-4.5 2.4 0 0 4.5-2.4 0Z',fill:'#a96c36'})];
  }
  function mark(record,phase='latest') {
    const g=svg('g',{class:'hb-seed hb-seed-'+record.type,'data-hb-seed':record.id,'data-hb-fresh':phase});
    if (phase!=='flying') g.dataset.hbLand=record.land;
    if (phase==='latest') {
      if (record.landed) g.append(svg('circle',{r:15,fill:'#223c32','fill-opacity':.68,stroke:'#162e2b','stroke-width':6}),
        svg('circle',{r:15,fill:'none',stroke:'#f6ffdf','stroke-width':3.3}));
      else {
        const d='M7 7l11 11m0-11L7 18';
        g.append(svg('path',{d,fill:'none',stroke:'#302c2c','stroke-width':7,'stroke-linecap':'round'}),
          svg('path',{d,fill:'none',stroke:'#ffdfc5','stroke-width':3.6,'stroke-linecap':'round'}));
      }
    }
    g.append(...seedGlyph(record.type,phase==='earlier'));
    return g;
  }
  function position(record,p) {
    const [x0,y0]=at(record.start), [x1,y1]=at(record.end);
    return [cap(x0+(x1-x0)*p,2,W-2),cap(y0+(y1-y0)*p-23*Math.sin(Math.PI*p)*p,2,H-2)];
  }
  function place(node,record,p=1) {
    const [x,y]=position(record,p);
    node.setAttribute('transform','translate('+x.toFixed(2)+' '+y.toFixed(2)+')');
  }
  function trailInk(type) {
    const feathery=type==='feathery';
    return {stroke:feathery?'#e9f6de':'#ffd07c',dash:feathery?'1 10':'6 8'};
  }
  function trail(record,p) {
    const {stroke,dash}=trailInk(record.type);
    const attributes={fill:'none','stroke-linecap':'round','stroke-linejoin':'round',class:'hb-seed-trail hb-seed-trail-'+record.type};
    const shadow=svg('path',{...attributes,class:'hb-seed-trail-shadow',stroke:'#203131','stroke-width':5.8,opacity:.35,
      'stroke-dasharray':dash});
    const ink=svg('path',{...attributes,stroke,'stroke-width':3.1,opacity:.8,
      'stroke-dasharray':dash});
    const update=value=>{
      const d=Array.from({length:10},(_,i)=>(i?'L':'M')+position(record,value*i/9).map(t=>t.toFixed(2)).join(' ')).join('');
      shadow.setAttribute('d',d);ink.setAttribute('d',d);
    };
    update(p);
    return {shadow,ink,update};
  }
  // Use the same icon renderer and dash patterns as the real board, not approximations.
  for (const type of Object.keys(TYPES)) {
    const key = svg('svg',{viewBox:'0 0 60 30',focusable:false});
    const {stroke,dash}=trailInk(type);
    const seed = svg('g',{transform:'translate(45 16)'});
    seed.append(...seedGlyph(type));
    key.append(svg('path',{d:'M6 17H32',stroke,'stroke-dasharray':dash,'stroke-width':3.1,'stroke-linecap':'round'}),seed);
    $('[data-hb-key-seed="'+type+'"]')?.append(key);
    const earlier = svg('svg',{viewBox:'-9 -8 18 16',focusable:false});
    earlier.append(...seedGlyph(type,true));
    $('[data-hb-key-earlier="'+type+'"]')?.append(earlier);
  }
  function settled(count=state.released) {
    for (const scene of scenes) {
      const area=siteName(scene.site);
      const old=records(scene.site,Math.max(0,count-1)).map(r=>{const m=mark(r,'earlier');place(m,r);return m;});
      const batch=count ? records(scene.site,count).filter(r=>r.plant===count) : [];
      const now=batch.map(r=>{const m=mark(r);place(m,r);return m;});
      const paths=batch.map(r=>trail(r,1));
      scene.trails.replaceChildren(...paths.map(t=>t.shadow),...paths.map(t=>t.ink));
      scene.plant.dataset.hbPlantState=count?'landed':'ready';
      scene.pulse.setAttribute('opacity',0);
      scene.past.replaceChildren(...old);
      scene.current.replaceChildren(...now);
      const stats=tally(scene.site,count);
      scene.desc.textContent=(scene.site==='field'?'Broad area of suitable soil. ':'Small soil patches separated by pavement. ')+
        count+' of '+PAIRS+' matched pairs released. '+area+': '+stats.landed+' of '+stats.released+' model seeds landed on soil. '+
        (count?'The newest paths are shown with dotted feather tracks and dashed heavier seed tracks.':'The ring marks the parent plant and release point.');
    }
  }
  function animate(pair,done) {
    if (motion.matches || !scenes.length) { settled(pair);done();return; }
    const items=[];
    for (const scene of scenes) {
      const old=records(scene.site,pair-1).map(r=>{const m=mark(r,'earlier');place(m,r);return m;});
      scene.past.replaceChildren(...old);
      scene.trails.replaceChildren();
      scene.current.replaceChildren();
      scene.plant.dataset.hbPlantState='releasing';
      const batch=trial[scene.site].filter(r=>r.plant===pair);
      batch.forEach((record,i)=>{
        const node=mark(record,'flying'), path=trail(record,0);
        place(node,record,0);
        scene.current.append(node);
        scene.trails.append(path.shadow,path.ink);
        items.push({record,node,path,delay:Math.min(i*16,250)});
      });
    }
    let start;
    function tick(clock) {
      if (start==null) start=clock;
      const elapsed=clock-start;
      for (const scene of scenes) {
        const p=cap(elapsed/460,0,1);
        scene.pulse.setAttribute('r',(28+22*p).toFixed(1));
        scene.pulse.setAttribute('opacity',(0.92*(1-p)).toFixed(2));
      }
      for (const item of items) {
        const t=cap((elapsed-item.delay)/(item.record.type==='feathery'?675:455),0,1), p=1-Math.pow(1-t,1.5);
        place(item.node,item.record,p);item.path.update(p);
      }
      if (elapsed<940 && !motion.matches) frame=requestAnimationFrame(tick);
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
    for (const s of ['Layout','Seed type','On soil / released','Missed soil','Share of soil landings']) {
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
    figure.append(txt('figcaption','Of the seeds that reached soil, what share came from each type?'));
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
    const details = host.tagName === 'DETAILS' ? host : txt('details', '', 'hb-published-details');
    if (!details.querySelector('summary')) details.append(txt('summary', 'Published research · not model data'));
    const panel = txt('div', '', 'hb-source-body');
    panel.dataset.hbSourceContent = 'true';
    const citation = txt('a', 'Cheptou and colleagues (2008) · read the study');
    citation.href = PAPER;
    citation.target = '_blank';
    citation.rel = 'noopener noreferrer';
    panel.append(txt('p', research), txt('p', researchScope), citation);
    details.append(panel);
    if (details !== host) host.replaceChildren(details);
  }
  function rememberDisclosure(details) {
    if (!details || details.dataset.hbRemember) return;
    details.dataset.hbRemember='true';
    details.open=!!state.disclosures[details.id];
    details.addEventListener('toggle',()=>{
      if (details.open===!!state.disclosures[details.id]) return;
      state.disclosures[details.id]=details.open;save();
    });
  }
  function compareCheck(host,city) {
    if (!host || host.firstElementChild) return;
    const check=txt('details','','hb-denominator-check');check.id='hb-denominator-check';
    check.append(txt('summary','Quick check: Which total belongs on the bottom?'));
    const group=txt('fieldset','','hb-denominator-choices');
    group.append(txt('legend',denominatorPrompt));
    const feedback=txt('p','','hb-denominator-feedback');
    feedback.hidden=true;
    function showAnswer(id,notify=false){
      if (!isOwn(denominatorChoices,id)) return;
      const base=id==='all' ? 'That total includes seeds that landed outside soil.' :
        id==='type' ? 'That total would tell you the soil-landing rate for nonfeathery seeds.' : 'Right: compare seeds that landed on soil, not every seed released.';
      feedback.hidden=false;
      feedback.textContent=base+' Your city result is '+fraction(city.byType.nonfeathery.landed,city.landed)+' of the soil landings.';
      if (notify) announce(feedback.textContent,{quiet:true});
    }
    for (const [id,label] of Object.entries(denominatorChoices)) {
      const option=txt('label',''), input=txt('input','');
      input.type='radio';input.name='hb-denominator';input.value=id;input.checked=id===state.denominatorChoice;
      option.append(input,txt('span',label));group.append(option);
      input.addEventListener('change',()=>{
        state.denominatorChoice=id;
        if(save())showAnswer(id,true);else showAnswer(id);
      });
    }
    showAnswer(state.denominatorChoice);
    check.append(group,feedback);
    host.append(check);rememberDisclosure(check);
  }
  function recordedAnswers() {
    const done=id=>!!state.answers[id]?.trim();
    return {predict:!!state.prediction,release:state.released===PAIRS&&!running,
      compare:done('reflection'),explain:['claim','evidence','limits'].every(done)};
  }
  function renderCompletion() {
    const done=recordedAnswers();
    for (const [i,button] of $$('.hb-steps [data-hb-go]').entries()) {
      const complete=done[button.dataset.hbGo];
      if (complete) button.setAttribute('data-hb-complete','true');
      else button.removeAttribute('data-hb-complete');
      const icon=$('.hb-step-mark',button), text=$('.hb-step-completion',button);
      if (icon) { icon.textContent=complete?'✓':String(i+1);icon.classList.toggle('hb-step-check',complete); }
      if (text) text.hidden=!complete;
    }
  }
  function observations(stats) {
    const f=stats.field.byType.nonfeathery,c=stats.city.byType.nonfeathery;
    const counts='Nonfeathery seeds on soil: '+f.landed+' of '+f.released+' in the field and '+c.landed+' of '+c.released+' in the city.';
    const all=f.landed===f.released && c.landed===c.released;
    setText('#hb-type-observation',counts+(all?' Every nonfeathery seed reached soil in this trial.':'')+
      ' Compare both layouts before deciding whether either seed type has an advantage.');
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
    $('#hb-explain-hint').hidden=ready('explain');
    for (const b of $$('button[data-hb-go], a[data-hb-go], button[data-hb-page], a[data-hb-page]')) {
      const target=b.dataset.hbPage||b.dataset.hbGo;
      const ok=ready(target) && (!running || !['compare','explain'].includes(target));
      if ('disabled' in b) b.disabled=!ok;
      b.setAttribute('aria-disabled',String(!ok));
    }
  }
  function render() {
    gates();renderCompletion();
    setText('#hb-dataset-id',datasetId(state.seed));
    showReleaseResult();
    updatePredictionButton();
    if (state.prediction) setText('#hb-prediction-feedback','Your starting prediction: '+choices[state.prediction]+'. '+(state.released>0
      ? 'Use Compare to say whether your results changed your mind.'
      : 'You can edit this before the first release.'));
    else setText('#hb-prediction-feedback','');
    if (!running && state.released === PAIRS) {
      const s=currentSummary();
      summary($('#hb-compare-summary'),s);table($('#hb-compare-table'),s);chart($('#hb-compare-chart'),s);
      summary($('#hb-explain-summary'),s);table($('#hb-explain-table'),s);chart($('#hb-explain-chart'),s);
      setText('#hb-forecast-reflection','Your prediction: '+choices[state.prediction]+'.');observations(s);
      compareCheck($('#hb-compare-check'),s.city);
      for (const host of $$('#hb-published, [data-hb-published]')) {
        host.hidden=false;published(host);rememberDisclosure(host);
      }
    } else {
      for (const host of $$('#hb-published, [data-hb-published]')) host.hidden=true;
      for (const id of ['compare-summary','compare-table','compare-chart','explain-summary','explain-table','explain-chart','compare-check','forecast-reflection','type-observation']) $('#hb-'+id)?.replaceChildren();
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
  function reportPerson() {
    const shared=sharedReportIdentity() || {};
    return {...shared,...state.person};
  }
  function fillPerson() {
    const person=reportPerson();
    for (const field of Object.keys(PERSON_LIMITS)) {
      const input=$('#hb-'+field);
      if (input) input.value=person[field]||'';
    }
  }
  function submissionReport() {
    const done=recordedAnswers(), missing=[];
    if(!done.predict)missing.push('Save a prediction.');
    if(!done.release)missing.push('Finish releasing all five matched plant pairs.');
    if(!done.compare)missing.push('Write your comparison reflection.');
    for(const [id,label] of [['claim','claim'],['evidence','evidence response'],['limits','model limits response']])
      if(!state.answers[id]?.trim())missing.push('Write your '+label+'.');

    const summary=currentSummary(), keyResults=[];
    const simulated=[{type:'text',text:'Soil landing is a proxy for an opportunity to germinate, not a measure of actual germination, survival, or reproduction. The modeled field and city differ in the amount of suitable soil as well as its arrangement.'}];
    if(state.released) {
      for(const site of SITES) {
        const counts=summary[site];
        keyResults.push({label:siteName(site)+' nonfeathery share of soil landings',value:fraction(counts.byType.nonfeathery.landed,counts.landed),note:'Simulated · share among all seeds that landed on soil.'});
      }
      const detailRows=SITES.flatMap(site=>Object.keys(TYPES).map(type=>{
        const siteStats=summary[site], r=siteStats.byType[type];
        return [siteName(site),typeName(type),r.landed,r.released,r.missed,fraction(r.landed,siteStats.landed)];
      }));
      const pairRows=Array.from({length:state.released},(_,i)=>[
        i+1,...SITES.map(site=>{
          const group=L.summarize(trial[site].filter(record=>record.plant===i+1));
          return fraction(group.landed,group.released);
        })
      ]);
      simulated.push({type:'table',title:'Released seeds and landings by environment',columns:['Environment','Seed type','On soil','Released','Outside soil','Share of all soil landings'],rows:detailRows},
        {type:'table',title:'Matched plant pairs recorded',columns:['Pair','Field on soil / released','City on soil / released'],rows:pairRows});
    } else simulated.push({type:'text',text:'No completed seed releases yet.'});

    const sections=[
      {title:'Prediction and classroom responses',items:[
        {type:'answer',prompt:$('#hb-prediction legend')?.textContent?.trim()||'Prediction',value:choices[state.prediction]||''},
        ...answerInputs.map(f=>({type:'answer',prompt:(f.labels?.[0]?.textContent||f.dataset.hbAnswer).trim(),value:state.answers[f.dataset.hbAnswer]||''})),
        ...(state.denominatorChoice?[{type:'answer',prompt:denominatorPrompt,value:denominatorChoices[state.denominatorChoice]}]:[])
      ]},
      {title:'Model data · simulated',items:simulated}
    ];
    if(state.released===PAIRS)sections.push({title:'Published research · separate from the model',items:[
      {type:'text',text:research},{type:'text',text:researchScope},{type:'text',text:'Cheptou et al. (2008): '+PAPER}
    ]});
    const {name,period}=reportPerson();
    return {title:'Hawksbeard Wind Lab',unit:'OpenSciEd Biology B.4 · Lesson 2',source:'Independent OpenSciEd companion by Robert Smitka. Classroom seed releases are simulated.',
      status:preserved||!session?.check(KEY)?.ok?'recovery':missing.length?'draft':'final',missing,student:{name:name||'',period:period||''},datasetId:datasetId(state.seed),keyResults,sections};
  }
  function report() {
    const person=reportPerson();
    const lines=['HAWKSBEARD WIND LAB','OpenSciEd Biology B.4 · Lesson 2 companion','Created by Robert Smitka',
      '', 'Name: '+(person.name||''), 'Class period: '+(person.period||''),
      'Dataset: '+datasetId(state.seed),
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
    if(state.denominatorChoice)lines.push(denominatorPrompt,denominatorChoices[state.denominatorChoice],'');
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
      announce('Download requested. If no file appears, choose Copy investigation.');
    } catch (_) { copyText(true); }
  }
  function fillInputs() {
    for (const field of $$('input[name="hb-prediction"]')) field.checked=field.value===state.prediction;
    updatePredictionButton();
    for (const f of answerInputs) f.value=state.answers[f.dataset.hbAnswer] || '';
    fillPerson();
  }
  function updatePredictionButton() {
    const picked = $('input[name="hb-prediction"]:checked')?.value;
    const locked=state.released>0;
    for(const radio of $$('input[name="hb-prediction"]')){
      radio.disabled=locked;
      if(locked)radio.checked=radio.value===state.prediction;
    }
    $('#hb-save-prediction').hidden=locked;
    $('#hb-save-prediction').disabled=locked||!isOwn(choices,picked);
    $('#hb-prediction-hint').hidden=locked||isOwn(choices,picked);
  }
  function reset() {
    const next={...fresh(),lastVisitedAt:Date.now()}, result=session?.reset(KEY,JSON.stringify(next));
    if(!result?.ok) {$('#hb-reset-dialog')?.close();return notSaved(result?.reason);}
    if (frame) {cancelAnimationFrame(frame);frame=0;}
    running=false;
    state=next;trial=L.makeTrial(state.seed);
    for (const id of DETAIL_IDS) {const details=$('#'+id);if(details) details.open=false;}
    saved();fillInputs();render();settled();
    $('#hb-reset-dialog')?.close();go('predict',{persist:false});
    if (!blocked) announce('Started a new matched trial on this device.');
  }

  for (const b of $$('button[data-hb-go], a[data-hb-go], button[data-hb-page], a[data-hb-page]')) b.addEventListener('click', event=>{
    event.preventDefault();
    if (b.getAttribute('aria-disabled')==='true') {announce(nextStepHint());return;}
    go(b.dataset.hbPage||b.dataset.hbGo);
  });
  $('#hb-prediction')?.addEventListener('change',updatePredictionButton);
  $('#hb-prediction')?.addEventListener('submit',event=>{
    event.preventDefault();
    if(state.released>0){updatePredictionButton();announce('The starting prediction is locked. Record a change of mind in Compare.');return;}
    const choice=$('input[name="hb-prediction"]:checked',event.currentTarget)?.value;
    if (!isOwn(choices,choice)) {announce('Choose field, city, or about the same first.');return;}
    state.prediction=choice;render();go('release');
    if (!blocked&&!preserved) announce('Prediction saved. Release your first matched pair when ready.');
  });
  for (const f of answerInputs) {
    f.addEventListener('input',()=>{
      state.answers[f.dataset.hbAnswer]=f.value.slice(0,8000);renderCompletion();gates();save();
    });
    f.addEventListener('blur',()=>{f.scrollTop=0;});
  }
  for (const [field,max] of Object.entries(PERSON_LIMITS)) {
    const input=$('#hb-'+field);
    input?.addEventListener('input',()=>{state.person[field]=cleanField(input.value,max);save();});
  }
  rememberDisclosure($('#hb-method'));
  $('#hb-release-next')?.addEventListener('click',release);
  window.addEventListener('beforeprint',fillPerson);
  $('#hb-download')?.addEventListener('click',download);
  $('#hb-download-tab')?.addEventListener('click',download);
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
  }
  const monitorSave=()=>{
    const result=session?.check(KEY);
    if(!result?.ok) notSaved(result?.reason);
  };
  window.addEventListener('storage',event=>{
    if(!event.key||event.key===KEY||(guard&&[guard.globalKey,guard.scopeKey(scope),guard.resetKey(KEY)].includes(event.key))) monitorSave();
  });
  window.addEventListener('pageshow',monitorSave);
  monitorSave();
  window.OpenSciEdSubmission?.mount({target:"#hb-submission-report",collect:submissionReport,filename:"hawksbeard-wind-lab"});
})();
