(() => {
  'use strict';
  const $=id=>document.getElementById('wb-'+id),all=s=>[...document.querySelectorAll(s)], KEY='aplab:openscied:b5-wapusk:v1';
  const stages=['sightings','scale','regions','model'], labels={observe:'Seasonal sightings observation',scales:'Evidence and scale',regional:'Region evidence and uncertainty',seasonal:'Initial model: seasonally available ice',persistent:'Initial model: ice persists into summer',question:'Question for the Driving Question Board'};
  const signature=()=>crypto.getRandomValues(new Uint32Array(1))[0].toString(16).toUpperCase().padStart(8,'0');
  const clean=x=>typeof x==='string'?x.slice(0,1600):'';
  const el=(tag,value)=>Object.assign(document.createElement(tag),{textContent:value??''});
  const tell=t=>{$('status').textContent=t;};
  // NSIDC Sea Ice Index v4 five-day annual minima, via the attributed table on the page.
  // Keep the historical lesson endpoint at 2023; these are not NASA's sea-ice AREA values.
  const iceRows=[
    [1987,5,6.96],[1988,12,7.13],[1989,15,6.91],[1990,22,6.04],[1991,18,6.30],[1992,9,7.21],
    [1993,9,6.18],[1994,8,6.96],[1995,8,6.03],[1996,11,7.19],[1997,23,6.63],[1998,19,6.35],
    [1999,13,5.76],[2000,12,5.98],[2001,20,6.60],[2002,14,5.64],[2003,18,6.01],[2004,20,5.79],
    [2005,22,5.32],[2006,17,5.77],[2007,18,4.15],[2008,20,4.59],[2009,13,5.12],[2010,21,4.62],
    [2011,11,4.34],[2012,17,3.39],[2013,13,5.05],[2014,17,5.03],[2015,9,4.43],[2016,10,4.17],
    [2017,13,4.66],[2018,23,4.66],[2019,18,4.19],[2020,16,3.82],[2021,16,4.77],[2022,19,4.70],[2023,19,4.26]
  ];
  const parkSource='https://parks.canada.ca/pn-np/mb/wapusk/nature/climatique-climate';
  const parkAreaKm2=11475;
  const parkScale='Wapusk National Park covers 11,475 km². The sightings maps include places in and around the park.';
  const parkLink=el('a','Parks Canada');parkLink.href=parkSource;
  $('park-scale').append(parkScale+' (',parkLink,').');
  const scaleInputs=all('[name="scale-match"]');
  const scaleOptions=Object.fromEntries(scaleInputs.map(b=>[b.value,b.parentElement.textContent.trim()]));
  const requiredScales=['canada','bay','arctic'];
  // Earlier notebooks did not have the local, across-seasons park example.
  const scaleGood=(choices,version)=>{const required=version===2?['park',...requiredScales]:requiredScales;
    return choices?.length===required.length&&required.every(k=>choices.includes(k));};
  const scaleFeedback=(choices,version)=>choices===null?'':scaleGood(choices,version)?
    version===2?'Yes. The park maps compare seasons locally. The other three records compare years at larger scales. None tells us when individual bears meet.':'Yes. Your earlier check matched three records to their scales. You can also try the new local park example.':
    choices.includes('camp')?'The Arctic chart covers a huge area. It does not show the date or behavior of individual bears at Owl River. Compare the other claims with their data sources.':'Look again at the places and times covered by the data sources. More than one statement fits.';
  const owlLabels={place:'The three species used the same location on different occasions.',meeting:'The three species were observed together.'};
  const owlFeedback={place:'That matches the evidence. The photos show one location used on different occasions, not a meeting.',meeting:'Look at the difference between place and time. The photographs do not establish an encounter.'};
  const figures=[
    ['Canada annual temperature change, 1948–2022','Scatter plot of yearly values and a fitted trend line.','Government of Canada','What is the long-term pattern? Which years depart from it?'],
    ['Western Hudson Bay sea-ice breakup date','Scatter plot of dates of sea-ice breakup over several decades.','Walsh et al. (2022)','Read dates on the vertical axis. If breakup happens earlier, what might that mean for time spent on sea ice?'],
    ['Arctic annual minimum sea-ice extent, 1987–2023','Explore the annual extent series.','NSIDC Sea Ice Index','Compare years, not months. What can this Arctic-wide minimum tell you about one bay?'],
    ['Observed Arctic tundra greening and browning','Satellite-based map of areas that show more vegetation, less vegetation, or little change.','Mekonnen et al. (2021); Ponomarenko et al. (2014)','Find the Wapusk marker. What varies across the map?']
  ];
  function enlarge(img,caption){
    const target=$('visual-image');target.src=img.getAttribute('src');target.alt=img.alt;
    $('visual-caption').textContent=caption;$('visual-dialog').showModal();
  }
  function drawFigure(i){
    const row=figures[i],img=$('scale-image'),ice=i===2;
    $('static-scale').hidden=ice;$('sea-ice').hidden=!ice;
    if(!ice){img.src='assets/wapusk-scale-'+(i+1)+'.webp';img.alt=row[1];$('scale-caption').textContent=row[0]+' · '+row[2];}
    $('scale-prompt').textContent=row[3];$('nasa').hidden=!ice;
    if(i!==2)pauseVideo($('nasa'));
    for(const b of all('[data-figure]'))b.setAttribute('aria-pressed',String(Number(b.dataset.figure)===i));
  }
  function svg(tag,attributes,content=''){
    const e=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [k,v] of Object.entries(attributes))e.setAttribute(k,String(v));
    e.textContent=content;return e;
  }
  const iceSVG=$('ice-plot'),iceYear=$('ice-year'),x=year=>61+(year-1987)*15.7,y=value=>257-(value-3)*45;
  function drawIce(year){
    const row=iceRows[year-1987]||iceRows.at(-1);
    year=row[0];iceYear.value=String(year);iceYear.setAttribute('aria-valuetext',year+': '+row[2].toFixed(2)+' million square kilometers');
    const grid=[];
    for(let i=3;i<=8;i++)grid.push(svg('path',{d:'M61 '+y(i)+'H629',class:'wb-ice-guide'}),svg('text',{x:52,y:y(i)+5,'text-anchor':'end',class:'wb-ice-label'},String(i)));
    const ticks=[1987,1995,2005,2012,2023].map(v=>svg('text',{x:x(v),y:285,'text-anchor':'middle',class:'wb-ice-label'},String(v)));
    const path=iceRows.map(([yr,_,val],i)=>(i?'L':'M')+x(yr)+' '+y(val)).join(' ');
    iceSVG.replaceChildren(...grid,...ticks,svg('text',{x:61,y:20,class:'wb-ice-label'},'Million km²'),svg('text',{x:345,y:313,'text-anchor':'middle',class:'wb-ice-label'},'Year'),svg('path',{d:path,class:'wb-ice-line'}),
      ...iceRows.map(([yr,_,v])=>svg('circle',{cx:x(yr),cy:y(v),r:yr===2012||yr===2023?4:3,class:'wb-ice-dot'})),
      svg('path',{d:'M'+x(year)+' '+y(row[2])+'V257',class:'wb-ice-guide','stroke-dasharray':'5 4'}),
      svg('circle',{cx:x(year),cy:y(row[2]),r:7,class:'wb-ice-marker'}));
    $('ice-value').textContent=year+': '+row[2].toFixed(2)+' million km² · September '+row[1]+(year===2012?' · record low':'');
    for(const b of all('[data-ice-year]'))b.setAttribute('aria-pressed',Number(b.dataset.iceYear)===year);
  }
  iceYear.oninput=()=>drawIce(Number(iceYear.value));
  for(const b of all('[data-ice-year]'))b.onclick=()=>drawIce(Number(b.dataset.iceYear));
  iceSVG.onclick=e=>{const p=iceSVG.getBoundingClientRect();drawIce(Math.max(1987,Math.min(2023,Math.round(1987+((e.clientX-p.left)/p.width*660-61)/15.7))));};
  $('ice-data').replaceChildren(...iceRows.map(([yr,day,val])=>{const tr=el('tr'),th=el('th',yr);th.scope='row';tr.append(th,el('td','September '+day),el('td',val.toFixed(2)));return tr;}));
  drawIce(2023);
  function pauseVideo(host){
    host.querySelector('iframe')?.remove();const button=host.querySelector('[data-video]');if(button)button.hidden=false;
  }
  const regions={
    seasonal:{name:'Seasonal Ice',ice:'Sea ice forms and melts each year. Around Hudson Bay, polar bears typically come ashore when it melts and wait for ice to reform.',rows:[['Baffin Bay','Likely stable','Decline','Decline'],['Davis Strait','Likely decrease','Decline','Decline'],['Foxe Basin','Likely stable','Uncertain','Stable'],['Southern Hudson Bay','Likely decrease','Decline','Stable'],['Western Hudson Bay','Likely decrease','Decline','Decline']],source:'Seasonal Ice Visual Inquiry'},
    convergent:{name:'Convergent Ice',ice:'Currents push floating ice toward northern Canadian and Greenland shores. Ice accumulating near shore can provide hunting habitat through summer.',rows:[['East Greenland','Not enough data','Uncertain','Uncertain'],['Northern Beaufort Sea','Likely stable','Uncertain','Stable']],source:'Convergent Ice Visual Inquiry'},
    divergent:{name:'Divergent Ice',ice:'Ice forms near shore in winter and drifts out toward the Arctic basin. In summer, that can leave open water between the coast and the ice.',rows:[['Barents Sea','Likely stable','Uncertain','Uncertain'],['Chukchi Sea','Likely stable','Uncertain','Uncertain'],['Kara Sea','Not enough data','Uncertain','Uncertain'],['Laptev Sea','Not enough data','Uncertain','Uncertain'],['Southern Beaufort Sea','Likely decrease','Decline','Decline']],source:'Divergent Ice Visual Inquiry'},
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
  let state={v:1,id:signature(),step:'sightings',season:'winter',region:'seasonal',figure:0,fields:{},check:'',scaleCheck:null,scaleCheckVersion:2,scaleDraft:null,finished:false,lastVisitedAt:0}, session, legacy=false, recovery=false, picked=-1;
  try{
    session=window.OpenSciEdSaveSession?.open(localStorage,'b5-wapusk',[KEY]);
    const raw=session?.read(KEY);
    if(raw!=null){
      const x=JSON.parse(raw);
      if(x.v!==1||!/^[A-F0-9]{8}$/.test(x.id))throw Error('Unrecognized saved work');
      state={...state,id:x.id,lastSavedAt:window.OpenSciEdB5Workspace.timestamp(x.lastSavedAt),step:stages.includes(x.step)?x.step:'sightings',season:x.season==='summer'?'summer':'winter',
        region:Object.hasOwn(regions,x.region)?x.region:'seasonal',fields:Object.fromEntries(Object.keys(labels).map(k=>[k,clean(x.fields?.[k])])),
        check:['place','meeting'].includes(x.check)?x.check:'',figure:Number.isInteger(x.figure)&&figures[x.figure]?x.figure:0,
        scaleCheck:cleanScale(x.scaleCheck),scaleCheckVersion:x.scaleCheckVersion===2?2:1,scaleDraft:cleanScale(x.scaleDraft),finished:x.finished===true,lastVisitedAt:Number(x.lastVisitedAt)||0};
      legacy=Object.values(state.fields).some(v=>v.trim())||Boolean(state.check)||state.scaleCheck!==null||state.scaleDraft!==null||state.finished;
    }
  }catch(_){recovery=true;}
  const identity=window.OpenSciEdSaveSession?.reportIdentity?.(session,[KEY],()=>window.Lab?.identity?.get?.()??null)??(()=>null);
  const canSave=()=>!recovery&&session?.check(KEY).ok;
  function resetState(){ $('reset').disabled=!canSave()||!(Object.values(state.fields).some(v=>v.trim())||state.check||state.scaleCheck!==null||state.scaleDraft!==null||state.finished); }
  const receipt=window.OpenSciEdB5Workspace.mount({output:$('save'),key:KEY,session,canSave,restored:()=>legacy,getRecord:()=>state});
  function save(workChanged=true){state.lastVisitedAt=Date.now();const ok=receipt.write(workChanged);resetState();return ok;}
  const uiKey=id=>'aplab:ui:wapusk:disclosure:'+id;
  let resetDisclosures=false;
  function storeDisclosure(d){
    if(!resetDisclosures)try{sessionStorage.setItem(uiKey(d.dataset.keepOpen),d.open?'yes':'no');}catch(_){}
  }
  // Native toggle can be queued until the next task. Capture the actual open state
  // before navigation, including when a student reloads immediately after a click.
  window.addEventListener('pagehide',()=>all('details[data-keep-open]').forEach(storeDisclosure));
  for(const d of all('details[data-keep-open]')){
    try{d.open=sessionStorage.getItem(uiKey(d.dataset.keepOpen))==='yes';}catch(_){}
    d.addEventListener('toggle',()=>storeDisclosure(d));
  }
  function section(step,focus=true){
    for(const key of stages){$(key).hidden=key!==step;if(key!==step)for(const host of $(key).querySelectorAll('.wb-video'))pauseVideo(host);}
    for(const button of all('.wb-tabs [data-step]')){
      if(button.dataset.step===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
    }
    state.step=step;
    if(step==='model')drawRecap();
    if(step==='scale')$('scale-recap').textContent=state.fields.observe?.trim()?'Your Wapusk observation: '+state.fields.observe.trim():'';
    if(focus){
      if(step!=='scale'&&location.hash==='#wb-sea-ice')history.replaceState(null,'',location.pathname+location.search);
      $(step+'-title').focus();save(false);
    }
  }
  function showMark(index){
    picked=index;
    for(const [i,b] of [...$('markers').children].entries())b.setAttribute('aria-pressed',String(i===index));
    const row=marks[state.season][index];
    $('evidence').replaceChildren(el('h3',row?.[1]||'Inspect a marker'),el('p',row?.[4]||'Choose a symbol on the map for evidence about its habitat or what the record shows.'));
    const profile={'△':'polar','◆':'brown','⬟':'black'}[row?.[0]];
    $('evidence').classList.toggle('wb-evidence-with-profile',Boolean(profile));
    if(profile){
      const img=el('img');img.src='assets/openscied-bear-profile-'+profile+'.svg';
      img.width=400;img.height=240;img.alt='';img.className='wb-evidence-profile';
      $('evidence').append(img);
    }
    if(row?.[0]==='◎'){const a=el('a','View the research photos (Figure 3, opens in a new tab)');a.href=study;a.target='_blank';a.rel='noopener noreferrer';$('evidence').append(a);}
  }
  function drawSeason(){
    $('map').dataset.season=state.season;
    for(const b of all('.wb-controls [data-season]'))b.setAttribute('aria-pressed',String(b.dataset.season===state.season));
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
      const explain=el('p',state.region==='seasonal'?'Read two different measures. For example, the map says Baffin Bay’s population size was likely stable, while the table shows declines in body condition and reproduction. All can be true at the same time.':'Read two different measures. “Likely stable” on the map means the estimated number of bears was roughly steady. It does not tell us if the bears’ body condition or reproduction was steady.');
      explain.className='wb-pop-note';panel.append(explain);
      const f=el('figure'),img=el('img'),caption=el('figcaption',r.name+' · Original OpenSciEd visual inquiry map (CC BY-NC 4.0); source credits remain on the slide.');
      f.className='wb-source-figure wb-region-figure';img.src='assets/wapusk-'+state.region+'-map.webp';
      img.alt='Map and legend for polar bear population estimates and short-term trends in '+r.name;
      img.width=1100;img.height=825;img.loading='lazy';
      const zoom=el('button','Enlarge regional map');zoom.className='btn';zoom.type='button';zoom.onclick=()=>enlarge(img,caption.textContent);
      f.append(img,caption,zoom);panel.append(f);
      const table=el('table'), thead=el('thead'), head=el('tr'),body=el('tbody');table.className='wb-table wb-pop-table';
      for(const title of ['Subpopulation','Population size (map)','Body condition','Reproduction']){
        const th=el('th',title);th.scope='col';head.append(th);
      }
      for(const [where,population,bodyTrend,repro] of r.rows){
        const tr=el('tr'),th=el('th',where);th.scope='row';tr.append(th,el('td',population),el('td',bodyTrend),el('td',repro));body.append(tr);
      }
      thead.append(head);table.append(el('caption','Original Lesson 1 snapshot · three distinct measures, not a current status update'),thead,body);panel.append(table);
      panel.append(el('p','“Uncertain” marks insufficient evidence in this snapshot, not stability. Body condition describes physical condition; reproduction describes litter size or time between litters.'));
    }else{
      panel.append(el('p','The transcript describes the ice pattern but does not supply this region’s body condition or reproduction table. Don’t infer a trend from missing data.'));
    }
    panel.append(el('p','Source: OpenSciEd '+r.source+'.'));
  }
  function drawRecap(){
    const p=$('recap');p.replaceChildren(el('h3','Bring your earlier evidence forward'));
    for(const k of ['observe','scales','regional']){
      const b=el('p');b.append(el('strong',labels[k]+': '),document.createTextNode(state.fields[k]?.trim()||'Not recorded yet.'));p.append(b);
    }
  }
  function feedback(){
    const r=owlRecord();$('feedback').textContent=r.answer?owlResultText(r):'';
    for(const b of all('[name="overlap"]'))b.checked=b.value===state.check;
  }
  for(const b of all('[data-figure]'))b.onclick=()=>{state.figure=Number(b.dataset.figure);drawFigure(state.figure);save();};
  function cleanScale(raw){return Array.isArray(raw)?[...new Set(raw.filter(k=>Object.hasOwn(scaleOptions,k)))]:null;}
  const readScale=()=>scaleInputs.filter(b=>b.checked).map(b=>b.value);
  function showScaleCheck(){
    const choices=state.scaleDraft??state.scaleCheck;
    for(const b of scaleInputs)b.checked=choices?.includes(b.value)||false;
    $('scale-feedback').textContent=state.scaleDraft!==null?'Choose Check the scales for feedback.':scaleFeedback(state.scaleCheck,state.scaleCheckVersion);
  }
  for(const b of scaleInputs)b.addEventListener('change',()=>{state.scaleDraft=readScale();showScaleCheck();save();});
  $('scale-check').onsubmit=e=>{e.preventDefault();state.scaleCheck=readScale();state.scaleCheckVersion=2;state.scaleDraft=null;showScaleCheck();save();};
  showScaleCheck();
  $('enlarge-scale').onclick=()=>enlarge($('scale-image'),$('scale-caption').textContent);
  for(const b of all('[data-video]'))b.onclick=()=>{
    const frame=el('iframe'),host=b.closest('.wb-video');
    frame.src='https://www.youtube-nocookie.com/embed/'+b.dataset.video+'?autoplay=1&rel=0';
    frame.title=b.dataset.videoTitle;frame.setAttribute('allow','autoplay; encrypted-media; picture-in-picture; fullscreen');
    frame.setAttribute('allowfullscreen','');frame.referrerPolicy='strict-origin-when-cross-origin';
    host.prepend(frame);b.hidden=true;frame.focus();
  };
  const directIce=location.hash==='#wb-sea-ice';
  if(directIce)state.figure=2;
  drawFigure(state.figure);
  for(const b of all('[data-step]'))b.onclick=()=>section(b.dataset.step);
  for(const b of all('.wb-controls [data-season]'))b.onclick=()=>{state.season=b.dataset.season;picked=-1;drawSeason();save();};
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
  window.Lab?.identity?.mount?.('#wb-identity',{compact:true,sharedDevice:true});
  $('reset').onclick=()=>{$('reset-confirm').value='';$('reset-error').textContent='';$('clear').disabled=true;$('reset-dialog').showModal();};
  $('keep').onclick=()=>$('reset-dialog').close();
  $('reset-confirm').oninput=e=>{$('clear').disabled=e.target.value!=='ERASE';};
  $('reset-form').onsubmit=e=>{
    e.preventDefault();if($('reset-confirm').value!=='ERASE')return;
    if(!canSave()||!session.reset(KEY).ok){$('reset-error').textContent='Could not clear saved work from this tab. Reload and try again.';return;}
    resetDisclosures=true;
    try{for(const d of all('details[data-keep-open]'))sessionStorage.removeItem(uiKey(d.dataset.keepOpen));}catch(_){}
    location.reload();
  };
  drawSeason();drawRegion();feedback();section(directIce?'scale':state.step,false);resetState();
  const popColumns=['Subpopulation','Population size (map)','Body condition','Reproduction'];
  const evidenceSource='Wapusk sightings and regional snapshot: OpenSciEd B.5 Lesson 1. Arctic extent: NSIDC Sea Ice Index v4, 1987–2023 (five-day yearly minima). Interactive map is schematic.';
  function owlRecord(){return {answer:owlLabels[state.check]||null,verdict:state.check==='place'?'Supported':state.check==='meeting'?'Not supported':'Not checked',feedback:owlFeedback[state.check]||null};}
  function owlResultText(owl){return owl.verdict+(owl.answer?' · '+owl.answer+' '+owl.feedback:'');}
  function scaleRecord(){
    const draft=state.scaleDraft!==null;
    const keys=state.scaleDraft??state.scaleCheck;
    return {question:$('scale-check-question').textContent,choices:keys?.map(k=>scaleOptions[k])||[],
      verdict:draft?'Selections not checked':keys===null?'Not checked':scaleGood(keys,state.scaleCheckVersion)?'Correct':'Try again',
      feedback:draft?'You saved these selections without checking them.':scaleFeedback(keys,state.scaleCheckVersion)||null};
  }
  function makeReport(){
    const missing=unfinished().map(k=>'Record: '+labels[k]+'.');
    if(!state.finished)missing.push('Choose Finish evidence notebook.');
    const r=regions[state.region],owl=owlRecord(),scale=scaleRecord();
    const regionItems=r.rows.length?[{type:'text',text:'Population size (map), body condition, and reproduction are different measurements.'},{type:'table',columns:popColumns,rows:r.rows}]:[{type:'text',text:'The source does not supply a body condition or reproduction table for Islands Ice.'}];
    return {title:'Three Bears in Wapusk',unit:'OpenSciEd B.5 · Lesson 1 companion',source:evidenceSource,
      status:!canSave()?'recovery':missing.length?'draft':'final',student:identity(),datasetId:'WB-'+state.id,missing,
      sections:[
        {title:'Evidence notebook · '+r.name,items:Object.entries(labels).map(([k,prompt])=>({type:'answer',prompt,value:state.fields[k]||''}))},
        {title:'Concept checks',items:[
          {type:'text',text:parkScale+' Source: Parks Canada ('+parkSource+').'},
          {type:'answer',prompt:'Owl River claim verdict',value:owlResultText(owl)},
          {type:'answer',prompt:scale.question,value:scale.verdict+(scale.choices.length?' · '+scale.choices.join(' '):'')+(scale.feedback?' '+scale.feedback:'')}
        ]},
        {title:'Evidence reference · '+r.name,items:regionItems}
      ]};
  }
  function downloadReport(bytes,mime,suffix,r){
    const url=URL.createObjectURL(new Blob([bytes],{type:mime}));
    const a=el('a');a.href=url;a.hidden=true;a.download='three-bears-wapusk-'+r.datasetId+'.'+suffix;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800);
    $('export-status').textContent='Downloaded '+suffix.toUpperCase()+' for this activity only.';
  }
  const reportWords={final:'Required work was recorded. This does not show who did the work or how well.',draft:'Draft. Check the items still to do before you submit.',recovery:'Recovered work. Check the name and work before sharing.'};
  function reportHTML(r){
    const d=document.implementation.createHTMLDocument(r.title);
    d.documentElement.lang='en';const charset=d.createElement('meta');charset.charset='utf-8';d.head.prepend(charset);
    const viewport=d.createElement('meta');viewport.name='viewport';viewport.content='width=device-width, initial-scale=1';d.head.append(viewport);
    const style=d.createElement('style');style.textContent='body{font:16px/1.5 system-ui,sans-serif;color:#163532;background:#fff;margin:1.5rem auto;padding:0 1rem;max-width:850px} h1,h2,h3{line-height:1.18} p{overflow-wrap:anywhere;white-space:pre-wrap} section{border-top:1px solid #b7c9c2} table{border-collapse:collapse;width:100%;table-layout:fixed} th,td{padding:.45rem;border:1px solid #b7c9c2;text-align:left;overflow-wrap:anywhere}';d.head.append(style);
    const add=(dest,tag,val)=>{const n=d.createElement(tag);if(val!==undefined)n.textContent=val;dest.append(n);return n;};
    add(d.body,'h1',r.title);add(d.body,'p',r.unit);add(d.body,'p',reportWords[r.status]);
    add(d.body,'p','Name: '+(r.student?.name||'Not entered')+' · Class period: '+(r.student?.period||'Not entered'));
    add(d.body,'p','Dataset ID: '+r.datasetId);add(d.body,'p','Evidence sources: '+r.source);
    if(r.missing.length){add(d.body,'h2','Still to do');for(const m of r.missing)add(d.body,'p',m);}
    for(const group of r.sections){
      const part=add(d.body,'section');add(part,'h2',group.title);
      for(const item of group.items){
        if(item.type==='answer'){add(part,'h3',item.prompt);add(part,'p',item.value||'Not answered');}
        else if(item.type==='text')add(part,'p',item.text);
        else if(item.type==='table'){
          const t=add(part,'table'),head=add(add(t,'thead'),'tr'),body=add(t,'tbody');
          for(const col of item.columns)add(head,'th',col).scope='col';
          for(const values of item.rows){const tr=add(body,'tr');for(const v of values)add(tr,'td',v);}
        }
      }
    }
    return '<!doctype html>\n'+d.documentElement.outerHTML;
  }
  $('save-html').onclick=()=>{const r=makeReport();downloadReport(reportHTML(r),'text/html;charset=utf-8','html',r);};
  $('save-json').onclick=()=>{
    const r=makeReport(),region=regions[state.region];
    const json={format:'wapusk-activity-v1',title:r.title,status:r.status,datasetId:r.datasetId,student:r.student,exportedAt:new Date().toISOString(),evidenceSource,
      season:state.season,region:{name:region.name,columns:popColumns,rows:region.rows},responses:{...state.fields},
      conceptChecks:{owlRiver:owlRecord(),evidenceScale:scaleRecord()},localScale:{parkAreaKm2,scope:parkScale,source:parkSource},seaIceMinimumExtent:{source:'NSIDC Sea Ice Index v4 annual five-day minima',units:'million km²',values:iceRows.map(([year,day,extent])=>({year,date:year+'-09-'+String(day).padStart(2,'0'),extent}))}};
    downloadReport(JSON.stringify(json,null,2),'application/json','json',r);
  };
  window.OpenSciEdSubmission?.mount({target:'#wb-report',filename:'three-bears-wapusk',collect:makeReport});
})();
