/* OpenSciEd Biology B.1 Lesson 5, Teacher Edition pp. 126–129.
 * 22-student classroom example: 2 observers, 2 wildebeest, 18 grass roles.
 * One grass role feeds one wildebeest. Survivors add floor(survivors/2)
 * offspring. Unfed wildebeest become grass; one grass role per offspring
 * switches to wildebeest. Unchanged roles remain, maintaining 20 role slots.
 * At exact equality there is one grass per animal, so all survive. The
 * instructions do not select a named grass token to convert; counts suffice.
 * A constant percentage of grass roles available each round, rounded down
 * to a whole role, is an optional DIGITAL EXTENSION, not a classroom rule.
 * This is deterministic, not real yearly food production or population data.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CarryingLogic = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DEFAULT_ROUNDS=12, MAX_ROUNDS=15;
  const BASELINE=Object.freeze({grassPercent:100,roleSlots:20,startingPopulation:2});
  const COMPARISON=Object.freeze({...BASELINE,grassPercent:50});
  const integer=(value,low,high)=>Number.isInteger(value)&&value>=low&&value<=high;
  const valid=s=>s&&integer(s.roleSlots,2,120)&&integer(s.grassPercent,0,100)&&integer(s.startingPopulation,0,s.roleSlots);
  function create(options={}){
    const settings={...BASELINE,...options};
    if(!valid(settings))throw new RangeError('Use whole role slots, a starting herd that fits, and a grass percentage from 0 to 100.');
    const {grassPercent,roleSlots,startingPopulation}=settings;
    return {version:1,grassPercent,roleSlots,startingPopulation,population:startingPopulation,round:0,rows:[]};
  }
  function preview(state){
    const starting=state.population,grassRoles=state.roleSlots-starting;
    return {starting,grassRoles,grassAvailable:Math.floor(grassRoles*state.grassPercent/100)};
  }
  const available=state=>preview(state).grassAvailable;
  function step(state){
    if(state.round>=MAX_ROUNDS)return state;
    const {starting,grassRoles,grassAvailable}=preview(state);
    const survivors=Math.min(starting,grassAvailable),deaths=starting-survivors,births=Math.floor(survivors/2);
    const ending=survivors+births,grassNext=state.roleSlots-ending,round=state.round+1;
    const row={round,starting,grassRoles,grassAvailable,survivors,deaths,births,ending,grassNext,
      grassEaten:survivors,grassUneaten:grassAvailable-survivors,grassUnavailable:grassRoles-grassAvailable};
    return {...state,population:ending,round,rows:[...state.rows,row]};
  }
  function run(settings,rounds=DEFAULT_ROUNDS){
    if(!integer(rounds,0,MAX_ROUNDS))throw new RangeError('A trial has at most '+MAX_ROUNDS+' rounds.');
    let state=create(settings);
    for(let i=0;i<rounds;i++)state=step(state);
    return state;
  }
  // Recompute the deterministic trial and refuse inconsistent saves; do not
  // silently repair or overwrite a save with unsupported data.
  function restore(raw){
    try{
      const saved=typeof raw==='string'?JSON.parse(raw):raw;
      if(saved?.version!==1||!valid(saved)||!integer(saved.round,0,MAX_ROUNDS)||!Array.isArray(saved.rows)||saved.rows.length!==saved.round)return null;
      const out=run(saved,saved.round);
      if(saved.population!==out.population)return null;
      for(const [i,row] of out.rows.entries()){
        if(!saved.rows[i]||Object.keys(row).some(key=>row[key]!==saved.rows[i][key]))return null;
      }
      return out;
    }catch(_){return null;}
  }
  function summary(state){
    const populations=[state.startingPopulation,...state.rows.map(r=>r.ending)];
    const firstSeen=new Map();let cycle=null;
    for(const [index,population] of populations.entries()){
      if(firstSeen.has(population)){
        const first=firstSeen.get(population),values=populations.slice(first,index);
        cycle={firstRound:first,repeatRound:index,values,min:Math.min(...values),max:Math.max(...values)};
        break;
      }
      firstSeen.set(population,index);
    }
    const limited=state.rows.filter(r=>r.deaths>0);
    return {rounds:state.round,start:state.startingPopulation,end:state.population,peak:Math.max(...populations),populations,
      firstShortageRound:limited[0]?.round??null,shortageRounds:limited.map(r=>r.round),cycle,
      totalBirths:state.rows.reduce((n,r)=>n+r.births,0),totalDeaths:state.rows.reduce((n,r)=>n+r.deaths,0)};
  }

  const TEACHER='https://openscied-uploads-production.s3.amazonaws.com/G9_UBE/hires/B.1%20Teacher%20Edition.pdf';
  const PAPER='https://doi.org/10.1046/j.1365-2656.1999.00352.x';
  const TABLE='https://besjournals.onlinelibrary.wiley.com/doi/10.1046/j.1365-2656.1999.00352.x';
  // Mduma et al. (1999), Table 5, column 3 (March census/population estimates).
  // Copy exact published values. Do not present interpolated estimates as
  // direct counts, fill unavailable years, or infer the source handout values.
  const historicalRows=Object.freeze([
    [1961,263362],[1962,306789],[1963,356124],[1964,402916],[1965,439124],[1966,461219],
    [1967,483292],[1968,519959],[1969,570299],[1970,629506],[1971,692777],[1972,773014],
    [1973,897156],[1974,1057890],[1975,1221879],[1976,1335785],[1977,1440000],[1978,1248934],
    [1979,1293457],[1980,1337979],[1981,1273345],[1982,1208711],[1983,1315111],[1984,1337879],
    [1985,1214961],[1986,1146340],[1987,1161429],[1988,1176517],[1989,1191606],[1990,1206694],
    [1991,1221783],[1992,1215627],[1993,1209471],[1994,917204]
  ].map(([year,population])=>Object.freeze({year,population,
    completeness:year===1992||year===1993?'survival-derived estimate':'published March estimate'})));
  const EVIDENCE=Object.freeze({
    title:'Serengeti wildebeest population estimates, 1961–1994',
    rows:historicalRows,
    source:'Mduma, Sinclair & Hilborn (1999), Food regulates the Serengeti wildebeest: a 40-year record, Table 5, column 3',
    url:PAPER,tableUrl:TABLE,teacherUrl:TEACHER+'#page=134',
    studentUrl:'https://openscied-uploads-production.s3.amazonaws.com/G9_UBE/hires/B.1%20Student%20Edition.pdf',
    handoutUrl:'https://drive.google.com/file/d/1ZJuRGqKEM4NFmUVmj7jDjU4dmEh_iLi1/view?usp=drive_link',
    handoutTitle:'OpenSciEd B.1 Lesson 5 handout: Wildebeest Population Data',
    method:'The March estimates include censuses and interpolated values for years without counts; 1992 and 1993 are estimated from survival data. This published excerpt is not the full classroom handout series.',
    units:'wildebeest',
    intervals:Object.freeze([
      Object.freeze({start:1961,end:1977,label:'Long increase'}),
      Object.freeze({start:1977,end:1978,label:'One-year decline'}),
      Object.freeze({start:1978,end:1991,label:'Overall change with fluctuations'}),
      Object.freeze({start:1993,end:1994,label:'Decline during the drought period'})
    ]),
    context:Object.freeze([
      Object.freeze({year:1963,text:'Earlier rinderpest outbreaks increased mortality. The growth phase followed control of the disease.'}),
      Object.freeze({year:1993,text:'The study documented severe drought in 1993 and high dry-season mortality. The drop is evident in the 1994 estimate.'})
    ])
  });
  function historicalRate(start,end){
    const a=historicalRows.find(row=>row.year===start),b=historicalRows.find(row=>row.year===end);
    if(!a||!b||end<=start)return null;
    const change=b.population-a.population,years=end-start;
    return {start,end,startPopulation:a.population,endPopulation:b.population,years,change,rate:change/years};
  }
  return Object.freeze({BASELINE,COMPARISON,DEFAULT_ROUNDS,MAX_ROUNDS,EVIDENCE,create,available,preview,step,run,restore,summary,historicalRate});
});
