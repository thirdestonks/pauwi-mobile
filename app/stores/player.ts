import { defineStore } from 'pinia'
import {
  CONSUMABLE_EFFECTS,
  JUAN_MAX_ENERGY,
  JUAN_MAX_HEALTH,
  PIXEL_COMBAT,
  SHAKEN_AT,
} from '~/data/combat'
import { useInventoryStore } from './inventory'
import { EQUIPMENT, EQUIP_SLOTS, FISTS, type EquipSlot, type EquipmentSpec, type HandArt } from '~/data/equipment'

// The run's source of truth. Before this existed, Juan's Health was a hardcoded 72 inside
// ShelterScreen and combat kept its own private copy — which is why nothing could ever
// carry between a fight and the shelter, and why death had nowhere to happen.
const STARTING = {
  health: 72,
  energy: 40,
  food: 55,
  hope: 34,
}

// Shelter recovery, the hex-map preview's numbers. Sleep is the night skip (the board flips
// the phase, this spends the food and does the recovering): Food −15, Energy +30, Health +5 —
// or, sleeping on less than 15 Food, Health −10 instead. Eating is the player's pick from the
// stash: ShelterScreen lists what's eatable and calls applyConsumable with it.
export const SLEEP_FOOD_COST = 15
export const SLEEP_ENERGY = 30
export const SLEEP_HEALTH = 5
export const SLEEP_HUNGRY_HEALTH = 10

/** Resolved weapon stats — what combat actually swings with. */
export interface WeaponStats {
  id: string
  name: string
  icon: string
  damage: number
  variance: number
  accuracy: number
  durability: number
  /** The pixel combat's stats: damage at CLOSE, the hand art, whether it's a gun, and its trait (reach, crit, knock, lane). */
  combat: NonNullable<EquipmentSpec['combat']>
  sprite?: string
}

const BARE_HANDS: WeaponStats = {
  id: 'bare-hands',
  name: 'Fists',
  icon: '✊',
  damage: 9,
  variance: 0.25,
  accuracy: 0.7,
  durability: Infinity,
  combat: FISTS.combat,
  sprite: FISTS.sprite,
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
  /** The last night's sleep was on an empty stomach (the shelter says so). */
  const lastSleptHungry = ref(false)

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
      combat: spec.combat ?? { dmg: 2, hands: 'makeshift' },
      sprite: spec.sprite,
    }
  })

  /** Rounds in the 9mm (up to 18). They outlast the fight; packs and boxes from the bag load it (the Bag screen, or a reload in a fight). */
  const rounds = ref(0)
  /** Rounds loose in Juan's pockets: what a pack had over when the gun filled up. Loading uses these first. */
  const spareRounds = ref(0)
  /** The sumpak's one shell (0 or 1), and shells loose in his pockets from an opened box (4 to a box). */
  const shells = ref(0)
  const spareShells = ref(0)
  /** What a gun has loaded and loose, by gun id (the 9mm or the sumpak). */
  const loadedOf = (id: string) => (id === 'sumpak' ? shells.value : rounds.value)
  const spareOf = (id: string) => (id === 'sumpak' ? spareShells.value : spareRounds.value)
  function setGun(id: string, loaded: number, spare: number) {
    if (id === 'sumpak') { shells.value = loaded; spareShells.value = spare }
    else { rounds.value = loaded; spareRounds.value = spare }
  }
  /** Juan owns the 9mm: in his hand, worn in a slot, or in the bag. */
  const hasPistol = () => Object.values(equipped.value).includes('pistol') || useInventoryStore().hasInBag('pistol')
  /** Out of a fight, ammo goes into the 9mm (up to its 18): loose rounds first, then the smallest pack in the bag, again and again
      until it's full or there's nothing left. What a pack has over stays loose in his pockets. Returns how many went in. */
  function loadPistol(): number {
    const inventory = useInventoryStore(), gun = PIXEL_COMBAT.guns.pistol!
    let loaded = rounds.value, spare = spareRounds.value
    const before = loaded
    for (;;) {
      const take = Math.min(gun.mag - loaded, spare)
      loaded += take; spare -= take
      if (loaded >= gun.mag) break
      const pack = Object.keys(gun.packs).find((p) => inventory.hasInBag(p))   // rounds (6) before a box (12)
      if (!pack) break
      inventory.removeFromBag(pack)
      spare += gun.packs[pack]!
    }
    rounds.value = loaded; spareRounds.value = spare
    return loaded - before
  }
  /** There is room in the 9mm and something to put in it. */
  const canLoadPistol = computed(() => hasPistol() && rounds.value < PIXEL_COMBAT.guns.pistol!.mag
    && (spareRounds.value > 0 || Object.keys(PIXEL_COMBAT.guns.pistol!.packs).some((p) => useInventoryStore().hasInBag(p))))

  const weaponDurability = computed(() => durability.value[weapon.value.id] ?? weapon.value.durability)
  /** Swings a weapon has left, carried or not (a fresh one has its full count). */
  function durabilityOf(id: string): number | undefined {
    return durability.value[id] ?? EQUIPMENT[id]?.durability
  }
  const unbreakable = computed(() => !Number.isFinite(weaponDurability.value))

  /** Armor wear: points of damage each piece can still soak, by id (absent = as new). */
  const armorWear = ref<Record<string, number>>({})
  const conditionOf = (id: string) => armorWear.value[id] ?? EQUIPMENT[id]?.condition ?? 0
  /** Each worn piece of armor once (a piece spanning two slots counts once), with what it still blocks. */
  const wornArmor = computed(() => [...new Set(equippedItems.value.map((e) => e.id))]
    .filter((id) => (EQUIPMENT[id]?.armor ?? 0) > 0 && conditionOf(id) > 0)
    .map((id) => ({ id, armor: EQUIPMENT[id]!.armor!, condition: conditionOf(id), max: EQUIPMENT[id]!.condition ?? 1 })))
  /** Flat damage subtracted from every enemy hit that connects (capped at half the hit in combat). */
  const armorTotal = computed(() => wornArmor.value.reduce((sum, a) => sum + a.armor, 0))

  /**
   * A hit landed: armor soaks `blocked` points, shared out piece by piece, and each point soaked wears that piece down.
   * Returns the names of pieces that fell apart (they come off Juan and are gone).
   */
  function wearArmor(blocked: number): string[] {
    const broke: string[] = []
    for (const a of wornArmor.value) {
      if (blocked <= 0) break
      const take = Math.min(a.armor, blocked, a.condition)
      blocked -= take
      armorWear.value[a.id] = a.condition - take
      if (armorWear.value[a.id]! <= 0) {
        for (const s of slotsFor(a.id)) if (equipped.value[s] === a.id) equipped.value[s] = null
        delete armorWear.value[a.id]
        broke.push(EQUIPMENT[a.id]!.name)
      }
    }
    return broke
  }
  /** Patched at the shelter: `n` points back on the most worn piece Juan has on. Returns [its name, points it got] or null. */
  function repairArmor(n: number): [string, number] | null {
    const worst = [...wornArmor.value].sort((a, b) => a.condition / a.max - b.condition / b.max)[0]
    if (!worst || worst.condition >= worst.max) return null
    const got = Math.min(worst.max, worst.condition + n) - worst.condition
    armorWear.value[worst.id] = worst.condition + got
    return [EQUIPMENT[worst.id]!.name, got]
  }

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
    // Outside a fight there are no turns to spread it over: the whole course lands now.
    if (effect.regen) heal(effect.regen.amount * effect.regen.turns)
    if (effect.energy) restoreEnergy(effect.energy)
    if (effect.hope) raiseHope(effect.hope)
    if (effect.dreadRelief) relieveDread(effect.dreadRelief)
    if (effect.food) food.value = Math.min(100, food.value + effect.food)
  }

  /**
   * Sleeping through the night: hunger, rest, and the night's Dread (passNight). Returns
   * whether Juan went to bed fed. The board's phase flip happens separately (ShelterScreen
   * calls sleepThroughToMorning).
   */
  function sleep(): boolean {
    const fed = food.value >= SLEEP_FOOD_COST
    food.value = Math.max(0, food.value - SLEEP_FOOD_COST)
    restoreEnergy(SLEEP_ENERGY)
    health.value = fed ? Math.min(JUAN_MAX_HEALTH, health.value + SLEEP_HEALTH) : Math.max(1, health.value - SLEEP_HUNGRY_HEALTH)
    lastSleptHungry.value = !fed
    passNight()
    return fed
  }

  /**
   * A night goes by, slept through or spent out in the dark. Dread barely fades — 8 a night —
   * and each night it eats at Hope, 1 per 10 Dread. lastDreadPenalty is the shelter's report.
   */
  function passNight(): number {
    const penalty = Math.floor(dread.value / PIXEL_COMBAT.dreadPerHopeLost)
    if (penalty > 0) hope.value = Math.max(0, hope.value - penalty)
    lastDreadPenalty.value = penalty
    dread.value = Math.max(0, dread.value - PIXEL_COMBAT.dreadNightlyDrain)
    return penalty
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
    for (const slot of spec.slots) {
      const current = equipped.value[slot]
      if (current) displaced.push(slot)
    }

    // Clear each overlapping piece's full footprint so a one-hander releases both
    // halves of a two-handed grip. Gear in unrelated slots stays on Juan.
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

  /** Taped up at the shelter: `n` swings back on the weapon in hand, never past new. Returns the swings it actually got. */
  function repairWeapon(n: number): number {
    const id = weapon.value.id, max = weapon.value.durability
    if (!Number.isFinite(max)) return 0
    const now = durability.value[id] ?? max
    durability.value[id] = Math.min(max, now + n)
    return durability.value[id]! - now
  }

  /** Weapon broke mid-fight: hands come out empty (bare hands are the fallback). */
  function breakWeapon() {
    const id = weapon.value.id
    for (const s of slotsFor(id)) equipped.value[s] = null
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
    lastSleptHungry.value = false
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
    rounds.value = 0
    spareRounds.value = 0
    shells.value = 0
    spareShells.value = 0
    armorWear.value = {}
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
      rounds: rounds.value,
      spareRounds: spareRounds.value,
      shells: shells.value,
      spareShells: spareShells.value,
      armorWear: { ...armorWear.value },
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
    rounds.value = state.rounds ?? 0                     // saves from before the pistol have none
    spareRounds.value = state.spareRounds ?? 0
    shells.value = state.shells ?? 0                     // saves from before the sumpak and armor wear have none
    spareShells.value = state.spareShells ?? 0
    armorWear.value = { ...(state.armorWear ?? {}) }
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
    rounds,
    spareRounds,
    shells,
    spareShells,
    loadedOf,
    spareOf,
    setGun,
    loadPistol,
    canLoadPistol,
    armorTotal,
    wornArmor,
    armorWear,
    conditionOf,
    wearArmor,
    repairArmor,
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
    passNight,
    durabilityOf,
    repairWeapon,
    lastSleptHungry,
    clearShelterReport,
    resetRun,
    snapshot,
    hydrate,
  }
})
