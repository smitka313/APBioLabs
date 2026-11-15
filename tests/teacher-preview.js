/* Package A visual QA: static-site preview screenshots without deployment. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, rel);
  if (!(file === root || file.startsWith(root + path.sep))) {res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);});
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port = server.address().port;
  const browser = await chromium.launch({headless:true});
  fs.mkdirSync('preview-screenshots',{recursive:true});
  const pages=['index.html','teachers.html','getting-started.html','sample-report.html','feedback.html'];
  let failed=false;
  for(const pageName of pages){
    for(const [device,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
      const page=await browser.newPage({viewport,deviceScaleFactor:1});
      const errors=[];
      page.on('pageerror',err=>errors.push(err.message));
      const response=await page.goto('http://127.0.0.1:'+port+'/'+pageName,{waitUntil:'networkidle'});
      await page.screenshot({path:'preview-screenshots/'+pageName.replace('.html','')+'-'+device+'.png',fullPage:true});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
      const ok=response.status()===200 && !errors.length && !overflow;
      console.log((ok?'PASS':'FAIL')+' '+pageName+' '+device+' HTTP '+response.status()+' errors='+JSON.stringify(errors)+' overflow='+overflow);
      if(!ok)failed=true;
      await page.close();
    }
  }
  await browser.close();
  server.close();
  if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
