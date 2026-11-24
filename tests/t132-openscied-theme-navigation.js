'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { ROOT, serve } = require('./_h');

const DASHBOARD = 'openscied-dashboard.html';
const ACTIVITY = 'openscied-b2-fires.html';
const KEY = 'aplab:pref:theme';
let checks = 0;
function ok(value, label) {
  assert.ok(value, label);
  checks++;
  console.log('ok: ' + label);
}
const control = (page, theme) => page.locator('.theme-switch button[data-mode="' + theme + '"]').first();

async function themeState(page, mode) {
  await page.waitForFunction(expected => {
    const root = document.documentElement;
    const pressed = [...document.querySelectorAll('.theme-switch button[aria-pressed="true"]')];
    return root.getAttribute('data-theme') === (expected === 'auto' ? null : expected) &&
      pressed.length > 0 && pressed.every(button => button.dataset.mode === expected);
  }, mode);
}

async function hop(browser, base, os, mode, cleanRoute) {
  const context = await browser.newContext({ colorScheme: os, reducedMotion:'reduce' });
  const origin = new URL(base).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  await context.addInitScript(() => {
    try {
      if (!localStorage.getItem('aplab:student')) localStorage.setItem('aplab:student', JSON.stringify({
        name:'Theme QA', period:'3'
      }));
      if (!localStorage.getItem('aplab:tour')) localStorage.setItem('aplab:tour', '{"seen":true,"v":1}');
    } catch (_) { /* About:blank */ }
  });
  try {
    const page = await context.newPage();
    await page.goto(base + DASHBOARD);
    await themeState(page,'auto');
    const switcher = control(page,mode);
    await switcher.click();
    await themeState(page,mode);
    ok(await page.evaluate(key => localStorage.getItem(key),KEY) === mode,
      'dashboard records explicit ' + mode + ' against a ' + os + ' system theme');

    const clean = ACTIVITY.replace(/\.html$/,'');
    if (cleanRoute) {
      // Cloudflare Pages canonicalizes this same-origin .html link.
      await page.route(base + ACTIVITY, route => route.fulfill({ status:302, headers:{location:'/'+clean} }));
      await page.route(base + clean, route => route.fulfill({
        path:path.join(ROOT,ACTIVITY), contentType:'text/html'
      }));
    }
    const target = new URL(base + (cleanRoute ? clean : ACTIVITY));
    let unlockCSS;
    const held = new Promise(resolve => { unlockCSS=resolve; });
    const stylesheet = /\/style\.css(?:[?#]|$)/;
    const delaySheet = async route => { await held; await route.continue(); };
    await page.route(stylesheet,delaySheet,{ times:1 });
    try {
      const requested=page.waitForRequest(request=>stylesheet.test(request.url()));
      await Promise.all([
        page.waitForURL(url=>url.origin===target.origin&&url.pathname===target.pathname,{ waitUntil:'commit' }),
        page.locator('#b2-fires-open').click({ noWaitAfter:true })
      ]);
      await requested;
      // The first shared CSS request is still blocked. The destination's theme
      // must already be set without its own later inline script or lab.js.
      await page.waitForFunction(wanted=>document.documentElement.getAttribute('data-theme')===wanted,mode,{timeout:5000});
      ok(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === mode,
        mode+' applies in the incoming document before its first stylesheet ('+
        (cleanRoute?'clean URL redirect':'.html link')+')');
    } finally {
      unlockCSS();
    }
    await themeState(page,mode);
    ok(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme.includes('dark')) === (mode==='dark'),
      'the rendered OpenSciEd activity uses the chosen appearance on the first visit');

    // Simulate a restored/parked document that missed a newer preference.
    // An in-document storage write does not dispatch a storage event; use
    // pageshow.persisted to exercise that otherwise timing-dependent branch.
    await page.evaluate(({key,next})=>{
      localStorage.setItem(key,next);
      window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:false}));
    },{key:KEY,next:os});
    ok(await page.locator('html').getAttribute('data-theme')===mode,
      'an ordinary pageshow leaves the already mounted activity alone');
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await themeState(page,os);
    ok(await control(page,os).getAttribute('aria-pressed')==='true',
      'history restore reconciles the saved theme and control immediately');

    await control(page,'auto').click();
    await themeState(page,'auto');
    ok(await page.evaluate(key=>localStorage.getItem(key),KEY)===null &&
      await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme.includes('dark'))===(os==='dark'),
      'Auto removes the override and tracks the system appearance');

    await control(page,mode).click();
    await page.goto(base+'lab01.html');
    await themeState(page,mode);
    await control(page,'auto').click();
    await themeState(page,'auto');
    ok(await page.evaluate(key=>localStorage.getItem(key),KEY)===null,
      'the AP page still shares the same preference and retains its Light/Dark/Auto control');
  } finally {
    await context.close();
  }
}

async function unit2SectionThemes(browser,base) {
  const ctx=await browser.newContext({colorScheme:'dark',reducedMotion:'reduce'});
  const origin=new URL(base).origin;
  await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  try {
    const page=await ctx.newPage();
    const cases=[
      ['openscied-b2-burn-lab.html','ideas','fuels','burn'],
      ['openscied-b2-fires.html','plan','yeast','cards'],
      ['openscied-b2-peat-bog-lab.html','bog','graph','zombie']
    ];
    const appearance=()=>page.evaluate(key=>{
      const root=document.documentElement,css=getComputedStyle(root);
      return {
        stored:localStorage.getItem(key),
        attr:root.getAttribute('data-theme'),
        pressed:document.querySelector('.theme-switch [aria-pressed="true"]')?.dataset.mode,
        scheme:css.colorScheme,background:css.getPropertyValue('--bg').trim(),
        body:getComputedStyle(document.body).backgroundColor
      };
    },KEY);
    for(const [file,first,second,third] of cases) {
      await page.goto(base+file);
      for(const [mode,section,nextHash] of [
        ['light',first,second],['dark',second,third],['auto',third,first]
      ]) {
        await control(page,mode).click();
        await themeState(page,mode);
        const before=await appearance();
        await page.locator('.step-nav a[href="#'+section+'"]').click();
        await page.locator('#'+section).waitFor({state:'visible'});
        assert.equal(new URL(page.url()).hash,'#'+section);
        assert.deepEqual(await appearance(),before);
        await page.evaluate(target=>{location.hash=target;},nextHash);
        await page.locator('#'+nextHash).waitFor({state:'visible'});
        assert.equal(new URL(page.url()).hash,'#'+nextHash);
        assert.deepEqual(await appearance(),before);
        ok(true,file+' '+mode+' preserves the preference, control and actual page colors across section links and hashes');
      }
    }
  } finally {
    await ctx.close();
  }
}

(async()=>{
  const server=await serve();
  let browser;
  try {
    browser=await chromium.launch();
    await hop(browser,server.url,'light','dark',false);
    await hop(browser,server.url,'dark','light',true);
    await unit2SectionThemes(browser,server.url);
    console.log('openscied-theme-navigation-browser: '+checks+' checks passed');
  } finally {
    if(browser)await browser.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
