<script setup lang="ts">
import { CONSUMABLE_EFFECTS } from '~/data/combat'
import { EQUIPMENT, itemInfo } from '~/data/equipment'

const ui = useUiStore()
const inventory = useInventoryStore()

const bagEntries = computed(() =>
  inventory.bag.flatMap((id, slot) => {
    if (!id) return []
    const info = itemInfo(id)
    const spec = EQUIPMENT[id]
    return [{
      slot,
      icon: info?.icon ?? '❔',
      name: info?.name ?? id,
      caption: spec?.weapon
        ? `${spec.weapon.damage} dmg · ${Math.round(spec.weapon.accuracy * 100)}% acc`
        : spec?.armor
          ? `${spec.armor} armor · equip at home`
          : (CONSUMABLE_EFFECTS[id]?.label ?? 'consumable'),
    }]
  }),
)

function goMap() {
  ui.setTab('map')
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-y-auto">
    <div class="px-4 py-3" style="background: linear-gradient(180deg, var(--night), rgba(14,18,20,.85)); border-bottom: 1px solid var(--line)">
      <div class="text-xl uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">FIELD BAG</div>
      <div class="text-[11px] mt-1" style="color: var(--muted)">What Juan carries in the fog. Eat and sleep happen back at the shelter — if he makes it back.</div>
    </div>

    <div class="grid grid-cols-5 gap-2 mx-4 mt-4">
      <div
        v-for="entry in bagEntries"
        :key="entry.slot"
        class="aspect-square rounded flex items-center justify-center relative"
        style="background: var(--panel3); border: 1px solid var(--sodium)"
      >
        <span class="text-[22px] leading-none">{{ entry.icon }}</span>
        <span class="absolute right-0.5 bottom-0.5 text-[7px]" style="font-family: var(--font-mono); color: var(--muted)">{{ entry.caption }}</span>
      </div>
      <div
        v-for="i in (inventory.bag.length - bagEntries.length)"
        :key="`empty-${i}`"
        class="aspect-square rounded flex items-center justify-center"
        style="background: var(--panel); border: 1px dashed var(--line)"
      >
        <span class="text-[22px] leading-none" style="color: var(--line)">·</span>
      </div>
    </div>

    <div class="mx-4 mt-4 p-3 text-[11px] leading-relaxed rounded-sm" style="background: var(--panel); border: 1px solid var(--line); color: #cdc6b8">
      <b style="color: var(--bone)">Out here the bag is read-only.</b> Use items in a fight from the Combat screen; armor goes on at home. The stash is whatever you left behind — the fog keeps what it keeps.
    </div>

    <div class="flex-1" />

    <div class="m-4 p-3.5 rounded flex flex-col gap-0.5" style="background: var(--sodium); border-color: var(--sodium)" @click="goMap">
      <span class="uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px; color: #0e1214; font-size: 19px">Back to the map →</span>
      <span class="text-[11px]" style="color: #5a3d12">the fog won't wait</span>
    </div>
  </div>
</template>
