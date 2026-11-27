(() => {
  'use strict';
  const M=window.RippleLogic, api=window.OpenSciEdSaveSession;
  const KEY='aplab:openscied:b1-ripple:v1', scope='b1-ripple';
  const $=id=>document.getElementById(id), rp=id=>$('rp-'+id);
  const buildEl=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text??''});
  const say=t=>{rp('status').textContent=t;};
  if(!M){say('The model did not load. Reload this page to try again.');return;}
  const short=t=>typeof t==='string'?t.slice(0,1800):'';
  const fresh=()=>({v:1,seed:crypto.getRandomValues(new Uint32Array(1))[0],answers:[],moved:[],checked:false,choice:'',reason:'',predicted:false,usual:false,fewer:false,claim:'',limit:'',finished:false,step:'build',lastVisitedAt:0});
  const ready=s=>s.checked&&M.correct(s.answers);
  const prediction=s=>ready(s)&&s.predicted&&s.reason.trim()&&['decrease','same','increase'].includes(s.choice);
  const done=s=>prediction(s)&&s.usual&&s.fewer;
  const validFinished=s=>done(s)&&s.finished&&s.claim.trim()&&s.limit.trim();
  let s=fresh(), broken=false, round=0, session, usable=false;
  try {
    session=api.open(localStorage,scope,[KEY]);
    const raw=session.read(KEY);
    if(raw!==null){
      const x=JSON.parse(raw);
      if(x?.v!==1||!Number.isInteger(x.seed)||x.seed<0||x.seed>4294967295||!Array.isArray(x.answers))throw Error('Invalid record');
      s={...s,seed:x.seed,answers:M.links.map((_,i)=>[1,-1].includes(x.answers[i])?x.answers[i]:0),choice:short(x.choice),
        reason:short(x.reason),claim:short(x.claim),limit:short(x.limit),step:x.step,moved:x.moved,lastVisitedAt:Number(x.lastVisitedAt)||0};
      for(const k of ['checked','predicted','usual','fewer','finished'])s[k]=x[k]===true;
    }
    s.moved=Array.isArray(s.moved)?[...new Set(s.moved.filter(i=>Number.isInteger(i)&&i>=0&&i<4))].slice(0,s.fewer?2:1):[];
    if(s.fewer&&s.moved.length!==2)s.moved=[0,1];
    usable=session.check(KEY).ok;
  }catch(_){broken=true;}
  const student=api?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
  const notice=()=>{const check=session?.check(KEY);usable=!broken&&!!check?.ok;
    rp('save').textContent=usable?'Progress stays in this browser. Reports are separate classroom copies.':
      'This tab cannot save over the work on this device. Use Preview report to keep a recovery copy.';
  };
  function save(){
    s.lastVisitedAt=Date.now();
    const result=!broken&&session?.write(KEY,JSON.stringify(s));notice();
    if(!result?.ok)say('Not saved. Use Preview report to keep a recovery copy.');
    else student();
  }
  const title={build:'Build the web',compare:'Predict and run',explain:'Explain the ripple'};
  const available=step=>step==='build'||step==='compare'&&ready(s)||step==='explain'&&done(s);
  function navigate(next,focus=true){
    s.step=available(next)?next:'build';
    if(focus){stop();herdChoice=null;clearLink();say('');save();}
    render();
    if(focus)$(s.step+'-title').focus();
  }
  const svgNS='http://www.w3.org/2000/svg';
  const icon=k=>'<svg aria-hidden="true" viewBox="0 0 48 48">'+window.RippleIcons[k]+'</svg>';
  const boardNote=t=>{rp('board-note').textContent=t;};
  let source='', pending=-1, herdChoice=null, timer;
  const nodes={};
  // Pointer drag for mouse, touch and pen. Buttons also support selection by tap or keyboard.
  function draggable(el,target,onDrop){
    let start,ghost,trail,hover,blockClick=false;
    el.addEventListener('click',ev=>{if(blockClick&&ev.detail){ev.stopImmediatePropagation();ev.preventDefault();}},true);
    el.addEventListener('pointerdown',ev=>{if(!ev.isPrimary||ev.button!==0||el.disabled)return;blockClick=false;start=[ev.clientX,ev.clientY,ev.pointerId];el.setPointerCapture(ev.pointerId);});
    el.addEventListener('pointermove',ev=>{
      if(!start||start[2]!==ev.pointerId)return;
      if(!ghost&&Math.hypot(ev.clientX-start[0],ev.clientY-start[1])>7){
        ghost=el.cloneNode(true);ghost.removeAttribute('id');ghost.classList.add('rp-ghost');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;
        document.body.append(ghost);
        if(el.dataset.node){
          trail=document.createElementNS(svgNS,'line');trail.classList.add('rp-trail');trail.setAttribute('marker-end','url(#rp-arrow)');rp('threads').append(trail);
        }
      }
      if(!ghost)return;
      ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px';
      hover?.classList.remove('rp-drop-hover');
      hover=document.elementFromPoint(ev.clientX,ev.clientY)?.closest(target);
      if(hover!==el&&!hover?.contains(el))hover?.classList.add('rp-drop-hover');
      if(trail){
        const box=rp('threads').getBoundingClientRect(),origin=el.getBoundingClientRect();
        for(const [key,val] of Object.entries({x1:origin.left+origin.width/2-box.left,y1:origin.top+origin.height/2-box.top,x2:ev.clientX-box.left,y2:ev.clientY-box.top}))trail.setAttribute(key,val);
      }
    });
    function finish(ev){
      if(!start||start[2]!==ev.pointerId)return;
      start=null;
      if(!ghost)return;
      ghost.remove();ghost=null;trail?.remove();trail=null;hover?.classList.remove('rp-drop-hover');hover=null;blockClick=true;
      if(ev.type==='pointerup')onDrop(document.elementFromPoint(ev.clientX,ev.clientY)?.closest(target));
    }
    el.addEventListener('pointerup',finish);el.addEventListener('pointercancel',finish);
    el.addEventListener('lostpointercapture',finish);
    el.addEventListener('pointerleave',ev=>{if(!ghost&&ev.pointerType==='mouse')start=null;});
  }
  const clues=[
    'Start with the visiting wildebeest. What do they leave behind after they eat?',
    'Start with the dung supply. Which insect uses it to feed and raise its young?',
    'Start with dung beetle activity. Where do some dung beetles bury the dung they collect?',
    'Start with dung-derived soil inputs. Which living part of the patch can take up nutrients through roots?',
    'Start with the visiting wildebeest. Which part of the patch do they eat directly?',
    'Start with the visiting wildebeest. How might having more prey nearby affect how often predators come across one?'
  ];
  function drawProgress(){
    const left=M.links.filter((l,i)=>s.answers[i]!==l.sign).length, count=M.links.length-left;
    const next=left===0?'Web complete! Continue to your prediction.':left===1?'One more connection to make!':left===6?'Find six arrows to finish your web.':left+' connections to go.';
    rp('count').textContent=count+' of '+M.links.length+' connections';
    if(rp('next').textContent!==next)rp('next').textContent=next;
    rp('hint').hidden=left===0;
  }
  function closeClue(){
    rp('hint').textContent='Get a hint';rp('hint').setAttribute('aria-expanded','false');
    rp('clue').hidden=true;
  }
  rp('hint').onclick=()=>{
    if(!rp('clue').hidden){closeClue();return;}
    const i=M.links.findIndex((l,j)=>s.answers[j]!==l.sign);
    if(i<0)return;
    rp('clue').textContent=clues[i];rp('clue').hidden=false;
    rp('hint').textContent='Hide hint';rp('hint').setAttribute('aria-expanded','true');
  };
  function selected(k){
    source=k;
    Object.entries(nodes).forEach(([name,n])=>n.setAttribute('aria-pressed',String(name===k)));
  }
  function clearLink(){pending=-1;selected('');rp('link-editor').hidden=true;}
  function connect(from,to){
    if(!to||from===to){clearLink();boardNote('End the arrow on a different part of the patch.');return;}
    clearLink();
    const i=M.links.findIndex(l=>l.from===from&&l.to===to);
    if(i<0){boardNote(M.names[from]+' → '+M.names[to]+': no direct link in this model. Try one step in between, or reverse your arrow.');return;}
    if(s.answers[i]===M.links[i].sign){boardNote('Already connected. '+M.links[i].why);return;}
    pending=i;selected(from);
    rp('link-editor').hidden=false;rp('link-prompt').textContent=(from==='herd'?'When more wildebeest visit':from==='beetles'?'When dung beetles are more active':'When there is more '+M.names[from].toLowerCase())+', what happens to '+M.names[to].toLowerCase()+'?';
    rp('more').focus();
  }
  M.keys.forEach(k=>{
    const el=buildEl('button');el.type='button';el.className='rp-node';el.dataset.node=k;el.setAttribute('aria-pressed','false');
    el.innerHTML=icon(k);el.append(buildEl('span',M.names[k]));rp('nodes').append(el);nodes[k]=el;
    draggable(el,'[data-node]',end=>connect(k,end?.dataset.node));
    el.onclick=()=>{
      if(source){connect(source,k);return;}
      selected(k);boardNote('Now select what '+M.names[k].toLowerCase()+' directly affects.');
    };
  });
  rp('cancel-link').onclick=()=>{const was=source;clearLink();boardNote('Arrow canceled. Start with any part of the patch.');nodes[was]?.focus();};
  function setLink(sign){
    if(pending<0)return;
    const link=M.links[pending], target=nodes[link.to];
    if(sign!==link.sign){boardNote('Try the other direction. '+link.why);return;}
    s.answers[pending]=sign;s.checked=M.correct(s.answers);
    clearLink();closeClue();save();drawWeb();drawProgress();rp('to-compare').disabled=!ready(s);
    boardNote((s.checked?'All six arrows are connected. ':'Arrow placed. ')+link.why);
    target.focus();
  }
  rp('more').onclick=()=>setLink(1);rp('less').onclick=()=>setLink(-1);
  function drawWeb(){
    const canvas=rp('threads'), zone=canvas.getBoundingClientRect();
    canvas.querySelectorAll('line:not(.rp-trail)').forEach(n=>n.remove());rp('web').replaceChildren();
    for(const [i,l] of M.links.entries()){
      if(s.answers[i]!==l.sign)continue;
      const word=l.sign===1?'increases':'decreases';
      const item=buildEl('li');
      item.append(buildEl('strong',M.names[l.from]+' → '+M.names[l.to]+' ('+word+')'),buildEl('p',l.why));
      rp('web').append(item);
      if(!zone.width)continue;
      const a=nodes[l.from].getBoundingClientRect(),b=nodes[l.to].getBoundingClientRect();
      const ax=a.left+a.width/2, ay=a.top+a.height/2, bx=b.left+b.width/2, by=b.top+b.height/2;
      const dx=bx-ax,dy=by-ay;
      const edge=(w,h)=>Math.min(w/2/Math.abs(dx),h/2/Math.abs(dy));
      const offA=edge(a.width,a.height),offB=edge(b.width+20,b.height+20);
      const line=document.createElementNS(svgNS,'line');
      for(const [k,v] of Object.entries({x1:ax+dx*offA-zone.left,y1:ay+dy*offA-zone.top,x2:bx-dx*offB-zone.left,y2:by-dy*offB-zone.top,'marker-end':'url(#rp-arrow)'}))line.setAttribute(k,v);
      line.dataset.sign=l.sign;canvas.append(line);
    }
    if(!s.answers.some((x,i)=>x===M.links[i]?.sign))rp('web').append(buildEl('li','No connections yet. Build six arrows.'));
  }
  if(typeof ResizeObserver==='function')new ResizeObserver(drawWeb).observe(rp('map'));
  const herdTokens=Array.from({length:4},(_,i)=>{
    const el=buildEl('button');el.type='button';el.className='rp-herd';el.setAttribute('aria-label','Wildebeest group '+(i+1)+' (one quarter of the visitors)');el.innerHTML=icon('herd')+icon('herd');
    draggable(el,'.rp-plot',end=>end?.contains(rp('refuge'))&&moveHerd(i));
    el.onclick=()=>{herdChoice=herdChoice===i?null:i;drawHerd();};
    return el;
  });
  function drawHerd(){
    herdTokens.forEach((el,i)=>{
      const moved=s.moved.includes(i),parent=moved?rp('away'):rp('stay');
      if(el.parentElement!==parent)parent.append(el);
      el.disabled=moved||s.fewer;el.setAttribute('aria-pressed',String(herdChoice===i));
    });
    rp('refuge').disabled=s.fewer;
  }
  function moveHerd(i){
    if(!prediction(s)||s.fewer||s.moved.includes(i))return;
    herdChoice=null;s.moved.push(i);s.fewer=s.moved.length>=2;
    if(s.fewer)round=0;
    save();render();
    if(s.fewer){if(usable)say('Two groups moved. Watch how half as many visitors change the study patch.');play();}
    else{if(usable)say('One group moved. Move one more to halve the number of visitors.');herdTokens.find(t=>!t.disabled)?.focus();}
  }
  rp('refuge').onclick=()=>{if(herdChoice!==null)moveHerd(herdChoice);else if(usable)say('Select a wildebeest group on the study patch first.');};
  const highlights=[
    ['Same starting patch','Before the visit, both runs for the study patch start at 100. Nothing downstream has changed yet.'],
    ['Fewer visitors arrive','Only the number of visiting wildebeest changes first. The other parts of the web take time to respond.'],
    ['Wildebeest → dung, grass, and predators','Fewer animals leave less dung, eat less grass, and give predators fewer opportunities to come across prey. These are direct effects: each takes one arrow.'],
    ['Dung → beetle activity','With less dung available, beetles have fewer places to feed and lay eggs. Wildebeest don’t have to interact with the beetles to affect them. The dung connects them.'],
    ['Beetles → dung returned to the soil','Some dung beetles bury dung as they feed and nest. With less beetle activity, less dung gets buried.'],
    ['Soil nutrients → grass','As buried dung breaks down, roots can take up the nutrients it releases. Less buried dung can mean less nutrient input, so standing grass drops from its earlier peak in the model.'],
    ['Grass responds to two different effects','Less grazing leaves more grass at first. Later, less nutrient input works in the opposite direction. Compare grass at steps 2 and 6 in the fewer-visitors run.'],
    ['Follow the chain','Fewer wildebeest → less dung → less beetle activity → less dung buried. Trace an indirect effect using the same model step for both runs.']
  ];
  const delay=2200;
  function showStep(){
    const [a,b]=scenarios(),usual=a[round],fewer=b[round];
    rp('tick').value=round+' / '+M.steps;rp('scrub').setAttribute('aria-valuetext','Step '+round+' of '+M.steps);rp('scrub').value=String(round);rp('cause').textContent=highlights[round][0];rp('what').textContent=highlights[round][1];
    rp('scene').replaceChildren(...M.keys.map(k=>{
      const item=buildEl('div');item.className='rp-observation';item.dataset.kind=k;
      const n=fewer[k], old=b[Math.max(0,round-1)][k];
      item.dataset.changed=String(old!==n);item.innerHTML=icon(k);
      item.append(buildEl('strong',M.names[k]),buildEl('span',usual[k]+' → '+n+(usual[k]===n?' · same':usual[k]>n?' ↓':' ↑')));
      return item;
    }));
  }
  function stop(){clearInterval(timer);timer=undefined;rp('replay').textContent='Replay ripple';}
  function play(){
    stop();round=0;render();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    rp('replay').textContent='Pause ripple';
    timer=setInterval(()=>{round++;render();if(round>=M.steps)stop();},delay);
  }
  rp('scrub').max=M.steps;
  rp('scrub').oninput=()=>{stop();round=Number(rp('scrub').value);render();};
  rp('replay').onclick=()=>{if(timer)stop();else play();};
  rp('replay').hidden=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scenarios=()=>[M.run(s.seed,100),M.run(s.seed,50)];
  function dataRows(n){
    const [a,b]=scenarios();
    return M.keys.map(k=>[M.names[k],s.usual?a[n][k]:'Not run',s.fewer?b[n][k]:'Not run']);
  }
  function compareTable(holder){
    const t=buildEl('table'),caption=buildEl('caption','Simulated component indices · start = 100');
    t.className='rp-results-table';t.append(caption);
    const heads=buildEl('thead'),tr=buildEl('tr'); heads.append(tr);t.append(heads);
    for(const h of ['Component','Usual visit','Fewer visitors']){const th=buildEl('th',h);th.scope='col';tr.append(th);}
    const body=buildEl('tbody');
    for(const [label,a,b] of dataRows(round)){
      const tr2=buildEl('tr'),th=buildEl('th',label);th.scope='row';tr2.append(th,buildEl('td',a));
      const cell=buildEl('td',b);
      if(typeof a==='number'&&typeof b==='number'&&a!==b)cell.textContent=String(b)+(b<a?' ↓':' ↑');
      tr2.append(cell);body.append(tr2);
    }
    t.append(body);
    const label=buildEl('label');label.append(document.createTextNode('Model step '));
    const sel=buildEl('select');sel.setAttribute('aria-label','Model step');sel.id='rp-step-select-'+holder.id;
    for(let i=0;i<=M.steps;i++){const o=buildEl('option',i===0?'0 · before the visit':String(i));o.value=String(i);sel.append(o);}
    sel.value=String(round);label.append(sel);
    sel.addEventListener('change',()=>{
      round=Number(sel.value);render();document.getElementById(sel.id)?.focus();
    });
    holder.replaceChildren(label,t,buildEl('p','Compare the same component at the same step. These indices come from this companion’s model for OpenSciEd B.1 Lesson 8, not Serengeti field counts. ↓ and ↑ compare the fewer-visitors run with the usual visit.'));
  }
  function render(){
    for(const step of Object.keys(title))$(step).hidden=s.step!==step;
    document.querySelectorAll('button[data-step]').forEach(btn=>{
      btn.disabled=!available(btn.dataset.step);
      if(btn.dataset.step===s.step)btn.setAttribute('aria-current','step');else btn.removeAttribute('aria-current');
    });
    rp('to-compare').disabled=!ready(s);
    rp('form').querySelector('button').disabled=!!prediction(s);
    rp('experiment').hidden=!prediction(s);
    rp('observe').hidden=!done(s);
    if(prediction(s))drawHerd();
    if(done(s))showStep();
    rp('to-explain').disabled=!done(s);
    rp('finish').disabled=!done(s)||!s.claim.trim()||!s.limit.trim()||!!validFinished(s);
    rp('finish-note').textContent=validFinished(s)?'Investigation complete. Use Preview report to submit your work.':'Write both responses to finish.';
    rp('results').hidden=!s.usual;
    if(s.usual&&s.step==='compare')compareTable(rp('results'));
    if(done(s)&&s.step==='explain')compareTable(rp('evidence'));
    drawWeb();drawProgress();
  }
  document.querySelectorAll('button[data-step]').forEach(btn=>btn.onclick=()=>navigate(btn.dataset.step));
  rp('to-compare').onclick=()=>navigate('compare');
  rp('to-explain').onclick=()=>navigate('explain');
  for(const key of ['choice','reason','claim','limit']){
    const el=rp(key);el.value=s[key];
    el.addEventListener('input',()=>{s[key]=short(el.value);if(key==='choice'||key==='reason'){stop();herdChoice=null;s.moved=[];s.predicted=false;s.usual=false;s.fewer=false;}s.finished=false;save();render();});
  }
  rp('form').addEventListener('submit',e=>{
    e.preventDefault();if(!ready(s)||!s.choice||!s.reason.trim()||prediction(s))return;
    s.predicted=true;s.usual=true;round=0;save();render();
    if(usable)say('Prediction saved. First, the usual visit is recorded. Now move two groups to test fewer visitors.');
    herdTokens[0].focus();
  });
  rp('finish').onclick=()=>{if(!done(s)||!s.claim.trim()||!s.limit.trim())return;s.finished=true;save();render();if(usable)say('Your report is ready.');};
  rp('reset').onclick=()=>rp('dialog').showModal();
  rp('clear').onclick=()=>{const n=fresh(), result=session?.reset(KEY,JSON.stringify(n));
    if(result?.ok){location.reload();return;}
    rp('dialog').close();say('Could not clear your work from this tab. Refresh and try again.');};
  window.addEventListener('storage',notice);window.addEventListener('pageshow',notice);
  const report=()=>({title:'Serengeti Ripple Effects',unit:'OpenSciEd Biology B.1 · Lesson 8 supplement',source:'Fictional local teaching model. Simulated indices, not field measurements.',
    status:broken||!session?.check(KEY)?.ok?'recovery':validFinished(s)?'final':'draft',student:student(),datasetId:'SR-'+s.seed.toString(16).toUpperCase().padStart(8,'0'),
    missing:[!ready(s)&&'Check the six connections.',!prediction(s)&&'Save a prediction.',!done(s)&&'Record both runs.',!validFinished(s)&&'Finish both explanations.'].filter(Boolean),
    sections:[{title:'My predictions and explanations',items:[
      {type:'answer',prompt:'Dung beetle prediction',value:s.choice},{type:'answer',prompt:'Reason',value:s.reason},
      {type:'answer',prompt:'Trace a ripple',value:s.claim},{type:'answer',prompt:'Model limit',value:s.limit}]},
      {title:'My evidence',items:[
        {type:'table',title:'Connections',columns:['From','To','My prediction'],rows:M.links.map((l,i)=>[M.names[l.from],M.names[l.to],s.answers[i]===1?'Increases':s.answers[i]===-1?'Decreases':'Not answered'])},
        ...Array.from({length:M.steps+1},(_,i)=>i).filter(()=>s.usual).map(i=>({type:'table',title:'Step '+i+' · simulated index',columns:['Component','Usual visit','Fewer visitors'],rows:dataRows(i)}))]}]});
  navigate(s.step,false);notice();
  window.OpenSciEdSubmission?.mount({target:'#rp-report',collect:report,filename:'serengeti-ripple-effects'});
})();
