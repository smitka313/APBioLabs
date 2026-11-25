'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright'),D=require('../openscied-b5-speciation-data.js');
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
  const base='http://127.0.0.1:'+server.address().port+'/',output=process.env.ICE_SCREENSHOTS;
  if(output)fs.mkdirSync(output,{recursive:true});
  for(const width of [390,768,1366,1920]){
   const c=await browser.newContext({viewport:{width,height:920},colorScheme:width===390?'dark':'light',reducedMotion:width===768?'reduce':'no-preference'});
   const p=await c.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('https://**/*',r=>r.abort());
   if(width===1366){
    const fixture=fs.readFileSync(path.join(path.dirname(require.resolve('docx')),'index.iife.js'),'utf8')+'\nwindow.docx = docx;';
    await p.route(/https:\/\/.*\/docx@[^/]+\/.*\.js$/,r=>r.fulfill({contentType:'application/javascript',body:fixture}));
   }
   await p.goto(base+'openscied-b5-speciation.html#argument');
   const at=k=>p.locator('#ice-'+k),stage=k=>p.locator('#'+k),go=k=>p.locator('[data-go="'+k+'"]'),nav=k=>p.locator('[data-step="'+k+'"]');
   const save=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('aplab:openscied:b5-speciation:v1')));
   async function layout(name){
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+name+' page overflow');
    assert(await p.evaluate(()=>Array.from(document.images).filter(i=>i.offsetWidth&&i.src.includes('ice-age')).every(i=>i.complete&&i.naturalWidth>0)),width+' missing loaded illustration');
    if(output)await p.screenshot({path:path.join(output,width+'-'+name+'.png'),fullPage:true,animations:'disabled'});
   }
   assert(await stage('cycles').isVisible(),'initial hash cannot bypass argument gate');
   assert(await nav('fossils').isDisabled());assert(await at('reset').isDisabled());
   if(width===1366){
    await p.getByRole('button',{name:'Enter your name and class period'}).click();
    await p.getByRole('textbox',{name:'Enter your name as your teacher knows it'}).fill('Avery Ice');
    await p.getByLabel('Class period',{exact:true}).selectOption('2');
    await at('identity').getByRole('button',{name:'Save',exact:true}).click();
   }
   await p.locator('#ice-video > summary').click();
   assert.match(await p.locator('#ice-player iframe').getAttribute('src'),/Q0KgdNk--iU$/);
   await p.locator('#ice-video > summary').click();
   const place=p.locator('.ice-zone'),bear=i=>at('bear-tray').locator('button').nth(i);
   for(let i=0;i<3;i++){
    if(width===1366&&i===0)await bear(i).dragTo(place.nth(i));
    else {await bear(i).focus();await bear(i).press('Space');await place.nth(i).focus();await place.nth(i).press('Enter');}
   }
   assert.match(await at('placement').innerText(),/Glacial: 3 of 3/);
   await layout('glacial');
   await at('replay').click();
   await p.locator('#ice-map[data-phase=warm]').waitFor();
   for(let i=0;i<3;i++){await bear(i).click();await place.nth(i===2?1:i).click();}
   await layout('interglacial');
   await at('g-cold').fill('15000');await at('g-warm').fill('65000');await at('math').click();
   assert.match(await at('math-feedback').innerText(),/Not yet.*15,000.*65,000/);
   await at('g-cold').fill('1322');await at('g-warm').fill('5727');await at('math').click();
   assert.match(await at('math-feedback').innerText(),/Both estimates match/);
   await at('first').fill('During G6, two populations could have been separated as land ice retreated.');
   await at('needed').fill('I need preserved bones to learn where bears lived.');
   await at('lock').click();
   assert(await stage('fossils').isVisible());
   const before=await save();await p.reload();
   assert(await stage('fossils').isVisible(),'reload must restore the opened archive');
   assert.equal((await save()).id,before.id);assert.deepEqual((await save()).moves,before.moves);
   await p.locator('.ice-marker').nth(1).click();assert.match(await at('fossil-file').innerText(),/110,000–130,000/);await at('pin').click();
   assert(await go('traits').isDisabled());
   await at('fossil-select').selectOption('4');assert.match(await at('fossil-file').innerText(),/550,000/);await at('pin').click();
   await at('fossil-select').selectOption('0');await at('pin').click();
   assert.match(await at('status').innerText(),/replaced the earlier polar bear pin/);
   assert.deepEqual((await save()).pins,[4,0]);
   await at('fossil-select').selectOption('1');await at('pin').click();
   assert.deepEqual((await save()).pins,[4,1]);
   await at('fossil-note').fill('The Norway fossil and older France fossil support presence in different places, not a date of speciation.');
   await layout('fossils');await go('traits').click();
   for(const n of await p.locator('#ice-genes summary').all())await n.click();
   const roster=at('roster').locator('button'),hab=at('trait-destinations').locator('button');
   const cards=D.roster(before.id),noClue=cards.findIndex(c=>!c.variants.some(Boolean)),snow=cards.findIndex(c=>c.variants.every(Boolean)),land=noClue;
   await roster.nth(noClue).click();await hab.first().click();
   assert.match(await at('hab-north').innerText(),/none of the three Arctic clues/);
   await roster.nth(snow).click();await hab.last().click();
   assert.match(await at('hab-south').innerText(),/darker fur may blend in better/);
   await at('trait-note').fill('Lighter pigment could help a bear blend into snow. More offspring could inherit it over many generations.');
   assert(await go('argument').isDisabled());
   await roster.nth(snow).click();await hab.first().click();
   if(width===1366)await roster.nth(land).dragTo(hab.last());
   else {await roster.nth(land).click();await hab.last().click();}
   assert.match(await at('hab-north').innerText(),/Possible Arctic advantage/);
   assert.match(await at('hab-south').innerText(),/Possible land advantage/);
   await layout('traits');await go('argument').click();
   assert.match(await at('first-recap').innerText(),/During G6/);assert.match(await at('evidence-recap').innerText(),/France.*550,000/);
   await at('revised').fill('Temperatures and isolation may have changed reproduction. France and Norway fossils show minimum times. APOB is a clue, not a date of speciation.');
   await at('future').fill('Model access to seals. When do bears lose enough ice days for that to matter?');
   await p.locator('input[value="exact"]').check();assert.match(await at('limit-feedback').innerText(),/does not locate or date/);
   assert(await at('finish').isDisabled());
   if(width===1366){
    await p.reload();assert(await p.locator('input[value="exact"]').isChecked());
    assert.match(await at('limit-feedback').innerText(),/does not locate or date/);
   }
   await p.locator('input[value="possible"]').check();await at('finish').click();
   assert.match(await at('progress').innerText(),/4 of 4/);await layout('report');
   if(width===1366){
    await at('edit').click();assert.match(await at('status').innerText(),/Editing reopened/);
    assert.equal((await save()).finished,false);
    assert.equal(await at('revised').evaluate(n=>n.readOnly),false);
    const oldText=await at('revised').inputValue();await at('revised').fill(oldText+' I can edit after finishing.');
    await at('finish').click();assert.equal((await save()).finished,true);
    await p.getByText('Keep a backup of this activity',{exact:true}).click();
    const json=p.waitForEvent('download');await at('backup').click();
    const backup=JSON.parse(fs.readFileSync(await (await json).path(),'utf8'));
    assert.equal(backup.student.name,'Avery Ice');assert.equal(String(backup.student.period),'2');
    assert.equal(backup.datasetId,'ICE-'+before.id);assert.equal(backup.progress.summary,'4 of 4 steps complete');
    assert.equal(backup.selectedCycle,'G6');assert.deepEqual(backup.climate.map(x=>[x.years,x.generations]),[[15000,1322],[65000,5727]]);
    assert.deepEqual(backup.fossilPins.map(f=>f.location),['France','Norway (Svalbard)']);
    assert.equal(backup.conclusionCheck.question,D.conclusion.question);assert.equal(backup.conclusionCheck.verdict,'Correct');
    assert.equal(backup.format,'ice-age-bear-speciation-backup-v2');
    assert.equal(backup.work,undefined,'report JSON must not expose a duplicate opaque browser record');
    assert.ok(backup.climate.every(x=>x.cycle==='G6'));
    const [htmlFile]=await Promise.all([p.waitForEvent('download'),at('save-html').click()]);
    const html=fs.readFileSync(await htmlFile.path(),'utf8');assert.match(html,/Avery Ice.*ICE-[A-F0-9]{8}.*G6.*Svalbard/s);
    await p.getByRole('button',{name:'Preview report'}).click();
    await p.getByText('More formats',{exact:true}).click();
    const word=p.waitForEvent('download');await p.getByRole('button',{name:/Download Word/i}).click();const d=await word;
    assert.match(d.suggestedFilename(),/ice-age-bear-speciation.*\.docx$/);
    const jszip=require('jszip'),z=await jszip.loadAsync(fs.readFileSync(await d.path()));
    const xml=await z.file('word/document.xml').async('string');
    for(const pattern of [/Avery Ice/,/ICE-[0-9A-F]{8}/,/First argument/,/Norway/,/550,000/,/APOB/,/Driving Question Board/,/Which conclusion does the evidence support/,/>G6</,/edit after finishing/])assert.match(xml,pattern);
    const dpage=await c.newPage();await dpage.goto(base+'openscied-dashboard.html');
    assert.match(await dpage.locator('#bear-speciation-progress').innerText(),/4 of 4/);
    assert.match(await dpage.locator('#openscied-resume-link').getAttribute('href'),/speciation.*argument/);
    await dpage.close();
    await p.getByRole('button',{name:'Close report'}).click();
   }
   await at('reset').click();assert(await at('erase').isDisabled());await at('confirm').fill('ERASE');await at('erase').click();
   await stage('cycles').waitFor();assert(await nav('fossils').isDisabled());assert.equal(await save(),null);
   assert.deepEqual(errors,[],width+' uncaught page errors');
   await c.close();
  }
  console.log('Ice Age complete flow, transitions, fossils, genes, Word, resume and reset passed at 390, 768, 1366 and 1920 px.');
 }finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
