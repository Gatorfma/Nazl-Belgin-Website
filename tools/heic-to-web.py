#!/usr/bin/env python3
"""Convert a source photo (HEIC, PNG, JPEG, ...) into a web-sized JPEG.

Browsers other than Safari cannot display HEIC, so anything coming off an
iPhone has to be transcoded before it can go into art/.

HEIC is decoded with ffmpeg (which must be on PATH); resizing and JPEG
encoding are done with Pillow. HEIC files hold several image items — a small
thumbnail, the full-resolution primary image, and often a mid-size derivative
— and ffmpeg picks the primary one, which is what we want.

Usage:
    python tools/heic-to-web.py SRC DEST.jpg [--max 2000] [--quality 82]

Prints the final pixel dimensions, which is the value to put in the `ratio`
field of the REAL array in js/site.js.
"""

import argparse
import os
import subprocess
import sys
import tempfile

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: python -m pip install Pillow")


def decode_to_png(src, tmpdir):
    """Decode any ffmpeg-readable image to a lossless PNG."""
    out = os.path.join(tmpdir, "decoded.png")
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src, out],
        capture_output=True, text=True,
    )
    if proc.returncode != 0 or not os.path.exists(out):
        raise RuntimeError(f"ffmpeg could not decode {src}\n{proc.stderr.strip()}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dest")
    ap.add_argument("--max", type=int, default=2000,
                    help="longest edge in px (default 2000)")
    ap.add_argument("--quality", type=int, default=82,
                    help="JPEG quality (default 82)")
    args = ap.parse_args()

    if not os.path.exists(args.src):
        sys.exit(f"no such file: {args.src}")

    with tempfile.TemporaryDirectory() as tmp:
        # Pillow cannot read HEIC without pillow-heif, so route everything it
        # does not natively open through ffmpeg first.
        try:
            img = Image.open(args.src)
            img.load()
        except Exception:
            img = Image.open(decode_to_png(args.src, tmp))
            img.load()

        src_size = img.size

        if img.mode not in ("RGB", "L"):
            # Flatten alpha onto the site's paper colour rather than black.
            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGBA")
                bg = Image.new("RGBA", img.size, (242, 237, 227, 255))
                img = Image.alpha_composite(bg, img)
            img = img.convert("RGB")

        w, h = img.size
        scale = min(1.0, args.max / max(w, h))
        if scale < 1.0:
            img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)

        os.makedirs(os.path.dirname(os.path.abspath(args.dest)), exist_ok=True)
        img.save(args.dest, "JPEG", quality=args.quality,
                 optimize=True, progressive=True)

    out_kb = os.path.getsize(args.dest) / 1024
    print(f"{os.path.basename(args.src)}: {src_size[0]}x{src_size[1]}"
          f" -> {img.size[0]}x{img.size[1]}  {out_kb:.0f} KB")
    print(f"  ratio: '{img.size[0]} / {img.size[1]}'")


if __name__ == "__main__":
    main()
