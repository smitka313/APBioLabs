/* Focused masthead, image-led cards and legacy controls smoke test: only openscied-dashboard.html. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('./_h');

const sizes = [[390,844,true],[768,910,false],[940,850,false],[1366,900,false],[1920,1080,false]];
const screenshots = process.env.OPENSCIED_DASHBOARD_SCREENSHOTS;
const fixture = {'aplab:student':JSON.stringify({name:'Theme Check',period:'3'})};

// Force a real first paint before either of the shared scripts is available.
async function checkMastheadLayout(browser,site,seed,description) {
  // The shared helper signs in by default; the fresh-visit path needs genuinely empty storage.
  const ctx=await browser.newContext({viewport:{width:375,height:900},reducedMotion:'reduce'});
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  try {
    if(seed) await ctx.addInitScript(values=>{for(const [key,value] of Object.entries(values)) localStorage.setItem(key,value);},seed);
    await ctx.route(/https:\/\/(?:fonts\.(?:googleapis|gstatic)\.com|gc\.zgo\.at)\//,route=>route.abort());
    await ctx.route(/\/(?:lab|openscied-dashboard)\.js(?:\?.*)?$/, async route=>{await gate; await route.continue();});
    const p=await ctx.newPage();
    await p.goto(site.url+'openscied-dashboard.html',{waitUntil:'commit'});
    await p.locator('.dashboard-student-note').first().waitFor();
    const measure=()=>p.evaluate(async()=>{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return Object.fromEntries(['.dashboard-panorama','.dashboard-student-note','#openscied-results-status','#activities'].map(selector=>
        [selector,document.querySelector(selector).getBoundingClientRect().top]));
    });
    const status=p.locator('#openscied-results-status');
    const initialStatus=await status.textContent();
    assert.match(initialStatus,/^No saved work yet\. Choose an activity to get started\.$/,'initial workspace status is reserved before scripts mount');
    const placeholder=p.locator('#openscied-student-identity [data-ph="dashboard-identity"]');
    const reservedLabels=seed?await placeholder.locator('button').allTextContents():[];
    const before=await measure();
    assert.equal(await p.locator('.dashboard-theme-controls .theme-opt').count(),0,'theme script is still delayed');
    release();
    await p.locator('.dashboard-theme-controls .theme-opt').first().waitFor();
    await p.locator('#openscied-student-identity '+(seed?'.id-line':'.id-panel')).waitFor();
    if(seed) {
      const liveLabels=await p.locator('#openscied-student-identity .id-line button').allTextContents();
      assert.deepEqual(liveLabels,reservedLabels,'placeholder reserves the same labels as the shared-device controls');
    }
    const after=await measure();
    assert.equal(await status.textContent(),initialStatus,'empty workspace status matches refresh');
    for(const selector of Object.keys(before)) {
      assert.ok(Math.abs(after[selector]-before[selector])<=2,
        description+': '+selector+' must keep its position as controls mount ('+before[selector]+' → '+after[selector]+' px)');
    }
    console.log('375px '+description+': no late layout growth from theme or student controls');
  } finally { release(); await ctx.close(); }
}

// A returning visitor can still have an older dashboard script in cache.
async function checkMixedVersionWorkspace(browser,site) {
  const ctx=await browser.newContext({viewport:{width:1195,height:845},colorScheme:'dark',reducedMotion:'reduce'});
  try {
    await ctx.addInitScript(()=>localStorage.setItem('aplab:openscied:b4-hawksbeard:v1',
      JSON.stringify({prediction:'city',released:2,lastSection:'release',lastVisitedAt:1680000000000,v:1,answers:{}})));
    await ctx.route(/https:\/\/(?:fonts\.(?:googleapis|gstatic)\.com|gc\.zgo\.at)\//,route=>route.abort());
    const p=await ctx.newPage();
    await p.goto(site.url+'openscied-dashboard.html');
    await p.locator('#openscied-student-identity .id-panel').waitFor();
    const savedWork = p.getByRole('region', { name:'Saved work on this device', exact:true });
    await savedWork.waitFor();
    assert.match(await savedWork.locator('#openscied-resume-description').innerText(),
      /Continue only if this work is yours\. Otherwise, switch students\./);
    const resume = savedWork.getByRole('link', { name:'Continue my saved Hawksbeard Wind Lab →', exact:true });
    assert.equal(await resume.getAttribute('href'), 'openscied-b4-hawksbeard.html#release');
    assert.equal(await resume.getAttribute('aria-describedby'), 'openscied-resume-description',
      'the shared-device warning also describes the focused Resume link');
    async function placement() {
      return p.evaluate(()=>{
        const jump=document.querySelector('.dashboard-unit-jumps'), resume=document.querySelector('#openscied-resume');
        const left=document.querySelector('.dashboard-hero-copy'), workspace=document.querySelector('.dashboard-student');
        const a=jump.getBoundingClientRect(), b=resume.getBoundingClientRect(),
          c=left.getBoundingClientRect(), d=workspace.getBoundingClientRect();
        return {
          directlyAfter:jump.nextElementSibling===resume && resume.parentElement===left,
          belowLinks:b.top>=a.bottom && b.top-a.bottom<=24,
          withinLeft:b.left>=c.left-1 && b.right<=c.right+1,
          beforeWorkspace:b.right<d.left || b.bottom<d.top,
          besideWorkspace:b.right<d.left,
        };
      });
    }
    const desktop=await placement();
    assert.deepEqual(desktop,{directlyAfter:true,belowLinks:true,withinLeft:true,beforeWorkspace:true,besideWorkspace:true},
      'desktop: saved work sits beneath the unit shortcuts, to the left of the workspace');
    const heights=await p.evaluate(()=>{
      const host=document.querySelector('#openscied-student-identity');
      const live=host.querySelector('.id-box:not([data-ph])');
      const top=selector=>document.querySelector(selector).getBoundingClientRect().top;
      const before=top('#activities');
      const old=live.cloneNode(true);
      old.dataset.ph='dashboard-identity';
      old.inert=true;
      old.setAttribute('aria-hidden','true');
      host.prepend(old);
      const after=top('#activities');
      return {before,after,placeholderDisplay:getComputedStyle(old).display,
        layoutGap:live.getBoundingClientRect().top-top('#student-panel-title'),
        heroOffset:Math.abs(top('.dashboard-hero-copy')-top('.dashboard-hero-actions'))};
    });
    assert.equal(heights.placeholderDisplay,'none','the real form wins over a lingering placeholder');
    assert.ok(heights.layoutGap<=60,'sign-in sits directly below the workspace title: '+heights.layoutGap+'px');
    assert.ok(heights.heroOffset<=2,'hero copy and workspace begin on the same line');
    assert.ok(Math.abs(heights.after-heights.before)<=2,'duplicate reservation must not push down the activities');
    if(screenshots)await p.screenshot({path:path.join(screenshots,'1195-returning-workspace.png'),fullPage:true,animations:'disabled'});
    await p.setViewportSize({width:390,height:844});
    const phone=await placement();
    assert.deepEqual(phone,{directlyAfter:true,belowLinks:true,withinLeft:true,beforeWorkspace:true,besideWorkspace:false},
      'phone: saved work stacks directly under the unit shortcuts and above the workspace');
    await p.locator('.dashboard-unit-jumps a').last().focus();
    await p.keyboard.press('Tab');
    assert.ok(await resume.evaluate(link => document.activeElement===link),
      'saved activity is the next keyboard stop after the last unit shortcut');
    const active=p.locator('.dashboard-activity').filter({ has:p.locator('#hawksbeard-open') });
    assert.equal(await active.locator('progress.dashboard-activity-progress').isVisible(),true,'saved milestones remain visible on phones');
    assert.equal(await active.locator('#hawksbeard-reset').isVisible(),true,'students can still restart saved activities on phones');
    assert.equal(await active.evaluate(card=>card.querySelector('.dashboard-open').nextElementSibling===card.querySelector('.dashboard-card-restart')),true,'the primary activity link precedes Restart in keyboard order');
    if(screenshots)await p.screenshot({path:path.join(screenshots,'390-returning-workspace.png'),fullPage:true,animations:'disabled'});
    console.log('1195px returning workspace: stale placeholder collapses and both sides are top aligned');
  } finally { await ctx.close(); }
}

(async () => {
  const site = await T.serve();
  let browser;
  try {
    const executablePath = process.env.CHROMIUM_PATH;
    browser = await T.launch(executablePath ? {executablePath} : undefined);
    if (screenshots) fs.mkdirSync(screenshots,{recursive:true});
    await checkMastheadLayout(browser,site,undefined,'fresh visit');
    await checkMastheadLayout(browser,site,fixture,'returning student');
    await checkMixedVersionWorkspace(browser,site);
    for (const [width,height,dark] of sizes) {
      const ctx=await T.ctxFor(browser,{width,height,dark,reduced:true,touch:width===390,seed:fixture});
      try {
        await ctx.route(/https:\/\/(?:fonts\.(?:googleapis|gstatic)\.com|gc\.zgo\.at)\//,route=>route.abort());
        const p=await ctx.newPage(), errors=[];
        p.on('pageerror',error=>errors.push(error.message));
        await p.goto(site.url+'openscied-dashboard.html');
        await p.locator('.dashboard-theme-controls .theme-opt').first().waitFor();
        assert.equal(await p.getByRole('heading',{level:1}).textContent(),'Biology Companion Activities');
        assert.equal(await p.locator('.dashboard-masthead a[href="index.html"]').count(),1);
        const teacherGuide=p.locator('a[href="openscied-teacher-guide.html"]');
        assert.equal(await teacherGuide.count(),0,'teacher navigation stays on the teacher landing page');
        assert.equal(await p.locator('.dashboard-hero .dashboard-student').isVisible(),true);
        assert.equal(await p.locator('#openscied-student-identity').isVisible(),true);
        assert.equal(await p.locator('#clear-openscied-results').isVisible(),true);
        assert.equal(await p.locator('#download-openscied-results').isVisible(),true);
        assert.ok(await p.locator('#openscied-resume').evaluate(panel=>panel.hidden && panel.getClientRects().length===0),
          'fresh visit: the resume panel leaves no placeholder below unit shortcuts');
        const brand=p.locator('.dashboard-masthead .bench-logo');
        await brand.focus();
        await p.keyboard.press('Tab');
        assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('href')),'ap-biology.html');
        await p.keyboard.press('Tab');
        assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('href')),'openscied-dashboard.html');
        await p.keyboard.press('Tab');
        assert.equal(await p.locator('.dashboard-theme-controls').evaluate(el=>el.contains(document.activeElement)),true,
          'the theme control follows the course links in the masthead tab order');
        assert.equal(await p.evaluate(()=>{
          const before=(a,b)=>Boolean(document.querySelector(a).compareDocumentPosition(document.querySelector(b))&Node.DOCUMENT_POSITION_FOLLOWING);
          return before('.dashboard-masthead .bench-logo','.dashboard-student')&&before('.dashboard-student','.dashboard-activity');
        }),true,'return link and student workspace still come before activity cards');
        const panorama = await p.locator('.dashboard-hero-art').evaluate(async img => {
          await img.decode();
          const { width, height } = img.getBoundingClientRect();
          return { file: new URL(img.currentSrc).pathname.split('/').pop(), width, height };
        });
        const isPhone = width <= 580;
        assert.equal(panorama.file, isPhone ? 'bench-field-atlas-mobile.webp' : 'bench-field-atlas-desktop.webp',
          'phones load the wildebeest-and-cell crop; wider screens load the full atlas');
        const ratio = isPhone ? 544 / 1200 : 302 / 1800;
        assert.ok(Math.abs(panorama.height - panorama.width * ratio) <= 1, 'banner is not stretched or cropped');
        const unit1=p.locator('[aria-labelledby="unit1"]');
        const geometry=await unit1.locator('article').evaluateAll(cards=>cards.map(c=>{
          const a=c.getBoundingClientRect(), b=c.querySelector('.dashboard-preview').getBoundingClientRect();
          return {x:Math.round(a.x),y:Math.round(a.y),width:a.width,thumb:b.width,height:b.height};
        }));
        assert.equal(geometry.length,5);
        assert.equal(new Set(geometry.map(c=>c.x)).size,width<580?1:width<920?2:3,'cards use the intended breakout columns');
        assert.ok(geometry.every(c=>c.thumb>0&&Math.abs(c.thumb/c.height-1.6)<.05),'preview artwork keeps the common 8:5 proportions');
        const overflow = await p.locator('.dashboard-activity').evaluateAll(cards=>cards.flatMap(card=> {
          const box=card.getBoundingClientRect();
          const intentionallyEmpty = matchMedia('(max-width: 580px)').matches &&
            !!card.querySelector('.dashboard-card-restart:disabled');
          return [...card.querySelectorAll('.dashboard-caption, h3, p, .dashboard-meta, button, .dashboard-open')].flatMap(n=>{
            const rendered=n.getClientRects().length > 0;
            // The phone UI intentionally doesn't render disabled Restart or empty progress labels.
            // A hidden title, description, primary link, or active Restart must still fail.
            if (!rendered && intentionallyEmpty && n.matches('.dashboard-card-restart:disabled, .dashboard-activity-metric')) return [];
            const r=n.getBoundingClientRect();
            if (rendered && r.left>=box.left-1&&r.right<=box.right+1 &&
              n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1) return [];
            return [{card:card.querySelector('h3')?.textContent, control:n.id||n.className||n.tagName,
              rendered, left:r.left, right:r.right, cardLeft:box.left, cardRight:box.right,
              scrollWidth:n.scrollWidth, clientWidth:n.clientWidth, scrollHeight:n.scrollHeight, clientHeight:n.clientHeight}];
          });
        }));
        assert.deepEqual(overflow,[],width+' px: visible descriptions, captions and actions fit within their cards');
        assert.deepEqual(await p.locator('.dashboard-units h2[id^="unit"]').evaluateAll(e=>e.map(x=>x.id)),['unit1','unit2','unit3','unit4','unit5']);
        assert.equal(await p.locator('#wapusk-open').getAttribute('href'),'openscied-b5-wapusk.html');
        assert.equal(await p.locator('#hawksbeard-open').getAttribute('href'),'openscied-b4-hawksbeard.html');
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<= innerWidth + 1),true,'no page overflow');
        if (width <= 580) {
          const cards = p.locator('.dashboard-activity');
          assert.equal(await cards.locator('.dashboard-card-restart:visible').count(),0,'blank phone cards do not show inactive Restart');
          assert.equal(await cards.locator('.dashboard-activity-metric:visible, .dashboard-activity-progress:visible').count(),0,'blank phone cards do not show empty measures');
          assert.equal(await cards.locator('.dashboard-open:visible').count(),24,'each blank phone card still has its Open activity action');
        }
        const saveImage=async label=>{if(screenshots) await p.screenshot({path:path.join(screenshots,width+'-'+label+'.png'),animations:'disabled'});};
        await saveImage('masthead');
        await p.getByRole('link',{name:'Browse activities'}).press('Enter');
        await p.waitForFunction(()=>location.hash==='#activities');
        assert.equal(await p.locator('#activities').evaluate(el=>el.getBoundingClientRect().top>=-2&&el.getBoundingClientRect().top<innerHeight),true);
        await unit1.locator('.dashboard-preview').first().evaluate(el=>el.querySelector('img').decode());
        await saveImage('activity-cards');
        assert.deepEqual(errors,[]);
        console.log(width+'px '+(dark?'dark':'light')+': masthead, controls, image-led cards and unit navigation passed');
      } finally { await ctx.close(); }
    }
  } finally { if(browser)await browser.close(); site.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
