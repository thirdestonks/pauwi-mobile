// Combat tuning. Every number the fight depends on lives in this one file so the fight
// can be balanced without reading the fight screen, and so the shelter meters and the
// combat screen can never disagree about what "Health" means.

// --- Enemy archetypes ------------------------------------------------------------------

export interface EnemyArchetype {
  id: string
  name: string
  /** Plural, used in the fight's opening line. */
  plural: string
  /** Base max HP for one of these. */
  hp: number
  /** Chance to connect, 0–1. */
  accuracy: number
  speed: number
  /**
   * Damage value → relative weight, rolled on every connecting hit. Per-type, so a future
   * Brute can swing 4–9 while a Shambler mostly does 1.
   */
  damageTable: [number, number][]
}

/**
 * The Shambler is the everyday dead; the Brute is the demo's one gatekeeper, standing
 * between Juan and the Tutuban platforms (see TileCard's depart). Adding another type
 * means an entry here and pointing an encounter pool at it — nothing in the fight
 * screen needs to change.
 */
export const ENEMY_TYPES: Record<string, EnemyArchetype> = {
  shambler: {
    id: 'shambler',
    name: 'Shambler',
    plural: 'Shamblers',
    hp: 32,
    accuracy: 0.7,
    speed: 3,
    // 1 is the common outcome and 5 is the tail that makes you flinch. A flat 6 made every
    // fight feel the same and made three enemies unsurvivable; a curve keeps 2–4 enemies
    // winnable while still leaving a hit worth worrying about.
    // Weights sum to 100: 70 / 11 / 8 / 6 / 5 → exactly 1.65 expected damage per connect.
    damageTable: [
      [1, 70],
      [2, 11],
      [3, 8],
      [4, 6],
      [5, 5],
    ],
  },

  // The gatekeeper. Construction-worker dead: slow, and it hits like a collapsing
  // scaffold. It only ever shows up once — the last door before the tracks — so it can
  // afford to be a real fight: about five good plank swings to drop, and a connecting
  // blow that makes Guard and the field bag matter again.
  brute: {
    id: 'brute',
    name: 'Brute',
    plural: 'Brutes',
    hp: 120,
    accuracy: 0.75,
    speed: 2,
    // Weights sum to 100: 20 / 35 / 30 / 15 → 4.4 expected damage per connect (the
    // Shambler's is 1.65). The 3s keep it from reading as a coin flip.
    damageTable: [
      [3, 20],
      [4, 35],
      [5, 30],
      [6, 15],
    ],
  },
}

export const DEFAULT_ENEMY_TYPE = 'shambler'

/**
 * What a zombie tile stores. The world owns *what* is waiting and how tough it rolled;
 * this file owns how it behaves. Keeping the two apart is what lets a future zone be
 * populated without touching combat.
 */
export interface EnemySpec {
  archetype: string
  hp: number
}

const ENCOUNTER_SIZE_WEIGHTS: [number, number][] = [
  [1, 0.3],
  [2, 0.45],
  [3, 0.25],
]

/** Rolls the encounter for a zombie tile. Pass a size to force one (used by the dev shortcut). */
export function rollEncounter(forcedSize?: number): EnemySpec[] {
  const size = forcedSize ?? pickWeighted(ENCOUNTER_SIZE_WEIGHTS)
  const type = ENEMY_TYPES[DEFAULT_ENEMY_TYPE]
  return Array.from({ length: size }, () => ({ archetype: type.id, hp: type.hp }))
}

export function rollEnemyDamage(table: [number, number][]): number {
  return pickWeighted(table)
}

// --- Weapons -------------------------------------------------------------------------

export interface WeaponSpec {
  id: string
  name: string
  icon: string
  damage: number
  /** Damage roll is `damage` ± this fraction. */
  variance: number
  /** 0–1, before the Shaken penalty. */
  accuracy: number
  /** Swings before it breaks. Infinity for something you can't break. */
  durability: number
}

export const WEAPONS: Record<string, WeaponSpec> = {
  'nailed-plank': {
    id: 'nailed-plank',
    name: 'Nailed Plank',
    icon: '🔨',
    damage: 26,
    variance: 0.2,
    accuracy: 0.78,
    durability: 8,
  },
  'bare-hands': {
    id: 'bare-hands',
    name: 'Bare Hands',
    icon: '✊',
    damage: 9,
    variance: 0.25,
    accuracy: 0.7,
    durability: Infinity,
  },
}

export const DEFAULT_WEAPON_ID = 'nailed-plank'

export interface ConsumableEffect {
  label: string
  heal?: number
  energy?: number
  hope?: number
  dreadRelief?: number
  /** Raises the Food meter (eating at the shelter). */
  food?: number
  /**
   * Healing over time: `amount` Health at the start of each of Juan's next `turns` turns in a
   * fight. Outside a fight (eating at the shelter) it all lands at once.
   */
  regen?: { amount: number; turns: number }
  /** Thrown in a fight: this much fire damage to every Shambler standing (the molotov). */
  fire?: number
}

export const CONSUMABLE_EFFECTS: Record<string, ConsumableEffect> = {
  medicine: { label: '+14 Health, then +8 a turn for 2', heal: 14, regen: { amount: 8, turns: 2 } },
  'canned-food': { label: '+12 Health · +10 Energy', heal: 12, energy: 10 },
  'instant-noodles': { label: '+10 Health · +8 Energy', heal: 10, energy: 8 },
  water: { label: '+4 Health · +6 Energy', heal: 4, energy: 6 },
  battery: { label: 'Torch on · −10 Dread · +4 Hope', hope: 4, dreadRelief: 10 },
  // --- found in the pixel map's scenes (.art/encounters) ---
  bandage: { label: '+12 Health, then +8 a turn for 2', heal: 12, regen: { amount: 8, turns: 2 } },
  gauze: { label: '+12 Health, then +8 a turn for 2', heal: 12, regen: { amount: 8, turns: 2 } },
  firstaid: { label: '+15 Health, then +8 a turn for 3', heal: 15, regen: { amount: 8, turns: 3 } },
  antibiotics: { label: '+10 Health, then +8 a turn for 2', heal: 10, regen: { amount: 8, turns: 2 } },
  painkillers: { label: '+12 Health, then +8 a turn for 2', heal: 12, regen: { amount: 8, turns: 2 } },
  alcohol: { label: '+10 Health', heal: 10 },
  vitamins: { label: '+10 Health · +2 Hope', heal: 10, hope: 2 },
  tuna: { label: '+20 Food', food: 20, heal: 10 },
  sardines: { label: '+25 Food', food: 25, heal: 10 },
  beef: { label: '+20 Food', food: 20, heal: 10 },
  rice: { label: '+25 Food', food: 25, heal: 10 },
  // --- made at the shelter (data/crafting.ts) ---
  hotmeal: { label: '+35 Food · +5 Hope', food: 35, hope: 5, heal: 5 },
  molotov: { label: '3 fire damage to every Shambler', fire: 3 },
  tuyo: { label: '+25 Food', food: 25, heal: 10 },
  eggs: { label: '+20 Food', food: 20, heal: 10 },
  crackers: { label: '+15 Food', food: 15, heal: 10 },
  coffee: { label: '+15 Energy · −3 Dread', energy: 15, dreadRelief: 3 },
  gin: { label: '−15 Dread · −10 Energy', dreadRelief: 15, energy: -10 },
}

/** Name + icon for every consumable id, kept in one place so screens and events agree. */
const ITEM_SPRITE = (file: string) => `/game/encounters/src/items/${file}.png`
export const CONSUMABLE_INFO: Record<string, { name: string; icon: string; sprite?: string }> = {
  medicine: { name: 'Medicine', icon: '💊', sprite: ITEM_SPRITE('meds') },
  'canned-food': { name: 'Canned Food', icon: '🥫', sprite: ITEM_SPRITE('beef') },
  'instant-noodles': { name: 'Instant Noodles', icon: '🍜', sprite: ITEM_SPRITE('noodles') },
  water: { name: 'Water', icon: '🧴', sprite: ITEM_SPRITE('water') },
  battery: { name: 'Battery', icon: '🔋', sprite: ITEM_SPRITE('batteries') },
  // --- found in the pixel map's scenes; the ids match .art's loot tables ---
  bandage: { name: 'Bandage', icon: '🩹', sprite: ITEM_SPRITE('bandage') },
  gauze: { name: 'Gauze', icon: '🩹', sprite: ITEM_SPRITE('gauze') },
  firstaid: { name: 'First-aid Kit', icon: '🧰', sprite: ITEM_SPRITE('firstaid') },
  antibiotics: { name: 'Antibiotics', icon: '💊', sprite: ITEM_SPRITE('antibiotics') },
  painkillers: { name: 'Painkillers', icon: '💊', sprite: ITEM_SPRITE('painkillers') },
  alcohol: { name: 'Rubbing Alcohol', icon: '🧴', sprite: ITEM_SPRITE('alcohol') },
  vitamins: { name: 'Vitamins', icon: '💊', sprite: ITEM_SPRITE('vitamins') },
  tuna: { name: 'Canned Tuna', icon: '🥫', sprite: ITEM_SPRITE('tuna') },
  sardines: { name: 'Sardines', icon: '🥫', sprite: ITEM_SPRITE('sardines') },
  beef: { name: 'Corned Beef', icon: '🥫', sprite: ITEM_SPRITE('beef') },
  rice: { name: 'Rice', icon: '🍚', sprite: ITEM_SPRITE('rice') },
  tuyo: { name: 'Dried Fish', icon: '🐟', sprite: ITEM_SPRITE('tuyo') },
  eggs: { name: 'Eggs', icon: '🥚', sprite: ITEM_SPRITE('eggs') },
  crackers: { name: 'Crackers', icon: '🍘', sprite: ITEM_SPRITE('crackers') },
  // tools and odds and ends: carried, not eaten
  matches: { name: 'Matches', icon: '🔥', sprite: ITEM_SPRITE('matches') },
  flares: { name: 'Road Flares', icon: '🧨', sprite: ITEM_SPRITE('flares') },
  straps: { name: 'Ratchet Straps', icon: '🪢', sprite: ITEM_SPRITE('straps') },
  jerrycan: { name: 'Jerry Can', icon: '⛽', sprite: ITEM_SPRITE('jerrycan') },
  butane: { name: 'Butane Canister', icon: '🔥', sprite: ITEM_SPRITE('butane') },
  kaldero: { name: 'Cooking Pot', icon: '🍲', sprite: ITEM_SPRITE('kaldero') },
  ammo: { name: 'Box of Ammo', icon: '📦', sprite: ITEM_SPRITE('ammo') },
  rounds: { name: 'Small Pack of Ammo', icon: '🔸', sprite: ITEM_SPRITE('rounds') },
  shells: { name: 'Shotgun Shells', icon: '🧨', sprite: ITEM_SPRITE('shells') },
  // trade goods: worth more at the suki's stall than anywhere else
  cigarettes: { name: 'Cigarettes', icon: '🚬', sprite: '/game/weight/out/cigarettes.png' },
  gold: { name: 'Gold Ring & Chain', icon: '💍', sprite: '/game/weight/out/gold.png' },
  'old-phone': { name: 'Cracked Phone', icon: '📱', sprite: '/game/weight/out/old-phone.png' },
  gin: { name: 'Bottle of Gin', icon: '🍶', sprite: '/game/weight/out/gin.png' },
  'copper-wire': { name: 'Copper Wire', icon: '🧶', sprite: '/game/weight/out/copper-wire.png' },
  coffee: { name: 'Coffee Sachets', icon: '☕', sprite: '/game/weight/out/coffee.png' },
  // made at the shelter
  hotmeal: { name: 'Hot Meal', icon: '🍲', sprite: ITEM_SPRITE('kaldero') },
  molotov: { name: 'Molotov', icon: '🔥', sprite: ITEM_SPRITE('alcohol') },
}

/** What the shelter's Eat sheet offers: the stash items that count as food. */
export const FOOD_IDS = ['canned-food', 'instant-noodles', 'water'] as const

// --- The pixel combat's rules (ported from .art/juan-hands; balance with .art/juan-hands/balance-sim.cjs) ---
// Damage per hit comes from EQUIPMENT[id].combat.dmg; melee falls off with distance, guns don't.
export const PIXEL_COMBAT = {
  /** CLOSE, MID, FAR multiplier on melee damage: reaching far is weak, so you let them come. */
  rowMult: [1, 0.6, 0.3] as const,
  /** HP, bite damage, and how often its attack misses Juan altogether. */
  shambler: { hp: 5, bite: 10, miss: 0.25 },
  brute: { hp: 16, bite: 20, miss: 0.15 },
  /** Inside a house: always exactly one Shambler, and a weaker one (a scare, not a battle). Dies in about two bat swings. */
  interior: { hp: 3, bite: 6, miss: 0.35 },
  /** Every hit rolls around the weapon's damage (dmg−1 … dmg+1, never below 1; fists always 1); a crit doubles it. */
  critChance: 0.1, critMult: 2,
  /** Dread climbs slowly (tuned way down): per hit taken, when one reaches CLOSE, per gunshot. Shaken at 60 misses a quarter of swings. */
  dreadHit: 4, dreadClose: 2, dreadShot: 1, shakenAt: 60, shakenMiss: 0.25,
  /** Item in combat: medicine +25, food +10 (from CONSUMABLE_EFFECTS.heal). Run: 35%, 60% with nothing at CLOSE. */
  runOdds: 0.35, runOddsClear: 0.6,
  /** The 9mm holds 18 rounds (the user's rule, November 2026). A small pack of ammo is 6 rounds, a box is 12: loaded into the gun from the
      Bag (or in a fight when it's empty), and whatever doesn't fit stays loose in Juan's pockets. */
  magazine: 18, ammoRounds: { ammo: 12, rounds: 6 } as Record<string, number>,
  /** Every gun: what its magazine holds and what reloads it (item id → how many it gives). The sumpak takes one shell; a box of shells is 4. */
  guns: {
    pistol: { mag: 18, packs: { rounds: 6, ammo: 12 } as Record<string, number>, word: 'rounds' },
    sumpak: { mag: 1, packs: { shells: 4 } as Record<string, number>, word: 'shells' },
  } as Record<string, { mag: number; packs: Record<string, number>; word: string }>,
  /** A spear's row multipliers: it reaches MID at full strength. */
  reachMult: [1, 1, 0.6] as const,
  /** Armor never takes more than this share off a hit, however much Juan wears: a bite always hurts. */
  armorCap: 0.5,
  /** Dread at the shelter: drains 8 a night, and 1 Hope is lost per 10 Dread each night. */
  dreadNightlyDrain: 8, dreadPerHopeLost: 10,
} as const

/** How much of a weapon's damage lands at a row: guns ignore distance, spears reach MID, everything else falls off. */
export function rowMultOf(c: { gun?: boolean; reach?: boolean } | undefined, row: number): number {
  if (c?.gun) return 1
  return (c?.reach ? PIXEL_COMBAT.reachMult : PIXEL_COMBAT.rowMult)[row] ?? 1
}

// --- Day/Night phase modifiers ----------------------------------------------------------

/** Multiplier on Juan's rolled damage. Day: he can see what he's swinging at. */
export const PHASE_PLAYER_DMG = { day: 1.2, night: 0.85 } as const
/** Subtracted from enemy accuracy. Daylight makes them sloppy. */
export const PHASE_ENEMY_ACC = { day: -0.1, night: 0 } as const
/** Night: everyone's blind. Applied to BOTH sides' accuracy. */
export const PHASE_BOTH_ACC_NIGHT = 0.15

// --- Juan ----------------------------------------------------------------------------

export const JUAN_ID = 'juan'
export const JUAN_SPEED = 5
export const JUAN_MAX_HEALTH = 100
export const JUAN_MAX_ENERGY = 100

// Dread is deliberately slow to build: it should pile up across a night rather than inside
// a single fight. At +2 a swing and +3 a hit taken, cracking Shaken takes roughly 30 swings
// or 20 hits, so a first fight barely registers and a fourth one does.
export const DREAD_ON_ATTACK = 2
export const DREAD_ON_HIT = 3
export const DREAD_RELIEF_ON_GUARD = 1
/** At or above this, Juan is Shaken — accuracy drops. */
export const SHAKEN_AT = 60
export const SHAKEN_ACCURACY_PENALTY = 0.25

export const GUARD_DAMAGE_MULTIPLIER = 0.5

export const RETREAT_BASE = 0.25
export const RETREAT_BONUS_PER_DEAD_ENEMY = 0.15
export const RETREAT_SHAKEN_PENALTY = 0.1
export const RETREAT_MIN = 0.05
export const RETREAT_MAX = 0.9
/**
 * Added to the free swing a failed retreat hands the enemy. Without it — now that enemy
 * damage is 1–5 — walking away would cost almost nothing and spamming Retreat would be the
 * correct play on every single turn.
 */
export const RETREAT_FAILURE_BONUS = 3

// --- Loot ----------------------------------------------------------------------------

// Victory spoils go into the field bag, never the shelter stash — you're still out there.
const LOOT_TABLE: { id: string; chance: number }[] = [
  { id: 'medicine', chance: 0.25 },
  { id: 'canned-food', chance: 0.45 },
  { id: 'water', chance: 0.4 },
  { id: 'instant-noodles', chance: 0.35 },
  { id: 'battery', chance: 0.2 },
  // The dead were people once — they're still carrying their work gear, and what was in their pockets.
  { id: 'hard-hat', chance: 0.08 },
  { id: 'steel-pipe', chance: 0.06 },
  { id: 'work-jeans', chance: 0.05 },
  { id: 'cigarettes', chance: 0.12 },
  { id: 'gold', chance: 0.04 },
  { id: 'old-phone', chance: 0.08 },
]

export function rollLoot(): string[] {
  return LOOT_TABLE.filter((entry) => Math.random() < entry.chance).map((entry) => entry.id)
}

/**
 * What turns up when you tear a place apart. Weighted toward the boring staples — the good
 * stuff is the reason to keep opening doors. One item per search, always something.
 */
const SEARCH_LOOT_TABLE: [string, number][] = [
  ['instant-noodles', 30],
  ['water', 25],
  ['canned-food', 22],
  ['battery', 13],
  ['medicine', 10],
  // Gear is the long shot — the reason to keep opening doors.
  ['work-boots', 5],
  ['hard-hat', 5],
  ['leather-jacket', 4],
  ['steel-pipe', 3],
  ['fire-axe', 1.5],
  ['scrap-vest', 1],
]

export function rollSearchLoot(): string {
  return pickWeighted(SEARCH_LOOT_TABLE)
}

// --- Timing --------------------------------------------------------------------------
// All beats are scheduled by the combat store, never by the screen, so a pending beat
// can't fire after the screen is gone.

/** One actor's turn in the queue. */
export const BEAT_STEP = 380
export const BEAT_WINDUP = 180
export const BEAT_IMPACT = 300
export const BEAT_DEATH = 520
/** Beat before the fight hands control back to the map. */
export const BEAT_OUTCOME = 900
/** The FAST FIGHTS setting: every beat this much shorter. */
export const FAST_BEATS = 0.55

// --- Helpers -------------------------------------------------------------------------

export function rollDamage(base: number, variance: number): number {
  const swing = base * variance
  return Math.max(1, Math.round(base - swing + Math.random() * swing * 2))
}

/** Clamps to a floor so an action is never literally impossible. */
export function accuracyWithPenalty(accuracy: number, penalty: number): number {
  return Math.max(0.05, Math.min(1, accuracy - penalty))
}

/** Weights don't need to sum to 1 (or 100) — they're normalised here. */
export function pickWeighted<T>(entries: [T, number][]): T {
  const roll = Math.random()
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let cumulative = 0
  for (const [value, weight] of entries) {
    cumulative += weight / total
    if (roll < cumulative) return value
  }
  return entries[entries.length - 1][0]
}
