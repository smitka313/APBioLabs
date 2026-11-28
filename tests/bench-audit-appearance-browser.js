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
const privacy='This site counts page visits without cookies. Student names and answers stay in this browser unless you choose to share them.';
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
     assert.equal(text.split(privacy).length-1,1,page+' has exactly one standard privacy line');
     assert.doesNotMatch(text,/GoatCounter/i,page+' has no vendor-facing footer wording');
     if(course){
      assert.equal(await bar.count(),1);
      const coursePath=page.startsWith('lab')?'ap-biology.html':'openscied-dashboard.html';
      const courseLink=bar.locator('a[href$="/'+coursePath+'"]');
      assert.equal(await courseLink.count(),1,page+' has exactly one link back to its course');
      assert.ok((await courseLink.textContent()).endsWith(course),page+' labels the course link');
      const helpLink=bar.locator('a[href$="/privacy-help.html#saving"]');
      assert.equal(await helpLink.count(),1,page+' has exactly one Saving & help link');
      assert.equal((await helpLink.textContent()).trim(),'Saving & help');
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
      const filter=async lab=>p.locator('.card .thumb[src$="/'+lab+'.webp"]').evaluate(e=>getComputedStyle(e).filter);
      if(theme==='dark'){
        assert.match(await filter('lab02'),/^brightness\(0\.91\)$/,'the darker allele-bead scene keeps its detail');
        assert.match(await filter('lab01'),/^brightness\(0\.91\)$/,'seedling detail keeps a lighter touch');
        assert.match(await filter('lab07'),/^brightness\(0\.81\)$/,'the brighter microscope slide is gently dimmed');
      }else{
        assert.equal(await filter('lab02'),'none');
        assert.equal(await filter('lab07'),'none');
      }
     }
     if(page==='openscied-b1-migration.html'){
      const map=p.locator('#migration-map');
      assert.equal((await map.evaluate(e=>getComputedStyle(e).filter)).includes('brightness(0.89)'),theme==='dark');
      assert.equal(await p.locator('.mx-north').evaluate(e=>getComputedStyle(e).filter),'none','map pin labels remain undimmed');
     }
     if(page==='openscied-b4-hawksbeard.html'){
      const art=p.locator(theme==='dark'?'.hb-hero-dusk':'.hb-hero-day');
      assert.ok(await art.isVisible());
      await art.evaluate(img=>img.decode());
      assert.equal(await art.evaluate(e=>getComputedStyle(e).filter),'none','dusk palette is baked into the art');
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
