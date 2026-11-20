// PAUWI · the weight. The rules and numbers the mockup (index.html) plays with, written to port into the app's data/ later.
// Four parts: what things weigh and what a load does to Juan; using a thing is an act; the people who ask; Mang Isko's grindstone.
(function () {
  const ITEMS_DIR = '../../public/game/encounters/src/items/', UI_DIR = '../../public/game/encounters/src/ui/', OUT = 'out/';

  /** What one of each weighs, in kg. Worn armor and the weapon in hand count too: it's all on his body. */
  const KG = {
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
    'nailed-plank': 1.2, 'steel-pipe': 2.0, itak: 0.8, arnis: 0.5, sledge: 5.0, knife: 0.2, pistol: 0.9, sibat: 1.0, balisong: 0.2, crowbar: 1.5, rebar: 2.5, hammer: 0.7, sumpak: 2.2,
    // armor
    'hard-hat': 0.4, 'moto-helmet': 1.4, 'denim-jacket': 1.0, 'leather-jacket': 1.8, 'rider-jacket': 2.0, 'scrap-vest': 3.5, 'work-jeans': 0.8, 'rain-boots': 1.2, 'work-boots': 1.6, 'elbow-pads': 0.5,
  };

  /** Names and pictures for the things the mockup shows. */
  const ITEMS = {
    water: { name: 'Water', sprite: ITEMS_DIR + 'water.png' }, rice: { name: 'Rice, 2 kg', sprite: ITEMS_DIR + 'rice.png' },
    sardines: { name: 'Sardines', sprite: ITEMS_DIR + 'sardines.png' }, gauze: { name: 'Gauze', sprite: ITEMS_DIR + 'gauze.png' },
    antibiotics: { name: 'Antibiotics', sprite: ITEMS_DIR + 'antibiotics.png' }, rebar: { name: 'Rebar', sprite: ITEMS_DIR + 'rebar.png' },
    'copper-wire': { name: 'Copper Wire', sprite: OUT + 'copper-wire.png' }, gold: { name: 'Gold Ring & Chain', sprite: OUT + 'gold.png' },
    gin: { name: 'Bottle of Gin', sprite: OUT + 'gin.png' }, 'scrap-vest': { name: 'Scrap Vest', sprite: OUT + 'scrap-vest.png' },
    'nailed-plank': { name: 'Makeshift Bat', sprite: UI_DIR + 'w-makeshift.png' }, 'denim-jacket': { name: 'Denim Jacket', sprite: ITEMS_DIR + 'denim-jacket.png' },
    itak: { name: 'Itak', sprite: UI_DIR + 'w-itak.png' }, arnis: { name: 'Arnis Stick', sprite: UI_DIR + 'w-arnis.png' }, hammer: { name: 'Claw Hammer', sprite: ITEMS_DIR + 'hammer.png' },
    cigarettes: { name: 'Cigarettes', sprite: OUT + 'cigarettes.png' }, 'old-phone': { name: 'Cracked Phone', sprite: OUT + 'old-phone.png' }, coffee: { name: 'Coffee Sachets', sprite: OUT + 'coffee.png' },
    straps: { name: 'Straps', sprite: ITEMS_DIR + 'straps.png' }, kaldero: { name: 'Dented Pot', sprite: ITEMS_DIR + 'kaldero.png' }, nails: { name: 'Nails, a fistful', sprite: OUT + 'nails.png' },
    'hard-hat': { name: 'Hard Hat', sprite: OUT + 'hard-hat.png' }, 'leather-jacket': { name: 'Leather Jacket', sprite: OUT + 'leather-jacket.png' }, 'work-boots': { name: 'Work Boots', sprite: OUT + 'work-boots.png' },
  };

  /** How much Juan carries comfortably, and what each load does to him. `fresh`: Energy for a step onto fresh ground (today 3);
      `cleared`: Energy for a step on cleared ground (today free); `dash`: hexes per tap on cleared ground; `run`: added to the odds of
      running from a fight; `noise`: how loud he is in a house (searching, walking). Past `max` nothing more goes in the bag. */
  const CARRY = 12, MAX = 20;
  const LOADS = [
    { id: 'light', name: 'Light', upto: 6, bag: 'bag-light', fresh: 2, cleared: 0, dash: 3, run: +10, noise: 1,
      line: 'Light on his feet. He could run all night.' },
    { id: 'carrying', name: 'Carrying', upto: 12, bag: 'bag-half', fresh: 3, cleared: 0, dash: 3, run: 0, noise: 1,
      line: 'The straps bite a little. Nothing he can\'t handle.' },
    { id: 'loaded', name: 'Loaded', upto: 16, bag: 'bag-loaded', fresh: 5, cleared: 1, dash: 2, run: -15, noise: 1.5,
      line: 'Every step costs. The bag knocks against his back when he turns.' },
    { id: 'over', name: 'Overloaded', upto: MAX, bag: 'bag-loaded', fresh: 8, cleared: 2, dash: 1, run: -30, noise: 2,
      line: 'Bent double. He won\'t outrun anything like this.' },
  ];
  const loadOf = (kg) => LOADS.find((l) => kg <= l.upto) ?? LOADS[LOADS.length - 1];

  /** Using a thing is an act: it takes time, it shows, and it can go wrong. */
  const ACTS = {
    gauze: { turns: 2, map: '1 move: he sits down to wrap it', fight: 'Two turns to wrap. Bitten mid-wrap and the gauze is ruined.', hands: 'use-bandage', heal: 25 },
    bandage: { turns: 2, map: '1 move', fight: 'Two turns, like gauze.', hands: 'use-bandage', heal: 15 },
    painkillers: { turns: 1, map: 'free, a beat on screen', fight: 'One turn; it lands on the next one.', hands: 'use-pills' },
    antibiotics: { turns: 1, map: 'free', fight: 'Not in a fight: it does nothing fast.', hands: 'use-pills' },
    water: { turns: 1, map: 'free', fight: 'One turn: +Energy, a little less Dread.', hands: 'use-water' },
    sardines: { turns: 1, map: 'free', fight: 'One turn. Rice can\'t be eaten in a fight; cans and crackers can.', hands: 'use-food' },
  };

  /** The people who ask. Each is met once a run. What they want weighs something (on the bag, on Hope, or in time); saying no
      also weighs something, and some of it comes back days later. Art: portrait (bust, from survivors_pack_1) and scene. */
  const SURVIVORS = [
    { id: 'lorna', name: 'Lorna', who: 'A mother, her son burning with fever', where: 'A doorway in an alley, a candle inside', art: { portrait: 'sv-mother', scene: 'scene-mother' },
      ask: 'Antibiotics, or any medicine', wants: ['antibiotics', 'medicine'],
      give: { hope: 12, dread: -10, now: 'She doesn\'t thank you. She\'s already gone inside with it.', later: 'Two days on, a crayon drawing is tucked into her door frame for you. "SALAMAT KUYA." (a keepsake)' },
      refuse: { dread: 8, now: 'She doesn\'t beg twice. The door closes.', later: 'Three days on, the candle is out. A small rubber slipper on the step.' } },
    { id: 'pilo', name: 'Mang Pilo', who: 'An old man, no more insulin, and he knows what that means', where: 'The steps of his house', art: { portrait: 'sv-oldman' },
      ask: 'Nothing in the bag. "Sit with me a while."', costs: '1 move and the hour it takes',
      give: { hope: 10, now: 'He talks about his wife. Before you go he presses her ring into your hand: "Give it to someone who can use it."', later: 'The gold ring and chain (a trade good worth 16 at Aling Cora\'s).' },
      refuse: { dread: 5, now: '"Of course. You\'re busy."', later: 'Two days on he is still on his steps. He stands up when you come near. (a fight; the ring is on him)' } },
    { id: 'boyet', name: 'Boyet', who: 'A boy of fifteen, alone, hungry', where: 'Under an abandoned jeepney', art: { portrait: 'sv-boy' },
      ask: 'Food, two of anything', wants: ['sardines', 'rice', 'crackers', 'tuna'], count: 2,
      give: { hope: 8, now: 'He eats one right there, the other goes in his shirt.', later: 'Next day a note under your shelter door: "Kuya, behind the mart on {street}." (a cache on the phone)' },
      refuse: { dread: 4, now: 'He shrugs like he expected it.', later: 'That night one food from your stash is gone. Small footprints in the dust.' } },
    { id: 'mila', name: 'Mila', who: 'Eight months pregnant, hiding in a chapel', where: 'The chapel steps', art: { portrait: 'sv-pregnant' },
      ask: 'Water, two bottles (2 kg he won\'t have to carry)', wants: ['water'], count: 2,
      give: { hope: 10, now: 'She presses a prayer card into your hand.', later: 'The prayer card (a keepsake). Read at night, it eases Dread.' },
      refuse: { dread: 6, now: 'She nods. She understands, which is worse.', later: 'Later the chapel is empty. A hospital bracelet on the chair.' } },
    { id: 'delacruz', name: 'PO1 Dela Cruz', who: 'A rookie cop, barricaded in the police outpost', where: 'Police outpost (a place on the map)', art: { portrait: 'sv-cop', scene: 'scene-cop' },
      ask: 'Rounds, so he can hold; or the crowbar, to pry the jammed back door and get him out', wants: ['rounds', 'ammo', 'crowbar'],
      give: { hope: 12, now: 'Ammo: he holds, and the outpost is a safe stop for you (rest once a day). Pried out: he leaves for the pier.', later: 'Pried out, he leaves you his 9mm and six rounds.' },
      refuse: { dread: 6, now: '"Then go. Don\'t come back here."', later: 'Day three, a Shambler in a police uniform behind the barricade. The pistol is on him, empty.' } },
    { id: 'remy', name: 'Aling Remy', who: 'A woman too frightened to leave her house', where: 'Inside a house you are searching, hiding in the bathroom', art: { portrait: 'sv-remy' },
      ask: 'Leave her kitchen alone. It is all the food she has.', costs: 'the house\'s food',
      give: { hope: 8, now: 'She slides a key under the bathroom door: her bedroom, her late husband\'s things.', later: 'The locked bedroom opens with her key.' },
      refuse: { hope: -10, dread: 6, now: 'You take it all. She doesn\'t make a sound.', later: 'The house is marked on your phone: "Someone was here."' } },
    { id: 'bombay', name: 'Bombay', who: 'A thug who runs a corner at night', where: 'A street corner, after dark', art: { portrait: 'sv-thug' },
      ask: 'A toll: the most valuable thing in your bag', costs: 'your best item, or your skin',
      give: { now: 'He weighs it in his hand and waves you through.', later: 'He remembers you paid. Next time the toll is smaller. He also sells: weapons and ammo, 40% under Aling Cora, and she will hear about it.' },
      refuse: { now: 'Run: your odds depend on your load. Caught: −15 Health and he takes the toll anyway.', later: 'He remembers that too.' } },
    { id: 'bert', name: 'Tanod Bert', who: 'A barangay watchman holding a checkpoint', where: 'A barricade across a street (a shortcut)', art: { portrait: 'sv-tanod', scene: 'scene-tanod' },
      ask: 'A "contribution": cigarettes or gin', wants: ['cigarettes', 'gin'],
      give: { hope: 2, now: 'He lifts the barricade. "You didn\'t see me."', later: 'For the day he marks where the dead are thick on your phone.' },
      refuse: { now: 'The barricade stays down. The long way round.', later: 'Curfew: after dark he turns you back.' } },
  ];

  /** Mang Isko, the knife sharpener: nights only, on the same street tab as Aling Cora. He upgrades MELEE weapons only (guns are
      someone else's trade, a later stall). Everything he does is hand work on a bicycle grindstone: honing, nailing, wrapping, binding,
      weighting, lashing. */
  const MELEE = {
    'nailed-plank': { kind: 'blunt', dmg: 2, swings: 12 }, 'steel-pipe': { kind: 'blunt', dmg: 3, swings: 12 }, arnis: { kind: 'blunt', dmg: 2, swings: 16 },
    sledge: { kind: 'blunt', dmg: 5, swings: 6 }, crowbar: { kind: 'blunt', dmg: 3, swings: 14 }, rebar: { kind: 'blunt', dmg: 3, swings: 22 },
    hammer: { kind: 'blunt', dmg: 2, swings: 14 }, itak: { kind: 'blade', dmg: 3, swings: 8, short: true }, knife: { kind: 'blade', dmg: 2, swings: null, short: true },
    balisong: { kind: 'blade', dmg: 2, swings: null, short: true }, sibat: { kind: 'blade', dmg: 2, swings: 10 },
  };
  /** The upgrades. `for`: blade, blunt or any; `mat`: what Juan has to bring (taken from his bag); `kg`: what it adds to the weapon.
      Every one has a minus. `apply` changes the weapon's numbers: dmg, swings (max), crit, traits. */
  const UPGRADES = [
    { id: 'edge', name: 'Hone the edge', for: 'blade', cost: 6, mat: [], kg: 0, plus: '+1 damage', minus: '−2 swings: a thin edge chips',
      apply: (w) => { w.dmg += 1; if (w.swings) w.swings = Math.max(2, w.swings - 2); } },
    { id: 'nails', name: 'Drive nails through it', for: 'blunt', cost: 5, mat: ['nails'], kg: 0.2, plus: '+1 damage', minus: '1 hit in 10 sticks: he loses his next turn pulling it free',
      apply: (w) => { w.dmg += 1; w.traits.push('sticks'); } },
    { id: 'grip', name: 'Wrap the grip', for: 'any', cost: 4, mat: ['straps'], kg: 0.1, plus: '+4 swings · misses less when Shaken', minus: '+0.1 kg',
      apply: (w) => { if (w.swings) w.swings += 4; w.traits.push('steady'); } },
    { id: 'wire', name: 'Bind it with copper wire', for: 'any', cost: 6, mat: ['copper-wire'], kg: 0.3, plus: '+50% swings', minus: '+0.3 kg, and the wire you could have sold',
      apply: (w) => { if (w.swings) w.swings = Math.round(w.swings * 1.5); } },
    { id: 'weight', name: 'Weight the head', for: 'blunt', cost: 8, mat: ['kaldero'], kg: 1.0, plus: 'Knocks it back a row · +1 at CLOSE', minus: '+1 kg · −1 damage at MID and FAR',
      apply: (w) => { w.traits.push('knock', 'close+1'); } },
    { id: 'serrate', name: 'Serrate the blade', for: 'blade', cost: 8, mat: [], kg: 0, plus: '+15% crits', minus: '−3 swings',
      apply: (w) => { w.crit = (w.crit ?? 0.1) + 0.15; if (w.swings) w.swings = Math.max(2, w.swings - 3); } },
    { id: 'lash', name: 'Lash it to a pole', for: 'short', cost: 10, mat: ['arnis', 'straps'], kg: 0.6, plus: 'Reach: full damage at MID', minus: 'Two hands · uses up an arnis stick',
      apply: (w) => { w.traits.push('reach', 'two-handed'); } },
  ];
  const HASA = {
    who: 'Mang Isko, a knife sharpener with a grindstone rigged to his bicycle. Forty years on these corners.',
    when: 'Nights only (Aling Cora works by day), at one of three corners per zone; the phone shows which.',
    melee: MELEE, upgrades: UPGRADES,
    slots: 3, slotsLine: '"Three things to a weapon. More than that and it isn\'t a bat any more."',
    /** Upgrades take the night: leave the weapon, collect it next night. A rush job is done while you wait, at double the price. */
    overnight: true, rush: 2,
    /** Each job costs more on a weapon that already has work on it. */
    costStep: [1, 1.5, 2],
    fix: { name: 'Fix it', per: 0.5, min: 2, what: 'Back to full swings, while you wait. Half a point per missing swing, at least 2.' },
    /** His respect: jobs done for you. At 3 he shows you his own work. */
    respect: [{ at: 0, name: 'A customer' }, { at: 3, name: 'Suki', unlock: 'His own bolo on the rack (4 damage, 16 swings, already honed).' }, { at: 6, name: 'Pare', unlock: 'Rush jobs at the normal price.' }],
    rack: { size: 3, sells: 1.25, buys: 0.8, what: '3 melee weapons a night. He pays fair for steel: 0.8 of its worth (she pays a stranger 0.6), and only buys melee weapons.' },
  };
  /** A weapon's numbers after its upgrades (ups: upgrade ids, in the order they were done). */
  function upgraded(id, ups) {
    const b = MELEE[id], w = { dmg: b.dmg, swings: b.swings, crit: null, traits: [], kg: KG[id] ?? 1 };
    for (const u of ups) { const U = UPGRADES.find((x) => x.id === u); U.apply(w); w.kg += U.kg; }
    w.kg = Math.round(w.kg * 10) / 10;
    return w;
  }
  const fits = (id, U) => { const b = MELEE[id]; return U.for === 'any' || U.for === b.kind || (U.for === 'short' && b.short); };

  window.WORLD = { KG, ITEMS, CARRY, MAX, LOADS, loadOf, ACTS, SURVIVORS, HASA, OUT, upgraded, fits };
})();
