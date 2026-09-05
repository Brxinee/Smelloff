#!/usr/bin/env python3
"""
Standardize every blog post to the canonical chrome:
  - canonical <nav> (2a)
  - shared /assets/css/blog.css (removes per-file component CSS drift where safe)
  - canonical end-of-post stack: Product CTA (2b) + optional Read Next (2c) + 3-card Related Guides grid (2d)
  - canonical share row (2f) + /assets/js/blog-share.js (wires social + copy-link)
  - canonical multi-column <footer> (2e) + standard tail scripts
  - removes the JS "Keep reading" carousel + the run-on inline related links

Content preserved verbatim: <head> SEO/meta/JSON-LD, article header, article body
(paragraphs, callouts, pull-quotes, FAQ + FAQPage schema), each post's own spec line
and its own curated related/next links (just re-rendered as cards).

Idempotent-ish: safe to re-run. Reference partials live in /_shared/.
Run:  python3 scripts/standardize_blog.py
"""
import re, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BLOG = REPO / "blog"

BLOGCSS = '<link rel="stylesheet" href="/assets/css/blog.css?v=6">'

NAV = (
    '<header class="sf-hdr">\n'
    '  <div class="sf-wrap">\n'
    '    <div class="sf-hdr__row">\n'
    '      <a href="/" class="sf-hdr__logo" aria-label="Smelloff home">\n'
    '        <img src="/assets/brand/logo-smelloff-white.png?v=2" alt="SMELLOFF" width="1200" height="261" decoding="async">\n'
    '      </a>\n'
    '      <div class="sf-hdr__right">\n'
    '        <nav class="sf-nav-wrap" aria-label="Primary">\n'
    '          <ul class="sf-nav">\n'
    '            <li><a href="/#buy">ODORSTRIKE</a></li>\n'
    '            <li><a href="/#how-it-works">How it works</a></li>\n'
    '            <li><a href="/reviews">Proof</a></li>\n'
    '            <li><a href="/blog">Guides</a></li>\n'
    '            <li><a href="/track-order">Track</a></li>\n'
    '          </ul>\n'
    '        </nav>\n'
    '        <a href="/#buy" class="sf-hdr__cta so-btn so-btn--p1" data-smelloff-buy="header">Buy ₹229</a>\n'
    '        <button class="sf-burger" type="button" aria-expanded="false" aria-controls="sfMenu" aria-label="Open menu">\n'
    '          <span></span><span></span><span></span>\n'
    '        </button>\n'
    '      </div>\n'
    '    </div>\n'
    '    <nav class="sf-hdr__menu" id="sfMenu" aria-label="Menu">\n'
    '      <ul>\n'
    '        <li><a href="/#buy">ODORSTRIKE</a></li>\n'
    '        <li><a href="/#how-it-works">How it works</a></li>\n'
    '        <li><a href="/reviews">Proof</a></li>\n'
    '        <li><a href="/blog">Guides</a></li>\n'
    '        <li><a href="/track-order">Track</a></li>\n'
    '        <li><a href="/faq">FAQ</a></li>\n'
    '        <li><a href="/contact">Contact</a></li>\n'
    '      </ul>\n'
    '    </nav>\n'
    '  </div>\n'
    '</header>'
)

DEFAULT_SPEC = ("Treats the fabric, not your skin. 50ml pocket spray. "
                "Zero residue. Works in under 10 seconds.")

# Generic high-value pool to top up posts that have <3 curated related links.
POOL = [
    ("/blog/best-fabric-odor-spray-india-2026-body-odor/", "Best Fabric Odor Spray in India (2026)"),
    ("/blog/deodorant-vs-fabric-mist/", "Deodorant vs Fabric Mist: What Actually Kills Odor"),
    ("/blog/fix-shirt-odor-before-meeting/", "Fix Shirt Odor Before a Meeting"),
    ("/blog/odorstrike-review-30-day-india-test/", "ODORSTRIKE: 30-Day India Test"),
    ("/blog/spray-to-remove-sweat-smell-from-clothes-instantly/", "Remove Sweat Smell From Shirts Without Washing"),
]

# Class names owned by the shared stylesheet (+ legacy footer/carousel/nav classes
# that this pass renders obsolete). If a post's inline <style> only references these,
# the inline block is dropped entirely. Any other class => the post has bespoke body
# CSS, so we keep its inline block (minus !important) and let blog.css win by order.
SHARED = set("""
blog-nav logo buy-pill nav nav-inner nav-cta
article-wrap article-header article-meta article-category article-read-time
article-date blog-hero article-dek drop-cap pull-quote callout callout-label
quick-answer qa-label inline-cta bottom-line
end-cta cta-label cta-spec price-row strike-price current-price buy-btn eyebrow
read-next read-next__card read-next__title read-next__arrow
next-read next-read-label next-arrow related-reads related-guides
guide-grid guide-card guide-card__title guide-card__arrow
blog-footer footer-grid footer-brand bf-brand bf-brand-inner bf-brand-dot
bf-desc bf-tag bf-ig footer-col footer-col-label footer-bottom footer-top
footer-links footer-related footer-related-label footer-policy
faq-section faq-item faq-wrap faq-q faq-a
to-top show dragging
post-popular post-popular-label post-popular-viewport post-popular-track
post-pc post-pc-thumb post-pc-cat post-pc-title
""".split())

FOOTER = '''<footer class="sf-ftr">
  <div class="sf-wrap">
    <div class="sf-ftr__grid">
      <div class="sf-ftr__brand">
        <img src="/assets/brand/logo-smelloff-white.png?v=2" alt="SMELLOFF" width="1200" height="261" loading="lazy">
        <p>Fabric-only odor mist. Made in Hyderabad, India.</p>
      </div>
      <div>
        <h3>Shop</h3>
        <ul>
          <li><a href="/#buy">ODORSTRIKE</a></li>
          <li><a href="/solutions">Solutions</a></li>
          <li><a href="/blog/how-to-use-odorstrike">How to use</a></li>
          <li><a href="/reviews">Reviews</a></li>
          <li><a href="/blog">Guides</a></li>
          <li><a href="/track-order">Track order</a></li>
        </ul>
      </div>
      <div>
        <h3>Support</h3>
        <ul>
          <li><a href="/shipping">Shipping</a></li>
          <li><a href="/returns">Returns</a></li>
          <li><a href="/faq">FAQ</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </div>
      <div>
        <h3>Company</h3>
        <ul>
          <li><a href="/about">About</a></li>
          <li><a href="https://partners.smelloff.in">Partners</a></li>
          <li><a href="/llms.txt">llms.txt</a></li>
          <li><a href="/feed.xml">RSS</a></li>
        </ul>
      </div>
      <div>
        <h3>Legal</h3>
        <ul>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="/terms">Terms</a></li>
          <li><a href="/refund">Refunds</a></li>
          <li><a href="/cancellation">Cancellation</a></li>
        </ul>
      </div>
      <div class="sf-ftr__socials">
        <a href="https://instagram.com/smelloffindia" target="_blank" rel="noopener" aria-label="Instagram"><img src="/assets/icon-instagram-white.png" alt="" width="20" height="20" loading="lazy"></a>
        <a href="https://x.com/smelloffindia" target="_blank" rel="noopener" aria-label="X (Twitter)"><img src="/assets/icon-x.png" alt="" width="20" height="20" loading="lazy"></a>
        <a href="https://t.me/smelloffindia" target="_blank" rel="noopener" aria-label="Telegram"><img src="/assets/icon-telegram-white.png" alt="" width="20" height="20" loading="lazy"></a>
        <a href="https://www.linkedin.com/company/smelloff" target="_blank" rel="noopener" aria-label="LinkedIn"><img src="/assets/icon-linkedin-white.png" alt="" width="20" height="20" loading="lazy"></a>
        <a href="https://www.facebook.com/share/1BU1dCAttY/" target="_blank" rel="noopener" aria-label="Facebook"><img src="/assets/icon-facebook-white.png" alt="" width="20" height="20" loading="lazy"></a>
        <a href="https://wa.me/919392974031" target="_blank" rel="noopener" aria-label="WhatsApp"><img src="/assets/icon-whatsapp-white.png" alt="" width="20" height="20" loading="lazy"></a>
      </div>
    </div>
    <div class="sf-ftr__bottom">
      <span>© 2026 Smelloff. Hyderabad, India</span>
      <span>Made in India · Fabric only</span>
    </div>
  </div>
</footer>'''

SCRIPTS = '''<script>
  (function(){
    var bar=document.getElementById('progress-bar');
    if(bar){window.addEventListener('scroll',function(){
      var h=document.documentElement.scrollHeight-window.innerHeight;
      bar.style.width=(h>0?(window.scrollY/h)*100:0)+'%';
    },{passive:true});}
    var y=document.getElementById('year');
    if(y){y.textContent=new Date().getFullYear();}
  })();
</script>
<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){});});}</script>'''

# Canonical share row (2f). Sits at the end of the article, after Related Guides.
# Social hrefs + copy-link + native share are wired at runtime by blog-share.js
# from the page's canonical URL + og:title, so the same markup works on every post.
SHARE = '''  <aside class="post-share" aria-label="Share this guide">
    <span class="post-share-title"><svg class="ps-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M307 34.8c-11.5 5.1-19 16.6-19 29.2l0 64-112 0C78.8 128 0 206.8 0 304C0 417.3 81.5 467.9 100.2 478.1c2.5 1.4 5.3 1.9 8.1 1.9c10.9 0 19.7-8.9 19.7-19.7c0-7.5-4.3-14.4-9.8-19.5C108.8 431.9 96 414.4 96 384c0-53 43-96 96-96l96 0 0 64c0 12.6 7.4 24.1 19 29.2s25 3 34.4-5.4l160-144c6.7-6.1 10.6-14.7 10.6-23.8s-3.8-17.7-10.6-23.8l-160-144c-9.4-8.5-22.9-10.6-34.4-5.4z"/></svg>Share this guide</span>
    <div class="post-share-row">
      <button type="button" class="ps-btn ps-native" data-share-native hidden aria-label="Share via your apps"><svg class="ps-ico" viewBox="0 0 512 512" aria-hidden="true"><path d="M307 34.8c-11.5 5.1-19 16.6-19 29.2l0 64-112 0C78.8 128 0 206.8 0 304C0 417.3 81.5 467.9 100.2 478.1c2.5 1.4 5.3 1.9 8.1 1.9c10.9 0 19.7-8.9 19.7-19.7c0-7.5-4.3-14.4-9.8-19.5C108.8 431.9 96 414.4 96 384c0-53 43-96 96-96l96 0 0 64c0 12.6 7.4 24.1 19 29.2s25 3 34.4-5.4l160-144c6.7-6.1 10.6-14.7 10.6-23.8s-3.8-17.7-10.6-23.8l-160-144c-9.4-8.5-22.9-10.6-34.4-5.4z"/></svg></button>
      <a class="ps-btn" data-share="whatsapp" target="_blank" rel="noopener nofollow" aria-label="Share on WhatsApp"><img src="/assets/icon-whatsapp-white.png" alt="" width="19" height="19" loading="lazy"></a>
      <a class="ps-btn" data-share="x" target="_blank" rel="noopener nofollow" aria-label="Share on X"><img src="/assets/icon-x.png" alt="" width="19" height="19" loading="lazy"></a>
      <a class="ps-btn" data-share="facebook" target="_blank" rel="noopener nofollow" aria-label="Share on Facebook"><img src="/assets/icon-facebook-white.png" alt="" width="19" height="19" loading="lazy"></a>
      <a class="ps-btn" data-share="linkedin" target="_blank" rel="noopener nofollow" aria-label="Share on LinkedIn"><img src="/assets/icon-linkedin-white.png" alt="" width="19" height="19" loading="lazy"></a>
      <a class="ps-btn" data-share="telegram" target="_blank" rel="noopener nofollow" aria-label="Share on Telegram"><img src="/assets/icon-telegram-white.png" alt="" width="19" height="19" loading="lazy"></a>
      <button type="button" class="ps-btn ps-copy" data-share-copy aria-label="Copy link"><svg class="ps-ico" viewBox="0 0 640 512" aria-hidden="true"><path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C81.8 372 81.8 321 113.3 289.5L225.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"/></svg><span class="ps-copy-label">Copy link</span></button>
    </div>
  </aside>'''

SHARE_SCRIPT = '<script src="/assets/js/blog-share.js" defer></script>'


def ensure_share(html):
    """Idempotently add the share row + its script to a post. Runs on every
    file (including already-canonical ones the main transform skips)."""
    changed = False
    if 'class="post-share"' not in html:
        idx = html.find('</article>')
        if idx != -1:
            html = html[:idx] + SHARE + '\n' + html[idx:]
            changed = True
    if 'assets/js/blog-share.js' not in html:
        b = html.find('</body>')
        if b != -1:
            html = html[:b] + SHARE_SCRIPT + '\n' + html[b:]
            changed = True
    return html, changed


END_OPENERS = re.compile(
    r'<section class="post-popular|<div class="end-cta"|<section class="next-read|'
    r'<section class="read-next|<section class="related-guides|<section class="related-reads'
)


def clean_title(t):
    t = re.sub(r'<span[^>]*>.*?</span>', '', t, flags=re.S)   # drop arrow spans
    t = re.sub(r'<[^>]+>', '', t)                              # any other tags
    return re.sub(r'\s+', ' ', t).strip()


def extract_spec(html):
    m = re.search(r'<div class="end-cta">.*?<h4>.*?</h4>\s*<p[^>]*>(.*?)</p>', html, re.S)
    if m:
        return clean_title(m.group(1)) or DEFAULT_SPEC
    return DEFAULT_SPEC


def extract_related(html, self_slug):
    sec = re.search(r'<section class="[^"]*related-reads[^"]*">(.*?)</section>', html, re.S)
    links = []
    if sec:
        for href, title in re.findall(r'<a href="([^"]+)"[^>]*>(.*?)</a>', sec.group(1), re.S):
            ct = clean_title(title)
            if ct:
                links.append((href, ct))
    # de-dupe, drop self, cap at 3
    seen, out = set(), []
    for href, title in links:
        key = href.rstrip('/')
        if key in seen or self_slug in href:
            continue
        seen.add(key); out.append((href, title))
    for href, title in POOL:
        if len(out) >= 3:
            break
        key = href.rstrip('/')
        if key in seen or self_slug in href:
            continue
        seen.add(key); out.append((href, title))
    return out[:3]


def extract_read_next(html):
    m = re.search(r'<section class="next-read">(.*?)</section>', html, re.S)
    if not m:
        return None
    a = re.search(r'<a href="([^"]+)"[^>]*>(.*?)</a>', m.group(1), re.S)
    if not a:
        return None
    return (a.group(1), clean_title(a.group(2)))


def build_stack(spec, read_next, related):
    parts = []
    parts.append(
        '  <div class="end-cta">\n'
        '    <div class="cta-label">Meet the Fix</div>\n'
        '    <h4>ODORSTRIKE — Fabric Odor Mist</h4>\n'
        f'    <p class="cta-spec">{spec}</p>\n'
        '    <div class="price-row">\n'
        '      <span class="strike-price">₹579</span>\n'
        '      <span class="current-price">₹229</span>\n'
        '    </div>\n'
        '    <a href="/odorstrike/" class="buy-btn">BUY NOW →</a>\n'
        '  </div>'
    )
    if read_next:
        href, title = read_next
        parts.append(
            '  <section class="read-next" aria-labelledby="read-next-heading">\n'
            '    <p class="eyebrow" id="read-next-heading">Read Next</p>\n'
            f'    <a class="read-next__card" href="{href}">\n'
            f'      <span class="read-next__title">{title}</span>\n'
            '      <span class="read-next__arrow" aria-hidden="true">→</span>\n'
            '    </a>\n'
            '  </section>'
        )
    lis = []
    for href, title in related:
        lis.append(
            '      <li>\n'
            f'        <a class="guide-card" href="{href}">\n'
            f'          <span class="guide-card__title">{title}</span>\n'
            '          <span class="guide-card__arrow" aria-hidden="true">→</span>\n'
            '        </a>\n'
            '      </li>'
        )
    parts.append(
        '  <section class="related-guides" aria-labelledby="related-heading">\n'
        '    <p class="eyebrow" id="related-heading">Related Guides</p>\n'
        '    <ul class="guide-grid">\n' + '\n'.join(lis) + '\n'
        '    </ul>\n'
        '  </section>'
    )
    return '\n'.join(parts)


def inline_style_is_shared_only(style_body):
    classes = set(re.findall(r'\.([A-Za-z][\w-]*)', style_body))
    return classes.issubset(SHARED)


def transform(path):
    slug = path.stem
    html = path.read_text(encoding='utf-8')
    orig = html

    # Idempotency guard: never re-process a post that already carries the canonical
    # stack, or we would re-extract related links from markup that no longer exists.
    if 'class="related-guides"' in html:
        return False, ('already-canonical', False, 0)

    # 1. Extract per-post content BEFORE mutating.
    spec = extract_spec(html)
    read_next = extract_read_next(html)
    related = extract_related(html, slug)

    # 2. Handle the inline <style> block.
    sm = re.search(r'<style>(.*?)</style>', html, re.S)
    if sm:
        if inline_style_is_shared_only(sm.group(1)):
            html = html[:sm.start()] + '<!-- component styles moved to shared blog stylesheet -->' + html[sm.end():]
        else:
            kept = sm.group(1).replace('!important', '')
            html = html[:sm.start()] + '<style>' + kept + '</style>' + html[sm.end():]

    # 3. Drop the old neo-lite.css link, ensure blog.css is linked (last, before </head>).
    html = re.sub(r'\s*<link rel="stylesheet" href="/assets/css/neo-lite\.css[^"]*">', '', html)
    if 'assets/css/blog.css' not in html:
        html = html.replace('</head>', '  ' + BLOGCSS + '\n</head>', 1)

    # 4. Canonical nav (replace whatever nav exists).
    html = re.sub(r'<nav\b[^>]*>.*?</nav>', lambda m: NAV, html, count=1, flags=re.S)

    # 5. Swap end-of-post modules inside <article> with the canonical stack.
    art_end = html.find('</article>')
    stack = build_stack(spec, read_next, related)
    if art_end != -1:
        art_start = html.find('<article')
        region = html[art_start:art_end]
        om = END_OPENERS.search(region)
        if om:
            cut = art_start + om.start()
            html = html[:cut] + stack + '\n' + html[art_end:]
        else:
            html = html[:art_end] + stack + '\n' + html[art_end:]

    # 6. Replace footer + all tail scripts with canonical footer + standard scripts.
    fstart = html.find('<footer')
    bend = html.find('</body>')
    if fstart != -1 and bend != -1 and fstart < bend:
        html = html[:fstart] + FOOTER + '\n\n' + SCRIPTS + '\n' + html[bend:]

    changed = html != orig
    if changed:
        path.write_text(html, encoding='utf-8')
    return changed, (spec, bool(read_next), len(related))


def main():
    files = sorted(p for p in BLOG.glob('*.html') if p.name != 'index.html')
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    n = 0
    for p in files:
        if only and p.name not in only:
            continue
        changed, info = transform(p)
        # Share row + script: idempotent, runs even on already-canonical posts.
        html2, sh = ensure_share(p.read_text(encoding='utf-8'))
        if sh:
            p.write_text(html2, encoding='utf-8')
            changed = True
        n += 1 if changed else 0
        print(f"{'CHG' if changed else '   '} {p.name:55s} readnext={info[1]} related={info[2]} share={'+' if sh else 'ok'}")
    print(f"\n{n} files changed.")


if __name__ == '__main__':
    main()
