"""Apply audit fixes:
- Pricing math copy: ₹149.50 → ₹199.50, ₹143 → ₹183, ₹1.80 → ₹2.29 (per-shirt-fresh)
- Publisher logo: /logo.png → /apple-touch-icon.png (real asset)
"""
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
TARGETS = list((REPO / "blog").glob("*.html")) + [REPO / "scripts" / "blog_data.py"]

SUBS = [
    # Pricing math
    ("₹149.50 and ₹143 respectively", "₹199.50 and ₹183 respectively"),
    ("₹149.50 per bottle", "₹199.50 per bottle"),
    ("₹149.50/bottle", "₹199.50/bottle"),
    ("at ₹143/bottle", "at ₹183/bottle"),
    ("at ₹143 — useful", "at ₹183 — useful"),
    ("Best per-bottle value at ₹143", "Best per-bottle value at ₹183"),
    ("value at ₹143.", "value at ₹183."),
    ("₹1.80 per fresh shirt", "₹2.29 per fresh shirt"),

    # Publisher logo path
    ('"url": "https://www.smelloff.in/logo.png"',
     '"url": "https://www.smelloff.in/apple-touch-icon.png"'),
    ('"url":"https://www.smelloff.in/logo.png"',
     '"url":"https://www.smelloff.in/apple-touch-icon.png"'),
]


def main():
    total = 0
    for path in TARGETS:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        original = text
        for old, new in SUBS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            print(f"  fixed {path.relative_to(REPO)}")
            total += 1
    print(f"\n{total} files updated")


if __name__ == "__main__":
    main()
