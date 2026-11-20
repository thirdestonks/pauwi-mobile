# Door sheets (3x2 frames, closed -> open) -> aligned, shrunk frame strip for the map's door transition.
# Frames drift a little in Gemini's output, so each one is shifted to line up with frame 1 on the parts that don't move.
from PIL import Image, ImageChops, ImageStat
import base64, sys
def cut(sheet):
    im = Image.open(sheet).convert('RGB'); W, H = im.size; g = im.convert('L'); px = g.load()
    dark = lambda vals: [i for i, v in enumerate(vals) if v < 12]
    cols = dark([sum(px[x, y] for y in range(0, H, 2)) / (H / 2) for x in range(W)])
    rows = dark([sum(px[x, y] for x in range(0, W, 2)) / (W / 2) for y in range(H)])
    def spans(lines, n):                                       # gutters -> panel spans
        cuts, prev = [], None
        for v in lines:
            if prev is None or v != prev + 1: cuts.append([v, v])
            else: cuts[-1][1] = v
            prev = v
        edges = [0] + [c for a, b in cuts for c in (a, b + 1)] + [n]
        return [(edges[i], edges[i + 1]) for i in range(0, len(edges), 2)]
    return [im.crop((x0, y0, x1, y1)) for (y0, y1) in spans(rows, H) for (x0, x1) in spans(cols, W)]
def align(frames, still, R=14):
    ref = frames[0].convert('L'); out = [frames[0]]; x0, y0, x1, y1 = still
    for f in frames[1:]:
        g = f.convert('L'); best = (1e9, 0, 0)
        for dy in range(-R, R + 1, 2):
            for dx in range(-R, R + 1, 2):
                d = ImageStat.Stat(ImageChops.difference(ref.crop((x0, y0, x1, y1)), g.crop((x0 + dx, y0 + dy, x1 + dx, y1 + dy)))).mean[0]
                if d < best[0]: best = (d, dx, dy)
        _, dx, dy = best
        for ddy in (-1, 0, 1):                                  # refine to the pixel
            for ddx in (-1, 0, 1):
                d = ImageStat.Stat(ImageChops.difference(ref.crop((x0, y0, x1, y1)), g.crop((x0 + dx + ddx, y0 + dy + ddy, x1 + dx + ddx, y1 + dy + ddy)))).mean[0]
                if d < best[0]: best = (d, dx + ddx, dy + ddy)
        print('  shift', best[1:]); out.append(f.transform(f.size, Image.AFFINE, (1, 0, best[1], 0, 1, best[2]), Image.BICUBIC))
    return out
def strip(name, sheet, still, margin=16, W=110):
    fr = cut(sheet); print(name, len(fr), 'frames', fr[0].size)
    fr = align(fr, still)
    w, h = fr[0].size; fr = [f.crop((margin, margin, w - margin, h - margin)) for f in fr]
    H = round(fr[0].height * W / fr[0].width)
    small = [f.resize((W, H), Image.LANCZOS) for f in fr]
    s = Image.new('RGB', (W * len(small), H))
    for i, f in enumerate(small): s.paste(f, (i * W, 0))
    s = s.quantize(48, dither=Image.Dither.NONE).convert('RGB')
    s.save(f'hex-map/src/door-{name}.png'); s.resize((s.width * 3, H * 3), Image.NEAREST).save(f'encounters/tmp/door-{name}-x3.png')
    print('  strip', s.size); return base64.b64encode(open(f'hex-map/src/door-{name}.png', 'rb').read()).decode(), H

# ---------- the trunk, Resident Evil style: the car's rear alone on black, seen from above like the trunk scene ----------
# sheet: 6 frames on flat grey, laid out loosely. Every frame is anchored on its taillights (the bit that never moves),
# the grey is flooded to black, everything above the open lid fades out, and it's drawn at half resolution for chunky pixels.
def tails(px, box):
    xs, ys = [], []
    for y in range(box[1], box[3]):
        for x in range(box[0], box[2]):
            r, g, b = px[x, y]
            if r > 200 and 80 < g < 170 and b < 90: xs.append(x); ys.append(y)
    return (min(xs) + max(xs)) / 2, min(ys), max(xs) - min(xs)
def black_bg(f):                                               # flood the flat grey from the edges, shadows included, to pure black
    px = f.load(); w, h = f.size; seen = set(); st = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    flat = lambda c: max(c) - min(c) < 16 and 60 < sum(c) / 3 < 178
    while st:
        x, y = st.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        seen.add((x, y))
        if not flat(px[x, y]): continue
        px[x, y] = (0, 0, 0); st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return f
def trunk_re(sheet, cells, low=55):
    im = Image.open(sheet).convert('RGB'); px = im.load(); out = []
    for box in cells:
        cx, ty, span = tails(px, box)
        cw = round(span * 1.02); top = round(ty - 276); f = Image.new('RGB', (cw, cw * 2))
        f.paste(im.crop((round(cx - cw / 2), top, round(cx + cw / 2), top + cw * 2)), (0, 0))
        f = black_bg(f); fp = f.load(); cut = round(ty - 210) - top
        for y in range(f.height):                              # everything above the open lid fades into the black
            k = 0 if y < cut else min(1, (y - cut) / 34)
            if k < 1:
                for x in range(f.width): fp[x, y] = tuple(round(v * k) for v in fp[x, y])
        out.append(f.resize((low, low * 2 + 2), Image.LANCZOS))
    s = Image.new('RGB', (low * len(out), low * 2 + 2))
    for i, f in enumerate(out): s.paste(f, (i * low, 0))
    pal = s.quantize(30, dither=Image.Dither.NONE).getpalette()[:90] + [244, 150, 48, 196, 84, 30]   # keep the taillights orange
    pi = Image.new('P', (1, 1)); pi.putpalette(pal + [0] * (768 - len(pal)))
    s = s.quantize(palette=pi, dither=Image.Dither.NONE).convert('RGB').resize((110 * len(out), 225), Image.NEAREST)
    s.save('hex-map/src/door-trunk.png'); s.save('encounters/tmp/door-trunk-preview.png')
    return base64.b64encode(open('hex-map/src/door-trunk.png', 'rb').read()).decode()

# ---------- doors already on black (Nida's): pick the frames by box, anchor each on its door frame's top-right corner ----------
def door_re(name, sheet, boxes, low=55):
    im = Image.open(sheet).convert('RGB'); tight = []
    for b in boxes:                                            # tight box round the lit/drawn pixels in each rough region
        c = im.crop(b); m = c.convert('L').point(lambda v: 255 if v > 28 else 0); bb = m.getbbox()
        tight.append((b[0] + bb[0], b[1] + bb[1], b[0] + bb[2], b[1] + bb[3]))
    w = round(max(t[2] - t[0] for t in tight) * 1.1); h = w * 2
    hmax = max(t[3] - t[1] for t in tight); out = []
    for t in tight:                                            # same canvas for all; the door frame's corner sits at the same spot
        f = Image.new('RGB', (w, h)); ox = round(w * 0.95) - (t[2] - t[0]); oy = round((h - hmax) / 2)   # pinned on the right post (every door has its own)
        f.paste(im.crop(t), (ox, oy))
        out.append(f.resize((low, low * 2 + 2), Image.LANCZOS))
    s = Image.new('RGB', (low * len(out), low * 2 + 2))
    for i, f in enumerate(out): s.paste(f, (i * low, 0))
    s = s.quantize(32, dither=Image.Dither.NONE).convert('RGB').resize((110 * len(out), 225), Image.NEAREST)
    s.save(f'hex-map/src/door-{name}.png'); s.save(f'encounters/tmp/door-{name}-preview.png')
    return base64.b64encode(open(f'hex-map/src/door-{name}.png', 'rb').read()).decode()

def white_to_black(src, dst):                               # a sheet drawn on white: flood the white from the edges to black
    im = Image.open(src).convert('RGB'); px = im.load(); w, h = im.size; seen = bytearray(w * h)
    st = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while st:
        x, y = st.pop()
        if not (0 <= x < w and 0 <= y < h) or seen[y * w + x]: continue
        seen[y * w + x] = 1; c = px[x, y]
        if min(c) < 215 or max(c) - min(c) > 20: continue
        px[x, y] = (0, 0, 0); st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    im.save(dst)

def flat_to_black(src, dst, near, tol=16):                   # a sheet on a flat dark colour: flood it from the edges (and each cell's gutter) to black
    im = Image.open(src).convert('RGB'); px = im.load(); w, h = im.size; seen = bytearray(w * h)
    st = [(x, y) for x in range(w) for y in range(h) if (x in (0, w - 1) or y in (0, h - 1))]
    st += [(x, y) for x in range(0, w, 4) for y in range(0, h, 4) if max(abs(a - b) for a, b in zip(px[x, y], near)) <= tol]
    while st:
        x, y = st.pop()
        if not (0 <= x < w and 0 <= y < h) or seen[y * w + x]: continue
        seen[y * w + x] = 1
        if max(abs(a - b) for a, b in zip(px[x, y], near)) > tol: continue
        px[x, y] = (0, 0, 0); st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    im.save(dst)

if __name__ == '__main__':
    b = trunk_re('hex-map/src/door-trunk-sheet.png', [(0, 0, 255, 450), (255, 0, 510, 450), (510, 0, 765, 450), (0, 450, 255, 1024), (255, 450, 510, 1024), (510, 450, 765, 1024)])
    open('encounters/tmp/door-trunk.b64', 'w').write(b); print('trunk ok')
    # closed, chain loosening, chain off (top row) -> ajar, open in shadow, open with the lamplight on it (bottom row)
    b = door_re('nida', 'hex-map/src/door-nida-sheet.jpg', [(50, 10, 260, 430), (530, 10, 732, 430), (1000, 10, 1210, 430),
                                                            (50, 440, 260, 848), (735, 440, 945, 848), (530, 440, 732, 848)])
    open('encounters/tmp/door-nida.b64', 'w').write(b); print('nida ok')
    # Kwik Mart's glass door, drawn on white: frames 1, 2, 3, 5, 6 (4 swings the wrong way), the open doorway held at the end
    white_to_black('hex-map/src/door-kwik-sheet.jpg', 'encounters/tmp/door-kwik-black.png')
    c = [(0, 0, 299, 600), (299, 0, 598, 600), (598, 0, 896, 600), (0, 600, 299, 1200), (299, 600, 598, 1200), (598, 600, 896, 1200)]
    b = door_re('kwik', 'encounters/tmp/door-kwik-black.png', [c[0], c[1], c[2], c[4], c[5], c[5]])
    open('encounters/tmp/door-kwik.b64', 'w').write(b); print('kwik ok')
    # the iron security gate (shelters): 1, 2, 3, then open (4 and 5 swing it the other way), the open gate held
    c = [(0, 0, 421, 424), (421, 0, 843, 424), (843, 0, 1264, 424), (0, 424, 421, 848), (421, 424, 843, 848), (843, 424, 1264, 848)]
    open('encounters/tmp/door-gate.b64', 'w').write(door_re('gate', 'hex-map/src/door-grill-sheet.jpg', [c[0], c[1], c[2], c[5], c[5], c[5]])); print('gate ok')
    # the botika's roll-up shutter, on dark navy: flood the navy to black, cells inside their gutters
    flat_to_black('hex-map/src/door-botika-sheet.jpg', 'encounters/tmp/door-botika-black.png', (36, 44, 54), 14)
    c = [(8, 8, 335, 506), (348, 8, 676, 506), (689, 8, 1016, 506), (8, 518, 335, 1016), (348, 518, 676, 1016), (689, 518, 1016, 1016)]
    open('encounters/tmp/door-botika.b64', 'w').write(door_re('botika', 'encounters/tmp/door-botika-black.png', c)); print('botika ok')
    # the kainan's wooden door, on white (4x2; the left column is two closed doors stacked): closed, opening, wide, the candle inside
    white_to_black('hex-map/src/door-kainan-sheet.jpg', 'encounters/tmp/door-kainan-black.png')
    cell = lambda cx, cy: (cx * 352 + 6, cy * 384 + 6, (cx + 1) * 352 - 6, (cy + 1) * 384 - 6)
    open('encounters/tmp/door-kainan.b64', 'w').write(door_re('kainan', 'encounters/tmp/door-kainan-black.png', [cell(0, 0), cell(1, 0), cell(2, 0), cell(1, 1), cell(2, 1), cell(3, 1)])); print('kainan ok')
