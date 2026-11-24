/* Fictional teaching model. Credits and travel constraints are invented;
 * no medical decision, test accuracy, or cancer incidence is modeled.
 * The same patients, clinical flags, and access constraints are reused for every plan. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ScreeningLogic=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const zones=Object.freeze(['hub','mobile']);
  const pieces=Object.freeze(['screen','machine','operator','rides']);
  const places=Object.freeze(['North Fork','Riverbend','Central']);
  // Fictional, one-way distances; the same distances drive the travel cost bands.
  const distances=Object.freeze([
    Object.freeze({hub:42,mobile:14}),Object.freeze({hub:28,mobile:14}),Object.freeze({hub:14,mobile:28})
  ]);
  const names=Object.freeze({hub:'Regional hospital',mobile:'Shared mobile clinic',screen:'Screening team',machine:'Ultrasound machine',operator:'Trained sonographer',rides:'Ride vouchers'});
  const budget=720;
  const baseline=Object.freeze({screen:'hub',machine:'hub',operator:'hub',rides:null});
  function costs(p){
    const map=Object.fromEntries(pieces.map(k=>[k,zones.includes(p?.[k])?p[k]:null]));
    return {
      screening:map.screen==='hub'?85:map.screen==='mobile'?120:0,
      acquisition:map.machine==='hub'?260:map.machine==='mobile'?315:0,
      maintenance:map.machine==='hub'?40:map.machine==='mobile'?55:0,
      staffing:map.operator==='hub'?140:map.operator==='mobile'?160:0,
      transport:map.rides?95:0
    };
  }
  const total=p=>Object.values(costs(p)).reduce((x,y)=>x+y,0);
  function random(seed){return()=>{seed=(seed+0x6D2B79F5)>>>0;let n=seed;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};}
  function cohort(seed){
    if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new RangeError('Invalid dataset seed');
    const rand=random(seed), ints=(n)=>Math.floor(n*rand());
    return places.flatMap((place,z)=>{
      const needed=new Set();while(needed.size<4)needed.add(ints(10));
      return Array.from({length:10},(_,i)=>({
        id:z*10+i+1,place,z,needed:needed.has(i),means:42+ints(72),hours:2+ints(7),
        value:4+ints(4),routeExtra:ints(2)
      }));
    });
  }
  function scenarios(seed){
    const patients=cohort(seed),rand=random((seed^0xB5C0FBCF)>>>0);
    // Choose one person per town; rotate which town shows the screening-only case.
    // Pick before examining outcomes, so no plan is favored by the selection.
    const screenOnly=Math.floor(rand()*places.length);
    return places.map((_,z)=>{
      const eligible=patients.filter(p=>p.z===z&&p.needed===(z!==screenOnly));
      return publicProfile(eligible[Math.floor(rand()*eligible.length)]);
    });
  }
  function publicProfile(p){
    return {...p,monthlyIncome:p.means*50,distances:distances[p.z]};
  }
  function checkout(quote,credits,hours){
    const moneyShort=Math.max(0,quote.total-credits), timeShort=Math.max(0,quote.time-hours);
    return {ok:!moneyShort&&!timeShort,moneyShort,timeShort,remaining:moneyShort||timeShort?credits:credits-quote.total};
  }
  const reached=(p)=>p.needed?p.outcome==='imaged':p.outcome==='screened';
  const comparison=(a,b)=>reached(a)?(reached(b)?'both':'base'):(reached(b)?'trial':'neither');
  function validate(p){
    if(!p||!zones.includes(p.screen))return 'Place the screening team first.';
    if(!zones.includes(p.machine)||!zones.includes(p.operator))return 'Place the ultrasound machine and trained sonographer.';
    if(p.operator!==p.machine)return 'Put the sonographer and the machine at the same site.';
    if(p.rides!==null&&!zones.includes(p.rides))return 'Move ride vouchers to a site or leave them in the supply rack.';
    if(total(p)>budget)return 'This plan is over the clinic network’s budget.';
    return '';
  }
  function visit(person,place,kind,plan){
    const miles=distances[person.z][place], remote=miles/14;
    const ride=plan.rides===place;
    const travel=remote*7+person.routeExtra*3;
    const fee=kind==='screen'?8:22;
    const time=remote+1+person.routeExtra;
    const travelPaid=ride?Math.max(0,travel-13):travel;
    const timeCost=time*person.value;
    return {place,miles,fee,travel:travelPaid,timeCost,time,total:fee+travelPaid+timeCost,ride};
  }
  function run(seed,plan){
    const invalid=validate(plan);if(invalid)throw new RangeError(invalid);
    const patients=cohort(seed).map(p=>{
      const screen=visit(p,plan.screen,'screen',plan);
      const first=checkout(screen,p.means,p.hours);
      if(!first.ok)return {...p,outcome:'screen-missed',screen,scan:null,paid:0,reason:first.timeShort?'Not enough time for the screening trip.':'Screening, travel, and time cost more than this person’s available credits.'};
      if(!p.needed)return {...p,outcome:'screened',screen,scan:null,paid:screen.total,reason:'Screening finished. This case was not referred for ultrasound in the model.'};
      const scan=visit(p,plan.machine,'scan',plan);
      const follow=checkout(scan,first.remaining,p.hours);
      if(!follow.ok)return {...p,outcome:'follow-up-missed',screen,scan,paid:screen.total,reason:follow.timeShort?'Not enough time for the follow-up trip.':'After screening, the person did not have enough credits for follow-up.'};
      return {...p,outcome:'imaged',screen,scan,paid:screen.total+scan.total,reason:'Ultrasound finished. An image can guide the next step; it is not a cancer diagnosis.'};
    });
    const summarize=group=>({
      screened:group.filter(p=>p.outcome!=='screen-missed').length,
      referred:group.filter(p=>p.needed&&p.outcome!=='screen-missed').length,
      imaged:group.filter(p=>p.outcome==='imaged').length,
      outlay:group.reduce((n,p)=>n+p.paid,0)
    });
    return {patients,...summarize(patients),areas:places.map((place,z)=>({place,...summarize(patients.filter(p=>p.z===z))})),costs:costs(plan),clinic:total(plan)};
  }
  return Object.freeze({zones,pieces,places,names,baseline,budget,costs,total,validate,cohort,run,scenarios,comparison,distances,quote:visit,checkout});
});
