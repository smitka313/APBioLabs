/* Browser regression for the illustrated event dialog, not a second gameplay run. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('./_h');
const L = require('../serengeti-logic');
const state = L.act(L.act(L.create(32737), {type:'migrate'}), {type:'draw'});
const event = L.phase(state).card;
const saveKey = 'aplab:openscied-b1-serengeti:preview-v1';
const shotDir = process.env.SERENGETI_SCREENSHOTS;

(async () => {
  const browser = await T.launch(), server = await T.serve();
  try {
    for (const [width,height] of [[390,844],[1366,900]]) {
      const context = await T.ctxFor(browser,{width,height,dark:width===390,reduced:true});
      try {
        await context.addInitScript(() => { const get = crypto.getRandomValues.bind(crypto); crypto.getRandomValues = a => {
          if (a instanceof Uint32Array && a.length===1) { a[0]=32737; return a; } return get(a);
        }; });
        const page=await context.newPage(), errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(server.url+'openscied-b1-serengeti.html');
        await page.locator('#sg-start').click();
        await page.locator('#sg-next[data-action="migrate"]').click();
        await page.locator('#sg-next[data-action="draw"]').click();
        const modal=page.locator('#sg-event-modal'), cont=modal.getByRole('button',{name:'Continue to board'});
        await modal.waitFor();
        assert.equal(await modal.locator('#sg-event-wording').textContent(),event.text);
        assert.match(await modal.locator('#sg-event-kicker').textContent(),/Winter.*Wildebeest drew/);
        assert.equal(await modal.locator('#sg-event-art svg').count(),1);
        assert.ok((await modal.locator('#sg-event-effect-text').textContent()).length>20);
        const box=await modal.boundingBox();
        assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=width+1 && box.y+box.height<=height+1,`modal fits ${width} x ${height}`);
        assert.equal(await modal.evaluate(el=>getComputedStyle(el).animationName),'none');
        assert.equal(await cont.evaluate(el=>el===document.activeElement),true);
        if (shotDir) {fs.mkdirSync(shotDir,{recursive:true});await page.screenshot({path:path.join(shotDir,`serengeti-card-${width}.png`)});}
        const raw=await page.evaluate(k=>localStorage.getItem(k),saveKey);
        await page.keyboard.press('Escape');
        await modal.waitFor({state:'hidden'});
        await page.waitForFunction(()=>document.activeElement?.id==='sg-options');
        const choose=page.locator('#sg-options');
        const pick=await choose.locator('option').nth(2).getAttribute('value');
        await choose.selectOption(pick);
        assert.equal(await modal.isVisible(),false,'selection must not reopen the dialog');
        await page.getByRole('button',{name:'View illustrated card'}).click();
        await modal.waitFor();
        await cont.click();
        await modal.waitFor({state:'hidden'});
        assert.equal(await choose.inputValue(),pick);
        assert.equal(await page.evaluate(k=>localStorage.getItem(k),saveKey),raw,'reading must not write or apply the pending card');
        await page.reload();
        await page.locator('#sg-next[data-action="resolveCard"]').waitFor();
        assert.equal(await modal.isVisible(),false,'restoring a pending card should not force pop-up');
        await page.getByRole('button',{name:'View illustrated card'}).click();
        await modal.waitFor();
        await modal.getByRole('button',{name:'Close event card'}).click();
        await page.locator('#sg-next[data-action="resolveCard"]').click();
        const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),saveKey);
        assert.equal(saved.game.log.at(-1).cardId,event.id);
        assert.deepEqual(errors,[]);
        console.log(`PASS event card: ${width}px keyboard, wording, image, effect, state and fit`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
