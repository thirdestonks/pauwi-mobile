# Brings the user's new sounds from Pictures/pauwi-assets/sfx into the game: trims, makes mono, levels, renames to the repo's
# kebab-case, and writes both .art/sfx/ (the source of truth for the previews) and public/game/sfx/ (what the app loads).
# One-shots are trimmed of leading silence and peak-levelled; loops ("beds") are cut from a steady stretch, levelled by loudness
# and given short fades so they can repeat. Run: python .art/sfx/import_sfx.py  (needs ffmpeg on PATH)
import re, shutil, subprocess
from pathlib import Path

SRC = Path(r'C:/Users/Thirde/Pictures/pauwi-assets/sfx')
HERE = Path(__file__).resolve().parent
APP = HERE.parents[1] / 'public' / 'game' / 'sfx'

# source file -> (game name, kind, extra). One-shots: peak to -1 dB. Beds: (start s, length s, target mean dB).
SOUNDS = {
    'grind_loop.mp3': ('grind-loop', 'bed', (6.0, 4.0, -24)),       # the stone spinning: a steady stretch of the recording
    'grind_spark.mp3': ('grind-spark', 'bed', (12.0, 4.0, -22)),    # steel on the stone: louder the closer you are to the band
    'hammer_impact.mp3': ('hammer-impact', 'shot', None),
    'upgrade_success.mp3': ('upgrade-success', 'shot', None),
    'upgrade_fail.mp3': ('upgrade-fail', 'shot', None),
    '9mm_reload.mp3': ('9mm-reload', 'shot', None),
    'pistol_cock.mp3': ('pistol-cock', 'shot', None),
    'shotgun_reload.mp3': ('shotgun-reload', 'shot', None),
    'm4_reload.mp3': ('m4-reload', 'shot', None),                   # for the gun trader's rifle, later
}


def run(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-y', *args], capture_output=True, text=True).stderr


def level(path, which):
    out = run(['-i', str(path), '-af', 'volumedetect', '-f', 'null', '-'])
    return float(re.search(rf'{which}_volume: (-?[\d.]+) dB', out).group(1))


for src, (name, kind, extra) in SOUNDS.items():
    p = SRC / src
    if not p.exists():
        print(f'missing  {src}'); continue
    tmp = HERE / f'_{name}.wav'
    if kind == 'bed':
        start, length, target = extra
        run(['-ss', str(start), '-t', str(length), '-i', str(p), '-ac', '1', '-ar', '44100',
             '-af', f'afade=t=in:d=0.04,afade=t=out:st={length - 0.04}:d=0.04', str(tmp)])
        gain = target - level(tmp, 'mean')
    else:
        run(['-i', str(p), '-ac', '1', '-ar', '44100', '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse', str(tmp)])
        gain = -1.0 - level(tmp, 'max')
    out = HERE / f'{name}.mp3'
    run(['-i', str(tmp), '-af', f'volume={gain:.1f}dB,alimiter=limit=0.95', '-b:a', '128k', str(out)])
    tmp.unlink(missing_ok=True)
    APP.mkdir(parents=True, exist_ok=True)
    shutil.copy2(out, APP / out.name)
    print(f'{name:16} {kind:5} gain {gain:+.1f} dB -> {out.stat().st_size // 1024} KB')
