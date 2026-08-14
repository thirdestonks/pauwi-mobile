<script setup lang="ts">
import type { ScreenTab } from '~/stores/ui'

const ui = useUiStore()

const ALL_TABS: { id: ScreenTab; icon: string; label: string }[] = [
  { id: 'shelter', icon: '🏠', label: 'Shelter' },
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'combat', icon: '⚔️', label: 'Combat' },
]

// Combat only appears in the bar once an encounter is actually underway — it's never a place you navigate to on a whim.
const tabs = computed(() => ALL_TABS.filter((t) => t.id !== 'combat' || ui.combatActive))
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
    </button>
  </nav>
</template>
