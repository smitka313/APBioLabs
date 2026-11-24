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
  const localeDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });
  const labels = Object.freeze({
    final: 'Activity complete',
    draft: 'In progress',
    recovery: 'Recovered work',
  });
  const words = Object.freeze({
    final: 'Required work was recorded. This does not show who did the work or how well.',
    draft: 'You can turn in this draft if your teacher assigned only part of the activity.',
    recovery: 'This copy contains work still open in this tab. It is not a completed submission.',
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
    return { title, unit, source, status, student, allowIdentityEdit: status !== 'recovery' && r.allowIdentityEdit !== false,
      datasetId, keyResults, sections, missing, exportedAt: printDate.toISOString(), printTime: localeDate.format(printDate) };
  }

  function identityRows(r) {
    return [['Name', r.student.name || 'Not entered'], ['Class period', r.student.period || 'Not entered'],
      ['Date', r.printTime]].concat(r.datasetId ? [['Dataset ID', r.datasetId]] : []);
  }
  // Running metadata is compact; the first-page identity always remains unabridged.
  function runningText(value, limit) {
    const chars = Array.from(value.replace(/\s+/g, ' ').trim());
    return chars.length <= limit ? chars.join('') : chars.slice(0, limit - 1).join('') + '…';
  }
  function runningInfo(r) {
    return {
      who: runningText((r.student.name.trim() || 'Name not entered') + (r.student.period.trim() ? ' · Class ' + r.student.period.trim() : ''), 44),
      title: runningText(r.title, 46),
      dataset: r.datasetId ? 'Dataset ID: ' + runningText(r.datasetId, 40) : '',
    };
  }
  function printRunningStyle(r) {
    const info = runningInfo(r);
    // Use a CSS codepoint escape for every character. Names, titles, and IDs
    // cannot end the quoted CSS value or inject new margin-box declarations.
    const cssValue = text => '"' + Array.from(text, ch => '\\' + ch.codePointAt(0).toString(16) + ' ').join('') + '"';
    const style = doc.createElement('style');
    style.textContent = '@page openscied-submission { @top-left {content:' + cssValue(info.who) + ';} @top-right {content:'
      + cssValue(info.title) + ';} @bottom-left {content:' + (info.dataset ? cssValue(info.dataset) : 'none') + ';} }';
    return style;
  }
  function resultTable(r) {
    const notes = r.keyResults.some(k => k.note);
    return { columns: notes ? ['Result', 'Value', 'Notes'] : ['Result', 'Value'],
      rows: r.keyResults.map(k => [k.label, [k.value, k.unit].filter(Boolean).join(' ')].concat(notes ? [k.note] : [])) };
  }
  /* The AP Bench seal geometry, blue ink, tilt and distress pattern, adapted
     from lab.js. No Lab dependency: Serengeti intentionally uses its own chrome.
     The engraving says completion, never verification of a student or grade. */
  function stampHash(str) { // cyrb53, folded to 32 bits
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }
  function stampRandom(a) {
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const stampDate = d => { d = d instanceof Date ? d : new Date(d || Date.now()); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  function drawActivitySeal(r) {
    const S = 480, id = r.datasetId.toUpperCase(), date = stampDate(r.exportedAt);
    const ink = '#1b4a9a';
    const rnd = stampRandom(stampHash(id + '|' + date + '|openscied-stamp'));
    const clean = doc.createElement('canvas'); clean.width = clean.height = S;
    const c = clean.getContext('2d'), cx = S / 2, cy = S / 2;
    c.fillStyle = c.strokeStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = 11; c.beginPath(); c.arc(cx, cy, 218, 0, 6.2832); c.stroke();
    c.lineWidth = 3.5; c.beginPath(); c.arc(cx, cy, 199, 0, 6.2832); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 120, 0, 6.2832); c.stroke();
    const arc = (text, r, mid, size, top) => {
      const chars = Array.from(text);
      let sp, ws, total;
      do {
        c.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
        sp = size * 0.16; ws = chars.map(ch => c.measureText(ch).width + sp); total = ws.reduce((a, b) => a + b, 0) - sp;
      } while (total > r * 2.9 && --size > 18);
      let a = top ? mid - total / r / 2 : mid + total / r / 2;
      chars.forEach((ch, i) => {
        const w = ws[i] - sp, th = a + (top ? 1 : -1) * (w / 2) / r;
        c.save(); c.translate(cx + Math.cos(th) * r, cy + Math.sin(th) * r); c.rotate(top ? th + Math.PI / 2 : th - Math.PI / 2); c.fillText(ch, 0, 0); c.restore();
        a += (top ? 1 : -1) * ws[i] / r;
      });
    };
    arc('ACTIVITY COMPLETE', 152, -Math.PI / 2, 40, true);
    arc('★ BIOLOGY LAB BENCH ★', 152, Math.PI / 2, 29, false);
    c.font = '700 24px Consolas, "Courier New", monospace'; c.fillText(id ? 'DATASET ID' : 'REQUIRED WORK', cx, cy - 52);
    let fs = id ? 60 : 39; c.font = `700 ${fs}px Consolas, "Courier New", monospace`;
    while (id && c.measureText(id).width > 200 && fs > 22) { fs -= 2; c.font = `700 ${fs}px Consolas, "Courier New", monospace`; }
    c.fillText(id || 'INCLUDED', cx, cy - 4, 200);
    c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 84, cy + 32); c.lineTo(cx + 84, cy + 32); c.stroke();
    c.font = '700 29px Consolas, "Courier New", monospace'; c.fillText(date, cx, cy + 58);
    // roughen: tilt −8°, jitter the edge, thin the ink unevenly (low-frequency blotches + pressure gradient + speckle)
    const out = doc.createElement('canvas'); out.width = out.height = S;
    const x = out.getContext('2d');
    x.translate(cx, cy); x.rotate(-8 * Math.PI / 180); x.translate(-cx, -cy);
    [[0, 0, 1], [0.9, 0.4, 0.55], [-0.7, -0.6, 0.55]].forEach(([dx, dy, a]) => { x.globalAlpha = a; x.drawImage(clean, dx, dy); });
    x.globalAlpha = 1; x.setTransform(1, 0, 0, 1, 0, 0);
    const img = x.getImageData(0, 0, S, S), d = img.data;
    const G = 24, grid = new Float32Array((G + 2) * (G + 2)); for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const vnoise = (px, py, f) => { const u = px / S * f, v = py / S * f, iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv, w = G + 2;
      const g = (i, j) => grid[(((j % w) + w) % w) * w + (((i % w) + w) % w)]; const sm = t => t * t * (3 - 2 * t);
      const a = g(iu, iv), b = g(iu + 1, iv), cc = g(iu, iv + 1), dd = g(iu + 1, iv + 1);
      return (a + (b - a) * sm(fu)) * (1 - sm(fv)) + (cc + (dd - cc) * sm(fu)) * sm(fv); };
    const tilt = rnd() * 6.283, tx = Math.cos(tilt), ty = Math.sin(tilt);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const i = (py * S + px) * 4; if (!d[i + 3]) continue;
      const low = vnoise(px, py, 5), mid = vnoise(px + 40, py + 17, 14), hi = vnoise(px * 1.7, py * 1.3, 23);
      const press = 0.5 + ((px - cx) * tx + (py - cy) * ty) / S * 0.5; // heavier on one side, like a stamp pressed unevenly
      let a = d[i + 3] / 255 * (0.52 + 0.55 * low + 0.35 * press + 0.5 * (mid - 0.5) + 0.7 * (hi - 0.5));
      a = Math.min(1, Math.max(0, (a - 0.3) * 2.3));
      d[i + 3] = Math.round(a * 255);
    }
    x.putImageData(img, 0, 0);
    x.globalCompositeOperation = 'destination-out';   // flecks where the ink skipped
    for (let i = 0; i < 380; i++) { const a = rnd() * 6.283, rr = 60 + rnd() * 175; x.globalAlpha = 0.55 + rnd() * 0.45; x.beginPath(); x.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.6 + rnd() * rnd() * 3, 0, 6.283); x.fill(); }
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    return out;
  }
  const reportStamps = new WeakMap();
  function stampFor(r) {
    if (r.status !== 'final' || !r.student.name.trim()) return null;
    if (!reportStamps.has(r)) {
      let seal = null;
      try {
        const dataUrl = drawActivitySeal(r).toDataURL('image/png');
        seal = { dataUrl, bytes: Uint8Array.from(root.atob(dataUrl.split(',')[1]), c => c.charCodeAt(0)) };
      } catch (_) { /* Report status and all evidence still work without canvas. */ }
      reportStamps.set(r, seal);
    }
    return reportStamps.get(r);
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
      const entry = node('div', key === 'Dataset ID' ? 'osr-dataset' : '');
      entry.append(node('dt', '', key), node('dd', '', value)); meta.append(entry);
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
      Header, Footer, PageNumber, TabStopType, BorderStyle, ShadingType } = D;
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
    const running = runningInfo(r);
    const tabs = [{ type: TabStopType.RIGHT, position: 10320 }]; // 8.5 in Letter, two 960-twip margins
    const soft = { size: 18, color: '40535D' };
    const header = new Paragraph({ tabStops: tabs, border: { bottom: border }, children: [
      run(running.who, soft), run('\t' + running.title, soft),
    ] });
    const footer = new Paragraph({ tabStops: tabs, children: [
      run(running.dataset, soft),
      new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], ...soft }),
    ] });
    return Packer.toBlob(new Document({
      creator: 'Biology Lab Bench',
      title: r.title,
      styles: { default: { document: { run: { font: 'Calibri', size: 22, color: '172730' } } } },
      sections: [{
        properties: { page: { margin: { top: 1050, right: 960, bottom: 990, left: 960, header: 360, footer: 390 } } },
        headers: { default: new Header({ children: [header] }) },
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
    let runningStyle = null;
    function clearPrint() {
      runningStyle?.remove();
      runningStyle = null;
      doc.body.classList.remove('openscied-report-print');
    }
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
      const original = report;
      const tools = node('div', 'osr-tools'), controls = node('div', 'osr-actions');
      const print = action('Print or save as PDF', true), save = action('Download .docx'), close = action('Close report');
      const status = node('p', 'osr-live');
      status.id = titleId + '-preview-status'; status.tabIndex = -1;
      print.setAttribute('aria-describedby', status.id); save.setAttribute('aria-describedby', status.id);
      const formats = node('details', 'osr-formats');
      formats.append(node('summary', '', 'More formats'), save);
      controls.append(print, close);
      tools.append(controls, node('p', 'osr-screen-help', 'In the print window, choose “Save as PDF” to download a PDF file.'), formats, status);
      let preview = article(report, titleId);
      // Keep the captured work and timestamps immutable. Corrections affect only this preview
      // and its exports; they do not change the browser identity or the underlying record.
      function canApplyIdentity() {
        try {
          const now = capture();
          return now.allowIdentityEdit && now.student.name === original.student.name &&
            now.student.period === original.student.period;
        } catch (_) { return false; }
      }
      const mustReopen = 'The activity changed since you opened this report. Close it and open a new preview.';
      function syncPrint() {
        runningStyle?.remove();
        runningStyle = printRunningStyle(report);
        doc.head.append(runningStyle);
      }
      dialog.replaceChildren(tools, preview);
      if (report.allowIdentityEdit) {
        const editor = node('details', 'osr-identity-editor');
        const summary = node('summary', '', 'Edit name or period');
        const form = node('form', 'osr-identity-fields');
        const name = node('input'), period = node('input');
        name.type = period.type = 'text';
        name.maxLength = 80; period.maxLength = 32;
        name.value = report.student.name; period.value = report.student.period;
        const nameLabel = node('label', '', 'Name');
        const periodLabel = node('label', '', 'Class period');
        nameLabel.append(name); periodLabel.append(period);
        const apply = action('Apply to this report'); apply.type = 'submit';
        form.append(nameLabel, periodLabel, apply);
        editor.append(summary, node('p', '', 'Correct your own name or period here. This changes this report only. For a different student, use the dashboard.'), form);
        editor.addEventListener('toggle', () => {
          if (!editor.open) {
            name.value = report.student.name;
            period.value = report.student.period;
          }
        });
        form.addEventListener('submit', event => {
          event.preventDefault();
          if (!canApplyIdentity()) { message(status, mustReopen, true); return; }
          report = { ...report, student: { name: name.value.trim(), period: period.value.trim() } };
          const updated = article(report, titleId);
          preview.replaceWith(updated);
          preview = updated;
          syncPrint();
          editor.open = false;
          message(status, 'Name and period updated for this report only.');
          summary.focus();
        });
        tools.after(editor);
      }
      try { dialog.showModal(); }
      catch (_) { message(live, 'Could not open the report preview. Your work has not changed.', true); return; }
      clearPrint();
      syncPrint();
      doc.body.classList.add('openscied-report-print');
      function canExport() {
        const edited = report.student.name !== original.student.name || report.student.period !== original.student.period;
        if (!edited || canApplyIdentity()) return true;
        message(status, mustReopen, true);
        return false;
      }
      print.addEventListener('click', () => {
        if (!canExport()) return;
        if (!root.print) { message(status, 'Printing is not available. Try downloading the Word file.', true); return; }
        try { root.print(); }
        catch (_) { message(status, 'Could not open the print window. Try downloading the Word file.', true); }
      });
      save.addEventListener('click', () => { if (canExport()) launchWord(report, save, status); });
      close.addEventListener('click', () => dialog.close());
      preview.querySelector('.osr-title').focus();
    }
    open.addEventListener('click', show);
    dialog.addEventListener('close', () => {
      clearPrint();
      if (isShown(open)) open.focus({ preventScroll: true });
    });
    tray.append(open, live);
    const stopPlacing = placeLauncher(config, target, tray, open);
    doc.body.append(dialog);
    return { open: show, destroy() { stopPlacing(); if (dialog.open) { dialog.close(); clearPrint(); } dialog.remove(); tray.remove(); } };
  }

  return Object.freeze({ mount, normalize, word });
}));
