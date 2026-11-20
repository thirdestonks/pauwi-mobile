<script setup lang="ts">
// Trading at Aling Cora's stall, inside the tile card (flat sari-sari signage like the rest of the card). Barter on a tab:
// Juan hands things over (picked from his bag, then confirmed) and they go onto his credit; he takes things off her table
// with it. The one thing she is looking for today pays double. Every trade builds his standing with her (stores/trader.ts).
import { itemInfo } from '~/data/equipment'
import { SUKI_RANKS, tradeValue } from '~/data/trade'

const emit = defineEmits<{ done: [] }>()
const trader = useTraderStore()
const inventory = useInventoryStore()
const sfx = useSfx()

const note = ref('')
/** The bag slot Juan is about to hand over: a second tap (the button) confirms. */
const offering = ref<number | null>(null)
const offerId = computed(() => (offering.value === null ? null : inventory.bag[offering.value]?.id ?? null))

const progress = computed(() => {
  const next = trader.nextRank
  if (!next) return 1
  const from = trader.rank.at
  return Math.min(1, (trader.points - from) / (next.at - from))
})
const requestName = computed(() => itemInfo(trader.request)?.name ?? trader.request)

function pickSlot(i: number) {
  if (!inventory.bag[i]) return
  offering.value = offering.value === i ? null : i
  note.value = ''
}

function handOver() {
  if (offering.value === null) return
  const r = trader.sell(offering.value)
  offering.value = null
  if (!r) return
  sfx.play('put-item', 0.8)
  const name = itemInfo(r.id)?.name ?? r.id
  note.value = r.request ? `"That's the one." ${name}: +${r.got} on your tab, double for today.` : `${name}: +${r.got} on your tab.`
  if (r.rank) note.value += ` ${r.rank}`
}

function take(id: string) {
  const r = trader.buy(id)
  const name = itemInfo(id)?.name ?? id
  if (!r.ok) {
    note.value = r.why === 'credit' ? `Not enough on your tab for the ${name.toLowerCase()}. Hand her something first.`
      : r.why === 'room' ? (inventory.lastRefusal === 'weight' ? `The ${name.toLowerCase()} is too heavy on top of what you carry. Hand her something heavy.` : `No room in the bag for the ${name.toLowerCase()}. Hand her something, or drop it.`)
        : 'She already sold that.'
    return
  }
  sfx.play('item-pickup')
  note.value = `The ${name.toLowerCase()} goes in your bag.${r.rank ? ` ${r.rank}` : ''}`
}
</script>

<template>
  <div class="flex flex-col gap-3 mt-2">
    <!-- her, her standing with Juan, and his tab -->
    <div class="flex items-center gap-3">
      <img src="/game/kit/out/portrait-cora-big.png" alt="Aling Cora" class="w-12 h-[50px] shrink-0" style="image-rendering: pixelated; border: 2px solid #0e1214; background: #1a2024">
      <div class="flex-1 min-w-0">
        <div class="flex justify-between text-[10px] tracking-[2px] uppercase" style="font-family: var(--font-mono); color: var(--muted)">
          <span>{{ trader.rank.name }}</span>
          <span>{{ trader.nextRank ? `${trader.nextRank.name} at ${trader.nextRank.at}` : 'Top rank' }}</span>
        </div>
        <div class="h-1.5 mt-1 rounded-sm overflow-hidden" style="background: #2a3438" role="meter" aria-label="Standing with Aling Cora" :aria-valuenow="trader.points" :aria-valuemin="0" :aria-valuemax="SUKI_RANKS[SUKI_RANKS.length - 1]!.at">
          <i class="block h-full" :style="{ width: `${progress * 100}%`, background: 'var(--sodium)' }" />
        </div>
        <div class="mt-1.5 text-[12px]" style="color: var(--bone)">
          Your tab: <b style="font-family: var(--font-mono); color: var(--sodium)">{{ trader.credit }}</b>
        </div>
      </div>
    </div>

    <!-- what she wants today -->
    <div class="text-[12px] px-2.5 py-2 rounded-md" style="background: var(--panel3); border: 1px dashed rgba(240,166,60,.5); color: #cdc6b8">
      <template v-if="trader.requestOpen">Looking for: <b style="color: var(--bone)">{{ requestName }}</b> · pays double ({{ tradeValue(trader.request) * 2 }})</template>
      <template v-else>She found what she was after today.</template>
    </div>

    <!-- her table -->
    <div>
      <div class="text-[10px] tracking-[2px] mb-1.5" style="font-family: var(--font-mono); color: var(--muted)">HER TABLE · TAP TO TAKE</div>
      <div class="flex flex-col gap-1.5">
        <button
          v-for="item in trader.table"
          :key="item.id"
          class="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left"
          :style="{ background: 'var(--panel3)', border: item.special ? '1px solid rgba(240,166,60,.6)' : '1px solid var(--line)', opacity: trader.credit >= item.price ? 1 : 0.55 }"
          :aria-label="`Take ${item.name} for ${item.price}`"
          @click="take(item.id)"
        >
          <img v-if="item.sprite" :src="item.sprite" alt="" class="w-7 h-7" style="image-rendering: pixelated; object-fit: contain">
          <span v-else class="w-7 text-center text-[18px] leading-none">{{ item.icon }}</span>
          <span class="flex-1 text-[13px]" style="color: var(--bone)">
            {{ item.name }}
            <small v-if="item.special" class="block text-[10px] tracking-wide uppercase" style="color: var(--sodium); font-family: var(--font-mono)">Kept back for you</small>
          </span>
          <b class="text-[13px]" style="font-family: var(--font-mono)" :style="{ color: trader.credit >= item.price ? 'var(--sodium)' : 'var(--muted)' }">{{ item.price }}</b>
        </button>
        <p v-if="!trader.table.length" class="text-[12px]" style="color: var(--muted)">Her table is bare. Come back tomorrow.</p>
      </div>
    </div>

    <!-- Juan's bag: pick a thing, then hand it over -->
    <div>
      <div class="text-[10px] tracking-[2px] mb-1.5" style="font-family: var(--font-mono); color: var(--muted)">YOUR BAG {{ inventory.bagCount }} / {{ inventory.bag.length }} · TAP ONE TO OFFER IT</div>
      <div class="px-grid">
        <button
          v-for="(slot, i) in inventory.bag"
          :key="i"
          class="px-cell"
          :class="{ picked: offering === i, wanted: slot && slot.id === trader.request && trader.requestOpen }"
          :disabled="!slot"
          :aria-label="slot ? `Offer ${itemInfo(slot.id)?.name ?? slot.id} for ${trader.offerFor(slot.id)}` : 'Empty slot'"
          @click="pickSlot(i)"
        >
          <img v-if="slot && itemInfo(slot.id)?.sprite" :src="itemInfo(slot.id)!.sprite" alt="">
          <span v-else-if="slot" class="emoji">{{ itemInfo(slot.id)?.icon ?? '❔' }}</span>
          <span v-if="slot && slot.qty > 1" class="qty">×{{ slot.qty }}</span>
          <span v-if="slot" class="worth">{{ trader.offerFor(slot.id) }}</span>
        </button>
      </div>
    </div>

    <p v-if="note" class="text-[12px] leading-relaxed" style="color: var(--bone)">{{ note }}</p>

    <button
      v-if="offerId"
      class="py-3 px-3.5 rounded-md text-left text-[13px] flex justify-between items-center gap-2.5"
      style="background: var(--sodium); border: 1px solid var(--sodium); color: #0e1214; font-weight: 600"
      @click="handOver"
    >
      <span>Hand over the {{ (itemInfo(offerId)?.name ?? offerId).toLowerCase() }}</span>
      <span class="text-xs" style="font-family: var(--font-mono); color: #5a3d12">+{{ trader.offerFor(offerId) }}</span>
    </button>
    <button
      class="py-3 px-3.5 rounded-md text-left text-[13px] flex justify-between items-center gap-2.5"
      style="background: var(--panel3); border: 1px solid var(--line); color: var(--bone)"
      @click="emit('done')"
    >
      <span>Done trading</span>
      <span class="text-xs" style="font-family: var(--font-mono); color: var(--muted)">→</span>
    </button>
  </div>
</template>

<style scoped>
.px-cell { position: relative }
.px-cell.picked { outline: 2px solid var(--sodium); outline-offset: -2px }
.px-cell.wanted::before { content: '★'; position: absolute; top: 1px; left: 3px; font-size: 9px; color: var(--sodium) }
.worth { position: absolute; bottom: 1px; left: 3px; font: 700 9px/1 var(--font-mono); color: var(--sodium); text-shadow: 0 1px 0 #000 }
</style>
