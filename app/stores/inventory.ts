import { defineStore } from 'pinia'

export interface StashItem {
  id: string
  icon: string
  name: string
  qty: number
}

const BAG_SLOTS = 5

export const useInventoryStore = defineStore('inventory', () => {
  const stash = reactive<StashItem[]>([
    { id: 'canned-food', icon: '🥫', name: 'Canned Food', qty: 3 },
    { id: 'water', icon: '🧴', name: 'Water', qty: 2 },
    { id: 'instant-noodles', icon: '🍜', name: 'Instant Noodles', qty: 4 },
    { id: 'medicine', icon: '💊', name: 'Medicine', qty: 1 },
    { id: 'battery', icon: '🔋', name: 'Battery', qty: 2 },
  ])

  // What's actually with Juan out in the field — the only inventory accessible during
  // exploration/combat. Everything left in the stash stays behind at the shelter.
  const bag = ref<(string | null)[]>(Array(BAG_SLOTS).fill(null))

  const bagCount = computed(() => bag.value.filter((id) => id !== null).length)
  const canHeadOut = computed(() => bagCount.value > 0)

  function findStashItem(id: string) {
    return stash.find((item) => item.id === id)
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
    bag.value[slotIndex] = null
  }

  return { stash, bag, bagCount, canHeadOut, packItem, unpackSlot }
})
