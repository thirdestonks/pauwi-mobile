
(() => {
const W = 110, H = 225, R = 17, SQ = 0.62, S3 = Math.sqrt(3);
const JX = 55, JY = 128;
const LM = { q: 14, r: -44 };
const SHELTERS = {
  nida: { q: 0, r: -1, h: 23, roof: 'rust', name: "Nida's Sari-Sari Store", desc: "Nida's store. Home." },
  t10: { q: 5, r: -8, h: 34, roof: 'tin', name: 'Tenement 10', desc: 'A stairwell behind a rusted gate. Dry, five floors up, and a door that locks. You could make this the new shelter.' },
  brgy: { q: 6, r: 3, h: 23, roof: 'tin', name: 'Barangay 43 Hall', desc: "The barangay hall's gate hangs open. A desk, a chair, a radio that might still reach someone, and walls the tanods once guarded. You could make this the new shelter." },
  mm: { q: -5, r: -3, h: 28, roof: 'patch', name: "Mang Mel's Bike Shop", desc: "Mang Mel's shutter is half up. Tools on the wall, a bench to sleep on, and bicycles that could still carry you far. You could make this the new shelter." },
};
let home = 'nida';
const shelterAt = (q, r) => Object.keys(SHELTERS).find(k => SHELTERS[k].q === q && SHELTERS[k].r === r);
const frontOf = k => [SHELTERS[k].q, SHELTERS[k].r + 1];
const DROPS = Array.from({ length: 60 }, (_, i) => ({ x: hash(i, 1, 30) * W, y: hash(i, 2, 30) * H, v: 2.2 + hash(i, 3, 30) * 1.6 }));                                // Tutuban, far to the north-east                                     // Juan's hex centre on screen
let facing = 1;
let mode = 'night', jq = 0, jr = 0, cq = 0, cr = 0, walk = null, rain = true;
let moves = 5, cycleN = 1, usedThisCycle = 0, clearedThisCycle = 0, busy = false;
const visited = new Set(['0,0']);          // jq/jr: Juan's hex; cq/cr: where the camera is (glides)

// ---------- noise ----------
function hash(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mod = (a, n) => ((a % n) + n) % n;
const BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]].map(r => r.map(v => (v + .5) / 16));

// ---------- hex math (flat-top axial, squashed vertically) ----------
const dist = (q1, r1, q2, r2) => hexDist(q1, r1, q2, r2);
const hexDist = (q1, r1, q2, r2) => (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
const NB = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
function centre(q, r) { return [JX + R * 1.5 * (q - cq), JY + R * S3 * ((r - cr) + (q - cq) / 2) * SQ]; }
function inHex(dx, dy) { const u = Math.abs(dx), v = Math.abs(dy / SQ); return v <= S3 / 2 * R && S3 * u + v <= S3 * R; }
function pixelHex(x, y) {                                     // which hex a ground pixel belongs to
  const px = x - JX, py = (y - JY) / SQ;
  const qf = (2 / 3 * px) / R, rf = (-1 / 3 * px + S3 / 3 * py) / R;
  let q = Math.round(qf), r = Math.round(rf), s = Math.round(-qf - rf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s + qf + rf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return [q + Math.round(cq), r + Math.round(cr)];
}

// ---------- Tondo, generated per coordinate (sparse: nothing is pre-built) ----------
const SHOPS = ['botika', 'kwik', 'water', 'kainan', 'diner', 'store'];
function baseHouse(q, r) {                                     // the plain generator's answer, without shelters or shops
  const s = -q - r, road = mod(q, 5) === 0 || mod(s, 6) === 0;
  return !road && hexDist(q, r, 0, 0) > 1 && vnoise(q * 0.45, r * 0.45, 3) > 0.38 && hash(q, r, 7) > 0.22;
}
function tile(q, r) {
  const s = -q - r;
  const road = mod(q, 5) === 0 || mod(s, 6) === 0;
  const near = hexDist(q, r, 0, 0) <= 1;
  const dl = hexDist(q, r, LM.q, LM.r);
  if (dl <= 1) return { type: 'landmark', q, r, h: 0 };                         // Tutuban itself (7 hexes)
  if (dl <= 3) return { type: 'alley', q, r, h: 0, plaza: true };               // its open plaza
  const sk = shelterAt(q, r);
  if (sk) return { type: 'house', q, r, h: SHELTERS[sk].h, roof: SHELTERS[sk].roof, wall: '#8a7f6e', front: sk };   // shelters: painted fronts
  if (Object.keys(SHELTERS).some(k => frontOf(k)[0] === q && frontOf(k)[1] === r)) return { type: mod(q, 5) === 0 ? 'road' : 'alley', q, r, h: 0 };
  let type = 'alley';
  if (road) type = 'road';
  else if (!near && vnoise(q * 0.45, r * 0.45, 3) > 0.38 && hash(q, r, 7) > 0.22) type = 'house';
  const t = { type, q, r, h: 0 };
  if (type === 'house') {
    t.h = 16 + Math.floor(hash(q, r, 1) * 3) * 6;                         // one to three floors
    if (hash(q, r, 40) > 0.86 && !baseHouse(q, r + 1) && !Object.keys(SHELTERS).some(k => frontOf(k)[0] === q && frontOf(k)[1] === r + 1)) {
      t.front = SHOPS[Math.floor(hash(q, r, 41) * SHOPS.length)]; t.h = Math.max(t.h, 22);   // a shopfront facing the street
    }
    const k = hash(q, r, 2);
    t.roof = k > 0.84 ? 'tarp' : k > 0.62 ? 'patch' : k > 0.3 ? 'rust' : 'tin';
    t.wall = ['#7b7a72', '#8a7f6e', '#6f7d86', '#86786f'][Math.floor(hash(q, r, 3) * 4)];
    t.tire = hash(q, r, 4) > 0.7;
  }
  if (type === 'road' && hash(q, r, 5) > 0.93) t.lamp = true;
  if (type === 'alley' && hash(q, r, 6) > 0.75) t.puddle = true;
  if (type !== 'house' && hash(q, r, 8) > 0.85) t.trash = true;
  return t;
}

// what each walkable tile holds (rules: nothing / location / zombie / event; loot shows as a scavenge spot)
function content(q, r) {
  const fk = Object.keys(SHELTERS).find(k => frontOf(k)[0] === q && frontOf(k)[1] === r);
  if (fk) return fk === home ? 'shelter' : 'relocate';
  const above = tile(q, r - 1);
  if (above.front && SHOPS.includes(above.front)) return 'shop';
  if (tile(q, r).type === 'house' || tile(q, r).type === 'landmark') return null;
  if (hexDist(q, r, LM.q, LM.r) === 2) return 'tutuban';
  const k = hash(q, r, 20);
  return k < 0.12 ? 'zombie' : k < 0.22 ? 'loot' : k < 0.29 ? 'event' : 'nothing';
}
const key = (q, r) => q + ',' + r;

// ---------- draw ----------
const cv = document.getElementById('c'), ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
const EM = new Uint8Array(W * H);                          // 1 = edge of a cleared (free) hex
const R_ = new Float32Array(W * H), G_ = new Float32Array(W * H), B_ = new Float32Array(W * H), HX = new Int32Array(W * H * 2);
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function put(x, y, c, hq, hr) {
  x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x; R_[i] = c[0]; G_[i] = c[1]; B_[i] = c[2]; HX[i * 2] = hq; HX[i * 2 + 1] = hr;
}
const NB_ANG = NB.map(([a, b]) => { const x = 1.5 * a, y = S3 * (b + a / 2); return Math.atan2(y, x); });
function edgeDir(dx, dy) {                                   // which neighbour an edge pixel faces
  const a = Math.atan2(dy / SQ, dx); let best = 0, bd = 9;
  NB_ANG.forEach((n, i) => { const d = Math.abs(Math.atan2(Math.sin(a - n), Math.cos(a - n))); if (d < bd) { bd = d; best = i; } });
  return NB[best];
}
const isHouse = (q, r) => tile(q, r).type === 'house';
// roof textures (painted by Nano Banana, shrunk to 40px tiles): rust | galvanised tin | tarp with tyres | patchwork
const ROOF_I = { rust: 0, tin: 1, tarp: 2, patch: 3 }, RT = 40; let ROOF = null;
{ const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = RT * 4; c.height = RT;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); ROOF = x.getImageData(0, 0, RT * 4, RT).data; };
  im.src = '<b64>'; }
// wall facade strip (92x28, two floors) and Nida's storefront (34x23), painted by Nano Banana
let WALL = null, NIDA = null;
function loadTex(b64, w, h, set) { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); set(x.getImageData(0, 0, w, h).data); }; im.src = 'data:image/png;base64,' + b64; }
const FRONT = {};
loadTex('<b64>', 34, 23, d => FRONT.brgy = d);
loadTex('<b64>', 34, 23, d => FRONT.botika = d);
loadTex('<b64>', 34, 23, d => FRONT.kwik = d);
loadTex('<b64>', 34, 23, d => FRONT.water = d);
loadTex('<b64>', 34, 23, d => FRONT.kainan = d);
// the diner and the store, painted by Nano Banana (the store's sign is melted into a plain panel: no real brand)
loadTex('<b64>', 34, 23, d => FRONT.diner = d);
loadTex('<b64>', 34, 23, d => FRONT.store = d);
let GROUND = null, TUT = null;
const SPR = {};
loadTex('<b64>', 60, 28, d => SPR.JUAN = { d, w: 60, h: 28 });
loadTex('<b64>', 16, 14, d => SPR.bag = { d, w: 16, h: 14 });
loadTex('<b64>', 24, 12, d => SPR.body = { d, w: 24, h: 12 });
loadTex('<b64>', 14, 10, d => SPR.radio = { d, w: 14, h: 10 });
loadTex('<b64>', 18, 13, d => SPR.supply = { d, w: 18, h: 13 });
loadTex('<b64>', 106, 37, d => SPR.TCLOSE = { d, w: 106, h: 37 });
function blit(name, ax, ay, q, r, { frame = 0, frames = 1, mirror = false, anchor = 'bottom' } = {}) {
  const S_ = SPR[name]; if (!S_) return false;
  const fw = S_.w / frames, ox = Math.round(ax - fw / 2), oy = Math.round(anchor === 'bottom' ? ay - S_.h : ay - S_.h / 2);
  for (let y = 0; y < S_.h; y++) for (let x = 0; x < fw; x++) {
    const sx = frame * fw + (mirror ? fw - 1 - x : x), j = (y * S_.w + sx) * 4;
    if (S_.d[j + 3]) put(ox + x, oy + y, [S_.d[j], S_.d[j + 1], S_.d[j + 2]], q, r);
  }
  return true;
}
loadTex('<b64>', 128, 32, d => GROUND = d);
loadTex('<b64>', 48, 15, d => TUT = d);
loadTex('<b64>', 34, 23, d => FRONT.mm = d);
loadTex('<b64>', 34, 23, d => FRONT.t10 = d);
loadTex('<b64>', 92, 28, d => WALL = d);
loadTex('<b64>', 34, 23, d => { NIDA = d; FRONT.nida = d; });
const texAt = (D, w, u, v) => { const i = (v * w + u) * 4; return [D[i], D[i + 1], D[i + 2]]; };
function roofTex(kind, wx, wy) {
  if (!ROOF) return kind === 'tarp' ? [44, 82, 132] : kind === 'tin' ? [112, 116, 118] : [118, 64, 40];
  const u = mod(Math.floor(wx), RT) + ROOF_I[kind] * RT, v = mod(Math.floor(wy / SQ), RT), i = (v * RT * 4 + u) * 4;
  return [ROOF[i], ROOF[i + 1], ROOF[i + 2]];
}
const JUAN = ['..ccc..', '.ccccc.', '..sss..', '..sss..', '.jjjjj.', 'jjjJjjj', 'jjjJjjj', 's.jJj.s', '..ppp..', '..p.p..', '..p.p..', '..p.p..', '.bb.bb.'];
const WALK_A = ['..p.p..', '.p...p.', '.p...p.', 'bb...bb'], WALK_B = ['..p.p..', '..pp...', '..pp...', '..bbb..'];
const JCOL = { c: [196, 150, 52], s: [176, 122, 84], j: [96, 104, 62], J: [64, 70, 42], p: [52, 54, 58], b: [92, 64, 40] };

const GLOW = new Map();
function glowOf(q, r) {                                        // purple: unsearched shopfront · orange: a shelter you could move to
  if (q === -9999) return null;
  const k = q + ',' + r; if (GLOW.has(k)) return GLOW.get(k);
  const t = tile(q, r); let c = null;
  if (t.front && SHOPS.includes(t.front) && !visited.has(key(q, r + 1))) c = [168, 96, 236];
  else if (t.front && SHELTERS[t.front] && t.front !== home) c = [244, 150, 56];
  GLOW.set(k, c); return c;
}
function draw(T) {
  GLOW.clear();
  // hexes within view, far (top) first so nearer ones overlap them
  const list = [];
  for (let dq = -6; dq <= 6; dq++) for (let dr = -10; dr <= 10; dr++) {
    const q = Math.round(cq) + dq, r = Math.round(cr) + dr, [cx, cy] = centre(q, r);
    if (cx < -R * 2 || cx > W + R * 2 || cy < -R * 3 || cy > H + R * 2) continue;
    list.push([cy, q, r, cx]);
  }
  list.sort((a, b) => a[0] - b[0]);
  R_.fill(0); G_.fill(0); B_.fill(0); HX.fill(-9999); EM.fill(0);
  for (const [cy, q, r, cx] of list) {
    const t = tile(q, r);
    // ground
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (!inHex(dx, dy)) continue;
      const wx = x - cx + q * R * 1.5, wy = y - cy + (r + q / 2) * R * S3 * SQ;       // world-ish texture coords so ground doesn't swim
      let c;
      // painted ground: asphalt for roads, concrete or gravel patchwork for alleys, mud for puddles
      const gi = t.type === 'road' ? 0 : t.puddle && Math.hypot(dx * 0.8, dy / SQ) < R * 0.55 ? 2 : hash(q, r, 42) > 0.6 ? 3 : 1;
      if (GROUND) c = texAt(GROUND, 128, mod(Math.floor(wx), 32) + gi * 32, mod(Math.floor(wy / SQ), 32));
      else c = t.type === 'road' ? [62, 64, 68] : [90, 86, 76];
      if (t.trash && Math.hypot(dx - 4, dy - 1) < 3) c = [60 + hash(x, y, 3) * 60, 50, 40];
      // faint hex edge lines on the ground
      const u = Math.abs(dx), v = Math.abs(dy / SQ);
      const edge = Math.max(v - (S3 / 2 * R - 1), (S3 * u + v) - (S3 * R - 1.6)) > 0;
      if (edge) c = c.map(k => k + 22);
      put(x, y, c, q, r);
      if (edge && visited.has(key(q, r)) && !(q === jq && r === jr)) EM[y * W + x] = 1;   // cleared ground: free to cross
    }
    if (t.lamp) for (let k = 0; k < 26; k++) put(cx + 5, cy - k, [40, 40, 44], q, r);
    const ct = content(q, r), near = hexDist(q, r, jq, jr) === 1 && !visited.has(key(q, r));
    if (near && ct === 'loot') blit(hash(q, r, 50) > 0.5 ? 'supply' : 'bag', cx, cy + 3, q, r);            // a dropped bag or a supply pile
    else if (near && ct === 'zombie') blit('body', cx, cy + 4, q, r);                                         // a body in its blood: danger
    else if (near && ct === 'event') {                                                                        // a radio, its light blinking
      blit('radio', cx, cy + 3, q, r);
      if (Math.floor(T / 400) % 2) put(cx + 2, cy - 2, [80, 230, 120], q, r);
    }
    // raised houses: walls, then the roof sitting h pixels up
    if (t.type === 'house') {
      const wall = hex2rgb(t.wall);
      for (let y = Math.floor(cy - R - t.h); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (inHex(dx, dy + t.h)) {                                   // roof
          // painted roof textures, sampled in world space so neighbouring roofs continue seamlessly
          let c = roofTex(t.roof, x - cx + q * R * 1.5, (dy + t.h) + (r + q / 2) * R * S3 * SQ);
          if (Math.abs(dy + t.h) / SQ > S3 / 2 * R - 1.2 || S3 * Math.abs(dx) + Math.abs((dy + t.h) / SQ) > S3 * R - 2) {
            const [eq, er] = edgeDir(dx, dy + t.h), n = tile(q + eq, r + er);
            if (n.type !== 'house' || n.h < t.h) c = c.map(v => v * 0.7);      // rim only where the block ends or steps down
          }
          put(x, y, c, q, r);
          continue;
        }
        let side = false;
        for (let k = 0; k <= t.h; k++) if (inHex(dx, dy + k)) { side = true; break; }
        if (!side) continue;
        const fn = dx < -R * 0.5 ? [-1, 1] : dx > R * 0.5 ? [1, 0] : [0, 1];   // the neighbour this face looks at
        const nb = tile(q + fn[0], r + fn[1]);
        if (nb.type === 'house' && nb.h >= t.h) continue;                      // shared wall: hidden inside the block
        const face = dx < -R * 0.5 ? 0.62 : dx > R * 0.5 ? 0.85 : 0.74;      // three visible faces
        const ground = cy + Math.min(S3 / 2 * R, S3 * (R - Math.abs(dx))) * SQ;  // where this column of wall meets the ground
        const fy = Math.max(0, Math.floor(ground - (y + 0.5)));               // height up the wall
        let c;
        if (t.front && FRONT[t.front] && fy < 23) {                           // a shelter's painted ground floor wraps the front
          const u = clamp(Math.floor((dx + R) / (2 * R) * 34), 0, 33), v = clamp(22 - fy, 0, 22);
          c = texAt(FRONT[t.front], 34, u, v).map(k => k * (0.82 + face * 0.25));
        } else if (WALL) {                                                    // facade strip, each house starts at its own spot
          const u = mod(Math.floor(x - cx + q * R * 1.5 + hash(q, r, 12) * 92), 92), v = clamp(27 - fy, 0, 27);
          c = texAt(WALL, 92, u, v).map(k => k * (face + 0.12));
        } else c = wall.map(v => v * face);
        put(x, y, c, q, r);
      }
    }
  }
  // Juan on his pale hex
  const [jx0, jy0] = centre(cq, cr), jx = Math.round(jx0), jy = Math.round(jy0);
  if (walk && walk.tq !== walk.fq) facing = walk.tq < walk.fq ? -1 : 1;
  const step = walk ? Math.floor(walk.t * 4) % 2 : -1;
  if (dist(jq, jr, LM.q, LM.r) <= 9) blit('TCLOSE', ...centre(LM.q, LM.r), LM.q, LM.r, { anchor: 'centre' });   // Tutuban up close
  if (!blit('JUAN', jx, jy + 4, jq, jr, { frames: 4, frame: step === 0 ? 1 : 0, mirror: facing < 0 }))
    JUAN.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch !== '.') put(jx - 3 + xx, jy - 13 + yy, JCOL[ch], jq, jr); }));

  // light = fog of war: flashlight at night, fog by day, quantised with dither
  const night = mode === 'night';
  const fog = [118, 128, 124];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, hq = HX[i * 2], hr = HX[i * 2 + 1];
    const ring = hq === -9999 ? 99 : hexDist(hq, hr, jq, jr);
    const d = Math.hypot(x - jx, (y - jy + 4) / SQ);                         // distance on the ground plane
    let r = R_[i], g = G_[i], b = B_[i];
    if (night) {
      let L = Math.pow(clamp(1 - d / 82, 0, 1), 1.1) * (0.97 + 0.03 * Math.sin(T * 0.023));   // flashlight pocket
      if (ring >= 2) L *= 0.7; if (ring > 3) L = visited.has(key(hq, hr)) ? 0.16 : 0;
      if (hq === SHELTERS[home].q && hr === SHELTERS[home].r) L = Math.max(L, 0.55);                                   // Nida's light is always on           // cleared ground is remembered                                            // gloom, then nothing
      L = Math.floor(L * 6 + BAYER[y & 3][x & 3]) / 6;                                         // banded, dithered
      const amb = ring <= 3 ? 0.1 : 0;
      r = r * (amb * 0.8 + L * 1.05); g = g * (amb * 0.9 + L * 0.98); b = b * (amb * 1.3 + L * 0.86);
    } else {
      let f = clamp((d - 34) / 70, 0, 1); if (ring > 3) f = visited.has(key(hq, hr)) ? 0.72 : 1;
      f = clamp(f + 0.12 * (vnoise(x * 0.06 + T * 0.0004, y * 0.08, 5) - 0.5), 0, 1);
      f = Math.floor(f * 6 + BAYER[y & 3][x & 3]) / 6;
      r = r * 0.92 + (fog[0] - r * 0.92) * f; g = g * 0.96 + (fog[1] - g * 0.96) * f; b = b * 0.95 + (fog[2] - b * 0.95) * f;
    }
    const gk = glowOf(hq, hr);                                     // special places pulse faintly, even in the dark
    if (gk) { const k = (night ? 0.2 : 0.14) * (0.65 + 0.35 * Math.sin(T * 0.0025 + (hq + hr) * 0.7));
      r += (gk[0] - r) * k; g += (gk[1] - g) * k; b += (gk[2] - b) * k; }
    if (EM[i] && R_[i] === R_[i] && HX[i * 2] === hq) {                     // jeepney-green outline, faintly glowing even in the dark
      const k = ring <= 3 ? 0.55 : 0.32;
      r += (90 - r) * k; g += (161 - g) * k; b += (122 - b) * k;
    }
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255;
  }
  if (night && rain) for (const d of DROPS) {                    // light drizzle, catching the flashlight near Juan
    d.y = (d.y + d.v) % (H + 6); const x = Math.round(((d.x - d.y * 0.3) % W + W) % W), y = Math.round(d.y);
    const lit = Math.max(0, 1 - Math.hypot(x - jx, (y - jy) / SQ) / 70);
    for (let k = 0; k < 3; k++) { const i = (y - k) * W + x; if (i < 0 || i >= W * H) continue;
      px[i * 4] += 18 + lit * 70; px[i * 4 + 1] += 20 + lit * 64; px[i * 4 + 2] += 30 + lit * 50; }
  }
  // landmark: Tutuban stays visible far off, whatever the fog
  const dq = LM.q - cq, dr = LM.r - cr, wxp = 1.5 * dq, wyp = S3 * (dr + dq / 2), ang = Math.atan2(wyp, wxp);
  const lx = Math.round(clamp(JX + Math.cos(ang) * 80, 14, W - 14)), ly = Math.round(clamp(JY + Math.sin(ang) * 140, 18, H - 30));
  if (TUT && dist(jq, jr, LM.q, LM.r) > 9) {                  // Tutuban's painted silhouette, lost in fog or night
    const tint = night ? [26, 30, 54] : [118, 128, 124], k = night ? 0.72 : 0.6;
    const ox = Math.round(lx - 48 / 2), oy = Math.round(clamp(ly, 15 + 4, H) - 15);
    for (let y = 0; y < 15; y++) for (let x = 0; x < 48; x++) {
      const j = (y * 48 + x) * 4; if (!TUT[j + 3]) continue;
      const sx = ox + x, sy = oy + y; if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
      const i = sy * W + sx;
      px[i * 4] = TUT[j] + (tint[0] - TUT[j]) * k; px[i * 4 + 1] = TUT[j + 1] + (tint[1] - TUT[j + 1]) * k; px[i * 4 + 2] = TUT[j + 2] + (tint[2] - TUT[j + 2]) * k;
    }
  }
  document.getElementById('lmtag').textContent = `TUTUBAN · ${hexDist(LM.q, LM.r, jq, jr)} TILES LEFT`;
  const hudKey = mode + cycleN + ':' + moves;
  if (hudKey !== lastHud) { lastHud = hudKey;
    document.getElementById('cycle').innerHTML = `<img src="../encounters/src/ui/icon-${night ? 'night' : 'day'}.png" alt=""> ${night ? 'NIGHT' : 'DAY'} ${cycleN}`;
    document.getElementById('moves').innerHTML = Array.from({ length: Math.max(5, moves) }, (_, i) => `<img src="../encounters/src/ui/icon-move.png" alt=""${i < moves ? '' : ' class="spent"'}>`).join('');
  }
  ctx.putImageData(img, 0, 0);
}

let lastT = 0, lastHud = '';
function loop(T) {
  const dt = Math.min(60, T - (lastT || T)); lastT = T;
  if (walk) {                                                   // glide the camera from hex to hex
    walk.t = Math.min(1, walk.t + dt / 380);
    const e = walk.t < 0.5 ? 2 * walk.t * walk.t : 1 - (-2 * walk.t + 2) ** 2 / 2;
    cq = walk.fq + (walk.tq - walk.fq) * e; cr = walk.fr + (walk.tr - walk.fr) * e;
    if (walk.t >= 1) { cq = walk.tq; cr = walk.tr; const then = walk.then; walk = null; if (then) then(); }
  }
  const inside = inShelter;
  SFX.bed('rain-1', mode === 'night' && rain && !inside, 0.22); SFX.bed('rain-indoor', inside, 0.4);   // rain stays under everything
  SFX.bed('day-sound', mode === 'day' && !inside, 0.5);
  SFX.bed('indoor_radio-event', !$('scene').hidden && $('scene').src.includes('scene=radio'), 0.6);              // the radio, while you listen                                                // the street by day
  draw(T); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// on the green (cleared) path Juan dashes two hexes per tap: the hex between and the one he lands on must both be cleared
function dashVia(q, r) {
  if (hexDist(q, r, jq, jr) !== 2 || !visited.has(key(q, r))) return null;
  for (const [dq, dr] of NB) { const mq = jq + dq, mr = jr + dr;
    if (hexDist(mq, mr, q, r) === 1 && visited.has(key(mq, mr))) return [mq, mr]; }
  return null;
}
cv.onpointermove = e => {
  const b = cv.getBoundingClientRect(), [q, r] = pixelHex((e.clientX - b.left) / b.width * W, (e.clientY - b.top) / b.height * H), el = document.getElementById('cost');
  if (!busy && dashVia(q, r)) { el.textContent = 'DASH · FREE'; el.style.color = '#5AA17A'; return; }
  if (busy || hexDist(q, r, jq, jr) !== 1 || tile(q, r).type === 'house') { el.textContent = ''; return; }
  const free = visited.has(key(q, r));
  el.textContent = free ? 'STEP · FREE' : moves > 0 ? 'STEP · 1 MOVE' : 'NO MOVES LEFT';
  el.style.color = free ? '#5AA17A' : moves > 0 ? '#F0A63C' : '#D94B3B';
};
cv.onpointerleave = () => { document.getElementById('cost').textContent = ''; };
cv.onclick = e => {
  const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * W, y = (e.clientY - b.top) / b.height * H;
  const [q, r] = pixelHex(x, y);
  const via = !walk && !busy && dashVia(q, r);
  if (via) {                                                    // glide through the middle hex, then on to the landing one
    const offer = content(q, r) === 'relocate';
    SFX.play('juan-walkstep-map', 0.8);
    walk = { fq: jq, fr: jr, tq: via[0], tr: via[1], t: 0, then: () => { SFX.play('juan-walkstep-map', 0.8); walk = { fq: via[0], fr: via[1], tq: q, tr: r, t: 0, then: offer ? () => arrive(q, r) : null }; jq = q; jr = r; } };
    jq = via[0]; jr = via[1]; return;
  }
  if (walk || busy || hexDist(q, r, jq, jr) !== 1 || tile(q, r).type === 'house' || tile(q, r).type === 'landmark') return;
  const fresh = !visited.has(key(q, r));
  if (fresh && moves <= 0) return flashMoves();
  if (fresh) { moves--; usedThisCycle++; }
  const offer = content(q, r) === 'relocate';
  SFX.play('juan-walkstep-map', 0.8);
  walk = { fq: jq, fr: jr, tq: q, tr: r, t: 0, then: fresh || offer ? () => arrive(q, r) : null }; jq = q; jr = r;
};
const SHOP_CARDS = {
  botika: ['Botika', 'The grille is pried open. Behind the counter: a roll of bandage and a strip of antibiotics nobody took.', 'Bandage +1, medicine +1.'],
  kwik: ['Kwik Mart 24', 'Glass crunches underfoot. Most shelves are bare, but two cans of sardines rolled under the freezer.', 'Canned food +2.'],
  water: ['Water Refilling', 'Stacked gallons, most cracked. One is still sealed, sloshing and clean.', 'Clean water +1.'],
  kainan: ['Kainan', 'Pots on the counter, lids on. Most of it has turned, but there is dry rice in a sack under the table.', 'Rice +1.'],
};
const CARDS = {
  relocate: ['Tenement 10', 'A stairwell behind a rusted gate. Dry, five floors up, and a door that locks. You could make this the new shelter.', [['Relocate here', 'relocate'], ['Not yet', 'You note the way back here.']]],
  loot: ['A dropped backpack', 'Torn straps, half-zipped, still heavy with something.', [['Search it', '+1 item: a roll of bandage.'], ['Leave it', 'You leave it where it fell.']]],
  zombie: ['Something moves', 'A body by the curb twitches, then sits up. Its head turns toward your light.', [['Fight', 'combat'], ['Back off', 'You back away slowly. It loses interest. For now.']]],
  event: ['A crackling radio', 'Static, then a voice: "...evacuation boats... North Harbor... every third night..."', [['Listen', 'You memorise the schedule. Hope +1.'], ['Switch it off', 'Silence. Better not to draw anything here.']]],
  tutuban: ['Tutuban', "You made it. The old station's clock stopped at 4:12. Behind it is the mall where you used to work, every window dark. Buses sit where they died in the plaza. Somewhere in there might be what you came for. Then the plaza shudders: something huge shoulders through the dead buses toward you.", [['Fight it', 'boss'], ['Back off', 'You back into the dark between the buses. It loses you, for now. It is still there.']]],
  nothing: null,
};
// salvage: every spot rolls 3 things from its loot table; Juan can carry one out. id → [name, what a tap shows, what taking it gets him]
const ITEM = {
  sledge: ['Sledgehammer', 'Hits like a truck, but the handle is cracked.', 'The sledgehammer. One or two swings drop anything, but it won\'t last long.'],
  pipe: ['Lead pipe', 'Heavy, and it won\'t snap.', 'A length of lead pipe. A solid weapon that wears down slowly.'],
  flares: ['Road flares', 'Three of them, still sealed.', 'Three road flares. Light one at night and the dark pulls back, and the Shamblers with it.'],
  straps: ['Ratchet straps', 'Good for lashing a door shut.', 'Two ratchet straps. Lashed across the shelter door, they hold. Hope +1.'],
  firstaid: ['First-aid kit', 'A car kit, never opened.', 'A first-aid kit: bandages and antiseptic. Bandage +2.'],
  jerrycan: ['Jerry can', 'Half full. It sloshes.', 'A jerry can of petrol. Somebody, somewhere, will trade a lot for this.'],
  water: ['Bottled water', 'Two sealed bottles.', 'Two sealed bottles. Clean water +2.'],
  butane: ['Butane canister', 'Full, for a camp stove.', 'A full canister for the shelter\'s little stove. Hot food tonight: Energy +1.'],
  beef: ['Corned beef', 'A can somebody left behind, unopened.', 'A can of corned beef. Canned food +1.'],
  rice: ['Rice', 'A small sack, dry inside.', 'A sack of rice. Rice +1, enough for days.'],
  sardines: ['Sardines ×2', 'Two cans in tomato sauce.', 'Two cans of sardines. Canned food +2.'],
  meds: ['Paracetamol', 'A strip, half full.', 'A strip of paracetamol. Medicine +1.'],
  batteries: ['Batteries', 'A four-pack of D cells.', 'A four-pack of D batteries. The flashlight stays strong all night.'],
};
Object.assign(ITEM, {
  pistol: ['9mm pistol', 'Somebody\'s sidearm, left in the car. The magazine is empty.', 'A 9mm pistol. It hits hard at any distance, but every shot needs a round, and it\'s loud.'],
  ammo: ['Box of 9mm', 'A battered box of rounds, still heavy.', 'A box of 9mm: a full magazine, 6 rounds.'],
  rounds: ['Loose rounds', 'A few brass rounds rolling loose.', 'Three loose 9mm rounds.'],
  itak: ['Itak', "A farmer's machete, the edge still keen.", 'The itak. It cuts deep (3 a swing) but dulls after about 8.'],
  arnis: ['Arnis stick', 'A rattan fighting stick, light and quick.', 'An arnis stick. It hits light (2 a swing) but lasts a long time, about 16 swings.'],
  bandage: ['Bandage', 'A clean roll, still wrapped.', 'A roll of bandage. Bandage +1.'],
  gauze: ['Gauze', 'A roll of gauze for dressing a wound.', 'A roll of gauze. Bandage +1.'],
  antibiotics: ['Antibiotics', 'A box nobody thought to take.', "A strip of antibiotics. Medicine +1, for an infection that won't quit."],
  alcohol: ['Rubbing alcohol', 'Half a bottle. It still stings the nose.', 'A bottle of rubbing alcohol. Cleans a wound, and burns well.'],
  vitamins: ['Vitamins', 'A bottle, rattling.', 'A bottle of vitamins. Health recovers a little faster.'],
  painkillers: ['Painkillers', 'A bottle of ibuprofen, half full.', 'A bottle of painkillers. Medicine +1.'],
  noodles: ['Instant noodles', 'A pack, crushed but sealed.', 'A pack of instant noodles. Food +1.'],
  tuna: ['Canned tuna', 'One can, no dents.', 'A can of tuna. Canned food +1.'],
  crackers: ['Crackers', 'A pack of crackers, still crisp.', 'A pack of crackers. Food +1, and light to carry.'],
  matches: ['Matches', 'A full box, dry.', 'A box of matches. Fire for the stove, the lamp, or a signal.'],
  tuyo: ['Dried fish', 'A pack of tuyo. It keeps forever.', "A pack of dried fish. Food +2, and it won't spoil."],
  kaldero: ['Cooking pot', 'A dented kaldero with a lid.', 'A cooking pot. Rice goes further at the shelter: Food +1 each night.'],
  knife: ['Kitchen knife', "Sharp, and the handle's sound.", "A kitchen knife. Not much of a weapon, but it never breaks."],
  eggs: ['Eggs', 'A tray, most of them whole.', "A tray of eggs. Food +2 tonight, but they won't keep."],
});
const LOOT = {
  trunk: ['pistol', 'ammo', 'rounds', 'sledge', 'pipe', 'itak', 'arnis', 'flares', 'straps', 'firstaid', 'jerrycan', 'water'],
  diner: ['water', 'butane', 'beef', 'rice'],
  store: ['sardines', 'meds', 'batteries', 'water', 'firstaid'],
  botika: ['bandage', 'gauze', 'antibiotics', 'alcohol', 'vitamins', 'painkillers'],
  kwik: ['noodles', 'tuna', 'crackers', 'matches', 'sardines'],
  kainan: ['tuyo', 'kaldero', 'knife', 'itak', 'eggs', 'rice'],
};
const roll = kind => [...LOOT[kind]].sort(() => Math.random() - 0.5).slice(0, 3);
// shops you walk into through a door (the rest open straight onto their interior until their door art comes in)
const DOOR_OF = { kwik: 'kwik', store: 'kwik', diner: 'glass', botika: 'botika', kainan: 'kainan' };   // the convenience stores ring their bell; the diner doesn't; the botika rolls its shutter up
const SHELTER_DOOR = { nida: 'nida', t10: 'gate', brgy: 'gate', mm: 'botika' };
let inShelter = false;                                    // the shelter's interior is up (the rain moves onto the roof)          // how you get into each shelter (Mang Mel's has a shutter)
// what taking a thing sounds like: weapons get the equip sound, paper and packets rustle, the rest is a plain pickup
const PICKUP = id => id === 'pistol' ? 'gun-equip' : ['sledge', 'pipe', 'knife', 'itak', 'arnis'].includes(id) ? 'equip-sound'
  : ['bandage', 'gauze', 'firstaid', 'antibiotics', 'meds', 'painkillers', 'noodles', 'crackers', 'matches', 'tuyo'].includes(id) ? 'paper-grab' : 'item-pickup';
// ('bandage.mp3' is the sound of Juan USING a bandage or medicine: it waits for Use Item, not for picking things up)
const PICK_SHOPS = {
  botika: ['Botika', 'The grille is pried open and the glass counter is cracked. Most of the shelves are bare, but not all.'],
  kwik: ['Kwik Mart 24', 'Glass crunches underfoot. The shelves are on the floor and the freezer lid is up. The last tube still flickers.'],
  kainan: ['Kainan', 'Pots on the counter, stools upturned, a candle burned almost down. Somebody was here not long ago.'],
  diner: ["Rosa's Tapsihan", 'A 24-hour tapsilogan, lights still on for nobody. The booths are empty, the grill is cold, and the door chime still rings.'],
  store: ['Mabuhay Mart 24', 'Every shelf picked over except the back one. A single tube still hums over the aisle.'],
};
const $ = id => document.getElementById(id);
let pendingFight = null, forceAlarm = false, onTap = null;   // onTap: { hover, pick, take } while the scene waits for a tap
function sceneMsg(m) { const w = $('scene').contentWindow; if (w) w.postMessage(m, '*'); }
function showScene(sc, live) { if (!sc) return; const fr = $('scene'); fr.src = '../encounters/index.html?embed&scene=' + sc + (live ? '&live' : ''); fr.hidden = false; }
function card(title, body, btns) {                     // btns: [label, onclick, item id to light up in the scene]
  busy = true; onTap = null; $('cardT').textContent = title; $('cardB').textContent = body;
  const box = $('cardA'); box.innerHTML = '';
  for (const [label, fn, item] of btns) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = fn;
    if (item) { b.onpointerenter = b.onfocus = () => sceneMsg({ glow: item }); b.onpointerleave = b.onblur = () => sceneMsg({ glow: null }); }
    box.append(b);
  }
  $('card').hidden = false;
}
// ---------- door transitions, old Resident Evil style: black, the door creaks open frame by frame, black, you're in ----------
// strips are 6 frames (closed -> open) of 110 x h on pure black; full-height (h 225) fills the screen, shorter ones sit letterboxed in the middle
const GLASS_IMG = '<b64>';
const DOORS = { kainan: { open: 'door-open', close: 'door-close', h: 225, src: '<b64>' },
  gate: { open: 'gate-latch-open', close: 'grill-mesh-close', h: 225, src: '<b64>' },
  botika: { open: ['sliding-lock-open', 'sliding-door'], close: 'grill-mesh-close', h: 225, src: '<b64>' },
  kwik: { open: 'store-convenience-glassdoor-open-withBell', close: 'door-close', h: 225, src: GLASS_IMG },
  glass: { open: 'store-convenience-glassdoor-open', close: 'door-close', h: 225, src: GLASS_IMG }, nida: { open: 'door-open', close: 'door-close', h: 225, src: '<b64>' }, trunk: { open: 'trunk-open-close', close: 'trunk-open-close', h: 225, src: '<b64>' } };
for (const d of Object.values(DOORS)) { d.img = new Image(); d.img.src = d.src; }
let doorOut = null;                                     // the door we came in through: it closes behind us on the way out
const wait = ms => new Promise(r => setTimeout(r, ms));
async function playDoor(name, closing, onBlack) {
  const d = DOORS[name], el = $('door'), c = $('doorC').getContext('2d'), y0 = Math.round((225 - d.h) / 2);
  const show = (i, z = 1, dy = 0) => { c.fillStyle = '#000'; c.fillRect(0, 0, 110, 225); c.imageSmoothingEnabled = false;
    if (i >= 0) { const w = Math.round(110 * z), h = Math.round(d.h * z); c.drawImage(d.img, i * 110, 0, 110, d.h, Math.round(55 - w / 2), Math.round(y0 + (d.h - h) / 2) + dy, w, h); } };
  show(-1); el.hidden = false; await wait(20); el.style.opacity = 1; await wait(280); if (onBlack) onBlack();   // to black
  const order = closing ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
  if (!closing) {                                                                                    // Juan walks up to it: footsteps, the door growing as he nears, a bob per step
    SFX.play('juan-step-before-door-open', 0.9); const t0 = performance.now();
    await new Promise(res => { const st = () => { const q = Math.min(1, (performance.now() - t0) / 1100);
      show(0, 0.76 + 0.24 * (1 - (1 - q) ** 2), Math.round(Math.abs(Math.sin(q * Math.PI * 3)) * 2 * (1 - q))); q < 1 ? requestAnimationFrame(st) : res(); }; st(); });
  }
  const beat = closing ? [150, 110, 110, 110, 110, 220] : [200, 230, 230, 230, 230, 520];             // a beat on the closed door, a held beat once it's open
  const snd = [].concat(closing ? d.close : d.open); SFX.play(snd[0]);
  for (let k = 0; k < 6; k++) { if (k === 1 && snd[1]) SFX.play(snd[1]); show(order[k]); await wait(beat[k]); }
  show(-1); await wait(180);                                                                          // and black again
}
async function doorOut_() { const el = $('door'); el.style.opacity = 0; await wait(280); el.hidden = true; }
// go through a door into a scene: everything behind the black is swapped while you can't see it
async function enterDoor(name, then, onBlack) {
  $('card').hidden = true; busy = true;
  await playDoor(name, false, onBlack); doorOut = name; then(); await wait(150); await doorOut_();
}
function done() {
  const leave = () => { inShelter = false; $('card').hidden = true; const fr = $('scene'); fr.hidden = true; fr.src = 'about:blank'; busy = false; pendingFight = null; };
  if (!doorOut) return leave();
  const name = doorOut; doorOut = null; $('card').hidden = true;                                     // back out: the door closes behind you
  playDoor(name, true).then(() => { leave(); return doorOut_(); });
}
const after = text => card($('cardT').textContent, text, [['Continue', done]]);
// tap a thing in the scene to look at it (hover previews on desktop), tap it again or press Take it to carry it out
function pick(kind, title, intro) {
  const ids = roll(kind), items = Object.fromEntries(ids.map(id => [id, [id, ...ITEM[id]]]));
  sceneMsg({ scene: kind, live: true, items: ids });
  let sel = null;
  const take = id => {
    if (pack.length >= PACK_SIZE) { sceneMsg({ live: false }); return after('Your pack is full. You leave it where it is.'); }
    pack.push(id); itemsFound++; SFX.play(PICKUP(id)); sceneMsg({ taken: id, glow: null, live: false }); after(items[id][3]);
  };
  const show = id => {
    const it = items[id];
    card(title, it ? `${it[1]}. ${it[2]}` : `${intro} Tap something to look at it.`, sel
      ? [['Take it', () => take(sel)], ['Look around', () => { SFX.play('put-item', 0.8); sel = null; sceneMsg({ glow: null }); show(null); }]]
      : [['Take nothing', () => { sceneMsg({ live: false }); after('You leave it all where it is.'); }]]);
    onTap = { hover: h => { if (!sel) show(h); }, pick: p => { sel = p; show(p); }, take };
  };
  show(null);
}
addEventListener('message', e => { const m = e.data; if (!m || m.pauwi !== 'scene' || !onTap) return; const h = onTap;
  for (const k of ['take', 'pick', 'hover']) if (k in m && h[k]) return h[k](m[k]); });
// the fight runs in its own tab and reports back; until then the card waits, with a way out
function fight(n, won, boss) {
  pendingFight = r => r === 'won' ? won()
    : r === 'fled' ? after('You run until your lungs burn. Whatever was here, it can keep.')
    : (meters.Health = 15, after('Juan comes to in the gutter, head pounding, and crawls away before more come.'));
  // Juan's loadout goes with him: Health, the weapon in hand and its swings left, the whole pack
  const kit = `&hp=${meters.Health}&weapon=${weapon}${Number.isFinite(weaponSwings) ? '&swings=' + weaponSwings : ''}&rounds=${rounds}&dread=${dread}&bag=${pack.join(',')}`;
  window.open('../juan-hands/index.html?foes=' + n + (boss ? '&boss=brute' : '') + kit, '_blank');
  card('Fight', boss ? 'The fight opens in a new tab: the Brute. Bring it down and Tutuban is yours.' : `The fight opens in a new tab: ${n === 2 ? 'two Shamblers' : 'one Shambler'}. Win it and you're back on this street.`,
    [['Run for it', () => after('You run. Whatever was here is theirs now.')]]);
}
addEventListener('message', e => {
  const d = e.data; if (!d || d.pauwi !== 'combat' || !pendingFight) return;
  if ('hp' in d) {                                                         // what's left of Juan comes back from the fight
    meters.Health = Math.max(1, Math.round(d.hp)); weapon = d.weapon; weaponSwings = d.swings ?? Infinity;
    pack.splice(0, pack.length, ...d.bag); dread = Math.round(d.dread ?? dread); rounds = d.rounds ?? rounds;
  }
  const f = pendingFight; pendingFight = null; f(d.result);
});
function popTrunk() {
  if (!forceAlarm && Math.random() < 0.85) return enterDoor('trunk', () => pick('trunk', 'The trunk', 'It gives with a clunk. Whoever owned this car packed for a trip they never took. Room for one.'));
  const n = 1 + (Math.random() < 0.5);                                            // 15%: the alarm, and 1–2 come for it
  sceneMsg({ alarm: true }); SFX.bed('car-alarm', true, 0.7);
  card('Car alarm', `The horn screams and the hazards strobe. Up the street, ${n === 2 ? 'two shapes turn' : 'a shape turns'} toward the noise.`, [
    ['Fight', () => { SFX.bed('car-alarm', false); fight(n, () => { sceneMsg({ alarm: false }); enterDoor('trunk', () => pick('trunk', 'The trunk', 'The street is quiet again, and the alarm has choked off. The trunk is still open. Room for one.')); }); }],
    ['Run for it', () => { SFX.bed('car-alarm', false); after('You leave the car screaming behind you. The trunk is lost.'); }]]);
}
function carCard() {                                    // the car is the button: tap it to try the trunk
  card('An abandoned car', "Hazards still blinking, the driver's door hanging open, keys gone. The trunk lid sits a finger's width open. Tap the car to try it.",
    [['Leave it', () => after('The blinking lights are drawing attention. You move on.')]]);
  onTap = { pick: popTrunk, take: popTrunk };
}
// a walk-in shop: the card out front, then in through its door (if it has one) to pick one thing
function shopCard(front) {
  const [name, desc] = PICK_SHOPS[front], door = DOOR_OF[front];
  if (!door) showScene(front);
  const go = () => pick(front, name, 'A shortcut through the back opens up: +2 moves. You can only carry one thing out.');
  card(name, desc, [['Search it', () => { moves += 2; flashMoves(); if (door) enterDoor(door, go, () => showScene(front)); else go(); }],
    ['Leave it', () => after('You leave it for now.')]]);
}
function arrive(q, r) {
  visited.add(key(q, r)); clearedThisCycle++; totalCleared++;
  const ct = content(q, r);
  if (ct === 'shop') {
    const front = tile(q, r - 1).front;
    if (PICK_SHOPS[front]) return shopCard(front);                                 // walk-in shops: pick one thing to carry out
    const sc = SHOP_CARDS[front];
    return card(sc[0], sc[1], [['Search it', () => { moves += 2; flashMoves(); after(sc[2] + ' A shortcut through the back opens up: +2 moves.'); }], ['Leave it', () => after('You leave it for now.')]]);
  }
  if (ct === 'loot' && hash(q, r, 60) > 0.6) { showScene('car', true); return carCard(); }
  const c = ct === 'tutuban' && bruteDown ? null : CARDS[ct]; if (!c) return;
  let [title, body] = c;
  if (ct === 'relocate') {                                  // each shelter speaks for itself
    const fk = Object.keys(SHELTERS).find(k => frontOf(k)[0] === q && frontOf(k)[1] === r);
    title = SHELTERS[fk].name; body = SHELTERS[fk].desc;
  }
  showScene({ loot: 'backpack', event: 'radio' }[ct]);      // full-screen encounter scene behind the card
  card(title, body, c[2].map(([label, result]) => [label, () => {
    if (result === 'relocate') {
      const fk = Object.keys(SHELTERS).find(k => frontOf(k)[0] === jq && frontOf(k)[1] === jr);
      SFX.play('key-collect'); home = fk; visited.clear(); visited.add(key(jq, jr));
      const text = `${SHELTERS[fk].name} is home now. The streets around ${fk === 'nida' ? "Nida's" : 'it'} are a new zone, and the old one is behind you.`;
      enterDoor(SHELTER_DOOR[fk], () => { showScene(fk); inShelter = true; after(text); });           // in through the new home's door
    } else if (result === 'combat') fight(1, () => after('It stays down. The street is quiet again.'));
    else if (result === 'boss') fight(1, endDemo, true);
    else { if (ct === 'loot' && label === 'Search it') SFX.play('backpack_sound'); after(result); }
  }]));
}
function flashMoves() { document.getElementById('moves').animate([{ color: moves > 0 ? '#5AA17A' : '#D94B3B' }, { color: '#F0A63C' }], { duration: 700 }); }
document.getElementById('back').onclick = () => {
  if (busy || walk) return; busy = true;
  document.querySelector('#sum h3').textContent = 'Back at ' + SHELTERS[home].name;
  document.getElementById('sumB').textContent = `Moves used: ${usedThisCycle} · Tiles cleared: ${clearedThisCycle}. Food ${meters.Food} · Energy ${meters.Energy}${dread ? ' · Dread ' + dread : ''}. Eat something, then sleep.`;
  const showSum = () => { showScene(home); inShelter = true; document.getElementById('sum').classList.remove('summary'); document.getElementById('sum').hidden = false; };   // every shelter has its interior: the night passes in there
  if (SHELTER_DOOR[home]) enterDoor(SHELTER_DOOR[home], showSum); else showSum();
};
// ---------- the shelter: Eat from the bag, then Sleep (the night passes, the next cycle starts) ----------
const MEAL = { noodles: 20, tuna: 20, crackers: 15, sardines: 25, beef: 20, rice: 25, tuyo: 25, eggs: 20 };    // Food each restores; water gives Energy
$('eatBtn').onclick = () => {
  const l = $('eatL'), foods = [...new Set(pack.filter(id => MEAL[id] || id === 'water'))];
  l.innerHTML = foods.length ? '' : '<p>Nothing to eat in the bag.</p>';
  for (const id of foods) {
    const b = document.createElement('button'), n = pack.filter(x => x === id).length;
    b.textContent = `${ITEM[id][0]}${n > 1 ? ' ×' + n : ''} (${id === 'water' ? '+15 Energy' : '+' + MEAL[id] + ' Food'})`;
    b.onclick = () => {
      pack.splice(pack.indexOf(id), 1);
      if (id === 'water') { meters.Energy = Math.min(100, meters.Energy + 15); SFX.play('item-pickup'); }
      else { meters.Food = Math.min(100, meters.Food + MEAL[id]); SFX.play('paper-grab'); }
      $('sumB').textContent = `${ITEM[id][0]}. Food ${meters.Food} · Energy ${meters.Energy}.`; $('eatBtn').click();
    };
    l.append(b);
  }
  const back = document.createElement('button'); back.textContent = 'Done'; back.onclick = () => { l.hidden = true; $('sumA').hidden = false; }; l.append(back);
  l.hidden = false; $('sumA').hidden = true;
};
function sleepNight() {                                               // the night: hunger, rest, and Dread that barely fades and eats at Hope
  const hungry = meters.Food < 15;
  meters.Food = Math.max(0, meters.Food - 15);
  meters.Energy = Math.min(100, meters.Energy + 30);
  meters.Health = hungry ? Math.max(1, meters.Health - 10) : Math.min(100, meters.Health + 5);
  const lostHope = Math.round(dread / 10); meters.Hope = Math.max(0, meters.Hope - lostHope);
  dread = Math.max(0, dread - 8);                                     // super slow to drain: it takes many nights
  return `${hungry ? 'You slept hungry: Health -10. ' : 'You slept. '}Energy ${meters.Energy}, Food ${meters.Food}${lostHope ? `. The fights stay with you: Hope -${lostHope}` : ''}${dread ? `, Dread ${dread}` : ''}.`;
}
document.getElementById('cont').onclick = () => {
  if (!$('door').hidden || !$('bag').hidden) return;              // still walking in, or in the bag
  const morning = sleepNight(); $('eatL').hidden = true; $('sumA').hidden = false;
  document.getElementById('sum').hidden = true;
  const out = () => { inShelter = false; const fr = $('scene'); fr.hidden = true; fr.src = 'about:blank'; nextCycle(); card(mode === 'night' ? 'Dusk' : 'Morning', morning, [['Head out', done]]); };
  if (doorOut) { const d = doorOut; doorOut = null; playDoor(d, true).then(() => { out(); return doorOut_(); }); } else out();   // back out through the shelter's door
};
// ---------- Juan's pack: what he takes is kept; the bag screen (inside a shelter) shows it, his meters, and the weapon in hand ----------
const PACK_SIZE = 18, pack = [], meters = { Health: 80, Energy: 60, Food: 50, Hope: 40 };
let weapon = 'makeshift', weaponSwings = 12, dread = 0, rounds = 0;   // rounds: what's in the pistol's magazine                    // the makeshift bat until he finds better; Dread from fights waits for the shelter
const SWINGS = { pistol: Infinity, makeshift: 12, itak: 8, arnis: 16, sledge: 6, pipe: 12, knife: Infinity, fist: Infinity };   // the same numbers as the combat preview
const WEAPON_NAME = { pistol: '9mm pistol', makeshift: 'Makeshift bat', itak: 'Itak', arnis: 'Arnis stick', sledge: 'Sledgehammer', pipe: 'Lead pipe', knife: 'Kitchen knife', fist: 'Fists' };
const MEDICINE = ['bandage', 'gauze', 'firstaid', 'antibiotics', 'meds', 'painkillers', 'alcohol', 'vitamins'];
const FOOD = ['noodles', 'tuna', 'crackers', 'sardines', 'beef', 'rice', 'tuyo', 'eggs'];
const ITEM_ICONS = new Set(['pistol', 'ammo', 'rounds', 'batteries', 'sledge', 'pipe', 'flares', 'straps', 'firstaid', 'jerrycan', 'water', 'butane', 'beef', 'rice', 'sardines', 'meds', 'bandage', 'gauze', 'antibiotics',
  'alcohol', 'vitamins', 'painkillers', 'noodles', 'tuna', 'crackers', 'matches', 'tuyo', 'kaldero', 'knife', 'eggs']);
const nameOf = id => WEAPON_NAME[id] || (ITEM[id] || [id])[0];
const WEAPON_ICON = { makeshift: 'w-makeshift', itak: 'w-itak', arnis: 'w-arnis', pipe: 'w-pipe', fist: 'w-fist' };          // painted weapon icons; the sledge and knife use their item sprites
const icon = id => WEAPON_ICON[id] ? `<img src="../encounters/src/ui/${WEAPON_ICON[id]}.png" alt="">` : ITEM_ICONS.has(id) ? `<img src="../encounters/src/items/${id}.png" alt="">` : `<span>${nameOf(id).toUpperCase()}</span>`;
let bagSel = -1;
function renderBag() {
  $('bagM').innerHTML = `<span style="grid-column:1/-1;flex-direction:row;gap:6px;justify-content:center;color:#b78be6">DREAD <b style="color:#b78be6">${dread}</b></span>` + Object.entries(meters).map(([k, v]) => `<span><img src="../encounters/src/ui/icon-${k.toLowerCase()}.png" alt="">${k.toUpperCase()}<b>${v}</b></span>`).join('');
  $('slotW').innerHTML = `${ITEM_ICONS.has(weapon) || WEAPON_ICON[weapon] ? icon(weapon) : ''}<span>${WEAPON_NAME[weapon]}${weapon === 'pistol' ? ` · ${rounds}/6` : Number.isFinite(weaponSwings) ? ' · ' + weaponSwings : ''}</span>`;
  $('bagG').innerHTML = Array.from({ length: PACK_SIZE }, (_, i) => `<button class="cell" data-i="${i}" aria-pressed="${i === bagSel}">${pack[i] ? icon(pack[i]) : ''}</button>`).join('');
  $('bagG').querySelectorAll('.cell').forEach(c => c.onclick = () => { const i = +c.dataset.i; bagSel = i === bagSel || !pack[i] ? -1 : i; renderBag(); });
  const id = pack[bagSel], act = $('bagDo');
  $('bagI').textContent = id ? `${nameOf(id)}. ${ITEM[id] ? ITEM[id][1] : ''}` : `${pack.length} / ${PACK_SIZE}. Tap something to look at it.`;
  act.hidden = !id || !(WEAPON_NAME[id] || MEDICINE.includes(id) || FOOD.includes(id) || id === 'water');
  act.textContent = WEAPON_NAME[id] ? 'Equip' : 'Use';
}
$('bagDo').onclick = () => {
  const id = pack[bagSel]; if (!id) return;
  if (WEAPON_NAME[id]) {                                                       // swap: the old weapon goes in the pack (bare fists don't)
    if (weapon === 'fist') pack.splice(bagSel, 1); else pack[bagSel] = weapon;
    weapon = id; weaponSwings = SWINGS[id]; SFX.play('equip-sound'); bagSel = -1;
  }
  else {
    pack.splice(bagSel, 1); bagSel = -1;
    if (MEDICINE.includes(id)) { meters.Health = Math.min(100, meters.Health + 20); SFX.play('bandage'); }   // patched up
    else if (id === 'water') { meters.Energy = Math.min(100, meters.Energy + 15); SFX.play('item-pickup'); }
    else { meters.Food = Math.min(100, meters.Food + 20); SFX.play('paper-grab'); }
  }
  renderBag();
};
// the bag's buckle, flap, open, supplies: 4 frames, played forward to open and back to close
const BAG_ANIM = new Image(); BAG_ANIM.src = '../encounters/src/ui/bag-open.png';
function playBag(order, done) {
  const el = $('bagAnim'), c = $('bagAnimC').getContext('2d'); el.hidden = false; let k = 0;
  const step = () => { c.clearRect(0, 0, 48, 44); c.drawImage(BAG_ANIM, order[k] * 48, 0, 48, 44, 0, 0, 48, 44);
    if (++k < order.length) setTimeout(step, 110); else setTimeout(() => { el.hidden = true; done(); }, 160); };
  step();
}
function openBag() {
  bagSel = -1; renderBag(); SFX.play('backpack_sound', 0.8); playBag([0, 1, 2, 3], () => { $('bag').hidden = false; });
  const face = $('bagFace').getContext('2d'), sheet = new Image();
  sheet.onload = () => { face.clearRect(0, 0, 26, 64); face.drawImage(sheet, 0, 0); };   // Juan, full body, bat in hand
  sheet.src = '../encounters/src/juan-full.png';
}
$('bagClose').onclick = () => { $('bag').hidden = true; playBag([3, 2, 1, 0], () => {}); };
$('bagBtn').onclick = openBag;
// ---------- the end of the demo: the Brute at Tutuban is down ----------
let totalCleared = 0, itemsFound = 0, bruteDown = false;
function endDemo() {
  bruteDown = true; $('card').hidden = true; const fr = $('scene'); fr.hidden = true; fr.src = 'about:blank';
  $('endS').innerHTML = [['Days survived', cycleN], ['Tiles cleared', totalCleared], ['Things found', itemsFound], ['In hand', WEAPON_NAME[weapon]]]
    .map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
  $('end').hidden = false; busy = true; SFX.play('key-collect');
}
$('endR').onclick = () => location.reload();
function nextCycle() {
  [jq, jr] = frontOf(home); cq = jq; cr = jr; moves = 5; usedThisCycle = clearedThisCycle = 0; if (mode === 'night') cycleN++;
  setMode(mode === 'night' ? 'day' : 'night');
};
document.getElementById('jump').onclick = () => {              // dev shortcut: Tutuban is ~51 hexes away
  if (busy || walk) return; jq = LM.q; jr = LM.r + 3; cq = jq; cr = jr; visited.add(key(jq, jr)); moves = 5;
};
document.querySelectorAll('[data-try]').forEach(b => b.onclick = () => {   // dev shortcuts: open an encounter without walking to one
  if (busy || walk) return; const t = b.dataset.try;
  if (PICK_SHOPS[t]) return shopCard(t);
  forceAlarm = t === 'alarm'; showScene('car', true); carCard();
});
document.getElementById('rainBtn').onclick = e => { rain = !rain; e.target.setAttribute('aria-pressed', rain); };
function setMode(m) { mode = m; document.querySelectorAll('[data-mode]').forEach(o => o.setAttribute('aria-pressed', o.dataset.mode === m)); }
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
  mode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(o => o.setAttribute('aria-pressed', o === b));
});
})();
