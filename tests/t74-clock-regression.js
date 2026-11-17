/* Independent ordinary-least-squares regression check for the displayed molecular-clock data. */
const T = require('./_h');
(async () => {
 const browser = await T.launch();
 try {
  const ctx = await T.ctxFor(browser);
  const page = await T.open(ctx,'lab03.html','design');
  const result = await page.evaluate(() => {
   const clock = Lab._reg.tables.find(t=>t.el.id==='clock-table');
   clock.api.setRows([{gene:'A',t:100,ident:95},{gene:'A',t:200,ident:89},{gene:'A',t:300,ident:84},{gene:'A',t:400,ident:77},{gene:'A',t:500,ident:73}],{setup:false});
   const rows = clock.getRows();
   const eligible = rows.filter(r=>r.gene==='A' && r.t!=null && r.ident!=null && Number.isFinite(Number(r.t)) && Number.isFinite(Number(r.ident)));
   const filtered = document.querySelector('#clock-max').checked ? eligible.filter(r=>Number(r.t)<=Number(document.querySelector('#clock-max-range').value)) : eligible;
   if(filtered.length<2)return {count:filtered.length};
   const xs=filtered.map(r=>Number(r.t)),ys=filtered.map(r=>Number(r.ident)),n=xs.length;
   const mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;
   const ssx=xs.reduce((a,x)=>a+(x-mx)**2,0),cov=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0);
   const slope=cov/ssx,intercept=my-slope*mx;
   const sst=ys.reduce((a,y)=>a+(y-my)**2,0),sse=ys.reduce((a,y,i)=>a+(y-(slope*xs[i]+intercept))**2,0);
   return {count:n,slope,intercept,r2:1-sse/sst,displaySlope:parseFloat(document.querySelector('#d-slope').textContent),displayIntercept:parseFloat(document.querySelector('#d-intercept').textContent),displayR2:parseFloat(document.querySelector('#d-r2').textContent)};
  });
  T.ok(result.count>=2,'clock data inspected with a nontrivial synthetic fixture');
  if(result.count>=2){T.ok(Math.abs(result.slope*100-result.displaySlope)<.02,'independent slope matches');T.ok(Math.abs(result.intercept-result.displayIntercept)<.02,'independent intercept matches');T.ok(Math.abs(result.r2-result.displayR2)<.002,'independent R2 matches');}
  T.ok(page.errors.length===0,'no browser errors');
  await ctx.close();
 }finally{await browser.close()}
 T.done('t74-clock-regression');
})().catch(e=>{console.error(e);process.exitCode=1});
