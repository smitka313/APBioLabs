'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright'),{ROOT,serve}=require('./_h');
const M=require('../openscied-b1-ripple-logic.js');
const out=path.join(ROOT,'artifacts','ripple');
(async()=>{
 const site=await serve();let browser;
 try{
  browser=await chromium.launch();await fs.mkdir(out,{recursive:true});
  for(const width of [390,768,1366,1920]){
   const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:width===390?'dark':'light',reducedMotion:'reduce'});
   try{
    const origin=new URL(site.url).origin;await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const p=await ctx.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(site.url+'openscied-b1-ripple.html');
    const by=id=>p.locator('#rp-'+id);
    const shot=async n=>{assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(out,width+'-'+n+'.png'),fullPage:true,animations:'disabled'});};
    assert.ok(await by('to-compare').isDisabled());
    await shot('build');
    for(const [i,edge] of M.links.entries())await p.locator(`input[name="rp-link-${i}"][value="${edge.sign}"]`).check();
    await by('check').click();assert.match(await by('status').textContent(),/All six/);
    await by('to-compare').click();
    await by('choice').selectOption('decrease');await by('reason').fill('Dung is a resource for beetles.');
    assert.ok(await by('baseline').isDisabled());
    await by('form').getByRole('button',{name:'Save prediction'}).click();
    await by('baseline').click();assert.ok(await by('to-explain').isDisabled());
    await by('fewer').click();await shot('comparison');
    await by('to-explain').click();
    const [seed,expected]=await p.evaluate(()=>{const {seed}=JSON.parse(localStorage.getItem('aplab:openscied:b1-ripple:v1'));return [seed,Array.from(document.querySelectorAll('#rp-evidence tr'),r=>r.textContent)];});
    assert.ok(expected[3].includes(String(M.run(seed,50).at(-1).beetles)));
    await by('evidence').getByRole('combobox').selectOption('0');
    assert.match(await by('evidence').textContent(),/Dung beetle activity100100/);
    await by('claim').fill('Fewer visitors reduced dung and then beetle activity in the model.');
    await by('limit').fill('Rainfall did not change.');
    await by('finish').click();await p.reload();
    assert.match(await by('finish-note').textContent(),/Investigation complete/);
    assert.equal(await by('claim').inputValue(),'Fewer visitors reduced dung and then beetle activity in the model.');
    const report=p.getByRole('button',{name:'Preview report'});await report.click();
    assert.match(await p.getByRole('dialog').filter({hasText:'Serengeti Ripple Effects'}).textContent(),/Rainfall did not change/);
    assert.deepEqual(errors,[]);
    console.log('ok: Serengeti Ripple '+width+'px checked links, matched runs, evidence, reload and report');
   }finally{await ctx.close();}
  }
 }finally{await browser?.close();await site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
