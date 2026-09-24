# Contact Email Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the contact form's mail-app popup with a tested Supabase Edge Function that delivers enquiries through Resend to a secret-configured recipient from localhost and the production domains.

**Architecture:** The browser validates through a small UMD contact module and invokes `send-contact` through the existing Supabase adapter. A Node-testable Web `Request`/`Response` handler enforces CORS, validation, honeypot, and rate limiting; a thin Deno entry point wires Supabase and Resend. Postgres stores only salted IP hashes for an atomic five-per-ten-minute rate limit, while all email settings remain Edge Function secrets.

**Tech Stack:** Plain ES2018 browser JavaScript, Node.js 24 test runner, Supabase JavaScript client 2.117.0, Supabase Edge Functions/Deno, PostgreSQL/PLpgSQL, Resend HTTPS API, PowerShell/Python structural verification.

**Spec:** `docs/superpowers/specs/2026-09-24-contact-email-delivery-design.md`

## Global Constraints

- `Send a note` must never assign a `mailto:` URL, navigate away, or open a mail application.
- Accept `http://localhost:<numeric-port>`, `http://127.0.0.1:<numeric-port>`, `https://nazlibelgin.com`, and `https://www.nazlibelgin.com`; echo only a validated origin in CORS responses.
- Send from `Nazlı Belgin Website <website@nazlibelgin.com>` and use the visitor email as `Reply-To`.
- Development recipient is `furkanmertaksakal@gmail.com`; launch recipient is changed to `nazlibelgin@gmail.com` only through `CONTACT_TO_EMAIL`.
- Never place `RESEND_API_KEY`, server credentials, destination secrets, or `CONTACT_IP_SALT` in browser files, Git, logs, or chat.
- Store neither enquiry content nor raw IP addresses in Postgres.
- Allow at most five attempts for one salted IP hash in a ten-minute window, atomically.
- Report success only after Resend returns an accepted email identifier; provider acceptance is not a promise of Gmail inbox placement.
- Preserve the existing dirty worktree. Never stage `js/supabase-config.js`, `supabase/03_authorize_artist.sql`, or `supabase/.temp/`; stage overlapping `index.html`, `css/site.css`, and `README.md` hunks selectively.
- The visible `mailto:nazlibelgin@gmail.com` contact link remains as a manual alternative.

## Review Focus

- Names containing Unicode plus CR/LF must preserve readable Unicode while stripping subject/header injection; Task 2 pins this in `send-contact-logic.test.mjs`.
- Origins such as `http://localhost.evil.test:8000`, `https://evilnazlibelgin.com`, missing ports on development origins, and non-HTTPS production origins must be rejected; Task 2 pins the exact allowlist.
- Arrays, `null`, invalid JSON, excessive `Content-Length`, and fields over their limits must return safe 4xx responses without calling rate-limit or email dependencies; Task 3 pins the request boundary.
- Six rapid sequential attempts in one window must allow exactly five, while row locking and a new window preserve the boundary under contention; Task 1's hosted verifier exercises the threshold and Task 3 checks handler mapping.
- Resend HTTP success without an email `id`, non-2xx responses, and thrown network failures must never produce browser success; Tasks 3–5 pin provider and UI behavior.

---

### Task 1: Add the private atomic contact rate limit

**Files:**
- Create: `supabase/05_contact_delivery.sql`
- Create: `supabase/06_verify_contact_delivery.sql`
- Create: `tools/contact-sql.test.ps1`

**Interfaces:**
- Consumes: Supabase roles `anon`, `authenticated`, and `service_role` created by the hosted project.
- Produces: `public.consume_contact_rate_limit(client_hash text) returns boolean`; the Edge Function calls it once per validated submission.

- [ ] **Step 1: Write the failing SQL contract test**

Create `tools/contact-sql.test.ps1` with literal contract checks before either SQL file exists:

```powershell
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationPath = Join-Path $root 'supabase/05_contact_delivery.sql'
$verifyPath = Join-Path $root 'supabase/06_verify_contact_delivery.sql'
if (-not (Test-Path -LiteralPath $migrationPath)) { throw 'Missing contact delivery migration.' }
if (-not (Test-Path -LiteralPath $verifyPath)) { throw 'Missing contact delivery verifier.' }
$migration = Get-Content -LiteralPath $migrationPath -Raw -Encoding UTF8
$verify = Get-Content -LiteralPath $verifyPath -Raw -Encoding UTF8
foreach ($fragment in @(
  'create table if not exists public.contact_rate_limits',
  'enable row level security',
  'create or replace function public.consume_contact_rate_limit',
  'pg_advisory_xact_lock',
  "interval '10 minutes'",
  'attempt_count + 1',
  'revoke all on table public.contact_rate_limits from anon, authenticated',
  'revoke all on function public.consume_contact_rate_limit(text) from public, anon, authenticated',
  'grant execute on function public.consume_contact_rate_limit(text) to service_role'
)) {
  if ($migration -notmatch [regex]::Escape($fragment)) { throw "Missing SQL contract: $fragment" }
}
foreach ($fragment in @('has_table_privilege', 'has_function_privilege', 'Expected rate-limit call 6 to be rejected')) {
  if ($verify -notmatch [regex]::Escape($fragment)) { throw "Missing verification contract: $fragment" }
}
Write-Output 'Contact rate-limit SQL contract checks passed.'
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/contact-sql.test.ps1
```

Expected: FAIL with `Missing contact delivery migration.`

- [ ] **Step 3: Implement the atomic rate-limit migration**

Create `supabase/05_contact_delivery.sql` with this structure and exact access boundary:

```sql
create table if not exists public.contact_rate_limits (
  client_hash text primary key check (length(client_hash) = 64),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0)
);

alter table public.contact_rate_limits enable row level security;
revoke all on table public.contact_rate_limits from public, anon, authenticated;

create or replace function public.consume_contact_rate_limit(client_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_time timestamptz := clock_timestamp();
  allowed boolean;
begin
  if client_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid contact client hash' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(client_hash, 0));
  delete from public.contact_rate_limits
  where window_started_at < current_time - interval '1 day';

  insert into public.contact_rate_limits as limits
    (client_hash, window_started_at, attempt_count)
  values (client_hash, current_time, 1)
  on conflict (client_hash) do update set
    window_started_at = case
      when limits.window_started_at <= current_time - interval '10 minutes' then current_time
      else limits.window_started_at
    end,
    attempt_count = case
      when limits.window_started_at <= current_time - interval '10 minutes' then 1
      else limits.attempt_count + 1
    end
  returning attempt_count <= 5 into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_contact_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_contact_rate_limit(text) to service_role;
```

Create `supabase/06_verify_contact_delivery.sql` with deterministic privilege and threshold checks:

```sql
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.contact_rate_limits'::regclass) then
    raise exception 'RLS is disabled on contact_rate_limits';
  end if;
  if has_table_privilege('anon', 'public.contact_rate_limits', 'select')
     or has_table_privilege('authenticated', 'public.contact_rate_limits', 'select') then
    raise exception 'Browser roles can read contact rate limits';
  end if;
  if has_function_privilege('anon', 'public.consume_contact_rate_limit(text)', 'execute')
     or has_function_privilege('authenticated', 'public.consume_contact_rate_limit(text)', 'execute') then
    raise exception 'Browser roles can execute the contact rate limit';
  end if;
  if not has_function_privilege('service_role', 'public.consume_contact_rate_limit(text)', 'execute') then
    raise exception 'service_role cannot execute the contact rate limit';
  end if;
end $$;

do $$
declare
  test_hash text := repeat('a', 64);
  call_number integer;
  allowed boolean;
begin
  delete from public.contact_rate_limits where client_hash = test_hash;
  for call_number in 1..6 loop
    allowed := public.consume_contact_rate_limit(test_hash);
    if allowed is distinct from (call_number <= 5) then
      raise exception 'Expected rate-limit call % to be %', call_number,
        case when call_number <= 5 then 'allowed' else 'rejected' end;
    end if;
  end loop;
  delete from public.contact_rate_limits where client_hash = test_hash;
end $$;

select 'contact email rate limit ready' as verification;
```

- [ ] **Step 4: Run local contract and hosted verification**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/contact-sql.test.ps1
```

Expected: `Contact rate-limit SQL contract checks passed.`

Then run `supabase/05_contact_delivery.sql` followed by `supabase/06_verify_contact_delivery.sql` in the linked project's SQL Editor. Expected: no exception and a final verification row identifying the contact rate limit as ready.

- [ ] **Step 5: Commit the rate-limit boundary**

```powershell
git add -- supabase/05_contact_delivery.sql supabase/06_verify_contact_delivery.sql tools/contact-sql.test.ps1
git diff --cached --check
git commit -m "feat: rate limit public contact submissions"
```

### Task 2: Build testable contact validation and email payload logic

**Files:**
- Create: `supabase/functions/send-contact/logic.mjs`
- Create: `tools/send-contact-logic.test.mjs`

**Interfaces:**
- Consumes: raw `Origin` string and untrusted parsed JSON.
- Produces: `isAllowedOrigin(origin): boolean`, `validateContactBody(body): { ok, value?, status, code }`, `buildEmail(value, from, to): ResendPayload`.

- [ ] **Step 1: Write failing pure-logic tests**

Create `tools/send-contact-logic.test.mjs` and import the three functions. Include table-driven assertions for:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmail, isAllowedOrigin, validateContactBody } from '../supabase/functions/send-contact/logic.mjs';

test('allows exact production and numeric-port localhost origins only', () => {
  for (const origin of [
    'http://localhost:8000', 'http://localhost:5500',
    'http://127.0.0.1:8080', 'https://nazlibelgin.com', 'https://www.nazlibelgin.com'
  ]) assert.equal(isAllowedOrigin(origin), true, origin);
  for (const origin of [
    '', 'http://localhost', 'https://localhost:8000', 'http://localhost.evil.test:8000',
    'http://nazlibelgin.com', 'https://evilnazlibelgin.com'
  ]) assert.equal(isAllowedOrigin(origin), false, origin);
});

test('normalizes valid input and rejects non-objects, honeypots and length overflow', () => {
  assert.equal(validateContactBody(null).ok, false);
  assert.equal(validateContactBody([]).ok, false);
  assert.equal(validateContactBody({ name: 'A', email: 'bad', message: 'Hi', website: '' }).code, 'invalid_email');
  assert.equal(validateContactBody({ name: 'A', email: 'a@b.co', message: 'Hi', website: 'bot' }).code, 'spam');
  assert.equal(validateContactBody({ name: 'x'.repeat(101), email: 'a@b.co', message: 'Hi', website: '' }).ok, false);
  assert.equal(validateContactBody({ name: ' A ', email: 'a@b.co', message: ' Hi ', website: '' }).value.name, 'A');
});

test('builds escaped email without subject injection and preserves Unicode', () => {
  const email = buildEmail(
    { name: 'Furkan\r\nBcc: bad@example.com — ğ', email: 'furkan@example.com', message: '<hello> & goodbye' },
    'Nazlı Belgin Website <website@nazlibelgin.com>', 'furkanmertaksakal@gmail.com'
  );
  assert.equal(email.reply_to, 'furkan@example.com');
  assert.doesNotMatch(email.subject, /\r|\n|Bcc:/);
  assert.match(email.subject, /ğ/);
  assert.match(email.html, /&lt;hello&gt; &amp; goodbye/);
  assert.doesNotMatch(email.html, /<hello>/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
node --test tools/send-contact-logic.test.mjs
```

Expected: FAIL because `logic.mjs` does not exist.

- [ ] **Step 3: Implement the pure logic module**

Create `logic.mjs` with no Deno globals or network imports:

```js
const PRODUCTION_ORIGINS = new Set(['https://nazlibelgin.com', 'https://www.nazlibelgin.com']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAllowedOrigin(origin) {
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.origin === origin && url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && /^\d+$/.test(url.port);
  } catch { return false; }
}

export function validateContactBody(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    return { ok: false, status: 400, code: 'invalid_body' };
  }
  for (const key of ['name', 'email', 'message', 'website']) {
    if (typeof body[key] !== 'string') return { ok: false, status: 400, code: 'invalid_body' };
  }
  const value = {
    name: body.name.trim(), email: body.email.trim(),
    message: body.message.trim(), website: body.website.trim()
  };
  if (value.website) return { ok: false, status: 400, code: 'spam' };
  if (!value.name || !value.email || !value.message) return { ok: false, status: 400, code: 'required' };
  if (value.name.length > 100 || value.email.length > 254 || value.message.length > 5000) {
    return { ok: false, status: 400, code: 'too_long' };
  }
  if (!EMAIL.test(value.email)) return { ok: false, status: 400, code: 'invalid_email' };
  return { ok: true, status: 200, code: 'valid', value };
}

const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function buildEmail(value, from, to) {
  const safeSubjectName = value.name.replace(/[\r\n:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const escapedName = escapeHtml(value.name);
  const escapedEmail = escapeHtml(value.email);
  const escapedMessage = escapeHtml(value.message);
  return {
    from, to: [to], reply_to: value.email,
    subject: `Studio enquiry — ${safeSubjectName}`,
    text: `Name: ${value.name}\nEmail: ${value.email}\n\n${value.message}`,
    html: `<p><strong>Name:</strong> ${escapedName}</p>` +
      `<p><strong>Email:</strong> ${escapedEmail}</p>` +
      `<p>${escapedMessage.replace(/\n/g, '<br>')}</p>`
  };
}
```

- [ ] **Step 4: Run the focused and full Node suites**

```powershell
node --test tools/send-contact-logic.test.mjs
node --test tools/*.test.js tools/*.test.mjs
```

Expected: focused tests pass and the existing suite remains green.

- [ ] **Step 5: Commit the pure boundary**

```powershell
git add -- supabase/functions/send-contact/logic.mjs tools/send-contact-logic.test.mjs
git diff --cached --check
git commit -m "feat: validate contact email submissions"
```

### Task 3: Implement the Edge Function handler and runtime adapters

**Files:**
- Create: `supabase/functions/send-contact/handler.mjs`
- Create: `supabase/functions/send-contact/index.ts`
- Create: `supabase/config.toml`
- Create: `tools/send-contact-handler.test.mjs`
- Create: `tools/verify-contact-function.py`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1 RPC `consume_contact_rate_limit(text)` and Task 2 helpers.
- Produces: `createContactHandler(deps): (request: Request) => Promise<Response>` and deployed function `send-contact`.

- [ ] **Step 1: Write failing handler tests with injected dependencies**

Create `tools/send-contact-handler.test.mjs`. Build a helper that supplies `env`, `clientIp`, `hashIp`, `consumeRateLimit`, `sendEmail`, and `log`, then test:

```js
const validBody = { name: 'Furkan', email: 'furkan@example.com', message: 'Hello', website: '' };
const request = (body = validBody, init = {}) => new Request('https://project.supabase.co/functions/v1/send-contact', {
  method: init.method || 'POST',
  headers: {
    Origin: init.origin || 'http://localhost:8000',
    'Content-Type': init.contentType || 'application/json',
    ...(init.headers || {})
  },
  body: init.method === 'OPTIONS' ? undefined : (init.rawBody ?? JSON.stringify(body))
});
```

Required cases:

- allowed `OPTIONS` returns 204 and echoes the origin;
- disallowed origin returns 403;
- `GET` returns 405;
- invalid JSON, `null`, arrays, honeypot, and excessive `Content-Length` return 4xx before dependency calls;
- missing configuration returns 503 without logging secret values;
- denied rate limit returns 429 without calling Resend;
- Resend throw, non-2xx, and 2xx without `id` return 502;
- `{ id: 'email-id' }` returns 200 `{ ok: true }`;
- response CORS headers appear on every allowed-origin error;
- five allowed attempts and a denied sixth map correctly when the fake limiter changes state.

- [ ] **Step 2: Run the handler tests to verify they fail**

```powershell
node --test tools/send-contact-handler.test.mjs
```

Expected: FAIL because `handler.mjs` does not exist.

- [ ] **Step 3: Implement the dependency-injected Web handler**

Create `handler.mjs` and export `createContactHandler`:

```js
import { buildEmail, isAllowedOrigin, validateContactBody } from './logic.mjs';

const REQUIRED_ENV = ['RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'CONTACT_FROM_EMAIL', 'CONTACT_IP_SALT'];
const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
});
const json = (body, status, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...extra, 'Content-Type': 'application/json' }
});

export function createContactHandler(deps) {
  return async function handle(request) {
    const origin = request.headers.get('origin') || '';
    if (!isAllowedOrigin(origin)) return json({ ok: false, code: 'origin' }, 403);
    const headers = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ ok: false, code: 'method' }, 405, headers);
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
      return json({ ok: false, code: 'content_type' }, 415, headers);
    }
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > 16384) return json({ ok: false, code: 'too_large' }, 413, headers);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16384) {
      return json({ ok: false, code: 'too_large' }, 413, headers);
    }
    let body;
    try { body = JSON.parse(raw); } catch { return json({ ok: false, code: 'invalid_json' }, 400, headers); }
    const checked = validateContactBody(body);
    if (!checked.ok) return json({ ok: false, code: checked.code }, checked.status, headers);
    if (REQUIRED_ENV.some((name) => !deps.env(name))) {
      return json({ ok: false, code: 'unavailable' }, 503, headers);
    }
    const ip = deps.clientIp(request);
    if (!ip) return json({ ok: false, code: 'unavailable' }, 503, headers);
    const clientHash = await deps.hashIp(`${deps.env('CONTACT_IP_SALT')}:${ip}`);
    try {
      if (!await deps.consumeRateLimit(clientHash)) {
        return json({ ok: false, code: 'rate_limited' }, 429, headers);
      }
      const payload = buildEmail(checked.value, deps.env('CONTACT_FROM_EMAIL'), deps.env('CONTACT_TO_EMAIL'));
      const sent = await deps.sendEmail(payload);
      if (!sent || typeof sent.id !== 'string' || !sent.id) throw new Error('Resend did not return an id');
      return json({ ok: true }, 200, headers);
    } catch (error) {
      const requestId = crypto.randomUUID();
      deps.log('contact send failed', { requestId, name: error && error.name ? error.name : 'Error' });
      return json({ ok: false, code: 'delivery_failed', requestId }, 502, headers);
    }
  };
}
```

Use `Content-Type: application/json`, `Vary: Origin`, allowed methods `POST, OPTIONS`, and allowed headers `authorization, x-client-info, apikey, content-type`.

- [ ] **Step 4: Wire the thin Deno entry point and public function config**

Create `index.ts` as the thin runtime adapter:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2.117.0';
import { createContactHandler } from './handler.mjs';

const env = (name: string) => Deno.env.get(name) || '';
const serverKey = () => {
  const current = env('SUPABASE_SECRET_KEYS');
  if (current) {
    try {
      const parsed = JSON.parse(current);
      if (parsed.default) return parsed.default;
    } catch {}
  }
  return env('SUPABASE_SERVICE_ROLE_KEY');
};
const hashIp = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
const clientIp = (request: Request) =>
  (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
  request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '';
const consumeRateLimit = async (clientHash: string) => {
  const client = createClient(env('SUPABASE_URL'), serverKey(), { auth: { persistSession: false } });
  const { data, error } = await client.rpc('consume_contact_rate_limit', { client_hash: clientHash });
  if (error) throw error;
  return data === true;
};
const sendEmail = async (payload: object) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Resend rejected the email');
  return data;
};

Deno.serve(createContactHandler({
  env, hashIp, clientIp, consumeRateLimit, sendEmail,
  log: (message: string, details: object) => console.error(message, details)
}));
```

Create `supabase/config.toml`:

```toml
project_id = "nazl-belgin-website"

[functions.send-contact]
verify_jwt = false
```

Append these exact ignore entries to `.gitignore`:

```gitignore
supabase/.temp/
supabase/functions/.env
```

- [ ] **Step 5: Add a runtime structural verifier**

Create `tools/verify-contact-function.py` to assert:

- config sets `verify_jwt = false` only for `send-contact`;
- `index.ts` reads all four custom secret names and never contains actual Gmail recipients or a `re_` API key;
- runtime imports `createContactHandler` rather than duplicating validation;
- the combined `index.ts` and `logic.mjs` sources contain the Resend URL, rate-limit RPC, `reply_to`, and response-id checks;
- `.gitignore` excludes both local secrets and `supabase/.temp/`.

- [ ] **Step 6: Run focused and aggregate verification**

```powershell
node --test tools/send-contact-handler.test.mjs tools/send-contact-logic.test.mjs
python tools/verify-contact-function.py
node --test tools/*.test.js tools/*.test.mjs
```

Expected: all tests and structural checks pass. Do not deploy yet.

- [ ] **Step 7: Commit the Edge Function**

```powershell
git add -- .gitignore supabase/config.toml supabase/functions/send-contact/handler.mjs supabase/functions/send-contact/index.ts tools/send-contact-handler.test.mjs tools/verify-contact-function.py
git diff --cached --check
git commit -m "feat: send contact email through Resend"
```

### Task 4: Add the browser contact client and Supabase adapter method

**Files:**
- Create: `js/contact.js`
- Create: `tools/contact.test.js`
- Modify: `js/content-api.js`
- Modify: `tools/content-api.test.js`

**Interfaces:**
- Consumes: Supabase client method `client.functions.invoke('send-contact', { body })`.
- Produces: `contentApi.sendContact(payload): Promise<object>` and `NBContact.validate(fields)`, `NBContact.submit(sendContact, fields)`.

- [ ] **Step 1: Write failing adapter and contact-client tests**

Extend the fake Supabase client with a captured `functions.invoke` implementation. Add tests asserting:

```js
test('invokes the contact Edge Function with the submitted fields', async function () {
  var calls = [];
  var api = apiModule.create(config, fakeSupabase({}, {
    invoke: async function (name, options) {
      calls.push({ name: name, body: options.body });
      return { data: { ok: true }, error: null };
    }
  }));
  assert.deepEqual(await api.sendContact({ name: 'A', email: 'a@b.co', message: 'Hi', website: '' }), { ok: true });
  assert.deepEqual(calls, [{ name: 'send-contact', body: { name: 'A', email: 'a@b.co', message: 'Hi', website: '' } }]);
});
```

Create `tools/contact.test.js` for empty fields, malformed email, lengths, honeypot propagation, successful submission, generic send failure, and a 429/rate-limit failure. Assert invalid local input never calls `sendContact`.

- [ ] **Step 2: Run tests to verify they fail**

```powershell
node --test tools/content-api.test.js tools/contact.test.js
```

Expected: FAIL because `sendContact` and `js/contact.js` do not exist.

- [ ] **Step 3: Add `contentApi.sendContact`**

In `js/content-api.js`:

- expose `sendContact` on the unconfigured adapter as the existing rejecting function;
- call `unwrap(client.functions.invoke('send-contact', { body: payload }))` on the configured adapter;
- preserve a function error's HTTP status when available from `error.context.status` so the contact module can identify 429 without exposing provider details:

```js
function asError(error) {
  var converted = error instanceof Error
    ? error
    : new Error(error && error.message ? error.message : 'Supabase request failed.');
  if (error && error.context && error.context.status) converted.status = error.context.status;
  return converted;
}

// On the configured adapter:
sendContact: function (payload) {
  return unwrap(client.functions.invoke('send-contact', { body: payload }));
}
```

- [ ] **Step 4: Implement the UMD contact module**

Create `js/contact.js` using the repository's existing browser/CommonJS wrapper pattern around this complete factory body:

```js
function validate(fields) {
  fields = fields || {};
  var value = {
    name: typeof fields.name === 'string' ? fields.name.trim() : '',
    email: typeof fields.email === 'string' ? fields.email.trim() : '',
    message: typeof fields.message === 'string' ? fields.message.trim() : '',
    website: typeof fields.website === 'string' ? fields.website.trim() : ''
  };
  if (!value.name || !value.email || !value.message) {
    return { ok: false, message: 'Name, email and a message, please.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.email.length > 254) {
    return { ok: false, message: 'That email does not look right.' };
  }
  if (value.name.length > 100 || value.message.length > 5000) {
    return { ok: false, message: 'Please shorten the name or message before sending.' };
  }
  return { ok: true, value: value };
}

function submit(sendContact, fields) {
  var checked = validate(fields);
  if (!checked.ok) return Promise.resolve(checked);
  return Promise.resolve(sendContact(checked.value)).then(function () {
    return { ok: true, message: 'Received. A reply comes when the paint allows.' };
  }).catch(function (error) {
    if (error && error.status === 429) {
      return { ok: false, message: 'Too many notes were sent recently. Please wait ten minutes and try again.' };
    }
    return { ok: false, message: 'That did not send. Please try again or use the email link beside the form.' };
  });
}

return { validate: validate, submit: submit };
```

The honeypot is deliberately passed through to the Edge Function instead of producing browser-only success. Do not include recipient addresses, Resend details, or a `mailto:` navigation path.

- [ ] **Step 5: Run focused and full Node tests**

```powershell
node --test tools/content-api.test.js tools/contact.test.js
node --test tools/*.test.js tools/*.test.mjs
```

Expected: all pass.

- [ ] **Step 6: Commit the browser delivery boundary**

```powershell
git add -- js/contact.js js/content-api.js tools/contact.test.js tools/content-api.test.js
git diff --cached --check
git commit -m "feat: invoke contact email function"
```

### Task 5: Replace mail-app submission with inline website delivery

**Files:**
- Modify: `index.html:265-280, 369-374`
- Modify: `css/site.css:927-961`
- Modify: `js/site.js:17-20, 1288-1338`
- Create: `tools/verify-contact.py`

**Interfaces:**
- Consumes: Task 4 `NBContact.submit(contentApi.sendContact, fields)`.
- Produces: accessible contact form behavior with no automatic `mailto:` navigation.

- [ ] **Step 1: Write the failing structural verifier**

Create `tools/verify-contact.py`. Reuse `HTMLParser` and implement these exact source checks after parsing input attributes and script sources:

```python
root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
site_js = (root / "js" / "site.js").read_text(encoding="utf-8")
submit_body = site_js.split("function onSubmit(e)", 1)[1].split("/* ---------- boot", 1)[0]
if "window.NBContact.submit" not in submit_body or "contentApi.sendContact" not in submit_body:
    raise SystemExit("Contact submit must use the Supabase contact client")
for forbidden in ("window.location", "mailto:", "FORM_ENDPOINT"):
    if forbidden in submit_body:
        raise SystemExit(f"Contact submit still contains forbidden mail-app behavior: {forbidden}")
if html.count('href="mailto:nazlibelgin@gmail.com"') != 1:
    raise SystemExit("The one visible direct-email link must remain")
```

Extend the parser to collect inputs, forms, status elements, and scripts, then assert:

- the form has one honeypot input named `website` with `tabindex="-1"` and `autocomplete="off"`;
- `js/contact.js` loads exactly once after `js/content-api.js` and before `js/site.js`;
- the `onSubmit` function body contains `NBContact.submit` and `contentApi.sendContact`;
- that function body contains neither `window.location`, `mailto:`, nor `FORM_ENDPOINT`;
- the visible `mailto:nazlibelgin@gmail.com` link remains exactly once;
- the status element retains `role="status"` and `aria-live="polite"`.

- [ ] **Step 2: Run the verifier to prove the mail-app behavior still exists**

```powershell
python tools/verify-contact.py
```

Expected: FAIL because the honeypot/contact script are absent and `onSubmit` still assigns `window.location.href`.

- [ ] **Step 3: Add the honeypot and contact script**

Inside `#contact-form`, add before the submit button:

```html
<label class="form__trap" aria-hidden="true">
  <span>Website</span>
  <input type="text" name="website" tabindex="-1" autocomplete="off">
</label>
```

Load `js/contact.js` after `js/content-api.js` and before `js/studio.js`/`js/site.js`. Add:

```css
.form__trap {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
```

Do not use `display:none`; `tabindex="-1"` and `aria-hidden="true"` keep the trap out of keyboard and accessibility navigation.

- [ ] **Step 4: Replace `onSubmit` without a mailto fallback**

Remove both `FORM_ENDPOINT` and the now-unused JavaScript `CONTACT_EMAIL` constant; the one manual address remains in HTML. Replace the sending branch with:

```js
var fields = {
  name: form.elements.name.value,
  email: form.elements.email.value,
  message: form.elements.message.value,
  website: form.elements.website.value
};
btn.disabled = true;
btn.textContent = 'Sending…';
status.textContent = 'Sending…';
window.NBContact.submit(contentApi.sendContact, fields).then(function (outcome) {
  status.textContent = outcome.message;
  btn.textContent = outcome.ok ? 'Sent — thank you' : 'Send';
  if (outcome.ok) form.reset();
  btn.disabled = false;
});
```

For a local validation result, `NBContact.submit` resolves without a network call; the same UI path restores the button. There must be no `window.location.href`, dynamic `mailto:`, or false success path.

- [ ] **Step 5: Run focused structural and browser-unit tests**

```powershell
python tools/verify-contact.py
node --test tools/contact.test.js tools/content-api.test.js
python tools/verify-studio.py
```

Expected: all pass; the static verifier confirms the mail chooser cannot be launched by submission.

- [ ] **Step 6: Stage only contact hunks and commit**

Inspect `git diff -- index.html css/site.css js/site.js tools/verify-contact.py`. Stage `js/site.js` and the new verifier normally; use selective hunk staging for the dirty HTML/CSS so existing unrelated work is not absorbed. Confirm `git diff --cached --name-only` excludes `js/supabase-config.js` and `supabase/03_authorize_artist.sql`.

```powershell
git add -- js/site.js tools/verify-contact.py
git add -p -- index.html css/site.css
git diff --cached --check
git commit -m "feat: submit contact form without mail app"
```

### Task 6: Document and script deployment without exposing secrets

**Files:**
- Create: `supabase/functions/.env.example`
- Create: `tools/verify-contact-live.ps1`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-24-contact-email-delivery-design.md`

**Interfaces:**
- Consumes: deployed Task 3 function plus Task 1 SQL.
- Produces: reproducible secret setup, deploy, smoke-test, and recipient-switch workflow.

- [ ] **Step 1: Write a live verifier that is safe by default**

Create `tools/verify-contact-live.ps1` with required `ProjectUrl` and `PublishableKey`, optional `Origin` defaulting to `http://localhost:8000`, and a `-Send` switch. Use this probe helper so Windows PowerShell exposes expected 4xx statuses instead of aborting:

```powershell
param(
  [Parameter(Mandatory=$true)][string]$ProjectUrl,
  [Parameter(Mandatory=$true)][string]$PublishableKey,
  [string]$Origin = 'http://localhost:8000',
  [switch]$Send
)
$ErrorActionPreference = 'Stop'
$uri = $ProjectUrl.TrimEnd('/') + '/functions/v1/send-contact'

function Invoke-Probe([string]$Method, [string]$ProbeOrigin, [string]$Body = '') {
  $arguments = @{
    Method = $Method; Uri = $uri; UseBasicParsing = $true
    Headers = @{ apikey = $PublishableKey; Origin = $ProbeOrigin }
  }
  if ($Body) { $arguments.Body = $Body; $arguments.ContentType = 'application/json' }
  try {
    $response = Invoke-WebRequest @arguments
    return [pscustomobject]@{ Status = [int]$response.StatusCode; Headers = $response.Headers; Body = $response.Content }
  } catch {
    if (-not $_.Exception.Response) { throw }
    return [pscustomobject]@{
      Status = [int]$_.Exception.Response.StatusCode
      Headers = $_.Exception.Response.Headers
      Body = ''
    }
  }
}

$preflight = Invoke-Probe 'Options' $Origin
if ($preflight.Status -notin @(200, 204)) { throw "Expected successful preflight, got $($preflight.Status)." }
if ($preflight.Headers['Access-Control-Allow-Origin'] -ne $Origin) { throw 'Preflight origin was not echoed.' }
if ((Invoke-Probe 'Options' 'https://attacker.example').Status -ne 403) { throw 'Disallowed origin was not rejected.' }
if ((Invoke-Probe 'Post' $Origin '{}').Status -ne 400) { throw 'Invalid contact body was not rejected.' }

if ($Send) {
  $payload = @{ name = 'Local delivery check'; email = 'furkanmertaksakal@gmail.com';
    message = 'Contact delivery verification ' + [DateTime]::UtcNow.ToString('o'); website = '' } | ConvertTo-Json
  $sent = Invoke-Probe 'Post' $Origin $payload
  if ($sent.Status -ne 200 -or $sent.Body -notmatch '"ok"\s*:\s*true') {
    throw "Live contact send failed with HTTP $($sent.Status)."
  }
}
Write-Output 'Contact Edge Function live checks passed.'
```

Without `-Send`, it must test only:

- allowed `OPTIONS` returns 2xx and exact `Access-Control-Allow-Origin`;
- disallowed origin returns 403;
- invalid body returns 400.

With `-Send`, post one valid message containing a timestamp and require HTTP 200 plus JSON `{ "ok": true }`. Never print the key or any secret.

- [ ] **Step 2: Add the secret template and deployment documentation**

Create `supabase/functions/.env.example`:

```dotenv
RESEND_API_KEY=
CONTACT_TO_EMAIL=furkanmertaksakal@gmail.com
CONTACT_FROM_EMAIL="Nazlı Belgin Website <website@nazlibelgin.com>"
CONTACT_IP_SALT=
```

Update the README with this exact order:

1. Verify `nazlibelgin.com` in Resend and wait for SPF/DKIM success.
2. Copy `.env.example` to ignored `supabase/functions/.env` and populate it locally.
3. Apply `05_contact_delivery.sql`, then `06_verify_contact_delivery.sql` in SQL Editor.
4. Set hosted secrets with `supabase secrets set --env-file supabase/functions/.env`.
5. Deploy with `supabase functions deploy send-contact --no-verify-jwt --use-api`.
6. Run `tools/verify-contact-live.ps1` without `-Send`, then with `-Send`.
7. Test the real form from localhost and inspect the Resend event plus Gmail receipt.
8. At launch, change only `CONTACT_TO_EMAIL` and rerun the live send.

Document that the current Supabase CLI is older than the latest advertised version; if deployment bundling fails, update the CLI before changing function code.

Confirm the spec status is `Approved — implementation planned`.

- [ ] **Step 3: Run documentation and secret-safety checks**

```powershell
rg -n "RESEND_API_KEY=re_|CONTACT_IP_SALT=" . --glob "!supabase/functions/.env.example" --glob "!docs/**" --glob "!tools/**"
git check-ignore supabase/functions/.env supabase/.temp/project-ref
python tools/verify-contact-function.py
git diff --check
```

Expected: the secret scan finds no populated secret values; both local paths are ignored; verifiers pass.

- [ ] **Step 4: Run the complete local regression suite**

```powershell
node --test tools/*.test.js tools/*.test.mjs
python tools/verify-art-works.py
python tools/verify-films.py
python tools/verify-about-cv.py
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify-manifesto.ps1
python tools/verify-studio.py
python tools/verify-contact.py
python tools/verify-contact-function.py
powershell -NoProfile -ExecutionPolicy Bypass -File tools/contact-sql.test.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/migrate-media.test.ps1
```

Expected: all pass.

- [ ] **Step 5: Stage documentation hunks selectively and commit**

```powershell
git add -- supabase/functions/.env.example tools/verify-contact-live.ps1 docs/superpowers/specs/2026-09-24-contact-email-delivery-design.md
git add -p -- README.md
git diff --cached --check
git commit -m "docs: add contact email deployment guide"
```

### Task 7: Deploy and prove live delivery

**Files:**
- Create: `docs/superpowers/verification/2026-09-24-contact-email-delivery.md`

**Interfaces:**
- Consumes: linked Supabase project, verified Resend domain, local ignored secret file, Tasks 1–6.
- Produces: deployed function plus evidence of localhost submission, Resend acceptance/delivery, and Gmail receipt without recording secrets or message content.

- [ ] **Step 1: Confirm external prerequisites without exposing them**

In Resend, verify that `nazlibelgin.com` shows successful SPF and DKIM. Confirm `supabase/functions/.env` exists locally with four non-empty variables, but print variable names/status only—not values.

If the CLI is not linked yet, read the project reference from the Supabase dashboard, enter it only at the prompt, and link without placing it in tracked files:

```powershell
$projectRef = Read-Host 'Supabase project reference'
supabase link --project-ref $projectRef
```

- [ ] **Step 2: Apply database changes and deploy**

Run `05_contact_delivery.sql` and `06_verify_contact_delivery.sql` in the linked project. Then:

```powershell
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy send-contact --no-verify-jwt --use-api
```

Expected: secrets accepted and `send-contact` deployment succeeds. If the old CLI rejects current project/function syntax, update Supabase CLI and retry the same deployment; do not rewrite working code to accommodate an obsolete bundler.

- [ ] **Step 3: Run non-sending and sending live probes**

```powershell
$projectUrl = Read-Host 'Supabase project URL'
$publishableKey = Read-Host 'Supabase publishable key'

powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify-contact-live.ps1 `
  -ProjectUrl $projectUrl `
  -PublishableKey $publishableKey

powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify-contact-live.ps1 `
  -ProjectUrl $projectUrl `
  -PublishableKey $publishableKey `
  -Send
```

Expected: CORS/validation probes pass and one real email is accepted.

- [ ] **Step 4: Verify localhost UI and final delivery**

Serve the static site on a numeric localhost port. Submit the real form once and verify:

- no mail chooser or navigation occurs;
- the button shows sending, then confirmed success;
- the Network panel shows the Edge Function response;
- Resend records an accepted then delivered event;
- `furkanmertaksakal@gmail.com` receives the note (check Spam during setup);
- Reply uses the submitted visitor address;
- a forced function failure produces inline failure and no false success.

- [ ] **Step 5: Record non-secret evidence and rerun regression tests**

Create the verification document with UTC timestamp, commit hash, SQL verifier result, deployed function version/id, tested origin, HTTP statuses, Resend event statuses, Gmail receipt yes/no, and full local suite result. Record no API keys, IPs, message body, or provider payload.

Run the complete Task 6 suite again. Expected: all pass on the exact tree being handed off.

- [ ] **Step 6: Commit verification evidence**

```powershell
git add -- docs/superpowers/verification/2026-09-24-contact-email-delivery.md
git diff --cached --check
git commit -m "test: verify live contact email delivery"
```

At launch, update `CONTACT_TO_EMAIL` to `nazlibelgin@gmail.com`, perform one controlled submission, and append a new dated verification entry rather than altering code.
