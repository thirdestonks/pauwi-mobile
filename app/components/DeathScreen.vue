<script setup lang="ts">
// The run's fail state. One restart call puts every store back on its feet.
const combat = useCombatStore()
const player = usePlayerStore()
const board = useBoardStore()
const house = useHouseStore()
const ui = useUiStore()

const stats = computed(() => [
  { label: 'Days survived', value: String(board.dayCount).padStart(2, '0') },
  { label: 'Tiles cleared', value: String(board.tilesCleared).padStart(2, '0') },
  { label: 'Shamblers put down', value: String(combat.enemiesDefeated).padStart(2, '0') },
  { label: 'Houses searched', value: String(Object.values(house.saved).filter((h) => (h.used ?? 0) > 0).length).padStart(2, '0') },
])
/** What got him: the fight's last line if he died fighting, else the hunger. */
const cause = computed(() => {
  const line = combat.log[combat.log.length - 1]
  if (combat.outcome === 'lost' && line) return line
  if (player.food <= 0) return 'The hunger did it, a little every night.'
  return line ?? 'Nobody saw how.'
})

function tryAgain() {
  ui.restartRun()
}
</script>

<template>
  <div class="absolute inset-0 z-[95] flex flex-col items-center justify-center text-center px-7" style="background: radial-gradient(120% 90% at 50% 45%, rgba(20,10,9,.92) 0%, rgba(5,7,8,.98) 70%)">
    <div class="w-full max-w-[340px]">
      <div class="text-[10px] tracking-[3px] mb-4" style="font-family: var(--font-mono); color: var(--sari-red)">· THE FOG TAKES ANOTHER ONE ·</div>

      <div class="relative p-4 py-5" style="transform: rotate(-.5deg); background: linear-gradient(180deg,#c23a2c,#a82e22); border: 3px solid #7c2018; box-shadow: 0 6px 0 rgba(0,0,0,.45), inset 0 0 0 2px rgba(242,201,76,.4)">
        <div class="absolute top-0 left-0 right-0 h-1.5" style="background: repeating-linear-gradient(90deg, var(--sari-yel) 0 14px, #7c2018 14px 28px)" />
        <h1 class="uppercase leading-none mt-2" style="font-family: var(--font-display); font-weight: 700; font-size: 34px; letter-spacing: 1px; color: #fff5e0; text-shadow: 2px 2px 0 rgba(0,0,0,.35)">He never<br>made it home</h1>
      </div>

      <p class="text-[13px] leading-relaxed mt-5" style="color: #cdc6b8">
        Juan goes down on the pavement and the fog closes over the rest of it.
        <b style="color: var(--bone)">North Harbor stays where it was.</b>
      </p>

      <p class="text-[11px] leading-relaxed mt-3 px-3 py-2" style="font-family: var(--font-mono); color: #ffb3a8; background: #1a0d0b; border: 1px solid #5a1f18">{{ cause }}</p>

      <div class="grid grid-cols-2 gap-2 mt-4">
        <div v-for="stat in stats" :key="stat.label" class="p-2.5" style="background: var(--panel); border: 1px solid var(--line); box-shadow: 0 3px 0 rgba(0,0,0,.3)">
          <div class="text-xl" style="font-family: var(--font-mono); color: var(--sodium)">{{ stat.value }}</div>
          <div class="text-[8px] uppercase tracking-wide mt-1" style="font-family: var(--font-mono); color: var(--muted)">{{ stat.label }}</div>
        </div>
      </div>

      <button
        class="mt-7 py-3.5 w-full uppercase text-lg"
        style="background: var(--sodium); border: 2px solid #c9821f; box-shadow: 0 4px 0 rgba(0,0,0,.4); font-family: var(--font-display); font-weight: 700; letter-spacing: 2px; color: #0e1214"
        @click="tryAgain"
      >Try again →</button>

      <div class="text-[10px] mt-3" style="font-family: var(--font-mono); color: var(--muted)">Back to Day 01 at Nida's. The story doesn't change — your odds do.</div>
    </div>
  </div>
</template>
