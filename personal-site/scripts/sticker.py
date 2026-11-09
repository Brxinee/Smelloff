#!/usr/bin/env python3
"""Turn a cut-out photo (an RGBA PNG whose alpha is the subject) into a zine sticker.

    python3 scripts/sticker.py MATTE.png OUT_BASENAME [--width 520] [--edge 7] [--crop x0,y0,x1,y1]

Used for Nikhil's own photos (the bull, the standing shot, the Mumbai selfie):
the photo is first cut out with a segmentation model on the developer's machine
(rembg's `isnet-general-use` or `u2net_human_seg` ONNX files; nothing is sent to
a service), saved as a PNG with transparency, then passed here.

Cleans the matte (hard edge, biggest piece only), resizes, adds the same
off-white sticker outline as scripts/cutout.py and writes OUT_BASENAME.webp and
.avif. The original photos are not kept in the repository.
"""
import argparse
from PIL import Image, ImageFilter


def biggest(mask):
    """Keep the largest connected blob (drops specks the model left behind)."""
    small = mask.resize((max(1, mask.width // 4), max(1, mask.height // 4)), Image.NEAREST)
    w, h = small.size
    m = small.load()
    seen = bytearray(w * h)
    best = []
    for sy in range(h):
        for sx in range(w):
            if not m[sx, sy] or seen[sy * w + sx]:
                continue
            comp, stack = [], [(sx, sy)]
            seen[sy * w + sx] = 1
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and m[nx, ny] and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    keep = Image.new("L", (w, h), 0)
    k = keep.load()
    for x, y in best:
        k[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(5)).resize(mask.size, Image.NEAREST)
    out = Image.new("L", mask.size, 0)
    out.paste(mask, (0, 0), keep)
    return out


def sticker(src, out, width, edge, crop=None, cut=128):
    im = Image.open(src).convert("RGBA")
    if crop:
        im = im.crop(crop)
    alpha = im.getchannel("A").point(lambda v: 255 if v >= cut else 0)
    alpha = biggest(alpha)
    box = alpha.getbbox()
    im, alpha = im.crop(box), alpha.crop(box)
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    # Shrink by a pixel so no background fringe survives, then soften the edge.
    alpha = alpha.resize((width, h), Image.LANCZOS).point(lambda v: 255 if v >= 128 else 0)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    im.putalpha(alpha)

    pad = edge * 2
    canvas = Image.new("RGBA", (width + pad * 2, h + pad * 2), (0, 0, 0, 0))
    big = Image.new("L", canvas.size, 0)
    big.paste(alpha, (pad, pad))
    outline = big.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(edge * 2 + 1)).filter(ImageFilter.GaussianBlur(0.7))
    white = Image.new("RGBA", canvas.size, (255, 253, 248, 255))
    white.putalpha(outline)
    canvas.alpha_composite(white)
    canvas.alpha_composite(im, (pad, pad))
    canvas = canvas.crop(canvas.getbbox())
    canvas.save(out + ".webp", quality=80, method=6)
    canvas.save(out + ".avif", quality=55)
    return canvas.size


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--width", type=int, default=520)
    ap.add_argument("--edge", type=int, default=7)
    ap.add_argument("--crop", type=lambda s: tuple(int(v) for v in s.split(",")))
    a = ap.parse_args()
    print(sticker(a.src, a.out, a.width, a.edge, a.crop))
