<script setup lang="ts">
import type { ScreenTab } from '~/stores/ui'

const ui = useUiStore()
const board = useBoardStore()
const player = usePlayerStore()

const outInField = computed(() => ui.outInField)

// At home the bar offers Shelter, Gear, Map. Once Juan's packed and stepped out, the
// Shelter button ceases to exist — no free teleport back through walls — and Bag takes
// its place. Walking home through the fog is the only way back.
const HOME_TABS: { id: ScreenTab; icon: string; label: string }[] = [
  { id: 'shelter', icon: '🏠', label: 'Shelter' },
  { id: 'gear', icon: '🎽', label: 'Gear' },
  { id: 'map', icon: '🗺️', label: 'Map' },
]

const FIELD_TABS: { id: ScreenTab; icon: string; label: string }[] = [
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'bag', icon: '🎒', label: 'Bag' },
]

// Single source of truth: ui.outInField flips on at Head out and off only when Juan is
// actually back inside walls (returned, or claimed a new shelter out there).

const tabs = computed(() => {
  const source = outInField.value ? FIELD_TABS : HOME_TABS
  // Combat only appears in the bar once an encounter is actually underway — it's never a
  // place you navigate to on a whim.
  return source.filter((t) => t.id !== 'combat' || ui.combatActive)
})

const exhaustion = computed(() => player.energy < board.energyPerFreshMove)
</script>

<template>
  <nav class="flex border-t z-50" style="border-color: var(--line); background: var(--panel)">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 uppercase"
      :style="{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        letterSpacing: '1px',
        color: ui.activeTab === tab.id ? 'var(--sodium)' : 'var(--muted)',
        boxShadow: ui.activeTab === tab.id ? 'inset 0 2px 0 var(--sodium)' : 'none',
      }"
      @click="ui.setTab(tab.id)"
    >
      <span class="text-lg leading-none" :style="{ filter: ui.activeTab === tab.id ? 'none' : 'grayscale(1) opacity(.6)' }">{{ tab.icon }}</span>
      {{ tab.label }}
      <span v-if="tab.id === 'bag' && exhaustion" class="text-[7px] tracking-wide" style="color: var(--sari-red)">LOW EN</span>
      <span v-else-if="tab.id === 'map' && outInField && board.moveBudget <= 0" class="text-[7px] tracking-wide" style="color: var(--sari-red)">OUT OF MOVES</span>
    </button>
  </nav>
</template>
