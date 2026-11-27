'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const T=require('./_h');
const samples=[
  ['openscied-b1-migration.html','.mx-pages button'],
  ['openscied-b1-ripple.html','.rp-steps button'],
  ['openscied-b2-burn-lab.html','.step-nav li > a'],
  ['openscied-b2-carbon-journey.html','.journey-tabs button'],
  ['openscied-b3-dna-workshop.html','.dw-stage-nav button'],
  ['openscied-b3-inheritance-environment.html','.step-nav li > a'],
  ['openscied-b4-rat-generations.html','.rg-steps button'],
  ['openscied-b4-wildlife-corridor.html','.wc-nav button'],
  ['openscied-b5-thermoregulation.html','.th-tabs button'],
  ['openscied-b5-hybrid.html','.hy-nav button']
];

function luminance(color){
  const canvasRgb=color.match(/[\d.]+/g).map(Number);
  const rgb=color.startsWith('color(srgb') ? canvasRgb : canvasRgb.map(n=>n/255);
  const linear=rgb.slice(0,3).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
  return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}
function contrast(a,b){
  const l=[luminance(a),luminance(b)].sort((x,y)=>x-y);
  return (l[1]+.05)/(l[0]+.05);
}
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
        disabled:el.disabled,color:style.color,background:style.backgroundColor,border:style.borderTopStyle,opacity:style.opacity,width:r.width,scroll:el.scrollWidth,client:el.clientWidth};
    }));
    assert.equal(stats.filter(s=>s.active).length,1,file+' has exactly one active step');
    const longRail=selector.includes(' > a')&&stats.length>=10;
    assert.ok(stats.every(s=>s.radius==='6px'&&(longRail?s.height>=24:s.height>=41.5&&s.weight==='700')),
      file+' uses accessible navigation targets');
    if(longRail&&width>=1000){
      assert.ok(Math.max(...stats.map(s=>s.height))<41.5,file+' keeps a long sticky rail compact on desktop');
    }
    const activeRing=stats.find(s=>s.active).ring;
    assert.ok(activeRing.includes('inset')&&activeRing.includes('-3px'),file+' marks the current step with an inset underline: '+activeRing);
    assert.ok(stats.every(s=>s.scroll<=s.client+1),file+' step labels do not overflow');
    if(!selector.includes(' > a')){
      assert.ok(Math.max(...stats.map(s=>s.height))-Math.min(...stats.map(s=>s.height))<=1,file+' step targets align');
      for(const s of stats.filter(s=>s.disabled)){
        assert.equal(s.border,'solid',file+' disabled border is visible');
        assert.equal(s.opacity,'1',file+' disabled labels are not faded');
        assert.ok(contrast(s.color,s.background)>=4.5,file+' disabled text remains readable in '+mode);
      }
    }
    if(file.includes('dna-workshop')){
      assert.ok(Math.max(...stats.map(s=>s.height))-Math.min(...stats.map(s=>s.height))<=1,'fixed grid has even steps');
      assert.equal(new Set(stats.map(s=>s.row)).size,width<=480?3:width<=1000?2:1,'six DNA steps use regular rows at each breakpoint');
      assert.ok(stats.every(s=>s.scroll<=s.client+1),'DNA labels stay within their own targets');
      assert.equal(stats.filter(s=>s.disabled).length,5,'unchanged step gating');
    }
    const evidenceNotes={
      'openscied-b1-ripple.html':'#compare .ose-model-limit',
      'openscied-b2-carbon-journey.html':'#evidence .ose-model-limit',
      'openscied-b4-wildlife-corridor.html':'#wc-explain .ose-model-limit',
      'openscied-b5-hybrid.html':'#model .ose-model-limit'
    };
    if(evidenceNotes[file]){
      const note=page.locator(evidenceNotes[file]);
      assert.equal(await note.count(),1,file+' puts a model limit in the step that uses it');
      assert.equal(await note.locator('xpath=ancestor::details').count(),0,file+' limit is not in a disclosure');
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
  if(mode==='dark') assert.equal(await filter(),'brightness(0.91)','Dark mode gently dims the Lab 1 seedling thumbnail without obscuring details');
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
