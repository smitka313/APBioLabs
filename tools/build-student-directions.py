#!/usr/bin/env python3
"""Build static student walkthroughs from reviewed instructions and current lab section metadata.
Run from any directory: python3 tools/build-student-directions.py
No encrypted teacher content or student data is read.
"""
from pathlib import Path
from html import escape, unescape
import json
import re
import runpy

ROOT = Path(__file__).resolve().parent.parent
CONTENT = json.loads((ROOT / 'tools/student-directions.json').read_text())

def plain(value):
    return unescape(re.sub(r'<[^>]+>', '', value)).strip()

def items(values):
    return '<ol class="steps">\n' + '\n'.join('<li>' + escape(v) + '</li>' for v in values) + '\n</ol>'

def shell(title, body):
    return '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<script src="domain-redirect.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>''' + escape(title) + ''' · Biology Lab Bench</title>
<link rel="stylesheet" href="student-directions.css">
<script src="student-directions.js" defer></script>
</head>
<body>
<a class="skip" href="#directions">Skip to directions</a>
''' + body + '''
<footer>Biology Lab Bench · Created by Robert Smitka · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a></footer>
</body>
</html>
'''

catalog = []
for lab, custom in CONTENT.items():
    source = ROOT / ('lab' + lab + '.html')
    html = source.read_text()
    title = plain(re.search(r'<h1\b[^>]*>(.*?)</h1>', html, re.S).group(1))
    question = re.search(r'<p class="driving-q">(.*?)</p>', html, re.S)
    question = plain(question.group(1)) if question else ''
    sections = []
    for tag in re.findall(r'<section\b[^>]*data-step="[^"]+"[^>]*>', html):
        attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', tag))
        sections.append((unescape(attrs['data-step']), attrs['id']))
    missing = set(custom) - {name for name, _ in sections}
    if missing:
        raise ValueError(f'{source.name}: unknown sections {missing}')
    page = 'directions-lab' + lab + '.html'
    sections_html = []
    for name, anchor in sections:
        if name == 'Overview':
            steps = ["Read the driving question and your teacher’s assignment. Note which sections, optional extensions, and number of trials your teacher wants you to complete.", "Sign in with your name and class period. Copy your Dataset ID onto this guide. Keep using the same dataset for the investigation; classmates may have different numbers."]
        elif name == 'Background':
            steps = ["Read the background explanations, diagrams, and vocabulary. Review the reference formulas you will need and identify the variables you will measure."]
        elif name == 'Pre-lab' and name not in custom:
            steps = ["Complete the pre-lab questions and any practice activities. Use Check answer, read the feedback, and revise your reasoning before starting the investigation."]
        elif name == 'Analyze':
            steps = ["Answer every assigned analysis question using your own recorded data. Include numbers, units, and comparisons from the appropriate Data and Graph panels.", "Complete the requested calculations or statistical comparisons. Show your method and explain what the result means biologically. Write the claim, evidence, and reasoning response if shown."]
        elif name in ('Reflect', 'Evaluate'):
            steps = ["Compare your original predictions with your results. Explain any disagreement, limitations of the simulation, and one way to improve the investigation.", "Complete the assigned reflection/evaluation questions and AP-style response if shown. Use your own data where requested. Rate your confidence if you wish; ask your teacher about any unfinished or unclear work."]
        elif name == 'Submit':
            steps = ["Review the completion checklist and Preview my report. Check your name, period, Dataset ID, calculations, units, graphs, and written responses.", "Download .docx or use Save as PDF as directed by your teacher. Open the downloaded file and check that it contains your work, then upload or hand it in where your teacher specifies. Downloading alone does not submit it.", "Save a progress file using Move your work to another computer if you need a backup or will change devices. Keep recordings separately if assigned; a report cannot restore editable progress."]
        elif name in custom:
            steps = custom[name]
        else:
            raise ValueError(f'{source.name}: no directions for {name}')
        sections_html.append('<section id="' + escape(anchor) + '"><h2>' + escape(name) + '</h2><p class="open-part"><a href="' + source.name + '#' + escape(anchor) + '">Open this part in the lab</a></p>' + items(steps) + '</section>')
    pdf = 'student-pdfs/directions-lab' + lab + '.pdf'
    body = '<nav class="screen-actions" aria-label="Guide actions"><a href="' + source.name + '">Back to Lab ' + str(int(lab)) + '</a><a href="student-directions.html">All student guides</a><a class="pdf-download" href="' + pdf + '" download>Download PDF</a><button type="button" id="print-directions" hidden>Print / Save as PDF</button></nav>\n'
    body += '<p class="screen-only print-help">If printing is blocked, use <strong>Download PDF</strong> to open a ready-to-print copy. Save or print it from your PDF viewer. You can also use your browser’s Print command.</p>\n'
    body += '<header><p class="eyebrow">Lab ' + str(int(lab)) + ' · Printable student directions</p><h1>' + escape(title) + '</h1><p class="question">' + escape(question) + '</p><p class="identity">Name: ____________________ &nbsp; Class/period: __________ &nbsp; Dataset ID: __________</p></header>\n'
    body += '<main id="directions"><aside><h2>How to use this guide</h2><p>Check off each numbered step as you work in the online simulation. Follow your teacher’s assigned sections and repeat counts. This guide explains the workflow; enter your measurements and responses in the lab or your assigned worksheet.</p><p>Use Data for tables and editable calculations, Graph for plots, and Scene for the simulation. Some controls are under More options. Write predictions before running an experiment and scroll below the simulation for response boxes.</p><p class="screen-only">To print, use the button above or your browser’s Print command. Choose Save as PDF to keep a copy.</p></aside>\n'
    body += '\n'.join(sections_html) + '<section class="notes"><h2>Teacher instructions / notes</h2><div class="rules" aria-label="Space for handwritten notes"></div></section></main>'
    (ROOT / page).write_text(shell('Lab ' + str(int(lab)) + ' student directions', body))
    # Links are in static markup, usable before any simulation JavaScript runs.
    for part in ('Overview', 'Submit'):
        marker = '<!-- student-directions-' + part.lower() + ' -->'
        link = marker + '<p class="student-directions-link"><a href="' + page + '">Printable student directions</a> — a step-by-step guide you can print or save as PDF.</p>' + marker
        old = re.compile(re.escape(marker) + r'.*?' + re.escape(marker), re.S)
        html = old.sub('', html)
        pattern = r'(<section\b[^>]*data-step="' + part + r'"[^>]*>.*?</header>)'
        html, count = re.subn(pattern, lambda m: m.group(1) + link, html, count=1, flags=re.S)
        if count != 1:
            raise ValueError(f'{source.name}: no {part} insertion point')
    source.write_text(html)
    catalog.append('<li><a href="' + page + '">Lab ' + str(int(lab)) + ' · ' + escape(title) + '</a> <a class="catalog-pdf" href="' + pdf + '" download aria-label="Download Lab ' + str(int(lab)) + ' student directions as PDF">Download PDF</a></li>')

index = '<nav class="screen-actions" aria-label="Navigation"><a href="ap-biology.html">All labs</a><a href="teachers.html#printing">Teacher guide</a></nav><header><p class="eyebrow">Biology Lab Bench</p><h1>Printable student directions</h1><p>Choose a lab for a numbered walkthrough, data-recording reminders, and submission checklist. Each guide can be printed or saved as PDF from your browser.</p></header><main id="directions"><ol class="catalog">' + ''.join(catalog) + '</ol></main>'
(ROOT / 'student-directions.html').write_text(shell('Printable student directions', index))
print('Built 13 lab guides, linked all Overview/Submit sections, and built the guide index.')

# Regeneration must preserve search metadata on all public student guides.
runpy.run_path(str(ROOT / "tools/build-seo.py"), run_name="__main__")
