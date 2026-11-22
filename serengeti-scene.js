/* Original vector illustration and independently encoded board for the B.1 Lesson 7 companion.
   Rules geometry based on OpenSciEd, Lesson 7 Teacher Reference 3, Serengeti Game Board.
   Coordinates are zero-based, west to east then north to south. Arrays below are inclusive runs. */
(function (root) {
  'use strict';

  const COLS = 17, ROWS = 21;
  const GRAZING = [
    [[13,12,14],[14,11,14],[15,10,13],[16,9,14],[17,9,13],[18,9,13],[19,9,13],[20,9,13]],
    [[10,4,9],[11,5,10],[12,4,11],[13,5,10],[14,5,9],[15,5,8],[16,6,6]],
    [[5,9,10],[6,1,2],[6,9,10],[7,0,11],[8,1,11],[9,3,3]],
    [[0,10,12],[1,9,13],[2,9,14],[3,10,15],[4,11,15],[5,12,16],[6,13,15],[7,13,16],
      [8,13,15],[9,13,15],[10,13,15],[11,13,15]]
  ];
  const TERRITORIES = {
    lion: [
      [1,10,11],[2,13,13],[3,12,13],[5,9,9],[5,12,13],[6,9,9],[6,13,13],[7,0,1],
      [8,4,5],[8,9,10],[9,5,5],[9,14,15],[10,9,9],[11,8,9],[11,15,15],[12,14,15],
      [13,8,9],[14,5,6],[16,11,12],[17,9,9],[17,12,12],[18,9,9]
    ],
    hyena: [
      [3,15,15],[4,9,11],[4,15,15],[5,15,15],[7,14,16],[8,2,2],[9,2,2],[10,2,2],
      [10,6,6],[10,11,14],[11,5,6],[11,12,12],[12,6,6],[13,13,13],[14,8,8],[14,11,13],
      [15,7,8],[15,12,12],[16,7,8],[20,10,11]
    ]
  };
  const squares = Array.from({length:ROWS}, (_,y) => Array.from({length:COLS}, (_,x) => ({x,y,season:null,territory:null})));
  const paint = (ranges, set) => ranges.forEach(([y, from, to]) => {
    for (let x=from; x<=to; x++) set(squares[y][x]);
  });
  GRAZING.forEach((ranges,season) => paint(ranges, cell => { cell.season=season; }));
  Object.entries(TERRITORIES).forEach(([species,ranges]) => paint(ranges, cell => { cell.territory=species; }));
  const BOARD = Object.freeze(squares.map(row=>Object.freeze(row.map(Object.freeze))));
  const api = {BOARD, COLS, ROWS, mount};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SerengetiScene = api;

  const UNIT=27, LEFT=31, TOP=30, WIDTH=521, HEIGHT=626;
  const MONTHS=['Dec–Feb','Mar–May','Jun–Aug','Sep–Nov'];
  const NAMES={wildebeest:'Wildebeest',lion:'Lion',hyena:'Spotted hyena'};
  const PALETTES=[
    ['#91aa63','#526931'],['#9bb080','#576b3e'],['#a7b586','#606b40'],['#8eac83','#476747']
  ];
  let nextId=0;
  const fmt=(x,y)=>(x+1)+', '+(y+1);
  const key=(x,y)=>x+':'+y;
  const cellLabel=({x,y,season,territory})=>fmt(x,y)
    +(season===null?', outside grazing regions':', Turn '+(season+1)+' grazing region')
    +(territory?', '+NAMES[territory]+' territory':'');
  const same=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y;
  const point=(x,y)=>[LEFT+x*UNIT,TOP+y*UNIT];
  const svgEl=(name,attrs)=>{
    const el=document.createElementNS('http://www.w3.org/2000/svg',name);
    for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
    return el;
  };

  function perimeter(matches) {
    return BOARD.flat().filter(matches).map(cell=>{
      const {x,y}=cell,[l,t]=point(x,y),r=l+UNIT,b=t+UNIT;
      return [[x,y-1,l,t,r,t],[x+1,y,r,t,r,b],[x,y+1,r,b,l,b],[x-1,y,l,b,l,t]]
        .filter(([nx,ny])=>!BOARD[ny]?.[nx]||!matches(BOARD[ny][nx]))
        .map(([, ,x1,y1,x2,y2])=>'M'+x1+' '+y1+'L'+x2+' '+y2).join('');
    }).join('');
  }

  function defs(id) {
    return `<defs>
      <linearGradient id="${id}-sand" x2=".82" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#f2dfb5"/><stop offset=".53" stop-color="#d7c195"/><stop offset="1" stop-color="#ad9063"/></linearGradient>
      <linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#eee5ca"/><stop offset="1" stop-color="#ebbb73"/></linearGradient>
      <linearGradient id="${id}-hide" x2="0" y2="1"><stop stop-color="#9a8063"/><stop offset="1" stop-color="#463a2d"/></linearGradient>
      <linearGradient id="${id}-lion-hide" x2="0" y2="1"><stop stop-color="#efc679"/><stop offset="1" stop-color="#a66832"/></linearGradient>
      <linearGradient id="${id}-hyena-hide" x2="0" y2="1"><stop stop-color="#c9ab7b"/><stop offset="1" stop-color="#74533e"/></linearGradient>
      <pattern id="${id}-sand-texture" x="0" y="0" width="37" height="39" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="13" r=".7" fill="#684e2e" opacity=".4"/><circle cx="27" cy="19" r=".5" fill="#684e2e" opacity=".4"/>
        <circle cx="10" cy="30" r=".5" fill="#fff7dc" opacity=".7"/><path d="M11 6l5 -2m4 29 4 -2m8 -25 2 -1" stroke="#7c6039" stroke-opacity=".14" stroke-width=".6"/>
      </pattern>
      <pattern id="${id}-grazing" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M-1 7L7 -1m0 6L5 7m0 -8L-1 5" fill="none" stroke="#354a2b" stroke-opacity=".24" stroke-width=".7"/></pattern>
      <pattern id="${id}-hyena" width="7" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#392a26" opacity=".52"/><circle cx="6" cy="6" r=".8" fill="#392a26" opacity=".6"/></pattern>
      <pattern id="${id}-lion" width="8" height="7" patternUnits="userSpaceOnUse"><path d="M2 2h4M0 5h2m4 0h2" stroke="#704014" stroke-opacity=".62" stroke-width=".75"/></pattern>
      <clipPath id="${id}-clip"><rect x="31" y="30" width="459" height="567"/></clipPath>
      <symbol id="${id}-wildebeest" viewBox="0 0 120 76">
        <path d="M25 34Q17 44 15 56L13 60 17 61Q22 56 21 50L28 37M68 39l7 13-1 17h-4l-2-15-9-10M35 39l-1 13-6 16h-4l4-17-1-12" fill="#453b32"/>
        <path d="M25 32Q31 22 46 23 58 16 76 19l11 7 7-2 8 7-3 10-6 5-9-5-8-10-8 12Q59 50 47 46L28 43Q24 42 25 32Z" fill="url(#${id}-hide)" stroke="#362d26" stroke-width="1.2"/>
        <path d="M25 36q-3-3-5 1-7 10-8 18l-4 4v4q9-3 9-8 3-10 8-13M41 43l-3 11 3 15h-6l-6-15 4-13M73 40l-1 13 5 16h-5l-8-15-1-10" fill="#514236" stroke="#3b3027" stroke-width=".8"/>
        <path d="M61 22q9-7 19-2l9 6-7 2-11-6zM76 31l8 14 2 9 3-4 2 2 1-10-10-15" fill="#302821"/>
        <path d="M82 28q11-4 14 2l4 9-6 5-7-7z" fill="#5e5041"/>
        <path d="M92 28q-9 3-13-2t0-11q0 8 7 9l6-1m2 4q10 0 13-6 1-4-2-7 8 3 7 8-2 7-12 9" stroke="#332b24" stroke-width="2.5" fill="#554b3a"/>
        <path d="M77 34l6-2m-22-6 1 10m4-11 1 9m4-9 1 6" stroke="#3a3028" stroke-width="1.1" fill="none" opacity=".8"/>
        <circle cx="94" cy="32.5" r="1.25" fill="#efd7a7"/><circle cx="94.2" cy="32.4" r=".65" fill="#191715"/>
      </symbol>
      <symbol id="${id}-lion-icon" viewBox="0 0 120 76">
        <path d="M29 42Q12 46 8 33 5 24 11 20" fill="none" stroke="#9c6236" stroke-width="2.6"/><path d="M10 22q-4-2 2-8l3 2-2 5z" fill="#5b3b25"/>
        <path d="M43 42l-6 11 7 14h-6L29 53l5-12m37-1 2 14 2 12h-7l-2-12-4-12" fill="#a16a39"/>
        <path d="M25 40q0-13 16-13 10-1 20 1l21-3 7 17-17 7-7 18h-8l2-14 1-9q-9 9-23 4l-5 10 1 9h-8l-3-13z" fill="url(#${id}-lion-hide)" stroke="#71502e" stroke-width="1.2"/>
        <path d="M73 40q-2-10 2-14l6-7 7-2 9 4 7 8-6 4-1 7-7 11-6 4-8-8-5-8z" fill="#734225" stroke="#533522" stroke-width=".8"/>
        <path d="M82 25l11-3 10 4 7 7-4 6-10-1-7 3-5-4z" fill="#d6a45c"/>
        <path d="M85 26q-6-7 1-10 5 2 5 7M100 34l8-1" fill="#b88145" stroke="#5e3b24" stroke-width="1.15"/>
        <circle cx="99" cy="28.5" r="1.2" fill="#24211b"/>
      </symbol>
      <symbol id="${id}-hyena-icon" viewBox="0 0 120 76">
        <path d="M28 44l-6 12 2 12h-5l-3-12 6-13m44-4-3 13 5 16h-6l-8-16 4-12" fill="#71523c"/>
        <path d="M24 40q12-13 35-17 13-5 24-1l10 4 8 8-4 8-9 2-9-7-7 13 1 18h-6l-6-17-1-9q-10 8-27 7l-6 9 1 10h-6l-3-14z" fill="url(#${id}-hyena-hide)" stroke="#564030" stroke-width="1.2"/>
        <path d="M23 40q-7 5-10 16l-6 4 3 4q11-6 12-14l4-8" fill="#644634"/>
        <path d="M77 26q-3-6 1-10 6-2 8 6m2 2q0-8 7-6 4 5-1 10" fill="#967047" stroke="#664738" stroke-width="1.45"/>
        <path d="M93 33l8 1-3 8-7 1z" fill="#4e3a33"/>
        <path d="M35 39h0m9-4h0m7 7h0m3-11h0m7 6h0m7-8h0m-27 15h0m25-2h0m5-6h0m-5 14h0" stroke="#674831" stroke-width="3" stroke-linecap="round"/>
        <circle cx="92" cy="31" r="1.2" fill="#201d16"/>
      </symbol>
    </defs>`;
  }

  function landscape(id) {
    const tree=(x,y,s)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 36q3-17 5-28l2 1-3 17 1 10zm4-11L-8 12l2-2L5 19l6-9 2 2z" fill="#614e36"/><path d="M-24 12q-5-3 2-6 2-6 9-4 5-5 13-3 4-5 13-3 8-1 10 5 13 1 15 6 7 7-7 8l-24 1-24-2z" fill="#585c3b"/><path d="M-27 11q14-2 26 0l26-6 12 4" stroke="#898458" fill="none" stroke-width="1.5" opacity=".7"/></g>`;
    return `<g clip-path="url(#${id}-clip)">
      <path d="M31 31h245l-25 27-8 12-45 11-31 11-42-8-43 8-51-13z" fill="url(#${id}-sky)" opacity=".85"/>
      <circle cx="202" cy="59" r="16" fill="#efbf68" opacity=".84"/>
      <path d="M31 84l35-15 36-5 25 10 34 5 27 18 34-12 24 6-16 28-38-6-45-12-66 2-50 19z" fill="#ad8960" opacity=".48"/>
      <path d="M31 102l51-14 31 1 53 17 67 1-11 24-47-9-70 8-74-7z" fill="#847452" opacity=".42"/>
      <path d="M31 143q52-14 99-11t60 12l26 14-16 23-81-13-88 20z" fill="#ad925e" opacity=".44"/>
      ${tree(69,91,.98)}${tree(123,106,.54)}${tree(168,106,.32)}
      <g opacity=".84">
        <ellipse cx="108" cy="162" rx="44" ry="4" fill="#785f3c" opacity=".32"/><ellipse cx="177" cy="162" rx="27" ry="3" fill="#785f3c" opacity=".25"/>
        <use href="#${id}-wildebeest" x="54" y="111" width="109" height="61"/>
        <use href="#${id}-wildebeest" x="148" y="129" width="57" height="36"/>
      </g>
      <path d="M31 404q60-37 108-21l37 32-8 25-42-4-33 24-62 14z" fill="#937c57" opacity=".22"/>
      <g opacity=".78">
        <ellipse cx="92" cy="458" rx="39" ry="4" fill="#785f3c" opacity=".33"/>
        <use href="#${id}-lion-icon" x="46" y="402" width="100" height="65"/>
        <ellipse cx="138" cy="530" rx="41" ry="4" fill="#785f3c" opacity=".33"/>
        <use href="#${id}-hyena-icon" x="88" y="472" width="100" height="65"/>
      </g>
    </g>`;
  }

  function waterways() {
    const lines=[
      ['M47 57q29 2 49-1t31 8l14 1 14 11 18 3 27 3 20 10 20-3q11 0 24 4t29 3q34 3 41-18l24-22 8-26','Mara River',154,63],
      ['M109 242q15 20 38 16t44 0q19 7 44 0l19-4 28-15 13-6 10-23q12-16 28-17l17-3 17-13q20 8 49-3l34 1q25 0 34-16l7-13','Grumeti River',370,153]
    ];
    return lines.map(([d,label,x,y])=>`<path d="${d}" stroke="#eee2be" stroke-width="2.6" fill="none"/><path d="${d}" stroke="#477d88" stroke-width="1.1" fill="none"/><text x="${x}" y="${y}" fill="#294b53" class="sg-map-place sg-river">${label}</text>`).join('')
      +`<path d="M230 129q4 19 27 21l30-4 37 19 40 7q22 0 35 19l12 7q15 11 28 25 14 8 29 6l22 5" stroke="#994e3d" stroke-width="1.55" fill="none"/><path d="M351 164l16 3q22 0 35 19l12 8q15 10 27 26 13 7 29 5l19 5" stroke="#794c35" stroke-width="1.35" stroke-dasharray="3.2 2.1" fill="none"/>`;
  }

  function mount(host, options={}) {
    const id='sgboard-'+(++nextId), click=typeof options==='function'?options:options.onCell;
    const cancel=options.onCancel;
    const motion=typeof matchMedia==='function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    host.classList.add('sg-map-host');
    host.innerHTML=`<style>
      .sg-map-host{inline-size:100%;min-inline-size:0}
      .sg-map{display:block;inline-size:100%;max-inline-size:435px;block-size:auto;max-block-size:525px;margin-inline:auto;aspect-ratio:521/626;overflow:visible}
      .sg-map .sg-map-place{paint-order:stroke;stroke:#ead6ad;stroke-width:1.75;stroke-linejoin:round;font:italic 700 9.5px var(--font,system-ui,sans-serif);letter-spacing:.14px}
      .sg-map .sg-map-region{paint-order:stroke;stroke:#ead6ad;stroke-width:2.3;stroke-linejoin:round;font:700 11px var(--font,system-ui,sans-serif);letter-spacing:.9px}
      .sg-map .sg-map-turn{font:850 9px var(--font,system-ui,sans-serif);letter-spacing:.55px}
      .sg-map .sg-map-axis{font:750 8px var(--font,system-ui,sans-serif)}
      .sg-map .sg-map-hit{fill:transparent;outline:none;touch-action:manipulation}
      .sg-map .sg-map-hit[data-legal="true"]{cursor:pointer}
      .sg-map .sg-map-hit[data-legal="true"]:hover,.sg-map .sg-map-hit:focus-visible{fill:#fffef23c;stroke:#203d30;stroke-width:2;vector-effect:non-scaling-stroke}
      .sg-map .sg-map-hit[data-source="true"]:hover{fill:#fff4cf46}
      .sg-map [data-layer="tokens"],.sg-map [data-layer="selected"],.sg-map [data-layer="choices"]{pointer-events:none}
      .sg-map .sg-map-grazing{transition:opacity 160ms linear}
      @media (prefers-reduced-motion:reduce){.sg-map .sg-map-grazing{transition:none}}
    </style>`;
    const svg=svgEl('svg',{viewBox:`0 0 ${WIDTH} ${HEIGHT}`,class:'sg-map',role:'group',tabindex:'-1','aria-label':'Serengeti map and movement grid'});
    const cells=BOARD.flat();
    const backdrop=`<rect x="1" y="1" width="519" height="624" rx="15" fill="#f0ddb7" stroke="#9a8156" stroke-width="2"/>
      <rect x="8" y="8" width="505" height="610" rx="10" fill="none" stroke="#987c50" stroke-opacity=".43" stroke-width="1"/>
      <rect x="31" y="30" width="459" height="567" fill="url(#${id}-sand)"/><rect x="31" y="30" width="459" height="567" fill="url(#${id}-sand-texture)"/>`;
    const boundary=`<path d="M295 47l-40 46 8 31 31 39 12 51-4 28-12 19-39 5-14-8-14 9-39-8-26-12-32 2-11-7-33 14-50 6m450-154-17 62-2 67 14 46-17 47-7 67-19 51-25 32-5 26-32 26-12 58m-300-298 38 0 23 25 37 4 34 18 10 30 24 23 14 39 1 38-20 26-9 45-16 17m20-179 28 19 20 30 20 11 28 41 15 44 15 28" fill="none" stroke="#846745" opacity=".65" stroke-width="1.1" stroke-dasharray="3 2"/>`;
    const grazing=cells.filter(c=>c.season!==null).map(c=>{
      const [l,t]=point(c.x,c.y);
      return `<rect x="${l}" y="${t}" width="${UNIT}" height="${UNIT}" fill="${PALETTES[c.season][0]}" fill-opacity=".78"/><rect x="${l}" y="${t}" width="${UNIT}" height="${UNIT}" fill="url(#${id}-grazing)"/>`;
    }).join('');
    const territories=cells.filter(c=>c.territory).map(c=>{
      const [l,t]=point(c.x,c.y);
      return `<rect x="${l}" y="${t}" width="${UNIT}" height="${UNIT}" fill="${c.territory==='lion'?'#e5ac4b':'#aa836f'}" fill-opacity=".9"/><rect x="${l}" y="${t}" width="${UNIT}" height="${UNIT}" fill="url(#${id}-${c.territory})"/>`;
    }).join('');
    const grid=[...Array(COLS+1)].map((_,i)=>`M${LEFT+i*UNIT} ${TOP}v${ROWS*UNIT}`).join('')
      +[...Array(ROWS+1)].map((_,i)=>`M${LEFT} ${TOP+i*UNIT}h${COLS*UNIT}`).join('');
    const outlines=GRAZING.map((_,s)=>`<path class="sg-map-grazing" data-grazing="${s}" d="${perimeter(c=>c.season===s)}" fill="none" stroke="${PALETTES[s][1]}" stroke-width="2.3" stroke-linecap="square" stroke-linejoin="round" opacity=".8"/>`).join('');
    const cellAxes=Array.from({length:COLS},(_,x)=>`<text x="${LEFT+(x+.5)*UNIT}" y="23" text-anchor="middle">${x+1}</text>`).join('')
      +Array.from({length:ROWS},(_,y)=>`<text x="22" y="${TOP+(y+.5)*UNIT+2.5}" text-anchor="middle">${y+1}</text>`).join('');
    const turnLabels=[[290,608],[121,403],[62,184],[266,75]].map(([x,y],s)=>`
      <g data-turn="${s}" transform="translate(${x} ${y})"><rect x="-2" y="-9" width="77" height="13" rx="6.5" fill="#efe0bc" fill-opacity=".96" stroke="${PALETTES[s][1]}" stroke-width=".85"/><text x="36" y="0" text-anchor="middle" fill="#293326" class="sg-map-turn">TURN ${s+1} · ${MONTHS[s]}</text></g>`).join('');
    const placeLabels=`<g fill="#675139" class="sg-map-region">
      <text x="121" y="330">SERENGETI</text><text x="121" y="344">NATIONAL PARK</text>
      <text x="56" y="376" font-size="9" letter-spacing="1.4">T A N Z A N I A</text>
      <text x="367" y="56" fill="#46533b" font-size="9">MAASAI MARA</text>
      <text x="171" y="577" font-size="8.8">MASWA GAME</text><text x="173" y="588" font-size="8.8">RESERVE</text>
    </g>`;
    svg.innerHTML=defs(id)+`<g aria-hidden="true">${backdrop}${landscape(id)}${grazing}${territories}<g clip-path="url(#${id}-clip)">${boundary}${waterways()}</g>
      <path d="${grid}" stroke="#736247" stroke-width=".63" stroke-opacity=".44" fill="none"/>${outlines}${placeLabels}
      <g fill="#5d4a36" class="sg-map-axis">${cellAxes}</g>${turnLabels}
      <g transform="translate(56 558)" fill="#4b422d" stroke="#4b422d"><path d="M0 15V0m-4 7 4-7 4 7M-6 15h12" stroke-width=".9" fill="none"/><text x="0" y="-3" text-anchor="middle" font-size="7" font-weight="800" stroke="none">N</text></g>
      <g transform="translate(67 578)" stroke="#645039" fill="#645039"><path d="M0 -2v4m0-2h27m0-2v4" stroke-width=".9"/><text x="13.5" y="9" text-anchor="middle" font-size="7" stroke="none">6 miles</text></g>
      <g data-layer="choices"></g><g data-layer="tokens"></g><g data-layer="selected"></g></g>`;
    const targets=svgEl('g',{'aria-label':'Map squares'});
    const buttons=new Map();
    const choices=svg.querySelector('[data-layer="choices"]');
    const animals=svg.querySelector('[data-layer="tokens"]');
    const selected=svg.querySelector('[data-layer="selected"]');
    let legal=new Set(), sourceKeys=new Set(), destinationKeys=new Set(), focusKey=null;
    const tokenNodes=new Map();
    let previousStage;
    function activate(x,y) {
      const coord=key(x,y);
      if(!legal.has(coord)||typeof click!=='function')return;
      focusKey=coord;
      click(x,y);
    }
    function setRoving(coord,focus=false) {
      for(const [k,el] of buttons)el.setAttribute('tabindex',k===coord?'0':'-1');
      focusKey=coord;
      if(focus&&coord)buttons.get(coord)?.focus({preventScroll:true});
    }
    function keyAction(evt,x,y) {
      if(evt.key==='Escape'&&typeof cancel==='function'){
        // Leave Escape available to the fullscreen dialog's normal dismissal.
        if(svg.closest?.('dialog[open]'))return;
        cancel(); return;
      }
      if(evt.key==='Enter'||evt.key===' '){evt.preventDefault();activate(x,y);return;}
      const vectors={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if(!vectors[evt.key])return;
      evt.preventDefault();
      const [dx,dy]=vectors[evt.key];
      const candidates=cells.filter(c=>legal.has(key(c.x,c.y))&&
        (dx>0?c.x>x:dx<0?c.x<x:dy>0?c.y>y:c.y<y));
      const dist=c=>dx?Math.abs(c.y-y)*4+Math.abs(c.x-x):Math.abs(c.x-x)*4+Math.abs(c.y-y);
      candidates.sort((a,b)=>dist(a)-dist(b));
      if(candidates.length)setRoving(key(candidates[0].x,candidates[0].y),true);
    }
    for(const cell of cells) {
      const {x,y}=cell,[l,t]=point(x,y),k=key(x,y),label=cellLabel(cell);
      const btn=svgEl('rect',{x:l,y:t,width:UNIT,height:UNIT,class:'sg-map-hit',role:'button',
        tabindex:'-1','aria-disabled':'true','aria-label':label,'data-cell':k});
      btn.appendChild(svgEl('title',{})).textContent=label;
      btn.addEventListener('click',()=>activate(x,y));
      btn.addEventListener('keydown',evt=>keyAction(evt,x,y));
      btn.addEventListener('focus',()=>{if(legal.has(k)&&focusKey!==k)setRoving(k);});
      targets.appendChild(btn);
      buttons.set(k,btn);
    }
    svg.appendChild(targets);
    host.appendChild(svg);

    const speciesStyle={wildebeest:['#f0e7c4','#263c2d','wildebeest'],lion:['#efc15c','#503513','lion-icon'],hyena:['#f4d0c4','#4f332d','hyena-icon']};
    const tokenLabel=t=>NAMES[t.species]+({individual:' individual',smallGroup:' small group',herd:' herd',clan:' clan',pride:' pride'}[t.type]||'');
    const paintToken=(t,idx,num)=>{
      const [fill,stroke,animal]=speciesStyle[t.species];
      const gap=num<=1?0:11, cx=UNIT/2+(num===1?0:idx%2?gap/2:-gap/2);
      const cy=UNIT/2+(num<=2?0:idx<2?-gap/2:gap/2);
      const r=num===1?10.2:6.3;
      const symbol={individual:'1',smallGroup:'G',herd:'H',clan:'C',pride:'P'}[t.type];
      return `<g><circle cx="${cx+.7}" cy="${cy+1.1}" r="${r+.45}" fill="#25231a" opacity=".35"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.45"/>
        ${num===1?`<use href="#${id}-${animal}" x="${cx-8.4}" y="${cy-6.8}" width="16.8" height="10.6"/>`:''}
        <text x="${cx}" y="${cy+(num===1?6.5:2.6)}" text-anchor="middle" fill="${stroke}" font-family="system-ui,sans-serif" font-size="${num===1?6.4:7}" font-weight="900">${symbol||'W'}</text></g>`;
    };
    function update(view={}) {
      const toKeys=list=>new Set((Array.isArray(list)?list:[]).filter(c=>c&&BOARD[c.y]?.[c.x]).map(c=>key(c.x,c.y)));
      sourceKeys=toKeys(view.sourceCells);
      destinationKeys=toKeys(view.legalCells);
      legal=new Set([...sourceKeys,...destinationKeys]);
      const oldFocus=svg.contains(document.activeElement);
      const selectedCell=view.selected||view.position;
      const selectedKey=selectedCell&&key(selectedCell.x,selectedCell.y);
      const active=Number.isInteger(view.season)&&view.season>=0&&view.season<4?view.season:null;
      for(const el of svg.querySelectorAll('[data-grazing]')){
        const current=active===Number(el.getAttribute('data-grazing'));
        el.setAttribute('stroke-width',current?'3.2':'2.3');
        el.setAttribute('opacity',current||active===null?'.98':'.62');
      }
      for(const el of svg.querySelectorAll('[data-turn]')){
        const current=active===Number(el.getAttribute('data-turn'));
        el.firstElementChild.setAttribute('stroke-width',current?'1.7':'.85');
      }
      const byCell=new Map();
      for(const t of Array.isArray(view.tokens)?view.tokens:[]) {
        if(!speciesStyle[t.species]||!t.cell||!BOARD[t.cell.y]?.[t.cell.x])continue;
        const k=key(t.cell.x,t.cell.y);
        if(!byCell.has(k))byCell.set(k,[]);
        byCell.get(k).push(t);
      }
      const activeTokens=new Set();
      for(const [k,list] of byCell){
        const [x,y]=k.split(':').map(Number), [l,t]=point(x,y);
        for(const [i,animal] of list.entries()){
          const idKey=animal.id||k+':'+i;
          activeTokens.add(idKey);
          let record=tokenNodes.get(idKey);
          if(!record){
            record={el:svgEl('g',{'data-token-id':idKey})};
            tokenNodes.set(idKey,record);
            animals.appendChild(record.el);
          }
          const {el}=record;
          const mark=sourceKeys.has(k), picked=animal.id===view.selectedTokenId;
          const signature=[animal.species,animal.type,i,list.length,mark,picked].join(':');
          if(record.signature!==signature){
            record.signature=signature;
            const lip=mark&&picked?'<circle cx="13.5" cy="13.5" r="12.1" fill="#f9f3bb" stroke="#273f31" stroke-width="2.5"/>'
              :mark?'<circle cx="13.5" cy="13.5" r="11.9" fill="none" stroke="#294b34" stroke-width="1.25"/>':'';
            el.innerHTML=lip+(list.length>4
              ?(i===0?`<circle cx="13.5" cy="13.5" r="10" fill="#f5e9c3" stroke="#314232" stroke-width="1.5"/><text x="13.5" y="16.3" text-anchor="middle" fill="#28352a" font-family="system-ui,sans-serif" font-size="8" font-weight="900">${list.length}</text>`:'')
              :paintToken(animal,i,list.length));
          }
          if(record.x!==l || record.y!==t){
            el.setAttribute('transform',`translate(${l} ${t})`);
            if(Number.isFinite(record.x)&&previousStage!=='setup'&&view.stage!=='setup'&&!motion?.matches&&typeof el.animate==='function'){
              record.animation?.cancel();
              record.animation=el.animate(
                [{transform:`translate(${record.x}px,${record.y}px)`},{transform:`translate(${l}px,${t}px)`}],
                {duration:Math.min(640,190+Math.hypot(l-record.x,t-record.y)*1.2),easing:'cubic-bezier(.2,.72,.29,1)'});
            }
            record.x=l; record.y=t;
          }
        }
      }
      for(const [k,record] of tokenNodes)if(!activeTokens.has(k)){
        record.animation?.cancel(); record.el.remove(); tokenNodes.delete(k);
      }
      const groupCells=Array.isArray(view.selectedCells)?view.selectedCells:[];
      const formation=groupCells.map(({x,y})=>{
        const [l,t]=point(x,y);
        return `<rect x="${l+1}" y="${t+1}" width="${UNIT-2}" height="${UNIT-2}" fill="#f6ee9a" fill-opacity=".43" rx="2" stroke="#33573b" stroke-width="1.1"/>`;
      }).join('');
      choices.innerHTML=formation+cells.filter(c=>destinationKeys.has(key(c.x,c.y))).map(({x,y})=>{
        const [l,t]=point(x,y);
        return `<rect x="${l+1.8}" y="${t+1.8}" width="${UNIT-3.6}" height="${UNIT-3.6}" rx="3" fill="#fafce16b" stroke="#28594f" stroke-width="1.55" stroke-dasharray="2.6 1.7"/><path d="M${l+UNIT-8} ${t+4}h4v4z" fill="#256351"/>`;
      }).join('');
      selected.innerHTML='';
      if(selectedCell&&BOARD[selectedCell.y]?.[selectedCell.x]) {
        const [l,t]=point(selectedCell.x,selectedCell.y);
        selected.innerHTML=`<rect x="${l+1.5}" y="${t+1.5}" width="${UNIT-3}" height="${UNIT-3}" rx="3" fill="none" stroke="#fff6d5" stroke-width="4"/><rect x="${l+1.5}" y="${t+1.5}" width="${UNIT-3}" height="${UNIT-3}" rx="3" fill="none" stroke="#173e34" stroke-width="2"/>`;
      }
      for(const cell of cells){
        const k=key(cell.x,cell.y),el=buttons.get(k),canMove=legal.has(k),tokens=byCell.get(k);
        const isSource=sourceKeys.has(k), isDestination=destinationKeys.has(k);
        const picked=isSource&&Boolean(tokens?.some(t=>t.id===view.selectedTokenId));
        const label=cellLabel(cell)+(tokens?', contains '+tokens.map(tokenLabel).join(', '):'')+
          (picked?', selected piece':isSource?', select piece':'')+
          (selectedKey===k?', current selection':'')+(isDestination?(sourceKeys.size?', available destination':', available choice'):'');
        el.setAttribute('aria-label',label);
        el.firstElementChild.textContent=label;
        el.setAttribute('data-legal',String(canMove));
        el.setAttribute('data-source',String(isSource));
        el.setAttribute('data-destination',String(isDestination));
        el.setAttribute('aria-disabled',String(!canMove));
        if(isSource)el.setAttribute('aria-pressed',String(picked));
        else el.removeAttribute('aria-pressed');
      }
      if(!legal.has(focusKey)){
        const next=legal.has(selectedKey)?selectedKey:[...legal][0]||null;
        setRoving(next,oldFocus&&Boolean(next));
        if(oldFocus&&!next)svg.focus({preventScroll:true});
      }
      previousStage=view.stage;
    }
    return {update};
  }
})(typeof window === 'undefined' ? null : window);
