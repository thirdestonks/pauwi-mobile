<script setup lang="ts">
// Juan's wristwatch (the painted kit-watch sprite, .art/kit) with its LCD drawn on: the hour (06:00 by day, 18:00 at night, plus
// two hours a move spent), the moves left as segments, and energy as a thin bar. Tap it and the backlight comes on for a moment
// with the numbers spelled out underneath. Down to the last move out there, the screen blinks. Used on the map and in the shelter;
// the parent places and sizes it (32x52 of the screen's own pixels).
import { drawLcd } from '~/utils/juanKit'

const board = useBoardStore()
const player = usePlayerStore()
const ui = useUiStore()
const sfx = useSfx()

const LCD = { x: 8, y: 20, w: 19, h: 12 }                         // where the screen is in the 32x52 sprite (.art/kit/out/kit.json)
const cv = ref<HTMLCanvasElement | null>(null)
const lit = ref(false)
const night = computed(() => board.phase === 'night')
const hour = computed(() => ((night.value ? 18 : 6) + Math.max(0, board.maxMoves - board.moveBudget) * 2) % 24)
const lastMove = computed(() => ui.outInField && board.moveBudget === 1)
const readout = computed(() => `${night.value ? 'NIGHT' : 'DAY'} ${board.dayCount} · ${board.moveBudget} MOVE${board.moveBudget === 1 ? '' : 'S'} · EN ${player.energy}`)

function draw() {
  if (cv.value) drawLcd(cv.value, { night: night.value, lit: lit.value, hour: hour.value, moves: board.moveBudget, maxMoves: board.maxMoves, energy: player.energy })
}
watch(() => [night.value, lit.value, hour.value, board.moveBudget, player.energy], () => nextTick(draw))
onMounted(draw)

let t: ReturnType<typeof setTimeout> | undefined
function press() {
  lit.value = true
  sfx.play('item-pickup', 0.25)
  clearTimeout(t)
  t = setTimeout(() => (lit.value = false), 2600)
}
onBeforeUnmount(() => clearTimeout(t))
</script>

<template>
  <button class="kitwatch" :class="{ lit, blink: lastMove && !lit }" :aria-label="readout" @click="press">
    <img src="/game/kit/out/kit-watch.png" alt="">
    <canvas ref="cv" :width="LCD.w" :height="LCD.h" :style="{ left: `${(LCD.x / 32) * 100}%`, top: `${(LCD.y / 52) * 100}%`, width: `${(LCD.w / 32) * 100}%`, height: `${(LCD.h / 52) * 100}%` }" />
    <span v-if="lit" class="read">{{ readout }}</span>
  </button>
</template>

<style scoped>
.kitwatch { position: relative; padding: 0; background: none; border: 0; cursor: pointer }
.kitwatch img { display: block; width: 100%; height: 100%; image-rendering: pixelated }
.kitwatch canvas { position: absolute; image-rendering: pixelated }
.kitwatch.lit canvas { filter: drop-shadow(0 0 4px #7dffb0) drop-shadow(0 0 1px #7dffb0) }
.kitwatch.blink canvas { animation: blink 1s steps(2) infinite }
@keyframes blink { 50% { opacity: .25 } }
.read { position: absolute; left: 0; top: 100%; margin-top: 2px; padding: 2px 4px; white-space: nowrap; font: 700 10px/1.3 var(--font-mono); letter-spacing: .06em; color: #0b2a16; background: #a8ffc8; box-shadow: 0 0 8px #7dffb099, 2px 2px 0 #000; pointer-events: none; z-index: 2 }
</style>
