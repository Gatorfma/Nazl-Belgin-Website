# Artwork files

Three paintings are referenced by `js/site.js` and need to live here:

| File | Work | Dimensions |
|---|---|---|
| `sweet-devil.jpg` | My Sweet Devil, 2025 | 60 × 60 cm |
| `darwin.jpg` | Darwin Was Just Guessing, 2025 | 100 × 81 cm |
| `too-horny.jpg` | Too Horny to Die, 2025 | 25 × 25 cm |

They are **not** in this repository — they could not be exported intact from
the source design project (the file-read API truncates at 256 KiB). Copy them
in from the original design project or from the artist's own files.

Until they are present the site degrades gracefully: each missing image is
replaced by a titled placeholder, and the hero slideshow falls back to a
single "Work to come" panel. Nothing breaks.

File names must match exactly, lowercase.
