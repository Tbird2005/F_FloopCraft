// ============================================================
// F_Floop Craft — mobs: frog creepers, skeletons, spiders,
// sheep, chickens, camels, Humbugs, TUNG TUNG TUNG SAHUR,
// and Mr Floop (now with more attitude)
// ============================================================

const FLOOP_LINES_COMMON = ['Merry Christmas!', 'brrr brrr patapim'];
const FLOOP_LINES_CASUAL = [
  'Hey hey hey!', "No! I didn't say that!", 'No', 'Huh?',
  'Yeah ok bro what are you even on about?', 'Go home', '67', 'Good night',
  'Thats fake', 'Ok thats AI', 'Thats photoshopped', "Yeah buddy that's not real.",
];
const FLOOP_LINES_RARE = [
  'brrr brrr patapim...',
  'MERRY CHRISTMAS!!',
  'patapim patapim patapim',
  'the saucer is fine. everything is fine. merry christmas.',
  'have you visited my casino? the odds are... festive.',
  'on my planet every day is christmas. that is why i left.',
  'i am NOT an alien. merry christmas.',
  'the skeletons never say merry christmas back :(',
  'diamonds are my favorite snack. i mean currency. i mean... merry christmas.',
  'do not lick the purple ore. trust me. patapim.',
  'i saw what you did to that tree. merry christmas anyway.',
  'the humbugs are close. i can smell the disappointment.',
  'if a humbug asks: you never saw me. patapim.',
];
const FLOOP_LINES_HURT = [
  'ow!! why!! merry christmas??',
  'patapim?! that HURT.',
  'i am TELLING the humbugs about this.',
  'hey!! i felt that in my hat.',
  'rude. festive, but rude.',
  'my lawyer is a snowman.',
  'do not make me patapim you.',
  'that is NOT christmas behavior.',
  'i bruise green, you know.',
];
const HUMBUG_LINES = ['no.', 'bah.', 'christmas is CANCELLED.', 'patapim is propaganda.', 'hand over the diamonds.', 'joy detected. eliminating.'];
const JELLY_COLORS = (typeof JELLY_COLORS_ALL !== 'undefined') ? JELLY_COLORS_ALL : ['pink', 'cyan', 'lime', 'grape', 'orange', 'yellow'];
const JELLY_COLOR_HEX = { pink: 0xff7fd4, cyan: 0x6ee8ff, lime: 0x9cff6e, grape: 0xc77dff, orange: 0xff9d4a, yellow: 0xffe86e };
const JELLY_MOB_TYPES = ['jelly', 'big_jelly'];
const FIREFLY_DEF = { hp: 1, xp: 0, w: 0.10, h: 0.22, speed: 1.15, color: 0xff7a18 };
const OCEAN_MOB_DEFS = {
  minnow:    { hp: 2,  xp: 1, w: 0.13, h: 0.24, len: 0.55, speed: 2.8, main: '#9bc8d8', dark: '#47788d', school: true, drop: I.RAW_FISH },
  salmon:    { hp: 6,  xp: 2, w: 0.22, h: 0.38, len: 1.05, speed: 2.7, main: '#db7f75', dark: '#7f3b40', school: true, drop: I.RAW_FISH },
  tuna:      { hp: 10, xp: 3, w: 0.30, h: 0.48, len: 1.45, speed: 3.5, main: '#4e82a8', dark: '#234a6b', school: true, drop: I.RAW_FISH },
  clownfish: { hp: 4,  xp: 1, w: 0.17, h: 0.30, len: 0.72, speed: 2.4, main: '#ff8b2f', dark: '#1d1d24', school: true, drop: I.RAW_FISH, stripe: true },
  pufferfish:{ hp: 5,  xp: 2, w: 0.24, h: 0.42, len: 0.62, speed: 1.8, main: '#d6bd55', dark: '#6b5a24', drop: I.RAW_FISH, puffer: true },
  anglerfish:{ hp: 8,  xp: 4, w: 0.28, h: 0.45, len: 1.00, speed: 2.1, main: '#37405c', dark: '#111522', drop: I.RAW_FISH, deep: true, angler: true },
  shark:     { hp: 30, xp: 9, w: 0.58, h: 0.78, len: 2.55, speed: 4.2, main: '#6d8293', dark: '#344653', drop: I.SHARK_TOOTH, hostile: true },
  jellyfish: { hp: 5,  xp: 2, w: 0.30, h: 0.70, len: 0.62, speed: 1.25, main: '#a98bf0', dark: '#5e3e9b', shape: 'jelly', neutral: true, damage: 3, drop: I.JELLY_GLOB_GRAPE },
  stingray:  { hp: 9,  xp: 3, w: 0.55, h: 0.22, len: 1.25, speed: 2.8, main: '#8b796b', dark: '#4d4038', drop: I.RAW_FISH, shape: 'ray', neutral: true, damage: 4 },
  octopus:   { hp: 12, xp: 4, w: 0.42, h: 0.72, len: 0.85, speed: 2.0, main: '#a64c70', dark: '#57233b', drop: I.INK_SAC, shape: 'octopus' },
  dolphin:   { hp: 18, xp: 5, w: 0.38, h: 0.58, len: 1.85, speed: 4.6, main: '#7895a8', dark: '#36566a', drop: I.RAW_FISH },
  seahorse:  { hp: 3,  xp: 1, w: 0.15, h: 0.55, len: 0.42, speed: 1.45, main: '#e7ad48', dark: '#8e5d20', shape: 'seahorse' },
  barracuda: { hp: 18, xp: 6, w: 0.34, h: 0.46, len: 1.75, speed: 5.1, main: '#9cae63', dark: '#43502a', drop: I.RAW_FISH, hostile: true, damage: 4 },
  sea_serpent:{ hp: 42, xp: 12, w: 0.48, h: 0.62, len: 3.45, speed: 4.5, main: '#2fc39f', dark: '#0d5449', drop: I.SHARK_TOOTH, hostile: true, deep: true, damage: 7 },
  giant_squid:{ hp: 50, xp: 14, w: 0.82, h: 1.55, len: 1.25, speed: 3.3, main: '#7f354d', dark: '#220d19', drop: I.INK_SAC, hostile: true, deep: true, damage: 8, shape: 'octopus' },
};
const OCEAN_MOB_TYPES = Object.keys(OCEAN_MOB_DEFS);

// Lavaback: a Lapras-shaped lava beast that lurks submerged in lava pools, surfaces to
// spit fireballs at nearby players, then dives back under. Sprawler-tough; water/land kill it.
const LAVABACK_DEF = { speed: 2.4, sight: 20, keepAway: 5, fireballMin: 4.5, meleeRange: 1.6, meleeDmg: 7, fireballDmg: 5, fireballBurn: 5, cooldown: 1.9, waterDps: 8, beachSecs: 9 };
const MOB_XP = { creeper: 5, skeleton: 5, spider: 4, humbug: 8, sheep: 1, floop: 0, chicken: 1, camel: 2, tung: 12, jelly: 1, big_jelly: 3, lavaback: 9, firefly: FIREFLY_DEF.xp };
const MOB_MAX_HP = { creeper: 20, skeleton: 20, floop: 40, humbug: 24, sheep: 10, spider: 16, chicken: 6, camel: 20, tung: 36, sprawler: 40, jelly: 8, big_jelly: 20, lavaback: 40, firefly: FIREFLY_DEF.hp };
const MOB_HEIGHTS = { creeper: 1.0, skeleton: 1.95, floop: 2.7, humbug: 2.55, sheep: 1.5, spider: 0.9, chicken: 1.0, camel: 2.3, tung: 2.4, sprawler: 2.0, jelly: 0.95, big_jelly: 1.8, lavaback: 2.0, firefly: FIREFLY_DEF.h };
const MOB_WIDTHS = { creeper: 0.42, skeleton: 0.32, floop: 0.32, humbug: 0.32, sheep: 0.45, spider: 0.55, chicken: 0.28, camel: 0.5, tung: 0.4, sprawler: 1.45, jelly: 0.24, big_jelly: 0.34, lavaback: 0.85, firefly: FIREFLY_DEF.w };
for (const [type, d] of Object.entries(OCEAN_MOB_DEFS)) { MOB_XP[type] = d.xp; MOB_MAX_HP[type] = d.hp; MOB_HEIGHTS[type] = d.h; MOB_WIDTHS[type] = d.w; }
const HOSTILES = ['creeper', 'skeleton', 'humbug', 'tung', 'sprawler'];
const MOB_TARGET_MEMORY = 30; // seconds: mobs remember a target after LOS breaks, but only acquire targets through LOS
const MOB_TARGET_FORGET_DIST = 34;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const Mobs = {
  list: [],
  arrows: [],
  scene: null,
  spawnTimer: 0,
  pathBudget: 0,
  _fireflyAssets: null,
  _fireflyHurtMat: null,
  // passive mobs that leave the simulation radius are kept dormant per chunk (not deleted)
  // and revived when a player returns — so unloaded chunks keep their entities
  dormant: new Map(),   // "cx,cz" -> serialized mob data[]
  _dormantCount: 0,
  _reviveT: 0,
  DORMANT_CAP: 800,

  init(scene) { this.scene = scene; this.list = []; this.arrows = []; this.dormant = new Map(); this._dormantCount = 0; this._reviveT = 0; },

  stepFarProjectile(p, dt) {
    if (typeof Physics === 'undefined' || !Physics.ensureFarBody || !Physics.ensureFarBody(p)) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      return;
    }
    const st = p._farPos;
    st.x += p.vx * dt;
    st.y += p.vy * dt;
    st.z += p.vz * dt;
    const sx = Math.floor(st.x / 16) * 16;
    const sy = Math.floor(st.y / 16) * 16;
    const sz = Math.floor(st.z / 16) * 16;
    st.ox += sx; st.oy += sy; st.oz += sz;
    st.x -= sx; st.y -= sy; st.z -= sz;
    p.x = st.ox + st.x; p.y = st.oy + st.y; p.z = st.oz + st.z;
  },

  farDelta(a, b) {
    if (typeof Physics !== 'undefined' && Physics.deltaBodies) return Physics.deltaBodies(a, b);
    return { x: (b.x || 0) - (a.x || 0), y: (b.y || 0) - (a.y || 0), z: (b.z || 0) - (a.z || 0) };
  },

  farBodyPos(b) {
    const st = (b && typeof Physics !== 'undefined' && Physics.farState) ? Physics.farState(b) : null;
    return st ? { x: st.ox + st.x, y: st.oy + st.y, z: st.oz + st.z } : { x: b ? b.x : 0, y: b ? b.y : 0, z: b ? b.z : 0 };
  },

  targetBody(tgt) {
    if (!tgt) return null;
    if (tgt.peerId) { // remote player: host-side mob AI tracks their streamed state
      const p = (typeof Multiplayer !== 'undefined' && Multiplayer.peers) ? Multiplayer.peers.get(tgt.peerId) : null;
      const s = p && (p.target || p.state);
      return s ? { x: +s.x, y: +s.y, z: +s.z, h: +s.h || 1.8, swim: !!s.swim } : null;
    }
    if (tgt.isPlayer && typeof Player !== 'undefined' && Player.body) return Player.body;
    if (tgt.mob && tgt.mob.body) return tgt.mob.body;
    return null;
  },

  // one target candidate per living, non-creative, same-dimension remote player
  makePeerTargets() {
    if (typeof Multiplayer === 'undefined' || Multiplayer.role !== 'host' || !Multiplayer.connected || !Multiplayer.peers) return [];
    const myDim = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
    const out = [];
    for (const [pid, p] of Multiplayer.peers.entries()) {
      const s = p && (p.target || p.state);
      if (!s || s.dead || s.inv || !Number.isFinite(+s.x)) continue;
      if ((s.dim || 'overworld') !== myDim) continue;
      out.push({ x: +s.x, y: +s.y, z: +s.z, h: +s.h || 1.8, swim: !!s.swim, mob: null, isPlayer: true, peerId: pid });
    }
    return out;
  },

  targetWorldPos(tgt) {
    const b = this.targetBody(tgt);
    if (b) {
      const p = this.farBodyPos(b);
      p.h = b.h || (tgt && tgt.h) || 1;
      return p;
    }
    return { x: tgt ? tgt.x : 0, y: tgt ? tgt.y : 0, z: tgt ? tgt.z : 0, h: (tgt && tgt.h) || 1 };
  },

  deltaToTarget(b, tgt) {
    const tb = this.targetBody(tgt);
    if (tb) return this.farDelta(b, tb);
    return this.deltaToPoint(b, tgt ? tgt.x : 0, tgt ? tgt.y : 0, tgt ? tgt.z : 0);
  },

  deltaToPoint(b, x, y, z) {
    const st = (b && typeof Physics !== 'undefined' && Physics.farState) ? Physics.farState(b) : null;
    if (st) return { x: (x - st.ox) - st.x, y: (y - st.oy) - st.y, z: (z - st.oz) - st.z };
    return { x: (x || 0) - (b ? b.x : 0), y: (y || 0) - (b ? b.y : 0), z: (z || 0) - (b ? b.z : 0) };
  },

  targetHorizDist(b, tgt) {
    const d = this.deltaToTarget(b, tgt);
    return Math.sqrt(d.x * d.x + d.z * d.z) || 0;
  },

  nudgeBodyXZ(b, dx, dz) {
    if (!b) return;
    const st = (typeof Physics !== 'undefined' && Physics.farState) ? Physics.farState(b) : null;
    if (st) {
      st.x += dx; st.z += dz;
      const sx = Math.floor(st.x / 16) * 16, sz = Math.floor(st.z / 16) * 16;
      st.ox += sx; st.oz += sz; st.x -= sx; st.z -= sz;
      b.x = st.ox + st.x; b.y = st.oy + st.y; b.z = st.oz + st.z;
    } else {
      b.x += dx; b.z += dz;
    }
  },

  liveFloops() {
    return this.list.filter(m => m && !m.dead && m.type === 'floop');
  },

  despawnSilent(mob) {
    if (!mob) return;
    mob.dead = true;
    if (mob.bubble && this.scene) {
      this.scene.remove(mob.bubble);
      if (mob.bubble.material) {
        if (mob.bubble.material.map) mob.bubble.material.map.dispose();
        mob.bubble.material.dispose();
      }
      mob.bubble = null;
    }
    if (mob.group && this.scene) this.scene.remove(mob.group);
    const ix = this.list.indexOf(mob);
    if (ix >= 0) this.list.splice(ix, 1);
  },

  enforceSingleFloop() {
    const floops = this.liveFloops();
    if (floops.length <= 1) return;
    // Keep the closest loaded Mr. Floop to the player and silently despawn extras.
    const p = (typeof Player !== 'undefined' && Player.body) ? Player.body : { x: 0, y: 0, z: 0 };
    floops.sort((a, b) => {
      const ad = this.farDelta(p, a.body), bd = this.farDelta(p, b.body);
      const da = ad.x * ad.x + ad.z * ad.z + ad.y * ad.y;
      const db = bd.x * bd.x + bd.z * bd.z + bd.y * bd.y;
      return da - db;
    });
    for (let i = 1; i < floops.length; i++) this.despawnSilent(floops[i]);
  },

  // ---------- model helpers ----------
  box(w, h, d, color, faceCanvas) {
    const g = new THREE.BoxGeometry(w, h, d);
    let mats;
    if (faceCanvas) {
      const tex = new THREE.CanvasTexture(faceCanvas);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      const plain = new THREE.MeshLambertMaterial({ color });
      const face = new THREE.MeshLambertMaterial({ map: tex });
      mats = [plain, plain, plain, plain, face, plain];
    } else {
      mats = new THREE.MeshLambertMaterial({ color });
    }
    return new THREE.Mesh(g, mats);
  },

  // Cached 16x16 pixel-art skins (one canvas+texture per key, materials per mob
  // instance because the voxel-light tint mutates material.color).
  _skinCache: {},
  skinTex(key, painter, size) {
    let t = this._skinCache[key];
    if (t) return t;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size || 16;
    painter(cv.getContext('2d'));
    t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    return (this._skinCache[key] = t);
  },
  // textured box.
  //  - painter as a FUNCTION: same skin on all faces (+ optional front faceCanvas).
  //  - painter as an OBJECT { side, top, bottom, front, back }: a real per-face
  //    unwrap so a mob's head/flank/belly/dorsal/tail all read differently.
  // three.js BoxGeometry material order is [+x, -x, +y, -y, +z, -z]; this model
  // set puts the face on +z, so front = +z (idx 4), back = -z (idx 5), and both
  // ±x share the "side" skin (mirror flanks). Textures cache per skinKey+role.
  tbox(w, h, d, skinKey, painter, faceCanvas, opts) {
    const g = new THREE.BoxGeometry(w, h, d);
    const baseOpts = opts || {};
    const matFor = (fn, role) => new THREE.MeshLambertMaterial(Object.assign({ map: this.skinTex(skinKey + '#' + role, fn) }, baseOpts));
    if (painter && typeof painter === 'object') {
      const P = painter, side = P.side || P.front || P.top;
      const cache = {};
      const roleMat = (role, fn) => {
        const use = fn || side, tag = fn ? role : 'side';
        return cache[tag] || (cache[tag] = matFor(use, tag));
      };
      const mSide = roleMat('side', side);
      return new THREE.Mesh(g, [
        mSide, mSide,                       // +x / -x flanks
        roleMat('top', P.top),              // +y
        roleMat('bottom', P.bottom),        // -y
        roleMat('front', P.front),          // +z front / face
        roleMat('back', P.back),            // -z back / tail
      ]);
    }
    const mk = () => matFor(painter, 'all');
    if (faceCanvas) {
      const tex = new THREE.CanvasTexture(faceCanvas);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      const face = new THREE.MeshLambertMaterial(Object.assign({ map: tex }, baseOpts));
      const plain = mk();
      return new THREE.Mesh(g, [plain, plain, plain, plain, face, plain]);
    }
    return new THREE.Mesh(g, mk());
  },

  // mix two #rrggbb hexes (t=0 -> a, t=1 -> b)
  _mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t), gg = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
    return '#' + ((1 << 24) | (r << 16) | (gg << 8) | bl).toString(16).slice(1);
  },
  // tiny deterministic speckle for skin painters
  _skinSpeck(c, cols, n, seed) {
    let s = (seed || 7) * 2654435761 % 2147483647;
    const r = () => ((s = s * 16807 % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) { c.fillStyle = cols[(r() * cols.length) | 0]; c.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
  },

  faceCanvas(draw) {
    const cv = document.createElement('canvas');
    cv.width = 8; cv.height = 8;
    draw(cv.getContext('2d'));
    return cv;
  },

  jellyPartCanvas(color, part) {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    const hex = JELLY_COLOR_HEX[color] || 0xff7fd4;
    const base = '#' + hex.toString(16).padStart(6, '0');
    const light = { pink:'#ffb8ea', cyan:'#bcf6ff', lime:'#d5ffc1', grape:'#e2bfff', orange:'#ffd0a0', yellow:'#fff6b8' }[color] || '#ffb8ea';
    const dark = { pink:'#b83b99', cyan:'#268ba8', lime:'#459a31', grape:'#7430b0', orange:'#a74b19', yellow:'#aa8f1f' }[color] || '#b83b99';
    c.fillStyle = base; c.fillRect(0, 0, 16, 16);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 11, 16, 5);
    c.fillStyle = light; c.fillRect(2, 2, 5, 2); c.fillRect(3, 4, 2, 1);
    c.fillStyle = 'rgba(255,255,255,0.23)'; c.fillRect(10, 3, 2, 8);
    c.fillStyle = dark; c.fillRect(0, 15, 16, 1); c.fillRect(0, 0, 1, 16); c.fillRect(15, 0, 1, 16);
    const seed = (part || 'jelly').length + (color || 'pink').length * 11;
    for (let i = 0; i < 22; i++) {
      const x = (i * 7 + seed) % 16, y = (i * 5 + seed * 3) % 16;
      c.fillStyle = (i % 3 === 0) ? light : (i % 3 === 1 ? base : dark);
      c.globalAlpha = i % 3 === 0 ? 0.55 : 0.28;
      c.fillRect(x, y, 1, 1);
    }
    c.globalAlpha = 1;
    if (part === 'head_face') {
      c.fillStyle = '#1a1a1a'; c.fillRect(3, 6, 2, 2); c.fillRect(11, 6, 2, 2); c.fillRect(5, 11, 6, 1);
    }
    return cv;
  },

  jellyBox(w, h, d, color, part) {
    const g = new THREE.BoxGeometry(w, h, d);
    const makeMat = (partName) => {
      const tex = new THREE.CanvasTexture(this.jellyPartCanvas(color, partName));
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.88 });
      mat.userData.mobBaseCol = new THREE.Color(0xffffff);
      return mat;
    };
    if (part === 'head') {
      const plain = makeMat('head');
      const face = makeMat('head_face');
      // BoxGeometry material index 4 is the forward/front face, same convention as the other mob heads.
      return new THREE.Mesh(g, [plain, plain, plain, plain, face, plain]);
    }
    return new THREE.Mesh(g, makeMat(part));
  },

  frogFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#4db843'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#8fdb84'; c.fillRect(1, 5, 6, 3); // pale throat
      c.fillStyle = '#1a1a1a'; c.fillRect(1, 4, 6, 1); // grim mouth line
    });
  },

  skeletonFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#c9c9c9'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#8a8a8a'; c.fillRect(0, 7, 8, 1);
      c.fillStyle = '#3a3a3a';
      c.fillRect(1, 3, 2, 1); c.fillRect(5, 3, 2, 1);
      c.fillRect(3, 5, 2, 1);
    });
  },

  floopFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#7ec48a'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#000';
      c.fillRect(1, 2, 2, 2); c.fillRect(5, 2, 2, 2);
      c.fillStyle = '#fff'; c.fillRect(1, 2, 1, 1); c.fillRect(5, 2, 1, 1);
      c.fillStyle = '#4a375c'; c.fillRect(2, 6, 4, 1);
    });
  },

  humbugFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#9aa0a6'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#000';
      c.fillRect(1, 2, 2, 3); c.fillRect(5, 2, 2, 3);
      c.fillRect(2, 6, 4, 1); c.fillRect(2, 5, 1, 1); c.fillRect(5, 5, 1, 1);
      c.fillStyle = '#6a7076'; c.fillRect(0, 0, 8, 1);
    });
  },

  sheepFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#d8b8a8'; c.fillRect(2, 4, 4, 4);
      c.fillStyle = '#000'; c.fillRect(1, 2, 2, 1); c.fillRect(5, 2, 2, 1);
    });
  },

  spiderFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#2a2028'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#c02020';
      c.fillRect(1, 2, 1, 1); c.fillRect(3, 1, 1, 1); c.fillRect(4, 1, 1, 1); c.fillRect(6, 2, 1, 1);
      c.fillRect(2, 3, 1, 1); c.fillRect(5, 3, 1, 1);
      c.fillStyle = '#555'; c.fillRect(3, 5, 2, 2);
    });
  },

  chickenFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#f5f5f5'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#000'; c.fillRect(1, 2, 1, 1); c.fillRect(6, 2, 1, 1);
      c.fillStyle = '#ff9d2e'; c.fillRect(3, 4, 2, 2); // beak
      c.fillStyle = '#c02020'; c.fillRect(3, 6, 2, 2); // wattle
    });
  },

  jellyFace(color) {
    return this.faceCanvas(c => {
      const hex = JELLY_COLOR_HEX[color] || 0xff7fd4;
      c.fillStyle = '#' + hex.toString(16).padStart(6, '0'); c.fillRect(0, 0, 8, 8);
      c.fillStyle = 'rgba(255,255,255,0.65)'; c.fillRect(1, 1, 3, 1);
      c.fillStyle = '#1a1a1a'; c.fillRect(1, 3, 1, 1); c.fillRect(6, 3, 1, 1);
      c.fillRect(2, 6, 4, 1);
    });
  },

  camelFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#d2a24c'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#000'; c.fillRect(1, 2, 1, 1); c.fillRect(6, 2, 1, 1);
      c.fillStyle = '#8a6a30'; c.fillRect(2, 5, 4, 2);
    });
  },

  tungFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#6b502e'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#5a4226'; c.fillRect(0, 0, 8, 1); c.fillRect(0, 7, 8, 1);
      c.fillStyle = '#fff';
      c.fillRect(1, 2, 2, 3); c.fillRect(5, 2, 2, 3); // wide staring eyes
      c.fillStyle = '#000'; c.fillRect(2, 3, 1, 1); c.fillRect(6, 3, 1, 1);
      c.fillRect(2, 6, 4, 1);
    });
  },

  fireflyAssets() {
    if (this._fireflyAssets) return this._fireflyAssets;
    const bodyGeo = new THREE.BoxGeometry(0.12, 0.10, 0.18);
    const wingGeo = new THREE.BoxGeometry(0.16, 0.015, 0.11);
    const bodyMat = new THREE.MeshBasicMaterial({ color: FIREFLY_DEF.color });
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xffc680, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
    return (this._fireflyAssets = { bodyGeo, wingGeo, bodyMat, wingMat });
  },

  fireflyLightAt(x, y, z) {
    let r = 0, g = 0, b = 0;
    for (const m of this.list) {
      if (!m || m.dead || m.type !== 'firefly' || !m.body) continue;
      const d = this.deltaToPoint(m.body, x, y, z);
      const dist = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      if (dist >= 2.35) continue;
      const level = Math.max(0, 1 - dist / 2.35) * (Number.isFinite(+m.fireflyLightPower) ? +m.fireflyLightPower : 1) / 15;
      r += level; g += level * 0.38; b += level * 0.035;
    }
    return [Math.min(1, r), Math.min(1, g), Math.min(1, b)];
  },

  buildModel(type, gunId, color) {
    const g = new THREE.Group();
    const parts = { legs: [], wool: [] };
    if (type === 'firefly') {
      const a = this.fireflyAssets();
      const body = new THREE.Mesh(a.bodyGeo, a.bodyMat); body.position.y = 0.11;
      const leftWing = new THREE.Mesh(a.wingGeo, a.wingMat); leftWing.position.set(-0.11, 0.14, 0);
      const rightWing = new THREE.Mesh(a.wingGeo, a.wingMat); rightWing.position.set(0.11, 0.14, 0);
      g.add(body, leftWing, rightWing); parts.head = body; parts.body = body; parts.wings = [leftWing, rightWing];
    } else if (OCEAN_MOB_DEFS[type]) {
      const d = OCEAN_MOB_DEFS[type];
      // Per-species skins. Body parts are box faces, so a 16x16 side view maps
      // cleanly; countershading (dark back / pale belly) + a mid lateral line +
      // species markings read at a glance. seed keeps speckle stable per type.
      const seed = type.length * 13 + 7;
      const eye = (c, ex) => { c.fillStyle = '#0b0e12'; c.fillRect(ex, 5, 2, 2); c.fillStyle = '#f4f8fb'; c.fillRect(ex, 5, 1, 1); };
      const painters = {
        minnow: (c) => {
          c.fillStyle = '#9bc8d8'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#3f6d80'; c.fillRect(0, 0, 16, 4);
          c.fillStyle = '#eaf7fb'; c.fillRect(0, 12, 16, 4);
          c.fillStyle = '#35606f'; c.fillRect(0, 8, 16, 1);
          this._skinSpeck(c, ['#8bbccd', '#b6dce8'], 12, seed); eye(c, 12);
        },
        salmon: (c) => {
          c.fillStyle = '#db7f75'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#8f4048'; c.fillRect(0, 0, 16, 5);
          c.fillStyle = '#f0d8cc'; c.fillRect(0, 12, 16, 4);
          c.fillStyle = '#6d2f38'; for (let i = 1; i < 15; i += 4) c.fillRect(i, 2 + (i % 3), 2, 1);
          c.fillStyle = '#ffe9df'; c.fillRect(0, 11, 16, 1);
          this._skinSpeck(c, ['#c96c62', '#8f4048'], 14, seed); eye(c, 12);
        },
        tuna: (c) => {
          c.fillStyle = '#4e82a8'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#223f5a'; c.fillRect(0, 0, 16, 5);
          c.fillStyle = '#dbe8f0'; c.fillRect(0, 11, 16, 5);
          c.fillStyle = '#8fb0c6'; c.fillRect(0, 8, 16, 1);
          c.fillStyle = '#f2c744'; for (let i = 1; i < 6; i++) { c.fillRect(i * 2, 5, 1, 1); c.fillRect(i * 2, 10, 1, 1); } // finlets
          this._skinSpeck(c, ['#3f6d90', '#5c93bb'], 12, seed); eye(c, 12);
        },
        clownfish: (c) => {
          c.fillStyle = '#ff8b2f'; c.fillRect(0, 0, 16, 16);
          // three white vertical bands with black edging (the classic look)
          for (const bx of [2, 7, 12]) { c.fillStyle = '#0f0f14'; c.fillRect(bx - 1, 0, 5, 16); c.fillStyle = '#fbf6ec'; c.fillRect(bx, 0, 3, 16); }
          c.fillStyle = '#1d1d24'; c.fillRect(0, 0, 16, 2); c.fillRect(0, 14, 16, 2); // dark fin edges
          eye(c, 13);
        },
        pufferfish: (c) => {
          c.fillStyle = '#d6bd55'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#9a832f'; c.fillRect(0, 0, 16, 4);
          c.fillStyle = '#f2e6a8'; c.fillRect(0, 11, 16, 5);
          c.fillStyle = '#5f4f1c'; for (const [sx, sy] of [[3, 6], [7, 8], [11, 5], [5, 10], [13, 9], [9, 3]]) c.fillRect(sx, sy, 2, 2); // dark spots
          c.fillStyle = '#4a3d15'; for (let i = 0; i < 16; i += 3) { c.fillRect(i, 0, 1, 1); c.fillRect(i + 1, 15, 1, 1); } // spikes on edges
          eye(c, 12);
        },
        anglerfish: (c) => {
          c.fillStyle = '#1c2233'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#0a0d16'; c.fillRect(0, 0, 16, 5);
          c.fillStyle = '#2b3350'; c.fillRect(0, 12, 16, 4);
          c.fillStyle = '#e8f4f4'; for (let i = 1; i < 15; i += 2) c.fillRect(i, 8, 1, 2 + (i % 2)); // jagged teeth
          c.fillStyle = '#3b4568'; c.fillRect(0, 8, 16, 1);
          c.fillStyle = '#b6ffff'; c.fillRect(12, 2, 2, 2); // faint lure glow
          this._skinSpeck(c, ['#151a29', '#28304a'], 16, seed); eye(c, 11);
        },
        shark: (c) => {
          c.fillStyle = '#6d8293'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#33454f'; c.fillRect(0, 0, 16, 7);
          c.fillStyle = '#e3ebef'; c.fillRect(0, 10, 16, 6); // hard countershade belly
          c.fillStyle = '#2a3941'; c.fillRect(0, 9, 16, 1);
          c.fillStyle = '#243138'; for (let i = 0; i < 3; i++) c.fillRect(3 + i * 2, 4, 1, 4); // gill slits
          eye(c, 12);
        },
        jellyfish: (c) => {
          c.fillStyle = '#b79cf5'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#d9c9ff'; c.fillRect(2, 1, 12, 5); // bright dome top
          c.fillStyle = '#8f6fd6'; c.fillRect(0, 9, 16, 2); // rim
          c.fillStyle = '#6e4fb0'; for (let i = 1; i < 16; i += 3) c.fillRect(i, 10, 1, 6); // hanging frills
          c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(4, 2, 3, 2);
        },
        stingray: (c) => {
          c.fillStyle = '#8b796b'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#6a5b4f'; for (const [sx, sy] of [[3, 4], [10, 3], [6, 9], [12, 11], [2, 12]]) c.fillRect(sx, sy, 3, 2); // top blotches
          c.fillStyle = '#a89684'; for (let i = 0; i < 5; i++) c.fillRect(1 + i * 3, 1, 2, 1);
          this._skinSpeck(c, ['#7a6a5c', '#9c8b7b'], 16, seed); eye(c, 6);
        },
        octopus: (c) => {
          c.fillStyle = '#a64c70'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#57233b'; c.fillRect(0, 0, 16, 3);
          c.fillStyle = '#c96b8d'; c.fillRect(2, 3, 12, 4); // mantle sheen
          c.fillStyle = '#e6a9c0'; for (let r = 10; r < 16; r += 2) for (let sx = 2; sx < 15; sx += 3) c.fillRect(sx, r, 1, 1); // suckers
          this._skinSpeck(c, ['#8e3d5f', '#b85b80'], 14, seed); eye(c, 5);
        },
        dolphin: (c) => {
          c.fillStyle = '#7895a8'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#35566a'; c.fillRect(0, 0, 16, 6);
          c.fillStyle = '#e8eff3'; c.fillRect(0, 11, 16, 5); // pale belly
          c.fillStyle = '#5a7c90'; c.fillRect(0, 9, 16, 1);
          c.fillStyle = '#2c4356'; c.fillRect(3, 2, 1, 1); // blowhole hint
          eye(c, 12);
        },
        seahorse: (c) => {
          c.fillStyle = '#e7ad48'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#b3801f'; for (let i = 0; i < 16; i += 3) c.fillRect(0, i, 16, 1); // body rings
          c.fillStyle = '#f6d488'; c.fillRect(0, 0, 5, 16); // paler snout side
          c.fillStyle = '#8e5d20'; for (let i = 1; i < 16; i += 3) c.fillRect(14, i, 2, 1); // dorsal ridge
          eye(c, 3);
        },
        giant_squid: (c) => {
          c.fillStyle = '#7f354d'; c.fillRect(0, 0, 16, 16);
          c.fillStyle = '#220d19'; c.fillRect(0, 0, 16, 4);
          c.fillStyle = '#9c4763'; c.fillRect(2, 4, 12, 4);
          c.fillStyle = '#e0a8bc'; for (let r = 9; r < 16; r += 2) for (let sx = 1; sx < 16; sx += 2) c.fillRect(sx, r, 1, 1); // suckers
          this._skinSpeck(c, ['#5e243a', '#93425c'], 20, seed); eye(c, 11);
        },
      };
      const paint = painters[type] || ((c) => {
        c.fillStyle = d.main; c.fillRect(0, 0, 16, 16);
        c.fillStyle = d.dark; c.fillRect(0, 0, 16, 4); c.fillRect(0, 12, 16, 4);
        this._skinSpeck(c, [d.main, d.dark, '#d7edf5'], 14, seed);
      });
      // Real per-face unwrap for the body: the flank painter stays on the ±x
      // sides, but the top becomes a dark dorsal, the bottom a pale belly, the
      // +z face a head-on view (crown + two eyes + mouth) and the -z face the
      // tail base. Now you can tell which way the fish is pointing.
      const main = d.main, dark = d.dark;
      const belly = this._mixHex(main, '#ffffff', 0.6);
      const darker = this._mixHex(dark, '#000000', 0.25);
      const bodyFaces = {
        side: paint,
        top: (c) => { c.fillStyle = dark; c.fillRect(0, 0, 16, 16); c.fillStyle = darker; c.fillRect(6, 0, 4, 16); this._skinSpeck(c, [dark, main], 10, seed + 1); },
        bottom: (c) => { c.fillStyle = belly; c.fillRect(0, 0, 16, 16); c.fillStyle = this._mixHex(belly, main, 0.4); c.fillRect(0, 7, 16, 1); this._skinSpeck(c, [belly, '#ffffff'], 8, seed + 2); },
        front: (c) => {
          c.fillStyle = main; c.fillRect(0, 0, 16, 16);
          c.fillStyle = dark; c.fillRect(0, 0, 16, 4);
          c.fillStyle = belly; c.fillRect(0, 12, 16, 4);
          c.fillStyle = '#0b0e12'; c.fillRect(3, 6, 3, 3); c.fillRect(10, 6, 3, 3);
          c.fillStyle = '#f4f8fb'; c.fillRect(3, 6, 1, 1); c.fillRect(10, 6, 1, 1);
          c.fillStyle = darker; c.fillRect(5, 11, 6, 1);
        },
        back: (c) => { c.fillStyle = dark; c.fillRect(0, 0, 16, 16); c.fillStyle = darker; c.fillRect(6, 1, 4, 14); this._skinSpeck(c, [dark, main], 8, seed + 3); },
      };
      if (d.shape === 'jelly') {
        // bell: bright dome on top, frilled ring underneath, translucent bell on the sides
        const bellFaces = {
          side: paint,
          top: (c) => { c.fillStyle = this._mixHex(main, '#ffffff', 0.45); c.fillRect(0, 0, 16, 16); c.fillStyle = this._mixHex(main, '#ffffff', 0.7); c.fillRect(4, 4, 8, 8); },
          bottom: (c) => { c.fillStyle = dark; c.fillRect(0, 0, 16, 16); c.fillStyle = main; for (let i = 1; i < 16; i += 3) c.fillRect(i, 2, 2, 12); },
        };
        const bell = this.tbox(d.w * 2, d.h * 0.45, d.w * 2, 'ocean_' + type, bellFaces, null, { transparent: true, opacity: 0.82 });
        bell.position.y = d.h * 0.72; g.add(bell); parts.head = bell; parts.tentacles = [];
        for (const [x, z] of [[-0.16,-0.12],[0.16,-0.12],[-0.16,0.12],[0.16,0.12]]) { const t = this.tbox(0.06, d.h * 0.55, 0.06, 'ocean_' + type, paint, null, { transparent: true, opacity: 0.72 }); t.position.set(x, d.h * 0.28, z); g.add(t); parts.tentacles.push(t); }
      } else if (d.shape === 'ray') {
        // flat disc: mottled top surface, pale underside, thin dark edge on the sides
        const rayFaces = {
          side: (c) => { c.fillStyle = dark; c.fillRect(0, 0, 16, 16); },
          top: paint,
          bottom: (c) => { c.fillStyle = this._mixHex(main, '#ffffff', 0.5); c.fillRect(0, 0, 16, 16); c.fillStyle = '#3a3128'; c.fillRect(6, 6, 4, 3); this._skinSpeck(c, ['#d8ccbb', '#efe6d8'], 8, seed + 2); },
        };
        const body = this.tbox(d.w * 1.65, d.h * 0.65, d.len * 0.72, 'ocean_' + type, rayFaces); body.position.y = d.h * 0.55; body.rotation.y = Math.PI / 4; g.add(body);
        const tail = this.tbox(0.06, 0.07, d.len * 0.72, 'ocean_' + type, paint); tail.position.set(0, d.h * 0.48, -d.len * 0.62); g.add(tail); parts.tail = tail; parts.head = body;
      } else if (d.shape === 'octopus') {
        // mantle sack: a real face (two big eyes) on +z, suckers underneath
        const octoFaces = {
          side: paint,
          top: (c) => { c.fillStyle = dark; c.fillRect(0, 0, 16, 16); c.fillStyle = main; c.fillRect(3, 3, 10, 10); this._skinSpeck(c, [main, dark], 12, seed + 1); },
          bottom: (c) => { c.fillStyle = this._mixHex(main, '#000000', 0.2); c.fillRect(0, 0, 16, 16); c.fillStyle = this._mixHex(main, '#ffffff', 0.4); for (let r = 2; r < 15; r += 3) for (let sx = 2; sx < 15; sx += 3) c.fillRect(sx, r, 2, 2); },
          front: (c) => {
            c.fillStyle = main; c.fillRect(0, 0, 16, 16);
            c.fillStyle = dark; c.fillRect(0, 0, 16, 3);
            c.fillStyle = '#0b0e12'; c.fillRect(2, 5, 4, 4); c.fillRect(10, 5, 4, 4);
            c.fillStyle = '#f4f8fb'; c.fillRect(3, 6, 1, 1); c.fillRect(11, 6, 1, 1);
            c.fillStyle = darker; c.fillRect(6, 12, 4, 1);
          },
        };
        const head = this.tbox(d.w * 1.35, d.h * 0.58, d.w * 1.25, 'ocean_' + type, octoFaces); head.position.y = d.h * 0.68; g.add(head); parts.head = head; parts.tentacles = [];
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, t = this.tbox(0.07, d.h * 0.55, 0.07, 'ocean_' + type, paint); t.position.set(Math.cos(a) * d.w * 0.65, d.h * 0.28, Math.sin(a) * d.w * 0.65); t.rotation.z = Math.cos(a) * 0.25; g.add(t); parts.tentacles.push(t); }
      } else if (d.shape === 'seahorse') {
        const body = this.tbox(d.w * 1.25, d.h * 0.55, d.w, 'ocean_' + type, bodyFaces); body.position.y = d.h * 0.48;
        const head = this.tbox(d.w * 1.1, d.h * 0.24, d.w * 1.4, 'ocean_' + type, bodyFaces); head.position.set(0, d.h * 0.83, d.w * 0.35);
        const snout = this.tbox(d.w * 0.45, d.h * 0.11, d.w * 1.4, 'ocean_' + type, paint); snout.position.set(0, d.h * 0.83, d.w * 1.0);
        const tail = this.tbox(0.07, d.h * 0.38, 0.07, 'ocean_' + type, paint); tail.position.set(0, d.h * 0.17, -d.w * 0.25); tail.rotation.x = 0.45; g.add(body, head, snout, tail); parts.head = head; parts.tail = tail;
      } else {
        const body = this.tbox(d.w * 1.8, d.h * 0.72, d.len * 0.72, 'ocean_' + type, bodyFaces); body.position.y = d.h * 0.53; g.add(body); parts.head = body;
        const tail = this.tbox(Math.max(0.05, d.w * 0.22), d.h * 0.72, d.len * 0.25, 'ocean_' + type, paint); tail.position.set(0, d.h * 0.53, -d.len * 0.49); tail.rotation.y = Math.PI / 4; g.add(tail); parts.tail = tail;
        const fin = this.tbox(Math.max(0.05, d.w * 0.18), d.h * 0.8, d.len * 0.18, 'ocean_' + type, paint); fin.position.set(0, d.h * 0.93, -d.len * 0.05); fin.rotation.z = 0.35; g.add(fin); parts.fin = fin;
        if (d.angler) { const stem = this.box(0.035, d.h * 0.7, 0.035, 0x293044); stem.position.set(0, d.h * 1.15, d.len * 0.2); stem.rotation.x = -0.55; const lure = this.box(0.12, 0.12, 0.12, 0xc8ffff); lure.position.set(0, d.h * 1.35, d.len * 0.48); g.add(stem, lure); parts.lure = lure; }
      }
    } else if (type === 'lavaback') {
      // Lapras cut from cooling lava: dark basalt crust webbed with glowing cracks, a
      // molten underbelly + paddle flippers, a long neck to a small head, stubby tail.
      const crust = (c) => {
        c.fillStyle = '#241812'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#150d09'; c.fillRect(2, 0, 2, 16); c.fillRect(11, 0, 1, 16);
        c.fillStyle = '#ff6a1e'; c.fillRect(0, 7, 16, 1); c.fillRect(6, 0, 1, 16); c.fillRect(12, 3, 1, 10);
        c.fillStyle = '#ffb648'; c.fillRect(3, 4, 2, 1); c.fillRect(9, 10, 2, 1); c.fillRect(6, 12, 2, 1);
        this._skinSpeck(c, ['#160e08', '#ff7a2a', '#32210f'], 30, 91);
      };
      const molten = (c) => {
        c.fillStyle = '#ff6a1e'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#ffd44a'; c.fillRect(0, 5, 16, 6);
        c.fillStyle = '#c53810'; c.fillRect(0, 0, 16, 2); c.fillRect(0, 14, 16, 2);
        this._skinSpeck(c, ['#ff9a3a', '#ffe98a', '#e2560f'], 26, 45);
      };
      const glow = { emissive: 0xff5a1e, emissiveIntensity: 0.5 };
      const belly = { emissive: 0xff7a26, emissiveIntensity: 0.8 };
      const body = this.tbox(1.5, 0.95, 1.5, 'lava_crust', crust, null, glow); body.position.set(0, 0.82, 0);
      const under = this.tbox(1.3, 0.42, 1.32, 'lava_molten', molten, null, belly); under.position.set(0, 0.44, 0);
      const shell = this.tbox(1.34, 0.62, 1.34, 'lava_crust', crust, null, glow); shell.position.set(0, 1.44, -0.06);
      for (const [sx, sz] of [[0, -0.12], [-0.36, 0.16], [0.36, 0.16]]) {
        const sp = this.tbox(0.2, 0.52, 0.2, 'lava_crust', crust, null, glow);
        sp.position.set(sx, 1.84, sz); sp.rotation.x = sz > 0 ? 0.22 : -0.16; g.add(sp);
      }
      const neck = this.tbox(0.42, 1.0, 0.44, 'lava_crust', crust, null, glow); neck.position.set(0, 1.3, 0.6); neck.rotation.x = -0.5;
      const head = this.tbox(0.5, 0.46, 0.62, 'lava_crust', crust, null, glow); head.position.set(0, 1.88, 1.0);
      const eyeGeo = new THREE.BoxGeometry(0.1, 0.12, 0.05);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat), eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.15, 0.06, 0.3); eyeR.position.set(0.15, 0.06, 0.3); head.add(eyeL, eyeR);
      const tail = this.tbox(0.34, 0.34, 0.5, 'lava_crust', crust, null, glow); tail.position.set(0, 0.64, -0.86); tail.rotation.x = 0.42;
      parts.flippers = [];
      for (const [fx, fz] of [[-0.72, 0.5], [0.72, 0.5], [-0.72, -0.5], [0.72, -0.5]]) {
        const fl = this.tbox(0.5, 0.2, 0.72, 'lava_molten', molten, null, belly);
        fl.position.set(fx, 0.42, fz); fl.rotation.z = fx < 0 ? 0.5 : -0.5;
        g.add(fl); parts.flippers.push(fl);
      }
      g.add(body, under, shell, neck, head, tail);
      parts.head = head; parts.neck = neck; parts.body = body;
    } else if (type === 'sprawler') {
      // Uncanny found-footage cryptid silhouette: tar-black hide, stilt legs,
      // a hanging faceless hood, and no exposed flesh/bones.
      const hide = (c) => {
        c.fillStyle = '#101416'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#252b2d'; c.fillRect(0, 3, 16, 1); c.fillRect(0, 11, 16, 1);
        c.fillStyle = '#07090a'; c.fillRect(2, 0, 2, 16); c.fillRect(12, 0, 1, 16);
        this._skinSpeck(c, ['#303638', '#0a0d0e', '#1b2022'], 38, 67);
      };
      const limb = (c) => {
        c.fillStyle = '#080b0c'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#1b2022'; c.fillRect(6, 0, 4, 16);
        c.fillStyle = '#32383a'; c.fillRect(0, 4, 16, 1); c.fillRect(0, 12, 16, 1);
        this._skinSpeck(c, ['#252b2d', '#050607'], 24, 71);
      };
      const mask = (c) => {
        c.fillStyle = '#aeb0a6'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#7d817c'; c.fillRect(2, 2, 1, 12); c.fillRect(12, 1, 1, 13);
        c.fillStyle = '#d2d2c7'; c.fillRect(4, 1, 6, 2);
        this._skinSpeck(c, ['#858981', '#c5c6bb', '#646864'], 22, 79);
      };

      const shell = this.tbox(2.72, 0.46, 1.72, 'sprawler_hide', hide); shell.position.set(0, 1.55, -0.08);
      const ridge = this.tbox(0.34, 0.28, 2.12, 'sprawler_limb', limb); ridge.position.set(0, 1.77, -0.12);
      const under = this.tbox(1.82, 0.22, 1.28, 'sprawler_limb', limb); under.position.set(0, 1.27, -0.02);
      g.add(shell, ridge, under);

      // Tattered hanging strips make the body read as an impossible dark mass,
      // not a fleshy animal.
      for (const [x, z, h] of [[-0.92,-0.52,0.34],[-0.45,0.48,0.46],[0.12,-0.58,0.30],[0.66,0.42,0.42],[1.02,-0.10,0.28]]) {
        const strip = this.tbox(0.12, h, 0.10, 'sprawler_limb', limb);
        strip.position.set(x, 1.18 - h * 0.5, z); strip.rotation.z = x * 0.05; g.add(strip);
      }

      const head = new THREE.Group(); head.position.set(0, 1.16, 1.02);
      const neck = this.tbox(0.26, 0.72, 0.26, 'sprawler_limb', limb); neck.position.set(0, 0.20, -0.20); neck.rotation.x = 0.52;
      const hood = this.tbox(0.66, 0.76, 0.52, 'sprawler_hide', hide); hood.position.set(0, -0.10, 0.14); hood.rotation.x = -0.10;
      const face = this.tbox(0.38, 0.50, 0.07, 'sprawler_mask', mask); face.position.set(0, -0.09, 0.43);
      const slit = this.box(0.055, 0.34, 0.035, 0x020303); slit.position.set(0, -0.10, 0.485);
      head.add(neck, hood, face, slit); g.add(head); parts.head = head;

      // Four long, backwards-jointed stilt legs. The rig roots stay inside the
      // 3x3 footprint and the feet remain near ground level.
      for (const side of [-1, 1]) for (const front of [-1, 1]) {
        const rig = new THREE.Group(); rig.position.set(side * 0.98, 1.46, front * 0.60);
        const upper = this.tbox(0.20, 0.72, 0.20, 'sprawler_limb', limb); upper.position.set(side * 0.06, -0.30, front * 0.02); upper.rotation.z = side * -0.22; upper.rotation.x = front * 0.12;
        const joint = this.box(0.25, 0.22, 0.25, 0x151a1c); joint.position.set(side * 0.19, -0.67, front * 0.11);
        const lower = this.tbox(0.15, 0.74, 0.15, 'sprawler_limb', limb); lower.position.set(side * 0.28, -0.98, front * 0.20); lower.rotation.z = side * 0.18; lower.rotation.x = front * -0.10;
        const foot = this.tbox(0.38, 0.11, 0.58, 'sprawler_limb', limb); foot.position.set(side * 0.29, -1.34, front * 0.33); foot.rotation.y = side * front * 0.10;
        rig.add(upper, joint, lower, foot); g.add(rig); parts.legs.push(rig);
      }

      // Thin aerial feelers give it a distant, distorted silhouette while
      // keeping the whole creature at roughly two blocks tall.
      for (const [x, z, rz] of [[-0.58,-0.46,-0.18],[0.52,-0.22,0.16],[0.05,0.42,-0.08]]) {
        const feeler = this.tbox(0.07, 0.42, 0.07, 'sprawler_limb', limb);
        feeler.position.set(x, 1.78, z); feeler.rotation.z = rz; feeler.rotation.x = z * 0.12; g.add(feeler);
      }
    } else if (type === 'creeper') {

      // weird explosive frog: mottled skin, pale speckled belly, banded legs
      const frogSkin = (c) => {
        c.fillStyle = '#4db843'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#3d9635';
        c.fillRect(2, 3, 3, 2); c.fillRect(9, 2, 3, 2); c.fillRect(5, 9, 3, 2); c.fillRect(12, 8, 2, 2); c.fillRect(1, 12, 2, 2);
        this._skinSpeck(c, ['#8fdb84', '#3d9635', '#5fc954'], 26, 3);
      };
      const frogBelly = (c) => {
        c.fillStyle = '#8fdb84'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#a8e89e'; for (let yy = 2; yy < 16; yy += 3) c.fillRect(1, yy, 14, 1);
        this._skinSpeck(c, ['#79cc6e', '#b8f0ae'], 14, 5);
      };
      const frogLeg = (c) => {
        c.fillStyle = '#3d9635'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#2e7a28'; c.fillRect(0, 4, 16, 2); c.fillRect(0, 10, 16, 2);
        this._skinSpeck(c, ['#4db843', '#2e7a28'], 12, 7);
      };
      const body = this.tbox(0.8, 0.45, 0.7, 'frog_skin', frogSkin);
      body.position.y = 0.35;
      const belly = this.tbox(0.7, 0.2, 0.6, 'frog_belly', frogBelly);
      belly.position.y = 0.18;
      const head = this.tbox(0.7, 0.35, 0.45, 'frog_skin', frogSkin, this.frogFace());
      head.position.set(0, 0.72, 0.2);
      g.add(body, belly, head);
      parts.head = head;
      for (const side of [-1, 1]) {
        const eye = this.box(0.18, 0.2, 0.18, 0xffffff);
        eye.position.set(side * 0.22, 0.95, 0.25);
        const pupil = this.box(0.09, 0.1, 0.06, 0x000000);
        pupil.position.set(side * 0.22, 0.97, 0.35);
        g.add(eye, pupil);
        const legBack = this.tbox(0.24, 0.3, 0.45, 'frog_leg', frogLeg);
        legBack.position.set(side * 0.45, 0.18, -0.25);
        legBack.rotation.x = -0.4;
        const legFront = this.tbox(0.14, 0.28, 0.14, 'frog_leg', frogLeg);
        legFront.position.set(side * 0.3, 0.15, 0.3);
        g.add(legBack, legFront);
        parts.legs.push(legBack, legFront);
      }
    } else if (type === 'skeleton') {
      // ribcage torso, jointed bone limbs, cracked skull
      const skelBody = (c) => {
        c.fillStyle = '#8a8a8a'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#d8d8d8';
        for (let yy = 2; yy < 12; yy += 3) c.fillRect(1, yy, 14, 2); // ribs
        c.fillStyle = '#c0c0c0'; c.fillRect(7, 0, 2, 16);            // spine/sternum
        c.fillStyle = '#6a6a6a'; c.fillRect(0, 13, 16, 3);           // pelvis shadow
      };
      const skelLimb = (c) => {
        c.fillStyle = '#c9c9c9'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#e2e2e2'; c.fillRect(6, 0, 4, 16);            // shaft highlight
        c.fillStyle = '#8a8a8a'; c.fillRect(0, 7, 16, 2);            // knee/elbow joint
        c.fillStyle = '#a8a8a8'; c.fillRect(0, 0, 16, 2); c.fillRect(0, 14, 16, 2);
      };
      const skelSkull = (c) => {
        c.fillStyle = '#c9c9c9'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#a8a8a8'; c.fillRect(0, 13, 16, 3);
        c.fillStyle = '#8a8a8a'; c.fillRect(3, 4, 1, 4); c.fillRect(10, 7, 3, 1); // cracks
      };
      const body = this.tbox(0.45, 0.75, 0.22, 'skel_body', skelBody);
      body.position.y = 1.05;
      const head = this.tbox(0.5, 0.5, 0.5, 'skel_skull', skelSkull, this.skeletonFace());
      head.position.y = 1.7;
      g.add(body, head);
      parts.head = head;
      for (const px of [-0.13, 0.13]) {
        const leg = this.tbox(0.16, 0.7, 0.16, 'skel_limb', skelLimb);
        leg.position.set(px, 0.35, 0);
        g.add(leg); parts.legs.push(leg);
      }
      for (const px of [-0.3, 0.3]) {
        const arm = this.tbox(0.14, 0.6, 0.14, 'skel_limb', skelLimb);
        arm.position.set(px, 1.15, 0);
        g.add(arm); parts.legs.push(arm);
      }
      const bow = this.box(0.06, 0.5, 0.06, 0x7a5c36);
      bow.position.set(0.3, 1.1, 0.25);
      bow.rotation.x = 0.4;
      g.add(bow);
    } else if (type === 'sheep') {
      // white curl texture tinted by wool color, so dyed sheep still work
      const woolCurls = (c) => {
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#e2e2de';
        for (let yy = 0; yy < 16; yy += 4) for (let xx = (yy / 4) % 2 * 2; xx < 16; xx += 4) c.fillRect(xx, yy, 2, 2);
        this._skinSpeck(c, ['#f2f2ee', '#d6d6d0', '#ffffff'], 30, 11);
      };
      const sheepLeg = (c) => {
        c.fillStyle = '#d8d8d0'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#e8e8e2'; c.fillRect(0, 0, 16, 5); // wool cuff
        c.fillStyle = '#8a7a6a'; c.fillRect(0, 12, 16, 4); // hoof
      };
      const woolCol = color ? COLOR_HEX[color] : 0xe8e8e8;
      const body = this.tbox(0.9, 0.65, 0.6, 'sheep_wool', woolCurls, null, { color: woolCol });
      body.position.y = 0.85;
      const head = this.tbox(0.42, 0.42, 0.42, 'sheep_wool', woolCurls, this.sheepFace());
      head.position.set(0, 1.25, 0.5);
      g.add(body, head);
      parts.head = head;
      parts.wool.push(body);
      for (const [px, pz] of [[-0.25, 0.2], [0.25, 0.2], [-0.25, -0.2], [0.25, -0.2]]) {
        const leg = this.tbox(0.16, 0.55, 0.16, 'sheep_leg', sheepLeg);
        leg.position.set(px, 0.28, pz);
        g.add(leg); parts.legs.push(leg);
      }
    } else if (type === 'chicken') {
      // feather streaks + layered wing rows
      const chickenBody = (c) => {
        c.fillStyle = '#f5f5f5'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#e4e4e0';
        for (let yy = 3; yy < 16; yy += 4) for (let xx = 0; xx < 16; xx += 5) c.fillRect(xx + (yy % 2), yy, 3, 1);
        this._skinSpeck(c, ['#ffffff', '#dcdcd6'], 16, 13);
      };
      const chickenWing = (c) => {
        c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#d2d2cc'; c.fillRect(0, 5, 16, 1); c.fillRect(0, 10, 16, 1);
        c.fillStyle = '#c2c2ba'; for (let xx = 1; xx < 16; xx += 4) { c.fillRect(xx, 12, 2, 4); }
      };
      const body = this.tbox(0.5, 0.45, 0.6, 'chicken_body', chickenBody);
      body.position.y = 0.5;
      const head = this.tbox(0.3, 0.35, 0.3, 'chicken_body', chickenBody, this.chickenFace());
      head.position.set(0, 0.95, 0.25);
      const tail = this.tbox(0.35, 0.3, 0.2, 'chicken_wing', chickenWing);
      tail.position.set(0, 0.6, -0.3);
      g.add(body, head, tail);
      parts.head = head;
      for (const px of [-0.12, 0.12]) {
        const leg = this.box(0.08, 0.3, 0.08, 0xff9d2e);
        leg.position.set(px, 0.15, 0.05);
        g.add(leg); parts.legs.push(leg);
      }
      for (const side of [-1, 1]) {
        const wing = this.tbox(0.08, 0.3, 0.4, 'chicken_wing', chickenWing);
        wing.position.set(side * 0.3, 0.55, 0);
        g.add(wing); parts.legs.push(wing);
      }
    } else if (type === 'jelly' || type === 'big_jelly') {
      parts.arms = [];
      const big = type === 'big_jelly';
      const body = this.jellyBox(big ? 0.62 : 0.34, big ? 0.78 : 0.38, big ? 0.34 : 0.22, color, 'body');
      body.position.y = big ? 0.86 : 0.48;
      const head = this.jellyBox(big ? 0.54 : 0.34, big ? 0.48 : 0.30, big ? 0.54 : 0.34, color, 'head');
      head.position.y = big ? 1.49 : 0.82;
      g.add(body, head);
      parts.head = head;
      for (const px of (big ? [-0.17, 0.17] : [-0.09, 0.09])) {
        const leg = this.jellyBox(big ? 0.18 : 0.12, big ? 0.72 : 0.32, big ? 0.16 : 0.12, color, 'leg');
        leg.position.set(px, big ? 0.36 : 0.16, 0);
        g.add(leg); parts.legs.push(leg);
      }
      for (const px of (big ? [-0.43, 0.43] : [-0.24, 0.24])) {
        const arm = this.jellyBox(big ? 0.15 : 0.09, big ? 0.70 : 0.32, big ? 0.14 : 0.09, color, 'arm');
        arm.position.set(px, big ? 0.90 : 0.49, 0);
        g.add(arm); parts.arms.push(arm); parts.legs.push(arm);
      }
    } else if (type === 'camel') {
      // shaggy sand fur, darker humps and hoofed legs
      const camelFur = (c) => {
        c.fillStyle = '#d2a24c'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#c1913e';
        for (let yy = 2; yy < 16; yy += 3) for (let xx = 0; xx < 16; xx += 4) c.fillRect(xx + (yy % 3), yy, 2, 1);
        this._skinSpeck(c, ['#e0b45e', '#b8853c'], 20, 17);
      };
      const camelHump = (c) => {
        c.fillStyle = '#b8853c'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#a87632'; for (let yy = 1; yy < 16; yy += 3) c.fillRect(0, yy, 16, 1);
        c.fillStyle = '#c99b4a'; c.fillRect(2, 1, 12, 2);
      };
      const camelLeg = (c) => {
        c.fillStyle = '#b8853c'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#a87632'; c.fillRect(0, 6, 16, 1); c.fillRect(0, 11, 16, 1);
        c.fillStyle = '#6b4f26'; c.fillRect(0, 13, 16, 3); // hoof
      };
      const body = this.tbox(0.8, 0.7, 1.5, 'camel_fur', camelFur);
      body.position.y = 1.15;
      const hump1 = this.tbox(0.5, 0.35, 0.45, 'camel_hump', camelHump);
      hump1.position.set(0, 1.65, 0.35);
      const hump2 = this.tbox(0.5, 0.35, 0.45, 'camel_hump', camelHump);
      hump2.position.set(0, 1.65, -0.35);
      const neck = this.tbox(0.3, 0.6, 0.3, 'camel_fur', camelFur);
      neck.position.set(0, 1.7, 0.75);
      const head = this.tbox(0.35, 0.35, 0.5, 'camel_fur', camelFur, this.camelFace());
      head.position.set(0, 2.05, 0.9);
      g.add(body, hump1, hump2, neck, head);
      parts.head = head;
      for (const [px, pz] of [[-0.28, 0.55], [0.28, 0.55], [-0.28, -0.55], [0.28, -0.55]]) {
        const leg = this.tbox(0.18, 0.8, 0.18, 'camel_leg', camelLeg);
        leg.position.set(px, 0.4, pz);
        g.add(leg); parts.legs.push(leg);
      }
    } else if (type === 'spider') {
      // bristly abdomen with a red marking, banded chitin legs
      const spiderBody = (c) => {
        c.fillStyle = '#2a2028'; c.fillRect(0, 0, 16, 16);
        this._skinSpeck(c, ['#3a3038', '#1a1418', '#453a44'], 34, 19);
        c.fillStyle = '#c02020'; c.fillRect(7, 3, 2, 3); c.fillRect(6, 6, 4, 2); c.fillRect(7, 8, 2, 3);
        c.fillStyle = '#801515'; c.fillRect(7, 6, 2, 2);
      };
      const spiderLeg = (c) => {
        c.fillStyle = '#1a1418'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#332a32'; c.fillRect(4, 0, 2, 16); c.fillRect(10, 0, 2, 16); // joint bands
        c.fillStyle = '#0d0a0d'; c.fillRect(14, 0, 2, 16);
      };
      const body = this.tbox(0.85, 0.45, 0.85, 'spider_body', spiderBody);
      body.position.y = 0.45;
      const head = this.tbox(0.5, 0.4, 0.5, 'spider_head', (c) => {
        c.fillStyle = '#2a2028'; c.fillRect(0, 0, 16, 16);
        this._skinSpeck(c, ['#3a3038', '#1a1418'], 22, 23);
      }, this.spiderFace());
      head.position.set(0, 0.45, 0.6);
      g.add(body, head);
      parts.head = head;
      for (const side of [-1, 1]) {
        for (let l = 0; l < 4; l++) {
          const leg = this.tbox(0.5, 0.08, 0.08, 'spider_leg', spiderLeg);
          leg.position.set(side * 0.6, 0.4, -0.3 + l * 0.2);
          leg.rotation.z = -side * 0.45; // outer tips point DOWN (spiders are no longer doing yoga)
          g.add(leg); parts.legs.push(leg);
        }
      }
    } else if (type === 'humbug') {
      // corporate menace: suit jacket with lapels and buttons, cuffed sleeves
      const humbugSuit = (c) => {
        c.fillStyle = '#3a3f45'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#2a2f35';
        for (let i = 0; i < 6; i++) { c.fillRect(5 - i > 0 ? 5 - i : 0, i, 2, 1); c.fillRect(9 + i < 15 ? 9 + i : 14, i, 2, 1); } // lapel V
        c.fillRect(7, 0, 2, 16); // jacket opening
        c.fillStyle = '#c9ced4'; c.fillRect(6, 7, 1, 1); c.fillRect(6, 10, 1, 1); // buttons
        c.fillStyle = '#6a7076'; c.fillRect(0, 0, 16, 1); // collar
        c.fillStyle = '#c02020'; c.fillRect(7, 1, 2, 4);  // tie
      };
      const humbugArm = (c) => {
        c.fillStyle = '#3a3f45'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#2a2f35'; c.fillRect(0, 5, 16, 1);
        c.fillStyle = '#6a7076'; c.fillRect(0, 11, 16, 1); // cuff
        c.fillStyle = '#9aa0a6'; c.fillRect(0, 12, 16, 4); // hand
      };
      const humbugLeg = (c) => {
        c.fillStyle = '#2a2f35'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#22262b'; c.fillRect(7, 0, 2, 16);
        c.fillStyle = '#17191c'; c.fillRect(0, 13, 16, 3); // shoes
      };
      const humbugHead = (c) => {
        c.fillStyle = '#9aa0a6'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#8a9096'; c.fillRect(0, 0, 16, 3); // dour brow shading
        this._skinSpeck(c, ['#a8aeb4', '#8a9096'], 12, 29);
      };
      // the tie + lapels belong on the FRONT only; the back gets a vent seam and
      // the sides a shoulder/sleeve seam, so the jacket wraps like real clothing
      const humbugBack = (c) => { c.fillStyle = '#3a3f45'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#6a7076'; c.fillRect(0, 0, 16, 1); c.fillStyle = '#2a2f35'; c.fillRect(7, 3, 2, 13); };
      const humbugSide = (c) => { c.fillStyle = '#3a3f45'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#6a7076'; c.fillRect(0, 0, 16, 1); c.fillStyle = '#2a2f35'; c.fillRect(2, 2, 1, 14); };
      const humbugTop = (c) => { c.fillStyle = '#6a7076'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#3a3f45'; c.fillRect(3, 3, 10, 10); c.fillStyle = '#c02020'; c.fillRect(7, 6, 2, 4); };
      const humbugBottom = (c) => { c.fillStyle = '#2a2f35'; c.fillRect(0, 0, 16, 16); };
      const body = this.tbox(0.55, 0.85, 0.35, 'humbug_suit', { side: humbugSide, front: humbugSuit, back: humbugBack, top: humbugTop, bottom: humbugBottom });
      body.position.y = 1.0;
      const head = this.tbox(0.58, 0.58, 0.58, 'humbug_head', humbugHead, this.humbugFace());
      head.position.y = 1.85;
      const antenna = this.box(0.06, 0.35, 0.06, 0x6a7076);
      antenna.position.y = 2.3;
      const antennaTip = this.box(0.12, 0.12, 0.12, 0xc02020);
      antennaTip.position.y = 2.5;
      g.add(body, head, antenna, antennaTip);
      parts.head = head;
      for (const px of [-0.15, 0.15]) {
        const leg = this.tbox(0.2, 0.55, 0.2, 'humbug_leg', humbugLeg);
        leg.position.set(px, 0.28, 0);
        g.add(leg); parts.legs.push(leg);
      }
      for (const px of [-0.38, 0.38]) {
        const arm = this.tbox(0.16, 0.6, 0.16, 'humbug_arm', humbugArm);
        arm.position.set(px, 1.15, 0);
        g.add(arm); parts.legs.push(arm);
      }
      if (gunId) {
        const gun = this.box(0.12, 0.12, 0.6, 0x3a3a40);
        gun.position.set(0.38, 0.95, 0.3);
        g.add(gun);
        parts.gun = gun;
      }
    } else if (type === 'tung') {
      // TUNG TUNG TUNG SAHUR: a log with terrible intentions and a baseball bat
      const tungBark = (c) => {
        c.fillStyle = '#6b502e'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#5a4226';
        for (let xx = 0; xx < 16; xx += 3) c.fillRect(xx, 0, 1, 16); // bark grain
        c.fillStyle = '#7a5c36'; c.fillRect(2, 0, 1, 16); c.fillRect(8, 0, 1, 16); c.fillRect(13, 0, 1, 16);
        this._skinSpeck(c, ['#5a4226', '#7a5c36'], 14, 31);
      };
      const tungLimb = (c) => {
        c.fillStyle = '#5a4226'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#4a3521'; c.fillRect(5, 0, 2, 16); c.fillRect(11, 0, 1, 16);
        c.fillStyle = '#6b502e'; c.fillRect(0, 0, 1, 16);
      };
      const batWood = (c) => {
        c.fillStyle = '#d2a24c'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#b8853c'; c.fillRect(4, 0, 1, 16); c.fillRect(10, 0, 1, 16); // grain
        c.fillStyle = '#6b4f26'; c.fillRect(0, 12, 16, 4); // grip tape
      };
      const body = this.tbox(0.7, 1.7, 0.7, 'tung_bark', tungBark, this.tungFace());
      body.position.y = 1.3;
      const rings = this.tbox(0.75, 0.12, 0.75, 'tung_limb', tungLimb);
      rings.position.y = 2.0;
      g.add(body, rings);
      parts.head = body;
      for (const px of [-0.2, 0.2]) {
        const leg = this.tbox(0.22, 0.45, 0.22, 'tung_limb', tungLimb);
        leg.position.set(px, 0.22, 0);
        g.add(leg); parts.legs.push(leg);
      }
      const arm = this.tbox(0.16, 0.7, 0.16, 'tung_limb', tungLimb);
      arm.position.set(0.45, 1.5, 0);
      g.add(arm); parts.legs.push(arm);
      const bat = this.tbox(0.14, 0.85, 0.14, 'tung_bat', batWood);
      bat.position.set(0.45, 2.0, 0.25);
      bat.rotation.x = 0.6;
      g.add(bat);
      parts.bat = bat;
    } else { // Mr Floop
      // festive blue coat with white trim + gold buttons, mossy green skin
      const floopCoat = (c) => {
        c.fillStyle = '#3d6b8f'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#33597a'; c.fillRect(7, 0, 2, 16); // coat opening
        c.fillStyle = '#ffd700'; c.fillRect(6, 4, 1, 1); c.fillRect(6, 8, 1, 1); c.fillRect(6, 12, 1, 1);
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, 16, 2); c.fillRect(0, 14, 16, 2); // fur trim
        this._skinSpeck(c, ['#477aa3', '#33597a'], 12, 37);
      };
      const floopArm = (c) => {
        c.fillStyle = '#3d6b8f'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#ffffff'; c.fillRect(0, 10, 16, 2); // cuff
        c.fillStyle = '#7ec48a'; c.fillRect(0, 12, 16, 4); // hand
      };
      const floopLeg = (c) => {
        c.fillStyle = '#2d4b66'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#243d54'; c.fillRect(7, 0, 2, 16);
        c.fillStyle = '#17191c'; c.fillRect(0, 13, 16, 3); // boots
      };
      const floopHead = (c) => {
        c.fillStyle = '#7ec48a'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#6fb37b'; c.fillRect(0, 0, 16, 3);
        this._skinSpeck(c, ['#8fd49a', '#6fb37b'], 14, 41);
      };
      // buttons + coat opening on the front only; plain back seam and side seams
      const floopBack = (c) => { c.fillStyle = '#3d6b8f'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#ffffff'; c.fillRect(0, 0, 16, 2); c.fillRect(0, 14, 16, 2); c.fillStyle = '#33597a'; c.fillRect(7, 2, 2, 12); this._skinSpeck(c, ['#477aa3', '#33597a'], 10, 38); };
      const floopSide = (c) => { c.fillStyle = '#3d6b8f'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#ffffff'; c.fillRect(0, 0, 16, 2); c.fillRect(0, 14, 16, 2); c.fillStyle = '#33597a'; c.fillRect(2, 2, 1, 12); };
      const floopTop = (c) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#3d6b8f'; c.fillRect(3, 3, 10, 10); };
      const body = this.tbox(0.55, 0.85, 0.35, 'floop_coat', { side: floopSide, front: floopCoat, back: floopBack, top: floopTop, bottom: floopBack });
      body.position.y = 1.0;
      const head = this.tbox(0.6, 0.6, 0.6, 'floop_head', floopHead, this.floopFace());
      head.position.y = 1.85;
      const nose = this.box(0.18, 0.18, 0.35, 0x5da36c);
      nose.position.set(0, 1.78, 0.42);
      const hat = this.box(0.65, 0.18, 0.65, 0xffffff);
      hat.position.y = 2.18;
      const hatTop = this.box(0.45, 0.3, 0.45, 0xc22430);
      hatTop.position.y = 2.4;
      const pom = this.box(0.16, 0.16, 0.16, 0xffffff);
      pom.position.set(0, 2.6, 0);
      g.add(body, head, nose, hat, hatTop, pom);
      parts.head = head;
      for (const px of [-0.15, 0.15]) {
        const leg = this.tbox(0.2, 0.55, 0.2, 'floop_leg', floopLeg);
        leg.position.set(px, 0.28, 0);
        g.add(leg); parts.legs.push(leg);
      }
      for (const px of [-0.38, 0.38]) {
        const arm = this.tbox(0.16, 0.6, 0.16, 'floop_arm', floopArm);
        arm.position.set(px, 1.15, 0);
        g.add(arm); parts.legs.push(arm);
      }
    }
    return { group: g, parts };
  },

  spawn(type, x, y, z, gunId, color) {
    if (type === 'floop') {
      const existing = this.liveFloops()[0];
      if (existing) return existing;
    }
    if ((type === 'jelly' || type === 'big_jelly') && !color) color = JELLY_COLORS[(Math.random() * JELLY_COLORS.length) | 0];
    const { group, parts } = this.buildModel(type, gunId, color);
    group.position.set(x, y, z);
    this.scene.add(group);
    const hps = MOB_MAX_HP;
    const mob = {
      type, group, parts, gunId: gunId || null, color: color || null,
      body: { x, y, z, vx: 0, vy: 0, vz: 0, w: MOB_WIDTHS[type] || 0.35, h: MOB_HEIGHTS[type] || 1.8, onGround: false, hitH: false },
      hp: hps[type] || 10,
      yaw: Math.random() * Math.PI * 2, targetYaw: 0,
      state: 'wander', stateT: 1 + Math.random() * 3,
      wanderDir: null, walkAnim: 0,
      fuse: 0, screeched: false, hopT: 0,
      shootT: 1 + Math.random(), burnT: 0, meleeT: 0, fleeT: 0,
      stuckT: 0, lastSX: x, lastSZ: z, detourT: 0, detourDir: null,
      path: null, pathT: 0, pathGoalKey: '', pathFailT: 0,
      pathUnreachableT: 0, pathRetryT: 0, pathSearchT: 0, pathSearchDir: null,
      kbT: 0, angryAt: null, angryPlayerT: 0,
      flash: 0, speechT: 6 + Math.random() * 16, bubble: null, bubbleT: 0,
      floopHurtVoiceCd: 0, recentFloopHurtLines: [],
      swimT: 0, swimDir: null, attackT: 0,
      lastSrc: null, dead: false,
    };
    group.userData.farBody = mob.body;

    // Keep untinted material colors so night/cave lighting can be applied
    // repeatedly without frogs or other textured parts drifting bright.
    group.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) if (mat.color && !mat.userData.mobBaseCol) mat.userData.mobBaseCol = mat.color.clone();
    });
    mob.targetYaw = mob.yaw;
    if ((type === 'jelly' || type === 'big_jelly') && typeof Jelly !== 'undefined') Jelly.initMob(mob, 'spawned');
    this.list.push(mob);
    return mob;
  },

  dyeSheep(mob, color) {
    if (mob.type !== 'sheep') return false;
    mob.color = color;
    for (const w of mob.parts.wool) {
      const mats = Array.isArray(w.material) ? w.material : [w.material];
      for (const mt of mats) mt.color.setHex(COLOR_HEX[color]);
    }
    Particles.burst(mob.body.x, mob.body.y + 1, mob.body.z, [
      ((COLOR_HEX[color] >> 16) & 255) / 255, ((COLOR_HEX[color] >> 8) & 255) / 255, (COLOR_HEX[color] & 255) / 255,
    ], 10, 2);
    return true;
  },

  pickFloopHurtLine(mob) {
    const recent = Array.isArray(mob.recentFloopHurtLines) ? mob.recentFloopHurtLines : [];
    let pool = FLOOP_LINES_HURT.filter(line => !recent.includes(line));
    if (!pool.length) pool = FLOOP_LINES_HURT.slice();
    const line = pool[(Math.random() * pool.length) | 0];
    mob.recentFloopHurtLines = recent.concat(line).slice(-3);
    return line;
  },

  tryFloopHurtSpeech(mob, src) {
    // Mr Floop only complains when the PLAYER hurts him.
    // Environmental damage, explosions with no player source, and mob friendly-fire stay quiet.
    if (mob.type !== 'floop' || src !== 'player') return;
    mob.floopHurtVoiceCd = mob.floopHurtVoiceCd || 0;
    if (mob.floopHurtVoiceCd > 0) return;
    mob.floopHurtVoiceCd = 1.8 + Math.random() * 0.9;
    mob.speechT = Math.max(mob.speechT || 0, 2.5);
    this.say(mob, this.pickFloopHurtLine(mob));
  },

  say(mob, text, color) {
    const names = { floop: '<Mr Floop> ', humbug: '<Humbug> ', tung: '<???> ' };
    const colors = { floop: '#7CFC00', humbug: '#ff8080', tung: '#d2a24c' };
    UI.chat((names[mob.type] || '<mob> ') + text, color || colors[mob.type] || '#fff');
    const sb = mob.body || { x: 0, y: 0, z: 0 };
    const spos = { x: sb.x, y: sb.y + 1.1, z: sb.z };
    if (mob.type === 'floop') SFX.floop(spos);
    else if (mob.type === 'tung') SFX.tung(spos);
    else SFX.mobHurt(spos);
    if (mob.bubble) { this.scene.remove(mob.bubble); mob.bubble.material.map.dispose(); mob.bubble.material.dispose(); }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d');
    c.font = 'bold 30px Consolas, monospace';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = Math.min(500, c.measureText(text).width + 24);
    c.fillRect(256 - tw / 2, 8, tw, 46);
    c.fillStyle = mob.type === 'floop' ? '#aaffaa' : mob.type === 'tung' ? '#ffd9a0' : '#ffb0b0';
    c.fillText(text, 256, 41, 490);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(4.4, 0.55, 1);
    spr.userData.farBody = mob.body;
    spr.userData.farBodyYOffset = (mob.body && mob.body.h ? mob.body.h : 1.8) + 0.55;
    this.scene.add(spr);
    mob.bubble = spr;
    mob.bubbleT = 3.2;
  },

  mobMaxHp(type) {
    return MOB_MAX_HP[type] || 10;
  },

  repairMobHealth(mob) {
    if (!mob) return 0;
    const maxHp = this.mobMaxHp(mob.type);
    if (!Number.isFinite(+mob.hp)) {
      // NaN/Infinity HP is an immortality bug. Restore the mob to a sane
      // damaged-but-killable value instead of letting <= 0 checks fail forever.
      mob.hp = Math.max(1, Math.ceil(maxHp * 0.5));
    }
    mob.hp = Math.max(-9999, Math.min(+mob.hp, maxHp));
    return mob.hp;
  },

  updateMobBreathingAndSuffocation(mob, dt) {
    if (!mob || !mob.body || typeof Physics === 'undefined') return false;
    const b = mob.body;
    const headOff = Math.max(0.45, (b.h || 1) * 0.82);
    const headWater = Physics.inWater(b, headOff);
    if (headWater) {
      mob.air = Math.max(0, Number.isFinite(+mob.air) ? +mob.air - dt : 10 - dt);
      if (mob.air <= 0) {
        mob.drownT = (mob.drownT || 0) - dt;
        if (mob.drownT <= 0) {
          mob.drownT = 1.0;
          this.hurt(mob, 2, 0, 0, 'drown');
          if (typeof Particles !== 'undefined') Particles.burst(b.x, b.y + headOff, b.z, [0.45, 0.65, 1], 5, 1.2);
        }
      }
    } else {
      mob.air = 10;
      mob.drownT = 0;
    }

    const stuckInSolid = mob.type !== 'sprawler' && Physics.boxHit(
      b.x - (b.w || 0.3) * 0.85, b.y + 0.12, b.z - (b.w || 0.3) * 0.85,
      b.x + (b.w || 0.3) * 0.85, b.y + Math.max(0.45, (b.h || 1) - 0.08), b.z + (b.w || 0.3) * 0.85
    );
    if (stuckInSolid) {
      mob.suffocateT = (mob.suffocateT || 0) - dt;
      if (mob.suffocateT <= 0) {
        mob.suffocateT = 0.5;
        this.hurt(mob, 1, 0, 0, 'suffocate');
      }
    } else {
      mob.suffocateT = 0;
    }
    return !!mob.dead || mob.hp <= 0;
  },

  cleanDamage(dmg) {
    const n = +dmg;
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, 9999);
  },

  // src: 'player' | mob object | undefined
  hurt(mob, dmg, kx, kz, src) {
    if (!mob || mob.dead) return;
    this.repairMobHealth(mob);
    dmg = this.cleanDamage(dmg);
    if (dmg <= 0) return;
    mob.hp -= dmg;
    this.repairMobHealth(mob);
    mob.flash = 0.25;
    mob.lastSrc = src || null;
    mob.lastDamageFire = !!mob._pendingFireDamage || ['fire', 'lava', 'sunlight', 'fireball'].includes(src);
    mob._pendingFireDamage = false;
    // Hitting a daytime spider makes it hold a grudge for 10 minutes.
    // If the player leaves it alone, this counts down and it goes peaceful again.
    if (mob.type === 'spider' && src === 'player') mob.angryPlayerT = 600;
    // mob-on-mob violence starts feuds; neutral sea life also remembers the player/peer that struck it.
    if (src && typeof src === 'object' && src !== mob && !src.dead) mob.angryAt = src;
    const aquaticDef = OCEAN_MOB_DEFS[mob.type];
    if (aquaticDef && aquaticDef.neutral && (src === 'player' || (typeof src === 'string' && src.indexOf('peer:') === 0))) {
      mob.aquaticAggroKey = src; mob.aquaticAggroT = 18;
    }
    // knockback has a cooldown: rapid-fire can't juggle mobs into orbit
    mob.kbCd = mob.kbCd || 0;
    if (mob.kbCd <= 0 && (kx || kz)) {
      mob.kbCd = 0.9;
      mob.kbT = 0.38;
      mob.body.vx = (kx || 0) * 1.15;
      mob.body.vz = (kz || 0) * 1.15;
      mob.body.vy = Math.max(mob.body.vy, 5.2);
    }
    SFX.mobHurt({ x: mob.body.x, y: mob.body.y + mob.body.h * 0.7, z: mob.body.z });
    this.tryFloopHurtSpeech(mob, src);
    if (mob.type === 'jelly' || mob.type === 'big_jelly') {
      mob.fleeT = 0;
      if (src === 'player') { mob.angryPlayerT = mob.type === 'big_jelly' ? 18 : 12; this.panicJellyHouse(mob.jellyHome || mob.fromSpawner, 10, true); }
      else if (src && typeof src === 'object' && src !== mob && !src.dead) { mob.angryAt = src; this.panicJellyHouse(mob.jellyHome || mob.fromSpawner, 10, false); }
      else this.panicJellyHouse(mob.jellyHome || mob.fromSpawner, 10, false);
    } else if (mob.type === 'sheep' || mob.type === 'chicken' || mob.type === 'camel') {
      mob.fleeT = 4;
      if (mob.type === 'sheep') SFX.sheep({ x: mob.body.x, y: mob.body.y + 0.8, z: mob.body.z });
    }
    if (mob.hp <= 0) this.kill(mob);
  },

  fireKilled(mob) {
    return !!(mob && (mob.lastDamageFire || ['fire', 'lava', 'sunlight', 'fireball'].includes(mob.lastSrc)));
  },

  kill(mob) {
    mob.dead = true;
    const b = mob.body;
    Particles.burst(b.x, b.y + 1, b.z, [0.8, 0.2, 0.2], 16, 3);
    if (mob.lastSrc === 'player') Player.addXp(MOB_XP[mob.type] || 0);
    if (OCEAN_MOB_DEFS[mob.type]) {
      const d = OCEAN_MOB_DEFS[mob.type];
      if (d.drop) {
        const dropId = this.fireKilled(mob) && d.drop === I.RAW_FISH ? I.BURNT_FISH : d.drop;
        Drops.spawn(b.x, b.y + 0.35, b.z, dropId, mob.type === 'shark' ? 1 + ((Math.random() * 3) | 0) : mob.type === 'tuna' ? 2 : 1);
      }
      if (mob.type === 'anglerfish' && Math.random() < 0.18) Drops.spawn(b.x, b.y + 0.35, b.z, I.PEARL, 1);
      if (mob.type === 'octopus' && Math.random() < 0.35) Drops.spawn(b.x, b.y + 0.35, b.z, I.INK_SAC, 1);
    } else if (mob.type === 'firefly') {
      Drops.spawn(b.x, b.y + 0.12, b.z, I.JELLY_GLOB_ORANGE, 1);
    } else if (mob.type === 'lavaback') {
      Drops.spawn(b.x, b.y + 0.6, b.z, I.OBSIDIAN, 1 + ((Math.random() * 2) | 0));
      Drops.spawn(b.x, b.y + 0.6, b.z, I.COAL, 1 + ((Math.random() * 3) | 0));
      if (Math.random() < 0.15) Drops.spawn(b.x, b.y + 0.6, b.z, I.FLOOPIUM, 1);
    } else if (mob.type === 'creeper') {
      Drops.spawn(b.x, b.y + 0.5, b.z, I.GUNPOWDER, 1 + ((Math.random() * 2) | 0));
    } else if (mob.type === 'skeleton') {
      Drops.spawn(b.x, b.y + 0.5, b.z, I.BONE, 1 + ((Math.random() * 2) | 0));
      if (Math.random() < 0.4) Drops.spawn(b.x, b.y + 0.5, b.z, I.ARROW, 1 + ((Math.random() * 3) | 0));
    } else if (mob.type === 'sheep') {
      const woolId = mob.color ? WOOL_COLOR_BLOCKS[mob.color] : B.WOOL;
      Drops.spawn(b.x, b.y + 0.5, b.z, woolId, 1 + ((Math.random() * 2) | 0));
      Drops.spawn(b.x, b.y + 0.5, b.z, this.fireKilled(mob) ? I.BURNT_MUTTON : I.RAW_MUTTON, 1 + ((Math.random() * 2) | 0));
    } else if (mob.type === 'chicken') {
      Drops.spawn(b.x, b.y + 0.5, b.z, I.FEATHER, 1 + ((Math.random() * 2) | 0));
      Drops.spawn(b.x, b.y + 0.5, b.z, this.fireKilled(mob) ? I.BURNT_CHICKEN : I.RAW_CHICKEN, 1);
    } else if (mob.type === 'jelly' || mob.type === 'big_jelly') {
      const globId = (typeof JELLY_GLOB_BY_COLOR !== 'undefined' && JELLY_GLOB_BY_COLOR[mob.color]) ? JELLY_GLOB_BY_COLOR[mob.color] : I.JELLY_GLOB_PINK;
      Drops.spawn(b.x, b.y + 0.35, b.z, globId, mob.type === 'big_jelly' ? 5 + ((Math.random() * 2) | 0) : 1);
    } else if (mob.type === 'tung') {
      Drops.spawn(b.x, b.y + 0.5, b.z, B.LOG, 1 + ((Math.random() * 2) | 0));
      if (Math.random() < 0.25) Drops.spawn(b.x, b.y + 0.5, b.z, I.BAT, 1);
      UI.chat('TUNG TUNG TUNG SAHUR falls silent. For now.', '#d2a24c');
    } else if (mob.type === 'humbug') {
      Drops.spawn(b.x, b.y + 0.5, b.z, I.GUNPOWDER, (Math.random() * 3) | 0);
      if (Math.random() < 0.6) Drops.spawn(b.x, b.y + 0.5, b.z, I.LIGHT_AMMO, 1 + ((Math.random() * 4) | 0));
      if (Math.random() < 0.2) Drops.spawn(b.x, b.y + 0.5, b.z, I.DARK_FLOOPIUM, 1);
      if (mob.gunId && Math.random() < 0.12) Drops.spawn(b.x, b.y + 0.5, b.z, mob.gunId, 1);
    } else if (mob.type === 'floop') {
      UI.chat('Mr Floop has left this world. The casino dims its lights. Merry Christmas.', '#ff8080');
      Drops.spawn(b.x, b.y + 0.5, b.z, I.COOKIE, 3);
      Drops.spawn(b.x, b.y + 0.5, b.z, I.BERRY, 2);
    }
  },

  applyExplosion(ex, ey, ez, range, maxDmg, cover, src) {
    const boomBody = { x: ex, y: ey, z: ez };
    for (const m of this.list) {
      if (m.dead) continue;
      const b = m.body;
      const dv = this.farDelta(boomBody, b);
      const dy = dv.y + 0.8;
      const d = Math.sqrt(dv.x * dv.x + dy * dy + dv.z * dv.z);
      if (d < range) {
        const bp = this.farBodyPos(b);
        const mult = cover ? cover(bp.x, bp.y + 0.8, bp.z) : 1;
        const dmg = Math.round(maxDmg * (1 - d / range) * mult);
        if (dmg > 0) this.hurt(m, dmg, dv.x / (d + 0.01) * 8, dv.z / (d + 0.01) * 8, src || null);
      }
    }
  },

  // ---------- arrows (player + mob owned, friendly fire enabled) ----------
  shootArrow(x, y, z, tx, ty, tz, owner, opts) {
    opts = opts || {};
    let ox = 0, oy = 0, oz = 0;
    if (typeof Physics !== 'undefined' && Physics._originFor) {
      const th = Physics.FAR_COORD_THRESHOLD || 1000000000;
      if (Math.abs(x) >= th || Math.abs(y) >= th || Math.abs(z) >= th || Math.abs(tx) >= th || Math.abs(ty) >= th || Math.abs(tz) >= th) {
        ox = Physics._originFor(x); oy = Physics._originFor(y); oz = Physics._originFor(z);
      }
    }
    const dx = (tx - ox) - (x - ox), dy = (ty - oy) - (y - oy), dz = (tz - oz) - (z - oz);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const speed = opts.speed || (owner === 'player' ? 24 : 17);
    const g = opts.fireball
      ? new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb24a }))
      : new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
    g.position.set(x, y, z);
    this.scene.add(g);
    const arrow = {
      x, y, z,
      vx: dx / dist * speed,
      vy: (opts.straight || opts.aimed) ? (dy / dist * speed) : (dy / dist * speed + dist * 0.42),
      vz: dz / dist * speed,
      gravity: (opts.gravity !== undefined) ? opts.gravity : (opts.straight ? 0 : 18),
      w: opts.fireball ? 0.2 : 0.08, h: opts.fireball ? 0.2 : 0.08, mesh: g, life: opts.life || 5, stuck: 0, owner: owner || null,
      fireball: !!opts.fireball, dmg: opts.dmg || 0, burn: opts.burn || 0,
    };
    if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(arrow);
    g.userData.farBody = arrow;
    this.arrows.push(arrow);
    SFX.arrow({ x, y, z });
  },

  updateArrows(dt) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      if (a.life <= 0 || (a.stuck && (a.stuck -= dt) <= 0)) {
        this.scene.remove(a.mesh); a.mesh.geometry.dispose();
        this.arrows.splice(i, 1);
        continue;
      }
      // match voxel lighting like mobs/drops do (arrows used to glow in caves).
      // fireballs are self-lit — skip the tint so they stay glowing in dark caves.
      if (!a.fireball) {
        a._tintT = (a._tintT || 0) - dt;
        if (a._tintT <= 0) {
          a._tintT = 0.20;
          const c = World.getLightColor(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z), undefined, 0.06);
          const mt = a.mesh.material;
          if (mt && mt.color) {
            if (!mt.userData.mobBaseCol) mt.userData.mobBaseCol = mt.color.clone();
            mt.color.copy(mt.userData.mobBaseCol); mt.color.r *= c[0]; mt.color.g *= c[1]; mt.color.b *= c[2];
          }
        }
      }
      if (a.stuck) continue;
      a.vy -= (a.gravity !== undefined ? a.gravity : 18) * dt;
      this.stepFarProjectile(a, dt);
      if (a._farPos) {
        a.mesh.position.set(a._farPos.x, a._farPos.y, a._farPos.z);
        a.mesh.lookAt(a._farPos.x + a.vx, a._farPos.y + a.vy, a._farPos.z + a.vz);
      } else {
        a.mesh.position.set(a.x, a.y, a.z);
        a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
      }
      // fireballs leave a smoking trail as they fly
      if (a.fireball && typeof Particles !== 'undefined' && Math.random() < 0.85) {
        const tp = a._farPos || a;
        Particles.burst(tp.x, tp.y, tp.z, [1, 0.55, 0.14], 2, 1.3);
      }
      let consumed = false;
      // hit the player? (mob projectiles only; creative players are not targets)
      if (a.owner !== 'player' && !Player.dead && Player.gamemode !== 'creative') {
        const p = Player.body;
        const d = this.farDelta(p, a);
        if (d.x > -p.w - 0.1 && d.x < p.w + 0.1 &&
            d.y > 0 && d.y < p.h && d.z > -p.w - 0.1 && d.z < p.w + 0.1) {
          if (a.fireball) { Player.hurt(a.dmg || 5, a.vx * 0.2, a.vz * 0.2, { source: 'fireball', attackerType: (a.owner && a.owner.type) || 'lavaback' }); Player.igniteBurn(a.burn || 5); }
          else Player.hurt(3, a.vx * 0.25, a.vz * 0.25, { source: 'arrow', attackerType: a.owner && a.owner.type || '' });
          consumed = true;
        }
      }
      // hit any mob that isn't the shooter? (friendly fire — feuds ahoy)
      if (!consumed) {
        for (const m of this.list) {
          if (m.dead || m === a.owner) continue;
          if (a.fireball && m.type === 'lavaback') continue; // fire beasts shrug off fireballs
          const b = m.body;
          const d = this.farDelta(b, a);
          if (d.x > -b.w - 0.1 && d.x < b.w + 0.1 &&
              d.y > 0 && d.y < b.h && d.z > -b.w - 0.1 && d.z < b.w + 0.1) {
            if (a.fireball) { m._pendingFireDamage = true; this.hurt(m, a.dmg || 4, a.vx * 0.2, a.vz * 0.2, a.owner === 'player' ? 'player' : a.owner); this.igniteBurn(m, a.burn || 4); }
            else this.hurt(m, 3, a.vx * 0.25, a.vz * 0.25, a.owner === 'player' ? 'player' : a.owner);
            consumed = true;
            break;
          }
        }
      }
      if (consumed || Physics.solidAt(a.x, a.y, a.z)) {
        // fireballs burst on any impact instead of sticking like arrows
        if (a.fireball) {
          if (typeof Particles !== 'undefined') { const tp = a._farPos || a; Particles.burst(tp.x, tp.y, tp.z, [1, 0.55, 0.12], 12, 3.2); }
          this.scene.remove(a.mesh); a.mesh.geometry.dispose();
          this.arrows.splice(i, 1);
        } else if (consumed) {
          this.scene.remove(a.mesh); a.mesh.geometry.dispose();
          this.arrows.splice(i, 1);
        } else {
          a.stuck = 1.2;
          a.x -= a.vx * dt; a.y -= a.vy * dt; a.z -= a.vz * dt;
        }
      }
    }
  },

  // ---------- ray helpers ----------
  rayBox(m, ox, oy, oz, dx, dy, dz, maxDist) {
    const b = m.body;
    let originX = 0, originY = 0, originZ = 0;
    const th = (typeof Physics !== 'undefined' && Physics.FAR_COORD_THRESHOLD) ? Physics.FAR_COORD_THRESHOLD : 1000000000;
    if (typeof Physics !== 'undefined' && Physics._originFor && (Math.abs(ox) >= th || Math.abs(oy) >= th || Math.abs(oz) >= th)) {
      originX = Physics._originFor(ox);
      originY = Physics._originFor(oy);
      originZ = Physics._originFor(oz);
    }
    const st = (typeof Physics !== 'undefined' && Physics.farState) ? Physics.farState(b) : null;
    const bx = st ? (st.ox - originX) + st.x : b.x - originX;
    const by = st ? (st.oy - originY) + st.y : b.y - originY;
    const bz = st ? (st.oz - originZ) + st.z : b.z - originZ;
    const rox = ox - originX, roy = oy - originY, roz = oz - originZ;
    const min = [bx - b.w - 0.1, by, bz - b.w - 0.1];
    const max = [bx + b.w + 0.1, by + b.h, bz + b.w + 0.1];
    const o = [rox, roy, roz], d = [dx, dy, dz];
    let t0 = 0, t1 = maxDist;
    for (let ax = 0; ax < 3; ax++) {
      if (Math.abs(d[ax]) < 1e-8) {
        if (o[ax] < min[ax] || o[ax] > max[ax]) return null;
      } else {
        let ta = (min[ax] - o[ax]) / d[ax], tb = (max[ax] - o[ax]) / d[ax];
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) return null;
      }
    }
    return t0;
  },

  hitTest(ox, oy, oz, dx, dy, dz, maxDist, exclude) {
    let best = null;
    for (const m of this.list) {
      if (m.dead || m === exclude) continue;
      const t = this.rayBox(m, ox, oy, oz, dx, dy, dz, maxDist);
      if (t !== null && (!best || t < best.dist)) best = { mob: m, dist: t };
    }
    return best;
  },

  rayAll(ox, oy, oz, dx, dy, dz, maxDist, exclude) {
    const out = [];
    for (const m of this.list) {
      if (m.dead || m === exclude) continue;
      const t = this.rayBox(m, ox, oy, oz, dx, dy, dz, maxDist);
      if (t !== null) out.push({ mob: m, dist: t });
    }
    return out;
  },

  mobUid(m) {
    if (!m) return '';
    if (!m._uid) m._uid = 'lm' + Math.random().toString(36).slice(2, 10);
    return m.mpId || m._uid;
  },

  makeTargetForMob(o) {
    if (!o || o.dead || !o.body) return null;
    const b = o.body;
    const p = this.farBodyPos(b);
    return { x: p.x, y: p.y, z: p.z, h: b.h, mob: o, isPlayer: false };
  },

  makePlayerTarget() {
    if (typeof Player === 'undefined' || Player.dead || Player.gamemode === 'creative' || !Player.body) return null;
    const p = this.farBodyPos(Player.body);
    return { x: p.x, y: p.y, z: p.z, h: Player.body.h, swim: !!Player.swimming, mob: null, isPlayer: true };
  },

  targetKey(tgt) {
    if (!tgt) return '';
    if (tgt.peerId) return 'peer:' + tgt.peerId;
    if (tgt.isPlayer) return 'player';
    if (tgt.mob) return 'mob:' + this.mobUid(tgt.mob);
    return '';
  },

  // is this remote player still a valid victim? (connected, alive, not creative)
  peerTargetAlive(pid) {
    const p = (typeof Multiplayer !== 'undefined' && Multiplayer.peers) ? Multiplayer.peers.get(pid) : null;
    const s = p && (p.target || p.state);
    return !!(s && !s.dead && !s.inv);
  },

  canSeeTarget(m, tgt) {
    if (!m || !m.body || !tgt) return false;
    if (tgt.peerId && !this.peerTargetAlive(tgt.peerId)) return false;
    if (tgt.isPlayer && !tgt.peerId && (typeof Player === 'undefined' || Player.dead || Player.gamemode === 'creative')) return false;
    if (tgt.mob && (tgt.mob.dead || !tgt.mob.body)) return false;
    if (!tgt.isPlayer && !tgt.mob && !Number.isFinite(tgt.x)) return false;
    if (typeof World === 'undefined' || !World.lineOfSight) return true;
    const b = m.body;
    const bp = this.farBodyPos(b);
    const tp = this.targetWorldPos(tgt);
    const tx = tp.x, tyBase = tp.y, tz = tp.z;
    const th = tp.h || tgt.h || 1;
    // Try eyes first, then chest. A thin tree/leaf/step should not make mobs blind,
    // but solid terrain between caves should block target acquisition.
    const sx = bp.x, sz = bp.z;
    const syEye = bp.y + Math.max(0.35, b.h * 0.82);
    const syChest = bp.y + Math.max(0.25, b.h * 0.55);
    const tyEye = tyBase + Math.max(0.30, th * 0.82);
    const tyChest = tyBase + Math.max(0.20, th * 0.55);
    return !!(World.lineOfSight(sx, syEye, sz, tx, tyEye, tz) || World.lineOfSight(sx, syChest, sz, tx, tyChest, tz));
  },

  rememberTarget(m, tgt) {
    if (!m || !tgt) return;
    const key = this.targetKey(tgt);
    if (!key) return;
    m.targetMemoryKey = key;
    m.targetMemoryT = MOB_TARGET_MEMORY;
    m.targetLastSeen = {
      x: tgt.x, y: tgt.y, z: tgt.z, h: tgt.h || 1,
      isPlayer: !!tgt.isPlayer,
      peerId: tgt.peerId || '',
      mob: tgt.mob || null,
      mobType: tgt.mob ? tgt.mob.type : (tgt.isPlayer ? 'player' : ''),
    };
  },

  forgetTargetMemory(m) {
    if (!m) return;
    m.targetMemoryKey = '';
    m.targetMemoryT = 0;
    m.targetLastSeen = null;
    if (m.path && m.path.length) m.path = null;
    m.pathGoalKey = '';
    m.pathSearchDir = null;
    m.pathUnreachableT = 0;
    m.pathRetryT = 0;
  },

  rememberedTarget(m, maxDist) {
    if (!m || !m.body || !m.targetMemoryKey || !(m.targetMemoryT > 0) || !m.targetLastSeen) return null;
    // memory of a player who has since gone creative/died/left is dropped —
    // mobs used to keep chasing you for 30s after /gamemode creative
    if (m.targetMemoryKey === 'player' && (typeof Player === 'undefined' || Player.dead || Player.gamemode === 'creative')) {
      this.forgetTargetMemory(m); return null;
    }
    if (m.targetMemoryKey.indexOf('peer:') === 0 && !this.peerTargetAlive(m.targetMemoryKey.slice(5))) {
      this.forgetTargetMemory(m); return null;
    }

    // Important: LOS memory is a LAST-SEEN POSITION, not magic wall-hack tracking.
    // The old code returned the live mob/player body for 30 seconds after LOS broke,
    // so idle NPCs would "remember" underground mobs and twitch/pathfind at the
    // current cave position through solid terrain.  Now they walk to the last spot
    // they actually saw, then forget unless they regain LOS.
    const last = m.targetLastSeen;
    const tx = +last.x, ty = +last.y, tz = +last.z;
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(tz)) { this.forgetTargetMemory(m); return null; }

    const d2 = (tx - m.body.x) ** 2 + (tz - m.body.z) ** 2 + ((ty - m.body.y) ** 2) * 0.25;
    const lim = maxDist || MOB_TARGET_FORGET_DIST;
    if (d2 > lim * lim) { this.forgetTargetMemory(m); return null; }

    // Once the mob reaches the last-known spot, stop burning pathing/turning on it.
    if (d2 < 0.85 * 0.85) { this.forgetTargetMemory(m); return null; }

    return {
      x: tx, y: ty, z: tz, h: last.h || 1,
      isPlayer: false, mob: null,
      memoryOnly: true,
      memoryKey: m.targetMemoryKey,
      memoryMobType: last.mobType || '',
    };
  },

  visibleOrRememberedTarget(m, tgt, maxDist) {
    if (!m || !tgt) return null;
    if (this.canSeeTarget(m, tgt)) { this.rememberTarget(m, tgt); return tgt; }
    const key = this.targetKey(tgt);
    if (key && m.targetMemoryKey === key) return this.rememberedTarget(m, maxDist);
    return null;
  },


  sprawlerTargetIsUnbreakablySealed(tgt) {
    if (!tgt || !tgt.isPlayer) return false;
    const p = this.targetWorldPos(tgt), h = Math.max(1, p.h || tgt.h || 1.8), w = 0.32;
    const x0 = Math.floor(p.x - w), x1 = Math.floor(p.x + w);
    const y0 = Math.floor(p.y + 0.05), y1 = Math.floor(p.y + h - 0.05);
    const z0 = Math.floor(p.z - w), z1 = Math.floor(p.z + w);
    const hardWall = (x, y, z) => { const d = Reg[World.getBlock(x, y, z)]; return !!d && d.hard === Infinity; };
    for (let x = x0 - 1; x <= x1 + 1; x++) for (let y = y0 - 1; y <= y1 + 1; y++) for (let z = z0 - 1; z <= z1 + 1; z++) {
      if (x > x0 - 1 && x < x1 + 1 && y > y0 - 1 && y < y1 + 1 && z > z0 - 1 && z < z1 + 1) continue;
      if (!hardWall(x, y, z)) return false;
    }
    return true;
  },

  sprawlerTarget(m) {
    // Retaliation wins immediately. This keeps a Jelly Person from beating on the
    // Sprawler while it tunnel-visions a player.
    if (m.angryAt) {
      if (m.angryAt.dead || !m.angryAt.body) m.angryAt = null;
      else {
        const tgt = this.makeTargetForMob(m.angryAt);
        const d = this.deltaToTarget(m.body, tgt);
        if (Math.abs(d.x) <= 30 && Math.abs(d.y) <= 30 && Math.abs(d.z) <= 30) {
          this.rememberTarget(m, tgt);
          return tgt;
        }
        m.angryAt = null;
      }
    }

    let best = null, bestD2 = Infinity;
    const myY = this.farBodyPos(m.body).y;
    const consider = (tgt, canScent) => {
      if (!tgt) return;
      if (this.sprawlerTargetIsUnbreakablySealed(tgt)) {
        if (m.targetMemoryKey === this.targetKey(tgt)) this.forgetTargetMemory(m);
        return;
      }
      const d = this.deltaToTarget(m.body, tgt);
      if (Math.abs(d.x) > 30 || Math.abs(d.y) > 30 || Math.abs(d.z) > 30) return;
      const visible = this.canSeeTarget(m, tgt);
      if (!visible && !canScent) return;
      // Height only limits through-block scent tracking. Visible targets are chased
      // normally at any height, including Jelly People and players on ledges.
      if (canScent && !visible && tgt.y > myY + 0.05) return;
      const d2 = d.x * d.x + d.y * d.y + d.z * d.z;
      if (d2 < bestD2) { bestD2 = d2; best = tgt; }
    };

    for (const tgt of [this.makePlayerTarget(), ...this.makePeerTargets()]) consider(tgt, true);
    for (const o of this.list) {
      if (!o || o.dead || o === m || !JELLY_MOB_TYPES.includes(o.type)) continue;
      consider(this.makeTargetForMob(o), false);
    }
    if (best) this.rememberTarget(m, best);
    return best;
  },

  sprawlerBreakToward(m, tgt, dt) {
    if (!tgt || !m || !m.body) return;
    m.breakT = (m.breakT || 0) - dt;
    if (m.breakT > 0) return;
    m.breakT = 0.18;
    const b = m.body, d = this.deltaToTarget(b, tgt), down = d.y < -0.65, up = d.y > 0.9;
    const sx = Math.abs(d.x) > 0.3 ? Math.sign(d.x) : 0, sz = Math.abs(d.z) > 0.3 ? Math.sign(d.z) : 0;
    const pad = 0.04, nx = b.x + sx, nz = b.z + sz;
    const minX = Math.min(Math.floor(b.x - b.w - pad), Math.floor(nx - b.w - pad));
    const maxX = Math.max(Math.floor(b.x + b.w + pad), Math.floor(nx + b.w + pad));
    const minZ = Math.min(Math.floor(b.z - b.w - pad), Math.floor(nz - b.w - pad));
    const maxZ = Math.max(Math.floor(b.z + b.w + pad), Math.floor(nz + b.w + pad));
    const by = Math.floor(b.y), top = by + Math.ceil(b.h) - 1, cells = new Set();
    const addLayer = (y, x0, x1, z0, z1) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) cells.add(x + ',' + y + ',' + z); };
    const fx0 = Math.floor(b.x - b.w - pad), fx1 = Math.floor(b.x + b.w + pad);
    const fz0 = Math.floor(b.z - b.w - pad), fz1 = Math.floor(b.z + b.w + pad);

    // Clear the full footprint below for a clean descent (no snagging corner).
    if (down) { addLayer(by - 1, fx0, fx1, fz0, fz1); addLayer(by - 2, fx0, fx1, fz0, fz1); }
    // ALWAYS carve the forward corridor (current+next footprint union) across the
    // whole body height plus one headroom row. This is what kills the diagonal
    // inside-corner snag and lets the wide body actually enter the hole it dug.
    for (let y = down ? by - 1 : by; y <= top + 1; y++) addLayer(y, minX, maxX, minZ, maxZ);
    // Climbing toward a target above: open a shaft over the footprint too.
    if (up) { addLayer(top + 2, fx0, fx1, fz0, fz1); }

    let burst = 0, sumX = 0, sumY = 0, sumZ = 0;
    for (const key of cells) {
      const [x, y, z] = key.split(',').map(Number), id = World.getBlock(x, y, z), def = Reg[id];
      if (id === B.AIR || isFluid(id) || !def || def.hard === Infinity) continue;
      World.setBlock(x, y, z, B.AIR, { noUpdate: true, skipLight: true });
      sumX += x + 0.5; sumY += y + 0.5; sumZ += z + 0.5;
      if (burst++ < 10 && typeof Particles !== 'undefined') Particles.blockBurst(x, y, z, id);
    }
    if (burst) {
      if (down) { b.onGround = false; b.vy = Math.min(b.vy, -3.5); }
      if (up && b.onGround) this.mobJump(m); // hop into the freshly cut shaft
      if (typeof SFX !== 'undefined' && SFX.breakBlk) SFX.breakBlk({ x: sumX / burst, y: sumY / burst, z: sumZ / burst });
    }
  },

  sprawlerClearFailedStep(m, dir) {
    if (!m || !m.body || !dir) return false;
    const len = Math.hypot(dir[0], dir[1]);
    if (len < 0.01) return false;
    const b = m.body, ux = dir[0] / len, uz = dir[1] / len;
    const dcx = Math.round(ux), dcz = Math.round(uz), dirKey = dcx + ',' + dcz;
    if (m.stepClearDir !== dirKey) { m.stepClearDir = dirKey; m.stepClearPhase = 0; }
    const by = Math.floor(b.y), topY = Math.floor(b.y + b.h + 0.01);
    const cx = Math.floor(b.x), cz = Math.floor(b.z);
    const fx = Math.floor(b.x + ux * (b.w + 0.65)), fz = Math.floor(b.z + uz * (b.w + 0.65));
    const solid = (x, y, z) => { const id = World.getBlock(x, y, z); return id !== B.AIR && !isFluid(id); };
    let lowBlocked = false, headBlocked = false;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) lowBlocked = lowBlocked || solid(fx + dx, by, fz + dz);
    for (let dx = -2; dx <= 1; dx++) for (let dz = -2; dz <= 1; dz++) headBlocked = headBlocked || solid(cx + dx, topY, cz + dz) || solid(fx + dx, topY, fz + dz);
    if (!lowBlocked || (!headBlocked && !m.stepClearPhase)) { m.stepClearPhase = 0; return false; }

    const cells = [];
    if (!m.stepClearPhase && headBlocked) {
      for (let dx = -2; dx <= 1; dx++) for (let dz = -2; dz <= 1; dz++) cells.push([cx + dx, topY, cz + dz]);
      m.stepClearPhase = 1;
    } else {
      for (let y = by; y <= by + Math.ceil(b.h); y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) cells.push([fx + dx, y, fz + dz]);
      m.stepClearPhase = 2;
    }

    let broken = 0, sx = 0, sy = 0, sz = 0;
    for (const [x, y, z] of cells) {
      const id = World.getBlock(x, y, z), def = Reg[id];
      if (id === B.AIR || isFluid(id) || !def || def.hard === Infinity) continue;
      if (typeof isDoor === 'function' && isDoor(id) && World.destroyMultiblockAt(x, y, z, { particles: true, kind: 'door' })) {
        broken++; sx += x + 0.5; sy += y + 0.5; sz += z + 0.5;
      } else {
        World.setBlock(x, y, z, B.AIR);
        if (typeof Particles !== 'undefined') Particles.blockBurst(x, y, z, id);
        broken++; sx += x + 0.5; sy += y + 0.5; sz += z + 0.5;
      }
    }
    if (broken && typeof SFX !== 'undefined' && SFX.breakBlk) SFX.breakBlk({ x: sx / broken, y: sy / broken, z: sz / broken });
    // If the ceiling was already unbreakable or empty, skip straight to the
    // forward-carving fallback on the next stuck check instead of jump-looping.
    if (!broken && m.stepClearPhase === 1) { m.stepClearPhase = 2; return true; }
    if (!broken && m.stepClearPhase === 2) { m.stepClearPhase = 0; return false; }
    return broken > 0;
  },

  sprawlerBreaksOnContact(id) {
    const def = Reg[id], name = (def && def.name) || '';
    return id === B.CACTUS || /Leaves$/.test(name) || /Glass/.test(name) || (typeof isDoor === 'function' && isDoor(id));
  },

  sprawlerBreakFragileAhead(m, dir, dt) {
    if (!m || !m.body || !dir) return;
    m.fragileBreakT = (m.fragileBreakT || 0) - dt;
    if (m.fragileBreakT > 0) return;
    const len = Math.hypot(dir[0], dir[1]);
    if (len < 0.01) return;
    m.fragileBreakT = 0.12;

    const b = m.body, ux = dir[0] / len, uz = dir[1] / len, step = 0.85, pad = 0.03;
    const nx = b.x + ux * step, nz = b.z + uz * step;
    const minX = Math.min(Math.floor(b.x - b.w - pad), Math.floor(nx - b.w - pad));
    const maxX = Math.max(Math.floor(b.x + b.w + pad), Math.floor(nx + b.w + pad));
    const minZ = Math.min(Math.floor(b.z - b.w - pad), Math.floor(nz - b.w - pad));
    const maxZ = Math.max(Math.floor(b.z + b.w + pad), Math.floor(nz + b.w + pad));
    const minY = Math.floor(b.y), maxY = Math.floor(b.y + b.h - 0.02);
    let broken = 0, sx = 0, sy = 0, sz = 0;

    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const id = World.getBlock(x, y, z);
      if (!this.sprawlerBreaksOnContact(id)) continue;
      if (typeof isDoor === 'function' && isDoor(id) && World.destroyMultiblockAt(x, y, z, { particles: true, kind: 'door' })) {
        broken++; sx += x + 0.5; sy += y + 0.5; sz += z + 0.5;
        continue;
      }
      World.setBlock(x, y, z, B.AIR);
      if (typeof Particles !== 'undefined') Particles.blockBurst(x, y, z, id);
      broken++; sx += x + 0.5; sy += y + 0.5; sz += z + 0.5;
    }
    if (broken && typeof SFX !== 'undefined' && SFX.breakBlk) SFX.breakBlk({ x: sx / broken, y: sy / broken, z: sz / broken });
  },

  sprawlerClearBrushAround(m, dt) {
    if (!m || !m.body) return;
    m.brushBreakT = (m.brushBreakT || 0) - dt;
    if (m.brushBreakT > 0) return;
    m.brushBreakT = 0.075;
    const b = m.body, cx = Math.floor(b.x), cz = Math.floor(b.z), y0 = Math.floor(b.y), y1 = Math.floor(b.y + b.h);
    let broken = 0, sx = 0, sy = 0, sz = 0;
    for (let dx = -2; dx <= 1; dx++) for (let dz = -2; dz <= 1; dz++) for (let y = y0; y <= y1; y++) {
      const x = cx + dx, z = cz + dz, id = World.getBlock(x, y, z), name = (Reg[id] && Reg[id].name) || '';
      if (id !== B.CACTUS && !/Leaves$/.test(name)) continue;
      World.setBlock(x, y, z, B.AIR);
      if (typeof Particles !== 'undefined') Particles.blockBurst(x, y, z, id);
      broken++; sx += x + 0.5; sy += y + 0.5; sz += z + 0.5;
    }
    if (broken && typeof SFX !== 'undefined' && SFX.breakBlk) SFX.breakBlk({ x: sx / broken, y: sy / broken, z: sz / broken });
  },

  // current target for a hostile mob: a feud rival, else the nearest natural victim.
  // Hostiles now require line-of-sight to ACQUIRE targets. Once they see someone,
  // they remember for a short time so ducking behind a tree/corner does not instantly
  // reset them, but underground mobs do not get targeted through terrain anymore.
  targetOf(m) {
    if (!m || !m.body) return null;
    if (m.angryAt) {
      if (m.angryAt.dead) m.angryAt = null;
      else {
        const angryTgt = this.makeTargetForMob(m.angryAt);
        const kept = this.visibleOrRememberedTarget(m, angryTgt, 30);
        if (kept) return kept;
        // If a feud target has been hidden too long, stop burning pathfinding on it.
        if (!(m.targetMemoryT > 0)) m.angryAt = null;
      }
    }

    let best = null;
    let bestD2 = Infinity;
    const playerTgt = this.makePlayerTarget();
    if (playerTgt && this.canSeeTarget(m, playerTgt)) {
      const d = this.deltaToTarget(m.body, playerTgt);
      best = playerTgt;
      bestD2 = d.x * d.x + d.z * d.z + (d.y * d.y) * 0.25;
    }
    // remote players are victims too (nearest player wins, host-side AI)
    for (const peerTgt of this.makePeerTargets()) {
      if (!this.canSeeTarget(m, peerTgt)) continue;
      const d = this.deltaToTarget(m.body, peerTgt);
      const d2 = d.x * d.x + d.z * d.z + (d.y * d.y) * 0.25;
      if (d2 < bestD2) { bestD2 = d2; best = peerTgt; }
    }
    for (const o of this.list) {
      if (!o || o.dead || o === m || !JELLY_MOB_TYPES.includes(o.type)) continue;
      const cand = this.makeTargetForMob(o);
      if (!this.canSeeTarget(m, cand)) continue;
      const d = this.farDelta(m.body, o.body);
      const d2 = d.x * d.x + d.z * d.z + (d.y * d.y) * 0.25;
      // Do not make monsters path across half the world for a jelly, but do let
      // them naturally pick nearby Jelly People over a farther player.
      if (d2 < bestD2 && d2 < 28 * 28) {
        bestD2 = d2;
        best = cand;
      }
    }
    if (best) { this.rememberTarget(m, best); return best; }
    return this.rememberedTarget(m, 28);
  },

  dmgTarget(tgt, dmg, kx, kz, src) {
    if (!tgt || tgt.memoryOnly) return;
    const attackerType = src && typeof src === 'object' ? src.type : '';
    if (tgt.peerId) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.damageRemotePlayer) Multiplayer.damageRemotePlayer(tgt.peerId, dmg, kx, kz, attackerType ? ('mob:' + attackerType) : 'mob');
      return;
    }
    if (tgt.isPlayer) Player.hurt(dmg, kx, kz, { source: 'mob', attackerType });
    else if (tgt.mob && !tgt.mob.dead) this.hurt(tgt.mob, dmg, kx, kz, src);
  },

  panicJellyHouse(key, seconds, playerAnger) {
    if (!key || typeof Jelly === 'undefined') return false;
    if (typeof key === 'string' && key.indexOf(',') >= 0) return Jelly.panicHouseByKey(key, seconds, playerAnger);
    const house = Jelly.getHouseById(key);
    return house ? Jelly.panicHouseByKey(house.key, seconds, playerAnger) : false;
  },

  returnJellyHome(mob) {
    return (typeof Jelly !== 'undefined') ? Jelly.enterHouse(mob, 'idle_return') : false;
  },

  adoptNearbyJellyHouse(m, radius = 10) {
    return (typeof Jelly !== 'undefined') ? Jelly.tryAdoptNearest(m, radius) : false;
  },

  jellyTargetOf(m) {
    if (!m || !m.body) return null;
    if (m.angryAt) {
      if (m.angryAt.dead) m.angryAt = null;
      else {
        const angryTgt = this.makeTargetForMob(m.angryAt);
        const kept = this.visibleOrRememberedTarget(m, angryTgt, 18);
        if (kept) return kept;
        if (!(m.targetMemoryT > 0)) m.angryAt = null;
      }
    }
    if (m.angryPlayerT > 0) {
      const playerTgt = this.makePlayerTarget();
      const kept = this.visibleOrRememberedTarget(m, playerTgt, 18);
      if (kept) return kept;
    }
    let best = null, bestD = 12 * 12;
    for (const o of this.list) {
      if (!o || o.dead || o === m || !HOSTILES.includes(o.type)) continue;
      const cand = this.makeTargetForMob(o);
      if (!this.canSeeTarget(m, cand)) continue;
      const d = this.farDelta(m.body, o.body);
      const d2 = d.x * d.x + d.z * d.z + (d.y * d.y) * 0.25;
      if (d2 < bestD) { bestD = d2; best = cand; }
    }
    if (best) { this.rememberTarget(m, best); return best; }
    return this.rememberedTarget(m, 14);
  },

  jellyDangerFrog(m, screechedOnly, radius) {
    if (!m || !m.body) return null;
    const rr = (radius || 7) * (radius || 7);
    let best = null, bestD = rr;
    for (const o of this.list) {
      if (!o || o.dead || o.type !== 'creeper') continue;
      if (screechedOnly && !o.screeched) continue;
      const cand = this.makeTargetForMob(o);
      if (!this.canSeeTarget(m, cand)) continue;
      const ob = o.body;
      const d2 = (ob.x - m.body.x) ** 2 + (ob.z - m.body.z) ** 2 + ((ob.y - m.body.y) ** 2) * 0.2;
      if (d2 < bestD) { bestD = d2; best = o; }
    }
    return best;
  },

  jellyFleeFrom(m, threat, dist) {
    if (!m || !m.body || !threat || !threat.body) return null;
    const b = m.body, tb = threat.body;
    const dx = b.x - tb.x, dz = b.z - tb.z;
    const dl = Math.sqrt(dx * dx + dz * dz) || 1;
    return this.safeMoveDir(m, [dx / dl, dz / dl], dist || 1.65) || [dx / dl, dz / dl];
  },

  updateJellyMerges(dt) {
    this.jellyMergeT = (this.jellyMergeT || 0) - dt;
    if (this.jellyMergeT > 0) return;
    this.jellyMergeT = 0.30;
    const normals = this.list.filter(m => m && !m.dead && m.type === 'jelly' && m.color);
    if (normals.length < 4) return;
    const used = new Set();
    for (const base of normals) {
      if (used.has(base) || base.dead) continue;
      const bb = base.body;
      const color = base.color || 'pink';
      const group = [];
      for (const o of normals) {
        if (used.has(o) || o.dead || o.color !== color) continue;
        const ob = o.body;
        if (Math.abs(ob.x - bb.x) <= 1.5 && Math.abs(ob.z - bb.z) <= 1.5 && Math.abs((ob.y + ob.h * 0.5) - (bb.y + bb.h * 0.5)) <= 1.5) group.push(o);
      }
      if (group.length < 4) continue;
      const chosen = group.slice(0, 4);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const j of chosen) {
        const jb = j.body;
        minX = Math.min(minX, jb.x); maxX = Math.max(maxX, jb.x);
        minY = Math.min(minY, jb.y); maxY = Math.max(maxY, jb.y);
        minZ = Math.min(minZ, jb.z); maxZ = Math.max(maxZ, jb.z);
      }
      if (maxX - minX > 3.05 || maxY - minY > 3.05 || maxZ - minZ > 3.05) continue;

      let sx = 0, sy = 0, sz = 0, angryAt = null, angryPlayerT = 0;
      for (const j of chosen) {
        used.add(j); sx += j.body.x; sy += j.body.y; sz += j.body.z;
        if (!angryAt && j.angryAt && !j.angryAt.dead) angryAt = j.angryAt;
        angryPlayerT = Math.max(angryPlayerT, j.angryPlayerT || 0);
      }
      if (typeof Jelly !== 'undefined') for (const j of chosen) Jelly.makeHomeless(j, 'merged');
      for (const j of chosen) this.despawnSilent(j);
      const big = this.spawn('big_jelly', sx / 4, sy / 4, sz / 4, null, color);
      if (typeof Jelly !== 'undefined') Jelly.onMergeIntoBig(chosen, big);
      big.angryAt = angryAt;
      big.angryPlayerT = angryPlayerT;
      big.meleeT = 0.2;
      big.mergeBornT = 1.0;
      Particles.burst(big.body.x, big.body.y + 1.0, big.body.z, [1, 0.55, 0.9], 28, 4.0);
      UI.chat('Four ' + color + ' Jelly People merged into a Big Jelly Person!', '#ffb8ea');
      return;
    }
  },

  // ---------- basic grounded mob pathfinding ----------
  pathKey(x, y, z) { return x + ',' + y + ',' + z; },
  pathMaxRise(mob) { return mob && mob.type === 'sprawler' ? 3 : 1; },

  pathBodyDims(mob) {
    const b = mob && mob.body ? mob.body : {};
    // Use the real physics hitbox for path tests. Do NOT shrink wide/tall mobs
    // to a generic player-sized probe, or spiders/camels/Floop will try to route
    // through gaps their collision body can never physically enter.
    return {
      w: Math.max(0.12, b.w || 0.35),
      h: Math.max(0.6, b.h || 1.8),
    };
  },

  spawnFits(type, x, y, z) {
    if (typeof Physics === 'undefined' || typeof World === 'undefined') return true;
    if (!World.hasChunk || !World.hasChunk(Math.floor(x), Math.floor(z))) return false;
    const w = MOB_WIDTHS[type] || 0.35;
    const h = MOB_HEIGHTS[type] || 1.8;
    if (type === 'lavaback') {
      const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
      let lavaCells = 0;
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        if (isLava(World.getBlock(cx + ox, cy, cz + oz)) && isLava(World.getBlock(cx + ox, cy - 1, cz + oz))) lavaCells++;
      }
      if (lavaCells < 5) return false;
      return !Physics.boxesIn(x - w, y + 0.15, z - w, x + w, y + h - 0.04, z + w).length;
    }
    // no upper bound: the world is sparse-infinite above H (player skybases)
    if (y < 1) return false;
    if (Physics.boxesIn(x - w, y + 0.04, z - w, x + w, y + h - 0.04, z + w).length) return false;
    const footId = World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    const belowId = World.getBlock(Math.floor(x), Math.floor(y - 0.16), Math.floor(z));
    if ((typeof isWater === 'function') && (isWater(footId) || isWater(belowId))) return true;
    const supportW = Math.max(0.08, Math.min(w * 0.75, 0.48));
    return Physics.boxHit(x - supportW, y - 0.18, z - supportW, x + supportW, y + 0.03, z + supportW);
  },

  pathCanStand(mob, cx, y, cz) {
    if (typeof World === 'undefined' || !World.hasChunk || !World.hasChunk(cx, cz)) return false;
    if (y < 1) return false; // no upper bound: sparse-infinite above H
    const dims = this.pathBodyDims(mob);
    const w = dims.w, h = dims.h;
    const x = cx + 0.5, z = cz + 0.5;

    // Feet/body clearance. Keep a tiny vertical offset so standing exactly on a
    // floor does not count as clipping into that floor. This uses the mob's full
    // width and height, so a 1.1-block-wide spider rejects one-block doorways.
    if (Physics.boxesIn(x - w, y + 0.04, z - w, x + w, y + h - 0.04, z + w).length) return false;

    // No walking straight into hazards on purpose.  Fire/lava/cactus still hurt
    // if a mob is knocked into them, but pathfinding should not choose them.
    const footId = World.getBlock(cx, y, cz);
    const belowId = World.getBlock(cx, y - 1, cz);
    if (this.pathHazardNear(mob, x, y, z)) return false;

    // Grounded mobs need something below them. Water counts because swimming mobs
    // can still move, and this keeps paths usable across ponds instead of failing.
    if ((typeof isWater === 'function') && (isWater(footId) || isWater(belowId))) return true;
    const supportW = Math.max(0.08, Math.min(w * 0.75, 0.48));
    return Physics.boxHit(x - supportW, y - 0.18, z - supportW, x + supportW, y + 0.03, z + supportW);
  },

  pathStandY(mob, cx, baseY, cz, fromY) {
    const startY = Number.isFinite(baseY) ? baseY : Math.floor(mob.body.y);
    const tries = fromY === undefined
      ? [startY, startY + 1, startY - 1, startY - 2, startY + 2, ...(this.pathMaxRise(mob) > 2 ? [startY + 3] : [])]
      : [fromY, fromY + 1, ...(this.pathMaxRise(mob) > 1 ? [fromY + 2, fromY + 3] : []), fromY - 1, fromY - 2];
    const seen = new Set();
    for (const y of tries) {
      if (seen.has(y)) continue;
      seen.add(y);
      if (Math.abs(y - startY) > 3) continue;
      if (this.pathCanStand(mob, cx, y, cz)) return y;
    }
    return null;
  },

  pathGoalReach(mob) {
    // Melee mobs need a path to a cell where their body can actually get close
    // enough to use the attack. Without this, tall/wide mobs accept a "nearest"
    // edge cell, then run back and forth forever when the target is under a low
    // tree/ceiling or behind a gap they physically cannot enter.
    if (!mob) return 3.2;
    if (mob.type === 'tung') return 2.05;
    if (mob.type === 'spider') return 1.95;
    if (mob.type === 'jelly') return 1.1;
    if (mob.type === 'big_jelly') return 1.75;
    if (mob.type === 'creeper') return 3.2;
    if (mob.type === 'humbug' && !mob.gunId) return 1.95;
    if (mob.type === 'floop') return 2.1;
    return 3.4;
  },

  pathGoalClearanceScore(mob, x, y, z) {
    // Prefer goals with extra headroom for tall mobs. A just-barely-valid edge
    // next to a low ceiling is usually what causes Tung-style back-and-forth.
    const dims = this.pathBodyDims(mob);
    const w = dims.w;
    const cx = x + 0.5, cz = z + 0.5;
    let extra = 0;
    for (let step = 0; step < 3; step++) {
      const y0 = y + dims.h + 0.05 + step * 0.5;
      const y1 = y0 + 0.42;
      if (Physics.boxesIn(cx - w, y0, cz - w, cx + w, y1, cz + w).length) break;
      extra += 0.5;
    }
    return extra;
  },

  nearestPathGoal(mob, gx, gy, gz, tgt) {
    let best = null, bestScore = Infinity;
    const reach = this.pathGoalReach(mob);
    const searchR = Math.max(3, Math.ceil(reach + 2));
    const tx = tgt && Number.isFinite(tgt.x) ? tgt.x : gx + 0.5;
    const tz = tgt && Number.isFinite(tgt.z) ? tgt.z : gz + 0.5;
    const ty = tgt && Number.isFinite(tgt.y) ? tgt.y : gy;

    for (let r = 0; r <= searchR; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = gx + dx, z = gz + dz;
        const y = this.pathStandY(mob, x, gy, z);
        if (y === null) continue;

        const cx = x + 0.5, cz = z + 0.5;
        const hdist = Math.sqrt((cx - tx) ** 2 + (cz - tz) ** 2);
        const vdist = Math.abs((y + 0.5) - (ty + 0.5));
        // For melee-style mobs, do not accept a goal that is merely "near-ish"
        // but still outside usable reach. That cell would only make the mob run
        // to the edge of a low obstacle, turn around, and repeat.
        if (hdist > reach || vdist > (mob.type === 'sprawler' ? 3.6 : 2.6)) continue;

        const headBonus = this.pathGoalClearanceScore(mob, x, y, z);
        const score = hdist * hdist + Math.abs(y - gy) * 0.35 - headBonus * 0.22;
        if (score < bestScore) { bestScore = score; best = { x, y, z }; }
      }
      // As soon as a close-enough ring has at least one valid body-sized cell,
      // use the best candidate from that ring instead of picking a farther edge.
      if (best) return best;
    }
    return null;
  },

  pathSegmentClear(mob, fromX, fromY, fromZ, toX, toZ, maxRise, maxDrop) {
    if (!mob) return false;
    const b = mob.body;
    const dx = toX - fromX, dz = toZ - fromZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.min(48, Math.ceil(dist * 4)));
    const dims = this.pathBodyDims(mob);
    const w = dims.w, h = dims.h;
    let lastY = Math.floor(Number.isFinite(fromY) ? fromY : b.y);
    const riseLimit = maxRise === undefined ? this.pathMaxRise(mob) : maxRise;
    const dropLimit = maxDrop === undefined ? 1 : maxDrop;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = fromX + dx * t, z = fromZ + dz * t;
      const cx = Math.floor(x), cz = Math.floor(z);
      const sy = this.pathStandY(mob, cx, lastY, cz, lastY);
      if (sy === null) return false;
      if (sy > lastY + riseLimit || sy < lastY - dropLimit) return false;
      if (Physics.boxesIn(x - w, sy + 0.04, z - w, x + w, sy + h - 0.04, z + w).length) return false;
      const footId = World.getBlock(cx, sy, cz);
      const belowId = World.getBlock(cx, sy - 1, cz);
      if (this.pathHazardNear(mob, x, sy, z)) return false;
      const inWater = (typeof isWater === 'function') && (isWater(footId) || isWater(belowId));
      if (!inWater && !Physics.boxHit(x - w * 0.75, sy - 0.18, z - w * 0.75, x + w * 0.75, sy + 0.03, z + w * 0.75)) return false;
      lastY = sy;
    }
    return true;
  },

  buildPath(mob, tgt, maxRange) {
    if (!tgt) return null;
    const b = mob.body;
    const sx = Math.floor(b.x), sz = Math.floor(b.z), sy = this.pathStandY(mob, sx, Math.floor(b.y), sz);
    if (sy === null) return null;
    const rawGx = Math.floor(tgt.x), rawGz = Math.floor(tgt.z), rawGy = Math.floor(tgt.y || b.y);
    const goal = this.nearestPathGoal(mob, rawGx, rawGy, rawGz, tgt);
    if (!goal) return null;

    const startKey = this.pathKey(sx, sy, sz);
    const goalKey = this.pathKey(goal.x, goal.y, goal.z);
    if (startKey === goalKey) return [];

    const maxSteps = Math.max(8, Math.min(32, Math.ceil(maxRange || 20) + 8));
    const maxNodes = 320;
    // Octile distance matches 8-way movement, so open-ground paths prefer true
    // diagonals instead of doing square/grid-looking X then Z routes.
    const h = (x, y, z) => {
      const dx = Math.abs(x - goal.x), dz = Math.abs(z - goal.z);
      const mn = Math.min(dx, dz), mx = Math.max(dx, dz);
      return (mx - mn) + 1.414 * mn + Math.abs(y - goal.y) * 1.4;
    };
    const open = [{ x: sx, y: sy, z: sz, g: 0, f: h(sx, sy, sz), key: startKey }];
    const best = new Map([[startKey, 0]]);
    const came = new Map();
    let expanded = 0;

    while (open.length && expanded++ < maxNodes) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur.key === goalKey) {
        const nodes = [];
        let k = cur.key, n = cur;
        while (k !== startKey) {
          nodes.push({ x: n.x + 0.5, y: n.y, z: n.z + 0.5, cellX: n.x, cellY: n.y, cellZ: n.z });
          const prev = came.get(k);
          if (!prev) break;
          k = prev.key; n = prev;
        }
        nodes.reverse();
        // Keep paths short and refreshed, but let smoothing below skip the grid corners.
        return nodes.slice(0, 12);
      }
      if (cur.g > maxSteps) continue;
      const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
        .sort((a, b) => {
          const da = (goal.x - cur.x) * a[0] + (goal.z - cur.z) * a[1];
          const db = (goal.x - cur.x) * b[0] + (goal.z - cur.z) * b[1];
          return db - da;
        });
      for (const d of dirs) {
        const nx = cur.x + d[0], nz = cur.z + d[1], maxRise = this.pathMaxRise(mob);
        if (Math.max(Math.abs(nx - sx), Math.abs(nz - sz)) > maxSteps + 4) continue;
        const ny = this.pathStandY(mob, nx, cur.y, nz, cur.y);
        if (ny === null) continue;
        if (ny > cur.y + maxRise || ny < cur.y - 1) continue;

        // Diagonal moves are allowed, but not through the corner of two blocking cells.
        const diag = d[0] !== 0 && d[1] !== 0;
        if (diag) {
          const yA = this.pathStandY(mob, cur.x + d[0], cur.y, cur.z, cur.y);
          const yB = this.pathStandY(mob, cur.x, cur.y, cur.z + d[1], cur.y);
          if (yA === null || yB === null) continue;
          if (yA > cur.y + maxRise || yB > cur.y + maxRise) continue;
          if (yA < cur.y - 1 || yB < cur.y - 1) continue;
        }

        const nk = this.pathKey(nx, ny, nz);
        const base = diag ? 1.414 : 1;
        const stepCost = base + Math.max(0, ny - cur.y) * 0.85 + Math.max(0, cur.y - ny) * 0.2;
        const ng = cur.g + stepCost;
        if (best.has(nk) && best.get(nk) <= ng) continue;
        best.set(nk, ng);
        const nn = { x: nx, y: ny, z: nz, g: ng, f: ng + h(nx, ny, nz) * 1.001, key: nk };
        came.set(nk, cur);
        open.push(nn);
      }
    }
    return null;
  },

  unreachablePathMove(mob, tgt, dt) {
    // When A* proves there is physically no route to the target, do not let the
    // mob sit there forever in chase mode. It should search/wander for a bit and
    // periodically retry the path instead of freezing at the wall.
    if (!mob || !mob.body) return null;
    const b = mob.body;
    mob.pathSearchT = (mob.pathSearchT || 0) - dt;
    const needNew = !mob.pathSearchDir || mob.pathSearchT <= 0 || !this.safeMoveDir(mob, mob.pathSearchDir, 1.15);
    if (needNew) {
      const dirs = [];
      if (tgt) {
        const pd = this.deltaToTarget(b, tgt);
        const dx = pd.x, dz = pd.z;
        const dl = Math.sqrt(dx * dx + dz * dz) || 1;
        const tx = dx / dl, tz = dz / dl;
        // Search around the blockage first, then try away/nearby random patrols.
        dirs.push([-tz, tx], [tz, -tx], [tx * 0.45 - tz * 0.89, tz * 0.45 + tx * 0.89], [tx * 0.45 + tz * 0.89, tz * 0.45 - tx * 0.89], [-tx, -tz]);
      }
      if (mob.wanderDir) dirs.push(mob.wanderDir);
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        dirs.push([Math.cos(a), Math.sin(a)]);
      }
      mob.pathSearchDir = null;
      for (const d of dirs) {
        const safe = this.safeMoveDir(mob, d, 1.25);
        if (safe) { mob.pathSearchDir = safe; break; }
      }
      mob.pathSearchT = 0.7 + Math.random() * 0.7;
    }
    return mob.pathSearchDir || mob.wanderDir || null;
  },

  pathMove(mob, tgt, dt, maxRange, visible) {
    if (!mob || !tgt) return null;
    const b = mob.body;
    const goalKey = Math.floor(tgt.x) + ',' + Math.floor(tgt.y || b.y) + ',' + Math.floor(tgt.z);
    if (mob.pathRouteGoalKey !== goalKey) { mob.pathRouteGoalKey = goalKey; mob.pathRouteValid = null; }

    mob.pathT = (mob.pathT || 0) - dt;
    mob.pathFailT = Math.max(0, (mob.pathFailT || 0) - dt);
    mob.pathUnreachableT = Math.max(0, (mob.pathUnreachableT || 0) - dt);
    mob.pathRetryT = Math.max(0, (mob.pathRetryT || 0) - dt);
    mob.pathWantsJump = false;
    mob.pathJumpRise = 1;

    // Drop waypoints already reached.
    while (mob.path && mob.path.length) {
      const wp = mob.path[0];
      const wpDelta = this.deltaToPoint(b, wp.x, wp.y, wp.z);
    const dx = wpDelta.x, dz = wpDelta.z;
      if (dx * dx + dz * dz > 0.42 * 0.42) break;
      mob.path.shift();
    }

    const needPath = !mob.path || !mob.path.length || mob.pathGoalKey !== goalKey || mob.pathT <= 0;
    // If the last search failed completely, give up for a short window and do
    // a safe search/wander move. Retry periodically so mobs notice newly opened
    // doors, broken walls, or terrain changes without locking forever.
    const retryBlocked = mob.pathUnreachableT > 0 && mob.pathRetryT > 0 && mob.pathGoalKey === goalKey && (!mob.path || !mob.path.length);
    if (retryBlocked) { mob.pathRouteValid = false; return this.unreachablePathMove(mob, tgt, dt); }

    if (needPath && mob.pathFailT <= 0 && this.pathBudget > 0) {
      this.pathBudget--;
      const path = this.buildPath(mob, tgt, maxRange || 20);
      mob.pathT = 0.55 + Math.random() * 0.30;
      mob.pathGoalKey = goalKey;
      if (path && path.length) {
        mob.path = path;
        mob.pathRouteValid = true;
        mob.pathUnreachableT = 0;
        mob.pathRetryT = 0;
        mob.pathSearchT = 0;
        mob.pathSearchDir = null;
      } else if (path && path.length === 0) {
        // Already in the goal cell. Do not mark it unreachable; let the direct
        // segment code below steer the mob smoothly within the cell.
        mob.path = [];
        mob.pathRouteValid = true;
        mob.pathUnreachableT = 0;
        mob.pathRetryT = 0;
        mob.pathSearchT = 0;
        mob.pathSearchDir = null;
      } else {
        this.markPathUnreachable(mob);
        mob.pathRouteValid = false;
        return this.unreachablePathMove(mob, tgt, dt);
      }
    }

    const directDelta = this.deltaToTarget(b, tgt);
    const directDx = directDelta.x, directDz = directDelta.z;
    const directLen = Math.sqrt(directDx * directDx + directDz * directDz) || 1;
    const direct = [directDx / directLen, directDz / directLen];

    // A straight diagonal chase is allowed only when the pathing safety checks say
    // every sampled cell has room and ground. This is not a blind LOS rush, so mobs
    // should not run off pit edges just because they can see the player.
    if (this.pathSegmentClear(mob, b.x, b.y, b.z, tgt.x, tgt.z, this.pathMaxRise(mob), 1)) {
      mob.pathRouteValid = true;
      mob.pathJumpRise = Math.max(1, Math.min(this.pathMaxRise(mob), Math.floor(tgt.y || b.y) - Math.floor(b.y)));
      mob.pathWantsJump = mob.pathJumpRise > 0 && Math.floor(tgt.y || b.y) > Math.floor(b.y + 0.05);
      mob.detourT = 0;
      mob.detourDir = null;
      return direct;
    }

    if (!mob.path || !mob.path.length) {
      if (mob.pathUnreachableT > 0) { mob.pathRouteValid = false; return this.unreachablePathMove(mob, tgt, dt); }
      return null;
    }

    // Path smoothing: aim for the farthest near waypoint that the body can reach
    // directly instead of perfectly center-lining every grid square.
    let wp = mob.path[0];
    let wi = 0;
    const look = Math.min(mob.path.length - 1, 4);
    for (let i = 1; i <= look; i++) {
      const cand = mob.path[i];
      if (!this.pathSegmentClear(mob, b.x, b.y, b.z, cand.x, cand.z, this.pathMaxRise(mob))) break;
      wp = cand; wi = i;
    }
    if (wi > 0) mob.path.splice(0, wi);

    mob.pathJumpRise = wp.cellY === undefined ? 1 : Math.max(1, Math.min(this.pathMaxRise(mob), wp.cellY - Math.floor(b.y + 0.05)));
    mob.pathWantsJump = wp.cellY !== undefined && wp.cellY > Math.floor(b.y + 0.05);
    const wpDelta = this.deltaToPoint(b, wp.x, wp.y, wp.z);
    const dx = wpDelta.x, dz = wpDelta.z;
    const dl = Math.sqrt(dx * dx + dz * dz) || 1;
    const pathDir = [dx / dl, dz / dl];

    // Follow the path direction without LOS blending. Blending toward the player
    // can pull mobs off the safe route and into holes/walls.
    if (mob.pathGoalKey === goalKey) mob.pathRouteValid = true;
    return pathDir;
  },

  markPathUnreachable(mob, seconds) {
    if (!mob) return;
    mob.pathRouteValid = false;
    mob.path = null;
    mob.pathT = 0;
    mob.pathFailT = 0.45 + Math.random() * 0.25;
    mob.pathUnreachableT = seconds || (2.8 + Math.random() * 2.2);
    mob.pathRetryT = 0.9 + Math.random() * 0.8;
    mob.detourT = 0;
    mob.detourDir = null;
  },

  pathHazardNear(mob, x, y, z) {
    // Survival-instinct probe used by A* and wandering.  Mobs should not
    // intentionally route through lava/fire or scrape cactus sides while idle.
    if (!mob || typeof World === 'undefined' || typeof B === 'undefined') return false;
    const dims = this.pathBodyDims(mob);
    const pad = 0.18;
    const minX = Math.floor(x - dims.w - pad), maxX = Math.floor(x + dims.w + pad);
    const minY = Math.floor(y - 0.08), maxY = Math.floor(y + dims.h - 0.04);
    const minZ = Math.floor(z - dims.w - pad), maxZ = Math.floor(z + dims.w + pad);
    for (let yy = minY; yy <= maxY; yy++) for (let xx = minX; xx <= maxX; xx++) for (let zz = minZ; zz <= maxZ; zz++) {
      const id = World.getBlock(xx, yy, zz);
      if (id === B.FIRE || id === B.CACTUS || ((typeof isLava === 'function') && isLava(id))) return true;
    }
    return false;
  },

  chooseWanderDir(mob) {
    if (!mob || !mob.body) return null;
    // Try several directions and only keep one that the body can actually walk.
    // This prevents idle mobs from deciding their new life goal is a wall/cactus.
    const dirs = [];
    if (mob.wanderDir) dirs.push(mob.wanderDir);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      dirs.push([Math.cos(a), Math.sin(a)]);
    }
    for (const d of dirs) {
      const safe = this.safeMoveDir(mob, d, 1.35);
      if (safe) return safe;
    }
    return null;
  },

  idleExactMoveClear(mob, dir, probeDist) {
    if (!mob || !mob.body || !dir) return null;
    let dx = dir[0] || 0, dz = dir[1] || 0;
    const dl = Math.sqrt(dx * dx + dz * dz);
    if (dl < 0.001) return null;
    dx /= dl; dz /= dl;
    const b = mob.body;
    const dist = probeDist || 0.95;
    return this.pathSegmentClear(mob, b.x, b.y, b.z, b.x + dx * dist, b.z + dz * dist, 1, 1) ? [dx, dz] : null;
  },

  sanitizeIdleMove(mob, dir, dt) {
    if (!mob || !dir || !mob.body) return null;
    if (mob.idlePauseT > 0) return null;

    // If the requested idle direction is actually open, use it exactly.  The
    // previous version ran safeMoveDir() every frame; when a wall/door/crowd was
    // nearby it could return a different rotated fallback each frame, so the mob
    // looked like it was twitching even without any target.
    const exact = this.idleExactMoveClear(mob, dir, 0.95);
    if (exact) {
      mob.idleAvoidT = 0;
      mob.idleAvoidDir = null;
      return exact;
    }

    // Keep one chosen avoidance direction briefly instead of re-rolling left/right
    // every frame. This makes idle wall/crowd avoidance look like a small detour
    // instead of nervous jitter.
    if (mob.idleAvoidT > 0 && mob.idleAvoidDir) {
      const kept = this.idleExactMoveClear(mob, mob.idleAvoidDir, 0.85);
      if (kept) return kept;
    }

    const safe = this.safeMoveDir(mob, dir, 1.10);
    if (safe) {
      mob.idleAvoidDir = safe;
      mob.idleAvoidT = 0.55 + Math.random() * 0.35;
      return safe;
    }

    // No safe idle move right now. Pause briefly so the brain does not instantly
    // pick another bad goal and vibrate in place.
    mob.idleAvoidDir = null;
    mob.idleAvoidT = 0;
    mob.idlePauseT = 0.35 + Math.random() * 0.35;
    mob.wanderDir = null;
    return null;
  },

  safeMoveDir(mob, dir, probeDist) {
    if (!mob || !dir) return null;
    const b = mob.body;
    let dx = dir[0] || 0, dz = dir[1] || 0;
    const dl = Math.sqrt(dx * dx + dz * dz);
    if (dl < 0.001) return null;
    dx /= dl; dz /= dl;
    const dist = probeDist || 1.4;
    const turns = [0, 0.55, -0.55, 1.1, -1.1, Math.PI];
    for (const a of turns) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = dx * ca - dz * sa;
      const rz = dx * sa + dz * ca;
      if (this.pathSegmentClear(mob, b.x, b.y, b.z, b.x + rx * dist, b.z + rz * dist, 1, 1)) return [rx, rz];
    }
    return null;
  },


  jellyHomeAlive(key) {
    if (!key || typeof World === 'undefined' || !World.getBlock) return false;
    if (typeof Jelly !== 'undefined') {
      const house = Jelly.getHouseByKey(key) || Jelly.getHouseById(key);
      return !!(house && Jelly.isHouseBlockAlive(house.key));
    }
    const pos = key.split(',').map(Number);
    return pos.length === 3 && World.getBlock(pos[0], pos[1], pos[2]) === B.JELLY_HOUSE;
  },

  jellyHomeDelta(m) {
    if (!m || !m.body) return null;
    let key = m.jellyHome || '';
    if ((!key || key.indexOf(',') < 0) && typeof Jelly !== 'undefined' && m.homeHouseId) key = Jelly.getHouseKeyById(m.homeHouseId) || '';
    if (!this.jellyHomeAlive(key)) return null;
    const p = key.split(',').map(Number);
    return { x: p[0] + 0.5 - m.body.x, y: p[1] - m.body.y, z: p[2] + 0.5 - m.body.z, hx:p[0], hy:p[1], hz:p[2] };
  },

  chooseJellyIdleGoal(m) {
    if (!m || !m.body || typeof World === 'undefined') return null;
    if (m.idlePauseT > 0) return null;
    const b = m.body;
    let hx = Math.floor(b.x), hy = Math.floor(b.y), hz = Math.floor(b.z);
    if (this.jellyHomeAlive(m.jellyHome)) {
      const p = m.jellyHome.split(',').map(Number);
      hx = p[0]; hy = p[1]; hz = p[2];
    }
    for (let tries = 0; tries < 14; tries++) {
      const r = 1 + ((Math.random() * 4) | 0);
      const ang = Math.random() * Math.PI * 2;
      const cx = hx + Math.round(Math.cos(ang) * r);
      const cz = hz + Math.round(Math.sin(ang) * r);
      const cy = this.pathStandY(m, cx, hy, cz);
      if (cy === null) continue;
      const gx = cx + 0.5, gz = cz + 0.5;
      // Keep idle points physically reachable enough to avoid wall-staring.
      if (!this.pathSegmentClear(m, b.x, b.y, b.z, gx, gz, 1, 1)) {
        const oldBudget = this.pathBudget;
        this.pathBudget = Math.max(this.pathBudget || 0, 1);
        const path = this.buildPath(m, { x: gx, y: cy, z: gz, h: b.h }, 8);
        this.pathBudget = oldBudget;
        if (!path) continue;
      }
      m.jellyIdleGoal = { x: gx, y: cy, z: gz, h: b.h };
      m.jellyIdleT = 3 + Math.random() * 4;
      return m.jellyIdleGoal;
    }
    m.jellyIdleGoal = null;
    m.jellyIdleT = 1 + Math.random() * 2;
    return null;
  },

  jellyIdleMove(m, dt) {
    if (!m || !m.body) return null;
    if (m.idlePauseT > 0) return null;
    const b = m.body;
    m.jellyIdleT = (m.jellyIdleT || 0) - dt;
    let goal = m.jellyIdleGoal;
    if (goal) {
      const dx = goal.x - b.x, dz = goal.z - b.z;
      if (dx * dx + dz * dz < 0.45 * 0.45 || m.jellyIdleT <= 0) goal = null;
    }
    if (!goal) goal = this.chooseJellyIdleGoal(m);
    if (!goal) return null;
    const dir = this.pathMove(m, goal, dt, 8, false);
    if (!dir) {
      m.jellyIdleGoal = null;
      m.idlePauseT = 0.35 + Math.random() * 0.45;
      return null;
    }
    const safe = this.sanitizeIdleMove(m, dir, dt);
    if (!safe) {
      // This idle goal is currently blocked by collision/crowding. Drop it
      // instead of side-stepping forever and flicking back/forth.
      m.jellyIdleGoal = null;
      m.path = null;
      m.pathGoalKey = '';
    }
    return safe || null;
  },


  mobJumpVelocity(mob) {
    // Match the player's jump for ordinary mobs; the Sprawler scales only when
    // pathing or collision proves it must clear a 2- or 3-block ledge.
    if (!mob) return 8.6;
    if (mob.type === 'sprawler') return Math.sqrt(2 * Physics.GRAV * (Math.max(1, Math.min(3, mob.pathJumpRise || 1)) + 0.35));
    if (mob.type === 'chicken') return 8.2;
    if (mob.type === 'creeper') return 8.6;
    if (mob.type === 'camel' || mob.type === 'humbug' || mob.type === 'floop' || mob.type === 'tung') return 8.8;
    return 8.6;
  },

  mobJump(mob, multiplier) {
    if (!mob || !mob.body) return;
    const mul = multiplier || 1;
    mob.body.vy = Math.max(mob.body.vy || 0, this.mobJumpVelocity(mob) * mul);
  },

  mobShouldJump(mob, wantMove) {
    if (!mob || !wantMove) return false;
    const b = mob.body;
    if (!b.onGround || Physics.inWater(b, 0.3)) return false;
    if (mob.pathWantsJump) return true;
    if (!b.hitH) return false;
    const ml = Math.sqrt(wantMove[0] ** 2 + wantMove[1] ** 2) || 1;
    const dx = wantMove[0] / ml, dz = wantMove[1] / ml;
    const ax = b.x + dx * (b.w + 0.28), az = b.z + dz * (b.w + 0.28);
    if (mob.type === 'sprawler') {
      const cx = Math.floor(ax), cz = Math.floor(az), by = Math.floor(b.y + 0.05);
      for (let rise = 1; rise <= 3; rise++) if (this.pathCanStand(mob, cx, by + rise, cz)) { mob.pathJumpRise = rise; return true; }
      return false;
    }
    const w = Math.min(0.32, Math.max(0.16, (b.w || 0.35) * 0.7));
    const lowHit = Physics.boxHit(ax - w, b.y + 0.05, az - w, ax + w, b.y + 1.05, az + w);
    const headClear = !Physics.boxHit(ax - w, b.y + 1.05, az - w, ax + w, b.y + b.h + 0.55, az + w);
    return lowHit && headClear;
  },

  // ---------- per-frame ----------
  bodyClearAt(m, x, z) {
    if (!m || !m.body || typeof Physics === 'undefined') return false;
    const b = m.body;
    return Physics.boxesIn(x - b.w, b.y + 0.05, z - b.w, x + b.w, b.y + b.h - 0.05, z + b.w).length === 0;
  },

  bodyClearAtBody(b, x, z) {
    if (!b || typeof Physics === 'undefined') return false;
    return Physics.boxesIn(x - (b.w || 0.3), b.y + 0.05, z - (b.w || 0.3), x + (b.w || 0.3), b.y + (b.h || 1.8) - 0.05, z + (b.w || 0.3)).length === 0;
  },

  entityClearAt(e, x, z) {
    if (!e) return false;
    if (e.kind === 'mob') return this.bodyClearAt(e.mob, x, z);
    return this.bodyClearAtBody(e.body, x, z);
  },

  separateMobs(dt) {
    // Cheap horizontal crowd separation so swarms don't all occupy one exact point.
    // This now includes the local player and remote player bodies too, so mobs can't
    // stack inside players and players can't stand perfectly inside mobs/each other.
    const ents = [];
    for (const m of this.list) {
      if (m && !m.dead && m.body && World.hasChunk(Math.floor(m.body.x), Math.floor(m.body.z))) {
        ents.push({ kind: 'mob', mob: m, body: m.body, group: m.group, movable: true });
      }
    }
    const localPlayerActive = typeof Player !== 'undefined' && Player.body && !Player.dead && !(typeof Vehicles !== 'undefined' && (Vehicles.driving || Vehicles.boating));
    if (localPlayerActive && World.hasChunk(Math.floor(Player.body.x), Math.floor(Player.body.z))) {
      ents.push({ kind: 'player', body: Player.body, group: null, movable: true, localPlayer: true });
    }
    if (typeof Multiplayer !== 'undefined' && Multiplayer.remoteBodies) {
      const rbs = Multiplayer.remoteBodies();
      for (const rb of rbs) {
        if (!rb || rb.dead || !World.hasChunk(Math.floor(rb.x), Math.floor(rb.z))) continue;
        // Remote players are movement-authoritative on their own machines, so this
        // copy is treated as solid but not shoved around by the local simulation.
        ents.push({ kind: 'remotePlayer', body: rb, group: null, movable: false });
      }
    }

    const maxPairs = 1200;
    let pairs = 0;
    let movedLocalPlayer = false;
    for (let i = 0; i < ents.length; i++) {
      const a = ents[i], ab = a.body;
      for (let j = i + 1; j < ents.length; j++) {
        if (++pairs > maxPairs) break;
        const e2 = ents[j], bb = e2.body;
        const sep = this.farDelta(bb, ab); // ab relative to bb, precision-safe
        if (Math.abs(sep.y + (ab.h || 1.8) * 0.5 - (bb.h || 1.8) * 0.5) > Math.max(ab.h || 1.8, bb.h || 1.8) * 0.65) continue;
        let dx = sep.x, dz = sep.z;
        let d2 = dx * dx + dz * dz;
        const want = Math.max(0.18, (ab.w || 0.3) + (bb.w || 0.3) + 0.04);
        if (d2 >= want * want) continue;
        if (d2 < 0.0004) {
          const ang = ((i * 29 + j * 17) % 360) * Math.PI / 180;
          dx = Math.cos(ang) * 0.03; dz = Math.sin(ang) * 0.03; d2 = dx * dx + dz * dz;
        }
        const d = Math.sqrt(d2);
        const nx = dx / d, nz = dz / d;
        const overlap = want - d;
        const bothMovable = a.movable && e2.movable;
        const pushA = a.movable ? Math.min(0.15, overlap * (bothMovable ? 0.5 : 1.0) + 0.01) : 0;
        const pushB = e2.movable ? Math.min(0.15, overlap * (bothMovable ? 0.5 : 1.0) + 0.01) : 0;
        if (pushA > 0) {
          const ax = ((typeof Physics !== 'undefined' && Physics.bodyWorldX) ? Physics.bodyWorldX(ab) : ab.x) + nx * pushA;
          const az = ((typeof Physics !== 'undefined' && Physics.bodyWorldZ) ? Physics.bodyWorldZ(ab) : ab.z) + nz * pushA;
          if (this.entityClearAt(a, ax, az)) {
            this.nudgeBodyXZ(ab, nx * pushA, nz * pushA);
            ab.vx = (ab.vx || 0) + nx * 0.10; ab.vz = (ab.vz || 0) + nz * 0.10;
            if (a.localPlayer) movedLocalPlayer = true;
          }
        }
        if (pushB > 0) {
          const bx = ((typeof Physics !== 'undefined' && Physics.bodyWorldX) ? Physics.bodyWorldX(bb) : bb.x) - nx * pushB;
          const bz = ((typeof Physics !== 'undefined' && Physics.bodyWorldZ) ? Physics.bodyWorldZ(bb) : bb.z) - nz * pushB;
          if (this.entityClearAt(e2, bx, bz)) {
            this.nudgeBodyXZ(bb, -nx * pushB, -nz * pushB);
            bb.vx = (bb.vx || 0) - nx * 0.10; bb.vz = (bb.vz || 0) - nz * 0.10;
            if (e2.localPlayer) movedLocalPlayer = true;
          }
        }
      }
      if (pairs > maxPairs) break;
    }
    for (const e of ents) {
      if (e.kind === 'mob' && e.group) e.group.position.set(e.body.x, e.body.y, e.body.z);
    }
    if (movedLocalPlayer && typeof Player !== 'undefined' && Player.camera) {
      const driving = typeof Vehicles !== 'undefined' && (Vehicles.driving || Vehicles.boating);
      Player.camera.position.set(Player.body.x, Player.eyeY() + (driving ? 0.15 : 0), Player.body.z);
    }
  },

  waterSpot(p, minR, maxR) {
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
      const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
      if (!World.hasChunk(x, z)) continue;
      const floor = World.heightAt(x, z), depth = World.SEA - floor;
      if (depth < 3) continue;
      const y = floor + 1.2 + Math.random() * Math.max(0.2, depth - 2.2);
      if (isWaterCell(World.getBlock(x, Math.floor(y + 0.2), z))) return { x: x + 0.5, y, z: z + 0.5, depth, biome: World.biomeAt(x, z) };
    }
    return null;
  },

  // Find an underground or surface lava-pool top near the player. Do not stop at
  // cave ceilings: the old early exit made every pool below solid rock invisible.
  lavaSpot(p, minR, maxR) {
    const top = World.H - 3, bottom = 2;
    for (let tries = 0; tries < 24; tries++) {
      const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
      const x = Math.floor(p.x + Math.cos(a) * r), z = Math.floor(p.z + Math.sin(a) * r);
      if (!World.hasChunk(x, z)) continue;
      for (let y = top; y >= bottom; y--) {
        if (!isLava(World.getBlock(x, y, z))) continue;
        // Only the top lava cell of a pool can host the creature.
        if (isLava(World.getBlock(x, y + 1, z))) continue;
        if (World.getBlock(x, y + 1, z) !== B.AIR || World.getBlock(x, y + 2, z) !== B.AIR || !isLava(World.getBlock(x, y - 1, z))) continue;
        let lavaCells = 0, clearCells = 0;
        for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
          if (isLava(World.getBlock(x + ox, y, z + oz)) && isLava(World.getBlock(x + ox, y - 1, z + oz))) lavaCells++;
          if (World.getBlock(x + ox, y + 1, z + oz) === B.AIR && World.getBlock(x + ox, y + 2, z + oz) === B.AIR) clearCells++;
        }
        if (lavaCells >= 5 && clearCells >= 5) return { x: x + 0.5, y: y + 0.1, z: z + 0.5 };
      }
    }
    return null;
  },

  oceanType(depth, biome) {
    const r = Math.random(), ocean = biome === 'ocean' || biome === 'deep_ocean';
    if (ocean && Game.isNight) {
      if (depth > 14 && r < 0.08) return 'giant_squid';
      if (depth > 11 && r < 0.17) return 'sea_serpent';
      if (depth > 7 && r < 0.31) return 'shark';
      if (depth > 4 && r < 0.42) return 'barracuda';
    }
    if (ocean && depth > 11 && r < 0.09) return 'anglerfish';
    if (ocean && depth > 8 && r < 0.14) return 'shark';
    if (r < 0.25) return 'minnow';
    if (r < 0.38) return 'salmon';
    if (r < 0.48) return 'tuna';
    if (r < 0.58) return 'clownfish';
    if (r < 0.66) return 'pufferfish';
    if (r < 0.74) return 'jellyfish';
    if (r < 0.82) return 'stingray';
    if (r < 0.90) return 'octopus';
    if (r < 0.96) return 'dolphin';
    return 'seahorse';
  },

  aquaticTargetPoint(tgt) {
    const p = this.targetWorldPos(tgt), h = p.h || 1.8;
    const x = Math.floor(p.x), z = Math.floor(p.z);
    // Chase swimmers and players hovering at the surface by aiming at the nearest
    // water cell beneath their body. Stop only after their feet are supported by land.
    for (const yy of [Math.floor(p.y + h * 0.45), Math.floor(p.y + 0.05), Math.floor(p.y - 0.15), Math.floor(p.y - 1.05)]) {
      const id = World.getBlock(x, yy, z);
      if (World.isWaterAt(x, yy, z, id)) return { x: p.x, y: yy + Math.min(0.72, World.waterLevelAt(x, yy, z, id) / 9 - 0.08), z: p.z };
    }
    return null;
  },

  // ---------- fire / burning ----------
  // shared additive flame billboard texture (yellow core -> orange -> transparent)
  flameMaterial() {
    if (!this._flameTex) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 32;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(16, 20, 1, 16, 17, 15);
      g.addColorStop(0, 'rgba(255,244,170,1)');
      g.addColorStop(0.4, 'rgba(255,150,32,0.92)');
      g.addColorStop(0.78, 'rgba(224,64,0,0.34)');
      g.addColorStop(1, 'rgba(200,40,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(16, 17, 12, 16, 0, 0, Math.PI * 2); c.fill();
      this._flameTex = new THREE.CanvasTexture(cv);
    }
    return new THREE.SpriteMaterial({ map: this._flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  },

  // set a mob on fire for `secs` (engulfing flames + burn damage). Lava-native mobs are immune.
  igniteBurn(m, secs) {
    if (!m || m.dead || m.type === 'lavaback') return;
    if (typeof Physics !== 'undefined' && Physics.inWater(m.body, 0.3)) return;
    m.fireT = Math.max(m.fireT || 0, secs || 0);
  },

  showMobFlames(m, dt) {
    if (!m.flames) {
      const b = m.body, n = b.h > 1.4 ? 5 : 3, base = 0.55 + b.w * 1.7;
      m.flames = [];
      for (let i = 0; i < n; i++) {
        const s = new THREE.Sprite(this.flameMaterial());
        s.userData = {
          base: base * (0.7 + Math.random() * 0.6), phase: Math.random() * Math.PI * 2,
          ox: (Math.random() - 0.5) * b.w * 2.2, oz: (Math.random() - 0.5) * b.w * 2.2,
          oy: 0.15 + Math.random() * Math.max(0.5, b.h * 0.9),
        };
        m.group.add(s); m.flames.push(s);
      }
    }
    m.flameAnim = (m.flameAnim || 0) + dt * 13;
    for (const s of m.flames) {
      const u = s.userData, flick = 0.72 + Math.sin(m.flameAnim + u.phase) * 0.28;
      s.scale.set(u.base * flick, u.base * (1.25 + Math.sin(m.flameAnim * 1.3 + u.phase) * 0.3), 1);
      s.position.set(u.ox, u.oy + Math.sin(m.flameAnim * 0.7 + u.phase) * 0.12, u.oz);
    }
  },

  clearMobFlames(m) {
    if (!m.flames) return;
    for (const s of m.flames) { if (s.parent) s.parent.remove(s); if (s.material) s.material.dispose(); }
    m.flames = null;
  },

  updateMobFire(m, dt) {
    if (m.fireT > 0 && typeof Physics !== 'undefined' && Physics.inWater(m.body, 0.3)) m.fireT = 0;
    const burning = m.fireT > 0, visual = burning || !!m.sunFireVisual || !!m.mpFireVisual;
    if (burning) {
      m.fireT -= dt;
      m.fireDmgT = (m.fireDmgT || 0) - dt;
      if (m.fireDmgT <= 0) { m.fireDmgT = 0.6; this.hurt(m, 1, 0, 0, 'fire'); if (m.hp <= 0) return; }
      if (typeof Particles !== 'undefined' && Math.random() < 0.25) { const b = m.body; Particles.burst(b.x, b.y + b.h * 0.6, b.z, [0.25, 0.25, 0.27], 2, 1.4); }
    }
    if (visual) this.showMobFlames(m, dt);
    else if (m.flames) this.clearMobFlames(m);
  },

  // ---------- lavaback: Lapras-shaped lava beast ----------
  updateLavaMonster(m, dt) {
    const b = m.body, cy = b.y + b.h * 0.5;
    const bx = Math.floor(b.x), bz = Math.floor(b.z);
    const lavaAt = (yy) => isLava(World.getBlock(bx, yy, bz));
    const inLava = (typeof Physics !== 'undefined' && Physics.inLava(b, 0.3)) || lavaAt(Math.floor(b.y + 0.3)) || lavaAt(Math.floor(cy));
    const inWater = typeof Physics !== 'undefined' && Physics.inWater(b, 0.3);

    // hazards: water is lethal to a lava beast; sitting beached on land slowly kills it
    if (inWater) {
      if (typeof Particles !== 'undefined') Particles.burst(b.x, cy, b.z, [0.78, 0.8, 0.86], 8, 2.6);
      m.douseT = (m.douseT || 0) - dt;
      if (m.douseT <= 0) { m.douseT = 0.4; this.hurt(m, LAVABACK_DEF.waterDps * 0.4, 0, 0, 'water'); if (m.hp <= 0) { this.kill(m); return; } }
      m.beachT = 0;
    } else if (!inLava) {
      m.beachT = (m.beachT || 0) + dt;
      if (m.beachT > LAVABACK_DEF.beachSecs) {
        m.beachDmgT = (m.beachDmgT || 0) - dt;
        if (m.beachDmgT <= 0) { m.beachDmgT = 1.2; this.hurt(m, 3, 0, 0, 'beach'); if (typeof Particles !== 'undefined') Particles.burst(b.x, b.y + 1, b.z, [0.3, 0.3, 0.32], 6, 1.8); if (m.hp <= 0) { this.kill(m); return; } }
      }
    } else { m.beachT = 0; m.douseT = 0; }

    // nearest player/peer (creative players return null, so they aren't targeted)
    let tgt = null, tdist = 1e9, tp = null;
    for (const cand of [this.makePlayerTarget(), ...this.makePeerTargets()]) {
      if (!cand) continue;
      const wp = this.targetWorldPos(cand);
      const dd = Math.hypot(wp.x - b.x, wp.z - b.z);
      if (dd < tdist) { tdist = dd; tgt = cand; tp = wp; }
    }
    const engaged = !!(tgt && tdist < LAVABACK_DEF.sight);

    // topmost lava cell in this column = the pool surface
    let surfaceY = null;
    for (let yy = Math.floor(b.y) + 4; yy > Math.floor(b.y) - 3; yy--) { if (lavaAt(yy)) { surfaceY = yy + 1; break; } }

    m.diveT = (m.diveT || 0) - dt;
    if (engaged && m.diveT <= 0) m.surfaced = true;
    if (m.surfaced && engaged && Math.random() < 0.004) { m.surfaced = false; m.diveT = 2 + Math.random() * 3; } // occasionally dive to hide
    if (!engaged) m.surfaced = false;

    if (inLava) {
      let desiredY = b.y;
      if (surfaceY !== null) desiredY = m.surfaced ? surfaceY - 0.35 : surfaceY - b.h - 0.1;
      b.vy += (Math.max(-2.2, Math.min(2.6, (desiredY - b.y) * 3)) - b.vy) * Math.min(1, dt * 5);
      const wander = (vx, vz) => {
        b.vx += (vx - b.vx) * Math.min(1, dt * 2.5); b.vz += (vz - b.vz) * Math.min(1, dt * 2.5);
        const ax = Math.floor(b.x + Math.sign(b.vx) * 1.1), az = Math.floor(b.z + Math.sign(b.vz) * 1.1);
        if (!isLava(World.getBlock(ax, Math.floor(cy), az))) { b.vx *= -0.4; b.vz *= -0.4; } // stay in the pool, don't beach
      };
      if (engaged && tp) {
        const dx = tp.x - b.x, dz = tp.z - b.z, dl = Math.hypot(dx, dz) || 1;
        // Ranged mob spacing: approach only when too far away, retreat whenever
        // the player closes inside five blocks, and hold position in the firing band.
        if (dl < LAVABACK_DEF.keepAway) wander(-dx / dl * LAVABACK_DEF.speed, -dz / dl * LAVABACK_DEF.speed);
        else if (dl > LAVABACK_DEF.keepAway + 2) wander(dx / dl * LAVABACK_DEF.speed * (m.surfaced ? 0.55 : 0.9), dz / dl * LAVABACK_DEF.speed * (m.surfaced ? 0.55 : 0.9));
        else wander(0, 0);
      } else {
        m.swimT = (m.swimT || 0) - dt;
        if (m.swimT <= 0 || !m.swimDir) { const a = Math.random() * Math.PI * 2; m.swimDir = [Math.cos(a), Math.sin(a)]; m.swimT = 2 + Math.random() * 3; }
        wander(m.swimDir[0] * LAVABACK_DEF.speed * 0.5, m.swimDir[1] * LAVABACK_DEF.speed * 0.5);
      }
      Physics.move(b, dt, { stepUp: false });
    } else {
      b.vy = Math.max(-20, b.vy - Physics.GRAV * dt); b.vx *= 0.9; b.vz *= 0.9;
      Physics.move(b, dt, { stepUp: false });
    }

    // Face the direction it is actually swimming. When nearly stationary at its
    // preferred firing range, face the target instead.
    const swimSpeed = Math.hypot(b.vx, b.vz);
    const faceYaw = swimSpeed > 0.12 ? Math.atan2(b.vx, b.vz) : (tp ? Math.atan2(tp.x - b.x, tp.z - b.z) : m.yaw);
    m.yaw += wrapAngle(faceYaw - m.yaw) * Math.min(1, 6 * dt);

    m.meleeT = Math.max(0, (m.meleeT || 0) - dt);
    if (engaged && tgt && tp && tdist <= LAVABACK_DEF.meleeRange && Math.abs((tp.y || b.y) - b.y) < 2.4 && m.meleeT <= 0) {
      const dx = tp.x - b.x, dz = tp.z - b.z, dl = Math.hypot(dx, dz) || 1;
      m.meleeT = 0.9;
      this.dmgTarget(tgt, LAVABACK_DEF.meleeDmg, dx / dl * 7, dz / dl * 7, m);
    }

    m.shootCd = (m.shootCd === undefined ? LAVABACK_DEF.cooldown : m.shootCd) - dt;
    const mouthY = b.y + b.h * 0.92;
    const fullySurfaced = !!(m.surfaced && surfaceY !== null && b.y >= surfaceY - 0.52 && !isLava(World.getBlock(Math.floor(b.x), Math.floor(mouthY), Math.floor(b.z))));
    if (engaged && tdist >= LAVABACK_DEF.fireballMin && fullySurfaced && m.shootCd <= 0 && tp && this.canSeeTarget(m, tgt)) {
      m.shootCd = LAVABACK_DEF.cooldown + Math.random() * 0.8;
      const mx = b.x, my = mouthY, mz = b.z;
      this.shootArrow(mx, my, mz, tp.x, tp.y + 1.0, tp.z, m, { fireball: true, straight: true, speed: 15, gravity: 3, dmg: LAVABACK_DEF.fireballDmg, burn: LAVABACK_DEF.fireballBurn });
      if (typeof Particles !== 'undefined') Particles.burst(mx, my, mz, [1, 0.5, 0.1], 8, 3);
      if (typeof SFX !== 'undefined' && SFX.mobHurt) SFX.mobHurt({ x: mx, y: my, z: mz });
    }

    if (b.y < -12) { this.kill(m); return; }

    m.group.position.set(b.x, b.y, b.z);
    m.group.rotation.y = m.yaw;
    m.walkAnim = (m.walkAnim || 0) + dt * 3;
    if (m.parts.neck) m.parts.neck.rotation.x = -0.5 + Math.sin(m.walkAnim) * 0.08;
    if (m.parts.flippers) m.parts.flippers.forEach((f, i) => { f.rotation.x = Math.sin(m.walkAnim * 1.4 + i) * 0.25; });
    const pulse = 0.4 + (Math.sin(m.walkAnim * 1.5) * 0.5 + 0.5) * 0.35;
    this.setEmissive(m, m.flash > 0 ? 1.4 : pulse, m.flash > 0 ? 0xff2020 : 0xff5a1e);
    if (m.flash > 0) m.flash = Math.max(0, m.flash - dt);
  },

  updateAquaticMob(m, dt) {
    const d = OCEAN_MOB_DEFS[m.type], b = m.body;
    const centerY = b.y + b.h * 0.5;
    const wet = World.isWaterAt(Math.floor(b.x), Math.floor(centerY), Math.floor(b.z));
    if (!wet) {
      m.air = (Number.isFinite(+m.air) ? +m.air : 5) - dt;
      if (m.air <= 0) { m.flopHurtT = (m.flopHurtT || 0) - dt; if (m.flopHurtT <= 0) { m.flopHurtT = 1; this.hurt(m, 1, 0, 0, 'air'); if (m.dead) return; } }
      b.vy = Math.max(-20, b.vy - Physics.GRAV * dt); b.vx *= 0.96; b.vz *= 0.96;
      Physics.move(b, dt, { stepUp: false });
    } else {
      m.air = 5; m.flopHurtT = 0; m.attackT = Math.max(0, (m.attackT || 0) - dt);
      let dir = null, speed = d.speed, candidates = [];
      m.aquaticAggroT = Math.max(0, (m.aquaticAggroT || 0) - dt);
      if (m.angryAt && !m.angryAt.dead) candidates = [this.makeTargetForMob(m.angryAt)];
      else if (d.neutral && m.aquaticAggroT > 0) candidates = [this.makePlayerTarget(), ...this.makePeerTargets()].filter(t => t && this.targetKey(t) === m.aquaticAggroKey);
      else if (d.hostile) candidates = [this.makePlayerTarget(), ...this.makePeerTargets()];
      else if (d.neutral && m.aquaticAggroT <= 0) { m.aquaticAggroKey = ''; m.angryAt = null; }
      if (candidates.length) {
        let prey = null, best = 16;
        for (const t of candidates) {
          if (!t) continue;
          const tp = this.aquaticTargetPoint(t);
          if (!tp) continue;
          const dx = tp.x - b.x, dy = tp.y - centerY, dz = tp.z - b.z, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < best) { best = dist; prey = { t, dx, dy, dz, dist }; }
        }
        if (prey) {
          dir = [prey.dx / (prey.dist || 1), prey.dy / (prey.dist || 1), prey.dz / (prey.dist || 1)]; speed *= prey.dist < 5 ? 1.18 : 1;
          if (prey.dist < Math.max(1.35, d.w * 2.2) && m.attackT <= 0) { m.attackT = 1.0; this.dmgTarget(prey.t, d.damage || 5, dir[0] * 5, dir[2] * 5, m); }
        }
      }
      m.swimT -= dt;
      if (!dir && (m.swimT <= 0 || !m.swimDir)) {
        const a = Math.random() * Math.PI * 2;
        m.swimDir = [Math.sin(a), (Math.random() - 0.5) * (d.shape === 'ray' ? 0.18 : 0.7), Math.cos(a)];
        m.swimT = 1.2 + Math.random() * 3.2;
      }
      dir = dir || m.swimDir;
      if (d.school) {
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const o of this.list) if (o !== m && !o.dead && o.type === m.type) { const q = this.farDelta(b, o.body), dd = q.x * q.x + q.y * q.y + q.z * q.z; if (dd < 25) { sx += o.body.vx; sy += o.body.vy; sz += o.body.vz; n++; } }
        if (n) dir = [dir[0] * 0.75 + sx / n / Math.max(1, d.speed) * 0.25, dir[1] * 0.75 + sy / n / Math.max(1, d.speed) * 0.25, dir[2] * 0.75 + sz / n / Math.max(1, d.speed) * 0.25];
      }
      const aheadX = b.x + dir[0] * 1.2, aheadY = centerY + dir[1] * 1.0, aheadZ = b.z + dir[2] * 1.2;
      if (!World.isWaterAt(Math.floor(aheadX), Math.floor(aheadY), Math.floor(aheadZ))) {
        const up = World.isWaterAt(Math.floor(b.x), Math.floor(centerY + 1), Math.floor(b.z));
        const down = World.isWaterAt(Math.floor(b.x), Math.floor(centerY - 1), Math.floor(b.z));
        dir = [-dir[0], up ? 0.65 : down ? -0.65 : -dir[1], -dir[2]]; m.swimDir = dir; m.swimT = 0.65;
      }
      const k = Math.min(1, dt * 4.5);
      b.vx += (dir[0] * speed - b.vx) * k; b.vy += (dir[1] * speed * 0.65 - b.vy) * k; b.vz += (dir[2] * speed - b.vz) * k;
      Physics.move(b, dt, { stepUp: false });
    }
    if (b.y < -12) { this.kill(m); return; }
    m.yaw += wrapAngle(Math.atan2(b.vx, b.vz) - m.yaw) * Math.min(1, 6 * dt);
    m.group.position.set(b.x, b.y, b.z); m.group.rotation.y = m.yaw; m.group.rotation.x = Math.max(-0.45, Math.min(0.45, -b.vy * 0.12));
    m.walkAnim += dt * (3 + d.speed);
    if (m.parts.tail) m.parts.tail.rotation.y = (m.type === 'seahorse' ? 0 : Math.PI / 4) + Math.sin(m.walkAnim * 1.8) * 0.5;
    if (m.parts.tentacles) m.parts.tentacles.forEach((t, i) => { t.rotation.x = Math.sin(m.walkAnim + i) * 0.18; t.rotation.z = Math.cos(m.walkAnim * 0.8 + i) * 0.12; });
    if (d.puffer) { const pt = this.makePlayerTarget(); const near = pt ? this.targetHorizDist(b, pt) : 999; const s = near < 3 ? 1.45 : 1; m.group.scale.lerp(new THREE.Vector3(s, s, s), Math.min(1, dt * 5)); }
    if (m.type === 'jellyfish') { const s = 1 + Math.sin(m.walkAnim) * 0.08; m.group.scale.set(1 / s, s, 1 / s); }
    m.tintT = (m.tintT || 0) - dt;
    if (m.tintT <= 0) {
      m.tintT = 0.25;
      const c = World.getLightColor(Math.floor(b.x), Math.floor(centerY), Math.floor(b.z), undefined, d.angler ? 0.35 : 0.08);
      m.group.traverse(o => { if (!o.isMesh) return; for (const mt of (Array.isArray(o.material) ? o.material : [o.material])) if (mt.color) { if (!mt.userData.mobBaseCol) mt.userData.mobBaseCol = mt.color.clone(); mt.color.copy(mt.userData.mobBaseCol); mt.color.r *= c[0]; mt.color.g *= c[1]; mt.color.b *= c[2]; } });
    }
    this.setEmissive(m, m.flash > 0 ? 1.35 : 0, 0xff2020);
    if (m.flash > 0) { m.group.traverse(o => { if (!o.isMesh) return; for (const mt of (Array.isArray(o.material) ? o.material : [o.material])) if (mt.color) mt.color.setHex(0xff2020); }); m.flash = Math.max(0, m.flash - dt); if (!m.flash) m.tintT = 0; }
  },

  updateFirefly(m, dt) {
    const b = m.body;
    if (!Game.isNight) { this.despawnSilent(m); return; }
    if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(b);
    m.flyT = (m.flyT || 0) - dt;
    const home = m.flyHome || (m.flyHome = { x: b.x, y: b.y, z: b.z });
    const hd = this.deltaToPoint(b, home.x, home.y, home.z), homeDist = Math.sqrt(hd.x * hd.x + hd.y * hd.y + hd.z * hd.z);
    if (m.flyT <= 0 || !m.flyDir || homeDist > 6) {
      const a = Math.random() * Math.PI * 2;
      m.flyDir = homeDist > 6 ? [hd.x / homeDist, hd.y / homeDist, hd.z / homeDist] : [Math.cos(a), (Math.random() - 0.5) * 0.55, Math.sin(a)];
      m.flyT = 0.7 + Math.random() * 1.8;
    }
    let [dx, dy, dz] = m.flyDir;
    const nx = b.x + dx * 0.45, ny = b.y + dy * 0.35, nz = b.z + dz * 0.45;
    if (Physics.boxesIn(nx - 0.08, ny + 0.02, nz - 0.08, nx + 0.08, ny + b.h - 0.02, nz + 0.08).length || World.isWaterAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
      m.flyDir = [-dx, Math.abs(dy) + 0.2, -dz]; m.flyT = 0.45; [dx, dy, dz] = m.flyDir;
    }
    const k = Math.min(1, dt * 4), speed = FIREFLY_DEF.speed;
    b.vx += (dx * speed - b.vx) * k; b.vy += (dy * speed * 0.65 - b.vy) * k; b.vz += (dz * speed - b.vz) * k;
    this.nudgeBodyXZ(b, b.vx * dt, b.vz * dt);
    const fs = (typeof Physics !== 'undefined' && Physics.farState) ? Physics.farState(b) : null;
    if (fs) { fs.y += b.vy * dt; b.y = fs.oy + fs.y; } else b.y += b.vy * dt;
    m.walkAnim += dt * 18;
    if (m.parts.wings) { m.parts.wings[0].rotation.z = Math.sin(m.walkAnim) * 0.75; m.parts.wings[1].rotation.z = -Math.sin(m.walkAnim) * 0.75; }
    m.fireflyPulseT = (m.fireflyPulseT || Math.random() * Math.PI * 2) + dt * 3.2;
    const pulse = 0.45 + (Math.sin(m.fireflyPulseT) * 0.5 + 0.5) * 0.55;
    m.fireflyLightPower = pulse;
    if (m.parts.body) {
      const sc = 0.78 + pulse * 0.30;
      m.parts.body.scale.set(sc, sc, sc);
      m.parts.body.material = m.flash > 0 ? (this._fireflyHurtMat || (this._fireflyHurtMat = new THREE.MeshBasicMaterial({ color: 0xff2020 }))) : this.fireflyAssets().bodyMat;
    }
    m.yaw += wrapAngle(Math.atan2(b.vx, b.vz) - m.yaw) * Math.min(1, dt * 7);
    m.group.position.set(b.x, b.y, b.z); m.group.rotation.y = m.yaw;
    if (m.flash > 0) m.flash = Math.max(0, m.flash - dt);
  },

  update(dt) {
    this._lastDt = dt || 0;
    this.updateArrows(dt);
    this.spawnTick(dt);
    this.reviveDormantNearby(dt);
    this.updateJellyMerges(dt);
    this.enforceSingleFloop();
    const p = Player.body;
    this.pathBudget = 4; // cap A* searches per frame so mob brains stay cheap

    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      if (m.dead) {
        if (m.bubble) this.scene.remove(m.bubble);
        this.scene.remove(m.group);
        this.list.splice(i, 1);
        continue;
      }
      this.repairMobHealth(m);
      if (m.hp <= 0) { this.kill(m); continue; }
      const b = m.body;
      if (m.type === 'sprawler') {
        const sunlit = !Game.isNight && World.skyExposed(Math.floor(b.x), Math.floor(b.y + b.h), Math.floor(b.z));
        m.burnT = sunlit ? (m.burnT || 0) + dt : 0;
        if (sunlit) this.igniteBurn(m, 1.0); // engulf it in visible flames while it cooks in daylight
        if (m.burnT >= 0.8) {
          m.burnT = 0;
          this.hurt(m, 4, 0, 0, 'sunlight');
          if (typeof Particles !== 'undefined') Particles.burst(b.x, b.y + 1.2, b.z, [0.45, 0.45, 0.42], 10, 2.2);
          if (m.dead || m.hp <= 0) continue;
        }
      }
      if (m.angryPlayerT > 0) m.angryPlayerT = Math.max(0, m.angryPlayerT - dt);
      if (m.targetMemoryT > 0) m.targetMemoryT = Math.max(0, m.targetMemoryT - dt);
      if (!(m.targetMemoryT > 0)) { m.targetMemoryKey = ''; m.targetLastSeen = null; }
      // Idle steering timers. These are separate from combat/path target memory.
      // They prevent NPCs from changing avoidance direction every single frame
      // while wandering near walls/doors/crowds, which is the visible twitch.
      if (m.idleAvoidT > 0) m.idleAvoidT = Math.max(0, m.idleAvoidT - dt);
      if (m.idlePauseT > 0) m.idlePauseT = Math.max(0, m.idlePauseT - dt);
      const playerDelta = this.farDelta(b, p);
      const distPlayer = Math.sqrt(playerDelta.x * playerDelta.x + playerDelta.z * playerDelta.z);
      const nearAnyMultiplayerPlayer = (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'host' && Multiplayer.isEntityNearAnyPlayer)
        ? Multiplayer.isEntityNearAnyPlayer(b.x, b.y, b.z, 80) : false;
      if (distPlayer > 80 && !nearAnyMultiplayerPlayer) {
        if (m.type === 'jelly' && this.returnJellyHome(m)) continue;
        if (this.isPersistentType(m.type)) this.stashDormant(m); // keep passive mobs per-chunk instead of deleting them
        m.dead = true; continue;
      }
      if (m.floopHurtVoiceCd > 0) m.floopHurtVoiceCd = Math.max(0, m.floopHurtVoiceCd - dt);
      if ((distPlayer > 52 && !nearAnyMultiplayerPlayer) || !World.hasChunk(Math.floor(b.x), Math.floor(b.z))) continue;
      m.sunFireVisual = m.type === 'skeleton' && !Game.isNight && World.skyExposed(Math.floor(b.x), Math.floor(b.y + 1), Math.floor(b.z)) && !(typeof Physics !== 'undefined' && Physics.inWater(b, 0.3));
      this.updateMobFire(m, dt); if (m.hp <= 0) { this.kill(m); continue; }
      if (m.type === 'lavaback') { this.updateLavaMonster(m, dt); continue; }
      if (OCEAN_MOB_DEFS[m.type]) { this.updateAquaticMob(m, dt); continue; }
      if (m.type === 'firefly') { this.updateFirefly(m, dt); continue; }
      if (this.updateMobBreathingAndSuffocation(m, dt)) { if (!m.dead && m.hp <= 0) this.kill(m); continue; }
      if (m.type === 'sprawler') this.sprawlerClearBrushAround(m, dt);

      m.stateT -= dt;
      if (m.stateT <= 0) {
        m.stateT = 2 + Math.random() * 3;
        m.wanderDir = (m.idlePauseT > 0) ? null : (Math.random() < 0.6 ? this.chooseWanderDir(m) : null);
      }

      let tgt = m.type === 'sprawler' ? this.sprawlerTarget(m) : (HOSTILES.includes(m.type) ? this.targetOf(m) : (JELLY_MOB_TYPES.includes(m.type) ? this.jellyTargetOf(m) : null));
      const targetDelta = () => this.deltaToTarget(b, tgt);
      let distT = tgt ? this.targetHorizDist(b, tgt) : 999;
      // If this is only a last-known spot, do not let attack code treat it like a
      // real body.  When reached, forget it and fall back to proper wandering.
      if (tgt && tgt.memoryOnly && distT < 0.9) {
        this.forgetTargetMemory(m);
        tgt = null;
        distT = 999;
      }
      const losT = () => tgt && !tgt.memoryOnly && this.canSeeTarget(m, tgt);
      let losMemo;
      const hasTargetLOS = () => { if (losMemo === undefined) losMemo = !!losT(); return losMemo; };
      const smartChase = (range) => {
        if (!tgt || distT > range) return null;
        const visible = hasTargetLOS();
        const pd = this.pathMove(m, tgt, dt, range, visible);
        if (pd) return pd;
        return null;
      };

      let wantMove = null;
      let faceTarget = false;
      let speed = 1.3;
      let frogHop = false;

      if (m.type === 'sprawler') {
        if (tgt) {
          const td = targetDelta(), dl = Math.sqrt(td.x * td.x + td.z * td.z) || 1;
          const visible = hasTargetLOS();
          if (visible) { m.pathWantsJump = false; m.pathJumpRise = 1; }
          const pathMove = visible ? null : this.pathMove(m, tgt, dt, 34, false);
          const canWalk = visible || m.pathRouteValid === true;
          // Dig toward a hidden target with no walkable route — at ANY height now,
          // so it tunnels up/diagonally-up instead of only descending. A brief
          // force-dig flag (set by the stuck detector) also lets it carve through
          // geometry the pathfinder thought its wide body could squeeze past.
          const canDig = !visible && (m.pathRouteValid === false || (m.sprawlerForceDig || 0) > 0);
          if (m.sprawlerForceDig > 0) m.sprawlerForceDig -= dt;
          // LOS pursuit behaves like ordinary hostile movement at every height;
          // digging is reserved for a hidden target with a confirmed blocked route.
          wantMove = visible ? [td.x / dl, td.z / dl] : (canWalk ? pathMove : (canDig ? [td.x / dl, td.z / dl] : m.wanderDir));
          speed = canWalk || canDig ? 5.8 : 1.3;
          faceTarget = canWalk || canDig;
          if (canDig) this.sprawlerBreakToward(m, tgt, dt);
          m.meleeT -= dt;
          if ((canWalk || canDig) && !tgt.memoryOnly && distT < 2.5 && Math.abs(td.y) < 2.4 && m.meleeT <= 0) {
            m.meleeT = 0.85; m.attackSwingT = 0.28;
            this.dmgTarget(tgt, 12, td.x / dl * 7, td.z / dl * 7, m);
          }
        } else wantMove = m.wanderDir;
      } else if (m.type === 'creeper') {
        // explosive frog: hops in intervals, screeches, then boom.
        // Once it has screeched, it is COMMITTED — running breaks LOS, not its resolve.
        frogHop = true;
        m.hopT -= dt;
        if (m.screeched) {
          faceTarget = !!tgt;
          m.fuse += dt;
          if (m.fuse >= 1.0) {
            m.dead = true;
            World.explode(b.x, b.y + 0.5, b.z, 2.9, 16, 3); // +20% dmg, +50% hurt radius
            continue;
          }
        } else if (tgt && distT < 16) {
          faceTarget = true;
          const dy = Math.abs((tgt.y + 0.5) - (b.y + 0.5));
          const inRange = distT < 3 && dy < 2.5;
          if (inRange && losT()) {
            m.screeched = true;
            SFX.screech({ x: b.x, y: b.y + 1.2, z: b.z });
            this.say(m, 'SCREEEEEEEE', '#4db843');
          } else if (m.hopT <= 0 && b.onGround && distT > 1.5) {
            const hopDir = smartChase(18);
            if (hopDir) {
              b.vx = hopDir[0] * 4.6; b.vz = hopDir[1] * 4.6; this.mobJump(m, 1.0);
              m.hopT = 1.15 + Math.random() * 0.5;
            } else {
              m.hopT = 0.35; // blocked and no path yet; do not bunny-hop into the wall forever
            }
          }
        } else {
          if (m.hopT <= 0 && b.onGround && m.wanderDir && Math.random() < 0.5) {
            b.vx = m.wanderDir[0] * 3; b.vz = m.wanderDir[1] * 3; this.mobJump(m, 0.95);
            m.hopT = 1.6 + Math.random();
          }
        }
      } else if (m.type === 'skeleton') {
        const engaged = tgt && distT < 15 && hasTargetLOS();
        if (engaged) {
          faceTarget = true;
          const td = targetDelta(); const dx = td.x / (distT + 0.01), dz = td.z / (distT + 0.01);
          if (distT > 10) { wantMove = smartChase(22); speed = 2.2; }
          else if (distT < 6) { wantMove = this.safeMoveDir(m, [-dx, -dz], 1.6); speed = 1.8; }
          m.shootT -= dt;
          if (m.shootT <= 0 && distT > 2.5) {
            m.shootT = 2.1 + Math.random() * 0.7;
            const bp = this.farBodyPos(b), tp = this.targetWorldPos(tgt);
            this.shootArrow(bp.x, bp.y + 1.5, bp.z, tp.x, tp.y + 1.2, tp.z, m);
          }
        } else if (tgt && distT < 22) {
          wantMove = smartChase(22) || m.wanderDir;
          speed = 2.0;
          faceTarget = !!wantMove;
        } else {
          wantMove = m.wanderDir;
        }
        if (!Game.isNight && World.skyExposed(Math.floor(b.x), Math.floor(b.y + 1), Math.floor(b.z))) {
          m.burnT += dt;
          if (m.burnT > 1) {
            m.burnT = 0;
            m.hp -= 2; m.flash = 0.3;
            Particles.burst(b.x, b.y + 1.5, b.z, [1, 0.5, 0.1], 6, 2);
            if (m.hp <= 0) { this.kill(m); continue; }
          }
        }
      } else if (m.type === 'spider') {
        if (tgt && (Game.isNight || m.angryAt || m.angryPlayerT > 0) && distT < 14) {
          const td = targetDelta(); const dx = td.x / (distT + 0.01), dz = td.z / (distT + 0.01);
          wantMove = smartChase(16); speed = 3.1;
          faceTarget = distT < 3;
          m.meleeT -= dt;
          if (distT < 1.7 && Math.abs((b.y + 0.4) - (tgt.y + 0.9)) < 1.6 && m.meleeT <= 0) {
            m.meleeT = 1.1;
            this.dmgTarget(tgt, 3, dx * 4, dz * 4, m);
          }
        } else {
          wantMove = m.wanderDir;
          speed = 1.6;
        }
      } else if (m.type === 'tung') {
        // TUNG TUNG TUNG SAHUR: sprints at you with a bat
        if (tgt && distT < 24) {
          faceTarget = distT < 4;
          const td = targetDelta(); const dx = td.x / (distT + 0.01), dz = td.z / (distT + 0.01);
          wantMove = smartChase(26); speed = 5.0;
          m.meleeT -= dt;
          if (distT < 1.9 && m.meleeT <= 0) {
            m.meleeT = 1.2;
            this.dmgTarget(tgt, 7, dx * 12, dz * 12, m); // BAT. huge knockback
            if (m.parts.bat) { m.parts.bat.rotation.x = -1.4; setTimeout(() => { if (m.parts.bat) m.parts.bat.rotation.x = 0.6; }, 180); }
            SFX.tung({ x: b.x, y: b.y + 1.1, z: b.z });
          }
          m.speechT -= dt;
          if (m.speechT <= 0) {
            m.speechT = 5 + Math.random() * 6;
            this.say(m, 'TUNG TUNG TUNG SAHUR');
          }
        } else {
          wantMove = m.wanderDir;
          speed = 2;
        }
      } else if (m.type === 'jelly' || m.type === 'big_jelly') {
        const isBigJelly = m.type === 'big_jelly';
        // Jelly People are tiny and weak, so frogs/creepers need special survival
        // logic.  They jab normal frogs, then sprint away; if a frog is already
        // screeching, they stop trying to be brave and run immediately.
        const screamingFrog = this.jellyDangerFrog(m, true, 8);
        if (screamingFrog) {
          m.angryAt = screamingFrog;
          m.jellyFrogFleeT = Math.max(m.jellyFrogFleeT || 0, 1.35);
          wantMove = this.jellyFleeFrom(m, screamingFrog, 2.0);
          speed = isBigJelly ? 3.65 : 4.35;
          faceTarget = false;
          this.panicJellyHouse(m.jellyHome || m.fromSpawner, 5);
        } else if (m.jellyFrogFleeT > 0 && m.angryAt && !m.angryAt.dead && m.angryAt.type === 'creeper') {
          m.jellyFrogFleeT = Math.max(0, m.jellyFrogFleeT - dt);
          wantMove = this.jellyFleeFrom(m, m.angryAt, 1.85);
          speed = isBigJelly ? 3.45 : 4.0;
          faceTarget = false;
        } else if (tgt && distT < (isBigJelly ? 18 : 15)) {
          const targetMob = (tgt && !tgt.memoryOnly) ? (tgt.mob || null) : null;
          const targetIsFrog = targetMob && targetMob.type === 'creeper';
          faceTarget = true;
          const td = targetDelta(); const dx = td.x / (distT + 0.01), dz = td.z / (distT + 0.01);
          if (targetIsFrog && distT < 2.35 && m.meleeT > 0.15) {
            // After throwing a punch at a frog, kite away instead of body-blocking
            // in front of the fuse like a senile little gummy bear.
            wantMove = this.jellyFleeFrom(m, targetMob, 1.75);
            speed = isBigJelly ? 3.25 : 3.95;
            faceTarget = false;
          } else {
            const closeEnough = isBigJelly ? 1.20 : 0.85;
            wantMove = distT > closeEnough ? (smartChase(isBigJelly ? 18 : 16) || [dx, dz]) : null;
            speed = isBigJelly ? (targetIsFrog ? 3.1 : 2.85) : (targetIsFrog ? 3.75 : 3.35);
          }
          m.meleeT -= dt;
          const hitReach = isBigJelly ? 1.55 : 1.15;
          const yReach = isBigJelly ? 1.75 : 1.1;
          if (distT < hitReach && Math.abs((b.y + b.h * 0.5) - (tgt.y + (tgt.h || 1) * 0.5)) < yReach && m.meleeT <= 0) {
            m.meleeT = isBigJelly ? 0.80 : (targetIsFrog ? 0.75 : 0.55);
            m.attackSwingT = isBigJelly ? 0.28 : 0.20;
            this.dmgTarget(tgt, isBigJelly ? 2 : 1, dx * (isBigJelly ? 4.5 : 2.5), dz * (isBigJelly ? 4.5 : 2.5), m);
            if (targetIsFrog) {
              m.angryAt = targetMob;
              m.jellyFrogFleeT = 1.1 + Math.random() * 0.45;
              wantMove = this.jellyFleeFrom(m, targetMob, 1.8);
              speed = isBigJelly ? 3.35 : 4.05;
              faceTarget = false;
            }
            this.panicJellyHouse(m.jellyHome || m.fromSpawner, 6);
          }
        } else {
          if (isBigJelly) {
            wantMove = this.jellyIdleMove(m, dt);
            speed = 1.35;
          } else {
          this.adoptNearbyJellyHouse(m, 10);
          const hk = this.jellyHomeAlive(m.jellyHome) ? m.jellyHome : '';
          if (!hk && m.jellyHome) { m.jellyHome = ''; m.fromSpawner = ''; m.jellyIdleGoal = null; }
          if (hk) {
            const [hx, hy, hz] = hk.split(',').map(Number);
            const hxC = hx + 0.5, hzC = hz + 0.5;
            const dh = Math.sqrt((b.x - hxC) ** 2 + (b.z - hzC) ** 2);
            const outsideHomeBox = Math.abs(b.x - hxC) > 5 || Math.abs((b.y + b.h * 0.5) - (hy + 0.5)) > 5 || Math.abs(b.z - hzC) > 5;
            if (outsideHomeBox || dh > 4.9) {
              m.jellyIdleGoal = null;
              wantMove = this.pathMove(m, { x: hxC, y: hy, z: hzC, h: b.h }, dt, 12, false) || this.safeMoveDir(m, [(hxC - b.x) / (dh + 0.01), (hzC - b.z) / (dh + 0.01)], 1.0);
              speed = outsideHomeBox ? 2.05 : 1.55;
            } else {
              wantMove = this.jellyIdleMove(m, dt);
              speed = 1.15;
              if (dh < 1.6 && Math.random() < 0.004) { this.returnJellyHome(m); continue; }
            }
          } else {
            wantMove = this.jellyIdleMove(m, dt);
            speed = 1.05;
          }
          }
        }
      } else if (m.type === 'sheep' || m.type === 'chicken' || m.type === 'camel') {
        if (m.fleeT > 0) {
          m.fleeT -= dt;
          const src = m.angryAt && !m.angryAt.dead ? m.angryAt.body : p;
          const fd = this.farDelta(src, b);
          const d2 = Math.sqrt(fd.x * fd.x + fd.z * fd.z) + 0.01;
          wantMove = this.safeMoveDir(m, [fd.x / d2, fd.z / d2], 1.6);
          speed = m.type === 'camel' ? 3.4 : 2.8;
        } else {
          wantMove = m.wanderDir;
          speed = m.type === 'camel' ? 1.1 : 0.9;
          if (m.type === 'sheep' && distPlayer < 8 && Math.random() < 0.003) SFX.sheep({ x: b.x, y: b.y + 0.8, z: b.z });
          if (m.type === 'chicken' && distPlayer < 8 && Math.random() < 0.004) SFX.pop();
        }
      } else if (m.type === 'humbug') {
        const engaged = tgt && distT < 18 && hasTargetLOS();
        if (m.gunId) {
          if (engaged) {
            faceTarget = true;
            const td = targetDelta(); const dx = td.x / (distT + 0.01), dz = td.z / (distT + 0.01);
            if (distT > 13) { wantMove = smartChase(24); speed = 2.4; }
            else if (distT < 7) { wantMove = this.safeMoveDir(m, [-dx, -dz], 1.6); speed = 2.0; }
            m.shootT -= dt;
            if (m.shootT <= 0 && distT > 2) {
              m.shootT = 1.8 + Math.random() * 0.8;
              const acc = Math.min(0.8, 0.5 + Game.dayCount * 0.02);
              const bp = this.farBodyPos(b);
              Guns.mobFire({ x: bp.x, y: bp.y + 1.6, z: bp.z }, m.gunId, acc, tgt, m);
            }
          } else if (tgt && distT < 24) {
            wantMove = smartChase(24) || m.wanderDir;
            speed = 2.4;
            faceTarget = !!wantMove;
          } else wantMove = m.wanderDir;
        } else {
          if (tgt && distT < 16) {
            const td = targetDelta(); const dx = td.x / (distT + 0.01), dz = td.z / (distT + 0.01);
            wantMove = smartChase(18); speed = 2.7;
            faceTarget = distT < 2.5;
            m.meleeT -= dt;
            if (distT < 1.7 && m.meleeT <= 0) {
              m.meleeT = 1.0;
              this.dmgTarget(tgt, 4, dx * 4, dz * 4, m);
            }
          } else wantMove = m.wanderDir;
        }
        m.speechT -= dt;
        if (m.speechT <= 0 && distPlayer < 20) {
          m.speechT = 10 + Math.random() * 20;
          this.say(m, HUMBUG_LINES[(Math.random() * HUMBUG_LINES.length) | 0]);
        }
      } else { // Mr Floop
        if (m.angryAt && !m.angryAt.dead) {
          // Mr Floop has a temper
          const ab = m.angryAt.body;
          const fd = this.farDelta(b, ab);
          const d2 = Math.sqrt(fd.x * fd.x + fd.z * fd.z) + 0.01;
          if (d2 < 20) {
            const ap = this.farBodyPos(ab);
            const floopTgt = { x: ap.x, y: ap.y, z: ap.z, h: ab.h || 1.8, mob: m.angryAt, isPlayer: false };
            const canSeeAngry = this.canSeeTarget(m, floopTgt);
            if (canSeeAngry) this.rememberTarget(m, floopTgt);
            const keptFloopTgt = canSeeAngry ? floopTgt : this.rememberedTarget(m, 20);
            if (!keptFloopTgt) { m.angryAt = null; }
            else wantMove = this.pathMove(m, keptFloopTgt, dt, 22, canSeeAngry);
            speed = 2.4;
            faceTarget = false;
            m.meleeT -= dt;
            if (d2 < 1.8 && m.meleeT <= 0) {
              m.meleeT = 1.0;
              this.hurt(m.angryAt, 5, fd.x / d2 * 8, fd.z / d2 * 8, m);
            }
          } else m.angryAt = null;
        } else if (m.state === 'approach') {
          if (distPlayer > 2.6) {
            const floopPlayerTgt = this.makePlayerTarget();
            const canSeePlayer = floopPlayerTgt && this.canSeeTarget(m, floopPlayerTgt);
            if (canSeePlayer) this.rememberTarget(m, floopPlayerTgt);
            const keptFloopPlayerTgt = canSeePlayer ? floopPlayerTgt : this.rememberedTarget(m, 12);
            if (!keptFloopPlayerTgt) { m.state = 'wander'; wantMove = m.wanderDir; }
            else wantMove = this.pathMove(m, keptFloopPlayerTgt, dt, 12, canSeePlayer);
            speed = 1.1;
          } else { m.state = 'chat'; m.stateT = 2 + Math.random() * 2; }
        } else if (m.state === 'chat') {
          m.targetYaw = Math.atan2(playerDelta.x, playerDelta.z);
          if (distPlayer > 7) m.state = 'wander';
        } else {
          wantMove = m.wanderDir;
          if (distPlayer < 8 && Math.random() < 0.002) { m.state = distPlayer > 3 ? 'approach' : 'chat'; m.stateT = 3; }
        }
        m.speechT -= dt;
        if (m.speechT <= 0 && distPlayer < 26) {
          m.speechT = 7 + Math.random() * 16;
          const roll = Math.random();
          let line;
          if (roll < 0.025) line = Math.random() < 0.5 ? 'STFU' : 'stfu'; // very rare temper
          else if (roll < 0.42) line = FLOOP_LINES_COMMON[(Math.random() * FLOOP_LINES_COMMON.length) | 0];
          else if (roll < 0.72) line = FLOOP_LINES_CASUAL[(Math.random() * FLOOP_LINES_CASUAL.length) | 0];
          else line = FLOOP_LINES_RARE[(Math.random() * FLOOP_LINES_RARE.length) | 0];
          this.say(m, line);
          if (distPlayer < 12) { m.state = 'chat'; m.stateT = 2.5; }
          if (Math.random() < 0.10) {
            Drops.spawn(b.x, b.y + 1.2, b.z, Math.random() < 0.6 ? I.COOKIE : I.BERRY, 1);
            this.say(m, 'a gift! merry christmas!!');
          }
        }
      }

      // If a mob is only wandering, never let the raw idle vector drive it into
      // a wall, cactus, fire, lava, or cliff.  Chasing still uses A* above.
      if (wantMove && !tgt && !frogHop) {
        wantMove = this.sanitizeIdleMove(m, wantMove, dt);
      }

      // ---- stuck detection + detour ----
      if (m.detourT > 0) {
        m.detourT -= dt;
        if (m.detourDir) wantMove = m.detourDir;
      }
      // Even during ordinary LOS/path chasing, the Sprawler plows through fragile
      // obstacles instead of politely navigating around cactus, foliage, doors, or glass.
      if (m.type === 'sprawler' && tgt && wantMove) this.sprawlerBreakFragileAhead(m, wantMove, dt);
      m.stuckT += dt;
      // The wide sprawler wedges easily, so react sooner than other mobs.
      if (m.stuckT >= (m.type === 'sprawler' ? 0.35 : 0.6)) {
        const moved = Math.sqrt((b.x - m.lastSX) ** 2 + (b.z - m.lastSZ) ** 2);
        if (wantMove && moved < 0.12) {
          m.stuckPathHits = (m.stuckPathHits || 0) + 1;
          m.pathT = 0;
          m.pathFailT = 0;
          const sprawlerMadeRoom = m.type === 'sprawler' && tgt && this.sprawlerClearFailedStep(m, wantMove);
          if (m.type === 'sprawler' && tgt) {
            // Physically stuck while chasing: carve straight toward the target
            // NOW (even if the pathfinder thinks a route exists) and keep the
            // proactive digger armed for the next few ticks. This is the fix for
            // "won't break blocks when it needs to, especially on diagonals".
            this.sprawlerBreakToward(m, tgt, 1);
            m.sprawlerForceDig = 0.8;
          }
          if (sprawlerMadeRoom) {
            m.detourT = 0; m.detourDir = null; m.stuckPathHits = 0;
            if (m.stepClearPhase === 1 && b.onGround) this.mobJump(m);
          } else if (!tgt) {
            // Idle mobs should not detour-jitter at a wall forever.  Clear the
            // bad wander/stroll choice and let the next brain tick pick a safe one.
            m.jellyIdleGoal = null;
            m.wanderDir = null;
            m.idleAvoidDir = null;
            m.idleAvoidT = 0;
            m.idlePauseT = 0.45 + Math.random() * 0.45;
            m.path = null;
            m.pathGoalKey = '';
            m.detourT = 0;
            m.detourDir = null;
            wantMove = null;
          }
          if (!sprawlerMadeRoom && this.mobShouldJump(m, wantMove) && tgt) this.mobJump(m);
          if (!sprawlerMadeRoom && m.stuckPathHits >= 3 && tgt) {
            // Repeatedly pushing into the same impossible low/wide clearance is
            // usually a bad goal, not a detour problem. Give up/search briefly
            // instead of ping-ponging outside the player's shelter forever.
            this.markPathUnreachable(m, 2.4 + Math.random() * 1.8);
            wantMove = this.unreachablePathMove(m, tgt, dt);
            m.stuckPathHits = 0;
          } else if (!sprawlerMadeRoom && tgt && wantMove) {
            const sign = Math.random() < 0.5 ? 1 : -1;
            m.detourDir = [-wantMove[1] * sign, wantMove[0] * sign];
            m.detourT = 0.35 + Math.random() * 0.25;
          }
        } else if (moved >= 0.16) {
          m.stuckPathHits = 0;
          if (m.type === 'sprawler') { m.stepClearPhase = 0; m.stepClearDir = ''; }
        }
        m.stuckT = 0; m.lastSX = b.x; m.lastSZ = b.z;
      }

      // ---- movement/physics (knockback wins for a beat) ----
      if (m.kbCd > 0) m.kbCd -= dt;
      const inWater = Physics.inWater(b, 0.3);
      const bodyWater = Physics.inWater(b, 0.9);
      // lava cooks everyone, no exceptions. Route through hurt() so death,
      // drops, angry-state cleanup, and weird edge cases all use one path.
      if (Physics.inLava(b, 0.2)) {
        m.lavaT = (m.lavaT || 0) - dt;
        if (m.lavaT <= 0) {
          m.lavaT = 0.5;
          this.hurt(m, 3, 0, 0, 'lava');
          Particles.burst(b.x, b.y + 1, b.z, [1, 0.55, 0.1], 6, 2);
          if (m.dead) continue;
        }
      }
      if (m.kbT > 0) {
        m.kbT -= dt;
        b.vx *= 0.96; b.vz *= 0.96; // let the knockback carry them
      } else if (frogHop) {
        // frogs steer only mid-hop; on the ground they sit still
        if (b.onGround) { b.vx *= 0.6; b.vz *= 0.6; }
        m.walkAnim += dt * 4;
      } else if (wantMove) {
        const ml = Math.sqrt(wantMove[0] ** 2 + wantMove[1] ** 2) || 1;
        b.vx = wantMove[0] / ml * speed;
        b.vz = wantMove[1] / ml * speed;
        if (this.mobShouldJump(m, wantMove)) this.mobJump(m);
        m.walkAnim += dt * 7;
      } else {
        b.vx *= 0.8; b.vz *= 0.8;
      }
      if (inWater) {
        b.vy += (14 - Math.max(0, b.vy) * 6) * dt;
        b.vy = Math.min(b.vy, 2.5);
        b.vy -= 4 * dt;
      } else {
        b.vy -= Physics.GRAV * dt;
      }
      if (m.type === 'chicken') b.vy = Math.max(b.vy, -2.5); // flappy descent
      b.vy = Math.max(b.vy, -38);
      Physics.move(b, dt, { stepUp: m.type !== 'creeper', stepLift: 0.58 });
      if ((inWater || bodyWater) && b.hitH && (wantMove || m.pathWantsJump || Math.abs(b.vx) + Math.abs(b.vz) > 0.05)) {
        b.vy = Math.max(b.vy, 7.8);
      }
      if (b.y < -12) {
        this.kill(m);
        continue;
      }

      // ---- facing ----
      if (faceTarget && tgt) {
        { const td = targetDelta(); m.targetYaw = Math.atan2(td.x, td.z); }
      } else if (wantMove && (Math.abs(b.vx) > 0.05 || Math.abs(b.vz) > 0.05)) {
        m.targetYaw = Math.atan2(wantMove[0], wantMove[1]);
      } else if (frogHop && !b.onGround) {
        if (Math.abs(b.vx) + Math.abs(b.vz) > 0.5) m.targetYaw = Math.atan2(b.vx, b.vz);
      }
      const yawDiff = wrapAngle(m.targetYaw - m.yaw);
      m.yaw += yawDiff * Math.min(1, 7 * dt);

      // ---- visuals ----
      m.group.position.set(b.x, b.y, b.z);
      m.group.rotation.y = m.yaw;
      const swing = wantMove || (frogHop && !b.onGround) ? Math.sin(m.walkAnim) * 0.5 : 0;
      m.parts.legs.forEach((leg, li) => {
        if (m.type === 'spider') leg.rotation.y = swing * (li % 2 ? 0.4 : -0.4);
        else if (m.type === 'sprawler') leg.rotation.x = (li < 2 ? 0.18 : -0.18) + swing * (li % 2 ? 0.75 : -0.75);
        else if (m.type !== 'creeper') leg.rotation.x = swing * (li % 2 ? 1 : -1);
      });
      if (m.type === 'sprawler' && m.parts.head) {
        m.attackSwingT = Math.max(0, (m.attackSwingT || 0) - dt);
        m.parts.head.rotation.x = m.attackSwingT > 0 ? Math.sin(m.attackSwingT / 0.28 * Math.PI) * 0.7 : 0;
      }
      if (JELLY_MOB_TYPES.includes(m.type) && m.parts.arms && m.parts.arms.length) {
        if (m.attackSwingT > 0) m.attackSwingT = Math.max(0, m.attackSwingT - dt);
        const punchWindow = m.type === 'big_jelly' ? 0.30 : 0.22;
        const punch = m.attackSwingT > 0 ? Math.sin((m.attackSwingT / punchWindow) * Math.PI) * (m.type === 'big_jelly' ? 1.7 : 1.4) : 0;
        m.parts.arms[0].rotation.x = -punch + swing * 0.35;
        m.parts.arms[1].rotation.x = punch + swing * -0.35;
      }
      if (m.type === 'creeper') {
        const fl = m.fuse > 0 ? (Math.sin(m.fuse * 26) > 0 ? 0.9 : 0) : 0;
        const sc = 1 + m.fuse * 0.2;
        m.group.scale.set(sc, sc, sc);
        this.setEmissive(m, Math.max(fl, m.flash > 0 ? 0.6 : 0), m.flash > 0 ? 0xff3333 : 0xffffff);
      } else {
        this.setEmissive(m, m.flash > 0 ? 0.6 : 0, 0xff3333);
      }
      if (m.flash > 0) m.flash -= dt;
      // match the voxel lighting (mobs in caves/at night are actually dark now)
      m.tintT = (m.tintT || 0) - dt;
      if (m.tintT <= 0) {
        m.tintT = 0.20;
        const c = World.getLightColor(Math.floor(b.x), Math.floor(b.y + b.h * 0.55), Math.floor(b.z), undefined, 0.06);
        m._lightRGB = c;
        m.group.traverse(o => {
          if (o.isMesh) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const mt of mats) {
              if (!mt.color) continue;
              if (!mt.userData.mobBaseCol) mt.userData.mobBaseCol = mt.color.clone();
              mt.color.copy(mt.userData.mobBaseCol); mt.color.r *= c[0]; mt.color.g *= c[1]; mt.color.b *= c[2];
            }
          }
        });
      }
      if (m.bubble) {
        m.bubbleT -= dt;
        m.bubble.position.set(b.x, b.y + b.h + 0.55, b.z);
        if (m.bubbleT <= 0) {
          this.scene.remove(m.bubble);
          m.bubble.material.map.dispose(); m.bubble.material.dispose();
          m.bubble = null;
        }
      }
    }
    this.separateMobs(dt);
  },

  setEmissive(m, intensity, color) {
    m.group.traverse(o => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (mat.emissive) {
            mat.emissive.setHex(color);
            mat.emissiveIntensity = intensity;
          }
        }
      }
    });
  },

  humbugGun() {
    const day = Game.dayCount;
    const roll = Math.random();
    if (day >= 9 && roll < 0.10) return I.RIFLE;
    if (day >= 7 && roll < 0.28) return I.SMG;
    if (roll < 0.5) return I.PISTOL;
    return null;
  },

  // ---------- spawning ----------
  spawnTick(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 1.6;
    const p = Player.body;
    if (!World.hasChunk(Math.floor(p.x), Math.floor(p.z))) return;

    const hostiles = this.list.filter(m => HOSTILES.includes(m.type)).length;
    const floops = this.list.filter(m => m.type === 'floop').length;
    const passive = this.list.filter(m => ['sheep', 'chicken', 'camel', 'jelly', 'big_jelly'].includes(m.type)).length;
    const aquatic = this.list.filter(m => OCEAN_MOB_DEFS[m.type]).length;
    const tungs = this.list.filter(m => m.type === 'tung').length;
    const sprawlers = this.list.filter(m => m.type === 'sprawler').length;
    const fireflies = this.list.filter(m => m.type === 'firefly').length;
    const lavabacks = this.list.filter(m => m.type === 'lavaback').length;


    // One lightweight nighttime swarm at a time. Each swarm is 5-10 fireflies.
    if (Game.isNight && fireflies < 5 && Math.random() < 0.10) {
      const pos = this.surfaceSpot(p, 12, 34);
      if (pos) {
        const biome = World.biomeAt(Math.floor(pos.x), Math.floor(pos.z));
        const ground = World.getBlock(Math.floor(pos.x), Math.floor(pos.y - 0.5), Math.floor(pos.z));
        if (biome !== 'desert' && biome !== 'ocean' && biome !== 'deep_ocean' && (ground === B.GRASS || ground === B.SNOWY_GRASS || ground === B.DIRT)) {
          const count = Math.min(5 + ((Math.random() * 6) | 0), 10 - fireflies);
          for (let i = 0; i < count; i++) {
            const x = pos.x + (Math.random() - 0.5) * 4.5, z = pos.z + (Math.random() - 0.5) * 4.5;
            const y = World.heightAt(Math.floor(x), Math.floor(z)) + 1.25 + Math.random() * 2.2;
            if (!Physics.boxesIn(x - 0.08, y, z - 0.08, x + 0.08, y + FIREFLY_DEF.h, z + 0.08).length && !World.isWaterAt(Math.floor(x), Math.floor(y), Math.floor(z))) this.spawn('firefly', x, y, z);
          }
        }
      }
    }

    if (Game.isNight && sprawlers < 1 && Math.random() < 0.002) {
      const pos = this.surfaceSpot(p, 28, 46);
      if (pos && World.spawnAllowedAt(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)) && this.spawnFits('sprawler', pos.x, pos.y, pos.z)) {
        this.spawn('sprawler', pos.x, pos.y, pos.z);
      }
    }

    if (Game.isNight && hostiles < 10 && Math.random() < 0.55) {
      const pos = this.surfaceSpot(p, 20, 38);
      if (pos && World.spawnAllowedAt(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z))) {
        const humbugsUnlocked = Game.dayCount >= 5;
        const roll = Math.random();
        const type = tungs < 1 && roll < 0.05 && Game.dayCount >= 3 ? 'tung'
          : humbugsUnlocked && roll < 0.28 ? 'humbug'
          : roll < 0.56 ? 'creeper'
          : 'skeleton';
        if (!this.spawnFits(type, pos.x, pos.y, pos.z)) {
          // picked a valid-looking surface column, but the actual mob body clips;
          // wait for the next spawn tick instead of half-embedding it in terrain.
        } else if (type === 'tung') {
          this.spawn('tung', pos.x, pos.y, pos.z);
          UI.chat('You hear it in the distance... tung. tung. tung.', '#d2a24c');
        }
        else this.spawn(type, pos.x, pos.y, pos.z, type === 'humbug' ? this.humbugGun() : null);
      }
    }
    // Black torches attract spawn attempts directly into their dark pocket,
    // including a smaller daytime chance. Reuse the existing light registry.
    if (hostiles < 10 && Math.random() < (Game.isNight ? 0.24 : 0.08) && World.lights && World.lights.size) {
      const darks = [];
      for (const v of World.lights.values()) {
        if (!v || !isBlackTorch(World.getBlock(v[0], v[1], v[2]))) continue;
        if ((v[0] - p.x) ** 2 + (v[2] - p.z) ** 2 <= 48 * 48) darks.push(v);
      }
      if (darks.length) {
        const src = darks[(Math.random() * darks.length) | 0], a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 8;
        const pos = this.surfaceSpotAt(Math.round(src[0] + Math.cos(a) * r), Math.round(src[2] + Math.sin(a) * r), src[1] + 8);
        if (pos && (pos.x - p.x) ** 2 + (pos.z - p.z) ** 2 > 12 * 12 && World.spawnAllowedAt(pos.x, pos.y, pos.z)) {
          const roll = Math.random(), type = Game.dayCount >= 5 && roll < 0.25 ? 'humbug' : roll < 0.65 ? 'skeleton' : 'creeper';
          if (this.spawnFits(type, pos.x, pos.y, pos.z)) this.spawn(type, pos.x, pos.y, pos.z, type === 'humbug' ? this.humbugGun() : null);
        }
      }
    }

    // dark caves spawn monsters any time of day.  Do several candidate checks
    // instead of one random Y roll so daytime cave spawning is reliable.
    if (hostiles < 10 && Math.random() < (Game.isNight ? 0.18 : 0.42)) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const r2 = 14 + Math.random() * 24;
        const sx = Math.round(p.x + Math.cos(a) * r2), sz = Math.round(p.z + Math.sin(a) * r2);
        if (!World.hasChunk(sx, sz)) continue;
        const top = Math.max(8, Math.min(World.H - 4, World.heightAt(sx, sz) - 2));
        const sy = 4 + ((Math.random() * Math.max(5, top - 4)) | 0);
        const okCell = World.getBlock(sx, sy, sz) === B.AIR && World.getBlock(sx, sy + 1, sz) === B.AIR &&
          Physics.solidAt(sx + 0.5, sy - 0.5, sz + 0.5);
        if (!okCell || !World.spawnAllowedAt(sx, sy, sz)) continue;
        const effectiveLight = World.getEffectiveLight(sx, sy + 1, sz, Game.isNight ? 0.15 : 0.55);
        if (effectiveLight > 7) continue;
        const roll = Math.random();
        const type = Game.dayCount >= 5 && roll < 0.3 ? 'humbug' : roll < 0.68 ? 'skeleton' : 'creeper';
        if (!this.spawnFits(type, sx + 0.5, sy + 0.02, sz + 0.5)) continue;
        this.spawn(type, sx + 0.5, sy + 0.02, sz + 0.5, type === 'humbug' ? this.humbugGun() : null);
        break;
      }
    }
    if (p.y < 26 && hostiles < 12 && Math.random() < 0.25) {
      const near = World.dungeonSpots.filter(s =>
        Math.abs(s.x - p.x) < 26 && Math.abs(s.z - p.z) < 26 && Math.abs(s.y - p.y) < 12);
      if (near.length) {
        const s = near[(Math.random() * near.length) | 0];
        const d = Math.sqrt((s.x - p.x) ** 2 + (s.z - p.z) ** 2);
        if (d > 7 && World.getBlock(s.x, s.y, s.z) === B.AIR && World.spawnAllowedAt(s.x, s.y, s.z)) {
          const roll = Math.random();
          const type = Game.dayCount >= 5 && roll < 0.4 ? 'humbug' : roll < 0.75 ? 'skeleton' : 'creeper';
          if (this.spawnFits(type, s.x + 0.5, s.y + 0.02, s.z + 0.5)) {
            this.spawn(type, s.x + 0.5, s.y + 0.02, s.z + 0.5, type === 'humbug' ? this.humbugGun() : null);
          }
        }
      }
    }
    if (aquatic < 18 && Math.random() < (Game.isNight ? 0.52 : 0.30)) {
      const pos = this.waterSpot(p, 12, 42);
      if (pos) {
        const type = this.oceanType(pos.depth, pos.biome), count = OCEAN_MOB_DEFS[type].school ? 1 + ((Math.random() * 3) | 0) : 1;
        for (let i = 0; i < count && aquatic + i < 18; i++) {
          const x = pos.x + (Math.random() - 0.5) * 2, y = pos.y + (Math.random() - 0.5), z = pos.z + (Math.random() - 0.5) * 2;
          if (isWaterCell(World.getBlock(Math.floor(x), Math.floor(y + 0.2), Math.floor(z))) && this.spawnFits(type, x, y, z)) this.spawn(type, x, y, z);
        }
      }
    }
    // Lavaback: lurks in lava, day or night, regardless of light level. Capped low so a
    // lava lake usually holds 1-2 (sometimes 0), never a swarm.
    if (lavabacks < 2 && Math.random() < 0.4) { // deliberately not gated by Game.isNight
      const pos = this.lavaSpot(p, 8, 40);
      if (pos && this.spawnFits('lavaback', pos.x, pos.y, pos.z)) this.spawn('lavaback', pos.x, pos.y, pos.z);
    }
    if (!Game.isNight && passive < 7 && Math.random() < 0.09) {
      const pos = this.surfaceSpot(p, 16, 34);
      if (pos) {
        const biome = World.biomeAt(Math.floor(pos.x), Math.floor(pos.z));
        const ground = World.getBlock(Math.floor(pos.x), Math.floor(pos.y - 0.5), Math.floor(pos.z));
        if (biome === 'desert' && ground === B.SAND && this.spawnFits('camel', pos.x, pos.y, pos.z)) this.spawn('camel', pos.x, pos.y, pos.z);
        else if (ground === B.GRASS || ground === B.SNOWY_GRASS) {
          const type = Math.random() < 0.5 ? 'sheep' : 'chicken';
          if (this.spawnFits(type, pos.x, pos.y, pos.z)) this.spawn(type, pos.x, pos.y, pos.z);
        }
      }
    }
    if (floops < 1 && Math.random() < 0.09) {
      let pos = null;
      const spots = World.floopSpots.filter(s =>
        Math.abs(s.x - p.x) < 60 && Math.abs(s.z - p.z) < 60);
      if (spots.length && Math.random() < 0.5) {
        const s = spots[(Math.random() * spots.length) | 0];
        pos = this.surfaceSpotAt(s.x + (Math.random() * 8 - 4) | 0, s.z + (Math.random() * 8 - 4) | 0);
      } else {
        pos = this.surfaceSpot(p, 14, 30);
      }
      if (pos && this.spawnFits('floop', pos.x, pos.y, pos.z)) {
        const m = this.spawn('floop', pos.x, pos.y, pos.z);
        m.speechT = 2 + Math.random() * 4;
      }
    }
  },

  surfaceSpot(p, minR, maxR) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    // scan from above the player too, so skybase platforms above H get spawns
    return this.surfaceSpotAt(Math.round(p.x + Math.cos(a) * r), Math.round(p.z + Math.sin(a) * r), Math.floor(p.y) + 24);
  },

  surfaceSpotAt(x, z, topHint) {
    if (!World.hasChunk(x, z)) return null;
    const top = Math.max(World.H - 2, Math.floor(topHint || 0));
    for (let y = top; y > 1; y--) {
      const id = World.getBlock(x, y, z);
      if (id !== B.AIR) {
        if (isFluid(id)) return null;
        return { x: x + 0.5, y: y + 1.02, z: z + 0.5 };
      }
    }
    return null;
  },

  // ---------- save/load ----------
  // A mob is "persistent" (kept dormant rather than deleted when far) if it is a passive
  // land/ocean creature. Hostiles, jelly (own home system), floops (single), fireflies and
  // spiders keep their old despawn behaviour so they can't pile up in the dormant store.
  isPersistentType(t) {
    if (HOSTILES.includes(t) || JELLY_MOB_TYPES.includes(t)) return false;
    if (t === 'floop' || t === 'firefly' || t === 'spider' || t === 'lavaback') return false;
    const od = OCEAN_MOB_DEFS[t];
    if (od && od.hostile) return false;
    return true;
  },

  dormantKey(x, z) { return Math.floor(Math.floor(x) / 16) + ',' + Math.floor(Math.floor(z) / 16); },

  serializeMob(m) {
    return {
      t: m.type, x: +m.body.x.toFixed(1), y: +m.body.y.toFixed(1), z: +m.body.z.toFixed(1),
      hp: Number.isFinite(+m.hp) ? +m.hp : this.mobMaxHp(m.type), g: m.gunId || 0, c: m.color || 0, apt: +(m.angryPlayerT || 0).toFixed(1),
      home: m.jellyHome || '', jid: m.jellyId || '', hid: m.homeHouseId || '', mem: m.membership || '', jsrc: m.membershipSource || '',
    };
  },

  // true when (x,z) is beyond the 80-block sim radius of the local player AND every remote player
  farFromAllPlayers(x, y, z) {
    const p = Player && Player.body;
    if (!p) return false;
    const d = this.farDelta({ x, y, z }, p);
    if (Math.sqrt(d.x * d.x + d.z * d.z) <= 80) return false;
    if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'host' && Multiplayer.isEntityNearAnyPlayer
        && Multiplayer.isEntityNearAnyPlayer(x, y, z, 80)) return false;
    return true;
  },

  stashDormantData(s) {
    if (!s) return;
    const key = this.dormantKey(s.x, s.z);
    let arr = this.dormant.get(key);
    if (!arr) { arr = []; this.dormant.set(key, arr); }
    arr.push(s);
    this._dormantCount++;
    // hard cap: a long trek can't grow the store forever — drop the oldest-touched chunk
    while (this._dormantCount > this.DORMANT_CAP && this.dormant.size) {
      const oldest = this.dormant.keys().next().value;
      this._dormantCount -= (this.dormant.get(oldest) || []).length;
      this.dormant.delete(oldest);
    }
  },

  stashDormant(m) { this.stashDormantData(this.serializeMob(m)); },

  reviveMobData(s) {
    const m = this.spawn(s.t, s.x, s.y, s.z, s.g || null, s.c || null);
    if (!m) return;
    m.hp = Number.isFinite(+s.hp) ? +s.hp : this.mobMaxHp(m.type);
    this.repairMobHealth(m);
    m.angryPlayerT = s.apt || 0;
  },

  // revive dormant mobs whose chunk is loaded and back near a player (72<80 hysteresis
  // vs the cull distance so a mob at the boundary doesn't thrash between the two states)
  reviveDormantNearby(dt) {
    if (!this.dormant.size) return;
    this._reviveT -= (dt || 0);
    if (this._reviveT > 0) return;
    this._reviveT = 0.25;
    const p = Player && Player.body;
    if (!p) return;
    const hostMp = typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'host' && Multiplayer.isEntityNearAnyPlayer;
    for (const [key, arr] of [...this.dormant]) {
      const parts = key.split(',');
      const bx = (+parts[0]) * 16 + 8, bz = (+parts[1]) * 16 + 8;
      if (!World.hasChunk(bx, bz)) continue;
      const d = this.farDelta({ x: bx, y: p.y, z: bz }, p);
      const near = Math.sqrt(d.x * d.x + d.z * d.z) < 72;
      if (!near && !(hostMp && Multiplayer.isEntityNearAnyPlayer(bx, p.y, bz, 72))) continue;
      this.dormant.delete(key);
      this._dormantCount -= arr.length;
      for (const s of arr) this.reviveMobData(s);
    }
  },

  serialize() {
    const out = this.list.filter(m => !m.dead).map(m => this.serializeMob(m));
    for (const arr of this.dormant.values()) for (const s of arr) out.push(s);
    return out;
  },

  deserialize(arr) {
    this.dormant = new Map(); this._dormantCount = 0;
    let loadedFloop = false;
    for (const s of arr || []) {
      if (s.t === 'spider') continue;
      if (s.t === 'floop') {
        if (loadedFloop || this.liveFloops().length > 0) continue;
        loadedFloop = true;
      }
      // passive mobs far from every player load straight into the dormant store (no mesh),
      // so a large saved herd doesn't all spawn at once; they revive when a player returns
      if (this.isPersistentType(s.t) && this.farFromAllPlayers(s.x, s.y, s.z)) { this.stashDormantData(s); continue; }
      const m = this.spawn(s.t, s.x, s.y, s.z, s.g || null, s.c || null);
      m.hp = Number.isFinite(+s.hp) ? +s.hp : this.mobMaxHp(m.type);
      this.repairMobHealth(m);
      m.angryPlayerT = s.apt || 0;
      if ((m.type === 'jelly' || m.type === 'big_jelly') && typeof Jelly !== 'undefined') {
        m.jellyId = s.jid || m.jellyId || Jelly.newJellyId();
        m.homeHouseId = s.hid || null;
        m.membership = s.mem || (m.homeHouseId ? 'outside_member' : 'homeless');
        m.membershipSource = s.jsrc || 'save';
        if (!m.homeHouseId && s.home && Jelly.getHouseByKey(s.home)) m.homeHouseId = Jelly.getHouseByKey(s.home).id;
        m.jellyHome = m.homeHouseId ? (Jelly.getHouseKeyById(m.homeHouseId) || '') : '';
        if (m.type === 'big_jelly') Jelly.initMob(m, 'save_big');
        else if (!m.homeHouseId) Jelly.makeHomeless(m, 'save');
        m.fromSpawner = '';
      }
    }
    this.enforceSingleFloop();
  },
};
