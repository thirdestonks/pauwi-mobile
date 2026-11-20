<script setup lang="ts">
// The Resident Evil door (composables/useEncounterScene.ts), over the whole app: black, the
// door creaks open frame by frame, black, and whatever is behind it has been swapped in.
const { door } = useEncounterScene()
const canvas = ref<HTMLCanvasElement | null>(null)
const strips = new Map<string, HTMLImageElement>()

function strip(url: string) {
  let im = strips.get(url)
  if (!im) {
    im = new Image()
    im.onload = draw
    im.src = url
    strips.set(url, im)
  }
  return im
}

function draw() {
  const c = canvas.value?.getContext('2d')
  if (!c) return
  c.fillStyle = '#000'
  c.fillRect(0, 0, 110, 225)
  if (door.frame < 0 || !door.strip) return
  const im = strip(door.strip)
  if (!im.complete) return
  c.imageSmoothingEnabled = false
  const w = Math.round(110 * door.zoom), h = Math.round(225 * door.zoom)
  c.drawImage(im, door.frame * 110, 0, 110, 225, Math.round(55 - w / 2), Math.round((225 - h) / 2) + door.dy, w, h)
}

watch(() => [door.frame, door.zoom, door.dy, door.strip, door.shown], () => nextTick(draw))
</script>

<template>
  <div
    v-if="door.shown"
    class="absolute inset-0 z-[95] flex items-center justify-center"
    style="background: #000; transition: opacity .28s"
    :style="{ opacity: door.opacity }"
  >
    <canvas ref="canvas" width="110" height="225" class="h-full max-w-full" style="image-rendering: pixelated; aspect-ratio: 110 / 225" />
  </div>
</template>
