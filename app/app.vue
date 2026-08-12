<script setup lang="ts">
const ui = useUiStore()
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
      <CombatScreen v-else-if="ui.activeTab === 'combat'" />

      <TabBar />

      <PrologueScreen v-if="!ui.prologueDone" />
    </div>
  </div>
</template>
