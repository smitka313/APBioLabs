/* OpenSciEd B.2 L9, handout pp.1–4 and TE pp.188,194–196.
 * Official location cards (user-supplied PDF), pp.1–7, transcribed below.
 * The producer exit table applies to the roll AFTER a main-table 1 or 2.
 * Every roll counts once at its origin, including staying at that station. No elapsed-time claims.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CarbonJourney=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const stations=[['atmosphere','Atmosphere','Carbon dioxide in the air'],['ocean','Ocean','Hydrosphere'],['human','Human activity','Biosphere'],['producers','Producers','Biosphere'],['herbivores','Herbivores','Biosphere'],['omnivores','Omnivores','Biosphere'],['soil','Soil and rock','Geosphere']];
const matter=['Carbon dioxide','Food fuel','Biomass','Fossil fuel','Waste','Sediment','Material good'];
const energy=['Energy remains in the same arrangement of atoms.','Energy flows to another place/system in the same arrangement of atoms.','Energy changes result from the atoms rearranging.','Energy flows to another place/new system AND the atoms are rearranged.'];
const valid=id=>stations.some(s=>s[0]===id);
function die(seed,index){let a=((seed>>>0)+Math.imul(index+1,0x6D2B79F5))>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return 1+Math.floor((((t^(t>>>14))>>>0)/4294967296)*6);}
// Cards transcribed from the user-supplied OpenSciEd B.2 L9 Location Cards PDF,
// pp.1–7 (CC BY-NC 4.0). Text retains source wording; categories normalize
// “another/new system” to the handout's four energy bins, without changing text.
const card = (id, to, m, e, text, exit = false) => ({id,to,matter:matter[m],energy:energy[e],text,exit});
const cards = {
 aStay:card('aStay','atmosphere',0,0,'You remain in the atmosphere as a molecule of carbon dioxide, CO2 (matter). Energy remains in the same arrangement of atoms. Record this action and roll again.'),
 aOcean:card('aOcean','ocean',0,1,'You enter the ocean as carbon dioxide, CO2, and are dissolved in the water (matter). Energy flows to a new system in the same arrangement of atoms.'),
 aPlant:card('aPlant','producers',2,3,'You are taken in by a producer as carbon dioxide, CO2. The producer uses energy from sunlight and water to rearrange you into molecules used to build biomass (matter) of the producer. Energy flows to a new system AND the atoms are rearranged.'),
 oStay:card('oStay','ocean',0,0,'You remain dissolved as carbon dioxide, CO2, in the ocean (matter). Energy remains in the same arrangement of atoms. Record this action and roll again.'),
 oAir:card('oAir','atmosphere',0,1,'You flow back into the atmosphere as carbon dioxide, CO2 (matter). Energy flows to a new system in the same arrangement of atoms.'),
 oPlant:card('oPlant','producers',2,3,'You are taken in by a producer as carbon dioxide, CO2, and become part of the producer’s biomass (matter) through photosynthesis. Energy flows to a new system AND the atoms are rearranged.'),
 oSoil:card('oSoil','soil',5,1,'You become part of ocean sediments and fall to the bottom of the ocean (matter). Energy flows to another new system.'),
 hHome:card('hHome','human',6,0,'You are used to make a material good (matter) that becomes part of a human’s home (e.g., wood, rock). Energy remains in the same arrangement of atoms. Record this action and roll again.'),
 hWaste:card('hWaste','soil',6,1,'You are used to make a disposable material good (matter) that the human uses once and then throws away into the landfill. Energy flows to another place in the same arrangement of atoms.'),
 hMine:card('hMine','atmosphere',0,3,'You are mined and burned for energy for heating human buildings and electricity. You move into the atmosphere as carbon dioxide, CO2 (matter). Energy flows to a new system AND the atoms are rearranged.'),
 hWell:card('hWell','atmosphere',0,3,'You are brought up from an underground well and burned to for energy for human transportation. You move to the atmosphere as carbon dioxide, CO2 (matter). Energy flows to a new system AND the atoms are rearranged.'),
 pGrow:card('pGrow','producers',2,0,'You become part of the producer’s biomass (matter) as the organism grows larger. Energy remains in the same arrangement of atoms. Record this action and roll again.',true),
 pRespire:card('pRespire','atmosphere',0,3,'Your carbon-based molecules are used to generate energy during cellular respiration. You move into the atmosphere as carbon dioxide, CO2 (matter). Energy flows to a new system AND the atoms are rearranged.'),
 pHerb:card('pHerb','herbivores',1,3,'You are eaten by an herbivore as food fuel (matter). The energy flows to another place AND the atoms are rearranged.'),
 pOmni:card('pOmni','omnivores',1,1,'You are eaten by an omnivore as food fuel (matter). The energy flows to another place/new system.'),
 pHuman:card('pHuman','human',6,1,'You are harvested by humans who use your matter to make different material goods. The energy flows to a new system in the same arrangement of atoms.'),
 pDie:card('pDie','soil',2,1,'The producer you are part of dies. The matter (biomass) and energy flows to a new system in the same arrangement of atoms.'),
 bRespire:card('bRespire','atmosphere',0,3,'Your carbon-based molecules are used during cellular respiration to generate energy to move and stay warm. You move into the atmosphere as carbon dioxide, CO2 (matter). Energy flows to another place/new system AND the atoms are rearranged.'),
 bEaten:card('bEaten','omnivores',2,3,'You are eaten by an omnivore. Your biomass flows to the omnivore. You are digested and used to grow and repair parts of the omnivore. Energy flows to another place/new system AND the atoms are rearranged.'),
 bStay:card('bStay','herbivores',2,3,'You are eaten by the herbivore. You are digested and used to grow and repair parts of the herbivore’s biomass (matter). Energy flows to another place/new system AND the atoms are rearranged. Record this action and roll again.'),
 bWaste:card('bWaste','soil',4,1,'You were part of a carbon-based molecule that was not digested. You leave the herbivore’s body as waste (matter). Energy flows to a new system in the same arrangement of atoms.'),
 bDie:card('bDie','soil',2,3,'You are part of the herbivore’s biomass, and the herbivore dies. You decompose and become part of the soil (matter). Energy flows to a new system AND the atoms are rearranged.'),
 cRespire:card('cRespire','atmosphere',0,3,'Your carbon-based molecules are used during cellular respiration to generate energy to move and stay warm. You move into the atmosphere as carbon dioxide, CO2 (matter). Energy flows to a new system AND the atoms are rearranged.'),
 cStay:card('cStay','omnivores',2,2,'You are digested and used to grow and repair parts of the omnivore’s biomass (matter). Energy changes result from the atoms rearranging. Record this action and roll again.'),
 cDie:card('cDie','soil',2,3,'You are part of the omnivore’s biomass, and the omnivore dies. You decompose and become part of the soil (matter). Energy flows to a new system AND the atoms are rearranged.'),
 cWaste:card('cWaste','soil',4,1,'You were part of a carbon-based molecule that was not digested. You leave the herbivore’s body as waste (matter). Energy flows to a new system in the same arrangement of atoms.'),
 sRespire:card('sRespire','atmosphere',0,3,'You are eaten by a decomposer and are digested used for energy through cellular respiration. You move to the atmosphere as carbon dioxide, CO2 (matter). Energy flows to a new system AND the atoms are rearranged.'),
 sGrow:card('sGrow','soil',2,2,'You are digested and used to grow and repair parts of a decomposer’s biomass (matter). Energy changes result from the atoms rearranging. Record this action and roll again.'),
 sStay:card('sStay','soil',2,0,'You are in a carbon-based molecule that is hard to decompose. Your biomass (matter) remains part of the soil. Energy remains in the same arrangement of atoms. Record this action and roll again.'),
 sFossil:card('sFossil','soil',3,0,'You become buried and form a fossil fuel like coal (matter). Lots of energy remains in the same arrangement of atoms that could be burned for later use. You remain buried. Record this action and roll again.'),
 sMine:card('sMine','human',3,1,'You are mined by humans as a fossil fuel. The energy flows to another system in the same arrangement of atoms and will be used to power human-made activities.')
};
const table={atmosphere:['aStay','aStay','aStay','aOcean','aPlant','aPlant'],ocean:['oStay','oStay','oAir','oAir','oPlant','oSoil'],human:['hHome','hWaste','hMine','hMine','hWell','hWell'],producers:['pGrow','pGrow','pRespire','pRespire','pRespire','pRespire'],producerExit:['pHerb','pOmni','pHuman','pHuman','pDie','pDie'],herbivores:['bRespire','bRespire','bEaten','bStay','bWaste','bDie'],omnivores:['cRespire','cRespire','cStay','cStay','cDie','cWaste'],soil:['sRespire','sGrow','sStay','sFossil','sMine','sMine']};
// A card sampler, not more rolls. These examples do not change the route,
// the seed, the die table, the totals, or the original station-card wording.
const tourExamples=[
 ['atmosphere','aPlant','Photosynthesis'],
 ['ocean','oSoil','Sediment settling'],
 ['human','hMine','Burning fossil fuel'],
 ['producers','pGrow','Growth'],
 ['herbivores','bEaten','Feeding'],
 ['omnivores','cDie','Decomposition after an animal dies'],
 ['soil','sRespire','Cellular respiration in a decomposer']
];
function initial(seed){return {version:3,seed:seed>>>0,rows:[],pending:null,answers:{},done:false,producerExit:false,legacyRows:0,coverageReviewed:[],coverageCheckpoint:null};}
function current(s){return s.rows.length?s.rows[s.rows.length-1].to:'atmosphere';}
function outcome(s,roll=s.pending){if(!Number.isInteger(roll)||roll<1||roll>6||!valid(current(s)))throw Error('Roll a six-sided die first.');return cards[table[current(s)==='producers'&&s.producerExit?'producerExit':current(s)][roll-1]];}
function record(s,input={}){
 if(s.done)throw Error('This journey is complete.');
 const c=outcome(s), prediction=input.prediction;
 const row={turn:s.rows.length+1,from:current(s),die:s.pending,to:c.to,matter:c.matter,energy:c.energy,card:c.id,text:c.text,stage:s.producerExit?'producerExit':'main',note:String(input.note||'').slice(0,1000)};
 // Omitted means an earlier version did not save predictions. Null means the
 // student used "Reveal card without predicting" in a version that saves them.
 if(prediction===null||valid(prediction))row.prediction=prediction;
 return {...s,pending:null,producerExit:c.exit,rows:s.rows.concat(row)};
}
function totals(s,key,keys){return keys.map(k=>({label:k,count:s.rows.filter(r=>r[key]===k).length}));}
function tour(s) {
 const visited=new Set(['atmosphere',...s.rows.flatMap(r=>[r.from,r.to])]);
 const drawn=new Set(s.rows.map(r=>r.card));
 return tourExamples.map(([from,id,process])=>({from,process,...cards[id],visited:visited.has(from),drawn:drawn.has(id)}));
}
// Do not count reading a reference card as a roll. A station reached on the
// last move may lack evidence, since its card was never actually drawn.
function missingCoverage(s) {
 const origins=new Set(s.rows.map(row=>row.from));
 const sawDecomposer=s.rows.some(row=>['sRespire','sGrow'].includes(row.card));
 return tour(s).filter(sample=>!s.coverageReviewed.includes(sample.from) &&
   (!origins.has(sample.from) || (sample.from==='soil'&&!sawDecomposer)));
}
function routeRepeating(s) {
 const tail=s.rows.slice(-3);
 // Three consecutive stays count even when the official events differ.
 // Trigger once in a single stay streak; a new streak can trigger again.
 if(tail.length===3&&tail.every(row=>row.from===tail[0].from&&row.to===tail[0].from)){
  const before=s.rows.at(-4);
  return !before||before.from!==tail[0].from||before.to!==tail[0].from;
 }
 if(s.rows.length<4)return false;
 const heard=new Set(s.rows.slice(0,-3).map(row=>row.card));
 return s.rows.slice(-3).every(row=>!!row.card&&heard.has(row.card));
}
// A Soil loop should surface a missing consumer example early. This is a
// separate evidence queue; no reference card can move an atom or add a roll.
function coverageQueue(s) {
 const missing=missingCoverage(s);
 const tail=s.rows.slice(-3);
 if(s.coverageCheckpoint!=='repeat'||tail.length!==3||!tail.every(row=>row.from==='soil'&&row.to==='soil'))return missing;
 const consumer=missing.find(card=>card.from==='herbivores'||card.from==='omnivores');
 return consumer?[consumer,...missing.filter(card=>card!==consumer)]:missing;
}
// Keep the four saved/official buckets. Display labels describe the model
// without teaching that energy is matter or that the tracked atom is fuel.
const energyLabels=[
 'No energy transfer tracked',
 'Energy transfer with matter',
 'Energy changes as atoms rearrange',
 'Energy transfer and atom rearrangement'
];
function energyLabel(category){return energyLabels[energy.indexOf(category)] || category;}
function energyCategory(label){
 const i=energyLabels.indexOf(label);
 return i<0?label:energy[i];
}
function energyMeaning(category) {
 return [
  'This event does not track an energy transfer.',
  'Matter moves between places. Energy can be transferred with moving matter; it is not an atom.',
  'The atoms are rearranged. Energy can change form as molecules are rearranged.',
  'Matter moves and atoms are rearranged. Energy is transferred or changes form; it does not cycle with this carbon atom.'
 ][energy.indexOf(category)] || '';
}
function cardText(value) {
 // Display and report language only. The original transcription and saved
 // category above stay intact for reproducible outcomes and older journals.
 if(typeof value!=='string')return '';
 return value
  .replace('burned to for energy','burned for energy')
  .replace('You are eaten by a decomposer and are digested used for energy through cellular respiration.','A decomposer digests the molecule that contains you. Cellular respiration transfers stored chemical energy.')
  .replace('used to generate energy during cellular respiration','broken down during cellular respiration, transferring stored energy')
  .replace('to generate energy to move and stay warm','to transfer stored energy for movement and warmth')
  .replace('The matter (biomass) and energy flows to a new system in the same arrangement of atoms.','Its biomass moves into the soil.')
  .replace('Lots of energy remains in the same arrangement of atoms that could be burned for later use.','The fossil fuel stores chemical energy that can be transferred later by burning.')
  .replace('The energy flows to another system in the same arrangement of atoms and will be used to power human-made activities.','The fuel still stores chemical energy until people use it.')
  .replace(/(?:The )?Energy (?:remains in the same arrangement of atoms|flows to [^.]+|changes result from the atoms rearranging)\./gi,'')
  .replace(/ {2,}/g,' ').trim();
}
function readSaved(raw){
 try {
  const v=JSON.parse(raw);
  if(![1,2,3].includes(v.version)||!Number.isInteger(v.seed)||!Array.isArray(v.rows))return null;
  let s=initial(v.seed);
  const legacy=v.version===1?v.rows.length:Math.max(0,Math.min(v.rows.length,Number.isInteger(v.legacyRows)?v.legacyRows:0));
  for(let i=0;i<v.rows.length;i++){
   const r={...v.rows[i],energy:energyCategory(v.rows[i]?.energy)};
   if(r.from!==current(s)||r.turn!==s.rows.length+1||!Number.isInteger(r.die)||r.die<1||r.die>6||!valid(r.to)||!matter.includes(r.matter)||!energy.includes(r.energy))throw Error();
   if(i<legacy){s.rows.push({...r,note:String(r.note||'').slice(0,1000),legacy:true});s.legacyRows++;}
   else {
    s.pending=r.die;
    const next=record(s,r),expected=next.rows.at(-1);
    for(const k of ['to','matter','energy','card','stage'])if(r[k]!==expected[k])throw Error();
    s=next;
   }
  }
  s.pending=Number.isInteger(v.pending)&&v.pending>=1&&v.pending<=6?v.pending:null;
  for(const [key,value] of Object.entries(v.answers||{})){
   if(typeof value!=='string')continue;
   if(v.version===3&&/^q[1-5]$/.test(key))s.answers[key]=value.slice(0,20000);
   else if(v.version<3&&/^q[2-6]$/.test(key))s.answers['q'+(Number(key[1])-1)]=value.slice(0,20000);
  }
  s.done=v.done===true&&s.rows.length>=10;
  s.coverageReviewed=Array.isArray(v.coverageReviewed)?[...new Set(v.coverageReviewed.filter(valid))]:[];
  if(!s.done&&s.pending===null&&missingCoverage(s).length){
   if(v.coverageCheckpoint==='finish'&&s.rows.length>=10)s.coverageCheckpoint='finish';
   else if(v.coverageCheckpoint==='repeat'&&routeRepeating(s))s.coverageCheckpoint='repeat';
  }
  return s;
 } catch {return null;}
}
function restore(raw,seed){return readSaved(raw) ?? initial(seed);}
return {stations,matter,energy,die,initial,current,outcome,record,totals,tour,missingCoverage,coverageQueue,routeRepeating,energyLabel,energyMeaning,cardText,readSaved,restore};});
