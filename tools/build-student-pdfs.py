#!/usr/bin/env python3
"""Build public, static student-guide PDFs. --check verifies source/output hashes.

Install tools/pdf-requirements.txt to generate. --check uses the standard library.
No browser, server, student storage, network resources or teacher notes are read.
"""
from pathlib import Path
from html import escape
from html.parser import HTMLParser
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'student-pdfs'


def text(value):
    return ' '.join(value.split())


class Guide(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.data = {'title': '', 'question': '', 'intro': [], 'sections': []}
        self.in_header = self.in_aside = False
        self.section = None
        self.capture = None
        self.feed(source)
        if not self.data['title'] or not self.data['sections']:
            raise ValueError('Guide is missing its title or procedure sections')

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'header':
            self.in_header = True
        if tag == 'aside':
            self.in_aside = True
        if tag == 'section':
            self.section = {'id': attrs.get('id', ''), 'title': '', 'steps': [],
                            'notes': 'notes' in attrs.get('class', '').split()}
            self.data['sections'].append(self.section)
        target = None
        if tag == 'h1' and self.in_header:
            target = ('title', self.data)
        elif tag == 'p' and self.in_header and 'question' in attrs.get('class', '').split():
            target = ('question', self.data)
        elif tag == 'p' and self.in_aside and 'screen-only' not in attrs.get('class', '').split():
            target = ('intro', self.data)
        elif tag == 'h2' and self.section is not None:
            target = ('title', self.section)
        elif tag == 'li' and self.section is not None:
            target = ('steps', self.section)
        if target:
            self.capture = (tag, target, [])

    def handle_data(self, value):
        if self.capture:
            self.capture[2].append(value)

    def handle_endtag(self, tag):
        if self.capture and self.capture[0] == tag:
            _, (key, obj), chunks = self.capture
            value = text(''.join(chunks))
            if isinstance(obj[key], list):
                obj[key].append(value)
            else:
                obj[key] = value
            self.capture = None
        if tag == 'header':
            self.in_header = False
        if tag == 'aside':
            self.in_aside = False
        if tag == 'section':
            self.section = None


def contents(number):
    data = Guide((ROOT / f'directions-lab{number:02}.html').read_text()).data
    data['lab'] = number
    data['url'] = f'https://biologylabbench.com/lab{number:02}'
    return data


def source_hash(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def print_text(value):
    return value.translate(str.maketrans({char: '-' for char in '\u2010\u2011\u2012\u2013\u2014\u2015\u2212'}))


def renderer_hash():
    parts = [Path(__file__), ROOT / 'tools/pdf-requirements.txt',
             ROOT / 'tools/fonts/DejaVuSans.ttf', ROOT / 'tools/fonts/DejaVuSans-Bold.ttf']
    return hashlib.sha256(b''.join(p.read_bytes() for p in parts)).hexdigest()


def render(data, target):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Flowable

    fonts = ROOT / 'tools/fonts'
    for name, filename in [('Guide', 'DejaVuSans.ttf'), ('GuideBold', 'DejaVuSans-Bold.ttf')]:
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, str(fonts / filename)))
    pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold', italic='Guide', boldItalic='GuideBold')
    ink, green = colors.HexColor('#17271e'), colors.HexColor('#07573f')
    body = ParagraphStyle('body', fontName='Guide', fontSize=10, leading=13, textColor=ink, spaceAfter=7)
    small = ParagraphStyle('small', parent=body, fontSize=8, leading=11, spaceAfter=6)
    title = ParagraphStyle('title', parent=body, fontName='GuideBold', fontSize=22, leading=26, spaceAfter=10)
    heading = ParagraphStyle('heading', parent=body, fontName='GuideBold', fontSize=12, leading=16,
                             spaceBefore=8, spaceAfter=4, keepWithNext=True)

    class Checkbox(Flowable):
        def __init__(self):
            super().__init__()
            self.width, self.height = 10, 14
        def draw(self):
            self.canv.setStrokeColor(ink)
            self.canv.setLineWidth(.7)
            self.canv.rect(0, 3, 8, 8)

    class Notes(Flowable):
        def __init__(self):
            super().__init__()
            self.width, self.height = 532, 50
        def draw(self):
            self.canv.setStrokeColor(colors.HexColor('#aab5ae'))
            self.canv.setLineWidth(.5)
            for y in [8, 24, 40]:
                self.canv.line(0, y, self.width, y)

    class Pages(Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.saved = []
        def showPage(self):
            self.saved.append(dict(self.__dict__))
            self._startPage()
        def save(self):
            total = len(self.saved)
            for state in self.saved:
                self.__dict__.update(state)
                self.setFont('Guide', 7)
                self.setFillColor(ink)
                self.drawString(40, 23, f'Biology Lab Bench | Lab {data["lab"]} | Robert Smitka | CC BY-NC-SA 4.0')
                self.drawRightString(572, 23, f'{self._pageNumber} / {total}')
                super().showPage()
            super().save()

    story = [Paragraph(f'LAB {data["lab"]} | PRINTABLE STUDENT DIRECTIONS', small),
             Paragraph(escape(print_text(data['title'])), title), Paragraph(escape(print_text(data['question'])), body),
             Spacer(1, 5), Paragraph('Name: ____________________   Class/period: __________   Dataset ID: __________', small),
             Paragraph('<a href="' + data['url'] + '" color="#07573f">' + data['url'] + '</a>', small),
             Paragraph('How to use this guide', heading)]
    story += [Paragraph(escape(print_text(p)), body) for p in data['intro']]
    for section in data['sections']:
        link = data['url'] + ('#' + section['id'] if section['id'] else '')
        story.append(Paragraph('<a href="' + link + '" color="#07573f">' + escape(print_text(section['title'])) + '</a>', heading))
        if section['notes']:
            story.append(Notes())
        for i, step in enumerate(section['steps'], 1):
            row = Table([[Checkbox(), Paragraph(str(i) + '. ' + escape(print_text(step)), body)]], colWidths=[18, 514])
            row.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                     ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                                     ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
            story.append(row)
    doc = SimpleDocTemplate(str(target), pagesize=letter, leftMargin=40, rightMargin=40,
                            topMargin=34, bottomMargin=38, title=f'Lab {data["lab"]}: {data["title"]} - Student Directions',
                            author='Robert Smitka', subject='Public student directions for Biology Lab Bench',
                            invariant=1, pageCompression=1)
    doc.build(story, canvasmaker=Pages)


def build(check=False):
    manifest_path = DEST / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if check and manifest_path.exists() else {}
    expected = {}
    renderer = renderer_hash()
    DEST.mkdir(exist_ok=True)
    for number in range(1, 14):
        data = contents(number)
        filename = f'directions-lab{number:02}.pdf'
        target = DEST / filename
        if check:
            record = manifest.get(filename)
            if not target.exists() or not record or record['source_sha256'] != source_hash(data) or record.get('renderer_sha256') != renderer:
                raise SystemExit(filename + ': rebuild PDFs after changing guide contents')
            if hashlib.sha256(target.read_bytes()).hexdigest() != record['pdf_sha256']:
                raise SystemExit(filename + ': output does not match the PDF manifest')
        else:
            render(data, target)
            expected[filename] = {'source_sha256': source_hash(data), 'renderer_sha256': renderer,
                                  'pdf_sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    if check and set(manifest) != {f'directions-lab{i:02}.pdf' for i in range(1, 14)}:
        raise SystemExit('PDF manifest must list exactly the 13 student guides')
    if not check:
        manifest_path.write_text(json.dumps(expected, indent=2, sort_keys=True) + '\n')
    print(('Checked' if check else 'Built') + ' 13 public student-guide PDFs.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
