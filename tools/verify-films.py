from html.parser import HTMLParser
from pathlib import Path


class FilmsStructure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.section_stack = []
        self.article_stack = []
        self.has_films_section = False
        self.canvas_wrappers = 0
        self.canvas_inside_spotify = False
        self.canvas_before_artists = False
        self.canvas_details_depth = None
        self.in_canvas = False
        self.canvas_div_depth = 0
        self.details_depth = 0
        self.artist_disclosures = 0
        self.spotify_child_order = []
        self.canvas_nested_details = 0
        self.film_cards = 0
        self.videos = []
        self.placeholders = 0
        self.in_heading = False
        self.headings = []
        self.stylesheets = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'link' and attributes.get('rel') == 'stylesheet':
            self.stylesheets.append(attributes.get('href', ''))
        if tag == 'script' and attributes.get('src'):
            self.scripts.append(attributes['src'])
        if tag == 'section':
            section_id = attributes.get('id')
            self.section_stack.append(section_id)
            if section_id == 'films':
                self.has_films_section = True
        if tag == 'article':
            self.article_stack.append(attributes.get('id'))
        if tag == 'details':
            self.details_depth += 1
            if 'data-artist-disclosure' in attributes:
                self.artist_disclosures += 1
                if 'spotify' in self.article_stack:
                    self.spotify_child_order.append('artist')
            if self.in_canvas:
                self.canvas_nested_details += 1
        in_artworks = 'art-works' in self.section_stack
        classes = attributes.get('class', '').split()
        if in_artworks and tag == 'div' and 'artworks__canvas' in classes:
            self.canvas_wrappers += 1
            self.canvas_inside_spotify = 'spotify' in self.article_stack
            self.canvas_before_artists = self.artist_disclosures == 0
            self.canvas_details_depth = self.details_depth
            if self.canvas_inside_spotify:
                self.spotify_child_order.append('canvas')
            self.in_canvas = True
            self.canvas_div_depth = 1
        elif self.in_canvas and tag == 'div':
            self.canvas_div_depth += 1
        if self.in_canvas and tag in {'h2', 'h3', 'h4'}:
            self.in_heading = True
            self.headings.append({'tag': tag, 'text': ''})
        if not self.in_canvas:
            return
        if tag == 'article' and 'film' in classes:
            self.film_cards += 1
        if tag == 'video':
            self.videos.append(attributes)
        if 'slot' in classes:
            self.placeholders += 1

    def handle_endtag(self, tag):
        if tag in {'h2', 'h3', 'h4'} and self.in_heading:
            self.in_heading = False
        if tag == 'div' and self.in_canvas:
            self.canvas_div_depth -= 1
            if self.canvas_div_depth == 0:
                self.in_canvas = False
        if tag == 'article':
            self.article_stack.pop()
        if tag == 'details':
            self.details_depth -= 1
        if tag == 'section':
            self.section_stack.pop()

    def handle_data(self, data):
        if self.in_heading:
            self.headings[-1]['text'] += data


root = Path(__file__).resolve().parents[1]
parser = FilmsStructure()
parser.feed((root / 'index.html').read_text(encoding='utf-8'))

expected_sources = {
    'art/films/Dream%208.mp4',
    'art/films/Single%202%20canvas.mp4',
    'art/films/Single%205%20canvas.mp4',
}
actual_sources = {video.get('src') for video in parser.videos}

if parser.has_films_section:
    raise SystemExit('Expected the standalone Films section to be removed.')
if parser.canvas_wrappers != 1:
    raise SystemExit(f'Expected one Canvas wrapper; found {parser.canvas_wrappers}')
if not parser.canvas_inside_spotify:
    raise SystemExit('Expected Canvas to be a subsection inside Spotify.')
if not parser.canvas_before_artists:
    raise SystemExit('Expected Canvas directly below Spotify, before the artist dropdowns.')
if parser.canvas_details_depth != 1:
    raise SystemExit('Expected Canvas to remain visible without its own dropdown.')
if parser.canvas_nested_details:
    raise SystemExit('Expected no dropdown inside the Canvas wrapper.')
expected_spotify_child_order = ['canvas', 'artist', 'artist', 'artist']
if parser.spotify_child_order != expected_spotify_child_order:
    raise SystemExit(
        'Expected Canvas immediately below Spotify, followed by the three artists; '
        f'found {parser.spotify_child_order}'
    )
headings = [
    (heading['tag'], ' '.join(heading['text'].split()))
    for heading in parser.headings
]
if headings != [('h3', 'Canvas')]:
    raise SystemExit(f'Expected one Canvas h3 inside its wrapper; found {headings}')
if parser.film_cards != 3:
    raise SystemExit(f'Expected three Canvas video cards; found {parser.film_cards}')
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

required_script_fragments = [
    '@supabase/supabase-js@2.117.0/dist/umd/supabase.min.js',
    'js/supabase-config.js?v=',
    'js/content-model.js?v=',
    'js/content-api.js?v=',
    'js/content-render.js?v=',
    'js/art-works-scroll.js?v=',
    'js/site.js?v=',
]
positions = []
for fragment in required_script_fragments:
    matches = [index for index, source in enumerate(parser.scripts) if fragment in source]
    if len(matches) != 1:
        raise SystemExit(f'Expected one script containing {fragment}; found {len(matches)}')
    positions.append(matches[0])
if positions != sorted(positions):
    raise SystemExit('Expected Supabase and managed-content scripts before scroll and site scripts')

print('Canvas structure checks passed.')
