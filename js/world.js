// ============================================================
// F_Floop Craft — world: biomes, terrain, lighting engine,
// structures, dungeons, meshing, raycast, explosions
// ============================================================

const LORE = [
  '"Day 1. I arrived. The snow reminded me of home.\nMerry Christmas." — M.F.',
  '"They keep asking if I am an alien. I keep asking\nif they have heard the good word:\nbrrr brrr patapim." — M.F.',
  '"My saucer broke on the way in. It runs on diamonds.\nThat is why I built the casino. Efficient." — M.F.',
  '"Every block you mine, I hear it.\nEvery single one.\nMerry Christmas." — M.F.',
  '"Patapim is not a word. It is a place.\nIt is a feeling. It is, technically, a Tuesday." — M.F.',
  '"I have been here 400 years.\nChristmas has not arrived once.\nI say it anyway. Hope is free." — M.F.',
  '"The skeletons fear me. The creepers respect me.\nThe chickens... the chickens are new. Curious." — M.F.',
  '"If you find my casino: the odds are fair*.\n(*fair by Floopian law)" — M.F.',
  '"The green ore sings at night. The red ore hums carols.\nThe purple ore... do not lick the purple ore." — M.F.',
  '"This monument marks where my nose first touched\nyour soil. It is a very significant nose." — M.F.',
  '"The Humbugs followed me here. Gray. Joyless.\nThey hate the casino. They hate christmas.\nThey hate patapim MOST of all." — M.F.',
  '"If a gray one points metal at you that goes BANG:\nrun. Or shout MERRY CHRISTMAS. It burns them.\n(it does not. it annoys them. run.)" — M.F.',
  '"I buried rooms beneath the ground. Old rooms.\nFull of powder and presents.\nThe Humbugs dig for them. Dig faster." — M.F.',
  '"Some nights the stars fall. Catch them.\nThey are warm. They remember being wished on." — M.F.',
  '"There is a thing in the dark that says TUNG.\nIt says it three times. Then SAHUR.\nI do not open the door." — M.F.',
  '"Colored doors below the ground do not open for courage.\nThey open for keys. Courage helps after." — M.F.',
];
const LORE_SILENT = 'The stone is silent.\nWhatever it remembered, it remembered somewhere else.\n\n(Lore stones only speak where they were first placed.)';

const World = {
  H: 80, SEA: 30, R: 4,
  CHUNK_H: 16,
  VERTICAL_RENDER_RADIUS: 5,
  seed: 1337,
  dimensionId: 'overworld',
  chunks: new Map(),
  featureCache: new Map(),
  structCellCache: new Map(),
  dungeonCache: new Map(),
  dungeonConquered: new Set(),
  structSeen: new Set(),
  floopSpots: [],
  dungeonSpots: [],
  dirty: new Set(),
  lights: new Map(),
  megaTorches: new Set(),   // "x,y,z" — 100-block spawn suppression
  fires: new Map(),         // "x,y,z" -> {t}
  saplings: new Map(),
  crops: new Map(),          // "x,y,z" -> {id,t}
  plantationOrigins: new Map(), // "x,y,z" -> center key of the real 3x3 Plantation Pot placement
  plantationUnderSlabs: new Map(), // "x,y,z" -> lower-half slab id preserved under raised Plantation Pot cells
  signs: new Map(),
  signDirs: new Map(),      // "x,y,z" -> {d:0..7, w:0|1}
  signSprites: new Map(),
  furnaces: new Map(),
  chests: new Map(),
  spawners: new Map(),      // "x,y,z" -> {type, cd} — monster spawners only
  jellyHouses: new Map(),   // "x,y,z" -> JellyHouseRecord
  jellyHouseIds: new Map(), // house id -> "x,y,z"
  loreMap: new Map(),
  diffs: new Map(),
  diffIndex: new Map(),   // chunkKey -> Map(pkey -> id): fast replay at chunk gen
  bedDirs: new Map(),     // "x,y,z" -> 0..3 (facing stored at placement, no neighbor guessing)
  photoDirs: new Map(),   // "x,y,z" -> 0..3 (Mr Floop block top/bottom rotation)
  stairSideways: new Map(), // "x,y,z" -> {nx,nz,side:1|2} for wall-mounted sideways stairs
  relightQueue: new Set(),// chunks queued for a full light recompute (emitter removal safety net)
  ready: false,
  grassSweepCursor: 0,
  matSolid: null, matCutout: null, matWater: null, matLava: null, matPhoto: null,
  dayFUniform: { value: 1 },
  scene: null,
  visibleSectionY: 0,

  init(scene, seed) {
    this.scene = scene;
    this.seed = seed;
    this.dimensionId = 'overworld';
    this.chunks.clear(); this.featureCache.clear(); this.structCellCache.clear();
    this.dungeonCache.clear(); this.dungeonConquered.clear(); this.structSeen.clear(); this.dirty.clear();
    this.lights.clear(); this.saplings.clear(); this.crops.clear(); this.plantationOrigins.clear(); this.plantationUnderSlabs.clear(); this.loreMap.clear(); this.diffs.clear();
    this.megaTorches.clear(); this.fires.clear();
    this.floopSpots.length = 0; this.dungeonSpots.length = 0;
    this.signs.clear(); this.furnaces.clear(); this.chests.clear(); this.signDirs.clear();
    this.spawners.clear(); this.jellyHouses.clear(); this.jellyHouseIds.clear(); this.diffIndex.clear(); this.bedDirs.clear(); this.photoDirs.clear(); this.stairSideways.clear(); this.relightQueue.clear();
    if (typeof Jelly !== 'undefined' && Jelly.resetStorageCache) Jelly.resetStorageCache();
    for (const s of this.signSprites.values()) scene.remove(s);
    this.signSprites.clear();
    this.ready = false;
    this.grassSweepCursor = 0;
    if (!this.matSolid) {
      const lightPatch = (mat) => {
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.dayF = this.dayFUniform;
          sh.vertexShader = 'uniform float dayF;\n' + sh.vertexShader.replace(
            '#include <color_vertex>',
            `#include <color_vertex>
            {
              float lb = vColor.g;
              float ls = vColor.b * dayF;
              float l = max(max(lb, ls), 0.045);
              vColor = vec3(vColor.r * l);
            }`
          );
        };
        return mat;
      };
      this.matSolid = lightPatch(new THREE.MeshBasicMaterial({ map: Atlas.texture, vertexColors: true }));
      this.matCutout = lightPatch(new THREE.MeshBasicMaterial({ map: Atlas.texture, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide }));
      this.matWater = lightPatch(new THREE.MeshBasicMaterial({
        map: Atlas.texture, vertexColors: true, transparent: true, opacity: 0.72,
        side: THREE.DoubleSide, depthWrite: false,
      }));
      this.matLava = lightPatch(new THREE.MeshBasicMaterial({
        map: Atlas.texture, vertexColors: true, side: THREE.DoubleSide,
      }));
      // Photo blocks use an embedded 512x512 DataTexture instead of loading
      // the PNG at runtime. This keeps the placed block visible even when the
      // game is opened directly from disk and avoids the old black WebGL texture.
      this.matPhoto = PhotoBlocks.material(B.MR_FLOOP_DRINKING_WATER);
    }
  },

  key(cx, cz) { return cx + ',' + cz; },
  pkey(x, y, z) { return x + ',' + y + ',' + z; },
  idx(x, y, z) { return (y << 8) + (z << 4) + x; },
  isBaseY(y) { return y >= 0 && y < this.H; },

  extraBlock(ch, x, y, z) {
    if (!ch || !ch.extraBlocks) return B.AIR;
    return ch.extraBlocks.get(this.pkey(x, y, z)) || B.AIR;
  },

  setExtraBlock(ch, x, y, z, id) {
    if (!ch) return;
    const k = this.pkey(x, y, z);
    if (id === B.AIR || id === 0) {
      if (ch.extraBlocks) {
        ch.extraBlocks.delete(k);
        if (!ch.extraBlocks.size) ch.extraBlocks = null;
      }
      return;
    }
    if (!ch.extraBlocks) ch.extraBlocks = new Map();
    ch.extraBlocks.set(k, id);
  },

  getBlock(x, y, z) {
    if (y < 0) return B.AIR; // below the generated world is true void, not invisible bedrock
    const ch = this.chunks.get(this.key(x >> 4, z >> 4));
    if (!ch) return y < this.H ? B.STONE : B.AIR;
    if (y < this.H) return ch.blocks[this.idx(x & 15, y, z & 15)];
    return this.extraBlock(ch, x, y, z);
  },

  hasChunk(x, z) { return this.chunks.has(this.key(x >> 4, z >> 4)); },

  // ---------- lighting (0-15 sky & block channels) ----------
  _opaqueLUT: null, // id -> 0/1, built once (all defBlock calls happen at load)
  opaqueToLight(id) {
    let t = this._opaqueLUT;
    if (!t) {
      t = this._opaqueLUT = new Uint8Array(1024);
      for (const k of Object.keys(Reg)) {
        const d = Reg[+k];
        if (d && d.block && d.opaque && d.shape === 'cube') t[+k] = 1;
      }
    }
    return t[id] === 1;
  },

  lightEmit(id) {
    const d = Reg[id];
    return d && d.lightLevel ? d.lightLevel : 0;
  },

  getLightRaw(x, y, z) {
    if (y >= this.H) return 0xF0;
    if (y < 0) return 0;
    const ch = this.chunks.get(this.key(x >> 4, z >> 4));
    if (!ch) return 0xF0;
    // A loaded chunk with light temporarily cleared for a relight pass must not
    // behave like open sky. Treating it as 15 skylight was re-seeding stale cave
    // light from chunks waiting to be recomputed after a roof hole got patched.
    if (!ch.light) return 0;
    return ch.light[this.idx(x & 15, y, z & 15)];
  },

  getSkyLight(x, y, z) { return this.getLightRaw(x, y, z) >> 4; },
  getBlockLight(x, y, z) { return this.getLightRaw(x, y, z) & 15; },

  computeChunkLight(ch) {
    const H = this.H;
    const L = ch.light = new Uint8Array(16 * 16 * H);
    const blocks = ch.blocks;
    const X0 = ch.cx * 16, Z0 = ch.cz * 16;
    const qx = [], qy = [], qz = [], ql = [], qc = []; // BFS stack (channel: 0 sky, 1 block)

    // sky columns + block sources.
    // Only sky cells at TERRAIN STEPS join the BFS queue (a flat chunk used to
    // queue ~11k cells and spike chunk loading; steps are where lateral spread matters)
    const skyTop = new Int16Array(256); // first sky cell index per column
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        let open = true;
        let top = H;
        for (let y = H - 1; y >= 0; y--) {
          const id = blocks[this.idx(lx, y, lz)];
          if (open && this.opaqueToLight(id)) { open = false; top = y + 1; }
          if (open) L[this.idx(lx, y, lz)] = 0xF0;
          const em = this.lightEmit(id);
          if (em > 0) {
            L[this.idx(lx, y, lz)] = (L[this.idx(lx, y, lz)] & 0xF0) | em;
            qx.push(lx); qy.push(y); qz.push(lz); ql.push(em); qc.push(1);
          }
        }
        if (open) top = 0; // column open to bedrock
        skyTop[lz * 16 + lx] = top;
      }
    }
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const myTop = skyTop[lz * 16 + lx];
        let maxNb = myTop;
        if (lx > 0) maxNb = Math.max(maxNb, skyTop[lz * 16 + lx - 1]);
        if (lx < 15) maxNb = Math.max(maxNb, skyTop[lz * 16 + lx + 1]);
        if (lz > 0) maxNb = Math.max(maxNb, skyTop[(lz - 1) * 16 + lx]);
        if (lz < 15) maxNb = Math.max(maxNb, skyTop[(lz + 1) * 16 + lx]);
        // chunk-edge columns always seed (the neighbor chunk may sit lower)
        if (lx === 0 || lx === 15 || lz === 0 || lz === 15) maxNb = Math.min(H, maxNb + 2);
        for (let y = myTop; y < maxNb && y < H; y++) {
          qx.push(lx); qy.push(y); qz.push(lz); ql.push(15); qc.push(0);
        }
      }
    }
    // Soft daylight edge spill. Direct sky columns stay at 15, but light that
    // leaks sideways under a roof is capped and then attenuates normally. This
    // keeps small overhangs from going pitch black without letting one tiny roof
    // hole flood an entire cave with full daylight.
    const hDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const SKY_EDGE_SPILL = 10;
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      for (let y = 0; y < H; y++) {
        const i = this.idx(lx, y, lz);
        if ((L[i] >> 4) !== 15) continue;
        for (const [dx, dz] of hDirs) {
          const nx = lx + dx, nz = lz + dz;
          if (nx < 0 || nx > 15 || nz < 0 || nz > 15) continue;
          const ni = this.idx(nx, y, nz);
          if (!this.opaqueToLight(blocks[ni]) && (L[ni] >> 4) < SKY_EDGE_SPILL) {
            qx.push(nx); qy.push(y); qz.push(nz); ql.push(SKY_EDGE_SPILL); qc.push(0);
          }
        }
      }
    }
    // seed from neighbor chunk borders
    const seedFrom = (lx, y, lz, nx, nz) => {
      const raw = this.getLightRaw(X0 + nx, y, Z0 + nz);
      const s = (raw >> 4) - 1, b = (raw & 15) - 1;
      if (s > 0) { qx.push(lx); qy.push(y); qz.push(lz); ql.push(s); qc.push(0); }
      if (b > 0) { qx.push(lx); qy.push(y); qz.push(lz); ql.push(b); qc.push(1); }
    };
    const nW = this.chunks.get(this.key(ch.cx - 1, ch.cz));
    const nE = this.chunks.get(this.key(ch.cx + 1, ch.cz));
    const nN = this.chunks.get(this.key(ch.cx, ch.cz - 1));
    const nS = this.chunks.get(this.key(ch.cx, ch.cz + 1));
    for (let y = 0; y < H; y++) {
      for (let l = 0; l < 16; l++) {
        if (nW && nW.light) seedFrom(0, y, l, -1, l);
        if (nE && nE.light) seedFrom(15, y, l, 16, l);
        if (nN && nN.light) seedFrom(l, y, 0, l, -1);
        if (nS && nS.light) seedFrom(l, y, 15, l, 1);
      }
    }

    // flood fill (within this chunk only)
    while (qx.length) {
      const x = qx.pop(), y = qy.pop(), z = qz.pop(), lvl = ql.pop(), c = qc.pop();
      const i = this.idx(x, y, z);
      const id = blocks[i];
      if (this.opaqueToLight(id) && this.lightEmit(id) === 0) continue;
      const cur = c === 0 ? (L[i] >> 4) : (L[i] & 15);
      if (lvl < cur) continue;
      if (lvl > cur) L[i] = c === 0 ? ((lvl << 4) | (L[i] & 15)) : ((L[i] & 0xF0) | lvl);
      if (lvl <= 1) continue;
      const spread = (nx, ny, nz, nl) => {
        if (nx < 0 || nx > 15 || nz < 0 || nz > 15 || ny < 0 || ny >= H) return;
        const ni = this.idx(nx, ny, nz);
        if (this.opaqueToLight(blocks[ni])) return;
        const ncur = c === 0 ? (L[ni] >> 4) : (L[ni] & 15);
        if (nl > ncur) { qx.push(nx); qy.push(ny); qz.push(nz); ql.push(nl); qc.push(c); }
      };
      // BFS sky spill attenuates in every direction. Direct sky columns are
      // filled separately above; this prevents one roof hole from flooding caves.
      spread(x, y - 1, z, lvl - 1);
      spread(x, y + 1, z, lvl - 1);
      spread(x + 1, y, z, lvl - 1);
      spread(x - 1, y, z, lvl - 1);
      spread(x, y, z + 1, lvl - 1);
      spread(x, y, z - 1, lvl - 1);
    }
  },

  // ---------- incremental lighting (BFS add/remove, crosses chunk borders) ----------
  getChLight(x, y, z, channel) {
    if (y < 0) return 0;
    if (y >= this.H) return channel === 0 ? 15 : 0;
    const ch = this.chunks.get(this.key(x >> 4, z >> 4));
    if (!ch) return channel === 0 ? 15 : 0;
    // During grouped relights, loaded chunks may intentionally have null light.
    // Do not let them seed fake sky/block light into neighboring cave cells.
    if (!ch.light) return 0;
    const v = ch.light[this.idx(x & 15, y, z & 15)];
    return channel === 0 ? (v >> 4) : (v & 15);
  },

  setChLight(x, y, z, channel, lvl, touched) {
    if (y < 0 || y >= this.H) return;
    const ch = this.chunks.get(this.key(x >> 4, z >> 4));
    if (!ch || !ch.light) return;
    const i = this.idx(x & 15, y, z & 15);
    const v = ch.light[i];
    ch.light[i] = channel === 0 ? ((lvl << 4) | (v & 15)) : ((v & 0xF0) | lvl);
    if (touched) {
      touched.add(this.key(ch.cx, ch.cz));
      // border light changes affect the neighbor's mesh too (faces sample across)
      const lx = x & 15, lz = z & 15;
      if (lx === 0) touched.add(this.key(ch.cx - 1, ch.cz));
      if (lx === 15) touched.add(this.key(ch.cx + 1, ch.cz));
      if (lz === 0) touched.add(this.key(ch.cx, ch.cz - 1));
      if (lz === 15) touched.add(this.key(ch.cx, ch.cz + 1));
    }
  },

  transparentToLight(x, y, z) { return !this.opaqueToLight(this.getBlock(x, y, z)); },

  LIGHT_DIRS: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],

  lightAdd(queue, channel, touched) {
    // level-bucketed flood (15 -> 1): every cell is finalized at most once.
    // The old stack (pop = depth-first) re-relaxed big open regions over and
    // over — one chunk bordering a large cave could take SECONDS to light.
    const H = this.H;
    const buckets = [];
    for (let i = 0; i <= 15; i++) buckets.push([]);
    for (const n of queue) {
      if (n.l >= 1) buckets[Math.min(15, n.l)].push(n);
    }
    queue.length = 0;
    // per-call chunk cache: BFS cells cluster, no string key + Map.get per cell
    let cKey = null, cCh = null;
    const chunkAt = (x, z) => {
      const k = (x >> 4) + ',' + (z >> 4);
      if (k !== cKey) { cKey = k; cCh = this.chunks.get(k); }
      return cCh;
    };
    for (let lvl = 15; lvl >= 1; lvl--) {
      const bq = buckets[lvl];
      for (let qi = 0; qi < bq.length; qi++) {
        const n = bq[qi];
        const ch = n.ch || chunkAt(n.x, n.z); // pushed nodes carry their chunk
        if (!ch || !ch.light) continue;
        const i = this.idx(n.x & 15, n.y, n.z & 15);
        const v = ch.light[i];
        const cur = channel === 0 ? (v >> 4) : (v & 15);
        if (lvl <= cur) continue;
        ch.light[i] = channel === 0 ? ((lvl << 4) | (v & 15)) : ((v & 0xF0) | lvl);
        if (touched) {
          touched.add(this.key(ch.cx, ch.cz));
          const lx = n.x & 15, lz = n.z & 15;
          if (lx === 0) touched.add(this.key(ch.cx - 1, ch.cz));
          if (lx === 15) touched.add(this.key(ch.cx + 1, ch.cz));
          if (lz === 0) touched.add(this.key(ch.cx, ch.cz - 1));
          if (lz === 15) touched.add(this.key(ch.cx, ch.cz + 1));
        }
        if (lvl <= 1) continue;
        for (const [dx, dy, dz] of this.LIGHT_DIRS) {
          const nx = n.x + dx, ny = n.y + dy, nz = n.z + dz;
          if (ny < 0 || ny >= H) continue;
          // same-chunk fast path; only border hops pay a lookup
          const nch = ((nx >> 4) === ch.cx && (nz >> 4) === ch.cz) ? ch : chunkAt(nx, nz);
          if (!nch || !nch.light) continue;
          const ni = this.idx(nx & 15, ny, nz & 15);
          if (this.opaqueToLight(nch.blocks[ni])) continue;
          const nl = lvl - 1; // direct sky columns are handled by full recompute, not flood-fill
          const nv = nch.light[ni];
          const ncur = channel === 0 ? (nv >> 4) : (nv & 15);
          if (nl > ncur) buckets[nl].push({ x: nx, y: ny, z: nz, l: nl, ch: nch });
        }
      }
    }
  },

  lightRemove(sx, sy, sz, channel, touched) {
    const oldL = this.getChLight(sx, sy, sz, channel);
    if (oldL === 0) return;
    this.setChLight(sx, sy, sz, channel, 0, touched);
    const removeQ = [{ x: sx, y: sy, z: sz, l: oldL }];
    const relight = [];
    while (removeQ.length) {
      const n = removeQ.pop();
      for (const [dx, dy, dz] of this.LIGHT_DIRS) {
        const nx = n.x + dx, ny = n.y + dy, nz = n.z + dz;
        if (ny < 0 || ny >= this.H) continue;
        const nl = this.getChLight(nx, ny, nz, channel);
        if (nl === 0) continue;
        // did this neighbor's light come from us?
        const derived = nl < n.l || (channel === 0 && dy === -1 && n.l === 15 && nl === 15);
        if (derived) {
          this.setChLight(nx, ny, nz, channel, 0, touched);
          removeQ.push({ x: nx, y: ny, z: nz, l: nl });
        } else {
          relight.push({ x: nx, y: ny, z: nz, l: nl });
        }
      }
    }
    this.lightAdd(relight, channel, touched);
  },

  lightOnBlockChanged(x, y, z, oldId, newId) {
    if (y < 0 || y >= this.H) return;
    const ch = this.chunks.get(this.key(x >> 4, z >> 4));
    if (!ch || !ch.light) return;
    const oldEm = this.lightEmit(oldId), newEm = this.lightEmit(newId);
    const oldOp = this.opaqueToLight(oldId), newOp = this.opaqueToLight(newId);
    if (oldEm === newEm && oldOp === newOp) return;

    const touched = new Set();
    // tear down whatever light lived here (handles removed sources & new walls)
    this.lightRemove(x, y, z, 0, touched);
    this.lightRemove(x, y, z, 1, touched);

    if (!newOp) {
      // pull surrounding light back into this now-open cell
      const q0 = [], q1 = [];
      for (const [dx, dy, dz] of this.LIGHT_DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const s = this.getChLight(nx, ny, nz, 0);
        const b = this.getChLight(nx, ny, nz, 1);
        const sCand = (dy === 1 && s === 15) ? 15 : s - 1;
        if (sCand > 0) q0.push({ x, y, z, l: sCand });
        if (b - 1 > 0) q1.push({ x, y, z, l: b - 1 });
      }
      this.lightAdd(q0, 0, touched);
      this.lightAdd(q1, 1, touched);
    }
    if (newEm > 0) this.lightAdd([{ x, y, z, l: newEm }], 1, touched);

    // Removed a light source or changed skylight blocking? Queue a full
    // verification recompute of the area.  This keeps daylight spread correct
    // after placing/removing ceiling blocks instead of leaving harsh black cells.
    if ((oldEm > 0 && newEm !== oldEm) || oldOp !== newOp) {
      const seen = new Set();
      // Queue only the changed chunk and actual border neighbors. A 3x3 chunk
      // verification on every block break was the main hitch; lightAdd/lightRemove
      // already propagates the real local update across chunk borders.
      const relightChunk = (ccx, ccz) => {
        const rk = this.key(ccx, ccz);
        if (!seen.has(rk)) { seen.add(rk); this.relightQueue.add(rk); }
      };
      const ccx = x >> 4, ccz = z >> 4;
      relightChunk(ccx, ccz);
      const lx = x & 15, lz = z & 15;
      if (lx === 0) relightChunk(ccx - 1, ccz);
      if (lx === 15) relightChunk(ccx + 1, ccz);
      if (lz === 0) relightChunk(ccx, ccz - 1);
      if (lz === 15) relightChunk(ccx, ccz + 1);
    }

    for (const k of touched) {
      const c2 = this.chunks.get(k);
      if (c2 && c2.hasMesh) this.dirty.add(k);
    }
  },

  // push a freshly-lit chunk's border light into already-lit neighbors
  borderPush(ch) {
    const X0 = ch.cx * 16, Z0 = ch.cz * 16;
    const touched = new Set();
    for (const channel of [0, 1]) {
      const q = [];
      const feed = (x, y, z, nx, nz) => {
        const l = this.getChLight(x, y, z, channel);
        if (l <= 1) return;
        const nb = this.chunks.get(this.key(nx >> 4, nz >> 4));
        if (!nb || !nb.light || nb === ch) return;
        if (!this.transparentToLight(nx, y, nz)) return;
        if (l - 1 > this.getChLight(nx, y, nz, channel)) q.push({ x: nx, y, z: nz, l: l - 1 });
      };
      for (let y = 0; y < this.H; y++) {
        for (let i = 0; i < 16; i++) {
          feed(X0, y, Z0 + i, X0 - 1, Z0 + i);
          feed(X0 + 15, y, Z0 + i, X0 + 16, Z0 + i);
          feed(X0 + i, y, Z0, X0 + i, Z0 - 1);
          feed(X0 + i, y, Z0 + 15, X0 + i, Z0 + 16);
        }
      }
      this.lightAdd(q, channel, touched);
    }
    for (const k of touched) {
      const c2 = this.chunks.get(k);
      if (c2 && c2.hasMesh) this.dirty.add(k);
    }
  },

  setBlock(x, y, z, id, opts) {
    opts = opts || {};
    if (y < 0) return;
    const cx = x >> 4, cz = z >> 4;
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return;
    const baseY = y < this.H;
    const old = baseY ? ch.blocks[this.idx(x & 15, y, z & 15)] : this.extraBlock(ch, x, y, z);
    if (old === id) return;
    if (baseY) ch.blocks[this.idx(x & 15, y, z & 15)] = id;
    else this.setExtraBlock(ch, x, y, z, id);
    if (this.ready && old !== id && id !== old && typeof Dynamics !== 'undefined' && Dynamics.isLogId && Dynamics.isLogId(old) && !Dynamics.isLogId(id)) {
      Dynamics.queueLeafDecay(x, y, z);
    }
    if (this.ready) {
      const pk = this.pkey(x, y, z);
      this.diffs.set(pk, id);
      const ck = this.key(cx, cz);
      if (!this.diffIndex.has(ck)) this.diffIndex.set(ck, new Map());
      this.diffIndex.get(ck).set(pk, id);
    }

    this.dirty.add(this.key(cx, cz));
    const lx = x & 15, lz = z & 15;
    if (lx === 0) this.dirty.add(this.key(cx - 1, cz));
    if (lx === 15) this.dirty.add(this.key(cx + 1, cz));
    if (lz === 0) this.dirty.add(this.key(cx, cz - 1));
    if (lz === 15) this.dirty.add(this.key(cx, cz + 1));

    this.updateRegistries(x, y, z, old, id, opts);

    // Any block/shape replacement should clear stored crack progress for that
    // cell. Keep this extremely cheap: most block changes happen when no stored
    // cracks exist, and setBlock can run many times in one frame.
    if (typeof Player !== 'undefined' && Player && Player.mineDamage && Player.mineDamage.size && typeof Player.clearBreakDamageAt === 'function') {
      Player.clearBreakDamageAt(x, y, z);
    }

    if (!opts.skipPortalCheck && typeof Dimensions !== 'undefined' && Dimensions.checkPortalFramesNearBlock) {
      if (old === B.EMERALD_BLOCK || old === B.OBSIDIAN || id === B.EMERALD_BLOCK || id === B.OBSIDIAN) {
        Dimensions.checkPortalFramesNearBlock(x, y, z);
      }
    }

    // incremental light update (only touches the cells that actually change)
    this.lightOnBlockChanged(x, y, z, old, id);

    if (typeof Multiplayer !== 'undefined' && Multiplayer.onLocalBlockChange) {
      Multiplayer.onLocalBlockChange(x, y, z, id, opts, old);
    }

    if (!opts.noUpdate) {
      Water.schedule(x, y, z);
      Water.schedule(x + 1, y, z); Water.schedule(x - 1, y, z);
      Water.schedule(x, y + 1, z); Water.schedule(x, y - 1, z);
      Water.schedule(x, y, z + 1); Water.schedule(x, y, z - 1);
      Lava.schedule(x, y, z);
      Lava.schedule(x + 1, y, z); Lava.schedule(x - 1, y, z);
      Lava.schedule(x, y + 1, z); Lava.schedule(x, y - 1, z);
      Lava.schedule(x, y, z + 1); Lava.schedule(x, y, z - 1);
      this.checkSupports(x, y, z, id);
    }
  },

  updateRegistries(x, y, z, oldId, newId, opts) {
    const k = this.pkey(x, y, z);
    const wasLight = Reg[oldId] && Reg[oldId].light;
    const isLight = Reg[newId] && Reg[newId].light;
    if (wasLight && !isLight) this.lights.delete(k);
    if (isLight) this.lights.set(k, [x, y, z]);
    if (oldId === B.MEGA_TORCH && newId !== B.MEGA_TORCH) this.megaTorches.delete(k);
    if (newId === B.MEGA_TORCH) this.megaTorches.add(k);
    if (oldId === B.FIRE && newId !== B.FIRE) this.fires.delete(k);
    if (newId === B.FIRE) this.fires.set(k, { t: 4 + Math.random() * 5 });
    if (isSapling(oldId) && !isSapling(newId)) this.saplings.delete(k);
    if (isSapling(newId)) this.saplings.set(k, { id: newId, t: 25 + Math.random() * 50 });
    if (isCrop(oldId) && !isCrop(newId)) this.crops.delete(k);
    if (isCrop(newId)) this.crops.set(k, { id: newId, t: 35 + Math.random() * 55 });
    if (isPlanterCell(oldId) && !isPlanterCell(newId)) { this.plantationOrigins.delete(k); this.plantationUnderSlabs.delete(k); }
    if (oldId === B.SIGN && newId !== B.SIGN) {
      this.signs.delete(k);
      this.signDirs.delete(k);
      const spr = this.signSprites.get(k);
      if (spr) { this.scene.remove(spr); this.signSprites.delete(k); }
    }
    if (oldId === B.LORE && newId !== B.LORE) this.loreMap.delete(k);
    if ((oldId === B.FURNACE || oldId === B.FURNACE_LIT) && newId !== B.FURNACE && newId !== B.FURNACE_LIT) {
      const f = this.furnaces.get(k);
      if (f) {
        for (const s of [f.in, f.fuel, f.out]) {
          if (s) Drops.spawn(x + 0.5, y + 0.5, z + 0.5, s.id, s.count, null, s.dur, s.data);
        }
        this.furnaces.delete(k);
      }
    }
    if ((oldId === B.CHEST || oldId === B.LOOT_CRATE || oldId === B.JELLY_CHEST) && newId !== B.CHEST && newId !== B.LOOT_CRATE && newId !== B.JELLY_CHEST) {
      if (oldId === B.JELLY_CHEST && this.ready && typeof Jelly !== 'undefined' && !opts.jellyChestBreakHandled && !(typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client')) {
        Jelly.onChestAccess({ x, y, z, mode: 'break', wasJellyChest: true, oldId });
      }
      const chc = this.chests.get(k);
      if (chc) {
        for (const s of chc) if (s) Drops.spawn(x + 0.5, y + 0.5, z + 0.5, s.id, s.count, null, s.dur, s.data);
        this.chests.delete(k);
      }
    }
    if (isBed(oldId) && !isBed(newId)) this.bedDirs.delete(k);
    if (oldId === B.MR_FLOOP_DRINKING_WATER && newId !== B.MR_FLOOP_DRINKING_WATER) this.photoDirs.delete(k);
    if (isStairs(oldId) && !isStairs(newId)) this.stairSideways.delete(k);
    if (oldId === B.SPAWNER && newId !== B.SPAWNER) this.spawners.delete(k);
    if (oldId === B.JELLY_HOUSE && newId !== B.JELLY_HOUSE && typeof Jelly !== 'undefined' && !opts.jellyHouseBreakHandled) {
      Jelly.onHouseBreak(k, { reason: 'block_removed', drop: false });
    }
    if (newId === B.SPAWNER && !this.spawners.has(k)) {
      this.spawners.set(k, { type: ['skeleton', 'creeper', 'humbug'][(Math.random() * 3) | 0], cd: 3 });
    }
    if (newId === B.JELLY_HOUSE && typeof Jelly !== 'undefined') {
      const hasJellyPlacementData = !!(opts && (opts.jellyHouse || opts.itemData || opts.data || opts.stored || opts.jellyRoster || opts.seedDefault || opts.source));
      if (hasJellyPlacementData || !Jelly.getHouseByKey(k)) {
        Jelly.createHouseAt(x, y, z, {
          itemData: (opts && (opts.jellyHouse || opts.itemData || opts.data)) || null,
          jellyRoster: opts && opts.jellyRoster,
          stored: opts && opts.stored,
          seedDefault: opts && opts.seedDefault,
          source: opts && opts.source || 'placed',
        });
      }
    }
  },

  checkSupports(x, y, z, newId) {
    // Multiplayer: the HOST is authoritative for support cascades (torch/sapling/cactus/
    // plantation drops + falling blocks). If a client also ran this, every support-break
    // double-dropped — the client spawns a drop_request AND the host's relayed break spawns
    // its own. Clients skip it; the resulting block changes + drops sync back from the host.
    if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client') return;
    const solidNow = !!Physics.blockBoxes(newId, x, y, z);
    const above = this.getBlock(x, y + 1, z);

    // Saplings have real soil rules now: normal saplings need dirt/grass,
    // oasis saplings need sand. Replacing the ground under them should pop
    // them off even if the new block is technically solid.
    if (isSapling(above) && !canPlantSaplingOn(above, newId)) {
      this.setBlock(x, y + 1, z, B.AIR);
      Drops.spawn(x + 0.5, y + 1.3, z + 0.5, above, 1);
      return;
    }

    // Plantation Pots are 3x3 multiblocks and every cell needs its own support.
    // If any support block under a cell is removed/invalid, remove the real
    // originally placed 3x3 pot, not a guessed group.
    if (isPlanterCell(above) && !this.plantationUnderSlabs.has(this.pkey(x, y + 1, z)) && !this.isValidPlantationSupport(x, y, z)) {
      this.breakPlantationGroupAt(x, y + 1, z, true);
      return;
    }

    if (solidNow) {
      // sand/gravel placed with nothing below starts falling (handled by caller via Dynamics)
      return;
    }
    // gravity blocks above start falling
    if (Reg[above] && Reg[above].gravity && typeof Dynamics !== 'undefined') {
      Dynamics.startFall(x, y + 1, z, above);
    }
    // a cactus with nothing under it takes the whole stack with it
    if (above === B.CACTUS) {
      let cy = y + 1;
      while (this.getBlock(x, cy, z) === B.CACTUS) {
        this.setBlock(x, cy, z, B.AIR, { noUpdate: true });
        Drops.spawn(x + 0.5, cy + 0.4, z + 0.5, B.CACTUS, 1);
        cy++;
      }
    }
    if (Reg[above] && Reg[above].needsSupport) {
      this.setBlock(x, y + 1, z, B.AIR);
      const dropId = above === B.SIGN ? B.SIGN : isSapling(above) ? above : isFlower(above) ? above : B.TORCH;
      Drops.spawn(x + 0.5, y + 1.3, z + 0.5, dropId, 1);
    }
    for (const [wid, dir] of Object.entries(WTORCH_DIR)) {
      const tx = x + dir[0], tz = z + dir[2];
      if (this.getBlock(tx, y, tz) === +wid) {
        this.setBlock(tx, y, tz, B.AIR);
        Drops.spawn(tx + 0.5, y + 0.4, tz + 0.5, B.TORCH, 1);
      }
    }
    for (const [lid, dir] of Object.entries(LADDER_DIR)) {
      const tx = x + dir[0], tz = z + dir[2];
      if (this.getBlock(tx, y, tz) === +lid) {
        this.setBlock(tx, y, tz, B.AIR);
        Drops.spawn(tx + 0.5, y + 0.4, tz + 0.5, B.LADDER_PX, 1);
      }
    }
    const aboveId = this.getBlock(x, y + 1, z);
    if (isDoor(aboveId) && !isDoorTop(aboveId)) {
      const dropId = Reg[aboveId].drop ? Reg[aboveId].drop.id : I.DOOR;
      this.setBlock(x, y + 1, z, B.AIR);
      this.setBlock(x, y + 2, z, B.AIR);
      Drops.spawn(x + 0.5, y + 1.4, z + 0.5, dropId, 1);
    }
    if (isSnowSheet(above)) {
      this.setBlock(x, y + 1, z, B.AIR);
    }
  },

  initChest(x, y, z, rnd, rich = false, source = 'surface', size = 27) {
    const k = this.pkey(x, y, z);
    if (this.chests.has(k)) return;
    size = Math.max(27, Math.floor(+size || 27));
    // Multiplayer: only the host rolls container loot. Clients must NEVER generate
    // their own chest contents (they'd diverge from the host and hand out infinite
    // loot on reopen). Clients receive the authoritative slots via chest_snapshot.
    if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client') return;
    const slots = new Array(size).fill(null);

    // Surface monuments/houses/towers are meant to be early-game finds.
    // They intentionally do NOT roll diamonds or late-game weapons anymore.
    const SURFACE_LOOT = [
      [I.GUNPOWDER, 1, 3, 0.35], [I.COOKIE, 1, 3, 0.55], [I.STAR, 1, 1, 0.08],
      [I.GOLD_INGOT, 1, 2, 0.12], [I.LIGHT_AMMO, 2, 6, 0.22],
      [I.APPLE, 1, 3, 0.50], [B.TORCH, 2, 6, 0.45], [I.BONE, 1, 2, 0.30],
      [I.FEATHER, 1, 3, 0.30], [B.WOOL, 1, 2, 0.18], [I.ARROW, 2, 6, 0.28],
    ];
    const SURFACE_BONUS = [
      [I.SHELLS, 2, 4, 0.08], [I.HEAVY_AMMO, 1, 3, 0.05],
      [I.DARK_FLOOPIUM, 1, 1, 0.025],
    ];

    const DUNGEON_COMMON = [
      [I.GUNPOWDER, 3, 9, 0.70], [I.COOKIE, 1, 4, 0.50], [I.APPLE, 1, 4, 0.45],
      [B.TORCH, 4, 12, 0.55], [I.BONE, 1, 4, 0.36], [I.ARROW, 4, 12, 0.42],
      [I.LIGHT_AMMO, 4, 12, 0.48], [I.SHELLS, 2, 6, 0.20],
    ];
    const DUNGEON_BY_RANK = {
      green: {
        guaranteed: [[I.IRON_INGOT, 2, 6], [I.GOLD_INGOT, 1, 3]],
        base: [
          [I.EMERALD, 1, 2, 0.25], [I.DIAMOND, 1, 1, 0.12],
          [I.DUNGEON_KEY_GREEN, 1, 1, 0.16], [I.HEAVY_AMMO, 2, 5, 0.16],
          [I.FLOOPIUM, 1, 1, 0.12], [I.PISTOL, 1, 1, 0.04],
        ],
        rich: [
          [I.DIAMOND, 1, 2, 0.32], [I.STAR, 1, 1, 0.14],
          [I.DUNGEON_KEY_BLUE, 1, 1, 0.12], [I.DARK_FLOOPIUM, 1, 1, 0.10],
        ],
      },
      blue: {
        guaranteed: [[I.GOLD_INGOT, 3, 7], [I.EMERALD, 2, 5]],
        base: [
          [I.DIAMOND, 1, 3, 0.40], [I.CHARGE_CELL, 4, 8, 0.36],
          [I.DARK_FLOOPIUM, 1, 1, 0.18], [I.DUNGEON_KEY_GREEN, 1, 1, 0.14],
          [I.DUNGEON_KEY_BLUE, 1, 1, 0.14], [I.HEAVY_AMMO, 4, 10, 0.30],
          [I.SMG, 1, 1, 0.045], [I.RIFLE, 1, 1, 0.035],
        ],
        rich: [
          [I.DIAMOND, 2, 4, 0.50], [B.EMERALD_BLOCK, 1, 1, 0.20],
          [I.DUNGEON_KEY_GOLD, 1, 1, 0.11], [I.CHARGE_CORE, 1, 1, 0.10],
          [I.STAR, 1, 2, 0.18],
        ],
      },
      gold: {
        guaranteed: [[I.DIAMOND, 2, 5], [I.EMERALD, 4, 9]],
        base: [
          [B.EMERALD_BLOCK, 1, 1, 0.30], [I.DARK_FLOOPIUM, 1, 2, 0.38],
          [B.FLOOP_METAL, 1, 3, 0.38], [I.CHARGE_CELL, 6, 14, 0.48],
          [I.PATAPIM_SHARD, 1, 2, 0.20], [I.DUNGEON_KEY_BLUE, 1, 1, 0.18],
          [I.DUNGEON_KEY_GOLD, 1, 1, 0.13], [I.HEAVY_AMMO, 7, 16, 0.46],
          [I.ROCKET, 2, 5, 0.24], [I.BAZOOKA, 1, 1, 0.045],
        ],
        rich: [
          [I.DIAMOND, 4, 8, 0.68], [I.CHARGE_CORE, 1, 2, 0.25],
          [I.DUNGEON_KEY_DIAMOND, 1, 1, 0.07], [I.STAR, 1, 2, 0.28],
          [I.DUNGEON_CORE_SHARD, 1, 1, 0.18], [I.FLOOP_RAY, 1, 1, 0.025],
        ],
      },
      diamond: {
        guaranteed: [[I.DIAMOND, 5, 10], [I.DARK_FLOOPIUM, 2, 4], [I.CHARGE_CELL, 8, 18]],
        base: [
          [B.EMERALD_BLOCK, 1, 2, 0.58], [I.EMERALD, 8, 16, 0.48],
          [B.FLOOP_METAL, 2, 4, 0.62], [I.CHARGE_CORE, 1, 2, 0.38],
          [I.STAR, 1, 3, 0.45], [I.PATAPIM_SHARD, 2, 5, 0.48],
          [I.DUNGEON_KEY_GOLD, 1, 1, 0.24], [I.DUNGEON_KEY_DIAMOND, 1, 1, 0.14],
          [I.HEAVY_AMMO, 12, 28, 0.60], [I.ROCKET, 4, 10, 0.44],
          [I.DIAMOND_HAMMER, 1, 1, 0.08], [I.DIAMOND_EXCAVATOR, 1, 1, 0.08],
        ],
        rich: [
          [I.DIAMOND, 8, 16, 0.95], [B.EMERALD_BLOCK, 2, 4, 0.64],
          [I.DARK_FLOOPIUM, 3, 7, 0.72], [I.CHARGE_CORE, 2, 4, 0.62],
          [I.STAR, 2, 5, 0.58], [I.PATAPIM_SHARD, 4, 8, 0.58],
          [I.DUNGEON_KEY_DIAMOND, 1, 1, 0.22], [I.DUNGEON_CORE_SHARD, 1, 2, 0.40],
          [I.FLOOP_RAY, 1, 1, 0.07], [I.PATAPIM_BEAM, 1, 1, 0.055],
          [I.PATAPIM_DIAMOND_JELLY_HELMET, 1, 1, 0.04],
          [I.PATAPIM_DIAMOND_JELLY_CHEST, 1, 1, 0.035],
          [I.PATAPIM_DIAMOND_JELLY_LEGS, 1, 1, 0.035],
          [I.PATAPIM_DIAMOND_JELLY_BOOTS, 1, 1, 0.04],
        ],
      },
    };

    const dungeonSource = typeof source === 'string' && source.indexOf('dungeon') === 0;
    const dungeonRank = dungeonSource ? ((source.split(':')[1] || 'green').toLowerCase()) : '';
    const profile = DUNGEON_BY_RANK[dungeonRank] || DUNGEON_BY_RANK.green;
    const table = dungeonSource
      ? DUNGEON_COMMON.concat(profile.base, rich ? profile.rich : [])
      : SURFACE_LOOT.concat(rich ? SURFACE_BONUS : []);
    const guaranteed = dungeonSource ? profile.guaranteed : [];

    const putLoot = (id, min, max) => {
      const empty = [];
      for (let i = 0; i < size; i++) if (!slots[i]) empty.push(i);
      if (!empty.length) return false;
      const slot = empty[(rnd() * empty.length) | 0];
      slots[slot] = { id, count: min + ((rnd() * (max - min + 1)) | 0) };
      return true;
    };

    for (const [id, min, max] of guaranteed) putLoot(id, min, max);
    for (const [id, min, max, chance] of table) {
      if (rnd() <= chance) putLoot(id, min, max);
    }
    this.chests.set(k, slots);
  },

  // ---------- biomes & terrain ----------
  _clamp01(v) { return Math.max(0, Math.min(1, v)); },
  _smoothstep(a, b, x) {
    const t = this._clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  },
  _lerp(a, b, t) { return a + (b - a) * t; },

  biomeNoiseAt(x, z) {
    return {
      t: NoiseGen.fbm2(this.seed + 8181, x * 0.0022, z * 0.0022, 3, 2, 0.5),
      m: NoiseGen.fbm2(this.seed + 8282, x * 0.0025, z * 0.0025, 3, 2, 0.5),
    };
  },

  desertBlendAt(x, z) {
    const n = this.biomeNoiseAt(x, z);
    // Old terrain snapped to the desert formula the instant these thresholds were
    // crossed. This soft mask blends the desert height over a wide border instead.
    const warm = this._smoothstep(0.47, 0.59, n.t);
    const dry = 1 - this._smoothstep(0.48, 0.62, n.m);
    return this._clamp01(warm * dry);
  },

  rawHeightAt(x, z) {
    const s = this.seed;
    const e = NoiseGen.fbm2(s, x * 0.0045, z * 0.0045, 4, 2, 0.5);
    const r = NoiseGen.fbm2(s + 9917, x * 0.03, z * 0.03, 3, 2, 0.5);

    let normal = 15 + e * 36 + r * 7;
    const mtn = NoiseGen.fbm2(s + 551, x * 0.006, z * 0.006, 3, 2, 0.5);
    if (mtn > 0.58) normal += (mtn - 0.58) * 95;

    // Deserts stay above sea level, but no longer force a hard cliff at the edge.
    const desert = this.SEA - 1 + e * 14 + r * 2;
    const h = this._lerp(normal, desert, this.desertBlendAt(x, z));
    return Math.max(4, Math.min(this.H - 8, h));
  },

  heightAt(x, z) {
    const raw = this.rawHeightAt(x, z);
    const d = this.desertBlendAt(x, z);
    // Extra shoreline/border smoothing only where the terrain is transitioning.
    // This keeps caves/mountains rugged, but removes the 8-15 block biome ledges.
    const border = 1 - Math.abs(d * 2 - 1);
    let h = raw;
    if (border > 0.02) {
      const step = 3;
      const h1 = this.rawHeightAt(x + step, z);
      const h2 = this.rawHeightAt(x - step, z);
      const h3 = this.rawHeightAt(x, z + step);
      const h4 = this.rawHeightAt(x, z - step);
      const avg = (raw * 4 + h1 + h2 + h3 + h4) / 8;
      const delta = Math.max(Math.abs(raw - h1), Math.abs(raw - h2), Math.abs(raw - h3), Math.abs(raw - h4));
      const blend = Math.min(0.72, border * 0.48 + Math.max(0, delta - 6) * 0.035);
      h = this._lerp(raw, avg, blend);
    }
    return Math.max(4, Math.min(this.H - 8, Math.floor(h)));
  },

  biomeAt(x, z) {
    // regions small enough to alternate within walking distance, desert band wide
    // (0.0016 regions were so huge you could walk 500+ blocks and see one biome)
    const n = this.biomeNoiseAt(x, z);
    if (n.t < 0.40) return 'snowy';
    if (n.t > 0.52 && n.m < 0.55) return 'desert';
    if (n.m > 0.58) return 'forest';
    return 'plains';
  },

  chunkRand(cx, cz, salt) {
    return NoiseGen.mulberry((NoiseGen.hash2(this.seed + salt, cx, cz) * 4294967296) | 0);
  },

  genChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (this.chunks.has(k)) return this.chunks.get(k);
    const H = this.H, SEA = this.SEA;
    const blocks = new Uint16Array(16 * 16 * H); // 16-bit ids: room for every wool color imaginable
    const rnd = this.chunkRand(cx, cz, 101);

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const wx = cx * 16 + lx, wz = cz * 16 + lz;
        const h = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz);
        const beach = h <= SEA + 1;
        const sandy = beach || biome === 'desert';
        for (let y = 0; y < H; y++) {
          let id = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y === 1 && NoiseGen.hash3(this.seed, wx, y, wz) < 0.5) id = B.BEDROCK;
          else if (y === 2 && NoiseGen.hash3(this.seed, wx, y, wz) < 0.2) id = B.BEDROCK;
          else if (y < h - (sandy ? 4 : 2)) id = B.STONE;
          else if (y < h) id = sandy ? B.SAND : B.DIRT;
          else if (y === h) {
            if (sandy) id = B.SAND;
            else if (h > 58) id = NoiseGen.hash2(this.seed + 3, wx, wz) < 0.6 ? B.SNOWY_GRASS : B.STONE;
            else if (biome === 'snowy') id = B.SNOWY_GRASS;
            else id = B.GRASS;
          }
          else if (y <= SEA) id = B.WATER;
          if (id === B.STONE && h > SEA + 1 && y >= 6 && y <= h - 5) {
            if (NoiseGen.value3(this.seed + 777, wx * 0.08, y * 0.11, wz * 0.08) > 0.73) {
              id = y < 11 ? B.LAVA : B.AIR; // deep caves fill with lava pools
            }
          }
          blocks[this.idx(lx, y, lz)] = id;
        }
      }
    }

    const veins = [
      [B.COAL_ORE, 9, 5, 52, 6], [B.IRON_ORE, 7, 5, 40, 5], [B.GOLD_ORE, 3, 3, 26, 4],
      [B.DIAMOND_ORE, 2, 2, 14, 4], [B.EMERALD_ORE, 2, 4, 24, 3], [B.XMAS_ORE, 2, 4, 32, 3],
      [B.GUNPOWDER_ORE, 4, 4, 38, 4], [B.GRAVEL, 5, 8, 48, 7],
      [B.FLOOPIUM_ORE, rnd() < 0.5 ? 2 : 1, 3, 20, 3], [B.PATAPIM_ORE, rnd() < 0.4 ? 1 : 0, 2, 10, 2],
    ];
    for (const [ore, count, yMin, yMax, size] of veins) {
      for (let v = 0; v < count; v++) {
        let vx = (rnd() * 16) | 0, vz = (rnd() * 16) | 0;
        let vy = yMin + ((rnd() * (yMax - yMin)) | 0);
        const n = 1 + ((rnd() * size) | 0);
        for (let i = 0; i < n; i++) {
          if (vx >= 0 && vx < 16 && vz >= 0 && vz < 16 && vy > 0 && vy < H) {
            if (blocks[this.idx(vx, vy, vz)] === B.STONE) blocks[this.idx(vx, vy, vz)] = ore;
          }
          vx += ((rnd() * 3) | 0) - 1; vy += ((rnd() * 3) | 0) - 1; vz += ((rnd() * 3) | 0) - 1;
        }
      }
    }

    for (let dcx = -1; dcx <= 1; dcx++) {
      for (let dcz = -1; dcz <= 1; dcz++) {
        const feats = this.featuresFor(cx + dcx, cz + dcz);
        for (const f of feats) {
          const lx = f.x - cx * 16, lz = f.z - cz * 16;
          if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || f.y < 0 || f.y >= H) continue;
          const at = this.idx(lx, f.y, lz);
          if (f.f || blocks[at] === B.AIR) blocks[at] = f.id;
        }
      }
    }

    const seen = new Set();
    for (let dcx = -3; dcx <= 3; dcx += 3) {
      for (let dcz = -3; dcz <= 3; dcz += 3) {
        const dk = Math.floor((cx + dcx) / 6) + '|' + Math.floor((cz + dcz) / 6);
        if (seen.has(dk)) continue;
        seen.add(dk);
        const dungeon = this.dungeonFor(Math.floor((cx + dcx) / 6), Math.floor((cz + dcz) / 6));
        if (!dungeon) continue;
        const conqueredDungeon = dungeon.key && this.dungeonConquered && this.dungeonConquered.has(dungeon.key);
        const bucket = dungeon.byChunk.get(k);
        if (bucket) for (const f of bucket) {
          if (f.y < 0 || f.y >= H) continue;
          const placedId = conqueredDungeon ? this.deactivatedDungeonBlockId(f.id) : f.id;
          blocks[this.idx(f.x - cx * 16, f.y, f.z - cz * 16)] = placedId;
        }
      }
    }

    // player-era edits: replay just this chunk's bucket (used to scan every cell —
    // with a big world file that was a real chunk-load cost)
    const extraBlocks = new Map();
    const bucket2 = this.diffIndex.get(k);
    if (bucket2) {
      for (const [dk, id] of bucket2) {
        const [wx2, wy2, wz2] = dk.split(',').map(Number);
        if (wy2 >= 0 && wy2 < H) blocks[this.idx(wx2 & 15, wy2, wz2 & 15)] = id;
        else if (wy2 >= H && id !== B.AIR) extraBlocks.set(this.pkey(wx2, wy2, wz2), id);
      }
    }

    const ch = { cx, cz, blocks, extraBlocks: extraBlocks.size ? extraBlocks : null, light: null, solidMesh: null, cutoutMesh: null, waterMesh: null, lavaMesh: null, photoMesh: null, sectionMeshes: [], hasMesh: false };
    this.chunks.set(k, ch);

    for (let y = 0; y < H; y++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const id = blocks[this.idx(lx, y, lz)];
      if (id === B.AIR) continue;
      const def = Reg[id];
      const wx = cx * 16 + lx, wz = cz * 16 + lz;
      if (def && def.light) this.lights.set(this.pkey(wx, y, wz), [wx, y, wz]);
      if (id === B.MEGA_TORCH) this.megaTorches.add(this.pkey(wx, y, wz));
      if (id === B.FIRE) this.fires.set(this.pkey(wx, y, wz), { t: 5 });
      else if (isSapling(id)) {
        const pk = this.pkey(wx, y, wz);
        if (!this.saplings.has(pk)) this.saplings.set(pk, { id, t: 25 + Math.random() * 50 });
      } else if (isCrop(id)) {
        const pk = this.pkey(wx, y, wz);
        if (!this.crops.has(pk)) this.crops.set(pk, { id, t: 35 + Math.random() * 55 });
      }
    }
    if (ch.extraBlocks) {
      for (const [pk, id] of ch.extraBlocks) {
        if (id === B.AIR) continue;
        const [wx, y, wz] = pk.split(',').map(Number);
        const def = Reg[id];
        if (def && def.light) this.lights.set(pk, [wx, y, wz]);
        if (id === B.MEGA_TORCH) this.megaTorches.add(pk);
        if (id === B.FIRE) this.fires.set(pk, { t: 5 });
        else if (isSapling(id) && !this.saplings.has(pk)) this.saplings.set(pk, { id, t: 25 + Math.random() * 50 });
        else if (isCrop(id) && !this.crops.has(pk)) this.crops.set(pk, { id, t: 35 + Math.random() * 55 });
      }
    }
    return ch;
  },

  // ---------- features ----------
  treeBlocks(put, wx, h, wz, type, tr) {
    if (type === 'oasis') {
      // Desert oasis palm: thin trunk, high leafy crown, unique blocks.
      const th = 5 + ((tr() * 3) | 0);
      for (let y = 1; y <= th; y++) put(wx, h + y, wz, B.OASIS_LOG, true);
      const cy = h + th + 1;
      put(wx, cy, wz, B.OASIS_LEAVES, false);
      put(wx, cy + 1, wz, B.OASIS_LEAVES, false);
      const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
      for (const [dx, dz] of dirs) {
        const len = Math.abs(dx) + Math.abs(dz) === 2 ? 2 : 3;
        for (let i = 1; i <= len; i++) {
          const droop = i === len ? 1 : 0;
          put(wx + dx * i, cy - droop, wz + dz * i, B.OASIS_LEAVES, false);
        }
      }
      return;
    }
    if (type === 'spruce') {
      const th = 6 + ((tr() * 3) | 0);
      for (let y = 1; y <= th; y++) put(wx, h + y, wz, B.SPRUCE_LOG, true);
      for (let dy = 2; dy <= th + 1; dy++) {
        const frac = (dy - 2) / (th - 1);
        const rad = Math.max(0, Math.round(2.5 * (1 - frac)) + ((dy % 2) === 0 ? 0 : -1));
        if (dy === th + 1) { put(wx, h + dy, wz, B.SPRUCE_LEAVES, false); continue; }
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (dx === 0 && dz === 0 && dy <= th) continue;
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad > 1) continue;
          put(wx + dx, h + dy, wz + dz, B.SPRUCE_LEAVES, false);
        }
      }
      return;
    }
    const log = type === 'birch' ? B.BIRCH_LOG : B.LOG;
    const leaf = type === 'birch' ? B.BIRCH_LEAVES : B.LEAVES;
    const th = (type === 'birch' ? 5 : 4) + ((tr() * 3) | 0);
    for (let y = 1; y <= th; y++) put(wx, h + y, wz, log, true);
    for (let dy = -2; dy <= 1; dy++) {
      const yy = h + th + dy;
      const rad = dy < 0 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && tr() < 0.5) continue;
          put(wx + dx, yy, wz + dz, leaf, false);
        }
      }
    }
  },

  featuresFor(cx, cz) {
    const k = this.key(cx, cz);
    if (this.featureCache.has(k)) return this.featureCache.get(k);
    let out = [];
    const put = (x, y, z, id, force) => out.push({ x, y, z, id, f: !!force });

    // Keep feature bases from fighting each other inside the same chunk.
    // This prevents duplicate/near-duplicate tree attempts from stamping
    // birch/oak trunks into the same grass spot and creating merged trees.
    const treeBases = [];
    const reserveTreeBase = (wx, wz) => {
      for (const p of treeBases) {
        if (Math.abs(wx - p.x) <= 2 && Math.abs(wz - p.z) <= 2) return false;
      }
      treeBases.push({ x: wx, z: wz });
      return true;
    };

    const tr = this.chunkRand(cx, cz, 202);
    const biome = this.biomeAt(cx * 16 + 8, cz * 16 + 8);
    let nTrees = 0;
    if (biome === 'forest') nTrees = 3 + ((tr() * 4) | 0);
    else if (biome === 'plains') nTrees = (tr() * 3) | 0;
    else if (biome === 'snowy') nTrees = (tr() * 3) | 0;
    for (let t = 0; t < nTrees; t++) {
      const lx = 2 + ((tr() * 12) | 0), lz = 2 + ((tr() * 12) | 0);
      const wx = cx * 16 + lx, wz = cz * 16 + lz;
      const h = this.heightAt(wx, wz);
      if (h <= this.SEA + 1 || h > 57) continue;
      let type = 'oak';
      if (biome === 'snowy') type = 'spruce';
      else if (biome === 'forest') type = tr() < 0.4 ? 'birch' : 'oak';
      else if (tr() < 0.12) type = 'birch';
      if (!reserveTreeBase(wx, wz)) continue;
      this.treeBlocks(put, wx, h, wz, type, tr);
    }

    // flowers on grass
    if (biome === 'plains' || biome === 'forest') {
      const nFlowers = (tr() * 5) | 0;
      for (let i = 0; i < nFlowers; i++) {
        const lx = 1 + ((tr() * 14) | 0), lz = 1 + ((tr() * 14) | 0);
        const wx = cx * 16 + lx, wz = cz * 16 + lz;
        const h = this.heightAt(wx, wz);
        if (h <= this.SEA + 1 || h > 55) continue;
        const flower = [B.ROSE, B.DANDELION, B.CORNFLOWER][(tr() * 3) | 0];
        put(wx, h + 1, wz, flower, false);
      }
    }

    // wild grass on open grass, with a chance to drop the first farm seeds
    if (biome === 'plains' || biome === 'forest') {
      const nGrass = 2 + ((tr() * 7) | 0);
      for (let i = 0; i < nGrass; i++) {
        const lx = 1 + ((tr() * 14) | 0), lz = 1 + ((tr() * 14) | 0);
        const wx = cx * 16 + lx, wz = cz * 16 + lz;
        const h = this.heightAt(wx, wz);
        if (h <= this.SEA + 1 || h > 57) continue;
        const localBiome = this.biomeAt(wx, wz);
        if (localBiome === 'desert' || h <= this.SEA + 1) continue;
        put(wx, h + 1, wz, B.WILD_GRASS, false);
      }
    }

    // cattails near lakes/shorelines: plant one block above ground if water is adjacent
    {
      const nCattails = 1 + ((tr() * 5) | 0);
      for (let i = 0; i < nCattails; i++) {
        const lx = 1 + ((tr() * 14) | 0), lz = 1 + ((tr() * 14) | 0);
        const wx = cx * 16 + lx, wz = cz * 16 + lz;
        const h = this.heightAt(wx, wz);
        if (h < this.SEA - 1 || h > this.SEA + 2) continue;
        let nearWater = false;
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) if (this.heightAt(wx + dx, wz + dz) < this.SEA) nearWater = true;
        if (nearWater) put(wx, h + 1, wz, B.CATTAIL, false);
      }
    }

    // desert: cacti + rare oasis
    if (biome === 'desert') {
      const nCacti = 4 + ((tr() * 6) | 0);
      for (let i = 0; i < nCacti; i++) {
        const wx = cx * 16 + 1 + ((tr() * 14) | 0), wz = cz * 16 + 1 + ((tr() * 14) | 0);
        const h = this.heightAt(wx, wz);
        if (h <= this.SEA + 1) continue;
        // cacti only on actual desert sand — border chunks were sprouting them on grass
        if (this.biomeAt(wx, wz) !== 'desert') continue;
        const ch2 = 1 + ((tr() * 3) | 0);
        for (let y = 1; y <= ch2; y++) put(wx, h + y, wz, B.CACTUS, false);
      }
      if (tr() < 0.04) {
        // oasis: small pond flush with the ground
        const ox = cx * 16 + 6 + ((tr() * 4) | 0), oz = cz * 16 + 6 + ((tr() * 4) | 0);
        const oh = this.heightAt(ox, oz);
        if (oh > this.SEA + 2) {
          let flat = true;
          for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
            if (this.heightAt(ox + dx, oz + dz) !== oh) flat = false;
          }
          if (flat) {
            for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
              if (Math.abs(dx) + Math.abs(dz) <= 2) put(ox + dx, oh, oz + dz, B.WATER, true);
            }
            put(ox - 2, oh + 1, oz, B.DANDELION, false);
            put(ox + 2, oh + 1, oz - 1, B.ROSE, false);
            this.treeBlocks(put, ox + 2, oh, oz + 2, 'oasis', tr);
          }
        }
      }
    }

    // Final generation sanity: cacti must never survive on top of water.
    // Oasis water is stamped after desert cacti, so without this cleanup a
    // cactus picked before the oasis could remain floating on the pond.
    {
      const waterCols = new Set();
      for (const f of out) {
        if (f.id === B.WATER) waterCols.add(f.x + ',' + f.z);
      }
      if (waterCols.size) out = out.filter(f => f.id !== B.CACTUS || !waterCols.has(f.x + ',' + f.z));
    }

    const st = this.structCell(Math.floor(cx / 4), Math.floor(cz / 4));
    if (st && st.cx === cx && st.cz === cz) {
      const sr = this.chunkRand(cx, cz, 303);
      const x0 = cx * 16 + 5 + ((sr() * 6) | 0);
      const z0 = cz * 16 + 5 + ((sr() * 6) | 0);
      const gy = this.surfaceStructureGroundY(st.type, x0, z0);
      const stamp = this['stamp_' + st.type];
      if (gy !== null && typeof stamp === 'function') {
        const cellKey = 'S' + Math.floor(cx / 4) + '|' + Math.floor(cz / 4);
        if (!this.structSeen.has(cellKey)) {
          this.structSeen.add(cellKey);
          this.floopSpots.push({ x: x0, z: z0, type: st.type });
        }
        stamp.call(this, put, x0, gy, z0, sr);
      }
    }

    this.featureCache.set(k, out);
    return out;
  },

  structCell(scx, scz) {
    const k = scx + '|' + scz;
    if (this.structCellCache.has(k)) return this.structCellCache.get(k);
    const r = this.chunkRand(scx, scz, 404);
    const roll = r();
    let type = null;
    // Surface structures are beginner-side discoveries, so keep them much rarer
    // than before. Old total chance was 30% per 4x4 chunk cell; new total stays low.
    if (roll < 0.006) type = 'jelly_village';
    else if (roll < 0.032) type = 'ufo';
    else if (roll < 0.062) type = 'shrine';
    else if (roll < 0.097) type = 'house';
    else if (roll < 0.117) type = 'tower';
    let res = null;
    if (type) {
      res = { type, cx: scx * 4 + ((r() * 4) | 0), cz: scz * 4 + ((r() * 4) | 0) };
    }
    this.structCellCache.set(k, res);
    return res;
  },


  // ---------- structure locating / teleport helpers ----------
  // These are the real generated structure targets that /locate and /locatetp know about.
  locateStructureNames() {
    return ['house', 'tower', 'shrine', 'ufo', 'jelly_village', 'dungeon'];
  },

  locateStructureHelpLines() {
    return [
      'Surface structures: house, tower, shrine, ufo, jelly_village',
      'Underground structures: dungeon',
      'Plural names work too: houses, towers, dungeons',
      'Aliases: saucer/casino = ufo, monument = shrine, jelly/village = jelly_village'
    ];
  },

  normalizeLocateName(name) {
    const q = String(name || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    const aliases = {
      floop_house: 'house', home: 'house', homes: 'house', houses: 'house', floop_houses: 'house',
      floop_tower: 'tower', towers: 'tower', floop_towers: 'tower',
      floop_shrine: 'shrine', shrines: 'shrine', monument: 'shrine', monuments: 'shrine',
      saucer: 'ufo', saucers: 'ufo', casino: 'ufo', casinos: 'ufo', floop_ufo: 'ufo', ufos: 'ufo', ufo_structure: 'ufo',
      jelly: 'jelly_village', jellies: 'jelly_village', village: 'jelly_village', villages: 'jelly_village', jelly_villages: 'jelly_village', jelly_town: 'jelly_village',
      dungeon_room: 'dungeon', dungeon_rooms: 'dungeon', dungeons: 'dungeon'
    };
    return aliases[q] || q;
  },

  surfaceStructureGroundY(type, x0, z0) {
    // This is the exact dry-land gate used by both generation AND /locate.
    if (type === 'jelly_village') {
      let maxH = -999, minH = 999;
      for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
        const h = this.heightAt(x0 + dx, z0 + dz);
        maxH = Math.max(maxH, h); minH = Math.min(minH, h);
        if (h <= this.SEA + 1) return null;
      }
      if (maxH >= this.H - 18) return null;
      if (maxH - minH > 5) return null;
      return maxH;
    }
    const gy = this.heightAt(x0, z0);
    return (gy > this.SEA && gy < this.H - 18) ? gy : null;
  },

  structureCenterForCell(scx, scz) {
    const st = this.structCell(scx, scz);
    if (!st) return null;
    const sr = this.chunkRand(st.cx, st.cz, 303);
    const x = st.cx * 16 + 5 + ((sr() * 6) | 0);
    const z = st.cz * 16 + 5 + ((sr() * 6) | 0);
    const gy = this.surfaceStructureGroundY(st.type, x, z);
    if (gy === null) return null;
    const y = gy + 2;
    return { type: st.type, x: x + 0.5, y, z: z + 0.5, cellX: scx, cellZ: scz };
  },

  dungeonCenterForCell(dscx, dscz) {
    const dg = this.dungeonFor(dscx, dscz);
    if (!dg || !dg.rooms || !dg.rooms.length) return null;
    const room = dg.rooms[0];
    const x = room.x + Math.floor(room.w / 2) + 0.5;
    const y = 18; // dungeon entrances lead down; teleport above the first room, then dig/walk in safely
    const z = room.z + Math.floor(room.l / 2) + 0.5;
    // prefer the actual recorded first spot if present in this dungeon cache
    return { type: 'dungeon', x, y: room.y + 2, z, cellX: dscx, cellZ: dscz };
  },

  locateNearestStructure(name, fromX, fromZ, maxRing) {
    const type = this.normalizeLocateName(name);
    const allowed = this.locateStructureNames();
    if (!allowed.includes(type)) return { error: 'unknown', type };
    const ringMax = maxRing || 80;
    let best = null;
    const dist2 = (p) => (p.x - fromX) * (p.x - fromX) + (p.z - fromZ) * (p.z - fromZ);

    if (type === 'dungeon') {
      const baseX = Math.floor(fromX / 96), baseZ = Math.floor(fromZ / 96);
      for (let r = 0; r <= ringMax; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const p = this.dungeonCenterForCell(baseX + dx, baseZ + dz);
          if (!p) continue;
          if (!best || dist2(p) < dist2(best)) best = p;
        }
        if (best && r >= 2) break;
      }
    } else {
      const baseX = Math.floor((Math.floor(fromX) >> 4) / 4);
      const baseZ = Math.floor((Math.floor(fromZ) >> 4) / 4);
      for (let r = 0; r <= ringMax; r++) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const p = this.structureCenterForCell(baseX + dx, baseZ + dz);
          if (!p || p.type !== type) continue;
          if (!best || dist2(p) < dist2(best)) best = p;
        }
        if (best && r >= 2) break;
      }
    }
    if (!best) return { error: 'none', type };
    best.distance = Math.sqrt(dist2(best));
    return best;
  },

  putLore(x, y, z, idx) {
    this.loreMap.set(this.pkey(x, y, z), idx % LORE.length);
  },

  stamp_shrine(put, x0, gy, z0, rnd) {
    const li = (rnd() * LORE.length) | 0;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      put(x0 + dx, gy, z0 + dz, B.COBBLE, true);
      put(x0 + dx, gy - 1, z0 + dz, B.COBBLE, true);
      for (let y = 1; y <= 5; y++) put(x0 + dx, gy + y, z0 + dz, B.AIR, true);
    }
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      for (let y = 1; y <= 3; y++) put(x0 + dx, gy + y, z0 + dz, B.COBBLE, true);
      put(x0 + dx, gy + 4, z0 + dz, B.TORCH, true);
    }
    // Beginner surface shrine: decorative stone/lamp instead of free high-tier metal/ore.
    for (let y = 1; y <= 3; y++) put(x0, gy + y, z0, B.STONE_BRICKS, true);
    put(x0, gy + 4, z0, B.FLOOP_LAMP, true);
    put(x0, gy + 1, z0 + 2, B.LORE, true);
    this.putLore(x0, gy + 1, z0 + 2, li);
    put(x0 - 2, gy + 1, z0 - 2, B.PRESENT, true);
    for (let i = 0; i < 4; i++) {
      const dx = ((rnd() * 7) | 0) - 3, dz = ((rnd() * 7) | 0) - 3;
      if (Math.abs(dx) === 3 || Math.abs(dz) === 3) put(x0 + dx, gy + 1, z0 + dz, B.SNOW, true);
    }
  },

  stamp_jelly_village(put, x0, gy, z0, rnd) {
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
      const ground = this.heightAt(x0 + dx, z0 + dz);
      for (let fy = Math.max(1, ground); fy < gy; fy++) put(x0 + dx, fy, z0 + dz, B.DIRT, true);
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d <= 5.8) put(x0 + dx, gy, z0 + dz, d < 2.2 ? B.JELLY_BLOCK : (rnd() < 0.45 ? B.JELLY_BLOCK : B.WOOL_PURPLE), true);
      for (let y = 1; y <= 3; y++) put(x0 + dx, gy + y, z0 + dz, B.AIR, true);
    }

    const hut = (hx, hz, block, lamp) => {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const wx = x0 + hx + dx, wz = z0 + hz + dz;
        put(wx, gy + 1, wz, (Math.abs(dx) === 1 || Math.abs(dz) === 1) ? block : B.AIR, true);
        put(wx, gy + 2, wz, (Math.abs(dx) === 1 || Math.abs(dz) === 1) ? block : B.AIR, true);
        put(wx, gy + 3, wz, block, true);
      }
      put(x0 + hx, gy + 1, z0 + hz + 1, B.AIR, true);
      put(x0 + hx, gy + 2, z0 + hz + 1, B.AIR, true);
      put(x0 + hx, gy + 1, z0 + hz, lamp || B.JELLY_LAMP, true);
    };
    hut(-3, -3, B.JELLY_BLOCK, B.JELLY_LAMP);
    hut(3, -3, B.JELLY_BLOCK_CYAN, B.JELLY_LAMP_CYAN);
    hut(-3, 3, B.JELLY_BLOCK_LIME, B.JELLY_LAMP_LIME);
    hut(3, 3, B.JELLY_BLOCK_GRAPE, B.JELLY_LAMP_GRAPE);

    put(x0, gy + 1, z0, B.JELLY_HOUSE, true);
    const colors = (typeof JELLY_COLORS_ALL !== 'undefined') ? JELLY_COLORS_ALL : ['pink', 'cyan', 'lime', 'grape'];
    const roster = [];
    for (let i = 0; i < 10; i++) roster.push(colors[(rnd() * colors.length) | 0]);
    if (typeof Jelly !== 'undefined') Jelly.createHouseAt(x0, gy + 1, z0, { roster, source: 'worldgen' });
    put(x0, gy + 2, z0, B.JELLY_LAMP_YELLOW, true);
    put(x0 + 1, gy + 1, z0, B.JELLY_CHEST, true);
    this.initChest(x0 + 1, gy + 1, z0, rnd, true, 'surface', 54);
  },

  stamp_house(put, x0, gy, z0, rnd) {
    const li = (rnd() * LORE.length) | 0;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      put(x0 + dx, gy, z0 + dz, B.PLANKS, true);
      put(x0 + dx, gy - 1, z0 + dz, B.DIRT, true);
      for (let y = 1; y <= 3; y++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        let id = B.AIR;
        if (corner) id = B.LOG;
        else if (edge) id = B.PLANKS;
        put(x0 + dx, gy + y, z0 + dz, id, true);
      }
      put(x0 + dx, gy + 4, z0 + dz, B.PLANKS, true);
    }
    put(x0, gy + 1, z0 + 2, B.DOOR_ZB, true);
    put(x0, gy + 2, z0 + 2, B.DOOR_ZT, true);
    put(x0 - 2, gy + 2, z0, B.GLASS, true);
    put(x0 + 2, gy + 2, z0, B.GLASS, true);
    put(x0 - 1, gy + 1, z0 - 1, B.CRAFT, true);
    put(x0 + 1, gy + 1, z0 - 1, B.PRESENT, true);
    put(x0 + 1, gy + 1, z0 + 1, B.TORCH, true);
    put(x0 - 1, gy + 1, z0 + 1, B.BED, true);
    put(x0 - 1, gy + 1, z0, B.BED_HEAD, true);
    put(x0 + 1, gy + 1, z0, B.CHEST, true);
    this.initChest(x0 + 1, gy + 1, z0, rnd);
    put(x0 - 1, gy + 1, z0 + 3, B.LORE, true);
    this.putLore(x0 - 1, gy + 1, z0 + 3, li);
  },

  stamp_ufo(put, x0, gy, z0, rnd) {
    const li = (rnd() * LORE.length) | 0;
    const r2 = (dx, dz) => Math.sqrt(dx * dx + dz * dz);
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
      const d = r2(dx, dz);
      if (d <= 5.4) {
        for (let y = 2; y <= 6; y++) put(x0 + dx, gy + y, z0 + dz, B.AIR, true);
        put(x0 + dx, gy + 1, z0 + dz, B.STONE_BRICKS, true);
        put(x0 + dx, gy, z0 + dz, B.COBBLE, true);
      }
      if (d > 3.6 && d <= 5.4) put(x0 + dx, gy + 2, z0 + dz, B.STONE_BRICKS, true);
      for (let dy = 3; dy <= 6; dy++) {
        const rr = Math.sqrt(Math.max(0, 20 - (dy - 2) * (dy - 2) * 1.7));
        if (Math.abs(d - rr) < 0.75 && d <= 5.4) put(x0 + dx, gy + dy, z0 + dz, B.GLASS, true);
      }
    }
    put(x0 + 4, gy + 2, z0, B.AIR, true); put(x0 + 5, gy + 2, z0, B.AIR, true);
    put(x0 - 2, gy + 2, z0, B.CASINO, true);
    put(x0 + 2, gy + 2, z0 + 2, B.FLOOP_LAMP, true);
    put(x0 - 2, gy + 2, z0 - 2, B.FLOOP_LAMP, true);
    put(x0, gy + 2, z0 - 2, B.LORE, true);
    this.putLore(x0, gy + 2, z0 - 2, li);
    put(x0, gy + 2, z0 + 2, B.PRESENT, true);
    // No late-game ore blocks in beginner surface UFOs.
    put(x0 - 1, gy + 1, z0 + 1, B.IRON_ORE, true);
    put(x0 + 1, gy + 1, z0 - 1, B.COAL_ORE, true);
    put(x0 + 1, gy + 2, z0 + 1, B.LOOT_CRATE, true);
    this.initChest(x0 + 1, gy + 2, z0 + 1, rnd, true);
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2, dist = 6 + rnd() * 3;
      const sx = x0 + Math.round(Math.cos(a) * dist), sz = z0 + Math.round(Math.sin(a) * dist);
      const sy = this.heightAt(sx, sz);
      put(sx, sy, sz, rnd() < 0.35 ? B.IRON_ORE : B.COAL_ORE, true);
    }
  },

  stamp_tower(put, x0, gy, z0, rnd) {
    const floors = 3 + ((rnd() * 2) | 0);
    const topY = gy + floors * 4 + 1;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      put(x0 + dx, gy, z0 + dz, B.STONE_BRICKS, true);
      put(x0 + dx, gy - 1, z0 + dz, B.STONE_BRICKS, true);
      for (let y = gy + 1; y <= topY; y++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        const floorLevel = (y - gy) % 4 === 0;
        let id = B.AIR;
        if (corner) id = B.STONE_BRICKS;
        else if (edge) id = (floorLevel || (y - gy) % 4 !== 2) ? B.STONE_BRICKS : B.GLASS;
        else if (floorLevel) id = B.PLANKS;
        put(x0 + dx, y, z0 + dz, id, true);
      }
    }
    put(x0, gy + 1, z0 + 2, B.DOOR_ZB, true);
    put(x0, gy + 2, z0 + 2, B.DOOR_ZT, true);
    // an actually climbable ladder column up the north wall, with floor holes
    for (let y = gy + 1; y <= topY + 1; y++) {
      put(x0, y, z0 - 1, y > topY ? B.AIR : B.LADDER_PZ, true);
      if ((y - gy) % 4 === 0) put(x0, y, z0 - 1, B.AIR, true); // hole in each floor
    }
    for (let y = gy + 1; y <= topY; y++) {
      if ((y - gy) % 4 === 0) put(x0, y, z0 - 1, B.AIR, true);
      else put(x0, y, z0 - 1, B.LADDER_PZ, true);
    }
    for (let f = 0; f < floors; f++) {
      const fy = gy + f * 4;
      if (f === 0) { put(x0 + 1, fy + 1, z0, B.CRAFT, true); put(x0 - 1, fy + 1, z0 + 1, B.FURNACE, true); }
      if (f === 1) {
        put(x0 + 1, fy + 1, z0, B.LOOT_CRATE, true);
        this.initChest(x0 + 1, fy + 1, z0, rnd);
        put(x0 - 1, fy + 1, z0 + 1, B.PRESENT, true);
        put(x0, fy + 1, z0 + 1, B.CHEST, true);
        this.initChest(x0, fy + 1, z0 + 1, rnd);
      }
      if (f === 2) { put(x0 + 1, fy + 1, z0, B.STOCKS, true); }
    }
    put(x0, topY + 1, z0, B.FLOOP_LAMP, true);
    put(x0, topY + 2, z0, B.FLOOP_LAMP, true);
    const li = (rnd() * LORE.length) | 0;
    put(x0 + 1, topY + 1, z0 + 1, B.LORE, true);
    this.putLore(x0 + 1, topY + 1, z0 + 1, li);
    put(x0 - 1, topY + 1, z0 - 1, B.IRON_ORE, true);
  },

  // ---------- dungeons ----------
  dungeonFor(dscx, dscz) {
    const k = dscx + '|' + dscz;
    if (this.dungeonCache.has(k)) return this.dungeonCache.get(k);
    const r = this.chunkRand(dscx, dscz, 909);
    if (r() > 0.35) { this.dungeonCache.set(k, null); return null; }
    const rankRoll = r();
    const rankInfo = dungeonRankInfo(rankRoll < 0.55 ? 'green' : rankRoll < 0.80 ? 'blue' : rankRoll < 0.95 ? 'gold' : 'diamond');
    const conqueredAlready = this.dungeonConquered && this.dungeonConquered.has(k);

    const cells = new Map();
    const setC = (x, y, z, id) => cells.set(this.pkey(x, y, z), { x, y, z, id });
    const rooms = [];
    const spots = [];

    const startX = dscx * 96 + 24 + ((r() * 48) | 0);
    const startZ = dscz * 96 + 24 + ((r() * 48) | 0);
    let baseY = 11 + ((r() * 6) | 0);
    if (this.heightAt(startX, startZ) < baseY + 10) { this.dungeonCache.set(k, null); return null; }

    const carveRoom = (cx0, y0, cz0, w, hgt, l, isLast) => {
      rooms.push({ x: cx0, y: y0, z: cz0, w, l });
      spots.push({ x: cx0 + (w >> 1), y: y0 + 1, z: cz0 + (l >> 1) });
      for (let x = cx0 - 1; x <= cx0 + w; x++) for (let y = y0 - 1; y <= y0 + hgt; y++) for (let z = cz0 - 1; z <= cz0 + l; z++) {
        const shell = x < cx0 || x >= cx0 + w || y < y0 || y >= y0 + hgt || z < cz0 || z >= cz0 + l;
        if (shell) {
          if (!cells.has(this.pkey(x, y, z))) {
            setC(x, y, z, B.DUNGEON_BRICK);
          }
        } else setC(x, y, z, B.AIR);
      }
      setC(cx0, y0, cz0, B.TORCH); setC(cx0 + w - 1, y0, cz0 + l - 1, B.TORCH);
      // some rooms guard their loot with a monster spawner
      if (!conqueredAlready && r() < 0.35 + rankInfo.mobBonus * 0.12) {
        const sx2 = cx0 + (w >> 1), sz2 = cz0 + (l >> 1);
        setC(sx2, y0, sz2, B.SPAWNER);
        const sk = this.pkey(sx2, y0, sz2);
        if (!this.spawners.has(sk)) {
          const mobPool = rankInfo.rank === 'green'
            ? ['skeleton', 'creeper', 'humbug']
            : rankInfo.rank === 'blue'
              ? ['skeleton', 'creeper', 'humbug', 'humbug']
              : ['skeleton', 'creeper', 'humbug', 'humbug', 'tung'];
          this.spawners.set(sk, { type: mobPool[(r() * mobPool.length) | 0], cd: 3 });
        }
      }
      const nLoot = 1 + ((r() * 2) | 0);
      for (let i = 0; i < nLoot; i++) {
        const lx = cx0 + 1 + ((r() * (w - 2)) | 0), lz = cz0 + 1 + ((r() * (l - 2)) | 0);
        setC(lx, y0, lz, B.LOOT_CRATE);
        this.initChest(lx, y0, lz, r, r() < rankInfo.richBonus, 'dungeon:' + rankInfo.rank);
      }
      if (isLast) {
        setC(cx0 + (w >> 1), y0, cz0 + (l >> 1), B.DUNGEON_CORE);
        setC(cx0 + (w >> 1) + 1, y0, cz0 + (l >> 1), B.LOOT_CRATE);
        this.initChest(cx0 + (w >> 1) + 1, y0, cz0 + (l >> 1), r, true, 'dungeon:' + rankInfo.rank);
        setC(cx0 + (w >> 1), y0, cz0 + (l >> 1) + 1, B.CHEST);
        this.initChest(cx0 + (w >> 1), y0, cz0 + (l >> 1) + 1, r, true, 'dungeon:' + rankInfo.rank);
        const li = (r() * LORE.length) | 0;
        setC(cx0 + (w >> 1) - 1, y0, cz0 + (l >> 1), B.LORE);
        this.putLore(cx0 + (w >> 1) - 1, y0, cz0 + (l >> 1), li);
      }
    };

    const carveCorridor = (x0, y0, z0, dx, dz, len) => {
      let x = x0, z = z0;
      for (let i = 0; i < len; i++) {
        x += dx; z += dz;
        for (let o = 0; o < 2; o++) {
          const ox = dz !== 0 ? o : 0, oz = dx !== 0 ? o : 0;
          for (let y = y0; y < y0 + 3; y++) setC(x + ox, y, z + oz, B.AIR);
          if (!cells.has(this.pkey(x + ox, y0 - 1, z + oz))) setC(x + ox, y0 - 1, z + oz, B.DUNGEON_BRICK);
          if (!cells.has(this.pkey(x + ox, y0 + 3, z + oz))) setC(x + ox, y0 + 3, z + oz, B.DUNGEON_BRICK);
        }
        for (let y = y0; y < y0 + 3; y++) {
          if (dx !== 0) {
            if (!cells.has(this.pkey(x, y, z - 1))) setC(x, y, z - 1, B.DUNGEON_BRICK);
            if (!cells.has(this.pkey(x, y, z + 2))) setC(x, y, z + 2, B.DUNGEON_BRICK);
          } else {
            if (!cells.has(this.pkey(x - 1, y, z))) setC(x - 1, y, z, B.DUNGEON_BRICK);
            if (!cells.has(this.pkey(x + 2, y, z))) setC(x + 2, y, z, B.DUNGEON_BRICK);
          }
        }
      }
      return [x, z];
    };

    const loX = dscx * 96 - 24, hiX = dscx * 96 + 112;
    const loZ = dscz * 96 - 24, hiZ = dscz * 96 + 112;
    const nRooms = 5 + ((r() * 4) | 0);
    let px = startX, pz = startZ;
    for (let i = 0; i < nRooms; i++) {
      const w = 5 + ((r() * 4) | 0), l = 5 + ((r() * 4) | 0);
      carveRoom(px - (w >> 1), baseY, pz - (l >> 1), w, 4, l, i === nRooms - 1);
      if (i < nRooms - 1) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => r() - 0.5);
        const len = 5 + ((r() * 5) | 0) + ((w + l) >> 2);
        let moved = false;
        for (const [dx, dz] of dirs) {
          const tx = px + dx * (len + 9), tz = pz + dz * (len + 9);
          if (tx < loX || tx > hiX || tz < loZ || tz > hiZ) continue;
          const [nx, nz] = carveCorridor(px, baseY, pz, dx, dz, len);
          px = nx + dx * 3; pz = nz + dz * 3;
          moved = true;
          break;
        }
        if (!moved) break;
      }
    }

    if (rooms.length) {
      const first = rooms[0];
      const doorX = first.x - 1;
      const doorY = first.y;
      const doorCenterZ = first.z + (first.l >> 1);
      const entryWest = first.x - 6;
      const entryEast = doorX;
      const entryZ0 = doorCenterZ - 2;
      const entryZ1 = doorCenterZ + 2;
      const shaftX = first.x - 4;
      const shaftZ = doorCenterZ;
      const surfaceFloorY = Math.min(this.H - 5, Math.max(first.y + 8, this.heightAt(shaftX, shaftZ)));

      // Underground entrance room. The east wall opens into room 1; the ranked
      // 3x3 gate lives on the surface tower so it is reachable before the ladder.
      for (let x = entryWest; x <= entryEast; x++) {
        for (let y = first.y - 1; y <= first.y + 3; y++) {
          for (let z = entryZ0; z <= entryZ1; z++) {
            const shell = x === entryWest || x === entryEast || y === first.y - 1 || y === first.y + 3 || z === entryZ0 || z === entryZ1;
            setC(x, y, z, shell ? B.DUNGEON_BRICK : B.AIR);
          }
        }
      }
      for (let y = doorY; y <= doorY + 2; y++) {
        for (let z = doorCenterZ - 1; z <= doorCenterZ + 1; z++) setC(doorX, y, z, B.AIR);
      }

      // Sealed ladder shaft from the entry room up into a small surface tower.
      for (let y = first.y; y < surfaceFloorY; y++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const x = shaftX + dx, z = shaftZ + dz;
            if (dx === 0 && dz === 0) setC(x, y, z, B.LADDER_PZ);
            else setC(x, y, z, B.DUNGEON_BRICK);
          }
        }
      }
      for (let x = entryWest + 1; x <= entryEast - 1; x++) {
        for (let y = first.y; y <= first.y + 2; y++) {
          for (let z = entryZ0 + 1; z <= entryZ1 - 1; z++) setC(x, y, z, B.AIR);
        }
      }
      for (let y = first.y; y < surfaceFloorY; y++) {
        setC(shaftX, y, shaftZ - 1, B.DUNGEON_BRICK);
        setC(shaftX, y, shaftZ, B.LADDER_PZ);
      }

      // Surface access room. Its outside wall is the reachable 3x3 ranked gate.
      for (let x = shaftX - 2; x <= shaftX + 2; x++) {
        for (let y = surfaceFloorY; y <= surfaceFloorY + 4; y++) {
          for (let z = shaftZ - 2; z <= shaftZ + 2; z++) {
            const shell = x === shaftX - 2 || x === shaftX + 2 || y === surfaceFloorY || y === surfaceFloorY + 4 || z === shaftZ - 2 || z === shaftZ + 2;
            setC(x, y, z, shell ? B.DUNGEON_BRICK : B.AIR);
          }
        }
      }
      for (let y = surfaceFloorY; y <= surfaceFloorY + 3; y++) {
        setC(shaftX, y, shaftZ - 1, B.DUNGEON_BRICK);
        setC(shaftX, y, shaftZ, B.LADDER_PZ);
      }
      for (let x = shaftX - 1; x <= shaftX + 1; x++) {
        for (let y = surfaceFloorY + 1; y <= surfaceFloorY + 3; y++) setC(x, y, shaftZ + 2, rankInfo.door);
      }
      for (let z = shaftZ + 3; z <= shaftZ + 5; z++) {
        for (let x = shaftX - 1; x <= shaftX + 1; x++) {
          setC(x, surfaceFloorY, z, B.DUNGEON_BRICK);
          setC(x, surfaceFloorY + 1, z, B.AIR);
          setC(x, surfaceFloorY + 2, z, B.AIR);
          setC(x, surfaceFloorY + 3, z, B.AIR);
        }
      }
      setC(shaftX - 1, surfaceFloorY + 1, shaftZ - 1, B.TORCH);
      setC(shaftX + 1, first.y, shaftZ + 1, B.TORCH);
    }

    const byChunk = new Map();
    for (const c of cells.values()) {
      const ck = this.key(c.x >> 4, c.z >> 4);
      if (!byChunk.has(ck)) byChunk.set(ck, []);
      byChunk.get(ck).push(c);
    }
    const dgKey = 'D' + k;
    if (!this.structSeen.has(dgKey)) {
      this.structSeen.add(dgKey);
      for (const s of spots) this.dungeonSpots.push(s);
    }
    const res = { byChunk, rooms, key: k, rank: rankInfo.rank, door: rankInfo.door };
    this.dungeonCache.set(k, res);
    return res;
  },

  dungeonCellKeyForPos(x, z) {
    return Math.floor(x / 96) + '|' + Math.floor(z / 96);
  },

  deactivatedDungeonBlockId(id) {
    if (id === B.DUNGEON_BRICK || id === B.DUNGEON_CORE || isDungeonDoor(id)) return B.DUNGEON_BRICK_INACTIVE;
    if (id === B.SPAWNER) return B.AIR;
    return id;
  },

  isProtectedDungeonBlock(x, y, z, id) {
    if (id === B.DUNGEON_CORE || id === B.DUNGEON_BRICK_INACTIVE) return false;
    if (isActiveDungeonBlock(id)) return true;
    const dkey = this.dungeonCellKeyForPos(x, z);
    if (this.dungeonConquered && this.dungeonConquered.has(dkey)) return false;
    const protectedContent = id === B.LOOT_CRATE || id === B.CHEST || id === B.SPAWNER || id === B.LORE || id === B.TORCH;
    if (!protectedContent) return false;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 3; dy++) for (let dz = -2; dz <= 2; dz++) {
      if (isActiveDungeonBlock(this.getBlock(x + dx, y + dy, z + dz))) return true;
    }
    return false;
  },

  deactivateDungeonAt(x, y, z) {
    const dkey = this.dungeonCellKeyForPos(x, z);
    if (!this.dungeonConquered) this.dungeonConquered = new Set();
    this.dungeonConquered.add(dkey);
    const radius = 160;
    const radius2 = radius * radius;
    const touched = new Set();
    for (const ch of this.chunks.values()) {
      const minX = ch.cx * 16, minZ = ch.cz * 16;
      const maxX = minX + 15, maxZ = minZ + 15;
      const nearX = x < minX ? minX : x > maxX ? maxX : x;
      const nearZ = z < minZ ? minZ : z > maxZ ? maxZ : z;
      const ddx = nearX - x, ddz = nearZ - z;
      if (ddx * ddx + ddz * ddz > radius2) continue;
      let changed = false;
      for (let yy = 0; yy < this.H; yy++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const wx = ch.cx * 16 + lx, wz = ch.cz * 16 + lz;
        const dx = wx - x, dz = wz - z;
        if (dx * dx + dz * dz > radius2) continue;
        const idx = this.idx(lx, yy, lz);
        const oldId = ch.blocks[idx];
        const newId = this.deactivatedDungeonBlockId(oldId);
        if (newId === oldId) continue;
        ch.blocks[idx] = newId;
        const pk = this.pkey(wx, yy, wz);
        this.diffs.set(pk, newId);
        const ck = this.key(ch.cx, ch.cz);
        if (!this.diffIndex.has(ck)) this.diffIndex.set(ck, new Map());
        this.diffIndex.get(ck).set(pk, newId);
        if (oldId === B.DUNGEON_CORE) this.lights.delete(pk);
        if (oldId === B.SPAWNER) this.spawners.delete(pk);
        changed = true;
      }
      if (changed) {
        const ck = this.key(ch.cx, ch.cz);
        touched.add(ck);
        if (ch.hasMesh) this.dirty.add(ck);
        this.relightQueue.add(ck);
      }
    }
    if (touched.size && typeof UI !== 'undefined') UI.chat('Dungeon conquered. Its active blocks have gone quiet.', '#c77dff');
    return touched.size;
  },

  // ---------- streaming ----------
  neededChunks(px, pz) {
    const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
    const need = [];
    const R = this.R + 1;
    for (let dcx = -R; dcx <= R; dcx++) {
      for (let dcz = -R; dcz <= R; dcz++) {
        need.push({ cx: pcx + dcx, cz: pcz + dcz, dist: Math.max(Math.abs(dcx), Math.abs(dcz)) });
      }
    }
    need.sort((a, b) => a.dist - b.dist);
    return { need, pcx, pcz };
  },

  update(px, pz, budget, py) {
    budget = budget || 2;
    this.updateVerticalMeshVisibility(py);
    const { need, pcx, pcz } = this.neededChunks(px, pz);
    // in-game (budget 1): time-slice — gen, light and mesh are each ~10-25ms,
    // so stacking them all in one frame made flying stutter. Work not done
    // this frame simply carries over to the next one.
    const t0 = performance.now();
    const inGame = budget === 1;
    const over = () => inGame && (performance.now() - t0 > 12);
    let genned = 0, meshed = 0;
    for (const n of need) {
      const k = this.key(n.cx, n.cz);
      if (!this.chunks.has(k)) {
        if (genned < budget) { this.genChunk(n.cx, n.cz); genned++; }
        else break;
      }
    }
    for (const n of need) {
      if (n.dist > this.R) continue;
      if (inGame && (meshed > 0 || (genned > 0 && over()))) break; // one heavy op per frame in-game
      const ch = this.chunks.get(this.key(n.cx, n.cz));
      if (!ch) continue;
      if (!ch.hasMesh) {
        let ok = true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!this.chunks.has(this.key(n.cx + dx, n.cz + dz))) { ok = false; break; }
        }
        if (ok && meshed < budget) {
          if (!ch.light) {
            this.computeChunkLight(ch);
            this.borderPush(ch); // bleed our light into already-lit neighbors
            // neighbors baked their border faces against our default-lit void:
            // remesh them so dungeon walls etc. pick up the real values
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nb = this.chunks.get(this.key(n.cx + dx, n.cz + dz));
              if (nb && nb.hasMesh) this.dirty.add(this.key(n.cx + dx, n.cz + dz));
            }
          }
          this.buildMesh(ch);
          meshed++;
        }
      }
    }
    // relight verification: time-slice this work. The previous version drained
    // the whole queue after every skylight-blocking edit, so breaking one opaque
    // block could recompute many chunks in the same frame and cause xray-length
    // stalls. Incremental lighting already handles the visible local change; this
    // queue is just a correction pass, so spreading it over frames is safer.
    if (this.relightQueue.size && !over()) {
      // Recompute skylight verification in small grouped clusters.  Doing one
      // chunk at a time let stale light from queued neighbor chunks seed back
      // across borders, so patched roof holes could leave cave light behind.
      const firstKey = this.relightQueue.values().next().value;
      const [baseCx, baseCz] = firstKey.split(',').map(Number);
      const group = [];
      for (const rk of [...this.relightQueue]) {
        const [cx, cz] = rk.split(',').map(Number);
        if (Math.abs(cx - baseCx) <= 1 && Math.abs(cz - baseCz) <= 1) {
          const rc = this.chunks.get(rk);
          this.relightQueue.delete(rk);
          if (rc) group.push(rc);
        }
      }
      // Clear every chunk in the group before any recompute so old cave light
      // cannot be copied from one queued chunk to another.
      for (const rc of group) rc.light = null;
      for (const rc of group) this.computeChunkLight(rc);
      for (const rc of group) {
        this.borderPush(rc);
        if (rc.hasMesh) this.dirty.add(this.key(rc.cx, rc.cz));
      }
    }
    // rebuild dirty chunks with a per-frame budget, nearest first —
    // mass events (fluid cascades, 3x3 mining) spread over frames instead of one spike
    if (this.dirty.size) {
      const list = [...this.dirty].map(k => {
        const parts = k.split(',');
        return { k, d: Math.max(Math.abs(+parts[0] - pcx), Math.abs(+parts[1] - pcz)) };
      }).sort((a, b) => a.d - b.d);
      let rebuilt = 0;
      for (const e of list) {
        // if streaming already ate the frame, let dirty chunks wait a frame
        if (rebuilt >= 2 || (rebuilt >= 1 && over()) || (rebuilt === 0 && (genned || meshed) && over())) break;
        this.dirty.delete(e.k);
        const ch = this.chunks.get(e.k);
        if (ch && ch.hasMesh) {
          if (!ch.light) this.computeChunkLight(ch);
          this.buildMesh(ch);
          rebuilt++;
        }
      }
    }
    for (const ch of this.chunks.values()) {
      if (!ch.hasMesh) continue;
      const dist = Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz));
      if (dist > this.R + 2) this.disposeMesh(ch);
    }
    return { genned, meshed };
  },

  remeshDirtyNow(x, z, maxChunks, radius) {
    if (!this.dirty || !this.dirty.size) return 0;
    const limit = Math.max(1, maxChunks || 16);
    const maxDist = Number.isFinite(+radius) ? Math.max(0, +radius) : Infinity;
    const cx0 = Math.floor(x) >> 4;
    const cz0 = Math.floor(z) >> 4;
    const list = [...this.dirty].map(k => {
      const parts = k.split(',');
      return { k, d: Math.max(Math.abs((+parts[0]) - cx0), Math.abs((+parts[1]) - cz0)) };
    }).filter(e => e.d <= maxDist).sort((a, b) => a.d - b.d);
    let rebuilt = 0;
    for (const e of list) {
      if (rebuilt >= limit) break;
      this.dirty.delete(e.k);
      const ch = this.chunks.get(e.k);
      if (!ch || !ch.hasMesh) continue;
      if (!ch.light) this.computeChunkLight(ch);
      this.buildMesh(ch);
      rebuilt++;
    }
    return rebuilt;
  },

  remeshCellsNow(cells, maxChunks) {
    if (!this.dirty || !this.dirty.size || !Array.isArray(cells) || !cells.length) return 0;
    const keys = new Set();
    for (const cell of cells) {
      if (!cell || cell.length < 3) continue;
      const x = Math.floor(cell[0]), z = Math.floor(cell[2]);
      const cx = x >> 4, cz = z >> 4;
      keys.add(this.key(cx, cz));
      const lx = x & 15, lz = z & 15;
      if (lx === 0) keys.add(this.key(cx - 1, cz));
      if (lx === 15) keys.add(this.key(cx + 1, cz));
      if (lz === 0) keys.add(this.key(cx, cz - 1));
      if (lz === 15) keys.add(this.key(cx, cz + 1));
    }
    let rebuilt = 0;
    const limit = Math.max(1, maxChunks || 4);
    for (const k of keys) {
      if (rebuilt >= limit || !this.dirty.has(k)) continue;
      this.dirty.delete(k);
      const ch = this.chunks.get(k);
      if (!ch || !ch.hasMesh) continue;
      if (!ch.light) this.computeChunkLight(ch);
      this.buildMesh(ch);
      rebuilt++;
    }
    return rebuilt;
  },

  countMissing(px, pz, radius) {
    const { need } = this.neededChunks(px, pz);
    const renderRadius = Number.isFinite(+radius) ? Math.max(0, Math.min(this.R, +radius | 0)) : this.R;
    let missing = 0, total = 0;
    for (const n of need) {
      if (n.dist > renderRadius) continue;
      total++;
      const ch = this.chunks.get(this.key(n.cx, n.cz));
      if (!ch || !ch.hasMesh) missing++;
    }
    return { missing, total };
  },

  disposeMesh(ch) {
    for (const m of ['solidMesh', 'cutoutMesh', 'waterMesh', 'lavaMesh', 'photoMesh']) {
      if (ch[m]) { this.scene.remove(ch[m]); ch[m].geometry.dispose(); ch[m] = null; }
    }
    if (ch.sectionMeshes && ch.sectionMeshes.length) {
      for (const sec of ch.sectionMeshes) {
        for (const m of ['solidMesh', 'cutoutMesh', 'waterMesh', 'lavaMesh', 'photoMesh']) {
          const mesh = sec && sec[m];
          if (!mesh) continue;
          this.scene.remove(mesh);
          if (mesh.geometry) mesh.geometry.dispose();
          sec[m] = null;
        }
      }
      ch.sectionMeshes.length = 0;
    }
    ch.hasMesh = false;
  },

  applyChunkSectionVisibility(ch) {
    if (!ch || !ch.sectionMeshes) return;
    const centerY = Number.isFinite(this.visibleSectionY) ? this.visibleSectionY : 0;
    const radius = Math.max(0, this.VERTICAL_RENDER_RADIUS || 0);
    for (const sec of ch.sectionMeshes) {
      if (!sec) continue;
      const visible = Math.abs((sec.sy | 0) - centerY) <= radius;
      for (const m of ['solidMesh', 'cutoutMesh', 'waterMesh', 'lavaMesh', 'photoMesh']) {
        if (sec[m]) sec[m].visible = visible;
      }
    }
  },

  updateVerticalMeshVisibility(py) {
    if (!Number.isFinite(+py)) return;
    const sectionH = this.CHUNK_H || 16;
    const nextY = Math.floor(+py / sectionH);
    if (nextY === this.visibleSectionY) return;
    this.visibleSectionY = nextY;
    for (const ch of this.chunks.values()) if (ch && ch.hasMesh) this.applyChunkSectionVisibility(ch);
  },

  // ---------- meshing ----------
  FACES: [
    { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.72 },
    { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.72 },
    { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
    { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
    { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.85 },
    { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.85 },
  ],

  buildMesh(ch) {
    const oldMeshes = ['solidMesh', 'cutoutMesh', 'waterMesh', 'lavaMesh', 'photoMesh']
      .map(name => ch[name])
      .filter(Boolean);
    if (ch.sectionMeshes && ch.sectionMeshes.length) {
      for (const sec of ch.sectionMeshes) {
        for (const name of ['solidMesh', 'cutoutMesh', 'waterMesh', 'lavaMesh', 'photoMesh']) {
          if (sec && sec[name]) oldMeshes.push(sec[name]);
        }
      }
    }
    const H = this.H;
    const makeBufs = () => ({
      solid: { pos: [], uv: [], col: [], idx: [] },
      cutout: { pos: [], uv: [], col: [], idx: [] },
      water: { pos: [], uv: [], col: [], idx: [] },
      lava: { pos: [], uv: [], col: [], idx: [] },
      photo: { pos: [], uv: [], col: [], idx: [] },
    });
    const sectionH = this.CHUNK_H || 16;
    const baseSectionCount = Math.max(1, Math.ceil(H / sectionH));
    const sectionMap = new Map();
    const ensureSection = (sy) => {
      sy = Math.floor(+sy || 0);
      let sec = sectionMap.get(sy);
      if (!sec) {
        sec = { sy, y0: sy * sectionH, y1: sy * sectionH + sectionH, bufs: makeBufs() };
        sectionMap.set(sy, sec);
      }
      return sec;
    };
    for (let sy = 0; sy < baseSectionCount; sy++) {
      const sec = ensureSection(sy);
      sec.y1 = Math.min(H, sec.y1);
    }
    if (ch.extraBlocks) {
      for (const pk of ch.extraBlocks.keys()) {
        const y = +(String(pk).split(',')[1]);
        if (Number.isFinite(y)) ensureSection(Math.floor(y / sectionH));
      }
    }
    const bufsForY = (yy) => ensureSection(Math.floor(yy / sectionH)).bufs;
    let bufs = ensureSection(0).bufs;
    const chunkSigns = [];
    const X0 = ch.cx * 16, Z0 = ch.cz * 16;

    // fast block/light access: direct typed-array reads instead of 50k string-keyed
    // Map lookups per rebuild (this WAS the chunk-loading hitch)
    const nbW = this.chunks.get(this.key(ch.cx - 1, ch.cz));
    const nbE = this.chunks.get(this.key(ch.cx + 1, ch.cz));
    const nbN = this.chunks.get(this.key(ch.cx, ch.cz - 1));
    const nbS = this.chunks.get(this.key(ch.cx, ch.cz + 1));
    const resolve = (wx, wz) => {
      const lx = wx - X0, lz = wz - Z0;
      if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) return [ch, lx, lz];
      if (lx === -1) return [nbW, 15, lz];
      if (lx === 16) return [nbE, 0, lz];
      if (lz === -1) return [nbN, lx, 15];
      if (lz === 16) return [nbS, lx, 0];
      return [null, 0, 0];
    };
    const gb = (wx, y, wz) => {
      if (y < 0) return B.AIR; // below the generated world is true void, not invisible bedrock
      const [c, ax, az] = resolve(wx, wz);
      if (!c) return y < H ? B.STONE : B.AIR;
      if (y < H) return c.blocks[(y << 8) + (az << 4) + ax];
      return this.extraBlock(c, wx, y, wz);
    };
    const gl = (wx, y, wz) => {
      if (y >= H) return 0xF0;
      if (y < 0) return 0;
      const [c, ax, az] = resolve(wx, wz);
      if (!c || !c.light) return 0xF0;
      return c.light[(y << 8) + (az << 4) + ax];
    };

    const lightAt = (x, y, z) => {
      const raw = gl(x, y, z);
      return [(raw & 15) / 15, (raw >> 4) / 15];
    };

    const pushQuad = (b, verts, uvr, uvs, shade, lb, ls) => {
      const base = b.pos.length / 3;
      for (let i = 0; i < 4; i++) {
        b.pos.push(verts[i][0], verts[i][1], verts[i][2]);
        const u = uvr.u0 + (uvr.u1 - uvr.u0) * uvs[i][0];
        const v = uvr.v0 + (uvr.v1 - uvr.v0) * uvs[i][1];
        b.uv.push(u, v);
        b.col.push(shade, lb, ls);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const rotUVQ = (n) => n === 0 ? UVQ : UVQ.map((_, i) => UVQ[(i + n) % 4]);

    const emitBox = (buf, wx, y, wz, x0, y0, z0, x1, y1, z1, texTop, texSide, texBottom, topRot, selfLight, skipFaces) => {
      const uvT = Atlas.uv(texTop), uvS = Atlas.uv(texSide), uvB = Atlas.uv(texBottom);
      const cropUV = (uvr, a0, b0, a1, b1) => ({
        u0: uvr.u0 + (uvr.u1 - uvr.u0) * a0, u1: uvr.u0 + (uvr.u1 - uvr.u0) * a1,
        v0: uvr.v0 + (uvr.v1 - uvr.v0) * b0, v1: uvr.v0 + (uvr.v1 - uvr.v0) * b1,
      });
      for (let f = 0; f < 6; f++) {
        if (skipFaces && skipFaces.has && skipFaces.has(f)) continue;
        const face = this.FACES[f];
        const flush =
          (f === 0 && x1 === 1) || (f === 1 && x0 === 0) || (f === 2 && y1 === 1) ||
          (f === 3 && y0 === 0) || (f === 4 && z1 === 1) || (f === 5 && z0 === 0);
        let lb, ls;
        if (flush) {
          const nb = gb(wx + face.d[0], y + face.d[1], wz + face.d[2]);
          const nbDef = Reg[nb];
          if (nbDef && nbDef.block && nbDef.opaque) continue;
          [lb, ls] = lightAt(wx + face.d[0], y + face.d[1], wz + face.d[2]);
        } else {
          [lb, ls] = selfLight || lightAt(wx, y, wz);
        }
        const map = (cx, cy, cz) => [
          wx + x0 + cx * (x1 - x0),
          y + y0 + cy * (y1 - y0),
          wz + z0 + cz * (z1 - z0),
        ];
        const verts = face.c.map(cn => map(cn[0], cn[1], cn[2]));
        let uvr, uvs = UVQ;
        if (f === 2) { uvr = cropUV(uvT, x0, z0, x1, z1); if (topRot) uvs = rotUVQ(topRot); }
        else if (f === 3) uvr = cropUV(uvB, x0, z0, x1, z1);
        else if (f < 2) uvr = cropUV(uvS, z0, y0, z1, y1);
        else uvr = cropUV(uvS, x0, y0, x1, y1);
        pushQuad(buf, verts, uvr, uvs, face.shade, lb, ls);
      }
    };


    // Glass slabs/stairs are real transparent geometry now.  Rendering them as
    // a pile of boxes made every internal/shared plane visible through the glass
    // (stair riser hidden inside the slab, two horizontal slabs meeting at y=0.5,
    // glass block touching glass slab/stair, etc.).  These helpers subtract the
    // exact glass-on-glass contact rectangles before emitting quads, so connected
    // glass behaves like the existing full glass/leaves rule instead of z-fighting.
    const GLASS_EPS = 1e-5;
    const ZFIGHT_FACE_NUDGE = 0.0015; // tiny visual-only inset for coplanar transparent faces
    const isGlassDSlab = (bid) => !!(typeof DSLAB_MATS !== 'undefined' && DSLAB_MATS[bid] && DSLAB_MATS[bid][0] === 'glass' && DSLAB_MATS[bid][1] === 'glass');
    const isGlassVSlab = (bid) => {
      const part = (typeof slabPartInfo === 'function') ? slabPartInfo(bid) : null;
      return !!(part && part.mat === 'glass' && part.orient !== 'bottom' && part.orient !== 'top');
    };
    const glassSlabComboParts = (bid) => {
      const parts = (typeof SLAB_COMBO_PIECES !== 'undefined') ? SLAB_COMBO_PIECES[bid] : null;
      return (parts && parts.length && parts.every(p => p.mat === 'glass')) ? parts : null;
    };
    const isJoinedGlassBlock = (bid) => {
      if (bid === B.GLASS || bid === B.GLASS_SLAB_B || bid === B.GLASS_SLAB_T || isGlassDSlab(bid) || isGlassVSlab(bid) || glassSlabComboParts(bid)) return true;
      const si = stairInfo(bid);
      return !!(si && si.mat === 'glass');
    };
    const localGlassBoxes = (bid, bx, by, bz) => {
      if (bid === B.GLASS) return [[0, 0, 0, 1, 1, 1]];
      if (bid === B.GLASS_SLAB_B) return [[0, 0, 0, 1, 0.5, 1]];
      if (bid === B.GLASS_SLAB_T) return [[0, 0.5, 0, 1, 1, 1]];
      if (isGlassDSlab(bid)) return [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 1]];
      if (isGlassVSlab(bid)) {
        const bo = slabBoxForId(bid);
        return bo ? [bo] : [];
      }
      const comboParts = glassSlabComboParts(bid);
      if (comboParts) return comboParts.map(p => slabPartBox(p)).filter(Boolean);
      const si = stairInfo(bid);
      if (si && si.mat === 'glass') return Physics.stairBoxes(bid, bx, by, bz);
      return [];
    };
    const worldGlassBoxes = (bid, bx, by, bz) => localGlassBoxes(bid, bx, by, bz).map(bo => [
      bx + bo[0], by + bo[1], bz + bo[2], bx + bo[3], by + bo[4], bz + bo[5],
    ]);
    const toWorldBoxes = (boxes, bx, by, bz) => (boxes || []).filter(Boolean).map(bo => [
      bx + bo[0], by + bo[1], bz + bo[2], bx + bo[3], by + bo[4], bz + bo[5],
    ]);
    const renderBoxesForId = (bid, bx, by, bz) => {
      const bd = Reg[bid];
      if (!bd || !bd.block || bid === B.AIR || isFluid(bid)) return [];
      if (isJoinedGlassBlock(bid)) return worldGlassBoxes(bid, bx, by, bz);
      switch (bd.shape) {
        case 'cube': case 'mega': return [[bx, by, bz, bx + 1, by + 1, bz + 1]];
        case 'slabB': return [[bx, by, bz, bx + 1, by + 0.5, bz + 1]];
        case 'slabT': return [[bx, by + 0.5, bz, bx + 1, by + 1, bz + 1]];
        case 'vslab': return toWorldBoxes([slabBoxForId(bid)], bx, by, bz);
        case 'dslab': return [[bx, by, bz, bx + 1, by + 1, bz + 1]];
        case 'slabCombo': return toWorldBoxes(slabComboBoxes(bid), bx, by, bz);
        case 'stairs': return toWorldBoxes(Physics.stairBoxes(bid, bx, by, bz), bx, by, bz);
        case 'snow': return [[bx, by, bz, bx + 1, by + snowSheetLevel(bid) / 8, bz + 1]];
        case 'cactus': return [[bx + 0.07, by, bz + 0.07, bx + 0.93, by + 1, bz + 0.93]];
        case 'door': return isDoorX(bid) ? [[bx + 0.38, by, bz + 0.02, bx + 0.62, by + 1, bz + 0.98]] : [[bx + 0.02, by, bz + 0.38, bx + 0.98, by + 1, bz + 0.62]];
        case 'doorOpen': return isDoorX(bid) ? [[bx + 0.02, by, bz + 0.02, bx + 0.98, by + 1, bz + 0.18]] : [[bx + 0.02, by, bz + 0.02, bx + 0.18, by + 1, bz + 0.98]];
        case 'dungeonDoor': return dungeonDoorAxisAt(bid, bx, by, bz) === 'x'
          ? [[bx + 0.38, by, bz + 0.02, bx + 0.62, by + 1, bz + 0.98]]
          : [[bx + 0.02, by, bz + 0.38, bx + 0.98, by + 1, bz + 0.62]];
        case 'bed': return [[bx, by, bz, bx + 1, by + 0.56, bz + 1]];
        case 'planter': case 'crop': {
          const yOff = this.plantationYOffset ? this.plantationYOffset(bx, by, bz) : 0;
          return [[bx, by + yOff, bz, bx + 1, by + yOff + 0.42, bz + 1]];
        }
        default:
          return bd.solid ? [[bx, by, bz, bx + 1, by + 1, bz + 1]] : [];
      }
    };
    const rectOverlap = (a, b) => {
      const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]);
      const x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]);
      return (x1 - x0 > GLASS_EPS && y1 - y0 > GLASS_EPS) ? [x0, y0, x1, y1] : null;
    };
    const subtractRect = (rects, cut) => {
      const out = [];
      for (const r of rects) {
        const o = rectOverlap(r, cut);
        if (!o) { out.push(r); continue; }
        if (o[0] - r[0] > GLASS_EPS) out.push([r[0], r[1], o[0], r[3]]);
        if (r[2] - o[2] > GLASS_EPS) out.push([o[2], r[1], r[2], r[3]]);
        if (o[1] - r[1] > GLASS_EPS) out.push([o[0], r[1], o[2], o[1]]);
        if (r[3] - o[3] > GLASS_EPS) out.push([o[0], o[3], o[2], r[3]]);
      }
      return out;
    };
    const faceRect = (bo, f) => {
      if (f < 2) return [bo[2], bo[1], bo[5], bo[4]];      // z/y on +/-x faces
      if (f < 4) return [bo[0], bo[2], bo[3], bo[5]];      // x/z on +/-y faces
      return [bo[0], bo[1], bo[3], bo[4]];                 // x/y on +/-z faces
    };
    const boxRectOnFace = (ob, f) => {
      if (f < 2) return [ob[2], ob[1], ob[5], ob[4]];
      if (f < 4) return [ob[0], ob[2], ob[3], ob[5]];
      return [ob[0], ob[1], ob[3], ob[4]];
    };
    const matchingFacePlane = (bo, ob, f) => {
      if (f === 0) return Math.abs(ob[0] - bo[3]) < GLASS_EPS;
      if (f === 1) return Math.abs(ob[3] - bo[0]) < GLASS_EPS;
      if (f === 2) return Math.abs(ob[1] - bo[4]) < GLASS_EPS;
      if (f === 3) return Math.abs(ob[4] - bo[1]) < GLASS_EPS;
      if (f === 4) return Math.abs(ob[2] - bo[5]) < GLASS_EPS;
      return Math.abs(ob[5] - bo[2]) < GLASS_EPS;
    };
    const glassVerts = (bo, f, r) => {
      if (f === 0) return [[bo[3], r[1], r[2]], [bo[3], r[1], r[0]], [bo[3], r[3], r[0]], [bo[3], r[3], r[2]]];
      if (f === 1) return [[bo[0], r[1], r[0]], [bo[0], r[1], r[2]], [bo[0], r[3], r[2]], [bo[0], r[3], r[0]]];
      if (f === 2) return [[r[0], bo[4], r[3]], [r[2], bo[4], r[3]], [r[2], bo[4], r[1]], [r[0], bo[4], r[1]]];
      if (f === 3) return [[r[0], bo[1], r[1]], [r[2], bo[1], r[1]], [r[2], bo[1], r[3]], [r[0], bo[1], r[3]]];
      if (f === 4) return [[r[0], r[1], bo[5]], [r[2], r[1], bo[5]], [r[2], r[3], bo[5]], [r[0], r[3], bo[5]]];
      return [[r[2], r[1], bo[2]], [r[0], r[1], bo[2]], [r[0], r[3], bo[2]], [r[2], r[3], bo[2]]];
    };
    const insetFaceVerts = (verts, f, amt = ZFIGHT_FACE_NUDGE) => {
      // Move the current face a hair back into its own block. This separates
      // coplanar transparent/cutout faces without deleting or cropping textures.
      const d = this.FACES[f].d;
      return verts.map(v => [v[0] - d[0] * amt, v[1] - d[1] * amt, v[2] - d[2] * amt]);
    };
    const hasCoplanarNonJoinedNeighbor = (bo, f, selfWx, selfY, selfWz, selfId) => {
      const fr = faceRect(bo, f);
      for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        const bx = selfWx + ox, by = selfY + oy, bz = selfWz + oz;
        const bid = (ox === 0 && oy === 0 && oz === 0) ? selfId : gb(bx, by, bz);
        if (bid === B.AIR || isFluid(bid) || isJoinedGlassBlock(bid)) continue;
        const bd = Reg[bid];
        if (!bd || !bd.block) continue;
        for (const ob of renderBoxesForId(bid, bx, by, bz)) {
          if (!matchingFacePlane(bo, ob, f)) continue;
          if (rectOverlap(fr, boxRectOnFace(ob, f))) return true;
        }
      }
      return false;
    };
    const cropGlassUV = (uvr, bo, f, r) => {
      const lx0 = bo[0] - Math.floor(bo[0]), ly0 = bo[1] - Math.floor(bo[1]), lz0 = bo[2] - Math.floor(bo[2]);
      const toU = (a) => uvr.u0 + (uvr.u1 - uvr.u0) * a;
      const toV = (b) => uvr.v0 + (uvr.v1 - uvr.v0) * b;
      let a0, b0, a1, b1;
      if (f < 2) { a0 = r[0] - Math.floor(bo[2]); b0 = r[1] - Math.floor(bo[1]); a1 = r[2] - Math.floor(bo[2]); b1 = r[3] - Math.floor(bo[1]); }
      else if (f < 4) { a0 = r[0] - Math.floor(bo[0]); b0 = r[1] - Math.floor(bo[2]); a1 = r[2] - Math.floor(bo[0]); b1 = r[3] - Math.floor(bo[2]); }
      else { a0 = r[0] - Math.floor(bo[0]); b0 = r[1] - Math.floor(bo[1]); a1 = r[2] - Math.floor(bo[0]); b1 = r[3] - Math.floor(bo[1]); }
      return { u0: toU(a0), v0: toV(b0), u1: toU(a1), v1: toV(b1) };
    };
    const emitJoinedGlass = (wx, y, wz, id) => {
      const boxes = worldGlassBoxes(id, wx, y, wz);
      if (!boxes.length) return false;
      const tx = 'glass';
      const uvGlass = Atlas.uv(tx);
      const occluders = [];
      for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        const bx = wx + ox, by = y + oy, bz = wz + oz;
        const bid = (ox === 0 && oy === 0 && oz === 0) ? id : gb(bx, by, bz);
        if (isJoinedGlassBlock(bid)) {
          // Only glass-on-glass contacts are subtracted. Non-glass neighbors and
          // leaves keep their full texture; coplanar faces get a tiny visual inset
          // later instead of being cropped away.
          occluders.push(...worldGlassBoxes(bid, bx, by, bz));
        }
      }
      for (const bo of boxes) {
        for (let f = 0; f < 6; f++) {
          const face = this.FACES[f];
          const plane = f === 0 ? bo[3] : f === 1 ? bo[0] : f === 2 ? bo[4] : f === 3 ? bo[1] : f === 4 ? bo[5] : bo[2];
          const flush =
            (f === 0 && Math.abs(plane - (wx + 1)) < GLASS_EPS) ||
            (f === 1 && Math.abs(plane - wx) < GLASS_EPS) ||
            (f === 2 && Math.abs(plane - (y + 1)) < GLASS_EPS) ||
            (f === 3 && Math.abs(plane - y) < GLASS_EPS) ||
            (f === 4 && Math.abs(plane - (wz + 1)) < GLASS_EPS) ||
            (f === 5 && Math.abs(plane - wz) < GLASS_EPS);
          let lb, ls;
          if (flush) {
            const nb = gb(wx + face.d[0], y + face.d[1], wz + face.d[2]);
            const nbDef = Reg[nb];
            if (nbDef && nbDef.block && nbDef.opaque) continue;
            [lb, ls] = lightAt(wx + face.d[0], y + face.d[1], wz + face.d[2]);
          } else {
            [lb, ls] = lightAt(wx, y, wz);
          }
          let rects = [faceRect(bo, f)];
          for (const ob of occluders) {
            if (ob === bo) continue;
            if (!matchingFacePlane(bo, ob, f)) continue;
            rects = subtractRect(rects, boxRectOnFace(ob, f));
            if (!rects.length) break;
          }
          const insetGlassFace = hasCoplanarNonJoinedNeighbor(bo, f, wx, y, wz, id);
          for (const r of rects) {
            if (r[2] - r[0] <= GLASS_EPS || r[3] - r[1] <= GLASS_EPS) continue;
            const gv = glassVerts(bo, f, r);
            pushQuad(bufs.cutout, insetGlassFace ? insetFaceVerts(gv, f) : gv, cropGlassUV(uvGlass, bo, f, r), UVQ, face.shade, lb, ls);
          }
        }
      }
      return true;
    };

    const emitTrimmedCutoutCube = (wx, y, wz, id, def) => {
      const bo = [wx, y, wz, wx + 1, y + 1, wz + 1];
      const target = bufs.cutout;
      for (let f = 0; f < 6; f++) {
        const face = this.FACES[f];
        const nx = wx + face.d[0], ny = y + face.d[1], nz = wz + face.d[2];
        const nb = gb(nx, ny, nz);
        const nbDef = Reg[nb];
        let visible = false;
        let trimAgainstNeighbor = false;

        if (nb === B.AIR || isFluid(nb)) {
          visible = true;
        } else if (nbDef && nbDef.block && !nbDef.opaque) {
          if (nbDef.cutout && nbDef.shape === 'cube') {
            // Same rule as the old full-cube cutout path: between two leaves /
            // full transparent cubes, only one side emits the shared face.
            visible = id < nb;
          } else {
            visible = true;
            trimAgainstNeighbor = true;
          }
        }

        if (!visible) continue;

        let rects = [faceRect(bo, f)];
        if (trimAgainstNeighbor) {
          for (const ob of renderBoxesForId(nb, nx, ny, nz)) {
            if (!matchingFacePlane(bo, ob, f)) continue;
            rects = subtractRect(rects, boxRectOnFace(ob, f));
            if (!rects.length) break;
          }
        }

        const texName = Atlas.texName(id, f === 2 ? 'top' : f === 3 ? 'bottom' : 'side');
        const uvr = Atlas.uv(texName);
        const [lb, ls] = lightAt(nx, ny, nz);
        for (const r of rects) {
          if (r[2] - r[0] <= GLASS_EPS || r[3] - r[1] <= GLASS_EPS) continue;
          pushQuad(target, glassVerts(bo, f, r), cropGlassUV(uvr, bo, f, r), UVQ, face.shade, lb, ls);
        }
      }
      return true;
    };

    const slabPieceBuffer = (part, fallbackDef) => {
      const partDef = (part && Reg[SLAB_OF[part.mat]]) || fallbackDef;
      return (partDef && partDef.cutout) ? bufs.cutout : bufs.solid;
    };
    const sharedSlabFaces = (a, b) => {
      // Face indexes follow World.FACES: +x,-x,+y,-y,+z,-z.
      if (Math.abs(a[3] - b[0]) < GLASS_EPS) return [[0], [1]];
      if (Math.abs(a[0] - b[3]) < GLASS_EPS) return [[1], [0]];
      if (Math.abs(a[4] - b[1]) < GLASS_EPS) return [[2], [3]];
      if (Math.abs(a[1] - b[4]) < GLASS_EPS) return [[3], [2]];
      if (Math.abs(a[5] - b[2]) < GLASS_EPS) return [[4], [5]];
      if (Math.abs(a[2] - b[5]) < GLASS_EPS) return [[5], [4]];
      return [[], []];
    };
    const emitSlabPieces = (wx, y, wz, parts, fallbackDef) => {
      const boxes = parts.map(part => slabPartBox(part));
      const hidden = boxes.map(() => new Set());
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (!boxes[i] || !boxes[j]) continue;
          const [ai, bj] = sharedSlabFaces(boxes[i], boxes[j]);
          if (!ai.length && !bj.length) continue;

          const aGlass = parts[i] && parts[i].mat === 'glass';
          const bGlass = parts[j] && parts[j].mat === 'glass';

          // Two slab pieces can share the exact same internal plane.  If both
          // pieces draw it, transparent glass makes that plane z-fight.  For
          // glass + normal material, keep the normal material face visible and
          // hide only the glass face.  For glass + glass, hide both.  For two
          // non-glass pieces, hide both because the inside is never visible.
          if (aGlass && !bGlass) {
            for (const f of ai) hidden[i].add(f);
          } else if (!aGlass && bGlass) {
            for (const f of bj) hidden[j].add(f);
          } else {
            for (const f of ai) hidden[i].add(f);
            for (const f of bj) hidden[j].add(f);
          }
        }
      }
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i], bo = boxes[i];
        if (!part || !bo) continue;
        const tx = SLAB_TEX[part.mat];
        emitBox(slabPieceBuffer(part, fallbackDef), wx, y, wz, bo[0], bo[1], bo[2], bo[3], bo[4], bo[5], tx, tx, tx, null, null, hidden[i]);
      }
    };

    // yaw-rotated box (for 45° signs) — same rotation convention as
    // three.js rotation.y, so the board faces where its text faces
    const emitYawBox = (buf, cx, cy, cz, hw, hh, hd, yaw, tex, selfLight) => {
      const uvr = Atlas.uv(tex);
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
      const rot = (dx, dz) => [cx + dx * cosY + dz * sinY, cz - dx * sinY + dz * cosY];
      const [lb, ls] = selfLight;
      const corners = [];
      for (const [dx, dz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) corners.push(rot(dx, dz));
      // 4 sides
      for (let i = 0; i < 4; i++) {
        const a = corners[i], b2 = corners[(i + 1) % 4];
        pushQuad(buf, [
          [a[0], cy - hh, a[1]], [b2[0], cy - hh, b2[1]], [b2[0], cy + hh, b2[1]], [a[0], cy + hh, a[1]],
        ], uvr, UVQ, 0.8, lb, ls);
      }
      // top + bottom
      pushQuad(buf, [
        [corners[3][0], cy + hh, corners[3][1]], [corners[2][0], cy + hh, corners[2][1]],
        [corners[1][0], cy + hh, corners[1][1]], [corners[0][0], cy + hh, corners[0][1]],
      ], uvr, UVQ, 1.0, lb, ls);
      pushQuad(buf, [
        [corners[0][0], cy - hh, corners[0][1]], [corners[1][0], cy - hh, corners[1][1]],
        [corners[2][0], cy - hh, corners[2][1]], [corners[3][0], cy - hh, corners[3][1]],
      ], uvr, UVQ, 0.55, lb, ls);
    };

    const emitPhotoCube = (buf, wx, y, wz) => {
      const full = { u0: 0, v0: 0, u1: 1, v1: 1 };
      const rot = (this.photoDirs.get(this.pkey(wx, y, wz)) | 0) & 3;
      const topUVs = rot ? rotUVQ(rot) : UVQ;
      const bottomUVs = rot ? rotUVQ(rot) : UVQ;
      for (let f = 0; f < 6; f++) {
        const face = this.FACES[f];
        const nx = wx + face.d[0], ny = y + face.d[1], nz = wz + face.d[2];
        const nb = gb(nx, ny, nz);
        const nbDef = Reg[nb];
        let visible;
        if (nb === B.AIR) visible = true;
        else if (isFluid(nb)) visible = true;
        else if (nbDef && !nbDef.opaque) visible = true;
        else visible = false;
        if (!visible) continue;
        const verts = face.c.map(cn => [wx + cn[0], y + cn[1], wz + cn[2]]);
        const [lb, ls] = lightAt(nx, ny, nz);
        const faceUVs = f === 2 ? topUVs : (f === 3 ? bottomUVs : UVQ);
        pushQuad(buf, verts, full, faceUVs, face.shade, lb, ls);
      }
    };

    const crossQuads = (buf, wx, y, wz, texName, ox, oy, shear, scale, selfL) => {
      const uvr = Atlas.uv(texName);
      const s = (scale || 1) * 0.5;
      const cxx = wx + 0.5 + (ox ? ox[0] : 0), czz = wz + 0.5 + (ox ? ox[2] : 0);
      const yy = y + (oy || 0);
      const hgt = scale || 1;
      const lean = (v) => {
        if (!shear) return v;
        const f = (v[1] - yy) / hgt;
        return [v[0] + shear[0] * f, v[1], v[2] + shear[2] * f];
      };
      const [lb, ls] = selfL || lightAt(wx, y, wz);
      const v1 = [[cxx - s, yy, czz - s], [cxx + s, yy, czz + s], [cxx + s, yy + hgt, czz + s], [cxx - s, yy + hgt, czz - s]].map(lean);
      const v2 = [[cxx - s, yy, czz + s], [cxx + s, yy, czz - s], [cxx + s, yy + hgt, czz - s], [cxx - s, yy + hgt, czz + s]].map(lean);
      pushQuad(buf, v1, uvr, UVQ, 1.0, lb, ls);
      pushQuad(buf, v2, uvr, UVQ, 1.0, lb, ls);
    };

    // Plantation pots are a 3x3 multiblock. Render only the outside walls/rims
    // so neighboring cells do not draw coplanar faces against each other, which
    // caused z-fighting. Crop cells call this too, so planted cells keep the pot rim.
    const emitPlanterCell = (wx, y, wz) => {
      const isPotLike = (bid) => bid === B.PLANTATION_POT || isCrop(bid);
      const uvSoil = Atlas.uv('planter_soil');
      const uvSide = Atlas.uv('planter_side');
      const uvBottom = Atlas.uv('planter_bottom');
      const [lb, ls] = lightAt(wx, y, wz);
      const yOff = this.plantationYOffset(wx, y, wz);
      const underSlab = this.plantationUnderSlabs.get(this.pkey(wx, y, wz));

      // Raised Plantation Pot: keep the original 3x3 lower slabs visible and
      // put the planter tray in the upper half of those same block cells.
      if (underSlab) {
        const part = slabPartInfo(underSlab);
        const tx = part ? SLAB_TEX[part.mat] : Atlas.texName(underSlab, 'side');
        const baseDef = part ? Reg[SLAB_OF[part.mat]] : Reg[underSlab];
        const baseBuf = (baseDef && baseDef.cutout) ? bufs.cutout : bufs.solid;
        const skip = new Set();
        // If the saved support slab is glass, keep it in the transparent pass
        // and hide faces that touch other preserved foundation slabs. Otherwise
        // the glass face and the neighbor slab face draw on the exact same plane
        // and shimmer through the transparent texture.
        if (part && part.mat === 'glass') {
          const hasUnder = (ax, az) => !!this.plantationUnderSlabs.get(this.pkey(ax, y, az));
          if (hasUnder(wx + 1, wz)) skip.add(0);
          if (hasUnder(wx - 1, wz)) skip.add(1);
          if (hasUnder(wx, wz + 1)) skip.add(4);
          if (hasUnder(wx, wz - 1)) skip.add(5);
        }
        emitBox(baseBuf, wx, y, wz, 0, 0, 0, 1, 0.5, 1, tx, tx, tx, null, null, skip);
      }

      const sameLevelPot = (ax, az) => isPotLike(gb(ax, y, az)) && this.plantationYOffset(ax, y, az) === yOff;
      const yBase = y + yOff;
      const yTop = y + yOff + 0.28;
      pushQuad(bufs.solid, [
        [wx, yTop, wz + 1], [wx + 1, yTop, wz + 1], [wx + 1, yTop, wz], [wx, yTop, wz],
      ], uvSoil, UVQ, 1.0, lb, ls);
      // real underside texture, visible if the support block is broken/removed
      const yBottom = y + yOff + 0.015; // lift underside slightly so transparent supports do not z-fight
      pushQuad(bufs.solid, [
        [wx, yBottom, wz], [wx + 1, yBottom, wz], [wx + 1, yBottom, wz + 1], [wx, yBottom, wz + 1],
      ], uvBottom, UVQ, 0.55, lb, ls);
      const sideFace = (verts, shade) => pushQuad(bufs.solid, verts, uvSide, UVQ, shade, lb, ls);
      if (!sameLevelPot(wx + 1, wz)) sideFace([[wx + 1, yBase, wz + 1], [wx + 1, yBase, wz], [wx + 1, yTop, wz], [wx + 1, yTop, wz + 1]], 0.72);
      if (!sameLevelPot(wx - 1, wz)) sideFace([[wx, yBase, wz], [wx, yBase, wz + 1], [wx, yTop, wz + 1], [wx, yTop, wz]], 0.72);
      if (!sameLevelPot(wx, wz + 1)) sideFace([[wx, yBase, wz + 1], [wx + 1, yBase, wz + 1], [wx + 1, yTop, wz + 1], [wx, yTop, wz + 1]], 0.85);
      if (!sameLevelPot(wx, wz - 1)) sideFace([[wx + 1, yBase, wz], [wx, yBase, wz], [wx, yTop, wz], [wx + 1, yTop, wz]], 0.85);
      if (!sameLevelPot(wx, wz - 1)) emitBox(bufs.solid, wx, y, wz, 0, yOff + 0.28, 0, 1, yOff + 0.42, 0.12, 'planter_side', 'planter_side', 'planter_side');
      if (!sameLevelPot(wx, wz + 1)) emitBox(bufs.solid, wx, y, wz, 0, yOff + 0.28, 0.88, 1, yOff + 0.42, 1, 'planter_side', 'planter_side', 'planter_side');
      if (!sameLevelPot(wx - 1, wz)) emitBox(bufs.solid, wx, y, wz, 0, yOff + 0.28, 0.12, 0.12, yOff + 0.42, 0.88, 'planter_side', 'planter_side', 'planter_side');
      if (!sameLevelPot(wx + 1, wz)) emitBox(bufs.solid, wx, y, wz, 0.88, yOff + 0.28, 0.12, 1, yOff + 0.42, 0.88, 'planter_side', 'planter_side', 'planter_side');
    };

    for (let y = 0; y < H; y++) {
      bufs = bufsForY(y);
      for (let lz = 0; lz < 16; lz++) {
        for (let lx = 0; lx < 16; lx++) {
          const id = ch.blocks[this.idx(lx, y, lz)];
          if (id === B.AIR) continue;
          const wx = X0 + lx, wz = Z0 + lz;
          const def = Reg[id];

          if (isWater(id)) { this.meshFluid(bufs.water, pushQuad, wx, y, wz, id, false, lightAt, gb); continue; }
          if (isLava(id)) { this.meshFluid(bufs.lava, pushQuad, wx, y, wz, id, true, lightAt, gb); continue; }

          if (id === B.MR_FLOOP_DRINKING_WATER) {
            emitPhotoCube(bufs.photo, wx, y, wz);
            continue;
          }

          if (isJoinedGlassBlock(id) && emitJoinedGlass(wx, y, wz, id)) continue;

          // Full cutout cubes such as leaves should keep their whole texture.
          // Do not trim/crop them against glass, slabs, or stairs; z-fighting is
          // handled below by nudging only the drawn face by a tiny amount.

          switch (def.shape) {
            case 'cross':
              crossQuads(bufs.cutout, wx, y, wz, Atlas.texName(id, 'side'), null, 0);
              continue;
            case 'mega':
              crossQuads(bufs.cutout, wx, y, wz, 'mega_torch', null, 0, null, 2);
              continue;
            case 'wtorch': {
              const d = WTORCH_DIR[id];
              crossQuads(bufs.cutout, wx, y, wz, 'torch',
                [-d[0] * 0.38, 0, -d[2] * 0.38], 0.12,
                [d[0] * 0.42, 0, d[2] * 0.42]);
              continue;
            }
            case 'ladder': {
              const d = LADDER_DIR[id];
              const tx = 'ladder';
              if (d[0] === 1) emitBox(bufs.cutout, wx, y, wz, 0.02, 0, 0, 0.1, 1, 1, tx, tx, tx);
              else if (d[0] === -1) emitBox(bufs.cutout, wx, y, wz, 0.9, 0, 0, 0.98, 1, 1, tx, tx, tx);
              else if (d[2] === 1) emitBox(bufs.cutout, wx, y, wz, 0, 0, 0.02, 1, 1, 0.1, tx, tx, tx);
              else emitBox(bufs.cutout, wx, y, wz, 0, 0, 0.9, 1, 1, 0.98, tx, tx, tx);
              continue;
            }
            case 'slabB':
              emitBox(def.cutout ? bufs.cutout : bufs.solid, wx, y, wz, 0, 0, 0, 1, 0.5, 1, Atlas.texName(id, 'top'), Atlas.texName(id, 'side'), Atlas.texName(id, 'bottom'));
              continue;
            case 'slabT':
              emitBox(def.cutout ? bufs.cutout : bufs.solid, wx, y, wz, 0, 0.5, 0, 1, 1, 1, Atlas.texName(id, 'top'), Atlas.texName(id, 'side'), Atlas.texName(id, 'bottom'));
              continue;
            case 'vslab': {
              const part = slabPartInfo(id);
              const bo = slabPartBox(part);
              const tx = SLAB_TEX[part.mat];
              const partDef = Reg[SLAB_OF[part.mat]] || def;
              emitBox(partDef.cutout ? bufs.cutout : bufs.solid, wx, y, wz, bo[0], bo[1], bo[2], bo[3], bo[4], bo[5], tx, tx, tx);
              continue;
            }
            case 'dslab': {
              const [botM, topM] = DSLAB_MATS[id];
              emitSlabPieces(wx, y, wz, [
                { mat: botM, orient: 'bottom' },
                { mat: topM, orient: 'top' },
              ], def);
              continue;
            }
            case 'slabCombo': {
              emitSlabPieces(wx, y, wz, SLAB_COMBO_PIECES[id] || [], def);
              continue;
            }
            case 'stairs': {
              const tx = Atlas.texName(id, 'side');
              const stairBuf = def.cutout ? bufs.cutout : bufs.solid;
              for (const bo of Physics.stairBoxes(id, wx, y, wz)) {
                emitBox(stairBuf, wx, y, wz, bo[0], bo[1], bo[2], bo[3], bo[4], bo[5], tx, tx, tx);
              }
              continue;
            }
            case 'snow': {
              const hgt = snowSheetLevel(id) / 8;
              emitBox(bufs.solid, wx, y, wz, 0, 0, 0, 1, hgt, 1, 'snow', 'snow', 'snow');
              continue;
            }
            case 'planter':
              emitPlanterCell(wx, y, wz);
              continue;
            case 'crop': {
              emitPlanterCell(wx, y, wz);
              const tx = Atlas.texName(id, 'all');
              const st = cropStage(id);
              const scale = 0.46 + st * 0.17;
              crossQuads(bufs.cutout, wx, y, wz, tx, null, 0.28 + this.plantationYOffset(wx, y, wz), null, scale);
              continue;
            }
            case 'portalH': {
              const uvr = Atlas.uv('merry_portal');
              const yy = y - 0.445;
              const [lb, ls] = lightAt(wx, y, wz);
              pushQuad(bufs.cutout, [[wx, yy, wz], [wx + 1, yy, wz], [wx + 1, yy, wz + 1], [wx, yy, wz + 1]], uvr, UVQ, 1.0, Math.max(lb, 12), Math.max(ls, 12));
              continue;
            }
            case 'cactus':
              emitBox(bufs.solid, wx, y, wz, 0.07, 0, 0.07, 0.93, 1, 0.93, Atlas.texName(id, 'top'), Atlas.texName(id, 'side'), Atlas.texName(id, 'bottom'));
              continue;
            case 'door': {
              const tx = Atlas.texName(id, 'side');
              if (isDoorX(id)) emitBox(bufs.solid, wx, y, wz, 0.38, 0, 0.02, 0.62, 1, 0.98, tx, tx, tx);
              else emitBox(bufs.solid, wx, y, wz, 0.02, 0, 0.38, 0.98, 1, 0.62, tx, tx, tx);
              continue;
            }
            case 'doorOpen': {
              const tx = Atlas.texName(id, 'side');
              // Keep open doors slightly inside their own cell. When they sat exactly
              // on a block boundary, their thin edge could be coplanar with glass in
              // the neighboring cell and shimmer/z-fight.
              if (isDoorX(id)) emitBox(bufs.solid, wx, y, wz, 0.02, 0, 0.02, 0.98, 1, 0.18, tx, tx, tx);
              else emitBox(bufs.solid, wx, y, wz, 0.02, 0, 0.02, 0.18, 1, 0.98, tx, tx, tx);
              continue;
            }
            case 'dungeonDoor': {
              const tx = Atlas.texName(id, 'side');
              if (dungeonDoorAxisAt(id, wx, y, wz) === 'x') emitBox(bufs.solid, wx, y, wz, 0.38, 0, 0.02, 0.62, 1, 0.98, tx, tx, tx);
              else emitBox(bufs.solid, wx, y, wz, 0.02, 0, 0.38, 0.98, 1, 0.62, tx, tx, tx);
              continue;
            }
            case 'bed': {
              // orientation is STORED at placement — beds no longer point at strangers' feet
              let rot;
              const stored = this.bedDirs.get(this.pkey(wx, y, wz));
              if (stored !== undefined) {
                rot = stored;
              } else {
                rot = 0;
                const isHead = id === B.BED_HEAD || id === B.SUNBED_HEAD;
                const partner = id === B.BED ? B.BED_HEAD : id === B.SUNBED ? B.SUNBED_HEAD : id === B.BED_HEAD ? B.BED : B.SUNBED;
                for (const [i2, [ddx, ddz]] of [[0, [0, -1]], [1, [1, 0]], [2, [0, 1]], [3, [-1, 0]]]) {
                  if (this.getBlock(wx + ddx, y, wz + ddz) === partner) { rot = isHead ? (i2 + 2) % 4 : i2; break; }
                }
              }
              emitBox(bufs.solid, wx, y, wz, 0, 0, 0, 1, 0.2, 1, 'planks', 'planks', 'planks');
              emitBox(bufs.solid, wx, y, wz, 0, 0.2, 0, 1, 0.56, 1, Atlas.texName(id, 'top'), Atlas.texName(id, 'side'), 'planks', rot);
              continue;
            }
            case 'sign': {
              const sd = this.signDirs.get(this.pkey(wx, y, wz)) || { d: 0, w: 0 };
              const selfL = lightAt(wx, y, wz);
              // signs render in the cutout buffer: it's double-sided, so the
              // rotated board is visible from every angle
              if (sd.w) {
                const d = WTORCH_DIR[[B.WTORCH_PX, B.WTORCH_NX, B.WTORCH_PZ, B.WTORCH_NZ][sd.d]] || [0, 0, 1];
                if (d[0] === 1) emitBox(bufs.cutout, wx, y, wz, 0, 0.25, 0.08, 0.14, 0.8, 0.92, 'planks', 'planks', 'planks');
                else if (d[0] === -1) emitBox(bufs.cutout, wx, y, wz, 0.86, 0.25, 0.08, 1, 0.8, 0.92, 'planks', 'planks', 'planks');
                else if (d[2] === 1) emitBox(bufs.cutout, wx, y, wz, 0.08, 0.25, 0, 0.92, 0.8, 0.14, 'planks', 'planks', 'planks');
                else emitBox(bufs.cutout, wx, y, wz, 0.08, 0.25, 0.86, 0.92, 0.8, 1, 'planks', 'planks', 'planks');
              } else {
                const ang = sd.d * Math.PI / 4;
                emitBox(bufs.cutout, wx, y, wz, 0.44, 0, 0.44, 0.56, 0.55, 0.56, 'planks', 'log_side', 'planks');
                emitYawBox(bufs.cutout, wx + 0.5, y + 0.775, wz + 0.5, 0.44, 0.225, 0.1, ang, 'planks', selfL);
              }
              chunkSigns.push(this.pkey(wx, y, wz));
              continue;
            }
          }

          const target = def.cutout ? bufs.cutout : bufs.solid;
          for (let f = 0; f < 6; f++) {
            const face = this.FACES[f];
            const nx = wx + face.d[0], ny = y + face.d[1], nz = wz + face.d[2];
            const nb = gb(nx, ny, nz); // typed-array read — this.getBlock here was THE chunk-load hitch
            const nbDef = Reg[nb];
            let visible;
            if (nb === B.AIR) visible = true;
            else if (isFluid(nb)) visible = true;
            else if (nbDef && !nbDef.opaque) {
              // two touching cutout blocks (e.g. oak vs birch leaves) draw only ONE
              // shared face — the cutout material is double-sided, and two coplanar
              // quads with different textures z-fight horribly
              if (def.cutout && nbDef.cutout && nbDef.shape === 'cube' && def.shape === 'cube') visible = id < nb;
              else visible = !(def.cutout && nb === id);
            }
            else visible = false;
            if (!visible) continue;
            const texName = Atlas.texName(id, f === 2 ? 'top' : f === 3 ? 'bottom' : 'side');
            const uvr = Atlas.uv(texName);
            let verts = face.c.map(cn => [wx + cn[0], y + cn[1], wz + cn[2]]);
            if (def.cutout && def.shape === 'cube') {
              const bo = [wx, y, wz, wx + 1, y + 1, wz + 1];
              // Preserve the whole leaf/cutout texture, but separate it from any
              // adjacent partial/non-glass coplanar face so it does not shimmer.
              if (hasCoplanarNonJoinedNeighbor(bo, f, wx, y, wz, id)) verts = insetFaceVerts(verts, f);
            }
            const [lb, ls] = lightAt(nx, ny, nz);
            pushQuad(target, verts, uvr, UVQ, face.shade, lb, ls);
          }
        }
      }
    }

    const emitSparseCell = (wx, y, wz, id) => {
      if (id === B.AIR) return;
      const def = Reg[id];
      if (!def || !def.block) return;
      bufs = bufsForY(y);

      if (isWater(id)) { this.meshFluid(bufs.water, pushQuad, wx, y, wz, id, false, lightAt, gb); return; }
      if (isLava(id)) { this.meshFluid(bufs.lava, pushQuad, wx, y, wz, id, true, lightAt, gb); return; }
      if (id === B.MR_FLOOP_DRINKING_WATER) { emitPhotoCube(bufs.photo, wx, y, wz); return; }
      if (isJoinedGlassBlock(id) && emitJoinedGlass(wx, y, wz, id)) return;

      switch (def.shape) {
        case 'cross':
          crossQuads(bufs.cutout, wx, y, wz, Atlas.texName(id, 'side'), null, 0);
          return;
        case 'mega':
          crossQuads(bufs.cutout, wx, y, wz, 'mega_torch', null, 0, null, 2);
          return;
        case 'wtorch': {
          const d = WTORCH_DIR[id];
          crossQuads(bufs.cutout, wx, y, wz, 'torch',
            [-d[0] * 0.38, 0, -d[2] * 0.38], 0.12,
            [d[0] * 0.42, 0, d[2] * 0.42]);
          return;
        }
        case 'ladder': {
          const d = LADDER_DIR[id];
          const tx = 'ladder';
          if (d[0] === 1) emitBox(bufs.cutout, wx, y, wz, 0.02, 0, 0, 0.1, 1, 1, tx, tx, tx);
          else if (d[0] === -1) emitBox(bufs.cutout, wx, y, wz, 0.9, 0, 0, 0.98, 1, 1, tx, tx, tx);
          else if (d[2] === 1) emitBox(bufs.cutout, wx, y, wz, 0, 0, 0.02, 1, 1, 0.1, tx, tx, tx);
          else emitBox(bufs.cutout, wx, y, wz, 0, 0, 0.9, 1, 1, 0.98, tx, tx, tx);
          return;
        }
        case 'slabB':
          emitBox(def.cutout ? bufs.cutout : bufs.solid, wx, y, wz, 0, 0, 0, 1, 0.5, 1, Atlas.texName(id, 'top'), Atlas.texName(id, 'side'), Atlas.texName(id, 'bottom'));
          return;
        case 'slabT':
          emitBox(def.cutout ? bufs.cutout : bufs.solid, wx, y, wz, 0, 0.5, 0, 1, 1, 1, Atlas.texName(id, 'top'), Atlas.texName(id, 'side'), Atlas.texName(id, 'bottom'));
          return;
        case 'vslab': {
          const part = slabPartInfo(id);
          const bo = slabPartBox(part);
          const tx = SLAB_TEX[part.mat];
          const partDef = Reg[SLAB_OF[part.mat]] || def;
          emitBox(partDef.cutout ? bufs.cutout : bufs.solid, wx, y, wz, bo[0], bo[1], bo[2], bo[3], bo[4], bo[5], tx, tx, tx);
          return;
        }
        case 'dslab': {
          const [botM, topM] = DSLAB_MATS[id];
          emitSlabPieces(wx, y, wz, [
            { mat: botM, orient: 'bottom' },
            { mat: topM, orient: 'top' },
          ], def);
          return;
        }
        case 'slabCombo':
          emitSlabPieces(wx, y, wz, SLAB_COMBO_PIECES[id] || [], def);
          return;
        case 'stairs': {
          const tx = Atlas.texName(id, 'side');
          const stairBuf = def.cutout ? bufs.cutout : bufs.solid;
          for (const bo of Physics.stairBoxes(id, wx, y, wz)) {
            emitBox(stairBuf, wx, y, wz, bo[0], bo[1], bo[2], bo[3], bo[4], bo[5], tx, tx, tx);
          }
          return;
        }
        case 'snow':
          emitBox(bufs.solid, wx, y, wz, 0, 0, 0, 1, snowSheetLevel(id) / 8, 1, 'snow', 'snow', 'snow');
          return;
        case 'planter':
          emitPlanterCell(wx, y, wz);
          return;
        case 'crop': {
          emitPlanterCell(wx, y, wz);
          const tx = Atlas.texName(id, 'all');
          const st = cropStage(id);
          crossQuads(bufs.cutout, wx, y, wz, tx, null, 0.28 + this.plantationYOffset(wx, y, wz), null, 0.46 + st * 0.17);
          return;
        }
        case 'portalH': {
          const uvr = Atlas.uv('merry_portal');
          const yy = y - 0.445;
          const [lb, ls] = lightAt(wx, y, wz);
          pushQuad(bufs.cutout, [[wx, yy, wz], [wx + 1, yy, wz], [wx + 1, yy, wz + 1], [wx, yy, wz + 1]], uvr, UVQ, 1.0, Math.max(lb, 12), Math.max(ls, 12));
          return;
        }
        case 'cactus':
          emitBox(bufs.solid, wx, y, wz, 0.07, 0, 0.07, 0.93, 1, 0.93, Atlas.texName(id, 'top'), Atlas.texName(id, 'side'), Atlas.texName(id, 'bottom'));
          return;
        case 'door': {
          const tx = Atlas.texName(id, 'side');
          if (isDoorX(id)) emitBox(bufs.solid, wx, y, wz, 0.38, 0, 0.02, 0.62, 1, 0.98, tx, tx, tx);
          else emitBox(bufs.solid, wx, y, wz, 0.02, 0, 0.38, 0.98, 1, 0.62, tx, tx, tx);
          return;
        }
        case 'doorOpen': {
          const tx = Atlas.texName(id, 'side');
          if (isDoorX(id)) emitBox(bufs.solid, wx, y, wz, 0.02, 0, 0.02, 0.98, 1, 0.18, tx, tx, tx);
          else emitBox(bufs.solid, wx, y, wz, 0.02, 0, 0.02, 0.18, 1, 0.98, tx, tx, tx);
          return;
        }
        case 'dungeonDoor': {
          const tx = Atlas.texName(id, 'side');
          if (dungeonDoorAxisAt(id, wx, y, wz) === 'x') emitBox(bufs.solid, wx, y, wz, 0.38, 0, 0.02, 0.62, 1, 0.98, tx, tx, tx);
          else emitBox(bufs.solid, wx, y, wz, 0.02, 0, 0.38, 0.98, 1, 0.62, tx, tx, tx);
          return;
        }
        case 'bed': {
          let rot = this.bedDirs.get(this.pkey(wx, y, wz));
          if (rot === undefined) rot = 0;
          emitBox(bufs.solid, wx, y, wz, 0, 0, 0, 1, 0.2, 1, 'planks', 'planks', 'planks');
          emitBox(bufs.solid, wx, y, wz, 0, 0.2, 0, 1, 0.56, 1, Atlas.texName(id, 'top'), Atlas.texName(id, 'side'), 'planks', rot);
          return;
        }
        case 'sign': {
          const sd = this.signDirs.get(this.pkey(wx, y, wz)) || { d: 0, w: 0 };
          const selfL = lightAt(wx, y, wz);
          if (sd.w) {
            const d = WTORCH_DIR[[B.WTORCH_PX, B.WTORCH_NX, B.WTORCH_PZ, B.WTORCH_NZ][sd.d]] || [0, 0, 1];
            if (d[0] === 1) emitBox(bufs.cutout, wx, y, wz, 0, 0.25, 0.08, 0.14, 0.8, 0.92, 'planks', 'planks', 'planks');
            else if (d[0] === -1) emitBox(bufs.cutout, wx, y, wz, 0.86, 0.25, 0.08, 1, 0.8, 0.92, 'planks', 'planks', 'planks');
            else if (d[2] === 1) emitBox(bufs.cutout, wx, y, wz, 0.08, 0.25, 0, 0.92, 0.8, 0.14, 'planks', 'planks', 'planks');
            else emitBox(bufs.cutout, wx, y, wz, 0.08, 0.25, 0.86, 0.92, 0.8, 1, 'planks', 'planks', 'planks');
          } else {
            const ang = sd.d * Math.PI / 4;
            emitBox(bufs.cutout, wx, y, wz, 0.44, 0, 0.44, 0.56, 0.55, 0.56, 'planks', 'log_side', 'planks');
            emitYawBox(bufs.cutout, wx + 0.5, y + 0.775, wz + 0.5, 0.44, 0.225, 0.1, ang, 'planks', selfL);
          }
          chunkSigns.push(this.pkey(wx, y, wz));
          return;
        }
      }

      const target = def.cutout ? bufs.cutout : bufs.solid;
      for (let f = 0; f < 6; f++) {
        const face = this.FACES[f];
        const nx = wx + face.d[0], ny = y + face.d[1], nz = wz + face.d[2];
        const nb = gb(nx, ny, nz);
        const nbDef = Reg[nb];
        let visible;
        if (nb === B.AIR) visible = true;
        else if (isFluid(nb)) visible = true;
        else if (nbDef && !nbDef.opaque) {
          if (def.cutout && nbDef.cutout && nbDef.shape === 'cube' && def.shape === 'cube') visible = id < nb;
          else visible = !(def.cutout && nb === id);
        } else visible = false;
        if (!visible) continue;
        const texName = Atlas.texName(id, f === 2 ? 'top' : f === 3 ? 'bottom' : 'side');
        const uvr = Atlas.uv(texName);
        let verts = face.c.map(cn => [wx + cn[0], y + cn[1], wz + cn[2]]);
        if (def.cutout && def.shape === 'cube') {
          const bo = [wx, y, wz, wx + 1, y + 1, wz + 1];
          if (hasCoplanarNonJoinedNeighbor(bo, f, wx, y, wz, id)) verts = insetFaceVerts(verts, f);
        }
        const [lb, ls] = lightAt(nx, ny, nz);
        pushQuad(target, verts, uvr, UVQ, face.shade, lb, ls);
      }
    };

    if (ch.extraBlocks) {
      for (const [pk, id] of ch.extraBlocks) {
        const [wx, y, wz] = pk.split(',').map(Number);
        if (!Number.isFinite(wx + y + wz) || y < H) continue;
        emitSparseCell(wx, y, wz, id);
      }
    }

    const sectionBufs = [...sectionMap.values()].sort((a, b) => a.sy - b.sy);

    const mk = (b, mat, sy) => {
      if (!b.idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.idx);
      const mesh = new THREE.Mesh(g, mat);
      mesh.matrixAutoUpdate = false;
      mesh.userData.chunkSectionY = sy;
      this.scene.add(mesh);
      return mesh;
    };
    ch.solidMesh = ch.cutoutMesh = ch.waterMesh = ch.lavaMesh = ch.photoMesh = null;
    ch.sectionMeshes = sectionBufs.map(sec => ({
      sy: sec.sy,
      y0: sec.y0,
      y1: sec.y1,
      solidMesh: mk(sec.bufs.solid, this.matSolid, sec.sy),
      cutoutMesh: mk(sec.bufs.cutout, this.matCutout, sec.sy),
      waterMesh: mk(sec.bufs.water, this.matWater, sec.sy),
      lavaMesh: mk(sec.bufs.lava, this.matLava, sec.sy),
      photoMesh: mk(sec.bufs.photo, this.matPhoto, sec.sy),
    }));
    ch.hasMesh = true;
    for (const mesh of oldMeshes) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
    }
    this.applyChunkSectionVisibility(ch);
    this.syncSignSprites(chunkSigns);
  },

  wrapSignText(text, ctx, maxWidth, maxLines) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    if (!clean) return [];

    const lines = [];
    let line = '';
    const pushLine = value => {
      const v = String(value || '').trim();
      if (v && lines.length < maxLines) lines.push(v);
    };

    for (const word of clean.split(' ')) {
      if (!word) continue;
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
        continue;
      }

      // Wrap before the word that would overflow, instead of slicing through it.
      if (line) {
        pushLine(line);
        line = word;
      } else {
        // One huge no-space word: split only as a last-resort fallback.
        let chunk = '';
        for (const ch of word) {
          if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
            pushLine(chunk);
            chunk = ch;
            if (lines.length >= maxLines) break;
          } else chunk += ch;
        }
        line = chunk;
      }

      if (lines.length >= maxLines) break;
    }

    if (line && lines.length < maxLines) pushLine(line);
    return lines;
  },

  syncSignSprites(keys) {
    for (const k of keys) {
      const text = ((this.signs.get(k) || '') + '').replace(/\s+/g, ' ').trim().slice(0, 30);
      const sd = this.signDirs.get(k) || { d: 0, w: 0 };
      const existing = this.signSprites.get(k);
      if (existing && existing.userData.text === text && existing.userData.d === sd.d && existing.userData.w === sd.w) continue;
      if (existing) this.scene.remove(existing);
      if (!text) { this.signSprites.delete(k); continue; }
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 64;
      const c = cv.getContext('2d');
      c.font = 'bold 18px Consolas, monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#050505'; // near-black, actually readable
      const lines = this.wrapSignText(text, c, 232, 3);
      const lineHeight = 18;
      const startY = 32 - ((lines.length - 1) * lineHeight) / 2;
      for (let i = 0; i < lines.length; i++) {
        c.fillText(lines[i], 128, startY + i * lineHeight, 232);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.LinearFilter;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.82, 0.4),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -1 })
      );
      const [x, y, z] = k.split(',').map(Number);
      if (sd.w) {
        const dirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
        const d = dirs[sd.d] || [0, 0, 1];
        plane.position.set(x + 0.5 + d[0] * -0.35, y + 0.52, z + 0.5 + d[2] * -0.35);
        plane.rotation.y = d[0] === 1 ? Math.PI / 2 : d[0] === -1 ? -Math.PI / 2 : d[2] === 1 ? 0 : Math.PI;
        // wall sign plane sits just off the board on the OUTWARD face
        plane.position.x = x + 0.5 + d[0] * (d[0] !== 0 ? -0.34 : 0);
        plane.position.z = z + 0.5 + d[2] * (d[2] !== 0 ? -0.34 : 0);
      } else {
        const ang = sd.d * Math.PI / 4;
        plane.position.set(x + 0.5 + Math.sin(ang) * 0.115, y + 0.775, z + 0.5 + Math.cos(ang) * 0.115);
        plane.rotation.y = ang;
      }
      plane.userData.text = text;
      plane.userData.d = sd.d;
      plane.userData.w = sd.w;
      this.scene.add(plane);
      this.signSprites.set(k, plane);
    }
  },

  meshFluid(buf, pushQuad, wx, y, wz, id, lava, lightAt, gb) {
    if (!gb) gb = (x, yy, z) => this.getBlock(x, yy, z);
    const uvr = Atlas.uv(lava ? 'lava' : 'water');
    const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const same = lava ? isLava : isWater;
    const levelOf = lava ? lavaLevel : waterLevel;
    const lvl = levelOf(id);
    const above = gb(wx, y + 1, wz);
    const topH = same(above) ? 1 : Math.max(0.12, lvl / 9);
    const [lb, ls] = lightAt(wx, y, wz);

    if (!same(above)) {
      const v = [[wx, y + topH, wz + 1], [wx + 1, y + topH, wz + 1], [wx + 1, y + topH, wz], [wx, y + topH, wz]];
      pushQuad(buf, v, uvr, UVQ, 1.0, lava ? 1 : lb, ls);
    }
    const below = gb(wx, y - 1, wz);
    const belowDef = Reg[below];
    if (!same(below) && !(belowDef && belowDef.opaque)) {
      const v = [[wx, y, wz], [wx + 1, y, wz], [wx + 1, y, wz + 1], [wx, y, wz + 1]];
      pushQuad(buf, v, uvr, UVQ, 0.7, lava ? 1 : lb, ls);
    }
    for (let f = 0; f < 6; f++) {
      if (f === 2 || f === 3) continue;
      const face = this.FACES[f];
      const nb = gb(wx + face.d[0], y, wz + face.d[2]);
      const nbDef = Reg[nb];
      let bottomH = 0;
      if (same(nb)) {
        const nbAbove = gb(wx + face.d[0], y + 1, wz + face.d[2]);
        const nbTop = same(nbAbove) ? 1 : Math.max(0.12, levelOf(nb) / 9);
        if (nbTop >= topH - 0.01) continue;
        bottomH = nbTop;
      } else if (nbDef && nbDef.opaque) continue;
      const verts = face.c.map(cn => [
        wx + cn[0],
        y + (cn[1] === 1 ? topH : bottomH),
        wz + cn[2],
      ]);
      pushQuad(buf, verts, uvr, UVQ, 0.82, lava ? 1 : lb, ls);
    }
  },

  // ---------- queries ----------
  // box-accurate raycast: partial blocks only stop the ray where their
  // visible boxes actually are (open doors, slab gaps, torches...)
  raycast(ox, oy, oz, dx, dy, dz, maxDist, opts) {
    opts = opts || {};
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMX = dx !== 0 ? (dx > 0 ? (x + 1 - ox) : (ox - x)) * tDX : Infinity;
    let tMY = dy !== 0 ? (dy > 0 ? (y + 1 - oy) : (oy - y)) * tDY : Infinity;
    let tMZ = dz !== 0 ? (dz > 0 ? (z + 1 - oz) : (oz - z)) * tDZ : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 384; i++) {
      const id = this.getBlock(x, y, z);
      if (opts.fluids && (id === B.WATER || id === B.LAVA)) {
        return { bx: x, by: y, bz: z, nx, ny, nz, dist: t, id, px: ox + dx * t, py: oy + dy * t, pz: oz + dz * t };
      }
      if (id !== B.AIR && !isFluid(id)) {
        const def = Reg[id];
        if (def.shape === 'cube' || def.shape === 'dslab' || def.shape === 'mega') {
          return { bx: x, by: y, bz: z, nx, ny, nz, dist: t, id, px: ox + dx * t, py: oy + dy * t, pz: oz + dz * t };
        }

        const tNext = Math.min(tMX, tMY, tMZ, maxDist + 0.5);
        const tMin = Math.max(0, t - 0.001);

        // Crops and their 3x3 pot cells share one block cell, but they are two
        // different targets. Hit the crop only when the ray touches the plant
        // mesh; hit the pot only when the ray touches the tray/rim mesh. If the
        // ray passes through empty air inside the cell, keep raycasting forward.
        if (def.shape === 'crop') {
          const underSlab = (this.plantationUnderSlabs && this.pkey) ? this.plantationUnderSlabs.get(this.pkey(x, y, z)) : 0;
          const underHit = underSlab ? Physics.rayVsBoxes(Physics.rayBoxes(underSlab, x, y, z) || [[0, 0, 0, 1, 0.5, 1]], x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001) : null;
          const cropHit = Physics.rayVsBoxes(Physics.cropRayBoxes(id, x, y, z), x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001);
          const potHit = Physics.rayVsBoxes(Physics.planterRayBoxes(id, x, y, z), x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001);
          let hit = null, hitId = id, targetPart = 'crop';
          if (underHit && underHit.t <= maxDist) { hit = underHit; hitId = underSlab; targetPart = 'underSlab'; }
          if (cropHit && cropHit.t <= maxDist && (!hit || cropHit.t < hit.t - 0.0005)) { hit = cropHit; hitId = id; targetPart = 'crop'; }
          if (potHit && potHit.t <= maxDist && (!hit || potHit.t < hit.t - 0.0005)) {
            hit = potHit; hitId = B.PLANTATION_POT; targetPart = 'pot';
          }
          if (hit) {
            return {
              bx: x, by: y, bz: z, nx: hit.nx, ny: hit.ny, nz: hit.nz, dist: hit.t, id: hitId, actualId: id, targetPart,
              px: ox + dx * hit.t, py: oy + dy * hit.t, pz: oz + dz * hit.t,
            };
          }
        } else if (def.shape === 'planter') {
          const underSlab = (this.plantationUnderSlabs && this.pkey) ? this.plantationUnderSlabs.get(this.pkey(x, y, z)) : 0;
          const underHit = underSlab ? Physics.rayVsBoxes(Physics.rayBoxes(underSlab, x, y, z) || [[0, 0, 0, 1, 0.5, 1]], x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001) : null;
          const potHit = Physics.rayVsBoxes(Physics.planterRayBoxes(id, x, y, z), x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001);
          let hit = null, hitId = id, targetPart = 'pot';
          if (underHit && underHit.t <= maxDist) { hit = underHit; hitId = underSlab; targetPart = 'underSlab'; }
          if (potHit && potHit.t <= maxDist && (!hit || potHit.t < hit.t - 0.0005)) { hit = potHit; hitId = id; targetPart = 'pot'; }
          if (hit) {
            return {
              bx: x, by: y, bz: z, nx: hit.nx, ny: hit.ny, nz: hit.nz, dist: hit.t, id: hitId, actualId: id, targetPart,
              px: ox + dx * hit.t, py: oy + dy * hit.t, pz: oz + dz * hit.t,
            };
          }
        } else {
          // partial block: intersect against its actual boxes
          const boxes = Physics.rayBoxes(id, x, y, z);
          if (boxes) {
            const hit = Physics.rayVsBoxes(boxes, x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001);
            if (hit && hit.t <= maxDist) {
              return {
                bx: x, by: y, bz: z, nx: hit.nx, ny: hit.ny, nz: hit.nz, dist: hit.t, id,
                px: ox + dx * hit.t, py: oy + dy * hit.t, pz: oz + dz * hit.t,
              };
            }
            // ray misses the visible part — pass through
          }
        }
      }
      if (tMX < tMY && tMX < tMZ) { x += stepX; t = tMX; tMX += tDX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMY < tMZ) { y += stepY; t = tMY; tMY += tDY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMZ; tMZ += tDZ; nx = 0; ny = 0; nz = -stepZ; }
      if (t > maxDist) return null;
    }
    return null;
  },

  lineOfSight(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.001) return true;
    const hit = this.raycast(x0, y0, z0, dx / dist, dy / dist, dz / dist, dist);
    return !hit;
  },

  skyExposed(x, y, z) {
    return this.getSkyLight(x, y, z) >= 14;
  },

  // spawn-suppression: light level + mega torches
  spawnAllowedAt(x, y, z) {
    if (this.getBlockLight(x, y, z) >= 8) return false;
    for (const k of this.megaTorches) {
      const [mx, my, mz] = k.split(',').map(Number);
      if ((mx - x) ** 2 + (my - y) ** 2 + (mz - z) ** 2 < 100 * 100) return false;
    }
    return true;
  },

  findSpawn() {
    for (let r = 0; r < 40; r++) {
      for (let a = 0; a < 8; a++) {
        const ang = a / 8 * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * r * 8), z = Math.round(Math.sin(ang) * r * 8);
        const h = this.heightAt(x, z);
        if (h > this.SEA + 1) return { x: x + 0.5, y: h + 1.02, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: this.H - 10, z: 0.5 };
  },

  isValidPlantationSupport(x, y, z) {
    const id = this.getBlock(x, y, z);
    // A Plantation Pot must sit on real ground/support. Other planter cells are
    // not valid support, which prevents stacking 3x3 pots on top of each other.
    if (isPlanterCell(id)) return false;
    const def = Reg[id];
    if (!def || def.replaceable || isFluid(id)) return false;
    return !!Physics.blockBoxes(id, x, y, z);
  },

  breakPlantationGroupAt(x, y, z, drop) {
    return this.destroyMultiblockAt(x, y, z, { drop, kind: 'plantation' });
  },

  multiblockGroupFor(x, y, z, forceKind) {
    const id = this.getBlock(x, y, z);

    if ((!forceKind || forceKind === 'plantation') && isPlanterCell(id)) {
      const cells = this.plantationGroupFor(x, y, z);
      if (cells && cells.length) {
        return { kind: 'plantation', cells, dropId: B.PLANTATION_POT, dropAt: [x + 0.5, y + 0.35, z + 0.5] };
      }
    }

    if ((!forceKind || forceKind === 'door') && isDoor(id)) {
      const baseY = isDoorTop(id) ? y - 1 : y;
      const baseId = this.getBlock(x, baseY, z);
      const topId = this.getBlock(x, baseY + 1, z);
      if (isDoor(baseId) || isDoor(topId)) {
        const dropId = Reg[baseId] && Reg[baseId].drop ? Reg[baseId].drop.id
          : Reg[topId] && Reg[topId].drop ? Reg[topId].drop.id
          : I.DOOR;
        const cells = [];
        if (isDoor(baseId)) cells.push([x, baseY, z]);
        if (isDoor(topId)) cells.push([x, baseY + 1, z]);
        return { kind: 'door', cells, dropId, dropAt: [x + 0.5, baseY + 0.5, z + 0.5] };
      }
    }

    if ((!forceKind || forceKind === 'bed') && isBed(id)) {
      const partnerId = id === B.BED_HEAD ? B.BED : id === B.SUNBED_HEAD ? B.SUNBED
        : id === B.BED ? B.BED_HEAD : B.SUNBED_HEAD;
      const dropId = (id === B.BED || id === B.BED_HEAD) ? B.BED : B.SUNBED;
      const cells = [[x, y, z]];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.getBlock(x + dx, y, z + dz) === partnerId) {
          cells.push([x + dx, y, z + dz]);
          break;
        }
      }
      return { kind: 'bed', cells, dropId, dropAt: [x + 0.5, y + 0.4, z + 0.5] };
    }

    return null;
  },

  destroyMultiblockAt(x, y, z, opts) {
    opts = opts || {};
    const group = this.multiblockGroupFor(x, y, z, opts.kind);
    if (!group || !group.cells || !group.cells.length) return false;

    let any = false;
    for (const [px, py, pz] of group.cells) {
      if (this.getBlock(px, py, pz) !== B.AIR) { any = true; break; }
    }
    if (!any) return false;

    // Clear all linked cells first with no support updates. This prevents chained
    // support checks or explosion loops from treating each half/cell as its own
    // separate full multiblock item.
    for (const [px, py, pz] of group.cells) {
      const cid = this.getBlock(px, py, pz);
      if (cid !== B.AIR) {
        if ((cid === B.LOG || cid === B.BIRCH_LOG || cid === B.SPRUCE_LOG || cid === B.OASIS_LOG) && typeof Dynamics !== 'undefined') {
          Dynamics.queueLeafDecay(px, py, pz);
        }
        const pk = this.pkey(px, py, pz);
        const underSlab = group.kind === 'plantation' ? this.plantationUnderSlabs.get(pk) : 0;
        this.setBlock(px, py, pz, underSlab || B.AIR, { noUpdate: true });
        this.plantationUnderSlabs.delete(pk);
        if (typeof Particles !== 'undefined' && opts.particles) Particles.blockBurst(px, py, pz, cid);
      }
    }

    if (opts.drop && group.dropId) {
      const at = opts.dropAt || group.dropAt || [x + 0.5, y + 0.5, z + 0.5];
      Drops.spawn(at[0], at[1], at[2], group.dropId, 1);
    }
    return true;
  },

  plantationYOffset(x, y, z) {
    return this.plantationUnderSlabs.has(this.pkey(x, y, z)) ? 0.5 : 0;
  },

  plantationPlacementMode(cx, y, cz) {
    // Special raised placement: a full 3x3 pad of lower horizontal slabs can
    // hold the plantation in the upper half of those same block cells.
    let allLowerSlabs = true;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!isLowerHorizontalSlab(this.getBlock(cx + dx, y, cz + dz))) allLowerSlabs = false;
    }
    if (allLowerSlabs) return 'lowerSlab';

    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const x = cx + dx, z = cz + dz;
      const id = this.getBlock(x, y, z);
      const def = Reg[id];
      if (id !== B.AIR && !(def && def.replaceable)) return null;
      if (!this.isValidPlantationSupport(x, y - 1, z)) return null;
    }
    return 'normal';
  },

  canPlacePlantationPot(cx, y, cz) {
    return !!this.plantationPlacementMode(cx, y, cz);
  },

  placePlantationPot(cx, y, cz) {
    const mode = this.plantationPlacementMode(cx, y, cz);
    if (!mode) return false;
    const origin = this.pkey(cx, y, cz);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const x = cx + dx, z = cz + dz;
      const k = this.pkey(x, y, z);
      const underSlab = mode === 'lowerSlab' ? this.getBlock(x, y, z) : 0;
      // set the multiblock metadata BEFORE setBlock so the block's network sync can carry it
      this.plantationOrigins.set(k, origin);
      if (underSlab) this.plantationUnderSlabs.set(k, underSlab);
      else this.plantationUnderSlabs.delete(k);
      this.setBlock(x, y, z, B.PLANTATION_POT, { noUpdate: dx !== 0 || dz !== 0 });
    }
    return true;
  },

  plantationGroupFor(x, y, z) {
    const ok = (id) => isPlanterCell(id);
    const k = this.pkey(x, y, z);
    const origin = this.plantationOrigins.get(k);
    if (origin) {
      const [cx, cy, cz] = origin.split(',').map(Number);
      const cells = [];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const px = cx + dx, pz = cz + dz;
        if (ok(this.getBlock(px, cy, pz)) && this.plantationOrigins.get(this.pkey(px, cy, pz)) === origin) {
          cells.push([px, cy, pz]);
        }
      }
      return cells.length ? cells : [[x, y, z]];
    }

    // Legacy fallback for worlds saved before Plantation Pots remembered their real
    // 3x3 origin. New pots use plantationOrigins, so connected plantations no
    // longer get guessed into the wrong group when one cell is broken.
    for (let ox = x - 2; ox <= x; ox++) for (let oz = z - 2; oz <= z; oz++) {
      let good = true;
      for (let dx = 0; dx < 3 && good; dx++) for (let dz = 0; dz < 3; dz++) {
        if (!ok(this.getBlock(ox + dx, y, oz + dz))) { good = false; break; }
      }
      if (good && x >= ox && x < ox + 3 && z >= oz && z < oz + 3) {
        const cells = [];
        for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) cells.push([ox + dx, y, oz + dz]);
        return cells;
      }
    }
    return [[x, y, z]];
  },


  bonemealGrass(x, y, z) {
    const flowerChoices = [B.ROSE, B.DANDELION, B.CORNFLOWER];
    let placed = 0;
    const canReplace = (id) => id === B.AIR || (Reg[id] && Reg[id].replaceable);
    const trySpot = (px, py, pz) => {
      const ground = this.getBlock(px, py, pz);
      if (ground !== B.GRASS && ground !== B.SNOWY_GRASS) return false;
      const above = this.getBlock(px, py + 1, pz);
      if (!canReplace(above)) return false;
      const raw = this.getLightRaw(px, py + 1, pz);
      const light = Math.max(raw & 15, (raw >> 4) * this.dayFUniform.value);
      if (light < 7) return false;
      const r = Math.random();
      let id;
      if (r < 0.70) id = B.WILD_GRASS;
      else id = flowerChoices[(Math.random() * flowerChoices.length) | 0];
      this.setBlock(px, py + 1, pz, id);
      placed++;
      return true;
    };
    for (let i = 0; i < 56; i++) {
      const dx = ((Math.random() * 7) | 0) - 3;
      const dz = ((Math.random() * 7) | 0) - 3;
      const px = x + dx, pz = z + dz;
      // Check a small vertical range so bonemeal works on bumpy ground, terraces,
      // and player-made dirt/grass patches near the clicked block.
      for (let dy = 2; dy >= -2; dy--) {
        if (trySpot(px, y + dy, pz)) break;
      }
      if (placed >= 18) break;
    }
    return placed > 0;
  },

  grassWeatherGrowthMultiplier() {
    const w = (typeof Dynamics !== 'undefined' && Dynamics) ? Dynamics.weather : 'clear';
    if (w === 'thunder') return 2.5;
    if (w === 'rain') return 2.0;
    return 1.0;
  },

  grassCanStayCovered(aboveId) {
    // Only real opaque full-block cover smothers grass. Transparent/cutout blocks
    // (glass/leaves), snow sheets, slabs, flowers, torches, crops, and other
    // partial meshes should never turn the grass below into dirt.
    if (aboveId === B.AIR || isFlower(aboveId) || isSnowSheet(aboveId)) return true;
    const def = Reg[aboveId];
    if (!def) return false;
    if (def.replaceable || !def.solid) return true;
    if (!def.opaque || def.cutout || def.transparent) return true;
    if (def.shape && def.shape !== 'cube') return true;
    const boxes = (typeof Physics !== 'undefined' && Physics.blockBoxes) ? Physics.blockBoxes(aboveId, 0, 0, 0) : null;
    if (boxes && boxes.length) {
      // A lower slab, snow-ish plate, or any sub-block mesh is not full cover.
      // Only a box that fills the whole block column counts as smothering.
      const full = boxes.some(b => b[0] <= 0.001 && b[1] <= 0.001 && b[2] <= 0.001 && b[3] >= 0.999 && b[4] >= 0.999 && b[5] >= 0.999);
      if (!full) return true;
    }
    return false;
  },

  tryGrowWildGrassFromGrass(x, y, z, weatherMult) {
    // Do not grow normal wild grass on snowy grass. Snowy biomes should stay
    // clean unless worldgen/bonemeal explicitly places snow-safe plants.
    if (this.getBlock(x, y, z) !== B.GRASS) return false;
    if (this.getBlock(x, y + 1, z) !== B.AIR) return false;
    const raw = this.getLightRaw(x, y + 1, z);
    const light = Math.max(raw & 15, (raw >> 4) * this.dayFUniform.value);
    if (light < 9) return false;
    // Extremely rare passive regrowth. Every exposed grass block still gets
    // checked during chunk sweeps, but the actual sprout chance is intentionally
    // tiny so wild grass does not spam the world over time.
    if (Math.random() > 0.000022 * (weatherMult || 1)) return false;
    this.setBlock(x, y + 1, z, B.WILD_GRASS);
    if (Math.random() < 0.35) Particles.burst(x + 0.5, y + 1.0, z + 0.5, [0.35, 0.85, 0.25], 2, 0.9);
    return true;
  },

  grassSourceForDirt(x, y, z) {
    // Dirt can turn into grass only when it is truly exposed on top and has
    // nearby grass. This is deterministic now: scanned dirt blocks are checked
    // directly instead of hoping random picks land near them.
    if (this.getBlock(x, y, z) !== B.DIRT) return 0;
    if (this.getBlock(x, y + 1, z) !== B.AIR) return 0;
    const raw = this.getLightRaw(x, y + 1, z);
    const light = Math.max(raw & 15, (raw >> 4) * this.dayFUniform.value);
    if (light < 8) return 0;
    const dirs = [
      [ 1, 0, 0], [-1, 0, 0], [0, 0,  1], [0, 0, -1],
      [ 1, 1, 0], [-1, 1, 0], [0, 1,  1], [0, 1, -1],
      [ 1,-1, 0], [-1,-1, 0], [0,-1,  1], [0,-1, -1],
      [ 0, 1, 0], [0,-1, 0],
    ];
    for (const d of dirs) {
      const id = this.getBlock(x + d[0], y + d[1], z + d[2]);
      if (id === B.SNOWY_GRASS) return B.SNOWY_GRASS;
      if (id === B.GRASS) return B.GRASS;
    }
    return 0;
  },

  processGrassDirtChunk(ch, weatherMult) {
    if (!ch) return false;
    const toGrass = [];
    const toDirt = [];
    let changed = false;

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const wx = ch.cx * 16 + lx;
        const wz = ch.cz * 16 + lz;
        for (let y = 1; y < this.H - 1; y++) {
          const id = ch.blocks[this.idx(lx, y, lz)];

          if (id === B.GRASS || id === B.SNOWY_GRASS) {
            const above = this.getBlock(wx, y + 1, wz);
            if (!this.grassCanStayCovered(above)) {
              toDirt.push([wx, y, wz]);
              continue;
            }
            // Wild grass regrowth is still intentionally rare, but every exposed
            // grass block now gets checked when its chunk is swept.
            if (this.tryGrowWildGrassFromGrass(wx, y, wz, weatherMult)) changed = true;
            continue;
          }

          if (id === B.DIRT) {
            const grassId = this.grassSourceForDirt(wx, y, wz);
            // Dirt spread used to be instant whenever a swept dirt block found
            // nearby grass. Keep deterministic checks, but add a Minecraft-like
            // random-tick chance so it happens around 10-15x slower.
            const spreadChance = Math.min(0.16, 0.07 * (weatherMult || 1));
            if (grassId && Math.random() < spreadChance) toGrass.push([wx, y, wz, grassId]);
          }
        }
      }
    }

    for (const [x, y, z] of toDirt) {
      if (this.getBlock(x, y, z) === B.GRASS || this.getBlock(x, y, z) === B.SNOWY_GRASS) {
        this.setBlock(x, y, z, B.DIRT);
        changed = true;
      }
    }
    for (const [x, y, z, id] of toGrass) {
      if (this.getBlock(x, y, z) === B.DIRT && this.getBlock(x, y + 1, z) === B.AIR) {
        this.setBlock(x, y, z, id === B.SNOWY_GRASS ? B.SNOWY_GRASS : B.GRASS);
        if (Math.random() < 0.12 * (weatherMult || 1)) Particles.burst(x + 0.5, y + 1.0, z + 0.5, [0.35, 0.85, 0.25], 2, 0.9);
        changed = true;
      }
    }
    return changed;
  },

  sweepGrassAndDirtAround(px, py, pz, chunksPerTick) {
    // Check whole nearby loaded chunks in a rotating sweep. This avoids the old
    // "random dart throw" behavior while still avoiding a giant all-world scan in
    // one frame.
    const pcx = Math.floor(px) >> 4;
    const pcz = Math.floor(pz) >> 4;
    const maxChunkDist = 4;
    const keys = [];
    for (const [k, ch] of this.chunks) {
      const dx = Math.abs(ch.cx - pcx);
      const dz = Math.abs(ch.cz - pcz);
      if (dx <= maxChunkDist && dz <= maxChunkDist) keys.push(k);
    }
    if (!keys.length) return false;
    keys.sort((a, b) => {
      const ca = this.chunks.get(a), cb = this.chunks.get(b);
      const da = Math.max(Math.abs(ca.cx - pcx), Math.abs(ca.cz - pcz));
      const db = Math.max(Math.abs(cb.cx - pcx), Math.abs(cb.cz - pcz));
      return da - db || a.localeCompare(b);
    });

    const weatherMult = this.grassWeatherGrowthMultiplier();
    let changed = false;
    const n = Math.max(1, Math.min(keys.length, chunksPerTick | 0));
    this.grassSweepCursor %= keys.length;
    for (let i = 0; i < n; i++) {
      const k = keys[(this.grassSweepCursor + i) % keys.length];
      changed = this.processGrassDirtChunk(this.chunks.get(k), weatherMult) || changed;
    }
    this.grassSweepCursor = (this.grassSweepCursor + n) % keys.length;
    return changed;
  },

  // Backwards-compatible wrapper for any older code path that still calls the
  // old random spread function name.
  spreadGrassAround(px, py, pz, attempts) {
    const weatherMult = this.grassWeatherGrowthMultiplier();
    return this.sweepGrassAndDirtAround(px, py, pz, Math.max(1, Math.round((attempts || 55) / 18 * weatherMult)));
  },

  growCrop(x, y, z, boost) {
    const id = this.getBlock(x, y, z);
    if (!isCrop(id)) return false;
    const st = cropStage(id);
    if (st >= 3) return false;
    if (boost || Math.random() < 0.9) {
      this.setBlock(x, y, z, id + 1);
      Particles.burst(x + 0.5, y + 0.65, z + 0.5, [0.7, 1.0, 0.35], 10, 2);
      return true;
    }
    return false;
  },

  wakeFluidsAround(x, y, z, range) {
    if (typeof Water === 'undefined' || typeof Lava === 'undefined') return;
    const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    const r = Math.max(1, Math.ceil(range || 1));
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const by = cy + dy;
        if (by < 0 || by >= this.H) continue;
        for (let dz = -r; dz <= r; dz++) {
          const bx = cx + dx, bz = cz + dz;
          if (!this.hasChunk(bx, bz)) continue;
          Water.schedule(bx, by, bz);
          Lava.schedule(bx, by, bz);
        }
      }
    }
  },

  growTree(x, y, z, saplingId) {
    // saplings need the right ground and enough light to grow
    if (!canPlantSaplingOn(saplingId, this.getBlock(x, y - 1, z))) return false;
    const raw = this.getLightRaw(x, y, z);
    const light = Math.max(raw & 15, (raw >> 4) * this.dayFUniform.value);
    if (light < 9) return false;
    const type = saplingId === B.SAPLING_BIRCH ? 'birch' : saplingId === B.SAPLING_SPRUCE ? 'spruce' : saplingId === B.SAPLING_OASIS ? 'oasis' : 'oak';
    const clearH = type === 'oasis' ? 8 : 6;
    for (let dy = 1; dy < clearH; dy++) {
      const above = this.getBlock(x, y + dy, z);
      if (above !== B.AIR && !isFluid(above)) return false;
    }
    const tr = NoiseGen.mulberry((x * 341 + z * 887 + y) | 0);
    const puts = [];
    const put = (px, py, pz, id, force) => puts.push({ x: px, y: py, z: pz, id, f: force });
    this.treeBlocks(put, x, y - 1, z, type, tr);
    this.setBlock(x, y, z, B.AIR, { noUpdate: true });
    for (const p of puts) {
      const cur = this.getBlock(p.x, p.y, p.z);
      if (p.f || cur === B.AIR) this.setBlock(p.x, p.y, p.z, p.id, { noUpdate: true });
    }
    return true;
  },

  explode(ex, ey, ez, radius, maxDmg, hurtMult, src) {
    radius = radius || 2.9;
    maxDmg = maxDmg || 13;
    SFX.boom({ x: ex, y: ey, z: ez });
    Particles.burst(ex, ey, ez, [0.9, 0.6, 0.2], 40, 7);
    Particles.burst(ex, ey, ez, [0.4, 0.4, 0.4], 40, 5);
    const r = Math.ceil(radius);
    const explodedLogs = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
          const bx = Math.floor(ex) + dx, by = Math.floor(ey) + dy, bz = Math.floor(ez) + dz;
          const id = this.getBlock(bx, by, bz);
          if (id === B.AIR || id === B.BEDROCK || isFluid(id)) continue;
          if ((this.isProtectedDungeonBlock && this.isProtectedDungeonBlock(bx, by, bz, id)) || id === B.DUNGEON_CORE) continue;
          const wasLog = typeof Dynamics !== 'undefined' && Dynamics.isLogId && Dynamics.isLogId(id);
          const dropThisBlock = Math.random() < 0.3;
          if (this.destroyMultiblockAt(bx, by, bz, { drop: dropThisBlock, particles: true })) continue;
          if (wasLog) explodedLogs.push([bx, by, bz]);
          let jellyHouseDropData = null;
          if (id === B.JELLY_HOUSE && typeof Jelly !== 'undefined') {
            const jk = this.pkey ? this.pkey(bx, by, bz) : (bx + ',' + by + ',' + bz);
            const res = Jelly.onHouseBreak(jk, { reason: 'explosion', drop: dropThisBlock });
            jellyHouseDropData = res && res.itemData;
          }
          if (dropThisBlock) {
            const def = Reg[id];
            if (def.drop !== null) {
              if (id === B.JELLY_HOUSE) {
                Drops.spawn(bx + 0.5, by + 0.5, bz + 0.5, id, 1, null, undefined, jellyHouseDropData || (typeof Jelly !== 'undefined' ? Jelly.serializeHouseItem([]) : { jellyRoster: [] }));
              } else if (def.drop && def.drop.table) Drops.dropTable(bx + 0.5, by + 0.5, bz + 0.5, def.drop.table);
              else {
                let dropId = id, n = 1;
                if (def.drop) { dropId = def.drop.id; n = def.drop.min || 1; if (def.drop.chance && Math.random() > def.drop.chance) dropId = 0; }
                if (dropId) Drops.spawn(bx + 0.5, by + 0.5, bz + 0.5, dropId, n);
              }
            }
          }
          if (wasLog && typeof Dynamics !== 'undefined') Dynamics.queueLeafDecay(bx, by, bz);
          this.setBlock(bx, by, bz, B.AIR, id === B.JELLY_HOUSE ? { jellyHouseBreakHandled: true } : undefined);
        }
      }
    }
    if (explodedLogs.length && typeof Dynamics !== 'undefined') {
      // Important: queue leaf decay AFTER every explosion deletion is finished.
      // Queueing only before each log is removed can miss the real post-blast
      // orphan state, especially when several trunk blocks disappear in one frame.
      const seenLogs = new Set();
      for (const [lx, ly, lz] of explodedLogs) {
        const lk = lx + ',' + ly + ',' + lz;
        if (seenLogs.has(lk)) continue;
        seenLogs.add(lk);
        Dynamics.queueLeafDecay(lx, ly, lz, { range: 9, minDelay: 0.1, maxDelay: 1.4, force: true });
      }
      // Also scan the whole blast neighborhood to catch leaves whose nearest log
      // was deleted but whose exact trunk cell was processed before its canopy loaded.
      if (Dynamics.queueLeafDecayArea) {
        Dynamics.queueLeafDecayArea(Math.floor(ex), Math.floor(ey), Math.floor(ez), r + 8, 0.2, 2.0, true);
      }
    }
    // Explosions remove many blocks at once, including support/multiblock
    // changes. Wake the whole blast zone so nearby water/lava sources flow into
    // the new air pockets instead of staying frozen.
    this.wakeFluidsAround(ex, ey, ez, r + 2);
    const hurtRange = radius * (hurtMult || 2);
    // hiding behind blocks actually helps now
    const cover = (tx, ty, tz) => this.lineOfSight(ex, ey, ez, tx, ty, tz) ? 1 : 0.3;
    const pd = Math.sqrt((Player.body.x - ex) ** 2 + (Player.body.y + 0.9 - ey) ** 2 + (Player.body.z - ez) ** 2);
    if (pd < hurtRange) {
      const dmg = Math.round(maxDmg * (1 - pd / hurtRange) * cover(Player.body.x, Player.body.y + 0.9, Player.body.z));
      if (dmg > 0) Player.hurt(dmg, (Player.body.x - ex) / (pd + 0.01) * 9, (Player.body.z - ez) / (pd + 0.01) * 9);
    }
    Mobs.applyExplosion(ex, ey, ez, hurtRange, maxDmg, cover, src || null);
    Vehicles.applyExplosion(ex, ey, ez, hurtRange, maxDmg);
    // remote players caught in the blast (host is authoritative for explosions)
    if (typeof Multiplayer !== 'undefined' && Multiplayer.applyExplosionToPeers) {
      Multiplayer.applyExplosionToPeers(ex, ey, ez, hurtRange, maxDmg, cover);
    }
  },
};
