<script setup lang="ts">
import { ENEMY_TYPES, rollSearchLoot } from '~/data/combat'
import { EVENTS, type EventDef } from '~/data/events'
import { itemInfo } from '~/data/equipment'
import type { TileType } from '~/stores/board'

const board = useBoardStore()
const ui = useUiStore()
const combat = useCombatStore()
const inventory = useInventoryStore()
const player = usePlayerStore()

interface Choice { label: string; primary?: boolean; risky?: boolean; action?: 'combat' | 'search' | 'claim' | 'depart'; event?: EventDef; eventChoiceIndex?: number }
interface CardDef { label: string; title: string; flavor: string; accent: string; icon: string; choices: Choice[] }

// The radio card is the fallback for event tiles without a dilemma — SIGNAL stays human
// even when the item-based events aren't the roll.
const RADIO_CARD: CardDef = {
  label: 'SIGNAL', title: 'A Voice on the Radio', accent: '#2E86AB', icon: '📡',
  flavor: "Static, then a voice — faint, human, asking if anyone's still out there. It cuts out before you can answer.",
  choices: [{ label: 'Call back into the static', primary: true }, { label: 'Let it go' }],
}

const STATIC_CARDS: Record<'location' | 'zombie', CardDef> = {
  location: {
    label: 'SUPPLY CACHE', title: 'Shuttered Bakery', accent: '#F0A63C', icon: '🎒',
    flavor: 'Flour dust and an overturned display case. Someone already broke the lock — but they left in a hurry.',
    choices: [
      { label: 'Search the back counter', primary: true, action: 'search' },
      { label: 'Not worth it — move on' },
    ],
  },
  zombie: {
    label: 'MOVEMENT', title: "Something's Moving", accent: '#D94B3B', icon: '💀',
    flavor: 'A shape shifts behind a fogged-out window across the street. Could be nothing. Could be exactly what you think.',
    choices: [{ label: 'Investigate', primary: true, risky: true, action: 'combat' }, { label: 'Back away quietly' }],
  },
}

/** The card this tile is offering, resolved fresh so claiming a shelter flips it live. */
const content = computed<CardDef | null>(() => {
  const tile = board.activeCard
  if (!tile) return null

  if (board.canClaimHere) {
    return {
      label: 'SHELTER', title: board.canClaimHere.name, accent: '#F0A63C', icon: '🏠',
      flavor: 'Walls. A door that shuts. Whoever kept this place left in a hurry, but the roof kept. This could be home — a new one, closer to Tutuban than the last.',
      choices: [
        { label: 'Claim it as shelter', primary: true, action: 'claim' },
        { label: 'Not yet — keep what you have' },
      ],
    }
  }

  if (board.atTutuban) {
    return {
      label: 'THE WAY OUT', title: 'Tutuban Station', accent: '#F0A63C', icon: '🚉',
      flavor: "The yard is silent and the trains aren't coming — but the tracks run north, out of the fog, all the way home. This is it. This is the way out.",
      choices: [{ label: 'Make for the tracks', primary: true, action: 'depart' }],
    }
  }

  if (tile.type === 'event') {
    const eventDef = tile.eventId ? EVENTS.find((e) => e.id === tile.eventId) : undefined
    if (eventDef) {
      return {
        label: 'ENCOUNTER', title: eventDef.title, accent: eventDef.accent, icon: eventDef.icon,
        flavor: eventDef.flavor,
        choices: eventDef.choices.map((choice, index) => ({
          label: choice.requires && !inventory.hasInBag(choice.requires)
            ? `${choice.label} — none left`
            : choice.label,
          primary: index === 0,
          risky: (choice.outcome?.hope ?? 0) < 0 || index === eventDef.choices.length - 1 && !choice.outcome,
          event: eventDef,
          eventChoiceIndex: index,
        })),
      }
    }
    return RADIO_CARD
  }

  if (tile.type === 'shelter') {
    return {
      label: 'SHELTER', title: board.shelterName, accent: '#F0A63C', icon: '🏠',
      flavor: board.shelterFlavor,
      choices: [{ label: 'Rest easy' }],
    }
  }

  if (tile.type === 'nothing' || tile.type === 'landmark') return null
  return STATIC_CARDS[tile.type]
})

// What the search turned up, held on screen until the player acknowledges it. Loot you
// never saw isn't loot.
interface SearchResult { name: string; icon: string; stowed: boolean }
const searchResult = ref<SearchResult | null>(null)

// What a dilemma choice just did, held until acknowledged like a search result.
const eventResult = ref<string | null>(null)

// A different tile is a different card — never carry the last outcome into it.
watch(
  () => board.activeCard,
  () => {
    searchResult.value = null
    eventResult.value = null
  },
)

function choose(choice: Choice) {
  if (choice.action === 'combat') {
    const tile = board.activeCard
    if (!tile?.encounter?.length) return
    // Deliberately not dismissing the card here: the tile is the source of truth for the
    // encounter, and it stays live until something actually resolves it — victory, or
    // walking away and coming back later.
    ui.startCombat()
    combat.start(tile.encounter)
    return
  }
  if (choice.action === 'search') {
    searchTheRoom()
    return
  }
  if (choice.action === 'claim') {
    claimShelter()
    return
  }
  if (choice.action === 'depart') {
    // The last door isn't free: a Brute holds the yard, and the fight that follows owns
    // the ending. gate:true is how combat knows a win here is THE win — ui.won fires
    // from its exitFight — and a loss here is the run's end, which is exactly what
    // makes the last hundred tiles mean something.
    const bruteSpec = ENEMY_TYPES.brute
    ui.startCombat()
    combat.start([{ archetype: bruteSpec.id, hp: bruteSpec.hp }], { gate: true })
    return
  }
  if (choice.event && choice.eventChoiceIndex !== undefined) {
    resolveDilemma(choice.event, choice.eventChoiceIndex)
    return
  }
  board.dismissCard()
}

/** One item per search, always something — consumable or gear. */
function searchTheRoom() {
  const id = rollSearchLoot()
  const info = itemInfo(id)
  searchResult.value = {
    name: info?.name ?? id,
    icon: info?.icon ?? '❔',
    stowed: inventory.addToBag(id),
  }
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

/** A new home: the waypoint flips, the sign changes, the stash rides along — and
 * Juan is standing inside walls again, so the home tabs come back. */
function claimShelter() {
  if (!board.canClaimHere) return
  board.claimShelter(board.canClaimHere)
  ui.endOuting()
  eventResult.value = `${board.shelterName} is home now. The old shelter is just another building in the fog — everything that matters is with you.`
}

// The card stays up until the player has read what happened, then the tile resolves —
// so a search or dilemma is a one-shot, and coming back later finds it already done.
function moveOn() {
  board.resolveEncounter()
}
</script>

<template>
  <div v-if="content" class="fixed inset-0 z-[65]" style="background: rgba(0,0,0,.5)" @click="board.dismissCard()" />
  <div
    class="fixed left-0 right-0 bottom-0 z-[70] rounded-t-2xl overflow-y-auto max-h-[90%]"
    style="background: var(--panel2); border-top: 2px solid var(--sodium); box-shadow: 0 -20px 40px rgba(0,0,0,.5); transition: transform .25s cubic-bezier(.2,.7,.3,1)"
    :style="{ transform: content ? 'translateY(0)' : 'translateY(110%)' }"
  >
    <div v-if="content" class="px-[18px] pb-[22px]">
      <div class="w-10 h-1 rounded-full mx-auto mt-2.5 mb-1" style="background: #3a464b" />

      <div class="h-[70px] rounded-lg flex items-center justify-center relative my-2.5" :style="{ background: content.accent + '22', border: `1px solid ${content.accent}` }">
        <span class="text-[32px]">{{ content.icon }}</span>
        <div class="absolute left-2.5 bottom-1.5 px-2 py-0.5 rounded text-[9px] tracking-wide uppercase" style="font-family: var(--font-mono); color: var(--bone); background: rgba(8,11,12,.6)">{{ content.label }}</div>
      </div>

      <h3 class="uppercase text-xl" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1px">{{ content.title }}</h3>
      <p class="text-[13px] leading-relaxed my-2.5" style="color: #cdc6b8">{{ content.flavor }}</p>

      <!-- Outcome: search find, dilemma result, or a claimed shelter — read, then move on -->
      <div v-if="searchResult || eventResult" class="flex flex-col gap-2">
        <div class="flex items-center gap-3 p-3 rounded-md" style="background: var(--panel3); border: 1px solid var(--line)">
          <span v-if="searchResult" class="text-[26px] leading-none">{{ searchResult.icon }}</span>
          <span class="flex-1">
            <span v-if="searchResult" class="block text-[13px]" style="color: var(--bone)">Found: {{ searchResult.name }}</span>
            <span v-if="searchResult" class="block text-[11px]" style="color: var(--muted)">{{ searchResult.stowed ? 'Into the bag it goes.' : 'No room in the bag — you leave it on the counter.' }}</span>
            <span v-if="eventResult" class="block text-[13px] leading-relaxed" style="color: var(--bone)">{{ eventResult }}</span>
          </span>
        </div>
        <button
          class="py-3 px-3.5 rounded-md text-left text-[13px] flex justify-between items-center gap-2.5"
          style="background: var(--sodium); border: 1px solid var(--sodium); color: #0e1214; font-weight: 600"
          @click="moveOn"
        >
          <span>Move on</span>
          <span class="text-xs" style="font-family: var(--font-mono); color: #5a3d12">→</span>
        </button>
      </div>

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
          <span class="text-xs" style="font-family: var(--font-mono)" :style="{ color: choice.primary ? '#5a3d12' : (choice.risky ? 'var(--sari-red)' : 'var(--muted)') }">{{ choice.action === 'combat' ? '⚔' : (choice.action === 'search' ? '🔍' : choice.action === 'claim' || choice.action === 'depart' ? '→' : '→') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
