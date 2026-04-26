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
SITE = "https://www.smelloff.in"
DATE = "2026-04-26"
DATE_PRETTY = "April 26, 2026"
OG_IMAGE = f"{SITE}/assets/og-image.jpg"


CSS = """  :root { --black:#080808; --off-white:#EDEAE0; --acid:#B8FF57; --grey:#8A8A85; --line:#1E1E1E; }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:var(--black);color:var(--off-white);font-family:'DM Sans',sans-serif;font-size:18px;line-height:1.75;-webkit-font-smoothing:antialiased;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;touch-action:pan-x pan-y}
  ::selection{background:var(--acid);color:var(--black)}
  #progress-bar{position:fixed;top:0;left:0;height:2px;width:0%;background:var(--acid);z-index:200;transition:width .1s linear}
  .blog-nav{position:sticky;top:0;z-index:100;background:rgba(8,8,8,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between}
  .blog-nav .logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;letter-spacing:3px;text-transform:uppercase;color:var(--off-white);text-decoration:none;position:relative;padding-right:12px}
  .blog-nav .logo::after{content:'';position:absolute;top:-2px;right:0;width:6px;height:6px;background:var(--acid);border-radius:50%}
  .blog-nav .buy-pill{background:var(--acid);color:var(--black);font-family:'DM Sans',sans-serif;font-weight:700;font-size:14px;padding:8px 18px;border-radius:100px;text-decoration:none}
  .article-wrap{max-width:680px;margin:0 auto;padding:60px 32px 100px}
  .article-header{margin-bottom:48px}
  .article-meta{display:flex;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap}
  .article-category{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--acid)}
  .article-read-time,.article-date{font-size:13px;color:var(--grey)}
  h1{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(36px,6vw,58px);letter-spacing:-.02em;line-height:1.1;color:var(--off-white);margin-bottom:20px}
  h1 em{font-style:italic;color:var(--grey)}
  .article-dek{font-family:'Fraunces',serif;font-style:italic;color:var(--grey);font-size:20px;line-height:1.5;border-top:1px solid var(--line);padding-top:24px;margin-top:24px}
  h2{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(26px,3.5vw,34px);letter-spacing:-.01em;line-height:1.2;color:var(--off-white);margin:52px 0 20px}
  h3{font-family:'DM Sans',sans-serif;font-weight:700;font-size:20px;color:var(--off-white);margin:36px 0 14px}
  p{margin-bottom:24px;color:var(--off-white)}
  p:last-child{margin-bottom:0}
  .drop-cap::first-letter{font-family:'Fraunces',serif;font-weight:600;font-size:68px;line-height:.85;float:left;margin-right:8px;margin-top:6px;color:var(--acid)}
  .pull-quote{font-family:'Fraunces',serif;font-style:italic;font-size:22px;line-height:1.5;color:var(--off-white);border-left:3px solid var(--acid);padding:8px 0 8px 24px;margin:40px 0}
  .callout{background:#111;border:1px solid var(--line);padding:24px 28px;margin:40px 0;border-radius:4px}
  .callout-label{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--acid);margin-bottom:10px}
  .callout p{font-size:16px;color:var(--off-white);margin:0 0 14px;line-height:1.65}
  .callout p:last-child{margin-bottom:0}
  .callout table{width:100%;border-collapse:collapse;font-size:15px;margin:8px 0 4px}
  .callout th,.callout td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);color:var(--off-white)}
  .callout th{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--acid)}
  ul,ol{margin:0 0 24px 22px;color:var(--off-white)}
  li{margin-bottom:10px}
  .inline-cta{color:var(--acid);text-decoration:underline;text-decoration-color:var(--acid);text-underline-offset:3px}
  a{color:var(--acid)}
  .end-cta{background:linear-gradient(135deg,#0f0f0f 0%,#151515 100%);border:1px solid var(--line);border-radius:8px;padding:40px 36px;margin:60px 0;text-align:center}
  .end-cta .cta-label{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--acid);margin-bottom:16px}
  .end-cta h4{font-family:'Fraunces',serif;font-weight:600;font-size:28px;color:var(--off-white);margin-bottom:12px;line-height:1.2}
  .end-cta .price-row{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:24px}
  .end-cta .strike-price{font-size:16px;color:var(--grey);text-decoration:line-through}
  .end-cta .current-price{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:32px;color:var(--acid)}
  .end-cta .buy-btn{display:inline-block;background:var(--acid);color:var(--black);font-family:'DM Sans',sans-serif;font-weight:700;font-size:16px;padding:14px 32px;border-radius:100px;text-decoration:none;letter-spacing:.02em}
  .next-read{border-top:1px solid var(--line);padding-top:40px;margin-top:60px}
  .next-read-label{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--grey);margin-bottom:16px}
  .next-read a{font-family:'Fraunces',serif;font-weight:600;font-size:clamp(22px,3vw,28px);color:var(--off-white);text-decoration:none;line-height:1.2;transition:color .2s}
  .next-read a:hover{color:var(--acid)}
  .next-read .next-arrow{color:var(--acid);margin-left:8px}
  .faq-wrap{margin:48px 0}
  .faq-item{border-top:1px solid var(--line);padding:24px 0}
  .faq-item:last-of-type{border-bottom:1px solid var(--line)}
  .faq-q{font-family:'Fraunces',serif;font-weight:600;font-size:20px;color:var(--off-white);margin-bottom:12px;line-height:1.3}
  .faq-a{font-size:16px;color:var(--off-white);line-height:1.7;margin:0}
  .blog-footer{border-top:1px solid var(--line);padding:40px 32px;max-width:680px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px 24px}
  .blog-footer a{font-size:14px;color:var(--grey);text-decoration:none;transition:color .2s}
  .blog-footer a:hover{color:var(--acid)}
  .blog-footer .footer-bottom{width:100%;padding-top:16px;border-top:1px solid rgba(184,255,87,.15);font-family:DM Sans,sans-serif;font-size:11px;color:#666;text-align:center;letter-spacing:.02em;margin-top:4px}
  .footer-links{display:flex;flex-wrap:wrap;gap:8px 18px;font-family:DM Sans,sans-serif;font-size:13px}
  .footer-links a{color:#888;text-decoration:none;transition:color .15s ease}
  .footer-links a:hover{color:#fff}
  strong{color:var(--off-white);font-weight:700}
  @media(max-width:720px){.blog-footer{flex-direction:column;align-items:flex-start}.blog-footer .footer-bottom{text-align:left}}
  @media(max-width:640px){.blog-nav{padding:0 20px}.article-wrap{padding:40px 20px 80px}.end-cta{padding:32px 24px}.blog-footer{padding:32px 20px;flex-direction:column;align-items:flex-start}}
"""


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
        "author": {"@type": "Person", "name": "Brainee"},
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
<meta name="author" content="Brainee">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large">

<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{title_tag}">
<meta property="og:description" content="{desc}">
<meta property="og:site_name" content="Smelloff">
<meta property="og:image" content="{OG_IMAGE}">
<meta property="article:author" content="Brainee">
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

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@900&family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,400;1,9..144,600&family=DM+Sans:wght@400;700&display=swap">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

<style>
{CSS}</style>
</head>
<body>

<div id="progress-bar"></div>

<nav class="blog-nav">
  <a href="/" class="logo">Smelloff</a>
  <a href="/#buy" class="buy-pill">BUY ₹229</a>
</nav>

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
    <p style="color:var(--grey);font-size:16px;margin-bottom:20px;">Zinc Ricinoleate + β-Cyclodextrin. Neutralises odor in 8–10 seconds. Made in Hyderabad. COD pan-India.</p>
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

<footer class="blog-footer">
  <a href="/" style="font-family:Barlow Condensed,sans-serif;font-weight:900;font-size:24px;letter-spacing:.06em;text-transform:uppercase;color:var(--off-white);position:relative;padding-right:.2em;text-decoration:none"><span style="position:relative">SMELLOFF<span style="position:absolute;top:-.06em;right:-.24em;width:.16em;height:.16em;background:var(--acid);border-radius:50%"></span></span></a>
  <div class="footer-links">
    <a href="/">Home</a>
    <a href="/blog">Blogs</a>
    <a href="/#buy">Buy ODORSTRIKE</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/shipping">Shipping</a>
    <a href="/returns">Returns</a>
    <a href="https://instagram.com/smell0ff" target="_blank" rel="noopener">Instagram</a>
  </div>
  <div class="footer-bottom">&copy; 2026 SMELLOFF &middot; All rights reserved &middot; Made in Hyderabad</div>
</footer>

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
