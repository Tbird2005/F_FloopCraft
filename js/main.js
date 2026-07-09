// ============================================================
// F_Floop Craft — bootstrap, main menu, day/night, world systems
// ============================================================
const Game = {
  scene: null, camera: null, renderer: null,
  locked: false, started: false, loading: false, inWorld: false,
  time: 0, dayLen: 480, isNight: false, wasNight: false, dayCount: 1,
  humbugAnnounced: false,
  stocks: { price: 100, hist: [100], shares: 0 },
  sun: null, moon: null, stars: null, dirLight: null, ambLight: null,
  clock: null,
  debugChunkBorders: false, chunkBorderMesh: null, chunkBorderKey: '',
  pendingSave: null,
  stockT: 0, sapT: 0, cropT: 0, grassT: 0, saveT: 0, furnaceLitSync: 0, sleepLock: 0,
  cinematicPlaying: false, cinematicEndCb: null,
  menuMode: 'home', optionsReturn: 'main',
  suppressPauseUntil: 0,
  options: { mouseSensitivity: 1, masterVolume: 70, sfxVolume: 100, musicVolume: 70, autoSprint: false },

  skyDay: new THREE.Color(0x87ceeb),
  skyNight: new THREE.Color(0x070b1d),
  skySunset: new THREE.Color(0xff9a56),
  skyStorm: new THREE.Color(0x4a5568),
  skyColor: new THREE.Color(0x87ceeb),

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 700);
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    document.getElementById('gameContainer').appendChild(this.renderer.domElement);
    this.scene.add(this.camera);

    this.scene.fog = new THREE.Fog(0x87ceeb, 60, 110);
    // scene lights only affect entities now — chunk light is baked voxel light
    this.ambLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambLight);
    this.dirLight = new THREE.DirectionalLight(0xfff4d6, 0.9);
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    const mkDisc = (color, size) => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      const c = cv.getContext('2d');
      c.fillStyle = color;
      c.fillRect(8, 8, 48, 48);
      const tex = new THREE.CanvasTexture(cv);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false })
      );
      m.renderOrder = -10;
      return m;
    };
    this.sun = mkDisc('#fff3a0', 60);
    this.moon = mkDisc('#e8ecf5', 40);
    this.scene.add(this.sun, this.moon);

    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(450 * 3);
    for (let i = 0; i < 450; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.9 + 0.08, (Math.random() - 0.5)).normalize().multiplyScalar(420);
      starPos[i * 3] = v.x; starPos[i * 3 + 1] = v.y; starPos[i * 3 + 2] = v.z;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
    }));
    this.scene.add(this.stars);

    Atlas.build();
    UI.init();
    if (typeof Multiplayer !== 'undefined' && Multiplayer.init) Multiplayer.init();
    this.loadOptions();
    this.wireMenu();
    this.wirePointerLock();

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    addEventListener('pagehide', () => { if (this.inWorld && World.ready) Save.saveCurrent({ auto: true }); });

    this.clock = performance.now();
    requestAnimationFrame(() => this.frame());

    // Host keepalive: browsers throttle/stop requestAnimationFrame on a hidden tab,
    // which would freeze the authoritative world for every connected client. When the
    // host's tab is backgrounded, drive the essential simulation from a timer instead
    // (timers still fire, ~1s throttled, when hidden). Only runs while hidden+hosting,
    // so it never double-simulates alongside the visible-tab rAF loop.
    this.hostKeepClock = performance.now();
    setInterval(() => this.hostHiddenTick(), 200);
  },

  hostHiddenTick() {
    if (!document.hidden) { this.hostKeepClock = performance.now(); return; }
    const mpHost = typeof Multiplayer !== 'undefined' && Multiplayer.role === 'host' && Multiplayer.connected;
    if (!mpHost || !this.inWorld || this.loading || !this.started || !World.ready) { this.hostKeepClock = performance.now(); return; }
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.hostKeepClock) / 1000);
    this.hostKeepClock = now;
    const p = Player.body;
    // authoritative world + entity simulation (skip local Player input; the host isn't
    // moving while unfocused, and rendering is pointless on a hidden tab)
    World.update(p.x, p.z, 1, p.y);
    Water.update(dt); Lava.update(dt);
    Drops.update(dt); Mobs.update(dt);
    Vehicles.update(dt); Vehicles.updateBoard(dt);
    Guns.update(dt); Dynamics.update(dt);
    if (typeof Dimensions !== 'undefined') Dimensions.update(dt);
    if (typeof Multiplayer !== 'undefined') Multiplayer.update(dt);
    this.updateFurnaces(dt); this.updateSaplings(dt); this.updateCrops(dt); this.updateGrassSpread(dt);
    this.updateDayNight(dt);
  },


  // ---------------- options / menu helpers ----------------
  loadOptions() {
    try {
      const raw = JSON.parse(localStorage.getItem('ffc_options') || '{}');
      const num = (v, fallback, min, max) => Number.isFinite(+v) ? Math.max(min, Math.min(max, +v)) : fallback;
      this.options.mouseSensitivity = num(raw.mouseSensitivity, 1, 0.25, 2.5);
      this.options.masterVolume = num(raw.masterVolume, 70, 0, 100);
      this.options.sfxVolume = num(raw.sfxVolume, 100, 0, 100);
      this.options.musicVolume = num(raw.musicVolume, 70, 0, 100);
      this.options.autoSprint = !!raw.autoSprint;
    } catch (e) { /* bad options get ignored */ }
    this.applyOptions(false);
  },

  saveOptions() {
    try { localStorage.setItem('ffc_options', JSON.stringify(this.options)); } catch (e) {}
  },

  applyOptions(save = true) {
    if (typeof SFX !== 'undefined' && SFX.setVolumes) {
      SFX.setVolumes({
        master: this.options.masterVolume / 100,
        sfx: this.options.sfxVolume / 100,
        music: this.options.musicVolume / 100,
      });
    }
    const vid = document.getElementById('sleepCutsceneVideo');
    if (vid) {
      const v = Math.max(0, Math.min(1, (this.options.masterVolume / 100) * (this.options.musicVolume / 100)));
      vid.volume = v;
      vid.muted = v <= 0;
    }
    this.syncOptionControls();
    if (save) this.saveOptions();
  },

  syncOptionControls() {
    const bind = (id, val, label) => {
      const el = document.getElementById(id);
      const out = document.getElementById(id + 'Val');
      if (!el) return;
      el.value = val;
      if (out) out.textContent = label;
    };
    bind('optMouseSensitivity', this.options.mouseSensitivity, this.options.mouseSensitivity.toFixed(2) + 'x');
    bind('optMasterVolume', this.options.masterVolume, Math.round(this.options.masterVolume) + '%');
    bind('optSfxVolume', this.options.sfxVolume, Math.round(this.options.sfxVolume) + '%');
    bind('optMusicVolume', this.options.musicVolume, Math.round(this.options.musicVolume) + '%');
    const auto = document.getElementById('optAutoSprint');
    if (auto) auto.checked = !!this.options.autoSprint;
  },

  showMainScreen(name) {
    this.menuMode = name;
    const home = document.getElementById('menuHome');
    const saves = document.getElementById('savesMenu');
    const multi = document.getElementById('multiplayerMenu');
    if (home) home.classList.toggle('hidden', name !== 'home');
    if (saves) saves.classList.toggle('hidden', name !== 'saves');
    if (multi) multi.classList.toggle('hidden', name !== 'multiplayer');
    if (name === 'saves') this.refreshWorldList();
    if (name === 'multiplayer' && typeof Multiplayer !== 'undefined') Multiplayer.updatePauseCode();
  },

  openOptionsMenu(from) {
    this.optionsReturn = from || (this.inWorld ? 'pause' : 'main');
    this.syncOptionControls();
    const ov = document.getElementById('optionsOverlay');
    if (ov) ov.classList.remove('hidden');
    if (this.optionsReturn === 'pause') this.hidePauseMenu();
  },

  closeOptionsMenu() {
    const ov = document.getElementById('optionsOverlay');
    if (ov) ov.classList.add('hidden');
    if (this.optionsReturn === 'pause' && this.inWorld && !this.locked) this.showPauseMenu();
    this.optionsReturn = 'main';
  },

  suppressPauseFor(ms = 600) {
    this.suppressPauseUntil = Math.max(this.suppressPauseUntil || 0, performance.now() + ms);
  },

  pauseSuppressed() {
    return performance.now() < (this.suppressPauseUntil || 0);
  },

  showPauseMenu() {
    if (!this.inWorld || this.loading || this.cinematicPlaying || this.pauseSuppressed()) return;
    const ov = document.getElementById('pauseOverlay');
    if (ov) ov.classList.remove('hidden');
  },

  hidePauseMenu() {
    const ov = document.getElementById('pauseOverlay');
    if (ov) ov.classList.add('hidden');
  },

  pauseMenuVisible() {
    const ov = document.getElementById('pauseOverlay');
    return !!(ov && !ov.classList.contains('hidden'));
  },

  resumeGame() {
    if (this.loading || !this.inWorld) return;
    SFX.init();
    this.hidePauseMenu();
    this.requestLock();
  },

  quitGame() {
    try { window.open('', '_self'); } catch (e) {}
    window.close();
    setTimeout(() => {
      const foot = document.getElementById('menuFoot');
      if (foot) foot.textContent = 'Your browser blocked tab closing. Close this tab normally.';
    }, 120);
  },

  // ---------------- main menu ----------------
  wireMenu() {
    this.showMainScreen('home');

    const on = (id, ev, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(ev, fn);
    };

    on('openSavesBtn', 'click', () => this.showMainScreen('saves'));
    on('openMultiplayerBtn', 'click', () => this.showMainScreen('multiplayer'));
    on('multiplayerBackBtn', 'click', () => this.showMainScreen('home'));
    on('mpJoinBtn', 'click', () => { if (typeof Multiplayer !== 'undefined') Multiplayer.joinFromMenu(); });
    on('mpCodeInput', 'input', () => {
      const el = document.getElementById('mpCodeInput');
      if (el && typeof Multiplayer !== 'undefined') el.value = Multiplayer.cleanCode(el.value);
    });
    on('mpCodeInput', 'keydown', (e) => { if (e.key === 'Enter' && typeof Multiplayer !== 'undefined') Multiplayer.joinFromMenu(); });
    on('savesBackBtn', 'click', () => this.showMainScreen('home'));
    on('mainOptionsBtn', 'click', () => this.openOptionsMenu('main'));
    on('pauseOptionsBtn', 'click', (e) => { e.stopPropagation(); this.openOptionsMenu('pause'); });
    on('optionsBackBtn', 'click', () => this.closeOptionsMenu());
    on('resumeGameBtn', 'click', (e) => { e.stopPropagation(); this.resumeGame(); });
    on('quitGameBtn', 'click', () => this.quitGame());
    on('backToMainBtn', 'click', (e) => {
      e.stopPropagation();
      if (World.ready) Save.saveCurrent({ force: true });
      location.reload();
    });

    on('createWorldBtn', 'click', () => {
      const name = document.getElementById('worldName').value.trim() || 'Floop World ' + (Save.listWorlds().length + 1);
      const seedStr = document.getElementById('worldSeed').value.trim();
      const w = Save.createWorld(name, seedStr);
      if (typeof Multiplayer !== 'undefined') Multiplayer.hostStarting();
      SFX.init();
      this.started = true;
      this.startWorld(w.seed, null);
      this.requestLock();
    });

    for (const id of ['optMouseSensitivity', 'optMasterVolume', 'optSfxVolume', 'optMusicVolume']) {
      on(id, 'input', () => {
        this.options.mouseSensitivity = +document.getElementById('optMouseSensitivity').value;
        this.options.masterVolume = +document.getElementById('optMasterVolume').value;
        this.options.sfxVolume = +document.getElementById('optSfxVolume').value;
        this.options.musicVolume = +document.getElementById('optMusicVolume').value;
        this.applyOptions(true);
      });
    }
    on('optAutoSprint', 'change', () => {
      this.options.autoSprint = !!document.getElementById('optAutoSprint').checked;
      this.applyOptions(true);
    });
  },

  refreshWorldList() {
    const list = document.getElementById('worldList');
    list.innerHTML = '';
    const worlds = Save.listWorlds();
    if (!worlds.length) {
      list.innerHTML = '<div class="emptyWorlds">No worlds yet. Every journey begins with a single "brrr brrr patapim".</div>';
      return;
    }
    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'worldRow';
      const info = document.createElement('div');
      info.className = 'winfo';
      info.innerHTML = `<b>${w.name.replace(/</g, '&lt;')}</b><br><span>Day ${w.day || 1} · seed ${w.seed} · ${new Date(w.ts).toLocaleDateString()}</span>`;
      const play = document.createElement('button');
      play.className = 'uibtn wplay';
      play.textContent = 'Play';
      play.addEventListener('click', () => {
        const data = Save.loadWorld(w.id);
        Save.currentId = w.id;
        if (typeof Multiplayer !== 'undefined') Multiplayer.hostStarting();
        SFX.init();
        this.started = true;
        this.startWorld(data ? data.seed : w.seed, data);
        this.requestLock();
      });
      const del = document.createElement('button');
      del.className = 'uibtn wdel';
      del.textContent = '✕';
      del.title = 'Delete world';
      del.addEventListener('click', () => {
        if (confirm('Delete "' + w.name + '" forever? Mr Floop will remember this.')) {
          Save.deleteWorld(w.id);
          this.refreshWorldList();
        }
      });
      row.appendChild(info); row.appendChild(play); row.appendChild(del);
      list.appendChild(row);
    }
  },

  // ---------------- world lifecycle ----------------
  startWorld(seed, saveData, opts) {
    opts = opts || {};
    const multiplayerClient = opts.multiplayerRole === 'client';
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');

    World.init(this.scene, seed);
    if (!saveData && typeof Dimensions !== 'undefined') {
      Dimensions.current = 'overworld';
      Dimensions.data = { overworld: Dimensions.emptyState('overworld') };
      Dimensions.returnPortal = null;
      World.dimensionId = 'overworld';
    }
    Particles.init(this.scene);
    Drops.init(this.scene);
    Mobs.init(this.scene);
    Vehicles.init(this.scene);
    Guns.init(this.scene);
    Dynamics.init(this.scene);

    this.time = this.dayLen * 0.06;
    this.dayCount = 1;
    this.stocks = { price: 100, hist: [100], shares: 0 };
    Player.loadedFromSave = false;
    if (saveData) Save.applyWorldData(saveData);
    this.pendingSave = saveData || null;

    let spawnPos = null;
    if (saveData && !multiplayerClient) spawnPos = Save.applyPlayerData(saveData);
    const spawn = Player.loadedFromSave && Player.spawn ? Player.spawn : World.findSpawn();
    if (!Player.loadedFromSave) Player.spawn = spawn;
    Player.init(this.camera, spawn);
    if (spawnPos) {
      Player.body.x = spawnPos.x; Player.body.y = spawnPos.y + 0.1; Player.body.z = spawnPos.z;
    } else if (multiplayerClient && saveData && saveData.hostPlayer) {
      const hp = saveData.hostPlayer;
      Player.body.x = (+hp.x || spawn.x) + 1.2;
      Player.body.y = (+hp.y || spawn.y) + 0.1;
      Player.body.z = (+hp.z || spawn.z) + 1.2;
    }
    this.warmupRuntimeAssets();

    this.updateDayNight(0);
    this.loading = true;
    this.inWorld = true;
  },

  disposeWarmupObject(obj) {
    if (!obj) return;
    obj.traverse(o => {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) {
        if (m.map && m.map.dispose) m.map.dispose();
        if (m.dispose) m.dispose();
      }
    });
  },

  warmupRuntimeAssets() {
    if (this._runtimeWarmed || !this.renderer || !this.scene || !this.camera || typeof Vehicles === 'undefined') return;
    this._runtimeWarmed = true;
    const temps = [];
    try {
      const built = [
        Vehicles.buildCarMesh && Vehicles.buildCarMesh(),
        Vehicles.buildSuperCarMesh && Vehicles.buildSuperCarMesh(),
        Vehicles.buildPlaneMesh && Vehicles.buildPlaneMesh(),
        Vehicles.buildBoatMesh && Vehicles.buildBoatMesh(false),
        Vehicles.buildBoatMesh && Vehicles.buildBoatMesh(true),
        Vehicles.buildBoardMesh && { group: Vehicles.buildBoardMesh() },
      ].filter(Boolean);
      for (const entry of built) {
        const group = entry.group || entry;
        if (!group) continue;
        group.visible = false;
        group.position.set(0, -9999, 0);
        this.scene.add(group);
        temps.push(group);
      }
      if (this.renderer.compile) this.renderer.compile(this.scene, this.camera);
    } catch (e) {
      console.warn('Warmup skipped:', e);
    } finally {
      for (const obj of temps) {
        this.scene.remove(obj);
        this.disposeWarmupObject(obj);
      }
    }
  },

  finishLoading() {
    this.loading = false;
    document.getElementById('loading').classList.add('hidden');
    this.hidePauseMenu();
    this.suppressPauseAfterLoad = false;
    World.ready = true;
    if (this.pendingSave) {
      Save.applyEntityData(this.pendingSave);
      this.pendingSave = null;
    }
    // never wake up inside a wall (stale autosaves could strand you in terrain)
    const b = Player.body;
    const stuck = () => Physics.boxHit(b.x - b.w, b.y + 0.05, b.z - b.w, b.x + b.w, b.y + b.h, b.z + b.w);
    if (stuck()) {
      let freed = false;
      for (let up = 1; up <= 12 && !freed; up++) {
        b.y += 1;
        if (!stuck()) freed = true;
      }
      if (!freed) {
        const sp = World.findSpawn();
        b.x = sp.x; b.y = sp.y; b.z = sp.z;
      }
      b.vx = b.vy = b.vz = 0;
      UI.chat('You were stuck in a wall, so we dug you out. Merry Christmas.', '#ffd97a');
    }
    UI.updateHotbar(); UI.updateStats(); UI.updateXp(); UI.updateModeLabel();
    if (!this.started) this.started = true;
    UI.chat('Welcome to F_Floop Craft v 1.0.49!', '#ffd700');
    if (typeof Multiplayer !== 'undefined') {
      if (Multiplayer.role === 'host') Multiplayer.finishHostWorld();
      Multiplayer.updatePauseCode();
    }
    this.requestLock();
    setTimeout(() => {
      if (this.inWorld && !this.loading && !this.locked && !UI.anyOpen() && !UI.chatOpen) this.showPauseMenu();
    }, 250);
  },

  wirePointerLock() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        this.toggleChunkBorders();
        return;
      }
      if (e.code !== 'Escape') return;
      // First Esc still lets the browser leave pointer lock and pause the game.
      // When the pause menu is already open, Esc acts like Resume.
      if (!this.locked && this.pauseMenuVisible() && !UI.anyOpen() && !UI.chatOpen && this.inWorld && !this.loading && !this.cinematicPlaying) {
        e.preventDefault();
        e.stopPropagation();
        // Some browsers fire pointerlockchange/pointerlockerror right after Esc.
        // Without a short guard, the same Esc press can hide the pause menu,
        // fail/release pointer lock, then immediately show the pause menu again.
        this.suppressPauseFor(750);
        this.resumeGame();
      }
    }, true);

    const pauseOv = document.getElementById('pauseOverlay');
    if (pauseOv) {
      pauseOv.addEventListener('click', (e) => {
        // The pause screen is no longer a giant click-to-play button.
        // Only the actual Resume button should return to the game.
        e.stopPropagation();
      });
    }
    this.renderer.domElement.addEventListener('click', () => {
      if (this.inWorld && !this.loading && !this.locked && !UI.anyOpen() && !UI.chatOpen && !this.cinematicPlaying) {
        this.resumeGame();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement != null;
      if (this.locked) {
        this.hidePauseMenu();
      } else if (this.pauseSuppressed()) {
        this.hidePauseMenu();
      } else if (!UI.anyOpen() && !UI.chatOpen && this.started && this.inWorld && !this.loading && !this.cinematicPlaying) {
        this.showPauseMenu();
      }
    });
    document.addEventListener('pointerlockerror', () => {
      if (this.pauseSuppressed()) {
        this.hidePauseMenu();
        return;
      }
      if (!UI.anyOpen() && this.inWorld && !this.loading && !this.locked) this.showPauseMenu();
    });
  },

  toggleChunkBorders() {
    this.debugChunkBorders = !this.debugChunkBorders;
    this.chunkBorderKey = '';
    if (!this.debugChunkBorders && this.chunkBorderMesh) this.chunkBorderMesh.visible = false;
    if (this.debugChunkBorders) this.updateChunkBorders(true);
    if (typeof UI !== 'undefined') UI.chat('Chunk borders ' + (this.debugChunkBorders ? 'shown' : 'hidden') + ' (16x16x16 layers).', '#7df5ec');
  },

  ensureChunkBorderMesh() {
    if (this.chunkBorderMesh) return this.chunkBorderMesh;
    this.chunkBorderMesh = new THREE.Group();
    this.chunkBorderMesh.renderOrder = 9999;
    this.chunkBorderMesh.visible = false;
    this.scene.add(this.chunkBorderMesh);
    return this.chunkBorderMesh;
  },

  updateChunkBorders(force) {
    if (!this.debugChunkBorders || !this.inWorld || !World || !Player || !Player.body) {
      if (this.chunkBorderMesh) this.chunkBorderMesh.visible = false;
      return;
    }
    const p = Player.body;
    const cx = Math.floor(p.x) >> 4;
    const cy = Math.floor(p.y / 16);
    const cz = Math.floor(p.z) >> 4;
    const key = cx + ',' + cy + ',' + cz;
    const mesh = this.ensureChunkBorderMesh();
    mesh.visible = true;
    if (!force && key === this.chunkBorderKey) return;
    this.chunkBorderKey = key;

    while (mesh.children.length) {
      const ch = mesh.children[0];
      mesh.remove(ch);
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) ch.material.dispose();
    }

    const faceOther = [], lineOther = [], faceCurrent = [], lineCurrent = [];
    const pushTri = (arr, a, b, c) => arr.push(...a, ...b, ...c);
    const addLine = (arr, a, b) => arr.push(...a, ...b);
    const addFace = (faceArr, lineArr, quad) => {
      pushTri(faceArr, quad[0], quad[1], quad[2]);
      pushTri(faceArr, quad[0], quad[2], quad[3]);
      const constAxis = [0, 1, 2].find(i => quad.every(v => Math.abs(v[i] - quad[0][i]) < 0.0001));
      if (constAxis === undefined) return;
      const axes = [0, 1, 2].filter(i => i !== constAxis);
      const u = axes[0], v = axes[1], fixed = quad[0][constAxis];
      const uVals = quad.map(p => p[u]), vVals = quad.map(p => p[v]);
      const u0 = Math.min(...uVals), u1 = Math.max(...uVals);
      const v0 = Math.min(...vVals), v1 = Math.max(...vVals);
      const pt = (uu, vv) => {
        const p3 = [0, 0, 0];
        p3[constAxis] = fixed; p3[u] = uu; p3[v] = vv;
        return p3;
      };
      for (let uu = Math.ceil(u0); uu <= Math.floor(u1); uu++) addLine(lineArr, pt(uu, v0), pt(uu, v1));
      for (let vv = Math.ceil(v0); vv <= Math.floor(v1); vv++) addLine(lineArr, pt(u0, vv), pt(u1, vv));
    };
    const box = (x0, y0, z0, x1, y1, z1, current) => {
      const f = current ? faceCurrent : faceOther;
      const l = current ? lineCurrent : lineOther;
      addFace(f, l, [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]);
      addFace(f, l, [[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]]);
      addFace(f, l, [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]]);
      addFace(f, l, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
      addFace(f, l, [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]]);
      addFace(f, l, [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]]);
    };
    const yMinLayer = cy - 2;
    const yMaxLayer = cy + 2;
    for (let gx = cx - 2; gx <= cx + 2; gx++) {
      for (let gz = cz - 2; gz <= cz + 2; gz++) {
        for (let gy = yMinLayer; gy <= yMaxLayer; gy++) {
          const x0 = gx * 16, z0 = gz * 16, y0 = gy * 16;
          box(x0, y0, z0, x0 + 16, y0 + 16, z0 + 16, gx === cx && gy === cy && gz === cz);
        }
      }
    }
    const addBuffers = (faceArr, lineArr, faceColor, lineColor, faceOpacity, lineOpacity) => {
      if (faceArr.length) {
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.Float32BufferAttribute(faceArr, 3));
        const fm = new THREE.MeshBasicMaterial({ color: faceColor, transparent: true, opacity: faceOpacity, side: THREE.DoubleSide, depthTest: true, depthWrite: false, fog: false });
        const fmsh = new THREE.Mesh(fg, fm);
        fmsh.renderOrder = 9997;
        mesh.add(fmsh);
      }
      if (lineArr.length) {
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(lineArr, 3));
        const lm = new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: lineOpacity, depthTest: true, depthWrite: false, fog: false });
        const lines = new THREE.LineSegments(lg, lm);
        lines.renderOrder = 9998;
        mesh.add(lines);
      }
    };
    addBuffers(faceOther, lineOther, 0x1b8cff, 0x57d8ff, 0.035, 0.28);
    addBuffers(faceCurrent, lineCurrent, 0xffe45c, 0xffff66, 0.14, 0.95);
  },

  requestLock() {
    const el = this.renderer.domElement;
    try {
      const r = el.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* cooldown */ }
  },

  // ---------------- sleep ----------------
  finishSleep(toNight, spawnSet, afterFadeOut) {
    const overlay = document.getElementById('sleepOverlay');
    const frac = this.time / this.dayLen;
    if (toNight) {
      const t = frac - Math.floor(frac);
      this.time += (t < 0.55 ? (0.55 - t) : (1 - t + 0.55)) * this.dayLen;
      UI.chat('You skip the daylight. The stars say hello.' + (spawnSet ? ' Spawn point set.' : ''), '#aac6ff');
    } else {
      this.time = (Math.floor(frac) + 1) * this.dayLen + this.dayLen * 0.02;
      UI.chat('You sleep through the night. Merry morning!' + (spawnSet ? ' Spawn point set.' : ''), '#ffd97a');
      if (typeof Dynamics !== 'undefined' && Dynamics.clearSleepEvents) Dynamics.clearSleepEvents();
    }
    overlay.style.opacity = 0;
    if (typeof afterFadeOut === 'function') {
      setTimeout(() => afterFadeOut(), 900);
    }
  },

  clearCinematicInput() {
    if (typeof Player === 'undefined') return;
    Player.keys = {};
    Player.lmb = false;
    Player.rmb = false;
    Player.rmbFresh = false;
    Player.mining = false;
    Player.mineTarget = null;
    Player.mineProgress = 0;
    Player.swingIntentT = 0;
    Player.swingLoopT = 0;
  },

  endSleepCinematicHold() {
    this.cinematicPlaying = false;
    this.cinematicEndCb = null;
    this.clearCinematicInput();
  },

  canDreamRewardSitOn(id) {
    if (typeof Reg === 'undefined' || typeof Physics === 'undefined' || typeof isFluid === 'undefined') return false;
    const def = Reg[id];
    if (!def || !def.block || !def.solid || def.replaceable || isFluid(id)) return false;
    // Keep the dream reward on normal sturdy surfaces instead of half-height beds, plants, doors, fluids, etc.
    return def.shape === 'cube' || def.shape === 'dslab' || def.shape === 'mega';
  },

  findDreamRewardSpot(bedHit, rewardId) {
    if (typeof World === 'undefined' || typeof Physics === 'undefined' || typeof B === 'undefined') return null;
    const cx = Math.floor(bedHit && Number.isFinite(bedHit.bx) ? bedHit.bx : Player.body.x);
    const cy = Math.floor(bedHit && Number.isFinite(bedHit.by) ? bedHit.by : Player.body.y);
    const cz = Math.floor(bedHit && Number.isFinite(bedHit.bz) ? bedHit.bz : Player.body.z);
    const radius = 10;
    const spots = [];

    for (let y = Math.max(1, cy - radius); y <= Math.min(World.H - 1, cy + radius); y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        for (let z = cz - radius; z <= cz + radius; z++) {
          if (World.hasChunk && !World.hasChunk(x, z)) continue;
          if (World.getBlock(x, y, z) !== B.AIR) continue;

          const supportId = World.getBlock(x, y - 1, z);
          if (!this.canDreamRewardSitOn(supportId)) continue;
          if (!Physics.blockBoxes(supportId, x, y - 1, z)) continue;
          if (Player && Player.body && Physics.placementBlocked(rewardId, x, y, z, Player.body)) continue;

          const dx = x - cx, dy = y - cy, dz = z - cz;
          spots.push({ x, y, z, score: dx * dx + dy * dy + dz * dz, flat: dx * dx + dz * dz });
        }
      }
    }

    spots.sort((a, b) => (a.score - b.score) || (a.flat - b.flat) || (a.y - b.y));
    return spots[0] || null;
  },

  rewardSleepCutscene(bedHit) {
    if (typeof Player === 'undefined' || typeof B === 'undefined') return;
    const rewardId = B.MR_FLOOP_DRINKING_WATER;
    if (!rewardId) return;

    const leftover = Player.addItem(rewardId, 1);
    if (leftover <= 0) {
      if (typeof UI !== 'undefined') UI.chat('You got a Mr Floop Drinking Water block from the dream.', '#7df5ec');
      return;
    }

    const spot = this.findDreamRewardSpot(bedHit, rewardId);
    if (spot && typeof World !== 'undefined') {
      World.setBlock(spot.x, spot.y, spot.z, rewardId);
      if (typeof UI !== 'undefined') UI.chat('A Mr Floop Drinking Water block has spawned nearby due to the dream.', '#7df5ec');
      return;
    }

    // Last-resort safety fallback if the bed is buried or no loaded safe block exists nearby.
    if (typeof Drops !== 'undefined') Drops.spawn(Player.body.x, Player.body.y + 1.0, Player.body.z, rewardId, leftover);
    if (typeof UI !== 'undefined') UI.chat('A Mr Floop Drinking Water block could not find a nearby block, so it dropped by you.', '#7df5ec');
  },

  playSleepCutscene(onDone, onFail) {
    const ov = document.getElementById('cinematicOverlay');
    const vid = document.getElementById('sleepCutsceneVideo');
    if (!ov || !vid) {
      if (typeof onFail === 'function') onFail();
      else onDone();
      return false;
    }

    this.cinematicPlaying = true;
    this.cinematicEndCb = onDone;
    this.clearCinematicInput();

    ov.classList.remove('hidden');
    vid.controls = false;
    vid.disablePictureInPicture = true;
    vid.controlsList = 'nodownload noplaybackrate noremoteplayback';
    vid.pause();
    try { vid.currentTime = 0; } catch (e) {}

    const done = () => {
      vid.removeEventListener('ended', done);
      vid.removeEventListener('error', fail);
      vid.pause();
      ov.classList.add('hidden');
      this.clearCinematicInput();
      onDone();
    };
    const fail = () => {
      vid.removeEventListener('ended', done);
      vid.removeEventListener('error', fail);
      ov.classList.add('hidden');
      this.clearCinematicInput();
      if (typeof onFail === 'function') onFail();
      else onDone();
    };
    vid.addEventListener('ended', done, { once: true });
    vid.addEventListener('error', fail, { once: true });

    const playPromise = vid.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(() => {
        // If the browser blocks video playback for any reason, fall back to normal sleep.
        fail();
      });
    }
    return true;
  },


  trySleep(toNight, hit) {
    if (this.sleepLock > 0 || this.cinematicPlaying) return;
    // Multiplayer: only the host can sleep to skip the night (keeps it simple for now).
    if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client') {
      UI.chat('Only the host can sleep in multiplayer.', '#ff8080'); return;
    }
    const stormSleep = !toNight && typeof Dynamics !== 'undefined' && Dynamics.weather === 'thunder';
    if (!toNight && !this.isNight && !stormSleep) { UI.chat('You can only sleep at night or during thunderstorms. The sun disapproves.', '#ff8080'); return; }
    if (toNight && this.isNight) { UI.chat('The SunBed only works in daylight. It runs on sun. Obviously.', '#ff8080'); return; }
    this.sleepLock = 3;

    let spawnSet = false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
      const sx = hit.bx + dx, sz = hit.bz + dz;
      const feet = World.getBlock(sx, hit.by, sz);
      const head = World.getBlock(sx, hit.by + 1, sz);
      const floor = Physics.blockBoxes(World.getBlock(sx, hit.by - 1, sz), sx, hit.by - 1, sz);
      if (!Physics.blockBoxes(feet, sx, hit.by, sz) && !Physics.blockBoxes(head, sx, hit.by + 1, sz) && floor) {
        Player.spawn = { x: sx + 0.5, y: hit.by + 0.02, z: sz + 0.5, dim: (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld') };
        spawnSet = true;
        break;
      }
    }

    const overlay = document.getElementById('sleepOverlay');
    overlay.style.opacity = 1;
    SFX.sleep();

    // Normal red bed only: 10% chance to play the full unskippable movie.
    // Sequence: fade fully black -> play movie -> fade back in -> then give the reward.
    if (!toNight && Math.random() < 0.10) {
      this.cinematicPlaying = true;
      this.clearCinematicInput();
      setTimeout(() => {
        this.playSleepCutscene(
          () => this.finishSleep(toNight, spawnSet, () => {
            this.rewardSleepCutscene(hit);
            this.endSleepCinematicHold();
          }),
          () => this.finishSleep(toNight, spawnSet, () => this.endSleepCinematicHold())
        );
      }, 900);
      return;
    }

    setTimeout(() => this.finishSleep(toNight, spawnSet), 900);
  },

  // ---------------- world systems ----------------
  updateFurnaces(dt) {
    for (const [key, f] of World.furnaces) {
      const result = f.in ? Recipes.smelting[f.in.id] : null;
      const canSmelt = !!result && (!f.out || (f.out.id === result.out && f.out.count < Reg[result.out].stack));

      if (f.burn <= 0 && canSmelt && f.fuel && Recipes.fuel[f.fuel.id]) {
        f.burnMax = f.burn = Recipes.fuel[f.fuel.id];
        const wasLavaBucket = f.fuel.id === I.LAVA_BUCKET;
        f.fuel.count--;
        if (f.fuel.count <= 0) f.fuel = wasLavaBucket ? { id: I.BUCKET, count: 1 } : null;
        SFX.furnace();
      }
      if (f.burn > 0) {
        f.burn -= dt;
        if (canSmelt) {
          f.cook += dt;
          if (f.cook >= Recipes.SMELT_TIME) {
            f.cook = 0;
            if (f.out) f.out.count += result.count;
            else f.out = { id: result.out, count: result.count };
            f.in.count--;
            if (f.in.count <= 0) f.in = null;
          }
        } else {
          f.cook = Math.max(0, f.cook - dt * 2);
        }
      } else {
        f.cook = Math.max(0, f.cook - dt * 2);
      }
    }
    this.furnaceLitSync -= dt;
    if (this.furnaceLitSync <= 0) {
      this.furnaceLitSync = 0.5;
      for (const [key, f] of World.furnaces) {
        const [x, y, z] = key.split(',').map(Number);
        const cur = World.getBlock(x, y, z);
        if (cur !== B.FURNACE && cur !== B.FURNACE_LIT) continue;
        const want = f.burn > 0 ? B.FURNACE_LIT : B.FURNACE;
        if (cur !== want) World.setBlock(x, y, z, want, { noUpdate: true });
      }
    }
  },

  updateSaplings(dt) {
    this.sapT -= dt;
    if (this.sapT > 0) return;
    this.sapT = 1.2;
    const p = Player.body;
    for (const [key, s] of [...World.saplings]) {
      const [x, y, z] = key.split(',').map(Number);
      if (Math.abs(x - p.x) > 64 || Math.abs(z - p.z) > 64 || !World.hasChunk(x, z)) continue;
      if (World.getBlock(x, y, z) !== s.id) { World.saplings.delete(key); continue; }
      s.t -= 1.2;
      if (s.t <= 0) {
        World.saplings.delete(key);
        if (!World.growTree(x, y, z, s.id)) {
          World.saplings.set(key, s);
          s.t = 15;
        } else {
          Particles.burst(x + 0.5, y + 1, z + 0.5, [0.4, 0.9, 0.3], 10, 2);
        }
      }
    }
  },

  updateCrops(dt) {
    this.cropT -= dt;
    if (this.cropT > 0) return;
    this.cropT = 1.4;
    const p = Player.body;
    for (const [key, c] of [...World.crops]) {
      const [x, y, z] = key.split(',').map(Number);
      if (Math.abs(x - p.x) > 64 || Math.abs(z - p.z) > 64 || !World.hasChunk(x, z)) continue;
      const id = World.getBlock(x, y, z);
      if (id !== c.id || !isCrop(id)) { World.crops.delete(key); continue; }
      if (cropStage(id) >= 3) { World.crops.delete(key); continue; }
      const weather = (typeof Dynamics !== 'undefined' ? Dynamics.weather : 'clear');
      const growthMult = weather === 'thunder' ? 2.5 : weather === 'rain' ? 2.0 : 1.0;
      c.t -= 1.4 * growthMult;
      if (c.t <= 0) {
        World.growCrop(x, y, z, false);
      }
    }
  },

  updateGrassSpread(dt) {
    this.grassT -= dt;
    if (this.grassT > 0) return;
    const weather = (typeof Dynamics !== 'undefined' ? Dynamics.weather : 'clear');
    const weatherMult = weather === 'thunder' ? 2.5 : weather === 'rain' ? 2.0 : 1.0;
    // Deterministic chunk sweep: every nearby loaded grass/dirt block gets
    // checked as its chunk comes up in the rotation. Rain/thunder sweep more
    // chunks per pass instead of relying on random one-off attempts.
    this.grassT = 0.75 / weatherMult;
    if (!World.ready) return;
    const p = Player.body;
    const chunksPerTick = weather === 'thunder' ? 5 : weather === 'rain' ? 4 : 3;
    World.sweepGrassAndDirtAround(p.x, p.y, p.z, chunksPerTick);
  },

  updateStocks(dt) {
    this.stockT -= dt;
    if (this.stockT > 0) return;
    this.stockT = 4;
    const st = this.stocks;
    const drama = Math.random() < 0.04 ? (Math.random() < 0.5 ? 0.7 : 1.45) : 1;
    st.price = Math.max(3, Math.min(3000, st.price * (1 + (Math.random() - 0.47) * 0.07) * drama));
    st.hist.push(+st.price.toFixed(2));
    if (st.hist.length > 80) st.hist.shift();
  },

  updateDayNight(dt) {
    this.time += dt;
    if (this.sleepLock > 0) this.sleepLock -= dt;
    const t = (this.time % this.dayLen) / this.dayLen;
    const newDay = Math.floor(this.time / this.dayLen) + 1;
    if (newDay !== this.dayCount) {
      this.dayCount = newDay;
      UI.chat('Day ' + newDay + ' — Mr Floop wishes you a merry christmas.', '#ffd700');
      if (newDay >= 5 && !this.humbugAnnounced) {
        this.humbugAnnounced = true;
        UI.chat('A joyless gray presence creeps into the world... the HUMBUGS have arrived.', '#ff8080');
        UI.chat('<Mr Floop> oh no. oh no no no. patapim.', '#7CFC00');
      }
    }
    const ang = t * Math.PI * 2;
    const sunH = Math.sin(ang);
    this.isNight = sunH < -0.06;
    if (this.isNight && !this.wasNight) Dynamics.maybeStartStarfall();
    this.wasNight = this.isNight;

    let dayF = Math.max(0, Math.min(1, (sunH + 0.12) * 4));
    const localWeather = Dynamics.biomeWeatherName();
    if (localWeather !== 'clear') dayF *= 0.62; // storms dim the world
    World.dayFUniform.value = dayF;

    this.skyColor.copy(this.skyNight).lerp(this.skyDay, dayF);
    if (localWeather !== 'clear') this.skyColor.lerp(this.skyStorm, 0.55);
    const sunsetF = Math.max(0, 1 - Math.abs(sunH) / 0.16) * 0.55;
    if (sunsetF > 0 && localWeather === 'clear') this.skyColor.lerp(this.skySunset, sunsetF);

    const eyeBlock = World.getBlock(Math.floor(Player.body.x), Math.floor(Player.eyeY()), Math.floor(Player.body.z));
    if (isWater(eyeBlock)) {
      this.scene.fog.color.setHex(0x1a3a8f);
      this.scene.fog.near = 2; this.scene.fog.far = 20;
      this.renderer.setClearColor(0x1a3a8f);
    } else if (isLava(eyeBlock)) {
      this.scene.fog.color.setHex(0xd96514);
      this.scene.fog.near = 0.5; this.scene.fog.far = 6;
      this.renderer.setClearColor(0xd96514);
    } else {
      this.scene.fog.color.copy(this.skyColor);
      const far = localWeather === 'sandstorm' ? 42 : localWeather === 'blizzard' ? 38 : localWeather !== 'clear' ? 80 : 105;
      this.scene.fog.near = far * 0.5; this.scene.fog.far = far;
      this.renderer.setClearColor(this.skyColor);
    }

    // entity lighting: scene lights stay CONSTANT — the per-entity voxel tint
    // carries day/night and torch glow (they were double-darkened before)
    this.ambLight.intensity = 0.95;
    this.dirLight.intensity = 0.3;
    const p = Player.body;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    this.dirLight.position.set(p.x + sunDir.x * 90, p.y + sunDir.y * 90, p.z + sunDir.z * 90);
    this.dirLight.target.position.set(p.x, p.y, p.z);

    const cam = this.camera.position;
    this.sun.position.set(cam.x + Math.cos(ang) * 400, cam.y + Math.sin(ang) * 400, cam.z + 60);
    this.sun.lookAt(cam);
    this.moon.position.set(cam.x - Math.cos(ang) * 400, cam.y - Math.sin(ang) * 400, cam.z - 60);
    this.moon.lookAt(cam);
    this.stars.position.copy(cam);
    this.stars.material.opacity = Math.max(0, Math.min(1, -sunH * 3));

    const wIcon = localWeather === 'clear' ? '' :
      localWeather === 'sandstorm' ? ' 🌪' : localWeather === 'snowfall' ? ' ❄' : localWeather === 'blizzard' ? ' ❄❄' :
      this.weather === 'thunder' ? ' ⛈' : ' 🌧';
    document.getElementById('dayLabel').textContent =
      (this.isNight ? '☾ ' : '☀ ') + 'Day ' + this.dayCount + wIcon;
    let coordText = `x ${p.x.toFixed(0)}  y ${p.y.toFixed(0)}  z ${p.z.toFixed(0)}`;
    if (this.debugChunkBorders) {
      const cx = Math.floor(p.x) >> 4, cy = Math.floor(p.y / 16), cz = Math.floor(p.z) >> 4;
      const lx = ((Math.floor(p.x) % 16) + 16) % 16, ly = ((Math.floor(p.y) % 16) + 16) % 16, lz = ((Math.floor(p.z) % 16) + 16) % 16;
      coordText += `  chunk ${cx},${cy},${cz}  local ${lx},${ly},${lz}`;
    }
    document.getElementById('coords').textContent = coordText;
  },

  // ---------------- main loop ----------------
  frame() {
    requestAnimationFrame(() => this.frame());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.clock) / 1000);
    this.clock = now;

    if (!this.inWorld) { this.renderer.render(this.scene, this.camera); return; }
    const p = Player.body;

    if (this.loading) {
      World.update(p.x, p.z, 8, p.y);
      const { missing, total } = World.countMissing(p.x, p.z, 2);
      document.getElementById('loadBar').style.width = Math.round((1 - missing / total) * 100) + '%';
      if (missing === 0) this.finishLoading();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.cinematicPlaying) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const paused = !this.locked && !UI.anyOpen() && !UI.chatOpen && this.started;
    // A connected host is the authority for everyone else — it must keep simulating
    // even while its own pause menu is up or its tab is unfocused, or every client
    // freezes (mobs, drops, other players' relayed actions all stall).
    const mpHost = typeof Multiplayer !== 'undefined' && Multiplayer.role === 'host' && Multiplayer.connected;
    if (!this.started || (paused && !mpHost)) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    Player.update(dt);
    World.update(p.x, p.z, 1, p.y); // one gen + one mesh per frame keeps exploration smooth
    Water.update(dt);
    Lava.update(dt);
    Drops.update(dt);
    Mobs.update(dt);
    Vehicles.update(dt);
    Vehicles.updateBoard(dt);
    Guns.update(dt);
    Particles.update(dt);
    Dynamics.update(dt);
    if (typeof Dimensions !== 'undefined') Dimensions.update(dt);
    if (typeof Multiplayer !== 'undefined') Multiplayer.update(dt);
    this.updateFurnaces(dt);
    this.updateSaplings(dt);
    this.updateCrops(dt);
    this.updateGrassSpread(dt);
    this.updateStocks(dt);
    this.updateDayNight(dt);
    this.updateChunkBorders();

    // autosave: less often, and never while chunks are streaming in —
    // the synchronous JSON+localStorage write was the mystery multi-second freeze
    this.saveT += dt;
    if (this.saveT > 45) {
      const { missing } = World.countMissing(p.x, p.z);
      if (missing === 0 && World.ready) {
        this.saveT = 0;
        Save.saveCurrent({ auto: true });
      } else {
        this.saveT = 40; // busy — try again shortly
      }
    }

    this.renderer.render(this.scene, this.camera);
  },
};

window.addEventListener('DOMContentLoaded', () => Game.init());
