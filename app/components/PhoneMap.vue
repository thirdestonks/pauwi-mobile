<script setup lang="ts">
// Juan's phone (DESIGN.md "Map screen"): he pulls it out, his thumb wakes the screen, and an
// offline map app shows streets, business addresses, shelters and places Juan has visited.
// The hand is the painted-then-pixelated sheet from
// .art/phone-map/build.py (frames: 0 pulled out, 1 held, 2 thumb on the glass), with the
// screen cut out as a hole; the map is drawn live behind it from the same generator as the
// streets. Tap a square for details, drag to pan, or tap outside to put the phone away.
import { LM, hexDist, tile, tkey } from '~/utils/tondo'
import { houseProgress, phonePlaces, phonePlaceStatus, placeIntel, type PhonePlace } from '~/utils/phoneMap'

const emit = defineEmits<{ close: [] }>()
const board = useBoardStore()
const house = useHouseStore()
const sfx = useSfx()

const W = 110, H = 225, S3 = Math.sqrt(3)
/** The screen, as the union of every frame's hole (native pixels); the hand covers the rest. */
const SCREEN = { x: 23, y: 50, w: 64, h: 96 }
/** Hex size on the phone: a top-down street map, small enough to see the neighbourhood. */
const HEX = 2.6
const zoomLevels = [1, 1.6, 2.4]
const zoom = ref(0)
const hexSize = computed(() => HEX * zoomLevels[zoom.value]!)
const selected = ref<PhonePlace | null>(null)

const canvas = ref<HTMLCanvasElement | null>(null)
/** The hand on its own layer above the glass, so the markers, the card and the text all sit under Juan's thumb and fingers, not on them. */
const handLayer = ref<HTMLCanvasElement | null>(null)
const hand = new Image()
hand.src = '/game/phone-map/out/phone-hand.png'

// --- the hand: up 0 → 2 (the thumb wakes it) → 1 to rest; the thumb frame again while panning; down 1 → 0 ---
const frame = ref(0)
const rise = ref(60)          // px below rest, easing up as he lifts it
const lit = ref(0)            // the screen's brightness, 0 dark → 1 on
const leaving = ref(false)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function open() {
  sfx.play('phone-open', 0.9)
  frame.value = 0
  const t0 = performance.now()
  await new Promise<void>((res) => {
    const st = () => {
      const q = Math.min(1, (performance.now() - t0) / 220)
      rise.value = Math.round(60 * (1 - q) ** 2)
      if (q < 1) requestAnimationFrame(st)
      else res()
    }
    st()
  })
  frame.value = 2
  await wait(140)
  sfx.play('item-pickup', 0.35)                                   // the tap that wakes it
  for (let k = 1; k <= 4; k++) { lit.value = k / 4; await wait(45) }
  frame.value = 1
}

async function close() {
  if (leaving.value) return
  leaving.value = true
  sfx.play('put-item', 0.5)
  frame.value = 0
  for (let k = 3; k >= 0; k--) { lit.value = k / 4; await wait(30) }
  const t0 = performance.now()
  await new Promise<void>((res) => {
    const st = () => {
      const q = Math.min(1, (performance.now() - t0) / 200)
      rise.value = Math.round(70 * q * q)
      if (q < 1) requestAnimationFrame(st)
      else res()
    }
    st()
  })
  emit('close')
}

// --- panning: drag on the glass ---
const pan = reactive({ x: 0, y: 0 })
let drag: null | { id: number; x: number; y: number; px: number; py: number; moved: boolean } = null
function native(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height] as const
}
function down(e: PointerEvent) {
  if (leaving.value || (e.pointerType === 'mouse' && e.button !== 0)) return
  const [x, y] = native(e)
  const onScreen = x >= SCREEN.x && x < SCREEN.x + SCREEN.w && y >= SCREEN.y && y < SCREEN.y + SCREEN.h
  if (!onScreen || lit.value < 1) { if (lit.value >= 1) close(); return }
  drag = { id: e.pointerId, x, y, px: pan.x, py: pan.y, moved: false }
  frame.value = 2
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* the drag still works without capture */ }
}
function move(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const [x, y] = native(e)
  // Small finger movement still counts as a tap; only a drag moves the map.
  const bounds = canvas.value!.getBoundingClientRect()
  if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) * bounds.width / W < 6) return
  drag.moved = true
  selected.value = null
  const scale = zoomLevels[zoom.value]!
  pan.x = Math.max(-140 * scale, Math.min(140 * scale, drag.px + x - drag.x))
  pan.y = Math.max(-200 * scale, Math.min(200 * scale, drag.py + y - drag.y))
}
function up(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const wasDrag = drag.moved
  drag = null
  if (!leaving.value) frame.value = 1
  if (wasDrag || leaving.value) return
  const [x, y] = native(e)
  // Pick the closest square, including a small margin around its visible pixels.
  const nearest = markers.value.map((m) => ({ ...m, d: Math.hypot(x - SCREEN.x - m.x, y - SCREEN.y - m.y) }))
    .filter((m) => m.d <= 4).sort((a, b) => a.d - b.d)[0]
  selected.value = nearest?.place ?? null
}
function cancelDrag() {
  drag = null
  if (!leaving.value) frame.value = 1
}
/** Back on Juan. */
function recentre() { selected.value = null; pan.x = 0; pan.y = 0 }
function changeZoom(by: number) {
  const next = Math.max(0, Math.min(zoomLevels.length - 1, zoom.value + by))
  const ratio = zoomLevels[next]! / zoomLevels[zoom.value]!
  pan.x *= ratio; pan.y *= ratio
  zoom.value = next
}

// --- the map app: streets from the generator, coloured by what Juan knows ---
const visited = computed(() => {
  const s = new Set<string>()
  for (const t of board.tiles.values()) if (t.cleared) s.add(tkey(t.q, t.r))
  return s
})
const PALETTE = {
  bg: [12, 20, 24], house: [24, 34, 38], road: [78, 94, 100], alley: [52, 66, 72], plaza: [60, 70, 82],
  landmark: [46, 134, 171], cleared: [74, 150, 108], edge: 0.78,
}
function hexOf(dx: number, dy: number): [number, number, boolean] {
  const qf = ((2 / 3) * dx) / hexSize.value, rf = ((-1 / 3) * dx + (S3 / 3) * dy) / hexSize.value
  let q = Math.round(qf), r = Math.round(rf)
  const s = Math.round(-qf - rf), dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s + qf + rf)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  const edge = Math.max(dq, dr, ds) > 0.38                       // near a hex border: a touch darker, so blocks read
  return [q, r, edge]
}
function centreOf(q: number, r: number, cx: number, cy: number): [number, number] {
  const dq = q - board.playerPos.q, dr = r - board.playerPos.r
  return [cx + hexSize.value * 1.5 * dq, cy + hexSize.value * S3 * (dr + dq / 2)]
}

const places = computed(() => {
  const corners = [[0, 0], [SCREEN.w, 0], [0, SCREEN.h], [SCREEN.w, SCREEN.h]]
    .map(([x, y]) => hexOf(x! - SCREEN.w / 2 - pan.x, y! - SCREEN.h / 2 - pan.y))
  const jq = board.playerPos.q, jr = board.playerPos.r
  return phonePlaces({
    minQ: jq + Math.min(...corners.map(([q]) => q)) - 1, maxQ: jq + Math.max(...corners.map(([q]) => q)) + 1,
    minR: jr + Math.min(...corners.map(([, r]) => r)) - 1, maxR: jr + Math.max(...corners.map(([, r]) => r)) + 1,
  }, board.waypoints, board.tiles, board.home, board.playerPos).concat(tips.value, stall.value)
})
/** Aling Cora's stall, where she set up today (by day only: she packs up at dusk and moves). */
const stall = computed<PhonePlace[]>(() => {
  const p = board.traderPos
  if (!p) return []
  return [{
    id: `trader:${p.q},${p.r}`, kind: 'trader', name: "Aling Cora's stall", category: 'Trader',
    description: 'She barters: bring her what you find, take what you need. She moves every day.',
    color: '#e0b24a', q: p.q, r: p.r, entrance: { ...p },
  }]
})
/** Radio tips not found yet: a ? at the centre of a circle somewhere around the cache. */
const tips = computed<PhonePlace[]>(() => board.caches.filter((c) => !c.found).map((c) => ({
  id: `tip:${c.q},${c.r}`, kind: 'tip', name: 'Radio tip', category: 'Supply cache',
  description: `The radio said supplies were left for anyone on ${c.street.replace(/\.$/, '')}. It is somewhere inside the circle.`,
  color: '#f0a63c', q: c.cq, r: c.cr, entrance: { q: c.cq, r: c.cr },
})))
/** Houses and shops can be marked to come back to: they pulse on the map. */
const pinnable = computed(() => selected.value && (selected.value.kind === 'house' || selected.value.kind === 'shop'))
const pinned = computed(() => !!selected.value && board.pins.includes(`${selected.value.q},${selected.value.r}`))
const markers = computed(() => places.value.map((place) => {
  const [x, y] = centreOf(place.q, place.r, SCREEN.w / 2 + pan.x, SCREEN.h / 2 + pan.y)
  return { place, x, y }
}).filter((m) => m.x >= 2 && m.x <= SCREEN.w - 2 && m.y >= 7 && m.y <= SCREEN.h - 2))
const selectedStatus = computed(() => {
  const p = selected.value
  if (!p) return ''
  if (p.kind === 'house') return houseProgress(p.q, p.r, board.tiles, house.saved)?.line ?? ''
  return phonePlaceStatus(p, board.tiles, board.waypoints, board.home)
})
const intel = computed(() => selected.value ? placeIntel(selected.value, board.tiles, house.saved) : null)
const selectedDistance = computed(() => selected.value ? hexDist(board.playerPos.q, board.playerPos.r, selected.value.entrance.q, selected.value.entrance.r) : 0)

let raf = 0
function draw(T: number) {
  const c = canvas.value?.getContext('2d')
  if (c) {
    c.clearRect(0, 0, W, H)
    const img = c.createImageData(SCREEN.w, SCREEN.h), d = img.data
    const cx = SCREEN.w / 2 + pan.x, cy = SCREEN.h / 2 + pan.y
    const jq = board.playerPos.q, jr = board.playerPos.r, seen = visited.value
    for (let y = 0; y < SCREEN.h; y++) for (let x = 0; x < SCREEN.w; x++) {
      const [hq, hr, edge] = hexOf(x + 0.5 - cx, y + 0.5 - cy)
      const q = hq + jq, r = hr + jr, t = tile(q, r)
      let col = t.type === 'house' ? PALETTE.house : t.type === 'landmark' ? PALETTE.landmark
        : t.plaza ? PALETTE.plaza : t.type === 'road' ? PALETTE.road : PALETTE.alley
      if (t.type !== 'house' && seen.has(tkey(q, r))) col = PALETTE.cleared
      const k = (edge ? PALETTE.edge : 1) * (y % 2 ? 0.9 : 1) * lit.value   // hex borders, a faint scanline, the screen waking
      const i = (y * SCREEN.w + x) * 4
      d[i] = col[0]! * k + PALETTE.bg[0]! * (1 - lit.value); d[i + 1] = col[1]! * k + PALETTE.bg[1]! * (1 - lit.value)
      d[i + 2] = col[2]! * k + PALETTE.bg[2]! * (1 - lit.value); d[i + 3] = 255
    }
    c.putImageData(img, SCREEN.x, SCREEN.y)

    if (lit.value >= 1) {
      // markers, clipped to the glass
      c.save()
      c.beginPath(); c.rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h); c.clip()
      const ox = SCREEN.x, oy = SCREEN.y
      const dot = (q: number, r: number, color: string, size: number) => {
        const [x, y] = centreOf(q, r, cx, cy)
        c.fillStyle = '#000'; c.fillRect(Math.round(ox + x - size / 2) - 1, Math.round(oy + y - size / 2) - 1, size + 2, size + 2)
        c.fillStyle = color; c.fillRect(Math.round(ox + x - size / 2), Math.round(oy + y - size / 2), size, size)
      }
      // radio tips: a dotted amber ring around the area where the cache is
      for (const tip of board.caches) {
        if (tip.found) continue
        const [tx2, ty2] = centreOf(tip.cq, tip.cr, cx, cy), rad = tip.radius * hexSize.value * 1.75
        const n = Math.max(24, Math.round(rad * 3))
        c2: for (let k = 0; k < n; k++) {
          if (k % 2) continue c2
          const a = (k / n) * Math.PI * 2
          c.fillStyle = Math.floor(T / 500) % 2 ? '#f0a63c' : '#c9821f'
          c.fillRect(Math.round(ox + tx2 + Math.cos(a) * rad), Math.round(oy + ty2 + Math.sin(a) * rad), 1, 1)
        }
      }
      if (Math.floor(T / 450) % 2) dot(jq, jr, '#ffe9a8', 3)        // Juan: a blinking dot
      else dot(jq, jr, '#f0a63c', 2)
      c.restore()
      // Tutuban off the glass: an arrow on the edge pointing at it
      const [tx, ty] = centreOf(LM.q, LM.r, cx, cy)
      if (tx < 0 || tx >= SCREEN.w || ty < 0 || ty >= SCREEN.h) {
        const a = Math.atan2(ty - SCREEN.h / 2, tx - SCREEN.w / 2)
        const ex = Math.max(3, Math.min(SCREEN.w - 4, SCREEN.w / 2 + Math.cos(a) * 60))
        const ey = Math.max(3, Math.min(SCREEN.h - 4, SCREEN.h / 2 + Math.sin(a) * 60))
        c.fillStyle = '#2e86ab'
        for (let k = 0; k < 3; k++) for (let s2 = -k; s2 <= k; s2++) {
          const along = 2 - k, px2 = ex + Math.cos(a) * along - Math.sin(a) * s2, py2 = ey + Math.sin(a) * along + Math.cos(a) * s2
          c.fillRect(Math.round(SCREEN.x + px2), Math.round(SCREEN.y + py2), 1, 1)
        }
      }
    }
  }
  // the hand over it all, glass overlay included (the screen is a hole in it)
  const hc = handLayer.value?.getContext('2d')
  if (hc && hand.complete) {
    hc.clearRect(0, 0, W, H)
    hc.imageSmoothingEnabled = false
    hc.drawImage(hand, frame.value * W, 0, W, H, 0, rise.value, W, H)
    if (rise.value > 0) { hc.fillStyle = '#000'; hc.fillRect(0, 0, W, rise.value) }
  }
  raf = requestAnimationFrame(draw)
}

const tutubanTiles = computed(() => hexDist(board.playerPos.q, board.playerPos.r, LM.q, LM.r))
const nextShelter = computed(() => {
  const hq = board.playerPos.q, hr = board.playerPos.r
  const w = board.waypoints.filter((x) => !x.isTutuban && x.key && x.key !== board.home && !x.claimed)
    .sort((a, b) => hexDist(hq, hr, a.pos.q, a.pos.r) - hexDist(hq, hr, b.pos.q, b.pos.r))[0]
  return w ? { name: w.name, d: hexDist(hq, hr, w.pos.q, w.pos.r) } : null
})
// the overlay's text sits on the glass, in percent of the 110×225 canvas
const pct = (v: number, of: number) => `${(v / of) * 100}%`

onMounted(() => { raf = requestAnimationFrame(draw); open() })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="phone-map" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancelDrag" @keydown.esc.prevent.stop="selected ? selected = null : close()">
    <canvas ref="canvas" :width="W" :height="H" aria-label="Juan's phone: an offline map. Tap a location square for details, drag to pan, tap outside to put it away." />
    <div v-if="lit >= 1 && !leaving" class="glass" :style="{ left: pct(SCREEN.x, W), top: pct(SCREEN.y + rise, H), width: pct(SCREEN.w, W), height: pct(SCREEN.h, H) }">
      <button v-for="m in markers" :key="m.place.id" class="place-marker" :class="{ major: m.place.kind === 'shelter' || m.place.kind === 'landmark' || m.place.kind === 'trader', tip: m.place.kind === 'tip', pin: board.pins.includes(`${m.place.q},${m.place.r}`) }" :style="{ left: pct(m.x, SCREEN.w), top: pct(m.y, SCREEN.h), background: m.place.color }" :aria-label="m.place.name" :aria-pressed="selected?.id === m.place.id" :title="m.place.name" @click.stop="selected = m.place" />
      <div class="bar"><span>TONDO · OFFLINE</span><span>▂▄ 12%</span></div>
      <div v-if="!selected" class="foot">
        <div><i class="sw tut" />TUTUBAN · {{ tutubanTiles }}</div>
        <div v-if="nextShelter"><i class="sw sh" />{{ nextShelter.name.toUpperCase() }} · {{ nextShelter.d }}</div>
      </div>
      <div class="map-controls" @pointerdown.stop @pointermove.stop @pointerup.stop @pointercancel.stop>
        <button aria-label="Zoom in" :disabled="zoom === zoomLevels.length - 1" @click.stop="changeZoom(1)">+</button>
        <button aria-label="Zoom out" :disabled="zoom === 0" @click.stop="changeZoom(-1)">−</button>
        <button v-if="pan.x || pan.y" aria-label="Centre on Juan" @click.stop="recentre">◎</button>
      </div>
      <section v-if="selected" class="place-card" role="dialog" :aria-label="`${selected.name} details`" @pointerdown.stop @pointermove.stop @pointerup.stop @pointercancel.stop @click.stop>
        <button class="dismiss" aria-label="Close location details" @click="selected = null">×</button>
        <small :style="{ color: selected.color }">{{ selected.category }} · {{ selectedDistance }} {{ selectedDistance === 1 ? 'hex' : 'hexes' }}</small>
        <h3>{{ selected.name }}</h3>
        <b class="status">{{ selectedStatus }}</b>
        <button v-if="pinnable" class="pinbtn" :aria-pressed="pinned" @click="board.togglePin(`${selected.q},${selected.r}`)">{{ pinned ? '★ MARKED · IT PULSES ON THE MAP' : '☆ MARK TO COME BACK' }}</button>
        <div v-if="intel" class="intel">
          <div class="threat"><span>THREAT</span><i class="tbar"><b :style="{ width: `${(intel.threat ?? 0) * 100}%` }" :class="{ unknown: intel.threat === null }" /></i><em>{{ intel.threat === null ? '?' : intel.threatLabel }}</em></div>
          <template v-if="intel.supplies.length">
            <div class="sup-h">{{ intel.guess ? 'SUPPLIES · A GUESS' : 'SUPPLIES LEFT' }}</div>
            <div class="sups"><div v-for="s in intel.supplies" :key="s.label" class="sup"><span class="dots"><i v-for="k in 3" :key="k" :class="{ on: k <= s.n }" /></span>{{ s.label }}</div></div>
          </template>
        </div>
        <p v-else>{{ selected.description }}</p>
      </section>
    </div>
    <canvas ref="handLayer" class="hand-layer" :width="W" :height="H" aria-hidden="true" />
    <div v-if="lit >= 1 && !leaving" class="hint">TAP A SQUARE · DRAG TO PAN · TAP OUTSIDE TO PUT AWAY</div>
  </div>
</template>

<style scoped>
.phone-map { position: absolute; inset: 0; z-index: 5; background: #000; touch-action: none; cursor: pointer; container-type: inline-size }
.phone-map canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated }
.phone-map .hand-layer { position: absolute; inset: 0; z-index: 3; pointer-events: none }
.glass { position: absolute; z-index: 1; pointer-events: none; font-family: var(--font-mono); color: #cfe8dc; text-shadow: 1px 1px 0 #000 }
.bar { position: relative; z-index: 2; display: flex; justify-content: space-between; padding: 2px 4px; font-size: 7px; letter-spacing: .06em; background: rgba(8, 14, 16, .75) }
.foot { position: absolute; left: 0; right: 0; bottom: 0; padding: 3px 4px; font-size: 7px; line-height: 1.5; letter-spacing: .04em; background: rgba(8, 14, 16, .8) }
.sw { display: inline-block; width: 5px; height: 5px; margin-right: 4px; vertical-align: 0 }
.sw.tut { background: #2e86ab } .sw.sh { background: #f49638 }
.place-marker { position: absolute; z-index: 1; width: 9px; height: 9px; padding: 0; transform: translate(-50%, -50%); border: 1px solid #000; box-shadow: 0 0 0 1px #000; pointer-events: auto }
.place-marker.major { width: 12px; height: 12px; z-index: 2 }
.place-marker.tip { width: 11px; height: 11px; border-radius: 50%; background: #0e1214 !important; border: 1px solid #f0a63c; box-shadow: 0 0 0 1px #000 }
.place-marker.tip::after { content: '?'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 700 8px/1 var(--font-mono); color: #f0a63c }
.place-marker.pin { outline: 1px solid #ece4d5; outline-offset: 1px }
.pinbtn { display: block; width: 100%; margin-top: 5px; padding: 3px; font: 700 7px var(--font-mono); letter-spacing: .06em; color: #f0a63c; background: #16212a; border: 1px solid #3a4851 }
.pinbtn[aria-pressed='true'] { color: #ece4d5; border-color: #ece4d5 }
.place-marker[aria-pressed='true'] { outline: 2px solid #fff0cc; outline-offset: 2px; z-index: 3 }
.place-marker:focus-visible { outline: 2px solid #fff0cc; outline-offset: 3px }
.map-controls { position: absolute; z-index: 4; right: 3px; top: 17px; display: flex; flex-direction: column; gap: 3px; pointer-events: auto }
.map-controls button { width: 24px; height: 24px; padding: 0; font-size: 17px; line-height: 20px; color: #f0a63c; background: #0c1418; border: 1px solid #526169; box-shadow: 1px 1px 0 #000 }
.map-controls button:disabled { opacity: .4 }
.place-card { position: absolute; z-index: 5; left: 2px; right: 2px; top: 13px; max-height: 64%; overflow-y: auto; overflow-wrap: anywhere; padding: 5px 6px 6px; color: #ece4d5; background: #0c1418f2; border: 2px solid #526169; box-shadow: 2px 2px 0 #000; text-shadow: none; pointer-events: auto }
.place-card small { display: block; padding-right: 22px; font-size: 8px; text-transform: uppercase; letter-spacing: .04em }
.place-card h3 { margin: 2px 20px 1px 0; font-size: 11px; line-height: 1.25; font-weight: 700 }
.place-card .status { display: block; font-size: 8px; font-weight: 400; color: #f0a63c }
.place-card p { margin: 4px 0 0; font-size: 9px; line-height: 1.35; color: #aebbc0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden }
.intel { margin-top: 5px; padding-top: 4px; border-top: 1px solid #344047; font-size: 8px }
.threat { display: flex; align-items: center; gap: 4px; color: #f0a63c }
.threat em { font-style: normal; color: #aebbc0; white-space: nowrap }
.tbar { position: relative; flex: 1; height: 5px; background: #0b1013; border: 1px solid #526169 }
.tbar b { position: absolute; left: 0; top: 0; bottom: 0; background: #d94b3b }
.tbar b.unknown { width: 100% !important; background: repeating-linear-gradient(90deg, #344047 0 2px, transparent 2px 4px) }
.sup-h { margin: 5px 0 2px; color: #f0a63c }
.sups { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 6px }
.sup { display: flex; align-items: center; gap: 4px; line-height: 1.5; white-space: nowrap }
.dots { display: inline-flex; gap: 1px }
.dots i { width: 5px; height: 5px; border: 1px solid #aebbc0 }
.dots i.on { background: #ece4d5 }
.dismiss { position: absolute; right: 2px; top: 2px; width: 20px; height: 20px; font-size: 15px; line-height: 18px; color: #cfe8dc; border: 1px solid #344047 }
.hint { position: absolute; z-index: 4; left: 8px; right: 8px; bottom: 8px; padding: 6px; text-align: center; font-family: var(--font-mono); font-size: 9px; letter-spacing: .06em; color: var(--muted); background: #0e1214db; pointer-events: none }
</style>
