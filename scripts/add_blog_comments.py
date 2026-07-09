#!/usr/bin/env python3
"""Stamp the self-contained comment section into every blog post.

Each post ends with a uniform `</article>\\n\\n<footer class="blog-footer"`.
We insert, between the closing </article> and the footer:

    <section id="blog-comments" data-post-slug="<slug>"></section>
    <script src="/assets/js/blog-comments.js?v=1" defer></script>

`data-post-slug` is the filename stem (matches the canonical /blog/<slug> URL).
Idempotent: any post that already contains `id="blog-comments"` is skipped, so
re-running never double-stamps.
"""
import pathlib
import re

BLOG_DIR = pathlib.Path(__file__).resolve().parent.parent / "blog"
MARKER = 'id="blog-comments"'
# Match the exact canonical join between the article and the footer.
PATTERN = re.compile(r'</article>\s*\n\s*\n<footer class="blog-footer"')


def block(slug: str) -> str:
    return (
        "</article>\n\n"
        "<!-- Comments (self-contained; Supabase-backed, open commenting) -->\n"
        f'<section id="blog-comments" data-post-slug="{slug}"></section>\n'
        '<script src="/assets/js/blog-comments.js?v=1" defer></script>\n\n'
        '<footer class="blog-footer"'
    )


def main() -> None:
    stamped, skipped, missed = [], [], []
    for path in sorted(BLOG_DIR.glob("*.html")):
        if path.name == "index.html":
            continue
        html = path.read_text(encoding="utf-8")
        slug = path.stem
        if MARKER in html:
            skipped.append(slug)
            continue
        new_html, n = PATTERN.subn(block(slug), html, count=1)
        if n != 1:
            missed.append(slug)
            continue
        path.write_text(new_html, encoding="utf-8")
        stamped.append(slug)

    print(f"stamped: {len(stamped)}  skipped: {len(skipped)}  missed: {len(missed)}")
    if missed:
        print("MISSED (injection point not found):")
        for s in missed:
            print("  -", s)


if __name__ == "__main__":
    main()
