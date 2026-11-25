#!/usr/bin/env python3
"""Search/discovery contracts for the actual committed public HTML (stdlib only)."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import json
import re
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://biologylabbench.com'
PUBLIC = ['index.html', 'ap-biology.html', 'teachers.html', 'getting-started.html', 'student-directions.html',
          'openscied-teacher-guide.html', 'openscied-b4-hawksbeard.html', 'openscied-b4-rat-generations.html', 'openscied-b4-junco.html', 'openscied-b4-wildlife-corridor.html', 'openscied-b1-ripple.html', 'openscied-b3-screening.html', 'openscied-b5-wapusk.html', 'openscied-b5-thermoregulation.html', 'openscied-b5-ancestry.html', 'openscied-b5-speciation.html', 'openscied-b5-hybrid.html']
PUBLIC += ['openscied-b3-cancer-rates.html', 'openscied-b3-cell-cycle.html', 'openscied-b3-dna-workshop.html', 'openscied-b3-dna-p53.html', 'openscied-b3-inheritance-environment.html', 'openscied-b2-fires.html', 'openscied-b2-peat-bog-lab.html', 'openscied-b2-burn-lab.html', 'openscied-b2-carbon-journey.html']
PUBLIC += [f'{prefix}lab{i:02}.html' for prefix in ['', 'directions-'] for i in range(1, 14)]
PRIVATE = ['teacher-notes.html', 'openscied-teacher-notes.html'] + [f'teacher-lab{i:02}.html' for i in range(1, 14)]
UTILITIES = ['teacher-dashboard.html', 'projector.html', 'feedback.html',
             'sample-report.html', '_template.html', '404.html']


class Page(HTMLParser):
    def __init__(self, filename):
        super().__init__()
        self.head = True
        self.meta, self.canonicals, self.titles, self.graphs = {}, [], [], []
        self.cards, self.images, self.progress = [], [], []
        self.script_type = None
        self.in_title = False
        self.in_noscript = False
        self.json = ''
        self.feed((ROOT / filename).read_text())

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'noscript':
            self.in_noscript = True
        if tag == 'meta' and self.head:
            key = a.get('name', a.get('property'))
            if key:
                self.meta.setdefault(key, []).append(a.get('content', ''))
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonicals.append(a['href'])
        if tag == 'title' and self.head:
            self.in_title = True
            self.titles.append('')
        if tag == 'script':
            self.script_type = a.get('type', '')
            self.json = ''
        # A noscript-only directory would not solve initial-HTML discovery.
        if tag == 'a' and 'card' in a.get('class', '').split() and not self.in_noscript:
            self.cards.append(a.get('href'))
        if tag == 'img' and 'thumb' in a.get('class', '').split():
            self.images.append(a)
        if 'data-lab-progress' in a:
            self.progress.append(a['data-lab-progress'])

    def handle_endtag(self, tag):
        if tag == 'head':
            self.head = False
        if tag == 'title':
            self.in_title = False
        if tag == 'noscript':
            self.in_noscript = False
        if tag == 'script':
            if self.script_type == 'application/ld+json':
                self.graphs.append(json.loads(self.json))
            self.script_type = None

    def handle_data(self, text):
        if self.in_title:
            self.titles[-1] += text
        if self.script_type == 'application/ld+json':
            self.json += text


class SearchContracts(unittest.TestCase):
    def test_goatcounter_is_loaded_once_on_every_site_page(self):
        pages = PUBLIC + PRIVATE + UTILITIES
        tracker = '<script data-goatcounter="https://smitka313.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>'
        for filename in pages:
            with self.subTest(page=filename):
                html = (ROOT / filename).read_text()
                self.assertEqual(html.count(tracker), 1)
    def test_public_pages_have_one_consistent_search_identity(self):
        titles, descriptions, urls = [], [], []
        for filename in PUBLIC:
            with self.subTest(page=filename):
                p = Page(filename)
                self.assertIn('<meta charset="utf-8">\n<script src="domain-redirect.js"></script>',
                              (ROOT / filename).read_text())
                self.assertEqual(len(p.titles), 1)
                if re.fullmatch(r'lab\d\d\.html', filename):
                    self.assertTrue(p.titles[0].startswith('Lab ' + str(int(filename[3:5])) + ' · '))
                    self.assertTrue(p.titles[0].endswith(' — AP Bio Lab Bench'))
                self.assertEqual(len(p.canonicals), 1)
                self.assertEqual(len(p.meta['description']), 1)
                canonical = p.canonicals[0]
                expected = ORIGIN + ('/' if filename == 'index.html' else '/' + filename[:-5])
                self.assertEqual(canonical, expected)
                self.assertNotIn('noindex', p.meta['robots'][0])
                self.assertIn('max-image-preview:large', p.meta['robots'][0])
                self.assertEqual(p.meta['og:url'], [canonical])
                self.assertEqual(p.meta['og:title'], p.titles)
                self.assertEqual(p.meta['twitter:title'], p.titles)
                self.assertEqual(p.meta['og:description'], p.meta['description'])
                self.assertEqual(p.meta['twitter:description'], p.meta['description'])
                self.assertEqual(p.meta['twitter:image'], p.meta['og:image'])
                image_path = '/img/og-home.png' if filename == 'index.html' else '/img/og.png'
                self.assertEqual(p.meta['og:image'], [ORIGIN + image_path])
                if filename == 'index.html':
                    png = (ROOT / image_path.lstrip('/')).read_bytes()
                    self.assertEqual(png[:8], b'\x89PNG\r\n\x1a\n')
                    self.assertEqual(tuple(int.from_bytes(png[i:i + 4], 'big') for i in (16, 20)), (1200, 630))
                self.assertTrue(p.meta['og:image:alt'][0])
                self.assertEqual(len(p.graphs), 1)
                self.assertEqual(p.graphs[0]['@context'], 'https://schema.org')
                graph = p.graphs[0]['@graph']
                page = next(n for n in graph if n['@id'] == canonical + '#webpage')
                self.assertEqual(page['url'], canonical)
                self.assertEqual(page['description'], p.meta['description'][0])
                self.assertTrue(page['isAccessibleForFree'])
                if filename.startswith(('lab', 'directions-lab')):
                    self.assertIn('LearningResource', page['@type'])
                    self.assertEqual(page['audience']['educationalRole'], 'student')
                if filename != 'index.html':
                    crumbs = next(n for n in graph if n['@type'] == 'BreadcrumbList')['itemListElement']
                    self.assertEqual(crumbs[-1]['item'], canonical)
                    self.assertEqual([n['position'] for n in crumbs], list(range(1, len(crumbs) + 1)))
                titles += p.titles
                descriptions += p.meta['description']
                urls += p.canonicals
        self.assertEqual(len(set(titles)), len(PUBLIC))
        self.assertEqual(len(set(descriptions)), len(PUBLIC))
        self.assertEqual(len(set(urls)), len(PUBLIC))

    def test_sitemap_contains_exactly_public_canonical_pages(self):
        doc = ET.parse(ROOT / 'sitemap.xml')
        urls = [e.text for e in doc.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertEqual(len(urls), len(PUBLIC))
        self.assertEqual(set(urls), {Page(f).canonicals[0] for f in PUBLIC})
        for link in urls:
            parsed = urlparse(link)
            self.assertFalse(parsed.query or parsed.fragment)
            source = 'index.html' if parsed.path == '/' else parsed.path[1:] + '.html'
            self.assertTrue((ROOT / source).is_file())
        # A build timestamp would falsely imply all lessons changed on every rebuild.
        self.assertIsNone(doc.find('.//{http://www.sitemaps.org/schemas/sitemap/0.9}lastmod'))

    def test_ap_directory_cards_are_real_html_with_progress_hooks_and_reserved_images(self):
        p = Page('ap-biology.html')
        self.assertEqual(p.cards, [f'lab{i:02}.html' for i in range(1, 14)])
        self.assertEqual(p.progress, [f'lab{i:02}' for i in range(1, 14)])
        self.assertEqual(len(p.images), 13)
        for i, image in enumerate(p.images, 1):
            self.assertEqual(image['src'], f'img/lab{i:02}.webp')
            self.assertEqual((image['width'], image['height']), ('480', '300'))
            self.assertTrue(image['alt'])
            if i <= 6:
                self.assertNotEqual(image.get('loading'), 'lazy')
        self.assertNotIn("document.getElementById('labs').innerHTML", (ROOT / 'ap-biology.html').read_text())
        for name, prefix in [('ap-biology.html', ''), ('student-directions.html', 'directions-')]:
            graph = Page(name).graphs[0]['@graph']
            listing = next(n for n in graph if n['@type'] == 'ItemList')
            self.assertEqual(listing['numberOfItems'], 13)
            self.assertEqual([n['url'] for n in listing['itemListElement']],
                             [ORIGIN + f'/{prefix}lab{i:02}' for i in range(1, 14)])

    def test_noindex_is_visible_to_crawlers_and_headers_cover_both_route_forms(self):
        robots = (ROOT / 'robots.txt').read_text()
        self.assertIn('Sitemap: ' + ORIGIN + '/sitemap.xml', robots)
        self.assertNotRegex(robots, r'(?m)^Disallow:\s*/(?:$|teacher|lab|directions|student)')
        headers = (ROOT / '_headers').read_text()
        for filename in PRIVATE + UTILITIES:
            with self.subTest(page=filename):
                p = Page(filename)
                self.assertIn('noindex', p.meta['robots'][0])
                for route in [filename, filename.removesuffix('.html')]:
                    self.assertIn('/' + route + '\n  X-Robots-Tag: noindex, nosnippet\n', headers)
        # Do not accidentally suppress the public teacher resource pages.
        for filename in PUBLIC:
            self.assertNotIn('/' + filename.removesuffix('.html') + '\n', headers)


if __name__ == '__main__':
    unittest.main(verbosity=2)
