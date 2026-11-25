'use strict';
const assert=require('node:assert/strict');
const T=require('./_h');
const hybrid='aplab:openscied:b5-hybrid:v1', cancer='aplab:openscied:b3-cancer-rates:v1';
const globalEpoch='aplab:pref:openscied-save-session:v1:global';
const fixtureText='This is a fictional classroom test notebook.';
const opened=(p,key)=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
(async()=>{
 const site=await T.serve();let b;
 try{
  b=await T.launch();
  const first=await T.ctxFor(b,{reduced:true}),other=await T.ctxFor(b,{reduced:true});
  try {
   for(const ctx of [first,other])await ctx.route(/^https?:\/\/(?:fonts\.|gc\.zgo\.at|.*goatcounter\.com)/,r=>r.abort());
   const h=await first.newPage(),c=await first.newPage(),d=await first.newPage(),clean=await other.newPage();
   await h.goto(site.url+'openscied-b5-hybrid.html');
   await h.locator('#hy-prediction').fill(fixtureText);
   const prior=await opened(h,hybrid);
   assert.match(prior.id,/^[A-F0-9]{8}$/);
   await c.goto(site.url+'openscied-b3-cancer-rates.html');
   await c.locator('#cr-prediction').selectOption('different');
   await c.locator('#cr-reason').fill('I predict the two lists measure different outcomes.');
   await c.locator('#cr-lock').click();
   const savedCancer=await opened(c,cancer);
   assert.equal(savedCancer.prediction.locked,true);
   await clean.goto(site.url+'openscied-dashboard.html');
   assert.equal(await opened(clean,hybrid),null);
   assert.equal(await opened(clean,cancer),null);
   await h.reload();
   assert.equal(await h.locator('#hy-prediction').inputValue(),fixtureText);
   assert.equal((await opened(h,hybrid)).id,prior.id);
   await c.close();
   const next=await first.newPage();
   await next.goto(site.url+'openscied-b3-cancer-rates.html');
   assert.equal((await opened(next,cancer)).prediction.reason,savedCancer.prediction.reason);
   await d.goto(site.url+'openscied-dashboard.html');
   const trackers=()=>d.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('aplab:pref:openscied-resume:v1'))));
   const before=await trackers();
   const link=d.locator('#openscied-resume-link');
   const resume=await link.getAttribute('href');
   await d.reload();
   assert.equal(await link.getAttribute('href'),resume);
   assert.deepEqual(await trackers(),before,'dashboard reload does not rewrite the resume metadata');
   await h.evaluate(key=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('test quota','QuotaExceededError');return set.call(this,k,v);};
   },hybrid);
   await h.locator('#hy-prediction').fill('An unsaved local draft.');
   assert.match(await h.locator('#ose-save-warning').textContent(),/could not save.*Preview report/i);
   assert.equal((await opened(h,hybrid)).answers.prediction,fixtureText);
   assert.equal((await opened(d,cancer)).prediction.reason,savedCancer.prediction.reason);
   assert.equal(await d.evaluate(k=>localStorage.getItem(k),globalEpoch),null);
   console.log('OpenSciEd work and dataset survive reload and tab closure; failed writes stay local; fresh contexts are isolated.');
  }finally{await first.close();await other.close();}
 }finally{await b?.close();await site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
