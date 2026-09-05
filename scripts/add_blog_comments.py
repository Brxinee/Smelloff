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
# Match the canonical join between the article (or main) and the footer.
PATTERN = re.compile(r'(</article>(?:\s*</main>)?)\s*\n\s*\n<footer class="([a-zA-Z0-9_-]+)"')


def block(slug: str, prefix: str, footer_class: str) -> str:
    return (
        f"{prefix}\n\n"
        "<!-- Comments (self-contained; Supabase-backed, open commenting) -->\n"
        f'<section id="blog-comments" data-post-slug="{slug}"></section>\n'
        '<script src="/assets/js/blog-comments.js?v=1" defer></script>\n\n'
        f'<footer class="{footer_class}"'
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
        m = PATTERN.search(html)
        if not m:
            missed.append(slug)
            continue
        prefix, footer_class = m.group(1), m.group(2)
        new_html = html[:m.start()] + block(slug, prefix, footer_class) + html[m.end():]
        path.write_text(new_html, encoding="utf-8")
        stamped.append(slug)

    print(f"stamped: {len(stamped)}  skipped: {len(skipped)}  missed: {len(missed)}")
    if missed:
        print("MISSED (injection point not found):")
        for s in missed:
            print("  -", s)


if __name__ == "__main__":
    main()
