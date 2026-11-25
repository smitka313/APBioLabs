'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright'),{ROOT,serve}=require('./_h');
(async()=>{
 const server=await serve();let browser;
 try{
   browser=await chromium.launch();
   const out=path.join(ROOT,'artifacts','wapusk');await fs.mkdir(out,{recursive:true});
   for(const width of [375,768,1366,1920]){
     const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:width===375?'dark':'light',hasTouch:width===375});
     try{
       const origin=new URL(server.url).origin;await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
       const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
       const by=id=>page.locator('#wb-'+id), tab=name=>page.locator('.wb-tabs [data-step="'+name+'"]');
       await page.goto(server.url+'openscied-b5-wapusk.html');
       assert.ok(await by('sightings').isVisible());assert.equal(await by('markers').locator('button').count(),3);
       await page.getByRole('button',{name:'Polar bear movements',exact:true}).press('Enter');
       assert.match(await by('evidence').innerText(),/four female polar bears/);
       await page.getByRole('button',{name:'Summer',exact:true}).click();
       assert.equal(await by('markers').locator('button').count(),5);
       await page.getByRole('button',{name:'Shared Owl River location'}).click();
       assert.match(await by('evidence').innerText(),/different occasions/);
       await page.locator('[name="overlap"][value="meeting"]').check();
       await page.getByRole('button',{name:'Check the claim'}).click();assert.match(await by('feedback').textContent(),/do not establish/);
       await page.locator('[name="overlap"][value="place"]').check();
       await page.getByRole('button',{name:'Check the claim'}).click();assert.match(await by('feedback').textContent(),/matches the evidence/);
       await by('observe').fill('The summer sightings include woodland.');
       assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
       await page.screenshot({path:path.join(out,width+'-sightings.png'),fullPage:true});
       await tab('scale').click();assert.match(await by('scale-recap').textContent(),/include woodland/);
       await by('scales').fill('Compare seasons locally and ice extent across years.');
       await tab('regions').click();
       await page.getByRole('button',{name:'Islands Ice',exact:true}).click();
       assert.match(await by('region').innerText(),/does not supply/);
       await page.getByRole('button',{name:'Convergent Ice',exact:true}).click();
       assert.match(await by('region').innerText(),/Northern Beaufort Sea.*Uncertain.*Stable/s);
       await by('regional').fill('Ice conditions differ and the health evidence is incomplete.');
       await tab('model').click();
       await page.reload();assert.ok(await by('model').isVisible());
       assert.match(await by('recap').innerText(),/include woodland.*across years.*incomplete/s);
       await by('seasonal').fill('If the ice season is shorter, access to seals could be reduced.');
       await by('persistent').fill('Ice remaining into summer could allow continued hunting.');
       await by('question').fill('Would the bears use the same places at the same times?');
       await by('finish').click();assert.match(await by('status').textContent(),/Notebook complete/);
       await page.getByRole('button',{name:'Preview report'}).first().click();
       assert.match(await page.getByRole('dialog').filter({hasText:'Three Bears in Wapusk'}).innerText(),/Convergent Ice.*Would the bears use the same places/s);
       assert.deepEqual(errors,[]);console.log('ok: Wapusk '+width+'px season evidence, regional inquiry, saved work, report');
     }finally{await ctx.close();}
   }
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
