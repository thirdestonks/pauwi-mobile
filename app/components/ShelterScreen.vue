<script setup lang="ts">
const ui = useUiStore()

// Placeholder data — real meters/stash/escape state arrives with Phase 2's shelter loop.
const meters = [
  { label: 'Health', value: 72, color: 'linear-gradient(90deg,#d94b3b,#e88a4a)' },
  { label: 'Energy', value: 40, color: 'linear-gradient(90deg,#2e86ab,#57b0d0)' },
  { label: 'Food', value: 55, color: 'linear-gradient(90deg,#7a8c3a,#b6d24a)' },
  { label: 'Hope', value: 34, color: 'linear-gradient(90deg,#8a6a2f,#f0a63c)' },
]

const stash = [
  { icon: '🥫', qty: 3 },
  { icon: '🧴', qty: 2 },
  { icon: '🍜', qty: 4 },
  { icon: '💊', qty: 1 },
  { icon: '🔋', qty: 2 },
]
const stashSlots = 10
</script>

<template>
  <div class="flex-1 overflow-y-auto pb-4">
    <div class="sticky top-0 z-20 flex items-center justify-between px-4 py-3" style="background: linear-gradient(180deg, var(--night), rgba(14,18,20,.85)); border-bottom: 1px solid var(--line)">
      <div class="text-xl uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">NIGHT <span style="color: var(--sodium)">01</span></div>
      <div class="flex items-center gap-1.5 text-[10px]" style="font-family: var(--font-mono); color: var(--sari-yel)">
        <span class="w-1.5 h-1.5 rounded-full" style="background: var(--sari-yel); animation: flick 2.4s infinite" />
        FOG · NO SIGNAL
      </div>
    </div>

    <div class="m-4 p-4 rounded-sm relative" style="transform: rotate(-.6deg); background: linear-gradient(180deg,#c23a2c,#a82e22); border: 3px solid #7c2018; box-shadow: 0 6px 0 rgba(0,0,0,.4), inset 0 0 0 2px rgba(242,201,76,.4)">
      <div class="absolute top-0 left-0 right-0 h-1.5" style="background: repeating-linear-gradient(90deg, var(--sari-yel) 0 14px, #7c2018 14px 28px)" />
      <h1 class="text-center uppercase leading-none mt-1" style="font-family: var(--font-display); font-weight: 700; font-size: 28px; letter-spacing: 1px; color: #fff5e0; text-shadow: 2px 2px 0 rgba(0,0,0,.35)">NIDA'S<br>SARI-SARI STORE</h1>
      <div class="text-center mt-1.5" style="font-family: var(--font-mono); font-size: 10px; color: #ffe9c4; letter-spacing: 3px">· OPEN 24 HRS · NO CREDIT ·</div>
    </div>

    <div class="mx-4 mb-3.5 p-3 text-[13px] leading-relaxed rounded-sm" style="background: var(--panel); border-left: 3px solid var(--sodium); color: #cdc6b8">
      <b style="color: var(--bone)">Juan.</b> Two years in Manila, off the boat from the province. The room behind Nida's counter is the one you've rented since you got here — now it's the only shelter you've got. <b style="color: var(--bone)">You can't relocate.</b> Fourteen days since NAIA. Tonight, the plan starts.
    </div>

    <div class="flex items-baseline justify-between mx-4 mt-4 mb-2.5">
      <div class="uppercase text-sm" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1.5px">Condition</div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">NIGHT 01</div>
    </div>
    <div class="grid grid-cols-2 gap-2.5 mx-4">
      <div v-for="m in meters" :key="m.label" class="p-2.5 rounded" style="background: var(--panel); border: 1px solid var(--line)">
        <div class="flex justify-between items-center mb-1.5">
          <b class="uppercase text-xs" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">{{ m.label }}</b>
          <i class="text-[11px] not-italic" style="font-family: var(--font-mono); color: var(--muted)">{{ m.value }}%</i>
        </div>
        <div class="h-2 rounded overflow-hidden" style="background: #0c1113">
          <b class="block h-full rounded" :style="{ width: m.value + '%', background: m.color }" />
        </div>
      </div>
    </div>

    <div class="flex items-baseline justify-between mx-4 mt-4 mb-2.5">
      <div class="uppercase text-sm" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1.5px">Stash</div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">inventory</div>
    </div>
    <div class="grid grid-cols-5 gap-2 mx-4">
      <div v-for="i in stashSlots" :key="i" class="aspect-square rounded flex items-center justify-center relative" style="background: var(--panel); border: 1px solid var(--line)" :class="i > stash.length ? 'opacity-35' : ''">
        <template v-if="i <= stash.length">
          <span class="text-[22px] leading-none">{{ stash[i - 1].icon }}</span>
          <span class="absolute right-0.5 bottom-0.5 text-[10px]" style="font-family: var(--font-mono); color: var(--sodium)">×{{ stash[i - 1].qty }}</span>
        </template>
        <span v-else class="text-[22px] leading-none">·</span>
      </div>
    </div>

    <div class="m-4 p-3.5 rounded relative overflow-hidden" style="background: linear-gradient(135deg,#12232b,#0f1a1f); border: 1px solid #234049">
      <div class="uppercase text-[15px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">The Way Out</div>
      <div class="text-xs my-1 mb-3" style="color: var(--muted)">Fare, papers, and a clear route to North Harbor — still days out from here.</div>
      <div class="flex gap-1.5 mb-2.5">
        <i v-for="i in 5" :key="i" class="flex-1 h-1.5 rounded" style="background: #0c1113" />
      </div>
      <div class="text-[11px]" style="font-family: var(--font-mono); color: var(--sari-blue)">0 / 5 steps · ₱0 saved</div>
    </div>

    <div class="grid grid-cols-2 gap-2.5 m-4">
      <div class="p-3.5 rounded flex flex-col gap-0.5" style="background: var(--panel2); border: 1px solid var(--line)">
        <span class="uppercase text-base" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">Eat</span>
        <span class="text-[11px]" style="color: var(--muted)">−1 food · restore</span>
      </div>
      <div class="p-3.5 rounded flex flex-col gap-0.5" style="background: var(--panel2); border: 1px solid var(--line)">
        <span class="uppercase text-base" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">Sleep</span>
        <span class="text-[11px]" style="color: var(--muted)">end the night · +energy</span>
      </div>
      <div class="col-span-2 p-3.5 rounded flex flex-col gap-0.5" style="background: var(--sodium); border-color: var(--sodium)" @click="ui.setTab('map')">
        <span class="uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px; color: #0e1214; font-size: 19px">Head out →</span>
        <span class="text-[11px]" style="color: #5a3d12">into the fog</span>
      </div>
    </div>
  </div>
</template>
