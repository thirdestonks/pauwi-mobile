// Renders Juan's first-person arm animations from the painted, keyed sources (src/hk_*.raw, 512×512 RGBA).
// Every frame transforms the hi-res art first and only then shrinks it to the 110×225 combat grid,
// so rotation never degrades the pixels. Output: out/<weapon>-<anim>.raw + out/manifest.json.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, 'src'), OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const W = 110, H = 225, SW = 512, SS = 3;                  // native canvas, source size, supersampling
const { geo: GEO, pal: PAL } = JSON.parse(fs.readFileSync(path.join(SRC, 'hk_meta.json'), 'utf8'));
const OUTLINE = PAL.length - 4, SMEAR_D = PAL.length - 3, SMEAR_L = PAL.length - 2, SPARK = PAL.length - 1;
const SRCS = Object.fromEntries(['makeshift', 'itak', 'arnis', 'pipe', 'fist'].map(k => [k, fs.readFileSync(path.join(SRC, `hk_${k}.raw`))]));

// screen placement: the art pivots at Juan's wrist; the whole arm also travels across the screen
const DEF = { pivot: [300, 335], scr: [91, 218], K: 0.42 };  // fist low and centred, close to the camera
let E_SRC, E_SCR, K;                                       // per weapon: hk_meta.json may override pivot/scr/K
function usePlace(w) { const g = GEO[w]; E_SRC = g.pivot || DEF.pivot; E_SCR = g.scr || DEF.scr; K = g.K || DEF.K; ARM = g.arm || null; }
const rad = d => d * Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// palette lookup (5-bit LUT, redmean distance)
const LUT = new Int16Array(32768).fill(-1);
function nearest(r, g, b) {
  const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
  if (LUT[key] >= 0) return LUT[key];
  let best = 0, bd = Infinity;
  for (let j = 0; j < OUTLINE; j++) {
    const p = PAL[j], rm = (r + p[0]) / 2, dr = r - p[0], dg = g - p[1], db = b - p[2];
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bd) { bd = d; best = j; }
  }
  return LUT[key] = best;
}

// source-space helpers
function axis(w) { const t = rad(GEO[w].th0); return { d: [Math.sin(t), -Math.cos(t)], p: [Math.cos(t), Math.sin(t)] }; }
function uOf(w, sx, sy) { const { d } = axis(w), g = GEO[w].g; return (sx - g[0]) * d[0] + (sy - g[1]) * d[1]; }
function srcPoint(w, u) { const { d } = axis(w), g = GEO[w].g; return [g[0] + d[0] * u, g[1] + d[1] * u]; }
// pose → screen of a source point
function toScreen(pose, sx, sy) {
  const a = rad(pose.a), s = K * (pose.s || 1), x = (sx - E_SRC[0]) * s, y = (sy - E_SRC[1]) * s;
  return [E_SCR[0] + (pose.dx || 0) + x * Math.cos(a) - y * Math.sin(a), E_SCR[1] + (pose.dy || 0) + x * Math.sin(a) + y * Math.cos(a)];
}
let ARM = [0.6, 0.8];                                      // direction the sleeve leaves the painting (per weapon)
function sample(buf, x, y, extend) {
  if (x < 0 || y < 0) return null;
  if (x >= SW || y >= SW) {
    if (!extend || !ARM) return null;
    // past the bottom/right edge: slide back along the arm so the sleeve continues along its own axis
    const t = Math.max(x >= SW ? (x - SW + 1) / ARM[0] : 0, y >= SW ? (y - SW + 1) / ARM[1] : 0);
    x -= ARM[0] * t; y -= ARM[1] * t;
    if (x < 0 || y < 0) return null;
  }
  const xi = clamp(Math.floor(x), 0, SW - 1), yi = clamp(Math.floor(y), 0, SW - 1), i = (yi * SW + xi) * 4;
  return buf[i + 3] > 0 ? [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]] : null;
}

function render(w, f) {
  usePlace(w);
  const idx = new Int16Array(W * H).fill(-1), solid = new Uint8Array(W * H);
  const buf = SRCS[w], G = GEO[w];
  // 1. swing smear, under everything
  if (f.smear && G.L) {
    const A = f.smear, B = f, steps = 40;
    for (let k = 0; k <= steps; k++) {
      const q = k / steps;
      const pose = { a: A.a + (B.a - A.a) * q, dx: (A.dx || 0) + ((B.dx || 0) - (A.dx || 0)) * q, dy: (A.dy || 0) + ((B.dy || 0) - (A.dy || 0)) * q, s: (A.s || 1) + ((B.s || 1) - (A.s || 1)) * q };
      for (let u = G.L * 0.88; u <= G.L; u += 2) {             // a thin crescent traced by the weapon's head
        const [x, y] = toScreen(pose, ...srcPoint(w, u)), xi = Math.floor(x), yi = Math.floor(y);
        if (xi < 0 || yi < 0 || xi >= W || yi >= H) continue;
        if (q < 0.5 && ((xi + yi) & 1)) continue;                 // fades out (dithered) toward the start
        idx[yi * W + xi] = q > 0.75 ? SMEAR_L : SMEAR_D;
      }
    }
  }
  // 2. arm + weapon (and the broken-off piece on its own path)
  const layers = [{ pose: f, part: f.broken ? 'base' : 'all' }];
  if (f.broken && f.debris) layers.push({ pose: f.debris, part: 'piece' });
  for (const L of layers) {
    const piece = L.part === 'piece';
    const pc = piece ? srcPoint(w, G.cut + (G.L - G.cut) / 2) : null;
    const a = rad(L.pose.a), s = K * (L.pose.s || 1), ca = Math.cos(-a), sa = Math.sin(-a);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, cov = 0;
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
        let px = x + (i + 0.5) / SS, py = y + (j + 0.5) / SS, sx, sy;
        if (piece) {                                   // the piece spins about its own centre
          const rx = (px - L.pose.c[0]) / s, ry = (py - L.pose.c[1]) / s;
          sx = pc[0] + rx * ca - ry * sa; sy = pc[1] + rx * sa + ry * ca;
        } else {
          const rx = (px - E_SCR[0] - (L.pose.dx || 0)) / s, ry = (py - E_SCR[1] - (L.pose.dy || 0)) / s;
          sx = E_SRC[0] + rx * ca - ry * sa; sy = E_SRC[1] + rx * sa + ry * ca;
        }
        const c = sample(buf, sx, sy, !piece);
        if (!c) continue;
        if (G.L) { const u = uOf(w, sx, sy); if (piece ? u < G.cut : (L.part === 'base' && u >= G.cut)) continue; }
        const al = c[3] / 255; r += c[0] * al; g += c[1] * al; b += c[2] * al; cov += al;
      }
      if (cov / (SS * SS) < 0.5) continue;
      const i = y * W + x; idx[i] = nearest(Math.round(r / cov), Math.round(g / cov), Math.round(b / cov)); solid[i] = 1;
    }
  }
  // 3. splinters
  for (const [x, y, c] of f.bits || []) { const xi = Math.round(x), yi = Math.round(y); if (xi >= 0 && yi >= 0 && xi < W && yi < H) { idx[yi * W + xi] = nearest(...c); solid[yi * W + xi] = 1; } }
  // 4. dark 1px outline around the solid shapes
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (idx[i] < 0) {
      let e = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && solid[yy * W + xx]) { e = true; break; } }
      if (e) idx[i] = OUTLINE; else continue;
    }
    const c = PAL[idx[i]]; out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
  }
  // 5. impact spark on the striking end (or the knuckles)
  if (f.spark) {
    const [sx, sy] = toScreen(f, ...(G.L ? srcPoint(w, G.L * 0.82) : G.punch)), r = f.spark;
    for (let k = 0; k < 8; k++) for (let t = r * 0.35; t <= r; t++) {
      const ang = k * Math.PI / 4 + 0.3, x = Math.round(sx + Math.cos(ang) * t), y = Math.round(sy + Math.sin(ang) * t);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const c = PAL[SPARK], i = (y * W + x) * 4; out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
    }
  }
  return out;
}

// ---------- animation keyframes: a = rotation about the wrist (deg, + is clockwise), dx/dy shift, s scale ----------
const idleOf = (a, dx = 0, dy = 0, s = 1) => [
  { a, dx, dy, s, ms: 260 }, { a: a + 0.8, dx, dy: dy + 1, s, ms: 260 }, { a: a + 1.6, dx, dy: dy + 2, s, ms: 300 }, { a: a + 0.8, dx, dy: dy + 1, s, ms: 260 },
];
const withSmear = list => list.map((f, i) => f.smear === true ? { ...f, smear: list[i - 1] } : f);
const F = (a, dx, dy, s, ms, extra = {}) => ({ a, dx, dy, s, ms, ...extra });
const A = {
  makeshift: {
    idle: idleOf(0),                                          // the painting's own diagonal, head up-left
    attack: withSmear([                                       // one diagonal slash: cock back up-left, cut down to the right
      F(-4, -6, -3, 1, 80),
      F(-8, -14, -7, 1.02, 120),
      F(-8, -15, -8, 1.02, 110),                              // brief hold
      F(4, -2, -2, 1, 45, { smear: true }),
      F(16, 10, 12, 1, 50, { smear: true, spark: 8, shake: 3 }),    // impact
      F(32, 26, 36, 1, 45, { smear: true }),                  // follow-through carries on down-right...
      F(48, 44, 66, 1, 50, { smear: true }),
      F(60, 62, 104, 1, 110),                                 // ...and out of frame
      F(36, 40, 70, 1, 70),                                   // back up into the guard
      F(14, 16, 28, 1, 80), F(3, 3, 6, 1, 90),
    ]),
  },
  itak: {
    idle: idleOf(-3),
    attack: withSmear([                                       // heavy diagonal chop: longer hold, bigger hit
      F(-4, -6, -3, 1, 90),
      F(-10, -16, -8, 1.02, 130),
      F(-11, -17, -9, 1.02, 170),                             // hold, the weight of the blade
      F(4, -3, -2, 1, 45, { smear: true }),
      F(18, 10, 12, 1, 50, { smear: true, spark: 9, shake: 4 }),    // impact
      F(34, 26, 36, 1, 45, { smear: true }),
      F(50, 44, 66, 1, 50, { smear: true }),
      F(62, 62, 104, 1, 120),
      F(36, 40, 70, 1, 75), F(14, 16, 28, 1, 85), F(2, 3, 6, 1, 95),
    ]),
  },
  arnis: {
    idle: idleOf(-2),
    attack: withSmear([                                       // fast, light rattan strike: short wind-up, quick snap through
      F(-6, -10, -5, 1.01, 60),
      F(-9, -14, -7, 1.02, 70),
      F(6, -2, -2, 1, 35, { smear: true }),
      F(20, 10, 12, 1, 40, { smear: true, spark: 6, shake: 1 }),    // impact
      F(36, 28, 38, 1, 40, { smear: true }),
      F(52, 46, 70, 1, 45, { smear: true }),
      F(60, 62, 104, 1, 80),
      F(34, 38, 66, 1, 55), F(12, 14, 24, 1, 65), F(2, 2, 5, 1, 75),
    ]),
  },
  pipe: {
    idle: idleOf(-2),
    attack: withSmear([                                       // solid, weighty swing: a beat slower than the makeshift
      F(-4, -6, -3, 1, 85),
      F(-9, -15, -8, 1.02, 120),
      F(-10, -16, -9, 1.02, 150),
      F(4, -2, -2, 1, 45, { smear: true }),
      F(17, 10, 12, 1, 50, { smear: true, spark: 9, shake: 3 }),    // impact: metal clang
      F(33, 26, 36, 1, 45, { smear: true }),
      F(49, 44, 66, 1, 50, { smear: true }),
      F(61, 62, 104, 1, 115),
      F(36, 40, 70, 1, 70), F(14, 16, 28, 1, 80), F(2, 3, 6, 1, 90),
    ]),
  },
  fist: {
    idle: idleOf(35),                                         // guard: fist low in the corner, tilted up-left
    attack: [                                                 // jab: drives toward the centre and shrinks with distance
      F(42, 4, 6, 1.02, 70), F(22, -14, -20, 0.9, 50),
      F(12, -28, -42, 0.8, 70, { spark: 6, shake: 2 }),
      F(20, -16, -22, 0.9, 90), F(32, -2, 0, 0.98, 90),
    ],
    raise: [F(35, 4, 70, 1, 70), F(35, 3, 40, 1, 70), F(35, 2, 16, 1, 80), F(35, 1, 4, 1, 120)],
  },
};
// break: the last hit of a worn weapon — the head snaps off and tumbles, then the empty arm drops away
const WOOD = { makeshift: [116, 80, 47], itak: [150, 152, 150], arnis: [205, 168, 98], pipe: [160, 164, 166] };
function breakOf(w, hitIndex) {
  usePlace(w);
  const atk = A[w].attack, hit = atk[hitIndex], G = GEO[w];
  const c0 = toScreen(hit, ...srcPoint(w, G.cut + (G.L - G.cut) / 2));
  const frames = atk.slice(0, hitIndex).map(f => ({ ...f }));
  for (let k = 0; k < 8; k++) {
    const debris = { c: [c0[0] + 2.4 * k, c0[1] - 5 * k + 2.2 * k * k], a: hit.a + 28 * k, s: hit.s || 1 };
    const bits = k < 4 ? Array.from({ length: 5 }, (_, j) => [c0[0] + (j - 2) * (2 + k * 1.5), c0[1] - 3 + k * (j % 2 ? 3 : 1.5), WOOD[w]]) : [];
    frames.push({ a: hit.a + k * 3, dx: (hit.dx || 0) + k * 3, dy: (hit.dy || 0) + k * k * 2, s: hit.s, ms: k ? 75 : 70,
      broken: true, debris, bits, spark: k === 0 ? 8 : 0, shake: k === 0 ? 3 : 0 });
  }
  frames.push({ a: hit.a + 30, dx: (hit.dx || 0) + 30, dy: (hit.dy || 0) + 150, ms: 140, broken: true });
  return frames;
}
A.makeshift.break = breakOf('makeshift', 4);
A.itak.break = breakOf('itak', 4);
A.arnis.break = breakOf('arnis', 3);
A.pipe.break = breakOf('pipe', 4);

// ---------- render everything ----------
const manifest = { W, H, anims: {} };
for (const [w, anims] of Object.entries(A)) for (const [name, frames] of Object.entries(anims)) {
  const raw = Buffer.concat(frames.map(f => render(w, f)));
  fs.writeFileSync(path.join(OUT, `${w}-${name}.raw`), raw);
  manifest.anims[`${w}-${name}`] = frames.map(f => ({ ms: f.ms, shake: f.shake || 0 }));
  process.stdout.write(`${w}-${name}:${frames.length} `);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log('\ndone');
