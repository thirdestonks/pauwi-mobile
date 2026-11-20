# Juan's phone, first person: the 3-panel Nano Banana sheet (src/phone-map-sheet.png: a gloved hand and a cracked
# phone with a flat #00FF00 screen, on near-black, panels split by magenta) -> out/phone-hand.png, a strip of
# three 110x225 frames, and out/phone-hand.json with each frame's screen rectangle.
# Each frame: scaled to the canvas height and centred on the phone, the glove's green screen-spill cooled to teal,
# the surroundings sunk to black with a candle-like falloff, quantised like the weapon hands, and the screen cut
# out as a transparent hole so the game's live map shows through (the thumb in frame 3 stays on top).
# Sheet order: 1 pulled out (back of the phone), 2 held steady, 3 thumb on the glass. The game plays 1 -> 3 -> 2.
# Run from anywhere: python .art/phone-map/build.py   (then python export_to_app.py from .art/)
from PIL import Image
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__)); W, H = 110, 225
sheet = Image.open(os.path.join(HERE, 'src', 'phone-map-sheet.png')).convert('RGB')

def is_magenta(p): return p[0] > 200 and p[2] > 200 and p[1] < 80
def is_screen(p): return p[1] > 170 and p[0] < 140 and p[2] < 140 and p[1] - max(p[0], p[2]) > 70

def panels():
    """Column runs between the magenta gutters, and the row run inside the frame border."""
    px = sheet.load(); y = sheet.height // 2; runs, start = [], None
    for x in range(sheet.width):
        m = is_magenta(px[x, y])
        if not m and start is None: start = x
        if m and start is not None: runs.append((start, x)); start = None
    x = runs[0][0] + 20; top = next(yy for yy in range(sheet.height) if not is_magenta(px[x, yy]))
    bottom = next(yy for yy in range(sheet.height - 1, 0, -1) if not is_magenta(px[x, yy]))
    return [(a + 3, top + 3, b - 3, bottom - 3) for a, b in runs]          # inset past the magenta fringe

def screen_box(img):
    px = img.load(); xs, ys = [], []
    for y in range(img.height):
        for x in range(img.width):
            if is_screen(px[x, y]): xs.append(x); ys.append(y)
    return (min(xs), min(ys), max(xs), max(ys)) if len(xs) > 400 else None

frames, rects = [], []
boxes = [sheet.crop(b) for b in panels()]
held = screen_box(boxes[1])                                               # frame 2's phone pins the crop for all three
for i, panel in enumerate(boxes):
    scale = H / panel.height
    big = panel.resize((round(panel.width * scale), H), Image.LANCZOS)
    cx = round((held[0] + held[2]) / 2 * scale)                            # centre on the phone
    left = max(0, min(big.width - W, cx - W // 2))
    f = big.crop((left, 0, left + W, H)).convert('RGBA'); px = f.load()
    sb = screen_box(f)
    # the light: brightest at the phone, falling into black — a candle pocket, banded in steps
    lx, ly = (W / 2, H * 0.42) if not sb else ((sb[0] + sb[2]) / 2, (sb[1] + sb[3]) / 2)
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if is_screen((r, g, b)):
                px[x, y] = (0, 0, 0, 0); continue                          # the hole the live map shows through
            ex = g - max(r, b)
            if ex > 8:                                                     # green spill on the glove -> cool screen light
                g -= ex * 0.55; b += ex * 0.4; r += ex * 0.05
            d = math.hypot((x - lx) / 62, (y - ly) / 88)
            k = max(0.0, min(1.0, 1.35 - d * d * 0.85))
            k = math.floor(k * 6) / 6                                     # banded, like the map's light
            lum = (r + g + b) / 3
            if lum < 34: k *= 0.25                                         # the painted near-black goes to true black
            px[x, y] = (round(r * k), round(g * k), round(b * k), 255)
    frames.append(f)
    rects.append(None if not sb else {'x': sb[0], 'y': sb[1], 'w': sb[2] - sb[0] + 1, 'h': sb[3] - sb[1] + 1})

strip = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
for i, f in enumerate(frames): strip.alpha_composite(f, (i * W, 0))
alpha = strip.getchannel('A')
rgb = strip.convert('RGB').quantize(56, dither=Image.Dither.NONE).convert('RGB').convert('RGBA'); rgb.putalpha(alpha)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
rgb.save(os.path.join(HERE, 'out', 'phone-hand.png'))
json.dump({'w': W, 'h': H, 'frames': len(frames), 'screens': rects, 'open': [0, 2, 1], 'rest': 1, 'drag': 2},
          open(os.path.join(HERE, 'out', 'phone-hand.json'), 'w'), indent=1)
print('ok', rects)
