import { defineStore } from 'pinia'
import {
  CONSUMABLE_EFFECTS,
  DREAD_TO_HOPE_DIVISOR,
  JUAN_MAX_ENERGY,
  JUAN_MAX_HEALTH,
  SHAKEN_AT,
} from '~/data/combat'
import { EQUIPMENT, EQUIP_SLOTS, type EquipSlot, type EquipmentSpec } from '~/data/equipment'

// The run's source of truth. Before this existed, Juan's Health was a hardcoded 72 inside
// ShelterScreen and combat kept its own private copy — which is why nothing could ever
// carry between a fight and the shelter, and why death had nowhere to happen.
const STARTING = {
  health: 72,
  energy: 40,
  food: 55,
  hope: 34,
}

// Shelter recovery. Sleep is the night skip (the board flips the phase, this spends the
// food and does the recovering). Eating is player's choice of food from the stash —
// ShelterScreen lists what's eatable and calls applyConsumable with the pick.
export const SLEEP_FOOD_COST = 1
export const SLEEP_HEALTH = 8
export const SLEEP_STARVING_ENERGY = 50

/** Resolved weapon stats — what combat actually swings with. */
export interface WeaponStats {
  id: string
  name: string
  icon: string
  damage: number
  variance: number
  accuracy: number
  durability: number
}

const BARE_HANDS: WeaponStats = {
  id: 'bare-hands',
  name: 'Bare Hands',
  icon: '✅',
  damage: 9,
  variance: 0.25,
  accuracy: 0.7,
  durability: Infinity,
}

const STARTING_WEAPON_ID = 'nailed-plank'

const STARTING_EQUIPPED: Record<EquipSlot, string | null> = {
  head: null,
  shoulderL: null,
  shoulderR: null,
  handL: STARTING_WEAPON_ID,
  handR: STARTING_WEAPON_ID,
  legs: null,
  feet: null,
  body: null,
}

export const usePlayerStore = defineStore('player', () => {
  const name = ref('Juan')

  const health = ref(STARTING.health)
  const energy = ref(STARTING.energy)
  const food = ref(STARTING.food)
  const hope = ref(STARTING.hope)

  // Dread is the combat-bred meter, deliberately separate from Hope (per CLAUDE.md).
  // It survives the fight and settles into Hope back at the shelter.
  const dread = ref(0)
  /** Hope lost to the last fight's Dread — surfaced on the shelter screen. */
  const lastDreadPenalty = ref(0)

  // --- Equipment -------------------------------------------------------------------------
  // One equipped item per slot. Two-handed weapons occupy handL AND handR. Whatever Juan
  // is wearing travels with HIM — not with the stash — so it survives a shelter swap.
  const equipped = ref<Record<EquipSlot, string | null>>({
    head: null,
    shoulderL: null,
    shoulderR: null,
    handL: STARTING_WEAPON_ID,
    handR: STARTING_WEAPON_ID, // the plank is two-handed: both hands hold it
    legs: null,
    feet: null,
    body: null,
  })

  // Durability per weapon id, so swapping between two worn weapons doesn't reset swings.
  const durability = ref<Record<string, number>>({
    [STARTING_WEAPON_ID]: EQUIPMENT[STARTING_WEAPON_ID].durability ?? 1,
  })

  /** Set the moment Health hits 0. The run is over until it's restarted. */
  const dead = ref(false)

  // --- Derived ---------------------------------------------------------------------------
  const equippedItems = computed(() =>
    EQUIP_SLOTS.map((slot) => ({ slot, id: equipped.value[slot] })).filter(
      (entry): entry is { slot: EquipSlot; id: string } => entry.id !== null,
    ),
  )

  /** The active weapon: hands first, bare hands if they're empty. */
  const weapon = computed<WeaponStats>(() => {
    const handId = equipped.value.handL ?? equipped.value.handR
    if (!handId) return BARE_HANDS
    const spec = EQUIPMENT[handId]
    if (!spec?.weapon) return BARE_HANDS
    return {
      id: spec.id,
      name: spec.name,
      icon: spec.icon,
      damage: spec.weapon.damage,
      variance: spec.weapon.variance,
      accuracy: spec.weapon.accuracy,
      durability: spec.durability ?? Infinity,
    }
  })

  const weaponDurability = computed(() => durability.value[weapon.value.id] ?? weapon.value.durability)
  const unbreakable = computed(() => !Number.isFinite(weaponDurability.value))
  /** Flat damage subtracted from every enemy hit that connects. */
  const armorTotal = computed(() =>
    equippedItems.value.reduce((sum, { id }) => sum + (EQUIPMENT[id]?.armor ?? 0), 0),
  )

  const shaken = computed(() => dread.value >= SHAKEN_AT)

  // --- Actions ---------------------------------------------------------------------------

  /**
   * Applies a consumable's effects. Used by the shelter Eat sheet (after the stash
   * quantity is spent) and available anywhere else an item gets consumed.
   */
  function applyConsumable(id: string) {
    const effect = CONSUMABLE_EFFECTS[id]
    if (!effect) return
    if (effect.heal) heal(effect.heal)
    if (effect.energy) restoreEnergy(effect.energy)
    if (effect.hope) raiseHope(effect.hope)
    if (effect.dreadRelief) relieveDread(effect.dreadRelief)
  }

  /**
   * Sleeping through the night. Fed: full recovery. Starving: a bad night's rest —
   * half energy, no healing. The board's phase flip happens separately (ShelterScreen
   * calls sleepThroughToMorning when sleep succeeds).
   */
  function sleep(): boolean {
    const fed = food.value >= SLEEP_FOOD_COST
    if (fed) {
      food.value -= SLEEP_FOOD_COST
      energy.value = JUAN_MAX_ENERGY
      health.value = Math.min(JUAN_MAX_HEALTH, health.value + SLEEP_HEALTH)
    } else {
      energy.value = SLEEP_STARVING_ENERGY
    }
    return fed
  }

  /** Returns true when this blow ended the run. */
  function applyDamage(amount: number): boolean {
    if (amount <= 0 || dead.value) return dead.value
    health.value = Math.max(0, health.value - amount)
    if (health.value <= 0) dead.value = true
    return dead.value
  }

  function heal(amount: number) {
    health.value = Math.min(JUAN_MAX_HEALTH, health.value + amount)
  }

  function restoreEnergy(amount: number) {
    energy.value = Math.min(JUAN_MAX_ENERGY, Math.max(0, energy.value + amount))
  }

  function raiseHope(amount: number) {
    hope.value = Math.min(100, Math.max(0, hope.value + amount))
  }

  function raiseDread(amount: number) {
    dread.value = Math.min(100, dread.value + amount)
  }

  function relieveDread(amount: number) {
    dread.value = Math.max(0, dread.value - amount)
  }

  // --- Equipping -------------------------------------------------------------------------
  // Bag side is handled by the caller (inventory store): equipFromBag moves the piece out
  // of the bag and into its slot, whatever was there before lands back in the bag.

  function slotsFor(id: string): EquipSlot[] {
    return EQUIPMENT[id]?.slots ?? []
  }

  /** Piece currently occupying the same slot family (e.g. the other half of a 2H grip). */
  function wornIn(slot: EquipSlot): string | null {
    return equipped.value[slot]
  }

  /**
   * Wears `id` (which must already be out of the bag — inventory.equipItem coordinates).
   * Returns everything that got displaced, so the caller can move those pieces back.
   */
  function equip(id: string): EquipSlot[] {
    const spec = EQUIPMENT[id]
    if (!spec) return []

    const displaced: EquipSlot[] = []
    const occupied = new Set<EquipSlot>()
    for (const slot of spec.slots) {
      const current = equipped.value[slot]
      if (current) displaced.push(slot)
      occupied.add(slot)
    }
    // Two-handers also evict whatever a one-hander left in the other mitt.
    for (const slot of EQUIP_SLOTS) {
      if (occupied.has(slot)) continue
      const current = equipped.value[slot]
      if (current && EQUIPMENT[current]?.slots.includes(slot)) {
        // Another item (e.g. a one-hander in the opposite hand) is displaced too.
        displaced.push(slot)
        occupied.add(slot)
      }
    }

    // Clear everything this piece touches, then seat it.
    for (const slot of displaced) {
      const current = equipped.value[slot]
      if (current && EQUIPMENT[current]?.slots.length) {
        for (const s of EQUIPMENT[current].slots) equipped.value[s] = null
      }
      equipped.value[slot] = null
    }
    for (const slot of spec.slots) equipped.value[slot] = id

    if (spec.durability !== undefined && durability.value[id] === undefined) {
      durability.value[id] = spec.durability
    }
    return displaced
  }

  /** Takes the piece in `slot` off. Returns its id, or null when the slot was empty. */
  function unequip(slot: EquipSlot): string | null {
    const id = equipped.value[slot]
    if (!id) return null
    for (const s of slotsFor(id)) equipped.value[s] = null
    return id
  }

  /**
   * Spends one swing of the ACTIVE weapon. Returns true when that swing was the last one
   * it had. Unbreakable weapons (bare hands) never return true.
   */
  function spendDurability(): boolean {
    const id = weapon.value.id
    if (!Number.isFinite(weapon.value.durability)) return false
    const left = Math.max(0, (durability.value[id] ?? weapon.value.durability) - 1)
    durability.value[id] = left
    return left === 0
  }

  /** Weapon broke mid-fight: hands come out empty (bare hands are the fallback). */
  function breakWeapon() {
    const id = weapon.value.id
    for (const s of slotsFor(id)) equipped.value[s] = null
  }

  /**
   * Called when the player reaches the shelter at the end of an outing. A bad fight
   * follows you home: carried Dread is taken out of Hope, then the night clears it.
   * Returns the Hope actually lost.
   */
  function settleDreadAtShelter(): number {
    const penalty = Math.floor(dread.value / DREAD_TO_HOPE_DIVISOR)
    if (penalty > 0) hope.value = Math.max(0, hope.value - penalty)
    lastDreadPenalty.value = penalty
    dread.value = 0
    return penalty
  }

  function clearShelterReport() {
    lastDreadPenalty.value = 0
  }

  function resetRun() {
    health.value = STARTING.health
    energy.value = STARTING.energy
    food.value = STARTING.food
    hope.value = STARTING.hope
    dread.value = 0
    lastDreadPenalty.value = 0
    equipped.value = {
      head: null,
      shoulderL: null,
      shoulderR: null,
      handL: STARTING_WEAPON_ID,
      handR: STARTING_WEAPON_ID,
      legs: null,
      feet: null,
      body: null,
    }
    durability.value = { [STARTING_WEAPON_ID]: EQUIPMENT[STARTING_WEAPON_ID].durability ?? 1 }
    dead.value = false
  }

  // --- Save persistence -----------------------------------------------------------------
  // Meters plus what Juan is wearing — the equipped pieces travel with him, so a
  // shelter swap mid-run restores exactly. Durability comes along per weapon id so a
  // half-worn axe is still a half-worn axe after an app restart.
  function snapshot() {
    return {
      name: name.value,
      health: health.value,
      energy: energy.value,
      food: food.value,
      hope: hope.value,
      dread: dread.value,
      lastDreadPenalty: lastDreadPenalty.value,
      equipped: { ...equipped.value },
      durability: { ...durability.value },
      dead: dead.value,
    }
  }

  function hydrate(state: ReturnType<typeof snapshot>) {
    name.value = state.name
    health.value = state.health
    energy.value = state.energy
    food.value = state.food
    hope.value = state.hope
    dread.value = state.dread
    lastDreadPenalty.value = state.lastDreadPenalty
    equipped.value = { ...STARTING_EQUIPPED, ...state.equipped }
    durability.value = { ...state.durability }
    dead.value = false // the DeathScreen owns death; a save is never restored into it
  }

  return {
    name,
    health,
    energy,
    food,
    hope,
    dread,
    lastDreadPenalty,
    equipped,
    equippedItems,
    weapon,
    weaponDurability,
    unbreakable,
    armorTotal,
    shaken,
    applyDamage,
    applyConsumable,
    sleep,
    heal,
    restoreEnergy,
    raiseHope,
    raiseDread,
    relieveDread,
    wornIn,
    equip,
    unequip,
    spendDurability,
    breakWeapon,
    settleDreadAtShelter,
    clearShelterReport,
    resetRun,
    snapshot,
    hydrate,
  }
})
