# Contact email delivery verification

- Verified at: `2026-09-24T20:16:56.8361892Z`
- Verified commit before this evidence file: `ff9e591087bf0c69e5f7af5dfb141e3555204bb4`
- Tested browser origin: `http://localhost:8000`

## Hosted database

- `supabase/05_contact_delivery.sql` applied successfully.
- `supabase/06_verify_contact_delivery.sql` completed with `contact email rate limit ready`.
- The verifier confirmed private table/function privileges and the five-allowed, sixth-denied threshold.

## Edge Function

- Function: `send-contact`
- Deployment ID: `819661fb-67e8-4f74-b909-b19f918e735b`
- Status: `ACTIVE`
- Version: `2`
- Deployment updated at: `2026-09-24 20:11:04 UTC`
- Allowed-origin preflight: HTTP `204`, exact origin echoed.
- Disallowed-origin preflight: HTTP `403`.
- Invalid body: HTTP `400`.
- Valid delivery request: HTTP `200` with `{ "ok": true }`.

## Delivery and browser behavior

- Resend accepted and delivered the development-recipient verification.
- Gmail receipt at the development recipient: yes.
- Reply target matched the visitor email submitted through the form: yes.
- The hosted recipient was then changed through `CONTACT_TO_EMAIL` only.
- Resend accepted and delivered the artist-recipient verification.
- Gmail receipt at the artist recipient: yes.
- Localhost form displayed sending and success states without opening a mail chooser or navigating away.
- Generic provider and HTTP `429` failure states are covered by automated browser tests; no live provider failure was induced after confirmed artist delivery.

## Final local verification

- Node suite: `56/56` passed.
- Art Works, Canvas, About/CV, Studio, contact form, and Edge Function structural checks passed.
- Manifesto, contact SQL contract, and media-migration recovery/inventory checks passed.
- Populated-secret scan found no tracked secret values.
- `supabase/functions/.env` and `supabase/.temp/project-ref` are ignored.
