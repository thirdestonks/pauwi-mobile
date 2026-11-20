<script setup lang="ts">
// Renders the map's encounter scene (composables/useEncounterScene.ts): the interior page
// behind the tile card. The door transition is DoorTransition.vue, app-wide.
const { src, scene, attach, hideNow } = useEncounterScene()
const sfx = useSfx()
// The radio plays while Juan listens to it.
watch(scene, (s) => sfx.bed('indoor_radio-event', s === 'radio', 0.6), { immediate: true })
const frame = ref<HTMLIFrameElement | null>(null)
watch(src, () => nextTick(() => attach(frame.value?.contentWindow ?? null)))
// Leaving the map (a fight, the bag, the shelter) takes the scene down with it.
onBeforeUnmount(() => { attach(null); hideNow(); sfx.bed('indoor_radio-event', false) })
</script>

<template>
  <iframe
    v-if="src"
    ref="frame"
    :src="src"
    title="Encounter"
    class="absolute inset-0 w-full h-full z-[62] border-0"
    style="background: #000"
    @load="attach(frame?.contentWindow ?? null)"
  />
</template>
