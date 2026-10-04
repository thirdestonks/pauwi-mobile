import { saveRunNow } from '~/utils/save'

// Autosave at rest. The run's save points are explicit (shelter return, eat, sleep,
// claim, a finished fight) — this adds the one implicit one: the app itself going away.
// Android's webview can throw localStorage away without warning, so losing the process
// without a save is the one death the run can't come back from.
//
// (Store-of-record future work: mirror the blob into Capacitor Preferences on phone so a
// webview wipe can't take the run with it. Note only, per the approved design.)
export default defineNuxtPlugin(() => {
  const saveIfAtRest = () => saveRunNow()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveIfAtRest()
  })
  window.addEventListener('pagehide', saveIfAtRest)
})
