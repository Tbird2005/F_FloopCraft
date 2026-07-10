// ============================================================
// F_Floop Craft — world saving/loading (localStorage)
// ============================================================
const Save = {
  currentId: null,
  quotaCooldownUntil: 0,
  quotaCooldownMs: 120000,

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
    if (typeof isRetiredStackId === 'function' && isRetiredStackId(id)) return 0;
    const count = Math.max(1, Math.floor(+s.count || 1));
    const out = [id, count];
    if (Number.isFinite(+s.dur)) out[2] = +s.dur;
    else if (s.data !== undefined) out[2] = null;
    if (s.data !== undefined) {
      const jh = (id === B.JELLY_HOUSE && typeof Jelly !== 'undefined') ? Jelly.readHouseItemData(s.data) : null;
      out[3] = jh ? Jelly.serializeHouseItem(jh.stored) : s.data;
    }
    return out;
  },
  unpackStack(v) {
    if (!v) return null;
    const id = Number.isFinite(+v[0]) ? (+v[0] | 0) : v[0];
    if (typeof isRetiredStackId === 'function' && isRetiredStackId(id)) return null;
    const s = { id, count: Math.max(1, Math.floor(+v[1] || 1)) };
    if (Number.isFinite(+v[2])) s.dur = +v[2];
    if (v.length > 3 && v[3] !== undefined) {
      const jh = (id === B.JELLY_HOUSE && typeof Jelly !== 'undefined') ? Jelly.readHouseItemData(v[3]) : null;
      s.data = jh ? Jelly.serializeHouseItem(jh.stored) : v[3];
    }
    return s;
  },

  storageUsageChars() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        total += (k ? k.length : 0) + ((k && localStorage.getItem(k)) || '').length;
      }
    } catch (e) {}
    return total;
  },

  saveSizeReport(data) {
    const len = (v) => {
      try { return JSON.stringify(v).length; }
      catch (e) { return 0; }
    };
    const parts = [];
    for (const k of Object.keys(data || {})) {
      if (k !== 'dimensions') parts.push([k, len(data[k])]);
    }
    if (data && data.dimensions && data.dimensions.data) {
      const dims = data.dimensions.data;
      for (const dim of Object.keys(dims)) {
        const st = dims[dim] || {};
        parts.push(['dimensions.' + dim, len(st)]);
        for (const k of ['diffs','chests','jellyHouses','dungeonConquered','mobs','cars','boats','boards','dynamics','furnaces']) {
          if (st[k] !== undefined) parts.push(['dimensions.' + dim + '.' + k, len(st[k])]);
        }
      }
    } else if (data && data.dimensions) {
      parts.push(['dimensions', len(data.dimensions)]);
    }
    parts.sort((a, b) => b[1] - a[1]);
    return { total: len(data), storage: this.storageUsageChars(), biggest: parts.slice(0, 4) };
  },

  formatSize(chars) {
    if (!chars || chars <= 0) return '0KB';
    return Math.max(1, Math.round(chars / 1024)) + 'KB';
  },

  storageKeyReport(limit) {
    const keys = [];
    const worldNames = new Map();
    for (const w of this.listWorlds()) if (w && w.id) worldNames.set('ffc_w_' + w.id, w.name || w.id);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const raw = localStorage.getItem(k) || '';
        const label = worldNames.has(k) ? ('world "' + worldNames.get(k) + '"') : k;
        keys.push([label, k, k.length + raw.length]);
      }
    } catch (e) {}
    keys.sort((a, b) => b[2] - a[2]);
    return keys.slice(0, limit || 4);
  },

  compactSaveObject(data) {
    if (!data || !data.dimensions) return { data, changed: false };
    const out = Object.assign({}, data);
    let changed = false;
    for (const k of [
      'diffs','signs','signDirs','lore','chests','spawners','jellyHouses','dungeonConquered',
      'bedDirs','photoDirs','stairSideways','crops','plantationOrigins',
      'plantationUnderSlabs','furnaces','mobs','cars','boards','boats','dynamics',
    ]) {
      if (Object.prototype.hasOwnProperty.call(out, k)) {
        delete out[k];
        changed = true;
      }
    }
    if (changed && (!Number.isFinite(+out.v) || +out.v < 4)) out.v = 4;
    return { data: out, changed };
  },

  compactStoredWorldSaves() {
    let reclaimed = 0, count = 0;
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ffc_w_')) keys.push(k);
      }
    } catch (e) {}
    for (const k of keys) {
      let raw = null;
      try { raw = localStorage.getItem(k); } catch (e) { raw = null; }
      if (!raw) continue;
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { continue; }
      const compacted = this.compactSaveObject(parsed);
      if (!compacted.changed) continue;
      let next = '';
      try { next = JSON.stringify(compacted.data); } catch (e) { continue; }
      if (!next || next.length >= raw.length) continue;
      try {
        localStorage.setItem(k, next);
      } catch (e) {
        try {
          localStorage.removeItem(k);
          localStorage.setItem(k, next);
        } catch (e2) {
          try { localStorage.setItem(k, raw); } catch (restoreErr) {}
          continue;
        }
      }
      reclaimed += raw.length - next.length;
      count++;
    }
    return { reclaimed, count };
  },

  pruneOrphanedWorldSaves() {
    const worlds = this.listWorlds();
    if (!worlds.length) return { reclaimed: 0, count: 0 };
    const indexed = new Set(worlds.map(w => 'ffc_w_' + w.id));
    let reclaimed = 0, count = 0;
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ffc_w_') && !indexed.has(k) && k !== ('ffc_w_' + this.currentId)) keys.push(k);
      }
    } catch (e) {}
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k) || '';
        localStorage.removeItem(k);
        reclaimed += k.length + raw.length;
        count++;
      } catch (e) {}
    }
    return { reclaimed, count };
  },

  tryWriteWorldSave(key, raw) {
    try {
      localStorage.setItem(key, raw);
      return { ok: true };
    } catch (firstError) {
      const compacted = this.compactStoredWorldSaves();
      const pruned = this.pruneOrphanedWorldSaves();
      try {
        localStorage.setItem(key, raw);
        return { ok: true, recovered: true, compacted, pruned };
      } catch (secondError) {
        const oldRaw = localStorage.getItem(key);
        if (oldRaw !== null && oldRaw.length > raw.length) {
          try {
            localStorage.removeItem(key);
            localStorage.setItem(key, raw);
            return { ok: true, recovered: true, replacedCurrent: oldRaw.length - raw.length, compacted, pruned };
          } catch (thirdError) {
            try { localStorage.setItem(key, oldRaw); } catch (restoreErr) {}
            return { ok: false, error: thirdError, firstError, compacted, pruned };
          }
        }
        return { ok: false, error: secondError, firstError, compacted, pruned };
      }
    }
  },

  saveCurrent(opts) {
    opts = opts || {};
    if (!this.currentId || !World.ready) return false;
    const now = Date.now();
    if (!opts.force && this.quotaCooldownUntil && now < this.quotaCooldownUntil) {
      if (!opts.auto && typeof UI !== 'undefined' && UI.chat) {
        UI.chat('Save skipped - browser storage is still full. Delete old worlds from Saves, then try /save.', '#ff8080');
      }
      return false;
    }
    const p = Player;
    const dimensionsData = (typeof Dimensions !== 'undefined' ? Dimensions.serializeAll() : null);
    const writeLegacyWorldState = !dimensionsData;
    const data = {
      v: 4,
      seed: World.seed,
      currentDimension: (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld'),
      dimensions: dimensionsData,
      time: Game.time,
      dayCount: Game.dayCount,
      humbugAnnounced: Game.humbugAnnounced,
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
    };
    if (writeLegacyWorldState) {
      Object.assign(data, {
        diffs: [...World.diffs.entries()],
        signs: [...World.signs.entries()],
        signDirs: [...World.signDirs.entries()],
        lore: [...World.loreMap.entries()],
        chests: [...World.chests.entries()].map(([k, slots]) => [k, slots.map(s => this.packStack(s))]),
        spawners: [...World.spawners.entries()].filter(([k, sp]) => !sp || sp.type !== 'jelly_house').map(([k, sp]) => [k, {
          type: sp.type, roster: sp.roster || null, insideOnly: !!sp.insideOnly,
          rank: sp.rank || '', remaining: Number.isFinite(+sp.remaining) ? +sp.remaining : undefined,
          max: Number.isFinite(+sp.max) ? +sp.max : undefined, spawned: Number.isFinite(+sp.spawned) ? +sp.spawned : undefined,
          dungeonKey: sp.dungeonKey || '', liveCap: Number.isFinite(+sp.liveCap) ? +sp.liveCap : undefined,
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
          i: this.packStack(f.in), f: this.packStack(f.fuel), o: this.packStack(f.out),
          burn: +((f.burn || 0).toFixed ? f.burn.toFixed(2) : (f.burn || 0)), burnMax: f.burnMax, cook: +((f.cook || 0).toFixed ? f.cook.toFixed(2) : (f.cook || 0)),
        }]),
        mobs: Mobs.serialize(),
        cars: Vehicles.serialize(),
        boards: Vehicles.serializeBoards(),
        boats: Vehicles.serializeBoats(),
        dynamics: Dynamics.serialize(),
      });
    }
    const raw = JSON.stringify(data);
    const write = this.tryWriteWorldSave('ffc_w_' + this.currentId, raw);
    if (!write.ok) {
      this.quotaCooldownUntil = Date.now() + this.quotaCooldownMs;
      const e = write.error || write.firstError || new Error('quota exceeded');
      const stats = this.saveSizeReport(data);
      const biggest = stats.biggest.map(([k, n]) => k + ' ' + this.formatSize(n)).join(', ');
      const stored = this.storageKeyReport(3).map(([label, k, n]) => label + ' ' + this.formatSize(n)).join(', ');
      const reclaimed = (write.compacted && write.compacted.reclaimed || 0) + (write.pruned && write.pruned.reclaimed || 0);
      UI.chat('Save failed - browser storage full. Save ' + this.formatSize(stats.total) + ', storage used ' + this.formatSize(stats.storage) + '. Biggest save parts: ' + biggest + '. Biggest stored: ' + stored + '. Reclaimed ' + this.formatSize(reclaimed) + '. (' + e.message + ')', '#ff8080');
      return false;
    }
    this.quotaCooldownUntil = 0;
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
      const ck = World.chunkKeyForBlock ? World.chunkKeyForBlock(+parts[0], +parts[2]) : World.key(Math.floor(+parts[0] / 16), Math.floor(+parts[2] / 16));
      if (!World.diffIndex.has(ck)) World.diffIndex.set(ck, new Map());
      World.diffIndex.get(ck).set(k, id);
    }
    for (const [k, t] of data.signs || []) World.signs.set(k, t);
    for (const [k, d] of data.signDirs || []) World.signDirs.set(k, d);
    for (const [k, i] of data.lore || []) World.loreMap.set(k, i);
    for (const [k, slots] of data.chests || []) {
      World.chests.set(k, slots.map(v => this.unpackStack(v)));
    }
    if (typeof Jelly !== 'undefined') Jelly.loadHouseEntries(data.jellyHouses || []);
    if (World.dungeonConquered) {
      World.dungeonConquered.clear();
      for (const dk of data.dungeonConquered || data.dungeonsConquered || []) World.dungeonConquered.add(String(dk));
    }
    for (const rec of data.spawners || []) {
      const [k, raw, legacyRoster, legacyInsideOnly] = rec;
      const obj = raw && typeof raw === 'object' ? raw : { type: raw, roster: legacyRoster, insideOnly: legacyInsideOnly };
      if (obj.type === 'jelly_house' && typeof Jelly !== 'undefined') { Jelly.migrateLegacySaveSpawners([[k, obj.type, obj.roster]]); continue; }
      World.spawners.set(k, {
        type: obj.type, cd: Number.isFinite(+obj.cd) ? +obj.cd : 3,
        roster: Array.isArray(obj.roster) ? obj.roster.slice(0, 64) : undefined, insideOnly: !!obj.insideOnly,
        rank: obj.rank || '', remaining: Number.isFinite(+obj.remaining) ? +obj.remaining : undefined,
        max: Number.isFinite(+obj.max) ? +obj.max : undefined, spawned: Number.isFinite(+obj.spawned) ? +obj.spawned : undefined,
        dungeonKey: obj.dungeonKey || '', liveCap: Number.isFinite(+obj.liveCap) ? +obj.liveCap : undefined,
        pool: Array.isArray(obj.pool) ? obj.pool.slice(0, 12) : undefined,
      });
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
    const savedDim = sp.dimension || (sp.spawn && sp.spawn.dim) || 'overworld';
    const migratedRemovedDimension = savedDim !== 'overworld';
    Player.loadedFromSave = true;
    Player.hp = sp.hp; Player.hunger = sp.hunger;
    Player.xp = sp.xp || 0; Player.level = sp.level || 0;
    Player.gamemode = sp.gamemode || 'survival';
    if (typeof Dimensions !== 'undefined') Dimensions.current = 'overworld';
    Player.sel = sp.sel || 0;
    Player.inv = (sp.inv || []).map(v => this.unpackStack(v));
    while (Player.inv.length < 36) Player.inv.push(null);
    Player.armor = (sp.armor || [0, 0, 0, 0]).map(v => this.unpackStack(v));
    while (Player.armor.length < 4) Player.armor.push(null);
    Player.armor.length = 4;
    Player.sanitizeArmor();
    Player.spawn = migratedRemovedDimension && typeof World !== 'undefined' && World.findSpawn
      ? World.findSpawn()
      : (sp.spawn || Player.spawn);
    if (Player.spawn) Player.spawn.dim = 'overworld';
    Player.yaw = sp.yaw || 0; Player.pitch = sp.pitch || 0;
    if (migratedRemovedDimension) return null;
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
