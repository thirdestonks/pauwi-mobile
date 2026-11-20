import { defineStore } from 'pinia'
import { itemInfo } from '~/data/equipment'
import {
  REQUEST_MULT, REQUEST_POOL, STOCK_POOL, STOCK_SIZE, SUKI_RANKS, UNDER_TABLE, buyPrice, rankAt, sellPrice, tradeValue,
} from '~/data/trade'
import { hash } from '~/utils/tondo'
import { useBoardStore } from './board'
import { useInventoryStore } from './inventory'

// Aling Cora, the suki trader. Barter on a tab: what Juan hands over goes onto his credit with her, what he takes comes off it,
// and the credit keeps between visits. Points traded either way build his standing with her (data/trade.ts SUKI_RANKS): better
// rates, then stock she keeps under the table, then tips about caches. Her table (5 things) and the one thing she is looking for
// are fixed for the day, so leaving and coming back finds the same stall, minus what he bought.

/** A seeded pick, so a day's stall comes out the same every time it is asked for. */
function pickSeeded(pool: [string, number][], k: number, seed: number, avoid: string[]): string[] {
  const out: string[] = []
  for (let i = 0; out.length < k && i < 40; i++) {
    const left = pool.filter(([id]) => !out.includes(id) && !avoid.includes(id))
    if (!left.length) break
    const total = left.reduce((s, [, w]) => s + w, 0)
    let roll = hash(seed, i, 71) * total
    for (const [id, w] of left) { roll -= w; if (roll < 0) { out.push(id); break } }
  }
  return out
}

export const useTraderStore = defineStore('trader', () => {
  /** Points traded with her, both ways: her standing (rank) comes from this. */
  const points = ref(0)
  /** Juan's credit on her tab. */
  const credit = ref(0)
  /** What has gone from today's table, and whether today's request was filled. Reset when the day changes. */
  const today = ref<{ day: number; bought: string[]; requestDone: boolean; tipped: boolean }>({ day: 0, bought: [], requestDone: false, tipped: false })

  const board = useBoardStore()
  const day = computed(() => board.dayCount)
  /** The day's ledger: a new day wipes it. */
  function fresh() {
    if (today.value.day !== day.value) today.value = { day: day.value, bought: [], requestDone: false, tipped: false }
    return today.value
  }

  const rank = computed(() => rankAt(points.value))
  const rankIndex = computed(() => SUKI_RANKS.indexOf(rank.value))
  const nextRank = computed(() => SUKI_RANKS[rankIndex.value + 1] ?? null)

  /** Her table today: everyday stock, plus one piece from under the table once Juan is her suki. */
  const table = computed(() => {
    const seed = day.value * 131 + board.home.length * 7
    const ids = pickSeeded(STOCK_POOL, STOCK_SIZE, seed, [])
    if (rankIndex.value >= 2) ids.push(...pickSeeded(UNDER_TABLE, 1, seed + 1, ids))
    const gone = today.value.day === day.value ? today.value.bought : []
    return ids.filter((id) => !gone.includes(id)).map((id) => ({
      id, name: itemInfo(id)?.name ?? id, icon: itemInfo(id)?.icon ?? '❔', sprite: itemInfo(id)?.sprite,
      price: sellPrice(id, rank.value), special: UNDER_TABLE.some(([u]) => u === id),
    }))
  })
  /** The one thing she is looking for today: it fetches double. */
  const request = computed(() => REQUEST_POOL[Math.floor(hash(day.value, 5, 72) * REQUEST_POOL.length)]!)
  const requestOpen = computed(() => !(today.value.day === day.value && today.value.requestDone))

  /** What one of `id` from Juan's bag fetches right now. */
  function offerFor(id: string): number {
    return id === request.value && requestOpen.value ? tradeValue(id) * REQUEST_MULT : buyPrice(id, rank.value)
  }

  /** A rank reached with the trade just made: her line about it, or null. */
  function rankUp(before: number): string | null {
    return rankIndex.value > before ? `${rank.value.name.toUpperCase()}. ${rank.value.line}` : null
  }

  /** Juan hands over what is in one bag slot (one of it). Returns what it fetched and any rank-up line, or null if the slot is empty. */
  function sell(slot: number): { id: string; got: number; rank: string | null; request: boolean } | null {
    const inventory = useInventoryStore()
    const id = inventory.bag[slot]?.id
    if (!id) return null
    const got = offerFor(id)
    const wasRequest = id === request.value && requestOpen.value
    const before = rankIndex.value
    inventory.dropFromBag(slot)
    credit.value += got
    points.value += got
    if (wasRequest) fresh().requestDone = true
    return { id, got, rank: rankUp(before), request: wasRequest }
  }

  /** Juan takes something off her table. Fails without the credit or the room in the bag. */
  function buy(id: string): { ok: true; rank: string | null } | { ok: false; why: 'credit' | 'room' | 'gone' } {
    const item = table.value.find((t) => t.id === id)
    if (!item) return { ok: false, why: 'gone' }
    if (credit.value < item.price) return { ok: false, why: 'credit' }
    const inventory = useInventoryStore()
    if (!inventory.addToBag(id)) return { ok: false, why: 'room' }
    const before = rankIndex.value
    credit.value -= item.price
    points.value += item.price
    fresh().bought.push(id)
    return { ok: true, rank: rankUp(before) }
  }

  /** Family rank: once a day she leans in and names a street (a radio-style cache). Returns the street, or null. */
  function tip(): string | null {
    if (rankIndex.value < SUKI_RANKS.length - 1 || fresh().tipped) return null
    const c = board.addCache()
    if (!c) return null
    fresh().tipped = true
    return c.street
  }
  const canTip = computed(() => rankIndex.value >= SUKI_RANKS.length - 1 && !(today.value.day === day.value && today.value.tipped))

  function resetRun() {
    points.value = 0
    credit.value = 0
    today.value = { day: 0, bought: [], requestDone: false, tipped: false }
  }

  function snapshot() {
    return { points: points.value, credit: credit.value, today: { ...today.value, bought: [...today.value.bought] } }
  }
  function hydrate(state: Partial<ReturnType<typeof snapshot>> | undefined) {
    points.value = state?.points ?? 0
    credit.value = state?.credit ?? 0
    today.value = state?.today ? { ...state.today, bought: [...state.today.bought] } : { day: 0, bought: [], requestDone: false, tipped: false }
  }

  return {
    points, credit, today, rank, rankIndex, nextRank, table, request, requestOpen, canTip,
    offerFor, sell, buy, tip, resetRun, snapshot, hydrate,
  }
})
