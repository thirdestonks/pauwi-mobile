<script setup lang="ts">
import { hydrateRun, loadRawSave } from '~/utils/save'

const ui = useUiStore()

// A saved run turns the title screen into a fork: continue where Juan left off, or start
// the prologue over. Continuing skips straight to the saved screen — the prologue has
// already been lived once.
const savedRun = ref(false)
onMounted(() => {
  savedRun.value = loadRawSave() !== null
})

function continueRun() {
  const blob = loadRawSave()
  if (!blob) {
    savedRun.value = false
    return
  }
  hydrateRun(blob)
  ui.finishPrologue()
}

const PROLOGUE = [
  { eb: 'DAY 0 · ON THE WAY HOME', body: "Another closing shift at Tutuban. Juan punches out and walks home same as every night — until the sirens start, and don't stop.", img: '/images/prologue-1.png' },
  { eb: "DAY 0–13 · NIDA'S BACK ROOM", body: "The broadcast cuts out before it can name where the flight came from. Point of entry: NAIA. Within days, all of Luzon is under lockdown. Juan waits it out, like everyone else.", img: '/images/prologue-2.png' },
  { eb: 'DAY 14 · THE LINE BREAKS', body: 'The checkpoints stop answering. And this morning, for the first time in two years — fog. Juan makes the only plan that still makes sense: stop waiting, get home.', img: '/images/prologue-3.png' },
]

const beat = ref(-1)
const totalSteps = PROLOGUE.length + 1

const currentImage = computed(() => (beat.value === -1 ? '/images/title-screen.png' : PROLOGUE[beat.value].img))
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
  <div class="absolute inset-0 z-[90] flex flex-col items-center justify-end text-center overflow-hidden">
    <img :src="currentImage" class="absolute inset-0 w-full h-full object-cover" style="object-position: center" />
    <div class="absolute inset-0" style="background: linear-gradient(180deg, rgba(7,10,11,.15) 0%, rgba(7,10,11,.45) 45%, rgba(7,10,11,.95) 100%)" />

    <div class="relative z-10 flex flex-col items-center p-8 pb-10">
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
        v-if="savedRun && beat === -1"
        class="mt-2.5 px-8 py-3 rounded-md uppercase"
        style="background: transparent; border: 1px solid var(--sodium); color: var(--sodium); font-family: var(--font-display); font-weight: 700; letter-spacing: 2px; font-size: 13px"
        @click="continueRun"
      >
        Continue run →
      </button>

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
  </div>
</template>
