/* Standard mRNA codon chart. Translation data: NCBI Standard Code (table 1).
   https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG1 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DNACodonWheel = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  var BASES = Object.freeze(['U', 'C', 'A', 'G']);
  // NCBI table 1 order, with U instead of T for mRNA.
  var CODE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  var AMINO = {
    A: ['Alanine', 'Ala'], C: ['Cysteine', 'Cys'], D: ['Aspartic acid', 'Asp'],
    E: ['Glutamic acid', 'Glu'], F: ['Phenylalanine', 'Phe'], G: ['Glycine', 'Gly'],
    H: ['Histidine', 'His'], I: ['Isoleucine', 'Ile'], K: ['Lysine', 'Lys'],
    L: ['Leucine', 'Leu'], M: ['Methionine', 'Met'], N: ['Asparagine', 'Asn'],
    P: ['Proline', 'Pro'], Q: ['Glutamine', 'Gln'], R: ['Arginine', 'Arg'],
    S: ['Serine', 'Ser'], T: ['Threonine', 'Thr'], V: ['Valine', 'Val'],
    W: ['Tryptophan', 'Trp'], Y: ['Tyrosine', 'Tyr'], '*': ['Stop', 'Stop']
  };
  var ORDINALS = ['First', 'Second', 'Third'];
  var NS = 'http://www.w3.org/2000/svg';
  var CENTER = 222;
  var mounts = new WeakMap();

  function translate(codon) {
    if (typeof codon !== 'string') return null;
    var normalized = codon.trim().toUpperCase();
    if (!/^[UCAG]{3}$/.test(normalized)) return null;
    var i = BASES.indexOf(normalized[0]) * 16 + BASES.indexOf(normalized[1]) * 4 + BASES.indexOf(normalized[2]);
    var letter = CODE[i];
    return {
      codon: normalized,
      name: AMINO[letter][0],
      abbreviation: AMINO[letter][1],
      stop: letter === '*',
      start: normalized === 'AUG'
    };
  }

  function element(doc, tag, className, label) {
    var el = doc.createElement(tag);
    if (className) el.className = className;
    if (label) el.textContent = label;
    return el;
  }

  function svgElement(doc, tag, attrs, label) {
    var el = doc.createElementNS(NS, tag);
    Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    if (label) el.textContent = label;
    return el;
  }

  function point(radius, angle) {
    var rad = angle * Math.PI / 180;
    return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
  }

  function path(inner, outer, from, to) {
    var a = point(outer, from);
    var b = point(outer, to);
    var c = point(inner, to);
    var d = point(inner, from);
    return ['M', a[0], a[1], 'A', outer, outer, 0, 0, 1, b[0], b[1],
      'L', c[0], c[1], 'A', inner, inner, 0, 0, 0, d[0], d[1], 'Z'].join(' ');
  }

  function draw(doc) {
    var svg = svgElement(doc, 'svg', {
      viewBox: '0 0 444 444',
      class: 'dw-codon-wheel-graphic',
      role: 'img',
      'aria-label': 'Standard mRNA codon wheel. Use the three base selectors to look up any codon.',
      focusable: 'false'
    });
    var segments = [];
    var boundaries = [24, 62, 104, 162, 217];
    var step = 360 / 64;
    var top = -90;

    function sector(ring, fromIndex, toIndex, label, prefix, isStop) {
      var from = top + fromIndex * step;
      var to = top + toIndex * step;
      var centerAngle = (from + to) / 2;
      var p = point((boundaries[ring] + boundaries[ring + 1]) / 2, centerAngle);
      var quadrant = Math.floor(fromIndex / 16) + 1;
      var group = svgElement(doc, 'g', {
        class: 'dw-codon-segment dw-codon-ring-' + (ring + 1) + ' dw-codon-quadrant-' + quadrant + (isStop ? ' dw-codon-stop' : '')
      });
      var labelProps = {
        class: 'dw-codon-wheel-letter',
        x: p[0], y: p[1], 'text-anchor': 'middle', 'dominant-baseline': 'central'
      };
      if (ring === 3) {
        // Radial text fits even in the single-codon sectors.
        var rotation = centerAngle > 90 ? centerAngle - 180 : centerAngle;
        labelProps.transform = 'rotate(' + rotation + ' ' + p[0] + ' ' + p[1] + ')';
      }
      group.appendChild(svgElement(doc, 'path', {
        d: path(boundaries[ring], boundaries[ring + 1], from, to)
      }));
      group.appendChild(svgElement(doc, 'text', labelProps, label));
      svg.appendChild(group);
      segments.push({ element: group, prefix: prefix, from: fromIndex, to: toIndex });
    }

    var rootRadius = boundaries[0];
    svg.appendChild(svgElement(doc, 'circle', {
      class: 'dw-codon-wheel-center', cx: CENTER, cy: CENTER, r: rootRadius
    }));
    svg.appendChild(svgElement(doc, 'text', {
      class: 'dw-codon-wheel-center-label',
      x: CENTER, y: CENTER, 'text-anchor': 'middle', 'dominant-baseline': 'central'
    }, 'mRNA'));

    BASES.forEach(function (first, i) {
      sector(0, i * 16, (i + 1) * 16, first, first);
    });
    BASES.forEach(function (first, i) {
      BASES.forEach(function (second, j) {
        var index = i * 16 + j * 4;
        sector(1, index, index + 4, second, first + second);
      });
    });
    BASES.forEach(function (first, i) {
      BASES.forEach(function (second, j) {
        BASES.forEach(function (third, k) {
          var index = i * 16 + j * 4 + k;
          sector(2, index, index + 1, third, first + second + third);
        });
      });
    });
    // Merge neighboring synonymous codons within the same second-base sector.
    for (var start = 0, end = 1; start < CODE.length; start = end, end = start + 1) {
      while (end < CODE.length && end % 4 !== 0 && CODE[end] === CODE[start]) end += 1;
      sector(3, start, end, CODE[start] === 'M' ? 'Met*' : AMINO[CODE[start]][1], null, CODE[start] === '*');
    }
    return { svg: svg, segments: segments };
  }

  function mount(host) {
    if (!host || !host.ownerDocument) return null;
    if (mounts.has(host)) return mounts.get(host);

    var doc = host.ownerDocument;
    var wheel = element(doc, 'div', 'dw-codon-wheel');
    var chart = draw(doc);
    wheel.appendChild(chart.svg);

    var controls = element(doc, 'div', 'dw-codon-wheel-controls');
    var legend = element(doc, 'p', 'dw-codon-wheel-caption',
      'Read from the center outward: first base → second base → third base → amino acid or Stop. Read the mRNA codon in the 5′ to 3′ direction. Met* marks AUG: Start and methionine.');
    controls.appendChild(legend);

    var row = element(doc, 'div', 'dw-codon-wheel-selects');
    var selectors = ORDINALS.map(function (ordinal, i) {
      var label = element(doc, 'label', 'dw-codon-wheel-base');
      label.appendChild(element(doc, 'span', null, ordinal + ' base'));
      var select = element(doc, 'select');
      select.setAttribute('data-codon-position', String(i + 1));
      select.setAttribute('data-dw-codon-base', String(i + 1));
      var placeholder = element(doc, 'option', null, 'Choose');
      placeholder.value = '';
      select.appendChild(placeholder);
      BASES.forEach(function (base) {
        var option = element(doc, 'option', null, base);
        option.value = base;
        select.appendChild(option);
      });
      label.appendChild(select);
      row.appendChild(label);
      return select;
    });
    controls.appendChild(row);

    var result = element(doc, 'output', 'dw-codon-wheel-result');
    result.setAttribute('aria-live', 'polite');
    result.setAttribute('aria-atomic', 'true');
    result.setAttribute('data-dw-codon-output', '');
    controls.appendChild(result);
    wheel.appendChild(controls);
    host.appendChild(wheel);

    function update() {
      var a = selectors[0].value;
      var b = selectors[1].value;
      var c = selectors[2].value;
      // Later bases count only if the path reaches them from the center.
      var prefix = a && b ? a + b + c : a;
      var reading = translate(prefix);
      var index = reading ? BASES.indexOf(a) * 16 + BASES.indexOf(b) * 4 + BASES.indexOf(c) : -1;
      chart.segments.forEach(function (segment) {
        var selected = segment.prefix ? prefix.indexOf(segment.prefix) === 0 : index >= segment.from && index < segment.to;
        segment.element.classList.toggle('is-selected', selected);
        if (selected) segment.element.setAttribute('data-dw-selected', '');
        else segment.element.removeAttribute('data-dw-selected');
      });

      if (!reading) result.textContent = 'Choose all three mRNA bases to look up a codon.';
      else if (reading.stop) result.textContent = reading.codon + ' → Stop. This codon tells the ribosome to stop translation; it does not add an amino acid.';
      else if (reading.start) result.textContent = 'AUG → Start + methionine (Met). At the beginning, AUG tells the ribosome where to start and adds methionine.';
      else result.textContent = reading.codon + ' → ' + reading.name + ' (' + reading.abbreviation + ').';
    }
    selectors.forEach(function (select) { select.addEventListener('change', update); });
    update();
    mounts.set(host, wheel);
    return wheel;
  }

  return Object.freeze({ mount: mount, translate: translate, BASES: BASES });
});
