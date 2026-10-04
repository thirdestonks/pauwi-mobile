// The run's save file. One JSON blob under 'pauwi:save' holding every store's persistent
// state. Design rules:
//   - Saves happen at REST, never mid-fight: returning to shelter, eating/sleeping,
//     claiming a shelter, a fight ending, and app background. No save-scumming out of a
//     bad swing, no half-resolved beats in the blob.
//   - Death and victory both wipe the blob — the demo is a roguelike run, not a checkpoint.
//   - Export/Import turn the blob into a portable PAUWI1-... string with a checksum, so a
//     corrupted or cross-version paste fails loudly instead of half-restoring a run.
//   - Victories are counted separately ('pauwi:wins') — the one thing death can't take.

export const SAVE_KEY = 'pauwi:save'
export const WINS_KEY = 'pauwi:wins'
export const SAVE_VERSION = 1

import { useBoardStore } from '~/stores/board'
import { useCombatStore } from '~/stores/combat'
import { useInventoryStore } from '~/stores/inventory'
import { usePlayerStore } from '~/stores/player'
import { useUiStore } from '~/stores/ui'

// Each store's snapshot shape, inferred straight from the store — the blob can't
// silently drift from what hydrate() expects.
type PlayerSnapshot = ReturnType<ReturnType<typeof usePlayerStore>['snapshot']>
type InventorySnapshot = ReturnType<ReturnType<typeof useInventoryStore>['snapshot']>
type BoardSnapshot = ReturnType<ReturnType<typeof useBoardStore>['snapshot']>
type UiSnapshot = ReturnType<ReturnType<typeof useUiStore>['snapshot']>

export interface SaveBlob {
  version: number
  savedAt: number
  player: PlayerSnapshot
  inventory: InventorySnapshot
  board: BoardSnapshot
  ui: UiSnapshot
  stats: { enemiesDefeated: number }
}

// --- Persistence (localStorage here; Capacitor Preferences is the phone backend) -------

export function loadRawSave(): SaveBlob | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SaveBlob
    return parsed?.version === SAVE_VERSION ? parsed : null
  } catch {
    return null
  }
}

export function persistRawSave(blob: SaveBlob): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob))
    return true
  } catch {
    return false
  }
}

export function clearRawSave() {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* storage unavailable — nothing to wipe */
  }
}

export function addWin(): number {
  try {
    const next = (Number(localStorage.getItem(WINS_KEY)) || 0) + 1
    localStorage.setItem(WINS_KEY, String(next))
    return next
  } catch {
    return 1
  }
}

export function readWins(): number {
  try {
    return Number(localStorage.getItem(WINS_KEY)) || 0
  } catch {
    return 0
  }
}

// --- Snapshot / restore ----------------------------------------------------------------
// Each store exposes snapshot()/hydrate(state) for exactly the fields that carry between
// sessions. Combat is deliberately absent: fights resolve or the run continues without one.

export function snapshotRun(): SaveBlob {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const board = useBoardStore()
  const ui = useUiStore()
  const combat = useCombatStore()

  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    player: player.snapshot(),
    inventory: inventory.snapshot(),
    board: board.snapshot(),
    ui: ui.snapshot(),
    stats: { enemiesDefeated: combat.enemiesDefeated },
  }
}

export function hydrateRun(blob: SaveBlob) {
  usePlayerStore().hydrate(blob.player)
  useInventoryStore().hydrate(blob.inventory)
  useBoardStore().hydrate(blob.board)
  useUiStore().hydrate(blob.ui)
  if (typeof blob.stats?.enemiesDefeated === 'number') {
    useCombatStore().enemiesDefeated = blob.stats.enemiesDefeated
  }
}

/** Saves the current moment. No-ops mid-fight, on the title screen, or while the death screen owns the app. */
export function saveRunNow() {
  const ui = useUiStore()
  // No run, no save: nothing before BEGIN should leave a phantom Day 1 blob behind.
  if (!ui.prologueDone || ui.combatActive || ui.won) return
  if (usePlayerStore().dead) return
  persistRawSave(snapshotRun())
}

// --- Export / Import -------------------------------------------------------------------

const EXPORT_PREFIX = 'PAUWI1-'

function checksum(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

/** Run → 'PAUWI1-<base64json>.<checksum>' for the clipboard. */
export function exportSave(): string {
  const json = JSON.stringify(snapshotRun())
  const base64 = btoa(encodeURIComponent(json))
  return `${EXPORT_PREFIX}${base64}.${checksum(base64)}`
}

/** Parses + validates a pasted code; restores the run when it's sound. Throws on garbage. */
export function importSave(code: string): SaveBlob {
  const cleaned = code.trim().replace(/\s+/g, '')
  if (!cleaned.startsWith(EXPORT_PREFIX)) {
    throw new Error("That's not a PAUWI save code — it should start with PAUWI1-")
  }
  const body = cleaned.slice(EXPORT_PREFIX.length)
  const dot = body.lastIndexOf('.')
  if (dot === -1) throw new Error('Save code is truncated — copy the whole string.')
  const base64 = body.slice(0, dot)
  const sum = body.slice(dot + 1)
  if (checksum(base64) !== sum) throw new Error('Save code is damaged — the checksum failed.')
  let json: string
  try {
    json = decodeURIComponent(atob(base64))
  } catch {
    throw new Error('Save code is unreadable — the data section is corrupted.')
  }
  let blob: SaveBlob
  try {
    blob = JSON.parse(json) as SaveBlob
  } catch {
    throw new Error('Save code is unreadable — the data section is corrupted.')
  }
  if (blob?.version !== SAVE_VERSION || typeof blob.player !== 'object' || typeof blob.board !== 'object') {
    throw new Error('Save code is from a different version of PAUWI.')
  }
  persistRawSave(blob)
  return blob
}
