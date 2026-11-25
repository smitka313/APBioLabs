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
    // One viewport resumes a legacy district for which a tie is the best result.
    if(width===1920)await p.addInitScript(()=>{
      const key='aplab:openscied:b3-screening:v1';
      if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({v:1,seed:1161}));
    });
    await p.goto(server.url+'openscied-b3-screening.html');
    const shot=async name=>{
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.ok(await p.locator('.sd-board').evaluate(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('.sd-home,.sd-site')].every(s=>{const b=s.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom;});}));
      await p.screenshot({path:path.join(out,width+'-'+name+'.png'),fullPage:true,animations:'disabled'});
    };
    assert.ok(await id('map-grid').isHidden());
    const profiles=id('profiles').locator('article');
    assert.equal(await profiles.count(),3);
    assert.equal(await profiles.locator('.sd-avatar svg').count(),3);
    assert.ok(await p.locator('.sd-hero-art').isVisible());
    const initial=await profiles.allTextContents();
    for(const [i,place] of M.places.entries()){
      assert.match(initial[i],new RegExp(place+'.*Income:.*Hospital: '+M.distances[i].hub+' mi.*Mobile clinic: '+M.distances[i].mobile+' mi'));
    }
    assert.equal(initial.filter(t=>t.includes('Screening + ultrasound follow-up')).length,2);
    assert.equal(initial.filter(t=>t.includes('Screening only')).length,1);
    const dataset=await id('dataset').textContent();
    assert.match(dataset,/SD-[A-F0-9]{8}.*differ from student to student/);
    await p.reload();assert.deepEqual(await profiles.allTextContents(),initial);
    assert.equal(await id('dataset').textContent(),dataset);
    await profiles.first().getByRole('button',{name:/Open cost sheet/}).click();
    const intake=await p.evaluate(()=>JSON.parse(localStorage.getItem('aplab:openscied:b3-screening:v1')));
    assert.ok(width===1920?intake.seed===1161&&M.bestGain(intake.seed)===0:intake.caseMode==='equity'&&M.equityCases(intake.seed).length===3);
    const first=(intake.caseMode==='equity'?M.equityCases(intake.seed):M.scenarios(intake.seed))[0];
    const prices=id('price-sheet').locator('.sd-visit');
    assert.equal(await prices.count(),4);
    for(const [i,[kind,site]] of [['screen','hub'],['screen','mobile'],['scan','hub'],['scan','mobile']].entries()){
      const quote=M.quote(first,site,kind,M.baseline);
      const text=await prices.nth(i).innerText();
      assert.match(text,new RegExp(quote.miles+' mi.*'+quote.time+' h'));
      assert.match(text,new RegExp('Test fee\\s+'+quote.fee+' cr'));
      assert.match(text,new RegExp('Drive\\s+'+quote.travel+' cr'));
    }
    for(const [name,plan] of [['base',M.baseline],['trial',{...M.baseline,machine:'mobile',operator:'mobile'}]]){
      await id('pay-plan').selectOption(name);
      await id('pay-reset').click();
      let balance=first.means;
      for(const kind of (first.needed?['screen','scan']:['screen'])){
        const q=M.quote(first,kind==='screen'?plan.screen:plan.machine,kind,plan);
        const tx=M.checkout(q,balance,first.hours);
        await id('book').click();
        assert.match(await id('pay-result').textContent(),tx.ok?/booked/:/Could not book/);
        if(!tx.ok||kind==='scan'||!first.needed){
          assert.ok(await id('mission-dialog').isVisible());
          assert.match(await id('popup-title').textContent(),tx.ok?/within budget|opened a path/:/Over this patient|Not enough time/);
          await id('popup-close').click();
        }
        balance=tx.remaining;
        assert.match(await id('wallet').innerText(),new RegExp(balance+' cr of '+first.means+' cr left'));
        if(!tx.ok)break;
      }
    }
    await id('pay-plan').selectOption('local');
    assert.match(await id('wallet').innerText(),/Next: Shared mobile clinic/);
    await id('pay-plan').selectOption('base');
    const baseTrip=M.run(intake.seed,M.baseline).patients[first.id-1];
    assert.match(await id('wallet').innerText(),new RegExp((first.means-baseTrip.paid)+' cr of '+first.means+' cr left'));
    assert.ok(await id('map-grid').isHidden());
    await profiles.first().getByRole('button',{name:/Open cost sheet/}).click();
    assert.ok(await id('quote-board').isHidden());
    await p.screenshot({path:path.join(out,width+'-patient-intake.png'),fullPage:true,animations:'disabled'});
    assert.equal(await id('stage').textContent(),'Step 1 of 3');
    assert.ok(await id('quick').isHidden());assert.ok(await id('advanced').isHidden());assert.ok(await id('cost-details').isHidden());
    await id('run').click();await shot('hospital-setup');
    assert.equal(await id('stage').textContent(),'Step 2 of 3');
    assert.ok(await id('quick').isVisible());assert.ok(await id('tool-machine').isHidden());
    assert.ok(await id('to-explain').isHidden());assert.ok(await id('patients').isHidden());
    const starter=await id('story').locator('h4').textContent();
    if(width===1366&&!(await id('story').innerText()).includes('Missed screening'))await id('replay').click();
    if(width===1366&&!(await id('story').innerText()).includes('Missed screening'))await p.waitForFunction(()=>/Patient .* is traveling/.test(document.querySelector('#sd-map-event').textContent),null,{timeout:5000});
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
    assert.match(await id('status').textContent(),/Choose a case and compare the two plans/);
    assert.match(await id('decision-score').textContent(),/Answer its comparison correctly to fill that row/);
    assert.equal(await id('story').locator('h4').textContent(),starter);
    assert.match(await id('story').textContent(),/Hospital plan:.*Redesign:/s);
    assert.ok(await id('patients').isHidden());
    await id('cart').locator('summary').click();
    assert.equal(await id('sonogram-mass').getAttribute('visibility'),'hidden');
    await id('mark').click();assert.match(await id('scan-feedback').textContent(),/Sweep farther/);
    await id('probe').evaluate(e=>{e.value='60';});await id('probe').press('ArrowRight');
    assert.match(await id('probe-note').textContent(),/darker oval/);
    assert.equal(await id('sonogram-mass').getAttribute('visibility'),'visible');
    assert.equal(await id('point-text').getAttribute('visibility'),'hidden');
    await id('mark').click();
    assert.equal(await id('point-text').getAttribute('visibility'),'visible');
    assert.match(await id('scan-feedback').textContent(),/not a cancer diagnosis/);
    await shot('ultrasound-finding');
    const marked=await id('probe').inputValue();
    await id('probe').press('End');assert.equal(await id('sonogram-mass').getAttribute('visibility'),'hidden');
    await id('probe-return').click();assert.equal(await id('probe').inputValue(),marked);
    assert.equal(await id('sonogram-mass').getAttribute('visibility'),'visible');
    await id('cart').locator('summary').click();
    await id('advanced').locator('summary').click();
    await id('tool-machine').press('Enter');await site('hub').press('Enter');
    assert.match(await id('setup-note').textContent(),/same site/);assert.ok(await id('run').isDisabled());
    await id('tool-machine').press('Enter');await site('mobile').press('Enter');
    await id('tool-screen').press('Enter');await site('mobile').press('Enter');
    await id('tool-rides').press('Enter');await site('mobile').press('Enter');
    assert.match(await id('setup-note').textContent(),/over the clinic/);assert.ok(await id('run').isDisabled());
    assert.ok(await id('mission-dialog').isVisible());
    assert.match(await id('popup-title').textContent(),/Over the clinic budget/);
    assert.match(await id('popup-message').textContent(),/745 cr.*720 cr.*25 cr/);
    assert.equal(await id('clinic-gauge').getAttribute('data-over'),'true');
    assert.ok(await id('popup-seal').locator('svg').isVisible());
    assert.match(await id('popup-evidence').textContent(),/Ride program.*95 cr/);
    await id('popup-close').click();
    await id('tool-rides').press('Enter');await site('rack').press('Enter');
    await id('run').click();
    await id('advanced').locator('summary').click();
    const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('aplab:openscied:b3-screening:v1')));
    const baseline=M.run(saved.seed,M.baseline),trial=M.run(saved.seed,saved.trial);
    assert.match(await id('results').locator('table').first().locator('tr').filter({hasText:'Network’s clinic cost'}).innerText(),/525 cr.*650 cr/s);
    assert.deepEqual(await id('results').locator('table').first().locator('tr').filter({hasText:/^Completed ultrasound/}).locator('td').allTextContents(),[String(baseline.imaged),String(trial.imaged)]);
    await id('other-cases').locator(':scope > summary').click();
    await id('view').selectOption('base');
    const blocked=baseline.patients.find(x=>x.outcome==='screen-missed');
    if(blocked){await id('patients').locator('button').nth(blocked.id-1).click();assert.match(await id('map-event').textContent(),/Missed screening/);}
    await id('view').selectOption('trial');
    assert.equal(await id('patients').locator('[aria-pressed="true"]').count(),1);
    await id('other-cases').locator(':scope > summary').click();
    await shot('comparison');
    assert.ok(await id('to-explain').isDisabled());
    assert.equal(await id('cases').locator('.sd-unresolved').count(),6);
    const featured=saved.caseMode==='equity'?M.equityCases(saved.seed):M.scenarios(saved.seed);
    for(const [i,c] of featured.entries()){
      await id('cases').getByRole('button').nth(i).click();
      const answer=M.comparison(baseline.patients[c.id-1],trial.patients[c.id-1]);
      if(i===0){
        await id('case-pick').selectOption(answer==='both'?'neither':'both');
        await id('check-case').click();assert.match(await id('case-feedback').textContent(),/Not quite/);
      }
      await id('case-pick').selectOption(answer);await id('check-case').click();
      assert.match(await id('case-progress').textContent(),new RegExp((i+1)+' of 3'));
      assert.equal(await id('cases').locator('.sd-decision-stamp').count(),2*(i+1));
      assert.match(await id('decision-score').textContent(),new RegExp('Among the '+(i+1)+' checked'));
      if(i===0){await p.reload();assert.match(await id('case-progress').textContent(),/1 of 3/);assert.ok(await id('to-explain').isDisabled());}
    }
    const mission=M.mission(M.run(saved.seed,M.baseline),M.run(saved.seed,saved.trial),saved.caseMode==='equity'?featured:[]);
    assert.ok(await id('mission-dialog').isVisible());
    assert.match(await id('popup-title').textContent(),width===1920?/Best attainable result!/:mission.won?/Mission won!/:/Access goal not met/);
    assert.match(await id('popup-message').textContent(),new RegExp(mission.left+' cr to spare'));
    if(mission.won)await id('popup-close').click();
    else{
      await id('edit-plan').click();
      assert.match(await id('case-progress').textContent(),/3 of 3/);
      assert.ok(await id('results').locator('table').first().isVisible());
    }
    await id('to-explain').click();assert.match(await id('evidence').innerText(),/Simulated outcome/);
    assert.equal(await id('case-evidence').locator(':scope > details').count(),3);
    assert.match(await id('case-evidence').innerText(),/Hospital plan:.*Redesign:/s);
    await id('claim').fill('The redesign costs more in exchange for more completed ultrasound visits.');
    await id('limit').fill('Vouchers could help with the price of a trip, but cannot create more time.');
    await id('finish').click();await p.reload();
    assert.match(await id('finished').textContent(),/Investigation complete/);
    assert.match(await id('claim').inputValue(),/redesign/);
    await p.getByRole('button',{name:'Preview report'}).click();
    assert.match(await p.getByRole('dialog').filter({hasText:'Cancer Screening Design Lab'}).innerText(),/Three patient scenarios.*Your comparison answers.*(Both plans|Neither plan|Hospital only|Redesign only).*Dispatch mission results.*Ultrasound acquisition.*Itemized patient cost sheets/s);
    assert.deepEqual(errors,[]);
    console.log('ok: Screening Design '+width+'px — map, staffing gate, budget, fair comparison, reload, report');
   }finally{await ctx.close();}
  }
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
