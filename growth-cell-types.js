/* Deliberately accelerated teaching rules, not measured tissue turnover or cancer risks.
   CHANGE_CHANCE is calibrated so that, across 2,000 simulated runs per setting, most trials at age 50 show no
   cancer-state unit, while the share rises with age, body size and division frequency (see tests/t81-growth-calibration.js). */
(function(){
  'use strict';
  const profiles={
    skin:{name:'Skin · renewing cells',short:'Skin',rate:.18,color:'#c6b2a0',location:'skin',description:'Renewing cells in the living layers replace cells lost from the surface. Not every skin cell divides.'},
    colon:{name:'Intestinal lining · colon',short:'Colon lining',rate:.60,color:'#c6c59e',location:'colon',description:'Stem and progenitor cells in intestinal crypts replenish the lining. The model represents this renewing population.'},
    brain:{name:'Brain · glial/support cells',short:'Brain support',rate:.025,color:'#b6b5d9',location:'brain',description:'This sample represents a slowly dividing glial/support-cell population. Most mature neurons do not normally divide.'},
    bloodRed:{name:'Blood · red-cell precursors',short:'Red-cell precursors',rate:.55,color:'#d6a5ad',location:'marrow',description:'Nucleated precursors in bone marrow produce red blood cells. Mature human red blood cells lack a nucleus and do not divide. Real blood-forming stem cells have protections this model leaves out.'},
    bloodWhite:{name:'Blood · white-cell precursors',short:'White-cell precursors',rate:.45,color:'#b0c7dd',location:'marrow',description:'This sample represents dividing white-cell precursors. Mature white-cell types have different division behaviours.'},
    slow:{name:'Earlier model · slow setting',short:'Earlier slow',rate:.05,color:'#aac9c2',legacy:true},
    medium:{name:'Earlier model · moderate setting',short:'Earlier moderate',rate:.12,color:'#aac9c2',legacy:true},
    fast:{name:'Earlier model · fast setting',short:'Earlier fast',rate:.25,color:'#aac9c2',legacy:true}
  };
  const changes=['Growth signal altered','Checkpoint brake lost','DNA-repair control lost'];
  const CHANGE_CHANCE=.03;
  function profile(key){return profiles[key]||profiles.skin;}
  function simulate(age,size,tissue,rng){
    const random=rng||Math.random,n={small:20,average:30,large:40}[size],p=profile(tissue),masks=Array(n).fill(0),cancer=new Set();
    let divisions=0,firstCancerAge=null;
    const timeline=[{year:20,cumulative:0,cells:[],changes:masks.slice(),cancerCells:[],newCancerCells:[],cancerCount:0}];
    for(let year=21;year<=age;year++){
      const cells=[],newCancerCells=[];
      for(let unit=0;unit<n;unit++){
        if(random()>=(cancer.has(unit)?.80:p.rate))continue;
        divisions++;cells.push(unit);
        if(!cancer.has(unit)&&random()<CHANGE_CHANCE){
          masks[unit]|=1<<Math.floor(random()*3);
          if(masks[unit]===7){cancer.add(unit);newCancerCells.push(unit);if(firstCancerAge===null)firstCancerAge=year;}
        }
      }
      timeline.push({year:year,cumulative:divisions,cells:cells,changes:masks.slice(),cancerCells:Array.from(cancer),newCancerCells:newCancerCells,cancerCount:cancer.size});
    }
    return {modelVersion:2,age:age,size:size,tissue:tissue,divisions:divisions,opportunities:divisions,timeline:timeline,cancerCount:cancer.size,firstCancerAge:firstCancerAge};
  }
  window.GrowthCellTypes={profiles:profiles,profile:profile,simulate:simulate,changes:changes,changeChance:CHANGE_CHANCE};
})();
