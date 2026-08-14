import { defineStore } from 'pinia'
import { axialNeighbors, hexKey, type AxialCoord } from '~/utils/hex'

export type TileType = 'nothing' | 'location' | 'zombie' | 'event'

export interface Tile {
  q: number
  r: number
  type: TileType
  cleared: boolean
}

const SHELTER_POS: AxialCoord = { q: 0, r: 0 }
const ICON_RING_RADIUS = 2
const FOG_RING_RADIUS = 6
const MAX_MOVE_BUDGET = 5

export interface Landmark {
  name: string
  pos: AxialCoord
}

// Fixed world landmarks, visible as a faint directional hint even from far outside fog range.
const LANDMARKS: Landmark[] = [{ name: 'Tutuban', pos: { q: 53, r: 0 } }]

const TYPE_WEIGHTS: [TileType, number][] = [
  ['nothing', 0.45],
  ['location', 0.2],
  ['zombie', 0.2],
  ['event', 0.15],
]

function rollTileType(): TileType {
  const roll = Math.random()
  let cumulative = 0
  for (const [type, weight] of TYPE_WEIGHTS) {
    cumulative += weight
    if (roll < cumulative) return type
  }
  return 'nothing'
}

export const useBoardStore = defineStore('board', () => {
  const playerPos = reactive<AxialCoord>({ ...SHELTER_POS })
  const tiles = reactive(new Map<string, Tile>())
  const moveBudget = ref(MAX_MOVE_BUDGET)
  const cycleCount = ref(1)
  const activeCard = ref<Tile | null>(null)

  function getTile(coord: AxialCoord): Tile | undefined {
    return tiles.get(hexKey(coord.q, coord.r))
  }

  function ensureTile(coord: AxialCoord): Tile {
    const key = hexKey(coord.q, coord.r)
    let tile = tiles.get(key)
    if (!tile) {
      const isShelter = coord.q === SHELTER_POS.q && coord.r === SHELTER_POS.r
      tile = { q: coord.q, r: coord.r, type: isShelter ? 'nothing' : rollTileType(), cleared: isShelter }
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

    moveBudget.value -= cost
    playerPos.q = coord.q
    playerPos.r = coord.r

    const firstVisit = !tile.cleared
    tile.cleared = true
    syncFogAroundPlayer()

    if (firstVisit && tile.type !== 'nothing') {
      activeCard.value = tile
    }
    return true
  }

  function dismissCard() {
    activeCard.value = null
  }

  // MVP shortcut: shelter return is always free and instant, per design ("never
  // design a state where the player can get stranded"). No path-walk simulation yet.
  // Ends the current day/night cycle: budget resets, cycle count advances.
  function retreatToShelter() {
    playerPos.q = SHELTER_POS.q
    playerPos.r = SHELTER_POS.r
    syncFogAroundPlayer()
    moveBudget.value = MAX_MOVE_BUDGET
    cycleCount.value++
  }

  syncFogAroundPlayer()

  return {
    playerPos,
    tiles,
    moveBudget,
    cycleCount,
    activeCard,
    shelterPos: SHELTER_POS,
    iconRingRadius: ICON_RING_RADIUS,
    fogRingRadius: FOG_RING_RADIUS,
    landmarks: LANDMARKS,
    getTile,
    moveTo,
    dismissCard,
    retreatToShelter,
  }
})
