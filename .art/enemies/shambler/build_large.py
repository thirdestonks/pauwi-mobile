# Larger Shamblers for the in-house fight (InteriorCombatScreen.vue): the same three paintings as the street sprites, baked at
# 72 and 92 px standing height, in the Shambler's own strip format (shambler-h{H}-{anim}.png). The street sizes (16..60) and
# their strips are left alone; this only ADDS sizes to shambler-anim.json. Same choreography as the street Shambler: a lunge for
# the attack, a white flash for a hit, a stagger back and a fall for the death.
# Run from anywhere: python .art/enemies/shambler/build_large.py   (then python .art/export_to_app.py)
from PIL import Image, ImageDraw
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SIZES = [72, 92]


def is_bg(r, g, b):
    return r > g + 40 and b > g + 20                    # the magenta (and its jpeg/edge noise)


def cut(name):
    im = Image.open(os.path.join(HERE, f'painted-shambler-{name}.png')).convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    return im.crop(im.getbbox())


IDLE, ATTACK, DEAD = cut('idle'), cut('attack'), cut('dead')


def fit(src, h):
    s = h / src.height
    return src.resize((max(1, round(src.width * s)), max(1, round(src.height * s))), Image.LANCZOS)


def harden(im):                                          # crisp pixel edges: no soft alpha
    a = im.getchannel('A').point(lambda v: 255 if v > 120 else 0)
    im.putalpha(a)
    return im


def white(im):                                           # the hit flash: his silhouette in bone white
    w = Image.new('RGBA', im.size, (236, 228, 213, 255))
    w.putalpha(im.getchannel('A'))
    return w


def frames_for(H):
    fw, fh = round(H * 1.7), round(H * 1.45)
    px, py = fw // 2, fh - 2

    def place(sprite, dx=0, dy=0, rot=0):                # feet on the anchor, centred
        f = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        if rot:
            sprite = sprite.rotate(rot, resample=Image.BICUBIC, expand=True)
        f.alpha_composite(sprite, (round(px - sprite.width / 2 + dx), round(py - sprite.height + dy)))
        return harden(f)

    idle = fit(IDLE, H)
    breath = idle.resize((idle.width, max(1, round(idle.height * 0.975))), Image.LANCZOS)
    lean = fit(IDLE, H * 1.02)
    lunge = fit(ATTACK, H * 1.02)                        # arms out, coming at you
    reach = lunge.resize((round(lunge.width * 1.12), round(lunge.height * 1.08)), Image.LANCZOS)   # the grab: bigger, closer
    flat = lambda w, h: DEAD.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    dead = flat(H * 1.15, H * 0.40)
    pool = Image.new('RGBA', (round(H * 1.05), max(2, round(H * 0.08))), (0, 0, 0, 0))
    ImageDraw.Draw(pool).ellipse((0, 0, pool.width - 1, pool.height - 1), fill=(110, 18, 16, 255))
    dead_pool = Image.new('RGBA', (max(dead.width, pool.width), dead.height + pool.height // 2), (0, 0, 0, 0))
    dead_pool.alpha_composite(pool, ((dead_pool.width - pool.width) // 2, dead_pool.height - pool.height))
    dead_pool.alpha_composite(dead, ((dead_pool.width - dead.width) // 2, 0))
    return {
        'idle': [place(idle), place(breath)],
        'attack': [place(idle), place(lean, dy=1), place(lunge), place(reach, dy=2), place(lunge, dy=1), place(lean), place(idle)],
        'hit': [place(white(idle)), place(idle, dx=2), place(idle, dx=-1), place(idle)],
        'death': [place(white(idle)), place(idle, dx=1), place(idle, rot=-7), place(flat(H * 0.95, H * 0.62)), place(dead), place(dead_pool), place(dead_pool)],
    }, {'w': fw, 'h': fh, 'px': px, 'py': py}


meta_path = os.path.join(HERE, 'shambler-anim.json')
meta = json.load(open(meta_path))
for H in SIZES:
    fr, m = frames_for(H)
    meta['sizes'][str(H)] = m
    for an, fs in fr.items():
        strip = Image.new('RGBA', (m['w'] * len(fs), m['h']), (0, 0, 0, 0))
        for i, f in enumerate(fs):
            strip.alpha_composite(f, (i * m['w'], 0))
        rgb = strip.convert('RGB').quantize(48, dither=Image.Dither.NONE).convert('RGB').convert('RGBA')
        rgb.putalpha(strip.getchannel('A'))
        rgb.save(os.path.join(HERE, f'shambler-h{H}-{an}.png'))
json.dump(meta, open(meta_path, 'w'))
print('added sizes', SIZES, '->', {H: meta['sizes'][str(H)] for H in SIZES})
