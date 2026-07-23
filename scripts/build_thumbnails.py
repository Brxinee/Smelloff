#!/usr/bin/env python3
"""
Generate branded "tweet-card" thumbnails for every blog post.

Each thumbnail is a fixed 1200x630 card in the Smelloff identity:
  - dark #080808 textured backdrop + acid-green (#B8FF57) glow
  - a stylised tweet from @smelloffindia (Smelloff logo avatar, verified tick)
  - a Barlow Condensed 900 headline with an acid-green highlighter on the punch line
  - a rotating Smelloff mascot cut-out on the right

The HTML is rendered to PNG with headless Chromium, then written to BOTH files
each post references: the .webp (in-article hero + blog-index cards) and the
.png (og:image social preview). Headline + mascot pose per post live in HEAD below.

Run:  python3 scripts/build_thumbnails.py            # all posts
      python3 scripts/build_thumbnails.py <slug> ..  # only these slugs (preview)
Deps: Pillow, headless Chromium (path auto-detected or $CHROME).
"""
import os, re, sys, glob, subprocess, tempfile, hashlib
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
FONTS = REPO / "assets" / "fonts"
MASC = REPO / "assets" / "mascots"
LOGO = REPO / "assets" / "brand" / "icon-smelloff.png"

CHROME = os.environ.get("CHROME") or next(
    (p for p in [
        "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
    ] if Path(p).exists()),
    None,
)

# pose -> (mascot height px, right offset px) inside the 1200x630 stage
POSE = {
    "shush":   (648, -232),
    "cool":    (566, -140),
    "think":   (624, -205),
    "sweat":   (622, -210),
    "present": (600, -150),
    "shrug":   (566, -172),
}

# slug -> (top line [white], highlight [acid], pose)
HEAD = {
 "alternative-to-deodorant-for-clothes-smell": ("Skip Deodorant.", "Spray The Shirt", "shrug"),
 "ambi-pur-vs-odorstrike": ("Ambi Pur vs Us:", "No Contest", "cool"),
 "bangalore-office-sweat-smell-guide": ("Bangalore Office:", "Beat The Sweat", "sweat"),
 "best-deodorant-spray-for-clothes-not-skin": ("5 Clothes Sprays,", "Ranked", "think"),
 "best-fabric-odor-spray-india-2026-body-odor": ("India's Best", "Odor Spray", "cool"),
 "beta-cyclodextrin-odor-removal-science": ("The Molecule That", "Traps Odor", "think"),
 "bike-rider-sweat-smell-india": ("20-Min Ride,", "Sweaty Shirt", "sweat"),
 "can-fabric-spray-replace-dry-cleaning": ("Skip The", "Dry Cleaner?", "shrug"),
 "confidence-spray-pre-meeting-date": ("Before The Date:", "Smell Ready", "cool"),
 "cotton-vs-polyester-which-smells-worse": ("Cotton vs Poly:", "Who Stinks?", "shrug"),
 "cricket-jersey-smell-how-to-fix": ("Match Over.", "Kill The Stink", "present"),
 "deodorant-vs-fabric-mist": ("Deo vs Mist:", "What Wins", "shrug"),
 "does-febreze-work-on-sweat-smell-clothes": ("Febreze On Sweat:", "Does It Work?", "think"),
 "dri-fit-shirts-smell": ("Why Dri-Fit", "Smells Fast", "sweat"),
 "fix-shirt-odor-before-meeting": ("Don't Wash It:", "Kill The Smell", "shush"),
 "gym-clothes-smell-after-washing": ("Washed But", "Still Stinks?", "sweat"),
 "gym-to-office-without-showering": ("Gym To Office,", "No Shower", "cool"),
 "hostel-clothes-smell-college-guide": ("Hostel Life:", "Fresh Clothes", "present"),
 "how-long-does-fabric-spray-last-on-clothes": ("One Spray:", "How Long?", "think"),
 "how-to-keep-cotton-kurtas-fresh": ("Cotton Kurtas,", "Stay Fresh", "present"),
 "how-to-not-smell-sweaty-at-work": ("11-Hour Day,", "Zero Sweat", "cool"),
 "how-to-remove-cooking-smell-from-clothes": ("Curry Smell?", "Gone", "present"),
 "how-to-remove-musty-smell-from-clothes-monsoon": ("Monsoon Musty:", "Fixed Fast", "sweat"),
 "how-to-remove-smell-from-formal-trousers": ("Formal Trousers,", "No Dry Clean", "present"),
 "how-to-remove-smell-from-hoodies-sweatshirts": ("Hoodie Funk?", "Spray It Out", "present"),
 "how-to-remove-smell-from-jeans-without-washing": ("Never Wash Jeans:", "Just Spray", "shush"),
 "how-to-remove-smell-from-winter-jackets-sweaters": ("Winter Layers,", "Fresh Again", "present"),
 "hpbcd-cyclodextrin-fabric-odor": ("The Cage That", "Traps Odor", "think"),
 "indian-summer-sweat-smell-guide": ("40C Survival:", "Beat The Smell", "sweat"),
 "keep-gym-clothes-fresh-in-bag": ("Gym Bag Funk?", "Kill It", "present"),
 "monsoon-damp-clothes-smell": ("Nothing Dries?", "Still Fresh", "sweat"),
 "mumbai-humidity-sweat-smell-survival-guide": ("Mumbai Humidity:", "Survive It", "sweat"),
 "odorstrike-review-30-day-india-test": ("30 Days, 4 Shirts:", "Real Results", "cool"),
 "odorstrike-vs-febreze-india": ("Us vs Febreze:", "Who Wins?", "cool"),
 "office-ac-trap-why-rewear-shirts-smell-worse": ("The AC Trap:", "Why It Reeks", "think"),
 "perfume-plus-sweat-chemical-reaction": ("Perfume + Sweat", "= Worse", "think"),
 "remove-sweat-smell-shirts-without-washing": ("No Washing:", "No Smell", "shush"),
 "rewear-clothes-without-smelling": ("Re-Wear It.", "Don't Re-Wash", "cool"),
 "sherwani-bandhgala-smell-before-wedding": ("Before The Wedding:", "Smell Fresh", "present"),
 "shoes-sports-gear-odor": ("Shoes & Gear:", "Kill The Reek", "present"),
 "smoke-smell-clothes": ("Smoke & Agarbatti:", "Cleared", "present"),
 "spray-to-remove-sweat-smell-from-clothes-instantly": ("Sweat Smell Gone", "In 10 Seconds", "cool"),
 "travel-clothes-smell-india-guide": ("Travel Light:", "Stay Fresh", "present"),
 "what-is-fabric-odor-eliminator": ("Fabric Odor", "Eliminator 101", "think"),
 "why-deodorant-stops-working-after-3-hours": ("Deo Dies At", "Hour 3", "sweat"),
 "why-i-built-odorstrike": ("Why I Built", "ODORSTRIKE", "cool"),
 "why-indian-men-sweat-smell-more": ("It's Not Hygiene:", "Here's Why", "think"),
 "zinc-pca-fabric-odor-ingredient-guide": ("Zinc PCA:", "The Odor Killer", "think"),
}

TICK = ('<svg class="tick" viewBox="0 0 24 24"><path fill="#1d9bf0" d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 4 3.818 4 .47 0 .92-.086 1.336-.25.62 1.334 1.926 2.25 3.437 2.25s2.818-.916 3.437-2.25c.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.494-.083-.964-.237-1.4 1.272-.65 2.147-2.018 2.147-3.598z"/><path fill="#fff" d="m9.865 15.978-3.42-3.42 1.415-1.413 1.955 1.955 4.955-5.02 1.42 1.404z"/></svg>')

def f(p): return "file://" + str(p)

def html_for(top, hl, pose):
    ph, pr = POSE[pose]
    # auto-fit: shrink the headline so the longer line never wraps (inner width ~560px)
    maxlen = max(len(top), len(hl))
    font = max(56, min(94, int(560 / (maxlen * 0.46))))
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:'Barlow Condensed';font-weight:900;src:url('{f(FONTS/"barlow-condensed-normal-latin-900.woff2")}') format('woff2')}}
@font-face{{font-family:'Inter Tight';font-weight:400;src:url('{f(FONTS/"inter-tight-normal-latin-400.woff2")}') format('woff2')}}
@font-face{{font-family:'JetBrains Mono';font-weight:400;src:url('{f(FONTS/"jetbrains-mono-normal-latin-400.woff2")}') format('woff2')}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1200px;height:630px;overflow:hidden;background:#080808}}
.stage{{position:relative;width:1200px;height:630px;background:#080808;overflow:hidden;font-family:'Inter Tight',sans-serif}}
.stage::before{{content:'';position:absolute;inset:0;background:
   radial-gradient(120% 90% at 80% 42%, rgba(184,255,87,.12), transparent 55%),
   radial-gradient(75% 80% at 16% 22%, rgba(255,255,255,.04), transparent 60%),
   radial-gradient(140% 120% at 50% 122%, rgba(0,0,0,.62), transparent 60%)}}
.stage::after{{content:'';position:absolute;inset:0;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}}
.card{{position:absolute;left:60px;top:92px;width:660px;background:#fff;border-radius:22px;padding:32px 38px 28px;box-shadow:0 30px 70px rgba(0,0,0,.55);z-index:3}}
.head{{display:flex;align-items:center;gap:14px;margin-bottom:20px}}
.avatar{{width:60px;height:60px;border-radius:50%;flex:none;object-fit:cover;display:block}}
.name{{display:flex;align-items:center;gap:7px;font-weight:700;font-size:24px;color:#0f1419;letter-spacing:-.01em}}
.tick{{width:22px;height:22px;flex:none}}
.handle{{font-size:18px;color:#536471;margin-top:1px}}
.tweet{{font-family:'Barlow Condensed';font-weight:900;line-height:.95;color:#0f1419;letter-spacing:-.01em}}
.hl{{background:#B8FF57;box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:2px 10px;border-radius:6px;color:#080808}}
.time{{margin-top:24px;font-size:17px;color:#536471;font-family:'JetBrains Mono';letter-spacing:.02em}}
.person{{position:absolute;right:{pr}px;bottom:-14px;height:{ph}px;z-index:2;filter:drop-shadow(0 10px 30px rgba(0,0,0,.55)) drop-shadow(0 0 46px rgba(184,255,87,.15))}}
</style></head><body><div class="stage">
  <div class="card">
    <div class="head"><img class="avatar" src="{f(LOGO)}" alt="">
      <div><div class="name">Smelloff {TICK}</div><div class="handle">@smelloffindia</div></div></div>
    <div class="tweet" style="font-size:{font}px">{top}<br><span class="hl">{hl}</span></div>
    <div class="time">smelloff.in &middot; ODORSTRIKE &middot; &#8377;229</div>
  </div>
  <img class="person" src="{f(MASC/(pose+'.png'))}" alt="">
</div></body></html>"""

def render_png(html, out_png):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as t:
        t.write(html); tmp = t.name
    subprocess.run([CHROME, "--headless=new", "--no-sandbox", "--hide-scrollbars",
        "--force-device-scale-factor=2", "--window-size=1200,630",
        f"--screenshot={out_png}", f"file://{tmp}"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.unlink(tmp)

def url_to_path(url):
    m = re.search(r'(/blog/assets/[^"?]+)', url)
    return (REPO / m.group(1).lstrip("/")) if m else None

def collect():
    """Every post gets its OWN-slug .webp + .png (the HTML is normalised to match,
    so no post borrows another's image)."""
    out = {}
    for fp in sorted(glob.glob(str(REPO / "blog" / "*.html"))):
        if fp.endswith("index.html"): continue
        slug = Path(fp).stem
        base = REPO / "blog" / "assets"
        out[slug] = {base / f"{slug}.webp", base / f"{slug}.png"}
    return out

def render_slug(slug):
    """Render one post's headline to a 1200x630 RGB image (cached by caller)."""
    top, hl, pose = HEAD[slug]
    png2x = str(REPO / "scripts" / f".thumb_{slug}.png")
    render_png(html_for(top, hl, pose), png2x)
    img = Image.open(png2x).convert("RGB").resize((1200, 630), Image.LANCZOS)
    os.unlink(png2x)
    return img

def main():
    if not CHROME: sys.exit("No Chromium found; set $CHROME")
    only = set(sys.argv[1:])
    posts = collect()
    n = 0
    for slug, targets in posts.items():
        if only and slug not in only: continue
        if slug not in HEAD:
            print("skip (no headline):", slug); continue
        img = render_slug(slug)
        for p in sorted(targets):
            p.parent.mkdir(parents=True, exist_ok=True)
            if p.suffix == ".webp": img.save(p, "WEBP", quality=90, method=6)
            else: img.save(p, "PNG", optimize=True)
        n += 1
        print(f"OK {slug:52s} {HEAD[slug][2]:8s}")
    print(f"\n{n} thumbnails generated.")

if __name__ == "__main__":
    main()
