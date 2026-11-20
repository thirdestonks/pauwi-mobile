// Crafting, kept simple (made at the shelter, from the stash and the bag): one or two things in, one thing out. No benches, no
// levels, no blueprints. A recipe either makes an item (into the stash) or fixes the weapon in Juan's hand.

export interface Recipe {
  id: string
  name: string
  /** What it uses up, one of each. */
  needs: string[]
  /** The item it makes (into the stash). */
  makes?: string
  /** Swings it puts back on the weapon in hand. */
  repair?: number
  /** Condition it puts back on the most worn piece of armor Juan has on. */
  patch?: number
  text: string
}

export const RECIPES: Recipe[] = [
  { id: 'hotmeal', name: 'Hot meal', needs: ['rice', 'water'], makes: 'hotmeal', text: 'Rice boiled on the stove. Real food, for once: +35 Food, +5 Hope.' },
  { id: 'firstaid', name: 'First-aid kit', needs: ['gauze', 'alcohol'], makes: 'firstaid', text: 'Gauze cleaned with alcohol and rolled tight.' },
  { id: 'molotov', name: 'Molotov', needs: ['alcohol', 'matches'], makes: 'molotov', text: 'A rag in the bottle neck. Thrown in a fight, every Shambler burns.' },
  { id: 'tape', name: 'Tape the handle', needs: ['straps'], repair: 4, text: 'Strap the cracked handle tight: +4 swings for the weapon in hand.' },
  { id: 'patch', name: 'Patch the armor', needs: ['copper-wire'], patch: 8, text: 'Wire the torn padding back together: +8 condition on the most worn armor you have on.' },
]
