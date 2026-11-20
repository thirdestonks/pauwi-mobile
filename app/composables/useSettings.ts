// The player's comfort settings: sound, screen shake, vibration. Per phone, in localStorage
// (a convenience, not run state — it isn't part of the save). Every read/write is guarded:
// a webview with storage blocked just keeps the defaults.
import { useSfx } from './useSfx'

const KEY = 'pauwi:settings'
const settings = reactive({ sound: true, shake: true, haptics: true, lefty: false, fastFights: false })
let loaded = false

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (saved && typeof saved === 'object') Object.assign(settings, saved)
  } catch { /* defaults it is */ }
  useSfx().mute(!settings.sound)
  watch(settings, () => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* not saved, still applied */ }
    useSfx().mute(!settings.sound)
  })
}

/** A short buzz on phones that can (Android webviews can; iOS ignores it). */
function buzz(ms: number | number[] = 30) {
  if (!settings.haptics || typeof navigator === 'undefined' || !navigator.vibrate) return
  try { navigator.vibrate(ms) } catch { /* no vibration motor, no matter */ }
}

export function useSettings() {
  load()
  return { settings, buzz }
}
