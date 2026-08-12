<script setup lang="ts">
const ui = useUiStore()

const PROLOGUE = [
  { eb: 'DAY 0 · TUTUBAN STOCKROOM', body: "Another closing shift. Juan racks the last pallet, punches out, and heads for the jeepney stop — same as every night for two years." },
  { eb: 'DAY 0 · ON THE WAY HOME', body: "Sirens past Dagupan Street. Then more. An ambulance convoy runs the red at C-3 with no siren left to spare. Juan doesn't stop to look." },
  { eb: "DAY 0 · NIDA'S BACK ROOM", body: "The news cuts out before it can name the country the flight came from. Point of entry: NAIA Terminal 3. It's already past the tarmac." },
  { eb: 'DAYS 1–13 · QUARANTINE', body: 'All of Luzon goes under lockdown within days. Relief trucks roll through Tondo every few nights — rice, canned goods, bottled water. Juan waits it out, like everyone else.' },
  { eb: 'DAY 14 · THE LINE BREAKS', body: 'The checkpoints stop answering. Metro Manila can\'t hold anymore. And this morning, for the first time in two years — fog. Juan makes the only plan that still makes sense: stop waiting, get home.' },
]

const beat = ref(-1)
const totalSteps = PROLOGUE.length + 1

const buttonLabel = computed(() => (beat.value === PROLOGUE.length - 1 ? 'BEGIN' : 'CONTINUE'))

function advance() {
  if (beat.value < PROLOGUE.length - 1) {
    beat.value++
  } else {
    ui.finishPrologue()
  }
}
</script>

<template>
  <div class="absolute inset-0 z-[90] flex flex-col items-center justify-center text-center p-8" style="background: radial-gradient(120% 90% at 50% 20%, #1a120a, #070a0b)">
    <template v-if="beat === -1">
      <div class="text-[10px] tracking-[4px] mb-5" style="font-family: var(--font-mono); color: var(--sodium)">TONDO, MANILA</div>
      <h1 class="text-[54px] leading-[0.9] uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 3px; color: var(--bone); text-shadow: 0 0 30px rgba(240,166,60,.2)">PAUWI</h1>
      <div class="text-[11px] mt-2.5 tracking-[3px]" style="font-family: var(--font-mono); color: var(--muted)">/ the long way home /</div>
      <p class="text-sm leading-relaxed mt-5 max-w-[310px]" style="color: #cdc6b8">Before the fog. Before the fourteen days. This is where it started.</p>
    </template>

    <template v-else>
      <div class="max-w-[310px] flex flex-col items-center">
        <div class="text-[10px] tracking-[3px] mb-4" style="font-family: var(--font-mono); color: var(--sari-blue)">{{ PROLOGUE[beat].eb }}</div>
        <p class="text-base leading-loose" style="color: var(--bone)">{{ PROLOGUE[beat].body }}</p>
      </div>
    </template>

    <button
      class="mt-6 px-8 py-3.5 rounded-md uppercase"
      style="background: var(--sodium); color: var(--night); font-family: var(--font-display); font-weight: 700; letter-spacing: 2px; font-size: 15px"
      @click="advance"
    >
      {{ buttonLabel }}
    </button>

    <div class="flex gap-1.5 mt-6">
      <i
        v-for="i in totalSteps"
        :key="i"
        class="w-1.5 h-1.5 rounded-full"
        :style="{ background: i - 1 === beat + 1 ? 'var(--sodium)' : '#2a343a' }"
      />
    </div>
  </div>
</template>
