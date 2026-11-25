/* Focused regression for dashboard-only illustrations; skips neither lazy images nor phone sizing. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('./_h');

const originals = {
  "b5-wapusk": [
    "openscied-wapusk-card.svg",
    960,
    600
  ],
  "b5-thermoregulation": [
    "openscied-bear-thermoregulation.svg",
    1000,
    480
  ],
  "b5-ancestry": [
    "openscied-bear-ancestry.svg",
    1000,
    480
  ]
};
const keys = [
  'b1-migration','b1-carrying-capacity','b1-serengeti','b1-ripple',
  'b2-burn-lab','b2-fires','b2-peat-bog-lab','b2-carbon-journey',
  'b3-cancer-rates','b3-screening','b3-cell-cycle','b3-dna-workshop','b3-dna-p53','b3-inheritance-environment',
  'b4-hawksbeard','b4-rat-generations','b4-junco','b4-wildlife-corridor',
  'b5-wapusk','b5-thermoregulation','b5-ancestry','b5-speciation','b5-hybrid',
];

(async () => {
  const site = await T.serve();
  let browser;
  try {
    browser = await T.launch();
    for (const [width,height,theme] of [[390,844,'dark'],[768,910,'light'],[1366,900,'light'],[1920,1080,'light']]) {
      const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:1,colorScheme:theme,reducedMotion:'reduce'});
      try {
        await context.route(/https:\/\/(?:fonts\.(?:googleapis|gstatic)\.com|gc\.zgo\.at)\//,route=>route.abort());
        const page=await context.newPage();
        await page.goto(site.url+'openscied-dashboard.html');
        const panorama=await page.locator('.dashboard-hero-art').evaluate(async img=>{
          await img.decode();
          return {src:img.currentSrc,alt:img.alt,loaded:img.naturalWidth>0};
        });
        assert.ok(panorama.loaded && /wildebeest.*polar bear/i.test(panorama.alt));
        if(width===390)assert.match(panorama.src,/openscied-atlas-hero-small\.webp$/);
        for (const key of keys) {
          const poster=page.locator('.dashboard-preview[href="openscied-'+key+'.html"] img');
          await poster.scrollIntoViewIfNeeded();
          const report=await poster.evaluate(async (img) => {
            await img.decode();
            const [art,outer,card]=[img,img.parentElement,img.closest('article')].map(x=>x.getBoundingClientRect());
            return {nw:img.naturalWidth,nh:img.naturalHeight,loaded:img.complete,
              width:img.getAttribute('width'),height:img.getAttribute('height'),
              alt:img.alt, decorative:img.parentElement.getAttribute('aria-hidden'),
              fits:Math.abs(art.width-outer.width)<=2&&Math.abs(art.height-outer.height)<=2
                &&art.left>=card.left-1&&art.right<=card.right+1&&art.width>100,
              src:img.getAttribute('src')};
          });
          const [filename,nw,nh]=originals[key]??['openscied-atlas-'+key+'.svg',960,600];
          const {nw:decodedWidth,nh:decodedHeight,...layout}=report;
          assert.deepEqual(layout,{width:String(nw),height:String(nh),loaded:true,alt:'',decorative:'true',
            fits:true,src:'assets/'+filename},width+'px '+key);
          if (key==='b5-ancestry') {
            // This original SVG has a viewBox but no inherent pixel size. Chromium
            // reports a fallback natural size (300 × 144), not the viewBox dimensions.
            assert.ok(decodedWidth>0&&decodedHeight>0&&Math.abs(decodedWidth/decodedHeight-nw/nh)<.01,
              width+'px '+key+' preserves the original SVG aspect ratio');
          } else {
            assert.deepEqual([decodedWidth,decodedHeight],[nw,nh],width+'px '+key+' intrinsic size');
          }
        }
        if (process.env.OPENSCIED_DASHBOARD_SCREENSHOTS) {
          fs.mkdirSync(process.env.OPENSCIED_DASHBOARD_SCREENSHOTS,{recursive:true});
          for(const unit of [1,2,3,4,5]) {
            await page.locator('section[aria-labelledby="unit'+unit+'"]').screenshot({path:path.join(process.env.OPENSCIED_DASHBOARD_SCREENSHOTS,width+'-unit-'+unit+'.png')});
          }
          await page.locator('.dashboard-panorama').screenshot({path:path.join(process.env.OPENSCIED_DASHBOARD_SCREENSHOTS,width+'-hero.png')});
        }
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Dashboard never scrolls horizontally at '+width+'px');
        console.log(width+'px '+theme+': banner and all '+keys.length+' previews load and fit');
      } finally { await context.close(); }
    }
  } finally {
    await browser?.close();
    await site.close();
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
