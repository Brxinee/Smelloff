"""
Build 10 SEO/AEO-optimized blog posts for Smelloff from configs.
Each config supplies head metadata + article body HTML + FAQs.
The shared template (CSS, nav, footer, schema scaffolding) lives here.

Run: python3 scripts/build_blogs.py
Writes to: blog/<slug>.html
"""
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "blog"
SITE = "https://smelloff.in"
DATE = "2026-04-26"
DATE_PRETTY = "April 26, 2026"
OG_IMAGE = f"{SITE}/assets/og-image.jpg"

NAV_HTML = (REPO / "_shared" / "nav.html").read_text(encoding="utf-8").strip()
FOOTER_HTML = (REPO / "_shared" / "footer.html").read_text(encoding="utf-8").strip()


def render_faqs_html(faqs):
    items = []
    for f in faqs:
        items.append(
            f'  <div class="faq-item">\n'
            f'    <p class="faq-q">{f["q"]}</p>\n'
            f'    <p class="faq-a">{f["a"]}</p>\n'
            f'  </div>'
        )
    return '\n<section class="faq-wrap" id="faq">\n  <h2>Frequently Asked Questions</h2>\n' + "\n".join(items) + "\n</section>"


def render_faqs_jsonld(faqs):
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": f["q"],
                "acceptedAnswer": {"@type": "Answer", "text": f["a"]},
            }
            for f in faqs
        ],
    }


def render_article_jsonld(cfg):
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": cfg["headline"],
        "author": {"@type": "Person", "name": "Jogdhande Nikhil Patil"},
        "publisher": {
            "@type": "Organization",
            "name": "Smelloff",
            "logo": {"@type": "ImageObject", "url": f"{SITE}/apple-touch-icon.png"},
        },
        "datePublished": DATE,
        "dateModified": DATE,
        "mainEntityOfPage": f"{SITE}/blog/{cfg['slug']}",
        "description": cfg["description"],
        "articleSection": cfg["section"],
        "wordCount": cfg["word_count"],
    }


def build_post(cfg):
    url = f"{SITE}/blog/{cfg['slug']}"
    title_tag = cfg["title_tag"]
    desc = cfg["description"]
    keywords = cfg["keywords"]
    h1 = cfg["h1"]
    dek = cfg["dek"]
    section = cfg["section"]
    read_time = cfg["read_time"]
    body = cfg["body_html"]
    faqs = cfg["faqs"]
    next_read_url = cfg["next_read_url"]
    next_read_title = cfg["next_read_title"]
    extra_jsonld = cfg.get("extra_jsonld", [])

    article_ld = json.dumps(render_article_jsonld(cfg), indent=2, ensure_ascii=False)
    faq_ld = json.dumps(render_faqs_jsonld(faqs), indent=2, ensure_ascii=False)
    extra_ld_blocks = "\n".join(
        f'<script type="application/ld+json">\n{json.dumps(j, indent=2, ensure_ascii=False)}\n</script>'
        for j in extra_jsonld
    )
    faqs_html = render_faqs_html(faqs)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>{title_tag}</title>
<meta name="description" content="{desc}">
<meta name="keywords" content="{keywords}">
<meta name="author" content="Jogdhande Nikhil Patil">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large">

<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{title_tag}">
<meta property="og:description" content="{desc}">
<meta property="og:site_name" content="Smelloff">
<meta property="og:image" content="{OG_IMAGE}">
<meta property="article:author" content="Jogdhande Nikhil Patil">
<meta property="article:published_time" content="{DATE}">
<meta property="article:section" content="{section}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title_tag}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{OG_IMAGE}">

<script type="application/ld+json">
{article_ld}
</script>
<script type="application/ld+json">
{faq_ld}
</script>
{extra_ld_blocks}

<!-- Fonts -->
<link rel="preload" href="/assets/fonts.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/assets/fonts.css"></noscript>
<link rel="stylesheet" href="/assets/css/tokens.css">
<meta name="theme-color" content="#080808">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/css/blog.css">

<!-- Analytics (GA4 + Meta Pixel) — consent-gated, nothing loads before opt-in -->
<script src="/assets/js/consent-analytics.js" defer></script>
<link rel="alternate" type="text/plain" title="LLM content" href="https://smelloff.in/llms.txt">
<link rel="alternate" type="application/rss+xml" title="Smelloff guides" href="https://smelloff.in/feed.xml">

<link rel="stylesheet" href="/assets/css/soft.css">
<link rel="stylesheet" href="/assets/css/checkout.css">
<link rel="stylesheet" href="/assets/css/chrome.css">
<script src="/assets/js/chrome.js" defer></script>
<script src="/assets/js/qr-creator.min.js" defer></script>
<script src="/assets/js/checkout.js" defer></script>
<script type="module" src="/assets/js/buy-module.js"></script>
</head>
<body>

<div id="progress-bar"></div>

{NAV_HTML}

<main id="sf-main">
<article class="article-wrap">
  <header class="article-header">
    <div class="article-meta">
      <span class="article-category">{section}</span>
      <span class="article-read-time">{read_time}</span>
      <span class="article-date">{DATE_PRETTY}</span>
    </div>
    <h1>{h1}</h1>
    <p class="article-dek">{dek}</p>
  </header>

{body}

{faqs_html}

  <div class="end-cta">
    <div class="cta-label">Meet the Fix</div>
    <h4>ODORSTRIKE — 50ml. Pocket. Pan-India.</h4>
    <p style="color:var(--grey);font-size:16px;margin-bottom:20px;">Zinc PCA + β-Cyclodextrin. Neutralises odor in approximately 10 seconds. Made in Hyderabad. COD pan-India.</p>
    <div class="price-row">
      <span class="strike-price">₹579</span>
      <span class="current-price">₹229</span>
    </div>
    <a href="/#buy" class="buy-btn">BUY NOW →</a>
  </div>

  <div class="next-read">
    <div class="next-read-label">Next Read</div>
    <a href="{next_read_url}">{next_read_title}<span class="next-arrow">→</span></a>
  </div>
</article>
</main>

{FOOTER_HTML}

<script>
  const bar = document.getElementById('progress-bar');
  function updateProgress() {{
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = pct + '%';
  }}
  window.addEventListener('scroll', updateProgress, {{ passive: true }});
</script>
</body>
</html>
"""


def main():
    from blog_data import POSTS
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for cfg in POSTS:
        html = build_post(cfg)
        out = OUT_DIR / f"{cfg['slug']}.html"
        out.write_text(html, encoding="utf-8")
        print(f"wrote {out} ({len(html)} bytes, ~{cfg['word_count']} words)")


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
