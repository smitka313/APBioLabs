'use strict';
((root)=>{
  // Approximate OpenSciEd B.5 Lesson 4 slide J teaching intervals, not a modern ice-extent reconstruction.
  const periods=[
    {id:'G7',from:680,end:625,next:550},{id:'G6',from:550,end:535,next:470},
    {id:'G5',from:470,end:425,next:380},{id:'G4',from:380,end:335,next:285},
    {id:'G3',from:285,end:245,next:190},{id:'G2',from:190,end:135,next:75},
    {id:'G1',from:75,end:15,next:0}
  ];
  const fmt=n=>n.toLocaleString('en-US');
  const ranges=(a,b)=>a===b?fmt(a):fmt(Math.min(a,b))+'–'+fmt(Math.max(a,b));
  const years=(p,warm=false)=>(warm?p.end-p.next:p.from-p.end)*1000;
  const generations=(p,warm=false)=>Math.round(years(p,warm)/11.35);
  // Handout ages are estimates; site coordinates are schematic markers, not excavation coordinates.
  const fossils=[
    ['Alaska, USA','Polar',70000,110000,13,21,13,14],['Norway (Svalbard)','Polar',110000,130000,55.5,13,60,9],
    ['Ontario and Quebec, Canada','Brown',10000,12000,27,38,25,47],['Ireland','Brown',3900,37500,49,34,44,33],
    ['France','Brown',550000,550000,52,41,47,49],['Italy','Brown',480000,480000,54,43,56,58],
    ['Ukraine','Brown',11000,11000,58.5,38,65,37],['Japan','Brown',340000,340000,85.5,44,88,51]
  ].map(([name,bear,young,old,x,y,px,py])=>({name,bear,young,old,x,y,px,py,age:ranges(young,old)}));
  const genes=[
    {id:'LYST',trait:'Pigmentation',icon:'fur',common:'Darker pigment',variant:'Lighter pigment',clue:'Lighter fur may be harder to see against snow and ice. Darker fur may blend in better on exposed ground.'},
    {id:'APOB',trait:'Fat transport',icon:'food',common:'Typical fat transport',variant:'Different fat transport',clue:'Researchers think APOB variants may help polar bears handle a fat-rich diet of seals. The exact effect is not fully known.'},
    {id:'ARID5B',trait:'Fat storage',icon:'heat',common:'Typical fat-cell growth',variant:'Possible change in fat-cell growth',clue:'This gene helps regulate fat-cell development. Differences could affect fat storage; fat can insulate a bear. This is a clue, not a measured survival advantage.'}
  ];
  const habitats={north:{name:'Greenland / Arctic coast',short:'Arctic coast',x:54,y:32},south:{name:'Southern mainland',short:'Southern land',x:23,y:72},edge:{name:'Northern mainland',short:'Northern land',x:23,y:35}};
  function roster(seed,version=2){
    let n=Number.parseInt(seed,16)>>>0;
    const rand=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n;};
    // Three contrasts are guaranteed, along with three seeded mosaics. These are model chips,
    // not measured genotypes, allele frequencies, survival rates or biological fitness scores.
    const cards=[0,7,1];
    if(version===1){for(let j=0;j<3;j++)cards.push((rand()>>>23)&7);}
    else {
      const unused=[2,3,4,5,6];
      for(let j=0;j<3;j++)cards.push(unused.splice((rand()>>>10)%unused.length,1)[0]);
    }
    for(let j=cards.length-1;j>0;j--){let k=(rand()>>>10)%(j+1);[cards[j],cards[k]]=[cards[k],cards[j]];}
    return cards.map((n,i)=>({id:i,variants:genes.map((_,j)=>Boolean(n&(1<<j)))}));
  }
  const conclusion={question:'Which conclusion does the evidence support?',choices:{
    exact:'The fossils show the exact date and place of the split.',
    single:'One gene change explains the whole split.',
    possible:'Several kinds of evidence support a possible explanation, not an exact date or location.'
  },feedback:{
    exact:'Not yet. A fossil shows that bears of that type already existed. It does not locate or date the split.',
    single:'Not yet. A difference in one gene is one clue. It does not explain separation and change across populations by itself.',
    possible:'Correct. Climate, fossils and gene variants tell us different things. Together they support a possible explanation, not an exact history.'
  }};
  function suitability(habitat,bear){
    const [coat,diet,storage]=bear.variants;
    if(habitat==='north'){
      const clues=[coat&&'lighter fur may blend with snow',diet&&'the APOB variant may help with a fat-rich seal diet',storage&&'the ARID5B variant may affect insulating fat stores'].filter(Boolean);
      return clues.length?{supported:true,note:'Possible Arctic advantage: '+clues.join('; ')+'.'}:
        {supported:false,note:'Try another bear. This card has none of the three Arctic clues. Look for a variant that could help with snow camouflage, a seal diet, or heat loss.'};
    }
    return coat?{supported:false,note:'Try another bear for this model comparison. Lighter fur can help on snow, but darker fur may blend in better on exposed land.'}:
      {supported:true,note:'Possible land advantage: darker fur may blend into exposed ground. The other variants are not automatically harmful here.'};
  }
  const api={conclusion,suitability,periods,fmt,ranges,years,generations,fossils,genes,habitats,roster};
  if(typeof module==='object')module.exports=api;else root.IceAgeEvidence=api;
})(typeof globalThis==='object'?globalThis:this);
