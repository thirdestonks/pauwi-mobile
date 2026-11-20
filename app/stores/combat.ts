import { defineStore } from 'pinia'
import {
  BEAT_DEATH,
  BEAT_IMPACT,
  BEAT_OUTCOME,
  BEAT_STEP,
  FAST_BEATS,
  CONSUMABLE_EFFECTS,
  DEFAULT_ENEMY_TYPE,
  ENEMY_TYPES,
  GUARD_DAMAGE_MULTIPLIER,
  JUAN_ID,
  JUAN_SPEED,
  rollLoot,
  rowMultOf,
  PIXEL_COMBAT,
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
  /** On the 3x3 grid: row 0 CLOSE, 1 MID, 2 FAR; lane 0..2 left to right. */
  row: number
  lane: number
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
  kind: 'damage' | 'heal' | 'miss' | 'crit'
}

/** A weapon's damage range at CLOSE: dmg−1 … dmg+1, never below 1. Fists always hit for 1. */
export function damageRange(dmg: number): [number, number] {
  return dmg <= 1 ? [1, 1] : [Math.max(1, dmg - 1), dmg + 1]
}

const LOG_LINES = 3
// the sound of each weapon's swing (the hand art decides): bat and arnis whoosh, the pipe is heavier, blades cut, the 9mm fires
const SWING_SFX: Record<string, [string, number]> = {
  makeshift: ['weapon-swing', 0.8], arnis: ['weapon-swing', 0.7], pipe: ['iron-pipe-swing', 0.85],
  itak: ['knife-slice', 0.8], fist: ['weapon-swing', 0.5], pistol: ['pistol-shot', 0.9],
}
/** Juan's hand animation reaches its impact frame about here. */
const SWING_WINDUP = 400
/** When each enemy's attack animation connects (its anim json's impact frame). */
const BITE_MS: Record<string, number> = { shambler: 320, brute: 520 }
/** How long a step forward takes on screen (the screen eases `row` changes over this). */
const STEP_MS = 700

export const useCombatStore = defineStore('combat', () => {
  const player = usePlayerStore()
  const sfx = useSfx()

  const active = ref(false)
  const phase = ref<CombatPhase>('idle')
  const outcome = ref<CombatOutcome | null>(null)
  const round = ref(1)
  /** Day/Night snapshot from the board at fight start — modifiers don't flip mid-fight. */
  const fightPhase = ref<DayPhase>('day')
  /** Where the fight is: the street, or inside a house (one weaker Shambler, a dark room lit only by the flashlight, no floor grid drawn). */
  const fightScene = ref<'street' | 'interior'>('street')
  /** The interior's floor, which picks the painted room: wooden or tiled. */
  const interiorFloor = ref<'wood' | 'tile'>('wood')

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
  /** A bandage or medicine still working: Health at the start of each of Juan's next turns. */
  const regen = ref<{ amount: number; turns: number } | null>(null)

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

  /** Running: low odds, better with nothing in Juan's face. There's no running from the gate (the Brute). */
  const retreatOdds = computed(() => {
    if (gateFight.value) return 0
    // what he carries matters: light +10%, loaded −15%, overloaded −30% (data/weight.ts), never below 5%
    const base = livingEnemies.value.some((e) => e.row === 0) ? PIXEL_COMBAT.runOdds : PIXEL_COMBAT.runOddsClear
    return Math.max(0.05, Math.min(0.95, base + useInventoryStore().load.run))
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
    if (useSettings().settings.fastFights) delay *= FAST_BEATS
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
      ...[...livingEnemies.value].sort((a, b) => a.row - b.row).map((e) => ({
        id: e.id,
        name: e.name,
        icon: '🧟',
        side: 'enemy' as const,
        speed: e.speed,
      })),
    ].sort((a, b) => sideRank(a.side) - sideRank(b.side))       // the player side first, then every enemy, nearest first
  }

  function dropFromQueue(id: string) {
    const index = queue.value.findIndex((entry) => entry.id === id)
    if (index === -1) return
    queue.value.splice(index, 1)
    if (index < turnIndex.value) turnIndex.value = Math.max(0, turnIndex.value - 1)
  }

  function start(encounter: EnemySpec[], options: { gate?: boolean; interior?: boolean | 'wood' | 'tile' } = {}) {
    clearTimers()

    gateFight.value = options.gate ?? false
    fightScene.value = options.interior ? 'interior' : 'street'
    if (options.interior) interiorFloor.value = options.interior === 'wood' || options.interior === 'tile' ? options.interior : (Math.random() < 0.5 ? 'wood' : 'tile')
    // Inside a house it is always one zombie, whatever the tile rolled.
    if (options.interior) encounter = encounter.slice(0, 1)
    fightPhase.value = useBoardStore().phase
    allies.value = [{ id: JUAN_ID, name: player.name, icon: '🧍', speed: JUAN_SPEED }]
    // The tile says which archetype and how tough; this resolves it into the stats the
    // fight actually uses, so a new enemy type needs no change here.
    // Everyone enters at FAR, spread across the lanes (inside a house the one Shambler starts at CLOSE); HP is the pixel combat's (5 a Shambler, 16 the Brute).
    const LANES = [[1], [0, 2], [0, 1, 2]][Math.min(3, encounter.length) - 1] ?? [1]
    enemies.value = encounter.slice(0, 3).map((spec, index) => {
      const type = ENEMY_TYPES[spec.archetype] ?? ENEMY_TYPES[DEFAULT_ENEMY_TYPE]
      const hp = type.id === 'brute' ? PIXEL_COMBAT.brute.hp : options.interior ? PIXEL_COMBAT.interior.hp : PIXEL_COMBAT.shambler.hp
      return {
        id: `enemy-${index}`,
        archetype: type.id,
        name: type.name,
        hp,
        maxHp: hp,
        damageTable: type.damageTable,
        accuracy: type.accuracy,
        speed: type.speed,
        dying: false,
        row: options.interior ? 0 : 2,                                // inside a house it is already in front of Juan
        lane: LANES[index] ?? 1,
      }
    })
    initialEnemyCount.value = enemies.value.length

    active.value = true
    phase.value = 'idle'
    outcome.value = null
    round.value = 1
    guarding.value = false
    busy.value = false
    regen.value = null
    pose.value = 'idle'
    hitEnemyId.value = null
    swingingEnemyId.value = null
    damageFloater.value = null
    lootGained.value = []
    lootLost.value = []

    const count = enemies.value.length
    const type = ENEMY_TYPES[enemies.value[0]?.archetype ?? DEFAULT_ENEMY_TYPE]
    log.value = [
      options.interior
        ? `A ${type.name} is already in front of you, right at the edge of your light.`
        : count === 1
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
      // Healing over time ticks in as his turn starts.
      const r = regen.value
      if (r && r.turns > 0) {
        player.heal(r.amount)
        damageFloater.value = { target: 'juan', id: null, amount: r.amount, kind: 'heal' }
        schedule(() => { if (damageFloater.value?.kind === 'heal') damageFloater.value = null }, BEAT_STEP * 2)
        regen.value = r.turns > 1 ? { amount: r.amount, turns: r.turns - 1 } : null
        pushLog(`The dressing holds. +${r.amount} Health.`)
      }
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
    // Armor soaks its flat share, never more than half the hit, and wears down by what it soaked.
    const blocked = Math.min(player.armorTotal, Math.floor(raw * PIXEL_COMBAT.armorCap))
    const afterArmor = Math.max(1, raw - blocked)
    const broke = blocked > 0 ? player.wearArmor(blocked) : []
    const damage = guarding.value
      ? Math.max(1, Math.round(afterArmor * GUARD_DAMAGE_MULTIPLIER))
      : afterArmor

    const finished = player.applyDamage(damage)
    useSettings().buzz(finished ? [60, 40, 120] : 40)
    player.raiseDread(PIXEL_COMBAT.dreadHit)
    sfx.play('zombie-bite')
    pose.value = 'hurt'
    damageFloater.value = { target: 'juan', id: null, amount: damage, kind: 'damage' }
    pushLog(
      guarding.value
        ? `${attackerName} slams into your guard — ${damage} Health, and it lands soft.`
        : blocked
          ? `${attackerName} connects. −${damage} Health; your gear ate ${blocked}.`
          : `${attackerName} connects. −${damage} Health.`,
    )
    for (const name of broke) pushLog(`The ${name.toLowerCase()} tears apart and falls away.`)

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

    if (enemy.row === 0) {                                          // in reach: it lunges, and sometimes it misses
      swingingEnemyId.value = id
      const stats = enemy.archetype === 'brute' ? PIXEL_COMBAT.brute : fightScene.value === 'interior' ? PIXEL_COMBAT.interior : PIXEL_COMBAT.shambler
      const missed = Math.random() < stats.miss
      schedule(() => {
        if (!active.value || outcome.value) return
        if (missed) return missOnJuan(enemy.name)
        if (landOnJuan(stats.bite, enemy.name)) finish('lost')
      }, BITE_MS[enemy.archetype] ?? 320)
      return
    }

    const to = enemy.row - 1                                        // otherwise one row closer, unless its lane is blocked
    if (livingEnemies.value.some((o) => o !== enemy && o.row === to && o.lane === enemy.lane)) {
      schedule(advance, 150)
      return
    }
    enemy.row = to
    if (to === 0) {
      player.raiseDread(PIXEL_COMBAT.dreadClose)                   // it's in his face now
      pushLog(`The ${enemy.name.toLowerCase()} is on you.`)
    }
    schedule(advance, STEP_MS)
  }

  /** The lunge goes wide: a whoosh past Juan's ear, no damage, no Dread. */
  function missOnJuan(attackerName: string) {
    sfx.play('weapon-swing', 0.6)
    damageFloater.value = { target: 'juan', id: null, amount: 0, kind: 'miss' }
    pushLog(`${attackerName} lunges — and grabs nothing but fog.`)
    schedule(() => { damageFloater.value = null; swingingEnemyId.value = null }, BEAT_IMPACT)
    advance()
  }

  /** What an enemy does on its next turn: bite (in reach), wait (its lane is blocked), or step closer. */
  function intentOf(e: Enemy): 'bite' | 'wait' | 'advance' {
    if (e.row === 0) return 'bite'
    return livingEnemies.value.some((o) => o !== e && o.row === e.row - 1 && o.lane === e.lane) ? 'wait' : 'advance'
  }

  function canAct(): boolean {
    return active.value && !outcome.value && !busy.value && phase.value === 'player-turn'
  }

  /**
   * A gun is empty: reload from what is loose in Juan's pockets, else the smallest pack in the bag (the 9mm: a small pack of 6, else a
   * box of 12 that loads 6 and leaves 6 loose; the sumpak: a box of 4 shells, one goes in), else just a click. Both cost the turn.
   */
  function reloadOrClick() {
    const inventory = useInventoryStore()
    const id = player.weapon.id, gun = PIXEL_COMBAT.guns[id] ?? PIXEL_COMBAT.guns.pistol!
    const source = Object.keys(gun.packs).find((p) => inventory.hasInBag(p))
    let loaded = player.loadedOf(id), spare = player.spareOf(id)
    if (spare > 0 || source) {
      if (spare <= 0 && source) {
        inventory.removeFromBag(source)
        spare += gun.packs[source] ?? 0
      }
      const load = Math.min(gun.mag - loaded, spare)
      loaded += load
      spare -= load
      player.setGun(id, loaded, spare)
      sfx.play(id === 'sumpak' ? 'shotgun-reload' : '9mm-reload')
      pushLog(id === 'sumpak'
        ? `You break the pipes apart and slide a shell in.${spare ? ` ${spare} loose in your pocket.` : ''}`
        : `You thumb fresh rounds into the magazine. ${loaded} loaded${spare ? `, ${spare} loose in your pocket` : ''}.`)
    } else {
      sfx.play('pistol-shot-empty')
      pushLog(`Click. It's empty, and there's nothing left in the bag to load.`)
    }
    busy.value = true
    phase.value = 'resolving'
    schedule(advance, BEAT_IMPACT)
  }

  /** Attacks the picked enemy (by id), or the nearest one standing. */
  function attack(targetId?: string) {
    if (!canAct()) return
    const target = livingEnemies.value.find((e) => e.id === targetId)
      ?? [...livingEnemies.value].sort((a, b) => a.row - b.row)[0]
    if (!target) return

    const weapon = player.weapon
    if (weapon.combat.gun && player.loadedOf(weapon.id) <= 0) return reloadOrClick()

    busy.value = true
    phase.value = 'resolving'

    if (weapon.combat.gun) {
      player.setGun(weapon.id, player.loadedOf(weapon.id) - 1, player.spareOf(weapon.id))
      player.raiseDread(PIXEL_COMBAT.dreadShot * (weapon.combat.lane ? 2 : 1))   // it's loud, and the sumpak is louder
    }
    const brokeThisSwing = player.spendDurability()
    const hit = !(player.dread >= PIXEL_COMBAT.shakenAt && Math.random() < PIXEL_COMBAT.shakenMiss)

    let damage = 0
    let killed = false
    let crit = false
    /** The sumpak's spread: everything else standing in the target's lane takes its own roll. */
    const others: Enemy[] = []
    const roll = (e: Enemy, isCrit: boolean) => {
      const [lo, hi] = damageRange(weapon.combat.dmg)
      const dmg = +((lo + Math.floor(Math.random() * (hi - lo + 1))) * (isCrit ? PIXEL_COMBAT.critMult : 1) * rowMultOf(weapon.combat, e.row)).toFixed(1)
      e.hp = Math.max(0, +(e.hp - dmg).toFixed(1))
      return dmg
    }
    if (hit) {
      crit = Math.random() < (weapon.combat.crit ?? PIXEL_COMBAT.critChance)
      damage = roll(target, crit)
      killed = target.hp <= 0
      if (weapon.combat.lane) for (const e of livingEnemies.value) if (e !== target && e.lane === target.lane) { roll(e, false); others.push(e) }
    } else {
      pushLog('Your hands are shaking. The swing goes wide.')
      damageFloater.value = { target: 'enemy', id: target.id, amount: 0, kind: 'miss' }
    }

    pose.value = 'attack'
    sfx.play(...(SWING_SFX[weapon.combat.hands] ?? SWING_SFX.makeshift))
    schedule(
      () => swingImpact(target, { hit, damage, killed, crit, broke: brokeThisSwing, weaponName: weapon.name, others, knock: !!weapon.combat.knock }),
      SWING_WINDUP,
    )
  }

  function swingImpact(
    target: Enemy,
    result: { hit: boolean; damage: number; killed: boolean; crit: boolean; broke: boolean; weaponName: string; others: Enemy[]; knock: boolean },
  ) {
    if (!active.value || outcome.value) return
    pose.value = 'swoosh'

    if (result.hit) {
      sfx.play('punch-impact', player.weapon.combat.hands === 'fist' ? 1 : 0.7)
      sfx.play(result.killed ? 'zombie-dead' : 'zombie-hurt', result.killed ? 1 : 0.75)
      hitEnemyId.value = target.id
      damageFloater.value = {
        target: 'enemy',
        id: target.id,
        amount: result.damage,
        kind: result.crit ? 'crit' : 'damage',
      }
      if (result.crit) pushLog('A clean, heavy hit — it lands twice as hard.')
      pushLog(
        result.killed
          ? livingEnemies.value.length > 1
            ? `The front ${target.name.toLowerCase()} drops. One left, and it's already turning toward you.`
            : `The ${target.name.toLowerCase()} drops. The alley ahead is clear — for now.`
          : `You put ${result.weaponName} into the front ${target.name.toLowerCase()} — it staggers, snarling.`,
      )
      if (result.others.length) pushLog(`The blast carries down the lane: ${result.others.length + 1} of them take it.`)
      // The hammer's knock-back: a Shambler it hits (and doesn't drop) goes back a row, if there's room behind it.
      if (result.knock && !result.killed && target.row < 2 && !livingEnemies.value.some((o) => o !== target && o.lane === target.lane && o.row === target.row + 1)) {
        target.row += 1
        pushLog(`The blow knocks the ${target.name.toLowerCase()} back a step.`)
      }
      if (result.broke) pushLog(`The ${result.weaponName.toLowerCase()} gives out. You're down to your fists.`)
    }

    const dead = [target, ...result.others].filter((e) => e.hp <= 0)
    schedule(() => {
      hitEnemyId.value = null
      damageFloater.value = null
      if (result.broke) { player.breakWeapon(); useSettings().buzz([30, 30, 60]) }

      schedule(
        () => {
          if (!active.value || outcome.value) return
          if (dead.length) sweepKill(dead)
          else {
            pose.value = 'idle'
            advance()
          }
        },
        dead.length ? BEAT_DEATH : BEAT_IMPACT,
      )
    }, BEAT_IMPACT)
  }

  /** The die frame holds, then the rank restages — defeat-and-advance. A sumpak blast can drop several at once. */
  function sweepKill(targets: Enemy[]) {
    for (const t of targets) t.dying = true
    enemiesDefeated.value += targets.length
    pose.value = 'idle'

    schedule(() => {
      for (const t of targets) dropFromQueue(t.id)
      enemies.value = enemies.value.filter((e) => !targets.includes(e))

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
    const id = inventory.bag[slotIndex]?.id
    if (!id) return false
    if (!inventory.consumeBagSlot(slotIndex)) return false

    busy.value = true
    phase.value = 'resolving'

    const effect = CONSUMABLE_EFFECTS[id]
    const name = inventory.findStashItem(id)?.name ?? id

    // The molotov: every Shambler standing burns, and any it finishes go down together.
    if (effect?.fire) {
      const burned = livingEnemies.value.slice()
      for (const e of burned) e.hp = Math.max(0, +(e.hp - effect.fire).toFixed(1))
      sfx.play('zombie-hurt')
      damageFloater.value = { target: 'enemy', id: burned[0]?.id ?? null, amount: effect.fire, kind: 'damage' }
      pushLog(`The bottle bursts into a sheet of fire. Everything in front of you burns: −${effect.fire} each.`)
      const dead = burned.filter((e) => e.hp <= 0)
      schedule(() => {
        damageFloater.value = null
        if (!dead.length) { advance(); return }
        for (const e of dead) { e.dying = true; enemiesDefeated.value += 1 }
        schedule(() => {
          for (const e of dead) dropFromQueue(e.id)
          enemies.value = enemies.value.filter((e) => !dead.includes(e))
          if (livingEnemies.value.length === 0) finish('won')
          else advance()
        }, BEAT_DEATH)
      }, BEAT_IMPACT)
      return true
    }

    if (effect) {
      sfx.play(effect.food || id.includes('food') || id.includes('noodles') ? 'paper-grab' : 'bandage')
      if (effect.heal) {
        player.heal(effect.heal)
        damageFloater.value = { target: 'juan', id: null, amount: effect.heal, kind: 'heal' }
      }
      if (effect.regen) regen.value = { ...effect.regen }
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

  function swapWeapon(id: string): boolean {
    if (!canAct()) return false
    const inventory = useInventoryStore()
    if (!inventory.equipItem(id)) return false
    busy.value = true
    phase.value = 'resolving'
    sfx.play(player.weapon.id === 'pistol' ? 'pistol-cock' : player.weapon.combat.gun ? 'gun-equip' : 'equip-sound')
    pushLog(`You switch to the ${player.weapon.name.toLowerCase()}.`)
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

    pushLog('You break for the alley mouth, and they cut you off.')
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
      if (fightScene.value !== 'interior') rollVictoryLoot()                // inside a house the cupboards are the reward
      // Victory is the only thing that resolves a zombie tile. Walking away leaves it live.
      // A fight inside a house is not the tile: the house goes on being explored, and resolves when it has been searched.
      if (fightScene.value !== 'interior') useBoardStore().resolveEncounter()
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
    fightScene.value = 'street'
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
    fightScene,
    interiorFloor,
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
    regen,
    intentOf,
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
    swapWeapon,
    retreat,
    stop,
    reset,
  }
})
