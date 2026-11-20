// The pixel hex map's renderer, ported from the preview's draw() (.art/hex-map/index.html).
// A 110×225 canvas shown pixelated: an oblique, squashed flat-top hex map where light is the
// fog — grey fog by day, a flashlight pocket in pitch black at night. Houses rise as walls
// with painted roofs and shopfronts; props hint at what the next ring holds.
// The camera glides with Juan (walkTo); everything else is drawn fresh each frame.
import {
  LM, NB, SHELTERS, SHOPS, content, hash, hexDist, mod, tile, tkey, vnoise,
  type ShelterKey,
} from './tondo'

export const W = 110
export const H = 225
const R = 17, SQ = 0.62, S3 = Math.sqrt(3)
const JX = 55, JY = 128
const RT = 40
const ROOF_I = { rust: 0, tin: 1, tarp: 2, patch: 3 } as const
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16))
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const hex2rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const TEX = '/game/hex-map/tex/'
/** Dash beam colours by distance: jeepney green two hexes out, sodium yellow three. */
const BEAM: Record<number, number[]> = { 2: [110, 220, 140], 3: [245, 205, 80] }

export interface Sprite { d: Uint8ClampedArray; w: number; h: number }

export interface MapFrameState {
  jq: number
  jr: number
  home: ShelterKey
  night: boolean
  rain: boolean
  /** Keys of cleared (visited) hexes. */
  visited: Set<string>
  /** Hexes a free dash reaches, key → distance (2 green, 3 yellow): they glow with a slow beam. */
  dash?: Map<string, number>
  /** Cleared hexes that held something: the prop stays behind, dimmed once it's dealt with. */
  marks?: Map<string, { prop: 'bag' | 'body' | 'radio' | 'supply'; live: boolean }>
  /** Houses whose door is no longer what it was generated as: pried open, or already searched. Key is the house hex. */
  houses?: Map<string, 'open' | 'locked' | 'boarded' | 'done'>
  /** Places marked on the phone ("come back later"): they pulse bone-white, wherever they are in sight. */
  pins?: Set<string>
  /** Where Aling Cora's stall stands today (by day only). */
  trader?: { q: number; r: number } | null
}

export function createTondoRenderer(canvas: HTMLCanvasElement) {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const px = img.data
  const EM = new Uint8Array(W * H)
  const R_ = new Float32Array(W * H), G_ = new Float32Array(W * H), B_ = new Float32Array(W * H)
  const HX = new Int32Array(W * H * 2)
  const DROPS = Array.from({ length: 60 }, (_, i) => ({ x: hash(i, 1, 30) * W, y: hash(i, 2, 30) * H, v: 2.2 + hash(i, 3, 30) * 1.6 }))

  // ---------- textures ----------
  const SPR: Record<string, Sprite> = {}
  const FRONT: Record<string, Uint8ClampedArray> = {}
  let ROOF: Uint8ClampedArray | null = null
  let WALL: Uint8ClampedArray | null = null
  let GROUND: Uint8ClampedArray | null = null
  let TUT: Uint8ClampedArray | null = null
  function load(name: string, set: (s: Sprite) => void, base = TEX) {
    const im = new Image()
    im.onload = () => {
      const c = document.createElement('canvas')
      c.width = im.width
      c.height = im.height
      const x = c.getContext('2d')!
      x.drawImage(im, 0, 0)
      set({ d: x.getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height })
    }
    im.src = base + name + '.png'
  }
  load('roofs', (s) => (ROOF = s.d))
  load('wall', (s) => (WALL = s.d))
  load('ground', (s) => (GROUND = s.d))
  load('tut', (s) => (TUT = s.d))
  for (const f of ['botika', 'brgy', 'diner', 'kainan', 'kwik', 'mm', 'nida', 'store', 't10', 'water']) load('front-' + f, (s) => (FRONT[f] = s.d))
  for (const [file, name] of [['spr-juan', 'JUAN'], ['spr-bag', 'bag'], ['spr-body', 'body'], ['spr-radio', 'radio'], ['spr-supply', 'supply'], ['spr-tclose', 'TCLOSE']]) load(file!, (s) => (SPR[name!] = s))
  load('prop-stall', (s) => (SPR.stall = s), '/game/kit/out/')        // Aling Cora's stall (kit/build.py)

  // ---------- camera: glides from hex to hex while Juan walks ----------
  let cq = 0, cr = 0
  // Juan himself: the original standing sprite (spr-juan, 15x28, 4 frames), the user's pick over the top-down one. He faces the way
  // he last walked sideways and takes a step on alternate beats of the glide.
  let facing = 1
  let walk: null | { fq: number; fr: number; tq: number; tr: number; t: number; ms: number; done: () => void } = null

  function centre(q: number, r: number): [number, number] {
    return [JX + R * 1.5 * (q - cq), JY + R * S3 * ((r - cr) + (q - cq) / 2) * SQ]
  }
  function inHex(dx: number, dy: number) {
    const u = Math.abs(dx), v = Math.abs(dy / SQ)
    return v <= (S3 / 2) * R && S3 * u + v <= S3 * R
  }
  /** Which hex a canvas pixel belongs to (ground plane). */
  function pixelHex(x: number, y: number): [number, number] {
    const lx = x - JX, ly = (y - JY) / SQ
    const qf = ((2 / 3) * lx) / R, rf = ((-1 / 3) * lx + (S3 / 3) * ly) / R
    let q = Math.round(qf), r = Math.round(rf)
    const s = Math.round(-qf - rf)
    const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s + qf + rf)
    if (dq > dr && dq > ds) q = -r - s
    else if (dr > ds) r = -q - s
    return [q + Math.round(cq), r + Math.round(cr)]
  }
  function put(x: number, y: number, c: number[], hq: number, hr: number) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = y * W + x
    R_[i] = c[0]!; G_[i] = c[1]!; B_[i] = c[2]!
    HX[i * 2] = hq; HX[i * 2 + 1] = hr
  }
  const NB_ANG = NB.map(([a, b]) => Math.atan2(S3 * (b + a / 2), 1.5 * a))
  function edgeDir(dx: number, dy: number) {
    const a = Math.atan2(dy / SQ, dx)
    let best = 0, bd = 9
    NB_ANG.forEach((n, i) => {
      const d = Math.abs(Math.atan2(Math.sin(a - n), Math.cos(a - n)))
      if (d < bd) { bd = d; best = i }
    })
    return NB[best]!
  }
  const texAt = (D: Uint8ClampedArray, w: number, u: number, v: number) => {
    const i = (v * w + u) * 4
    return [D[i]!, D[i + 1]!, D[i + 2]!]
  }
  function roofTex(kind: keyof typeof ROOF_I, wx: number, wy: number) {
    if (!ROOF) return kind === 'tarp' ? [44, 82, 132] : kind === 'tin' ? [112, 116, 118] : [118, 64, 40]
    const u = mod(Math.floor(wx), RT) + ROOF_I[kind] * RT, v = mod(Math.floor(wy / SQ), RT), i = (v * RT * 4 + u) * 4
    return [ROOF[i]!, ROOF[i + 1]!, ROOF[i + 2]!]
  }
  function blit(name: string, ax: number, ay: number, q: number, r: number, o: { frame?: number; frames?: number; mirror?: boolean; anchor?: 'bottom' | 'centre'; dim?: boolean } = {}) {
    const S_ = SPR[name]
    if (!S_) return false
    const { frame = 0, frames = 1, mirror = false, anchor = 'bottom', dim = false } = o
    const k = dim ? 0.5 : 1
    const fw = S_.w / frames, ox = Math.round(ax - fw / 2), oy = Math.round(anchor === 'bottom' ? ay - S_.h : ay - S_.h / 2)
    for (let y = 0; y < S_.h; y++) for (let x = 0; x < fw; x++) {
      const sx = frame * fw + (mirror ? fw - 1 - x : x), j = (y * S_.w + sx) * 4
      if (S_.d[j + 3]) put(ox + x, oy + y, [S_.d[j]! * k, S_.d[j + 1]! * k, S_.d[j + 2]! * k], q, r)
    }
    return true
  }

  const GLOW = new Map<string, number[] | null>()
  /** purple: an unsearched shopfront · orange: a shelter Juan could move to · amber: a house with an open door, red: a locked one (within his reach). */
  function glowOf(q: number, r: number, s: MapFrameState) {
    if (q === -9999) return null
    const k = tkey(q, r)
    if (GLOW.has(k)) return GLOW.get(k)!
    const t = tile(q, r)
    let c: number[] | null = null
    if (s.pins?.has(k)) c = [236, 228, 213]
    else if (t.front && (SHOPS as string[]).includes(t.front) && !s.visited.has(tkey(q, r + 1))) c = [168, 96, 236]
    else if (t.front && t.front in SHELTERS && t.front !== s.home) c = [244, 150, 56]
    else if (t.type === 'house' && !t.front && t.door && hexDist(q, r, s.jq, s.jr) <= 3) {
      const st = s.houses?.get(k) ?? t.door
      if (st === 'open') c = [255, 196, 92]
      else if (st === 'locked') c = [226, 84, 66]
    }
    GLOW.set(k, c)
    return c
  }

  function draw(T: number, s: MapFrameState) {
    const { jq, jr, home, night, rain, visited, dash, marks, houses } = s
    GLOW.clear()
    // hexes within view, far (top) first so nearer ones overlap them
    const list: [number, number, number, number][] = []
    for (let dq = -6; dq <= 6; dq++) for (let dr = -10; dr <= 10; dr++) {
      const q = Math.round(cq) + dq, r = Math.round(cr) + dr
      const [cx, cy] = centre(q, r)
      if (cx < -R * 2 || cx > W + R * 2 || cy < -R * 3 || cy > H + R * 2) continue
      list.push([cy, q, r, cx])
    }
    list.sort((a, b) => a[0] - b[0])
    R_.fill(0); G_.fill(0); B_.fill(0); HX.fill(-9999); EM.fill(0)
    for (const [cy, q, r, cx] of list) {
      const t = tile(q, r)
      // ground
      for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy
        if (!inHex(dx, dy)) continue
        const wx = x - cx + q * R * 1.5, wy = y - cy + (r + q / 2) * R * S3 * SQ   // world-ish texture coords so ground doesn't swim
        // painted ground: asphalt for roads, concrete or gravel patchwork for alleys, mud for puddles
        const gi = t.type === 'road' ? 0 : t.puddle && Math.hypot(dx * 0.8, dy / SQ) < R * 0.55 ? 2 : hash(q, r, 42) > 0.6 ? 3 : 1
        let c = GROUND ? texAt(GROUND, 128, mod(Math.floor(wx), 32) + gi * 32, mod(Math.floor(wy / SQ), 32)) : t.type === 'road' ? [62, 64, 68] : [90, 86, 76]
        if (t.trash && Math.hypot(dx - 4, dy - 1) < 3) c = [60 + hash(x, y, 3) * 60, 50, 40]
        // faint hex edge lines on the ground
        const u = Math.abs(dx), v = Math.abs(dy / SQ)
        const edge = Math.max(v - ((S3 / 2) * R - 1), (S3 * u + v) - (S3 * R - 1.6)) > 0
        if (edge) c = c.map((k) => k + 22)
        put(x, y, c, q, r)
        // cleared ground: free to cross
        if (edge && visited.has(tkey(q, r)) && !(q === jq && r === jr)) EM[y * W + x] = 1
      }
      if (t.lamp) for (let k = 0; k < 26; k++) put(cx + 5, cy - k, [40, 40, 44], q, r)
      // the next ring hints at what it holds: a dropped bag, a body, a blinking radio
      const ct = content(q, r, home), near = hexDist(q, r, jq, jr) === 1 && !visited.has(tkey(q, r))
      if (near && (ct === 'loot' || ct === 'car')) blit(hash(q, r, 50) > 0.5 ? 'supply' : 'bag', cx, cy + 3, q, r)
      else if (near && ct === 'zombie') blit('body', cx, cy + 4, q, r)
      else if (near && ct === 'event') {
        blit('radio', cx, cy + 3, q, r)
        if (Math.floor(T / 400) % 2) put(cx + 2, cy - 2, [80, 230, 120], q, r)
      }
      // what was here, remembered: dimmed once it's dealt with, as it was while it's still waiting
      else if (!(q === jq && r === jr)) {
        const mk = marks?.get(tkey(q, r))
        if (mk) blit(mk.prop, cx, cy + (mk.prop === 'body' ? 4 : 3), q, r, { dim: !mk.live })
      }
      // Aling Cora's stall, where she has set up today (it sits under Juan when he is at it)
      if (s.trader && s.trader.q === q && s.trader.r === r) blit('stall', cx, cy + 4, q, r)
      // raised houses: walls, then the roof sitting h pixels up
      if (t.type === 'house') {
        const wall = hex2rgb(t.wall ?? '#8a7f6e')
        for (let y = Math.floor(cy - R - t.h); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy
          if (inHex(dx, dy + t.h)) {
            // painted roof textures, sampled in world space so neighbouring roofs continue seamlessly
            let c = roofTex(t.roof ?? 'rust', x - cx + q * R * 1.5, (dy + t.h) + (r + q / 2) * R * S3 * SQ)
            if (Math.abs(dy + t.h) / SQ > (S3 / 2) * R - 1.2 || S3 * Math.abs(dx) + Math.abs((dy + t.h) / SQ) > S3 * R - 2) {
              const [eq, er] = edgeDir(dx, dy + t.h), n = tile(q + eq, r + er)
              // rim only where the block ends or steps down
              if (n.type !== 'house' || n.h < t.h) c = c.map((v) => v * 0.7)
            }
            put(x, y, c, q, r)
            continue
          }
          let side = false
          for (let k = 0; k <= t.h; k++) if (inHex(dx, dy + k)) { side = true; break }
          if (!side) continue
          const fn = dx < -R * 0.5 ? [-1, 1] : dx > R * 0.5 ? [1, 0] : [0, 1]   // the neighbour this face looks at
          const nb = tile(q + fn[0]!, r + fn[1]!)
          if (nb.type === 'house' && nb.h >= t.h) continue                       // shared wall: hidden inside the block
          const face = dx < -R * 0.5 ? 0.62 : dx > R * 0.5 ? 0.85 : 0.74         // three visible faces
          const ground = cy + Math.min((S3 / 2) * R, S3 * (R - Math.abs(dx))) * SQ  // where this column of wall meets the ground
          const fy = Math.max(0, Math.floor(ground - (y + 0.5)))                 // height up the wall
          let c: number[]
          const front = t.front ? FRONT[t.front] : undefined
          if (front && fy < 23) {
            // a painted ground floor wraps the front
            const u = clamp(Math.floor(((dx + R) / (2 * R)) * 34), 0, 33), v = clamp(22 - fy, 0, 22)
            c = texAt(front, 34, u, v).map((k) => k * (0.82 + face * 0.25))
          } else if (WALL) {
            // facade strip, each house starts at its own spot
            const u = mod(Math.floor(x - cx + q * R * 1.5 + hash(q, r, 12) * 92), 92), v = clamp(27 - fy, 0, 27)
            c = texAt(WALL, 92, u, v).map((k) => k * (face + 0.12))
          } else c = wall.map((v) => v * face)
          // a door on the street face (the middle band): open is a dark doorway with a slit of warm light, locked is a shut door with a
          // red padlock, boarded is planks across a dark opening, done is a plain shut door. This is how a house shows it can be entered.
          if (t.door && fn[0] === 0 && fn[1] === 1 && Math.abs(dx) <= 3.5 && fy < 11) {
            const st = houses?.get(tkey(q, r)) ?? t.door
            if (Math.abs(dx) > 2.5 || fy >= 10) c = [58, 46, 36]                                  // the frame
            else if (st === 'open') c = dx > 1 && fy > 1 ? [236, 168, 72] : [14, 10, 10]
            else if (st === 'locked') c = fy >= 4 && fy <= 5 && dx > 0.5 && dx < 2.5 ? [217, 75, 59] : [100, 72, 48]
            else if (st === 'done') c = [52, 48, 44]
            else c = fy % 4 < 2 ? [122, 100, 70] : [16, 12, 12]
          }
          put(x, y, c, q, r)
        }
      }
    }
    // Tutuban up close, then Juan on his hex
    const [jx0, jy0] = centre(cq, cr), jx = Math.round(jx0), jy = Math.round(jy0)
    if (hexDist(jq, jr, LM.q, LM.r) <= 9) blit('TCLOSE', ...centre(LM.q, LM.r), LM.q, LM.r, { anchor: 'centre' })
    if (walk && walk.tq !== walk.fq) facing = walk.tq < walk.fq ? -1 : 1
    const step = walk ? Math.floor(walk.t * 4) % 2 : -1
    blit('JUAN', jx, jy + 4, jq, jr, { frames: 4, frame: step === 0 ? 1 : 0, mirror: facing < 0 })

    // light = fog of war: flashlight at night, fog by day, quantised with dither
    const fog = [118, 128, 124]
    const homeQ = SHELTERS[home].q, homeR = SHELTERS[home].r
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, hq = HX[i * 2]!, hr = HX[i * 2 + 1]!
      const ring = hq === -9999 ? 99 : hexDist(hq, hr, jq, jr)
      const d = Math.hypot(x - jx, (y - jy + 4) / SQ)                               // distance on the ground plane
      let r = R_[i]!, g = G_[i]!, b = B_[i]!
      if (night) {
        let L = Math.pow(clamp(1 - d / 82, 0, 1), 1.1) * (0.97 + 0.03 * Math.sin(T * 0.023))   // flashlight pocket
        if (ring >= 2) L *= 0.7
        // cleared ground is remembered as gloom; the rest is nothing
        if (ring > 3) L = visited.has(tkey(hq, hr)) ? 0.16 : 0
        // home's light is always on
        if (hq === homeQ && hr === homeR) L = Math.max(L, 0.55)
        L = Math.floor(L * 6 + BAYER[y & 3]![x & 3]!) / 6                               // banded, dithered
        const amb = ring <= 3 ? 0.1 : 0
        r = r * (amb * 0.8 + L * 1.05); g = g * (amb * 0.9 + L * 0.98); b = b * (amb * 1.3 + L * 0.86)
      } else {
        let f = clamp((d - 34) / 70, 0, 1)
        if (ring > 3) f = visited.has(tkey(hq, hr)) ? 0.72 : 1
        f = clamp(f + 0.12 * (vnoise(x * 0.06 + T * 0.0004, y * 0.08, 5) - 0.5), 0, 1)
        f = Math.floor(f * 6 + BAYER[y & 3]![x & 3]!) / 6
        r = r * 0.92 + (fog[0]! - r * 0.92) * f; g = g * 0.96 + (fog[1]! - g * 0.96) * f; b = b * 0.95 + (fog[2]! - b * 0.95) * f
      }
      // special places pulse faintly, even in the dark
      const gk = glowOf(hq, hr, s)
      if (gk) {
        const k = (night ? 0.2 : 0.14) * (0.65 + 0.35 * Math.sin(T * 0.0025 + (hq + hr) * 0.7))
        r += (gk[0]! - r) * k; g += (gk[1]! - g) * k; b += (gk[2]! - b) * k
      }
      // a dash can land here: the ground breathes green (2 away) or yellow (3 away)
      const dk = dash && hq !== -9999 ? dash.get(tkey(hq, hr)) : undefined
      if (dk) {
        const bc = BEAM[dk] ?? BEAM[2]!, k = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(T * 0.0022 + dk))
        r += (bc[0]! - r) * k; g += (bc[1]! - g) * k; b += (bc[2]! - b) * k
      }
      // jeepney-green outline on cleared ground, faintly glowing even in the dark
      if (EM[i]) {
        const k = ring <= 3 ? 0.55 : 0.32
        r += (90 - r) * k; g += (161 - g) * k; b += (122 - b) * k
      }
      px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255
    }
    // the dash beams: a thin, slow column of light rising off each hex a dash can reach
    if (dash) for (const [k, d] of dash) {
      const [q, r] = k.split(',').map(Number) as [number, number]
      const [cx, cy] = centre(q, r), bc = BEAM[d] ?? BEAM[2]!, pulse = 0.5 + 0.5 * Math.sin(T * 0.0022 + d)
      for (let dy = 0; dy < 30; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = Math.round(cx) + dx, y = Math.round(cy) - dy
        if (x < 0 || x >= W || y < 0 || y >= H) continue
        const a = (1 - dy / 30) * (0.18 + 0.3 * pulse) * (dx === 0 ? 1 : 0.45), i = (y * W + x) * 4
        px[i] += (bc[0]! - px[i]!) * a; px[i + 1] += (bc[1]! - px[i + 1]!) * a; px[i + 2] += (bc[2]! - px[i + 2]!) * a
      }
    }
    // light drizzle, catching the flashlight near Juan
    if (night && rain) for (const dp of DROPS) {
      dp.y = (dp.y + dp.v) % (H + 6)
      const x = Math.round((((dp.x - dp.y * 0.3) % W) + W) % W), y = Math.round(dp.y)
      const lit = Math.max(0, 1 - Math.hypot(x - jx, (y - jy) / SQ) / 70)
      for (let k = 0; k < 3; k++) {
        const i = (y - k) * W + x
        if (i < 0 || i >= W * H) continue
        px[i * 4] += 18 + lit * 70; px[i * 4 + 1] += 20 + lit * 64; px[i * 4 + 2] += 30 + lit * 50
      }
    }
    // landmark: Tutuban stays visible far off, whatever the fog
    const dq = LM.q - cq, dr = LM.r - cr, ang = Math.atan2(S3 * (dr + dq / 2), 1.5 * dq)
    const lx = Math.round(clamp(JX + Math.cos(ang) * 80, 14, W - 14)), ly = Math.round(clamp(JY + Math.sin(ang) * 140, 18, H - 30))
    if (TUT && hexDist(jq, jr, LM.q, LM.r) > 9) {
      const tint = night ? [26, 30, 54] : [118, 128, 124], k = night ? 0.72 : 0.6
      const ox = Math.round(lx - 24), oy = Math.round(clamp(ly, 19, H) - 15)
      for (let y = 0; y < 15; y++) for (let x = 0; x < 48; x++) {
        const j = (y * 48 + x) * 4
        if (!TUT[j + 3]) continue
        const sx = ox + x, sy = oy + y
        if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue
        const i = sy * W + sx
        px[i * 4] = TUT[j]! + (tint[0]! - TUT[j]!) * k
        px[i * 4 + 1] = TUT[j + 1]! + (tint[1]! - TUT[j + 1]!) * k
        px[i * 4 + 2] = TUT[j + 2]! + (tint[2]! - TUT[j + 2]!) * k
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  /** Advances the camera glide; call once per frame with the frame's dt in ms. */
  function tick(dt: number) {
    if (!walk) return
    walk.t = Math.min(1, walk.t + dt / walk.ms)
    const e = walk.t < 0.5 ? 2 * walk.t * walk.t : 1 - (-2 * walk.t + 2) ** 2 / 2
    cq = walk.fq + (walk.tq - walk.fq) * e
    cr = walk.fr + (walk.tr - walk.fr) * e
    if (walk.t >= 1) {
      cq = walk.tq
      cr = walk.tr
      const done = walk.done
      walk = null
      done()
    }
  }

  /** Glides the camera one hex (over `ms`, 760 a normal step); resolves when Juan is there. */
  function walkTo(fq: number, fr: number, tq: number, tr: number, ms = 760) {
    return new Promise<void>((done) => { walk = { fq, fr, tq, tr, t: 0, ms, done } })
  }

  /** Puts the camera straight on a hex (arrivals, teleports, coming back to the map). */
  function snap(q: number, r: number) {
    walk = null
    cq = q
    cr = r
  }

  return { draw, tick, walkTo, snap, pixelHex, walking: () => !!walk }
}
