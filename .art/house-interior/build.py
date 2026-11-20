# Builds the standalone house-interior study: source.html + the cut sprites in art/ (see build_art.py) + the game's
# item icons, all embedded as data URIs -> index.html (opens by double-click, no server needed).
# Run from anywhere: python .art/house-interior/build.py
import base64, json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ART = HERE.parent


def uri(p):
    return 'data:image/png;base64,' + base64.b64encode(Path(p).read_bytes()).decode()


assets = {
    'art': {p.stem: uri(p) for p in sorted((HERE / 'art').glob('*.png'))},
    'manifest': json.loads((HERE / 'art' / 'manifest.json').read_text()),
    'items': {p.stem: uri(p) for p in sorted((ART / 'encounters' / 'src' / 'items').glob('*.png'))},
}
src = (HERE / 'source.html').read_text(encoding='utf-8')
marker = '/* ASSETS */ {}'
assert marker in src, 'asset marker missing from source.html'
out = src.replace(marker, json.dumps(assets, separators=(',', ':')))
(HERE / 'index.html').write_text(out, encoding='utf-8')
print('built index.html:', len(out) // 1024, 'KB,', len(assets['art']), 'sprites,', len(assets['items']), 'item icons')
