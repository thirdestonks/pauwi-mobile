// Juan on the pixel map: the top-down flashlight survivor, ported from the movement study
// (.art/juan-move-preview). Two 20-frame strips (idle, move) built at half size by
// .art/juan-move-preview/export.py. Each frame is rotated so the flashlight points the way
// Juan walks, shrunk to map scale and handed to the renderer as a 64×64 binary-alpha sprite.
import type { Sprite } from './tondoRender'

export type JuanMode = 'idle' | 'move'

const SRC = '/game/juan-move-preview/out/juan-'
const FRAMES = 20
const FPS = 20
/** Body size on the map in pixels — the study's tuned default. */
const BODY = 16
/** Source frames are half the painted 174px body. */
const SCALE = BODY / 87
/** Both strips share a shoulder pivot; their frames differ in height by 4px. */
const PIVOT: Record<JuanMode, [number, number]> = { idle: [53, 56], move: [53, 60] }
const SIZE = 64

export function createJuanAvatar() {
  const strips: Partial<Record<JuanMode, HTMLImageElement>> = {}
  for (const mode of ['idle', 'move'] as const) {
    const im = new Image()
    im.onload = () => (strips[mode] = im)
    im.src = SRC + mode + '.png'
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  let mode: JuanMode = 'idle'
  let time = 0
  /** Facing on screen, radians: 0 is east, π/2 south (towards the camera). */
  let angle = Math.PI / 2
  let cacheKey = ''
  let cached: Sprite | null = null

  /** Switches between idle and move, restarting the cycle so a step always starts on frame 1. */
  function setMode(next: JuanMode) {
    if (next !== mode) { mode = next; time = 0 }
  }

  /** Faces the flashlight from one hex towards a neighbour, on the squashed ground plane. */
  function face(dq: number, dr: number) {
    angle = Math.atan2(Math.sqrt(3) * (dr + dq / 2) * 0.62, 1.5 * dq)
  }

  /** The sprite for this frame, or null until the strips have loaded. */
  function sprite(dt: number): Sprite | null {
    time += dt
    const im = strips[mode]
    if (!im) return null
    const frame = Math.floor((time * FPS) / 1000) % FRAMES
    const key = `${mode}:${frame}:${angle}`
    if (key === cacheKey) return cached
    cacheKey = key
    const fw = im.width / FRAMES, [px, py] = PIVOT[mode]
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.translate(SIZE / 2, SIZE / 2)
    ctx.rotate(angle)
    ctx.scale(SCALE, SCALE)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(im, frame * fw, 0, fw, im.height, -px, -py, fw, im.height)
    const d = ctx.getImageData(0, 0, SIZE, SIZE).data
    // The map's blitter is binary alpha: drop the faint edge pixels, keep the rest solid.
    for (let i = 3; i < d.length; i += 4) d[i] = d[i]! < 100 ? 0 : 255
    cached = { d, w: SIZE, h: SIZE }
    return cached
  }

  return { setMode, face, sprite }
}
