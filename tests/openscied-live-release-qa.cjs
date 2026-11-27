const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const origin='https://biologylabbench.com';
const dashboard='/openscied-dashboard';
const migration='/openscied-b1-migration';
const junco='/openscied-b4-junco';
const therm='/openscied-b5-thermoregulation';
const migKey='aplab:openscied:b1-migration:v1';
const juKey='aplab:openscied:b4-junco:v1';
const thKey='aplab:openscied:b5-thermoregulation:v1';
const first='QA observation: the herd is in the south.';
const latest='QA thermal prediction: the bear may give way.';
const rejected='QA deliberate save failure: this must not persist.';
const at=(page,selector)=>page.locator(selector);
const go=async(page,path)=>{
  const res=await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:25000});
  assert(res?.ok(),path+' HTTP '+res?.status());
  assert.equal(new URL(page.url()).origin,origin);
};
const read=(page,key)=>page.evaluate(k=>localStorage.getItem(k),key);
const destination=async(page,path)=>page.waitForFunction(path=>{
  const section=document.querySelector('#openscied-resume'),link=document.querySelector('#openscied-resume-link');
  return !section?.hidden && link && new URL(link.href).pathname.replace(/\.html$/,'')===path;
},path);
(async()=>{
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1366,height:900},acceptDownloads:true,reducedMotion:'reduce'});
  // No third-party analytics, media, or font requests during the audit.
  await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const dash=await ctx.newPage(), map=await ctx.newPage(), other=await ctx.newPage(), thermal=await ctx.newPage();
  for(const page of [dash,map,other,thermal])page.setDefaultTimeout(10000);
  const errors=[];
  const check=async(name,fn)=>{try{await fn();console.log('PASS: '+name);}catch(err){errors.push(name);console.error('FAIL: '+name+'\n'+err.stack);}};
  try{
    await check('production serves the newly deployed notebook card',async()=>{
      await go(dash,dashboard);
      const card=at(dash,'a.dashboard-preview[href="openscied-b1-field-notebook.html"] img');
      assert.match(await card.getAttribute('src'),/field-notebook-preview\.svg$/);
      assert.equal(await card.evaluate(async img=>{await img.decode();return img.naturalWidth;}),960);
      assert.equal(await read(dash,'aplab:student'),null);
    });
    await check('Continue follows real work across tabs, not which activity opened last', async()=>{
      await go(dash,dashboard);
      await dash.waitForFunction(()=>typeof window.OpenSciEdResume?.connect==='function');
      assert(await at(dash,'#openscied-resume').isHidden());
      await go(map,migration);
      await at(map,'#observation').fill(first);
      await at(map,'#record').click();
      await destination(dash,migration);
      assert(JSON.parse(await read(map,migKey)).notes.some(n=>n.observation===first));
      await go(other,junco);
      await at(other,'#ju-field-entry').waitFor();
      await dash.reload({waitUntil:'domcontentloaded'});
      await destination(dash,migration);
      const west='QA observation: the city birds let the observer get closer.';
      await at(other,'#ju-field-entry').fill(west);
      await destination(dash,junco);
      assert.equal(JSON.parse(await read(other,juKey)).observation,west);
      await at(map,'#weather').uncheck();
      await dash.reload({waitUntil:'domcontentloaded'});
      await destination(dash,junco);
      await Promise.all([dash.waitForURL(u=>u.pathname.replace(/\.html$/,'')===junco),at(dash,'#openscied-resume-link').click()]);
      assert.equal(await at(dash,'#ju-field-entry').inputValue(),west);
    });
    await check('downloaded dashboard JSON includes readable records, identity provenance and a prefixed dataset ID',async()=>{
      await go(thermal,therm);
      await at(thermal,'#th-predict').fill(latest);
      await thermal.waitForFunction(k=>!!localStorage.getItem(k),thKey);
      await go(dash,dashboard);
      const profile=at(dash,'#openscied-student-identity');
      await profile.getByLabel('Enter your name as your teacher knows it').fill('Release QA Sample');
      await profile.getByLabel('Class period',{exact:true}).selectOption('3');
      await profile.getByRole('button',{name:'Save',exact:true}).click();
      const [file]=await Promise.all([dash.waitForEvent('download'),at(dash,'#download-openscied-results').click()]);
      assert.equal(file.suggestedFilename(),'openscied-saved-work.json');
      const data=JSON.parse(await fs.readFile(await file.path(),'utf8'));
      assert.equal(data.format,'openscied-saved-work-v2');
      assert.deepEqual(data.exportedBy,{name:'Release QA Sample',period:'3'});
      assert.equal(data.recordOwnership,'not-verified');
      assert.equal(Object.hasOwn(data,'student'),false);
      assert.deepEqual(data.work[thKey],JSON.parse(await read(dash,thKey)));
      assert.equal(data.responses['thermoregulation'].predict,latest);
      assert.match(data.datasetIds['thermoregulation'],/^TH-[0-9A-F]{8}$/);
      assert(!JSON.stringify(data).includes(rejected));
    });
    await check('Unit 5 warns on a deliberately rejected save and leaves the last successful record intact',async()=>{
      await go(thermal,therm);
      await at(thermal,'#th-predict').fill(latest+' Saved.');
      const receipt=at(thermal,'#th-save');
      await receipt.waitFor({state:'visible'});
      assert.equal(await receipt.getAttribute('data-save-state'),'saved');
      const before=await read(thermal,thKey);
      assert(before.includes('Saved.'));
      await thermal.evaluate(key=>{
        const write=Storage.prototype.setItem;
        Storage.prototype.setItem=function(k,value){
          if(this===localStorage&&k===key)throw new DOMException('QA: simulated storage quota','QuotaExceededError');
          return write.call(this,k,value);
        };
      },thKey);
      await at(thermal,'#th-predict').fill(rejected);
      assert.equal(await receipt.getAttribute('data-save-state'),'blocked');
      assert.match(await receipt.innerText(),/This tab cannot save.*before reloading/);
      assert.equal(await at(thermal,'#th-predict').inputValue(),rejected);
      assert.equal(await read(thermal,thKey),before);
      await thermal.reload({waitUntil:'domcontentloaded'});
      assert.equal(await at(thermal,'#th-predict').inputValue(),latest+' Saved.');
    });
  } finally{
    await ctx.close();
    await browser.close();
  }
  assert.equal(errors.length,0,errors.join('; '));
})().catch(err=>{console.error(err);process.exitCode=1;});
