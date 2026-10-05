# Multilingual Site (Turkish and Arabic) Design

Date: 2026-10-05
Status: Approved — implementation planned

## Purpose

Publish the Nazlı Belgin portfolio in Turkish and Arabic alongside English, so a Turkish-speaking visitor searching "Nazlı Belgin ressam" and an Arabic-speaking collector both reach a page in their own language rather than an English-only site.

Each language must be a real, separately indexable URL. The recent Search Console work established the English page in Google's index; the same benefit must extend to the other two languages rather than being locked behind a client-side toggle Google never sees.

A visitor changes language from a selector in the header, next to the "Nazlı Belgin" wordmark, and stays on the section they were reading.

## Goals

- Serve three languages at `/` (English), `/tr/` (Turkish), and `/ar/` (Arabic).
- Keep `index.html` hand-editable as both the English site and the translation source, so editing it directly never silently loses work.
- Generate `tr/index.html` and `ar/index.html` with a single local command; commit the output.
- Fail the build loudly when a translation key is missing, so a half-translated page can never be published.
- Render Arabic right-to-left with correct typography, without altering English or Turkish layout.
- Translate the closed vocabularies that reach the UI from Supabase — artwork `series` and `medium` — without a schema migration or any change to the studio module.
- Connect the three pages with `hreflang`, per-language `canonical`, `og:locale`, and localized JSON-LD, and list all three in `sitemap.xml`.
- Preserve the visitor's current section across a language change (`#about` → `/tr/#about`).

## Non-goals

- No automatic redirect based on browser language or IP. Googlebot crawls from the US and would be pushed away from the Turkish and Arabic pages; a shared English link would also land visitors somewhere they did not expect. The selector is visible and explicit.
- The studio module (`js/studio.js`) and its UI stay English. It is Nazlı's internal editing tool, and translating it adds maintenance cost with no visitor benefit.
- No database schema change. `artworks.title` and the other stored fields are untouched, and no `title_tr` / `title_ar` columns are added.
- Artwork titles are not translated. A painting's title is a proper name; art-world convention leaves it in the original. The generic `Untitled` fallback is UI text, not stored data, and is translated as such.
- No CI pipeline for the build. The site is static and the build is one command; a GitHub Action can be added later if rebuilds are forgotten in practice.
- No translation of `README.md`, `art/README.md`, or other repository documentation.

## Architecture

```text
index.html  ──────────────┐   (English site AND translation source;
  data-i18n="hero.note"   │    hand-edited, never generated)
  data-i18n-attr=...      │
                          v
                 tools/build-i18n.py
                          │
            reads i18n/tr.json, i18n/ar.json
            substitutes marked text + attributes
            rewrites lang/dir/canonical/hreflang/og
                          │
          ┌───────────────┴───────────────┐
          v                               v
   tr/index.html                    ar/index.html
   lang="tr" dir="ltr"              lang="ar" dir="rtl"
```

English is never stored in a JSON file. It lives in `index.html`, which is the artifact the build reads. This keeps one hand-editable copy of the English site and avoids the common failure where a generated `index.html` quietly discards a direct edit.

## Components

### Marker syntax

Two attributes mark translatable content in `index.html`:

- `data-i18n="key"` — replaces the element's text content.
- `data-i18n-attr="attribute:key[,attribute:key]"` — replaces one or more attribute values, for `content`, `alt`, `placeholder`, `aria-label`, and `title`.

Example:

```html
<p class="hero__note" data-i18n="hero.note">Creatures that arrive uninvited…</p>
<meta name="description" data-i18n-attr="content:meta.description" content="Contemporary painter…">
<img src="art/portrait/nazlı.jpg" data-i18n-attr="alt:about.portraitAlt" alt="Portrait of Nazlı Belgin">
```

Elements with no marker pass through unchanged, which is correct for proper nouns, the wordmark, and section anchors.

### Translation files

`i18n/tr.json` and `i18n/ar.json`, flat key → string maps using dotted keys grouped by section (`nav.*`, `hero.*`, `manifesto.*`, `about.*`, `contact.*`, `meta.*`, `ui.*`).

There is deliberately no `i18n/en.json`.

### Build script

`tools/build-i18n.py`, Python 3 with no third-party dependencies, parsing with `html.parser` from the standard library rather than a regex, so attribute order and quoting survive.

Per output language the build:

1. Substitutes every `data-i18n` and `data-i18n-attr` value.
2. Sets `<html lang>` and, for Arabic, `dir="rtl"`.
3. Rewrites `canonical`, `og:url`, and `og:locale` to the language's URL and locale.
4. Injects the four reciprocal `hreflang` links (`en`, `tr`, `ar`, `x-default` → English).
5. Rewrites relative asset paths (`css/`, `js/`, `art/`, `favicon.svg`) to root-absolute (`/css/`, …) so they resolve from `/tr/` and `/ar/`.
6. Swaps the `google-site-verification` tag through unchanged — it is valid on every page of the property.
7. Localizes the JSON-LD `description` field; the structured facts (birth date, place, address) stay as-is.
8. Writes a `<!-- GENERATED by tools/build-i18n.py — edit index.html instead -->` banner as the first line.

The build **exits non-zero** when a key referenced in `index.html` is absent from a language file, listing every missing key. It also warns about keys present in a JSON file but unused in the HTML, which catches stale entries after an English edit.

Step 5 is the subtle one: the English page uses relative paths today, and those break one directory down. Root-absolute paths work identically from all three locations.

### Language selector

Markup sits immediately after `.nav__mark` inside `.nav`, so it reads as part of the left-hand identity block:

```html
<a class="nav__mark" href="#top">Nazlı Belgin</a>
<div class="nav__langs">
  <a href="/"    hreflang="en" lang="en">EN</a>
  <a href="/tr/" hreflang="tr" lang="tr">TR</a>
  <a href="/ar/" hreflang="ar" lang="ar">AR</a>
</div>
```

Styled to match the existing nav typography (11–12px, letter-spaced, uppercase), the active language marked with the ink colour and the same blue underline the work filters already use, the others in the muted tone. Separated by thin middots.

A small inline script appends `location.hash` to the target href on click, so section position survives the language change. Without JavaScript the links still work and simply land at the top of the page.

The active language is marked `aria-current="true"`, and the group carries `aria-label="Language"`.

### Right-to-left support

`css/site.css` currently has roughly 21 direction-sensitive declarations and no logical properties. These convert to logical equivalents:

| Physical | Logical |
|---|---|
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `text-align: left` / `right` | `text-align: start` / `end` |
| `left:` / `right:` on positioned elements | `inset-inline-start` / `inset-inline-end` |

The conversion is behaviour-preserving in LTR, so English and Turkish are unaffected.

Arabic needs its own typefaces — Libre Caslon Display and Karla carry no Arabic glyphs. The Arabic page loads Amiri for display headings (a naskh serif whose weight sits close to Libre Caslon) and Noto Sans Arabic for body text, pulled in only by `ar/index.html` so the other two pages carry no extra font cost.

`js/art-works-scroll.js` drives the horizontal artwork strip with `translate3d(Npx, 0, 0)`. Under `dir="rtl"` the scroll origin flips and the current sign produces motion in the wrong direction. The module reads the document direction once and negates the shift for RTL.

### Supabase term translation

`js/i18n-terms.js` exports two dictionaries keyed by the stored English value:

```js
series: { 'Monsters': { tr: 'Canavarlar', ar: 'وحوش' },
          'Evolution': { tr: 'Evrim',     ar: 'تطور' },
          'Stone Hills': { tr: 'Taş Tepeler', ar: 'تلال حجرية' } }
medium: { 'Oil on canvas': { tr: 'Tuval üzerine yağlıboya', ar: 'زيت على قماش' }, … }
```

The dictionaries are seeded from the distinct `series` and `medium` values present in the database at implementation time, enumerated with a query rather than assumed from the seed file.

The Turkish series names are Nazlı's own folder names from the original delivery, not invented translations.

Lookup happens at render time, reading the language from `document.documentElement.lang`. An unmapped value falls back to the stored English string, so a new series added through the studio appears untranslated rather than blank. Series filter buttons continue to filter on the stored English value and only display the translated label, so filtering keeps working across languages.

### SEO

Each page carries its own `canonical` (self-referential), `og:locale` (`en_US`, `tr_TR`, `ar_AR`), and localized `description`, `og:description`, and JSON-LD `description`.

`og:locale` takes a `language_TERRITORY` pair, and Arabic has no single country to name. `ar_AR` is the value Open Graph consumers accept for language-only Arabic; the bare `ar` used in `hreflang` is correct there but invalid here.

All three carry the identical set of four `hreflang` links, satisfying Google's reciprocity requirement.

`sitemap.xml` grows to three `<url>` entries, each with `xhtml:link` alternates. The 57 image entries stay on the English URL only; the same files are referenced by all three pages, and duplicating them would add nothing.

## Translation sourcing and review

I produce both Turkish and Arabic; Nazlı reviews and corrects. The manifesto is the exception that needs flagging: it is stylistic rather than informational ("I am raw because I am honest"), and literal translation destroys it. That section gets an adaptation rather than a translation.

To make review practical, each manifesto line in `i18n/tr.json` and `i18n/ar.json` is accompanied by a sibling key holding the English original — `manifesto.line1` next to `manifesto.line1._source`. JSON has no comment syntax, so this is a real key; the build ignores any key ending in `._source` and the orphaned-key check exempts them.

The Arabic text needs a reader of Arabic to check before launch. This is tracked as a release blocker, not a code task.

## Repository changes

| Path | Change |
|---|---|
| `index.html` | `data-i18n` markers, language selector markup, root-absolute asset paths |
| `i18n/tr.json` | new |
| `i18n/ar.json` | new |
| `tools/build-i18n.py` | new |
| `css/site.css` | logical properties, selector styles, RTL rules, Arabic fonts |
| `js/i18n-terms.js` | new |
| `js/content-render.js` | apply term dictionaries at render |
| `js/art-works-scroll.js` | direction-aware horizontal shift |
| `sitemap.xml` | three URLs with `xhtml:link` alternates |
| `tr/index.html`, `ar/index.html` | generated, committed |
| `README.md` | document the build step |

## Testing

Automated, run by the build and by `tools/i18n.test.js` alongside the existing `tools/studio-auth.test.js`:

- Every `data-i18n` and `data-i18n-attr` key in `index.html` resolves in both language files; a missing key fails the build.
- No key is orphaned in a JSON file without a corresponding marker.
- All three pages are produced and parse as HTML.
- `ar/index.html` has `lang="ar"` and `dir="rtl"`; `tr/index.html` has `lang="tr"` and no `dir`.
- `hreflang` is reciprocal across all three pages and includes `x-default`.
- Each page's `canonical` is self-referential.
- No generated page contains a relative `css/`, `js/`, or `art/` path.
- `sitemap.xml` is valid XML and lists exactly the three page URLs.
- No English string from a marked element survives in the Turkish or Arabic output.

Manual, before launch:

- `/ar/` renders right-to-left with Arabic glyphs, not boxes.
- The artwork strip scrolls the correct way on `/ar/`.
- Series filters work on all three pages and show translated labels.
- The language selector preserves `#section` across a switch.
- Contact form submits from all three pages.
- Studio sign-in works from all three and its UI stays English.

## Acceptance criteria

1. `/`, `/tr/`, and `/ar/` serve the site in English, Turkish, and Arabic respectively.
2. `python tools/build-i18n.py` regenerates both translated pages and fails loudly on a missing key.
3. The language selector appears beside the wordmark on all three pages, marks the active language, and preserves the current section.
4. `/ar/` renders right-to-left with Arabic typefaces; English and Turkish layout is visually unchanged from today.
5. Artwork `series` and `medium` display translated, with filtering unaffected and no schema change.
6. `hreflang`, `canonical`, and `og:locale` are correct and reciprocal; `sitemap.xml` lists all three.
7. No automatic language redirect exists.
8. The studio module remains English and functional on all three pages.
9. Nazlı has reviewed the Turkish text, and an Arabic reader has reviewed the Arabic text.

## Open items

- Arabic review by a native reader is a launch blocker and is outside the code work.
- Arabic translations for the longer `medium` values need Nazlı's confirmation that they match the terms she uses.
- If rebuilds are forgotten after an `index.html` edit, revisit the decision to skip CI and add a GitHub Action that runs the build and fails on drift.
