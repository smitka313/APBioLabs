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
      evidence:'The ecosystem includes grasslands, savanna, and woodland. The Mara and Grumeti rivers run through the region; Lake Victoria lies to the west. The Rift Valley and rocky outcrops help shape where herds can travel, but the herds cross rivers.',
      prompt:'Name one living and one nonliving part of a habitat you see.' },
    { id:'biodiversity', name:'Biodiversity', icon:'02', title:'Life in the same landscape', location:'Savanna and woodland', place:'woodland', view:'region',
      evidence:'Wildebeest, zebras, elephants, and ostriches share the Serengeti with less visible organisms, including acacia trees, ants, and butterflies. Acacia thorns shelter ants, which can help defend the trees.',
      prompt:'What would a map showing only the largest animals leave out?' },
    { id:'movement', name:'Movement of animals', icon:'03', title:'The herd crosses lines on a map', location:'Northern route and the Mara River', place:'mara', view:'route',
      evidence:'Wildebeest migrate each year. In 1956, researchers began gathering evidence about their movement. They found that the herds regularly traveled outside the park. The station’s map shows a route of about 650 km; an individual can walk farther over a year. The Mara crossing adds steep banks, fast water, and predators.',
      prompt:'If some animals use land outside the park, what would a park-only plan miss?' },
    { id:'conservation', name:'Conservation areas', icon:'04', title:'One park, several kinds of protection', location:'Serengeti National Park and neighboring areas', place:'park', view:'protection',
      evidence:'Serengeti National Park was established in 1951. Additional reserves and conservation areas helped protect parts of the wider ecosystem. They did not all have the same managers or rules. The lesson contrasts park rules with areas where some residence or grazing was allowed; rules vary by place and period.',
      prompt:'Why might identifying where animals travel matter when setting boundaries?' },
    { id:'people', name:'People of the Serengeti', icon:'05', title:'Who got to decide?', location:'Ngorongoro and the wider Serengeti', place:'ngorongoro', view:'protection',
      evidence:'Ikoma, Nata, and Maasai communities lived and worked in the region before the park. British colonial authorities held decision-making power when it was established. Maasai residents contested eviction and exclusion from decisions. In one account, a Nata elder recalled losing access to grazing land and having to travel farther for firewood.',
      prompt:'How did people’s relationships with the land shape what they wanted protected?' }
  ];
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
  function clean(raw) {
    if (raw != null && (raw?.v !== 1 || !raw.fields || typeof raw.fields !== 'object' || Array.isArray(raw.fields))) throw Error('Invalid notebook');
    const f = raw?.fields || {};
    return { v:1, fields:Object.fromEntries(Object.keys(fields).filter(k=>typeof f[k]==='string').map(k=>[k,f[k].slice(0,limit)])),
      pins:stations.map(x=>x.id).filter(id=>Array.isArray(raw?.pins)&&raw.pins.includes(id)),
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
  return { stations, fields, references, limit, clean, progress };
});
