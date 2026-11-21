/* Original procedural artwork for the independent B.3 companion. */
(function(){
  'use strict';
  const canvas=document.getElementById('cycle-scene');
  if(!canvas)return;
  const ctx=canvas.getContext('2d'),WIDE_W=1160,WIDE_H=760;
  // Two compositions share one canvas: the wide board (oval track, dice tray below) and, on phones and small tablets, a
  // tall portrait board (rounded track, big cell, dice in the middle) drawn at about CSS pixel size so its text stays readable.
  let W=WIDE_W,H=WIDE_H,portrait=false,minFont=99;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors=['#67e5bf','#ffd681','#83c7ff','#f3a2bc'];
  const PORTRAIT_W=360,PORTRAIT_H=612,PORTRAIT_MIN_FONT=13;
  let game=null,track=[],visible=true,raf=0,lastTime=0,now=0,rollStart=0,rolling=false,selected=null;
  let lastTurn=0,particles=[],transitions={},hitRegions=[];
  const frame=document.getElementById('cell-board');
  const tip=document.getElementById('specimen-tip');
  function ellipse(x,y,rx,ry,fill,stroke,width){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width||1;ctx.stroke();}}
  function line(x,y,x2,y2,color,width){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width||1;ctx.stroke();}
  function text(s,x,y,size,color,align,font){if(portrait)size=Math.max(size,PORTRAIT_MIN_FONT);if(size<minFont)minFont=size;ctx.fillStyle=color||'#d8e9e5';ctx.font=(font==='mono'?'500':(font||'500'))+' '+size+'px '+(font==='mono'?'monospace':'Arial, sans-serif');ctx.textAlign=align||'left';ctx.fillText(s,x,y);}
  function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function gradient(x,y,r,stops){const g=ctx.createRadialGradient(x-r*.25,y-r*.3,1,x,y,r);stops.forEach(s=>g.addColorStop(s[0],s[1]));return g;}
  // The track has one position per board space (32 on the OpenSciEd board), START at the top.
  function spaces(){return track.length||32;}
  function position(index){const a=-Math.PI/2+index/spaces()*Math.PI*2;return {x:568+Math.cos(a)*428,y:328+Math.sin(a)*228,a:a};}
  const CHANCE_FILL='#bfe7f7',CHANCE_RING='#7fd0ee';
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
    const N=spaces();
    for(let i=0;i<N;i++){
      const p=position(i),next=position((i+1)%N),col=phaseColor(i);
      line(p.x,p.y,next.x,next.y,col+'55',3);
      if(i%4===1){const q=position(i+.5);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a+Math.PI/2);ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(0,2);ctx.lineTo(4,-3);ctx.strokeStyle=col+'b0';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();}
    }
    const phases=[{i:3.5,label:'G1',sub:'GROW & GATHER'},{i:11.5,label:'S',sub:'CHROMOSOMES'},{i:19.5,label:'G2',sub:'GROW & GATHER'},{i:27,label:'M',sub:'MUST ROLL 1–5'}];
    phases.forEach(o=>{const p=position(o.i),x=568+Math.cos(p.a)*505,y=328+Math.sin(p.a)*286;text(o.label,x,y,22,phaseColor(Math.round(o.i)),'center','700');text(o.sub,x,y+16,9,'#98b4b0','center','mono');});
    hitRegions=[];
    for(let i=0;i<N;i++){
      const t=track[i],p=position(i),col=phaseColor(i),check=t&&t.type==='checkpoint';
      if(check){
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a+Math.PI/2);
        rounded(-18,-20,36,40,9,'#10201f',col+'cc');
        line(-19,-13,19,-13,col,3);line(-19,13,19,13,col,3);
        ctx.shadowColor=col;ctx.shadowBlur=10;ellipse(-17,-13,3,3,col);ellipse(17,-13,3,3,col);ctx.restore();
        text(t.phase.toUpperCase(),p.x,p.y+4,11,'#eafdf5','center','700');
        hitRegions.push({x:p.x,y:p.y,r:22,title:t.label,copy:'Turn over the checkpoint card: p53 checks the cell’s scorecard here before it continues.'});
      }else{
        const start=t&&t.type==='start',finish=t&&t.type==='finish',chance=!!(t&&t.chance),r=start||finish?13:chance?9:7;
        ellipse(p.x,p.y+2,r+2,r+2,'#0006');
        // Light-blue squares, as on the paper board: Cellular Chance spaces in Round 2.
        if(chance){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a+Math.PI/2);rounded(-r,-r,2*r,2*r,3,CHANCE_FILL,game&&game.round===2?'#ffffff':CHANCE_RING);if(game&&game.round===2){ctx.strokeStyle=CHANCE_RING;ctx.lineWidth=2;ctx.strokeRect(-r-3,-r-3,2*r+6,2*r+6);}ctx.restore();}
        else ellipse(p.x,p.y,r,r,gradient(p.x,p.y,r,[[0,col+'dd'],[.7,col+'44'],[1,'#172c2b']]),col+'b0',1.4);
        const ink=chance?'#0f3a4a':'#c6e6dc';
        if(start||finish){text(start?'▶':'✓',p.x,p.y+4,12,'#ecfff7','center','700');const o=position(i+(start?.55:-.55));text(start?'START':'FINISH',o.x,o.y-20,10,start?'#ffb36b':'#a9e27a','center','700');}
        else if(t&&t.phase==='m')text(String(t.roll),p.x,p.y+4,10,chance?ink:'#efe6ff','center','700');
        else if(t)text(String(t.n),p.x,p.y+3,8,ink,'center','mono');
        hitRegions.push({x:p.x,y:p.y,r:18,title:t?(t.type==='space'?t.label:t.label):'START',copy:t&&t.phase==='m'&&t.type==='space'?'Must roll '+t.roll+': you need a '+t.roll+' on a die to move onto this space.'+(chance?' It is also a light-blue square: in Round 2, landing here draws a Cellular Chance card.':''):chance?'Light-blue square: in Round 2, landing here draws a Cellular Chance card.':'Move one space each turn.'});
      }
    }
    const players=(game&&game.playersState.length?game.playersState:[{id:1,pos:0}]);
    players.forEach((p,index)=>{
      const tween=transitions[p.id];let pos=p.pos;
      if(tween){const k=Math.max(0,Math.min(1,(now-tween.time)/750)),ease=k*k*(3-2*k);pos=tween.from+(tween.to-tween.from)*ease;}
      const q=position(pos),same=players.filter(o=>o.pos===p.pos),offset=same.findIndex(o=>o.id===p.id),shift=(offset-(same.length-1)/2)*17;
      let x=q.x+Math.cos(q.a)*shift,y=q.y+Math.sin(q.a)*shift;
      const active=game&&game.active===index&&!game.complete,col=colors[index];
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
  // armColor (optional) paints the second arm differently: the changed section of a chromosome.
  function chromosome(x,y,angle,scale,color,armColor){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);ctx.lineCap='round';
    for(const off of [-1,1]){ctx.beginPath();ctx.moveTo(-8,off*12);ctx.bezierCurveTo(-2,off*8,-2,-off*3,8,-off*12);ctx.strokeStyle='#11132555';ctx.lineWidth=8;ctx.stroke();ctx.strokeStyle=off===1&&armColor||color;ctx.lineWidth=5;ctx.stroke();}
    ellipse(0,0,2.2,2.2,'#efe2ff');ctx.restore();
  }
  // Daughter cells after a division (OpenSciEd B.3 Lesson 3 Multiple Models): each gets the same chromosome set, two
  // purple and two orange. After a red-chip division one daughter carries a changed (red) section on one chromosome,
  // also marked with a dashed outline and a CHANGED label so the difference never depends on colour alone.
  const DAUGHTER_SET=[[-13,-13,'#a99af2'],[13,-13,'#f5b04a'],[-13,11,'#f5b04a'],[13,11,'#a99af2']],CHANGED_RED='#ff3b3b';
  let sceneState={view:'cell',caption:'',daughters:[]};
  const DL=472,DR=664;
  function chromosomeSet(x,y,changed){
    const cx=x-4,cy=y-8,set=DAUGHTER_SET.map(function(c,i){return {color:c[2],changed:!!(changed&&i===2),x:cx+c[0],y:cy+c[1]};});
    ellipse(cx,cy,30,27,'#1d173acc');
    set.forEach(function(c){chromosome(c.x,c.y,.25,.62,c.color,c.changed?CHANGED_RED:null);});
    const hit=set.find(function(c){return c.changed;});
    if(hit){
      // A point on the changed (red) arm, 1/5 of the way along it: local (-5, 8.8), then scaled and rotated as drawn.
      const lx=-5*.62,ly=8.8*.62,ax=hit.x+lx*Math.cos(.25)-ly*Math.sin(.25),ay=hit.y+lx*Math.sin(.25)+ly*Math.cos(.25);
      ctx.save();ctx.setLineDash([4,3]);ctx.lineDashOffset=reduced?0:-now*.02;ellipse(hit.x,hit.y,13,13,null,'#ffffff',2);ctx.restore();
      hit.markX=ax;hit.markY=ay;
    }
    return set;
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
      const red=p.lastChip==='red';
      // Two separate daughter cells, side by side inside the magnified frame.
      hitRegions.push(...cell(DL,325,93,'g1',p.score,0),...cell(DR,325,93,'g1',p.score,0));
      const left=chromosomeSet(DL,325,red),right=chromosomeSet(DR,325,false);
      const caption=red?'Daughter cells · one carries changed DNA (game model)':'Daughter cells · identical DNA';
      text(caption,568,447,15,red?'#ffc2c2':'#c4f0dc','center','700');
      text(red?'RED CHIP · CANCER CELL IN THIS GAME MODEL':'SAME CHROMOSOMES IN BOTH · NEW BLUE CHIP',568,466,10,'#9fc2b6','center','mono');
      const changed=left.find(function(c){return c.changed;});
      if(changed){
        line(changed.x-12,changed.y+4,440,228,'#ffd0d0',1.4);ellipse(changed.x-12,changed.y+4,2.6,2.6,'#ffd0d0');
        rounded(368,212,76,20,5,'#3a1418e6','#ff8a8a');text('CHANGED',406,226,11,'#ffe1e1','center','700');
        hitRegions.push({x:changed.x,y:changed.y,r:16,title:'Changed chromosome (game model)',copy:'This daughter cell carries a changed section of DNA (red, dashed outline). The cell divided without p53 stopping it, so it is a red chip: a cancer cell in this game model.'});
      }
      hitRegions.push({x:DL-4,y:317,r:30,title:'Daughter cell DNA',copy:red?'One daughter has a changed chromosome; the other has the original set.':'Both daughter cells have the same chromosome set: identical DNA.'});
      sceneState={view:'daughters',caption:caption,daughters:[left,right].map(function(set){return {changed:set.some(function(c){return c.changed;}),chromosomes:set.map(function(c){return c.changed?'changed':c.color;})};}),
        changedAt:changed?{x:changed.markX,y:changed.markY}:null};
    }else{
      sceneState={view:'cell',caption:'',daughters:[]};
      const mt=track[p.pos],split=mt&&mt.phase==='m'?(mt.type==='checkpoint'?.9:.15+(mt.roll||0)*.13):.1;
      hitRegions.push(...cell(568,328,radius,actualPhase,p.score,split));
      const phaseText=phase==='s'?'COLLECTING CHROMOSOMES':phase==='g2'?'GROWING & GATHERING':phase==='m'?'DIVIDING · ROLL 1–5 IN ORDER':'GROWING & GATHERING';
      text(phaseText,568,455,11,'#a2c8bb','center','mono');
    }
    text('YOUR CELL, MAGNIFIED',568,150,10,'#86aaa1','center','mono');
    // Leaders connect structure labels to the model. The cell grows and its organelles move with the score, so each
    // leader is anchored to where the structure is actually drawn this frame (a dot marks the exact spot).
    const lc='#adc8bd70',body=phase==='finish'?{x:DR,y:325,r:93}:{x:568,y:328,r:radius};
    const leader=function(ax,ay,ex,ey,tx,ty,label,align){line(ax,ay,ex,ey,lc);line(ex,ey,tx,ty,lc);ellipse(ax,ay,2.6,2.6,'#d9ece4');text(label,align==='right'?tx-4:tx+6,ty+4,10,'#bdcfc6',align);};
    const toward=function(cx,cy,rx,ry,tx,ty){const a=Math.atan2((ty-cy)/ry,(tx-cx)/rx);return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];};
    if(actualPhase==='m'&&phase!=='finish'){
      leader(body.x+body.r*.77,body.y,703,243,741,243,'Spindle fibres');
    }else{
      const nucs=hitRegions.filter(function(h){return h.title==='Nucleus'||/^S phase/.test(h.title);}),nuc=nucs[nucs.length-1];
      if(nuc){const pt=toward(nuc.x,nuc.y,nuc.r*.92,nuc.r*.88*.92,703,243);leader(pt[0],pt[1],703,243,741,243,'Nucleus / DNA');}
    }
    const mitos=hitRegions.filter(function(h){return h.title==='Mitochondrion';});
    if(mitos.length){const m=mitos.reduce(function(a,b){return Math.hypot(b.x-408,b.y-410)<Math.hypot(a.x-408,a.y-410)?b:a;});leader(m.x,m.y,408,410,370,410,'Mitochondria','right');}
    const mem=toward(body.x,body.y,body.r-1,body.r*.83-1,708,403);leader(mem[0],mem[1],708,403,713,403,'Cell membrane');
    if(game&&game.event&&/checkpoint/i.test(game.event.kicker)){
      const passed=/passed/i.test(game.event.kicker);
      text(passed?'p53 CHECK · PASSED':'p53 CHECK · '+(/DESTROYED|destroyed/.test(game.event.title)?'CELL DESTROYED':'SENT BACK'),568,180,10,passed?'#86e1b8':'#efcd91','center','mono');
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
    text('1 Nutrient · 2 Protein · 3 Organelle (G1, G2)',392,654,12,'#b1c5bc');text('4  Chromosome (S)',392,676,12,'#b1c5bc');text('5–6  Nothing to check off',392,698,11,'#b1c5bc');text('M: roll the number on the next space',392,720,11,'#b1c5bc');
    chipTray();
    text(rolling?'ROLLING…':(game&&game.playersState[game.active]?'PLAYER '+game.playersState[game.active].id+' · ROLL FOUR DICE':'MOVE ONE SPACE · ROLL FOUR DICE'),1122,631,10,'#98b7ad','right','mono');
  }
  // Each player's cell chips: blue = non-cancer cell, red = cancer cell (game model). Counts are written beside the colour.
  function chipTray(){
    const players=game&&game.playersState||[];if(!players.length)return;
    // Top-left corner, clear of the track, the phase labels and the Roll button that overlays the bottom right.
    text('CELL CHIPS',62,70,10,'#9eb7af','left','mono');
    players.forEach(function(p,i){
      const y=88+i*15;
      ellipse(70,y-4,6,6,colors[i]);text(String(p.id),70,y-1,8,'#10201c','center','700');
      const chip=function(x,fill,stroke,n,label){ellipse(x,y-4,6,6,fill,stroke,1.5);text(n+' '+label,x+10,y,11,'#d6e7e0');};
      chip(96,'#2f7fd8','#cfe3ff',p.blue||0,'blue');chip(170,'#d23b3b','#ffd0d0',p.red||0,'red');
    });
  }
  function drawParticles(){particles=particles.filter(p=>now-p.time<850);for(const p of particles){const k=Math.max(0,Math.min(1,(now-p.time)/850)),x=p.x+(p.tx-p.x)*k,y=p.y+(p.ty-p.y)*k-Math.sin(k*Math.PI)*100;ctx.save();ctx.globalAlpha=1-k*.7;ctx.shadowColor=p.color;ctx.shadowBlur=8;ellipse(x,y,3.4,3.4,p.color);ctx.restore();}}
    // ---- Portrait composition (phones and small tablets, canvas drawn 360 × 612 logical px) ----
  // The 32 spaces run round a rounded rectangle (START at the top centre, clockwise). Inside it: the magnified cell, its
  // labels, the four dice and the dice key. Plain-space numbers are left out (the hover/tap text and the scorecard have
  // them); the Must-roll numbers on the M spaces stay. Every text is drawn at 13 logical px or more, and the canvas is shown
  // at about 1 logical px = 1 CSS px, so nothing is smaller than about 12 CSS px.
  const PT={x1:26,x2:334,y1:108,y2:572,rc:70,cx:180,cy:282};
  let ring=null;
  function buildRing(){
    const pts=[],x1=PT.x1,x2=PT.x2,y1=PT.y1,y2=PT.y2,rc=PT.rc,mid=(x1+x2)/2;
    const add=function(x,y){pts.push({x:x,y:y,d:0});};
    const arc=function(ox,oy,a0,a1){for(let k=1;k<=16;k++){const a=a0+(a1-a0)*k/16;add(ox+Math.cos(a)*rc,oy+Math.sin(a)*rc);}};
    add(mid,y1);add(x2-rc,y1);arc(x2-rc,y1+rc,-Math.PI/2,0);add(x2,y2-rc);arc(x2-rc,y2-rc,0,Math.PI/2);add(x1+rc,y2);
    arc(x1+rc,y2-rc,Math.PI/2,Math.PI);add(x1,y1+rc);arc(x1+rc,y1+rc,Math.PI,Math.PI*1.5);add(mid,y1);
    let len=0;for(let i=1;i<pts.length;i++){len+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);pts[i].d=len;}
    ring={pts:pts,len:len};
  }
  // Same contract as position(): x, y and a = the direction pointing out of the track.
  function pPosition(index){
    const n=spaces(),t=(((index%n)+n)%n)/n*ring.len,pts=ring.pts;
    let i=1;while(i<pts.length-1&&pts[i].d<t)i++;
    const a=pts[i-1],b=pts[i],k=b.d>a.d?(t-a.d)/(b.d-a.d):0,tx=b.x-a.x,ty=b.y-a.y;
    return {x:a.x+tx*k,y:a.y+ty*k,a:Math.atan2(-tx,ty)};
  }
  function pStatus(){
    const p=game&&game.playersState[game.active];
    return rolling?'ROLLING…':(p?'PLAYER '+p.id+' · ROLL FOUR DICE':'MOVE ONE SPACE · ROLL FOUR DICE');
  }
  function pBackground(){
    const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#1a2c30');g.addColorStop(.45,'#111e24');g.addColorStop(1,'#0b171c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(let i=0;i<500;i++){const x=(i*197.31)%W,y=(i*83.91)%H;ellipse(x,y,.45+(i%3)*.18,.45,'rgba(178,208,196,.055)');}
    for(let x=20;x<W;x+=40)line(x,0,x,H,'#b6dace06');
    for(let y=20;y<H;y+=40)line(0,y,W,y,'#b6dace06');
    const vignette=ctx.createRadialGradient(180,300,60,180,300,470);vignette.addColorStop(0,'#72b7a908');vignette.addColorStop(1,'#00000065');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
    text(pStatus(),18,26,13,'#a9c6c0','left','mono');
    text('MAGNIFIED CELL · SCHEMATIC · NOT TO SCALE',180,604,13,'#80a39b','center','mono');
    // Each player's cell chips (blue = non-cancer cell, red = cancer cell in the game model), counts written beside the colour.
    (game&&game.playersState||[]).forEach(function(p,i){
      const x0=24+(i%2)*166,y=58+Math.floor(i/2)*19;
      ellipse(x0+9,y-4,9,9,colors[i]);text(String(p.id),x0+9,y,13,'#10201c','center','700');
      ellipse(x0+40,y-4,6,6,'#2f7fd8','#cfe3ff',1.5);text((p.blue||0)+' blue',x0+49,y,13,'#d6e7e0');
      ellipse(x0+106,y-4,6,6,'#d23b3b','#ffd0d0',1.5);text((p.red||0)+' red',x0+115,y,13,'#d6e7e0');
    });
  }
  function pPath(){
    const x1=PT.x1,x2=PT.x2,y1=PT.y1,y2=PT.y2,rc=PT.rc,N=spaces();
    ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=16;ctx.shadowOffsetY=6;
    rounded(x1-22,y1-22,x2-x1+44,y2-y1+44,rc+22,'#182b30','#789b9138');ctx.restore();
    rounded(x1+22,y1+22,x2-x1-44,y2-y1-44,rc-22,'#0f2025','#789b9138');
    for(let i=0;i<N;i++){
      const p=pPosition(i),next=pPosition((i+1)%N),col=phaseColor(i);
      line(p.x,p.y,next.x,next.y,col+'66',3);
      if(i%4===1){const q=pPosition(i+.5);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a+Math.PI/2);ctx.beginPath();ctx.moveTo(-4,-3);ctx.lineTo(0,2);ctx.lineTo(4,-3);ctx.strokeStyle=col+'c0';ctx.lineWidth=1.8;ctx.stroke();ctx.restore();}
    }
    // Phase letters sit just inside the track, away from the labels and the cell.
    [{i:2,l:'G1'},{i:11.5,l:'S'},{i:20.7,l:'G2'},{i:27,l:'M'}].forEach(function(o){const p=pPosition(o.i);text(o.l,p.x-Math.cos(p.a)*32,p.y-Math.sin(p.a)*32+6,17,phaseColor(Math.round(o.i)),'center','700');});
    hitRegions=[];
    for(let i=0;i<N;i++){
      const t=track[i],p=pPosition(i),col=phaseColor(i),check=t&&t.type==='checkpoint';
      if(check){
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a+Math.PI/2);
        rounded(-16,-18,32,36,8,'#10201f',col+'cc');
        line(-17,-11,17,-11,col,3);line(-17,11,17,11,col,3);
        ctx.shadowColor=col;ctx.shadowBlur=8;ellipse(-15,-11,2.8,2.8,col);ellipse(15,-11,2.8,2.8,col);ctx.restore();
        text(t.phase.toUpperCase(),p.x,p.y+5,13,'#eafdf5','center','700');
        hitRegions.push({x:p.x,y:p.y,r:22,title:t.label,copy:'Turn over the checkpoint card: p53 checks the cell’s scorecard here before it continues.'});
      }else{
        const start=t&&t.type==='start',finish=t&&t.type==='finish',chance=!!(t&&t.chance),m=t&&t.phase==='m',r=start||finish?14:chance||m?10:9;
        ellipse(p.x,p.y+2,r+2,r+2,'#0006');
        if(chance){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a+Math.PI/2);rounded(-r,-r,2*r,2*r,3,CHANCE_FILL,game&&game.round===2?'#ffffff':CHANCE_RING);if(game&&game.round===2){ctx.strokeStyle=CHANCE_RING;ctx.lineWidth=2;ctx.strokeRect(-r-3,-r-3,2*r+6,2*r+6);}ctx.restore();}
        else ellipse(p.x,p.y,r,r,gradient(p.x,p.y,r,[[0,col+'dd'],[.7,col+'44'],[1,'#172c2b']]),col+'b0',1.4);
        const ink=chance?'#0f3a4a':'#c6e6dc';
        if(start||finish){text(start?'▶':'✓',p.x,p.y+5,13,'#ecfff7','center','700');text(start?'START':'FINISH',p.x+(start?12:-12),p.y-20,13,start?'#ffb36b':'#a9e27a','center','700');}
        else if(m)text(String(t.roll),p.x,p.y+5,13,chance?ink:'#efe6ff','center','700');
        hitRegions.push({x:p.x,y:p.y,r:20,title:t?t.label:'START',copy:t&&t.phase==='m'&&t.type==='space'?'Must roll '+t.roll+': you need a '+t.roll+' on a die to move onto this space.'+(chance?' It is also a light-blue square: in Round 2, landing here draws a Cellular Chance card.':''):chance?'Light-blue square: in Round 2, landing here draws a Cellular Chance card.':'Move one space each turn.'});
      }
    }
    const players=(game&&game.playersState.length?game.playersState:[{id:1,pos:0}]);
    players.forEach(function(p,index){
      const tween=transitions[p.id];let pos=p.pos;
      if(tween){const k=Math.max(0,Math.min(1,(now-tween.time)/750)),ease=k*k*(3-2*k);pos=tween.from+(tween.to-tween.from)*ease;}
      const q=pPosition(pos),same=players.filter(function(o){return o.pos===p.pos;}),offset=same.findIndex(function(o){return o.id===p.id;}),shift=(offset-(same.length-1)/2)*22;
      // Pieces sharing a space spread along the track, so they never cover the START / FINISH label.
      const x=q.x+Math.cos(q.a+Math.PI/2)*shift,y=q.y+Math.sin(q.a+Math.PI/2)*shift;
      const active=game&&game.active===index&&!game.complete,col=colors[index];
      ctx.save();ctx.shadowColor=col;ctx.shadowBlur=active?15:4;
      ellipse(x,y,13,11.5,gradient(x,y,14,[[0,'#e8fff0'],[.26,col],[1,'#1a574c']]),'#e5fff0',1.6);ctx.restore();
      ellipse(x,y,9,9,'#174840','#8ee6c8',.8);text(String(p.id),x,y+5,13,'#fff','center','700');
      if(active){const pulse=reduced?0:Math.sin(now*.003)*2;ellipse(x,y,19+pulse,17+pulse,null,col+'aa',1.4);}
    });
  }
  function mapHits(hits,ox,oy,k){return hits.map(function(h){return {x:ox+h.x*k,y:oy+h.y*k,r:Math.max(14,h.r*k),title:h.title,copy:h.copy};});}
  function wrap(s,maxW,mono,bold){
    ctx.font=(mono?'500 13px monospace':(bold?'700':'500')+' 13px Arial, sans-serif');
    const words=String(s).split(' '),lines=[];let cur='';
    words.forEach(function(w){const t=cur?cur+' '+w:w;if(cur&&ctx.measureText(t).width>maxW){lines.push(cur);cur=w;}else cur=t;});
    if(cur)lines.push(cur);return lines;
  }
  function pSpecimen(){
    const player=game&&game.playersState[game.active],p=player||{pos:3,score:{g1:{nutrients:2,proteins:2,organelles:2},s:{chromosomes:0},g2:{nutrients:0,proteins:0,organelles:0}}};
    const phase=track[p.pos]?.phase||'g1',grow=Math.min(1,(p.score.g1.nutrients+p.score.g1.proteins)/16),radius=132+grow*13;
    const S=.72,cx=PT.cx,cy=PT.cy,actualPhase=phase==='finish'?'m':phase,fin=phase==='finish';
    const rowY=fin?338:390;
    let body;
    if(fin){
      const red=p.lastChip==='red',DX=64,dy=262,KC=.62,KS=1.05,sets=[];
      [-1,1].forEach(function(side){
        const ox=cx+side*DX;
        ctx.save();ctx.translate(ox,dy);ctx.scale(KC,KC);const lh=cell(0,0,93,'g1',p.score,0);ctx.restore();hitRegions.push(...mapHits(lh,ox,dy,KC));
      });
      [-1,1].forEach(function(side){
        const ox=cx+side*DX;
        ctx.save();ctx.translate(ox,dy);ctx.scale(KS,KS);const set=chromosomeSet(0,0,red&&side===-1);ctx.restore();
        sets.push(set.map(function(c){return {color:c.color,changed:c.changed,x:ox+c.x*KS,y:dy+c.y*KS,markX:c.markX===undefined?undefined:ox+c.markX*KS,markY:c.markY===undefined?undefined:dy+c.markY*KS};}));
      });
      const caption=red?'Daughter cells · one carries changed DNA (game model)':'Daughter cells · identical DNA';
      const sub=red?'RED CHIP · CANCER CELL IN THIS GAME MODEL':'SAME CHROMOSOMES IN BOTH · NEW BLUE CHIP';
      let y=364;
      wrap(caption,264,false,true).forEach(function(l){text(l,cx,y,13,red?'#ffc2c2':'#c4f0dc','center','700');y+=17;});
      y+=2;wrap(sub,264,true).forEach(function(l){text(l,cx,y,13,'#a9cbbf','center','mono');y+=17;});
      const changed=sets[0].find(function(c){return c.changed;});
      if(changed){
        const bx=cx-DX-44,by=176;
        line(changed.markX,changed.markY,bx+44,by+24,'#ffd0d0',1.6);ellipse(changed.markX,changed.markY,3,3,'#ffd0d0');
        rounded(bx,by,88,24,6,'#3a1418f2','#ff8a8a');text('CHANGED',bx+44,by+17,13,'#ffe1e1','center','700');
        hitRegions.push({x:changed.x,y:changed.y,r:18,title:'Changed chromosome (game model)',copy:'This daughter cell carries a changed section of DNA (red, dashed outline). The cell divided without p53 stopping it, so it is a red chip: a cancer cell in this game model.'});
      }
      hitRegions.push({x:cx-DX-4*KS,y:dy-8*KS,r:30,title:'Daughter cell DNA',copy:red?'One daughter has a changed chromosome; the other has the original set.':'Both daughter cells have the same chromosome set: identical DNA.'});
      sceneState={view:'daughters',caption:caption,daughters:sets.map(function(set){return {changed:set.some(function(c){return c.changed;}),chromosomes:set.map(function(c){return c.changed?'changed':c.color;})};}),
        changedAt:changed?{x:changed.markX,y:changed.markY}:null};
      body={x:cx+DX,y:dy,r:93*KC};
    }else{
      sceneState={view:'cell',caption:'',daughters:[]};
      const mt=track[p.pos],split=mt&&mt.phase==='m'?(mt.type==='checkpoint'?.9:.15+(mt.roll||0)*.13):.1;
      ctx.save();ctx.translate(cx,cy);ctx.scale(S,S);const lh=cell(0,0,radius,actualPhase,p.score,split);ctx.restore();
      hitRegions.push(...mapHits(lh,cx,cy,S));
      const phaseText=phase==='s'?'COLLECTING CHROMOSOMES':phase==='g2'?'GROWING & GATHERING':phase==='m'?'DIVIDING · ROLL 1–5 IN ORDER':'GROWING & GATHERING';
      text(phaseText,cx,412,13,'#b0d3c6','center','mono');
      body={x:cx,y:cy,r:radius*S};
    }
    // Leaders are anchored to where each structure is drawn this frame (a dot marks the exact spot).
    const lc='#adc8bdb0';
    const leader=function(ax,ay,ex,ey,tx,ty,label,align){line(ax,ay,ex,ey,lc,1.2);line(ex,ey,tx,ty,lc,1.2);ellipse(ax,ay,3,3,'#d9ece4');text(label,align==='right'?tx-4:tx+6,ty+4,13,'#cfdfd7',align);};
    const toward=function(cx0,cy0,rx,ry,tx,ty){const a=Math.atan2((ty-cy0)/ry,(tx-cx0)/rx);return [cx0+Math.cos(a)*rx,cy0+Math.sin(a)*ry];};
    if(actualPhase==='m'&&!fin){
      leader(body.x+body.r*.77,body.y,196,168,200,168,'Spindle fibres');
    }else{
      const nucs=hitRegions.filter(function(h){return h.title==='Nucleus'||/^S phase/.test(h.title);}),nuc=nucs[nucs.length-1];
      if(nuc){const pt=toward(nuc.x,nuc.y,nuc.r*.92,nuc.r*.88*.92,196,168);leader(pt[0],pt[1],196,168,200,168,'Nucleus / DNA');}
    }
    const mitos=hitRegions.filter(function(h){return h.title==='Mitochondrion';});
    if(mitos.length){const m=mitos.reduce(function(a,b){return Math.hypot(b.x-110,b.y-rowY)<Math.hypot(a.x-110,a.y-rowY)?b:a;});leader(m.x,m.y,150,rowY,146,rowY,'Mitochondria','right');}
    const mem=toward(body.x,body.y,body.r-1,body.r*.83-1,208,rowY);leader(mem[0],mem[1],208,rowY,212,rowY,'Cell membrane');
    if(game&&game.event&&/checkpoint/i.test(game.event.kicker)){
      const passed=/passed/i.test(game.event.kicker);
      text(passed?'p53 CHECK · PASSED':'p53 CHECK · '+(/DESTROYED|destroyed/.test(game.event.title)?'CELL DESTROYED':'SENT BACK'),cx,134,13,passed?'#86e1b8':'#efcd91','center','mono');
    }
  }
  function pDice(){
    rounded(68,424,224,56,14,'#233e36','#8ba89750');rounded(73,429,214,46,10,'#19352d','#86ad9040');
    const vals=game?.lastDice||[];
    for(let i=0;i<4;i++){
      const spin=rolling&&!reduced,tt=(now-rollStart)*.018,x=180+(i-1.5)*50,y=452+(spin?Math.sin(tt+i)*4:0),angle=spin?Math.sin(tt+i)*.18:((i%2?-1:1)*.075);
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(.72,.72);ctx.shadowColor='#0009';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
      rounded(-26,-26,53,57,11,'#a6b3a6');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      const g=ctx.createLinearGradient(-24,-24,24,24);g.addColorStop(0,'#ffffed');g.addColorStop(.6,'#e9e7d3');g.addColorStop(1,'#cbcebb');rounded(-26,-28,53,52,10,g,'#faffeb');
      const val=spin?1+(Math.floor(now*.02+i*3)%6):(vals[i]||0);
      if(val)for(const q of pipPositions[val]){const px=(q%3-1)*13,py=(Math.floor(q/3)-1)*13-2;ellipse(px,py,3.8,3.8,'#223b32');ellipse(px+.3,py+.5,2.9,2.9,'#314c40');}
      else text('?',0,5,23,'#6b7e6f','center','700');
      ctx.restore();
    }
    text('1 Nutrient · 2 Protein · 3 Organelle',180,505,13,'#b9cdc4','center');text('4 Chromosome (S) · 5–6 nothing',180,522,13,'#b9cdc4','center');text('M: roll the number on the next space',180,539,13,'#b9cdc4','center');
  }
  const PORTRAIT_LABEL='The Cell Game board drawn as a rounded track of 32 spaces, starting at the top: START, 6 G1 spaces, the G1 Checkpoint, 8 S spaces, 8 G2 spaces, the G2 Checkpoint, 5 M spaces marked with the number to roll (1 to 5), the M Checkpoint and FINISH. Light-blue squares are Cellular Chance spaces. Inside the track is a magnified cell showing its membrane, nucleus, mitochondria and chromosomes, then four dice and the dice key. Each player\'s cell chips are listed at the top. See the scorecard and turn result for the current state.';
  function wantPortrait(){
    if(!(window.innerWidth<1100))return false;
    const expanded=!!(frame&&frame.classList&&frame.classList.contains('scene-expanded'));
    if(expanded)return window.innerWidth<900&&window.innerWidth<window.innerHeight;
    const w=frame&&frame.clientWidth;
    return w?w<900:portrait;
  }
  function applyLayout(want){
    portrait=want;W=want?PORTRAIT_W:WIDE_W;H=want?PORTRAIT_H:WIDE_H;
    if(want&&!ring)buildRing();
    if(!canvas.setAttribute)return;
    canvas.setAttribute('data-layout',want?'portrait':'wide');
    if(frame&&frame.classList)frame.classList.toggle('is-portrait',want);
    const cur=canvas.getAttribute('aria-label')||'';
    if(!canvas.dataset.wideLabel)canvas.dataset.wideLabel=cur;
    const wide=canvas.dataset.wideLabel,oldBase=canvas.dataset.baseLabel||wide,base=want?PORTRAIT_LABEL:wide;
    const suffix=cur.indexOf(oldBase)===0?cur.slice(oldBase.length):'';
    canvas.dataset.baseLabel=base;canvas.setAttribute('aria-label',base+suffix);
  }
  function paint(){minFont=99;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);if(portrait){pBackground();pPath();pSpecimen();pDice();}else{background();path();specimen();dice();}drawParticles();}
  function animate(time){raf=0;now=time;if(!visible||document.hidden)return;if(time-lastTime>1000/28){lastTime=time;paint();}if(!reduced||rolling||particles.length)raf=requestAnimationFrame(animate);}
  function request(){if(!raf)raf=requestAnimationFrame(animate);}
  function resize(){const want=wantPortrait();if(want!==portrait||!canvas.getAttribute||!canvas.dataset||!canvas.dataset.baseLabel)applyLayout(want);const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.width*H/W*dpr);paint();request();}
  function update(g,t){
    const prev=game;track=t;game=g;
    if(prev){for(const p of g.playersState){const before=prev.playersState.find(o=>o.id===p.id);if(before&&before.pos!==p.pos)transitions[p.id]={from:before.pos,to:p.pos,time:performance.now()};}}
    if(g.turns>lastTurn){
      lastTurn=g.turns;
      let gained=0;
      if(prev)for(const p of g.playersState){const before=prev.playersState.find(o=>o.id===p.id);if(before)for(const phase of ['g1','s','g2'])for(const key of Object.keys(p.score[phase]))gained+=Math.max(0,p.score[phase][key]-before.score[phase][key]);}
      // Reduced motion: the scorecard shows what was collected, so skip the flying particles.
      if(!reduced)for(let i=0;i<Math.min(12,gained*2);i++)particles.push(portrait?{x:99+(i%4)*54,y:452,tx:150+(i*19)%60,ty:250+(i*31)%60,color:i%3?'#9ee9bf':'#d1b3ee',time:performance.now()+i*13}:{x:65+(i%4)*78,y:680,tx:520+(i*19)%100,ty:285+(i*31)%80,color:i%3?'#9ee9bf':'#d1b3ee',time:performance.now()+i*13});
    }
    game=JSON.parse(JSON.stringify(g));paint();request();
  }
  function setRolling(value){rolling=value;if(value)rollStart=performance.now();request();}
  function showAt(event){
    const r=canvas.getBoundingClientRect(),scale=Math.min(r.width/W,r.height/H),left=(r.width-W*scale)/2,top=(r.height-H*scale)/2;
    const x=(event.clientX-r.left-left)/scale,y=(event.clientY-r.top-top)/scale;
    const hit=hitRegions.slice().reverse().find(h=>Math.hypot(x-h.x,y-h.y)<h.r);
    canvas.style.cursor=hit?'help':'default';
    if(!hit){tip.hidden=true;selected=null;return;}
    if(selected!==hit.title){tip.textContent=hit.title+' — '+hit.copy;selected=hit.title;}
    tip.hidden=false;tip.style.left=Math.max(10,Math.min(r.width-240,x*scale+left+14))+'px';tip.style.top=Math.max(30,y*scale+top-70)+'px';
  }
  canvas.addEventListener('pointermove',showAt);canvas.addEventListener('pointerdown',showAt);canvas.addEventListener('pointerleave',()=>{tip.hidden=true;selected=null;});
  new ResizeObserver(resize).observe(canvas);if(frame)new ResizeObserver(resize).observe(frame);
  new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)request();else if(raf){cancelAnimationFrame(raf);raf=0;}},{rootMargin:'150px'}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)request();else if(raf){cancelAnimationFrame(raf);raf=0;}});
  window.CellCycleScene={update:update,rolling:setRolling,state:function(){return Object.assign(JSON.parse(JSON.stringify(sceneState)),{layout:portrait?'portrait':'wide',logicalWidth:W,minFont:minFont});}};
})();
