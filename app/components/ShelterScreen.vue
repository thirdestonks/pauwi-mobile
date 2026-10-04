<script setup lang="ts">
import { axialDistance } from '~/utils/hex'
import { CONSUMABLE_EFFECTS, CONSUMABLE_INFO, FOOD_IDS } from '~/data/combat'
import { saveRunNow } from '~/utils/save'

const ui = useUiStore()
const inventory = useInventoryStore()
const player = usePlayerStore()
const board = useBoardStore()

// Health and Hope are real now: they come off the player store, which is the same state
// combat damages and death is measured against. Energy is spent by fresh moves out on
// the map; Food is what Eat and Sleep burn.
const meters = computed(() => [
  { label: 'Health', value: player.health, color: 'linear-gradient(90deg,#d94b3b,#e88a4a)' },
  { label: 'Energy', value: player.energy, color: 'linear-gradient(90deg,#2e86ab,#57b0d0)' },
  { label: 'Food', value: player.food, color: 'linear-gradient(90deg,#7a8c3a,#b6d24a)' },
  { label: 'Hope', value: player.hope, color: 'linear-gradient(90deg,#8a6a2f,#f0a63c)' },
])

const phaseLabel = computed(() => (board.phase === 'day' ? 'DAY' : 'NIGHT'))
const dayLabel = computed(() => String(board.dayCount).padStart(2, '0'))

const stashSlots = 10

// The Way Out is real now: how far Tutuban still is, measured against the whole route.
const routeLength = computed(() => {
  const t = board.tutuban
  return t ? axialDistance({ q: 0, r: 0 }, t.pos) : 1
})
const progressPercent = computed(() =>
  Math.max(0, Math.min(100, Math.round((1 - board.distanceToTutuban / Math.max(1, routeLength.value)) * 100))),
)
const progressSteps = 5
const filledSteps = computed(() => Math.min(progressSteps, Math.floor((progressPercent.value / 100) * progressSteps)))

function doSleep() {
  if (board.phase !== 'night') return
  player.sleep()
  board.sleepThroughToMorning()
  // Night survived is rest — a save point, like every other quiet beat.
  saveRunNow()
}

// --- The Eat sheet: Juan picks WHAT he eats, the stash pays for it ----------------------

const eatSheetOpen = ref(false)

/** Everything in the stash that can be eaten, with its effect line for the sheet. */
const stashFood = computed(() =>
  inventory.stash
    .filter((item) => (FOOD_IDS as readonly string[]).includes(item.id) && item.qty > 0)
    .map((item) => ({
      id: item.id,
      icon: CONSUMABLE_INFO[item.id]?.icon ?? item.icon,
      name: CONSUMABLE_INFO[item.id]?.name ?? item.name,
      qty: item.qty,
      effect: CONSUMABLE_EFFECTS[item.id]?.label ?? '',
    })),
)

function eatPick(id: string) {
  if (!inventory.consumeStashItem(id)) return
  player.applyConsumable(id)
  eatSheetOpen.value = false
  saveRunNow()
}

/** To the pack screen — only packing a bag and confirming puts Juan in the field. */
function headOutNow() {
  ui.setTab('pack')
}
</script>

<template>
  <div class="flex-1 overflow-y-auto pb-4">
    <div class="sticky top-0 z-20 flex items-center justify-between px-4 py-3" style="background: linear-gradient(180deg, var(--night), rgba(14,18,20,.85)); border-bottom: 1px solid var(--line)">
      <div class="text-xl uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">{{ phaseLabel }} <span style="color: var(--sodium)">{{ dayLabel }}</span></div>
      <div class="flex items-center gap-1.5 text-[10px]" style="font-family: var(--font-mono); color: var(--sari-yel)">
        <span class="w-1.5 h-1.5 rounded-full" style="background: var(--sari-yel); animation: flick 2.4s infinite" />
        FOG · NO SIGNAL
      </div>
    </div>

    <div class="m-4 p-4 rounded-sm relative" style="transform: rotate(-.6deg); background: linear-gradient(180deg,#c23a2c,#a82e22); border: 3px solid #7c2018; box-shadow: 0 6px 0 rgba(0,0,0,.4), inset 0 0 0 2px rgba(242,201,76,.4)">
      <div class="absolute top-0 left-0 right-0 h-1.5" style="background: repeating-linear-gradient(90deg, var(--sari-yel) 0 14px, #7c2018 14px 28px)" />
      <h1 class="text-center uppercase leading-none mt-1" style="font-family: var(--font-display); font-weight: 700; font-size: 26px; letter-spacing: 1px; color: #fff5e0; text-shadow: 2px 2px 0 rgba(0,0,0,.35)">{{ board.shelterName }}</h1>
      <div class="text-center mt-1.5" style="font-family: var(--font-mono); font-size: 10px; color: #ffe9c4; letter-spacing: 3px">{{ board.shelterFlavor }}</div>
    </div>

    <div class="mx-4 mb-3.5 p-3 pt-4 text-[13px] leading-relaxed rounded-sm relative" style="background: var(--panel); border: 1px solid var(--line); color: #cdc6b8">
      <i class="absolute -top-1.5 left-4 w-8 h-3 rounded-[1px]" style="background: rgba(240,166,60,.35); transform: rotate(-3deg); box-shadow: 0 1px 2px rgba(0,0,0,.4)" />
      <b style="color: var(--bone)">Juan.</b> Two years in Manila, off the boat from the province. This room is home for now — but home can move. <b style="color: var(--bone)">Claim a better shelter when you find one,</b> and keep heading for Tutuban. Tonight, the plan starts.
    </div>

    <div class="flex items-center justify-between mx-4 mt-5 mb-3">
      <div class="flex items-center gap-2">
        <i class="w-4 h-2.5 rounded-[1px]" style="background: repeating-linear-gradient(45deg, var(--sari-red) 0 3px, #7c2018 3px 6px); transform: rotate(-8deg); box-shadow: 0 1px 2px rgba(0,0,0,.5)" />
        <div class="uppercase text-sm" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1.5px">Condition</div>
      </div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">{{ phaseLabel }} {{ dayLabel }}</div>
    </div>
    <div class="grid grid-cols-2 gap-3 mx-4">
      <div
        v-for="(m, idx) in meters"
        :key="m.label"
        class="p-2.5 rounded-sm"
        :style="{ background: 'var(--panel)', border: '1px solid var(--line)', transform: `rotate(${idx % 2 === 0 ? -0.5 : 0.5}deg)`, boxShadow: '0 3px 0 rgba(0,0,0,.3)' }"
      >
        <div class="flex justify-between items-center mb-1.5">
          <b class="uppercase text-xs" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">{{ m.label }}</b>
          <i class="text-[11px] not-italic" style="font-family: var(--font-mono); color: var(--muted)">{{ m.value }}%</i>
        </div>
        <div class="h-2 rounded overflow-hidden" style="background: #0c1113">
          <b class="block h-full rounded" :style="{ width: m.value + '%', background: m.color }" />
        </div>
      </div>
    </div>

    <!-- The fight follows you home: Dread settled into Hope when the outing ended. -->
    <div v-if="player.lastDreadPenalty > 0" class="mx-4 mt-3 flex items-center gap-1.5 text-[10px] tracking-wide" style="font-family: var(--font-mono); color: var(--dread-bright)">
      <span class="w-1.5 h-1.5" style="background: var(--dread-bright); box-shadow: 0 0 6px var(--dread-bright)" />
      SHAKEN FROM THE LAST FIGHT · −{{ player.lastDreadPenalty }} HOPE
    </div>

    <div class="flex items-center justify-between mx-4 mt-5 mb-3">
      <div class="flex items-center gap-2">
        <i class="w-4 h-2.5 rounded-[1px]" style="background: repeating-linear-gradient(45deg, var(--sodium) 0 3px, #8a6a2f 3px 6px); transform: rotate(6deg); box-shadow: 0 1px 2px rgba(0,0,0,.5)" />
        <div class="uppercase text-sm" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1.5px">Stash</div>
      </div>
      <div class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">inventory</div>
    </div>
    <div class="grid grid-cols-5 gap-2.5 mx-4">
      <div
        v-for="i in stashSlots"
        :key="i"
        class="aspect-square rounded-sm flex items-center justify-center relative"
        :style="{
          background: 'var(--panel)',
          border: `1px dashed ${i <= inventory.stash.length ? 'var(--line)' : 'rgba(42,52,58,.5)'}`,
          transform: `rotate(${((i % 3) - 1) * 0.8}deg)`,
        }"
        :class="i > inventory.stash.length ? 'opacity-35' : ''"
      >
        <template v-if="i <= inventory.stash.length">
          <span class="text-[22px] leading-none">{{ inventory.stash[i - 1].icon }}</span>
          <span class="absolute right-0.5 bottom-0.5 text-[10px]" style="font-family: var(--font-mono); color: var(--sodium)">×{{ inventory.stash[i - 1].qty }}</span>
        </template>
        <span v-else class="text-[22px] leading-none">·</span>
      </div>
    </div>

    <div class="m-4 mt-5 p-3.5 pt-3 rounded-sm relative overflow-hidden" style="background: linear-gradient(135deg,#12232b,#0f1a1f); border: 2px solid #234049; box-shadow: 0 4px 0 rgba(0,0,0,.3)">
      <div class="absolute top-0 left-0 right-0 h-1" style="background: repeating-linear-gradient(90deg, var(--sari-blue) 0 10px, #12232b 10px 20px)" />
      <div class="uppercase text-[15px] mt-1.5" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">The Way Out</div>
      <div class="text-xs my-1 mb-3" style="color: var(--muted)">Tutuban Station — the trains, the tracks, the way home. <b style="color: var(--sari-blue); font-weight: normal">{{ board.distanceToTutuban }} tiles out.</b> Hop shelter to shelter; the fog never thins.</div>
      <div class="flex gap-1.5 mb-2.5">
        <i
          v-for="i in progressSteps"
          :key="i"
          class="flex-1 h-1.5 rounded"
          :style="{ background: i <= filledSteps ? 'var(--sari-blue)' : '#0c1113' }"
        />
      </div>
      <div class="text-[11px]" style="font-family: var(--font-mono); color: var(--sari-blue)">{{ progressPercent }}% of the road · {{ board.sheltersClaimed }} shelter{{ board.sheltersClaimed === 1 ? '' : 's' }} claimed</div>
    </div>

    <div class="grid grid-cols-2 gap-2.5 m-4 mt-5">
      <div
        class="p-3.5 rounded-sm flex flex-col gap-0.5"
        :style="stashFood.length
          ? { background: 'var(--panel2)', border: '1px solid var(--line)', cursor: 'pointer' }
          : { background: 'var(--panel2)', border: '1px dashed var(--line)', opacity: 0.45 }"
        @click="stashFood.length && (eatSheetOpen = true)"
      >
        <span class="uppercase text-base" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">Eat</span>
        <span class="text-[11px]" style="color: var(--muted)">{{ stashFood.length ? `${stashFood.length} kind${stashFood.length === 1 ? '' : 's'} of food in the stash` : 'no food in the stash' }}</span>
      </div>
      <div
        class="p-3.5 rounded-sm flex flex-col gap-0.5"
        :style="board.phase === 'night'
          ? { background: 'var(--panel2)', border: '1px solid var(--line)', cursor: 'pointer' }
          : { background: 'var(--panel2)', border: '1px dashed var(--line)', opacity: 0.45 }"
        @click="doSleep"
      >
        <span class="uppercase text-base" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">Sleep</span>
        <span class="text-[11px]" style="color: var(--muted)">{{ board.phase === 'night' ? (player.food > 0 ? 'end the night · full energy' : 'no food — a rough night') : 'night only — go out while it\'s light' }}</span>
      </div>
      <div
        class="col-span-2 p-3.5 rounded-sm flex flex-col gap-0.5"
        style="background: var(--sodium); border: 2px solid #c9821f; transform: rotate(-.4deg); box-shadow: 0 4px 0 rgba(0,0,0,.35), inset 0 0 0 2px rgba(14,18,20,.15)"
        @click="headOutNow"
      >
        <span class="uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px; color: #0e1214; font-size: 19px">Head out →</span>
        <span class="text-[11px]" style="color: #5a3d12">pack your bag first · 5 moves this {{ board.phase === 'day' ? 'day' : 'night' }}</span>
      </div>
    </div>

    <!-- The run's save lives as one blob; this panel exports, imports, or wipes it. -->
    <SavePanel />

    <!-- Eat sheet: every eatable in the stash, one tap per serving -->
    <div v-if="eatSheetOpen" class="fixed inset-0 z-[65]" style="background: rgba(0,0,0,.5)" @click="eatSheetOpen = false" />
    <div
      v-if="eatSheetOpen"
      class="fixed left-0 right-0 bottom-0 z-[70] rounded-t-2xl overflow-y-auto max-h-[70%]"
      style="background: var(--panel2); border-top: 2px solid var(--sodium); box-shadow: 0 -20px 40px rgba(0,0,0,.5)"
    >
      <div class="px-4 pt-3 pb-6">
        <div class="w-10 h-1 rounded-full mx-auto mb-3" style="background: #3a464b" />
        <div class="uppercase text-sm mb-0.5" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">Eat something</div>
        <div class="text-[11px] mb-3" style="color: var(--muted)">One serving from the stash — tap to eat it.</div>
        <div class="flex flex-col gap-2">
          <button
            v-for="foodItem in stashFood"
            :key="foodItem.id"
            class="py-2.5 px-3 flex items-center gap-3 text-left"
            style="background: var(--panel3); border: 1px solid var(--line); box-shadow: 3px 3px 0 rgba(0,0,0,.3)"
            @click="eatPick(foodItem.id)"
          >
            <span class="text-xl">{{ foodItem.icon }}</span>
            <span class="flex-1">
              <span class="block uppercase text-[12px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">{{ foodItem.name }}</span>
              <span class="block text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">{{ foodItem.effect }}</span>
            </span>
            <span class="text-[11px]" style="font-family: var(--font-mono); color: var(--sodium)">×{{ foodItem.qty }} · eat →</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
