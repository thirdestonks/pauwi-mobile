// The weight (ported from .art/weight/world.js, November 2026): everything Juan carries weighs something, and a load changes what
// a step costs, how far he can dash, how well he runs and how loud he is in a house. Ten bag slots stay (the grid); weight is the
// real limit. What he wears and holds counts too: it's all on his body.
//
// One rule from CLAUDE.md shapes it: Juan can never be stranded. Cleared ground drains Energy when he's loaded but never blocks a
// step, and heading back to the shelter stays free. Only fresh ground can say "too tired".

/** What one of each weighs, in kg. Anything not listed is 0.3. */
export const KG: Record<string, number> = {
  // food and water: water is the heavy one
  water: 1.0, rice: 2.0, sardines: 0.2, tuna: 0.2, 'canned-food': 0.4, beef: 0.4, 'instant-noodles': 0.1, crackers: 0.2, eggs: 0.6, tuyo: 0.2, hotmeal: 0.5, coffee: 0.05,
  // medicine: light, which is why everyone wants it
  bandage: 0.05, gauze: 0.05, painkillers: 0.05, alcohol: 0.3, medicine: 0.1, antibiotics: 0.1, firstaid: 0.6, vitamins: 0.1,
  // tools
  battery: 0.1, matches: 0.05, flares: 0.3, straps: 0.2, nails: 0.2, butane: 0.4, jerrycan: 4.0, kaldero: 1.2, molotov: 0.8,
  // ammo
  rounds: 0.1, ammo: 0.3, shells: 0.3,
  // trade goods: gold is the dream, copper wire is the back-breaker
  cigarettes: 0.05, gold: 0.05, 'old-phone': 0.2, gin: 0.7, 'copper-wire': 1.5,
  // weapons
  'nailed-plank': 1.2, 'steel-pipe': 2.0, 'fire-axe': 2.2, itak: 0.8, arnis: 0.5, sledge: 5.0, knife: 0.2, pistol: 0.9, sibat: 1.0, balisong: 0.2,
  crowbar: 1.5, rebar: 2.5, hammer: 0.7, sumpak: 2.2,
  // armor
  'hard-hat': 0.4, 'moto-helmet': 1.4, 'denim-jacket': 1.0, 'leather-jacket': 1.8, 'rider-jacket': 2.0, 'scrap-vest': 3.5, 'work-jeans': 0.8,
  'rain-boots': 1.2, 'work-boots': 1.6, 'elbow-pads': 0.5,
}
export const kgOf = (id: string) => KG[id] ?? 0.3

/** Carried comfortably; nothing more goes in the bag past MAX_KG. */
export const CARRY_KG = 12
export const MAX_KG = 20

/**
 * What each load does. `fresh`: Energy for a step onto fresh ground (3 was the old flat cost); `cleared`: Energy for a step on
 * cleared ground (drains, never blocks); `dash`: hexes per tap on cleared ground (1 = no dash); `run`: added to the odds of running
 * from a fight; `noise`: how loud he is in a house.
 */
export interface Load { id: 'light' | 'carrying' | 'loaded' | 'over'; name: string; upto: number; bag: string; fresh: number; cleared: number; dash: number; run: number; noise: number; line: string }
export const LOADS: Load[] = [
  { id: 'light', name: 'Light', upto: 6, bag: 'bag-light', fresh: 2, cleared: 0, dash: 3, run: 0.10, noise: 1, line: 'Light on his feet.' },
  { id: 'carrying', name: 'Carrying', upto: CARRY_KG, bag: 'bag-half', fresh: 3, cleared: 0, dash: 3, run: 0, noise: 1, line: 'The straps bite a little.' },
  { id: 'loaded', name: 'Loaded', upto: 16, bag: 'bag-loaded', fresh: 5, cleared: 1, dash: 2, run: -0.15, noise: 1.5, line: 'Every step costs. The bag knocks against his back.' },
  { id: 'over', name: 'Overloaded', upto: MAX_KG, bag: 'bag-loaded', fresh: 8, cleared: 2, dash: 1, run: -0.30, noise: 2, line: 'Bent double. He won\'t outrun anything like this.' },
]
export const loadOf = (kg: number): Load => LOADS.find((l) => kg <= l.upto) ?? LOADS[LOADS.length - 1]!

/** Where the bag-load sprites live (cut by .art/weight/build.py). */
export const WEIGHT_ART = '/game/weight/out/'
