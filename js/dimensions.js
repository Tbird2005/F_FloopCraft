// ============================================================
// F_Floop Craft — real dimension manager
// Separate world state buckets, separate generation mode, portal travel.
// ============================================================
const Dimensions = {
  current: 'overworld',
  data: {},
  returnPortal: null,
  travelCooldown: 0,
  portalScanT: 0,
  portalFxT: 0,

  emptyState(dim) {
    return {
      dim,
      diffs: [], signs: [], signDirs: [], lore: [], chests: [], spawners: [], bedDirs: [], photoDirs: [], stairSideways: [], crops: [],
      plantationOrigins: [], plantationUnderSlabs: [], furnaces: [], mobs: [], cars: [], boards: [], boats: [],
      dynamics: null, player: null,
    };
  },

  // Multiplayer: apply a remote block change that belongs to a dimension we are NOT
  // currently in. Store it in that dimension's packed diff list so it's present when
  // anyone loads that dimension — without corrupting the dimension we're standing in.
  stashRemoteBlock(dim, x, y, z, id) {
    if (!dim || dim === this.current) return false;
    if (!this.data) this.data = {};
    if (!this.data[dim]) this.data[dim] = this.emptyState(dim);
    const st = this.data[dim];
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
    const dims = data.dimensions;
    this.current = data.currentDimension || (dims && dims.current) || (data.player && data.player.dimension) || 'overworld';
    this.data = (dims && dims.data) ? dims.data : { overworld: this.legacyState(data) };
    if (!this.data.overworld) this.data.overworld = this.emptyState('overworld');
    if (!this.data.merry) this.data.merry = this.emptyState('merry');
    this.returnPortal = (dims && dims.returnPortal) || data.returnPortal || null;
    World.dimensionId = this.current;
    this.applyWorldState(this.data[this.current] || this.emptyState(this.current));
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
      spawners: [...World.spawners.entries()].map(([k, sp]) => [k, sp.type]),
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
    if (!this.current) this.current = 'overworld';
    this.data[this.current] = this.packWorldState();
  },

  serializeAll() {
    if (World && World.ready) this.storeCurrent();
    if (!this.data.overworld) this.data.overworld = this.emptyState('overworld');
    if (!this.data.merry) this.data.merry = this.emptyState('merry');
    return { current: this.current, data: this.data, returnPortal: this.returnPortal };
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
    World.chests.clear(); World.spawners.clear(); World.bedDirs.clear(); World.photoDirs.clear(); World.stairSideways.clear(); World.crops.clear();
    World.plantationOrigins.clear(); World.plantationUnderSlabs.clear(); World.furnaces.clear();
    World.megaTorches.clear(); World.fires.clear(); World.saplings.clear(); World.lights.clear();
    for (const [k, id] of st.diffs || []) World.diffs.set(k, id);
    this.rebuildDiffIndex();
    for (const [k, t] of st.signs || []) World.signs.set(k, t);
    for (const [k, d] of st.signDirs || []) World.signDirs.set(k, d);
    for (const [k, i] of st.lore || []) World.loreMap.set(k, i);
    for (const [k, slots] of st.chests || []) World.chests.set(k, slots.map(v => unpack(v)));
    for (const [k, type] of st.spawners || []) World.spawners.set(k, { type, cd: 3 });
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
    const st = this.data[this.current] || this.emptyState(this.current);
    Dynamics.deserialize(st.dynamics);
    Mobs.deserialize(st.mobs);
    Vehicles.deserialize(st.cars, st.boards, st.boats);
  },

  resetWorldForDimension(dim) {
    this.disposeWorldMeshes();
    World.init(Game.scene, World.seed);
    World.dimensionId = dim;
    this.applyWorldState(this.data[dim] || this.emptyState(dim));
    Mobs.init(Game.scene); Vehicles.init(Game.scene); Dynamics.init(Game.scene);
    const st = this.data[dim] || this.emptyState(dim);
    Dynamics.deserialize(st.dynamics);
    Mobs.deserialize(st.mobs);
    Vehicles.deserialize(st.cars, st.boards, st.boats);
    World.ready = false;
    Game.loading = true;
    Game.suppressPauseAfterLoad = true; // dimension travel should not show the click-to-play pause screen
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loadMsg').textContent = dim === 'merry' ? 'Entering the Merry Christmas Floop Dimension...' : 'Returning to the Overworld...';
  },

  switchTo(dim, pos) {
    if (this.travelCooldown > 0) return;
    this.storeCurrent();
    this.clearLiveEntities();
    this.current = dim;
    this.resetWorldForDimension(dim);
    const p = pos || (this.data[dim] && this.data[dim].player) || (dim === 'merry' ? { x: 0.5, y: 44.05, z: 0.5 } : World.findSpawn());
    Player.body.x = p.x; Player.body.y = p.y; Player.body.z = p.z;
    Player.body.vx = Player.body.vy = Player.body.vz = 0;
    if (p.yaw !== undefined) Player.yaw = p.yaw;
    if (p.pitch !== undefined) Player.pitch = p.pitch;
    this.travelCooldown = 3.0;
    UI.chat(dim === 'merry' ? 'The orange portal folds you into the Merry Christmas Floop Dimension.' : 'The portal spits you back into the Overworld.', '#ffb347');
  },

  isPortalBlockAt(x, y, z) { return World.getBlock(x, y, z) === B.MERRY_PORTAL; },


  isValidPortalFrameAt(bx, y, bz) {
    for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) {
      const corner = (dx === 0 || dx === 3) && (dz === 0 || dz === 3);
      const center = dx >= 1 && dx <= 2 && dz >= 1 && dz <= 2;
      if (center) continue;
      const need = corner ? B.OBSIDIAN : B.EMERALD_BLOCK;
      if (World.getBlock(bx + dx, y, bz + dz) !== need) return false;
    }
    return true;
  },

  frameHasLitPortalAt(bx, y, bz) {
    for (let dx = 1; dx <= 2; dx++) for (let dz = 1; dz <= 2; dz++) {
      if (World.getBlock(bx + dx, y + 1, bz + dz) === B.MERRY_PORTAL) return true;
    }
    return false;
  },

  clearPortalAtFrame(bx, y, bz) {
    let cleared = false;
    for (let dx = 1; dx <= 2; dx++) for (let dz = 1; dz <= 2; dz++) {
      const px = bx + dx, py = y + 1, pz = bz + dz;
      if (World.getBlock(px, py, pz) === B.MERRY_PORTAL) {
        World.setBlock(px, py, pz, B.AIR, { noUpdate: true, skipPortalCheck: true });
        cleared = true;
      }
    }
    if (cleared) {
      Particles.burst(bx + 2, y + 1.0, bz + 2, [1.0, 0.25, 0.05], 18, 2.2);
      UI.chat('The Merry portal collapses as its frame breaks.', '#ff9b45');
    }
    return cleared;
  },

  checkPortalFramesNearBlock(x, y, z) {
    // Called when emerald/obsidian frame blocks change.  Test every possible
    // 4x4 horizontal frame that could include the changed block, and collapse
    // its lit center if the frame is no longer complete.
    let changed = false;
    for (let bx = x - 3; bx <= x; bx++) for (let bz = z - 3; bz <= z; bz++) {
      const dx = x - bx, dz = z - bz;
      if (dx < 0 || dx > 3 || dz < 0 || dz > 3) continue;
      const center = dx >= 1 && dx <= 2 && dz >= 1 && dz <= 2;
      if (center) continue;
      if (this.frameHasLitPortalAt(bx, y, bz) && !this.isValidPortalFrameAt(bx, y, bz)) {
        changed = this.clearPortalAtFrame(bx, y, bz) || changed;
      }
    }
    return changed;
  },

  findFrameForDrop(d) {
    const fx0 = Math.floor(d.body.x), fz0 = Math.floor(d.body.z), fy0 = Math.floor(d.body.y);
    for (let y = fy0 - 2; y <= fy0 + 1; y++) {
      for (let bx = fx0 - 2; bx <= fx0 - 1; bx++) for (let bz = fz0 - 2; bz <= fz0 - 1; bz++) {
        if (!(d.body.x >= bx + 1 && d.body.x <= bx + 3 && d.body.z >= bz + 1 && d.body.z <= bz + 3)) continue;
        let ok = true;
        for (let dx = 0; dx < 4 && ok; dx++) for (let dz = 0; dz < 4 && ok; dz++) {
          const corner = (dx === 0 || dx === 3) && (dz === 0 || dz === 3);
          const center = dx >= 1 && dx <= 2 && dz >= 1 && dz <= 2;
          if (center) continue;
          const need = corner ? B.OBSIDIAN : B.EMERALD_BLOCK;
          if (World.getBlock(bx + dx, y, bz + dz) !== need) ok = false;
        }
        if (ok) return { x: bx, y, z: bz };
      }
    }
    return null;
  },

  igniteFrame(fr) {
    for (let dx = 1; dx <= 2; dx++) for (let dz = 1; dz <= 2; dz++) {
      World.setBlock(fr.x + dx, fr.y + 1, fr.z + dz, B.MERRY_PORTAL);
    }
    Particles.burst(fr.x + 2, fr.y + 1.25, fr.z + 2, [1.0, 0.45, 0.05], 42, 5);
    SFX.boom();
    UI.chat('The Christmas Gem lights an orange portal. The air smells like snow and static.', '#ffb347');
  },

  scanDroppedGems() {
    // Christmas Gem activation works in both dimensions.  The Merry dimension
    // must be recoverable if the player breaks the generated return portal.
    if (this.current !== 'overworld' && this.current !== 'merry') return;
    for (let i = Drops.list.length - 1; i >= 0; i--) {
      const d = Drops.list[i];
      if (!d || d.id !== I.XMAS_GEM) continue;
      const fr = this.findFrameForDrop(d);
      if (!fr) continue;
      this.igniteFrame(fr);
      d.count--;
      if (d.count <= 0) Drops.remove(i);
      return;
    }
  },

  portalClusterCenter(x, y, z) {
    const cells = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (World.getBlock(x + dx, y, z + dz) === B.MERRY_PORTAL) cells.push([x + dx, z + dz]);
    if (!cells.length) return { x: x + 0.5, y: y + 1.05, z: z + 0.5 };
    let sx = 0, sz = 0; for (const c of cells) { sx += c[0] + 0.5; sz += c[1] + 0.5; }
    return { x: sx / cells.length, y: y + 1.05, z: sz / cells.length };
  },

  checkPlayerPortal() {
    if (this.travelCooldown > 0 || !Player || Player.dead) return;
    const p = Player.body;
    const bx = Math.floor(p.x), bz = Math.floor(p.z);
    const ys = [Math.floor(p.y - 0.12), Math.floor(p.y + 0.08), Math.floor(p.y + 0.4)];
    for (const by of ys) {
      if (World.getBlock(bx, by, bz) !== B.MERRY_PORTAL) continue;
      if (this.current === 'overworld') {
        this.returnPortal = this.portalClusterCenter(bx, by, bz);
        this.switchTo('merry', { x: 0.5, y: 44.05, z: 0.5, yaw: Player.yaw, pitch: Player.pitch });
      } else {
        // If the original overworld return point is known, use it.  If not,
        // let switchTo() restore the saved overworld player position or find
        // a safe overworld spawn, instead of hardcoding a risky coordinate.
        this.switchTo('overworld', this.returnPortal || null);
      }
      return;
    }
  },

  portalParticles() {
    const p = Player.body;
    for (let n = 0; n < 8; n++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * 18);
      const z = Math.floor(p.z + (Math.random() - 0.5) * 18);
      for (let y = Math.max(0, Math.floor(p.y) - 4); y <= Math.min(World.H - 1, Math.floor(p.y) + 4); y++) {
        if (World.getBlock(x, y, z) === B.MERRY_PORTAL) {
          Particles.burst(x + 0.5, y + 0.15, z + 0.5, [1.0, 0.55, 0.05], 2, 1.2);
          if (Math.random() < 0.18) Particles.burst(x + 0.5, y + 0.35, z + 0.5, [0.1, 1.0, 0.55], 1, 0.8);
          return;
        }
      }
    }
  },

  update(dt) {
    if (this.travelCooldown > 0) this.travelCooldown -= dt;
    this.portalScanT -= dt;
    if (this.portalScanT <= 0) { this.portalScanT = 0.25; this.scanDroppedGems(); }
    this.checkPlayerPortal();
    this.portalFxT -= dt;
    if (this.portalFxT <= 0) { this.portalFxT = 0.65; this.portalParticles(); }
    // Player void death is handled globally in player.js so it also works in the overworld.
  },
};
