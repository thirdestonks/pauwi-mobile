<script setup lang="ts">
// The field bag, in the pixel-art direction (DESIGN.md "Pack (the bag)", ported from the
// hex-map preview's bag screen): Juan in the middle with the weapon in hand, his meters and
// Dread, and the bag's slots below. Tap a slot to look at what's in it. Out here the bag is
// read-only: items are used in a fight, armor goes on at home.
import { CONSUMABLE_EFFECTS, PIXEL_COMBAT } from '~/data/combat'
import { kgOf } from '~/data/weight'
import { EQUIPMENT, itemInfo } from '~/data/equipment'
import { tradeValue } from '~/data/trade'

const ui = useUiStore()
const inventory = useInventoryStore()
const player = usePlayerStore()
const sfx = useSfx()

/** Ammo into the 9mm: loose rounds, then packs and boxes from the bag, up to 18. */
function loadPistol() {
  const n = player.loadPistol()
  if (!n) return
  sfx.play('9mm-reload')
}

const UI = '/game/encounters/src/ui/'
const meters = computed(() => [
  { key: 'health', label: 'HEALTH', value: player.health },
  { key: 'energy', label: 'ENERGY', value: player.energy },
  { key: 'food', label: 'FOOD', value: player.food },
  { key: 'hope', label: 'HOPE', value: player.hope },
])

const weaponLine = computed(() => {
  const w = player.weapon
  if (w.combat.gun) return `${w.name} · ${player.loadedOf(w.id)}/${PIXEL_COMBAT.guns[w.id]?.mag ?? 6}`
  return player.unbreakable ? w.name : `${w.name} · ${player.weaponDurability}`
})

const selected = ref(-1)
const detail = computed(() => {
  const slot = inventory.bag[selected.value]
  const id = slot?.id
  if (!id) return `${inventory.bagCount} / ${inventory.bag.length} slots. Repeats stack two to a slot. Tap something to look at it.`
  const info = itemInfo(id)
  const spec = EQUIPMENT[id]
  const what = spec?.combat ? `${spec.combat.dmg} a hit${spec.durability && Number.isFinite(spec.durability) ? `, ${spec.durability} swings` : ''} · equip at home`
    : spec?.armor ? `${spec.armor} armor · wear it at home`
      : (CONSUMABLE_EFFECTS[id]?.label ?? `worth ${tradeValue(id)} to the trader`)
  return `${info?.name ?? id}${slot && slot.qty > 1 ? ` ×${slot.qty}` : ''}. ${what}.`
})

function pick(i: number) {
  selected.value = i === selected.value || !inventory.bag[i] ? -1 : i
}

// The bag's buckle, flap, open, supplies: 4 frames, played on the way in.
const opening = ref(true)
const frame = ref(0)
onMounted(() => {
  sfx.play('backpack_sound', 0.8)
  let k = 0
  const step = () => {
    frame.value = k
    if (++k < 4) setTimeout(step, 110)
    else setTimeout(() => (opening.value = false), 160)
  }
  step()
})

function sort() {
  inventory.sortBag()
  selected.value = -1
  sfx.play('backpack_sound', 0.6)
}

function goMap() {
  ui.setTab('map')
}
</script>

<template>
  <div class="px-screen flex-1 flex flex-col overflow-y-auto">
    <div v-if="opening" class="flex-1 flex items-center justify-center">
      <div class="bag-anim" :style="{ backgroundPosition: `-${frame * 48 * 4}px 0` }" />
    </div>

    <template v-else>
      <div class="px-title">THE BAG</div>

      <div class="juan px-panel">
        <img :src="'/game/encounters/src/juan-full.png'" alt="Juan" class="juan-img">
        <div class="slot">
          <img v-if="player.weapon.sprite" :src="player.weapon.sprite" alt="" class="px-img">
          <span>{{ weaponLine }}</span>
        </div>
      </div>

      <div class="meters">
        <span class="dread">DREAD <b>{{ player.dread }}</b><i v-if="player.shaken"> · SHAKEN</i></span>
        <span v-for="m in meters" :key="m.key"><img :src="`${UI}icon-${m.key}.png`" alt="" class="px-img">{{ m.label }}<b>{{ m.value }}</b></span>
      </div>

      <WeightBar />
      <div class="px-grid">
        <button
          v-for="(slot, i) in inventory.bag"
          :key="i"
          class="px-cell"
          :aria-pressed="i === selected"
          :aria-label="slot ? (itemInfo(slot.id)?.name ?? slot.id) : 'Empty slot'"
          @click="pick(i)"
        >
          <img v-if="slot && itemInfo(slot.id)?.sprite" :src="itemInfo(slot.id)!.sprite" alt="">
          <span v-else-if="slot" class="emoji">{{ itemInfo(slot.id)?.icon ?? '❔' }}</span>
          <span v-if="slot && slot.qty > 1" class="qty">×{{ slot.qty }}</span>
          <span v-if="slot" class="kg">{{ +(kgOf(slot.id) * slot.qty).toFixed(2) }}</span>
        </button>
      </div>
      <p class="px-detail">{{ detail }}</p>
      <button class="px-btn sort" :disabled="!inventory.bagCount" @click="sort">SORT THE BAG</button>
      <button v-if="player.canLoadPistol" class="px-btn load" @click="loadPistol">LOAD THE 9MM <small>{{ player.rounds }}/{{ PIXEL_COMBAT.guns.pistol?.mag }}{{ player.spareRounds ? ` · ${player.spareRounds} loose` : '' }}</small></button>

      <div class="flex-1" />
      <button class="px-btn go" @click="goMap">BACK TO THE MAP →</button>
    </template>
  </div>
</template>

<style scoped>
.bag-anim { width: 192px; height: 176px; background: url('/game/encounters/src/ui/bag-open.png') 0 0 / 768px 176px no-repeat; image-rendering: pixelated }
.juan { position: relative; display: flex; justify-content: center; align-items: flex-end; height: 268px; margin: 8px 0 4px }
.juan-img { width: 104px; height: 256px; image-rendering: pixelated }
.slot { position: absolute; right: 10px; top: 10px; width: 92px; padding: 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; background: #0e1214; border: 3px solid var(--sodium); box-shadow: 3px 3px 0 #000; font-size: 9px; text-align: center; line-height: 1.3 }
.slot img { width: 34px; height: 52px; object-fit: contain }
.meters { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 12px 0 }
.meters span { display: flex; align-items: center; gap: 6px; padding: 5px 7px; background: #0e1214; border: 2px solid #000; font-size: 10px; letter-spacing: .06em }
.meters span img { width: 28px; height: 28px }
.meters b { margin-left: auto; color: var(--sodium) }
.meters .dread { grid-column: 1 / -1; justify-content: center; color: #b78be6 }
.meters .dread b { margin-left: 4px; color: #b78be6 }
.meters .dread i { font-style: normal; color: var(--sari-red) }
.px-btn.go { margin-top: 12px }
.px-btn.sort { margin-top: 8px }
.px-btn.load { margin-top: 8px }
.px-cell .kg { position: absolute; left: 2px; bottom: 1px; font: 700 8px/1 var(--font-mono); color: var(--sodium); text-shadow: 0 1px 0 #000 }
</style>
