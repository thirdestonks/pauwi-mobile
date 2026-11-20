# The Brute (Tutuban's guardian): three paintings on magenta -> combat sprite strips in the Shambler's format
# (brute-h{H}-{anim}.png + brute-anim.json), at six sizes 1.5x the Shambler's, so he towers on the grid.
from PIL import Image, ImageOps
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
def is_bg(r, g, b): return r > g + 40 and b > g + 20               # the magenta (and its jpeg/edge noise)
def cut(name):
    im = Image.open(os.path.join(HERE, f'painted-brute-{name}.png')).convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b): px[x, y] = (0, 0, 0, 0)
    return im.crop(im.getbbox())
IDLE, ATTACK, DEAD = cut('idle'), cut('attack'), cut('dead')
SIZES = [24, 33, 44, 57, 72, 90]                                     # standing height in px, nearest-to-depth is picked in combat
ANIMS = {'idle': [800, 800], 'attack': [200, 180, 140, 120, 160, 140, 160], 'hit': [60, 80, 90, 100], 'death': [60, 90, 110, 90, 110, 240, 700]}
def fit(src, H, height=None, width=None):                            # scale a painting so his standing height is H
    s = (height or H) / src.height if width is None else width / src.width
    return src.resize((max(1, round(src.width * s)), max(1, round(src.height * s))), Image.LANCZOS)
def harden(im):                                                      # crisp pixel edges: no soft alpha
    a = im.getchannel('A').point(lambda v: 255 if v > 120 else 0); im.putalpha(a); return im
def white(im):                                                       # the hit flash: his silhouette in bone white
    w = Image.new('RGBA', im.size, (236, 228, 213, 255)); w.putalpha(im.getchannel('A')); return w
def frames_for(H):
    fw, fh = round(H * 1.7), round(H * 1.45); px, py = fw // 2, fh - 2
    def place(sprite, dx=0, dy=0, rot=0):                            # feet on the anchor, centred
        f = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        if rot: sprite = sprite.rotate(rot, resample=Image.BICUBIC, expand=True)
        f.alpha_composite(sprite, (round(px - sprite.width / 2 + dx), round(py - sprite.height + dy)))
        return harden(f)
    idle = fit(IDLE, H); breath = idle.resize((idle.width, max(1, round(idle.height * 0.975))), Image.LANCZOS)
    lean = fit(IDLE, H * 1.02)
    up = fit(ATTACK, H * 1.18)                                         # arms raised above his head: taller than he stands
    smash = up.resize((round(up.width * 1.1), round(up.height * 0.92)), Image.LANCZOS)   # the swing coming down: wider, lower, closer
    # the face-down painting is foreshortened toward the viewer (taller than wide): squash it flat so he lies ON the floor
    flat = lambda w, h: DEAD.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    dead = flat(H * 1.2, H * 0.42)
    pool = Image.new('RGBA', (round(H * 1.1), max(2, round(H * 0.08))), (0, 0, 0, 0))
    from PIL import ImageDraw
    ImageDraw.Draw(pool).ellipse((0, 0, pool.width - 1, pool.height - 1), fill=(110, 18, 16, 255))
    dead_pool = Image.new('RGBA', (max(dead.width, pool.width), dead.height + pool.height // 2), (0, 0, 0, 0))
    dead_pool.alpha_composite(pool, ((dead_pool.width - pool.width) // 2, dead_pool.height - pool.height)); dead_pool.alpha_composite(dead, ((dead_pool.width - dead.width) // 2, 0))
    return {
        'idle': [place(idle), place(breath)],
        'attack': [place(idle), place(lean, dy=1), place(up), place(smash, dy=2), place(up, dy=1), place(lean), place(idle)],
        'hit': [place(white(idle)), place(idle, dx=2), place(idle, dx=-1), place(idle)],
        'death': [place(white(idle)), place(idle, dx=1), place(idle, rot=-7), place(flat(H * 0.95, H * 0.62)), place(dead), place(dead_pool), place(dead_pool)],
    }, {'w': fw, 'h': fh, 'px': px, 'py': py}
meta = {'sizes': {}, 'anims': ANIMS, 'impact': {'attack': 3}}
for H in SIZES:
    fr, m = frames_for(H); meta['sizes'][str(H)] = m
    for an, fs in fr.items():
        strip = Image.new('RGBA', (m['w'] * len(fs), m['h']), (0, 0, 0, 0))
        for i, f in enumerate(fs): strip.alpha_composite(f, (i * m['w'], 0))
        rgb = strip.convert('RGB').quantize(48, dither=Image.Dither.NONE).convert('RGB').convert('RGBA'); rgb.putalpha(strip.getchannel('A'))
        rgb.save(os.path.join(HERE, f'brute-h{H}-{an}.png'))
json.dump(meta, open(os.path.join(HERE, 'brute-anim.json'), 'w'))
print('ok', {H: meta['sizes'][str(H)] for H in (24, 90)})
