'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright'),{serve}=require('./_h');
(async()=>{
 const server=await serve();let browser;
 try{
   browser=await chromium.launch();
   for(const width of [375,768,1366,1920]){
     const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:width===375?'dark':'light',reducedMotion:width===375?'reduce':'no-preference'});
     try{
       const origin=new URL(server.url).origin;await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
       const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
       const by=id=>p.locator('#th-'+id), tab=name=>p.locator('.th-tabs [data-step="'+name+'"]');
       const fit=async stage=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),stage+' overflows at '+width);
       await p.goto(server.url+'openscied-b5-thermoregulation.html');
       await p.locator('.th-bear-guide img').evaluate(n=>n.decode());
       assert.match(await p.locator('.th-bear-guide figcaption').innerText(),/Polar.*Brown.*Black/s);
       await by('predict').fill('The polar bear could leave when a brown bear arrives.');
       await p.getByRole('button',{name:'Polar + black',exact:true}).click(); assert.match(await by('case').innerText(),/not provide direct interaction data/);
       await p.getByRole('button',{name:'Polar + brown',exact:true}).click(); assert.match(await by('case').innerText(),/137.*97/s);
       await by('field').fill('The field observation did not measure core temperature.');
       await fit('Field');
       await tab('treadmill').click();
       await p.locator('[data-row="3"]').click();
       const fast=await by('scene').evaluate(n=>parseFloat(n.style.getPropertyValue('--cadence')));
       if(width===375){
         assert.ok(await by('walk').isDisabled());
         assert.equal(await by('scene').getAttribute('data-running'),'false');
       }else{
         assert.equal(await by('scene').getAttribute('data-running'),'true');
         const leg=by('scene').locator('.th-hind-near');
         const initial=await leg.evaluate(n=>getComputedStyle(n).transform);
         await p.waitForFunction(old=>getComputedStyle(document.querySelector('.th-hind-near')).transform!==old,initial);
         assert.equal(await by('scene').locator('.th-belt-lines').evaluate(n=>getComputedStyle(n).animationName),'th-belt-motion');
         await by('walk').click();assert.equal(await by('scene').getAttribute('data-running'),'false');
       }
       await p.locator('[data-row="0"]').click();
       assert.ok((await by('scene').evaluate(n=>parseFloat(n.style.getPropertyValue('--cadence'))))>fast);
       await p.locator('[data-row="3"]').click();
       assert.match(await by('reading').innerText(),/117\.0 minutes.*24 breaks/);
       assert.deepEqual(await by('bear-data').locator('tr[data-active=true] :is(th,td)').allTextContents(),['2.2','375','117.0','24']);
       await p.locator('.th-source img').evaluate(n=>n.decode());
       await by('enlarge').click();assert.ok(await by('visual').isVisible());await p.getByRole('button',{name:'Close graph'}).click();
       await p.getByText('Watch the Oregon Zoo treadmill clip').click();await p.getByRole('button',{name:'Play clip',exact:true}).click();
       assert.match(await p.locator('iframe').getAttribute('src'),/\/embed\/lff3Sca8g9M.*start=17/);
       await p.locator('[data-check="wild"]').click();assert.match(await by('check').innerText(),/did not record internal temperatures/);
       await p.locator('[data-check="breaks"]').click();assert.match(await by('check').innerText(),/^Yes/);
       await by('pattern').fill('From 0 to 24 breaks from 1.1 to 2.2 m/s.');
       await fit('Treadmill');
       await tab('human').click();assert.equal(await p.locator('iframe').count(),0);assert.equal(await by('scene').getAttribute('data-running'),'false');
       await by('sample').click();assert.match(await by('human-status').innerText(),/invented/);assert.equal(await by('human-plot').locator('circle,rect').count(),10);
       await by('edit').click();await p.getByLabel('Participant A at 0 minutes (°C)',{exact:true}).fill('32.8');
       await p.getByLabel('Participant A at 4 minutes (°C)',{exact:true}).fill('33.2');
       assert.equal(await by('human-plot').locator('circle').count(),2);
       assert.equal(await by('human-plot').locator('line').count(),0,'gap must not be imputed');
       await by('human-note').fill('The skin readings went up, and sweating can transfer energy.');
       await fit('Human');
       await p.reload();assert.equal(await p.getByLabel('Participant A at 4 minutes (°C)',{exact:true}).inputValue(),'33.2');
       await tab('model').click();
       await p.locator('[data-card="heat"]').click();await p.locator('[data-zone="matterOut"]').click();assert.match(await by('sort-status').innerText(),/try again/);
       await p.locator('[data-zone="energy"]').click();assert.match(await by('sort-status').innerText(),/Heat transferred placed/);
       for(const [c,z] of Object.entries({oxygen:'matterIn',water:'matterOut',usable:'energy',glucose:'matterIn',carbon:'matterOut'})){
         if(c==='carbon')await p.locator('[data-card="'+c+'"]').dragTo(p.locator('[data-zone="'+z+'"]'));
         else{await p.locator('[data-card="'+c+'"]').click();await p.locator('[data-zone="'+z+'"]').click();}
       }
       assert.match(await by('sort-status').innerText(),/All six cards placed/);
       assert.match(await by('recap').innerText(),/97 of 137.*24.*33\.2/s);
       await by('explain').fill('Heat is plausible. Measure heat and behavior in comparable wild encounters.');
       await fit('Model');
       await p.getByRole('button',{name:'Preview report',exact:true}).click();
       const report=await p.getByRole('dialog').filter({hasText:'Bear Thermoregulation Lab'}).innerText();
       assert.match(report,/117.*33\.2.*6 of 6.*Heat is plausible/s);
       assert.deepEqual(errors,[]);
       console.log('Thermoregulation '+width+'px: original graph, speed data, class measurements, card sort, persistence, report');
     }finally{await ctx.close();}
   }
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
