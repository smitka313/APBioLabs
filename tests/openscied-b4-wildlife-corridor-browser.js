'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const {ROOT,serve}=require('./_h');
const M=require('../openscied-b4-wildlife-corridor-logic.js');
const out=path.join(ROOT,'artifacts','openscied-b4-wildlife-corridor');
const KEY='aplab:openscied:b4-wildlife-corridor:v1';
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const site=await serve();
  let browser;
  try{
    browser=await chromium.launch();
    for(const width of [390,768,1366,1920]){
      const touch=width===390, desktop=width>=1366;
      const ctx=await browser.newContext({viewport:{width,height:desktop?900:844},hasTouch:touch,
        colorScheme:touch?'dark':'light',reducedMotion:desktop?'no-preference':'reduce'});
      try{
        const origin=new URL(site.url).origin;
        await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
        const page=await ctx.newPage(), failures=[];
        page.on('pageerror',e=>failures.push(e.message));
        const by=id=>page.locator('#wc-'+id), step=id=>page.locator('button[data-wc-go="'+id+'"]').first();
        const act=el=>touch?el.tap():el.press('Enter');
        const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),KEY);
        const waitFor=(which,n)=>page.waitForFunction(([k,w,i])=>JSON.parse(localStorage.getItem(k)||'null')?.generations[w]===i,[KEY,which,n],{timeout:12000});
        const shot=async(name,anchor)=>{
          await by(anchor).scrollIntoViewIfNeeded();
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+name+' overflow');
          await page.screenshot({path:path.join(out,width+'-'+name+'.png'),animations:'disabled'});
        };
        await page.goto(site.url+'openscied-b4-wildlife-corridor.html#explain');
        assert.equal(await step('explain').isDisabled(),true);
        assert.equal(await by('predict').isVisible(),true);
        await shot('prediction','predict');
        await page.locator('input[name="wc-prediction"][value="connected"]').check();
        await by('reason').fill('The trail connects the two patches.');
        await act(by('save-prediction'));
        assert.equal(await by('model').isVisible(),true);
        await act(by('run-baseline'));
        if(desktop){
          await waitFor('baseline',1);
          await shot('mid-run','map-connected');
        }
        await waitFor('baseline',8);
        assert.match(await by('mix').textContent(),/Parent 1.*Parent 2.*Offspring/s);
        assert.match(await by('mix').textContent(),/A\/A|A\/a|a\/a/);
        await act(by('replay-mix'));
        const motion=await by('mix').locator('.wc-mix-travel').first().evaluate(e=>getComputedStyle(e).animationName);
        assert.equal(motion,desktop?'wc-inherit-copy':'none');
        await shot('inheritance','mix');
        await shot('baseline','map-road');
        const slot=page.getByRole('button',{name:'Place crossing between the two trail ends'});
        assert.equal(await page.locator('[data-wc-crossing-slot]').count(),1,'only the connection between the trails can accept the crossing');
        assert.equal(await by('run-crossing').isDisabled(),true);
        if(desktop)await by('crossing-tile').dragTo(slot);
        else {
          await act(slot);
          assert.match(await by('status').textContent(),/select the crossing tile first/i);
          assert.equal((await saved()).crossing,-1);
          await act(by('crossing-tile'));
          assert.equal(await by('crossing-tile').getAttribute('aria-pressed'),'true');
          await act(slot);
        }
        assert.equal((await saved()).crossing,1);
        assert.equal(await slot.getAttribute('aria-pressed'),'true');
        await shot('crossing','map-road');
        await act(by('run-crossing'));await waitFor('corridor',8);
        await act(step('explain'));
        const evidence=by('explain-evidence');
        const rows=await evidence.locator('tbody tr').evaluateAll(rows=>rows.map(r=>[...r.cells].slice(1).map(c=>c.textContent)));
        const {seed}=await saved();
        assert.deepEqual(rows,['connected','road','corridor'].map(id=>{
          const s=M.run(seed,id).history.at(-1), [west,east]=s.patches.map(p=>p.variantCounts);
          return [west.A+' A, '+west.a+' a',east.A+' A, '+east.a+' a',String(Math.abs(west.A-east.A)),String(s.crossPatchContributions)];
        }));
        await by('claim').fill('I used two of the simulated counts.');
        await by('limits').fill('There are no measurements of real survival in the model.');
        await act(by('finish'));
        await page.reload();
        assert.equal((await saved()).finished,true);
        await shot('explain','explain');
        const preview=page.getByRole('button',{name:'Preview report'});
        await act(preview);
        const report=page.getByRole('dialog').filter({hasText:'Wildlife Corridor Lab'});
        await report.waitFor();
        assert.match(await report.textContent(),/I used two of the simulated counts/);
        assert.deepEqual(failures,[]);
        console.log('ok: Wildlife Corridor Lab '+width+'px matched model, crossing, results, reopening and report');
      }finally{await ctx.close();}
    }
  }finally{await browser?.close();await site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
