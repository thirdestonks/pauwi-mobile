import { defineStore } from 'pinia'
import { useInventoryStore } from './inventory'
import { ENEMY_TYPES, rollEncounter, type EnemySpec } from '~/data/combat'
import { usePlayerStore } from './player'
import { rollEventId } from '~/data/events'
import { TUTUBAN_NAME } from '~/data/shelters'
import { axialNeighbors, axialDistance, hexKey, keyToHex, type AxialCoord } from '~/utils/hex'
import {
  LM, SHELTERS, SHELTER_KEYS, content, frontOf, hash, hexDist, walkable, zombieCount,
  type ShelterKey, type TondoContent,
} from '~/utils/tondo'

export type TileType = 'nothing' | 'location' | 'zombie' | 'event' | 'shelter' | 'landmark' | 'house'
export type DayPhase = 'day' | 'night'

export interface Tile {
  q: number
  r: number
  type: TileType
  /** What the Tondo generator put here (shop, car, backpack, radio…); the cards read this. */
  content?: TondoContent
  /** Visited — so it's free to walk through again. Separate from `resolved` on purpose. */
  cleared: boolean
  /**
   * The encounter has been dealt with (loot taken, dilemma answered, zombie put down).
   * An unresolved tile keeps its card and, for zombies, keeps its fight — which is what
   * makes retreating from a zombie a real cost instead of a free undo.
   */
  resolved: boolean
  /**
   * Rolled once when the tile is generated and stored here, so the world owns the
   * encounter rather than the combat screen. Coming back to an unresolved tile finds
   * the same crowd waiting.
   */
  encounter?: EnemySpec[]
  /** Rolled once per event tile; the encounter card looks the dilemma up by id. */
  eventId?: string
  /** A locked house door that has been pried or kicked open. */
  unlocked?: boolean
}

/**
 * A named place on the Tondo map: the four shelters (Nida's is home at the start) and
 * Tutuban. `pos` is where Juan stands to use it: a shelter's front step, Tutuban's centre.
 */
export interface Waypoint {
  name: string
  flavor: string
  pos: AxialCoord
  claimed: boolean
  /** The run's finish line. */
  isTutuban: boolean
  /** Which shelter this is (absent on Tutuban). */
  key?: ShelterKey
}

const ICON_RING_RADIUS = 1
const FOG_RING_RADIUS = 3

/** Each phase — day AND night — gets its own move budget. Two outings per day. */
export const MOVES_PER_PHASE = 5
/** Fresh ground costs Energy too; retracing cleared ground is free. */
export const ENERGY_PER_FRESH_MOVE = 3
/** How far one free dash along cleared ground reaches. */
export const DASH_REACH = 3
/** Searching a shop opens a shortcut through the back. */
export const SHOP_MOVE_BONUS = 2

function contentType(c: TondoContent | null): TileType {
  switch (c) {
    case 'shop': case 'loot': case 'car': case 'cache': return 'location'
    case 'zombie': return 'zombie'
    case 'house': return 'house'
    case 'event': return 'event'
    case 'shelter': return 'shelter'
    case 'relocate': case 'tutuban': return 'landmark'
    default: return 'nothing'
  }
}

export const useBoardStore = defineStore('board', () => {
  const home = ref<ShelterKey>('nida')
  const start = frontOf('nida')
  const playerPos = reactive<AxialCoord>({ q: start[0], r: start[1] })
  const tiles = reactive(new Map<string, Tile>())
  const moveBudget = ref(MOVES_PER_PHASE)
  const activeCard = ref<Tile | null>(null)

  // --- Day/night cycle: two phases per day, five moves each -----------------------------
  const phase = ref<DayPhase>('day')
  const dayCount = ref(1)

  // --- The fixed places: four shelters and Tutuban --------------------------------------
  const waypoints = ref<Waypoint[]>([])
  const shelterName = ref(SHELTERS.nida.name)
  const shelterFlavor = ref(SHELTERS.nida.flavor)
  const shelterPos = ref<AxialCoord>({ q: start[0], r: start[1] })

  /**
   * Set by the map just before it starts a fight, so that when the map comes back it
   * knows what the fight was for (a zombie tile, a car alarm guarding a trunk, the Brute).
   * Never saved: a save only happens at rest.
   */
  const fightFor = ref<null | 'zombie' | 'trunk' | 'brute'>(null)

  const homeId = computed(() => shelterName.value)
  const sheltersClaimed = computed(
    () => waypoints.value.filter((w) => w.claimed && !w.isTutuban && w.key !== 'nida').length,
  )
  const tutuban = computed(() => waypoints.value.find((w) => w.isTutuban) ?? null)
  const nextShelterWaypoint = computed(() => waypoints.value.find((w) => !w.claimed && !w.isTutuban) ?? null)
  const distanceToTutuban = computed(() => hexDist(playerPos.q, playerPos.r, LM.q, LM.r))

  /** Standing on another shelter's front step right now — the card offers to move in. */
  const canClaimHere = computed(() =>
    waypoints.value.find((w) => !w.isTutuban && w.key !== home.value && w.pos.q === playerPos.q && w.pos.r === playerPos.r) ?? null,
  )

  /** Standing in Tutuban's plaza, one ring out from the mall — the Brute's card. */
  const atTutuban = computed(() =>
    hexDist(playerPos.q, playerPos.r, LM.q, LM.r) === 2 ? tutuban.value : null,
  )

  function buildWaypoints() {
    waypoints.value = [
      ...SHELTER_KEYS.map((k) => {
        const [q, r] = frontOf(k)
        return { name: SHELTERS[k].name, flavor: SHELTERS[k].flavor, pos: { q, r }, claimed: k === 'nida', isTutuban: false, key: k }
      }),
      { name: TUTUBAN_NAME, flavor: '', pos: { ...LM }, claimed: false, isTutuban: true },
    ]
  }

  const tilesCleared = computed(
    () => [...tiles.values()].filter((t) => t.cleared).length,
  )

  // --- Radio tips: a broadcast names a street; a supply cache waits on a fresh tile there. The phone map shows a ? circle around
  // the area (centred a little off the real spot); stepping onto the cache tile finds it and the ? goes. ---
  interface RadioCache { q: number; r: number; cq: number; cr: number; radius: number; street: string; found: boolean; seen: boolean }
  const caches = ref<RadioCache[]>([])
  const STREETS = ['Mercado St.', 'Ugbo', 'Tayuman', 'Juan Luna', 'Moriones', 'Balut', 'Vitas', 'Herbosa', 'Pritil', 'Velasquez']
  /** Places a new cache 4 to 7 hexes from Juan, on plain street he has never stepped on. Null when there is nowhere to put one. */
  function addCache(): RadioCache | null {
    const spots: [number, number][] = []
    for (let dq = -7; dq <= 7; dq++) for (let dr = -7; dr <= 7; dr++) {
      const q = playerPos.q + dq, r = playerPos.r + dr, d = hexDist(q, r, playerPos.q, playerPos.r)
      if (d < 4 || d > 7 || !walkable(q, r) || tiles.has(hexKey(q, r))) continue
      if ((content(q, r, home.value) ?? 'nothing') !== 'nothing' || caches.value.some((c) => c.q === q && c.r === r)) continue
      if (traderSpots.value.some((s) => s.q === q && s.r === r)) continue           // her stall's ground stays clear
      spots.push([q, r])
    }
    if (!spots.length) return null
    const [q, r] = spots[Math.floor(Math.random() * spots.length)]!
    const off = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]][Math.floor(Math.random() * 7)]!
    const c: RadioCache = { q, r, cq: q + off[0]!, cr: r + off[1]!, radius: 2, street: STREETS[Math.floor(Math.random() * STREETS.length)]!, found: false, seen: false }
    caches.value.push(c)
    return c
  }
  /** The phone has been looked at: no more "something new" dot. */
  function markCachesSeen() { for (const c of caches.value) c.seen = true }

  // --- Aling Cora, the suki trader: three spots of plain street 2 to 5 hexes from the shelter, fixed per zone; each day she sets up
  // her stall at one of them, and packs it away at night. The phone shows where she is today. ---
  const traderSpots = computed<AxialCoord[]>(() => {
    const { q: sq, r: sr } = shelterPos.value
    const spots: AxialCoord[] = []
    for (let dq = -5; dq <= 5; dq++) for (let dr = -5; dr <= 5; dr++) {
      const q = sq + dq, r = sr + dr, d = hexDist(q, r, sq, sr)
      if (d < 2 || d > 5 || !walkable(q, r) || (content(q, r, home.value) ?? 'nothing') !== 'nothing') continue
      spots.push({ q, r })
    }
    return spots.sort((a, b) => hash(a.q, a.r, 33) - hash(b.q, b.r, 33)).slice(0, 3)
  })
  /** Where her stall is today (by day only; null at night or when there is no room for it). */
  const traderPos = computed<AxialCoord | null>(() => {
    const spots = traderSpots.value
    return phase.value === 'day' && spots.length ? spots[Math.floor(hash(dayCount.value, spots.length, 34) * spots.length)]! : null
  })
  const isTraderTile = (t: { q: number; r: number }) => !!traderPos.value && traderPos.value.q === t.q && traderPos.value.r === t.r
  /** Standing at her stall right now: the card offers to trade. */
  const atTrader = computed(() => isTraderTile(playerPos))
  /** Places marked on the phone ("come back later"): they pulse on the map. Keys are the hex of the place. */
  const pins = ref<string[]>([])
  function togglePin(key: string) {
    pins.value = pins.value.includes(key) ? pins.value.filter((k) => k !== key) : [...pins.value, key]
  }

  function getTile(coord: AxialCoord): Tile | undefined {
    return tiles.get(hexKey(coord.q, coord.r))
  }

  /** The stored record of a walkable tile, made the first time anything asks. */
  function ensureTile(coord: AxialCoord): Tile {
    const key = hexKey(coord.q, coord.r)
    let t = tiles.get(key)
    if (!t) {
      const cached = caches.value.some((x) => !x.found && x.q === coord.q && x.r === coord.r)
      const c = cached ? 'cache' : content(coord.q, coord.r, home.value) ?? 'nothing'
      const type = contentType(c)
      const cleared = c === 'shelter'
      t = {
        q: coord.q,
        r: coord.r,
        type,
        content: c,
        cleared,
        resolved: cleared || c === 'nothing',
        encounter: c === 'zombie' ? rollEncounter(zombieCount(coord.q, coord.r)) : undefined,
        eventId: c === 'event' ? rollEventId() : undefined,
      }
      tiles.set(key, t)
    }
    return t
  }

  /** A tile asks for its card while it has something unresolved, and a shelter Juan could move into always does. */
  function wantsCard(t: Tile) {
    return !t.resolved || t.content === 'relocate' || t.content === 'tutuban' || isTraderTile(t)
  }

  function isAdjacentToPlayer(coord: AxialCoord): boolean {
    return axialNeighbors(playerPos).some((n) => n.q === coord.q && n.r === coord.r)
  }

  /** What stepping onto `coord` would cost, or why it can't be done. The map shows this on hover. */
  function stepCost(coord: AxialCoord): 'free' | 'move' | 'no-moves' | 'tired' | null {
    if (!isAdjacentToPlayer(coord) || !walkable(coord.q, coord.r)) return null
    if (getTile(coord)?.cleared) return 'free'
    if (moveBudget.value <= 0) return 'no-moves'
    if (usePlayerStore().energy < freshEnergy()) return 'tired'
    return 'move'
  }
  /** Energy a step costs under what Juan carries (data/weight.ts): fresh ground by load (2 light … 8 overloaded); cleared ground is
      free unless he's loaded, and even then it only drains, never blocks: he can always get home. */
  const freshEnergy = () => useInventoryStore().load.fresh
  const clearedEnergy = () => useInventoryStore().load.cleared
  /** How far a dash reaches on cleared ground under his load (3 light/carrying, 2 loaded, 1 = none overloaded). */
  const dashReach = () => Math.min(DASH_REACH, useInventoryStore().load.dash)
  /** What a fresh step costs right now (the map's hover hint reads it). */
  const energyPerFreshMove = computed(() => freshEnergy())

  function arrive(t: Tile) {
    playerPos.q = t.q
    playerPos.r = t.r
    t.cleared = true
    // A radio cache, found: its ? leaves the phone map.
    if (t.content === 'cache') for (const c of caches.value) if (c.q === t.q && c.r === t.r) c.found = true
    // Unresolved tiles keep offering their card, including on a free re-entry — that's
    // how walking away from a zombie leaves you something to walk back into.
    activeCard.value = wantsCard(t) ? t : null
  }

  function moveTo(coord: AxialCoord): boolean {
    const cost = stepCost(coord)
    if (cost !== 'free' && cost !== 'move') return false
    const t = ensureTile(coord)
    if (cost === 'move') {
      // Fresh ground costs Energy as well as a move. Retracing is free — that's what
      // keeps Eat/Sleep meaningful without stranding the player mid-map.
      moveBudget.value -= 1
      usePlayerStore().energy -= freshEnergy()
    } else if (clearedEnergy()) {
      const p = usePlayerStore()
      p.energy = Math.max(0, p.energy - clearedEnergy())
    }
    arrive(t)
    return true
  }

  /**
   * On the green (cleared) path Juan dashes up to DASH_REACH hexes in one tap, free: every
   * hex he passes through and the one he lands on must be cleared. Returns the hexes he
   * steps through after leaving his own (ending on `coord`), or null if he can't dash there.
   */
  function dashPath(coord: AxialCoord): AxialCoord[] | null {
    const d = axialDistance(playerPos, coord)
    if (d < 2 || d > dashReach() || !getTile(coord)?.cleared) return null
    // walk the cleared ground hex by hex, always closing in on the target
    const walk = (from: AxialCoord, left: number): AxialCoord[] | null => {
      if (left === 0) return from.q === coord.q && from.r === coord.r ? [] : null
      for (const n of axialNeighbors(from)) {
        if (axialDistance(n, coord) !== left - 1 || !getTile(n)?.cleared) continue
        const rest = walk(n, left - 1)
        if (rest) return [n, ...rest]
      }
      return null
    }
    return walk(playerPos, d)
  }

  /** Every hex a dash reaches right now, with its distance (2 or 3) — the map lights them. */
  const dashTargets = computed(() => {
    const out = new Map<string, number>()
    for (const t of tiles.values()) {
      if (!t.cleared) continue
      const d = axialDistance(playerPos, t)
      if (d >= 2 && d <= dashReach() && dashPath(t)) out.set(hexKey(t.q, t.r), d)
    }
    return out
  })

  /**
   * The way home over cleared ground, hex by hex (shortest, by breadth-first search), ending
   * on the shelter's step — or null when the green path doesn't connect (it always should).
   */
  function pathHome(): AxialCoord[] | null {
    const goal = hexKey(shelterPos.value.q, shelterPos.value.r)
    const startKey = hexKey(playerPos.q, playerPos.r)
    if (startKey === goal) return []
    const came = new Map<string, string | null>([[startKey, null]])
    const queue: AxialCoord[] = [{ q: playerPos.q, r: playerPos.r }]
    while (queue.length) {
      const at = queue.shift()!
      for (const n of axialNeighbors(at)) {
        const k = hexKey(n.q, n.r)
        if (came.has(k) || !(getTile(n)?.cleared || k === goal)) continue
        came.set(k, hexKey(at.q, at.r))
        if (k === goal) {
          const path: AxialCoord[] = []
          for (let c: string | null = k; c && c !== startKey; c = came.get(c) ?? null) path.unshift(keyToHex(c))
          return path
        }
        queue.push(n)
      }
    }
    return null
  }

  function dashTo(coord: AxialCoord): boolean {
    const path = dashPath(coord)
    if (!path) return false
    if (clearedEnergy()) { const p = usePlayerStore(); p.energy = Math.max(0, p.energy - clearedEnergy() * path.length) }
    arrive(ensureTile(coord))
    return true
  }

  /** Searching a shop: once per shop, a shortcut through the back opens up. */
  function searchShop() {
    const t = activeCard.value
    if (!t || t.content !== 'shop' || t.resolved) return
    moveBudget.value += SHOP_MOVE_BONUS
  }

  /**
   * Backing away without engaging. Locations and events are one-shot, so dismissing them
   * resolves them; a zombie tile stays live until something actually kills the zombie.
   * Shelters and Tutuban are NEVER dismissed this way — their card always re-offers.
   */
  function dismissCard() {
    const t = activeCard.value
    if (t && t.type !== 'zombie' && t.type !== 'house' && t.type !== 'shelter' && t.type !== 'landmark') {
      t.resolved = true
    }
    activeCard.value = null
  }

  /** The house door in front of Juan gives way (crowbar or a kick that worked). */
  function unlockHouse() {
    if (activeCard.value) activeCard.value.unlocked = true
  }

  /** Called when an encounter is actually concluded (victory, loot taken, a choice made). */
  function resolveEncounter(t: Tile | null = activeCard.value) {
    if (t) t.resolved = true
    if (activeCard.value === t) activeCard.value = null
  }

  /**
   * A new home. The streets around it are a new zone: everything cleared before is
   * forgotten (old zones aren't revisitable), and the stash is global so it moves too.
   */
  function claimShelter(waypoint: Waypoint) {
    if (!waypoint.key) return
    waypoint.claimed = true
    caches.value = []                                                   // a new zone: the old tips are for streets left behind
    pins.value = []
    home.value = waypoint.key
    shelterName.value = waypoint.name
    shelterFlavor.value = waypoint.flavor
    shelterPos.value = { ...waypoint.pos }
    tiles.clear()
    activeCard.value = null
    ensureTile(waypoint.pos).cleared = true
  }

  /**
   * Backing out of an outing. Day → night at the shelter; night → a new day (Day 1's
   * night run ends at the dawn of Day 2). The budget refills every phase — that's the
   * "two outings per day" rule.
   */
  function retreatToShelter() {
    playerPos.q = shelterPos.value.q
    playerPos.r = shelterPos.value.r
    // Drop any open card with it — a tile left unresolved stays unresolved, but you're not
    // standing next to it any more, so its card has no business being up next phase.
    activeCard.value = null
    moveBudget.value = MOVES_PER_PHASE
    if (phase.value === 'day') {
      phase.value = 'night'
    } else {
      phase.value = 'day'
      dayCount.value += 1
    }
  }

  /** Sleeping through the night: same phase flip as an outing, minus the walk. */
  function sleepThroughToMorning() {
    phase.value = 'day'
    dayCount.value += 1
    moveBudget.value = MOVES_PER_PHASE
  }

  /**
   * Dev aid alongside ?fight=N: ?tp=N drops Juan straight onto a numbered stop — 1–3 are
   * Tenement 10, Barangay 43 Hall and Mang Mel's, 4+ is Tutuban's plaza (the Brute's card).
   */
  function devTeleportToStop(stop: number) {
    const stops = waypoints.value.filter((w) => w.key !== 'nida')
    const target = stops[Math.min(stop, stops.length) - 1]
    if (!target) return
    const pos = target.isTutuban ? { q: LM.q, r: LM.r + 2 } : target.pos
    const t = ensureTile(pos)
    arrive(t)
  }

  /** Fresh run: world, shelters, and cycle all rebuilt. The death screen calls this. */
  function startRun() {
    tiles.clear()
    caches.value = []
    pins.value = []
    home.value = 'nida'
    playerPos.q = start[0]
    playerPos.r = start[1]
    moveBudget.value = MOVES_PER_PHASE
    phase.value = 'day'
    dayCount.value = 1
    activeCard.value = null
    fightFor.value = null
    shelterName.value = SHELTERS.nida.name
    shelterFlavor.value = SHELTERS.nida.flavor
    shelterPos.value = { q: start[0], r: start[1] }
    buildWaypoints()
    ensureTile(playerPos)
  }

  startRun()

  // --- Save persistence -----------------------------------------------------------------
  // The save is the world in miniature: position, the tiles Juan has touched, the shelters,
  // and the cycle. The streets themselves aren't saved: the generator rebuilds them from
  // the coordinates. Maps don't JSON — tiles travel as {key, ...tile} pairs.
  function snapshot() {
    return {
      playerPos: { ...playerPos },
      tiles: [...tiles.entries()].map(([key, t]) => ({ key, ...t })),
      moveBudget: moveBudget.value,
      phase: phase.value,
      dayCount: dayCount.value,
      waypoints: waypoints.value.map((w) => ({ ...w, pos: { ...w.pos } })),
      shelterName: shelterName.value,
      shelterFlavor: shelterFlavor.value,
      shelterPos: { ...shelterPos.value },
      home: home.value as ShelterKey | undefined,
      caches: caches.value.map((c) => ({ ...c })),
      pins: [...pins.value],
    }
  }

  function hydrate(state: ReturnType<typeof snapshot>) {
    // A save from before the Tondo map (the old seeded 75-tile route) can't be placed on
    // these streets: start the world fresh and keep everything else in the save.
    if (!state.waypoints.some((w) => w.key)) {
      startRun()
      return
    }
    home.value = state.home ?? 'nida'
    playerPos.q = state.playerPos.q
    playerPos.r = state.playerPos.r
    tiles.clear()
    for (const { key, ...t } of state.tiles) tiles.set(key, { ...t })
    moveBudget.value = state.moveBudget
    phase.value = state.phase
    dayCount.value = state.dayCount
    waypoints.value = state.waypoints.map((w) => ({ ...w, pos: { ...w.pos } }))
    shelterName.value = state.shelterName
    shelterFlavor.value = state.shelterFlavor
    shelterPos.value = { ...state.shelterPos }
    caches.value = (state.caches ?? []).map((c) => ({ ...c }))
    pins.value = [...(state.pins ?? [])]
    activeCard.value = null
    fightFor.value = null
    // Standing on something unresolved when the run was saved? Its card comes back up.
    const here = ensureTile(playerPos)
    if (wantsCard(here)) activeCard.value = here
  }

  return {
    playerPos,
    tiles,
    caches,
    addCache,
    markCachesSeen,
    traderSpots,
    traderPos,
    atTrader,
    pins,
    togglePin,
    moveBudget,
    maxMoves: MOVES_PER_PHASE,
    energyPerFreshMove,
    phase,
    dayCount,
    activeCard,
    waypoints,
    shelterName,
    shelterFlavor,
    shelterPos,
    home,
    fightFor,
    homeId,
    sheltersClaimed,
    tutuban,
    nextShelterWaypoint,
    distanceToTutuban,
    canClaimHere,
    atTutuban,
    tilesCleared,
    iconRingRadius: ICON_RING_RADIUS,
    fogRingRadius: FOG_RING_RADIUS,
    getTile,
    stepCost,
    moveTo,
    dashPath,
    dashTargets,
    pathHome,
    dashTo,
    searchShop,
    dismissCard,
    unlockHouse,
    resolveEncounter,
    claimShelter,
    retreatToShelter,
    sleepThroughToMorning,
    devTeleportToStop,
    startRun,
    snapshot,
    hydrate,
  }
})

/** The Brute who holds Tutuban's plaza: the gate fight that ends the demo. */
export const TUTUBAN_GATE: EnemySpec[] = [{ archetype: ENEMY_TYPES.brute.id, hp: ENEMY_TYPES.brute.hp }]
