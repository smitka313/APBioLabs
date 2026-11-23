/* Original Biology Lab Bench vector artwork for OpenSciEd B.1 Lesson 5.
   Marker counts are supplied by the model, not inferred here. The panorama is
   decorative; a marked grass role is not a measurement of grass biomass.
   Wildlife proportions reference the blue wildebeest (Connochaetes taurinus):
   https://animaldiversity.org/accounts/Connochaetes_taurinus/
   No photographs, stock imagery, or external image dependencies. */
(function (root) {
  'use strict';
  const NS='http://www.w3.org/2000/svg', MAX_MARKS=24, FORMAT=new Intl.NumberFormat('en-US');
  let index=0;
  const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
  const clean=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'})[c]);
  const roundLabel=n=>Number.isSafeInteger(n)&&n>0?'ROUND '+n:'FIELD BOARD';
  const parts=n=>{
    const total=count(n),group=Math.max(1,Math.ceil(total/MAX_MARKS));
    return Array.from({length:Math.ceil(total/group)},(_,i)=>Math.min(group,total-i*group));
  };
  function symbols(id){
    return `<defs>
      <linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#456970"/><stop offset=".55" stop-color="#98ad96"/><stop offset="1" stop-color="#f2cb86"/></linearGradient>
      <linearGradient id="${id}-field" x2="0" y2="1"><stop stop-color="#8b914f"/><stop offset="1" stop-color="#3f603b"/></linearGradient>
      <linearGradient id="${id}-wild-body" x2="0" y2="1"><stop stop-color="#a19a82"/><stop offset=".67" stop-color="#73735e"/><stop offset="1" stop-color="#464a41"/></linearGradient>
      <linearGradient id="${id}-wild-neck" x2="1" y2="1"><stop stop-color="#686c5a"/><stop offset=".68" stop-color="#434943"/><stop offset="1" stop-color="#303831"/></linearGradient>
      <radialGradient id="${id}-halo"><stop stop-color="#fff0a7" stop-opacity=".71"/><stop offset=".49" stop-color="#f6d795" stop-opacity=".24"/><stop offset="1" stop-color="#f6d795" stop-opacity="0"/></radialGradient>
      <pattern id="${id}-grain" width="19" height="13" patternUnits="userSpaceOnUse"><path d="M0 3h4m6 6h3m3-7h2M2 12h3" stroke="#ffe9b8" stroke-width=".55" opacity=".18"/><path d="M2 7h3m10 5h4" stroke="#0e3529" stroke-width=".85" opacity=".21"/></pattern>
      <clipPath id="${id}-clip"><rect x="0" y="0" width="900" height="462" rx="18"/></clipPath>
      <g id="${id}-tree">
        <path d="M-5 66Q0 45-3 33L-24 17-19 15-1 25 1 13 5 26 24 13 28 14 7 34Q4 51 7 66Z" fill="#475542"/>
        <path d="M-47 19q1-9 12-11 9-6 19-4 9-5 16-3 12-3 20 2 17-2 25 6 5 2 7 7-10 4-20 2-11 5-21 1L2 17q-12 5-24 2-13 5-25 0Z" fill="#425844"/>
        <path d="M-39 13q10-2 22-2 6-4 14-4 11-3 20 2 9-2 22 4" fill="none" stroke="#72825b" stroke-width="2" stroke-linecap="round" opacity=".72"/>
      </g>
      <g id="${id}-animal">
        <ellipse cx="96" cy="99" rx="76" ry="5" fill="#1b2923" opacity=".27"/>
        <path d="M80 69 73 88l-1 11h-7l3-13 1-20m56-.4 4 15 15 12 1 6h-7l-1-5-16-10-5-15" fill="#3d473b"/>
        <path d="M150 46q14 4 13 18t9 15" fill="none" stroke="#414b3b" stroke-width="3.3" stroke-linecap="round"/>
        <path d="M170 76q7 0 10 7-6 2-11-3Z" fill="#374230"/>
        <path d="M47 43Q52 28 69 26l18 4q16 7 34 5l18 3q16 1 17 12 2 14-13 20l-30 3-27-5-27 4-13-10Z" fill="url(#${id}-wild-body)" stroke="#465347" stroke-width="1"/>
        <path d="M76 33q7 18 6 31m3-28q6 15 5 26m4-22q4 10 4 22m5-20q3 8 2 16m5-14q2 6 2 11" fill="none" stroke="#4b5142" stroke-width="2.1" opacity=".71"/>
        <path d="M53 46q5-14 18-15 10 4 15 7 19 8 36 4" fill="none" stroke="#d4c4a0" stroke-width="2.1" stroke-linecap="round" opacity=".62"/>
        <path d="M56 62 67 67 58 84 54 96l1 4h-9l3-6 1-15Zm74 5 12-2 3 16-8 15 2 3h-10l1-4 5-15Z" fill="#596351" stroke="#3d4a3b" stroke-width="1"/>
        <path d="M49 98h7l2 3h-11Zm81 0h8l2 3h-12Z" fill="#2e3730"/>
        <path d="M68 25q-14-3-22 7l-8 12-9 5 6 15 15-3 10 12q4-14 11-21 4-14-3-27Z" fill="url(#${id}-wild-neck)" stroke="#3b463b" stroke-width=".9"/>
        <path d="M43 33q7-11 25-10l13 8-9-2-1 14-4-11-3 12-4-11-5 10-3-7-10 7Z" fill="#383e35"/>
        <path d="m28 45 9-6 9 5-1 11-7 10-13 6-8-3 1-7Z" fill="#596252" stroke="#3f4a3c" stroke-width=".9"/>
        <path d="m18 63 9-2 4 8-7 2-7-2Z" fill="#333c34"/>
        <path d="m36 62 3 7 6 9-1-10 6 3-4-14Z" fill="#333b32"/>
        <path d="M34 48q13-8 14-15 0-7-7-7-5 0-5 5-3-7 4-10 9-3 14 4 4 8-3 16-6 8-17 10Z" fill="#9a9277" stroke="#4c4e43" stroke-width=".8"/>
        <path d="M32 48q-11-5-15-12-3-6 1-9 4-2 7 2-1-6-7-6-7 1-7 8 1 12 20 20Z" fill="#a09779" stroke="#4e5143" stroke-width=".8"/>
        <path d="M27 53l5-1" stroke="#292f29" stroke-width="2.3" stroke-linecap="round"/><circle cx="29.5" cy="52" r=".65" fill="#eee4b9"/>
      </g>
      <g id="${id}-grass">
        <ellipse cx="30" cy="43" rx="26" ry="4.4" fill="#243c2a" opacity=".35"/>
        <path d="M26 45Q28 20 13 9q9 15 9 33M31 44Q34 19 42 6q-1 14-6 37M28 42Q32 17 27 2q-4 15-2 27M28 42Q21 21 4 17q10 8 17 25M30 42Q42 26 55 21q-10 11-15 21M30 42Q39 30 36 17q-2 15-10 23M19 42Q13 35 4 34q5 3 8 10M38 43Q49 30 58 34q-8 3-14 11" fill="#78a05e" stroke="#36563b" stroke-width="1.25" stroke-linejoin="round"/>
        <path d="M32 44Q29 22 39 14q-3 12-1 20M20 44Q17 23 21 12q-2 13 4 24M37 42q4-11 15-13" fill="none" stroke="#b5c77a" stroke-width="1.75" stroke-linecap="round"/>
      </g>
    </defs>`;
  }

  function plains(id){
    return `<g aria-hidden="true" clip-path="url(#${id}-clip)">
      <rect width="900" height="462" fill="url(#${id}-field)"/>
      <rect width="900" height="164" fill="url(#${id}-sky)"/>
      <ellipse cx="709" cy="61" rx="161" ry="110" fill="url(#${id}-halo)"/>
      <circle cx="709" cy="61" r="36" fill="#f5d889" opacity=".9"/>
      <path d="M42 49q73-16 134-5 54 6 94-1-47 15-96 8Q106 44 42 56Zm285 20q55-16 112-10 52 6 109-2-49 18-102 11-66-8-119 1Z" fill="#ffe0ac" opacity=".26"/>
      <path d="m0 119 112-37 66 11 62-22 121 35 71-20 63 16 69-25 107 31 105-20 124 17v76H0Z" fill="#768066" opacity=".82"/>
      <path d="M0 147q112-40 213-20 107 22 218 8 119-16 211-11 116 5 258-13v348H0Z" fill="url(#${id}-field)"/>
      <path d="M0 170q105-18 205-14 111 7 212 1 206-13 483-4M0 192q112-23 222-10 107 11 216 3 132-11 232-10 103 1 230-8" fill="none" stroke="#b8b47b" stroke-opacity=".43" stroke-width="3"/>
      <use href="#${id}-tree" transform="translate(107 87) scale(.82)" opacity=".8"/>
      <use href="#${id}-tree" transform="translate(161 110) scale(.39)" opacity=".63"/>
      <use href="#${id}-tree" transform="translate(829 92) scale(.84)" opacity=".87"/>
      <use href="#${id}-tree" transform="translate(781 124) scale(.34)" opacity=".73"/>
      <path d="M659 53q6-5 12 1 8-6 14-4m-41 14q4-4 9 0 5-4 10-3" fill="none" stroke="#485942" stroke-width="2" stroke-linecap="round"/>
      <rect width="900" height="462" fill="url(#${id}-grain)"/>
      <rect data-cc-night="" width="900" height="462" fill="#162a27" opacity="0"/>
    </g>`;
  }

  function lane(id,key,value,x){
    const amounts=parts(value),pretty=FORMAT.format(value),isHerd=key==='herd';
    const title=isHerd? value===1?'wildebeest':'wildebeest' : value===1?'grass unit':'grass units';
    const accent=isHerd?'#ead4a1':'#c9dda1',line=isHerd?'#e9cf8340':'#d2e5a946',surface=isHerd?'#272b20':'#243522';
    const grouped=amounts.some(n=>n>1),helper=grouped?'× shows how many each marker stands for':'1 marker = 1 '+(isHerd?'wildebeest':'grass unit');
    const token=(q,i)=>{
      const dx=x+19+(i%6)*58,dy=260+Math.floor(i/6)*37;
      const art=isHerd?`<use href="#${id}-animal" transform="translate(2 2) scale(.282)"/>`:`<use href="#${id}-grass" transform="translate(10 2) scale(.60)"/>`;
      return `<g data-cc-amount="${q}" transform="translate(${dx} ${dy})"><rect width="50" height="33" rx="7" fill="${isHerd?'#363b2d':'#35482f'}" stroke="${line}"/>${art}${grouped?`<rect x="19" y="15" width="30" height="17" rx="5" fill="${surface}" stroke="${line}"/><text x="34" y="27.5" text-anchor="middle" fill="${accent}" font-size="13" font-weight="800">×${FORMAT.format(q)}</text>`:''}</g>`;
    };
    return `<g data-cc-lane="${key}" data-cc-count="${value}">
      <rect x="${x}" y="172" width="378" height="269" rx="16" fill="${surface}" stroke="${line}" stroke-width="1.6"/>
      <text x="${x+20}" y="218" fill="${accent}" font-size="${pretty.length>11?25:36}" font-weight="800">${pretty}</text>
      <text x="${x+20}" y="244" fill="#fff4d7" font-size="19" font-weight="700">${title}</text>
      <path d="M${x+142} 234H${x+354}" stroke="${line}" stroke-width="1"/>
      <g class="cc-scene-markers">${amounts.length?amounts.map(token).join(''):`<text x="${x+22}" y="317" fill="#d9d2b7" font-size="19">None in this state</text>`}</g>
      ${amounts.length?`<text x="${x+20}" y="422" fill="#e8e5cc" font-size="15" font-weight="650">${helper}</text>`:''}
    </g>`;
  }

  function layers(id,{herd,grass,round,label}={}){
    const w=count(herd),g=count(grass);
    const primary=label?String(label).slice(0,45):roundLabel(round);
    return `<title id="${id}-title">Carrying capacity field board</title>
      <desc id="${id}-desc">${clean(primary)}. ${FORMAT.format(w)} wildebeest and ${FORMAT.format(g)} grass ${g===1?'unit':'units'} in this simulation. The illustrated landscape is decorative; only the two labelled panels represent counts.</desc>
      <style>
        [data-carrying-scene]{display:block;width:100%;height:auto;aspect-ratio:900/462;font-family:var(--f-body,system-ui,sans-serif)}
        [data-theme="dark"] [data-carrying-scene] [data-cc-night]{opacity:.32}
        @media(prefers-color-scheme:dark){:root:not([data-theme="light"]) [data-carrying-scene] [data-cc-night]{opacity:.32}}
        @media(prefers-reduced-motion:no-preference){[data-carrying-scene] .cc-scene-markers{animation:cc-scene-change 170ms ease-out}@keyframes cc-scene-change{from{opacity:.68}to{opacity:1}}}
      </style>
      ${symbols(id)}${plains(id)}
      <g aria-hidden="true">
        <rect x="51" y="127" width="798" height="33" rx="8" fill="#21382c" opacity=".96"/>
        <text x="65" y="149" fill="#fff5d3" font-size="17" letter-spacing="1" font-weight="800">${clean(primary)}</text>
        <text x="834" y="149" text-anchor="end" fill="#fff5d3" font-size="15" letter-spacing="1" font-weight="750">SIMULATED</text>
        ${lane(id,'herd',w,51)}${lane(id,'grass',g,471)}
      </g>`;
  }

  function createSVG(state={},id='cc-field'){
    return `<svg xmlns="${NS}" width="900" height="462" viewBox="0 0 900 462" role="img" aria-labelledby="${id}-title" aria-describedby="${id}-desc" data-carrying-scene="">${layers(id,state)}</svg>`;
  }

  function mount(host){
    if(!host)return null;
    const id='cc-field-'+(++index);
    const svg=document.createElementNS(NS,'svg');
    const attrs={width:900,height:462,viewBox:'0 0 900 462',role:'img','aria-labelledby':id+'-title','aria-describedby':id+'-desc','data-carrying-scene':''};
    Object.entries(attrs).forEach(([key,value])=>svg.setAttribute(key,value));
    host.replaceChildren(svg);
    let previous='';
    const update=(state={})=>{
      const key=JSON.stringify([state.herd,state.grass,state.round,state.label]);
      if(key===previous)return;
      previous=key;
      svg.innerHTML=layers(id,state);
    };
    update();
    return {update,destroy:()=>svg.remove()};
  }

  const api=Object.freeze({mount,createSVG,parts});
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.CarryingScene=api;
})(typeof window!=='undefined'?window:globalThis);
