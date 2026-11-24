const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const M=require('../openscied-b4-wildlife-corridor-logic.js');
const guard=require('../openscied-save-session.js');
const code=readFileSync(join(__dirname,'../openscied-b4-wildlife-corridor.js'),'utf8');
const key='aplab:openscied:b4-wildlife-corridor:v1';
function browser(backing=new Map(),hash='',name='QA Student'){
  class Node{
    constructor(){this.handlers={};this.nodes=[];this.dataset={};this.style={setProperty(){}};this.classList={toggle(){}};this.hidden=false;}
    set textContent(value){this.text=value;}
    get textContent(){return [this.text||'',...this.nodes.map(n=>n.textContent)].join(' ');}
    setAttribute(n,v){this[n]=String(v);}
    removeAttribute(n){delete this[n];}
    replaceChildren(...nodes){this.nodes=nodes;}
    append(...nodes){this.nodes.push(...nodes);}
    checkValidity(){return true;}
    matches(){return false;}
    addEventListener(name,callback){this.handlers[name]=callback;}
    focus(){}
    scrollIntoView(){}
    fire(name,e={}){if(this.disabled&&(name==='click'||name==='submit'))return;this.handlers[name]?.({target:this,currentTarget:this,preventDefault(){},...e});}
    click(){this.fire('click');}
  }
  const ids=new Map(), lists={}, node=id=>ids.has(id)?ids.get(id):ids.set(id,new Node()).get(id);
  lists['[data-wc-go]']=['predict','model','explain'].map(step=>Object.assign(new Node(),{dataset:{wcGo:step}}));
  lists['[data-wc-step]']=['predict','model','explain'].map(step=>Object.assign(new Node(),{dataset:{wcStep:step}}));
  lists['[name="wc-prediction"]']=['connected','same','divided'].map(value=>Object.assign(new Node(),{value}));
  lists['[data-wc-crossing-slot]']=[0,1,2].map(i=>Object.assign(new Node(),{dataset:{wcCrossingSlot:String(i)}}));
  node('prediction-form').querySelector=()=>node('save-prediction');
  const localStorage={length:0,key(){},getItem:k=>backing.get(k)??null,setItem(k,v){backing.set(k,String(v));},removeItem(k){backing.delete(k);}};
  const callbacks=[],winEvents={}, location={hash};
  let report,openCount=0;
  const window={WildlifeCorridorLogic:M,OpenSciEdSaveSession:guard,localStorage,OpenSciEdSubmission:{mount(x){report=x.collect;return {open(){openCount++;}};}},
    Lab:{identity:{get:()=>({name,period:'QA'})}},crypto:{getRandomValues(s){s[0]=42;return s;}},matchMedia:()=>({matches:false}),
    setTimeout(f){callbacks.push(f);return callbacks.length;},clearTimeout(id){callbacks[id-1]=null;},addEventListener(k,v){winEvents[k]=v;}};
  const document={createElement:()=>new Node(),querySelectorAll:s=>lists[s]||[],querySelector:s=>s.startsWith('#wc-')?node(s.slice(4)):
    s==='[name="wc-prediction"]:checked'?lists['[name="wc-prediction"]'].find(x=>x.checked):null};
  vm.runInNewContext(code,{window,location,document,Date,history:{replaceState(a,b,h){location.hash=h;}}});
  return {node,lists,location,window,report:()=>report(),status:()=>node('status').textContent,openCount:()=>openCount,
    step:()=>{while(callbacks.length){const f=callbacks.shift();if(f){f();break;}}},
    record:()=>JSON.parse(backing.get(key)||'null'),storage:e=>winEvents.storage(e),
    predict(){lists['[name="wc-prediction"]'][0].checked=true;node('reason').value='Both patches are connected.';node('prediction-form').fire('submit');},
    matched(){node('run-baseline').click();for(let i=0;i<8;i++)this.step();},
    cross(){node('crossing-tile').click();lists['[data-wc-crossing-slot]'][1].click();node('run-crossing').click();for(let i=0;i<8;i++)this.step();}};
}
test('prediction gates direct links, and an interrupted paired run reloads from precisely the same generation',()=>{
  const shared=new Map(), first=browser(shared,'#explain');
  assert.equal(first.location.hash,'#predict');
  assert.match(first.node('model-hint').textContent,/save a prediction/i);
  assert.equal(first.record(),null);
  first.predict();assert.equal(first.location.hash,'#model');
  first.node('run-baseline').click();first.step();first.step();
  assert.deepEqual(first.record().generations,{baseline:2,corridor:0});
  assert.equal(first.node('crossing-tile').disabled,true);
  assert.match(first.node('mix').textContent,/Generation 2/);
  assert.match(first.node('mix').textContent,/Parent 1.*Genotype.*Parent 2.*Genotype.*Offspring/);
  assert.equal(first.node('pair-connected').nodes.length,5);
  assert.ok(first.node('pair-connected').nodes.filter(node=>node.className==='wc-map-copy').every(node=>/[Aa]/.test(node.textContent)));
  assert.equal(first.node('mix-offspring').nodes.length,24);
  first.node('mix-habitat').value='road';
  first.node('mix-habitat').fire('change');
  first.node('mix-offspring').value='23';
  first.node('mix-offspring').fire('change');
  assert.match(first.node('mix').textContent,/Offspring East 12/);
  assert.ok(first.node('pair-road').nodes.filter(n=>n.className?.includes('wc-mate-parent')).every(parent=>parent.dataset.crossing==='false'));
  assert.ok(first.node('tokens-connected').nodes.every(token=>/^[Aa]\/[Aa]$/.test(token.text.trim())));

  const resumed=browser(shared);
  assert.equal(resumed.location.hash,'#model');
  assert.match(resumed.node('map-connected-readout').textContent,/Generation 2/);
  resumed.matched();
  assert.deepEqual(resumed.record().generations,{baseline:8,corridor:0});
  assert.match(resumed.node('results').textContent,/Road, no crossing/);
});
test('crossing needs a valid trail connection; cannot be moved during run; only exact results flow into Explain and report',()=>{
  const b=browser();b.predict();b.matched();
  const [north,mid]=b.lists['[data-wc-crossing-slot]'];
  north.click();assert.match(b.status(),/select.*tile first/i);
  b.node('crossing-tile').click();north.click();
  assert.match(b.status(),/rocky north bank/i);assert.equal(b.record().crossing,-1);
  mid.click();assert.equal(b.record().crossing,1);
  b.node('run-crossing').click();
  assert.equal(b.node('crossing-tile').disabled,true);
  assert.equal(mid.disabled,true);
  for(let i=0;i<8;i++)b.step();
  assert.deepEqual(b.record().generations,{baseline:8,corridor:8});
  b.lists['[data-wc-go]'][2].click();
  assert.match(b.node('explain-evidence').textContent,/East: allele copies/);
  assert.equal(b.report().status,'draft');
  for(const [k,value] of [['claim','The comparison provides evidence.'],['limits','Real populations might shrink.']]){
    b.node(k).value=value;b.node(k).fire('input');
  }
  assert.equal(b.report().status,'draft');
  b.node('finish').click();
  const report=b.report();
  assert.equal(report.status,'final');assert.equal(report.datasetId,'WC-AA-0000002A');
  assert.equal(report.sections[1].items.length,4);
  for(const [i,id] of ['connected','road','corridor'].entries()){
    const end=M.run(42,id).history.at(-1), p=end.patches;
    assert.deepEqual(Array.from(report.sections[1].items[i+1].rows[8]),[8,...p.map(({variantCounts:c})=>c.A+' A, '+c.a+' a'),Math.abs(p[0].variantCounts.A-p[1].variantCounts.A),end.crossPatchContributions]);
  }
});
test('stale tab cannot overwrite progress and retains original identity for recovery',()=>{
  const shared=new Map(), original=browser(shared,'','Original QA');
  original.predict();
  const newer=browser(shared,'','New QA');newer.matched();
  original.storage({key});
  assert.match(original.node('save-warning-text').textContent,/newer copy/i);
  original.node('run-baseline').click();original.step();
  assert.equal(original.record().generations.baseline,8);
  assert.equal(original.report().status,'recovery');
  assert.equal(original.report().student.name,'Original QA');
  original.node('recovery').click();
  assert.equal(original.openCount(),1);
});

test('older preview data cannot be presented as observations from the two-allele model',()=>{
  const old={v:1,seed:42,step:'explain',prediction:{choice:'connected',reason:'Old question'},generations:{baseline:8,corridor:8},crossing:1,claim:'Old observations',limits:'Old limits',finished:true};
  const b=browser(new Map([[key,JSON.stringify(old)]]),'#explain');
  assert.equal(b.location.hash,'#predict');
  assert.match(b.status(),/older preview/i);
  assert.equal(b.report().status,'draft');
  assert.equal(b.record().claim,'Old observations','do not overwrite older work on page load');
  b.predict();
  assert.equal(b.record().model,'Aa');
  assert.deepEqual(b.record().generations,{baseline:0,corridor:0});
});
