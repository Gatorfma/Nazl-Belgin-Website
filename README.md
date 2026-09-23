# Nazlı Belgin — portfolio site

A static one-page portfolio for the painter Nazlı Belgin, implemented from the
Claude Design canvas `Nazlı Belgin.dc.html`.

No build step, no dependencies, no framework. Open `index.html` through any
static server and it runs.

## Layout

```
index.html        markup: nav, hero, work, manifesto, films, about, contact, overlays
css/site.css      all styling; design tokens as CSS custom properties on :root
js/site.js        behaviour, ported from the design's x-dc / DCLogic component
favicon.svg
art/              41 web-sized artwork JPEGs (see art/README.md)
tools/            heic-to-web.py, for transcoding new source photos
.claude/launch.json  dev-server config for `python -m http.server 8080`
```

## Running it

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>. A plain file:// open mostly works, but
Studio and Supabase requests require the site to run through a server.

## What came from the design, and what changed

The canvas file is a Claude Design document: it wraps its markup in `<x-dc>`,
drives it with a `DCLogic` class, and depends on `support.js` (the design
runtime) plus `image-slot.js` (a drag-to-fill placeholder component). None of
that runtime works outside the design canvas, so the port:

- replaces `<sc-for>` / `<sc-if>` / `{{ }}` interpolation with plain rendering
  functions, and `DCLogic`'s `state`/`setState` with a small state object and a
  `render()` pass;
- lifts every inline `style` attribute into `css/site.css` as classes, keeping
  the original values (colours, `clamp()` scales, easings, timings) intact;
- swaps `<image-slot>` for a static `.slot` placeholder — the drop-to-fill
  behaviour depended on the design runtime's sidecar file writer. Uploading in
  studio mode covers the same need;
- uses real `<img>` elements with `loading="lazy"` instead of
  `background-image` divs, so artwork is crawlable and lazily fetched;
- adds `lang`, `<title>`, meta description, Open Graph tags, a favicon, a skip
  link, focus-visible outlines, and `prefers-reduced-motion` handling;
- renders the manifesto, films, biography and CV lists as static HTML rather
  than from JS, so they survive with JavaScript disabled. Only the work
  archive needs JS, since it is filterable and editable.

Scroll reveals use `IntersectionObserver` rather than the design's
scroll-handler bounding-box scan — same effect, far less work per frame.

## Studio mode

Studio uses Supabase Auth, Postgres Row Level Security, and the private editing
policies in `supabase/01_schema.sql`. There is no public sign-up flow. An
allowlisted artist can manage paintings, the portrait, Canvas videos, YouTube,
Spotify artwork, and CV entries. Public visitors only receive published rows.

### Launch order

1. In Supabase Authentication, create the one email/password Auth user for the
   artist and disable public sign-ups.
2. In SQL Editor, run
   [`01_schema.sql`](supabase/01_schema.sql),
   [`02_seed_content.sql`](supabase/02_seed_content.sql),
   [`03_authorize_artist.sql`](supabase/03_authorize_artist.sql), and
   [`04_verify.sql`](supabase/04_verify.sql), in that order. Replace the email
   placeholder in the authorization script with the Auth user's exact email.
3. Fill [`js/supabase-config.js`](js/supabase-config.js) with the project URL
   and publishable key.
4. Set the Supabase production Site URL, add the exact production recovery
   redirect URL, and add the exact localhost development URL used for testing.
5. Configure custom SMTP on the purchased domain. Enable secure password
   change, password-change notifications, and a password policy requiring at
   least 12 characters with upper- and lowercase letters, a number, and a
   symbol.
6. Run the media migration in dry-run mode, run it live only after the dry run
   reports zero failures, and then run `04_verify.sql` again:

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools/migrate-media.ps1 -DryRun -RowsFile tools/fixtures/current-media-rows.json
   powershell -ExecutionPolicy Bypass -File tools/migrate-media.ps1
   ```

7. On the production domain, exercise anonymous reads; artist login; create,
   edit, delete, reorder, and replacement for every content type; sign-out;
   recovery email; reauthentication email; password update; and the Gmail
   contact link and form fallback.

The publishable key is intended for browser code: RLS is the authorization
boundary. Never paste a service-role key into `js/supabase-config.js`, this
repository, or the migration tool. The migration authenticates as the
allowlisted artist and prompts for the password without writing it to disk.

Uploads use the `site-media` bucket. Painting and image uploads are validated
and downscaled to a maximum 1800px edge when necessary; Canvas accepts MP4 or
WebM. Painting drag-reordering remains disabled while a filter is active so the
visible subset cannot produce an ambiguous global order.

## The artwork files

All 41 paintings are in place, converted from the artist's HEIC originals —
see `art/README.md` for provenance and for how to add more.

The catalogue lives in the `CATALOGUE` array in `js/site.js`. Three works carry
full records (title, year, medium, dimensions); the other 38 carry only their
series, which is known from how the artist foldered the originals. Blank means
unknown and is rendered as "Untitled" — nothing is invented, because a
placeholder title on a real painting reads as a real attribution.

Undated works contribute no year, and the Year filter hides itself until the
archive holds at least two distinct years. Both come back automatically as
real records are filled in.

Source photos come off an iPhone as HEIC, which no browser but Safari can
display, so they must be transcoded before going into `art/`:

```bash
python tools/heic-to-web.py "path/to/IMG_1234.heic" art/new-work.jpg
```

If an image is ever missing the site degrades cleanly: it becomes a titled
placeholder, and the hero falls back to a single "Work to come" panel. A source
that fails to load is remembered for the session so it is not retried.

## Contact form

With no backend, the form validates input and then hands the message to the
visitor's mail client via a prefilled `mailto:` to `nazlibelgin@gmail.com`.

To deliver it server-side instead, set `FORM_ENDPOINT` in `js/site.js` to a URL
that accepts `POST` JSON of `{name, email, message}`. The mailto path is then
skipped and failures fall back to showing the studio address.

## Notes

Everything user-editable is HTML-escaped on the way into the DOM (`esc()` in
`js/site.js`), since work metadata is persisted and re-rendered via
`innerHTML`.

`[hidden] { display: none !important }` in the stylesheet is load-bearing —
several overlays carry `display: flex`, which would otherwise beat the user
agent's rule for the `hidden` attribute and leave the studio gate on screen.
