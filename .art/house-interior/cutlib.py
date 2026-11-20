# Shared helpers for turning a magenta-background art sheet into separate sprites.
# Plain Python + PIL on purpose (no numpy on this machine).
#
# Steps: flood-fill the magenta background in from the sheet edge (so pink parts of an object that are
# enclosed by its outline survive), group what is left into shapes (a small dilation joins loose bits such
# as a lamp on a nightstand), and cut each shape out with a clean alpha.
from PIL import Image, ImageFilter, ImageDraw


def magenta_like(r, g, b):
    return g < 120 and r > 90 and b > 90 and abs(r - b) < 100 and (r + b) / 2 - g > 60


def bg_mask(im):
    """bytearray, 1 where the pixel is background magenta reachable from the sheet border."""
    w, h = im.size
    px = im.load()
    cand = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if magenta_like(r, g, b):
                cand[y * w + x] = 1
    bg = bytearray(w * h)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if cand[i] and not bg[i]:
                bg[i] = 1
                stack.append(i)
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if cand[i] and not bg[i]:
                bg[i] = 1
                stack.append(i)
    while stack:
        i = stack.pop()
        x, y = i % w, i // w
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if cand[j] and not bg[j]:
                    bg[j] = 1
                    stack.append(j)
    return bg


def shapes(im, join=7, min_area=300):
    """List of dicts {bbox, mask(bytearray w*h of this shape's pixels)} for every foreground shape."""
    w, h = im.size
    bg = bg_mask(im)
    fg = Image.new('L', (w, h))
    fg.putdata([0 if b else 255 for b in bg])
    big = fg.filter(ImageFilter.MaxFilter(join * 2 + 1)) if join else fg
    bd = big.tobytes()
    fd = fg.tobytes()
    label = [0] * (w * h)
    out = []
    n = 0
    for s in range(w * h):
        if bd[s] and not label[s]:
            n += 1
            label[s] = n
            stack = [s]
            x0 = y0 = 10 ** 9
            x1 = y1 = -1
            pix = []
            while stack:
                i = stack.pop()
                x, y = i % w, i // w
                if fd[i]:
                    pix.append(i)
                    if x < x0: x0 = x
                    if x > x1: x1 = x
                    if y < y0: y0 = y
                    if y > y1: y1 = y
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            j = ny * w + nx
                            if bd[j] and not label[j]:
                                label[j] = n
                                stack.append(j)
            if len(pix) >= min_area:
                m = bytearray(w * h)
                for i in pix:
                    m[i] = 1
                out.append({'bbox': (x0, y0, x1 + 1, y1 + 1), 'mask': m, 'area': len(pix)})
    return out


def reading_order(items, row_tol=None):
    """Sort shapes into rows (by vertical centre) then left to right."""
    cs = sorted(items, key=lambda s: (s['bbox'][1] + s['bbox'][3]) / 2)
    rows = []
    for s in cs:
        cy = (s['bbox'][1] + s['bbox'][3]) / 2
        tol = row_tol or max(40, (s['bbox'][3] - s['bbox'][1]) * 0.45)
        if rows and abs(cy - rows[-1]['cy']) < tol:
            rows[-1]['items'].append(s)
            rows[-1]['cy'] = sum((t['bbox'][1] + t['bbox'][3]) / 2 for t in rows[-1]['items']) / len(rows[-1]['items'])
        else:
            rows.append({'cy': cy, 'items': [s]})
    ordered = []
    for r in rows:
        ordered += sorted(r['items'], key=lambda s: s['bbox'][0])
    return ordered


def cut(im, shape, erode=1):
    """RGBA crop of one shape: its own pixels only, edge eroded to drop JPEG pink fringe."""
    w, h = im.size
    x0, y0, x1, y1 = shape['bbox']
    cw, ch = x1 - x0, y1 - y0
    a = Image.new('L', (cw, ch))
    m = shape['mask']
    px = im.load()

    def hole(x, y):
        # background seen through an enclosed gap (chair back, bed rails, mesh doors): strict magenta only
        r, g, b = px[x0 + x, y0 + y]
        return g < 80 and r > 140 and b > 140 and abs(r - b) < 80

    a.putdata([255 if m[(y0 + y) * w + x0 + x] and not hole(x, y) else 0 for y in range(ch) for x in range(cw)])
    if erode:
        a = a.filter(ImageFilter.MinFilter(erode * 2 + 1))
    rgba = im.crop((x0, y0, x1, y1)).convert('RGBA')
    rgba.putalpha(a)
    return rgba


def numbered_contact(im, items, path, scale=0.5):
    d = im.copy()
    dr = ImageDraw.Draw(d)
    for i, s in enumerate(items):
        x0, y0, x1, y1 = s['bbox']
        dr.rectangle((x0, y0, x1, y1), outline=(0, 255, 0), width=2)
        dr.text((x0 + 4, y0 + 4), str(i), fill=(255, 255, 0))
    if scale != 1:
        d = d.resize((int(d.width * scale), int(d.height * scale)))
    d.save(path)
