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
  /** Flat damage subtracted from every enemy hit that connects. */
  armor?: number
  /** Weapons only: the roll stats combat uses. */
  weapon?: { damage: number; variance: number; accuracy: number }
  /** Swings before it breaks. Absent = not a weapon. */
  durability?: number
  /** Search-table long shot. */
  rare?: boolean
}

export const EQUIPMENT: Record<string, EquipmentSpec> = {
  'hard-hat': {
    id: 'hard-hat',
    name: 'Hard Hat',
    icon: '⛑️',
    slots: ['head'],
    armor: 1,
  },
  'leather-jacket': {
    id: 'leather-jacket',
    name: 'Leather Jacket',
    icon: '🧥',
    slots: ['body'],
    armor: 1,
  },
  'scrap-vest': {
    id: 'scrap-vest',
    name: 'Scrap Vest',
    icon: '🛡️',
    slots: ['body'],
    armor: 2,
    rare: true,
  },
  'work-boots': {
    id: 'work-boots',
    name: 'Work Boots',
    icon: '🥾',
    slots: ['feet'],
    armor: 1,
  },
  'steel-pipe': {
    id: 'steel-pipe',
    name: 'Steel Pipe',
    icon: '🔩',
    slots: ['handL', 'handR'],
    twoHanded: true,
    weapon: { damage: 18, variance: 0.2, accuracy: 0.8 },
    durability: 12,
  },
  'nailed-plank': {
    id: 'nailed-plank',
    name: 'Nailed Plank',
    icon: '🔨',
    slots: ['handL', 'handR'],
    twoHanded: true,
    weapon: { damage: 26, variance: 0.2, accuracy: 0.78 },
    durability: 8,
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
  },
}

/** Name + icon for any item id — equipment or consumable. Unknown ids fall through. */
export function itemInfo(id: string): { name: string; icon: string } | null {
  const eq = EQUIPMENT[id]
  if (eq) return { name: eq.name, icon: eq.icon }
  return CONSUMABLE_INFO[id] ?? null
}
