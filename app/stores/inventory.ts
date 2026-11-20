import { defineStore } from 'pinia'
import { EQUIPMENT, itemInfo } from '~/data/equipment'
import { CONSUMABLE_EFFECTS } from '~/data/combat'
import { MAX_KG, kgOf, loadOf } from '~/data/weight'
import { usePlayerStore } from './player'
import type { EquipSlot } from '~/data/equipment'

export interface StashItem {
  id: string
  icon: string
  name: string
  qty: number
}

/** The field bag: ten slots. */
export const BAG_SLOTS = 10
/** One bag slot: an item and how many of it share the slot. */
export interface BagSlot { id: string; qty: number }
/** Repeated items share a slot, two to a slot (two Cup Noodles take one slot, three take two); weapons and armor never stack. */
export const stackMax = (id: string) => (EQUIPMENT[id] ? 1 : 2)
const emptyBag = (): (BagSlot | null)[] => Array(BAG_SLOTS).fill(null)

const STARTING_STASH: StashItem[] = [
  { id: 'canned-food', icon: '🥫', name: 'Canned Food', qty: 3 },
  { id: 'water', icon: '🧴', name: 'Water', qty: 2 },
  { id: 'instant-noodles', icon: '🍜', name: 'Instant Noodles', qty: 4 },
  { id: 'medicine', icon: '💊', name: 'Medicine', qty: 1 },
  { id: 'battery', icon: '🔋', name: 'Battery', qty: 2 },
]

export const useInventoryStore = defineStore('inventory', () => {
  const stash = reactive<StashItem[]>(STARTING_STASH.map((item) => ({ ...item })))

  // What's actually with Juan out in the field — the only inventory accessible during
  // exploration/combat. Everything left in the stash stays behind at the shelter.
  const bag = ref<(BagSlot | null)[]>(emptyBag())

  /** Slots in use (out of BAG_SLOTS). */
  const bagCount = computed(() => bag.value.filter((slot) => slot !== null).length)
  /** Every single thing in the bag, one entry per item, for the places that don't care about slots. */
  const units = computed(() => bag.value.flatMap((slot) => (slot ? Array<string>(slot.qty).fill(slot.id) : [])))
  const canHeadOut = computed(() => bagCount.value > 0)

  /** How many more of `id` the bag can take right now (counting a half-full stack and every empty slot). */
  function room(id: string): number {
    const max = stackMax(id)
    let n = 0
    for (const slot of bag.value) {
      if (!slot) n += max
      else if (slot.id === id) n += max - slot.qty
    }
    return n
  }
  /** Everything on Juan's body: the bag, plus what he wears and holds (data/weight.ts). */
  const carriedKg = computed(() => {
    const player = usePlayerStore()
    const kg = bag.value.reduce((s, slot) => s + (slot ? kgOf(slot.id) * slot.qty : 0), 0)
      + Object.values(player.equipped).filter((id, i, all): id is string => !!id && all.indexOf(id) === i).reduce((s, id) => s + kgOf(id), 0)
    return Math.round(kg * 10) / 10
  })
  /** What that weight does to him (Light, Carrying, Loaded, Overloaded). */
  const load = computed(() => loadOf(carriedKg.value))
  /** Why the last addToBag said no: no slot for it, or too heavy to carry on top of everything else. */
  const lastRefusal = ref<'room' | 'weight' | null>(null)
  const tooHeavy = (id: string, qty = 1) => carriedKg.value + kgOf(id) * qty > MAX_KG + 1e-9
  const canFit = (id: string, qty = 1) => room(id) >= qty && !tooHeavy(id, qty)
  const countInBag = (id: string) => bag.value.reduce((n, slot) => n + (slot?.id === id ? slot.qty : 0), 0)

  function findStashItem(id: string) {
    return stash.find((item) => item.id === id)
  }

  /**
   * Puts an item straight into the stash rows (equipment isn't a StashItem by default —
   * this is the fallback when a displaced piece can't fit back in the bag).
   */
  function addStashItem(id: string, qty = 1) {
    const info = itemInfo(id)
    const existing = findStashItem(id)
    if (existing) {
      existing.qty += qty
      return
    }
    stash.push({ id, icon: info?.icon ?? '❔', name: info?.name ?? id, qty })
  }

  /** One unit of whatever is in the slot leaves it (the slot empties with its last unit). */
  function takeUnit(slotIndex: number): string | null {
    const slot = bag.value[slotIndex]
    if (!slot) return null
    slot.qty -= 1
    const id = slot.id
    if (slot.qty <= 0) bag.value[slotIndex] = null
    return id
  }

  function packItem(id: string) {
    const item = findStashItem(id)
    if (!item || item.qty <= 0) return false
    if (!addToBag(id)) return false              // lastRefusal says why: no slot, or too heavy
    item.qty -= 1
    return true
  }

  function unpackSlot(slotIndex: number) {
    const id = takeUnit(slotIndex)
    if (!id) return
    const item = findStashItem(id)
    if (item) item.qty += 1
    else addStashItem(id)
  }

  /**
   * Spent in the field: a used item is gone, not returned to the stash. This is what
   * combat's Use Item should have been calling all along.
   */
  function consumeBagSlot(slotIndex: number): string | null {
    return takeUnit(slotIndex)
  }

  /** Throws one unit away (loot management: make room for something better). Returns what was dropped. */
  function dropFromBag(slotIndex: number): string | null {
    return takeUnit(slotIndex)
  }

  /**
   * Loot found out there goes straight into the bag; no stash round-trip. A repeat joins its stack if there is room in it
   * (two to a stack), otherwise it takes a free slot. All of `qty` goes in or none of it does.
   */
  function addToBag(id: string, qty = 1, offHisBody = false): boolean {
    // something coming off his body (unequipped, swapped out) weighs the same in the bag: only the slots matter then
    if (room(id) < qty) { lastRefusal.value = 'room'; return false }
    if (!offHisBody && tooHeavy(id, qty)) { lastRefusal.value = 'weight'; return false }
    lastRefusal.value = null
    const max = stackMax(id)
    for (let i = 0; i < qty; i++) {
      const stack = bag.value.find((slot) => slot && slot.id === id && slot.qty < max)
      if (stack) stack.qty += 1
      else bag.value[bag.value.indexOf(null)] = { id, qty: 1 }
    }
    return true
  }

  /** Spent at the shelter (Eat sheet) — one unit leaves the stash rows. */
  function consumeStashItem(id: string): boolean {
    const item = findStashItem(id)
    if (!item || item.qty <= 0) return false
    item.qty -= 1
    return true
  }

  /**
   * One tap tidies the bag: half stacks merge (1 + 1 noodles become one slot of 2) and everything is grouped
   * food, medicine, ammo, weapons and armor, then everything else. Never needs more slots than it had.
   */
  function sortBag() {
    const rank = (id: string) => {
      const fx = CONSUMABLE_EFFECTS[id]
      if (EQUIPMENT[id]) return 3
      if (id === 'ammo' || id === 'rounds') return 2
      if (fx && (fx.food || fx.energy)) return 0
      if (fx && fx.heal) return 1
      return 4
    }
    const counts = new Map<string, number>()
    for (const slot of bag.value) if (slot) counts.set(slot.id, (counts.get(slot.id) ?? 0) + slot.qty)
    const ids = [...counts.keys()].sort((a, b) => rank(a) - rank(b) || (itemInfo(a)?.name ?? a).localeCompare(itemInfo(b)?.name ?? b))
    const slots: (BagSlot | null)[] = []
    for (const id of ids) {
      let n = counts.get(id)!
      while (n > 0) { const q = Math.min(stackMax(id), n); slots.push({ id, qty: q }); n -= q }
    }
    while (slots.length < BAG_SLOTS) slots.push(null)
    bag.value = slots.slice(0, BAG_SLOTS)
  }

  // --- Crafting (data/crafting.ts): ingredients come from the stash first, then the bag; what is made goes to the stash ---
  /** How many of `id` Juan has at the shelter, stash and bag together. */
  const haveAnywhere = (id: string) => (findStashItem(id)?.qty ?? 0) + countInBag(id)
  /** Uses one of `id`, from the stash if there is one, else from the bag. */
  function spendAnywhere(id: string): boolean {
    const item = findStashItem(id)
    if (item && item.qty > 0) { item.qty -= 1; return true }
    return removeFromBag(id)
  }

  // --- Dilemma events --------------------------------------------------------------------

  function hasInBag(id: string): boolean {
    return bag.value.some((slot) => slot?.id === id)
  }

  /** Spends one unit from any slot carrying the item (the emptiest stack first, so stacks stay tidy). */
  function removeFromBag(id: string): boolean {
    let best = -1
    bag.value.forEach((slot, i) => { if (slot?.id === id && (best === -1 || slot.qty < bag.value[best]!.qty)) best = i })
    if (best === -1) return false
    takeUnit(best)
    return true
  }

  // --- Equipping -------------------------------------------------------------------------
  // The bag stores gear the same as consumables — an id in a slot. Equipping moves the
  // piece into the player's slots; whatever it displaced comes back to the bag.

  /** Equips `id` from the bag. Returns false when the piece isn't in the bag. */
  function equipItem(id: string): boolean {
    const player = usePlayerStore()
    const slot = bag.value.findIndex((entry) => entry?.id === id)
    if (slot === -1) return false

    const wornBefore = new Set(player.equippedItems.map((entry) => entry.id))
    takeUnit(slot)
    player.equip(id)

    // Anything that came off goes back in the bag — the slot we just freed normally
    // covers it. Overflow (two 1H pieces displaced by one 2H, someday) lands in the stash.
    for (const entry of player.equippedItems) wornBefore.delete(entry.id)
    wornBefore.delete(id)
    for (const displaced of wornBefore) {
      if (!addToBag(displaced, 1, true)) addStashItem(displaced)
    }
    return true
  }

  /** Takes the piece in `slot` off Juan and back into the bag (stash on overflow). */
  function unequipSlot(slot: EquipSlot): boolean {
    const player = usePlayerStore()
    const id = player.unequip(slot)
    if (!id) return false
    if (!addToBag(id, 1, true)) addStashItem(id)
    return true
  }

  function resetRun() {
    stash.splice(0, stash.length, ...STARTING_STASH.map((item) => ({ ...item })))
    bag.value = emptyBag()
  }

  // --- Save persistence -----------------------------------------------------------------
  // The stash is a whole home's pantry; the bag is what Juan is carrying right now.
  // Both are plain data — clone and go.
  // --- Pack like last time ---------------------------------------------------------------
  /** What the bag held when Juan last walked out the door. */
  const lastPack = ref<string[]>([])
  function rememberPack() {
    lastPack.value = [...units.value]
  }
  /** Packs last outing's things again, as far as the stash still has them. Returns how many went in. */
  function packLikeLast(): number {
    let n = 0
    const want = [...lastPack.value]
    for (const id of units.value) { const i = want.indexOf(id); if (i >= 0) want.splice(i, 1) }   // already packed
    for (const id of want) if (packItem(id)) n++
    return n
  }

  function snapshot() {
    return {
      stash: stash.map((item) => ({ ...item })),
      bag: bag.value.map((slot) => (slot ? { ...slot } : null)),
      lastPack: [...lastPack.value],
    }
  }

  /** A saved bag: slots of { id, qty }, or (saves from the 5-slot bag) one bare id per slot. */
  function loadBag(raw: unknown): (BagSlot | null)[] {
    const slots: (BagSlot | null)[] = []
    for (const entry of Array.isArray(raw) ? raw : []) {
      if (typeof entry === 'string') slots.push({ id: entry, qty: 1 })
      else if (entry && typeof entry === 'object' && typeof (entry as BagSlot).id === 'string') {
        const { id, qty } = entry as BagSlot
        slots.push({ id, qty: Math.max(1, Math.min(stackMax(id), Math.floor(qty) || 1)) })
      }
    }
    while (slots.length < BAG_SLOTS) slots.push(null)
    return slots.slice(0, BAG_SLOTS)
  }

  function hydrate(state: ReturnType<typeof snapshot>) {
    stash.splice(0, stash.length, ...state.stash.map((item) => ({ ...item })))
    bag.value = loadBag(state.bag)
    lastPack.value = [...(state.lastPack ?? [])]
  }

  return {
    stash,
    bag,
    bagCount,
    units,
    room,
    canFit,
    carriedKg,
    load,
    lastRefusal,
    countInBag,
    dropFromBag,
    sortBag,
    haveAnywhere,
    spendAnywhere,
    canHeadOut,
    findStashItem,
    addStashItem,
    packItem,
    unpackSlot,
    consumeBagSlot,
    addToBag,
    consumeStashItem,
    hasInBag,
    removeFromBag,
    equipItem,
    unequipSlot,
    resetRun,
    lastPack,
    rememberPack,
    packLikeLast,
    snapshot,
    hydrate,
  }
})
