# Cuts Juan's kit and the combat message box from the painted sheets in Pictures/pauwi-assets into small game sprites -> out/*.png
# + out/kit.json. Run: python .art/kit/build.py   (then python .art/export_to_app.py)
#   juan_watch.jpg        the wristwatch (front view, blank LCD: the app draws the readout on it)
#   juan_phone.jpg        the phone in a jeans pocket, five crack levels (sorted lightest to worst here by how much of the screen is cracked)
#   juan_compass.jpg      a grid of compasses: the first two rows are 16 needle angles (measured here from the blue tip)
#   combat_ui_assets.png  the message box frame and the two portraits (Juan, a Shambler)
import json, math, sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'house-interior'))
import cutlib

SRC = Path(r'C:/Users/Thirde/Pictures/pauwi-assets')
OUT = HERE / 'out'
OUT.mkdir(exist_ok=True)
meta = {}


def shrink(rgba, factor=None, width=None, height=None, colors=40):
    """Downscale an RGBA cut with clean binary alpha and a limited palette (the repo's painted -> pixel look)."""
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
    out.putalpha(a.resize((w, h), Image.LANCZOS).point(lambda v: 255 if v > 128 else 0))
    return out


def save(name, img, **extra):
    img.save(OUT / f'{name}.png', optimize=True)
    meta[name] = {'w': img.width, 'h': img.height, **extra}


def sheet(name, join):
    im = Image.open(SRC / name).convert('RGB')
    return im, cutlib.reading_order(cutlib.shapes(im, join=join, min_area=300))


# ---------- the watch: the front view, and where its LCD is ----------
im, sh = sheet('juan_watch.jpg', 6)
watch = shrink(cutlib.cut(im, sh[0]), height=52)
px = watch.load()
lcd = [(x, y) for y in range(watch.height) for x in range(watch.width) if px[x, y][3] and px[x, y][1] > 150 and px[x, y][1] > px[x, y][2] + 30]
from collections import Counter
rows = {y for y, n in Counter(y for _, y in lcd).items() if n >= 10}           # the screen's rows; stray light pixels on the case don't count
lcd = [(x, y) for x, y in lcd if y in rows]
xs, ys = [p[0] for p in lcd], [p[1] for p in lcd]
save('kit-watch', watch, lcd=[min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1])

# ---------- the phone in the pocket: five crack levels ----------
im, sh = sheet('juan_phone.jpg', 4)
phones = []
for s in sh:
    cut = cutlib.cut(im, s)
    p = cut.load()
    blue = dark = 0
    for y in range(0, int(cut.height * .62), 2):                     # the screen is the upper part, above the pocket
        for x in range(0, cut.width, 2):
            r, g, b, a = p[x, y]
            if not a: continue
            if b > 120 and b > r + 40: blue += 1
            elif r + g + b < 120 and b > r: dark += 1
    phones.append((dark / max(1, blue + dark), cut))
phones.sort(key=lambda t: t[0])
for i, (_, cut) in enumerate(phones):
    save(f'kit-phone-{i}', shrink(cut, width=40))

# ---------- the compass: the open one with no needle (row 3, column 2), body only; the app draws the needle at the exact angle ----------
im = Image.open(SRC / 'juan_compass.jpg').convert('RGB')
cell = im.crop((180, 480, 352, 618))
shp = max(cutlib.shapes(cell, join=3, min_area=300), key=lambda s: (s['bbox'][2] - s['bbox'][0]) * (s['bbox'][3] - s['bbox'][1]))
comp = shrink(cutlib.cut(cell, shp), height=24)
p = comp.load()
face = [(x, y) for y in range(comp.height) for x in range(comp.width) if p[x, y][3] and sum(p[x, y][:3]) > 520 and abs(p[x, y][0] - p[x, y][2]) < 70]
save('kit-compass', comp, cx=round(sum(x for x, _ in face) / len(face), 1), cy=round(sum(y for _, y in face) / len(face), 1),
     r=round(max(max(x for x, _ in face) - min(x for x, _ in face), max(y for _, y in face) - min(y for _, y in face)) / 2, 1))

# ---------- the message box and the portraits ----------
im, sh = sheet('combat_ui_assets.png', 3)
save('dialog-frame', shrink(cutlib.cut(im, sh[0]), height=26, colors=24))
save('portrait-juan', shrink(cutlib.cut(im, sh[1]), height=17))
save('portrait-shambler', shrink(cutlib.cut(im, sh[2]), height=17))

# ---------- Aling Cora, the suki trader: her face (head and shoulders, like the others; a bigger one for the trade card) ----------
im, sh = sheet('trader_icon.jpg', 6)
cora = cutlib.cut(im, sh[0]).crop((80, 0, 590, 540))          # the bust runs off the bottom of the painting: keep the head and shoulders
save('portrait-cora', shrink(cora, height=17))
save('portrait-cora-big', shrink(cora, height=40, colors=48))
# her stall, as a prop on the hex map (the size of the other street props, a little taller)
im, sh = sheet('trader_map_icon.jpg', 6)
save('prop-stall', shrink(cutlib.cut(im, sh[0]), height=21, colors=24))

(OUT / 'kit.json').write_text(json.dumps(meta, indent=1))
print('wrote', len(meta), 'sprites')
