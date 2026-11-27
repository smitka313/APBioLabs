'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const mobileSafari=process.env.FIELD_BROWSER==='webkit';
const {ROOT,serve}=require('./_h');
(async()=>{
 const site=await serve();
 let browser;
 try{
  browser=await (mobileSafari?webkit:chromium).launch();
  const out=path.join(ROOT,'artifacts','field-notebook');
  await fs.mkdir(out,{recursive:true});
  const sizes=mobileSafari?[[390,'dark']]:[[390,'dark'],[768,'dark'],[1366,'light'],[1920,'light']];
  for(const [width,mode] of sizes){
   const cx=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:mobileSafari,reducedMotion:'reduce'});
   try{
    await cx.addInitScript(m=>localStorage.setItem('aplab:pref:theme',m),mode);
    await cx.route('**/*',r=>new URL(r.request().url()).origin===new URL(site.url).origin?r.continue():r.abort());
    if(width===390) await cx.route('https://www.youtube-nocookie.com/embed/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Test player</title>'}));
    const p=await cx.newPage(), errors=[];
    p.on('pageerror',err=>errors.push(err.message));
    await p.goto(site.url+'openscied-b1-field-notebook.html');
    const by=k=>p.locator('#sf-'+k), page=k=>p.locator('[data-page="'+k+'"]'), go=k=>p.locator('[data-go="'+k+'"]');
    const shot=async stage=>{
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' fits '+stage);
      await p.screenshot({path:path.join(out,width+'-'+stage+'.png'),fullPage:true,animations:'disabled'});
    };
    assert.equal(await p.locator('html').getAttribute('data-theme'),mode);
    const checkClip=async(panel,id)=>{
      const request=p.waitForRequest(r=>r.url()==='https://www.youtube-nocookie.com/embed/'+id+'?cc_load_policy=1');
      await panel.locator('summary').click();
      await request;
      assert.equal(await panel.locator('iframe').getAttribute('src'),'https://www.youtube-nocookie.com/embed/'+id+'?cc_load_policy=1');
      assert.equal(await panel.getByRole('link',{name:/Open on YouTube/}).getAttribute('href'),'https://youtu.be/'+id);
      await panel.locator('summary').click();
      await panel.locator('iframe').waitFor({state:'detached'});
    };
    if(width===390){
      assert.equal(await p.locator('iframe').count(),0);
      await checkClip(p.locator('details.ose-video').first(),'Pg35n6eIF3Y');
    }
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
     if(width===390 && key==='movement'){
      await checkClip(by('movement-video').locator('details').nth(0),'ipYb3Gw6fBY');
      await checkClip(by('movement-video').locator('details').nth(1),'7JOk6ivcuco');
     }
     if(width===390 && key==='people') await checkClip(by('people-video').locator('details'),'cVj4883yze0');
     assert.match(await by('art-caption').innerText(),caption);
     assert.equal(await by('art').getAttribute('src'),'assets/serengeti-field-station-'+key+'.webp');
     await by('art').evaluate(async img=>{await img.decode();});
     assert.equal(await by('art').evaluate(img=>img.naturalWidth),1120);
     if(key==='biodiversity'){
      // A decoded image alone is not enough: the iOS bug made the torsos transparent.
      const rgb=await by('art').evaluate(img=>{
       const canvas=document.createElement('canvas');canvas.width=560;canvas.height=200;
       const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,560,200);
       return [[72,118],[117,118],[234,131],[202,130]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));
      });
      const difference=(a,b)=>a.slice(0,3).reduce((d,c,i)=>d+Math.abs(c-b[i]),0);
      assert.ok(difference(rgb[0],rgb[1])>65,'giraffe torso is filled against the backdrop');
      assert.ok(difference(rgb[2],rgb[3])>65,'lion torso is filled against the backdrop');
     }
     const art=await p.locator('.sf-station-art').boundingBox();
     assert.ok(art&&Math.abs(art.width/art.height-2.8)<.05,'plate stays proportional at '+width);
     await p.locator('.sf-station-figure').screenshot({path:path.join(out,(mobileSafari?'webkit-':'')+width+'-art-'+key+'.png')});
    }
    if(mobileSafari)continue;
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
    const fit=await by('map-scroll').evaluate(el=>({
      scroller:el.getBoundingClientRect().toJSON(),
      pins:[...el.querySelectorAll('.sf-map-pin')].map(pin=>pin.getBoundingClientRect().toJSON())
    }));
    assert.equal(fit.pins.length,5);
    assert.ok(fit.pins.every(r=>r.top>=fit.scroller.top&&r.bottom<=fit.scroller.bottom&&r.right<=fit.scroller.right),
      'all five pins fit in the enlarged map before zoom at '+width);
    await by('map-dialog').screenshot({path:path.join(out,width+'-map-fit.png')});
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
    assert.match(await by('note-status').textContent(),/Station note saved to this browser/);
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
    assert.match(await by('collected').innerText(),/2 stations with evidence.*3 exhibits pinned/);
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
    await p.getByRole('button',{name:'Preview report',exact:true}).click();
    const preview=p.locator('.osr-dialog');
    assert.match(await preview.innerText(),/Select Finish notebook to mark this work complete/);
    assert.match(await preview.innerText(),/Movement of animals · Station note/);
    assert.doesNotMatch(await preview.innerText(),/Write your explanation|Write one question you still have/);
    await preview.getByRole('button',{name:'Close report'}).click();
    await by('finish').click();
    assert.match(await by('finish-note').textContent(),/Notebook complete/);
    await p.reload();
    assert.ok(await page('explain').isVisible());
    assert.equal(await by('wonder').inputValue(),'Where do the animals go next?');
    assert.equal(await by('month').inputValue(),'5');
    await p.getByRole('button',{name:'Preview report',exact:true}).click();
    assert.match(await p.locator('.osr-dialog').innerText(),/The herd regularly leaves the park/);
    assert.doesNotMatch(await preview.innerText(),/Still to do/);
    await preview.getByRole('button',{name:'Close report'}).click();
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
