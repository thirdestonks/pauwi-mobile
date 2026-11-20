<script setup lang="ts">
// Packing the bag before an outing, in the pixel-art bag look (shared with FieldBagScreen,
// classes in main.css): Juan with the weapon in hand, the bag's slots, and the shelter's
// stash below. Tap a stash item to pack it, a bag slot to put it back.
import { CONSUMABLE_EFFECTS, PIXEL_COMBAT } from '~/data/combat'
import { MAX_KG, kgOf } from '~/data/weight'
import { EQUIPMENT, itemInfo } from '~/data/equipment'
import { tradeValue } from '~/data/trade'
import { SHELTER_DOOR } from '~/utils/tondo'

const ui = useUiStore()
const inventory = useInventoryStore()
const player = usePlayerStore()
const board = useBoardStore()
const sfx = useSfx()

/** Ammo into the 9mm: loose rounds, then packs and boxes from the bag, up to 18. */
function loadPistol() {
  const n = player.loadPistol()
  if (!n) return
  sfx.play('9mm-reload')
}
const { passDoor } = useEncounterScene()

/** Out through the shelter's door, which shuts behind him, onto the street. */
function confirmHeadOut() {
  if (!inventory.canHeadOut) return
  passDoor(SHELTER_DOOR[board.home], true, () => {
    ui.headOut()
    ui.setTab('map')
  })
}

const weaponLine = computed(() => {
  const w = player.weapon
  if (w.combat.gun) return `${w.name} · ${player.loadedOf(w.id)}/${PIXEL_COMBAT.guns[w.id]?.mag ?? 6}`
  return player.unbreakable ? w.name : `${w.name} · ${player.weaponDurability}`
})

/** What the last tapped thing is, in a line. */
const touched = ref<string | null>(null)
function describe(id: string) {
  const info = itemInfo(id)
  const spec = EQUIPMENT[id]
  const what = spec?.combat ? `${spec.combat.dmg} a hit · wear it from Gear`
    : spec?.armor ? `${spec.armor} armor · wear it from Gear`
      : (CONSUMABLE_EFFECTS[id]?.label ?? `worth ${tradeValue(id)} to the trader`)
  return `${info?.name ?? id}. ${what}.`
}
const detail = computed(() => touched.value ?? `${inventory.bagCount} / ${inventory.bag.length} slots used. Repeats stack two to a slot. Tap the stash to pack, the bag to put back.`)

function unpack(slot: number) {
  const id = inventory.bag[slot]?.id
  if (!id) return
  inventory.unpackSlot(slot)
  sfx.play('put-item', 0.8)
  touched.value = `Back in the stash: ${describe(id)}`
}

function pack(id: string) {
  if (!inventory.packItem(id)) {
    touched.value = inventory.lastRefusal === 'weight'
      ? `Too heavy: that would put him over ${MAX_KG} kg. Put something back first.`
      : 'The bag is full. Put something back first.'
    return
  }
  sfx.play('item-pickup', 0.8)
  touched.value = `Packed: ${describe(id)}`
}

function packLast() {
  const n = inventory.packLikeLast()
  if (n) sfx.play('item-pickup', 0.8)
  touched.value = n ? `Packed ${n} thing${n === 1 ? '' : 's'} like last time.` : 'Nothing from last time left in the stash.'
}

const gearInBag = computed(() => inventory.bag.filter((entry) => entry && EQUIPMENT[entry.id]).length)
</script>

<template>
  <div class="px-screen flex-1 flex flex-col overflow-y-auto">
    <div class="px-title">PACK YOUR BAG</div>

    <div class="juan px-panel">
      <img src="/game/encounters/src/juan-full.png" alt="Juan" class="juan-img">
      <div class="slot">
        <img v-if="player.weapon.sprite" :src="player.weapon.sprite" alt="" class="px-img">
        <span>{{ weaponLine }}</span>
      </div>
    </div>

    <WeightBar />
    <div class="px-label">THE BAG <small>{{ inventory.bagCount }} / {{ inventory.bag.length }} · tap to put back</small></div>
    <div class="px-grid">
      <button
        v-for="(slot, i) in inventory.bag"
        :key="i"
        class="px-cell"
        :aria-label="slot ? `Put back ${itemInfo(slot.id)?.name ?? slot.id}` : 'Empty slot'"
        :disabled="!slot"
        @click="unpack(i)"
      >
        <img v-if="slot && itemInfo(slot.id)?.sprite" :src="itemInfo(slot.id)!.sprite" alt="">
        <span v-else-if="slot" class="emoji">{{ itemInfo(slot.id)?.icon ?? '❔' }}</span>
        <span v-if="slot && slot.qty > 1" class="qty">×{{ slot.qty }}</span>
        <span v-if="slot" class="kg">{{ +(kgOf(slot.id) * slot.qty).toFixed(2) }}</span>
      </button>
    </div>

    <div class="px-label">THE STASH <small>tap to pack</small></div>
    <button v-if="inventory.lastPack.length" class="px-btn again" @click="packLast">PACK LIKE LAST TIME <small>{{ inventory.lastPack.length }} thing{{ inventory.lastPack.length === 1 ? '' : 's' }}</small></button>
    <div class="px-grid">
      <button
        v-for="item in inventory.stash"
        :key="item.id"
        class="px-cell"
        :aria-label="`Pack ${item.name}`"
        :disabled="item.qty <= 0"
        @click="pack(item.id)"
      >
        <img v-if="itemInfo(item.id)?.sprite" :src="itemInfo(item.id)!.sprite" alt="">
        <span v-else class="emoji">{{ item.icon }}</span>
        <span class="qty">×{{ item.qty }}</span>
      </button>
    </div>

    <p class="px-detail">{{ detail }}</p>
    <button v-if="player.canLoadPistol" class="px-btn load" @click="loadPistol">LOAD THE 9MM <small>{{ player.rounds }}/{{ PIXEL_COMBAT.guns.pistol?.mag }}{{ player.spareRounds ? ` · ${player.spareRounds} loose` : '' }}</small></button>
    <button v-if="gearInBag" class="px-btn gear" @click="ui.setTab('gear')">EQUIP GEAR → <small>{{ gearInBag }} piece{{ gearInBag === 1 ? '' : 's' }} in the bag</small></button>

    <div class="flex-1" />
    <div class="actions">
      <button class="px-btn" @click="ui.setTab('shelter')">← BACK</button>
      <button class="px-btn go" :disabled="!inventory.canHeadOut" @click="confirmHeadOut">
        HEAD OUT →
        <small>{{ inventory.canHeadOut ? 'into the fog' : 'pack at least 1 thing' }}</small>
      </button>
    </div>
  </div>
</template>

<style scoped>
.juan { position: relative; display: flex; justify-content: center; align-items: flex-end; height: 172px; margin: 8px 0 0 }
.juan-img { width: 65px; height: 160px; image-rendering: pixelated }
.slot { position: absolute; right: 10px; top: 10px; width: 92px; padding: 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; background: #0e1214; border: 3px solid var(--sodium); box-shadow: 3px 3px 0 #000; font-size: 9px; text-align: center; line-height: 1.3 }
.slot img { width: 26px; height: 40px; object-fit: contain }
.again { width: 100%; margin-bottom: 8px; padding: 9px 12px; font-size: 14px }
.again small { margin-left: 8px; font-family: var(--font-mono); font-weight: 400; font-size: 10px; opacity: .7 }
.gear { margin-top: 8px; font-size: 14px; padding: 10px }
.gear small { margin-left: 8px; font-family: var(--font-mono); font-weight: 400; font-size: 10px; color: var(--muted) }
.actions { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin-top: 14px }
.actions small { display: block; font-family: var(--font-mono); font-weight: 400; font-size: 10px; letter-spacing: 0; opacity: .75 }
.px-btn.load { margin-top: 8px }
.px-cell .kg { position: absolute; left: 2px; bottom: 1px; font: 700 8px/1 var(--font-mono); color: var(--sodium); text-shadow: 0 1px 0 #000 }
</style>
