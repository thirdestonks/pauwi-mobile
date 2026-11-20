<script setup lang="ts">
import { itemInfo } from '~/data/equipment'

const ui = useUiStore()
const board = useBoardStore()
const { door } = useEncounterScene()

const player = usePlayerStore()
const inventory = useInventoryStore()
/** What the outing came to: ground cleared, things found, Health and Dread it cost. */
const summary = computed(() => {
  const s = ui.outingStart
  if (!s) return []
  const left = [...s.bag], found: string[] = []
  for (const id of inventory.units) { const i = left.indexOf(id); if (i >= 0) left.splice(i, 1); else found.push(itemInfo(id)?.name ?? id) }
  return [
    ['Tiles cleared', String(board.tilesCleared - s.tiles)],
    ['Found', found.length ? found.join(', ') : 'nothing'],
    ['Health', `${player.health - s.health >= 0 ? '+' : ''}${player.health - s.health}`],
    ['Dread', `${player.dread - s.dread >= 0 ? '+' : ''}${player.dread - s.dread}`],
  ]
})

const isOutOfMoves = computed(() => ui.shelterTransition === 'moves')
const isDusk = computed(() => useBoardStore().phase === 'day')
</script>

<template>
  <div class="absolute inset-0 z-[90] flex flex-col items-center justify-center text-center p-8" style="background: radial-gradient(120% 90% at 50% 30%, #1a120a, #070a0b)">
    <div class="text-[10px] tracking-[4px] mb-5" style="font-family: var(--font-mono); color: var(--sodium)">{{ isOutOfMoves ? 'MOVE BUDGET SPENT' : 'CYCLE ENDING' }}</div>

    <h1 class="text-[38px] leading-[0.95] uppercase max-w-[320px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 2px; color: var(--bone); text-shadow: 0 0 30px rgba(240,166,60,.2)">
      {{ isOutOfMoves ? 'Out of Moves' : 'Back at Shelter' }}
    </h1>

    <div class="text-[11px] mt-2.5 tracking-[3px]" style="font-family: var(--font-mono); color: var(--muted)">/ {{ isDusk ? 'dusk is falling' : 'dawn is breaking' }} /</div>

    <p class="text-sm leading-relaxed mt-5 max-w-[310px]" style="color: #cdc6b8">
      {{ isOutOfMoves
        ? (isDusk
          ? "The day's moves are spent. Restock here before heading back into the night."
          : "The night's moves are spent. Dawn brings a new day and five fresh moves.")
        : (isDusk
          ? "You made it back before dark. Night is coming; take stock before the next outing."
          : "You made it back by dawn. A new day starts here, with five moves for the next outing.") }}
    </p>

    <div v-if="summary.length" class="mt-5 w-full max-w-[300px] grid gap-x-4 gap-y-1 text-left text-[11px]" style="grid-template-columns: auto 1fr; font-family: var(--font-mono); padding: 10px 12px; background: rgba(14,18,20,.7); border: 1px solid var(--line)">
      <template v-for="[k, v] in summary" :key="k"><span style="color: var(--muted)">{{ k }}</span><b style="color: var(--bone); font-weight: 600">{{ v }}</b></template>
    </div>

    <button
      class="mt-6 px-8 py-3.5 rounded-md uppercase"
      style="background: var(--sodium); color: var(--night); font-family: var(--font-display); font-weight: 700; letter-spacing: 2px; font-size: 15px"
      :disabled="door.shown"
      @click="ui.confirmShelterReturn()"
    >
      Continue
    </button>
  </div>
</template>
