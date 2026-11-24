'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright'),{ROOT,serve}=require('./_h');
const M=require('../openscied-b3-screening-logic');
const out=path.join(ROOT,'artifacts','screening');
(async()=>{
 const server=await serve();let browser;
 try{
  browser=await chromium.launch();await fs.mkdir(out,{recursive:true});
  for(const width of [390,768,1366,1920]){
   const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:width===390?'dark':'light',reducedMotion:width===1366?'no-preference':'reduce',hasTouch:width===390});
   try{
    const origin=new URL(server.url).origin;await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    const id=n=>p.locator('#sd-'+n);
    const site=n=>p.locator('[data-zone="'+n+'"]');
    await p.goto(server.url+'openscied-b3-screening.html');
    const shot=async name=>{
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.ok(await p.locator('.sd-board').evaluate(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('.sd-home,.sd-site')].every(s=>{const b=s.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom;});}));
      await p.screenshot({path:path.join(out,width+'-'+name+'.png'),fullPage:true,animations:'disabled'});
    };
    await shot('hospital-setup');
    assert.equal(await id('stage').textContent(),'Step 1 of 3');
    assert.ok(await id('quick').isHidden());assert.ok(await id('advanced').isHidden());assert.ok(await id('cost-details').isHidden());
    await id('run').click();
    assert.equal(await id('stage').textContent(),'Step 2 of 3');
    assert.ok(await id('quick').isVisible());assert.ok(await id('tool-machine').isHidden());
    assert.ok(await id('to-explain').isHidden());assert.ok(await id('patients').isHidden());
    const starter=await id('story').locator('h4').textContent();
    if(width===1366)await p.waitForFunction(()=>/Patient .* is traveling/.test(document.querySelector('#sd-map-event').textContent),null,{timeout:5000});
    const drag=async (source,target)=>{
      await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();
      const a=await source.boundingBox(),b=await target.boundingBox(),[x,y,u,v]=[a.x+a.width/2,a.y+a.height/2,b.x+b.width/2,b.y+b.height/2];
      if(width===390){
        const c=await ctx.newCDPSession(p),send=(type,touchPoints)=>c.send('Input.dispatchTouchEvent',{type,touchPoints});
        await send('touchStart',[{x,y}]);for(let i=1;i<=10;i++)await send('touchMove',[{x:x+(u-x)*i/10,y:y+(v-y)*i/10}]);
        await send('touchEnd',[]);await c.detach();
      }else{await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(u,v,{steps:10});await p.mouse.up();}
    };
    if(width===1920)await id('move-team').click();
    else if(width===768){await id('tool-team').press('Enter');await site('mobile').press('Enter');}
    else await drag(id('tool-team'),site('mobile'));
    assert.match(await id('mobile-items').textContent(),/Ultrasound · Sonographer/);
    assert.match(await id('hub-items').textContent(),/Screening/);
    assert.match(await id('budget').textContent(),/615 \/ 720/);
    await p.reload();assert.match(await id('mobile-items').textContent(),/Ultrasound · Sonographer/);
    assert.equal(await id('story').locator('h4').textContent(),starter);
    await id('run').click();assert.equal(await id('stage').textContent(),'Step 3 of 3');
    assert.equal(await id('story').locator('h4').textContent(),starter);
    assert.match(await id('story').textContent(),/Hospital plan:.*Redesign:/s);
    assert.ok(await id('patients').isHidden());
    await id('cart').locator('summary').click();
    await id('probe').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.match(await id('probe-note').textContent(),/Different tissues can reflect sound differently/);
    await id('cart').locator('summary').click();
    await id('advanced').locator('summary').click();
    await id('tool-machine').press('Enter');await site('hub').press('Enter');
    assert.match(await id('setup-note').textContent(),/same site/);assert.ok(await id('run').isDisabled());
    await id('tool-machine').press('Enter');await site('mobile').press('Enter');
    await id('tool-screen').press('Enter');await site('mobile').press('Enter');
    await id('tool-rides').press('Enter');await site('mobile').press('Enter');
    assert.match(await id('setup-note').textContent(),/over the clinic/);assert.ok(await id('run').isDisabled());
    await id('tool-rides').press('Enter');await site('rack').press('Enter');
    await id('run').click();
    await id('advanced').locator('summary').click();
    const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('aplab:openscied:b3-screening:v1')));
    const baseline=M.run(saved.seed,M.baseline),trial=M.run(saved.seed,saved.trial);
    assert.match(await id('results').locator('table').first().locator('tr').filter({hasText:'Network’s clinic cost'}).innerText(),/525 cr.*650 cr/s);
    assert.deepEqual(await id('results').locator('table').first().locator('tr').filter({hasText:/^Completed ultrasound/}).locator('td').allTextContents(),[String(baseline.imaged),String(trial.imaged)]);
    await id('other-cases').locator('summary').click();
    await id('view').selectOption('base');
    const blocked=baseline.patients.find(x=>x.outcome==='screen-missed');
    if(blocked){await id('patients').locator('button').nth(blocked.id-1).click();assert.match(await id('map-event').textContent(),/Missed screening/);}
    await id('view').selectOption('trial');
    assert.equal(await id('patients').locator('[aria-pressed="true"]').count(),1);
    await id('other-cases').locator('summary').click();
    await shot('comparison');
    await id('to-explain').click();assert.match(await id('evidence').innerText(),/Simulated outcome/);
    assert.match(await id('case-evidence').innerText(),/Hospital plan:.*Redesign:/s);
    await id('claim').fill('The redesign costs more in exchange for more completed ultrasound visits.');
    await id('limit').fill('Vouchers could help with the price of a trip, but cannot create more time.');
    await id('finish').click();await p.reload();
    assert.match(await id('finished').textContent(),/Investigation complete/);
    assert.match(await id('claim').inputValue(),/redesign/);
    await p.getByRole('button',{name:'Preview report'}).click();
    assert.match(await p.getByRole('dialog').filter({hasText:'Cancer Screening Design Lab'}).innerText(),/Ultrasound acquisition/);
    assert.deepEqual(errors,[]);
    console.log('ok: Screening Design '+width+'px — map, staffing gate, budget, fair comparison, reload, report');
   }finally{await ctx.close();}
  }
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
