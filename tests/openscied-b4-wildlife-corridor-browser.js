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
      const touch=width===390, desktop=width>=1366, motionEnabled=touch||desktop;
      const ctx=await browser.newContext({viewport:{width,height:desktop?900:844},hasTouch:touch,
        colorScheme:touch?'dark':'light',reducedMotion:motionEnabled?'no-preference':'reduce'});
      try{
        const origin=new URL(site.url).origin;
        await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
        const page=await ctx.newPage(), failures=[];
        page.on('pageerror',e=>failures.push(e.message));
        const by=id=>page.locator('#wc-'+id), step=id=>page.locator('button[data-wc-go="'+id+'"]').first();
        const act=el=>touch?el.tap():el.press('Enter');
        const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),KEY);
        const waitFor=(which,n)=>page.waitForFunction(([k,w,i])=>JSON.parse(localStorage.getItem(k)||'null')?.generations[w]===i,[KEY,which,n],{timeout:24000});
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
        if(motionEnabled){
          await waitFor('baseline',1);
          for(const board of ['connected','road']){
            const actors=by('pair-'+board).locator('.wc-mate-parent');
            assert.equal(await actors.count(),board==='road'?4:2,'both habitats show their sampled parents during a matched run');
            assert.equal(await actors.first().evaluate(e=>getComputedStyle(e).animationName),'wc-find-mate');
          }
          assert.equal(await by('pair-road').locator('.wc-mate-parent[data-crossing="true"]').count(),0);
        }
        await waitFor('baseline',8);
        for(const patch of ['west','east']){
          assert.equal(await by('pair-road').locator('.wc-mate-parent[data-patch="'+patch+'"]').count(),2);
          assert.equal(await by('pair-road').locator('.wc-map-copy[data-patch="'+patch+'"]').count(),2);
          assert.equal(await by('pair-road').locator('.wc-mate-child[data-patch="'+patch+'"]').count(),1);
        }
        assert.match(await by('mix').textContent(),/Parent 1.*Parent 2.*Offspring/s);
        assert.match(await by('mix').textContent(),/A\/A|A\/a|a\/a/);
        await act(by('replay-mix'));
        const motion=await by('mix').locator('.wc-mix-travel').first().evaluate(e=>getComputedStyle(e).animationName);
        assert.equal(motion,motionEnabled?'wc-inherit-copy':'none');
        const pairing=by('pair-connected');
        assert.equal(await pairing.locator('.wc-mate-parent').count(),2);
        assert.equal(await pairing.locator('.wc-mate-child').count(),1);
        const mapMotion=await pairing.locator('.wc-mate-parent').first().evaluate(e=>getComputedStyle(e).animationName);
        assert.equal(mapMotion,motionEnabled?'wc-find-mate':'none');
        const copies=pairing.locator('.wc-map-copy');
        assert.equal(await copies.count(),2);
        assert.ok((await copies.allTextContents()).every(a=>a==='A'||a==='a'));
        if(touch){
          assert.ok(await copies.evaluateAll(nodes=>{
            return nodes.every(node=>{
              const animation=node.getAnimations().find(a=>a.animationName==='wc-map-inherit');
              if(!animation)return false;
              animation.pause();
              animation.currentTime=760;
              const {top,bottom,left,right}=node.getBoundingClientRect();
              return Number(getComputedStyle(node).opacity)>.9&&top>=0&&bottom<=innerHeight&&left>=0&&right<=innerWidth;
            });
          }), 'both allele copies are visible together on the phone map during replay');
          await shot('phone-allele-transfer','map-connected');
        }
        assert.equal(await by('mix-offspring').locator('option').count(),24);
        await by('mix-habitat').selectOption('road');
        await by('mix-offspring').selectOption('23');
        assert.match(await by('mix').textContent(),/Offspring East 12/);
        assert.equal(await by('pair-road').locator('[data-crossing="true"]').count(),0);
        await shot('parent-pair','map-road');
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
        assert.match(await evidence.textContent(),/gap in A copies may shrink, stay the same, or grow/);
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
