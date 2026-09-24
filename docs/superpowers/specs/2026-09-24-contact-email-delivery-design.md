# Contact Email Delivery Design

Date: 2026-09-24
Status: Approved — implementation planned

## Purpose

Replace the portfolio contact form's `mailto:` fallback with reliable server-side email delivery. During development, contact messages go to `furkanmertaksakal@gmail.com`. At launch, the recipient changes to `nazlibelgin@gmail.com` through a Supabase secret rather than a code change.

The form must work from localhost and from the production Nazlı Belgin domains. Submitting it must never open a mail application, navigate away, or claim success before the email provider accepts the message.

## Goals

- Send contact-form messages through Resend from a Supabase Edge Function.
- Send from `Nazlı Belgin Website <website@nazlibelgin.com>` after `nazlibelgin.com` is verified in Resend.
- Set the visitor's submitted address as `Reply-To`.
- Keep the Resend API key, destination address, sender address, and rate-limit salt outside browser code.
- Accept browser requests from localhost, `127.0.0.1`, `nazlibelgin.com`, and `www.nazlibelgin.com`.
- Show success only after Resend accepts the message.
- Protect the public endpoint with validation, a honeypot, origin checks, request-size limits, and a persistent per-IP rate limit.
- Store no contact-message content and no raw IP addresses in Postgres.
- Provide automated and live acceptance tests, including a confirmed Resend delivery event.

## Non-goals

- This flow does not replace or configure Supabase Auth recovery and password emails. Those continue to use Supabase Auth SMTP settings.
- The site will not expose the Resend API key or call Resend directly from browser JavaScript.
- The implementation will not promise Gmail inbox placement. It will verify provider acceptance and delivery status; SPF, DKIM, DMARC, and recipient filtering determine final placement.
- The form will not store enquiries in the database.

## Architecture

```text
Visitor contact form
        |
        | supabase.functions.invoke("send-contact")
        v
Supabase Edge Function
  - CORS/origin validation
  - field and size validation
  - honeypot check
  - hashed-IP rate-limit RPC
        |
        | Resend HTTPS API
        v
furkanmertaksakal@gmail.com (development)
nazlibelgin@gmail.com (launch, secret-only switch)
```

The browser invokes the Edge Function through the already configured Supabase client. The function is public because portfolio visitors are anonymous. It is deployed with JWT verification disabled, while its own validation and abuse controls enforce the public endpoint contract.

Supabase documents Edge Functions as the server-side integration point for transactional email, Resend as the email provider in its example, CORS handling for browser invocations, and project secrets for private credentials:

- https://supabase.com/docs/guides/functions/examples/send-emails
- https://supabase.com/docs/guides/functions/cors
- https://supabase.com/docs/guides/functions/secrets

## Components

### Browser client

The existing contact form remains visually unchanged except for an invisible honeypot field. Its submit handler will:

1. Prevent the normal browser submission.
2. Validate required fields and the email shape.
3. Disable the submit button and show `Sending…`.
4. Invoke `send-contact` with `{ name, email, message, website }` through the Supabase client adapter.
5. Reset the form and show success only when the function returns a successful response.
6. Restore the button and show an inline retry/direct-email message for any failure.

The existing code that assigns `window.location.href = "mailto:..."` will be removed. No submission path may open an email application. The visible Gmail link remains available as a manual alternative.

If Supabase is not configured, the form reports that online delivery is temporarily unavailable and points to the visible direct-email link; it does not launch that link automatically.

### `send-contact` Edge Function

The function accepts `POST` and `OPTIONS` only. It will:

- Return CORS preflight headers for an allowed origin.
- Require JSON and reject oversized or malformed bodies.
- Validate trimmed fields:
  - name: 1–100 characters
  - email: syntactically valid and at most 254 characters
  - message: 1–5,000 characters
  - website honeypot: must be empty
- Reject origins outside the allowlist.
- Hash the caller IP with `CONTACT_IP_SALT` before consuming a rate-limit attempt.
- Ask the database rate-limit RPC to allow at most five attempts per ten-minute window.
- Escape all visitor-controlled values used in HTML and strip CR/LF from the subject name.
- Send both text and minimal escaped HTML through the Resend HTTPS API.
- Use the visitor email as `reply_to` and the configured address as `to`.
- Return a small generic JSON response. Provider errors are logged server-side and are not exposed to visitors.

### Allowed origins

The function accepts:

- `http://localhost:<numeric-port>`
- `http://127.0.0.1:<numeric-port>`
- `https://nazlibelgin.com`
- `https://www.nazlibelgin.com`

For successful browser responses, `Access-Control-Allow-Origin` echoes the validated request origin rather than using `*`. Requests without an `Origin` header are rejected outside controlled automated tests. Origin validation is defense in depth, not authentication; the persistent rate limit remains necessary because non-browser clients can forge an Origin header.

### Persistent rate limit

An incremental SQL migration will create a private implementation surface in the public schema:

- `contact_rate_limits` stores only a SHA-256 IP hash, the active window start, and an attempt count.
- RLS is enabled and privileges are revoked from `anon` and `authenticated`.
- A `consume_contact_rate_limit(text)` function atomically starts, increments, or resets the window and returns whether the request is allowed.
- Execute permission is restricted to `service_role`.
- Old windows are removed opportunistically without retaining message content.

The Edge Function uses its server-side Supabase secret/service credential to call this RPC. Raw IP addresses and enquiry contents never reach the table.

## Secrets and configuration

Production Edge Function secrets:

- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL=furkanmertaksakal@gmail.com`
- `CONTACT_FROM_EMAIL=Nazlı Belgin Website <website@nazlibelgin.com>`
- `CONTACT_IP_SALT=<random high-entropy value>`

The project-provided Supabase URL and server credential remain server-side. No secret is added to `js/supabase-config.js`; that file contains only the browser-safe project URL and publishable key.

At launch, the recipient changes with one secret update:

```text
CONTACT_TO_EMAIL=nazlibelgin@gmail.com
```

Changing a Supabase Edge Function secret does not require changing website code.

## Email format

- From: `Nazlı Belgin Website <website@nazlibelgin.com>`
- To: value of `CONTACT_TO_EMAIL`
- Reply-To: visitor email
- Subject: `Studio enquiry — <sanitized visitor name>`
- Body: visitor name, visitor email, and message in text and escaped HTML forms

Resend domain verification must publish its SPF and DKIM records for `nazlibelgin.com`. DMARC is recommended before production launch.

## Error handling and user feedback

The client distinguishes only actionable categories:

- Local validation: explain which field needs attention.
- Sending: disable duplicate submission and show progress.
- Success: show receipt confirmation and reset the form.
- Rate limit: ask the visitor to wait before retrying.
- Configuration/network/provider failure: say the note did not send and point to the visible email address.

The function logs configuration and provider failures with a request identifier. It never returns API keys, provider payloads, IP hashes, stack traces, or raw message content in error responses.

## Repository changes

Expected implementation surface:

- `supabase/functions/send-contact/index.ts`
- shared/testable Edge Function validation and email-payload helpers
- a Supabase function configuration entry for public invocation
- `supabase/05_contact_delivery.sql`
- `supabase/06_verify_contact_delivery.sql`
- browser adapter and contact submit-handler updates
- contact-form honeypot markup and minimal accessibility styling
- Node/Deno/PowerShell or SQL contract tests appropriate to each layer
- README setup, deployment, testing, and recipient-switch instructions

Existing unrelated user changes in the dirty worktree must be preserved and staged selectively.

## Testing

### Automated

- Client rejects invalid fields without invoking the function.
- Client invokes the function with the expected body.
- Client shows success only for a confirmed successful response.
- Client shows an inline failure and never assigns a `mailto:` URL.
- Function accepts all approved localhost and production origins and rejects others.
- Function rejects non-POST methods, invalid JSON, oversized fields, malformed email, and a filled honeypot.
- Function escapes HTML and prevents subject/header injection.
- Function maps rate-limit and Resend errors to safe status codes/messages.
- Rate-limit SQL grants no anonymous/authenticated access and allows only the configured threshold atomically.
- Existing portfolio and Studio suites remain green.

### Live acceptance

1. Verify `nazlibelgin.com` in Resend and confirm SPF/DKIM status.
2. Set all Edge Function secrets without placing them in Git or chat.
3. Apply `05_contact_delivery.sql` and `06_verify_contact_delivery.sql`.
4. Deploy `send-contact` as the public contact endpoint.
5. Submit from a localhost origin and confirm no mail application opens.
6. Confirm the browser reports success only after an HTTP success response.
7. Confirm the Resend dashboard records acceptance and delivery.
8. Confirm receipt at `furkanmertaksakal@gmail.com`, checking Spam once during setup.
9. Exercise invalid, honeypot, disallowed-origin, provider-error, and rate-limit paths.
10. Before launch, update `CONTACT_TO_EMAIL` to `nazlibelgin@gmail.com` and repeat delivery verification.

## Acceptance criteria

- Clicking `Send a note` never opens a mail chooser.
- A valid localhost submission reaches the Edge Function and is accepted by Resend.
- Development messages are delivered to `furkanmertaksakal@gmail.com`.
- The UI never reports success for a failed request.
- Resend credentials and recipient configuration do not appear in browser-delivered files or Git.
- Public abuse controls are active without storing enquiry content or raw IPs.
- Switching the recipient to Nazlı requires only a Supabase secret update.
