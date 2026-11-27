/* Unit 5 standalone report files. Uses the same activity collector as Preview/Word.
   No storage changes, network requests, or raw browser save records. */
(function(root) {
  'use strict';
  const statusText = {
    final: 'Required work was recorded. This does not show who did the work or how well.',
    draft: 'You can turn in this draft if your teacher assigned only part of the activity.',
    recovery: 'This copy contains work still open in this tab. It is not a completed submission.'
  };
  const main = root.document;
  function html(report) {
    const doc=main.implementation.createHTMLDocument(report.title);
    doc.documentElement.lang='en';
    const add=(host,tag,value)=>{
      const n=doc.createElement(tag);
      if(value!==undefined)n.textContent=value;
      host.append(n);return n;
    };
    const charset=doc.createElement('meta');charset.charset='utf-8';doc.head.prepend(charset);
    const viewport=add(doc.head,'meta');viewport.name='viewport';viewport.content='width=device-width, initial-scale=1';
    add(doc.head,'style','body{font:16px/1.5 system-ui,sans-serif;color:#163532;background:#fff;margin:1.5rem auto;padding:0 1rem;max-width:850px} h1,h2,h3{line-height:1.2} p{overflow-wrap:anywhere;white-space:pre-wrap} section{border-top:1px solid #b7c9c2} table{border-collapse:collapse;width:100%;table-layout:fixed} th,td{padding:.45rem;border:1px solid #b7c9c2;text-align:left;overflow-wrap:anywhere}');
    add(doc.body,'h1',report.title);
    add(doc.body,'p',report.unit);
    add(doc.body,'p',statusText[report.status]);
    add(doc.body,'p','Name: '+(report.student.name||'Not entered')+' · Class period: '+(report.student.period||'Not entered'));
    if(report.datasetId)add(doc.body,'p','Dataset ID: '+report.datasetId);
    add(doc.body,'p','Evidence sources: '+report.source);
    if(report.missing.length){
      add(doc.body,'h2','Still to do');const list=add(doc.body,'ul');
      report.missing.forEach(m=>add(list,'li',m));
    }
    for(const group of report.sections){
      const part=add(doc.body,'section');add(part,'h2',group.title);
      for(const item of group.items){
        if(item.type==='answer'){add(part,'h3',item.prompt);add(part,'p',item.value||'Not answered');}
        else if(item.type==='text'){add(part,'p',item.text);}
        else if(item.type==='table'){
          const t=add(part,'table');if(item.title)add(t,'caption',item.title);
          const head=add(add(t,'thead'),'tr'),body=add(t,'tbody');
          for(const col of item.columns)add(head,'th',col).scope='col';
          for(const values of item.rows){const tr=add(body,'tr');for(const v of values)add(tr,'td',v);}
        }
      }
    }
    return '<!doctype html>\n'+doc.documentElement.outerHTML;
  }
  function download(content,mime,filename) {
    const url=root.URL.createObjectURL(new Blob([content],{type:mime}));
    const a=main.createElement('a');a.href=url;a.download=filename;a.hidden=true;
    main.body.append(a);a.click();a.remove();
    root.setTimeout(()=>root.URL.revokeObjectURL(url),1800);
  }
  function bindHTML(button,collect,basename,announce=()=>{}){
    button.addEventListener('click',()=>{
      try{
        const report=root.OpenSciEdSubmission.normalize(collect());
        download(html(report),'text/html;charset=utf-8',basename+'-'+report.datasetId+'.html');
        announce('HTML report downloaded to this device. It has not been submitted.');
      }catch(_){announce('Could not download this report. Your work has not changed.');}
    });
  }
  root.OpenSciEdB5ReportFiles=Object.freeze({bindHTML,download});
})(window);
