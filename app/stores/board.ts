import { defineStore } from 'pinia'
import { pickWeighted, rollEncounter, type EnemySpec } from '~/data/combat'
import { usePlayerStore } from './player'
import { rollEventId } from '~/data/events'
import { SHELTER_DEFS, TUTUBAN_NAME } from '~/data/shelters'
import { axialNeighbors, axialDistance, hexKey, type AxialCoord } from '~/utils/hex'

export type TileType = 'nothing' | 'location' | 'zombie' | 'event' | 'shelter' | 'landmark'
export type DayPhase = 'day' | 'night'

export interface Tile {
  q: number
  r: number
  type: TileType
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
  /** Rolled once per event tile; the TileCard looks the dilemma up by id. */
  eventId?: string
}

/**
 * A named stop along the run's seeded route: Nida's (start), the five shelters, and
 * Tutuban at the end. Positions are rolled once per run so every playthrough hops
 * different shelters at slightly different distances.
 */
export interface Waypoint {
  name: string
  flavor: string
  pos: AxialCoord
  claimed: boolean
  /** The run's finish line. */
  isTutuban: boolean
}

const ORIGIN: AxialCoord = { q: 0, r: 0 }
const ICON_RING_RADIUS = 2
const FOG_RING_RADIUS = 6

/** Each phase — day AND night — gets its own move budget. Two outings per day. */
export const MOVES_PER_PHASE = 5
/** Fresh ground costs Energy too; retracing cleared ground is free. */
export const ENERGY_PER_FRESH_MOVE = 3

/** Distance from the start to Tutuban — the demo's finish line. */
const TUTUBAN_DISTANCE = 75
/** Shelter hops run 30–42 tiles apart, per the demo design. */
const SHELTER_HOP_MIN = 30
const SHELTER_HOP_SPREAD = 12 // 30 .. 41
/** Lateral jitter keeps the route from being a ruler line; the final hop stays straight. */
const ROUTE_JITTER = 5
/** Route heading: Tutuban lies east of Tondo. */
const ROUTE_BASE_DQ = 9
const ROUTE_BASE_DR = 0

const STARTING_SHELTER = SHELTER_DEFS[0]

function randInt(min: number, maxInclusive: number): number {
  return min + Math.floor(Math.random() * (maxInclusive - min + 1))
}

// Same weights the board has always rolled: mostly empty streets, with the interesting
// things spread thin across the rest.
const TYPE_WEIGHTS: [TileType, number][] = [
  ['nothing', 0.45],
  ['location', 0.2],
  ['zombie', 0.2],
  ['event', 0.15],
]

function rollTileType(): TileType {
  return pickWeighted(TYPE_WEIGHTS)
}

function makeTile(coord: AxialCoord, type: TileType, cleared: boolean): Tile {
  return {
    q: coord.q,
    r: coord.r,
    type,
    cleared,
    resolved: cleared,
    encounter: type === 'zombie' ? rollEncounter() : undefined,
    eventId: type === 'event' ? rollEventId() : undefined,
  }
}

export const useBoardStore = defineStore('board', () => {
  const playerPos = reactive<AxialCoord>({ ...ORIGIN })
  const tiles = reactive(new Map<string, Tile>())
  const moveBudget = ref(MOVES_PER_PHASE)
  const activeCard = ref<Tile | null>(null)

  // --- Day/night cycle: two phases per day, five moves each -----------------------------
  const phase = ref<DayPhase>('day')
  const dayCount = ref(1)

  // --- The run's route, seeded once per run ---------------------------------------------
  const waypoints = ref<Waypoint[]>([])
  const shelterName = ref(STARTING_SHELTER.name)
  const shelterFlavor = ref(STARTING_SHELTER.flavor)
  const shelterPos = ref<AxialCoord>({ ...ORIGIN })

  const homeId = computed(() => shelterName.value)
  const sheltersClaimed = computed(
    () => waypoints.value.filter((w) => w.claimed && !w.isTutuban).length,
  )
  const tutuban = computed(() => waypoints.value.find((w) => w.isTutuban) ?? null)
  const nextShelterWaypoint = computed(() => waypoints.value.find((w) => !w.claimed) ?? null)
  const distanceToTutuban = computed(() =>
    tutuban.value ? axialDistance(playerPos, tutuban.value.pos) : TUTUBAN_DISTANCE,
  )

  /** Standing on an unclaimed shelter tile right now — the TileCard offers to claim it. */
  const canClaimHere = computed(() => {
    const w = nextShelterWaypoint.value
    return w && !w.isTutuban && playerPos.q === w.pos.q && playerPos.r === w.pos.r ? w : null
  })

  /** Standing on Tutuban right now — the TileCard offers the way out. */
  const atTutuban = computed(() => {
    const w = tutuban.value
    return w && playerPos.q === w.pos.q && playerPos.r === w.pos.r ? w : null
  })

  /**
   * Seeds the run: the five shelters spread 30–42 tiles apart heading east with lateral
   * jitter, then Tutuban one last hop beyond. Rolled once per run — reruns visit the
   * shelters in a different order at slightly different distances.
   */
  function buildRoute() {
    const defs = [...SHELTER_DEFS.slice(1)]
    for (let i = defs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[defs[i], defs[j]] = [defs[j], defs[i]]
    }

    const route: Waypoint[] = []
    let current: AxialCoord = { ...ORIGIN }
    defs.forEach((def, index) => {
      const dist = SHELTER_HOP_MIN + Math.floor(Math.random() * SHELTER_HOP_SPREAD)
      const isFinal = index === defs.length - 1
      const jitterDr = isFinal ? 0 : randInt(-ROUTE_JITTER, ROUTE_JITTER)
      const rawDq = Math.round((dist * ROUTE_BASE_DQ) / 9)
      const dq = Math.max(Math.round(dist * 0.7), rawDq)
      const pos: AxialCoord = { q: current.q + dq, r: current.r + jitterDr }
      route.push({ name: def.name, flavor: def.flavor, pos, claimed: false, isTutuban: false })
      current = pos
    })

    // The last leg: straight east to the station. This pins the run's total length
    // near TUTUBAN_DISTANCE regardless of how the jitter played out.
    const tutubanPos: AxialCoord = { q: ORIGIN.q + TUTUBAN_DISTANCE, r: ORIGIN.r }
    route.push({ name: TUTUBAN_NAME, flavor: '', pos: tutubanPos, claimed: false, isTutuban: true })

    waypoints.value = route
  }

  const tilesCleared = computed(
    () => [...tiles.values()].filter((t) => t.cleared).length,
  )

  function getTile(coord: AxialCoord): Tile | undefined {
    return tiles.get(hexKey(coord.q, coord.r))
  }

  function ensureTile(coord: AxialCoord): Tile {
    const key = hexKey(coord.q, coord.r)
    let tile = tiles.get(key)
    if (!tile) {
      let type: TileType = rollTileType()
      let cleared = false
      // Waypoints materialize as real tiles when the fog first reaches them. The
      // starting shelter and any claimed waypoint are always safe cleared ground.
      const wp = waypoints.value.find((w) => w.pos.q === coord.q && w.pos.r === coord.r)
      if (wp) {
        type = wp.claimed ? 'shelter' : 'landmark'
        cleared = wp.claimed
      }
      tile = makeTile(coord, type, cleared)
      tiles.set(key, tile)
    }
    return tile
  }

  // Lazily generates everything within fog range so it exists before the player
  // reaches it. What's actually shown (icon vs blank fog) is a live distance
  // check done in HexBoard, not stored state — fog follows the player, it isn't
  // a permanent "explored" flag.
  function syncFogAroundPlayer() {
    for (let dq = -FOG_RING_RADIUS; dq <= FOG_RING_RADIUS; dq++) {
      const rMin = Math.max(-FOG_RING_RADIUS, -dq - FOG_RING_RADIUS)
      const rMax = Math.min(FOG_RING_RADIUS, -dq + FOG_RING_RADIUS)
      for (let dr = rMin; dr <= rMax; dr++) {
        ensureTile({ q: playerPos.q + dq, r: playerPos.r + dr })
      }
    }
  }

  function isAdjacentToPlayer(coord: AxialCoord): boolean {
    return axialNeighbors(playerPos).some((n) => n.q === coord.q && n.r === coord.r)
  }

  function moveTo(coord: AxialCoord): boolean {
    if (!isAdjacentToPlayer(coord)) return false
    const tile = ensureTile(coord)
    const cost = tile.cleared ? 0 : 1
    if (cost > moveBudget.value) return false
    // Fresh ground costs Energy as well as a move. Retracing is free — that's what
    // keeps Eat/Sleep meaningful without stranding the player mid-map.
    if (cost > 0 && usePlayerStore().energy < ENERGY_PER_FRESH_MOVE) return false

    moveBudget.value -= cost
    if (cost > 0) usePlayerStore().energy -= ENERGY_PER_FRESH_MOVE
    playerPos.q = coord.q
    playerPos.r = coord.r
    tile.cleared = true
    syncFogAroundPlayer()

    // Unresolved tiles keep offering their card, including on a free re-entry — that's
    // how walking away from a zombie leaves you something to walk back into.
    if (tile.type !== 'nothing' && !tile.resolved) {
      activeCard.value = tile
    }
    return true
  }

  /**
   * Backing away without engaging. Locations and events are one-shot, so dismissing them
   * resolves them; a zombie tile stays live until something actually kills the zombie.
   * Shelters and Tutuban are NEVER dismissed this way — their card always re-offers.
   */
  function dismissCard() {
    const tile = activeCard.value
    if (tile && tile.type !== 'zombie' && tile.type !== 'shelter' && tile.type !== 'landmark') {
      tile.resolved = true
    }
    activeCard.value = null
  }

  /** Called when an encounter is actually concluded (victory). */
  function resolveEncounter(tile: Tile | null = activeCard.value) {
    if (tile) tile.resolved = true
    if (activeCard.value === tile) activeCard.value = null
  }

  /**
   * A new home. The claimed waypoint flips to safe cleared ground under the player's
   * feet, the old shelter becomes ordinary ground, and the stash is already global so
   * it transfers for free.
   */
  function claimShelter(waypoint: Waypoint) {
    waypoint.claimed = true
    shelterName.value = waypoint.name
    shelterFlavor.value = waypoint.flavor
    shelterPos.value = { ...waypoint.pos }
    const tile = getTile(waypoint.pos)
    if (tile) {
      tile.type = 'shelter'
      tile.cleared = true
      tile.resolved = true
    }
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
    syncFogAroundPlayer()
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
   * Dev aid alongside ?fight=N: ?tp=N drops Juan straight onto a numbered stop — 1–5
   * are the shelters in route order, 6+ is Tutuban. Landing on an unclaimed stop opens
   * its card, so shelter claiming and the win are verifiable without literally walking
   * 75 tiles.
   */
  function devTeleportToStop(stop: number) {
    const stops = waypoints.value
    const target = stops[Math.min(stop, stops.length) - 1]
    if (!target) return
    playerPos.q = target.pos.q
    playerPos.r = target.pos.r
    syncFogAroundPlayer()
    const tile = getTile(target.pos)
    if (tile && !tile.resolved && tile.type !== 'nothing') activeCard.value = tile
  }

  /** Fresh run: world, route, and cycle all rebuilt. The death screen calls this. */
  function startRun() {
    tiles.clear()
    playerPos.q = ORIGIN.q
    playerPos.r = ORIGIN.r
    moveBudget.value = MOVES_PER_PHASE
    phase.value = 'day'
    dayCount.value = 1
    activeCard.value = null
    shelterName.value = STARTING_SHELTER.name
    shelterFlavor.value = STARTING_SHELTER.flavor
    shelterPos.value = { ...ORIGIN }
    buildRoute()
    syncFogAroundPlayer()
  }

  startRun()

  // --- Save persistence -----------------------------------------------------------------
  // The save is the whole world in miniature: position, fog-grown tiles, the seeded route,
  // and the cycle. Maps don't JSON — tiles travel as {key, ...tile} pairs and the Map is
  // rebuilt on the way back in. activeCard is never saved; a save only happens at rest,
  // so the card is re-derived from what Juan is standing on.
  function snapshot() {
    return {
      playerPos: { ...playerPos },
      tiles: [...tiles.entries()].map(([key, tile]) => ({ key, ...tile })),
      moveBudget: moveBudget.value,
      phase: phase.value,
      dayCount: dayCount.value,
      waypoints: waypoints.value.map((w) => ({ ...w, pos: { ...w.pos } })),
      shelterName: shelterName.value,
      shelterFlavor: shelterFlavor.value,
      shelterPos: { ...shelterPos.value },
    }
  }

  function hydrate(state: ReturnType<typeof snapshot>) {
    playerPos.q = state.playerPos.q
    playerPos.r = state.playerPos.r
    tiles.clear()
    for (const { key, ...tile } of state.tiles) tiles.set(key, { ...tile })
    moveBudget.value = state.moveBudget
    phase.value = state.phase
    dayCount.value = state.dayCount
    waypoints.value = state.waypoints.map((w) => ({ ...w, pos: { ...w.pos } }))
    shelterName.value = state.shelterName
    shelterFlavor.value = state.shelterFlavor
    shelterPos.value = { ...state.shelterPos }
    activeCard.value = null
    // Standing on something unresolved when the run was saved? Its card comes back up.
    const here = tiles.get(hexKey(playerPos.q, playerPos.r))
    if (here && here.type !== 'nothing' && !here.resolved) activeCard.value = here
    syncFogAroundPlayer()
  }

  return {
    playerPos,
    tiles,
    moveBudget,
    maxMoves: MOVES_PER_PHASE,
    energyPerFreshMove: ENERGY_PER_FRESH_MOVE,
    phase,
    dayCount,
    activeCard,
    waypoints,
    shelterName,
    shelterFlavor,
    shelterPos,
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
    moveTo,
    dismissCard,
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
