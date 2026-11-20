# AGENTS.md — how to work in PAUWI

Standing instructions for any agent session in this repo. Read this before starting work.

`CLAUDE.md` holds the game itself — core rules, MVP scope, art direction, world reference, and the
auto-loaded project spec. Where the two disagree about **process**, this file wins; where they
disagree about **the game**, `CLAUDE.md` wins.

## Start of every session (Codex and Claude alike)

Codex auto-loads this file; nothing else carries over between sessions. Before the first task:

1. Read `CLAUDE.md` (the game's rules — Codex does not auto-load it) and, for any UI or art work, `DESIGN.md`.
2. Read the **Handoff** section at the end of this file: where the last session stopped, what's open, what the user is waiting on.
3. Run `git status` and `git log --oneline -5` — the user commits by hand, so uncommitted changes are usually the last session's work, not stray edits. Don't revert them.
4. If the user's first message is vague ("continue", "what's next"), answer from the Handoff's open items.

At the **end** of a session (or when the user wraps up), update the Handoff section: replace "Last session" with what was done and the date, and keep "Open / waiting on the user" current. Keep it short — it's a pointer, not a changelog.

## Working mode

**Godspeed is the default for every build, refactor, fix, or change.** Full skill at
`~/.claude/skills/godspeed/SKILL.md`.

- The **first line** of the response is the tier: `⚡ Godspeed — Light` / `Medium` / `Medium-High` / `Heavy`.
- Tier on **blast radius, not line count** — a 5-line change to a shared store is not Light. Re-tier out loud if it grows past what you announced.
- **Light / Medium:** just do it. **Medium-High / Heavy:** ask "Recon?" once — unless the user already said "recon" or "just go".
- Read before you edit. One stated assumption instead of a questionnaire. Finish the whole ask — if part is genuinely blocked, do everything else and say plainly what you left out.
- Never invoke a `superpowers:*` skill unless the user names it explicitly.
- Does not apply to answering questions.

Close every task with the **Godspeed report**: what works now that didn't · files as
`path — what changed` · exactly how to see it · anything assumed, skipped, or left open — ending in
a single `**In 1 sentence:** …` line, which is the last thing in the message.

**Aurora follows every Godspeed report on Medium and above.** Full skill at
`~/.claude/skills/aurora/SKILL.md`.

- One close-out pass. Header `**Here flies Aurora...**`, then: one-line headline · numbered changes **capped at 5** (`path — what changed`) · **exactly one** next action · **at most 3** flagged open items.
- Nothing follows it — no preamble, no sign-off, no pleasantries.
- Skip it on Light tasks, or whenever the user says "skip aurora".
- In Claude Code the Stop hook fires it automatically; in any other harness, run it yourself.

## Codex and shared Claude workflows

- `AGENTS.md` is Codex's standing instruction file for this repo. At the start of a
  session, also read the local `CLAUDE.md` explicitly; do not assume Codex auto-loads it.
- Use the existing skill files under `~/.claude/skills/` as the source of truth.
  Read the applicable `SKILL.md` before using it; do not maintain separate copied
  versions just for Codex. Resolve `~` to the current user's home directory.
- Godspeed: `~/.claude/skills/godspeed/SKILL.md` for builds, refactors, fixes, and changes.
- Aurora: `~/.claude/skills/aurora/SKILL.md` once after Medium-or-higher Godspeed
  reports, or when explicitly requested. The one-sentence summary ends the Godspeed
  report; Aurora follows it and is the final block of the response.
- Accomplishment reports: `~/.claude/skills/accomplishment-report/SKILL.md` when
  asked for AR, TO/AA, a daily accomplishment report, or OTOutput. Ground the report
  in actual work. Its requested report-only format takes precedence over the normal
  Godspeed/Aurora close-out format for that reporting request.
- Other Claude skills: when explicitly named or relevant to the task, read their
  instructions and supporting files before applying them. Claude-specific tool names
  must be adapted to tools actually available in the current harness.

### Hook behavior across harnesses

Claude's hook configuration lives in `.claude/settings.json` (repo) and
`~/.claude/settings.json` (user). These files do not by themselves install Codex hooks.
Read their `hooks` entries and referenced scripts when checking workflow behavior.

- `UserPromptSubmit`: enforce the Godspeed defaults and repo rules above on code
  tasks; ordinary questions do not require Godspeed.
- `Stop`: Claude's `~/.claude/skills/aurora/scripts/stop-hook.sh` detects a completed
  Godspeed report and requests Aurora once, excluding Light tasks and preventing
  repeat continuations. In Codex, perform the equivalent close-out manually unless
  an equivalent Codex hook has been configured and verified; honor `skip aurora`.
- `PostToolUse`: the current user hooks remind Claude to switch to Sonnet after
  writing a `superpowers/plans/` file or exiting plan mode. These are Claude-specific
  reminders, not authorization to invoke superpowers or switch Codex models.
- Do not execute Claude hook scripts as Codex hooks without adapting and verifying
  their event payloads, transcript format, tool names, and runtime support.

## Repo rules

- **Never commit, push, or open a PR unless the user asks.**
- `CLAUDE.md` is **gitignored** — it exists on this machine only and does not travel with the repo. Don't rely on it being present elsewhere.

## Read alongside this file

- `DESIGN.md` — before any UI, layout, or art-asset work: phone canvas size, the deliberately different art directions (flat signage / prologue / pixel art for combat, the map and the Pack), character design anchors (Juan, Shambler, the Brute), asset pipeline, current asset inventory.
- `PLAN.md` — phase status and the design questions still unanswered (tile-type weights, data-driven encounters, escape-plan triggers).
- `.freebuff/combat-rework.html` — the old combat rework notes (superseded by the live numbers below). A scratch artifact; it may have been deleted.

## The port (October 2026): `.art/` previews → the Nuxt app — done, being polished

The game's new direction was built and play-tested as standalone HTML previews in `.art/`
(served with `python -m http.server 8766` from `.art/`), then ported into the app. **The app is
now the game**; the previews are reference and asset sources. New work goes into the app, not the
previews. **Decisions (the user's, don't relitigate):**

| Area | Decision |
|---|---|
| Inventory | **Keep the app's** shelter stash + field bag + 8 gear slots (`stores/inventory.ts`, `stores/player.ts`), re-skinned with the pixel bag art. The field bag is **10 slots, each `{ id, qty }`**, repeats stack **two to a slot** (`stackMax`: weapons and armor never stack). Loot taken in encounters goes into the bag, **as many as fit, never pick-one**; the tile card shows the bag with tap-to-drop so the player makes room. Old 5-slot saves load (`loadBag`). |
| World | **The preview's Tondo** (`utils/tondo.ts`): procedural houses/roads, shopfronts (+2 moves), 4 shelters near Nida's (Tenement 10, Barangay 43 Hall, Mang Mel's), Tutuban ~45 hexes NE with the Brute. Same save format. |
| Combat | **The preview's rules**, now extended in the app (misses, damage spread, crits, regen — see below). `.art/juan-hands/balance-sim.cjs` follows the **app** (`data/combat.ts PIXEL_COMBAT`); the `.art/juan-hands/index.html` page predates the extensions. Keep the sim and the app in step. |
| Build | Hex map and combat are **native** (Vue + canvas + Pinia). Encounter interiors and combat backgrounds stay **embedded scene pages** (iframes from `public/game/`). |

**Port checklist:**
1. [x] Docs for Codex. 2. [x] Assets into `public/game/`. 3. [x] Sounds, rules, catalogue. 4. [x] Combat. 5. [x] Board on the Tondo generator. 6. [x] Pixel map + encounters + doors + looting. 7. [x] Shelter, Dread, pixel bags.
8. [~] The Brute at Tutuban + End Demo ✓; `nuxt generate` + `cap sync android` ✓; **never run on the emulator** — the user isn't planning to run it on the Pixel soon. Browser testing (static build served from `.output/public`) is the loop for now.

### Where things live in the app

| Piece | Files |
|---|---|
| Screens | `app.vue` switches tabs: `ShelterScreen`, `MapScreen` (→ `PixelMap`, `PhoneMap`, `EncounterLayer`, `TileCard`), `CombatScreen`, `PackScreen`, `FieldBagScreen`, `GearScreen`; overlays `ShelterTransitionScreen` (return + outing summary), `DoorTransition` (app-wide), `PrologueScreen`, `DeathScreen`, `WinScreen` (pixel End Demo). |
| World + map | `utils/tondo.ts` (pure `tile()`/`content()` per coordinate, shelters, shops, loot tables, door names); `utils/tondoRender.ts` (110×225 canvas renderer: light-as-fog, props, dash beams, remembered props); Juan on the map is the original standing sprite `public/game/hex-map/tex/spr-juan.png` (15×28, 4 frames, mirrored to face the way he walks; the user's pick, November 2026), drawn by the renderer itself (`utils/juanAvatar.ts`, the top-down flashlight Juan, is no longer used); `stores/board.ts` (tiles touched, moves, dash/path-home, waypoints, day/night, save). |
| Encounters | `TileCard.vue` drives every card: backpack, radio/events, car → trunk (15% alarm → fight → trunk), walk-in shops (door → pick one of 3), water refill, shelter claim (door → interior), Tutuban/Brute. `composables/useEncounterScene.ts` owns the scene iframe (`/game/encounters/index.html`, `postMessage`) and door playback (`enterDoor`/`leave` for scenes, `passDoor` one-way between screens). |
| Combat | `stores/combat.ts` (turn loop, grid rows/lanes, `intentOf`, `damageRange`, misses, crits, regen, pistol reload/click, haptics); `CombatScreen.vue` (street: bg iframe, the 3×3 grid, enemies + overhead HP/intent canvas, hands canvas) and `InteriorCombatScreen.vue` (in-house: dark room, one big zombie, no grid), both on the shared `CombatHud.vue` (banner, meters, log, popups, item/swap menus, action buttons with odds) and the `useCombatHands` / `useHitFeedback` composables; `data/combat.ts` (`PIXEL_COMBAT`, `CONSUMABLE_EFFECTS`/`INFO`); `data/equipment.ts` (weapons with `combat: {dmg, hands, gun}`, `durability`, sprites; `nailed-plank` = makeshift bat, `steel-pipe` = lead pipe). Ally array kept for 1–4 actors. |
| Trader | `stores/trader.ts` (Aling Cora: tab/credit, points → rank, the day's table and request, `sell`/`buy`/`tip`, saved as `trader` in the blob); `data/trade.ts` (`TRADE_VALUE`/`tradeValue`, `SUKI_RANKS`, stock pools); `TraderPanel.vue` (the trade inside `TileCard`); `board.traderSpots`/`traderPos`/`atTrader` (3 spots per zone, one a day, day only); the stall prop in `tondoRender.ts` (`SPR.stall`), the pin in `PhoneMap.vue`, scene `suki` in the encounter page. |
| Juan | `stores/player.ts` (meters, Dread, `sleep`, `passNight`, equipment, `durabilityOf`, armor `wornArmor`/`wearArmor`/`repairArmor`, guns `loadedOf`/`spareOf`/`setGun`); `stores/inventory.ts` (stash, bag, `lastPack`/`packLikeLast`); `stores/ui.ts` (tabs, outing start snapshot, shelter return). |
| Feel | `composables/useSfx.ts` (one-shots with variations, looping beds); `composables/useSettings.ts` (Sound/Shake/Vibrate, per-phone localStorage, `buzz()` via `navigator.vibrate`). Pixel-screen styles: `.px-*` in `assets/css/main.css`. |

### The live numbers (app)

- **Moves:** 5 a phase; fresh hex 1 move + 3 Energy; cleared hexes free; dash up to **3** cleared hexes (`DASH_REACH`); shops +2 once.
- **Combat:** Shambler 5 HP, bite **10**, misses **25%**; Brute 16 HP, smash 20, misses **15%**, no running. Weapon dmg (CLOSE): fists 1, bat 2, arnis 2, knife 2, pipe 3, itak 4, pistol 4 (any row), sledge 5; **traits** (October 23): sibat 2 / 10 swings, **reach** (MID at full, FAR ×0.6); balisong 2, never breaks, **25% crit**; crowbar 3 / 14 (also pries doors from the hand); rebar 3 / 22; claw hammer 2 / 14, **knock** (a hit that doesn't kill shoves it back a row if the cell behind is free); **sumpak** 4, 1 shell, **lane** (every Shambler in the target's lane takes its own roll), +2 Dread a shot, reload from a box of 4 shells (`PIXEL_COMBAT.guns`); each hit rolls dmg−1…dmg+1 (fists 1), **10% crit ×2**; rows CLOSE ×1 / MID ×0.6 / FAR ×0.3. Run 35%, 60% with nothing at CLOSE. Guard halves the next hit.
- **Interior fights** (inside a house): exactly **one** Shambler, **already in the CLOSE row** when the fight opens, and an easier one: 3 HP, bite **6**, misses **35%** (`PIXEL_COMBAT.interior`; about 1 HP lost with the bat). `combat.start(spec, { interior: true | 'wood' | 'tile' })` sets `combat.fightScene` and `interiorFloor` (`true` picks one at random), and `app.vue` then mounts **`InteriorCombatScreen.vue`**, its own screen and not a mode of `CombatScreen.vue`: the matching `combat-bg-interior` room, one large 92 px Shambler standing in front of Juan, and **no floor grid**. Dev: `/?fight=1&interior=1|wood|tile`. It is triggered when a Shambler reaches Juan inside a walkable house (`HouseScreen`, below); a win there does **not** resolve the map tile (the house goes on), and Retreat sends Juan running for the door.
- **Healing:** bandage/gauze/painkillers +12 then **+8 a turn for 2**, first-aid +15 then +8 for 3, medicine +14 then +8 for 2 (outside a fight the whole course lands at once).
- **Dread:** +4 per hit, +2 when one reaches CLOSE, +1 per shot; Shaken at 60 (25% of swings miss); drains 8 a night and costs 1 Hope per 10 each night (a night out counts).
- **Armor** (October 23): flat points off each hit, **never more than half** of it (`PIXEL_COMBAT.armorCap`); every point blocked wears the piece's `condition`, and at 0 it falls apart (`player.armorWear`, saved). Pieces: hard hat 1/10, leather jacket 1/14, scrap vest 2/22, work boots 1/14, moto helmet 2/16, rider jacket 2/18, denim jacket 1/10, jeans 1/10, rubber boots 1/8, pads 1/12 (shoulder slot). Patch at the stash: **copper wire → +8** on the most worn piece. Found in wardrobes, drawers, lockers, trunks (house page `CAT.wear`), car trunks, street wins, and at the trader.
- **Trader** (October 23): Aling Cora, by day only, at one of 3 spots 2–5 hexes from the shelter (changes daily). Barter on a tab: she pays `value × buys`, charges `value × sells`; ranks Stranger 0 (0.6/1.5), Regular 30 (0.7/1.3), Suki 80 (0.8/1.15, one piece kept under the table), Family 160 (0.9/1.0, a daily cache tip). Her daily request pays **double** once. Trade goods (cigarettes, gold, cracked phone, gin, copper wire, coffee) exist mainly for her.
- **Sleep:** Food −15, Energy +30, Health +5 (under 15 Food: Health −10 instead).
- **Bag and ammo:** 10 slots, stacks of 2 (two Cup Noodles = 1 slot, three = 2). `inventory.units` is the flat list of every item (for code that ignores slots); `bag[i]` is a slot. A **small pack of ammo is 6 rounds** (`rounds`), a **box is 12** (`ammo`); the 9mm holds 6, reloading uses loose rounds first (`player.spareRounds`), then a pack, then a box (loads 6, leaves 6 loose).

### Map and shelter UX (October 19–20, 2026)

- Fresh ground, free steps, and dashes all move on **one tap**, with no confirmation. A mouse hover shows the cost. Fresh ground still costs 1 move and 3 Energy. Dash targets glow with slow beams: green 2 away, yellow 3.
- **Head back to shelter** skips the route and immediately plays the current shelter's opening door, then shows the outing summary (tiles cleared, found, Health/Dread change). Continue completes the phase change and saves. Return waits for an in-progress map step to finish.
- Cleared encounters keep their prop on the map, dimmed once dealt with.
- **Houses with doors** (`utils/tondo.ts` `houseDoorAt`, about one house in six): `TondoTile.door` is `open | locked | boarded` and `floor` is `wood | tile`, both fixed by the house's coordinates. `content()` gives the street tile in front of a non-boarded door the content `'house'`. The map draws the door on the house's street face (`tondoRender.ts`: dark doorway with warm light = open, red padlock = locked, planks = boarded, plain = searched). Stepping onto that tile opens the house card in `TileCard.vue`: **Go in** (open), or **Pry it open** (crowbar) / **Kick it in** (55%, +3 Dread on failure) for locked. Going in costs no hex move and plays the nida door transition into **`HouseScreen.vue`**: an iframe of `public/game/house-interior/index.html?embed` (source `.art/house-interior/source.html`, rebuilt with `build.py`, exported by `export_to_app.py`), a walkable top-down house lit by Juan's flashlight, laid out from `houseLayout(q, r)` (`seed`, `tpl` flat or stock). Loot is **hidden in the containers** until searched (6 searches per house, noise wakes sleepers). `HouseScreen` is the bridge (postMessage `pauwi: 'house'` / `'house-cmd'`): the page asks it to `take` (real `inventory.addToBag`, as many as fit), `drop`, `use`; it `sync`s bag, health and dread to the page; a `fight` message starts `combat.start(rollEncounter(1), { interior: floor })`, and on the fight's end it sends `fightEnd` (won: zombie removed; escaped: it is stunned and Juan runs for the door). `stores/house.ts` holds the open house tile and per-house progress (containers opened and what is left in them, kills, key, searches), so stepping out and back in finds it as he left it. Leaving resolves the tile only when every container is searched or the search budget is spent; otherwise the house waits. Dev: `/?house=N`. The phone map marks seen houses with doors ("House · door open / locked"). A `crowbar` item exists now (trunks and houses can hold one).
- **The phone map** (`PhoneMap.vue`) shows a live offline map with tappable squares for shops, shelters, Tutuban, and visited street encounters. A place card shows its name, type, description, hex distance, and current search status. Business addresses appear before visiting; unseen loose loot and danger stay hidden. Drag to pan, +/− zoom, ◎ recentres, tap outside to put it away. `utils/phoneMap.ts` builds markers from the visible neighbourhood without creating board tiles. Small viewports use a wider popup for readability.
- Shelter: interior on top, one row of meters, a Dread line only when Dread > 0, The Way Out in one line, Eat (stash and bag, best fit first) / Sleep / Head out, and a folded **Settings & Save** (Sound/Shake/Vibrate + the save box). Pack: pixel bag, **Pack like last time**.
- Gear: pixel panels around Juan's eight worn slots. Tap to inspect, then **Equip** or **Take Off**; weapons show live damage by distance, hit/crit odds, swings or loaded rounds. Pack links directly to Gear. Equipping preserves unrelated armor and weapons; removed gear goes to the stash when the bag is full.

### Open items

- Phone sounds: `phone-open` (the user's) plays on pull-out; **put away** (`put-item`) and the **screen-wake tap** (`item-pickup`) are placeholders until the user sends sounds.
- The phone art was built from a pasted 1024×572 copy of the sheet; if the original lands in `Pictures/pauwi-assets/`, copy it over `.art/phone-map/src/phone-map-sheet.png` and rebuild.
- `CLAUDE.md`'s "Status" section is older than the port — trust this file for status.
- Art still missing from the October 23 update: sprites for the old armor (hard hat, leather jacket, scrap vest, work boots) and the trade goods (cigarettes, gold, phone, gin, copper wire, coffee) are emoji; the new weapons borrow existing first-person hands (sibat → arnis, balisong → itak, crowbar/rebar → pipe, hammer → makeshift, sumpak → pistol).

### Asset pipelines (Python + PIL / ffmpeg)

Rebuild an asset, then run `python export_to_app.py` from `.art/`. **It wipes and rewrites `public/game/`**, so every runtime asset must come from `.art/` and be listed in its `KEEP` — never hand-place files in `public/game/`.
- Scenes, items, UI, fronts, doors: `encounters/tmp/pixelate.py`, `items.py`, `ui.py`, `fronts.py`, `doors.py`. The October 23 sheets (weapons, armor) and the trader's scene: `encounters/tmp/new_items.py` (cuts with `cutlib`, writes the sprites and injects them into the page's `ITEM_SRC`/`SRC`); Cora's portraits and the stall prop: `kit/build.py`. Weapons: `juan-hands/render.cjs`, then `juan-hands/pistol.py`. The Brute: `enemies/brute/build.py`. Large Shamblers for in-house fights: `enemies/shambler/build_large.py`.
- Map Juan: `juan-move-preview/export.py` packs `Pictures/pauwi-assets/{idle,move}` (20 frames each) into `out/juan-{idle,move}.png` (half size; shoulder pivots idle 53,56 / move 53,60).
- The phone: `phone-map/build.py` turns `src/phone-map-sheet.png` (3 magenta-bordered panels, flat #00FF00 screens) into `out/phone-hand.png` + `out/phone-hand.json` (screen rects; the screen is a transparent hole).
- Sounds: the user drops files in `Pictures/pauwi-assets/sfx/`; level them to peak about −1 dB with ffmpeg (e.g. `ffmpeg -i in.mp3 -af "volume=3.5dB" -ar 44100 .art/sfx/name.mp3`), kebab-case names in `.art/sfx/`, then export. Variations are `name-2.mp3` etc., registered in `useSfx.ts` `VARIATIONS`.

**Gotchas:**
- Run `python lint.py` from `.art/` after every edit to a preview page: it `node --check`s every inline script and flags a `//` comment that swallowed code on the same line.
- An apostrophe inside a single-quoted JS string (e.g. `'farmer's'`) breaks the whole page. Use double quotes for text with apostrophes.
- An element with a CSS `display` rule ignores the `hidden` attribute unless you add `[hidden] { display:none }`.
- The combat page cache-busts `out/manifest.json` with `?v=`; without it a rebuilt animation silently never plays.
- Browser automation: a background tab pauses `requestAnimationFrame`, so canvas animations freeze in tests. The Playwright browser here may be the **user's own browser** (it can jump to an extension page or show taps that weren't yours) — re-navigate and don't assume stray state is a bug.
- Scripted multi-file edits: inline bash heredocs containing quotes or non-ASCII (`·`, `—`, `−`) have failed or silently not applied; write the Python edit script to a file and run that, and assert each replacement.

## Operational gotchas worth knowing

- `pnpm run dev` and `pnpm run generate` can fail with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`: pnpm's pre-run dependency check wants to purge and reinstall when `node_modules` predates the lockfile, and it refuses without a TTY. Either run `pnpm install` once in a real terminal, or bypass the check with `./node_modules/.bin/nuxt dev` / `./node_modules/.bin/nuxt generate`.
- **Test loop without the emulator:** `./node_modules/.bin/nuxt generate`, then `python -m http.server 8790 -d .output/public`, open `http://localhost:8790/`. Drive state through Pinia from the console: `document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('board')` (also `ui`, `player`, `inventory`, `combat`).
- **Dev shortcuts:** `?fight=1|2|3` drops straight into a fight; `?tp=N` teleports onto stop N (1–3 the shelters, 4+ Tutuban's plaza and the Brute).
- No test runner is installed. `nuxt build` / `nuxt generate` is the only automated gate — it catches template and syntax errors, but **not** type errors (esbuild strips types without checking), so read your own types carefully.
- Anything on the phone goes through: `pnpm run generate` → `npx cap sync android` → `npx cap run android` (or the ▶ button in Android Studio with the Pixel 7 AVD selected).

## Handoff

**Last session (November 20, 2026, Claude), mockups, fixes, and the weight port begun:** Bugs fixed in the app: the house card no longer reappears over the interior (TileCard hides while `house.open`; leaving closes it); trunk/cache items tapped in the bag strip go back into the scene (`untake` message in the encounter page); the 9mm holds **18** and loads from the Bag (`player.loadPistol`, LOAD THE 9MM button); the original map Juan is back (`spr-juan.png`, kept by `export_to_app.py`). New sounds via `.art/sfx/import_sfx.py` (grind loop/spark, hammer, upgrade success/fail, 9mm reload, pistol cock, shotgun/M4 reload). **Mockups (in `.art/`, not ported yet):** `keepsakes/` (notes and photos, the shelter wall), `weight/` (index: the weight, item acts, survivors, Mang Isko; `isko.html`: melee upgrade shop with four mini-games and 1–3 stars; `world.js` holds all the rules), `guns/` (pump shotgun + M4, painted frames aligned by `build.py`, recoil, sway). **Porting now, in order:** (1) the weight, done this session: `data/weight.ts` (kg, loads), `inventory.carriedKg/load/lastRefusal`, pickups refused past 20 kg, step Energy and dash by load (cleared ground drains but never blocks: never stranded), Run odds by load, `WeightBar.vue` on both bag screens with kg per slot, the map's bag sprite by load with a kg chip; the painted trade goods and armor sprites are wired in. Next: item acts (two-turn gauze with the hand frames, meals on the counter), survivors, Mang Isko, keepsakes, then the gun trader (Mang Celso; his four paintings are in pauwi-assets: `celso_portrait/map_icon/encounter.jpg`, `gun_items_2.jpg`). Decisions: Juan is a province man (memory); the album survives death; one street tab shared by Cora and Isko; stars are shown, fixed-vs-chosen star paths still open; points come from trading and (planned) odd jobs paying 5–10. Not done: the house page still says BAG FULL when the reason is weight.

Before that: **(October 23, 2026, Claude), the suki trader, armor, new weapons:** Aling Cora's stall (see the live numbers: tab, ranks, request, under-the-table stock, Family tips) with the user's painted scene, portrait and map stall; armor that wears and caps at half a hit, six new pieces plus the old four now in the loot (house wardrobes/drawers/lockers, trunks, street wins, her table); five new weapons with traits (sibat reach, balisong crit, crowbar in hand, rebar, hammer knock-back) and the sumpak with shells (lane hit); trade goods; copper wire patches armor. Verified in headless Chrome on port 8791 (a CDP script, the Playwright MCP did not connect): sumpak lane hit + shell reload, sibat at MID, hammer knock-back, a 10 bite landing as 6 with 4 armor and the pieces wearing, the stall on the map, the card, sell/request/buy, the rank-up adding an under-the-table piece, gone at night. `balance-sim.cjs` has armor and the new weapons. Not checked: the phone pin by eye, the Family tip, patching armor at the stash, a full save/reload round trip, the house page's new loot by eye, the Android emulator.

Before that: **(October 23, 2026, Claude), painted kit, radio tips, crafting, QOL:** the user's painted sheets are cut by `.art/kit/build.py` into `public/game/kit/out` (exported): the wristwatch (`KitWatch.vue`, shared by the map and the shelter: the LCD readout drawn on its screen by `drawLcd`, tap for the green backlight with "DAY 1 · 4 MOVES · EN 40", blinks on the last move out there), the compass (painted face, needle drawn by `drawNeedle`; tap switches between Tutuban and the nearest shelter Juan could claim), the phone in a jeans pocket that cracks in five steps as Health drops (with a red dot for an unread radio tip), the message-box frame and the Juan / Shambler portraits (`CombatHud`: the face is whoever the line is about, and it jolts red when that side is hit). **Radio tips** (the Way Out itself is on hold until the demo is right; Tutuban stays the goal): listening to a radio event calls `board.addCache()`, which puts a supply cache on fresh plain street 4 to 7 hexes away; the phone map draws a dotted amber ring with a **?** around the area (centred a little off the real tile); stepping on the cache tile marks it found (the ? goes) and its card opens a take-what-fits pick; caches are saved and cleared with a new zone. **Crafting** (`data/crafting.ts`, from the stash and the bag, made at the shelter's stash under Make): Hot meal (rice + water), First-aid kit (gauze + alcohol), Molotov (alcohol + matches; in a fight it burns every Shambler for 3), Tape the handle (straps: +4 swings on the weapon in hand). **QOL:** a step into a body's tile with Health 35 or less asks for a second tap; press and hold a hex to see its cost (or a house's progress) without moving; houses and shops can be marked on the phone and pulse bone-white on the map (`board.pins`, saved); when a weapon breaks mid-fight the weapon belt is open on Juan's next turn; FAST FIGHTS setting (every beat ×0.55); the death screen adds Houses searched and what got him. Not checked: tapping the compass and the watch backlight by hand, press-and-hold on a phone, the low-Health confirm, the Android emulator.

Before that: **(October 21, 2026, Claude), the interface overhaul:** the three concepts the user picked are in the app. **Map = Juan's kit** (`MapScreen.vue`, `PixelMap.vue`, drawings in `utils/juanKit.ts`): the pixel map fills the screen with no title, legend or tab bar; the wristwatch shows day or night, the hour (06:00 or 18:00 plus two hours a move spent), the moves as segments and energy; the compass points at Tutuban with the tile count; the bag opens the Bag (Pack at home), the shelter key asks "Head back to shelter?" (at home it just goes inside), the phone peeking up opens the phone map, and the status line is a fading subtitle. **Shelter = Juan's room** (`ShelterScreen.vue`): the shelter's 110x225 pixel room (`/game/encounters/src/shelter-*-110.png`, now exported) fills the screen; per-shelter `SPOTS` (nida, t10, brgy, mm) make its things tappable with amber glints: sleep (mat or cot), eat (food list, best first), stash (Pack the bag, Gear), the way out (route bar, next shelter), head out (to Pack), settings and save (toggles incl. LEFT HAND, SavePanel); watch, shelter name and a slim meter strip with Dread. **Combat = the thumb fan** (`CombatHud.vue`): a pixel octagon whose verb follows the weapon (SWING, CHOP, STAB, PUNCH, SHOOT) with the damage at the target's row and swings-left pips (rounds for the gun), four tiles on an arc (Guard, Item, Swap, Run with odds and count badges), item/weapon belt along the bottom edge, long-press = one-line help, enemy turn dims it, cracking weapon goes red, `settings.lefty` mirrors it. The combat log is now an RPG message box that types itself out with coloured numbers and a blinking ▼. The tab bar is hidden on every screen. Not checked: the t10, brgy and mm hotspot positions by eye (only nida), the fan's long-press and left-hand mirror in the app, the Android emulator.

Before that: **(October 21, 2026, Claude), random houses and QOL:** the walkable house is now really generated from its seed (`buildHouse` in `.art/house-interior/source.html`): flats get random living/bedroom widths (either way round), room heights, kitchen/bath split, door positions and front-door position; storerooms random size; furniture comes from per-room lists (`ROOMSPEC`: against the back wall, on the wall, loose on the floor, floor decals) and a piece is only kept if every open tile stays reachable and every cupboard keeps a side to stand at (600 seeds checked: no errors, nothing walled in, 21 flat and 30 storeroom sizes). QOL: a green tick on searched containers, **Take all that fits** on the loot card, **BAG n/10** in the house HUD (red when full, and a heads-up when searching with a full bag), an amber arrow at the screen edge pointing to the front door when it is off screen, **Sort the bag** on the Bag tab (`inventory.sortBag`: merges half stacks, groups food, medicine, ammo, weapons, the rest), tapping a doored house on the hex map says how far Juan got ("Not searched yet", "Half-searched · 4 of 13", "Searched", "Locked", "Boarded up"), and the **phone map card** shows Threat (a bar) and Supplies (dots for food, medical, tools, weapons) for houses, shops, cars, backpacks and danger spots (`placeIntel` / `houseProgress` in `utils/phoneMap.ts`). The card only knows what Juan knows: a house never entered is a guess by its kind with threat Unknown; once he has been in it counts what he left in opened cupboards and the Shamblers still up. House progress (`stores/house.ts`) is now in the save blob (`houses`, optional, so old saves load). Not checked: tapping a house on the hex map by hand (logic only), the card on a full-size phone.

Before that: **(October 20, 2026, Claude), doorways and door cue:** the open interior doorways (hall to living room, living room to kitchen) are now two tiles wide (`wide()` in `source.html`; the frame is drawn 9-sliced so its edge stays crisp; the locked bedroom door and the front door stay one tile). On the map, a house with an open door pulses faintly amber and a locked one red while within 3 hexes (`glowOf` in `tondoRender.ts`, the same pulse shops and shelters use), and the map legend has a "House with a door" row. Door on the facade, phone-map entry and card text were already there. Not yet checked by eye: how strong the pulse reads in fog and at night.

Before that: **(October 20, 2026, Claude), art pass on the house:** the painted Shambler is in the walkable house (`house_shambler_1`: walk, 4 facings, the sheet has one back view so "up" is that frame with a bob; `house_shambler_2`: asleep x4, waking x8, dead x3; sleepers show a lying pose, wake through the lying-to-standing frames, and a killed one stays on the floor as a corpse). The flat's lower rooms are now a **kitchen** (terra floor: fridge, pantry, sink cabinet, drawer tower, rice cooker, biscuit tin, plus stove, table, chairs, dispenser, bin) and a **bathroom** (blue tile: medicine cabinet, laundry basket, toiletry cart, plus toilet, sink, shower curtain, drum, washer, drain, mold, roaches); the searchable ones have open sprites. Sources: `house_shambler_1/2`, `house_furnitures_8` (bathroom), `house_furnitures_9` (closed kitchen pieces), `.art/house-interior/refs/house_kitchen_1.png` (first kitchen sheet; it only existed as a pasted image). Cut by `.art/house-interior/build_art.py` (Shamblers 8:1 then scaled to 26 px with one palette per sheet). The stand-alone preview's combat is only a placeholder ("Preview only"); the app opens the real interior combat. Not yet checked by eye in the app: the new kitchen and bathroom at full size, and the up-facing zombie bob.

Before that: **(October 20, 2026, Claude), latest:** corrected the house flow after the user's feedback ("where is the exploration?"): entering a house now opens the walkable interior (`HouseScreen`, hidden loot, fight only on contact); the instant fight and the pre-listed floor loot are gone. Verified in the browser on a separate port: entry, search, taking into the real bag, contact fight, win back into the house, and leaving. Not yet checked: the locked bedroom door and key in the app, re-entering a half-searched house, the Retreat path, the Android emulator.

Before that: made interior fights reachable. Houses with doors on the map (open / locked / boarded, drawn on the facade), the house card and its pry/kick locks, the interior fight on entering, free taking of loot with a bag-drop panel (also for shops and trunks: no more pick-one), the bag rework (10 slots, stacks of 2, `{ id, qty }`, old saves convert), and the new ammo sizes (6 and 12). `InteriorCombatScreen.vue` is its own screen with a 92 px zombie. Verified in the browser: stacking and capacity rules, reload with packs and boxes, a house door to an interior fight and back with a won tile. Not yet looked at by eye: the map door at its small size and the house loot panel; check both.

Before that: built the interior combat backgrounds and the in-house fight rule. `.art/combat-bg-interior/` pixelates the painted wooden and tiled rooms (`build.py`, run again if a painting changes) and `index.html` lights them with Juan's flashlight (a dying-battery wobble, quick flickers, an occasional sag that gets tapped back; `?flicker=0`, `?grid=1`, `?floor=`). Shown by `InteriorCombatScreen.vue` (the grid numbers in `build.py` only matter for the preview's `?grid=1`; the game draws no grid in there). The large Shamblers it uses (72 and 92 px) come from `.art/enemies/shambler/build_large.py` (`hy` 143, `vx` 55, lane 1.2), added to `export_to_app.py`, and `balance-sim.cjs` has the interior numbers. The standalone `.art/house-interior/` walkable-house study was also built this session (a throwable preview, not wired into the app: the user decided combat is the flagship, so Juan there uses only his movement sheet).

Earlier (October 20, 2026, Codex): added tappable location squares and place cards to the phone map, including shops, search status, entrance distances, zoom, and touch/keyboard controls. Static generation and nine browser check groups passed; browsing leaves run state unchanged. Earlier this session: one-tap movement, direct shelter return, pixel Gear, and the fix for equipping stripping unrelated gear. Review artifacts are in `.playwright-mcp/`.

**Decisions the user made (October 20–23, 2026), still standing:**
- **The Way Out (5-step escape plan) is on hold** until the demo feels right; it needs story work from the user. **Tutuban stays the goal.** Don't build fare/papers/safe-route steps. The radio gives hints instead (radio tips, done).
- Interface direction: **map = Juan's kit (concept B)**, **shelter = Juan's pixel room (concept 2)**, **combat = the thumb fan**. Concepts live in `.art/map-ui/`, `.art/shelter-ui/`, `.art/combat-ui/fan.html`. The tab bar is gone.
- Houses: enterable, walkable, generated per seed; loot hidden until searched; interior combat only on contact with a zombie inside.
- Crafting stays simple: one or two ingredients, made at the shelter.

**Next up (suggested to the user on October 23, waiting for their pick):**
1. ~~The suki trader~~ done October 23 (with armor and new weapons).
2. One-off survivors (short give-or-refuse encounters for Hope; not companions).
3. Found notes and photos in houses, collected into an album on the shelter wall.
4. New enemy types: Runner (attacks from MID), Tanod (armoured until hit once), Bloater (burst it at FAR). Needs art: write Nano Banana prompts first.
5. Night packs moving across the map hex by hex.
6. Bleeding (bites can cause it; a bandage stops it).
7. Shelter upgrades (barricade, rain catcher, kamote patch), shown as objects in the room.
8. Juan's journal: a nightly diary line, readable in the shelter.
9. A sound pass (ambience, heartbeat at low Health, creaks near a Shambler in a house).
10. Small perks from milestones.
Claude's picks were 1, 3, 7 and 5. The user said they'd test the October 23 updates first.

**Open / waiting on the user:**
- Test by hand: the October 23 updates (watch backlight, compass tap, radio tip → ? on the phone → cache, crafting at the stash, molotov, the low-Health second tap, press-and-hold on a hex) and the October 21 ones (tap spots in the t10, brgy and mm rooms; the fan's long-press and left-hand mirror).
- Art still missing: the combat fan icon sheet (shield, bandage, swap, run, octagon) was never generated, so the fan uses code-drawn icons; the shelter key is still code-drawn.
- Still proposals from earlier: shelter range, a scavenging-action budget, food/resource balance.
- Phone sounds for **put away** and the **screen-wake tap** (placeholders `put-item` / `item-pickup` in `PhoneMap.vue`). The user drops sounds in `C:\Users\Thirde\Pictures\pauwi-assets\sfx\`.
- Optionally the original phone sheet (sharper than the pasted copy): rebuild with `.art/phone-map/build.py`.
- Nothing has been run on the Android emulator; test in the browser.

**How Claude tested this stretch:** `pnpm run generate`, then `python -m http.server 8791 --directory .output/public` from the repo root (port 8791 so the user's own save on other ports is never touched; serving from inside `.output/public` makes the next `generate` fail with EBUSY). Drive state through Pinia, screenshot, then delete the screenshots from the repo root. Dev shortcuts added: `?house=N` (walk into a house) and `?fight=N&interior=wood|tile`.
