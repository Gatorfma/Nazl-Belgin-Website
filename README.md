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
`localStorage` is unreliable on that scheme, so studio mode wants a server.

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

Click **Studio** in the footer and enter the passcode. The default is
`atelier`, set as `PASSCODE` at the top of `js/site.js`.

Signed in, you can upload works (multi-select), drag to reorder, click a work
to edit its title/year/series/medium/dimensions, replace its image, or delete
it. **Reset** restores the catalogue as shipped in `js/site.js`.

Uploads are downscaled to a 1800px longest edge and stored as JPEG data URLs in
`localStorage`, keeping each painting's true aspect ratio for the masonry grid.

> This is a convenience for editing on your own machine, not access control.
> The passcode is in client-side JavaScript and the works live in this
> browser's `localStorage` — they are not uploaded anywhere, are not visible to
> visitors, and vanish if site data is cleared. Reordering and edits made here
> will not appear for anyone else. To publish changes for real, either commit
> the images into `art/` and edit the `CATALOGUE` array in `js/site.js`, or put
> a proper CMS behind it.

Drag-reordering is deliberately disabled while a filter is active, since the
visible order would not match the stored order.

### Saved edits are stamped against the catalogue

Each save records a fingerprint of the `CATALOGUE` array alongside the works.
On load, a saved list is reused **only** if it was stamped against the exact
catalogue in the current `js/site.js`; otherwise it is discarded and the shipped
catalogue wins.

This matters more than it sounds. Without it, anyone who once opened studio mode
would have their browser pin that snapshot forever — you could add paintings to
`CATALOGUE`, deploy, and still see the old set, with no indication why. The
stamp makes editing this file authoritative.

The consequence: **changing `CATALOGUE` discards local studio edits** in every
browser. That is the intended trade — local edits are a scratchpad, the file is
the source of truth — but it means real metadata belongs in `CATALOGUE`, not
typed into studio mode and left there.

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
visitor's mail client via a prefilled `mailto:`.

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
