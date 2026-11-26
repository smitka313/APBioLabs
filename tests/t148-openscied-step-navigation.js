'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const T=require('./_h');
const samples=[
  ['openscied-b1-migration.html','.mx-pages button'],
  ['openscied-b2-burn-lab.html','.step-nav li > a'],
  ['openscied-b3-dna-workshop.html','.dw-stage-nav button'],
  ['openscied-b4-rat-generations.html','.rg-steps button'],
  ['openscied-b5-thermoregulation.html','.th-tabs button']
];
async function verifyNav(page, base, width, mode){
  for(const [file,selector] of samples){
    await page.goto(base+file,{waitUntil:'domcontentloaded'});
    const step=page.locator(selector);
    await step.first().waitFor();
    await page.waitForFunction(({selector})=>[...document.querySelectorAll(selector)].some(el=>
      el.matches('[aria-current]:not([aria-current="false"]),[aria-pressed="true"]')), {selector});
    const stats=await step.evaluateAll(items=>items.map(el=>{
      const r=el.getBoundingClientRect(), style=getComputedStyle(el);
      return {height:r.height, row:Math.round(r.top), radius:style.borderRadius, ring:style.boxShadow,
        active:el.matches('[aria-current]:not([aria-current="false"]),[aria-pressed="true"]'), weight:style.fontWeight,
        disabled:el.disabled,width:r.width,scroll:el.scrollWidth,client:el.clientWidth};
    }));
    assert.equal(stats.filter(s=>s.active).length,1,file+' has exactly one active step');
    assert.ok(stats.every(s=>s.height>=41.5&&s.radius==='6px'&&s.weight==='700'),file+' uses common navigation targets');
    assert.match(stats.find(s=>s.active).ring,/inset.*-3px/,file+' marks the current step with an inset underline');
    if(file.includes('dna-workshop')){
      assert.ok(Math.max(...stats.map(s=>s.height))-Math.min(...stats.map(s=>s.height))<=1,'fixed grid has even steps');
      assert.equal(new Set(stats.map(s=>s.row)).size,width<=800?2:1,'six DNA steps use even rows on narrow screens');
      assert.ok(stats.every(s=>s.scroll<=s.client+1),'DNA labels stay within their own targets');
      assert.equal(stats.filter(s=>s.disabled).length,5,'unchanged step gating');
    }
    if(process.env.POLISH_SCREENSHOTS){
      const nav=step.first().locator('xpath=ancestor::nav[1]');
      await nav.screenshot({path:path.join(process.env.POLISH_SCREENSHOTS,file.replace('.html','')+'-nav-'+width+'-'+mode+'.png'),animations:'disabled'});
    }
  }
}
async function verifyThumbnails(page,base,width,mode){
  await page.goto(base+'ap-biology.html',{waitUntil:'domcontentloaded'});
  const image=page.locator('.card .thumb').first();
  await image.waitFor();
  await image.evaluate(img=>img.decode());
  const filter=()=>image.evaluate(img=>getComputedStyle(img).filter);
  if(mode==='dark') assert.match(await filter(),/brightness\(0\.75\).*contrast\(0\.94\)/);
  else assert.equal(await filter(),'none');
  if(process.env.POLISH_SCREENSHOTS){
    await image.screenshot({path:path.join(process.env.POLISH_SCREENSHOTS,'ap-thumbnail-'+width+'-'+mode+'.png'),animations:'disabled'});
  }
  await page.emulateMedia({media:'print'});
  assert.equal(await filter(),'none','print removes the dark thumbnail treatment');
}
(async()=>{
  const browser=await T.launch(), server=await T.serve();
  try{
    for(const [width,mode] of [[390,'dark'],[768,'light'],[1366,'light'],[1920,'dark']]){
      const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',colorScheme:mode});
      try{
        await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(server.url).origin?r.continue():r.abort());
        await ctx.addInitScript(mode=>{localStorage.setItem('aplab:pref:theme',mode);},mode);
        const page=await ctx.newPage();
        await verifyNav(page,server.url,width,mode);
        await verifyThumbnails(page,server.url,width,mode);
        console.log('ok: '+width+'px '+mode+' five-unit step navigation and AP thumbnail');
      }finally{await ctx.close();}
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
