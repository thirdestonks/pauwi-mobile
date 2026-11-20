# DESIGN.md

Visual reference for PAUWI. This file is not auto-loaded the way `CLAUDE.md` is, so read it before any UI or art-asset work. `CLAUDE.md` points here.

## Screen size

The whole app renders inside a fixed phone frame, centred on a dark backdrop. See `app.vue`:

```
width: min(100vw, 440px)
height: min(100vh, 900px)
```

Design and generate everything for a **portrait canvas of about 440×900 CSS px** (roughly 9:16). The app is not responsive across breakpoints: there is one fixed portrait frame, no landscape mode and no tablet layout.

Pixel-art screens (combat, and the map once it's rebuilt) render at a **native 110×225 canvas** scaled 4× to fill the frame. Every combat background, weapon sprite, enemy sprite and the grid share that pixel grid, so nothing looks out of scale.

Target test device: the Pixel 7 emulator (API 36). See "Running on Android" in `CLAUDE.md`.

## Where art lives and how it's made

- **Generated source art** (Gemini "Nano Banana" outputs): `C:\Users\Thirde\Pictures\pauwi-assets\`
- **Work-in-progress art, renderers and previews**: `.art/` in the repo. Each folder has an `index.html` preview, which you can serve with `python -m http.server 8766` from `.art/`.
- **Wired-in assets**: `public/images/`, referenced in components as `/images/<name>.png`

### The painted → pixel pipeline (characters and weapons)

Characters and weapons are **painted by Nano Banana and converted to pixel art in code**. Nothing is hand-pixeled from scratch, and nothing is pixelated as a flat photo.

1. Generate a semi-realistic painting on a **flat magenta background (#FF00FF)**.
2. Key out the magenta, strip the magenta spill (the pink fringe), crop.
3. For each animation frame, **transform the hi-res cut-out first** (rotate, move, scale, squash), then box-shrink it to the native grid, snap it to a shared palette, and add a 1-px dark outline. Rotation therefore never degrades the pixels.

Prompting rules that worked:
- **Edit an image rather than describe a pose.** "Repaint the attached image, keep exactly the same pose… change only…" beats any written pose description. Nano Banana copies the pose of whatever hand or body you attach.
- **Use continuation frames.** For a new pose of an existing character, attach the approved painting and say "same man, same clothes… continuation frame".
- **Watch for bare skin under sleeves and cuffs.** The renderer repaints bare forearm below a glove cuff as Juan's olive sleeve.
- **Don't use watermarked stock images as a base**, not even pixelated. They're fine as loose inspiration only.

## Art style: four directions, don't blend them

PAUWI deliberately uses **different visual treatments for different screens**. This is not inconsistency, so don't "fix" one to match another.

### 1. General UI: flat sari-sari signage
TabBar and tile cards. (The Pack moved to pixel art in October 2026: see "Pack screen" under direction 4. The Shelter and the map's interface are moving to pixel art too, chosen October 21, 2026: the shelter becomes its pixel room with tappable objects, concept `.art/shelter-ui/` option 2, and the map goes full-screen with Juan's kit as the interface, concept `.art/map-ui/` option B.) See "Art direction" in `CLAUDE.md` for the palette and type spec. Key traits:
- flat ink-night panels with sodium-amber accents
- torn-paper, hazard-tape and corrugated-tin motifs
- condensed bold uppercase headers, monospace HUD data, emoji as icons
- heavy film grain over the whole app

It's contemporary: explicitly **not** retro-CRT and **not** pixel art.

### 2. Prologue: illustrated flashback
The title screen and 3 flashback beats in `PrologueScreen.vue`: full-bleed, semi-realistic, muted and hazy illustrations, softer than present-day gameplay.

### 3. Combat: first-person pixel art
`CombatScreen.vue`. A first-person survival-horror view rendered as real pixel art at 110×225. See "Combat screen" below.

### 4. Map: oblique hex pixel art (new direction, October 2026, not built yet)
The hex map is moving to a pixel-art look as well. See "Map screen" below.

**Pack screen (the bag), same pixel-art family.** Opened from a Bag button inside any shelter. A thick dark frame with square corners and hard shadows: Juan's meters (Health, Energy, Food, Hope) across the top, his portrait in the middle with the weapon slot beside it, and an 18-cell item grid below. Tap an item to see it; weapons can be equipped (the old one goes back in the pack), food and medicine can be used. Prototype: the bag in `.art/hex-map/index.html`.

## Phone map

`PhoneMap.vue` keeps the painted pixel phone and live offline streets. Colored location squares mark businesses, shelters, Tutuban, and street encounters Juan has visited. Tap a square for its place card: name, category, description, straight hex distance, and search status. Business addresses appear before visiting; loose loot and threats depend on Juan's visits. Drag to pan, use +/− to zoom, and ◎ to return to Juan. Cards sit on the glass at the normal size and widen over the phone on short viewports so the text stays readable. Browsing creates no board tiles and spends no moves or Energy.

## Gear screen

`GearScreen.vue` shares the Pack's pixel panels, square borders, hard shadows, and item sprites. Juan stands between eight worn slots. Tapping a slot or bag item opens its details; **Equip** and **Take Off** change the loadout. Empty slots with compatible gear in the bag use green borders. Weapon details use the live pixel combat rules: damage at CLOSE/MID/FAR, hit and critical odds, remaining swings, and loaded pistol rounds. Gear without a pixel sprite keeps its catalogue icon.

## Combat screen

The working prototype is in `.art/juan-hands/index.html`. It plays the full turn loop over the real backgrounds.

**Layers, back to front:** live background → 3×3 floor grid → Shamblers → Juan's weapon hand → HUD.

**Backgrounds.** Four live, animated pixel-art scenes, each one procedural renderer (`.art/combat-bg-*`). Every scene is **front-facing**: the camera looks straight down a street or alley so the grid sits square on the floor.

| Scene | Pool | Notes |
|---|---|---|
| Fog road (`combat-bg-day`) | Day | Fog-green palette, swaying trees, drizzle, distant tricycle lights |
| Alley (`combat-bg-night`) | Night | Raycast alley with a flickering wall lamp, moths, lit windows; optional rain |
| Urban street, day (`combat-bg-urban?mode=day`) | Day | Camera in the middle of the road: tenements and a pharmacy on the left, waiting shed and traffic light on the right |
| Urban street, night (`…mode=night`) | Night | A sodium lamp hanging over the road lights the combat floor; rain adds puddle mirrors and ripples |
| Interior, wooden floor (`combat-bg-interior?floor=wood`) | Inside a house | A dark tenement hallway, painted then pixelated to 110×225 (`build.py`). Only the floor is lit, by Juan's flashlight: it wobbles like a dying battery, flickers now and then, and sometimes sags and gets tapped back to life. Warm amber beam |
| Interior, tiled floor (`combat-bg-interior?floor=tile`) | Inside a house | The same light on cracked ceramic tile in a dark kitchen or shop. Cool teal beam. Interior fights draw **no floor grid** |

Each fight picks a random scene from the pool for the current day/night cycle, and night fights can roll rain.

**Floor grid.** 3 rows (**FAR / MID / CLOSE**, top to bottom) × 3 lanes, drawn in code over the background as crisp 1-px bone-white lines, never baked into the art. Each scene supplies its own perspective numbers so the grid lands on its floor: horizon row, vanishing x, eye×focal, focal, lane centre and lane width. They're listed in the `SCENES` table of the prototype. The cell you hover or tap is tinted amber.

**Juan in combat** is only his **gloved right hand** holding the current weapon, tucked into the bottom-right corner, with the fist partly cropped by the frame edge. The player *is* Juan.

| Weapon | Feel | Break |
|---|---|---|
| Makeshift bat (default): steel pipe, bandaged grip, nailed plank | diagonal slash, medium | the plank head snaps off |
| Itak (bolo machete) | heavier, longer hold at the top | the blade snaps mid-length |
| Arnis stick (rattan *yantok*) | fastest, light hit, toughest | the rattan splits at a node |
| Lead pipe | solid, a beat slower | the threaded coupling snaps off |
| Fists | quick jab that shrinks toward the target | never breaks; the fallback after any weapon breaks |

- **Swings.** Every attack is the same **compact diagonal slash**: cock back up-left, cut down to the right through a thin streak at the weapon's head, follow through off the bottom-right of the screen, and rise back to idle.
- **No arm stretching.** The arm never extends past what the painting covers.
- **Source.** The renderer is `.art/juan-hands/render.cjs`, run with `node render.cjs`. Its painted sources and placement data (pivot, screen position, scale and break point per weapon) are in `src/hk_meta.json`.

**Enemies** stand on grid cells, scaled by row. They're pre-baked at heights of 16, 22, 29, 38, 48 and 60 px, and the game picks the size closest to the enemy's depth. Each enemy sprite strip has a fixed canvas with a feet-pivot point, recorded in its `*-anim.json`. Animations:
- **idle** sway
- **attack** (the lunge painting surges at the camera)
- **hit** (white flash, head snaps back)
- **death**, a **front-facing** collapse: the knees buckle, he sinks toward the camera into a heap, and blood spreads under him

**Juan's portrait** (HUD) is a 48×56 pixel portrait with idle, breathe, blink, hurt, hurt-flash and dead frames (`.art/juan-portrait/`).

**HUD.** These elements are in the prototype now:
- a turn banner (`PLAYER TURN` in amber, `ENEMY TURN` in red, `JUAN IS DOWN`)
- Juan's health and weapon durability bars
- red-flash and screen-shake hit feedback

Still to design: the two-level action menu (Attack / Guard / Use Item / Swap weapon / Retreat), the Dread meter, and the per-row damage readout.

**Style rules on this screen:** thick dark outlines, `image-rendering: pixelated` on every sprite, hard-edged shadows, square corners, and a pixel/bitmap font for the combat HUD only.

## Map screen (new direction, October 2026, not built yet)

The flat SVG hex board is being replaced with an **oblique pixel-art hex map**. The visual reference is a dark cave scene: squashed hexes, terrain as the world, and a lit pocket in darkness.

- **Camera:** a low-angle, top-down view. Hexes are flattened to about half height, and the camera stays fixed on Juan.
- **Terrain is the world.** Tondo ground is drawn as pixel art: alley walls, tin-roof eaves, rubble, parked jeepneys, flooded patches. The hex lines are faint on the ground.
- **Light is the fog of war.** By day the revealed pocket fades into grey fog; at night it's a flashlight pocket in pitch black.
  - The ring right around Juan is clear.
  - The edge-of-sight ring shows shapes only, in the gloom.
  - Everything beyond is dark.
- **Tile hints as pixel props, not emoji.** The adjacent-ring category hint shows as a prop: a dropped bag (loot), a body or bloodstain (danger), a flickering radio (event). It still shows the type, never the specifics.
- **Houses:** about one house in six has a door painted on its street face, so the player can read it from the map: a dark doorway with a slit of warm light is open, a shut brown door with a red padlock is locked, planks over a dark opening mean boarded (not an entrance). A searched house's door is plain and dim.
- **Movement:** Juan is a small sprite on a pale lit hex. He steps hex to hex with a short walk animation, the camera glides, and the light reveals new ground as he moves.
- **Landmarks** (Tutuban and others) stay visible as silhouettes in the dark, with their tile-distance readout.

## Character design anchors

Keep these consistent across every future prompt.

**Juan.** Filipino man, late 20s, lean, tired, wary. A faded mustard baseball cap pulled low, short dark hair, stubble, a small healed scar on his cheekbone, a worn olive canvas jacket over a muted mustard shirt. In combat he wears **worn dark-brown leather work gloves with grey duct tape across the knuckles**.
- **Portrait source paintings:** `.art/juan-portrait/` (idle and hurt).
- **Weapon-hand paintings:** `.art/juan-hands/src/painted-*.png`, all in the same back-of-the-fist pose.

**Shambler (basic zombie).** A zombified Filipino man from Tondo who looks like someone's neighbour, not a monster:
- gaunt, greyish-sallow skin with dark red wounds, milky eyes, slack jaw, messy black hair
- a torn, bloody white *sando* (tank top) under an open blue short-sleeved polo, frayed denim shorts, one *tsinelas* on and the other foot bare
- hunched and head-tilted; he moves and dies in an unnatural, ragdoll way

The painted sources are in `.art/enemies/shambler/`: idle and attack (lunge), plus a planned front-facing dead pose.

**The Brute (Tutuban's guardian, the demo's boss).** Once a security guard at Tutuban Mall, where Juan used to work, now something much bigger:
- hulking and swollen, a head and a half taller than a Shambler, shoulders hunched forward, arms too long
- a torn navy-blue security guard uniform stretched and split at the seams, a cracked plastic ID on a lanyard, an empty nightstick holster on the belt
- greyish-sallow skin, dark red wounds, milky eyes, a jaw that hangs open
- slow and heavy; he hits hard. In combat: alone, 8 hits to drop. Until his paintings exist the prototype draws a scaled, darkened Shambler (`?boss=brute` in `.art/juan-hands/`).

## Current asset inventory

| Asset | Location | Status |
|---|---|---|
| Combat backgrounds (4 scenes, day/night/rain) | `.art/combat-bg-day`, `combat-bg-night`, `combat-bg-urban` | done, as previews |
| Juan portrait sheet (6 frames, 48×56) | `.art/juan-portrait/juan-portrait-sheet.png` | done |
| Weapon-hand sheets: makeshift, itak, arnis, lead pipe, fists (idle, attack, break, raise) | `.art/juan-hands/out/` | done |
| Shambler idle, attack, hit, death at 6 sizes | `.art/enemies/shambler/` | done; death will be replaced when the front-facing dead painting arrives |
| Combat turn-loop prototype | `.art/juan-hands/index.html` | done, as a preview |
| Pixel-art hex map | — | **planned** |
| Second enemy (brute) | `pauwi-assets/brute-*.png` exists | **to evaluate** for the painted pipeline |
| Legacy side-on combat art (`juan-*.png`, `zombie-*.png`, `combat-bg-fogged-alley.png`) | `public/images/` | still wired into the app until combat is ported |
| Item sprites: sibat, balisong, rebar, sumpak, shells, claw hammer; helmet, rider jacket, denim jacket, jeans, rubber boots, pads | `pauwi-assets/weapons_icon_1.jpg`, `armor_pack_1.jpg` → `.art/encounters/tmp/new_items.py` → `encounters/src/items/` | done (October 23, 2026) |
| Aling Cora: stall scene (`suki`), portrait (small + big), map stall prop | `trade_encounter.jpg`, `trader_icon.jpg`, `trader_map_icon.jpg` → `new_items.py` and `.art/kit/build.py` | done (October 23, 2026) |
| Old armor sprites (hard hat, leather jacket, scrap vest, work boots) and trade goods (cigarettes, gold, phone, gin, copper wire, coffee) | — | **missing**: emoji until painted |
| First-person hands for the new weapons | — | **missing**: they borrow arnis (sibat), itak (balisong), pipe (crowbar, rebar), makeshift (hammer), pistol (sumpak) |

`juan.png` (no suffix) is Juan's map avatar in `HexBoard.vue`. It will be replaced by the new map sprite.
