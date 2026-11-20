// The map's encounter layer, ported from the hex-map preview: a full-screen interior page
// (public/game/encounters, an iframe steered by postMessage) behind the tile card, and the
// Resident Evil door transition that plays when Juan goes through a door. Module-level state:
// one map, one scene. EncounterLayer.vue renders it; TileCard drives it.
import { useSfx } from './useSfx'
import { useSettings } from './useSettings'
import type { DoorName } from '~/utils/tondo'
import type { Tile } from '~/stores/board'

export type SceneName =
  | 'backpack' | 'radio' | 'car' | 'trunk'
  | 'diner' | 'store' | 'botika' | 'kwik' | 'kainan'
  | 'nida' | 't10' | 'brgy' | 'mm'
  | 'suki'

/** Strips: 6 frames (closed → open) of 110×225 on black. The diner shares the glass door minus the bell. */
const DOORS: Record<DoorName, { strip: string; open: string | string[]; close: string }> = {
  nida: { strip: 'nida', open: 'door-open', close: 'door-close' },
  gate: { strip: 'gate', open: 'gate-latch-open', close: 'grill-mesh-close' },
  botika: { strip: 'botika', open: ['sliding-lock-open', 'sliding-door'], close: 'grill-mesh-close' },
  kainan: { strip: 'kainan', open: 'door-open', close: 'door-close' },
  kwik: { strip: 'kwik', open: 'store-convenience-glassdoor-open-withBell', close: 'door-close' },
  glass: { strip: 'kwik', open: 'store-convenience-glassdoor-open', close: 'door-close' },
  trunk: { strip: 'trunk', open: 'trunk-open-close', close: 'trunk-open-close' },
}

/** Messages back from the scene page: Juan hovered, tapped, or tapped again (take) a thing. */
export interface SceneTap { hover?: string | null; pick?: string; take?: string }

const src = ref('')
const scene = ref<SceneName | null>(null)
/** The door overlay: visible, its opacity, and the frame to draw (-1 is plain black). */
const door = reactive({ shown: false, opacity: 0, frame: -1, zoom: 1, dy: 0, strip: '' })
let frameWindow: Window | null = null
let onTap: ((m: SceneTap) => void) | null = null
/** The door Juan came in through: it closes behind him on the way out. */
let doorIn: DoorName | null = null
/** A car whose alarm Juan chose to fight: once he's back on the map, a win opens its trunk. */
const pendingTrunk = shallowRef<Tile | null>(null)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function show(name: SceneName, live = false, items?: string[]) {
  scene.value = name
  src.value = `/game/encounters/index.html?embed&scene=${name}${live ? '&live' : ''}${items ? '&items=' + items.join(',') : ''}`
}
function msg(m: Record<string, unknown>) {
  frameWindow?.postMessage(m, '*')
}
function hideNow() {
  doorIn = null
  scene.value = null
  src.value = ''
  onTap = null
}

async function playDoor(name: DoorName, closing: boolean, onBlack?: () => void) {
  const sfx = useSfx()
  const d = DOORS[name]
  door.strip = `/game/hex-map/src/door-${d.strip}.png`
  door.frame = -1; door.zoom = 1; door.dy = 0
  door.shown = true
  await wait(20)
  door.opacity = 1
  await wait(280)
  onBlack?.()
  if (!closing) {
    // Juan walks up to it: footsteps, the door growing as he nears, a bob per step.
    sfx.play('juan-step-before-door-open', 0.9)
    const t0 = performance.now()
    await new Promise<void>((res) => {
      const st = () => {
        const q = Math.min(1, (performance.now() - t0) / 1100)
        door.frame = 0
        door.zoom = 0.76 + 0.24 * (1 - (1 - q) ** 2)
        door.dy = Math.round(Math.abs(Math.sin(q * Math.PI * 3)) * 2 * (1 - q))
        if (q < 1) requestAnimationFrame(st)
        else res()
      }
      st()
    })
  }
  door.zoom = 1; door.dy = 0
  const order = closing ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5]
  const beat = closing ? [150, 110, 110, 110, 110, 220] : [200, 230, 230, 230, 230, 520]   // a beat on the closed door, a held beat once open
  const snd = ([] as string[]).concat(closing ? d.close : d.open)
  sfx.play(snd[0]!)
  useSettings().buzz(closing ? 50 : 25)
  for (let k = 0; k < 6; k++) {
    if (k === 1 && snd[1]) sfx.play(snd[1])
    door.frame = order[k]!
    await wait(beat[k]!)
  }
  door.frame = -1
  await wait(180)
}
async function fadeDoorOut() {
  door.opacity = 0
  await wait(280)
  door.shown = false
}

/** Through a door into a scene: everything behind the black is swapped while you can't see it. */
async function enterDoor(name: DoorName, onBlack: () => void) {
  await playDoor(name, false, onBlack)
  doorIn = name
  await wait(150)
  await fadeDoorOut()
}

/** A one-way door between screens (home through the shelter's door, out again): no scene to come back to. */
async function passDoor(name: DoorName, closing: boolean, onBlack: () => void) {
  // Another door is still on screen (a shop door closing behind Juan, say): let it finish, then play this one, rather than
  // skipping straight past it, which is how the shelter door could vanish on the way home. Only skip if it never clears.
  for (let t = 0; door.shown && t < 40; t++) await wait(100)
  if (door.shown) return onBlack()
  await playDoor(name, closing, onBlack)
  await wait(150)
  await fadeDoorOut()
}

/** Leave the scene; if Juan came in through a door, it closes behind him. */
async function leave() {
  if (!doorIn) return hideNow()
  const name = doorIn
  doorIn = null
  await playDoor(name, true)
  hideNow()
  await fadeDoorOut()
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    const m = e.data
    if (!m || m.pauwi !== 'scene' || !onTap) return
    onTap(m)
  })
}

export function useEncounterScene() {
  return {
    src, scene, door, pendingTrunk,
    show, msg, leave, hideNow, enterDoor, passDoor,
    /** Who hears taps on the scene's things (null: nobody — the scene is just backdrop). */
    listen(fn: ((m: SceneTap) => void) | null) { onTap = fn },
    attach(w: Window | null) { frameWindow = w },
    /** Shelter or shop interior is up, or a door is playing: the map shouldn't take taps. */
    busy: computed(() => !!scene.value || door.shown),
  }
}
