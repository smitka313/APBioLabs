#!/usr/bin/env python3
"""Validate public downloadable guides against their actual HTML source."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import runpy
import shutil
import tempfile
import unittest
from unittest.mock import patch
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
BUILD = runpy.run_path(str(ROOT / 'tools/build-student-pdfs.py'))


class Links(HTMLParser):
    def __init__(self, name):
        super().__init__()
        self.pdfs = []
        self.feed((ROOT / name).read_text())
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'a' and a.get('href', '').endswith('.pdf'):
            self.pdfs.append(a)


def plain(value):
    return ' '.join(BUILD['print_text'](value).split())


class StudentPDFs(unittest.TestCase):
    def test_all_download_links_work_without_javascript(self):
        catalog = Links('student-directions.html')
        self.assertEqual(len(catalog.pdfs), 13)
        for number in range(1, 14):
            path = f'student-pdfs/directions-lab{number:02}.pdf'
            guide = Links(f'directions-lab{number:02}.html')
            self.assertEqual([a['href'] for a in guide.pdfs], [path])
            self.assertIn('download', guide.pdfs[0])
            self.assertEqual(catalog.pdfs[number - 1]['href'], path)
            self.assertTrue((ROOT / path).is_file())

    def test_pdf_content_matches_every_public_guide_step(self):
        for number in range(1, 14):
            with self.subTest(lab=number):
                data = BUILD['contents'](number)
                pdf = PdfReader(ROOT / f'student-pdfs/directions-lab{number:02}.pdf')
                self.assertFalse(pdf.is_encrypted)
                self.assertIn(f'Lab {number}:', pdf.metadata.title)
                self.assertEqual(pdf.metadata.author, 'Robert Smitka')
                self.assertGreaterEqual(len(pdf.pages), 1)
                self.assertLessEqual(len(pdf.pages), 4)
                content = plain(' '.join(p.extract_text() for p in pdf.pages))
                self.assertIn(plain(data['title']), content)
                self.assertIn(plain(data['question']), content)
                self.assertIn('Dataset ID:', content)
                for intro in data['intro']:
                    self.assertIn(plain(intro), content)
                for section in data['sections']:
                    self.assertIn(plain(section['title']), content)
                    for step in section['steps']:
                        self.assertIn(plain(step), content)
                for i, page in enumerate(pdf.pages, 1):
                    page_text = plain(page.extract_text())
                    self.assertIn(f'{i} / {len(pdf.pages)}', page_text)
                    self.assertGreater(len(page_text), 150, 'blank or nearly blank page')
                    self.assertEqual(tuple(float(x) for x in page.mediabox), (0, 0, 612, 792))
                links = [a.get_object().get('/A', {}).get('/URI')
                         for page in pdf.pages for a in page.get('/Annots', [])]
                self.assertIn(data['url'], links)

    def test_manifest_rejects_stale_sources_and_changed_pdf_bytes(self):
        # The checker reads real semantic guide content and verifies every output.
        BUILD['build'](check=True)
        original = BUILD['contents']
        def changed(number):
            data = original(number)
            data['sections'][0]['steps'][0] += ' A changed instruction.'
            return data
        with patch.dict(BUILD['build'].__globals__, {'contents': changed}):
            with self.assertRaisesRegex(SystemExit, 'rebuild PDFs'):
                BUILD['build'](check=True)
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder)
            shutil.copy(ROOT / 'student-pdfs/manifest.json', dest / 'manifest.json')
            pdf = ROOT / 'student-pdfs/directions-lab01.pdf'
            (dest / pdf.name).write_bytes(pdf.read_bytes() + b'changed')
            with patch.dict(BUILD['build'].__globals__, {'DEST': dest}):
                with self.assertRaisesRegex(SystemExit, 'does not match'):
                    BUILD['build'](check=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
