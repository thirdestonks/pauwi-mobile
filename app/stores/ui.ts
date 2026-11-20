import { defineStore } from 'pinia'
import { saveRunNow } from '~/utils/save'
import { useBoardStore } from './board'
import { useCombatStore } from './combat'
import { useHouseStore } from './house'
import { useInventoryStore } from './inventory'
import { usePlayerStore } from './player'
import { useTraderStore } from './trader'

export type ScreenTab = 'shelter' | 'map' | 'combat' | 'pack' | 'gear' | 'bag'

// 'moves' — moveBudget hit 0 and the player is being sent back.
// 'voluntary' — player chose "Head back to shelter" with moves still left.
export type ShelterTransitionReason = 'moves' | 'voluntary'

export const useUiStore = defineStore('ui', () => {
  const activeTab = ref<ScreenTab>('shelter')
  const prologueDone = ref(false)
  const combatActive = ref(false)
  const shelterTransition = ref<ShelterTransitionReason | null>(null)
  /** Set the moment Juan steps onto Tutuban and takes the way out. */
  const won = ref(false)
  /**
   * Out in the field = the Shelter tab is gone until he's back inside walls. The tab bar
   * reads this (plus actual position) so there's no free teleport home from the fog.
   */
  const outInField = ref(false)

  /** Packing done, bag on shoulder — from here the tab bar offers Map and Bag, not Shelter. */
  /** Where the outing started from, so the walk home can say what it came to. */
  const outingStart = ref<{ health: number; dread: number; tiles: number; moves: number; bag: string[] } | null>(null)

  function headOut() {
    outInField.value = true
    const player = usePlayerStore(), board = useBoardStore(), inventory = useInventoryStore()
    inventory.rememberPack()
    outingStart.value = {
      health: player.health, dread: player.dread, tiles: board.tilesCleared, moves: board.moveBudget,
      bag: [...inventory.units],
    }
  }

  /** Back inside walls (returned, or claimed a new shelter mid-run). */
  function endOuting() {
    outInField.value = false
  }

  function setTab(tab: ScreenTab) {
    activeTab.value = tab
    if (tab !== 'combat') combatActive.value = false
    // Heading back out clears the previous night's Dread report — it belongs to the
    // shelter visit you just read it in, not to every screen from here on.
    if (tab === 'map') usePlayerStore().clearShelterReport()
  }

  // Combat isn't a place you navigate to — it's triggered by stepping into a zombie
  // encounter. While it's active the tab bar is hidden, so a fight can only end by
  // winning, retreating, or dying.
  function startCombat() {
    combatActive.value = true
    activeTab.value = 'combat'
  }

  /** The fight has concluded (any outcome) and its screen no longer owns the app. */
  function endCombat() {
    combatActive.value = false
  }

  function finishPrologue() {
    prologueDone.value = true
  }

  // Shows the Out of Moves / Returning to Shelter tap-through screen before the phase actually ends.
  function requestShelterReturn(reason: ShelterTransitionReason) {
    shelterTransition.value = reason
  }

  // Called when the player taps Continue on that screen — this is what actually ends the phase.
  function confirmShelterReturn() {
    const board = useBoardStore()
    const nightOut = board.phase === 'night'
    board.retreatToShelter()
    // Back at dawn from a night out: the night still passed, and its Dread with it (8 drains,
    // 1 Hope per 10 lost). From a day out Dread just comes home with Juan and waits for the night.
    if (nightOut) usePlayerStore().passNight()
    shelterTransition.value = null
    endOuting()
    setTab('shelter')
    // Home again is rest — this is the save point for everything that happened out there.
    saveRunNow()
  }

  /** Demo complete — Juan made it to Tutuban. The win screen covers the app. */
  function winDemo() {
    won.value = true
  }

  /** Death restart — the run's stores reset themselves; this just puts the UI back at the shelter. */
  function resetUi() {
    combatActive.value = false
    shelterTransition.value = null
    won.value = false
    outInField.value = false
    useHouseStore().reset()
    activeTab.value = 'shelter'
  }

  /**
   * Full restart from the death or win screen: every store back on its feet, prologue
   * replayed so a fresh player (or a fresh demo) gets the whole walkthrough again.
   */
  function restartRun() {
    useCombatStore().reset()
    usePlayerStore().resetRun()
    useInventoryStore().resetRun()
    useBoardStore().startRun()
    useTraderStore().resetRun()
    resetUi()
    prologueDone.value = false
  }

  // --- Save persistence -----------------------------------------------------------------
  // Only what carries: which screen Juan was parked on, whether the prologue is done,
  // and whether he's out in the field. won/combatActive/shelterTransition are transient
  // states owned by the live app, never restored — and a save can't be parked on the
  // combat tab anyway, because saves only happen at rest.
  function snapshot() {
    return {
      activeTab: activeTab.value === 'combat' ? 'map' : activeTab.value,
      prologueDone: prologueDone.value,
      outInField: outInField.value,
    }
  }

  function hydrate(state: ReturnType<typeof snapshot>) {
    activeTab.value = state.activeTab
    prologueDone.value = true // the player has seen it — a continue never replays it
    combatActive.value = false
    shelterTransition.value = null
    won.value = false
    outInField.value = state.outInField
  }

  return {
    activeTab,
    prologueDone,
    combatActive,
    shelterTransition,
    won,
    outInField,
    setTab,
    startCombat,
    endCombat,
    finishPrologue,
    requestShelterReturn,
    confirmShelterReturn,
    winDemo,
    headOut,
    outingStart,
    endOuting,
    resetUi,
    restartRun,
    snapshot,
    hydrate,
  }
})
