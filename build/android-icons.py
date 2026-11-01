# The launcher icon of the Android app, at the five densities (res/mipmap-*/ic_launcher_foreground.png). The icon is
# adaptive: the background is the gradient of the logo's tile (res/drawable/ic_launcher_background.xml) and this
# script draws the foreground, the pawn and the open book of assets/logo.svg without the tile, inside the 72 dp safe
# zone of the 108 dp canvas so that every mask keeps them. The shapes below are the ones of assets/logo.svg (the
# script stops when the logo no longer contains them). Needs Pillow.
#   python build/android-icons.py
import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit('Pillow is needed: pip install pillow')

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = os.path.join(root, 'android', 'app', 'src', 'main', 'res')
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

with open(os.path.join(root, 'assets', 'logo.svg'), encoding='utf-8') as f:
    svg = f.read()
for needle in ('<circle cx="256" cy="130" r="38"/>', 'M230 164h52c3 24 14 40 32 50H198c18-10 29-26 32-50z',
               '<rect x="184" y="212" width="144" height="22" rx="11"/>',
               'M256 296C214 268 150 262 92 274v138c58-12 122-6 164 22z', 'M256 296c42-28 106-34 164-22v138c-58-12-122-6-164 22z'):
    if needle not in svg:
        sys.exit('assets/logo.svg changed, update build/android-icons.py: ' + needle)


def cubic(p0, p1, p2, p3, n=24):
    out = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        out.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return out


# the shapes in the 512 x 512 coordinates of the logo
pawn_body = [(230, 164), (282, 164)] + cubic((282, 164), (285, 188), (296, 204), (314, 214)) + [(198, 214)] + cubic((198, 214), (216, 204), (227, 188), (230, 164))
book_left = [(256, 296)] + cubic((256, 296), (214, 268), (150, 262), (92, 274)) + [(92, 412)] + cubic((92, 412), (150, 400), (214, 406), (256, 434))
book_right = [(256, 296)] + cubic((256, 296), (298, 268), (362, 262), (420, 274)) + [(420, 412)] + cubic((420, 412), (362, 400), (298, 406), (256, 434))
GOLD = ((255, 226, 154), (244, 166, 64))
PAGE = ((255, 255, 255), (212, 230, 238))
# the artwork spans x 92..420 and y 92..434: centred on the canvas and scaled to 66 dp of the 108 dp
CX, CY, EXTENT = 256, 263, 342


def bbox(points):
    ys = [p[1] for p in points]
    return min(ys), max(ys)


def render(size):
    ss = 4
    big = size * ss
    k = (big * 66 / 108) / EXTENT
    tx = lambda p: ((p[0] - CX) * k + big / 2, (p[1] - CY) * k + big / 2)
    canvas = Image.new('RGBA', (big, big), (0, 0, 0, 0))

    def paint(draw_mask, y0, y1, colors, opacity=1.0):
        mask = Image.new('L', (big, big), 0)
        draw_mask(ImageDraw.Draw(mask))
        grad = Image.new('RGBA', (big, big))
        gd = ImageDraw.Draw(grad)
        top, bottom = tx((0, y0))[1], tx((0, y1))[1]
        for y in range(big):
            t = min(1, max(0, (y - top) / max(1, bottom - top)))
            gd.line([(0, y), (big, y)], fill=tuple(round(colors[0][i] + (colors[1][i] - colors[0][i]) * t) for i in range(3)) + (255,))
        if opacity < 1:
            mask = mask.point(lambda v: round(v * opacity))
        canvas.paste(grad, (0, 0), mask)

    paint(lambda d: d.ellipse([tx((218, 92)), tx((294, 168))], fill=255), 92, 168, GOLD)
    paint(lambda d: d.polygon([tx(p) for p in pawn_body], fill=255), 164, 214, GOLD)
    paint(lambda d: d.rounded_rectangle([tx((184, 212)), tx((328, 234))], radius=11 * k, fill=255), 212, 234, GOLD)
    y0, y1 = bbox(book_left)
    paint(lambda d: d.polygon([tx(p) for p in book_left], fill=255), y0, y1, PAGE)
    y0, y1 = bbox(book_right)
    paint(lambda d: d.polygon([tx(p) for p in book_right], fill=255), y0, y1, PAGE, 0.86)
    return canvas.resize((size, size), Image.LANCZOS)


for name, factor in DENSITIES.items():
    size = int(108 * factor)
    folder = os.path.join(res, 'mipmap-' + name)
    os.makedirs(folder, exist_ok=True)
    render(size).save(os.path.join(folder, 'ic_launcher_foreground.png'), optimize=True)
    print(name, size, 'px')
print('icons written to', res)
