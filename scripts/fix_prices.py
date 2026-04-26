"""
Sync all blog + meta files with the canonical homepage pricing.

Canonical (from index.html):
  Solo (Starter Strike) 1×50ml: ₹229 launch / ₹579 MRP
  Duo  (Double Strike)  2×50ml: ₹399 launch / ₹999 MRP
  Trio (Triple Strike)  3×50ml: ₹549 launch / ₹1399 MRP
  Free shipping across India (NO ₹299 threshold)
  COD pan-India

This script does context-aware substitutions across blog/*.html, llms.txt,
and scripts/blog_data.py. ₹299 has two meanings (duo price OR shipping
threshold) and is handled by phrase first, then by remaining bare-number
substitution.
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TARGETS = list((REPO / "blog").glob("*.html")) + [REPO / "llms.txt", REPO / "scripts" / "blog_data.py"]

# Order matters: longer/more-specific phrases first
SUBS = [
    # Shipping-threshold phrases — replace before any ₹299 number sub
    ("Free shipping above ₹299", "Free shipping across India"),
    ("free shipping above ₹299", "free shipping across India"),
    ("free shipping on Duo and Trio packs", "free shipping across India"),
    ("Free shipping on Duo and Trio packs", "Free shipping across India"),
    (" above ₹299", " across India"),
    ("shipping above ₹299", "shipping across India"),

    # Pack-name + price phrases (longer first)
    ("Solo ₹179, Duo ₹299, Trio ₹429", "Solo ₹229, Duo ₹399, Trio ₹549"),
    ("Solo ₹179", "Solo ₹229"),
    ("Duo ₹299", "Duo ₹399"),
    ("Trio ₹429", "Trio ₹549"),
    ("Solo (50ml × 1) | ₹179 | ₹179", "Solo (50ml × 1) | ₹229 | ₹229"),
    ("Duo (50ml × 2) | ₹299 | ₹149.50", "Duo (50ml × 2) | ₹399 | ₹199.50"),
    ("Trio (50ml × 3) | ₹429 | ₹143", "Trio (50ml × 3) | ₹549 | ₹183"),

    # Per-bottle math callouts
    ("Duo at ₹299 brings per-bottle cost down to ₹149.50",
     "Duo at ₹399 brings per-bottle cost down to ₹199.50"),
    ("Trio at ₹429 to ₹143", "Trio at ₹549 to ₹183"),
    ("₹299 brings per-bottle cost down to ₹149.50",
     "₹399 brings per-bottle cost down to ₹199.50"),
    ("₹429 to ₹143", "₹549 to ₹183"),

    # Per-spray and per-shirt-fresh math (computed from ₹179/400 sprays)
    ("That's ₹0.45 per spray. For one shirt-fresh use (4 sprays), that's ₹1.80.",
     "That's ₹0.57 per spray. For one shirt-fresh use (4 sprays), that's ₹2.29."),
    ("at one shirt-fresh per ₹1.80", "at one shirt-fresh per ₹2.29"),
    ("Total daily cost: ~₹2.50.", "Total daily cost: ~₹4.58."),
    ("That's 50 days per bottle, or ~₹3.60 per day for the fabric layer.",
     "That's 50 days per bottle, or ~₹4.58 per day for the fabric layer."),

    # Pricing in callout tables — handle the table cells with HTML tags
    ("<td>Solo (50 ml × 1)</td><td>₹179</td><td>₹179</td>",
     "<td>Solo (50 ml × 1)</td><td>₹229</td><td>₹229</td>"),
    ("<td>Duo (50 ml × 2)</td><td>₹299</td><td>₹149.50</td>",
     "<td>Duo (50 ml × 2)</td><td>₹399</td><td>₹199.50</td>"),
    ("<td>Trio (50 ml × 3)</td><td>₹429</td><td>₹143</td>",
     "<td>Trio (50 ml × 3)</td><td>₹549</td><td>₹183</td>"),

    # JSON-LD offer prices (Product schema in where-to-buy + Review schema)
    ('"name": "Solo 50ml", "price": "179"',
     '"name": "Starter Strike (50ml × 1)", "price": "229"'),
    ('"name": "Duo 2x50ml", "price": "299"',
     '"name": "Double Strike (50ml × 2)", "price": "399"'),
    ('"name": "Trio 3x50ml", "price": "429"',
     '"name": "Triple Strike (50ml × 3)", "price": "549"'),
    ('"name": "Solo (50ml × 1)",\n      "price": "179"',
     '"name": "Starter Strike (50ml × 1)",\n      "price": "229"'),
    ('"name": "Duo (50ml × 2)",\n      "price": "299"',
     '"name": "Double Strike (50ml × 2)",\n      "price": "399"'),
    ('"name": "Trio (50ml × 3)",\n      "price": "429"',
     '"name": "Triple Strike (50ml × 3)",\n      "price": "549"'),
    ('"price": "179"', '"price": "229"'),

    # ODORSTRIKE-specific phrasings
    ("ODORSTRIKE 50 ml at ₹179 launch (₹249 standard)",
     "ODORSTRIKE 50 ml at ₹229 launch (₹579 MRP)"),
    ("ODORSTRIKE at ₹179 for 50ml", "ODORSTRIKE at ₹229 for 50ml"),
    ("ODORSTRIKE by Smelloff, at ₹179 for 50ml", "ODORSTRIKE by Smelloff, at ₹229 for 50ml"),
    ("Launch price: ₹179.", "Launch price: ₹229."),
    ("at ₹179 launch", "at ₹229 launch"),
    ("₹179 launch (₹249 standard)", "₹229 launch (₹579 MRP)"),
    ("₹179 launch", "₹229 launch"),

    # CTA labels
    ("BUY ₹179", "BUY ₹229"),
    ("Buy ₹179", "Buy ₹229"),
    ("Shop ₹179", "Shop ₹229"),
    ("ADD TO CART — ₹179", "ADD TO CART — ₹229"),
    ("Buy ODORSTRIKE — ₹179", "Buy ODORSTRIKE — ₹229"),
    ("Buy ODORSTRIKE ₹179", "Buy ODORSTRIKE ₹229"),
    ("Get ODORSTRIKE ₹179", "Get ODORSTRIKE ₹229"),

    # Strike-price element values (CTA blocks)
    ('<span class="strike-price">₹249</span>', '<span class="strike-price">₹579</span>'),
    ('<span class="current-price">₹179</span>', '<span class="current-price">₹229</span>'),
    ('<span class="price-strike">₹249</span><span class="price-live">₹179</span>',
     '<span class="price-strike">₹579</span><span class="price-live">₹229</span>'),
    ('<span class="price-old">₹249</span><strong style="color:#B8FF57">₹179',
     '<span class="price-old">₹579</span><strong style="color:#B8FF57">₹229'),

    # Generic remaining ₹179 → ₹229 (after all the more specific subs above)
    ("₹179", "₹229"),
    # Strike-price ₹249 → ₹579 (remaining after specific subs)
    ("₹249", "₹579"),
    # Trio price ₹429 → ₹549
    ("₹429", "₹549"),
    # Duo price ₹299 → ₹399 (must come AFTER all shipping-phrase subs above)
    ("₹299", "₹399"),
]


def process(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    original = text
    n_changes = 0
    for old, new in SUBS:
        if old in text:
            count = text.count(old)
            text = text.replace(old, new)
            n_changes += count
    if text != original:
        path.write_text(text, encoding="utf-8")
        return n_changes
    return 0


def main():
    total_files = 0
    total_changes = 0
    for p in TARGETS:
        if not p.exists():
            continue
        n = process(p)
        if n > 0:
            print(f"  {p.relative_to(REPO)}: {n} substitution(s)")
            total_files += 1
            total_changes += n
    print(f"\n{total_changes} substitutions across {total_files} files")


if __name__ == "__main__":
    main()
