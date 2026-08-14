# DESIGN.md

Visual reference for PAUWI. Not auto-loaded like `CLAUDE.md` — read this when doing UI or art-asset work; `CLAUDE.md` points here.

## Screen size

The whole app renders inside a fixed phone-frame, centered on a dark backdrop — see `app.vue`:

```
width: min(100vw, 440px)
height: min(100vh, 900px)
```

Design and generate everything for a **portrait canvas, ~440×900 CSS px** (roughly 9:16 — 9:19.5 is closer, but 9:16 is close enough for generation prompts). This is not a responsive multi-breakpoint app — one fixed portrait frame, no landscape mode, no tablet layout.

Target test device: Pixel 7 emulator (API 36), see the "Running on Android" section in `CLAUDE.md`.

## Where to find images

- **Generated source art** (Gemini "Nano Banana" outputs, before they're in the repo): `C:\Users\Thirde\Pictures\pauwi-assets\`
- **Wired-in, in-repo assets**: `public/images/`, referenced in components as `/images/<name>.png`
- **Workflow**: generate → save to `pauwi-assets` → copy into `public/images/` with a clean kebab-case name → reference the path in the component. See "Generated art asset pipeline" in `CLAUDE.md` for the short version.
- **Prompting tip**: for a new pose/frame of an existing character, attach the prior reference image and ask for a "continuation frame" rather than re-describing the character from scratch — this is what kept Juan and the Shambler visually consistent across poses. Always state the target aspect ratio/orientation explicitly (e.g. "portrait, 9:16, mobile phone game") — the generator defaults to landscape/desktop otherwise.

## Art style — three distinct directions, don't blend them

PAUWI intentionally uses **different visual treatments for different screens**. This is deliberate, not inconsistency — don't "fix" one to match another.

### 1. General UI — flat sari-sari signage
Shelter, Map, Pack, TabBar, tile cards. See "Art direction" in `CLAUDE.md` for the full palette/type spec. Key traits: flat ink-night panels, sodium-amber accents, torn-paper/hazard-tape/corrugated-tin motifs (small tape tabs on section headers, dashed "ticket" borders, tilted stapled-card panels), condensed bold uppercase headers, monospace HUD data, emoji as icons, heavy film grain overlay app-wide. Contemporary mood — explicitly **not** retro-CRT, **not** pixel art.

### 2. Prologue — illustrated flashback
`PrologueScreen.vue`'s title screen + 3 flashback beats. Full-bleed semi-realistic pixel-art illustrations (muted, atmospheric, hazy) — distinct from both the flat UI and the combat pixel art. Meant to feel like a "before" memory, visually softer/hazier than present-moment gameplay.

### 3. Combat — genuine 16-bit pixel art
`CombatScreen.vue` only. Gritty survival-horror mood (think classic Resident Evil environmental dread, staged with a single harsh light source and deep shadow) rendered as real pixel art, not photographic or painterly. Concretely:
- Thick black outlines, flat cel-shaded color blocks, visible chunky pixel texture — no smooth gradients, no soft dithering
- `image-rendering: pixelated` enforced in CSS on every sprite/texture
- Hard-edged offset shadows everywhere (e.g. `box-shadow: 3px 3px 0 rgba(0,0,0,.35)`), never blurred
- Square corners throughout — no `rounded-*` classes anywhere in this screen
- The frame around the scene is built from PAUWI's own materials (corrugated tin, rivets, hazard tape) — not generic fantasy wood/parchment

## Character design anchors

Keep these consistent across every future combat-art prompt.

**Juan (combat):** Filipino man, late 20s, lean-average build, light-brown skin, short black hair mostly hidden under a worn ball cap. Gray jacket over a plain undershirt, gray jogger pants, worn sneakers, a small survival bag slung across his back. Weapon: a length of pipe wrapped in dirty bandages, with a nail-studded wooden plank lashed to the striking end. Note: this is a grittier "present day" look, deliberately different from his cleaner mustard-shirt outfit in the prologue flashback — that's intentional (before vs. after), not a continuity error.

**Shambler (zombie enemy):** gaunt zombified Filipino civilian, torn everyday work shirt, dark pants, grayish-sallow skin with red wound accents, hunched posture, milky eyes, slack jaw. Human scale — unsettling because it looks like someone's neighbor, not a monster. Moves and dies in an exaggerated, unnatural, ragdoll way — it's dead, not a person reacting to pain.

## Current asset inventory

| Character | Pose | File | Status |
|---|---|---|---|
| Juan | idle | `juan-idle.png` | done |
| Juan | attack (wind-up) | `juan-attack.png` | done |
| Juan | swoosh (impact follow-through) | `juan-swoosh.png` | done |
| Juan | hurt | `juan-hurt.png` | done |
| Juan | die | `juan-die.png` | done |
| Juan | ready to run (retreat) | — | **postponed** — retreat currently reuses the hurt pose |
| Shambler | idle | `zombie-idle.png` | done |
| Shambler | hit | — | **pending** — impact currently uses a CSS hit-flash flicker instead |
| Shambler | die | `zombie-die.png` | done |
| Background | Fogged Alley (combat) | `combat-bg-fogged-alley.png` | done |

`juan.png` (no suffix) is a separate, older sprite used for Juan's map avatar in `HexBoard.vue` — not part of the combat set above.
