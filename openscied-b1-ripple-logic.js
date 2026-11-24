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
    ['herd','dung',1,.74,'As wildebeest eat and digest grass, they leave dung behind. More visitors supply more dung to this patch.'],
    ['dung','beetles',1,.77,'Many dung beetles feed on dung and lay eggs in it. More dung gives them more places to feed and breed, which can increase beetle activity here.'],
    ['beetles','soil',1,.71,'Some dung beetles roll or carry dung into tunnels and bury it. More beetle activity moves more dung underground.'],
    ['soil','grass',1,.58,'As buried dung breaks down, it releases nutrients that roots can take up. Those nutrients can help grass grow if it also has enough water and light.'],
    ['herd','grass',-1,.22,'Wildebeest eat grass. More mouths grazing can leave less standing grass: the grass still growing above ground.'],
    ['herd','predators',1,.56,'Wildebeest are prey. When more are in the same patch, a predator has more chances to come across one. This link does not count births, deaths, or new predators.']
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
