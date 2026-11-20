// Equipment for Juan: armor pieces and hand weapons. Every equippable lives here so the
// PackScreen, the bag, and combat all read the same stats. Consumables aren't equipment —
// they're already in data/combat.ts — but itemInfo() merges both catalogs so any screen can
// name or icon ANY item id (a bag slot is just a string).
import { CONSUMABLE_INFO } from './combat'

export type EquipSlot =
  | 'head'
  | 'shoulderL'
  | 'shoulderR'
  | 'handL'
  | 'handR'
  | 'legs'
  | 'feet'
  | 'body'

export const EQUIP_SLOTS: EquipSlot[] = [
  'head',
  'shoulderL',
  'shoulderR',
  'handL',
  'handR',
  'legs',
  'feet',
  'body',
]

export const SLOT_LABELS: Record<EquipSlot, string> = {
  head: 'Head',
  shoulderL: 'L Shoulder',
  shoulderR: 'R Shoulder',
  handL: 'L Hand',
  handR: 'R Hand',
  legs: 'Legs',
  feet: 'Feet',
  body: 'Body',
}

export interface EquipmentSpec {
  id: string
  name: string
  icon: string
  /** Which slots this can occupy. Two-handed weapons list both hands. */
  slots: EquipSlot[]
  /** Occupies handL AND handR; whatever was in either gets displaced. */
  twoHanded?: boolean
  /** Flat damage subtracted from every enemy hit that connects (never more than half the hit: PIXEL_COMBAT.armorCap). */
  armor?: number
  /** Armor only: how many points of damage it can soak before it falls apart. Patched at the shelter. */
  condition?: number
  /** Weapons only: the roll stats combat uses. */
  weapon?: { damage: number; variance: number; accuracy: number }
  /** Swings before it breaks. Absent = not a weapon. */
  durability?: number
  /** Search-table long shot. */
  rare?: boolean
  /**
   * The pixel combat's numbers (the .art preview's rules): damage per hit at CLOSE (scaled down by row unless
   * it's a gun), and which first-person hand art draws it. Swings come from `durability`. The traits:
   * `reach` (a spear: full damage at MID too), `crit` (its own crit chance), `knock` (a hit shoves the Shambler back a row),
   * `lane` (a gun that hits every Shambler in the target's lane).
   */
  combat?: { dmg: number; hands: HandArt; gun?: boolean; reach?: boolean; crit?: number; knock?: boolean; lane?: boolean }
  /** Pixel sprite (public/game/...) for bag, gear and scene; the emoji `icon` is the fallback. */
  sprite?: string
  /** One line for the Gear and trader cards: what makes it different. */
  trait?: string
}

/** First-person hand animations that exist (public/game/juan-hands/out/<hands>-<anim>.png). */
export type HandArt = 'makeshift' | 'itak' | 'arnis' | 'pipe' | 'fist' | 'pistol'
const ITEMS = '/game/encounters/src/items/'
const UI = '/game/encounters/src/ui/'

export const EQUIPMENT: Record<string, EquipmentSpec> = {
  'hard-hat': {
    id: 'hard-hat',
    name: 'Hard Hat',
    sprite: '/game/weight/out/hard-hat.png',
    icon: '⛑️',
    slots: ['head'],
    armor: 1,
    condition: 10,
  },
  'leather-jacket': {
    id: 'leather-jacket',
    name: 'Leather Jacket',
    sprite: '/game/weight/out/leather-jacket.png',
    icon: '🧥',
    slots: ['body'],
    armor: 1,
    condition: 14,
  },
  'scrap-vest': {
    id: 'scrap-vest',
    name: 'Scrap Vest',
    sprite: '/game/weight/out/scrap-vest.png',
    icon: '🛡️',
    slots: ['body'],
    armor: 2,
    condition: 22,
    rare: true,
  },
  'work-boots': {
    id: 'work-boots',
    name: 'Work Boots',
    sprite: '/game/weight/out/work-boots.png',
    icon: '🥾',
    slots: ['feet'],
    armor: 1,
    condition: 14,
  },
  // --- more armor: found in wardrobes, lockers and trunks, or traded for at the suki's stall ---
  'moto-helmet': { id: 'moto-helmet', name: 'Motorcycle Helmet', icon: '🪖', slots: ['head'], armor: 2, condition: 16, trait: 'Takes a bite to the head and keeps going.', sprite: ITEMS + 'moto-helmet.png' },
  'rider-jacket': { id: 'rider-jacket', name: 'Rider Jacket', icon: '🧥', slots: ['body'], armor: 2, condition: 18, rare: true, trait: 'Padded shoulders and elbows. Teeth slide off it.', sprite: ITEMS + 'rider-jacket.png' },
  'denim-jacket': { id: 'denim-jacket', name: 'Denim Jacket', icon: '👕', slots: ['body'], armor: 1, condition: 10, sprite: ITEMS + 'denim-jacket.png' },
  'work-jeans': { id: 'work-jeans', name: 'Thick Jeans', icon: '👖', slots: ['legs'], armor: 1, condition: 10, sprite: ITEMS + 'work-jeans.png' },
  'rain-boots': { id: 'rain-boots', name: 'Rubber Boots', icon: '🥾', slots: ['feet'], armor: 1, condition: 8, sprite: ITEMS + 'rain-boots.png' },
  'elbow-pads': { id: 'elbow-pads', name: 'Knee & Elbow Pads', icon: '🦺', slots: ['shoulderL'], armor: 1, condition: 12, sprite: ITEMS + 'elbow-pads.png' },
  'steel-pipe': {
    id: 'steel-pipe',
    name: 'Lead Pipe',
    icon: '🔩',
    slots: ['handL', 'handR'],
    twoHanded: true,
    weapon: { damage: 18, variance: 0.2, accuracy: 0.8 },
    durability: 12,
    combat: { dmg: 3, hands: 'pipe' },
    sprite: ITEMS + 'pipe.png',
  },
  // Juan's starting weapon: the makeshift bat (a steel pipe, bandaged grip, a nailed plank for a head).
  'nailed-plank': {
    id: 'nailed-plank',
    name: 'Makeshift Bat',
    icon: '🔨',
    slots: ['handL', 'handR'],
    twoHanded: true,
    weapon: { damage: 26, variance: 0.2, accuracy: 0.78 },
    durability: 12,
    combat: { dmg: 2, hands: 'makeshift' },
    sprite: UI + 'w-makeshift.png',
  },
  'fire-axe': {
    id: 'fire-axe',
    name: 'Fire Axe',
    icon: '🪓',
    slots: ['handL', 'handR'],
    twoHanded: true,
    weapon: { damage: 34, variance: 0.25, accuracy: 0.72 },
    durability: 6,
    rare: true,
    combat: { dmg: 4, hands: 'itak' },
  },
  // --- the pixel combat's weapons (numbers from .art/juan-hands; swings = durability) ---
  itak: {
    id: 'itak', name: 'Itak', icon: '🔪', slots: ['handR'],
    weapon: { damage: 30, variance: 0.2, accuracy: 0.8 }, durability: 8,
    combat: { dmg: 3, hands: 'itak' }, sprite: UI + 'w-itak.png',
  },
  arnis: {
    id: 'arnis', name: 'Arnis Stick', icon: '🥢', slots: ['handR'],
    weapon: { damage: 20, variance: 0.2, accuracy: 0.85 }, durability: 16,
    combat: { dmg: 2, hands: 'arnis' }, sprite: UI + 'w-arnis.png',
  },
  sledge: {
    id: 'sledge', name: 'Sledgehammer', icon: '🔨', slots: ['handL', 'handR'], twoHanded: true,
    weapon: { damage: 40, variance: 0.25, accuracy: 0.7 }, durability: 6,
    combat: { dmg: 5, hands: 'pipe' }, sprite: ITEMS + 'sledge.png',
  },
  // never breaks: no durability
  knife: {
    id: 'knife', name: 'Kitchen Knife', icon: '🔪', slots: ['handR'],
    weapon: { damage: 18, variance: 0.2, accuracy: 0.85 },
    combat: { dmg: 2, hands: 'itak' }, sprite: ITEMS + 'knife.png',
  },
  // full damage at any row; spends rounds, not swings
  pistol: {
    id: 'pistol', name: '9mm Pistol', icon: '🔫', slots: ['handR'],
    weapon: { damage: 32, variance: 0.1, accuracy: 0.9 },
    combat: { dmg: 4, hands: 'pistol', gun: true }, sprite: ITEMS + 'pistol.png',
  },
  // --- new weapons, each with one trait (they borrow the existing hand art until their own is painted) ---
  sibat: {
    id: 'sibat', name: 'Bamboo Spear', icon: '🎋', slots: ['handL', 'handR'], twoHanded: true,
    weapon: { damage: 22, variance: 0.2, accuracy: 0.8 }, durability: 10,
    combat: { dmg: 2, hands: 'arnis', reach: true }, sprite: ITEMS + 'sibat.png', trait: 'Reach: full damage at MID, not just CLOSE.',
  },
  balisong: {
    id: 'balisong', name: 'Balisong', icon: '🗡️', slots: ['handR'],
    weapon: { damage: 16, variance: 0.2, accuracy: 0.9 },
    combat: { dmg: 2, hands: 'itak', crit: 0.25 }, sprite: ITEMS + 'balisong.png', trait: 'Never breaks. One stab in four is a crit.',
  },
  crowbar: {
    id: 'crowbar', name: 'Crowbar', icon: '🔧', slots: ['handR'],
    weapon: { damage: 24, variance: 0.2, accuracy: 0.8 }, durability: 14,
    combat: { dmg: 3, hands: 'pipe' }, sprite: ITEMS + 'crowbar.png', trait: 'Pries locked doors open, in the bag or in hand.',
  },
  rebar: {
    id: 'rebar', name: 'Rebar', icon: '🦯', slots: ['handL', 'handR'], twoHanded: true,
    weapon: { damage: 24, variance: 0.2, accuracy: 0.75 }, durability: 22,
    combat: { dmg: 3, hands: 'pipe' }, sprite: ITEMS + 'rebar.png', trait: 'Heavy steel. Takes about 22 swings to wear out.',
  },
  hammer: {
    id: 'hammer', name: 'Claw Hammer', icon: '🔨', slots: ['handR'],
    weapon: { damage: 18, variance: 0.2, accuracy: 0.85 }, durability: 14,
    combat: { dmg: 2, hands: 'makeshift', knock: true }, sprite: ITEMS + 'hammer.png', trait: 'A hit knocks the Shambler back a row.',
  },
  // one shell, and it hits every Shambler in the lane; reloading costs a turn
  sumpak: {
    id: 'sumpak', name: 'Sumpak', icon: '🔫', slots: ['handL', 'handR'], twoHanded: true, rare: true,
    weapon: { damage: 40, variance: 0.1, accuracy: 0.85 },
    combat: { dmg: 4, hands: 'pistol', gun: true, lane: true }, sprite: ITEMS + 'sumpak.png', trait: 'A homemade shotgun. One shell hits every Shambler in the lane.',
  },
}

/** Fists: what's left when a weapon breaks. Never breaks. */
export const FISTS = { id: 'fists', name: 'Fists', combat: { dmg: 1, hands: 'fist' as HandArt }, sprite: UI + 'w-fist.png' }

/** Name + icon for any item id — equipment or consumable. Unknown ids fall through. */
export function itemInfo(id: string): { name: string; icon: string; sprite?: string } | null {
  const eq = EQUIPMENT[id]
  if (eq) return { name: eq.name, icon: eq.icon, sprite: eq.sprite }
  return CONSUMABLE_INFO[id] ?? null
}
