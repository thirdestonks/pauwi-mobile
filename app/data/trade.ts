// The suki trader (Aling Cora): what things are worth to her, what she stocks, and how a good customer is treated.
// Barter on a tab: whatever Juan hands over goes onto his credit with her, whatever he takes comes off it, and the credit
// keeps from visit to visit. Every point traded either way builds his standing (suki rank): better rates, better stock.
import { EQUIPMENT } from './equipment'

/** What one of each is worth, in her points. Anything not listed is worth 1 (junk she takes as a favour). */
export const TRADE_VALUE: Record<string, number> = {
  // food and water
  water: 2, 'instant-noodles': 2, 'canned-food': 3, crackers: 2, tuna: 3, sardines: 3, beef: 4, rice: 4, tuyo: 3, eggs: 3, hotmeal: 5, coffee: 3,
  // medicine
  bandage: 4, gauze: 4, painkillers: 5, alcohol: 3, vitamins: 3, medicine: 6, antibiotics: 7, firstaid: 9,
  // tools and odds and ends
  battery: 4, matches: 2, flares: 4, straps: 4, butane: 4, jerrycan: 9, kaldero: 3, molotov: 6,
  // ammo
  rounds: 7, ammo: 12, shells: 9,
  // trade goods: their whole point is her
  cigarettes: 6, gold: 16, 'old-phone': 8, gin: 7, 'copper-wire': 6,
}

/** Weapons and armor are priced from what they do, so a new piece needs no entry here. */
export function tradeValue(id: string): number {
  if (TRADE_VALUE[id] !== undefined) return TRADE_VALUE[id]!
  const eq = EQUIPMENT[id]
  if (eq?.armor) return 4 + eq.armor * 5 + Math.round((eq.condition ?? 0) / 4)
  if (eq?.combat) return eq.combat.gun ? 20 + eq.combat.dmg * 3 : 3 + eq.combat.dmg * 3 + Math.round((eq.durability ?? 20) / 4)
  return 1
}

/** Her standing with Juan: points traded (both ways) to reach each rank, what she pays for his things and charges for hers. */
export interface SukiRank { name: string; at: number; buys: number; sells: number; line: string }
export const SUKI_RANKS: SukiRank[] = [
  { name: 'Stranger', at: 0, buys: 0.6, sells: 1.5, line: "She doesn't know you. She watches your hands, not your face." },
  { name: 'Regular', at: 30, buys: 0.7, sells: 1.3, line: 'She nods when you come up. The prices soften a little.' },
  { name: 'Suki', at: 80, buys: 0.8, sells: 1.15, line: 'Suki ka na. She keeps something back for you under the table.' },
  { name: 'Family', at: 160, buys: 0.9, sells: 1, line: 'She calls you anak now, and she tells you what she hears on the street.' },
]
export const rankAt = (points: number) => [...SUKI_RANKS].reverse().find((r) => points >= r.at)!

/** What a thing fetches from her and what she charges for it, at a rank. */
export const buyPrice = (id: string, rank: SukiRank) => Math.max(1, Math.round(tradeValue(id) * rank.buys))
export const sellPrice = (id: string, rank: SukiRank) => Math.max(1, Math.round(tradeValue(id) * rank.sells))
/** The one thing she is looking for today pays double, whatever the rank. */
export const REQUEST_MULT = 2

/** Her everyday stock, weighted. Rank Suki and up adds the under-the-table pool. */
export const STOCK_POOL: [string, number][] = [
  ['rounds', 5], ['ammo', 2], ['shells', 2], ['bandage', 5], ['gauze', 4], ['painkillers', 3], ['medicine', 2], ['antibiotics', 1], ['firstaid', 2],
  ['sardines', 4], ['rice', 3], ['tuna', 3], ['water', 4], ['coffee', 2], ['straps', 3], ['battery', 3], ['matches', 2], ['alcohol', 2],
  ['denim-jacket', 2], ['work-jeans', 2], ['rain-boots', 2], ['elbow-pads', 1], ['hard-hat', 1], ['hammer', 2], ['balisong', 1], ['sibat', 1], ['rebar', 1],
]
export const UNDER_TABLE: [string, number][] = [
  ['moto-helmet', 3], ['rider-jacket', 2], ['scrap-vest', 2], ['sumpak', 2], ['pistol', 1], ['leather-jacket', 2], ['work-boots', 2],
]
/** What she asks for: things she can sell on. */
export const REQUEST_POOL = ['cigarettes', 'gold', 'old-phone', 'gin', 'copper-wire', 'jerrycan', 'battery', 'butane', 'antibiotics', 'matches', 'straps']
/** How many things are on her table each day. */
export const STOCK_SIZE = 5
