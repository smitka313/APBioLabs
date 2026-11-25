/* Pure sorting, ranking and scatterplot fit for Cancer Rates Data Dive. */
(function(root){
  'use strict';
  const finite=Number.isFinite;
  const norm=s=>String(s??'').toLocaleLowerCase('en-US').trim();
  function sortRows(rows,key,dir='desc',query=''){
    const q=norm(query), sign=dir==='asc'?1:-1;
    return rows.filter(r=>!q||(norm(r.name)+' '+norm(r.id)).includes(q)).sort((a,b)=>{
      const name=a.name.localeCompare(b.name,'en-US');
      if(key==='name')return sign*name;
      const an=finite(a[key]),bn=finite(b[key]);
      if(an!==bn)return an?-1:1; // Missing stays last in either direction.
      return (an?sign*(a[key]-b[key]):0)||name;
    });
  }
  function rankRows(rows,key){
    const result={};
    let last,rank=0;
    sortRows(rows,key).filter(r=>finite(r[key])).forEach((r,i)=>{
      if(r[key]!==last)rank=i+1; // Equal rates share rank at reported precision.
      result[r.id]=rank;
      last=r[key];
    });
    return result;
  }
  function fitLine(rows,xKey='poverty',yKey='incidence'){
    const pairs=rows.filter(r=>finite(r[xKey])&&finite(r[yKey]));
    if(pairs.length<3)return null;
    const n=pairs.length, x=pairs.reduce((s,r)=>s+r[xKey],0)/n,y=pairs.reduce((s,r)=>s+r[yKey],0)/n;
    const numerator=pairs.reduce((s,r)=>s+(r[xKey]-x)*(r[yKey]-y),0);
    const denominator=pairs.reduce((s,r)=>s+(r[xKey]-x)**2,0);
    if(denominator<=Number.EPSILON)return null;
    const slope=numerator/denominator;
    return {slope,intercept:y-slope*x,n,min:Math.min(...pairs.map(r=>r[xKey])),max:Math.max(...pairs.map(r=>r[xKey]))};
  }
  function comparison(dataset,pin){
    if(!pin||!Object.hasOwn(dataset,pin.view))return null;
    const rows=dataset[pin.view].rows;
    const other={types:'mortality',states:'count',poverty:'poverty',race:'mortality'}[pin.view];
    const measures=pin.view==='stage'?['early-share','diagnosed']:pin.view==='michigan'?['late-rate','late-share','screening','incidence','income']:['incidence',other,...(pin.view==='poverty'?['income']:[])];
    if(!measures.includes(pin.measure))return null;
    const a=rows.find(r=>r.id===pin.a),b=rows.find(r=>r.id===pin.b);
    if(!a||!b||a.id===b.id)return null;
    return {a,b,difference:finite(a[pin.measure])&&finite(b[pin.measure])?Math.round(Math.abs(a[pin.measure]-b[pin.measure])*10)/10:null};
  }
  const isNumericComparison = pair => Number.isFinite(pair?.difference);
  function hasPendingQuestion(casework) {
    return typeof casework?.questionDraft === 'string' &&
      casework.questionDraft.trim() !== String(casework.question || '').trim();
  }
  // Fixed exhibits use ordered income groups. Judge the plotted pattern, not a student’s wording.
  function exhibitTrend(values){
    if(!Array.isArray(values)||values.length<2||!values.every(finite))return null;
    const first=values[0], last=values.at(-1);
    if(values.every(v=>v===first))return 'flat';
    if(last>first&&values.every((v,i)=>i===0||v>=values[i-1]))return 'rising';
    if(last<first&&values.every((v,i)=>i===0||v<=values[i-1]))return 'falling';
    return null;
  }
  const api={sortRows,rankRows,fitLine,comparison,isNumericComparison,hasPendingQuestion,exhibitTrend};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CancerRatesLogic=api;
})(typeof globalThis==='object'?globalThis:this);
