# Nazlı Belgin — portfolio site

## Languages

The site is published in English at `/`, Turkish at `/tr/`, and Arabic at
`/ar/`.

`index.html` is the English site **and** the translation source. It is
hand-edited and never generated. Elements carrying `data-i18n` and
`data-i18n-attr` markers are substituted from `i18n/tr.json` and
`i18n/ar.json`.

After any edit to `index.html`, regenerate the translated pages:

```bash
node tools/build-i18n.js
```

The build fails if a marked key is missing from a language file, so a
half-translated page cannot be published. Commit `tr/index.html` and
`ar/index.html` along with your change — `tools/i18n-output.test.js` fails
if they are stale.

Run the tests with:

```bash
node --test tools/*.test.js
```

A few things worth knowing before editing:

- Translations never contain raw HTML. A real newline in a dictionary value
  becomes `<br>`; everything else is escaped.
- Each manifesto line keeps its English original in a sibling `._source` key,
  so the adaptation can be reviewed against it.
- Values stored in Supabase (`series`, `medium`) and strings built in JS
  (`All`, `Untitled`) translate through `js/i18n-terms.js`, keyed on the
  stored English value. The database is unchanged and filtering still uses
  the English value.
- The studio module is deliberately English and is not marked for
  translation.
- CSS uses logical properties throughout, so Arabic flows right-to-left from
  the same stylesheet. Don't reintroduce `margin-left` or `text-align: right`
  — `tools/rtl.test.js` fails if you do.

