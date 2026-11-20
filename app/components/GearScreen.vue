<script setup lang="ts">
import { PIXEL_COMBAT, rowMultOf } from '~/data/combat'
import { EQUIPMENT, SLOT_LABELS, type EquipSlot } from '~/data/equipment'
import { damageRange } from '~/stores/combat'

const ui = useUiStore()
const inventory = useInventoryStore()
const player = usePlayerStore()
const sfx = useSfx()

const columns: EquipSlot[][] = [
  ['head', 'shoulderL', 'handL', 'legs'],
  ['body', 'shoulderR', 'handR', 'feet'],
]
const selectedSlot = ref<EquipSlot>('handR')
const selectedBagSlot = ref<number | null>(null)
const notice = ref('Tap a slot or spare gear to inspect it.')
const bagGear = computed(() => inventory.bag.flatMap((entry, slot) =>
  entry && EQUIPMENT[entry.id] ? [{ id: entry.id, slot, spec: EQUIPMENT[entry.id] }] : [],
))
const stashGearCount = computed(() => inventory.stash.reduce((n, item) =>
  n + (EQUIPMENT[item.id] ? item.qty : 0), 0,
))
const selectedId = computed(() => selectedBagSlot.value === null
  ? player.equipped[selectedSlot.value]
  : inventory.bag[selectedBagSlot.value]?.id)
const selectedSpec = computed(() => selectedId.value ? EQUIPMENT[selectedId.value] : undefined)
const selectedDurability = computed(() => selectedId.value ? player.durabilityOf(selectedId.value) : undefined)
const lowDurability = computed(() => selectedDurability.value !== undefined && selectedDurability.value <= 2)
const weaponRows = computed(() => {
  const combat = selectedSpec.value?.combat
  if (!combat) return []
  const [lo, hi] = damageRange(combat.dmg)
  return ['CLOSE', 'MID', 'FAR'].map((label, row) => {
    const mult = rowMultOf(combat, row)
    const min = +(lo * mult).toFixed(1), max = +(hi * mult).toFixed(1)
    return { label, range: min === max ? `${min}` : `${min}\u2013${max}` }
  })
})
const replacement = computed(() => {
  if (selectedBagSlot.value === null || !selectedSpec.value) return ''
  // A two-handed piece occupies two slots but only returns one item to the bag.
  const ids = [...new Set(selectedSpec.value.slots.map((slot) => player.equipped[slot]))]
    .filter((id): id is string => !!id)
  return ids.length ? `Replaces ${ids.map((id) => EQUIPMENT[id]!.name).join(' + ')}.` : 'Fits an empty slot.'
})

function worn(slot: EquipSlot) {
  const id = player.equipped[slot]
  return id ? EQUIPMENT[id] : undefined
}

function offered(slot: EquipSlot) {
  return bagGear.value.some((entry) => entry.spec.slots.includes(slot))
}

function inspectSlot(slot: EquipSlot) {
  selectedSlot.value = slot
  selectedBagSlot.value = null
}

function equipSelected() {
  const spec = selectedSpec.value
  if (selectedBagSlot.value === null || !spec || !inventory.equipItem(spec.id)) return
  sfx.play(spec.id === 'pistol' ? 'pistol-cock' : 'equip-sound', 0.8)
  notice.value = `${spec.name} equipped. Replaced gear goes into the bag, or the stash if full.`
  inspectSlot(spec.slots[0]!)
}

function removeSelected() {
  const spec = selectedSpec.value
  if (selectedBagSlot.value !== null || !spec) return
  const destination = inventory.bagCount < inventory.bag.length ? 'bag' : 'stash'
  if (!inventory.unequipSlot(selectedSlot.value)) return
  sfx.play('put-item', 0.8)
  notice.value = `${spec.name} put in the ${destination}.${destination === 'stash' ? ' The bag is full.' : ''}`
}
</script>

<template>
  <div class="px-screen kit-screen flex-1 flex flex-col overflow-y-auto">
    <div class="px-title">JUAN'S KIT</div>
    <p class="kit-caption">GEAR UP BEFORE HEADING OUT</p>

    <div class="paper-doll px-panel">
      <div class="doll-slots">
        <template v-for="(column, side) in columns" :key="side">
          <div v-if="side === 1" class="juan">
            <span class="juan-label">JUAN</span>
            <img src="/game/encounters/src/juan-full.png" alt="Juan" class="juan-img">
            <span class="armor"><b>{{ player.armorTotal }}</b> ARMOR</span>
          </div>
          <div class="slot-column">
            <button
              v-for="slot in column"
              :key="slot"
              class="gear-slot"
              :class="{ filled: worn(slot), offered: !worn(slot) && offered(slot) }"
              :aria-pressed="selectedBagSlot === null && selectedSlot === slot"
              :aria-label="`${SLOT_LABELS[slot]}: ${worn(slot)?.name ?? 'Empty'}`"
              @click="inspectSlot(slot)"
            >
              <span class="slot-label">{{ SLOT_LABELS[slot] }}</span>
              <span class="slot-content">
                <img v-if="worn(slot)?.sprite" :src="worn(slot)!.sprite" alt="">
                <span v-else class="slot-icon">{{ worn(slot)?.icon ?? (offered(slot) ? '+' : '\u00b7') }}</span>
                <span class="slot-name">{{ worn(slot)?.name ?? (offered(slot) ? 'GEAR IN BAG' : 'EMPTY') }}</span>
              </span>
            </button>
          </div>
        </template>
      </div>
      <div class="doll-footer">
        <span>IN HAND <b>{{ player.weapon.name }}</b></span>
        <span>BAG <b>{{ inventory.bagCount }}/{{ inventory.bag.length }}</b></span>
      </div>
    </div>

    <section class="inspection px-panel" aria-label="Gear details">
      <template v-if="selectedSpec">
        <div class="inspection-heading">
          <div>
            <small>{{ selectedBagSlot === null ? 'WORN' : 'IN THE BAG' }} · {{ selectedSpec.twoHanded ? 'BOTH HANDS' : selectedSpec.slots.map((s) => SLOT_LABELS[s]).join(' / ') }}</small>
            <h2>{{ selectedSpec.name }}</h2>
          </div>
          <button v-if="selectedBagSlot !== null" class="px-btn go gear-action" @click="equipSelected">EQUIP</button>
          <button v-else class="px-btn gear-action" @click="removeSelected">TAKE OFF</button>
        </div>
        <div v-if="weaponRows.length" class="weapon-rows" aria-label="Damage by distance">
          <span v-for="row in weaponRows" :key="row.label"><small>{{ row.label }}</small><b>{{ row.range }}</b></span>
        </div>
        <p v-if="selectedSpec.combat" class="stat-note">{{ Math.round((1 - (player.shaken ? PIXEL_COMBAT.shakenMiss : 0)) * 100) }}% hit · {{ Math.round((selectedSpec.combat.crit ?? PIXEL_COMBAT.critChance) * 100) }}% crit ×{{ PIXEL_COMBAT.critMult }}{{ player.shaken ? ' · SHAKEN' : '' }}</p>
        <p v-else class="stat-note">{{ selectedSpec.armor ?? 0 }} armor · takes that much off each hit (never more than half)</p>
        <p v-if="selectedSpec.trait" class="stat-note">{{ selectedSpec.trait }}</p>
        <div v-if="selectedSpec.condition" class="condition" :class="{ low: player.conditionOf(selectedSpec.id) <= selectedSpec.condition / 4 }">
          <span>CONDITION</span>
          <div class="condition-bar" role="meter" aria-label="Armor condition" :aria-valuenow="player.conditionOf(selectedSpec.id)" :aria-valuemin="0" :aria-valuemax="selectedSpec.condition"><i :style="{ width: `${Math.max(0, Math.min(100, player.conditionOf(selectedSpec.id) / selectedSpec.condition * 100))}%` }" /></div>
          <b>{{ player.conditionOf(selectedSpec.id) }}/{{ selectedSpec.condition }}</b>
          <small>Wears down by what it blocks. Patch it at the stash.</small>
        </div>
        <div v-if="selectedSpec.combat?.gun" class="condition">
          <span>LOADED</span><b>{{ player.loadedOf(selectedSpec.id) }}/{{ PIXEL_COMBAT.guns[selectedSpec.id]?.mag ?? PIXEL_COMBAT.magazine }}</b><small>Reload from the bag in combat.</small>
        </div>
        <div v-else-if="selectedSpec.combat && selectedSpec.durability && selectedDurability !== undefined" class="condition" :class="{ low: lowDurability }">
          <span>SWINGS</span>
          <div class="condition-bar" role="meter" aria-label="Swings remaining" :aria-valuenow="selectedDurability" :aria-valuemin="0" :aria-valuemax="selectedSpec.durability"><i :style="{ width: `${Math.max(0, Math.min(100, selectedDurability / selectedSpec.durability * 100))}%` }" /></div>
          <b>{{ selectedDurability }}/{{ selectedSpec.durability }}</b>
          <small v-if="lowDurability">Nearly broken</small>
        </div>
        <p v-else-if="selectedSpec.combat" class="stat-note">Doesn't break.</p>
        <p v-if="replacement" class="replacement">{{ replacement }}</p>
      </template>
      <template v-else>
        <small>{{ SLOT_LABELS[selectedSlot] }}</small>
        <h2>Empty slot</h2>
        <p class="stat-note">{{ offered(selectedSlot) ? 'Compatible gear is waiting in the bag below.' : 'Pack spare gear at the shelter, then equip it here.' }}</p>
      </template>
    </section>

    <div class="px-label">SPARE GEAR <small>{{ bagGear.length }} in the bag · tap to inspect</small></div>
    <div v-if="bagGear.length" class="spare-grid">
      <button v-for="entry in bagGear" :key="entry.slot" class="spare-item" :aria-pressed="selectedBagSlot === entry.slot" :aria-label="`Inspect ${entry.spec.name}, bag slot ${entry.slot + 1}`" @click="selectedBagSlot = entry.slot">
        <img v-if="entry.spec.sprite" :src="entry.spec.sprite" alt="">
        <span v-else class="spare-icon">{{ entry.spec.icon }}</span>
        <span>{{ entry.spec.name }}</span>
      </button>
    </div>
    <p v-else class="empty-tray">No spare gear in the bag.</p>
    <button v-if="stashGearCount" class="stash-link" @click="ui.setTab('pack')">{{ stashGearCount }} piece{{ stashGearCount === 1 ? '' : 's' }} of gear in the stash · OPEN PACK →</button>
    <p class="px-detail notice" role="status">{{ notice }}</p>

    <div class="actions">
      <button class="px-btn" @click="ui.setTab('shelter')">← SHELTER</button>
      <button class="px-btn go" @click="ui.setTab('pack')">PACK BAG →</button>
    </div>
  </div>
</template>

<style scoped>
.kit-screen { gap: 0; min-height: 0 }
.kit-screen > * { flex-shrink: 0 }
.kit-caption { margin: 2px 0 12px; color: var(--muted); font-size: 9px; letter-spacing: .12em; text-align: center }
.paper-doll { padding: 12px 10px 0 }
.doll-slots { display: grid; grid-template-columns: minmax(0, 1fr) 88px minmax(0, 1fr); gap: 8px; align-items: center }
.slot-column { display: grid; gap: 8px }
.gear-slot { min-width: 0; min-height: 50px; padding: 5px; background: #0e1214; border: 2px solid #36302a; box-shadow: 2px 2px 0 #000; text-align: left }
.gear-slot[aria-pressed='true'], .spare-item[aria-pressed='true'] { border-color: var(--sodium) }
.gear-slot.offered { border-color: var(--green) }
.slot-label { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted) }
.filled .slot-label { color: var(--sodium) }
.slot-content { display: flex; align-items: center; gap: 5px; margin-top: 3px }
.slot-content img { width: 24px; height: 24px; object-fit: contain; image-rendering: pixelated }
.slot-icon { flex: 0 0 24px; font-size: 17px; text-align: center; color: var(--muted) }
.slot-name { min-width: 0; font-size: 9px; line-height: 1.3; overflow-wrap: anywhere }
.gear-slot:not(.filled) .slot-name { color: var(--muted); font-size: 8px }
.juan { display: flex; flex-direction: column; align-items: center; align-self: stretch; justify-content: space-between; padding-top: 5px; background: #171510 }
.juan-label { color: var(--muted); font-size: 8px; letter-spacing: .18em }
.juan-img { width: 78px; height: 192px; object-fit: contain; image-rendering: pixelated; filter: drop-shadow(4px 4px 0 #000) }
.armor { margin-top: 6px; font-size: 9px; color: var(--muted); white-space: nowrap }
.armor b { color: var(--sodium); font-size: 14px }
.doll-footer { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; padding: 9px 0; border-top: 2px solid #000; font-size: 8px; color: var(--muted) }
.doll-footer b { color: var(--bone); font-weight: 400 }
.inspection { padding: 10px; margin-top: 12px }
.inspection-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px }
.inspection small { font-size: 8px; color: var(--muted) }
.inspection h2 { margin: 3px 0; font-size: 13px; color: var(--bone) }
.gear-action { flex-shrink: 0; min-height: 44px; padding: 8px; font-size: 13px }
.weapon-rows { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 10px 0 6px }
.weapon-rows span { display: flex; justify-content: space-between; align-items: center; gap: 4px; background: #0e1214; padding: 6px }
.weapon-rows b { font-size: 11px; color: var(--sodium); font-weight: 400 }
.stat-note, .replacement { margin: 6px 0 0; color: #b8b1a3; font-size: 9px; line-height: 1.5 }
.replacement { color: var(--sodium) }
.condition { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; font-size: 9px }
.condition > span { font-size: 8px; color: var(--muted) }
.condition b { color: var(--sodium); font-weight: 400 }
.condition-bar { flex: 1; height: 6px; background: #000 }
.condition-bar i { display: block; height: 100%; background: var(--sodium) }
.condition.low b, .condition.low small { color: var(--sari-red) }
.condition.low i { background: var(--sari-red) }
.spare-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px }
.spare-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; min-height: 78px; padding: 6px; background: #0e1214; border: 2px solid #000; box-shadow: 2px 2px 0 #000; font-size: 9px; text-align: center }
.spare-item img { width: 30px; height: 30px; object-fit: contain; image-rendering: pixelated }
.spare-icon { font-size: 24px }
.empty-tray { margin: 0; padding: 12px; border: 2px solid #36302a; color: var(--muted); font-size: 10px }
.stash-link { margin-top: 10px; min-height: 44px; padding: 8px; text-align: left; font-size: 10px; color: var(--sodium); border: 2px solid #36302a }
.notice { font-size: 10px; min-height: 32px }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: auto; padding-top: 14px }
.actions .px-btn { padding: 12px 8px; font-size: 16px }
.kit-screen button:focus-visible { outline: 2px solid var(--bone); outline-offset: 2px }
</style>
