<script setup lang="ts">
// End of Demo (the hex-map preview's end screen): the Brute at Tutuban is down. Tutuban at
// dawn behind it, the run's numbers, and one tap replays the whole walkthrough.
const combat = useCombatStore()
const player = usePlayerStore()
const board = useBoardStore()
const ui = useUiStore()
const sfx = useSfx()

const stats = computed(() => [
  ['Days survived', board.dayCount],
  ['Tiles cleared', board.tilesCleared],
  ['Shamblers put down', combat.enemiesDefeated],
  ['In hand', player.weapon.name],
] as const)

onMounted(() => sfx.play('key-collect'))

function startOver() {
  ui.restartRun()
}
</script>

<template>
  <div class="end">
    <h2>END OF DEMO</h2>
    <p>The Brute is down. Tutuban is open.</p>
    <div class="stats">
      <template v-for="[label, value] in stats" :key="label">
        <span>{{ label }}</span><b>{{ value }}</b>
      </template>
    </div>
    <p>The long way home goes on. North Harbor is still out there.</p>
    <button @click="startOver">START OVER</button>
  </div>
</template>

<style scoped>
.end { position: absolute; inset: 0; z-index: 95; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; text-align: center;
  background: #000 url('/game/encounters/src/ui/end-tutuban.png') center / cover no-repeat; image-rendering: pixelated; font: 12px/1.5 var(--font-mono); color: var(--bone) }
h2 { margin: 0; font: 700 34px/1 var(--font-display); letter-spacing: .14em; color: var(--sodium); text-shadow: 3px 3px 0 #3b2412 }
p { margin: 0; max-width: 280px; text-shadow: 2px 2px 0 #000, 0 0 6px #000 }
.stats { display: grid; grid-template-columns: 1fr auto; gap: 4px 18px; padding: 10px 14px; background: #120e0c; border: 3px solid #3b2d22; box-shadow: 4px 4px 0 #000; text-align: left }
.stats b { color: var(--sodium); text-align: right }
button { margin-top: 6px; padding: 12px 28px; background: var(--sodium); color: #0e1214; border: 3px solid #000; box-shadow: 4px 4px 0 #000; font: 700 17px var(--font-display); letter-spacing: 2px }
</style>
