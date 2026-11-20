# Pixelates the two painted interiors (Pictures/pauwi-assets/interior_house_combat*.jpg) into the game's native 110x225 combat
# backgrounds: wood-110.png and tile-110.png. The painting is placed so its own vanishing point lands on the combat grid's
# (vx, hy) and its floor scale matches the lanes; anything above the painting is dark ceiling. Surroundings are darkened here once;
# index.html adds the live flashlight (pool, flicker, dwindle) on top.
# Run from anywhere: python .art/combat-bg-interior/build.py [--overlay]   (--overlay also writes tmp/*-grid-x4.png for tuning)
import sys, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent
SRC = Path(r'C:/Users/Thirde/Pictures/pauwi-assets')
W, H = 110, 225
ROWS = [1.5, 2.5, 4.2, 7.5]                          # the combat grid's depth edges (CombatScreen.vue)

# Per floor: the painting's vanishing point (vpx, vpy in source px), the output scale s (output px per source px), the grid's
# geometry (hy, vx, f, lane; e = 1.6 f), and the lit pool centre/size in output px for the runtime light.
FLOORS = {
    'wood': dict(file='interior_house_combat.jpg', vp=(360, 505), s=0.153, geo=dict(hy=143, vx=55, f=58, lane=1.2, cx=0)),
    'tile': dict(file='interior_house_combat_1.jpg', vp=(360, 480), s=0.153, geo=dict(hy=143, vx=55, f=58, lane=1.2, cx=0)),
}


def place(name):
    cfg = FLOORS[name]
    im = Image.open(SRC / cfg['file']).convert('RGB')
    s, (vpx, vpy), g = cfg['s'], cfg['vp'], cfg['geo']
    ox, oy = g['vx'] - vpx * s, g['hy'] - vpy * s
    w, h = round(im.width * s), round(im.height * s)
    big = im.resize((w, h), Image.LANCZOS)
    canvas = Image.new('RGB', (W, H), (8, 11, 13))
    canvas.paste(big, (round(ox), round(oy)))
    return canvas, cfg


def darken(img, cfg):
    """Walls and ceiling fall into the dark; the floor stays. Done once on the pixelated image."""
    g = cfg['geo']
    px = img.load()
    for y in range(H):
        for x in range(W):
            r, gg, b = px[x, y]
            if y < g['hy']:                                   # above the horizon: the far wall and ceiling
                k = 0.34 + 0.26 * max(0, (y - 60)) / max(1, g['hy'] - 60)
            else:                                             # the floor: lifted, with a soft vignette to the left and right edges only
                d = abs(x - 55) / 55
                k = 1.55 - 0.55 * max(0, d - 0.45) / 0.55
            px[x, y] = (int(r * k), int(gg * k), int(b * k))
    return img


def quant(img, n=40):
    return img.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')


def overlay(img, cfg, path):
    g = cfg['geo']; e = 1.6 * g['f']
    big = img.resize((W * 4, H * 4), Image.NEAREST); d = ImageDraw.Draw(big)
    proj = lambda X, z: (g['vx'] + g['f'] * X / z, g['hy'] + e / z)
    lx = lambda i: g['cx'] + (i - 1.5) * g['lane']
    for z in ROWS:
        a, b = proj(lx(0), z), proj(lx(3), z); d.line([(a[0] * 4, a[1] * 4), (b[0] * 4, b[1] * 4)], fill=(236, 228, 213), width=2)
    for i in range(4):
        a, b = proj(lx(i), ROWS[0]), proj(lx(i), ROWS[3]); d.line([(a[0] * 4, a[1] * 4), (b[0] * 4, b[1] * 4)], fill=(236, 228, 213), width=2)
    # the horizon and the vanishing x, so a bad guess is easy to see
    d.line([(0, g['hy'] * 4), (W * 4, g['hy'] * 4)], fill=(240, 166, 60), width=1)
    d.line([(g['vx'] * 4, 0), (g['vx'] * 4, H * 4)], fill=(90, 161, 122), width=1)
    big.save(path)


if __name__ == '__main__':
    out = {}
    (HERE / 'tmp').mkdir(exist_ok=True)
    for name in FLOORS:
        img, cfg = place(name)
        img = ImageEnhance.Contrast(img).enhance(1.06).filter(ImageFilter.UnsharpMask(1, 50, 2))
        img = quant(darken(img, cfg))
        img.save(HERE / f'{name}-110.png', optimize=True)
        out[name] = cfg['geo']
        if '--overlay' in sys.argv: overlay(img, cfg, HERE / 'tmp' / f'{name}-grid-x4.png')
    (HERE / 'geo.json').write_text(json.dumps(out))
    print('wrote wood-110.png, tile-110.png', out)
