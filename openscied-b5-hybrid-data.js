'use strict';
((root)=>{
 // Approximate values read from the Richard Toohey / Polar Bears International chart in
 // OpenSciEd B.5 Lesson 6 Future Predictions, rounded to 0.1 million km². Not raw CMIP data.
 // Observations are a sample of years, projections are separate. This is area, not extent.
 const graph=[
  {key:'obs',label:'Observations (selected years)',style:'solid',values:[[1980,4.9],[1990,4.7],[2000,4.3],[2010,3.4],[2020,2.8],[2022,3.5]]},
  {key:'low',label:'SSP1-2.6 · Lower emissions',style:'long',values:[[2022,2.7],[2030,2.5],[2040,2],[2050,1.9],[2060,1.9],[2070,1.7],[2080,1.6],[2090,1.7],[2100,1.7]]},
  {key:'mid',label:'SSP2-4.5',style:'short',values:[[2022,2.8],[2030,2.6],[2040,1.9],[2050,1.5],[2060,1.2],[2070,1.2],[2080,1.0],[2090,.9],[2100,.9]]},
  {key:'high',label:'SSP3-7.0',style:'dots',values:[[2022,2.9],[2030,2.6],[2040,2.0],[2050,1.5],[2060,1.1],[2070,.8],[2080,.6],[2090,.5],[2100,.3]]},
  {key:'highest',label:'SSP5-8.5 · Higher emissions',style:'dash-dot',values:[[2022,2.8],[2030,2.3],[2040,1.8],[2050,1.1],[2060,.9],[2070,.6],[2080,.4],[2090,.3],[2100,.2]]}
 ];
 // Counts in the Lesson 6 Making Sense of Matings table, based on Miller et al. (2015).
 const interactions=[
  ['Lone adult male',19,76,1,61],['Lone adult female',10,17,0,9],
  ['Female with cubs',41,19,4,15],['Subadult',6,26,0,8]
 ];
 // Family groups follow Pongracz et al. (2017). Display labels describe the classroom
 // reconstruction, not genetic sample IDs. A and B refer to the same males in both rows.
 const family=[
  {id:'p',label:'Polar bear mother',kind:'polar',group:0},{id:'a',label:'Brown bear A',kind:'brown',group:0},{id:'b',label:'Brown bear B',kind:'brown',group:0},
  {id:'f1',label:'First-generation hybrid 1',kind:'hybrid',group:1,parents:['p','a']},
  {id:'f2',label:'First-generation hybrid 2',kind:'hybrid',group:1,parents:['p','a']},
  {id:'f3',label:'First-generation hybrid 3',kind:'hybrid',group:1,parents:['p','b']},
  {id:'f4',label:'First-generation hybrid mother',kind:'hybrid',group:1,parents:['p','b']},
  {id:'c1',label:'Backcross offspring 1',kind:'back',group:2,parents:['f4','a']},
  {id:'c2',label:'Backcross offspring 2',kind:'back',group:2,parents:['f4','a']},
  {id:'c3',label:'Backcross offspring 3',kind:'back',group:2,parents:['f4','a']},
  {id:'c4',label:'Backcross offspring 4',kind:'back',group:2,parents:['f4','b']}
 ];
 const traits=[
  {key:'LYST',title:'Fur pigment',symbol:'◐',polar:'Lower pigment',brown:['Higher pigment','Lower pigment'],out:['Intermediate pigment','Lower pigment'],hint:'Lighter fur may help camouflage on snow; darker fur may be less conspicuous on exposed ground.'},
  {key:'APOB',title:'Fat transport',symbol:'◆',polar:'More fat transported out of blood',brown:['More fat transported out of blood','Less fat transported out of blood'],out:['More fat transported out of blood','Intermediate fat transport'],hint:'Handling fats can matter when eating a diet rich in seal fat. The model does not predict heart disease.'},
  {key:'ARID5B',title:'Fat-cell growth',symbol:'◉',polar:'Greater fat-cell growth',brown:['Typical fat-cell growth','Greater fat-cell growth'],out:['Intermediate fat-cell growth','Greater fat-cell growth'],hint:'Stored fat can insulate a bear in cold conditions. Insulation can also matter when shedding heat.'},
  {key:'NOS3',title:'Heat during activity',symbol:'✦',polar:'More heat in the model',brown:['More heat in the model','Less heat in the model'],out:['More heat in the model','Intermediate heat in the model'],hint:'Producing less heat during activity might matter on warmer land. This is a classroom simplification, not a diagnosis.'}
 ];
 const flip=(seed,n)=>{
  // Four independent model coin flips per mating, derived from a fixed seed + flip index.
  // Brown model parent contributes one of two equally likely variants. Polar contribution is fixed.
  let x=(Number.parseInt(seed,16)>>>0)^Math.imul(n+1,0x9e3779b9);
  x^=x>>>16;x=Math.imul(x,0x21f0aaad);x^=x>>>15;x=Math.imul(x,0x735a2d97);x^=x>>>15;
  return x&1;
 };
 const flips=(seed,count)=>Array.from({length:Math.min(40,Math.max(0,count|0))},(_,i)=>flip(seed,i));
 const phenotype=(trait,bit)=>traits[trait]?.out[bit];
 const cohort=(seed,count)=>{
  const results=flips(seed,count),rows=[];
  for(let i=0;i+3<results.length;i+=4)rows.push(results.slice(i,i+4));
  return rows;
 };
 const api={graph,interactions,family,traits,flip,flips,phenotype,cohort,generationYears:11.35};
 if(typeof module==='object')module.exports=api;else root.ArcticBearData=api;
})(typeof globalThis==='object'?globalThis:this);
