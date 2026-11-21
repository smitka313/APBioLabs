/* Original schematic artwork; all playback counts come from recorded trial data. */
(function(){
  'use strict';
  const canvas=document.getElementById('growth-scene'),chart=document.getElementById('growth-chart'),chart2=document.getElementById('growth-chart-changes');
  if(!canvas||!chart)return;
  const c=canvas.getContext('2d'),W=1160,H=650,reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let settings={age:50,size:'average',tissue:'skin'},recordings=[],trialIndex=0,only=false,year=20,fraction=0,playing=false,visible=true,frameId=0,lastFrame=0,previous=0,elapsed=0,selected=0,groups=[];
  const palette=['#8cddb7','#b8c8f2','#e5c18d','#edb0c4','#8bd0e0','#cbd59a','#c4a9e3','#e9b39c'];
  const unitCounts={small:20,average:30,large:40},rates={slow:'SLOW',medium:'MODERATE',fast:'FAST'};
  let cachedKey='',units=[],polygons=[];
  function profile(key){return window.GrowthCellTypes.profile(key);}
  function plural(n,word){return n+' '+word+(n===1?'':'s');}
  function text(ctx,s,x,y,size,color,align,weight){ctx.fillStyle=color||'#d0e4da';ctx.font=(weight||500)+' '+size+'px sans-serif';ctx.textAlign=align||'left';ctx.fillText(String(s),x,y);}
  function line(ctx,x,y,x2,y2,color,width){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width||1;ctx.stroke();}
  function oval(ctx,x,y,rx,ry,fill,stroke,width){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width||1;ctx.stroke();}}
  function disk(ctx,x,y,r,a,b){const g=ctx.createRadialGradient(x-r*.3,y-r*.3,1,x,y,r);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
  function path(ctx,pts,fill,stroke){ctx.beginPath();pts.forEach((p,i)=>{if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.3;ctx.stroke();}}
  function makeUnits(n,kind){
    const key=n+':'+kind;if(key===cachedKey)return;cachedKey=key;units=[];polygons=[];
    if(kind==='colon'){
      for(let i=0;i<n;i++){
        const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,mid=(a+b)/2,pts=[];
        units.push({x:Math.cos(mid)*139,y:Math.sin(mid)*139});
        for(let j=0;j<=3;j++){const angle=a+(b-a)*j/3;pts.push([Math.cos(angle)*184,Math.sin(angle)*184]);}
        for(let j=3;j>=0;j--){const angle=a+(b-a)*j/3;pts.push([Math.cos(angle)*58,Math.sin(angle)*58]);}
        polygons.push(pts);
      }return;
    }
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
    const kind=currentTrial()?.tissue||settings.tissue,site=profile(kind).location;
    const point=site==='brain'?[0,-126]:site==='skin'?[-59,15]:site==='colon'?[0,10]:site==='marrow'?[18,110]:[17,-42];
    const sx=180+point[0]*k,sy=270+point[1]*k;c.strokeStyle='#a8d6c6bb';c.strokeRect(sx-11,sy-11,22,22);line(c,sx+11,sy-11,395,161,'#a3d4c155');line(c,sx+11,sy+11,395,407,'#a3d4c155');
    text(c,'MAGNIFIED SAMPLE',342,124,9,'#82b2a0','center');
  }
  function chromosome(ctx,x,y,angle,color){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.lineCap='round';line(ctx,-4,-6,4,6,color,2.7);line(ctx,4,-6,-4,6,color,2.7);ctx.restore();}
  function tissue(){
    const t=currentTrial(),kind=t?.tissue||settings.tissue,n=unitCounts[t?.size||settings.size];makeUnits(n,kind);const row=currentRow(),events=row?.cells||[],cancers=row?.cancerCells||[],cx=627,cy=283;
    oval(c,cx,cy,198,198,'#081a1e','#89b8a044',2);oval(c,cx,cy,191,191,'#31534d','#a6d9bd55',1);
    c.save();c.translate(cx,cy);c.beginPath();c.arc(0,0,184,0,Math.PI*2);c.clip();
    for(let i=0;i<n;i++){
      const u=units[i],poly=polygons[i],dividing=events.includes(i),cancer=cancers.includes(i),mask=row?.changes?.[i]||0,changed=mask>0&&!cancer;
      const col=cancer?'#ac4266':dividing?'#77b49b':kind==='skin'?(i%3?'#756c68':'#8c7a70'):kind==='colon'?(i%3?'#6d7b68':'#839477'):'#3d605d';
      const inset=poly.map(p=>[u.x+(p[0]-u.x)*.94,u.y+(p[1]-u.y)*.94]);
      if(kind==='brain'){
        // Glial/support-cell processes form a network; no mature neurons divide here.
        for(let arm=0;arm<5;arm++){const a=arm/5*Math.PI*2+i*.83,x2=u.x+Math.cos(a)*37,y2=u.y+Math.sin(a)*37;c.beginPath();c.moveTo(u.x,u.y);c.quadraticCurveTo(u.x+Math.cos(a+.3)*20,u.y+Math.sin(a+.3)*20,x2,y2);c.strokeStyle=cancer?'#e395ab99':'#b1a8d875';c.lineWidth=3;c.stroke();line(c,x2,y2,x2+Math.cos(a+.8)*8,y2+Math.sin(a+.8)*8,'#afa7cf66',1.3);}
        oval(c,u.x,u.y,20,17,cancer?'#a7486c':dividing?'#77b49b':'#716c96','#b1a8d879');
      }else if(kind==='bloodRed'||kind==='bloodWhite'){
        const r=kind==='bloodRed'?23:25,fill=cancer?'#ac4266':dividing?'#77b49b':kind==='bloodRed'?'#b98e93':'#8196af';
        oval(c,u.x,u.y,r,r*.94,disk(c,u.x,u.y,r,fill+'dd',fill+'88'),cancer?'#f4a4c0':'#dad3da99',1.4);
      }else{path(c,poly,col,cancer?'#ef95b5':'#b6c6a980');path(c,inset,null,'#162d2c66');}
      if(kind==='colon'){const a=Math.atan2(u.y,u.x);for(let br=-2;br<=2;br++){const ang=a+br*.02;line(c,Math.cos(ang)*59,Math.sin(ang)*59,Math.cos(ang)*65,Math.sin(ang)*65,'#d6deba99',1);}}
      const nucleusR=kind==='bloodWhite'?14:n===40?10:12;
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
      if(changed)oval(c,u.x+13,u.y-14,3,3,'#f1c574','#fff0b9',.8);
      if(cancer){
        const dx=kind==='colon'?u.x*.87:u.x+13,dy=kind==='colon'?u.y*.87:u.y-15;
        oval(c,dx,dy,7,7,'#49182e','#ffaeca',1);text(c,'C',dx,dy+3,9,'#ffe7f0','center',700);
        for(let k=0;k<3;k++)line(c,u.x-14+k*5,u.y+18,u.x-10+k*5,u.y+14,'#f6b9ccaa',1);
      }
      if(selected===i){if(kind==='brain'||kind==='bloodRed'||kind==='bloodWhite')oval(c,u.x,u.y,27,26,null,'#ecdcac',1.5);else path(c,inset,null,'#ecdcac');}

    }
    if(kind==='colon'){oval(c,0,0,56,56,'#192f32','#c3d6b855',1);text(c,'CRYPT',0,-3,9,'#afc7b4','center');text(c,'LUMEN',0,12,9,'#afc7b4','center');}
    c.restore();
    text(c,'LIVING TISSUE / SCHEMATIC',627,66,11,'#9ac5b3','center');text(c,profile(kind).short.toUpperCase()+' / '+n+' CELL UNITS',627,502,11,'#b0d4c1','center');
    text(c,'Tap a cell to inspect its recorded divisions.',627,521,11,'#83aa9c','center');
  }
  function metrics(){
    const t=currentTrial(),row=currentRow(),num=row?row.cumulative:(t&&!t.timeline?t.divisions:0),age=t?Math.floor(year):20;
    line(c,867,113,867,460,'#aacbb52b');text(c,t?'RECORDED PLAYBACK':'READY TO INVESTIGATE',897,100,10,'#8fb09f');
    text(c,'MODELED AGE',897,144,10,'#89a79b');text(c,age,897,191,43,'#dceede','left',600);text(c,'years',976,190,13,'#8fae9e');
    line(c,897,214,1120,214,'#aacbb522');text(c,'DIVISION EVENTS',897,247,10,'#89a79b');text(c,num,897,295,43,'#b3ebc5','left',600);
    text(c,'DNA-copying opportunities',897,322,12,'#adc7b7');
    line(c,897,342,1120,342,'#aacbb522');text(c,'CELL TYPE',897,373,10,'#89a79b');text(c,profile(t?.tissue||settings.tissue).short,897,401,20,'#dac7ee','left',600);
    text(c,'CANCEROUS STATE (MODEL)',897,437,10,'#cfacc0');text(c,t&&t.modelVersion===2?(row?.cancerCount||0)+' / '+unitCounts[t.size]+' units':t?'Not tracked in older trials':'0 units',897,462,20,'#f1a7c0');
    text(c,t&&(!t.timeline)?'Older record · final count only':playing?'Playing saved division events':t?'Playback paused / complete':'No trial data yet',897,489,10,'#7c9f8e');
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
    if(t.timeline)for(const row of t.timeline)if(row.newCancerCells?.length){const x=x0+(x1-x0)*(row.year-20)/Math.max(1,maxAge-20);oval(c,x,y0+3,2.5,2.5,'#ed8eb2');}
    text(c,'20',x0,y0+20,10,'#a8bba9','center');text(c,maxAge,x1,y0+20,10,'#a8bba9','center');text(c,'modeled age →    • magenta marks a first cancer-state event',580,y0+20,10,'#84a590','center');
  }
  function draw(){c.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);c.clearRect(0,0,W,H);background();body();tissue();metrics();timeline();}
  // #growth-tip is a status region: refresh it on inspect, pause, scrub or completion, never on every playback frame.
  function refreshTip(){const tip=document.getElementById('growth-tip');if(tip&&!tip.hidden){tip.textContent=unitDescription(selected);placeTip();}}
  // Keep the inspector tip inside the drawing, below the canvas's own header strip (y 0-47 of 650) and so also below
  // the "Enlarge model" / "Close enlarged model" button above the canvas, in both the inline and the enlarged view.
  function placeTip(){
    const tip=document.getElementById('growth-tip');if(!tip||tip.hidden)return;
    const stage=canvas.offsetParent||canvas.parentElement,h=canvas.offsetHeight,w=canvas.offsetWidth;
    tip.style.top=Math.round(canvas.offsetTop+h*58/H)+'px';
    const room=(stage?stage.clientWidth:w)-tip.offsetWidth-8;
    tip.style.left=Math.round(Math.max(8,Math.min(canvas.offsetLeft+w*.31,room)))+'px';
  }
  function showTip(index){const tip=document.getElementById('growth-tip');tip.textContent=unitDescription(index);tip.hidden=false;placeTip();}
  function emit(type){const t=currentTrial();canvas.dispatchEvent(new CustomEvent('growth-playback',{detail:{type:type,playing:playing,only:only,trials:recordings.length,year:Math.floor(year),target:t?.age||settings.age,trial:trialIndex+1,divisions:currentRow()?.cumulative||0,cancerCount:currentRow()?.cancerCount||0,hasCancerState:t?.modelVersion===2,hasHistory:Array.isArray(t?.timeline)}}));}
  function animate(time){
    frameId=0;
    if(!visible||document.hidden){previous=0;return;}
    if(playing){
      if(previous)elapsed+=Math.min(100,time-previous);previous=time;
      const t=currentTrial(),duration=4200,progress=Math.min(1,elapsed/duration),span=t.age-20;
      year=20+Math.floor(span*progress);fraction=span*progress-Math.floor(span*progress);
      if(time-lastFrame>70){draw();emit('tick');lastFrame=time;}
      if(progress>=1){if(!only&&trialIndex<recordings.length-1){trialIndex++;elapsed=0;year=20;}else{playing=false;year=t.age;draw();refreshTip();emit('complete');}}
    }
    if(playing)frameId=requestAnimationFrame(animate);
  }
  function schedule(){if(!frameId&&playing)frameId=requestAnimationFrame(animate);}
  function configure(s){settings=s;recordings=[];trialIndex=0;only=false;playing=false;year=20;fraction=0;previous=0;draw();refreshTip();emit('settings');}
  // play(trials) plays every trial of a set in turn; play(trials,{start:k,only:true}) replays trial k on its own.
  function play(trials,opts){opts=opts||{};only=!!opts.only;recordings=trials;trialIndex=Math.max(0,Math.min(trials.length-1,opts.start||0));elapsed=0;previous=0;year=20;fraction=0;playing=true;
    if(reduce||trials.every(t=>t.age===20)||trials.some(t=>!Array.isArray(t.timeline))){if(!only)trialIndex=trials.length-1;year=trials[trialIndex].age;playing=false;draw();refreshTip();emit('complete');return;}
    draw();emit('start');schedule();
  }
  function pause(){playing=!playing;if(playing&&year>=currentTrial().age){elapsed=0;year=20;}previous=0;if(!playing)refreshTip();emit('pause');schedule();}
  // Load trial `index` of a set, paused at age `atYear`, with cell unit `unit` selected and described in the inspector.
  function inspectAt(trials,index,atYear,unit){
    recordings=trials;trialIndex=Math.max(0,Math.min(trials.length-1,index));only=true;playing=false;previous=0;
    const t=currentTrial();year=Math.max(20,Math.min(t.age,atYear));elapsed=(year-20)/Math.max(1,t.age-20)*4200;fraction=.5;
    selected=Math.max(0,unit|0);draw();showTip(selected);emit('scrub');
  }
  function scrub(value){if(!recordings.length)return;playing=false;year=Math.max(20,Math.min(currentTrial().age,value));elapsed=(year-20)/Math.max(1,currentTrial().age-20)*4200;fraction=.5;previous=0;draw();refreshTip();emit('scrub');}
  function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.width*H/W*dpr));draw();drawChart(groups);drawChanges(groups);placeTip();}
  function drawChart(data){
    groups=data;const last=data.slice(-8),ctx=chart.getContext('2d'),height=Math.max(280,92+last.length*67),rect=chart.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    chart.style.aspectRatio=W+' / '+height;chart.width=Math.max(1,Math.round((rect.width||W)*dpr));chart.height=Math.max(1,Math.round((rect.width||W)*height/W*dpr));ctx.setTransform(chart.width/W,0,0,chart.height/height,0,0);
    ctx.fillStyle='#13272d';ctx.fillRect(0,0,W,height);text(ctx,'RECORDED DIVISIONS / THREE TRIALS PER SET',28,32,12,'#b2cbbd');
    if(!last.length){text(ctx,'Run a set, change one setting, then compare the patterns.',W/2,145,18,'#91b5a5','center');return;}
    const max=Math.max(1,...last.flatMap(g=>g.trials.map(t=>t.divisions))),nice=Math.max(5,Math.ceil(max/5/10)*10),axisMax=nice*5,x0=355,x1=1100;
    for(let i=0;i<=5;i++){const x=x0+i/5*(x1-x0);line(ctx,x,58,x,height-30,'#a0c5ae22');text(ctx,i*nice,x,height-12,11,'#8fac9b','center');}
    last.forEach((g,j)=>{const y=84+j*67,color=palette[(g.index-1)%palette.length];text(ctx,'SET '+g.index,28,y,12,color);text(ctx,'Age '+g.age+' · '+unitCounts[g.size]+' units · '+profile(g.tissue).short,28,y+19,12,'#a7beaf');
      const vals=g.trials.map(t=>t.divisions),lo=Math.min(...vals),hi=Math.max(...vals),mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      const scale=v=>x0+v/axisMax*(x1-x0);line(ctx,scale(lo),y,scale(hi),y,color+'77',2);
      vals.forEach((v,k)=>oval(ctx,scale(v),y+(k-1)*8,5.5,5.5,color+'b0',color,1));line(ctx,scale(mean),y-16,scale(mean),y+16,'#eff9de',2);const label='mean '+mean.toFixed(1);ctx.font='500 11px sans-serif';const labelWidth=ctx.measureText(label).width,labelX=Math.max(x0+5,Math.min(x1-labelWidth-5,scale(mean)-labelWidth/2));ctx.fillStyle='#13272d';ctx.fillRect(labelX-4,y-37,labelWidth+8,17);text(ctx,label,labelX,y-24,11,'#d9e7d0');
    });
  }
  /* Divisions against control changes (mutations), one marker per trial. Each set has its own colour AND marker shape
     (circle, square, triangle, diamond), and its mean is a ringed marker labelled with the set number, so colour is never the
     only cue. Trials saved before control changes were counted are left out. The same numbers are in the data table. */
  function marker(ctx,shape,x,y,r,fill,stroke,width){
    ctx.beginPath();
    if(shape===0)ctx.arc(x,y,r,0,Math.PI*2);
    else if(shape===1)ctx.rect(x-r*.85,y-r*.85,r*1.7,r*1.7);
    else if(shape===2){ctx.moveTo(x,y-r*1.1);ctx.lineTo(x+r,y+r*.8);ctx.lineTo(x-r,y+r*.8);ctx.closePath();}
    else{ctx.moveTo(x,y-r*1.15);ctx.lineTo(x+r*1.15,y);ctx.lineTo(x,y+r*1.15);ctx.lineTo(x-r*1.15,y);ctx.closePath();}
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width||1;ctx.stroke();}
  }
  function niceStep(max,ticks){const raw=Math.max(1,max)/ticks,pow=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/pow;return (f<=1?1:f<=2?2:f<=5?5:10)*pow;}
  function drawChanges(data){
    if(!chart2)return;
    const ctx=chart2.getContext('2d'),H2=430,rect=chart2.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
    chart2.style.aspectRatio=W+' / '+H2;chart2.width=Math.max(1,Math.round((rect.width||W)*dpr));chart2.height=Math.max(1,Math.round((rect.width||W)*H2/W*dpr));ctx.setTransform(chart2.width/W,0,0,chart2.height/H2,0,0);
    ctx.fillStyle='#13272d';ctx.fillRect(0,0,W,H2);text(ctx,'DIVISIONS AGAINST CONTROL CHANGES (MUTATIONS) · ONE MARKER PER TRIAL',28,30,12,'#b2cbbd');
    const sets=(data||[]).slice(-8).map(g=>({g:g,pts:g.trials.map((t,k)=>({x:t.divisions,y:g.changes?g.changes[k]:null})).filter(p=>Number.isFinite(p.y))})).filter(o=>o.pts.length);
    if(!sets.length){text(ctx,'Run a set to compare divisions with control changes.',W/2,215,18,'#91b5a5','center');return;}
    const all=sets.flatMap(o=>o.pts),xs=Math.max(1,...all.map(p=>p.x)),ys=Math.max(1,...all.map(p=>p.y));
    const sx=niceStep(xs,6),sy=niceStep(ys,5),xMax=Math.ceil(xs/sx)*sx||sx,yMax=Math.ceil(ys/sy)*sy||sy,x0=120,x1=1110,y0=64,y1=346;
    const px=v=>x0+v/xMax*(x1-x0),py=v=>y1-v/yMax*(y1-y0);
    for(let v=0;v<=yMax+1e-9;v+=sy){line(ctx,x0,py(v),x1,py(v),'#a0c5ae22');text(ctx,v,x0-10,py(v)+4,11,'#8fac9b','right');}
    for(let v=0;v<=xMax+1e-9;v+=sx){line(ctx,px(v),y0,px(v),y1,'#a0c5ae14');text(ctx,v,px(v),y1+18,11,'#8fac9b','center');}
    line(ctx,x0,y1,x1,y1,'#8fac9b',1.5);line(ctx,x0,y0,x0,y1,'#8fac9b',1.5);
    text(ctx,'Divisions per trial (count)',(x0+x1)/2,y1+40,12,'#b2cbbd','center');
    ctx.save();ctx.translate(34,(y0+y1)/2);ctx.rotate(-Math.PI/2);text(ctx,'Control changes (mutations) per trial (count)',0,0,12,'#b2cbbd','center');ctx.restore();
    sets.forEach(o=>{const shape=(o.g.index-1)%4,color=palette[(o.g.index-1)%palette.length];
      o.pts.forEach(p=>{ctx.globalAlpha=.8;marker(ctx,shape,px(p.x),py(p.y),6.5,color+'cc',color,1.2);ctx.globalAlpha=1;});
      const mx=o.pts.reduce((a,p)=>a+p.x,0)/o.pts.length,my=o.pts.reduce((a,p)=>a+p.y,0)/o.pts.length;
      marker(ctx,shape,px(mx),py(my),11,null,'#eff9de',2.4);text(ctx,o.g.index,px(mx)+15,py(my)-12,12,'#eff9de','left',700);});
    let lx=x0;sets.forEach(o=>{const shape=(o.g.index-1)%4,color=palette[(o.g.index-1)%palette.length],label='Set '+o.g.index;marker(ctx,shape,lx+6,H2-14,5.5,color+'cc',color,1);text(ctx,label,lx+16,H2-10,11,'#a7beaf');lx+=Math.max(66,ctx.measureText(label).width+40);});
    text(ctx,'Ringed marker = set mean',x1,H2-10,11,'#a7beaf','right');
  }
  function unitDescription(index){
    const t=currentTrial(),row=currentRow(),count=t?.timeline?t.timeline.filter(r=>r.year<=year&&r.cells.includes(index)).length:null,mask=row?.changes?.[index]||0;
    const names=window.GrowthCellTypes.changes.filter((_,bit)=>mask&(1<<bit));
    if(t&&t.modelVersion!==2)return profile(t.tissue).short+' · unit '+(index+1)+(count===null?'':' · '+plural(count,'recorded division')+'.')+' Control changes and cancerous state were not tracked in this older trial.';
    const chance=mask===7?.80:profile(t?.tissue||settings.tissue).rate;
    const rateText=' Modeled division chance next year: '+Number((chance*100).toFixed(1))+'% (invented teaching value; a chance, not a guaranteed division).';
    const eventText=row?' Recorded division at age '+Math.floor(year)+': '+(row.cells.includes(index)?'yes; split nuclei mark this event.':'no.') : '';
    return profile(t?.tissue||settings.tissue).short+' · unit '+(index+1)+(count===null?' · Run a trial to record its history.':' · '+plural(count,'division')+' by age '+Math.floor(year)+'. ')+(count===null?'':names.length?'Control changes: '+names.join('; ')+'. '+(mask===7?'Cancerous state in this teaching model.':'Not cancerous in this model.'):'No modeled control change recorded.')+rateText+eventText;
  }
  function inspect(event){const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*W/r.width-627,y=(event.clientY-r.top)*H/r.height-283,tip=document.getElementById('growth-tip');if(Math.hypot(x,y)>184){tip.hidden=true;return;}
    selected=units.reduce((best,p,i)=>Math.hypot(p.x-x,p.y-y)<Math.hypot(units[best].x-x,units[best].y-y)?i:best,0);const t=currentTrial(),count=t?.timeline?t.timeline.filter(row=>row.year<=year&&row.cells.includes(selected)).length:null;
    showTip(selected);draw();}
  canvas.addEventListener('pointerdown',inspect);canvas.addEventListener('pointerleave',()=>{document.getElementById('growth-tip').hidden=true;});
  canvas.addEventListener('keydown',function(event){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();selected=event.key==='Home'?0:event.key==='End'?units.length-1:(selected+(event.key==='ArrowRight'?1:-1)+units.length)%units.length;
    const t=currentTrial(),count=t?.timeline?t.timeline.filter(row=>row.year<=year&&row.cells.includes(selected)).length:null,tip=document.getElementById('growth-tip');
    showTip(selected);draw();
  });
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(es=>{visible=es[0].isIntersecting;previous=0;if(visible)schedule();},{rootMargin:'150px'}).observe(canvas);
  document.addEventListener('visibilitychange',()=>{previous=0;if(!document.hidden)schedule();});
  window.GrowthModelScene={configure:configure,play:play,pause:pause,scrub:scrub,chart:drawChart,changesChart:drawChanges,inspectAt:inspectAt,placeTip:placeTip};
})();
