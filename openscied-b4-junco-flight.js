/* Junco walk-up model. Published means set group centers; spread and individual trials are illustrative.
   The recorded reading is the first stepped distance at/below one virtual bird's threshold. */
(function(root){
  'use strict';
  const sites={urban:'UC San Diego',mountain:'Mt. Laguna'};
  const context={foraging:{label:'Foraging',max:20,increment:2},incubating:{label:'Incubating',max:2,increment:0.2}};
  const valid=(site,group)=>Object.hasOwn(sites,site)&&Object.hasOwn(context,group);
  const uint=n=>Number.isInteger(n)&&n>0&&n<=0xffffffff;
  const fresh=()=>({seed:0,serial:0,site:'urban',group:'foraging',active:null,results:[]});
  function createSeed(){
    try{return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]||1;}
    catch(_){return Math.floor(Math.random()*0xffffffff)+1;}
  }
  function mix(v){
    v=Math.imul(v^(v>>>16),0x7feb352d);
    v=Math.imul(v^(v>>>15),0x846ca68b);
    return (v^(v>>>16))>>>0;
  }
  function threshold(seed,id,site,group,field){
    const mean=field.find(row=>row.site===site&&row.group===group)?.mean;
    if(!Number.isFinite(mean))throw new Error('Missing field group mean');
    const h=mix(seed^Math.imul(id,0x9e3779b9)^(site==='urban'?0x85ebca6b:0)^(group==='foraging'?0xc2b2ae35:0));
    const u=h/0x100000000,v=mix(h^0x27d4eb2f)/0x100000000;
    // A bounded triangle spread, not estimated from the real birds.
    return mean*(0.66+0.34*(u+v));
  }
  const distance=(group,step)=>Math.round((context[group].max-context[group].increment*step)*10)/10;
  const showDistance=(group,step)=>distance(group,step).toFixed(group==='incubating'?1:0)+' m';
  function endStep(seed,id,site,group,field){
    const point=threshold(seed,id,site,group,field);
    return Array.from({length:10},(_,i)=>i+1).find(i=>distance(group,i)<=point)??10;
  }
  function clean(raw,field){
    const s=fresh();
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return s;
    s.site=Object.hasOwn(sites,raw.site)?raw.site:s.site;
    s.group=Object.hasOwn(context,raw.group)?raw.group:s.group;
    if(!uint(raw.seed)||!Number.isInteger(raw.serial)||raw.serial<0||raw.serial>0xffffffff)return s;
    s.seed=raw.seed;s.serial=raw.serial;
    const seen=new Set();
    if(Array.isArray(raw.results))s.results=raw.results.slice(-60).flatMap(row=>{
      if(!row||!uint(row.id)||row.id>s.serial||seen.has(row.id)||!valid(row.site,row.group)||row.step!==endStep(s.seed,row.id,row.site,row.group,field))return [];
      seen.add(row.id);return [{id:row.id,site:row.site,group:row.group,step:row.step}];
    }).sort((a,b)=>a.id-b.id);
    const a=raw.active;
    if(a&&a.id===s.serial&&valid(a.site,a.group)&&Number.isInteger(a.step)&&a.step>=0&&a.step<=endStep(s.seed,a.id,a.site,a.group,field)){
      const finished=s.results.some(row=>row.id===a.id&&row.site===a.site&&row.group===a.group&&row.step===a.step);
      if(finished||a.step<endStep(s.seed,a.id,a.site,a.group,field))s.active={id:a.id,site:a.site,group:a.group,step:a.step,finished};
    }
    return s;
  }
  function cancel(s){
    if(!s.active||s.active.finished)return false;
    // An unfinished trial has no recorded distance. Release its provisional number
    // without changing any completed trial ID or the seed used for its distance.
    s.serial=s.results.at(-1)?.id??0;
    s.active=null;
    return true;
  }
  function report(s){
    if(!s?.results?.length)return [];
    return ['SIMULATED WALK-UP TRIALS (not published observations)',...s.results.map(r=>
      'Trial '+r.id+': '+sites[r.site]+' · '+context[r.group].label+' · '+showDistance(r.group,r.step)+' at takeoff.'),''];
  }
  function mount({state,field,save,say}){
    const $=s=>document.getElementById('ju-'+s);
    const details=$('field-simulation');
    if(!details)return;
    if(!state.sim)state.sim=fresh();
    const sim=state.sim, site=$('sim-site'), group=$('sim-context'), start=$('sim-start'), approach=$('sim-approach'), change=$('sim-change');
    const frame=$('sim-frame'), bird=$('sim-bird'), observer=$('sim-observer'), status=$('sim-status');
    const running=()=>sim.active&&!sim.active.finished;
    const activeHere=()=>sim.active&&sim.active.site===sim.site&&sim.active.group===sim.group;
    const backdrop={urban:'assets/junco-field-campus.svg',mountain:'assets/junco-field-mountain.svg'};
    const tbody=$('sim-trials').tBodies[0];
    function show(launch=false,announce=false){
      const a=activeHere()?sim.active:null;
      site.value=sim.site;group.value=sim.group;
      site.disabled=group.disabled=start.disabled=Boolean(running());
      start.textContent=sim.serial?'Start next trial':'Start trial';
      approach.disabled=!running();
      change.hidden=!running();
      frame.dataset.context=sim.group;frame.dataset.active=String(Boolean(a));
      $('sim-backdrop').setAttribute('href',backdrop[sim.site]);
      const step=a?.step??0,x=156+step*56;
      observer.setAttribute('transform','translate('+x+' 0)');
      $('sim-tape').setAttribute('x1',x);
      $('sim-distance').textContent=a?showDistance(a.group,a.step):'—';
      bird.dataset.state=a?.finished?'flying':'stay';
      bird.classList.toggle('is-launch',launch);
      status.textContent=a
        ?'Trial '+a.id+' · '+(a.finished?'Took flight at '+showDistance(a.group,a.step)+'. Recorded in the trial log.':a.step?'The bird stayed put at '+showDistance(a.group,a.step)+'. Select Approach to move '+context[a.group].increment+' m closer and check again.':'Bird is in place. Approach in '+context[a.group].increment+' m steps, or change setup.')
        :sim.serial?'Choose a population and observation for your next trial.':'Choose a setting and start a trial.';
      $('sim-record').hidden=!sim.results.length;
      if(launch)$('sim-record').open=true;
      tbody.replaceChildren(...sim.results.map(r=>{
        const tr=document.createElement('tr');tr.dataset.trial=String(r.id);
        for(const v of [r.id,sites[r.site],context[r.group].label,showDistance(r.group,r.step)]){
          const td=document.createElement('td');td.textContent=v;tr.append(td);
        }
        return tr;
      }));
      if(announce)say(status.textContent);
    }
    function setup(){
      if(running())return;
      sim.site=site.value;sim.group=group.value;save();show();
    }
    site.addEventListener('change',setup);group.addEventListener('change',setup);
    start.addEventListener('click',()=>{
      if(running()||!valid(sim.site,sim.group))return;
      if(!sim.seed)sim.seed=createSeed();
      sim.active={id:++sim.serial,site:sim.site,group:sim.group,step:0,finished:false};
      save();show(false,true);approach.focus();
    });
    change.addEventListener('click',()=>{
      if(!cancel(sim))return;
      save();show();say('Unfinished trial canceled. Its number can be reused; completed trials are unchanged.');
      site.focus({preventScroll:true});
    });
    approach.addEventListener('click',()=>{
      if(!running())return;
      const a=sim.active;a.step++;
      const finished=a.step>=endStep(sim.seed,a.id,a.site,a.group,field);
      if(finished){
        a.finished=true;
        sim.results.push({id:a.id,site:a.site,group:a.group,step:a.step});
        if(sim.results.length>60)sim.results.shift();
      }
      save();show(finished,true);if(finished)start.focus({preventScroll:true});
    });
    if(sim.serial)details.open=true;
    show();
  }
  const api={clean,cancel,threshold,endStep,distance,report,mount};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.JuncoFlight=api;
})(typeof window==='object'?window:null);
