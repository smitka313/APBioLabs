/* OpenSciEd B.2 L9, handout pp.1–4 and TE pp.188,194–196.
 * Direction cards are a separate source and are not transcribed here.
 * Printed-card mode records the student's interpretation; it never invents transitions.
 * Every roll counts once at its origin, including staying at that station. No elapsed-time claims.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CarbonJourney=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const stations=[['atmosphere','Atmosphere','Carbon dioxide in the air'],['ocean','Ocean','Hydrosphere'],['human','Human activity','Biosphere'],['producers','Producers','Biosphere'],['herbivores','Herbivores','Biosphere'],['omnivores','Omnivores','Biosphere'],['soil','Soil and rock','Geosphere']];
const matter=['Carbon dioxide','Food fuel','Biomass','Fossil fuel','Waste','Sediment','Material good'];
const energy=['Energy remains in the same arrangement of atoms.','Energy flows to another place/system in the same arrangement of atoms.','Energy changes result from the atoms rearranging.','Energy flows to another place/new system AND the atoms are rearranged.'];
const valid=id=>stations.some(s=>s[0]===id);
function die(seed,index){let a=((seed>>>0)+Math.imul(index+1,0x6D2B79F5))>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return 1+Math.floor((((t^(t>>>14))>>>0)/4294967296)*6);}
function initial(seed){return {version:1,seed:seed>>>0,rows:[],pending:null,answers:{},done:false};}
function current(s){return s.rows.length?s.rows[s.rows.length-1].to:'atmosphere';}
function record(s,input){if(!Number.isInteger(s.pending)||s.pending<1||s.pending>6||!valid(input.to)||!matter.includes(input.matter)||!energy.includes(input.energy))throw Error('Read the station card and choose matter, energy and next location.');return {...s,pending:null,rows:s.rows.concat({turn:s.rows.length+1,from:current(s),die:s.pending,to:input.to,matter:input.matter,energy:input.energy,note:String(input.note||'').slice(0,1000)} )};}
function totals(s,key,keys){return keys.map(k=>({label:k,count:s.rows.filter(r=>r[key]===k).length}));}
function restore(raw,seed){try{const v=JSON.parse(raw);if(v.version!==1||!Number.isInteger(v.seed)||!Array.isArray(v.rows))return initial(seed);let s=initial(v.seed);for(const r of v.rows){if(r.from!==current(s)||r.turn!==s.rows.length+1)throw Error();s.pending=r.die;s=record(s,r);}s.pending=Number.isInteger(v.pending)&&v.pending>=1&&v.pending<=6?v.pending:null;s.answers={};for(const [k,val] of Object.entries(v.answers||{}))if(/^q[2-6]$/.test(k)&&typeof val==='string')s.answers[k]=val.slice(0,20000);s.done=v.done===true&&s.rows.length>=10;return s;}catch{return initial(seed);}}
return {stations,matter,energy,die,initial,current,record,totals,restore};});
