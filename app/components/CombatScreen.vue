<script setup lang="ts">
import { CONSUMABLE_EFFECTS } from '~/data/combat'
import { itemInfo } from '~/data/equipment'
import type { JuanPose } from '~/stores/combat'

// Everything on this screen is drawn from the combat store. No local refs hold fight
// state any more — that's what let a swing keep resolving after you'd left the screen.

const combat = useCombatStore()
const player = usePlayerStore()
const inventory = useInventoryStore()

// Juan's battle sprite: idle/attack/swoosh/hurt/die generated so far — "ready to run" pose
// still pending, so retreat reuses the hurt pose.
const JUAN_POSES: Record<JuanPose, string> = {
  idle: '/images/juan-idle.png',
  attack: '/images/juan-attack.png',
  swoosh: '/images/juan-swoosh.png',
  hurt: '/images/juan-hurt.png',
  die: '/images/juan-die.png',
}
const juanImg = computed(() => JUAN_POSES[combat.pose])

// Enemy sprite sets, per archetype. The Shambler has idle/die on disk; the Brute has
// idle/attack/die (no hurt pose — its hit-flash just holds idle). Verified in-game:
// the Brute sheets read LEFT-facing already, matching the rank — no mirror needed.
const SHAMBLER_SPRITES: Partial<Record<JuanPose, string>> = {
  idle: '/images/zombie-idle.png',
  attack: '/images/zombie-idle.png',
  die: '/images/zombie-die.png',
}
const BRUTE_SPRITES: Partial<Record<JuanPose, string>> = {
  idle: '/images/zombie-brute-idle.png',
  attack: '/images/zombie-brute-attack.png',
  die: '/images/zombie-brute-die.png',
}
const SPRITES_BY_ARCHETYPE: Record<string, Partial<Record<JuanPose, string>>> = {
  shambler: SHAMBLER_SPRITES,
  brute: BRUTE_SPRITES,
}

// Archetypes whose sprite files 404'd at least once (Brute PNGs not generated/dropped
// in yet) render with the Shambler set instead of a broken-image box. Once the real
// files land, no error fires and their own art takes over — no code change needed.
const brokenArchetypes = reactive(new Set<string>())
function onEnemyImgError(enemy: { archetype: string }) {
  brokenArchetypes.add(enemy.archetype)
}

function enemyImgFor(enemy: { archetype: string; dying: boolean }) {
  const set = brokenArchetypes.has(enemy.archetype)
    ? SHAMBLER_SPRITES
    : (SPRITES_BY_ARCHETYPE[enemy.archetype] ?? SHAMBLER_SPRITES)
  if (enemy.dying) return set.die ?? SHAMBLER_SPRITES.die
  // Mid-swing: an archetype with an attack pose wears it for the beat (Brute only —
  // the Shambler maps its idle, so it stands still and swipes like before).
  if (combat.swingingEnemyId === enemy.id) return set.attack ?? set.idle ?? SHAMBLER_SPRITES.idle
  // Impact flash: while the hit marker is up, an archetype with a hurt pose wears it.
  if (combat.hitEnemyId === enemy.id && set.hurt) return set.hurt
  return set.idle ?? SHAMBLER_SPRITES.idle
}

// Rank staging: index 0 is the front and the only targetable one. Deeper ranks sit
// further right, smaller and dimmer, and stand higher in the frame so the floor reads as
// receding. The bottom offsets leave room for the name and HP bar that hang under the
// front sprite — without them those clip against the frame's bottom edge.
const RANK_STAGES = [
  { right: '34%', bottom: '28px', width: '80px', height: '128px', opacity: 1, z: 30 },
  { right: '15%', bottom: '34px', width: '64px', height: '104px', opacity: 0.88, z: 20 },
  { right: '1%', bottom: '40px', width: '52px', height: '86px', opacity: 0.72, z: 10 },
]
function stageFor(index: number) {
  return RANK_STAGES[Math.min(index, RANK_STAGES.length - 1)]
}

const retreatPercent = computed(() => Math.round(combat.retreatOdds * 100))
const durabilityPercent = computed(() =>
  player.unbreakable ? 100 : Math.round((player.weaponDurability / player.weapon.durability) * 100),
)

const itemPickerOpen = ref(false)

const bagItems = computed(() =>
  inventory.bag.flatMap((id, slot) => {
    if (!id) return []
    const info = itemInfo(id)
    return [
      {
        slot,
        id,
        name: info?.name ?? id,
        icon: info?.icon ?? '❔',
        effect: CONSUMABLE_EFFECTS[id]?.label ?? 'No use in a fight',
      },
    ]
  }),
)

// If the turn passes while the picker is open, close it — the bag isn't a pause menu.
watch(
  () => combat.playerTurn,
  (isPlayerTurn) => {
    if (!isPlayerTurn) itemPickerOpen.value = false
  },
)

function openItemPicker() {
  // Note: no `.value` on the store's computed — Pinia unwraps it on the proxy.
  if (!combat.playerTurn || !bagItems.value.length) return
  itemPickerOpen.value = true
}

function useItem(slot: number) {
  combat.useItem(slot)
  itemPickerOpen.value = false
}

// No pending beat should outlive the screen. (With the tab bar locked out during combat
// this only fires on a dev reload, but it's cheap insurance.)
onUnmounted(() => combat.stop())
</script>

<template>
  <div class="flex-1 overflow-y-auto pb-4">
    <div class="flex items-center justify-between px-4 pt-3 pb-1">
      <div class="flex items-center gap-1.5">
        <div class="flex items-center gap-1.5 text-[9px] tracking-wide" style="font-family: var(--font-mono); color: var(--sari-red)">
          <span class="w-1.5 h-1.5" style="background: var(--sari-red); animation: flick 1.6s infinite" />
          AMBUSH
        </div>
        <span
          class="px-1.5 py-0.5 text-[8px] tracking-wide"
          style="font-family: var(--font-mono)"
          :style="{ color: combat.fightPhase === 'day' ? 'var(--sari-yel)' : '#9d8ec7', border: `1px solid ${combat.fightPhase === 'day' ? 'rgba(240,166,60,.5)' : 'rgba(157,142,199,.5)'}` }"
        >{{ combat.fightPhase === 'day' ? '☀ DAYLIGHT' : '☾ DARKNESS' }}</span>
      </div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">ROUND {{ combat.round }}</div>
    </div>

    <!-- Turn order: rebuilt from actor speed every round, marked as it's spent -->
    <div class="flex items-center gap-1.5 px-4 pb-2 overflow-x-auto">
      <span class="text-[8px] tracking-wide mr-0.5" style="font-family: var(--font-mono); color: var(--muted)">ORDER</span>
      <template v-for="(entry, index) in combat.queue" :key="entry.id">
        <span v-if="index > 0" style="color: var(--line)">→</span>
        <div
          class="w-[26px] h-[26px] flex items-center justify-center text-[13px] shrink-0"
          :style="{
            border: `2px solid ${entry.side === 'ally' ? 'var(--sodium)' : '#3a4a34'}`,
            background: index === combat.turnIndex
              ? (entry.side === 'ally' ? 'rgba(240,166,60,.22)' : 'rgba(217,75,59,.22)')
              : (entry.side === 'ally' ? 'var(--panel)' : 'rgba(90,161,122,.08)'),
            boxShadow: index === combat.turnIndex ? '0 0 0 1px var(--bone), 2px 2px 0 rgba(0,0,0,.4)' : '2px 2px 0 rgba(0,0,0,.3)',
            opacity: index < combat.turnIndex ? 0.45 : 1,
            imageRendering: 'pixelated',
          }"
        >
          {{ entry.icon }}
        </div>
      </template>
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

        <!-- Enemy rank — up to 3. Front is targetable; the rest are staged behind it and
             step up automatically when the one in front goes down. -->
        <div
          v-for="(enemy, index) in combat.enemies"
          :key="enemy.id"
          class="absolute"
          :style="{
            right: stageFor(index).right,
            bottom: stageFor(index).bottom,
            opacity: stageFor(index).opacity,
            zIndex: stageFor(index).z,
          }"
        >
          <div class="relative">
            <div
              v-if="index === 0 && !enemy.dying"
              class="absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[8px] tracking-wide whitespace-nowrap"
              style="bottom: 100%; margin-bottom: 4px; font-family: var(--font-mono); background: var(--sari-red); color: #1a0a08"
            >TARGET</div>
            <div
              v-else-if="index > 0"
              class="absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[8px] whitespace-nowrap"
              style="bottom: 100%; margin-bottom: 4px; font-family: var(--font-mono); background: rgba(12,17,19,.8); color: var(--muted)"
            >REAR</div>

            <img
              :src="enemyImgFor(enemy)"
              @error="onEnemyImgError(enemy)"
              class="object-contain object-bottom block"
              :class="{ 'hit-flash': combat.hitEnemyId === enemy.id, 'enemy-lunge': combat.swingingEnemyId === enemy.id }"
              :style="{
                width: stageFor(index).width,
                height: stageFor(index).height,
                filter: index === 0 ? 'drop-shadow(2px 2px 0 rgba(0,0,0,.6))' : 'grayscale(.35) drop-shadow(2px 2px 0 rgba(0,0,0,.6))',
                imageRendering: 'pixelated',
              }"
            />

            <div
              v-if="combat.damageFloater?.target === 'enemy' && combat.damageFloater.id === enemy.id"
              class="absolute left-1/2 -translate-x-1/2 text-[13px] float-up"
              style="top: 0; font-family: var(--font-mono); font-weight: 700; color: var(--sari-red); text-shadow: 1px 1px 0 #000"
            >−{{ combat.damageFloater.amount }}</div>

            <div class="absolute left-1/2 -translate-x-1/2" :style="{ width: stageFor(index).width, top: '100%', marginTop: '3px' }">
              <div v-if="index === 0" class="uppercase text-[9px] whitespace-nowrap text-center" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px; color: var(--bone); text-shadow: 1px 1px 0 #000">{{ enemy.name }}</div>
              <div class="h-1.5 overflow-hidden mt-1" style="background: #0c1113">
                <b class="block h-full" :style="{ width: (enemy.hp / enemy.maxHp) * 100 + '%', background: 'linear-gradient(90deg,#7a2e26,#d94b3b)' }" />
              </div>
            </div>
          </div>
        </div>

        <!-- Juan — shares the front rank's floor line so his feet line up with theirs -->
        <div class="absolute left-5" style="bottom: 28px; z-index: 40">
          <div class="relative">
            <img :src="juanImg" class="w-20 h-28 object-contain object-bottom block" style="filter: drop-shadow(2px 2px 0 rgba(0,0,0,.6)); image-rendering: pixelated" />
            <div
              v-if="combat.damageFloater?.target === 'juan'"
              class="absolute left-1/2 -translate-x-1/2 text-[13px] float-up"
              style="top: 0; font-family: var(--font-mono); font-weight: 700; text-shadow: 1px 1px 0 #000"
              :style="{ color: combat.damageFloater.kind === 'heal' ? 'var(--green)' : 'var(--sari-red)' }"
            >{{ combat.damageFloater.kind === 'heal' ? '+' : '−' }}{{ combat.damageFloater.amount }}</div>
            <div
              v-if="combat.guarding"
              class="absolute left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-[8px] whitespace-nowrap"
              style="bottom: 100%; margin-bottom: 2px; font-family: var(--font-mono); background: var(--sari-blue); color: #06181f"
            >GUARD UP</div>
            <div class="absolute left-1/2 -translate-x-1/2 uppercase text-[9px] whitespace-nowrap" style="top: 100%; margin-top: 2px; font-family: var(--font-display); font-weight: 700; letter-spacing: .5px; color: var(--sodium); text-shadow: 1px 1px 0 #000">{{ player.name }}</div>
          </div>
        </div>

        <!-- Juan HUD chip -->
        <div class="absolute top-2 right-2 w-24 p-1.5" style="background: rgba(12,17,19,.85); border: 1px solid var(--line); z-index: 50">
          <div class="flex justify-between text-[7px] mb-0.5" style="font-family: var(--font-mono); color: var(--muted)"><span>HP</span><span>{{ player.health }}%</span></div>
          <div class="h-1 overflow-hidden mb-1" style="background: #0c1113"><b class="block h-full" :style="{ width: player.health + '%', background: 'linear-gradient(90deg,#d94b3b,#e88a4a)' }" /></div>
          <div class="flex justify-between text-[7px] mb-0.5" style="font-family: var(--font-mono); color: var(--muted)"><span>DREAD</span><span>{{ player.dread }}%</span></div>
          <div class="h-1 overflow-hidden" style="background: #0c1113"><b class="block h-full" :style="{ width: player.dread + '%', background: 'linear-gradient(90deg,#5c2f6b,var(--dread-bright))' }" /></div>
        </div>
      </div>
    </div>

    <!-- Log: the last few beats, newest last -->
    <div class="mx-4 mt-3 mb-3 p-2.5 relative text-[11px] leading-relaxed" style="background: var(--panel); border: 1px solid var(--line); font-family: var(--font-mono); color: #cdc6b8; min-height: 62px">
      <i class="absolute -top-1.5 left-4 w-8 h-3" style="background: rgba(217,75,59,.35); transform: rotate(-3deg); box-shadow: 1px 1px 0 rgba(0,0,0,.4)" />
      <p v-for="(line, index) in combat.log" :key="index" :style="{ opacity: index === combat.log.length - 1 ? 1 : 0.55 }">{{ line }}</p>
    </div>

    <div class="mx-4 mb-3 text-[11px] flex items-center gap-2" style="font-family: var(--font-mono); color: var(--muted)">
      <span>Weapon: <b style="color: var(--bone); font-weight: 400">{{ player.weapon.icon }} {{ player.weapon.name }}</b></span>
      <span v-if="!player.unbreakable" class="flex items-center gap-1">
        ·
        <span class="inline-block h-1.5 w-14 overflow-hidden" style="background: #0c1113">
          <b class="block h-full" :style="{ width: durabilityPercent + '%', background: player.weaponDurability <= 2 ? 'var(--sari-red)' : 'var(--sodium)' }" />
        </span>
        {{ player.weaponDurability }} left
      </span>
      <span v-else>· improvised, unbreakable</span>
    </div>

    <div class="mx-4 mb-3 text-[10px] flex items-center gap-2" style="font-family: var(--font-mono); color: var(--muted)">
      <span>Armor: <b style="color: var(--bone); font-weight: 400">🛡 {{ player.armorTotal }}</b></span>
      <span style="color: combat.fightPhase === 'day' ? 'var(--sari-yel)' : '#9d8ec7'">· {{ combat.phaseLabel }}</span>
    </div>

    <div class="mx-4 mb-3 text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">Attacks the FRONT enemy only.</div>

    <div v-if="player.shaken" class="mx-4 mb-3 flex items-center gap-1.5 text-[9px] tracking-wide" style="font-family: var(--font-mono); color: var(--dread-bright)">
      <span class="w-1.5 h-1.5" style="background: var(--dread-bright); box-shadow: 0 0 6px var(--dread-bright)" /> SHAKEN — attacks land less often
    </div>

    <!-- Whose turn it is, or how it ended -->
    <div class="mx-4 mb-3 px-2.5 py-2 text-[10px] tracking-wide" style="font-family: var(--font-mono); border: 1px solid var(--line); background: var(--panel2)">
      <template v-if="combat.outcome === 'won'">
        <div style="color: var(--green)">ENCOUNTER CLEARED</div>
        <div v-if="combat.lootGainedNames.length" style="color: var(--muted); margin-top: 3px">Took: {{ combat.lootGainedNames.join(', ') }}</div>
        <div v-else-if="combat.lootLostNames.length" style="color: var(--sari-red); margin-top: 3px">Bag full — left behind: {{ combat.lootLostNames.join(', ') }}</div>
      </template>
      <template v-else-if="combat.outcome === 'escaped'">
        <div style="color: var(--sodium)">YOU GOT OUT</div>
        <div style="color: var(--muted); margin-top: 3px">The alley still has them. So does the tile you walked out of.</div>
      </template>
      <template v-else-if="combat.outcome === 'lost'">
        <div style="color: var(--sari-red)">YOU GO DOWN</div>
      </template>
      <template v-else-if="combat.phase === 'enemy-turn'">
        <div style="color: var(--sari-red)">THEY MOVE FIRST — HOLD STILL</div>
      </template>
      <template v-else-if="combat.playerTurn">
        <div style="color: var(--sodium)">YOUR MOVE</div>
      </template>
      <template v-else>
        <div style="color: var(--muted)">…</div>
      </template>
    </div>

    <div class="grid grid-cols-2 gap-2.5 mx-4 mb-2">
      <button
        class="p-3 flex flex-col items-center gap-1 disabled:opacity-40"
        style="background: var(--panel2); border: 1px solid var(--sari-red); box-shadow: 3px 3px 0 rgba(0,0,0,.35)"
        :disabled="!combat.playerTurn"
        @click="combat.attack()"
      >
        <span class="text-lg" style="image-rendering: pixelated">⚔️</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Attack</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Hit the front {{ combat.frontEnemy?.name.toLowerCase() ?? 'enemy' }}</span>
      </button>

      <button
        class="p-3 flex flex-col items-center gap-1 disabled:opacity-40"
        style="background: var(--panel2); border: 1px dashed var(--line); box-shadow: 3px 3px 0 rgba(0,0,0,.35)"
        :disabled="!combat.playerTurn"
        @click="combat.guardAction()"
      >
        <span class="text-lg" style="image-rendering: pixelated">🛡️</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Guard</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">Halves damage until your next turn</span>
      </button>

      <button
        class="p-3 flex flex-col items-center gap-1 disabled:opacity-40"
        style="background: var(--panel2); border: 1px dashed var(--line); box-shadow: 3px 3px 0 rgba(0,0,0,.35)"
        :disabled="!combat.playerTurn || inventory.bagCount === 0"
        @click="openItemPicker()"
      >
        <span class="text-lg" style="image-rendering: pixelated">🩹</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Use Item</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">
          {{ inventory.bagCount ? `${inventory.bagCount} in the bag` : 'bag empty' }}
        </span>
      </button>

      <button
        class="p-3 flex flex-col items-center gap-1 disabled:opacity-40"
        style="background: var(--panel2); border: 1px dashed var(--muted); box-shadow: 3px 3px 0 rgba(0,0,0,.35)"
        :disabled="!combat.playerTurn"
        @click="combat.retreat()"
      >
        <span class="text-lg" style="image-rendering: pixelated">🏃</span>
        <span class="uppercase text-[11px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Retreat</span>
        <span class="text-center text-[8px] leading-tight" style="font-family: var(--font-mono); color: var(--muted)">{{ retreatPercent }}% odds · failure costs Health</span>
      </button>
    </div>

    <!-- Item picker — reads the field bag, which is the only inventory you have out here -->
    <div v-if="itemPickerOpen" class="absolute inset-0 z-[70]" style="background: rgba(0,0,0,.55)" @click="itemPickerOpen = false" />
    <div
      class="absolute left-0 right-0 bottom-0 z-[75] overflow-y-auto max-h-[70%]"
      style="background: var(--panel2); border-top: 2px solid var(--sodium); box-shadow: 0 -20px 40px rgba(0,0,0,.5); transition: transform .25s cubic-bezier(.2,.7,.3,1)"
      :style="{ transform: itemPickerOpen ? 'translateY(0)' : 'translateY(110%)' }"
    >
      <div class="px-4 pt-3 pb-5">
        <div class="w-10 h-1 mx-auto mb-3" style="background: #3a464b" />
        <div class="uppercase text-sm mb-0.5" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">Use what you're carrying</div>
        <div class="text-[11px] mb-3" style="color: var(--muted)">Spending a turn to reach into the bag.</div>
        <div class="flex flex-col gap-2">
          <button
            v-for="entry in bagItems"
            :key="entry.slot"
            class="py-2.5 px-3 flex items-center gap-3 text-left"
            style="background: var(--panel3); border: 1px solid var(--line); box-shadow: 3px 3px 0 rgba(0,0,0,.3)"
            @click="useItem(entry.slot)"
          >
            <span class="text-xl" style="image-rendering: pixelated">{{ entry.icon }}</span>
            <span class="flex-1">
              <span class="block uppercase text-[12px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">{{ entry.name }}</span>
              <span class="block text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">{{ entry.effect }}</span>
            </span>
            <span class="text-[11px]" style="font-family: var(--font-mono); color: var(--sodium)">use →</span>
          </button>
        </div>
        <button class="mt-3 py-2.5 w-full uppercase text-[12px]" style="background: var(--panel); border: 1px dashed var(--line); font-family: var(--font-display); font-weight: 700; letter-spacing: 1px; color: var(--muted)" @click="itemPickerOpen = false">Back to the fight</button>
      </div>
    </div>
  </div>
</template>

<!-- Enemy wind-up lunge. translateX only, so it stacks with the wrappers'
     -translate-x-1/2 utilities; steps, not ease — it sits on pixel art. -->
<style scoped>
@keyframes enemyLunge {
  0%, 100% { transform: translateX(0); }
  35% { transform: translateX(10px); }
  55% { transform: translateX(2px); }
}

.enemy-lunge {
  animation: enemyLunge 0.55s steps(5);
}
</style>
