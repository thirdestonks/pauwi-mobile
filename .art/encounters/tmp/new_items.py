# The October 23 sheets (the trader update) -> item sprites, the trader's scene, and both injected into encounters/index.html.
#   weapons_icon_1.jpg  sibat, balisong, rebar / sumpak, shells, hammer       (3 x 2 on magenta)
#   armor_pack_1.jpg    helmet, rider jacket, denim jacket / jeans, rubber boots, pads
#   trade_encounter.jpg Aling Cora's stall under the train line -> src/suki-110.png (scene 'suki')
# Uses house-interior/cutlib (shapes with a join, so the pads and the spilled shells stay one item each).
# Run from .art/encounters:  python tmp/new_items.py   (then python ../house-interior/build.py and python ../export_to_app.py)
import base64, json, re, shutil, sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent.parent          # .art/encounters
sys.path.insert(0, str(HERE.parent / 'house-interior'))
import cutlib

SRC = Path(r'C:/Users/Thirde/Pictures/pauwi-assets')
ITEMS = HERE / 'src' / 'items'
SHEETS = {
    'weapons_icon_1.jpg': (12, ['sibat', 'balisong', 'rebar', 'sumpak', 'shells', 'hammer']),
    'armor_pack_1.jpg': (12, ['moto-helmet', 'rider-jacket', 'denim-jacket', 'work-jeans', 'rain-boots', 'elbow-pads']),
}
# width in the scene's pixels (the old items: knife 12, pipe 24, sledge 26, first-aid 18)
WIDTH = {'sibat': 24, 'balisong': 14, 'rebar': 22, 'sumpak': 24, 'shells': 13, 'hammer': 16,
         'moto-helmet': 15, 'rider-jacket': 18, 'denim-jacket': 18, 'work-jeans': 14, 'rain-boots': 14, 'elbow-pads': 16}


def outline(cell, w):
    """items.py's look: shrink to `w` wide, hard alpha, a 1px dark outline round the shape."""
    h = max(1, round(cell.height * w / cell.width))
    sm = cell.resize((w, h), Image.LANCZOS)
    o = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    sp, op = sm.load(), o.load()
    solid = [[sp[x, y][3] > 110 for x in range(w)] for y in range(h)]
    for y in range(h):
        for x in range(w):
            if solid[y][x]:
                r, g, b, _ = sp[x, y]
                op[x + 1, y + 1] = (r, g, b, 255)
    for y in range(h + 2):
        for x in range(w + 2):
            if op[x, y][3]:
                continue
            if any(0 <= x + dx - 1 < w and 0 <= y + dy - 1 < h and solid[y + dy - 1][x + dx - 1] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                op[x, y] = (16, 12, 14, 255)
    return o


made = {}
for sheet, (join, ids) in SHEETS.items():
    shutil.copy2(SRC / sheet, ITEMS / ('sheet-' + sheet))
    im = Image.open(SRC / sheet).convert('RGB')
    found = cutlib.reading_order(cutlib.shapes(im, join=join, min_area=2000))
    if len(found) != len(ids):
        sys.exit(f'!! {sheet}: found {len(found)} shapes, expected {len(ids)}')
    for id, shp in zip(ids, found):
        cell = cutlib.cut(im, shp)
        cell = cell.crop(cell.getbbox())
        outline(cell, WIDTH[id]).save(ITEMS / f'{id}.png')
        made[id] = base64.b64encode((ITEMS / f'{id}.png').read_bytes()).decode()

# the trader's scene: same treatment as the other encounter bases (tmp/pixelate.py)
W, H = 110, 225
shutil.copy2(SRC / 'trade_encounter.jpg', HERE / 'src' / 'painted-suki.jpg')
src = Image.open(SRC / 'trade_encounter.jpg').convert('RGB')
s = max(W / src.width, H / src.height)
big = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
x0 = round((big.width - W) * 0.5)
scene = big.crop((x0, 0, x0 + W, H))
scene = ImageEnhance.Contrast(scene).enhance(1.08).filter(ImageFilter.UnsharpMask(1, 60, 2))
scene = scene.quantize(48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
scene.save(HERE / 'src' / 'suki-110.png')
scene.resize((W * 4, H * 4), Image.NEAREST).save(HERE / 'tmp' / 'suki-x4.png')
print('lamp at about', round(355 * s - x0), round(600 * s))

# inject: new ids into ITEM_SRC, the scene into SRC (both are one-line object literals in index.html)
page = (HERE / 'index.html').read_text(encoding='utf-8')
def merge(var, add):
    global page
    m = re.search(r'^const ' + var + r' = (\{.*\});$', page, re.M)
    assert m, var + ' not found'
    obj = json.loads(m.group(1))
    obj.update(add)
    page = page[:m.start(1)] + json.dumps(obj) + page[m.end(1):]
merge('ITEM_SRC', made)
merge('SRC', {'suki': base64.b64encode((HERE / 'src' / 'suki-110.png').read_bytes()).decode()})
(HERE / 'index.html').write_text(page, encoding='utf-8')

# contact sheet at x4 to look at
cs = Image.new('RGBA', (30 * len(made), 30), (40, 30, 34, 255))
for i, id in enumerate(made):
    sp = Image.open(ITEMS / f'{id}.png')
    cs.alpha_composite(sp, (i * 30 + (30 - sp.width) // 2, 30 - sp.height))
cs.resize((cs.width * 4, cs.height * 4), Image.NEAREST).save(HERE / 'tmp' / 'new-items-x4.png')
print('ok', len(made), 'items + the suki scene')
