from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
CONFIG = (ROOT / "supabase/config.toml").read_text(encoding="utf-8")
INDEX = (ROOT / "supabase/functions/send-contact/index.ts").read_text(encoding="utf-8")
HANDLER = (ROOT / "supabase/functions/send-contact/handler.mjs").read_text(encoding="utf-8")
LOGIC = (ROOT / "supabase/functions/send-contact/logic.mjs").read_text(encoding="utf-8")
GITIGNORE = (ROOT / ".gitignore").read_text(encoding="utf-8")


def require(condition, message):
    if not condition:
        raise AssertionError(message)


require(CONFIG.count("verify_jwt") == 1, "verify_jwt must be configured exactly once")
require(
    re.search(r"\[functions\.send-contact\]\s*verify_jwt\s*=\s*false", CONFIG) is not None,
    "send-contact must be the only function configured without JWT verification",
)

runtime = INDEX + HANDLER + LOGIC
for name in ("RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL", "CONTACT_IP_SALT"):
    require(name in runtime, f"runtime does not read {name}")

require("gmail.com" not in INDEX.lower(), "runtime must not contain a Gmail recipient")
require(re.search(r"\bre_[A-Za-z0-9_-]{8,}", INDEX) is None, "runtime contains a Resend-like API key")
require("createContactHandler" in INDEX, "runtime must import the shared handler")
require("validateContactBody" not in INDEX, "runtime must not duplicate validation")

for marker in (
    "https://api.resend.com/emails",
    "consume_contact_rate_limit",
    "reply_to",
    "typeof sent.id",
):
    require(marker in runtime, f"runtime contract missing {marker}")

ignored = {line.strip() for line in GITIGNORE.splitlines()}
require("supabase/.temp/" in ignored, "Supabase CLI state must be ignored")
require("supabase/functions/.env" in ignored, "local Edge Function secrets must be ignored")

print("Contact Edge Function structural checks passed.")
