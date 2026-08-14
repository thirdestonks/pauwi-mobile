<script setup lang="ts">
// Placeholder combat demo — real turn-based mechanics arrive with Phase 3.
// State here is local and self-contained, matching reference.html's vanilla-JS demo.
const ui = useUiStore()

// Low-odds escape: most retreat attempts fail and cost health but keep you in the fight.
const RETREAT_CHANCE = 0.25

// Enemy rank: index 0 is always the front/targetable Shambler. Killing it shifts the
// next one up to front; an empty rank means the encounter is over.
interface Enemy { hp: number; dying: boolean }
const enemies = ref<Enemy[]>([
  { hp: 64, dying: false },
  { hp: 100, dying: false },
])
const frontEnemy = computed(() => enemies.value[0] ?? null)
const rearEnemy = computed(() => enemies.value[1] ?? null)

const hHp = ref(72)
const dread = ref(45)
const log = ref('You feel for the wall in the fog and find bars instead — two Shamblers already between you and the street.')

const shaken = computed(() => dread.value >= 60)

// Juan's battle sprite: idle/attack/swoosh/hurt/die generated so far — "ready to run" pose
// still pending, so retreat currently flashes the hurt pose instead of a dedicated one.
type JuanPose = 'idle' | 'attack' | 'swoosh' | 'hurt' | 'die'
const JUAN_POSES: Record<JuanPose, string> = {
  idle: '/images/juan-idle.png',
  attack: '/images/juan-attack.png',
  swoosh: '/images/juan-swoosh.png',
  hurt: '/images/juan-hurt.png',
  die: '/images/juan-die.png',
}
const pose = ref<JuanPose>('idle')
const juanImg = computed(() => JUAN_POSES[pose.value])

// Enemy hit-flash — toggled true then false so the CSS animation restarts on each attack.
const enemyHit = ref(false)

function attack() {
  const front = enemies.value[0]
  if (!front) return

  front.hp = Math.max(0, front.hp - 30)
  dread.value = Math.min(100, dread.value + 8)

  const dropped = front.hp <= 0
  log.value = dropped
    ? (enemies.value.length > 1
        ? 'The front Shambler drops. One left, and it\'s already turning toward you.'
        : 'The Shambler drops. The alley ahead is clear — for now.')
    : 'You swing the nailed plank into the front Shambler — it staggers, snarling.'

  // Two-beat swing: wind-up, then the follow-through/impact frame with the flash landing on contact.
  pose.value = 'attack'
  setTimeout(() => {
    if (pose.value === 'die') return
    pose.value = 'swoosh'
    enemyHit.value = true
    setTimeout(() => { enemyHit.value = false }, 400)
    setTimeout(() => { if (pose.value !== 'die') pose.value = 'idle' }, 300)

    if (dropped) {
      front.dying = true
      // Let the dim/dead sprite read for a beat before the rank shifts — the rear
      // Shambler (if any) then steps up into the front/targetable slot automatically.
      setTimeout(() => {
        enemies.value.shift()
        if (enemies.value.length === 0) {
          setTimeout(() => ui.setTab('map'), 700)
        }
      }, 500)
    }
  }, 180)
}

function guard() {
  log.value = 'You brace against the wall, weapon up — the next hit will land soft.'
}

function useItem() {
  hHp.value = Math.min(100, hHp.value + 20)
  log.value = 'You tear open the bandage one-handed — +20% Health, but you\'re still cornered.'
}

function retreat() {
  if (Math.random() < RETREAT_CHANCE) {
    log.value = 'You break for the mouth of the alley — and this time, you make it. Clean.'
    setTimeout(() => ui.setTab('map'), 700)
    return
  }

  hHp.value = Math.max(0, hHp.value - 12)
  if (hHp.value <= 0) {
    pose.value = 'die'
  } else {
    pose.value = 'hurt'
    setTimeout(() => { if (pose.value !== 'die') pose.value = 'idle' }, 500)
  }
  log.value = 'You break for the mouth of the alley — it drags you back by the collar. −12% Health, and you\'re still cornered.'
}
</script>

<template>
  <div class="flex-1 overflow-y-auto pb-4">
    <div class="flex items-center justify-between px-4 pt-3 pb-1">
      <div class="flex items-center gap-1.5 text-[9px] tracking-wide" style="font-family: var(--font-mono); color: var(--sari-red)">
        <span class="w-1.5 h-1.5" style="background: var(--sari-red); animation: flick 1.6s infinite" />
        AMBUSH
      </div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">ROUND 2</div>
    </div>

    <div class="flex items-center gap-1.5 px-4 pb-2 overflow-x-auto">
      <span class="text-[8px] tracking-wide mr-0.5" style="font-family: var(--font-mono); color: var(--muted)">ORDER</span>
      <div class="w-[26px] h-[26px] flex items-center justify-center text-[13px]" style="border: 2px solid var(--sodium); background: rgba(240,166,60,.15); box-shadow: 2px 2px 0 rgba(0,0,0,.4); image-rendering: pixelated">🧍</div>
      <span style="color: var(--line)">→</span>
      <div class="w-[26px] h-[26px] flex items-center justify-center text-[13px]" style="border: 2px solid #3a4a34; background: rgba(90,161,122,.08); box-shadow: 2px 2px 0 rgba(0,0,0,.3); image-rendering: pixelated">🧟</div>
      <span style="color: var(--line)">→</span>
      <div class="w-[26px] h-[26px] flex items-center justify-center text-[13px]" style="border: 2px solid #3a4a34; background: rgba(90,161,122,.08); box-shadow: 2px 2px 0 rgba(0,0,0,.3); image-rendering: pixelated">🧟</div>
      <span style="color: var(--line)">→</span>
      <div class="w-[26px] h-[26px] flex items-center justify-center text-[13px]" style="border: 2px solid var(--sodium); background: var(--panel); box-shadow: 2px 2px 0 rgba(0,0,0,.3); image-rendering: pixelated">🧍</div>
    </div>

    <!-- Diorama frame: corrugated-tin border, riveted corners, hazard-tape title ribbon — hard pixel edges, no rounding -->
    <div class="relative mx-4 mt-2 p-[7px]" style="background: repeating-linear-gradient(100deg, #4d5256 0 4px, #34383b 4px 8px); box-shadow: 0 4px 0 rgba(0,0,0,.5)">
      <i class="absolute w-2 h-2" style="top: 4px; left: 4px; background: #1a1a1a; box-shadow: inset 1px 1px 0 rgba(255,255,255,.25)" />
      <i class="absolute w-2 h-2" style="top: 4px; right: 4px; background: #1a1a1a; box-shadow: inset 1px 1px 0 rgba(255,255,255,.25)" />
      <i class="absolute w-2 h-2" style="bottom: 4px; left: 4px; background: #1a1a1a; box-shadow: inset 1px 1px 0 rgba(255,255,255,.25)" />
      <i class="absolute w-2 h-2" style="bottom: 4px; right: 4px; background: #1a1a1a; box-shadow: inset 1px 1px 0 rgba(255,255,255,.25)" />

      <div class="absolute left-1/2 px-3 py-1 z-10" style="top: -11px; transform: translateX(-50%) rotate(-1deg); background: repeating-linear-gradient(45deg, var(--sari-yel) 0 8px, #1a1712 8px 16px); box-shadow: 0 2px 0 rgba(0,0,0,.5)">
        <span class="uppercase text-[10px] whitespace-nowrap" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px; color: #1a1712">Fogged Alley</span>
      </div>

      <div class="relative overflow-hidden" style="aspect-ratio: 5/4; background: #0a0d0e">
        <img src="/images/combat-bg-fogged-alley.png" class="absolute inset-0 w-full h-full pointer-events-none" style="object-fit: cover; object-position: 50% 60%; image-rendering: pixelated" />
        <div class="absolute inset-0 pointer-events-none" style="background: linear-gradient(180deg, rgba(10,13,14,.1), rgba(10,13,14,.2) 55%, rgba(10,13,14,.6) 100%)" />

        <!-- rear enemy (blocked, out of range) — image itself is bottom-anchored; tag/bar float as overlays so they don't push the sprite up -->
        <div v-if="rearEnemy" class="absolute bottom-2" style="right: 12%; opacity: .7">
          <div class="relative">
            <div class="absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[8px] whitespace-nowrap" style="bottom: 100%; margin-bottom: 4px; font-family: var(--font-mono); background: rgba(12,17,19,.8); color: var(--muted)">REAR · blocked</div>
            <img src="/images/zombie-idle.png" class="w-20 h-32 object-contain object-bottom block" style="filter: grayscale(.35) drop-shadow(2px 2px 0 rgba(0,0,0,.6)); image-rendering: pixelated" />
            <div class="absolute left-1/2 -translate-x-1/2 w-20" style="top: 100%; margin-top: 4px">
              <div class="w-20 h-1.5 overflow-hidden" style="background: #0c1113"><b class="block h-full" :style="{ width: rearEnemy.hp + '%', background: 'linear-gradient(90deg,#7a2e26,#d94b3b)' }" /></div>
            </div>
          </div>
        </div>

        <!-- front enemy (targetable) — image itself is bottom-anchored; tag/label/bar float as overlays so they don't push the sprite up -->
        <div v-if="frontEnemy" class="absolute bottom-2" style="right: 34%">
          <div class="relative">
            <div class="absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[8px] tracking-wide whitespace-nowrap" style="bottom: 100%; margin-bottom: 4px; font-family: var(--font-mono); background: var(--sari-red); color: #1a0a08">TARGET</div>
            <img
              :src="frontEnemy.dying ? '/images/zombie-die.png' : '/images/zombie-idle.png'"
              class="w-20 h-32 object-contain object-bottom block"
              :class="{ 'hit-flash': enemyHit }"
              style="filter: drop-shadow(2px 2px 0 rgba(0,0,0,.6)); image-rendering: pixelated"
            />
            <div class="absolute left-1/2 -translate-x-1/2 w-20 text-center" style="top: 100%; margin-top: 2px">
              <div class="uppercase text-[9px] whitespace-nowrap" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px; color: var(--bone); text-shadow: 1px 1px 0 #000">Shambler</div>
              <div class="w-20 h-1.5 overflow-hidden mt-1 mx-auto" style="background: #0c1113"><b class="block h-full" :style="{ width: frontEnemy.hp + '%', background: 'linear-gradient(90deg,#7a2e26,#d94b3b)' }" /></div>
            </div>
          </div>
        </div>

        <!-- Juan — same bottom-anchored-image pattern, so his feet line up with the zombies' feet -->
        <div class="absolute bottom-2 left-5">
          <div class="relative">
            <img :src="juanImg" class="w-20 h-28 object-contain object-bottom block" style="filter: drop-shadow(2px 2px 0 rgba(0,0,0,.6)); image-rendering: pixelated" />
            <div class="absolute left-1/2 -translate-x-1/2 uppercase text-[9px] whitespace-nowrap" style="top: 100%; margin-top: 2px; font-family: var(--font-display); font-weight: 700; letter-spacing: .5px; color: var(--sodium); text-shadow: 1px 1px 0 #000">Juan</div>
          </div>
        </div>

        <!-- Juan HUD chip -->
        <div class="absolute top-2 right-2 w-24 p-1.5" style="background: rgba(12,17,19,.85); border: 1px solid var(--line)">
          <div class="flex justify-between text-[7px] mb-0.5" style="font-family: var(--font-mono); color: var(--muted)"><span>HP</span><span>{{ hHp }}%</span></div>
          <div class="h-1 overflow-hidden mb-1" style="background: #0c1113"><b class="block h-full" :style="{ width: hHp + '%', background: 'linear-gradient(90deg,#d94b3b,#e88a4a)' }" /></div>
          <div class="flex justify-between text-[7px] mb-0.5" style="font-family: var(--font-mono); color: var(--muted)"><span>DREAD</span><span>{{ dread }}%</span></div>
          <div class="h-1 overflow-hidden" style="background: #0c1113"><b class="block h-full" :style="{ width: dread + '%', background: 'linear-gradient(90deg,#5c2f6b,var(--dread-bright))' }" /></div>
        </div>
      </div>
    </div>

    <div class="mx-4 mt-3 mb-3 p-2.5 relative text-[11px] leading-relaxed" style="background: var(--panel); border: 1px solid var(--line); font-family: var(--font-mono); color: #cdc6b8; min-height: 44px">
      <i class="absolute -top-1.5 left-4 w-8 h-3" style="background: rgba(217,75,59,.35); transform: rotate(-3deg); box-shadow: 1px 1px 0 rgba(0,0,0,.4)" />
      {{ log }}
    </div>
    <div class="mx-4 mb-3 text-[11px]" style="font-family: var(--font-mono); color: var(--muted)">Weapon: <b style="color: var(--bone); font-weight: 400">🔨 Nailed Plank</b> · durability ▮▮▮ · Attacks the FRONT enemy only</div>
    <div v-if="shaken" class="mx-4 mb-3.5 flex items-center gap-1.5 text-[9px] tracking-wide" style="font-family: var(--font-mono); color: var(--dread-bright)">
      <span class="w-1.5 h-1.5" style="background: var(--dread-bright); box-shadow: 0 0 6px var(--dread-bright)" /> SHAKEN — next Attack has reduced accuracy
    </div>

    <div class="grid grid-cols-2 gap-2.5 mx-4 mb-2">
      <div class="p-3 flex flex-col items-center gap-1" style="background: var(--panel2); border: 1px solid var(--sari-red); box-shadow: 3px 3px 0 rgba(0,0,0,.35)" @click="attack">
        <span class="text-lg" style="image-rendering: pixelated">⚔️</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Attack</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Hit the front Shambler</span>
      </div>
      <div class="p-3 flex flex-col items-center gap-1" style="background: var(--panel2); border: 1px dashed var(--line); box-shadow: 3px 3px 0 rgba(0,0,0,.35)" @click="guard">
        <span class="text-lg" style="image-rendering: pixelated">🛡️</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Guard</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Halve next hit taken</span>
      </div>
      <div class="p-3 flex flex-col items-center gap-1" style="background: var(--panel2); border: 1px dashed var(--line); box-shadow: 3px 3px 0 rgba(0,0,0,.35)" @click="useItem">
        <span class="text-lg" style="image-rendering: pixelated">🩹</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Use Item</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Bandage · +20% Health</span>
      </div>
      <div class="p-3 flex flex-col items-center gap-1" style="background: var(--panel2); border: 1px dashed var(--muted); box-shadow: 3px 3px 0 rgba(0,0,0,.35)" @click="retreat">
        <span class="text-lg" style="image-rendering: pixelated">🏃</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Retreat</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Low odds — failure costs Health</span>
      </div>
    </div>
  </div>
</template>
