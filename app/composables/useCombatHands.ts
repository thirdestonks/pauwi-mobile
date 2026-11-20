// Juan's first-person weapon hand in a fight: the hand art for the current weapon, playing idle / attack / break / raise from the
// manifest. Shared by both combat screens; each calls draw() from its own animation loop on a 110x225 canvas.
interface Frame { ms: number; shake: number }

export function useCombatHands() {
  const combat = useCombatStore()
  const player = usePlayerStore()
  const base = '/game/'

  let manifest: { anims: Record<string, Frame[]> } | null = null
  const sheets: Record<string, HTMLImageElement> = {}
  fetch(`${base}juan-hands/out/manifest.json`).then((r) => r.json()).then((m) => {
    manifest = m
    for (const k of Object.keys(m.anims)) { const im = new Image(); im.src = `${base}juan-hands/out/${k}.png`; sheets[k] = im }
  })

  let hands = player.weapon.combat.hands, anim = 'idle', fi = 0, ft = 0, queue: string[] = []
  function play(a: string, then: string[] = ['idle']) { anim = a; fi = 0; ft = 0; queue = then }
  watch(() => combat.pose, (p) => { if (p === 'attack') play('attack') })
  watch(() => player.weapon.combat.hands, (next, prev) => {
    // broken mid-swing: the old weapon's break plays, then the fists come up
    if (next === 'fist' && prev !== 'fist' && manifest?.anims[`${prev}-break`]) { play('break', ['__swap']); return }
    hands = next; play(manifest?.anims[`${next}-raise`] ? 'raise' : 'idle')
  })

  /** Advance the hand animation by dt ms and draw it onto hc (cleared first). */
  function draw(hc: CanvasRenderingContext2D, dt: number, W = 110, H = 225) {
    if (!manifest) return
    ft += dt
    const frames = manifest.anims[`${hands}-${anim}`] ?? manifest.anims[`${hands}-idle`]
    if (frames && !frames[fi]) fi = 0                                 // fell back to idle mid-sequence
    if (frames && ft >= frames[fi].ms) {
      ft = 0; fi++
      if (fi >= frames.length) {
        const next = queue.shift()
        if (next === '__swap') { hands = player.weapon.combat.hands; play(manifest.anims[`${hands}-raise`] ? 'raise' : 'idle') }
        else if (next) { anim = next; fi = 0 }
        else fi = 0
      }
    }
    hc.clearRect(0, 0, W, H); hc.imageSmoothingEnabled = false
    const sh = sheets[`${hands}-${anim}`]
    if (sh?.complete) hc.drawImage(sh, fi * W, 0, W, H, 0, 0, W, H)
  }

  return { draw }
}
