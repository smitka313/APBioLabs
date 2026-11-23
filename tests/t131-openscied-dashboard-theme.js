/* Focused masthead, image-led cards and legacy controls smoke test: only openscied-dashboard.html. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('./_h');

const sizes = [[390,844,true],[768,910,false],[940,850,false],[1366,900,false],[1920,1080,false]];
const screenshots = process.env.OPENSCIED_DASHBOARD_SCREENSHOTS;
const fixture = {'aplab:student':JSON.stringify({name:'Theme Check',period:'3'})};

(async () => {
  const site = await T.serve();
  let browser;
  try {
    const executablePath = process.env.CHROMIUM_PATH;
    browser = await T.launch(executablePath ? {executablePath} : undefined);
    if (screenshots) fs.mkdirSync(screenshots,{recursive:true});
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
        assert.equal(await p.locator('.dashboard-masthead a[href="openscied-teacher-guide.html"]').count(),1);
        assert.equal(await p.locator('.dashboard-hero .dashboard-student').isVisible(),true);
        assert.equal(await p.locator('#openscied-student-identity').isVisible(),true);
        assert.equal(await p.locator('#clear-openscied-results').isVisible(),true);
        assert.equal(await p.locator('#download-openscied-results').isVisible(),true);
        const brand=p.locator('.dashboard-brand');
        await brand.focus();
        await p.keyboard.press('Tab');
        assert.equal(await p.locator('.dashboard-teacher').evaluate(el=>el===document.activeElement),true);
        await p.keyboard.press('Tab');
        assert.equal(await p.locator('.dashboard-theme-controls').evaluate(el=>el.contains(document.activeElement)),true);
        assert.equal(await p.evaluate(()=>{
          const before=(a,b)=>Boolean(document.querySelector(a).compareDocumentPosition(document.querySelector(b))&Node.DOCUMENT_POSITION_FOLLOWING);
          return before('.dashboard-brand','.dashboard-student')&&before('.dashboard-student','.dashboard-activity');
        }),true,'return link and student workspace still come before activity cards');
        assert.equal(await p.locator('.dashboard-hero-art').evaluate(img=>img.complete&&img.naturalWidth>0),true);
        const unit1=p.locator('[aria-labelledby="unit1"]');
        const geometry=await unit1.locator('article').evaluateAll(cards=>cards.map(c=>{
          const a=c.getBoundingClientRect(), b=c.querySelector('.dashboard-preview').getBoundingClientRect();
          return {x:Math.round(a.x),y:Math.round(a.y),width:a.width,thumb:b.width,height:b.height};
        }));
        assert.equal(geometry.length,3);
        assert.equal(new Set(geometry.map(c=>c.x)).size,width<580?1:width<920?2:3,'cards use the intended breakout columns');
        assert.ok(geometry.every(c=>c.thumb>0&&Math.abs(c.thumb/c.height-1.6)<.05),'preview artwork keeps the common 8:5 proportions');
        assert.equal(await p.locator('.dashboard-activity').evaluateAll(cards=>cards.every(card=> {
          const box=card.getBoundingClientRect();
          return [...card.querySelectorAll('.dashboard-caption, h3, p, .dashboard-meta, button, .dashboard-open')].every(n=>{
            const r=n.getBoundingClientRect();
            return r.left>=box.left-1&&r.right<=box.right+1 &&
              n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1;
          });
        })),true,'descriptions, captions and buttons fit even at the narrower three-column width');
        assert.deepEqual(await p.locator('.dashboard-units h2[id^="unit"]').evaluateAll(e=>e.map(x=>x.id)),['unit1','unit2','unit3','unit4','unit5']);
        assert.equal(await p.locator('#hawksbeard-open').getAttribute('href'),'openscied-b4-hawksbeard.html');
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<= innerWidth + 1),true,'no page overflow');
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
