'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright'),{ROOT,serve}=require('./_h');
const M=require('../openscied-b1-ripple-logic.js');
const out=path.join(ROOT,'artifacts','ripple');
(async()=>{
 const site=await serve();let browser;
 try{
  browser=await chromium.launch(process.env.RIPPLE_CHROMIUM?{executablePath:process.env.RIPPLE_CHROMIUM}:undefined);await fs.mkdir(out,{recursive:true});
  for(const width of [390,768,1366,1920]){
   const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:width===390?'dark':'light',reducedMotion:width===1366?'no-preference':'reduce',hasTouch:width===390});
   try{
    const origin=new URL(site.url).origin;await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const p=await ctx.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(site.url+'openscied-b1-ripple.html');
    const by=id=>p.locator('#rp-'+id);
    const shot=async n=>{assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(out,width+'-'+n+'.png'),fullPage:true,animations:'disabled'});};
    assert.ok(await by('to-compare').isDisabled());
    await shot('build');
    const node=k=>p.locator('[data-node="'+k+'"]');
    assert.equal(await p.locator('#rp-threads line').count(),0);
    const drag=async (source,target)=>{
      await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();
      const a=await source.boundingBox(),b=await target.boundingBox();
      const [x,y,u,v]=[a.x+a.width/2,a.y+a.height/2,b.x+b.width/2,b.y+b.height/2];
      if(width===390){
        const cdp=await ctx.newCDPSession(p);
        const fire=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
        await fire('touchStart',[{x,y}]);
        for(let i=1;i<=8;i++)await fire('touchMove',[{x:x+(u-x)*i/8,y:y+(v-y)*i/8}]);
        await fire('touchEnd',[]);await cdp.detach();
      }else{
        await p.mouse.move(x,y);await p.mouse.down();
        await p.mouse.move(u,v,{steps:8});await p.mouse.up();
      }
    };
    // Invalid direction should explain itself without adding an arrow.
    await node('beetles').click();await node('herd').click();
    assert.match(await by('board-note').textContent(),/no direct link/);
    for(const [i,edge] of M.links.entries()){
      if(i===0)await drag(node(edge.from),node(edge.to));
      else{await node(edge.from).focus();await p.keyboard.press('Enter');await node(edge.to).focus();await p.keyboard.press('Enter');}
      assert.ok(await by('link-editor').isVisible());
      if(i===0){await by('less').click();assert.match(await by('board-note').textContent(),/Try the other/);}
      await by(edge.sign===1?'more':'less').click();
    }
    assert.match(await by('board-note').textContent(),/All six/);
    assert.equal(await p.locator('#rp-threads line').count(),6);await shot('connected');
    await by('to-compare').click();
    await by('choice').selectOption('decrease');await by('reason').fill('Dung is a resource for beetles.');
    assert.ok(await by('experiment').isHidden());
    await by('form').getByRole('button',{name:'Save prediction'}).click();
    await drag(by('stay').locator('button').first(),by('refuge'));
    assert.equal(await by('away').locator('button').count(),1);assert.ok(await by('to-explain').isDisabled());
    await p.reload();assert.equal(await by('away').locator('button').count(),1);
    await by('stay').locator('button').first().click();await by('refuge').click();
    assert.equal(await by('away').locator('button').count(),2);
    assert.equal(await by('stay').locator('button').count(),2);
    if(width===1366){
      await p.waitForFunction(()=>+document.getElementById('rp-scrub').value>=1);
      await by('replay').click();
      const paused=await by('scrub').inputValue();await p.waitForTimeout(850);assert.equal(await by('scrub').inputValue(),paused);
    }
    const scrub=by('scrub');
    await scrub.press('Home');
    assert.match(await by('what').textContent(),/start at 100/);
    await scrub.press('ArrowRight');assert.match(await by('what').textContent(),/changes first/);
    await scrub.press('End');assert.match(await by('what').textContent(),/indirect effect/);
    await shot('comparison');await by('to-explain').click();
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
    console.log('ok: Serengeti Ripple '+width+'px dragged connections and herd, watched and scrubbed matched runs, evidence, reload and report');
   }finally{await ctx.close();}
  }
 }finally{await browser?.close();await site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
