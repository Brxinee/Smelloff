#!/usr/bin/env python3
"""Apply all remaining GEO/SEO fixes:
1. Add .quick-answer divs + SpeakableSpecification JSON-LD to posts missing them
2. Fix Organization→Person author in affected posts
3. Add Article schema to fix-shirt-odor post
4. Fix canonical URLs (non-www → www) across all HTML/XML files
5. Add wordCount to Article schema where missing
"""

import re
from pathlib import Path

BLOG = Path("/home/user/Smelloff/blog")
ROOT = Path("/home/user/Smelloff")

SPEAKABLE_BLOCK = '''<script type="application/ld+json">
{"@context":"https://schema.org","@type":"SpeakableSpecification","cssSelector":[".quick-answer",".article-dek"]}
</script>'''

QA_TEMPLATE = '''  <div class="quick-answer" style="background:var(--bg-surface);border-left:3px solid var(--accent);padding:18px 22px;margin:28px 0;border-radius:4px">
    <p style="margin:0 0 8px;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)">Quick answer</p>
    <p style="margin:0;color:var(--text);font-size:16px;line-height:1.6">{content}</p>
  </div>'''

QA_CONTENT = {
    "alternative-to-deodorant-for-clothes-smell": (
        "What is the alternative to deodorant for clothes smell?",
        "Deodorant is made for skin — it cannot reach odor locked inside fabric fibres. A fabric odor spray with a neutralising active like Zinc PCA is the right tool for clothes. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> is purpose-built for fabric: mist it on the collar, underarms, and hem, and it kills the odor at the source rather than adding more scent on top."
    ),
    "best-body-odor-remover-spray-for-men-india": (
        "What is the best body odor remover spray for men in India?",
        "For skin, an antiperspirant handles it. For fabric, you need a dedicated fabric spray with a neutralising ingredient like Zinc PCA. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> is designed for Indian conditions: pocket-sized at 50ml, fast-drying on cotton and polyester, and effective without fragrance overload."
    ),
    "best-deodorant-spray-for-clothes-not-skin": (
        "Is there a deodorant spray made for clothes, not skin?",
        "Yes — fabric odor sprays are a distinct category from body deodorant. They are formulated for textile fibres, not skin chemistry. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> uses Zinc PCA to neutralise odor compounds in fabric and is designed to carry in your bag for an on-the-go reset."
    ),
    "best-fabric-odor-spray-india-2026-body-odor": (
        "What is the best fabric odor spray for body odor in India?",
        "The best option for Indian conditions works on both cotton and polyester, dries quickly, leaves no white residue, and is pocket-portable for bus or bike commutes. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> ticks all four: ₹229, 50ml, zinc-based neutraliser that kills the odor rather than masking it."
    ),
    "bike-rider-sweat-smell-india": (
        "How do bike riders stop their clothes smelling after the commute?",
        "Apply a zinc-based fabric spray to your collar, underarms, and the back of your shirt immediately after parking — before the odor compounds oxidise and set into the fibre. Carrying a pocket-sized spray like <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> means you can reset at the office lift before anyone notices."
    ),
    "confidence-spray-pre-meeting-date": (
        "What spray should I use before an important meeting or date?",
        "Not perfume — that mixes with shirt odor and often makes it worse. A fabric odor neutraliser applied to your collar and underarm zone gives you a clean, odor-free baseline that fragrance can then sit on. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> is small enough for a pocket, fast-drying, and scent-free."
    ),
    "fix-shirt-odor-before-meeting": (
        "How do you fix shirt odor fast before a meeting?",
        "Mist a fabric odor spray on the worst zones — collar, underarms, hem — and let it dry for 60 seconds. Deodorant will not help because the odor is in the fabric, not on your skin. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> carries in a pocket and eliminates odor in under a minute."
    ),
    "gym-to-office-without-showering": (
        "Can you go from gym to office without showering and not smell?",
        "Yes, with the right prep: a fresh base layer, a wipe-down, and a fabric spray on your gym kit and office shirt before you change. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> neutralises sweat odor on both fabrics so the transition does not follow you into the lift."
    ),
    "hostel-clothes-smell-college-guide": (
        "Why do hostel clothes smell and how do you fix it?",
        "The main culprits are inadequate drying (damp cotton develops mildew smell fast), machine wash residue, and rewearing without airing. A fabric odor spray bridges the gap between washes and stops the smell from building up. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> costs ₹229 and covers a full semester of fixes."
    ),
    "how-to-not-smell-sweaty-at-work": (
        "How do you avoid smelling sweaty at work during an 11-hour day?",
        "Layer your defence: antiperspirant on skin before you leave, a fabric spray on collar and underarms when you arrive, and a midday reset if needed. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> fits in your desk drawer or bag and covers the afternoon hours that deodorant alone cannot."
    ),
    "indian-summer-sweat-smell-guide": (
        "How do you deal with sweat smell in Indian summer heat?",
        "At 40°C, cotton saturates in minutes and polyester is a trap. The most effective strategy: wear natural fibres when possible, change the zones that sweat most, and use a zinc-based fabric spray to neutralise what builds up rather than piling on fragrance. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> is pocket-sized and works in under 10 seconds."
    ),
    "is-zinc-ricinoleate-safe-for-clothes": (
        "Is zinc ricinoleate safe to spray on clothes?",
        "Yes. Zinc ricinoleate is derived from castor oil and is approved for cosmetic and fabric applications. It is colorless, non-staining, and leaves no residue on fabric. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> uses it as its primary odor-neutralising ingredient — safe on cotton, polyester, and blends."
    ),
    "keep-gym-clothes-fresh-in-bag": (
        "How do you keep gym clothes from smelling in your bag?",
        "The worst thing is sealing sweaty kit in a plastic bag — that creates a warm, airless environment where bacteria multiply fast. Use a mesh bag, spray fabric odor neutraliser after use, and air-dry before packing if possible. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> fits in your gym bag and takes 10 seconds to apply."
    ),
    "mumbai-humidity-sweat-smell-survival-guide": (
        "How do you stop clothes smelling in Mumbai's humidity?",
        "At 90%+ humidity sweat does not evaporate — it stays in your shirt and bacteria go to work immediately. The effective fix is a fabric odor spray with a neutralising active applied before you step out, giving you a window before the humidity defeats it. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> is the pocket-sized answer."
    ),
    "odorstrike-review-30-day-india-test": (
        "Does ODORSTRIKE actually work?",
        "After 30 days of testing across cotton and polyester shirts in Indian conditions, the result is yes — particularly on fresh and same-day odor. The zinc-based formula neutralises odor compounds before they set into the fibre, which is why it works where fragrance sprays do not. Read the full breakdown below."
    ),
    "odorstrike-vs-febreze-india": (
        "Which is better for Indian clothes — ODORSTRIKE or Febreze?",
        "Febreze is designed for home fabrics (sofas, curtains) and relies on masking fragrance. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> is designed for wearable fabric in the pocket-carry format that Indian commuters need. For fixing a shirt smell mid-day on a bike or in the office, ODORSTRIKE wins on format, price (₹229), and actives."
    ),
    "office-ac-trap-why-rewear-shirts-smell-worse": (
        "Why do re-worn shirts smell worse in AC offices?",
        "Office AC pulls moisture from the air and from your shirt, but concentrates the bacterial odor compounds already in the fabric rather than removing them. A shirt that smelled fine at home gets noticeably worse by 3pm. The fix is neutralising those compounds with <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> before they get the chance to concentrate."
    ),
    "perfume-plus-sweat-chemical-reaction": (
        "Why does perfume mixed with sweat sometimes smell worse?",
        "Perfume molecules react with butyric acid and isovaleric acid compounds in sweat, producing secondary compounds that smell different — and often worse — than either alone. The fix is neutralising the sweat odor first with a fabric spray, then applying fragrance on a clean base. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> gives you that clean baseline."
    ),
    "spray-to-remove-sweat-smell-from-clothes-instantly": (
        "Is there a spray that removes sweat smell from clothes instantly?",
        "Yes — fabric odor sprays with neutralising actives like Zinc PCA work in under 10 seconds on fresh sweat odor. They chemically bind to the odor molecules in the fabric rather than covering them with fragrance. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> is pocket-sized, fast-drying, and effective on Indian polyester and cotton."
    ),
    "why-i-built-odorstrike": (
        "Why was ODORSTRIKE built?",
        "Because deodorant does not fix shirt odor — it never did. ODORSTRIKE was built to solve the specific problem of fabric odor that builds up through an Indian workday: commute sweat, office AC, and the rewearing cycle that millions of people navigate every day. It is a dedicated fabric spray, not a body product repurposed for clothes."
    ),
    "why-indian-men-sweat-smell-more": (
        "Why do Indian men smell of sweat more?",
        "The biology is not unique — it is the conditions. India's climate, dietary patterns (spices metabolise through sweat glands), and commute density create a higher odor load than most countries. The fix is not to sweat less — it is to neutralise the odor compounds on fabric before they build up. <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> is designed for exactly this."
    ),
    "zinc-ricinoleate-fabric-odor-ingredient": (
        "What is zinc ricinoleate and how does it kill fabric odor?",
        "Zinc ricinoleate is a zinc salt derived from castor oil. It forms a complex with odor-causing compounds (mainly butyric acid and isovaleric acid from sweat) and binds them so they can no longer reach your olfactory receptors. It is the primary active in <a href=\"/#buy\" class=\"inline-cta\">ODORSTRIKE</a> — elimination, not masking."
    ),
}

ORG_TO_PERSON_FILES = {
    "best-fabric-odor-spray-india-2026-body-odor.html",
    "clothes-smell-after-washing.html",
    "is-zinc-ricinoleate-safe-for-clothes.html",
    "keep-gym-clothes-fresh-in-bag.html",
    "odorstrike-vs-febreze-india.html",
    "remove-sweat-smell-shirts-without-washing.html",
}

PERSON_AUTHOR = '''"author": {
    "@type": "Person",
    "name": "Brainee",
    "url": "https://www.smelloff.in/blog/why-i-built-odorstrike",
    "jobTitle": "Founder",
    "worksFor": {"@type": "Organization", "name": "Smelloff"}
  }'''


def fix_author_org_to_person(html):
    return re.sub(
        r'"author"\s*:\s*\{\s*"@type"\s*:\s*"Organization"\s*,\s*"name"\s*:\s*"Smelloff"\s*(?:,\s*"url"\s*:\s*"[^"]*"\s*)?\}',
        PERSON_AUTHOR,
        html
    )


def fix_non_www_urls(html):
    html = html.replace('"https://smelloff.in/', '"https://www.smelloff.in/')
    html = html.replace("'https://smelloff.in/", "'https://www.smelloff.in/")
    html = html.replace('href="https://smelloff.in/', 'href="https://www.smelloff.in/')
    html = html.replace('content="https://smelloff.in/', 'content="https://www.smelloff.in/')
    html = html.replace('"https://smelloff.in"', '"https://www.smelloff.in"')
    html = html.replace('href="https://smelloff.in"', 'href="https://www.smelloff.in"')
    return html


def add_speakable_to_head(html):
    if 'SpeakableSpecification' in html:
        return html
    return html.replace('</head>', SPEAKABLE_BLOCK + '\n</head>', 1)


def build_qa_div(slug):
    question, answer_html = QA_CONTENT[slug]
    content = f'<strong style="color:var(--text)">{question}</strong> {answer_html}'
    return QA_TEMPLATE.format(content=content)


def insert_quick_answer(html, slug):
    if 'class="quick-answer"' in html:
        return html
    qa_div = build_qa_div(slug)
    if '<article class="article-wrap">' in html:
        if '</header>\n' in html:
            html = html.replace('</header>\n', '</header>\n\n' + qa_div + '\n', 1)
        else:
            html = html.replace('</header>', '</header>\n\n' + qa_div, 1)
        return html
    # Older container/bare article: insert after subtitle or h1
    if '<div class="subtitle">' in html:
        html = re.sub(
            r'(<div class="subtitle">.*?</div>)\n',
            r'\1\n\n' + qa_div.replace('\\', '\\\\') + '\n',
            html, count=1, flags=re.DOTALL
        )
    else:
        html = re.sub(r'(</h1>)\n', r'\1\n\n' + qa_div.replace('\\', '\\\\') + '\n', html, count=1)
    return html


def add_article_schema_to_fix_shirt(html):
    if '"@type":"Article"' in html or '"@type": "Article"' in html:
        return html
    article_schema = '''\n<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Fix Shirt Odor Fast Before a Meeting",
  "description": "60-second tactical fix for shirt odor when you have no time to change or shower before a meeting.",
  "author": {
    "@type": "Person",
    "name": "Brainee",
    "url": "https://www.smelloff.in/blog/why-i-built-odorstrike",
    "jobTitle": "Founder",
    "worksFor": {"@type": "Organization", "name": "Smelloff"}
  },
  "publisher": {
    "@type": "Organization",
    "name": "Smelloff",
    "logo": {"@type": "ImageObject", "url": "https://www.smelloff.in/apple-touch-icon.png"}
  },
  "datePublished": "2026-04-24",
  "dateModified": "2026-06-10",
  "wordCount": 1131,
  "mainEntityOfPage": "https://www.smelloff.in/blog/fix-shirt-odor-before-meeting",
  "image": "https://www.smelloff.in/blog/assets/fix-shirt-odor-before-meeting.png"
}
</script>'''
    return html.replace('</head>', article_schema + '\n</head>', 1)


def add_word_count(html, slug):
    if '"wordCount"' in html:
        return html
    # Count words from article body
    m = re.search(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
    text = m.group(1) if m else html
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&[a-z]+;', ' ', text)
    wc = len(text.split())
    html = re.sub(
        r'("mainEntityOfPage")',
        '"wordCount": ' + str(wc) + ',\n  \\1',
        html, count=1
    )
    return html


def process_blog_file(path):
    slug = path.stem
    html = path.read_text(encoding='utf-8')
    original = html

    html = fix_non_www_urls(html)

    if path.name in ORG_TO_PERSON_FILES:
        html = fix_author_org_to_person(html)

    if slug == 'fix-shirt-odor-before-meeting':
        html = add_article_schema_to_fix_shirt(html)

    if slug in QA_CONTENT:
        html = add_speakable_to_head(html)
        html = insert_quick_answer(html, slug)

    html = add_word_count(html, slug)

    if html != original:
        path.write_text(html, encoding='utf-8')
        return True
    return False


def fix_root_files():
    changed = []
    # Fix robots.txt
    rt = ROOT / 'robots.txt'
    content = rt.read_text()
    new = content.replace('Sitemap: https://smelloff.in/sitemap.xml',
                          'Sitemap: https://www.smelloff.in/sitemap.xml')
    if new != content:
        rt.write_text(new)
        changed.append('robots.txt')

    # Fix all HTML and XML in root
    for fname in ['index.html', 'shipping.html', 'returns.html', 'refund.html',
                  'privacy.html', 'terms.html', 'payment-failed.html', 'sitemap.xml']:
        p = ROOT / fname
        if not p.exists():
            continue
        txt = p.read_text(encoding='utf-8')
        new = fix_non_www_urls(txt)
        if new != txt:
            p.write_text(new, encoding='utf-8')
            changed.append(fname)

    # Fix blog/index.html
    bi = BLOG / 'index.html'
    if bi.exists():
        txt = bi.read_text(encoding='utf-8')
        new = fix_non_www_urls(txt)
        if new != txt:
            bi.write_text(new, encoding='utf-8')
            changed.append('blog/index.html')

    return changed


def main():
    root_changed = fix_root_files()
    for f in root_changed:
        print(f"  fixed root: {f}")

    blog_changed = []
    for path in sorted(BLOG.glob("*.html")):
        if path.name == 'index.html':
            continue
        if process_blog_file(path):
            blog_changed.append(path.name)
            print(f"  updated: {path.name}")

    print(f"\nRoot files fixed: {len(root_changed)}, Blog files updated: {len(blog_changed)}")


if __name__ == "__main__":
    main()
