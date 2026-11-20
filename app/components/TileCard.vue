<script setup lang="ts">
// The card a tile offers when Juan steps onto it, with the preview's encounters behind it
// (useEncounterScene): the dropped backpack, the radio, the abandoned car and its trunk, the
// walk-in shops through their doors, the houses with a door on the street, and the shelters. Inside a shop or a
// trunk Juan taps a thing to look at it and takes it into the field bag; he can take as many as fit, and drops what he
// doesn't want to make room. A house is its own walkable screen (HouseScreen): the card only gets him through the door.
import { ENEMY_TYPES, rollEncounter, rollSearchLoot } from '~/data/combat'
import { EVENTS, type EventDef } from '~/data/events'
import { itemInfo } from '~/data/equipment'
import {
  DOOR_OF, HOUSE_DOOR_TEXT, ITEM, PICK_SHOPS, SHELTER_DOOR, WATER_SHOP, appItemId, houseDoorAt,
  pickupSound, rollLoot, shopAt,
  type LootKind, type ShopKind,
} from '~/utils/tondo'
import type { Tile } from '~/stores/board'

const board = useBoardStore()
const ui = useUiStore()
const combat = useCombatStore()
const house = useHouseStore()
const inventory = useInventoryStore()
const player = usePlayerStore()
const scene = useEncounterScene()
const sfx = useSfx()

type Action = 'combat' | 'search' | 'claim' | 'depart' | 'shop' | 'water' | 'trunk' | 'alarm-fight' | 'alarm-run' | 'take' | 'look' | 'done'
  | 'house-in' | 'house-pry' | 'house-kick' | 'cache' | 'trade' | 'tip'
interface Choice { label: string; primary?: boolean; risky?: boolean; action?: Action; event?: EventDef; eventChoiceIndex?: number }
interface CardDef { label: string; title: string; flavor: string; accent: string; icon: string; choices: Choice[] }

const RADIO_CARD: CardDef = {
  label: 'SIGNAL', title: 'A crackling radio', accent: '#2E86AB', icon: '📡',
  flavor: 'Static, then a voice: "...evacuation boats... North Harbor... every third night..." It cuts out before you can answer.',
  choices: [{ label: 'Listen' }, { label: 'Switch it off' }],
}
const BACKPACK_CARD: CardDef = {
  label: 'SUPPLY', title: 'A dropped backpack', accent: '#F0A63C', icon: '🎒',
  flavor: 'Torn straps, half-zipped, still heavy with something.',
  choices: [{ label: 'Search it', primary: true, action: 'search' }, { label: 'Leave it' }],
}
const ZOMBIE_CARD: CardDef = {
  label: 'MOVEMENT', title: 'Something moves', accent: '#D94B3B', icon: '💀',
  flavor: 'A body by the curb twitches, then sits up. Its head turns toward your light.',
  choices: [{ label: 'Fight', primary: true, risky: true, action: 'combat' }, { label: 'Back off' }],
}
const CACHE_CARD: CardDef = {
  label: 'SUPPLY', title: 'The radio was right', accent: '#F0A63C', icon: '📦',
  flavor: 'A plastic crate wedged behind a drainpipe, a spray-painted X on the wall above it. Somebody meant for somebody to find this.',
  choices: [{ label: 'Open it', primary: true, action: 'cache' }, { label: 'Leave it' }],
}
const CAR_CARD: CardDef = {
  label: 'SUPPLY', title: 'An abandoned car', accent: '#F0A63C', icon: '🚗',
  flavor: "Hazards still blinking, the driver's door hanging open, keys gone. The trunk lid sits a finger's width open. Tap the car, or try the trunk.",
  choices: [{ label: 'Try the trunk', primary: true, action: 'trunk' }, { label: 'Leave it' }],
}

// --- Looting: a shop or a trunk rolls three things, and Juan takes as many as fit in the bag ----------------
/** A take-what-fits scene. ids: what is still in it (page ids); orig: what it held to begin with; got: app ids taken so far. */
interface Pick { kind: LootKind; title: string; intro: string; ids: string[]; orig: string[]; sel: string | null; hover: string | null; got: string[]; note: string }
const pick = ref<Pick | null>(null)
/** A car alarm went off: this many are coming, and the card asks Fight or Run. */
const alarm = ref<number | null>(null)
/** Why a locked door did not give, until he tries something else. */
const doorNote = ref('')
/** Leaving the result card should not resolve the tile (backing out of a house leaves it waiting). */
const keepTile = ref(false)

/** The tile under the card. Held while an outcome is read, since claiming clears the board. */
const heldTile = ref<Tile | null>(null)
const tile = computed(() => board.activeCard ?? heldTile.value)

// --- Aling Cora's stall: the card offers to trade, and the trade itself is TraderPanel inside the card ---
const trader = useTraderStore()
const trading = ref(false)
const atStall = computed(() => !!board.activeCard && board.atTrader)
const TRADER_GREETING = [
  'A tarp lashed to a pillar of the train line, a table of tins and batteries, and a woman on a stool who does not get up.',
  'She is already watching you before you reach the table. "Ano\'ng dala mo?" What have you got?',
  'The lantern hisses. She counts something under the table and does not look up until you are close.',
]

const shopFront = computed<ShopKind | null>(() => (tile.value?.content === 'shop' ? shopAt(tile.value.q, tile.value.r) : null))

/** The card this tile is offering, resolved fresh so claiming a shelter flips it live. */
const liveCard = computed<CardDef | null>(() => {
  const t = tile.value
  if (!t) return null

  if (pick.value) {
    const p = pick.value, id = p.sel ?? p.hover, it = id ? ITEM[id] : null
    return {
      label: 'TAKE WHAT FITS', title: p.title, accent: '#F0A63C', icon: '',
      flavor: p.note || (it ? `${it[0]}. ${it[1]}` : `${p.intro} Tap something to look at it.`),
      choices: p.sel
        ? [{ label: 'Take it', primary: true, action: 'take' }, { label: 'Look around', action: 'look' }]
        : [{ label: p.got.length ? 'Done' : 'Take nothing', action: 'done' }],
    }
  }
  if (atStall.value) {
    const want = itemInfo(trader.request)?.name ?? trader.request
    return {
      label: 'TRADER', title: "Aling Cora's stall", accent: '#E0B24A', icon: '⚖️',
      flavor: trading.value ? trader.rank.line
        : `${TRADER_GREETING[board.dayCount % TRADER_GREETING.length]} ${trader.requestOpen ? `Today she wants ${want.toLowerCase()}, and pays double for it.` : ''}`,
      choices: [
        { label: trader.credit ? `Trade · ${trader.credit} on your tab` : 'Trade', primary: true, action: 'trade' },
        ...(trader.canTip ? [{ label: 'Ask what she has heard', action: 'tip' as Action }] : []),
        { label: 'Walk on' },
      ],
    }
  }
  if (t.content === 'house' && !t.resolved) {
    const door = t.unlocked ? 'open' : houseDoorAt(t.q, t.r)?.state ?? 'open'
    const text = HOUSE_DOOR_TEXT[door], hasBar = inventory.hasInBag('crowbar') || Object.values(player.equipped).includes('crowbar')
    const choices: Choice[] = door === 'open'
      ? [{ label: 'Go in', primary: true, action: 'house-in' }, { label: 'Walk on' }]
      : [
          ...(hasBar ? [{ label: 'Pry it open', primary: true, action: 'house-pry' as Action }] : []),
          { label: 'Kick it in · 55%', primary: !hasBar, risky: true, action: 'house-kick' as Action },
          { label: 'Walk on' },
        ]
    return { label: 'HOUSE', title: text[0], accent: '#C9B38A', icon: door === 'open' ? '🚪' : '🔒', flavor: doorNote.value ? `${doorNote.value} ${text[1]}` : text[1], choices }
  }
  if (alarm.value) {
    return {
      label: 'DANGER', title: 'Car alarm', accent: '#D94B3B', icon: '🚨',
      flavor: `The horn screams and the hazards strobe. Up the street, ${alarm.value === 2 ? 'two shapes turn' : 'a shape turns'} toward the noise.`,
      choices: [{ label: 'Fight', primary: true, risky: true, action: 'alarm-fight' }, { label: 'Run for it', action: 'alarm-run' }],
    }
  }

  if (board.canClaimHere && board.activeCard) {
    const w = board.canClaimHere
    const desc = w.key ? (SHELTER_DESC[w.key] ?? w.flavor) : w.flavor
    return {
      label: 'SHELTER', title: w.name, accent: '#F0A63C', icon: '🏠', flavor: desc,
      choices: [{ label: 'Relocate here', primary: true, action: 'claim' }, { label: 'Not yet' }],
    }
  }

  if (board.atTutuban && board.activeCard) {
    return {
      label: 'THE WAY OUT', title: 'Tutuban', accent: '#F0A63C', icon: '🚉',
      flavor: "You made it. The old station's clock stopped at 4:12. Behind it is the mall where you used to work, every window dark. Then the plaza shudders: something huge shoulders through the dead buses toward you.",
      choices: [{ label: 'Fight it', primary: true, risky: true, action: 'depart' }, { label: 'Back off' }],
    }
  }

  if (t.content === 'shop' && shopFront.value) {
    const f = shopFront.value, s = PICK_SHOPS[f]
    if (s) return { label: 'SHOP', title: s[0], flavor: s[1], accent: '#A860EC', icon: '🏪', choices: [{ label: 'Search it · +2 moves', primary: true, action: 'shop' }, { label: 'Leave it' }] }
    return { label: 'SHOP', title: WATER_SHOP[0], flavor: WATER_SHOP[1], accent: '#A860EC', icon: '💧', choices: [{ label: 'Search it · +2 moves', primary: true, action: 'water' }, { label: 'Leave it' }] }
  }

  if (t.content === 'car') return CAR_CARD
  if (t.type === 'event') {
    const eventDef = t.eventId ? EVENTS.find((e) => e.id === t.eventId) : undefined
    if (eventDef) {
      return {
        label: 'ENCOUNTER', title: eventDef.title, accent: eventDef.accent, icon: eventDef.icon,
        flavor: eventDef.flavor,
        choices: eventDef.choices.map((choice, index) => ({
          label: choice.requires && !inventory.hasInBag(choice.requires) ? `${choice.label} — none left` : choice.label,
          primary: index === 0,
          risky: (choice.outcome?.hope ?? 0) < 0 || (index === eventDef.choices.length - 1 && !choice.outcome),
          event: eventDef,
          eventChoiceIndex: index,
        })),
      }
    }
    return RADIO_CARD
  }
  if (t.type === 'shelter') return { label: 'SHELTER', title: board.shelterName, accent: '#F0A63C', icon: '🏠', flavor: board.shelterFlavor, choices: [{ label: 'Rest easy' }] }
  if (t.type === 'zombie') return ZOMBIE_CARD
  if (t.content === 'cache') return CACHE_CARD
  if (t.type === 'location') return BACKPACK_CARD
  return null
})

const SHELTER_DESC: Record<string, string> = {
  t10: 'A stairwell behind a rusted gate. Dry, five floors up, and a door that locks. You could make this the new shelter.',
  brgy: "The barangay hall's gate hangs open. A desk, a chair, a radio that might still reach someone, and walls the tanods once guarded. You could make this the new shelter.",
  mm: "Mang Mel's shutter is half up. Tools on the wall, a bench to sleep on, and bicycles that could still carry you far. You could make this the new shelter.",
}

// While an outcome is read the card holds its last face: claiming a shelter clears the board under it.
const lastCard = shallowRef<CardDef | null>(null)
watch(liveCard, (c) => { if (c) lastCard.value = c }, { immediate: true })
const content = computed(() => liveCard.value ?? (resultShown.value ? lastCard.value : null))

// What the search turned up, held on screen until the player acknowledges it.
interface SearchResult { name: string; icon: string; sprite?: string; stowed: boolean }
const searchResult = ref<SearchResult | null>(null)
const eventResult = ref<string | null>(null)
const resultShown = computed(() => !!(searchResult.value || eventResult.value))
/** A scene Juan can tap is up: no dimming backdrop over it, and the card stays out of the way. */
const sceneLive = computed(() => !!pick.value || (tile.value?.content === 'car' && !alarm.value && !resultShown.value))

// A new tile is a new card, and its scene goes up behind it.
watch(
  () => board.activeCard,
  (t, before) => {
    if (t === before) return
    if (t) {
      searchResult.value = null
      eventResult.value = null
      pick.value = null
      alarm.value = null
      doorNote.value = ''
      keepTile.value = false
      heldTile.value = null
      trading.value = false
      if (board.atTrader) scene.show('suki')
      else if (t.content === 'loot' && !t.resolved) scene.show('backpack')
      else if (t.content === 'event' && !t.resolved) scene.show('radio')
      else if (t.content === 'car' && !t.resolved) {
        scene.show('car', true)
        scene.listen((m) => { if (m.pick || m.take) tryTrunk() })
      }
    }
  },
  { immediate: true },
)

// Back from a fight: a car alarm (won: the trunk is still open; fled: it's lost).
onMounted(() => {
  const t = scene.pendingTrunk.value
  if (t) {
    scene.pendingTrunk.value = null
    heldTile.value = t
    if (combat.outcome === 'won') {
      scene.enterDoor('trunk', () => startPick('trunk', 'The trunk', 'The street is quiet again, and the alarm has choked off. The trunk is still open. Take what fits.'))
    } else {
      showText('You leave the car screaming behind you. The trunk is lost.')
    }
  }
})

function showText(text: string) {
  scene.listen(null)
  eventResult.value = text
}

function startPick(kind: LootKind, title: string, intro: string) {
  const ids = rollLoot(kind)
  pick.value = { kind, title, intro, ids, orig: [...ids], sel: null, hover: null, got: [], note: '' }
  scene.show(kind, true, ids)
  scene.listen((m) => {
    const p = pick.value
    if (!p) return
    if ('take' in m && m.take) take(m.take)
    else if (m.pick) p.sel = m.pick
    else if ('hover' in m && !p.sel) p.hover = m.hover ?? null
  })
}

function take(id: string) {
  const p = pick.value
  if (!p) return
  const appId = appItemId(id), name = itemInfo(appId)?.name ?? ITEM[id]?.[0] ?? id
  if (!inventory.addToBag(appId)) {
    p.sel = null; p.hover = null
    p.note = inventory.lastRefusal === 'weight'
      ? `Too heavy. ${name} on top of everything else is more than Juan can carry. Drop something, then try again.`
      : `No room for ${name}. Tap something in your bag to drop it, then try again.`
    scene.msg({ glow: null })
    return
  }
  sfx.play(pickupSound(id))
  scene.msg({ taken: id, glow: null })
  p.got.push(appId)
  p.ids = p.ids.filter((x) => x !== id)
  p.sel = null; p.hover = null
  p.note = `${name} is in the bag.`
  if (!p.ids.length) finishPick()
}

/** The last thing taken (or Done): the scene goes quiet and the card reads what Juan carried out. */
function finishPick() {
  const p = pick.value
  pick.value = null
  scene.msg({ live: false })
  showCarried(p?.got ?? [], 'You leave it all where it is.')
}

/** What Juan carried out of a place, as the line the outcome card reads. */
function showCarried(ids: string[], none: string) {
  scene.listen(null)
  eventResult.value = ids.length ? `You carry out: ${ids.map((id) => itemInfo(id)?.name ?? id).join(', ')}.` : none
}

/** Throws one thing out of the bag to make room. While a take-what-fits scene is open, something that came out of it goes back
    where it was (and can be taken again); anything else is left on the ground. */
function dropBagSlot(i: number) {
  const id = inventory.dropFromBag(i)
  if (!id) return
  sfx.play('put-item', 0.8)
  const name = itemInfo(id)?.name ?? id
  const p = pick.value
  if (!p) return
  const back = p.got.includes(id) ? p.orig.find((x) => appItemId(x) === id && !p.ids.includes(x)) : undefined
  if (back) {
    p.got.splice(p.got.indexOf(id), 1)
    p.ids.push(back)
    scene.msg({ untake: back })
    p.note = `You put ${name} back. It's there if you change your mind.`
  } else p.note = `You leave ${name} on the ground. There is room now.`
}

/** The car: 85% the trunk gives; 15% the alarm goes and one or two come for it. */
function tryTrunk() {
  if (alarm.value || pick.value || resultShown.value) return
  scene.listen(null)
  if (Math.random() < 0.85) {
    scene.enterDoor('trunk', () => startPick('trunk', 'The trunk', 'It gives with a clunk. Whoever owned this car packed for a trip they never took. Take what fits.'))
    return
  }
  alarm.value = Math.random() < 0.5 ? 2 : 1
  scene.msg({ alarm: true })
  sfx.bed('car-alarm', true, 0.7)
}

function choose(choice: Choice) {
  const t = tile.value
  switch (choice.action) {
    case 'combat':
      if (!t?.encounter?.length) return
      // The tile stays live until something actually resolves it — victory, or walking away.
      scene.hideNow()
      ui.startCombat()
      combat.start(t.encounter)
      return
    case 'search': {
      sfx.play('backpack_sound')
      const id = rollSearchLoot()
      const info = itemInfo(id)
      searchResult.value = { name: info?.name ?? id, icon: info?.icon ?? '❔', sprite: info?.sprite, stowed: inventory.addToBag(id) }
      return
    }
    case 'shop': {
      const f = shopFront.value
      const s = f && PICK_SHOPS[f]
      if (!f || !s) return
      board.searchShop()
      const go = () => startPick(f as LootKind, s[0], 'A shortcut through the back opens up: +2 moves. Take what fits in the bag.')
      const door = DOOR_OF[f]
      if (door) scene.enterDoor(door, go)
      else go()
      return
    }
    case 'water': {
      board.searchShop()
      const stowed = inventory.addToBag('water')
      if (stowed) sfx.play('item-pickup')
      const info = itemInfo('water')
      searchResult.value = { name: info?.name ?? 'Water', icon: info?.icon ?? '💧', sprite: info?.sprite, stowed }
      eventResult.value = 'A shortcut through the back opens up: +2 moves.'
      return
    }
    case 'trunk':
      tryTrunk()
      return
    case 'cache':
      startPick('trunk', 'The cache', 'Tins, a bandage roll, something wrapped in a plastic bag. Take what fits.')
      return
    case 'alarm-fight': {
      sfx.bed('car-alarm', false)
      const n = alarm.value ?? 1
      alarm.value = null
      scene.pendingTrunk.value = t
      scene.hideNow()
      ui.startCombat()
      combat.start(rollEncounter(n))
      return
    }
    case 'alarm-run':
      sfx.bed('car-alarm', false)
      alarm.value = null
      showText('You leave the car screaming behind you. The trunk is lost.')
      return
    case 'take':
      if (pick.value?.sel) take(pick.value.sel)
      return
    case 'trade':
      trading.value = true
      return
    case 'tip': {
      const street = trader.tip()
      showText(street
        ? `She leans in. "Somebody left a crate on ${street.replace(/\.$/, '')}. Don't tell anyone I told you." Your phone map marks the area.`
        : 'She shrugs. "Nothing worth your legs today."')
      return
    }
    case 'house-in': {
      // Through the door and into the dark: a walkable house (HouseScreen). Nothing happens until Juan finds something or bumps into it.
      if (!t) return
      scene.passDoor('nida', false, () => house.enter(t))
      return
    }
    case 'house-pry':
      board.unlockHouse()
      sfx.play('equip-sound')
      doorNote.value = 'The crowbar bites, and the frame gives without a sound.'
      return
    case 'house-kick':
      if (Math.random() < 0.55) {
        board.unlockHouse()
        sfx.play('equip-sound')
        doorNote.value = 'The door slams open. That was loud.'
      } else {
        player.raiseDread(3)
        doorNote.value = 'It holds. The sound carries down the street. Dread +3.'
      }
      return
    case 'look':
      sfx.play('put-item', 0.8)
      if (pick.value) { pick.value.sel = null; pick.value.hover = null }
      scene.msg({ glow: null })
      return
    case 'done':
      finishPick()
      return
    case 'claim':
      claimShelter()
      return
    case 'depart': {
      // The last door isn't free: the Brute holds the plaza. gate:true is how combat knows a
      // win here is THE win — and a loss here ends the run.
      const bruteSpec = ENEMY_TYPES.brute
      scene.hideNow()
      ui.startCombat()
      combat.start([{ archetype: bruteSpec.id, hp: bruteSpec.hp }], { gate: true })
      return
    }
  }
  if (choice.event && choice.eventChoiceIndex !== undefined) {
    resolveDilemma(choice.event, choice.eventChoiceIndex)
    return
  }
  if (t?.type === 'event' && choice.label === 'Listen') {
    // A tip: a supply cache somewhere near a street the voice names. The phone map marks the area with a ?.
    player.raiseHope(1)
    const c = board.addCache()
    showText(c
      ? `Through the static: "...supplies left for anyone on ${c.street}... repeat, ${c.street}..." Your phone map marks the area. Hope +1.`
      : 'You memorise the schedule. Hope +1.')
    return
  }
  scene.listen(null)
  board.dismissCard()
  scene.leave()
}

/** The dilemma's price leaves the bag; its consequence lands on the meters. */
function resolveDilemma(eventDef: EventDef, choiceIndex: number) {
  const choice = eventDef.choices[choiceIndex]
  if (!choice) return
  if (choice.requires && !inventory.hasInBag(choice.requires)) return
  if (choice.requires) inventory.removeFromBag(choice.requires)
  const outcome = choice.outcome
  if (outcome) {
    if (outcome.hope) player.raiseHope(outcome.hope)
    if (outcome.dreadRelief) player.relieveDread(outcome.dreadRelief)
    eventResult.value = outcome.text
  } else {
    eventResult.value = 'You keep walking. The fog closes behind you like it was never there.'
  }
}

/** A new home: the waypoint flips, the stash rides along, and Juan goes in through its door. */
function claimShelter() {
  const w = board.canClaimHere
  if (!w?.key) return
  const key = w.key
  heldTile.value = board.activeCard
  sfx.play('key-collect')
  board.claimShelter(w)
  ui.endOuting()
  const text = `${w.name} is home now. The streets around it are a new zone, and the old one is behind you.`
  scene.enterDoor(SHELTER_DOOR[key], () => { scene.show(key); showText(text) })
}

// The card stays up until the player has read what happened, then the tile resolves —
// so a search or dilemma is a one-shot, and coming back later finds it already done.
function moveOn() {
  if (board.activeCard && !keepTile.value) board.resolveEncounter()
  keepTile.value = false
  heldTile.value = null
  searchResult.value = null
  eventResult.value = null
  scene.leave()
}

onBeforeUnmount(() => sfx.bed('car-alarm', false))
</script>

<template>
  <div v-if="content && !sceneLive && !scene.door.shown && !house.open" class="fixed inset-0 z-[65]" style="background: rgba(0,0,0,.35)" @click="!resultShown && choose({ label: '' })" />
  <div
    class="fixed left-0 right-0 bottom-0 z-[70] rounded-t-2xl overflow-y-auto max-h-[60%] mx-auto"
    style="max-width: 440px; background: var(--panel2); border-top: 2px solid var(--sodium); box-shadow: 0 -20px 40px rgba(0,0,0,.5); transition: transform .25s cubic-bezier(.2,.7,.3,1)"
    :style="{ transform: content && !scene.door.shown && !house.open ? 'translateY(0)' : 'translateY(110%)' }"
  >
    <div v-if="content" class="px-[18px] pb-[18px]">
      <div class="w-10 h-1 rounded-full mx-auto mt-2.5 mb-2" style="background: #3a464b" />
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 rounded text-[9px] tracking-wide uppercase" style="font-family: var(--font-mono); color: #0e1214" :style="{ background: content.accent }">{{ content.label }}</span>
        <h3 class="uppercase text-xl" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px; color: var(--bone)">{{ content.title }}</h3>
      </div>
      <p v-if="!resultShown" class="text-[13px] leading-relaxed my-2.5" style="color: #cdc6b8">{{ content.flavor }}</p>

      <!-- Outcome: what was taken, a dilemma's result, or a claimed shelter — read, then move on -->
      <div v-if="resultShown" class="flex flex-col gap-2 mt-2.5">
        <div class="flex items-center gap-3 p-3 rounded-md" style="background: var(--panel3); border: 1px solid var(--line)">
          <img v-if="searchResult?.sprite" :src="searchResult.sprite" alt="" class="w-10 h-10" style="image-rendering: pixelated; object-fit: contain">
          <span v-else-if="searchResult" class="text-[26px] leading-none">{{ searchResult.icon }}</span>
          <span class="flex-1">
            <span v-if="searchResult" class="block text-[13px]" style="color: var(--bone)">Found: {{ searchResult.name }}</span>
            <span v-if="searchResult" class="block text-[11px]" style="color: var(--muted)">{{ searchResult.stowed ? 'Into the bag it goes.' : 'No room in the bag — you leave it behind.' }}</span>
            <span v-if="eventResult" class="block text-[13px] leading-relaxed" style="color: var(--bone)">{{ eventResult }}</span>
          </span>
        </div>
        <button
          class="py-3 px-3.5 rounded-md text-left text-[13px] flex justify-between items-center gap-2.5"
          style="background: var(--sodium); border: 1px solid var(--sodium); color: #0e1214; font-weight: 600"
          @click="moveOn"
        >
          <span>Continue</span>
          <span class="text-xs" style="font-family: var(--font-mono); color: #5a3d12">→</span>
        </button>
      </div>

      <TraderPanel v-else-if="trading && atStall" @done="trading = false" />

      <div v-else class="flex flex-col gap-2">
        <button
          v-for="choice in content.choices"
          :key="choice.label"
          class="py-3 px-3.5 rounded-md text-left text-[13px] flex justify-between items-center gap-2.5"
          :style="choice.primary
            ? { background: 'var(--sodium)', border: '1px solid var(--sodium)', color: '#0e1214', fontWeight: 600 }
            : { background: 'var(--panel3)', border: choice.risky ? '1px solid rgba(217,75,59,.45)' : '1px solid var(--line)', color: 'var(--bone)' }"
          @click="choose(choice)"
        >
          <span>{{ choice.label }}</span>
          <span class="text-xs" style="font-family: var(--font-mono)" :style="{ color: choice.primary ? '#5a3d12' : (choice.risky ? 'var(--sari-red)' : 'var(--muted)') }">{{ choice.action === 'combat' || choice.action === 'alarm-fight' || choice.action === 'depart' ? '⚔' : '→' }}</span>
        </button>
      </div>

      <!-- Taking things: the bag, with a way to drop something to make room -->
      <div v-if="!resultShown && pick" class="mt-3">
        <div class="text-[10px] tracking-[2px] mb-1.5" style="font-family: var(--font-mono); color: var(--muted)">YOUR BAG {{ inventory.bagCount }} / {{ inventory.bag.length }} · TAP ONE TO DROP IT</div>
        <div class="px-grid">
          <button
            v-for="(slot, i) in inventory.bag"
            :key="i"
            class="px-cell"
            :disabled="!slot"
            :aria-label="slot ? `${pick?.got.includes(slot.id) ? 'Put back' : 'Drop'} ${itemInfo(slot.id)?.name ?? slot.id}` : 'Empty slot'"
            @click="dropBagSlot(i)"
          >
            <img v-if="slot && itemInfo(slot.id)?.sprite" :src="itemInfo(slot.id)!.sprite" alt="">
            <span v-else-if="slot" class="emoji">{{ itemInfo(slot.id)?.icon ?? '❔' }}</span>
            <span v-if="slot && slot.qty > 1" class="qty">×{{ slot.qty }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
