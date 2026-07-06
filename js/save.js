// ============================================================
// F_Floop Craft — world saving/loading (localStorage)
// ============================================================
const Save = {
  currentId: null,

  hashSeed(str) {
    if (!str) return (Math.random() * 2 ** 31) | 0;
    if (/^-?\d+$/.test(str.trim())) return parseInt(str.trim(), 10) | 0;
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h | 0;
  },

  listWorlds() {
    try { return JSON.parse(localStorage.getItem('ffc_index') || '[]'); }
    catch (e) { return []; }
  },

  writeIndex(idx) {
    localStorage.setItem('ffc_index', JSON.stringify(idx));
  },

  createWorld(name, seedStr) {
    const id = Date.now().toString(36) + Math.floor(Math.random() * 999).toString(36);
    const seed = this.hashSeed(seedStr);
    const idx = this.listWorlds();
    idx.unshift({ id, name: name || 'New World', seed, day: 1, ts: Date.now() });
    this.writeIndex(idx);
    this.currentId = id;
    return { id, name: name || 'New World', seed, fresh: true };
  },

  deleteWorld(id) {
    this.writeIndex(this.listWorlds().filter(w => w.id !== id));
    localStorage.removeItem('ffc_w_' + id);
  },

  loadWorld(id) {
    try {
      const data = JSON.parse(localStorage.getItem('ffc_w_' + id));
      if (data) { this.currentId = id; return data; }
    } catch (e) { /* corrupted save */ }
    return null;
  },

  packStack(s) {
    if (!s) return 0;
    const id = Number.isFinite(+s.id) ? (+s.id | 0) : s.id;
    const count = Math.max(1, Math.floor(+s.count || 1));
    return Number.isFinite(+s.dur) ? [id, count, +s.dur] : [id, count];
  },
  unpackStack(v) {
    if (!v) return null;
    const id = Number.isFinite(+v[0]) ? (+v[0] | 0) : v[0];
    const s = { id, count: Math.max(1, Math.floor(+v[1] || 1)) };
    if (Number.isFinite(+v[2])) s.dur = +v[2];
    return s;
  },

  saveCurrent() {
    if (!this.currentId || !World.ready) return false;
    const p = Player;
    const data = {
      v: 3,
      seed: World.seed,
      currentDimension: (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld'),
      dimensions: (typeof Dimensions !== 'undefined' ? Dimensions.serializeAll() : null),
      time: Game.time,
      dayCount: Game.dayCount,
      humbugAnnounced: Game.humbugAnnounced,
      diffs: [...World.diffs.entries()],
      signs: [...World.signs.entries()],
      signDirs: [...World.signDirs.entries()],
      lore: [...World.loreMap.entries()],
      chests: [...World.chests.entries()].map(([k, slots]) => [k, slots.map(s => this.packStack(s))]),
      spawners: [...World.spawners.entries()].map(([k, sp]) => [k, sp.type]),
      bedDirs: [...World.bedDirs.entries()],
      photoDirs: [...World.photoDirs.entries()],
      stairSideways: [...World.stairSideways.entries()],
      crops: [...World.crops.entries()],
      plantationOrigins: [...World.plantationOrigins.entries()],
      plantationUnderSlabs: [...World.plantationUnderSlabs.entries()],
      furnaces: [...World.furnaces.entries()].map(([k, f]) => [k, {
        i: this.packStack(f.in), f: this.packStack(f.fuel), o: this.packStack(f.out),
        burn: +f.burn.toFixed(2), burnMax: f.burnMax, cook: +f.cook.toFixed(2),
      }]),
      stocks: Game.stocks,
      player: {
        x: +p.body.x.toFixed(2), y: +p.body.y.toFixed(2), z: +p.body.z.toFixed(2),
        yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3),
        hp: p.hp, hunger: p.hunger, xp: p.xp, level: p.level,
        gamemode: p.gamemode, sel: p.sel,
        inv: p.inv.map(s => this.packStack(s)),
        armor: p.armor.map(s => this.packStack(s)),
        spawn: p.spawn,
        dimension: (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld'),
      },
      mobs: Mobs.serialize(),
      cars: Vehicles.serialize(),
      boards: Vehicles.serializeBoards(),
      boats: Vehicles.serializeBoats(),
      dynamics: Dynamics.serialize(),
    };
    try {
      localStorage.setItem('ffc_w_' + this.currentId, JSON.stringify(data));
    } catch (e) {
      UI.chat('Save failed — storage full? (' + e.message + ')', '#ff8080');
      return false;
    }
    const idx = this.listWorlds();
    const entry = idx.find(w => w.id === this.currentId);
    if (entry) { entry.day = Game.dayCount; entry.ts = Date.now(); this.writeIndex(idx); }
    return true;
  },

  // restore world-level state (call after World.init, before chunk gen)
  applyWorldData(data) {
    if (typeof Dimensions !== 'undefined' && Dimensions.loadAll) {
      Dimensions.loadAll(data);
      Game.time = data.time || 0;
      Game.dayCount = data.dayCount || 1;
      Game.humbugAnnounced = !!data.humbugAnnounced;
      if (data.stocks) Game.stocks = data.stocks;
      return;
    }
    for (const [k, id] of data.diffs || []) {
      World.diffs.set(k, id);
      // rebuild the per-chunk index (fast chunk-gen replay)
      const parts = k.split(',');
      const ck = World.key(+parts[0] >> 4, +parts[2] >> 4);
      if (!World.diffIndex.has(ck)) World.diffIndex.set(ck, new Map());
      World.diffIndex.get(ck).set(k, id);
    }
    for (const [k, t] of data.signs || []) World.signs.set(k, t);
    for (const [k, d] of data.signDirs || []) World.signDirs.set(k, d);
    for (const [k, i] of data.lore || []) World.loreMap.set(k, i);
    for (const [k, slots] of data.chests || []) {
      World.chests.set(k, slots.map(v => this.unpackStack(v)));
    }
    for (const [k, type] of data.spawners || []) {
      World.spawners.set(k, { type, cd: 3 });
    }
    for (const [k, d] of data.bedDirs || []) World.bedDirs.set(k, d);
    for (const [k, d] of data.photoDirs || []) World.photoDirs.set(k, d);
    for (const [k, d] of data.stairSideways || []) World.stairSideways.set(k, d);
    for (const [k, c] of data.crops || []) World.crops.set(k, c);
    for (const [k, o] of data.plantationOrigins || []) World.plantationOrigins.set(k, o);
    for (const [k, id] of data.plantationUnderSlabs || []) World.plantationUnderSlabs.set(k, id);
    for (const [k, f] of data.furnaces || []) {
      World.furnaces.set(k, {
        in: this.unpackStack(f.i), fuel: this.unpackStack(f.f), out: this.unpackStack(f.o),
        burn: f.burn || 0, burnMax: f.burnMax || 0, cook: f.cook || 0,
      });
    }
    Game.time = data.time || 0;
    Game.dayCount = data.dayCount || 1;
    Game.humbugAnnounced = !!data.humbugAnnounced;
    if (data.stocks) Game.stocks = data.stocks;
  },

  applyPlayerData(data) {
    const sp = data.player;
    if (!sp) return null;
    Player.loadedFromSave = true;
    Player.hp = sp.hp; Player.hunger = sp.hunger;
    Player.xp = sp.xp || 0; Player.level = sp.level || 0;
    Player.gamemode = sp.gamemode || 'survival';
    if (typeof Dimensions !== 'undefined' && sp.dimension) Dimensions.current = sp.dimension;
    Player.sel = sp.sel || 0;
    Player.inv = (sp.inv || []).map(v => this.unpackStack(v));
    while (Player.inv.length < 36) Player.inv.push(null);
    Player.armor = (sp.armor || [0, 0, 0, 0]).map(v => this.unpackStack(v));
    while (Player.armor.length < 4) Player.armor.push(null);
    Player.armor.length = 4;
    Player.sanitizeArmor();
    Player.spawn = sp.spawn || Player.spawn;
    Player.yaw = sp.yaw || 0; Player.pitch = sp.pitch || 0;
    return { x: sp.x, y: sp.y, z: sp.z };
  },

  // restore entities (call once chunks around the player exist)
  applyEntityData(data) {
    if (typeof Dimensions !== 'undefined' && Dimensions.applyCurrentEntities) {
      Dimensions.applyCurrentEntities();
      return;
    }
    Mobs.deserialize(data.mobs);
    Vehicles.deserialize(data.cars, data.boards, data.boats);
    Dynamics.deserialize(data.dynamics);
  },
};
