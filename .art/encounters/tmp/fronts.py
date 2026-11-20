# Painted diner / store fronts -> 34x23 map fronts (same size as the other shopfronts)
from PIL import Image, ImageEnhance, ImageFilter
import base64
def front(path, name, fix=None):
    im = Image.open(path).convert('RGB')
    if fix: fix(im)
    im = im.resize((34, 23), Image.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.12).filter(ImageFilter.UnsharpMask(1, 80, 2))
    q = im.quantize(24, dither=Image.Dither.NONE).convert('RGB'); q.save(f'hex-map/src/{name}-34.png')
    q.resize((34 * 8, 23 * 8), Image.NEAREST).save(f'encounters/tmp/{name}-front-x8.png')
    return base64.b64encode(open(f'hex-map/src/{name}-34.png', 'rb').read()).decode()
def no_brand(im):                                                 # the sign carries a real chain's logo: melt it into a plain lit panel
    from PIL import ImageFilter
    w, h = im.size; box = (int(w * 0.21), int(h * 0.05), int(w * 0.80), int(h * 0.20))
    panel = im.crop(box)
    for _ in range(3): panel = panel.filter(ImageFilter.GaussianBlur(18))
    im.paste(panel, box[:2]); im.save('encounters/tmp/store-front-clean.png')
open('encounters/tmp/fronts.b64', 'w').write(front('hex-map/src/painted-diner-front.jpg', 'diner') + '\n' + front('hex-map/src/painted-store-front.jpg', 'store', no_brand))
