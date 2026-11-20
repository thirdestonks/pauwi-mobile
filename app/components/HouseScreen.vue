<script setup lang="ts">
// Inside a house: a walkable, dark, searchable interior (public/game/house-interior, ported from .art/house-interior and steered by
// postMessage). Juan walks the rooms by his flashlight and searches the cupboards; what is in them is only known once he opens them.
// A Shambler that reaches him starts the in-house fight (InteriorCombatScreen), and the house waits, hidden, until the fight is over.
// The app owns everything that matters: this bridge takes the loot into the real bag (as many as fit), drops, uses, fights and leaves.
import { CONSUMABLE_EFFECTS, JUAN_MAX_HEALTH, rollEncounter } from '~/data/combat'
import { itemInfo } from '~/data/equipment'
import { appItemId, houseDoorAt, houseLayout, pageItemId, pickupSound } from '~/utils/tondo'

const house = useHouseStore()
const ui = useUiStore()
const combat = useCombatStore()
const inventory = useInventoryStore()
const player = usePlayerStore()
const board = useBoardStore()
const scene = useEncounterScene()
const sfx = useSfx()

const frame = ref<HTMLIFrameElement | null>(null)
const box = ref<HTMLElement | null>(null)
const size = reactive({ w: 0, h: 0 })

const layout = computed(() => (house.tile ? houseLayout(house.tile.q, house.tile.r) : null))
const src = computed(() => (layout.value ? `/game/house-interior/index.html?embed&v=1` : ''))

const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/** The ten bag slots as the page wants them: its own item id, how many, and a name and picture for anything it does not know. */
function slots() {
  return inventory.bag.map((s) => {
    if (!s) return null
    const info = itemInfo(s.id)
    return { pid: pageItemId(s.id), qty: s.qty, name: info?.name ?? s.id, sprite: info?.sprite ?? null, icon: info?.icon ?? '' }
  })
}
function send(m: Record<string, unknown>) {
  frame.value?.contentWindow?.postMessage({ pauwi: 'house-cmd', ...plain(m) }, '*')
}
/** A crowbar in Juan's hand pries doors as well as one in the bag. */
const barInHand = computed(() => Object.values(player.equipped).includes('crowbar'))
function sync() {
  send({ cmd: 'sync', bag: slots(), bar: barInHand.value, hp: Math.round((player.health / JUAN_MAX_HEALTH) * 100), dread: player.dread })
}
watch(() => [inventory.bag.map((s) => (s ? `${s.id}:${s.qty}` : '')).join('|'), player.health, player.dread, barInHand.value], sync)

let fighting = false

function useSlot(i: number): string {
  const slot = inventory.bag[i]
  if (!slot) return ''
  const fx = CONSUMABLE_EFFECTS[slot.id]
  const name = itemInfo(slot.id)?.name ?? slot.id
  if (!fx) return `${name}: better saved for the shelter.`
  const onlyHeals = !!fx.heal && !fx.energy && !fx.hope && !fx.dreadRelief
  if (onlyHeals && player.health >= JUAN_MAX_HEALTH) return 'Already at full health.'
  if (!inventory.consumeBagSlot(i)) return ''
  sfx.play(slot.id.includes('noodles') || fx.food ? 'paper-grab' : 'bandage')
  // Outside a fight everything lands at once, including what would have trickled in over turns.
  if (fx.heal) player.heal(fx.heal + (fx.regen ? fx.regen.amount * fx.regen.turns : 0))
  if (fx.energy) player.restoreEnergy(fx.energy)
  if (fx.hope) player.raiseHope(fx.hope)
  if (fx.dreadRelief) player.relieveDread(fx.dreadRelief)
  return `${name}: ${fx.label}`
}

function onMessage(e: MessageEvent) {
  const m = e.data
  if (!m || m.pauwi !== 'house' || e.source !== frame.value?.contentWindow) return
  const t = house.tile
  if (!t) return
  switch (m.t) {
    case 'ready':
      send({
        cmd: 'init', seed: layout.value!.seed, tpl: layout.value!.tpl, state: house.saved[house.keyOf(t)] ?? null,
        bag: slots(), bar: barInHand.value, hp: Math.round((player.health / JUAN_MAX_HEALTH) * 100), dread: player.dread,
      })
      return
    case 'take': {
      const ok = inventory.addToBag(appItemId(m.item))
      if (ok) sfx.play(pickupSound(m.item))
      send({ cmd: 'reply', id: m.id, ok })
      sync()
      return
    }
    case 'drop': {
      const id = inventory.dropFromBag(m.slot)
      if (id) sfx.play('put-item', 0.8)
      const info = id ? itemInfo(id) : null
      send({ cmd: 'reply', id: m.id, ok: !!id, item: id ? { pid: pageItemId(id), name: info?.name ?? id, sprite: info?.sprite ?? null, icon: info?.icon ?? '' } : null })
      sync()
      return
    }
    case 'use': {
      const msg = useSlot(m.slot)
      send({ cmd: 'reply', id: m.id, ok: true, msg })
      sync()
      return
    }
    case 'state':
      house.saved[house.keyOf(t)] = plain(m.state)
      return
    case 'fight':
      // Contact: a Shambler reached Juan. One weaker Shambler, already in front of him, in the dark room's floor.
      fighting = true
      ui.startCombat()
      combat.start(rollEncounter(1), { interior: houseDoorAt(t.q, t.r)?.floor ?? 'wood' })
      return
    case 'leave':
      // Searched out (or out of strength to dig): the house is done. Otherwise it waits, and keeps what he left in it.
      // Either way the house card is done with: he just walked out of that door, so it doesn't ask "Go in?" again on the step.
      // A half-searched house stays enterable: step off and back on.
      if (m.all) board.resolveEncounter(t)
      else if (board.activeCard === t) board.dismissCard()
      scene.passDoor('nida', true, () => house.close())
      return
  }
}

// The fight is over (the screen hands the app back): tell the house how it went.
watch(() => ui.combatActive, (now, was) => {
  if (!was || now || !fighting) return
  fighting = false
  send({ cmd: 'fightEnd', result: combat.outcome })
  sync()
})

// The picture is native 110x225, so it is sized to the largest 110:225 box the screen has room for.
let ro: ResizeObserver | null = null
function fit() {
  const b = box.value
  if (!b) return
  const w = Math.min(b.clientWidth, (b.clientHeight * 110) / 225)
  size.w = Math.floor(w)
  size.h = Math.floor((w * 225) / 110)
}
onMounted(() => {
  window.addEventListener('message', onMessage)
  fit()
  if (box.value && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(box.value) }
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  ro?.disconnect()
})
</script>

<template>
  <div ref="box" class="absolute inset-0 z-[50] flex items-center justify-center" style="background: #000">
    <iframe
      ref="frame"
      :src="src"
      title="Inside the house"
      class="border-0 block"
      :style="{ width: `${size.w}px`, height: `${size.h}px` }"
    />
  </div>
</template>
