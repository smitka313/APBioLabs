#!/usr/bin/env python3
"""Render the public OpenSciEd classroom briefs. No browser or site build required."""
from html import escape as h
from pathlib import Path
import argparse
import json
import re

root = Path(__file__).resolve().parents[1]
data = json.loads((root/'tools/openscied-classroom-briefs.json').read_text())
path = root/'openscied-classroom-briefs.html'
names = ['Ecosystems', 'Matter & Energy', 'Inheritance', 'Natural Selection', 'Common Ancestry']
assert len(data) == 24 and len({d['id'] for d in data}) == len(data)
for d in data:
    assert d['unit'] in range(1,6) and re.fullmatch(fr"openscied-b{d['unit']}-[a-z0-9-]+",d['id'])
    assert len(d['plan']) == 3 and all(x.strip() for x in d['plan'])
    assert sum(len(v.split()) for k,v in d.items() if isinstance(v,str)) + sum(len(x.split()) for x in d['plan']) <= 250
def card(d):
    sid = d['id']; name=h(d['title']); url='https://biologylabbench.com/'+sid
    actions=''.join(f'<li>{h(a)}</li>' for a in d['plan'])
    return f'''<article class="brief-sheet" id="{sid}" aria-labelledby="{sid}-title">
<p class="eyebrow">Biology Lab Bench · Classroom brief</p>
<h2 id="{sid}-title">{name}</h2>
<p class="brief-meta">Unit {d['unit']} · {h(d['lesson'])} · {h(d['time'])}</p>
<p class="brief-question"><strong>Investigation:</strong> {h(d['question'])}</p>
<h3>In class</h3><ol class="brief-plan">{actions}</ol>
<p class="brief-turnin"><strong>Turn in:</strong> {h(d['turnIn'])}</p>
<p class="brief-fallback"><strong>If a resource is blocked:</strong> {h(d['fallback'])}</p>
<p class="print-link">Student link: <a href="{url}">{url}</a></p>
<div class="brief-actions">
<a class="btn btn--primary" href="{sid}.html">Open student activity<span class="sr-only">: {name}</span></a>
<button class="btn" type="button" data-brief-print hidden>Print this brief<span class="sr-only">: {name}</span></button>
<button class="btn" type="button" data-brief-copy hidden>Copy assignment text<span class="sr-only">: {name}</span></button>
<a href="#find-brief">Back to the list</a>
</div></article>'''
def group(unit,name):
    links=''.join(f'<li><a href="#{d["id"]}">{h(d["title"])}</a></li>' for d in data if d['unit']==unit)
    return f'<details {"open" if unit==1 else ""}><summary>Unit {unit} · {h(name)}</summary><ul>{links}</ul></details>'
rendered='''<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<script src="domain-redirect.js"></script>
<title>OpenSciEd Classroom Briefs | Biology Lab Bench</title>
<meta name="description" content="Print or copy a short assignment brief for every OpenSciEd Biology companion activity, with lesson context, student steps, and hand-in directions.">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://biologylabbench.com/openscied-classroom-briefs">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>try{const t=localStorage.getItem('aplab:pref:theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else if(t==='auto')delete document.documentElement.dataset.theme}catch(_){}</script>
<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="bench-brand.css"><link rel="stylesheet" href="openscied-classroom-briefs.css">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="bench-brandbar"><div class="bench-brandbar-inner wrap wrap--wide gutter">
<a class="bench-logo" href="index.html" aria-label="Biology Lab Bench home"><img class="bench-logo-light" src="assets/biology-lab-bench-logo.svg" width="550" height="144" alt=""><img class="bench-logo-dark" src="assets/biology-lab-bench-logo-dark.svg" width="550" height="144" alt=""></a>
<div class="bench-portal-theme" role="group" aria-label="Color theme"><button type="button" data-bench-theme="light">Light</button><button type="button" data-bench-theme="dark">Dark</button><button type="button" data-bench-theme="auto">Auto</button></div>
</div></header>
<main id="main">
<section class="brief-intro wrap wrap--wide gutter">
<p class="eyebrow">For teachers · OpenSciEd Biology companions</p><h1>Classroom briefs</h1>
<p>Find an activity, then print its one-page brief or copy the assignment into your LMS. Short routes are marked where the full activity takes longer.</p>
<p class="brief-unit-list"><a href="teacher-hub.html#openscied">Teacher hub</a> · <a href="openscied-teacher-guide.html">Full OpenSciEd teacher guide</a> · <a href="privacy-help.html#blocked">School-device help</a></p>
</section>
<section class="brief-toc wrap wrap--wide gutter" aria-labelledby="find-brief"><h2 id="find-brief">Find a brief</h2><nav aria-label="Activities by unit">
'''+ ''.join(group(unit,name) for unit,name in enumerate(names,1))+'''
</nav></section>
<div class="brief-book wrap wrap--wide gutter">
'''+ '\n'.join(card(d) for d in data)+'''
</div>
<p id="brief-status" role="status"></p>
</main>
<dialog id="brief-copy-dialog" aria-labelledby="brief-copy-title"><form method="dialog">
<h2 id="brief-copy-title">Copy assignment text</h2><p>Use your device’s Copy command, then paste the text into your classroom instructions.</p>
<label for="brief-copy-text">Assignment text</label><textarea id="brief-copy-text" readonly></textarea>
<button class="btn" type="submit">Close</button></form></dialog>
<footer class="site-footer"><div class="wrap wrap--wide gutter"><p>Created by Robert Smitka. Independent classroom resources, not affiliated with or endorsed by OpenSciEd.</p></div></footer>
<script src="bench-welcome.js"></script><script src="openscied-classroom-briefs.js"></script>
<script data-goatcounter="https://smitka313.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
</body></html>
'''
args=argparse.ArgumentParser()
args.add_argument('--check',action='store_true')
if args.parse_args().check:
    if not path.exists() or path.read_text()!=rendered: raise SystemExit('Classroom briefs need rebuilding.')
else:
    path.write_text(rendered)
print(f'Checked {len(data)} printable classroom briefs.')
