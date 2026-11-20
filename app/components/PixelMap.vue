<script setup lang="ts">
// The pixel hex map (DESIGN.md "Map screen"): the Tondo renderer on a 110×225 canvas shown
// pixelated, with the top-down flashlight Juan. Tap a neighbouring hex to step (fresh ground
// costs a move), or a cleared hex two or three away (lit by a slow beam) to dash along the
// green path for free. The step plays out on the canvas first and only then lands in the
// board store, so the tile's card opens when Juan actually arrives. A tap starts moving.
// The interface is Juan's kit (.art/map-ui, concept B), drawn on the map itself: the wristwatch (day, hour, moves, energy), the
// compass to Tutuban, the bag, the shelter key (home), and the phone peeking up from the bottom edge (PhoneMap.vue). What a tap
// would cost shows as a subtitle that fades.
import { createTondoRenderer, W, H, type MapFrameState } from '~/utils/tondoRender'
import { drawKey, drawNeedle } from '~/utils/juanKit'
import { LM, content as tileContent } from '~/utils/tondo'
import { hash, hexDist } from '~/utils/tondo'
import { houseProgress } from '~/utils/phoneMap'
import type { AxialCoord } from '~/utils/hex'
import { WEIGHT_ART } from '~/data/weight'

const board = useBoardStore()
const house = useHouseStore()
const player = usePlayerStore()
const inventory = useInventoryStore()
// The bag object fills up with what Juan carries (data/weight.ts): slack, half, overloaded. Past Carrying it shows its kilos.
const bagSprite = computed(() => `${WEIGHT_ART}${inventory.load.bag}.png`)
const heavy = computed(() => inventory.load.id === 'loaded' || inventory.load.id === 'over')
const sfx = useSfx()
const emit = defineEmits<{ home: []; bag: [] }>()
const encounter = useEncounterScene()

const canvas = ref<HTMLCanvasElement | null>(null)
const status = ref('TAP AN OPEN HEX TO WALK')
watch(() => inventory.load.id, (now, was) => {
  if (!was || now === was) return
  const l = inventory.load
  status.value = `${l.name.toUpperCase()} · ${inventory.carriedKg} KG · ${l.line.toUpperCase()}`
})
let renderer: ReturnType<typeof createTondoRenderer> | null = null
let raf = 0
const busy = ref(false)

// Juan's hex as the renderer sees it: it trails the store while a step is still playing.
const shown = reactive({ q: board.playerPos.q, r: board.playerPos.r })
const visited = computed(() => {
  const s = new Set<string>()
  for (const t of board.tiles.values()) if (t.cleared) s.add(`${t.q},${t.r}`)
  return s
})
const night = computed(() => board.phase === 'night')
// Some nights it rains: rolled from the day so a reload brings back the same weather.
const rain = computed(() => night.value && hash(board.dayCount, 0, 77) > 0.4)

// Cleared hexes that held something keep its prop: dimmed when dealt with, as-is while it waits.
type Prop = 'bag' | 'body' | 'radio' | 'supply'
const PROP: Record<string, Prop> = { zombie: 'body', loot: 'bag', car: 'supply', event: 'radio' }
const marks = computed(() => {
  const m = new Map<string, { prop: Prop; live: boolean }>()
  for (const t of board.tiles.values()) {
    const prop = t.cleared && t.content ? PROP[t.content] : undefined
    if (prop) m.set(`${t.q},${t.r}`, { prop, live: !t.resolved })
  }
  return m
})

// Houses with a door change how it looks once it is pried open or searched.
const houses = computed(() => {
  const m = new Map<string, 'open' | 'locked' | 'boarded' | 'done'>()
  for (const t of board.tiles.values()) {
    if (t.content !== 'house') continue
    const state = t.resolved ? 'done' : t.unlocked ? 'open' : undefined
    if (state) m.set(`${t.q},${t.r - 1}`, state)
  }
  return m
})

function frameState(): MapFrameState {
  return {
    jq: shown.q, jr: shown.r, home: board.home, night: night.value, rain: rain.value, visited: visited.value,
    dash: busy.value ? undefined : board.dashTargets, marks: marks.value, houses: houses.value, pins: new Set(board.pins), trader: board.traderPos,
  }
}

/** Juan has his phone out (PhoneMap.vue): the map underneath takes no taps. */
const phoneOut = ref(false)

// Anything else that moves Juan (heading home, a teleport, claiming a shelter, a load) snaps the camera.
watch(() => [board.playerPos.q, board.playerPos.r] as const, ([q, r]) => {
  if (busy.value) return
  shown.q = q
  shown.r = r
  renderer?.snap(q, r)
})

async function stepTo(to: AxialCoord, ms = 760) {
  if (!renderer) return
  sfx.play('juan-walkstep-map', 0.8)
  await renderer.walkTo(shown.q, shown.r, to.q, to.r, ms)
  shown.q = to.q
  shown.r = to.r
}

function hexAt(e: PointerEvent): AxialCoord {
  const rect = canvas.value!.getBoundingClientRect()
  const [q, r] = renderer!.pixelHex(((e.clientX - rect.left) * W) / rect.width, ((e.clientY - rect.top) * H) / rect.height)
  return { q, r }
}

/** What stepping onto a hex would cost, in the status line's words (null: can't go there). */
function costLine(to: AxialCoord): string | null {
  const cost = board.stepCost(to)
  if (cost === 'free') return 'STEP · FREE'
  if (cost === 'move') return `STEP · 1 MOVE · ${board.energyPerFreshMove} EN`
  if (cost === 'no-moves') return 'OUT OF MOVES · CLEARED GROUND IS STILL FREE'
  if (cost === 'tired') return 'TOO TIRED FOR FRESH GROUND · EAT OR SLEEP'
  if (board.dashPath(to)) return 'DASH · FREE'
  return null
}

const idleLine = () => (board.moveBudget > 0 ? 'TAP AN OPEN HEX TO WALK' : 'OUT OF MOVES · HEAD BACK TO SHELTER')
const blocked = () => !renderer || busy.value || phoneOut.value || !!board.activeCard || !!encounter.scene.value || encounter.door.shown || renderer.walking()

// hovering with a mouse: the cost of where the pointer is
function hover(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || blocked()) return
  status.value = costLine(hexAt(e)) ?? idleLine()
}

let holdT: ReturnType<typeof setTimeout> | undefined
let held = false
function down(e: PointerEvent) {
  if (blocked()) return
  held = false
  const to = hexAt(e)
  clearTimeout(holdT)
  holdT = setTimeout(() => {
    held = true
    const hp = houseProgress(to.q, to.r, board.tiles, house.saved)
    status.value = costLine(to) ?? (hp ? hp.line.toUpperCase() : to.q === shown.q && to.r === shown.r ? idleLine() : 'TOO FAR · OR NOT A STREET')
  }, 380)
}
function cancelHold() { clearTimeout(holdT); held = false }
function up(e: PointerEvent) {
  clearTimeout(holdT)
  if (held) { held = false; return }                                   // that was a look, not a step
  tap(e)
}
/** A step into a Shambler's tile with little Health left asks first: the hex the warning was about. */
let warned: string | null = null

async function tap(e: PointerEvent) {
  if (blocked()) return
  const to = hexAt(e)
  const cost = board.stepCost(to)
  const path = cost ? null : board.dashPath(to)
  if (cost === 'no-moves' || cost === 'tired') { status.value = costLine(to)!; return }
  if (!cost && !path) {
    // a house with a door, close enough to see: say how far Juan has got with it
    const hp = hexDist(to.q, to.r, shown.q, shown.r) <= 3 ? houseProgress(to.q, to.r, board.tiles, house.saved) : null
    if (hp) { status.value = `${hp.door === 'locked' ? 'LOCKED · ' : ''}${hp.line.toUpperCase()}`; return }
    status.value = to.q === shown.q && to.r === shown.r ? idleLine() : 'TOO FAR · OR NOT A STREET'
    return
  }
  // low on Health and the next hex holds a body: say so once, and step in only on a second tap
  const key = `${to.q},${to.r}`
  const what = board.getTile(to)?.content ?? tileContent(to.q, to.r, board.home)
  if (!path && what === 'zombie' && !board.getTile(to)?.cleared && player.health <= 35 && warned !== key) {
    warned = key
    status.value = `LOW HEALTH (${player.health}) · SOMETHING WAITS THERE · TAP AGAIN TO STEP IN`
    return
  }
  warned = null
  busy.value = true
  try {
    if (path) {
      for (const hex of path) await stepTo(hex)
      board.dashTo(to)
    } else {
      await stepTo(to)
      board.moveTo(to)
    }
  } finally {
    busy.value = false
    shown.q = board.playerPos.q
    shown.r = board.playerPos.r
    status.value = idleLine()
  }
}

// Returning waits for a committed step so its encounter cannot open behind the door.
defineExpose({ moving: busy })

// --- Juan's kit ---
const needleCv = ref<HTMLCanvasElement | null>(null)
const keyCv = ref<HTMLCanvasElement | null>(null)
/** The compass points at Tutuban, or (tap it) at the nearest shelter Juan could still claim. */
const toShelter = ref(false)
const nearestShelter = computed(() => board.waypoints.filter((w) => !w.isTutuban && w.key && w.key !== board.home && !w.claimed)
  .sort((a, b) => hexDist(a.pos.q, a.pos.r, board.playerPos.q, board.playerPos.r) - hexDist(b.pos.q, b.pos.r, board.playerPos.q, board.playerPos.r))[0] ?? null)
const target = computed(() => (toShelter.value && nearestShelter.value ? nearestShelter.value.pos : LM))
const targetLabel = computed(() => toShelter.value && nearestShelter.value
  ? `${nearestShelter.value.name.split(' ')[0]!.replace(/'s$/i, '').toUpperCase()} ${hexDist(target.value.q, target.value.r, board.playerPos.q, board.playerPos.r)}`
  : `TUTUBAN ${board.distanceToTutuban}`)
/** The target's direction on screen (the map is squashed, so the vertical is too). */
const targetAngle = computed(() => {
  const dq = target.value.q - board.playerPos.q, dr = target.value.r - board.playerPos.r
  return Math.atan2(Math.sqrt(3) * (dr + dq / 2) * 0.62, 1.5 * dq)
})
function flipCompass() {
  if (!nearestShelter.value) { status.value = 'NO SHELTER LEFT TO CLAIM · TUTUBAN IT IS'; return }
  toShelter.value = !toShelter.value
  sfx.play('item-pickup', 0.3)
  status.value = toShelter.value ? `COMPASS · ${nearestShelter.value.name.toUpperCase()}` : 'COMPASS · TUTUBAN'
}
/** The phone cracks as Juan gets hurt (five crack levels, lightest at full Health). */
const crack = computed(() => (player.health > 80 ? 0 : player.health > 60 ? 1 : player.health > 40 ? 2 : player.health > 20 ? 3 : 4))
/** A radio tip on the phone that Juan hasn't looked at yet. */
const phoneNews = computed(() => board.caches.some((c) => !c.found && !c.seen))
function openPhone() { phoneOut.value = true; board.markCachesSeen() }
function drawKit() {
  if (needleCv.value) drawNeedle(needleCv.value, targetAngle.value, 11.6, 11.7, 7)
  if (keyCv.value) drawKey(keyCv.value)
}
watch(() => [targetAngle.value, phoneOut.value], () => nextTick(drawKit))
// the status line is a subtitle: it shows, then fades
const subtitleOn = ref(true)
let subT: ReturnType<typeof setTimeout> | undefined
watch(status, () => { subtitleOn.value = true; clearTimeout(subT); subT = setTimeout(() => (subtitleOn.value = false), 2400) }, { immediate: true })

let last = 0
function loop(T: number) {
  const dt = last ? Math.min(50, T - last) : 0
  last = T
  if (renderer) {
    renderer.tick(dt)
    renderer.draw(T, frameState())
  }
  sfx.bed('rain-1', rain.value, 0.22)
  sfx.bed('day-sound', !night.value, 0.5)
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  renderer = createTondoRenderer(canvas.value!)
  renderer.snap(shown.q, shown.r)
  raf = requestAnimationFrame(loop)
  drawKit()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  sfx.bed('rain-1', false)
  sfx.bed('day-sound', false)
})
</script>

<template>
  <div class="pixel-map">
    <canvas ref="canvas" class="stage" :width="W" :height="H" aria-label="Tondo. Tap a neighbouring hex to walk; press and hold to see what it costs." @pointerdown="down" @pointerup="up" @pointerleave="cancelHold" @pointermove="hover" @contextmenu.prevent />
    <template v-if="!phoneOut">
      <KitWatch class="kit watch" />
      <button class="kit compass" :aria-label="`Compass: ${targetLabel}. Tap to switch between Tutuban and the nearest shelter.`" @click="flipCompass">
        <img src="/game/kit/out/kit-compass.png" alt=""><canvas ref="needleCv" width="24" height="24" />
      </button>
      <div class="kit compass-n" :class="{ shelter: toShelter && nearestShelter }">{{ targetLabel }}</div>
      <div class="kit subtitle" :class="{ on: subtitleOn }">{{ status }}</div>
      <button class="kit bag" :class="{ heavy, over: inventory.load.id === 'over' }" :aria-label="`Open the bag: ${inventory.load.name}, ${inventory.carriedKg} kg`" @click="emit('bag')"><img :src="bagSprite" alt=""></button>
      <div v-if="heavy" class="kit kg" :class="{ over: inventory.load.id === 'over' }">{{ inventory.carriedKg }} KG</div>
      <button class="kit key" :class="{ pulse: board.moveBudget <= 0 }" aria-label="Head back to shelter" @click="emit('home')"><canvas ref="keyCv" width="18" height="24" /></button>
      <button class="kit phone" :aria-label="phoneNews ? 'Check the map on Juan\'s phone: something new' : 'Check the map on Juan\'s phone'" @click="openPhone">
        <img :src="`/game/kit/out/kit-phone-${crack}.png`" alt=""><i v-if="phoneNews" class="news" />
      </button>
    </template>
    <PhoneMap v-if="phoneOut" @close="phoneOut = false" />
  </div>
</template>

<style scoped>
.pixel-map { position: relative; height: 100%; aspect-ratio: 110 / 225; max-width: 100%; margin: 0 auto; background: #0e1214 }
.pixel-map .stage { display: block; width: 100%; height: 100%; image-rendering: pixelated; touch-action: none; cursor: pointer }
.pixel-map { container-type: size }
/* the kit, placed in the map's own 110x225 pixels (g = one of them) */
.kit { --g: calc(100cqw / 110); position: absolute; image-rendering: pixelated }
button.kit { padding: 0; background: none; border: 0; cursor: pointer }
.kit canvas, .kit img { display: block; width: 100%; height: 100%; image-rendering: pixelated }
.watch { left: calc(1 * var(--g)); top: calc(-6 * var(--g)); width: calc(32 * var(--g)); height: calc(52 * var(--g)) }
.compass { right: calc(2 * var(--g)); top: calc(2 * var(--g)); width: calc(24 * var(--g)); height: calc(24 * var(--g)) }
.compass canvas { position: absolute; inset: 0 }
.compass-n.shelter { color: #f49638 }
.compass-n { right: calc(1 * var(--g)); top: calc(26.5 * var(--g)); padding: 0 calc(1 * var(--g)); font: 700 calc(3 * var(--g)) / 1.3 var(--font-mono); letter-spacing: .06em; color: #8cc7dd; background: #0e1214c8; pointer-events: none }
.subtitle { left: calc(26 * var(--g)); right: calc(26 * var(--g)); bottom: calc(30 * var(--g)); text-align: center; font: 700 calc(3.4 * var(--g)) / 1.35 var(--font-mono); letter-spacing: .04em; color: #f6ecd8; text-shadow: 1px 1px 0 #000, -1px 0 0 #000; opacity: 0; transition: opacity .4s; pointer-events: none }
.subtitle.on { opacity: 1 }
.bag { left: calc(-1 * var(--g)); bottom: calc(-2 * var(--g)); width: calc(28 * var(--g)); height: calc(30 * var(--g)) }
.bag img { object-fit: contain; transform: rotate(-12deg) }
.bag.heavy img { animation: strain 1.6s steps(2) infinite }
.bag.over img { filter: sepia(.4) saturate(2) hue-rotate(-25deg) }
@keyframes strain { 50% { transform: rotate(-12deg) translateY(calc(1 * var(--g))) } }
.kg { left: calc(1 * var(--g)); bottom: calc(30 * var(--g)); padding: calc(.6 * var(--g)) calc(1.4 * var(--g)); font: 700 calc(3.4 * var(--g)) / 1 var(--font-mono, ui-monospace); color: #f0a63c; background: #0e1214dd; border: calc(.5 * var(--g)) solid #f0a63c; box-shadow: calc(.6 * var(--g)) calc(.6 * var(--g)) 0 #000 }
.kg.over { color: #ff7b66; border-color: #ff7b66 }
.key { left: 50%; bottom: calc(1 * var(--g)); width: calc(18 * var(--g)); height: calc(24 * var(--g)); transform: translateX(-50%) }
.key.pulse { animation: keyp 1.2s ease-in-out infinite }
@keyframes keyp { 50% { filter: drop-shadow(0 0 calc(2 * var(--g)) #f0a63c) } }
.phone { right: calc(-2 * var(--g)); bottom: calc(-7 * var(--g)); width: calc(40 * var(--g)); height: calc(33 * var(--g)); transition: transform .15s }
.phone .news { position: absolute; right: calc(9 * var(--g)); top: calc(1 * var(--g)); width: calc(4 * var(--g)); height: calc(4 * var(--g)); background: #d94b3b; border: calc(.7 * var(--g)) solid #000; animation: keyp 1.2s ease-in-out infinite }
.phone:hover, .phone:active { transform: translateY(calc(-3 * var(--g))) }
</style>
