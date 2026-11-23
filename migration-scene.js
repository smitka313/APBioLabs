/* Original canvas artwork. Geography is schematic; trees, weather, herds and
 * seasonal color are illustrations, never observations, counts or biomass. */
(function () {
  'use strict';
  const L=window.MigrationLogic;
  function rng(seed){return()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
  const rand=rng(1403), textures=Array.from({length:1600},()=>({x:rand()*1000,y:rand()*660,r:rand()*3+.4,a:rand()*.12}));
  const herd=Array.from({length:72},()=>({x:(rand()+rand()+rand()-1.5)*62,y:(rand()+rand()-1)*40,s:.1+rand()*.04,phase:rand()*Math.PI*2}));
  const trees=Array.from({length:75},()=>({x:210+rand()*550,y:125+rand()*260,s:.22+rand()*.35}));
  const grasses=Array.from({length:220},()=>({x:rand()*1000,y:420+rand()*240,h:5+rand()*14}));
  function path(c,points,close=true){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));if(close)c.closePath();}
  function ellipse(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);c.fillStyle=fill;c.fill();}
  function acacia(c,x,y,s){c.save();c.translate(x,y);c.scale(s,s);ellipse(c,10,10,55,12,'#243a2626');c.strokeStyle='#53442c';c.lineWidth=5;c.beginPath();c.moveTo(0,0);c.lineTo(-2,-44);c.moveTo(-2,-22);c.lineTo(-25,-50);c.moveTo(-2,-30);c.lineTo(25,-60);c.stroke();ellipse(c,-25,-54,33,10,'#526543');ellipse(c,13,-64,47,12,'#354e38');ellipse(c,29,-66,32,9,'#63774b');ellipse(c,-15,-63,36,9,'#6f7e4d');c.restore();}
  // Western white-bearded wildebeest: high shoulder, sloping back, slim hindquarters,
  // dark mane, beard, curved paired horns and pale muzzle; no cartoon substitutions.
  function wildebeest(c,x,y,s,phase=0,flip=false){
    c.save();c.translate(x,y);c.scale(flip?-s:s,s);ellipse(c,0,8,58,10,'#1c281c30');
    c.strokeStyle='#30312b';c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(42,-30);c.bezierCurveTo(65,-40,58,-8,68,-6);c.stroke();
    const sw=Math.sin(phase)*5;
    c.strokeStyle='#3e3c32';c.lineWidth=6;c.beginPath();c.moveTo(-29,-24);c.lineTo(-28+sw,1);c.lineTo(-34+sw,13);c.moveTo(31,-22);c.lineTo(28-sw,-1);c.lineTo(37-sw,12);c.stroke();
    const g=c.createLinearGradient(0,-66,0,-8);g.addColorStop(0,'#9c8c71');g.addColorStop(.35,'#756c59');g.addColorStop(1,'#454a40');c.fillStyle=g;c.beginPath();c.moveTo(-50,-52);c.bezierCurveTo(-42,-72,-18,-64,-3,-56);c.bezierCurveTo(10,-49,36,-55,46,-38);c.bezierCurveTo(50,-16,31,-11,10,-17);c.lineTo(-27,-26);c.lineTo(-48,-15);c.lineTo(-62,-33);c.closePath();c.fill();
    c.strokeStyle='#252d29';c.lineWidth=3;c.beginPath();c.moveTo(-29,-30);c.lineTo(-36,-1);c.lineTo(-41+sw,13);c.moveTo(34,-26);c.lineTo(39,-4);c.lineTo(44-sw,12);c.stroke();
    c.fillStyle='#303830';c.beginPath();c.moveTo(-48,-57);c.lineTo(-64,-55);c.lineTo(-72,-24);c.quadraticCurveTo(-68,-15,-56,-21);c.lineTo(-48,-30);c.lineTo(-40,-49);c.closePath();c.fill();
    c.fillStyle='#b6ad8b';c.beginPath();c.moveTo(-73,-28);c.quadraticCurveTo(-82,-19,-70,-17);c.lineTo(-58,-20);c.lineTo(-60,-29);c.fill();
    c.fillStyle='#252c27';c.beginPath();c.moveTo(-54,-25);c.lineTo(-47,-13);c.lineTo(-40,-34);c.fill();
    c.strokeStyle='#34392e';c.lineWidth=2;c.beginPath();for(let i=0;i<7;i++){c.moveTo(-40+i*5,-60+i*1.3);c.lineTo(-36+i*5,-47+i*2);}c.stroke();
    c.strokeStyle='#d8cba5';c.lineWidth=3;c.beginPath();c.moveTo(-58,-52);c.bezierCurveTo(-80,-55,-82,-65,-78,-72);c.moveTo(-57,-51);c.bezierCurveTo(-45,-55,-39,-65,-42,-70);c.stroke();
    ellipse(c,-61,-40,1.3,1.3,'#e6d9b1');ellipse(c,-60.6,-40, .7,.9,'#18271d');
    c.fillStyle='#3b4436';c.beginPath();c.moveTo(-50,-51);c.lineTo(-37,-55);c.lineTo(-42,-46);c.fill();c.restore();
  }
  function cloud(c,x,y,s,t,wet){c.save();c.translate(x,y);c.scale(s,s);c.shadowColor='#172d2530';c.shadowBlur=15;ellipse(c,0,0,44,12,'#f7f6e6d9');ellipse(c,-20,-9,24,16,'#f7f6e6d9');ellipse(c,11,-15,31,21,'#f7f6e6d9');c.shadowBlur=0;if(wet){c.strokeStyle='#47777c99';c.lineWidth=2;for(let i=0;i<8;i++){let a=-30+i*9,b=17+((t*28+i*11)%32);c.beginPath();c.moveTo(a,b);c.lineTo(a-4,b+7);c.stroke();}}c.restore();}
  function init(map,field,wrap){
    let month=0,weather=true,region='south',time=0,raf=0,dirty=true,staticMap=document.createElement('canvas');
    let reduced=matchMedia('(prefers-reduced-motion: reduce)'),oldPos=L.POSITIONS[0].slice(),startPos=oldPos.slice(),transition=1,last=0,visible=true;
    const mc=map.getContext('2d'),fc=field.getContext('2d');
    function resize(){for(const cv of [map,field]){const r=cv.getBoundingClientRect();if(!r.width||!r.height)continue;const d=Math.min(window.devicePixelRatio||1,2);cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);}dirty=true;draw();}
    function background(){const w=map.width,h=map.height;cSize(staticMap,w,h);const c=staticMap.getContext('2d');c.fillStyle='#d9d1b0';c.fillRect(0,0,w,h);const s=Math.min(w/1000,h/660),tx=(w-1000*s)/2,ty=(h-660*s)/2;c.save();c.translate(tx,ty);c.scale(s,s);
      const wet=L.isWetSeason(month);const g=c.createLinearGradient(130,40,800,650);g.addColorStop(0,'#9cae85');g.addColorStop(.45,wet&&weather?'#aeb988':'#c4b87d');g.addColorStop(1,wet&&weather?'#c4c28b':'#dfc58b');c.fillStyle=g;c.fillRect(-400,-200,1800,1000);
      // Shaded terrain, broad valleys and contour strokes.
      for(let j=0;j<12;j++){c.strokeStyle='#f7f1d325';c.lineWidth=12-j*.7;c.beginPath();c.moveTo(160+j*11,30);c.bezierCurveTo(740,80,710,190+j*8,870,430+j*20);c.stroke();}
      for(const t of textures){ellipse(c,t.x,t.y,t.r,t.r*.45,`rgba(71,78,42,${t.a})`);}
      // Lake Victoria lies west / northwest, beyond the ecosystem.
      c.fillStyle='#6a9a9c';path(c,[[-100,-50],[148,-50],[143,50],[124,95],[160,142],[135,184],[173,204],[154,246],[175,277],[140,327],[160,380],[110,413],[120,465],[-100,500]]);c.fill();c.strokeStyle='#d6e3c380';c.lineWidth=5;c.stroke();
      for(let i=0;i<20;i++){c.strokeStyle='#c8e3d63a';c.lineWidth=1;c.beginPath();c.moveTo(7+i*2,40+i*20);c.lineTo(75+i*2,44+i*20);c.stroke();}
      // Broad pale ecosystem footprint, an illustrative outline, not park boundaries.
      c.fillStyle='#f5e7b91a';c.strokeStyle='#5d705565';c.lineWidth=1.7;path(c,[[484,41],[582,83],[607,151],[777,241],[720,298],[760,399],[730,559],[598,611],[422,571],[412,439],[338,380],[201,351],[187,302],[358,269],[425,189],[434,106]]);c.fill();c.setLineDash([4,6]);c.stroke();c.setLineDash([]);
      // Rivers are schematic, the Mara is north of the Grumeti.
      c.strokeStyle='#719d9b';c.lineWidth=6;c.lineCap='round';c.beginPath();c.moveTo(155,144);c.bezierCurveTo(230,167,274,151,330,174);c.bezierCurveTo(400,205,460,143,511,172);c.bezierCurveTo(590,205,611,172,680,186);c.stroke();c.strokeStyle='#abd0bd';c.lineWidth=2;c.stroke();
      c.strokeStyle='#789e94';c.lineWidth=4;c.beginPath();c.moveTo(175,298);c.bezierCurveTo(288,282,328,323,410,288);c.bezierCurveTo(460,265,490,281,560,245);c.stroke();
      c.strokeStyle='#736d4f88';c.lineWidth=1.3;c.setLineDash([6,7]);c.beginPath();c.moveTo(400,34);c.lineTo(826,266);c.stroke();c.setLineDash([]);
      for(const t of trees)acacia(c,t.x,t.y,t.s);
      // Eastern escarpment and granite kopjes; shadows and lighter ridges.
      for(let i=0;i<12;i++){const x=690+i*5,y=340+i*16;ellipse(c,x+6,y+6,20,10,'#645b4230');ellipse(c,x,y,17,9,'#9e9775');ellipse(c,x-5,y-3,10,5,'#c4b997');}
      // A route connecting the monthly broad ranges, with no invented distance scale.
      c.strokeStyle='#fff5d8c0';c.lineWidth=5;c.beginPath();L.POSITIONS.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.stroke();c.strokeStyle='#695a3b';c.lineWidth=1.7;c.setLineDash([4,8]);c.stroke();c.setLineDash([]);
      c.font='600 13px system-ui';c.fillStyle='#294b43';c.fillText('LAKE',30,230);c.fillText('VICTORIA',30,248);c.save();c.translate(289,145);c.rotate(.08);c.fillText('Mara River',0,0);c.restore();c.fillText('Grumeti River',220,340);c.font='600 12px system-ui';c.fillStyle='#43583f';c.fillText('KENYA',680,115);c.fillText('TANZANIA',810,315);c.font='italic 15px Georgia';c.fillStyle='#49583d';c.fillText('Maasai Mara',570,75);c.fillText('Southern short-grass plains',470,591);
      // North arrow and inset ecosystem locator.
      c.save();c.translate(912,75);c.fillStyle='#304c3e';path(c,[[0,-23],[-7,8],[0,2],[7,8]]);c.fill();c.font='700 13px system-ui';c.textAlign='center';c.fillText('N',0,-31);c.restore();
      c.restore();dirty=false;
      const r=map.getBoundingClientRect(),sr=Math.min(r.width/1000,r.height/660),ox=(r.width-sr*1000)/2,oy=(r.height-sr*660)/2;
      const pins={north:[610,140],west:[243,235],south:[740,497]};
      wrap.querySelectorAll('[data-region]').forEach(b=>{const p=pins[b.dataset.region];b.style.left=(ox+p[0]*sr)+'px';b.style.top=(oy+p[1]*sr)+'px';b.setAttribute('aria-pressed',String(b.dataset.region===region));});
    }
    function cSize(c,w,h){if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;}
    function drawMap(){if(!map.width)return;if(dirty)background();mc.drawImage(staticMap,0,0);const s=Math.min(map.width/1000,map.height/660),tx=(map.width-1000*s)/2,ty=(map.height-660*s)/2;mc.save();mc.translate(tx,ty);mc.scale(s,s);
      const goal=L.POSITIONS[month],ease=1-Math.pow(1-transition,3);oldPos=[startPos[0]+(goal[0]-startPos[0])*ease,startPos[1]+(goal[1]-startPos[1])*ease];
      const haze=mc.createRadialGradient(oldPos[0],oldPos[1],0,oldPos[0],oldPos[1],93);haze.addColorStop(0,'#b55f2d60');haze.addColorStop(.7,'#b55f2d2a');haze.addColorStop(1,'#b55f2d00');mc.fillStyle=haze;mc.fillRect(oldPos[0]-100,oldPos[1]-100,200,200);
      mc.strokeStyle='#8c4a2b80';mc.lineWidth=1.5;mc.beginPath();mc.ellipse(oldPos[0],oldPos[1],76,46,-.3,0,Math.PI*2);mc.stroke();
      herd.forEach((a,i)=>wildebeest(mc,oldPos[0]+a.x+Math.sin(time*.3+a.phase)*2,oldPos[1]+a.y,a.s,time*2+a.phase,month>=9||month<3));
      mc.fillStyle='#f7efd5';mc.strokeStyle='#794427';mc.lineWidth=1.5;mc.beginPath();mc.arc(goal[0]+48,goal[1]-43,16,0,Math.PI*2);mc.fill();mc.stroke();mc.fillStyle='#67432b';mc.font='700 12px system-ui';mc.textAlign='center';mc.fillText(month>=4&&month<=9?String(month-3):L.MONTHS[month].slice(0,3),goal[0]+48,goal[1]-39);mc.textAlign='left';
      if(weather){const wet=L.isWetSeason(month);cloud(mc,520+Math.sin(time*.12)*8,80,.6,time,true);if(wet){cloud(mc,690,480,.7,time,true);cloud(mc,470,430,.55,time+5,true);}else cloud(mc,330,230,.5,time,false);}
      mc.restore();
    }
    function drawField(){if(!field.width)return;const c=fc,w=field.width,h=field.height,s=w/1000;c.save();c.scale(s,h/660);const fieldRegion=L.fieldRegion(month),south=fieldRegion==='south',wet=L.isWetSeason(month);const green=weather&&wet;let sky=c.createLinearGradient(0,0,0,460);sky.addColorStop(0,'#80aaa9');sky.addColorStop(1,'#ebdfb5');c.fillStyle=sky;c.fillRect(0,0,1000,660);ellipse(c,795,115,48,48,'#fff3caaa');
      c.fillStyle='#849478';c.beginPath();c.moveTo(0,340);c.bezierCurveTo(160,230,280,340,420,290);c.bezierCurveTo(600,245,730,325,1000,245);c.lineTo(1000,660);c.lineTo(0,660);c.fill();
      const g=c.createLinearGradient(0,360,0,660);g.addColorStop(0,green?'#a9ad70':'#bcb17d');g.addColorStop(1,green?'#748550':'#a18c53');c.fillStyle=g;c.fillRect(0,380,1000,280);
      if(!south){acacia(c,180,395,1.8);acacia(c,820,380,1.1);acacia(c,660,345,.6);}
      if(fieldRegion==='north'){c.strokeStyle='#83a6a1';c.lineWidth=36;c.beginPath();c.moveTo(-30,445);c.bezierCurveTo(370,355,550,535,1060,410);c.stroke();c.strokeStyle='#c4d7bc';c.lineWidth=2;c.beginPath();c.moveTo(20,430);c.lineTo(130,427);c.moveTo(650,450);c.lineTo(760,443);c.stroke();}
      for(let i=0;i<16;i++)wildebeest(c,55+i*58,400+Math.sin(i*3)*24,.2+i*.005,time*2+i,month>8);
      wildebeest(c,590,565,1.6,time*2.5,month>8);wildebeest(c,245,510,.88,time*2+3,month>8);wildebeest(c,850,480,.59,time*2+1,month>8);
      c.lineWidth=2;for(const a of grasses){c.strokeStyle=green?'#53643e70':'#79663e80';c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo(a.x-4,a.y-a.h,a.x+Math.sin(time+a.x)*2,a.y-a.h*(south?.6:1.5));c.stroke();}
      if(weather&&wet)cloud(c,230,120,1.8,time,true);
      // A few distant birds with slow wingbeats.
      c.strokeStyle='#425b50';c.lineWidth=2;for(let i=0;i<3;i++){let x=(time*4+i*35+450)%1200-100,y=120+i*18;c.beginPath();c.moveTo(x-8,y+Math.sin(time+i)*3);c.quadraticCurveTo(x-4,y-4,x,y);c.quadraticCurveTo(x+4,y-4,x+8,y+Math.sin(time+i)*3);c.stroke();}c.restore();
    }
    function draw(){drawMap();drawField();}
    function frame(ts){raf=0;if(document.hidden||!visible||reduced.matches)return;const dt=Math.min(.04,(ts-last)/1000||0);last=ts;time+=dt;transition=Math.min(1,transition+dt*1.25);draw();raf=requestAnimationFrame(frame);}
    function animate(){if(!raf&&!reduced.matches&&!document.hidden&&visible){last=performance.now();raf=requestAnimationFrame(frame);}else if(reduced.matches)draw();}
    function halt(){cancelAnimationFrame(raf);raf=0;}
    new ResizeObserver(resize).observe(map);new ResizeObserver(resize).observe(field);
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)animate();else halt();});observer.observe(map);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();else animate();});
    reduced.addEventListener('change',()=>{if(reduced.matches){halt();transition=1;draw();}else animate();});
    new MutationObserver(()=>{dirty=true;draw();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    resize();animate();
    return {set(m,opts={}){if(m!==month){startPos=oldPos.slice();transition=reduced.matches?1:0;month=m;dirty=true;}if(typeof opts.weather==='boolean'&&opts.weather!==weather){weather=opts.weather;dirty=true;}if(opts.region&&opts.region!==region){region=opts.region;dirty=true;}draw();animate();},resize,pause:halt,redraw(){dirty=true;draw();}};
  }
  window.MigrationScene={init,wildebeest};
})();
