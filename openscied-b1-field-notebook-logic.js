(function (root, factory) {
  'use strict';
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.SerengetiFieldNotebook = model;
})(globalThis, function () {
  'use strict';
  // Evidence adapted from the OpenSciEd Lesson 2 history, map slides and station guide.
  // The schematic is not a reconstruction of surveyed borders or tracked animal positions.
  const stations = [
    { id:'habitats', name:'Habitats', icon:'01', title:'More than open grass', location:'Southern plains and river country', place:'plains', view:'region',
      artCaption:'From left to right: open grassland, savanna with scattered acacias, and woodland by a river.',
      evidence:'The ecosystem includes grasslands, savanna, and woodland. The Mara and Grumeti rivers run through the region; Lake Victoria lies to the west. The Rift Valley and rocky outcrops help shape where herds can travel, but the herds cross rivers.',
      prompt:'Name one living and one nonliving part of a habitat you see.' },
    { id:'biodiversity', name:'Biodiversity', icon:'02', title:'Life in the same landscape', location:'Savanna and woodland', place:'woodland', view:'region',
      artCaption:'From left to right: a giraffe, a lion, and a close-up of ants on an acacia branch. Not to scale.',
      evidence:'Wildebeest, zebras, elephants, and ostriches share the Serengeti with less visible organisms, including acacia trees, ants, and butterflies. Acacia thorns shelter ants, which can help defend the trees.',
      prompt:'What would a map showing only the largest animals leave out?' },
    { id:'movement', name:'Movement of animals', icon:'03', title:'The herd crosses lines on a map', location:'Northern route and the Mara River', place:'mara', view:'route',
      artCaption:'Wildebeest wade through the Mara River and climb the far bank. A crocodile waits in the current.',
      evidence:'Wildebeest migrate each year. In 1956, researchers began gathering evidence about their movement. They found that the herds regularly traveled outside the park. The station’s map shows a route of about 650 km; an individual can walk farther over a year. The Mara crossing adds steep banks, fast water, and predators.',
      prompt:'If some animals use land outside the park, what would a park-only plan miss?' },
    { id:'conservation', name:'Conservation areas', icon:'04', title:'One park, several kinds of protection', location:'Serengeti National Park and neighboring areas', place:'park', view:'protection',
      artCaption:'Two park outlines on a field map: the original is hatched and dashed; the later outline is solid. Use the interactive map to compare them.',
      evidence:'Serengeti National Park was established in 1951. Additional reserves and conservation areas helped protect parts of the wider ecosystem. They did not all have the same managers or rules. The lesson contrasts park rules with areas where some residence or grazing was allowed; rules vary by place and period.',
      prompt:'Why might identifying where animals travel matter when setting boundaries?' },
    { id:'people', name:'People of the Serengeti', icon:'05', title:'Who got to decide?', location:'Ngorongoro and the wider Serengeti', place:'ngorongoro', view:'protection',
      artCaption:'A cattle herder and a field researcher share the landscape. This scene is illustrative, not a portrait of people quoted in the exhibits.',
      evidence:'Ikoma, Nata, and Maasai communities lived and worked in the region before the park. British colonial authorities held decision-making power when it was established. Maasai residents contested eviction and exclusion from decisions. In one account, a Nata elder recalled losing access to grazing land and having to travel farther for firewood.',
      prompt:'How did people’s relationships with the land shape what they wanted protected?' }
  ];
  // Each exhibit is a paraphrase, not a quotation or new field measurement.
  const exhibits={
    habitats:[
      ['Three habitats','Compare an open grassland, a savanna with scattered trees, and woodland. Grass, scattered trees, and tree cover are different features, even in the same ecosystem.','Station deck, p. 1'],
      ['Three edges of the range','In the lesson map, Lake Victoria is to the west, the Great Rift Valley is to the east, and rocky outcrops are to the south. The herds do cross rivers, so not all natural boundaries stop travel in the same way.','Station deck, p. 2'],
      ['A landscape with a volcanic past','Ngorongoro Crater is the remains of a volcano. The station notes that past volcanic activity influenced soils in the wider region. A habitat map shows the setting; it doesn’t by itself show why the herd chooses one place at one time.','Station deck, p. 2']
    ],
    biodiversity:[
      ['Who lives here?','The deck shows elephants, buffalo, giraffes, ostriches, a tern, and a dung beetle. These aren’t a complete species list. Notice that protecting only the migrating animals would miss many organisms that live in the same system.','Station deck, p. 3'],
      ['Who eats whom?','Lions, spotted hyenas, and crocodiles are examples of predators in the Serengeti. A crossing can bring grazing animals close to a river predator; not every predator depends on the same part of the landscape.','Station deck, pp. 4, 8'],
      ['Acacias and their smaller neighbors','Acacias provide shade, food, and shelter. Some ants live in acacia thorns and defend the tree. Compare this interaction with herbivores feeding on grasses: both connect species, but in different ways.','Station deck, p. 5']
    ],
    movement:[
      ['What did the movement records change?','In 1956 researchers began gathering evidence about herd movements. They found that the herd regularly left the park. Use the monthly map to identify where the route goes beyond the later national park line.','History reading, p. 2; station deck, p. 7'],
      ['Route length or distance walked?','The lesson map shows an approximate 650 km route. The deck estimates that an individual wildebeest may walk about 800–1,000 km in a year. Those are different measurements: the mapped route is not a step-by-step record of a single animal.','Station deck, p. 7'],
      ['What makes the Mara crossing risky?','The photo and clips show steep riverbanks, fast currents, and crocodiles. One event can show a kind of risk, but it cannot tell you how often crossings are fatal across the herd.','Station deck, p. 8'],
      ['Is every animal following the same route?','The deck compares wildebeest with zebras and Thomson’s gazelles. The latter two use parts of the route but do not travel as far in this comparison. Avoid treating the sample wildebeest route as a map for all three species.','Station deck, p. 9']
    ],
    conservation:[
      ['Compare two park outlines','The original outline extends farther southeast; the later park extends north toward Kenya. Use both outlines to find an area that was in one version but not the other. The shapes are traced approximately from the lesson maps.','Lesson slides, slide G'],
      ['Reserves are not the same as the park','The later map shows reserves beside the park, including Grumeti, Ikorongo, Maswa, and Maasai Mara across the border. The park and these adjoining areas can protect different pieces of an animal’s route.','Station deck, p. 10; Lesson 2 Serengeti Map'],
      ['Compare rules, not just shapes','The lesson contrasts the national park, where residence and hunting were restricted, with some other protected lands where certain human uses were allowed. Those are course examples, not a statement of current permits or land rights.','Station deck, pp. 11–12']
    ],
    people:[
      ['A Nata elder remembers losing access','In the station account, a Nata elder described losing access to grazing land and having to travel farther to gather firewood after removal from the park. What costs does this perspective highlight that a wildlife map cannot show?','Station deck, p. 13; Shetler (2007), p. 192'],
      ['A colonial officer argues for exclusion','A British officer argued that protecting the animals meant removing most people from the park. Compare that reasoning with the elder’s account of people and wildlife sharing the land. This is one official’s stated viewpoint, not evidence that coexistence was impossible.','Station deck, p. 13; Shetler (2007), p. 196'],
      ['Who participates in conservation?','The deck shows researchers studying wildlife and rangers protecting wildlife and educating visitors. It also describes pastoral livelihoods, including Maasai cattle herding in the Ngorongoro area. Compare these roles without treating any one person as speaking for an entire community.','Station deck, pp. 14–15; history reading, pp. 1–2']
    ]
  };
  const checks={
    habitats:['The Mara River is a risky crossing. What does the deck support?',['Rivers and the Rift Valley block the herd in exactly the same way.','The herd can cross rivers even when the crossing is risky.','A habitat map tells us why each animal moves.'],1,'The evidence shows that herds cross rivers. A risky crossing is not the same as an impassable barrier.'],
    biodiversity:['Which pair shows an interaction that isn’t simply one animal eating another?',['Crocodile and wildebeest','Lion and wildebeest','Ant and acacia'],2,'The acacia shelters ants, and the ants can defend it.'],
    movement:['Which comparison helps explain why a park-only boundary might miss part of the herd’s range?',['Compare a southern month with a month when the herd is in the Maasai Mara.','Compare two clips of the same crossing.','Compare the size of two individual wildebeest.'],0,'The monthly map lets you compare different parts of the route with the same park outline.'],
    conservation:['The hatch pattern extends into land outside the solid line. What can you conclude?',['The two park outlines cover some different areas.','All of the protected land disappeared.','The map tells us why each decision-maker supported the change.'],0,'The map compares where the lines fell. It doesn’t establish why each person wanted a change.'],
    people:['These two accounts disagree. What can the pair help you explain?',['Everyone who lived nearby agreed with the officer.','People valued the same land differently and did not have equal power to decide.','The elder’s account measures how many wildebeest were protected.'],1,'The officer describes a justification for exclusion. The elder describes consequences for a person who lost access.']
  };
  // Coarse locations redrawn from the monthly station thumbnails, not precise GPS points.
  const months=[
    ['Jan',385,590,'Southern plains and Ngorongoro side'],
    ['Feb',377,624,'Southern short-grass plains'],
    ['Mar',382,599,'Southern plains'],
    ['Apr',363,556,'Southern and central Serengeti'],
    ['May',292,474,'Moving toward the western corridor'],
    ['Jun',230,391,'Western corridor near the Grumeti'],
    ['Jul',317,371,'Western corridor and northward movement'],
    ['Aug',368,279,'Northern Serengeti'],
    ['Sep',411,219,'Mara River and Maasai Mara area'],
    ['Oct',441,212,'Maasai Mara in Kenya'],
    ['Nov',467,310,'Southward movement along the eastern side'],
    ['Dec',447,492,'Return toward the southern plains']
  ];
  const boundaryPlaces={
    north:{x:392,y:299,label:'North, near the Kenya border',feedback:'The later park reaches farther north here; the original hatch does not cover this stretch.',changed:true},
    southeast:{x:540,y:563,label:'Southeast, near Ngorongoro',feedback:'The original park outline covers more land here than the later national park line. That does not mean this land lost all protection.',changed:true},
    west:{x:154,y:370,label:'West, near Grumeti',feedback:'The outlines overlap here. Try the north or southeast and look for one outline without the other.',changed:false}
  };
  const fields = {
    question1:'First investigation question', question2:'Second investigation question',
    habitats:'Habitats notes', biodiversity:'Biodiversity notes', movement:'Animal movement notes',
    conservation:'Conservation areas notes', people:'People of the Serengeti notes',
    system:'System: what did you notice or wonder about what’s inside or outside the park?',
    components:'Components: what did you notice or wonder about living and nonliving parts?',
    interactions:'Interactions: what did you notice or wonder about how people and wildlife use this land?',
    decisions:'Decision-making: what did you notice or wonder about who made decisions and why?',
    claim:'Why did people protect the Serengeti, and what helps explain why the boundaries changed?',
    wonder:'What is one question you still have about the Serengeti?'
  };
  const references={ habitats:'Station deck, pp. 1–2', biodiversity:'Station deck, pp. 3–5',
    movement:'Station deck, pp. 6–9; A Brief History of the Serengeti', conservation:'Station deck, pp. 10–12',
    people:'Station deck, pp. 13–15; Shetler (2007), pp. 192, 196' };
  const limit = 1800;
  const writeable = (fields, id) => typeof fields?.[id] === 'string' && fields[id].trim().length > 0;
  function pinList(s, id) {
    return s.pinnedCards && Object.hasOwn(s.pinnedCards,id) ? s.pinnedCards[id] : s.pins.includes(id) ? [0] : [];
  }
  function togglePin(s, id, index) {
    if(!exhibits[id]?.[index]) return false;
    const before=pinList(s,id), pinned=!before.includes(index);
    const next=pinned?[...before,index].sort((a,b)=>a-b):before.filter(i=>i!==index);
    s.pinnedCards[id]=next;
    s.pins=s.pins.filter(k=>k!==id);
    if(next.length)s.pins.push(id);
    return pinned;
  }
  function clean(raw) {
    if (raw != null && (raw?.v !== 1 || !raw.fields || typeof raw.fields !== 'object' || Array.isArray(raw.fields))) throw Error('Invalid notebook');
    const f = raw?.fields || {};
    const pinnedCards=Object.fromEntries(stations.filter(st=>Array.isArray(raw?.pinnedCards?.[st.id])).map(st=>[
      st.id,[...new Set(raw.pinnedCards[st.id].filter(i=>Number.isInteger(i)&&i>=0&&i<exhibits[st.id].length))].sort((a,b)=>a-b)
    ]));
    const pins=stations.map(x=>x.id).filter(id=>Object.hasOwn(pinnedCards,id)?pinnedCards[id].length:
      Array.isArray(raw?.pins)&&raw.pins.includes(id));
    return { v:1, pinnedCards, boundaryPick:Object.hasOwn(boundaryPlaces,raw?.boundaryPick)?raw.boundaryPick:'', fields:Object.fromEntries(Object.keys(fields).filter(k=>typeof f[k]==='string').map(k=>[k,f[k].slice(0,limit)])),
      pins,
      finished:raw?.finished===true, step:['orient','explore','explain'].includes(raw?.step)?raw.step:'orient',
      station:stations.some(x=>x.id===raw?.station)?raw.station:'habitats',
      lastVisitedAt:Number.isFinite(raw?.lastVisitedAt)?raw.lastVisitedAt:0 };
  }
  function progress(s) {
    const f=s.fields;
    const questions = writeable(f,'question1') && writeable(f,'question2') && f.question1.trim().toLowerCase()!==f.question2.trim().toLowerCase();
    const used = stations.filter(st=>s.pins.includes(st.id) || writeable(f,st.id)).length;
    const evidence = questions && used >= 2;
    const ready = evidence && writeable(f,'claim') && writeable(f,'wonder');
    const complete = ready && s.finished;
    return { questions, used, evidence, ready, complete,
      started: s.pins.length>0 || Object.keys(fields).some(k=>writeable(f,k)),
      done: Number(questions)+Number(evidence)+Number(complete) };
  }
  return { stations, fields, references, exhibits, checks, months, boundaryPlaces, pinList, togglePin, limit, clean, progress };
});
