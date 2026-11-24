(() => {
  'use strict';
  const M=window.RippleLogic, api=window.OpenSciEdSaveSession;
  const KEY='aplab:openscied:b1-ripple:v1', scope='b1-ripple';
  const $=id=>document.getElementById(id), rp=id=>$('rp-'+id);
  const buildEl=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text??''});
  const say=t=>{rp('status').textContent=t;};
  if(!M){say('The model did not load. Reload this page to try again.');return;}
  const short=t=>typeof t==='string'?t.slice(0,1800):'';
  const fresh=()=>({v:1,seed:crypto.getRandomValues(new Uint32Array(1))[0],answers:[],checked:false,choice:'',reason:'',predicted:false,usual:false,fewer:false,claim:'',limit:'',finished:false,step:'build',lastVisitedAt:0});
  const ready=s=>s.checked&&M.correct(s.answers);
  const prediction=s=>ready(s)&&s.predicted&&s.reason.trim()&&['decrease','same','increase'].includes(s.choice);
  const done=s=>prediction(s)&&s.usual&&s.fewer;
  const validFinished=s=>done(s)&&s.finished&&s.claim.trim()&&s.limit.trim();
  let s=fresh(), broken=false, round=M.steps, session, usable=false;
  try {
    session=api.open(localStorage,scope,[KEY]);
    const raw=session.read(KEY);
    if(raw!==null){
      const x=JSON.parse(raw);
      if(x?.v!==1||!Number.isInteger(x.seed)||x.seed<0||x.seed>4294967295||!Array.isArray(x.answers))throw Error('Invalid record');
      s={...s,seed:x.seed,answers:M.links.map((_,i)=>[1,-1].includes(x.answers[i])?x.answers[i]:0),choice:short(x.choice),
        reason:short(x.reason),claim:short(x.claim),limit:short(x.limit),step:x.step,lastVisitedAt:Number(x.lastVisitedAt)||0};
      for(const k of ['checked','predicted','usual','fewer','finished'])s[k]=x[k]===true;
    }
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
    if(focus){say('');save();}
    render();
    if(focus)$(s.step+'-title').focus();
  }
  const feedback=[];
  M.links.forEach((link,i)=>{
    const field=buildEl('fieldset');field.className='rp-edge';
    field.append(buildEl('legend',M.names[link.from]+' increases → '+M.names[link.to]));
    for(const [value,label] of [[1,'Increases'],[-1,'Decreases']]){
      const wrap=buildEl('label'), input=buildEl('input');input.type='radio';input.name='rp-link-'+i;input.value=String(value);
      input.checked=s.answers[i]===value; wrap.append(input,document.createTextNode(label));field.append(wrap);
      input.addEventListener('change',()=>{
        s.answers[i]=value;s.checked=false;s.predicted=false;s.usual=false;s.fewer=false;s.finished=false;save();render();
      });
    }
    const f=buildEl('p');f.className='rp-feedback';field.append(f);feedback.push(f);rp('links').append(field);
  });
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
    holder.replaceChildren(label,t,buildEl('p','Compare the same component at the same step. Values are indices, not counts of animals. ↓ and ↑ compare the fewer-visitors run with the usual visit.'));
  }
  function render(){
    for(const step of Object.keys(title))$(step).hidden=s.step!==step;
    document.querySelectorAll('button[data-step]').forEach(btn=>{
      btn.disabled=!available(btn.dataset.step);
      if(btn.dataset.step===s.step)btn.setAttribute('aria-current','step');else btn.removeAttribute('aria-current');
    });
    rp('to-compare').disabled=!ready(s);
    rp('baseline').disabled=!prediction(s)||s.usual;
    rp('fewer').disabled=!s.usual||s.fewer;
    rp('to-explain').disabled=!done(s);
    rp('finish').disabled=!done(s)||!s.claim.trim()||!s.limit.trim()||!!validFinished(s);
    rp('finish-note').textContent=validFinished(s)?'Investigation complete. Use Preview report to submit your work.':'Write both responses to finish.';
    rp('results').hidden=!s.usual;
    if(s.usual)compareTable(rp('results'));
    if(done(s))compareTable(rp('evidence'));
    rp('web').replaceChildren();
    M.links.forEach((l,i)=>{
      const right=s.answers[i]===l.sign;
      feedback[i].textContent=!s.checked?'':right?'✓ '+l.why:'Try again. '+l.why;
      if(s.checked&&right)rp('web').append(buildEl('li',M.names[l.from]+' → '+M.names[l.to]+' ('+(l.sign===1?'increases':'decreases')+')'));
    });
    if(!s.checked)rp('web').append(buildEl('li','Choose effects and check the connections.'));
  }
  rp('check').onclick=()=>{s.checked=true;save();if(usable)say(ready(s)?'All six connections are correct.':'Read the clues beside any links you missed.');render();};
  document.querySelectorAll('button[data-step]').forEach(btn=>btn.onclick=()=>navigate(btn.dataset.step));
  rp('to-compare').onclick=()=>navigate('compare');
  rp('to-explain').onclick=()=>navigate('explain');
  for(const key of ['choice','reason','claim','limit']){
    const el=rp(key);el.value=s[key];
    el.addEventListener('input',()=>{s[key]=short(el.value);if(key==='choice'||key==='reason'){s.predicted=false;s.usual=false;s.fewer=false;}s.finished=false;save();render();});
  }
  rp('form').addEventListener('submit',e=>{e.preventDefault();if(!ready(s)||!s.choice||!s.reason.trim())return;s.predicted=true;save();render();if(usable)say('Prediction saved. Run the usual migration first.');});
  rp('baseline').onclick=()=>{if(!prediction(s))return;s.usual=true;round=M.steps;save();render();if(usable)say('Usual visit recorded. Run fewer visitors to compare.');};
  rp('fewer').onclick=()=>{if(!s.usual)return;s.fewer=true;round=M.steps;save();render();if(usable)say('Comparison recorded. Check an earlier step or explain the ripple.');};
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
