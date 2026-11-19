/* Original procedural artwork for the independent B.3 companion. */
(function(){
  'use strict';
  const canvas=document.getElementById('cycle-scene');
  if(!canvas)return;
  const ctx=canvas.getContext('2d'),W=1160,H=760;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors=['#67e5bf','#ffd681','#83c7ff','#f3a2bc'];
  let game=null,track=[],visible=true,raf=0,lastTime=0,now=0,rollStart=0,rolling=false,selected=null;
  let lastTurn=0,particles=[],transitions={},hitRegions=[];
  const frame=document.getElementById('cell-board');
  const tip=document.getElementById('specimen-tip');
  function ellipse(x,y,rx,ry,fill,stroke,width){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width||1;ctx.stroke();}}
  function line(x,y,x2,y2,color,width){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width||1;ctx.stroke();}
  function text(s,x,y,size,color,align,font){ctx.fillStyle=color||'#d8e9e5';ctx.font=(font==='mono'?'500':(font||'500'))+' '+size+'px '+(font==='mono'?'monospace':'Arial, sans-serif');ctx.textAlign=align||'left';ctx.fillText(s,x,y);}
  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function gradient(x,y,r,stops){const g=ctx.createRadialGradient(x-r*.25,y-r*.3,1,x,y,r);stops.forEach(s=>g.addColorStop(s[0],s[1]));return g;}
  function position(index){const a=-Math.PI/2+index/31*Math.PI*2;return {x:568+Math.cos(a)*428,y:328+Math.sin(a)*228,a:a};}
  function phaseColor(i){const t=track[i];return !t?'#78cbb1':t.phase==='s'?'#8cc8ff':t.phase==='g2'?'#e8c786':t.phase==='m'?'#c3b3ef':'#72d4b3';}
  function background(){
    const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#1a2c30');g.addColorStop(.45,'#111e24');g.addColorStop(1,'#0b171c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(let i=0;i<1100;i++){const x=(i*197.31)%W,y=(i*83.91)%H;ellipse(x,y,.45+(i%3)*.18,.45,'rgba(178,208,196,.055)');}
    ctx.strokeStyle='#b6dace08';ctx.lineWidth=1;
    for(let x=20;x<W;x+=40)line(x,0,x,H,'#b6dace06');
    for(let y=20;y<H;y+=40)line(0,y,W,y,'#b6dace06');
    const vignette=ctx.createRadialGradient(570,330,80,570,330,650);vignette.addColorStop(0,'#72b7a908');vignette.addColorStop(1,'#00000065');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
    text('CELL CYCLE  /  LIVE MODEL',29,32,12,'#9ab9b3','left','mono');text('B.3 · LESSON 3',1128,32,12,'#789c95','right','mono');
    line(28,46,1132,46,'#9cd6c329');
    for(let i=0;i<16;i++){const y=100+i*29;line(25,y,i%5===0?39:32,y,'#a2c9bd44');if(i%5===0)text(String(i*10),43,y+3,8,'#75958e','left','mono');}
    text('SCHEMATIC · NOT TO SCALE',1126,578,9,'#71978f','right','mono');
  }
  function path(){
    ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=18;ctx.shadowOffsetY=8;
    ellipse(568,328,451,251,'#182b30','#789b9138',2);ellipse(568,328,403,203,'#0f2025','#789b9138',1);ctx.restore();
    for(let i=0;i<31;i++){
      const p=position(i),next=position((i+1)%31),col=phaseColor(i);
      line(p.x,p.y,next.x,next.y,col+'55',3);
      if(i%4===1){const q=position(i+.5);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a+Math.PI/2);ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(0,2);ctx.lineTo(4,-3);ctx.strokeStyle=col+'b0';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();}
    }
    const phases=[{i:3.4,label:'G1',sub:'GROW & GATHER'},{i:11.2,label:'S',sub:'COPY DNA'},{i:19.1,label:'G2',sub:'PREPARE & CHECK'},{i:26.3,label:'M',sub:'DIVIDE'}];
    phases.forEach(o=>{const p=position(o.i),x=568+Math.cos(p.a)*505,y=328+Math.sin(p.a)*286;text(o.label,x,y,22,phaseColor(Math.round(o.i)),'center','700');text(o.sub,x,y+16,9,'#98b4b0','center','mono');});
    hitRegions=[];
    for(let i=0;i<31;i++){
      const t=track[i],p=position(i),col=phaseColor(i),check=t&&t.type==='checkpoint';
      if(check){
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a+Math.PI/2);
        rounded(-18,-20,36,40,9,'#10201f',col+'cc');
        line(-19,-13,19,-13,col,3);line(-19,13,19,13,col,3);
        ctx.shadowColor=col;ctx.shadowBlur=10;ellipse(-17,-13,3,3,col);ellipse(17,-13,3,3,col);ctx.restore();
        text(t.phase.toUpperCase(),p.x,p.y+4,11,'#eafdf5','center','700');
        hitRegions.push({x:p.x,y:p.y,r:22,title:t.phase.toUpperCase()+' checkpoint',copy:'The model checks the cell’s scorecard here before it continues.'});
      }else{
        const start=i===0,finish=i===30,r=start||finish?13:7;
        ellipse(p.x,p.y+2,r+2,r+2,'#0006');
        ellipse(p.x,p.y,r,r,gradient(p.x,p.y,r,[[0,col+'dd'],[.7,col+'44'],[1,'#172c2b']]),col+'b0',1.4);
        if(start||finish)text(start?'▶':'✓',p.x,p.y+4,12,'#ecfff7','center','700');
        else if(t&&t.phase==='m'){text(String(t.need),p.x,p.y+4,11,'#e6dbff','center','700');}
        else text(String(i),p.x,p.y+3,7,'#c6e6dc','center','mono');
        if(game&&game.round===2&&t&&t.chance){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/4);ctx.strokeStyle='#8ad5f0';ctx.strokeRect(-11,-11,22,22);ctx.restore();}
      }
    }
    const players=(game&&game.playersState.length?game.playersState:[{id:1,pos:0}]);
    players.forEach((p,index)=>{
      const tween=transitions[p.id];let pos=p.pos;
      if(tween){const k=Math.max(0,Math.min(1,(now-tween.time)/750)),ease=k*k*(3-2*k);pos=tween.from+(tween.to-tween.from)*ease;}
      const q=position(pos),same=players.filter(o=>o.pos===p.pos),offset=same.findIndex(o=>o.id===p.id),shift=(offset-(same.length-1)/2)*17;
      let x=q.x+Math.cos(q.a)*shift,y=q.y+Math.sin(q.a)*shift;
      const active=game&&game.active===index&&!game.complete,col=p.unchecked?'#f2858d':colors[index];
      ctx.save();ctx.shadowColor=col;ctx.shadowBlur=active?17:5;
      ellipse(x,y,14,12,gradient(x,y,15,[[0,'#e8fff0'],[.26,col],[1,'#1a574c']]),'#e5fff0',1.6);ctx.restore();
      ellipse(x-2,y-1,5,5,'#174840','#8ee6c8',.8);text(String(p.id),x+1,y+4,10,'#fff','center','700');
      if(active){ellipse(x,y,20+Math.sin(now*.003)*2,18+Math.sin(now*.003)*2,null,col+'77',1);}
    });
  }
  function mitochondrion(x,y,scale,angle){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
    ctx.shadowColor='#0008';ctx.shadowBlur=4;ellipse(0,0,18,8,gradient(0,0,19,[[0,'#eac78f'],[.6,'#b68259'],[1,'#664d3a']]),'#d5ba8c',1);ctx.shadowBlur=0;
    ctx.beginPath();ctx.moveTo(-12,0);for(let i=0;i<7;i++)ctx.lineTo(-10+i*3.4,i%2?-4:4);ctx.strokeStyle='#765940';ctx.lineWidth=1.8;ctx.stroke();ctx.restore();
  }
  function chromosome(x,y,angle,scale,color){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);ctx.lineCap='round';
    for(const off of [-1,1]){ctx.beginPath();ctx.moveTo(-8,off*12);ctx.bezierCurveTo(-2,off*8,-2,-off*3,8,-off*12);ctx.strokeStyle='#11132555';ctx.lineWidth=8;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=5;ctx.stroke();}
    ellipse(0,0,2.2,2.2,'#efe2ff');ctx.restore();
  }
  function cell(x,y,r,phase,score,split){
    const membrane=ctx.createRadialGradient(x-r*.3,y-r*.4,r*.1,x,y,r);
    membrane.addColorStop(0,'#b1e2d52b');membrane.addColorStop(.65,'#5dacae29');membrane.addColorStop(.93,'#70c5bc33');membrane.addColorStop(1,'#b8e4d467');
    const breathe=reduced?0:Math.sin(now*.0011)*1.5;
    ctx.save();ctx.shadowColor='#8de6c233';ctx.shadowBlur=20;
    ellipse(x,y,r+breathe,r*.83,membrane,'#b2ead28a',2);ctx.restore();
    ellipse(x,y,r-4+breathe,r*.83-4,null,'#d3ffe42b',1);
    const localHits=[];
    for(let i=0;i<94;i++){
      const a=i*2.3999,rr=Math.sqrt((i+.5)/95)*r*.89,px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr*.81;
      const drift=reduced?0:Math.sin(now*.0005+i)*1.5;
      if(Math.hypot(px-x,(py-y)/.8)>r*.45)ellipse(px+drift,py,1+(i%3)*.35,1+(i%3)*.35,i%4?'#c2e5c43e':'#d4c4ef62');
    }
    // Endoplasmic reticulum: folded ribbons around the nucleus.
    for(let i=0;i<5;i++){
      ctx.beginPath();const rad=r*.36+i*5;
      ctx.ellipse(x+6,y+3,rad,rad*.69,-.3,.15,Math.PI*1.49);ctx.strokeStyle=i%2?'#78b9a964':'#a1d3b57a';ctx.lineWidth=3;ctx.stroke();
    }
    // Golgi: layered curved sacs.
    for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(x+r*.45,y+r*.22,13+i*2,5+i*3,.7,-1.6,1.6);ctx.strokeStyle='#d4b8839c';ctx.lineWidth=2.4;ctx.stroke();}
    const n=score?Math.min(9,3+score.g1.organelles+Math.floor(score.g2.organelles/2)):5;
    for(let i=0;i<n;i++){const a=i*2.4+.7,rr=r*(.61+(i%3)*.07),px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr*.7;mitochondrion(px,py,.7+(i%3)*.12,a);localHits.push({x:px,y:py,r:17,title:'Mitochondrion',copy:'Organelles help the cell carry out its functions. Organelle dice add to the phase scorecard.'});}
    const nucleusR=r*.38;
    if(phase!=='m'){
      ctx.save();ctx.shadowColor='#0007';ctx.shadowBlur=9;ellipse(x-4,y-8,nucleusR,nucleusR*.88,gradient(x-4,y-8,nucleusR,[[0,'#8e80b37a'],[.7,'#60557d9a'],[1,'#c1b4d464']]),'#cebfdf99',1.4);ctx.restore();
      for(let i=0;i<10;i++){const a=i*1.6;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*nucleusR*.6,y-8+Math.sin(a)*nucleusR*.5);ctx.bezierCurveTo(x-nucleusR*.6+i*4,y-nucleusR*.4,x+nucleusR*.6,y+nucleusR*.5,x+Math.cos(a+2)*nucleusR*.7,y-8+Math.sin(a+2)*nucleusR*.7);ctx.strokeStyle=phase==='s'?'#e0c1f8b0':'#baabd77a';ctx.lineWidth=phase==='s'?1.7:1;ctx.stroke();}
      ellipse(x-16,y-17,9,8,'#a28da29c','#bca7c077');
      if(phase==='s'){
        for(let i=0;i<4;i++)chromosome(x-26+i*16,y+8+Math.sin(i)*12,.4,Math.min(.65,.4+(score?score.s.chromosomes:0)*.03),'#d2b4ee');
      }
      localHits.push({x:x-4,y:y-8,r:nucleusR,title:phase==='s'?'S phase · DNA copying':'Nucleus',copy:phase==='s'?'The S-phase scorecard counts chromosome copies. The glowing strands represent DNA copying.':'The nucleus contains the cell’s DNA. Its appearance changes as the model cell enters division.'});
    }else{
      const separating=split||0;
      for(const side of [-1,1]){
        const pole=x+side*r*.77;ellipse(pole,y,5,5,'#dbe9ba');
        for(let k=0;k<7;k++){ctx.beginPath();ctx.moveTo(pole,y);ctx.quadraticCurveTo(x,y-r*.5+k*17,x+side*separating*r*.3,y-43+k*14);ctx.strokeStyle='#b3d9ad4b';ctx.lineWidth=1.2;ctx.stroke();}
        for(let k=0;k<4;k++)chromosome(x+side*separating*r*.4,y-32+k*21,side*.12,.72,side===1?'#e1bddf':'#c2b7f0');
      }
    }
    // Small membrane phospholipid hints along the edge.
    for(let i=0;i<70;i++){const a=i/70*Math.PI*2;const px=x+Math.cos(a)*(r-1),py=y+Math.sin(a)*(r*.83-1);ellipse(px,py,1.4,1.1,'#c6f2d264');line(px,py,px-Math.cos(a)*4,py-Math.sin(a)*4,'#a8debb40',.6);}
    localHits.push({x:x+r*.8,y:y-r*.43,r:20,title:'Cell membrane',copy:'The membrane surrounds the model cell. The growing cell gathers materials before it can divide.'});
    return localHits;
  }
  function specimen(){
    const player=game&&game.playersState[game.active],p=player||{pos:3,score:{g1:{nutrients:2,proteins:2,organelles:2},s:{chromosomes:0},g2:{nutrients:0,proteins:0,organelles:0}}};
    const phase=track[p.pos]?.phase||'g1',grow=Math.min(1,(p.score.g1.nutrients+p.score.g1.proteins)/16),radius=132+grow*13;
    ellipse(568,328,226,169,'#09191c7a','#9ec3b01c',1);
    ellipse(568,328,221,164,null,'#94c6b516',1);
    const actualPhase=phase==='finish'?'m':phase;
    if(phase==='finish'){
      hitRegions.push(...cell(510,325,93,'g1',p.score,0),...cell(630,325,93,'g1',p.score,0));
      text('DAUGHTER CELLS',568,455,12,'#b3e6d1','center','mono');
    }else{
      hitRegions.push(...cell(568,328,radius,actualPhase,p.score,p.pos>=26?.8:.1));
      const phaseText=phase==='s'?'DNA IS COPYING':phase==='g2'?'PREPARING TO DIVIDE':phase==='m'?'CHROMOSOMES SEPARATE':'GROWING & GATHERING';
      text(phaseText,568,455,11,'#a2c8bb','center','mono');
    }
    text('YOUR CELL, MAGNIFIED',568,150,10,'#86aaa1','center','mono');
    // Leaders connect structure labels to the model.
    line(615,294,703,243,'#adc8bd70');line(703,243,741,243,'#adc8bd70');text(phase==='m'?'Spindle fibres':'Nucleus / DNA',747,247,10,'#bdcfc6');
    line(478,368,408,410,'#adc8bd70');line(408,410,370,410,'#adc8bd70');text('Mitochondria',366,414,10,'#bdcfc6','right');
    line(648,377,708,403,'#adc8bd70');text('Cell membrane',713,407,10,'#bdcfc6');
    if(game&&game.event&&/checkpoint/i.test(game.event.kicker)){
      const c=/passed/i.test(game.event.title)?'#86e1b8':'#efcd91';
      text(/passed/i.test(game.event.title)?'CHECKPOINT PASSED':'CHECKPOINT RESPONSE',568,180,10,c,'center','mono');
    }
  }
  const pipPositions={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  function dice(){
    line(28,606,1132,606,'#9cd6c329');
    text('FOUR-DICE TRAY',44,632,10,'#9eb7af','left','mono');
    rounded(31,643,336,90,17,'#233e36','#8ba89750');rounded(38,650,322,76,12,'#19352d','#86ad9040');
    const vals=game?.lastDice||[];
    for(let i=0;i<4;i++){
      const spin=rolling&&!reduced,tt=(now-rollStart)*.018,x=78+i*78,y=688+(spin?Math.sin(tt+i)*6:0),angle=spin?Math.sin(tt+i)*.18:((i%2?-1:1)*.075);
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.shadowColor='#0009';ctx.shadowBlur=9;ctx.shadowOffsetY=6;
      rounded(-26,-26,53,57,11,'#a6b3a6');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      const g=ctx.createLinearGradient(-24,-24,24,24);g.addColorStop(0,'#ffffed');g.addColorStop(.6,'#e9e7d3');g.addColorStop(1,'#cbcebb');rounded(-26,-28,53,52,10,g,'#faffeb');
      const val=spin?1+(Math.floor(now*.02+i*3)%6):(vals[i]||0);
      if(val)for(const p of pipPositions[val]){const px=(p%3-1)*13,py=(Math.floor(p/3)-1)*13-2;ellipse(px,py,3.5,3.5,'#223b32');ellipse(px+.3,py+.5,2.7,2.7,'#314c40');}
      else text('?',0,5,23,'#6b7e6f','center','700');
      ctx.restore();
    }
    const phase=track[game?.playersState?.[game.active]?.pos||0]?.phase;
    text('1–3  Materials in G1 / G2',392,662,12,'#b1c5bc');text('4     DNA copies in S',392,684,12,'#b1c5bc');text('M     Match the next space',392,706,12,'#b1c5bc');
    text(rolling?'ROLLING…':(game&&game.playersState[game.active]?'PLAYER '+game.playersState[game.active].id+' · ROLL FOUR DICE':'MOVE ONE SPACE · ROLL FOUR DICE'),1122,631,10,'#98b7ad','right','mono');
  }
  function drawParticles(){particles=particles.filter(p=>now-p.time<850);for(const p of particles){const k=Math.max(0,Math.min(1,(now-p.time)/850)),x=p.x+(p.tx-p.x)*k,y=p.y+(p.ty-p.y)*k-Math.sin(k*Math.PI)*100;ctx.save();ctx.globalAlpha=1-k*.7;ctx.shadowColor=p.color;ctx.shadowBlur=8;ellipse(x,y,3.4,3.4,p.color);ctx.restore();}}
  function paint(){ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);background();path();specimen();dice();drawParticles();}
  function animate(time){raf=0;now=time;if(!visible||document.hidden)return;if(time-lastTime>1000/28){lastTime=time;paint();}if(!reduced||rolling||particles.length)raf=requestAnimationFrame(animate);}
  function request(){if(!raf)raf=requestAnimationFrame(animate);}
  function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.width*H/W*dpr);paint();request();}
  function update(g,t){
    const prev=game;track=t;game=g;
    if(prev){for(const p of g.playersState){const before=prev.playersState.find(o=>o.id===p.id);if(before&&before.pos!==p.pos)transitions[p.id]={from:before.pos,to:p.pos,time:performance.now()};}}
    if(g.turns>lastTurn){lastTurn=g.turns;for(let i=0;i<12;i++)particles.push({x:65+(i%4)*78,y:680,tx:520+(i*19)%100,ty:285+(i*31)%80,color:i%3?'#9ee9bf':'#d1b3ee',time:performance.now()+i*13});}
    game=JSON.parse(JSON.stringify(g));paint();request();
  }
  function setRolling(value){rolling=value;if(value)rollStart=performance.now();request();}
  function showAt(event){
    const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*W/r.width,y=(event.clientY-r.top)*H/r.height;
    const hit=hitRegions.slice().reverse().find(h=>Math.hypot(x-h.x,y-h.y)<h.r);
    canvas.style.cursor=hit?'help':'default';
    if(!hit){tip.hidden=true;selected=null;return;}
    if(selected!==hit.title){tip.textContent=hit.title+' — '+hit.copy;selected=hit.title;}
    tip.hidden=false;tip.style.left=Math.min(r.width-240,Math.max(10,x*r.width/W+14))+'px';tip.style.top=Math.max(30,y*r.width/W-70)+'px';
  }
  canvas.addEventListener('pointermove',showAt);canvas.addEventListener('pointerdown',showAt);canvas.addEventListener('pointerleave',()=>{tip.hidden=true;selected=null;});
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)request();else if(raf){cancelAnimationFrame(raf);raf=0;}},{rootMargin:'150px'}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)request();else if(raf){cancelAnimationFrame(raf);raf=0;}});
  window.CellCycleScene={update:update,rolling:setRolling};
})();
