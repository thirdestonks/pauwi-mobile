<script setup lang="ts">
const ui = useUiStore()

const isOutOfMoves = computed(() => ui.shelterTransition === 'moves')
const isDusk = computed(() => useBoardStore().phase === 'day')
</script>

<template>
  <div class="absolute inset-0 z-[90] flex flex-col items-center justify-center text-center p-8" style="background: radial-gradient(120% 90% at 50% 30%, #1a120a, #070a0b)">
    <div class="text-[10px] tracking-[4px] mb-5" style="font-family: var(--font-mono); color: var(--sodium)">{{ isOutOfMoves ? 'MOVE BUDGET SPENT' : 'CYCLE ENDING' }}</div>

    <h1 class="text-[38px] leading-[0.95] uppercase max-w-[320px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 2px; color: var(--bone); text-shadow: 0 0 30px rgba(240,166,60,.2)">
      {{ isOutOfMoves ? 'Out of Moves' : 'Returning to Shelter' }}
    </h1>

    <div class="text-[11px] mt-2.5 tracking-[3px]" style="font-family: var(--font-mono); color: var(--muted)">/ {{ isDusk ? 'dusk is falling' : 'dawn is breaking' }} /</div>

    <p class="text-sm leading-relaxed mt-5 max-w-[310px]" style="color: #cdc6b8">
      {{ isOutOfMoves
        ? (isDusk
          ? "Five moves, spent. Dusk is coming down on the fog — get back before the light goes, or go out and gamble the dark."
          : "Five moves, spent. Night's run is done — the streets stay dark until dawn, and the dawn is a new day.")
        : (isDusk
          ? "Better to walk back on your own terms than get caught out here after dark. Night comes, and the fog keeps what it catches."
          : "The night ends, and Day's moves are yours again. Two outings a day — that's the shape of survival now.") }}
    </p>

    <button
      class="mt-6 px-8 py-3.5 rounded-md uppercase"
      style="background: var(--sodium); color: var(--night); font-family: var(--font-display); font-weight: 700; letter-spacing: 2px; font-size: 15px"
      @click="ui.confirmShelterReturn()"
    >
      Continue
    </button>
  </div>
</template>
