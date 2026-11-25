'use strict';
const T=require('./_h'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const site=await T.serve();let b;
 try{
  b=await T.launch();const shots=process.env.BENCH_SCREENSHOTS;
  if(shots)fs.mkdirSync(shots,{recursive:true});
  for(const [width,dark] of [[390,true],[768,false],[1366,false],[1920,false]]){
   const ctx=await T.ctxFor(b,{width,height:950,dark,reduced:true});
   try{
    const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.route(/gc\.zgo\.at|fonts\.(?:googleapis|gstatic)\.com/,r=>r.fulfill({status:200,body:''}));
    await p.goto(site.url+'index.html');await p.evaluate(()=>localStorage.removeItem('aplab:pref:theme'));await p.reload();
    const layout=async k=>{
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+k+' layout');
     const logo=p.locator('.bench-logo img:visible');assert.equal(await logo.count(),1);
     assert(await logo.evaluate(img=>img.decode().then(()=>img.naturalWidth>0)));
     const brand=await logo.boundingBox();
     const heading=await p.getByRole('heading',{level:1}).boundingBox();
     const min=k==='welcome'?(width>=1366?380:200):(width>=1366?235:160);
     assert(brand.width>=min && brand.y+brand.height<=heading.y,
       width+' '+k+' logo and wordmark lead the page');
     if(shots)await p.screenshot({path:path.join(shots,width+'-'+k+'.png'),fullPage:k==='welcome',animations:'disabled'});
    };
    assert.match(await p.getByRole('heading',{level:1}).textContent(),/Choose your course/);
    assert.equal(await p.locator('.bench-choice').count(),2);assert.equal(await p.locator('.bench-choice-art').count(),2);
    const guides=await p.locator('.bench-guide').evaluateAll(l=>l.map(a=>a.getAttribute('href')));
    assert.deepEqual(guides,['teachers.html','openscied-teacher-guide.html']);
    await p.locator('.bench-choice-art').evaluateAll(list=>Promise.all(list.map(i=>i.decode())));
    await layout('welcome');
    const theme=dark?'Light':'Dark';
    await p.getByRole('button',{name:theme,exact:true}).click();
    assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),theme.toLowerCase());
    await p.keyboard.press('Tab');
    const ap=p.getByRole('link',{name:/Explore AP Biology labs/});await ap.focus();await ap.press('Enter');
    await p.waitForURL('**/ap-biology.html');assert.equal(await p.locator('main#labs .card').count(),13);
    await p.locator('#home-identity .id-box').waitFor({state:'attached'});await layout('ap');
    assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),theme.toLowerCase());
    await p.getByRole('link',{name:'OpenSciEd',exact:true}).click();await p.waitForURL('**/openscied-dashboard.html');
    assert.equal(await p.locator('.dashboard-unit.current').count(),5);
    const atlas=p.locator('.dashboard-hero-art');
    assert.equal(await atlas.getAttribute('src'),'assets/bench-field-atlas.svg');
    assert(await atlas.evaluate(async img=>{
      await img.decode();
      return img.width/img.height>=5 && img.height<220;
    }),'OpenSciEd uses the compact field-guide plate instead of the full-height panorama');
    await layout('openscied');assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),theme.toLowerCase());
    await p.getByRole('link',{name:'Biology Lab Bench home'}).click();await p.waitForURL('**/index.html');
    const ose=p.getByRole('link',{name:/Explore OpenSciEd activities/});await ose.click();await p.waitForURL('**/openscied-dashboard.html');
    await p.goto(site.url+'index.html#bi2');await p.waitForURL('**/ap-biology.html#bi2');
    assert.equal(await p.locator('#bi2').count(),1);
    await p.goto(site.url+'lab01.html');assert.equal(await p.getByRole('navigation',{name:'Breadcrumb'}).getByRole('link',{name:'All labs',exact:true}).getAttribute('href'),'ap-biology.html');
    if(width===390||width===1366){
      await p.goto(site.url+'index.html');await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
      const v=await p.evaluate(async()=> (await axe.run(document,{runOnly:['wcag2a','wcag2aa']})).violations.map(x=>x.id));
      assert.deepEqual(v,[],'welcome accessibility');
    }
    assert.deepEqual(errors,[]);
   }finally{await ctx.close();}
  }
  console.log('Welcome, AP and OpenSciEd navigation, logos, theme continuity and old AP bookmarks passed at four widths.');
 }finally{await b?.close();await site.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
