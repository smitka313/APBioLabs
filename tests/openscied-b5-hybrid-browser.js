'use strict';
const receipt = require('./openscied-b5-save-receipt');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright'),D=require('../openscied-b5-hybrid-data.js');
const root=path.join(__dirname,'..'),type={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':type[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try{
  browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:undefined);
  const base='http://127.0.0.1:'+server.address().port+'/',output=process.env.HYBRID_SCREENSHOTS;
  if(output)fs.mkdirSync(output,{recursive:true});
  for(const width of [390,768,1366,1920]){
   const c=await browser.newContext({viewport:{width,height:920},colorScheme:width===390?'dark':'light',reducedMotion:width===768?'reduce':'no-preference'});
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.route('https://**/*',r=>r.abort());
   if(width===1366){
    const fixture=fs.readFileSync(path.join(path.dirname(require.resolve('docx')),'index.iife.js'),'utf8')+'\nwindow.docx = docx;';
    await p.route(/https:\/\/.*\/docx@[^/]+\/.*\.js$/,r=>r.fulfill({contentType:'application/javascript',body:fixture}));
   }
   await p.goto(base+'openscied-b5-hybrid.html#claim');
   await receipt.ready(p.locator('#hy-save'));await receipt.readableDisabled(p.locator('#hy-reset'));
   if(width===390){
    // The old hero artwork is gone; the shared companion header holds the title, which must fit at 390 px.
    const hero=await p.locator('header.companion-header').evaluate(e=>({
     titleFits:e.querySelector('h1').getBoundingClientRect().right<=e.getBoundingClientRect().right
    }));
    assert.equal(hero.titleFits,true);
   }
   const at=k=>p.locator('#hy-'+k),stage=k=>p.locator('#'+k),go=k=>p.locator('[data-go="'+k+'"]');
   const save=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('aplab:openscied:b5-hybrid:v1')));
   async function layout(name){
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+name+' page overflow');
    assert(await p.evaluate(()=>Array.from(document.images).filter(i=>i.offsetWidth).every(i=>i.complete&&i.naturalWidth>0)),width+' missing loaded illustration');
    if(output)await p.screenshot({path:path.join(output,width+'-'+name+'.png'),fullPage:true,animations:'disabled'});
   }
   assert(await stage('ice').isVisible());assert(await go('family').isDisabled());assert(await at('reset').isDisabled());
   const untouched=await save();
   assert.match(untouched.id,/^[A-F0-9]{8}$/,'first visit reserves a dataset before the first response');
   assert.deepEqual(untouched,{v:1,id:untouched.id});
   await p.reload();
   assert.deepEqual(await save(),untouched,'untouched district survives its first reload without becoming started');
   assert(await at('reset').isDisabled());
   await at('legend').getByRole('button',{name:/SSP2/}).click();assert.equal(await at('chart').locator('polyline').count(),4);
   await at('year').focus();await at('year').press('End');assert.match(await at('chart-values').innerText(),/1\.7.*0\.2/s);
   await at('enlarge').click();assert(await at('graph-dialog').isVisible());await p.keyboard.press('Escape');assert(!(await at('graph-dialog').isVisible()));
   await at('pin-year').click();const seed=(await save()).id;assert.equal(seed,untouched.id);
   if(width===1366){
    // Begin as a guest, then add identity without replacing the saved data.
    await p.getByRole('button',{name:'Enter your name and class period'}).click();
    await p.getByRole('textbox',{name:'Enter your name as your teacher knows it'}).fill('Avery Ice');
    await p.getByLabel('Class period',{exact:true}).selectOption('3');
    await at('identity').getByRole('button',{name:'Save',exact:true}).click();
    await p.reload();assert.equal((await save()).id,seed);assert.match(await at('identity').innerText(),/Avery Ice.*Period 3/s);
   }
   await at('prediction').fill('The projected scenario difference is 1.5 million square kilometers in 2100. There are few bear generations in the example window.');
   await receipt.saved(at('save'));
   await layout('ice');await go('family').click();
   await p.locator('button[data-ice=less]').click();assert.equal(await at('map').getAttribute('data-ice'),'less');
   await p.locator('[data-island=banks]').click();await p.locator('[data-island=victoria]').click();
   await p.locator('[data-family=f4]').click();assert.match(await at('trace').innerText(),/Polar bear mother \+ Brown bear B/);
   await p.locator('[data-family=c2]').click();assert.match(await at('trace').innerText(),/First-generation hybrid mother \+ Brown bear A/);
   assert.equal(await at('pedigree').locator('[data-parent=true]').count(),2);
   await at('encounter').selectOption('polar');assert.match(await at('counts').innerText(),/Lone adult male.*19.*76.*95/s);
   await at('evidence').fill('Less ice may cause more overlap. The pedigree establishes relatedness in one family, but the encounter counts do not tell us why they mated.');
   await layout('family');await go('model').click();
   for(let i=0;i<4;i++)await at('flip').click();
   assert.equal((await save()).rolls,4);assert.equal(await at('cohort').locator('button').count(),1);
   assert.equal(await at('remaining').textContent(),'Finish this mating');
   assert.match(await at('shortcut-note').textContent(),/4 coins still needed for mating 2/);
   await at('flip').click();const beforeReload=await save();await p.reload();assert(await stage('model').isVisible());
   assert.deepEqual(await save(),beforeReload,'reloading must not rewrite saved evidence or its timestamp');
   assert.equal((await save()).rolls,5);assert.equal((await save()).id,seed);
   assert.equal(await at('remaining').textContent(),'Finish this mating');
   assert.match(await at('shortcut-note').textContent(),/3 coins still needed for mating 2/);
   await at('remaining').click();assert.equal((await save()).rolls,8);
   for(let i=2;i<10;i++)await at('remaining').click();
   assert.equal((await save()).rolls,40);assert.equal(await at('cohort').locator('button').count(),10);
   await at('cohort').getByRole('button',{name:'Inspect offspring 3',exact:true}).click();assert.match(await at('offspring').innerText(),/Offspring 3:.*NOS3/);
   await layout('model');await go('claim').click();
   assert.match(await at('evidence-recap').innerText(),/2100 climate comparison/);
   await at('claim').fill('I would compare the NOS3 variants for activity on warmer land. The model produces different traits, not survival predictions.');
   await at('limit').fill('A hybrid reproduced in this family, but neither source tells us how long wild hybrids will survive.');
   await p.locator('input[value="saved"]').check();assert.match(await at('check-feedback').innerText(),/does not show/);assert(await at('finish').isDisabled());
   await p.locator('input[value="clue"]').check();await at('finish').click();assert.match(await at('progress').innerText(),/4 of 4/);
   await at('edit').click();assert(!(await save()).finished);await at('finish').click();await layout('claim');
   if(width===1366){
    await p.getByText('Keep a backup of this activity',{exact:true}).click();
    const json=p.waitForEvent('download');await at('backup').click();const result=JSON.parse(fs.readFileSync(await (await json).path(),'utf8'));
    assert.equal(result.student.name,'Avery Ice');assert.equal(String(result.student.period),'3');assert.equal(result.datasetId,'HY-'+seed);assert.equal(result.flips,40);assert.equal(result.format,'arctic-bear-futures-backup-v2');assert.equal(result.work,undefined);
    assert.deepEqual(result.coinFlips.map(row=>row.side==='Tails'?1:0),D.flips(seed,40));
    assert.equal(result.climate.measure,'September sea-ice area');assert.ok(result.climate.pinnedValues.every(row=>row.kind==='projected'));
    const [htmlFile]=await Promise.all([p.waitForEvent('download'),at('save-html').click()]);
    const html=fs.readFileSync(await htmlFile.path(),'utf8');assert.match(html,/Avery Ice.*HY-[A-F0-9]{8}.*annual minimum extent.*NOS3/s);
    assert.deepEqual(result.report[2].items[1].rows.map(row=>row.slice(1).map(v=>v.startsWith('Tails')?1:0)).flat(),D.flips(seed,40));
    await p.getByRole('button',{name:'Preview report'}).click();
    const word=p.waitForEvent('download');await p.locator('dialog.osr-dialog').getByRole('button',{name:/Download Word/i}).click();
    const z=await require('jszip').loadAsync(fs.readFileSync(await (await word).path()));
    const xml=await z.file('word/document.xml').async('string');
    for(const pattern of [/Avery Ice/,/HY-[A-F0-9]{8}/,/NOS3/,/Which conclusion matches/,/2100/])assert.match(xml,pattern);
    await p.getByRole('button',{name:'Close report'}).click();
    const dash=await c.newPage();await dash.goto(base+'openscied-dashboard.html');assert.match(await dash.locator('#bear-hybrid-progress').innerText(),/4 of 4/);
    // Simulate a different tab clearing only this activity without touching its neighbor.
    await dash.evaluate(()=>{
     const storage=window.localStorage;
     storage.setItem('aplab:openscied:b5-wapusk:v1','neighbor-record');
     window.OpenSciEdSaveSession.erase(storage,'b5-hybrid',['aplab:openscied:b5-hybrid:v1']);
    });
    await at('recovery').waitFor({state:'visible'});assert(await at('reset').isDisabled());
    assert.equal(await at('save').getAttribute('data-save-state'),'blocked');assert(!(await at('save').locator('time').isVisible()));
    assert.equal(await save(),null);
    const [recovered]=await Promise.all([p.waitForEvent('download'),at('save-recovery').click()]);
    const recovery=JSON.parse(fs.readFileSync(await recovered.path(),'utf8'));
    assert.equal(recovery.status,'recovery');assert.equal(recovery.datasetId,'HY-'+seed);assert.equal(recovery.flips,40);
    await at('open-current').click();assert(await at('recovery-dialog').isVisible());
    await at('keep-recovery').click();assert(await at('recovery').isVisible());
    await Promise.all([p.waitForEvent('load'),(async()=>{await at('open-current').click();await at('confirm-reload').click();})()]);
    assert(await stage('ice').isVisible());assert(await at('recovery').isHidden());
    assert.equal(await dash.evaluate(()=>localStorage.getItem('aplab:openscied:b5-wapusk:v1')),'neighbor-record');await dash.close();
   } else {
    await at('reset').click();await at('erase').fill('ERASE');await at('confirm').click();await stage('ice').waitFor();const reset=await save();assert.notEqual(reset.id,seed);assert.deepEqual(reset,{v:1,id:reset.id});assert(await at('reset').isDisabled());
   }
   assert.deepEqual(errors,[]);await c.close();
  }
  console.log('Lesson 6 browser flow passed at 390, 768, 1366, and 1920 px, including JSON, Word, resume, and reset.');
 }finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
