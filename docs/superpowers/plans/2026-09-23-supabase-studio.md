# Supabase-backed Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-only Studio scratchpad with a Supabase-backed, invite-only content editor for every agreed artwork, media, portrait, and CV record.

**Architecture:** Keep the site as build-free HTML/CSS/JavaScript. A pinned `supabase-js` v2.117.0 browser client talks directly to Postgres, Auth, and a public-read Storage bucket; database and object RLS make the allowlisted Auth user the only writer. Checked-in content remains a read-only startup/outage fallback, while confirmed Supabase data becomes the normal rendered state.

**Tech Stack:** HTML5, CSS, ES2018 browser JavaScript, Supabase JS 2.117.0, PostgreSQL/RLS, Supabase Auth and Storage, Node 24 `node:test`, Python 3.12 structural checks, PowerShell 7-compatible migration tooling

**Spec:** `docs/superpowers/specs/2026-09-23-supabase-studio-design.md`

## Global Constraints

- Preserve the framework-free, no-build deployment and the current uncommitted Art Works layout changes.
- Do not add public sign-up, drafts, multiple roles, revisions, scheduling, or a general CMS.
- Never expose or request a Supabase service-role key; browser and migration flows use the publishable/anon key plus the artist's session.
- Store metadata in Postgres and files in the public-read `site-media` Storage bucket.
- Require membership in `studio_users` for every database or Storage mutation, even when the caller is otherwise authenticated.
- Publish each confirmed save immediately.
- Keep static content as a startup/outage fallback until the media migration and production verification are complete.
- Keep biography and manifesto prose source-controlled; manage paintings, portrait, Canvas videos, YouTube, Spotify images, exhibitions, projects, and fairs.
- Send public contact mail to `nazlibelgin@gmail.com`.
- Require at least 12 password characters with upper- and lowercase letters, a number, and a symbol in Supabase Auth settings.
- Treat user-authored strings as untrusted and escape them before assigning to `innerHTML`.
- Do not stage or overwrite unrelated working-tree edits. Before every commit step, inspect `git diff --cached` and omit the commit if it would capture pre-existing user work.

## File Structure

- `supabase/01_schema.sql` — tables, constraints, triggers, grants, RLS, Storage bucket/policies, and ordering RPCs.
- `supabase/02_seed_content.sql` — idempotent exact seed records for the current site.
- `supabase/03_authorize_artist.sql` — allowlist the single existing Auth account.
- `supabase/04_verify.sql` — executable assertions and inspection queries for the hosted project.
- `js/supabase-config.js` — browser-safe project URL and publishable key, invalid by default.
- `js/supabase-config.example.js` — documented copy template for project URL and publishable key.
- `js/content-model.js` — pure normalization, grouping, escaping, URL, file, and path rules.
- `js/content-api.js` — Supabase query/mutation/upload/auth adapter.
- `js/content-render.js` — render managed public sections without owning persistence.
- `js/studio.js` — login, password flows, Studio manager, CRUD, upload, and ordering orchestration.
- `js/site.js` — existing page state, painting grid/lightbox, contact flow, and boot integration.
- `js/art-works-scroll.js` — refresh dynamic media disclosures after managed content changes.
- `index.html` — fallback markup, Studio dialogs/forms, script order, and Gmail contact address.
- `css/site.css` — manager, form, pending, failure, mobile, and accessibility states.
- `tools/content-model.test.js` — pure content contract tests.
- `tools/content-api.test.js` — adapter and confirmed-state mutation tests with an in-memory Supabase boundary fake.
- `tools/studio-auth.test.js` — authorization and password-flow controller tests.
- `tools/content-render.test.js` — managed-section rendering and escaping tests.
- `tools/migrate-media.ps1` — authenticated, rerunnable local Storage migration.
- `tools/migrate-media.test.ps1` — offline migration mapping/dry-run verification.
- `tools/fixtures/current-media-rows.json` — non-secret artwork/media IDs, kinds, and legacy paths used for offline full-catalogue migration checks.
- `tools/verify-studio.py` — structural and accessibility checks for Studio markup and script order.
- `README.md` — SQL order, Auth/SMTP/dashboard setup, migration, configuration, and launch checklist.

## Review Focus

- Partial public-load failure: a failed table request must preserve only that section's fallback while successful sections still update; pinned by Task 5.
- Authenticated but non-allowlisted account: it must be signed out and never see mutation controls; pinned by Task 6.
- Duplicate, missing, or foreign IDs in a reorder request: the RPC must reject the complete operation without changing order; pinned by Task 2.
- Metadata insert failure after a successful upload: the new object must be cleaned up and confirmed UI state must remain unchanged; pinned by Task 7.
- Migration rerun after partial success: populated `storage_path` rows must be skipped and failed rows retried without duplicate objects; pinned by Task 9.

---

### Task 1: Pure content model and validation contract

**Files:**
- Create: `js/content-model.js`
- Create: `tools/content-model.test.js`

**Interfaces:**
- Consumes: raw `artworks`, `media_items`, and `cv_entries` rows from Supabase.
- Produces: `NBContentModel.escapeHtml(value)`, `normalizeArtwork(row, publicUrlFor)`, `normalizeMedia(row, publicUrlFor)`, `groupMedia(rows)`, `normalizeYoutubeUrl(value)`, `validateFile(file, kind)`, `storagePath(kind, id, mimeType)`, and `passwordIsStrong(value)`.

- [ ] **Step 1: Write failing model tests with hand-derived results**

```javascript
var assert = require('node:assert/strict');
var test = require('node:test');
var model = require('../js/content-model.js');

test('normalizes a migrated artwork to the existing painting view model', function () {
  var row = {
    id: '11111111-1111-4111-8111-111111111111', title: null, year: null,
    series: 'Evolution', medium: null, dimensions: null,
    storage_path: 'artworks/11111111-1111-4111-8111-111111111111.jpg',
    legacy_path: 'art/evolution-1861.jpg', aspect_width: 1591, aspect_height: 2000
  };
  var got = model.normalizeArtwork(row, function (path) { return 'https://cdn.test/' + path; });
  assert.deepEqual(got, {
    id: row.id, title: '', year: null, series: 'Evolution', medium: '', dims: '',
    src: 'https://cdn.test/artworks/11111111-1111-4111-8111-111111111111.jpg',
    ratio: '1591 / 2000'
  });
});

test('uses the legacy path until an object has migrated', function () {
  var got = model.normalizeMedia({
    id: '2', kind: 'portrait', title: 'Portrait', alt_text: 'Portrait of Nazlı Belgin',
    storage_path: null, legacy_path: 'art/portrait/nazlı.jpg', external_url: null,
    group_name: null, mime_type: 'image/jpeg', aspect_width: 1929, aspect_height: 2411,
    sort_order: 0
  }, function () { throw new Error('must not resolve Storage'); });
  assert.equal(got.src, 'art/portrait/nazlı.jpg');
});

test('normalizes supported YouTube URL shapes and rejects unrelated hosts', function () {
  assert.equal(model.normalizeYoutubeUrl('https://youtu.be/VriyhA6ayys?t=4'), 'https://www.youtube-nocookie.com/embed/VriyhA6ayys');
  assert.equal(model.normalizeYoutubeUrl('https://www.youtube.com/watch?v=VriyhA6ayys'), 'https://www.youtube-nocookie.com/embed/VriyhA6ayys');
  assert.equal(model.normalizeYoutubeUrl('https://vimeo.com/123'), null);
});

test('rejects an image disguised as video and applies the 100 MiB video ceiling', function () {
  assert.deepEqual(model.validateFile({ type: 'image/jpeg', size: 20 }, 'canvas_video'), { ok: false, message: 'Choose an MP4 or WebM video.' });
  assert.deepEqual(model.validateFile({ type: 'video/mp4', size: 104857601 }, 'canvas_video'), { ok: false, message: 'Videos must be 100 MB or smaller.' });
});

test('builds UUID object paths and enforces the agreed password policy', function () {
  assert.equal(model.storagePath('spotify_image', 'abc-123', 'image/png'), 'media/spotify-image/abc-123.png');
  assert.equal(model.passwordIsStrong('Long-enough9!'), true);
  assert.equal(model.passwordIsStrong('long-enough9!'), false);
});
```

- [ ] **Step 2: Run the model tests and confirm the missing module is the failure**

Run: `node --test tools/content-model.test.js`

Expected: FAIL with `Cannot find module '../js/content-model.js'`.

- [ ] **Step 3: Implement the UMD/CommonJS model module**

Use a UMD wrapper matching `js/art-works-scroll.js`. Keep accepted MIME maps and limits private. `validateFile` must accept JPEG/PNG/WebP up to 15 MiB for image kinds and MP4/WebM up to 100 MiB for Canvas video. `normalizeArtwork` maps `dimensions` to the existing `dims` property and prefers `storage_path` over `legacy_path`. `groupMedia` returns `{ portrait, youtube, canvasVideos, spotifyGroups }`, with Canvas rows sorted by `sort_order` and Spotify groups retaining first-seen group order.

```javascript
function storagePath(kind, id, mimeType) {
  var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/webm': 'webm' }[mimeType];
  var prefix = kind === 'artwork' ? 'artworks' : 'media/' + kind.replace(/_/g, '-');
  if (!ext) throw new Error('Unsupported media type: ' + mimeType);
  return prefix + '/' + id + '.' + ext;
}

function passwordIsStrong(value) {
  return typeof value === 'string' && value.length >= 12 && /[a-z]/.test(value) &&
    /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
}
```

- [ ] **Step 4: Run the model test green**

Run: `node --test tools/content-model.test.js`

Expected: PASS with no warnings.

- [ ] **Step 5: Commit the isolated new model files if the index is clean of user work**

```powershell
git add -- js/content-model.js tools/content-model.test.js
git diff --cached --check
git commit -m "feat: define portfolio content model"
```

### Task 2: Database schema, RLS, Storage policies, and order RPCs

**Files:**
- Create: `supabase/04_verify.sql`
- Create: `supabase/01_schema.sql`

**Interfaces:**
- Consumes: Supabase built-in `auth.users`, `auth.uid()`, `storage.buckets`, and `storage.objects`.
- Produces: `studio_users`, `artworks`, `media_items`, `cv_entries`, `is_studio_user()`, `reorder_artworks(uuid[])`, `reorder_media(text,text,uuid[])`, and `reorder_cv(text,uuid[])`.

- [ ] **Step 1: Write hosted verification SQL before the schema**

`supabase/04_verify.sql` must use `DO` assertions that raise exceptions when RLS is disabled, the `site-media` bucket is absent/non-public, a table or RPC is absent, an unsupported content kind/category exists, duplicate sort orders exist within a managed group, file-backed rows have neither path, or the authorized-user count is not exactly one. End with read-only result sets for table counts, policies, bucket settings, and the allowlisted email joined from `auth.users`.

```sql
do $$
declare missing_tables integer;
begin
  select count(*) into missing_tables
  from unnest(array['studio_users','artworks','media_items','cv_entries']) wanted(name)
  where to_regclass('public.' || wanted.name) is null;
  if missing_tables <> 0 then
    raise exception 'Missing % required public tables', missing_tables;
  end if;
end $$;

do $$
declare studio_count integer;
begin
  select count(*) into studio_count from public.studio_users;
  if studio_count <> 1 then
    raise exception 'Expected exactly one studio user, found %', studio_count;
  end if;
end $$;
```

- [ ] **Step 2: Confirm verification is red against an uninitialized project**

Run in Supabase SQL Editor before `01_schema.sql`: the first assertion block from `04_verify.sql`.

Expected: ERROR containing `Missing 4 required public tables`. If no hosted project is connected during implementation, record this check as pending operator verification rather than claiming it ran.

- [ ] **Step 3: Create tables and validation constraints**

Implement the columns from the spec. Use `generated by default as identity` nowhere; every content table uses `uuid default gen_random_uuid()`. Use checks equivalent to:

```sql
constraint artworks_year_check check (year is null or year between 1000 and 2100),
constraint artworks_aspect_check check (aspect_width > 0 and aspect_height > 0),
constraint media_kind_check check (kind in ('portrait','canvas_video','youtube','spotify_image')),
constraint media_source_check check (
  (kind = 'youtube' and external_url is not null and storage_path is null) or
  (kind <> 'youtube' and external_url is null and coalesce(storage_path, legacy_path) is not null)
),
constraint cv_category_check check (category in ('exhibition','project','fair'))
```

Add unique `slug` to every content table. Add deferrable unique ordering constraints: `(sort_order)` for artworks, `unique nulls not distinct (kind, group_name, sort_order)` for media, and `(category, sort_order)` for CV entries. Each reorder RPC defers its ordering constraint until transaction end so rows can exchange positions atomically. Add `set_updated_at()` triggers to all three content tables.

- [ ] **Step 4: Add allowlist helper, grants, and RLS policies**

```sql
create or replace function public.is_studio_user()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$ select exists(select 1 from public.studio_users where user_id = auth.uid()) $$;

revoke all on function public.is_studio_user() from public;
grant execute on function public.is_studio_user() to anon, authenticated;

alter table public.studio_users enable row level security;
alter table public.artworks enable row level security;
alter table public.media_items enable row level security;
alter table public.cv_entries enable row level security;

create policy studio_user_reads_self on public.studio_users for select to authenticated
using (user_id = auth.uid());
create policy public_reads_published_artworks on public.artworks for select to anon, authenticated
using (published or public.is_studio_user());
create policy studio_writes_artworks on public.artworks for all to authenticated
using (public.is_studio_user()) with check (public.is_studio_user());
```

Repeat the two content policies exactly for `media_items` and `cv_entries`. Grant `select` to `anon`; grant `select, insert, update, delete` to `authenticated`; grant only `select` on `studio_users` to `authenticated`.

- [ ] **Step 5: Create the Storage bucket and object policies**

Insert `site-media` as public with `file_size_limit = 104857600` and allowed MIME types `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, and `video/webm`. Add authenticated insert/update/delete policies whose `with check`/`using` clauses require `bucket_id = 'site-media' and public.is_studio_user()`. Do not add a browser policy that mutates `storage.buckets`.

- [ ] **Step 6: Implement atomic reorder RPCs**

Each function must reject unauthorized calls, arrays containing NULL/duplicates, and arrays whose IDs are not the complete membership of the target set. Lock target rows before validating, defer the relevant unique ordering constraint, then update from `unnest(ordered_ids) with ordinality`. This check catches the Review Focus reorder case:

```sql
if cardinality(ordered_ids) <> (select count(*) from public.artworks)
   or cardinality(ordered_ids) <> (select count(distinct value) from unnest(ordered_ids) value)
   or exists (
     select 1 from unnest(ordered_ids) value
     where not exists (select 1 from public.artworks where id = value)
   ) then
  raise exception 'Artwork order must contain every artwork ID exactly once';
end if;
```

Grant execute only to `authenticated`. `reorder_media` applies the same rule to a supplied kind and nullable group name using `group_name is not distinct from target_group`; `reorder_cv` applies it to one category.

- [ ] **Step 7: Run schema and the schema-level portion of verification**

Run in SQL Editor: `01_schema.sql`, then all `04_verify.sql` assertions except the exact-one-studio-user assertion.

Expected: schema/policy/bucket assertions pass; exact-one-user remains red until Task 3.

- [ ] **Step 8: Commit the new SQL contract files**

```powershell
git add -- supabase/01_schema.sql supabase/04_verify.sql
git diff --cached --check
git commit -m "feat: secure Supabase content schema"
```

### Task 3: Exact seed data and single-user authorization

**Files:**
- Create: `supabase/02_seed_content.sql`
- Create: `supabase/03_authorize_artist.sql`

**Interfaces:**
- Consumes: the current `CATALOGUE` in `js/site.js`, media/portrait markup and CV rows in `index.html`, and the Auth account created by the operator.
- Produces: stable seeded UUID/slug rows and exactly one `studio_users` row.

- [ ] **Step 1: Seed all current records idempotently**

Use explicit stable UUIDs, the current source order, and `on conflict (slug) do nothing` so reruns never overwrite artist edits. Assign artwork UUID suffixes `000000000001` through `000000000041` under the `10000000-0000-4000-8000-` prefix in `CATALOGUE` order. Assign media suffixes `000000000001` through `000000000020` under `20000000-0000-4000-8000-` in this order: portrait; three Canvas videos; YouTube; eleven Irmak images; two Feridun images; two Hümeyra images. Assign CV suffixes `000000000001` through `000000000015` under `30000000-0000-4000-8000-` in current exhibition/project/fair DOM order. Artwork rows preserve all 41 current `legacy_path` and ratio values and the three known metadata records. CV rows preserve the six exhibitions, five projects, and four fairs currently in `index.html`.

The seed form is:

```sql
insert into public.artworks
  (id, slug, title, year, series, medium, dimensions, legacy_path,
   aspect_width, aspect_height, sort_order, published)
values
  ('10000000-0000-4000-8000-000000000001','sweet-devil','My Sweet Devil',2025,
   'Monsters','Oil on canvas','60 × 60 cm','art/sweet-devil.jpg',1995,2000,0,true),
  ('10000000-0000-4000-8000-000000000002','darwin','Darwin Was Just Guessing',2025,
   'Evolution','Oil on canvas','100 × 81 cm','art/darwin.jpg',1667,2000,1,true),
  ('10000000-0000-4000-8000-000000000003','too-horny','Too Horny to Die',2025,
   'Monsters','Oil and oil stick on canvas','25 × 25 cm','art/too-horny.jpg',1952,1892,2,true)
on conflict (slug) do nothing;
```

Continue this exact column order for every remaining row. HTML entities must be decoded in stored descriptions (`Art & Design`, not `Art &amp; Design`). Seed the YouTube row with `https://www.youtube-nocookie.com/embed/VriyhA6ayys` and no local path.

- [ ] **Step 2: Add fail-closed artist authorization SQL**

Use the agreed Gmail address as the initial login. If a different Auth login is created, the operator changes this one literal before running the file.

```sql
do $$
declare
  target_email constant text := 'nazlibelgin@gmail.com';
  matched_ids uuid[];
begin
  select array_agg(id) into matched_ids
  from auth.users where lower(email) = lower(target_email);
  if coalesce(cardinality(matched_ids), 0) <> 1 then
    raise exception 'Expected exactly one Auth user for %, found %',
      target_email, coalesce(cardinality(matched_ids), 0);
  end if;
  insert into public.studio_users(user_id) values (matched_ids[1])
  on conflict (user_id) do nothing;
end $$;
```

- [ ] **Step 3: Run seed, authorization, and full verification in SQL Editor**

Run: `02_seed_content.sql`, create/confirm the Auth account, run `03_authorize_artist.sql`, then run `04_verify.sql`.

Expected counts: 41 artworks, 20 media rows, 15 CV rows, one allowlisted Studio user, one public `site-media` bucket, zero assertion failures. If no hosted project is connected during implementation, record all four files as ready for the user's manual run and do not report these checks as passed.

- [ ] **Step 4: Commit the seed and authorization files**

```powershell
git add -- supabase/02_seed_content.sql supabase/03_authorize_artist.sql
git diff --cached --check
git commit -m "feat: seed portfolio content and artist access"
```

### Task 4: Supabase browser adapter

**Files:**
- Create: `js/supabase-config.js`
- Create: `js/supabase-config.example.js`
- Create: `js/content-api.js`
- Create: `tools/content-api.test.js`

**Interfaces:**
- Consumes: `window.supabase.createClient`, `window.NB_SUPABASE_CONFIG`, and Task 1 model rules.
- Produces: `NBContentApi.create(config, supabaseLibrary)`, returning `configured`, `loadAll()`, `publicUrl(path)`, `isStudioUser(userId)`, `auth`, CRUD methods, reorder methods, `upload(path, blob)`, and `remove(paths)`.

- [ ] **Step 1: Write failing adapter tests**

Build a small in-memory boundary fake that implements `from(table)`, `storage.from(bucket)`, `rpc(name,args)`, and `auth`. Assert consumer-visible results, not fake call counts.

```javascript
test('loads successful sections while reporting a failed section independently', async function () {
  var api = apiModule.create({ url: 'https://project.supabase.co', publishableKey: 'key' },
    fakeSupabase({ artworks: [{ id: 'a' }], media_items: new Error('offline'), cv_entries: [{ id: 'c' }] }));
  var got = await api.loadAll();
  assert.deepEqual(got.artworks.rows, [{ id: 'a' }]);
  assert.equal(got.media.error.message, 'offline');
  assert.deepEqual(got.cv.rows, [{ id: 'c' }]);
});

test('stays unconfigured when URL or publishable key is empty', function () {
  assert.equal(apiModule.create({ url: '', publishableKey: '' }, fakeSupabase({})).configured, false);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test tools/content-api.test.js`

Expected: FAIL because `js/content-api.js` does not exist.

- [ ] **Step 3: Implement configuration and adapter**

`js/supabase-config.js` contains only:

```javascript
window.NB_SUPABASE_CONFIG = Object.freeze({ url: '', publishableKey: '' });
```

`js/supabase-config.example.js` contains the same executable shape plus comments directing the operator to copy the Supabase Project URL and Publishable key from the project's API settings; it explicitly says never to use `service_role`.

`create` validates an HTTPS `*.supabase.co` URL and a nonempty key before calling `createClient`. `loadAll()` uses `Promise.all` around three independently caught ordered selects so one rejection does not erase successful sections. `isStudioUser(userId)` selects `user_id` from `studio_users`, filters to the supplied session UUID, and returns true only for one exact row. Mutations throw normalized `Error` objects. `publicUrl` uses `storage.from('site-media').getPublicUrl(path).data.publicUrl`. Auth is exposed only through narrow wrapper methods: `getSession`, `onAuthStateChange`, `signIn`, `signOut`, `sendRecovery`, `reauthenticate`, and `updatePassword`.

- [ ] **Step 4: Run adapter and model suites green**

Run: `node --test tools/content-api.test.js tools/content-model.test.js`

Expected: PASS.

- [ ] **Step 5: Commit new adapter files**

```powershell
git add -- js/supabase-config.js js/supabase-config.example.js js/content-api.js tools/content-api.test.js
git diff --cached --check
git commit -m "feat: add Supabase browser adapter"
```

### Task 5: Public Supabase loading and managed-section rendering

**Files:**
- Create: `js/content-render.js`
- Create: `tools/content-render.test.js`
- Modify: `js/site.js`
- Modify: `index.html`
- Modify: `js/art-works-scroll.js`
- Modify: `tools/art-works-scroll.test.js`
- Modify: `tools/verify-art-works.py`
- Modify: `tools/verify-films.py`
- Modify: `tools/verify-about-cv.py`

**Interfaces:**
- Consumes: Task 1 normalized models and Task 4 `loadAll()`.
- Produces: `NBContentRender.renderMedia(root, grouped)`, `renderCv(root, entries)`, and `renderPortrait(root, portrait)`; dispatches `nb:content-updated` after successful replacements.

- [ ] **Step 1: Write failing renderer tests**

Use a minimal document fixture only for the containers being rendered. Assert real returned HTML/output nodes. Include a malicious description and the partial-load Review Focus case.

```javascript
test('escapes CV descriptions and groups them by category', function () {
  var html = render.cvHtml([
    { category: 'exhibition', year: '2025', description: '<img src=x onerror=alert(1)>', sort_order: 0 }
  ]);
  assert.match(html.exhibition, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html.exhibition, /<img/);
});

test('keeps failed-section fallback while applying successful section data', function () {
  var state = render.mergeLoadResult({ artworks: ['fallback-a'], media: ['fallback-m'], cv: ['fallback-c'] }, {
    artworks: { rows: ['remote-a'], error: null },
    media: { rows: null, error: new Error('offline') },
    cv: { rows: ['remote-c'], error: null }
  });
  assert.deepEqual(state, { artworks: ['remote-a'], media: ['fallback-m'], cv: ['remote-c'] });
});
```

- [ ] **Step 2: Verify renderer tests fail for the missing module**

Run: `node --test tools/content-render.test.js`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement pure render helpers and safe DOM updates**

Generate the same semantic structures already checked by the Python scripts: one YouTube iframe, Canvas `.film` articles, Spotify artist `<details>`, portrait `<img>`, and `.cv__row` lists. Apply user strings through `escapeHtml`; validate the iframe URL with Task 1 before interpolation. Return a boolean per section so `site.js` knows whether it replaced fallback.

- [ ] **Step 4: Integrate async data boot without delaying fallback**

Remove localStorage catalogue/auth reuse from `site.js` but keep the checked-in catalogue as `FALLBACK_CATALOGUE`. Initial render uses fallback synchronously. Then:

```javascript
function loadRemoteContent() {
  if (!contentApi.configured) return Promise.resolve(false);
  return contentApi.loadAll().then(function (result) {
    var merged = NBContentRender.mergeLoadResult(snapshotFallback(), result);
    if (!result.artworks.error) state.works = result.artworks.rows.map(function (row) {
      return NBContentModel.normalizeArtwork(row, contentApi.publicUrl);
    });
    if (!result.media.error) NBContentRender.renderMedia(document, NBContentModel.groupMedia(
      result.media.rows.map(function (row) { return NBContentModel.normalizeMedia(row, contentApi.publicUrl); })
    ));
    if (!result.cv.error) NBContentRender.renderCv(document, result.cv.rows);
    render();
    document.dispatchEvent(new CustomEvent('nb:content-updated'));
    return merged;
  });
}
```

Log section errors with `console.error` and keep their fallback. Do not show Supabase error details to public visitors.

- [ ] **Step 5: Pin browser scripts and identify dynamic containers**

Add `id="youtube-slot"`, `id="spotify-galleries"`, `id="portrait-frame"`, `id="cv-exhibitions"`, `id="cv-projects"`, and `id="cv-fairs"` without removing their fallback children. Before application scripts load:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.0/dist/umd/supabase.min.js"></script>
<script src="js/supabase-config.js"></script>
<script src="js/content-model.js"></script>
<script src="js/content-api.js"></script>
<script src="js/content-render.js"></script>
```

Cache-version every local script changed by this implementation.

- [ ] **Step 6: Make Art Works scroll bindings refresh safely**

Expose `refresh()` from the existing controller, mark already wired disclosures with a private `WeakSet`, and listen for `nb:content-updated` to re-query artist disclosures and remeasure. Extend `tools/art-works-scroll.test.js` so a newly appended artist disclosure becomes mutually exclusive after the update event while original handlers fire only once.

- [ ] **Step 7: Update structural checks for fallback-plus-dynamic containers**

Keep all current semantic expectations. Change exact static media-count assertions to require the seeded fallback counts and the managed container IDs/script order. Extend `verify-about-cv.py` to require the three CV container IDs and portrait frame while retaining heading order.

- [ ] **Step 8: Run public-rendering tests and existing checks**

```powershell
node --test tools/content-model.test.js tools/content-api.test.js tools/content-render.test.js tools/art-works-scroll.test.js
python tools/verify-art-works.py
python tools/verify-films.py
python tools/verify-about-cv.py
```

Expected: all PASS.

- [ ] **Step 9: Stage only reviewed hunks or defer the commit if it would include pre-existing work**

New files may be committed normally. For already-dirty files, inspect `git diff` and `git diff --cached`; do not commit the user's earlier Art Works hunks under this task's authorship. Suggested commit after clean staging: `feat: load public portfolio content from Supabase`.

### Task 6: Invite-only Auth, recovery, and email reauthentication

**Files:**
- Create: `js/studio.js`
- Create: `tools/studio-auth.test.js`
- Create: `tools/verify-studio.py`
- Modify: `index.html`
- Modify: `css/site.css`
- Modify: `js/site.js`

**Interfaces:**
- Consumes: Task 4 auth adapter and `isStudioUser()` query.
- Produces: `NBStudio.create(options)` with `init()`, `openLogin()`, `signOut()`, `requestRecovery(email)`, `requestPasswordChange()`, and `submitPasswordChange(nonce,password,confirmation)`.

- [ ] **Step 1: Write failing authorization controller tests**

```javascript
test('signs out an authenticated account that is not allowlisted', async function () {
  var uiStates = [];
  var controller = studio.create({
    auth: fakeAuth({ user: { id: 'outsider' } }),
    isStudioUser: async function () { return false; },
    onStudioChange: function (on) { uiStates.push(on); }
  });
  var result = await controller.login('outsider@example.com', 'Correct9!Password');
  assert.equal(result.ok, false);
  assert.equal(result.message, 'Studio access is not enabled for this account.');
  assert.deepEqual(uiStates, [false]);
  assert.equal(controller.isStudio(), false);
});

test('rejects mismatched or weak passwords before calling Supabase', async function () {
  var controller = studio.create({ auth: fakeAuth({ user: { id: 'artist' } }), isStudioUser: async function () { return true; } });
  assert.deepEqual(await controller.submitPasswordChange('123456', 'weak', 'different'),
    { ok: false, message: 'Passwords do not match.' });
});
```

- [ ] **Step 2: Verify red**

Run: `node --test tools/studio-auth.test.js`

Expected: FAIL until `js/studio.js` exports the controller.

- [ ] **Step 3: Implement fail-closed session and login state**

On init, call `getSession`; for any session, query `studio_users` for the current UUID. Enable Studio only on exactly one returned self row. On failure or zero rows, call `signOut`, hide all controls, and show the generic access message. Subscribe to `onAuthStateChange` and handle `SIGNED_OUT`, `SIGNED_IN`, `TOKEN_REFRESHED`, and `PASSWORD_RECOVERY` without duplicate dialogs.

- [ ] **Step 4: Implement recovery and password-change methods**

`requestRecovery` calls `resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname })`. `requestPasswordChange` calls `reauthenticate()`. `submitPasswordChange` verifies match and Task 1 password strength, requires a six-digit nonce, then calls `updateUser({ password, nonce })`; on success it clears all password fields and reports that Supabase sent the security notification.

- [ ] **Step 5: Replace passcode markup with accessible Auth dialogs**

The login form has email, password, submit, cancel, and `Forgot password?`; no sign-up control. Add separate recovery-status and password-change forms with labelled nonce/new/confirm fields. Each overlay uses `role="dialog"`, `aria-modal="true"`, an `aria-labelledby` heading, live status, Escape handling, focus entry, and focus restoration. Replace Reset in the Studio bar with Manage and Change password.

- [ ] **Step 6: Add focused styles and structural checks**

Reuse `.passgate` visual tokens; add field errors, pending buttons, manager overlay shell, visible focus, and mobile wrapping. `verify-studio.py` must parse the real HTML and fail if it finds a sign-up control, the old passcode-only input, `bar-reset`, a missing email/password autocomplete, a missing dialog label, or a missing pinned Supabase script before `studio.js`/`site.js`.

- [ ] **Step 7: Run Auth and structure tests**

```powershell
node --test tools/studio-auth.test.js tools/content-model.test.js
python tools/verify-studio.py
```

Expected: PASS.

- [ ] **Step 8: Commit cleanly staged Auth work**

Commit new files directly; stage modified-file hunks only when they do not absorb pre-existing work. Suggested message: `feat: add invite-only Supabase studio login`.

### Task 7: Painting CRUD, upload/replacement, and confirmed ordering

**Files:**
- Modify: `js/content-api.js`
- Modify: `js/studio.js`
- Modify: `js/site.js`
- Modify: `tools/content-api.test.js`
- Modify: `index.html`
- Modify: `css/site.css`

**Interfaces:**
- Consumes: `NBContentModel.validateFile/storagePath`, content API upload/CRUD/RPC, current painting lightbox.
- Produces: confirmed painting create/update/replace/delete/reorder behavior and `nb:content-updated` events.

- [ ] **Step 1: Add failing mutation transaction tests**

Pin the Review Focus cleanup and rollback behavior:

```javascript
test('removes a new object and preserves confirmed state when artwork insert fails', async function () {
  var api = fakeMutationApi({ insertError: new Error('row rejected') });
  var previous = [{ id: 'existing' }];
  var got = await studio.createArtworkTransaction(api, previous, {
    id: 'new-id', file: { type: 'image/jpeg', size: 100 }, blob: 'prepared-blob',
    width: 900, height: 1200, title: 'New work', year: 2026, series: 'Monsters',
    medium: 'Oil on canvas', dimensions: '40 × 30 cm'
  });
  assert.equal(got.ok, false);
  assert.deepEqual(got.works, previous);
  assert.deepEqual(api.removedPaths, ['artworks/new-id.jpg']);
});

test('restores confirmed order when reorder RPC rejects duplicate IDs', async function () {
  var previous = [{ id: 'a' }, { id: 'b' }];
  var got = await studio.persistOrder(fakeMutationApi({ reorderError: new Error('duplicate') }), previous, ['a', 'a']);
  assert.deepEqual(got.works, previous);
});
```

- [ ] **Step 2: Verify the new tests fail for missing transaction exports**

Run: `node --test tools/content-api.test.js`

Expected: FAIL naming `createArtworkTransaction` or `persistOrder`.

- [ ] **Step 3: Implement repository painting methods and transactions**

Add `insertArtwork`, `updateArtwork`, `deleteArtwork`, `reorderArtworks`, `upload`, and `remove`. Create uploads object-first, insert row second, and remove the object if insertion fails. Replacement uploads new, updates the row, then removes the old path; deletion removes Storage first, then deletes the row. Keep and return the previous confirmed list for any failed database mutation.

- [ ] **Step 4: Wire existing Studio painting UI to async confirmed writes**

Keep the lightbox fields and drag restriction while filters are active. Parse year as `null` or integer; send `dimensions`, not the view-model `dims`. Disable relevant controls while pending. Replace the local `save()`/`patch()` implementation with API calls followed by `loadRemoteContent()` and an explicit status. Add confirmation before deletion. Remove localStorage keys, `PASSCODE`, catalogue stamps, and Reset behavior completely.

- [ ] **Step 5: Preserve image preparation and send blobs instead of data URLs**

Refactor `readScaled` to return `{ blob, width, height, previewUrl }`. Revoke object URLs after preview replacement or dialog close. Keep the 1800px edge and JPEG quality 0.88. Retain PNG/WebP when the source has alpha; reject HEIC with the actionable message to use `tools/heic-to-web.py` first.

- [ ] **Step 6: Run painting transaction and regression tests**

```powershell
node --test tools/content-api.test.js tools/content-model.test.js tools/studio-auth.test.js
python tools/verify-studio.py
python tools/verify-art-works.py
```

Expected: PASS.

- [ ] **Step 7: Commit reviewed painting work**

Suggested message after safe staging: `feat: persist studio artwork edits`.

### Task 8: Manager for portrait, Canvas, YouTube, Spotify, and CV

**Files:**
- Modify: `js/content-render.js`
- Modify: `js/content-api.js`
- Modify: `js/studio.js`
- Modify: `tools/content-render.test.js`
- Modify: `tools/content-api.test.js`
- Modify: `index.html`
- Modify: `css/site.css`

**Interfaces:**
- Consumes: normalized managed content, generic media/CV CRUD, media/CV reorder RPCs.
- Produces: accessible Manage Content UI supporting the full agreed content set.

- [ ] **Step 1: Write failing manager rendering and mutation tests**

Test one row for every editor shape: portrait replacement, Canvas title/file, YouTube URL, Spotify group/title/image, and CV year/description. Include HTML metacharacters and invalid YouTube input. Test replacement cleanup ordering by asserting the returned confirmed record and fake Storage contents, not fake call counts.

```javascript
test('manager renders every agreed section with escaped values', function () {
  var html = render.managerHtml({
    portrait: { title: 'Portrait' }, youtube: { externalUrl: 'https://www.youtube-nocookie.com/embed/VriyhA6ayys' },
    canvasVideos: [{ id: 'v1', title: 'Dream 8' }],
    spotifyGroups: [{ name: 'A & B', items: [{ id: 's1', title: '<Untitled>' }] }],
    cv: { exhibition: [{ id: 'e1', year: '2025', description: 'London' }], project: [], fair: [] }
  });
  assert.match(html, /Portrait/);
  assert.match(html, /Canvas/);
  assert.match(html, /YouTube/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /&lt;Untitled&gt;/);
  assert.match(html, /Selected Exhibitions/);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test tools/content-render.test.js tools/content-api.test.js`

Expected: FAIL because manager rendering and generic mutations are absent.

- [ ] **Step 3: Add generic media/CV repository methods**

Implement `insertMedia`, `updateMedia`, `deleteMedia`, `reorderMedia(kind,groupName,ids)`, `insertCv`, `updateCv`, `deleteCv`, and `reorderCv(category,ids)`. Use the same confirmed-state and object cleanup rules as Task 7. YouTube mutations never call Storage.

- [ ] **Step 4: Build the manager UI**

The modal contains a visible section navigation and one form/list region. Every record uses stable `data-id` and `data-kind`; add/edit forms label every input. Reorder buttons provide Up/Down keyboard-accessible alternatives rather than drag-only controls. File-backed sections accept only their allowed MIME types. Delete buttons name the record and require confirmation. Close restores focus to `bar-manage`.

- [ ] **Step 5: Normalize YouTube and update public sections after confirmation**

Reject unsupported hosts before API calls. Save only the privacy-enhanced normalized embed URL. After any confirmed media or CV mutation, reload that table, re-render the corresponding public section and manager, dispatch `nb:content-updated`, and keep the manager open at the same section.

- [ ] **Step 6: Run manager, public renderer, and structural suites**

```powershell
node --test tools/content-render.test.js tools/content-api.test.js tools/content-model.test.js tools/studio-auth.test.js
python tools/verify-art-works.py
python tools/verify-films.py
python tools/verify-about-cv.py
python tools/verify-studio.py
```

Expected: PASS.

- [ ] **Step 7: Commit reviewed manager work**

Suggested message after safe staging: `feat: manage portfolio media and CV`.

### Task 9: Rerunnable authenticated media migration

**Files:**
- Create: `tools/migrate-media.ps1`
- Create: `tools/migrate-media.test.ps1`
- Create: `tools/fixtures/current-media-rows.json`

**Interfaces:**
- Consumes: project URL, publishable key, masked artist credentials, seeded `legacy_path` rows, and repository files.
- Produces: authenticated Storage uploads and `storage_path` updates; exit 0 only when all eligible rows are migrated/skipped successfully.

- [ ] **Step 1: Write an offline failing migration test**

Create a temporary fixture directory and JSON rows: one unmigrated artwork file, one row with `storage_path`, and one missing file. Invoke the production script with `-DryRun -RowsFile <fixture>` and assert output summary `migrated=1 skipped=1 failed=1` plus exit code 1. Then add the missing file and assert `migrated=2 skipped=1 failed=0` and exit 0. The test removes only its own `New-TemporaryFile`/GUID directory in a `finally` block.

- [ ] **Step 2: Run the migration test red**

Run: `powershell -ExecutionPolicy Bypass -File tools/migrate-media.test.ps1`

Expected: FAIL because `tools/migrate-media.ps1` is absent.

- [ ] **Step 3: Implement secure prompting and REST authentication**

Accept optional `-ProjectUrl`, `-PublishableKey`, `-DryRun`, and `-RowsFile`. Without `RowsFile`, prompt missing public config, email, and `Read-Host -AsSecureString` password. Convert the secure string only for the Auth request and clear the plain variable in `finally`. POST to `/auth/v1/token?grant_type=password`, then query `/rest/v1/artworks` and `/rest/v1/media_items` with the bearer token and `apikey`.

- [ ] **Step 4: Implement deterministic rerunnable upload/update behavior**

Skip YouTube and every row with nonempty `storage_path`. Resolve `legacy_path` under the repository root and reject traversal outside it. Derive the same Task 1 destination folders from row kind/UUID and MIME type. In live mode POST bytes to `/storage/v1/object/site-media/<encoded path>` with `x-upsert: false`, then PATCH only that row's `storage_path`. On an object-conflict response, check the row again and report a failure unless the database already references that exact path. Continue after per-file errors, print one final summary, and exit nonzero on any failure.

- [ ] **Step 5: Add and run the complete offline migration fixture**

Create `tools/fixtures/current-media-rows.json` with the stable UUID, table (`artworks` or `media_items`), media kind, `legacy_path`, and null `storage_path` for every file-backed row in `02_seed_content.sql`. The fixture therefore has 41 artworks plus the portrait, three Canvas videos, and fifteen Spotify images; it excludes the external YouTube row. `migrate-media.test.ps1` must run the production script against this committed fixture and require 60 resolvable local files and zero failures.

```powershell
powershell -ExecutionPolicy Bypass -File tools/migrate-media.test.ps1
powershell -ExecutionPolicy Bypass -File tools/migrate-media.ps1 -DryRun -RowsFile tools/fixtures/current-media-rows.json
```

Expected: all 60 existing local paths resolve, 0 failures.

- [ ] **Step 6: Commit the migration tool and test**

```powershell
git add -- tools/migrate-media.ps1 tools/migrate-media.test.ps1 tools/fixtures/current-media-rows.json
git diff --cached --check
git commit -m "feat: migrate portfolio media to Supabase"
```

### Task 10: Gmail contact, operator documentation, and complete verification

**Files:**
- Modify: `index.html`
- Modify: `js/site.js`
- Modify: `README.md`
- Modify: `tools/verify-studio.py`

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: launch-ready setup instructions and a fully verified repository state, excluding hosted SQL/Auth checks that only the operator can run.

- [ ] **Step 1: Extend the structural test for the Gmail contact contract**

Make `verify-studio.py` parse the contact anchor and fail unless both visible text and `mailto:` equal `nazlibelgin@gmail.com`. It must also fail if `studio@nazlibelgin.com`, `PASSCODE`, or `nb-studio-auth` remains in runtime HTML/JS.

- [ ] **Step 2: Run the test red**

Run: `python tools/verify-studio.py`

Expected: FAIL on the old contact address until the next step.

- [ ] **Step 3: Change contact delivery and document setup**

Set both the HTML anchor and `CONTACT_EMAIL` to `nazlibelgin@gmail.com`. Rewrite README Studio documentation with this exact operator order:

1. Create the one email/password Auth user; disable public sign-ups.
2. Run `01_schema.sql`, `02_seed_content.sql`, `03_authorize_artist.sql`, and `04_verify.sql`.
3. Fill `js/supabase-config.js` with the project URL and publishable key.
4. Configure production Site URL and exact redirect URLs plus localhost development URL.
5. Configure custom SMTP on the purchased domain, secure password change, password-change notifications, and the 12-character password policy.
6. Run the migration first with `-DryRun`, then live, then `04_verify.sql` again.
7. Exercise anonymous read, artist login, all CRUD types, order, replacement, sign-out, recovery email, reauthentication email, password update, and Gmail contact on the production domain.

Explain that the publishable key is safe in browser code because RLS is the boundary, and warn never to paste the service-role key into the site or migration tool.

- [ ] **Step 4: Run every automated test from a clean shell**

```powershell
node --test tools/*.test.js
python tools/verify-art-works.py
python tools/verify-films.py
python tools/verify-about-cv.py
powershell -ExecutionPolicy Bypass -File tools/verify-manifesto.ps1
python tools/verify-studio.py
powershell -ExecutionPolicy Bypass -File tools/migrate-media.test.ps1
```

Expected: every command PASS with no warnings or tracebacks.

- [ ] **Step 5: Serve and smoke-test both fallback and configured modes**

Run: `python -m http.server 8080`

Fallback mode with empty config must show all checked-in content, keep Studio unavailable with a configuration message, and send contact mail to Gmail. Configured mode must load Supabase rows, preserve the Art Works scroll behavior after dynamic content, and show Studio only after an allowlisted login. Test at desktop width and at 390px width, with keyboard-only navigation and reduced motion enabled.

- [ ] **Step 6: Inspect the final diff and document hosted checks still pending**

Run: `git diff --check`, `git status --short`, and `git diff --stat`. Confirm no service key, password, access token, or local migration output is present with:

```powershell
rg -n -i "service_role|service-role|access_token|refresh_token|password\s*[:=]\s*['\"]" . -g '!docs/superpowers/**' -g '!.git/**'
```

Review matches manually because field labels and test fixtures are expected; secrets are not. Report SQL/Auth/SMTP/media-upload checks as pending until the user runs them in Supabase.

- [ ] **Step 7: Commit documentation and Gmail contact only if staging is safe**

Suggested message after safe staging: `docs: add Supabase studio launch guide`.

## Final handoff

Provide the user with links to all four SQL files, `js/supabase-config.js`, the migration command, and README launch order. State exactly which automated commands passed and which hosted Supabase checks remain for the user. Do not recommend deleting `art/` until the migration summary has zero failures and the deployed site has been visually verified.
