'use strict';

const { verifySaveConflict } = require('./openscied-b4-save-conflict-check');

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { verifyLongResponse, writePrintPreview } = require('./openscied-b4-written-response-check');
const { ROOT, serve } = require('./_h');

const PAGE = 'openscied-b4-junco.html';
const SAVE = 'aplab:openscied:b4-junco:v1';
const AXE = require.resolve('axe-core/axe.min.js');
const OUT = path.join(ROOT, 'artifacts', 'openscied-b4-junco');
const SIZES = [
  { width:390, height:844, touch:true, dark:true, deep:true },
  { width:768, height:1024 },
  { width:1366, height:768, deep:true },
  { width:1920, height:1080 }
];
const CLAIM = 'Comparing birds raised under the same aviary conditions helps tell inherited and learned differences apart.';
const LIMIT = 'The plot shows an association; a difference in CORT by itself does not prove a cause.';
const OBSERVATION = 'Across the field comparisons, the birds from UC San Diego generally flew after people got closer.';
const tidy = value => (value || '').replace(/\s+/g, ' ').trim();
const id = (page, name) => page.locator('#' + name);
const stepControl = (page, step) => page.locator('button[data-step="'+step+'"]').first();
const readSaved = page => page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),SAVE);
let checks = 0;
function check(condition, detail) {
  assert.ok(condition,detail);
  checks++;
  console.log('ok: '+detail);
}
async function activate(control,size) {
  if(size.touch) await control.tap();
  else await control.press('Enter');
}
async function plottedMeans(table) {
  const rows=await table.locator('tbody tr').evaluateAll(rows=>rows.map(row=>[
    row.cells[0].textContent.trim(),Number(row.cells[1].textContent.trim().replace('−','-'))
  ]));
  return Object.fromEntries(rows);
}
async function selectStep(page,size,step) {
  await activate(stepControl(page,step),size);
  await id(page,step).waitFor({state:'visible'});
}
async function fits(page,selector,label) {
  const overflow=await page.locator(selector).evaluateAll(nodes=>{
    const edge=document.documentElement.clientWidth;
    return nodes.flatMap(node=>{
      const box=node.getBoundingClientRect();
      return box.width&&box.height&&(box.left<-1||box.right>edge+1)?[node.id||node.tagName]:[];
    });
  });
  check(!overflow.length && await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    label+' no horizontal clipping '+overflow.join(', '));
}
async function a11y(page,scope,label) {
  if(!await page.evaluate(()=>Boolean(window.axe))) await page.addScriptTag({path:AXE});
  const issues=await page.evaluate(async scope=>{
    const result=await window.axe.run(scope,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},resultTypes:['violations']});
    return result.violations.map(violation=>[violation.id,violation.nodes.map(node=>node.target)]);
  },scope);
  check(!issues.length,label+' accessibility '+JSON.stringify(issues));
}
async function shoot(page,label,anchor) {
  await id(page,anchor).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(OUT,label+'.png'),animations:'disabled',timeout:15000});
}
async function download(page,size) {
  await id(page,'ju-name').fill('J. Student');
  await id(page,'ju-period').fill('4');
  const backups=id(page,'ju-other-downloads');
  check(!await id(page,'ju-download').isVisible(),'plain-text download is hidden with backups collapsed');
  await activate(backups.locator('summary'),size);
  const fileEvent=page.waitForEvent('download');
  await activate(id(page,'ju-download'),size);
  const file=await fileEvent;
  check(/junco.*\.(txt|json|md)$/i.test(file.suggestedFilename()),'the student receives a named junco work export');
  const saved=await fs.readFile(await file.path(),'utf8');
  check(saved.includes(CLAIM)&&saved.includes(LIMIT)&&saved.includes(OBSERVATION)&&saved.includes('Name: J. Student')&&saved.includes('Class period: 4'),
    'the downloaded file contains the original field observation, claim, and limitation');
}

async function exerciseFlightSimulation(page,size,label) {
  const panel=id(page,'ju-field-simulation');
  const site=id(page,'ju-sim-site'), group=id(page,'ju-sim-context');
  const start=id(page,'ju-sim-start'), approach=id(page,'ju-sim-approach');
  const bird=id(page,'ju-sim-bird'), distance=id(page,'ju-sim-distance');
  const publishedGroup=id(page,'ju-field-group');
  const publishedTable=id(page,'ju-field-table');
  const rows=()=>id(page,'ju-sim-trials').locator('tbody tr[data-trial]').evaluateAll(rows=>rows.map(row=>[
    row.getAttribute('data-trial'),Array.from(row.cells,cell=>cell.textContent.trim())
  ]));
  const state=()=>bird.evaluate(el=>el.dataset.state??el.querySelector('[data-state]')?.getAttribute('data-state'));
  const meters=async()=>{
    const text=tidy(await distance.textContent());
    const result=text.match(/(\d+(?:\.\d+)?)\s*(?:m\b|meters?\b)/i);
    assert.ok(result,label+' simulator distance includes meters: '+text);
    return Number(result[1]);
  };
  const initialGroup=await publishedGroup.inputValue();
  const published=await plottedMeans(publishedTable);
  check(!await panel.evaluate(el=>el.open)&&await start.isHidden(),
    label+' the simulated field visit is optional and not run on load');
  await activate(panel.locator('summary').first(),size);
  await start.waitFor({state:'visible'});
  check((await rows()).length===0,label+' opening the simulation does not invent a trial');

  async function runFlight(n,siteChoice,contextChoice,begin,step) {
    await site.selectOption(siteChoice);
    await group.selectOption(contextChoice);
    await activate(start,size);
    check(await state()==='stay'&&await meters()===begin&&await start.isDisabled()&&
      new RegExp('\\bTrial '+n+'\\b','i').test(await id(page,'ju-sim-status').textContent())&&(await rows()).length===n-1,
    label+' trial '+n+' starts with the bird still perched at '+begin+' m and no extra result');
    if(n===1) {
      await fits(page,'#ju-field-simulation, #ju-sim-frame, #ju-sim-start, #ju-sim-approach',label+' running simulator');
      await shoot(page,label+'-1a-flight-start','ju-sim-frame');
    }
    let traveled=begin;
    for(let attempt=0;attempt<Math.ceil(begin/step)&&await state()==='stay';attempt++) {
      await activate(approach,size);
      if (await state()==='stay') check(/stayed put.*Select Approach to move .* closer/i.test(await id(page,'ju-sim-status').textContent()),
        label+' a bird that stays put gives a specific next action');
      const now=await meters();
      assert.ok(Math.abs(now-Math.max(0,traveled-step))<1e-6,
        label+' each approach in '+contextChoice+' is exactly '+step+' m');
      traveled=now;
    }
    const recorded=await rows();
    check(await state()==='flying'&&await approach.isDisabled()&&await start.isEnabled()&&
      recorded.length===n&&recorded.at(-1)[0]===String(n),
      label+' takeoff in trial '+n+' records exactly once and enables the next trial');
    const ended=recorded.at(-1)[1];
    check(new RegExp(siteChoice==='urban'?'San Diego|urban':'Laguna|mountain','i').test(ended.join(' '))&&
      Math.abs(parseFloat(ended.at(-1))-traveled)<1e-6,
      label+' the simulated record shows the selected population and measured takeoff distance');
  }

  await runFlight(1,'urban','foraging',20,2);
  check(await site.inputValue()==='urban'&&await group.inputValue()==='foraging'&&/next trial/i.test(await start.textContent()),
    label+' starting another trial is explicit and keeps the chosen settings until changed');
  await runFlight(2,'mountain','incubating',2,0.2);
  const completed=await rows();
  if(size.width===390) {
    const trialTable=id(page,'ju-sim-trials');
    check(await trialTable.getByRole('columnheader',{name:'Trial',exact:true}).count()===1,
      label+' the compact number heading keeps the accessible name Trial');
    await page.setViewportSize({width:375,height:size.height});
    const logFit=await trialTable.evaluate(el=>{
      const pane=el.closest('details'), context=[...el.querySelectorAll('tbody td')].find(cell=>cell.textContent==='Incubating');
      if(!pane||!context) return false;
      const range=document.createRange(); range.selectNodeContents(context);
      return el.getBoundingClientRect().right<=pane.getBoundingClientRect().right+1
        && document.documentElement.scrollWidth<=innerWidth+1 && range.getClientRects().length===1;
    });
    check(logFit,label+' the trial table fits at 375 px and keeps Incubating readable on one line');
    await page.setViewportSize({width:size.width,height:size.height});
  }
  await shoot(page,label+'-1b-flight-finished','ju-sim-frame');
  await a11y(page,'#ju-field-simulation',label+' optional field simulation');
  check(await publishedGroup.inputValue()===initialGroup&&
    JSON.stringify(await plottedMeans(publishedTable))===JSON.stringify(published),
    label+' the simulated choices and results do not change the published evidence');
  await activate(start,size);
  const change=id(page,'ju-sim-change');
  check(await change.isVisible()&&await site.isDisabled(),label+' an unstarted setup error can be corrected');
  await activate(change,size);
  check(await site.isEnabled()&&await approach.isDisabled()&&(await rows()).length===2,label+' cancel unlocks setup without discarding or adding records');
  await site.selectOption('urban');
  await page.reload();
  await id(page,'field').waitFor({state:'visible'});
  if(!await panel.evaluate(el=>el.open)) await activate(panel.locator('summary').first(),size);
  check(JSON.stringify(await rows())===JSON.stringify(completed),label+' both completed simulated trials return after reload');
}

async function exercise(browser,base,size) {
  const label=size.width+(size.dark?'-dark':'-light');
  const context=await browser.newContext({
    viewport:{width:size.width,height:size.height},
    colorScheme:size.dark?'dark':'light',
    hasTouch:!!size.touch,reducedMotion:'reduce',acceptDownloads:true
  });
  const origin=new URL(base).origin;
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(8000);
  try {
    if(size.deep) {
      await page.goto(new URL(PAGE+'#cort',base).href);
      check(await id(page,'cort').isHidden()&&await id(page,'ju-aviary-results').isHidden(),
        label+' a fresh direct CORT link cannot bypass the aviary prediction and reveal');
      await page.evaluate(key=>localStorage.removeItem(key),SAVE);
    }
    await page.goto(new URL(PAGE,base).href);
    await id(page,'field').waitFor({state:'visible'});
    await fits(page,'main, #field',label+' field step');
    await shoot(page,label+'-1-field','field');
    if(size.deep) {
      await a11y(page,'#field',label+' field step');
      const group=id(page,'ju-field-group'), table=id(page,'ju-field-table');
      await group.selectOption('foraging');
      const foraging=await plottedMeans(table);
      await group.selectOption('incubating');
      const incubating=await plottedMeans(table);
      check(foraging['UC San Diego']===4.2&&foraging['Mt. Laguna']===13.5&&
        incubating['UC San Diego']===0.36&&incubating['Mt. Laguna']===0.99,
        label+' the field table retains the published figure’s estimated meters under both group choices');
      await id(page,'ju-field-entry').fill(OBSERVATION);
      await exerciseFlightSimulation(page,size,label);
    }
    await selectStep(page,size,'aviary');
    check(await id(page,'ju-aviary-results').isHidden(),label+' aviary evidence starts concealed');
    const art=id(page,'ju-aviary-art');
    const savedBeforeControl=await readSaved(page);
    await activate(art.getByRole('button',{name:'Food',exact:true}),size);
    check(await art.getAttribute('data-control')==='food' &&
      await art.locator('.ju-aviary-ring--food:visible').count()===2 &&
      /wood shavings, not food/.test(await id(page,'ju-aviary-detail').innerText()),
      label+' opens the matched food note and highlights both dishes');
    await fits(page,'#ju-aviary-art, .ju-aviary-drawing, .ju-aviary-controls button',label+' aviary cutaway');
    await shoot(page,label+'-2-aviary-controls','ju-aviary-art');
    const routineButton=id(page,'ju-aviary-replay');
    const routineCaption=id(page,'ju-aviary-routine-caption');
    const transforms=cls=>art.locator('.ju-aviary-'+cls).evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).transform));
    const opacity=cls=>art.locator('.ju-aviary-'+cls).evaluateAll(nodes=>nodes.map(node=>Number(getComputedStyle(node).opacity)));
    await activate(routineButton,size);
    check(await art.getAttribute('data-routine')==='approach' &&
      /Approach both enclosures/.test(await routineCaption.innerText()) &&
      (await transforms('caretaker')).every(transform=>transform!=='none') &&
      (await opacity('seeds')).every(value=>value===0),
      label+' starts both caretakers toward dishes that are still empty, with a text caption');
    await activate(routineButton,size);
    check(await art.getAttribute('data-routine')==='refill' &&
      await art.locator('[data-aviary-stage=refill]').getAttribute('aria-current')==='step' &&
      (await opacity('seeds')).every(value=>value===1) && (await opacity('pour')).every(value=>value===1),
      label+' makes both pours and refilled dishes visible in the reduced-motion frame');
    await shoot(page,label+'-2a-aviary-refill','ju-aviary-art');
    await activate(routineButton,size);
    check(await art.getAttribute('data-routine')==='matched' &&
      /reactions were not measured/.test(await routineCaption.innerText()) &&
      (await transforms('bird')).every(transform=>transform!=='none') &&
      (await opacity('match')).every(value=>value===1),
      label+' finishes on both birds by their food dishes without presenting the action as evidence');
    await shoot(page,label+'-2b-aviary-matched','ju-aviary-art');
    await activate(routineButton,size);
    check(await art.getAttribute('data-routine')==='approach' &&
      (await transforms('bird')).every(transform=>transform==='none') &&
      (await opacity('seeds')).every(value=>value===0),
      label+' replays with birds on the perch and dishes empty again');
    await activate(art.getByRole('button',{name:'Food',exact:true}),size);
    check(await art.getAttribute('data-routine')==='idle' &&
      await art.locator('.ju-aviary-ring--food:visible').count()===2,
      label+' inspecting a control resets the replay caption and highlights');
    if(size.width===1366){
      await page.emulateMedia({reducedMotion:'no-preference'});
      await activate(routineButton,size);
      const waitPhase=key=>page.waitForFunction(phase=>document.getElementById('ju-aviary-art').dataset.routine===phase,key);
      await waitPhase('refill');
      await page.waitForFunction(()=>[...document.querySelectorAll('.ju-aviary-pour')].every(node=>Number(getComputedStyle(node).opacity)>0.8));
      check(await art.getAttribute('data-routine')==='refill',
        label+' makes both seed streams visibly pour during normal playback');
      await waitPhase('matched');
      await page.waitForFunction(()=>[...document.querySelectorAll('.ju-aviary-bird')].every(node=>getComputedStyle(node).transform==='matrix(1, 0, 0, 1, -36, 40)'));
      check((await opacity('seeds')).every(value=>value===1) &&
        /Same routine for both groups/.test(await routineCaption.innerText()),
        label+' holds the birds at the dishes and preserves the explanation after motion');
      assert.deepEqual(await readSaved(page),savedBeforeControl,label+' normal playback also leaves progress untouched');
      await activate(routineButton,size);
      await selectStep(page,size,'field');
      await selectStep(page,size,'aviary');
      check(await art.getAttribute('data-routine')==='idle' && !await id(page,'ju-live').innerText(),
        label+' navigating away cancels the routine and clears its announcements');
      await page.emulateMedia({reducedMotion:'reduce'});
    }
    if(size.width!==1366)assert.deepEqual(await readSaved(page),savedBeforeControl,label+' the illustration does not change progress or answers');
    check(await id(page,'ju-aviary-results').isHidden(),label+' no results reveal when inspecting the setup');
    const reveal=id(page,'ju-reveal');
    check(await reveal.isDisabled(),label+' a choice is required before revealing aviary evidence');
    const prediction=id(page,'ju-prediction');
    await prediction.selectOption('same');
    await activate(reveal,size);
    await id(page,'ju-aviary-results').waitFor({state:'visible'});
    const afterReveal=await readSaved(page);
    check(afterReveal?.revealed===true&&afterReveal?.prediction==='same',label+' a genuine prediction and reveal are saved');
    await fits(page,'main, #aviary, #ju-aviary-results',label+' aviary evidence');
    await shoot(page,label+'-2-aviary','ju-aviary-results');
    if(size.deep) {
      await a11y(page,'#aviary',label+' aviary evidence');
      const group=id(page,'ju-aviary-group'), table=id(page,'ju-aviary-table');
      await group.selectOption('female');
      const female=await plottedMeans(table);
      await group.selectOption('male');
      const male=await plottedMeans(table);
      check(female['UC San Diego']===-0.08&&female['Mt. Laguna']===-0.65&&male['UC San Diego']===0.8&&male['Mt. Laguna']===-0.32,
        label+' both aviary groups retain the estimated signed exploration scores for each origin');
    }
    await activate(id(page,'ju-to-cort'),size);
    await id(page,'cort').waitFor({state:'visible'});
    const chart=id(page,'ju-chart');
    await chart.locator('svg').first().waitFor({state:'visible'});
    const guide=page.getByRole('region',{name:'How to read this graph'});
    check(await guide.isVisible() &&
      /15 and 30 minutes after capture/.test(await guide.innerText()) &&
      /38\.4 ng\/mL and −0\.8/.test(await guide.innerText()),
      label+' the visible CORT graph reading guide describes both tests and a real example dot');
    await fits(page,'main, #cort, #ju-chart-guide, #ju-chart, #ju-claim, #ju-limits',label+' CORT comparison');
    await shoot(page,label+'-3a-cort-guide','ju-chart-guide');
    await shoot(page,label+'-3-cort','ju-chart');
    await verifyLongResponse(page,id(page,'ju-claim'),{
      name:/How did the aviary results change or support your explanation/i,
      touch:size.touch, screenshot:path.join(OUT,label+'-long-response.png')
    });
    check(true,label+' a six-line response remains editable with a visible first line when returning to its start');
    if(size.width===1366) await writePrintPreview(page,'#cort',path.join(OUT,label+'-print-preview.pdf'));
    await id(page,'ju-claim').fill('');
    if(size.deep) {
      await a11y(page,'#cort',label+' CORT comparison');
      await verifyCortData(page,label);
      check((await id(page,'ju-saved-observation').textContent()).includes(OBSERVATION),
        label+' the student’s earlier field observation returns beside the CORT writing');
      await id(page,'ju-claim').fill(CLAIM);
      await id(page,'ju-limits').fill(LIMIT);
      const saved=await readSaved(page);
      check(saved?.step==='cort'&&saved?.claim===CLAIM&&saved?.limits===LIMIT,
        label+' the CORT step and both responses are autosaved');
      await page.reload();
      await id(page,'cort').waitFor({state:'visible'});
      check(await id(page,'ju-claim').inputValue()===CLAIM&&await id(page,'ju-limits').inputValue()===LIMIT&&
        await id(page,'ju-fit').isChecked(),label+' both written responses and the fit setting return without another reveal');
      if(size.width===1366) await download(page,size);
    }
    check(errors.length===0,label+' no uncaught browser errors '+errors.join(', '));
  } catch(error) {
    await page.screenshot({path:path.join(OUT,label+'-failure.png'),animations:'disabled',timeout:10000}).catch(()=>{});
    throw error;
  } finally {
    await context.close();
  }
}

async function verifyCortData(page,label) {
  const filter=id(page,'ju-filter');
  const origins=await id(page,'ju-cort-table').locator('tbody tr[data-site]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-site')));
  check(await filter.isDisabled()&&await filter.inputValue()==='all'&&
    origins.length===40&&origins.every(site=>site==='all'),
    label+' all 40 digitized points are available without pretending the birds\' sites can be separated');
  const status=tidy(await id(page,'ju-cort-status').textContent());
  check(/40 birds shown/.test(status)&&/correlation r\s*=\s*[−-]0\.53\b/.test(status)&&/digitized|reconstructed|approximate/i.test(status),
    label+' the graph describes the published figure’s approximate data and negative association');
  await id(page,'ju-fit').check();
  check((await readSaved(page))?.fit===true && await id(page,'ju-chart').locator('svg').first().isVisible(),
    label+' the optional fit control updates the CORT view and saves the choice');
  const references=await id(page,'ju-source-data').locator('a').evaluateAll(links=>links.map(link=>link.href));
  check(references.length===3&&references.every(href=>/^https:\/\//.test(href)),
    label+' the field, shared-aviary, and CORT evidence each link to a source');
}

(async()=>{
  const server=await serve();
  let browser;
  try{
    const executablePath=process.env.CHROMIUM_PATH||process.env.CHROMIUM_EXECUTABLE;
    browser=await chromium.launch(executablePath?{executablePath}:{});
    await fs.mkdir(OUT,{recursive:true});
    for(const size of SIZES) await exercise(browser,server.url,size);
    await verifySaveConflict(browser, server.url, {
      file:PAGE, key:SAVE, warning:'#ju-save-warning', backup:'#ju-download-tab', check,
      async edit(page,n){ await page.locator('#ju-field-entry').fill('Field note '+n); },
      read:saved=>Number(saved?.observation?.match(/\d+$/)?.[0]), draft:/Field note 2/
    });
    console.log('openscied-b4-junco-browser: '+checks+' checks passed');
  }finally{
    if(browser) await browser.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
