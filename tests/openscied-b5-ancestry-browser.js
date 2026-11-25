'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), http=require('node:http'), path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':type[path.extname(f)]||'application/octet-stream'});
 fs.createReadStream(f).pipe(res);
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 const base='http://127.0.0.1:'+server.address().port+'/';
 const pathname='openscied-b5-ancestry.html';
 const output=process.env.BEAR_SCREENSHOTS;if(output)fs.mkdirSync(output,{recursive:true});
 try{
  for(const width of [390,768,1366,1920]){
   const c=await browser.newContext({viewport:{width,height:920},colorScheme:width===390?'dark':'light',reducedMotion:width===768?'reduce':'no-preference'});
   const p=await c.newPage(),errs=[];
   p.on('pageerror',e=>errs.push(e.message));
   await p.route('https://**/*',route=>route.abort());
   if(width===1366){
    const fixture=fs.readFileSync(path.join(path.dirname(require.resolve('docx')),'index.iife.js'),'utf8')+"\nconst baDocx = docx; window.docx = {...baDocx, Packer: {toBlob: async (...args) => {try {return await baDocx.Packer.toBlob(...args);} catch(err) {window.__baWordError=String(err);throw err;}}}};";
    await p.route(/https:\/\/.*\/docx@[^/]+\/.*\.js$/,route=>route.fulfill({contentType:'application/javascript',body:fixture}));
   }
   await p.goto(base+pathname+'#explain');
   const visible=id=>p.locator('#'+id).isVisible();
   const at=q=>p.locator('#ba-'+q);
   const next=step=>p.locator('[data-go="'+step+'"]').click();
   async function layout(stage){
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+'px '+stage+' overflows page');
    if(output)await p.screenshot({path:path.join(output,width+'-'+stage+'.png'),fullPage:true,animations:'disabled'});
   }
   assert(await visible('traits'));assert(await p.locator('[data-step="dna"]').isDisabled());
   assert(await at('lock').isDisabled());
   assert(await at('reset').isDisabled());
   await p.getByRole('button',{name:'Enter your name and class period'}).click();
   await p.getByRole('textbox',{name:'Enter your name as your teacher knows it'}).fill('Avery Test');
   await p.getByLabel('Class period',{exact:true}).selectOption('2');
   await p.locator('#ba-identity').getByRole('button',{name:'Save',exact:true}).click();
   assert.match(await at('identity').innerText(),/Avery Test.*Period 2/s);
   await p.locator('[data-station="skull"]').click();
   await p.getByRole('button',{name:'Enlarge specimen: Polar bear'}).click();
   assert(await p.locator('.ba-specimen[data-zoom="true"]').isVisible());
   await p.getByRole('button',{name:'Return to side-by-side: Polar bear'}).click();
   await at('note').fill('Polar bear skull looks longer.');
   await p.locator('[data-station="teeth"]').click();
   assert.equal(await at('note').inputValue(),'');
   await p.locator('[data-station="claw"]').click();
   const cal=at('caliper-polar');await cal.focus();await cal.press('End');await cal.press('ArrowLeft');
   assert.match(await p.locator('output').first().innerText(),/89 mm.*Move left/);
   await cal.evaluate(n=>{n.value=51;n.dispatchEvent(new Event('input',{bubbles:true}));});
   assert.match(await p.locator('output').first().innerText(),/51 mm.*At the illustrated tip/);
   const cb=await cal.boundingBox();await cal.click({position:{x:8,y:cb.height/2}});
   assert.equal(await cal.inputValue(),'51');
   await p.mouse.move(cb.x+cb.width*.52,cb.y+cb.height/2);await p.mouse.down();await p.mouse.move(cb.x+cb.width*.75,cb.y+cb.height/2,{steps:5});await p.mouse.up();
   assert(Number(await cal.inputValue())>60,'drag advances from the existing reading');
   await at('note').fill('The model brown claw reaches farther.');
   await at('hypotheses').getByText('Polar + Brown').click();
   await at('lock').click();
   await at('edit-guess').click();
   await at('hypotheses').getByText('Brown + Black').click();
   await at('lock').click();
   await layout('traits');
   await next('dna');
   assert(await visible('dna'));
   const tile=i=>p.locator('[data-base="'+i+'"]');
   await tile(0).focus();await tile(0).press('ArrowRight');assert(await tile(1).evaluate(n=>n===document.activeElement));
   await tile(1).press('Space');await at('check').click();
   assert.match(await at('dna-feedback').innerText(),/matching letters/);
   await tile(1).click();await at('check').click();
   await at('dna-pairs').getByText('Polar + Black').click();
   await tile(3).click();await at('check').click();assert.match(await at('dna-feedback').innerText(),/still unmarked/);
   await tile(65).click();await at('check').click();
   await at('dna-pairs').getByText('Brown + Black').click();
   await tile(3).click();await tile(65).click();await at('check').click();
   assert.match(await at('table').innerText(),/Polar \+ Brown\s+0[\s\S]+Polar \+ Black\s+2[\s\S]+Brown \+ Black\s+2/);
   await layout('dna');
   if(width===1366){
    await p.getByText('Explore the full eight-species dataset',{exact:true}).click();
    await at('full-a').selectOption('Brown_Bear');await at('full-b').selectOption('American_Black_Bear');
    assert.match(await at('full-stat').innerText(),/9 minimum single-base changes/);
    assert.equal(await at('full-a').locator('option').count(),8);
    await p.getByText('Show how the full sequences line up',{exact:true}).click();
    assert.match(await at('aligned').innerText(),/Columns 1–60/);
    await at('full-a').selectOption('Giant_Panda_Bear');
    await at('full-b').selectOption('Polar_Bear');
    const blocks=(await at('aligned').innerText()).split('\n\n').map(b=>b.split('\n'));
    const differences=blocks.reduce((n,b)=>n+[...b[2]].filter(x=>x==='×'||x==='+').length,0);
    assert.equal(differences,273);
    assert.match(await at('full-stat').innerText(),/273 minimum single-base changes/);
    const wait=p.waitForEvent('download');await at('fasta').click();const dl=await wait, fasta=fs.readFileSync(await dl.path(),'utf8');
    assert.equal(fasta.match(/^>/gm).length,8);assert.match(fasta,/>Polar_Bear\nGGCGAAGAA/);
   }
   await next('tree');
   const bear=k=>p.locator('[data-bear="'+k+'"]'), tip=i=>p.locator('[data-tip="'+i+'"]');
   await at('tree-check').click();assert.match(await at('tree-feedback').innerText(),/all three/);
   await bear('black').click();await tip(0).click();
   await bear('brown').click();await tip(1).click();
   await bear('polar').click();await tip(2).click();
   await at('tree-check').click();assert.match(await at('tree-feedback').innerText(),/Brown \+ Black.*fewest differences/);
   assert.equal(await tip(0).getAttribute('data-mismatch'),'true');
   assert(await p.locator('[data-go=explain]').isDisabled());
   if(width===1366)await bear('polar').dragTo(tip(0));else{await bear('polar').click();await tip(0).click();}
   assert.match(await tip(2).innerText(),/American black bear/);
   await at('tree-check').click();assert.match(await at('tree-feedback').innerText(),/Tree checked/);
   await layout('tree');
   await next('explain');
   assert.match(await at('recap').innerText(),/Brown \+ Black.*Polar bear skull.*Claws/s);
   await at('conclusion').fill('Polar and brown shared the newer branch point. They differed at zero of 72 positions.');
   await at('revise').fill('I revised my first guess because the skull alone cannot tell which pair split last.');
   await p.locator('[data-step=dna]').click();
   await at('dna-pairs').getByText('Polar + Brown').click();
   await tile(1).click();await at('check').click();
   assert.match(await at('dna-feedback').innerText(),/earlier correct result and progress are still saved/);
   assert.match(await at('progress').innerText(),/4 of 4/);
   await p.reload();
   assert(await p.locator('[data-step=explain]').isEnabled());
   await p.locator('[data-step=explain]').click();
   const id=await p.evaluate(()=>JSON.parse(localStorage.getItem('aplab:openscied:b5-ancestry:v1')).id);
   await p.reload();assert.equal(await at('revise').inputValue(),'I revised my first guess because the skull alone cannot tell which pair split last.');
   assert.match(await at('progress').innerText(),/4 of 4/);
   await p.getByRole('button',{name:'Preview report',exact:true}).click();
   const report=await p.getByRole('dialog').filter({hasText:'Bear Ancestry Lab'}).innerText();
   assert.match(report,new RegExp('BA-'+id));assert.match(report,/zero of 72.*revised my first guess/s);
   assert.match(report,/The model brown claw reaches farther/);
   assert.match(report,/Avery Test.*Class period.*2/s);
   assert.match(report,/MAFFT alignment.*cannot date their split/s);
   assert.match(report,/Giant panda.*Spectacled Bear/s);
   assert.match(report,/first 72 bases can give the same count.*full comparisons/s);
   if(width===1366)assert.match(report,/Giant panda \+ Polar Bear\s+273/);
   if(width===1366){
    await p.getByText('More formats',{exact:true}).click();
    const diagnostic=async()=>p.locator('dialog .osr-tools [role=status]').allTextContents();
    let doc;
    try{
     [doc]=await Promise.all([p.waitForEvent('download',{timeout:12000}),p.getByRole('button',{name:/Download.*Word/}).click()]);
    }catch(err){
     const state=await p.evaluate(()=>({packer:typeof window.docx?.Packer?.toBlob,packingError:window.__baWordError,report:document.querySelector('dialog .osr-tools [role="status"]')?.textContent}));
     throw new Error('Word download: '+JSON.stringify({state,feedback:await diagnostic(),errs}),{cause:err});
    }
    assert.equal(doc.suggestedFilename(),'bear-ancestry-submission.docx');
    assert.equal(fs.readFileSync(await doc.path()).subarray(0,2).toString(),'PK');
   }
   await p.keyboard.press('Escape');await layout('explain');
   if(width===1366){
    await p.getByText('Other report formats: HTML or JSON',{exact:true}).click();
    let [file]=await Promise.all([p.waitForEvent('download'),at('save-json').click()]);
    const json=JSON.parse(fs.readFileSync(await file.path(),'utf8'));
    assert.deepEqual(json.student,{name:'Avery Test',period:'2'});assert.equal(json.datasetId,'BA-'+id);assert.equal(json.status,'final');
    assert.equal(json.work,undefined);
    assert.match(JSON.stringify(json.report),/first 72 bases can give the same count/);
    assert.match(JSON.stringify(json.report),/Giant panda.*Polar Bear.*273/);
    [file]=await Promise.all([p.waitForEvent('download'),at('save-html').click()]);
    const html=fs.readFileSync(await file.path(),'utf8');
    assert.match(html,/^<!doctype html>[\s\S]*Avery Test[\s\S]*BA-[A-F0-9]{8}[\s\S]*first 72 bases can give the same count[\s\S]*273/);
    assert.doesNotMatch(html,/<script\b/i);
   }
   await at('reset').click();
   assert(await at('clear-work').isDisabled());
   await at('keep-work').click();
   assert.match(await at('progress').innerText(),/4 of 4/);
   if(width===1366){
    await p.evaluate(()=>localStorage.setItem('aplab:openscied:unrelated:v1','sibling survives'));
    await at('reset').click();
    await at('reset-confirm').fill('ERASE');
    await Promise.all([p.waitForEvent('load'),at('clear-work').click()]);
    assert(await visible('traits'));
    assert.match(await at('progress').innerText(),/0 of 4/);
    assert.match(await at('identity').innerText(),/Avery Test/);
    assert.equal(await p.evaluate(()=>localStorage.getItem('aplab:openscied:unrelated:v1')),'sibling survives');
   }
   assert.deepEqual(errs,[]);
   await c.close();console.log('Bear Ancestry '+width+'px: stations and caliper, real DNA, gated tree, persistence and report');
  }
 }finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
