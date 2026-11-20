// Balance check for the combat rules in index.html: plays many fights with a sensible Juan and reports HP lost.
// Same numbers as the app (data/combat.ts PIXEL_COMBAT; the page index.html predates misses, spread, crits and regen). Run: node balance-sim.cjs
const W = { makeshift: [2, 12], itak: [3, 8], arnis: [2, 16], pipe: [3, 12], sledge: [5, 6], knife: [2, Infinity], fist: [1, Infinity],
  // the October 23 weapons (data/equipment.ts): [dmg, swings, trait]; the hammer's knock-back and the sumpak's lane aren't modelled
  sibat: [2, 10, { reach: true }], balisong: [2, Infinity, { crit: 0.25 }], crowbar: [3, 14], rebar: [3, 22], hammer: [2, 14] };
const REACH_MULT = [1, 1, 0.6], ARMOR_CAP = 0.5;   // data/combat.ts PIXEL_COMBAT.reachMult / armorCap
const ROW_MULT = [1, 0.6, 0.3], DREAD_HIT = 4, DREAD_CLOSE = 2, SHAKEN = 60, MISS = 0.25;
// The app's rules (data/combat.ts PIXEL_COMBAT): hits roll dmg-1..dmg+1 (fists 1), 10% crit x2; foes miss; meds heal 12 now + 8 for 2 turns.
const CRIT = 0.1, FOE_MISS = { 6: 0.35, 8: 0.25, 10: 0.25, 20: 0.15 }, MED_NOW = 12, REGEN = 8, REGEN_TURNS = 2;
const roll = (d, crit = CRIT) => (d <= 1 ? 1 : d - 1 + Math.floor(Math.random() * 3)) * (Math.random() < crit ? 2 : 1);
// armor: flat points off each bite, never more than half of it (wear isn't modelled: assume it lasts the fight)
function fight({ foes, hp: fhp, bite, weapon, heals = 0, guardAtClose = false, startRow = 2, armor = 0 }) {
  const trait = W[weapon][2] ?? {}, rows = trait.reach ? REACH_MULT : ROW_MULT;
  let hp = 100, dread = 0, swings = W[weapon][1], dmg = W[weapon][0], meds = heals, guard = false, turns = 0, regen = 0;
  const F = Array.from({ length: foes }, () => ({ r: startRow, hp: fhp }));
  while (F.some(f => f.hp > 0) && hp > 0 && turns < 60) {
    turns++;
    const alive = F.filter(f => f.hp > 0).sort((a, b) => a.r - b.r), near = alive[0];
    // Juan's turn: heal when low, guard when something's in reach and he chooses to, else swing at the nearest
    if (regen > 0) { regen--; hp = Math.min(100, hp + REGEN); }
    if (hp <= 30 && meds > 0) { meds--; hp = Math.min(100, hp + MED_NOW); regen = REGEN_TURNS; }
    else if (guardAtClose && near.r === 0 && near.hp > dmg) guard = true;
    else {
      if (Number.isFinite(swings) && --swings <= 0) { dmg = 1; swings = Infinity; }   // it broke: fists
      if (!(dread >= SHAKEN && Math.random() < MISS)) near.hp -= roll(dmg, trait.crit ?? CRIT) * rows[near.r];
    }
    // their turn
    for (const f of F.filter(f => f.hp > 0).sort((a, b) => a.r - b.r)) {
      if (f.r === 0) { if (Math.random() < (FOE_MISS[bite] ?? 0.25)) continue; let d = Math.max(1, bite - Math.min(armor, Math.floor(bite * ARMOR_CAP))); if (guard) { d = Math.round(d / 2); guard = false; } hp -= d; dread = Math.min(100, dread + DREAD_HIT); }
      else if (!F.some(o => o !== f && o.hp > 0 && o.r === f.r - 1 && false)) { f.r--; if (f.r === 0) dread = Math.min(100, dread + DREAD_CLOSE); }
    }
    guard = false;
  }
  return { lost: 100 - Math.max(0, hp), died: hp <= 0, swingsUsed: W[weapon][1] - swings };
}
const avg = (cfg, n = 2000) => {
  let lost = 0, died = 0;
  for (let i = 0; i < n; i++) { const r = fight(cfg); lost += r.lost; died += r.died; }
  return `HP lost ~${Math.round(lost / n)}, Juan down ${(died / n * 100).toFixed(0)}%`;
};
const S = { hp: 5, bite: 10 }, B = { hp: 16, bite: 20 };   // keep in step with FOE in index.html
console.log('1 Shambler, bat           ', avg({ foes: 1, ...S, weapon: 'makeshift' }));
console.log('Interior Shambler, bat    ', avg({ foes: 1, hp: 3, bite: 6, weapon: 'makeshift', startRow: 0 }));   // data/combat.ts PIXEL_COMBAT.interior: one weaker Shambler inside a house, already at CLOSE
console.log('Interior Shambler, fists  ', avg({ foes: 1, hp: 3, bite: 6, weapon: 'fist', startRow: 0 }));
console.log('1 Shambler, fists         ', avg({ foes: 1, ...S, weapon: 'fist' }));
console.log('2 Shamblers, bat          ', avg({ foes: 2, ...S, weapon: 'makeshift' }));
console.log('2 Shamblers, pipe         ', avg({ foes: 2, ...S, weapon: 'pipe' }));
console.log('Brute, bat                ', avg({ foes: 1, ...B, weapon: 'makeshift' }));
console.log('Brute, pipe + 2 meds      ', avg({ foes: 1, ...B, weapon: 'pipe', heals: 2 }));
console.log('Brute, sledge + 2 meds    ', avg({ foes: 1, ...B, weapon: 'sledge', heals: 2 }));
console.log('Brute, sledge, 2 meds, guarding', avg({ foes: 1, ...B, weapon: 'sledge', heals: 2, guardAtClose: true }));
console.log('--- October 23: new weapons and armor')
console.log('2 Shamblers, sibat (reach) ', avg({ foes: 2, ...S, weapon: 'sibat' }));
console.log('2 Shamblers, balisong      ', avg({ foes: 2, ...S, weapon: 'balisong' }));
console.log('2 Shamblers, rebar         ', avg({ foes: 2, ...S, weapon: 'rebar' }));
console.log('2 Shamblers, bat, armor 2  ', avg({ foes: 2, ...S, weapon: 'makeshift', armor: 2 }));
console.log('2 Shamblers, bat, armor 5+ ', avg({ foes: 2, ...S, weapon: 'makeshift', armor: 7 }));
console.log('Brute, sledge+2, armor 4   ', avg({ foes: 1, ...B, weapon: 'sledge', heals: 2, armor: 4 }));
// sweep the Brute: the right loadout (pipe or sledge + medicine) should usually win; the bat alone never
console.log('--- Brute sweep');
for (const [hp, bite] of [[18, 20], [16, 20], [16, 18], [15, 18]]) {
  const Bx = { hp, bite };
  console.log(`Brute ${hp} HP / ${bite} bite | pipe+2 meds: ${avg({ foes: 1, ...Bx, weapon: 'pipe', heals: 2 })} | sledge+2: ${avg({ foes: 1, ...Bx, weapon: 'sledge', heals: 2 })} | bat+3: ${avg({ foes: 1, ...Bx, weapon: 'makeshift', heals: 3 })}`);
}
