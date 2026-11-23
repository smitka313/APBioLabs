'use strict';

// Exercise the actual classroom path, state persistence and locally generated report.
// Independent table inspection ties every chart, comparison and export to its raw data.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { ROOT, serve } = require('./_h');

const FILE = 'openscied-b3-cancer-rates.html';
const SAVE = 'aplab:openscied:b3-cancer-rates:v1';
const OUT = path.join(ROOT, 'artifacts', 'openscied-cancer-rates');
const AXE = require.resolve('axe-core/axe.min.js');
const CASES = [
  { width: 390, height: 844, dark: true, touch: true, deep: true },
  { width: 768, height: 1024 },
  { width: 1366, height: 768, deep: true },
  { width: 1920, height: 1080 }
];
const REASON = 'Different things may affect how often a cancer is diagnosed and how often people die from it.';
const CLAIM = 'In my comparison, a higher diagnosis rate was not enough to establish why the groups differed.';
const LIMIT = 'The data compare populations and cannot tell us the cause or predict what will happen to one person.';
const RET_NOTES = {
  access:'Compare local facility listings and note that they do not give appointment availability.',
  cost:'4.75',
  visible:'4',
  trials:'5',
  quality:'Ask a second group to repeat and document the observations.',
  durability:'Check that the classroom model still works after repeated use.',
  recommendation:'Compare the classroom evidence before deciding which model to recommend.'
};
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const view = (page, id) => page.locator('#' + id);
const record = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), SAVE);
const snapshot = page => page.locator('#cr-table tbody [data-row-id]').evaluateAll(rows => rows.map(row => ({
  id: row.getAttribute('data-row-id'),
  cells: Array.from(row.cells).map(cell => cell.textContent.replace(/\s+/g, ' ').trim())
})));
const numeric = value => {
  const s = String(value).replace(/,/g, '').trim();
  return /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
};
const valueAppears = (text, value) => {
  const expected = numeric(value);
  return expected !== null && (String(text).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).some(part => numeric(part) === expected);
};
let count = 0;
function check(ok, label) {
  assert.ok(ok, label);
  count++;
  console.log('ok: ' + label);
}

async function invoke(control, size) {
  if (size.touch) await control.tap();
  else await control.press('Enter');
}
async function visible(page, id) {
  await view(page, id).waitFor({ state:'visible' });
}
async function fits(page, selectors, label) {
  const faults = await page.locator(selectors).evaluateAll(elements => {
    const width = document.documentElement.clientWidth;
    return elements.flatMap(el => {
      const r = el.getBoundingClientRect();
      return (r.width && r.height && (r.left < -1 || r.right > width + 1)) ? [el.id || el.tagName] : [];
    });
  });
  check(faults.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    label + ' fits without sideways scrolling: ' + faults.join(', '));
}
async function capture(page, label, anchor) {
  if (anchor) await page.locator(anchor).scrollIntoViewIfNeeded();
  else await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, label + '.png'), animations:'disabled', timeout:15000 });
}
async function a11y(page, selector, label) {
  if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ path:AXE });
  const faults = await page.evaluate(async selector => {
    const result = await window.axe.run(selector, {
      runOnly: { type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa'] },
      resultTypes:['violations']
    });
    return result.violations.map(violation => [violation.id, violation.nodes.map(node => node.target)]);
  }, selector);
  check(faults.length === 0, label + ' accessibility: ' + JSON.stringify(faults));
}

async function topRank(page) {
  const all = await snapshot(page);
  const ranked = all.find(row => /^\s*#?1\s*$/.test(row.cells[0]));
  assert.ok(ranked, 'table exposes the actual first-ranked row');
  return { id:ranked.id, label:ranked.cells[1], incidence:numeric(ranked.cells[2]), mortality:numeric(ranked.cells[3]) };
}
async function waitForNamedRows(page, expected) {
  await page.waitForFunction(names => {
    const rows = Array.from(document.querySelectorAll('#cr-table tbody [data-row-id]'));
    return names.every(name => rows.some(row => row.cells[1]?.textContent.includes(name)));
  }, expected);
}

async function verifySort(page, size) {
  const selectors = await page.locator('#cr-table button[data-sort]').evaluateAll(buttons =>
    buttons.map(btn => ({ attr:btn.getAttribute('data-sort'), index:btn.closest('th')?.cellIndex })));
  const measure = selectors.find(x => x.index === 2);
  assert.ok(measure, 'diagnosis-rate column can be sorted through a native button');
  const button = page.locator('#cr-table button[data-sort="' + measure.attr + '"]');
  const before = await snapshot(page);
  await invoke(button, size);
  const first = await snapshot(page);
  // Some implementations apply a column's default direction on its first press.
  // Press a third time only if the first press repeated the initial direction.
  await invoke(button, size);
  let second = await snapshot(page);
  if (first.map(x=>x.id).join() === second.map(x=>x.id).join()) {
    await invoke(button, size);
    second = await snapshot(page);
  }
  const scores = rows => rows.map(row => numeric(row.cells[2])).filter(n => n !== null);
  const asc = values => values.every((value, i) => i===0 || value >= values[i-1]);
  const desc = values => values.every((value, i) => i===0 || value <= values[i-1]);
  const a = scores(first), b = scores(second);
  check(a.length > 2 && b.length > 2 && a[0] !== b[0] && ((asc(a) && desc(b)) || (desc(a) && asc(b))),
    'repeated rate-header activation sorts real numbers both directions');
  // The implementation may paginate; matching rows must not change source values.
  const present = new Map(before.map(row=>[row.id,row.cells.slice(2)]));
  check(first.every(row => !present.has(row.id) || JSON.stringify(row.cells.slice(2)) === JSON.stringify(present.get(row.id))),
    'sorting preserves the published values of every row tested');
  check(['ascending','descending'].includes(await button.locator('xpath=..').getAttribute('aria-sort')),
    'the selected table header conveys sort direction to assistive technology');
}

async function inspectPoverty(page, label) {
  await view(page, 'cr-view').selectOption('poverty');
  const search = view(page, 'cr-search');
  const trend = view(page,'cr-trend');
  await trend.check();
  const fit = page.locator('#cr-chart .cr-fit');
  check(await page.locator('#cr-chart .cr-scatter').isVisible() && await fit.count() === 1,
    label+' optionally fits a trend to the state socioeconomic scatter');
  await search.fill('Michigan');
  await waitForNamedRows(page,['Michigan']);
  const rows = await snapshot(page);
  const poverty = Number(rows[0]?.cells[3]?.replace(/%/g,''));
  check(rows.length === 1 && rows[0].cells[1].includes('Michigan') &&
    numeric(rows[0].cells[2]) === 457.4 && poverty === 13.5,
  label+' socioeconomic view pairs the published Michigan diagnosis rate with its observed Census poverty estimate');
  const chart = view(page,'cr-chart');
  check(await chart.isVisible(),label+' socioeconomic view shows an interactive chart rather than only a table');
  check(await fit.count() === 0,label+' a one-state filter cannot draw a trend line');
  await fits(page,'main, #explore, #cr-chart, #cr-search',label+' socioeconomic view');
  await search.clear();
  await capture(page,label+'-poverty','#cr-chart');
  const socio = view(page,'cr-socio');
  await socio.selectOption('income');
  await search.fill('Michigan');
  check(numeric((await snapshot(page))[0]?.cells[3]?.replace(/\$/g,''))===69183,
    label+' changes the scatter x-axis and table to the published median household income');
  await search.clear();
  const marks = view(page,'cr-marks');
  await marks.uncheck();
  check(await page.locator('[data-point]').count()===0 && await fit.count()===1,
    label+' can hide data marks without losing the independently selected trend layer');
  await marks.check();
  check(await page.locator('[data-point]').count()===51,label+' restores all state and D.C. marks');
  await trend.uncheck();
  check(await fit.count()===0,label+' can turn the trend layer off again');
}

async function inspectRace(page, label) {
  await view(page, 'cr-view').selectOption('race');
  await view(page, 'cr-measure').selectOption('mortality');
  await waitForNamedRows(page,['Alaska Native','Black','White']);
  const rows = new Map((await snapshot(page)).map(row=>[row.id,row]));
  const refs = [
    ['ai-an',497.8,178.1],['black',467.7,168.6],['white',482.2,151.3]
  ];
  check(refs.every(([id,incidence,mortality]) =>
    numeric(rows.get(id)?.cells[2])===incidence && numeric(rows.get(id)?.cells[3])===mortality),
  label+' race and ethnicity view matches published national age-adjusted rates');
  await view(page,'cr-compare-a').selectOption('ai-an');
  await view(page,'cr-compare-b').selectOption('black');
  const scene = clean(await view(page,'explore').textContent());
  check(/counties/i.test(scene) && /2018.{0,4}2022/.test(scene),
    label+' AI/AN incidence has its geographic coverage and source period in view');
  await fits(page,'main, #explore, #cr-chart, #cr-compare-a, #cr-compare-b',label+' demographics view');
  await capture(page,label+'-race','#cr-chart');
}

async function inspectMichigan(page, size, label) {
  await view(page,'cr-view').selectOption('michigan');
  const measure = view(page,'cr-measure');
  const measures = await measure.locator('option').evaluateAll(options=>options.map(option=>option.value));
  check(['late-rate','late-share','screening'].every(id=>measures.includes(id)),
    label+' Michigan view lets students choose the late-stage rate, late-stage share, or screening estimate');
  await measure.selectOption('late-rate');
  check(await page.locator('#cr-chart .cr-scatter').isVisible(),
    label+' Michigan view directly plots screening alongside the late-stage rate');
  const search = view(page,'cr-search');
  const refs = [['Oakland','26125',45.5,30.4,91.1],['Wayne','26163',46.0,33.3,81.5]];
  const pair = [], names = [];
  const leadingValue = cell => numeric(cell?.match(/^\s*([\d,.]+)/)?.[1]);
  for (const [index,[county,fips,...published]] of refs.entries()){
    await search.fill(county);
    await waitForNamedRows(page,[county]);
    const filtered = await snapshot(page);
    check(filtered.length===1&&filtered[0].id===fips&&filtered[0].cells[1].includes(county),
      label+' Michigan search isolates '+county+' County');
    const row = filtered[0];
    check(published.every((value,offset)=>leadingValue(row.cells[offset+2])===value),
      label+' '+county+' agrees with the published late-stage rate, share, and mammography estimate');
    pair.push({...row, lateRate:published[0]});
    await view(page,index===0?'cr-compare-a':'cr-compare-b').selectOption(row.id);
    names.push(clean(await view(page,index===0?'cr-compare-a':'cr-compare-b').locator('option:checked').textContent()));
  }
  await search.clear();
  const miX=view(page,'cr-mi-x');
  await miX.selectOption('income');
  await measure.selectOption('screening');
  check((await page.locator('#cr-scatter-title').textContent()).includes('income'),
    label+' can compare county screening estimates against median household income');
  await view(page,'cr-mi-region').selectOption('rural');
  check((await snapshot(page)).every(row=>row.cells[1].includes('Rural')),
    label+' county type filter shows rural counties without relabeling the data');
  await view(page,'cr-mi-region').selectOption('all');
  await miX.selectOption('screening');
  for (const id of ['late-share','screening','late-rate']){
    await measure.selectOption(id);
    check(await measure.inputValue()===id, label+' can actively select Michigan measure '+id);
    if (id==='late-share') check(await page.locator('#cr-chart .cr-scatter').isVisible(),
      label+' can display late stage as a share rather than a population rate');
  }
  check(await view(page,'cr-compare-a').inputValue()===pair[0].id && await view(page,'cr-compare-b').inputValue()===pair[1].id,
    label+' changing the Michigan measure does not discard the selected areas');
  await fits(page,'main, #explore, #cr-chart, #cr-compare-a, #cr-compare-b',label+' Michigan screening view');
  await capture(page,label+'-michigan','#cr-chart');
  const enlarge = view(page,'cr-enlarge');
  const dialog = view(page,'cr-chart-dialog');
  await invoke(enlarge,size);
  await dialog.waitFor({state:'visible'});
  const magnified=dialog.locator('.cr-scatter').first();
  await magnified.waitFor({state:'visible'});
  const zoom=view(page,'cr-zoom');
  const before=await magnified.boundingBox();
  if (await zoom.evaluate(element=>element.tagName==='SELECT')){
    const last=await zoom.locator('option').last().getAttribute('value');
    await zoom.selectOption(last);
  } else {
    await zoom.press('End');
  }
  const after=await magnified.boundingBox();
  check(before&&after&&after.width>before.width,label+' enlarging and zooming gives the chart more readable space');
  await invoke(view(page,'cr-chart-close'),size);
  await dialog.waitFor({state:'hidden'});
  await enlarge.waitFor({state:'visible'});
  check(await enlarge.evaluate(element=>document.activeElement===element),label+' closing the chart returns keyboard focus to its launcher');
  await invoke(view(page,'cr-pin'),size);
  const pins = (await record(page))?.evidence || [];
  check(pins.some(pin=>pin.view==='michigan'&&pin.measure==='late-rate'),label+' pins the Michigan comparison and its chosen measure');
  return {pair,names};
}

async function stateSearchAndPair(page, size, label) {
  await view(page, 'cr-view').selectOption('states');
  const search = view(page, 'cr-search');
  // Start with Michigan, familiar to the teacher's students, and switch to a second state.
  await search.fill('Michigan');
  await waitForNamedRows(page,['Michigan']);
  const filtered = await snapshot(page);
  check(filtered.length===1 && filtered[0].cells[1].includes('Michigan'), label + ' search narrows to Michigan');
  const mi = filtered[0];
  await view(page, 'cr-compare-a').selectOption(mi.id);
  await search.fill('Oregon');
  await waitForNamedRows(page,['Oregon']);
  const or = (await snapshot(page))[0];
  assert.ok(or && or.cells[1].includes('Oregon'));
  await view(page, 'cr-compare-b').selectOption(or.id);
  check(numeric(mi.cells[2]) === 457.4 && numeric(mi.cells[3]) === 60488 &&
    numeric(or.cells[2]) === 414.8 && numeric(or.cells[3]) === 23043,
  label+' sample rows agree with the published NCI/CDC 2019–2023 state table');
  check(await view(page, 'cr-compare-a').inputValue() === mi.id &&
      await view(page, 'cr-compare-b').inputValue() === or.id,
    label + ' filtering did not erase an existing comparison choice');
  await view(page, 'cr-measure').selectOption('count');
  const chart = view(page, 'cr-chart');
  await chart.waitFor({ state:'visible' });
  const truth = [mi,or];
  const descriptions = async () => chart.evaluate(el=>[
    el.textContent, el.getAttribute('aria-label'),
    ...Array.from(el.querySelectorAll('[aria-label], title, desc')).map(node => node.getAttribute('aria-label')||node.textContent)
  ].join(' '));
  let chartContent = clean(await descriptions());
  check(truth.every(row => chartContent.includes(row.cells[1]) && valueAppears(chartContent,row.cells[3])),
    label + ' comparison graph shows the two published case counts');
  await view(page, 'cr-measure').selectOption('incidence');
  chartContent = clean(await descriptions());
  check(truth.every(row => chartContent.includes(row.cells[1]) && valueAppears(chartContent,row.cells[2])),
    label + ' changing the measure updates the graph to the same states’ diagnosis rates');
  if (size.deep) {
    await search.fill('zz-no-state');
    check((await snapshot(page)).length===0 && await view(page,'cr-compare-a').inputValue()===mi.id &&
      await view(page,'cr-compare-b').inputValue()===or.id,label+' a no-match search does not erase the comparison');
  }
  await search.clear();
  return truth;
}

async function report(page, size, pair, michigan) {
  const waiting = page.waitForEvent('download');
  await invoke(view(page,'cr-download'),size);
  const download = await waiting;
  check(/cancer.*\.(txt|md)$/i.test(download.suggestedFilename()), 'students receive a named text report');
  const file = await fs.readFile(await download.path(), 'utf8');
  check(file.includes(REASON) && file.includes(CLAIM) && file.includes(LIMIT),
    'download contains the student’s prediction reasoning, claim and limit');
  check(pair.every(row => file.includes(row.cells[1]) && valueAppears(file,row.cells[2])),
    'download carries the student’s exact selected groups and rates');
  check(/100,?000/.test(file) && /2019.*2023/.test(file),
    'download identifies comparison units and source period even when read away from the site');
  if (michigan) {
    check(michigan.names.every((name,i)=>file.includes(name)&&valueAppears(file,michigan.pair[i].lateRate)),
      'download retains the named Michigan areas and the selected late-stage evidence');
    check(Object.values(RET_NOTES).every(value=>file.includes(value)) &&
      file.includes('Prototype cost ($): '+RET_NOTES.cost) &&
      file.includes('Trials with visible target: '+RET_NOTES.visible) &&
      file.includes('Total trials: '+RET_NOTES.trials),
      'download preserves the full student-authored prototype review');
  }
}

async function exercise(browser, base, size) {
  const label = size.width + (size.dark ? '-dark' : '-light');
  const ctx = await browser.newContext({
    viewport: { width:size.width, height:size.height },
    colorScheme:size.dark ? 'dark' : 'light',
    reducedMotion:'reduce', hasTouch:!!size.touch, acceptDownloads:true
  });
  const origin = new URL(base).origin;
  await ctx.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(8000);
  try {
    await page.goto(new URL(FILE, base).href);
    await visible(page,'predict');
    check(await view(page,'explore').isHidden(), label + ' evidence is not spoiled before the student predicts');
    await fits(page,'main, #predict, #cr-prediction, #cr-reason, #cr-lock',label+' Predict');
    await capture(page,label+'-predict','#cr-prediction');
    if (size.deep) await a11y(page,'#predict',label+' Predict');
    await view(page,'cr-prediction').selectOption(size.touch ? 'same' : 'different');
    await view(page,'cr-reason').fill(REASON);
    await invoke(view(page,'cr-lock'),size);
    await visible(page,'explore');
    await view(page,'cr-verdict').waitFor({ state:'visible' });
    check(clean(await view(page,'cr-verdict').textContent()).length > 20,label+' prediction is checked against the published comparison');
    let saved = await record(page);
    check(saved?.step === 'explore' && saved?.prediction, label+' prediction creates resumable local work');
    check(await view(page,'cr-view').inputValue() === 'types', label+' first evidence compares national cancer types');
    const incidence = await topRank(page);
    await view(page,'cr-measure').selectOption('mortality');
    const mortality = await topRank(page);
    check(incidence.id !== mortality.id && incidence.label !== mortality.label,
      label+' diagnosis and death rankings have different actual first-place entries');
    check(incidence.id === 'breast' && incidence.incidence === 133.8 &&
      mortality.id === 'lung' && mortality.mortality === 29.9,
    label+' leading ranks and rates match the 2021 OpenSciEd lesson figures');
    await view(page,'cr-measure').selectOption('incidence');
    await fits(page,'main, #explore, #cr-chart, #cr-search, #cr-compare-a, #cr-compare-b',label+' Explore');
    await capture(page,label+'-types','#cr-chart');
    if (size.deep) {
      const rows = await snapshot(page);
      check(rows.some(row => row.cells.slice(2).some(cell => /not in top 10|not ranked/i.test(cell))) &&
        rows.every(row => row.cells.slice(2).every(cell => numeric(cell)!==0)),
      label+' a cancer outside a published top ten is not mislabeled as having a rate of zero');
      await a11y(page,'#explore',label+' Explore');
      await verifySort(page,size);
      await inspectPoverty(page,label);
      await inspectRace(page,label);
    }
    const michigan = size.width===1366 ? await inspectMichigan(page,size,label) : null;
    const pair = await stateSearchAndPair(page,size,label);
    await capture(page,label+'-states','#cr-chart');
    await invoke(view(page,'cr-pin'),size);
    saved = await record(page);
    check(Array.isArray(saved?.evidence) && saved.evidence.length===(michigan?2:1),label+' each comparison is recorded once');
    const serialized = JSON.stringify(saved.evidence);
    await page.reload();
    await visible(page,'explore');
    const restored = await record(page);
    check(JSON.stringify(restored?.evidence)===serialized &&
      await view(page,'cr-view').inputValue()==='states' &&
      await view(page,'cr-compare-a').inputValue()===pair[0].id &&
      await view(page,'cr-compare-b').inputValue()===pair[1].id,
    label+' reload restores the comparison and pinned evidence exactly');
    await invoke(view(page,'cr-to-explain'),size);
    await visible(page,'explain');
    const evidence = clean(await view(page,'cr-evidence-list').textContent());
    check(pair.every(row=>evidence.includes(row.cells[1]) && valueAppears(evidence,row.cells[2])),
      label+' Explain brings its own evidence next to the student’s writing, with no backtracking');
    if (michigan) {
      check(michigan.names.every((name,i)=>evidence.includes(name)&&valueAppears(evidence,michigan.pair[i].lateRate)),
        label+' Explain carries the exact Michigan evidence without backtracking');
      const review = view(page,'cr-ret-review');
      await review.waitFor({state:'visible'});
      if(!await review.evaluate(el=>el.open)) await invoke(review.locator('summary'),size);
      for(const [field,note] of Object.entries(RET_NOTES)) await view(page,'cr-ret-'+field).fill(note);
    }
    await view(page,'cr-claim').fill(CLAIM);
    await view(page,'cr-limits').fill(LIMIT);
    await invoke(view(page,'cr-finish'),size);
    await view(page,'cr-download').waitFor({state:'visible'});
    check((await record(page))?.completed===true,label+' finishing marks the work complete');
    await fits(page,'main, #explain, #cr-claim, #cr-limits, #cr-evidence-list',label+' Explain');
    await capture(page,label+'-explain','#cr-evidence-list');
    if(size.deep) {
      await a11y(page,'#explain',label+' Explain');
      await page.reload();
      await visible(page,'explain');
      check(await view(page,'cr-claim').inputValue()===CLAIM && await view(page,'cr-limits').inputValue()===LIMIT,
        label+' original claim and uncertainty persist across reload');
      if (michigan) {
        const notes = await Promise.all(Object.keys(RET_NOTES).map(field=>view(page,'cr-ret-'+field).inputValue()));
        check(notes.every((note,i)=>note===Object.values(RET_NOTES)[i]),label+' optional prototype notes survive reload');
      }
      await report(page,size,pair,michigan);
    }
    if (size.width===1366) {
      await invoke(view(page,'cr-reset'),size);
      await view(page,'cr-reset-confirm').waitFor({state:'visible'});
      check((await record(page))?.completed===true,'opening reset confirmation does not erase work');
      await invoke(view(page,'cr-reset-confirm'),size);
      await visible(page,'predict');
      const empty=await record(page);
      check(!empty?.completed && !empty?.evidence?.length,'confirmed reset returns to the start without old investigation evidence');
    }
    check(errors.length===0,label+' no uncaught browser errors: '+errors.join(', '));
  } catch(error) {
    // Keep the actual failing state even if a selector failed before the normal screenshot.
    await capture(page,label+'-failure').catch(()=>{});
    throw error;
  } finally {
    await ctx.close();
  }
}

(async()=>{
  const server=await serve();
  let browser;
  try {
    const executablePath=process.env.CHROMIUM_PATH||process.env.CHROMIUM_EXECUTABLE;
    browser=await chromium.launch(executablePath?{ executablePath }:{});
    await fs.mkdir(OUT,{recursive:true});
    for(const size of CASES) await exercise(browser,server.url,size);
    console.log('openscied-b3-cancer-rates-browser: '+count+' checks passed');
  } finally {
    if(browser) await browser.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

