import { defineStore } from 'pinia'
import {
  BEAT_DEATH,
  BEAT_IMPACT,
  BEAT_OUTCOME,
  BEAT_STEP,
  BEAT_WINDUP,
  CONSUMABLE_EFFECTS,
  DEFAULT_ENEMY_TYPE,
  DREAD_ON_ATTACK,
  DREAD_ON_HIT,
  DREAD_RELIEF_ON_GUARD,
  ENEMY_TYPES,
  GUARD_DAMAGE_MULTIPLIER,
  JUAN_ID,
  JUAN_SPEED,
  PHASE_BOTH_ACC_NIGHT,
  PHASE_ENEMY_ACC,
  PHASE_PLAYER_DMG,
  RETREAT_BASE,
  RETREAT_BONUS_PER_DEAD_ENEMY,
  RETREAT_FAILURE_BONUS,
  RETREAT_MAX,
  RETREAT_MIN,
  RETREAT_SHAKEN_PENALTY,
  SHAKEN_ACCURACY_PENALTY,
  accuracyWithPenalty,
  rollDamage,
  rollEnemyDamage,
  rollLoot,
  type EnemySpec,
} from '~/data/combat'
import { useBoardStore, type DayPhase } from './board'
import { itemInfo } from '~/data/equipment'
import { useInventoryStore } from './inventory'
import { usePlayerStore } from './player'
import { useUiStore } from './ui'
import { addWin, clearRawSave, saveRunNow } from '~/utils/save'

// The fight itself. Everything the screen draws comes from here, and every timed beat is
// scheduled here too — that's deliberate: the old screen owned its own setTimeouts, which
// is how a queued beat could fire after you'd already left the screen.

export type JuanPose = 'idle' | 'attack' | 'swoosh' | 'hurt' | 'die'
export type CombatPhase =
  | 'idle'
  | 'player-turn'
  | 'resolving'
  | 'enemy-turn'
  | 'won'
  | 'lost'
  | 'escaped'
export type CombatOutcome = 'won' | 'lost' | 'escaped'

export interface Enemy {
  id: string
  /** Which entry in ENEMY_TYPES this was built from — the hook for future types. */
  archetype: string
  name: string
  hp: number
  maxHp: number
  damageTable: [number, number][]
  accuracy: number
  speed: number
  /** Playing the die frame — already at 0 HP, but still staged for a beat. */
  dying: boolean
}

/**
 * Player-side actor. Built as an array from day one (CLAUDE.md: support 1–4 actors so
 * companions slot in without a rebuild), even though the MVP only ever has Juan.
 * Juan's health deliberately isn't stored here — it lives in the player store so damage
 * and death outlive the encounter. `hp` is there for the companions who will need it.
 */
export interface AllyActor {
  id: string
  name: string
  icon: string
  speed: number
  hp?: number
  maxHp?: number
}

export interface TurnEntry {
  id: string
  name: string
  icon: string
  side: 'ally' | 'enemy'
  speed: number
}

export interface DamageFloater {
  target: 'juan' | 'enemy'
  /** Which enemy sprite to float over, when the floater is on an enemy. */
  id: string | null
  amount: number
  kind: 'damage' | 'heal'
}

const LOG_LINES = 3

export const useCombatStore = defineStore('combat', () => {
  const player = usePlayerStore()

  const active = ref(false)
  const phase = ref<CombatPhase>('idle')
  const outcome = ref<CombatOutcome | null>(null)
  const round = ref(1)
  /** Day/Night snapshot from the board at fight start — modifiers don't flip mid-fight. */
  const fightPhase = ref<DayPhase>('day')

  const allies = ref<AllyActor[]>([])
  const enemies = ref<Enemy[]>([])
  const initialEnemyCount = ref(0)
  /**
   * This fight stands between Juan and the way out (TileCard's depart). A win isn't
   * just a cleared tile — it's the demo's ending: ui.won fires, the run is tallied,
   * and the save wipes. Escaping or losing ends the run like any other.
   */
  const gateFight = ref(false)

  const queue = ref<TurnEntry[]>([])
  const turnIndex = ref(0)

  const log = ref<string[]>([])
  const pose = ref<JuanPose>('idle')
  const hitEnemyId = ref<string | null>(null)
  /** The enemy currently mid-swing — drives its attack sprite / lunge on the screen. */
  const swingingEnemyId = ref<string | null>(null)
  const damageFloater = ref<DamageFloater | null>(null)
  const guarding = ref(false)
  const busy = ref(false)

  const enemiesDefeated = ref(0)
  const lootGained = ref<string[]>([])
  const lootLost = ref<string[]>([])

  // Owned here so no beat can outlive the fight that scheduled it.
  let timers: ReturnType<typeof setTimeout>[] = []

  const livingEnemies = computed(() => enemies.value.filter((e) => !e.dying))
  const frontEnemy = computed(() => livingEnemies.value[0] ?? null)
  const currentEntry = computed(() => queue.value[turnIndex.value] ?? null)
  const playerTurn = computed(
    () => active.value && !outcome.value && !busy.value && phase.value === 'player-turn',
  )

  const retreatOdds = computed(() => {
    const putDown = Math.max(0, initialEnemyCount.value - livingEnemies.value.length)
    const penalty = player.shaken ? RETREAT_SHAKEN_PENALTY : 0
    const chance = RETREAT_BASE + putDown * RETREAT_BONUS_PER_DEAD_ENEMY - penalty
    return Math.min(RETREAT_MAX, Math.max(RETREAT_MIN, chance))
  })

  /** For the screen's phase chip — what the light is doing to the fight. */
  const phaseLabel = computed(() =>
    fightPhase.value === 'day'
      ? 'DAYLIGHT — your swings land truer, they miss more'
      : 'DARKNESS — everyone\'s blind, your swings land softer',
  )

  const lootGainedNames = computed(() =>
    lootGained.value.map((id) => itemInfo(id)?.name ?? id),
  )
  const lootLostNames = computed(() =>
    lootLost.value.map((id) => itemInfo(id)?.name ?? id),
  )

  function schedule(fn: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers = timers.filter((t) => t !== timer)
      fn()
    }, delay)
    timers.push(timer)
    return timer
  }

  function clearTimers() {
    for (const timer of timers) clearTimeout(timer)
    timers = []
  }

  function pushLog(line: string) {
    log.value = [...log.value, line].slice(-LOG_LINES)
  }

  /** Speed order, allies winning ties. Rebuilt every round and after every kill. */
  function buildQueue() {
    const sideRank = (side: TurnEntry['side']) => (side === 'ally' ? 0 : 1)
    queue.value = [
      ...allies.value.map((a) => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        side: 'ally' as const,
        speed: a.speed,
      })),
      ...livingEnemies.value.map((e) => ({
        id: e.id,
        name: e.name,
        icon: '🧟',
        side: 'enemy' as const,
        speed: e.speed,
      })),
    ].sort((a, b) => b.speed - a.speed || sideRank(a.side) - sideRank(b.side))
  }

  function dropFromQueue(id: string) {
    const index = queue.value.findIndex((entry) => entry.id === id)
    if (index === -1) return
    queue.value.splice(index, 1)
    if (index < turnIndex.value) turnIndex.value = Math.max(0, turnIndex.value - 1)
  }

  function start(encounter: EnemySpec[], options: { gate?: boolean } = {}) {
    clearTimers()

    gateFight.value = options.gate ?? false
    fightPhase.value = useBoardStore().phase
    allies.value = [{ id: JUAN_ID, name: player.name, icon: '🧍', speed: JUAN_SPEED }]
    // The tile says which archetype and how tough; this resolves it into the stats the
    // fight actually uses, so a new enemy type needs no change here.
    enemies.value = encounter.map((spec, index) => {
      const type = ENEMY_TYPES[spec.archetype] ?? ENEMY_TYPES[DEFAULT_ENEMY_TYPE]
      return {
        id: `enemy-${index}`,
        archetype: type.id,
        name: type.name,
        hp: spec.hp,
        maxHp: spec.hp,
        damageTable: type.damageTable,
        accuracy: type.accuracy,
        speed: type.speed,
        dying: false,
      }
    })
    initialEnemyCount.value = enemies.value.length

    active.value = true
    phase.value = 'idle'
    outcome.value = null
    round.value = 1
    guarding.value = false
    busy.value = false
    pose.value = 'idle'
    hitEnemyId.value = null
    swingingEnemyId.value = null
    damageFloater.value = null
    lootGained.value = []
    lootLost.value = []

    const count = enemies.value.length
    const type = ENEMY_TYPES[enemies.value[0]?.archetype ?? DEFAULT_ENEMY_TYPE]
    log.value = [
      count === 1
        ? `One ${type.name} between you and the street — it hasn't seen you yet.`
        : count === 2
          ? `Two ${type.plural} in the fog, and the alley mouth is behind them.`
          : `Three ${type.plural}, and the alley only goes one way. Nothing behind you but wall.`,
    ]

    buildQueue()
    turnIndex.value = 0
    nextTurn()
  }

  function nextTurn() {
    if (!active.value || outcome.value) return
    const entry = currentEntry.value
    if (!entry) {
      endRound()
      return
    }

    if (entry.side === 'ally') {
      // Guard only ever buys you one round — it lapses when Juan's turn comes back around.
      guarding.value = false
      phase.value = 'player-turn'
      busy.value = false
      return
    }

    phase.value = 'enemy-turn'
    busy.value = true
    schedule(() => enemyTurn(entry.id), BEAT_STEP)
  }

  function advance() {
    if (!active.value || outcome.value) return
    turnIndex.value += 1
    busy.value = false
    schedule(nextTurn, BEAT_STEP)
  }

  function endRound() {
    if (!active.value || outcome.value) return
    round.value += 1
    buildQueue()
    turnIndex.value = 0
    busy.value = false
    schedule(nextTurn, BEAT_STEP)
  }

  /**
   * One damage path for everything that hits Juan: armor eats its flat share first,
   * guard halves what's left, Health takes the remainder. Returns true when this blow
   * ended the run. All three enemy damage routes (swing, retreat grab) go through here.
   */
  function landOnJuan(raw: number, attackerName: string): boolean {
    const afterArmor = Math.max(1, raw - player.armorTotal)
    const damage = guarding.value
      ? Math.max(1, Math.round(afterArmor * GUARD_DAMAGE_MULTIPLIER))
      : afterArmor

    const finished = player.applyDamage(damage)
    player.raiseDread(DREAD_ON_HIT)
    pose.value = 'hurt'
    damageFloater.value = { target: 'juan', id: null, amount: damage, kind: 'damage' }
    pushLog(
      guarding.value
        ? `${attackerName} slams into your guard — ${damage} Health, and it lands soft.`
        : `${attackerName} connects. −${damage} Health.`,
    )

    schedule(() => {
      damageFloater.value = null
    }, BEAT_STEP)

    if (finished) return true

    schedule(() => {
      if (!outcome.value) pose.value = 'idle'
      swingingEnemyId.value = null
    }, BEAT_IMPACT)

    advance()
    return false
  }

  function enemyTurn(id: string) {
    const enemy = enemies.value.find((e) => e.id === id)
    if (!enemy || enemy.dying || !active.value || outcome.value) {
      advance()
      return
    }

    // Day makes them sloppy; night makes EVERYONE blind. Floor keeps it possible, not certain.
    const nightBlindness = fightPhase.value === 'night' ? PHASE_BOTH_ACC_NIGHT : 0
    const enemyAccuracy = Math.max(
      0.05,
      enemy.accuracy + PHASE_ENEMY_ACC[fightPhase.value] - nightBlindness,
    )
    // Wind-up shows whether the blow lands or not — a swipe you sidestep still lunges.
    swingingEnemyId.value = id
    if (Math.random() >= enemyAccuracy) {
      pushLog(
        fightPhase.value === 'night'
          ? `${enemy.name} claws at the dark — and the dark is winning.`
          : `${enemy.name} swipes through the space where you were — you feel the air move.`,
      )
      schedule(() => {
        swingingEnemyId.value = null
      }, BEAT_IMPACT)
      advance()
      return
    }

    const raw = rollEnemyDamage(enemy.damageTable)
    if (landOnJuan(raw, enemy.name)) {
      finish('lost')
      return
    }

    schedule(() => {
      if (!outcome.value) pose.value = 'idle'
    }, BEAT_IMPACT)

    advance()
  }

  function canAct(): boolean {
    return active.value && !outcome.value && !busy.value && phase.value === 'player-turn'
  }

  function attack() {
    if (!canAct()) return
    const target = frontEnemy.value
    if (!target) return

    busy.value = true
    phase.value = 'resolving'

    const weapon = player.weapon
    const nightBlindness = fightPhase.value === 'night' ? PHASE_BOTH_ACC_NIGHT : 0
    const accuracy = accuracyWithPenalty(
      weapon.accuracy,
      (player.shaken ? SHAKEN_ACCURACY_PENALTY : 0) + nightBlindness,
    )
    const hit = Math.random() < accuracy
    const brokeThisSwing = player.spendDurability()

    let damage = 0
    let killed = false
    if (hit) {
      // Daylight: Juan can see what he's swinging at. Night: he's guessing.
      damage = Math.max(1, Math.round(rollDamage(weapon.damage, weapon.variance) * PHASE_PLAYER_DMG[fightPhase.value]))
      target.hp = Math.max(0, target.hp - damage)
      killed = target.hp <= 0
    } else {
      pushLog(`You swing ${weapon.name} and catch nothing but fog.`)
    }

    pose.value = 'attack'
    player.raiseDread(DREAD_ON_ATTACK)

    schedule(
      () => swingImpact(target, { hit, damage, killed, broke: brokeThisSwing, weaponName: weapon.name }),
      BEAT_WINDUP,
    )
  }

  function swingImpact(
    target: Enemy,
    result: { hit: boolean; damage: number; killed: boolean; broke: boolean; weaponName: string },
  ) {
    if (!active.value || outcome.value) return
    pose.value = 'swoosh'

    if (result.hit) {
      hitEnemyId.value = target.id
      damageFloater.value = {
        target: 'enemy',
        id: target.id,
        amount: result.damage,
        kind: 'damage',
      }
      pushLog(
        result.killed
          ? livingEnemies.value.length > 1
            ? `The front ${target.name.toLowerCase()} drops. One left, and it's already turning toward you.`
            : `The ${target.name.toLowerCase()} drops. The alley ahead is clear — for now.`
          : `You put ${result.weaponName} into the front ${target.name.toLowerCase()} — it staggers, snarling.`,
      )
      if (result.broke) pushLog('The plank splits along the grain. You\'re down to your fists.')
    }

    schedule(() => {
      hitEnemyId.value = null
      damageFloater.value = null
      if (result.broke) player.breakWeapon()

      schedule(
        () => {
          if (!active.value || outcome.value) return
          if (result.killed) sweepKill(target)
          else {
            pose.value = 'idle'
            advance()
          }
        },
        result.killed ? BEAT_DEATH : BEAT_IMPACT,
      )
    }, BEAT_IMPACT)
  }

  /** The die frame holds, then the rank restages — defeat-and-advance. */
  function sweepKill(target: Enemy) {
    target.dying = true
    enemiesDefeated.value += 1
    pose.value = 'idle'

    schedule(() => {
      dropFromQueue(target.id)
      enemies.value = enemies.value.filter((e) => e.id !== target.id)

      if (livingEnemies.value.length === 0) {
        finish('won')
        return
      }
      advance()
    }, BEAT_DEATH)
  }

  function guardAction() {
    if (!canAct()) return
    busy.value = true
    phase.value = 'resolving'
    guarding.value = true
    player.relieveDread(DREAD_RELIEF_ON_GUARD)
    pushLog('You brace against the wall, weapon up — the next hit will land soft.')
    schedule(advance, BEAT_IMPACT)
  }

  /**
   * Spends a real slot from the field bag. Returns false when the action couldn't happen,
   * so the caller can leave the picker open.
   */
  function useItem(slotIndex: number): boolean {
    if (!canAct()) return false
    const inventory = useInventoryStore()
    const id = inventory.bag[slotIndex]
    if (!id) return false
    if (!inventory.consumeBagSlot(slotIndex)) return false

    busy.value = true
    phase.value = 'resolving'

    const effect = CONSUMABLE_EFFECTS[id]
    const name = inventory.findStashItem(id)?.name ?? id

    if (effect) {
      if (effect.heal) {
        player.heal(effect.heal)
        damageFloater.value = { target: 'juan', id: null, amount: effect.heal, kind: 'heal' }
      }
      if (effect.energy) player.restoreEnergy(effect.energy)
      if (effect.hope) player.raiseHope(effect.hope)
      if (effect.dreadRelief) player.relieveDread(effect.dreadRelief)
      pushLog(`You use ${name} — ${effect.label}.`)
    } else {
      pushLog(`${name} isn't going to help you here.`)
    }

    schedule(() => {
      damageFloater.value = null
    }, BEAT_STEP)
    schedule(advance, BEAT_IMPACT)

    return true
  }

  function retreat() {
    if (!canAct()) return
    busy.value = true
    phase.value = 'resolving'

    if (Math.random() < retreatOdds.value) {
      pushLog('You break for the mouth of the alley — and this time, you make it. Clean.')
      finish('escaped')
      return
    }

    pushLog('You break for the alley mouth — it drags you back by the collar.')
    const enemy = frontEnemy.value
    if (!enemy) {
      advance()
      return
    }

    // The grab reads as a swing too — same pose, same beat.
    swingingEnemyId.value = enemy.id
    const raw = rollEnemyDamage(enemy.damageTable) + RETREAT_FAILURE_BONUS
    if (landOnJuan(raw, enemy.name)) {
      finish('lost')
      return
    }

    schedule(() => {
      if (!outcome.value) pose.value = 'idle'
    }, BEAT_IMPACT)

    advance()
  }

  function rollVictoryLoot() {
    const inventory = useInventoryStore()
    const gained: string[] = []
    const lost: string[] = []

    for (const id of rollLoot()) {
      if (inventory.addToBag(id)) gained.push(id)
      else lost.push(id)
    }

    lootGained.value = gained
    lootLost.value = lost

    if (gained.length) {
      const names = gained.map((id) => inventory.findStashItem(id)?.name ?? id)
      pushLog(`You pocket ${names.join(', ')}.`)
    } else if (lost.length) {
      pushLog('Something worth taking, and no room left in the bag.')
    }
  }

  function finish(result: CombatOutcome) {
    if (outcome.value) return
    clearTimers()

    outcome.value = result
    busy.value = true
    phase.value = result

    if (result === 'won') {
      pose.value = 'idle'
      rollVictoryLoot()
      // Victory is the only thing that resolves a zombie tile. Walking away leaves it live.
      useBoardStore().resolveEncounter()
    } else if (result === 'lost') {
      pose.value = 'die'
    } else {
      pose.value = 'idle'
    }

    schedule(() => exitFight(result), BEAT_OUTCOME)
  }

  function exitFight(result: CombatOutcome) {
    const ui = useUiStore()
    active.value = false
    ui.endCombat()
    // Death doesn't navigate — the death screen covers the app until the run restarts.
    if (result !== 'lost') ui.setTab('map')

    // End of fight is a save point — but only the kinds of ending that leave a run
    // standing. A win at the gate tallies the victory; either terminal outcome wipes
    // the blob: the demo is a roguelike run, and its save is the run, not a checkpoint.
    if (result === 'won') {
      // The gate Brute dying IS the demo's win — nothing else sets ui.won any more.
      if (gateFight.value) {
        ui.winDemo()
        addWin()
        clearRawSave()
      } else {
        saveRunNow()
      }
    } else if (result === 'lost') {
      clearRawSave()
    }
  }

  /** Called from the screen's unmount — no pending beat should survive the fight. */
  function stop() {
    clearTimers()
  }

  function reset() {
    clearTimers()
    gateFight.value = false
    active.value = false
    phase.value = 'idle'
    outcome.value = null
    round.value = 1
    fightPhase.value = 'day'
    allies.value = []
    enemies.value = []
    initialEnemyCount.value = 0
    queue.value = []
    turnIndex.value = 0
    log.value = []
    pose.value = 'idle'
    hitEnemyId.value = null
    swingingEnemyId.value = null
    damageFloater.value = null
    guarding.value = false
    busy.value = false
    enemiesDefeated.value = 0
    lootGained.value = []
    lootLost.value = []
  }

  return {
    active,
    phase,
    fightPhase,
    outcome,
    round,
    allies,
    enemies,
    queue,
    turnIndex,
    log,
    pose,
    hitEnemyId,
    swingingEnemyId,
    damageFloater,
    guarding,
    busy,
    enemiesDefeated,
    lootGained,
    lootLost,
    livingEnemies,
    frontEnemy,
    currentEntry,
    playerTurn,
    retreatOdds,
    phaseLabel,
    lootGainedNames,
    lootLostNames,
    start,
    attack,
    guardAction,
    useItem,
    retreat,
    stop,
    reset,
  }
})
