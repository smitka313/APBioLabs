/* OpenSciEd printable and editable submissions. Activity adapters supply a local,
   recovery-aware snapshot and its authoritative completion status. No persistence. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OpenSciEdSubmission = api;
}(typeof window === 'object' ? window : globalThis, function (root) {
  'use strict';
  const doc = root.document;
  const localeDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const labels = Object.freeze({
    final: 'Activity complete',
    draft: 'In progress',
    recovery: 'Recovered work',
  });
  const words = Object.freeze({
    final: 'The required work is included. This is not a grade or an authenticity check.',
    draft: 'This report is a draft. It does not show completion.',
    recovery: 'This copy preserves work from this tab. It is not marked complete.',
  });
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function string(value, fieldName, required) {
    if (value == null && !required) return '';
    if (typeof value !== 'string' || (required && !value.trim())) throw new TypeError('Invalid report ' + fieldName);
    return value;
  }
  function cell(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return String(value);
    throw new TypeError('Report values must be text, finite numbers, or booleans.');
  }
  function list(value, fieldName) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new TypeError('Invalid report ' + fieldName);
    return value;
  }
  function record(value, fieldName) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid report ' + fieldName);
    return value;
  }
  function item(raw) {
    const i = record(raw, 'item');
    if (i.type === 'text') return { type: i.type, text: string(i.text, 'text') };
    if (i.type === 'answer') return { type: i.type, prompt: string(i.prompt, 'prompt', true), value: cell(i.value) };
    if (i.type === 'table') {
      const columns = list(i.columns, 'columns').map(c => string(c, 'column label', true));
      if (!columns.length) throw new TypeError('Report tables need column labels.');
      return { type: i.type, title: string(i.title, 'table title'), columns,
        rows: list(i.rows, 'rows').map(row => {
          if (!Array.isArray(row) || row.length !== columns.length) throw new TypeError('Report table row does not match its column labels.');
          return row.map(cell);
        }) };
    }
    throw new TypeError('Unknown report item type.');
  }

  function normalize(raw, printDate = new Date()) {
    const r = record(raw, 'snapshot');
    const identity = r.student == null ? null : record(r.student, 'student');
    const student = identity ? { name: string(identity.name, 'name'), period: string(identity.period, 'class period') } : { name: '', period: '' };
    const title = string(r.title, 'title', true);
    const unit = string(r.unit, 'unit', true);
    const source = string(r.source, 'source', true);
    const missing = [...new Set(list(r.missing, 'remaining items').map(v => string(v, 'remaining item', true).trim()))];
    const datasetId = string(r.datasetId, 'Dataset ID').trim();
    const keyResults = list(r.keyResults, 'key results').map(rawResult => {
      const k = record(rawResult, 'key result');
      return { label: string(k.label, 'result label', true), value: cell(k.value), unit: string(k.unit, 'result unit'), note: string(k.note, 'result note') };
    });
    const sections = list(r.sections, 'sections').map(rawSection => {
      const s = record(rawSection, 'section');
      return { title: string(s.title, 'section heading', true), items: list(s.items, 'items').map(item) };
    });
    const hasEvidence = keyResults.some(k => k.value.trim()) || sections.some(s => s.items.some(i => i.type === 'answer'
      ? i.value.trim() : i.type === 'table' ? i.rows.some(row => row.some(c => c.trim())) : i.text.trim()));
    const requested = own(labels, r.status) ? r.status : 'draft';
    const status = requested === 'final' && (!hasEvidence || missing.length) ? 'draft' : requested;
    return { title, unit, source, status, student, datasetId, keyResults, sections, missing, exportedAt: printDate.toISOString(), printTime: localeDate.format(printDate) };
  }

  function identityRows(r) {
    return [['Name', r.student.name || 'Not entered'], ['Class period', r.student.period || 'Not entered'],
      ['Report created', r.printTime]].concat(r.datasetId ? [['Dataset ID', r.datasetId]] : []);
  }
  function resultTable(r) {
    const notes = r.keyResults.some(k => k.note);
    return { columns: notes ? ['Result', 'Value', 'Notes'] : ['Result', 'Value'],
      rows: r.keyResults.map(k => [k.label, [k.value, k.unit].filter(Boolean).join(' ')].concat(notes ? [k.note] : [])) };
  }
  // The exact AP seal needs an actual dataset ID, since no ID would make it use
  // the current AP seed. Activities without Lab/dataset get a completion-only seal.
  function stampFor(r) {
    if (r.status !== 'final' || !r.student.name.trim()) return null;
    try {
      const exact = r.datasetId && root.Lab?.stamp?.png?.({ datasetId: r.datasetId, date: new Date(r.exportedAt) });
      if (exact) return exact;
      const canvas = doc.createElement('canvas'), s = 400;
      canvas.width = canvas.height = s;
      const c = canvas.getContext('2d');
      c.translate(s / 2, s / 2); c.rotate(-8 * Math.PI / 180);
      c.fillStyle = c.strokeStyle = '#1b4a9a'; c.textAlign = 'center'; c.textBaseline = 'middle';
      [174, 158].forEach((radius, i) => { c.beginPath(); c.arc(0, 0, radius, 0, 2 * Math.PI); c.lineWidth = i ? 3 : 8; c.stroke(); });
      c.font = '700 21px Arial, sans-serif'; c.fillText('BIOLOGY LAB BENCH', 0, -76);
      c.font = '900 37px Arial, sans-serif'; c.fillText('ACTIVITY', 0, -20); c.fillText('COMPLETE', 0, 25);
      c.font = '700 17px Arial, sans-serif'; c.fillText('REQUIRED WORK INCLUDED', 0, 81);
      const dataUrl = canvas.toDataURL('image/png');
      return { dataUrl, bytes: Uint8Array.from(root.atob(dataUrl.split(',')[1]), c => c.charCodeAt(0)) };
    } catch (_) { return null; }
  }

  function node(tag, className, content) {
    const n = doc.createElement(tag);
    if (className) n.className = className;
    if (content != null) n.textContent = content;
    return n;
  }
  function webTable(model) {
    const t = node('table', 'osr-table');
    if (model.title) t.append(node('caption', '', model.title));
    const head = node('thead'), tr = node('tr');
    model.columns.forEach(c => {
      const th = node('th', '', c); th.scope = 'col'; tr.append(th);
    });
    head.append(tr); t.append(head);
    const body = node('tbody');
    if (!model.rows.length) {
      const row = node('tr'), empty = node('td', 'osr-muted', 'No data recorded'); empty.colSpan = model.columns.length;
      row.append(empty); body.append(row);
    }
    model.rows.forEach(row => {
      const tr = node('tr'); row.forEach(c => tr.append(node('td', '', c || '—'))); body.append(tr);
    });
    t.append(body);
    const wrapper = node('div', 'osr-table-wrap');
    wrapper.append(t);
    if (model.columns.length > 4) {
      wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', model.title || 'Data table');
    }
    return wrapper;
  }
  function article(r, titleId) {
    const a = node('article', 'osr-paper');
    const header = node('header', 'osr-header');
    const eyebrow = node('p', 'osr-eyebrow', 'Biology Lab Bench · OpenSciEd · ' + r.unit);
    const heading = node('h2', 'osr-title', r.title); heading.id = titleId; heading.tabIndex = -1;
    const meta = node('dl', 'osr-meta');
    identityRows(r).forEach(([key, value]) => {
      const entry = node('div'); entry.append(node('dt', '', key), node('dd', '', value)); meta.append(entry);
    });
    const badge = node('p', 'osr-label osr-label--' + r.status, labels[r.status]);
    const stamp = stampFor(r);
    if (stamp) {
      const img = node('img', 'osr-stamp');
      img.src = stamp.dataUrl; img.width = 112; img.height = 112; img.alt = '';
      header.append(img);
    }
    header.append(eyebrow, heading, badge, meta, node('p', 'osr-status-note', words[r.status]), node('p', 'osr-source', 'Evidence source: ' + r.source));
    if (r.missing.length) {
      const missing = node('div', 'osr-missing'), items = node('ul');
      r.missing.forEach(s => items.append(node('li', '', s)));
      missing.append(node('h3', '', 'Still to do'), items);
      header.append(missing);
    }
    a.append(header);
    if (r.keyResults.length) {
      const section = node('section', 'osr-section');
      section.append(node('h3', '', 'Key results'), webTable(resultTable(r)));
      a.append(section);
    }
    r.sections.forEach(s => {
      const section = node('section', 'osr-section'); section.append(node('h3', '', s.title));
      s.items.forEach(i => {
        if (i.type === 'table') section.append(webTable(i));
        else if (i.type === 'text') section.append(node('p', 'osr-text', i.text));
        else if (i.type === 'answer') {
          const answer = node('div', 'osr-answer');
          answer.append(node('h4', '', i.prompt), node('p', i.value.trim() ? '' : 'osr-muted', i.value.trim() ? i.value : '(No response yet)'));
          section.append(answer);
        }
      });
      a.append(section);
    });
    return a;
  }

  // Serengeti has no Lab toolkit. Match the AP renderer's pinned browser build.
  const defaultWordUrls = ['https://cdn.jsdelivr.net/npm/docx@9.0.2/build/index.umd.js', 'https://unpkg.com/docx@9.0.2/build/index.umd.js'];
  let wordLibrary = null;
  function fetchScript(src) {
    return new Promise((resolve, reject) => {
      const script = node('script');
      let timer;
      const release = () => { root.clearTimeout(timer); script.onload = script.onerror = null; };
      const fail = () => { release(); script.remove(); reject(new Error('Could not load the Word exporter.')); };
      script.src = src; script.async = true; script.referrerPolicy = 'no-referrer';
      script.onload = () => { release(); resolve(); }; script.onerror = fail;
      timer = root.setTimeout(fail, 8000);
      doc.head.append(script);
    });
  }
  async function loadWord() {
    if (root.docx?.Packer) return root.docx;
    if (!wordLibrary) wordLibrary = (async () => {
      for (const url of root.Lab?.report?.docxUrls || defaultWordUrls) {
        try { await fetchScript(url); if (root.docx?.Packer) return root.docx; }
        catch (_) { /* Fallback to the next pinned Lab Bench URL. */ }
      }
      throw new Error('Word exporter unavailable.');
    })().catch(error => { wordLibrary = null; throw error; });
    return wordLibrary;
  }
  async function word(r, library) {
    const D = library || await loadWord();
    const { Document, Packer, TextRun, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType,
      Header, Footer, PageNumber, BorderStyle, ShadingType } = D;
    const run = (text, opts = {}) => new TextRun({ text, ...opts });
    const p = (text, opts = {}, textOpts) => new Paragraph({ children: [run(text, textOpts)], ...opts });
    const h = (text, level = HeadingLevel.HEADING_1) => p(text, { heading: level, keepNext: true, spacing: { before: 260, after: 100 } });
    function paraLines(value, options) {
      return value.split(/\r?\n/).map(line => p(line, { spacing: { after: 70 } }, options));
    }
    const border = { style: BorderStyle.SINGLE, color: 'CFD9DE', size: 4 };
    function box(value, head) {
      return new TableCell({
        borders: { top: border, right: border, bottom: border, left: border },
        margins: { top: 90, right: 110, bottom: 90, left: 110 },
        ...(head ? { shading: { type: ShadingType.CLEAR, fill: 'E1EBEF', color: 'auto' } } : {}),
        children: paraLines(value || '—', { size: 19, ...(head ? { bold: true, color: '123747' } : {}) }),
      });
    }
    function table(t) {
      const rows = [new TableRow({ tableHeader: true, cantSplit: true, children: t.columns.map(v => box(v, true)) })];
      t.rows.forEach(row => rows.push(new TableRow({ children: row.map(v => box(v, false)) })));
      if (!t.rows.length) rows.push(new TableRow({ children: [new TableCell({ columnSpan: t.columns.length, children: [p('No data recorded')] })] }));
      return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
    }
    const stamp = stampFor(r);
    const content = [
      p('Biology Lab Bench · OpenSciEd · ' + r.unit, {}, { bold: true, color: '365767' }),
      p(r.title, { heading: HeadingLevel.TITLE, keepNext: true }),
      p(labels[r.status].toUpperCase(), { spacing: { after: 130 }, keepNext: true }, { bold: true, color: r.status === 'final' ? '16425B' : '4A525A', size: 24 }),
    ];
    if (stamp && D.ImageRun) {
      content.push(new Paragraph({ children: [new D.ImageRun({ type: 'png', data: stamp.bytes,
        transformation: { width: 90, height: 90 }, altText: { name: 'Activity complete', title: 'Activity complete', description: 'Required work is included. Not a grade or an authenticity check.' } })] }));
    }
    identityRows(r).forEach(([key, value]) => content.push(new Paragraph({ children: [run(key + ': ', { bold: true }), run(value)] })));
    content.push(p(words[r.status], { spacing: { before: 130, after: 90 } }, { italics: true }));
    content.push(p('Evidence source: ' + r.source));
    if (r.missing.length) {
      content.push(h('Still to do'));
      r.missing.forEach(v => content.push(p(v, { bullet: { level: 0 } })));
    }
    if (r.keyResults.length) content.push(h('Key results'), table(resultTable(r)));
    r.sections.forEach(s => {
      content.push(h(s.title));
      s.items.forEach(i => {
        if (i.type === 'table') {
          if (i.title) content.push(h(i.title, HeadingLevel.HEADING_2));
          content.push(table(i));
        } else if (i.type === 'text') content.push(...paraLines(i.text));
        else if (i.type === 'answer') {
          content.push(h(i.prompt, HeadingLevel.HEADING_2));
          content.push(...paraLines(i.value.trim() ? i.value : '(No response yet)', { italics: !i.value.trim() }));
        }
      });
    });
    const footer = new Paragraph({ alignment: D.AlignmentType.RIGHT, children: [run('Page ', { size: 18, color: '40535D' }),
      new TextRun({ children: [PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 18, color: '40535D' })] });
    return Packer.toBlob(new Document({
      creator: 'Biology Lab Bench',
      title: r.title,
      styles: { default: { document: { run: { font: 'Calibri', size: 22, color: '172730' } } } },
      sections: [{
        properties: { page: { margin: { top: 1050, right: 960, bottom: 990, left: 960, header: 360, footer: 390 } } },
        headers: { default: new Header({ children: [p(r.unit + ' · ' + r.title, { border: { bottom: border } }, { size: 18, color: '40535D' })] }) },
        footers: { default: new Footer({ children: [footer] }) },
        children: content,
      }],
    }));
  }

  function nameFor(r, custom) {
    const stem = String(custom || r.title).replace(/\.docx$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (stem || 'openscied') + (r.status === 'final' ? '-submission' : r.status === 'recovery' ? '-recovery' : '-draft') + '.docx';
  }
  function downloadBlob(blob, filename) {
    const url = root.URL.createObjectURL(blob), link = node('a');
    link.href = url; link.download = filename; link.hidden = true;
    doc.body.append(link); link.click(); link.remove(); root.setTimeout(() => root.URL.revokeObjectURL(url), 3000);
  }
  function action(text, primary) {
    const b = node('button', 'btn' + (primary ? ' btn--primary' : ''), text);
    b.type = 'button'; return b;
  }
  // App step routing controls portal visibility. Inspect only the candidate slots
  // and their ancestors, not every changing style attribute in the simulations.
  function isShown(n) {
    if (!n?.isConnected || n.closest('[hidden], [aria-hidden="true"], [inert], details:not([open])')) return false;
    const style = root.getComputedStyle(n);
    if (style.visibility === 'hidden' || style.visibility === 'collapse' || style.display === 'none') return false;
    if (style.display === 'contents') return isShown(n.parentElement);
    return n.getClientRects().length > 0;
  }
  function placeLauncher(config, target, tray, open) {
    const finals = typeof config.finalTarget === 'string' ? [...doc.querySelectorAll(config.finalTarget)]
      : config.finalTarget ? [config.finalTarget] : [...doc.querySelectorAll('[data-ose-report-final]')];
    if (!finals.length) { target.append(tray); return () => {}; }
    function place() {
      const destination = finals.find(n => n !== target && isShown(n)) || target;
      if (tray.parentElement === destination) return;
      const restoreFocus = tray.contains(doc.activeElement);
      destination.append(tray);
      if (restoreFocus && isShown(open)) open.focus({ preventScroll: true });
    }
    const observer = new root.MutationObserver(place);
    const watched = new Set();
    for (const slot of finals) for (let n = slot; n && !watched.has(n); n = n.parentElement) {
      watched.add(n);
      observer.observe(n, { childList: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'inert', 'class', 'style', 'open'] });
    }
    root.addEventListener('hashchange', place);
    root.addEventListener('resize', place);
    place();
    return () => {
      observer.disconnect();
      root.removeEventListener('hashchange', place);
      root.removeEventListener('resize', place);
    };
  }

  let serial = 0;

  function mount(config) {
    if (!doc || !config || typeof config.collect !== 'function') throw new TypeError('A report collector is required.');
    const target = typeof config.target === 'string' ? doc.querySelector(config.target) : config.target;
    if (!target || typeof target.append !== 'function') throw new TypeError('The report controls need a mount target.');
    const titleId = 'openscied-report-title-' + (++serial);
    const tray = node('div', 'osr-actions');
    const open = action('Preview report', true);
    // Do not add a live region; several activities maintain their own one-region narration.
    const live = node('p', 'osr-live');
    live.id = titleId + '-page-status'; live.tabIndex = -1;
    open.setAttribute('aria-describedby', live.id);
    const dialog = node('dialog', 'osr-dialog'); dialog.setAttribute('aria-labelledby', titleId);
    const capture = () => normalize(config.collect());
    function message(status, text, focus) {
      status.textContent = text;
      if (typeof config.announce === 'function') config.announce(text);
      if (focus && status.getClientRects().length) status.focus();
    }
    const launchWord = async (report, button, status) => {
      button.disabled = true;
      message(status, 'Preparing your Word file…');
      try {
        downloadBlob(await word(report), nameFor(report, config.filename));
        message(status, 'Word report downloaded.');
      } catch (_) {
        message(status, 'Could not download the Word file. You can still print or save as PDF from the preview.', true);
      } finally { button.disabled = false; }
    };
    function show() {
      let report;
      try { report = capture(); }
      catch (_) { message(live, 'Could not prepare a report. Your work has not changed.', true); return; }
      live.textContent = '';
      const tools = node('div', 'osr-tools'), controls = node('div', 'osr-actions');
      const print = action('Print or save as PDF', true), save = action('Download .docx'), close = action('Close report');
      const status = node('p', 'osr-live');
      status.id = titleId + '-preview-status'; status.tabIndex = -1;
      print.setAttribute('aria-describedby', status.id); save.setAttribute('aria-describedby', status.id);
      const formats = node('details', 'osr-formats');
      formats.append(node('summary', '', 'More formats'), save);
      controls.append(print, close);
      tools.append(controls, node('p', 'osr-screen-help', 'In the print window, choose “Save as PDF” to download a PDF file.'), formats, status);
      const preview = article(report, titleId);
      dialog.replaceChildren(tools, preview);
      try { dialog.showModal(); }
      catch (_) { message(live, 'Could not open the report preview. Your work has not changed.', true); return; }
      doc.body.classList.add('openscied-report-print');
      print.addEventListener('click', () => {
        if (!root.print) { message(status, 'Printing is not available. Try downloading the Word file.', true); return; }
        try { root.print(); }
        catch (_) { message(status, 'Could not open the print window. Try downloading the Word file.', true); }
      });
      save.addEventListener('click', () => launchWord(report, save, status));
      close.addEventListener('click', () => dialog.close());
      preview.querySelector('.osr-title').focus();
    }
    open.addEventListener('click', show);
    dialog.addEventListener('close', () => {
      doc.body.classList.remove('openscied-report-print');
      if (isShown(open)) open.focus({ preventScroll: true });
    });
    tray.append(open, live);
    const stopPlacing = placeLauncher(config, target, tray, open);
    doc.body.append(dialog);
    return { open: show, destroy() { stopPlacing(); if (dialog.open) { dialog.close(); doc.body.classList.remove('openscied-report-print'); } dialog.remove(); tray.remove(); } };
  }

  return Object.freeze({ mount, normalize, word });
}));
