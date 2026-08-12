# PAUWI — Build Plan (draft)

Goal: playable core loop on an Android phone ASAP. Polish comes after the loop is proven fun. Build order below is sequenced so each phase is independently testable in-browser before syncing to Android.

## Phase 0.5 — Prologue (done alongside the UI alignment pass)
- 5-beat narrative intro (Day 0 stockroom shift → NAIA outbreak news → Day 14 fog begins) shown once before the game starts, matching `reference.html`'s `#intro` sequence.
- Splash → beat 1..5 → CONTINUE/BEGIN button, progress dots. Gated by a `prologueDone` flag in the `ui` store (in-memory only for now — Phase 2's localStorage persistence work should make this stick across sessions).

## Phase 0 — Foundations
- Pinia store shape: player position (axial hex coords), sparse tile map (`Map<coordKey, Tile>`), move budget, day/night cycle counter.
- Hex math utility module: axial coordinate helpers, neighbor lookup, distance, pixel conversion for SVG.
- One dumb SVG hex board component that renders whatever tiles exist in the store, centered on the player. No game rules yet — just prove hex-in-SVG rendering + viewport culling works.

## Phase 1 — Exploration core loop
- Lazy tile generation: stepping onto/near an unrevealed coord generates it (type: `nothing | location | zombie | event`, weighted random for MVP).
- Fog of war: visibility radius 2–3 rings around player; category icon reveal on the immediate ring; fading unknown shape at the edge ring.
- Movement: tap adjacent tile → costs 1 move if unrevealed-cleared-this-visit, free if already cleared. Move budget of 5 enforced.
- Tile resolution: stepping onto a tile opens a card (loot/danger/event) with real choices — combat and events stubbed as placeholders for now.
- "Head back to shelter" always available, free return along cleared path.

**Checkpoint: playable on phone** — you can walk the hex grid, reveal fog, spend moves, retreat. This is the first build worth `cap run android` on a real device.

## Phase 2 — Day/night + shelter loop
- Cycle summary screen (moves used, tiles cleared) → Continue → budget resets to 5.
- Shelter screen: Health/Energy/Food/Hope meters, Eat/Sleep/Head Out actions, stash/inventory grid (can be minimal — grid + item list, no drag-drop yet).
- "The Way Out" 5-step escape progress bar, wired to whatever unlocks it (loot/events feed it — define trigger conditions when we get here).
- localStorage persistence: save/load full game state (player, revealed tiles, meters, escape progress) on shelter actions and app background/foreground (Capacitor lifecycle hook).

**Checkpoint:** full day/night cycle loop is playable and persists between app sessions.

## Phase 3 — Combat core
- Turn-order queue UI, enemy formation (1–3 zombies, front-only targetable).
- Player actions: Attack, Guard, Use Item, Retreat.
- Dread meter + Shaken state at high Dread (accuracy penalty), bleeds into Hope post-fight.
- Weapon durability.
- Actor-slot system built for 1–4 player-side actors even though only Juan exists — don't hardcode single-actor assumptions into combat state shape.

**Checkpoint:** zombie tiles from Phase 1 are no longer stubs — full loop (explore → fight/loot/event → shelter → next cycle) is playable end to end.

## Phase 4 — Shelter-to-shelter progression
- Zone-switch logic: relocating to a new shelter swaps the active hex zone (~50–100 tiles), old zone discarded (no backtracking needed per MVP scope).
- Landmark distance readout for majors (e.g. "53 TILES LEFT") visible beyond fog.
- Content pass: place Tondo locations from CLAUDE.md's world reference into the zone generation as they become reachable.

**Checkpoint: MVP complete** — full run from Nida's Sari-Sari Store toward North Harbor Pier is playable solo, saved locally, on your phone.

## Explicitly deferred (per CLAUDE.md MVP scope)
Companion roster, backtracking to cleared zones, any backend/sync, PWA.

## Open questions to resolve before/during Phase 1
- Exact tile-type generation weights (how common is zombie vs loot vs event vs nothing)?
- What "real choices" look like on a loot/event card — is this data-driven (JSON table of encounters) or hardcoded per-tile-type for MVP?
- Escape-plan trigger conditions (what specific actions advance each of the 5 steps)?
