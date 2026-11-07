"""Regenerate the Android launcher masters in resources/ from the PWA glyph.

Until now resources/ still held the original pixel-art dumbbell, so the app
icon on the phone did not match the icon the PWA shows everywhere else. This
reuses glyph_layer() from gen_pwa_icon.py so both stay in sync: change the
glyph there and re-run this.

Writes the three files @capacitor/assets consumes:
  resources/icon.png            legacy launcher icon, full bleed on #050505
  resources/icon-foreground.png adaptive foreground, transparent, safe-zoned
  resources/icon-background.png adaptive background, solid #0a0a0a

Then run: npx capacitor-assets generate --android

The foreground uses the conservative maskable geometry (glyph ~35% of the
canvas) because adaptive icons only guarantee the central 66% circle; the
launcher may crop to a circle, squircle or teardrop and anything outside
that is fair game.

Run: python3 resources_src/gen_android_icon.py
"""
import os

from PIL import Image

from gen_pwa_icon import BG, glyph_layer

S = 1024
ADAPTIVE_BG = (10, 10, 10, 255)  # #0a0a0a, a juego con background_color del manifest

# misma geometría que el master "any" del icono pwa, para que el icono del
# teléfono se vea igual que el de la web. la caja del glifo mide 406x440, con
# diagonal 598 px: entra en el círculo seguro del adaptive icon (66% de 1024 =
# 683 px) aunque el launcher recorte en círculo.
SAFE = dict(bar_w=118, bar_h=440, gap=170)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, "resources")
    os.makedirs(out, exist_ok=True)

    # legacy: sin marco, el recorte a círculo/squircle se lo comería desigual
    legacy = Image.alpha_composite(Image.new("RGBA", (S, S), BG), glyph_layer(S, **SAFE))
    legacy.save(os.path.join(out, "icon.png"))

    # adaptive foreground: solo el glifo, fondo transparente
    glyph_layer(S, **SAFE).save(os.path.join(out, "icon-foreground.png"))

    # adaptive background: color plano, el launcher lo desplaza en paralaje
    Image.new("RGBA", (S, S), ADAPTIVE_BG).save(os.path.join(out, "icon-background.png"))

    print("escritos icon.png, icon-foreground.png, icon-background.png en resources/")


if __name__ == "__main__":
    main()
