#!/usr/bin/env python3
"""Turn a product photo on a white background into a photocopier halftone.

    python3 scripts/halftone.py SOURCE OUT_BASENAME [--cell 9] [--width 360]

Writes OUT_BASENAME.webp and OUT_BASENAME.png: black dots on a transparent
background (the page's paper shows through, and dark mode inverts the dots
with a CSS filter). Needs Pillow. Used once for assets/img/bottle-halftone.*
from Smelloff's studio photo (assets/photos/offer-studio-white.webp).
"""
import argparse
import math

from PIL import Image, ImageDraw, ImageFilter, ImageOps

INK = (26, 25, 23, 255)


def halftone(src, out, cell, width, angle_deg=45, crop=None):
    im = Image.open(src).convert("L")
    if crop:
        im = im.crop(crop)
    # Fit the requested width, keep the ratio, work at 4x for clean dots.
    scale = width / im.width
    big = 4
    W, H = int(im.width * scale), int(im.height * scale)
    gray = im.resize((W * big, H * big), Image.LANCZOS)
    gray = ImageOps.autocontrast(gray, cutoff=1)
    # Push the studio backdrop to pure white so it prints as nothing,
    # and deepen the bottle a little: photocopiers lose mid-tones.
    gray = gray.point(lambda v: 255 if v > 214 else int((v / 214) ** 1.35 * 214))
    gray = gray.filter(ImageFilter.GaussianBlur(big * 0.6))

    canvas = Image.new("RGBA", gray.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    c = cell * big
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    diag = int(math.hypot(*gray.size)) + c
    px = gray.load()
    gw, gh = gray.size
    for gy in range(-diag, diag, c):
        for gx in range(-diag, diag, c):
            # Rotate the grid point into image space.
            x = gx * ca - gy * sa + gw / 2
            y = gx * sa + gy * ca + gh / 2
            if not (0 <= x < gw and 0 <= y < gh):
                continue
            dark = 1 - px[int(x), int(y)] / 255
            if dark < 0.04:
                continue
            r = (c / 2) * math.sqrt(dark) * 1.12
            draw.ellipse((x - r, y - r, x + r, y + r), fill=INK)
    small = canvas.resize((W, H), Image.LANCZOS)
    small.save(out + ".png", optimize=True)
    small.save(out + ".webp", quality=82, method=6)
    return small.size


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--cell", type=int, default=9)
    ap.add_argument("--width", type=int, default=360)
    ap.add_argument("--crop", type=lambda s: tuple(int(v) for v in s.split(",")))
    args = ap.parse_args()
    print(halftone(args.src, args.out, args.cell, args.width, crop=args.crop))
