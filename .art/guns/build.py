# Cuts the first-person gun frames (Pictures/pauwi-assets, painted one still at a time with Nano Banana) into game sprites:
# every frame is lined up on its gun's rest frame (the painter drew each one at a slightly different size and place), then all of a
# gun's frames are shrunk onto ONE shared palette so nothing flickers between them. -> out/*.png + out/guns.json
#   shotgun_idle.jpg  rest        shotgun_fire.jpg  fire (flash, smoke)   shotgun_pump_1/2.jpg  pump back (shell pops) / forward (shell flies)   shotgun_reload.jpg  a shell going in
#   m4_fp.jpg         rest        m4_fire.jpg       fire (flash, casing)  m4_reload_1/2/3   magazine out / in / racked
#   shotgun_fp.jpg    the side view: the bag icon        weapon_upgrade_stars.jpg  the 1/2/3-star badges
# Run: python .art/guns/build.py
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'house-interior'))
import cutlib

SRC = Path(r'C:/Users/Thirde/Pictures/pauwi-assets')
OUT = HERE / 'out'
OUT.mkdir(exist_ok=True)
W_OUT = 110                     # a frame is the full width of the combat screen (110 native pixels)
meta = {}

GUNS = {
    'shotgun': {'rest': 'shotgun_idle', 'fire': 'shotgun_fire', 'pump1': 'shotgun_pump_1', 'pump2': 'shotgun_pump_2', 'load': 'shotgun_reload'},
    'm4': {'rest': 'm4_fp', 'fire': 'm4_fire', 'reload1': 'm4_reload_1', 'reload2': 'm4_reload_2', 'reload3': 'm4_reload_3'},
}


def load(name):
    a = np.asarray(Image.open(SRC / f'{name}.jpg').convert('RGB')).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lo = np.minimum(r, b)
    bg = (g < 0.45 * lo) & (lo > 70) & (np.abs(r - b) < 0.45 * np.maximum(r, b))           # the magenta backdrop
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    sat = np.max(a, 2) - np.min(a, 2)
    fx = (~bg) & (((lum > 150) & (r > b + 40)) | ((sat < 30) & (lum > 95)) | ((r > 150) & (g < 90)))   # flash, smoke, shells
    return a.astype(np.uint8), ~bg, (~bg) & ~fx


def best_fit(ref, mov, small=160):
    """Scale and offset that lay `mov`'s gun on `ref`'s, searched on small masks: scale by steps, offset by FFT cross-correlation."""
    k = small / ref.shape[1]
    R = np.asarray(Image.fromarray(ref.astype(np.uint8) * 255).resize((small, round(ref.shape[0] * k)), Image.BILINEAR)) / 255.0
    best = (-1, 1, 0, 0)
    for s in np.arange(0.80, 1.22, 0.01):
        w, h = round(mov.shape[1] * k * s), round(mov.shape[0] * k * s)
        M = np.asarray(Image.fromarray(mov.astype(np.uint8) * 255).resize((w, h), Image.BILINEAR)) / 255.0
        H, Wd = R.shape[0] + h, R.shape[1] + w
        c = np.real(np.fft.ifft2(np.fft.fft2(R, (H, Wd)) * np.conj(np.fft.fft2(M, (H, Wd)))))
        iy, ix = np.unravel_index(np.argmax(c), c.shape)
        dy, dx = (iy if iy < H - h else iy - H), (ix if ix < Wd - w else ix - Wd)
        score = c[iy, ix] / np.sqrt(R.sum() * M.sum())
        if score > best[0]: best = (score, s, dx / k, dy / k)
    return best


def place(name, ref_shape, s, dx, dy):
    """The frame, scaled by s and moved by (dx, dy), on a canvas the size of the rest frame. Alpha = not magenta."""
    rgb, fg, _ = load(name)
    im = Image.fromarray(rgb).convert('RGBA'); im.putalpha(Image.fromarray(fg.astype(np.uint8) * 255))
    # resize premultiplied ('RGBa'): the transparent pixels are magenta underneath, and a plain resize bleeds that into the edges
    im = im.convert('RGBa').resize((round(im.width * s), round(im.height * s)), Image.LANCZOS).convert('RGBA')
    canvas = Image.new('RGBA', (ref_shape[1], ref_shape[0]), (0, 0, 0, 0))
    canvas.alpha_composite(im, (round(dx), round(dy))) if dx >= 0 and dy >= 0 else canvas.paste(im, (round(dx), round(dy)), im)
    return canvas


def shrink_all(frames, colors=48):
    """All of one gun's frames to W_OUT wide, on one palette taken from all of them together; alpha kept hard."""
    h = round(frames[0].height * W_OUT / frames[0].width)
    small = [f.convert('RGBa').resize((W_OUT, h), Image.LANCZOS).convert('RGBA') for f in frames]
    strip = Image.new('RGB', (W_OUT * len(small), h), (0, 0, 0))
    for i, f in enumerate(small): strip.paste(f.convert('RGB'), (i * W_OUT, 0), f)
    # The flash, sparks and casings are a few pixels against a whole black rifle: on their own they'd get the palette's leftovers
    # (the M4's flash came out beige). So the palette is built from the frames PLUS a block of just their bright, saturated pixels.
    px = np.concatenate([np.asarray(f.convert('RGB')).reshape(-1, 3)[np.asarray(f.getchannel('A')).reshape(-1) > 110] for f in small])
    lum, sat = px @ [0.3, 0.59, 0.11], px.max(1).astype(int) - px.min(1)
    hot = px[(lum > 140) | (sat > 90)]
    if len(hot):
        n = (strip.height // 3) * strip.width                      # whole rows
        block = Image.fromarray(np.resize(hot, (n, 3)).reshape(-1, strip.width, 3).astype(np.uint8))
        both = Image.new('RGB', (strip.width, strip.height + block.height)); both.paste(strip, (0, 0)); both.paste(block, (0, strip.height))
        strip = both
    pal = strip.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = []
    for f in small:
        q = f.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGBA')
        q.putalpha(f.getchannel('A').point(lambda v: 255 if v > 110 else 0))
        out.append(q)
    return out


for gun, frames in GUNS.items():
    rest_rgb, rest_fg, rest_body = load(frames['rest'])
    placed, fits = {}, {}
    for key, name in frames.items():
        if key == 'rest':
            s, dx, dy, score = 1.0, 0.0, 0.0, 1.0
        else:
            score, s, dx, dy = best_fit(rest_body, load(name)[2])
        fits[key] = {'scale': round(float(s), 3), 'dx': round(float(dx)), 'dy': round(float(dy)), 'match': round(float(score), 3)}
        placed[key] = place(name, rest_rgb.shape, s, dx, dy)
    if gun == 'shotgun':
        # The recoil: a shotgun bucks. Rotated here, at full size, before the shrink (DESIGN.md: transform the hi-res cut-out first,
        # so a tilted frame is as crisp as the others), pivoting at the stock in the bottom-right corner, the barrel thrown UP.
        # headroom first: tilted up, the muzzle flash would run off the top of the canvas and be cut by a hard line. Padding goes on top
        # only, so the frames still line up on their bottom edge (the game draws them bottom-aligned).
        pad = round(placed['rest'].height * .25)
        for k, im in list(placed.items()):
            c = Image.new('RGBA', (im.width, im.height + pad), (0, 0, 0, 0)); c.alpha_composite(im, (0, pad)); placed[k] = c
        pivot = (placed['rest'].width * .97, placed['rest'].height * .99)
        tilt = lambda im, deg: im.convert('RGBa').rotate(-deg, resample=Image.BICUBIC, center=pivot).convert('RGBA')
        placed['fireup'] = tilt(placed['fire'], 8); fits['fireup'] = {**fits['fire'], 'tilt': 8}
        placed['restup5'] = tilt(placed['rest'], 5); fits['restup5'] = {**fits['rest'], 'tilt': 5}
        placed['restup2'] = tilt(placed['rest'], 2); fits['restup2'] = {**fits['rest'], 'tilt': 2}
    small = shrink_all(list(placed.values()))
    for (key, _), im in zip(placed.items(), small):
        n = f'{gun}-{key}'
        im.save(OUT / f'{n}.png', optimize=True)
        meta[n] = {'w': im.width, 'h': im.height, 'fit': fits[key]}
    print(gun, fits)

# the bag icon (side view) and the star badges
im, sh = Image.open(SRC / 'shotgun_fp.jpg').convert('RGB'), None
sh = cutlib.reading_order(cutlib.shapes(im, join=6, min_area=300))
icon = cutlib.cut(im, sh[0])
icon = icon.resize((44, round(icon.height * 44 / icon.width)), Image.LANCZOS)
icon.putalpha(icon.getchannel('A').point(lambda v: 255 if v > 110 else 0)); icon.save(OUT / 'shotgun-icon.png'); meta['shotgun-icon'] = {'w': icon.width, 'h': icon.height}
im = Image.open(SRC / 'weapon_upgrade_stars.jpg').convert('RGB')
sh = cutlib.reading_order(cutlib.shapes(im, join=6, min_area=300))
for i, s in enumerate(sh[:3]):
    st = cutlib.cut(im, s); st = st.resize((16, round(st.height * 16 / st.width)), Image.LANCZOS)
    st.putalpha(st.getchannel('A').point(lambda v: 255 if v > 110 else 0)); st.save(OUT / f'stars-{i + 1}.png'); meta[f'stars-{i + 1}'] = {'w': st.width, 'h': st.height}
(OUT / 'guns.json').write_text(json.dumps(meta, indent=1))
print('\n'.join(f'{k:16} {v["w"]}x{v["h"]}' for k, v in meta.items()))
