<script setup lang="ts">
const board = useBoardStore()
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3" style="background: linear-gradient(180deg, var(--night), rgba(14,18,20,.85)); border-bottom: 1px solid var(--line)">
      <div class="text-xl uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">TONDO <span style="color: var(--sodium)">IN FOG</span></div>
      <div
        class="flex items-center gap-1.5 text-[10px]"
        style="font-family: var(--font-mono)"
        :style="{ color: board.moveBudget <= 0 ? 'var(--sari-red)' : 'var(--sodium)' }"
      >
        <span class="w-1.5 h-1.5 rounded-full" :style="{ background: board.moveBudget <= 0 ? 'var(--sari-red)' : 'var(--sodium)' }" />
        {{ board.moveBudget }}/5 MOVES
      </div>
    </div>

    <p class="mx-4 mt-3 text-[10px] leading-relaxed" style="font-family: var(--font-mono); color: var(--muted)">
      You never see a map — just what's around you. <b style="color: var(--sodium); font-weight: normal">2–3 tiles ahead, then pure fog.</b> Fresh ground costs a move — retracing cleared ground never does.
    </p>

    <div class="flex-1 my-3 mx-4 rounded-md overflow-hidden" style="border: 1px solid var(--line)">
      <HexBoard />
    </div>

    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 mx-4 mb-3 text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background: #f0a63c; border: 1px solid #0e1214" />Juan (you)</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background: #1d2529; border: 1px solid #2a343a" />Visible — tap to act</span>
      <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded" style="background: #8a939a; border: 1px solid #6b747a" />Edge of sight</span>
    </div>

    <div
      class="mx-4 mb-4 p-3.5 rounded flex flex-col gap-0.5"
      style="background: var(--sodium); border-color: var(--sodium)"
      @click="board.retreatToShelter()"
    >
      <span class="uppercase" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px; color: #0e1214; font-size: 19px">Head back to shelter →</span>
      <span class="text-[11px]" style="color: #5a3d12">{{ board.moveBudget <= 0 ? 'out of moves — time to head back' : 'retrace cleared ground, always free' }}</span>
    </div>

    <TileCard />
  </div>
</template>
