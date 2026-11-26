'use strict';
const assert=require('node:assert/strict');

async function ready(locator) {
  assert(await locator.isVisible(), 'save receipt is shown near the activity workspace');
  assert.equal(await locator.getAttribute('data-save-state'), 'ready');
  assert.match(await locator.innerText(), /No work saved yet/);
  assert(!(await locator.locator('time').isVisible()));
}
async function saved(locator) {
  assert.equal(await locator.getAttribute('data-save-state'), 'saved');
  assert.match(await locator.innerText(), /Saved to this browser.*Last saved:/s);
  const stamp=await locator.locator('time').getAttribute('datetime');
  assert.match(stamp,/^\d{4}-\d{2}-\d{2}T/);
  return stamp;
}
async function readableDisabled(locator) {
  const colors=await locator.evaluate(e=>{
    const style=getComputedStyle(e), ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
    function luminance(color) {
      ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);
      return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(x=>x/255)
        .map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4)
        .reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
    }
    const bg=luminance(style.backgroundColor), fg=luminance(style.color), border=luminance(style.borderColor);
    const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    return {opacity:style.opacity,label:ratio(bg,fg),border:ratio(bg,border)};
  });
  assert.equal(colors.opacity,'1','disabled label opacity must not be reduced');
  assert(colors.label>=4.5,'disabled label must meet contrast target, got '+colors.label);
  assert(colors.border>=2.2,'disabled control outline must remain visible, got '+colors.border);
}
module.exports={ready,saved,readableDisabled};
