'use strict';
const receipt = require('./openscied-b5-save-receipt');
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
       if(width===1366){
         const docx=await fs.readFile(path.join(path.dirname(require.resolve('docx')),'index.iife.js'),'utf8');
         await ctx.route(/https:\/\/.*\/docx@[^/]+\/.*\.js$/,r=>r.fulfill({contentType:'application/javascript',body:docx+'\nwindow.docx = docx;'}));
       }
       const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
       const by=id=>page.locator('#wb-'+id), tab=name=>page.locator('.wb-tabs [data-step="'+name+'"]');
       await page.goto(server.url+'openscied-b5-wapusk.html');
       assert.ok(await by('sightings').isVisible());
       assert(await by('reset').isDisabled());
       await receipt.ready(by('save'));await receipt.readableDisabled(by('reset'));
       await page.getByRole('button',{name:'Enter your name and class period'}).click();
       await page.getByRole('textbox',{name:'Enter your name as your teacher knows it'}).fill('Avery Wapusk');
       await page.getByLabel('Class period',{exact:true}).selectOption('2');
       await by('identity').getByRole('button',{name:'Save',exact:true}).click();
       assert.match(await by('identity').innerText(),/Avery Wapusk.*Period 2/s);
       assert(await by('identity').getByRole('button',{name:'Switch student'}).isVisible());
       assert.match(await page.locator('.wb-source-document object').getAttribute('data'),/Reference%20Bear%20Sightings.pdf/);
       assert.equal(await page.locator('iframe').count(),0);
       await page.getByRole('button',{name:/Play Three Bears/}).click();
       assert.match(await page.locator('iframe[title="Three Bears in Wapusk"]').getAttribute('src'),/youtube-nocookie\.com\/embed\/uUGvqB0tjs8/);assert.equal(await by('markers').locator('button').count(),3);
       await page.getByRole('button',{name:'Polar bear movements',exact:true}).press('Enter');
       assert.match(await by('evidence').innerText(),/four female polar bears/);
       await page.getByRole('button',{name:'Summer',exact:true}).click();
       assert.equal(await by('markers').locator('button').count(),5);
       for(const [label,profile] of [['Polar bear sightings','polar'],['Brown bear sightings','brown'],['Black bear sightings','black']]){
         await page.getByRole('button',{name:label,exact:true}).click();
         const img=by('evidence').locator('.wb-evidence-profile');
         assert.ok(await img.isVisible());assert.ok((await img.getAttribute('src')).endsWith(profile+'.svg'));
         await img.evaluate(n=>n.decode());
       }
       await page.getByText('Compare the three bear profiles',{exact:true}).click();
       const guide=page.locator('.wb-field-profiles');
       await guide.locator('img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
       assert.deepEqual(await guide.locator('figcaption strong').allTextContents(),['△ Polar bear','◆ Brown bear (grizzly)','⬟ American black bear']);
       await page.getByRole('button',{name:'Shared Owl River location'}).click();
       assert.equal(await by('evidence').locator('img').count(),0);
       assert.match(await by('evidence').innerText(),/different occasions/);
       const photos=by('evidence').getByRole('link',{name:/research photos/});
       assert.equal(await photos.getAttribute('target'),'_blank');assert.match(await photos.getAttribute('rel'),/noopener/);
       assert(await page.locator('.wb-field-key').evaluate(e=>e.open));
       await page.getByRole('group',{name:'Color theme'}).getByRole('button',{name:width===375?'Light':'Dark',exact:true}).click();
       assert(await page.locator('.wb-field-key').evaluate(e=>e.open),'changing theme must not close the guide');
       await page.locator('[name="overlap"][value="meeting"]').check();
       await page.getByRole('button',{name:'Check the claim'}).click();assert.match(await by('feedback').textContent(),/do not establish/);
       await page.locator('[name="overlap"][value="place"]').check();
       await page.getByRole('button',{name:'Check the claim'}).click();assert.match(await by('feedback').textContent(),/matches the evidence/);
       const owlResult=await by('feedback').textContent();
       await by('observe').fill('The summer sightings include woodland.');
       const savedAt=await receipt.saved(by('save'));
       const overflow=await page.evaluate(()=>[...document.body.querySelectorAll('*')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,String(e.className),e.id]).slice(0,12));
       assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),JSON.stringify(overflow));
       await page.screenshot({path:path.join(out,width+'-sightings.png'),fullPage:true});
       await tab('scale').click();
       assert.equal(await receipt.saved(by('save')),savedAt,'changing steps does not count as editing work');
       const localScale='Wapusk National Park covers 11,475 km²';
       assert.ok((await by('park-scale').innerText()).includes(localScale));
       assert.equal(await page.locator('iframe').count(),0);
       await page.getByRole('button',{name:'Hudson Bay ice breakup'}).click();
       await by('scale-image').evaluate(e=>e.decode());assert.match(await by('scale-caption').textContent(),/breakup date/);
       await by('enlarge-scale').click();assert.ok(await by('visual-dialog').isVisible());
       await page.getByRole('button',{name:'Close visual'}).click();
       await page.getByRole('button',{name:'Arctic ice minimum'}).click();assert.ok(await by('nasa').isVisible());
       assert(await by('static-scale').isHidden());assert(await by('sea-ice').isVisible());
       assert.match(await by('ice-title').textContent(),/1987–2023/);
       assert.equal(await by('ice-plot').locator('.wb-ice-dot').count(),37);
       await page.getByRole('button',{name:'2012 record low',exact:true}).click();
       assert.match(await by('ice-value').innerText(),/2012: 3.39.*record low/);
       await by('ice-year').press('End');assert.match(await by('ice-value').innerText(),/2023: 4.26/);
       await page.getByText('See the exact data by year',{exact:true}).click();
       await page.reload();assert(await by('sea-ice').isVisible());
       assert(await page.locator('details[data-keep-open="ice-table"]').evaluate(e=>e.open));
       assert.equal(await by('ice-data').locator('tr').count(),37);
       await page.locator('[name=scale-match][value=camp]').check();
       await page.getByRole('button',{name:'Check the scales'}).click();assert.match(await by('scale-feedback').innerText(),/does not show the date/);
       await page.locator('[name=scale-match][value=camp]').uncheck();
       for(const v of ['park','canada','bay','arctic'])await page.locator('[name=scale-match][value='+v+']').check();
       if(width===1366){
         await page.reload();
         assert(await page.locator('[name=scale-match][value=park]').isChecked(),'unchecked draft choice survives reload');
       }
       const selected=await page.locator('[name=scale-match]:checked').evaluateAll(ns=>ns.map(n=>n.parentElement.textContent.trim()));
       await page.getByRole('button',{name:'Check the scales'}).click();assert.match(await by('scale-feedback').innerText(),/^Yes/);
       assert.match(await by('scale-recap').textContent(),/include woodland/);
       await by('scales').fill('Compare seasons locally and ice extent across years.');
       await tab('regions').click();
       const baf=by('region').getByRole('row',{name:/Baffin Bay/});
       assert.deepEqual(await baf.locator('td').allTextContents(),['Likely stable','Decline','Decline']);
       assert.match(await by('region').innerText(),/All can be true at the same time/);
       await page.getByRole('button',{name:'Divergent Ice',exact:true}).click();
       assert.deepEqual(await by('region').getByRole('row',{name:/Kara Sea/}).locator('td').allTextContents(),['Not enough data','Uncertain','Uncertain']);
       await page.getByRole('button',{name:'Islands Ice',exact:true}).click();
       assert.match(await by('region').innerText(),/does not supply/);
       await page.getByRole('button',{name:'Convergent Ice',exact:true}).click();
       await by('region').locator('img').evaluate(e=>e.decode());
       assert.match(await by('region').innerText(),/Northern Beaufort Sea.*Likely stable.*Uncertain.*Stable/s);
       await by('regional').fill('Ice conditions differ and the health evidence is incomplete.');
       await tab('model').click();
       await page.reload();assert.ok(await by('model').isVisible());
       assert.match(await by('recap').innerText(),/include woodland.*across years.*incomplete/s);
       await by('seasonal').fill('If the ice season is shorter, access to seals could be reduced.');
       await by('persistent').fill('Ice remaining into summer could allow continued hunting.');
       await by('question').fill('Would the bears use the same places at the same times?');
       await by('finish').click();assert.match(await by('status').textContent(),/Notebook complete/);
       await page.getByRole('button',{name:'Preview report'}).first().click();
       const report=await page.getByRole('dialog').filter({hasText:'Three Bears in Wapusk'}).innerText();
       assert.match(report,/Convergent Ice.*Would the bears use the same places/s);
       assert.match(report,/Avery Wapusk.*Class period.*2/s);
       assert.ok(report.includes(localScale),'report identifies the correct local area');
       assert.ok(report.includes(owlResult),'Owl River verdict must match the checked account on screen');
       assert.ok(selected.every(label=>report.includes(label)),'report must include all submitted scale choices');
       if(width===1366){
         await page.getByText('More formats',{exact:true}).click();
         const [word]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Download Word/}).click()]);
         const xml=await (await require('jszip').loadAsync(await fs.readFile(await word.path()))).file('word/document.xml').async('string');
         assert.ok(xml.includes(localScale),'Word carries the same local scale');
         assert.ok(selected.every(label=>xml.includes(label)),'Word includes exact checked choices');
       }
       await page.getByRole('button',{name:'Close report',exact:true}).click();
       const theme=page.getByRole('group',{name:'Color theme'});
       const originalId=report.match(/WB-[A-F0-9]{8}/)[0];
       const beforeTheme=await page.evaluate(()=>localStorage.getItem('aplab:openscied:b5-wapusk:v1'));
       for(const mode of ['Dark','Light']){
         await theme.getByRole('button',{name:mode,exact:true}).click();
         await page.getByRole('button',{name:'Preview report'}).first().click();
         const reopened=await page.getByRole('dialog').filter({hasText:'Three Bears in Wapusk'}).innerText();
         assert.equal(reopened.match(/WB-[A-F0-9]{8}/)[0],originalId,'same-tab theme change keeps the report dataset');
         await page.getByRole('button',{name:'Close report',exact:true}).click();
       }
       assert.equal(await page.evaluate(()=>localStorage.getItem('aplab:openscied:b5-wapusk:v1')),beforeTheme,'changing theme and reopening Preview does not write work');
       await page.getByText('Other report formats: HTML or JSON',{exact:true}).click();
       let [file]=await Promise.all([page.waitForEvent('download'),by('save-html').click()]);
       const html=await fs.readFile(await file.path(),'utf8');assert.match(file.suggestedFilename(),/WB-[A-F0-9]{8}\.html$/);
       assert.ok(html.includes(owlResult));
       assert.ok(html.includes(localScale));
       assert.ok(selected.every(label=>html.includes(label)));
       [file]=await Promise.all([page.waitForEvent('download'),by('save-json').click()]);
       const json=JSON.parse(await fs.readFile(await file.path(),'utf8'));
       assert.deepEqual(json.student,{name:'Avery Wapusk',period:'2'});assert.match(json.datasetId,/^WB-[A-F0-9]{8}$/);
       assert.equal(json.status,'final');assert.equal(json.conceptChecks.owlRiver.verdict,'Supported');
       assert.equal(json.datasetId,originalId,'Preview in both themes and JSON must name the same dataset');
       assert.equal(json.conceptChecks.evidenceScale.verdict,'Correct');
       assert.deepEqual(json.conceptChecks.evidenceScale.choices,selected);
       assert.equal(json.conceptChecks.owlRiver.verdict+' · '+json.conceptChecks.owlRiver.answer+' '+json.conceptChecks.owlRiver.feedback,owlResult);
       assert.equal(json.seaIceMinimumExtent.values.find(x=>x.year===2012).extent,3.39);
       assert.equal(json.localScale.parkAreaKm2,11475);
       assert.ok(json.localScale.scope.includes(localScale));
       assert.equal(json.work,undefined);
       if(width===1366){
         const chart=await ctx.newPage();await chart.goto(server.url+'openscied-b5-wapusk.html#wb-sea-ice');
         assert(await chart.locator('#wb-sea-ice').isVisible(),'Lesson 6 link opens the extent chart without changing saved work');
         assert.match(await chart.locator('#wb-sea-ice').innerText(),/uses|plots|extent/i);await chart.close();
         await page.evaluate(()=>localStorage.setItem('aplab:openscied:neighbor:v1','Keep'));
         await by('reset').click();assert(await by('clear').isDisabled());await by('keep').click();
         assert.match(await by('question').inputValue(),/Would the bears/);
         await by('reset').click();await by('reset-confirm').fill('ERASE');
         await Promise.all([page.waitForEvent('load'),by('clear').click()]);
         assert(await by('sightings').isVisible());assert.equal(await by('observe').inputValue(),'');
         assert.match(await by('identity').innerText(),/Avery Wapusk/);
         assert.equal(await page.evaluate(()=>localStorage.getItem('aplab:openscied:neighbor:v1')),'Keep');
       }
       assert.deepEqual(errors,[]);console.log('ok: Wapusk '+width+'px season evidence, regional inquiry, saved work, report');
     }finally{await ctx.close();}
   }
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
