"""
SEO audit fixer for blog posts and policy pages.
Fixes: lang attr, geo tags, og:image:alt, twitter:image/alt,
       hreflang, full robots meta, BreadcrumbList schema,
       Article schema image field, og:image broken URLs.
"""
import re
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BLOG_DIR = REPO / "blog"
SITE = "https://smelloff.in"
OG_IMAGE = f"{SITE}/assets/og-image.jpg"
LOGO_URL = f"{SITE}/apple-touch-icon.png"

GEO_TAGS = """<meta name="geo.region" content="IN-TG">
<meta name="geo.placename" content="Hyderabad">
<meta name="geo.position" content="17.3850;78.4867">
<meta name="ICBM" content="17.3850, 78.4867">"""

ROBOTS_META = 'content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1"'

def fix_html_file(path: Path, canonical_url: str, page_title: str, page_type: str = "blog") -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    # 1. Fix lang attribute
    text = re.sub(r'<html\s+lang=["\']en["\']', '<html lang="en-IN"', text)

    # 2. Fix og:image broken URLs (some posts use non-existent image paths)
    text = re.sub(
        r'<meta property="og:image" content="https://www\.smelloff\.in/(?!assets/og-image\.jpg)[^"]*"',
        f'<meta property="og:image" content="{OG_IMAGE}"',
        text
    )

    # 3. Fix robots meta — upgrade to full directive
    text = re.sub(
        r'<meta name="robots" content="[^"]*">',
        f'<meta name="robots" {ROBOTS_META}>',
        text
    )

    # 4. Add geo tags after robots meta if not present
    if 'geo.region' not in text:
        text = text.replace(
            f'<meta name="robots" {ROBOTS_META}>',
            f'<meta name="robots" {ROBOTS_META}>\n{GEO_TAGS}'
        )

    # 5. Add og:image:alt after og:image if not present
    if 'og:image:alt' not in text:
        text = re.sub(
            r'(<meta property="og:image" content="[^"]*">)',
            r'\1\n<meta property="og:image:alt" content="ODORSTRIKE fabric odor remover spray by Smelloff">',
            text
        )

    # 6. Add og:image:width + og:image:height if missing
    if 'og:image:width' not in text:
        text = re.sub(
            r'(<meta property="og:image:alt"[^>]*>)',
            r'\1\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">',
            text
        )

    # 7. Add og:locale if missing
    if 'og:locale' not in text:
        text = re.sub(
            r'(<meta property="og:site_name"[^>]*>)',
            r'\1\n<meta property="og:locale" content="en_IN">',
            text
        )

    # 8. Add twitter:image if missing
    if 'twitter:image' not in text:
        text = re.sub(
            r'(<meta name="twitter:description"[^>]*>)',
            r'\1\n<meta name="twitter:image" content="' + OG_IMAGE + '">',
            text
        )

    # 9. Add twitter:image:alt if missing
    if 'twitter:image:alt' not in text:
        text = re.sub(
            r'(<meta name="twitter:image" content="[^"]*">)',
            r'\1\n<meta name="twitter:image:alt" content="ODORSTRIKE fabric odor remover spray by Smelloff">',
            text
        )

    # 10. Add hreflang if missing
    if 'hreflang' not in text:
        hreflang = (
            f'<link rel="alternate" hreflang="en-IN" href="{canonical_url}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{canonical_url}">'
        )
        # Insert before closing </head>
        text = text.replace('</head>', f'{hreflang}\n</head>', 1)

    # 11. Fix Article schema: add image field if missing
    if '"@type": "Article"' in text or '"@type":"Article"' in text:
        # Add image to Article schema if not present
        if '"image":' not in text.split('"@type": "Article"', 1)[-1][:300] and \
           '"image":' not in text.split('"@type":"Article"', 1)[-1][:300]:
            text = re.sub(
                r'("datePublished":\s*"[^"]*")',
                f'"image": "{OG_IMAGE}",\n  \\1',
                text,
                count=1
            )

    # 12. Add BreadcrumbList if missing
    if 'BreadcrumbList' not in text:
        slug = path.stem
        breadcrumb_name = page_title.replace('"', '\\"')
        breadcrumb_json = f'''<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
  {{"@type":"ListItem","position":1,"name":"Home","item":"{SITE}/"}},
  {{"@type":"ListItem","position":2,"name":"Blog","item":"{SITE}/blog"}},
  {{"@type":"ListItem","position":3,"name":"{breadcrumb_name}","item":"{canonical_url}"}}
]}}
</script>'''
        # Insert before </head>
        text = text.replace('</head>', f'{breadcrumb_json}\n</head>', 1)

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def fix_policy_page(path: Path, canonical_url: str, page_title: str) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    # 1. Fix lang attribute
    text = re.sub(r'<html\s+lang=["\']en["\']', '<html lang="en-IN"', text)

    # 2. Fix robots meta
    text = re.sub(
        r'<meta name="robots" content="[^"]*">',
        f'<meta name="robots" {ROBOTS_META}>',
        text
    )

    # 3. Add geo tags if not present
    if 'geo.region' not in text:
        text = text.replace(
            f'<meta name="robots" {ROBOTS_META}>',
            f'<meta name="robots" {ROBOTS_META}>\n{GEO_TAGS}'
        )

    # 4. Add og:image:alt
    if 'og:image:alt' not in text and 'og:image' in text:
        text = re.sub(
            r'(<meta property="og:image" content="[^"]*">)',
            r'\1\n<meta property="og:image:alt" content="Smelloff — ODORSTRIKE fabric odor spray brand">',
            text
        )

    # 5. Add og:locale if missing
    if 'og:locale' not in text:
        text = re.sub(
            r'(<meta property="og:site_name"[^>]*>)',
            r'\1\n<meta property="og:locale" content="en_IN">',
            text
        )

    # 6. Add twitter:image if missing
    if 'twitter:image' not in text:
        text = re.sub(
            r'(<meta name="twitter:description"[^>]*>)',
            r'\1\n<meta name="twitter:image" content="' + OG_IMAGE + '">',
            text
        )

    # 7. Add hreflang if missing
    if 'hreflang' not in text:
        hreflang = (
            f'<link rel="alternate" hreflang="en-IN" href="{canonical_url}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{canonical_url}">'
        )
        text = text.replace('</head>', f'{hreflang}\n</head>', 1)

    # 8. Add WebPage schema if missing
    if 'WebPage' not in text:
        webpage_json = f'''<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"WebPage","name":"{page_title}","url":"{canonical_url}","inLanguage":"en-IN","isPartOf":{{"@type":"WebSite","name":"Smelloff","url":"{SITE}"}}}}
</script>'''
        text = text.replace('</head>', f'{webpage_json}\n</head>', 1)

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


# Blog posts
blog_posts = [
    ("alternative-to-deodorant-for-clothes-smell", "The Alternative to Deodorant for Clothes Smell"),
    ("best-body-odor-remover-spray-for-men-india", "Best Body Odor Remover Spray for Men in India"),
    ("best-deodorant-spray-for-clothes-not-skin", "Best Deodorant Spray for Clothes (Not Skin) in India"),
    ("best-fabric-odor-spray-india-2026-body-odor", "Best Fabric Odor Spray for Body Odor in India 2026"),
    ("best-fabric-odor-spray-india-2026", "Best Fabric Odor Spray in India 2026"),
    ("bike-rider-sweat-smell-india", "Bike Rider Sweat Smell India — Helmet, Jacket, Jersey Fix"),
    ("clothes-smell-after-washing", "Why Do My Clothes Smell Even After Washing?"),
    ("confidence-spray-pre-meeting-date", "The Confidence Spray — Pre-Meeting & Pre-Date Reset"),
    ("deodorant-vs-fabric-mist", "Deodorant vs Fabric Mist — What Actually Kills Odor"),
    ("fix-shirt-odor-before-meeting", "How to Fix Shirt Odor Fast Before a Meeting"),
    ("gym-clothes-smell-after-washing", "Why Gym Clothes Smell After Washing — The Real Reason"),
    ("gym-to-office-without-showering", "Gym to Office Without Showering — The 4-Minute Reset"),
    ("hostel-clothes-smell-college-guide", "Hostel & College Clothes Smell — The Survival Guide"),
    ("how-to-not-smell-sweaty-at-work", "How to Not Smell Sweaty at Work"),
    ("indian-summer-sweat-smell-guide", "Indian Summer Sweat Smell — The Heat & Humidity Playbook"),
    ("is-zinc-ricinoleate-safe-for-clothes", "Is Zinc PCA Safe for Clothes?"),
    ("keep-gym-clothes-fresh-in-bag", "How to Keep Gym Clothes Fresh in Your Bag"),
    ("mumbai-humidity-sweat-smell-survival-guide", "Mumbai Humidity Sweat Smell Survival Guide"),
    ("odorstrike-review-30-day-india-test", "ODORSTRIKE Review: 30 Days, 4 Shirts, Real Results"),
    ("odorstrike-vs-febreze-india", "ODORSTRIKE vs Febreze — Which Works Better on Indian Clothes"),
    ("office-ac-trap-why-rewear-shirts-smell-worse", "The Office AC Trap — Why Re-Worn Shirts Smell Worse"),
    ("perfume-plus-sweat-chemical-reaction", "Perfume + Sweat = A Chemical Reaction That Smells Worse"),
    ("remove-sweat-smell-shirts-without-washing", "How to Remove Sweat Smell from Shirts Without Washing"),
    ("spray-to-remove-sweat-smell-from-clothes-instantly", "The Spray That Removes Sweat Smell from Clothes Instantly"),
    ("where-to-buy-odorstrike-india", "Where to Buy ODORSTRIKE in India"),
    ("why-deodorant-stops-working-after-3-hours", "Why Deodorant Stops Working After 3 Hours"),
    ("why-i-built-odorstrike", "Why I Built ODORSTRIKE — Founder's Note"),
    ("why-indian-men-sweat-smell-more", "Why Indian Men Have Stronger Sweat Smell"),
    ("zinc-ricinoleate-fabric-odor-ingredient", "Zinc PCA — The Ingredient That Kills Fabric Odor"),
]

fixed_count = 0
for slug, title in blog_posts:
    path = BLOG_DIR / f"{slug}.html"
    if not path.exists():
        print(f"  MISSING: {slug}.html")
        continue
    canonical = f"{SITE}/blog/{slug}"
    changed = fix_html_file(path, canonical, title)
    status = "FIXED" if changed else "OK"
    print(f"  {status}: {slug}.html")
    if changed:
        fixed_count += 1

# Blog index
blog_index = BLOG_DIR / "index.html"
if blog_index.exists():
    text = blog_index.read_text(encoding="utf-8")
    original = text
    text = re.sub(r'<html\s+lang=["\']en["\']', '<html lang="en-IN"', text)
    text = re.sub(
        r'<meta name="robots" content="[^"]*">',
        f'<meta name="robots" {ROBOTS_META}>',
        text
    )
    if 'geo.region' not in text:
        text = text.replace(
            f'<meta name="robots" {ROBOTS_META}>',
            f'<meta name="robots" {ROBOTS_META}>\n{GEO_TAGS}'
        )
    if 'og:image:alt' not in text and 'og:image' in text:
        text = re.sub(
            r'(<meta property="og:image" content="[^"]*">)',
            r'\1\n<meta property="og:image:alt" content="Smelloff Blog — ODORSTRIKE fabric odor spray guides">',
            text
        )
    if 'og:locale' not in text:
        text = re.sub(
            r'(<meta property="og:site_name"[^>]*>)',
            r'\1\n<meta property="og:locale" content="en_IN">',
            text
        )
    if 'twitter:image' not in text:
        text = re.sub(
            r'(<meta name="twitter:description"[^>]*>)',
            r'\1\n<meta name="twitter:image" content="' + OG_IMAGE + '">',
            text
        )
    if 'twitter:image:alt' not in text and 'twitter:image' in text:
        text = re.sub(
            r'(<meta name="twitter:image" content="[^"]*">)',
            r'\1\n<meta name="twitter:image:alt" content="Smelloff Blog — fabric odor and sweat smell guides">',
            text
        )
    if 'hreflang' not in text:
        canonical = f"{SITE}/blog"
        hreflang = (
            f'<link rel="alternate" hreflang="en-IN" href="{canonical}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{canonical}">'
        )
        text = text.replace('</head>', f'{hreflang}\n</head>', 1)
    if text != original:
        blog_index.write_text(text, encoding="utf-8")
        print("  FIXED: blog/index.html")
        fixed_count += 1
    else:
        print("  OK: blog/index.html")

print(f"\nDone. Fixed {fixed_count} files.")

# Policy pages
policy_pages = [
    (REPO / "privacy.html", f"{SITE}/privacy", "Privacy Policy — Smelloff"),
    (REPO / "refund.html", f"{SITE}/refund", "Refund Policy — Smelloff"),
    (REPO / "returns.html", f"{SITE}/returns", "Returns Policy — Smelloff"),
    (REPO / "shipping.html", f"{SITE}/shipping", "Shipping Policy — Smelloff"),
    (REPO / "terms.html", f"{SITE}/terms", "Terms of Service — Smelloff"),
    (REPO / "payment-failed.html", f"{SITE}/payment-failed", "Payment Failed — Smelloff"),
]

print("\nFixing policy pages:")
for path, canonical, title in policy_pages:
    if not path.exists():
        print(f"  MISSING: {path.name}")
        continue
    changed = fix_policy_page(path, canonical, title)
    status = "FIXED" if changed else "OK"
    print(f"  {status}: {path.name}")
