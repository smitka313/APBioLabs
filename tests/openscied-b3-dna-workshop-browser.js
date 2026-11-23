'use strict';

// Classroom path, including real pointer gestures, for the toy-sequence primer.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { ROOT, serve } = require('./_h');

const FILE = 'openscied-b3-dna-workshop.html';
const OUT = path.join(ROOT, 'artifacts', 'openscied-dna-workshop');
const AXE = require.resolve('axe-core/axe.min.js');
const CASES = [
  { width:390, height:844, dark:true, touch:true },
  { width:768, height:1024 },
  { width:1366, height:768 },
  { width:1920, height:1080 }
];
const CONTROL = ['build','copy','rna','chain','sort'];
const tidy = value => (value || '').replace(/\s+/g,' ').trim();
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const button = (page, name) => page.locator('button[data-dw-go="' + name + '"]').first();
const board = page => page.locator('#dw-board');
const source = (page, key) => page.locator('#dw-activity button[data-dw-piece="' + key + '"]');
const target = (page, key) => board(page).locator('button[data-dw-slot="' + key + '"]');
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks++;
  console.log('ok: ' + label);
}
async function makeContext(browser, base, size) {
  const context = await browser.newContext({
    viewport:{ width:size.width, height:size.height },
    colorScheme:size.dark?'dark':'light', reducedMotion:'reduce', hasTouch:!!size.touch,
    acceptDownloads:true
  });
  const origin = new URL(base).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  // A private synthetic clipboard, not the machine's real clipboard, detects
  // any attempted copy without exposing names, writing, or other device data.
  await context.addInitScript(() => {
    window.__workshopClipboard = [];
    window.__workshopNavEvents = [];
    for (const kind of ['pointerdown','pointerup','pointercancel','click']) {
      document.addEventListener(kind,event=>{
        const control=event.target.closest?.('#dw-next, #dw-undo');
        if (!control) return;
        window.__workshopNavEvents.push({
          kind, control:control.id, pointer:event.pointerType||'', detail:event.detail,
          stage:document.querySelector('#dw-board')?.dataset.currentStage
        });
        if (window.__workshopNavEvents.length>12) window.__workshopNavEvents.shift();
      },true);
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable:true, value:{ writeText:async text => window.__workshopClipboard.push(text) }
    });
  });
  return context;
}
async function invoke(locator, size) {
  if (size.touch) await locator.tap();
  else await locator.press('Enter');
}
async function shot(page, name) {
  await page.screenshot({ path:path.join(OUT,name+'.png'), fullPage:true, animations:'disabled', timeout:15000 });
}
async function fits(page, selectors, label) {
  const faults = await page.locator(selectors).evaluateAll(nodes => {
    const boundary = document.documentElement.clientWidth;
    return nodes.flatMap(node => {
      const r=node.getBoundingClientRect();
      return r.width && r.height && (r.left < -1 || r.right > boundary + 1)
        ? [node.id || node.dataset.dwSlot || node.tagName] : [];
    });
  });
  check(!faults.length && await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    label + ' viewport has no horizontal clipping or page overflow: ' + faults.join(', '));
}
async function a11y(page, scope, label) {
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path:AXE });
  const faults=await page.evaluate(async target => {
    const result=await window.axe.run(target,{
      runOnly:{ type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa'] },
      resultTypes:['violations']
    });
    return result.violations.map(v=>[v.id,v.nodes.map(node=>node.target)]);
  },scope);
  check(!faults.length,label+' accessibility '+JSON.stringify(faults));
}
async function gesture(page, chip, well, input) {
  if (input === 'keyboard') {
    if (await chip.getAttribute('aria-pressed') !== 'true') await chip.press('Enter');
    await well.press('Enter');
    return;
  }
  if (input === 'tap') {
    if (await chip.getAttribute('aria-pressed') !== 'true') await chip.tap();
    await well.tap();
    return;
  }

  await Promise.all([chip.waitFor({state:'visible'}),well.waitFor({state:'visible'})]);
  await chip.scrollIntoViewIfNeeded();
  let [a,b]=await Promise.all([chip.boundingBox(),well.boundingBox()]);
  assert.ok(a && b,'both the actual tile and the target have screen coordinates');
  const height=page.viewportSize().height;
  const minY=Math.min(a.y,b.y),maxY=Math.max(a.y+a.height,b.y+b.height);
  assert.ok(maxY-minY < height-12,'drag source and destination fit on screen together');
  if (minY < 6 || maxY > height-6) {
    await page.evaluate(delta=>window.scrollBy({left:0,top:delta,behavior:'instant'}),(minY+maxY-height)/2);
    [a,b]=await Promise.all([chip.boundingBox(),well.boundingBox()]);
  }
  const center=x=>({x:Math.round(x.x+x.width/2),y:Math.round(x.y+x.height/2)});
  [a,b]=[center(a),center(b)];
  assert.ok([a,b].every(p=>p.y>0&&p.y<height&&p.x>0&&p.x<page.viewportSize().width),
    'drag uses actual visible coordinates rather than dispatching a DOM click');
  if (input === 'mouse') {
    await page.mouse.move(a.x,a.y);
    await page.mouse.down();
    await page.mouse.move(b.x,b.y,{steps:12});
    await page.mouse.up();
  } else {
    const session=await page.context().newCDPSession(page);
    try {
      const send=(type,point)=>session.send('Input.dispatchTouchEvent',{
        type,touchPoints:point?[{...point,id:1}]:[]
      });
      await send('touchStart',a);
      for(let i=1;i<=12;i++)await send('touchMove',{x:a.x+(b.x-a.x)*i/12,y:a.y+(b.y-a.y)*i/12});
      await send('touchEnd');
    } finally {
      await session.detach();
    }
  }
}

const SAVE = 'aplab:openscied:b3-dna-workshop:v1';
const MODEL_IDS = { build:'pair', copy:'copy', rna:'transcribe', chain:'translate', sort:'sort' };
const NOTES = {
  build:'The base pairing on one DNA strand helped me work out the opposite strand.',
  copy:'Each new DNA molecule kept one original strand.',
  rna:'The transcript was made from one DNA template strand.',
  chain:'The last codon stopped the model and did not add an amino acid.',
  sort:'Copying made two DNA molecules; reading the transcript made a chain.'
};
const Model = require('../openscied-b3-dna-workshop-logic.js');
const readRecord = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), SAVE);
const clipboard = page => page.evaluate(() => window.__workshopClipboard.slice());
function savedPlacements(record) {
  return record?.progress?.placed ?? record?.model?.placed ?? record?.placed;
}
async function stage(page, name) {
  const aliases = [name, MODEL_IDS[name]];
  try {
    await page.waitForFunction(names => names.includes(document.querySelector('#dw-board')?.dataset.currentStage),
      aliases,{ timeout:12000 });
  } catch (error) {
    const state=await page.evaluate(()=>({
      hash:location.hash, active:document.activeElement?.id,
      stage:document.querySelector('#dw-board')?.dataset.currentStage,
      next:document.querySelector('#dw-next')?.textContent,
      nextDisabled:document.querySelector('#dw-next')?.disabled,
      nav:window.__workshopNavEvents
    }));
    throw new Error('Expected workshop stage '+name+' after real input, got '+JSON.stringify(state),{ cause:error });
  }
  check(await board(page).isVisible() &&
    await button(page,name).getAttribute('aria-current')==='step' &&
    await page.locator('nav [data-dw-go][aria-current="step"]').count()===1,
    name + ' shows its board as the single active step');
}
async function place(page, slot, value, input, label) {
  await gesture(page, source(page,value), target(page,slot), input);
  check(await target(page,slot).getAttribute('data-dw-placed') === value,
    label + ' ' + input + ' sets the exact piece in ' + slot);
}
const slotsOf = name => Model.stage(MODEL_IDS[name]).slots.map(item =>
  typeof item === 'string' ? Model.slot(item) : item);
async function rejectFirstPair(page, first, input, label) {
  const wrong=first.choices.find(piece=>piece!==first.expected);
  assert.ok(wrong,'the base slot offers a meaningful incorrect choice');
  await gesture(page,source(page,wrong),target(page,first.id),input);
  const feedback=page.locator('#dw-feedback');
  check(await target(page,first.id).getAttribute('data-dw-placed') === null &&
    await page.locator('#dw-next').isDisabled() &&
    await feedback.isVisible() && tidy(await feedback.textContent()).length > 6,
    label+' rejects a wrong base choice without filling the slot or unlocking the next step');
}
async function report(page) {
  check((await clipboard(page)).length === 0,'nothing writes private workshop notes to the clipboard during the activity');
  await page.locator('#dw-name').fill('DNA Workshop QA');
  await page.locator('#dw-period').fill('6');
  const download=page.waitForEvent('download');
  await page.locator('#dw-download').press('Enter');
  const file=await download;
  const text=await fs.readFile(await file.path(),'utf8');
  check(file.suggestedFilename()==='dna-workshop-investigation.txt' &&
    /DNA Workshop/i.test(text) && /toy|model/i.test(text) &&
    /DNA Workshop QA/.test(text) && /(?:class |classroom )?period: 6/i.test(text) &&
    Object.values(NOTES).every(note=>text.includes(note)),
    'the downloaded report includes saved reflections from all five stages and identifies the toy activity');
  check((await clipboard(page)).length === 0,'downloading leaves the clipboard untouched');
  await page.locator('#dw-copy').press('Enter');
  await page.waitForFunction(() => window.__workshopClipboard.length === 1);
  check(same(await clipboard(page),[text]) &&
    await page.locator('#dw-record-text').inputValue() === text,
    'explicit Copy writes just the displayed investigation report once');
  await page.keyboard.press('Escape');
}
async function dashboard(page, base) {
  await page.goto(base+'openscied-dashboard.html');
  const unit=page.locator('section[aria-labelledby="unit3"]');
  const cards=await unit.locator('.dashboard-open').evaluateAll(nodes=>nodes.map(node=>node.id));
  const index=cards.indexOf('dna-workshop-open');
  check(index>=0 && cards[index+1]==='dna-p53-open' &&
    await unit.locator('#dna-workshop-open').getAttribute('href')===FILE,
    'the Unit 3 dashboard lists DNA Workshop immediately before the DNA/p53 activity');
  const resume=page.locator('#openscied-resume-link');
  check(await resume.isVisible() && (await resume.getAttribute('href')).startsWith(FILE),
    'the dashboard can resume the current student workshop');
  await resume.press('Enter');
  await stage(page,'sort');
  check(await page.locator('#dw-response').inputValue()===NOTES.sort,
    'dashboard Resume restores the saved final explanation');
  await page.goto(base+'openscied-teacher-guide.html');
  const card=page.locator('article[data-guide-for="'+FILE+'"]');
  check(await card.count()===1 && await card.locator('a[href="'+FILE+'"]').isVisible(),
    'the teacher guide lists the classroom plan for this activity');
}

const DNA_A = 'ATGGCTTTTTAA';
const DNA_B = 'TACCGAAAAATT';
const MSG = 'AUGGCUUUUUAA';
const expectedRows = {
  build:{ 'pair-upper':DNA_A,'pair-lower':DNA_B },
  copy:{
    'copy-daughter-a-original':DNA_A,'copy-daughter-a-new':DNA_B,
    'copy-daughter-b-new':DNA_A,'copy-daughter-b-original':DNA_B
  },
  rna:{ 'rna-template':DNA_B,'rna-product':MSG },
  chain:{ 'chain-codons':'AUG GCU UUU UAA','chain-product':'Met Ala Phe Stop' }
};
async function exactStage(page,name,slots,label) {
  check((await Promise.all(slots.map(slot => target(page,slot.id).getAttribute('data-dw-placed'))))
    .every((value,i)=>value===slots[i].expected),label+' '+name+' preserves placements in their exact positions');
  if(expectedRows[name]){
    const actual=await board(page).locator('[data-dw-row]').evaluateAll(rows=>Object.fromEntries(rows.map(row=>{
      const items=[...row.querySelectorAll('[data-dw-value]')].map(node=>node.dataset.dwValue);
      const spacing=items.some(item=>item.length>1)?' ':'';
      return [row.dataset.dwRow,items.join(spacing)];
    })));
    check(same(actual,expectedRows[name]),label+' '+name+' shows each base, codon, and placed product in strand order');
  }
  if(name==='copy'){
    const groups=await board(page).locator('[data-molecule]').evaluateAll(nodes=>nodes.map(node=>({
      original:node.querySelectorAll('[data-strand="original"]').length,
      made:node.querySelectorAll('[data-strand="new"]').length
    })));
    check(groups.length===2 && groups.every(g=>g.original===1&&g.made===1),
      label+' copies two daughter DNA molecules, with one original and one new strand in each');
  } else if(name==='rna'){
    check(await board(page).locator('[data-dw-row="rna-template"][data-strand="original"]').count()===1 &&
      await board(page).locator('[data-strand="original"]').count()===1 &&
      await board(page).locator('[data-dw-row="rna-product"][data-strand="rna"]').count()===1 &&
      !MSG.includes('T') && MSG.includes('U'),
      label+' displays one DNA template and its single new RNA product');
  } else if(name==='chain'){
    const chain=page.locator('#dw-history [data-dw-evidence-row="chain-product"] dd');
    const product=tidy(await chain.innerText());
    check(await target(page,'chain-product-3').getAttribute('data-stop')==='true' &&
      await target(page,'chain-product-3').getAttribute('data-dw-placed')==='Stop' &&
      await board(page).locator('[data-dw-chain-count="3"]').count()===1 &&
      /^Methionine → Alanine → Phenylalanine; Stop ends the chain/i.test(product) &&
      /no amino acid|does not add/i.test(await board(page).innerText()),
      label+' the last codon is a stop signal and the product counts only three amino acids');
  }
  const directions=Model.stage(MODEL_IDS[name]).rows.filter(row=>row.direction);
  if(directions.length)check((await Promise.all(directions.map(row=>
    board(page).locator('[data-dw-row="'+row.id+'"] .dw-direction').getAttribute('aria-label'))))
    .every((text,i)=>text==='Left end '+directions[i].direction[0]+', right end '+directions[i].direction[1]),
    label+' '+name+' keeps each visible strand’s reading direction explicit');
}
async function evidenceBySort(page,label) {
  check(await page.locator('#dw-evidence-now').isVisible() && await board(page).isVisible(),
    label+' evidence is available alongside the actual Sort board');
  const history=page.locator('#dw-history');
  for(const name of ['copy','rna','chain']) {
    const record=history.locator('[data-dw-history="'+name+'"]');
    check(await record.isVisible() && tidy(await record.innerText()).length>35,
      label+' prior '+name+' evidence is available without leaving Sort');
  }
  for(const [name,sequence] of [
    ['copy-daughter-a-original',DNA_A],['copy-daughter-a-new',DNA_B],
    ['copy-daughter-b-original',DNA_B],['copy-daughter-b-new',DNA_A],
    ['rna-template',DNA_B],['rna-product',MSG]
  ]){
    const product=history.locator('[data-dw-evidence-row="'+name+'"] dd');
    const parts=(await product.innerText()).match(/[ACGTU]{3}/g);
    check(await product.isVisible() && parts?.join('')===sequence,
      label+' Sort carries the student’s exact completed product '+name);
  }
  const chain=history.locator('[data-dw-evidence-row="chain-product"] dd');
  check(await chain.isVisible() && /Methionine → Alanine → Phenylalanine; Stop ends the chain/i.test(await chain.innerText()),
    label+' Sort carries the completed chain with its separate Stop signal');
}

async function exercise(browser,base,size) {
  const context=await makeContext(browser,base,size);
  try {
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const label=size.width+(size.dark?'-dark':'-light');
    await page.goto(base+FILE+(size.width===1366?'#chain':''));
    await page.getByRole('heading',{name:'DNA Workshop',level:1,exact:true}).waitFor();
    await stage(page,'build');
    check(await button(page,'build').isEnabled() &&
      (await Promise.all(CONTROL.slice(1).map(name=>button(page,name).isDisabled()))).every(Boolean),
      label+' opens for a novice with only the Build tab available, even from a direct link to a later step');
    await fits(page,'main, #dw-board, #dw-board [data-dw-slot]',label+' initial board');
    await shot(page,label+'-starting-build');
    if(size.touch)await a11y(page,'#dw-activity',label+' starting board');
    const ordinary=size.touch?'tap':'keyboard';
    for(const [index,name] of CONTROL.entries()) {
      await stage(page,name);
      const slots=slotsOf(name);
      assert.ok(slots.length,'test fixture has active slots for '+name);
      if(index<4)check(await page.locator('#dw-next').isDisabled(),label+' '+name+' starts with a completion gate');
      if(name==='build')await rejectFirstPair(page,slots[0],ordinary,label);
      if(name==='sort') {
        await evidenceBySort(page,label);
        const wrong=slots[0].choices.find(piece=>piece!==slots[0].expected);
        await gesture(page,source(page,wrong),target(page,slots[0].id),ordinary);
        check(await target(page,slots[0].id).getAttribute('data-dw-placed')===null &&
          !await page.locator('#dw-continue').isVisible(),label+' a wrong sort does not complete the workshop');
      }
      for(const [i,slot] of slots.entries()) {
        const drag=name==='build'&&i===0;
        const input=drag&&size.width===1366?'mouse':drag&&size.touch?'touch-drag':ordinary;
        await place(page,slot.id,slot.expected,input,label);
        if(name==='build'&&i===0&&size.width===1366) {
          await page.locator('#dw-undo').press('Enter');
          check(await target(page,slot.id).getAttribute('data-dw-placed')===null &&
            await page.locator('#dw-next').isDisabled(),'undo removes only the just-placed partner');
          await place(page,slot.id,slot.expected,ordinary,label);
          check((await clipboard(page)).length===0,'incorrect choice, real drag and undo leave the clipboard untouched');
          const before=await readRecord(page);
          check(savedPlacements(before)?.[slot.id]===slot.expected,'a partially built duplex is already saved locally');
          await page.reload();
          await stage(page,'build');
          check(await target(page,slot.id).getAttribute('data-dw-placed')===slot.expected &&
            same(savedPlacements(await readRecord(page)),savedPlacements(before)) &&
            await page.locator('#dw-next').isDisabled(),'reload restores partial work with the same unfinished gate');
        }
      }
      await exactStage(page,name,slots,label);
      await page.locator('#dw-response').fill(NOTES[name]);
      await fits(page,'main, #dw-board, #dw-board [data-dw-slot], #dw-response',label+' '+name+' completed board');
      await shot(page,label+'-'+name);
      if(index<4) {
        check(await page.locator('#dw-next').isEnabled() && await button(page,CONTROL[index+1]).isEnabled(),
          label+' '+name+' unlocks exactly the next stage after the correct placements');
        check((await clipboard(page)).length===0,label+' all routine placements and writing leave the clipboard untouched');
        await invoke(page.locator('#dw-next'),size);
      }
    }
    const next=page.locator('#dw-continue');
    check(await next.isVisible() && (await next.getAttribute('href')).startsWith('openscied-b3-dna-p53.html'),
      label+' finished primer offers the next DNA/p53 activity');
    if(size.touch)await a11y(page,'#dw-activity',label+' finished workshop');
    if(size.width===1366) {
      const finished=await readRecord(page);
      await page.reload();
      await stage(page,'sort');
      check(same(savedPlacements(await readRecord(page)),savedPlacements(finished)) &&
        await page.locator('#dw-response').inputValue()===NOTES.sort,
        'completed placements and own writing remain intact after reload');
      await button(page,'build').press('Enter');
      await stage(page,'build');
      check(await page.locator('#dw-response').inputValue()===NOTES.build,
        'revisiting Build restores the separate first-step writing rather than overwriting it');
      await button(page,'sort').press('Enter');
      await stage(page,'sort');
      await report(page);
      await dashboard(page,base);
    }
    check(errors.length===0,label+' no uncaught browser errors '+errors.join(', '));
  } finally {
    await context.close();
  }
}

(async()=>{
  const server=await serve();
  let browser;
  try {
    const executablePath=process.env.CHROMIUM_PATH||process.env.CHROMIUM_EXECUTABLE;
    browser=await chromium.launch(executablePath?{executablePath}:{});
    await fs.mkdir(OUT,{recursive:true});
    for(const size of CASES)await exercise(browser,server.url,size);
    console.log('openscied-b3-dna-workshop-browser: '+checks+' checks passed');
  } finally {
    if(browser)await browser.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
