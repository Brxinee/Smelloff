"""Generate branded fallback assets:
  - /assets/og-image.jpg  (1200x630, brand colours + headline)
  - /assets/odorstrike-bottle.png (800x800, simple bottle silhouette)

These are placeholders intended to keep social previews and Product
schema working until real product photography is uploaded.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)

BLACK = (8, 8, 8)
ACID = (184, 255, 87)
OFF_WHITE = (237, 234, 224)
GREY = (138, 138, 133)


def find_font(weight="bold", size=120):
    """Try common system fonts in priority order."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVu-Sans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            try:
                return ImageFont.truetype(c, size)
            except OSError:
                continue
    return ImageFont.load_default()


def text_w(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def make_og_image():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BLACK)
    draw = ImageDraw.Draw(img)

    # Acid-green corner accent (top-left thin strip, bottom-right large)
    draw.rectangle([(0, 0), (W, 8)], fill=ACID)

    # Brand label top
    label_font = find_font(size=22)
    draw.text((60, 56), "SMELLOFF", font=label_font, fill=ACID)
    lw, _ = text_w(draw, "SMELLOFF", label_font)
    draw.ellipse([(60 + lw + 6, 60), (60 + lw + 16, 70)], fill=ACID)

    # Big brand line
    headline_font = find_font(size=110)
    draw.text((60, 180), "ODORSTRIKE", font=headline_font, fill=OFF_WHITE)

    # Tagline
    tag_font = find_font(size=46)
    draw.text((60, 320), "Pocket fabric odor killer", font=tag_font, fill=OFF_WHITE)
    draw.text((60, 372), "for clothes — anytime, anywhere.", font=tag_font, fill=OFF_WHITE)

    # Spec line
    spec_font = find_font(size=24)
    draw.text((60, 470), "50ml · ₹229 · COD pan-India · smelloff.in",
              font=spec_font, fill=GREY)

    # Acid-green divider
    draw.rectangle([(60, 530), (260, 533)], fill=ACID)

    # Tag pill bottom-right
    tag_pill_font = find_font(size=22)
    pill_text = "Made in Hyderabad"
    pw, ph = text_w(draw, pill_text, tag_pill_font)
    pad = 16
    px2, py2 = W - 60, H - 60
    px1, py1 = px2 - pw - pad * 2, py2 - ph - pad
    draw.rounded_rectangle([(px1, py1), (px2, py2)], radius=24, outline=ACID, width=2)
    draw.text((px1 + pad, py1 + pad // 2 - 2), pill_text, font=tag_pill_font, fill=ACID)

    out = ASSETS / "og-image.jpg"
    img.save(out, "JPEG", quality=88, optimize=True)
    print(f"wrote {out.relative_to(REPO)} ({W}x{H})")


def make_bottle_image():
    """Stylised bottle silhouette over brand colour. Fallback for Product schema."""
    W, H = 800, 800
    img = Image.new("RGB", (W, H), BLACK)
    draw = ImageDraw.Draw(img)

    # Centred bottle silhouette
    cx = W // 2
    # Cap
    cap_w, cap_h = 110, 70
    draw.rounded_rectangle([(cx - cap_w // 2, 200), (cx + cap_w // 2, 200 + cap_h)],
                            radius=10, fill=ACID)
    # Neck
    neck_w, neck_h = 80, 40
    draw.rectangle([(cx - neck_w // 2, 270), (cx + neck_w // 2, 270 + neck_h)],
                    fill=ACID)
    # Body
    body_top = 310
    body_bottom = 640
    body_w = 280
    draw.rounded_rectangle([(cx - body_w // 2, body_top),
                            (cx + body_w // 2, body_bottom)],
                            radius=24, fill=OFF_WHITE)
    # Label band
    label_top = 410
    label_bottom = 540
    draw.rectangle([(cx - body_w // 2 + 4, label_top),
                    (cx + body_w // 2 - 4, label_bottom)],
                    fill=BLACK)

    # ODORSTRIKE wordmark on label
    label_font = find_font(size=30)
    word = "ODORSTRIKE"
    ww, wh = text_w(draw, word, label_font)
    draw.text((cx - ww // 2, label_top + (label_bottom - label_top) // 2 - wh // 2 - 6),
              word, font=label_font, fill=ACID)
    # Volume sub-label
    vol_font = find_font(size=18)
    vol = "50ml · Fabric Odor Eliminator"
    vw, vh = text_w(draw, vol, vol_font)
    draw.text((cx - vw // 2, label_bottom - 26), vol, font=vol_font, fill=OFF_WHITE)

    # Brand mark top-left
    brand_font = find_font(size=22)
    draw.text((40, 40), "SMELLOFF", font=brand_font, fill=ACID)

    out = ASSETS / "odorstrike-bottle.png"
    img.save(out, "PNG", optimize=True)
    print(f"wrote {out.relative_to(REPO)} ({W}x{H})")


if __name__ == "__main__":
    make_og_image()
    make_bottle_image()
