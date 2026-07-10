// ============================================================
// F_Floop Craft — Jelly system authority/state helpers
// One source of truth for Jelly Houses, residents, item data,
// adoption, theft anger, and house break/place behavior.
// ============================================================

const Jelly = {
  HOUSE_START: 10,
  HOUSE_MAX_STORED: 64,
  HOUSE_ADOPT_RADIUS: 10,
  _idSeq: 1,
  _houseSpatial: null,
  _houseUpdateCursor: 0,
  _legacySpawnerScanClean: false,

  colors() { return (typeof JELLY_COLORS_ALL !== 'undefined') ? JELLY_COLORS_ALL : ['pink', 'cyan', 'lime', 'grape', 'orange', 'yellow']; },
  validColor(color) { return this.colors().includes(color) ? color : 'pink'; },
  newId(prefix) {
    this._idSeq = (this._idSeq || 1) + 1;
    const rnd = ((Math.random() * 0x7fffffff) | 0).toString(36);
    return (prefix || 'j') + Date.now().toString(36) + '_' + (this._idSeq).toString(36) + '_' + rnd;
  },
  newHouseId() { return this.newId('jh_'); },
  newJellyId() { return this.newId('jp_'); },

  ensureStorage() {
    if (typeof World === 'undefined') return false;
    if (!World.jellyHouses) World.jellyHouses = new Map();
    if (!World.jellyHouseIds) World.jellyHouseIds = new Map();
    if (!this._houseSpatial) this.rebuildHouseSpatial();
    return true;
  },
  keyOf(x, y, z) { const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z); return (typeof World !== 'undefined' && World.pkey) ? World.pkey(bx, by, bz) : (bx + ',' + by + ',' + bz); },
  splitKey(key) { const p = String(key || '').split(',').map(Number); return p.length === 3 && p.every(Number.isFinite) ? p : null; },
  resetStorageCache() {
    this._houseSpatial = new Map();
    this._houseUpdateCursor = 0;
    this._legacySpawnerScanClean = false;
  },
  spatialKeyForBlock(x, z) { const cx = (typeof World !== 'undefined' && World.chunkCoord) ? World.chunkCoord(x) : Math.floor(Math.floor(x) / 16); const cz = (typeof World !== 'undefined' && World.chunkCoord) ? World.chunkCoord(z) : Math.floor(Math.floor(z) / 16); return cx + ',' + cz; },
  spatialKeyForHouseKey(key) {
    const p = this.splitKey(key);
    return p ? this.spatialKeyForBlock(p[0], p[2]) : '';
  },
  rebuildHouseSpatial() {
    this._houseSpatial = new Map();
    if (typeof World === 'undefined' || !World.jellyHouses) return;
    for (const key of World.jellyHouses.keys()) this.indexHouseKey(key);
  },
  indexHouseKey(key) {
    if (!this._houseSpatial) this._houseSpatial = new Map();
    const sk = this.spatialKeyForHouseKey(key);
    if (!sk) return;
    if (!this._houseSpatial.has(sk)) this._houseSpatial.set(sk, new Set());
    this._houseSpatial.get(sk).add(key);
  },
  unindexHouseKey(key) {
    if (!this._houseSpatial) return;
    const sk = this.spatialKeyForHouseKey(key);
    const bucket = sk && this._houseSpatial.get(sk);
    if (!bucket) return;
    bucket.delete(key);
    if (!bucket.size) this._houseSpatial.delete(sk);
  },
  houseEntriesNear(x, y, z, radius) {
    if (!this.ensureStorage()) return [];
    const r = Math.max(1, radius || this.HOUSE_ADOPT_RADIUS);
    const minCx = (typeof World !== 'undefined' && World.chunkCoord) ? World.chunkCoord(x - r) : Math.floor(Math.floor(x - r) / 16), maxCx = (typeof World !== 'undefined' && World.chunkCoord) ? World.chunkCoord(x + r) : Math.floor(Math.floor(x + r) / 16);
    const minCz = (typeof World !== 'undefined' && World.chunkCoord) ? World.chunkCoord(z - r) : Math.floor(Math.floor(z - r) / 16), maxCz = (typeof World !== 'undefined' && World.chunkCoord) ? World.chunkCoord(z + r) : Math.floor(Math.floor(z + r) / 16);
    const out = [];
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this._houseSpatial && this._houseSpatial.get(cx + ',' + cz);
        if (!bucket) continue;
        for (const key of bucket) {
          const house = World.jellyHouses.get(key);
          if (!house) continue;
          const p = this.splitKey(key);
          if (!p || Math.abs(p[1] - y) > r) continue;
          out.push([key, house, p]);
        }
      }
    }
    return out;
  },

  normalizeStoredResidents(input) {
    const out = [];
    const push = (entry) => {
      let id = null, color = 'pink';
      if (typeof entry === 'string') color = entry;
      else if (Array.isArray(entry)) { id = entry[0]; color = entry[1]; }
      else if (entry && typeof entry === 'object') { id = entry.id || entry.jellyId || entry[0]; color = entry.color || entry.c || entry[1]; }
      color = this.validColor(color);
      out.push({ id: (typeof id === 'string' && id) ? id : this.newJellyId(), color, size: 'small' });
    };
    let src = input;
    if (input && input.jellyHouse) src = input.jellyHouse.stored;
    else if (input && input.jellyRoster) src = input.jellyRoster;
    for (const entry of (Array.isArray(src) ? src : [])) {
      push(entry);
      if (out.length >= this.HOUSE_MAX_STORED) break;
    }
    return out;
  },
  packStoredResidents(input) {
    const out = [];
    let src = input;
    if (input && input.jellyHouse) src = input.jellyHouse.stored;
    else if (input && input.jellyRoster) src = input.jellyRoster;
    if (Array.isArray(src) && (!src.length || Array.isArray(src[0]))) {
      const n = Math.min(src.length, this.HOUSE_MAX_STORED);
      let packed = true;
      for (let i = 0; i < n; i++) {
        const r = src[i];
        if (!Array.isArray(r) || typeof r[0] !== 'string') { packed = false; break; }
      }
      if (packed) return src.length === n ? src.slice() : src.slice(0, n);
    }
    for (const entry of (Array.isArray(src) ? src : [])) {
      let id = null, color = 'pink';
      if (typeof entry === 'string') color = entry;
      else if (Array.isArray(entry)) { id = entry[0]; color = entry[1]; }
      else if (entry && typeof entry === 'object') { id = entry.id || entry.jellyId || entry[0]; color = entry.color || entry.c || entry[1]; }
      out.push([(typeof id === 'string' && id) ? id : this.newJellyId(), this.validColor(color)]);
      if (out.length >= this.HOUSE_MAX_STORED) break;
    }
    return out;
  },
  ensureStoredObjects(house) {
    if (!house) return [];
    if (!Array.isArray(house.stored)) {
      house.stored = this.normalizeStoredResidents(house.stored);
    } else if (house.stored.length && (Array.isArray(house.stored[0]) || typeof house.stored[0] === 'string')) {
      house.stored = this.normalizeStoredResidents(house.stored);
    }
    return house.stored;
  },
  defaultResidents(count) {
    const colors = this.colors();
    const out = [];
    for (let i = 0; i < (count || this.HOUSE_START); i++) out.push({ id: this.newJellyId(), color: colors[(Math.random() * colors.length) | 0], size: 'small' });
    return out;
  },

  hasStoredResidents(input) {
    return this.normalizeStoredResidents(input).length > 0;
  },

  legacyStoredForKey(key) {
    if (typeof World === 'undefined' || !World.spawners) return [];
    const sp = World.spawners.get(key);
    return (sp && sp.type === 'jelly_house') ? this.normalizeStoredResidents(sp.roster || sp.stored || []) : [];
  },

  bestStoredForKey(key) {
    const house = this.getHouseByKey(key);
    const current = house ? this.normalizeStoredResidents(house.stored) : [];
    if (current.length) return current;
    const legacy = this.legacyStoredForKey(key);
    return legacy.length ? legacy : current;
  },

  readHouseItemData(data) {
    if (!data) return null;
    // Canonical carried item format: { jellyHouse:{ v:2, stored:[[id,color], ...] } }
    if (data.jellyHouse && Array.isArray(data.jellyHouse.stored)) return { v: 2, stored: this.normalizeStoredResidents(data.jellyHouse.stored) };
    // Multiplayer/block-meta format sometimes passes the packed house record directly:
    // [houseId, [[residentId,color], ...], cd, panicT, playerAngerT]
    if (Array.isArray(data) && Array.isArray(data[1])) return { v: 2, stored: this.normalizeStoredResidents(data[1]) };
    if (data.jellyHouse && Array.isArray(data.jellyHouse) && Array.isArray(data.jellyHouse[1])) return { v: 2, stored: this.normalizeStoredResidents(data.jellyHouse[1]) };
    // Older/looser test-build formats. These are migration only, not the source of truth.
    if (Array.isArray(data.jellyRoster)) return { v: 2, stored: this.normalizeStoredResidents(data.jellyRoster) };
    if (Array.isArray(data.stored)) return { v: 2, stored: this.normalizeStoredResidents(data.stored) };
    if (Array.isArray(data.roster)) return { v: 2, stored: this.normalizeStoredResidents(data.roster) };
    return null;
  },
  serializeHouseItem(houseOrStored) {
    const stored = Array.isArray(houseOrStored) ? houseOrStored : ((houseOrStored && houseOrStored.stored) || []);
    return { jellyHouse: { v: 2, stored: this.packStoredResidents(stored) } };
  },
  packHouseRecord(house) {
    return [house.id || this.newHouseId(), this.packStoredResidents(house.stored), +(house.cd || 0), +(house.panicT || 0), +(house.playerAngerT || 0)];
  },
  unpackHouseRecord(key, data) {
    let id, stored, cd, panicT, playerAngerT;
    if (Array.isArray(data)) { [id, stored, cd, panicT, playerAngerT] = data; }
    else if (data && typeof data === 'object') { id = data.id; stored = data.stored; cd = data.cd; panicT = data.panicT; playerAngerT = data.playerAngerT; }
    return { v: 2, id: (typeof id === 'string' && id) ? id : this.newHouseId(), key, stored: Array.isArray(stored) ? (stored.length > this.HOUSE_MAX_STORED ? stored.slice(0, this.HOUSE_MAX_STORED) : stored) : [], cd: +(cd || 1), panicT: +(panicT || 0), playerAngerT: +(playerAngerT || 0) };
  },

  setHouse(key, house, opts = {}) {
    if (!this.ensureStorage()) return null;
    const prev = World.jellyHouses.get(key);
    if (prev && prev.id && prev.id !== house.id && World.jellyHouseIds) World.jellyHouseIds.delete(prev.id);
    this.unindexHouseKey(key);
    house.key = key;
    house.id = house.id || this.newHouseId();
    house.v = 2;
    house.stored = opts.storedNormalized ? (Array.isArray(house.stored) ? house.stored : []) : this.normalizeStoredResidents(house.stored);
    World.jellyHouses.set(key, house);
    World.jellyHouseIds.set(house.id, key);
    this.indexHouseKey(key);
    return house;
  },
  getHouseByKey(key) { this.ensureStorage(); return (World.jellyHouses && World.jellyHouses.get(key)) || null; },
  getHouseById(id) { const key = this.getHouseKeyById(id); return key ? this.getHouseByKey(key) : null; },
  getHouseKeyById(id) { this.ensureStorage(); return (id && World.jellyHouseIds && World.jellyHouseIds.get(id)) || null; },
  deleteHouseByKey(key) {
    if (!this.ensureStorage()) return null;
    const house = World.jellyHouses.get(key) || null;
    if (house && World.jellyHouseIds) World.jellyHouseIds.delete(house.id);
    this.unindexHouseKey(key);
    World.jellyHouses.delete(key);
    if (World.spawners) {
      const sp = World.spawners.get(key);
      if (sp && sp.type === 'jelly_house') World.spawners.delete(key);
    }
    return house;
  },
  isHouseBlockAlive(key) {
    const p = this.splitKey(key);
    return !!(p && typeof World !== 'undefined' && World.getBlock && World.getBlock(p[0], p[1], p[2]) === B.JELLY_HOUSE);
  },

  createHouseAt(x, y, z, opts = {}) {
    if (!this.ensureStorage()) return null;
    const key = this.keyOf(x, y, z);
    const existing = World.jellyHouses.get(key);
    // World generation may run after saved side metadata has already loaded.
    // Natural generation should seed a house only the first time; it must not
    // overwrite a saved/picked/placed house record at the same block key.
    if (existing && opts.source === 'worldgen') return existing;
    let stored = null;
    const item = this.readHouseItemData(opts.itemData || opts.data || null);
    if (item) stored = item.stored;
    else if (Array.isArray(opts.stored)) stored = opts.stored;
    else if (Array.isArray(opts.jellyRoster)) stored = opts.jellyRoster;
    else if (Array.isArray(opts.roster)) stored = opts.roster;
    // Repair older patch saves where a legacy spawner roster exists at the same
    // key as an empty canonical house. Item data still wins first; this only
    // fills in missing placement/load metadata.
    if (!stored) {
      const legacyStored = this.legacyStoredForKey(key);
      if (legacyStored.length) stored = legacyStored;
    }
    // Only natural/legacy houses get a fresh starting roster. Player-placed
    // data-less houses, including creative menu copies, stay empty; picked-up
    // houses carry item data and therefore restore exactly that count.
    const shouldSeedDefault = !stored && (opts.seedDefault === true || opts.source === 'worldgen' || opts.source === 'legacy' || opts.source === 'legacy_save');
    const storedNorm = stored ? this.normalizeStoredResidents(stored) : (shouldSeedDefault ? this.defaultResidents(this.HOUSE_START) : []);
    const house = this.setHouse(key, {
      v: 2,
      id: opts.id || this.newHouseId(),
      key,
      stored: storedNorm,
      cd: +(opts.cd || 1),
      panicT: +(opts.panicT || 0),
      playerAngerT: +(opts.playerAngerT || 0),
      source: opts.source || 'placed',
    }, { storedNormalized: true });
    return house;
  },

  migrateLegacySpawners() {
    if (!this.ensureStorage() || !World.spawners) return;
    if (this._legacySpawnerScanClean) return;
    for (const [key, sp] of [...World.spawners.entries()]) {
      if (!sp || sp.type !== 'jelly_house') continue;
      const pos = this.splitKey(key);
      const legacyStored = this.normalizeStoredResidents(sp.roster || sp.stored || []);
      const existing = World.jellyHouses.get(key);
      if (!existing) {
        if (pos) this.createHouseAt(pos[0], pos[1], pos[2], { roster: legacyStored, cd: sp.cd, panicT: sp.panicT, playerAngerT: sp.playerAngerT, source: 'legacy' });
      } else {
        // If an older patch created an empty canonical record next to a legacy
        // jelly_house spawner roster, do not throw the roster away. Import it
        // into the existing house before deleting the legacy record.
        const cur = this.normalizeStoredResidents(existing.stored);
        if (!cur.length && legacyStored.length) existing.stored = legacyStored;
        if (sp.cd !== undefined) existing.cd = sp.cd;
        if (sp.panicT !== undefined) existing.panicT = sp.panicT;
        if (sp.playerAngerT !== undefined) existing.playerAngerT = sp.playerAngerT;
      }
      World.spawners.delete(key);
    }
    this._legacySpawnerScanClean = true;
  },
  loadHouseEntries(entries) {
    if (!this.ensureStorage()) return;
    this.resetStorageCache();
    World.jellyHouses.clear(); World.jellyHouseIds.clear();
    for (const rec of (Array.isArray(entries) ? entries : [])) {
      if (!Array.isArray(rec)) continue;
      const key = rec[0];
      const pos = this.splitKey(key);
      if (!pos) continue;
      const house = this.unpackHouseRecord(key, rec[1] !== undefined ? rec[1] : rec);
      house.key = key;
      house.v = 2;
      World.jellyHouses.set(key, house);
      World.jellyHouseIds.set(house.id, key);
      const sk = this.spatialKeyForBlock(pos[0], pos[2]);
      if (!this._houseSpatial.has(sk)) this._houseSpatial.set(sk, new Set());
      this._houseSpatial.get(sk).add(key);
    }
  },
  saveHouseEntries() {
    if (!this.ensureStorage()) return [];
    return [...World.jellyHouses.entries()].map(([key, house]) => [key, this.packHouseRecord(house)]);
  },
  migrateLegacySaveSpawners(spawners) {
    if (!this.ensureStorage()) return;
    for (const rec of (Array.isArray(spawners) ? spawners : [])) {
      if (!Array.isArray(rec)) continue;
      const [key, type, roster] = rec;
      if (type === 'jelly_house' && !World.jellyHouses.has(key)) { const pos = this.splitKey(key); if (pos) this.createHouseAt(pos[0], pos[1], pos[2], { roster, source: 'legacy_save' }); }
    }
  },

  initMob(mob, source) {
    if (!mob || (mob.type !== 'jelly' && mob.type !== 'big_jelly')) return mob;
    mob.jellyId = mob.jellyId || this.newJellyId();
    mob.jellySize = mob.type === 'big_jelly' ? 'big' : 'small';
    if (mob.jellySize === 'big') {
      mob.homeHouseId = null;
      mob.membership = 'homeless';
      mob.jellyHome = '';
      mob.fromSpawner = '';
    } else {
      mob.homeHouseId = mob.homeHouseId || null;
      mob.membership = mob.homeHouseId ? 'outside_member' : 'homeless';
      mob.membershipSource = source || mob.membershipSource || 'spawned';
      if (!mob.jellyHome && mob.homeHouseId) mob.jellyHome = this.getHouseKeyById(mob.homeHouseId) || '';
      mob.fromSpawner = '';
    }
    return mob;
  },
  canBelong(mob) { return !!(mob && !mob.dead && mob.type === 'jelly'); },
  makeHomeless(mob, reason) {
    if (!mob || mob.dead) return;
    mob.homeHouseId = null;
    mob.membership = 'homeless';
    mob.membershipSource = reason || 'homeless';
    mob.jellyHome = '';
    mob.fromSpawner = '';
    mob.path = null;
    mob.jellyIdleGoal = null;
    mob.wanderDir = null;
    mob.adoptScanT = 1.0 + Math.random() * 1.5;
  },
  adopt(mob, houseId, source) {
    if (!this.canBelong(mob)) return false;
    const house = this.getHouseById(houseId);
    if (!house || !this.isHouseBlockAlive(house.key)) return false;
    mob.homeHouseId = house.id;
    mob.membership = 'outside_member';
    mob.membershipSource = source || 'adopted';
    mob.jellyHome = house.key;
    mob.fromSpawner = '';
    mob.path = null;
    mob.jellyIdleGoal = null;
    return true;
  },
  tryAdoptNearest(mob, radius) {
    if (!this.canBelong(mob) || !this.ensureStorage()) return false;
    if (mob.homeHouseId && this.getHouseById(mob.homeHouseId)) return false;
    if (mob.jellyHome && this.getHouseByKey(mob.jellyHome)) {
      const h = this.getHouseByKey(mob.jellyHome);
      return this.adopt(mob, h.id, 'legacy');
    }
    mob.adoptScanT = (mob.adoptScanT || 0) - ((typeof Mobs !== 'undefined' && Mobs._lastDt) || 0);
    if (mob.adoptScanT > 0) return false;
    mob.adoptScanT = 1.0 + Math.random() * 1.5;
    radius = radius || this.HOUSE_ADOPT_RADIUS;
    const b = mob.body;
    let best = null, bestD2 = Infinity;
    for (const [key, house, p] of this.houseEntriesNear(b.x, b.y + b.h * 0.5, b.z, radius)) {
      if (!this.isHouseBlockAlive(key)) continue;
      const dx = (p[0] + 0.5) - b.x, dy = (p[1] + 0.5) - (b.y + b.h * 0.5), dz = (p[2] + 0.5) - b.z;
      if (Math.abs(dx) > radius || Math.abs(dy) > radius || Math.abs(dz) > radius) continue;
      const d2 = dx * dx + dz * dz + dy * dy * 0.35;
      if (d2 < bestD2) { bestD2 = d2; best = house; }
    }
    return !!(best && this.adopt(mob, best.id, 'adopted'));
  },
  outsideMembers(houseIdOrKey) {
    if (typeof Mobs === 'undefined') return [];
    const house = this.getHouseById(houseIdOrKey) || this.getHouseByKey(houseIdOrKey);
    const id = house ? house.id : houseIdOrKey;
    const key = house ? house.key : houseIdOrKey;
    return Mobs.list.filter(m => m && !m.dead && m.type === 'jelly' && (m.homeHouseId === id || m.jellyHome === key));
  },
  countOutsideMembers(idOrKey) { return this.outsideMembers(idOrKey).length; },

  releaseResident(houseIdOrKey, ctx = {}) {
    const house = this.getHouseById(houseIdOrKey) || this.getHouseByKey(houseIdOrKey);
    if (!house || !house.stored || !house.stored.length || typeof Mobs === 'undefined') return null;
    this.ensureStoredObjects(house);
    const p = this.splitKey(house.key); if (!p) return null;
    let spot = null;
    for (let tries = 0; tries < 10; tries++) {
      const sx = p[0] + ((Math.random() * 5) | 0) - 2, sy = p[1], sz = p[2] + ((Math.random() * 5) | 0) - 2;
      if (World.getBlock(sx, sy, sz) === B.AIR && World.getBlock(sx, sy + 1, sz) === B.AIR && Physics.solidAt(sx + 0.5, sy - 0.5, sz + 0.5)) { spot = { sx, sy, sz }; break; }
    }
    if (!spot) return null;
    const idx = (Math.random() * house.stored.length) | 0;
    const res = house.stored.splice(idx, 1)[0] || { id: this.newJellyId(), color: 'pink' };
    const m = Mobs.spawn('jelly', spot.sx + 0.5, spot.sy + 0.02, spot.sz + 0.5, null, res.color || 'pink');
    m.jellyId = res.id || this.newJellyId();
    this.adopt(m, house.id, 'released');
    if (house.playerAngerT > 0) m.angryPlayerT = Math.max(m.angryPlayerT || 0, house.playerAngerT);
    if (typeof Particles !== 'undefined') Particles.burst(spot.sx + 0.5, spot.sy + 0.65, spot.sz + 0.5, [1, 0.55, 0.9], 10, 1.8);
    return m;
  },
  enterHouse(mob, reason) {
    if (!this.canBelong(mob)) return false;
    let house = this.getHouseById(mob.homeHouseId) || this.getHouseByKey(mob.jellyHome);
    if (!house || !this.isHouseBlockAlive(house.key)) return false;
    this.ensureStoredObjects(house);
    if (house.stored.length >= this.HOUSE_MAX_STORED) return false;
    house.stored.push({ id: mob.jellyId || this.newJellyId(), color: this.validColor(mob.color), size: 'small' });
    if (typeof Particles !== 'undefined') Particles.burst(mob.body.x, mob.body.y + 0.45, mob.body.z, [1, 0.55, 0.9], 8, 1.6);
    if (typeof Mobs !== 'undefined' && Mobs.despawnSilent) Mobs.despawnSilent(mob); else mob.dead = true;
    return true;
  },
  onMergeIntoBig(jellies, bigMob) {
    for (const j of (jellies || [])) this.makeHomeless(j, 'merged');
    this.initMob(bigMob, 'merged');
  },

  onHouseBreak(key, ctx = {}) {
    // Snapshot stored residents BEFORE deleting records. Use both canonical and
    // legacy storage so existing saves from older Jelly builds do not collapse
    // to a 0-resident item when mined. Outside entities are deliberately not
    // included; they become homeless below.
    const storedBefore = this.snapshotStoredForKey(key, 'break_snapshot');
    const house = this.getHouseByKey(key);
    let stored = this.normalizeStoredResidents(storedBefore);
    if (house) {
      for (const m of this.outsideMembers(house.id)) this.makeHomeless(m, 'house_broken');
      this.deleteHouseByKey(key);
    } else if (World && World.spawners) {
      const sp = World.spawners.get(key);
      if (sp && sp.type === 'jelly_house') World.spawners.delete(key);
    }
    const itemData = this.serializeHouseItem(stored);
    this._lastBrokenHouseItem = itemData;
    this._lastBrokenHouseKey = key;
    return { itemData, stored, storedColors: stored.map(r => r.color) };
  },
  breakHouseAt(x, y, z, ctx = {}) { return this.onHouseBreak(this.keyOf(x, y, z), ctx); },

  isKnownPlayerPlacedKey(key) {
    if (typeof World === 'undefined') return false;
    // World.diffs is only written by runtime setBlock calls. Natural chunk-gen
    // blocks do not appear here. This lets orphan natural Jelly Houses repair
    // as fresh barracks, while player-placed data-less houses stay empty.
    if (World.diffs && World.diffs.has && World.diffs.has(key)) return true;
    const p = this.splitKey(key);
    if (!p || !World.diffIndex || !World.key) return false;
    const bucket = World.diffIndex.get(World.chunkKeyForBlock ? World.chunkKeyForBlock(p[0], p[2]) : World.key(Math.floor(p[0] / 16), Math.floor(p[2] / 16))); 
    return !!(bucket && bucket.has && bucket.has(key));
  },

  ensureLiveHouseRecordForKey(key, reason) {
    this.ensureStorage();
    let house = this.getHouseByKey(key);
    if (house) return house;
    const p = this.splitKey(key);
    if (!p || typeof World === 'undefined' || !World.getBlock || World.getBlock(p[0], p[1], p[2]) !== B.JELLY_HOUSE) return null;

    const legacy = this.legacyStoredForKey(key);
    if (legacy.length) return this.createHouseAt(p[0], p[1], p[2], { roster: legacy, source: reason || 'legacy_repair' });

    // Important host/singleplayer repair: chunk-generated Jelly Houses can exist
    // as real blocks even if their side record was not created/preserved. If the
    // block was never placed by the player at runtime, treat it as a natural
    // barracks and seed the normal starting residents. Do NOT do this for
    // runtime/player-placed orphan blocks, because those should not invent people.
    if (!this.isKnownPlayerPlacedKey(key)) {
      return this.createHouseAt(p[0], p[1], p[2], { seedDefault: true, source: reason || 'natural_orphan_repair' });
    }
    return this.createHouseAt(p[0], p[1], p[2], { stored: [], source: reason || 'player_orphan_empty' });
  },

  snapshotStoredForKey(key, reason) {
    this.migrateLegacySpawners();
    const house = this.ensureLiveHouseRecordForKey(key, reason || 'snapshot');
    if (house) return this.normalizeStoredResidents(house.stored);
    const legacy = this.legacyStoredForKey(key);
    return legacy.length ? legacy : [];
  },

  // Non-destructive clone of the carried-item data for an existing placed Jelly House.
  // Used by creative pick-block and any host-side code that needs to copy the
  // block without breaking it. This deliberately copies stored/inside residents
  // only; outside linked Jelly People remain active entities, not item NBT.
  itemDataForPlacedHouse(x, y, z) {
    const key = this.keyOf(x, y, z);
    const stored = this.snapshotStoredForKey(key, 'copy_existing_house');
    return this.serializeHouseItem(stored);
  },
  describeHouseAt(x, y, z) {
    this.migrateLegacySpawners();
    const key = this.keyOf(x, y, z);
    const house = this.ensureLiveHouseRecordForKey(key, 'describe') || this.getHouseByKey(key);
    if (!house) return { inside: 0, outside: 0, houseId: null };
    return { inside: Array.isArray(house.stored) ? house.stored.length : this.normalizeStoredResidents(house.stored).length, outside: this.countOutsideMembers(house.id), houseId: house.id };
  },
  panicHouseByKey(key, seconds, playerAnger) {
    const house = this.getHouseByKey(key);
    if (!house) return false;
    house.panicT = Math.max(house.panicT || 0, seconds || 8);
    if (playerAnger) house.playerAngerT = Math.max(house.playerAngerT || 0, seconds || 8);
    return true;
  },

  spawnSmallJellyAt(x, y, z, color, source) {
    if (typeof Mobs === 'undefined') return null;
    const chosen = color ? this.validColor(color) : this.colors()[(Math.random() * this.colors().length) | 0];
    const m = Mobs.spawn('jelly', x, y, z, null, chosen);
    this.initMob(m, source || 'spawned');
    this.makeHomeless(m, source || 'spawned');
    return m;
  },
  spawnBigJellyAt(x, y, z, color, source) {
    if (typeof Mobs === 'undefined') return null;
    const chosen = color ? this.validColor(color) : this.colors()[(Math.random() * this.colors().length) | 0];
    const m = Mobs.spawn('big_jelly', x, y, z, null, chosen);
    this.initMob(m, source || 'spawned');
    return m;
  },

  onChestAccess(ctx = {}) {
    const bx = Math.floor(+ctx.x), by = Math.floor(+ctx.y), bz = Math.floor(+ctx.z);
    // For normal opening, the block is still present. For breaking/explosions,
    // World.setBlock has already changed the cell to AIR before registry cleanup
    // runs, so the caller must pass wasJellyChest/oldId. Do not let that path
    // silently fail just because the block is already removed.
    const confirmedJellyChest = !!(ctx.wasJellyChest || ctx.oldId === B.JELLY_CHEST || ctx.blockId === B.JELLY_CHEST || ctx.id === B.JELLY_CHEST);
    if (typeof World === 'undefined') return false;
    if (World.getBlock(bx, by, bz) !== B.JELLY_CHEST && !confirmedJellyChest) return false;
    if (typeof Mobs === 'undefined') return false;
    let caught = false;
    for (const m of Mobs.list) {
      if (!m || m.dead || !['jelly', 'big_jelly'].includes(m.type)) continue;
      const b = m.body;
      if (Math.abs(b.x - (bx + 0.5)) <= 10 && Math.abs((b.y + b.h * 0.5) - (by + 0.5)) <= 10 && Math.abs(b.z - (bz + 0.5)) <= 10) { caught = true; break; }
    }
    if (!caught) return false;
    for (const m of Mobs.list) {
      if (!m || m.dead || !['jelly', 'big_jelly'].includes(m.type)) continue;
      const b = m.body;
      const d2 = (b.x - (bx + 0.5)) ** 2 + (b.z - (bz + 0.5)) ** 2 + ((b.y - by) ** 2) * 0.25;
      if (d2 <= 24 * 24) { m.angryPlayerT = Math.max(m.angryPlayerT || 0, m.type === 'big_jelly' ? 22 : 18); m.path = null; m.jellyIdleGoal = null; }
    }
    if (this.ensureStorage()) {
      for (const [key, house] of World.jellyHouses) {
        const p = this.splitKey(key);
        if (p && Math.abs(p[0] - bx) <= 24 && Math.abs(p[1] - by) <= 10 && Math.abs(p[2] - bz) <= 24) this.panicHouseByKey(key, 12, true);
      }
    }
    if (ctx.chat !== false && typeof UI !== 'undefined' && UI.chat) UI.chat(ctx.mode === 'break' ? 'A Jelly Person caught you breaking into their Jelly Chest!' : 'A Jelly Person caught you stealing from their Jelly Chest!', '#ff80d8');
    return true;
  },

  updateHouses(dt) {
    if (typeof World === 'undefined' || typeof Mobs === 'undefined' || typeof Player === 'undefined') return;
    this.ensureStorage(); this.migrateLegacySpawners();
    const p = Player.body;
    const nearby = this.houseEntriesNear(p.x, p.y, p.z, 24);
    if (!nearby.length) return;

    const outsideById = new Map();
    const outsideByKey = new Map();
    const hostiles = [];
    for (const m of Mobs.list) {
      if (!m || m.dead || !m.body) continue;
      if (m.type === 'jelly') {
        if (m.homeHouseId) outsideById.set(m.homeHouseId, (outsideById.get(m.homeHouseId) || 0) + 1);
        else if (m.jellyHome) outsideByKey.set(m.jellyHome, (outsideByKey.get(m.jellyHome) || 0) + 1);
      } else if (typeof HOSTILES !== 'undefined' && HOSTILES.includes(m.type)) {
        hostiles.push(m);
      }
    }

    const maxPerTick = nearby.length <= 32 ? nearby.length : 24;
    const start = (this._houseUpdateCursor || 0) % nearby.length;
    this._houseUpdateCursor = (start + maxPerTick) % nearby.length;
    for (let i = 0; i < maxPerTick; i++) {
      const [key, house, pos] = nearby[(start + i) % nearby.length];
      if (!pos || World.getBlock(pos[0], pos[1], pos[2]) !== B.JELLY_HOUSE) { this.onHouseBreak(key, { reason: 'missing_block', drop: false }); continue; }
      if (!Array.isArray(house.stored)) house.stored = this.normalizeStoredResidents(house.stored);
      house.panicT = Math.max(0, (house.panicT || 0) - dt);
      house.playerAngerT = Math.max(0, (house.playerAngerT || 0) - dt);
      const d2 = (pos[0] - p.x) ** 2 + (pos[1] - p.y) ** 2 + (pos[2] - p.z) ** 2;
      if (d2 > 22 * 22) continue;
      let conflict = house.panicT > 0;
      for (const m of hostiles) {
        const mb = m.body;
        const md2 = (mb.x - (pos[0] + 0.5)) ** 2 + (mb.z - (pos[2] + 0.5)) ** 2 + ((mb.y - pos[1]) ** 2) * 0.25;
        if (md2 < 12 * 12) { conflict = true; break; }
      }
      if (!conflict && d2 < 2 * 2) continue;
      house.cd = (house.cd || 1) - 1;
      if (house.cd > 0) continue;
      house.cd = conflict ? 1.0 : (5 + Math.random() * 5);
      const outside = (outsideById.get(house.id) || 0) + (outsideByKey.get(house.key) || 0);
      if (house.stored.length <= 0 || outside >= (conflict ? 5 : 2)) continue;
      if (!conflict && Math.random() < 0.45) continue;
      this.releaseResident(house.id, { reason: conflict ? 'panic' : 'ambient' });
    }
  },

  validateWorldState() {
    if (!this.ensureStorage()) return [];
    const problems = [];
    for (const [key, h] of World.jellyHouses) {
      if (!this.isHouseBlockAlive(key)) problems.push('House record without block: ' + key);
      const ids = new Set();
      for (const r of h.stored || []) {
        if (ids.has(r.id)) problems.push('Duplicate stored Jelly id in house ' + key);
        ids.add(r.id);
        if (r.size && r.size !== 'small') problems.push('Big/non-small stored in house ' + key);
      }
    }
    if (typeof Mobs !== 'undefined') {
      for (const m of Mobs.list) {
        if (!m || m.dead || m.type !== 'jelly') continue;
        if (m.homeHouseId && !this.getHouseById(m.homeHouseId)) problems.push('Jelly has missing house id ' + m.homeHouseId);
        if (m.fromSpawner) problems.push('Jelly still uses fromSpawner for house state');
      }
    }
    return problems;
  },
};
