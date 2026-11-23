/* Original vector illustration and independently encoded board for the B.1 Lesson 7 companion.
   Rules geometry based on OpenSciEd, Lesson 7 Teacher Reference 3, Serengeti Game Board.
   Coordinates are zero-based, west to east then north to south. Arrays below are inclusive runs.
   Wildlife anatomy references only:
   https://animaldiversity.org/accounts/Connochaetes_taurinus/
   https://nationalzoo.si.edu/animals/lion
   https://sdzwildlifeexplorers.org/animals/spotted-hyena
   No photographs or external image assets are used. */
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
      <linearGradient id="${id}-hide" x2="0" y2="1"><stop stop-color="#989a91"/><stop offset=".46" stop-color="#767a75"/><stop offset="1" stop-color="#484a45"/></linearGradient>
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
        <path d="M29 28q13-1 22 2 8-5 20-5l-2 2-9 3-9 7-9-3-12 3" fill="#adb2a6" opacity=".34"/>
        <path d="M65 20l2-3 2 1 2-2 2 2 2-1 2 1 2-1 8 8-5 2-5-6-6 1z" fill="#343a36"/>
        <path d="M77 34l6-2m-22-6 1 10m4-11 1 9m4-9 1 6m-11-3q-4 4-3 14m-1-12q-4 3-4 13m-1-12q-5 3-5 13" stroke="#3a403a" stroke-width="1.1" fill="none" opacity=".86"/>
        <path d="M85 39l2 6v6l2-2 1 3 2-8-3-4z" fill="#b4a68c"/>
        <circle cx="94" cy="32.5" r="1.25" fill="#efd7a7"/><circle cx="94.2" cy="32.4" r=".65" fill="#191715"/>
      </symbol>
      <symbol id="${id}-lion-icon" viewBox="0 0 120 76">
        <path d="M29 42Q12 46 8 33 5 24 11 20" fill="none" stroke="#9c6236" stroke-width="2.6"/><path d="M10 22q-4-2 2-8l3 2-2 5z" fill="#5b3b25"/>
        <path d="M43 42l-6 11 7 14h-6L29 53l5-12m37-1 2 14 2 12h-7l-2-12-4-12" fill="#a16a39"/>
        <path d="M25 40q0-13 16-13 10-1 20 1l21-3 7 17-17 7-7 18h-8l2-14 1-9q-9 9-23 4l-5 10 1 9h-8l-3-13z" fill="url(#${id}-lion-hide)" stroke="#71502e" stroke-width="1.2"/>
        <path d="M73 40q-2-10 2-14l6-7 7-2 9 4 7 8-6 4-1 7-7 11-6 4-8-8-5-8z" fill="#734225" stroke="#533522" stroke-width=".8"/>
        <path d="M82 25l11-3 10 4 7 7-4 6-10-1-7 3-5-4z" fill="#d6a45c"/>
        <path d="M82 29q-1 8 5 12l-3 6-3-5-3-9m3-10 5-3 8-1" fill="none" stroke="#bd8147" stroke-width=".9" opacity=".8"/>
        <path d="M85 26q-6-7 1-10 5 2 5 7M100 34l8-1" fill="#b88145" stroke="#5e3b24" stroke-width="1.15"/>
        <path d="M98 34q6-3 11-1l-2 4-8 1z" fill="#f4d69a"/><path d="M106 33l4 0-2 2z" fill="#56402d"/>
        <path d="M98 35l-4-1m5 2-4 1" stroke="#f0d3a7" stroke-width=".5" stroke-linecap="round"/>
        <circle cx="99" cy="28.5" r="1.2" fill="#24211b"/>
      </symbol>
      <symbol id="${id}-hyena-icon" viewBox="0 0 120 76">
        <path d="M28 44l-6 12 2 12h-5l-3-12 6-13m44-4-3 13 5 16h-6l-8-16 4-12" fill="#71523c"/>
        <path d="M24 40q12-13 35-17 13-5 24-1l10 4 8 8-4 8-9 2-9-7-7 13 1 18h-6l-6-17-1-9q-10 8-27 7l-6 9 1 10h-6l-3-14z" fill="url(#${id}-hyena-hide)" stroke="#564030" stroke-width="1.2"/>
        <path d="M23 40q-7 5-10 16l-6 4 3 4q11-6 12-14l4-8" fill="#644634"/>
        <path d="M77 26q-3-6 1-10 6-2 8 6m2 2q0-8 7-6 4 5-1 10" fill="#967047" stroke="#664738" stroke-width="1.45"/>
        <path d="M93 33l8 1-3 8-7 1z" fill="#4e3a33"/>
        <path d="M40 33q17-10 31-9 7-2 13 2-9 3-14 7-13 1-27 5" fill="#ead2a2" opacity=".34"/>
        <path d="M58 24l3-2h3l1-2 4 1 2-2 3 1 4-1 6 4-4 1-7-2z" fill="#644a3b"/>
        <path d="M35 39h0m9-4h0m7 7h0m3-11h0m7 6h0m7-8h0m-27 15h0m25-2h0m5-6h0m-5 14h0m25-23h0m-7 4h0m-42 10h0" stroke="#674831" stroke-width="3" stroke-linecap="round"/>
        <path d="M43 39h0m5-9h0m12 12h0m19-9h0m-4 10h0m-41 5h0" stroke="#674831" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="92" cy="31" r="1.2" fill="#201d16"/>
      </symbol>
      <!-- Original marker glyphs: broad bovine muzzle/down-curved horns, lion
           mane and rounded feline face, hyena rounded ears and spotted coat. -->
      <symbol id="${id}-wildebeest-chip" viewBox="0 0 24 18">
        <path d="M10 5C7 7 2 6 2 1c-3 3-1 10 5 10l3-2m4-4c3 2 8 1 8-4 3 3 1 10-5 10l-3-2" fill="#414843" stroke="#29332f" stroke-width=".65"/>
        <path d="M10 4l1-2 2 2 2 3 3 1-2 2-.2 3-2.8 3-1 2-1-2-2.8-3-.2-3-2-2 3-1z" fill="#3d4641"/>
        <path d="M9.5 9q2.5-1.4 5 0l.7 3.4q0 1.8-3.2 1.8t-3.2-1.8z" fill="#8b9187"/>
        <path d="M8.3 8h1.9m3.6 0h1.9" stroke="#ebe1bb" stroke-width="1.05" stroke-linecap="round"/>
      </symbol>
      <symbol id="${id}-lion-chip" viewBox="0 0 24 18">
        <path d="M3 6 5 5 5 2 8 3 10 1h4l2 2 3-1 1 3 2 1-1 3 1 3-3 1-1 2-3 .5-3 2-3-2-3-.5-1-2-3-1 1-3z" fill="#704024" stroke="#59321c" stroke-width=".45"/>
        <path d="M7 5C7 3 10 3 10 5m4 0c0-2 3-2 3 0" stroke="#d59a45" stroke-width="1.85" stroke-linecap="round"/>
        <path d="M8 5q4-2 8 0l1.5 4-2.1 4.5-3.4 1.2-3.4-1.2L6.5 9z" fill="#dcad59"/>
        <path d="M9.5 7.5h.7m3.6 0h.7" stroke="#492a1c" stroke-linecap="round" stroke-width="1"/>
        <path d="M11.1 8.8h1.8l-.9 1.5z" fill="#4b2a1d"/><path d="M8.7 11q.3-1.3 2-1l1.3.6 1.3-.6q1.5-.3 2 1 .4 1.5-3.3 2-3.7-.5-3.3-2z" fill="#f5d797"/>
      </symbol>
      <symbol id="${id}-hyena-chip" viewBox="0 0 24 18">
        <path d="M6 7Q1 6 2 3t4-1l2 3m8 0 2-3q3-2 4 1t-4 4" fill="#a67550" stroke="#593f34" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M8 5q4-2.8 8 0l2.6 3-2.3 5-4.3 2.8-4.3-2.8-2.3-5z" fill="#9a6d53" stroke="#593f34" stroke-width=".65"/>
        <path d="M9 9.6q3-1.6 6 0l.8 2-2.9 1.9h-1.8l-2.9-1.9z" fill="#4d3832"/>
        <path d="M8 8l1 .3m6 0 1-.3m-4-2.3h0m-3.1.4h0m6.2 0h0" stroke="#392a24" stroke-width="1.1" stroke-linecap="round"/>
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
        <ellipse cx="108" cy="162" rx="44" ry="4" fill="#785f3c" opacity=".32"/><ellipse cx="177" cy="146" rx="23" ry="2.5" fill="#785f3c" opacity=".25"/>
        <use href="#${id}-wildebeest" x="54" y="111" width="109" height="61"/>
        <use href="#${id}-wildebeest" x="151" y="117" width="52" height="33"/>
      </g>
      <text x="57" y="173" class="sg-map-specimen">BLUE WILDEBEEST</text>
      <path d="M31 404q60-37 108-21l37 32-8 25-42-4-33 24-62 14z" fill="#937c57" opacity=".22"/>
      <g opacity=".78">
        <ellipse cx="92" cy="458" rx="39" ry="4" fill="#785f3c" opacity=".33"/>
        <use href="#${id}-lion-icon" x="46" y="402" width="100" height="65"/>
        <ellipse cx="138" cy="530" rx="41" ry="4" fill="#785f3c" opacity=".33"/>
        <use href="#${id}-hyena-icon" x="88" y="472" width="100" height="65"/>
      </g>
      <text x="53" y="468" class="sg-map-specimen">AFRICAN LION</text>
      <text x="94" y="541" class="sg-map-specimen">SPOTTED HYENA</text>
    </g>`;
  }

  // Landmark linework hand-traced from the classroom board, in source page pixels.
  // This is a classroom schematic, not cartographic data. Terrain stipple and
  // animal vignettes under the grid are decorative, not habitat mechanics.
  const pagePoint=(x,y)=>[LEFT+(x-177.5)*UNIT/34,TOP+(y-222.5)*UNIT/33.72];
  function feature(points) {
    return points.map(([x,y],i)=>{const a=pagePoint(x,y);return (i?'L':'M')+a.map(n=>n.toFixed(1)).join(' ');}).join('');
  }
  function geography(id) {
    const mapLines=[
      // Park/reserve edges from the teaching map; these never block a board move.
      [[177,478],[180,524],[190,526],[212,528],[228,535],[235,552],[246,570],[267,577],[280,584],[302,594],[324,594],[341,601],[346,618],[350,632],[358,641],[365,654],[379,670],[390,675],[395,691],[409,704],[418,722],[415,738],[430,755],[450,767],[460,778],[460,792],[470,799],[478,818],[488,830],[496,864],[497,889],[502,906],[518,924],[520,938],[529,950],[538,940],[537,925],[548,912],[557,907],[578,900],[584,892],[582,861],[585,834],[582,816],[586,786],[595,780],[606,785],[622,803],[627,814],[632,810],[628,797],[639,783],[652,776],[672,763],[683,729],[695,689],[704,654],[718,603],[723,530],[710,508],[705,478],[701,454],[706,432],[710,383],[720,341],[755,318]],
      [[177,473],[199,472],[212,466],[234,464],[249,459],[266,455],[284,461],[299,466],[314,465],[324,454],[339,453],[354,451],[365,456],[383,462],[422,457],[434,458],[452,462],[470,470],[484,467],[500,459],[517,473],[524,494],[537,505],[541,489],[552,480],[556,458],[553,439],[556,414],[550,397],[544,377],[535,365]],
      [[497,270],[475,273],[467,279],[473,293],[483,311],[490,323],[503,327],[511,337],[521,348],[526,358],[536,362]],
      [[450,300],[462,296],[472,305],[483,303],[495,299],[508,300],[525,308],[521,327],[537,342],[545,355],[550,370],[552,389]],
      [[451,301],[459,319],[470,339],[481,353],[490,367],[509,393],[517,414],[520,443],[525,470],[536,483],[540,504]],
      [[518,224],[500,239],[496,254],[491,266],[490,282],[500,303]],
      [[519,224],[755,356]],
      [[675,223],[694,230],[704,235],[724,251],[735,260],[752,276],[751,302],[751,316],[747,322],[729,331],[721,332]],
      [[707,642],[718,650],[739,658],[756,668]],
      [[356,909],[370,898],[375,882],[377,858],[382,838],[389,825],[392,811],[391,791],[394,780],[389,772],[386,765],[377,759],[373,751],[377,737]],
      [[337,955],[339,940],[349,931],[357,919],[356,908]]
    ];
    const mara=feature([[198,258],[228,257],[245,255],[266,259],[280,260],[289,264],[308,266],[319,275],[339,276],[350,282],[377,284],[389,287],[398,288],[418,300],[444,298],[457,296],[466,302],[479,305],[500,307],[523,305],[538,298],[546,285],[549,269],[566,262],[577,260],[589,250],[594,240],[598,225]]);
    const grumeti=feature([[276,500],[300,502],[318,501],[334,506],[350,506],[364,508],[381,507],[401,512],[424,509],[442,501],[456,490],[472,483],[487,476],[505,469],[516,452],[523,439],[540,430],[563,425],[580,416],[595,408],[614,405],[638,403],[656,401],[678,404],[697,400],[713,401],[733,397],[746,392],[756,375]]);
    const unfenced=feature([[426,346],[431,360],[443,369],[455,373],[469,374],[484,371],[497,370],[512,374],[524,380],[533,386],[544,391],[559,396],[576,399],[593,402],[610,402],[626,407],[641,413],[652,423],[666,433],[680,452],[697,462],[711,469],[732,473],[756,474]]);
    const fenced=feature([[588,402],[607,398],[627,402],[643,408],[655,418],[669,429],[682,447],[697,457],[713,464],[734,469],[756,470]]);
    const contours=[
      'M35 368Q60 348 88 352T138 366Q160 375 174 371','M35 373Q64 357 90 360T139 375Q162 383 178 378',
      'M45 490Q76 478 100 483T153 502Q164 506 178 504','M46 498Q76 486 100 491T153 508Q165 512 182 511',
      'M431 49q30 3 54 28m-59-20q29 4 57 29m-66-22q35 5 61 31m-66-23q40 9 63 31',
      'M435 456q20-12 50-9m-57 18q28-12 57-8m-61 18q31-13 62-10m-65 20q35-15 65-11'
    ];
    return `<g clip-path="url(#${id}-clip)">
      <g fill="none" stroke="#917351" stroke-opacity=".38" stroke-width="1">${contours.map(d=>`<path d="${d}"/>`).join('')}</g>
      <g fill="none" stroke="#725d43" stroke-opacity=".71" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.18">${mapLines.map(l=>`<path d="${feature(l)}"/>`).join('')}</g>
      ${[mara,grumeti].map(d=>`<path d="${d}" fill="none" stroke="#eae1b9" stroke-width="3.3" stroke-opacity=".86"/><path d="${d}" fill="none" stroke="#337486" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
      <path d="${unfenced}" fill="none" stroke="#88442e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${fenced}" fill="none" stroke="#f8edc3" stroke-width="3.5"/><path d="${fenced}" fill="none" stroke="#72432e" stroke-width="1.45" stroke-dasharray="2.1 1.9" stroke-linecap="round"/>
      <g class="sg-map-place" fill="#234e57"><text x="121" y="50">Mara River</text><text x="365" y="152">Grumeti River</text></g>
    </g>`;
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
      .sg-map .sg-map-specimen{fill:#4b3e2c;font:800 7.8px var(--font,system-ui,sans-serif);letter-spacing:1px}
      .sg-map .sg-map-small{font-size:8.8px;letter-spacing:.38px}
      .sg-map .sg-map-turn{font:850 9px var(--font,system-ui,sans-serif);letter-spacing:.55px}
      .sg-map .sg-map-axis{font:750 8px var(--font,system-ui,sans-serif)}
      .sg-map .sg-map-hit{fill:transparent;outline:none;touch-action:manipulation}
      .sg-map .sg-map-hit[data-legal="true"]{cursor:pointer}
      .sg-map .sg-map-hit[data-legal="true"]:hover,.sg-map .sg-map-hit:focus-visible{fill:#fffef23c;stroke:#203d30;stroke-width:2;vector-effect:non-scaling-stroke}
      .sg-map .sg-map-hit[data-source="true"]:hover{fill:#fff4cf46}
      .sg-map [data-layer="tokens"],.sg-map [data-layer="selected"],.sg-map [data-layer="choices"], .sg-map [data-layer="effects"],.sg-map [data-layer="recent"],.sg-map [data-layer="flood"]{pointer-events:none}
      .sg-map .sg-map-grazing{transition:opacity 160ms linear}
      @media (prefers-reduced-motion:reduce){.sg-map .sg-map-grazing{transition:none}}
    </style>`;
    const svg=svgEl('svg',{viewBox:`0 0 ${WIDTH} ${HEIGHT}`,class:'sg-map',role:'group',tabindex:'-1','aria-label':'Serengeti map and movement grid'});
    const cells=BOARD.flat();
    const backdrop=`<rect x="1" y="1" width="519" height="624" rx="15" fill="#f0ddb7" stroke="#9a8156" stroke-width="2"/>
      <rect x="8" y="8" width="505" height="610" rx="10" fill="none" stroke="#987c50" stroke-opacity=".43" stroke-width="1"/>
      <rect x="31" y="30" width="459" height="567" fill="url(#${id}-sand)"/><rect x="31" y="30" width="459" height="567" fill="url(#${id}-sand-texture)"/>`;
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
      <text x="396" y="46" fill="#46533b" class="sg-map-small">MAASAI MARA</text>
      <text x="403" y="57" fill="#46533b" class="sg-map-small">GAME RESERVE</text>
      <text x="186" y="156" class="sg-map-small">IKORONGO</text><text x="179" y="167" class="sg-map-small">GAME RESERVE</text>
      <text x="108" y="222" class="sg-map-small" transform="rotate(5 108 222)">GRUMETI GAME RESERVE</text>
      <text x="468" y="511" class="sg-map-small" transform="rotate(-90 468 511)">NGORONGORO</text>
      <text x="171" y="577" font-size="8.8">MASWA GAME</text><text x="173" y="588" font-size="8.8">RESERVE</text>
    </g>`;
    svg.innerHTML=defs(id)+`<g aria-hidden="true">${backdrop}${landscape(id)}${grazing}${territories}${geography(id)}
      <path d="${grid}" stroke="#736247" stroke-width=".63" stroke-opacity=".44" fill="none"/>${outlines}${placeLabels}
      <g fill="#5d4a36" class="sg-map-axis">${cellAxes}</g>${turnLabels}
      <g transform="translate(56 558)" fill="#4b422d" stroke="#4b422d"><path d="M0 15V0m-4 7 4-7 4 7M-6 15h12" stroke-width=".9" fill="none"/><text x="0" y="-3" text-anchor="middle" font-size="7" font-weight="800" stroke="none">N</text></g>
      <g transform="translate(67 578)" stroke="#645039" fill="#645039"><path d="M0 -2v4m0-2h27m0-2v4" stroke-width=".9"/><text x="13.5" y="9" text-anchor="middle" font-size="7" stroke="none">6 miles</text></g>
      <g transform="translate(35 608)" fill="#5e4932" font-size="7.1" font-weight="700">
        <path d="M0 -2h13" stroke="#88442e" stroke-width="1.4"/><text x="17">Unfenced road</text>
        <path d="M80 -2h13" stroke="#72432e" stroke-width="1.4" stroke-dasharray="2 1.6"/><text x="98">Fenced road</text></g>
      <g data-layer="flood"></g><g data-layer="choices"></g><g data-layer="effects"></g><g data-layer="tokens"></g><g data-layer="selected"></g><g data-layer="recent"></g></g>`;
    const targets=svgEl('g',{'aria-label':'Map squares'});
    const buttons=new Map();
    const choices=svg.querySelector('[data-layer="choices"]');
    const animals=svg.querySelector('[data-layer="tokens"]');
    const effects=svg.querySelector('[data-layer="effects"]');
    const flood=svg.querySelector('[data-layer="flood"]'), recent=svg.querySelector('[data-layer="recent"]');
    let priorMarks='', priorFlood='';
    const selected=svg.querySelector('[data-layer="selected"]');
    let legal=new Set(), sourceKeys=new Set(), destinationKeys=new Set(), focusKey=null;
    const tokenNodes=new Map(), running=new Map();
    let previousStage, previousSeason, previousChoices='', previousHunt='';
    function animate(el, kind, frames, options, cleanup) {
      if (motion?.matches || typeof el.animate!=='function') { cleanup?.(); return; }
      running.get(el)?.cancel();
      const a=el.animate(frames,options);
      el.setAttribute('data-motion',kind);
      running.set(el,a);
      a.onfinish=a.oncancel=() => {
        if (running.get(el)!==a) return;
        running.delete(el);
        el.removeAttribute('data-motion');
        cleanup?.();
      };
    }
    motion?.addEventListener?.('change', e => {
      if (e.matches) for (const a of running.values()) a.cancel();
    });
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

    const speciesStyle={wildebeest:['#eee9cf','#263d36'],lion:['#f2cd73','#583719'],hyena:['#f0d6c6','#533d39']};
    const tokenLabel=t=>NAMES[t.species]+({individual:' individual',smallGroup:' small group',herd:' herd',clan:' clan',pride:' pride'}[t.type]||'');
    // The outline identifies species even when tokens are stacked or viewed in grayscale.
    function tokenBase(species,cx,cy,r,fill,extra='') {
      if (species==='hyena') return `<path d="M${cx} ${cy-r}l${r} ${r} -${r} ${r} -${r} -${r}Z" fill="${fill}" stroke-linejoin="round" ${extra}/>`;
      if (species==='lion') {
        const dx=r*.866, dy=r*.5;
        return `<path d="M${cx} ${cy-r}l${dx} ${dy}v${r}l-${dx} ${dy} -${dx} -${dy}v-${r}Z" fill="${fill}" stroke-linejoin="round" ${extra}/>`;
      }
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
    }
    const paintToken=(t,idx,num)=>{
      const [fill,stroke]=speciesStyle[t.species];
      const gap=num<=1?0:11, cx=UNIT/2+(num===1?0:idx%2?gap/2:-gap/2);
      const cy=UNIT/2+(num<=2?0:idx<2?-gap/2:gap/2);
      const r=num===1?10.2:6.3;
      const symbol={individual:'1',smallGroup:'G',herd:'H',clan:'C',pride:'P'}[t.type];
      return `<g data-species-mark="${t.species}">${tokenBase(t.species,cx+.7,cy+1.1,r+.45,'#25231a','opacity=".35"')}${tokenBase(t.species,cx,cy,r,fill,`stroke="${stroke}" stroke-width="1.45"`)}
        ${num===1?`<use href="#${id}-${t.species}-chip" x="${cx-7.7}" y="${cy-8.1}" width="15.4" height="11.9"/>`:''}
        <text x="${cx}" y="${cy+(num===1?6.5:2.6)}" text-anchor="middle" fill="${stroke}" font-family="system-ui,sans-serif" font-size="${num===1?6.4:7}" font-weight="900">${symbol||'W'}</text></g>`;
    };
    function update(view={}) {
      const toKeys=list=>new Set((Array.isArray(list)?list:[]).filter(c=>c&&BOARD[c.y]?.[c.x]).map(c=>key(c.x,c.y)));
      sourceKeys=toKeys(view.sourceCells);
      destinationKeys=toKeys(view.legalCells);
      legal=new Set([...sourceKeys,...destinationKeys]);
      const floodCells=toKeys(view.floodedCells);
      const floodKey=[...floodCells].join('|');
      if (floodKey!==priorFlood) {
        priorFlood=floodKey;
        flood.innerHTML=[...floodCells].map(coord=>{
          const [x,y]=coord.split(':').map(Number),[l,t]=point(x,y);
          return `<g data-flood-cell="${coord}"><rect x="${l+1}" y="${t+1}" width="${UNIT-2}" height="${UNIT-2}" rx="2" fill="#9dc8da" fill-opacity=".45" stroke="#134a67" stroke-width="1.3" stroke-dasharray="2.6 1.7"/><path d="M${l+3} ${t+9}q3-2.5 6 0t6 0m-12 5q3-2.5 6 0t6 0" fill="none" stroke="#134a67" stroke-width="1.4"/></g>`;
        }).join('');
      }
      const changeCells=(Array.isArray(view.lastChangedCells)?view.lastChangedCells:[]).filter(c=>c&&BOARD[c.y]?.[c.x]).slice(0,30);
      const changeKey=changeCells.map(c=>key(c.x,c.y)+c.change).join('|');
      if (changeKey!==priorMarks) {
        priorMarks=changeKey;
        recent.innerHTML=changeCells.map(({x,y,change})=>{
          const [l,t]=point(x,y), added=change==='added', moved=change==='moved';
          const ink=added?'#245437':moved?'#594013':'#762f1f';
          const glyph=added?'M-2.7 0h5.4m-2.7-2.7v5.4':moved?'M-3 0h6m-3-2.2L3 0 0 2.2':'M-2.3-2.3l4.6 4.6m0-4.6-4.6 4.6';
          return `<g data-change-cell="${x}:${y}" data-change-kind="${added?'added':moved?'moved':'removed'}"><rect x="${l+1.5}" y="${t+1.5}" width="${UNIT-3}" height="${UNIT-3}" rx="3" fill="none" stroke="#fff8db" stroke-width="3.6"/><rect x="${l+1.5}" y="${t+1.5}" width="${UNIT-3}" height="${UNIT-3}" rx="3" fill="none" stroke="${ink}" stroke-width="1.8"/><g transform="translate(${l+(added||moved?UNIT-5:5)} ${t+5})"><circle r="4.6" fill="#fff6d7" stroke="${ink}" stroke-width="1"/><path d="${glyph}" fill="none" stroke="${ink}" stroke-width="1.35"/></g></g>`;
        }).join('');
      }
      const oldFocus=svg.contains(document.activeElement);
      const selectedCell=view.selected||view.position;
      const selectedKey=selectedCell&&key(selectedCell.x,selectedCell.y);
      const active=Number.isInteger(view.season)&&view.season>=0&&view.season<4?view.season:null;
      const started=Boolean(previousStage&&previousStage!=='setup'&&view.stage!=='setup');
      const migrating=started&&previousStage==='migration'&&view.stage!=='migration';
      let cohortIndex=0;
      for(const el of svg.querySelectorAll('[data-grazing]')){
        const current=active===Number(el.getAttribute('data-grazing'));
        el.setAttribute('stroke-width',current?'3.2':'2.3');
        el.setAttribute('opacity',current||active===null?'.98':'.62');
        if(started&&current&&active!==previousSeason)animate(el,'season',[
          {opacity:.22,strokeWidth:'3.2px'},{opacity:1,strokeWidth:'5px',offset:.55},{opacity:.98,strokeWidth:'3.2px'}
        ],{duration:460,easing:'ease-out'});
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
          const newPiece=!record;
          if(newPiece){
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
            if(started&&Number.isFinite(record.x)){
              const isCohort=migrating&&animal.species==='wildebeest';
              const duration=Math.min(isCohort?510:390,240+Math.hypot(l-record.x,t-record.y)*.8);
              animate(el,isCohort?'migrate':'move',
                [{transform:`translate(${record.x}px,${record.y}px)`},{transform:`translate(${l}px,${t}px)`}],
                {duration,delay:isCohort?(cohortIndex++%6)*20:0,fill:'backwards',easing:'cubic-bezier(.2,.72,.29,1)'});
            }else if(started&&newPiece){
              animate(el,'enter',[
                {opacity:0,transform:`translate(${l}px,${t+4}px)`},{opacity:1,transform:`translate(${l}px,${t}px)`}
              ],{duration:330,easing:'ease-out'});
            }
            record.x=l; record.y=t;
          }
        }
      }
      for(const [k,record] of tokenNodes)if(!activeTokens.has(k)){
        running.get(record.el)?.cancel();
        if(started&&!motion?.matches&&typeof record.el.animate==='function'){
          // Exit art is a short visual echo, never a playable or accessible token.
          const ghost=svgEl('g',{'aria-hidden':'true','transform':record.el.getAttribute('transform')});
          ghost.innerHTML=record.el.innerHTML;
          effects.appendChild(ghost);
          animate(ghost,'exit',[{opacity:.86},{opacity:0}],{duration:260,easing:'ease-in'},()=>ghost.remove());
        }
        record.el.remove(); tokenNodes.delete(k);
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
      const choicesId=[...destinationKeys].join('|')+';'+groupCells.map(c=>key(c.x,c.y)).join('|');
      if(started&&choicesId!==previousChoices&&(destinationKeys.size||groupCells.length)){
        animate(choices,'choices',[{opacity:.35},{opacity:1}],{duration:160,easing:'ease-out'});
      }
      previousChoices=choicesId;
      selected.innerHTML='';
      if(selectedCell&&BOARD[selectedCell.y]?.[selectedCell.x]) {
        const [l,t]=point(selectedCell.x,selectedCell.y);
        selected.innerHTML=`<rect x="${l+1.5}" y="${t+1.5}" width="${UNIT-3}" height="${UNIT-3}" rx="3" fill="none" stroke="#fff6d5" stroke-width="4"/><rect x="${l+1.5}" y="${t+1.5}" width="${UNIT-3}" height="${UNIT-3}" rx="3" fill="none" stroke="#173e34" stroke-width="2"/>`;
      }
      const huntId=view.reveal&&view.predatorPosition&&view.position
        ?key(view.predatorPosition.x,view.predatorPosition.y)+'>'+key(view.position.x,view.position.y):'';
      if(huntId){
        const [px,py]=point(view.predatorPosition.x,view.predatorPosition.y);
        selected.innerHTML+=`<rect x="${px+2.5}" y="${py+2.5}" width="${UNIT-5}" height="${UNIT-5}" rx="3" fill="none" stroke="#f5e5bf" stroke-width="4"/><rect x="${px+2.5}" y="${py+2.5}" width="${UNIT-5}" height="${UNIT-5}" rx="3" fill="none" stroke="#844d34" stroke-width="2.25" stroke-dasharray="3 2"/>`;
        if(started&&huntId!==previousHunt)animate(selected,'hunt',[{opacity:.55},{opacity:1}],{duration:250,easing:'ease-out'});
      }
      previousHunt=huntId;
      for(const cell of cells){
        const k=key(cell.x,cell.y),el=buttons.get(k),canMove=legal.has(k),tokens=byCell.get(k);
        const isSource=sourceKeys.has(k), isDestination=destinationKeys.has(k);
        const picked=isSource&&Boolean(tokens?.some(t=>t.id===view.selectedTokenId));
        const label=cellLabel(cell)+(tokens?', contains '+tokens.map(tokenLabel).join(', '):'')+
          (floodCells.has(k)?', flooded territory; lions cannot hunt':'')+
          (picked?', selected piece':isSource?', select piece':'')+
          (huntId&&same(view.predatorPosition,cell)?', predator in the current hunt':'')+
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
      previousSeason=active;
    }
    return {update};
  }
})(typeof window === 'undefined' ? null : window);
