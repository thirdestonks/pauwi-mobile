<script setup lang="ts">
// The shelter as Juan's room (.art/shelter-ui, concept 2): the shelter's pixel room fills the screen and its things are the
// interface. Each shelter has its own map of what is where (SPOTS, in the room's 110x225 pixels): the bed or cot to sleep, somewhere
// to eat, the stash (pack the bag, gear), the way out (the route to Tutuban), the door to head out, and a radio, lamp or crate for
// settings and the save. Small amber glints mark what can be tapped, like the cupboards inside houses. The wristwatch and a slim
// strip of meters are the only other things on screen.
import { axialDistance } from '~/utils/hex'
import { CONSUMABLE_EFFECTS, FOOD_IDS, PIXEL_COMBAT } from '~/data/combat'
import { itemInfo } from '~/data/equipment'
import { saveRunNow } from '~/utils/save'
import { hash } from '~/utils/tondo'
import { RECIPES, type Recipe } from '~/data/crafting'

const ui = useUiStore()
const inventory = useInventoryStore()
const player = usePlayerStore()
const board = useBoardStore()
const sfx = useSfx()
const { settings } = useSettings()

const night = computed(() => board.phase === 'night')

// --- what is where, per shelter (x, y, w, h in the room's own pixels; the glint sits at gx, gy) ---
type Act = 'sleep' | 'eat' | 'stash' | 'way' | 'out' | 'settings'
interface Spot { act: Act; name: string; x: number; y: number; w: number; h: number; gx: number; gy: number }
const SPOTS: Record<string, Spot[]> = {
  nida: [
    { act: 'way', name: 'The boarded window', x: 4, y: 42, w: 28, h: 64, gx: 28, gy: 46 },
    { act: 'stash', name: 'The shelves', x: 40, y: 30, w: 70, h: 80, gx: 104, gy: 34 },
    { act: 'eat', name: 'The counter', x: 56, y: 112, w: 34, h: 48, gx: 86, gy: 118 },
    { act: 'settings', name: 'The radio', x: 91, y: 114, w: 18, h: 20, gx: 105, gy: 117 },
    { act: 'sleep', name: 'The mat', x: 0, y: 127, w: 48, h: 54, gx: 42, gy: 132 },
    { act: 'out', name: 'The door', x: 54, y: 196, w: 56, h: 18, gx: 104, gy: 198 },
  ],
  t10: [
    { act: 'out', name: 'The door', x: 2, y: 4, w: 27, h: 206, gx: 24, gy: 60 },
    { act: 'way', name: 'The window', x: 40, y: 10, w: 60, h: 112, gx: 96, gy: 14 },
    { act: 'settings', name: 'The candle', x: 30, y: 158, w: 26, h: 42, gx: 52, gy: 162 },
    { act: 'eat', name: 'The stove', x: 58, y: 168, w: 22, h: 32, gx: 76, gy: 172 },
    { act: 'stash', name: 'The supplies', x: 80, y: 172, w: 26, h: 30, gx: 102, gy: 176 },
    { act: 'sleep', name: 'The bedroll', x: 34, y: 204, w: 60, h: 20, gx: 88, gy: 206 },
  ],
  brgy: [
    { act: 'way', name: 'The notice board', x: 2, y: 55, w: 20, h: 70, gx: 18, gy: 58 },
    { act: 'settings', name: 'The radio', x: 4, y: 126, w: 19, h: 16, gx: 19, gy: 128 },
    { act: 'eat', name: 'The desk', x: 22, y: 132, w: 24, h: 26, gx: 42, gy: 135 },
    { act: 'stash', name: 'The drawers', x: 4, y: 160, w: 42, h: 55, gx: 42, gy: 164 },
    { act: 'sleep', name: 'The cot', x: 58, y: 112, w: 44, h: 64, gx: 98, gy: 116 },
    { act: 'out', name: 'The door', x: 50, y: 200, w: 60, h: 22, gx: 104, gy: 202 },
  ],
  mm: [
    { act: 'way', name: 'The bikes', x: 4, y: 14, w: 42, h: 76, gx: 42, gy: 18 },
    { act: 'out', name: 'The shutter', x: 40, y: 74, w: 32, h: 66, gx: 68, gy: 78 },
    { act: 'settings', name: 'The lamp', x: 72, y: 88, w: 16, h: 24, gx: 85, gy: 92 },
    { act: 'stash', name: 'The tool wall', x: 0, y: 95, w: 28, h: 56, gx: 24, gy: 98 },
    { act: 'eat', name: 'The crate', x: 56, y: 145, w: 20, h: 30, gx: 72, gy: 148 },
    { act: 'sleep', name: 'The cot', x: 72, y: 128, w: 38, h: 72, gx: 104, gy: 132 },
  ],
}
const spots = computed(() => SPOTS[board.home] ?? SPOTS.nida!)
const room = computed(() => `/game/encounters/src/shelter-${SPOTS[board.home] ? board.home : 'nida'}-110.png`)

// --- the meters, the road, the night's cost ---
const meters = computed(() => [
  { key: 'health', value: player.health, color: '#d94b3b' },
  { key: 'energy', value: player.energy, color: '#2e86ab' },
  { key: 'food', value: player.food, color: '#9cb840' },
  { key: 'hope', value: player.hope, color: '#f0a63c' },
])
const routeLength = computed(() => (board.tutuban ? axialDistance({ q: 0, r: 0 }, board.tutuban.pos) : 1))
const progressPercent = computed(() => Math.max(0, Math.min(100, Math.round((1 - board.distanceToTutuban / Math.max(1, routeLength.value)) * 100))))
/** Tonight's Hope cost of the Dread Juan is carrying (1 per 10). */
const dreadToll = computed(() => Math.floor(player.dread / PIXEL_COMBAT.dreadPerHopeLost))
const nextShelter = computed(() => {
  const w = board.waypoints.filter((x) => !x.isTutuban && x.key && x.key !== board.home && !x.claimed)
    .sort((a, b) => axialDistance(board.playerPos, a.pos) - axialDistance(board.playerPos, b.pos))[0]
  return w ? `${w.name}, ${axialDistance(board.playerPos, w.pos)} tiles` : null
})

// rain on the roof on a wet night
const raining = computed(() => night.value && hash(board.dayCount, 0, 77) > 0.4)
watch(raining, (on) => sfx.bed('rain-indoor', on, 0.4), { immediate: true })
onBeforeUnmount(() => sfx.bed('rain-indoor', false))

/** What the night (or the meal) did, shown until Juan heads out again. */
const morning = ref<string | null>(null)
const status = computed(() => morning.value
  ?? (night.value ? 'The door is shut. Eat something, then sleep.' : 'Light through the gaps. Pack the bag and head out.'))

function doSleep() {
  if (!night.value) return
  const fed = player.sleep()
  board.sleepThroughToMorning()
  morning.value = `${fed ? 'You slept.' : 'You slept hungry: Health −10.'} Energy ${player.energy}, Food ${player.food}${player.lastDreadPenalty ? `. The fights stay with you: Hope −${player.lastDreadPenalty}` : ''}.`
  saveRunNow()
}

// --- eat: anything that feeds him, from the stash or the bag, best first ---
const eatable = (id: string) => (FOOD_IDS as readonly string[]).includes(id) || !!CONSUMABLE_EFFECTS[id]?.food
const food = computed(() => {
  const rows = inventory.stash.filter((item) => item.qty > 0 && eatable(item.id)).map((item) => ({ id: item.id, from: 'stash' as const, qty: item.qty }))
  const inBag = new Map<string, number>()
  for (const id of inventory.units) if (eatable(id)) inBag.set(id, (inBag.get(id) ?? 0) + 1)
  for (const [id, qty] of inBag) rows.push({ id, from: 'bag' as const, qty })
  const fit = (id: string) => {
    const gain = CONSUMABLE_EFFECTS[id]?.food ?? 0, roomLeft = 100 - player.food
    return Math.min(gain, roomLeft) - Math.max(0, gain - roomLeft) * 0.5 + (CONSUMABLE_EFFECTS[id]?.heal ?? 0) * 0.1
  }
  return rows.map((r) => ({ ...r, name: itemInfo(r.id)?.name ?? r.id, sprite: itemInfo(r.id)?.sprite, effect: CONSUMABLE_EFFECTS[r.id]?.label ?? '', score: fit(r.id) }))
    .sort((a, b) => b.score - a.score)
})
function eatPick(id: string, from: 'stash' | 'bag') {
  const spent = from === 'stash' ? inventory.consumeStashItem(id) : inventory.removeFromBag(id)
  if (!spent) return
  player.applyConsumable(id)
  sfx.play(id === 'water' ? 'item-pickup' : 'paper-grab')
  morning.value = `${itemInfo(id)?.name ?? id}. Food ${player.food} · Energy ${player.energy} · Health ${player.health}.`
  if (!food.value.length) open.value = null
  saveRunNow()
}
const stashCount = computed(() => inventory.stash.reduce((n, i) => n + Math.max(0, i.qty), 0))

// --- tapping things ---
const open = ref<Spot | null>(null)
const touched = ref(false)
function tap(s: Spot) { touched.value = true; crafting.value = false; open.value = open.value === s ? null : s; sfx.play('put-item', 0.4) }
function headOut() { open.value = null; ui.setTab('pack') }

// --- making things (data/crafting.ts): from the stash and the bag, into the stash ---
const crafting = ref(false)
const crafts = computed(() => RECIPES.map((r) => {
  const missing = r.needs.filter((id) => inventory.haveAnywhere(id) < r.needs.filter((x) => x === id).length)
  const noWeapon = !!r.repair && (player.unbreakable || player.weaponDurability >= (player.weapon.durability ?? 0))
  const noArmor = !!r.patch && !player.wornArmor.some((a) => a.condition < a.max)
  return {
    ...r, missing, ok: !missing.length && !noWeapon && !noArmor,
    why: noWeapon ? (player.unbreakable ? 'nothing in hand to fix' : 'the weapon is already sound') : noArmor ? (player.wornArmor.length ? 'the armor is already sound' : 'no armor on') : '',
  }
}))
const nameOf = (id: string) => itemInfo(id)?.name ?? id
function craft(r: Recipe) {
  for (const id of r.needs) inventory.spendAnywhere(id)
  if (r.makes) { inventory.addStashItem(r.makes); morning.value = `You made: ${nameOf(r.makes)}. It is in the stash.` }
  if (r.repair) { const got = player.repairWeapon(r.repair); morning.value = `The ${player.weapon.name.toLowerCase()} is taped tight: +${got} swings.` }
  if (r.patch) { const got = player.repairArmor(r.patch); if (got) morning.value = `The ${got[0].toLowerCase()} is wired back together: +${got[1]} condition.` }
  sfx.play('equip-sound', 0.7)
  saveRunNow()
  crafting.value = false
  open.value = null
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`
</script>

<template>
  <div class="flex-1 flex items-center justify-center overflow-hidden" style="background: #000">
    <div class="room" :class="{ night }">
      <img class="art" :src="room" :alt="`Inside ${board.shelterName}`">
      <div class="light" />

      <!-- the things in the room -->
      <button v-for="s in spots" :key="s.act + s.name" class="spot" :class="{ sel: open === s }" :aria-label="s.name"
        :style="{ left: pct(s.x, 110), top: pct(s.y, 225), width: pct(s.w, 110), height: pct(s.h, 225) }" @click="tap(s)" />
      <i v-for="(s, k) in spots" :key="'g' + k" class="glint" :style="{ left: pct(s.gx, 110), top: pct(s.gy, 225), animationDelay: `${k * 0.23}s` }" />

      <KitWatch class="watch" />
      <div class="place">{{ board.shelterName }}</div>
      <div v-if="!touched" class="hint">TAP THINGS IN THE ROOM</div>

      <p v-if="!open" class="status">{{ status }}</p>

      <!-- what the tapped thing offers -->
      <section v-if="open" class="prompt" role="dialog" :aria-label="open.name" @click.stop>
        <small>{{ open.name }}</small>
        <template v-if="open.act === 'sleep'">
          <h3>{{ night ? 'Sleep' : 'Not yet' }}</h3>
          <p>{{ night ? (player.food >= 15 ? 'Sleep until morning. −15 Food, +30 Energy, +5 Health.' : 'Sleep hungry: Health −10 tonight.') + (dreadToll ? ` The fights will cost ${dreadToll} Hope.` : '') : 'You can sleep once it is dark. Out there is still the day.' }}</p>
          <div class="acts"><button class="go" :disabled="!night" @click="open = null; doSleep()">Sleep</button><button @click="open = null">Back</button></div>
        </template>
        <template v-else-if="open.act === 'eat'">
          <h3>Eat</h3>
          <div v-if="food.length" class="list">
            <button v-for="(f, i) in food" :key="f.from + f.id" @click="eatPick(f.id, f.from)">
              <img v-if="f.sprite" :src="f.sprite" alt=""><span>{{ f.name }}<b v-if="i === 0 && food.length > 1"> BEST</b></span><em>{{ f.effect.split(',')[0] }} · ×{{ f.qty }}</em>
            </button>
          </div>
          <p v-else>Nothing here to eat. The stash and the bag are empty of food.</p>
          <div class="acts"><button @click="open = null">Back</button></div>
        </template>
        <template v-else-if="open.act === 'stash'">
          <template v-if="!crafting">
            <h3>The stash</h3>
            <p>{{ stashCount }} thing{{ stashCount === 1 ? '' : 's' }} kept here. Pack the bag from it, put on what Juan wears, or make something.</p>
            <div class="acts"><button class="go" @click="open = null; ui.setTab('pack')">Pack</button><button @click="open = null; ui.setTab('gear')">Gear</button><button @click="crafting = true">Make</button><button @click="open = null">Back</button></div>
          </template>
          <template v-else>
            <h3>Make something</h3>
            <div class="list">
              <button v-for="r in crafts" :key="r.id" :disabled="!r.ok" :class="{ off: !r.ok }" @click="craft(r)">
                <img v-if="r.makes && itemInfo(r.makes)?.sprite" :src="itemInfo(r.makes)!.sprite" alt="">
                <span>{{ r.name }}<small>{{ r.needs.map(nameOf).join(' + ') }}{{ r.missing.length ? ` · need ${r.missing.map(nameOf).join(', ')}` : r.why ? ` · ${r.why}` : '' }}</small></span>
                <em>{{ r.ok ? 'MAKE' : '—' }}</em>
              </button>
            </div>
            <div class="acts"><button @click="crafting = false">Back</button></div>
          </template>
        </template>
        <template v-else-if="open.act === 'way'">
          <h3>The way out</h3>
          <div class="route"><i class="bar"><b :style="{ width: progressPercent + '%' }" /></i></div>
          <p>Tutuban, {{ board.distanceToTutuban }} tiles. {{ board.sheltersClaimed }} shelter{{ board.sheltersClaimed === 1 ? '' : 's' }} claimed.{{ nextShelter ? ` Next shelter: ${nextShelter}.` : '' }}</p>
          <div class="acts"><button class="go" @click="open = null">Back</button></div>
        </template>
        <template v-else-if="open.act === 'out'">
          <h3>Head out</h3>
          <p>{{ board.maxMoves }} moves this {{ night ? 'night' : 'day' }}. Pack the bag first.</p>
          <div class="acts"><button class="go" @click="headOut">Head out</button><button @click="open = null">Stay</button></div>
        </template>
        <template v-else>
          <h3>Settings &amp; save</h3>
          <div class="toggles">
            <button v-for="k in (['sound', 'shake', 'haptics', 'lefty', 'fastFights'] as const)" :key="k" :aria-pressed="settings[k]" @click="settings[k] = !settings[k]">
              {{ k === 'haptics' ? 'VIBRATE' : k === 'lefty' ? 'LEFT HAND' : k === 'fastFights' ? 'FAST FIGHTS' : k.toUpperCase() }} · {{ settings[k] ? 'ON' : 'OFF' }}
            </button>
          </div>
          <SavePanel />
          <div class="acts"><button class="go" @click="open = null">Close</button></div>
        </template>
      </section>

      <!-- Juan, at a glance -->
      <div class="vit">
        <div v-for="m in meters" :key="m.key"><img :src="`/game/encounters/src/ui/icon-${m.key}.png`" :alt="m.key"><i><b :style="{ width: m.value + '%', background: m.color }" /></i></div>
        <div v-if="player.dread > 0" class="dr">DREAD {{ player.dread }}<span v-if="dreadToll"> · −{{ dreadToll }} HOPE TONIGHT</span><span v-if="player.shaken"> · SHAKEN</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* the room: native 110x225, g = one of its pixels */
.room { position: relative; height: 100%; max-width: 100%; aspect-ratio: 110 / 225; overflow: hidden; container-type: size; background: #000 }
.room > * { --g: calc(100cqw / 110) }
.art { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated }
.light { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(#ffd9a014, #0000 40%, #0005); transition: background .4s }
.room.night .light { background: radial-gradient(circle at 63% 55%, #0000 0 16%, #0009 48%, #000d 100%) }
.spot { position: absolute; padding: 0; background: none; border: 0; cursor: pointer; outline: none }
.spot::after { content: ''; position: absolute; inset: 0; border: calc(.7 * var(--g)) dashed #f0a63c00; transition: border-color .15s }
.spot:hover::after, .spot.sel::after, .spot:focus-visible::after { border-color: #f0a63cd0 }
.glint { position: absolute; width: calc(1.4 * var(--g)); height: calc(1.4 * var(--g)); background: #f0a63c; pointer-events: none; animation: gl 1.4s ease-in-out infinite }
@keyframes gl { 0%, 100% { opacity: .25 } 50% { opacity: 1 } }
.watch { position: absolute; left: calc(1 * var(--g)); top: calc(-6 * var(--g)); width: calc(32 * var(--g)); height: calc(52 * var(--g)); z-index: 2 }
.place { position: absolute; left: calc(34 * var(--g)); top: calc(2 * var(--g)); padding: 0 calc(1 * var(--g)); font: 700 calc(3 * var(--g)) / 1.35 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: #f6ecd8; background: #0e1214c8; pointer-events: none }
.hint { position: absolute; right: calc(2 * var(--g)); top: calc(9 * var(--g)); font: 700 calc(2.8 * var(--g)) / 1.3 var(--font-mono); color: #f6ecd8; text-shadow: 1px 1px 0 #000; pointer-events: none; animation: gl 1.6s ease-in-out infinite }
.status { position: absolute; left: calc(3 * var(--g)); right: calc(3 * var(--g)); bottom: calc(20 * var(--g)); margin: 0; padding: calc(1.5 * var(--g)) calc(2.5 * var(--g)); text-align: center; font: calc(3.2 * var(--g)) / 1.4 var(--font-mono); color: #f6ecd8; background: #0e1214c0; pointer-events: none }
.prompt { position: absolute; left: calc(3 * var(--g)); right: calc(3 * var(--g)); bottom: calc(18 * var(--g)); max-height: 62%; overflow-y: auto; padding: calc(3 * var(--g)); background: #0c1418f2; border: calc(.7 * var(--g)) solid #526169; box-shadow: calc(.7 * var(--g)) calc(.7 * var(--g)) 0 #000; font: calc(3.3 * var(--g)) / 1.4 var(--font-mono); z-index: 3 }
.prompt small { display: block; color: var(--muted); font-size: calc(2.6 * var(--g)); letter-spacing: .1em; text-transform: uppercase }
.prompt h3 { margin: 0 0 calc(1 * var(--g)); font: 400 calc(7 * var(--g)) / 1 var(--font-display); font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--sodium) }
.prompt p { margin: 0 0 calc(2.5 * var(--g)); color: #c9c3b6 }
.acts { display: flex; gap: calc(1.5 * var(--g)) }
.acts button { flex: 1; padding: calc(2 * var(--g)); font: 700 calc(3.2 * var(--g)) var(--font-mono); letter-spacing: .06em; text-transform: uppercase; background: #16212a; color: var(--bone); border: calc(.6 * var(--g)) solid #3a4851 }
.acts button.go { background: var(--sodium); color: #0e1214; border-color: var(--sodium) }
.acts button:disabled { opacity: .4 }
.list { display: flex; flex-direction: column; gap: calc(1 * var(--g)); margin-bottom: calc(2 * var(--g)) }
.list button { display: flex; align-items: center; gap: calc(1.5 * var(--g)); padding: calc(1.5 * var(--g)) calc(2 * var(--g)); background: #16212a; color: var(--bone); border: calc(.5 * var(--g)) solid #3a4851; font: calc(3 * var(--g)) var(--font-mono); text-align: left }
.list img { width: calc(7 * var(--g)); height: calc(7 * var(--g)); object-fit: contain; image-rendering: pixelated }
.list span { flex: 1 } .list span b { color: var(--green); font-size: calc(2.4 * var(--g)) }
.list em { font-style: normal; color: var(--sodium); white-space: nowrap }
.list span small { display: block; color: var(--muted); font-size: calc(2.4 * var(--g)) }
.list button.off { opacity: .5 }
.route { margin: calc(1 * var(--g)) 0 calc(2 * var(--g)) }
.route .bar { display: block; height: calc(2 * var(--g)); background: #0b1013; border: calc(.4 * var(--g)) solid #234049; position: relative }
.route .bar b { position: absolute; left: 0; top: 0; bottom: 0; background: var(--teal, #2e86ab) }
.toggles { display: grid; grid-template-columns: 1fr 1fr; gap: calc(1 * var(--g)); margin-bottom: calc(2 * var(--g)) }
.toggles button { padding: calc(1.8 * var(--g)) calc(1 * var(--g)); background: #16212a; border: calc(.5 * var(--g)) solid #3a4851; color: var(--muted); font: 700 calc(2.8 * var(--g)) var(--font-mono); letter-spacing: .05em }
.toggles button[aria-pressed='true'] { color: var(--sodium); border-color: #f0a63c88 }
.vit { position: absolute; left: calc(2 * var(--g)); right: calc(2 * var(--g)); bottom: calc(2 * var(--g)); display: grid; grid-template-columns: repeat(4, 1fr); gap: calc(1.5 * var(--g)); padding: calc(1.5 * var(--g)) calc(2 * var(--g)); background: #0c1418e0; border: calc(.6 * var(--g)) solid #000; box-shadow: inset 0 0 0 calc(.5 * var(--g)) #3a4851 }
.vit > div { display: flex; align-items: center; gap: calc(1 * var(--g)) }
.vit img { height: calc(5 * var(--g)); image-rendering: pixelated }
.vit i { flex: 1; height: calc(1.4 * var(--g)); background: #0b1013; border: calc(.3 * var(--g)) solid #526169; position: relative }
.vit i b { position: absolute; left: 0; top: 0; bottom: 0 }
.vit .dr { grid-column: 1 / -1; justify-content: center; color: #b78be6; font: 700 calc(2.6 * var(--g)) var(--font-mono); letter-spacing: .06em }
</style>
