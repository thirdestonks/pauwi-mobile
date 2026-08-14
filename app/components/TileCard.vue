<script setup lang="ts">
import type { TileType } from '~/stores/board'

const board = useBoardStore()
const ui = useUiStore()

interface Choice { label: string; primary?: boolean; risky?: boolean; action?: 'combat' }
interface CardDef { label: string; title: string; flavor: string; accent: string; icon: string; choices: Choice[] }

const CARD_CONTENT: Record<Exclude<TileType, 'nothing'>, CardDef> = {
  location: {
    label: 'SUPPLY CACHE', title: 'Shuttered Bakery', accent: '#F0A63C', icon: '🎒',
    flavor: 'Flour dust and an overturned display case. Someone already broke the lock — but they left in a hurry.',
    choices: [{ label: 'Search the back counter', primary: true }, { label: 'Not worth it — move on' }],
  },
  zombie: {
    label: 'MOVEMENT', title: "Something's Moving", accent: '#D94B3B', icon: '💀',
    flavor: 'A shape shifts behind a fogged-out window across the street. Could be nothing. Could be exactly what you think.',
    choices: [{ label: 'Investigate', primary: true, risky: true, action: 'combat' }, { label: 'Back away quietly' }],
  },
  event: {
    label: 'SIGNAL', title: 'A Voice on the Radio', accent: '#2E86AB', icon: '📡',
    flavor: "Static, then a voice — faint, human, asking if anyone's still out there. It cuts out before you can answer.",
    choices: [{ label: 'Call back into the static', primary: true }, { label: 'Let it go' }],
  },
}

const content = computed(() => {
  const tile = board.activeCard
  if (!tile || tile.type === 'nothing') return null
  return CARD_CONTENT[tile.type]
})

function choose(choice: Choice) {
  board.dismissCard()
  if (choice.action === 'combat') ui.startCombat()
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

      <div class="flex flex-col gap-2">
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
          <span class="text-xs" style="font-family: var(--font-mono)" :style="{ color: choice.primary ? '#5a3d12' : (choice.risky ? 'var(--sari-red)' : 'var(--muted)') }">{{ choice.action === 'combat' ? '⚔' : '→' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
