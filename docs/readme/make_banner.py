"""README hero banner for PAUWI.

Run from anywhere:  python docs/readme/make_banner.py
Writes .github/readme-banner.png (2560x1280) — kept out of public/ so it doesn't ship in the app.
Needs Pillow + Cascadia Mono (ships with Windows 11).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SPRITES = ROOT / "public" / "images"
OUT = ROOT / ".github" / "readme-banner.png"
FONT = "C:/Windows/Fonts/CascadiaMono.ttf"

W, H = 1280, 640   # layout units
OUT_SCALE = 2      # final PNG = 2x for retina
SS = 4             # supersample factor we draw at, then downsample

# art direction palette (CLAUDE.md)
NIGHT = (14, 18, 20)
AMBER = (240, 166, 60)
RED = (217, 75, 59)
BONE = (236, 228, 213)
SLATE = (130, 139, 144)


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def font(size, weight):
    f = ImageFont.truetype(FONT, size * SS)
    f.set_variation_by_axes([weight])
    return f


def px(v):
    return round(v * SS)


img = Image.new("RGB", (W * SS, H * SS), NIGHT)
d = ImageDraw.Draw(img)

# film grain
grain = mix(NIGHT, BONE, 0.06)
r = SS * 0.9
for gy in range(0, H, 6):
    for gx in range(0, W, 6):
        cx, cy = px(gx + 3), px(gy + 3)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=grain)


def runs(x, baseline, parts, f):
    """Draw [(text, color), ...] left-to-right on one baseline; returns end x (layout units)."""
    cx = px(x)
    for text, color in parts:
        d.text((cx, px(baseline)), text, font=f, fill=color, anchor="ls")
        cx += f.getlength(text)
    return cx / SS


TAPE_H = 16


def halftone(name, height, right, ink, wound=None, cell=4):
    """Inverted halftone for a dark canvas: lit pixels become dots, outlines and empty space stay night."""
    rgba = Image.open(SPRITES / name).convert("RGBA")
    rgba = rgba.crop(rgba.getchannel("A").getbbox())
    width = round(height * rgba.width / rgba.height)
    nx, ny = width // cell, height // cell
    src = rgba.resize((nx, ny), Image.LANCZOS)
    pix = src.load()
    lum = [[0.0] * nx for _ in range(ny)]
    red = [[False] * nx for _ in range(ny)]
    for y in range(ny):
        for x in range(nx):
            rr, gg, bb, aa = (c / 255 for c in pix[x, y])
            if aa < 0.5:
                continue
            l = 0.299 * rr + 0.587 * gg + 0.114 * bb
            lum[y][x] = min(1.0, l * 1.5 + 0.12)
            red[y][x] = wound is not None and rr > 0.4 and rr > gg * 1.6
    ax, ay = right - width, H - TAPE_H - height
    rad = cell * 0.56 * SS
    for y in range(ny):
        for x in range(nx):
            old = lum[y][x]
            new = 0.0 if old < 0.5 else 1.0
            err = (old - new) / 8
            for dx, dy in ((1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < nx and yy < ny:
                    lum[yy][xx] += err
            if new == 1.0:
                cx, cy = px(ax + x * cell + cell / 2), px(ay + y * cell + cell / 2)
                d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad),
                          fill=wound if red[y][x] else ink)


# Shambler creeping in from the right, Juan standing his ground
halftone("zombie-idle.png", 470, W - 16, SLATE, wound=RED)
halftone("juan-idle.png", 560, 1050, BONE)

# hazard tape along the floor
d.rectangle((0, px(H - TAPE_H), px(W), px(H)), fill=AMBER)
for sx in range(-TAPE_H, W + TAPE_H, 28):
    d.polygon([(px(sx), px(H)), (px(sx + 14), px(H)),
               (px(sx + 14 + TAPE_H), px(H - TAPE_H)), (px(sx + TAPE_H), px(H - TAPE_H))], fill=NIGHT)

# ── copy ──
LEFT = 84

wm = font(140, 700)
base = 226
xh = -wm.getbbox("x", anchor="ls")[1] / SS
cx = LEFT
for ch in "pauwi":
    glyph = "ı" if ch == "i" else ch
    d.text((px(cx), px(base)), glyph, font=wm, fill=BONE, anchor="ls")
    adv = wm.getlength(glyph) / SS
    if ch == "i":
        dr = 140 * 0.13
        dcx, dcy = cx + adv / 2, base - xh - dr - 140 * 0.07
        d.ellipse((px(dcx - dr), px(dcy - dr), px(dcx + dr), px(dcy + dr)), fill=AMBER)
    cx += adv

tag = font(30, 500)
runs(LEFT, 312, [("Survive Manila.", BONE)], tag)
runs(LEFT, 354, [("Find your way ", BONE), ("home", AMBER), (".", BONE)], tag)

d.rectangle((px(LEFT), px(390), px(LEFT + 300), px(392)), fill=mix(NIGHT, BONE, 0.4))

meta = font(19, 500)
end = runs(LEFT, 434, [("Written in ", BONE), ("TypeScript", AMBER)], meta)
sx = end + 14
d.ellipse((px(sx), px(434 - 10), px(sx + 7), px(434 - 3)), fill=BONE)
runs(sx + 21, 434, [("Nuxt + Capacitor", BONE)], meta)

pill = font(20, 500)
ptxt = [("> home: ", BONE), ("3.2 km", AMBER)]
pw = sum(pill.getlength(t) for t, _ in ptxt) / SS
d.rectangle((px(LEFT), px(458), px(LEFT + pw + 44), px(508)), outline=BONE, width=px(2))
runs(LEFT + 22, 490, ptxt, pill)

runs(LEFT, 554, [("→ ", AMBER), ("github.com/thirdestonks/pauwi-mobile", BONE)], meta)

OUT.parent.mkdir(exist_ok=True)
img.resize((W * OUT_SCALE, H * OUT_SCALE), Image.LANCZOS).save(OUT, optimize=True)
print(f"wrote {OUT}")
