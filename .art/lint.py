# Quick safety net for the .art previews (run from .art/: python lint.py):
#  1. every inline <script> must parse (node --check)
#  2. no // comment may swallow code after it on the same line (it has bitten these files more than once)
import re, subprocess, os, sys
PAGES = ['hex-map/index.html', 'juan-hands/index.html', 'encounters/index.html', 'house-interior/index.html', 'combat-bg-interior/index.html']
bad = 0
for page in PAGES:
    text = open(page, encoding='utf-8').read()
    for i, js in enumerate(re.findall(r'<script>(.*?)</script>', text, re.S)):
        tmp = f'_lint_{i}.js'; open(tmp, 'w', encoding='utf-8').write(js)
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True); os.remove(tmp)
        if r.returncode: bad += 1; print(page, 'SYNTAX ERROR:', r.stderr.strip().splitlines()[-1])
    for n, line in enumerate(text.splitlines(), 1):
        if len(line) > 3000 or 'base64,' in line or re.search(r"[A-Za-z0-9+/]{60}", line): continue   # image data, not code
        m = re.search(r"(?<![:'\"\\])//(.*)$", line)
        if m and re.search(r"\w\([^)]*\)\s*;|\b(const|let) \w+ =|=> ", m.group(1)):
            bad += 1; print(page, n, 'comment may swallow code:', m.group(1)[:100].strip())
print('lint: clean' if not bad else f'lint: {bad} problem(s)'); sys.exit(1 if bad else 0)
