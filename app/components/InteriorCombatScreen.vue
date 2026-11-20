<script setup lang="ts">
// The in-house fight. It is its own screen, not a mode of CombatScreen: inside a house there is exactly one weaker Shambler, already
// in front of Juan, in a dark room lit only by his flashlight. So there is no floor grid, no rows or lanes, nothing to pick, and the
// zombie is drawn as a close-up. The rules still come from the combat store (the same turn loop, hands, hit flash and HUD, via
// useCombatHands / useHitFeedback / CombatHud); this screen only decides what the fight looks like. Native 110x225, shown pixelated.

const combat = useCombatStore()
const W = 110, H = 225
const G_ASSETS = '/game/'

// --- the room: a painted, pixelated interior (combat-bg-interior) lit by the flashlight; the floor is wooden or tiled ---
const roomUrl = `combat-bg-interior/index.html?embed&v=2&floor=${combat.interiorFloor}`

// --- the zombie: one large Shambler (92 px standing, baked by .art/enemies/shambler/build_large.py), feet on the floor in front of Juan ---
interface Meta { sizes: Record<string, { w: number; h: number; px: number; py: number }>; anims: Record<string, number[]>; impact: Record<string, number> }
const SIZE = 92
const FEET = { x: 55, y: 202 }
let meta: Meta | null = null
const sheets: Record<string, HTMLImageElement> = {}
// (?v= so a browser's older copy of this json, from before the large sizes were added, is never reused)
fetch(`${G_ASSETS}enemies/shambler/shambler-anim.json?v=2`).then((r) => r.json()).then((m: Meta) => {
  meta = m
  for (const an of Object.keys(m.anims)) { const im = new Image(); im.src = `${G_ASSETS}enemies/shambler/shambler-h${SIZE}-${an}.png`; sheets[an] = im }
})
let anim = 'idle', fi = 0, ft = 0
function animFor(e: { id: string; dying: boolean }) {
  if (e.dying) return 'death'
  if (combat.swingingEnemyId === e.id) return 'attack'
  if (combat.hitEnemyId === e.id) return 'hit'
  return 'idle'
}

const hands = useCombatHands()
const { flash, shakeX } = useHitFeedback()

// --- over the zombie: its HP bar, and what it means to do next ---
const INTENT_COLOR = { bite: '#d94b3b', advance: '#f0a63c', wait: '#828b90' } as const
let head: [number, number] | null = null
function drawOverhead(g: CanvasRenderingContext2D, e: (typeof combat.enemies)[number], x: number, top: number) {
  const w = 18, bx = Math.round(x - w / 2), by = Math.max(1, Math.round(top - 4))
  g.fillStyle = '#000'; g.fillRect(bx - 1, by - 1, w + 2, 4)
  g.fillStyle = '#3a1512'; g.fillRect(bx, by, w, 2)
  g.fillStyle = '#d94b3b'; g.fillRect(bx, by, Math.max(0, Math.round(w * e.hp / e.maxHp)), 2)
  const intent = combat.intentOf(e), ix = Math.round(x), iy = by - 6
  g.fillStyle = INTENT_COLOR[intent]
  if (intent === 'bite') { g.fillRect(ix - 2, iy, 1, 3); g.fillRect(ix + 1, iy, 1, 3); g.fillRect(ix - 2, iy + 4, 1, 1); g.fillRect(ix + 1, iy + 4, 1, 1) }   // !!
  else if (intent === 'advance') { g.fillRect(ix - 2, iy + 1, 1, 1); g.fillRect(ix - 1, iy + 2, 1, 1); g.fillRect(ix, iy + 3, 1, 1); g.fillRect(ix + 1, iy + 2, 1, 1); g.fillRect(ix + 2, iy + 1, 1, 1) }
  else g.fillRect(ix - 2, iy + 2, 5, 1)
  head = [x, iy]
}
const floatAt = ref<{ x: number; y: number } | null>(null)

const enemyCv = ref<HTMLCanvasElement | null>(null)
const handCv = ref<HTMLCanvasElement | null>(null)

// --- drawing ---
let raf = 0, last = performance.now()
function draw(now: number) {
  const dt = now - last; last = now
  const g = enemyCv.value?.getContext('2d'), hc = handCv.value?.getContext('2d')
  if (g) {
    g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false
    const e = combat.enemies[0]
    if (e && meta) {
      const want = animFor(e)
      if (want !== anim && anim !== 'death') { anim = want; fi = 0; ft = 0 }
      const ms = meta.anims[anim], sz = meta.sizes[SIZE], im = sheets[anim]
      ft += dt
      if (ms && ft >= ms[fi]) { ft = 0; if (fi < ms.length - 1) fi++; else if (anim !== 'death') fi = 0 }
      if (im?.complete && sz) g.drawImage(im, fi * sz.w, 0, sz.w, sz.h, Math.round(FEET.x - sz.px), Math.round(FEET.y - sz.py), sz.w, sz.h)
      if (sz && !e.dying) drawOverhead(g, e, FEET.x, FEET.y - SIZE * 1.05)
    }
    const f = combat.damageFloater
    const at = f?.target === 'enemy' && head ? head : f ? [W / 2, H * 0.62] as [number, number] : null
    if ((at?.[0] ?? -1) !== floatAt.value?.x || (at?.[1] ?? -1) !== floatAt.value?.y) floatAt.value = at ? { x: at[0], y: at[1] } : null
  }
  if (hc) hands.draw(hc, dt)
  raf = requestAnimationFrame(draw)
}
onMounted(() => { raf = requestAnimationFrame(draw) })
onUnmounted(() => { cancelAnimationFrame(raf); combat.stop() })
</script>

<template>
  <div class="flex-1 flex items-center justify-center" style="background:#000">
    <div class="stage" :style="{ transform: `translateX(${shakeX}px)` }">
      <iframe class="layer" :src="G_ASSETS + roomUrl" title="Interior combat background" />
      <canvas ref="enemyCv" class="layer px" :width="W" :height="H" style="pointer-events:none" />
      <canvas ref="handCv" class="layer px" :width="W" :height="H" style="pointer-events:none" />
      <div class="layer" :style="{ background: 'var(--sari-red)', opacity: flash * 0.35, pointerEvents: 'none' }" />

      <CombatHud :picked="null" :float-at="floatAt" />
    </div>
  </div>
</template>

<style scoped>
.stage { position:relative; height:min(100%, 900px); aspect-ratio:110/225; max-width:100%; overflow:hidden; background:#000; }
.layer { position:absolute; inset:0; width:100%; height:100%; border:0; }
.px { image-rendering:pixelated; }
</style>
