<script setup lang="ts">
import { rollEncounter } from '~/data/combat'
import type { Tile } from '~/stores/board'

const ui = useUiStore()
const player = usePlayerStore()
const combat = useCombatStore()
const board = useBoardStore()
const house = useHouseStore()
const route = useRoute()

// The tab bar is gone from every screen now: the map (Juan's kit), the shelter (his room), the bag, the pack and the gear
// screen each carry their own way around. It is kept for the screens that still need it, which today is none.
// The tab bar is hidden during a fight. Combat ends by winning, retreating, or dying —
// never by wandering off to the Shelter tab mid-swing, which used to cancel the encounter
// for free and leave the zombie standing there.
const showTabBar = computed(() => !['pack', 'map', 'shelter', 'bag', 'gear'].includes(ui.activeTab) && !ui.combatActive && !house.open)

// Dev shortcuts for tuning: /?fight=3 drops you straight in against three Shamblers
// (add &interior=1, &interior=wood or &interior=tile for the in-house version: one weaker Shambler in a dark room);
// /?house=N walks him into a house;
// /?tp=N drops Juan onto numbered stop N — 1–5 are the seeded shelters in route order,
// 6+ is Tutuban — so shelter claiming and the win are reachable without walking 75 tiles.
onMounted(() => {
  const tp = route.query.tp
  if (tp) {
    ui.finishPrologue()
    board.devTeleportToStop(Math.max(1, Math.min(9, Number(tp) || 1)))
  }
  // /?house=1 walks Juan straight into a house (a different one for each number), for tuning the interior without finding a door.
  const inside = route.query.house
  if (inside) {
    ui.finishPrologue()
    ui.setTab('map')
    house.enter({ q: Number(inside) || 1, r: 2 } as Tile)
  }
  const requested = route.query.fight
  if (!requested) return
  const size = Math.min(3, Math.max(1, Number(requested) || 2))
  ui.finishPrologue()
  ui.startCombat()
  const q = route.query.interior
  combat.start(rollEncounter(size), { interior: q === 'wood' || q === 'tile' ? q : !!q })
})
</script>

<template>
  <div class="w-screen h-screen flex items-center justify-center overflow-hidden" style="background: #050708">
    <div
      class="relative flex flex-col overflow-hidden"
      style="width: min(100vw, 440px); height: min(100vh, 900px); background: var(--night); box-shadow: 0 0 0 1px #000, 0 30px 90px rgba(0,0,0,.6)"
    >
      <NuxtRouteAnnouncer />
      <div class="grain" />
      <div
        class="absolute inset-0 pointer-events-none z-[60]"
        style="background: radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,.5) 100%)"
      />

      <ShelterScreen v-if="ui.activeTab === 'shelter'" />
      <MapScreen v-else-if="ui.activeTab === 'map'" />
      <InteriorCombatScreen v-else-if="ui.activeTab === 'combat' && combat.fightScene === 'interior'" />
      <CombatScreen v-else-if="ui.activeTab === 'combat'" />
      <PackScreen v-else-if="ui.activeTab === 'pack'" />
      <GearScreen v-else-if="ui.activeTab === 'gear'" />
      <FieldBagScreen v-else-if="ui.activeTab === 'bag'" />

      <HouseScreen v-if="house.open" v-show="!ui.combatActive" />

      <TabBar v-if="showTabBar" />

      <ShelterTransitionScreen v-if="ui.shelterTransition" />
      <DoorTransition />
      <PrologueScreen v-if="!ui.prologueDone" />
      <DeathScreen v-if="player.dead" />
      <WinScreen v-if="ui.won" />
    </div>
  </div>
</template>
