from html.parser import HTMLParser
from pathlib import Path


class AboutCvHeadings(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_about = False
        self.in_h3 = False
        self.headings = []
        self.element_ids = set()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("id"):
            self.element_ids.add(attributes["id"])
        if tag == "section" and attributes.get("id") == "about":
            self.in_about = True
        if self.in_about and tag == "h3":
            self.in_h3 = True
            self.headings.append("")

    def handle_endtag(self, tag):
        if self.in_about and tag == "h3":
            self.in_h3 = False
        if self.in_about and tag == "section":
            self.in_about = False

    def handle_data(self, data):
        if self.in_about and self.in_h3:
            self.headings[-1] += data


project_root = Path(__file__).resolve().parents[1]
parser = AboutCvHeadings()
parser.feed((project_root / "index.html").read_text(encoding="utf-8"))
headings = [heading.strip() for heading in parser.headings]
expected = ["Selected Exhibitions", "Art Projects", "Art Fairs"]

if headings != expected:
    raise SystemExit(f"Expected About CV headings {expected}; found {headings}")

required_ids = {"portrait-frame", "cv-exhibitions", "cv-projects", "cv-fairs"}
missing_ids = sorted(required_ids - parser.element_ids)
if missing_ids:
    raise SystemExit(f"Expected managed Biography/CV containers; missing {missing_ids}")

print("About CV order checks passed.")
