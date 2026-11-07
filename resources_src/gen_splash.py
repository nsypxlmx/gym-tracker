"""Generate the launch screens for the installed app (PWA).

Android/Chrome builds its own splash from manifest.json (name +
background_color + the 512 icon), so nothing is needed there. iOS Safari
does NOT: without `apple-touch-startup-image` links it shows a blank white
screen while the app boots, and each image is only used when its media
query matches the device exactly — hence the table below.

Run: python3 resources_src/gen_splash.py
Writes splash/*.png plus splash/links.html (the <link> block to paste into
index.html, kept generated so the media queries can never drift from the
files that actually exist).
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import re

BG = (11, 11, 12, 255)        # --bg
MINT = (242, 242, 236, 255)   # --txt
MUTED = (142, 142, 136, 255)  # --muted
LOGO = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logo.svg")


def logo_pixels():
    """logo.svg is 32x20 pixel art written as 1x1 rects per fill: read it back as an image."""
    svg = open(LOGO).read()
    img = Image.new("RGBA", (32, 20), (0, 0, 0, 0))
    for fill, d in re.findall(r'<path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"', svg):
        rgb = tuple(int(fill[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
        for x, y in re.findall(r"M(\d+) (\d+)h1v1h-1z", d):
            img.putpixel((int(x), int(y)), rgb)
    return img

FONT = os.path.expanduser("~/.local/share/fonts/JetBrainsMono-VariableFont_wght.ttf")

# (css_width, css_height, device_pixel_ratio, label) — portrait only, the
# manifest locks orientation to portrait.
DEVICES = [
    (320, 568, 2, "iphone-se1"),
    (375, 667, 2, "iphone-8-se2"),
    (414, 736, 3, "iphone-8-plus"),
    (375, 812, 3, "iphone-x-12mini"),
    (414, 896, 2, "iphone-xr-11"),
    (414, 896, 3, "iphone-xsmax-11promax"),
    (390, 844, 3, "iphone-12-13-14"),
    (428, 926, 3, "iphone-12promax-14plus"),
    (393, 852, 3, "iphone-14pro-15-16"),
    (430, 932, 3, "iphone-15plus-16plus"),
    (402, 874, 3, "iphone-16pro"),
    (440, 956, 3, "iphone-16promax"),
    (768, 1024, 2, "ipad-mini-97"),
    (810, 1080, 2, "ipad-102"),
    (820, 1180, 2, "ipad-air-109"),
    (834, 1112, 2, "ipad-pro-105"),
    (834, 1194, 2, "ipad-pro-11"),
    (1024, 1366, 2, "ipad-pro-129"),
]


def load_font(px, weight=700):
    f = ImageFont.truetype(FONT, px)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass  # static fallback: variable axes unsupported by this FreeType
    return f


def centered_text(draw, text, font, cy, width, fill):
    box = draw.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text((width / 2 - w / 2 - box[0], cy - h / 2 - box[1]), text, font=font, fill=fill)
    return h


def compose(w, h):
    canvas = Image.new("RGBA", (w, h), BG)
    short = min(w, h)

    # the pixel-art logo, scaled by a whole number so every pixel stays square,
    # sitting above centre so the wordmark below reads as one block
    g = int(short * 0.46)
    s = max(1, g // 32)
    logo = logo_pixels().resize((32 * s, 20 * s), Image.NEAREST)
    gx, gy = int(w / 2 - 16 * s), int(h * 0.42 - 10 * s)
    canvas.alpha_composite(logo, (gx, gy))

    d = ImageDraw.Draw(canvas)
    # the text hangs from the logo's real bottom edge (the logo is wider than tall)
    base = gy + 20 * s
    centered_text(d, "TRCK3R", load_font(int(short * 0.072), 700), base + short * 0.075, w, MINT)
    centered_text(d, "// cargando", load_font(int(short * 0.040), 400), base + short * 0.15, w, MUTED)

    # flat art: a small palette keeps 18 launch screens at a few KB each
    return canvas.convert("RGB").quantize(colors=64, method=Image.MEDIANCUT)


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, "splash")
    os.makedirs(out, exist_ok=True)

    links = []
    for cw, ch, r, label in DEVICES:
        name = f"splash-{cw}x{ch}@{r}x.png"
        compose(cw * r, ch * r).save(os.path.join(out, name), optimize=True)
        links.append(
            f'<link rel="apple-touch-startup-image" href="splash/{name}" '
            f'media="(device-width:{cw}px) and (device-height:{ch}px) and '
            f'(-webkit-device-pixel-ratio:{r}) and (orientation:portrait)">'
        )
        print(f"{name}  ({label})")

    with open(os.path.join(out, "links.html"), "w") as f:
        f.write("\n".join(links) + "\n")
    print(f"\n{len(links)} launch screens + splash/links.html")
