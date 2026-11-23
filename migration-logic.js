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
  const POSITIONS = [[620,494],[601,523],[580,504],[520,440],[460,359],[335,309],[365,267],[460,209],[501,129],[554,137],[563,294],[601,413]];
  const RANGES = ['Southern plains','Southern plains','Southern plains','Central Serengeti','Central / western Serengeti','Western Corridor','Western / northern corridor','Northern Serengeti','Northern Serengeti / Maasai Mara','Maasai Mara / northern range','Eastern return route','Southern return route'];
  const SEASONS = ['Wet-season range','Wet-season range','Wet-season range','Wet-season transition','Moving west','Western range','Moving north','Northern range','Northern range','Return south begins','Return south','Southern return'];
  const NOTES = [
    'Look at where the herds gather. What might make this part of the ecosystem useful at this time?',
    'The herds remain in the southern part of the ecosystem. What evidence would explain this pattern?',
    'Nearby herds can occupy different patches. The map simplifies many animals into one broad range.',
    'The broad range shifts northwest. Predict what the next month’s map will show.',
    'Location 1 on the data cards. Compare all three groups before deciding what their health suggests.',
    'Location 2 on the data cards. Check both bone-marrow fat and anthrax across the three groups.',
    'Location 3 on the data cards. Does the disease measure separate living and dead groups?',
    'Location 4 on the data cards. Compare this month with May. What changes, and what stays similar?',
    'Location 5 on the data cards. Use the same scale when comparing the three groups.',
    'Location 6 on the data cards. Compare the two dead groups with the living group.',
    'The route turns south. What additional evidence would connect this movement to food?',
    'The route returns toward the southern plains. The real timing varies between years.'
  ];
  function monthIndex(value) { return Number.isInteger(value)&&value>=0&&value<12?value:0; }
  function forMonth(value) { return CARDS.filter(c=>c.month===monthIndex(value)); }
  function groups(by='month', cards=CARDS) {
    const result = new Map();
    cards.forEach(c=> {const label=by==='group'?GROUPS[c.group]:by==='health'?c.health:by==='anthrax'?c.anthrax+'% anthrax':MONTHS[c.month]+' · Location '+c.location;if(!result.has(label))result.set(label,[]);result.get(label).push(c);});
    return Array.from(result,([label,cards])=>({label,cards}));
  }
  const API=Object.freeze({MONTHS,GROUPS,CARDS:Object.freeze(CARDS),POSITIONS,RANGES,SEASONS,NOTES,monthIndex,forMonth,groups});
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  else root.MigrationLogic=API;
})(typeof window!=='undefined'?window:globalThis);
