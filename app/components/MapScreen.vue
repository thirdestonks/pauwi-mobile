<script setup lang="ts">
// The map, full screen (.art/map-ui, concept B): no title, no legend, no tab bar. The pixel map fills it and Juan's kit on it is the
// interface (PixelMap.vue): the bag opens the Bag, the shelter key asks before heading home, the phone opens the phone map.
import { SHELTER_DOOR } from '~/utils/tondo'

const board = useBoardStore()
const ui = useUiStore()
const encounter = useEncounterScene()
const map = ref<{ moving: boolean } | null>(null)
const returning = ref(false)
const asking = ref(false)

/** Skip the route home; show the shelter door, then the outing summary. */
async function headHome() {
  if (returning.value || ui.shelterTransition || map.value?.moving) return
  returning.value = true
  try {
    await encounter.passDoor(SHELTER_DOOR[board.home], false, () => {
      ui.requestShelterReturn(board.moveBudget <= 0 ? 'moves' : 'voluntary')
    })
  } finally {
    returning.value = false
  }
}

/** The key: at home it just goes back inside; out there it asks first, since heading back ends the outing. */
function home() {
  if (map.value?.moving || encounter.busy.value || ui.shelterTransition || board.activeCard) return
  if (!ui.outInField) { ui.setTab('shelter'); return }
  asking.value = true
}
function bag() {
  if (map.value?.moving || encounter.busy.value) return
  ui.setTab(ui.outInField ? 'bag' : 'pack')
}
</script>

<template>
  <div class="relative flex-1 flex items-center justify-center overflow-hidden" style="background: #000">
    <PixelMap ref="map" style="height: 100%" @home="home" @bag="bag" />

    <!-- the key's question, in the pixel style of the map -->
    <div v-if="asking" class="ask-back" @click="asking = false" />
    <div v-if="asking" class="ask" role="dialog" aria-label="Head back to shelter?">
      <h3>Head back to shelter?</h3>
      <p>{{ board.moveBudget <= 0 ? 'Out of moves. Straight back through the shelter door, free.' : `Straight back to ${board.shelterName}, free. ${board.phase === 'day' ? 'Dusk waits for no one.' : 'Dawn comes after.'}` }}</p>
      <div class="acts">
        <button class="go" @click="asking = false; headHome()">Go home</button>
        <button @click="asking = false">Stay out</button>
      </div>
    </div>

    <EncounterLayer />
    <TileCard />
  </div>
</template>

<style scoped>
.ask-back { position: absolute; inset: 0; z-index: 40; background: #0006 }
.ask { position: absolute; z-index: 41; left: 12px; right: 12px; bottom: 16px; max-width: 420px; margin: 0 auto; padding: 12px; background: #0c1418f4; border: 3px solid #526169; box-shadow: 4px 4px 0 #000; font-family: var(--font-mono) }
.ask h3 { margin: 0 0 4px; font: 400 24px/1 var(--font-display); font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--sodium) }
.ask p { margin: 0 0 10px; font-size: 12px; line-height: 1.45; color: #c9c3b6 }
.ask .acts { display: flex; gap: 8px }
.ask button { flex: 1; padding: 10px; font: 700 12px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; background: #16212a; color: var(--bone); border: 2px solid #3a4851 }
.ask button.go { background: var(--sodium); color: #0e1214; border-color: var(--sodium) }
</style>
