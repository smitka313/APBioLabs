/* Read-only diagnostic. Place alongside _h.js in checkout tests/ and run with the repo Playwright install.
 * Only local server and isolated browser memory; no production writes or account identity. */
'use strict';
const assert = require('node:assert/strict');
const T = require('./_h');
const KEY = 'aplab:pref:theme';
const pages = [
  ['openscied-b2-burn-lab','burn'], ['openscied-b2-fires','yeast'], ['openscied-b2-peat-bog-lab','bog'],
  ['openscied-b2-carbon-journey','evidence'], ['openscied-b3-cancer-rates',''],
  ['openscied-b3-dna-workshop',''], ['openscied-b3-cell-cycle','growth-model'],
  ['openscied-b3-dna-p53',''], ['openscied-b3-inheritance-environment','']
];
const control = (page, mode) => page.locator('.theme-switch button[data-mode="'+mode+'"]').first();
const theme = (page, mode) => page.waitForFunction(({key,mode}) => {
  const x = document.documentElement;
  const stored = localStorage.getItem(key);
  return stored === mode && x.dataset.theme === (mode==='auto'?undefined:mode) &&
    document.querySelector('.theme-switch button[aria-pressed="true"]')?.dataset.mode===mode;
}, {key:KEY,mode});

async function isolated(browser, base, system, selected){
  const context=await browser.newContext({colorScheme:system,reducedMotion:'reduce'});
  try{
    await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
    const page=await context.newPage();
    await page.goto(base+'openscied-dashboard.html');
    await theme(page,'dark');
    await control(page,'auto').click();
    await theme(page,'auto');
    await control(page,selected).click();
    for(const [name,step] of pages){
      await page.goto(base+name+'.html');
      await theme(page,selected);
      if(step){
        await page.evaluate(value=>{location.hash=value;},step);
        await theme(page,selected);
      }
      if(name==='openscied-b3-cancer-rates'){
        await page.locator('#cr-prediction').selectOption('different');
        await page.locator('#cr-lock').click();
        await theme(page,selected);
        assert.equal(await page.locator('#explore').isHidden(),true,'opening the evidence workflow cannot bypass Explore');
      }
      await page.reload();
      await theme(page,selected);
      console.log(system+' OS, explicit '+selected+': '+name+' stays on choice through visit, steps and reload');
    }
    const other=await context.newPage();
    await other.goto(base+'openscied-dashboard.html');
    const changed=selected==='dark'?'light':'dark';
    await control(other,changed).click();
    await theme(page,changed);
    console.log('Same-origin cross-tab changes intentionally propagate to the open activity');
    await control(other,'auto').click();
    await theme(page,'auto');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme.includes('dark')),system==='dark');
  }finally{await context.close();}
}
(async()=>{
  const site=await T.serve(), browser=await T.launch();
  try{
    await isolated(browser,site.url,'dark','light');
    await isolated(browser,site.url,'light','dark');
  }finally{await browser.close();site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
