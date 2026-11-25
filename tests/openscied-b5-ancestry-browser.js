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
   if(width===1366)await c.addInitScript({path:path.join(path.dirname(require.resolve('docx')),'index.iife.js')});
   const p=await c.newPage(),errs=[];
   p.on('pageerror',e=>errs.push(e.message));
   await p.route('https://**/*',route=>route.abort());
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
   await at('note').fill('The model brown claw reaches farther.');
   await at('hypotheses').getByText('Brown + Black').click();
   await at('lock').click();
   await layout('traits');
   await next('dna');
   assert(await visible('dna'));
   const tile=i=>p.locator('[data-base="'+i+'"]');
   await tile(0).focus();await tile(0).press('ArrowRight');assert(await tile(1).evaluate(n=>n===document.activeElement));
   await tile(1).press('Space');await at('check').click();
   assert.match(await at('status').innerText(),/matching letters/);
   await tile(1).click();await at('check').click();
   await at('dna-pairs').getByText('Polar + Black').click();
   await tile(3).click();await at('check').click();assert.match(await at('status').innerText(),/still unmarked/);
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
    const wait=p.waitForEvent('download');await at('fasta').click();const dl=await wait, fasta=fs.readFileSync(await dl.path(),'utf8');
    assert.equal(fasta.match(/^>/gm).length,8);assert.match(fasta,/>Polar_Bear\nGGCGAAGAA/);
   }
   await next('tree');
   const bear=k=>p.locator('[data-bear="'+k+'"]'), tip=i=>p.locator('[data-tip="'+i+'"]');
   await at('tree-check').click();assert.match(await at('status').innerText(),/all three/);
   await bear('black').click();await tip(0).click();
   await bear('brown').click();await tip(1).click();
   await bear('polar').click();await tip(2).click();
   await at('tree-check').click();assert.match(await at('status').innerText(),/fewest differences/);
   if(width===1366)await bear('polar').dragTo(tip(0));else{await bear('polar').click();await tip(0).click();}
   assert.match(await tip(2).innerText(),/American black bear/);
   await at('tree-check').click();assert.match(await at('status').innerText(),/Tree checked/);
   await layout('tree');
   await next('explain');
   assert.match(await at('recap').innerText(),/Brown \+ Black.*Polar bear skull.*Claws/s);
   await at('conclusion').fill('Polar and brown shared the newer branch point. They differed at zero of 72 positions.');
   await at('revise').fill('I revised my first guess because the skull alone cannot tell which pair split last.');
   const id=await p.evaluate(()=>JSON.parse(localStorage.getItem('aplab:openscied:b5-ancestry:v1')).id);
   await p.reload();assert.equal(await at('revise').inputValue(),'I revised my first guess because the skull alone cannot tell which pair split last.');
   assert.match(await at('progress').innerText(),/4 of 4/);
   await p.getByRole('button',{name:'Preview report',exact:true}).click();
   const report=await p.getByRole('dialog').filter({hasText:'Bear Ancestry Lab'}).innerText();
   assert.match(report,new RegExp('BA-'+id));assert.match(report,/zero of 72.*revised my first guess/s);
   assert.match(report,/The model brown claw reaches farther/);
   if(width===1366){
    await p.getByText('More formats',{exact:true}).click();
    const [doc]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:/Download.*Word/}).click()]);
    assert.equal(doc.suggestedFilename(),'bear-ancestry-submission.docx');
    assert.equal(fs.readFileSync(await doc.path()).subarray(0,2).toString(),'PK');
   }
   await p.keyboard.press('Escape');await layout('explain');
   assert.deepEqual(errs,[]);
   await c.close();console.log('Bear Ancestry '+width+'px: stations and caliper, real DNA, gated tree, persistence and report');
  }
 }finally{await browser.close();server.close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
