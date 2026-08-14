import { defineStore } from 'pinia'
import { useBoardStore } from './board'

export type ScreenTab = 'shelter' | 'map' | 'combat' | 'pack'

// 'moves' — moveBudget hit 0 and the player is being sent back.
// 'voluntary' — player chose "Head back to shelter" with moves still left.
export type ShelterTransitionReason = 'moves' | 'voluntary'

export const useUiStore = defineStore('ui', () => {
  const activeTab = ref<ScreenTab>('shelter')
  const prologueDone = ref(false)
  const combatActive = ref(false)
  const shelterTransition = ref<ShelterTransitionReason | null>(null)

  function setTab(tab: ScreenTab) {
    activeTab.value = tab
    if (tab !== 'combat') combatActive.value = false
  }

  // Combat isn't a place you navigate to — it's triggered by stepping into a zombie encounter.
  function startCombat() {
    combatActive.value = true
    activeTab.value = 'combat'
  }

  function finishPrologue() {
    prologueDone.value = true
  }

  // Shows the Out of Moves / Returning to Shelter tap-through screen before the cycle actually ends.
  function requestShelterReturn(reason: ShelterTransitionReason) {
    shelterTransition.value = reason
  }

  // Called when the player taps Continue on that screen — this is what actually ends the cycle.
  function confirmShelterReturn() {
    useBoardStore().retreatToShelter()
    shelterTransition.value = null
    setTab('shelter')
  }

  return {
    activeTab,
    prologueDone,
    combatActive,
    shelterTransition,
    setTab,
    startCombat,
    finishPrologue,
    requestShelterReturn,
    confirmShelterReturn,
  }
})
