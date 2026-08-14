<script setup lang="ts">
const ui = useUiStore()
const inventory = useInventoryStore()

function confirmHeadOut() {
  if (!inventory.canHeadOut) return
  ui.setTab('map')
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-y-auto">
    <div class="px-4 py-3" style="background: linear-gradient(180deg, var(--night), rgba(14,18,20,.85)); border-bottom: 1px solid var(--line)">
      <div class="text-xl uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">PACK YOUR BAG</div>
      <div class="text-[11px] mt-1" style="color: var(--muted)">Whatever's in the bag is all you'll have out there — on the map, and in a fight.</div>
    </div>

    <div class="flex items-baseline justify-between mx-4 mt-4 mb-2.5">
      <div class="uppercase text-sm" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1.5px">Bag</div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">{{ inventory.bagCount }} / {{ inventory.bag.length }} slots</div>
    </div>
    <div class="grid grid-cols-5 gap-2 mx-4">
      <div
        v-for="(slotId, i) in inventory.bag"
        :key="i"
        class="aspect-square rounded flex items-center justify-center"
        :style="slotId ? { background: 'var(--panel3)', border: '1px solid var(--sodium)' } : { background: 'var(--panel)', border: '1px dashed var(--line)' }"
        @click="slotId && inventory.unpackSlot(i)"
      >
        <span v-if="slotId" class="text-[22px] leading-none">{{ inventory.stash.find((s) => s.id === slotId)?.icon }}</span>
        <span v-else class="text-[22px] leading-none" style="color: var(--line)">·</span>
      </div>
    </div>

    <div class="flex items-baseline justify-between mx-4 mt-5 mb-2.5">
      <div class="uppercase text-sm" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1.5px">Stash</div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">tap to pack</div>
    </div>
    <div class="grid grid-cols-5 gap-2 mx-4">
      <div
        v-for="item in inventory.stash"
        :key="item.id"
        class="aspect-square rounded flex items-center justify-center relative"
        style="background: var(--panel); border: 1px solid var(--line)"
        :class="item.qty <= 0 || inventory.bagCount >= inventory.bag.length ? 'opacity-35' : 'cursor-pointer'"
        @click="item.qty > 0 && inventory.packItem(item.id)"
      >
        <span class="text-[22px] leading-none">{{ item.icon }}</span>
        <span class="absolute right-0.5 bottom-0.5 text-[10px]" style="font-family: var(--font-mono); color: var(--sodium)">×{{ item.qty }}</span>
      </div>
    </div>

    <div class="flex-1" />

    <div class="grid grid-cols-2 gap-2.5 m-4">
      <div class="p-3.5 rounded flex flex-col gap-0.5 items-center justify-center" style="background: var(--panel2); border: 1px solid var(--line)" @click="ui.setTab('shelter')">
        <span class="uppercase text-base" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">Back</span>
      </div>
      <div
        class="p-3.5 rounded flex flex-col gap-0.5"
        :style="inventory.canHeadOut ? { background: 'var(--sodium)', borderColor: 'var(--sodium)' } : { background: 'var(--panel2)', border: '1px solid var(--line)' }"
        @click="confirmHeadOut"
      >
        <span class="uppercase" :style="{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '1px', color: inventory.canHeadOut ? '#0e1214' : 'var(--muted)', fontSize: '19px' }">Head out →</span>
        <span class="text-[11px]" :style="{ color: inventory.canHeadOut ? '#5a3d12' : 'var(--muted)' }">{{ inventory.canHeadOut ? 'into the fog' : 'pack at least 1 item' }}</span>
      </div>
    </div>
  </div>
</template>
