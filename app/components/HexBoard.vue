<script setup lang="ts">
import { axialDistance, axialToPixel, hexCorners } from '~/utils/hex'
import type { Tile, TileType } from '~/stores/board'

const board = useBoardStore()

const HEX_SIZE = 34

// Matches reference.html's RESOLVED_STYLE — dark thematic fill + colored stroke, shown once a tile is cleared.
const RESOLVED_STYLE: Record<TileType, { fill: string; stroke: string }> = {
  nothing: { fill: '#16241B', stroke: '#3A4A34' },
  location: { fill: '#201C14', stroke: '#F0A63C' },
  zombie: { fill: '#241214', stroke: '#D94B3B' },
  event: { fill: '#181430', stroke: '#8A4FA0' },
}

const TILE_ICON: Record<TileType, string> = {
  nothing: '',
  location: '🎒',
  zombie: '💀',
  event: '📡',
}

const FOG_FILL = '#232B2F'
const FOG_STROKE = '#3A444A'
const GROUND_VARIANTS = ['/images/tile_1.png', '/images/tile_2.png', '/images/tile_3.png']

interface RenderTile {
  tile: Tile
  distance: number
  clickable: boolean
  center: { x: number; y: number }
}

const playerPixel = computed(() => axialToPixel(board.playerPos, HEX_SIZE))

const visibleTiles = computed<RenderTile[]>(() =>
  Array.from(board.tiles.values())
    .map((tile) => {
      const distance = axialDistance({ q: tile.q, r: tile.r }, board.playerPos)
      return {
        tile,
        distance,
        clickable: distance === 1,
        center: axialToPixel({ q: tile.q, r: tile.r }, HEX_SIZE),
      }
    })
    .filter((rt) => rt.distance <= board.fogRingRadius),
)

// Fixed camera zoom independent of fogRingRadius — widening the fog/generation
// radius adds more world beyond the frame edges rather than shrinking every hex to fit.
const CAMERA_RADIUS = 3
const viewHalf = HEX_SIZE * (CAMERA_RADIUS + 1) * 1.8
const viewBox = computed(
  () => `${playerPixel.value.x - viewHalf} ${playerPixel.value.y - viewHalf} ${viewHalf * 2} ${viewHalf * 2}`,
)

interface LandmarkPointer {
  name: string
  distance: number
  x: number
  y: number
  angleDeg: number
}

// Landmarks are always far outside render range — this points toward them from the
// edge of the visible board instead of rendering the actual (distant) tile.
const landmarkPointers = computed<LandmarkPointer[]>(() =>
  board.landmarks.map((lm) => {
    const targetPixel = axialToPixel(lm.pos, HEX_SIZE)
    const dx = targetPixel.x - playerPixel.value.x
    const dy = targetPixel.y - playerPixel.value.y
    const len = Math.hypot(dx, dy) || 1
    const edgeR = viewHalf * 0.94
    return {
      name: lm.name,
      distance: axialDistance(board.playerPos, lm.pos),
      x: playerPixel.value.x + (dx / len) * edgeR,
      y: playerPixel.value.y + (dy / len) * edgeR,
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    }
  }),
)

function handleClick(rt: RenderTile) {
  if (!rt.clickable) return
  board.moveTo({ q: rt.tile.q, r: rt.tile.r })
}

function isShelter(rt: RenderTile) {
  return rt.tile.q === board.shelterPos.q && rt.tile.r === board.shelterPos.r
}

function fogClipId(rt: RenderTile) {
  return `fogclip-${rt.tile.q}-${rt.tile.r}`
}

// Fully opaque once past the icon ring, fully faded once revealed — CSS transition
// on opacity animates this smoothly as distance crosses the boundary during movement.
function fogOpacity(rt: RenderTile) {
  if (isShelter(rt)) return 0
  return rt.distance > board.iconRingRadius ? 1 : 0
}

function showGround(rt: RenderTile) {
  return !isShelter(rt) && rt.distance <= board.iconRingRadius
}

// Cleared tiles always show the green "safe ground" tile. Unresolved tiles get a
// stable-per-coordinate pick from the neutral variants so it doesn't flicker on re-render.
function groundImage(rt: RenderTile) {
  if (rt.tile.cleared) return '/images/green-tile.png'
  const idx = Math.abs(rt.tile.q * 31 + rt.tile.r * 17) % GROUND_VARIANTS.length
  return GROUND_VARIANTS[idx]
}
</script>

<template>
  <div class="w-full h-full" style="background: linear-gradient(160deg, #12181b, #0b0f11)">
    <svg :viewBox="viewBox" class="w-full h-full">
      <defs>
        <clipPath v-for="rt in visibleTiles" :id="fogClipId(rt)" :key="fogClipId(rt)" clipPathUnits="userSpaceOnUse">
          <polygon :points="hexCorners(rt.center, HEX_SIZE - 1)" />
        </clipPath>
      </defs>
      <g
        v-for="rt in visibleTiles"
        :key="`${rt.tile.q},${rt.tile.r}`"
        :class="rt.clickable ? 'cursor-pointer' : ''"
        style="transition: filter .15s"
        @click="handleClick(rt)"
      >
        <polygon
          :points="hexCorners(rt.center, HEX_SIZE - 1)"
          :fill="isShelter(rt) ? '#241A0C' : (rt.distance > board.iconRingRadius ? FOG_FILL : 'transparent')"
          :fill-opacity="isShelter(rt) ? 1 : (rt.distance > board.iconRingRadius ? 0.55 : 1)"
          :stroke="isShelter(rt) ? '#F0A63C' : (rt.distance > board.iconRingRadius ? FOG_STROKE : (rt.tile.cleared && rt.tile.type !== 'nothing' ? RESOLVED_STYLE[rt.tile.type].stroke : 'transparent'))"
          :stroke-width="isShelter(rt) ? 3 : 2"
        />
        <image
          v-if="showGround(rt)"
          :href="groundImage(rt)"
          :x="rt.center.x - HEX_SIZE"
          :y="rt.center.y - HEX_SIZE"
          :width="HEX_SIZE * 2"
          :height="HEX_SIZE * 2"
          preserveAspectRatio="xMidYMid slice"
          :clip-path="`url(#${fogClipId(rt)})`"
          style="pointer-events: none"
        />
        <image
          href="/images/fog.png"
          :x="rt.center.x - HEX_SIZE * 1.4"
          :y="rt.center.y - HEX_SIZE * 1.4"
          :width="HEX_SIZE * 2.8"
          :height="HEX_SIZE * 2.8"
          preserveAspectRatio="xMidYMid slice"
          :clip-path="`url(#${fogClipId(rt)})`"
          :opacity="fogOpacity(rt)"
          style="transition: opacity .5s ease; pointer-events: none"
        />
        <text
          v-if="isShelter(rt) || (rt.distance <= board.iconRingRadius && TILE_ICON[rt.tile.type])"
          :x="rt.center.x"
          :y="rt.center.y"
          text-anchor="middle"
          dominant-baseline="central"
          :font-size="HEX_SIZE * 0.7"
        >
          {{ isShelter(rt) ? '🏠' : TILE_ICON[rt.tile.type] }}
        </text>
        <text
          v-if="isShelter(rt)"
          :x="rt.center.x"
          :y="rt.center.y + HEX_SIZE * 0.85"
          text-anchor="middle"
          font-family="var(--font-mono)"
          font-size="8"
          fill="#F0A63C"
        >SHELTER</text>
      </g>
      <g>
        <image
          href="/images/juan.png"
          :x="playerPixel.x - HEX_SIZE"
          :y="playerPixel.y - HEX_SIZE * 1.15"
          :width="HEX_SIZE * 2"
          :height="HEX_SIZE * 2"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
      <g v-for="lm in landmarkPointers" :key="lm.name" style="pointer-events: none" opacity="0.35">
        <circle :cx="lm.x" :cy="lm.y" r="5" fill="#F0A63C" />
        <text
          :x="lm.x"
          :y="lm.y + 14"
          text-anchor="middle"
          font-family="var(--font-mono)"
          font-size="7"
          letter-spacing="1"
          fill="#F0A63C"
        >{{ lm.name.toUpperCase() }} · {{ lm.distance }}</text>
      </g>
    </svg>
  </div>
</template>
