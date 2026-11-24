/* Four-season field report for the B.1 Lesson 7 companion.
   Original vector map; the exact board coordinates come from the official
   Season/territory arrays already used by the game (SerengetiScene.BOARD).
   No historical token positions are inferred from these maps. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./serengeti-logic'), require('./serengeti-scene'));
  else root.SerengetiFieldReport = factory(root.SerengetiLogic, root.SerengetiScene);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L, scene) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const MONTHS = ['Dec–Feb','Mar–May','Jun–Aug','Sep–Nov'];
  const FILTERS = [['all','All records'],['migration','Migration'],['card','Event cards'],['hunt','Hunts']];
  const KIND = {migration:'Migration',card:'Event card',hunt:'Hunt'};
  const format = n => n < 0 ? '−' + Math.abs(n) : n > 0 ? '+' + n : '0';
  const isSeason = index => Number.isInteger(index) && index >= 0 && index < 4;
  let id = 0;

  function seasonSnapshot(index, board = scene.BOARD) {
    if (!isSeason(index)) throw new RangeError('A season index must be between 0 and 3.');
    const range = board.flat().filter(c => c.season === index);
    const grazing = range.filter(c => !c.territory && !c.blocked);
    return {range,grazing,cols:board[0].length,rows:board.length};
  }
  function summarize(state) {
    const summary = state ? L.results(state) : {change:0,seasons:[]};
    const log = state ? state.log : [];
    return {
      totalChange:summary.change,
      seasons:L.SEASONS.map((name,i) => {
        const tally=summary.seasons.find(s=>s.season===i);
        const records=log.filter(r=>r.season===i);
        const end=tally ? tally.end ?? records.at(-1)?.population ?? tally.start : null;
        return {
          index:i,name,months:MONTHS[i],start:tally?.start??null,end,delta:tally ? end-tally.start : null,
          cardChange:tally?.cardChange??null,huntChange:tally?.huntChange??null,
          status:!tally?'Not started':tally.end===null?'In progress':'Complete',records
        };
      })
    };
  }

  const el = (tag, cls, text) => {
    const n=document.createElement(tag);
    if (cls) n.className=cls;
    if (text!==undefined) n.textContent=text;
    return n;
  };
  const svgEl = (tag,attrs) => {
    const n=document.createElementNS(NS,tag);
    for (const [k,v] of Object.entries(attrs||{})) n.setAttribute(k,v);
    return n;
  };
  function outline(cells) {
    const keys = new Set(cells.map(c=>c.x+':'+c.y));
    return cells.flatMap(({x,y})=>[
      [x,y-1,'M'+x+' '+y+'h1'],[x+1,y,'M'+(x+1)+' '+y+'v1'],
      [x,y+1,'M'+x+' '+(y+1)+'h1'],[x-1,y,'M'+x+' '+y+'v1']
    ].filter(([a,b])=>!keys.has(a+':'+b)).map(([, ,d])=>d)).join('');
  }
  function renderMap(index, uid) {
    const {range,grazing,cols,rows}=seasonSnapshot(index);
    const map=svgEl('svg',{viewBox:'-1 -1 '+(cols+2)+' '+(rows+2),role:'presentation','aria-hidden':'true',focusable:'false'});
    const hatchId='sg-field-hatch-'+uid+'-'+index;
    const defs=svgEl('defs'), hatch=svgEl('pattern',{id:hatchId,width:'.56',height:'.56',patternUnits:'userSpaceOnUse',patternTransform:'rotate(34)'});
    hatch.append(svgEl('path',{d:'M0 0v.56',stroke:'#334234','stroke-width':'.13',opacity:'.63'}));
    defs.append(hatch); map.append(defs);
    map.append(svgEl('rect',{x:'-.45',y:'-.45',width:cols+.9,height:rows+.9,rx:'.68',fill:'#e2e7cc'}));
    map.append(svgEl('path',{d:'M0 0h8l4 4-2 5L2 8zM12 9l5-1v10l-7 3-3-4 4-4z',fill:'#d4dcb9'}));
    const board=scene.BOARD.flat();
    for (const c of board) if(c.season!==null||c.territory) {
      const fill=c.territory==='lion'?'#b78e59':c.territory==='hyena'?'#977969':'#c1c7a0';
      map.append(svgEl('rect',{x:c.x,y:c.y,width:1,height:1,fill,opacity:c.territory?'.54':'.6'}));
    }
    for (const c of grazing) {
      const attrs={x:c.x,y:c.y,width:1,height:1};
      map.append(svgEl('rect',{...attrs,fill:'#709777'}),svgEl('rect',{...attrs,fill:'url(#'+hatchId+')'}));
    }
    const grid=Array.from({length:cols+1},(_,x)=>'M'+x+' 0v'+rows).join('')+
      Array.from({length:rows+1},(_,y)=>'M0 '+y+'h'+cols).join('');
    map.append(svgEl('path',{d:grid,fill:'none',stroke:'#3d5042','stroke-width':'.04',opacity:'.44'}));
    map.append(svgEl('path',{d:outline(range),fill:'none',stroke:'#274536','stroke-width':'.16','stroke-linecap':'round'}));
    map.append(svgEl('path',{d:'M1.2 2.6v-1.05m-.38.42.38-.42.37.42',fill:'none',stroke:'#304539','stroke-width':'.115','stroke-linecap':'round','stroke-linejoin':'round'}));
    const north=svgEl('text',{x:1.2,y:1.3,'text-anchor':'middle','font-size':'.78','font-weight':'800',fill:'#304539'});
    north.textContent='N';map.append(north);
    return map;
  }
  function describe(record) {
    switch (record.kind) {
      case 'hunt': return [record.description,record.preyType && 'Wildebeest: '+(L.LABELS[record.preyType]||record.preyType),
        record.predatorType && 'Predator: '+(L.LABELS[record.predatorType]||record.predatorType),
        record.rounds?.length && record.rounds.length+' dice '+(record.rounds.length===1?'round':'rounds')].filter(Boolean).join(' ');
      default: return record.description||'';
    }
  }
  function mount(container,{onEvidence}={}) {
    if (!container) return null;
    const uid=++id;
    const bodyId='sg-field-season-readout-'+uid;
    const report=el('section','sg-field-report');
    const title=el('h3','','Four-Season Field Report');
    title.id='sg-field-title-'+uid;
    report.setAttribute('aria-labelledby',title.id);
    const top=el('div','sg-field-top');
    const header=el('div');
    header.append(el('p','sg-field-kicker','SERENGETI · FIELD NOTEBOOK'),title,
      el('p','sg-field-help','Choose a season to inspect its evidence. These maps show grazing areas, not earlier token positions.'));
    const yearTotal=el('p','sg-field-overall');
    top.append(header,yearTotal);
    const grid=el('div','sg-field-grid');
    grid.setAttribute('role','group');grid.setAttribute('aria-label','Choose a season');
    const cards=L.SEASONS.map((name,i)=>{
      const item=el('button','sg-field-season');
      item.type='button';item.dataset.season=String(i);item.setAttribute('aria-controls',bodyId);
      const labels=el('span','sg-field-labels');
      labels.append(el('strong','',name),el('span','sg-field-months',MONTHS[i]));
      const total=el('span','sg-field-net');
      const status=el('span','sg-field-status');
      // SVG is decorative; the visible button labels give a concise accessible name.
      item.append(labels,renderMap(i,uid),total,status);
      grid.append(item);
      return {item,total,status};
    });
    const legend=el('p','sg-field-legend');
    const swatch=el('span','sg-field-swatch');
    swatch.setAttribute('aria-hidden','true');
    legend.append(swatch,document.createTextNode('Hatched green: grazing squares. Heavy line: the season’s range.'));
    const panel=el('section','sg-field-readout');
    panel.id=bodyId;
    const panelHeading=el('h4','');
    panelHeading.id='sg-field-season-title-'+uid;
    panel.setAttribute('aria-labelledby',panelHeading.id);
    const details=el('div','sg-field-details');
    const filters=el('div','sg-field-filters');
    filters.setAttribute('role','group');filters.setAttribute('aria-label','Filter this season’s records');
    const filterButtons=FILTERS.map(([key,label])=>{
      const b=el('button','',label);b.type='button';b.dataset.filter=key;
      b.setAttribute('aria-controls','sg-field-records-'+uid);
      filters.append(b);
      return b;
    });
    const records=el('div','sg-field-records');
    records.id='sg-field-records-'+uid;
    panel.append(panelHeading,details,filters,records);
    report.append(top,grid,legend,panel);
    container.replaceChildren(report);

    let current=summarize(null), selected=0, filter='all', chosen=false;
    function metric(label,value){
      const box=el('div');
      box.append(el('dt','',label),el('dd','',value));
      return box;
    }
    function renderRecords(season) {
      filterButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
      const found=season.records.filter(r=>filter==='all'||r.kind===filter);
      if (!found.length) {
        records.replaceChildren(el('p','sg-field-empty',season.status==='Not started'
          ? 'Play this season to collect evidence.' : 'No '+(filter==='all'?'records':'matching records')+' yet for this season.'));
        return;
      }
      const list=el('ol','sg-field-ledger');
      found.forEach(record=>{
        const entry=el('li');
        const labels=el('div','sg-field-row-label');
        labels.append(el('span','sg-field-kind',KIND[record.kind]||'Event'),el('strong','',record.title||'Board event'));
        const value=el('span','sg-field-row-value','Change '+format(record.change)+' · cumulative '+format(record.population));
        const detail=describe(record);
        entry.append(labels,value);
        if(detail)entry.append(el('p','',detail));
        list.append(entry);
      });
      records.replaceChildren(list);
    }
    function render() {
      const played=current.seasons.some(s=>s.start!==null);
      yearTotal.textContent=played?'Year so far: '+format(current.totalChange)+' cumulative change':'Year not yet started';
      cards.forEach(({item,total,status},i)=>{
        const season=current.seasons[i];
        item.setAttribute('aria-pressed',String(i===selected));
        total.textContent=season.delta===null?'No records yet':'Season change '+format(season.delta);
        status.textContent=season.status;
      });
      const season=current.seasons[selected];
      panelHeading.textContent=season.name+' evidence';
      if (season.start===null) details.replaceChildren();
      else {
        const dl=el('dl','sg-field-metrics');
        dl.append(metric('Cumulative change',format(season.start)+' → '+format(season.end)),
          metric('Event cards',format(season.cardChange)),metric('Hunts',format(season.huntChange)));
        details.replaceChildren(dl);
      }
      renderRecords(season);
    }
    function select(season) {
      if (!isSeason(season)) return;
      selected=season; chosen=true; filter='all'; render();
      if (onEvidence) onEvidence(season,current.seasons[season]);
    }
    cards.forEach(({item},i)=>{
      item.addEventListener('click',()=>select(i));
      item.addEventListener('keydown',e=>{
        const next={ArrowLeft:(i+3)%4,ArrowRight:(i+1)%4,Home:0,End:3}[e.key];
        if(next===undefined)return;
        e.preventDefault(); select(next); cards[next].item.focus();
      });
    });
    filterButtons.forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;renderRecords(current.seasons[selected]);}));
    function update(state) {
      current=summarize(state);
      if (!state) {selected=0;chosen=false;filter='all';}
      else if(!chosen&&isSeason(state.season)) selected=state.season;
      render();
    }
    function destroy() {report.remove();}
    update(null);
    return {update,select,destroy};
  }
  return {mount,summarize,seasonSnapshot};
});
