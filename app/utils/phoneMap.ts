import { LM, PICK_SHOPS, SHELTERS, WATER_SHOP, hexDist, houseLayout, tile, tkey, type ShopKind } from './tondo'
import type { Tile, Waypoint } from '~/stores/board'
import type { HouseState } from '~/stores/house'

export interface PhonePlace {
  id: string
  kind: 'shelter' | 'landmark' | 'shop' | 'house' | 'loot' | 'car' | 'event' | 'zombie' | 'tip' | 'trader'
  name: string
  category: string
  description: string
  color: string
  q: number
  r: number
  /** Distance and search state belong to the street entrance below the building. */
  entrance: { q: number; r: number }
}

export interface PhoneBounds { minQ: number; maxQ: number; minR: number; maxR: number }

const SHOP_INFO: Record<ShopKind, { category: string; description: string; color: string }> = {
  botika: { category: 'Pharmacy', description: 'A place to look for medicine and first-aid supplies.', color: '#a9cde2' },
  kwik: { category: 'Convenience store', description: 'Packaged food and everyday supplies may be left here.', color: '#83bd74' },
  water: { category: 'Water station', description: 'Check the refilling station for clean water.', color: '#65c4d6' },
  kainan: { category: 'Eatery', description: 'A place to look for food and kitchen supplies.', color: '#83bd74' },
  diner: { category: 'Diner', description: 'Check the diner for food and water.', color: '#83bd74' },
  store: { category: 'General store', description: 'Food, medicine and household supplies may be left here.', color: '#b69bd4' },
}

const FOUND_INFO = {
  loot: { name: 'Dropped backpack', category: 'Supplies', description: 'A bag Juan found on the street.', color: '#dbbb78' },
  car: { name: 'Abandoned car', category: 'Vehicle', description: 'The trunk could hold supplies. Opening it may set off the alarm.', color: '#dbbb78' },
  event: { name: 'Street encounter', category: 'Encounter', description: 'Something Juan came across on this street.', color: '#b69bd4' },
  zombie: { name: 'Reported danger', category: 'Danger', description: 'Juan encountered the dead here.', color: '#d94b3b' },
} as const

/** Business addresses come from the offline map; street encounters come from Juan's visits. */
export function phonePlaces(bounds: PhoneBounds, waypoints: readonly Waypoint[], tiles: ReadonlyMap<string, Tile>, home: string, player?: { q: number; r: number }): PhonePlace[] {
  const places: PhonePlace[] = []
  const visible = (q: number, r: number) => q >= bounds.minQ && q <= bounds.maxQ && r >= bounds.minR && r <= bounds.maxR
  for (const w of waypoints) {
    if (!w.key) continue
    const shelter = SHELTERS[w.key]
    if (!visible(shelter.q, shelter.r)) continue
    places.push({
      id: `shelter:${w.key}`, kind: 'shelter', name: shelter.name, category: 'Shelter',
      description: w.key === home ? 'Your current shelter. Return here to rest and pack supplies.' : w.claimed ? 'A shelter Juan has already claimed.' : shelter.desc,
      color: w.key === home ? '#f0a63c' : w.claimed ? '#828b90' : '#f49638',
      q: shelter.q, r: shelter.r, entrance: { ...w.pos },
    })
  }
  if (visible(LM.q, LM.r)) places.push({
    id: 'landmark:tutuban', kind: 'landmark', name: 'Tutuban Mall', category: 'Landmark',
    description: "Juan's old workplace. Reach the plaza to find the way onward.", color: '#2e86ab',
    ...LM, entrance: { ...LM },
  })
  // Inspect only the visible neighbourhood. Browsing the phone never creates board tiles.
  for (let q = bounds.minQ; q <= bounds.maxQ; q++) for (let r = bounds.minR; r <= bounds.maxR; r++) {
    // A house with a door you could go through, once Juan has been to its step or has it in his light.
    const th = tile(q, r)
    if (th.type === 'house' && !th.front && th.door && th.door !== 'boarded') {
      const ent = { q, r: r + 1 }
      if (tiles.has(tkey(ent.q, ent.r)) || (player && hexDist(player.q, player.r, ent.q, ent.r) <= 3)) {
        places.push({
          id: `house:${tkey(q, r)}`, kind: 'house', name: houseLayout(q, r + 1).tpl === 'stock' ? 'Storeroom' : 'House', category: 'House with a door',
          description: th.door === 'open' || tiles.get(tkey(ent.q, ent.r))?.unlocked ? 'The door stands open. It is dark inside; nobody knows what is in there until Juan looks.' : 'A locked door. A crowbar would open it quietly; a kick is loud.',
          color: '#c9b38a', q, r, entrance: ent,
        })
      }
    }
    const front = tile(q, r).front
    if (!front || front in SHELTERS) continue
    const kind = front as ShopKind
    const info = SHOP_INFO[kind]
    places.push({
      id: `shop:${tkey(q, r)}`, kind: 'shop', name: kind === 'water' ? WATER_SHOP[0] : PICK_SHOPS[kind]![0],
      ...info, q, r, entrance: { q, r: r + 1 },
    })
  }
  for (const t of tiles.values()) {
    if (!t.cleared || !t.content || !(t.content in FOUND_INFO) || !visible(t.q, t.r)) continue
    const kind = t.content as keyof typeof FOUND_INFO
    places.push({ id: `${kind}:${tkey(t.q, t.r)}`, kind, ...FOUND_INFO[kind], q: t.q, r: t.r, entrance: { q: t.q, r: t.r } })
  }
  return places
}

export function phonePlaceStatus(place: PhonePlace, tiles: ReadonlyMap<string, Tile>, waypoints: readonly Waypoint[], home: string): string {
  if (place.kind === 'shelter') {
    const key = place.id.slice('shelter:'.length)
    return key === home ? 'Current shelter' : waypoints.find((w) => w.key === key)?.claimed ? 'Claimed shelter' : 'Potential shelter'
  }
  if (place.kind === 'landmark') return 'Destination'
  if (place.kind === 'tip') return 'Not found yet · somewhere in the circle'
  if (place.kind === 'trader') return 'Here today · packs up at dusk'
  const t = tiles.get(tkey(place.entrance.q, place.entrance.r))
  if (place.kind === 'house') return t?.resolved ? 'Searched' : t?.unlocked || tile(place.q, place.r).door === 'open' ? 'Door open' : 'Locked'
  if (!t?.cleared) return 'Not visited'
  if (t.resolved) return place.kind === 'zombie' ? 'Cleared' : place.kind === 'shop' || place.kind === 'loot' || place.kind === 'car' ? 'Searched' : 'Resolved'
  return place.kind === 'zombie' ? 'Danger remains' : place.kind === 'event' ? 'Unresolved' : 'Unsearched'
}

/** How far Juan has got with a house: q, r is the house hex; its door opens onto q, r + 1 (the key the house store saves it under). */
export function houseProgress(q: number, r: number, tiles: ReadonlyMap<string, Tile>, saved: Readonly<Record<string, HouseState>>) {
  const th = tile(q, r)
  if (th.type !== 'house' || th.front || !th.door) return null
  const t = tiles.get(tkey(q, r + 1)), s = saved[tkey(q, r + 1)]
  const opened = s ? Object.keys(s.opened).length : 0
  const door = th.door === 'boarded' ? 'boarded' : t?.unlocked || th.door === 'open' ? 'open' : 'locked'
  const line = door === 'boarded' ? 'Boarded up · no way in'
    : t?.resolved ? 'Searched'
      : s && s.total && opened ? `Half-searched · ${opened} of ${s.total}`
        : s ? 'Been inside · nothing searched yet'
          : 'Not searched yet'
  return { door, line, opened, state: s ?? null, resolved: !!t?.resolved }
}

/** Dots out of 3 for the phone card. */
export interface PlaceIntel { threat: number | null; threatLabel: string; guess: boolean; supplies: { label: string; n: number }[] }
const SUP = (food: number, med: number, tool: number, weapon: number) => [
  { label: 'Food', n: food }, { label: 'Medical', n: med }, { label: 'Tools', n: tool }, { label: 'Weapons', n: weapon },
]
const SHOP_SUP: Record<ShopKind, number[]> = {
  botika: [0, 3, 1, 0], kwik: [3, 0, 1, 0], water: [2, 0, 0, 0], kainan: [2, 0, 1, 1], diner: [3, 0, 0, 0], store: [2, 2, 1, 0],
}

/**
 * Threat and supplies for the phone card. It only knows what Juan knows: a house he has never been inside is a guess from what kind
 * of place it is and its threat is unknown; once he has been in, it counts what he left in the cupboards he opened and the Shamblers
 * still up, and guesses the rest from what is still unsearched.
 */
export function placeIntel(place: PhonePlace, tiles: ReadonlyMap<string, Tile>, saved: Readonly<Record<string, HouseState>>): PlaceIntel | null {
  const t = tiles.get(tkey(place.entrance.q, place.entrance.r))
  if (place.kind === 'house') {
    const hp = houseProgress(place.q, place.r, tiles, saved)
    const est = houseLayout(place.entrance.q, place.entrance.r).tpl === 'stock' ? [1, 1, 3, 2] : [2, 2, 1, 1]
    const s = hp?.state
    if (!s) return { threat: null, threatLabel: 'Unknown', guess: true, supplies: SUP(est[0]!, est[1]!, est[2]!, est[3]!) }
    const rest = hp!.resolved || !s.total ? 0 : 1 - hp!.opened / s.total
    const left = s.left ?? { food: 0, med: 0, tool: 0, weapon: 0 }
    const dots = (k: 'food' | 'med' | 'tool' | 'weapon', i: number) => Math.max(0, Math.min(3, Math.round(left[k] / 1.5 + est[i]! * rest)))
    const alive = s.alive ?? 0
    return {
      threat: Math.min(1, alive / 2), threatLabel: alive ? `${alive} still up` : 'None left that he saw', guess: false,
      supplies: SUP(dots('food', 0), dots('med', 1), dots('tool', 2), dots('weapon', 3)),
    }
  }
  if (place.kind === 'shop') {
    const kind = tile(place.q, place.r).front as ShopKind
    const v = t?.resolved ? [0, 0, 0, 0] : SHOP_SUP[kind] ?? [1, 1, 1, 0]
    return { threat: null, threatLabel: 'Unknown', guess: !t?.resolved, supplies: SUP(v[0]!, v[1]!, v[2]!, v[3]!) }
  }
  if (place.kind === 'zombie') return { threat: t?.resolved ? 0 : 0.7, threatLabel: t?.resolved ? 'Cleared' : 'The dead are here', guess: false, supplies: [] }
  if (place.kind === 'car') return { threat: null, threatLabel: 'An alarm may go off', guess: !t?.resolved, supplies: t?.resolved ? SUP(0, 0, 0, 0) : SUP(1, 1, 2, 2) }
  if (place.kind === 'loot') return { threat: null, threatLabel: 'Unknown', guess: !t?.resolved, supplies: t?.resolved ? SUP(0, 0, 0, 0) : SUP(1, 1, 1, 0) }
  return null
}
