from html.parser import HTMLParser
from pathlib import Path


class StudioStructure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = {}
        self.scripts = []
        self.buttons = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        element_id = attributes.get("id")
        if element_id:
            self.elements[element_id] = (tag, attributes)
        if tag == "script" and attributes.get("src"):
            self.scripts.append(attributes["src"])
        if tag == "button":
            self.buttons.append(attributes)


root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
site_js = (root / "js" / "site.js").read_text(encoding="utf-8")
parser = StudioStructure()
parser.feed(html)

for dialog_id, label_id in (("passgate", "studio-login-title"), ("passwordgate", "password-title")):
    if dialog_id not in parser.elements:
        raise SystemExit(f"Missing Studio dialog #{dialog_id}")
    _, attributes = parser.elements[dialog_id]
    if attributes.get("role") != "dialog" or attributes.get("aria-modal") != "true":
        raise SystemExit(f"#{dialog_id} must be an aria-modal dialog")
    if attributes.get("aria-labelledby") != label_id or label_id not in parser.elements:
        raise SystemExit(f"#{dialog_id} must reference heading #{label_id}")

required_inputs = {
    "studio-email": ("email", "username"),
    "studio-password": ("password", "current-password"),
    "password-nonce": ("text", "one-time-code"),
    "password-new": ("password", "new-password"),
    "password-confirm": ("password", "new-password"),
}
for element_id, (input_type, autocomplete) in required_inputs.items():
    if element_id not in parser.elements:
        raise SystemExit(f"Missing Studio input #{element_id}")
    tag, attributes = parser.elements[element_id]
    if tag != "input" or attributes.get("type") != input_type:
        raise SystemExit(f"#{element_id} must be a {input_type} input")
    if attributes.get("autocomplete") != autocomplete:
        raise SystemExit(f"#{element_id} must use autocomplete={autocomplete}")

required_controls = {"studio-forgot", "bar-manage", "bar-password", "bar-signout"}
missing_controls = sorted(required_controls - parser.elements.keys())
if missing_controls:
    raise SystemExit(f"Missing Studio controls: {missing_controls}")

for forbidden in ("bar-reset", "pass-input"):
    if forbidden in parser.elements:
        raise SystemExit(f"Legacy Studio control #{forbidden} must be removed")
if "PASSCODE" in site_js or "nb-studio-auth" in site_js:
    raise SystemExit("Client-side passcode/auth persistence must be removed")
for forbidden_source in ("nb-works-v1", "catalogueStamp", "localStorage"):
    if forbidden_source in site_js:
        raise SystemExit(f"Legacy local catalogue persistence remains: {forbidden_source}")
if "signUp" in html or "Sign up" in html:
    raise SystemExit("Studio must not expose public sign-up")

required_scripts = [
    "@supabase/supabase-js@2.117.0/dist/umd/supabase.min.js",
    "js/supabase-config.js?v=",
    "js/content-api.js?v=",
    "js/studio.js?v=",
    "js/site.js?v=",
]
positions = []
for fragment in required_scripts:
    matches = [index for index, source in enumerate(parser.scripts) if fragment in source]
    if len(matches) != 1:
        raise SystemExit(f"Expected one Studio script containing {fragment}; found {len(matches)}")
    positions.append(matches[0])
if positions != sorted(positions):
    raise SystemExit("Studio dependencies must load before studio.js and site.js")

print("Studio auth structure checks passed.")
