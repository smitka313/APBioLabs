/* A short, local Serengeti teaching model, not a migration forecast.
 * Each component begins at 100. Only the number of visiting migrants changes.
 * Signed links act one step later. Coefficients are illustrative, not fitted.
 * Local grazing and soil inputs act in opposite directions on grass. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RippleLogic=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const names=Object.freeze({herd:'Visiting wildebeest',dung:'Dung supply',beetles:'Dung beetle activity',soil:'Dung-derived soil inputs',grass:'Standing grass',predators:'Predator encounters'});
  const links=Object.freeze([
    ['herd','dung',1,.74,'More visiting animals leave more dung.'],
    ['dung','beetles',1,.77,'Dung is food and a breeding resource for many dung beetles.'],
    ['beetles','soil',1,.71,'Dung beetles move some dung into the soil.'],
    ['soil','grass',1,.58,'Nutrients returned to the soil can support grass growth.'],
    ['herd','grass',-1,.22,'More grazers can remove more standing grass.'],
    ['herd','predators',1,.56,'More visiting prey can mean more encounters with predators, not necessarily more predators.']
  ].map(([from,to,sign,weight,why])=>Object.freeze({from,to,sign,weight,why})));
  const keys=Object.freeze(Object.keys(names)),steps=7;
  function coefficient(seed,i){
    let n=Math.imul((seed+(i+1)*4639)>>>0,0x9e3779b1);n=Math.imul(n^(n>>>16),0x85ebca6b);
    return .9+.2*((n^(n>>>13))>>>0)/4294967296;
  }
  function run(seed,level=100){
    if(!Number.isInteger(seed)||seed<0||seed>4294967295||![100,50].includes(level))throw new RangeError('Invalid scenario');
    const start=Object.fromEntries(keys.map(k=>[k,100]));
    const rows=[start];
    for(let n=1;n<=steps;n++){
      const prev=rows.at(-1), next={...start,herd:level};
      for(const [i,{from,to,sign,weight}] of links.entries())next[to]+=(prev[from]-100)*sign*weight*coefficient(seed,i);
      for(const k of keys)next[k]=Math.max(0,Math.min(200,next[k]));
      rows.push(next);
    }
    return rows.map(r=>Object.fromEntries(keys.map(k=>[k,Math.round(r[k])])));
  }
  function correct(answers){return links.every((l,i)=>answers?.[i]===l.sign);}
  return Object.freeze({names,links,keys,steps,run,correct});
});
