<script setup lang="ts">
// The street combat (ported from .art/juan-hands). Everything that happens comes from the combat store; this screen only draws it:
// a live background scene, the 3x3 floor grid with the dead on it, and Juan's first-person hands. The turn banner, meters, log,
// menus and buttons are CombatHud, shared with InteriorCombatScreen (fights inside a house get their own screen). Native 110x225
// canvases, shown pixelated.

const combat = useCombatStore()
const W = 110, H = 225
const G_ASSETS = '/game/'

// --- the scene: a random background from the fight's day/night pool, each with its own floor perspective ---
interface Geo { hy: number; vx: number; e: number; f: number; cx: number; lane: number }
const SCENES: Record<'day' | 'night', [string, Geo][]> = {
  day: [
    ['combat-bg-day/index.html?embed', { hy: 150, vx: 54, e: 88, f: 55, cx: 0, lane: 1.0 }],
    ['combat-bg-urban/index.html?embed&v=2&mode=day', { hy: 128, vx: 55, e: 92.8, f: 58, cx: 0, lane: 1.3 }],
  ],
  night: [
    ['combat-bg-night/index.html?embed', { hy: 150, vx: 55, e: 88, f: 55, cx: 0.1, lane: 1.15 }],
    ['combat-bg-urban/index.html?embed&v=2&mode=night#rain', { hy: 128, vx: 55, e: 92.8, f: 58, cx: 0, lane: 1.3 }],
  ],
}
const pool = SCENES[combat.fightPhase]
const [sceneUrl, G] = pool[Math.floor(Math.random() * pool.length)]
const sfx = useSfx()
sfx.bed('rain-1', sceneUrl.includes('rain'), 0.25)

const ROWS = [1.5, 2.5, 4.2, 7.5]                                   // depth edges, near → far: CLOSE | MID | FAR
const rowC = (i: number) => (ROWS[i] + ROWS[i + 1]) / 2
const proj = (X: number, z: number) => [G.vx + G.f * X / z, G.hy + G.e / z] as const
const laneX = (i: number) => G.cx + (i - 1.5) * G.lane

const gridCv = ref<HTMLCanvasElement | null>(null)
const handCv = ref<HTMLCanvasElement | null>(null)
const picked = ref<string | null>(null)                              // the enemy Juan means to hit

// --- enemy sprites (same format for the Shambler and the Brute; the Brute's sizes are 1.5x) ---
interface Meta { sizes: Record<string, { w: number; h: number; px: number; py: number }>; anims: Record<string, number[]>; impact: Record<string, number> }
const SIZES: Record<string, number[]> = { shambler: [16, 22, 29, 38, 48, 60], brute: [24, 33, 44, 57, 72, 90] }
const metas: Record<string, Meta> = {}
const sheets: Record<string, HTMLImageElement> = {}
for (const kind of new Set(combat.enemies.map((e) => e.archetype))) {
  fetch(`${G_ASSETS}enemies/${kind}/${kind}-anim.json`).then((r) => r.json()).then((m: Meta) => {
    metas[kind] = m
    for (const h of SIZES[kind] ?? SIZES.shambler) for (const an of Object.keys(m.anims)) {
      const im = new Image(); im.src = `${G_ASSETS}enemies/${kind}/${kind}-h${h}-${an}.png`; sheets[kind + h + an] = im
    }
  })
}
// each enemy's on-screen state: an eased position along the rows, and its current animation
const view = new Map<string, { pos: number; anim: string; fi: number; ft: number }>()
function animFor(e: { id: string; dying: boolean }) {
  if (e.dying) return 'death'
  if (combat.swingingEnemyId === e.id) return 'attack'
  if (combat.hitEnemyId === e.id) return 'hit'
  return 'idle'
}

// --- Juan's hands and the hit flash/shake (shared with the interior fight) ---
const hands = useCombatHands()
const { flash, shakeX } = useHitFeedback()

// --- over each enemy: an HP bar, and what it means to do next ---
const INTENT_COLOR = { bite: '#d94b3b', advance: '#f0a63c', wait: '#828b90' } as const
function drawOverhead(g: CanvasRenderingContext2D, e: (typeof combat.enemies)[number], x: number, top: number) {
  const w = e.archetype === 'brute' ? 18 : 12, bx = Math.round(x - w / 2), by = Math.max(1, Math.round(top - 4))
  g.fillStyle = '#000'; g.fillRect(bx - 1, by - 1, w + 2, 4)
  g.fillStyle = '#3a1512'; g.fillRect(bx, by, w, 2)
  g.fillStyle = '#d94b3b'; g.fillRect(bx, by, Math.max(0, Math.round(w * e.hp / e.maxHp)), 2)
  const intent = combat.intentOf(e), ix = Math.round(x), iy = by - 6
  g.fillStyle = INTENT_COLOR[intent]
  if (intent === 'bite') { g.fillRect(ix - 2, iy, 1, 3); g.fillRect(ix + 1, iy, 1, 3); g.fillRect(ix - 2, iy + 4, 1, 1); g.fillRect(ix + 1, iy + 4, 1, 1) }   // !!
  else if (intent === 'advance') { g.fillRect(ix - 2, iy + 1, 1, 1); g.fillRect(ix - 1, iy + 2, 1, 1); g.fillRect(ix, iy + 3, 1, 1); g.fillRect(ix + 1, iy + 2, 1, 1); g.fillRect(ix + 2, iy + 1, 1, 1) }  // ⌄ coming closer
  else g.fillRect(ix - 2, iy + 2, 5, 1)                                                                                          // – held up
  heads.set(e.id, [x, iy])
}
/** Where each enemy's head was last drawn (native pixels), for the damage popups. */
const heads = new Map<string, [number, number]>()
const floatAt = ref<{ x: number; y: number } | null>(null)

// --- drawing ---
let raf = 0, last = performance.now()
function draw(now: number) {
  const dt = now - last; last = now
  const g = gridCv.value?.getContext('2d'), hc = handCv.value?.getContext('2d')
  if (g) {
    g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false
    // the floor grid; the picked cell glows
    g.strokeStyle = 'rgba(236,228,213,.55)'; g.lineWidth = 1
    for (const z of ROWS) { const [xa, y] = proj(laneX(0), z), [xb] = proj(laneX(3), z); g.beginPath(); g.moveTo(xa, Math.round(y) + 0.5); g.lineTo(xb, Math.round(y) + 0.5); g.stroke() }
    for (let i = 0; i <= 3; i++) { const [xa, ya] = proj(laneX(i), ROWS[0]), [xb, yb] = proj(laneX(i), ROWS[3]); g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, yb); g.stroke() }
    const target = combat.enemies.find((e) => e.id === picked.value && !e.dying)
    if (target) {
      const [xa, ya] = proj(laneX(target.lane), ROWS[target.row]), [xb] = proj(laneX(target.lane + 1), ROWS[target.row])
      const [xc, yc] = proj(laneX(target.lane), ROWS[target.row + 1]), [xd] = proj(laneX(target.lane + 1), ROWS[target.row + 1])
      g.fillStyle = 'rgba(240,166,60,.35)'; g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, ya); g.lineTo(xd, yc); g.lineTo(xc, yc); g.closePath(); g.fill()
    }
    // the dead, far ones first, at the baked height nearest their depth; feet on the cell centre
    const order = [...combat.enemies].sort((a, b) => (view.get(b.id)?.pos ?? b.row) - (view.get(a.id)?.pos ?? a.row))
    for (const e of order) {
      const m = metas[e.archetype]; if (!m) continue
      let v = view.get(e.id); if (!v) { v = { pos: e.row, anim: 'idle', fi: 0, ft: 0 }; view.set(e.id, v) }
      v.pos += Math.sign(e.row - v.pos) * Math.min(Math.abs(e.row - v.pos), dt / 700)   // ease a step forward over 700 ms
      const want = animFor(e)
      if (want !== v.anim && !(v.anim === 'death')) { v.anim = want; v.fi = 0; v.ft = 0 }
      const ms = m.anims[v.anim]; v.ft += dt
      if (ms && v.ft >= ms[v.fi]) { v.ft = 0; if (v.fi < ms.length - 1) v.fi++; else if (v.anim !== 'death') v.fi = 0 }
      const i0 = Math.floor(v.pos), i1 = Math.min(2, i0 + 1), q = v.pos - i0
      const z = rowC(i0) + (rowC(i1) - rowC(i0)) * q, X = (laneX(e.lane) + laneX(e.lane + 1)) / 2
      const [fx, fy] = proj(X, z), h = 1.65 * G.f / z * (e.archetype === 'brute' ? 1.5 : 1)
      const sizes = SIZES[e.archetype] ?? SIZES.shambler
      const best = sizes.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a)), sz = m.sizes[best], im = sheets[e.archetype + best + v.anim]
      if (im?.complete && sz) g.drawImage(im, v.fi * sz.w, 0, sz.w, sz.h, Math.round(fx - sz.px), Math.round(fy - sz.py), sz.w, sz.h)
      if (sz && !e.dying) drawOverhead(g, e, fx, fy - h * 1.05)
    }
    const f = combat.damageFloater
    const at = f?.target === 'enemy' && f.id ? heads.get(f.id) : f ? [W / 2, H * 0.62] as [number, number] : null
    if ((at?.[0] ?? -1) !== floatAt.value?.x || (at?.[1] ?? -1) !== floatAt.value?.y) floatAt.value = at ? { x: at[0], y: at[1] } : null
  }
  if (hc) hands.draw(hc, dt)
  raf = requestAnimationFrame(draw)
}
onMounted(() => { raf = requestAnimationFrame(draw) })
onUnmounted(() => { cancelAnimationFrame(raf); combat.stop(); sfx.bed('rain-1', false) })

// tap the floor to pick who to hit
function onGridTap(ev: PointerEvent) {
  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H
  if (y <= G.hy) return
  const z = G.e / (y - G.hy), X = (x - G.vx) * z / G.f
  const row = ROWS.findIndex((e, i) => i < 3 && z >= e && z < ROWS[i + 1]), lane = Math.floor((X - laneX(0)) / G.lane)
  const hit = combat.livingEnemies.find((e) => e.row === row && e.lane === lane)
  picked.value = hit ? hit.id : null
}
</script>

<template>
  <div class="flex-1 flex items-center justify-center" style="background:#000">
    <div class="stage" :style="{ transform: `translateX(${shakeX}px)` }">
      <iframe class="layer" :src="G_ASSETS + sceneUrl" title="Combat background" />
      <canvas ref="gridCv" class="layer px tap" :width="W" :height="H" @pointerdown="onGridTap" />
      <canvas ref="handCv" class="layer px" :width="W" :height="H" style="pointer-events:none" />
      <div class="layer" :style="{ background: 'var(--sari-red)', opacity: flash * 0.35, pointerEvents: 'none' }" />

      <CombatHud :picked="picked" :float-at="floatAt" />
    </div>
  </div>
</template>

<style scoped>
.stage { position:relative; height:min(100%, 900px); aspect-ratio:110/225; max-width:100%; overflow:hidden; background:#000; }
.layer { position:absolute; inset:0; width:100%; height:100%; border:0; }
.px { image-rendering:pixelated; }
.tap { cursor:crosshair; }
</style>
