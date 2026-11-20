// Juan's kit, the map screen's interface (.art/map-ui, concept B). The watch, the compass and the phone are painted sprites
// (.art/kit, public/game/kit/out); this draws what changes on them at the game's own scale: the watch's LCD readout and the
// compass needle. The shelter key is still drawn here. Pure drawing, no state.

type Fill = (x: number, y: number, w: number, h: number, col: string) => void
const filler = (c: CanvasRenderingContext2D): Fill => (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h) }

/** 3x5 LCD digits (and D, N, a colon). */
const GLYPH: Record<string, string[]> = {
  0: ['111', '101', '101', '101', '111'], 1: ['01', '11', '01', '01', '11'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], D: ['110', '101', '101', '101', '110'], N: ['101', '111', '111', '111', '101'], ':': ['0', '1', '0', '1', '0'],
}
function text(r: Fill, s: string, x: number, y: number, col: string) {
  for (const ch of s) {
    if (ch === ' ') { x += 2; continue }
    const g = GLYPH[ch] ?? GLYPH[0]!
    g.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') r(x + i, y + j, 1, 1, col) }))
    x += g[0]!.length + 1
  }
}

/**
 * The readout on the painted watch's LCD (kit-watch.png, its screen is 19x12): the hour, the moves left as segments, energy as a
 * thin bar. Dark ink on a pale screen by day, pale ink on a dark screen at night, and lit up (the backlight) when tapped.
 */
export function drawLcd(cv: HTMLCanvasElement, o: { night: boolean; lit: boolean; hour: number; moves: number; maxMoves: number; energy: number }) {
  const c = cv.getContext('2d')!, r = filler(c), W = cv.width, H = cv.height
  c.clearRect(0, 0, W, H)
  const bg = o.lit ? '#a8ffc8' : o.night ? '#1d3424' : '#a3b99a'
  const ink = o.lit ? '#0b2a16' : o.night ? '#8fe08a' : '#1a2318'
  const dim = o.lit ? '#7fd9a2' : o.night ? '#2b4a33' : '#8aa184'
  r(0, 0, W, H, bg)
  text(r, `${String(o.hour).padStart(2, '0')}:00`, 1, 1, ink)
  const n = Math.max(o.maxMoves, o.moves), seg = Math.max(1, Math.floor((W - 2 + 1) / n) - 1)
  for (let k = 0; k < n; k++) r(1 + k * (seg + 1), 7, seg, 2, k < o.moves ? ink : dim)
  r(1, 10, W - 2, 1, dim); r(1, 10, Math.round(((W - 2) * Math.max(0, Math.min(100, o.energy))) / 100), 1, o.energy < 20 ? '#d94b3b' : ink)
}

/** The needle on the painted compass (kit-compass.png): blue end toward the target at angle `a`, the red tail behind it. */
export function drawNeedle(cv: HTMLCanvasElement, a: number, cx: number, cy: number, len: number) {
  const c = cv.getContext('2d')!, r = filler(c)
  c.clearRect(0, 0, cv.width, cv.height)
  for (let k = -len; k <= len; k++) r(Math.round(cx + Math.cos(a) * k - .5), Math.round(cy + Math.sin(a) * k - .5), 1, 1, k > 0 ? '#2e86ab' : k < 0 ? '#c23a2c' : '#000')
  r(Math.round(cx - 1), Math.round(cy - 1), 2, 2, '#3a2a12')
}

/** The shelter key on its red lanyard, 18x24. */
export function drawKey(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d')!, r = filler(c)
  c.clearRect(0, 0, 18, 24)
  for (let y = 0; y < 8; y++) { r(5 + Math.round(Math.sin(y * 0.7)), y, 2, 1, '#d94b3b'); r(11 - Math.round(Math.sin(y * 0.7)), y, 2, 1, '#d94b3b') }
  r(4, 7, 10, 10, '#000'); r(5, 8, 8, 8, '#d6a640'); r(7, 10, 4, 4, '#000')
  r(7, 16, 4, 8, '#000'); r(8, 16, 2, 8, '#d6a640'); r(10, 19, 3, 2, '#000'); r(10, 22, 2, 2, '#000')
}
