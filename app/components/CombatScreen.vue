<script setup lang="ts">
// Placeholder combat demo — real turn-based mechanics arrive with Phase 3.
// State here is local and self-contained, matching reference.html's vanilla-JS demo.
const eHp = ref(64)
const hHp = ref(72)
const dread = ref(45)
const log = ref('You feel for the wall in the fog and find bars instead — two Shamblers already between you and the street.')

const shaken = computed(() => dread.value >= 60)

function attack() {
  eHp.value = Math.max(0, eHp.value - 30)
  dread.value = Math.min(100, dread.value + 8)
  log.value = eHp.value <= 0
    ? 'The front Shambler drops. One left, and it\'s already turning toward you.'
    : 'You swing the pipe wrench into the front Shambler — it staggers, snarling.'
}

function guard() {
  log.value = 'You brace against the wall, weapon up — the next hit will land soft.'
}

function useItem() {
  hHp.value = Math.min(100, hHp.value + 20)
  log.value = 'You tear open the bandage one-handed — +20% Health, but you\'re still cornered.'
}

function retreat() {
  hHp.value = Math.max(0, hHp.value - 12)
  log.value = 'You break for the mouth of the alley — it clips you on the way out. −12% Health, but you\'re clear.'
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="px-4 py-3 flex justify-between items-center" style="border-bottom: 1px solid var(--line)">
      <div class="uppercase text-[15px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">AMBUSH: <span style="color: var(--sari-red)">Fogged Alley</span></div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">ROUND 2</div>
    </div>

    <div class="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto" style="border-bottom: 1px solid var(--line); background: linear-gradient(180deg, rgba(240,166,60,.04), transparent)">
      <span class="text-[8px] tracking-wide mr-0.5" style="font-family: var(--font-mono); color: var(--muted)">ORDER</span>
      <div class="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[15px]" style="border: 2px solid var(--sodium); background: rgba(240,166,60,.12); box-shadow: 0 0 0 3px rgba(240,166,60,.25)">🧍</div>
      <span style="color: var(--line)">→</span>
      <div class="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[15px]" style="border: 2px solid #3a4a34; background: rgba(90,161,122,.08)">🧟</div>
      <span style="color: var(--line)">→</span>
      <div class="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[15px]" style="border: 2px solid #3a4a34; background: rgba(90,161,122,.08)">🧟</div>
      <span style="color: var(--line)">→</span>
      <div class="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[15px]" style="border: 2px solid var(--sodium); background: var(--panel)">🧍</div>
    </div>

    <div class="px-4 pt-4 pb-1.5" style="background: linear-gradient(180deg, #0c0f10, #141a1c 80%, #0c0f10)">
      <div class="flex justify-center gap-2.5 mb-4">
        <div class="w-[100px] p-2.5 rounded text-center relative" style="background: var(--panel); border: 1px solid var(--sari-red); box-shadow: 0 0 0 1px rgba(217,75,59,.25), 0 0 18px rgba(217,75,59,.15)">
          <div class="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[7px] tracking-wide" style="font-family: var(--font-mono); background: var(--sari-red); color: #1a0a08">TARGET</div>
          <div class="text-[26px] mb-1.5">🧟</div>
          <div class="uppercase text-[10px] mb-1.5" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Shambler</div>
          <div class="h-1.5 rounded overflow-hidden" style="background: #0c1113"><b class="block h-full" :style="{ width: eHp + '%', background: 'linear-gradient(90deg,#7a2e26,#d94b3b)' }" /></div>
          <div class="mt-1 text-[7px] tracking-wide" style="font-family: var(--font-mono); color: var(--muted)">FRONT · in range</div>
        </div>
        <div class="w-[100px] p-2.5 rounded text-center" style="background: var(--panel); border: 1px solid var(--line)">
          <div class="text-[26px] mb-1.5">🧟</div>
          <div class="uppercase text-[10px] mb-1.5" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Shambler</div>
          <div class="h-1.5 rounded overflow-hidden" style="background: #0c1113"><b class="block h-full" style="width: 100%; background: linear-gradient(90deg,#7a2e26,#d94b3b)" /></div>
          <div class="mt-1 text-[7px] tracking-wide" style="font-family: var(--font-mono); color: var(--muted)">REAR · blocked</div>
        </div>
      </div>
      <div class="flex justify-center mb-1.5">
        <div class="w-[150px] p-3 rounded text-center" style="background: var(--panel2); border: 1px solid var(--sodium)">
          <div class="text-[30px] mb-1">🧍</div>
          <div class="uppercase text-xs mb-2" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Juan</div>
          <div class="flex justify-between text-[8px] mt-1 mb-0.5" style="font-family: var(--font-mono); color: var(--muted)"><span>HEALTH</span><span>{{ hHp }}%</span></div>
          <div class="h-1.5 rounded overflow-hidden" style="background: #0c1113"><b class="block h-full" :style="{ width: hHp + '%', background: 'linear-gradient(90deg,#d94b3b,#e88a4a)' }" /></div>
          <div class="flex justify-between text-[8px] mt-1 mb-0.5" style="font-family: var(--font-mono); color: var(--muted)"><span>DREAD</span><span>{{ dread }}%</span></div>
          <div class="h-1.5 rounded overflow-hidden" style="background: #0c1113"><b class="block h-full" :style="{ width: dread + '%', background: 'linear-gradient(90deg,#5c2f6b,var(--dread-bright))' }" /></div>
        </div>
      </div>
    </div>

    <div class="mx-4 my-3 p-2.5 rounded-sm text-[11px] leading-relaxed" style="background: var(--panel); border-left: 3px solid var(--sari-red); font-family: var(--font-mono); color: #cdc6b8; min-height: 44px">{{ log }}</div>
    <div class="mx-4 mb-3 text-[11px]" style="font-family: var(--font-mono); color: var(--muted)">Weapon: <b style="color: var(--bone); font-weight: 400">🔧 Pipe Wrench</b> · durability ▮▮▮ · Attacks the FRONT enemy only</div>
    <div v-if="shaken" class="mx-4 mb-3.5 flex items-center gap-1.5 text-[9px] tracking-wide" style="font-family: var(--font-mono); color: var(--dread-bright)">
      <span class="w-1.5 h-1.5 rounded-full" style="background: var(--dread-bright); box-shadow: 0 0 6px var(--dread-bright)" /> SHAKEN — next Attack has reduced accuracy
    </div>

    <div class="grid grid-cols-2 gap-2.5 mx-4 mb-2">
      <div class="p-3 rounded flex flex-col items-center gap-1" style="background: var(--panel2); border: 1px solid var(--sari-red)" @click="attack">
        <span class="text-lg">⚔️</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Attack</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Hit the front Shambler</span>
      </div>
      <div class="p-3 rounded flex flex-col items-center gap-1" style="background: var(--panel2); border: 1px solid var(--line)" @click="guard">
        <span class="text-lg">🛡️</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Guard</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Halve next hit taken</span>
      </div>
      <div class="p-3 rounded flex flex-col items-center gap-1" style="background: var(--panel2); border: 1px solid var(--line)" @click="useItem">
        <span class="text-lg">🩹</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Use Item</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Bandage · +20% Health</span>
      </div>
      <div class="p-3 rounded flex flex-col items-center gap-1" style="background: var(--panel2); border: 1px solid var(--muted)" @click="retreat">
        <span class="text-lg">🏃</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Retreat</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Flee — risks a free hit</span>
      </div>
    </div>
  </div>
</template>
