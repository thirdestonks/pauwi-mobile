<script setup lang="ts">
// The demo's finish line: Juan made Tutuban. Mirrors DeathScreen's anatomy — the run
// ends, the numbers tell the story, and one tap replays the whole walkthrough.
const combat = useCombatStore()
const player = usePlayerStore()
const board = useBoardStore()
const ui = useUiStore()

const stats = computed(() => [
  { label: 'Days on the road', value: String(board.dayCount).padStart(2, '0') },
  { label: 'Tiles crossed', value: String(board.tilesCleared).padStart(2, '0') },
  { label: 'Shamblers put down', value: String(combat.enemiesDefeated).padStart(2, '0') },
])

function runItBack() {
  ui.restartRun()
}
</script>

<template>
  <div class="absolute inset-0 z-[95] flex flex-col items-center justify-center text-center px-7" style="background: radial-gradient(120% 90% at 50% 45%, rgba(10,18,24,.92) 0%, rgba(5,7,8,.98) 70%)">
    <div class="w-full max-w-[340px]">
      <div class="text-[10px] tracking-[3px] mb-4" style="font-family: var(--font-mono); color: var(--sari-blue)">· THE TRACKS RUN NORTH ·</div>

      <div class="relative p-4 py-5" style="transform: rotate(.5deg); background: linear-gradient(180deg,#2e86ab,#1d5f7e); border: 3px solid #123c50; box-shadow: 0 6px 0 rgba(0,0,0,.45), inset 0 0 0 2px rgba(242,201,76,.4)">
        <div class="absolute top-0 left-0 right-0 h-1.5" style="background: repeating-linear-gradient(90deg, var(--sari-yel) 0 14px, #123c50 14px 28px)" />
        <h1 class="uppercase leading-none mt-2" style="font-family: var(--font-display); font-weight: 700; font-size: 34px; letter-spacing: 1px; color: #fff5e0; text-shadow: 2px 2px 0 rgba(0,0,0,.35)">He caught<br>the way out</h1>
      </div>

      <p class="text-[13px] leading-relaxed mt-5" style="color: #cdc6b8">
        The yard is silent, but the tracks still run north and the fog ends somewhere past the last platform.
        <b style="color: var(--bone)">Juan is pauwi — on the long way home.</b>
      </p>

      <div class="grid grid-cols-3 gap-2 mt-6">
        <div v-for="stat in stats" :key="stat.label" class="p-2.5" style="background: var(--panel); border: 1px solid var(--line); box-shadow: 0 3px 0 rgba(0,0,0,.3)">
          <div class="text-xl" style="font-family: var(--font-mono); color: var(--sodium)">{{ stat.value }}</div>
          <div class="text-[8px] uppercase tracking-wide mt-1" style="font-family: var(--font-mono); color: var(--muted)">{{ stat.label }}</div>
        </div>
      </div>

      <button
        class="mt-7 py-3.5 w-full uppercase text-lg"
        style="background: var(--sodium); border: 2px solid #c9821f; box-shadow: 0 4px 0 rgba(0,0,0,.4); font-family: var(--font-display); font-weight: 700; letter-spacing: 2px; color: #0e1214"
        @click="runItBack"
      >Run it back →</button>

      <div class="text-[10px] mt-3" style="font-family: var(--font-mono); color: var(--muted)">Demo complete. A new route, new shelters, the same fog.</div>
    </div>
  </div>
</template>
