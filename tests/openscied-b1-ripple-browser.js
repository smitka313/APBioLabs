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
    const phone=width===390;
    const activate=el=>phone?el.tap():el.click();
    const select=el=>phone?el.tap():el.press('Space');
    const selected=(key,pressed)=>p.locator('[data-node="'+key+'"][aria-pressed="'+pressed+'"]')
      .waitFor({state:'attached',timeout:4000});
    await select(node('herd'));await selected('herd',true);
    assert.equal(await node('herd').getAttribute('aria-pressed'),'true');
    assert.match(await by('board-note').textContent(),/Now select what/);
    if(width===390)await select(node('herd'));
    else await node('dung').press('Escape');
    await selected('herd',false);
    assert.equal(await node('herd').getAttribute('aria-pressed'),'false');
    assert.match(await by('board-note').textContent(),/Arrow canceled/);
    assert.equal(await by('count').textContent(),'0 of 6 connections');
    if(width!==390){
      await node('herd').press('Space');await node('dung').press('Enter');
      assert.ok(await by('link-editor').isVisible());
      await by('more').press('Escape');
      assert.ok(await by('link-editor').isHidden());
      assert.ok(await node('herd').evaluate(el=>el===document.activeElement));
    }
    assert.equal(await p.locator('#rp-threads line').count(),0);
    assert.equal(await by('count').textContent(),'0 of 6 connections');
    await activate(by('hint'));await by('clue').waitFor({state:'visible'});assert.match(await by('clue').textContent(),/What do they leave behind/);
    const drag=async (source,target)=>{
      // Center the whole board/pasture. Moving two individual locators into
      // view can leave the other outside the hit-testable viewport on phones.
      await source.evaluate(el=>el.closest('.rp-map, .rp-pasture').scrollIntoView({block:'center',behavior:'instant'}));
      const center=async el=>el.evaluate(node=>{
        const r=node.getBoundingClientRect(), x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2);
        return {x,y,hit:node.contains(document.elementFromPoint(x,y))};
      });
      const a=await center(source),b=await center(target);
      assert.ok(a.hit&&b.hit, 'drag endpoints must be visible and hit-testable at '+width+' px');
      const {x,y}=a,{x:u,y:v}=b;
      if(width===390){
        const cdp=await ctx.newCDPSession(p);
        const fire=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
        try{
          await fire('touchStart',[{x,y,id:1}]);
          for(let i=1;i<=8;i++)await fire('touchMove',[{x:Math.round(x+(u-x)*i/8),y:Math.round(y+(v-y)*i/8),id:1}]);
          await fire('touchEnd',[]);
        }finally{await cdp.detach();}
      }else{
        await p.mouse.move(x,y);await p.mouse.down();
        await p.mouse.move(u,v,{steps:8});await p.mouse.up();
      }
    };
    // Invalid direction should explain itself without adding an arrow.
    await activate(node('beetles'));await selected('beetles',true);
    await activate(node('herd'));await selected('beetles',false);
    assert.match(await by('board-note').textContent(),/no direct link/);
    for(const [i,edge] of M.links.entries()){
      const gesture=i===0?'drag':width===390?'tap':'keyboard';
      if(i===0)await drag(node(edge.from),node(edge.to));
      else{
        await select(node(edge.from));
        await selected(edge.from,true);
        assert.equal(await node(edge.from).getAttribute('aria-pressed'),'true',
          width+' px '+gesture+' selected '+edge.from+' before '+edge.to);
        await select(node(edge.to));
      }
      await by('link-editor').waitFor({state:'visible',timeout:4000}).catch(async error=>{
        throw new Error(width+' px '+gesture+' did not open '+edge.from+' → '+edge.to+'; feedback: '+await by('board-note').textContent(),{cause:error});
      });
      if(i===0){
        await activate(by('less'));
        await by('board-note').filter({hasText:'Try the other'}).waitFor({state:'visible',timeout:4000});
      }
      await activate(by(edge.sign===1?'more':'less'));
      await by('link-editor').waitFor({state:'hidden',timeout:4000});
      assert.equal(await by('count').textContent(),(i+1)+' of 6 connections');
      assert.ok(await by('clue').isHidden());
      if(i===4){
        assert.equal(await by('next').textContent(),'One more connection to make!');
        await activate(by('hint'));await by('clue').waitFor({state:'visible'});assert.match(await by('clue').textContent(),/having more prey/);
        await p.reload();assert.equal(await by('next').textContent(),'One more connection to make!');
      }
    }
    assert.match(await by('board-note').textContent(),/All six/);
    assert.equal(await p.locator('#rp-threads line').count(),6);await shot('connected');
    assert.ok(await by('hint').isHidden());
    await p.locator('.rp-why-web summary').click();
    assert.match(await by('web').innerText(),/releases nutrients that roots can take up/);
    assert.match(await by('web').innerText(),/feed on dung and lay eggs in it/);
    await activate(by('to-compare'));
    await by('choice').selectOption('decrease');await by('reason').fill('Dung is a resource for beetles.');
    assert.ok(await by('experiment').isHidden());
    await activate(by('form').getByRole('button',{name:'Save prediction'}));
    await by('experiment').waitFor({state:'visible'});
    const firstGroup=by('stay').locator('button').first();
    await select(firstGroup);
    await by('herd-note').filter({hasText:'Group 1 selected'}).waitFor({state:'visible',timeout:4000});
    assert.match(await by('herd-note').textContent(),/Group 1 selected.*Neighboring patch/);
    if(width===390)await select(firstGroup);else await by('refuge').press('Escape');
    await by('herd-note').filter({hasText:'Select a group'}).waitFor({state:'visible',timeout:4000});
    assert.equal(await firstGroup.getAttribute('aria-pressed'),'false');
    assert.ok(await by('herd-note').textContent().then(text=>text.includes('Select a group')));
    assert.equal(await by('away').locator('button').count(),0);
    if(width!==390)assert.ok(await firstGroup.evaluate(el=>el===document.activeElement));
    await drag(firstGroup,by('refuge'));
    assert.equal(await by('away').locator('button').count(),1);assert.ok(await by('to-explain').isDisabled());
    await p.reload();assert.equal(await by('away').locator('button').count(),1);
    await select(by('stay').locator('button').first());await select(by('refuge'));
    assert.equal(await by('away').locator('button').count(),2);
    assert.equal(await by('stay').locator('button').count(),2);
    if(width===1366){
      await p.waitForFunction(()=>+document.getElementById('rp-scrub').value>=1);
      await by('replay').click();
      const paused=await by('scrub').inputValue();await p.waitForTimeout(2350);assert.equal(await by('scrub').inputValue(),paused);
    }
    const scrub=by('scrub');
    await scrub.press('Home');
    assert.match(await by('what').textContent(),/start at 100/);
    await scrub.press('ArrowRight');assert.match(await by('what').textContent(),/changes first/);
    await scrub.press('ArrowRight');await scrub.press('ArrowRight');
    assert.match(await by('what').textContent(),/fewer places to feed and lay eggs/);
    await scrub.press('ArrowRight');assert.match(await by('what').textContent(),/bury dung/);
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
