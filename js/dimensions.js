// ============================================================
// F_Floop Craft - retired dimension compatibility layer
// The game now runs as one overworld; this migrates old saves and packets.
// ============================================================
const Dimensions = {
  current: 'overworld',
  data: {},
  returnPortal: null,
  travelCooldown: 0,
  portalScanT: 0,
  portalFxT: 0,
  retiredNoticeT: 0,

  canonicalDim(dim) {
    return 'overworld';
  },

  emptyState(dim) {
    return {
      dim,
      diffs: [], signs: [], signDirs: [], lore: [], chests: [], spawners: [], jellyHouses: [], dungeonConquered: [], bedDirs: [], photoDirs: [], stairSideways: [], crops: [],
      plantationOrigins: [], plantationUnderSlabs: [], furnaces: [], mobs: [], cars: [], boards: [], boats: [],
      dynamics: null, player: null,
    };
  },

  // Multiplayer: old clients may still send dimension-tagged block packets. Retired
  // non-overworld packets are acknowledged and ignored so they cannot touch this world.
  stashRemoteBlock(dim, x, y, z, id) {
    if (dim && dim !== 'overworld') return true;
    if (!dim || dim === this.current) return false;
    if (!this.data) this.data = {};
    if (!this.data.overworld) this.data.overworld = this.emptyState('overworld');
    const st = this.data.overworld;
    if (!Array.isArray(st.diffs)) st.diffs = [];
    const key = World.pkey(x, y, z);
    for (const e of st.diffs) { if (e[0] === key) { e[1] = id; return true; } }
    st.diffs.push([key, id]);
    return true;
  },

  legacyState(data) {
    return {
      dim: 'overworld',
      diffs: data.diffs || [],
      signs: data.signs || [],
      signDirs: data.signDirs || [],
      lore: data.lore || [],
      chests: data.chests || [],
      spawners: data.spawners || [],
      jellyHouses: data.jellyHouses || [],
      dungeonConquered: data.dungeonConquered || data.dungeonsConquered || [],
      bedDirs: data.bedDirs || [],
      photoDirs: data.photoDirs || [],
      stairSideways: data.stairSideways || data.stairCorners || [],
      crops: data.crops || [],
      plantationOrigins: data.plantationOrigins || [],
      plantationUnderSlabs: data.plantationUnderSlabs || [],
      furnaces: data.furnaces || [],
      mobs: data.mobs || [],
      cars: data.cars || [],
      boards: data.boards || [],
      boats: data.boats || [],
      dynamics: data.dynamics || null,
      player: data.player ? { x: data.player.x, y: data.player.y, z: data.player.z, yaw: data.player.yaw || 0, pitch: data.player.pitch || 0 } : null,
    };
  },

  loadAll(data) {
    data = data || {};
    const dims = data.dimensions;
    const dimData = (dims && dims.data) ? dims.data : null;
    const overworld = (dimData && dimData.overworld) ? dimData.overworld : this.legacyState(data);
    overworld.dim = 'overworld';
    this.current = 'overworld';
    this.data = { overworld };
    this.returnPortal = null;
    World.dimensionId = 'overworld';
    this.applyWorldState(overworld);
  },

  packWorldState() {
    const pack = Save.packStack.bind(Save);
    const p = (typeof Player !== 'undefined' && Player.body) ? Player : null;
    return {
      dim: this.current,
      diffs: [...World.diffs.entries()],
      signs: [...World.signs.entries()],
      signDirs: [...World.signDirs.entries()],
      lore: [...World.loreMap.entries()],
      chests: [...World.chests.entries()].map(([k, slots]) => [k, slots.map(s => pack(s))]),
      spawners: [...World.spawners.entries()].filter(([k, sp]) => !sp || sp.type !== 'jelly_house').map(([k, sp]) => [k, {
        type: sp.type, roster: sp.roster || null, rank: sp.rank || '', remaining: sp.remaining,
        max: sp.max, spawned: sp.spawned, dungeonKey: sp.dungeonKey || '', liveCap: sp.liveCap,
        pool: Array.isArray(sp.pool) ? sp.pool.slice(0, 12) : undefined,
      }]),
      jellyHouses: (typeof Jelly !== 'undefined' ? Jelly.saveHouseEntries() : []),
      dungeonConquered: [...(World.dungeonConquered || new Set()).values()],
      bedDirs: [...World.bedDirs.entries()],
      photoDirs: [...World.photoDirs.entries()],
      stairSideways: [...World.stairSideways.entries()],
      crops: [...World.crops.entries()],
      plantationOrigins: [...World.plantationOrigins.entries()],
      plantationUnderSlabs: [...World.plantationUnderSlabs.entries()],
      furnaces: [...World.furnaces.entries()].map(([k, f]) => [k, {
        i: pack(f.in), f: pack(f.fuel), o: pack(f.out),
        burn: +((f.burn || 0).toFixed ? f.burn.toFixed(2) : (f.burn || 0)), burnMax: f.burnMax || 0, cook: +((f.cook || 0).toFixed ? f.cook.toFixed(2) : (f.cook || 0)),
      }]),
      mobs: Mobs.serialize(),
      cars: Vehicles.serialize(),
      boards: Vehicles.serializeBoards(),
      boats: Vehicles.serializeBoats(),
      dynamics: Dynamics.serialize(),
      player: p ? { x: +p.body.x.toFixed(2), y: +p.body.y.toFixed(2), z: +p.body.z.toFixed(2), yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3) } : null,
    };
  },

  storeCurrent() {
    this.current = 'overworld';
    if (World) World.dimensionId = 'overworld';
    if (!this.data) this.data = {};
    this.data.overworld = this.packWorldState();
  },

  serializeAll() {
    if (World && World.ready) this.storeCurrent();
    if (!this.data.overworld) this.data.overworld = this.emptyState('overworld');
    this.data.overworld.dim = 'overworld';
    this.current = 'overworld';
    this.returnPortal = null;
    return { current: 'overworld', data: { overworld: this.data.overworld }, returnPortal: null };
  },

  rebuildDiffIndex() {
    World.diffIndex.clear();
    for (const [k, id] of World.diffs) {
      const parts = k.split(',');
      const ck = World.key((+parts[0]) >> 4, (+parts[2]) >> 4);
      if (!World.diffIndex.has(ck)) World.diffIndex.set(ck, new Map());
      World.diffIndex.get(ck).set(k, id);
    }
  },

  applyWorldState(st) {
    const unpack = Save.unpackStack.bind(Save);
    World.diffs.clear(); World.diffIndex.clear(); World.signs.clear(); World.signDirs.clear(); World.loreMap.clear();
    World.chests.clear(); World.spawners.clear(); if (World.jellyHouses) World.jellyHouses.clear(); if (World.jellyHouseIds) World.jellyHouseIds.clear(); World.bedDirs.clear(); World.photoDirs.clear(); World.stairSideways.clear(); World.crops.clear();
    World.plantationOrigins.clear(); World.plantationUnderSlabs.clear(); World.furnaces.clear();
    World.megaTorches.clear(); World.fires.clear(); World.saplings.clear(); World.lights.clear();
    if (World.dungeonConquered) {
      World.dungeonConquered.clear();
      for (const dk of st.dungeonConquered || st.dungeonsConquered || []) World.dungeonConquered.add(String(dk));
    }
    for (const [k, id] of st.diffs || []) {
      if (typeof B !== 'undefined' && id === B.MERRY_PORTAL) World.diffs.set(k, B.AIR);
      else World.diffs.set(k, id);
    }
    this.rebuildDiffIndex();
    for (const [k, t] of st.signs || []) World.signs.set(k, t);
    for (const [k, d] of st.signDirs || []) World.signDirs.set(k, d);
    for (const [k, i] of st.lore || []) World.loreMap.set(k, i);
    for (const [k, slots] of st.chests || []) World.chests.set(k, slots.map(v => unpack(v)));
    if (typeof Jelly !== 'undefined') Jelly.loadHouseEntries(st.jellyHouses || []);
    for (const [k, raw, legacyRoster] of st.spawners || []) {
      const obj = raw && typeof raw === 'object' ? raw : { type: raw, roster: legacyRoster };
      if (obj.type === 'jelly_house' && typeof Jelly !== 'undefined') { Jelly.migrateLegacySaveSpawners([[k, obj.type, obj.roster]]); continue; }
      World.spawners.set(k, {
        type: obj.type, cd: Number.isFinite(+obj.cd) ? +obj.cd : 3,
        roster: Array.isArray(obj.roster) ? obj.roster.slice() : undefined,
        rank: obj.rank || '', remaining: Number.isFinite(+obj.remaining) ? +obj.remaining : undefined,
        max: Number.isFinite(+obj.max) ? +obj.max : undefined, spawned: Number.isFinite(+obj.spawned) ? +obj.spawned : undefined,
        dungeonKey: obj.dungeonKey || '', liveCap: Number.isFinite(+obj.liveCap) ? +obj.liveCap : undefined,
        pool: Array.isArray(obj.pool) ? obj.pool.slice(0, 12) : undefined,
      });
    }
    for (const [k, d] of st.bedDirs || []) World.bedDirs.set(k, d);
    for (const [k, d] of st.photoDirs || []) World.photoDirs.set(k, d);
    for (const [k, d] of st.stairSideways || st.stairCorners || []) World.stairSideways.set(k, d);
    for (const [k, c] of st.crops || []) World.crops.set(k, c);
    for (const [k, o] of st.plantationOrigins || []) World.plantationOrigins.set(k, o);
    for (const [k, id] of st.plantationUnderSlabs || []) World.plantationUnderSlabs.set(k, id);
    for (const [k, f] of st.furnaces || []) World.furnaces.set(k, {
      in: unpack(f.i), fuel: unpack(f.f), out: unpack(f.o), burn: f.burn || 0, burnMax: f.burnMax || 0, cook: f.cook || 0,
    });
  },

  clearLiveEntities() {
    if (Mobs) {
      for (const m of Mobs.list || []) { if (m.bubble) Mobs.scene.remove(m.bubble); if (m.group) Mobs.scene.remove(m.group); }
      for (const a of Mobs.arrows || []) { if (a.mesh) Mobs.scene.remove(a.mesh); }
      Mobs.list = []; Mobs.arrows = [];
    }
    if (Vehicles) {
      for (const c of Vehicles.cars || []) if (c.group) Vehicles.scene.remove(c.group);
      for (const b of Vehicles.boats || []) if (b.group) Vehicles.scene.remove(b.group);
      for (const b of Vehicles.boards || []) if (b.mesh) Vehicles.scene.remove(b.mesh);
      if (Vehicles.boardMesh) { Vehicles.scene.remove(Vehicles.boardMesh); Vehicles.boardMesh = null; }
      Vehicles.cars = []; Vehicles.boats = []; Vehicles.boards = []; Vehicles.driving = null; Vehicles.boating = null;
    }
    if (Drops) while (Drops.list.length) Drops.remove(0);
  },

  disposeWorldMeshes() {
    for (const ch of World.chunks.values()) World.disposeMesh(ch);
    for (const s of World.signSprites.values()) World.scene.remove(s);
    World.signSprites.clear();
  },

  applyCurrentEntities() {
    this.current = 'overworld';
    const st = this.data.overworld || this.emptyState('overworld');
    Dynamics.deserialize(st.dynamics);
    Mobs.deserialize(st.mobs);
    Vehicles.deserialize(st.cars, st.boards, st.boats);
  },

  resetWorldForDimension(dim) {
    dim = 'overworld';
    this.disposeWorldMeshes();
    World.init(Game.scene, World.seed);
    World.dimensionId = dim;
    this.current = 'overworld';
    this.applyWorldState(this.data.overworld || this.emptyState('overworld'));
    Mobs.init(Game.scene); Vehicles.init(Game.scene); Dynamics.init(Game.scene);
    const st = this.data.overworld || this.emptyState('overworld');
    Dynamics.deserialize(st.dynamics);
    Mobs.deserialize(st.mobs);
    Vehicles.deserialize(st.cars, st.boards, st.boats);
    World.ready = false;
    Game.loading = true;
    Game.suppressPauseAfterLoad = true; // dimension travel should not show the click-to-play pause screen
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loadMsg').textContent = 'Loading the Overworld...';
  },

  switchTo(dim, pos) {
    this.current = 'overworld';
    if (World) World.dimensionId = 'overworld';
    if (dim && dim !== 'overworld') {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (!this.retiredNoticeT || now - this.retiredNoticeT > 2500) {
        this.retiredNoticeT = now;
        if (typeof UI !== 'undefined') UI.chat('That dimension has been retired. This save now runs as one overworld.', '#ffb347');
      }
      return;
    }
    if (pos && Player && Player.body) {
      Player.body.x = pos.x; Player.body.y = pos.y; Player.body.z = pos.z;
      Player.body.vx = Player.body.vy = Player.body.vz = 0;
      if (pos.yaw !== undefined) Player.yaw = pos.yaw;
      if (pos.pitch !== undefined) Player.pitch = pos.pitch;
    }
  },

  isPortalBlockAt(x, y, z) { return false; },
  isValidPortalFrameAt(bx, y, bz) { return false; },
  frameHasLitPortalAt(bx, y, bz) { return false; },
  clearPortalAtFrame(bx, y, bz) { return false; },
  checkPortalFramesNearBlock(x, y, z) { return false; },
  findFrameForDrop(d) { return null; },
  igniteFrame(fr) {},
  scanDroppedGems() {},
  portalClusterCenter(x, y, z) { return { x: x + 0.5, y: y + 1.05, z: z + 0.5 }; },
  checkPlayerPortal() {},
  portalParticles() {},

  update(dt) {
    this.current = 'overworld';
    if (World) World.dimensionId = 'overworld';
    if (this.travelCooldown > 0) this.travelCooldown -= dt;
    // Player void death is handled globally in player.js so it also works in the overworld.
  },
};
