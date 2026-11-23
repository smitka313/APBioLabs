/* Lesson 7's inline, map-first entry in desktop and small-screen layouts. */
const assert = require('node:assert/strict');
const T = require('./_h');
(async () => {
  const browser=await T.launch(), server=await T.serve();
  try {
    for (const [width,height] of [[390,844],[768,960],[1366,900],[1920,1080]]) {
      const context=await T.ctxFor(browser,{width,height,dark:width===390,reduced:true});
      try {
        const page=await context.newPage();
        await page.goto(server.url+'openscied-b1-serengeti.html');
        const board=page.locator('#sg-map-panel'), rail=page.locator('#sg-expedition-rail'), play=page.locator('#sg-play');
        const hit=page.locator('#sg-start');
        await hit.waitFor();
        const beforeBoard=await board.boundingBox(), beforeRail=await rail.boundingBox();
        assert(beforeBoard && beforeRail);
        if (width===390) T.ok(beforeRail.y<beforeBoard.y,'phone opens with real role controls first');
        else T.ok(beforeRail.x>beforeBoard.x+beforeBoard.width-1,'wide layouts place role/turn rail next to the map');
        await hit.click();
        await play.waitFor();
        T.ok((await play.getAttribute('data-phase'))!=='setup','starting enters the inline game');
        T.ok(await page.locator('#sg-board-dialog').evaluate(el=>!el.open),'normal Start never opens a second map');
        T.ok(await page.locator('#sg-map-panel #sg-scene svg').isVisible(),'native live map remains visible');
        if (width===390) {
          const liveBoard=await board.boundingBox(), liveRail=await rail.boundingBox();
          T.ok(liveBoard.y<liveRail.y,'phone gameplay puts the map above the turn rail');
          const mapBox=await page.locator('#sg-map-panel svg.sg-map').boundingBox();
          T.ok(mapBox.width>=300,'phone has at least 300 px usable map width');
        }
        const next=page.locator('#sg-next');
        await next.click();
        T.ok((await page.locator('#sg-expedition-rail #sg-last').textContent()).includes('cumulative'),'latest field note shows game outcome in the same rail');
        T.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
      } finally {await context.close();}
    }
  } finally {await browser.close();server.close();}
  T.done('t107-serengeti-expedition');
})().catch(err=>{console.error(err);process.exitCode=1;});
