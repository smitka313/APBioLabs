/* Optional Oh Deer!-inspired digital challenge. It does not change the
   Lesson 5 grass-only simulation. An animal card has one immediate need
   for this round; real animals need food, water and shelter, not just one.
   Each station's stock caps the number of matches of its own type.
   Reproduction is simplified: one calf per two survivors, rounded down.
   Stocks renew between generations. Survivors keep their assigned need;
   calves are assigned one of the three needs in a fixed rotation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CarryingHabitat = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RESOURCES=Object.freeze(['food','water','shelter']);
  const MAX_GENERATIONS=5;
  const baseStocks=Object.freeze({food:4,water:4,shelter:3});
  const makeScenario=(id,label,description,change={})=>Object.freeze({id,label,description,stocks:Object.freeze({...baseStocks,...change})});
  const SCENARIOS=Object.freeze([
    makeScenario('balanced','Balanced habitat','This starting habitat has all three resources.'),
    makeScenario('low-food','Less forage','Less grass is available as food. Water and shelter stay the same.',{food:1}),
    makeScenario('drought','Water shortage','A dry period reduces the water stock. Food and shelter stay the same.',{water:1}),
    makeScenario('shelter-loss','Shelter loss','This habitat loses its shelter. Food and water stay the same.',{shelter:0}),
    makeScenario('food-tight','Slightly less forage','Food falls to three units, but that is enough for the three animals seeking food.',{food:3}),
    makeScenario('water-tight','Slightly less water','Water falls to three units, but that is enough for the three animals seeking water.',{water:3}),
    makeScenario('shelter-tight','Slightly less cover','Shelter falls to two units, but that is enough for the two animals seeking cover.',{shelter:2})
  ]);
  const startNeeds=Object.freeze(['food','water','shelter','food','water','shelter','food','water']);
  const scenarioFor=id=>SCENARIOS.find(s=>s.id===id);
  function drawScenario(random=Math.random){
    const roll=Number(random());
    if(!Number.isFinite(roll)||roll<0||roll>=1)throw new RangeError('Random choice requires a value from 0 up to, but not including, 1.');
    return SCENARIOS[1+Math.floor(roll*(SCENARIOS.length-1))].id;
  }
  function create(scenarioId='balanced'){
    const scenario=scenarioFor(scenarioId)||SCENARIOS[0];
    return {
      version:1,scenarioId:scenario.id,generation:1,
      animals:startNeeds.map((need,i)=>({id:'a'+(i+1),need})),
      stocks:{...scenario.stocks},remaining:{...scenario.stocks},matches:[],phase:'match',history:[]
    };
  }
  function match(state,animalId,resource){
    if(!state||state.phase!=='match'||!RESOURCES.includes(resource)||state.remaining[resource]<=0)return state;
    const animal=state.animals.find(a=>a.id===animalId);
    if(animal?.need!==resource||state.matches.some(m=>m.animalId===animalId))return state;
    return {...state,remaining:{...state.remaining,[resource]:state.remaining[resource]-1},matches:[...state.matches,{animalId,resource}]};
  }
  function undoLast(state){
    if(!state||state.phase!=='match'||!state.matches.length)return state;
    const last=state.matches.at(-1), resource=last.resource;
    return {...state,matches:state.matches.slice(0,-1),remaining:{...state.remaining,[resource]:state.remaining[resource]+1}};
  }
  function breakdown(state){
    return Object.fromEntries(RESOURCES.map(resource=>{
      const needed=state.animals.filter(a=>a.need===resource).length;
      const matched=state.matches.filter(m=>m.resource===resource).length;
      return [resource,{needed,available:state.stocks[resource],matched,unmatched:needed-matched,unused:state.remaining[resource]}];
    }));
  }
  function status(state){
    const complete=state.phase==='complete',rows=Object.values(breakdown(state));
    const legalCount=complete?0:rows.reduce((n,r)=>n+Math.min(r.unmatched,r.unused),0);
    return {remaining:state.animals.length-state.matches.length,legalCount,canFinish:!complete&&!legalCount,
      complete,canContinue:complete&&state.generation<MAX_GENERATIONS&&state.matches.length>0};
  }
  function summary(state){
    const complete=state.phase==='complete',byResource=breakdown(state);
    const survivors=state.matches.length,births=complete?Math.floor(survivors/2):null;
    return {
      complete,starting:state.animals.length,survivors,deaths:complete?state.animals.length-survivors:null,
      births,ending:complete?survivors+births:null,
      limiting:RESOURCES.filter(r=>byResource[r].needed>byResource[r].available),byResource
    };
  }
  function finish(state){
    if(!status(state).canFinish)return state;
    const finished={...state,phase:'complete'};
    const record={generation:state.generation,summary:summary(finished),matches:state.matches.slice()};
    return {...finished,history:[...state.history,record]};
  }
  function nextGeneration(state){
    if(!status(state).canContinue)return state;
    const generation=state.generation+1,alive=new Set(state.matches.map(m=>m.animalId));
    const animals=state.animals.filter(a=>alive.has(a.id)).map(a=>({...a}));
    const births=Math.floor(animals.length/2);
    for(let i=0;i<births;i++)animals.push({id:'g'+generation+'-b'+(i+1),need:RESOURCES[i%RESOURCES.length]});
    return {...state,generation,animals,remaining:{...state.stocks},matches:[],phase:'match'};
  }
  function comparison(scenarioId){
    const scenario=scenarioFor(scenarioId);
    if(!scenario)return null;
    return {baselineId:'balanced',scenarioId,changes:RESOURCES.filter(r=>scenario.stocks[r]!==baseStocks[r])
      .map(resource=>({resource,baseline:baseStocks[resource],scenario:scenario.stocks[resource]}))};
  }
  function sameMatches(a,b){
    return Array.isArray(a)&&a.length===b.length&&a.every((m,i)=>m?.animalId===b[i].animalId&&m?.resource===b[i].resource);
  }
  function replayMatches(state,actions){
    if(!Array.isArray(actions)||actions.length>state.animals.length)return null;
    for(const m of actions){
      const result=m&&match(state,m.animalId,m.resource);
      if(!result||result===state)return null;
      state=result;
    }
    return state;
  }
  function restore(raw){
    try{
      const saved=typeof raw==='string'?JSON.parse(raw):raw;
      if(saved?.version!==1||!scenarioFor(saved.scenarioId)||!Number.isInteger(saved.generation)||
        saved.generation<1||saved.generation>MAX_GENERATIONS||!Array.isArray(saved.history)||
        !['match','complete'].includes(saved.phase)||saved.history.length!==saved.generation-(saved.phase==='match'?1:0))return null;
      let state=create(saved.scenarioId);
      for(let i=0;i<saved.history.length;i++){
        const record=saved.history[i];
        if(record?.generation!==state.generation)return null;
        state=replayMatches(state,record.matches);
        if(!state||!status(state).canFinish)return null;
        state=finish(state);
        if(i<saved.history.length-1||saved.phase==='match'){
          if(!status(state).canContinue)return null;
          state=nextGeneration(state);
        }
      }
      if(saved.phase==='match')state=replayMatches(state,saved.matches);
      else if(!sameMatches(saved.matches,state.matches))return null;
      if(!state||state.phase!==saved.phase||state.generation!==saved.generation||
        !Array.isArray(saved.animals)||saved.animals.length!==state.animals.length||
        state.animals.some((a,i)=>a.id!==saved.animals[i]?.id||a.need!==saved.animals[i]?.need)||
        RESOURCES.some(r=>state.remaining[r]!==saved.remaining?.[r]||state.stocks[r]!==saved.stocks?.[r]))return null;
      return state;
    }catch(_){return null;}
  }
  return Object.freeze({RESOURCES,SCENARIOS,MAX_GENERATIONS,create,drawScenario,match,undoLast,status,finish,summary,nextGeneration,comparison,restore});
});
