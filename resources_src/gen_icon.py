from PIL import Image, ImageDraw

# Grid is 32x32 "pixels", each rendered at CELL px -> 1024x1024 master image
GRID = 32
CELL = 32
SIZE = GRID * CELL

BLACK   = (5, 5, 5, 255)      # outline, matches app bg #050505
GREEN   = (0, 255, 136, 255)  # neon green #00ff88 - plates
GREEN_D = (0, 168, 96, 255)   # darker green shade
MINT    = (200, 245, 216, 255)   # #c8f5d8 - bar / highlight
MINT_D  = (120, 170, 145, 255)   # darker mint shade for bar shadow

def cell(x0, y0, x1, y1):
    """inclusive grid coords -> pixel rect"""
    return (x0 * CELL, y0 * CELL, (x1 + 1) * CELL - 1, (y1 + 1) * CELL - 1)

def build(transparent_bg=True):
    bg = (0, 0, 0, 0) if transparent_bg else (10, 10, 10, 255)
    img = Image.new("RGBA", (SIZE, SIZE), bg)
    d = ImageDraw.Draw(img)

    # --- geometry (grid coords) - variant B, thicker/longer bar ---
    plate_l = (3, 9, 12, 22)
    plate_r = (19, 9, 28, 22)
    bar     = (11, 13, 20, 18)

    def outline_of(rect):
        x0, y0, x1, y1 = rect
        return (x0 - 1, y0 - 1, x1 + 1, y1 + 1)

    # 1) outlines (black), bar first then plates so plate corners stay crisp
    d.rectangle(cell(*outline_of(bar)), fill=BLACK)
    d.rectangle(cell(*outline_of(plate_l)), fill=BLACK)
    d.rectangle(cell(*outline_of(plate_r)), fill=BLACK)

    # 2) bar fill (mint / chrome) with bottom shade
    d.rectangle(cell(*bar), fill=MINT)
    bx0, by0, bx1, by1 = bar
    d.rectangle(cell(bx0, by1 - 0, bx1, by1), fill=MINT_D)  # bottom row shade

    # 3) plates fill (green) with pixel-art shading
    for plate in (plate_l, plate_r):
        x0, y0, x1, y1 = plate
        d.rectangle(cell(x0, y0, x1, y1), fill=GREEN)
        # bottom-right shadow block (roughly bottom third)
        shade_y0 = y0 + (y1 - y0) * 2 // 3
        d.rectangle(cell(x0, shade_y0, x1, y1), fill=GREEN_D)
        # top-left highlight strip
        d.rectangle(cell(x0, y0, x0 + 1, y0 + 2), fill=MINT)

    return img

if __name__ == "__main__":
    build(transparent_bg=True).save("/tmp/claude-1000/-home-nsypxlmx/bcd09f76-f76a-40c9-90c7-833d352cc1dc/scratchpad/icon/dumbbell_fg.png")
    build(transparent_bg=False).save("/tmp/claude-1000/-home-nsypxlmx/bcd09f76-f76a-40c9-90c7-833d352cc1dc/scratchpad/icon/dumbbell_flat.png")
    print("done")
