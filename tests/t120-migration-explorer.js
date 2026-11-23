/* End-to-end checks for openscied-b1-migration.html. Screenshots are CI artifacts,
 * not content on the public site. Run with MIGRATION_SCREENSHOTS to keep images. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');const {serve}=require('./_h');
const KEY='aplab:openscied:b1-migration:v1';let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('ok: '+m);};
const shotDir=process.env.MIGRATION_SCREENSHOTS;
async function screenshot(p,name,fullPage=true){if(shotDir){fs.mkdirSync(shotDir,{recursive:true});await p.screenshot({path:path.join(shotDir,name+'.png'),fullPage});}}
const rainStations={north:'Kogatende',west:'Handajega',south:'Simiyu'};
async function stationLabels(map,label){
  const visual=await map.evaluate((root,names)=>{
    const bounds=root.querySelector('#migration-map').getBoundingClientRect();
    const result={};
    for(const [region,name] of Object.entries(names)){
      const el=root.querySelector('[data-region="'+region+'"] [data-map-station="'+region+'"]');
      const pin=el?.closest('button');
      if(!el||!el.getClientRects().length||getComputedStyle(el).visibility!=='visible'||
        el.textContent.trim()!==name||!el.id||
        !(pin?.getAttribute('aria-describedby')||'').split(/\s+/).includes(el.id))return {problem:region+' missing or not exposed'};
      const content=document.createRange();content.selectNodeContents(el);
      const r=content.getBoundingClientRect();
      if(r.width<=0||r.height<=0||r.left<bounds.left-1||r.top<bounds.top-1||
        r.right>bounds.right+1||r.bottom>bounds.bottom+1)return {problem:region+' clipped'};
      const tag=root.querySelector('.mx-map-tag')?.getBoundingClientRect();
      if(tag&&r.right>tag.left&&tag.right>r.left&&r.bottom>tag.top&&tag.bottom>r.top)
        return {problem:region+' overlaps the map caption'};
      result[region]={x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,bounds:r.toJSON()};
    }
    return result;
  },rainStations);
  ok(!visual.problem&&visual.north.y<visual.west.y&&visual.west.y<visual.south.y&&
    visual.west.x<Math.min(visual.north.x,visual.south.x),
    label+': visible rainfall names are positioned north/west/south and fully inside the map '+(visual.problem||''));
  const boxes=Object.values(visual).map(x=>x.bounds);
  ok(boxes.every((a,i)=>boxes.slice(i+1).every(b=>a.right<=b.left||b.right<=a.left||
    a.bottom<=b.top||b.bottom<=a.top)),label+': the three station names do not overlap');
}
(async()=>{const server=await serve();let browser;try{
  browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{});
  const context=await browser.newContext({viewport:{width:1366,height:960},reducedMotion:'reduce',acceptDownloads:true});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(server.url+'openscied-b1-migration.html');await p.waitForFunction(()=>document.querySelectorAll('#month-buttons button').length===12);
  ok(await p.locator('#month-title').textContent()==='January','starts at January with a complete scene');
  ok(await p.locator('#migration-map').evaluate(c=>c.width>100&&c.height>100),'map rendered at device resolution');
  ok(await p.locator('#visit-progress').textContent()==='Months with notes: 0 of 12','page load does not invent saved notes');
  await screenshot(p,'1366-light-january');
  // Browser and screenshot sweep: January, midyear, end; light and dark;
  // interactive content visible at every width, including a 200% zoom equivalent.
  for(const [width,height,dark] of [[390,844,true],[768,1024,false],[1366,768,false],[1920,1080,false],[683,768,true]]){
    await p.setViewportSize({width,height});await p.emulateMedia({colorScheme:dark?'dark':'light'});await p.goto(server.url+'openscied-b1-migration.html');await p.evaluate(d=>document.documentElement.dataset.theme=d?'dark':'light',dark);
    if(width===390||(width===1366&&height===768)){
      await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      const firstFold=await p.evaluate(()=>{
        const rect=id=>document.getElementById(id).getBoundingClientRect();
        const map=rect('migration-map');
        const controlRects=Object.fromEntries(['previous','play','month-slider','next'].map(id=>[id,rect(id).toJSON()]));
        return {fit:window.scrollY===0 && map.bottom<=innerHeight+1 && Object.values(controlRects).every(b=>
          b.width>0 && b.height>0 && b.top>=0 && b.bottom<=map.top+1),
          scroll:window.scrollY,map:map.toJSON(),controls:controlRects};
      });
      await screenshot(p,width+'-playback-viewport',false);
      ok(firstFold.fit,'playback and whole map fit first viewport at '+width+' × '+height+
        (firstFold.fit?'':' '+JSON.stringify(firstFold)));
    }
    for(const m of [0,7,11]){await p.locator(`[data-month="${m}"]`).click();await p.waitForTimeout(150);ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width+' month '+m);await screenshot(p,width+'-'+(dark?'dark':'light')+'-'+m);}
    for(const page of ['evidence','explain']){await p.locator(`[data-page="${page}"]`).click();ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no '+page+' overflow at '+width);await screenshot(p,width+'-'+page);}
    await p.locator('[data-page="explore"]').click();
    const checkStations=width===390||width===1366;
    if(checkStations)await stationLabels(p.locator('.mx-atlas #map-wrap'),width+' inline map');
    const inline=await p.locator('#migration-map').boundingBox();
    await p.locator('#enlarge').click();ok(await p.locator('#map-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2),'enlarged map fits '+width);
    if(checkStations)await stationLabels(p.locator('#map-dialog #map-wrap'),width+' enlarged map');
    if(width===390){
      ok(await p.evaluate(inlineWidth=>{
        const dlg=document.querySelector('#map-dialog');
        const map=dlg.querySelector('#migration-map').getBoundingClientRect();
        const controls=['[data-close="map-dialog"]','#large-prev','#large-next'];
        const inside=b=>b.width>0 && b.height>0 && b.left>=-1 && b.right<=innerWidth+1 && b.top>=-1 && b.bottom<=innerHeight+1;
        return dlg.open && inside(map) && map.width>=inlineWidth+12 && Math.abs(map.width-innerWidth)<=2 &&
          Math.abs(map.height-map.width*.66)<=2 && controls.every(selector=>{
            const b=dlg.querySelector(selector).getBoundingClientRect();return inside(b) && b.bottom<=map.top+1;
          });
      },inline.width),'phone dialog enlarges whole unletterboxed map with close and month controls in view');
    }
    await screenshot(p,width+'-enlarged');await p.keyboard.press('Escape');
    await p.locator('.mx-atlas #migration-map').waitFor({state:'visible',timeout:3000});
    if(width===390){
      ok(await p.locator('#enlarge').evaluate(button=>document.activeElement===button && !document.querySelector('#map-dialog').open),
        'phone dialog restores the map and focus on Escape');
      await stationLabels(p.locator('.mx-atlas #map-wrap'),'390 restored inline map');
    }
  }
  await p.evaluate(key=>localStorage.removeItem(key),KEY);await p.setViewportSize({width:1366,height:960});await p.emulateMedia({colorScheme:'light'});await p.goto(server.url+'openscied-b1-migration.html');
  for(const month of [4,7,11]){await p.locator(`[data-month="${month}"]`).click();ok((await p.locator('#month-slider').inputValue())===String(month),'month '+month+' controls agree');}
  ok(/No health cards/.test(await p.locator('#month-evidence').textContent()),'missing December health evidence is explicit');
  await p.locator('[data-month="4"]').click();ok(/95% fat/.test(await p.locator('#month-evidence').textContent()),'May source fat value matches original card');
  ok(await p.locator('#visit-progress').textContent()==='Months with notes: 0 of 12','browsing without writing does not mark saved months');
  await p.locator('#record').click();
  ok(await p.locator('#note-count').textContent()==='0'&&await p.locator('#month-note-status').textContent().then(t=>t.includes('Write an observation')),'blank month prompts for an observation without making a notebook entry');
  await p.locator('#observation').fill('Our May range is west of the southern plains.');
  ok(await p.locator('#visit-progress').textContent()==='Months with notes: 0 of 12','the autosaved draft is not counted as a notebook note');
  await p.locator('#record').click();
  ok(await p.locator('#note-count').textContent()==='1'&&await p.locator('#visit-progress').textContent()==='Months with notes: 1 of 12','note saved to notebook counts once');
  await p.locator('#record').click();
  await p.locator('#observation').fill('Our revised May observation.');await p.locator('#record').click();
  ok(await p.locator('#note-count').textContent()==='1'&&await p.locator('#record').textContent()==='Update month note','resave and edit update one stable note');
  ok(await p.evaluate(key=>{const n=JSON.parse(localStorage.getItem(key)).notes[0];return n.id==='month-4'&&n.observation==='Our revised May observation.';},KEY),'stable month ID holds the latest student observation');
  await p.locator('[data-region="north"]').click();ok(/Mara River/.test(await p.locator('#region-facts').textContent()),'region inspection displays source facts');await p.locator('#record-region').click();
  await p.locator('[data-view="rain"]').click();ok(await p.locator('#view-rain img').evaluate(i=>i.complete&&i.naturalWidth>1000),'original rainfall source image loads');await p.locator('#rain-enlarge').click();ok(await p.locator('#rain-dialog').evaluate(d=>d.open),'rainfall graph enlarges');await p.keyboard.press('Escape');
  ok(/Read the rainfall graph/.test(await p.locator('#inspector-title').textContent()),'rainfall inspector heading identifies the panel');
  ok(await p.locator('#rain-focus').textContent()==='Reading May on the original graph','rainfall focus follows May rather than showing a static unmarked graph');
  const rainPosition=await p.locator('#view-rain .mx-rain-figure').evaluate(n=>n.style.getPropertyValue('--mx-rain-month'));
  await p.locator('[data-month="7"]').click();
  ok(/Mara River/.test(await p.locator('#habitat-clue').textContent()),'the seasonal field clue explains how reliable north water supports the herd');
  ok(await p.locator('#rain-focus').textContent()==='Reading August on the original graph' &&
    rainPosition!==await p.locator('#view-rain .mx-rain-figure').evaluate(n=>n.style.getPropertyValue('--mx-rain-month')),'August moves the rainfall column outline');
  ok(/showers still reach the north/i.test(await p.locator('#weather-reading').textContent()),'dry-season north showers are explained without relying on cloud color');
  await p.locator('#weather').uncheck();
  ok(/illustrations are off/i.test(await p.locator('#weather-reading').textContent()),'weather toggle explains that cues are hidden');
  await p.locator('#weather').check();
  await p.locator('#rain-enlarge').click();
  ok(await p.locator('#rain-dialog-focus').textContent()==='Reading August on the original graph' &&
    await p.locator('#rain-dialog .mx-rain-figure').evaluate(n=>n.style.getPropertyValue('--mx-rain-month'))===
      await p.locator('#view-rain .mx-rain-figure').evaluate(n=>n.style.getPropertyValue('--mx-rain-month')),'enlarged rainfall graph highlights the same column');
  await screenshot(p,'1366-migration-rainfall-month');
  await p.keyboard.press('Escape');
  await p.locator('[data-month="6"]').click();
  ok(/Northwestern/.test(await p.locator('#season').textContent()),'July label identifies the current northwestern range before the northward shift');
  await p.locator('[data-month="11"]').click();
  ok(/Eastern corridor toward the southern plains/.test(await p.locator('#map-description').textContent()),'December describes a return toward the plains rather than arrival');
  ok(await p.locator('[data-month="4"]').count()===1&&await p.locator('#month-note-status').getAttribute('aria-pressed')===null,'saving a note does not turn status text into a month control');
  await p.locator('[data-month="4"]').click();
  await p.locator('[data-region="north"]').click();
  ok(/North · a dry-season refuge/.test(await p.locator('#inspector-title').textContent()),'inspector heading follows the selected region, not the May herd range');
  await p.locator('[data-view="field"]').click();
  ok(/Central \/ western Serengeti/.test(await p.locator('#inspector-title').textContent()),'field heading returns to the selected month and herd range');
  await p.locator('#enlarge').click();ok(await p.locator('#map-dialog #migration-map').count()===1,'same live map moves into dialog');await p.locator('#large-next').click();ok(/June/.test(await p.locator('#large-caption').textContent()),'enlarged map controls update accessible month');await p.keyboard.press('Escape');await p.waitForSelector('.mx-atlas #migration-map');ok(await p.locator('.mx-atlas #migration-map').count()===1,'Escape restores map to atlas');
  await p.locator('[data-page="evidence"]').click();ok(await p.locator('.mx-card').count()===18,'all 18 source cards rendered');
  for(const grouping of ['group','health','anthrax','month']){await p.locator('#card-sort').selectOption(grouping);ok(await p.locator('.mx-card').count()===18,'grouping by '+grouping+' retains all evidence');}
  await p.locator('#card-month').selectOption('6');ok(await p.locator('.mx-card').count()===3,'month filter limits cards to July');ok(/51%/.test(await p.locator('[data-card="m7g1"]').textContent()),'July predator card preserves 51%, not teacher summary');
  await p.locator('[data-card="m7g1"] button').click();ok(await p.locator('#note-count').textContent()==='3','source card added to notebook');
  await p.locator('#health-measure').selectOption('anthrax');ok(/anthrax/.test(await p.locator('#health-chart').textContent()),'graph switches to disease measure');
  await p.locator('#card-month').selectOption('all');ok(await p.locator('#health-chart .sim-tag-svg').count()===0,'published health evidence is not stamped simulated');await screenshot(p,'1366-light-evidence');
  await p.locator('[data-collection="rainfall"]').click();ok(/1160/.test(await p.locator('#occupancy-table').textContent()),'annual example retains verified source values');ok(/84%/.test(await p.locator('#collection-rainfall').textContent()),'selected-region percentage total explained');await p.locator('#save-rain').click();
  ok(await p.locator('#occupancy-chart .sim-tag-svg').count()===0,'published annual example is not stamped simulated');await screenshot(p,'1366-light-rainfall');
  await p.locator('[data-collection="notebook"]').click();
  const notebookDownload=p.waitForEvent('download');await p.locator('#download-notebook').click();
  const notebookFile=await notebookDownload, notebookBody=fs.readFileSync(await notebookFile.path(),'utf8');
  ok(notebookFile.suggestedFilename()==='migration-notebook.txt'&&/Our revised May observation/.test(notebookBody)&&!notebookBody.includes('MY RESPONSES'),'notebook-only file includes revised evidence without written answers');
  await p.locator('[data-page="explain"]').click();
  const chooseSet=(index,page=p)=>page.locator('#response-stage').selectOption(String(index));
  ok(await p.locator('#responses textarea:visible').count()===2&&await p.locator('#answer-question').isVisible()&&await p.locator('#response-prev').isDisabled(),'Explain starts with just the first two questions and no backward action');
  ok(await p.locator('#writing-evidence').evaluate(d=>d.open),'desktop notebook evidence is open alongside the writing set');
  await p.locator('#response-next').press('Enter');
  ok(await p.locator('#response-heading-1').evaluate(h=>document.activeElement===h)&&await p.locator('#answer-absence').isVisible(),'keyboard paging focuses the new question-set heading');
  await chooseSet(3);await p.locator('#answer-claim').fill('The cards connect nutritional health with survival; regional evidence helps explain movement.');
  // Optional evidence checks live with their written prompts and never score or edit drafts.
  await chooseSet(1);await p.locator('#answer-absence').fill('My own interpretation stays here.');
  ok(await p.locator('#response-progress').textContent()==='2 of 10 prompts answered','writing progress counts filled drafts across all sets');
  const contextual=p.locator('[data-writing-context]:visible');
  ok(await contextual.count()===1,'only the active question set exposes its evidence');
  await contextual.locator('summary').first().press('Enter');
  const healthRows=await contextual.locator('tbody tr').allTextContents();
  ok(healthRows.length===6&&/May.*95% \/ 0%.*75% \/ 0%.*90% \/ 0%/.test(healthRows[0])&&
    /July.*89% \/ 20%.*51% \/ 20%.*31% \/ 20%/.test(healthRows[2]),'Explain includes exact source health and anthrax data for the active prompts');
  await contextual.locator('summary').first().press('Enter');
  const anthrax=p.locator('[data-evidence-check="anthrax"]');
  ok(await anthrax.evaluate(el=>el.parentElement.querySelector('textarea')?.id==='answer-absence'), 'anthrax check sits beside Q4');
  await anthrax.locator('summary').press('Enter');
  const judge=anthrax.getByRole('button',{name:'Check this choice'});
  const feedback=anthrax.locator('.mx-check-feedback');
  await anthrax.locator('[value="higher-dead"]').press('Space');
  await judge.press('Enter');
  ok(await feedback.getAttribute('data-correct')==='false' && /June shows 20% in all three groups; July shows 20%/.test(await feedback.textContent()),'anthrax mistake receives a same-month comparison');
  ok(await judge.evaluate(el=>document.activeElement===el),'keyboard focus stays on the check control');
  await anthrax.locator('[value="never-mattered"]').check();
  ok(await feedback.isHidden(),'changing a choice removes stale feedback');
  await judge.click();
  ok(/cannot rule out a role/.test(await feedback.textContent()),'no group pattern is not evidence that disease never mattered');
  await anthrax.locator('[value="same-groups"]').check();await judge.click();
  ok(await feedback.getAttribute('data-correct')==='true' && /does not support anthrax as the main explanation/.test(await p.locator('#mx-status').textContent()),'retry gets actionable feedback through the existing live status');
  await anthrax.getByRole('button',{name:'Compare June anthrax cards'}).click();
  ok(await p.locator('#card-month').inputValue()==='5' && await p.locator('#health-measure').inputValue()==='anthrax' && await p.locator('.mx-card').count()===3,'review opens just the three June cards with the anthrax graph');
  await p.locator('[data-page="explain"]').click();
  ok(await p.locator('#answer-absence').inputValue()==='My own interpretation stays here.', 'formative checks do not change the written explanation');
  const nutrition=p.locator('[data-evidence-check="nutrition"]');
  await nutrition.locator('summary').click();
  await nutrition.locator('[value="all-dead-unhealthy"]').check();
  await nutrition.getByRole('button',{name:'Check this choice'}).click();
  ok(/May are labeled healthy, at 75% and 90%/.test(await nutrition.locator('.mx-check-feedback').textContent()),'nutrition feedback points out the healthy May exception');
  await chooseSet(2);
  await contextual.locator('summary').first().click();
  ok(/April range.*South and southwest Serengeti/.test(await contextual.textContent()),'rainfall explanation has the source April range without changing pages');
  const annualRows=await contextual.locator('tbody tr').evaluateAll(rows=>rows.map(row=>Array.from(row.cells,cell=>cell.textContent)));
  ok(JSON.stringify(annualRows)===JSON.stringify([['South','1160','52'],['West','1180','26'],['North','1310','6']]),'Explain shows all three verified annual observations in the same question set');
  const graphHere=contextual.getByRole('button',{name:'Open the original station graph'});
  await graphHere.click();
  ok(await p.locator('#rain-dialog').evaluate(d=>d.open)&&/Reading April/.test(await p.locator('#rain-dialog-focus').textContent())&&
    await p.locator('#explain').isVisible(),'Explain opens the original station graph focused on April without leaving the draft');
  await p.keyboard.press('Escape');
  ok(await graphHere.evaluate(b=>document.activeElement===b),'closing the source graph returns focus to the writing evidence');
  await contextual.locator('summary').first().click();
  const rainfall=p.locator('[data-evidence-check="rainfall"]');
  await rainfall.locator('summary').click();
  await rainfall.locator('[value="counterexample"]').check();
  await rainfall.getByRole('button',{name:'Check this choice'}).click();
  ok(/1,310 mm.*6% occupancy.*1,160 mm.*52% occupancy/.test(await rainfall.locator('.mx-check-feedback').textContent()),'rainfall check compares actual annual values');
  await rainfall.getByRole('button',{name:'Compare the annual rainfall and occupancy table'}).click();
  ok(await p.locator('#occupancy-table').evaluate(el=>document.activeElement===el),'rainfall review opens and focuses the source table');
  await p.locator('[data-page="explain"]').click();
  ok(await p.locator('#writing-notes .mx-note').count()===4,'saved evidence remains beside written explanations');
  await chooseSet(4);
  ok(await p.locator('#response-next').isDisabled()&&await p.locator('#answer-next').isVisible(),'final question set is reachable directly and has no forward action');
  await screenshot(p,'1366-explain-last-set');
  const downloadPromise=p.waitForEvent('download');await p.locator('#download-report').click();const download=await downloadPromise;const body=fs.readFileSync(await download.path(),'utf8');ok(body.includes('51% bone-marrow fat')&&body.includes('regional evidence helps'),'download includes source evidence and student response');ok(body.includes('illustrative, not observations'),'download distinguishes illustrative art from source data');ok(body.includes('Annual Rainfall and Wildebeest Occupancy')&&!body.includes('slides X–Y'),'annual export cites Data Excursion 2 by name');
  await p.locator('#copy-report').click();ok(await p.locator('#text-copy-field').inputValue()===body,'copyable text matches the saved investigation');await p.keyboard.press('Escape');
  await p.evaluate(()=>{window.__createExportURL=URL.createObjectURL;URL.createObjectURL=()=>{throw new Error('download unavailable');};});
  await p.locator('#download-report').click();ok(await p.locator('#text-copy-dialog').evaluate(d=>d.open)&&/could not be downloaded/.test(await p.locator('#text-copy-hint').textContent()),'automatic text fallback if file download fails');await p.keyboard.press('Escape');await p.evaluate(()=>{URL.createObjectURL=window.__createExportURL;delete window.__createExportURL;});
  await p.reload();
  ok(await p.locator('#response-stage').inputValue()==='4'&&await p.locator('#answer-next').isVisible(),'reload resumes the last question set');
  await chooseSet(3);
  ok(await p.locator('#answer-claim').inputValue()==='The cards connect nutritional health with survival; regional evidence helps explain movement.','response restored after reload');ok(await p.locator('#writing-notes .mx-note').count()===4,'notebook restored after reload');
  await p.goto(server.url+'openscied-dashboard.html');await p.waitForFunction(()=>document.querySelector('#migration-progress')?.textContent.includes('months with notes'));ok(/4 notebook entries/.test(await p.locator('#migration-progress').textContent()),'dashboard reports activity notebook progress');ok(/#explain$/.test(await p.locator('#migration-open').getAttribute('href')),'dashboard resumes saved writing section');
  const backupPromise=p.waitForEvent('download');await p.locator('#download-openscied-results').click();const backup=JSON.parse(fs.readFileSync(await (await backupPromise).path(),'utf8'));ok(backup.responses.migration.claim.includes('regional evidence helps'),'dashboard export includes explorer responses');
  await p.locator('#migration-reset').click();await p.locator('#openscied-erase-confirmation').fill('ERASE');await p.locator('#confirm-openscied-clear').click();ok(await p.evaluate(key=>localStorage.getItem(key)===null,KEY),'dashboard resets only selected activity');
  await p.setViewportSize({width:1366,height:960});await p.goto(server.url+'openscied-b1-migration.html');await p.locator('[data-page="explore"]').click();
  await p.locator('#help').click();
  ok(await p.locator('#guide').evaluate(d=>d.open)&&/Download (your|the full) investigation/i.test(await p.locator('#guide').textContent()),'field guide opens and points to the full investigation');
  await p.keyboard.press('Escape');
  ok(await p.locator('#guide').evaluate(d=>!d.open),'field guide closes with Escape');
  // Explicit play is allowed under reduced motion, but the drawn scene is still.
  await p.locator('[data-month="0"]').click();const before=await p.locator('#migration-map').evaluate(c=>c.toDataURL());await p.waitForTimeout(180);const after=await p.locator('#migration-map').evaluate(c=>c.toDataURL());ok(before===after,'reduced-motion scene is static');
  await p.locator('#month-slider').focus();await p.keyboard.press('ArrowRight');ok(await p.locator('#month-title').textContent()==='February','slider responds to keyboard');
  await p.locator('[data-month="10"]').click();await p.locator('#play').click();await p.waitForFunction(()=>document.querySelector('#play').getAttribute('aria-pressed')==='false',{},{timeout:4000});ok(await p.locator('#month-title').textContent()==='December','playback stops at end of year');
  await p.locator('#play').click();await p.locator('#play').click();ok(await p.locator('#play').getAttribute('aria-pressed')==='false','playback can pause immediately');
  const axePath=require.resolve('axe-core/axe.min.js');for(const dark of [false,true]){await p.evaluate(d=>document.documentElement.dataset.theme=d?'dark':'light',dark);for(const section of ['explore','evidence','explain']){await p.locator(`[data-page="${section}"]`).click();await p.addScriptTag({path:axePath});const violations=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});ok(!violations.length,'axe '+section+' '+(dark?'dark':'light')+' '+JSON.stringify(violations));}}
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark',reducedMotion:'reduce'});
  try {
    const phone=await touch.newPage();phone.on('pageerror',e=>errors.push(e.message));
    await phone.goto(server.url+'openscied-b1-migration.html#explain');
    ok(!await phone.locator('#writing-evidence').evaluate(d=>d.open)&&await phone.locator('#responses textarea:visible').count()===2,'phone starts with a compact evidence notebook and one question set');
    await phone.locator('#writing-evidence summary').tap();
    ok(await phone.locator('#writing-notes').isVisible(),'phone evidence notebook opens without leaving the draft');
    await phone.locator('#writing-evidence summary').tap();
    await chooseSet(4,phone);await screenshot(phone,'390-explain-last-set');
    await phone.locator('[data-page="evidence"]').tap();
    const graph=phone.locator('#health-chart-disclosure');
    ok(!await graph.evaluate(d=>d.open)&&await phone.locator('.mx-card').first().isVisible(),'phone field cards are available without scrolling past an open chart');
    await graph.locator('summary').first().tap();
    await phone.locator('#health-chart svg').first().waitFor({state:'visible'});
    ok(await graph.evaluate(d=>d.open),'phone can open and read the full graph');
    await phone.locator('[data-page="explain"]').tap();
    await chooseSet(1,phone);
    const phoneSource=phone.locator('[data-writing-context]:visible');
    await phoneSource.locator('summary').first().tap();
    ok(await phoneSource.locator('table').isVisible()&&await phoneSource.evaluate(el=>
      el.getBoundingClientRect().right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1),'phone can open and read its source excerpt beside the answer without horizontal overflow');
    await screenshot(phone,'390-dark-context-source');
    await phoneSource.locator('summary').first().tap();
    const panel=phone.locator('[data-evidence-check="anthrax"]');
    await panel.locator('summary').tap();await panel.locator('label:has([value="higher-dead"])').tap();
    await panel.getByRole('button',{name:'Check this choice'}).tap();
    ok(await panel.locator('.mx-check-feedback').isVisible(),'anthrax feedback works in touch-enabled 390px Chromium');
    ok(await panel.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1 && el.scrollWidth<=el.clientWidth+1),'open feedback fits the mobile viewport');
    await screenshot(phone,'390-dark-evidence-check');
    await phone.locator('[data-page="explore"]').tap();
    await phone.locator('#map-wrap [data-region="north"]').tap();
    ok(/North · a dry-season refuge/.test(await phone.locator('#inspector-title').textContent()),
      'station label does not take over the touch control for its mapped region');
    await stationLabels(phone.locator('.mx-atlas #map-wrap'),'touch-enabled 390 inline map');
    await phone.locator('#enlarge').tap();
    await stationLabels(phone.locator('#map-dialog #map-wrap'),'touch-enabled 390 enlarged map');
    await screenshot(phone,'390-dark-rainfall-station-map');
  } finally {await touch.close();}
  await p.evaluate(key=>localStorage.setItem(key,JSON.stringify({v:1,month:4,page:'explore',visited:[4,7],answers:{},observations:{},notes:[
    {id:'month-4-map',title:'May',text:'Map only',type:'map-observation'},
    {id:'month-4-100',title:'May',text:'Map observation.\nMy observation: Earlier observation.',type:'map-observation'},
    {id:'month-4-200',title:'May',text:'Map observation.\nMy observation: Latest saved observation.',type:'map-observation'},
    {id:'region-north',title:'North',text:'Mara River'}]})),KEY);
  await p.goto(server.url+'openscied-b1-migration.html');
  ok(await p.locator('#observation').inputValue()==='Latest saved observation.'&&await p.locator('#visit-progress').textContent()==='Months with notes: 1 of 12','legacy saved text and deduplicated progress restore');
  await p.locator('[data-page="evidence"]').click();await p.locator('[data-collection="notebook"]').click();
  ok(await p.locator('#notebook-list .mx-note').count()===2&&/Earlier observation/.test(await p.locator('#notebook-list').textContent()),'legacy notes collapse to one entry while keeping distinct earlier text and region evidence');
  const corrupted='{unreadable';await p.evaluate(({key,value})=>localStorage.setItem(key,value),{key:KEY,value:corrupted});await p.goto(server.url+'openscied-b1-migration.html');ok(/could not be read/.test(await p.locator('#mx-status').textContent()),'unreadable saved work reported');await p.locator('[data-month="4"]').click();ok(await p.evaluate(key=>localStorage.getItem(key),KEY)===corrupted,'unreadable saved record preserved');
  const moving=await browser.newContext({viewport:{width:1366,height:960},reducedMotion:'no-preference'});try{const mp=await moving.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(server.url+'openscied-b1-migration.html');await mp.locator('#migration-map').scrollIntoViewIfNeeded();await mp.waitForTimeout(180);const a=await mp.locator('#migration-map').evaluate(c=>c.toDataURL());await mp.waitForTimeout(180);const b=await mp.locator('#migration-map').evaluate(c=>c.toDataURL());ok(a!==b,'herd and weather animate when reduced motion is off');}finally{await moving.close();}
  ok(!errors.length,'no browser runtime errors: '+errors.join('; '));await context.close();console.log('migration-explorer: '+checks+'/'+checks+' checks passed');
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
