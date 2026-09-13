# Artwork files

41 web-sized JPEGs, referenced by the `CATALOGUE` array in `js/site.js`.
Roughly 30 MB in total; each is capped at a 2000px longest edge, JPEG quality
82, progressive.

## Naming

| Pattern | Series | Count |
|---|---|---|
| `sweet-devil.jpg`, `darwin.jpg`, `too-horny.jpg` | the three identified works | 3 |
| `monsters-NNNN.jpg` | Monsters | 20 |
| `evolution-NNNN.jpg` | Evolution | 7 |
| `stone-hills-NNNN.jpg` | Stone Hills | 11 |

`NNNN` is the number from the source `IMG_NNNN.heic`, so every file traces back
to its original. Rename freely — just update `src` in `CATALOGUE` to match.

By series as the site counts them: Monsters 22, Evolution 8, Stone Hills 11.

## Where they came from

Converted from the artist's iPhone HEIC originals, delivered via WeTransfer as
`evrim-canavarlar-tastepeler`. The folders map to the series:
`Canavarlar` → Monsters (21 files), `Evrim` → Evolution (9),
`Taş tepeler` → Stone Hills (11).

The three named works were matched to the design's metadata by **exact pixel
dimensions**, not by eye — the ratios authored in the original design canvas
were `2569 / 2574`, `2510 / 3012` and `1952 / 1893`, each occurring exactly once
across the 41 paintings:

| Source | Original px | Output |
|---|---|---|
| `Canavarlar/IMG_4916.heic` | 2569 × 2574 | `sweet-devil.jpg` |
| `Evrim/IMG_1851.heic` | 2510 × 3012 | `darwin.jpg` |
| `Evrim/IMG_1865.heic` | 1952 × 1893 | `too-horny.jpg` |

**One thing to confirm with the artist:** `too-horny.jpg` came out of the
`Evrim` (Evolution) folder, but the design metadata records its series as
`Monsters`. The design's value was kept, which is why the site counts 22
Monsters and 8 Evolution rather than the 21 / 9 split of the folders.

## Metadata

Only those three have titles, dates, media and dimensions. The other 38 carry
their series and nothing else — they render as "Untitled" until real records
arrive. Fill them in via the `CATALOGUE` array; blank fields are simply omitted
from the caption and the lightbox rather than shown as gaps.

## Adding more

Browsers other than Safari cannot display HEIC, so source files must be
transcoded first:

```bash
python tools/heic-to-web.py "path/to/IMG_1234.heic" art/new-work.jpg
```

It prints the output dimensions and the exact `ratio` string to paste into
`CATALOGUE`. Defaults are a 2000px longest edge at quality 82; override with
`--max` and `--quality`.

The `ratio` must match the **delivered file's** pixel dimensions, not the camera
original — HEIC clean-aperture cropping shifts them by a pixel or two (2569 ×
2574 decodes to 2568 × 2574, then scales to 1995 × 2000). The site corrects
itself from the real image once loaded, so a wrong value costs a layout reflow
rather than a broken grid, but getting it right avoids the jump.

Each HEIC holds several image items — a 512 × 512 thumbnail, the
full-resolution primary image, and often a mid-size derivative. `ffprobe`
reports the thumbnail, which is misleading; the converter decodes the primary
image via ffmpeg, which is the one you want.
