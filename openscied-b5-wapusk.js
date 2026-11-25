(() => {
  'use strict';
  const $=id=>document.getElementById('wb-'+id),all=s=>[...document.querySelectorAll(s)], KEY='aplab:openscied:b5-wapusk:v1';
  const stages=['sightings','scale','regions','model'], labels={observe:'Seasonal sightings observation',scales:'Evidence and scale',regional:'Region evidence and uncertainty',seasonal:'Initial model: seasonally available ice',persistent:'Initial model: ice persists into summer',question:'Question for the Driving Question Board'};
  const signature=()=>crypto.getRandomValues(new Uint32Array(1))[0].toString(16).toUpperCase().padStart(8,'0');
  const clean=x=>typeof x==='string'?x.slice(0,1600):'';
  const el=(tag,value)=>Object.assign(document.createElement(tag),{textContent:value??''});
  const tell=t=>{$('status').textContent=t;};
  const regions={
    seasonal:{name:'Seasonal Ice',ice:'Sea ice forms and melts each year. Around Hudson Bay, polar bears typically come ashore when it melts and wait for ice to reform.',rows:[['Baffin Bay','Decline','Decline'],['Davis Strait','Decline','Decline'],['Foxe Basin','Uncertain','Stable'],['Southern Hudson Bay','Decline','Stable'],['Western Hudson Bay','Decline','Decline']],source:'Seasonal Ice Visual Inquiry'},
    convergent:{name:'Convergent Ice',ice:'Currents push floating ice toward northern Canadian and Greenland shores. Ice accumulating near shore can provide hunting habitat through summer.',rows:[['East Greenland','Uncertain','Uncertain'],['Northern Beaufort Sea','Uncertain','Stable']],source:'Convergent Ice Visual Inquiry'},
    divergent:{name:'Divergent Ice',ice:'Ice forms near shore in winter and drifts out toward the Arctic basin. In summer, that can leave open water between the coast and the ice.',rows:[['Barents Sea','Uncertain','Uncertain'],['Chukchi Sea','Uncertain','Uncertain'],['Kara Sea','Uncertain','Uncertain'],['Laptev Sea','Uncertain','Uncertain'],['Southern Beaufort Sea','Decline','Decline']],source:'Divergent Ice Visual Inquiry'},
    islands:{name:'Islands Ice',ice:'In parts of the Canadian Arctic Archipelago, ice historically persisted through summer in channels between islands. Bears could stay on the ice rather than come ashore.',rows:[],source:'Sea Ice Ecoregions transcript and video'}
  };
  const marks={
    winter:[
      ['△','Polar bear sightings',48,28,'Polar bears are marked near the northern part of the local map. The map shows reported locations, not a count of every bear.'],
      ['↗','Polar bear movements',77,33,'The arrows summarize movement toward sea ice. The separate regional inset follows four female polar bears during 2022–2023; it is not a record of every bear.'],
      ['?','No black or brown sightings shown',33,58,'There are no reported brown or black bear sightings on this winter map. That is not proof that no bears of either species were there.']
    ],
    summer:[
      ['△','Polar bear sightings',52,40,'The summer map shows polar bear sightings along the tundra near the coast.'],
      ['◆','Brown bear sightings',41,21,'Brown bears, also called grizzlies here, were reported in tundra, including areas near the coast.'],
      ['⬟','Black bear sightings',27,72,'The summer map shows a black bear sighting in woodland.'],
      ['↗','Movements',70,52,'Movement arrows and sighting markers answer different questions. Compare the direction of arrows on the original map to where sighting symbols appear.'],
      ['◎','Shared Owl River location',42,56,'Cameras recorded polar, brown and black bears using the Owl River camp location on different occasions.']
    ]
  };
  const study='https://research-groups.usask.ca/human-wildlife-interaction/documents/clark-et-al.-2018-novel-range-overlap-of-three-ursids-in-the-canadian-subarctic.pdf#page=5';
  let state={v:1,id:signature(),step:'sightings',season:'winter',region:'seasonal',fields:{},check:'',finished:false,lastVisitedAt:0}, session, recovery=false, picked=-1;
  try{
    session=window.OpenSciEdSaveSession?.open(localStorage,'b5-wapusk',[KEY]);
    const raw=session?.read(KEY);
    if(raw!=null){
      const x=JSON.parse(raw);
      if(x.v!==1||!/^[A-F0-9]{8}$/.test(x.id))throw Error('Unrecognized saved work');
      state={...state,id:x.id,step:stages.includes(x.step)?x.step:'sightings',season:x.season==='summer'?'summer':'winter',
        region:Object.hasOwn(regions,x.region)?x.region:'seasonal',fields:Object.fromEntries(Object.keys(labels).map(k=>[k,clean(x.fields?.[k])])),
        check:['place','meeting'].includes(x.check)?x.check:'',finished:x.finished===true,lastVisitedAt:Number(x.lastVisitedAt)||0};
    }
  }catch(_){recovery=true;}
  const identity=window.OpenSciEdSaveSession?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
  const canSave=()=>!recovery&&session?.check(KEY).ok;
  function save(){state.lastVisitedAt=Date.now();if(!canSave()||!session.write(KEY,JSON.stringify(state)).ok){tell('This tab could not save on this device. Preview a report to keep a copy.');return false;}return true;}
  function section(step,focus=true){
    for(const key of stages)$(key).hidden=key!==step;
    for(const button of all('.wb-tabs [data-step]')){
      if(button.dataset.step===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
    }
    state.step=step;
    if(step==='model')drawRecap();
    if(step==='scale')$('scale-recap').textContent=state.fields.observe?.trim()?'Your Wapusk observation: '+state.fields.observe.trim():'';
    if(focus){$(step+'-title').focus();save();}
  }
  function showMark(index){
    picked=index;
    for(const [i,b] of [...$('markers').children].entries())b.setAttribute('aria-pressed',String(i===index));
    const row=marks[state.season][index];
    $('evidence').replaceChildren(el('h3',row?.[1]||'Inspect a marker'),el('p',row?.[4]||'Choose a symbol on the map for evidence about its habitat or what the record shows.'));
    if(row?.[0]==='◎'){const a=el('a','View the research photos (Figure 3)');a.href=study;$('evidence').append(a);}
  }
  function drawSeason(){
    $('map').dataset.season=state.season;
    for(const b of all('[data-season]'))b.setAttribute('aria-pressed',String(b.dataset.season===state.season));
    $('markers').replaceChildren(...marks[state.season].map(([glyph,label,x,y],i)=>{
      const b=el('button',glyph);b.className='wb-marker';b.type='button';b.style.setProperty('--x',x+'%');b.style.setProperty('--y',y+'%');b.setAttribute('aria-label',label);b.onclick=()=>showMark(i);return b;
    }));
    showMark(picked);
  }
  function drawRegion(){
    for(const b of [...$('region-buttons').children])b.setAttribute('aria-pressed',String(b.dataset.region===state.region));
    const r=regions[state.region], panel=$('region');
    panel.replaceChildren(el('h3',r.name),el('p',r.ice));
    if(r.rows.length){
      const table=el('table'), thead=el('thead'), head=el('tr'),body=el('tbody');table.className='wb-table';
      for(const title of ['Polar bear population','Body condition','Reproduction']){
        const th=el('th',title);th.scope='col';head.append(th);
      }
      for(const [where,bodyTrend,repro] of r.rows){
        const tr=el('tr'),th=el('th',where);th.scope='row';tr.append(th,el('td',bodyTrend),el('td',repro));body.append(tr);
      }
      thead.append(head);table.append(el('caption','Lesson 1 snapshot · 2018 assessment'),thead,body);panel.append(table);
      panel.append(el('p','“Uncertain” marks insufficient evidence in this snapshot, not stability. Body condition describes physical condition; reproduction describes litter size or time between litters.'));
    }else{
      panel.append(el('p','The transcript describes the ice pattern but does not supply this region’s body condition or reproduction table. Don’t infer a trend from missing data.'));
    }
    const a=el('a','Watch the original sea ice ecoregions video');a.href='https://www.youtube.com/watch?v=7VFJ4osSY_A';
    panel.append(el('p','Source: OpenSciEd '+r.source+'.'),a);
  }
  function drawRecap(){
    const p=$('recap');p.replaceChildren(el('h3','Bring your earlier evidence forward'));
    for(const k of ['observe','scales','regional']){
      const b=el('p');b.append(el('strong',labels[k]+': '),document.createTextNode(state.fields[k]?.trim()||'Not recorded yet.'));p.append(b);
    }
  }
  function feedback(){
    $('feedback').textContent=state.check==='place'?'That matches the evidence. The photos show one location used on different occasions, not a meeting.':state.check==='meeting'?'Look at the difference between place and time. The photographs do not establish an encounter.':'';
    for(const b of all('[name="overlap"]'))b.checked=b.value===state.check;
  }
  for(const b of all('[data-step]'))b.onclick=()=>section(b.dataset.step);
  for(const b of all('[data-season]'))b.onclick=()=>{state.season=b.dataset.season;picked=-1;drawSeason();save();};
  for(const [key,r] of Object.entries(regions)){
    const b=el('button',r.name);b.type='button';b.className='btn';b.dataset.region=key;b.onclick=()=>{state.region=key;drawRegion();save();};$('region-buttons').append(b);
  }
  for(const input of all('[data-field]')){
    input.value=state.fields[input.dataset.field]||'';
    input.oninput=()=>{state.fields[input.dataset.field]=clean(input.value);state.finished=false;save();};
  }
  $('check').onsubmit=e=>{e.preventDefault();const input=document.querySelector('[name="overlap"]:checked');if(!input)return;state.check=input.value;feedback();save();};
  const unfinished=()=>Object.keys(labels).filter(k=>!state.fields[k]?.trim());
  $('finish').onclick=()=>{
    if(unfinished().length){tell('Still to record: '+unfinished().map(k=>labels[k]).join('; ')+'.');$('status').scrollIntoView({block:'nearest'});return;}
    state.finished=true;if(save())tell('Notebook complete. Preview your report before sharing.');
  };
  drawSeason();drawRegion();feedback();section(state.step,false);
  if(!canSave())tell('This browser could not open the saved notebook. You can still work and preview a report.');
  window.OpenSciEdSubmission?.mount({target:'#wb-report',filename:'three-bears-wapusk',collect:()=>{
    const missing=unfinished().map(k=>'Record: '+labels[k]+'.');
    if(!state.finished)missing.push('Choose Finish evidence notebook.');
    return {title:'Three Bears in Wapusk',unit:'OpenSciEd B.5 · Lesson 1 companion',source:'Wapusk sightings, regional evidence and discussion follow OpenSciEd Lesson 1. The interactive map is schematic and shows patterns, not counts.',
      status:!canSave()?'recovery':missing.length?'draft':'final',student:identity(),datasetId:'WB-'+state.id,missing,
      sections:[{title:'Evidence notebook · '+regions[state.region].name,items:Object.entries(labels).map(([k,prompt])=>({type:'answer',prompt,value:state.fields[k]||''}))}]};
  }});
})();
