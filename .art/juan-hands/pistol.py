# The 9mm pistol, classic 90s-shooter style: a 5x2 sheet on cyan (src/juan_gun_9mm.jpg) -> out/pistol-idle/attack/raise.png,
# added to out/manifest.json next to the melee weapons. render.cjs rewrites the manifest for the melee weapons: run this after it.
# Sheet cells: 1 empty; 2 firing (muzzle flash), 3 one-handed aim, 9 casing ejecting; 4-8, 10 two-handed (not used: one hand reads better).
from PIL import Image
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); W, H = 110, 225
sheet = Image.open(os.path.join(HERE, 'src', 'juan_gun_9mm.jpg')).convert('RGBA'); cw, ch = sheet.width // 5, sheet.height // 2
def is_bg(r, g, b): return g > 150 and b > 150 and r < 120          # the cyan (and its jpeg fringe)
def cell(n):                                                         # 1-based, reading order, inside the gutters
    c = sheet.crop(((n - 1) % 5 * cw + 12, (n - 1) // 5 * ch + 12, ((n - 1) % 5 + 1) * cw - 12, ((n - 1) // 5 + 1) * ch)).copy(); px = c.load()
    for y in range(c.height):
        for x in range(c.width):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b): px[x, y] = (0, 0, 0, 0)
            elif r > g + 15 and g > b and r < 170: px[x, y] = (round(r * .72), round(g * .72), round(b * .72), a)   # the glove's browns, darker (skin, tape, gun, flash and brass untouched)
    return c
CELL_W = 130                                                         # every cell scaled the same, so the gun keeps its drawn position
# where the drawing sits inside its cells (union over every frame we use): pinned so the hands run off the bottom-right corner,
# like the melee weapons, and the gun points in toward the street instead of covering the grid
def _scaled(n): c = cell(n); return c.resize((CELL_W, round(c.height * CELL_W / c.width)), Image.LANCZOS)
_boxes = [_scaled(n).getbbox() for n in (2, 3, 9)]
RIGHT, BOTTOM = max(b[2] for b in _boxes), max(b[3] for b in _boxes)
def frame(n, dy=0):
    c = _scaled(n); a = c.getchannel('A').point(lambda v: 255 if v > 120 else 0); c.putalpha(a)
    f = Image.new('RGBA', (W, H), (0, 0, 0, 0)); f.alpha_composite(c, (W - RIGHT + 14, H - BOTTOM + 6 + dy))   # hands off the bottom-right edge
    return f
def strip(frames, name):
    s = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames): s.alpha_composite(f, (i * W, 0))
    rgb = s.convert('RGB').quantize(48, dither=Image.Dither.NONE).convert('RGB').convert('RGBA'); rgb.putalpha(s.getchannel('A'))
    rgb.save(os.path.join(HERE, 'out', f'pistol-{name}.png'))
strip([frame(3), frame(3, -1), frame(3, -1), frame(3)], 'idle')                     # one-handed aim, a slow bob
strip([frame(3), frame(2), frame(9), frame(3)], 'attack')                            # aim, BANG (flash), the casing flies, back on aim
strip([frame(3, 46), frame(3, 22), frame(3, 8), frame(3)], 'raise')                  # coming up from below when equipped
m = json.load(open(os.path.join(HERE, 'out', 'manifest.json')))
m['anims']['pistol-idle'] = [{'ms': 300, 'shake': 0}] * 4
m['anims']['pistol-attack'] = [{'ms': 60, 'shake': 0}, {'ms': 90, 'shake': 3}, {'ms': 120, 'shake': 0}, {'ms': 120, 'shake': 0}]
m['anims']['pistol-raise'] = [{'ms': 60, 'shake': 0}] * 4
json.dump(m, open(os.path.join(HERE, 'out', 'manifest.json'), 'w'))
print('ok')
