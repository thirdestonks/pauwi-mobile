// Sound for the whole game. One-shots pick a random variation (name, name-2, …) and never repeat the
// last one; beds (rain, the day street, a radio) loop and ease toward a target volume. Files are the
// trimmed, levelled ones exported from the .art previews into public/game/sfx/.
// Browsers keep audio silent until the first tap, so beds retry on the next pointerdown.

const BASE = '/game/sfx/'
const VARIATIONS: Record<string, number> = { 'door-open': 2, 'juan-walkstep-map': 2, 'weapon-swing': 2, 'zombie-hurt': 2, 'equip-sound': 2 }
const last: Record<string, number> = {}
const beds: Record<string, { a: HTMLAudioElement; want: number }> = {}
let muted = false
let started = false

function startEasing() {
  if (started || typeof window === 'undefined') return
  started = true
  setInterval(() => {
    for (const b of Object.values(beds)) {
      const d = b.want - b.a.volume
      b.a.volume = Math.abs(d) < 0.04 ? b.want : Math.min(1, Math.max(0, b.a.volume + Math.sign(d) * 0.04))
      if (b.a.volume === 0 && b.want === 0 && !b.a.paused) b.a.pause()
    }
  }, 60)
  window.addEventListener('pointerdown', () => {
    for (const b of Object.values(beds)) if (b.want > 0 && b.a.paused) b.a.play().catch(() => {})
  })
}

/** Plays a one-shot, picking a fresh variation when the sound has several. */
function play(name: string, volume = 1) {
  if (muted || typeof window === 'undefined') return
  const n = VARIATIONS[name] ?? 1
  let k = Math.floor(Math.random() * n)
  if (n > 1 && k === last[name]) k = (k + 1) % n
  last[name] = k
  const a = new Audio(`${BASE}${name}${k ? '-' + (k + 1) : ''}.mp3`)
  a.volume = volume
  a.play().catch(() => {})
}

/** Says whether a looping bed should be playing, and how loud; it fades to match. */
function bed(name: string, on: boolean, volume = 1) {
  if (typeof window === 'undefined') return
  startEasing()
  let b = beds[name]
  if (!b) {
    if (!on) return
    const a = new Audio(`${BASE}${name}.mp3`)
    a.loop = true
    a.volume = 0
    b = beds[name] = { a, want: 0 }
  }
  b.want = on && !muted ? volume : 0
  if (b.want > 0 && b.a.paused) b.a.play().catch(() => {})
}

function mute(value: boolean) {
  muted = value
  if (value) for (const b of Object.values(beds)) b.want = 0
}

export function useSfx() {
  return { play, bed, mute }
}
