# Cuts the "weight" paintings in Pictures/pauwi-assets into game sprites -> out/*.png + out/weight.json, for the mockup (index.html)
# and, later, the app. Run: python .art/weight/build.py
#   kit_bag_loads.jpg       the map bag: slack, half, overloaded
#   hands_use_items.jpg     first-person hands using an item: bandage, pills, water, food (2x2)
#   shelter_meals.jpg       meals on the shelter counter: rice + tuyo, noodles, sardines + crackers, coffee
#   trade_goods_1.jpg       cigarettes, gold, cracked phone, gin, copper wire, coffee sachets
#   armor_items_2.jpg       hard hat, leather jacket, scrap vest, work boots
#   survivors_pack_1.jpg    four survivors, half-body: mother, old man, boy, pregnant woman
#   hasa_icon.jpg           Mang Isko, the knife sharpener (bust)
#   hasa_map_icon.jpg       his bicycle grinder on the map
#   survivor_mother.jpg     scene: the mother in a doorway (no rain: rain is drawn in code)
#   hasa_encounter.jpg      scene: Mang Isko at his grindstone (no rain, no sparks: both drawn in code)
#   survivors_pack_2.jpg    four more survivors: the rookie cop, Aling Remy, Bombay, Tanod Bert
#   survivor_cop.jpg, survivor_tanod.jpg   their scenes (no rain)
import json, sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'house-interior'))
import cutlib

SRC = Path(r'C:/Users/Thirde/Pictures/pauwi-assets')
OUT = HERE / 'out'
OUT.mkdir(exist_ok=True)
meta = {}

# These sheets came back with darker purple-magenta in places (shadows on the backdrop, e.g. (69, 3, 64) between the bags), which the
# shared test misses. Here: any magenta hue counts, however dark, as long as green is far below red and blue. Only for this script.
_base_magenta = cutlib.magenta_like
cutlib.magenta_like = lambda r, g, b: _base_magenta(r, g, b) or (min(r, b) > 14 and g < 0.3 * min(r, b) and abs(r - b) < 0.35 * max(r, b))


def shrink(rgba, factor=None, width=None, height=None, colors=40, thr=128):
    """Downscale an RGBA cut with clean binary alpha and a limited palette (the repo's painted -> pixel look; same as kit/build.py)."""
    if width: factor = width / rgba.width
    if height: factor = height / rgba.height
    w, h = max(1, round(rgba.width * factor)), max(1, round(rgba.height * factor))
    a = rgba.getchannel('A')
    px = [p[:3] for p in rgba.getdata() if p[3] > 200]
    mean = tuple(sum(c[i] for c in px) // max(1, len(px)) for i in range(3)) if px else (0, 0, 0)
    base = Image.new('RGB', rgba.size, mean)
    base.paste(rgba.convert('RGB'), mask=a)
    rgb = base.resize((w, h), Image.LANCZOS)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.06).filter(ImageFilter.UnsharpMask(1, 60, 2))
    out = rgb.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    out.putalpha(a.resize((w, h), Image.LANCZOS).point(lambda v: 255 if v > thr else 0))
    return out


def save(name, img, **extra):
    img.save(OUT / f'{name}.png', optimize=True)
    meta[name] = {'w': img.width, 'h': img.height, **extra}


def sheet(name, join=6, expect=None):
    im = Image.open(SRC / name).convert('RGB')
    sh = cutlib.reading_order(cutlib.shapes(im, join=join, min_area=300))
    if expect and len(sh) != expect:
        cutlib.numbered_contact(im, sh, OUT / f'_check-{Path(name).stem}.png')
        raise SystemExit(f'{name}: found {len(sh)} pieces, expected {expect} (see out/_check-{Path(name).stem}.png)')
    return im, sh


def despill(rgba):
    """Thin line art is anti-aliased into the magenta: any pixel with a magenta cast becomes the dark of its green channel (outline)."""
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if a and (r + b) / 2 - g > 35 and abs(r - b) < 70:
                v = min(g, 40)
                px[x, y] = (v, v, v, a)
    return rgba


def row(name, names, height, join=6, colors=40, thr=128, erode=1, spill=False):
    im, sh = sheet(name, join, len(names))
    for n, s in zip(names, sh):
        c = cutlib.cut(im, s, erode=erode)
        save(n, shrink(despill(c) if spill else c, height=height, colors=colors, thr=thr))


def grid_cells(name, names, cols, rows_, width, colors=48):
    """A grid of panels (first-person hands: two hands per panel, arms running off the bottom): cut by the grid, then key the
    magenta out of each cell, keeping every piece in it. Kept at the panel's own framing, so the arms still enter from the bottom."""
    im = Image.open(SRC / name).convert('RGB')
    cw, ch = im.width // cols, im.height // rows_
    for i, n in enumerate(names):
        cell = im.crop(((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch))
        rgba = Image.new('RGBA', cell.size, (0, 0, 0, 0))
        for s in cutlib.shapes(cell, join=10, min_area=800):
            rgba.alpha_composite(cutlib.cut(cell, s), s['bbox'][:2])
        save(n, shrink(rgba, width=width, colors=colors))


def scene(name, out, colors=56):
    """A tall painting -> the native 110x225 screen: fit the height, keep the middle."""
    im = Image.open(SRC / name).convert('RGB')
    w = round(im.width * 225 / im.height)
    im = im.resize((w, 225), Image.LANCZOS)
    im = im.crop(((w - 110) // 2, 0, (w - 110) // 2 + 110, 225))
    im = ImageEnhance.Contrast(im).enhance(1.04).filter(ImageFilter.UnsharpMask(1, 50, 2))
    save(out, im.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))


if __name__ == '__main__':
    row('kit_bag_loads.jpg', ['bag-light', 'bag-half', 'bag-loaded'], 30, join=2)
    grid_cells('hands_use_items.jpg', ['use-bandage', 'use-pills', 'use-water', 'use-food'], 2, 2, 110)
    row('shelter_meals.jpg', ['meal-rice', 'meal-noodles', 'meal-sardines', 'meal-coffee'], 18)
    row('trade_goods_1.jpg', ['cigarettes', 'gold', 'old-phone', 'gin', 'copper-wire', 'coffee'], 22)
    row('armor_items_2.jpg', ['hard-hat', 'leather-jacket', 'scrap-vest', 'work-boots'], 22)
    row('survivors_pack_1.jpg', ['sv-mother', 'sv-oldman', 'sv-boy', 'sv-pregnant'], 64, colors=48)
    row('hasa_icon.jpg', ['isko-big'], 40, colors=48)
    row('hasa_map_icon.jpg', ['prop-hasa'], 26, thr=55, erode=0, spill=True)      # thin bicycle lines: keep more of the edge
    row('survivors_pack_2.jpg', ['sv-cop', 'sv-remy', 'sv-thug', 'sv-tanod'], 64, colors=48)
    scene('survivor_mother.jpg', 'scene-mother')
    scene('survivor_cop.jpg', 'scene-cop')
    scene('survivor_tanod.jpg', 'scene-tanod')
    scene('hasa_encounter.jpg', 'scene-hasa')
    (OUT / 'weight.json').write_text(json.dumps(meta, indent=1))
    print('\n'.join(f'{k:16} {v["w"]}x{v["h"]}' for k, v in meta.items()))
