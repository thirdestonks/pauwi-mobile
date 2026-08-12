import { defineStore } from 'pinia'

export type ScreenTab = 'shelter' | 'map' | 'combat'

export const useUiStore = defineStore('ui', () => {
  const activeTab = ref<ScreenTab>('shelter')
  const prologueDone = ref(false)

  function setTab(tab: ScreenTab) {
    activeTab.value = tab
  }

  function finishPrologue() {
    prologueDone.value = true
  }

  return { activeTab, prologueDone, setTab, finishPrologue }
})
