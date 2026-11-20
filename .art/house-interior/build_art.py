# Cuts the painted house sheets in Pictures/pauwi-assets into small game sprites -> art/*.png + art/manifest.json.
# Run from anywhere: python .art/house-interior/build_art.py   (then python .art/house-interior/build.py)
#
# Sources (all magenta-background sheets except the tiles):
#   house_furnitures_1  clutter and loot containers      house_furnitures_2  living room + bedroom furniture
#   house_furnitures_3  doors, windows, wall pieces      house_tiles_1       floor textures + decals
#   house_juan_1        movement, 4 facings x 4 frames
# Scale: the house screen is the game's 110x225 pixel canvas (RES = 1; RES = 2 gives a finer 220x450 look). With ZOOM = .75 a floor
# tile is 14 px and Juan is his native 25 px. Everything is shrunk with a limited palette so it reads as game pixel art.
import json, sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import cutlib

SRC = Path(r'C:/Users/Thirde/Pictures/pauwi-assets')
OUT = HERE / 'art'
OUT.mkdir(exist_ok=True)
for old in OUT.glob('*.png'):
    old.unlink()
manifest = {}
RES = 1                      # device pixels per logical pixel: 1 = the game's own chunky 110x225 pixels
ZOOM = .875                  # zoomed out: a 14 px floor tile instead of 16, sized so Juan's native 25 px sprite stands about 1.8 tiles tall
K = RES * ZOOM


def quant(rgb, n=36):
    return rgb.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')


def shrink(rgba, factor=None, width=None, height=None):
    """Downscale an RGBA cut with clean binary alpha and a limited palette (the repo's painted -> pixel look)."""
    if width: factor = width / rgba.width
    if height: factor = height / rgba.height
    w, h = max(1, round(rgba.width * factor)), max(1, round(rgba.height * factor))
    a = rgba.getchannel('A')
    px = [p[:3] for p in rgba.getdata() if p[3] > 200]
    mean = tuple(sum(c[i] for c in px) // max(1, len(px)) for i in range(3)) if px else (0, 0, 0)
    base = Image.new('RGB', rgba.size, mean)
    base.paste(rgba.convert('RGB'), mask=a)             # transparent pixels take the mean colour, not magenta
    rgb = base.resize((w, h), Image.LANCZOS)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.08).filter(ImageFilter.UnsharpMask(1, 60, 2))
    a2 = a.resize((w, h), Image.LANCZOS).point(lambda v: 255 if v > 128 else 0)
    out = quant(rgb).convert('RGBA')
    out.putalpha(a2)
    return out


def torso_x(img):
    """Horizontal anchor for a character frame: the centre of the head and body, not a swinging arm."""
    a = img.getchannel('A').load()
    xs = [x for y in range(int(img.height * .12), int(img.height * .55)) for x in range(img.width) if a[x, y]]
    return round((min(xs) + max(xs)) / 2) if xs else img.width // 2


def save(name, img, ax=None):
    img.save(OUT / f'{name}.png', optimize=True)
    manifest[name] = {'w': img.width, 'h': img.height, 'ax': img.width // 2 if ax is None else ax}


def sheet(name, join):
    im = Image.open(SRC / f'{name}.jpg').convert('RGB')
    return im, cutlib.reading_order(cutlib.shapes(im, join=join, min_area=400))


# name -> (shape index, target width px or None, target height px or None)
F1 = ['box', 'box_o', 'pack', 'pack_o', 'trunk', 'trunk_o', 'crate', 'crate_o', None, None, 'file', 'file_o',
      'locker', 'locker_o', None, None, 'radio', 'radio_o', 'cot_s', 'cot', 'stool', 'chair1', None, 'outlet']
F1W = {'box': 14, 'box_o': 19, 'pack': 15, 'pack_o': 15, 'trunk': 24, 'trunk_o': 24, 'crate': 16, 'crate_o': 16, 'file': 17, 'file_o': 18,
       'locker': 28, 'locker_o': 33, 'radio': 12, 'radio_o': 13, 'cot_s': 16, 'cot': 30, 'stool': 11, 'chair1': 12, 'outlet': 10}
F2 = ['sofa', 'tv', 'dcab1', 'dcab2', 'dcab_o', 'side', 'side_o', 'ward', 'ward_o', 'dress', 'dress_o', 'bed', 'bed_o',
      'stand', 'stand_lamp', 'table', 'chair_f', 'chair_b', 'rug']
F3 = ['door_open', 'door', 'door_lock', 'door_steel', 'door_board', 'win_lit', 'win_board', 'frame', 'clock', 'fuse', 'fuse_o']
F3H = {'door_open': 32, 'door': 32, 'door_lock': 32, 'door_steel': 32, 'door_board': 36, 'win_lit': 23, 'win_board': 21, 'frame': 14, 'clock': 13, 'fuse': 13, 'fuse_o': 14}

im, sh = sheet('house_furnitures_1', 4)
assert len(sh) == len(F1), ('sheet 1 shape count', len(sh))
for name, s in zip(F1, sh):
    if name: save(name, shrink(cutlib.cut(im, s), width=F1W[name] * K))

im, sh = sheet('house_furnitures_2', 7)
assert len(sh) == len(F2), ('sheet 2 shape count', len(sh))
for name, s in zip(F2, sh):
    save(name, shrink(cutlib.cut(im, s), factor=.14 * K))

im, sh = sheet('house_furnitures_3', 7)
assert len(sh) == len(F3), ('sheet 3 shape count', len(sh))
for name, s in zip(F3, sh):
    save(name, shrink(cutlib.cut(im, s), height=F3H[name] * K))

# Juan: the clean pixel-art movement sheet house_juan_1 (rows down, left, right, up; columns stand, step, stand, other step). Every
# art pixel is an 8x8 block, so each frame is reduced exactly 8:1 to native game pixels, with one shared palette per sheet.
# (house_juan_2, the scavenging sheet, is deliberately unused: combat is the flagship, so Juan only needs to move.)
BLOCK = 8


def block_grid(im):
    """The sheet as native pixels: a 2D list of (r, g, b) or None for background, plus the pixel size of the grid."""
    w, h = im.size
    px = im.load()
    best = None
    for oy in range(BLOCK):
        for ox in range(BLOCK):
            tot = 0
            for by in range(2, h // BLOCK - 2, 4):
                for bx in range(2, w // BLOCK - 2, 4):
                    x0, y0 = ox + bx * BLOCK, oy + by * BLOCK
                    c = [sum(px[x0 + i, y0 + j]) for i in (1, 6) for j in (1, 6)]
                    tot += max(c) - min(c)
            if best is None or tot < best[0]:
                best = (tot, ox, oy)
    _, ox, oy = best
    gw, gh = (w - ox) // BLOCK, (h - oy) // BLOCK
    grid = [[None] * gw for _ in range(gh)]
    for by in range(gh):
        for bx in range(gw):
            x0, y0 = ox + bx * BLOCK + 2, oy + by * BLOCK + 2
            cs = [px[x0 + i, y0 + j] for i in range(4) for j in range(4)]
            c = tuple(sum(v[k] for v in cs) // 16 for k in range(3))
            if not cutlib.magenta_like(*c):
                grid[by][bx] = c
    return grid


def block_frames(path, max_h=28):
    """Every frame of a sheet as a native-pixel RGBA image, in reading order, plus its anchor column."""
    grid = block_grid(Image.open(path).convert('RGB'))
    gh, gw = len(grid), len(grid[0])
    # one palette for the whole sheet, so a colour never drifts between frames
    colours = sorted({c for row in grid for c in row if c})
    strip = Image.new('RGB', (len(colours), 1))
    strip.putdata(colours)
    q = strip.quantize(26, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()
    remap = {}
    for i, c in enumerate(colours):
        k = q.getpixel((i, 0))
        remap[c] = tuple(pal[k * 3:k * 3 + 3])
    label = [[0] * gw for _ in range(gh)]
    comps = []
    for y0 in range(gh):
        for x0 in range(gw):
            if grid[y0][x0] and not label[y0][x0]:
                n = len(comps) + 1
                label[y0][x0] = n
                stack, cells = [(x0, y0)], []
                while stack:
                    x, y = stack.pop()
                    cells.append((x, y))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            nx, ny = x + dx, y + dy
                            if 0 <= nx < gw and 0 <= ny < gh and grid[ny][nx] and not label[ny][nx]:
                                label[ny][nx] = n
                                stack.append((nx, ny))
                comps.append(cells)
    big = [c for c in comps if len(c) >= 40]
    for c in comps:                                   # a lone pixel such as the flashlight dot joins the nearest frame
        if len(c) < 40:
            cx, cy = c[0]
            near = min(big, key=lambda b: min(abs(cx - x) + abs(cy - y) for x, y in b))
            if min(abs(cx - x) + abs(cy - y) for x, y in near) <= 8:
                near.extend(c)
    split = []
    for cells in big:                                 # two frames whose edges touch come out as one tall shape: cut it at its narrowest row
        ys = [y for _, y in cells]
        top, bottom = min(ys), max(ys)
        if bottom - top + 1 > max_h:
            counts = {y: sum(1 for _, yy in cells if yy == y) for y in range(top, bottom + 1)}
            lo, hi = top + (bottom - top) * 35 // 100, top + (bottom - top) * 65 // 100
            cut_y = min(range(lo, hi + 1), key=lambda y: counts[y])
            split.append([c for c in cells if c[1] < cut_y])
            split.append([c for c in cells if c[1] >= cut_y])
        else:
            split.append(cells)
    big = split
    items = []
    for cells in big:
        xs, ys = [x for x, _ in cells], [y for _, y in cells]
        items.append({'bbox': (min(xs) * BLOCK, min(ys) * BLOCK, (max(xs) + 1) * BLOCK, (max(ys) + 1) * BLOCK), 'cells': cells})
    out = []
    for it in cutlib.reading_order(items):
        cells = it['cells']
        x0, y0 = min(x for x, _ in cells), min(y for _, y in cells)
        x1, y1 = max(x for x, _ in cells) + 1, max(y for _, y in cells) + 1
        img = Image.new('RGBA', (x1 - x0, y1 - y0))
        p = img.load()
        for x, y in cells:
            p[x - x0, y - y0] = remap[grid[y][x]] + (255,)
        xs = [x for x in range(img.width) for y in range(img.height) if p[x, y][3]]
        out.append((img, round(sum(xs) / len(xs))))
    return out


movement = block_frames(SRC / 'house_juan_1.jpg')
assert len(movement) == 16, ('movement frames', len(movement))
for r, d in enumerate(('jd', 'jl', 'jr', 'ju')):
    for c in range(4):
        img, ax = movement[r * 4 + c]
        save(f'{d}{c}', img, ax)

# Shamblers: house_shambler_1 (walk: rows down, left, right, then front x3 + one back view) and house_shambler_2 (asleep x4, waking x8,
# dead x3). Also exact 8:1 blocks, then scaled to Juan's size with one shared palette per sheet so no colour drifts between frames.
ZF = 26 / 31


def zombie_frames(path, names, factor=ZF, ncol=28):
    fr = block_frames(path, max_h=60)
    assert len(fr) == len(names), (path.name, len(fr))
    cut = []
    for (img, ax), name in zip(fr, names):
        w, h = max(1, round(img.width * factor)), max(1, round(img.height * factor))
        a = img.getchannel('A')
        px = [q[:3] for q in img.getdata() if q[3] > 200]
        mean = tuple(sum(c[i] for c in px) // len(px) for i in range(3))
        base = Image.new('RGB', img.size, mean)
        base.paste(img.convert('RGB'), mask=a)
        rgb = base.resize((w, h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1, 60, 2))
        cut.append((name, rgb, a.resize((w, h), Image.LANCZOS).point(lambda v: 255 if v > 128 else 0), round(ax * factor)))
    atlas = Image.new('RGB', (max(c[1].width for c in cut), sum(c[1].height for c in cut)))
    y = 0
    for _, rgb, _, _ in cut:
        atlas.paste(rgb, (0, y)); y += rgb.height
    atlas = quant(atlas, ncol)
    y = 0
    for name, rgb, alpha, ax in cut:
        out = atlas.crop((0, y, rgb.width, y + rgb.height)).convert('RGBA')
        out.putalpha(alpha)
        y += rgb.height
        if name:
            save(name, out, ax)


zombie_frames(SRC / 'house_shambler_1.jpg', [f'z{d}{c}' for d in 'dlr' for c in range(4)] + [None, None, None, 'zu0'])
zombie_frames(SRC / 'house_shambler_2.jpg', ['zs0', 'zs1', 'zs2', 'zs3'] + [f'zw{i}' for i in range(8)] + ['zx0', 'zx1', 'zx2'])

# Kitchen and bathroom: house_furnitures_8 (bathroom, with its CLOSED/OPENED captions, which are skipped), house_furnitures_9 (the closed
# kitchen pieces) and refs/house_kitchen_1.png (the first kitchen sheet, kept in the repo because it only ever existed as a pasted image).
# Sizes are final pixels for a 14 px tile (no K). A closed/opened pair shares one scale so the piece does not change size when opened.
def cuts(im, join):
    return im, cutlib.reading_order(cutlib.shapes(im, join=join, min_area=150))


def put(name, im, sh, i, **size):
    save(name, shrink(cutlib.cut(im, sh[i]), **size))


def pair(c, o, im, sh, ic, io, h):
    cut_c, cut_o = cutlib.cut(im, sh[ic]), cutlib.cut(im, sh[io])
    f = h / cut_c.height
    save(c, shrink(cut_c, factor=f))
    save(o, shrink(cut_o, factor=f))


b8, s8 = cuts(Image.open(SRC / 'house_furnitures_8.jpg').convert('RGB'), 5)
assert len(s8) == 22, ('bathroom sheet shapes', len(s8))
pair('medcab', 'medcab_o', b8, s8, 0, 1, 16)
pair('basket', 'basket_o', b8, s8, 2, 4, 15)
pair('vanity', 'vanity_o', b8, s8, 6, 7, 20)
pair('cart', 'cart_o', b8, s8, 8, 9, 19)
put('toilet', b8, s8, 10, height=18)
put('toilet_up', b8, s8, 11, height=18)
put('pedsink', b8, s8, 12, height=24)
put('curtain', b8, s8, 13, width=24)
put('drum', b8, s8, 14, width=20)
put('washer', b8, s8, 15, width=18)
put('towel', b8, s8, 16, width=12)
put('d_drain', b8, s8, 17, width=14)
put('d_mold', b8, s8, 18, width=10)
for n, i in (('d_roach1', 19), ('d_roach2', 20), ('d_roach3', 21)):
    put(n, b8, s8, i, width=5)

b9, s9 = cuts(Image.open(SRC / 'house_furnitures_9.jpg').convert('RGB'), 5)
assert len(s9) == 4, ('kitchen closed shapes', len(s9))
put('wcup', b9, s9, 0, width=26)
put('pantry_o', b9, s9, 1, height=28)
put('tower', b9, s9, 3, height=22)

k1, sk = cuts(Image.open(HERE / 'refs' / 'house_kitchen_1.png').convert('RGB'), 2)
assert len(sk) == 19, ('kitchen sheet shapes', len(sk))
pair('fridge', 'fridge_o', k1, sk, 0, 1, 32)
put('pantry', k1, sk, 4, height=28)
put('stove', k1, sk, 6, width=26)
pair('ricecooker', 'ricecooker_o', k1, sk, 7, 8, 17)
put('tower_o', k1, sk, 10, height=22)
pair('tin', 'tin_o', k1, sk, 11, 12, 11)
put('dispenser', k1, sk, 13, height=26)
put('dishrack', k1, sk, 14, width=12)
put('ktable', k1, sk, 15, width=22)
put('mono', k1, sk, 16, height=18)
put('bin', k1, sk, 17, height=14)
put('garlic', k1, sk, 18, height=10)

# floors: 160 px square of each texture cell -> 64 px (4 tiles of 16)
tiles = Image.open(SRC / 'house_tiles_1.jpg').convert('RGB')
cw, ch = tiles.width // 8, tiles.height // 4
TILES = {'t_slate': (0, 0), 't_slate2': (1, 0), 't_brown': (2, 0), 't_concrete': (2, 1), 't_concrete2': (3, 1), 't_wood': (4, 1), 't_terra': (0, 3), 't_blue': (3, 2), 't_green': (1, 3)}
for name, (c, r) in TILES.items():
    x0, y0 = c * cw + 8, r * ch + 5
    t = tiles.crop((x0, y0, x0 + 160, y0 + 160)).resize((round(64 * K), round(64 * K)), Image.LANCZOS)
    t = ImageEnhance.Color(t).enhance(.72)
    quant(t, 32).save(OUT / f'{name}.png', optimize=True)
    manifest[name] = {'w': round(64 * K), 'h': round(64 * K), 'ax': round(32 * K)}

# decals from the magenta strip (moss, paper) - cut by shape like the sprites
strip = tiles.crop((707, 568, 1397, 735))
dsh = cutlib.reading_order(cutlib.shapes(strip, join=6, min_area=600))
for name, i in {'d_moss': 0, 'd_paper': len(dsh) - 1}.items():
    if i < len(dsh):
        d = shrink(cutlib.cut(strip, dsh[i]), width=round((26 if name == 'd_moss' else 22) * K))
        save(name, d)
print('decal shapes:', len(dsh))

manifest['_res'] = {'w': RES, 'h': RES, 'ax': 0}
(OUT / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')))
print('wrote', len(manifest), 'sprites to', OUT)
