(() => {
  'use strict';
  const M=window.SerengetiFieldNotebook, api=window.OpenSciEdSaveSession;
  const scope='b1-field-notebook', key='aplab:openscied:'+scope+':v1';
  const $=id=>document.getElementById('sf-'+id), all=q=>Array.from(document.querySelectorAll(q));
  const element=(tag,txt)=>Object.assign(document.createElement(tag),{textContent:txt});
  const say=msg=>{$('status').textContent=msg;};
  if(!M){say('The notebook did not load. Reload this page to try again.');return;}
  let state=M.clean(null), session, unreadable=false, map='region';
  const coordinates={plains:[391,340],woodland:[266,231],mara:[430,119],park:[347,239],ngorongoro:[520,305]};
  const mapDescriptions={
    region:'Lake Victoria is west of the ecosystem. The Mara and Grumeti rivers cross the region.',
    route:'The dashed route crosses the schematic park outline, including into Kenya. It is not a tracking record.',
    protection:'Solid outline: national park. Dashed outlines: examples of neighboring protected areas. These simplified shapes are not official boundaries.'
  };
  try {session=api.open(localStorage,scope,[key],undefined,{routeMetadata:['step','station','lastVisitedAt']});state=M.clean(JSON.parse(session.read(key)));} catch (_) {unreadable=true;}
  const identity=api?.reportIdentity?.(session,[key],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
  const usable=()=>!unreadable&&!!session?.check(key).ok;
  function notice(){
    $('save').textContent=usable()?'Your notebook is stored in this browser. Download a report to share it.':
      'This tab cannot save this notebook. Use Preview report for a recovery copy before reloading.';
    $('reset').disabled=!usable();
  }
  function save(){
    state.lastVisitedAt=Date.now();
    const result=!unreadable&&session?.write(key,JSON.stringify(state));
    if(result?.ok) identity();
    notice();
    if(!result?.ok) say('Not saved to this browser. Use Preview report to keep a recovery copy.');
    return !!result?.ok;
  }
  const station=()=>M.stations.find(st=>st.id===state.station);
  function setMap(next){
    map=next;
    all('[data-map]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===map)));
    all('[data-layer]').forEach(g=>g.toggleAttribute('hidden',g.dataset.layer!==map));
    $('map-caption').textContent=mapDescriptions[map]+' Schematic, not to scale.';
  }
  function showStation(fillNote=true){
    const st=station();
    all('[data-station]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.station===st.id)));
    $('art').setAttribute('href','assets/serengeti-field-stations.svg#'+st.id);
    $('evidence-type').textContent='Station '+st.icon+' / '+st.name;
    $('evidence-title').textContent=st.title;
    $('location').textContent='Map marker: '+st.location;
    $('evidence-text').textContent=st.evidence;
    $('source').textContent=M.references[st.id];
    $('note-label').textContent=st.prompt;
    if(fillNote) $('note').value=state.fields[st.id]||'';
    $('movement-video').hidden=st.id!=='movement';$('people-video').hidden=st.id!=='people';
    renderProgress();
  }
  function renderProgress(){
    const p=M.progress(state);
    all('[data-step]').forEach(b=>{
      const step=b.dataset.step;
      b.disabled=step==='explore'&&!p.questions||step==='explain'&&!p.evidence;
      b.setAttribute('aria-current',step===state.step?'step':'false');
    });
    all('[data-go]').forEach(b=>{b.disabled=b.dataset.go==='explore'?!p.questions:!p.evidence;});
    const pinned=state.pins.includes(state.station);
    all('[data-map-pin]').forEach(b=>{
      const st=M.stations.find(x=>x.id===b.dataset.station);
      b.dataset.pinned=String(state.pins.includes(st.id));
      b.setAttribute('aria-label',st.name+(state.pins.includes(st.id)?', evidence pinned':''));
    });
    $('pin').textContent=pinned?'Remove evidence pin':'Pin this evidence';
    $('pin').setAttribute('aria-pressed',String(pinned));
    $('collected').textContent=p.used+' of '+M.stations.length+' stations with evidence · collect from at least 2 to continue.';
    $('finish').disabled=!p.ready||p.complete;
    $('finish-note').textContent=p.complete?'Notebook complete. Use Preview report to share your work.':
      'Write your explanation and one new question to finish.';
    $('questions').hidden=!p.questions;
    $('questions').textContent=p.questions?'Your questions\n1. '+state.fields.question1+'\n2. '+state.fields.question2:'';
  }
  function recap(){
    const rows=M.stations.filter(st=>state.pins.includes(st.id)||state.fields[st.id]?.trim()).map(st=>{
      const row=element('div','');row.className='sf-evidence-recap-row';row.append(element('strong',st.name));
      if(state.pins.includes(st.id)) row.append(element('p',st.evidence));
      if(state.fields[st.id]?.trim()) row.append(element('p','My note: '+state.fields[st.id]));
      return row;
    });
    $('evidence-recap').replaceChildren(...rows);
  }
  function page(next, moveFocus=false){
    const p=M.progress(state);
    state.step=(next==='explain'&&p.evidence||next==='explore'&&p.questions)?next:'orient';
    all('[data-page]').forEach(section=>{section.hidden=section.dataset.page!==state.step;});
    if(state.step==='explain')recap();
    if(moveFocus){$(state.step+'-title').focus();if(p.started)save();}
    renderProgress();
  }
  function change(id,value){
    state.fields[id]=value.slice(0,M.limit);
    if(!M.progress(state).ready)state.finished=false;
    save();renderProgress();
  }
  for(const st of M.stations){
    const b=element('button',st.icon+' · '+st.name);
    b.type='button';b.className='btn';b.dataset.station=st.id;
    const open=()=>{state.station=st.id;setMap(st.view);showStation();say(st.name+' station opened.');};
    b.onclick=open;
    $('stations').append(b);
    const pin=element('button',st.icon), [x,y]=coordinates[st.place];
    pin.className='sf-map-pin';pin.type='button';pin.dataset.station=st.id;pin.dataset.mapPin='';
    pin.style.setProperty('--x',x/7.2+'%');pin.style.setProperty('--y',y/4.5+'%');
    pin.onclick=open;$('map-pins').append(pin);
  }
  for(const id of ['system','components','interactions','decisions']){
    const container=element('div',''), label=element('label',M.fields[id]), box=element('textarea','');
    label.htmlFor='sf-'+id;box.id=label.htmlFor;box.rows=2;box.maxLength=M.limit;box.dataset.field=id;
    container.append(label,box);$('organizer').append(container);
  }
  all('[data-field]').forEach(box=>{
    box.value=state.fields[box.dataset.field]||'';
    box.addEventListener('input',()=>change(box.dataset.field,box.value));
  });
  $('note').addEventListener('input',()=>change(state.station,$('note').value));
  $('pin').onclick=()=>{
    const id=state.station, pinned=state.pins.includes(id);
    state.pins=pinned?state.pins.filter(x=>x!==id):[...state.pins,id];
    if(!M.progress(state).ready) state.finished=false;
    if(save()) say(pinned?'Evidence pin removed.':'Evidence pinned to your notebook.');
    renderProgress();
  };
  all('[data-map]').forEach(b=>{b.onclick=()=>setMap(b.dataset.map);});
  all('[data-era]').forEach(b=>{b.onclick=()=>{
    all('[data-era]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    all('[data-era-note]').forEach(n=>{n.hidden=n.dataset.eraNote!==b.dataset.era;});
    say('History entry: '+b.textContent+'.');
  };});
  all('[data-step],[data-go]').forEach(b=>{b.onclick=()=>page(b.dataset.step||b.dataset.go,true);});
  $('finish').onclick=()=>{
    if(!M.progress(state).ready)return;
    state.finished=true;if(save())say('Field notebook complete.');renderProgress();
  };
  $('reset').onclick=()=>{
    $('erase').value='';$('clear').disabled=true;$('reset-dialog').showModal();
  };
  $('erase').oninput=()=>{$('clear').disabled=$('erase').value.trim()!=='ERASE'||!usable();};
  $('clear').onclick=()=>{
    if($('erase').value.trim()!=='ERASE')return;
    if(session?.reset(key)?.ok){location.reload();return;}
    $('reset-dialog').close();notice();say('Could not clear this notebook. Reload to check the saved work.');
  };
  window.addEventListener('storage',notice);window.addEventListener('pageshow',notice);
  const report=()=>{
    const p=M.progress(state), recovery=!usable();
    const section=(title,ids)=>({title,items:ids.map(id=>({type:'answer',prompt:M.fields[id],value:state.fields[id]||''}))});
    return {
      title:'Serengeti Field Notebook', unit:'OpenSciEd Biology B.1 · Lesson 2', source:'OpenSciEd B.1 Lesson 2 history reading, maps, and scavenger-hunt evidence. Map is schematic, not to scale.',
      status:recovery?'recovery':p.complete?'final':'draft',student:identity(recovery),
      missing:[!p.questions&&'Write two different investigation questions.',!p.evidence&&'Gather evidence from at least two stations.',!p.complete&&'Finish the explanation and remaining question.'].filter(Boolean),
      sections:[section('Investigation questions',['question1','question2']),
        {title:'Station evidence',items:[{type:'table',title:'Evidence and notes',columns:['Station','Source','Pinned evidence','My note'],rows:M.stations.filter(st=>state.pins.includes(st.id)||state.fields[st.id]?.trim()).map(st=>[st.name,M.references[st.id],state.pins.includes(st.id)?st.evidence:'',state.fields[st.id]||''])}]},
        section('Graphic organizer',['system','components','interactions','decisions']),section('Explain and share',['claim','wonder'])]
    };
  };
  showStation();setMap(station().view);page(state.step);notice();
  window.OpenSciEdSubmission?.mount({target:'#sf-report',collect:report,filename:'serengeti-field-notebook'});
})();
