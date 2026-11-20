# Item sheets (2x2 on magenta) -> keyed, shrunk, outlined item sprites for the encounter scenes
from PIL import Image
import base64, json
# sheet -> (columns, rows, ids in reading order)
SHEETS = { 'sheet-1.png': (2, 2, ['sledge', 'pipe', 'flares', 'straps']), 'sheet-2.png': (2, 2, ['firstaid', 'jerrycan', 'water', 'butane']),
  'sheet-3.png': (2, 2, ['beef', 'rice', 'sardines', 'meds']),
  'sheet-botika.jpg': (3, 2, ['bandage', 'gauze', 'antibiotics', 'alcohol', 'vitamins', 'painkillers']),
  'sheet-kwikmart.jpg': (2, 2, ['noodles', 'tuna', 'crackers', 'matches']), 'sheet-kainan.jpg': (2, 2, ['tuyo', 'kaldero', 'knife', 'eggs']) }
WIDTH = { 'bandage': 11, 'gauze': 11, 'antibiotics': 14, 'alcohol': 9, 'vitamins': 10, 'painkillers': 10, 'noodles': 16, 'tuna': 13, 'crackers': 16, 'matches': 13, 'tuyo': 12, 'kaldero': 14, 'knife': 12, 'eggs': 14, 'sledge': 26, 'pipe': 24, 'flares': 17, 'straps': 22, 'firstaid': 18, 'jerrycan': 14, 'water': 18, 'butane': 16, 'beef': 13, 'rice': 12, 'sardines': 13, 'meds': 15 }
def is_bg(r, g, b): return r > g + 40 and b > g + 20                       # any magenta-ish pink, its jpeg noise and its drop shadows
out = {}
def blobs(im, rows):                                                   # find each item as its own connected shape, in reading order
    W, H = im.size; S = 4; px = im.load()
    gw, gh = W // S, H // S
    m = [[not is_bg(*px[x * S + S // 2, y * S + S // 2][:3]) for x in range(gw)] for y in range(gh)]
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
            if len(xs) < 150 or bw > gw * 0.9 or bh > gh * 0.9 or min(bw, bh) < 4: continue          # specks, borders, divider lines
            out.append((min(xs) * S, min(ys) * S, (max(xs) + 1) * S, (max(ys) + 1) * S))
    return sorted(out, key=lambda b: (int((b[1] + b[3]) / 2 // (H / rows)), b[0]))
for sheet, (cols, rows, ids) in SHEETS.items():
    im = Image.open(f'src/items/{sheet}').convert('RGBA'); found = blobs(im, rows)
    if len(found) != len(ids): print('!!', sheet, 'found', len(found), 'items, expected', len(ids)); continue
    for id, bb in zip(ids, found):
        cell = im.crop((bb[0] - 4, bb[1] - 4, bb[2] + 4, bb[3] + 4)).copy()
        px = cell.load()
        for y in range(cell.height):
            for x in range(cell.width):
                r, g, b, a = px[x, y]
                if is_bg(r, g, b): px[x, y] = (0, 0, 0, 0)
        cell = cell.crop(cell.getbbox())
        w = WIDTH[id]; h = max(1, round(cell.height * w / cell.width))
        sm = cell.resize((w, h), Image.LANCZOS)
        # hard alpha, then a dark outline round the shape, on a canvas 1px bigger each side
        o = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0)); sp = sm.load(); op = o.load()
        solid = [[sp[x, y][3] > 110 for x in range(w)] for y in range(h)]
        for y in range(h):
            for x in range(w):
                if solid[y][x]: r, g, b, _ = sp[x, y]; op[x + 1, y + 1] = (r, g, b, 255)
        for y in range(h + 2):
            for x in range(w + 2):
                if op[x, y][3]: continue
                if any(0 <= x + dx - 1 < w and 0 <= y + dy - 1 < h and solid[y + dy - 1][x + dx - 1] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): op[x, y] = (16, 12, 14, 255)
        o.save(f'src/items/{id}.png'); out[id] = base64.b64encode(open(f'src/items/{id}.png', 'rb').read()).decode()
json.dump(out, open('tmp/items.json', 'w'))
# contact sheet at x6
cs = Image.new('RGBA', (34 * len(out), 30), (40, 30, 34, 255)); x = 0
for id in out: s = Image.open(f'src/items/{id}.png'); cs.alpha_composite(s, (x, 30 - s.height)); x += 34
cs.resize((cs.width * 4, cs.height * 4), Image.NEAREST).save('tmp/items-x4.png'); print('ok', len(out))
