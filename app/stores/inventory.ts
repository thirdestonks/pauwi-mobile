import { defineStore } from 'pinia'
import { itemInfo } from '~/data/equipment'
import { usePlayerStore } from './player'
import type { EquipSlot } from '~/data/equipment'

export interface StashItem {
  id: string
  icon: string
  name: string
  qty: number
}

const BAG_SLOTS = 5

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
  const bag = ref<(string | null)[]>(Array(BAG_SLOTS).fill(null))

  const bagCount = computed(() => bag.value.filter((id) => id !== null).length)
  const canHeadOut = computed(() => bagCount.value > 0)

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

  function packItem(id: string) {
    const item = findStashItem(id)
    if (!item || item.qty <= 0) return false
    const emptySlot = bag.value.indexOf(null)
    if (emptySlot === -1) return false

    item.qty -= 1
    bag.value[emptySlot] = id
    return true
  }

  function unpackSlot(slotIndex: number) {
    const id = bag.value[slotIndex]
    if (!id) return
    const item = findStashItem(id)
    if (item) item.qty += 1
    else addStashItem(id)
    bag.value[slotIndex] = null
  }

  /**
   * Spent in the field — a used item is gone, not returned to the stash. This is what
   * combat's Use Item should have been calling all along.
   */
  function consumeBagSlot(slotIndex: number): string | null {
    const id = bag.value[slotIndex]
    if (!id) return null
    bag.value[slotIndex] = null
    return id
  }

  /** Loot found out there goes straight into a free bag slot; no stash round-trip. */
  function addToBag(id: string): boolean {
    const emptySlot = bag.value.indexOf(null)
    if (emptySlot === -1) return false
    bag.value[emptySlot] = id
    return true
  }

  /** Spent at the shelter (Eat sheet) — one unit leaves the stash rows. */
  function consumeStashItem(id: string): boolean {
    const item = findStashItem(id)
    if (!item || item.qty <= 0) return false
    item.qty -= 1
    return true
  }

  // --- Dilemma events --------------------------------------------------------------------

  function hasInBag(id: string): boolean {
    return bag.value.includes(id)
  }

  /** Events spend from any slot carrying the item, not a fixed one. */
  function removeFromBag(id: string): boolean {
    const slot = bag.value.indexOf(id)
    if (slot === -1) return false
    bag.value[slot] = null
    return true
  }

  // --- Equipping -------------------------------------------------------------------------
  // The bag stores gear the same as consumables — an id in a slot. Equipping moves the
  // piece into the player's slots; whatever it displaced comes back to the bag.

  /** Equips `id` from the bag. Returns false when the piece isn't in the bag. */
  function equipItem(id: string): boolean {
    const player = usePlayerStore()
    const slot = bag.value.indexOf(id)
    if (slot === -1) return false

    const wornBefore = new Set(player.equippedItems.map((entry) => entry.id))
    bag.value[slot] = null
    player.equip(id)

    // Anything that came off goes back in the bag — the slot we just freed normally
    // covers it. Overflow (two 1H pieces displaced by one 2H, someday) lands in the stash.
    for (const entry of player.equippedItems) wornBefore.delete(entry.id)
    wornBefore.delete(id)
    for (const displaced of wornBefore) {
      if (!addToBag(displaced)) addStashItem(displaced)
    }
    return true
  }

  /** Takes the piece in `slot` off Juan and back into the bag (stash on overflow). */
  function unequipSlot(slot: EquipSlot): boolean {
    const player = usePlayerStore()
    const id = player.unequip(slot)
    if (!id) return false
    if (!addToBag(id)) addStashItem(id)
    return true
  }

  function resetRun() {
    stash.splice(0, stash.length, ...STARTING_STASH.map((item) => ({ ...item })))
    bag.value = Array(BAG_SLOTS).fill(null)
  }

  // --- Save persistence -----------------------------------------------------------------
  // The stash is a whole home's pantry; the bag is what Juan is carrying right now.
  // Both are plain data — clone and go.
  function snapshot() {
    return {
      stash: stash.map((item) => ({ ...item })),
      bag: [...bag.value],
    }
  }

  function hydrate(state: ReturnType<typeof snapshot>) {
    stash.splice(0, stash.length, ...state.stash.map((item) => ({ ...item })))
    bag.value = state.bag.map((slot) => slot)
  }

  return {
    stash,
    bag,
    bagCount,
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
    snapshot,
    hydrate,
  }
})
