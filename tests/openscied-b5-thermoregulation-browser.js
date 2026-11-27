'use strict';
const receipt = require('./openscied-b5-save-receipt');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{serve}=require('./_h');
const {inflateRawSync}=require('node:zlib');
function unzipWord(zip){
  const end=zip.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  assert(end>=0);const count=zip.readUInt16LE(end+10);
  let at=zip.readUInt32LE(end+16);
  for(let i=0;i<count;i++){
    assert.equal(zip.readUInt32LE(at),0x02014b50);
    const nameLen=zip.readUInt16LE(at+28),extra=zip.readUInt16LE(at+30),comment=zip.readUInt16LE(at+32);
    const name=zip.subarray(at+46,at+46+nameLen).toString();
    if(name==='word/document.xml'){
      const loc=zip.readUInt32LE(at+42),start=loc+30+zip.readUInt16LE(loc+26)+zip.readUInt16LE(loc+28);
      const bytes=zip.subarray(start,start+zip.readUInt32LE(at+20));
      return (zip.readUInt16LE(at+10)===8?inflateRawSync(bytes):bytes).toString();
    }
    at+=46+nameLen+extra+comment;
  }
  throw Error('Missing word/document.xml');
}
(async()=>{
 const server=await serve();let browser;
 try{
   browser=await chromium.launch();
   for(const width of [375,768,1366,1920]){
     const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:width===375?'dark':'light',reducedMotion:width===375?'reduce':'no-preference'});
     try{
       const origin=new URL(server.url).origin;await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
       if(width===1366){
         const docx=fs.readFileSync(path.join(path.dirname(require.resolve('docx')),'index.iife.js'),'utf8')+'\nwindow.docx = docx;';
         await ctx.route(/https:\/\/.*\/docx@[^/]+\/.*\.js$/,r=>r.fulfill({contentType:'application/javascript',body:docx}));
       }
       const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
       const by=id=>p.locator('#th-'+id), tab=name=>p.locator('.th-tabs [data-step="'+name+'"]');
       const fit=async stage=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),stage+' overflows at '+width);
       await p.goto(server.url+'openscied-b5-thermoregulation.html');
       await receipt.ready(p.locator('#th-save'));await receipt.readableDisabled(p.locator('#th-reset'));
       const title=await p.locator('.th-hero h1 span').evaluate(n=>({rects:n.getClientRects().length,fit:n.getBoundingClientRect().right<=innerWidth}));
       assert.deepEqual(title,{rects:1,fit:true},'Thermoregulation must stay intact and fit');
       await p.getByRole('button',{name:'Enter your name and class period'}).click();
       await p.getByRole('textbox',{name:'Enter your name as your teacher knows it'}).fill('Avery Thermal');
       await p.getByLabel('Class period',{exact:true}).selectOption('2');
       await by('identity').getByRole('button',{name:'Save',exact:true}).click();
       assert.match(await by('identity').innerText(),/Avery Thermal.*Period 2/s);
       assert(await by('identity').getByRole('button',{name:'Switch student'}).isVisible());
       assert(await by('reset').isDisabled());
       const portraits=p.locator('.th-bear-profiles img');
       assert.equal(await portraits.count(),3);
       await portraits.evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
       assert.deepEqual(await p.locator('.th-bear-profiles figcaption strong').allTextContents(),['Polar bear','Brown bear (grizzly)','American black bear']);
       assert.equal(await p.locator('iframe[data-lesson-video][src]').count(),0);
       await by('predict').fill('The polar bear could leave when a brown bear arrives.');
       await receipt.saved(by('save'));
       await p.getByRole('button',{name:'Polar + black',exact:true}).click(); assert.match(await by('case').innerText(),/not provide direct interaction data/);
       await p.getByRole('button',{name:'Polar + brown',exact:true}).click(); assert.match(await by('case').innerText(),/137.*97.*32 involved aggression and 8/s);
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
       assert.deepEqual(await by('core').locator('.th-point-label').allTextContents(),['≈36.5°C','≈36.8°C','≈37.6°C','≈38.5°C','≈39.6°C']);
       assert.match(await p.locator('#treadmill').innerText(),/360 minutes.*375.*does not explain/s);
       assert.match(await p.locator('.th-source').innerText(),/1.4–2.1.*1.1–2.2.*2.0°C.*3.1°C/s);
       await by('enlarge').click();assert.ok(await by('visual').isVisible());await p.getByRole('button',{name:'Close graph'}).click();
       const treadmillPlayer=p.locator('iframe[title="Oregon Zoo polar bear treadmill"]');
       assert.ok(await treadmillPlayer.isVisible(), 'treadmill video player does not require a disclosure or link click');
       assert.match(await treadmillPlayer.getAttribute('src'),/\/embed\/lff3Sca8g9M.*start=17/);
       await p.locator('[data-check="wild"]').click();assert.match(await by('check').innerText(),/did not record internal temperatures/);
       await p.locator('[data-check="breaks"]').click();assert.match(await by('check').innerText(),/^Yes/);
       await by('pattern').fill('From 0 to 24 breaks from 1.1 to 2.2 m/s.');
       await fit('Treadmill');
       await tab('human').click();assert.equal(await p.locator('iframe[data-lesson-video][src]').count(),0);assert.equal(await by('scene').getAttribute('data-running'),'false');
       const procedure=p.locator('.th-procedure');
       assert.equal(await procedure.locator('li').count(),3);
       assert.match(await procedure.innerText(),/0 min.*2 minutes.*4-, 6-, and 8-minute/s);
       assert.match(await p.locator('#human').innerText(),/skin surface.*core temperature/s);
       assert.doesNotMatch(await p.locator('#human').innerText(),/teacher.supervised|homework/i);
       assert(await by('edit').isEnabled());
       assert.equal(await by('edit').getAttribute('aria-pressed'),'true');
       if(width===1366){
         const initial=Date.now();await p.clock.setFixedTime(initial);
         await by('timer-start').click();assert.match(await by('timer-status').innerText(),/Block 1 of 4/);
         await p.clock.setFixedTime(initial+121000);
         await p.waitForFunction(()=>document.getElementById('th-timer-status').textContent.includes('Take the 2-minute reading'));
         await by('timer-clear').click();
         assert.match(await by('timer-status').innerText(),/0-minute/);
       }
       await by('sample').click();assert.match(await by('human-status').innerText(),/invented/);assert.equal(await by('human-plot').locator('circle,rect').count(),10);
       await by('edit').click();
       await tab('model').click();
       assert.match(await by('recap').innerText(),/No readings saved yet/);
       await tab('human').click();
       await p.getByLabel('Participant B at 4 minutes (°C)',{exact:true}).fill('34.1');
       await tab('model').click();
       assert.match(await by('recap').innerText(),/Participant B: 4 min: 34\.1°C/);
       assert.doesNotMatch(await by('recap').innerText(),/Participant A|No readings saved yet/);
       await tab('human').click();
       await p.getByLabel('Participant A at 0 minutes (°C)',{exact:true}).fill('32.8');
       await p.getByLabel('Participant A at 4 minutes (°C)',{exact:true}).fill('33.2');
       assert.equal(await by('human-plot').locator('circle').count(),2);
       assert.equal(await by('human-plot').locator('line').count(),0,'gap must not be imputed');
       await by('sample').click();
       assert.equal(await p.getByLabel('Participant A at 4 minutes (°C)',{exact:true}).inputValue(),'33.1');
       await by('edit').click();
       assert.equal(await p.getByLabel('Participant A at 4 minutes (°C)',{exact:true}).inputValue(),'33.2');
       await by('human-note').fill('The skin readings went up, and sweating can transfer energy.');
       await fit('Human');
       await p.reload();assert.equal(await p.getByLabel('Participant A at 4 minutes (°C)',{exact:true}).inputValue(),'33.2');
       await tab('model').click();
       const adap=p.locator('iframe[title="Polar bear adaptations"]');
       assert.ok(await adap.isVisible(), 'adaptation video player is embedded directly in Explain');
       assert.match(await adap.getAttribute('src'),/\/embed\/n3ahSPfZfqU/);
       assert.equal(await treadmillPlayer.getAttribute('src'),null,'hidden video unloads when leaving its step');
       await p.locator('[data-card="heat"]').click();await p.locator('[data-zone="matterOut"]').click();assert.match(await by('sort-status').innerText(),/try again/);
       await p.locator('[data-zone="energy"]').click();assert.match(await by('sort-status').innerText(),/Heat transferred placed/);
       for(const [c,z] of Object.entries({oxygen:'matterIn',water:'matterOut',usable:'energy',glucose:'matterIn',carbon:'matterOut'})){
         if(c==='carbon')await p.locator('[data-card="'+c+'"]').dragTo(p.locator('[data-zone="'+z+'"]'));
         else{await p.locator('[data-card="'+c+'"]').click();await p.locator('[data-zone="'+z+'"]').click();}
       }
       assert.match(await by('sort-status').innerText(),/All six cards placed/);
       assert.match(await by('recap').innerText(),/97 of 137.*24.*Participant A.*33\.2.*Participant B.*34\.1/s);
       await by('explain').fill('Heat is plausible. Measure heat and behavior in comparable wild encounters.');
       await fit('Model');
       await p.getByRole('button',{name:'Preview report',exact:true}).click();
       const report=await p.getByRole('dialog').filter({hasText:'Bear Thermoregulation Lab'}).innerText();
       assert.match(report,/117.*33\.2.*34\.1.*6 of 6.*Heat is plausible/s);
       assert.match(report,/Avery Thermal.*Class period.*2/s);
       assert.match(report,/Glucose\s+Matter in/);assert.match(report,/Water\s+Matter out/);
       assert.match(report,/Heat transferred\s+Energy transferred/);
       assert.match(report,/Required work was recorded. This does not show who did the work or how well/);
       if(width===1366){
         const [d]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.locator('dialog.osr-dialog').getByRole('button',{name:/Download.*Word/}).click()]);
         assert.equal(d.suggestedFilename(),'bear-thermoregulation-submission.docx');
         const word=fs.readFileSync(await d.path());
         const xml=unzipWord(word);
         assert.match(xml,/Required work was recorded. This does not show who did the work or how well/);
         assert.match(xml,/Glucose[\s\S]+?Matter in/);assert.match(xml,/Water[\s\S]+?Matter out/);assert.match(xml,/Heat transferred[\s\S]+?Energy transferred/);
       }
       await p.getByRole('button',{name:'Close report',exact:true}).click();
       await p.getByText('Export data from this activity only',{exact:true}).click();
       const [d]=await Promise.all([p.waitForEvent('download'),by('export-json').click()]);
       const json=JSON.parse(fs.readFileSync(await d.path(),'utf8'));
       assert.match(json.datasetId,/^TH-[A-F0-9]{8}$/);assert.deepEqual(json.student,{name:'Avery Thermal',period:'2'});
       assert.deepEqual(json.treadmill.breaks.map(r=>r.breaks),[0,7,19,24]);
       assert.equal(json.surfaceTemperatures.recorded[2].aC,33.2);assert.equal(json.surfaceTemperatures.active,'recorded');
       assert.equal(json.surfaceTemperatures.practiceInvented,undefined,'when own readings are displayed, do not silently export the invented practice data');
       assert.equal(json.matterAndEnergy.length,6);assert.equal(json.work,undefined);
       if(width===1366){
         let [file]=await Promise.all([p.waitForEvent('download'),by('export-html').click()]);
         let html=fs.readFileSync(await file.path(),'utf8');
         assert.match(html,/Recorded human surface temperatures/);assert.doesNotMatch(html,/Practice human surface temperatures/);
         await tab('human').click();await by('sample').click();await tab('model').click();
         [file]=await Promise.all([p.waitForEvent('download'),by('export-json').click()]);
         const practice=JSON.parse(fs.readFileSync(await file.path(),'utf8')).surfaceTemperatures;
         assert.equal(practice.active,'practice-invented');assert.equal(practice.recorded[2].aC,33.2);assert.notEqual(practice.practiceInvented[0].aC,practice.recorded[0].aC);
         [file]=await Promise.all([p.waitForEvent('download'),by('export-html').click()]);
         html=fs.readFileSync(await file.path(),'utf8');assert.match(html,/Practice human surface temperatures \(invented\)/);assert.match(html,/Your saved human readings/);
         await p.evaluate(()=>localStorage.setItem('aplab:openscied:neighbor:v1','Keep'));
         await by('reset').click();assert(await by('clear').isDisabled());await by('keep').click();
         assert.match(await by('explain').inputValue(),/Heat is plausible/);
         await by('reset').click();await by('reset-confirm').fill('ERASE');
         await Promise.all([p.waitForEvent('load'),by('clear').click()]);
         assert(await p.locator('#field').isVisible());assert.equal(await by('predict').inputValue(),'');
         assert.match(await by('identity').innerText(),/Avery Thermal/);
         assert.equal(await p.evaluate(()=>localStorage.getItem('aplab:openscied:neighbor:v1')),'Keep');
       }
       assert.deepEqual(errors,[]);
       console.log('Thermoregulation '+width+'px: original graph, speed data, class measurements, card sort, persistence, report');
     }finally{await ctx.close();}
   }
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
