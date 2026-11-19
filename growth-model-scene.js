/* Original schematic artwork; all playback counts come from recorded trial data. */
(function(){
  'use strict';
  const canvas=document.getElementById('growth-scene'),chart=document.getElementById('growth-chart');
  if(!canvas||!chart)return;
  const c=canvas.getContext('2d'),W=1160,H=650,reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let settings={age:50,size:'average',tissue:'medium'},recordings=[],trialIndex=0,year=20,fraction=0,playing=false,visible=true,frameId=0,lastFrame=0,previous=0,elapsed=0,selected=0,groups=[];
  const palette=['#8cddb7','#b8c8f2','#e5c18d','#edb0c4','#8bd0e0','#cbd59a','#c4a9e3','#e9b39c'];
  const unitCounts={small:20,average:30,large:40},rates={slow:'SLOW',medium:'MODERATE',fast:'FAST'};
  let cachedN=0,units=[],polygons=[];
  function text(ctx,s,x,y,size,color,align,weight){ctx.fillStyle=color||'#d0e4da';ctx.font=(weight||500)+' '+size+'px sans-serif';ctx.textAlign=align||'left';ctx.fillText(String(s),x,y);}
  function line(ctx,x,y,x2,y2,color,width){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width||1;ctx.stroke();}
  function oval(ctx,x,y,rx,ry,fill,stroke,width){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width||1;ctx.stroke();}}
  function disk(ctx,x,y,r,a,b){const g=ctx.createRadialGradient(x-r*.3,y-r*.3,1,x,y,r);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
  function path(ctx,pts,fill,stroke){ctx.beginPath();pts.forEach((p,i)=>{if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.3;ctx.stroke();}}
  function makeUnits(n){
    if(n===cachedN)return;cachedN=n;units=[];polygons=[];
    for(let i=0;i<n;i++){const angle=i*2.399963,r=Math.sqrt((i+.5)/n)*176;units.push({x:Math.cos(angle)*r,y:Math.sin(angle)*r});}
    for(let i=0;i<n;i++){
      let poly=Array.from({length:80},(_,k)=>[Math.cos(k/80*Math.PI*2)*184,Math.sin(k/80*Math.PI*2)*184]);
      for(let j=0;j<n&&poly.length;j++){
        if(i===j)continue;
        const a=units[i],b=units[j],nx=b.x-a.x,ny=b.y-a.y,bound=(b.x*b.x+b.y*b.y-a.x*a.x-a.y*a.y)/2,out=[];
        for(let k=0;k<poly.length;k++){
          const p=poly[k],q=poly[(k+1)%poly.length],dp=p[0]*nx+p[1]*ny-bound,dq=q[0]*nx+q[1]*ny-bound;
          if(dp<=.001)out.push(p);
          if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
        }poly=out;
      }polygons.push(poly);
    }
  }
  function currentTrial(){return recordings[trialIndex]||null;}
  function currentRow(){const t=currentTrial();if(!t||!Array.isArray(t.timeline))return null;return t.timeline[Math.min(t.timeline.length-1,Math.max(0,Math.floor(year)-20))]||null;}
  function background(){
    const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,'#1c3036');g.addColorStop(.55,'#11242b');g.addColorStop(1,'#0c191e');c.fillStyle=g;c.fillRect(0,0,W,H);
    for(let i=0;i<900;i++)oval(c,(i*173.31)%W,(i*67.73)%H,.6,.6,'#bed6cb0b');
    for(let x=20;x<W;x+=40)line(c,x,0,x,H,'#b5dbc906');for(let y=20;y<H;y+=40)line(c,0,y,W,y,'#b5dbc906');
    text(c,'CELL GROWTH / OBSERVATION STATION',28,32,12,'#a4c9bd');text(c,'B.3 · LESSON 4',1132,32,12,'#81a49c','right');line(c,28,47,1132,47,'#9dc8b936');
  }
  function body(){
    const size=currentTrial()?.size||settings.size,k={small:.85,average:1,large:1.13}[size],x=180,y=270;
    c.save();c.translate(x,y);c.scale(k,k);
    c.shadowColor='#9ce0cd22';c.shadowBlur=16;
    oval(c,0,-126,23,30,disk(c,0,-126,31,'#88b8aa90','#3d6b6255'),'#b6dfcd88',1.3);c.shadowBlur=0;
    // Continuous torso, arms and legs, with shoulder, waist and joint contours.
    c.beginPath();c.moveTo(-11,-98);c.lineTo(-11,-88);c.bezierCurveTo(-29,-87,-42,-84,-49,-67);c.lineTo(-68,24);c.quadraticCurveTo(-71,40,-61,41);c.quadraticCurveTo(-53,41,-51,27);c.lineTo(-32,-34);c.lineTo(-28,29);c.bezierCurveTo(-32,51,-30,68,-26,83);c.lineTo(-28,156);c.quadraticCurveTo(-27,170,-15,164);c.lineTo(-2,71);c.lineTo(3,71);c.lineTo(15,164);c.quadraticCurveTo(28,170,29,156);c.lineTo(27,83);c.bezierCurveTo(32,65,33,49,28,29);c.lineTo(32,-34);c.lineTo(51,27);c.quadraticCurveTo(53,41,61,41);c.quadraticCurveTo(71,40,68,24);c.lineTo(49,-67);c.bezierCurveTo(42,-84,29,-87,11,-88);c.lineTo(11,-98);c.closePath();
    const g=c.createLinearGradient(-55,0,55,0);g.addColorStop(0,'#75b8a838');g.addColorStop(.5,'#7fbcae6b');g.addColorStop(1,'#3f73644d');c.fillStyle=g;c.fill();c.strokeStyle='#a4d8c587';c.lineWidth=1.3;c.stroke();
    // Translucent anatomical landmarks orient the schematic sample.
    for(const side of [-1,1]){c.save();c.scale(side,1);c.beginPath();c.moveTo(6,-69);c.bezierCurveTo(28,-74,32,-42,21,-21);c.quadraticCurveTo(6,-16,6,-32);c.closePath();c.fillStyle='#a1b8c13d';c.fill();c.strokeStyle='#aac4c247';c.stroke();c.restore();}
    for(let i=0;i<5;i++){c.beginPath();c.ellipse(0,-57+i*8,29-i,8,0,0,Math.PI);c.strokeStyle='#d3d9c12e';c.stroke();}
    line(c,0,-85,0,112,'#8fcbb855',2);line(c,0,52,-17,128,'#ab909352',1.4);line(c,0,52,17,128,'#ab909352',1.4);
    for(let i=0;i<7;i++){c.beginPath();c.ellipse(0,2+i*5,17,4,0,i%2?0:Math.PI,i%2?Math.PI:Math.PI*2);c.strokeStyle='#dfc69542';c.lineWidth=2;c.stroke();}
    oval(c,9,-38,7,9,'#c7a4a160','#dbc6b533');
    c.restore();
    text(c,({small:'SMALLER',average:'AVERAGE',large:'LARGER'})[size]+' BODY MODEL',180,492,12,'#b1cfbf','center');text(c,unitCounts[size]+' cell units in the sample',180,512,12,'#83a79c','center');
    // Bracketed sample connects the body scale to the tissue scale.
    const sx=180+17*k,sy=270-42*k;c.strokeStyle='#a8d6c6bb';c.strokeRect(sx-11,sy-11,22,22);line(c,sx+11,sy-11,395,161,'#a3d4c155');line(c,sx+11,sy+11,395,407,'#a3d4c155');
    text(c,'MAGNIFIED SAMPLE',342,124,9,'#82b2a0','center');
  }
  function chromosome(ctx,x,y,angle,color){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.lineCap='round';line(ctx,-4,-6,4,6,color,2.7);line(ctx,4,-6,-4,6,color,2.7);ctx.restore();}
  function tissue(){
    const t=currentTrial(),n=unitCounts[t?.size||settings.size];makeUnits(n);const row=currentRow(),events=row?.cells||[],cx=627,cy=283;
    oval(c,cx,cy,198,198,'#081a1e','#89b8a044',2);oval(c,cx,cy,191,191,'#31534d','#a6d9bd55',1);
    c.save();c.translate(cx,cy);
    for(let i=0;i<n;i++){
      const u=units[i],poly=polygons[i],dividing=events.includes(i),col=dividing?'#91d9b77a':i%3===0?'#51746c':'#3d605d';
      path(c,poly,col,'#a9ceb68a');
      const inset=poly.map(p=>[u.x+(p[0]-u.x)*.94,u.y+(p[1]-u.y)*.94]);path(c,inset,null,'#0a262755');
      const nucleusR=n===40?10:12;
      if(dividing){
        const spread=5+Math.sin(fraction*Math.PI)*11;
        oval(c,u.x-spread,u.y,nucleusR*.7,nucleusR,disk(c,u.x-spread,u.y,nucleusR,'#d8b9e1','#876d9a'),'#c7a7da');oval(c,u.x+spread,u.y,nucleusR*.7,nucleusR,disk(c,u.x+spread,u.y,nucleusR,'#d8b9e1','#876d9a'),'#c7a7da');
        for(let j=-1;j<=1;j++)line(c,u.x-20,u.y+j*6,u.x+20,u.y-j*6,'#d1e2a887',.7);
        chromosome(c,u.x-spread,u.y,.3,'#e8c7f0');chromosome(c,u.x+spread,u.y,-.3,'#c9d5fa');
        oval(c,u.x,u.y,26,23,null,'#aaf1cc7a',1);
      }else{
        oval(c,u.x,u.y,nucleusR,nucleusR*.88,disk(c,u.x,u.y,nucleusR,'#a8a0bf','#676680'),'#c3b8d480',1);
        for(let j=0;j<4;j++){c.beginPath();c.moveTo(u.x-6+j*3,u.y-5);c.bezierCurveTo(u.x+10,u.y-8+j*3,u.x-10,u.y+7,u.x+4-j*2,u.y+5);c.strokeStyle='#ddd1ed66';c.lineWidth=.7;c.stroke();}
        oval(c,u.x-2,u.y-2,2,2,'#d0bccb73');
      }
      // Organelle silhouettes and granules make each cell legible as a cell.
      c.save();c.translate(u.x+16,u.y+12);c.rotate(i*.83);oval(c,0,0,6,3,'#d3af797b','#dcc79770',.7);line(c,-3,0,3,0,'#806446',.8);c.restore();
      for(let j=0;j<5;j++){const a=i*1.7+j*2.4;oval(c,u.x+Math.cos(a)*18,u.y+Math.sin(a)*18,.9,.9,'#d7dfba66');}
      if(selected===i)path(c,inset,null,'#ecdcac');
    }
    c.restore();
    text(c,'LIVING TISSUE / SCHEMATIC',627,66,11,'#9ac5b3','center');text(c,(n)+' MODELED CELL UNITS',627,502,11,'#b0d4c1','center');
    text(c,'Tap a cell to inspect its recorded divisions.',627,521,11,'#83aa9c','center');
  }
  function metrics(){
    const t=currentTrial(),row=currentRow(),num=row?row.cumulative:(t&&!t.timeline?t.divisions:0),age=t?Math.floor(year):20;
    line(c,867,113,867,460,'#aacbb52b');text(c,t?'RECORDED PLAYBACK':'READY TO INVESTIGATE',897,100,10,'#8fb09f');
    text(c,'MODELED AGE',897,144,10,'#89a79b');text(c,age,897,191,43,'#dceede','left',600);text(c,'years',976,190,13,'#8fae9e');
    line(c,897,214,1120,214,'#aacbb522');text(c,'DIVISION EVENTS',897,247,10,'#89a79b');text(c,num,897,295,43,'#b3ebc5','left',600);
    text(c,'DNA-copying opportunities',897,322,12,'#adc7b7');
    line(c,897,342,1120,342,'#aacbb522');text(c,'DIVISION SETTING',897,373,10,'#89a79b');text(c,rates[t?.tissue||settings.tissue],897,401,21,'#dac7ee','left',600);
    text(c,t?'Trial '+(trialIndex+1)+' of '+recordings.length:'Run three trials to record',897,440,12,'#a9c7b6');
    text(c,t&&(!t.timeline)?'Older record · final count only':playing?'Playing saved division events':t?'Playback paused / complete':'No trial data yet',897,461,10,'#7c9f8e');
  }
  function timeline(){
    const x0=62,y0=590,x1=1096,h=48,t=currentTrial(),maxAge=t?.age||settings.age;
    line(c,30,540,1130,540,'#aad2bc2b');text(c,'DIVISIONS THROUGH TIME',32,561,10,'#a0bca9');
    if(!t){text(c,'Your recorded trajectories will appear here.',1118,561,11,'#7e9f8e','right');line(c,x0,y0,x1,y0,'#7ba88b55');text(c,'20',x0,y0+20,10,'#a8bba9','center');text(c,maxAge,x1,y0+20,10,'#a8bba9','center');return;}
    const max=Math.max(1,...recordings.map(r=>r.divisions));
    recordings.forEach((trial,j)=>{
      if(!trial.timeline)return;c.beginPath();trial.timeline.forEach((r,k)=>{const x=x0+(x1-x0)*(r.year-20)/Math.max(1,maxAge-20),y=y0-r.cumulative/max*h;if(k)c.lineTo(x,y);else c.moveTo(x,y);});c.strokeStyle=palette[j]+(j===trialIndex?'ee':'55');c.lineWidth=j===trialIndex?2:1;c.stroke();
    });
    const px=x0+(x1-x0)*(year-20)/Math.max(1,maxAge-20),row=currentRow();line(c,px,y0-h-5,px,y0+4,'#e2e5b577');if(row)oval(c,px,y0-row.cumulative/max*h,3.5,3.5,'#d9f0cd');
    text(c,'20',x0,y0+20,10,'#a8bba9','center');text(c,maxAge,x1,y0+20,10,'#a8bba9','center');text(c,'modeled age →',580,y0+20,10,'#84a590','center');
  }
  function draw(){c.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);c.clearRect(0,0,W,H);background();body();tissue();metrics();timeline();}
  function emit(type){const t=currentTrial();canvas.dispatchEvent(new CustomEvent('growth-playback',{detail:{type:type,playing:playing,year:Math.floor(year),target:t?.age||settings.age,trial:trialIndex+1,divisions:currentRow()?.cumulative||0,hasHistory:Array.isArray(t?.timeline)}}));}
  function animate(time){
    frameId=0;
    if(!visible||document.hidden){previous=0;return;}
    if(playing){
      if(previous)elapsed+=Math.min(100,time-previous);previous=time;
      const t=currentTrial(),duration=4200,progress=Math.min(1,elapsed/duration),span=t.age-20;
      year=20+Math.floor(span*progress);fraction=span*progress-Math.floor(span*progress);
      if(time-lastFrame>70){draw();emit('tick');lastFrame=time;}
      if(progress>=1){if(trialIndex<recordings.length-1){trialIndex++;elapsed=0;year=20;}else{playing=false;year=t.age;draw();emit('complete');}}
    }
    if(playing)frameId=requestAnimationFrame(animate);
  }
  function schedule(){if(!frameId&&playing)frameId=requestAnimationFrame(animate);}
  function configure(s){settings=s;recordings=[];trialIndex=0;playing=false;year=20;fraction=0;previous=0;draw();emit('settings');}
  function play(trials){recordings=trials;trialIndex=0;elapsed=0;previous=0;year=20;fraction=0;playing=true;
    if(reduce||trials.every(t=>t.age===20)||trials.some(t=>!Array.isArray(t.timeline))){trialIndex=trials.length-1;year=trials[trialIndex].age;playing=false;draw();emit('complete');return;}
    draw();emit('start');schedule();
  }
  function pause(){playing=!playing;if(playing&&year>=currentTrial().age){elapsed=0;year=20;}previous=0;emit('pause');schedule();}
  function scrub(value){if(!recordings.length)return;playing=false;year=Math.max(20,Math.min(currentTrial().age,value));elapsed=(year-20)/Math.max(1,currentTrial().age-20)*4200;fraction=.5;previous=0;draw();emit('scrub');}
  function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.width*H/W*dpr));draw();drawChart(groups);}
  function drawChart(data){
    groups=data;const last=data.slice(-8),ctx=chart.getContext('2d'),height=Math.max(280,92+last.length*67),rect=chart.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    chart.style.aspectRatio=W+' / '+height;chart.width=Math.max(1,Math.round((rect.width||W)*dpr));chart.height=Math.max(1,Math.round((rect.width||W)*height/W*dpr));ctx.setTransform(chart.width/W,0,0,chart.height/height,0,0);
    ctx.fillStyle='#13272d';ctx.fillRect(0,0,W,height);text(ctx,'RECORDED DIVISIONS / THREE TRIALS PER SET',28,32,12,'#b2cbbd');
    if(!last.length){text(ctx,'Run a set, change one setting, then compare the patterns.',W/2,145,18,'#91b5a5','center');return;}
    const max=Math.max(1,...last.flatMap(g=>g.trials.map(t=>t.divisions))),nice=Math.max(5,Math.ceil(max/5/10)*10),axisMax=nice*5,x0=355,x1=1100;
    for(let i=0;i<=5;i++){const x=x0+i/5*(x1-x0);line(ctx,x,58,x,height-30,'#a0c5ae22');text(ctx,i*nice,x,height-12,11,'#8fac9b','center');}
    last.forEach((g,j)=>{const y=84+j*67,color=palette[(g.index-1)%palette.length];text(ctx,'SET '+g.index,28,y,12,color);text(ctx,'Age '+g.age+' · '+unitCounts[g.size]+' units · '+g.tissue,28,y+19,12,'#a7beaf');
      const vals=g.trials.map(t=>t.divisions),lo=Math.min(...vals),hi=Math.max(...vals),mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      const scale=v=>x0+v/axisMax*(x1-x0);line(ctx,scale(lo),y,scale(hi),y,color+'77',2);
      vals.forEach((v,k)=>oval(ctx,scale(v),y+(k-1)*8,5.5,5.5,color+'b0',color,1));line(ctx,scale(mean),y-16,scale(mean),y+16,'#eff9de',2);text(ctx,'mean '+mean.toFixed(1),Math.min(x1-70,scale(hi)+14),y+4,11,'#d9e7d0');
    });
  }
  function inspect(event){const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*W/r.width-627,y=(event.clientY-r.top)*H/r.height-283,tip=document.getElementById('growth-tip');if(Math.hypot(x,y)>184){tip.hidden=true;return;}
    selected=units.reduce((best,p,i)=>Math.hypot(p.x-x,p.y-y)<Math.hypot(units[best].x-x,units[best].y-y)?i:best,0);const t=currentTrial(),count=t?.timeline?t.timeline.filter(row=>row.year<=year&&row.cells.includes(selected)).length:null;
    tip.textContent='Model unit '+(selected+1)+(count===null?' · Run a trial to inspect its history.':' · '+count+' recorded division'+(count===1?'':'s')+' by modeled age '+Math.floor(year)+'.');tip.hidden=false;draw();}
  canvas.addEventListener('pointerdown',inspect);canvas.addEventListener('pointerleave',()=>{document.getElementById('growth-tip').hidden=true;});
  canvas.addEventListener('keydown',function(event){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();selected=event.key==='Home'?0:event.key==='End'?units.length-1:(selected+(event.key==='ArrowRight'?1:-1)+units.length)%units.length;
    const t=currentTrial(),count=t?.timeline?t.timeline.filter(row=>row.year<=year&&row.cells.includes(selected)).length:null,tip=document.getElementById('growth-tip');
    tip.textContent='Model unit '+(selected+1)+(count===null?' · Run a trial to inspect its history.':' · '+count+' recorded divisions by modeled age '+Math.floor(year)+'.');tip.hidden=false;draw();
  });
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(es=>{visible=es[0].isIntersecting;previous=0;if(visible)schedule();},{rootMargin:'150px'}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{previous=0;if(!document.hidden)schedule();});
  window.GrowthModelScene={configure:configure,play:play,pause:pause,scrub:scrub,chart:drawChart};
})();
