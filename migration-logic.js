/* Original migration explorer. Evidence transcribed from the user-supplied OpenSciEd
 * B.1 Lesson 3 Reference Wildebeest Data Cards (18 cards). Each card is a MONTHLY
 * GROUP AVERAGE, not one animal or a sample count. Do not synthesize extra records.
 * Preserve the cards, including healthy May non-predation deaths (90%) and July
 * predation 51%; the supplied teacher key contains inconsistent summaries.
 * The annual route is a schematic of Slide A, not GPS coordinates or a predictive
 * movement model. Rain/grass are illustrative ordinal seasonal states, not measured
 * rainfall, biomass, or causes inferred from the 18 cards. All learners see the
 * same published evidence; decorative animation uses a fixed visual seed.
 */
(function (root) {
  'use strict';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const GROUPS = ['Living','Killed by predators','Died from other causes'];
  const VALUES = [[95,75,90],[92,68,60],[89,51,31],[73,48,23],[76,46,31],[77,54,55]];
  const HEALTH = [['Healthy','Healthy','Healthy'],['Healthy','Nutritionally stressed','Nutritionally stressed'],['Healthy','Nutritionally stressed','Nutritionally starved'],['Healthy','Nutritionally stressed','Nutritionally starved'],['Healthy','Nutritionally stressed','Nutritionally starved'],['Healthy','Nutritionally stressed','Nutritionally stressed']];
  const CARDS = VALUES.flatMap((row,i) => row.map((fat,g) => Object.freeze({id:'m'+(i+5)+'g'+g, month:i+4, location:i+1, group:g, fat, anthrax:i===1||i===2?20:0, health:HEALTH[i][g]})));
  // Map coordinates are in a 1000 × 660 art space. Month locations follow Slide A;
  // the two northern months deliberately have different centers, as in the source.
  const POSITIONS = [[620,494],[601,523],[580,504],[513,493],[460,359],[335,309],[404,248],[460,209],[501,129],[554,137],[563,294],[622,434]];
  const RANGES = ['Southern plains','Southern plains','Southern plains','South and southwest Serengeti','Central / western Serengeti','Western Corridor','Northwestern corridor','Northern Serengeti','Northern Serengeti / Maasai Mara','Maasai Mara / northern range','Eastern return route','Eastern corridor toward the southern plains'];
  const SEASONS = ['Wet-season range','Wet-season range','Wet-season range','Wet-season range','Late wet season · moving west','Western range','Northwestern range · moving north','Northern range','Northern range','Northern dry-season range','Dry-season return south','Early wet season · returning south'];
  const NOTES = [
    'Look at where the herds gather. What might make this part of the ecosystem useful at this time?',
    'The herds remain in the southern part of the ecosystem. What evidence would explain this pattern?',
    'Nearby herds can occupy different patches. The map simplifies many animals into one broad range.',
    'The main range is still in the south and southwest, near Maswa. The route turns northwest afterward. Where might the herds be next?',
    'Location 1 on the data cards. Compare all three groups before deciding what their health suggests.',
    'Location 2 on the data cards. Check both bone-marrow fat and anthrax across the three groups.',
    'The broad range is in the northwest before shifting north. Location 3 on the cards: does the disease measure separate living and dead groups?',
    'Location 4 on the data cards. Compare this month with May. What changes, and what stays similar?',
    'Location 5 on the data cards. Use the same scale when comparing the three groups.',
    'Location 6 on the data cards. Compare the two dead groups with the living group.',
    'The route turns south. What additional evidence would connect this movement to food?',
    'The broad range stretches down the eastern Serengeti toward the southeastern plains. Timing varies between years.'
  ];
  function monthIndex(value) { return Number.isInteger(value)&&value>=0&&value<12?value:0; }
  // Lesson 4 class map convention: wet December–May, dry June–November.
  // These labels guide illustrative weather; they are not monthly precipitation readings.
  function isWetSeason(value) { const month=monthIndex(value); return month<=4||month===11; }
  function fieldRegion(value) {
    const month=monthIndex(value);
    // November depicts the northern end of the southbound corridor.
    return month<4||month===11?'south':month<7?'west':'north';
  }
  function habitatClue(value) {
    const m=monthIndex(value);
    if(m<4||m===11)return 'Wet-season rain supports new short grass. The southern plains offer nutritious blades, important for mothers feeding calves.';
    if(m<7)return 'As the south dries, food there becomes harder to find. Western grasses can have more nutrients in their blades in the dry season.';
    if(m<10)return 'The north offers water from the Mara River and local showers, even in the dry season. Its grass blades are less nutritious.';
    return 'As rains return farther south, new grass can provide food again. This source map shows the broad return, not the path of one herd.';
  }
  function forMonth(value) { return CARDS.filter(c=>c.month===monthIndex(value)); }
  function groups(by='month', cards=CARDS) {
    const result = new Map();
    cards.forEach(c=> {const label=by==='group'?GROUPS[c.group]:by==='health'?c.health:by==='anthrax'?c.anthrax+'% anthrax':MONTHS[c.month]+' · Location '+c.location;if(!result.has(label))result.set(label,[]);result.get(label).push(c);});
    return Array.from(result,([label,cards])=>({label,cards}));
  }
  // One notebook entry per month. Preserve distinct text from timestamped legacy copies.
  const noteMonth=n=>{
    const match=/^month-(\d{1,2})(?:-(?:map|\d+))?$/.exec(n?.id||'');
    if(match&&Number(match[1])<12)return Number(match[1]);
    return n?.type==='map-observation'&&Number.isInteger(n.month)&&n.month>=0&&n.month<12?n.month:null;
  };
  function noteObservation(n){
    if(typeof n?.observation==='string')return n.observation.trim();
    if(typeof n?.text!=='string')return '';
    return (n.text.match(/(?:^|\n)My observation: ([\s\S]*?)(?=\nSource cards available for Location \d+\.\s*$|$)/)||[])[1]?.trim()||'';
  }
  function normalizeNotebook(notes){
    const out=[],byId=new Map();
    for(const raw of Array.isArray(notes)?notes:[]){
      if(!raw||!['id','title','text'].every(key=>typeof raw[key]==='string'))continue;
      const month=noteMonth(raw);
      if(month===null){
        if(!byId.has(raw.id)){byId.set(raw.id,out.length);out.push(raw);}
        continue;
      }
      const id='month-'+month,index=byId.get(id),old=out[index],observation=noteObservation(raw);
      const next=old?.observation&&!observation?old:{...raw,id,month,observation,type:'map-observation'};
      const history=[...new Set([...(old?.earlierObservations||[]),...(Array.isArray(raw.earlierObservations)?raw.earlierObservations:[]),old?.observation,observation]
        .filter(t=>typeof t==='string'&&t.trim()&&t!==next.observation))];
      const merged={...next,earlierObservations:history};
      if(old)out[index]=merged;
      else{byId.set(id,out.length);out.push(merged);}
    }
    return out.slice(0,100);
  }
  function upsertMonthlyNote(notes,month,observation){
    const out=normalizeNotebook(notes);
    const text=typeof observation==='string'?observation.trim():'';
    if(!Number.isInteger(month)||month<0||month>11||!text)return {notes:out,status:'blank'};
    const id='month-'+month,index=out.findIndex(n=>n.id===id),previous=out[index];
    if(previous?.observation===text)return {notes:out,status:'unchanged'};
    if(index<0&&out.length>=100)return {notes:out,status:'full'};
    const entry={id,month,type:'map-observation',title:MONTHS[month]+' · '+RANGES[month],observation:text,
      text:'Map observation (illustrative broad range): '+RANGES[month]+'.\nMy observation: '+text+
        (forMonth(month).length?'\nSource cards available for Location '+(month-3)+'.':''),
      earlierObservations:(previous?.earlierObservations||[]).filter(t=>t!==text)};
    if(index<0)out.push(entry);else out[index]=entry;
    return {notes:out,status:index<0?'new':'updated'};
  }
  const monthsWithNotes=notes=>normalizeNotebook(notes).filter(n=>noteMonth(n)!==null&&n.observation).map(n=>n.month);
  const notebookText=n=>[n.text,...(Array.isArray(n.earlierObservations)&&n.earlierObservations.length
    ?['Earlier saved observations: ',...n.earlierObservations.map(t=>'• '+t)]:[])].join('\n');
  // Plot column geometry only, calibrated to the unchanged Slide T image.
  // The dots are deliberately not digitized as rainfall measurements.
  function rainColumn(month){return (4.76+7.95*monthIndex(month)).toFixed(2)+'%';}
  function weatherCues(value){
    const m=monthIndex(value);
    const north={x:542,y:91,size:.70};
    return {
      rain:m===4?[north,{x:325,y:256,size:.65}]:isWetSeason(m)?[north,{x:687,y:459,size:.72},{x:455,y:410,size:.62}]:[north],
      rainText:m===4?'Northern showers and late wet-season rain in the west':isWetSeason(m)?'Wet-season showers, including in the south':'Dry season, but showers still reach the north',
      grassText:isWetSeason(m)?'Wetter-season grass (upright tufts)':'Drier-season grass (sparse, bent tufts)'
    };
  }
  const API=Object.freeze({rainColumn,weatherCues,habitatClue,MONTHS,GROUPS,CARDS:Object.freeze(CARDS),POSITIONS,RANGES,SEASONS,NOTES,monthIndex,isWetSeason,fieldRegion,forMonth,groups,normalizeNotebook,upsertMonthlyNote,monthsWithNotes,notebookText});
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  else root.MigrationLogic=API;
})(typeof window!=='undefined'?window:globalThis);
