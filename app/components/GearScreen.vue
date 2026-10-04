<script setup lang="ts">
import { EQUIPMENT, EQUIP_SLOTS, SLOT_LABELS, itemInfo } from '~/data/equipment'
import type { EquipSlot } from '~/data/equipment'

const ui = useUiStore()
const inventory = useInventoryStore()
const player = usePlayerStore()

/** Screen-tag order around the paper doll. */
const DOLL_ORDER: EquipSlot[] = [
  'head',
  'shoulderL',
  'shoulderR',
  'handL',
  'handR',
  'body',
  'legs',
  'feet',
]

const wornEntry = (slot: EquipSlot) => {
  const id = player.equipped[slot]
  return id ? { id, spec: EQUIPMENT[id] } : null
}

const bagGear = computed(() =>
  inventory.bag
    .map((id, slot) => ({ id, slot }))
    .filter((entry): entry is { id: string; slot: number } => entry.id !== null && !!EQUIPMENT[entry.id]),
)

/** Kit tray: gear in the bag the player can put on. Grouped per piece with its slots. */
const kitTray = computed(() =>
  bagGear.value.map((entry) => ({
    ...entry,
    spec: EQUIPMENT[entry.id],
    slotsLabel: EQUIPMENT[entry.id].slots.map((s) => SLOT_LABELS[s]).join(' / '),
  })),
)

function equip(id: string) {
  inventory.equipItem(id)
}

function takeOff(slot: EquipSlot) {
  inventory.unequipSlot(slot)
}

/** Which tray pieces could go into this empty slot (lights the slot's + affordance). */
function trayOffersFor(slot: EquipSlot): number {
  return kitTray.value.filter((entry) => entry.spec.slots.includes(slot)).length
}

const weapon = computed(() => player.weapon)
const durabilityPercent = computed(() =>
  player.unbreakable ? 100 : Math.round((player.weaponDurability / player.weapon.durability) * 100),
)
</script>

<template>
  <div class="flex-1 flex flex-col overflow-y-auto">
    <div class="px-4 py-3 flex items-baseline justify-between" style="background: linear-gradient(180deg, var(--night), rgba(14,18,20,.85)); border-bottom: 1px solid var(--line)">
      <div class="text-xl uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">JUAN'S KIT</div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">tap worn gear to strip it</div>
    </div>

    <!-- The paper doll: Juan in the middle, what he's wearing hanging off him.
         Slot plates sit around the silhouette; filled plates show the piece and glow
         sodium, empty ones hum at the margin until the tray below has something. -->
    <div class="relative mx-4 mt-4 rounded-md overflow-hidden" style="background: radial-gradient(90% 120% at 50% 0%, #14202a 0%, #0b1114 70%); border: 1px solid var(--line)">
      <div class="absolute top-0 left-0 right-0 h-1" style="background: repeating-linear-gradient(90deg, var(--sari-blue) 0 10px, transparent 10px 20px); opacity: .5" />

      <div class="relative grid grid-cols-3 items-center px-2 pt-4 pb-2" style="min-height: 235px">
        <!-- Left column -->
        <div class="flex flex-col gap-2 z-10">
          <button
            v-for="slot in ['head', 'shoulderL', 'handL'] as EquipSlot[]"
            :key="slot"
            class="flex items-center gap-1.5 py-1.5 px-1.5 text-left"
            :style="wornEntry(slot)
              ? { background: 'var(--panel3)', border: '1px solid var(--sodium)', boxShadow: '2px 2px 0 rgba(0,0,0,.4)' }
              : { background: 'var(--panel)', border: '1px dashed var(--line)' }"
            @click="wornEntry(slot) && takeOff(slot)"
          >
            <span class="text-[17px] leading-none w-5 text-center">{{ wornEntry(slot) ? wornEntry(slot)!.spec.icon : '·' }}</span>
            <span class="flex-1 min-w-0">
              <span class="block text-[7px] uppercase tracking-wide truncate" :style="{ fontFamily: 'var(--font-mono)', color: wornEntry(slot) ? 'var(--sodium)' : 'var(--muted)' }">{{ SLOT_LABELS[slot] }}</span>
              <span v-if="wornEntry(slot)" class="block text-[8px] truncate" style="font-family: var(--font-mono); color: var(--bone)">{{ wornEntry(slot)!.spec.name }}</span>
            </span>
          </button>
        </div>

        <!-- Center: the man himself -->
        <div class="flex flex-col items-center justify-center">
          <img src="/images/juan.png" class="w-20 h-24 object-contain" style="image-rendering: pixelated; filter: drop-shadow(3px 4px 0 rgba(0,0,0,.45))" />
          <div class="mt-1 px-2 py-0.5 text-[8px] uppercase tracking-[2px]" style="font-family: var(--font-mono); color: var(--sodium); border: 1px solid rgba(240,166,60,.35); background: rgba(240,166,60,.08)">WORN · 🛡 {{ player.armorTotal }}</div>
        </div>

        <!-- Right column -->
        <div class="flex flex-col gap-2 z-10">
          <button
            v-for="slot in ['shoulderR', 'handR', 'body'] as EquipSlot[]"
            :key="slot"
            class="flex items-center gap-1.5 py-1.5 px-1.5 text-left"
            :style="wornEntry(slot)
              ? { background: 'var(--panel3)', border: '1px solid var(--sodium)', boxShadow: '2px 2px 0 rgba(0,0,0,.4)' }
              : { background: 'var(--panel)', border: '1px dashed var(--line)' }"
            @click="wornEntry(slot) && takeOff(slot)"
          >
            <span class="flex-1 min-w-0 text-right">
              <span class="block text-[7px] uppercase tracking-wide truncate" :style="{ fontFamily: 'var(--font-mono)', color: wornEntry(slot) ? 'var(--sodium)' : 'var(--muted)' }">{{ SLOT_LABELS[slot] }}</span>
              <span v-if="wornEntry(slot)" class="block text-[8px] truncate" style="font-family: var(--font-mono); color: var(--bone)">{{ wornEntry(slot)!.spec.name }}</span>
            </span>
            <span class="text-[17px] leading-none w-5 text-center">{{ wornEntry(slot) ? wornEntry(slot)!.spec.icon : '·' }}</span>
          </button>
        </div>
      </div>

      <!-- Bottom row of the doll: legs + feet under the boots-line -->
      <div class="grid grid-cols-2 gap-2 px-2 pb-3">
        <button
          v-for="slot in ['legs', 'feet'] as EquipSlot[]"
          :key="slot"
          class="flex items-center justify-between py-1.5 px-2"
          :style="wornEntry(slot)
            ? { background: 'var(--panel3)', border: '1px solid var(--sodium)', boxShadow: '2px 2px 0 rgba(0,0,0,.4)' }
            : { background: 'var(--panel)', border: '1px dashed var(--line)' }"
          @click="wornEntry(slot) && takeOff(slot)"
        >
          <span class="text-[7px] uppercase tracking-wide" :style="{ fontFamily: 'var(--font-mono)', color: wornEntry(slot) ? 'var(--sodium)' : 'var(--muted)' }">{{ SLOT_LABELS[slot] }}</span>
          <span class="flex items-center gap-1">
            <span v-if="wornEntry(slot)" class="text-[8px]" style="font-family: var(--font-mono); color: var(--bone)">{{ wornEntry(slot)!.spec.name }}</span>
            <span class="text-[15px] leading-none">{{ wornEntry(slot) ? wornEntry(slot)!.spec.icon : '·' }}</span>
          </span>
        </button>
      </div>
    </div>

    <!-- The weapon plaque: what Juan actually swings with -->
    <div class="mx-4 mt-3 p-3 relative" style="background: linear-gradient(135deg,#1c1710,#12100c); border: 2px solid #4a3b1e; box-shadow: 0 3px 0 rgba(0,0,0,.35)">
      <div class="absolute top-0 left-0 right-0 h-1" style="background: repeating-linear-gradient(90deg, var(--sari-yel) 0 12px, transparent 12px 24px); opacity: .4" />
      <div class="flex items-center justify-between mt-1">
        <span class="flex items-center gap-2">
          <span class="text-xl">{{ weapon.icon }}</span>
          <span>
            <span class="block uppercase text-[13px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px; color: var(--bone)">{{ weapon.name }}</span>
            <span class="block text-[9px]" style="font-family: var(--font-mono); color: var(--muted)">{{ weapon.damage }} dmg · {{ Math.round(weapon.accuracy * 100) }}% acc{{ player.unbreakable ? ' · unbreakable' : '' }}</span>
          </span>
        </span>
        <span v-if="!player.unbreakable" class="flex items-center gap-1.5">
          <span class="inline-block h-1.5 w-14 overflow-hidden" style="background: #0c1113">
            <b class="block h-full" :style="{ width: durabilityPercent + '%', background: player.weaponDurability <= 2 ? 'var(--sari-red)' : 'var(--sodium)' }" />
          </span>
          <span class="text-[9px]" style="font-family: var(--font-mono); color: var(--muted)">{{ player.weaponDurability }}</span>
        </span>
      </div>
    </div>

    <!-- Kit tray: gear in the bag, waiting to be worn -->
    <div class="flex items-baseline justify-between mx-4 mt-4 mb-2">
      <div class="uppercase text-sm" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1.5px">Kit in bag</div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">tap to wear it</div>
    </div>
    <div v-if="kitTray.length" class="mx-4 flex flex-col gap-2">
      <button
        v-for="entry in kitTray"
        :key="entry.id"
        class="flex items-center gap-3 py-2.5 px-3 text-left"
        style="background: var(--panel3); border: 1px solid var(--line); box-shadow: 3px 3px 0 rgba(0,0,0,.3)"
        @click="equip(entry.id)"
      >
        <span class="text-xl">{{ entry.spec.icon }}</span>
        <span class="flex-1 min-w-0">
          <span class="block text-[12px]" style="color: var(--bone)">{{ entry.spec.name }}</span>
          <span class="block text-[9px] truncate" style="font-family: var(--font-mono); color: var(--muted)">{{ entry.slotsLabel }} · {{ entry.spec.weapon ? `${entry.spec.weapon.damage} dmg` : `${entry.spec.armor} armor` }}</span>
        </span>
        <span class="text-[11px]" style="font-family: var(--font-mono); color: var(--sodium)">wear →</span>
      </button>
    </div>
    <div v-else class="mx-4 p-3 text-[11px]" style="font-family: var(--font-mono); color: var(--muted); border: 1px dashed var(--line)">
      Nothing spare in the bag. What Juan wears is what he's got.
    </div>

    <div class="flex-1" />

    <div class="grid grid-cols-2 gap-2.5 m-4">
      <div class="p-3.5 rounded flex flex-col gap-0.5 items-center justify-center" style="background: var(--panel2); border: 1px solid var(--line)" @click="ui.setTab('shelter')">
        <span class="uppercase text-base" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">Back</span>
      </div>
      <div class="p-3.5 rounded flex flex-col gap-0.5 items-center justify-center" style="background: var(--panel2); border: 1px solid var(--line)" @click="ui.setTab('pack')">
        <span class="uppercase text-base" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">Pack bag →</span>
      </div>
    </div>
  </div>
</template>
