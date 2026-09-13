from html.parser import HTMLParser
from pathlib import Path


class FilmsStructure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_films = False
        self.film_cards = 0
        self.videos = []
        self.placeholders = 0
        self.stylesheets = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'link' and attributes.get('rel') == 'stylesheet':
            self.stylesheets.append(attributes.get('href', ''))
        if tag == 'script' and attributes.get('src'):
            self.scripts.append(attributes['src'])
        if tag == 'section' and attributes.get('id') == 'films':
            self.in_films = True
            return
        if not self.in_films:
            return
        classes = attributes.get('class', '').split()
        if tag == 'article' and 'film' in classes:
            self.film_cards += 1
        if tag == 'video':
            self.videos.append(attributes)
        if 'slot' in classes:
            self.placeholders += 1

    def handle_endtag(self, tag):
        if tag == 'section' and self.in_films:
            self.in_films = False


root = Path(__file__).resolve().parents[1]
parser = FilmsStructure()
parser.feed((root / 'index.html').read_text(encoding='utf-8'))

expected_sources = {
    'art/films/Dream%208.mp4',
    'art/films/Single%202%20canvas.mp4',
    'art/films/Single%205%20canvas.mp4',
}
actual_sources = {video.get('src') for video in parser.videos}

if parser.film_cards != 3:
    raise SystemExit(f'Expected three film cards; found {parser.film_cards}')
if len(parser.videos) != 3:
    raise SystemExit(f'Expected three film players; found {len(parser.videos)}')
if actual_sources != expected_sources:
    raise SystemExit(
        f'Film source mismatch. Expected {sorted(expected_sources)}; '
        f'found {sorted(value for value in actual_sources if value)}'
    )
if parser.placeholders:
    raise SystemExit(f'Expected no mock film placeholders; found {parser.placeholders}')

required_boolean_attributes = {'autoplay', 'muted', 'loop', 'playsinline', 'controls'}
for video in parser.videos:
    missing = sorted(required_boolean_attributes - video.keys())
    if missing:
        raise SystemExit(f"Film {video.get('src')} is missing attributes: {missing}")
    if video.get('preload') != 'metadata':
        raise SystemExit(f"Film {video.get('src')} must preload metadata only")
    if not video.get('aria-label', '').strip():
        raise SystemExit(f"Film {video.get('src')} needs an accessible label")

if not any(value.startswith('css/site.css?v=') for value in parser.stylesheets):
    raise SystemExit('Expected the updated film stylesheet URL to be cache-versioned')
if not any(value.startswith('js/site.js?v=') for value in parser.scripts):
    raise SystemExit('Expected the updated site script URL to be cache-versioned')

print('Films structure checks passed.')
