'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
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
  const fileEvent=page.waitForEvent('download');
  await activate(id(page,'ju-download'),size);
  const file=await fileEvent;
  check(/junco.*\.(txt|json|md)$/i.test(file.suggestedFilename()),'the student receives a named junco work export');
  const saved=await fs.readFile(await file.path(),'utf8');
  check(saved.includes(CLAIM)&&saved.includes(LIMIT)&&saved.includes(OBSERVATION),
    'the downloaded file contains the original field observation, claim, and limitation');
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
    }
    await selectStep(page,size,'aviary');
    check(await id(page,'ju-aviary-results').isHidden(),label+' aviary evidence starts concealed');
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
    await fits(page,'main, #cort, #ju-chart, #ju-claim, #ju-limits',label+' CORT comparison');
    await shoot(page,label+'-3-cort','ju-chart');
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
    console.log('openscied-b4-junco-browser: '+checks+' checks passed');
  }finally{
    if(browser) await browser.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
