from html.parser import HTMLParser
from pathlib import Path


class PortfolioStructure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.section_ids = []
        self.current_section = None
        self.in_heading = False
        self.headings = []
        self.details_depth = 0
        self.summary_depth = 0
        self.summaries = []
        self.youtube_iframes = []
        self.in_nav = False
        self.current_nav_link = None
        self.nav_links = []
        self.scroll_disclosures = 0
        self.artwork_images = []
        self.artist_gallery_classes = []
        self.artist_disclosures = 0
        self.hover_artist_disclosures = 0

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'nav':
            self.in_nav = True
        if self.in_nav and tag == 'a':
            self.current_nav_link = {'href': attributes.get('href'), 'text': ''}
            self.nav_links.append(self.current_nav_link)
        if tag == 'section':
            self.current_section = attributes.get('id')
            if self.current_section:
                self.section_ids.append(self.current_section)
        if self.current_section == 'art-works':
            if tag in {'h2', 'h3'}:
                self.in_heading = True
                self.headings.append('')
            if tag == 'details':
                self.details_depth += 1
                if 'data-scroll-disclosure' in attributes:
                    self.scroll_disclosures += 1
                if 'data-artist-disclosure' in attributes:
                    self.artist_disclosures += 1
                    if 'data-hover-disclosure' in attributes:
                        self.hover_artist_disclosures += 1
            if tag == 'summary':
                self.summary_depth += 1
                self.summaries.append('')
            if tag == 'iframe':
                self.youtube_iframes.append(attributes)
            if tag == 'img':
                self.artwork_images.append(attributes)
            if tag == 'div' and 'artworks__artist-gallery' in attributes.get('class', '').split():
                self.artist_gallery_classes.append(attributes.get('class', '').split())

    def handle_endtag(self, tag):
        if self.current_section == 'art-works':
            if tag in {'h2', 'h3'}:
                self.in_heading = False
            if tag == 'summary':
                self.summary_depth -= 1
            if tag == 'details':
                self.details_depth -= 1
        if tag == 'section':
            self.current_section = None
        if tag == 'a':
            self.current_nav_link = None
        if tag == 'nav':
            self.in_nav = False

    def handle_data(self, data):
        if self.current_nav_link is not None:
            self.current_nav_link['text'] += data
        if self.current_section != 'art-works':
            return
        if self.in_heading:
            self.headings[-1] += data
        if self.summary_depth:
            self.summaries[-1] += data


root = Path(__file__).resolve().parents[1]
parser = PortfolioStructure()
parser.feed((root / 'index.html').read_text(encoding='utf-8'))

expected_order = ['work', 'art-works', 'manifesto']
actual_order = [section for section in parser.section_ids if section in expected_order]
if actual_order != expected_order:
    raise SystemExit(f'Expected section order {expected_order}; found {actual_order}')

headings = [' '.join(value.split()) for value in parser.headings]
if headings != ['Art Works']:
    raise SystemExit(f'Expected the Art Works heading; found {headings}')

summaries = [' '.join(value.split()) for value in parser.summaries]
expected_summaries = ['Youtube', 'Spotify', 'Irmak Akıncı', 'Feridun Hürel', 'Hümeyra']
if summaries != expected_summaries:
    raise SystemExit(f'Expected disclosure order {expected_summaries}; found {summaries}')

if len(parser.youtube_iframes) != 1:
    raise SystemExit(f'Expected one YouTube iframe; found {len(parser.youtube_iframes)}')

youtube_iframe = parser.youtube_iframes[0]
expected_src = 'https://www.youtube-nocookie.com/embed/VriyhA6ayys'
if youtube_iframe.get('src') != expected_src:
    raise SystemExit(
        f'Expected privacy-enhanced YouTube source {expected_src}; '
        f"found {youtube_iframe.get('src')}"
    )
if youtube_iframe.get('loading') != 'lazy':
    raise SystemExit('Expected the YouTube iframe to load lazily.')
if not youtube_iframe.get('title', '').strip():
    raise SystemExit('Expected the YouTube iframe to have an accessible title.')
if 'allowfullscreen' not in youtube_iframe:
    raise SystemExit('Expected the YouTube iframe to support fullscreen playback.')
if 'autoplay' in youtube_iframe.get('src', '').lower():
    raise SystemExit('Expected the YouTube iframe source not to enable autoplay.')
if 'autoplay' in youtube_iframe.get('allow', '').lower():
    raise SystemExit('Expected the YouTube iframe permissions not to allow autoplay.')

nav_links = [
    (link['href'], ' '.join(link['text'].split()))
    for link in parser.nav_links
]
if ('#art-works', 'Art Works') not in nav_links:
    raise SystemExit('Expected an Art Works link in the primary navigation.')

if parser.scroll_disclosures != 2:
    raise SystemExit(
        f'Expected two scroll-controlled disclosures; found {parser.scroll_disclosures}'
    )

expected_artist_images = {
    'art/feridun/image00001.png',
    'art/feridun/image00010.png',
    'art/hümeyra/image00004.png',
    'art/hümeyra/image00008.png',
    'art/ırmak/image00002.png',
    'art/ırmak/image00003.PNG',
    'art/ırmak/image00005.PNG',
    'art/ırmak/image00006.PNG',
    'art/ırmak/image00007.PNG',
    'art/ırmak/image00009.PNG',
    'art/ırmak/image00011.PNG',
    'art/ırmak/image00012.PNG',
    'art/ırmak/image00013.PNG',
    'art/ırmak/image00014.PNG',
    'art/ırmak/image00015.PNG',
}
actual_artist_images = {image.get('src') for image in parser.artwork_images}
if actual_artist_images != expected_artist_images:
    missing = sorted(expected_artist_images - actual_artist_images)
    unexpected = sorted(actual_artist_images - expected_artist_images)
    raise SystemExit(
        f'Artist image mismatch. Missing: {missing}; unexpected: {unexpected}'
    )
if any(image.get('loading') != 'lazy' for image in parser.artwork_images):
    raise SystemExit('Expected every Spotify artwork image to load lazily.')
if any(not image.get('alt', '').strip() for image in parser.artwork_images):
    raise SystemExit('Expected every Spotify artwork image to have alternative text.')

if not parser.artist_gallery_classes:
    raise SystemExit('Expected Spotify artist galleries.')
if 'artworks__artist-gallery--large' not in parser.artist_gallery_classes[0]:
    raise SystemExit('Expected Irmak Akıncı to use the large overview gallery layout.')
if parser.artist_disclosures != 3:
    raise SystemExit(
        f'Expected three stable artist disclosures; found {parser.artist_disclosures}'
    )
if parser.hover_artist_disclosures:
    raise SystemExit(
        'Expected artist disclosures to open only by click; '
        f'found {parser.hover_artist_disclosures} with hover enabled'
    )

print('Art Works structure checks passed.')
