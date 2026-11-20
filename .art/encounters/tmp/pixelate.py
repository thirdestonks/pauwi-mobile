# Painted/photo source -> 110x225 encounter base, 48 colours (same budget as backpack-110 / radio-110)
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
W, H = 110, 225
def quant(im, n=48): return im.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
def cover(src, fx=0.5, fy=0.5):
    s = max(W / src.width, H / src.height); w, h = round(src.width * s), round(src.height * s)
    im = src.resize((w, h), Image.LANCZOS); x, y = round((w - W) * fx), round((h - H) * fy)
    return im.crop((x, y, x + W, y + H))
def save(im, name):
    im = ImageEnhance.Contrast(im).enhance(1.08).filter(ImageFilter.UnsharpMask(1, 60, 2))
    q = quant(im); q.save(f'src/{name}-110.png'); q.resize((W * 4, H * 4), Image.NEAREST).save(f'tmp/{name}-x4.png')

save(cover(Image.open('src/painted-diner.png').convert('RGB'), 0.5, 0.5), 'diner')
save(cover(Image.open('src/painted-store.png').convert('RGB'), 0.5, 0.5), 'store')
# rear-view car (the trunk faces you) and the empty trunk; the items get placed on its floor in code
save(cover(Image.open('src/painted-car-rear.png').convert('RGB'), 0.85, 0.5), 'car-rear')
save(cover(Image.open('src/painted-trunk-empty.png').convert('RGB'), 0.5, 0.5), 'trunk-empty')

# shop interiors (tap-to-take) and Nida's, behind the end-of-cycle summary
for k in ['botika', 'kwikmart', 'kainan', 'shelter-nida', 'shelter-t10', 'shelter-brgy', 'shelter-mm']:
    im = cover(Image.open(f'src/painted-interior-{k}.jpg').convert('RGB'), 0.5, 0.5)
    if k == 'kainan': im = ImageEnhance.Brightness(im).enhance(1.45)          # painted very dark: lift it so the counter reads
    save(im, k)
