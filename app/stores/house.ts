import { defineStore } from 'pinia'
import type { Tile } from './board'

/** What Juan already did in one house, so stepping out and back in finds the cupboards as he left them. */
export interface HouseState {
  /** Containers he has searched (by their index in the house), and what is still inside each. */
  opened: Record<number, string[]>
  /** Shamblers put down (by their index in the house). */
  killed: number[]
  key?: boolean
  bedOpen?: boolean
  used?: number
  /** Containers in the house, what is left in the opened ones by kind, Shamblers still up, which layout. */
  total?: number
  left?: { food: number; med: number; tool: number; weapon: number }
  alive?: number
  tpl?: 'flat' | 'stock'
}

export const useHouseStore = defineStore('house', () => {
  /** The street tile whose door Juan went through. Set = he is inside (HouseScreen is up). */
  const tile = shallowRef<Tile | null>(null)
  const open = computed(() => !!tile.value)
  /** Per house, for this run only. */
  const saved = reactive<Record<string, HouseState>>({})

  const keyOf = (t: Tile) => `${t.q},${t.r}`

  function enter(t: Tile) {
    tile.value = t
  }

  function close() {
    tile.value = null
  }

  /** A new run (or a death restart): every house is as it was. */
  function reset() {
    tile.value = null
    for (const k of Object.keys(saved)) delete saved[k]
  }

  function snapshot(): Record<string, HouseState> {
    return JSON.parse(JSON.stringify(saved))
  }

  function hydrate(state: Record<string, HouseState>) {
    reset()
    Object.assign(saved, JSON.parse(JSON.stringify(state ?? {})))
  }

  return { tile, open, saved, keyOf, enter, close, reset, snapshot, hydrate }
})
