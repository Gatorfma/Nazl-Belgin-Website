from html.parser import HTMLParser
from pathlib import Path


class ContactParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.form_depth = 0
        self.inputs = []
        self.statuses = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "form" and attributes.get("id") == "contact-form":
            self.form_depth = 1
        elif self.form_depth and tag == "form":
            self.form_depth += 1
        if self.form_depth and tag == "input":
            self.inputs.append(attributes)
        if attributes.get("id") == "form-status":
            self.statuses.append(attributes)
        if tag == "script" and attributes.get("src"):
            self.scripts.append(attributes["src"].split("?", 1)[0])

    def handle_endtag(self, tag):
        if tag == "form" and self.form_depth:
            self.form_depth -= 1


root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
site_js = (root / "js" / "site.js").read_text(encoding="utf-8")
if "function onSubmit(e)" not in site_js or "/* ---------- boot" not in site_js:
    raise SystemExit("Contact submit function boundaries are missing")
submit_body = site_js.split("function onSubmit(e)", 1)[1].split("/* ---------- boot", 1)[0]
if "window.NBContact.submit" not in submit_body or "contentApi.sendContact" not in submit_body:
    raise SystemExit("Contact submit must use the Supabase contact client")
for forbidden in ("window.location", "mailto:", "FORM_ENDPOINT"):
    if forbidden in submit_body:
        raise SystemExit(f"Contact submit still contains forbidden mail-app behavior: {forbidden}")
if html.count('href="mailto:nazlibelgin@gmail.com"') != 1:
    raise SystemExit("The one visible direct-email link must remain")

parser = ContactParser()
parser.feed(html)
traps = [item for item in parser.inputs if item.get("name") == "website"]
if len(traps) != 1:
    raise SystemExit("Contact form must contain exactly one website honeypot")
if traps[0].get("tabindex") != "-1" or traps[0].get("autocomplete") != "off":
    raise SystemExit("Contact honeypot must be removed from keyboard and autocomplete navigation")
if parser.scripts.count("js/contact.js") != 1:
    raise SystemExit("js/contact.js must load exactly once")
try:
    api_index = parser.scripts.index("js/content-api.js")
    contact_index = parser.scripts.index("js/contact.js")
    site_index = parser.scripts.index("js/site.js")
except ValueError as error:
    raise SystemExit("Required contact scripts are missing") from error
if not api_index < contact_index < site_index:
    raise SystemExit("js/contact.js must load after content-api.js and before site.js")
if len(parser.statuses) != 1 or parser.statuses[0].get("role") != "status" \
        or parser.statuses[0].get("aria-live") != "polite":
    raise SystemExit("Contact status must remain a polite live status")

print("Contact form structural checks passed.")
