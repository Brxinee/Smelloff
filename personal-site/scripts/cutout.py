#!/usr/bin/env python3
"""Cut an object out of a plain studio background and give it a sticker edge.

    python3 scripts/cutout.py SRC OUT_BASENAME --crop x0,y0,x1,y1 [--tol 38] [--width 420] [--edge 6]

Flood-fills the background from the crop's border (anything within --tol of
the border colour), feathers the edge, adds a white sticker outline and
writes OUT_BASENAME.webp + .avif with transparency. Used for the Wikimedia
Commons objects on the cover (credits: content/credits.json).
"""
import argparse
from collections import deque
from PIL import Image, ImageFilter, ImageChops

def largest_component(mask):
    w, h = mask.size
    m = mask.load()
    seen = bytearray(w * h)
    best = []
    for sy in range(h):
        for sx in range(w):
            if m[sx, sy] == 0 or seen[sy * w + sx]: continue
            comp, stack = [], [(sx, sy)]
            seen[sy * w + sx] = 1
            while stack:
                x, y = stack.pop(); comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and m[nx, ny] and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1; stack.append((nx, ny))
            if len(comp) > len(best): best = comp
    out = Image.new("L", (w, h), 0)
    o = out.load()
    for x, y in best: o[x, y] = 255
    return out


def cutout(src, out, crop, tol, width, edge, grow=0):
    im = Image.open(src).convert("RGB")
    if crop: im = im.crop(crop)
    w, h = im.size
    px = im.load()
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    near = lambda c: sum((c[i] - bg[i]) ** 2 for i in range(3)) <= tol * tol
    step = lambda a, b: sum((a[i] - b[i]) ** 2 for i in range(3)) <= grow * grow
    mask = Image.new("L", (w, h), 255)
    m = mask.load()
    edge_px = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    q = deque((p, px[p]) for p in edge_px)
    seen = set()
    while q:
        (x, y), prev = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        c = px[x, y]
        ok = step(c, prev) and near(c) if grow else near(c)
        if not ok: continue
        seen.add((x, y))
        m[x, y] = 0
        q.extend((((x + 1, y), c), ((x - 1, y), c), ((x, y + 1), c), ((x, y - 1), c)))
    # Keep only the biggest object: JPEG noise leaves specks behind.
    keep = largest_component(mask)
    mask = keep
    # Close pinholes, then soften the edge a little.
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    obj = im.convert("RGBA"); obj.putalpha(mask)
    scale = width / w
    obj = obj.resize((width, int(h * scale)), Image.LANCZOS)
    mask = obj.getchannel("A")
    pad = edge * 2
    canvas = Image.new("RGBA", (obj.width + pad * 2, obj.height + pad * 2), (0, 0, 0, 0))
    big = Image.new("L", canvas.size, 0); big.paste(mask, (pad, pad))
    outline = big.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(edge * 2 + 1)).filter(ImageFilter.GaussianBlur(0.7))
    white = Image.new("RGBA", canvas.size, (255, 253, 248, 255)); white.putalpha(outline)
    canvas.alpha_composite(white)
    canvas.alpha_composite(obj, (pad, pad))
    canvas = canvas.crop(canvas.getbbox())
    canvas.save(out + ".webp", quality=80, method=6)
    canvas.save(out + ".avif", quality=55)
    return canvas.size

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("out")
    ap.add_argument("--crop", type=lambda s: tuple(int(v) for v in s.split(",")))
    ap.add_argument("--tol", type=int, default=38)
    ap.add_argument("--width", type=int, default=420)
    ap.add_argument("--edge", type=int, default=6)
    ap.add_argument("--grow", type=int, default=0, help="neighbour tolerance for gradient backdrops")
    a = ap.parse_args()
    print(cutout(a.src, a.out, a.crop, a.tol, a.width, a.edge, a.grow))
