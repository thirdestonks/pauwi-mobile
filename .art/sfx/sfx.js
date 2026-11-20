// PAUWI preview sound. One-shots pick a random variation (name, name-2, name-3, name-4: whichever exist),
// never the same one twice running; beds (rain) loop and fade in and out. Files are trimmed and levelled already.
const SFX = (() => {
  const VARS = { 'door-open': 2, 'juan-walkstep-map': 2, 'weapon-swing': 2, 'zombie-hurt': 2 };   // how many variations each sound has
  const base = new URL('.', document.currentScript.src).href, last = {};
  let muted = false;
  function play(name, vol = 1) {
    if (muted) return;
    const n = VARS[name] || 1; let k = Math.floor(Math.random() * n);
    if (n > 1 && k === last[name]) k = (k + 1) % n;
    last[name] = k;
    const a = new Audio(base + name + (k ? '-' + (k + 1) : '') + '.mp3'); a.volume = vol; a.play().catch(() => {});
  }
  // beds: say what should be playing; it fades to match. Browsers block sound until the first tap, so it retries then.
  const beds = {};
  function bed(name, on, vol = 1) {
    let b = beds[name];
    if (!b) { if (!on) return; b = beds[name] = { a: Object.assign(new Audio(base + name + '.mp3'), { loop: true, volume: 0 }), want: 0 }; }
    b.want = on && !muted ? vol : 0;
    if (b.want > 0 && b.a.paused) b.a.play().catch(() => {});
  }
  setInterval(() => {                                     // ease every bed toward its target volume
    for (const b of Object.values(beds)) {
      const v = b.a.volume + Math.sign(b.want - b.a.volume) * 0.04;
      b.a.volume = Math.abs(b.want - b.a.volume) < 0.04 ? b.want : Math.min(1, Math.max(0, v));
      if (b.a.volume === 0 && !b.a.paused && b.want === 0) b.a.pause();
    }
  }, 60);
  addEventListener('pointerdown', () => { for (const b of Object.values(beds)) if (b.want > 0 && b.a.paused) b.a.play().catch(() => {}); });
  return { play, bed, mute(v) { muted = v; if (v) for (const b of Object.values(beds)) b.want = 0; } };
})();
