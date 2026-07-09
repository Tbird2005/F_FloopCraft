// ============================================================
// F_Floop Craft — 2D UI: hotbar, stats, XP, inventory + armor,
// crafting + recipe book, furnace, creative tabs, casino,
// stock market, lore, signs, death, chat + commands
// ============================================================
const UI = {
  screen: null,
  cursor: null,
  craftCells: null, craftW: 0,
  refreshFns: [],
  itemNameT: null,
  casinoTimers: [],
  screenTimers: [],
  loreHit: null, furnaceKey: null, signHit: null,
  chatOpen: false,

  el(id) { return document.getElementById(id); },

  cloneStack(s, count) {
    if (!s) return null;
    const out = { id: s.id, count: count === undefined ? s.count : count };
    if (s.dur !== undefined) out.dur = s.dur;
    if (s.data !== undefined) out.data = JSON.parse(JSON.stringify(s.data));
    return out;
  },

  sameStack(a, b) {
    if (!a || !b || a.id !== b.id) return false;
    const ad = a.data === undefined ? '' : JSON.stringify(a.data);
    const bd = b.data === undefined ? '' : JSON.stringify(b.data);
    return ad === bd;
  },

  init() {
    const hb = this.el('hotbar');
    this.hotbarEls = [];
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      d.className = 'hbslot';
      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 32;
      const cnt = document.createElement('span');
      cnt.className = 'cnt';
      d.appendChild(cv); d.appendChild(cnt);
      hb.appendChild(d);
      this.hotbarEls.push({ d, cv, cnt });
    }

    document.addEventListener('mousemove', e => {
      const c = this.el('cursorStack');
      c.style.left = (e.clientX - 16) + 'px';
      c.style.top = (e.clientY - 16) + 'px';
      const t = this.el('tooltip');
      if (!t.classList.contains('hidden')) {
        t.style.left = (e.clientX + 14) + 'px';
        t.style.top = (e.clientY + 6) + 'px';
      }
    });
    document.addEventListener('mouseup', () => {
      // release anywhere ends a drag-spread; pending clicks resolve in slot handlers
      setTimeout(() => {
        this.dragPending = null;
        this.dragSpreading = false;
        this.dragButton = null;
        this.dragVisited = null;
      }, 0);
    });
    // clicking the dark backdrop with a held stack throws it into the world
    this.el('overlay').addEventListener('mousedown', e => {
      if (e.target !== this.el('overlay') || !this.cursor) return;
      const dir = Player.lookDir();
      const n = e.button === 2 ? 1 : this.cursor.count;
      Drops.spawn(Player.body.x + dir.x * 0.6, Player.body.y + 1.4, Player.body.z + dir.z * 0.6,
        this.cursor.id, n, [dir.x * 5.5, 1.8, dir.z * 5.5], this.cursor.dur, this.cursor.data);
      this.cursor.count -= n;
      if (this.cursor.count <= 0) this.cursor = null;
      SFX.pop();
      this.renderCursor();
    });

    // chat input
    const ci = this.el('chatInput');
    ci.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const v = ci.value.trim();
        this.closeChat();
        if (v) this.runChat(v);
      } else if (e.key === 'Escape') {
        this.closeChat();
      }
    });

    this.updateHotbar();
    this.updateStats();
    this.updateXp();
    this.updateModeLabel();
  },

  anyOpen() { return this.screen !== null; },

  // ---------------- tooltip ----------------
  tooltipText(id, stack) {
    const def = Reg[id];
    if (!def) return '';
    let extra = '';
    if (def.food) extra = '\n+' + def.food + ' hunger';
    else if (def.tool) extra = '\nDMG ' + def.tool.dmg + ' · ' + def.tool.type;
    else if (def.armor) extra = '\n+' + def.armor.points + ' armor';
    else if (def.gun) extra = '\nDMG ' + def.gun.dmg + (def.gun.pellets > 1 ? '×' + def.gun.pellets : '') + ' · uses ' + Reg[def.gun.ammo].name;
    else if (def.block && def.xp) extra = '\n+' + def.xp + ' XP when mined';
    if (stack && stack.data && typeof Jelly !== 'undefined') { const jh = Jelly.readHouseItemData(stack.data); if (jh) extra += '\nJelly People inside: ' + jh.stored.length; }
    if (def.maxDur) {
      const cur = stack && stack.dur !== undefined ? stack.dur : def.maxDur;
      const fmtDur = (v, decimals = 1) => Number.isFinite(Number(v)) ? Number(v).toFixed(decimals) : String(v);
      const fmtMax = Number.isInteger(Number(def.maxDur)) ? String(def.maxDur) : fmtDur(def.maxDur);
      extra += '\nDurability: ' + fmtDur(cur) + '/' + fmtMax;
    }
    if (def.tip) extra += '\n' + def.tip;
    return def.name + extra;
  },

  showTooltip(id, stack) {
    const t = this.el('tooltip');
    t.textContent = this.tooltipText(id, stack);
    t.classList.remove('hidden');
  },

  hideTooltip() { this.el('tooltip').classList.add('hidden'); },

  // M-key ping panel: shows every connected player's latency
  togglePingList() {
    let el = document.getElementById('pingList');
    if (el && el.style.display !== 'none') {
      el.style.display = 'none';
      if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'pingList';
      el.style.cssText = 'position:fixed;top:84px;right:18px;background:rgba(10,12,20,0.82);color:#fff;font:12px Consolas,monospace;padding:10px 14px;border-radius:6px;z-index:600;min-width:150px;pointer-events:none;line-height:1.5';
      document.body.appendChild(el);
    }
    const render = () => {
      if (typeof Multiplayer === 'undefined' || Multiplayer.role === 'solo' || !Multiplayer.connected) {
        el.innerHTML = '<b>Ping</b><br><span style="color:#aaa">Not in multiplayer.</span>';
        return;
      }
      const list = Multiplayer.getPingList ? Multiplayer.getPingList() : [];
      el.innerHTML = '<b>Ping</b><br>' + (list.length ? list.map(p => {
        const c = p.ping < 80 ? '#7CFC00' : p.ping < 180 ? '#ffd97a' : '#ff6060';
        return p.name + ': <span style="color:' + c + '">' + p.ping + 'ms</span>';
      }).join('<br>') : '<span style="color:#aaa">No other players.</span>');
    };
    render();
    el.style.display = 'block';
    this._pingTimer = setInterval(render, 1000);
  },

  // ---------------- hotbar / stats / xp ----------------
  drawStack(cv, stack) {
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 32, 32);
    if (!stack) return;
    c.drawImage(Icons.get(stack.id), 0, 0, 32, 32);
    // durability bar
    const maxDur = Reg[stack.id] && Reg[stack.id].maxDur;
    if (maxDur && stack.dur !== undefined && stack.dur < maxDur) {
      const frac = Math.max(0, stack.dur / maxDur);
      c.fillStyle = '#111';
      c.fillRect(3, 29, 26, 3);
      c.fillStyle = frac > 0.5 ? '#57c443' : frac > 0.2 ? '#f1c40f' : '#e04040';
      c.fillRect(3, 29, Math.max(1, 26 * frac), 3);
    }
  },

  updateHotbar() {
    if (!this.hotbarEls) return;
    for (let i = 0; i < 9; i++) {
      const s = Player.inv[i];
      const h = this.hotbarEls[i];
      h.d.classList.toggle('sel', i === Player.sel);
      this.drawStack(h.cv, s);
      h.cnt.textContent = s && s.count > 1 ? s.count : '';
    }
    this.updateAmmo();
  },

  vehicleHud: null,

  setVehicleHud(text) {
    if (text === this.vehicleHud) return;
    this.vehicleHud = text;
    this.updateAmmo();
  },

  updateAmmo() {
    const el = this.el('ammoLabel');
    if (this.vehicleHud) { el.textContent = this.vehicleHud; return; }
    const s = Player.inv[Player.sel];
    if (s && Reg[s.id].gun) {
      const g = Reg[s.id].gun;
      const n = Player.gamemode === 'creative' ? '∞' : Player.countItem(g.ammo);
      el.textContent = Reg[g.ammo].name + ': ' + n;
    } else el.textContent = '';
  },

  showItemName() {
    const s = Player.inv[Player.sel];
    const el = this.el('itemName');
    el.textContent = s ? Reg[s.id].name : '';
    el.style.opacity = 1;
    clearTimeout(this.itemNameT);
    this.itemNameT = setTimeout(() => { el.style.opacity = 0; }, 1400);
  },

  updateXp() {
    this.el('xpBar').style.width = Math.min(100, Player.xp / Player.xpNeeded() * 100) + '%';
    this.el('xpLevel').textContent = Player.level;
  },

  updateModeLabel() {
    const bits = [];
    const held = Player.held ? Player.held() : null;
    if (Player.gamemode === 'creative') bits.push('CREATIVE' + (Player.flying ? ' ✈' : ''));
    if (Player.verticalSlabMode && held && isSlab(held.id)) bits.push('V-SLAB');
    if (Player.stairSideMode && held && isStairs(held.id)) bits.push('SIDE-STAIR');
    this.el('modeLabel').textContent = bits.join(' · ');
  },

  updateStats() {
    const cv = this.el('statsCanvas');
    if (!cv) return;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 418, 46);
    c.imageSmoothingEnabled = false;

    const heart = (x, y, fill, half) => {
      const P = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
      for (let r = 0; r < P.length; r++) for (let q = 0; q < 7; q++) {
        if (P[r][q] !== 'X') continue;
        let col = '#3a0c0c';
        if (fill && (!half || q < 3)) col = '#e21e1e';
        else if (fill && half && q === 3) col = '#a11414';
        c.fillStyle = col;
        c.fillRect(x + q * 2, y + r * 2, 2, 2);
      }
    };
    const drumstick = (x, y, fill) => {
      const P = ['...MMM.', '..MMMMM', '..MMMM.', '.BMM...', 'BB.....', 'B......'];
      for (let r = 0; r < P.length; r++) for (let q = 0; q < 7; q++) {
        const ch = P[r][q];
        if (ch === '.') continue;
        c.fillStyle = fill ? (ch === 'M' ? '#b5652a' : '#efe4ce') : '#3a2a1a';
        c.fillRect(x + q * 2, y + r * 2, 2, 2);
      }
    };
    const shirt = (x, y, fill) => {
      const P = ['XX.XX', 'XXXXX', '.XXX.', '.XXX.'];
      for (let r = 0; r < P.length; r++) for (let q = 0; q < 5; q++) {
        if (P[r][q] !== 'X') continue;
        c.fillStyle = fill ? '#c9c9c9' : '#3a3a3a';
        c.fillRect(x + q * 2, y + r * 2, 2, 2);
      }
    };
    const bubble = (x, y) => {
      c.strokeStyle = '#bfe4ff'; c.lineWidth = 2;
      c.beginPath(); c.arc(x + 6, y + 6, 5, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#e8f6ff'; c.fillRect(x + 3, y + 3, 3, 3);
    };

    if (Player.gamemode === 'creative') return; // clean HUD in creative

    for (let i = 0; i < 10; i++) {
      const hpAt = (i + 1) * 2;
      const full = Player.hp >= hpAt;
      const half = !full && Player.hp >= hpAt - 1;
      heart(4 + i * 17, 30, full || half, half && !full);
    }
    for (let i = 0; i < 10; i++) {
      const full = Player.hunger >= (i + 1) * 2 - 1;
      drumstick(232 + i * 17, 30, full);
    }
    // armor row (above hearts)
    const pts = Player.armorPoints();
    if (pts > 0) {
      for (let i = 0; i < 10; i++) shirt(4 + i * 15, 12, pts >= (i + 1) * 2);
    }
    if (Player.air < 10) {
      for (let i = 0; i < Player.air; i++) bubble(232 + i * 17, 8);
    }
  },

  setWaterOverlay(on) {
    this.el('waterOverlay').style.opacity = on ? 1 : 0;
  },

  _blockOverlayCache: {},
  _blockOverlayId: null,

  blockOverlayDataUrl(id) {
    if (this._blockOverlayCache[id]) return this._blockOverlayCache[id];
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    // The suffocation/xray blocker must be fully opaque.  Some source tiles
    // like glass/leaves have alpha, so draw them over black before tiling.
    c.fillStyle = '#000';
    c.fillRect(0, 0, 16, 16);

    if (typeof B !== 'undefined' && id === B.MR_FLOOP_DRINKING_WATER && typeof PhotoBlocks !== 'undefined') {
      const img = PhotoBlocks.canvas(id);
      if (img) c.drawImage(img, 0, 0, img.width, img.height, 0, 0, 16, 16);
    } else if (typeof Atlas !== 'undefined' && Atlas.canvas && Reg[id]) {
      const face = Reg[id].tex && (Reg[id].tex.side ? 'side' : Reg[id].tex.all ? 'side' : 'top');
      const texName = Atlas.texName(id, face);
      const [sx, sy] = Atlas.tileXY(texName);
      c.drawImage(Atlas.canvas, sx, sy, Atlas.TILE, Atlas.TILE, 0, 0, 16, 16);
    } else {
      c.fillStyle = '#777'; c.fillRect(0, 0, 16, 16);
    }

    // Force any remaining semi-transparent pixels to opaque so the player
    // cannot still read caves/culled faces through the overlay.
    const imgData = c.getImageData(0, 0, 16, 16);
    for (let i = 3; i < imgData.data.length; i += 4) imgData.data[i] = 255;
    c.putImageData(imgData, 0, 0);

    const url = cv.toDataURL('image/png');
    this._blockOverlayCache[id] = url;
    return url;
  },

  setBlockOverlay(id) {
    const el = this.el('suffocationOverlay');
    if (!el) return;
    if (!id || id === B.AIR) {
      this._blockOverlayId = null;
      el.style.opacity = 0;
      return;
    }
    if (this._blockOverlayId !== id) {
      this._blockOverlayId = id;
      el.style.backgroundImage = `url("${this.blockOverlayDataUrl(id)}")`;
    }
    el.style.opacity = 1;
  },

  damageFlash() {
    const v = this.el('vignette');
    v.style.opacity = 1;
    setTimeout(() => { v.style.opacity = 0; }, 180);
  },

  chat(text, color) {
    const box = this.el('chat');
    const d = document.createElement('div');
    d.className = 'chatline';
    d.textContent = text;
    if (color) d.style.color = color;
    box.insertBefore(d, box.firstChild);
    while (box.children.length > 30) box.removeChild(box.lastChild); // history stays in the DOM
    setTimeout(() => { if (!this.chatOpen) d.style.opacity = 0; }, 6000);
  },

  // ---------------- chat & commands ----------------
  openChat(prefix) {
    if (this.chatOpen || this.anyOpen() || Player.dead) return;
    this.chatOpen = true;
    const ci = this.el('chatInput');
    ci.classList.remove('hidden');
    ci.value = prefix || '';
    // chat open = full history visible
    for (const line of this.el('chat').children) line.style.opacity = 1;
    setTimeout(() => ci.focus(), 0);
  },

  closeChat() {
    this.chatOpen = false;
    const ci = this.el('chatInput');
    ci.classList.add('hidden');
    ci.blur();
    // fade everything back out (recent lines linger a moment)
    const kids = [...this.el('chat').children];
    kids.forEach((line, idx) => {
      setTimeout(() => { if (!this.chatOpen) line.style.opacity = 0; }, idx < 4 ? 3000 : 250);
    });
  },

  runChat(text) {
    if (!text.startsWith('/')) {
      this.chat('<You> ' + text, '#fff');
      if (typeof Multiplayer !== 'undefined' && Multiplayer.sendChat) Multiplayer.sendChat(text);
      if (/merry christmas/i.test(text)) this.chat('<Mr Floop> MERRY CHRISTMAS!!', '#7CFC00');
      return;
    }
    const parts = text.slice(1).trim().split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const arg = parts.slice(1);

    if (cmd === 'gamemode' || cmd === 'gm') {
      const m = (arg[0] || '').toLowerCase();
      if (m === 'creative' || m === 'c' || m === '1') {
        Player.gamemode = 'creative';
        this.chat('Gamemode set to Creative. Double-tap Space to fly. E opens the creative menu.', '#7df5ec');
      } else if (m === 'survival' || m === 's' || m === '0') {
        Player.gamemode = 'survival';
        Player.flying = false;
        this.chat('Gamemode set to Survival. Gravity has opinions again.', '#7df5ec');
      } else {
        this.chat('Usage: /gamemode creative|survival', '#ff8080');
      }
      this.updateModeLabel();
      this.updateStats();
    } else if (cmd === 'time') {
      const t = (arg[0] || '').toLowerCase();
      const frac = Game.time / Game.dayLen;
      if (t === 'day') { Game.time = (Math.floor(frac) + 1) * Game.dayLen + Game.dayLen * 0.05; if (typeof Dynamics !== 'undefined' && Dynamics.clearStarfall) Dynamics.clearStarfall(false); this.chat('Sun: deployed.', '#ffd97a'); }
      else if (t === 'night') { Game.time = Math.floor(frac) * Game.dayLen + Game.dayLen * 0.55; this.chat('Moon: deployed.', '#aac6ff'); }
      else this.chat('Usage: /time day|night', '#ff8080');
    } else if (cmd === 'give') {
      const count = /^\d+$/.test(arg[arg.length - 1]) ? parseInt(arg.pop(), 10) : 1;
      const query = arg.join(' ').toLowerCase();
      if (!query) { this.chat('Usage: /give <item name> [count]', '#ff8080'); return; }
      let bestId = null;
      for (const id of Object.keys(Reg)) {
        const nm = Reg[id].name.toLowerCase();
        if (nm === query) { bestId = +id; break; }
        if (bestId === null && nm.includes(query)) bestId = +id;
      }
      if (bestId === null || isWater(bestId) || bestId === B.AIR) { this.chat('Unknown item: ' + query, '#ff8080'); return; }
      Player.addItem(bestId, count);
      this.chat('Given ' + count + '× ' + Reg[bestId].name + '.', '#7df5ec');
    } else if (cmd === 'locate') {
      const sub = (arg[0] || '').toLowerCase();
      if (sub === 'help' || !sub) {
        const lines = (World.locateStructureHelpLines ? World.locateStructureHelpLines() : ['Structures: ' + World.locateStructureNames().join(', ')]);
        this.chat('/locatetp <structure> can teleport to:', '#7df5ec');
        for (const line of lines) this.chat(line, '#ccc');
      } else {
        const found = World.locateNearestStructure(arg.join(' '), Player.body.x, Player.body.z);
        if (found.error === 'unknown') this.chat('Unknown structure. Use /locate help', '#ff8080');
        else if (found.error === 'dimension') this.chat('That structure type belongs to the overworld. Use a return portal first.', '#ff8080');
        else if (found.error) this.chat('No ' + found.type + ' found nearby.', '#ff8080');
        else this.chat(found.type + ' located near x ' + Math.floor(found.x) + ', y ' + Math.floor(found.y) + ', z ' + Math.floor(found.z) + ' (' + Math.round(found.distance) + ' blocks).', '#7df5ec');
      }
    } else if (cmd === 'locatetp') {
      const query = arg.join(' ');
      if (!query) { this.chat('Usage: /locatetp <structure>. Try /locate help', '#ff8080'); return; }
      const found = World.locateNearestStructure(query, Player.body.x, Player.body.z);
      if (found.error === 'unknown') { this.chat('Unknown structure. Use /locate help', '#ff8080'); return; }
      if (found.error === 'dimension') { this.chat('That structure type belongs to the overworld. Use a return portal first.', '#ff8080'); return; }
      if (found.error) { this.chat('No ' + found.type + ' found nearby.', '#ff8080'); return; }
      World.update(found.x, found.z, 8, found.y);
      Player.body.x = found.x; Player.body.y = found.y; Player.body.z = found.z;
      Player.body.vx = Player.body.vy = Player.body.vz = 0;
      this.chat('Teleported to ' + found.type + ' at x ' + Math.floor(found.x) + ', y ' + Math.floor(found.y) + ', z ' + Math.floor(found.z) + '.', '#7df5ec');
    } else if (cmd === 'tp') {
      const [x, y, z] = arg.map(Number);
      if ([x, y, z].some(isNaN)) { this.chat('Usage: /tp <x> <y> <z>', '#ff8080'); return; }
      Player.body.x = x; Player.body.y = y; Player.body.z = z;
      Player.body.vx = Player.body.vy = Player.body.vz = 0;
      this.chat('Teleported. Hopefully somewhere with a floor.', '#7df5ec');
    } else if (cmd === 'heal') {
      Player.hp = 20; Player.hunger = 20;
      this.updateStats();
      this.chat('Healed. Merry Christmas to your hitpoints.', '#7df5ec');
    } else if (cmd === 'allowcommands' || cmd === 'allowcmds') {
      if (typeof Multiplayer === 'undefined' || Multiplayer.role !== 'host' || !Multiplayer.connected) {
        this.chat('Only a multiplayer host can use /allowcommands.', '#ff8080');
      } else {
        const on = (arg[0] || '').toLowerCase();
        const enable = on === '' ? !Multiplayer.clientCommandsAllowed : (on === 'on' || on === 'true' || on === '1' || on === 'yes');
        Multiplayer.setClientCommandsAllowed(enable);
        this.chat(enable ? 'Client commands ENABLED — everyone can use /gamemode, etc.' : 'Client commands disabled.', '#7df5ec');
      }
    } else if (cmd === 'seed') {
      this.chat('World seed: ' + World.seed, '#7df5ec');
    } else if (cmd === 'save') {
      this.chat(Save.saveCurrent({ force: true }) ? 'World saved.' : 'Save failed.', '#7df5ec');
    } else if (cmd === 'help') {
      this.chat('/gamemode c|s · /time day|night · /give <item> [n] · /tp x y z · /locate help · /locatetp <structure> · /heal · /seed · /save', '#ccc');
      this.chat('Multiplayer (host): /allowcommands [on|off] — let all players use commands (cheats). Press M for ping.', '#ccc');
    } else {
      this.chat('Unknown command. Try /help', '#ff8080');
    }
  },

  // ---------------- slot machinery ----------------
  hoverSlot: null,        // {get, set} of the slot under the mouse (for hover-Q dropping)
  dragPending: null,      // LMB mousedown-with-cursor waiting to decide click vs drag
  dragSpreading: false,   // holding a mouse button + moving across slots = 1 item per slot
  dragButton: null,       // 0 = left spread, 2 = right spread
  dragVisited: null,      // slots already touched during the current drag spread

  slotAccepts(stack, opts) {
    if (!stack) return true;
    opts = opts || {};
    if (opts.armorSlot !== undefined) {
      const def = Reg[stack.id];
      return !!(def && def.armor && def.armor.slot === opts.armorSlot);
    }
    return true;
  },

  makeSlot(get, set, opts) {
    opts = opts || {};
    const d = document.createElement('div');
    d.className = 'slot' + (opts.ghost ? ' ghost' : '') + (opts.armorPh ? ' armor' : '');
    if (opts.armorPh) d.dataset.ph = opts.armorPh;
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 32;
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    d.appendChild(cv); d.appendChild(cnt);
    const refresh = () => {
      const s = get();
      this.drawStack(cv, s);
      cnt.textContent = s && s.count > 1 ? s.count : '';
    };
    this.refreshFns.push(refresh);
    refresh();
    d.addEventListener('mouseenter', (e) => {
      this.hoverSlot = opts.readOnly ? null : { get, set, opts };
      const s = get();
      if (s) this.showTooltip(s.id, s);

      // Drag-spread: sweep a held stack across slots to drop 1 in each.
      // Left drag still waits until you actually move to another slot, so a
      // normal left click keeps its old place-all/swap behavior. Right drag
      // starts immediately because right click already means "place one".
      if (!opts.readOnly && this.cursor && this.dragButton !== null) {
        const buttonMask = this.dragButton === 2 ? 2 : 1;
        if (e.buttons & buttonMask) {
          if (this.dragPending && this.dragPending.el !== d) {
            this.dragSpreading = true;
            this.dragVisited = this.dragVisited || new Set();
            this.dragDeposit(this.dragPending.get, this.dragPending.set, this.dragPending.opts, this.dragPending.el);
            this.dragPending = null;
          }
          if (this.dragSpreading) {
            this.dragDeposit(get, set, opts, d);
            this.refreshAll();
          }
        }
      }
    });
    d.addEventListener('mouseleave', () => { this.hoverSlot = null; this.hideTooltip(); });
    if (!opts.readOnly) {
      d.addEventListener('mousedown', e => {
        e.preventDefault();
        if ((e.button === 0 || e.button === 2) && this.cursor && !e.shiftKey) {
          this.dragButton = e.button;
          this.dragVisited = new Set();
          if (e.button === 0) {
            // defer: click places all on release, dragging spreads 1s instead
            this.dragPending = { get, set, opts, el: d };
          } else {
            // right-click/right-drag places one now, then one per new slot
            this.dragSpreading = true;
            this.dragDeposit(get, set, opts, d);
            this.refreshAll();
          }
          return;
        }
        this.slotClick(get, set, e.button, e.shiftKey, opts);
        this.refreshAll();
        const s = get();
        if (s) this.showTooltip(s.id, s); else this.hideTooltip();
      });
      d.addEventListener('mouseup', e => {
        if (e.button !== 0 && e.button !== 2) return;
        if (e.button === 0 && this.dragPending && this.dragPending.el === d && !this.dragSpreading) {
          // plain click: normal place-all/swap behavior
          this.slotClick(get, set, 0, false, opts);
        }
        this.dragPending = null;
        this.dragSpreading = false;
        this.dragButton = null;
        this.dragVisited = null;
        this.refreshAll();
      });
    }
    return d;
  },

  // put exactly one item from the cursor into a compatible slot
  dragDeposit(get, set, opts, el) {
    if (!this.cursor) return;
    if (el) {
      this.dragVisited = this.dragVisited || new Set();
      if (this.dragVisited.has(el)) return;
      this.dragVisited.add(el);
    }
    if (!this.slotAccepts(this.cursor, opts)) return;
    const s = get();
    if (!s) { set(this.cloneStack(this.cursor, 1)); this.cursor.count--; }
    else if (this.sameStack(s, this.cursor) && s.count < Reg[s.id].stack) { s.count++; set(s); this.cursor.count--; }
    else return;
    if (opts && opts.armorSlot !== undefined) this.updateStats();
    SFX.click();
    if (this.cursor.count <= 0) { this.cursor = null; this.dragSpreading = false; }
  },

  refreshAll() {
    for (const f of this.refreshFns) f();
    this.updateHotbar();
    this.renderCursor();
    if (this.updateCraftResult) this.updateCraftResult();
  },

  slotClick(get, set, button, shift, opts) {
    const s = get();
    // armor slots only accept the right piece
    const accepts = (stack) => this.slotAccepts(stack, opts);
    if (shift) {
      if (!s) return;
      if (opts.shiftTo === 'inv') {
        const left = Player.addItem(s.id, s.count, s.dur, s.data);
        set(left > 0 ? this.cloneStack(s, left) : null);
      } else if (opts.invIndex !== undefined) {
        const def = Reg[s.id];
        // with a furnace open, shift-click routes smeltables/fuel into it
        if (this.screen === 'furnace' && this.activeFurnace) {
          const f = this.activeFurnace;
          const isSmelt = !!Recipes.smelting[s.id];
          const isFuel = !!Recipes.fuel[s.id];
          const target = isSmelt ? 'in' : isFuel ? 'fuel' : null;
          if (target) {
            const t = f[target];
            if (!t) { f[target] = s; set(null); return; }
            if (t.id === s.id && t.count < def.stack) {
              const take = Math.min(def.stack - t.count, s.count);
              t.count += take; s.count -= take;
              set(s.count > 0 ? s : null);
              return;
            }
          }
          return;
        }
        // with a chest open, shift-click moves into the chest
        if (this.screen === 'chest' && this.activeChest) {
          let left = s.count;
          for (let i = 0; i < this.activeChest.length && left > 0; i++) {
            const t = this.activeChest[i];
            if (this.sameStack(t, s) && t.count < def.stack) {
              const take = Math.min(def.stack - t.count, left);
              t.count += take; left -= take;
            }
          }
          for (let i = 0; i < this.activeChest.length && left > 0; i++) {
            if (!this.activeChest[i]) { this.activeChest[i] = this.cloneStack(s, left); left = 0; }
          }
          set(left > 0 ? this.cloneStack(s, left) : null);
          return;
        }
        // try armor auto-equip first
        if (def.armor && !Player.armor[def.armor.slot]) {
          Player.armor[def.armor.slot] = this.cloneStack(s, 1);
          s.count--;
          set(s.count > 0 ? s : null);
          this.updateStats();
          return;
        }
        const idx = opts.invIndex;
        const target = idx < 9 ? [9, 36] : [0, 9];
        let left = s.count;
        for (let i = target[0]; i < target[1] && left > 0; i++) {
          const t = Player.inv[i];
          if (this.sameStack(t, s) && t.count < def.stack) {
            const take = Math.min(def.stack - t.count, left);
            t.count += take; left -= take;
          }
        }
        for (let i = target[0]; i < target[1] && left > 0; i++) {
          if (!Player.inv[i]) { Player.inv[i] = this.cloneStack(s, left); left = 0; }
        }
        set(left > 0 ? this.cloneStack(s, left) : null);
      } else if (opts.armorSlot !== undefined) {
        const left = Player.addItem(s.id, s.count, s.dur, s.data);
        set(left > 0 ? this.cloneStack(s, left) : null);
        this.updateStats();
      }
      return;
    }
    if (button === 0) {
      if (!this.cursor && s) { this.cursor = s; set(null); }
      else if (this.cursor && !s) {
        if (!accepts(this.cursor)) return;
        set(this.cursor); this.cursor = null;
      }
      else if (this.cursor && s) {
        if (!accepts(this.cursor)) return;
        if (this.sameStack(s, this.cursor)) {
          const def = Reg[s.id];
          const take = Math.min(def.stack - s.count, this.cursor.count);
          s.count += take; this.cursor.count -= take;
          if (this.cursor.count <= 0) this.cursor = null;
          set(s);
        } else { set(this.cursor); this.cursor = s; }
      }
    } else if (button === 2) {
      if (!this.cursor && s) {
        const half = Math.ceil(s.count / 2);
        this.cursor = this.cloneStack(s, half);
        s.count -= half;
        set(s.count > 0 ? s : null);
      } else if (this.cursor) {
        if (!accepts(this.cursor)) return;
        if (!s) {
          set(this.cloneStack(this.cursor, 1));
          this.cursor.count--;
        } else if (this.sameStack(s, this.cursor) && s.count < Reg[s.id].stack) {
          s.count++; this.cursor.count--;
          set(s);
        }
        if (this.cursor && this.cursor.count <= 0) this.cursor = null;
      }
    }
    if (opts.armorSlot !== undefined) this.updateStats();
    SFX.click();
  },

  renderCursor() {
    const c = this.el('cursorStack');
    if (!this.cursor) { c.classList.add('hidden'); return; }
    c.classList.remove('hidden');
    c.innerHTML = '';
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 32;
    this.drawStack(cv, this.cursor);
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.textContent = this.cursor.count > 1 ? this.cursor.count : '';
    c.appendChild(cv); c.appendChild(cnt);
  },

  invGrid(container) {
    const main = document.createElement('div');
    main.className = 'grid';
    main.style.gridTemplateColumns = 'repeat(9, 40px)';
    main.style.margin = '10px 0 4px 0';
    for (let i = 9; i < 36; i++) {
      const idx = i;
      main.appendChild(this.makeSlot(
        () => Player.inv[idx], v => { Player.inv[idx] = v; }, { invIndex: idx }));
    }
    const hot = document.createElement('div');
    hot.className = 'grid';
    hot.style.gridTemplateColumns = 'repeat(9, 40px)';
    hot.style.marginTop = '8px';
    for (let i = 0; i < 9; i++) {
      const idx = i;
      hot.appendChild(this.makeSlot(
        () => Player.inv[idx], v => { Player.inv[idx] = v; }, { invIndex: idx }));
    }
    container.appendChild(main);
    container.appendChild(hot);
  },

  craftArea(container, size) {
    this.craftW = size;
    this.craftCells = new Array(size * size).fill(null);
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';

    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.gridTemplateColumns = `repeat(${size}, 40px)`;
    for (let i = 0; i < size * size; i++) {
      const idx = i;
      grid.appendChild(this.makeSlot(
        () => this.craftCells[idx], v => { this.craftCells[idx] = v; }, { shiftTo: 'inv' }));
    }
    const arrow = document.createElement('div');
    arrow.className = 'craftArrow';
    arrow.textContent = '→';

    let result = null;
    const resSlot = this.makeSlot(() => result, () => {}, { readOnly: true });
    resSlot.style.borderColor = '#b8860b #eee #eee #b8860b';
    resSlot.addEventListener('mousedown', e => {
      e.preventDefault();
      if (!result) return;
      const r = Recipes.match(this.craftCells, this.craftW, this.craftW);
      if (!r) return;
      if (!this.cursor) this.cursor = { id: r.out, count: r.count };
      else if (this.cursor.id === r.out && this.cursor.count + r.count <= Reg[r.out].stack) this.cursor.count += r.count;
      else {
        const left = Player.addItem(r.out, r.count);
        if (left > 0) return;
      }
      for (let i = 0; i < this.craftCells.length; i++) {
        const s = this.craftCells[i];
        if (s && !(r.keep && r.keep.includes(s.id))) { s.count--; if (s.count <= 0) this.craftCells[i] = null; }
      }
      SFX.craft();
      this.refreshAll();
    });

    this.updateCraftResult = () => {
      const r = Recipes.match(this.craftCells, this.craftW, this.craftW);
      result = r ? { id: r.out, count: r.count } : null;
      this.drawStack(resSlot.querySelector('canvas'), result);
      resSlot.querySelector('.cnt').textContent = result && result.count > 1 ? result.count : '';
    };
    this.updateCraftResult();

    wrap.appendChild(grid);
    wrap.appendChild(arrow);
    wrap.appendChild(resSlot);
    container.appendChild(wrap);
  },

  returnCraftCells() {
    if (this.craftCells) {
      for (let i = 0; i < this.craftCells.length; i++) {
        const s = this.craftCells[i];
        if (s) {
          const left = Player.addItem(s.id, s.count, s.dur, s.data);
          if (left > 0) Drops.spawn(Player.body.x, Player.body.y + 1, Player.body.z, s.id, left, null, s.dur, s.data);
          this.craftCells[i] = null;
        }
      }
    }
    if (this.cursor) {
      if (this.screen !== 'creative') {
        const left = Player.addItem(this.cursor.id, this.cursor.count, this.cursor.dur, this.cursor.data);
        if (left > 0) Drops.spawn(Player.body.x, Player.body.y + 1, Player.body.z, this.cursor.id, left, null, this.cursor.dur, this.cursor.data);
      }
      this.cursor = null;
    }
  },

  // ---------------- screens ----------------
  open(name, data) {
    if (this.screen) this.close(true);
    if (this.chatOpen) this.closeChat();
    this.screen = name;
    if (name === 'lore') this.loreHit = data || null;
    if (name === 'furnace') this.furnaceKey = data ? World.pkey(data.bx, data.by, data.bz) : null;
    if (name === 'sign') this.signHit = data || null;
    this.refreshFns = [];
    this.updateCraftResult = null;
    const ov = this.el('overlay');
    ov.innerHTML = '';
    ov.classList.remove('hidden');
    document.exitPointerLock && document.exitPointerLock();

    if (name === 'chest') this.chestHit = data || null;
    if (name === 'inventory') this.buildInventory(ov);
    else if (name === 'craft') this.buildCraft(ov, 3, 'Crafting Table');
    else if (name === 'extremeCraft') this.buildCraft(ov, 5, 'Extreme Crafting Table');
    else if (name === 'casino') this.buildCasino(ov);
    else if (name === 'lore') this.buildLore(ov);
    else if (name === 'death') this.buildDeath(ov);
    else if (name === 'furnace') this.buildFurnace(ov);
    else if (name === 'creative') this.buildCreative(ov);
    else if (name === 'stocks') this.buildStocks(ov);
    else if (name === 'sign') this.buildSign(ov);
    else if (name === 'chest') this.buildChest(ov);
    this.renderCursor();
  },

  close(reopening) {
    if (!this.screen) return;
    this.returnCraftCells();
    for (const t of this.casinoTimers) { clearTimeout(t); clearInterval(t); }
    for (const t of this.screenTimers) { clearTimeout(t); clearInterval(t); }
    this.casinoTimers = [];
    this.screenTimers = [];
    this.screen = null;
    this.craftCells = null;
    this.updateCraftResult = null;
    this.activeChest = null;
    this.activeFurnace = null;
    this.hoverSlot = null;
    this.dragPending = null;
    this.dragSpreading = false;
    this.dragButton = null;
    this.dragVisited = null;
    this.hideTooltip();
    this.el('overlay').classList.add('hidden');
    this.el('cursorStack').classList.add('hidden');
    this.updateHotbar();
    if (!reopening) Game.requestLock();
  },

  handleClose(code) {
    if (!this.screen) return;
    if (this.screen === 'death') return;
    if (this.screen === 'casino' && this.casinoSpinning) return;
    this.close();
  },

  buildInventory(ov) {
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>Inventory</h2>';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:16px;align-items:flex-start';

    // armor column
    const armorCol = document.createElement('div');
    armorCol.className = 'grid';
    armorCol.style.gridTemplateColumns = '40px';
    const phs = ['helm', 'chest', 'legs', 'boots'];
    for (let i = 0; i < 4; i++) {
      const idx = i;
      armorCol.appendChild(this.makeSlot(
        () => Player.armor[idx], v => { Player.armor[idx] = v; },
        { armorSlot: idx, armorPh: phs[i] }));
    }
    row.appendChild(armorCol);

    const right = document.createElement('div');
    const craftLabel = document.createElement('div');
    craftLabel.style.cssText = 'font-size:12px;font-weight:bold;margin:4px 0';
    craftLabel.textContent = 'Crafting (2×2) — a Crafting Table unlocks 3×3 + the recipe book';
    right.appendChild(craftLabel);
    this.craftArea(right, 2);
    row.appendChild(right);

    p.appendChild(row);
    this.invGrid(p);
    ov.appendChild(p);
  },

  buildCraft(ov, size = 3, titleText = 'Crafting Table') {
    const p = document.createElement('div');
    p.className = 'panel';
    p.style.display = 'flex';
    p.style.gap = '16px';

    const left = document.createElement('div');
    left.innerHTML = '<h2>' + titleText + '</h2>';
    this.craftArea(left, size);
    this.invGrid(left);
    p.appendChild(left);

    const right = document.createElement('div');
    const visibleRecipes = Recipes.all.filter(r => {
      if (r.hide || r.w > size || r.h > size) return false;
      // The 5×5 Extreme Crafting Table book only lists recipes that actually
      // require the extreme table. Normal 1x1/2x2/3x3 recipes stay in the normal books.
      if (size >= 5) return r.w > 3 || r.h > 3;
      return r.w <= size && r.h <= size;
    });
    right.innerHTML = `<h2>${size}×${size} Recipe Book <span style="font-size:11px">(${visibleRecipes.length} recipes)</span></h2>`;
    const list = document.createElement('div');
    list.id = 'recipeList';
    const detail = document.createElement('div');
    detail.style.cssText = 'margin-top:8px;min-height:180px';

    const showRecipe = (r, row) => {
      list.querySelectorAll('.recipeRow').forEach(el => el.classList.remove('sel'));
      row.classList.add('sel');
      detail.innerHTML = '';
      const title = document.createElement('div');
      title.style.cssText = 'font-size:13px;font-weight:bold;margin-bottom:6px;color:#333';
      title.textContent = Reg[r.out].name + (r.count > 1 ? ' ×' + r.count : '');
      detail.appendChild(title);

      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center';
      const grid = document.createElement('div');
      grid.className = 'grid';
      grid.style.gridTemplateColumns = `repeat(${size}, 40px)`;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const want = (r.rows[y] && r.rows[y][x]) || 0;
        const id = want ? Recipes.displayId(want) : 0;
        grid.appendChild(this.makeSlot(() => id ? { id, count: 1 } : null, () => {}, { readOnly: true, ghost: true }));
      }
      const arrow = document.createElement('div');
      arrow.className = 'craftArrow';
      arrow.textContent = '→';
      const res = this.makeSlot(() => ({ id: r.out, count: r.count }), () => {}, { readOnly: true });
      wrap.appendChild(grid); wrap.appendChild(arrow); wrap.appendChild(res);
      detail.appendChild(wrap);

      const need = Recipes.ingredients(r);
      const canCraft = Recipes.canAfford(need);
      const btn = document.createElement('button');
      btn.className = 'uibtn';
      btn.style.marginTop = '8px';
      btn.textContent = canCraft ? 'Craft' : 'Missing materials';
      btn.disabled = !canCraft;
      btn.addEventListener('click', () => {
        if (!Recipes.payCost(need, r)) return;
        const leftOver = Player.addItem(r.out, r.count);
        if (leftOver > 0) Drops.spawn(Player.body.x, Player.body.y + 1, Player.body.z, r.out, leftOver);
        SFX.craft();
        this.refreshAll();
        showRecipe(r, row);
      });
      detail.appendChild(btn);
    };

    for (const r of visibleRecipes) {
      if (r.hide) continue; // alt recipes (charcoal torches) stay craftable but unlisted
      const row = document.createElement('div');
      row.className = 'recipeRow';
      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 32;
      this.drawStack(cv, { id: r.out, count: 1 });
      const label = document.createElement('span');
      label.textContent = Reg[r.out].name + (r.count > 1 ? ' ×' + r.count : '');
      row.appendChild(cv); row.appendChild(label);
      row.addEventListener('click', () => showRecipe(r, row));
      list.appendChild(row);
    }
    right.appendChild(list);
    right.appendChild(detail);
    p.appendChild(right);
    ov.appendChild(p);
  },

  // ---------------- furnace ----------------
  buildFurnace(ov) {
    const key = this.furnaceKey;
    if (!World.furnaces.has(key)) {
      World.furnaces.set(key, { in: null, fuel: null, out: null, burn: 0, burnMax: 0, cook: 0 });
    }
    const f = World.furnaces.get(key);
    this.activeFurnace = f;

    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>Furnace</h2>';

    const grid = document.createElement('div');
    grid.id = 'furnaceGrid';

    const col = document.createElement('div');
    col.id = 'furnaceCol';
    col.appendChild(this.makeSlot(() => f.in, v => { f.in = v; }, { shiftTo: 'inv' }));
    const flame = document.createElement('canvas');
    flame.id = 'flameCanvas';
    flame.width = 28; flame.height = 28;
    flame.style.cssText = 'width:28px;height:28px';
    col.appendChild(flame);
    col.appendChild(this.makeSlot(() => f.fuel, v => { f.fuel = v; }, { shiftTo: 'inv' }));
    grid.appendChild(col);

    const arrow = document.createElement('canvas');
    arrow.id = 'arrowCanvas';
    arrow.width = 48; arrow.height = 24;
    arrow.style.cssText = 'width:48px;height:24px';
    grid.appendChild(arrow);

    const outSlot = this.makeSlot(() => f.out, () => {}, { readOnly: true });
    outSlot.style.borderColor = '#b8860b #eee #eee #b8860b';
    outSlot.addEventListener('mousedown', e => {
      e.preventDefault();
      if (!f.out) return;
      if (e.shiftKey) {
        const left = Player.addItem(f.out.id, f.out.count);
        f.out = left > 0 ? { id: f.out.id, count: left } : null;
      } else if (!this.cursor) { this.cursor = f.out; f.out = null; }
      else if (this.cursor.id === f.out.id && this.cursor.count + f.out.count <= Reg[f.out.id].stack) {
        this.cursor.count += f.out.count; f.out = null;
      }
      SFX.click();
      this.refreshAll();
    });
    grid.appendChild(outSlot);
    p.appendChild(grid);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#555;margin-bottom:4px';
    hint.textContent = 'Smelts: raw iron/gold → ingots · sand → glass · cobble → stone · logs → charcoal. Fuel: coal, charcoal, wood.';
    p.appendChild(hint);

    this.invGrid(p);
    ov.appendChild(p);

    const drawGauges = () => {
      const fc = flame.getContext('2d');
      fc.clearRect(0, 0, 28, 28);
      fc.fillStyle = '#3a3a3a';
      fc.fillRect(6, 4, 16, 20);
      if (f.burnMax > 0 && f.burn > 0) {
        const h = Math.ceil(18 * (f.burn / f.burnMax));
        fc.fillStyle = '#ff9d2e';
        fc.fillRect(8, 23 - h, 12, h);
        fc.fillStyle = '#ffdd55';
        fc.fillRect(11, 23 - Math.max(2, h - 4), 6, Math.max(2, h - 4));
      }
      const ac = arrow.getContext('2d');
      ac.clearRect(0, 0, 48, 24);
      ac.fillStyle = '#5a5a5a';
      ac.fillRect(2, 10, 34, 4); ac.beginPath(); ac.moveTo(36, 4); ac.lineTo(46, 12); ac.lineTo(36, 20); ac.fill();
      const prog = Math.min(1, f.cook / Recipes.SMELT_TIME);
      if (prog > 0) {
        ac.fillStyle = '#7df5ec';
        ac.fillRect(2, 10, 34 * prog, 4);
      }
    };
    drawGauges();
    this.screenTimers.push(setInterval(() => { this.refreshAll(); drawGauges(); }, 220));
  },

  // ---------------- creative inventory ----------------
  buildCreative(ov) {
    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>Creative</h2>';

    const cats = {
      'Building': [],
      'Slabs/Stairs': [],
      'Nature': [],
      'Ores': [],
      'Utility': [],
      'Materials': [],
      'Tools': [],
      'Combat': [],
      'Food/Farm': [],
      'Vehicles/Fun': [],
      'Mobs': [],
    };
    const added = new Set();

    const creativeVisible = (id) => {
      const def = Reg[id];
      if (!def) return false;
      if (id === B.AIR || isWater(id) || isLava(id) || def.fluid || def.hidden) return false;
      if (isWallTorch(id) || id === B.FURNACE_LIT || isDoor(id) || (isLadder(id) && id !== B.LADDER_PX)) return false;
      if (id === B.BED_HEAD || id === B.SUNBED_HEAD || id === B.FIRE || isDSlab(id) || isVSlab(id)) return false;
      if (isSnowSheet(id) && id !== B.SNOW_SHEET_1) return false;
      if (isStairs(id)) {
        const si = stairInfo(id);
        return !!(si && !si.top && si.dir[0] === 1 && si.dir[1] === 0);
      }
      if (def.shape === 'slabT') return false;
      return true;
    };
    const put = (cat, id) => {
      if (!cats[cat] || added.has(id) || !creativeVisible(id)) return;
      cats[cat].push(id);
      added.add(id);
    };
    const putMany = (cat, ids) => ids.forEach(id => put(cat, id));
    const woolColorBlocks = [B.WOOL_RED, B.WOOL_GREEN, B.WOOL_BLUE, B.WOOL_YELLOW, B.WOOL_PURPLE, B.WOOL_BLACK];
    const woolColorSlabs = WOOL_STAIR_COLORS.map((_, i) => B.WOOL_SLAB_C0 + i * 2);
    const woolColorStairs = WOOL_STAIR_COLORS.map((_, i) => B.WOOL_STAIRS_C0 + i * 8);

    // Blocks you actually build with, grouped by material instead of raw id order.
    putMany('Building', [
      B.LOG, B.PLANKS, B.BIRCH_LOG, B.BIRCH_PLANKS, B.SPRUCE_LOG, B.SPRUCE_PLANKS, B.OASIS_LOG, B.OASIS_PLANKS,
      B.COBBLE, B.STONE_BRICKS, B.OBSIDIAN, B.GLASS,
      B.WOOL, ...woolColorBlocks,
      B.BONE_BLOCK, B.FLOOP_METAL, B.FLOOP_LAMP, B.PRESENT, B.STARDUST, B.EMERALD_BLOCK,
      ...Object.values(JELLY_BLOCK_BY_COLOR), ...Object.values(JELLY_LAMP_BY_COLOR), B.JELLY_HOUSE,
      B.DUNGEON_BRICK, B.DUNGEON_BRICK_INACTIVE, B.DUNGEON_CORE,
      B.DUNGEON_DOOR_GREEN, B.DUNGEON_DOOR_BLUE, B.DUNGEON_DOOR_GOLD, B.DUNGEON_DOOR_DIAMOND,
      B.LORE, B.MR_FLOOP_DRINKING_WATER, B.BEDROCK,
    ]);

    // Shape variants are now in one place, ordered by material family.
    putMany('Slabs/Stairs', [
      B.PLANK_SLAB_B, B.PLANK_STAIRS_PX,
      B.BIRCH_SLAB_B, B.BIRCH_STAIRS_PX,
      B.SPRUCE_SLAB_B, B.SPRUCE_STAIRS_PX,
      B.OASIS_SLAB_B, B.OASIS_STAIRS_PX,
      B.COBBLE_SLAB_B, B.COBBLE_STAIRS_PX,
      B.STONE_SLAB_B,
      B.WOOL_SLAB_B, B.WOOL_STAIRS_PX,
      ...woolColorSlabs, ...woolColorStairs,
      B.GLASS_SLAB_B, B.GLASS_STAIRS_PX,
    ]);

    putMany('Nature', [
      B.GRASS, B.SNOWY_GRASS, B.DIRT, B.STONE, B.SAND, B.GRAVEL, B.SNOW, B.SNOW_SHEET_1,
      B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES, B.OASIS_LEAVES,
      B.SAPLING_OAK, B.SAPLING_BIRCH, B.SAPLING_SPRUCE, B.SAPLING_OASIS,
      B.CACTUS, B.ROSE, B.DANDELION, B.CORNFLOWER, B.WILD_GRASS, B.CATTAIL,
    ]);
    putMany('Ores', [
      B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.EMERALD_ORE,
      B.XMAS_ORE, B.FLOOPIUM_ORE, B.PATAPIM_ORE, B.GUNPOWDER_ORE,
    ]);
    putMany('Utility', [
      B.CRAFT, B.EXTREME_CRAFT, B.FURNACE, B.CHEST, B.JELLY_CHEST, B.LOOT_CRATE, B.CASINO, B.STOCKS,
      B.TORCH, B.MEGA_TORCH, B.LADDER_PX, B.SIGN, B.BED, B.SUNBED, B.PLANTATION_POT, B.SPAWNER,
      I.DOOR, I.BIRCH_DOOR, I.SPRUCE_DOOR, I.OASIS_DOOR,
      I.FLINT_STEEL, I.BUCKET, I.WATER_BUCKET, I.LAVA_BUCKET,
    ]);
    putMany('Materials', [
      I.STICK, I.COAL, I.CHARCOAL, I.RAW_IRON, I.IRON_INGOT, I.RAW_GOLD, I.GOLD_INGOT,
      I.DIAMOND, I.EMERALD, I.FLOOPIUM, I.DARK_FLOOPIUM, I.PATAPIM_SHARD,
      I.DUNGEON_KEY_GREEN, I.DUNGEON_KEY_BLUE, I.DUNGEON_KEY_GOLD, I.DUNGEON_KEY_DIAMOND, I.DUNGEON_CORE_SHARD,
      I.BONE, I.GUNPOWDER, I.FEATHER, I.FLINT, I.CHARGE_CORE,
      I.DYE_RED, I.DYE_YELLOW, I.DYE_BLUE, I.DYE_PURPLE, I.DYE_GREEN,
    ]);
    putMany('Tools', [
      I.WOOD_PICK, I.STONE_PICK, I.IRON_PICK, I.DIAMOND_PICK, I.EMERALD_PICK,
      I.WOOD_AXE, I.STONE_AXE, I.IRON_AXE, I.DIAMOND_AXE, I.EMERALD_AXE,
      I.WOOD_SHOVEL, I.STONE_SHOVEL, I.IRON_SHOVEL, I.DIAMOND_SHOVEL, I.EMERALD_SHOVEL,
      I.IRON_HAMMER, I.DIAMOND_HAMMER, I.IRON_EXCAVATOR, I.DIAMOND_EXCAVATOR,
    ]);
    putMany('Combat', [
      I.WOOD_SWORD, I.STONE_SWORD, I.IRON_SWORD, I.DIAMOND_SWORD, I.EMERALD_SWORD, I.PATAPIM_BLADE, I.BAT,
      I.BOW, I.ARROW, I.PISTOL, I.SMG, I.RIFLE, I.SHOTGUN, I.BAZOOKA, I.FLOOP_RAY, I.PATAPIM_BEAM,
      I.LIGHT_AMMO, I.HEAVY_AMMO, I.SHELLS, I.ROCKET, I.CHARGE_CELL,
      I.IRON_HELMET, I.IRON_CHEST, I.IRON_LEGS, I.IRON_BOOTS,
      I.DIAMOND_HELMET, I.DIAMOND_CHEST, I.DIAMOND_LEGS, I.DIAMOND_BOOTS,
      I.EMERALD_HELMET, I.EMERALD_CHEST, I.EMERALD_LEGS, I.EMERALD_BOOTS,
      I.PATAPIM_HELMET, I.PATAPIM_CHEST, I.PATAPIM_LEGS, I.PATAPIM_BOOTS,
      I.PATAPIM_DIAMOND_JELLY_HELMET, I.PATAPIM_DIAMOND_JELLY_CHEST,
      I.PATAPIM_DIAMOND_JELLY_LEGS, I.PATAPIM_DIAMOND_JELLY_BOOTS,
    ]);
    putMany('Food/Farm', [
      I.APPLE, I.COOKIE, I.BERRY, I.FLOOPFRUIT, I.FLOOPFRUIT_SEEDS, I.BONEMEAL,
      I.RAW_MUTTON, I.COOKED_MUTTON, I.RAW_CHICKEN, I.COOKED_CHICKEN, I.SMOOTHIE, I.SNOWBALL, I.STAR,
    ]);
    putMany('Vehicles/Fun', [I.CAR, I.SUPER_CAR, I.PLANE_WHEEL, I.PLANE_BODY, I.PLANE_WING, I.PLANE_ENGINE, I.PLANE_TAIL, I.PLANE, I.SKATEBOARD, I.BOAT, I.OBSIDIAN_BOAT, I.SUN]);
    putMany('Mobs', [
      I.EGG_FROG, I.EGG_SKELETON, I.EGG_SHEEP, I.EGG_HUMBUG,
      I.EGG_FLOOP, I.EGG_CHICKEN, I.EGG_CAMEL, I.EGG_TUNG, I.EGG_JELLY, I.EGG_BIG_JELLY,
      I.JELLY_PERSON_PINK, I.JELLY_PERSON_CYAN, I.JELLY_PERSON_LIME, I.JELLY_PERSON_GRAPE, I.JELLY_PERSON_ORANGE, I.JELLY_PERSON_YELLOW,
    ]);

    // Safety net: any future non-hidden item still appears in a sensible tab.
    const autoCat = (id) => {
      const def = Reg[id];
      const nm = (def.name || '').toLowerCase();
      if (def.spawnEgg || def.placeJelly) return 'Mobs';
      if (def.block) {
        if (isSlab(id) || isStairs(id)) return 'Slabs/Stairs';
        if (nm.includes('ore')) return 'Ores';
        if (isFlower(id) || isSapling(id) || nm.includes('leaves') || nm.includes('grass') || nm.includes('dirt') || nm.includes('sand') || nm.includes('gravel') || nm.includes('snow') || nm.includes('cactus')) return 'Nature';
        if (def.interact || nm.includes('door') || nm.includes('bed') || nm.includes('torch') || nm.includes('ladder') || nm.includes('pot') || nm.includes('spawner') || nm.includes('crate') || nm.includes('chest')) return 'Utility';
        return 'Building';
      }
      if (def.food || nm.includes('seed') || nm.includes('bonemeal')) return 'Food/Farm';
      if (def.vehicle) return 'Vehicles/Fun';
      if (def.placesDoor || id === I.FLINT_STEEL || id === I.BUCKET || id === I.WATER_BUCKET || id === I.LAVA_BUCKET) return 'Utility';
      if (def.armor || def.gun || (def.tool && def.tool.type === 'sword') || [I.ARROW, I.LIGHT_AMMO, I.HEAVY_AMMO, I.SHELLS, I.ROCKET, I.CHARGE_CELL].includes(id)) return 'Combat';
      if (def.tool) return 'Tools';
      return 'Materials';
    };
    for (const idStr of Object.keys(Reg)) {
      const id = +idStr;
      if (!added.has(id) && creativeVisible(id)) put(autoCat(id), id);
    }

    const tabs = document.createElement('div');
    tabs.className = 'creativeTabs';
    const grid = document.createElement('div');
    grid.id = 'creativeGrid';

    const fillGrid = (cat) => {
      grid.innerHTML = '';
      for (const id of cats[cat]) {
        const d = document.createElement('div');
        d.className = 'slot';
        const cv = document.createElement('canvas');
        cv.width = 32; cv.height = 32;
        this.drawStack(cv, { id, count: 1 });
        d.appendChild(cv);
        d.addEventListener('mouseenter', () => this.showTooltip(id));
        d.addEventListener('mouseleave', () => this.hideTooltip());
        d.addEventListener('mousedown', e => {
          e.preventDefault();
          if (e.button === 0) this.cursor = { id, count: Reg[id].stack };
          else this.cursor = { id, count: 1 };
          SFX.click();
          this.renderCursor();
        });
        grid.appendChild(d);
      }
    };
    let first = true;
    for (const cat of Object.keys(cats)) {
      const t = document.createElement('button');
      t.className = 'ctab' + (first ? ' sel' : '');
      t.textContent = cat;
      t.title = cats[cat].length + ' items';
      t.addEventListener('click', () => {
        tabs.querySelectorAll('.ctab').forEach(x => x.classList.remove('sel'));
        t.classList.add('sel');
        fillGrid(cat);
      });
      tabs.appendChild(t);
      if (first) { fillGrid(cat); first = false; }
    }
    p.appendChild(tabs);
    p.appendChild(grid);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#555;margin-top:6px';
    hint.textContent = 'Creative is sorted by purpose now. Click an item to grab a stack (right-click for one). Cursor items vanish on close.';
    p.appendChild(hint);
    const clearBtn = document.createElement('button');
    clearBtn.className = 'uibtn';
    clearBtn.style.cssText = 'margin-top:6px;background:#7a2020';
    clearBtn.textContent = 'Delete Entire Inventory';
    clearBtn.addEventListener('click', () => {
      Player.inv = new Array(36).fill(null);
      this.cursor = null;
      SFX.breakBlk();
      this.refreshAll();
    });
    p.appendChild(clearBtn);
    this.invGrid(p);
    ov.appendChild(p);
  },

  buildLore(ov) {
    const p = document.createElement('div');
    p.className = 'panel';
    p.id = 'lorePanel';
    const h = this.loreHit;
    let idx;
    if (h) {
      const k = World.pkey(h.bx, h.by, h.bz);
      if (World.loreMap.has(k)) idx = World.loreMap.get(k);
      else {
        idx = Math.abs((NoiseGen.hash3(424242, h.bx, h.by, h.bz) * LORE.length) | 0) % LORE.length;
        World.loreMap.set(k, idx);
      }
    } else idx = 0;
    const silent = idx < 0;
    const text = silent ? LORE_SILENT : LORE[idx % LORE.length];
    p.innerHTML = `<h2>${silent ? 'Silent Lore Stone' : 'Floop Lore Stone #' + (idx + 1)}</h2>
      <div id="loreText">${text.replace(/\n/g, '<br>')}</div>
      <div style="font-size:11px;color:#6a8f8f;margin-bottom:10px">${silent ? 'It hums nothing. Politely.' : 'The runes hum softly. Somewhere, faintly: "patapim..."'}</div>`;
    const btn = document.createElement('button');
    btn.className = 'uibtn';
    btn.textContent = 'Step away';
    btn.addEventListener('click', () => this.close());
    p.appendChild(btn);
    ov.appendChild(p);
  },

  buildSign(ov) {
    const h = this.signHit;
    const key = h ? World.pkey(h.bx, h.by, h.bz) : null;
    const p = document.createElement('div');
    p.className = 'panel';
    p.id = 'signPanel';
    p.innerHTML = '<h2>Edit Sign</h2>';
    const input = document.createElement('input');
    input.maxLength = 30;
    input.placeholder = 'Write something (30 chars max)...';
    input.value = ((key && World.signs.get(key)) || '').slice(0, 30);
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') saveBtn.click();
    });
    p.appendChild(input);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'uibtn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      if (key) {
        const text = input.value.slice(0, 30).trim();
        World.signs.set(key, text);
        if (typeof Multiplayer !== 'undefined' && Multiplayer.broadcastSign) Multiplayer.broadcastSign(key, text);
        World.dirty.add(World.key(h.bx >> 4, h.bz >> 4)); // remesh syncs the floating text
      }
      this.close();
    });
    const cancel = document.createElement('button');
    cancel.className = 'uibtn';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => this.close());
    row.appendChild(saveBtn); row.appendChild(cancel);
    p.appendChild(row);
    ov.appendChild(p);
    setTimeout(() => input.focus(), 0);
  },

  buildChest(ov) {
    const h = this.chestHit;
    const key = World.pkey(h.bx, h.by, h.bz);
    const isJellyChest = h.id === B.JELLY_CHEST || World.getBlock(h.bx, h.by, h.bz) === B.JELLY_CHEST;
    const chestSize = isJellyChest ? 54 : 27;
    if (!World.chests.has(key)) World.chests.set(key, new Array(chestSize).fill(null));
    if (World.chests.get(key).length < chestSize) {
      const old = World.chests.get(key);
      while (old.length < chestSize) old.push(null);
    }
    this.activeChest = World.chests.get(key);

    const p = document.createElement('div');
    p.className = 'panel';
    p.innerHTML = '<h2>' + (isJellyChest ? 'Jelly Chest' : 'Chest') + '</h2>';
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.gridTemplateColumns = 'repeat(9, 40px)';
    for (let i = 0; i < chestSize; i++) {
      const idx = i;
      // read/write activeChest LIVE — a client's host chest_snapshot can replace the
      // backing array after this panel is built, so capturing it by ref would freeze
      // the display on the pre-snapshot (empty) contents.
      grid.appendChild(this.makeSlot(
        () => this.activeChest[idx], v => { this.activeChest[idx] = v; }, { shiftTo: 'inv' }));
    }
    p.appendChild(grid);
    const sep = document.createElement('div');
    sep.style.cssText = 'font-size:11px;color:#555;margin-top:8px';
    sep.textContent = 'Your inventory (shift-click moves stacks)';
    p.appendChild(sep);
    this.invGrid(p);
    ov.appendChild(p);
  },

  buildDeath(ov) {
    const p = document.createElement('div');
    p.className = 'panel';
    p.id = 'deathPanel';
    p.innerHTML = `<h2>You died!</h2>
      <p>Your items scattered where you fell.<br>Somewhere, Mr Floop whispers: "merry christmas..."</p>`;
    const btn = document.createElement('button');
    btn.className = 'uibtn';
    btn.textContent = 'Respawn';
    btn.addEventListener('click', () => {
      Player.respawn();
      this.close();
    });
    p.appendChild(btn);
    ov.appendChild(p);
  },

  // ---------------- FLOOP'S CASINO ----------------
  casinoSpinning: false,

  buildCasino(ov) {
    const p = document.createElement('div');
    p.className = 'panel';
    p.id = 'casinoPanel';
    p.innerHTML = `
      <h2>✨ FLOOP'S DIAMOND DEN ✨</h2>
      <div id="casinoSub">Sponsored by Mr Floop™ &mdash; "brrr brrr patapim" (that means good luck)</div>
      <div id="casinoBal"></div>
      <div id="reels">
        <div class="reel" id="reel0">❓</div>
        <div class="reel" id="reel1">❓</div>
        <div class="reel" id="reel2">❓</div>
      </div>
      <div id="casinoMsg">Place a bet. The house always wins. The house is an alien. Probably.</div>
      <div id="betRow">
        <button class="uibtn betbtn sel" data-bet="1">Bet 1 ◆</button>
        <button class="uibtn betbtn" data-bet="5">Bet 5 ◆</button>
        <button class="uibtn betbtn" data-bet="10">Bet 10 ◆</button>
      </div>
      <button class="uibtn" id="spinBtn">SPIN</button>
      <div id="payTable">3×👽 = 25× &nbsp; 3×💎 = 8× &nbsp; 3×🎄 = 5× &nbsp; 3×🎁 = 3× + cookies &nbsp; 3×❄️ / 3×🦴 = 2× &nbsp; 2×💎 = bet back</div>
      <div id="casinoFoot">Floop's Casino is not responsible for lost diamonds, lost dignity, or spontaneous abduction.
      Odds certified fair by the Floopian Gaming Commission (Mr Floop, sole member). Merry Christmas.</div>`;
    ov.appendChild(p);

    let bet = 1;
    const balEl = p.querySelector('#casinoBal');
    const msgEl = p.querySelector('#casinoMsg');
    const spinBtn = p.querySelector('#spinBtn');
    const reels = [p.querySelector('#reel0'), p.querySelector('#reel1'), p.querySelector('#reel2')];
    const updateBal = () => {
      balEl.innerHTML = `Your diamonds: <b style="color:#7df5ec">${Player.countItem(I.DIAMOND)} ◆</b>`;
      spinBtn.disabled = this.casinoSpinning || Player.countItem(I.DIAMOND) < bet;
    };
    updateBal();

    p.querySelectorAll('.betbtn').forEach(b => {
      b.addEventListener('click', () => {
        bet = +b.dataset.bet;
        p.querySelectorAll('.betbtn').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        updateBal();
      });
    });

    const SYMBOLS = ['💎', '🎄', '🎁', '❄️', '🦴', '👽'];
    const WEIGHTS = [3, 4, 3, 5, 4, 1];
    const totalW = WEIGHTS.reduce((a, b) => a + b, 0);
    const pick = () => {
      let r = Math.random() * totalW;
      for (let i = 0; i < SYMBOLS.length; i++) { r -= WEIGHTS[i]; if (r <= 0) return i; }
      return 0;
    };
    const FLOOP_SPIN_LINES = [
      'mr floop is watching the reels...',
      '"brrr brrr patapim" — Mr Floop, encouragingly',
      '"i believe in you. also in aliens." — Mr Floop',
      'the reels smell faintly of christmas...',
      '"double or nothing is a human concept" — Mr Floop',
    ];

    spinBtn.addEventListener('click', () => {
      if (this.casinoSpinning) return;
      if (!Player.removeItems(I.DIAMOND, bet)) { updateBal(); return; }
      this.casinoSpinning = true;
      updateBal();
      msgEl.textContent = FLOOP_SPIN_LINES[(Math.random() * FLOOP_SPIN_LINES.length) | 0];
      const finals = [pick(), pick(), pick()];
      reels.forEach(r => { r.classList.add('spin'); delete r.dataset.stopped; });

      const spinInt = setInterval(() => {
        for (const r of reels) if (!r.dataset.stopped) r.textContent = SYMBOLS[(Math.random() * SYMBOLS.length) | 0];
        SFX.spinTick();
      }, 70);
      this.casinoTimers.push(spinInt);

      const stopReel = (i) => {
        reels[i].textContent = SYMBOLS[finals[i]];
        reels[i].dataset.stopped = '1';
        reels[i].classList.remove('spin');
      };
      this.casinoTimers.push(setTimeout(() => stopReel(0), 900));
      this.casinoTimers.push(setTimeout(() => stopReel(1), 1500));
      this.casinoTimers.push(setTimeout(() => {
        stopReel(2);
        clearInterval(spinInt);
        this.casinoSpinning = false;

        const [a, b2, c] = finals;
        const counts = {};
        for (const f of finals) counts[f] = (counts[f] || 0) + 1;
        let win = 0, msg = '';
        if (a === b2 && b2 === c) {
          const sym = SYMBOLS[a];
          if (a === 5) { win = bet * 25; msg = `👽👽👽 JACKPOT!! +${win} ◆\n"...I mean. merry christmas. ignore the saucer noises." — Mr Floop`; }
          else if (a === 0) { win = bet * 8; msg = `${sym}${sym}${sym} TRIPLE DIAMOND! +${win} ◆`; }
          else if (a === 1) { win = bet * 5; msg = `${sym}${sym}${sym} TRIPLE TREE! +${win} ◆ Merry Christmas!`; }
          else if (a === 2) {
            win = bet * 3;
            Player.addItem(I.COOKIE, 3);
            msg = `${sym}${sym}${sym} PRESENTS! +${win} ◆ and 3 cookies!`;
          }
          else { win = bet * 2; msg = `${sym}${sym}${sym} Triple! +${win} ◆`; }
        } else if (finals.filter(f => f === 0).length === 2) {
          win = bet;
          msg = 'Two diamonds — bet returned. The house sighs in relief.';
        } else if (Object.values(counts).some(n => n === 2)) {
          win = Math.floor(bet / 2);
          msg = win > 0 ? `A pair! +${win} ◆ (consolation, floopian-style)` : 'A pair! Which pays... nothing at this bet. patapim.';
        } else {
          msg = ['The house wins. The house says: merry christmas.',
            'Nothing! "brrr brrr patapim" — Mr Floop, apologetically',
            'Gone. Like my saucer’s warranty. — M.F.'][(Math.random() * 3) | 0];
        }
        if (win > 0) { Player.addItem(I.DIAMOND, win); SFX.win(); }
        else SFX.lose();
        msgEl.textContent = msg;
        updateBal();
      }, 2100));
    });
  },

  // ---------------- FLOOP EXCHANGE (stock market) ----------------
  buildStocks(ov) {
    const st = Game.stocks;
    const p = document.createElement('div');
    p.className = 'panel';
    p.id = 'stocksPanel';
    p.innerHTML = `
      <h2>📈 THE FLOOP EXCHANGE</h2>
      <div id="stocksSub">FLOOP™ Industries (ticker: FLP) &mdash; "number go up, merry christmas" &mdash; entirely fictional</div>
      <div id="stocksBal"></div>
      <canvas id="stockChart" width="420" height="130"></canvas>
      <div id="stocksMsg"></div>
      <div id="stockBtns">
        <button class="uibtn betbtn" data-n="1">Invest 1 ◆</button>
        <button class="uibtn betbtn" data-n="5">Invest 5 ◆</button>
        <button class="uibtn betbtn" data-n="-1">Invest ALL ◆</button>
        <button class="uibtn" id="cashOutBtn">CASH OUT</button>
      </div>
      <div id="stocksFoot">The Floop Exchange is a fictional in-game market. Diamonds deposited are converted to FLP units at the
      current price. FLP is backed by nothing except Mr Floop's confidence, which is infinite but not redeemable.
      Past patapim is no guarantee of future patapim.</div>`;
    ov.appendChild(p);

    const balEl = p.querySelector('#stocksBal');
    const msgEl = p.querySelector('#stocksMsg');
    const chart = p.querySelector('#stockChart');

    const refresh = () => {
      const value = st.shares * st.price;
      balEl.innerHTML = `Diamonds: <b style="color:#7df5ec">${Player.countItem(I.DIAMOND)} ◆</b>
        &nbsp;·&nbsp; FLP price: <b style="color:#ffd700">${st.price.toFixed(1)}</b>
        &nbsp;·&nbsp; Your position: <b style="color:#57c443">${value.toFixed(1)} ◆</b>`;
      const c = chart.getContext('2d');
      c.fillStyle = '#0d0713';
      c.fillRect(0, 0, 420, 130);
      const hist = st.hist;
      if (hist.length > 1) {
        const min = Math.min(...hist) * 0.95, max = Math.max(...hist) * 1.05;
        c.strokeStyle = hist[hist.length - 1] >= hist[0] ? '#57c443' : '#e04040';
        c.lineWidth = 2;
        c.beginPath();
        hist.forEach((v, i) => {
          const x = i / (hist.length - 1) * 410 + 5;
          const y = 125 - (v - min) / (max - min || 1) * 118;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        });
        c.stroke();
      }
    };
    refresh();
    this.screenTimers.push(setInterval(refresh, 600));

    p.querySelectorAll('.betbtn').forEach(b => {
      b.addEventListener('click', () => {
        let n = +b.dataset.n;
        if (n === -1) n = Player.countItem(I.DIAMOND);
        if (n <= 0 || !Player.removeItems(I.DIAMOND, n)) { msgEl.textContent = 'No diamonds. The Exchange feels nothing.'; return; }
        st.shares += n / st.price;
        SFX.cash();
        msgEl.textContent = `Invested ${n} ◆ at ${st.price.toFixed(1)}. Mr Floop nods approvingly.`;
        refresh();
      });
    });
    p.querySelector('#cashOutBtn').addEventListener('click', () => {
      const value = Math.floor(st.shares * st.price);
      if (value <= 0) { msgEl.textContent = 'Nothing to cash out. HODL harder? — M.F.'; return; }
      st.shares -= value / st.price;
      if (st.shares * st.price < 0.5) st.shares = 0;
      Player.addItem(I.DIAMOND, value);
      SFX.win();
      msgEl.textContent = `Cashed out ${value} ◆. The Exchange whispers: "come back soon."`;
      refresh();
    });
  },
};
