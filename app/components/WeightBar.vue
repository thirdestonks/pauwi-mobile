<script setup lang="ts">
// What Juan carries, on the bag screens (pixel panels): the load, the kilos out of what he carries comfortably, a bar with the
// Light / Carrying / Loaded marks, and what this load costs him out there (data/weight.ts).
import { CARRY_KG, MAX_KG } from '~/data/weight'

const inventory = useInventoryStore()
const COL = { light: '#7ee0a0', carrying: '#ece4d5', loaded: '#f0a63c', over: '#ff7b66' } as const
const frac = (kg: number) => Math.min(1, kg / MAX_KG)
const pct = (kg: number) => `${frac(kg) * 100}%`
const cost = computed(() => {
  const l = inventory.load
  const run = Math.round(l.run * 100)
  return `Fresh step ${l.fresh} EN${l.cleared ? ` · cleared ${l.cleared} EN` : ''} · ${l.dash > 1 ? `dash ${l.dash}` : 'no dash'}${run ? ` · run ${run > 0 ? '+' : ''}${run}%` : ''}`
})
</script>

<template>
  <div class="wb px-panel" role="group" :aria-label="`Carrying ${inventory.carriedKg} kilograms: ${inventory.load.name}`">
    <div class="row">
      <span :style="{ color: COL[inventory.load.id] }">{{ inventory.load.name.toUpperCase() }}</span>
      <span>{{ inventory.carriedKg }} / {{ CARRY_KG }} KG</span>
    </div>
    <div class="bar">
      <i :style="{ transform: `scaleX(${frac(inventory.carriedKg)})`, background: COL[inventory.load.id] }" />
      <u v-for="m in [6, 12, 16]" :key="m" :style="{ left: pct(m) }" />
    </div>
    <p>{{ inventory.load.line }} <b>{{ cost }}</b></p>
  </div>
</template>

<style scoped>
.wb { padding: 8px 9px; margin: 8px 0; background: #0e1214; border: 2px solid #000 }
.row { display: flex; justify-content: space-between; font: 700 11px var(--font-mono); letter-spacing: .06em }
.bar { position: relative; height: 10px; margin: 5px 0 6px; background: #0b0d0e; border: 2px solid #3b3f41 }
.bar i { position: absolute; inset: 0; transform-origin: left; transition: transform .25s steps(5) }
.bar u { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #ece4d5aa }
p { margin: 0; font: 10px/1.45 var(--font-mono); color: #b9c3c8 }
p b { color: var(--bone); font-weight: 700 }
</style>
