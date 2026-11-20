// Tondo, generated per coordinate: ported from the hex-map preview (.art/hex-map/index.html).
// Nothing is pre-built. tile() and content() are pure functions of (q, r), so the same street
// always comes back the same way, and only the tiles Juan has touched are stored (board store).
// Keep this file in step with the preview: the map renderer, the board store and the
// encounter cards all read from it.

export type ShelterKey = 'nida' | 't10' | 'brgy' | 'mm'
export type ShopKind = 'botika' | 'kwik' | 'water' | 'kainan' | 'diner' | 'store'
export type RoofKind = 'rust' | 'tin' | 'tarp' | 'patch'
/** A house's street door: open (go in), locked (pry or kick it), boarded (not an entrance at all). */
export type HouseDoor = 'open' | 'locked' | 'boarded'
/** The painted room a house's fight happens in. */
export type HouseFloor = 'wood' | 'tile'

export interface TondoTile {
  type: 'road' | 'alley' | 'house' | 'landmark'
  q: number
  r: number
  /** Height of a house's walls in pixels (one to three floors); 0 on the ground. */
  h: number
  roof?: RoofKind
  wall?: string
  /** A painted ground floor: a shopfront or a shelter facing the street below it. */
  front?: ShopKind | ShelterKey
  /** Roughly one house in six has a door on its street side (never a shop or a shelter); the street tile in front of it must be free. */
  door?: HouseDoor
  floor?: HouseFloor
  tire?: boolean
  lamp?: boolean
  puddle?: boolean
  trash?: boolean
  plaza?: boolean
}

/** What a walkable tile holds. null: a house or Tutuban itself, which nobody walks onto. */
export type TondoContent =
  | 'shelter' | 'relocate' | 'shop' | 'tutuban' | 'house'
  | 'zombie' | 'loot' | 'car' | 'event' | 'nothing'
  /** A supply cache a radio broadcast pointed to (board store, never the generator). */
  | 'cache'

/** Tutuban: far to the north-east, about 50 hexes from Nida's. */
export const LM = { q: 14, r: -44 }

export const SHELTERS: Record<ShelterKey, { q: number; r: number; h: number; roof: RoofKind; name: string; desc: string; flavor: string }> = {
  nida: { q: 0, r: -1, h: 23, roof: 'rust', name: "Nida's Sari-Sari Store", desc: "Nida's store. Home.", flavor: '· OPEN 24 HRS · NO CREDIT ·' },
  t10: { q: 5, r: -8, h: 34, roof: 'tin', name: 'Tenement 10', desc: 'A stairwell behind a rusted gate. Dry, five floors up, and a door that locks. You could make this the new shelter.', flavor: '· FIVE FLOORS UP · DOOR LOCKS ·' },
  brgy: { q: 6, r: 3, h: 23, roof: 'tin', name: 'Barangay 43 Hall', desc: "The barangay hall's gate hangs open. A desk, a chair, a radio that might still reach someone, and walls the tanods once guarded. You could make this the new shelter.", flavor: '· SERBISYO PUBLIKO · BRGY 43 ·' },
  mm: { q: -5, r: -3, h: 28, roof: 'patch', name: "Mang Mel's Bike Shop", desc: "Mang Mel's shutter is half up. Tools on the wall, a bench to sleep on, and bicycles that could still carry you far. You could make this the new shelter.", flavor: '· VULCANIZING · BIKE PARTS ·' },
}
export const SHELTER_KEYS = Object.keys(SHELTERS) as ShelterKey[]
export const SHOPS: ShopKind[] = ['botika', 'kwik', 'water', 'kainan', 'diner', 'store']

// ---------- noise ----------
export function hash(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
export function vnoise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export const mod = (a: number, n: number) => ((a % n) + n) % n
export const hexDist = (q1: number, r1: number, q2: number, r2: number) =>
  (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2
/** Flat-top axial neighbours, in the same order as utils/hex.ts. */
export const NB: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
export const tkey = (q: number, r: number) => `${q},${r}`

export const frontOf = (k: ShelterKey): [number, number] => [SHELTERS[k].q, SHELTERS[k].r + 1]
const shelterAt = (q: number, r: number) => SHELTER_KEYS.find((k) => SHELTERS[k].q === q && SHELTERS[k].r === r)
/** The shelter whose door opens onto this tile, if any. */
export const shelterFrontAt = (q: number, r: number) =>
  SHELTER_KEYS.find((k) => SHELTERS[k].q === q && SHELTERS[k].r + 1 === r)

function baseHouse(q: number, r: number): boolean {
  const s = -q - r, road = mod(q, 5) === 0 || mod(s, 6) === 0
  return !road && hexDist(q, r, 0, 0) > 1 && vnoise(q * 0.45, r * 0.45, 3) > 0.38 && hash(q, r, 7) > 0.22
}

// tile() is called per hex per frame by the renderer: it's pure, so cache it.
const TILE_CACHE = new Map<string, TondoTile>()

export function tile(q: number, r: number): TondoTile {
  const k = tkey(q, r)
  const hit = TILE_CACHE.get(k)
  if (hit) return hit
  const t = buildTile(q, r)
  if (TILE_CACHE.size > 20000) TILE_CACHE.clear()
  TILE_CACHE.set(k, t)
  return t
}

function buildTile(q: number, r: number): TondoTile {
  const s = -q - r
  const road = mod(q, 5) === 0 || mod(s, 6) === 0
  const near = hexDist(q, r, 0, 0) <= 1
  const dl = hexDist(q, r, LM.q, LM.r)
  if (dl <= 1) return { type: 'landmark', q, r, h: 0 }                       // Tutuban itself (7 hexes)
  if (dl <= 3) return { type: 'alley', q, r, h: 0, plaza: true }             // its open plaza
  const sk = shelterAt(q, r)
  if (sk) return { type: 'house', q, r, h: SHELTERS[sk].h, roof: SHELTERS[sk].roof, wall: '#8a7f6e', front: sk }
  if (shelterFrontAt(q, r)) return { type: mod(q, 5) === 0 ? 'road' : 'alley', q, r, h: 0 }
  let type: TondoTile['type'] = 'alley'
  if (road) type = 'road'
  else if (!near && vnoise(q * 0.45, r * 0.45, 3) > 0.38 && hash(q, r, 7) > 0.22) type = 'house'
  const t: TondoTile = { type, q, r, h: 0 }
  if (type === 'house') {
    t.h = 16 + Math.floor(hash(q, r, 1) * 3) * 6                             // one to three floors
    if (hash(q, r, 40) > 0.86 && !baseHouse(q, r + 1) && !shelterFrontAt(q, r + 1)) {
      t.front = SHOPS[Math.floor(hash(q, r, 41) * SHOPS.length)]             // a shopfront facing the street
      t.h = Math.max(t.h, 22)
    }
    if (!t.front && hash(q, r, 70) > 0.6 && !baseHouse(q, r + 1) && !shelterFrontAt(q, r + 1)) {     // a door on the street side
      const d = hash(q, r, 71)
      t.door = d < 0.45 ? 'open' : d < 0.8 ? 'locked' : 'boarded'
      t.floor = hash(q, r, 72) < 0.5 ? 'wood' : 'tile'
    }
    const k = hash(q, r, 2)
    t.roof = k > 0.84 ? 'tarp' : k > 0.62 ? 'patch' : k > 0.3 ? 'rust' : 'tin'
    t.wall = ['#7b7a72', '#8a7f6e', '#6f7d86', '#86786f'][Math.floor(hash(q, r, 3) * 4)]
    t.tire = hash(q, r, 4) > 0.7
  }
  if (type === 'road' && hash(q, r, 5) > 0.93) t.lamp = true
  if (type === 'alley' && hash(q, r, 6) > 0.75) t.puddle = true
  if (type !== 'house' && hash(q, r, 8) > 0.85) t.trash = true
  return t
}

export const walkable = (q: number, r: number) => {
  const t = tile(q, r).type
  return t !== 'house' && t !== 'landmark'
}

/** The shop whose door opens onto this tile, if any. */
export function shopAt(q: number, r: number): ShopKind | null {
  const f = tile(q, r - 1).front
  return f && (SHOPS as string[]).includes(f) ? (f as ShopKind) : null
}

/** The house whose street door opens onto this tile, if it has one: how it is locked and what its room looks like. */
export function houseDoorAt(q: number, r: number): { state: HouseDoor; floor: HouseFloor } | null {
  const t = tile(q, r - 1)
  return t.type === 'house' && t.door ? { state: t.door, floor: t.floor ?? 'wood' } : null
}

/** What a house's door looks like to read and what stepping up to it says: [title, flavor]. */
export const HOUSE_DOOR_TEXT: Record<HouseDoor, [string, string]> = {
  open: ['A door left open', 'The door hangs off one hinge. It is dark inside, and the light is all Juan has. Going in costs no move, and the cupboards are worth a look.'],
  locked: ['A locked door', 'A real lock on a warped door. Somebody wanted to stay in, or to keep something in.'],
  boarded: ['Boarded up', 'Planks nailed across the frame. Nobody is getting in this way.'],
}

/**
 * What each walkable tile holds (rules: nothing / location / zombie / event). `home` is the
 * shelter Juan lives in now: its front is home ground, every other shelter's front offers
 * a move. A loot tile is an abandoned car about 40% of the time.
 */
export function content(q: number, r: number, home: ShelterKey): TondoContent | null {
  const fk = shelterFrontAt(q, r)
  if (fk) return fk === home ? 'shelter' : 'relocate'
  if (shopAt(q, r)) return 'shop'
  if (!walkable(q, r)) return null
  const door = houseDoorAt(q, r)
  if (door && door.state !== 'boarded') return 'house'                              // a house to go into: its card comes first
  if (hexDist(q, r, LM.q, LM.r) === 2) return 'tutuban'
  const k = hash(q, r, 20)
  if (k < 0.12) return 'zombie'
  if (k < 0.22) return hash(q, r, 60) > 0.6 ? 'car' : 'loot'
  return k < 0.29 ? 'event' : 'nothing'
}

/** 1 or 2 Shamblers on a zombie tile, fixed per tile. */
export const zombieCount = (q: number, r: number) => (hash(q, r, 21) > 0.6 ? 2 : 1)

// ---------- what's lying around: every search rolls 3 things from its table, Juan carries out one ----------

/** Preview item id → [name, what a tap shows, what taking it gets him]. */
export const ITEM: Record<string, [string, string, string]> = {
  sledge: ['Sledgehammer', 'Hits like a truck, but the handle is cracked.', "The sledgehammer. One or two swings drop anything, but it won't last long."],
  pipe: ['Lead pipe', "Heavy, and it won't snap.", 'A length of lead pipe. A solid weapon that wears down slowly.'],
  flares: ['Road flares', 'Three of them, still sealed.', 'Three road flares. Light one at night and the dark pulls back, and the Shamblers with it.'],
  straps: ['Ratchet straps', 'Good for lashing a door shut.', 'Two ratchet straps. Lashed across the shelter door, they hold.'],
  firstaid: ['First-aid kit', 'A car kit, never opened.', 'A first-aid kit: bandages and antiseptic.'],
  jerrycan: ['Jerry can', 'Half full. It sloshes.', 'A jerry can of petrol. Somebody, somewhere, will trade a lot for this.'],
  water: ['Bottled water', 'Two sealed bottles.', 'Sealed bottled water.'],
  butane: ['Butane canister', 'Full, for a camp stove.', "A full canister for the shelter's little stove."],
  beef: ['Corned beef', 'A can somebody left behind, unopened.', 'A can of corned beef.'],
  rice: ['Rice', 'A small sack, dry inside.', 'A sack of rice, enough for days.'],
  sardines: ['Sardines', 'Two cans in tomato sauce.', 'Cans of sardines in tomato sauce.'],
  meds: ['Paracetamol', 'A strip, half full.', 'A strip of paracetamol.'],
  batteries: ['Batteries', 'A four-pack of D cells.', 'A four-pack of D batteries. The flashlight stays strong all night.'],
  pistol: ['9mm pistol', "Somebody's sidearm, left in the car. The magazine is empty.", "A 9mm pistol. It hits hard at any distance, but every shot needs a round, and it's loud."],
  ammo: ['Box of ammo', 'A battered box of rounds, still heavy.', 'A box of 9mm ammo: 12 rounds. Load it into the 9mm from the Bag; it holds 18.'],
  rounds: ['Small pack of ammo', 'A little paper pack of brass rounds.', 'A small pack of 9mm ammo: 6 rounds. Load it into the 9mm from the Bag.'],
  itak: ['Itak', "A farmer's machete, the edge still keen.", 'The itak. It cuts deep (3 a swing) but dulls after about 8.'],
  arnis: ['Arnis stick', 'A rattan fighting stick, light and quick.', 'An arnis stick. It hits light (2 a swing) but lasts a long time, about 16 swings.'],
  bandage: ['Bandage', 'A clean roll, still wrapped.', 'A roll of bandage.'],
  gauze: ['Gauze', 'A roll of gauze for dressing a wound.', 'A roll of gauze.'],
  antibiotics: ['Antibiotics', 'A box nobody thought to take.', "A strip of antibiotics, for an infection that won't quit."],
  alcohol: ['Rubbing alcohol', 'Half a bottle. It still stings the nose.', 'A bottle of rubbing alcohol. Cleans a wound, and burns well.'],
  vitamins: ['Vitamins', 'A bottle, rattling.', 'A bottle of vitamins.'],
  painkillers: ['Painkillers', 'A bottle of ibuprofen, half full.', 'A bottle of painkillers.'],
  noodles: ['Instant noodles', 'A pack, crushed but sealed.', 'A pack of instant noodles.'],
  tuna: ['Canned tuna', 'One can, no dents.', 'A can of tuna.'],
  crackers: ['Crackers', 'A pack of crackers, still crisp.', 'A pack of crackers, light to carry.'],
  matches: ['Matches', 'A full box, dry.', 'A box of matches. Fire for the stove, the lamp, or a signal.'],
  tuyo: ['Dried fish', 'A pack of tuyo. It keeps forever.', "A pack of dried fish. It won't spoil."],
  kaldero: ['Cooking pot', 'A dented kaldero with a lid.', 'A cooking pot. Rice goes further at the shelter.'],
  knife: ['Kitchen knife', "Sharp, and the handle's sound.", 'A kitchen knife. Not much of a weapon, but it never breaks.'],
  eggs: ['Eggs', 'A tray, most of them whole.', "A tray of eggs. They won't keep."],
  crowbar: ['Crowbar', 'Cold steel with a hooked head. It will open most things people locked.', 'A crowbar. Pries a locked door open, quietly, and swings like a pipe.'],
  rebar: ['Rebar', 'A length of ribbed steel, taped at one end.', 'A length of rebar. It hits like the pipe and takes about 22 swings to wear out.'],
  hammer: ['Claw hammer', 'A carpenter left it. The head is sound.', 'A claw hammer. A good hit knocks a Shambler back a row.'],
  sumpak: ['Sumpak', 'Two pipes, a nail, rubber and tape. Somebody built this.', 'A sumpak. One shell, and it hits everything in the lane.'],
  shells: ['Shotgun shells', 'Four red shells in a soft box.', 'A box of four shotgun shells, for a sumpak.'],
  'moto-helmet': ['Motorcycle helmet', 'Scuffed red shell, the visor still clear.', 'A motorcycle helmet: 2 armor, and it holds up.'],
  'rain-boots': ['Rubber boots', 'Tall black rubber, a little cracked.', 'Rubber boots: 1 armor on the feet.'],
  cigarettes: ['Cigarettes', 'Half a pack, still dry.', 'A pack of cigarettes. Aling Cora pays well for these.'],
  'copper-wire': ['Copper wire', 'A coil stripped out of a wall.', 'A coil of copper wire. Worth trading, or patching armor at the shelter.'],
  coffee: ['Coffee sachets', 'A bundle of 3-in-1 packets.', 'Coffee sachets: Energy now, or something to trade.'],
  gin: ['Gin', 'A square bottle, the seal unbroken.', 'A bottle of gin. It drowns Dread for a while. The trader likes it too.'],
}

/** Preview ids that are named differently in the app's item catalogue. */
const APP_ID: Record<string, string> = { pipe: 'steel-pipe', meds: 'medicine', batteries: 'battery', noodles: 'instant-noodles' }
export const appItemId = (id: string) => APP_ID[id] ?? id
/** The other way: the walkable house page's name for an app item. */
export const pageItemId = (id: string) => Object.keys(APP_ID).find((k) => APP_ID[k] === id) ?? id

export type LootKind = 'trunk' | 'diner' | 'store' | 'botika' | 'kwik' | 'kainan'
export const LOOT: Record<LootKind, string[]> = {
  trunk: ['pistol', 'ammo', 'rounds', 'sledge', 'pipe', 'itak', 'arnis', 'flares', 'straps', 'firstaid', 'jerrycan', 'water', 'crowbar',
    'rebar', 'hammer', 'shells', 'moto-helmet', 'rain-boots', 'copper-wire', 'sumpak'],
  diner: ['water', 'butane', 'beef', 'rice', 'gin', 'coffee'],
  store: ['sardines', 'meds', 'batteries', 'water', 'firstaid', 'hammer', 'coffee'],
  botika: ['bandage', 'gauze', 'antibiotics', 'alcohol', 'vitamins', 'painkillers'],
  kwik: ['noodles', 'tuna', 'crackers', 'matches', 'sardines', 'cigarettes', 'coffee'],
  kainan: ['tuyo', 'kaldero', 'knife', 'itak', 'eggs', 'rice', 'gin'],
}
/** Long shots: only in the running this share of the time (the sumpak turns up in about one trunk in twenty). */
const RARE_LOOT: Record<string, number> = { sumpak: 0.3 }
export const rollLoot = (kind: LootKind) => LOOT[kind].filter((id) => Math.random() < (RARE_LOOT[id] ?? 1)).sort(() => Math.random() - 0.5).slice(0, 3)

/**
 * The inside of a house with a door: which walkable layout (the tenement flat, or the storeroom behind a shuttered shop) and its seed.
 * Fixed per house, so the same house is always the same rooms. What is in the cupboards comes from that layout
 * (public/game/house-interior), hidden until Juan searches them.
 */
export function houseLayout(q: number, r: number): { seed: number; tpl: 'flat' | 'stock' } {
  return { seed: 1 + Math.floor(hash(q, r, 90) * 9000), tpl: hash(q, r, 91) < 0.25 ? 'stock' : 'flat' }
}

/** Walk-in shops: a card out front, then in through the door to pick one thing. */
export const PICK_SHOPS: Partial<Record<ShopKind, [string, string]>> = {
  botika: ['Botika', 'The grille is pried open and the glass counter is cracked. Most of the shelves are bare, but not all.'],
  kwik: ['Kwik Mart 24', 'Glass crunches underfoot. The shelves are on the floor and the freezer lid is up. The last tube still flickers.'],
  kainan: ['Kainan', 'Pots on the counter, stools upturned, a candle burned almost down. Somebody was here not long ago.'],
  diner: ["Rosa's Tapsihan", 'A 24-hour tapsilogan, lights still on for nobody. The booths are empty, the grill is cold, and the door chime still rings.'],
  store: ['Mabuhay Mart 24', 'Every shelf picked over except the back one. A single tube still hums over the aisle.'],
}
/** The water refilling station has no interior yet: a card and one sealed gallon. */
export const WATER_SHOP = ['Water Refilling', 'Stacked gallons, most cracked. One is still sealed, sloshing and clean.'] as const

export type DoorName = 'kainan' | 'gate' | 'botika' | 'kwik' | 'glass' | 'nida' | 'trunk'
export const DOOR_OF: Partial<Record<ShopKind, DoorName>> = { kwik: 'kwik', store: 'kwik', diner: 'glass', botika: 'botika', kainan: 'kainan' }
export const SHELTER_DOOR: Record<ShelterKey, DoorName> = { nida: 'nida', t10: 'gate', brgy: 'gate', mm: 'botika' }

/** What taking a thing sounds like. ('bandage' is the sound of USING one: it waits for Use Item.) */
export const pickupSound = (id: string) =>
  id === 'pistol' ? 'pistol-cock' : id === 'sumpak' ? 'gun-equip'
    : ['sledge', 'pipe', 'knife', 'itak', 'arnis', 'crowbar', 'rebar', 'hammer', 'balisong', 'sibat'].includes(id) ? 'equip-sound'
      : ['bandage', 'gauze', 'firstaid', 'antibiotics', 'meds', 'painkillers', 'noodles', 'crackers', 'matches', 'tuyo'].includes(id) ? 'paper-grab'
        : 'item-pickup'
