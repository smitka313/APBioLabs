/* Dependency-free focused coverage of presentation-only navigation states.
   Run: node tests/t-step-nav-status.js. The activity/browser suites still
   exercise the real step rules; this fixture detects status misinterpretation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'student-step-nav.js'), 'utf8');

class Element {
  constructor(tag, classes = '') {
    this.tag = tag; this.children = []; this.attributes = new Map(); this.disabled = false;
    this.hidden = false; this._text = ''; this.className = classes;
    this.classList = { contains: c => this.className.split(/\s+/).includes(c) };
  }
  set id(v) { this.setAttribute('id', v); }
  get id() { return this.getAttribute('id'); }
  get textContent() { return this._text + this.children.map(e => e.textContent).join(''); }
  set textContent(v) { this._text = v; this.children = []; }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  hasAttribute(k) { return this.attributes.has(k); }
  removeAttribute(k) { this.attributes.delete(k); }
  append(el) { el.parent = this; this.children.push(el); }
  after(el) { el.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, el); }
  get nextElementSibling() { return this.parent?.children[this.parent.children.indexOf(this) + 1] || null; }
  descendants() { return this.children.flatMap(e => [e, ...e.descendants()]); }
  matches(s) {
    return s.split(/\s*,\s*/).some(q => {
      if (q === '[hidden]') return this.hidden;
      if (q === '[aria-hidden="true"]') return this.getAttribute('aria-hidden') === 'true';
      if (q.startsWith('.')) return this.classList.contains(q.slice(1));
      return this.tag === q;
    });
  }
  closest(s) { return this.matches(s) ? this : this.parent?.closest(s) || null; }
  getClientRects() { return this.closest('[hidden]') ? [] : [{}]; }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  querySelectorAll(s) {
    if (s.startsWith(':scope > ')) return this.children.filter(e => e.matches(s.slice(9)));
    if (s === 'ol li > a[href^="#"]') return this.descendants().filter(e => e.tag === 'a' && e.parent.tag === 'li' && e.getAttribute('href')?.startsWith('#'));
    return this.descendants().filter(e => e.matches(s));
  }
}
const root = new Element('body'), frames = [], observers = [];
const add = (parent, tag, classes) => { const e = new Element(tag, classes); parent.append(e); return e; };
const nav = add(root, 'nav', 'sf-steps');
const orient = add(nav, 'button'), explore = add(nav, 'button'), explain = add(nav, 'button');
orient.textContent = 'Ask questions'; orient.setAttribute('aria-current', 'step');
explore.textContent = 'Explore stations'; explore.disabled = true;
explore.setAttribute('data-nav-step-unlock', 'Write two different questions before exploring.');
explain.textContent = 'Explain'; explain.disabled = true;
explain.setAttribute('data-nav-step-unlock', 'Collect evidence before writing.');
const ap = add(root, 'nav', 'step-nav'), ol = add(ap, 'ol');
const link = add(add(ol, 'li'), 'a', 'is-done'); link.setAttribute('href', '#analyze');
const caption = add(link, 'span', 'nl'); caption.textContent = 'Analyze';
const visited = add(add(ol, 'li'), 'a'); visited.setAttribute('href', '#reflect'); visited.setAttribute('title', 'Visited');
add(visited, 'span', 'nl').textContent = 'Reflect'; visited.setAttribute('aria-current', 'true');
const legacy = add(root, 'nav', 'dw-stage-nav');
const dna = add(legacy, 'button'); dna.disabled = true; dna.setAttribute('aria-describedby', 'dw-unlock');
const legacyHint = add(root, 'p', 'dw-unlock'); legacyHint.id = 'dw-unlock'; legacyHint.textContent = 'Build the nucleotide to unlock this part.';
const journey = add(root, 'nav', 'journey-tabs');
const carbon = add(journey, 'button'); carbon.setAttribute('aria-pressed', 'true');
const unrelated = add(nav, 'button'); unrelated.setAttribute('aria-pressed', 'true');
const rails = [nav, ap, legacy, journey];
const ctx = { document: {
  readyState: 'complete', getElementById: id => root.descendants().find(e => e.id === id),
  querySelectorAll: () => rails, createElement: tag => new Element(tag)
}, MutationObserver: class {
  constructor(fn) { this.fn = fn; observers.push(this); }
  observe() {}
}, requestAnimationFrame: fn => frames.push(fn) };
vm.runInNewContext(source, ctx);
const state = el => el.getAttribute('data-blb-step-state');
const badge = el => el.querySelector('.blb-step-status')?.textContent;
const repaint = () => { observers.forEach(o => { o.fn(); o.fn(); }); assert.equal(frames.length, observers.length); frames.splice(0).forEach(fn => fn()); };
assert.equal(state(orient), 'current');
assert.equal(badge(orient), 'Current');
assert.equal(state(explore), 'locked');
assert.equal(badge(explore), 'Locked');
assert.equal(explore.disabled, true);
assert.equal(nav.nextElementSibling.textContent, 'Write two different questions before exploring.');
assert.equal(nav.getAttribute('aria-describedby'), nav.nextElementSibling.id);
assert.equal(state(unrelated), 'open', 'aria-pressed is not a generic step marker');
assert.equal(state(carbon), 'current', 'Carbon Journey uses pressed state for its main pages');
assert.equal(state(link), 'complete');
assert.equal(caption.querySelector('.blb-step-status'), null, 'do not change the original link label');
assert.equal(link.querySelector('.blb-step-status').getAttribute('aria-hidden'), 'true');
assert.equal(link.getAttribute('href'), '#analyze');
assert.equal(state(visited), 'current', 'current/visited cannot become complete');
assert.equal(legacy.nextElementSibling, legacyHint, 'do not duplicate a visible activity hint');
assert.equal(dna.getAttribute('aria-describedby'), 'dw-unlock');

orient.setAttribute('data-nav-step-complete', '');
explore.disabled = false; orient.removeAttribute('aria-current'); explore.setAttribute('aria-current', 'step');
repaint();
assert.equal(state(orient), 'complete'); assert.equal(badge(orient), 'Complete');
assert.match(orient.getAttribute('aria-describedby'), /^blb-step-desc-/);
assert.equal(state(explore), 'current'); assert.equal(badge(explore), 'Current');
assert.equal(nav.nextElementSibling.textContent, 'Collect evidence before writing.');
orient.setAttribute('aria-current', 'page'); explore.removeAttribute('aria-current');
repaint(); assert.equal(badge(orient), 'Current ✓');
orient.setAttribute('data-nav-step-complete', 'false'); explain.disabled = false;
repaint(); assert.equal(badge(orient), 'Current'); assert.equal(orient.hasAttribute('aria-describedby'), false);
assert.equal(nav.nextElementSibling.hidden, true);
assert.equal(nav.hasAttribute('aria-describedby'), false);
assert.equal(explain.querySelector('.blb-step-status').hidden, true);
assert.equal(orient.getAttribute('aria-current'), 'page');
assert.equal(explain.disabled, false);
console.log('PASS: current, completion, gate explanation, labels/links preserved, stale and reverted evidence, one paint per rail.');
