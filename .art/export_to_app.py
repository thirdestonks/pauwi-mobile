# Copies the runtime assets the game needs from the .art previews into the app (public/game/), mirroring .art's paths
# so the scene pages' relative references keep working. Only finished runtime files go: no painted sources, sheets,
# jpgs or scratch. Re-run (from .art/) after rebuilding any asset:  python export_to_app.py
import os, shutil, glob
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', 'public', 'game')
KEEP = [
    'encounters/index.html',                                     # every encounter interior, one page driven by postMessage
    'combat-bg-day/index.html', 'combat-bg-night/index.html', 'combat-bg-urban/index.html',
    'combat-bg-interior/index.html', 'combat-bg-interior/wood-110.png', 'combat-bg-interior/tile-110.png',   # in-house fights (combat-bg-interior/build.py)
    'house-interior/index.html',                                 # the walkable, searchable house (house-interior/build.py; ?embed inside the app)
    'enemies/shambler/shambler-anim.json', 'enemies/shambler/shambler-h*-*.png',
    'enemies/brute/brute-anim.json', 'enemies/brute/brute-h*-*.png',
    'juan-hands/out/*.png', 'juan-hands/out/manifest.json',      # Juan's first-person weapon hands
    'juan-portrait/juan-portrait-sheet.png',
    'sfx/*.mp3',
    'encounters/src/items/*.png', 'encounters/src/ui/*.png', 'encounters/src/ui/bag-open.json',
    'encounters/src/juan-full.png', 'encounters/src/bag-icon.png',
    'encounters/src/shelter-*-110.png',
    'weight/out/*.png',                                          # the weight: bag loads, item-use hands, meals, survivors, Mang Isko
    'guns/out/*.png',                                            # first-person guns (the gun trader, later)
    'kit/out/*.png',                                             # Juan's kit, the message box frame and portraits (kit/build.py)                          # the shelter rooms, which are the Shelter screen itself
    'hex-map/src/*-34.png', 'hex-map/src/roofs-40.png', 'hex-map/src/facade-28.png', 'hex-map/src/ground-32.png',
    'hex-map/src/prop-*.png', 'hex-map/src/tutuban-48.png', 'hex-map/src/tutuban-close.png',
    'phone-map/out/phone-hand.png', 'phone-map/out/phone-hand.json',   # Juan's phone, first person (phone-map/build.py)
    'juan-move-preview/out/juan-*.png',                          # Juan's top-down idle/move strips for the map (juan-move-preview/export.py)
    'hex-map/src/door-*.png',                                  # door transition strips (the -sheet sources are skipped below)
]
SKIP = ('painted-', 'sheet', '-x3', '-x4', 'preview')
if os.path.isdir(OUT): shutil.rmtree(OUT)
n = size = 0
for pattern in KEEP:
    for src in glob.glob(os.path.join(HERE, pattern)):
        rel = os.path.relpath(src, HERE)
        if any(s in os.path.basename(rel) for s in SKIP): continue
        dst = os.path.join(OUT, rel); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy2(src, dst)
        n += 1; size += os.path.getsize(src)
# the map's textures are embedded in hex-map/index.html (some were hand-touched after their src/ png): extract those exact bytes
import re, base64
js = re.findall(r'<script>(.*?)</script>', open(os.path.join(HERE, 'hex-map', 'index.html'), encoding='utf-8').read(), re.S)[0]
tex = os.path.join(OUT, 'hex-map', 'tex'); os.makedirs(tex, exist_ok=True)
for m in re.finditer(r"loadTex\('([A-Za-z0-9+/=]+)', \d+, \d+, d => \{?\s*([A-Za-z0-9.]+)", js):
    b64, target = m.groups()
    name = target.replace('SPR.', 'spr-').replace('FRONT.', 'front-').replace('NIDA', 'front-nida').lower()
    open(os.path.join(tex, name + '.png'), 'wb').write(base64.b64decode(b64)); n += 1
for m in re.finditer(r"im\.src = 'data:image/png;base64,([A-Za-z0-9+/=]+)'", js):
    open(os.path.join(tex, 'roofs.png'), 'wb').write(base64.b64decode(m.group(1))); n += 1
print(f'exported {n} files, {size / 1e6:.1f} MB (+ map textures) -> public/game/')
