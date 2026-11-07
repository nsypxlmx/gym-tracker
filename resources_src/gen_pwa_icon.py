"""Regenerate the PWA icon (neon-glow H/barbell glyph on black).

Fixes vs. the previous version:
- thicker, bolder glyph strokes so it still reads at 32-48px (browser tab,
  iOS home-screen thumbnail) instead of relying on a glow blur that
  disappears at small sizes
- separate maskable export with a real safe-zone margin and no border
  frame, since Android crops maskable icons to arbitrary shapes (circle,
  squircle) and a frame drawn close to the edge gets clipped unevenly
- drops the small corner dot from the old design — it read as noise once
  downsized and sat right where a circular mask crops first

Run: python3 resources_src/gen_pwa_icon.py
Writes icon-1024-master.png (kept for future re-exports) plus the actual
served icon-180/192/512.png and icon-512-maskable.png at repo root.
"""
from PIL import Image, ImageDraw, ImageFilter

BG = (5, 5, 5, 255)
GREEN = (0, 255, 136, 255)
MINT = (200, 245, 216, 255)

S = 1024  # master supersample size


def rounded_bar(draw, xy, radius, fill):
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def glyph_layer(size, bar_w, bar_h, gap, conn_ratio=0.42):
    """Draws the barbell glyph (two plates + a thin connecting bar) centered on a transparent layer."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = size / 2, size / 2
    # two vertical bars (the "plates"), one thin horizontal bar (the "handle")
    left_x0 = cx - gap / 2 - bar_w
    right_x0 = cx + gap / 2
    top = cy - bar_h / 2
    bottom = cy + bar_h / 2
    rounded_bar(d, [left_x0, top, left_x0 + bar_w, bottom], bar_w / 2, GREEN)
    rounded_bar(d, [right_x0, top, right_x0 + bar_w, bottom], bar_w / 2, GREEN)
    conn_h = bar_w * conn_ratio
    rounded_bar(d, [left_x0 + bar_w * 0.2, cy - conn_h / 2, right_x0 + bar_w * 0.8, cy + conn_h / 2], conn_h / 2, GREEN)
    return layer


def compose(border=True, bar_w=118, bar_h=440, gap=170, glow_blur=26, glow_alpha=150, conn_ratio=0.42):
    canvas = Image.new("RGBA", (S, S), BG)
    d = ImageDraw.Draw(canvas)

    if border:
        inset = int(S * 0.055)
        stroke = max(3, int(S * 0.012))
        d.rounded_rectangle([inset, inset, S - inset, S - inset], radius=int(S * 0.02), outline=MINT, width=stroke)

    glyph = glyph_layer(S, bar_w, bar_h, gap, conn_ratio)

    glow = glyph.filter(ImageFilter.GaussianBlur(glow_blur))
    glow_a = glow.split()[3].point(lambda a: min(255, int(a * glow_alpha / 255)))
    glow.putalpha(glow_a)
    canvas = Image.alpha_composite(canvas, glow)

    canvas = Image.alpha_composite(canvas, glyph)
    return canvas


if __name__ == "__main__":
    import os
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # "any" purpose master: has the border frame, bolder glyph, no corner dot
    master = compose(border=True, bar_w=118, bar_h=440, gap=170, glow_blur=26, glow_alpha=150)
    master.save(os.path.join(root, "icon-1024-master.png"))

    for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "icon-180.png")]:
        master.resize((size, size), Image.LANCZOS).save(os.path.join(root, name))

    # maskable: no border, glyph shrunk well inside the 80%-diameter safe circle
    maskable = compose(border=False, bar_w=96, bar_h=360, gap=140, glow_blur=22, glow_alpha=140)
    maskable.resize((512, 512), Image.LANCZOS).save(os.path.join(root, "icon-512-maskable.png"))

    # favicon: the border frame and the glow both turn to mush at 32px, so the
    # tab icon gets its own composition — no frame, no glow, fatter glyph
    fav = compose(border=False, bar_w=150, bar_h=560, gap=200, glow_blur=1, glow_alpha=0)
    fav.resize((32, 32), Image.LANCZOS).save(os.path.join(root, "icon-32.png"))

    print("done")
