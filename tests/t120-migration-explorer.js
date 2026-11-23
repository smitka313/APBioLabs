/* End-to-end checks for openscied-b1-migration.html. Screenshots are CI artifacts,
 * not content on the public site. Run with MIGRATION_SCREENSHOTS to keep images. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');const {serve}=require('./_h');
const KEY='aplab:openscied:b1-migration:v1';let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('ok: '+m);};
const shotDir=process.env.MIGRATION_SCREENSHOTS;
async function screenshot(p,name){if(shotDir){fs.mkdirSync(shotDir,{recursive:true});await p.screenshot({path:path.join(shotDir,name+'.png'),fullPage:true});}}
(async()=>{const server=await serve();let browser;try{
  browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{});
  const context=await browser.newContext({viewport:{width:1366,height:960},reducedMotion:'reduce',acceptDownloads:true});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(server.url+'openscied-b1-migration.html');await p.waitForFunction(()=>document.querySelectorAll('#month-buttons button').length===12);
  ok(await p.locator('#month-title').textContent()==='January','starts at January with a complete scene');
  ok(await p.locator('#migration-map').evaluate(c=>c.width>100&&c.height>100),'map rendered at device resolution');
  ok(await p.locator('#visit-progress').textContent()==='0 of 12 months explored','page load does not invent visited months');
  await screenshot(p,'1366-light-january');
  for(const month of [4,7,11]){await p.locator(`[data-month="${month}"]`).click();ok((await p.locator('#month-slider').inputValue())===String(month),'month '+month+' controls agree');}
  ok(/No health cards/.test(await p.locator('#month-evidence').textContent()),'missing December health evidence is explicit');
  await p.locator('[data-month="4"]').click();ok(/95% fat/.test(await p.locator('#month-evidence').textContent()),'May source fat value matches original card');
  await p.locator('#observation').fill('Our May range is west of the southern plains.');await p.locator('#record').click();
  ok(await p.locator('#note-count').textContent()==='1','map observation saved to notebook');
  await p.locator('[data-region="north"]').click();ok(/Mara River/.test(await p.locator('#region-facts').textContent()),'region inspection displays source facts');await p.locator('#record-region').click();
  await p.locator('[data-view="rain"]').click();ok(await p.locator('#view-rain img').evaluate(i=>i.complete&&i.naturalWidth>1000),'original rainfall source image loads');await p.locator('#rain-enlarge').click();ok(await p.locator('#rain-dialog').evaluate(d=>d.open),'rainfall graph enlarges');await p.keyboard.press('Escape');
  await p.locator('#enlarge').click();ok(await p.locator('#map-dialog #migration-map').count()===1,'same live map moves into dialog');await p.locator('#large-next').click();ok(/June/.test(await p.locator('#large-caption').textContent()),'enlarged map controls update accessible month');await p.keyboard.press('Escape');ok(await p.locator('.mx-atlas #migration-map').count()===1,'Escape restores map to atlas');
  await p.locator('[data-page="evidence"]').click();ok(await p.locator('.mx-card').count()===18,'all 18 source cards rendered');
  for(const grouping of ['group','health','anthrax','month']){await p.locator('#card-sort').selectOption(grouping);ok(await p.locator('.mx-card').count()===18,'grouping by '+grouping+' retains all evidence');}
  await p.locator('#card-month').selectOption('6');ok(await p.locator('.mx-card').count()===3,'month filter limits cards to July');ok(/51%/.test(await p.locator('[data-card="m7g1"]').textContent()),'July predator card preserves 51%, not teacher summary');
  await p.locator('[data-card="m7g1"] button').click();ok(await p.locator('#note-count').textContent()==='3','source card added to notebook');
  await p.locator('#health-measure').selectOption('anthrax');ok(/anthrax/.test(await p.locator('#health-chart').textContent()),'graph switches to disease measure');
  await p.locator('#card-month').selectOption('all');await screenshot(p,'1366-light-evidence');
  await p.locator('[data-collection="rainfall"]').click();ok(/1160/.test(await p.locator('#occupancy-table').textContent()),'annual example retains verified source values');ok(/84%/.test(await p.locator('#collection-rainfall').textContent()),'selected-region percentage total explained');await p.locator('#save-rain').click();
  await screenshot(p,'1366-light-rainfall');
  await p.locator('[data-page="explain"]').click();await p.locator('#answer-claim').fill('The cards connect nutritional health with survival; regional evidence helps explain movement.');
  ok(await p.locator('#writing-notes .mx-note').count()===4,'saved evidence remains beside written explanations');
  const downloadPromise=p.waitForEvent('download');await p.locator('#download-report').click();const download=await downloadPromise;const body=fs.readFileSync(await download.path(),'utf8');ok(body.includes('51% bone-marrow fat')&&body.includes('regional evidence helps'),'download includes source evidence and student response');ok(body.includes('illustrative, not observations'),'download distinguishes illustrative art from source data');
  await p.reload();ok(await p.locator('#answer-claim').inputValue()==='The cards connect nutritional health with survival; regional evidence helps explain movement.','response restored after reload');ok(await p.locator('#writing-notes .mx-note').count()===4,'notebook restored after reload');
  await p.goto(server.url+'openscied-dashboard.html');await p.waitForFunction(()=>document.querySelector('#migration-progress')?.textContent.includes('months explored'));ok(/4 notebook entries/.test(await p.locator('#migration-progress').textContent()),'dashboard reports activity notebook progress');ok(/#explain$/.test(await p.locator('#migration-open').getAttribute('href')),'dashboard resumes saved writing section');
  const backupPromise=p.waitForEvent('download');await p.locator('#download-openscied-results').click();const backup=JSON.parse(fs.readFileSync(await (await backupPromise).path(),'utf8'));ok(backup.responses.migration.claim.includes('regional evidence helps'),'dashboard export includes explorer responses');
  await p.locator('#migration-reset').click();await p.locator('#openscied-erase-confirmation').fill('ERASE');await p.locator('#confirm-openscied-clear').click();ok(await p.evaluate(key=>localStorage.getItem(key)===null,KEY),'dashboard resets only selected activity');
  // Browser and screenshot sweep: January, midyear, end; light and dark;
  // interactive content visible at every width, including a 200% zoom equivalent.
  for(const [width,height,dark] of [[390,844,true],[768,1024,false],[1366,768,false],[1920,1080,false],[683,768,true]]){
    await p.setViewportSize({width,height});await p.emulateMedia({colorScheme:dark?'dark':'light'});await p.goto(server.url+'openscied-b1-migration.html');await p.evaluate(d=>document.documentElement.dataset.theme=d?'dark':'light',dark);
    for(const m of [0,7,11]){await p.locator(`[data-month="${m}"]`).click();await p.waitForTimeout(150);ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width+' month '+m);await screenshot(p,width+'-'+(dark?'dark':'light')+'-'+m);}
    for(const page of ['evidence','explain']){await p.locator(`[data-page="${page}"]`).click();ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no '+page+' overflow at '+width);await screenshot(p,width+'-'+page);}
    await p.locator('[data-page="explore"]').click();await p.locator('#enlarge').click();ok(await p.locator('#map-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2),'enlarged map fits '+width);await screenshot(p,width+'-enlarged');await p.keyboard.press('Escape');
  }
  await p.setViewportSize({width:1366,height:960});await p.locator('[data-page="explore"]').click();
  // Explicit play is allowed under reduced motion, but the drawn scene is still.
  await p.locator('[data-month="0"]').click();const before=await p.locator('#migration-map').evaluate(c=>c.toDataURL());await p.waitForTimeout(180);const after=await p.locator('#migration-map').evaluate(c=>c.toDataURL());ok(before===after,'reduced-motion scene is static');
  await p.locator('#month-slider').focus();await p.keyboard.press('ArrowRight');ok(await p.locator('#month-title').textContent()==='February','slider responds to keyboard');
  await p.locator('[data-month="10"]').click();await p.locator('#play').click();await p.waitForFunction(()=>document.querySelector('#play').getAttribute('aria-pressed')==='false',{},{timeout:4000});ok(await p.locator('#month-title').textContent()==='December','playback stops at end of year');
  await p.locator('#play').click();await p.locator('#play').click();ok(await p.locator('#play').getAttribute('aria-pressed')==='false','playback can pause immediately');
  const axePath=require.resolve('axe-core/axe.min.js');for(const dark of [false,true]){await p.evaluate(d=>document.documentElement.dataset.theme=d?'dark':'light',dark);for(const section of ['explore','evidence','explain']){await p.locator(`[data-page="${section}"]`).click();await p.addScriptTag({path:axePath});const violations=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});ok(!violations.length,'axe '+section+' '+(dark?'dark':'light')+' '+JSON.stringify(violations));}}
  const corrupted='{unreadable';await p.evaluate(({key,value})=>localStorage.setItem(key,value),{key:KEY,value:corrupted});await p.goto(server.url+'openscied-b1-migration.html');ok(/could not be read/.test(await p.locator('#mx-status').textContent()),'unreadable saved work reported');await p.locator('[data-month="4"]').click();ok(await p.evaluate(key=>localStorage.getItem(key),KEY)===corrupted,'unreadable saved record preserved');
  ok(!errors.length,'no browser runtime errors: '+errors.join('; '));await context.close();console.log('migration-explorer: '+checks+'/'+checks+' checks passed');
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
