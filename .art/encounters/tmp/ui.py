# UI art on pink/magenta sheets -> keyed, shrunk, outlined icons (+ the bag's open animation, + the End Demo backdrop).
# Each sheet's pieces are found as connected shapes in reading order, like items.py.
from PIL import Image, ImageEnhance
import base64, json
def is_bg(r, g, b): return r > g + 40 and b > g + 20
def blobs(im, rows, grow=0):                                            # grow: join a thin piece's broken segments (cells)
    W, H = im.size; S = 4; px = im.load(); gw, gh = W // S, H // S
    m = [[not is_bg(*px[x * S + S // 2, y * S + S // 2][:3]) and sum(px[x * S + S // 2, y * S + S // 2][:3]) > 60 for x in range(gw)] for y in range(gh)]
    for _ in range(grow):                                                  # dilate the mask a cell at a time
        m = [[m[y][x] or any(m[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < gw and 0 <= y + dy < gh) for x in range(gw)] for y in range(gh)]
    seen = [[False] * gw for _ in range(gh)]; out = []
    for y0 in range(gh):
        for x0 in range(gw):
            if not m[y0][x0] or seen[y0][x0]: continue
            st = [(x0, y0)]; seen[y0][x0] = True; xs = []; ys = []
            while st:
                x, y = st.pop(); xs.append(x); ys.append(y)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < gw and 0 <= ny < gh and m[ny][nx] and not seen[ny][nx]: seen[ny][nx] = True; st.append((nx, ny))
            bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            if len(xs) < 120 or min(bw, bh) < 6 or bw > gw * 0.85 or bh > gh * 0.85: continue   # specks, divider lines, and a cross of dividers
            out.append((min(xs) * S, min(ys) * S, (max(xs) + 1) * S, (max(ys) + 1) * S))
    out = [b for b in out if not any(o != b and o[0] <= b[0] and o[1] <= b[1] and o[2] >= b[2] and o[3] >= b[3] for o in out)]   # a piece inside another (the sun's disc in its rays) is part of it
    return sorted(out, key=lambda b: (int((b[1] + b[3]) / 2 // (H / rows)), b[0]))
def cutout(im, bb, h=None, w=None):
    c = im.crop((bb[0] - 4, bb[1] - 4, bb[2] + 4, bb[3] + 4)).convert('RGBA'); px = c.load()
    for y in range(c.height):
        for x in range(c.width):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b): px[x, y] = (0, 0, 0, 0)
    c = c.crop(c.getbbox())
    s = (h / c.height) if h else (w / c.width)
    c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
    a = c.getchannel('A').point(lambda v: 255 if v > 120 else 0)
    rgb = c.convert('RGB').quantize(32, dither=Image.Dither.NONE).convert('RGB').convert('RGBA'); rgb.putalpha(a)
    return rgb
SRC = 'encounters/src/ui/'
def sheet(name, rows, ids, grow=0, **size):
    im = Image.open(SRC + name + '.jpg').convert('RGB'); found = blobs(im, rows, grow)
    assert len(found) == len(ids), (name, len(found), 'pieces, expected', len(ids))
    for id, bb in zip(ids, found):
        cutout(im, bb, **(size[id] if id in size else size['all'])).save(SRC + id + '.png')
sheet('meter_icons', 2, ['icon-health', 'icon-energy', 'icon-food', 'icon-hope'], all={'h': 14})
sheet('map_icons', 2, ['icon-move', 'icon-day', 'icon-night', 'icon-home'], all={'h': 14})
sheet('weapons_icon', 1, ['w-makeshift', 'w-itak', 'w-arnis', 'w-pipe', 'w-fist'], grow=1, all={'h': 26}, **{'w-fist': {'h': 18}})
# the battery: a new loot item, alongside the others in items/
im = Image.open(SRC + 'battery_icon.jpg').convert('RGB'); bb = blobs(im, 1)
union = (min(b[0] for b in bb), min(b[1] for b in bb), max(b[2] for b in bb), max(b[3] for b in bb))   # four cells: one item
cutout(im, union, w=16).save('encounters/src/items/batteries.png')
# the bag opening: 2x2 frames, each centred on the same bottom line
im = Image.open(SRC + 'bag_animation.jpg').convert('RGB'); hw, hh = im.width // 2, im.height // 2   # a clean 2x2 grid: cut by cell, inside the gutters
bb = [(cx * hw + 16, cy * hh + 16, (cx + 1) * hw - 16, (cy + 1) * hh - 16) for cy in (0, 1) for cx in (0, 1)]
frames = [cutout(im, b, h=44) for b in bb]; fw = max(f.width for f in frames); fh = max(f.height for f in frames)
strip = Image.new('RGBA', (fw * 4, fh), (0, 0, 0, 0))
for i, f in enumerate(frames): strip.alpha_composite(f, (i * fw + (fw - f.width) // 2, fh - f.height))
strip.save(SRC + 'bag-open.png'); json.dump({'w': fw, 'h': fh}, open(SRC + 'bag-open.json', 'w'))
# End Demo backdrop: Tutuban at dawn, pixelated to the screen and darkened so the text sits on it
t = Image.open(SRC + 'outside_tutuban.jpg').convert('RGB'); s = max(110 / t.width, 225 / t.height)
t = t.resize((round(t.width * s), round(t.height * s)), Image.LANCZOS); x = (t.width - 110) // 2; y = (t.height - 225) // 2
t = t.crop((x, y, x + 110, y + 225)).quantize(48, dither=Image.Dither.NONE).convert('RGB')
ImageEnhance.Brightness(t).enhance(0.55).save(SRC + 'end-tutuban.png')
# contact sheet to check
ids = ['icon-health', 'icon-energy', 'icon-food', 'icon-hope', 'icon-move', 'icon-day', 'icon-night', 'icon-home', 'w-makeshift', 'w-itak', 'w-arnis', 'w-pipe', 'w-fist']
cs = Image.new('RGBA', (30 * len(ids) + 40 + fw * 4, 48), (40, 34, 30, 255)); x = 0
for id in ids: i = Image.open(SRC + id + '.png'); cs.alpha_composite(i, (x, 48 - i.height)); x += 30
b = Image.open('encounters/src/items/batteries.png'); cs.alpha_composite(b, (x, 48 - b.height)); x += 30
cs.alpha_composite(strip, (x, 48 - fh)); cs.resize((cs.width * 3, cs.height * 3), Image.NEAREST).save('encounters/tmp/ui-x3.png'); print('ok', fw, fh)
