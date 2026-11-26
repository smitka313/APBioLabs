'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const {ROOT,serve}=require('./_h');
(async()=>{
 const site=await serve();
 let browser;
 try{
  browser=await chromium.launch();
  const out=path.join(ROOT,'artifacts','field-notebook');
  await fs.mkdir(out,{recursive:true});
  for(const [width,mode] of [[390,'dark'],[768,'dark'],[1366,'light'],[1920,'light']]){
   const cx=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,reducedMotion:'reduce'});
   try{
    await cx.addInitScript(m=>localStorage.setItem('aplab:pref:theme',m),mode);
    await cx.route('**/*',r=>new URL(r.request().url()).origin===new URL(site.url).origin?r.continue():r.abort());
    const p=await cx.newPage(), errors=[];
    p.on('pageerror',err=>errors.push(err.message));
    await p.goto(site.url+'openscied-b1-field-notebook.html');
    const by=k=>p.locator('#sf-'+k), page=k=>p.locator('[data-page="'+k+'"]'), go=k=>p.locator('[data-go="'+k+'"]');
    const shot=async stage=>{
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' fits '+stage);
      await p.screenshot({path:path.join(out,width+'-'+stage+'.png'),fullPage:true,animations:'disabled'});
    };
    assert.equal(await p.locator('html').getAttribute('data-theme'),mode);
    assert.ok(await go('explore').isDisabled());
    await by('question1').fill('What did people want to protect?');
    await by('question2').fill('What did people want to protect?');assert.ok(await go('explore').isDisabled());
    await by('question2').fill('Why did the boundaries change?');
    await shot('orientation');
    await go('explore').click();
    assert.ok(await page('explore').isVisible());
    assert.ok(await go('explain').isDisabled());
    assert.equal(await p.locator('iframe').count(),0);
    const stations=[
      ['habitats',/open grassland.*woodland/],
      ['biodiversity',/giraffe.*lion.*ants/],
      ['movement',/Wildebeest.*Mara River/],
      ['conservation',/hatched and dashed.*solid/],
      ['people',/cattle herder.*field researcher/]
    ];
    for(const [key,caption] of stations){
     await p.locator('#sf-stations [data-station="'+key+'"]').click();
     assert.match(await by('art-caption').innerText(),caption);
     assert.equal(await by('art').getAttribute('href'),'assets/serengeti-field-stations.svg#'+key);
     // An unresolved external SVG fragment has no drawn bounding box.
     await p.waitForFunction(()=>document.querySelector('#sf-art').getBBox().height>=195);
     const art=await p.locator('.sf-station-art').boundingBox();
     assert.ok(art&&Math.abs(art.width/art.height-2.8)<.05,'plate stays proportional at '+width);
     await p.locator('.sf-station-figure').screenshot({path:path.join(out,width+'-art-'+key+'.png')});
    }
    const move=p.getByRole('button',{name:'Movement of animals',exact:true});
    await move.focus();
    await p.keyboard.press('Enter');
    assert.equal(await p.locator('[data-layer=route]').getAttribute('hidden'),null);
    await by('month').selectOption('9');assert.match(await by('map-caption').innerText(),/Oct: Maasai Mara in Kenya/);
    assert.equal(await p.locator('[data-herd-marker]').getAttribute('cx'),'441');
    await by('enlarge').click();
    assert.ok(await by('map-dialog').isVisible());
    assert.equal(await by('map-dialog').locator('#sf-map-visual,.sf-map-visual').count(),1);
    await by('map-dialog').getByLabel('Migration month').selectOption('5');
    assert.match(await by('map-caption').innerText(),/Jun: Western corridor/);
    await by('map-zoom').click();
    assert.equal(await by('map-zoom').getAttribute('aria-pressed'),'true');
    assert.ok(await by('map-scroll').evaluate(el=>el.scrollWidth>el.clientWidth));
    await by('map-dialog').getByRole('button',{name:'Close map'}).click();
    await by('map-home').locator('#sf-map-panel').waitFor({state:'visible'});
    assert.equal(await by('month').inputValue(),'5');
    await by('jump-exhibit').click();
    assert.equal(await p.evaluate(()=>document.activeElement.id),'sf-exhibit-title');
    await p.locator('[data-exhibit="1"]').click();
    assert.match(await by('exhibit-text').innerText(),/800–1,000 km/);
    await by('pin').click();
    await by('note').fill('The herd regularly leaves the park.');
    assert.ok(await go('explain').isDisabled());
    const people=p.getByRole('button',{name:'People of the Serengeti',exact:true});
    if(width===390) await people.tap();
    else await people.click();
    await by('pin').click();
    assert.equal(await p.locator('[data-layer=protection]').getAttribute('hidden'),null);
    await by('boundary').selectOption('original');
    assert.notEqual(await p.locator('[data-boundary-later]').getAttribute('hidden'),null);
    await by('boundary').selectOption('later');
    assert.notEqual(await p.locator('[data-boundary-old]').getAttribute('hidden'),null);
    await by('boundary').selectOption('both');
    await p.locator('[data-exhibit="1"]').click();
    await by('pin').click();
    await shot('stations');
    assert.match(await by('collected').innerText(),/2 of 2 stations collected/);
    const conservation=p.getByRole('button',{name:'Conservation areas',exact:true});
    await conservation.click();
    assert.doesNotMatch(await by('exhibit-text').innerText(),/farther southeast/);
    assert.ok(await by('pin').isDisabled());
    await by('enlarge').click();
    await by('map-dialog').getByLabel('Park outlines').selectOption('original');
    assert.notEqual(await p.locator('#sf-field-map [data-boundary-later]').getAttribute('hidden'),null);
    await by('map-dialog').getByRole('button',{name:'West, near Grumeti'}).click();
    assert.match(await by('map-observation').innerText(),/outlines overlap/);
    await by('map-dialog').getByRole('button',{name:'North, near the Kenya border'}).click();
    assert.match(await by('map-observation').innerText(),/reaches farther north/);
    await by('map-dialog').getByRole('button',{name:'Close map'}).click();
    await by('map-home').locator('#sf-map-panel').waitFor({state:'visible'});
    assert.match(await by('exhibit-text').innerText(),/farther southeast/);
    await by('pin').click();
    await go('explain').click();
    assert.deepEqual(await by('question-recap').locator('li').allTextContents(),['What did people want to protect?','Why did the boundaries change?']);
    assert.match(await by('evidence-recap').innerText(),/The herd regularly leaves the park/);
    assert.match(await by('evidence-recap').innerText(),/Nata elder/);
    assert.match(await by('evidence-recap').innerText(),/colonial officer/);
    assert.match(await by('evidence-recap').innerText(),/800–1,000 km/);
    await by('claim').fill('The old boundary did not cover the herd’s route, and some local residents lost access to land.');
    await by('wonder').fill('Where do the animals go next?');
    await by('finish').click();
    assert.match(await by('finish-note').textContent(),/Notebook complete/);
    await p.reload();
    assert.ok(await page('explain').isVisible());
    assert.equal(await by('wonder').inputValue(),'Where do the animals go next?');
    await p.getByRole('button',{name:'Preview report',exact:true}).click();
    assert.match(await p.locator('.osr-dialog').innerText(),/The herd regularly leaves the park/);
    await p.locator('.osr-dialog').getByRole('button',{name:'Close report'}).click();
    await shot('explain');
    await by('reset').click();
    assert.ok(await by('clear').isDisabled());
    await by('erase').fill('ERASE');await by('clear').click();
    await p.waitForFunction(()=>localStorage.getItem('aplab:openscied:b1-field-notebook:v1')===null&&document.querySelector('[data-page=orient]').hidden===false);
    assert.deepEqual(errors,[]);
   }finally{await cx.close();}
  }
 }finally{await browser?.close();await site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
