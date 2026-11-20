# Packs Juan's top-down flashlight frames (idle + move, 20 each) into two half-size strips
# for the app's pixel map: out/juan-idle.png and out/juan-move.png (export_to_app.py copies them into public/game/).
# Run from anywhere: python .art/juan-move-preview/export.py
# Source frames are padded right/bottom to even sizes before halving, so the shoulder pivot
# the map rotates around stays exact: idle (53, 56), move (53, 60). See utils/juanAvatar.ts.
from pathlib import Path
from PIL import Image
SRC = Path(r'C:/Users/Thirde/Pictures/pauwi-assets')
OUT = Path(__file__).resolve().parent / 'out'; OUT.mkdir(exist_ok=True)
for kind in ('idle', 'move'):
    frames = [Image.open(SRC / kind / f'survivor-{kind}_flashlight_{i}.png').convert('RGBA') for i in range(20)]
    w = max(f.width for f in frames); h = max(f.height for f in frames)
    w += w % 2; h += h % 2
    fw, fh = w // 2, h // 2
    strip = Image.new('RGBA', (fw * 20, fh))
    for i, f in enumerate(frames):
        pad = Image.new('RGBA', (w, h)); pad.paste(f, (0, 0))
        strip.paste(pad.resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    strip.save(OUT / f'juan-{kind}.png', optimize=True)
    print(kind, 'frame', fw, 'x', fh, '->', OUT / f'juan-{kind}.png')
