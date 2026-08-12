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

const UNRESOLVED_FILL = '#1D2529'
const UNRESOLVED_STROKE = '#2A343A'
const FOG_FILL = '#232B2F'
const FOG_STROKE = '#3A444A'

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

const viewHalf = HEX_SIZE * (board.fogRingRadius + 1) * 1.8
const viewBox = computed(
  () => `${playerPixel.value.x - viewHalf} ${playerPixel.value.y - viewHalf} ${viewHalf * 2} ${viewHalf * 2}`,
)

function handleClick(rt: RenderTile) {
  if (!rt.clickable) return
  board.moveTo({ q: rt.tile.q, r: rt.tile.r })
}
</script>

<template>
  <div class="w-full h-full" style="background: linear-gradient(160deg, #12181b, #0b0f11)">
    <svg :viewBox="viewBox" class="w-full h-full">
      <g
        v-for="rt in visibleTiles"
        :key="`${rt.tile.q},${rt.tile.r}`"
        :class="rt.clickable ? 'cursor-pointer' : ''"
        style="transition: filter .15s"
        @click="handleClick(rt)"
      >
        <polygon
          :points="hexCorners(rt.center, HEX_SIZE - 1)"
          :fill="rt.distance > board.iconRingRadius ? FOG_FILL : (rt.tile.cleared ? RESOLVED_STYLE[rt.tile.type].fill : UNRESOLVED_FILL)"
          :fill-opacity="rt.distance > board.iconRingRadius ? 0.55 : 1"
          :stroke="rt.distance > board.iconRingRadius ? FOG_STROKE : (rt.tile.cleared ? RESOLVED_STYLE[rt.tile.type].stroke : UNRESOLVED_STROKE)"
          :stroke-width="2"
        />
        <text
          v-if="rt.distance <= board.iconRingRadius && TILE_ICON[rt.tile.type]"
          :x="rt.center.x"
          :y="rt.center.y"
          text-anchor="middle"
          dominant-baseline="central"
          :font-size="HEX_SIZE * 0.7"
        >
          {{ TILE_ICON[rt.tile.type] }}
        </text>
      </g>
      <g>
        <polygon :points="hexCorners(playerPixel, HEX_SIZE - 1)" fill="#241A0C" stroke="#F0A63C" stroke-width="3" />
        <text :x="playerPixel.x" :y="playerPixel.y" text-anchor="middle" dominant-baseline="central" :font-size="HEX_SIZE * 0.7">🧍</text>
      </g>
    </svg>
  </div>
</template>
