<script setup lang="ts">
import { CONSUMABLE_EFFECTS, PIXEL_COMBAT, rowMultOf } from '~/data/combat'
import { damageRange } from '~/stores/combat'
import { EQUIPMENT, itemInfo } from '~/data/equipment'

// The overlay both combat screens share: whose turn it is, Juan's meters, the log, the popup over whoever just got hit, and the
// thumb fan (.art/combat-ui/fan.html): one big octagon to hit with (its verb follows the weapon, with the damage at the target's row
// and the swings left), four small tiles around it (Guard, Item, Swap, Run), and a belt of pictures along the bottom edge for items
// and weapons. Long-press any of them for a one-line explanation. The fan mirrors to the left thumb when the setting says so. It draws nothing of the fight itself (that is each screen's stage). Place it inside a
// 110x225-shaped, position:relative stage; it fills it.
const props = defineProps<{
  /** The enemy Juan means to hit (street combat lets him tap one); null means the nearest. */
  picked: string | null
  /** Where the damage popup goes, in native 110x225 pixels. */
  floatAt: { x: number; y: number } | null
}>()
const combat = useCombatStore()
const player = usePlayerStore()
const inventory = useInventoryStore()
const W = 110, H = 225
const { settings } = useSettings()

// --- the belt (items or weapons) ---
const menu = ref<'item' | 'swap' | null>(null)
watch(() => combat.playerTurn, (mine) => { if (!mine) menu.value = null })
const usable = computed(() => inventory.bag.flatMap((entry, slot) => {
  const id = entry?.id
  if (!id || !CONSUMABLE_EFFECTS[id]) return []
  const info = itemInfo(id)
  return [{ slot, id, name: info?.name ?? id, sprite: info?.sprite, effect: CONSUMABLE_EFFECTS[id].label }]
}))
const weaponsInBag = computed(() => [...new Set(inventory.units.filter((id) => !!EQUIPMENT[id]?.combat))]
  .map((id) => ({ id, name: EQUIPMENT[id].name, sprite: EQUIPMENT[id].sprite, dmg: damageRange(EQUIPMENT[id].combat!.dmg).join('–'), swings: player.durabilityOf(id) })))
function act(a: 'attack' | 'guard' | 'item' | 'swap' | 'run') {
  if (longPressed) { longPressed = false; return }
  if (!combat.playerTurn) return
  if (a === 'attack') return combat.attack(props.picked ?? undefined)
  if (a === 'guard') return combat.guardAction()
  if (a === 'run') return combat.retreat()
  menu.value = menu.value === a ? null : a
}
/** The gun in hand: its magazine, and everything that could reload it (loose in his pockets plus packs in the bag). */
const gun = computed(() => PIXEL_COMBAT.guns[player.weapon.id] ?? PIXEL_COMBAT.guns.pistol!)
const loaded = computed(() => player.loadedOf(player.weapon.id))
const spareRounds = computed(() => player.spareOf(player.weapon.id) + inventory.units.reduce((n, id) => n + (gun.value.packs[id] ?? 0), 0))
const weaponLine = computed(() => {
  const w = player.weapon
  if (w.combat.gun) return `${w.name} · ${loaded.value}/${gun.value.mag}${spareRounds.value ? ' +' + spareRounds.value : ''}`
  return player.unbreakable ? w.name : `${w.name} · ${player.weaponDurability}`
})
const clearedLabel = computed(() => combat.enemies.some((e) => e.archetype === 'brute') ? 'THE BRUTE IS DOWN' : combat.fightScene === 'interior' ? 'ROOM CLEARED' : 'STREET CLEARED')
const turnLabel = computed(() => combat.outcome === 'won' ? clearedLabel.value
  : combat.outcome === 'escaped' ? 'GOT AWAY' : combat.outcome === 'lost' ? 'JUAN IS DOWN' : combat.playerTurn ? 'PLAYER TURN' : 'ENEMY TURN')
const lastLine = computed(() => combat.log[combat.log.length - 1] ?? '')

// --- the log as an old RPG message box: the line types itself out, numbers in colour (red what Juan takes, green what he heals) ---
const typed = ref('')
let typeT: ReturnType<typeof setInterval> | undefined
watch(lastLine, (line) => {
  clearInterval(typeT)
  typed.value = ''
  let k = 0
  typeT = setInterval(() => {
    k += 2
    typed.value = line.slice(0, k)
    if (k >= line.length) clearInterval(typeT)
  }, 28)
}, { immediate: true })
onBeforeUnmount(() => clearInterval(typeT))
const typing = computed(() => typed.value.length < lastLine.value.length)
/** Whose face is on the line: Juan's for what he does, the Shambler's for what is done to him. */
const speaker = computed<'juan' | 'shambler'>(() => /^(you|your|juan|click|a clean)/i.test(lastLine.value) ? 'juan'
  : /(shambler|brute|bite|bites|lunge|snarl|claw|it |they )/i.test(lastLine.value) ? 'shambler' : 'juan')
/** The face on the box jolts and flashes red when its side takes a hit. */
const jolt = ref(false)
watch(() => combat.damageFloater, (f) => {
  if (!f || (f.kind !== 'damage' && f.kind !== 'crit')) return
  if ((f.target === 'juan') === (speaker.value === 'juan')) { jolt.value = true; setTimeout(() => (jolt.value = false), 320) }
})
// The weapon gave out mid-fight: on Juan's next turn the weapon belt is already open.
let beltOnTurn = false
watch(() => player.weapon.id, (id, prev) => {
  if (combat.active && prev && id !== prev && player.weapon.combat.hands === 'fist' && weaponsInBag.value.length) beltOnTurn = true
})
watch(() => combat.playerTurn, (mine) => { if (mine && beltOnTurn) { beltOnTurn = false; menu.value = 'swap' } })
const segments = computed(() => typed.value.split(/([−-]\d+(?:\.\d+)?(?: Health)?|\+\d+(?:\.\d+)?(?: \w+)?|miss(?:es|ed)?)/i)
  .filter(Boolean)
  .map((t) => ({ t, c: /^[−-]\d/.test(t) ? 'hurt' : /^\+\d/.test(t) ? 'heal' : /^miss/i.test(t) ? 'miss' : '' })))

// --- the popup over whoever just got hit, healed, or missed ---
const floaterText = computed(() => {
  const f = combat.damageFloater
  if (!f) return ''
  if (f.kind === 'miss') return 'MISS'
  if (f.kind === 'heal') return `+${f.amount}`
  return `${f.kind === 'crit' ? 'CRIT ' : ''}−${f.amount}`
})

// --- the odds, on the buttons ---
const aimed = computed(() => combat.livingEnemies.find((e) => e.id === props.picked) ?? [...combat.livingEnemies].sort((a, b) => a.row - b.row)[0])
const hint = computed<Record<string, string>>(() => {
  const w = player.weapon, t = aimed.value
  const mult = t ? rowMultOf(w.combat, t.row) : 1
  const [lo, hi] = damageRange(w.combat.dmg).map((d) => Math.round(d * mult * 10) / 10)
  return {
    attack: w.combat.gun && loaded.value <= 0 ? (spareRounds.value ? 'reload' : 'empty') : lo === hi ? `${lo} dmg` : `${lo}–${hi}`,
    guard: '½ next hit',
    item: `${usable.value.length}`,
    swap: `${weaponsInBag.value.length}`,
    run: combat.retreatOdds ? `${Math.round(combat.retreatOdds * 100)}%` : 'no',
  }
})
/** Two swings left (or fewer) and the weapon's handle is going: the readout shakes red. */
const wearing = computed(() => !player.unbreakable && !player.weapon.combat.gun && player.weaponDurability <= 2)

// --- the thumb fan ---
const ROWS = ['CLOSE', 'MID', 'FAR']
const VERB: Record<string, string> = { itak: 'CHOP', 'fire-axe': 'CHOP', knife: 'STAB', balisong: 'STAB', sibat: 'THRUST', fists: 'PUNCH', pistol: 'SHOOT', sumpak: 'FIRE', hammer: 'SMASH' }
const verb = computed(() => VERB[player.weapon.id] ?? (player.weapon.combat.hands === 'fist' ? 'PUNCH' : 'SWING'))
/** What the big button says under the verb: the target's row (on the street) and the damage there, or what is wrong. */
const atkLine = computed(() => {
  if (wearing.value) return 'CRACKING'
  const h = hint.value.attack
  if (h === 'reload' || h === 'empty') return h.toUpperCase()
  const row = aimed.value && combat.fightScene !== 'interior' && !player.weapon.combat.gun ? `${ROWS[aimed.value.row] ?? ''} · ` : player.weapon.combat.lane ? 'LANE · ' : ''
  return row + h.replace(' dmg', '')
})
/** Pips under the verb: swings left (up to 8 shown), or rounds in the magazine for the gun. */
const pips = computed(() => {
  if (player.weapon.combat.gun) return { on: loaded.value, of: gun.value.mag }
  if (player.unbreakable) return null
  return { on: Math.min(8, player.weaponDurability), of: Math.min(8, Math.max(player.weaponDurability, 1)) }
})
// four tiles on an arc around the octagon's centre, in native pixels inside the 64x64 fan box
const TILE_COL = { guard: '#7cc4e6', item: '#7fd08f', swap: '#f0a63c', run: '#ff8a7a' } as const
const tiles = computed(() => {
  const cx = 47, cy = 47, rad = 33
  return (['guard', 'item', 'swap', 'run'] as const).map((k, i) => {
    const a = ([180, 207, 243, 270][i]! * Math.PI) / 180
    let x = cx + Math.cos(a) * rad - 8
    const y = cy + Math.sin(a) * rad - 8
    if (settings.lefty) x = 64 - 16 - x
    const label = k === 'run' ? (combat.retreatOdds ? `RUN ${Math.round(combat.retreatOdds * 100)}%` : 'NO RUN') : k.toUpperCase()
    const badge = k === 'item' ? usable.value.length : k === 'swap' ? weaponsInBag.value.length : 0
    const off = !combat.playerTurn || (k === 'run' && combat.retreatOdds === 0) || (k === 'item' && !usable.value.length) || (k === 'swap' && !weaponsInBag.value.length)
    return { k, x, y, label, badge, off, color: TILE_COL[k], on: (k === 'guard' && combat.guarding) || menu.value === k }
  })
})
// 9x9 icons, drawn once at the game's own scale
const ICONS: Record<string, string> = {}
if (typeof document !== 'undefined') {
  const draw = (fn: (r: (x: number, y: number, w: number, h: number, c: string) => void) => void) => {
    const cv = document.createElement('canvas'); cv.width = 9; cv.height = 9
    const c = cv.getContext('2d')!
    fn((x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h) })
    return cv.toDataURL()
  }
  ICONS.guard = draw((r) => { const o = '#000', k = TILE_COL.guard; r(1, 0, 7, 1, o); r(0, 1, 9, 4, o); r(1, 5, 7, 1, o); r(2, 6, 5, 1, o); r(3, 7, 3, 1, o); r(4, 8, 1, 1, o); r(1, 1, 7, 4, k); r(2, 5, 5, 1, k); r(3, 6, 3, 1, k); r(4, 7, 1, 1, k); r(4, 1, 1, 6, '#2e6a86'); r(1, 1, 3, 1, '#d6f0ff') })
  ICONS.item = draw((r) => { r(1, 1, 7, 7, '#000'); r(2, 2, 5, 5, '#ece4d5'); r(4, 2, 1, 5, '#d94b3b'); r(2, 4, 5, 1, '#d94b3b'); r(2, 2, 1, 1, '#fff') })
  ICONS.swap = draw((r) => { const k = TILE_COL.swap; r(0, 1, 7, 2, '#000'); r(0, 1, 6, 1, k); r(5, 0, 1, 4, k); r(6, 1, 1, 2, k); r(2, 6, 7, 2, '#000'); r(3, 6, 6, 1, k); r(3, 5, 1, 4, k); r(2, 6, 1, 2, k) })
  ICONS.run = draw((r) => { const k = TILE_COL.run; r(0, 3, 6, 3, '#000'); r(0, 4, 6, 1, k); r(5, 1, 2, 7, '#000'); r(5, 2, 1, 5, k); r(6, 3, 1, 3, k); r(7, 4, 1, 1, k); r(7, 3, 1, 3, '#000') })
}
// long-press: say what the button does
const TIPS: Record<string, string> = {
  attack: 'Hit the marked Shambler. Damage drops with distance: CLOSE full, MID ×0.6, FAR ×0.3 (a spear reaches MID at full, guns ignore it).',
  guard: 'Raise the weapon: the next bite does half.',
  item: 'Use something from the bag. Costs the turn.',
  swap: 'Change weapon. Costs the turn.',
  run: 'Try to break away. Better when nothing is CLOSE.',
}
const tip = ref<{ k: string; x: number; y: number } | null>(null)
let lpTimer: ReturnType<typeof setTimeout> | undefined
let longPressed = false
function pressStart(k: string, e: PointerEvent) {
  clearTimeout(lpTimer)
  const el = e.currentTarget as HTMLElement
  lpTimer = setTimeout(() => {
    longPressed = true
    const box = el.closest('.hud-layer')!.getBoundingClientRect(), r = el.getBoundingClientRect()
    tip.value = { k, x: ((r.left - box.left) / box.width) * W, y: ((r.top - box.top) / box.height) * H }
    setTimeout(() => { tip.value = null }, 2200)
  }, 420)
}
function pressEnd() { clearTimeout(lpTimer) }
function tileTap(k: 'guard' | 'item' | 'swap' | 'run') { act(k) }
</script>

<template>
  <div class="hud-layer">
    <div class="turn" :class="combat.outcome ? (combat.outcome === 'lost' ? 'down' : 'won') : combat.playerTurn ? 'player' : 'enemy'">{{ turnLabel }}</div>
    <div class="hud">
      <div><span>HP</span><i class="bar"><b :style="{ transform: `scaleX(${player.health / 100})`, background: 'var(--sari-red)' }" /></i></div>
      <div><span :style="{ color: player.shaken ? '#b78be6' : undefined }">{{ player.shaken ? 'SHAKEN' : 'DREAD' }}</span><i class="bar"><b :style="{ transform: `scaleX(${player.dread / 100})`, background: '#8a5cc2' }" /></i></div>
      <div class="weapon" :class="{ wearing }">{{ weaponLine }}{{ wearing ? ' · CRACKING' : '' }}</div>
      <div v-if="combat.regen" class="regen">REGEN +{{ combat.regen.amount }} × {{ combat.regen.turns }}</div>
    </div>
    <div v-if="floatAt && floaterText" :key="floaterText + floatAt.x" class="floater" :class="combat.damageFloater?.kind"
      :style="{ left: `${floatAt.x / W * 100}%`, top: `${floatAt.y / H * 100}%` }">{{ floaterText }}</div>
    <div v-if="lastLine" class="logbox" aria-live="polite" :aria-label="lastLine">
      <img class="face" :class="{ jolt }" :src="`/game/kit/out/portrait-${speaker}.png`" alt="">
      <p><span v-for="(sg, i) in segments" :key="i" :class="sg.c">{{ sg.t }}</span><i v-if="!typing" class="caret">▼</i></p>
    </div>

    <div v-if="combat.guarding" class="guardtag">GUARDING</div>

    <!-- the belt: items or weapons as pictures, along the bottom edge beside the fan -->
    <div v-if="menu" class="belt" :class="{ lefty: settings.lefty }">
      <button class="x" aria-label="Close" @click="menu = null">✕</button>
      <div class="cards">
        <template v-if="menu === 'item'">
          <button v-for="it in usable" :key="it.slot" class="card" :style="{ '--c': TILE_COL.item }" :aria-label="`Use ${it.name}`" @click="combat.useItem(it.slot); menu = null">
            <img v-if="it.sprite" :src="it.sprite" alt=""><span>{{ it.name }}</span><em>{{ it.effect.split(',')[0] }}</em>
          </button>
          <span v-if="!usable.length" class="none">Nothing that helps here.</span>
        </template>
        <template v-else>
          <button v-for="w in weaponsInBag" :key="w.id" class="card" :style="{ '--c': TILE_COL.swap }" :aria-label="`Swap to ${w.name}`" @click="combat.swapWeapon(w.id); menu = null">
            <img v-if="w.sprite" :src="w.sprite" alt=""><span>{{ w.name }}</span><em>{{ w.dmg }} dmg{{ w.swings !== undefined && Number.isFinite(w.swings) ? ' · ' + w.swings : '' }}</em>
          </button>
          <span v-if="!weaponsInBag.length" class="none">No other weapon.</span>
        </template>
      </div>
    </div>

    <!-- the thumb fan -->
    <div class="fan" :class="{ wait: !combat.playerTurn, belted: !!menu, lefty: settings.lefty }">
      <button class="atk oct" :class="{ crack: wearing, pulse: combat.playerTurn }" :disabled="!combat.playerTurn" :aria-label="verb"
        @click="act('attack')" @pointerdown="pressStart('attack', $event)" @pointerup="pressEnd" @pointerleave="pressEnd" @contextmenu.prevent>
        <span class="in oct">
          <img v-if="player.weapon.sprite" :src="player.weapon.sprite" alt="">
          <b>{{ verb }}</b><span class="dmg">{{ atkLine }}</span>
        </span>
        <span v-if="pips" class="wear"><i v-for="n in pips.of" :key="n" :class="{ off: n > pips.on }" /></span>
      </button>
      <button v-for="t in tiles" :key="t.k" class="tile" :class="{ on: t.on }" :disabled="t.off" :aria-label="t.label"
        :style="{ '--c': t.color, left: `${(t.x / 64) * 100}%`, top: `${(t.y / 64) * 100}%` }"
        @click="tileTap(t.k)" @pointerdown="pressStart(t.k, $event)" @pointerup="pressEnd" @pointerleave="pressEnd" @contextmenu.prevent>
        <span class="in"><img :src="ICONS[t.k]" alt=""></span>
        <span v-if="t.badge" class="badge">{{ t.badge }}</span>
        <span class="lab">{{ t.label }}</span>
      </button>
    </div>
    <div v-if="tip" class="tip" :style="{ left: `${Math.max(2, Math.min(W - 54, tip.x - 20)) / W * 100}%`, top: `${Math.max(30, tip.y - 22) / H * 100}%` }">
      <b>{{ tip.k === 'attack' ? verb : tip.k.toUpperCase() }}</b> · {{ TIPS[tip.k] }}
    </div>
  </div>
</template>

<style scoped>
.hud-layer { position:absolute; inset:0; pointer-events:none; }
.turn { position:absolute; left:8px; top:8px; padding:5px 7px; font:700 11px/1 var(--font-mono, ui-monospace); letter-spacing:.16em; background:rgba(8,10,11,.72); border:1px solid #2b2f31; pointer-events:none; }
.turn.player { color:var(--sari-yel, #F0A63C); } .turn.enemy { color:var(--sari-red, #D94B3B); } .turn.won { color:#5AA17A; } .turn.down { color:var(--bone, #ECE4D5); background:rgba(90,16,12,.85); }
.hud { position:absolute; right:8px; top:8px; width:42%; display:flex; flex-direction:column; gap:4px; font:700 9px/1 var(--font-mono, ui-monospace); letter-spacing:.1em; pointer-events:none; }
.hud > div { display:flex; align-items:center; gap:5px; } .hud span { width:40px; color:#828B90; }
.bar { flex:1; height:6px; background:#0b0d0e; border:1px solid #3b3f41; display:block; } .bar b { display:block; height:100%; transform-origin:left; transition:transform .2s steps(4); }
.weapon { justify-content:flex-end; color:var(--sari-yel, #F0A63C); }
.logbox { position:absolute; left:calc(2 * var(--g, 4px)); right:calc(2 * var(--g, 4px)); top:calc(14 * var(--g, 4px)); display:flex; align-items:center; gap:calc(2 * var(--g, 4px)); min-height:calc(24 * var(--g, 4px)); padding:calc(3 * var(--g, 4px)) calc(4 * var(--g, 4px));
  border:calc(5 * var(--g, 4px)) solid transparent; border-image:url('/game/kit/out/dialog-frame.png') 5 fill / calc(5 * var(--g, 4px)) stretch; image-rendering:pixelated; pointer-events:none; box-sizing:border-box; }
.logbox .face { flex:none; width:calc(16 * var(--g, 4px)); height:calc(17 * var(--g, 4px)); image-rendering:pixelated; margin:calc(-3 * var(--g, 4px)) 0; }
.logbox .face.jolt { animation:jolt .32s steps(4); }
@keyframes jolt { 0% { transform:translate(-2px, 1px); filter:sepia(1) saturate(6) hue-rotate(-40deg) brightness(1.1); } 50% { transform:translate(2px, -1px); filter:sepia(1) saturate(6) hue-rotate(-40deg); } 100% { transform:none; filter:none; } }
.logbox p { flex:1; margin:0; font:700 calc(3.1 * var(--g, 4px))/1.45 var(--font-mono, ui-monospace); letter-spacing:.03em; color:#f2ecdc; text-shadow:calc(.4 * var(--g, 4px)) calc(.4 * var(--g, 4px)) 0 #000; }
.logbox .hurt { color:#ff7b66; } .logbox .heal { color:#7ee0a0; } .logbox .miss { color:#9aa6ac; }
.caret { display:inline-block; margin-left:calc(1 * var(--g, 4px)); font-style:normal; font-size:.75em; color:#f0a63c; animation:caret .8s steps(2) infinite; }
@keyframes caret { 50% { opacity:0; transform:translateY(calc(.6 * var(--g, 4px))); } }
.weapon.wearing { color:var(--sari-red, #D94B3B); animation:wear .5s steps(2) infinite; }
@keyframes wear { 50% { transform:translateX(1px); } }
.regen { justify-content:flex-end; color:#5AA17A; }
.floater { position:absolute; transform:translate(-50%, -100%); font:800 14px/1 var(--font-mono, ui-monospace); color:#fff5e0; text-shadow:2px 2px 0 #000; pointer-events:none; animation:float .7s ease-out forwards; white-space:nowrap; }
.floater.damage { color:#ff8a6a; } .floater.crit { color:var(--sari-yel, #F2C94C); font-size:16px; } .floater.heal { color:#7ee0a0; } .floater.miss { color:#c9d1d5; font-size:12px; }
@keyframes float { from { opacity:1; margin-top:0; } to { opacity:0; margin-top:-18px; } }
/* the fan: g = one native pixel of the 110x225 stage */
.hud-layer { container-type: size; }
.hud-layer > * { --g: calc(100cqw / 110); }
.fan { position:absolute; right:calc(2 * var(--g)); bottom:calc(2 * var(--g)); width:calc(64 * var(--g)); height:calc(64 * var(--g)); pointer-events:auto; transition:opacity .2s; }
.fan.lefty { right:auto; left:calc(2 * var(--g)); }
.fan.wait { opacity:.45; }
.oct { clip-path:polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%); }
.atk { position:absolute; right:0; bottom:0; width:calc(34 * var(--g)); height:calc(34 * var(--g)); padding:0; border:0; background:#000; cursor:pointer; }
.fan.lefty .atk { right:auto; left:0; }
.atk .in { position:absolute; inset:var(--g); background:#f0a63c; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:calc(.6 * var(--g)); }
.atk .in::after { content:''; position:absolute; left:0; right:0; bottom:0; height:calc(4 * var(--g)); background:#c9821f; }
.atk img { position:relative; z-index:1; height:calc(15 * var(--g)); transform:rotate(-24deg); image-rendering:pixelated; filter:drop-shadow(calc(.7 * var(--g)) calc(.7 * var(--g)) 0 #0007); }
.atk b { position:relative; z-index:1; font:400 calc(5.4 * var(--g))/1 "Arial Narrow", Impact, sans-serif; font-weight:800; letter-spacing:.06em; color:#1c1408; }
.atk .dmg { position:relative; z-index:1; font:700 calc(2.8 * var(--g))/1 var(--font-mono, ui-monospace); color:#1c1408; letter-spacing:.06em; }
.atk .wear { position:absolute; z-index:2; left:50%; bottom:calc(1.6 * var(--g)); transform:translateX(-50%); display:flex; flex-wrap:wrap; justify-content:center; gap:calc(.4 * var(--g)); width:max-content; max-width:calc(9 * 1.8 * var(--g)); }   /* 18 rounds: two rows of nine */
.atk .wear i { width:calc(1.4 * var(--g)); height:calc(1.4 * var(--g)); background:#1c1408; } .atk .wear i.off { background:#1c140840; }
.atk:active .in { transform:translateY(calc(.8 * var(--g))); }
.atk.crack .in { background:#e0584a; } .atk.crack .in::after { background:#9c2f24; } .atk.crack { animation:wear .45s steps(2) infinite; }
.atk.pulse::before { content:''; position:absolute; inset:0; background:#fff; opacity:0; animation:pl 1.6s ease-in-out infinite; z-index:3; pointer-events:none; }
@keyframes pl { 50% { opacity:.14; } }
.tile { position:absolute; width:25%; height:25%; padding:0; border:0; background:#000; cursor:pointer; }
.tile .in { position:absolute; inset:var(--g); display:flex; align-items:center; justify-content:center; background:#141c22; box-shadow:inset 0 0 0 var(--g) var(--c); }
.tile .in::after { content:''; position:absolute; left:var(--g); right:var(--g); bottom:var(--g); height:calc(2 * var(--g)); background:#0007; }
.tile img { position:relative; z-index:1; width:calc(9 * var(--g)); height:calc(9 * var(--g)); image-rendering:pixelated; }
.tile .badge { position:absolute; right:calc(-1 * var(--g)); top:calc(-1 * var(--g)); z-index:2; min-width:calc(5 * var(--g)); height:calc(5 * var(--g)); padding:0 calc(.6 * var(--g)); background:#000; color:var(--c); font:700 calc(3 * var(--g))/calc(5 * var(--g)) var(--font-mono, ui-monospace); text-align:center; }
.tile .lab { position:absolute; left:50%; top:calc(15.5 * var(--g)); transform:translateX(-50%); z-index:2; padding:0 calc(.8 * var(--g)); background:#000c; color:var(--c); font:700 calc(2.5 * var(--g))/calc(3.6 * var(--g)) var(--font-mono, ui-monospace); letter-spacing:.08em; white-space:nowrap; }
.tile:active .in { transform:translateY(calc(.6 * var(--g))); }
.tile.on .in { background:#22303a; box-shadow:inset 0 0 0 var(--g) #fff, inset 0 0 0 calc(2 * var(--g)) var(--c); }
.tile:disabled { cursor:default; } .tile:disabled .in { filter:grayscale(1) brightness(.5); }
.fan.belted .tile:not(.on) { opacity:.25; }
.belt { position:absolute; bottom:calc(2 * var(--g)); left:calc(2 * var(--g)); right:calc(61 * var(--g)); height:calc(26 * var(--g)); display:flex; gap:var(--g); padding:var(--g); background:#000; pointer-events:auto; animation:bin .16s steps(3); z-index:2; }
.belt.lefty { left:calc(61 * var(--g)); right:calc(2 * var(--g)); }
@keyframes bin { from { transform:translateY(calc(8 * var(--g))); opacity:0; } }
.belt .cards { flex:1; display:flex; gap:var(--g); overflow-x:auto; scrollbar-width:none; }
.belt .card { flex:0 0 calc(14 * var(--g)); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:calc(.6 * var(--g)); padding:var(--g) 0; background:#141c22; border:0; box-shadow:inset 0 0 0 calc(.6 * var(--g)) var(--c); color:var(--bone, #ECE4D5); font:700 calc(2.2 * var(--g))/1.15 var(--font-mono, ui-monospace); text-align:center; cursor:pointer; overflow:hidden; }
.belt .card span { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 calc(.5 * var(--g)); }
.belt .card img { height:calc(8 * var(--g)); max-width:90%; object-fit:contain; image-rendering:pixelated; }
.belt .card em { font-style:normal; color:var(--c); font-size:calc(2 * var(--g)); }
.belt .x { flex:0 0 calc(8 * var(--g)); background:#141c22; border:0; color:#828B90; font:700 calc(4 * var(--g)) var(--font-mono, ui-monospace); cursor:pointer; }
.belt .none { align-self:center; padding:0 calc(2 * var(--g)); color:#828B90; font:calc(2.8 * var(--g)) var(--font-mono, ui-monospace); }
.tip { position:absolute; z-index:5; width:calc(52 * var(--g)); padding:calc(1.5 * var(--g)) calc(2.5 * var(--g)); background:#0c1418f6; border:calc(.6 * var(--g)) solid #526169; color:var(--bone, #ECE4D5); font:calc(3 * var(--g))/1.35 var(--font-mono, ui-monospace); pointer-events:none; }
.tip b { color:var(--sari-yel, #F0A63C); }
.guardtag { position:absolute; left:50%; top:44%; transform:translateX(-50%); font:700 calc(3.2 * var(--g)) var(--font-mono, ui-monospace); color:#9fd6ee; text-shadow:1px 1px 0 #000; letter-spacing:.15em; pointer-events:none; }
</style>
