// The screen flash and shake when Juan takes a hit. Shared by both combat screens (CombatScreen, InteriorCombatScreen).
export function useHitFeedback() {
  const player = usePlayerStore()
  const { settings } = useSettings()
  const flash = ref(0)
  const shakeX = ref(0)
  watch(() => player.health, (now, before) => {
    if (now >= before) return
    flash.value = 1; shakeX.value = settings.shake ? 5 : 0
    setTimeout(() => { flash.value = 0; shakeX.value = 0 }, 160)
  })
  return { flash, shakeX }
}
