const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('canvas numbering includes START and diamonds use the supplied chance-space flags', () => {
  const labels=[],diamonds=[];
  const ctx=new Proxy({fillText(value,x,y){labels.push({value:String(value),x,y});},
    strokeRect(...args){diamonds.push(args);},
    createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};}},
    {get(target,key){return key in target?target[key]:()=>{};}});
  const canvas={width:1160,height:760,style:{},getContext:()=>ctx,addEventListener(){},getBoundingClientRect:()=>({width:1160,height:760,left:0,top:0})};
  const observer=class{observe(){}};
  const environment={window:{matchMedia:()=>({matches:true})},document:{getElementById:id=>id==='cycle-scene'?canvas:{},addEventListener(){}},
    ResizeObserver:observer,IntersectionObserver:observer,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../cell-cycle-scene.js'),'utf8'),environment);
  const track=Array.from({length:31},(_,i)=>({phase:'g1',type:'space',label:'G1',chance:i===1}));
  track[0]={phase:'start',type:'start',label:'START'};
  const game={round:2,active:0,turns:0,playersState:[],lastDice:[],event:{}};
  environment.window.CellCycleScene.update(game,track);
  assert.equal(diamonds.length,1,'one diamond for the single flagged chance space');
  const angle=-Math.PI/2+1/31*Math.PI*2;
  assert.ok(labels.some(label=>label.value==='2'&&Math.abs(label.x-(568+Math.cos(angle)*428))<.01),
    'the first space after START is labeled Space 2, matching game status');
  assert.ok(labels.some(label=>/5–6.*No materials/.test(label.value)));
  diamonds.length=0;game.round=1;
  environment.window.CellCycleScene.update(game,track);
  assert.equal(diamonds.length,0,'Round 1 does not show chance diamonds');
});
