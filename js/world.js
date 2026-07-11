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
  // Above this, JS Number can no longer preserve reliable per-block / sub-block math.
  // Hard-guard it so /tp or corrupted saves do not crash the streamer.
  MAX_PLAYABLE_COORD: 4000000000000000,
  WORLD_BORDER_INSET: 10,
  WORLD_BORDER_WALL_TOP: 4000000000000000,
  WORLD_BORDER_RENDER_MARGIN: 16,
  lightBuckets: null,
  _lightBucketCount: -1,
  _lightBucketVersion: 0,
  _lightBucketBuiltVersion: -1,

  init(scene, seed) {
    this.scene = scene;
    this.seed = seed;
    this.dimensionId = 'overworld';
    this.initGenWorkers();
    this.chunks.clear(); this.featureCache.clear(); this.structCellCache.clear();
    this.dungeonCache.clear(); this.dungeonConquered.clear(); this.structSeen.clear(); this.dirty.clear();
    this.lights.clear(); this.saplings.clear(); this.crops.clear(); this.plantationOrigins.clear(); this.plantationUnderSlabs.clear(); this.loreMap.clear(); this.diffs.clear();
    this.lightBuckets = null; this._lightBucketCount = -1; this._lightBucketVersion = 0; this._lightBucketBuiltVersion = -1;
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
              float packed = floor(vColor.g * 4095.0 + 0.5);
              vec3 lb = vec3(mod(packed, 16.0), mod(floor(packed / 16.0), 16.0), floor(packed / 256.0)) / 15.0;
              float ls = vColor.b * dayF;
              vColor = vColor.r * max(max(lb, vec3(ls)), vec3(0.045));
            }`
          );
        };
        return mat;
      };
      this.matSolid = lightPatch(new THREE.MeshBasicMaterial({ map: Atlas.texture, vertexColors: true }));
      {
        // greedy-merged quads carry the tile ORIGIN in uv and repeat coords in
        // aRep; re-tile with fract() so one wide quad shows N copies of the tile
        const prevPatch = this.matSolid.onBeforeCompile;
        const tile = Atlas.uv('stone'); // every atlas tile has the same size
        this.matSolid.onBeforeCompile = (sh) => {
          prevPatch(sh);
          sh.uniforms.uTile = { value: new THREE.Vector2(tile.u1 - tile.u0, tile.v1 - tile.v0) };
          sh.vertexShader = 'attribute vec2 aRep;\nvarying vec2 vRep;\n' + sh.vertexShader.replace(
            '#include <uv_vertex>',
            '#include <uv_vertex>\n vRep = aRep;'
          );
          sh.fragmentShader = 'uniform vec2 uTile;\nvarying vec2 vRep;\n' + sh.fragmentShader.replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec2 mUv = vUv;
              if (vRep.x + vRep.y > 0.0001) mUv = vUv + vec2(fract(vRep.x), min(vRep.y, 0.9999)) * uTile;
              vec4 sampledDiffuseColor = texture2D(map, mUv);
              diffuseColor *= sampledDiffuseColor;
            #endif`
          );
        };
      }
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
  // Do NOT use bitwise >> 4 for world coordinates. JavaScript bitwise math
  // truncates to signed 32-bit, so chunks at huge coordinates wrap to the wrong
  // place and the generated meshes vanish far from spawn.
  chunkCoord(v) { return Math.floor(Math.floor(v) / 16); },
  localCoord(v) { const n = Math.floor(v); return ((n % 16) + 16) % 16; },
  coordPlayable(v) { return Number.isFinite(+v) && Math.abs(+v) <= this.MAX_PLAYABLE_COORD; },
  coordsPlayable(x, z) { return this.coordPlayable(x) && this.coordPlayable(z); },
  chunkKeyForBlock(x, z) { return this.key(this.chunkCoord(x), this.chunkCoord(z)); },
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

  minPlayableCoord() { return -this.MAX_PLAYABLE_COORD; },
  maxPlayableCoord() { return this.MAX_PLAYABLE_COORD; },
  chunkPlayable(cx, cz) {
    const min = this.minPlayableCoord() - (this.WORLD_BORDER_RENDER_MARGIN || 0);
    const max = this.maxPlayableCoord() + (this.WORLD_BORDER_RENDER_MARGIN || 0);
    const x0 = cx * 16, x1 = x0 + 15, z0 = cz * 16, z1 = z0 + 15;
    return x1 >= min && x0 <= max && z1 >= min && z0 <= max;
  },
  isBorderLineColumn(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    const min = this.minPlayableCoord(), max = this.maxPlayableCoord();
    return (x === min || x === max || z === min || z === max);
  },
  isOutsideBorderColumn(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    const min = this.minPlayableCoord(), max = this.maxPlayableCoord();
    return x < min || x > max || z < min || z > max;
  },
  isOutsideBorderWallColumn(x, z) {
    // Only the first column outside the playable range is rendered/collidable as
    // the wall.  Treating the entire one-chunk render margin as filled border
    // blocks made edge chunks expensive to generate and mesh.
    x = Math.floor(x); z = Math.floor(z);
    const min = this.minPlayableCoord(), max = this.maxPlayableCoord();
    return x === min - 1 || x === max + 1 || z === min - 1 || z === max + 1;
  },
  worldBorderTopY() { return Math.floor(this.WORLD_BORDER_WALL_TOP || this.MAX_PLAYABLE_COORD || 4000000000000000); },
  worldBorderCoversY(y) {
    y = Math.floor(+y);
    return Number.isFinite(y) && y >= 0 && y <= this.worldBorderTopY();
  },
  isWorldBorderWallColumn(x, z) {
    return this.isBorderLineColumn(x, z) || this.isOutsideBorderWallColumn(x, z);
  },
  borderSurfaceY(x, z) {
    // Memoized: borderBlockOverride calls this for EVERY block read on a border
    // column (meshing/physics), and heightAt runs up to 5 noise evaluations.
    const key = Math.floor(x) + ',' + Math.floor(z);
    const memo = this._borderSurfMemo || (this._borderSurfMemo = new Map());
    let v = memo.get(key);
    if (v === undefined) {
      const h = this.heightAt(Math.max(this.minPlayableCoord(), Math.min(this.maxPlayableCoord(), Math.floor(x))), Math.max(this.minPlayableCoord(), Math.min(this.maxPlayableCoord(), Math.floor(z))));
      v = Math.max(1, Math.min(this.H - 2, h <= this.SEA ? this.SEA : h));
      if (memo.size > 8192) memo.clear();
      memo.set(key, v);
    }
    return v;
  },
  borderBlockOverride(x, y, z) {
    x = Math.floor(x); z = Math.floor(z);
    // Fast path first: this runs on EVERY block read in the game (meshing,
    // physics, mobs, water). Anything strictly inside the playable area or
    // beyond the wall column can never be a border block — 4 compares, no calls.
    const max = this.MAX_PLAYABLE_COORD, min = -max;
    if (x > min && x < max && z > min && z < max) return 0;
    if (x < min - 1 || x > max + 1 || z < min - 1 || z > max + 1) return 0;
    y = Math.floor(y);
    if (!this.worldBorderCoversY(y)) return 0;
    if (this.isBorderLineColumn(x, z)) {
      const sy = this.borderSurfaceY(x, z);
      // The surface line is visible red wool, but the same boundary column is
      // otherwise solid world-border block from bedrock all the way up.
      if (y === sy) return B.WOOL_RED;
      return B.WORLD_BORDER || B.GLASS;
    }
    if (this.isOutsideBorderWallColumn(x, z)) return B.WORLD_BORDER || B.GLASS;
    return 0;
  },
  borderProtectedBlock(x, y, z) { return !!this.borderBlockOverride(Math.floor(x), Math.floor(y), Math.floor(z)); },

  getBlock(x, y, z) {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    const border = this.borderBlockOverride(bx, by, bz);
    if (border) return border;
    if (!this.coordsPlayable(bx, bz)) return B.AIR;
    if (by < 0) return B.AIR; // below the generated world is true void, not invisible bedrock
    const ch = this.chunks.get(this.chunkKeyForBlock(bx, bz));
    if (!ch) return by < this.H ? B.STONE : B.AIR;
    if (by < this.H) return ch.blocks[this.idx(this.localCoord(bx), by, this.localCoord(bz))];
    return this.extraBlock(ch, bx, by, bz);
  },

  hasChunk(x, z) { return this.chunks.has(this.chunkKeyForBlock(x, z)); },

  // ---------- lighting (0-15 sky + packed 4-bit RGB block channels) ----------
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

  lightRGBMax(packed) { return Math.max(packed & 15, (packed >> 4) & 15, (packed >> 8) & 15); },

  lightEmitRGB(id) {
    const d = Reg[id], lvl = d && d.lightLevel ? Math.max(0, Math.min(15, d.lightLevel | 0)) : 0;
    if (!lvl) return 0;
    if (d.lightColor === undefined || d.lightColor === null) return lvl | (lvl << 4) | (lvl << 8);
    const c = d.lightColor;
    const r8 = Array.isArray(c) ? (+c[0] || 0) : ((c >> 16) & 255);
    const g8 = Array.isArray(c) ? (+c[1] || 0) : ((c >> 8) & 255);
    const b8 = Array.isArray(c) ? (+c[2] || 0) : (c & 255);
    const q = v => Math.max(0, Math.min(15, Math.round(lvl * Math.max(0, Math.min(255, v)) / 255)));
    const r = q(r8), g = q(g8), b = q(b8);
    return r | (g << 4) | (b << 8);
  },

  getBlockLightRGBRaw(x, y, z) {
    if (y >= this.H) return this.sparseBlockLightRGBAt(x, y, z);
    if (y < 0) return 0;
    const ch = this.chunks.get(this.chunkKeyForBlock(x, z));
    if (!ch || !ch.light) return 0;
    const i = this.idx(this.localCoord(x), y, this.localCoord(z));
    if (ch.blockRGB) return ch.blockRGB[i] || 0;
    const l = ch.light[i] & 15;
    return l | (l << 4) | (l << 8);
  },

  getLightRaw(x, y, z) {
    if (y >= this.H) return 0xF0 | this.lightRGBMax(this.sparseBlockLightRGBAt(x, y, z));
    if (y < 0) return 0;
    const ch = this.chunks.get(this.chunkKeyForBlock(x, z));
    if (!ch) return 0xF0;
    // A loaded chunk with light temporarily cleared for a relight pass must not
    // behave like open sky. Treating it as 15 skylight was re-seeding stale cave
    // light from chunks waiting to be recomputed after a roof hole got patched.
    if (!ch.light) return 0;
    const i = this.idx(this.localCoord(x), y, this.localCoord(z));
    return (ch.light[i] & 0xF0) | this.lightRGBMax(ch.blockRGB ? ch.blockRGB[i] : ((ch.light[i] & 15) * 0x111));
  },

  getSkyLight(x, y, z) { return this.getLightRaw(x, y, z) >> 4; },
  getBlockLight(x, y, z) { return this.lightRGBMax(this.getBlockLightRGBRaw(x, y, z)); },
  getLightColor(x, y, z, dayF) {
    const p = this.getBlockLightRGBRaw(x, y, z), sky = this.getSkyLight(x, y, z) / 15 * (dayF === undefined ? (this.dayFUniform ? this.dayFUniform.value : 1) : dayF);
    return [Math.max((p & 15) / 15, sky), Math.max(((p >> 4) & 15) / 15, sky), Math.max(((p >> 8) & 15) / 15, sky)];
  },

  markLightBucketsDirty() { this._lightBucketVersion = (this._lightBucketVersion || 0) + 1; },

  lightBucketKey(x, y, z) {
    return this.chunkCoord(x) + ',' + Math.floor(Math.floor(y) / 16) + ',' + this.chunkCoord(z);
  },

  rebuildLightBuckets() {
    // These buckets serve ONLY sparseBlockLightAt (queries at y >= H). A light
    // can reach at most 15 blocks, so anything below H-15 can never matter —
    // and that is ~all of them (underground lava/torches). Filtering here keeps
    // the buckets near-empty, which makes both rebuilds and queries ~free.
    // (A border-wall chunk was calling this with 22k unfiltered lights: seconds
    // of rebuild churn per mesh while chunks streamed in.)
    const buckets = new Map();
    const yMin = this.H - 15;
    if (this.lights && this.lights.size) {
      for (const v of this.lights.values()) {
        if (!v || v.length < 3) continue;
        const x = Math.floor(v[0]), y = Math.floor(v[1]), z = Math.floor(v[2]);
        if (y < yMin) continue;
        if (!Number.isFinite(x + y + z)) continue;
        const k = this.lightBucketKey(x, y, z);
        let arr = buckets.get(k);
        if (!arr) buckets.set(k, arr = []);
        arr.push(v);
      }
    }
    this.lightBuckets = buckets;
    this._lightBucketCount = this.lights ? this.lights.size : 0;
    this._lightBucketBuiltVersion = this._lightBucketVersion || 0;
  },

  sparseBlockLightRGBAt(x, y, z) {
    // Player-built lights above H are sparse; sample only nearby section buckets.
    if (!this.lights || !this.lights.size) return 0;
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (!Number.isFinite(x + y + z)) return 0;
    if (!this.lightBuckets || this._lightBucketCount !== this.lights.size || this._lightBucketBuiltVersion !== (this._lightBucketVersion || 0)) this.rebuildLightBuckets();
    if (!this.lightBuckets.size) return 0;
    const cx = this.chunkCoord(x), cy = Math.floor(y / 16), cz = this.chunkCoord(z);
    let br = 0, bg = 0, bb = 0;
    for (let dxs = -1; dxs <= 1; dxs++) for (let dys = -1; dys <= 1; dys++) for (let dzs = -1; dzs <= 1; dzs++) {
      const arr = this.lightBuckets.get((cx + dxs) + ',' + (cy + dys) + ',' + (cz + dzs));
      if (!arr) continue;
      for (const v of arr) {
        const lx = v[0], ly = v[1], lz = v[2];
        const dist = Math.abs(lx - x) + Math.abs(ly - y) + Math.abs(lz - z);
        if (dist > 15) continue;
        const em = this.lightEmitRGB(this.getBlock(lx, ly, lz));
        br = Math.max(br, (em & 15) - dist);
        bg = Math.max(bg, ((em >> 4) & 15) - dist);
        bb = Math.max(bb, ((em >> 8) & 15) - dist);
        if (br >= 15 && bg >= 15 && bb >= 15) return 0xFFF;
      }
    }
    return Math.max(0, br) | (Math.max(0, bg) << 4) | (Math.max(0, bb) << 8);
  },

  sparseBlockLightAt(x, y, z) { return this.lightRGBMax(this.sparseBlockLightRGBAt(x, y, z)); },

  computeChunkLight(ch) {
    const H = this.H;
    const L = ch.light = new Uint8Array(16 * 16 * H);
    const C = ch.blockRGB = new Uint16Array(16 * 16 * H);
    const blocks = ch.blocks;
    const X0 = ch.cx * 16, Z0 = ch.cz * 16;
    const qx = [], qy = [], qz = [], ql = [], qc = []; // 0 sky, 1 red, 2 green, 3 blue
    const chan = (p, c) => (p >> ((c - 1) * 4)) & 15;
    const setChan = (i, c, lvl) => {
      const shift = (c - 1) * 4, mask = 15 << shift;
      C[i] = (C[i] & ~mask) | (lvl << shift);
      L[i] = (L[i] & 0xF0) | this.lightRGBMax(C[i]);
    };

    const skyTop = new Int16Array(256);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      let open = true, top = H;
      for (let y = H - 1; y >= 0; y--) {
        const i = this.idx(lx, y, lz), id = blocks[i];
        if (open && this.opaqueToLight(id)) { open = false; top = y + 1; }
        if (open) L[i] = 0xF0;
        const em = this.lightEmitRGB(id);
        if (em) {
          C[i] = em; L[i] = (L[i] & 0xF0) | this.lightRGBMax(em);
          for (let c = 1; c <= 3; c++) { const v = chan(em, c); if (v) { qx.push(lx); qy.push(y); qz.push(lz); ql.push(v); qc.push(c); } }
        }
      }
      if (open) top = 0;
      skyTop[lz * 16 + lx] = top;
    }
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const myTop = skyTop[lz * 16 + lx];
      let maxNb = myTop;
      if (lx > 0) maxNb = Math.max(maxNb, skyTop[lz * 16 + lx - 1]);
      if (lx < 15) maxNb = Math.max(maxNb, skyTop[lz * 16 + lx + 1]);
      if (lz > 0) maxNb = Math.max(maxNb, skyTop[(lz - 1) * 16 + lx]);
      if (lz < 15) maxNb = Math.max(maxNb, skyTop[(lz + 1) * 16 + lx]);
      if (lx === 0 || lx === 15 || lz === 0 || lz === 15) maxNb = Math.min(H, maxNb + 2);
      for (let y = myTop; y < maxNb && y < H; y++) { qx.push(lx); qy.push(y); qz.push(lz); ql.push(15); qc.push(0); }
    }
    const hDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], SKY_EDGE_SPILL = 10;
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) for (let y = 0; y < H; y++) {
      const i = this.idx(lx, y, lz);
      if ((L[i] >> 4) !== 15) continue;
      for (const [dx, dz] of hDirs) {
        const nx = lx + dx, nz = lz + dz;
        if (nx < 0 || nx > 15 || nz < 0 || nz > 15) continue;
        const ni = this.idx(nx, y, nz);
        if (!this.opaqueToLight(blocks[ni]) && (L[ni] >> 4) < SKY_EDGE_SPILL) { qx.push(nx); qy.push(y); qz.push(nz); ql.push(SKY_EDGE_SPILL); qc.push(0); }
      }
    }
    const seedFrom = (lx, y, lz, nx, nz) => {
      const raw = this.getLightRaw(X0 + nx, y, Z0 + nz), p = this.getBlockLightRGBRaw(X0 + nx, y, Z0 + nz);
      const sky = (raw >> 4) - 1;
      if (sky > 0) { qx.push(lx); qy.push(y); qz.push(lz); ql.push(sky); qc.push(0); }
      for (let c = 1; c <= 3; c++) { const v = chan(p, c) - 1; if (v > 0) { qx.push(lx); qy.push(y); qz.push(lz); ql.push(v); qc.push(c); } }
    };
    const nW = this.chunks.get(this.key(ch.cx - 1, ch.cz)), nE = this.chunks.get(this.key(ch.cx + 1, ch.cz));
    const nN = this.chunks.get(this.key(ch.cx, ch.cz - 1)), nS = this.chunks.get(this.key(ch.cx, ch.cz + 1));
    for (let y = 0; y < H; y++) for (let l = 0; l < 16; l++) {
      if (nW && nW.light) seedFrom(0, y, l, -1, l);
      if (nE && nE.light) seedFrom(15, y, l, 16, l);
      if (nN && nN.light) seedFrom(l, y, 0, l, -1);
      if (nS && nS.light) seedFrom(l, y, 15, l, 1);
    }

    while (qx.length) {
      const x = qx.pop(), y = qy.pop(), z = qz.pop(), lvl = ql.pop(), c = qc.pop();
      const i = this.idx(x, y, z), id = blocks[i];
      if (this.opaqueToLight(id) && this.lightEmit(id) === 0) continue;
      const cur = c === 0 ? (L[i] >> 4) : chan(C[i], c);
      if (lvl < cur) continue;
      if (lvl > cur) c === 0 ? (L[i] = (lvl << 4) | (L[i] & 15)) : setChan(i, c, lvl);
      if (lvl <= 1) continue;
      const spread = (nx, ny, nz) => {
        if (nx < 0 || nx > 15 || nz < 0 || nz > 15 || ny < 0 || ny >= H) return;
        const ni = this.idx(nx, ny, nz);
        if (this.opaqueToLight(blocks[ni])) return;
        const ncur = c === 0 ? (L[ni] >> 4) : chan(C[ni], c), nl = lvl - 1;
        if (nl > ncur) { qx.push(nx); qy.push(ny); qz.push(nz); ql.push(nl); qc.push(c); }
      };
      spread(x, y - 1, z); spread(x, y + 1, z); spread(x + 1, y, z); spread(x - 1, y, z); spread(x, y, z + 1); spread(x, y, z - 1);
    }
  },

  // ---------- incremental RGB lighting (BFS add/remove, crosses chunk borders) ----------
  getChLight(x, y, z, channel) {
    if (y < 0 || y >= this.H) return 0;
    const ch = this.chunks.get(this.chunkKeyForBlock(x, z));
    if (!ch || !ch.light) return 0;
    const i = this.idx(this.localCoord(x), y, this.localCoord(z));
    if (channel === 0) return ch.light[i] >> 4;
    const p = ch.blockRGB ? ch.blockRGB[i] : ((ch.light[i] & 15) * 0x111);
    return (p >> ((channel - 1) * 4)) & 15;
  },

  setChLight(x, y, z, channel, lvl, touched) {
    if (y < 0 || y >= this.H) return;
    const ch = this.chunks.get(this.chunkKeyForBlock(x, z));
    if (!ch || !ch.light) return;
    const i = this.idx(this.localCoord(x), y, this.localCoord(z));
    if (channel === 0) ch.light[i] = (lvl << 4) | (ch.light[i] & 15);
    else {
      if (!ch.blockRGB) ch.blockRGB = new Uint16Array(16 * 16 * this.H);
      const shift = (channel - 1) * 4, mask = 15 << shift;
      ch.blockRGB[i] = (ch.blockRGB[i] & ~mask) | (lvl << shift);
      ch.light[i] = (ch.light[i] & 0xF0) | this.lightRGBMax(ch.blockRGB[i]);
    }
    if (touched) {
      touched.add(this.key(ch.cx, ch.cz));
      const lx = this.localCoord(x), lz = this.localCoord(z);
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
      const k = this.chunkKeyForBlock(x, z);
      if (k !== cKey) { cKey = k; cCh = this.chunks.get(k); }
      return cCh;
    };
    for (let lvl = 15; lvl >= 1; lvl--) {
      const bq = buckets[lvl];
      for (let qi = 0; qi < bq.length; qi++) {
        const n = bq[qi];
        const ch = n.ch || chunkAt(n.x, n.z); // pushed nodes carry their chunk
        if (!ch || !ch.light) continue;
        const i = this.idx(this.localCoord(n.x), n.y, this.localCoord(n.z));
        const cur = this.getChLight(n.x, n.y, n.z, channel);
        if (lvl <= cur) continue;
        this.setChLight(n.x, n.y, n.z, channel, lvl, touched);
        if (lvl <= 1) continue;
        for (const [dx, dy, dz] of this.LIGHT_DIRS) {
          const nx = n.x + dx, ny = n.y + dy, nz = n.z + dz;
          if (ny < 0 || ny >= H) continue;
          // same-chunk fast path; only border hops pay a lookup
          const nch = (this.chunkCoord(nx) === ch.cx && this.chunkCoord(nz) === ch.cz) ? ch : chunkAt(nx, nz);
          if (!nch || !nch.light) continue;
          const ni = this.idx(this.localCoord(nx), ny, this.localCoord(nz));
          if (this.opaqueToLight(nch.blocks[ni])) continue;
          const nl = lvl - 1; // direct sky columns are handled by full recompute, not flood-fill
          const ncur = this.getChLight(nx, ny, nz, channel);
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

  // Rebuild only the Manhattan sphere a weakened emitter could have lit.
  // Real emitters and unaffected outside light seed the cleared cells again.
  relightBlockArea(sx, sy, sz, radius, touched) {
    const r = Math.max(0, radius | 0), queues = [null, [], [], []], seed = (x, y, z, packed, through = true) => {
      if (!packed || (through && !this.transparentToLight(x, y, z))) return;
      for (let c = 1; c <= 3; c++) { const l = (packed >> ((c - 1) * 4)) & 15; if (l) queues[c].push({ x, y, z, l }); }
    };
    const each = fn => {
      for (let dx = -r; dx <= r; dx++) for (let dz = -(r - Math.abs(dx)); dz <= r - Math.abs(dx); dz++) {
        const yr = r - Math.abs(dx) - Math.abs(dz), x = sx + dx, z = sz + dz;
        for (let y = Math.max(0, sy - yr); y <= Math.min(this.H - 1, sy + yr); y++) fn(x, y, z, dx, y - sy, dz);
      }
    };

    each((x, y, z) => {
      const ch = this.chunks.get(this.chunkKeyForBlock(x, z));
      if (!ch || !ch.light || !ch.blockRGB) return;
      const i = this.idx(this.localCoord(x), y, this.localCoord(z));
      if (!ch.blockRGB[i]) return;
      ch.blockRGB[i] = 0;
      ch.light[i] &= 0xF0;
      touched.add(this.key(ch.cx, ch.cz));
    });

    each((x, y, z, dx, dy, dz) => {
      seed(x, y, z, this.lightEmitRGB(this.getBlock(x, y, z)), false);
      for (const [ox, oy, oz] of this.LIGHT_DIRS) {
        if (Math.abs(dx + ox) + Math.abs(dy + oy) + Math.abs(dz + oz) <= r) continue;
        const p = this.getBlockLightRGBRaw(x + ox, y + oy, z + oz);
        let q = 0;
        for (let c = 0; c < 3; c++) q |= Math.max(0, ((p >> (c * 4)) & 15) - 1) << (c * 4);
        seed(x, y, z, q);
      }
    });
    for (let c = 1; c <= 3; c++) this.lightAdd(queues[c], c, touched);
  },

  lightOnBlockChanged(x, y, z, oldId, newId) {
    if (y < 0 || y >= this.H) return;
    const ch = this.chunks.get(this.chunkKeyForBlock(x, z));
    if (!ch || !ch.light) return;
    const oldEm = this.lightEmitRGB(oldId), newEm = this.lightEmitRGB(newId);
    const oldOp = this.opaqueToLight(oldId), newOp = this.opaqueToLight(newId);
    if (oldEm === newEm && oldOp === newOp) return;

    const touched = new Set();
    if (oldOp !== newOp) this.lightRemove(x, y, z, 0, touched);

    const decreased = [0, 4, 8].some(shift => ((newEm >> shift) & 15) < ((oldEm >> shift) & 15));
    if (decreased) this.relightBlockArea(x, y, z, this.lightRGBMax(oldEm) - 1, touched);
    else {
      if (oldOp !== newOp) for (let c = 1; c <= 3; c++) this.lightRemove(x, y, z, c, touched);
      for (let c = 1; c <= 3; c++) {
        const lvl = (newEm >> ((c - 1) * 4)) & 15;
        if (lvl) this.lightAdd([{ x, y, z, l: lvl }], c, touched);
      }
    }

    if (oldOp !== newOp && !newOp) {
      const skyQ = [], rgbQ = [null, [], [], []];
      for (const [dx, dy, dz] of this.LIGHT_DIRS) {
        const sky = this.getChLight(x + dx, y + dy, z + dz, 0), l = (dy === 1 && sky === 15) ? 15 : sky - 1;
        if (l > 0) skyQ.push({ x, y, z, l });
        if (!decreased) for (let c = 1; c <= 3; c++) { const v = this.getChLight(x + dx, y + dy, z + dz, c) - 1; if (v > 0) rgbQ[c].push({ x, y, z, l: v }); }
      }
      this.lightAdd(skyQ, 0, touched);
      if (!decreased) for (let c = 1; c <= 3; c++) this.lightAdd(rgbQ[c], c, touched);
    }

    // Opacity changes can affect skylight far beyond a block emitter's fixed
    // range, so keep the existing time-sliced verification only for those.
    if (oldOp !== newOp) {
      const ccx = this.chunkCoord(x), ccz = this.chunkCoord(z), lx = this.localCoord(x), lz = this.localCoord(z);
      this.relightQueue.add(this.key(ccx, ccz));
      if (lx === 0) this.relightQueue.add(this.key(ccx - 1, ccz));
      if (lx === 15) this.relightQueue.add(this.key(ccx + 1, ccz));
      if (lz === 0) this.relightQueue.add(this.key(ccx, ccz - 1));
      if (lz === 15) this.relightQueue.add(this.key(ccx, ccz + 1));
    }
    for (const k of touched) { const c2 = this.chunks.get(k); if (c2 && c2.hasMesh) this.dirty.add(k); }
  },

  // push a freshly-lit chunk's border light into already-lit neighbors
  borderPush(ch) {
    const X0 = ch.cx * 16, Z0 = ch.cz * 16;
    const touched = new Set();
    for (const channel of [0, 1, 2, 3]) {
      const q = [];
      const feed = (x, y, z, nx, nz) => {
        const l = this.getChLight(x, y, z, channel);
        if (l <= 1) return;
        const nb = this.chunks.get(this.chunkKeyForBlock(nx, nz));
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
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (this.borderProtectedBlock(x, y, z) && !(opts && opts.allowBorderEdit)) return;
    if (!this.coordsPlayable(x, z)) return;
    if (y < 0) return;
    const cx = this.chunkCoord(x), cz = this.chunkCoord(z);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return;
    const baseY = y < this.H;
    const lx0 = this.localCoord(x), lz0 = this.localCoord(z);
    const old = baseY ? ch.blocks[this.idx(lx0, y, lz0)] : this.extraBlock(ch, x, y, z);
    if (isWaterlogged(old) && id === B.AIR && !opts.noWaterRestore) id = B.WATER;
    if (old === id) return;
    if (baseY) ch.blocks[this.idx(lx0, y, lz0)] = id;
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
    const lx = this.localCoord(x), lz = this.localCoord(z);
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

    // incremental light update (only touches the cells that actually change).
    // Mass edits like explosions/falling sand can opt out and queue a chunk
    // verification pass instead, avoiding one light flood-fill per destroyed block.
    if (opts.skipLight) {
      const oldEm = this.lightEmit(old), newEm = this.lightEmit(id);
      const oldOp = this.opaqueToLight(old), newOp = this.opaqueToLight(id);
      if (y >= 0 && y < this.H && (oldEm !== newEm || oldOp !== newOp)) this.relightQueue.add(this.key(cx, cz));
    } else {
      this.lightOnBlockChanged(x, y, z, old, id);
    }

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
    if (wasLight && !isLight) { this.lights.delete(k); this.markLightBucketsDirty(); }
    if (isLight) { this.lights.set(k, [x, y, z]); this.markLightBucketsDirty(); }
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
    if ((oldId === B.FURNACE || oldId === B.FURNACE_LIT || oldId === B.OXYGENATION_BENCH) &&
        newId !== B.FURNACE && newId !== B.FURNACE_LIT && newId !== B.OXYGENATION_BENCH) {
      const f = this.furnaces.get(k);
      if (f) {
        for (const s of [f.in, f.fuel, f.out]) {
          if (s) Drops.spawn(x + 0.5, y + 0.5, z + 0.5, s.id, s.count, null, s.dur, s.data);
        }
        this.furnaces.delete(k);
      }
    }
    const oldWasStorage = typeof isStorageChestBlock === 'function' ? isStorageChestBlock(oldId) : (oldId === B.CHEST || oldId === B.LOOT_CRATE || oldId === B.JELLY_CHEST);
    const newIsStorage = typeof isStorageChestBlock === 'function' ? isStorageChestBlock(newId) : (newId === B.CHEST || newId === B.LOOT_CRATE || newId === B.JELLY_CHEST);
    if (oldWasStorage && !newIsStorage) {
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
    const oldWasSpawner = typeof isSpawnerBlock === 'function' ? isSpawnerBlock(oldId) : oldId === B.SPAWNER;
    const newIsSpawner = typeof isSpawnerBlock === 'function' ? isSpawnerBlock(newId) : newId === B.SPAWNER;
    if (oldWasSpawner && !newIsSpawner) this.spawners.delete(k);
    if (oldId === B.JELLY_HOUSE && newId !== B.JELLY_HOUSE && typeof Jelly !== 'undefined' && !opts.jellyHouseBreakHandled) {
      Jelly.onHouseBreak(k, { reason: 'block_removed', drop: false });
    }
    if (newIsSpawner && !this.spawners.has(k)) {
      const rank = typeof dungeonRankForSpawnerBlock === 'function' ? dungeonRankForSpawnerBlock(newId) : '';
      this.spawners.set(k, rank ? this.createDungeonSpawnerState(rank, opts && opts.dungeonKey) : { type: ['skeleton', 'creeper', 'humbug'][(Math.random() * 3) | 0], cd: 3 });
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

    // Grass above the base terrain height lives in extraBlocks. Make it obey
    // the same smother rule immediately when a full opaque block is placed over it.
    const below = this.getBlock(x, y - 1, z);
    if ((below === B.GRASS || below === B.SNOWY_GRASS) && !this.grassCanStayCovered(newId)) {
      this.setBlock(x, y - 1, z, B.DIRT, { noUpdate: true });
    }

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
      const dropId = above === B.SIGN ? B.SIGN : isSapling(above) ? above : isFlower(above) ? above : isTorch(above) ? torchItemId(above) : above;
      Drops.spawn(x + 0.5, y + 1.3, z + 0.5, dropId, 1);
    }
    for (const [wid, dir] of Object.entries(WTORCH_DIR)) {
      const tx = x + dir[0], tz = z + dir[2];
      if (this.getBlock(tx, y, tz) === +wid) {
        this.setBlock(tx, y, tz, B.AIR);
        const dropId = Reg[+wid] && Reg[+wid].drop ? Reg[+wid].drop.id : B.TORCH;
        Drops.spawn(tx + 0.5, y + 0.4, tz + 0.5, dropId, 1);
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
    // DETERMINISM: rnd is the caller's seeded stream (dungeon/structure build).
    // The rolls below must ALWAYS run so the stream advances identically on
    // every machine and every regen — early-returning here (old behavior) made
    // dungeon layouts differ between host/client and across save reloads.
    // The "skip" cases only skip STORING the loot, never rolling it.
    const skipStore = this.chests.has(k)
      // Multiplayer: only the host rolls container loot into storage. Clients
      // receive the authoritative slots via chest_snapshot on open.
      || (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client');
    size = Math.max(27, Math.floor(+size || 27));
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
          [I.DUNGEON_KEY_GREEN, 1, 1, 0.12], [I.DARK_FLOOPIUM, 1, 1, 0.10],
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
          [I.DUNGEON_KEY_BLUE, 1, 1, 0.11], [I.CHARGE_CORE, 1, 1, 0.10],
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
          [I.DUNGEON_KEY_GOLD, 1, 1, 0.07], [I.STAR, 1, 2, 0.28],
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
    if (!skipStore) this.chests.set(k, slots);
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

  oceanNoiseAt(x, z) { return NoiseGen.fbm2(this.seed + 8383, x * 0.00135, z * 0.00135, 4, 2, 0.5); },
  oceanBlendAt(x, z) { return this._smoothstep(0.50, 0.68, this.oceanNoiseAt(x, z)); },
  deepOceanBlendAt(x, z) { return this._smoothstep(0.70, 0.86, this.oceanNoiseAt(x, z)); },

  rawHeightAt(x, z) {
    const s = this.seed;
    const e = NoiseGen.fbm2(s, x * 0.0045, z * 0.0045, 4, 2, 0.5);
    const r = NoiseGen.fbm2(s + 9917, x * 0.03, z * 0.03, 3, 2, 0.5);

    let normal = 15 + e * 36 + r * 7;
    const mtn = NoiseGen.fbm2(s + 551, x * 0.006, z * 0.006, 3, 2, 0.5);
    if (mtn > 0.58) normal += (mtn - 0.58) * 95;

    // Deserts stay above sea level, while broad ocean masks pull terrain below sea level.
    const ocean = this.oceanBlendAt(x, z), deep = this.deepOceanBlendAt(x, z);
    const desert = this.SEA - 1 + e * 14 + r * 2;
    const land = this._lerp(normal, desert, this.desertBlendAt(x, z) * (1 - ocean));
    const floor = this.SEA - 4 - e * 3 - deep * 14 + r * 1.5;
    return Math.max(4, Math.min(this.H - 8, this._lerp(land, floor, ocean))); 
  },

  heightAt(x, z) {
    const raw = this.rawHeightAt(x, z);
    const d = this.desertBlendAt(x, z), o = this.oceanBlendAt(x, z);
    // Extra shoreline/border smoothing only where terrain or ocean masks transition.
    const border = Math.max(1 - Math.abs(d * 2 - 1), 1 - Math.abs(o * 2 - 1));
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
    const ocean = this.oceanBlendAt(x, z);
    if (ocean > 0.58) return this.deepOceanBlendAt(x, z) > 0.48 ? 'deep_ocean' : 'ocean';
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
    return this.finishChunk(cx, cz, this.genChunkBlocks(cx, cz));
  },

  // ---------- worldgen worker pool ----------
  // Chunk gen + first lighting run in Web Workers on EVERY origin, including
  // file:// — the workers are Blob workers assembled from source the page has
  // already loaded (file:// pages may construct Blob workers but cannot
  // importScripts, and Chrome refuses file:// script-URL workers outright).
  // Every request carries seed + conquered dungeons, so the workers never
  // need stateful syncing. The synchronous path exists ONLY as a loudly
  // announced emergency fallback if worker construction itself fails.
  _genWorkers: null,
  _genPending: new Set(),
  _genRR: 0,
  _warnSingleThread(why) {
    console.error('[worldgen] Web Workers unavailable (' + why + ') — running SINGLE-THREADED sync generation.');
    const note = () => { if (typeof UI !== 'undefined' && UI.chat) UI.chat('Warning: worldgen workers failed (' + why + ') — using slower single-thread generation.', '#ff8080'); };
    if (typeof UI !== 'undefined' && UI.chat) note(); else setTimeout(note, 3000);
  },
  initGenWorkers() {
    this._genPending.clear();
    if (this._genWorkers) return; // pool survives world switches (requests carry the seed)
    if (typeof Worker === 'undefined') return this._warnSingleThread('no Worker API');
    try {
      const src = [
        '"use strict";',
        'const Multiplayer = { role: "solo" };', // initChest checks this to skip client-side loot storage
        NoiseGenFactory.toString(),
        'const NoiseGen = NoiseGenFactory();',
        BLOCKS_WORLDGEN_SRC,
        WORLD_LORE_SRC,
        'const World = ' + WORLD_SRC + ';',
        '(' + WORLDGEN_WORKER_DRIVER.toString() + ')();',
      ].join('\n');
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      this._genWorkers = [0, 1].map(() => {
        const w = new Worker(url);
        w.onmessage = (e) => this._adoptWorkerChunk(e.data);
        w.onerror = (e) => {
          if (this._genWorkers) this._warnSingleThread((e && e.message) || 'worker error');
          this._genWorkers = null;
          this._genPending.clear();
        };
        return w;
      });
    } catch (e) {
      this._genWorkers = null;
      this._warnSingleThread(e && e.message ? e.message : 'construction failed');
    }
  },

  _requestWorkerChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (this._genPending.has(k)) return;
    this._genPending.add(k);
    const bucket = this.diffIndex.get(k);
    const w = this._genWorkers[(this._genRR++) % this._genWorkers.length];
    w.postMessage({
      type: 'gen', cx, cz, seed: this.seed,
      diffs: bucket ? [...bucket.entries()] : null,
      conquered: this.dungeonConquered.size ? [...this.dungeonConquered] : null,
      client: !!(typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client'),
    });
  },

  _adoptWorkerChunk(msg) {
    if (!msg || msg.type !== 'chunk') return;
    const k = this.key(msg.cx, msg.cz);
    this._genPending.delete(k);
    if (msg.seed !== this.seed || this.chunks.has(k)) return; // stale world or raced a sync gen
    const blocks = new Uint16Array(msg.blocks);
    const ch = this.finishChunk(msg.cx, msg.cz, {
      blocks,
      extraBlocks: new Map(msg.extraBlocks || []),
      worldBorderColumns: msg.worldBorderColumns || [],
      light: new Uint8Array(msg.light),
      blockRGB: msg.blockRGB ? new Uint16Array(msg.blockRGB) : null,
    });
    // merge gen-time registries with the same has-guards the sync path uses
    for (const [key, v] of msg.chests || []) if (!this.chests.has(key)) this.chests.set(key, v);
    for (const [key, v] of msg.spawners || []) if (!this.spawners.has(key)) this.spawners.set(key, v);
    for (const [key, v] of msg.lore || []) this.loreMap.set(key, v);
    for (const s of msg.floopSpots || []) this.floopSpots.push(s);
    for (const s of msg.dungeonSpots || []) this.dungeonSpots.push(s);
    // diffs that arrived while the worker was busy (MP stash race)
    const bucket = this.diffIndex.get(k);
    if (bucket) for (const [pk, id] of bucket) {
      const [wx, wy, wz] = pk.split(',').map(Number);
      if (wy >= 0 && wy < this.H) blocks[this.idx(this.localCoord(wx), wy, this.localCoord(wz))] = id;
      else if (wy >= this.H && id !== B.AIR) { if (!ch.extraBlocks) ch.extraBlocks = new Map(); ch.extraBlocks.set(pk, id); }
    }
    // worker light has no neighbor seeds: the border exchange happens at mesh
    // time (budgeted, and chunks that never get meshed never pay for it)
    ch.needsBorderLight = true;
  },

  // pull border light INTO a freshly adopted worker-lit chunk from lit
  // neighbors (the worker floods interior light only — it has no neighbors).
  // Direct typed-array reads: borderPush-style world reads cost ~10ms/chunk.
  borderPull(ch) {
    const X0 = ch.cx * 16, Z0 = ch.cz * 16, H = this.H;
    const touched = new Set();
    const sides = [
      [this.key(ch.cx - 1, ch.cz), 0, 15, true],   // west: my lx 0 <- nb lx 15
      [this.key(ch.cx + 1, ch.cz), 15, 0, true],
      [this.key(ch.cx, ch.cz - 1), 0, 15, false],  // north: my lz 0 <- nb lz 15
      [this.key(ch.cx, ch.cz + 1), 15, 0, false],
    ];
    for (const channel of [0, 1, 2, 3]) {
      const q = [];
      for (const [nk, myEdge, nbEdge, xAxis] of sides) {
        const nb = this.chunks.get(nk);
        if (!nb || !nb.light) continue;
        for (let i = 0; i < 16; i++) {
          const mlx = xAxis ? myEdge : i, mlz = xAxis ? i : myEdge;
          const tlx = xAxis ? nbEdge : i, tlz = xAxis ? i : nbEdge;
          for (let y = 0; y < H; y++) {
            const ni = this.idx(tlx, y, tlz);
            const nl = channel === 0 ? (nb.light[ni] >> 4) : (((nb.blockRGB ? nb.blockRGB[ni] : ((nb.light[ni] & 15) * 0x111)) >> ((channel - 1) * 4)) & 15);
            if (nl <= 1) continue;
            const mi = this.idx(mlx, y, mlz);
            const ml = channel === 0 ? (ch.light[mi] >> 4) : (((ch.blockRGB ? ch.blockRGB[mi] : ((ch.light[mi] & 15) * 0x111)) >> ((channel - 1) * 4)) & 15);
            if (nl - 1 > ml && !this.opaqueToLight(ch.blocks[mi])) {
              q.push({ x: X0 + mlx, y, z: Z0 + mlz, l: nl - 1 });
            }
          }
        }
      }
      if (q.length) this.lightAdd(q, channel, touched);
    }
    for (const tk of touched) {
      const c2 = this.chunks.get(tk);
      if (c2 && c2.hasMesh) this.dirty.add(tk);
    }
  },

  // Phase 1 of chunk generation: build the raw block array (terrain, ores,
  // features, dungeons, saved diffs, border wall). No scene/registry writes on
  // World.chunks — this is the expensive part and it also runs inside the
  // worldgen Web Worker (see js/worldgen-worker.js).
  genChunkBlocks(cx, cz) {
    const k = this.key(cx, cz);
    const H = this.H, SEA = this.SEA;
    const blocks = new Uint16Array(16 * 16 * H); // 16-bit ids: room for every wool color imaginable
    const rnd = this.chunkRand(cx, cz, 101);

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const wx = cx * 16 + lx, wz = cz * 16 + lz;
        const h = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz);
        const ocean = biome === 'ocean', deepOcean = biome === 'deep_ocean';
        const beach = h <= SEA + 1 && !ocean && !deepOcean;
        const sandy = beach || biome === 'desert';
        for (let y = 0; y < H; y++) {
          let id = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y === 1 && NoiseGen.hash3(this.seed, wx, y, wz) < 0.5) id = B.BEDROCK;
          else if (y === 2 && NoiseGen.hash3(this.seed, wx, y, wz) < 0.2) id = B.BEDROCK;
          else if (y < h - (sandy || ocean || deepOcean ? 4 : 2)) id = B.STONE;
          else if (y < h) id = deepOcean ? B.DEEP_OCEAN_STONE : ocean ? B.OCEAN_SAND : sandy ? B.SAND : B.DIRT;
          else if (y === h) {
            if (deepOcean) id = B.DEEP_OCEAN_STONE;
            else if (ocean) id = B.OCEAN_SAND;
            else if (sandy) id = B.SAND;
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
        if (wy2 >= 0 && wy2 < H) blocks[this.idx(this.localCoord(wx2), wy2, this.localCoord(wz2))] = id;
        else if (wy2 >= H && id !== B.AIR) extraBlocks.set(this.pkey(wx2, wy2, wz2), id);
      }
    }

    // Permanent world-border visibility: the last playable surface column is
    // red wool, and the outside/over-edge space is a clear glass wall.  This is
    // applied after worldgen and saved diffs so the boundary cannot silently
    // disappear behind old edits.
    const worldBorderColumns = this.applyWorldBorderToGeneratedChunk(cx, cz, blocks);

    return { blocks, extraBlocks, worldBorderColumns };
  },

  // Phase 2 of chunk generation: adopt the block data into World.chunks and
  // register lights/fires/saplings/crops. Main thread only (uses Math.random
  // for timers and mutates live registries).
  finishChunk(cx, cz, data) {
    const k = this.key(cx, cz);
    const H = this.H;
    const blocks = data.blocks;
    const extraBlocks = data.extraBlocks || new Map();
    const ch = { cx, cz, blocks, extraBlocks: extraBlocks.size ? extraBlocks : null, worldBorderColumns: data.worldBorderColumns || [], light: data.light || null, blockRGB: data.blockRGB || null, solidMesh: null, cutoutMesh: null, waterMesh: null, lavaMesh: null, photoMesh: null, sectionMeshes: [], hasMesh: false };
    this.chunks.set(k, ch);

    for (let y = 0; y < H; y++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const id = blocks[this.idx(lx, y, lz)];
      if (id === B.AIR) continue;
      const def = Reg[id];
      const wx = cx * 16 + lx, wz = cz * 16 + lz;
      if (def && def.light) { this.lights.set(this.pkey(wx, y, wz), [wx, y, wz]); this.markLightBucketsDirty(); }
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
      for (const [pk, id] of [...ch.extraBlocks]) {
        if (id === B.AIR) continue;
        const [wx, y, wz] = pk.split(',').map(Number);
        const def = Reg[id];
        if (def && def.light) { this.lights.set(pk, [wx, y, wz]); this.markLightBucketsDirty(); }
        if (id === B.MEGA_TORCH) this.megaTorches.add(pk);
        if (id === B.FIRE) this.fires.set(pk, { t: 5 });
        else if (isSapling(id) && !this.saplings.has(pk)) this.saplings.set(pk, { id, t: 25 + Math.random() * 50 });
        else if (isCrop(id) && !this.crops.has(pk)) this.crops.set(pk, { id, t: 35 + Math.random() * 55 });
      }
    }
    return ch;
  },

  applyWorldBorderToGeneratedChunk(cx, cz, blocks) {
    // Base terrain is still materialized in the chunk's normal block array, so
    // lighting/meshing/collision below Y80 stays fast and deterministic.  Above
    // Y80 the same wall is provided procedurally by borderBlockOverride() and
    // meshed only for the visible vertical sections, so edge chunks do not hitch.
    const columns = [];
    if (!blocks) return columns;
    const wallId = B.WORLD_BORDER || B.GLASS;
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const wx = cx * 16 + lx, wz = cz * 16 + lz;
        const border = this.isBorderLineColumn(wx, wz);
        const outsideWall = this.isOutsideBorderWallColumn(wx, wz);
        if (!border && !outsideWall) continue;
        const sy = border ? this.borderSurfaceY(wx, wz) : -1;
        columns.push({ lx, lz, wx, wz, border, outsideWall, sy });
        for (let y = 0; y < this.H; y++) {
          blocks[this.idx(lx, y, lz)] = (border && y === sy) ? B.WOOL_RED : wallId;
        }
      }
    }
    return columns;
  },

  safeTeleportY(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    // Prefer loaded block data so player-made columns/shore water are respected;
    // fall back to deterministic terrain height when teleporting into an unloaded border chunk.
    if (this.hasChunk(x, z)) {
      for (let y = Math.min(this.H - 1, this.WORLD_BORDER_WALL_TOP); y >= 1; y--) {
        const id = this.getBlock(x, y, z);
        if (id === B.AIR || isFlower(id) || isSnowSheet(id)) continue;
        if (isFluid(id)) return y + 1.15;
        const def = Reg[id];
        if (def && def.solid) return y + 1.02;
      }
    }
    const h = this.heightAt(x, z);
    return (h <= this.SEA ? this.SEA : h) + 1.05;
  },

  enforceWorldBorder(body) {
    if (!body) return false;
    const st = (typeof Physics !== 'undefined' && Physics.farState) ? Physics.farState(body) : null;
    const wx = st ? st.ox + st.x : body.x;
    const wz = st ? st.oz + st.z : body.z;
    if (this.coordsPlayable(wx, wz)) return false;
    const min = this.minPlayableCoord(), max = this.maxPlayableCoord(), inset = Math.max(1, this.WORLD_BORDER_INSET || 10);
    let nx = wx, nz = wz;
    if (wx > max) nx = max - inset;
    else if (wx < min) nx = min + inset;
    if (wz > max) nz = max - inset;
    else if (wz < min) nz = min + inset;
    if (!Number.isFinite(nx + nz)) { nx = 0; nz = 0; }
    const ny = this.safeTeleportY(nx, nz);

    if (typeof Vehicles !== 'undefined') {
      if (Vehicles.driving || Vehicles.boating) {
        Vehicles.driving = null;
        Vehicles.boating = null;
        if (typeof UI !== 'undefined') UI.chat('World border crossed: dismounted vehicle before moving you back inside.', '#ffd97a');
      }
      if (typeof Player !== 'undefined' && Player.boarding && Vehicles.stopBoard) Vehicles.stopBoard(false, true);
    }

    const ox = (typeof Physics !== 'undefined' && Physics._originFor) ? Physics._originFor(nx) : 0;
    const oz = (typeof Physics !== 'undefined' && Physics._originFor) ? Physics._originFor(nz) : 0;
    body._farPos = { ox, oz, x: nx - ox, z: nz - oz };
    body.x = nx; body.y = ny; body.z = nz;
    body.vx = body.vy = body.vz = 0;
    body.onGround = false; body.hitH = false;
    if (typeof Player !== 'undefined' && Player.body === body) {
      Player.fallDist = 0;
      if (Player.camera) {
        Player.camera.position.set(nx, Player.eyeY ? Player.eyeY() : ny + 1.6, nz);
        Player.camera.rotation.order = 'YXZ';
        Player.camera.rotation.y = Player.yaw || 0;
        Player.camera.rotation.x = Player.pitch || 0;
      }
    }
    if (typeof UI !== 'undefined') UI.chat('World border: moved you 10 blocks back inside on a valid surface.', '#ff8080');
    return true;
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

  surfaceTopBlockId(wx, wz, h) {
    const y = Number.isFinite(h) ? h : this.heightAt(wx, wz);
    const biome = this.biomeAt(wx, wz);
    const beach = y <= this.SEA + 1;
    if (biome === 'deep_ocean') return B.DEEP_OCEAN_STONE;
    if (biome === 'ocean') return B.OCEAN_SAND;
    if (beach || biome === 'desert') return B.SAND;
    if (y > 58) return NoiseGen.hash2(this.seed + 3, wx, wz) < 0.6 ? B.SNOWY_GRASS : B.STONE;
    if (biome === 'snowy') return B.SNOWY_GRASS;
    return B.GRASS;
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
      const topId = this.surfaceTopBlockId(wx, wz, h);
      let type = 'oak';
      if (biome === 'snowy') {
        // Spruce should naturally grow from snowy grass only, never normal grass.
        if (topId !== B.SNOWY_GRASS) continue;
        type = 'spruce';
      } else {
        // Oak/birch stay on normal grass. This keeps spruce out of regular grass biomes.
        if (topId !== B.GRASS) continue;
        if (biome === 'forest') type = tr() < 0.4 ? 'birch' : 'oak';
        else if (tr() < 0.12) type = 'birch';
      }
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
        if (this.surfaceTopBlockId(wx, wz, h) !== B.GRASS) continue;
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
        if (this.surfaceTopBlockId(wx, wz, h) !== B.GRASS) continue;
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

    // Ocean and deep-ocean floor life stays on the normal deterministic feature path.
    {
      const corals = [B.CORAL_RED, B.CORAL_BLUE, B.CORAL_YELLOW, B.CORAL_PURPLE, B.CORAL_GREEN];
      const attempts = 2 + ((tr() * 5) | 0);
      for (let i = 0; i < attempts; i++) {
        const wx = cx * 16 + 1 + ((tr() * 14) | 0), wz = cz * 16 + 1 + ((tr() * 14) | 0);
        const biome = this.biomeAt(wx, wz), h = this.heightAt(wx, wz), depth = this.SEA - h;
        if ((biome !== 'ocean' && biome !== 'deep_ocean') || depth < 3) continue;
        if (biome === 'deep_ocean') {
          if (tr() < 0.34) put(wx, h, wz, B.KELP_BLOCK, true);
          if (tr() < 0.08) put(wx, h + 1, wz, B.SEA_LANTERN, true);
          continue;
        }
        if (tr() < 0.18) put(wx, h, wz, B.SHELL_BLOCK, true);
        if (tr() < Math.min(0.88, 0.25 + depth * 0.05)) {
          put(wx, h + 1, wz, tr() < 0.025 ? B.SEA_LANTERN : corals[(tr() * corals.length) | 0], true);
          if (depth > 5 && tr() < 0.35) {
            const d = [[1,0],[-1,0],[0,1],[0,-1]][(tr() * 4) | 0], nh = this.heightAt(wx + d[0], wz + d[1]);
            if (this.biomeAt(wx + d[0], wz + d[1]) === 'ocean') put(wx + d[0], nh + 1, wz + d[1], corals[(tr() * corals.length) | 0], true);
          }
        }
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
            if (this.surfaceTopBlockId(ox - 2, oz, oh) === B.GRASS) put(ox - 2, oh + 1, oz, B.DANDELION, false);
            if (this.surfaceTopBlockId(ox + 2, oz - 1, oh) === B.GRASS) put(ox + 2, oh + 1, oz - 1, B.ROSE, false);
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
      const baseX = Math.floor(this.chunkCoord(fromX) / 4);
      const baseZ = Math.floor(this.chunkCoord(fromZ) / 4);
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
  dungeonSpawnerProfile(rank) {
    const key = (rank || 'green').toLowerCase();
    const profiles = {
      green: { min: 3, max: 4, liveCap: 2, pool: ['skeleton', 'skeleton', 'skeleton', 'creeper'] },
      blue: { min: 6, max: 8, liveCap: 3, pool: ['skeleton', 'skeleton', 'creeper', 'creeper', 'humbug'] },
      gold: { min: 10, max: 14, liveCap: 4, pool: ['humbug', 'humbug', 'skeleton', 'creeper', 'creeper', 'tung'] },
      diamond: { min: 16, max: 20, liveCap: 5, pool: ['humbug', 'humbug', 'tung', 'tung', 'creeper', 'creeper', 'skeleton'] },
    };
    return profiles[key] || profiles.green;
  },

  createDungeonSpawnerState(rank, dungeonKey, rnd) {
    const profile = this.dungeonSpawnerProfile(rank);
    const r = typeof rnd === 'function' ? rnd : Math.random;
    const max = profile.min + ((r() * (profile.max - profile.min + 1)) | 0);
    return {
      type: 'dungeon_spawner', rank: (rank || 'green').toLowerCase(), dungeonKey: dungeonKey || '',
      cd: 2 + r() * 2, remaining: max, max, spawned: 0, liveCap: profile.liveCap, pool: profile.pool.slice(),
    };
  },

  spawnerMobForState(sp) {
    if (!sp || sp.type === 'sprawler') return 'skeleton';
    if (sp.type && sp.type !== 'dungeon_spawner') return sp.type === 'spider' ? (Math.random() < 0.5 ? 'skeleton' : 'creeper') : sp.type;
    const rank = sp.rank || 'green';
    const profile = this.dungeonSpawnerProfile(rank);
    const pool = Array.isArray(sp.pool) && sp.pool.length ? sp.pool : profile.pool;
    return pool[(Math.random() * pool.length) | 0] || 'skeleton';
  },

  playerInsideDungeon(dungeon, body) {
    if (!dungeon || !body) return false;
    const px = Math.floor(body.x), py = Math.floor(body.y), pz = Math.floor(body.z);
    for (const [ox, oy, oz] of [[0, 0, 0], [0, 1, 0], [0, -1, 0], [0, 2, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      if (this.dungeonOwnsBlock(dungeon, px + ox, py + oy, pz + oz)) return true;
    }
    return false;
  },

  dungeonFor(dscx, dscz) {
    const k = dscx + '|' + dscz;
    if (this.dungeonCache.has(k)) return this.dungeonCache.get(k);
    const r = this.chunkRand(dscx, dscz, 909);
    if (r() > 0.35) { this.dungeonCache.set(k, null); return null; }
    const rankRoll = r();
    const rankInfo = dungeonRankInfo(rankRoll < 0.55 ? 'green' : rankRoll < 0.80 ? 'blue' : rankRoll < 0.95 ? 'gold' : 'diamond');
    const rankChest = typeof dungeonChestBlockForRank === 'function' ? dungeonChestBlockForRank(rankInfo.rank) : B.CHEST;
    const rankCrate = typeof dungeonCrateBlockForRank === 'function' ? dungeonCrateBlockForRank(rankInfo.rank) : B.LOOT_CRATE;
    const rankSpawner = typeof dungeonSpawnerBlockForRank === 'function' ? dungeonSpawnerBlockForRank(rankInfo.rank) : B.SPAWNER;
    const rankBrick = typeof dungeonBrickForRank === 'function' ? dungeonBrickForRank(rankInfo.rank) : B.DUNGEON_BRICK;
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
            setC(x, y, z, rankBrick);
          }
        } else setC(x, y, z, B.AIR);
      }
      setC(cx0, y0, cz0, B.TORCH); setC(cx0 + w - 1, y0, cz0 + l - 1, B.TORCH);
      // some rooms guard their loot with a monster spawner
      if (!conqueredAlready && r() < 0.35 + rankInfo.mobBonus * 0.12) {
        const sx2 = cx0 + (w >> 1), sz2 = cz0 + (l >> 1);
        setC(sx2, y0, sz2, rankSpawner);
        const sk = this.pkey(sx2, y0, sz2);
        // ALWAYS roll the state (keeps the seeded stream identical on regen);
        // only store it when this spawner isn't already registered
        const state = this.createDungeonSpawnerState(rankInfo.rank, k, r);
        if (!this.spawners.has(sk)) this.spawners.set(sk, state);
      }
      const nLoot = 1 + ((r() * 2) | 0);
      for (let i = 0; i < nLoot; i++) {
        const lx = cx0 + 1 + ((r() * (w - 2)) | 0), lz = cz0 + 1 + ((r() * (l - 2)) | 0);
        setC(lx, y0, lz, rankCrate);
        this.initChest(lx, y0, lz, r, r() < rankInfo.richBonus, 'dungeon:' + rankInfo.rank);
      }
      if (isLast) {
        setC(cx0 + (w >> 1), y0, cz0 + (l >> 1), B.DUNGEON_CORE);
        setC(cx0 + (w >> 1) + 1, y0, cz0 + (l >> 1), rankCrate);
        this.initChest(cx0 + (w >> 1) + 1, y0, cz0 + (l >> 1), r, true, 'dungeon:' + rankInfo.rank);
        setC(cx0 + (w >> 1), y0, cz0 + (l >> 1) + 1, rankChest);
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
          if (!cells.has(this.pkey(x + ox, y0 - 1, z + oz))) setC(x + ox, y0 - 1, z + oz, rankBrick);
          if (!cells.has(this.pkey(x + ox, y0 + 3, z + oz))) setC(x + ox, y0 + 3, z + oz, rankBrick);
        }
        for (let y = y0; y < y0 + 3; y++) {
          if (dx !== 0) {
            if (!cells.has(this.pkey(x, y, z - 1))) setC(x, y, z - 1, rankBrick);
            if (!cells.has(this.pkey(x, y, z + 2))) setC(x, y, z + 2, rankBrick);
          } else {
            if (!cells.has(this.pkey(x - 1, y, z))) setC(x - 1, y, z, rankBrick);
            if (!cells.has(this.pkey(x + 2, y, z))) setC(x + 2, y, z, rankBrick);
          }
        }
      }
      return [x, z];
    };

    const roomWalkPoint = (room) => {
      const cx = room.x + (room.w >> 1), cz = room.z + (room.l >> 1);
      const candidates = [
        [cx + 2, cz - 1], [cx + 2, cz + 1], [cx - 2, cz - 1], [cx - 2, cz + 1],
        [cx + 1, cz - 2], [cx - 1, cz + 2], [cx, cz - 2], [cx, cz + 2],
        [cx + 1, cz], [cx - 1, cz], [cx, cz - 1], [cx, cz + 1], [cx, cz],
      ];
      for (const [x, z] of candidates) {
        if (x <= room.x || x >= room.x + room.w - 1 || z <= room.z || z >= room.z + room.l - 1) continue;
        const cell = cells.get(this.pkey(x, baseY, z));
        if (!cell || cell.id === B.AIR || cell.id === B.TORCH) return { x, z };
      }
      return { x: cx, z: cz };
    };
    const carveGuaranteedSegment = (x, z, axis) => {
      const lanes = axis === 'z' ? [[0, 0], [1, 0]] : [[0, 0], [0, 1]];
      for (const [ox, oz] of lanes) {
        const px = x + ox, pz = z + oz;
        for (let y = baseY; y < baseY + 3; y++) {
          const key = this.pkey(px, y, pz);
          const old = cells.get(key);
          if (!old || old.id !== B.DUNGEON_CORE) {
            if (old && typeof isStorageChestBlock === 'function' && isStorageChestBlock(old.id)) this.chests.delete(key);
            setC(px, y, pz, B.AIR);
          }
        }
        if (!cells.has(this.pkey(px, baseY - 1, pz))) setC(px, baseY - 1, pz, rankBrick);
        if (!cells.has(this.pkey(px, baseY + 3, pz))) setC(px, baseY + 3, pz, rankBrick);
      }
      for (let y = baseY; y < baseY + 3; y++) {
        if (axis === 'z') {
          if (!cells.has(this.pkey(x - 1, y, z))) setC(x - 1, y, z, rankBrick);
          if (!cells.has(this.pkey(x + 2, y, z))) setC(x + 2, y, z, rankBrick);
        } else {
          if (!cells.has(this.pkey(x, y, z - 1))) setC(x, y, z - 1, rankBrick);
          if (!cells.has(this.pkey(x, y, z + 2))) setC(x, y, z + 2, rankBrick);
        }
      }
    };
    const carveGuaranteedPath = (a, b) => {
      if (!a || !b) return;
      let x = Math.floor(a.x), z = Math.floor(a.z);
      carveGuaranteedSegment(x, z, 'x');
      const sx = b.x > x ? 1 : -1;
      while (x !== Math.floor(b.x)) { x += sx; carveGuaranteedSegment(x, z, 'x'); }
      const sz = b.z > z ? 1 : -1;
      while (z !== Math.floor(b.z)) { z += sz; carveGuaranteedSegment(x, z, 'z'); }
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
    const walkPoints = rooms.map(roomWalkPoint);
    for (let i = 1; i < walkPoints.length; i++) carveGuaranteedPath(walkPoints[i - 1], walkPoints[i]);

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
      const setWall = (x, y, z) => {
        const old = cells.get(this.pkey(x, y, z));
        if (!old || old.id === rankBrick) setC(x, y, z, rankBrick);
      };
      carveGuaranteedPath({ x: shaftX, z: shaftZ }, walkPoints[0]);

      // Underground entrance room. The east wall opens into room 1; the ranked
      // 3x3 gate lives on the surface tower so it is reachable before the ladder.
      for (let x = entryWest; x <= entryEast; x++) {
        for (let y = first.y - 1; y <= first.y + 3; y++) {
          for (let z = entryZ0; z <= entryZ1; z++) {
            const shell = x === entryWest || x === entryEast || y === first.y - 1 || y === first.y + 3 || z === entryZ0 || z === entryZ1;
            if (shell) setWall(x, y, z);
            else setC(x, y, z, B.AIR);
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
            if (dx === 0 && dz === 0) setC(x, y, z, B.ROPE_LADDER);
            else setWall(x, y, z);
          }
        }
      }
      for (let x = entryWest + 1; x <= entryEast - 1; x++) {
        for (let y = first.y; y <= first.y + 2; y++) {
          for (let z = entryZ0 + 1; z <= entryZ1 - 1; z++) setC(x, y, z, B.AIR);
        }
      }
      for (let y = first.y; y < surfaceFloorY; y++) {
        setC(shaftX, y, shaftZ, B.ROPE_LADDER);
      }

      // Surface access room. Its outside wall is the reachable 3x3 ranked gate.
      for (let x = shaftX - 2; x <= shaftX + 2; x++) {
        for (let y = surfaceFloorY; y <= surfaceFloorY + 4; y++) {
          for (let z = shaftZ - 2; z <= shaftZ + 2; z++) {
            const shell = x === shaftX - 2 || x === shaftX + 2 || y === surfaceFloorY || y === surfaceFloorY + 4 || z === shaftZ - 2 || z === shaftZ + 2;
            if (shell) setWall(x, y, z);
            else setC(x, y, z, B.AIR);
          }
        }
      }
      for (let y = surfaceFloorY; y <= surfaceFloorY + 3; y++) {
        setC(shaftX, y, shaftZ, B.ROPE_LADDER);
      }
      for (let x = shaftX - 1; x <= shaftX + 1; x++) {
        for (let y = surfaceFloorY + 1; y <= surfaceFloorY + 3; y++) setC(x, y, shaftZ + 2, rankInfo.door);
      }
      for (let z = shaftZ + 3; z <= shaftZ + 5; z++) {
        for (let x = shaftX - 1; x <= shaftX + 1; x++) {
          setC(x, surfaceFloorY, z, rankBrick);
          setC(x, surfaceFloorY + 1, z, B.AIR);
          setC(x, surfaceFloorY + 2, z, B.AIR);
          setC(x, surfaceFloorY + 3, z, B.AIR);
        }
      }
      setC(shaftX - 1, surfaceFloorY + 1, shaftZ - 1, B.TORCH);
      setC(shaftX + 1, first.y, shaftZ + 1, B.TORCH);
    }

    const ensureRankedStorage = (id, rich) => {
      if (!rooms.length) return false;
      for (const c of cells.values()) if (c.id === id) return true;
      const room = rooms[rooms.length - 1];
      const y = room.y;
      const candidates = [
        [room.x + 1, room.z + 1], [room.x + room.w - 2, room.z + room.l - 2],
        [room.x + 1, room.z + room.l - 2], [room.x + room.w - 2, room.z + 1],
        [room.x + 2, room.z + 1], [room.x + room.w - 3, room.z + room.l - 2],
        [room.x + 1, room.z + 2], [room.x + room.w - 2, room.z + room.l - 3],
      ];
      for (const [sx, sz] of candidates) {
        if (sx <= room.x || sx >= room.x + room.w - 1 || sz <= room.z || sz >= room.z + room.l - 1) continue;
        const key = this.pkey(sx, y, sz);
        const cur = cells.get(key);
        if (cur && cur.id !== B.AIR && cur.id !== B.TORCH) continue;
        setC(sx, y, sz, id);
        this.initChest(sx, y, sz, r, rich, 'dungeon:' + rankInfo.rank);
        return true;
      }
      return false;
    };
    ensureRankedStorage(rankCrate, true);
    ensureRankedStorage(rankChest, true);

    // Every dungeon guards its loot: the per-room spawner dice could leave a
    // small dungeon with ZERO spawners. Guarantee a rank-based minimum
    // (green 1, blue 2, gold 3, diamond 4). Deterministic — this is part of
    // the seeded dungeon build, so host/client/worker all regenerate it alike.
    if (!conqueredAlready && rooms.length) {
      const minSpawners = 1 + (rankInfo.mobBonus || 0);
      let placed = 0;
      for (const c of cells.values()) if (c.id === rankSpawner) placed++;
      for (let ri = 0; ri < rooms.length * 2 && placed < minSpawners; ri++) {
        const room = rooms[ri % rooms.length];
        // offset from the room center so the final room's core is never stomped;
        // second lap tries the opposite corner offset
        const off = ri < rooms.length ? 1 : -1;
        const sx2 = room.x + (room.w >> 1) + off, sz2 = room.z + (room.l >> 1) - off;
        if (sx2 <= room.x || sx2 >= room.x + room.w - 1 || sz2 <= room.z || sz2 >= room.z + room.l - 1) continue;
        const skey = this.pkey(sx2, room.y, sz2);
        const cur = cells.get(skey);
        if (cur && cur.id !== B.AIR) continue; // keep crates/chests/torches/core intact
        setC(sx2, room.y, sz2, rankSpawner);
        const state = this.createDungeonSpawnerState(rankInfo.rank, k, r); // always roll: stream determinism
        if (!this.spawners.has(skey)) this.spawners.set(skey, state);
        placed++;
      }
    }

    const byChunk = new Map();
    for (const c of cells.values()) {
      const ck = this.chunkKeyForBlock(c.x, c.z);
      if (!byChunk.has(ck)) byChunk.set(ck, []);
      byChunk.get(ck).push(c);
    }
    const dgKey = 'D' + k;
    if (!this.structSeen.has(dgKey)) {
      this.structSeen.add(dgKey);
      for (const s of spots) this.dungeonSpots.push(s);
    }
    const res = { byChunk, rooms, key: k, rank: rankInfo.rank, door: rankInfo.door, cellKeys: new Set(cells.keys()) };
    this.dungeonCache.set(k, res);
    return res;
  },

  dungeonCellKeyForPos(x, z) {
    return Math.floor(x / 96) + '|' + Math.floor(z / 96);
  },

  dungeonOwnsBlock(dungeon, x, y, z) {
    if (!dungeon || !dungeon.byChunk) return false;
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    const pk = this.pkey(bx, by, bz);
    if (dungeon.cellKeys && dungeon.cellKeys.has(pk)) return true;
    const bucket = dungeon.byChunk.get(this.chunkKeyForBlock(bx, bz));
    if (!bucket) return false;
    return bucket.some(c => c.x === bx && c.y === by && c.z === bz);
  },

  dungeonAtBlock(x, y, z) {
    const gx = Math.floor(Math.floor(x) / 96), gz = Math.floor(Math.floor(z) / 96);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const dg = this.dungeonFor(gx + dx, gz + dz);
        if (this.dungeonOwnsBlock(dg, x, y, z)) return dg;
      }
    }
    return null;
  },

  deactivatedDungeonBlockId(id, rank) {
    // each rank's active brick quiets into ITS OWN inactive brick
    if (typeof DUNGEON_BRICK_TO_INACTIVE !== 'undefined' && DUNGEON_BRICK_TO_INACTIVE[id] !== undefined) return DUNGEON_BRICK_TO_INACTIVE[id];
    if (id === B.DUNGEON_CORE || isDungeonDoor(id)) {
      return (typeof dungeonBrickInactiveForRank === 'function') ? dungeonBrickInactiveForRank(rank) : B.DUNGEON_BRICK_INACTIVE;
    }
    if (typeof isSpawnerBlock === 'function' && isSpawnerBlock(id)) return B.BROKEN_SPAWNER;
    if (id === B.SPAWNER) return B.BROKEN_SPAWNER;
    return id;
  },

  isProtectedDungeonBlock(x, y, z, id) {
    if (id === B.DUNGEON_CORE || (typeof isInactiveDungeonBrick === 'function' ? isInactiveDungeonBrick(id) : id === B.DUNGEON_BRICK_INACTIVE)) return false;
    const storage = typeof isStorageChestBlock === 'function' ? isStorageChestBlock(id) : (id === B.LOOT_CRATE || id === B.CHEST || id === B.JELLY_CHEST);
    const spawnerLike = typeof isSpawnerBlock === 'function' ? isSpawnerBlock(id) : id === B.SPAWNER;
    const protectedContent = storage || spawnerLike || id === B.BROKEN_SPAWNER || id === B.ROPE_LADDER || id === B.LORE || id === B.TORCH;
    const dg = this.dungeonAtBlock(x, y, z);
    if (dg) {
      if (this.dungeonConquered && this.dungeonConquered.has(dg.key)) return false;
      return isActiveDungeonBlock(id) || protectedContent;
    }
    return isActiveDungeonBlock(id);
  },

  deactivateDungeonAt(x, y, z) {
    const dg = this.dungeonAtBlock(x, y, z);
    const dkey = dg && dg.key ? dg.key : this.dungeonCellKeyForPos(x, z);
    if (!this.dungeonConquered) this.dungeonConquered = new Set();
    this.dungeonConquered.add(dkey);
    const touched = new Set();
    if (!dg || !dg.byChunk) return 0;
    for (const [ck, bucket] of dg.byChunk.entries()) {
      const ch = this.chunks.get(ck);
      if (!ch) continue;
      let changed = false;
      for (const cell of bucket) {
        if (cell.y < 0 || cell.y >= this.H) continue;
        const lx = this.localCoord(cell.x), lz = this.localCoord(cell.z);
        const idx = this.idx(lx, cell.y, lz);
        const oldId = ch.blocks[idx];
        const newId = this.deactivatedDungeonBlockId(oldId, dg.rank);
        if (newId === oldId) continue;
        ch.blocks[idx] = newId;
        const pk = this.pkey(cell.x, cell.y, cell.z);
        this.diffs.set(pk, newId);
        if (!this.diffIndex.has(ck)) this.diffIndex.set(ck, new Map());
        this.diffIndex.get(ck).set(pk, newId);
        if (oldId === B.DUNGEON_CORE) { this.lights.delete(pk); this.markLightBucketsDirty(); }
        if (oldId === B.SPAWNER) this.spawners.delete(pk);
        changed = true;
      }
      if (changed) {
        touched.add(ck);
        if (ch.hasMesh) this.dirty.add(ck);
        this.relightQueue.add(ck);
      }
    }
    if (touched.size && typeof UI !== 'undefined') UI.chat('Dungeon conquered. Its active blocks have gone quiet.', '#c77dff');
    // this mass flip writes raw chunk data (not setBlock), so it needs its own
    // replication: peers re-run the same deterministic flip on their side
    if (typeof Multiplayer !== 'undefined' && Multiplayer.onDungeonDeactivated && !Multiplayer.applyingRemote) {
      Multiplayer.onDungeonDeactivated(x, y, z);
    }
    return touched.size;
  },

  // ---------- streaming ----------
  neededChunks(px, pz) {
    if (!this.coordsPlayable(px, pz)) return { need: [], pcx: 0, pcz: 0 };
    const pcx = this.chunkCoord(px), pcz = this.chunkCoord(pz);
    const need = [];
    const R = this.R + 1;
    for (let dcx = -R; dcx <= R; dcx++) {
      for (let dcz = -R; dcz <= R; dcz++) {
        const ncx = pcx + dcx, ncz = pcz + dcz;
        if (!this.chunkPlayable(ncx, ncz)) continue;
        need.push({ cx: ncx, cz: ncz, dist: Math.max(Math.abs(dcx), Math.abs(dcz)) });
      }
    }
    need.sort((a, b) => a.dist - b.dist);
    return { need, pcx, pcz };
  },

  update(px, pz, budget, py) {
    budget = budget || 2;
    if (!this.coordsPlayable(px, pz)) return { genned: 0, meshed: 0, unsafe: true };
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
        if (this._genWorkers) {
          // async path: keep enough requests in flight that both workers stay
          // busy between frames; the frame budget goes to lighting/meshing
          if (this._genPending.size < 12) this._requestWorkerChunk(n.cx, n.cz);
          else break;
          continue;
        }
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
          } else if (ch.needsBorderLight) {
            // worker-lit chunk: exchange border light with neighbors now that
            // this chunk is actually about to be visible
            ch.needsBorderLight = false;
            this.borderPush(ch);
            this.borderPull(ch);
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
      for (const rc of group) { rc.light = null; rc.blockRGB = null; }
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
    const cx0 = this.chunkCoord(x);
    const cz0 = this.chunkCoord(z);
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
      const cx = this.chunkCoord(x), cz = this.chunkCoord(z);
      keys.add(this.key(cx, cz));
      const lx = this.localCoord(x), lz = this.localCoord(z);
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
    if (!need || !need.length) return { missing: 0, total: 1 };
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
      const visible = Math.abs((Number(sec.sy) || 0) - centerY) <= radius;
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
    for (const ch of this.chunks.values()) {
      if (!ch || !ch.hasMesh) continue;
      // Procedural border walls above the generated terrain are meshed only for
      // the currently visible vertical band.  When the player climbs/falls,
      // rebuild edge chunks lazily so the wall continues to the height limit.
      if (ch.worldBorderColumns && ch.worldBorderColumns.length) this.dirty.add(this.key(ch.cx, ch.cz));
      else this.applyChunkSectionVisibility(ch);
    }
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
    const X0 = ch.cx * 16, Z0 = ch.cz * 16;
    // Far-origin rendering fix:
    // Store each chunk section's vertex positions in small LOCAL coordinates and
    // place the mesh at the chunk/section origin.  The old mesh stored absolute
    // world coordinates directly in Float32 vertex attributes.  At x/z values in
    // the millions or billions, float precision is too coarse to preserve 1-block
    // and sub-block details, causing warped/stretched block faces even though
    // raycasts, outlines, mobs, drops, and vehicles still behaved correctly.
    const makeBufs = (oy) => {
      const makeBuf = () => ({ pos: [], uv: [], col: [], rep: [], idx: [], ox: X0, oy: oy || 0, oz: Z0 });
      return {
        solid: makeBuf(),
        cutout: makeBuf(),
        water: makeBuf(),
        lava: makeBuf(),
        photo: makeBuf(),
      };
    };
    const sectionH = this.CHUNK_H || 16;
    const baseSectionCount = Math.max(1, Math.ceil(H / sectionH));
    const sectionMap = new Map();
    const ensureSection = (sy) => {
      sy = Math.floor(+sy || 0);
      let sec = sectionMap.get(sy);
      if (!sec) {
        const y0 = sy * sectionH;
        sec = { sy, y0, y1: y0 + sectionH, bufs: makeBufs(y0) };
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
    const borderColumns = (ch.worldBorderColumns && ch.worldBorderColumns.length) ? ch.worldBorderColumns : [];
    if (borderColumns.length) {
      const centerY = Number.isFinite(this.visibleSectionY) ? this.visibleSectionY : 0;
      const radius = Math.max(0, this.VERTICAL_RENDER_RADIUS || 0);
      const topSy = Math.floor(this.worldBorderTopY() / sectionH);
      for (let sy = Math.max(0, centerY - radius); sy <= Math.min(topSy, centerY + radius); sy++) ensureSection(sy);
    }
    const bufsForY = (yy) => ensureSection(Math.floor(yy / sectionH)).bufs;
    let bufs = ensureSection(0).bufs;
    const chunkSigns = [];

    // fast block/light access: direct typed-array reads instead of 50k string-keyed
    // Map lookups per rebuild (this WAS the chunk-loading hitch)
    const nbW = this.chunks.get(this.key(ch.cx - 1, ch.cz));
    const nbE = this.chunks.get(this.key(ch.cx + 1, ch.cz));
    const nbN = this.chunks.get(this.key(ch.cx, ch.cz - 1));
    const nbS = this.chunks.get(this.key(ch.cx, ch.cz + 1));
    // NOTE: keep gb/gl allocation-free — they run ~60k times per rebuild.
    // (The old `resolve()` helper returned a fresh array per call.)
    const gb = (wx, y, wz) => {
      const border = this.borderBlockOverride(wx, y, wz);
      if (border) return border;
      if (y < 0) return B.AIR; // below the generated world is true void, not invisible bedrock
      const lx = wx - X0, lz = wz - Z0;
      let c = ch, ax = lx, az = lz;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15) {
        if (lx === -1) { c = nbW; ax = 15; }
        else if (lx === 16) { c = nbE; ax = 0; }
        else if (lz === -1) { c = nbN; az = 15; }
        else if (lz === 16) { c = nbS; az = 0; }
        else c = null;
        if (!c) return y < H ? B.STONE : B.AIR;
      }
      if (y < H) return c.blocks[(y << 8) + (az << 4) + ax];
      return this.extraBlock(c, wx, y, wz);
    };
    const gl = (wx, y, wz) => {
      if (y >= H) return 0xF0 | this.sparseBlockLightAt(wx, y, wz);
      if (y < 0) return 0;
      const lx = wx - X0, lz = wz - Z0;
      let c = ch, ax = lx, az = lz;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15) {
        if (lx === -1) { c = nbW; ax = 15; }
        else if (lx === 16) { c = nbE; ax = 0; }
        else if (lz === -1) { c = nbN; az = 15; }
        else if (lz === 16) { c = nbS; az = 0; }
        else c = null;
      }
      if (!c || !c.light) return 0xF0;
      return c.light[(y << 8) + (az << 4) + ax];
    };

    const glRGB = (wx, y, wz) => {
      if (y >= H) return this.sparseBlockLightRGBAt(wx, y, wz);
      if (y < 0) return 0;
      const lx = wx - X0, lz = wz - Z0;
      let c = ch, ax = lx, az = lz;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15) {
        if (lx === -1) { c = nbW; ax = 15; }
        else if (lx === 16) { c = nbE; ax = 0; }
        else if (lz === -1) { c = nbN; az = 15; }
        else if (lz === 16) { c = nbS; az = 0; }
        else c = null;
      }
      if (!c || !c.light) return 0;
      const i = (y << 8) + (az << 4) + ax;
      if (c.blockRGB) return c.blockRGB[i] || 0;
      const l = c.light[i] & 15;
      return l | (l << 4) | (l << 8);
    };

    const lightAt = (x, y, z) => [glRGB(x, y, z) / 4095, (gl(x, y, z) >> 4) / 15];

    const pushQuad = (b, verts, uvr, uvs, shade, lb, ls, repX) => {
      const base = b.pos.length / 3;
      const ox = Number.isFinite(b.ox) ? b.ox : 0;
      const oy = Number.isFinite(b.oy) ? b.oy : 0;
      const oz = Number.isFinite(b.oz) ? b.oz : 0;
      for (let i = 0; i < 4; i++) {
        b.pos.push(verts[i][0] - ox, verts[i][1] - oy, verts[i][2] - oz);
        if (repX) {
          // greedy-merged run: uv carries the tile ORIGIN, aRep carries repeat
          // coords; the solid material re-tiles with fract() in the fragment shader
          b.uv.push(uvr.u0, uvr.v0);
          b.rep.push(uvs[i][0] * repX, uvs[i][1]);
        } else {
          const u = uvr.u0 + (uvr.u1 - uvr.u0) * uvs[i][0];
          const v = uvr.v0 + (uvr.v1 - uvr.v0) * uvs[i][1];
          b.uv.push(u, v);
          b.rep.push(0, 0);
        }
        b.col.push(shade, lb, ls);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const rotUVQ = (n) => n === 0 ? UVQ : UVQ.map((_, i) => UVQ[(i + n) % 4]);

    // greedy meshing: pending row-merge runs for plain opaque cube faces.
    // The main voxel loop walks x innermost, so faces whose quads extend along
    // X (+y,-y,+z,-z) accumulate while id+light match; a gap (endWx !== wx),
    // any mismatch, or the end of the mesh flushes the run as ONE wide quad.
    const cubeRuns = [null, null, null, null, null, null];
    const flushCubeRun = (f) => {
      const r = cubeRuns[f];
      if (!r) return;
      cubeRuns[f] = null;
      const n = r.endWx - r.startWx;
      const face = this.FACES[f];
      const verts = face.c.map(cn => [r.startWx + cn[0] * n, r.y + cn[1], r.wz + cn[2]]);
      pushQuad(r.target, verts, r.uvr, UVQ, face.shade, r.lb, r.ls, n > 1 ? n : 0);
    };

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
    // Pure function of block id, but it runs for EVERY voxel in the main mesh
    // loop and again per neighbor in the 3x3x3 coplanar sweeps — memoize it
    // once per page load (the id -> glass-family classification never changes).
    const glassJoinMemo = this._glassJoinMemo || (this._glassJoinMemo = {});
    const isJoinedGlassBlock = (bid) => {
      const m = glassJoinMemo[bid];
      if (m !== undefined) return m;
      let v = false;
      if (bid === B.GLASS || bid === B.GLASS_SLAB_B || bid === B.GLASS_SLAB_T || isGlassDSlab(bid) || isGlassVSlab(bid) || glassSlabComboParts(bid)) v = true;
      else { const si = stairInfo(bid); v = !!(si && si.mat === 'glass'); }
      return (glassJoinMemo[bid] = v);
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
    // id -> 0: never renders boxes, 1: full unit cube, 2: partial shape.
    // Memoized per page load; runs 27x per visible leaf/glass face otherwise.
    const boxClassMemo = this._boxClassMemo || (this._boxClassMemo = {});
    const boxClassOf = (bid) => {
      const m = boxClassMemo[bid];
      if (m !== undefined) return m;
      const bd = Reg[bid];
      let v;
      if (!bd || !bd.block || bid === B.AIR || isFluid(bid)) v = 0;
      else switch (bd.shape) {
        case 'cube': case 'mega': case 'dslab': v = 1; break;
        default: v = (bd.shape ? 2 : (bd.solid ? 1 : 0));
      }
      return (boxClassMemo[bid] = v);
    };
    const hasCoplanarNonJoinedNeighbor = (bo, f, selfWx, selfY, selfWz, selfId) => {
      const fr = faceRect(bo, f);
      const fd = this.FACES[f].d;
      for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        const bx = selfWx + ox, by = selfY + oy, bz = selfWz + oz;
        const bid = (ox === 0 && oy === 0 && oz === 0) ? selfId : gb(bx, by, bz);
        if (bid === B.AIR || isFluid(bid) || isJoinedGlassBlock(bid)) continue;
        const cls = boxClassOf(bid);
        if (cls === 0) continue;
        if (cls === 1) {
          // A full unit cube's faces sit on cell boundaries, so it can only
          // area-overlap this face plane as the direct face neighbor (diagonal
          // full cubes merely edge-touch). Skip the box math for the common case.
          if (ox === fd[0] && oy === fd[1] && oz === fd[2]) {
            const plane = f === 0 ? bo[3] : f === 1 ? bo[0] : f === 2 ? bo[4] : f === 3 ? bo[1] : f === 4 ? bo[5] : bo[2];
            const bnd = f === 0 ? selfWx + 1 : f === 1 ? selfWx : f === 2 ? selfY + 1 : f === 3 ? selfY : f === 4 ? selfWz + 1 : selfWz;
            if (Math.abs(plane - bnd) < GLASS_EPS) return true;
          }
          continue;
        }
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

          if (def && def.waterlogged) this.meshFluid(bufs.water, pushQuad, wx, y, wz, B.WATER, false, lightAt, gb);
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
              crossQuads(bufs.cutout, wx, y, wz, Atlas.texName(id, 'side'),
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
          const mergeable = this.greedyMesh !== false && !def.cutout; // greedy row-merge is for plain opaque cubes only
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
            if (!visible) { if (mergeable && f >= 2) flushCubeRun(f); continue; }
            const [lb, ls] = lightAt(nx, ny, nz);
            if (mergeable && f >= 2) {
              // greedy meshing: faces whose quads extend along X (+y,-y,+z,-z)
              // merge into one wide quad while id + light stay identical
              const r = cubeRuns[f];
              if (r && r.endWx === wx && r.y === y && r.wz === wz && r.id === id && r.lb === lb && r.ls === ls && r.target === bufs.solid) {
                r.endWx = wx + 1;
                continue;
              }
              flushCubeRun(f);
              cubeRuns[f] = { id, startWx: wx, endWx: wx + 1, lb, ls, y, wz, target: bufs.solid, uvr: Atlas.uv(Atlas.texName(id, f === 2 ? 'top' : f === 3 ? 'bottom' : 'side')) };
              continue;
            }
            const texName = Atlas.texName(id, f === 2 ? 'top' : f === 3 ? 'bottom' : 'side');
            const uvr = Atlas.uv(texName);
            let verts = face.c.map(cn => [wx + cn[0], y + cn[1], wz + cn[2]]);
            if (def.cutout && def.shape === 'cube') {
              const bo = [wx, y, wz, wx + 1, y + 1, wz + 1];
              // Preserve the whole leaf/cutout texture, but separate it from any
              // adjacent partial/non-glass coplanar face so it does not shimmer.
              if (hasCoplanarNonJoinedNeighbor(bo, f, wx, y, wz, id)) verts = insetFaceVerts(verts, f);
            }
            pushQuad(target, verts, uvr, UVQ, face.shade, lb, ls);
          }
        }
      }
    }
    for (let f = 2; f < 6; f++) flushCubeRun(f); // tail runs from the last row

    const emitSparseCell = (wx, y, wz, id) => {
      if (id === B.AIR) return;
      const def = Reg[id];
      if (!def || !def.block) return;
      bufs = bufsForY(y);

      if (def && def.waterlogged) this.meshFluid(bufs.water, pushQuad, wx, y, wz, B.WATER, false, lightAt, gb);
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
          crossQuads(bufs.cutout, wx, y, wz, Atlas.texName(id, 'side'),
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
      for (const [pk, id] of [...ch.extraBlocks]) {
        const [wx, y, wz] = pk.split(',').map(Number);
        if (!Number.isFinite(wx + y + wz) || y < H) continue;
        emitSparseCell(wx, y, wz, id);
      }
    }

    if (borderColumns.length) {
      const wallId = B.WORLD_BORDER || B.GLASS;
      const topY = this.worldBorderTopY();
      for (const sec of sectionMap.values()) {
        const y0 = Math.max(H, sec.y0, 0);
        const y1 = Math.min(sec.y1, topY + 1);
        if (y0 >= y1) continue;
        for (const c of borderColumns) {
          const wx = c.wx, wz = c.wz;
          for (let yy = y0; yy < y1; yy++) {
            emitSparseCell(wx, yy, wz, wallId);
          }
        }
      }
    }

    const sectionBufs = [...sectionMap.values()].sort((a, b) => a.sy - b.sy);

    const mk = (b, mat, sy) => {
      if (!b.idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setAttribute('aRep', new THREE.Float32BufferAttribute(b.rep, 2));
      g.setIndex(b.idx);
      const mesh = new THREE.Mesh(g, mat);
      const ox = Number.isFinite(b.ox) ? b.ox : 0;
      const oy = Number.isFinite(b.oy) ? b.oy : 0;
      const oz = Number.isFinite(b.oz) ? b.oz : 0;
      mesh.position.set(ox, oy, oz);
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      mesh.userData.chunkSectionY = sy;
      mesh.userData.renderOrigin = { x: ox, y: oy, z: oz };
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
    const same = lava ? isLava : isWaterCell;
    const levelOf = lava ? lavaLevel : waterCellLevel;
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
    // Generic far-coordinate ray pass for all sources: player, mobs, vehicles,
    // rockets, and command tools.  Do the DDA near zero, while each block lookup
    // is translated back to absolute X/Y/Z.  This avoids precision loss on every
    // axis, including very high Y builds and negative world-border edges.
    if (!opts._farLocal && typeof Physics !== 'undefined' && Physics._originFor) {
      const th = Physics.FAR_COORD_THRESHOLD || 1000000000;
      if (Math.abs(ox) >= th || Math.abs(oy) >= th || Math.abs(oz) >= th) {
        const rox = Physics._originFor(ox), roy = Physics._originFor(oy), roz = Physics._originFor(oz);
        return this.raycast(ox - rox, oy - roy, oz - roz, dx, dy, dz, maxDist,
          Object.assign({}, opts, { _farLocal: true, _farOriginX: rox, _farOriginY: roy, _farOriginZ: roz }));
      }
    }
    if (!opts._farLocal && typeof Physics !== 'undefined' && Physics.farState &&
        typeof Player !== 'undefined' && Player && Player.body) {
      const st = Physics.farState(Player.body);
      if (st) {
        const ax = st.ox + st.x, ay = st.oy + st.y, az = st.oz + st.z;
        if (Math.abs(ox - ax) < 4 && Math.abs(oy - ay) < 8 && Math.abs(oz - az) < 4) {
          return this.raycast(st.x + (ox - ax), st.y + (oy - ay), st.z + (oz - az), dx, dy, dz, maxDist,
            Object.assign({}, opts, { _farLocal: true, _farOriginX: st.ox, _farOriginY: st.oy, _farOriginZ: st.oz }));
        }
      }
    }
    const farLocal = !!opts._farLocal;
    const farOX = farLocal ? (+opts._farOriginX || 0) : 0;
    const farOY = farLocal ? (+opts._farOriginY || 0) : 0;
    const farOZ = farLocal ? (+opts._farOriginZ || 0) : 0;
    const absX = (lx) => farLocal ? farOX + lx : lx;
    const absY = (ly) => farLocal ? farOY + ly : ly;
    const absZ = (lz) => farLocal ? farOZ + lz : lz;
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
      const wx = absX(x), wy = absY(y), wz = absZ(z);
      const id = this.getBlock(wx, wy, wz);
      if (opts.fluids && (id === B.WATER || id === B.LAVA)) {
        return { bx: wx, by: wy, bz: wz, nx, ny, nz, dist: t, id, px: absX(ox + dx * t), py: absY(oy + dy * t), pz: absZ(oz + dz * t) };
      }
      if (id !== B.AIR && !isFluid(id)) {
        const def = Reg[id];
        if (def.shape === 'cube' || def.shape === 'dslab' || def.shape === 'mega') {
          return { bx: wx, by: wy, bz: wz, nx, ny, nz, dist: t, id, px: absX(ox + dx * t), py: absY(oy + dy * t), pz: absZ(oz + dz * t) };
        }

        const tNext = Math.min(tMX, tMY, tMZ, maxDist + 0.5);
        const tMin = Math.max(0, t - 0.001);

        // Crops and their 3x3 pot cells share one block cell, but they are two
        // different targets. Hit the crop only when the ray touches the plant
        // mesh; hit the pot only when the ray touches the tray/rim mesh. If the
        // ray passes through empty air inside the cell, keep raycasting forward.
        if (def.shape === 'crop') {
          const underSlab = (this.plantationUnderSlabs && this.pkey) ? this.plantationUnderSlabs.get(this.pkey(wx, wy, wz)) : 0;
          const underHit = underSlab ? Physics.rayVsBoxes(Physics.rayBoxes(underSlab, wx, wy, wz) || [[0, 0, 0, 1, 0.5, 1]], x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001) : null;
          const cropHit = Physics.rayVsBoxes(Physics.cropRayBoxes(id, wx, wy, wz), x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001);
          const potHit = Physics.rayVsBoxes(Physics.planterRayBoxes(id, wx, wy, wz), x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001);
          let hit = null, hitId = id, targetPart = 'crop';
          if (underHit && underHit.t <= maxDist) { hit = underHit; hitId = underSlab; targetPart = 'underSlab'; }
          if (cropHit && cropHit.t <= maxDist && (!hit || cropHit.t < hit.t - 0.0005)) { hit = cropHit; hitId = id; targetPart = 'crop'; }
          if (potHit && potHit.t <= maxDist && (!hit || potHit.t < hit.t - 0.0005)) {
            hit = potHit; hitId = B.PLANTATION_POT; targetPart = 'pot';
          }
          if (hit) {
            return {
              bx: wx, by: wy, bz: wz, nx: hit.nx, ny: hit.ny, nz: hit.nz, dist: hit.t, id: hitId, actualId: id, targetPart,
              px: absX(ox + dx * hit.t), py: absY(oy + dy * hit.t), pz: absZ(oz + dz * hit.t),
            };
          }
        } else if (def.shape === 'planter') {
          const underSlab = (this.plantationUnderSlabs && this.pkey) ? this.plantationUnderSlabs.get(this.pkey(wx, wy, wz)) : 0;
          const underHit = underSlab ? Physics.rayVsBoxes(Physics.rayBoxes(underSlab, wx, wy, wz) || [[0, 0, 0, 1, 0.5, 1]], x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001) : null;
          const potHit = Physics.rayVsBoxes(Physics.planterRayBoxes(id, wx, wy, wz), x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001);
          let hit = null, hitId = id, targetPart = 'pot';
          if (underHit && underHit.t <= maxDist) { hit = underHit; hitId = underSlab; targetPart = 'underSlab'; }
          if (potHit && potHit.t <= maxDist && (!hit || potHit.t < hit.t - 0.0005)) { hit = potHit; hitId = id; targetPart = 'pot'; }
          if (hit) {
            return {
              bx: wx, by: wy, bz: wz, nx: hit.nx, ny: hit.ny, nz: hit.nz, dist: hit.t, id: hitId, actualId: id, targetPart,
              px: absX(ox + dx * hit.t), py: absY(oy + dy * hit.t), pz: absZ(oz + dz * hit.t),
            };
          }
        } else {
          // partial block: intersect against its actual boxes
          const boxes = Physics.rayBoxes(id, wx, wy, wz);
          if (boxes) {
            const hit = Physics.rayVsBoxes(boxes, x, y, z, ox, oy, oz, dx, dy, dz, tMin, tNext + 0.001);
            if (hit && hit.t <= maxDist) {
              return {
                bx: wx, by: wy, bz: wz, nx: hit.nx, ny: hit.ny, nz: hit.nz, dist: hit.t, id,
                px: absX(ox + dx * hit.t), py: absY(oy + dy * hit.t), pz: absZ(oz + dz * hit.t),
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
    let ox = 0, oy = 0, oz = 0;
    const th = (typeof Physics !== 'undefined' && Physics.FAR_COORD_THRESHOLD) ? Physics.FAR_COORD_THRESHOLD : 1000000000;
    if (typeof Physics !== 'undefined' && Physics._originFor &&
        (Math.abs(x0) >= th || Math.abs(y0) >= th || Math.abs(z0) >= th || Math.abs(x1) >= th || Math.abs(y1) >= th || Math.abs(z1) >= th)) {
      ox = Physics._originFor(x0);
      oy = Physics._originFor(y0);
      oz = Physics._originFor(z0);
    }
    const lx0 = x0 - ox, ly0 = y0 - oy, lz0 = z0 - oz;
    const lx1 = x1 - ox, ly1 = y1 - oy, lz1 = z1 - oz;
    const dx = lx1 - lx0, dy = ly1 - ly0, dz = lz1 - lz0;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.001) return true;
    const hit = (ox || oy || oz)
      ? this.raycast(lx0, ly0, lz0, dx / dist, dy / dist, dz / dist, dist, { _farLocal: true, _farOriginX: ox, _farOriginY: oy, _farOriginZ: oz })
      : this.raycast(x0, y0, z0, dx / dist, dy / dist, dz / dist, dist);
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
      if (ground !== B.GRASS) return false;
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

    const processCell = (wx, y, wz, id) => {
      if (id === B.GRASS || id === B.SNOWY_GRASS) {
        const above = this.getBlock(wx, y + 1, wz);
        if (!this.grassCanStayCovered(above)) {
          toDirt.push([wx, y, wz]);
          return;
        }
        // Wild grass regrowth is still intentionally rare, but every exposed
        // grass block now gets checked when its chunk is swept.
        if (this.tryGrowWildGrassFromGrass(wx, y, wz, weatherMult)) changed = true;
        return;
      }

      if (id === B.DIRT) {
        const grassId = this.grassSourceForDirt(wx, y, wz);
        // Dirt spread used to be instant whenever a swept dirt block found
        // nearby grass. Keep deterministic checks, but add a Minecraft-like
        // random-tick chance so it happens around 10-15x slower.
        const spreadChance = Math.min(0.16, 0.07 * (weatherMult || 1));
        if (grassId && Math.random() < spreadChance) toGrass.push([wx, y, wz, grassId]);
      }
    };

    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const wx = ch.cx * 16 + lx;
        const wz = ch.cz * 16 + lz;
        for (let y = 1; y < this.H - 1; y++) {
          processCell(wx, y, wz, ch.blocks[this.idx(lx, y, lz)]);
        }
      }
    }

    // Player-placed blocks above the generated H=80 terrain live in ch.extraBlocks.
    // They need the same grass/dirt random update rules as base terrain chunks.
    if (ch.extraBlocks) {
      for (const [pk, id] of [...ch.extraBlocks]) {
        const [wx, y, wz] = String(pk).split(',').map(Number);
        if (!Number.isFinite(wx + y + wz) || y < this.H) continue;
        processCell(wx, y, wz, id);
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
    const pcx = this.chunkCoord(px);
    const pcz = this.chunkCoord(pz);
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
    const tr = this.chunkRand(this.chunkCoord(x * 341 + y), this.chunkCoord(z * 887 - y), 707);
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
          const boomOpts = id === B.JELLY_HOUSE ? { jellyHouseBreakHandled: true, noUpdate: true, skipLight: true } : { noUpdate: true, skipLight: true };
          this.setBlock(bx, by, bz, B.AIR, boomOpts);
        }
      }
    }
    {
      const ccx = this.chunkCoord(Math.floor(ex)), ccz = this.chunkCoord(Math.floor(ez));
      const cr = Math.ceil((r + 2) / 16) + 1;
      for (let dcx = -cr; dcx <= cr; dcx++) for (let dcz = -cr; dcz <= cr; dcz++) this.relightQueue.add(this.key(ccx + dcx, ccz + dcz));
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
    const boomBody = { x: ex, y: ey, z: ez };
    const pdv = (typeof Physics !== 'undefined' && Physics.deltaBodies) ? Physics.deltaBodies(boomBody, Player.body) : { x: Player.body.x - ex, y: Player.body.y - ey, z: Player.body.z - ez };
    const pyHit = pdv.y + 0.9;
    const pd = Math.sqrt(pdv.x * pdv.x + pyHit * pyHit + pdv.z * pdv.z);
    if (pd < hurtRange) {
      const pp = (typeof Physics !== 'undefined' && Physics.bodyWorldX) ? { x: Physics.bodyWorldX(Player.body), y: Physics.bodyWorldY(Player.body), z: Physics.bodyWorldZ(Player.body) } : Player.body;
      const dmg = Math.round(maxDmg * (1 - pd / hurtRange) * cover(pp.x, pp.y + 0.9, pp.z));
      if (dmg > 0) Player.hurt(dmg, pdv.x / (pd + 0.01) * 9, pdv.z / (pd + 0.01) * 9);
    }
    Mobs.applyExplosion(ex, ey, ez, hurtRange, maxDmg, cover, src || null);
    Vehicles.applyExplosion(ex, ey, ez, hurtRange, maxDmg);
    // remote players caught in the blast (host is authoritative for explosions)
    if (typeof Multiplayer !== 'undefined' && Multiplayer.applyExplosionToPeers) {
      Multiplayer.applyExplosionToPeers(ex, ey, ez, hurtRange, maxDmg, cover);
    }
  },
};


// ============================================================
// Worldgen worker source. Serialized at LOAD TIME — before any multiplayer
// patch wraps World methods with closures that Function.toString cannot
// carry across threads. Object-literal methods serialize cleanly: they only
// use `this.*` and the globals the Blob worker defines first (NoiseGen +
// the blocks.js BLOCKS_WORLDGEN_SRC bundle + LORE below).
// ============================================================
const WORLD_SRC = (() => {
  // live browser objects (scene/materials/workers/typed caches) never cross;
  // the worker rebuilds what it needs lazily
  const skip = new Set(['scene', 'matSolid', 'matCutout', 'matWater', 'matLava', 'matPhoto',
    '_genWorkers', '_genWorkersSaved', '_opaqueLUT', 'dayFUniform']);
  const parts = [];
  for (const k of Object.keys(World)) {
    const v = World[k];
    if (typeof v === 'function') { parts.push(v.toString()); continue; }
    let s;
    if (skip.has(k) || v === null || v === undefined) s = 'null';
    else if (v instanceof Map) s = 'new Map()';
    else if (v instanceof Set) s = 'new Set()';
    else if (ArrayBuffer.isView(v)) s = 'null';
    else { try { s = JSON.stringify(v); } catch (e) { s = 'null'; } }
    parts.push(k + ': ' + s);
  }
  // dayFUniform is skipped above (may become a live THREE uniform); the worker
  // only ever reads .value
  parts.push('dayFUniform: { value: 1 }');
  return '{\n' + parts.join(',\n') + '\n}';
})();
const WORLD_LORE_SRC = 'const LORE = ' + JSON.stringify(LORE) + ';';
