#!/usr/bin/env python3
"""Wire per-post hero images into blog HTML.

For every blog/<slug>.html that has a matching blog/assets/<slug>.png:
  1. Insert a hero <img> right after the first </h1> (idempotent: skipped if already present).
  2. Repoint the default OG image (assets/og-image.jpg, www or non-www) to the
     per-post image at https://www.smelloff.in/blog/assets/<slug>.png. This single
     replace updates og:image, twitter:image, and the Article JSON-LD "image" since
     all three reference og-image.jpg.

Safe to re-run. Only touches posts whose image exists.
"""
import re
import sys
from pathlib import Path

BLOG = Path(__file__).resolve().parent.parent / "blog"
ASSETS = BLOG / "assets"
WWW = "https://smelloff.in"

DEFAULT_OG = [
    "https://www.smelloff.in/assets/og-image.jpg",
    "https://smelloff.in/assets/og-image.jpg",
]


def alt_from_h1(html: str, slug: str) -> str:
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
    if not m:
        return f"{slug.replace('-', ' ').title()} — Smelloff ODORSTRIKE"
    text = re.sub(r"<[^>]+>", "", m.group(1))
    text = re.sub(r"\s+", " ", text).strip()
    return f"{text} — Smelloff ODORSTRIKE"


def wire(path: Path) -> str:
    slug = path.stem
    img = ASSETS / f"{slug}.png"
    if not img.exists():
        return "no-image"
    html = path.read_text(encoding="utf-8")
    changed = False

    # 1. per-post OG / twitter / schema image
    new_url = f"{WWW}/blog/assets/{slug}.png"
    for default in DEFAULT_OG:
        if default in html:
            html = html.replace(default, new_url)
            changed = True

    # 2. hero <img> after first </h1> (idempotent)
    if 'class="blog-hero"' not in html:
        alt = alt_from_h1(html, slug).replace('"', "&quot;")
        hero = (
            f'\n<img class="blog-hero" src="/blog/assets/{slug}.png" '
            f'alt="{alt}" width="1200" height="630" '
            f'fetchpriority="high" decoding="async" '
            f'style="width:100%;height:auto;border-radius:8px;margin:18px 0 6px;display:block">'
        )
        new_html, n = re.subn(r"(</h1>)", r"\1" + hero, html, count=1)
        if n:
            html = new_html
            changed = True

    if changed:
        path.write_text(html, encoding="utf-8")
        return "wired"
    return "unchanged"


def main():
    results = {}
    for path in sorted(BLOG.glob("*.html")):
        if path.stem == "index":
            continue
        results.setdefault(wire(path), []).append(path.stem)
    for status, slugs in sorted(results.items()):
        print(f"{status}: {len(slugs)}")
        if status in ("wired", "unchanged"):
            for s in slugs:
                print(f"   - {s}")


if __name__ == "__main__":
    main()
