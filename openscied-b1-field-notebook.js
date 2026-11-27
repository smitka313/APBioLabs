(() => {
  'use strict';
  const M=window.SerengetiFieldNotebook, api=window.OpenSciEdSaveSession;
  const scope='b1-field-notebook', key='aplab:openscied:'+scope+':v1';
  const $=id=>document.getElementById('sf-'+id), all=q=>Array.from(document.querySelectorAll(q));
  const element=(tag,txt)=>Object.assign(document.createElement(tag),{textContent:txt});
  const say=msg=>{$('status').textContent=msg;};
  if(!M){say('The notebook did not load. Reload this page to try again.');return;}
  let state=M.clean(null), session, unreadable=false, map='region', exhibit=0, month=0;
  // Each station's anchor followed by its offset button position, leaving map labels legible.
  const coordinates={plains:[386,657,456,713],woodland:[266,396,172,392],
    mara:[404,242,491,248],park:[370,439,315,506],ngorongoro:[549,551,603,532]};
  const attempts={};
  const mapDescriptions={
    region:'Land and water: Lake Victoria lies west, the Rift Valley lies east, and the Mara and Grumeti cross the region.',
    route:'The dotted line is a simplified annual route. The circle represents an approximate area for the selected month, not a GPS location.',
    protection:'Compare the original outline with the later park. The later map also distinguishes the neighboring protected areas.'
  };
  const keys={
    region:[['river','River'],['border','International border'],['park','Later park outline']],
    route:[['route','Typical migration route'],['herd','Selected month'],['park','Later park outline']],
    protection:[['historic','Original national park'],['park','Later national park'],['reserve','Neighboring protected area']]
  };
  try {session=api.open(localStorage,scope,[key],undefined,{routeMetadata:['step','station','lastVisitedAt','migrationMonth']});state=M.clean(JSON.parse(session.read(key)));} catch (_) {unreadable=true;}
  month=state.migrationMonth;
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
  const comparing=()=>station().id==='conservation'&&exhibit===0;
  const marked=()=>Object.hasOwn(M.boundaryPlaces,state.boundaryPick)?M.boundaryPlaces[state.boundaryPick]:null;
  function showBoundaryTask(){
    const active=map==='protection'&&comparing(), place=marked();
    $('boundary-task').hidden=!active;
    $('map-observation').textContent=active&&place?place.feedback:'';
    all('[data-boundary-pick]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.boundaryPick===state.boundaryPick)));
    for(const id of ['boundary-marker','boundary-marker-edge']){
      const dot=$(id);dot.toggleAttribute('hidden',!active||!place);
      if(place){dot.setAttribute('cx',place.x);dot.setAttribute('cy',place.y);}
    }
  }
  function setMap(next){
    map=next;
    const current=M.months[month], boundary=$('boundary').value;
    all('[data-map]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===map)));
    all('[data-layer]').forEach(g=>g.toggleAttribute('hidden',g.dataset.layer!==map));
    $('month-control').hidden=map!=='route';
    $('boundary-control').hidden=map!=='protection';
    all('[data-herd-marker],[data-herd-center]').forEach(c=>{c.setAttribute('cx',current[1]);c.setAttribute('cy',current[2]);});
    all('[data-boundary-later]').forEach(x=>x.toggleAttribute('hidden',boundary==='original'));
    all('[data-boundary-old]').forEach(x=>x.toggleAttribute('hidden',boundary==='later'));
    $('map-key').replaceChildren(...keys[map].filter(([k])=>map!=='protection'||boundary==='both'||(boundary==='original')===(k==='historic')).map(([k,txt])=>{
      const row=element('li',''), swatch=element('span','');
      swatch.className='sf-map-symbol sf-map-symbol--'+k;swatch.setAttribute('aria-hidden','true');
      row.append(swatch,element('span',txt));return row;
    }));
    const detail=map==='route'?' '+current[0]+': '+current[3]+'.':
      map==='protection'?' Showing '+(boundary==='both'?'both outlines':boundary==='later'?'the later park and neighbors':'the original outline')+'.':'';
    $('map-caption').textContent=mapDescriptions[map]+detail+' Approximate lesson map; not for navigation.';
    showBoundaryTask();
    const mapGraphic=document.querySelector('.sf-map .sf-map-visual');
    mapGraphic.setAttribute('aria-label','Serengeti field map. '+$('map-caption').textContent);
  }
  function showExhibit(){
    const st=station(), current=M.exhibits[st.id][exhibit];
    $('exhibit-title').textContent=current[0];
    $('exhibit-text').textContent=comparing()&&!marked()?.changed?
      'Compare the two outlines on the map. Mark one place that was covered by one version of the park but not by the other.':
      current[1];
    $('exhibit-source').textContent=current[2];
    $('locate').textContent=st.id==='movement'?'Show the herd in '+(exhibit===2?'September':'October'):
      st.id==='conservation'?'Compare park outlines':'Locate this station';
    all('[data-exhibit]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.exhibit)===exhibit)));
    showBoundaryTask();renderProgress();
  }
  function showCheck(){
    const st=station(), [prompt,choices,right,why]=M.checks[st.id];
    $('check-prompt').textContent=prompt;
    function feedback(){
      const i=attempts[st.id];
      $('check-feedback').textContent=i==null?'':i===right?'That fits the evidence. '+why:'Look again at the exhibits. '+why;
    }
    $('check-options').replaceChildren(...choices.map((choice,i)=>{
      const b=element('button',choice);b.type='button';b.className='btn';
      b.setAttribute('aria-pressed',String(attempts[st.id]===i));
      b.onclick=()=>{
        attempts[st.id]=i;
        Array.from($('check-options').children).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
        feedback();say($('check-feedback').textContent);
      };
      return b;
    }));
    feedback();
  }
  function showStation(fillNote=true){
    const st=station();
    all('[data-station]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.station===st.id)));
    // Render the editable SVG plates to high-density WebP so Safari/iOS paints every fill.
    $('art').setAttribute('src','assets/serengeti-field-station-'+st.id+'.webp');
    $('art-caption').textContent=st.artCaption;
    $('evidence-type').textContent='Station '+st.icon+' / '+st.name;
    $('evidence-title').textContent=st.title;
    $('location').textContent='Map marker: '+st.location;
    $('evidence-text').textContent=st.evidence;
    $('source').textContent=M.references[st.id];
    $('exhibits').replaceChildren(...M.exhibits[st.id].map((card,i)=>{
      const b=element('button',String(i+1)+'. '+card[0]);b.type='button';b.className='btn';b.dataset.exhibit=i;
      b.onclick=()=>{exhibit=i;showExhibit();say(card[0]+' opened.');};return b;
    }));
    $('note-label').textContent=st.prompt;
    if(fillNote){$('note').value=state.fields[st.id]||'';setNoteStatus();}
    $('movement-video').hidden=st.id!=='movement';$('people-video').hidden=st.id!=='people';
    showCheck();showExhibit();
  }
  function renderProgress(){
    const p=M.progress(state);
    all('[data-step]').forEach(b=>{
      const step=b.dataset.step;
      b.disabled=step==='explore'&&!p.questions||step==='explain'&&!p.evidence;
      b.setAttribute('aria-current',step===state.step?'step':'false');
    });
    all('[data-go]').forEach(b=>{b.disabled=b.dataset.go==='explore'?!p.questions:!p.evidence;});
    const pinned=M.pinList(state,state.station).includes(exhibit);
    all('[data-map-pin]').forEach(b=>{
      const st=M.stations.find(x=>x.id===b.dataset.station);
      b.dataset.pinned=String(state.pins.includes(st.id));
      b.setAttribute('aria-label',st.name+(state.pins.includes(st.id)?', evidence pinned':''));
    });
    all('[data-exhibit]').forEach(b=>{
      const i=Number(b.dataset.exhibit);
      b.textContent=String(i+1)+'. '+M.exhibits[state.station][i][0]+(M.pinList(state,state.station).includes(i)?' · Pinned':'');
    });
    $('pin').disabled=comparing()&&!pinned&&!marked()?.changed;
    $('pin').textContent=pinned?'Remove exhibit pin':'Pin this exhibit';
    $('pin').setAttribute('aria-pressed',String(pinned));
    const pinCount=M.stations.reduce((n,st)=>n+M.pinList(state,st.id).length,0);
    $('collected').textContent=p.used+' '+(p.used===1?'station':'stations')+' with evidence (2 needed) · '+pinCount+' '+(pinCount===1?'exhibit':'exhibits')+' pinned';
    $('finish').disabled=!p.ready||p.complete;
    $('finish-note').textContent=p.complete?'Notebook complete. Use Preview report to share your work.':
      'Write your explanation and one new question to finish.';
    $('questions').hidden=!p.questions;
    $('questions').textContent=p.questions?'Your questions\n1. '+state.fields.question1+'\n2. '+state.fields.question2:'';
  }
  function recap(){
    const rows=M.stations.filter(st=>state.pins.includes(st.id)||state.fields[st.id]?.trim()).map(st=>{
      const row=element('div','');row.className='sf-evidence-recap-row';row.append(element('strong',st.name));
      for(const index of M.pinList(state,st.id)){
        const [title,body,source]=M.exhibits[st.id][index];
        row.append(element('p',title+' — '+body+' ('+source+')'));
      }
      if(state.fields[st.id]?.trim()) row.append(element('p','My note: '+state.fields[st.id]));
      return row;
    });
    $('question-recap').replaceChildren(...['question1','question2'].map(id=>element('li',state.fields[id]||'')));
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
    const saved=save();renderProgress();return saved;
  }
  function setNoteStatus(saved=usable()){
    $('note-status').textContent=!saved?'Note not saved to this browser.':$('note').value.trim()?'Station note saved to this browser.':'Notes save as you type.';
  }
  function pickMonth(i){
    month=i;$('month').value=String(i);state.migrationMonth=i;
    if(M.progress(state).started)save();
  }
  for(const st of M.stations){
    const b=element('button',st.icon+' · '+st.name);
    b.type='button';b.className='btn';b.dataset.station=st.id;
    const open=()=>{state.station=st.id;exhibit=0;setMap(st.view);showStation();say(st.name+' station opened.');};
    b.onclick=open;
    $('stations').append(b);
    const pin=element('button',st.icon), [anchorX,anchorY,x,y]=coordinates[st.place];
    const line=document.createElementNS('http://www.w3.org/2000/svg','path');
    line.setAttribute('d','M'+anchorX+' '+anchorY+'L'+x+' '+y);
    $('pin-leaders').append(line);
    pin.className='sf-map-pin';pin.type='button';pin.dataset.station=st.id;pin.dataset.mapPin='';
    pin.style.setProperty('--x',(x-40)/6.1+'%');pin.style.setProperty('--y',(y-100)/6.5+'%');
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
  $('note').addEventListener('input',()=>setNoteStatus(change(state.station,$('note').value)));
  $('pin').onclick=()=>{
    if($('pin').disabled)return;
    const pinned=M.togglePin(state,state.station,exhibit);
    if(!M.progress(state).ready) state.finished=false;
    if(save()) say(pinned?'Exhibit pinned to your notebook.':'Exhibit pin removed.');
    renderProgress();
  };
  M.months.forEach((m,i)=>{const option=element('option',m[0]);option.value=String(i);$('month').append(option);});
  $('month').value=String(month);
  $('month').onchange=()=>{pickMonth(Number($('month').value));setMap(map);if(usable())say(M.months[month][0]+': '+M.months[month][3]+'.');};
  $('boundary').onchange=()=>{setMap(map);say($('map-caption').textContent);};
  $('jump-exhibit').onclick=()=>$('exhibit-title').focus();
  const dialog=$('map-dialog');
  $('enlarge').onclick=()=>{
    dialog.showModal();
    $('large-map').append($('map-panel'));
    $('map-zoom').hidden=false;
  };
  $('map-zoom').onclick=()=>{
    const viewport=$('map-scroll'), zoom=$('map-zoom').getAttribute('aria-pressed')!=='true';
    viewport.classList.toggle('sf-map-zoomed',zoom);
    $('map-zoom').setAttribute('aria-pressed',String(zoom));
    $('map-zoom').textContent=zoom?'Fit map':'Zoom labels';
    if(zoom){
      viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)/2;
      viewport.scrollTop=(viewport.scrollHeight-viewport.clientHeight)/2;
    } else { viewport.scrollLeft=0;viewport.scrollTop=0; }
  };
  dialog.addEventListener('close',()=>{
    $('map-home').append($('map-panel'));
    const viewport=$('map-scroll');
    viewport.classList.remove('sf-map-zoomed');
    viewport.scrollLeft=0;viewport.scrollTop=0;
    $('map-zoom').hidden=true;
    $('map-zoom').setAttribute('aria-pressed','false');
    $('map-zoom').textContent='Zoom labels';
    $('enlarge').focus();
  });
  all('[data-boundary-pick]').forEach(b=>{b.onclick=()=>{
    state.boundaryPick=b.dataset.boundaryPick;
    $('boundary').value='both';
    setMap('protection');
    showExhibit();
    if(save())say(marked().feedback);
    if(dialog.open)$('map-observation').focus();
  };});
  $('locate').onclick=()=>{
    const st=station();
    if(st.id==='movement')pickMonth(exhibit===2?8:9);
    if(st.id==='conservation')$('boundary').value='both';
    setMap(st.view);$('field-map').focus();say($('map-caption').textContent);
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
      missing:[!p.questions&&'Write two different investigation questions.',!p.evidence&&'Gather evidence from at least two stations.',!state.fields.claim?.trim()&&'Write your explanation.',!state.fields.wonder?.trim()&&'Write one question you still have.',p.ready&&!p.complete&&'Select Finish notebook to mark this work complete.'].filter(Boolean),
      sections:[section('Investigation questions',['question1','question2']),
        {title:'Station evidence',items:M.stations.flatMap(st=>{
          const selected=M.pinList(state,st.id), note=state.fields[st.id]||'';
          const items=selected.map(i=>{
            const [title,evidence,source]=M.exhibits[st.id][i];
            return {type:'answer',prompt:st.name+' · '+title,value:evidence+' ('+source+')'};
          });
          if(note.trim())items.push({type:'answer',prompt:st.name+' · Station note',value:note});
          return items;
        })},
        ...(marked()?[{title:'Park boundary comparison',items:[{type:'answer',prompt:'Area I marked',value:marked().label}]}]:[]),
        section('Graphic organizer',['system','components','interactions','decisions']),section('Explain and share',['claim','wonder'])]
    };
  };
  showStation();setMap(station().view);page(state.step);notice();
  window.OpenSciEdSubmission?.mount({target:'#sf-report',collect:report,filename:'serengeti-field-notebook'});
})();
