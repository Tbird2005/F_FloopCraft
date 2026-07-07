// ============================================================
// F_Floop Craft — the player: movement, swimming, ladders,
// modes, hunger, mining (3x3 tools), inventory, armor, XP
// ============================================================
const Player = {
  body: { x: 0, y: 60, z: 0, vx: 0, vy: 0, vz: 0, w: 0.3, h: 1.8, onGround: false, hitH: false },
  yaw: 0, pitch: 0,
  camera: null,
  keys: {},
  hp: 20, maxHp: 20,
  hunger: 20, exhaustion: 0, regenT: 0, starveT: 0,
  air: 10, airT: 0, suffocateT: 0,
  xp: 0, level: 0,
  armor: [null, null, null, null],
  gamemode: 'survival',
  flying: false, lastSpace: 0,
  sprinting: false, sneaking: false, swimming: false,
  stairSideMode: 0, // 0 normal, 1 sideways wall-stair placement mode
  boarding: false, climbing: false,
  fallDist: 0,
  dead: false,
  invulnT: 0,
  spawn: { x: 0, y: 60, z: 0 },

  inv: new Array(36).fill(null),
  sel: 0,

  mining: false, mineTarget: null, mineProgress: 0,
  // Per-target block damage.  Mining damage now lingers briefly, then heals
  // back stage-by-stage instead of instantly clearing when the button is released.
  mineDamage: new Map(),
  breakOverlay: null, breakDamageOverlays: [], highlight: null, crackTex: [],
  lmb: false, rmb: false, rmbFresh: false, placeT: 0, attackT: 0, eatT: 0,
  lastW: 0,
  verticalSlabMode: false,
  wasInWater: false,
  vmGroup: null, vmMesh: null, vmHeld: -999, vmSwing: 0, vmBob: 0,

  init(camera, spawn) {
    this.camera = camera;
    this.spawn = spawn;
    this.body.x = spawn.x; this.body.y = spawn.y; this.body.z = spawn.z;
    this.camera.position.set(spawn.x, this.eyeY(), spawn.z);
    this.camera.rotation.order = 'YXZ';
    this.yaw = Math.PI * 0.75;
    this.pitch = -0.12;
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.highlight = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
    );
    this.highlight.visible = false;
    this._hlKey = null;
    Game.scene.add(this.highlight);

    this.crackTex = [];
    // Progressive break cracks: every stage now extends the same fracture pattern
    // instead of swapping to unrelated random scratches.  Early stages show tiny
    // hairline chips; later stages lengthen, branch, and thicken the same cracks.
    const crackPaths = [
      { start: 0.00, w: 0.90, pts: [[15.5, 16.0], [13.0, 14.6], [10.2, 13.4], [6.6, 12.0], [2.6, 9.4]] },
      { start: 0.05, w: 0.95, pts: [[15.5, 16.0], [17.7, 13.8], [20.5, 11.2], [23.8, 8.0], [28.8, 5.5]] },
      { start: 0.10, w: 1.00, pts: [[15.5, 16.0], [17.4, 18.4], [19.2, 21.0], [22.4, 25.1], [26.9, 29.0]] },
      { start: 0.15, w: 0.95, pts: [[15.5, 16.0], [13.8, 18.8], [11.6, 21.0], [8.2, 24.4], [3.5, 27.2]] },
      { start: 0.30, w: 0.70, pts: [[11.2, 13.7], [9.2, 10.0], [7.6, 6.8], [5.4, 3.0]] },
      { start: 0.35, w: 0.70, pts: [[20.5, 11.2], [24.0, 11.0], [27.5, 12.7], [30.0, 15.0]] },
      { start: 0.40, w: 0.75, pts: [[19.2, 21.0], [22.7, 20.4], [26.2, 18.5], [30.0, 17.0]] },
      { start: 0.45, w: 0.70, pts: [[11.6, 21.0], [10.2, 25.3], [9.0, 29.5]] },
      { start: 0.55, w: 0.60, pts: [[13.0, 14.6], [11.5, 16.5], [8.2, 18.0], [5.0, 19.5]] },
      { start: 0.60, w: 0.60, pts: [[17.7, 13.8], [16.8, 10.5], [15.0, 7.2], [12.8, 4.2]] },
      { start: 0.68, w: 0.55, pts: [[17.4, 18.4], [15.4, 21.7], [13.6, 25.0], [12.0, 30.0]] },
      { start: 0.74, w: 0.55, pts: [[22.4, 25.1], [25.0, 24.6], [29.5, 23.2]] },
      { start: 0.80, w: 0.50, pts: [[8.2, 24.4], [5.0, 23.5], [2.0, 22.2]] },
      { start: 0.84, w: 0.50, pts: [[23.8, 8.0], [22.4, 4.5], [21.4, 1.8]] },
    ];
    const drawPartialPath = (ctx, pts, amount) => {
      if (!pts || pts.length < 2 || amount <= 0) return;
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      }
      let left = total * Math.min(1, amount);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length && left > 0; i++) {
        const ax = pts[i - 1][0], ay = pts[i - 1][1];
        const bx = pts[i][0], by = pts[i][1];
        const seg = Math.hypot(bx - ax, by - ay);
        if (left >= seg) {
          ctx.lineTo(bx, by);
          left -= seg;
        } else {
          const t = left / Math.max(0.0001, seg);
          ctx.lineTo(ax + (bx - ax) * t, ay + (by - ay) * t);
          left = 0;
        }
      }
      ctx.stroke();
    };
    for (let s = 0; s < 5; s++) {
      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 32;
      const c = cv.getContext('2d');
      const progress = (s + 1) / 5;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const path of crackPaths) {
        const local = (progress - path.start) / Math.max(0.001, 1 - path.start);
        if (local <= 0) continue;
        const amt = Math.min(1, local * 1.18);
        const alpha = Math.min(0.92, 0.38 + progress * 0.58);
        c.strokeStyle = `rgba(10,10,10,${alpha})`;
        c.lineWidth = path.w * (0.65 + progress * 1.25);
        drawPartialPath(c, path.pts, amt);
      }
      // Final stages get a few tiny edge chips, but they are still tied to the
      // same damage progression rather than being a new random texture jump.
      if (progress > 0.62) {
        c.fillStyle = `rgba(8,8,8,${0.28 + progress * 0.28})`;
        const chips = [
          [6, 12], [25, 7], [23, 26], [8, 24], [29, 17], [13, 5], [3, 21]
        ];
        const n = Math.floor((progress - 0.62) * chips.length / 0.38);
        for (let i = 0; i < n; i++) c.fillRect(chips[i][0], chips[i][1], 1, 1);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      this.crackTex.push(tex);
    }
    this.breakOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1.002, 1.002, 1.002),
      new THREE.MeshBasicMaterial({
        map: this.crackTex[0], transparent: true, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2,
      })
    );
    this.breakOverlay.visible = false;
    Game.scene.add(this.breakOverlay);

    this.vmGroup = new THREE.Group();
    this.vmGroup.position.set(0.42, -0.40, -0.62);
    this.camera.add(this.vmGroup);

    if (!this.loadedFromSave) {
      this.addItem(I.WOOD_PICK, 1);
      this.addItem(I.APPLE, 3);
    }
    this.bindInput();
  },

  // ---------------- inventory ----------------
  addItem(id, count) {
    const def = Reg[id];
    if (!def) return count;
    let left = count;
    for (let i = 0; i < 36 && left > 0; i++) {
      const s = this.inv[i];
      if (s && s.id === id && s.count < def.stack) {
        const take = Math.min(def.stack - s.count, left);
        s.count += take; left -= take;
      }
    }
    for (let i = 0; i < 36 && left > 0; i++) {
      if (!this.inv[i]) {
        const take = Math.min(def.stack, left);
        this.inv[i] = { id, count: take };
        left -= take;
      }
    }
    UI.updateHotbar();
    return left;
  },

  countItem(id) {
    let n = 0;
    for (const s of this.inv) if (s && s.id === id) n += s.count;
    return n;
  },

  removeItems(id, count) {
    if (this.countItem(id) < count) return false;
    let left = count;
    for (let i = 35; i >= 0 && left > 0; i--) {
      const s = this.inv[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, left);
        s.count -= take; left -= take;
        if (s.count <= 0) this.inv[i] = null;
      }
    }
    UI.updateHotbar();
    return true;
  },

  held() { return this.inv[this.sel]; },

  // can we take at least one more of this item? (full inventories stop the item magnet)
  canAccept(id) {
    const def = Reg[id];
    if (!def) return false;
    for (let i = 0; i < 36; i++) {
      const s = this.inv[i];
      if (!s) return true;
      if (s.id === id && s.count < def.stack) return true;
    }
    return false;
  },

  // wear down the held tool/weapon; breaks at zero
  damageHeld(n) {
    if (this.gamemode === 'creative') return;
    const s = this.inv[this.sel];
    if (!s || !Reg[s.id].maxDur) return;
    if (s.dur === undefined) s.dur = Reg[s.id].maxDur;
    s.dur -= n || 1;
    if (s.dur <= 0) {
      const name = Reg[s.id].name;
      this.inv[this.sel] = null;
      SFX.breakBlk();
      Particles.burst(this.body.x, this.eyeY(), this.body.z, [0.6, 0.6, 0.6], 8, 2);
      UI.chat('Your ' + name + ' broke!', '#ff8080');
    }
    UI.updateHotbar();
  },

  consumeHeld(n) {
    if (this.gamemode === 'creative') return;
    const s = this.inv[this.sel];
    if (!s) return;
    s.count -= n || 1;
    if (s.count <= 0) this.inv[this.sel] = null;
    UI.updateHotbar();
  },

  swapHeldTo(id) {
    // used by buckets: bucket -> water bucket etc.
    if (this.gamemode === 'creative') { return; }
    const s = this.inv[this.sel];
    if (!s) return;
    s.count--;
    if (s.count <= 0) this.inv[this.sel] = null;
    const left = this.addItem(id, 1);
    if (left > 0) Drops.spawn(this.body.x, this.body.y + 1, this.body.z, id, left);
  },

  // ---------------- XP ----------------
  xpNeeded() { return 12 + this.level * 6; },

  addXp(n) {
    if (!n || this.gamemode === 'creative') return;
    this.xp += n;
    SFX.xp();
    while (this.xp >= this.xpNeeded()) {
      this.xp -= this.xpNeeded();
      this.level++;
      SFX.levelUp();
      UI.chat('Level up! You are now level ' + this.level + '. Mr Floop is proud (probably).', '#a8f04a');
    }
    UI.updateXp();
  },

  armorPoints() {
    let p = 0;
    for (let i = 0; i < this.armor.length; i++) {
      const a = this.armor[i];
      const def = a && Reg[a.id];
      if (!def || !def.armor || def.armor.slot !== i) {
        this.armor[i] = null;
        continue;
      }
      p += def.armor.points;
    }
    return p;
  },

  sanitizeArmor() {
    for (let i = 0; i < 4; i++) {
      const a = this.armor[i];
      const def = a && Reg[a.id];
      if (!def || !def.armor || def.armor.slot !== i) {
        if (a && def) this.addItem(a.id, a.count || 1, a.dur);
        this.armor[i] = null;
      } else {
        a.count = 1;
      }
    }
  },

  // ---------------- input ----------------
  bindInput() {
    document.addEventListener('keydown', e => {
      if (UI.chatOpen) return;
      if (typeof Game !== 'undefined' && Game.cinematicPlaying) { e.preventDefault(); return; }
      if (Game.locked && !e.metaKey) e.preventDefault();

      if (UI.anyOpen() || this.dead) {
        if (e.code === 'KeyE' || e.code === 'Escape') UI.handleClose(e.code);
        // Q over a slot drops it out of the open menu (Ctrl+Q = whole stack)
        if (e.code === 'KeyQ' && UI.hoverSlot) {
          const s = UI.hoverSlot.get();
          if (s) {
            const n = e.ctrlKey ? s.count : 1;
            const dir = this.lookDir();
            Drops.spawn(this.body.x + dir.x * 0.6, this.body.y + 1.4, this.body.z + dir.z * 0.6,
              s.id, n, [dir.x * 5.5, 1.8, dir.z * 5.5], s.dur);
            s.count -= n;
            UI.hoverSlot.set(s.count > 0 ? s : null);
            SFX.pop();
            UI.refreshAll();
          }
        }
        return;
      }
      if (!Game.locked) return;
      this.keys[e.code] = true;

      if (e.code === 'KeyW' && !e.repeat) {
        const now = performance.now();
        const autoSprint = typeof Game !== 'undefined' && Game.options && Game.options.autoSprint;
        if (autoSprint) this.sprinting = true;
        else if (now - this.lastW < 260) this.sprinting = true;
        this.lastW = now;
      }
      if (e.code === 'Space' && !e.repeat && this.gamemode === 'creative') {
        const now = performance.now();
        if (now - this.lastSpace < 280) {
          this.flying = !this.flying;
          this.body.vy = 0;
          UI.updateModeLabel();
        }
        this.lastSpace = now;
      }
      if (e.code === 'KeyX' && !e.repeat) {
        const held = this.held();
        if (held && isStairs(held.id)) {
          this.stairSideMode = this.stairSideMode ? 0 : 1;
          UI.updateModeLabel();
          UI.chat('Sideways stair placement: ' + (this.stairSideMode ? 'ON' : 'OFF'), this.stairSideMode ? '#7df5ec' : '#ccc');
        } else if (held && isSlab(held.id)) {
          this.verticalSlabMode = !this.verticalSlabMode;
          UI.updateModeLabel();
          UI.chat('Vertical slab mode: ' + (this.verticalSlabMode ? 'ON' : 'OFF'), this.verticalSlabMode ? '#7df5ec' : '#ccc');
        }
      }
      if (e.code === 'KeyE') UI.open(this.gamemode === 'creative' ? 'creative' : 'inventory');
      if (e.code === 'KeyQ') this.dropHeld(e.ctrlKey);
      if (e.code === 'KeyT') UI.openChat('');
      if (e.code === 'KeyM') UI.togglePingList();
      if (e.code === 'Slash') UI.openChat('/');
      if (e.code.startsWith('Digit')) {
        const n = +e.code.slice(5);
        if (n >= 1 && n <= 9) { this.sel = n - 1; UI.updateHotbar(); UI.showItemName(); UI.updateModeLabel(); }
      }
    });
    document.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => {
      this.keys = {};
      this.lmb = false; this.rmb = false;
      this.sprinting = false;
    });

    document.addEventListener('mousemove', e => {
      if (typeof Game !== 'undefined' && Game.cinematicPlaying) return;
      if (!Game.locked || UI.anyOpen() || UI.chatOpen) return;
      const mouseScale = (typeof Game !== 'undefined' && Game.options && Number.isFinite(+Game.options.mouseSensitivity)) ? +Game.options.mouseSensitivity : 1;
      const mouseSpeed = 0.0023 * mouseScale;
      this.yaw -= e.movementX * mouseSpeed;
      this.pitch -= e.movementY * mouseSpeed;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
      // self-healing button state (fixes stuck / dropped buttons, keeps full-auto honest)
      if (e.buttons !== undefined) {
        this.lmb = !!(e.buttons & 1);
        if (!(e.buttons & 2)) this.rmb = false;
        else if (!this.rmb) { this.rmb = true; this.rmbFresh = true; }
      }
    });
    document.addEventListener('mousedown', e => {
      if (typeof Game !== 'undefined' && Game.cinematicPlaying) { e.preventDefault(); return; }
      if (!Game.locked || UI.anyOpen() || UI.chatOpen || this.dead) return;
      if (e.button === 0) { this.lmb = true; this.tryAttack(); }
      if (e.button === 1) { e.preventDefault(); this.pickBlock(); }
      if (e.button === 2) { this.rmb = true; this.rmbFresh = true; this.placeT = 0; }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) { this.lmb = false; this.mineProgress = 0; this.mineTarget = null; }
      if (e.button === 2) this.rmb = false;
    });
    document.addEventListener('wheel', e => {
      if (typeof Game !== 'undefined' && Game.cinematicPlaying) { e.preventDefault(); return; }
      if (!Game.locked || UI.anyOpen()) return;
      this.sel = (this.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      UI.updateHotbar();
      UI.showItemName();
    }, { passive: true });
    document.addEventListener('contextmenu', e => e.preventDefault());
  },

  // creative middle-click block picking
  pickBlock() {
    if (this.gamemode !== 'creative') return;
    const d = this.lookDir();
    const hit = World.raycast(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 6);
    if (!hit) return;
    let pick = hit.id;
    if (isDoor(pick)) pick = pick >= B.ODOOR_XB ? I.OASIS_DOOR : pick >= B.SDOOR_XB ? I.SPRUCE_DOOR : pick >= B.BDOOR_XB ? I.BIRCH_DOOR : I.DOOR;
    else if (pick === B.BED_HEAD) pick = B.BED;
    else if (pick === B.SUNBED_HEAD) pick = B.SUNBED;
    else if (isStairs(pick)) pick = Reg[pick].drop.id;
    else if (Reg[pick].shape === 'slabT') pick = Reg[pick].drop.id;
    else if (isVSlab(pick)) pick = Reg[pick].drop.id;
    else if (isDSlab(pick)) { const drops = slabComboDropIds(pick); pick = drops[0] || B.PLANK_SLAB_B; }
    else if (isWallTorch(pick)) pick = B.TORCH;
    else if (isLadder(pick)) pick = B.LADDER_PX;
    else if (pick === B.FURNACE_LIT) pick = B.FURNACE;
    else if (isSnowSheet(pick)) pick = B.SNOW_SHEET_1;
    else if (pick === B.FIRE) return;
    // already in the hotbar? select it
    for (let i = 0; i < 9; i++) {
      if (this.inv[i] && this.inv[i].id === pick) { this.sel = i; UI.updateHotbar(); UI.showItemName(); return; }
    }
    this.inv[this.sel] = { id: pick, count: Reg[pick].stack };
    UI.updateHotbar();
    UI.showItemName();
    SFX.click();
  },

  dropHeld(wholeStack) {
    const s = this.held();
    if (!s) return;
    const n = wholeStack ? s.count : 1;
    const dir = this.lookDir();
    Drops.spawn(
      this.body.x + dir.x * 0.6, this.body.y + 1.4, this.body.z + dir.z * 0.6,
      s.id, n, [dir.x * 5.5, 1.8, dir.z * 5.5], s.dur
    );
    s.count -= n;
    if (s.count <= 0) this.inv[this.sel] = null;
    UI.updateHotbar();
  },

  lookDir() {
    return {
      x: -Math.sin(this.yaw) * Math.cos(this.pitch),
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * Math.cos(this.pitch),
    };
  },

  eyeY() {
    if (this.swimming) return this.body.y + 0.45;
    return this.body.y + (this.sneaking && !this.flying ? 1.42 : 1.62);
  },

  // ---------------- combat / interaction ----------------
  tryAttack() {
    if (this.attackT > 0) return;
    const d = this.lookDir();
    const hit = Mobs.hitTest(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 4);
    const vHit = Vehicles.rayVehicle(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 4);
    const blockHit = World.raycast(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 5);
    this.swingViewmodel();
    const s = this.held();
    const heldDef = s && Reg[s.id] ? Reg[s.id] : null;
    // Only item tools/weapons use an object here. Blocks also use Reg.tool as
    // mining metadata strings like "axe"/"pickaxe"/"shovel"; treating those
    // strings as weapons made dmg become undefined, which could turn mob HP into
    // NaN and make the mob immortal.
    const tool = heldDef && heldDef.tool && typeof heldDef.tool === 'object' ? heldDef.tool : null;
    const rawDmg = tool && Number.isFinite(+tool.dmg) ? +tool.dmg : 1;
    const rawKnock = tool && Number.isFinite(+tool.knock) ? +tool.knock : 6;
    const dmg = Math.max(0.1, rawDmg);
    const knock = Math.max(0, rawKnock);
    const blockDist = blockHit ? blockHit.dist : 99;
    if (hit && hit.dist < blockDist && (!vHit || hit.dist < vHit.dist)) {
      Mobs.hurt(hit.mob, dmg, d.x * knock, d.z * knock, 'player');
      this.exhaustion += 0.1;
      this.attackT = 0.35;
      this.damageHeld(1);
    } else if (vHit && vHit.dist < blockDist) {
      Vehicles.hurt(vHit.v, Math.max(2, dmg), 'player');
      this.attackT = 0.35;
      this.damageHeld(1);
    }
  },

  tryUse() {
    const d = this.lookDir();
    const s = this.held();

    // (vehicles are exited with SHIFT only now — RMB does nothing special inside one)
    if (Vehicles.driving || Vehicles.boating || this.boarding) return false;

    const blockHitEarly = World.raycast(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 5);
    const hit = blockHitEarly;

    // vehicles: enter / pick up
    const vHit = Vehicles.rayVehicle(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 4);
    if (vHit && (!hit || vHit.dist < hit.dist)) {
      if (this.sneaking) {
        Vehicles.remove(vHit.v);
        this.addItem(vHit.v.item, 1);
        UI.chat(Reg[vHit.v.item].name + ' picked up.', '#aaa');
      } else Vehicles.enter(vHit.v);
      return true;
    }

    // mobs: dye sheep
    const mHit = Mobs.hitTest(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 4);
    if (mHit && (!hit || mHit.dist < hit.dist) && s && DYE_COLOR[s.id] && mHit.mob.type === 'sheep') {
      if (Mobs.dyeSheep(mHit.mob, DYE_COLOR[s.id])) {
        this.consumeHeld(1);
        return true;
      }
    }

    // interactive blocks (unless sneaking)
    if (hit && !this.sneaking) {
      const def = Reg[hit.id];
      if (def.interact === 'craft') { UI.open('craft'); return true; }
      if (def.interact === 'extremeCraft') { UI.open('extremeCraft'); return true; }
      if (def.interact === 'casino') { UI.open('casino'); return true; }
      if (def.interact === 'lore') { UI.open('lore', hit); return true; }
      if (def.interact === 'furnace') { UI.open('furnace', hit); return true; }
      if (def.interact === 'stocks') { UI.open('stocks'); return true; }
      if (def.interact === 'sign') { UI.open('sign', hit); return true; }
      if (def.interact === 'door') { this.toggleDoor(hit); return true; }
      if (def.interact === 'bed') { Game.trySleep(false, hit); return true; }
      if (def.interact === 'sunbed') { Game.trySleep(true, hit); return true; }
      if (def.interact === 'chest') { UI.open('chest', hit); return true; }
    }

    if (!s) return false;

    // spawn eggs
    if (Reg[s.id].spawnEgg && hit) {
      Mobs.spawn(Reg[s.id].spawnEgg, hit.bx + 0.5, hit.by + 1.02, hit.bz + 0.5,
        Reg[s.id].spawnEgg === 'humbug' ? Mobs.humbugGun() : null);
      this.consumeHeld(1);
      SFX.pop();
      return true;
    }

    // buckets
    if (s.id === I.BUCKET) {
      const fHit = World.raycast(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 5, { fluids: true });
      if (fHit && (fHit.id === B.WATER || fHit.id === B.LAVA)) {
        const got = fHit.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET;
        World.setBlock(fHit.bx, fHit.by, fHit.bz, B.AIR);
        this.swapHeldTo(got);
        SFX.splash();
        return true;
      }
      return false;
    }
    if ((s.id === I.WATER_BUCKET || s.id === I.LAVA_BUCKET) && hit) {
      const bx = hit.bx + hit.nx, by = hit.by + hit.ny, bz = hit.bz + hit.nz;
      const existing = World.getBlock(bx, by, bz);
      if (existing === B.AIR || (Reg[existing] && Reg[existing].replaceable)) {
        World.setBlock(bx, by, bz, s.id === I.WATER_BUCKET ? B.WATER : B.LAVA);
        this.swapHeldTo(I.BUCKET);
        SFX.splash();
        return true;
      }
      return false;
    }

    // flint & steel: light fires
    if (s.id === I.FLINT_STEEL && hit) {
      const bx = hit.bx + hit.nx, by = hit.by + hit.ny, bz = hit.bz + hit.nz;
      if (World.getBlock(bx, by, bz) === B.AIR) {
        World.setBlock(bx, by, bz, B.FIRE);
        SFX.dig();
        return true;
      }
      return false;
    }

    // ride the skateboard item? no — place it. (clicking a placed one rides it)
    if (s.id === I.SKATEBOARD && hit && hit.ny === 1) {
      Vehicles.placeBoard(hit.bx + 0.5, hit.by + 1.02, hit.bz + 0.5, this.yaw);
      this.consumeHeld(1);
      SFX.place();
      return true;
    }
    if (s.id === I.CAR && hit && hit.ny === 1) {
      Vehicles.placeCar(hit.bx + 0.5, hit.by + 1.05, hit.bz + 0.5, this.yaw);
      this.consumeHeld(1);
      SFX.place();
      return true;
    }
    if (s.id === I.SUPER_CAR && hit && hit.ny === 1) {
      Vehicles.placeSuperCar(hit.bx + 0.5, hit.by + 1.02, hit.bz + 0.5, this.yaw);
      this.consumeHeld(1);
      SFX.place();
      return true;
    }
    if (s.id === I.BOAT || s.id === I.OBSIDIAN_BOAT) {
      const obsidianBoat = s.id === I.OBSIDIAN_BOAT;
      const fHit = World.raycast(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 6, { fluids: true });
      if (fHit && (obsidianBoat ? isLava(fHit.id) : isWater(fHit.id))) {
        Vehicles.placeBoat(fHit.bx + 0.5, fHit.by + 0.6, fHit.bz + 0.5, this.yaw, obsidianBoat);
        this.consumeHeld(1);
        SFX.place();
        return true;
      }
      if (hit && hit.ny === 1) {
        Vehicles.placeBoat(hit.bx + 0.5, hit.by + 1.05, hit.bz + 0.5, this.yaw, obsidianBoat);
        this.consumeHeld(1);
        SFX.place();
        return true;
      }
      return false;
    }

    // bonemeal: use on saplings/crops to kick growth forward
    if (s.id === I.BONEMEAL && hit && isCrop(hit.id)) {
      const grew = World.growCrop(hit.bx, hit.by, hit.bz, true);
      if (grew) {
        this.consumeHeld(1);
        SFX.pop();
        Particles.burst(hit.bx + 0.5, hit.by + 0.65, hit.bz + 0.5, [0.8, 1.0, 0.45], 16, 2.6);
        return true;
      }
      return false;
    }
    if (s.id === I.BONEMEAL && hit && isSapling(hit.id)) {
      const ground = World.getBlock(hit.bx, hit.by - 1, hit.bz);
      if (!canPlantSaplingOn(hit.id, ground)) return false;
      const key = World.pkey(hit.bx, hit.by, hit.bz);
      let grew = false;
      if (Math.random() < 0.65) grew = World.growTree(hit.bx, hit.by, hit.bz, hit.id);
      if (!grew && World.getBlock(hit.bx, hit.by, hit.bz) === hit.id) {
        const cur = World.saplings.get(key) || { id: hit.id, t: 25 + Math.random() * 50 };
        cur.t = Math.min(cur.t, 2 + Math.random() * 4);
        World.saplings.set(key, cur);
      }
      this.consumeHeld(1);
      SFX.pop();
      Particles.burst(hit.bx + 0.5, hit.by + 0.8, hit.bz + 0.5, [0.75, 0.95, 0.65], 16, 2.4);
      return true;
    }

    if (s.id === I.BONEMEAL && hit && hit.id === B.DIRT) {
      World.setBlock(hit.bx, hit.by, hit.bz, B.GRASS);
      this.consumeHeld(1);
      SFX.pop();
      Particles.burst(hit.bx + 0.5, hit.by + 1.0, hit.bz + 0.5, [0.35, 0.9, 0.25], 18, 2.2);
      return true;
    }
    if (s.id === I.BONEMEAL && hit && (hit.id === B.GRASS || hit.id === B.SNOWY_GRASS)) {
      const grew = World.bonemealGrass(hit.bx, hit.by, hit.bz);
      if (grew) {
        this.consumeHeld(1);
        SFX.pop();
        Particles.burst(hit.bx + 0.5, hit.by + 1.0, hit.bz + 0.5, [0.45, 0.9, 0.35], 22, 2.4);
        return true;
      }
      return false;
    }

    // plant floopfruit seeds directly inside one EMPTY cell of a 3x3 Plantation Pot.
    // If the ray hit the pot mesh inside a cell that already contains a crop,
    // do not consume/waste another seed by overwriting the crop.
    if (s.id === I.FLOOPFRUIT_SEEDS && hit && canPlantFloopfruitOn(hit.id)) {
      if (World.getBlock(hit.bx, hit.by, hit.bz) !== B.PLANTATION_POT) return false;
      World.setBlock(hit.bx, hit.by, hit.bz, B.FLOOPFRUIT_CROP0);
      this.consumeHeld(1);
      SFX.place();
      Particles.burst(hit.bx + 0.5, hit.by + 0.55, hit.bz + 0.5, [0.45, 0.9, 0.35], 8, 1.8);
      return true;
    }

    // eat
    if (Reg[s.id].food && this.eatT <= 0) {
      if (this.hunger >= 20 && this.gamemode !== 'creative') return false;
      this.hunger = Math.min(20, this.hunger + Reg[s.id].food);
      this.consumeHeld(1);
      SFX.eat();
      Particles.burst(this.body.x + d.x * 0.5, this.eyeY() - 0.2 + d.y * 0.5, this.body.z + d.z * 0.5, [0.8, 0.3, 0.2], 6, 1.5);
      this.eatT = 0.45;
      UI.updateStats();
      return true;
    }
    // place blocks / doors
    if ((Reg[s.id].block || Reg[s.id].placesDoor) && hit) {
      return this.tryPlace(s, hit);
    }
    return false;
  },

  toggleDoor(hit) {
    const by = isDoorTop(hit.id) ? hit.by - 1 : hit.by;
    const bottom = World.getBlock(hit.bx, by, hit.bz);
    const top = World.getBlock(hit.bx, by + 1, hit.bz);
    if (DOOR_SWAP[bottom]) World.setBlock(hit.bx, by, hit.bz, DOOR_SWAP[bottom], { noUpdate: true });
    if (DOOR_SWAP[top]) World.setBlock(hit.bx, by + 1, hit.bz, DOOR_SWAP[top], { noUpdate: true });
    SFX.doorSound();
  },

  placementBlockedByBodies(placeId, bx, by, bz) {
    if (Physics.placementBlocked(placeId, bx, by, bz, this.body)) return true;
    for (const m of Mobs.list) {
      if (!m.dead && Physics.placementBlocked(placeId, bx, by, bz, m.body)) return true;
    }
    if (typeof Multiplayer !== 'undefined' && Multiplayer.remoteBodies) {
      for (const rb of Multiplayer.remoteBodies()) {
        if (rb && !rb.dead && Physics.placementBlocked(placeId, bx, by, bz, rb)) return true;
      }
    }
    return false;
  },

  verticalSlabOrient(hit) {
    if (hit.nx === 1) return 'nx';
    if (hit.nx === -1) return 'px';
    if (hit.nz === 1) return 'nz';
    if (hit.nz === -1) return 'pz';
    const lx = hit.px - Math.floor(hit.px);
    const lz = hit.pz - Math.floor(hit.pz);
    if (Math.abs(lx - 0.5) >= Math.abs(lz - 0.5)) return lx < 0.5 ? 'nx' : 'px';
    return lz < 0.5 ? 'nz' : 'pz';
  },

  slabPieceForTarget(heldId, hit) {
    const base = SLAB_BOTTOM_OF[heldId] || heldId;
    const mat = SLAB_MAT[base] || SLAB_MAT[heldId];
    if (!mat) return heldId;
    if (this.verticalSlabMode) {
      return VSLAB_ID[mat + '|' + this.verticalSlabOrient(hit)] || heldId;
    }
    if (hit.ny === 1) return base;
    if (hit.ny === -1) return SLAB_TOP_OF[base] || base;
    return (hit.py - Math.floor(hit.py)) >= 0.5 ? (SLAB_TOP_OF[base] || base) : base;
  },

  slabPieceForExistingSlab(heldId, existingId) {
    const base = SLAB_BOTTOM_OF[heldId] || heldId;
    const mat = SLAB_MAT[base] || SLAB_MAT[heldId];
    if (!mat) return heldId;
    const existing = slabPartInfo(existingId);
    if (!existing) return null;
    const emptyOrient = oppositeSlabOrient(existing.orient);
    if (!emptyOrient) return null;
    if (emptyOrient === 'bottom') return base;
    if (emptyOrient === 'top') return SLAB_TOP_OF[base] || base;
    return VSLAB_ID[mat + '|' + emptyOrient] || null;
  },

  slabPieceForClickedSlab(heldId, hit) {
    const base = SLAB_BOTTOM_OF[heldId] || heldId;
    if (!this.verticalSlabMode && isSlab(hit.id)) {
      const def = Reg[hit.id];
      if (def.shape === 'slabB' && hit.ny === 1) return SLAB_TOP_OF[base] || base;
      if (def.shape === 'slabT' && hit.ny === -1) return base;
      return null;
    }
    if (this.verticalSlabMode && isVSlab(hit.id)) {
      const info = slabPartInfo(hit.id);
      if (!info) return null;
      // Direct-clicking the exposed middle face of a vertical slab should fill
      // the empty half in the SAME block, not place a new slab in the next cell.
      const towardEmpty =
        (info.orient === 'nx' && hit.nx === 1) ||
        (info.orient === 'px' && hit.nx === -1) ||
        (info.orient === 'nz' && hit.nz === 1) ||
        (info.orient === 'pz' && hit.nz === -1);
      return towardEmpty ? this.slabPieceForExistingSlab(heldId, hit.id) : null;
    }
    return this.slabPieceForTarget(heldId, hit);
  },

  tryCombineSlabAt(x, y, z, existingId, heldPieceId) {
    const comboId = slabComboIdFor(existingId, heldPieceId);
    if (!comboId) return false;
    if (Reg[comboId].solid && this.placementBlockedByBodies(comboId, x, y, z)) return false;
    World.setBlock(x, y, z, comboId);
    this.consumeHeld(1);
    SFX.place();
    return true;
  },

  tryPlace(s, hit) {
    let bx = hit.bx + hit.nx, by = hit.by + hit.ny, bz = hit.bz + hit.nz;
    if (by < 0 || by >= World.H) return false;

    // snow sheets stack in place
    if (s.id === B.SNOW_SHEET_1 && isSnowSheet(hit.id)) {
      const next = hit.id < B.SNOW_SHEET_7 ? hit.id + 1 : B.SNOW;
      World.setBlock(hit.bx, hit.by, hit.bz, next);
      this.consumeHeld(1);
      SFX.place();
      return true;
    }

    // slab + slab -> two-piece slab block. This now checks both the clicked
    // slab AND the target cell, so you can fill a slab half by placing off a
    // neighboring block face instead of having to click the slab directly.
    if (isSlab(s.id)) {
      if (isSlabPiece(hit.id)) {
        const heldForClicked = this.slabPieceForClickedSlab(s.id, hit);
        if (heldForClicked && this.tryCombineSlabAt(hit.bx, hit.by, hit.bz, hit.id, heldForClicked)) return true;
      }
      const targetExisting = World.getBlock(bx, by, bz);
      if (isSlabPiece(targetExisting)) {
        // When the target cell already contains a slab, fill its empty half.
        // This fixes placing into a vertical slab from a neighboring block face:
        // the second piece no longer turns 90 degrees based on the support face.
        const heldForTarget = this.slabPieceForExistingSlab(s.id, targetExisting) || this.slabPieceForTarget(s.id, hit);
        if (this.tryCombineSlabAt(bx, by, bz, targetExisting, heldForTarget)) return true;
      }
    }

    // plantation pot: one item places a centered 3x3 multiblock planter.
    // If you click the top of a lower slab and the whole 3x3 target is lower
    // slabs, the planter occupies the UPPER half of those same block cells.
    if (s.id === B.PLANTATION_POT) {
      let pcx = bx, pcy = by, pcz = bz;
      if (hit.ny === 1 && isLowerHorizontalSlab(hit.id)) { pcx = hit.bx; pcy = hit.by; pcz = hit.bz; }
      if (!World.canPlacePlantationPot(pcx, pcy, pcz)) {
        UI.chat('Need a clear 3×3 space with solid ground, or a 3×3 pad of lower slabs, for the Plantation Pot.', '#ff8080');
        return false;
      }
      // check player/mob body against all 9 pot cells before placing
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (this.placementBlockedByBodies(B.PLANTATION_POT, pcx + dx, pcy, pcz + dz)) return false;
      }
      World.placePlantationPot(pcx, pcy, pcz);
      this.consumeHeld(1);
      SFX.place();
      return true;
    }

    const existing = World.getBlock(bx, by, bz);
    const exDef = Reg[existing];
    if (existing !== B.AIR && !(exDef && exDef.replaceable)) return false;

    // doors: two blocks tall, never inside a body
    if (Reg[s.id].placesDoor) {
      const doorBase = Reg[s.id].placesDoor;
      const above = World.getBlock(bx, by + 1, bz);
      if (above !== B.AIR && !(Reg[above] && Reg[above].replaceable)) return false;
      if (!Physics.solidAt(bx + 0.5, by - 0.5, bz + 0.5)) return false;
      const alongX = Math.abs(this.lookDir().x) >= Math.abs(this.lookDir().z);
      const botId = alongX ? doorBase : doorBase + 2;
      if (this.placementBlockedByBodies(botId, bx, by, bz) || this.placementBlockedByBodies(botId + 1, bx, by + 1, bz)) return false;
      World.setBlock(bx, by, bz, botId);
      World.setBlock(bx, by + 1, bz, botId + 1, { noUpdate: true });
      this.consumeHeld(1);
      SFX.place();
      return true;
    }

    // beds are 1x2: the head goes one block in the direction you're facing
    if (s.id === B.BED || s.id === B.SUNBED) {
      const look = this.lookDir();
      const hd = Math.abs(look.x) >= Math.abs(look.z)
        ? [look.x > 0 ? 1 : -1, 0] : [0, look.z > 0 ? 1 : -1];
      const hx = bx + hd[0], hz = bz + hd[1];
      const headCell = World.getBlock(hx, by, hz);
      const headDef = Reg[headCell];
      if (headCell !== B.AIR && !(headDef && headDef.replaceable)) { UI.chat('Not enough room for the bed.', '#ff8080'); return false; }
      if (!Physics.solidAt(bx + 0.5, by - 0.5, bz + 0.5) || !Physics.solidAt(hx + 0.5, by - 0.5, hz + 0.5)) {
        UI.chat('The bed needs solid ground under both halves.', '#ff8080');
        return false;
      }
      const headId = s.id === B.BED ? B.BED_HEAD : B.SUNBED_HEAD;
      if (this.placementBlockedByBodies(s.id, bx, by, bz) || this.placementBlockedByBodies(headId, hx, by, hz)) return false;
      World.setBlock(bx, by, bz, s.id);
      World.setBlock(hx, by, hz, headId, { noUpdate: true });
      // store the facing so this bed never orients itself to a NEIGHBOR's bed
      const dirIdx = hd[1] === -1 ? 0 : hd[0] === 1 ? 1 : hd[1] === 1 ? 2 : 3;
      World.bedDirs.set(World.pkey(bx, by, bz), dirIdx);
      // Head uses the same facing as the foot so its pillow/head texture points the correct way.
      World.bedDirs.set(World.pkey(hx, by, hz), dirIdx);
      this.consumeHeld(1);
      SFX.place();
      return true;
    }

    let placeId = s.id;
    let sidewaysStairData = null;
    if (isSlab(s.id)) {
      placeId = this.slabPieceForTarget(s.id, hit);
    }
    if (isStairs(s.id)) {
      const look = this.lookDir();
      const heldInfo = stairInfo(s.id);
      const bottomSet = STAIR_SETS.find(x => x.group === heldInfo.group && !x.top);
      const topSet = STAIR_SETS.find(x => x.group === heldInfo.group && x.top);
      let dIdx;
      if (this.stairSideMode && hit.ny === 0 && (hit.nx !== 0 || hit.nz !== 0)) {
        // Wall-mounted sideways stair. X is only an on/off placement mode now;
        // the clicked side face chooses the wall, and the half of that face you
        // clicked chooses the corner turn automatically.
        if (hit.nx === 1) dIdx = 0;
        else if (hit.nx === -1) dIdx = 1;
        else if (hit.nz === 1) dIdx = 2;
        else dIdx = 3;
        const fx = ((hit.px % 1) + 1) % 1;
        const fz = ((hit.pz % 1) + 1) % 1;
        let side = 1;
        if (hit.nx !== 0) {
          const zSign = fz >= 0.5 ? 1 : -1;
          side = zSign === Math.sign(hit.nx) ? 1 : 2;
        } else {
          const xSign = fx >= 0.5 ? 1 : -1;
          side = xSign === -Math.sign(hit.nz) ? 1 : 2;
        }
        placeId = bottomSet.base + dIdx;
        sidewaysStairData = { nx: hit.nx, nz: hit.nz, side };
      } else {
        // normal floor/ceiling stair placement
        const wantTop = hit.ny === -1 || (hit.ny === 0 && (hit.py - Math.floor(hit.py)) >= 0.5);
        const set = wantTop && topSet ? topSet : bottomSet;
        if (Math.abs(look.x) >= Math.abs(look.z)) dIdx = look.x > 0 ? 0 : 1;
        else dIdx = look.z > 0 ? 2 : 3;
        placeId = set.base + dIdx;
      }
    }
    if (isSapling(s.id)) {
      const ground = World.getBlock(bx, by - 1, bz);
      if (!canPlantSaplingOn(s.id, ground)) {
        UI.chat(s.id === B.SAPLING_OASIS ? 'Oasis saplings need sand.' : 'Saplings need dirt or grass.', '#ff8080');
        return false;
      }
    }
    if (s.id === B.TORCH) {
      if (hit.ny === 0 && (hit.nx !== 0 || hit.nz !== 0)) {
        const wallId = hit.nx === 1 ? B.WTORCH_PX : hit.nx === -1 ? B.WTORCH_NX : hit.nz === 1 ? B.WTORCH_PZ : B.WTORCH_NZ;
        const wallDef = Reg[hit.id];
        if (wallDef && wallDef.solid && wallDef.shape === 'cube') placeId = wallId;
        else return false;
      } else if (!Physics.solidAt(bx + 0.5, by - 0.5, bz + 0.5)) return false;
    } else if (s.id === B.LADDER_PX) {
      if (hit.ny === 0 && (hit.nx !== 0 || hit.nz !== 0)) {
        placeId = hit.nx === 1 ? B.LADDER_PX : hit.nx === -1 ? B.LADDER_NX : hit.nz === 1 ? B.LADDER_PZ : B.LADDER_NZ;
        const wallDef = Reg[hit.id];
        if (!(wallDef && wallDef.solid && wallDef.shape === 'cube')) return false;
      } else return false;
    } else if (s.id === B.SNOW_SHEET_1) {
      if (!Physics.solidAt(bx + 0.5, by - 0.5, bz + 0.5)) return false;
    } else if (Reg[s.id].needsSupport && !Physics.solidAt(bx + 0.5, by - 0.5, bz + 0.5)) {
      return false;
    }

    // box-accurate body check (no more slabs/stairs inside yourself)
    const placeKey = World.pkey(bx, by, bz);
    if (sidewaysStairData && World.stairSideways) World.stairSideways.set(placeKey, sidewaysStairData);
    if (Reg[placeId].solid && this.placementBlockedByBodies(placeId, bx, by, bz)) {
      if (sidewaysStairData && World.stairSideways) World.stairSideways.delete(placeKey);
      return false;
    }

    World.setBlock(bx, by, bz, placeId);
    if (isStairs(placeId)) {
      if (sidewaysStairData && World.stairSideways) World.stairSideways.set(placeKey, sidewaysStairData);
      else if (World.stairSideways) World.stairSideways.delete(placeKey);
    }
    if (placeId === B.MR_FLOOP_DRINKING_WATER) {
      const look = this.lookDir();
      let dIdx;
      if (Math.abs(look.x) >= Math.abs(look.z)) dIdx = look.x > 0 ? 0 : 1;
      else dIdx = look.z > 0 ? 2 : 3;
      World.photoDirs.set(World.pkey(bx, by, bz), dIdx);
    }
    if (placeId === B.LORE) World.loreMap.set(World.pkey(bx, by, bz), -1);
    if (placeId === B.SIGN) {
      if (hit.ny === 0 && (hit.nx !== 0 || hit.nz !== 0)) {
        // wall sign
        const dIdx = hit.nx === 1 ? 0 : hit.nx === -1 ? 1 : hit.nz === 1 ? 2 : 3;
        World.signDirs.set(World.pkey(bx, by, bz), { d: dIdx, w: 1 });
      } else {
        // standing sign, 8 directions (45° steps), facing the player
        const ang = Math.atan2(this.body.x - (bx + 0.5), this.body.z - (bz + 0.5));
        let d8 = Math.round(ang / (Math.PI / 4));
        d8 = ((d8 % 8) + 8) % 8;
        World.signDirs.set(World.pkey(bx, by, bz), { d: d8, w: 0 });
      }
      UI.open('sign', { bx, by, bz });
    }
    // freshly placed sand/gravel falls if unsupported
    if (Reg[placeId].gravity && !Physics.solidAt(bx + 0.5, by - 0.5, bz + 0.5)) {
      Dynamics.startFall(bx, by, bz, placeId);
    }
    this.consumeHeld(1);
    SFX.place();
    return true;
  },

  // ---------------- mining ----------------

  // Resolve blocks that behave as one placed structure, so selection outlines
  // and crack overlays cover the whole multiblock instead of only the exact
  // cell the ray hit. Breaking still uses the original hit cell, so special
  // logic like crop harvesting and bed/pot drops stays unchanged.
  bedGroupForHit(bx, by, bz, id) {
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const cells = [[bx, by, bz]];
    const stored = World.bedDirs && World.bedDirs.get(World.pkey(bx, by, bz));
    const isHead = id === B.BED_HEAD || id === B.SUNBED_HEAD;
    const sameFamily = (a) => {
      if (id === B.BED || id === B.BED_HEAD) return a === B.BED || a === B.BED_HEAD;
      return a === B.SUNBED || a === B.SUNBED_HEAD;
    };
    if (stored !== undefined && dirs[stored]) {
      const d = dirs[stored];
      const px = isHead ? bx - d[0] : bx + d[0];
      const pz = isHead ? bz - d[1] : bz + d[1];
      if (sameFamily(World.getBlock(px, by, pz))) cells.push([px, by, pz]);
      return cells;
    }
    const partnerId = id === B.BED_HEAD ? B.BED : id === B.SUNBED_HEAD ? B.SUNBED
      : id === B.BED ? B.BED_HEAD : B.SUNBED_HEAD;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (World.getBlock(bx + dx, by, bz + dz) === partnerId) {
        cells.push([bx + dx, by, bz + dz]);
        break;
      }
    }
    return cells;
  },

  doorGroupForHit(bx, by, bz, id) {
    const baseY = isDoorTop(id) ? by - 1 : by;
    const cells = [];
    for (const yy of [baseY, baseY + 1]) {
      const did = World.getBlock(bx, yy, bz);
      if (isDoor(did)) cells.push([bx, yy, bz]);
    }
    return cells.length ? cells : [[bx, by, bz]];
  },

  // Build selection/crack geometry from the same visible mesh pieces as the
  // world renderer. This is intentionally face-based, not one generic cube,
  // so stairs/slabs/cactus/doors/planters outline and crack on their real shape.
  meshQuadsFromBoxes(boxes) {
    if (!boxes || !boxes.length) return [];
    const eps = 1e-6;
    const addVals = (arr, a, b) => { arr.push(+a.toFixed(6), +b.toFixed(6)); };
    const xs = [], ys = [], zs = [];
    for (const bo of boxes) { addVals(xs, bo[0], bo[3]); addVals(ys, bo[1], bo[4]); addVals(zs, bo[2], bo[5]); }
    const uniq = (arr) => [...new Set(arr)].sort((a, b) => a - b);
    const X = uniq(xs), Y = uniq(ys), Z = uniq(zs);
    const inside = (cx, cy, cz) => boxes.some(bo =>
      cx > bo[0] + eps && cx < bo[3] - eps &&
      cy > bo[1] + eps && cy < bo[4] - eps &&
      cz > bo[2] + eps && cz < bo[5] - eps
    );
    const occ = new Set();
    const key = (i, j, k) => `${i},${j},${k}`;
    for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Y.length - 1; j++) for (let k = 0; k < Z.length - 1; k++) {
      const cx = (X[i] + X[i + 1]) * 0.5, cy = (Y[j] + Y[j + 1]) * 0.5, cz = (Z[k] + Z[k + 1]) * 0.5;
      if (inside(cx, cy, cz)) occ.add(key(i, j, k));
    }
    const has = (i, j, k) => occ.has(key(i, j, k));
    const quads = [];
    for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Y.length - 1; j++) for (let k = 0; k < Z.length - 1; k++) {
      if (!has(i, j, k)) continue;
      const x0 = X[i], x1 = X[i + 1], y0 = Y[j], y1 = Y[j + 1], z0 = Z[k], z1 = Z[k + 1];
      if (!has(i + 1, j, k)) quads.push([[x1,y0,z1], [x1,y0,z0], [x1,y1,z0], [x1,y1,z1]]);
      if (!has(i - 1, j, k)) quads.push([[x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0]]);
      if (!has(i, j + 1, k)) quads.push([[x0,y1,z1], [x1,y1,z1], [x1,y1,z0], [x0,y1,z0]]);
      if (!has(i, j - 1, k)) quads.push([[x0,y0,z0], [x1,y0,z0], [x1,y0,z1], [x0,y0,z1]]);
      if (!has(i, j, k + 1)) quads.push([[x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1]]);
      if (!has(i, j, k - 1)) quads.push([[x1,y0,z0], [x0,y0,z0], [x0,y1,z0], [x1,y1,z0]]);
    }
    return quads;
  },

  offsetQuad(q, o) {
    const ax = q[1][0] - q[0][0], ay = q[1][1] - q[0][1], az = q[1][2] - q[0][2];
    const bx = q[2][0] - q[0][0], by = q[2][1] - q[0][1], bz = q[2][2] - q[0][2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    return q.map(v => [v[0] + nx * o, v[1] + ny * o, v[2] + nz * o]);
  },

  cropPlaneQuads(ox, oy, oz, id, wx, y, wz) {
    const st = isCrop(id) ? cropStage(id) : 3;
    const scale = isCrop(id) ? (0.46 + st * 0.17) : 1;
    const s = scale * 0.5;
    // Crops inside a raised Plantation Pot sit in the upper half of a lower-slab
    // cell. The world renderer and raycast already know that; the highlight and
    // crack mesh must use the same offset so the plant outline is not drawn down
    // inside the slab.
    const yOff = (isCrop(id) && typeof World !== 'undefined' && World && World.plantationYOffset)
      ? World.plantationYOffset(wx, y, wz) : 0;
    const x = ox + 0.5, z = oz + 0.5, yy = oy + yOff + (isCrop(id) ? 0.28 : 0);
    const h = scale;
    return [
      [[x - s, yy, z - s], [x + s, yy, z + s], [x + s, yy + h, z + s], [x - s, yy + h, z - s]],
      [[x - s, yy, z + s], [x + s, yy, z - s], [x + s, yy + h, z - s], [x - s, yy + h, z + s]],
    ];
  },

  planterCellQuads(wx, y, wz, ox, oy, oz, opts) {
    opts = opts || {};
    const isPotLike = (bid) => bid === B.PLANTATION_POT || isCrop(bid);
    const quads = [];
    const yOff = (typeof World !== 'undefined' && World && World.plantationYOffset)
      ? World.plantationYOffset(wx, y, wz) : 0;
    const sameLevelPot = (ax, az) => isPotLike(World.getBlock(ax, y, az)) &&
      (!World.plantationYOffset || World.plantationYOffset(ax, y, az) === yOff);

    // Raised Plantation Pot cells preserve a lower slab underneath, but targeting
    // must stay honest: pot targeting/cracks should show only the 3x3 planter,
    // while slab targeting/cracks should show only the single clicked slab.  Only
    // include the slab mesh when a caller explicitly asks for it.
    const underSlab = (World.plantationUnderSlabs && World.pkey)
      ? World.plantationUnderSlabs.get(World.pkey(wx, y, wz)) : 0;
    if (underSlab && opts.includeUnderSlab) {
      const slabBoxes = (typeof Physics !== 'undefined' && Physics && Physics.rayBoxes)
        ? (Physics.rayBoxes(underSlab, wx, y, wz) || [[0, 0, 0, 1, 0.5, 1]])
        : [[0, 0, 0, 1, 0.5, 1]];
      const shifted = slabBoxes.map(bo => [ox + bo[0], oy + bo[1], oz + bo[2], ox + bo[3], oy + bo[4], oz + bo[5]]);
      quads.push(...this.meshQuadsFromBoxes(shifted));
    }

    const yBase = oy + yOff;
    const yTop = oy + yOff + 0.28;
    // soil tray top
    quads.push([[ox, yTop, oz + 1], [ox + 1, yTop, oz + 1], [ox + 1, yTop, oz], [ox, yTop, oz]]);
    // underside face matches the real planter mesh and is lifted slightly like the render mesh
    const yBottom = oy + yOff + 0.015;
    quads.push([[ox, yBottom, oz], [ox + 1, yBottom, oz], [ox + 1, yBottom, oz + 1], [ox, yBottom, oz + 1]]);
    // low pot side faces only where the real mesh renders them
    if (!sameLevelPot(wx + 1, wz)) quads.push([[ox + 1, yBase, oz + 1], [ox + 1, yBase, oz], [ox + 1, yTop, oz], [ox + 1, yTop, oz + 1]]);
    if (!sameLevelPot(wx - 1, wz)) quads.push([[ox, yBase, oz], [ox, yBase, oz + 1], [ox, yTop, oz + 1], [ox, yTop, oz]]);
    if (!sameLevelPot(wx, wz + 1)) quads.push([[ox, yBase, oz + 1], [ox + 1, yBase, oz + 1], [ox + 1, yTop, oz + 1], [ox, yTop, oz + 1]]);
    if (!sameLevelPot(wx, wz - 1)) quads.push([[ox + 1, yBase, oz], [ox, yBase, oz], [ox, yTop, oz], [ox + 1, yTop, oz]]);

    const rimBoxes = [];
    if (!sameLevelPot(wx, wz - 1)) rimBoxes.push([ox, oy + yOff + 0.28, oz, ox + 1, oy + yOff + 0.42, oz + 0.12]);
    if (!sameLevelPot(wx, wz + 1)) rimBoxes.push([ox, oy + yOff + 0.28, oz + 0.88, ox + 1, oy + yOff + 0.42, oz + 1]);
    if (!sameLevelPot(wx - 1, wz)) rimBoxes.push([ox, oy + yOff + 0.28, oz + 0.12, ox + 0.12, oy + yOff + 0.42, oz + 0.88]);
    if (!sameLevelPot(wx + 1, wz)) rimBoxes.push([ox + 0.88, oy + yOff + 0.28, oz + 0.12, ox + 1, oy + yOff + 0.42, oz + 0.88]);
    return quads.concat(this.meshQuadsFromBoxes(rimBoxes));
  },

  blockTargetQuads(id, wx, y, wz, ox, oy, oz, opts) {
    opts = opts || {};
    const def = Reg[id];
    if (!def || !def.block) return [];
    if (id === B.PLANTATION_POT || isCrop(id)) {
      const underSlab = (World.plantationUnderSlabs && World.pkey)
        ? World.plantationUnderSlabs.get(World.pkey(wx, y, wz)) : 0;
      if (opts.underSlabOnly && underSlab) {
        const slabBoxes = (typeof Physics !== 'undefined' && Physics && Physics.rayBoxes)
          ? (Physics.rayBoxes(underSlab, wx, y, wz) || [[0, 0, 0, 1, 0.5, 1]])
          : [[0, 0, 0, 1, 0.5, 1]];
        const shifted = slabBoxes.map(bo => [ox + bo[0], oy + bo[1], oz + bo[2], ox + bo[3], oy + bo[4], oz + bo[5]]);
        return this.meshQuadsFromBoxes(shifted);
      }
      if (isCrop(id) && opts.cropOnly) return this.cropPlaneQuads(ox, oy, oz, id, wx, y, wz);
      const qs = this.planterCellQuads(wx, y, wz, ox, oy, oz, opts);
      if (isCrop(id) && !opts.potOnly) qs.push(...this.cropPlaneQuads(ox, oy, oz, id, wx, y, wz));
      return qs;
    }
    if (def.shape === 'cross' || def.shape === 'mega') return this.cropPlaneQuads(ox, oy, oz, id, wx, y, wz);

    let boxes = null;
    if (def.shape === 'bed') {
      boxes = [[0, 0, 0, 1, 0.2, 1], [0, 0.2, 0, 1, 0.56, 1]];
    } else if (def.shape === 'door') {
      boxes = isDoorX(id) ? [[0.38, 0, 0, 0.62, 1, 1]] : [[0, 0, 0.38, 1, 1, 0.62]];
    } else if (def.shape === 'doorOpen') {
      boxes = isDoorX(id) ? [[0, 0, 0, 1, 1, 0.16]] : [[0, 0, 0, 0.16, 1, 1]];
    } else {
      boxes = Physics.rayBoxes(id, wx, y, wz) || [[0, 0, 0, 1, 1, 1]];
    }
    boxes = boxes.map(bo => [ox + bo[0], oy + bo[1], oz + bo[2], ox + bo[3], oy + bo[4], oz + bo[5]]);
    return this.meshQuadsFromBoxes(boxes);
  },


  activeAreaMiningTool(hit) {
    const s = this.held();
    const tool = s && Reg[s.id] && Reg[s.id].tool;
    const id = hit && hit.id;
    const def = id !== undefined ? Reg[id] : null;
    // 3x3 preview only applies to the tools whose actual break code does an
    // area sweep. Sneak still forces precise 1x1 mining.
    if (!tool || !tool.area || this.sneaking || !hit || !def) return null;
    if (id === B.AIR || id === B.BEDROCK || isFluid(id) || def.hard === Infinity) return null;
    if (hit.targetPart === 'underSlab' || hit.targetPart === 'crop') return null;
    if (id === B.PLANTATION_POT || isCrop(id) || isBed(id) || isDoor(id) || isDSlab(id)) return null;
    return tool;
  },

  areaMiningCellsForHit(hit, tool) {
    const cells = [[hit.bx, hit.by, hit.bz]];
    const nx = Math.abs(hit.nx), ny = Math.abs(hit.ny);
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        if (a === 0 && b === 0) continue;
        let tx = hit.bx, ty = hit.by, tz = hit.bz;
        // Keep this plane math matched with breakBlockAt's actual 3x3 sweep.
        if (ny === 1) { tx += a; tz += b; }
        else if (nx === 1) { ty += a; tz += b; }
        else { tx += a; ty += b; }
        const tid = World.getBlock(tx, ty, tz);
        if (tid === B.AIR || tid === B.BEDROCK || isFluid(tid)) continue;
        const tdef = Reg[tid];
        if (!tdef || tdef.hard === Infinity) continue;
        if (tdef.tool !== tool.type) continue;
        cells.push([tx, ty, tz]);
      }
    }
    return cells;
  },

  miningProgressWearPerStage(target) {
    // A small fractional wear charge is paid as crack stages appear. This stops
    // the exploit where a tool can do nearly all the mining work, then the
    // player swaps to their fist for the final hit with no tool wear at all.
    const areaCells = target && target.kind === 'area' && Array.isArray(target.cells) ? target.cells.length : 1;
    return Math.max(0.2, Math.min(0.5, 0.2 + (areaCells - 1) * 0.025));
  },

  damageHeldForMiningProgress(target) {
    const s = this.held();
    const def = s && Reg[s.id];
    const tool = def && def.tool;
    if (!def || !def.maxDur || !tool) return;
    if (tool.type !== 'pickaxe' && tool.type !== 'shovel' && tool.type !== 'axe') return;
    this.damageHeld(this.miningProgressWearPerStage(target));
  },

  multiblockMiningTarget(hit) {
    if (!hit) return null;
    const id = hit.id;
    let kind = 'single';
    let cells = [[hit.bx, hit.by, hit.bz]];
    let targetOpts = {};

    if (hit.targetPart === 'underSlab') {
      // Raised Plantation Pots can sit in the upper half of a 3x3 pad of lower slabs.
      // When the ray hits the lower slab area, target only that single slab shape,
      // not the planter above it and not the whole 3x3 multiblock.
      kind = 'underSlab';
      targetOpts.underSlabOnly = true;
    } else if (hit.targetPart === 'crop' && isCrop(id)) {
      // Looking at the plant itself: outline/crack only the crossed crop mesh,
      // not the whole 3x3 planter. This makes it obvious you are harvesting the
      // crop instead of breaking the pot.
      kind = 'crop';
      targetOpts.cropOnly = true;
    } else if (id === B.PLANTATION_POT || isCrop(id)) {
      kind = 'plantation';
      cells = World.plantationGroupFor(hit.bx, hit.by, hit.bz);
      targetOpts.potOnly = true;
    } else if (isBed(id)) {
      kind = 'bed';
      cells = this.bedGroupForHit(hit.bx, hit.by, hit.bz, id);
    } else if (isDoor(id)) {
      kind = 'door';
      cells = this.doorGroupForHit(hit.bx, hit.by, hit.bz, id);
    }

    if (kind === 'single') {
      const areaTool = this.activeAreaMiningTool(hit);
      if (areaTool) {
        cells = this.areaMiningCellsForHit(hit, areaTool);
        kind = 'area';
      }
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of cells) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
    }

    let quads = [];
    for (const [x, y, z] of cells) {
      let cid = World.getBlock(x, y, z);
      if (kind === 'plantation' && hit.actualId && x === hit.bx && y === hit.by && z === hit.bz) cid = hit.actualId;
      quads.push(...this.blockTargetQuads(cid, x, y, z, x - minX, y - minY, z - minZ, targetOpts));
    }
    if (!quads.length) quads = this.meshQuadsFromBoxes([[0, 0, 0, maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1]]);

    const cellKey = cells.map(([x, y, z]) => `${x},${y},${z}:${World.getBlock(x, y, z)}`).sort().join('|');
    const geoKey = quads.map(q => q.flat().map(n => n.toFixed(3)).join(',')).join(';');
    return {
      kind,
      key: `${kind}:${cellKey}:${geoKey}`,
      mineKey: `${kind}:${cells.map(([x, y, z]) => `${x},${y},${z}`).sort().join('|')}`,
      anchorX: minX, anchorY: minY, anchorZ: minZ,
      cells: cells.map(([x, y, z]) => [x, y, z]),
      quads,
    };
  },

  miningStats(id) {
    const def = Reg[id];
    if (this.gamemode === 'creative') return { time: 0.05, toolOk: false };
    const s = this.held();
    const tool = s && Reg[s.id].tool;
    let speed = 1;
    let toolOk = def.reqTier < 0;
    if (tool && def.tool && tool.type === def.tool) {
      speed = tool.speed;
      if (tool.tier >= def.reqTier) toolOk = true;
    }
    let time = def.hard / speed;
    if (def.reqTier >= 0 && !toolOk) time = def.hard * 1.6;
    return { time: Math.max(0.05, time), toolOk };
  },

  mineDamageKey(target) {
    const dim = (typeof Dimensions !== 'undefined' && Dimensions.current)
      ? Dimensions.current : ((typeof World !== 'undefined' && World.dimensionId) ? World.dimensionId : 'overworld');
    return `${dim}:${target.mineKey}`;
  },

  mineDamageCellKey(x, y, z) {
    return `${x},${y},${z}`;
  },

  mineDamageCellSetFromCells(cells) {
    const set = new Set();
    if (!Array.isArray(cells)) return set;
    for (const c of cells) {
      if (!c) continue;
      set.add(this.mineDamageCellKey(c[0], c[1], c[2]));
    }
    return set;
  },

  mineDamageCellSetForTarget(target) {
    return this.mineDamageCellSetFromCells(target && target.cells);
  },

  mineDamageEntryOverlapsSet(entry, cellSet) {
    if (!entry || !cellSet || !cellSet.size || !Array.isArray(entry.cells)) return false;
    for (const c of entry.cells) {
      if (c && cellSet.has(this.mineDamageCellKey(c[0], c[1], c[2]))) return true;
    }
    return false;
  },

  snapshotBreakCells(cells) {
    const live = [];
    if (Array.isArray(cells)) {
      for (const c of cells) {
        if (!c) continue;
        const x = c[0], y = c[1], z = c[2];
        const id = World.getBlock(x, y, z);
        const def = Reg[id];
        if (id === B.AIR || isFluid(id) || !def || !def.block) continue;
        live.push([x, y, z, id]);
      }
    }
    if (!live.length) return null;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    for (const [x, y, z] of live) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
    }

    let quads = [];
    for (const [x, y, z, id] of live) {
      quads.push(...this.blockTargetQuads(id, x, y, z, x - minX, y - minY, z - minZ, {}));
    }
    if (!quads.length) return null;

    const cellSig = live.map(([x, y, z, id]) => `${x},${y},${z}:${id}`).sort().join('|');
    const geoKey = quads.map(q => q.flat().map(n => n.toFixed(3)).join(',')).join(';');
    return {
      key: `cells:${cellSig}:${geoKey}`,
      anchorX: minX, anchorY: minY, anchorZ: minZ,
      quads: this.cloneBreakQuads(quads),
    };
  },

  absorbOverlappingMineDamage(target, skipKey) {
    const result = { progress: 0, wearStage: -1 };
    if (!(this.mineDamage instanceof Map) || !target) return result;
    const activeCells = this.mineDamageCellSetForTarget(target);
    if (!activeCells.size) return result;
    const prefix = this.currentMineDamagePrefix();

    for (const [key, entry] of [...this.mineDamage.entries()]) {
      if (key === skipKey) continue;
      if (!key.startsWith(prefix)) continue;
      if (!this.mineDamageEntryOverlapsSet(entry, activeCells)) continue;

      result.progress = Math.max(result.progress, entry.progress || 0);
      if (Number.isFinite(entry.wearStage)) result.wearStage = Math.max(result.wearStage, entry.wearStage);

      const remaining = (entry.cells || []).filter(c => c && !activeCells.has(this.mineDamageCellKey(c[0], c[1], c[2])));
      if (!remaining.length) {
        this.mineDamage.delete(key);
        continue;
      }

      const vis = this.snapshotBreakCells(remaining);
      if (!vis) {
        this.mineDamage.delete(key);
        continue;
      }
      entry.cells = remaining.map(c => [c[0], c[1], c[2]]);
      entry.vis = vis;
      entry.sig = vis.key;
    }
    return result;
  },

  mineDamageKeyTouchesCoord(key, x, y, z) {
    const coord = `${x},${y},${z}`;
    const s = String(key || '');
    // Mine keys store coordinates after ':' or '|', then end or another '|'.
    // Keep this strict so clearing 1,2,3 does not accidentally clear 11,2,3.
    return s === coord || s.includes(`:${coord}`) || s.includes(`|${coord}`);
  },

  clearBreakDamageAt(x, y, z) {
    if (!(this.mineDamage instanceof Map) || this.mineDamage.size === 0) return;
    let touchedActive = false;
    let removed = false;
    // This runs from World.setBlock, which can fire many times during 3x3 tools,
    // falling blocks, fluids, explosions, and support chains. Do not clone the
    // whole Map and do not rebuild every crack mesh from inside setBlock; that
    // made block breaking hitch hard enough to briefly expose unloaded faces.
    // Deleting during Map iteration is safe in JS, and updateMining redraws the
    // remaining overlays once per frame.
    for (const [key, entry] of this.mineDamage) {
      const hitsEntry = entry && Array.isArray(entry.cells)
        ? entry.cells.some(c => c && c[0] === x && c[1] === y && c[2] === z)
        : this.mineDamageKeyTouchesCoord(key, x, y, z);
      if (!hitsEntry) continue;
      this.mineDamage.delete(key);
      removed = true;
      if (this.mineTarget === key || this.mineDamageKeyTouchesCoord(this.mineTarget, x, y, z)) touchedActive = true;
    }
    if (this.mineTarget && this.mineDamageKeyTouchesCoord(this.mineTarget, x, y, z)) touchedActive = true;
    if (touchedActive) {
      this.mineTarget = null;
      this.mineProgress = 0;
      if (this.breakOverlay) this.breakOverlay.visible = false;
      if (this.highlight) {
        this.highlight.visible = false;
        this._hlKey = null;
      }
    }
    if (removed) this.breakDamageDirty = true;
  },

  crackStageForProgress(progress) {
    if (!(progress > 0)) return -1;
    return Math.max(0, Math.min(4, Math.floor(Math.min(0.999, progress) * 5)));
  },

  // Multiplayer: report EVERY block we're currently cracking (each mineDamage entry may
  // cover several cells for 3x3/multiblock tools). Others render the whole set + revert.
  syncBreakDamageToNet() {
    if (typeof Multiplayer === 'undefined' || !Multiplayer.connected || Multiplayer.role === 'solo') return;
    if (!(this.mineDamage instanceof Map)) { Multiplayer.sendBreakSet([]); return; }
    const prefix = this.currentMineDamagePrefix();
    const blocks = [];
    for (const [key, entry] of this.mineDamage.entries()) {
      if (!key.startsWith(prefix) || !entry) continue;
      const stage = this.crackStageForProgress(entry.progress || 0);
      if (stage < 0) continue;
      const cells = (entry.cells && entry.cells.length) ? entry.cells : null;
      if (cells) for (const c of cells) blocks.push([c[0] | 0, c[1] | 0, c[2] | 0, stage]);
    }
    Multiplayer.sendBreakSet(blocks);
  },

  tickMineDamage(dt, activeKey) {
    if (!(this.mineDamage instanceof Map)) this.mineDamage = new Map();
    for (const [key, entry] of [...this.mineDamage.entries()]) {
      if (key === activeKey) continue;
      entry.idleT = (entry.idleT || 0) + dt;
      if (entry.idleT < 3) continue;
      entry.healT = (entry.healT || 0) + dt;
      while (entry.healT >= 0.5 && entry.progress > 0) {
        entry.progress = Math.max(0, entry.progress - 0.2);
        entry.healT -= 0.5;
      }
      const healedStage = this.crackStageForProgress(entry.progress);
      if (Number.isFinite(entry.wearStage)) entry.wearStage = Math.min(entry.wearStage, healedStage);
      if (entry.progress <= 0.0001) this.mineDamage.delete(key);
    }
  },

  cloneBreakQuads(quads) {
    return (quads || []).map(q => q.map(v => [v[0], v[1], v[2]]));
  },

  snapshotBreakTarget(target) {
    if (!target) return null;
    return {
      key: target.key,
      anchorX: target.anchorX, anchorY: target.anchorY, anchorZ: target.anchorZ,
      quads: this.cloneBreakQuads(target.quads && target.quads.length ? target.quads : this.meshQuadsFromBoxes([[0, 0, 0, 1, 1, 1]])),
    };
  },

  makeBreakDamageGeometry(quads) {
    const pos = [], uvArr = [], idxArr = [];
    const o = 0.004;
    for (const q of (quads && quads.length ? quads : this.meshQuadsFromBoxes([[0, 0, 0, 1, 1, 1]]))) {
      const qq = this.offsetQuad(q, o);
      const base = pos.length / 3;
      for (const v of qq) pos.push(v[0], v[1], v[2]);
      uvArr.push(0, 0, 1, 0, 1, 1, 0, 1);
      idxArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    g.setIndex(idxArr);
    return g;
  },

  getBreakDamageOverlayMesh(i) {
    if (!this.breakDamageOverlays) this.breakDamageOverlays = [];
    if (!this.breakDamageOverlays[i]) {
      const mesh = new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial({
          map: this.crackTex[0], transparent: true, depthWrite: false, side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: -2,
        })
      );
      mesh.visible = false;
      this.breakDamageOverlays[i] = mesh;
      Game.scene.add(mesh);
    }
    return this.breakDamageOverlays[i];
  },

  currentMineDamagePrefix() {
    const dim = (typeof Dimensions !== 'undefined' && Dimensions.current)
      ? Dimensions.current : ((typeof World !== 'undefined' && World.dimensionId) ? World.dimensionId : 'overworld');
    return `${dim}:`;
  },

  renderStoredBreakDamage(skipKey, activeTarget) {
    if (!(this.mineDamage instanceof Map)) this.mineDamage = new Map();
    const prefix = this.currentMineDamagePrefix();
    const activeCells = this.mineDamageCellSetForTarget(activeTarget);
    let used = 0;
    for (const [key, entry] of this.mineDamage.entries()) {
      if (key === skipKey) continue;
      if (!key.startsWith(prefix)) continue;
      if (!entry || !entry.vis) continue;
      const stage = this.crackStageForProgress(entry.progress || 0);
      if (stage < 0) continue;

      let vis = entry.vis;
      // Safety net: never draw stored cracks on top of the active target.
      // This prevents the old 3x3 grouped overlay and the current 1x1 overlay
      // from stacking in the same exact block space.
      if (activeCells.size && this.mineDamageEntryOverlapsSet(entry, activeCells)) {
        const remaining = (entry.cells || []).filter(c => c && !activeCells.has(this.mineDamageCellKey(c[0], c[1], c[2])));
        vis = this.snapshotBreakCells(remaining);
        if (!vis) continue;
      }

      const mesh = this.getBreakDamageOverlayMesh(used++);
      if (mesh._breakGeoKey !== vis.key) {
        if (mesh.geometry) mesh.geometry.dispose();
        mesh.geometry = this.makeBreakDamageGeometry(vis.quads);
        mesh._breakGeoKey = vis.key;
      }
      mesh.position.set(vis.anchorX, vis.anchorY, vis.anchorZ);
      if (mesh.material.map !== this.crackTex[stage]) {
        mesh.material.map = this.crackTex[stage];
        mesh.material.needsUpdate = true;
      }
      mesh.visible = true;
    }
    if (this.breakDamageOverlays) {
      for (let i = used; i < this.breakDamageOverlays.length; i++) this.breakDamageOverlays[i].visible = false;
    }
  },

  showBreakDamage(target, progress) {
    const stage = this.crackStageForProgress(progress);
    if (stage < 0) { this.breakOverlay.visible = false; return; }
    this.breakOverlay.visible = true;
    this.breakOverlay.position.set(target.anchorX, target.anchorY, target.anchorZ); // geometry is in target-local coords now
    if (this.breakOverlay.material.map !== this.crackTex[stage]) {
      this.breakOverlay.material.map = this.crackTex[stage];
      this.breakOverlay.material.needsUpdate = true;
    }
  },

  updateMining(dt) {
    const d = this.lookDir();
    const hit = this.dead ? null : World.raycast(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 5);
    const target = hit ? this.multiblockMiningTarget(hit) : null;

    if (hit && target) {
      this.highlight.visible = true;
      // outline the ACTUAL shape. Multiblocks resolve to their whole placed
      // structure, so beds/doors/3x3 planters no longer highlight only one cell.
      const hlKey = target.key;
      if (hlKey !== this._hlKey) {
        this._hlKey = hlKey;
        const quads = target.quads && target.quads.length ? target.quads : this.meshQuadsFromBoxes([[0, 0, 0, 1, 1, 1]]);
        const segs = [];
        const o = 0.004; // outset so lines/cracks don't z-fight the target mesh
        for (const q of quads) {
          const qq = this.offsetQuad(q, o);
          for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) segs.push(...qq[a], ...qq[b]);
        }
        this.highlight.geometry.dispose();
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
        this.highlight.geometry = g;

        // Crack overlay now uses the real exposed mesh faces, not AABB target boxes.
        const pos = [], uvArr = [], idxArr = [];
        for (const q of quads) {
          const qq = this.offsetQuad(q, o);
          const base = pos.length / 3;
          for (const v of qq) pos.push(v[0], v[1], v[2]);
          uvArr.push(0, 0, 1, 0, 1, 1, 0, 1);
          idxArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        this.breakOverlay.geometry.dispose();
        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        bg.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
        bg.setIndex(idxArr);
        this.breakOverlay.geometry = bg;
      }
      this.highlight.position.set(target.anchorX, target.anchorY, target.anchorZ);
    } else {
      this.highlight.visible = false;
      this._hlKey = null;
    }

    let key = null;
    let entry = null;
    let canMine = false;
    let toolOk = false;
    let time = 0.05;
    if (hit && target) {
      key = this.mineDamageKey(target);
      entry = this.mineDamage.get(key);
      // If the same coordinates now contain a different shape/block, old damage
      // should not appear on the replacement block.
      if (entry && entry.sig !== target.key) {
        this.mineDamage.delete(key);
        entry = null;
      }

      const def = Reg[hit.id];
      // creative smashes bedrock too
      canMine = !!(this.lmb && def && (def.hard !== Infinity || this.gamemode === 'creative'));
      if (canMine) ({ time, toolOk } = this.miningStats(hit.id));
    }

    this.tickMineDamage(dt, canMine ? key : null);
    // broadcast the FULL set of blocks we're currently cracking (active + lingering,
    // single + 3x3/multiblock) so every other player sees all of them revert naturally
    this.syncBreakDamageToNet();

    if (!canMine) {
      this.mineTarget = null;
      this.mineProgress = entry ? entry.progress : 0;
      if (hit && target && entry && entry.progress > 0) {
        entry.vis = this.snapshotBreakTarget(target);
        entry.sig = target.key;
        this.showBreakDamage(target, entry.progress);
        this.renderStoredBreakDamage(key, target);
      } else {
        this.breakOverlay.visible = false;
        this.renderStoredBreakDamage(null);
      }
      return;
    }

    const absorbedDamage = this.absorbOverlappingMineDamage(target, key);
    if (!entry) {
      const inheritedProgress = Math.max(0, absorbedDamage.progress || 0);
      const inheritedStage = Math.max(
        Number.isFinite(absorbedDamage.wearStage) ? absorbedDamage.wearStage : -1,
        this.crackStageForProgress(inheritedProgress)
      );
      entry = { progress: inheritedProgress, idleT: 0, healT: 0, wearStage: inheritedStage, sig: target.key, cells: target.cells ? target.cells.map(c => [c[0], c[1], c[2]]) : null, vis: this.snapshotBreakTarget(target) };
      this.mineDamage.set(key, entry);
    } else if ((absorbedDamage.progress || 0) > (entry.progress || 0)) {
      entry.progress = absorbedDamage.progress;
      entry.wearStage = Math.max(
        Number.isFinite(entry.wearStage) ? entry.wearStage : -1,
        Number.isFinite(absorbedDamage.wearStage) ? absorbedDamage.wearStage : -1,
        this.crackStageForProgress(entry.progress)
      );
    }
    entry.idleT = 0;
    entry.healT = 0;
    entry.sig = target.key;
    entry.cells = target.cells ? target.cells.map(c => [c[0], c[1], c[2]]) : null;
    entry.vis = this.snapshotBreakTarget(target);

    this.mineTarget = key;
    const prevWearStage = Number.isFinite(entry.wearStage) ? entry.wearStage : -1;
    entry.progress += dt / time;
    const newWearStage = this.crackStageForProgress(entry.progress);
    if (newWearStage > prevWearStage) {
      for (let ws = prevWearStage + 1; ws <= newWearStage; ws++) this.damageHeldForMiningProgress(target);
      entry.wearStage = newWearStage;
    }
    this.mineProgress = entry.progress;
    this.showBreakDamage(target, entry.progress);
    this.renderStoredBreakDamage(key, target);
    if (Math.random() < 8 * dt) SFX.dig();

    if (entry.progress >= 1) {
      this.mineDamage.delete(key);
      this.mineProgress = 0;
      this.mineTarget = null;
      this.breakOverlay.visible = false;
      this.breakBlockAt(hit.bx, hit.by, hit.bz, hit.id, toolOk, hit);
      this.renderStoredBreakDamage(null);
    }
  },

  breakOne(bx, by, bz, id, toolOk, noUpdate) {
    const mb = World.multiblockGroupFor && World.multiblockGroupFor(bx, by, bz);
    if (mb) {
      World.destroyMultiblockAt(bx, by, bz, { drop: this.gamemode !== 'creative' && toolOk, particles: true });
      if (Reg[id].hard > 0.1) this.damageHeld(1);
      if (toolOk && Reg[id].xp) this.addXp(Reg[id].xp);
      return;
    }
    World.setBlock(bx, by, bz, B.AIR, noUpdate ? { noUpdate: true } : undefined);
    Particles.blockBurst(bx, by, bz, id);
    if (Reg[id].hard > 0.1) this.damageHeld(1); // trivial blocks don't wear tools
    if (id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG || id === B.OASIS_LOG) Dynamics.queueLeafDecay(bx, by, bz);
    if (this.gamemode !== 'creative') {
      // snow sheets: only shovels harvest snowballs
      if (isSnowSheet(id) || id === B.SNOW) {
        const s = this.held();
        const tool = s && Reg[s.id].tool;
        if (tool && tool.type === 'shovel') {
          const n = id === B.SNOW ? 4 : Math.max(1, Math.ceil(snowSheetLevel(id) / 2));
          Drops.spawn(bx + 0.5, by + 0.4, bz + 0.5, I.SNOWBALL, n);
        } else if (id === B.SNOW) {
          Drops.dropFromBlock(bx, by, bz, id, toolOk);
        }
      } else {
        Drops.dropFromBlock(bx, by, bz, id, toolOk);
      }
      if (toolOk && Reg[id].xp) this.addXp(Reg[id].xp);
    }
  },

  breakBlockAt(bx, by, bz, id, toolOk, hit) {
    if (hit && hit.targetPart === 'underSlab') {
      const k = World.pkey(bx, by, bz);
      const storedSlab = World.plantationUnderSlabs && World.plantationUnderSlabs.get(k);
      if (storedSlab) {
        // Break the clicked lower slab first. That removes support for this one
        // planter cell, so the linked 3x3 Plantation Pot collapses, while the
        // other eight lower slabs are restored/kept in place.
        World.plantationUnderSlabs.delete(k);
        World.destroyMultiblockAt(bx, by, bz, { drop: this.gamemode !== 'creative', kind: 'plantation', particles: true });
        if (this.gamemode !== 'creative') Drops.dropFromBlock(bx, by, bz, storedSlab, toolOk);
        if (Reg[storedSlab] && Reg[storedSlab].hard > 0.1) this.damageHeld(1);
        SFX.breakBlk();
        return;
      }
    }
    if (isCrop(id)) {
      World.setBlock(bx, by, bz, B.PLANTATION_POT);
      if (this.gamemode !== 'creative') {
        const mature = cropStage(id) >= 3;
        Drops.spawn(bx + 0.5, by + 0.55, bz + 0.5, mature ? I.FLOOPFRUIT : I.FLOOPFRUIT_SEEDS, mature ? 1 + ((Math.random() * 2) | 0) : 1);
        if (mature && Math.random() < 0.55) Drops.spawn(bx + 0.5, by + 0.65, bz + 0.5, I.FLOOPFRUIT_SEEDS, 1 + ((Math.random() * 2) | 0));
      }
      SFX.breakBlk();
      return;
    }
    if (id === B.PLANTATION_POT) {
      World.destroyMultiblockAt(bx, by, bz, { drop: this.gamemode !== 'creative', kind: 'plantation' });
      SFX.breakBlk();
      return;
    }
    if (isDoor(id)) {
      World.destroyMultiblockAt(bx, by, bz, { drop: this.gamemode !== 'creative', kind: 'door' });
      SFX.breakBlk();
      return;
    }
    if (isBed(id)) {
      World.destroyMultiblockAt(bx, by, bz, { drop: this.gamemode !== 'creative', kind: 'bed' });
      SFX.breakBlk();
      return;
    }
    if (isDSlab(id)) {
      // two-piece slabs give BOTH original slab items back
      const drops = slabComboDropIds(id);
      World.setBlock(bx, by, bz, B.AIR);
      if (this.gamemode !== 'creative') {
        drops.forEach((dropId, i) => Drops.spawn(bx + 0.5, by + 0.35 + i * 0.2, bz + 0.5, dropId, 1));
      }
      SFX.breakBlk();
      return;
    }

    // 3x3 hammers & excavators (hold Shift for a precise 1x1 that saves durability)
    const s = this.held();
    const tool = s && Reg[s.id].tool;
    const area = !!(tool && tool.area && hit && !this.sneaking);
    // area sweep: the center's updates are deferred too — otherwise its
    // checkSupports starts a sand cascade that steals cells from the 3x3
    this.breakOne(bx, by, bz, id, toolOk, area);
    SFX.breakBlk();
    this.exhaustion += 0.03;
    this.swingViewmodel();

    if (area) {
      const nx = Math.abs(hit.nx), ny = Math.abs(hit.ny), nz = Math.abs(hit.nz);
      // collect ALL targets first — otherwise sand/gravel starts falling into
      // cells we haven't broken yet and steals blocks from the 3x3
      const targets = [];
      for (let a = -1; a <= 1; a++) {
        for (let b2 = -1; b2 <= 1; b2++) {
          if (a === 0 && b2 === 0) continue;
          let tx = bx, ty = by, tz = bz;
          if (ny === 1) { tx += a; tz += b2; }
          else if (nx === 1) { ty += a; tz += b2; }
          else { tx += a; ty += b2; }
          const tid = World.getBlock(tx, ty, tz);
          if (tid === B.AIR || tid === B.BEDROCK || isFluid(tid)) continue;
          const tdef = Reg[tid];
          if (tdef.tool !== tool.type) continue;
          if (tdef.hard === Infinity) continue;
          targets.push([tx, ty, tz, tid]);
        }
      }
      // break silently (no block updates mid-sweep)...
      for (const [tx, ty, tz, tid] of targets) {
        const stats = this.miningStats(tid);
        this.breakOne(tx, ty, tz, tid, stats.toolOk, true);
      }
      // ...then run the deferred updates once everything is out (center included)
      targets.push([bx, by, bz, id]);
      for (const [tx, ty, tz] of targets) {
        World.checkSupports(tx, ty, tz, B.AIR);
        Water.schedule(tx, ty, tz); Water.schedule(tx, ty + 1, tz); Water.schedule(tx, ty - 1, tz);
        Water.schedule(tx + 1, ty, tz); Water.schedule(tx - 1, ty, tz);
        Water.schedule(tx, ty, tz + 1); Water.schedule(tx, ty, tz - 1);
        Lava.schedule(tx, ty, tz); Lava.schedule(tx, ty + 1, tz);
      }
    }
  },

  // ---------------- health / hunger ----------------
  hurt(dmg, kx, kz, opts) {
    opts = opts || {};
    if (this.dead || this.invulnT > 0) return;
    if (this.gamemode === 'creative') return;
    // Lava boat riders are handled in Dynamics.hazardCheck by ignoring only
    // the lower-leg contact area. Do not blanket-cancel lava damage here;
    // if the rider's upper body is actually in lava, it should still hurt.
    if (!opts.pierce) {
      const pts = this.armorPoints();
      dmg = Math.max(1, Math.round(dmg * (1 - Math.min(0.75, pts * 0.035))));
    }
    this.hp -= dmg;
    this.invulnT = 0.5;
    this.body.vx += kx || 0;
    this.body.vz += kz || 0;
    this.body.vy = Math.max(this.body.vy, 4.5);
    SFX.hurt();
    UI.damageFlash();
    UI.updateStats();
    if (this.hp <= 0) this.die();
  },

  die() {
    this.dead = true;
    this.hp = 0;
    Vehicles.stopBoard(true, true);
    if (Vehicles.driving || Vehicles.boating) Vehicles.exit(true);
    for (let i = 0; i < 36; i++) {
      const s = this.inv[i];
      if (s) {
        Drops.spawn(this.body.x, this.body.y + 1, this.body.z, s.id, s.count,
          [(Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5], s.dur);
        this.inv[i] = null;
      }
    }
    for (let i = 0; i < 4; i++) {
      if (this.armor[i]) {
        Drops.spawn(this.body.x, this.body.y + 1, this.body.z, this.armor[i].id, 1,
          null, this.armor[i].dur);
        this.armor[i] = null;
      }
    }
    UI.updateHotbar();
    UI.open('death');
  },

  respawn() {
    this.dead = false;
    this.hp = 20; this.hunger = 20; this.exhaustion = 0; this.air = 10;
    this.fallDist = 0;
    this.swimming = false;
    this.body.h = 1.8;
    // respawn in the spawn point's OWN dimension — dying in another dimension must send
    // you home, not drop you at your home coordinates in the wrong world (void fall).
    const spawnDim = this.spawn.dim || 'overworld';
    if (typeof Dimensions !== 'undefined' && Dimensions.current !== spawnDim && Dimensions.switchTo) {
      Dimensions.travelCooldown = 0;
      Dimensions.switchTo(spawnDim, { x: this.spawn.x, y: this.spawn.y, z: this.spawn.z });
    } else {
      this.body.x = this.spawn.x; this.body.y = this.spawn.y; this.body.z = this.spawn.z;
    }
    this.body.vx = this.body.vy = this.body.vz = 0;
    UI.updateStats();
    UI.updateHotbar();
  },

  headInsideBlock() {
    const cam = this.camera && this.camera.position ? this.camera.position : null;
    const hx = cam ? cam.x : this.body.x;
    const hy = cam ? cam.y : this.eyeY();
    const hz = cam ? cam.z : this.body.z;

    // Anti-xray/suffocation should trigger when the camera/head itself clips
    // into an opaque block, not when the player merely looks at a ceiling.
    // Keep the probe compact and mostly horizontal so looking up under a block
    // cannot shove the test volume into the block above.
    const dir = this.lookDir ? this.lookDir() : { x: 0, y: 0, z: 0 };
    const horizLen = Math.hypot(dir.x || 0, dir.z || 0);
    const forward = horizLen > 0.2 ? 0.10 : 0;
    const nx = horizLen > 0 ? (dir.x || 0) / horizLen : 0;
    const nz = horizLen > 0 ? (dir.z || 0) / horizLen : 0;
    const r = 0.12;
    const yPad = 0.07;
    const fx = hx + nx * forward;
    const fz = hz + nz * forward;
    const minX = Math.min(hx, fx) - r, maxX = Math.max(hx, fx) + r;
    const minY = hy - yPad, maxY = hy + yPad;
    const minZ = Math.min(hz, fz) - r, maxZ = Math.max(hz, fz) + r;

    const bx0 = Math.floor(minX) - 1, bx1 = Math.floor(maxX) + 1;
    const by0 = Math.floor(minY) - 1, by1 = Math.floor(maxY) + 1;
    const bz0 = Math.floor(minZ) - 1, bz1 = Math.floor(maxZ) + 1;
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) for (let bz = bz0; bz <= bz1; bz++) {
      const id = World.getBlock(bx, by, bz);
      if (id === B.AIR || isFluid(id)) continue;
      const def = Reg[id];
      if (!def || !def.block) continue;
      const boxes = Physics.blockBoxes(id, bx, by, bz);
      if (!boxes) continue;
      for (const bo of boxes) {
        const wb0 = bx + bo[0], wb1 = by + bo[1], wb2 = bz + bo[2];
        const wb3 = bx + bo[3], wb4 = by + bo[4], wb5 = bz + bo[5];
        if (minX < wb3 && maxX > wb0 &&
            minY < wb4 && maxY > wb1 &&
            minZ < wb5 && maxZ > wb2) {
          return id;
        }
      }
    }
    return B.AIR;
  },

  updateVitals(dt) {
    if (this.dead) { UI.setWaterOverlay(false); UI.setBlockOverlay(null); this.suffocateT = 0; return; }

    const headBlock = this.headInsideBlock();
    if (headBlock !== B.AIR) UI.setBlockOverlay(headBlock);
    else UI.setBlockOverlay(null);

    const headWaterNow = isWater(World.getBlock(
      Math.floor(this.body.x), Math.floor(this.eyeY()), Math.floor(this.body.z)));

    // Creative players still get the opaque head-in-block overlay so they
    // cannot use clipped/culling views as xray, but they do not take damage.
    if (this.gamemode === 'creative') { this.suffocateT = 0; UI.setWaterOverlay(headWaterNow); return; }

    if (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.hunger > 0) this.hunger--;
      UI.updateStats();
    }
    this.exhaustion += 0.004 * dt;

    if (this.hunger >= 18 && this.hp < this.maxHp) {
      this.regenT += dt;
      if (this.regenT >= 3) {
        this.regenT = 0;
        this.hp = Math.min(this.maxHp, this.hp + 1);
        this.exhaustion += 1.2;
        UI.updateStats();
      }
    } else this.regenT = 0;

    if (this.hunger <= 0) {
      this.starveT += dt;
      if (this.starveT >= 4) {
        this.starveT = 0;
        if (this.hp > 1) { this.hp--; SFX.hurt(); UI.damageFlash(); UI.updateStats(); }
      }
    } else this.starveT = 0;

    if (headBlock !== B.AIR) {
      this.suffocateT += dt;
      while (this.suffocateT >= 0.5 && !this.dead) {
        this.suffocateT -= 0.5;
        this.hp -= 1; // half a heart every 0.5 seconds
        SFX.hurt();
        UI.damageFlash();
        UI.updateStats();
        if (this.hp <= 0) { this.die(); return; }
      }
    } else {
      this.suffocateT = 0;
    }

    const headWater = headWaterNow;
    if (headWater) {
      this.airT += dt;
      if (this.airT >= 1.5) {
        this.airT = 0;
        if (this.air > 0) this.air--;
        else { this.hp -= 2; SFX.hurt(); UI.damageFlash(); UI.updateStats(); if (this.hp <= 0) { this.die(); return; } }
        UI.updateStats();
      }
    } else if (this.air < 10) {
      this.air = 10; this.airT = 0;
      UI.updateStats();
    }
    UI.setWaterOverlay(headWater);
  },

  // ---------------- viewmodel ----------------
  updateViewmodelItem() {
    const s = this.held();
    const id = s ? s.id : -1;
    if (id === this.vmHeld) return;
    this.vmHeld = id;
    if (this.vmMesh) {
      this.vmGroup.remove(this.vmMesh);
      if (this.vmMesh.geometry) this.vmMesh.geometry.dispose();
    }
    this.vmTintable = true;
    this._vmLight = -1;
    if (id >= 0 && Reg[id] && Reg[id].block) {
      this.vmMesh = Drops.makeMesh(id);
      if (this.vmMesh.isSprite) this.vmMesh.scale.set(0.4, 0.4, 0.4);
      else this.vmMesh.scale.set(1.15, 1.15, 1.15);
    } else if (id >= 0) {
      const tex = new THREE.CanvasTexture(Icons.get(id));
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      this.vmMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.42),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthTest: false })
      );
      // guns point AWAY from you now (barrel-right icon rotated to face forward)
      if (Reg[id].gun) {
        this.vmMesh.rotation.y = -Math.PI / 2 + 0.15;
        this.vmMesh.scale.set(1.25, 1.25, 1.25);
      } else {
        this.vmMesh.rotation.y = -0.5;
      }
    } else {
      this.vmMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.42),
        new THREE.MeshBasicMaterial({ color: 0xd8a882, depthTest: false })
      );
      this.vmMesh.rotation.x = 0.3;
    }
    this.prepareViewmodelRenderState();
    this.vmGroup.add(this.vmMesh);
    this.captureViewmodelBaseColors();
    this.tintViewmodel(true);
  },

  // Draw the first-person hand/item as a true overlay.
  // Water is transparent and renders after normal opaque world geometry, so
  // opaque viewmodel materials would get water blended on top of them.
  // Force every held-item material into the final transparent pass with no
  // depth read/write so water, glass, leaves, and similar alpha meshes can
  // never appear through the player hand.
  prepareViewmodelRenderState() {
    if (!this.vmMesh) return;
    this.vmGroup.renderOrder = 10000;
    this.vmMesh.traverse(o => {
      if (o.isMesh || o.isSprite) {
        o.renderOrder = 10000;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          m.transparent = true;
          if (m.opacity === undefined) m.opacity = 1;
          m.depthTest = false;
          m.depthWrite = false;
          m.fog = false;
          m.needsUpdate = true;
        }
      } else {
        o.renderOrder = 10000;
      }
    });
  },

  captureViewmodelBaseColors() {
    if (!this.vmMesh) return;
    this.vmMesh.traverse(o => {
      if (!o.isMesh && !o.isSprite) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && m.color) m.userData.vmBaseCol = m.color.clone();
      }
    });
  },

  // first-person hand and held item match the voxel light where you're standing
  tintViewmodel(force) {
    if (!this.vmMesh) return;
    const raw = World.getLightRaw(Math.floor(this.body.x), Math.floor(this.eyeY()), Math.floor(this.body.z));
    const sky = (raw >> 4) * World.dayFUniform.value;
    const block = raw & 15;
    const l = Math.max(0.06, Math.max(block, sky) / 15);
    if (!force && Math.abs(l - (this._vmLight || -1)) < 0.035) return;
    this._vmLight = l;
    this.vmMesh.traverse(o => {
      if (!o.isMesh && !o.isSprite) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.color) continue;
        if (m.userData && m.userData.noVmTint) {
          m.color.set(0xffffff);
          continue;
        }
        if (!m.userData.vmBaseCol) m.userData.vmBaseCol = m.color.clone();
        m.color.copy(m.userData.vmBaseCol).multiplyScalar(l);
      }
    });
  },

  swingViewmodel() { this.vmSwing = 1; },

  updateViewmodel(dt) {
    this.updateViewmodelItem();
    this.tintViewmodel();
    if (this.vmSwing > 0) this.vmSwing = Math.max(0, this.vmSwing - dt * 4.5);
    const moving = Math.abs(this.body.vx) + Math.abs(this.body.vz) > 1 && this.body.onGround;
    this.vmBob += dt * (moving ? 9 : 2);
    const swing = Math.sin(this.vmSwing * Math.PI) * 0.5;
    this.vmGroup.position.set(
      0.42 - swing * 0.25,
      -0.40 + Math.sin(this.vmBob) * (moving ? 0.02 : 0.006) - swing * 0.12,
      -0.62 - swing * 0.18
    );
    this.vmGroup.rotation.set(-swing * 1.1, -swing * 0.4, 0);
  },

  // is the player overlapping a ladder cell?
  onLadder() {
    const b = this.body;
    for (const yOff of [0.1, 1.0]) {
      const id = World.getBlock(Math.floor(b.x), Math.floor(b.y + yOff), Math.floor(b.z));
      if (isLadder(id)) return true;
    }
    return false;
  },

  // ---------------- per-frame ----------------
  update(dt) {
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.attackT > 0) this.attackT -= dt;
    if (this.eatT > 0) this.eatT -= dt;

    const b = this.body;
    if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
      if (Vehicles.driving || Vehicles.boating) {
        if (Vehicles.exit()) this.keys['ShiftLeft'] = this.keys['ShiftRight'] = false;
      } else if (this.boarding) {
        if (Vehicles.stopBoard(true)) this.keys['ShiftLeft'] = this.keys['ShiftRight'] = false;
      }
    }
    const driving = !!(Vehicles.driving || Vehicles.boating);
    this.sneaking = (!!this.keys['ShiftLeft'] || !!this.keys['ShiftRight']) && !this.flying;
    const canSprintNow = !!this.keys['KeyW'] && !this.sneaking && (this.hunger > 6 || this.gamemode === 'creative');
    if (canSprintNow && typeof Game !== 'undefined' && Game.options && Game.options.autoSprint) this.sprinting = true;
    if (!canSprintNow) this.sprinting = false;

    let fw = 0, st = 0;
    if (!this.dead && !UI.anyOpen() && !UI.chatOpen && !driving) {
      if (this.keys['KeyW']) fw++;
      if (this.keys['KeyS']) fw--;
      if (this.keys['KeyA']) st--;
      if (this.keys['KeyD']) st++;
    }
    const feetWater = Physics.inWater(b, 0.25);
    const bodyWater = Physics.inWater(b, 0.9);
    const deepWater = Physics.inWater(b, 1.1);

    // prone swimming: sprint underwater to glide through 1x1 gaps
    if (feetWater && bodyWater && this.sprinting && !this.swimming) {
      this.swimming = true;
      b.h = 0.7;
    }
    if (this.swimming) {
      // exit as soon as you stop purposefully swimming (or leave water),
      // provided there's headroom to stand back up
      const stillSwimming = this.sprinting && feetWater;
      if (!stillSwimming) {
        if (!Physics.boxHit(b.x - b.w, b.y + 0.7, b.z - b.w, b.x + b.w, b.y + 1.85, b.z + b.w)) {
          this.swimming = false;
          b.h = 1.8;
        }
        // no headroom? stay prone until there is
      }
    }

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = (-sin * fw + cos * st);
    let mz = (-cos * fw - sin * st);
    const ml = Math.sqrt(mx * mx + mz * mz);
    if (ml > 0) { mx /= ml; mz /= ml; }

    this.climbing = !driving && !this.flying && this.onLadder();

    if (driving) {
      // vehicle handles it
    } else if (this.flying && this.gamemode === 'creative') {
      const speed = this.sprinting ? 19 : 11;
      b.vx += (mx * speed - b.vx) * Math.min(1, 10 * dt);
      b.vz += (mz * speed - b.vz) * Math.min(1, 10 * dt);
      let vyT = 0;
      if (this.keys['Space']) vyT += 9;
      if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) vyT -= 9;
      b.vy += (vyT - b.vy) * Math.min(1, 10 * dt);
      Physics.move(b, dt);
      this.fallDist = 0;
    } else if (this.boarding) {
      const push = 7.5;
      b.vx += mx * push * dt * 2.2;
      b.vz += mz * push * dt * 2.2;
      const sp = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
      const maxSp = 9;
      if (sp > maxSp) { b.vx *= maxSp / sp; b.vz *= maxSp / sp; }
      if (b.onGround && ml === 0) { b.vx *= 0.995; b.vz *= 0.995; }
      if (this.keys['Space']) {
        if (b.onGround) { b.vy = 8.2; Vehicles.trick(0); this.keys['Space'] = false; }
        else { Vehicles.trick(1); this.keys['Space'] = false; }
      }
      b.vy -= Physics.GRAV * dt;
      b.vy = Math.max(b.vy, -42);
      const wasY = b.y, fallingBefore = b.vy < 0;
      Physics.move(b, dt, { stepUp: true });
      if (feetWater) Vehicles.stopBoard(true);
      if (!feetWater) {
        if (fallingBefore && wasY > b.y) this.fallDist += wasY - b.y;
        if (b.onGround) {
          if (this.fallDist > 4.5) this.hurt(Math.floor(this.fallDist - 4), 0, 0, { pierce: true }); // lenient on a board
          this.fallDist = 0;
        }
      }
    } else if (this.climbing) {
      // ladders!
      const speed = 2.2;
      b.vx += (mx * speed - b.vx) * Math.min(1, 20 * dt);
      b.vz += (mz * speed - b.vz) * Math.min(1, 20 * dt);
      let vyT = -2.2; // slow slide
      if (this.keys['KeyW'] || this.keys['Space']) vyT = 3.6;
      else if (this.sneaking) vyT = 0;
      b.vy += (vyT - b.vy) * Math.min(1, 16 * dt);
      Physics.move(b, dt);
      this.fallDist = 0;
    } else {
      let speed = 4.3;
      if (this.sprinting) speed = 5.8;
      if (this.sneaking) speed = 1.4;
      if (feetWater) speed = this.swimming ? 5.6 : (bodyWater ? 2.3 : 3.0);
      if (this.gamemode === 'creative') speed *= 1.15;

      const feetLava = Physics.inLava(b, 0.25);
      if (feetLava) speed = 1.3; // lava is thick

      const accel = b.onGround || feetWater || feetLava ? 42 : 12;
      b.vx += (mx * speed - b.vx) * Math.min(1, accel * dt);
      b.vz += (mz * speed - b.vz) * Math.min(1, accel * dt);

      if (feetLava && !feetWater) {
        // no swimming in lava, but you can struggle upward and haul yourself out.
        // Sneak/Shift intentionally makes you sink faster in fluids.
        b.vy -= (this.sneaking ? 18 : 6) * dt;
        b.vy = Math.max(b.vy, this.sneaking ? -4.8 : -1.4);
        if (this.keys['Space'] && !this.dead) b.vy = Math.min(1.9, b.vy + 16 * dt);
        this.fallDist = 0;
      } else if (feetWater) {
        if (this.swimming && fw > 0) {
          // swim along your view direction
          const look = this.lookDir();
          b.vy += (look.y * 5 - b.vy) * Math.min(1, 8 * dt);
        } else {
          b.vy -= 9 * dt;
          b.vy = Math.max(b.vy, -3.2);
        }
        if (this.keys['Space'] && !this.dead) {
          b.vy = Math.min(4.2, b.vy + 30 * dt);
          if (!deepWater) b.vy = Math.max(b.vy, 4.6);
        }
        if (this.sneaking) b.vy -= 18 * dt;
        this.fallDist = 0;
        if (!this.wasInWater && Math.abs(b.vy) > 4) SFX.splash();
      } else {
        if (this.keys['Space'] && b.onGround && !this.dead) {
          b.vy = 8.4;
          this.exhaustion += this.sprinting ? 0.2 : 0.05;
        }
        b.vy -= Physics.GRAV * dt;
        b.vy = Math.max(b.vy, -42);
      }
      this.wasInWater = feetWater;

      if (this.sprinting) this.exhaustion += 0.10 * dt;
      else if (ml > 0) this.exhaustion += 0.01 * dt;

      const wasY = b.y, fallingBefore = b.vy < 0;
      Physics.move(b, dt, { sneakGuard: this.sneaking && !feetWater, stepUp: !this.sneaking });

      if ((bodyWater || feetLava) && b.hitH && (ml > 0 || this.keys['Space'])) {
        b.vy = Math.max(b.vy, 7.8); // ledge boost works in lava too — you'll want it
      }

      if (!feetWater) {
        if (fallingBefore && wasY > b.y) this.fallDist += wasY - b.y;
        if (b.onGround) {
          if (this.fallDist > 3.2) {
            const dmg = Math.floor(this.fallDist - 3);
            if (dmg > 0) this.hurt(dmg, 0, 0, { pierce: true });
          }
          this.fallDist = 0;
        }
      }
    }

    if (b.y < -12 && !this.dead) {
      UI.chat((typeof Dimensions !== 'undefined' && Dimensions.current === 'merry') ? 'The Merry void eats you instantly.' : 'The void eats you instantly.', '#ff8080');
      this.die();
      return;
    }

    this.camera.position.set(b.x, this.eyeY() + (driving ? 0.15 : 0), b.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    const fastVehicle = (Vehicles.driving && Math.abs(Vehicles.driving.speed) > 8) || (Vehicles.boating && Math.abs(Vehicles.boating.speed) > 7);
    const targetFov = this.sprinting || this.swimming || fastVehicle ? 83 : 75;
    if (Math.abs(this.camera.fov - targetFov) > 0.3) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 8 * dt);
      this.camera.updateProjectionMatrix();
    }

    if (!this.dead && !UI.anyOpen() && !UI.chatOpen) {
      this.updateMining(dt);
      if (this.rmb) {
        const s = this.held();
        if (s && Reg[s.id].gun) {
          if (this.rmbFresh) {
            const d = this.lookDir();
            const hit = World.raycast(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 5);
            const interactive = hit && Reg[hit.id].interact && !this.sneaking;
            if (interactive) this.tryUse();
            else Guns.tryFire(s.id, false);
            this.rmbFresh = false;
          } else {
            Guns.tryFire(s.id, true);
          }
        } else {
          this.placeT -= dt;
          if (this.placeT <= 0 || this.rmbFresh) {
            if (this.tryUse()) this.placeT = 0.24;
            else this.placeT = 0.08;
            this.rmbFresh = false;
          }
        }
      }
    } else {
      this.highlight.visible = false;
      this.breakOverlay.visible = false;
      if (this.breakDamageOverlays) for (const m of this.breakDamageOverlays) m.visible = false;
    }

    this.updateViewmodel(dt);
    this.updateVitals(dt);
  },
};
