#!/usr/bin/env python3
"""Build committed search metadata and crawlable lab cards; no hosting build needed.

Run python3 tools/build-seo.py [--check] from any directory. --check reports drift
without writing. Only public metadata is read; encrypted teacher notes are untouched.
"""
from pathlib import Path
from html import escape
import argparse
import json
import re

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://biologylabbench.com'
BRAND = 'AP Bio Digital Lab Bench'
LICENSE = 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
CONTENT = json.loads((ROOT / 'tools/seo-content.json').read_text())
LABS = [lab for group in CONTENT['groups'] for lab in group['labs']]
PRIVATE = ['teacher-notes.html', 'openscied-teacher-notes.html'] + [f'teacher-lab{i:02}.html' for i in range(1, 14)]
UTILITIES = ['teacher-dashboard.html', 'projector.html', 'feedback.html',
             'sample-report.html', '_template.html', '404.html']


def url(filename):
    # Cloudflare Pages redirects .html files to these extensionless URLs.
    return ORIGIN + ('/' if filename == 'index.html' else '/' + filename.removesuffix('.html'))


def page_specs():
    specs = {
        'index.html': ('Biology Lab Bench | AP Biology and OpenSciEd',
                       'Choose free AP Biology virtual labs or interactive OpenSciEd high school biology companion activities. No account required.',
                       'Biology Lab Bench'),
        'ap-biology.html': ('Free AP Biology Virtual Labs | AP Bio Digital Lab Bench',
                       'Explore all 13 AP Biology virtual labs for free. Interactive simulations, data analysis, printable student directions, and teacher resources. No installation.',
                       'Free AP Biology virtual labs'),
        'teachers.html': ('Free AP Biology Virtual Labs for Teachers | Lab Bench',
                          'Teach all 13 AP Biology investigations with free virtual labs, printable student directions, protected teacher notes, and downloadable student reports.',
                          'For teachers'),
        'openscied-teacher-guide.html': ('OpenSciEd Biology Teacher Guide for Units 1–5 | Lab Bench',
                                         'Plan OpenSciEd Biology companion activities with classroom setup, suggested pacing, discussion prompts and teacher-only worked examples.',
                                         'OpenSciEd Teacher Guide'),
        'openscied-b4-hawksbeard.html': ('Hawksbeard Wind Lab — OpenSciEd Biology B.4 companion | Lab Bench',
                                         'Compare where hawksbeard seeds land in a city and a field in this free, virtual OpenSciEd Biology B.4 Lesson 2 companion.',
                                         'Hawksbeard Wind Lab'),
        'openscied-b4-rat-generations.html': ('Rat Generations — OpenSciEd Biology B.4 companion | Lab Bench',
                                               'Model natural selection across five generations of a simulated rat colony. Inspect Punnett squares and compare population size, trait share and allele frequency.',
                                               'Rat Generations'),
        'openscied-b4-junco.html': ('Junco Investigation — OpenSciEd Biology B.4 Lesson 4 | Lab Bench',
                                   'Compare city and mountain juncos in field and shared aviary studies, then explore how corticosterone is associated with exploration.',
                                   'Junco Investigation'),
        'openscied-b1-ripple.html': ('Serengeti Ripple Effects — OpenSciEd Biology B.1 Lesson 8 | Lab Bench',
                                    'Connect a Serengeti ecosystem web and compare how fewer visiting wildebeest affect dung beetles, soil, grass, and predator encounters.',
                                    'Serengeti Ripple Effects'),
        'openscied-b4-wildlife-corridor.html': ('Wildlife Corridor Lab — OpenSciEd Biology B.4 Lessons 8–9 | Lab Bench',
                                               'Compare connected and road-split habitats, place a wildlife crossing, and use a simulation to investigate gene flow across generations.',
                                               'Wildlife Corridor Lab'),
        'openscied-b5-wapusk.html': ('Three Bears in Wapusk — OpenSciEd Biology B.5 Lesson 1 | Lab Bench',
                                     'Compare winter and summer bear sightings, explore Arctic sea ice regions, and record evidence for initial models.',
                                     'Three Bears in Wapusk'),
        'openscied-b5-thermoregulation.html': ('Bear Thermoregulation Lab — OpenSciEd Biology B.5 Lesson 2 | Lab Bench',
                                                  'Explore bear encounters, compare original polar bear treadmill data, and model the transfer of matter and energy during exercise.',
                                                  'Bear Thermoregulation Lab'),
        'openscied-b5-ancestry.html': ('Bear Ancestry Lab — OpenSciEd Biology B.5 Lesson 3 | Lab Bench',
                                                  'Compare illustrated bear specimens, inspect original DNA sequences, and build an evidence-based tree of bear relationships.',
                                                  'Bear Ancestry Lab'),
        'openscied-b5-speciation.html': ('Ice Age Bear Speciation Explorer — OpenSciEd Biology B.5 Lesson 4 | Lab Bench',
                                         'Move ancestral bears as ice retreats, compare fossil sites and inherited traits, and revise a scientific argument about speciation.',
                                         'Ice Age Bear Speciation Explorer'),
        'openscied-b5-hybrid.html': ('Arctic Bear Futures & Hybridization — OpenSciEd Biology B.5 Lesson 6 | Lab Bench',
                                      'Read Arctic sea-ice projections, trace a documented bear family, and model ten matings to compare inherited traits.',
                                      'Arctic Bear Futures & Hybridization'),
        'getting-started.html': ('AP Biology Virtual Labs: Teacher Quick Start | Lab Bench',
                                 'Start teaching with free AP Biology virtual labs in five minutes. Choose a lab, share links, explain saving, collect reports, and review class progress.',
                                 'Teacher quick start'),
        'student-directions.html': ('Printable AP Biology Lab Directions | Biology Lab Bench',
                                    'Print free student directions for all 13 AP Biology virtual labs. Each guide includes numbered steps, data-recording reminders, and a submission checklist.',
                                    'Printable student directions'),
        'openscied-b3-cancer-rates.html': ('Cancer Rates Data Dive — OpenSciEd Biology B.3 Lesson 1 | Lab Bench',
                                              'Explore real cancer data in a free OpenSciEd B.3 Lesson 1 companion. Sort and filter rates, compare populations, test predictions, and explain what the data can and cannot tell us.',
                                              'Cancer Rates Data Dive'),
        'openscied-b3-screening.html': ('Cancer Screening Design Lab — OpenSciEd Biology B.3 | Lab Bench',
                                           'Place an ultrasound machine and trained staff, then compare patient journeys, clinic costs, and access in a fictional district.',
                                           'Cancer Screening Design Lab'),
        'openscied-b3-cell-cycle.html': ('Cell Cycle & Cancer — a companion for OpenSciEd Biology B.3 | Lab Bench',
                                         'A free, independent cell-cycle and cancer companion for OpenSciEd Biology B.3 Lessons 3–4. Play a checkpoint game and compare how age, body size, and cell-division rate affect modeled DNA-copying opportunities.',
                                         'Cell cycle and cancer companion (OpenSciEd B.3)'),
        'openscied-b3-dna-workshop.html': ('DNA Workshop: Build, Copy, Decode | Biology Lab Bench',
                                         'Build DNA, copy both strands, make RNA, and assemble an amino acid chain in a free interactive primer for OpenSciEd Biology B.3.',
                                         'DNA Workshop: Build, Copy, Decode'),
        'openscied-b3-dna-p53.html': ('DNA Copying, p53 and Gene Expression — a companion for OpenSciEd Biology B.3 | Lab Bench',
                                      'A free, independent companion for OpenSciEd Biology B.3 Lessons 5–6. Copy DNA in a model, find copying mistakes, test three versions of p53, and follow a gene from DNA to protein.',
                                      'DNA copying, p53 and gene expression companion (OpenSciEd B.3)'),
        'openscied-b3-inheritance-environment.html': ('Inheritance, Environment and Cancer Risk — a companion for OpenSciEd Biology B.3 | Lab Bench',
                                      'A free, independent companion for OpenSciEd Biology B.3 Lessons 8–9. Read pedigrees, follow alleles through meiosis and crossing over, explore skin cancer data, and run a virtual UV yeast experiment.',
                                      'Inheritance, environment and cancer risk companion (OpenSciEd B.3)'),
        'openscied-b2-fires.html': ('Fires: Peat, Decomposition and Earth’s Tilt — a companion for OpenSciEd Biology B.2 | Lab Bench',
                                    'A free, independent companion for OpenSciEd Biology B.2 Lessons 3 and 5. Sort matter and energy cards, run a simulated yeast decomposition test, and test how the angle of light changes photosynthesis with BTB.',
                                    'Fires: peat, decomposition and Earth’s tilt companion (OpenSciEd B.2)'),
        'openscied-b2-peat-bog-lab.html': ('Peat Bog Carbon Lab — a companion for OpenSciEd Biology B.2 | Lab Bench',
                                      'A free, independent peat bog simulator for OpenSciEd Biology B.2 (Fires). Change Earth’s tilt, temperature, CO₂, oxygen, water level and fire, and compare photosynthesis, decomposition and burning.',
                                      'Peat Bog Carbon Lab companion (OpenSciEd B.2)'),
        'openscied-b2-carbon-journey.html': ('Carbon Atom Journey — OpenSciEd Biology B.2 Lesson 9 | Lab Bench',
                                      'Follow a carbon atom through seven Earth systems in a free OpenSciEd B.2 Lesson 9 board game. Roll dice, read official station events and analyze matter and energy transfers.',
                                      'Carbon Atom Journey (OpenSciEd B.2 Lesson 9)'),
        'openscied-b2-burn-lab.html': ('Burning Fuels: What Burns and Why — a companion for OpenSciEd Biology B.2 | Lab Bench',
                                      'A free, independent companion for OpenSciEd Biology B.2 Lesson 2. Run a virtual burn demonstration of grass, leaves, wood, charcoal and peat, and track BTB color, temperature and mass to see where the matter and energy go.',
                                      'Burning Fuels companion (OpenSciEd B.2)'),
    }
    for lab in LABS:
        number = lab['id']
        # Reports, progress files and the teacher dashboard reuse the document
        # title. Preserve their numbered-lab convention while improving search copy.
        specs[f'lab{number:02}.html'] = (f'Lab {number} · ' + lab['searchTitle'] + ' — AP Bio Lab Bench',
                                        lab['description'], lab['title'])
        topic = lab['searchTitle'].removesuffix(' Virtual Lab')
        specs[f'directions-lab{number:02}.html'] = (
            f'{topic}: Lab {number} Printable Directions',
            f'Free printable directions for AP Biology Lab {number}: {topic}. Follow numbered simulation steps, record your data, and prepare your report.',
            f'Lab {number} student directions')
    return specs


def item_list(filename, guides=False):
    return {'@type': 'ItemList', '@id': url(filename) + '#labs', 'numberOfItems': len(LABS),
            'itemListElement': [{'@type': 'ListItem', 'position': lab['id'],
                                 'name': lab['title'] + (' student directions' if guides else ''),
                                 'url': url(('directions-' if guides else '') + f'lab{lab["id"]:02}.html')}
                                for lab in LABS]}


def structured_data(filename, title, description, label):
    canonical = url(filename)
    website = {'@type': 'WebSite', '@id': ORIGIN + '/#website', 'url': ORIGIN + '/',
               'name': BRAND, 'alternateName': 'Biology Lab Bench', 'inLanguage': 'en',
               'creator': {'@id': ORIGIN + '/#creator'}}
    person = {'@type': 'Person', '@id': ORIGIN + '/#creator', 'name': 'Robert Smitka'}
    page = {'@type': 'WebPage', '@id': canonical + '#webpage', 'url': canonical,
            'name': title, 'description': description, 'inLanguage': 'en',
            'isPartOf': {'@id': website['@id']}, 'isAccessibleForFree': True,
            'license': LICENSE, 'creator': {'@id': person['@id']}}
    graph = [website, person, page]
    if filename == 'index.html':
        page['@type'] = 'CollectionPage'
        page['hasPart'] = [{'@type': 'WebPage', 'name': 'AP Biology Virtual Labs', 'url': url('ap-biology.html')},
                           {'@type': 'WebPage', 'name': 'OpenSciEd Biology Companion Activities', 'url': url('openscied-dashboard.html')}]
    elif filename == 'ap-biology.html':
        page['@type'] = 'CollectionPage'
        page['mainEntity'] = {'@id': canonical + '#labs'}
        graph.append(item_list(filename))
        page['breadcrumb'] = {'@id': canonical + '#breadcrumb'}
        graph.append({'@type': 'BreadcrumbList', '@id': canonical + '#breadcrumb', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Biology Lab Bench', 'item': ORIGIN + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': 'AP Biology', 'item': canonical}]})
    else:
        crumbs = [('All labs', ORIGIN + '/')]
        if filename.startswith('directions-lab'):
            crumbs.append(('Printable student directions', url('student-directions.html')))
        elif filename == 'getting-started.html':
            crumbs.append(('For teachers', url('teachers.html')))
        crumbs.append((label, canonical))
        breadcrumb = {'@type': 'BreadcrumbList', '@id': canonical + '#breadcrumb',
                      'itemListElement': [{'@type': 'ListItem', 'position': i,
                                           'name': name, 'item': link}
                                          for i, (name, link) in enumerate(crumbs, 1)]}
        page['breadcrumb'] = {'@id': breadcrumb['@id']}
        graph.append(breadcrumb)
        match = re.fullmatch(r'(directions-)?lab(\d\d)\.html', filename)
        if match:
            guide = bool(match[1])
            lab = next(lab for lab in LABS if lab['id'] == int(match[2]))
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school / AP Biology',
                         'learningResourceType': 'Student directions' if guide else 'Interactive virtual lab',
                         'teaches': lab['title'],
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'}})
            if guide:
                page['isBasedOn'] = url(f'lab{lab["id"]:02}.html')
        elif filename == 'openscied-b4-junco.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive data investigation',
                         'teaches': 'Controlled comparisons and the relationship between stress and behavior in juncos',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-4-natural-selection-evolution/'})
        elif filename == 'openscied-b1-ripple.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive ecosystem model',
                         'teaches': 'Direct and indirect effects of migration on a local Serengeti ecosystem',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-1-ecosystem-interactions-dynamics/'})
        elif filename in ('openscied-b5-wapusk.html','openscied-b5-thermoregulation.html','openscied-b5-ancestry.html','openscied-b5-speciation.html','openscied-b5-hybrid.html'):
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive evidence investigation',
                         'teaches': ('Arctic climate scenarios, hybridization, and inherited trait variation' if filename.endswith('hybrid.html') else 'Glacial cycles, evidence for speciation, and natural selection' if filename.endswith('speciation.html') else 'Common ancestry, sequence comparison and interpretation of evolutionary trees' if filename.endswith('ancestry.html') else 'Thermoregulation, field evidence and energy transfer during exercise' if filename.endswith('thermoregulation.html') else 'Interpreting Arctic bear sightings, sea ice ecoregions, and evidence at different scales'),
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-5-common-ancestry-speciation/'})
        elif filename == 'openscied-b4-wildlife-corridor.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive simulation and guided activity',
                         'teaches': 'Habitat fragmentation, wildlife corridors, and gene flow between populations over generations',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-4-natural-selection-evolution/'})
        elif filename == 'openscied-b3-cancer-rates.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive data investigation',
                         'teaches': 'How to interpret cancer incidence and mortality rates and distinguish patterns from causes',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-3-inheritance-variation-of-traits/'})
        elif filename == 'openscied-b3-screening.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive engineering simulation',
                         'teaches': 'Evaluating trade-offs in clinic cost and patient access to screening and ultrasound follow-up',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-3-inheritance-variation-of-traits/'})
        elif filename == 'openscied-b3-cell-cycle.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive simulation and guided activity',
                         'teaches': 'Cell-cycle checkpoints, p53, and cell-division patterns',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-3-inheritance-variation-of-traits/'})
        elif filename == 'openscied-b3-inheritance-environment.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive simulation and guided activity',
                         'teaches': 'Pedigrees, inheritance of alleles, meiosis and crossing over, and how the environment (UV) affects cancer risk',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-3-inheritance-variation-of-traits/'})
        elif filename == 'openscied-b2-fires.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive simulation and guided activity',
                         'teaches': 'Decomposition and cellular respiration, how temperature changes their rate, and how light drives photosynthesis and carbon storage',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://www.openscied.org/'})
        elif filename == 'openscied-b2-carbon-journey.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive board game and guided analysis',
                         'teaches': 'Carbon cycling through Earth systems, matter rearrangements and energy transfers',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-2-ecosystems-matter-energy/'})
        elif filename == 'openscied-b2-burn-lab.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive simulation and guided activity',
                         'teaches': 'Burning as a reaction that turns fuel carbon into carbon dioxide and releases stored energy as heat and light, using BTB color, temperature and mass, and why peat burns so much',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://www.openscied.org/'})
        elif filename == 'openscied-b2-peat-bog-lab.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive simulation',
                         'teaches': 'Photosynthesis, cellular respiration and burning as opposite or matching reactions, how temperature, oxygen and water change decomposition, Earth’s tilt and Arctic peat, zombie fires, and carbon dioxide and global warming',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://www.openscied.org/'})
        elif filename == 'openscied-b3-dna-p53.html':
            page.update({'@type': ['WebPage', 'LearningResource'],
                         'educationalLevel': 'High school biology',
                         'learningResourceType': 'Interactive simulation and guided activity',
                         'teaches': 'DNA replication, mutations, the role of p53, and gene expression',
                         'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                         'isBasedOn': 'https://openscied.org/instructional-materials/b-3-inheritance-variation-of-traits/'})
        elif filename == 'student-directions.html':
            page['@type'] = 'CollectionPage'
            page['mainEntity'] = {'@id': canonical + '#labs'}
            graph.append(item_list(filename, guides=True))
    return {'@context': 'https://schema.org', '@graph': graph}


def metadata(filename, title, description, label):
    canonical, image = url(filename), ORIGIN + '/img/og.png'
    alt = 'AP Bio Digital Lab Bench: lab simulation thumbnails beside the site title'
    lines = ['<!-- seo:start -->', '<title>' + escape(title) + '</title>',
             '<meta name="description" content="' + escape(description, quote=True) + '">',
             '<link rel="canonical" href="' + canonical + '">',
             '<meta name="robots" content="index, follow, max-image-preview:large">']
    fields = {'og:type': 'website', 'og:site_name': BRAND, 'og:title': title,
              'og:description': description, 'og:url': canonical, 'og:locale': 'en_US',
              'og:image': image, 'og:image:type': 'image/png', 'og:image:width': '1200',
              'og:image:height': '630', 'og:image:alt': alt}
    lines += ['<meta property="' + key + '" content="' + escape(value, quote=True) + '">'
              for key, value in fields.items()]
    fields = {'twitter:card': 'summary_large_image', 'twitter:title': title,
              'twitter:description': description, 'twitter:image': image, 'twitter:image:alt': alt}
    lines += ['<meta name="' + key + '" content="' + escape(value, quote=True) + '">'
              for key, value in fields.items()]
    data = json.dumps(structured_data(filename, title, description, label), ensure_ascii=False,
                      separators=(',', ':')).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    lines += ['<script type="application/ld+json">' + data + '</script>', '<!-- seo:end -->']
    return '\n'.join(lines)


def apply_metadata(filename, html, spec):
    head, rest = html.split('</head>', 1)
    head = re.sub(r'\n?<!-- seo:start -->.*?<!-- seo:end -->\n?', '\n', head, flags=re.S)
    head = re.sub(r'<title>.*?</title>\n?', '', head, flags=re.S)
    head = re.sub(r'<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>\n?', '', head)
    head = re.sub(r'<link\b[^>]*rel="canonical"[^>]*>\n?', '', head)
    # Keep the migration script immediately after charset, before metadata JSON-LD
    # and all existing scripts, so old-domain visitors retain the saved-work guard.
    head, count = re.subn(r'(<script src="domain-redirect.js"></script>)\n?',
                         lambda m: m[1] + '\n' + metadata(filename, *spec) + '\n', head, count=1)
    if count != 1:
        raise ValueError(filename + ': missing domain-migration script')
    return head + '</head>' + rest


def cards():
    out = []
    for group in CONTENT['groups']:
        n = group['n']
        out.append(f'  <section class="bi wrap wrap--wide gutter" aria-labelledby="bi{n}">\n'
                   f'    <div class="bi-head"><span class="eyebrow">Big Idea {n}</span><h2 id="bi{n}">{escape(group["name"])}</h2><span class="muted small">{escape(group["units"])}</span></div>\n'
                   '    <div class="cards">')
        for lab in group['labs']:
            number = lab['id']
            image_attrs = ('decoding="sync"' + (' fetchpriority="high"' if number <= 3 else '')) if number <= 6 else 'loading="lazy" decoding="async"'
            out.append(f'      <a class="card" href="lab{number:02}.html">\n'
                       f'        <img class="thumb" src="img/lab{number:02}.webp" width="480" height="300" alt="{escape(lab["alt"], quote=True)}" {image_attrs}>\n'
                       f'        <span class="num">Investigation {number}</span>\n'
                       f'        <h3>{escape(lab["title"])}</h3>\n'
                       f'        <span class="dq">{escape(lab["q"])}</span>\n'
                       f'        <span class="sim-line">{escape(lab["sim"])}</span>\n'
                       '        <span class="meta">' + ''.join('<span class="tag">' + escape(t) + '</span>' for t in lab['topics']) + '</span>\n'
                       f'        <span class="lab-prog" data-lab-progress="lab{number:02}"></span>\n'
                       '      </a>')
        out.append('    </div>\n  </section>')
    return '\n'.join(out)


def build(check=False):
    outputs = {}
    for filename, spec in page_specs().items():
        html = (ROOT / filename).read_text()
        if filename == 'ap-biology.html':
            html, count = re.subn(r'<!-- lab-catalog:start -->.*?<!-- lab-catalog:end -->',
                                 lambda _: '<!-- lab-catalog:start -->\n' + cards() + '\n<!-- lab-catalog:end -->', html, flags=re.S)
            if count != 1:
                raise ValueError('ap-biology.html: missing or duplicate static lab-catalog markers')
        outputs[filename] = apply_metadata(filename, html, spec)
    for filename in UTILITIES:
        html = (ROOT / filename).read_text()
        if 'name="robots"' not in html.split('</head>')[0]:
            html = html.replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>', 1)
        outputs[filename] = html
    outputs['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join('  <url><loc>' + url(name) + '</loc></url>\n' for name in page_specs()) + '</urlset>\n'
    # Do not disallow notes: crawlers must be able to see their noindex directive.
    outputs['robots.txt'] = '# Public lessons are crawlable; protected/utility pages carry noindex.\nUser-agent: *\nAllow: /\nDisallow: /tests/\nDisallow: /tools/\n\nSitemap: ' + ORIGIN + '/sitemap.xml\n'
    outputs['_headers'] = '# Cloudflare Pages: keep answer keys and utility pages out of search.\n# Apply to clean URLs and source-file URLs; encryption remains the access control.\n' + ''.join('/' + name.removesuffix('.html') + '\n  X-Robots-Tag: noindex, nosnippet\n/' + name + '\n  X-Robots-Tag: noindex, nosnippet\n\n' for name in PRIVATE + UTILITIES)
    outputs['_headers'] += '# Printable copies duplicate the indexable HTML guides.\n/student-pdfs/*\n  X-Robots-Tag: noindex\n'
    outputs['_headers'] += '\n# Instructions for AI agents: readable by anyone, kept out of search results.\n/AGENTS.md\n  X-Robots-Tag: noindex\n/CLAUDE.md\n  X-Robots-Tag: noindex\n'
    outputs['_headers'] += ('\n# Always revalidate (a cheap 304 when unchanged). Without this a phone can keep an old script or stylesheet\n'
        '# while the page itself is new, so a deploy that changes HTML and JS together breaks for that visitor\n'
        '# (blank scenes, unstyled cards). Scripts and styles are not fingerprinted, and pages are served at clean\n'
        '# addresses without .html, so the rule covers every path.\n/*\n  Cache-Control: no-cache\n')
    drift = [name for name, text in outputs.items() if not (ROOT / name).exists() or (ROOT / name).read_text() != text]
    if check and drift:
        raise SystemExit('SEO outputs need rebuilding: ' + ', '.join(drift))
    if not check:
        for name in drift:
            (ROOT / name).write_text(outputs[name])
    print(f'SEO {"checked" if check else "built"}: {len(page_specs())} public pages, static lab cards, sitemap, robots, and indexing headers.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
