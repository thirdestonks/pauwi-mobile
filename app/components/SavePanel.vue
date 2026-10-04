<script setup lang="ts">
import {
  clearRawSave,
  exportSave,
  hydrateRun,
  importSave,
  readWins,
  SAVE_VERSION,
} from '~/utils/save'

// The run's filing cabinet: copy the save out as a PAUWI1- code, paste one back in,
// or burn the run and start over. Lives at the bottom of the Shelter screen.
const code = ref('')
const feedback = ref<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null)
const wins = ref(0)
const wipeArmed = ref(false)
const copied = ref(false)

onMounted(() => {
  wins.value = readWins()
})

function copyCode() {
  const text = exportSave()
  code.value = ''
  feedback.value = {
    tone: 'info',
    text: `Save code built (${text.length} characters). It holds everything: Juan, the stash, the map, the route.`,
  }
  navigator.clipboard
    ?.writeText(text)
    .then(() => {
      copied.value = true
      setTimeout(() => (copied.value = false), 2500)
    })
    .catch(() => {
      // Clipboard refused (unfocused window, older webview): drop the code in the box
      // so the player can long-press and copy it by hand.
      code.value = text
      feedback.value = {
        tone: 'info',
        text: 'Automatic copy failed — the code is in the box below. Select it and copy by hand.',
      }
    })
}

function restoreCode() {
  try {
    const blob = importSave(code.value)
    hydrateRun(blob)
    useUiStore().finishPrologue()
    feedback.value = { tone: 'ok', text: 'Run restored. Juan is back where the save left him.' }
    code.value = ''
  } catch (error) {
    feedback.value = { tone: 'bad', text: error instanceof Error ? error.message : 'That code would not load.' }
  }
}

function wipeRun() {
  if (!wipeArmed.value) {
    wipeArmed.value = true
    return
  }
  clearRawSave()
  wipeArmed.value = false
  feedback.value = { tone: 'info', text: 'Save wiped. Starting over from Day 01 at Nida\'s.' }
  useUiStore().restartRun()
}
</script>

<template>
  <div class="m-4 mt-2 p-3.5 rounded-sm" style="background: var(--panel); border: 1px dashed var(--line)">
    <div class="flex items-center justify-between mb-2.5">
      <div class="uppercase text-sm" style="font-family: var(--font-display); font-weight: 700; letter-spacing: 1.5px">The Run, On Paper</div>
      <div class="text-[9px]" style="font-family: var(--font-mono); color: var(--muted)">SAVE v{{ SAVE_VERSION }}</div>
    </div>

    <p class="text-[11px] leading-relaxed mb-3" style="color: var(--muted)">
      The game saves itself at rest — back at the shelter, after a fight. Death and reaching
      Tutuban both end the run for good. This box is for carrying a run between phones, or
      keeping one alive past a bad webview wipe.
    </p>

    <div class="flex flex-col gap-2">
      <button
        class="py-2.5 px-3 rounded-sm flex items-center justify-between text-left"
        style="background: var(--panel2); border: 1px solid var(--line)"
        @click="copyCode"
      >
        <span>
          <span class="block uppercase text-[12px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">{{ copied ? 'Copied ✓' : 'Copy save code' }}</span>
          <span class="block text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">the whole run, as one pasteable string</span>
        </span>
        <span style="font-family: var(--font-mono); color: var(--sodium); font-size: 11px">⇧ out</span>
      </button>

      <div class="py-2.5 px-3 rounded-sm" style="background: var(--panel2); border: 1px solid var(--line)">
        <div class="uppercase text-[12px]" style="font-family: var(--font-display); font-weight: 700; letter-spacing: .5px">Restore a run</div>
        <div class="text-[10px] mb-2" style="font-family: var(--font-mono); color: var(--muted)">paste a PAUWI1- code below</div>
        <textarea
          v-model="code"
          rows="3"
          spellcheck="false"
          class="w-full p-2 rounded-sm text-[10px] leading-relaxed"
          style="background: var(--panel); border: 1px solid var(--line); font-family: var(--font-mono); color: var(--bone); resize: vertical; word-break: break-all"
          placeholder="PAUWI1-…"
        />
        <button
          class="mt-2 py-2 w-full rounded-sm uppercase text-[11px]"
          style="background: var(--panel3); border: 1px solid var(--line); font-family: var(--font-display); font-weight: 700; letter-spacing: 1px; color: var(--bone)"
          @click="restoreCode"
        >
          Restore this run →
        </button>
      </div>

      <div class="flex items-center justify-between py-2 px-3 rounded-sm" style="background: var(--panel2); border: 1px solid var(--line)">
        <span class="text-[10px]" style="font-family: var(--font-mono); color: var(--muted)">runs that made it home: <b style="color: var(--sari-blue)">{{ wins }}</b></span>
        <button
          class="px-2.5 py-1.5 rounded-sm uppercase text-[10px]"
          :style="wipeArmed
            ? { background: 'var(--sari-red)', border: '1px solid var(--sari-red)', color: '#1a0a08', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '1px' }
            : { background: 'transparent', border: '1px solid rgba(217,75,59,.45)', color: 'var(--sari-red)', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '1px' }"
          @click="wipeRun"
        >
          {{ wipeArmed ? 'Sure? Tap again' : 'Wipe save' }}
        </button>
      </div>
    </div>

    <p
      v-if="feedback"
      class="mt-2.5 text-[11px] leading-relaxed"
      :style="{ fontFamily: 'var(--font-mono)', color: feedback.tone === 'ok' ? 'var(--green)' : feedback.tone === 'bad' ? 'var(--sari-red)' : 'var(--muted)' }"
    >
      {{ feedback.text }}
    </p>
  </div>
</template>
