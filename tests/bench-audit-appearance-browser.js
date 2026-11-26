'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const T=require('./_h');
const pages=[
 ['lab02.html','AP Biology labs'],
 ['openscied-b1-serengeti.html','Unit 1'],
 ['openscied-b1-migration.html','Unit 1'],
 ['openscied-b2-burn-lab.html','Unit 2'],
 ['openscied-b3-dna-workshop.html','Unit 3'],
 ['openscied-b4-hawksbeard.html','Unit 4'],
 ['openscied-b5-wapusk.html','Unit 5'],
 ['ap-biology.html',null],
 ['openscied-dashboard.html',null]
];
const privacy='This site counts anonymous page visits without cookies. Nothing you type, including your name and answers, is sent anywhere.';
const screenshot=process.env.BENCH_AUDIT_SCREENSHOTS;
(async()=>{
 let browser,site;
 try{
  browser=await T.launch();site=await T.serve();
  if(screenshot)await fs.mkdir(screenshot,{recursive:true});
  for(const [width,theme] of [[390,'dark'],[768,'dark'],[1366,'light'],[1920,'light']]){
   const cx=await T.ctxFor(browser,{width,height:900,reduced:true,dark:theme==='dark'});
   try{
    await cx.addInitScript(value=>localStorage.setItem('aplab:pref:theme',value),theme);
    // Preserve the analytics inclusion, but never submit QA page visits or load media.
    await cx.route(/https:\/\/(?:gc\.zgo\.at|[^/]+\.goatcounter\.com|[^/]+\.youtube(?:-nocookie)?\.com)\//,r=>r.abort());
    const p=await cx.newPage();
    for(const [page,course] of pages){
     if(width===768||width===1920){
      if(!['openscied-b3-dna-workshop.html','openscied-b4-hawksbeard.html','ap-biology.html'].includes(page))continue;
     }
     await p.goto(site.url+page);
     const bar=p.locator('.bench-activity-bar');
     const footer=p.locator('.bench-footer-home');
     await footer.waitFor();
     assert.equal(await p.locator('script[data-goatcounter]').count(),1,'tracking tag remains on '+page);
     const text=await footer.evaluate(a=>a.closest('footer').innerText);
     assert.ok(text.includes(privacy),page+' has the standard privacy line');
     assert.doesNotMatch(text,/GoatCounter/i,page+' has no vendor-facing footer wording');
     if(course){
      assert.equal(await bar.count(),1);
      assert.ok((await bar.locator('.bench-activity-course').textContent()).endsWith(course));
      const logo=bar.locator('.bench-footer-'+theme);
      await logo.evaluate(img=>img.decode());
      assert.ok(await logo.isVisible(),page+' uses the current theme’s logo');
      const skip=p.locator('body > a.skip-link, body > a[class$="-skip"]').first();
      if(await skip.count())assert.equal(await skip.evaluate(a=>a.nextElementSibling.className),'bench-activity-bar');
      const nav=p.locator('nav:is([aria-label="Activity steps"],[aria-label="Activity sections"],[aria-label="Investigation steps"],[aria-label="Investigation sections"],[aria-label="Workshop steps"])').first();
      const active=nav.locator(':is(button,a):is([aria-current="page"],[aria-current="step"],[aria-current="true"],[aria-pressed="true"])').first();
      if(page.startsWith('openscied-')&&await active.count()){
       assert.ok((await active.boundingBox()).height>=41.5,page+' current step stays easy to select');
       assert.notEqual(await active.evaluate(b=>getComputedStyle(b).borderTopWidth),'0px');
      }
     }else assert.equal(await bar.count(),0,page+' keeps its native branded masthead');
     if(page==='ap-biology.html'){
      const filter=await p.locator('.card .thumb').first().evaluate(e=>getComputedStyle(e).filter);
      assert.equal(filter.includes('brightness(0.64)'),theme==='dark');
     }
     if(page==='openscied-b1-migration.html'){
      const map=p.locator('#migration-map');
      assert.equal((await map.evaluate(e=>getComputedStyle(e).filter)).includes('brightness(0.89)'),theme==='dark');
      assert.equal(await p.locator('.mx-north').evaluate(e=>getComputedStyle(e).filter),'none','map pin labels remain undimmed');
     }
     if(page==='openscied-b4-hawksbeard.html'){
      const art=p.locator(theme==='dark'?'.hb-hero-dusk':'.hb-hero-day');
      assert.ok(await art.isVisible());
      assert.equal((await art.evaluate(e=>getComputedStyle(e).filter)).includes('brightness(1.2)'),theme==='dark');
     }
     assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),page+' fits '+width);
     if(screenshot)await p.screenshot({path:path.join(screenshot,width+'-'+theme+'-'+page.replace('.html','.png'))});
     if(page==='lab02.html'&&width===1366){
      await p.emulateMedia({media:'print'});
      assert.ok(await bar.isHidden(),'activity masthead does not enter print output');
      await p.emulateMedia({media:'screen'});
     }
    }
   }finally{await cx.close();}
  }
 }finally{await browser?.close();await site?.close();}
 console.log('Verified shared activity mastheads, step appearance, plain privacy copy, analytics tags and three dark-image treatments.');
})().catch(err=>{console.error(err);process.exitCode=1;});
