/* Serengeti evidence and response export. Tests use only fictional activity data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const T = require('./_h');
const KEY = 'aplab:openscied-b1-serengeti:preview-v1';

async function download(page, button, filename) {
  const started = page.waitForEvent('download',{timeout:7000});
  await button.click();
  const file = await started;
  assert.equal(file.suggestedFilename(),filename);
  return fs.readFileSync(await file.path(),'utf8');
}
(async () => {
  const browser=await T.launch(), site=await T.serve();
  try {
    for(const width of [390,1366]) {
      const context=await T.ctxFor(browser,{width,height:width===390?844:900,dark:width===390,reduced:true});
      try {
        await context.addInitScript(()=>{
          const original=crypto.getRandomValues.bind(crypto);
          crypto.getRandomValues=a=>{ if(a instanceof Uint32Array && a.length===1){a[0]=32737;return a;} return original(a); };
        });
        const page=await context.newPage(), errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(site.url+'openscied-b1-serengeti.html');
        await page.locator('#sg-start').click();
        await page.locator('#sg-next[data-action="migrate"]').click();
        await page.locator('#sg-next[data-action="draw"]').click();
        const card=page.locator('#sg-event-modal');
        if(await card.count()) {
          await card.waitFor();
          await card.locator('.sg-event-continue').click();
          await card.waitFor({state:'hidden'});
        }
        await page.locator('#sg-next[data-action="resolveCard"]').click();
        await page.locator('.sg-tabs [data-page="analyze"]').click();
        await page.locator('#sg-question-details > summary').click();
        await page.locator('#sg-question').fill('A fictional question.');
        await page.locator('#sg-evidence-choice').selectOption('1');
        await page.locator('#sg-answer-next').click();
        await page.locator('#sg-claim').fill('A fictional explanation with numbers.');
        await page.locator('#sg-answer-next').click();
        await page.locator('#sg-limits').fill('A fictional next test.');
        await page.reload();
        assert.equal(await page.locator('[data-answer-panel]:visible').getAttribute('data-answer-panel'),'limits');
        assert.equal(await page.locator('#sg-question').inputValue(),'A fictional question.');
        assert.equal(await page.locator('#sg-evidence-choice').inputValue(),'1');
        assert.equal(await page.locator('#sg-claim').inputValue(),'A fictional explanation with numbers.');
        assert.equal(await page.locator('#sg-limits').inputValue(),'A fictional next test.');
        const filename='Serengeti-game-evidence.txt';
        const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);
        await page.locator('#sg-other-downloads > summary').click();
        const report=await download(page,page.locator('#sg-download'),filename);
        assert.match(report,/SIMULATED/);
        assert.match(report,/Season totals\nWinter/);
        assert.match(report,/Event and hunt history\nWinter · Winter setup[^\n]*\nWinter · A hyena cub survives/);
        assert.match(report,/Investigation question: A fictional question\./);
        assert.match(report,/Evidence: Cumulative change: 0 → 0/);
        assert.match(report,/Explanation: A fictional explanation with numbers\./);
        assert.match(report,/Further test: A fictional next test\./);
        assert.match(await page.locator('#sg-download-status').textContent(),/Download requested/);
        assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),raw);
        await page.locator('#sg-restart').click();
        const confirm=page.locator('#sg-confirm');
        await confirm.waitFor();
        assert.equal(await download(page,confirm.locator('#sg-restart-download'),filename),report);
        assert.match(await confirm.locator('#sg-restart-download-status').textContent(),/Download requested/);
        await confirm.getByRole('button',{name:'Keep playing'}).click();
        await confirm.waitFor({state:'hidden'});
        assert.equal(await page.locator('#sg-claim').inputValue(),'A fictional explanation with numbers.');
        assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),raw);
        await page.evaluate(()=>{URL.createObjectURL=()=>{throw new Error('fictional blocked download');};});
        await page.locator('#sg-download').click();
        assert.match(await page.locator('#sg-download-status').textContent(),/could not start/);
        assert.equal(await page.locator('#sg-download-fallback').evaluate(el=>el.open),true);
        assert.equal(await page.locator('#sg-download-copy').inputValue(),report);
        assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),raw);
        if(width===390) {
          const unparsed=' {"v":99,"fictional":"exact original"} ';
          await page.evaluate(([k,value])=>localStorage.setItem(k,value),[KEY,unparsed]);
          await page.reload();
          await page.locator('#sg-restart').click();
          await confirm.waitFor();
          assert.match(await confirm.locator('#sg-restart-download').textContent(),/preserved save/i);
          assert.equal(await download(page,confirm.locator('#sg-restart-download'),'Serengeti-preserved-save.txt'),unparsed);
          assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),unparsed);
        }
        assert.deepEqual(errors,[]);
        console.log(`PASS evidence export, restart backup, and blocked-download fallback: ${width}px`);
      } finally { await context.close(); }
    }
  } finally {await browser.close();site.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});

