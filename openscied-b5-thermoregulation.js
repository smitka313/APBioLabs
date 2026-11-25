'use strict';
(()=>{
  const KEY='aplab:openscied:b5-thermoregulation:v1', route=['field','treadmill','human','model'];
  const qs={
    predict:'Predict what might happen at a shared food source, and why.',
    field:'Revise the field prediction with an observation and one thing not measured.',
    pattern:'Compare two treadmill speeds using numbers and revisit the overheating claim.',
    human:'Compare the human temperature pattern and possible cooling mechanisms.',
    explain:'Use field and lab evidence and propose a test of the overheating explanation.'
  };
  const data=[[1.1,360,0,0],[1.6,375,4.3,7],[2,375,71,19],[2.2,375,117,24]];
  // Approximate readings digitized from the printed diagram, not the raw sensor data.
  const core=[{speed:1.4,temp:36.5,x:89,y:292},{speed:1.6,temp:36.8,x:245,y:276},{speed:1.8,temp:37.6,x:400,y:220},{speed:2,temp:38.5,x:556,y:164},{speed:2.1,temp:39.6,x:633,y:94,edge:true}];
  const BLOCK=120000, timerZero=()=>({round:0,elapsed:0,start:0});
  const times=[0,2,4,6,8], sample=[32.6,32.8,33.1,33,32.9], sampleB=[33,33.2,33.1,33,32.9];
  const practice=()=>times.flatMap((_,i)=>[String(sample[i]),String(sampleB[i])]);
  const cards=[['heat','♨','Heat transferred'],['oxygen','O₂','Oxygen'],['water','H₂O','Water'],['usable','ATP','Energy for cell work'],['glucose','C₆H₁₂O₆','Glucose'],['carbon','CO₂','Carbon dioxide']];
  const destinations={matterIn:'Matter in',matterOut:'Matter out',energy:'Energy transferred'};
  const expected={oxygen:'matterIn',glucose:'matterIn',water:'matterOut',carbon:'matterOut',usable:'energy',heat:'energy'};
  const fields=Object.keys(qs), checks=['breaks','core','wild'], pairs=['polar-brown','brown-black','polar-black'];
  const clean=s=>typeof s==='string'?s.slice(0,4000):'';
  const reading=s=>s!==''&&Number.isFinite(Number(s))&&Number(s)>=0&&Number(s)<=60?s:'';
  const fresh=()=>({v:1,id:Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase(),fields:{},step:'field',pair:pairs[0],row:0,check:'',mode:'class',hum:Array(10).fill(''),ownHum:Array(10).fill(''),timer:timerZero(),sort:{},lastVisitedAt:0,lastSection:'field'});
  let s=fresh(),session,blocked=false,selected='',anim,timerTick;
  try{
    session=window.OpenSciEdSaveSession?.open(localStorage,'b5-thermoregulation',[KEY]);
    const raw=session?.read(KEY);
    if(raw){
      const v=JSON.parse(raw);if(v?.v!==1||!/^[0-9A-F]{8}$/.test(v.id))throw Error('invalid saved data');
      s={...s,id:v.id,step:route.includes(v.step)?v.step:'field',pair:pairs.includes(v.pair)?v.pair:pairs[0],row:Number.isInteger(v.row)&&data[v.row]?v.row:0,check:checks.includes(v.check)?v.check:'',mode:v.mode==='practice'?'practice':'class',hum:s.hum.map((_,i)=>reading(clean(v.hum?.[i]))),lastVisitedAt:Number(v.lastVisitedAt)||0};
      s.ownHum=s.ownHum.map((_,i)=>reading(clean((Array.isArray(v.ownHum)?v.ownHum:v.mode==='practice'?[]:v.hum)?.[i])));
      s.hum=s.mode==='practice'?practice():s.ownHum;
      const t=v.timer;
      if(Number.isInteger(t?.round)&&t.round>=0&&t.round<=4){
        s.timer={round:t.round,elapsed:t.round<4?Math.max(0,Math.min(BLOCK,Number(t.elapsed)||0)):0,
          start:t.round<4&&Number.isFinite(t.start)&&t.start>0&&t.start<=Date.now()?t.start:0};
      }
      for(const k of fields)s.fields[k]=clean(v.fields?.[k]);
      for(const [k,z] of Object.entries(expected))if(v.sort?.[k]===z)s.sort[k]=z;
    }
  }catch(_){blocked=true;}
  if(s.mode==='class')s.hum=s.ownHum;
  const all=q=>[...document.querySelectorAll(q)], $=id=>document.getElementById('th-'+id);
  const canSave=()=>!blocked&&session?.check(KEY).ok;
  const identity=window.OpenSciEdSaveSession?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
  const hasWork=()=>Object.values(s.fields).some(v=>v.trim())||s.ownHum.some(Boolean)||s.mode==='practice'||Object.keys(s.sort).length||!!s.check||!!s.timer.start||!!s.timer.elapsed||!!s.timer.round;
  function resetButton(){$('reset').disabled=!canSave()||!hasWork();}
  function save(){
    s.lastVisitedAt=Date.now();s.lastSection=s.step;
    if(!canSave()||!session.write(KEY,JSON.stringify(s)).ok)$('save').textContent='This tab cannot save. Preview your report to keep a copy.';
    resetButton();
  }
  const evidence={
    'polar-brown':['Barter Island, Alaska · September 2005–2007','Researchers saw 137 polar–brown (grizzly) bear interactions at bowhead whale remains. In 97 of them, a grizzly approached without overt aggression and one or more polar bears gave way. Of the other 40 encounters, 32 involved aggression and 8 were other nonaggressive encounters. This shows a common outcome at that site, not why it happened.','https://doi.org/10.1093/jmammal/gyv140','Miller, Wilder & Wilson (2015)'],
    'brown-black':['Brown and black bears · Lesson 2 comparison','Brown and black bears share some habitat and food sources but may use them differently or at different times. In Yellowstone, one documented observation involved a grizzly preying on a black bear. This is a different place and food source from the Barter Island study.','https://www.nps.gov/yell/learn/upload/YS_10_4_sm.pdf','National Park Service · Yellowstone Science'],
    'polar-black':['Polar and black bears · Gap in the evidence','The lesson does not provide direct interaction data for this pair. Different habitat use is one possible reason they might meet less often; it is not proof they never meet.',null,'']
  };
  function node(tag,txt){const n=document.createElement(tag);if(txt)n.textContent=txt;return n;}
  function field(){
    const [heading,body,url,label]=evidence[s.pair],box=$('case');
    box.replaceChildren(node('h3',heading),node('p',body));
    if(url){const a=node('a',label);a.href=url;box.append(a);}
    all('[data-pair]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.pair===s.pair));
  }
  function treadmill(replay=false){
    const [speed,on,off,n]=data[s.row];all('[data-row]').forEach((b,i)=>b.setAttribute('aria-pressed',i===s.row));
    $('reading').textContent=speed.toFixed(1)+' m/s · '+off.toFixed(1)+' minutes off the treadmill · '+n+' '+(n===1?'break':'breaks')+'. '+(n?'The bear could leave the belt and eat snow.':'No breaks were recorded at this speed.');
    $('bear-data').replaceChildren(...data.map(([speed,on,off,n],i)=>{
      const row=node('tr');row.dataset.active=i===s.row;const th=node('th',speed.toFixed(1));th.scope='row';row.append(th,...[on,off.toFixed(1),n].map(v=>node('td',String(v))));return row;
    }));
    $('bars').replaceChildren(...data.map(([speed,_,off],i)=>{
      const row=node('div');row.className='th-bar-row';row.dataset.active=i===s.row;
      const track=node('div');track.className='th-track';track.setAttribute('aria-hidden','true');
      const bar=node('div');bar.className='th-bar';bar.style.width=(off/120*100)+'%';track.append(bar);
      row.append(node('span',speed.toFixed(1)+' m/s'),track,node('span',off.toFixed(1)+' min'));return row;
    }));
    const scene=$('scene'),cadence=1.42/speed;
    scene.style.setProperty('--cadence',cadence.toFixed(3)+'s');
    scene.style.setProperty('--opposite',(-cadence/2).toFixed(3)+'s');
    scene.style.setProperty('--belt-rate',(0.46/speed).toFixed(3)+'s');
    walk(replay);
  }
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  function walk(play){
    clearTimeout(anim);
    const button=$('walk'),playing=play&&!motion.matches;
    $('scene').dataset.running=String(playing);
    button.textContent=playing?'Stop walk':'Play walk';
    button.disabled=motion.matches;
    $('motion-note').textContent=motion.matches?'Motion is off because this device prefers reduced motion.':data[s.row][0].toFixed(1)+' m/s selected. Faster settings show a quicker stride.';
    if(playing)anim=setTimeout(()=>walk(false),5000);
  }
  motion.addEventListener('change',()=>walk(false));
  $('walk').onclick=()=>walk($('scene').dataset.running!=='true');
  const feedback={
    breaks:'Yes. Faster trials in this table had more breaks and more time off, consistent with a need to cool down.',
    core:'The table gives break counts and minutes off, not a core temperature for each speed.',
    wild:'The treadmill tests exercise indoors. The field study did not record internal temperatures or isolate heat from other explanations.'
  };
  function renderCheck(){$('check').textContent=feedback[s.check]||'';all('[data-check]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.check===s.check));}
  const svg=(tag,attrs,t='')=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);n.textContent=t;return n;};
  function plot(){
    const p=$('human-plot'),raw=s.hum.filter(x=>x!=='').map(Number);
    p.replaceChildren();
    if(!raw.length){p.append(svg('text',{x:20,y:90,fill:'currentColor'},'No readings yet. Enter a reading or load practice data.'));return;}
    const lo=Math.floor(Math.min(...raw))-1,hi=Math.ceil(Math.max(...raw))+1;
    const x=i=>58+92*i,y=v=>151-123*(v-lo)/(hi-lo);
    p.append(svg('path',{d:'M58 27V151H426',stroke:'currentColor',fill:'none'}));
    times.forEach((t,i)=>p.append(svg('text',{x:x(i),y:171,'text-anchor':'middle',fill:'currentColor','font-size':16},String(t))));
    for(const v of [lo, (lo+hi)/2,hi])p.append(svg('text',{x:49,y:y(v)+4,'text-anchor':'end',fill:'currentColor','font-size':14},String(v)));
    p.append(svg('text',{x:242,y:194,'text-anchor':'middle',fill:'currentColor','font-size':16},'Time (min)'),svg('text',{x:8,y:17,fill:'currentColor','font-size':14},'°C'));
    for(let col=0;col<2;col++){
      const color=col?'#d67e44':'#3c9f9f';
      for(let i=0;i<times.length;i++){
        const v=s.hum[i*2+col];if(v==='')continue;
        const yy=y(Number(v)),xx=x(i),previous=i?s.hum[(i-1)*2+col]:'';
        if(previous!=='')p.append(svg('line',{x1:x(i-1),x2:xx,y1:y(Number(previous)),y2:yy,stroke:color,'stroke-width':4,'stroke-dasharray':col?'7 5':'none'}));
        p.append(col?svg('rect',{x:xx-5,y:yy-5,width:10,height:10,fill:color,stroke:'currentColor'}):svg('circle',{cx:xx,cy:yy,r:5,fill:color,stroke:'currentColor'}));
      }
    }
  }
  function drawCore(el){
    const img=node('img');img.src='assets/openscied-b5-treadmill-source.webp';img.width=655;img.height=420;img.loading='lazy';
    img.alt='Printed core temperature graph. Approximate Celsius values: 36.5 at 1.4 meters per second, 36.8 at 1.6, 37.6 at 1.8, 38.5 at 2.0, and 39.6 near the right edge at about 2.1.';
    const overlay=svg('svg',{viewBox:'0 0 655 420','aria-hidden':'true'});
    core.forEach(({x,y,temp,edge})=>{overlay.append(svg('circle',{cx:x,cy:y,r:5,class:'th-point'}),svg('text',{x:edge?x-9:x+8,y:y-10,class:'th-point-label','text-anchor':edge?'end':'start'},'≈'+temp.toFixed(1)+'°C'));});
    el.replaceChildren(img,overlay);
  }
  function paintTimer(){
    clearTimeout(timerTick);
    const t=s.timer;
    let spent=t.elapsed+(t.start?Math.max(0,Date.now()-t.start):0);
    if(t.start&&spent>=BLOCK){
      t.start=0;t.elapsed=0;t.round++;spent=0;save();
    }
    const moved=t.round===4?BLOCK:spent, remain=Math.ceil((BLOCK-moved)/1000);
    $('timer-read').textContent=Math.floor(remain/60)+':'+String(remain%60).padStart(2,'0');
    $('timer-progress').value=Math.floor(moved/1000);
    $('timer-start').disabled=t.round>=4;
    $('timer-clear').disabled=!t.round&&!t.elapsed&&!t.start;
    $('timer-start').textContent=t.start?'Pause movement timer':t.round>=4?'All blocks complete':t.elapsed?'Resume this block':t.round?'Start next 2-minute block':'Start first block';
    const status=t.start?'Block '+(t.round+1)+' of 4. Keep a comfortable pace.':t.elapsed?'Paused. Resume when you start moving again.':t.round?'Take the '+(t.round*2)+'-minute reading now.'+(t.round===4?' All movement blocks are complete.':' Start the next block when ready.'):'Take the 0-minute reading before starting.';
    if($('timer-status').textContent!==status)$('timer-status').textContent=status;
    if(t.start)timerTick=setTimeout(paintTimer,230);
  }
  function pauseTimer(){
    if(!s.timer.start)return;
    paintTimer();
    if(!s.timer.start)return;
    s.timer.elapsed=Math.min(BLOCK,s.timer.elapsed+Math.max(0,Date.now()-s.timer.start));
    s.timer.start=0;save();paintTimer();
  }
  $('timer-start').onclick=()=>{if(s.timer.start)pauseTimer();else if(s.timer.round<4){s.timer.start=Date.now();save();paintTimer();}};
  $('timer-clear').onclick=()=>{s.timer=timerZero();save();paintTimer();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseTimer();});
  function drawHuman(){
    $('human-status').textContent=s.mode==='practice'?'Practice example · invented surface readings. Your own readings stay saved when you switch views.':'Your readings · enter temperatures in °C. No participant names are needed. You can switch views without losing entries.';
    $('sample').setAttribute('aria-pressed',s.mode==='practice');$('edit').setAttribute('aria-pressed',s.mode==='class');
    $('human-data').replaceChildren(...times.map((t,i)=>{
      const row=node('tr'),head=node('th',String(t));head.scope='row';row.append(head);
      ['A','B'].forEach((l,c)=>{
        const td=node('td'),n=node('input'),idx=i*2+c;
        n.type='number';n.min=0;n.max=60;n.step='.1';n.inputMode='decimal';n.setAttribute('aria-label','Participant '+l+' at '+t+' minutes (°C)');n.value=s.hum[idx];n.readOnly=s.mode==='practice';
        n.oninput=()=>{const valid=reading(n.value);n.setCustomValidity(n.value!==''&&valid===''?'Enter a value from 0 to 60°C.':'');s.hum[idx]=valid;plot();save();};
        n.onblur=()=>{if(n.value!==''&&reading(n.value)==='')n.reportValidity();};
        td.append(n);row.append(td);
      });return row;
    }));
    plot();
  }
  function chooseMode(mode){
    if(mode===s.mode)return;
    s.mode=mode;s.hum=mode==='practice'?practice():s.ownHum;
    drawHuman();save();
  }
  function sort(){
    for(const [k,_,label] of cards){
      const b=$('cards').querySelector('[data-card="'+k+'"]');b.hidden=!!s.sort[k];b.setAttribute('aria-pressed',selected===k);
      if(!s.sort[k])b.setAttribute('aria-label',label);
    }
    for(const [dest,title] of Object.entries(destinations)){
      const target=$('zones').querySelector('[data-zone="'+dest+'"]');
      target.replaceChildren(node('strong',title),node('small',cards.filter(([k])=>s.sort[k]===dest).map(a=>a[2]).join(' · ')||'Drop or place a card here'));
    }
  }
  function place(k,z){
    if(!Object.hasOwn(expected,k)||s.sort[k]){$('sort-status').textContent='Select a card before choosing a destination.';return;}
    const label=cards.find(c=>c[0]===k)[2];
    if(expected[k]!==z){
      $('sort-status').textContent=label+': try again. Ask whether it is matter that goes into or out of the reaction, or energy that is transferred.';
      selected=k;sort();return;
    }
    s.sort[k]=z;selected='';sort();save();
    $('sort-status').textContent=label+' placed in '+destinations[z]+'. '+(Object.keys(s.sort).length===cards.length?'All six cards placed.':'');
    const next=$('cards').querySelector('button:not([hidden])');if(next)next.focus();else $('explain').focus();
  }
  for(const [k,icon,label] of cards){
    const b=node('button',icon+' · '+label);b.className='btn';b.type='button';b.dataset.card=k;b.draggable=true;
    b.onclick=()=>{selected=selected===k?'':k;sort();$('sort-status').textContent=selected?label+' selected. Choose a destination.':'Card deselected.';};
    b.ondragstart=e=>{selected=k;e.dataTransfer.setData('text/plain',k);e.dataTransfer.effectAllowed='move';sort();};
    $('cards').append(b);
  }
  for(const z of Object.keys(destinations)){
    const b=node('button');b.className='btn';b.type='button';b.dataset.zone=z;b.onclick=()=>place(selected,z);
    b.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move';};
    b.ondrop=e=>{e.preventDefault();place(e.dataTransfer.getData('text/plain')||selected,z);};
    $('zones').append(b);
  }
  function recap(){
    const rows=[['Field comparison','At the Barter Island site, 97 of 137 polar–brown encounters involved a nonaggressive grizzly approach and a polar bear giving way.'],['Treadmill comparison','At 1.1 m/s the bear took 0 breaks; at 2.2 m/s it took 24. One bear’s data cannot tell us why a wild bear leaves food.']];
    const humanRows=['A','B'].flatMap((participant,col)=>{
      const values=times.flatMap((t,i)=>{
        const measurement=s.hum[2*i+col];
        return measurement===''?[]:[t+' min: '+measurement+'°C'];
      });
      return values.length?[[(s.mode==='practice'?'Practice surface data':'Recorded surface data')+' · Participant '+participant,values.join(' · ')]]:[];
    });
    rows.push(...(humanRows.length?humanRows:[['Your human table','No readings saved yet.']]));
    $('recap').replaceChildren(node('h3','Evidence beside your explanation'),...rows.map(([k,v])=>{const p=node('p');p.append(node('strong',k+': '),v);return p;}));
  }
  function step(name,persist=true){
    if(!route.includes(name))return;
    if(name!=='human')pauseTimer();else paintTimer();
    s.step=name;
    for(const id of route)document.getElementById(id).hidden=id!==name;
    all('[data-step]').forEach(b=>{if(b.dataset.step===name)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    for(const f of all('iframe[data-lesson-video]')){
      const parent=f.closest('.th-panel');
      if(parent?.id===name){
        if(!f.getAttribute('src')&&f.dataset.playerSrc)f.setAttribute('src',f.dataset.playerSrc);
      }else if(f.getAttribute('src')){
        f.dataset.playerSrc=f.getAttribute('src');
        f.removeAttribute('src');
      }
    }
    if(name!=='treadmill')walk(false);
    if(name==='model')recap();
    if(persist){save();history.replaceState(null,'','#'+name);document.getElementById(name+'-title').focus();}
  }
  all('[data-step],[data-go]').forEach(b=>b.onclick=()=>step(b.dataset.step||b.dataset.go));
  all('[data-pair]').forEach(b=>b.onclick=()=>{s.pair=b.dataset.pair;field();save();});
  all('[data-row]').forEach(b=>b.onclick=()=>{s.row=Number(b.dataset.row);treadmill(true);save();});
  all('[data-check]').forEach(b=>b.onclick=()=>{s.check=b.dataset.check;renderCheck();save();});
  all('[data-field]').forEach(n=>{n.maxLength=4000;n.value=s.fields[n.dataset.field]||'';n.oninput=()=>{s.fields[n.dataset.field]=clean(n.value);save();};});
  $('enlarge').onclick=()=>$('visual').showModal();
  $('sample').onclick=()=>chooseMode('practice');$('edit').onclick=()=>chooseMode('class');
  window.Lab?.identity?.mount?.('#th-identity',{compact:true,sharedDevice:true});
  $('reset').onclick=()=>{$('reset-confirm').value='';$('reset-error').textContent='';$('clear').disabled=true;$('reset-dialog').showModal();};
  $('keep').onclick=()=>$('reset-dialog').close();
  $('reset-confirm').oninput=e=>{$('clear').disabled=e.target.value!=='ERASE';};
  $('reset-form').onsubmit=e=>{
    e.preventDefault();if($('reset-confirm').value!=='ERASE')return;
    if(!canSave()||!session.reset(KEY).ok){$('reset-error').textContent='Could not clear saved work from this tab. Reload and try again.';return;}
    history.replaceState(null,'',location.pathname+location.search);location.reload();
  };
  field();treadmill();renderCheck();drawHuman();sort();resetButton();drawCore($('core'));drawCore($('core-large'));
  const hash=location.hash.slice(1);step(route.includes(hash)?hash:s.step,false);
  if(!canSave())$('save').textContent='This browser could not open the saved notebook. You can still preview a report.';
  function placements(){return cards.map(([k,_,label])=>({card:label,placement:s.sort[k]?destinations[s.sort[k]]:null}));}
  const graphNote='Core graph readings are approximate, digitized from the printed line. They are not raw sensor values or additional rows in the treadmill break table.';
  const tableNote='Time on the treadmill is 360 minutes at 1.1 m/s and 375 minutes at the other speeds. The lesson handout does not explain the difference.';
  function humanRows(list){return times.map((minute,i)=>({minute,aC:list[i*2]===''?null:Number(list[i*2]),bC:list[i*2+1]===''?null:Number(list[i*2+1])}));}
  $('export-json').onclick=()=>{
    const r=collectReport(),student=r.student,out={
      format:'bear-thermoregulation-activity-v1',activity:r.title,source:r.source,datasetId:r.datasetId,status:r.status,student,
      exportedAt:new Date().toISOString(),treadmill:{source:'OpenSciEd Lesson 2 / Best (1982)',timeNote:tableNote,
        breaks:data.map(([speedMps,timeOnMin,timeOffMin,breaks])=>({speedMps,timeOnMin,timeOffMin,breaks})),
        coreTemperatureApproximate:core.map(({speed,temp,edge})=>({speedMps:speed,temperatureC:temp,edge:!!edge})),graphNote},
      surfaceTemperatures:{active:s.mode==='practice'?'practice-invented':'recorded',recorded:humanRows(s.ownHum),
        ...(s.mode==='practice'?{practiceInvented:humanRows(s.hum)}:{})},
      matterAndEnergy:placements(),responses:{...s.fields}
    };
    const a=node('a'),url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
    a.hidden=true;a.href=url;a.download='bear-thermoregulation-'+out.datasetId+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    $('json-status').textContent='Downloaded only this lab’s data. '+(student?'Includes the displayed name and class period.':'No saved name or class period was entered.');
  };
  function collectReport(){
    const missing=fields.filter(k=>!s.fields[k]?.trim()).map(k=>qs[k]);
    if(!s.hum.some(Boolean))missing.push('Enter your readings or load the practice example.');
    if(Object.keys(s.sort).length<cards.length)missing.push('Place all six matter and energy cards.');
    const humanTable=list=>({type:'table',columns:['Time (min)','A (°C)','B (°C)'],rows:humanRows(list).map(r=>[String(r.minute),String(r.aC??'—'),String(r.bC??'—')])});
    const humanSections=[{title:s.mode==='practice'?'Practice human surface temperatures (invented)':'Recorded human surface temperatures',items:[humanTable(s.hum),{type:'answer',prompt:qs.human,value:s.fields.human}]}];
    if(s.mode==='practice'&&s.ownHum.some(Boolean))humanSections.push({title:'Your saved human readings (not displayed)',items:[humanTable(s.ownHum)]});
    return {title:'Bear Thermoregulation Lab',unit:'OpenSciEd B.5 · Lesson 2 companion',source:'Field: Miller, Wilder & Wilson (2015). Treadmill: OpenSciEd Lesson 2 / Best (1982), one polar bear’s break table. Human data are surface temperatures, not directly comparable to bear core temperatures.',
      status:!canSave()?'recovery':missing.length?'draft':'final',student:identity(),datasetId:'TH-'+s.id,missing,
      sections:[
        {title:'Field evidence and treadmill',items:[{type:'answer',prompt:qs.predict,value:s.fields.predict},{type:'answer',prompt:qs.field,value:s.fields.field},{type:'table',columns:['Speed (m/s)','Time on (min)','Time off (min)','Breaks'],rows:data.map(a=>a.map(String))},{type:'text',text:tableNote},{type:'text',text:graphNote},{type:'table',columns:['Approx. speed (m/s)','Approx. core temp (°C)'],rows:core.map(r=>[r.speed.toFixed(1),r.temp.toFixed(1)])},{type:'answer',prompt:qs.pattern,value:s.fields.pattern}]},
        ...humanSections,
        {title:'Matter, energy and explanation',items:[{type:'answer',prompt:'Cards placed',value:Object.keys(s.sort).length+' of '+cards.length},{type:'table',columns:['Card','Your placement'],rows:placements().map(r=>[r.card,r.placement||'Not placed'])},{type:'answer',prompt:qs.explain,value:s.fields.explain}]}
      ]};
  }
  window.OpenSciEdSubmission?.mount({target:'#th-report',filename:'bear-thermoregulation',collect:collectReport});
  window.OpenSciEdB5ReportFiles?.bindHTML($('export-html'),collectReport,'bear-thermoregulation',
    message=>{$('json-status').textContent=message;});
})();
