// ============================================================
// F_Floop Craft — static HTML multiplayer client
// PeerJS/WebRTC signaling + remote player models + basic world sync
// ============================================================
// This version does NOT require node serve.js. It can be opened from index.html.
// It uses browser WebRTC data channels with PeerJS's public signaling server so
// players on different networks can find each other by the 4-character code.
const Multiplayer = {
  id: 'p_' + Math.random().toString(36).slice(2, 10),
  role: 'solo', // solo | host | client
  code: '',
  peer: null,
  hostConn: null,
  connections: new Map(), // host only: game player id -> PeerJS DataConnection
  connected: false,
  connecting: false,
  applyingRemote: false,
  clientCommandsAllowed: false, // host toggles with /allowcommands; lets clients use commands
  remoteBreaks: new Map(),      // pid -> {mesh, lastT}: other players' block-break crack overlays
  hostPending: false,
  lastSend: 0,
  lastTimeSend: 0,
  peers: new Map(),
  peerNames: new Map(), // game player id -> display name (kept in sync by the host)
  localName: '',
  joinErrorEl: null,
  joinButtonEl: null,
  joinInputEl: null,
  statusEl: null,
  chars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  versionTag: 'ffloopcraft-v1092',

  init() {
    this.joinErrorEl = document.getElementById('mpError');
    this.joinButtonEl = document.getElementById('mpJoinBtn');
    this.joinInputEl = document.getElementById('mpCodeInput');
    this.statusEl = document.getElementById('mpStatus');
    this.updatePauseCode();
    this.initLocalName();
  },

  // In-game name = the PC username. http origin asks the dev server; file://
  // pages try to read it from a /Users/<name>/ path; otherwise a stored
  // fallback name is used so everyone still has SOMETHING stable.
  initLocalName() {
    const cached = localStorage.getItem('ffc_playername') || '';
    const p = decodeURIComponent(location.pathname);
    const m = p.match(/[/\\]Users[/\\]([^/\\]+)[/\\]/i) || p.match(/[/\\]home[/\\]([^/\\]+)[/\\]/);
    this.localName = (m && m[1]) || cached || ('Floop' + Math.random().toString(36).slice(2, 6).toUpperCase());
    localStorage.setItem('ffc_playername', this.localName);
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      fetch('/whoami').then(r => r.json()).then(j => {
        if (j && j.name) {
          this.localName = String(j.name).slice(0, 24);
          localStorage.setItem('ffc_playername', this.localName);
          if (this.connected && this.announceName) this.announceName();
        }
      }).catch(() => {});
    }
  },

  hasPeerJS() {
    return typeof Peer !== 'undefined';
  },

  peerIdForCode(code) {
    return this.versionTag + '-' + this.cleanCode(code).toLowerCase();
  },

  randomCode() {
    let s = '';
    for (let i = 0; i < 4; i++) s += this.chars[Math.floor(Math.random() * this.chars.length)];
    return s;
  },

  cleanCode(v) {
    return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  },

  setJoinError(msg, good) {
    if (this.joinErrorEl) {
      this.joinErrorEl.textContent = msg || '';
      this.joinErrorEl.style.color = good ? '#7df5ec' : '#ff8080';
    }
  },

  setJoinBusy(on) {
    if (this.joinButtonEl) this.joinButtonEl.disabled = !!on;
    if (this.joinButtonEl) this.joinButtonEl.textContent = on ? 'Joining...' : 'Join';
  },

  statusText() {
    if (this.role === 'host') {
      if (!this.code) return 'Multiplayer: preparing code...';
      if (this.connected) return 'Multiplayer: hosting room ' + this.code;
      if (this.connecting) return 'Multiplayer: opening room ' + this.code + '...';
      return 'Multiplayer: code ' + this.code + ' (online relay not connected)';
    }
    if (this.role === 'client') {
      if (this.connected) return 'Multiplayer: joined room ' + this.code;
      if (this.connecting) return 'Multiplayer: joining room ' + this.code + '...';
      return 'Multiplayer: disconnected';
    }
    return 'Multiplayer: solo';
  },

  updatePauseCode() {
    const codeEl = document.getElementById('pauseJoinCode');
    const statusEl = document.getElementById('pauseMpStatus');
    if (codeEl) codeEl.textContent = this.code || '----';
    if (statusEl) statusEl.textContent = this.statusText();
    if (this.statusEl) this.statusEl.textContent = this.statusText();
  },

  hostStarting() {
    this.close(false);
    this.role = 'host';
    this.hostPending = true;
    this.code = this.randomCode();
    this.updatePauseCode();
  },

  finishHostWorld() {
    if (this.role !== 'host' || !this.hostPending) return;
    this.hostPending = false;
    this.connectHost();
  },

  connectHost(retryCount = 0) {
    if (this.connecting || this.connected || this.role !== 'host') return;
    if (!this.hasPeerJS()) {
      this.connecting = false;
      this.connected = false;
      this.updatePauseCode();
      if (typeof UI !== 'undefined') UI.chat('Online multiplayer could not load. Check internet, then refresh the HTML.', '#ff8080');
      return;
    }

    this.connecting = true;
    this.updatePauseCode();
    const peerId = this.peerIdForCode(this.code);
    let peer;
    try {
      peer = new Peer(peerId, { debug: 0 });
    } catch (e) {
      this.connecting = false;
      this.updatePauseCode();
      if (typeof UI !== 'undefined') UI.chat('Could not open multiplayer room in this browser.', '#ff8080');
      return;
    }
    this.peer = peer;

    peer.on('open', () => {
      if (this.role !== 'host') return;
      this.connected = true;
      this.connecting = false;
      this.updatePauseCode();
      if (typeof UI !== 'undefined') UI.chat('Multiplayer room code: ' + this.code, '#7df5ec');
    });

    peer.on('connection', (conn) => this.wireHostConnection(conn));

    peer.on('disconnected', () => {
      if (this.role !== 'host') return;
      this.connected = false;
      this.connecting = false;
      this.updatePauseCode();
      try { peer.reconnect(); } catch (e) {}
    });

    peer.on('close', () => {
      if (this.role !== 'host') return;
      this.connected = false;
      this.connecting = false;
      this.updatePauseCode();
    });

    peer.on('error', (err) => {
      const type = err && err.type ? err.type : '';
      if (this.role !== 'host') return;
      if (type === 'unavailable-id' && retryCount < 12) {
        try { peer.destroy(); } catch (e) {}
        this.peer = null;
        this.connected = false;
        this.connecting = false;
        this.code = this.randomCode();
        this.updatePauseCode();
        setTimeout(() => this.connectHost(retryCount + 1), 80);
        return;
      }
      this.connected = false;
      this.connecting = false;
      this.updatePauseCode();
      if (typeof UI !== 'undefined') UI.chat('Multiplayer relay error. Room code may not be reachable right now.', '#ff8080');
    });
  },

  wireHostConnection(conn) {
    if (!conn) return;
    conn._gameId = null;

    conn.on('open', () => {
      // Wait for join_request so the connection gets the game-side player id.
    });

    conn.on('data', (data) => {
      const msg = this.normalizeMessage(data);
      if (!msg || !msg.type) return;

      if (msg.type === 'join_request') {
        conn._gameId = msg.id || conn.peer || ('guest_' + Math.random().toString(36).slice(2, 8));
        this.connections.set(conn._gameId, conn);
        if (this.setPeerName) this.setPeerName(conn._gameId, msg.name);
        this.sendTo(conn, { type: 'joined', id: this.id, snapshot: this.makeSnapshot() });
        this.sendTo(conn, { type: 'peer_state', id: this.id, state: this.playerState() });
        this.sendTo(conn, { type: 'allow_commands', allowed: this.clientCommandsAllowed }); // sync current permission
        for (const [pid, existing] of this.peers.entries()) {
          if (pid !== conn._gameId && existing && existing.target) {
            this.sendTo(conn, { type: 'peer_state', id: pid, state: existing.target });
          }
        }
        if (this.broadcastNameTable) this.broadcastNameTable();
        if (typeof UI !== 'undefined') UI.chat((this.peerNames.get(conn._gameId) || 'A player') + ' joined your world.', '#7df5ec');
        return;
      }

      this.receiveNetworkMessage(msg, conn._gameId || msg.id || conn.peer, true);
    });

    const drop = () => {
      const id = conn._gameId;
      if (id) {
        const name = this.peerNames.get(id) || 'A player';
        this.connections.delete(id);
        this.removePeer(id);
        this.peerNames.delete(id);
        if (this.hostReleaseAllChestLocks) this.hostReleaseAllChestLocks(id); // free any chest they were in
        this.broadcast({ type: 'peer_left', id }, id);
        if (this.broadcastNameTable) this.broadcastNameTable();
        if (typeof UI !== 'undefined') UI.chat(name + ' left your world.', '#ffb347');
      }
    };
    conn.on('close', drop);
    conn.on('error', drop);
  },

  joinFromMenu() {
    const code = this.cleanCode(this.joinInputEl ? this.joinInputEl.value : '');
    if (code.length !== 4) { this.setJoinError('Enter a 4 letter/number code.'); return; }
    if (!this.hasPeerJS()) {
      this.setJoinError('Online multiplayer script did not load. Check internet, then refresh.');
      return;
    }

    this.close(false);
    this.role = 'client';
    this.code = code;
    this.connected = false;
    this.connecting = true;
    this.setJoinError('Joining room ' + code + '...', true);
    this.setJoinBusy(true);
    this.updatePauseCode();

    let finished = false;
    let peer;
    try { peer = new Peer(null, { debug: 0 }); }
    catch (e) {
      this.setJoinBusy(false);
      this.setJoinError('Could not start online multiplayer in this browser.');
      this.role = 'solo'; this.connecting = false; this.updatePauseCode();
      return;
    }
    this.peer = peer;

    const fail = (msg) => {
      if (finished) return;
      finished = true;
      this.setJoinBusy(false);
      this.setJoinError(msg || 'Invalid code or host is offline.');
      this.close(true);
      this.role = 'solo';
      this.connecting = false;
      this.updatePauseCode();
    };

    const joinTimeout = setTimeout(() => {
      if (!finished && !this.connected) fail('Invalid code or host is offline.');
    }, 9000);

    peer.on('open', () => {
      if (this.role !== 'client') return;
      let conn;
      try {
        conn = peer.connect(this.peerIdForCode(code), { reliable: true, metadata: { id: this.id } });
      } catch (e) {
        clearTimeout(joinTimeout);
        fail('Could not connect to that code.');
        return;
      }
      this.hostConn = conn;
      this.wireClientConnection(conn, () => {
        if (finished) return;
        this.sendTo(conn, { type: 'join_request', id: this.id, name: this.localName });
      }, (why) => {
        clearTimeout(joinTimeout);
        fail(why || 'Invalid code or host is offline.');
      });
    });

    peer.on('error', (err) => {
      const type = err && err.type ? err.type : '';
      clearTimeout(joinTimeout);
      if (type === 'peer-unavailable') fail('Invalid code or host is offline.');
      else if (type === 'network') fail('Network error. Check internet and try again.');
      else fail('Could not join that room.');
    });
  },

  wireClientConnection(conn, onOpen, onFail) {
    if (!conn) return;
    conn.on('open', () => {
      if (typeof onOpen === 'function') onOpen();
    });
    conn.on('data', (data) => {
      const msg = this.normalizeMessage(data);
      if (!msg || !msg.type) return;
      this.receiveNetworkMessage(msg, msg.id || 'host', false);
    });
    conn.on('close', () => {
      const wasInWorld = Game && Game.inWorld;
      this.connected = false;
      this.connecting = false;
      this.hostConn = null;
      this.setJoinBusy(false);
      if (!wasInWorld && typeof onFail === 'function') onFail('Invalid code or host is offline.');
      else if (wasInWorld && typeof UI !== 'undefined') UI.chat('Multiplayer disconnected. You can keep playing locally.', '#ffb347');
      this.updatePauseCode();
    });
    conn.on('error', () => {
      if (typeof onFail === 'function') onFail('Connection failed.');
    });
  },

  normalizeMessage(data) {
    if (!data) return null;
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (e) { return null; }
    }
    if (typeof data === 'object') return data;
    return null;
  },

  close(clearCode = true) {
    for (const p of this.peers.values()) this.removePeerObject(p);
    this.peers.clear();

    if (this.hostConn) { try { this.hostConn.close(); } catch (e) {} }
    this.hostConn = null;
    for (const conn of this.connections.values()) { try { conn.close(); } catch (e) {} }
    this.connections.clear();
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
    this.peer = null;

    this.connected = false;
    this.connecting = false;
    this.hostPending = false;
    this.applyingRemote = false;
    this.role = 'solo';
    if (clearCode) this.code = '';
    this.updatePauseCode();
  },

  sendTo(conn, msg) {
    if (!conn || conn.open === false) return false;
    try { conn.send(msg); return true; }
    catch (e) { return false; }
  },

  broadcast(msg, exceptId) {
    let sent = false;
    for (const [id, conn] of this.connections.entries()) {
      if (exceptId && id === exceptId) continue;
      if (this.sendTo(conn, msg)) sent = true;
    }
    return sent;
  },

  send(msg) {
    if (!msg || typeof msg !== 'object') return false;
    if (!msg.id) msg.id = this.id;
    if (this.role === 'host') return this.broadcast(msg);
    if (this.role === 'client') return this.sendTo(this.hostConn, msg);
    return false;
  },

  // Kept for old string-based callers, but this static version uses objects.
  onMessage(raw) {
    const msg = this.normalizeMessage(raw);
    if (!msg || !msg.type) return;
    this.receiveNetworkMessage(msg, msg.id || 'remote', false);
  },

  receiveNetworkMessage(msg, fromId, cameFromClient) {
    if (!msg || !msg.type) return;
    if (!msg.id && fromId) msg.id = fromId;

    if (msg.type === 'joined') {
      this.connected = true;
      this.connecting = false;
      this.hostId = msg.id; // remember who the host is (for dimension checks + ping labels)
      this.setJoinBusy(false);
      this.setJoinError('Joined room ' + this.code + '.', true);
      const snap = msg.snapshot || {};
      const seed = Number.isFinite(+snap.seed) ? +snap.seed : 1337;
      SFX.init();
      Game.started = true;
      Save.currentId = null; // guests must not overwrite a local save slot
      Game.startWorld(seed, snap, { multiplayerRole: 'client' });
      this.updatePauseCode();
      return;
    }

    if (msg.type === 'peer_left') {
      this.removePeer(msg.id);
      return;
    }

    if (msg.type === 'peer_state' || msg.type === 'player_state') {
      const pid = msg.id || fromId;
      if (pid && pid !== this.id) this.applyPeerState(pid, msg.state || {});
      if (this.role === 'host' && cameFromClient) this.broadcast({ type: 'peer_state', id: pid, state: msg.state || {} }, pid);
      return;
    }

    if (msg.type === 'block') {
      if (msg.id !== this.id) this.applyRemoteBlock(msg);
      if (this.role === 'host' && cameFromClient) this.broadcast(msg, msg.id || fromId);
      return;
    }

    if (msg.type === 'sign') {
      if (msg.id !== this.id) this.applyRemoteSign(msg);
      if (this.role === 'host' && cameFromClient) this.broadcast(msg, msg.id || fromId);
      return;
    }

    if (msg.type === 'chat') {
      if (msg.id !== this.id && typeof UI !== 'undefined') {
        const who = msg.name || this.peerNames.get(msg.id || fromId) || 'Player';
        UI.chat('<' + who + '> ' + String(msg.text || '').slice(0, 120), '#d8f7ff');
      }
      if (this.role === 'host' && cameFromClient) this.broadcast(msg, msg.id || fromId);
      return;
    }

    if (msg.type === 'death_message') {
      if (msg.id !== this.id && typeof UI !== 'undefined' && UI.chat) UI.chat(String(msg.text || 'A player died.').slice(0, 180), '#ff7777');
      if (this.role === 'host' && cameFromClient) this.broadcast(msg, msg.id || fromId);
      return;
    }

    if (msg.type === 'host_time') {
      if (this.role === 'client') this.applyHostTime(msg);
      return;
    }

    if (msg.type === 'allow_commands') {
      if (this.role === 'client') {
        this.clientCommandsAllowed = !!msg.allowed;
        if (typeof UI !== 'undefined') UI.chat(msg.allowed ? 'The host enabled commands for everyone.' : 'The host disabled client commands.', '#7df5ec');
      }
      return;
    }

    if (msg.type === 'break_set') {
      const pid = msg.id || fromId;
      if (pid && pid !== this.id) this.applyBreakSet(pid, msg);
      if (this.role === 'host' && cameFromClient) this.broadcast(msg, pid); // relay to other players
      return;
    }

    if (msg.type === 'player_hurt') {
      const pid = msg.id || fromId;
      if (pid && pid !== this.id) this.flashPeer(pid); // red flash + hurt sound on their model
      if (this.role === 'host' && cameFromClient) this.broadcast(msg, pid);
      return;
    }

    if (msg.type === 'gun_fire') {
      const pid = msg.id || fromId;
      if (pid && pid !== this.id) this.applyRemoteGunfire(msg);
      if (this.role === 'host' && cameFromClient) this.broadcast(msg, pid);
      return;
    }

    if (msg.type === 'ping') {
      const pid = msg.id || fromId;
      if (this.role === 'host') { const conn = this.connections && this.connections.get(pid); if (conn) this.sendTo(conn, { type:'pong', t: msg.t, id: this.id }); }
      else if (this.hostConn) this.sendTo(this.hostConn, { type:'pong', t: msg.t, id: this.id });
      return;
    }
    if (msg.type === 'pong') {
      const rtt = Math.max(0, Math.round(performance.now() - (+msg.t || 0)));
      if (this.role === 'client') { this.myPing = rtt; if (this.hostConn) this.sendTo(this.hostConn, { type:'ping_report', id: this.id, ping: rtt }); }
      else if (this.role === 'host') { if (!this.pings) this.pings = new Map(); this.pings.set(msg.id || fromId, rtt); }
      return;
    }
    if (msg.type === 'ping_report') {
      if (this.role === 'host') { if (!this.pings) this.pings = new Map(); this.pings.set(msg.id || fromId, Math.max(0, +msg.ping || 0)); }
      return;
    }
    if (msg.type === 'ping_table') {
      if (this.role === 'client') { this.pingTable = new Map(msg.pings || []); this.pingTableHostId = msg.id; }
      return;
    }

    if (msg.type === 'req_dim') {
      if (this.role === 'host') {
        const conn = this.connections && this.connections.get(msg.id || fromId);
        if (conn) this.sendTo(conn, { type:'dim_state', dim:msg.dim, diffs:this.hostGetDimDiffs(msg.dim) });
      }
      return;
    }
    if (msg.type === 'dim_state') {
      if (this.role === 'client') this.clientApplyDimState(msg);
      return;
    }
  },

  // list of {name, ping} for the M-key ping panel (host builds the table; clients read the broadcast)
  getPingList() {
    const isHost = this.role === 'host';
    const table = isHost ? (this.pings || new Map()) : (this.pingTable || new Map());
    const hostId = isHost ? this.id : this.pingTableHostId;
    const out = [];
    let n = 1;
    for (const [pid, ms] of table) {
      const me = pid === this.id, host = pid === hostId;
      let name = me ? this.localName
        : this.peerNames.get(pid) || (host ? 'Host' : ('Player ' + (n++)));
      if (host) name += ' [host]';
      if (me) name += ' (You)';
      out.push({ id: pid, name, ping: Math.max(0, Math.round(+ms || 0)) });
    }
    return out;
  },

  // the dimension the HOST is currently in (from its peer state). A client only defers
  // world generation / entity sync to the host when they share a dimension; otherwise it
  // simulates its own dimension locally (the host can't be authoritative for a dim it isn't in).
  hostDim() {
    return 'overworld';
  },
  sameDimAsHost() {
    return true;
  },

  // Host is the persistent EDIT authority for every dimension. This returns a dimension's
  // full authoritative block-edit set — live World.diffs if the host is standing in it,
  // otherwise the stored diffs it has been accumulating from players who were there.
  hostGetDimDiffs(dim) {
    return (typeof World !== 'undefined') ? [...World.diffs.entries()] : [];
  },

  // client just entered a dimension: apply the host's authoritative edits on top of the
  // deterministic local terrain, so we see everything anyone edited there before us.
  clientApplyDimState(msg) {
    if (!msg || typeof World === 'undefined') return;
    if (msg.dim && msg.dim !== 'overworld') return;
    this.applyingRemote = true;
    try {
      for (const [key, id] of (msg.diffs || [])) {
        World.diffs.set(key, id);
        const parts = String(key).split(',');
        const x = Math.floor(+parts[0]), y = Math.floor(+parts[1]), z = Math.floor(+parts[2]);
        const ck = World.chunkKeyForBlock ? World.chunkKeyForBlock(x, z) : World.key(Math.floor(x / 16), Math.floor(z / 16));
        if (!World.diffIndex.has(ck)) World.diffIndex.set(ck, new Map());
        World.diffIndex.get(ck).set(key, id);
        if (World.hasChunk(x, z)) World.setBlock(x, y, z, id, { remote: true });
      }
    } finally { this.applyingRemote = false; }
  },

  // host-only: toggle whether clients may run commands, and tell everyone
  setClientCommandsAllowed(on) {
    if (this.role !== 'host') return;
    this.clientCommandsAllowed = !!on;
    this.broadcast({ type: 'allow_commands', id: this.id, allowed: !!on });
  },

  makeSnapshot() {
    const p = (typeof Player !== 'undefined' && Player.body) ? Player : null;
    const base = {
      v: 4,
      seed: World.seed,
      currentDimension: (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld'),
      dimensions: (typeof Dimensions !== 'undefined' && Dimensions.serializeAll ? Dimensions.serializeAll() : null),
      time: Game.time,
      dayCount: Game.dayCount,
      humbugAnnounced: Game.humbugAnnounced,
      stocks: Game.stocks,
      player: null,
      hostPlayer: p ? { x: p.body.x, y: p.body.y, z: p.body.z, yaw: p.yaw, pitch: p.pitch } : null,
    };
    if (!base.dimensions) {
      base.diffs = [...World.diffs.entries()];
      base.signs = [...World.signs.entries()];
      base.signDirs = [...World.signDirs.entries()];
      base.lore = [...World.loreMap.entries()];
      base.chests = [...World.chests.entries()].map(([k, slots]) => [k, slots.map(s => Save.packStack(s))]);
      base.spawners = [...World.spawners.entries()].filter(([k, sp]) => !sp || sp.type !== 'jelly_house').map(([k, sp]) => [k, {
          type: sp.type, roster: sp.roster || null, rank: sp.rank || '', remaining: sp.remaining,
          max: sp.max, spawned: sp.spawned, dungeonKey: sp.dungeonKey || '', liveCap: sp.liveCap,
          pool: Array.isArray(sp.pool) ? sp.pool.slice(0, 12) : undefined,
        }]);
      base.jellyHouses = (typeof Jelly !== 'undefined' ? Jelly.saveHouseEntries() : []);
      base.bedDirs = [...World.bedDirs.entries()];
      base.photoDirs = [...World.photoDirs.entries()];
      base.stairSideways = [...World.stairSideways.entries()];
      base.waterlogged = [...World.waterlogged];
      base.crops = [...World.crops.entries()];
      base.plantationOrigins = [...World.plantationOrigins.entries()];
      base.plantationUnderSlabs = [...World.plantationUnderSlabs.entries()];
      base.furnaces = [...World.furnaces.entries()].map(([k, f]) => [k, {
        i: Save.packStack(f.in), f: Save.packStack(f.fuel), o: Save.packStack(f.out),
        burn: +((f.burn || 0).toFixed ? f.burn.toFixed(2) : (f.burn || 0)), burnMax: f.burnMax || 0, cook: +((f.cook || 0).toFixed ? f.cook.toFixed(2) : (f.cook || 0)),
      }]);
      base.mobs = Mobs.serialize();
      base.cars = Vehicles.serialize();
      base.boards = Vehicles.serializeBoards();
      base.boats = Vehicles.serializeBoats();
      base.dynamics = Dynamics.serialize();
    }
    return base;
  },

  playerState() {
    const p = Player;
    const held = p.held ? p.held() : null;
    const swingIntent = Number.isFinite(+p.swingIntentT) ? +p.swingIntentT : 0;
    return {
      x: +p.body.x.toFixed(3), y: +p.body.y.toFixed(3), z: +p.body.z.toFixed(3),
      vx: +p.body.vx.toFixed(3), vy: +p.body.vy.toFixed(3), vz: +p.body.vz.toFixed(3),
      yaw: +p.yaw.toFixed(4), pitch: +p.pitch.toFixed(4),
      h: p.body.h, hp: p.hp, dead: !!p.dead,
      held: held ? held.id : 0,
      dim: (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld'),
      swim: !!p.swimming, sneak: !!p.sneaking, sprint: !!p.sprinting,
      swing: p.swingSeq || 0,
      swingT: +swingIntent.toFixed(3),
      swinging: !!(swingIntent > 0 || p.mining || (p.lmb && !p.dead)),
      sit: !!(typeof Vehicles !== 'undefined' && (Vehicles.driving || Vehicles.boating || p.boarding)),
      board: !!p.boarding,
      inv: p.gamemode === 'creative',
    };
  },

  update(dt) {
    if (!Game.inWorld || !World.ready) return;
    if (this.role === 'solo') return;
    const now = performance.now();
    if (this.connected && now - this.lastSend > 70) {
      this.lastSend = now;
      this.send({ type: 'player_state', state: this.playerState() });
    }
    if (this.role === 'host' && this.connected && now - this.lastTimeSend > 2000) {
      this.lastTimeSend = now;
      this.broadcast({
        type: 'host_time', id: this.id,
        time: Game.time, dayCount: Game.dayCount, humbugAnnounced: Game.humbugAnnounced,
        stocks: Game.stocks,
      });
    }
    // ping: client measures RTT to host every 2s; host aggregates + broadcasts a table
    if (this.connected && now - (this._lastPing || 0) > 2000) {
      this._lastPing = now;
      if (this.role === 'client') this.sendTo(this.hostConn, { type:'ping', t: now, id: this.id });
      else if (this.role === 'host') {
        if (!this.pings) this.pings = new Map();
        this.pings.set(this.id, 0); // host is 0ms to itself
        this.broadcast({ type:'ping_table', id: this.id, pings: [...this.pings.entries()] });
      }
    }
    this.updatePeers(dt);
  },

  applyHostTime(msg) {
    if (!msg) return;
    if (Number.isFinite(+msg.time)) Game.time = +msg.time;
    if (Number.isFinite(+msg.dayCount)) Game.dayCount = +msg.dayCount;
    if (typeof msg.humbugAnnounced === 'boolean') Game.humbugAnnounced = msg.humbugAnnounced;
    if (msg.stocks && Array.isArray(msg.stocks.hist)) Game.stocks = msg.stocks;
  },

  onLocalBlockChange(x, y, z, id, opts, oldId) {
    if (!this.connected || this.role === 'solo' || this.applyingRemote || !World.ready) return;
    this.send({ type: 'block', x, y, z, block: id, old: oldId || 0, noUpdate: !!(opts && opts.noUpdate), skipPortalCheck: !!(opts && opts.skipPortalCheck) });
  },

  applyRemoteBlock(msg) {
    if (!World || !World.ready) return;
    const x = Math.floor(+msg.x), y = Math.floor(+msg.y), z = Math.floor(+msg.z), id = msg.block | 0;
    if (!World.hasChunk || !World.hasChunk(x, z)) {
      const pk = World.pkey(x, y, z);
      const ck = World.chunkKeyForBlock ? World.chunkKeyForBlock(x, z) : World.key(Math.floor(x / 16), Math.floor(z / 16));
      World.diffs.set(pk, id);
      if (!World.diffIndex.has(ck)) World.diffIndex.set(ck, new Map());
      World.diffIndex.get(ck).set(pk, id);
      return;
    }
    this.applyingRemote = true;
    try { World.setBlock(x, y, z, id, { remote: true, noUpdate: !!msg.noUpdate, skipPortalCheck: !!msg.skipPortalCheck }); }
    finally { this.applyingRemote = false; }
  },

  broadcastSign(key, text) {
    if (!this.connected || this.role === 'solo' || !key) return;
    this.send({ type: 'sign', key, text: String(text || '').slice(0, 30) });
  },

  applyRemoteSign(msg) {
    if (!msg.key || typeof World === 'undefined') return;
    World.signs.set(String(msg.key), String(msg.text || '').slice(0, 30));
    const parts = String(msg.key).split(',').map(Number);
    if (parts.length >= 3) World.dirty.add(World.chunkKeyForBlock ? World.chunkKeyForBlock(parts[0], parts[2]) : World.key(Math.floor(parts[0] / 16), Math.floor(parts[2] / 16))); 
  },

  sendChat(text) {
    if (!this.connected || this.role === 'solo') return;
    this.send({ type: 'chat', text: String(text || '').slice(0, 120), name: this.localName });
  },

  announceDeath(text) {
    text = String(text || 'A player died.').slice(0, 180);
    if (typeof UI !== 'undefined' && UI.chat) UI.chat(text, '#ff7777');
    if (this.connected && this.role !== 'solo') this.send({ type: 'death_message', text, name: this.localName });
  },

  getPeer(id) {
    let p = this.peers.get(id);
    if (!p) {
      p = this.createPeerObject(id);
      this.peers.set(id, p);
    }
    return p;
  },

  applyPeerState(id, state) {
    if (!state || !Number.isFinite(+state.x)) return;
    const p = this.getPeer(id);
    p.lastSeen = performance.now();
    p.target = Object.assign({}, state);
    if (!p.state) p.state = Object.assign({}, state);
  },

  createPeerObject(id) {
    const group = new THREE.Group();
    group.name = 'remote_player_' + id;
    // pixel-art player skin (shared canvas textures via Mobs.skinTex; fresh
    // materials per peer because light tint mutates material.color)
    const useSkins = typeof Mobs !== 'undefined' && Mobs.skinTex;
    const P = {
      shirt: (c) => {
        c.fillStyle = '#3c7bd6'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#3369b8'; c.fillRect(7, 0, 2, 16);           // zipper
        c.fillStyle = '#2d5ba3'; c.fillRect(0, 0, 16, 2);           // collar
        c.fillStyle = '#5490e0'; c.fillRect(1, 3, 3, 1); c.fillRect(12, 5, 3, 1); // fold light
        c.fillStyle = '#2d5ba3'; c.fillRect(0, 14, 16, 2);          // hem
      },
      skinArm: (c) => {
        c.fillStyle = '#3c7bd6'; c.fillRect(0, 0, 16, 16);          // sleeve
        c.fillStyle = '#2d5ba3'; c.fillRect(0, 6, 16, 1);           // sleeve end
        c.fillStyle = '#d8a882'; c.fillRect(0, 7, 16, 9);           // bare arm
        c.fillStyle = '#c79877'; c.fillRect(0, 13, 16, 1);          // wrist crease
      },
      jeans: (c) => {
        c.fillStyle = '#27415f'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#20374f'; c.fillRect(7, 0, 2, 16);
        c.fillStyle = '#1a1a1a'; c.fillRect(0, 13, 16, 3);          // shoes
      },
      headSide: (c) => {
        c.fillStyle = '#d8a882'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#4a3016'; c.fillRect(0, 0, 16, 5);           // hair
        c.fillStyle = '#5c3d1e'; c.fillRect(2, 5, 2, 1); c.fillRect(9, 5, 3, 1); // hair edge
      },
      headTop: (c) => { c.fillStyle = '#4a3016'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#5c3d1e'; c.fillRect(3, 3, 4, 4); c.fillRect(9, 8, 4, 4); },
      headFace: (c) => {
        c.fillStyle = '#d8a882'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#4a3016'; c.fillRect(0, 0, 16, 4);           // fringe
        c.fillStyle = '#c79877'; c.fillRect(7, 8, 2, 2);            // nose
        c.fillStyle = '#a86f4c'; c.fillRect(5, 12, 6, 1);           // mouth
      },
    };
    const smat = (key, painter) => useSkins
      ? new THREE.MeshLambertMaterial({ map: Mobs.skinTex('player_' + key, painter) })
      : new THREE.MeshLambertMaterial({ color: 0x3c7bd6 });
    const matBody = smat('shirt', P.shirt);
    const matSkin = smat('arm', P.skinArm);
    const matDark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.28), matBody);
    body.position.y = 1.02;
    // the head model faces -z, so the face texture goes on material index 5
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), useSkins
      ? [smat('head_side', P.headSide), smat('head_side', P.headSide), smat('head_top', P.headTop), smat('head_side', P.headSide), smat('head_side', P.headSide), smat('head_face', P.headFace)]
      : new THREE.MeshLambertMaterial({ color: 0xd8a882 }));
    head.position.y = 1.55;
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.012), matDark);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.09, 1.60, -0.236); eyeR.position.set(0.09, 1.60, -0.236);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.65, 0.17), matSkin);
    const armR = armL.clone();
    armL.position.set(-0.39, 1.02, 0); armR.position.set(0.39, 1.02, 0);
    const legMat = smat('jeans', P.jeans);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.68, 0.20), legMat);
    const legR = legL.clone();
    legL.position.set(-0.14, 0.34, 0); legR.position.set(0.14, 0.34, 0);
    group.add(body, head, eyeL, eyeR, armL, armR, legL, legR);
    Game.scene.add(group);
    return {
      id, group, state: null, target: null, lastSeen: performance.now(),
      body: { x: 0, y: 0, z: 0, w: 0.3, h: 1.8, dead: false },
      swingSeq: undefined, swingT: 0, swingHoldT: 0,
      parts: { body, head, armL, armR, legL, legR },
    };
  },

  removePeerObject(p) {
    if (!p || !p.group || !Game.scene) return;
    Game.scene.remove(p.group);
    p.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose && m.dispose());
        else if (o.material.dispose) o.material.dispose();
      }
    });
  },

  removePeer(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.removePeerObject(p);
    this.peers.delete(id);
    if (this.clearRemoteBreak) this.clearRemoteBreak(id); // drop their break overlay too
  },

  updatePeers(dt) {
    const now = performance.now();
    const dim = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
    for (const [id, p] of [...this.peers.entries()]) {
      if (now - p.lastSeen > 15000) { this.removePeer(id); continue; }
      if (!p.target) continue;
      if (!p.state) p.state = Object.assign({}, p.target);
      const a = Math.min(1, 12 * dt);
      for (const k of ['x', 'y', 'z', 'yaw', 'pitch']) {
        p.state[k] = (p.state[k] || 0) + ((+p.target[k] || 0) - (p.state[k] || 0)) * a;
      }
      p.state.dead = !!p.target.dead;
      p.state.dim = p.target.dim;
      p.group.visible = !p.state.dead && p.state.dim === dim;
      p.group.position.set(p.state.x, p.state.y, p.state.z);
      p.group.rotation.y = p.state.yaw || 0;
      p.body.x = p.state.x; p.body.y = p.state.y; p.body.z = p.state.z; p.body.h = +p.target.h || 1.8; p.body.dead = !!p.state.dead;
      const moving = Math.abs(+p.target.vx || 0) + Math.abs(+p.target.vz || 0) > 0.3;
      const bob = moving ? Math.sin(now * 0.012) * 0.35 : 0;
      const remoteSwingSeq = Number.isFinite(+p.target.swing) ? +p.target.swing : 0;
      if (p.swingSeq === undefined) p.swingSeq = remoteSwingSeq;
      else if (remoteSwingSeq !== p.swingSeq) { p.swingSeq = remoteSwingSeq; p.swingT = 0.3; }
      if (p.swingT > 0) p.swingT = Math.max(0, p.swingT - dt);
      if (p.target.swinging || p.swingT > 0) p.swingHoldT = (p.swingHoldT || 0) + dt;
      else p.swingHoldT = 0;
      const impulseSwing = p.swingT > 0 ? Math.sin((1 - p.swingT / 0.3) * Math.PI) * 1.25 : 0;
      const heldSwing = p.target.swinging ? Math.sin((((p.swingHoldT || 0) / 0.24) % 1) * Math.PI) * 1.15 : 0;
      const actionSwing = Math.max(impulseSwing, heldSwing, 0);
      if (p.parts) {
        p.parts.head.rotation.x = (p.state.pitch || 0) * 0.35;
        p.parts.armL.rotation.x = bob;
        p.parts.armR.rotation.x = -bob + actionSwing;
        p.parts.legL.rotation.x = -bob;
        p.parts.legR.rotation.x = bob;
        if (p.target.swim) p.group.rotation.x = Math.PI / 2.8;
        else p.group.rotation.x = 0;
      }
    }
  },

  remoteBodies() {
    const arr = [];
    const dim = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
    for (const p of this.peers.values()) {
      if (p && p.body && !p.body.dead && p.group && p.group.visible && (!p.state || p.state.dim === dim)) arr.push(p.body);
    }
    return arr;
  },
};

// ============================================================
// Full multiplayer sync pass: host-authoritative live entities,
// drops/pickups, projectiles, PvP, host-only commands, and remote equipment.
// Kept as a patch layer so older single-player code stays untouched.
// ============================================================
(function installFloopFullSyncPatch(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__fullSyncPatchInstalled) return;
  Multiplayer.__fullSyncPatchInstalled = true;

  const baseInit = Multiplayer.init ? Multiplayer.init.bind(Multiplayer) : function(){};
  Multiplayer.init = function(){
    baseInit();
    this.installFullSyncHooks();
  };

  Object.assign(Multiplayer, {
    applyingRemoteState: false,
    fullSyncHooksInstalled: false,
    lastHostStateSend: 0,
    lastHostWorldSend: 0,
    lastClientActionSend: 0,
    lastVehicleApply: 0,
    lastWorldApply: 0,
    mobSeq: 1,
    dropSeq: 1,
    arrowSeq: 1,
    rocketSeq: 1,

    isClient() { return this.role === 'client' && this.connected; },
    isHost() { return this.role === 'host' && this.connected; },
    ownsWorldSimulation() { return this.role !== 'client'; },

    installFullSyncHooks() {
      if (this.fullSyncHooksInstalled) return;
      this.fullSyncHooksInstalled = true;
      const MP = this;

      // Commands are host-only in multiplayer. Normal chat still works for everyone.
      if (typeof UI !== 'undefined' && UI.runChat && !UI.__mpCommandPatch) {
        UI.__mpCommandPatch = true;
        const oldRunChat = UI.runChat.bind(UI);
        UI.runChat = function(text) {
          const t = String(text || '').trim();
          // /goto and /bring are social teleports, not cheats — always allowed
          const socialCmd = /^\/(goto|bring)\b/i.test(t);
          if (t.startsWith('/') && !socialCmd && typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && !Multiplayer.clientCommandsAllowed) {
            this.chat('Commands are host-only. The host can run /allowcommands to enable them.', '#ff8080');
            return;
          }
          return oldRunChat(text);
        };
      }

      // Clients do not run independent world simulation. They render host state and send requests.
      const gateUpdate = (obj, name, clientFn) => {
        if (!obj || !obj[name] || obj['__mpGate_' + name]) return;
        obj['__mpGate_' + name] = true;
        const old = obj[name].bind(obj);
        obj[name] = function(dt) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client') {
            if (clientFn) return clientFn.call(this, dt || 0);
            return;
          }
          return old(dt || 0);
        };
      };
      gateUpdate(typeof Mobs !== 'undefined' ? Mobs : null, 'update', function(dt){ MP.clientMobVisualTick(dt); });
      // Clients still run their OWN player hazard damage (lava/fire/cactus). The rest of
      // Dynamics (world mutation, mob hazards) stays host-authoritative. updateHazards
      // guards its mob loop to host-only so clients don't damage host-owned mobs.
      gateUpdate(typeof Dynamics !== 'undefined' ? Dynamics : null, 'update', function(dt){ if (this.updateHazards) this.updateHazards(dt || 0); });
      gateUpdate(typeof Water !== 'undefined' ? Water : null, 'update', function(){});
      gateUpdate(typeof Lava !== 'undefined' ? Lava : null, 'update', function(){});
      // NOTE: Vehicles.update / updateBoard are intentionally NOT gated here.
      // The fable client wrappers (installed at load, further down this file) already
      // branch on role==='client' to run the driven vehicle's physics locally and
      // return. A no-op gate here would wrap and shadow those wrappers (this gate
      // installs at init, AFTER them), leaving clients unable to move the car they
      // are sitting in. Other vehicles are interpolated by clientVehicleVisualTick,
      // which runs every frame from fullSyncUpdate.
      gateUpdate(typeof Guns !== 'undefined' ? Guns : null, 'update', function(dt){ MP.clientProjectileVisualTick(dt); });
      gateUpdate(typeof Drops !== 'undefined' ? Drops : null, 'update', function(dt){ MP.clientDropVisualTick(dt); });

      // Game background world mutators also stay host-side.
      const patchGameTick = (name) => {
        if (typeof Game === 'undefined' || !Game[name] || Game['__mpGate_' + name]) return;
        Game['__mpGate_' + name] = true;
        const old = Game[name].bind(Game);
        Game[name] = function(dt) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client') return;
          return old(dt || 0);
        };
      };
      ['updateFurnaces','updateSaplings','updateCrops','updateGrassSpread','updateStocks'].forEach(patchGameTick);

      // Stable IDs for mobs.
      if (typeof Mobs !== 'undefined' && Mobs.spawn && !Mobs.__mpSpawnPatch) {
        Mobs.__mpSpawnPatch = true;
        const oldSpawn = Mobs.spawn.bind(Mobs);
        Mobs.spawn = function(type, x, y, z, gunId, color) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) return null;
          const m = oldSpawn(type, x, y, z, gunId, color);
          if (m && !m.mpId) m.mpId = 'm' + (Multiplayer.mobSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
          return m;
        };
      }

      // Client damage requests for mobs; host applies real damage and sends new state.
      if (typeof Mobs !== 'undefined' && Mobs.hurt && !Mobs.__mpHurtPatch) {
        Mobs.__mpHurtPatch = true;
        const oldHurt = Mobs.hurt.bind(Mobs);
        Mobs.hurt = function(mob, dmg, kx, kz, src) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) {
            if (mob && mob.mpId) Multiplayer.send({ type:'mob_hurt_request', mobId: mob.mpId, dmg:+dmg || 0, kx:+kx || 0, kz:+kz || 0, src:'player' });
            return;
          }
          return oldHurt(mob, dmg, kx, kz, src);
        };
      }

      // Host mobs can see remote players as targets.
      if (typeof Mobs !== 'undefined' && Mobs.targetOf && !Mobs.__mpTargetPatch) {
        Mobs.__mpTargetPatch = true;
        const oldTargetOf = Mobs.targetOf.bind(Mobs);
        Mobs.targetOf = function(m) {
          const local = oldTargetOf(m);
          if (typeof Multiplayer === 'undefined' || Multiplayer.role !== 'host') return local;
          let best = local;
          let bestD = local ? ((local.x - m.body.x) ** 2 + (local.z - m.body.z) ** 2) : Infinity;
          for (const [pid, peer] of Multiplayer.peers.entries()) {
            const st = peer && (peer.target || peer.state);
            if (!st || st.dead || st.dim !== (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld')) continue;
            const d = (st.x - m.body.x) ** 2 + (st.z - m.body.z) ** 2;
            if (d < bestD) {
              bestD = d;
              best = { x:+st.x, y:+st.y, z:+st.z, h:+st.h || 1.8, isPlayer:true, remotePlayerId:pid };
            }
          }
          return best;
        };
      }
      if (typeof Mobs !== 'undefined' && Mobs.dmgTarget && !Mobs.__mpDmgTargetPatch) {
        Mobs.__mpDmgTargetPatch = true;
        const oldDmgTarget = Mobs.dmgTarget.bind(Mobs);
        Mobs.dmgTarget = function(tgt, dmg, kx, kz, src) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'host' && tgt && tgt.remotePlayerId) {
            Multiplayer.damageRemotePlayer(tgt.remotePlayerId, dmg, kx, kz, src && src.type ? ('mob:' + src.type) : 'mob');
            return;
          }
          return oldDmgTarget(tgt, dmg, kx, kz, src);
        };
      }

      // Dropped items are created and picked up by the host. Clients send requests.
      if (typeof Drops !== 'undefined' && Drops.spawn && !Drops.__mpSpawnPatch) {
        Drops.__mpSpawnPatch = true;
        const oldDropSpawn = Drops.spawn.bind(Drops);
        Drops.spawn = function(x, y, z, id, count, vel, dur, data) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) {
            Multiplayer.send({ type:'drop_request', x:+x, y:+y, z:+z, item:id|0, count:count|0, vel:vel || null, dur, data });
            return null;
          }
          const before = this.list.length;
          const ret = oldDropSpawn(x, y, z, id, count, vel, dur, data);
          for (let i = before; i < this.list.length; i++) {
            const d = this.list[i];
            if (d && !d.mpId) d.mpId = 'd' + (Multiplayer.dropSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
          }
          return ret;
        };
      }

      // Projectiles fired by clients are requested from the host.
      if (typeof Mobs !== 'undefined' && Mobs.shootArrow && !Mobs.__mpArrowPatch) {
        Mobs.__mpArrowPatch = true;
        const oldShootArrow = Mobs.shootArrow.bind(Mobs);
        Mobs.shootArrow = function(x, y, z, tx, ty, tz, owner, opts) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState && owner === 'player') {
            Multiplayer.send({ type:'arrow_request', x:+x, y:+y, z:+z, tx:+tx, ty:+ty, tz:+tz, opts:opts || {} });
            return;
          }
          const before = this.arrows.length;
          const ret = oldShootArrow(x, y, z, tx, ty, tz, owner, opts);
          for (let i = before; i < this.arrows.length; i++) {
            const a = this.arrows[i];
            if (a && !a.mpId) a.mpId = 'a' + (Multiplayer.arrowSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
          }
          return ret;
        };
      }
      if (typeof Guns !== 'undefined' && Guns.spawnRocket && !Guns.__mpRocketPatch) {
        Guns.__mpRocketPatch = true;
        const oldSpawnRocket = Guns.spawnRocket.bind(Guns);
        Guns.spawnRocket = function(from, dir, src) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState && src === 'player') {
            Multiplayer.send({ type:'rocket_request', from, dir });
            return;
          }
          const before = this.rockets.length;
          const ret = oldSpawnRocket(from, dir, src);
          for (let i = before; i < this.rockets.length; i++) {
            const r = this.rockets[i];
            if (r && !r.mpId) r.mpId = 'r' + (Multiplayer.rocketSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
          }
          return ret;
        };
      }

      // PvP for melee and guns/hitscan.
      if (typeof Player !== 'undefined' && Player.tryAttack && !Player.__mpPvpAttackPatch) {
        Player.__mpPvpAttackPatch = true;
        const oldTryAttack = Player.tryAttack.bind(Player);
        Player.tryAttack = function() {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && this.attackT <= 0) {
            const d = this.lookDir();
            const s = this.held();
            const heldDef = s && Reg[s.id] ? Reg[s.id] : null;
            const tool = heldDef && heldDef.tool && typeof heldDef.tool === 'object' ? heldDef.tool : null;
            const dmg = Math.max(0.1, tool && Number.isFinite(+tool.dmg) ? +tool.dmg : 1);
            const knock = Math.max(0, tool && Number.isFinite(+tool.knock) ? +tool.knock : 6);
            if (Multiplayer.tryPvpHit(this.body.x, this.eyeY(), this.body.z, d.x, d.y, d.z, 4, dmg, knock, 'melee')) {
              this.swingViewmodel();
              this.exhaustion += 0.1;
              this.attackT = 0.35;
              this.damageHeld(1);
              return;
            }
          }
          return oldTryAttack();
        };
      }
      if (typeof Guns !== 'undefined' && Guns.hitscan && !Guns.__mpPvpHitscanPatch) {
        Guns.__mpPvpHitscanPatch = true;
        const oldHitscan = Guns.hitscan.bind(Guns);
        Guns.hitscan = function(from, dir, d, src) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && src === 'player') {
            Multiplayer.tryPvpHit(from.x, from.y, from.z, dir.x, dir.y, dir.z, d.range || 40, d.dmg || 1, 3, 'gun');
          }
          return oldHitscan(from, dir, d, src);
        };
      }

      // Broadcast a hurt flash whenever we take damage from ANY source (fall, mob, lava,
      // explosion, pvp) so every other player sees our model flash red + hear it.
      if (typeof Player !== 'undefined' && Player.hurt && !Player.__mpDamageBroadcastPatch) {
        Player.__mpDamageBroadcastPatch = true;
        const oldPlayerHurt = Player.hurt.bind(Player);
        Player.hurt = function(dmg, kx, kz, opts) {
          const before = this.hp;
          const ret = oldPlayerHurt(dmg, kx, kz, opts);
          if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role !== 'solo'
              && this.hp < before && this.gamemode !== 'creative') {
            Multiplayer.send({ type:'player_hurt', id:Multiplayer.id });
          }
          return ret;
        };
      }

      // Broadcast gunfire so other players hear the shot and see the tracer.
      if (typeof Guns !== 'undefined' && Guns.tryFire && !Guns.__mpFireBroadcast) {
        Guns.__mpFireBroadcast = true;
        const oldTryFire = Guns.tryFire.bind(Guns);
        Guns.tryFire = function(gunId, isHeld) {
          const fired = oldTryFire(gunId, isHeld);
          if (fired && typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role !== 'solo') {
            const eye = { x: Player.body.x, y: Player.eyeY(), z: Player.body.z };
            const look = Player.lookDir();
            Multiplayer.send({ type:'gun_fire', id:Multiplayer.id, gun:gunId|0,
              fx:+eye.x.toFixed(2), fy:+eye.y.toFixed(2), fz:+eye.z.toFixed(2),
              dx:+look.x.toFixed(3), dy:+look.y.toFixed(3), dz:+look.z.toFixed(3),
              dim:(typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld') });
          }
          return fired;
        };
      }

      // Extend message handling.
      if (!this.__mpReceivePatch) {
        this.__mpReceivePatch = true;
        const oldReceive = this.receiveNetworkMessage.bind(this);
        this.receiveNetworkMessage = function(msg, fromId, cameFromClient) {
          if (!msg || !msg.type) return;
          if (this.handleFullSyncMessage(msg, fromId, cameFromClient)) return;
          return oldReceive(msg, fromId, cameFromClient);
        };
      }

      // Extend main multiplayer update.
      if (!this.__mpUpdatePatch) {
        this.__mpUpdatePatch = true;
        const oldUpdate = this.update.bind(this);
        this.update = function(dt) {
          oldUpdate(dt || 0);
          this.fullSyncUpdate(dt || 0);
        };
      }
    },

    handleFullSyncMessage(msg, fromId, cameFromClient) {
      const sender = fromId || msg.id;
      if (msg.type === 'host_state') { if (this.role === 'client') this.applyHostLiveState(msg); return true; }
      if (msg.type === 'host_world_state') { if (this.role === 'client') this.applyHostWorldState(msg); return true; }
      if (msg.type === 'mob_hurt_request') {
        if (this.role === 'host' && cameFromClient) {
          const m = this.findMobById(msg.mobId);
          if (m) Mobs.hurt(m, +msg.dmg || 0, +msg.kx || 0, +msg.kz || 0, 'peer:' + sender);
        }
        return true;
      }
      if (msg.type === 'drop_request') {
        if (this.role === 'host' && cameFromClient) Drops.spawn(+msg.x, +msg.y, +msg.z, msg.item|0, msg.count|0, msg.vel || null, msg.dur, msg.data);
        return true;
      }
      if (msg.type === 'pickup_request') {
        if (this.role === 'host' && cameFromClient) this.hostHandlePickup(sender, msg.dropId);
        return true;
      }
      if (msg.type === 'give_item') {
        if (this.role === 'client') this.clientReceiveItem(msg);
        return true;
      }
      if (msg.type === 'arrow_request') {
        if (this.role === 'host' && cameFromClient) {
          Mobs.shootArrow(+msg.x, +msg.y, +msg.z, +msg.tx, +msg.ty, +msg.tz, 'player:' + sender, msg.opts || {});
        }
        return true;
      }
      if (msg.type === 'rocket_request') {
        if (this.role === 'host' && cameFromClient && msg.from && msg.dir) Guns.spawnRocket(msg.from, msg.dir, 'player:' + sender);
        return true;
      }
      if (msg.type === 'pvp_hit') {
        if (this.role === 'host') this.hostHandlePvpHit(sender, msg);
        return true;
      }
      if (msg.type === 'pvp_damage') {
        if (this.role === 'client') Player.hurt(+msg.dmg || 0, +msg.kx || 0, +msg.kz || 0, { source: msg.source && msg.source !== 'world' ? msg.source : 'pvp', attackerName: msg.attackerName || this.peerNames.get(msg.attacker) || '', attackerType: msg.attackerType || '', pierce:false });
        return true;
      }
      if (msg.type === 'vehicle_request') {
        // Reserved path for future exact vehicle input authority. Current pass syncs vehicle positions host -> clients.
        return true;
      }
      return false;
    },

    fullSyncUpdate(dt) {
      if (!Game.inWorld || !World.ready || this.role === 'solo') return;
      const now = performance.now();
      if (this.role === 'host' && this.connected) {
        this.hostArrowPvp();
        if (now - this.lastHostStateSend > 125) {
          this.lastHostStateSend = now;
          this.broadcast(this.makeHostLiveState());
        }
        if (now - this.lastHostWorldSend > 1200) {
          this.lastHostWorldSend = now;
          this.broadcast(this.makeHostWorldState());
        }
      }
    },

    playerState() {
      const p = Player;
      const held = p.held ? p.held() : null;
      const swingIntent = Number.isFinite(+p.swingIntentT) ? +p.swingIntentT : 0;
      return {
        x: +p.body.x.toFixed(3), y: +p.body.y.toFixed(3), z: +p.body.z.toFixed(3),
        vx: +p.body.vx.toFixed(3), vy: +p.body.vy.toFixed(3), vz: +p.body.vz.toFixed(3),
        yaw: +p.yaw.toFixed(4), pitch: +p.pitch.toFixed(4),
        h: p.body.h, hp: p.hp, dead: !!p.dead,
        held: held ? held.id : 0,
        heldDur: held && held.dur !== undefined ? held.dur : undefined,
        armor: (p.armor || []).map(s => s ? { id:s.id, dur:s.dur } : null),
        dim: (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld'),
        swim: !!p.swimming, sneak: !!p.sneaking, sprint: !!p.sprinting,
        swing: p.swingSeq || 0,
        swingT: +swingIntent.toFixed(3),
        swinging: !!(swingIntent > 0 || p.mining || (p.lmb && !p.dead)),
        sit: !!(typeof Vehicles !== 'undefined' && (Vehicles.driving || Vehicles.boating || p.boarding)),
        board: !!p.boarding,
        inv: p.gamemode === 'creative',
      };
    },

    makeHostLiveState() {
      return {
        type:'host_state', id:this.id, time:Game.time, dayCount:Game.dayCount,
        humbugAnnounced:Game.humbugAnnounced, stocks:Game.stocks,
        dynamics: (typeof Dynamics !== 'undefined' && Dynamics.serialize ? Dynamics.serialize() : null),
        mobs:this.serializeMobsLive(), drops:this.serializeDropsLive(), arrows:this.serializeArrowsLive(), rockets:this.serializeRocketsLive(),
        cars: (typeof Vehicles !== 'undefined' ? Vehicles.serialize() : []),
        boards: (typeof Vehicles !== 'undefined' ? Vehicles.serializeBoards() : []),
        boats: (typeof Vehicles !== 'undefined' ? Vehicles.serializeBoats() : []),
      };
    },

    makeHostWorldState() {
      const pack = (s) => (typeof Save !== 'undefined' && Save.packStack) ? Save.packStack(s) : (s ? { id:s.id, count:s.count, dur:s.dur } : null);
      return { type:'host_world_state', id:this.id,
        currentDimension: (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld'),
        signs:[...World.signs.entries()], signDirs:[...World.signDirs.entries()], lore:[...World.loreMap.entries()],
        chests:[...World.chests.entries()].map(([k, slots]) => [k, slots.map(pack)]),
        spawners:[...World.spawners.entries()].filter(([k, sp]) => !sp || sp.type !== 'jelly_house').map(([k, sp]) => [k, {
          type: sp.type, roster: sp.roster || null, rank: sp.rank || '', remaining: sp.remaining,
          max: sp.max, spawned: sp.spawned, dungeonKey: sp.dungeonKey || '', liveCap: sp.liveCap,
          pool: Array.isArray(sp.pool) ? sp.pool.slice(0, 12) : undefined,
        }]),
        jellyHouses:(typeof Jelly !== 'undefined' ? Jelly.saveHouseEntries() : []),
        bedDirs:[...World.bedDirs.entries()], photoDirs:[...World.photoDirs.entries()], stairSideways:[...World.stairSideways.entries()],
        crops:[...World.crops.entries()], plantationOrigins:[...World.plantationOrigins.entries()], plantationUnderSlabs:[...World.plantationUnderSlabs.entries()],
        furnaces:[...World.furnaces.entries()].map(([k, f]) => [k, { i:pack(f.in), f:pack(f.fuel), o:pack(f.out), burn:f.burn || 0, burnMax:f.burnMax || 0, cook:f.cook || 0 }]),
      };
    },

    serializeMobsLive() {
      if (typeof Mobs === 'undefined') return [];
      return Mobs.list.filter(m => m && !m.dead).map(m => {
        if (!m.mpId) m.mpId = 'm' + (this.mobSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
        const b = m.body;
        return { mid:m.mpId, t:m.type, x:+b.x.toFixed(3), y:+b.y.toFixed(3), z:+b.z.toFixed(3), vx:+(b.vx||0).toFixed(3), vy:+(b.vy||0).toFixed(3), vz:+(b.vz||0).toFixed(3), h:b.h, w:b.w, hp:m.hp, g:m.gunId || 0, c:m.color || 0, yaw:+(m.yaw||0).toFixed(4), flash:m.flash || 0, atk:m.attackSwingT || 0 };
      });
    },

    serializeDropsLive() {
      if (typeof Drops === 'undefined') return [];
      return Drops.list.map(d => {
        if (!d.mpId) d.mpId = 'd' + (this.dropSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
        const b = d.body;
        return { did:d.mpId, item:d.id, count:d.count, dur:d.dur, data:d.data, x:+b.x.toFixed(3), y:+b.y.toFixed(3), z:+b.z.toFixed(3), vx:+(b.vx||0).toFixed(3), vy:+(b.vy||0).toFixed(3), vz:+(b.vz||0).toFixed(3), age:+(d.age||0).toFixed(2), pd:+(d.pickupDelay||0).toFixed(2) };
      });
    },

    serializeArrowsLive() {
      if (typeof Mobs === 'undefined') return [];
      return Mobs.arrows.map(a => {
        if (!a.mpId) a.mpId = 'a' + (this.arrowSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
        return { aid:a.mpId, x:+a.x.toFixed(3), y:+a.y.toFixed(3), z:+a.z.toFixed(3), vx:+(a.vx||0).toFixed(3), vy:+(a.vy||0).toFixed(3), vz:+(a.vz||0).toFixed(3), life:+(a.life||0).toFixed(2), stuck:+(a.stuck||0), owner: typeof a.owner === 'string' ? a.owner : (a.owner && a.owner.mpId ? a.owner.mpId : '') };
      });
    },

    serializeRocketsLive() {
      if (typeof Guns === 'undefined') return [];
      return Guns.rockets.map(r => {
        if (!r.mpId) r.mpId = 'r' + (this.rocketSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
        return { rid:r.mpId, x:+r.x.toFixed(3), y:+r.y.toFixed(3), z:+r.z.toFixed(3), vx:+(r.vx||0).toFixed(3), vy:+(r.vy||0).toFixed(3), vz:+(r.vz||0).toFixed(3), life:+(r.life||0).toFixed(2) };
      });
    },

    applyHostLiveState(msg) {
      this.applyingRemoteState = true;
      try {
        this.applyHostTime(msg);
        if (msg.dynamics && typeof Dynamics !== 'undefined' && Dynamics.deserialize) Dynamics.deserialize(msg.dynamics);
        this.applyMobsLive(msg.mobs || []);
        this.applyDropsLive(msg.drops || []);
        this.applyArrowsLive(msg.arrows || []);
        this.applyRocketsLive(msg.rockets || []);
        const now = performance.now();
        if (now - this.lastVehicleApply > 450 && typeof Vehicles !== 'undefined') {
          this.lastVehicleApply = now;
          this.clearVehiclesForRemoteApply();
          Vehicles.deserialize(msg.cars || [], msg.boards || [], msg.boats || []);
        }
      } finally { this.applyingRemoteState = false; }
    },

    applyHostWorldState(msg) {
      if (!World || !World.ready) return;
      const unpack = (s) => (typeof Save !== 'undefined' && Save.unpackStack) ? Save.unpackStack(s) : (s ? { id:s.id, count:s.count, dur:s.dur } : null);
      this.applyingRemote = true;
      try {
        World.signs = new Map(msg.signs || []); World.signDirs = new Map(msg.signDirs || []); World.loreMap = new Map(msg.lore || []);
        // Chests/furnaces must NOT be wholesale-replaced: this snapshot is up to
        // 1.2s stale, and stomping a container the client is editing reverted
        // in-flight item moves (the classic dupe/vanish under ping). The open
        // chest is lock-holder authoritative (chest_snapshot/chest_state own it),
        // and anything this client edited in the last few seconds is left alone.
        const nowMs = performance.now();
        const recent = this._recentContainerEdits || (this._recentContainerEdits = new Map());
        for (const [rk, until] of recent) if (until < nowMs) recent.delete(rk);
        const openChestKey = (typeof UI !== 'undefined' && UI.screen === 'chest' && UI.chestHit)
          ? World.pkey(UI.chestHit.bx, UI.chestHit.by, UI.chestHit.bz) : '';
        const chestProtected = (k) => k === openChestKey || recent.has(k);
        const incomingChests = new Map((msg.chests || []).map(([k, slots]) => [k, (slots || []).map(unpack)]));
        for (const [k, slots] of incomingChests) if (!chestProtected(k)) World.chests.set(k, slots);
        for (const k of [...World.chests.keys()]) if (!incomingChests.has(k) && !chestProtected(k)) World.chests.delete(k);
        World.spawners = new Map((msg.spawners || []).filter(([k, val]) => !val || (val.type || val) !== 'jelly_house').map(([k, val]) => { const obj = (val && typeof val === 'object') ? val : { type: val }; return [k, {
            type: obj.type, cd: Number.isFinite(+obj.cd) ? +obj.cd : 3,
            roster: Array.isArray(obj.roster) ? obj.roster.slice() : undefined,
            rank: obj.rank || '', remaining: Number.isFinite(+obj.remaining) ? +obj.remaining : undefined,
            max: Number.isFinite(+obj.max) ? +obj.max : undefined, spawned: Number.isFinite(+obj.spawned) ? +obj.spawned : undefined,
            dungeonKey: obj.dungeonKey || '', liveCap: Number.isFinite(+obj.liveCap) ? +obj.liveCap : undefined,
            pool: Array.isArray(obj.pool) ? obj.pool.slice(0, 12) : undefined,
          }]; }));
        if (typeof Jelly !== 'undefined') Jelly.loadHouseEntries(msg.jellyHouses || []);
        World.bedDirs = new Map(msg.bedDirs || []); World.photoDirs = new Map(msg.photoDirs || []); World.stairSideways = new Map(msg.stairSideways || []);
        World.crops = new Map(msg.crops || []); World.plantationOrigins = new Map(msg.plantationOrigins || []); World.plantationUnderSlabs = new Map(msg.plantationUnderSlabs || []);
        // Furnaces: full adopt EXCEPT ones this client just edited — for those,
        // only the host's burn/cook progress scalars come through so the UI bars
        // keep moving without reverting the in-flight slot changes.
        const incomingFurn = new Map((msg.furnaces || []).map(([k, f]) => [k, { in:unpack(f.i), fuel:unpack(f.f), out:unpack(f.o), burn:f.burn || 0, burnMax:f.burnMax || 0, cook:f.cook || 0 }]));
        for (const [k, f] of incomingFurn) {
          if (recent.has(k)) {
            const cur = World.furnaces.get(k);
            if (cur) { cur.burn = f.burn; cur.burnMax = f.burnMax; cur.cook = f.cook; }
            else World.furnaces.set(k, f);
          } else World.furnaces.set(k, f);
        }
        for (const k of [...World.furnaces.keys()]) if (!incomingFurn.has(k) && !recent.has(k)) World.furnaces.delete(k);
        if (typeof UI !== 'undefined' && (UI.screen === 'furnace' || UI.screen === 'oxygenBench') && UI.refreshAll) UI.refreshAll();
        for (const k of World.chunks.keys()) World.dirty.add(k);
      } finally { this.applyingRemote = false; }
    },

    applyMobsLive(list) {
      if (typeof Mobs === 'undefined') return;
      const keep = new Set();
      for (const s of list) {
        if (!s || !s.mid) continue;
        keep.add(s.mid);
        let m = this.findMobById(s.mid);
        if (!m) {
          m = Mobs.spawn(s.t, +s.x, +s.y, +s.z, s.g || null, s.c || null);
          if (!m) continue;
          m.mpId = s.mid;
        }
        const b = m.body;
        b.x = +s.x; b.y = +s.y; b.z = +s.z; b.vx = +s.vx || 0; b.vy = +s.vy || 0; b.vz = +s.vz || 0;
        m.hp = Number.isFinite(+s.hp) ? +s.hp : m.hp;
        m.yaw = +s.yaw || 0; m.flash = +s.flash || 0; m.attackSwingT = +s.atk || 0;
        if (m.group) { m.group.position.set(b.x, b.y, b.z); m.group.rotation.y = m.yaw; }
      }
      for (let i = Mobs.list.length - 1; i >= 0; i--) {
        const m = Mobs.list[i];
        if (m && m.mpId && !keep.has(m.mpId)) {
          if (m.group) Mobs.scene.remove(m.group);
          Mobs.list.splice(i, 1);
        }
      }
    },

    applyDropsLive(list) {
      if (typeof Drops === 'undefined') return;
      const keep = new Set();
      for (const s of list) {
        if (!s || !s.did || !s.item) continue;
        keep.add(s.did);
        let d = Drops.list.find(x => x.mpId === s.did);
        if (!d) {
          const before = Drops.list.length;
          Drops.spawn(+s.x, +s.y, +s.z, s.item|0, s.count|0, [0,0,0], s.dur, s.data);
          d = Drops.list[before];
          if (!d) continue;
          d.mpId = s.did;
        }
        d.id = s.item|0; d.count = s.count|0; d.dur = s.dur; d.data = s.data; d.age = +s.age || 0; d.pickupDelay = +s.pd || 0;
        const b = d.body; b.x = +s.x; b.y = +s.y; b.z = +s.z; b.vx = +s.vx || 0; b.vy = +s.vy || 0; b.vz = +s.vz || 0;
        if (d.mesh) d.mesh.position.set(b.x, b.y + 0.18, b.z);
      }
      for (let i = Drops.list.length - 1; i >= 0; i--) {
        const d = Drops.list[i];
        if (d && d.mpId && !keep.has(d.mpId)) Drops.remove(i);
      }
    },

    makeArrowMesh() {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
      Mobs.scene.add(g);
      return g;
    },

    applyArrowsLive(list) {
      if (typeof Mobs === 'undefined') return;
      const keep = new Set();
      for (const s of list) {
        if (!s || !s.aid) continue;
        keep.add(s.aid);
        let a = Mobs.arrows.find(x => x.mpId === s.aid);
        if (!a) { a = { mesh:this.makeArrowMesh(), stuck:0 }; Mobs.arrows.push(a); }
        Object.assign(a, { mpId:s.aid, x:+s.x, y:+s.y, z:+s.z, vx:+s.vx || 0, vy:+s.vy || 0, vz:+s.vz || 0, life:+s.life || 0, stuck:+s.stuck || 0, owner:s.owner || null });
        a.mesh.position.set(a.x, a.y, a.z); a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
      }
      for (let i = Mobs.arrows.length - 1; i >= 0; i--) {
        const a = Mobs.arrows[i];
        if (a && a.mpId && !keep.has(a.mpId)) { if (a.mesh) { Mobs.scene.remove(a.mesh); a.mesh.geometry.dispose(); a.mesh.material.dispose(); } Mobs.arrows.splice(i, 1); }
      }
    },

    makeRocketMesh() {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
      Guns.scene.add(mesh);
      return mesh;
    },

    applyRocketsLive(list) {
      if (typeof Guns === 'undefined') return;
      const keep = new Set();
      for (const s of list) {
        if (!s || !s.rid) continue;
        keep.add(s.rid);
        let r = Guns.rockets.find(x => x.mpId === s.rid);
        if (!r) { r = { mesh:this.makeRocketMesh() }; Guns.rockets.push(r); }
        Object.assign(r, { mpId:s.rid, x:+s.x, y:+s.y, z:+s.z, vx:+s.vx || 0, vy:+s.vy || 0, vz:+s.vz || 0, life:+s.life || 0 });
        r.mesh.position.set(r.x, r.y, r.z); r.mesh.lookAt(r.x + r.vx, r.y + r.vy, r.z + r.vz);
      }
      for (let i = Guns.rockets.length - 1; i >= 0; i--) {
        const r = Guns.rockets[i];
        if (r && r.mpId && !keep.has(r.mpId)) { if (r.mesh) { Guns.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); } Guns.rockets.splice(i, 1); }
      }
    },

    clearVehiclesForRemoteApply() {
      if (typeof Vehicles === 'undefined') return;
      const killGroup = (v) => { if (v && v.group) Vehicles.scene.remove(v.group); else if (v && v.mesh) Vehicles.scene.remove(v.mesh); };
      for (const v of Vehicles.cars || []) killGroup(v);
      for (const v of Vehicles.boats || []) killGroup(v);
      for (const v of Vehicles.boards || []) killGroup(v);
      Vehicles.cars = []; Vehicles.boats = []; Vehicles.boards = [];
    },

    clientMobVisualTick(dt) {
      if (typeof Mobs === 'undefined') return;
      for (const m of Mobs.list) {
        if (!m || !m.group || !m.body) continue;
        m.walkAnim = (m.walkAnim || 0) + dt * (Math.abs(m.body.vx || 0) + Math.abs(m.body.vz || 0));
        m.group.position.set(m.body.x, m.body.y, m.body.z);
        m.group.rotation.y = m.yaw || 0;
        if (Mobs.tintMob) Mobs.tintMob(m);
      }
    },

    clientProjectileVisualTick(dt) {
      if (typeof Guns !== 'undefined' && Guns.cooldown > 0) Guns.cooldown -= dt;
      if (typeof Guns !== 'undefined') {
        for (let i = Guns.tracers.length - 1; i >= 0; i--) {
          const t = Guns.tracers[i]; t.life -= dt; t.line.material.opacity = Math.max(0, t.life / t.max);
          if (t.life <= 0) { Guns.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); Guns.tracers.splice(i, 1); }
        }
      }
    },

    clientDropVisualTick(dt) {
      if (typeof Drops === 'undefined' || typeof Player === 'undefined') return;
      const p = Player.body;
      const now = performance.now();
      for (const d of Drops.list) {
        if (!d || !d.body) continue;
        d.age = (d.age || 0) + dt;
        d.spin = (d.spin || 0) + dt * 2.5;
        const b = d.body;
        const bob = Math.sin((d.age || 0) * 3) * 0.04;
        if (d.mesh) {
          d.mesh.position.set(b.x, b.y + 0.18 + bob, b.z);
          if (d.mesh.isMesh) d.mesh.rotation.y = d.spin;
        }
        if (Drops.tint) Drops.tint(d);
        if (d.mpId && d.age >= (d.pickupDelay || 0) && !Player.dead && Player.canAccept(d.id)) {
          const dist = Math.hypot(p.x - b.x, (p.y + 0.6) - b.y, p.z - b.z);
          if (dist < 0.8 && now - (d._lastPickupAsk || 0) > 350) {
            d._lastPickupAsk = now;
            this.send({ type:'pickup_request', dropId:d.mpId });
          }
        }
      }
    },

    clientReceiveItem(msg) {
      if (!msg || !msg.item || !msg.count) return;
      let leftover;
      if (msg.dur !== undefined) {
        leftover = msg.count | 0;
        for (let slot = 0; slot < 36 && leftover > 0; slot++) if (!Player.inv[slot]) { Player.inv[slot] = { id:msg.item|0, count:1, dur:msg.dur }; leftover--; }
      } else leftover = Player.addItem(msg.item|0, msg.count|0);
      if (leftover > 0) this.send({ type:'drop_request', x:Player.body.x, y:Player.body.y + 1, z:Player.body.z, item:msg.item|0, count:leftover, dur:msg.dur });
      SFX.pop(); UI.updateHotbar();
    },

    hostHandlePickup(pid, dropId) {
      const peer = this.peers.get(pid);
      const st = peer && (peer.target || peer.state);
      if (!st || !dropId) return;
      const idx = Drops.list.findIndex(d => d.mpId === dropId);
      if (idx < 0) return;
      const d = Drops.list[idx], b = d.body;
      if (Math.hypot((+st.x || 0) - b.x, ((+st.y || 0) + 0.6) - b.y, (+st.z || 0) - b.z) > 1.3) return;
      const conn = this.connections.get(pid);
      this.sendTo(conn, { type:'give_item', item:d.id, count:d.count, dur:d.dur, data:d.data });
      Drops.remove(idx);
    },

    findMobById(mid) { return (typeof Mobs !== 'undefined' && Mobs.list) ? Mobs.list.find(m => m && m.mpId === mid) : null; },

    rayPeer(ox, oy, oz, dx, dy, dz, maxDist) {
      let best = null;
      const blockHit = World.raycast(ox, oy, oz, dx, dy, dz, maxDist);
      const blockDist = blockHit ? blockHit.dist : maxDist;
      for (const [id, peer] of this.peers.entries()) {
        const st = peer && (peer.target || peer.state);
        if (!st || st.dead || st.dim !== (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld')) continue;
        const hit = this.rayAabb(ox, oy, oz, dx, dy, dz,
          (+st.x) - 0.34, +st.y, (+st.z) - 0.34,
          (+st.x) + 0.34, (+st.y) + (+st.h || 1.8), (+st.z) + 0.34,
          Math.min(maxDist, blockDist));
        if (hit !== null && (!best || hit < best.dist)) best = { id, dist:hit, state:st };
      }
      return best;
    },

    rayAabb(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ, maxDist) {
      const o = [ox, oy, oz], d = [dx, dy, dz], mn = [minX, minY, minZ], mx = [maxX, maxY, maxZ];
      let t0 = 0, t1 = maxDist;
      for (let ax = 0; ax < 3; ax++) {
        if (Math.abs(d[ax]) < 1e-8) { if (o[ax] < mn[ax] || o[ax] > mx[ax]) return null; }
        else {
          let ta = (mn[ax] - o[ax]) / d[ax], tb = (mx[ax] - o[ax]) / d[ax];
          if (ta > tb) { const q = ta; ta = tb; tb = q; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) return null;
        }
      }
      return t0;
    },

    tryPvpHit(ox, oy, oz, dx, dy, dz, range, dmg, knock, kind) {
      const hit = this.rayPeer(ox, oy, oz, dx, dy, dz, range);
      if (!hit) return false;
      const peer = this.peers && this.peers.get(hit.id);
      const st = peer && (peer.target || peer.state);
      // invincible / creative target: blue "sheen" flash + shielded sound, no damage
      if (st && st.inv) { this.flashPeer(hit.id, true); return true; }
      const kx = dx * (knock || 0), kz = dz * (knock || 0);
      this.send({ type:'pvp_hit', target:hit.id, dmg:+dmg || 1, kx, kz, kind:kind || 'hit', x:ox, y:oy, z:oz });
      if (this.role === 'host') this.hostHandlePvpHit(this.id, { target:hit.id, dmg:+dmg || 1, kx, kz, kind:kind || 'hit' });
      this.flashPeer(hit.id); // local red hit feedback (flash + sound) so we SEE our hit connect
      return true;
    },

    hostHandlePvpHit(attackerId, msg) {
      if (!msg || !msg.target) return;
      const source = msg.kind === 'vehicle' ? 'vehicle' : msg.kind === 'gun' ? 'gun' : msg.kind === 'arrow' ? 'arrow' : 'pvp';
      const attackerName = this.peerNames.get(attackerId) || (attackerId === this.id ? this.localName : '');
      if (msg.target === this.id) {
        Player.hurt(+msg.dmg || 0, +msg.kx || 0, +msg.kz || 0, { source, attackerName });
        return;
      }
      const conn = this.connections.get(msg.target);
      if (conn) this.sendTo(conn, { type:'pvp_damage', dmg:+msg.dmg || 0, kx:+msg.kx || 0, kz:+msg.kz || 0, source, attacker:attackerId || '', attackerName });
    },

    damageRemotePlayer(pid, dmg, kx, kz, source) {
      const conn = this.connections.get(pid);
      if (!conn) return;
      source = source || 'world';
      const mobType = source.indexOf('mob:') === 0 ? source.slice(4) : '';
      this.sendTo(conn, { type:'pvp_damage', dmg:+dmg || 0, kx:+kx || 0, kz:+kz || 0, source:mobType ? 'mob' : source, attackerType:mobType });
    },

    // Explosions damage remote players too (host-authoritative). Cover check uses the
    // same line-of-sight helper so hiding behind blocks still reduces the blast.
    applyExplosionToPeers(ex, ey, ez, hurtRange, maxDmg, cover) {
      if (this.role !== 'host' || !this.connected || !this.peers) return;
      for (const [pid, peer] of this.peers.entries()) {
        const st = peer && (peer.target || peer.state);
        if (!st || st.dead) continue;
        const dx = st.x - ex, dy = (st.y + 0.9) - ey, dz = st.z - ez;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d >= hurtRange) continue;
        const cov = cover ? cover(st.x, st.y + 0.9, st.z) : 1;
        const dmg = Math.round(maxDmg * (1 - d / hurtRange) * cov);
        if (dmg > 0) this.damageRemotePlayer(pid, dmg, dx / (d + 0.01) * 9, dz / (d + 0.01) * 9, 'explosion');
      }
    },

    // A fast vehicle plows through any OTHER player it overlaps. The driver (host OR client)
    // detects the hit and routes damage through the pvp pipeline so authority + feedback work.
    vehicleRunOver(v, dmg) {
      if (!this.connected || this.role === 'solo' || !this.peers) return;
      const b = v.body || v;
      const speed = v.speed || 0, yaw = v.yaw || 0;
      const kx = Math.sin(yaw + Math.PI) * -speed * 0.8, kz = Math.cos(yaw + Math.PI) * -speed * 0.8;
      const myDim = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
      for (const [pid, peer] of this.peers.entries()) {
        const st = peer && (peer.target || peer.state);
        if (!st || st.dead) continue;
        if ((st.dim || 'overworld') !== myDim) continue;
        if (Math.abs(st.x - b.x) < 1.4 && Math.abs(st.z - b.z) < 1.7 && Math.abs(st.y - b.y) < 1.4) {
          this.send({ type:'pvp_hit', target:pid, dmg:+dmg || 1, kx, kz, kind:'vehicle', x:b.x, y:b.y, z:b.z });
          if (this.role === 'host') this.hostHandlePvpHit(this.id, { target:pid, dmg:+dmg || 1, kx, kz, kind:'vehicle' });
          this.flashPeer(pid);
        }
      }
    },

    hostArrowPvp() {
      if (typeof Mobs === 'undefined') return;
      for (let i = Mobs.arrows.length - 1; i >= 0; i--) {
        const a = Mobs.arrows[i];
        if (!a || a.stuck) continue;
        for (const [pid, peer] of this.peers.entries()) {
          const st = peer && (peer.target || peer.state);
          if (!st || st.dead) continue;
          if (typeof a.owner === 'string' && a.owner === 'player:' + pid) continue;
          if (a.x > st.x - 0.42 && a.x < st.x + 0.42 && a.y > st.y && a.y < st.y + (+st.h || 1.8) && a.z > st.z - 0.42 && a.z < st.z + 0.42) {
            this.damageRemotePlayer(pid, 3, (a.vx || 0) * 0.25, (a.vz || 0) * 0.25, 'arrow');
            if (a.mesh) { Mobs.scene.remove(a.mesh); a.mesh.geometry.dispose(); a.mesh.material.dispose(); }
            Mobs.arrows.splice(i, 1);
            break;
          }
        }
      }
    },

    // Remote player visuals: native voxel tint, crouch animation, held item, armor.
    createPeerObject(id) {
      const group = new THREE.Group();
      group.name = 'remote_player_' + id;
      // yaw-then-pitch so a swim/prone tilt (rotation.x) leans the model FORWARD relative
      // to its facing, not sideways (default XYZ order rolls it to the side once yaw is set)
      group.rotation.order = 'YXZ';
      const mkMat = (color) => { const m = new THREE.MeshLambertMaterial({ color }); m.userData.baseColor = new THREE.Color(color); return m; };
      const matBody = mkMat(0x3c7bd6), matSkin = mkMat(0xd8a882), matDark = mkMat(0x1a1a1a);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.28), matBody); body.position.y = 1.02;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), matSkin); head.position.y = 1.55;
      // eyes are CHILDREN of the head (head-relative positions) so they pitch and turn
      // WITH it — previously they were on the group and stayed put when the head looked up/down
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.012), matDark); const eyeR = eyeL.clone();
      eyeL.position.set(-0.09, 0.05, -0.236); eyeR.position.set(0.09, 0.05, -0.236);
      head.add(eyeL, eyeR);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.65, 0.17), matSkin); const armR = armL.clone(); armL.position.set(-0.39, 1.02, 0); armR.position.set(0.39, 1.02, 0);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.68, 0.20), matBody); const legR = legL.clone(); legL.position.set(-0.14, 0.34, 0); legR.position.set(0.14, 0.34, 0);
      group.add(body, head, armL, armR, legL, legR);
      Game.scene.add(group);
      return { id, group, state:null, target:null, lastSeen:performance.now(), body:{ x:0, y:0, z:0, w:0.3, h:1.8, dead:false }, swingSeq:undefined, swingT:0, swingHoldT:0, parts:{ body, head, eyeL, eyeR, armL, armR, legL, legR }, heldMesh:null, armorMeshes:[] };
    },

    updatePeers(dt) {
      const now = performance.now();
      const dim = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
      for (const [id, p] of [...this.peers.entries()]) {
        if (now - p.lastSeen > 15000) { this.removePeer(id); continue; }
        if (!p.target) continue;
        if (!p.state) p.state = Object.assign({}, p.target);
        const a = Math.min(1, 12 * dt);
        for (const k of ['x','y','z','yaw','pitch']) p.state[k] = (p.state[k] || 0) + ((+p.target[k] || 0) - (p.state[k] || 0)) * a;
        p.state.dead = !!p.target.dead; p.state.dim = p.target.dim;
        p.group.visible = !p.state.dead && p.state.dim === dim;
        const sneak = !!p.target.sneak;
        const crouch = sneak ? 0.22 : 0;
        p.group.position.set(p.state.x, p.state.y, p.state.z);
        p.group.rotation.y = p.state.yaw || 0;
        p.body.x = p.state.x; p.body.y = p.state.y; p.body.z = p.state.z; p.body.h = sneak ? 1.55 : (+p.target.h || 1.8); p.body.dead = !!p.state.dead;
        const moving = Math.abs(+p.target.vx || 0) + Math.abs(+p.target.vz || 0) > 0.3;
        const bob = moving ? Math.sin(now * 0.012) * 0.35 : 0;
        const remoteSwingSeq = Number.isFinite(+p.target.swing) ? +p.target.swing : 0;
        if (p.swingSeq === undefined) p.swingSeq = remoteSwingSeq;
        else if (remoteSwingSeq !== p.swingSeq) { p.swingSeq = remoteSwingSeq; p.swingT = 0.3; }
        if (p.swingT > 0) p.swingT = Math.max(0, p.swingT - dt);
        if (p.target.swinging || p.swingT > 0) p.swingHoldT = (p.swingHoldT || 0) + dt;
        else p.swingHoldT = 0;
        const impulseSwing = p.swingT > 0 ? Math.sin((1 - p.swingT / 0.3) * Math.PI) * 1.25 : 0;
        const heldSwing = p.target.swinging ? Math.sin((((p.swingHoldT || 0) / 0.24) % 1) * Math.PI) * 1.15 : 0;
        const actionSwing = Math.max(impulseSwing, heldSwing, 0);
        if (p.hitFlashT > 0) p.hitFlashT -= dt;
        if (p.parts) {
          const swim = !!p.target.swim;
          const board = !!p.target.board && !swim;
          const sit = !!p.target.sit && !board && !swim;
          const pitch = (p.state.pitch || 0) * 0.35;
          if (!board && p.boardMesh) p.boardMesh.visible = false; // hide the board when not riding
          if (swim) {
            // prone 1x1 swim/crawl: body flat face-down, arms reaching ahead, legs flutter-kick
            const kick = Math.sin(now * 0.02) * 0.55;
            p.parts.armL.rotation.z = 0; p.parts.armR.rotation.z = 0;
            p.parts.body.position.set(0, 1.02, 0); p.parts.body.rotation.x = 0;
            p.parts.head.position.set(0, 1.55, 0); p.parts.head.rotation.x = -0.7; // lift head to look ahead
            p.parts.armL.position.set(-0.30, 1.30, 0); p.parts.armR.position.set(0.30, 1.30, 0);
            p.parts.armL.rotation.x = Math.PI + kick * 0.4; p.parts.armR.rotation.x = Math.PI - kick * 0.4; // stretched overhead
            p.parts.legL.position.set(-0.14, 0.34, 0); p.parts.legR.position.set(0.14, 0.34, 0);
            p.parts.legL.rotation.x = kick; p.parts.legR.rotation.x = -kick;
            p.parts.legL.scale.y = 1; p.parts.legR.scale.y = 1;
            p.group.rotation.x = -Math.PI / 2; // lie horizontal, head pointing FORWARD (model faces -z)
          } else {
          // model faces -z: forward tilt = NEGATIVE rot.x on the torso; limbs reaching
          // FORWARD = POSITIVE rot.x (bottom of the limb swings toward -z).
          if (board) {
            // skateboarding: STAND with a slight forward crouch, knees bent, arms out to balance
            p.parts.body.position.set(0, 0.98, 0); p.parts.body.rotation.x = -0.18;
            p.parts.head.position.set(0, 1.5, 0);
            p.parts.armL.position.set(-0.42, 1.02, 0); p.parts.armR.position.set(0.42, 1.02, 0);
            p.parts.armL.rotation.z = -0.5; p.parts.armR.rotation.z = 0.5;     // arms out sideways for balance
            p.parts.armL.rotation.x = 0.2; p.parts.armR.rotation.x = 0.2;
            p.parts.legL.position.set(-0.16, 0.32, 0.02); p.parts.legR.position.set(0.16, 0.32, -0.06);
            p.parts.legL.rotation.x = 0.12; p.parts.legR.rotation.x = -0.12;   // slight stance stagger
            p.parts.legL.scale.y = 0.9; p.parts.legR.scale.y = 0.9;
            p.parts.head.rotation.x = pitch;
            p.group.rotation.x = 0;
            p.group.rotation.y = (p.state.yaw || 0) + Math.PI / 2; // stand SIDEWAYS on the board
            // give them a visible board so they're not "riding an invisible car"
            if (!p.boardMesh && typeof Vehicles !== 'undefined' && Vehicles.buildBoardMesh) {
              p.boardMesh = Vehicles.buildBoardMesh();
              p.group.add(p.boardMesh);
            }
            if (p.boardMesh) { p.boardMesh.visible = true; p.boardMesh.position.set(0, 0.05, 0); p.boardMesh.rotation.y = -Math.PI / 2; }
          } else if (sit) {
            // seated: upright hips, thighs out horizontal, hands forward on the wheel
            p.parts.armL.rotation.z = 0; p.parts.armR.rotation.z = 0;
            p.parts.body.position.set(0, 0.84, 0); p.parts.body.rotation.x = -0.06;
            p.parts.head.position.set(0, 1.36, 0);
            p.parts.armL.position.set(-0.39, 1.00, 0); p.parts.armR.position.set(0.39, 1.00, 0);
            p.parts.armL.rotation.x = 1.3; p.parts.armR.rotation.x = 1.3;      // reach forward
            p.parts.legL.position.set(-0.14, 0.54, -0.16); p.parts.legR.position.set(0.14, 0.54, -0.16);
            p.parts.legL.rotation.x = 1.55; p.parts.legR.rotation.x = 1.55;    // thighs horizontal, forward
            p.parts.legL.scale.y = 1; p.parts.legR.scale.y = 1;
            p.parts.head.rotation.x = pitch;
            p.group.rotation.x = 0;
          } else {
            // crouch: lower the torso/head and lean FORWARD like MC sneaking (negative rot.x)
            p.parts.armL.rotation.z = 0; p.parts.armR.rotation.z = 0;
            p.parts.body.position.set(0, 1.02 - crouch * 0.5, 0); p.parts.body.rotation.x = crouch ? -0.38 : 0;
            p.parts.head.position.set(0, 1.55 - crouch * 0.85, 0);
            p.parts.armL.position.set(-0.39, 1.02 - crouch * 0.5, 0); p.parts.armR.position.set(0.39, 1.02 - crouch * 0.5, 0);
            p.parts.armL.rotation.x = bob; p.parts.armR.rotation.x = -bob + actionSwing;
            p.parts.legL.position.set(-0.14, 0.34, 0); p.parts.legR.position.set(0.14, 0.34, 0);
            p.parts.legL.scale.y = sneak ? 0.82 : 1; p.parts.legR.scale.y = sneak ? 0.82 : 1;
            p.parts.legL.rotation.x = -bob; p.parts.legR.rotation.x = bob;
            // sneaking moves the head's POSITION to follow the leaned torso (down + forward),
            // but keeps the player's real look pitch — no extra tilt forced onto the head
            p.parts.head.position.set(0, 1.55 - crouch * 0.85, -crouch * 1.4);
            p.parts.head.rotation.x = pitch;
            p.group.rotation.x = 0;
          }
          }
        }
        this.updatePeerHeldAndArmor(p);
        this.tintPeer(p);
      }
      this.expireRemoteBreaks();
    },

    tintPeer(p) {
      if (!p || !p.group || typeof World === 'undefined') return;
      const flashing = p.hitFlashT > 0;
      const c = World.getLightColor(Math.floor(p.body.x), Math.floor(p.body.y + 1), Math.floor(p.body.z), undefined, 0.10);
      p.group.traverse(o => {
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const mat of mats) if (mat && mat.color) {
          if (!mat.userData.baseColor) mat.userData.baseColor = mat.color.clone();
          if (flashing) { if (p.hitFlashBlue) mat.color.setRGB(0.35, 0.6, 1); else mat.color.setRGB(1, 0.25, 0.25); }
          else { mat.color.copy(mat.userData.baseColor); mat.color.r *= c[0]; mat.color.g *= c[1]; mat.color.b *= c[2]; }
        }
      });
    },

    // flash a remote player on THIS screen: red for a real hit, blue "sheen" for an
    // invincible/creative target. Plays the matching sound at their position.
    flashPeer(pid, blue) {
      const p = this.peers && this.peers.get(pid);
      const pos = p && p.body ? [p.body.x, p.body.y + 1, p.body.z] : null;
      if (p) { p.hitFlashT = 0.28; p.hitFlashBlue = !!blue; }
      if (typeof SFX !== 'undefined') {
        if (blue) { if (SFX.shielded) SFX.shielded(pos); }
        else if (SFX.mobHurt) SFX.mobHurt(pos);
      }
    },

    // play another player's gunshot + draw its tracer on our screen
    applyRemoteGunfire(msg) {
      if (typeof Guns === 'undefined' || !msg) return;
      const cur = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
      if ((msg.dim || 'overworld') !== cur) return; // different dimension: don't render here
      const gun = msg.gun | 0;
      const from = { x:+msg.fx || 0, y:+msg.fy || 0, z:+msg.fz || 0 };
      const dir = { x:+msg.dx || 0, y:+msg.dy || 0, z:+msg.dz || 0 };
      if (typeof SFX !== 'undefined' && SFX.gunshot) SFX.gunshot(gun, from);
      const d = Guns.defs && Guns.defs[gun];
      if (!d || d.bow || d.rocket) return; // arrows/rockets are separate synced entities
      const range = d.range || 40;
      const bh = (typeof World !== 'undefined') ? World.raycast(from.x, from.y, from.z, dir.x, dir.y, dir.z, range) : null;
      const dist = bh ? bh.dist : range;
      const ex = from.x + dir.x * dist, ey = from.y + dir.y * dist, ez = from.z + dir.z * dist;
      if (Guns.tracer) Guns.tracer(from.x, from.y - 0.12, from.z, ex, ey, ez, d.color, !!d.laser);
    },

    // ---- shared block-breaking progress: everyone sees everyone's cracks, on EVERY
    // block they're actively cracking (multiple blocks + 3x3/multiblock at once) ----
    sendBreakSet(blocks) {
      if (!this.connected || this.role === 'solo') return;
      const arr = Array.isArray(blocks) ? blocks : [];
      const sig = arr.map(b => b[0] + ',' + b[1] + ',' + b[2] + ':' + b[3]).sort().join('|');
      const now = performance.now();
      // resend an unchanged non-empty set every 200ms to keep the receiver's overlays alive
      if (sig === this._breakSig && (sig === '' || now - (this._breakSentT || 0) < 200)) return;
      this._breakSig = sig; this._breakSentT = now;
      this.send({ type:'break_set', blocks:arr, dim:(typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld') });
    },
    applyBreakSet(pid, msg) {
      if (!pid || typeof Game === 'undefined' || !Game.scene) return;
      const dim = (msg && msg.dim) || 'overworld';
      const cur = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
      const blocks = (msg && Array.isArray(msg.blocks)) ? msg.blocks : [];
      if (dim !== cur || !blocks.length || !Player.crackTex || !Player.crackTex.length) { this.clearRemoteBreak(pid); return; }
      let rec = this.remoteBreaks.get(pid);
      if (!rec || !rec.meshes) { rec = { meshes:new Map(), lastT:0 }; this.remoteBreaks.set(pid, rec); }
      const seen = new Set();
      for (const b of blocks) {
        const bx = b[0] | 0, by = b[1] | 0, bz = b[2] | 0;
        const stage = Math.max(0, Math.min(Player.crackTex.length - 1, b[3] | 0));
        const bk = bx + ',' + by + ',' + bz;
        seen.add(bk);
        let mesh = rec.meshes.get(bk);
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.008, 1.008, 1.008),
            new THREE.MeshBasicMaterial({ transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1, side:THREE.DoubleSide })
          );
          mesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
          Game.scene.add(mesh);
          rec.meshes.set(bk, mesh);
        }
        const tex = Player.crackTex[stage];
        if (tex && mesh.material.map !== tex) { mesh.material.map = tex; mesh.material.needsUpdate = true; }
        mesh.visible = true;
      }
      // drop overlays for blocks that finished cracking / are no longer in the set
      for (const [bk, mesh] of [...rec.meshes]) if (!seen.has(bk)) { Game.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); rec.meshes.delete(bk); }
      rec.lastT = performance.now();
    },
    clearRemoteBreak(pid) {
      const rec = this.remoteBreaks.get(pid);
      if (!rec) return;
      if (rec.meshes) for (const mesh of rec.meshes.values()) { Game.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
      this.remoteBreaks.delete(pid);
    },
    expireRemoteBreaks() {
      const now = performance.now();
      for (const [pid, rec] of [...this.remoteBreaks]) if (now - (rec.lastT || 0) > 700) this.clearRemoteBreak(pid);
    },

    updatePeerHeldAndArmor(p) {
      const held = p.target && p.target.held ? p.target.held|0 : 0;
      if (p.heldId !== held) {
        if (p.heldMesh) { p.parts.armR.remove(p.heldMesh); p.heldMesh = null; }
        p.heldId = held;
        if (held && typeof Drops !== 'undefined') {
          p.heldMesh = Drops.makeMesh(held);
          p.heldMesh.scale.multiplyScalar(0.65);
          p.heldMesh.position.set(0, -0.36, -0.18);
          p.heldMesh.rotation.x = -0.7;
          p.parts.armR.add(p.heldMesh);
        }
      }
      const armor = (p.target && Array.isArray(p.target.armor)) ? p.target.armor : [];
      const sig = armor.map(s => s ? s.id : 0).join(',');
      if (p.armorSig === sig) return;
      for (const m of p.armorMeshes || []) {
        if (m.parent) m.parent.remove(m);
        if (m.geometry && m.userData && m.userData.disposeWithArmor) m.geometry.dispose();
      }
      p.armorMeshes = []; p.armorSig = sig;
      const addArmor = (parent, geom, pos, id, slot) => {
        if (!id || !Reg[id]) return;
        const mesh = new THREE.Mesh(geom, this.makePeerArmorMaterial(id, slot));
        mesh.position.copy(pos);
        mesh.renderOrder = 1;
        mesh.userData.disposeWithArmor = true;
        parent.add(mesh);
        p.armorMeshes.push(mesh);
      };
      const addPart = (parent, geom, pos, id, slot, rot) => {
        if (!id || !Reg[id]) return;
        const mesh = new THREE.Mesh(geom, this.makePeerArmorMaterial(id, slot));
        mesh.position.copy(pos);
        if (rot) mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
        mesh.renderOrder = 1;
        mesh.userData.disposeWithArmor = true;
        parent.add(mesh); p.armorMeshes.push(mesh);
      };
      const helmetId = armor[0] && armor[0].id, chestId = armor[1] && armor[1].id;
      const legsId = armor[2] && armor[2].id, bootsId = armor[3] && armor[3].id;
      const divingHelmet = helmetId === I.DIVING_HELMET, divingChest = chestId === I.DIVING_CHEST;
      const divingLegs = legsId === I.DIVING_LEGS, divingBoots = bootsId === I.DIVING_BOOTS;

      if (helmetId && !divingHelmet) addArmor(p.parts.head, new THREE.BoxGeometry(0.54,0.32,0.54), new THREE.Vector3(0,0.08,0), helmetId, 0);
      if (divingHelmet) {
        addPart(p.parts.head, new THREE.BoxGeometry(0.62,0.15,0.60), new THREE.Vector3(0,0.20,0), helmetId, 0);
        addPart(p.parts.head, new THREE.BoxGeometry(0.60,0.10,0.58), new THREE.Vector3(0,-0.10,0), helmetId, 0);
        addPart(p.parts.head, new THREE.BoxGeometry(0.11,0.25,0.20), new THREE.Vector3(-0.315,0.035,-0.055), helmetId, 0);
        addPart(p.parts.head, new THREE.BoxGeometry(0.11,0.25,0.20), new THREE.Vector3(0.315,0.035,-0.055), helmetId, 0);
        const visorMat = new THREE.MeshLambertMaterial({ color:0x7df5ec, transparent:true, opacity:0.50, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3 });
        visorMat.userData.baseColor = new THREE.Color(0x7df5ec);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.47,0.23,0.035), visorMat);
        visor.position.set(0,0.045,-0.325); visor.renderOrder = 2; visor.userData.disposeWithArmor = true;
        p.parts.head.add(visor); p.armorMeshes.push(visor);
        addPart(p.parts.head, new THREE.BoxGeometry(0.08,0.08,0.055), new THREE.Vector3(-0.245,0.17,-0.337), helmetId, 0);
        addPart(p.parts.head, new THREE.BoxGeometry(0.08,0.08,0.055), new THREE.Vector3(0.245,0.17,-0.337), helmetId, 0);
      }

      if (chestId && !divingChest) addArmor(p.parts.body, new THREE.BoxGeometry(0.64,0.84,0.36), new THREE.Vector3(0,0,0), chestId, 1);
      if (divingChest) {
        addPart(p.parts.body, new THREE.BoxGeometry(0.69,0.80,0.40), new THREE.Vector3(0,0,0), chestId, 1);
        addPart(p.parts.body, new THREE.BoxGeometry(0.62,0.11,0.44), new THREE.Vector3(0,0.32,0), chestId, 1);
        addPart(p.parts.body, new THREE.BoxGeometry(0.31,0.20,0.09), new THREE.Vector3(0,0.08,-0.235), chestId, 1);
        addPart(p.parts.body, new THREE.BoxGeometry(0.07,0.62,0.045), new THREE.Vector3(-0.22,-0.02,-0.235), chestId, 1);
        addPart(p.parts.body, new THREE.BoxGeometry(0.07,0.62,0.045), new THREE.Vector3(0.22,-0.02,-0.235), chestId, 1);
        addPart(p.parts.armL, new THREE.BoxGeometry(0.34,0.22,0.40), new THREE.Vector3(0,0.24,0), chestId, 1);
        addPart(p.parts.armR, new THREE.BoxGeometry(0.34,0.22,0.40), new THREE.Vector3(0,0.24,0), chestId, 1);
      }

      if (legsId && !divingLegs) {
        addArmor(p.parts.legL, new THREE.BoxGeometry(0.25,0.62,0.25), new THREE.Vector3(0,-0.02,0), legsId, 2);
        addArmor(p.parts.legR, new THREE.BoxGeometry(0.25,0.62,0.25), new THREE.Vector3(0,-0.02,0), legsId, 2);
      }
      if (divingLegs) for (const leg of [p.parts.legL, p.parts.legR]) {
        addPart(leg, new THREE.BoxGeometry(0.29,0.61,0.29), new THREE.Vector3(0,-0.02,0), legsId, 2);
        addPart(leg, new THREE.BoxGeometry(0.22,0.18,0.055), new THREE.Vector3(0,-0.10,-0.182), legsId, 2);
        addPart(leg, new THREE.BoxGeometry(0.08,0.42,0.04), new THREE.Vector3(0.12,0.02,-0.172), legsId, 2);
      }

      if (bootsId && !divingBoots) {
        addArmor(p.parts.legL, new THREE.BoxGeometry(0.28,0.24,0.28), new THREE.Vector3(0,-0.24,0), bootsId, 3);
        addArmor(p.parts.legR, new THREE.BoxGeometry(0.28,0.24,0.28), new THREE.Vector3(0,-0.24,0), bootsId, 3);
      }
      if (divingBoots) for (const leg of [p.parts.legL, p.parts.legR]) {
        addPart(leg, new THREE.BoxGeometry(0.32,0.27,0.38), new THREE.Vector3(0,-0.24,-0.045), bootsId, 3);
        addPart(leg, new THREE.BoxGeometry(0.34,0.07,0.40), new THREE.Vector3(0,-0.37,-0.05), bootsId, 3);
        addPart(leg, new THREE.BoxGeometry(0.24,0.08,0.06), new THREE.Vector3(0,-0.24,-0.272), bootsId, 3);
      }

      const tank = armor[4], tankDef = tank && Reg[tank.id];
      if (tankDef && tankDef.oxygenTank) {
        const large = tank.id === I.OXYGEN_TANK_5M;
        const tankMat = this.makePeerArmorMaterial(tank.id, 4);
        const addTankPart = (geom, x, y, z) => {
          const mesh = new THREE.Mesh(geom, tankMat); mesh.position.set(x,y,z); mesh.userData.disposeWithArmor = true;
          p.parts.body.add(mesh); p.armorMeshes.push(mesh);
        };
        if (large) {
          addTankPart(new THREE.CylinderGeometry(0.13,0.13,0.68,8), -0.15,0,0.27);
          addTankPart(new THREE.CylinderGeometry(0.13,0.13,0.68,8), 0.15,0,0.27);
        } else addTankPart(new THREE.CylinderGeometry(0.15,0.15,0.62,8), 0,0,0.27);
        addTankPart(new THREE.BoxGeometry(large ? 0.42 : 0.28,0.08,0.08), 0,0.24,0.27);
        addTankPart(new THREE.BoxGeometry(0.055,0.42,0.055), 0.24,0.08,0.23);
      }
    },

    peerArmorColorInfo(id) {
      const nm = Reg[id] && Reg[id].name ? Reg[id].name.toLowerCase() : '';
      // Match the real gearset colors used by the item icons, including Patapim purple.
      if (nm.includes('diving') || nm.includes('oxygen tank')) return { main:'#dfe6e9', dark:'#41545e', hi:'#7df5ec', accent:'#ff9d2e', diving:true };
      if (nm.includes('patapim') && nm.includes('diamond') && nm.includes('jelly')) return { main:'#6ee8ff', dark:'#7a3fd0', hi:'#f8fff9', jelly:true };
      if (nm.includes('patapim')) return { main:'#b06cff', dark:'#7a3fd0', hi:'#ff7dfb' };
      if (nm.includes('emerald')) return { main:'#2ecc71', dark:'#168f48', hi:'#8ff0b4' };
      if (nm.includes('diamond')) return { main:'#58e0d8', dark:'#2fa8a0', hi:'#9ff5ef' };
      if (nm.includes('iron')) return { main:'#d8d8d8', dark:'#9a9a9a', hi:'#ffffff' };
      return { main:'#b8c0cc', dark:'#7b8490', hi:'#eef3ff' };
    },

    makePeerArmorTexture(id, slot) {
      if (!this.peerArmorTexCache) this.peerArmorTexCache = {};
      const key = String(id) + ':' + String(slot);
      if (this.peerArmorTexCache[key]) return this.peerArmorTexCache[key];
      const col = this.peerArmorColorInfo(id);
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.fillStyle = col.main; c.fillRect(0, 0, 16, 16);
      c.fillStyle = col.dark;
      c.fillRect(0, 0, 16, 1); c.fillRect(0, 15, 16, 1); c.fillRect(0, 0, 1, 16); c.fillRect(15, 0, 1, 16);
      c.fillStyle = col.hi;
      c.fillRect(2, 2, 7, 2); c.fillRect(2, 4, 2, 6);
      c.fillStyle = col.dark;
      if (slot === 0) { // helmet rim / visor edge
        c.fillRect(1, 10, 14, 2); c.fillRect(3, 12, 3, 1); c.fillRect(10, 12, 3, 1);
      } else if (slot === 1) { // chest plate seams
        c.fillRect(7, 1, 2, 14); c.fillRect(2, 5, 12, 1); c.fillRect(3, 12, 10, 1);
        c.fillStyle = col.hi; c.fillRect(4, 3, 3, 2); c.fillRect(9, 3, 3, 2);
      } else if (slot === 2) { // leggings split
        c.fillRect(7, 0, 2, 16); c.fillRect(2, 11, 4, 1); c.fillRect(10, 11, 4, 1);
      } else { // boots toe / sole
        c.fillRect(1, 10, 14, 3); c.fillRect(0, 13, 16, 2);
        c.fillStyle = col.hi; c.fillRect(3, 3, 4, 2); c.fillRect(9, 3, 4, 2);
      }
      // Add subtle pixel specks so the remote armor reads like the same voxel gear instead of a flat overlay.
      const specks = slot === 1 ? [[12,8],[5,9],[10,14],[3,6]] : [[12,4],[4,7],[11,11]];
      c.fillStyle = col.hi;
      for (const [x,y] of specks) c.fillRect(x, y, 1, 1);
      if (col.diving) {
        // Fully repaint each diving piece (over the generic base) so it reads as
        // proper brass-and-steel deep-sea gear, not a muddy overlay.
        const steel = '#c9d2d6', steelD = '#7d8a90', steelHi = '#eef4f6';
        const rubber = '#37474d', rubberD = '#222d31', rubberHi = '#556d75';
        const brass = '#d8b24a', brassD = '#8a6c1f', glass = '#8fe8ff', glassHi = '#e8ffff', warn = '#ff9d2e';
        const R = (x, y, w, h, cc) => { c.fillStyle = cc; c.fillRect(x, y, w, h); };
        if (slot === 0) { // brass-rimmed steel dive helmet with porthole
          R(0, 0, 16, 16, steel);
          R(0, 0, 16, 2, steelHi); R(0, 14, 16, 2, steelD); R(0, 0, 2, 16, steelHi); R(14, 0, 2, 16, steelD);
          R(3, 3, 10, 10, brassD); R(4, 4, 8, 8, glass); R(4, 4, 4, 3, glassHi); // porthole + glint
          R(3, 3, 10, 1, brass); R(3, 12, 10, 1, brass); R(3, 3, 1, 10, brass); R(12, 3, 1, 10, brass);
          for (const [bx, by] of [[2, 2], [13, 2], [2, 13], [13, 13]]) R(bx, by, 1, 1, brass); // rim bolts
          R(1, 7, 1, 2, warn); // air-valve nub
        } else if (slot === 1) { // ribbed rubber suit with control box + straps
          R(0, 0, 16, 16, rubber);
          for (let yy = 2; yy < 15; yy += 3) R(1, yy, 14, 1, rubberD); // ribs
          R(1, 1, 14, 1, rubberHi);
          R(5, 5, 6, 5, steelD); R(6, 6, 4, 3, glass); R(6, 6, 2, 1, glassHi); // chest gauge box
          R(2, 0, 2, 16, rubberD); R(12, 0, 2, 16, rubberD); // shoulder straps
          R(2, 7, 2, 2, brass); R(12, 7, 2, 2, brass); // buckles
          R(7, 11, 2, 3, warn); // hose port
        } else if (slot === 2) { // ribbed leggings with steel knee pads
          R(0, 0, 16, 16, rubber);
          R(7, 0, 2, 16, rubberD);
          for (let yy = 2; yy < 15; yy += 3) { R(1, yy, 5, 1, rubberD); R(10, yy, 5, 1, rubberD); }
          R(2, 6, 4, 3, steelD); R(10, 6, 4, 3, steelD); R(2, 6, 4, 1, steelHi); R(10, 6, 4, 1, steelHi);
        } else if (slot === 3) { // heavy rubber boots with metal soles
          R(0, 0, 16, 16, rubber);
          R(2, 3, 5, 2, rubberHi); R(9, 3, 5, 2, rubberHi); // cuffs
          R(0, 10, 16, 6, steelD); R(0, 14, 16, 2, rubberD); // metal sole
          for (const bx of [1, 5, 9, 13]) R(bx, 12, 2, 1, steel); // treads
        } else if (slot === 4) { // scuba tank wrap: bands, valve base, gauge
          R(0, 0, 16, 16, steel);
          R(0, 0, 16, 3, steelHi); R(0, 13, 16, 3, steelD);
          R(3, 0, 2, 16, steelD); R(11, 0, 2, 16, steelHi); // cylinder shading
          R(0, 5, 16, 2, warn); R(0, 9, 16, 1, brassD); // warning stripe + band
          R(6, 0, 4, 3, brass); // valve base
          R(3, 10, 4, 3, glass); R(3, 10, 4, 1, glassHi); // pressure gauge
        }
      }
      if (col.jelly) {
        const jelly = ['#ff7fd4', '#6ee8ff', '#9cff6e', '#c77dff', '#ff9d4a', '#ffe86e'];
        const blobs = slot === 0
          ? [[3,3],[6,2],[9,3],[12,4],[4,8],[11,8]]
          : slot === 1
            ? [[3,3],[11,3],[5,7],[10,8],[4,12],[12,12]]
            : slot === 2
              ? [[4,2],[11,2],[4,7],[11,7],[4,12],[11,12]]
              : [[4,5],[11,5],[4,9],[11,9],[3,12],[12,12]];
        c.fillStyle = '#7a3fd0';
        if (slot === 0) c.fillRect(1, 1, 14, 2);
        else if (slot === 1) { c.fillRect(1, 1, 14, 2); c.fillRect(1, 14, 14, 1); }
        else if (slot === 2) { c.fillRect(1, 1, 14, 1); c.fillRect(7, 0, 2, 16); }
        else c.fillRect(0, 13, 16, 2);
        for (let i = 0; i < blobs.length; i++) {
          const [x,y] = blobs[i];
          c.fillStyle = jelly[i % jelly.length];
          c.fillRect(x, y, 2, 2);
          c.fillStyle = 'rgba(255,255,255,0.65)';
          c.fillRect(x, y, 1, 1);
        }
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      this.peerArmorTexCache[key] = tex;
      return tex;
    },

    makePeerArmorMaterial(id, slot) {
      if (!this.peerArmorMatCache) this.peerArmorMatCache = {};
      const key = String(id) + ':' + String(slot);
      if (this.peerArmorMatCache[key]) return this.peerArmorMatCache[key];
      const mat = new THREE.MeshLambertMaterial({
        map: this.makePeerArmorTexture(id, slot),
        color: 0xffffff,
        transparent: false,
        opacity: 1,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      mat.userData.baseColor = new THREE.Color(0xffffff);
      this.peerArmorMatCache[key] = mat;
      return mat;
    },
  });
})();

// Extra coverage for containers, spawn eggs, and vehicle placement requests.
(function installFloopFeatureRequestPatch(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__featureRequestPatchInstalled) return;
  Multiplayer.__featureRequestPatchInstalled = true;

  const oldInstall = Multiplayer.installFullSyncHooks;
  Multiplayer.installFullSyncHooks = function(){
    oldInstall.call(this);
    if (this.__featureRequestHooksReady) return;
    this.__featureRequestHooksReady = true;

    // Guest spawn eggs become host mob-spawn requests instead of local-only mobs.
    if (typeof Mobs !== 'undefined' && Mobs.spawn && !Mobs.__mpSpawnRequestPatch) {
      Mobs.__mpSpawnRequestPatch = true;
      const currentSpawn = Mobs.spawn.bind(Mobs);
      Mobs.spawn = function(type, x, y, z, gunId, color) {
        if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) {
          Multiplayer.send({ type:'mob_spawn_request', mobType:type, x:+x, y:+y, z:+z, gunId:gunId || null, color:color || null });
          return null;
        }
        return currentSpawn(type, x, y, z, gunId, color);
      };
    }

    // Guest placed vehicles become host vehicle-spawn requests. Local meshes are not spawned.
    if (typeof Vehicles !== 'undefined' && !Vehicles.__mpPlaceRequestPatch) {
      Vehicles.__mpPlaceRequestPatch = true;
      for (const name of ['placeCar','placeSuperCar','placePlane','placeBoat','placeBoard']) {
        if (!Vehicles[name]) continue;
        const old = Vehicles[name].bind(Vehicles);
        Vehicles[name] = function(x, y, z, yaw, obsidian) {
          if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) {
            Multiplayer.send({ type:'vehicle_spawn_request', vehicleKind:name, x:+x, y:+y, z:+z, yaw:+yaw || 0, obsidian:!!obsidian });
            return null;
          }
          return old(x, y, z, yaw, obsidian);
        };
      }
    }
  };

  const oldHandler = Multiplayer.handleFullSyncMessage;
  Multiplayer.handleFullSyncMessage = function(msg, fromId, cameFromClient){
    if (!msg || !msg.type) return false;
    if (msg.type === 'mob_spawn_request') {
      if (this.role === 'host' && cameFromClient && msg.mobType) Mobs.spawn(String(msg.mobType), +msg.x, +msg.y, +msg.z, msg.gunId || null, msg.color || null);
      return true;
    }
    if (msg.type === 'vehicle_spawn_request') {
      if (this.role === 'host' && cameFromClient && typeof Vehicles !== 'undefined') {
        const k = String(msg.vehicleKind || '');
        if (k === 'placeSuperCar') Vehicles.placeSuperCar(+msg.x, +msg.y, +msg.z, +msg.yaw || 0);
        else if (k === 'placePlane') Vehicles.placePlane(+msg.x, +msg.y, +msg.z, +msg.yaw || 0);
        else if (k === 'placeBoat') Vehicles.placeBoat(+msg.x, +msg.y, +msg.z, +msg.yaw || 0, !!msg.obsidian);
        else if (k === 'placeBoard') Vehicles.placeBoard(+msg.x, +msg.y, +msg.z, +msg.yaw || 0);
        else Vehicles.placeCar(+msg.x, +msg.y, +msg.z, +msg.yaw || 0);
      }
      return true;
    }
    if (msg.type === 'client_storage_state') {
      if (this.role === 'host' && cameFromClient) this.hostApplyClientStorage(msg);
      return true;
    }
    return oldHandler.call(this, msg, fromId, cameFromClient);
  };

  const oldFullSyncUpdate = Multiplayer.fullSyncUpdate;
  Multiplayer.fullSyncUpdate = function(dt){
    oldFullSyncUpdate.call(this, dt);
    if (this.role === 'client' && this.connected && typeof UI !== 'undefined' && typeof World !== 'undefined') {
      const now = performance.now();
      if (now - (this.lastClientStorageSend || 0) > 350) {
        const msg = this.makeClientStorageState();
        if (msg) { this.lastClientStorageSend = now; this.send(msg); }
      }
    }
  };

  Multiplayer.makeClientStorageState = function(){
    if (typeof UI === 'undefined' || typeof World === 'undefined') return null;
    const pack = (s) => (typeof Save !== 'undefined' && Save.packStack) ? Save.packStack(s) : (s ? { id:s.id, count:s.count, dur:s.dur } : null);
    const msg = { type:'client_storage_state' };
    let any = false;
    if (UI.screen === 'chest' && UI.chestHit) {
      const key = World.pkey(UI.chestHit.bx, UI.chestHit.by, UI.chestHit.bz);
      const slots = World.chests.get(key);
      if (slots) { msg.chest = { key, slots:slots.map(pack) }; any = true; }
    }
    if (UI.screen === 'furnace' && UI.furnaceKey) {
      const f = World.furnaces.get(UI.furnaceKey);
      if (f) { msg.furnace = { key:UI.furnaceKey, f:{ i:pack(f.in), f:pack(f.fuel), o:pack(f.out), burn:f.burn || 0, burnMax:f.burnMax || 0, cook:f.cook || 0 } }; any = true; }
    }
    return any ? msg : null;
  };

  Multiplayer.hostApplyClientStorage = function(msg){
    const unpack = (s) => (typeof Save !== 'undefined' && Save.unpackStack) ? Save.unpackStack(s) : (s ? { id:s.id, count:s.count, dur:s.dur } : null);
    if (msg.chest && msg.chest.key && Array.isArray(msg.chest.slots)) {
      World.chests.set(String(msg.chest.key), msg.chest.slots.map(unpack));
      const p = String(msg.chest.key).split(',').map(Number); if (p.length >= 3) World.dirty.add(World.chunkKeyForBlock ? World.chunkKeyForBlock(p[0], p[2]) : World.key(Math.floor(p[0] / 16), Math.floor(p[2] / 16)));
    }
    if (msg.furnace && msg.furnace.key && msg.furnace.f) {
      const f = msg.furnace.f;
      World.furnaces.set(String(msg.furnace.key), { in:unpack(f.i), fuel:unpack(f.f), out:unpack(f.o), burn:f.burn || 0, burnMax:f.burnMax || 0, cook:f.cook || 0 });
      const p = String(msg.furnace.key).split(',').map(Number); if (p.length >= 3) World.dirty.add(World.chunkKeyForBlock ? World.chunkKeyForBlock(p[0], p[2]) : World.key(Math.floor(p[0] / 16), Math.floor(p[2] / 16)));
    }
  };
})();

// ============================================================
// Vehicle authority + smooth remote entity animation patch.
// Fixes client vehicle control, vehicle orientation snapping, and stiff mob/drop visuals.
// ============================================================
(function installFloopVehicleAuthorityAndAnimationPatch(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__vehicleAuthorityAnimPatchInstalled) return;
  Multiplayer.__vehicleAuthorityAnimPatchInstalled = true;

  const MP = Multiplayer;
  const shortAngle = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  const lerpAngle = (a, b, t) => a + shortAngle(b - a) * t;
  const finite = (v, fallback) => Number.isFinite(+v) ? +v : fallback;

  Object.assign(MP, {
    vehicleSeq: 1,
    vehicleInputs: new Map(),
    clientMountedVehicleId: null,
    clientMountPending: null,
    lastVehicleInputSend: 0,

    ensureVehicleId(v) {
      if (!v) return '';
      if (!v.mpId) v.mpId = 'v' + (this.vehicleSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
      return v.mpId;
    },

    allVehicles() {
      if (typeof Vehicles === 'undefined') return [];
      return [...(Vehicles.cars || []), ...(Vehicles.boats || []), ...(Vehicles.boards || [])];
    },

    findVehicleById(vid) {
      vid = String(vid || '');
      if (!vid || typeof Vehicles === 'undefined') return null;
      return this.allVehicles().find(v => v && v.mpId === vid) || null;
    },

    vehicleKind(v) {
      if (!v) return 'car';
      if (v.kind === 'plane') return 'plane';
      if (v.kind === 'supercar') return 'supercar';
      if (v.kind === 'boat') return v.lavaBoat ? 'obsidian_boat' : 'boat';
      if (v.kind === 'board') return 'board';
      return 'car';
    },

    serializeVehicleObject(v) {
      if (!v) return null;
      const body = v.body || v;
      this.ensureVehicleId(v);
      return {
        vid: v.mpId,
        kind: this.vehicleKind(v),
        item: v.item || 0,
        x: +finite(body.x, 0).toFixed(3), y: +finite(body.y, 0).toFixed(3), z: +finite(body.z, 0).toFixed(3),
        vx: +finite(body.vx, 0).toFixed(3), vy: +finite(body.vy, 0).toFixed(3), vz: +finite(body.vz, 0).toFixed(3),
        yaw: +finite(v.yaw, 0).toFixed(4),
        speed: +finite(v.speed, 0).toFixed(3),
        hp: finite(v.hp, 1),
        lavaBoat: !!v.lavaBoat,
        rider: v.mpRider || '',
        wheelSpin: +finite(v.wheelSpin, 0).toFixed(3),
        flash: +finite(v.flashT, 0).toFixed(2),
      };
    },

    serializeVehiclesLiveByKind() {
      if (typeof Vehicles === 'undefined') return { cars:[], boats:[], boards:[] };
      return {
        cars: (Vehicles.cars || []).map(v => this.serializeVehicleObject(v)).filter(Boolean),
        boats: (Vehicles.boats || []).map(v => this.serializeVehicleObject(v)).filter(Boolean),
        boards: (Vehicles.boards || []).map(v => this.serializeVehicleObject(v)).filter(Boolean),
      };
    },

    vehicleFromState(s) {
      if (!s || !s.vid || typeof Vehicles === 'undefined') return null;
      let v = this.findVehicleById(s.vid);
      if (v) return v;
      this.applyingRemoteState = true;
      try {
        const yaw = finite(s.yaw, 0);
        if (s.kind === 'plane' || s.item === (typeof I !== 'undefined' ? I.PLANE : -1)) v = Vehicles.placePlane(finite(s.x, 0), finite(s.y, 0), finite(s.z, 0), yaw);
        else if (s.kind === 'supercar' || s.item === (typeof I !== 'undefined' ? I.SUPER_CAR : -1)) v = Vehicles.placeSuperCar(finite(s.x, 0), finite(s.y, 0), finite(s.z, 0), yaw);
        else if (s.kind === 'boat' || s.kind === 'obsidian_boat' || s.item === (typeof I !== 'undefined' ? I.BOAT : -1) || s.item === (typeof I !== 'undefined' ? I.OBSIDIAN_BOAT : -1)) v = Vehicles.placeBoat(finite(s.x, 0), finite(s.y, 0), finite(s.z, 0), yaw, !!(s.lavaBoat || s.kind === 'obsidian_boat' || s.item === (typeof I !== 'undefined' ? I.OBSIDIAN_BOAT : -1)));
        else if (s.kind === 'board' || s.item === (typeof I !== 'undefined' ? I.SKATEBOARD : -1)) v = Vehicles.placeBoard(finite(s.x, 0), finite(s.y, 0), finite(s.z, 0), yaw);
        else v = Vehicles.placeCar(finite(s.x, 0), finite(s.y, 0), finite(s.z, 0), yaw);
      } finally { this.applyingRemoteState = false; }
      if (v) v.mpId = s.vid;
      return v;
    },

    applyVehiclesLive(msg) {
      if (typeof Vehicles === 'undefined') return;
      const states = [...(msg.cars || []), ...(msg.boats || []), ...(msg.boards || [])].filter(s => s && s.vid);
      const keep = new Set();
      let selfMounted = null;
      for (const s of states) {
        keep.add(s.vid);
        const v = this.vehicleFromState(s);
        if (!v) continue;
        v.mpId = s.vid;
        v.mpTarget = Object.assign({}, s);
        v.mpRider = s.rider || '';
        v.hp = finite(s.hp, v.hp || 1);
        v.item = s.item || v.item;
        v.flashT = Math.max(v.flashT || 0, finite(s.flash, 0));
        if (s.rider === this.id) selfMounted = v;
        const body = v.body || v;
        if (!v.__mpHadState || Math.hypot(body.x - finite(s.x, body.x), body.y - finite(s.y, body.y), body.z - finite(s.z, body.z)) > 8) {
          body.x = finite(s.x, body.x); body.y = finite(s.y, body.y); body.z = finite(s.z, body.z);
          body.vx = finite(s.vx, body.vx || 0); body.vy = finite(s.vy, body.vy || 0); body.vz = finite(s.vz, body.vz || 0);
          v.yaw = finite(s.yaw, v.yaw || 0); v.speed = finite(s.speed, v.speed || 0); v.wheelSpin = finite(s.wheelSpin, v.wheelSpin || 0);
          this.positionVehicleMesh(v);
          v.__mpHadState = true;
        }
      }
      for (const v of [...(Vehicles.cars || []), ...(Vehicles.boats || []), ...(Vehicles.boards || [])]) {
        if (v && v.mpId && !keep.has(v.mpId)) {
          this.applyingRemoteState = true;
          try { Vehicles.remove(v); } finally { this.applyingRemoteState = false; }
        }
      }
      if (this.role === 'client') this.syncClientMount(selfMounted);
    },

    syncClientMount(v) {
      if (!v) {
        if (this.clientMountedVehicleId && !this.clientMountPending) {
          Vehicles.driving = null; Vehicles.boating = null; Player.boarding = false;
          this.clientMountedVehicleId = null;
          if (typeof UI !== 'undefined') UI.setVehicleHud && UI.setVehicleHud(null);
        }
        return;
      }
      this.clientMountedVehicleId = v.mpId;
      this.clientMountPending = null;
      if (v.kind === 'boat') { Vehicles.boating = v; Vehicles.driving = null; Player.boarding = false; }
      else if (v.kind === 'board') { Vehicles.driving = null; Vehicles.boating = null; Player.boarding = true; }
      else { Vehicles.driving = v; Vehicles.boating = null; Player.boarding = false; }
    },

    positionVehicleMesh(v) {
      if (!v) return;
      const body = v.body || v;
      if (v.group) { v.group.position.set(body.x, body.y, body.z); v.group.rotation.y = finite(v.yaw, 0); }
      if (v.mesh) { v.mesh.position.set(body.x, body.y, body.z); v.mesh.rotation.y = finite(v.yaw, 0); }
      if (v.wheels) for (const w of v.wheels) w.rotation.x = v.wheelSpin || 0;
      if (v.propellers) for (const p of v.propellers) p.rotation.z = v.propSpin || v.wheelSpin || 0;
    },

    clientVehicleVisualTick(dt) {
      if (typeof Vehicles === 'undefined') return;
      const a = Math.min(1, 14 * (dt || 0));
      for (const v of this.allVehicles()) {
        const t = v && v.mpTarget;
        if (!v || !t) continue;
        const body = v.body || v;
        body.x += (finite(t.x, body.x) - body.x) * a;
        body.y += (finite(t.y, body.y) - body.y) * a;
        body.z += (finite(t.z, body.z) - body.z) * a;
        body.vx = finite(t.vx, body.vx || 0); body.vy = finite(t.vy, body.vy || 0); body.vz = finite(t.vz, body.vz || 0);
        v.yaw = lerpAngle(finite(v.yaw, 0), finite(t.yaw, v.yaw || 0), a);
        v.speed = finite(t.speed, v.speed || 0);
        v.wheelSpin = finite(t.wheelSpin, v.wheelSpin || 0) || ((v.wheelSpin || 0) + (v.speed || 0) * (dt || 0) * 3);
        this.positionVehicleMesh(v);
        if (Vehicles.applyFlash) Vehicles.applyFlash(v, dt || 0);
        if (Vehicles.tintVehicle) Vehicles.tintVehicle(v, dt || 0);
      }
      const riding = this.clientMountedVehicleId ? this.findVehicleById(this.clientMountedVehicleId) : null;
      if (riding) {
        const b = riding.body || riding;
        Player.body.x = b.x;
        Player.body.y = b.y + (Vehicles.riderYOffset ? Vehicles.riderYOffset(riding) : (riding.kind === 'boat' ? 0.25 : riding.kind === 'board' ? 0.08 : 0.35));
        Player.body.z = b.z;
        Player.body.vx = Player.body.vy = Player.body.vz = 0;
        Player.fallDist = 0;
        if (riding.kind === 'boat') { Vehicles.boating = riding; Vehicles.driving = null; Player.boarding = false; }
        else if (riding.kind === 'board') { Vehicles.driving = null; Vehicles.boating = null; Player.boarding = true; }
        else { Vehicles.driving = riding; Vehicles.boating = null; Player.boarding = false; }
      }
      const active = riding;
      if (typeof UI !== 'undefined' && UI.setVehicleHud) UI.setVehicleHud(active ? (Vehicles.vehicleHudLabel ? Vehicles.vehicleHudLabel(active) : Math.max(0, Math.ceil(active.hp || 0)) + ' HP') : null);
    },

    makeVehicleInputMessage() {
      const keys = Player.keys || {};
      const v = (Vehicles.driving || Vehicles.boating) || (Player.boarding ? this.findVehicleById(this.clientMountedVehicleId) : null);
      if (!v || !v.mpId) return null;
      return {
        type:'vehicle_input', vid:v.mpId,
        keys:{ KeyW:!!keys.KeyW, KeyS:!!keys.KeyS, KeyA:!!keys.KeyA, KeyD:!!keys.KeyD, Space:!!keys.Space, ShiftLeft:!!keys.ShiftLeft, ShiftRight:!!keys.ShiftRight },
        yaw: finite(Player.yaw, 0), pitch: finite(Player.pitch, 0), t: performance.now()
      };
    },

    clientSendVehicleInput(dt) {
      if (this.role !== 'client' || !this.connected) return;
      const now = performance.now();
      if (now - (this.lastVehicleInputSend || 0) < 45) return;
      const msg = this.makeVehicleInputMessage();
      if (!msg) return;
      this.lastVehicleInputSend = now;
      this.send(msg);
    },

    hostHandleVehicleMount(pid, msg) {
      if (!pid || !msg || !msg.vid) return;
      const v = this.findVehicleById(msg.vid);
      if (!v || (v.mpRider && v.mpRider !== pid)) return;
      // A player can only occupy one shared vehicle at a time.
      for (const other of this.allVehicles()) if (other && other.mpRider === pid) other.mpRider = '';
      v.mpRider = pid;
      this.vehicleInputs.set(pid, { keys:{}, t:performance.now(), vid:v.mpId });
      // Boards are ridden client-side (the rider IS the position). Remove the placed board
      // entity so it doesn't linger as a duplicate; re-placed on dismount at the exit spot.
      if (v.kind === 'board') {
        if (!this.boardRiders) this.boardRiders = new Set();
        this.boardRiders.add(pid);
        if (Vehicles.remove) Vehicles.remove(v);
      }
    },

    hostHandleVehicleDismount(pid, msg) {
      if (!pid) return;
      // Board rider dismounting: their position is already correct locally (no teleport);
      // just drop a fresh board where they are so it can be picked up again.
      if (this.boardRiders && this.boardRiders.has(pid)) {
        this.boardRiders.delete(pid);
        this.vehicleInputs.delete(pid);
        const peer = this.peers && this.peers.get(pid);
        const st = peer && (peer.target || peer.state);
        if (st && Vehicles.placeBoard) {
          const b = Vehicles.placeBoard(finite(st.x, 0), finite(st.y, 0), finite(st.z, 0), finite(st.yaw, 0));
          if (b && this.ensureVehicleId) this.ensureVehicleId(b);
        }
        return;
      }
      const v = msg && msg.vid ? this.findVehicleById(msg.vid) : this.allVehicles().find(x => x && x.mpRider === pid);
      if (!v || v.mpRider !== pid) return;
      v.mpRider = '';
      this.vehicleInputs.delete(pid);
      const conn = this.connections && this.connections.get(pid);
      const spot = Vehicles.findSafeExitSpot ? Vehicles.findSafeExitSpot(v) : null;
      if (conn) this.sendTo(conn, { type:'vehicle_exit_position', x: spot ? spot.x : ((v.body || v).x + Math.cos(v.yaw || 0) * 1.6), y: spot ? spot.y : ((v.body || v).y + 0.2), z: spot ? spot.z : ((v.body || v).z - Math.sin(v.yaw || 0) * 1.6) });
    },

    hostApplyVehicleInput(pid, msg) {
      if (!pid || !msg || !msg.vid) return;
      const v = this.findVehicleById(msg.vid);
      if (!v || v.mpRider !== pid) return;
      this.vehicleInputs.set(pid, { keys:msg.keys || {}, yaw:finite(msg.yaw, 0), pitch:finite(msg.pitch, 0), t:performance.now(), vid:v.mpId });
    },

    hostHandleVehicleHurt(pid, msg) {
      const v = msg && msg.vid ? this.findVehicleById(msg.vid) : null;
      if (!v || typeof Vehicles === 'undefined' || !Vehicles.hurt) return;
      Vehicles.hurt(v, Math.max(0, finite(msg.dmg, 1)), pid || 'player');
    },

    clientApplyVehicleExit(msg) {
      Vehicles.driving = null; Vehicles.boating = null; Player.boarding = false;
      this.clientMountedVehicleId = null; this.clientMountPending = null;
      if (msg && Number.isFinite(+msg.x)) {
        Player.body.x = +msg.x; Player.body.y = finite(msg.y, Player.body.y); Player.body.z = finite(msg.z, Player.body.z);
        Player.body.vx = Player.body.vy = Player.body.vz = 0;
        Player.fallDist = 0;
      }
      if (typeof UI !== 'undefined' && UI.setVehicleHud) UI.setVehicleHud(null);
    },

    hostSyncLocalVehicleRider() {
      if (this.role !== 'host') return;
      for (const v of this.allVehicles()) {
        if (!v) continue;
        if ((Vehicles.driving === v || Vehicles.boating === v || (Player.boarding && this.clientMountedVehicleId === v.mpId)) && !v.mpRider) v.mpRider = this.id;
        if (v.mpRider === this.id && !(Vehicles.driving === v || Vehicles.boating === v)) v.mpRider = '';
      }
    },
  });

  // Replace live host state serialization so vehicles carry ids, rider, speed, and exact yaw.
  MP.makeHostLiveState = function(){
    const veh = this.serializeVehiclesLiveByKind();
    return {
      type:'host_state', id:this.id, time:Game.time, dayCount:Game.dayCount,
      humbugAnnounced:Game.humbugAnnounced, stocks:Game.stocks,
      dynamics: (typeof Dynamics !== 'undefined' && Dynamics.serialize ? Dynamics.serialize() : null),
      mobs:this.serializeMobsLive(), drops:this.serializeDropsLive(), arrows:this.serializeArrowsLive(), rockets:this.serializeRocketsLive(),
      cars:veh.cars, boards:veh.boards, boats:veh.boats, vehiclesV2:true,
    };
  };

  // Do not clear/recreate vehicles every half-second on clients; update them in place and interpolate.
  MP.applyHostLiveState = function(msg){
    this.applyingRemoteState = true;
    try {
      this.applyHostTime(msg);
      if (msg.dynamics && typeof Dynamics !== 'undefined' && Dynamics.deserialize) Dynamics.deserialize(msg.dynamics);
      this.applyMobsLive(msg.mobs || []);
      this.applyDropsLive(msg.drops || []);
      this.applyArrowsLive(msg.arrows || []);
      this.applyRocketsLive(msg.rockets || []);
      this.applyVehiclesLive(msg || {});
    } finally { this.applyingRemoteState = false; }
  };

  // Store mob targets and animate toward them on clients instead of teleporting models packet-to-packet.
  MP.serializeMobsLive = function(){
    if (typeof Mobs === 'undefined') return [];
    return Mobs.list.filter(m => m && !m.dead).map(m => {
      if (!m.mpId) m.mpId = 'm' + (this.mobSeq++).toString(36) + '_' + Math.random().toString(36).slice(2, 5);
      const b = m.body;
      return { mid:m.mpId, t:m.type, x:+b.x.toFixed(3), y:+b.y.toFixed(3), z:+b.z.toFixed(3), vx:+(b.vx||0).toFixed(3), vy:+(b.vy||0).toFixed(3), vz:+(b.vz||0).toFixed(3), h:b.h, w:b.w, hp:m.hp, g:m.gunId || 0, c:m.color || 0, yaw:+(m.yaw||0).toFixed(4), targetYaw:+(m.targetYaw||m.yaw||0).toFixed(4), flash:m.flash || 0, fuse:m.fuse || 0, atk:m.attackSwingT || 0, walk:+(m.walkAnim || 0).toFixed(3), jid:m.jellyId || '', hid:m.homeHouseId || '', mem:m.membership || '' };
    });
  };

  MP.applyMobsLive = function(list){
    if (typeof Mobs === 'undefined') return;
    const keep = new Set();
    for (const s of list) {
      if (!s || !s.mid) continue;
      keep.add(s.mid);
      let m = this.findMobById(s.mid);
      if (!m) {
        m = Mobs.spawn(s.t, finite(s.x, 0), finite(s.y, 0), finite(s.z, 0), s.g || null, s.c || null);
        if (!m) continue;
        m.mpId = s.mid;
        if (m.body) { m.body.x = finite(s.x, m.body.x); m.body.y = finite(s.y, m.body.y); m.body.z = finite(s.z, m.body.z); }
      }
      m.mpTarget = Object.assign({}, s);
      if ((m.type === 'jelly' || m.type === 'big_jelly') && typeof Jelly !== 'undefined') {
        m.jellyId = s.jid || m.jellyId || Jelly.newJellyId();
        m.homeHouseId = s.hid || null;
        m.membership = s.mem || (m.homeHouseId ? 'outside_member' : 'homeless');
        m.jellyHome = m.homeHouseId ? (Jelly.getHouseKeyById(m.homeHouseId) || '') : '';
        if (m.type === 'big_jelly') Jelly.initMob(m, 'remote_big');
      }
      m.hp = Number.isFinite(+s.hp) ? +s.hp : m.hp;
      m.flash = Math.max(m.flash || 0, finite(s.flash, 0));
      m.fuse = finite(s.fuse, m.fuse || 0);
      m.attackSwingT = Math.max(m.attackSwingT || 0, finite(s.atk, 0));
      if (!m.__mpHadLiveState) {
        const b = m.body;
        b.x = finite(s.x, b.x); b.y = finite(s.y, b.y); b.z = finite(s.z, b.z);
        b.vx = finite(s.vx, 0); b.vy = finite(s.vy, 0); b.vz = finite(s.vz, 0);
        m.yaw = finite(s.yaw, m.yaw || 0); m.targetYaw = finite(s.targetYaw, m.yaw);
        m.walkAnim = finite(s.walk, m.walkAnim || 0);
        if (m.group) { m.group.position.set(b.x, b.y, b.z); m.group.rotation.y = m.yaw; }
        m.__mpHadLiveState = true;
      }
    }
    for (let i = Mobs.list.length - 1; i >= 0; i--) {
      const m = Mobs.list[i];
      if (m && m.mpId && !keep.has(m.mpId)) {
        if (m.group) Mobs.scene.remove(m.group);
        Mobs.list.splice(i, 1);
      }
    }
  };

  MP.clientMobVisualTick = function(dt){
    if (typeof Mobs === 'undefined') return;
    const a = Math.min(1, 12 * (dt || 0));
    for (const m of Mobs.list) {
      if (!m || !m.group || !m.body) continue;
      const t = m.mpTarget;
      const b = m.body;
      if (t) {
        b.x += (finite(t.x, b.x) - b.x) * a;
        b.y += (finite(t.y, b.y) - b.y) * a;
        b.z += (finite(t.z, b.z) - b.z) * a;
        b.vx = finite(t.vx, b.vx || 0); b.vy = finite(t.vy, b.vy || 0); b.vz = finite(t.vz, b.vz || 0);
        m.yaw = lerpAngle(finite(m.yaw, 0), finite(t.yaw, m.yaw || 0), a);
        m.targetYaw = finite(t.targetYaw, m.targetYaw || m.yaw);
        m.hp = Number.isFinite(+t.hp) ? +t.hp : m.hp;
        m.fuse = finite(t.fuse, m.fuse || 0);
        m.attackSwingT = Math.max(m.attackSwingT || 0, finite(t.atk, 0));
      }
      const planar = Math.hypot(b.vx || 0, b.vz || 0);
      const moving = planar > 0.035 || Math.abs(b.vy || 0) > 0.08;
      if (moving) m.walkAnim = (m.walkAnim || 0) + (dt || 0) * (m.type === 'spider' ? 10 : m.type === 'creeper' ? 6 : 7) * Math.max(0.45, Math.min(1.7, planar));
      const swing = moving ? Math.sin(m.walkAnim || 0) * 0.5 : 0;
      if (m.parts && Array.isArray(m.parts.legs)) {
        m.parts.legs.forEach((leg, li) => {
          if (!leg) return;
          if (m.type === 'spider') leg.rotation.y = swing * (li % 2 ? 0.4 : -0.4);
          else if (m.type === 'sprawler') leg.rotation.x = (li < 2 ? 0.18 : -0.18) + swing * (li % 2 ? 0.75 : -0.75);
          else if (m.type !== 'creeper') leg.rotation.x = swing * (li % 2 ? 1 : -1);
        });
      }
      if (m.type === 'sprawler' && m.parts && m.parts.head) {
        m.attackSwingT = Math.max(0, (m.attackSwingT || 0) - (dt || 0));
        m.parts.head.rotation.x = m.attackSwingT > 0 ? Math.sin(m.attackSwingT / 0.28 * Math.PI) * 0.7 : 0;
      }
      m.group.position.set(b.x, b.y, b.z);
      m.group.rotation.y = m.yaw || 0;
      if (m.type === 'creeper') {
        const sc = 1 + (m.fuse || 0) * 0.2;
        m.group.scale.set(sc, sc, sc);
        if (Mobs.setEmissive) Mobs.setEmissive(m, Math.max((m.fuse || 0) > 0 ? 0.45 : 0, m.flash > 0 ? 0.6 : 0), m.flash > 0 ? 0xff3333 : 0xffffff);
      } else if (Mobs.setEmissive) Mobs.setEmissive(m, m.flash > 0 ? 0.6 : 0, 0xff3333);
      if (m.flash > 0) m.flash -= dt || 0;
      if (Mobs.tintMob) Mobs.tintMob(m);
    }
  };

  // Dropped items get the same target/interpolation treatment so they do not jitter/snap.
  MP.applyDropsLive = function(list){
    if (typeof Drops === 'undefined') return;
    const keep = new Set();
    for (const s of list) {
      if (!s || !s.did || !s.item) continue;
      keep.add(s.did);
      let d = Drops.list.find(x => x.mpId === s.did);
      if (!d) {
        const before = Drops.list.length;
        Drops.spawn(finite(s.x, 0), finite(s.y, 0), finite(s.z, 0), s.item|0, s.count|0, [0,0,0], s.dur, s.data);
        d = Drops.list[before];
        if (!d) continue;
        d.mpId = s.did;
        d.body.x = finite(s.x, d.body.x); d.body.y = finite(s.y, d.body.y); d.body.z = finite(s.z, d.body.z);
      }
      d.mpTarget = Object.assign({}, s);
      d.id = s.item|0; d.count = s.count|0; d.dur = s.dur; if (s.data !== undefined) d.data = JSON.parse(JSON.stringify(s.data)); d.age = finite(s.age, d.age || 0); d.pickupDelay = finite(s.pd, d.pickupDelay || 0);
    }
    for (let i = Drops.list.length - 1; i >= 0; i--) {
      const d = Drops.list[i];
      if (d && d.mpId && !keep.has(d.mpId)) Drops.remove(i);
    }
  };

  MP.clientDropVisualTick = function(dt){
    if (typeof Drops === 'undefined' || typeof Player === 'undefined') return;
    const p = Player.body;
    const now = performance.now();
    const a = Math.min(1, 12 * (dt || 0));
    for (const d of Drops.list) {
      if (!d || !d.body) continue;
      if (d.mpTarget) {
        const t = d.mpTarget, b = d.body;
        b.x += (finite(t.x, b.x) - b.x) * a;
        b.y += (finite(t.y, b.y) - b.y) * a;
        b.z += (finite(t.z, b.z) - b.z) * a;
        b.vx = finite(t.vx, b.vx || 0); b.vy = finite(t.vy, b.vy || 0); b.vz = finite(t.vz, b.vz || 0);
      }
      d.age = (d.age || 0) + (dt || 0);
      d.spin = (d.spin || 0) + (dt || 0) * 2.5;
      const b = d.body;
      const bob = Math.sin((d.age || 0) * 3) * 0.04;
      if (d.mesh) { d.mesh.position.set(b.x, b.y + 0.18 + bob, b.z); if (d.mesh.isMesh) d.mesh.rotation.y = d.spin; }
      if (Drops.tint) Drops.tint(d);
      if (d.mpId && d.age >= (d.pickupDelay || 0) && !Player.dead && Player.canAccept(d.id)) {
        const dist = Math.hypot(p.x - b.x, (p.y + 0.6) - b.y, p.z - b.z);
        if (dist < 0.8 && now - (d._lastPickupAsk || 0) > 350) { d._lastPickupAsk = now; this.send({ type:'pickup_request', dropId:d.mpId }); }
      }
    }
  };

  // Wrap message handling for vehicle mount/input/damage/exit acknowledgements.
  const prevHandle = MP.handleFullSyncMessage ? MP.handleFullSyncMessage.bind(MP) : function(){ return false; };
  MP.handleFullSyncMessage = function(msg, fromId, cameFromClient){
    if (!msg || !msg.type) return false;
    const sender = fromId || msg.id;
    if (msg.type === 'vehicle_mount_request') { if (this.role === 'host' && cameFromClient) this.hostHandleVehicleMount(sender, msg); return true; }
    if (msg.type === 'vehicle_dismount_request') { if (this.role === 'host' && cameFromClient) this.hostHandleVehicleDismount(sender, msg); return true; }
    if (msg.type === 'vehicle_input') { if (this.role === 'host' && cameFromClient) this.hostApplyVehicleInput(sender, msg); return true; }
    if (msg.type === 'vehicle_hurt_request') { if (this.role === 'host' && cameFromClient) this.hostHandleVehicleHurt(sender, msg); return true; }
    if (msg.type === 'vehicle_exit_position') { if (this.role === 'client') this.clientApplyVehicleExit(msg); return true; }
    return prevHandle(msg, fromId, cameFromClient);
  };

  // Add client vehicle visual/input ticks and host local rider bookkeeping to the multiplayer update.
  const prevFullSyncUpdate = MP.fullSyncUpdate ? MP.fullSyncUpdate.bind(MP) : function(){};
  MP.fullSyncUpdate = function(dt){
    prevFullSyncUpdate(dt || 0);
    if (!Game.inWorld || !World.ready || this.role === 'solo') return;
    if (this.role === 'client') {
      this.clientVehicleVisualTick(dt || 0);
      this.clientSendVehicleInput(dt || 0);
    } else if (this.role === 'host') {
      this.hostSyncLocalVehicleRider();
    }
  };

  // Hook vehicles after all earlier multiplayer hook layers have installed.
  const prevInstall = MP.installFullSyncHooks ? MP.installFullSyncHooks.bind(MP) : function(){};
  MP.installFullSyncHooks = function(){
    prevInstall();
    if (this.__vehicleAuthorityHooksReady || typeof Vehicles === 'undefined') return;
    this.__vehicleAuthorityHooksReady = true;

    for (const name of ['placeCar','placeSuperCar','placePlane','placeBoat','placeBoard']) {
      if (!Vehicles[name] || Vehicles['__mpId_' + name]) continue;
      Vehicles['__mpId_' + name] = true;
      const oldPlace = Vehicles[name].bind(Vehicles);
      Vehicles[name] = function(...args){
        const v = oldPlace(...args);
        if (v && typeof Multiplayer !== 'undefined') Multiplayer.ensureVehicleId(v);
        return v;
      };
    }

    if (Vehicles.enter && !Vehicles.__mpAuthorityEnterPatch) {
      Vehicles.__mpAuthorityEnterPatch = true;
      const oldEnter = Vehicles.enter.bind(Vehicles);
      Vehicles.enter = function(v){
        if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) {
          if (!v || v.mpRider) { if (typeof UI !== 'undefined') UI.chat('That vehicle is already occupied.', '#ffb347'); return; }
          if (v.kind === 'board') {
            // Boards have no shared physics body — the rider IS the position (streamed via
            // player_state). So board LOCALLY right now and just tell the host to remove the
            // placed board for everyone; don't wait for a grant that never comes for boards.
            Multiplayer.clientMountedVehicleId = v.mpId;
            v.mpRider = Multiplayer.id;
            Multiplayer.send({ type:'vehicle_mount_request', vid:v.mpId });
            return oldEnter(v); // sets Player.boarding = true, removes the local board entity
          }
          Multiplayer.clientMountPending = v.mpId;
          Multiplayer.send({ type:'vehicle_mount_request', vid:v.mpId });
          if (typeof UI !== 'undefined') UI.chat('Entering vehicle...', '#ffd97a');
          return;
        }
        const ret = oldEnter(v);
        if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'host' && v) v.mpRider = Multiplayer.id;
        return ret;
      };
    }

    if (Vehicles.exit && !Vehicles.__mpAuthorityExitPatch) {
      Vehicles.__mpAuthorityExitPatch = true;
      const oldExit = Vehicles.exit.bind(Vehicles);
      Vehicles.exit = function(force){
        const v = this.driving || this.boating;
        if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) {
          if (v && v.mpId) Multiplayer.send({ type:'vehicle_dismount_request', vid:v.mpId });
          Multiplayer.clientApplyVehicleExit(null);
          return true;
        }
        const ret = oldExit(force);
        if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'host' && v && v.mpRider === Multiplayer.id) v.mpRider = '';
        return ret;
      };
    }

    if (Vehicles.stopBoard && !Vehicles.__mpAuthorityBoardExitPatch) {
      Vehicles.__mpAuthorityBoardExitPatch = true;
      const oldStopBoard = Vehicles.stopBoard.bind(Vehicles);
      Vehicles.stopBoard = function(placeDown, force){
        if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) {
          if (Multiplayer.clientMountedVehicleId) Multiplayer.send({ type:'vehicle_dismount_request', vid:Multiplayer.clientMountedVehicleId });
          Multiplayer.clientApplyVehicleExit(null);
          return true;
        }
        return oldStopBoard(placeDown, force);
      };
    }

    if (Vehicles.updateVehicleCommon && !Vehicles.__mpRemoteDriverPatch) {
      Vehicles.__mpRemoteDriverPatch = true;
      const oldCommon = Vehicles.updateVehicleCommon.bind(Vehicles);
      Vehicles.updateVehicleCommon = function(v, dt, drivingThis, isBoat){
        if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'host' && v && v.mpRider && v.mpRider !== Multiplayer.id) {
          const input = Multiplayer.vehicleInputs.get(v.mpRider);
          const fresh = input && performance.now() - (input.t || 0) < 1600;
          const oldKeys = Player.keys, oldDead = Player.dead, oldHurt = Player.hurt;
          Player.keys = fresh ? (input.keys || {}) : {};
          Player.dead = false;
          Player.hurt = function(dmg, kx, kz, opts){ Multiplayer.damageRemotePlayer(v.mpRider, dmg, kx, kz, (opts && opts.source) || 'vehicle'); };
          try { return oldCommon(v, dt || 0, true, isBoat); }
          finally { Player.keys = oldKeys; Player.dead = oldDead; Player.hurt = oldHurt; }
        }
        return oldCommon(v, dt || 0, drivingThis, isBoat);
      };
    }

    if (Vehicles.hurt && !Vehicles.__mpHurtRequestPatch) {
      Vehicles.__mpHurtRequestPatch = true;
      const oldHurt = Vehicles.hurt.bind(Vehicles);
      Vehicles.hurt = function(v, dmg, src){
        if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) {
          if (v && v.mpId) Multiplayer.send({ type:'vehicle_hurt_request', vid:v.mpId, dmg:+dmg || 0 });
          return;
        }
        return oldHurt(v, dmg, src);
      };
    }
  };
})();

// ============================================================
// Multiplayer inventory authority + client mining request patch.
// Fixes client pickup stacks splitting across slots and moves mining
// rewards/block destruction to the host so the same block cannot award
// different clients separate local drops.
// ============================================================
(function installFloopInventoryAndMiningAuthorityPatch(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__inventoryMiningAuthorityPatchInstalled) return;
  Multiplayer.__inventoryMiningAuthorityPatchInstalled = true;

  const finiteNum = (v) => Number.isFinite(+v) ? +v : undefined;
  const asItemId = (id) => Number.isFinite(+id) ? (+id | 0) : 0;
  const asCount = (n) => Math.max(0, Math.floor(+n || 0));
  const samePlainItem = (s, id) => s && asItemId(s.id) === id && !Number.isFinite(+s.dur);
  const isDurableDur = (dur) => Number.isFinite(+dur) && +dur > 0;
  const cleanStack = (s) => {
    if (!s) return null;
    const id = asItemId(s.id);
    const def = typeof Reg !== 'undefined' ? Reg[id] : null;
    if (!id || !def) return null;
    const count = Math.max(1, Math.min(asCount(s.count || 1), def.stack || 64));
    const out = { id, count };
    if (isDurableDur(s.dur)) out.dur = +s.dur;
    if (s.data !== undefined) out.data = JSON.parse(JSON.stringify(s.data));
    return out;
  };

  function grantStackToPlayer(id, count, dur, data) {
    id = asItemId(id);
    count = asCount(count);
    const def = typeof Reg !== 'undefined' ? Reg[id] : null;
    if (!def || count <= 0 || typeof Player === 'undefined') return count;
    let left = count;
    const hasDur = isDurableDur(dur);
    const hasData = data !== undefined;
    const dataKey = hasData ? JSON.stringify(data) : '';
    const sameData = (s) => (s && (s.data === undefined ? '' : JSON.stringify(s.data)) === dataKey);
    const cloneData = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
    const maxStack = Math.max(1, def.stack || 64);

    // Durable/unique items never merge. This prevents broken repairs and also
    // prevents non-durable packets with dur:null from being treated as durable.
    if (hasDur || maxStack <= 1) {
      for (let i = 0; i < 36 && left > 0; i++) {
        if (!Player.inv[i]) {
          const s = { id, count: 1 };
          if (hasDur) s.dur = +dur;
          if (hasData) s.data = cloneData(data);
          Player.inv[i] = s;
          left--;
        }
      }
      if (typeof UI !== 'undefined') UI.updateHotbar();
      return left;
    }

    for (let i = 0; i < 36 && left > 0; i++) {
      const s = Player.inv[i];
      if (samePlainItem(s, id) && sameData(s) && s.count < maxStack) {
        const take = Math.min(maxStack - s.count, left);
        s.id = id;
        s.count += take;
        delete s.dur;
        left -= take;
      }
    }
    for (let i = 0; i < 36 && left > 0; i++) {
      if (!Player.inv[i]) {
        const take = Math.min(maxStack, left);
        Player.inv[i] = { id, count: take };
        if (hasData) Player.inv[i].data = cloneData(data);
        left -= take;
      }
    }
    if (typeof UI !== 'undefined') UI.updateHotbar();
    return left;
  }

  // Harden inventory stack logic globally. This fixes number/string id mismatches
  // and the dur:null network case that made plain blocks enter one slot each.
  if (typeof Player !== 'undefined' && !Player.__mpRobustStackPatch) {
    Player.__mpRobustStackPatch = true;
    Player.addItem = function(id, count, dur, data) { return grantStackToPlayer(id, count, dur, data); };
    Player.canAccept = function(id, dur) {
      id = asItemId(id);
      const def = typeof Reg !== 'undefined' ? Reg[id] : null;
      if (!def) return false;
      const maxStack = Math.max(1, def.stack || 64);
      const hasDur = isDurableDur(dur);
      for (let i = 0; i < 36; i++) {
        const s = this.inv[i];
        if (!s) return true;
        if (!hasDur && maxStack > 1 && samePlainItem(s, id) && s.count < maxStack) return true;
      }
      return false;
    };
    const oldRemoveItems = Player.removeItems ? Player.removeItems.bind(Player) : null;
    Player.removeItems = function(id, count) {
      id = asItemId(id); count = asCount(count);
      if (!id || count <= 0) return false;
      let have = 0;
      for (const s of this.inv) if (s && asItemId(s.id) === id) have += asCount(s.count || 1);
      if (have < count) return false;
      let left = count;
      for (let i = 35; i >= 0 && left > 0; i--) {
        const s = this.inv[i];
        if (s && asItemId(s.id) === id) {
          const take = Math.min(asCount(s.count || 1), left);
          s.id = id; s.count = asCount(s.count || 1) - take; left -= take;
          if (s.count <= 0) this.inv[i] = null;
        }
      }
      if (typeof UI !== 'undefined') UI.updateHotbar();
      return true;
    };
    Player.normalizeInventoryStacks = function() {
      const loose = new Map();
      const keep = [];
      for (let i = 0; i < 36; i++) {
        const s = cleanStack(this.inv[i]);
        this.inv[i] = null;
        if (!s) continue;
        const def = Reg[s.id];
        if (Number.isFinite(+s.dur) || (def && (def.stack || 64) <= 1)) keep.push(s);
        else loose.set(s.id, (loose.get(s.id) || 0) + s.count);
      }
      for (const s of keep) grantStackToPlayer(s.id, s.count, s.dur, s.data);
      for (const [id, count] of loose.entries()) grantStackToPlayer(id, count);
      if (typeof UI !== 'undefined') UI.updateHotbar();
    };
  }

  Object.assign(Multiplayer, {
    sanitizeNetStack(s) { return cleanStack(s); },

    clientReceiveItem(msg) {
      if (!msg) return;
      const id = asItemId(msg.item);
      const count = asCount(msg.count);
      if (!id || count <= 0) return;
      const dur = finiteNum(msg.dur);
      const leftover = grantStackToPlayer(id, count, dur, msg.data);
      if (leftover > 0) {
        this.send({ type:'drop_request', x:Player.body.x, y:Player.body.y + 1, z:Player.body.z, item:id, count:leftover, dur:dur, data:msg.data });
      }
      if (typeof SFX !== 'undefined') SFX.pop();
      if (typeof UI !== 'undefined') UI.updateHotbar();
    },

    grantXpToClient(msg) {
      const xp = Math.max(0, Math.floor(+((msg && msg.xp) || 0)));
      if (xp > 0 && typeof Player !== 'undefined' && Player.addXp) Player.addXp(xp);
    },

    sendGrantXp(pid, xp) {
      xp = Math.max(0, Math.floor(+xp || 0));
      if (!pid || xp <= 0) return;
      const conn = this.connections && this.connections.get(pid);
      if (conn) this.sendTo(conn, { type:'grant_xp', xp });
    },

    remotePeerState(pid) {
      const peer = this.peers && this.peers.get(pid);
      return peer && (peer.target || peer.state) || null;
    },

    hostBreakOneForRemote(pid, bx, by, bz, id, toolOk, noUpdate, creative) {
      if (typeof World === 'undefined' || typeof Drops === 'undefined' || typeof Reg === 'undefined') return 0;
      id = asItemId(id || World.getBlock(bx, by, bz));
      const def = Reg[id];
      if (!def || id === B.AIR || def.hard === Infinity) return 0;
      let xp = 0;
      const mb = World.multiblockGroupFor && World.multiblockGroupFor(bx, by, bz);
      if (mb) {
        World.destroyMultiblockAt(bx, by, bz, { drop: !creative && !!toolOk, particles: true });
        if (!creative && toolOk && def.xp) xp += def.xp | 0;
        return xp;
      }
      if (typeof B !== 'undefined' && id === B.JELLY_HOUSE) {
        const res = (typeof Jelly !== 'undefined') ? Jelly.breakHouseAt(bx, by, bz, { reason: 'remote_player_mine', actor: pid }) : null;
        World.setBlock(bx, by, bz, B.AIR, Object.assign(noUpdate ? { noUpdate:true } : {}, { jellyHouseBreakHandled:true }));
        if (typeof Particles !== 'undefined' && Particles.blockBurst) Particles.blockBurst(bx, by, bz, id);
        if (!creative && toolOk) Drops.spawn(bx + 0.5, by + 0.4, bz + 0.5, id, 1, null, undefined, (res && res.itemData) || (typeof Jelly !== 'undefined' ? Jelly.serializeHouseItem([]) : { jellyRoster: [] }));
        if (!creative && toolOk && def.xp) xp += def.xp | 0;
        return xp;
      }
      World.setBlock(bx, by, bz, B.AIR, noUpdate ? { noUpdate:true } : undefined);
      if (typeof Particles !== 'undefined' && Particles.blockBurst) Particles.blockBurst(bx, by, bz, id);
      if (id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG || id === B.OASIS_LOG) {
        if (typeof Dynamics !== 'undefined' && Dynamics.queueLeafDecay) Dynamics.queueLeafDecay(bx, by, bz);
      }
      if (!creative) {
        if ((typeof isSnowSheet !== 'undefined' && isSnowSheet(id)) || id === B.SNOW) {
          if (String(arguments[8] || '') === 'shovel') {
            const n = id === B.SNOW ? 4 : Math.max(1, Math.ceil(snowSheetLevel(id) / 2));
            Drops.spawn(bx + 0.5, by + 0.4, bz + 0.5, I.SNOWBALL, n);
          } else if (id === B.SNOW) Drops.dropFromBlock(bx, by, bz, id, toolOk);
        } else Drops.dropFromBlock(bx, by, bz, id, toolOk);
        if (toolOk && def.xp) xp += def.xp | 0;
      }
      return xp;
    },

    hostHandleBlockBreakRequest(pid, msg) {
      if (this.role !== 'host' || !msg || typeof World === 'undefined' || typeof Reg === 'undefined') return;
      const st = this.remotePeerState(pid);
      if (!st) return;
      const bx = Math.floor(+msg.x), by = Math.floor(+msg.y), bz = Math.floor(+msg.z);
      if (Math.hypot((+st.x || 0) - (bx + 0.5), ((+st.y || 0) + 0.8) - (by + 0.5), (+st.z || 0) - (bz + 0.5)) > 7.0) return;
      if (typeof Dimensions !== 'undefined' && st.dim && st.dim !== Dimensions.current) return;
      const liveId = World.getBlock(bx, by, bz);
      if (!liveId || liveId === B.AIR || (Reg[liveId] && Reg[liveId].hard === Infinity)) return;
      if (msg.id && asItemId(msg.id) !== liveId) {
        // Block changed before the client's packet arrived. Refuse the stale reward.
        return;
      }
      const toolOk = !!msg.toolOk;
      const creative = !!msg.creative;
      const toolType = String(msg.toolType || '');
      let xp = 0;

      if (msg.targetPart === 'underSlab') {
        const k = World.pkey(bx, by, bz);
        const storedSlab = World.plantationUnderSlabs && World.plantationUnderSlabs.get(k);
        if (storedSlab) {
          World.plantationUnderSlabs.delete(k);
          World.destroyMultiblockAt(bx, by, bz, { drop: !creative, kind:'plantation', particles:true });
          if (!creative) Drops.dropFromBlock(bx, by, bz, storedSlab, toolOk);
          if (toolOk && Reg[storedSlab] && Reg[storedSlab].xp) xp += Reg[storedSlab].xp | 0;
          this.sendGrantXp(pid, xp);
          return;
        }
      }

      if (typeof isCrop !== 'undefined' && isCrop(liveId)) {
        World.setBlock(bx, by, bz, B.PLANTATION_POT);
        if (!creative) {
          const mature = cropStage(liveId) >= 3;
          Drops.spawn(bx + 0.5, by + 0.55, bz + 0.5, mature ? I.FLOOPFRUIT : I.FLOOPFRUIT_SEEDS, mature ? 1 + ((Math.random() * 2) | 0) : 1);
          if (mature && Math.random() < 0.55) Drops.spawn(bx + 0.5, by + 0.65, bz + 0.5, I.FLOOPFRUIT_SEEDS, 1 + ((Math.random() * 2) | 0));
        }
        this.sendGrantXp(pid, xp);
        return;
      }
      if (liveId === B.DUNGEON_CORE) {
        // Client mining is host-delegated, so the singleplayer core-break branch in
        // player.js never runs for a remote player. Mirror it here: quiet the core
        // to its rank inactive brick AND run the mass deactivation (which itself
        // replicates via dungeon_deactivated) so the whole dungeon opens up.
        const dgHit = World.dungeonAtBlock ? World.dungeonAtBlock(bx, by, bz) : null;
        const inactiveId = (typeof dungeonBrickInactiveForRank === 'function') ? dungeonBrickInactiveForRank(dgHit && dgHit.rank) : B.DUNGEON_BRICK_INACTIVE;
        World.setBlock(bx, by, bz, inactiveId, { skipPortalCheck: true });
        if (World.deactivateDungeonAt) World.deactivateDungeonAt(bx, by, bz);
        if (typeof Particles !== 'undefined' && Particles.blockBurst) Particles.blockBurst(bx, by, bz, liveId);
        if (!creative && toolOk) Drops.spawn(bx + 0.5, by + 0.55, bz + 0.5, I.DUNGEON_CORE_SHARD, 1);
        if (toolOk && Reg[liveId] && Reg[liveId].xp) xp += Reg[liveId].xp | 0;
        this.sendGrantXp(pid, xp);
        return;
      }
      if (liveId === B.PLANTATION_POT) { World.destroyMultiblockAt(bx, by, bz, { drop: !creative, kind:'plantation' }); this.sendGrantXp(pid, xp); return; }
      if (typeof isDoor !== 'undefined' && isDoor(liveId)) { World.destroyMultiblockAt(bx, by, bz, { drop: !creative, kind:'door' }); this.sendGrantXp(pid, xp); return; }
      if (typeof isBed !== 'undefined' && isBed(liveId)) { World.destroyMultiblockAt(bx, by, bz, { drop: !creative, kind:'bed' }); this.sendGrantXp(pid, xp); return; }
      if (typeof isDSlab !== 'undefined' && isDSlab(liveId)) {
        const drops = slabComboDropIds(liveId);
        World.setBlock(bx, by, bz, B.AIR);
        if (!creative) drops.forEach((dropId, i) => Drops.spawn(bx + 0.5, by + 0.35 + i * 0.2, bz + 0.5, dropId, 1));
        this.sendGrantXp(pid, xp);
        return;
      }

      const area = !!msg.area && toolType;
      xp += this.hostBreakOneForRemote(pid, bx, by, bz, liveId, toolOk, area, creative, toolType);
      if (area) {
        const nx = Math.abs(+msg.nx || 0), ny = Math.abs(+msg.ny || 0), nz = Math.abs(+msg.nz || 0);
        const targets = [];
        for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) {
          if (a === 0 && b2 === 0) continue;
          let tx = bx, ty = by, tz = bz;
          if (ny === 1) { tx += a; tz += b2; }
          else if (nx === 1) { ty += a; tz += b2; }
          else { tx += a; ty += b2; }
          const tid = World.getBlock(tx, ty, tz);
          if (!tid || tid === B.AIR || tid === B.BEDROCK || (typeof isFluid !== 'undefined' && isFluid(tid))) continue;
          const tdef = Reg[tid];
          if (!tdef || tdef.tool !== toolType || tdef.hard === Infinity) continue;
          targets.push([tx, ty, tz, tid]);
        }
        for (const [tx, ty, tz, tid] of targets) xp += this.hostBreakOneForRemote(pid, tx, ty, tz, tid, true, true, creative, toolType);
        targets.push([bx, by, bz, liveId]);
        for (const [tx, ty, tz] of targets) {
          World.checkSupports(tx, ty, tz, B.AIR);
          if (typeof Water !== 'undefined') { Water.schedule(tx, ty, tz); Water.schedule(tx, ty + 1, tz); Water.schedule(tx, ty - 1, tz); Water.schedule(tx + 1, ty, tz); Water.schedule(tx - 1, ty, tz); Water.schedule(tx, ty, tz + 1); Water.schedule(tx, ty, tz - 1); }
          if (typeof Lava !== 'undefined') { Lava.schedule(tx, ty, tz); Lava.schedule(tx, ty + 1, tz); }
        }
      }
      this.sendGrantXp(pid, xp);
    },
  });

  // Patch client mining so it asks the host to break the block and generate drops.
  // This prevents client-only duplicate/block-stale rewards while keeping the
  // local crack progress, tool wear, and swing feel responsive.
  if (typeof Player !== 'undefined' && Player.breakBlockAt && !Player.__mpBreakRequestPatch) {
    Player.__mpBreakRequestPatch = true;
    const oldBreakBlockAt = Player.breakBlockAt.bind(Player);
    Player.breakBlockAt = function(bx, by, bz, id, toolOk, hit) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && Multiplayer.connected && !Multiplayer.applyingRemoteState && !Multiplayer.applyingRemote) {
        const held = this.held && this.held();
        const def = held && Reg[asItemId(held.id)];
        const tool = def && def.tool;
        Multiplayer.send({
          type:'block_break_request', x:bx, y:by, z:bz, id:asItemId(id), toolOk:!!toolOk,
          creative:this.gamemode === 'creative', toolType:tool && tool.type || '', area:!!(tool && tool.area && hit && !this.sneaking),
          nx:hit && +hit.nx || 0, ny:hit && +hit.ny || 0, nz:hit && +hit.nz || 0, targetPart:hit && hit.targetPart || ''
        });
        if (typeof SFX !== 'undefined') SFX.breakBlk();
        this.exhaustion = (this.exhaustion || 0) + 0.03;
        if (this.swingViewmodel) this.swingViewmodel();
        return;
      }
      return oldBreakBlockAt(bx, by, bz, id, toolOk, hit);
    };
  }

  // Install/extend message handling without disturbing the vehicle/entity patches.
  const prevHandle = Multiplayer.handleFullSyncMessage ? Multiplayer.handleFullSyncMessage.bind(Multiplayer) : function(){ return false; };
  Multiplayer.handleFullSyncMessage = function(msg, fromId, cameFromClient) {
    if (!msg || !msg.type) return false;
    const sender = fromId || msg.id;
    if (msg.type === 'block_break_request') { if (this.role === 'host' && cameFromClient) this.hostHandleBlockBreakRequest(sender, msg); return true; }
    if (msg.type === 'grant_xp') { if (this.role === 'client') this.grantXpToClient(msg); return true; }
    if (msg.type === 'give_item') { if (this.role === 'client') this.clientReceiveItem(msg); return true; }
    return prevHandle(msg, fromId, cameFromClient);
  };

  // Normalize inventory periodically after network grants and UI transfers so any
  // old split stacks from a previous build collapse back into proper stacks.
  const prevFullSyncUpdate = Multiplayer.fullSyncUpdate ? Multiplayer.fullSyncUpdate.bind(Multiplayer) : function(){};
  Multiplayer.fullSyncUpdate = function(dt) {
    prevFullSyncUpdate(dt || 0);
    if (typeof Player !== 'undefined' && Player.normalizeInventoryStacks && Game && Game.inWorld) {
      const now = performance.now();
      if (now - (this.__lastInvNormalize || 0) > 1000) {
        this.__lastInvNormalize = now;
        Player.normalizeInventoryStacks();
      }
    }
  };
})();

// Keep inventory cleanup stable: merge duplicate plain stacks into earlier slots
// without reordering tools, armor, hotbar layout, or unique items.
(function installFloopStableInventoryCleanup(){
  if (typeof Player === 'undefined' || Player.__mpStableInventoryCleanupPatch) return;
  Player.__mpStableInventoryCleanupPatch = true;
  const asItemId = (id) => Number.isFinite(+id) ? (+id | 0) : 0;
  const isDur = (d) => Number.isFinite(+d) && +d >= 0;
  Player.normalizeInventoryStacks = function(){
    if (typeof Reg === 'undefined') return;
    for (let i = 0; i < 36; i++) {
      const s = this.inv[i];
      if (!s) continue;
      const id = asItemId(s.id), def = Reg[id];
      if (!id || !def) { this.inv[i] = null; continue; }
      s.id = id; s.count = Math.max(1, Math.floor(+s.count || 1));
      const max = Math.max(1, def.stack || 64);
      if (isDur(s.dur) || max <= 1) { s.count = 1; continue; }
      delete s.dur;
      for (let j = 0; j < i && s.count > 0; j++) {
        const t = this.inv[j];
        if (!t || asItemId(t.id) !== id || isDur(t.dur)) continue;
        t.id = id; t.count = Math.max(1, Math.floor(+t.count || 1)); delete t.dur;
        if (t.count >= max) continue;
        const take = Math.min(max - t.count, s.count);
        t.count += take; s.count -= take;
      }
      if (s.count <= 0) this.inv[i] = null;
      else if (s.count > max) {
        const keep = max; let left = s.count - keep; s.count = keep;
        for (let j = i + 1; j < 36 && left > 0; j++) if (!this.inv[j]) {
          const take = Math.min(max, left); this.inv[j] = { id, count:take }; left -= take;
        }
        if (left > 0) s.count += left; // full inventory: keep count visible rather than deleting items
      }
    }
    if (typeof UI !== 'undefined') UI.updateHotbar();
  };
})();

// ============================================================
// Multiplayer vehicle prediction + host client-chunk simulation + synced entity lighting.
// Fixes stiff guest driving, host-side fake/unloaded chunks around far clients,
// and client-side entity lighting mismatches when local chunks/light are not present.
// ============================================================
(function installFloopPredictionChunkLightSyncPatch(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__predictionChunkLightSyncPatchInstalled) return;
  Multiplayer.__predictionChunkLightSyncPatchInstalled = true;

  const MP = Multiplayer;
  const finite = (v, fallback) => Number.isFinite(+v) ? +v : fallback;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shortAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const lerpAngle = (a, b, t) => a + shortAngle(b - a) * t;

  Object.assign(MP, {
    clientChunkLoadCursor: 0,

    entityVoxelLightColor(x, y, z, minLight) {
      if (typeof World === 'undefined' || !World || !World.getLightColor) return [1, 1, 1];
      return World.getLightColor(Math.floor(finite(x, 0)), Math.floor(finite(y, 0)), Math.floor(finite(z, 0)), undefined, Number.isFinite(+minLight) ? +minLight : 0.06);
    },

    entityVoxelLightLevel(x, y, z, minLight) {
      const c = this.entityVoxelLightColor(x, y, z, minLight);
      return Math.max(c[0], c[1], c[2]);
    },

    applyVoxelLightToObject(obj, light, key) {
      if (!obj) return;
      const c = Array.isArray(light) ? [clamp(finite(light[0], 1), 0.04, 1.25), clamp(finite(light[1], 1), 0.04, 1.25), clamp(finite(light[2], 1), 0.04, 1.25)] : (Number.isFinite(+light) ? [clamp(+light, 0.04, 1.25), clamp(+light, 0.04, 1.25), clamp(+light, 0.04, 1.25)] : null);
      if (!c) return;
      const baseKey = key || 'mpBaseCol';
      obj.traverse(o => {
        if (!o.isMesh && !o.isSprite) return;
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const mat of mats) {
          if (!mat || !mat.color) continue;
          if (!mat.userData[baseKey]) mat.userData[baseKey] = mat.color.clone();
          mat.color.copy(mat.userData[baseKey]); mat.color.r *= c[0]; mat.color.g *= c[1]; mat.color.b *= c[2];
        }
      });
    },

    hostRemoteChunkCenters() {
      const out = [];
      if (this.role !== 'host' || !this.peers) return out;
      const currentDim = (typeof Dimensions !== 'undefined') ? Dimensions.current : 'overworld';
      for (const peer of this.peers.values()) {
        const st = peer && (peer.target || peer.state);
        if (!st || st.dead) continue;
        if (st.dim && st.dim !== currentDim) continue;
        if (!Number.isFinite(+st.x) || !Number.isFinite(+st.z)) continue;
        out.push({ x:+st.x, z:+st.z });
      }
      return out;
    },

    ensureHostChunksAroundClients(dt) {
      if (this.role !== 'host' || typeof World === 'undefined' || !World.ready) return;
      const centers = this.hostRemoteChunkCenters();
      if (!centers.length) return;
      const radius = Math.max(2, (World.R || 4) + 1);
      const tasks = [];
      for (const c of centers) {
        const pcx = World.chunkCoord ? World.chunkCoord(c.x) : Math.floor(c.x / 16), pcz = World.chunkCoord ? World.chunkCoord(c.z) : Math.floor(c.z / 16);
        for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dz));
          tasks.push({ cx:pcx + dx, cz:pcz + dz, dist });
        }
      }
      tasks.sort((a, b) => a.dist - b.dist);
      const seen = new Set();
      let ops = 0;
      const maxOps = 3; // small per-frame budget; it fills in naturally as clients explore.
      for (let i = 0; i < tasks.length && ops < maxOps; i++) {
        const n = tasks[(i + (this.clientChunkLoadCursor || 0)) % tasks.length];
        const k = World.key(n.cx, n.cz);
        if (seen.has(k)) continue;
        seen.add(k);
        if (!World.chunks.has(k)) {
          World.genChunk(n.cx, n.cz);
          ops++;
          continue;
        }
        const ch = World.chunks.get(k);
        if (ch && !ch.light) {
          // Lighting needs cardinal neighbor chunks to avoid edge-dark/edge-bright artifacts.
          let ok = true;
          for (const [ox, oz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            if (!World.chunks.has(World.key(n.cx + ox, n.cz + oz))) { ok = false; break; }
          }
          if (ok) {
            World.computeChunkLight(ch);
            if (World.borderPush) World.borderPush(ch);
            ops++;
          }
        }
      }
      this.clientChunkLoadCursor = (this.clientChunkLoadCursor + Math.max(1, ops || 1)) % Math.max(1, tasks.length);
    },

    predictClientMountedVehicle(v, dt) {
      if (!v || !v.body || typeof Vehicles === 'undefined' || typeof Physics === 'undefined' || typeof Player === 'undefined') return false;
      const b = v.body;
      if (typeof World !== 'undefined' && World.hasChunk && !World.hasChunk(Math.floor(b.x), Math.floor(b.z))) return false;
      const keys = Player.keys || {};
      const isBoat = v.kind === 'boat';
      const inWater = Physics.inWater(b, 0.25);
      const inLava = Physics.inLava(b, 0.25);
      const goodBoatFluid = isBoat && (v.lavaBoat ? inLava : inWater);
      const wrongBoatFluid = isBoat && (v.lavaBoat ? inWater : inLava);

      const profile = Vehicles.vehicleDriveProfile ? Vehicles.vehicleDriveProfile(v, isBoat, goodBoatFluid) : null;
      const isSuper = v.kind === 'supercar';
      const isPlane = v.kind === 'plane';
      const maxF = profile ? profile.maxF : isBoat ? (goodBoatFluid ? (v.lavaBoat ? 8.4 : 9.5) : 1.5) : (isPlane ? 46.0 : isSuper ? 23.0 : 11.5);
      const reverseMax = profile ? profile.reverseMax : isBoat ? -4.5 : (isPlane ? -5.5 : isSuper ? -7.0 : -4.5);
      const accel = keys.KeyW ? (profile ? profile.accel : isBoat ? 10 : (isPlane ? 56 : isSuper ? 28 : 14)) : 0;
      const brake = keys.KeyS ? (profile ? profile.brake : isBoat ? 8 : (isPlane ? 34 : isSuper ? 24 : 16)) : 0;
      v.speed = finite(v.speed, 0) + (accel - brake) * (dt || 0);
      v.speed = clamp(v.speed, reverseMax, maxF);
      if (!accel && !brake) v.speed *= (b.onGround || inWater || inLava ? (profile ? profile.idleDrag : (isPlane ? 0.995 : isSuper ? 0.99 : 0.985)) : 0.999);
      const steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
      v.yaw = finite(v.yaw, 0) + steer * (dt || 0) * (profile ? profile.steerRate : isPlane ? 1.55 : isSuper ? 2.15 : 1.9) * clamp(v.speed / 5, -1, 1);

      b.vx = Math.sin(v.yaw + Math.PI) * -v.speed;
      b.vz = Math.cos(v.yaw + Math.PI) * -v.speed;
      if (isBoat && goodBoatFluid) {
        b.vy += (v.lavaBoat ? 15 : 18) * (dt || 0);
        b.vy = Math.min(b.vy, v.lavaBoat ? 1.8 : 2.2);
        const headId = World.getBlock(Math.floor(b.x), Math.floor(b.y + 0.7), Math.floor(b.z));
        if (v.lavaBoat ? !isLava(headId) : !isWater(headId)) b.vy = Math.min(b.vy, 0);
        b.vy -= (v.lavaBoat ? 7.5 : 9) * (dt || 0);
      } else if (isPlane && Vehicles.applyPlaneFlight) {
        Vehicles.applyPlaneFlight(v, dt || 0, true, inWater, inLava, keys);
      } else {
        if (inWater || inLava) {
          v.speed *= wrongBoatFluid ? 0.88 : 0.94;
          if (isBoat && wrongBoatFluid) b.vy -= ((keys.ShiftLeft || keys.ShiftRight) ? 20 : 8) * (dt || 0);
          else if (inWater) b.vy += 6 * (dt || 0);
        }
        b.vy -= Physics.GRAV * (dt || 0);
      }
      b.vy = isPlane ? Math.max(-36, Math.min(22, b.vy)) : Math.max(b.vy, -36);
      Physics.move(b, dt || 0, { stepUp:true, stepLift:isBoat ? 0.55 : isPlane ? 0.65 : 1.06 });
      v.wheelSpin = finite(v.wheelSpin, 0) + finite(v.speed, 0) * (dt || 0) * 3;
      return true;
    },

    reconcileClientVehicle(v, dt) {
      if (!v || !v.mpTarget) return;
      const t = v.mpTarget, b = v.body || v;
      const tx = finite(t.x, b.x), ty = finite(t.y, b.y), tz = finite(t.z, b.z);
      const err = Math.hypot(tx - b.x, ty - b.y, tz - b.z);
      if (err > 5.0) {
        b.x = tx; b.y = ty; b.z = tz;
        b.vx = finite(t.vx, b.vx || 0); b.vy = finite(t.vy, b.vy || 0); b.vz = finite(t.vz, b.vz || 0);
        v.yaw = finite(t.yaw, v.yaw || 0); v.speed = finite(t.speed, v.speed || 0);
      } else {
        const a = Math.min(0.22, Math.max(0.04, err * 0.035 + (dt || 0) * 1.2));
        b.x += (tx - b.x) * a;
        b.y += (ty - b.y) * a;
        b.z += (tz - b.z) * a;
        b.vx += (finite(t.vx, b.vx || 0) - (b.vx || 0)) * 0.12;
        b.vy += (finite(t.vy, b.vy || 0) - (b.vy || 0)) * 0.12;
        b.vz += (finite(t.vz, b.vz || 0) - (b.vz || 0)) * 0.12;
        v.yaw = lerpAngle(finite(v.yaw, 0), finite(t.yaw, v.yaw || 0), 0.10);
        v.speed += (finite(t.speed, v.speed || 0) - finite(v.speed, 0)) * 0.12;
      }
      v.hp = finite(t.hp, v.hp || 1);
      v.mpLightRGB = Array.isArray(t.lightRGB) ? t.lightRGB.slice(0, 3) : v.mpLightRGB;
      v.mpLight = Number.isFinite(+t.light) ? +t.light : v.mpLight;
    },

    clientVehicleVisualTick(dt) {
      if (typeof Vehicles === 'undefined') return;
      const riding = this.clientMountedVehicleId ? this.findVehicleById(this.clientMountedVehicleId) : null;
      const interp = Math.min(1, 14 * (dt || 0));
      for (const v of this.allVehicles()) {
        if (!v) continue;
        const t = v.mpTarget;
        const body = v.body || v;
        const isSelfRidden = !!(riding && v === riding);
        if (isSelfRidden && v.body) {
          this.predictClientMountedVehicle(v, dt || 0);
          this.reconcileClientVehicle(v, dt || 0);
        } else if (t) {
          body.x += (finite(t.x, body.x) - body.x) * interp;
          body.y += (finite(t.y, body.y) - body.y) * interp;
          body.z += (finite(t.z, body.z) - body.z) * interp;
          body.vx = finite(t.vx, body.vx || 0); body.vy = finite(t.vy, body.vy || 0); body.vz = finite(t.vz, body.vz || 0);
          v.yaw = lerpAngle(finite(v.yaw, 0), finite(t.yaw, v.yaw || 0), interp);
          v.speed = finite(t.speed, v.speed || 0);
          v.wheelSpin = finite(t.wheelSpin, v.wheelSpin || 0) || ((v.wheelSpin || 0) + (v.speed || 0) * (dt || 0) * 3);
          v.mpLightRGB = Array.isArray(t.lightRGB) ? t.lightRGB.slice(0, 3) : v.mpLightRGB;
          v.mpLight = Number.isFinite(+t.light) ? +t.light : v.mpLight;
        }
        this.positionVehicleMesh(v);
        if (Vehicles.applyFlash) Vehicles.applyFlash(v, dt || 0);
        if (Array.isArray(v.mpLightRGB)) this.applyVoxelLightToObject(v.group || v.mesh, v.mpLightRGB, 'vehicleBaseCol');
        else if (Number.isFinite(+v.mpLight)) this.applyVoxelLightToObject(v.group || v.mesh, v.mpLight, 'vehicleBaseCol');
        else if (Vehicles.tintVehicle) Vehicles.tintVehicle(v, dt || 0);
      }
      if (riding) {
        const b = riding.body || riding;
        Player.body.x = b.x;
        Player.body.y = b.y + (Vehicles.riderYOffset ? Vehicles.riderYOffset(riding) : (riding.kind === 'boat' ? 0.25 : riding.kind === 'board' ? 0.08 : 0.35));
        Player.body.z = b.z;
        Player.body.vx = Player.body.vy = Player.body.vz = 0;
        Player.fallDist = 0;
        if (riding.kind === 'boat') { Vehicles.boating = riding; Vehicles.driving = null; Player.boarding = false; }
        else if (riding.kind === 'board') { Vehicles.driving = null; Vehicles.boating = null; Player.boarding = true; }
        else { Vehicles.driving = riding; Vehicles.boating = null; Player.boarding = false; }
      }
      if (typeof UI !== 'undefined' && UI.setVehicleHud) UI.setVehicleHud(riding ? (Vehicles.vehicleHudLabel ? Vehicles.vehicleHudLabel(riding) : Math.max(0, Math.ceil(riding.hp || 0)) + ' HP') : null);
    },
  });

  // Send host-computed light with live entities. Clients use this when their local
  // chunk light is missing or different, so mobs/drops/vehicles no longer glow or
  // darken differently per machine.
  const oldSerializeMob = MP.serializeMobsLive ? MP.serializeMobsLive.bind(MP) : null;
  MP.serializeMobsLive = function(){
    const list = oldSerializeMob ? oldSerializeMob() : [];
    if (typeof Mobs === 'undefined') return list;
    for (const s of list) {
      const m = s && s.mid ? this.findMobById(s.mid) : null;
      if (m && m.body) {
        s.lightRGB = this.entityVoxelLightColor(m.body.x, m.body.y + (m.body.h || 1.4) * 0.55, m.body.z, 0.06).map(v => +v.toFixed(3));
        s.light = +Math.max(...s.lightRGB).toFixed(3);
      }
    }
    return list;
  };

  const oldSerializeDrops = MP.serializeDropsLive ? MP.serializeDropsLive.bind(MP) : null;
  MP.serializeDropsLive = function(){
    const list = oldSerializeDrops ? oldSerializeDrops() : [];
    if (typeof Drops === 'undefined') return list;
    for (const s of list) {
      const d = s && s.did ? Drops.list.find(x => x && x.mpId === s.did) : null;
      if (d && d.body) {
        s.lightRGB = this.entityVoxelLightColor(d.body.x, d.body.y + 0.3, d.body.z, 0.12).map(v => +v.toFixed(3));
        s.light = +Math.max(...s.lightRGB).toFixed(3);
      }
    }
    return list;
  };

  const oldSerializeVehicleObject = MP.serializeVehicleObject ? MP.serializeVehicleObject.bind(MP) : null;
  MP.serializeVehicleObject = function(v){
    const s = oldSerializeVehicleObject ? oldSerializeVehicleObject(v) : null;
    if (s && v) {
      const b = v.body || v;
      s.lightRGB = this.entityVoxelLightColor(b.x, b.y + ((v.body && v.body.h) ? v.body.h * 0.55 : 0.4), b.z, 0.06).map(v => +v.toFixed(3));
      s.light = +Math.max(...s.lightRGB).toFixed(3);
    }
    return s;
  };

  const oldApplyMobsLive = MP.applyMobsLive ? MP.applyMobsLive.bind(MP) : null;
  MP.applyMobsLive = function(list){
    if (oldApplyMobsLive) oldApplyMobsLive(list || []);
    if (typeof Mobs === 'undefined') return;
    for (const s of list || []) {
      const m = s && s.mid ? this.findMobById(s.mid) : null;
      if (m) { m.mpLightRGB = Array.isArray(s.lightRGB) ? s.lightRGB.slice(0, 3) : m.mpLightRGB; m.mpLight = Number.isFinite(+s.light) ? +s.light : m.mpLight; }
    }
  };

  const oldApplyDropsLive = MP.applyDropsLive ? MP.applyDropsLive.bind(MP) : null;
  MP.applyDropsLive = function(list){
    if (oldApplyDropsLive) oldApplyDropsLive(list || []);
    if (typeof Drops === 'undefined') return;
    for (const s of list || []) {
      const d = s && s.did ? Drops.list.find(x => x && x.mpId === s.did) : null;
      if (d) { d.mpLightRGB = Array.isArray(s.lightRGB) ? s.lightRGB.slice(0, 3) : d.mpLightRGB; d.mpLight = Number.isFinite(+s.light) ? +s.light : d.mpLight; }
    }
  };

  const oldApplyVehiclesLive = MP.applyVehiclesLive ? MP.applyVehiclesLive.bind(MP) : null;
  MP.applyVehiclesLive = function(msg){
    if (oldApplyVehiclesLive) oldApplyVehiclesLive(msg || {});
    const states = [...((msg && msg.cars) || []), ...((msg && msg.boats) || []), ...((msg && msg.boards) || [])];
    for (const s of states) {
      const v = s && s.vid ? this.findVehicleById(s.vid) : null;
      if (v) { v.mpLightRGB = Array.isArray(s.lightRGB) ? s.lightRGB.slice(0, 3) : v.mpLightRGB; v.mpLight = Number.isFinite(+s.light) ? +s.light : v.mpLight; }
    }
  };

  const oldMobVisual = MP.clientMobVisualTick ? MP.clientMobVisualTick.bind(MP) : function(){};
  MP.clientMobVisualTick = function(dt){
    oldMobVisual(dt || 0);
    if (typeof Mobs === 'undefined') return;
    for (const m of Mobs.list || []) {
      if (!m || !m.group) continue;
      const light = Array.isArray(m.mpLightRGB) ? m.mpLightRGB : (Number.isFinite(+m.mpLight) ? +m.mpLight : (m.body ? this.entityVoxelLightColor(m.body.x, m.body.y + (m.body.h || 1.4) * 0.55, m.body.z, 0.06) : [1, 1, 1]));
      this.applyVoxelLightToObject(m.group, light, 'mobBaseCol');
    }
  };

  const oldDropVisual = MP.clientDropVisualTick ? MP.clientDropVisualTick.bind(MP) : function(){};
  MP.clientDropVisualTick = function(dt){
    oldDropVisual(dt || 0);
    if (typeof Drops === 'undefined') return;
    for (const d of Drops.list || []) {
      if (!d || !d.mesh) continue;
      const light = Array.isArray(d.mpLightRGB) ? d.mpLightRGB : (Number.isFinite(+d.mpLight) ? +d.mpLight : (d.body ? this.entityVoxelLightColor(d.body.x, d.body.y + 0.3, d.body.z, 0.12) : [1, 1, 1]));
      this.applyVoxelLightToObject(d.mesh, light, 'dropBaseCol');
    }
  };

  // If a guest rides a skateboard, the host tracks the board entity to that guest's
  // authoritative player-state instead of leaving it frozen where it was mounted.
  const oldHostApplyVehicleInput = MP.hostApplyVehicleInput ? MP.hostApplyVehicleInput.bind(MP) : null;
  MP.hostApplyVehicleInput = function(pid, msg){
    if (oldHostApplyVehicleInput) oldHostApplyVehicleInput(pid, msg);
    const v = msg && msg.vid ? this.findVehicleById(msg.vid) : null;
    if (v && v.kind === 'board' && !v.body && v.mpRider === pid) {
      const st = this.remotePeerState ? this.remotePeerState(pid) : null;
      if (st) {
        v.x = finite(st.x, v.x); v.y = finite(st.y, v.y); v.z = finite(st.z, v.z);
        v.yaw = finite(msg.yaw, finite(st.yaw, v.yaw || 0)) + Math.PI;
        this.positionVehicleMesh(v);
      }
    }
  };

  const oldFullSyncUpdate = MP.fullSyncUpdate ? MP.fullSyncUpdate.bind(MP) : function(){};
  MP.fullSyncUpdate = function(dt){
    oldFullSyncUpdate(dt || 0);
    if (this.role === 'host') this.ensureHostChunksAroundClients(dt || 0);
  };
})();

// ============================================================
// Multiplayer host simulation radius polish.
// Mobs should not despawn just because they are far from the host if they are
// close to a client, and remote clients should also get natural spawn checks.
// ============================================================
(function installFloopRemotePlayerSimulationRadiusPatch(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__remotePlayerSimulationRadiusPatchInstalled) return;
  Multiplayer.__remotePlayerSimulationRadiusPatchInstalled = true;
  const MP = Multiplayer;
  const finite = (v, fallback) => Number.isFinite(+v) ? +v : fallback;

  Object.assign(MP, {
    remoteSpawnCursor: 0,
    remoteSpawnT: 0,

    isEntityNearAnyPlayer(x, y, z, range) {
      const r = Number.isFinite(+range) ? +range : 80;
      if (typeof Player !== 'undefined' && Player.body) {
        if (Math.hypot(finite(x,0) - Player.body.x, finite(z,0) - Player.body.z) <= r) return true;
      }
      if (this.role === 'host' && this.peers) {
        const currentDim = (typeof Dimensions !== 'undefined') ? Dimensions.current : 'overworld';
        for (const peer of this.peers.values()) {
          const st = peer && (peer.target || peer.state);
          if (!st || st.dead) continue;
          if (st.dim && st.dim !== currentDim) continue;
          if (Math.hypot(finite(x,0) - finite(st.x,0), finite(z,0) - finite(st.z,0)) <= r) return true;
        }
      }
      return false;
    },

    hostSpawnAroundRemoteClients(dt) {
      if (this.role !== 'host' || typeof Mobs === 'undefined' || typeof Player === 'undefined' || !Mobs.spawnTick) return;
      const centers = this.hostRemoteChunkCenters ? this.hostRemoteChunkCenters() : [];
      if (!centers.length) return;
      this.remoteSpawnT = (this.remoteSpawnT || 0) - (dt || 0);
      if (this.remoteSpawnT > 0) return;
      this.remoteSpawnT = 1.6;
      const c = centers[this.remoteSpawnCursor % centers.length];
      this.remoteSpawnCursor = (this.remoteSpawnCursor + 1) % centers.length;
      if (!c || !World.hasChunk(Math.floor(c.x), Math.floor(c.z))) return;
      const realBody = Player.body;
      const oldTimer = Mobs.spawnTimer;
      try {
        // Reuse the native spawn rules, but run them centered on the guest.
        Player.body = Object.assign({}, realBody, { x: c.x, z: c.z });
        Mobs.spawnTimer = 0;
        Mobs.spawnTick(2.0);
      } finally {
        Player.body = realBody;
        Mobs.spawnTimer = oldTimer;
      }
    },
  });

  const oldFullSyncUpdate = MP.fullSyncUpdate ? MP.fullSyncUpdate.bind(MP) : function(){};
  MP.fullSyncUpdate = function(dt){
    oldFullSyncUpdate(dt || 0);
    if (this.role === 'host') this.hostSpawnAroundRemoteClients(dt || 0);
  };
})();

// Final drop lighting override: do the normal client drop interpolation/pickup checks,
// but do NOT apply local chunk lighting before host-synced lighting. This prevents
// double-tinting when a client is missing the host's chunk light data.
(function installFloopFinalDropLightOverride(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__finalDropLightOverrideInstalled) return;
  Multiplayer.__finalDropLightOverrideInstalled = true;
  const MP = Multiplayer;
  const finite = (v, fallback) => Number.isFinite(+v) ? +v : fallback;
  MP.clientDropVisualTick = function(dt){
    if (typeof Drops === 'undefined' || typeof Player === 'undefined') return;
    const p = Player.body;
    const now = performance.now();
    const a = Math.min(1, 12 * (dt || 0));
    for (const d of Drops.list || []) {
      if (!d || !d.body) continue;
      if (d.mpTarget) {
        const t = d.mpTarget, b = d.body;
        b.x += (finite(t.x, b.x) - b.x) * a;
        b.y += (finite(t.y, b.y) - b.y) * a;
        b.z += (finite(t.z, b.z) - b.z) * a;
        b.vx = finite(t.vx, b.vx || 0); b.vy = finite(t.vy, b.vy || 0); b.vz = finite(t.vz, b.vz || 0);
      }
      d.age = (d.age || 0) + (dt || 0);
      d.spin = (d.spin || 0) + (dt || 0) * 2.5;
      const b = d.body;
      const bob = Math.sin((d.age || 0) * 3) * 0.04;
      if (d.mesh) {
        d.mesh.position.set(b.x, b.y + 0.18 + bob, b.z);
        if (d.mesh.isMesh) d.mesh.rotation.y = d.spin;
        d.mesh.traverse ? d.mesh.traverse(o => {
          const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
          for (const mat of mats) if (mat && mat.color && !mat.userData.dropBaseCol) mat.userData.dropBaseCol = new THREE.Color(1,1,1);
        }) : null;
        const light = Array.isArray(d.mpLightRGB) ? d.mpLightRGB : (Number.isFinite(+d.mpLight) ? +d.mpLight : (this.entityVoxelLightColor ? this.entityVoxelLightColor(b.x, b.y + 0.3, b.z, 0.12) : [1, 1, 1]));
        if (this.applyVoxelLightToObject) this.applyVoxelLightToObject(d.mesh, light, 'dropBaseCol');
      }
      if (d.mpId && d.age >= (d.pickupDelay || 0) && !Player.dead && Player.canAccept(d.id)) {
        const dist = Math.hypot(p.x - b.x, (p.y + 0.6) - b.y, p.z - b.z);
        if (dist < 0.8 && now - (d._lastPickupAsk || 0) > 350) { d._lastPickupAsk = now; this.send({ type:'pickup_request', dropId:d.mpId }); }
      }
    }
  };
})();

// ============================================================
// Multiplayer host-authoritative inventory, container, and procedural structure sync.
// This fixes the remaining class of desyncs where clients were still inventing
// their own inventory/chest/structure state and reporting it upward afterward.
// ============================================================
(function installFloopHostInventoryContainerWorldgenAuthorityPatch(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__hostInventoryContainerWorldgenAuthorityPatchInstalled) return;
  Multiplayer.__hostInventoryContainerWorldgenAuthorityPatchInstalled = true;
  const MP = Multiplayer;
  const finite = (v, fallback) => Number.isFinite(+v) ? +v : fallback;
  const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const pack = (s) => (typeof Save !== 'undefined' && Save.packStack) ? Save.packStack(s) : (s ? [s.id, s.count || 1, s.dur].filter(v => v !== undefined && v !== null) : 0);
  const unpack = (s) => (typeof Save !== 'undefined' && Save.unpackStack) ? Save.unpackStack(s) : (!s ? null : { id:s[0], count:s[1] || 1, dur:s[2] });
  const itemId = (id) => Number.isFinite(+id) ? (+id | 0) : 0;
  const countOf = (n) => Math.max(1, Math.floor(+n || 1));
  const hasDur = (d) => Number.isFinite(+d) && +d >= 0;
  const stackMax = (id) => {
    const def = (typeof Reg !== 'undefined') ? Reg[itemId(id)] : null;
    return Math.max(1, (def && def.stack) || 64);
  };
  const cleanStack = (s) => {
    if (!s) return null;
    const id = itemId(s.id !== undefined ? s.id : (Array.isArray(s) ? s[0] : 0));
    if (!id || (typeof Reg !== 'undefined' && !Reg[id])) return null;
    const srcCount = s.count !== undefined ? s.count : (Array.isArray(s) ? s[1] : 1);
    const out = { id, count: countOf(srcCount) };
    const d = s.dur !== undefined ? s.dur : (Array.isArray(s) ? s[2] : undefined);
    if (hasDur(d)) out.dur = +d;
    const srcData = s.data !== undefined ? s.data : (Array.isArray(s) && s.length > 3 ? s[3] : undefined);
    if (srcData !== undefined) out.data = JSON.parse(JSON.stringify(srcData));
    const max = stackMax(id);
    if (max <= 1 || hasDur(out.dur)) out.count = 1;
    return out;
  };
  const cleanSlots = (slots, size) => {
    const out = new Array(size).fill(null);
    const src = Array.isArray(slots) ? slots : [];
    for (let i = 0; i < size; i++) out[i] = cleanStack(src[i]);
    return out;
  };
  // POSITIONAL: keep every stack in the exact slot the player put it. The old
  // version compacted items to the front (slot 0 = first hotbar slot), so every
  // inventory sync round-trip yanked a client's items into their hotbar. Inventory
  // in this game is positional like Minecraft; only validate/clamp each slot.
  const normalizeInvSlots = (slots, size = 36) => cleanSlots(slots, size);
  const normalizeArmorSlots = (slots) => {
    const out = new Array(5).fill(null);
    const src = Array.isArray(slots) ? slots : [];
    for (let i = 0; i < 5; i++) {
      const s = cleanStack(src[i]);
      if (s && equipmentSlotAccepts(s.id, i)) out[i] = { id:s.id, count:1, ...(hasDur(s.dur) ? { dur:+s.dur } : {}), ...(s.data ? { data:s.data } : {}) };
    }
    return out;
  };
  const snapshotHash = (snap) => {
    try { return JSON.stringify(snap); } catch(e) { return String(Math.random()); }
  };
  const addToSlots = (slots, id, count, dur) => {
    slots = normalizeInvSlots(slots || [], 36);
    id = itemId(id); count = Math.max(0, Math.floor(+count || 0));
    if (!id || count <= 0) return { slots, leftover: count };
    const max = stackMax(id);
    let left = count;
    if (!hasDur(dur) && max > 1) {
      for (let i = 0; i < 36 && left > 0; i++) {
        const s = slots[i];
        if (s && s.id === id && !hasDur(s.dur) && s.count < max) {
          const take = Math.min(max - s.count, left);
          s.count += take; left -= take;
        }
      }
    }
    for (let i = 0; i < 36 && left > 0; i++) {
      if (!slots[i]) {
        const take = (hasDur(dur) || max <= 1) ? 1 : Math.min(max, left);
        slots[i] = { id, count:take, ...(hasDur(dur) ? { dur:+dur } : {}) };
        left -= take;
      }
    }
    return { slots, leftover:left };
  };
  const removeFromSlots = (slots, id, count, dur) => {
    slots = normalizeInvSlots(slots || [], 36);
    id = itemId(id); count = Math.max(0, Math.floor(+count || 0));
    if (!id || count <= 0) return { slots, removed:0 };
    let need = count, removed = 0;
    for (let i = 35; i >= 0 && need > 0; i--) {
      const s = slots[i];
      if (!s || s.id !== id) continue;
      if (hasDur(dur) && (!hasDur(s.dur) || +s.dur !== +dur)) continue;
      const take = Math.min(s.count || 1, need);
      s.count -= take; need -= take; removed += take;
      if (s.count <= 0) slots[i] = null;
    }
    return { slots:normalizeInvSlots(slots, 36), removed };
  };
  const applyPlayerSnapshotLocal = (snap) => {
    if (!snap || typeof Player === 'undefined') return;
    Player.inv = normalizeInvSlots((snap.inv || []).map(unpack), 36);
    while (Player.inv.length < 36) Player.inv.push(null);
    Player.armor = normalizeArmorSlots((snap.armor || []).map(unpack));
    if (typeof UI !== 'undefined') {
      UI.cursor = cleanStack(unpack(snap.cursor || 0));
      UI.updateHotbar && UI.updateHotbar();
      UI.updateStats && UI.updateStats();
      UI.refreshAll && UI.refreshAll();
    }
  };
  const makeLocalSnapshot = () => {
    if (typeof Player === 'undefined') return null;
    const inv = normalizeInvSlots(Player.inv || [], 36);
    const armor = normalizeArmorSlots(Player.armor || []);
    return {
      inv: inv.map(pack),
      armor: armor.map(pack),
      cursor: (typeof UI !== 'undefined' && UI.cursor) ? pack(cleanStack(UI.cursor)) : 0,
      sel: Player.sel || 0,
    };
  };
  const decodeSnapshot = (snap) => ({
    inv: normalizeInvSlots(((snap && snap.inv) || []).map(unpack), 36),
    armor: normalizeArmorSlots(((snap && snap.armor) || []).map(unpack)),
    cursor: cleanStack(unpack(snap && snap.cursor || 0)),
    sel: Math.max(0, Math.min(8, Math.floor(+((snap && snap.sel) || 0)))),
  });
  const encodeSnapshot = (state) => ({
    inv: normalizeInvSlots((state && state.inv) || [], 36).map(pack),
    armor: normalizeArmorSlots((state && state.armor) || []).map(pack),
    cursor: (state && state.cursor) ? pack(state.cursor) : 0,
    sel: Math.max(0, Math.min(8, Math.floor(+((state && state.sel) || 0)))),
  });

  Object.assign(MP, {
    clientInventoryStates: new Map(),
    clientContainerLocks: new Map(),
    pendingWorldgenRequests: new Set(),

    hostDefaultClientInventory(pid) {
      const empty = { inv:new Array(36).fill(null), armor:new Array(5).fill(null), cursor:null, sel:0 };
      if (pid && !this.clientInventoryStates.has(pid)) this.clientInventoryStates.set(pid, empty);
      return pid ? this.clientInventoryStates.get(pid) : empty;
    },

    hostApplyClientInventoryState(pid, snap, echo = true) {
      if (this.role !== 'host' || !pid || !snap) return;
      const st = decodeSnapshot(snap);
      this.clientInventoryStates.set(pid, st);
      if (echo) this.hostSendInventorySnapshot(pid, 'server-normalize');
    },

    hostSendInventorySnapshot(pid, reason) {
      if (this.role !== 'host' || !pid) return;
      const conn = this.connections && this.connections.get(pid);
      if (!conn) return;
      const state = this.clientInventoryStates.get(pid) || this.hostDefaultClientInventory(pid);
      const snap = encodeSnapshot(state);
      const hash = snapshotHash(snap);
      const prev = state.__lastSentHash;
      if (hash === prev && reason !== 'force') return;
      state.__lastSentHash = hash;
      this.sendTo(conn, { type:'inventory_snapshot', reason:reason || 'sync', snapshot:snap });
    },

    clientQueueInventoryState(reason) {
      if (this.role !== 'client' || !this.connected) return;
      this.__clientInvDirty = true;
      this.__clientInvReason = reason || this.__clientInvReason || 'change';
    },

    clientSendInventoryState(force = false) {
      if (this.role !== 'client' || !this.connected || typeof Player === 'undefined') return;
      const t = nowMs();
      if (!force && !this.__clientInvDirty && t - (this.__lastClientInvState || 0) < 1600) return;
      if (!force && t - (this.__lastClientInvState || 0) < 120) return;
      const snap = makeLocalSnapshot();
      if (!snap) return;
      this.__lastClientInvState = t;
      this.__clientInvDirty = false;
      this.send({ type:'inventory_state', reason:this.__clientInvReason || 'periodic', snapshot:snap });
      this.__clientInvReason = '';
    },

    hostDropFromClientInventory(pid, msg) {
      if (this.role !== 'host' || !pid || !msg) return;
      if (msg.snapshot) this.hostApplyClientInventoryState(pid, msg.snapshot, false);
      const state = this.clientInventoryStates.get(pid) || this.hostDefaultClientInventory(pid);
      const id = itemId(msg.item);
      const want = Math.max(0, Math.floor(+msg.count || 0));
      if (!id || want <= 0) { this.hostSendInventorySnapshot(pid, 'bad-drop'); return; }
      const res = removeFromSlots(state.inv, id, want, hasDur(msg.dur) ? +msg.dur : undefined);
      state.inv = res.slots;
      this.clientInventoryStates.set(pid, state);
      if (res.removed > 0 && typeof Drops !== 'undefined') {
        const x = finite(msg.x, 0), y = finite(msg.y, 64), z = finite(msg.z, 0);
        const vel = Array.isArray(msg.vel) ? msg.vel.map(v => finite(v, 0)) : null;
        Drops.spawn(x, y, z, id, res.removed, vel, hasDur(msg.dur) ? +msg.dur : undefined, msg.data);
      }
      this.hostSendInventorySnapshot(pid, 'drop');
    },

    hostPickupIntoClientInventory(pid, dropId) {
      const peer = this.peers && this.peers.get(pid);
      const st = peer && (peer.target || peer.state);
      if (!st || !dropId || typeof Drops === 'undefined') return;
      const idx = Drops.list.findIndex(d => d && d.mpId === dropId);
      if (idx < 0) return;
      const d = Drops.list[idx], b = d.body;
      if (Math.hypot(finite(st.x, 0) - b.x, (finite(st.y, 0) + 0.6) - b.y, finite(st.z, 0) - b.z) > 1.45) return;
      const state = this.clientInventoryStates.get(pid) || this.hostDefaultClientInventory(pid);
      const res = addToSlots(state.inv, d.id, d.count, hasDur(d.dur) ? +d.dur : undefined);
      state.inv = res.slots;
      this.clientInventoryStates.set(pid, state);
      const taken = Math.max(0, (d.count | 0) - (res.leftover | 0));
      if (taken > 0) {
        if (res.leftover > 0) d.count = res.leftover;
        else Drops.remove(idx);
        this.hostSendInventorySnapshot(pid, 'pickup');
        const conn = this.connections && this.connections.get(pid);
        if (conn) this.sendTo(conn, { type:'pickup_pop' });
      } else this.hostSendInventorySnapshot(pid, 'full');
    },

    chestSizeForKey(key) {
      if (typeof World === 'undefined') return 27;
      const p = String(key || '').split(',').map(Number);
      const id = p.length >= 3 ? World.getBlock(p[0], p[1], p[2]) : 0;
      const slots = World.chests && World.chests.get(String(key));
      return (id === B.JELLY_CHEST || (Array.isArray(slots) && slots.length > 27)) ? 54 : 27;
    },

    hostSendChestSnapshot(pid, key, reason) {
      if (this.role !== 'host' || !pid || typeof World === 'undefined') return;
      const conn = this.connections && this.connections.get(pid);
      if (!conn || !key) return;
      key = String(key);
      const size = this.chestSizeForKey ? this.chestSizeForKey(key) : 27;
      if (!World.chests.has(key)) World.chests.set(key, new Array(size).fill(null));
      const slots = cleanSlots(World.chests.get(key), size);
      World.chests.set(key, slots);
      this.sendTo(conn, { type:'chest_snapshot', key, slots:slots.map(pack), reason:reason || 'open' });
    },

    hostApplyChestState(pid, msg) {
      if (this.role !== 'host' || !pid || !msg || !msg.key || typeof World === 'undefined') return;
      if (msg.snapshot) this.hostApplyClientInventoryState(pid, msg.snapshot, false);
      const key = String(msg.key);
      const size = this.chestSizeForKey ? this.chestSizeForKey(key) : ((msg.slots || []).length > 27 ? 54 : 27);
      const slots = cleanSlots((msg.slots || []).map(unpack), size);
      World.chests.set(key, slots);
      const p = key.split(',').map(Number);
      if (p.length >= 3 && World.dirty) World.dirty.add(World.chunkKeyForBlock ? World.chunkKeyForBlock(p[0], p[2]) : World.key(Math.floor(p[0] / 16), Math.floor(p[2] / 16)));
      this.hostSendInventorySnapshot(pid, 'chest');
      const out = { type:'chest_snapshot', key, slots:slots.map(pack), reason:'update' };
      for (const [otherId, conn] of this.connections || []) {
        // Send to everyone; open clients update instantly, closed clients get canonical data too.
        this.sendTo(conn, out);
      }
    },

    clientApplyChestSnapshot(msg) {
      if (this.role !== 'client' || !msg || !msg.key || typeof World === 'undefined') return;
      const key = String(msg.key);
      const size = this.chestSizeForKey ? this.chestSizeForKey(key) : ((msg.slots || []).length > 27 ? 54 : 27);
      const slots = cleanSlots((msg.slots || []).map(unpack), size);
      World.chests.set(key, slots);
      if (typeof UI !== 'undefined' && UI.screen === 'chest' && UI.chestHit) {
        const openKey = World.pkey(UI.chestHit.bx, UI.chestHit.by, UI.chestHit.bz);
        if (openKey === key) {
          UI.activeChest = World.chests.get(key);
          UI.refreshAll && UI.refreshAll();
        }
      }
    },

    clientSendOpenChestRequest(hit) {
      if (this.role !== 'client' || !this.connected || !hit || typeof World === 'undefined') return;
      const key = World.pkey(hit.bx, hit.by, hit.bz);
      this.send({ type:'chest_open_request', key, x:Math.floor(hit.bx), y:Math.floor(hit.by), z:Math.floor(hit.bz) });
    },

    // ---- chest locking: exactly one player may have a given chest open at a time.
    // This is what stops two players (host + client, or two clients) from each taking
    // the same stack out of a naturally shared chest and duplicating it.
    chestLockMap() { return this.chestLocks || (this.chestLocks = new Map()); },
    hostAcquireChestLock(key, holder) {
      const locks = this.chestLockMap();
      const cur = locks.get(String(key));
      if (cur && cur !== holder) return false;
      locks.set(String(key), holder);
      return true;
    },
    hostReleaseChestLock(key, holder) {
      const locks = this.chestLockMap();
      if (locks.get(String(key)) === holder) locks.delete(String(key));
    },
    hostReleaseAllChestLocks(holder) {
      const locks = this.chestLockMap();
      for (const [k, h] of [...locks]) if (h === holder) locks.delete(k);
    },
    hostHandleChestOpen(pid, key) {
      if (this.role !== 'host' || !pid || !key) return;
      key = String(key);
      const p = key.split(',').map(Number);
      if (p.length >= 3 && typeof Jelly !== 'undefined' && typeof World !== 'undefined' && World.getBlock(p[0], p[1], p[2]) === B.JELLY_CHEST) {
        Jelly.onChestAccess({ x:p[0], y:p[1], z:p[2], mode:'open', actor:pid });
      }
      if (!this.hostAcquireChestLock(key, pid)) {
        const conn = this.connections && this.connections.get(pid);
        if (conn) this.sendTo(conn, { type:'chest_busy', key });
        return;
      }
      this.hostSendChestSnapshot(pid, key, 'open');
    },
    clientCloseChest(key) {
      if (this.role !== 'client' || !this.connected || !key) return;
      this.send({ type:'chest_close', key: String(key) });
    },
    clientOnChestBusy() {
      if (typeof UI !== 'undefined') {
        if (UI.screen === 'chest' && UI.close) UI.close();
        if (UI.chat) UI.chat('That chest is in use by another player.', '#ffb347');
      }
    },

    clientSendChestState(reason) {
      if (this.role !== 'client' || !this.connected || typeof UI === 'undefined' || UI.screen !== 'chest' || !UI.chestHit || typeof World === 'undefined') return;
      const key = World.pkey(UI.chestHit.bx, UI.chestHit.by, UI.chestHit.bz);
      const size = this.chestSizeForKey ? this.chestSizeForKey(key) : ((World.chests.get(key) || []).length > 27 ? 54 : 27);
      const slots = cleanSlots(World.chests.get(key) || [], size);
      World.chests.set(key, slots);
      this.send({ type:'chest_state', key, slots:slots.map(pack), snapshot:makeLocalSnapshot(), reason:reason || 'ui' });
      this.__lastChestStateSend = nowMs();
    },

    serializeDungeonForNet(dg) {
      if (!dg) return null;
      const conquered = !!(typeof World !== 'undefined' && dg.key && World.dungeonConquered && World.dungeonConquered.has(dg.key));
      const mapId = (id) => conquered && World.deactivatedDungeonBlockId ? World.deactivatedDungeonBlockId(id, dg.rank) : id;
      return {
        key: dg.key || '',
        rank: dg.rank || '',
        door: dg.door || 0,
        rooms: dg.rooms || [],
        byChunk: [...(dg.byChunk || new Map()).entries()].map(([k, arr]) => [k, (arr || []).map(c => [Math.floor(c.x), Math.floor(c.y), Math.floor(c.z), mapId(c.id)|0])]),
      };
    },

    deserializeDungeonFromNet(data) {
      if (!data) return null;
      return {
        key: data.key || '',
        rank: data.rank || '',
        door: data.door || 0,
        rooms: data.rooms || [],
        byChunk: new Map((data.byChunk || []).map(([k, arr]) => [k, (arr || []).map(c => ({ x:Math.floor(c[0]), y:Math.floor(c[1]), z:Math.floor(c[2]), id:c[3]|0 }))])),
      };
    },

    hostSendWorldgenData(pid, req) {
      if (this.role !== 'host' || !pid || !req || typeof World === 'undefined') return;
      const conn = this.connections && this.connections.get(pid);
      if (!conn) return;
      const msg = { type:'worldgen_data', structs:[], dungeons:[], chunks:[] };
      for (const s of req.structs || []) {
        const sCx = Math.floor(+s.scx), sCz = Math.floor(+s.scz);
        const key = sCx + '|' + sCz;
        const st = World.structCell(sCx, sCz);
        msg.structs.push([key, st ? { type:st.type, cx:Math.floor(st.cx), cz:Math.floor(st.cz) } : null]);
      }
      for (const d of req.dungeons || []) {
        const dCx = Math.floor(+d.dscx), dCz = Math.floor(+d.dscz);
        const key = dCx + '|' + dCz;
        const dg = World.dungeonFor(dCx, dCz);
        msg.dungeons.push([key, this.serializeDungeonForNet(dg)]);
      }
      // Optional exact chunk overlays for chunks the client is entering. This is
      // much lighter than sending every block array and fixes procedural pieces
      // that are stamped by host generation order.
      for (const c of req.chunks || []) {
        const cx = Math.floor(+c.cx), cz = Math.floor(+c.cz), ck = World.key(cx, cz);
        const overlays = [];
        // Ensure host has generated the chunk, then send only procedural/diff overrides.
        World.genChunk(cx, cz);
        const feats = World.featuresFor ? World.featuresFor(cx, cz) : [];
        for (const f of feats || []) if ((World.chunkCoord ? World.chunkCoord(f.x) : Math.floor(f.x / 16)) === cx && (World.chunkCoord ? World.chunkCoord(f.z) : Math.floor(f.z / 16)) === cz && f.y >= 0 && f.y < World.H) overlays.push([Math.floor(f.x), Math.floor(f.y), Math.floor(f.z), f.id|0]);
        const gcx0 = Math.floor(cx / 6), gcz0 = Math.floor(cz / 6);
        const seen = new Set();
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          const dkx = gcx0 + dx, dkz = gcz0 + dz, dk = dkx + '|' + dkz;
          if (seen.has(dk)) continue; seen.add(dk);
          const dg = World.dungeonFor(dkx, dkz);
          const bucket = dg && dg.byChunk && dg.byChunk.get(ck);
          const conquered = !!(dg && dg.key && World.dungeonConquered && World.dungeonConquered.has(dg.key));
          if (bucket) for (const f of bucket) overlays.push([Math.floor(f.x), Math.floor(f.y), Math.floor(f.z), (conquered && World.deactivatedDungeonBlockId ? World.deactivatedDungeonBlockId(f.id, dg.rank) : f.id)|0]);
        }
        const diffBucket = World.diffIndex && World.diffIndex.get(ck);
        if (diffBucket) for (const [pk, id] of diffBucket.entries()) {
          const p = pk.split(',').map(Number); if (p.length >= 3) overlays.push([p[0]|0, p[1]|0, p[2]|0, id|0]);
        }
        if (overlays.length) msg.chunks.push([cx, cz, overlays]);
      }
      if (msg.structs.length || msg.dungeons.length || msg.chunks.length) this.sendTo(conn, msg);
    },

    clientRequestWorldgen(kind, a, b) {
      if (this.role !== 'client' || !this.connected) return;
      const aa = Math.floor(+a), bb = Math.floor(+b);
      const key = kind + ':' + aa + ',' + bb;
      if (this.pendingWorldgenRequests.has(key)) return;
      this.pendingWorldgenRequests.add(key);
      const req = { type:'worldgen_request', structs:[], dungeons:[], chunks:[] };
      if (kind === 'struct') req.structs.push({ scx:aa, scz:bb });
      else if (kind === 'dungeon') req.dungeons.push({ dscx:aa, dscz:bb });
      else if (kind === 'chunk') req.chunks.push({ cx:aa, cz:bb });
      this.send(req);
      setTimeout(() => this.pendingWorldgenRequests.delete(key), 3000);
    },

    clientApplyWorldgenData(msg) {
      if (this.role !== 'client' || !msg || typeof World === 'undefined') return;
      this.applyingRemote = true;
      try {
        for (const [key, st] of msg.structs || []) {
          World.structCellCache.set(String(key), st ? { type:st.type, cx:Math.floor(st.cx), cz:Math.floor(st.cz) } : null);
        }
        for (const [key, data] of msg.dungeons || []) {
          World.dungeonCache.set(String(key), this.deserializeDungeonFromNet(data));
        }
        for (const [cx, cz, overlays] of msg.chunks || []) {
          const ck = World.key(Math.floor(+cx), Math.floor(+cz));
          if (World.chunks.has(ck)) {
            for (const c of overlays || []) {
              const x = Math.floor(c[0]), y = Math.floor(c[1]), z = Math.floor(c[2]), id = c[3]|0;
              if (y >= 0) World.setBlock(x, y, z, id, { remote:true, noUpdate:true, skipPortalCheck:true });
            }
          } else {
            for (const c of overlays || []) {
              const x = Math.floor(c[0]), y = Math.floor(c[1]), z = Math.floor(c[2]), id = c[3]|0;
              const pk = World.pkey(x, y, z);
              World.diffs.set(pk, id);
              const bkey = World.chunkKeyForBlock ? World.chunkKeyForBlock(x, z) : World.key(Math.floor(x / 16), Math.floor(z / 16));
              if (!World.diffIndex.has(bkey)) World.diffIndex.set(bkey, new Map());
              World.diffIndex.get(bkey).set(pk, id);
            }
          }
          if (World.dirty) World.dirty.add(ck);
        }
      } finally { this.applyingRemote = false; }
    },
  });

  // Make join initialize a server-side inventory record instead of waiting until
  // the client has already picked up/dropped items locally.
  const oldWireHostConnection = MP.wireHostConnection ? MP.wireHostConnection.bind(MP) : null;
  if (oldWireHostConnection && !MP.__hostInvWirePatch) {
    MP.__hostInvWirePatch = true;
    MP.wireHostConnection = function(conn){
      oldWireHostConnection(conn);
      // The original data handler sets conn._gameId on join_request. A short
      // delayed pass creates/sends the canonical empty inventory once that id exists.
      const timer = setInterval(() => {
        if (!conn || conn.open === false) { clearInterval(timer); return; }
        if (conn._gameId) {
          clearInterval(timer);
          this.hostDefaultClientInventory(conn._gameId);
          // Wait for the joining client to send its freshly initialized starter inventory before echoing a snapshot.
        }
      }, 120);
    };
  }

  // Patch handling last so this authority layer supersedes the older give_item /
  // client_storage_state behavior.
  const prevHandler = MP.handleFullSyncMessage ? MP.handleFullSyncMessage.bind(MP) : function(){ return false; };
  MP.handleFullSyncMessage = function(msg, fromId, cameFromClient){
    if (!msg || !msg.type) return false;
    const sender = fromId || msg.id;
    if (msg.type === 'inventory_state') { if (this.role === 'host' && cameFromClient) this.hostApplyClientInventoryState(sender, msg.snapshot, true); return true; }
    if (msg.type === 'inventory_snapshot') { if (this.role === 'client') applyPlayerSnapshotLocal(msg.snapshot); return true; }
    if (msg.type === 'inventory_drop_request') { if (this.role === 'host' && cameFromClient) this.hostDropFromClientInventory(sender, msg); return true; }
    if (msg.type === 'drop_request') {
      // Legacy clients/old hooks may still send this. Treat it as an inventory
      // drop request instead of blindly spawning free items.
      if (this.role === 'host' && cameFromClient) this.hostDropFromClientInventory(sender, msg);
      return true;
    }
    if (msg.type === 'pickup_request') { if (this.role === 'host' && cameFromClient) this.hostPickupIntoClientInventory(sender, msg.dropId); return true; }
    if (msg.type === 'give_item') { if (this.role === 'client') { applyPlayerSnapshotLocal(msg.snapshot || null); if (!msg.snapshot && this.clientReceiveItem) this.clientReceiveItem(msg); } return true; }
    if (msg.type === 'pickup_pop') { if (this.role === 'client' && typeof SFX !== 'undefined') SFX.pop(); return true; }
    if (msg.type === 'chest_open_request') { if (this.role === 'host' && cameFromClient) this.hostHandleChestOpen(sender, msg.key); return true; }
    if (msg.type === 'chest_close') { if (this.role === 'host' && cameFromClient) this.hostReleaseChestLock(msg.key, sender); return true; }
    if (msg.type === 'chest_busy') { if (this.role === 'client') this.clientOnChestBusy(); return true; }
    if (msg.type === 'chest_state') { if (this.role === 'host' && cameFromClient) { if (this.chestLockMap().get(String(msg.key)) === sender) this.hostApplyChestState(sender, msg); } return true; }
    if (msg.type === 'chest_snapshot') { if (this.role === 'client') this.clientApplyChestSnapshot(msg); return true; }
    if (msg.type === 'client_storage_state') {
      // Old patch sent chest data from client -> host. Keep it from silently
      // becoming truth without normalization/broadcast.
      if (this.role === 'host' && cameFromClient && msg.chest) this.hostApplyChestState(sender, { key:msg.chest.key, slots:msg.chest.slots, snapshot:null, reason:'legacy-storage' });
      return true;
    }
    if (msg.type === 'worldgen_request') { if (this.role === 'host' && cameFromClient) this.hostSendWorldgenData(sender, msg); return true; }
    if (msg.type === 'worldgen_data') { if (this.role === 'client') this.clientApplyWorldgenData(msg); return true; }
    return prevHandler(msg, fromId, cameFromClient);
  };

  // Override remote pickup once more so the host updates its canonical inventory
  // instead of sending a loose give_item packet.
  MP.hostHandlePickup = function(pid, dropId){ this.hostPickupIntoClientInventory(pid, dropId); };

  // Clients never create authoritative drops locally. Every player drop includes
  // the current inventory snapshot so the host removes from canonical slots first.
  if (typeof Drops !== 'undefined' && Drops.spawn && !Drops.__mpHostInventoryDropOverride) {
    Drops.__mpHostInventoryDropOverride = true;
    const priorSpawn = Drops.spawn.bind(Drops);
    Drops.spawn = function(x, y, z, id, count, vel, dur, data){
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && Multiplayer.connected && !Multiplayer.applyingRemoteState && !Multiplayer.applyingRemote) {
        Multiplayer.send({ type:'inventory_drop_request', x:+x, y:+y, z:+z, item:itemId(id), count:Math.max(1, Math.floor(+count || 1)), vel:vel || null, dur:hasDur(dur) ? +dur : undefined, data, snapshot:makeLocalSnapshot() });
        Multiplayer.clientQueueInventoryState('drop');
        return null;
      }
      return priorSpawn(x, y, z, id, count, vel, hasDur(dur) ? +dur : undefined, data);
    };
  }

  // Keep host informed when the guest rearranges slots/cursor. The host still
  // normalizes and echoes the canonical version back down.
  if (typeof UI !== 'undefined' && !UI.__mpHostInventoryUiPatch) {
    UI.__mpHostInventoryUiPatch = true;
    const oldSlotClick = UI.slotClick ? UI.slotClick.bind(UI) : null;
    if (oldSlotClick) UI.slotClick = function(get, set, button, shift, opts){
      const ret = oldSlotClick(get, set, button, shift, opts);
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client') {
        Multiplayer.clientQueueInventoryState('slot');
        if (this.screen === 'chest') Multiplayer.clientSendChestState('slot');
      }
      return ret;
    };
    const oldDragDeposit = UI.dragDeposit ? UI.dragDeposit.bind(UI) : null;
    if (oldDragDeposit) UI.dragDeposit = function(get, set, opts, el){
      const ret = oldDragDeposit(get, set, opts, el);
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client') {
        Multiplayer.clientQueueInventoryState('drag');
        if (this.screen === 'chest') Multiplayer.clientSendChestState('drag');
      }
      return ret;
    };
    const oldOpen = UI.open ? UI.open.bind(UI) : null;
    if (oldOpen) UI.open = function(name, data){
      const ret = oldOpen(name, data);
      const MPl = (typeof Multiplayer !== 'undefined') ? Multiplayer : null;
      if (MPl && MPl.connected && MPl.role !== 'solo') {
        if (MPl.role === 'client') {
          if (name === 'chest' && data) MPl.clientSendOpenChestRequest(data);
          MPl.clientQueueInventoryState('open-ui');
        } else if (MPl.role === 'host' && name === 'chest' && data && typeof World !== 'undefined') {
          // Host is its own authority: grab the lock directly. If a client already
          // holds this chest, bounce the host back out so nobody double-takes.
          const key = World.pkey(data.bx, data.by, data.bz);
          if (!MPl.hostAcquireChestLock(key, MPl.id)) {
            this.close && this.close();
            if (this.chat) this.chat('That chest is in use by another player.', '#ffb347');
          }
        }
      }
      return ret;
    };
    const oldClose = UI.close ? UI.close.bind(UI) : null;
    if (oldClose) UI.close = function(reopening){
      const wasChest = this.screen === 'chest';
      const chestKey = (wasChest && this.chestHit && typeof World !== 'undefined')
        ? World.pkey(this.chestHit.bx, this.chestHit.by, this.chestHit.bz) : null;
      const ret = oldClose(reopening);
      const MPl = (typeof Multiplayer !== 'undefined') ? Multiplayer : null;
      if (MPl && MPl.connected && MPl.role !== 'solo') {
        if (MPl.role === 'client') {
          MPl.clientQueueInventoryState('close-ui');
          if (wasChest) { MPl.clientSendInventoryState(true); if (chestKey) MPl.clientCloseChest(chestKey); }
        } else if (MPl.role === 'host' && wasChest && chestKey) {
          MPl.hostReleaseChestLock(chestKey, MPl.id);
        }
      }
      return ret;
    };
  }

  // Track inventory-affecting player helpers. These are not authority by
  // themselves; they just mark that a snapshot should be sent on the next tick.
  if (typeof Player !== 'undefined' && !Player.__mpHostInventoryPlayerPatch) {
    Player.__mpHostInventoryPlayerPatch = true;
    for (const name of ['addItem','removeItems','consumeHeld','damageHeld','swapHeldTo']) {
      if (typeof Player[name] !== 'function') continue;
      const old = Player[name].bind(Player);
      Player[name] = function(...args){
        const ret = old(...args);
        if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client') Multiplayer.clientQueueInventoryState(name);
        return ret;
      };
    }
  }

  // Clients should not independently decide procedural dungeon/surface structure
  // layouts. Unknown multiplayer structure cells return empty until the host sends
  // the canonical data, preventing duplicate/wrong dungeons from being carved.
  // When a CLIENT changes dimension, ask the host for that dimension's authoritative
  // edit-set so it's applied on top of the locally-generated terrain (and it also
  // re-requests worldgen deferral state via sameDimAsHost()).
  if (typeof Dimensions !== 'undefined' && Dimensions.switchTo && !Dimensions.__mpSwitchPatch) {
    Dimensions.__mpSwitchPatch = true;
    const oldSwitch = Dimensions.switchTo.bind(Dimensions);
    Dimensions.switchTo = function(dim, pos) {
      const ret = oldSwitch(dim, pos);
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client') {
        Multiplayer.send({ type:'req_dim', id:Multiplayer.id, dim:Dimensions.current });
      }
      return ret;
    };
  }

  if (typeof World !== 'undefined' && !World.__mpHostWorldgenPatch) {
    World.__mpHostWorldgenPatch = true;
    const oldStructCell = World.structCell ? World.structCell.bind(World) : null;
    const oldDungeonFor = World.dungeonFor ? World.dungeonFor.bind(World) : null;
    const oldGenChunk = World.genChunk ? World.genChunk.bind(World) : null;
    // Only defer worldgen to the host when we share the host's dimension. In a DIFFERENT
    // dimension the host can't supply data (its World is elsewhere), so generate locally.
    const deferToHost = () => (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client'
      && Multiplayer.connected && Multiplayer.sameDimAsHost && Multiplayer.sameDimAsHost());
    if (oldStructCell) World.structCell = function(scx, scz){
      const k = Math.floor(+scx) + '|' + Math.floor(+scz);
      if (deferToHost()) {
        if (this.structCellCache.has(k)) return this.structCellCache.get(k);
        Multiplayer.clientRequestWorldgen('struct', Math.floor(+scx), Math.floor(+scz));
        return null;
      }
      return oldStructCell(scx, scz);
    };
    if (oldDungeonFor) World.dungeonFor = function(dscx, dscz){
      const k = Math.floor(+dscx) + '|' + Math.floor(+dscz);
      if (deferToHost()) {
        if (this.dungeonCache.has(k)) return this.dungeonCache.get(k);
        Multiplayer.clientRequestWorldgen('dungeon', Math.floor(+dscx), Math.floor(+dscz));
        return null;
      }
      return oldDungeonFor(dscx, dscz);
    };
    if (oldGenChunk) World.genChunk = function(cx, cz){
      const ch = oldGenChunk(cx, cz);
      if (deferToHost()) Multiplayer.clientRequestWorldgen('chunk', Math.floor(+cx), Math.floor(+cz));
      return ch;
    };
  }

  // Final periodic sync tick: client sends dirty inventory/chest; host resends
  // canonical snapshots occasionally in case a packet was lost.
  const oldFullSyncUpdate = MP.fullSyncUpdate ? MP.fullSyncUpdate.bind(MP) : function(){};
  MP.fullSyncUpdate = function(dt){
    oldFullSyncUpdate(dt || 0);
    if (this.role === 'client' && this.connected) {
      this.clientSendInventoryState(false);
      if (typeof UI !== 'undefined' && UI.screen === 'chest' && nowMs() - (this.__lastChestStateSend || 0) > 650) this.clientSendChestState('periodic');
    }
    // NOTE: the host used to periodically push its MIRROR of each client's inventory
    // back to that client here. The client is authoritative for its own inventory, so
    // that overwrite reverted drops/pickups mid-action (dupes + items landing 1-per-slot).
    // The mirror is kept fresh the other direction (client -> host via mc_client_inventory);
    // the host must never push a full inventory snapshot back for a client's own items.
  };
})();

// ============================================================
// Minecraft-style multiplayer authority pass.
// Principle copied from Minecraft's server/client split:
//   - host is the server for inventory, containers, chunks, drops, mobs, vehicles
//   - clients send actions/slot snapshots as requests, never become final truth
//   - host sends canonical slot/chunk/entity snapshots back down
// ============================================================
(function installFloopMinecraftStyleAuthorityPatch(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__minecraftStyleAuthorityPatchInstalled) return;
  Multiplayer.__minecraftStyleAuthorityPatchInstalled = true;
  const MP = Multiplayer;
  const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const finite = (v, fallback) => Number.isFinite(+v) ? +v : fallback;
  const idOf = (v) => Number.isFinite(+v) ? (+v | 0) : 0;
  const hasDur = (v) => Number.isFinite(+v) && +v >= 0;
  const stackMax = (id) => {
    const def = (typeof Reg !== 'undefined') ? Reg[idOf(id)] : null;
    return Math.max(1, (def && def.stack) || 64);
  };
  const pack = (s) => {
    if (!s) return 0;
    const id = idOf(s.id);
    if (!id) return 0;
    const c = Math.max(1, Math.floor(+s.count || 1));
    return hasDur(s.dur) ? [id, 1, +s.dur] : [id, c];
  };
  const unpack = (v) => {
    if (!v) return null;
    if (Array.isArray(v)) {
      const id = idOf(v[0]);
      if (!id || (typeof Reg !== 'undefined' && !Reg[id])) return null;
      const s = { id, count: Math.max(1, Math.floor(+v[1] || 1)) };
      if (hasDur(v[2])) { s.dur = +v[2]; s.count = 1; }
      if (v.length > 3 && v[3] !== undefined && v[3] !== null) s.data = v[3];
      return s;
    }
    if (typeof v === 'object') {
      const id = idOf(v.id);
      if (!id || (typeof Reg !== 'undefined' && !Reg[id])) return null;
      const s = { id, count: Math.max(1, Math.floor(+v.count || 1)) };
      if (hasDur(v.dur)) { s.dur = +v.dur; s.count = 1; }
      if (v.data !== undefined && v.data !== null) s.data = v.data;
      return s;
    }
    return null;
  };
  // POSITIONAL: preserve the exact slot the player placed each stack in. This used
  // to compact/merge everything to the front, which is why a client's items snapped
  // into the hotbar every time an authoritative snapshot arrived. Inventory here is
  // positional like Minecraft — only validate and clamp each slot in place.
  const normalizeSlots = (slots, size) => {
    const out = new Array(size).fill(null);
    const src = Array.isArray(slots) ? slots : [];
    for (let i = 0; i < size; i++) {
      const s = unpack(src[i]);
      if (!s) { out[i] = null; continue; }
      const max = stackMax(s.id);
      if (max <= 1 || hasDur(s.dur)) out[i] = { id:s.id, count:1, ...(hasDur(s.dur) ? { dur:+s.dur } : {}), ...(s.data ? { data:s.data } : {}) };
      else out[i] = { id:s.id, count: Math.max(1, Math.floor(+s.count || 1)), ...(s.data ? { data:s.data } : {}) };
    }
    return out;
  };
  const normalizeArmor = (slots) => {
    const out = new Array(5).fill(null);
    const src = Array.isArray(slots) ? slots : [];
    for (let i = 0; i < 5; i++) {
      const s = unpack(src[i]);
      if (s && equipmentSlotAccepts(s.id, i)) out[i] = { id:s.id, count:1, ...(hasDur(s.dur) ? { dur:+s.dur } : {}), ...(s.data ? { data:s.data } : {}) };
    }
    return out;
  };
  const snapshotFromLocal = () => {
    if (typeof Player === 'undefined') return null;
    return {
      inv: normalizeSlots(Player.inv || [], 36).map(pack),
      armor: normalizeArmor(Player.armor || []).map(pack),
      cursor: (typeof UI !== 'undefined' && UI.cursor) ? pack(UI.cursor) : 0,
      sel: Math.max(0, Math.min(8, Math.floor(+Player.sel || 0))),
      hp: finite(Player.hp, 20), hunger: finite(Player.hunger, 20), xp: finite(Player.xp, 0), level: finite(Player.level, 0),
    };
  };
  const stateFromSnapshot = (snap) => ({
    inv: normalizeSlots(((snap && snap.inv) || []).map(unpack), 36),
    armor: normalizeArmor(((snap && snap.armor) || []).map(unpack)),
    cursor: unpack(snap && snap.cursor || 0),
    sel: Math.max(0, Math.min(8, Math.floor(+((snap && snap.sel) || 0)))),
    hp: finite(snap && snap.hp, 20), hunger: finite(snap && snap.hunger, 20), xp: finite(snap && snap.xp, 0), level: finite(snap && snap.level, 0),
  });
  const snapshotFromState = (st) => ({
    inv: normalizeSlots((st && st.inv) || [], 36).map(pack),
    armor: normalizeArmor((st && st.armor) || []).map(pack),
    cursor: st && st.cursor ? pack(st.cursor) : 0,
    sel: Math.max(0, Math.min(8, Math.floor(+((st && st.sel) || 0)))),
    hp: finite(st && st.hp, 20), hunger: finite(st && st.hunger, 20), xp: finite(st && st.xp, 0), level: finite(st && st.level, 0),
  });
  const applyLocalSnapshot = (snap) => {
    if (typeof Player === 'undefined' || !snap) return;
    const st = stateFromSnapshot(snap);
    Multiplayer.__applyingAuthoritativeInventory = true;
    try {
      Player.inv = normalizeSlots(st.inv, 36);
      Player.armor = normalizeArmor(st.armor);
      Player.sel = st.sel;
      if (Number.isFinite(+st.hp)) Player.hp = +st.hp;
      if (Number.isFinite(+st.hunger)) Player.hunger = +st.hunger;
      if (Number.isFinite(+st.xp)) Player.xp = +st.xp;
      if (Number.isFinite(+st.level)) Player.level = +st.level;
      if (typeof UI !== 'undefined') {
        UI.cursor = st.cursor || null;
        UI.updateHotbar && UI.updateHotbar();
        UI.updateStats && UI.updateStats();
        UI.updateXp && UI.updateXp();
        UI.refreshAll && UI.refreshAll();
      }
    } finally { Multiplayer.__applyingAuthoritativeInventory = false; }
  };
  const addToStateInventory = (st, id, count, dur) => {
    st.inv = normalizeSlots(st.inv || [], 36);
    id = idOf(id); count = Math.max(0, Math.floor(+count || 0));
    if (!id || count <= 0) return count;
    const max = stackMax(id);
    let left = count;
    if (!hasDur(dur) && max > 1) {
      for (let i = 0; i < 36 && left > 0; i++) {
        const s = st.inv[i];
        if (s && s.id === id && !hasDur(s.dur) && s.count < max) {
          const take = Math.min(max - s.count, left);
          s.count += take; left -= take;
        }
      }
    }
    for (let i = 0; i < 36 && left > 0; i++) {
      if (!st.inv[i]) {
        const take = (hasDur(dur) || max <= 1) ? 1 : Math.min(max, left);
        st.inv[i] = { id, count:take, ...(hasDur(dur) ? { dur:+dur } : {}) };
        left -= take;
      }
    }
    st.inv = normalizeSlots(st.inv, 36);
    return left;
  };
  const removeFromStateInventory = (st, id, count, dur) => {
    st.inv = normalizeSlots(st.inv || [], 36);
    id = idOf(id); count = Math.max(0, Math.floor(+count || 0));
    if (!id || count <= 0) return 0;
    let need = count, removed = 0;
    for (let i = 35; i >= 0 && need > 0; i--) {
      const s = st.inv[i];
      if (!s || s.id !== id) continue;
      if (hasDur(dur) && (!hasDur(s.dur) || +s.dur !== +dur)) continue;
      const take = Math.min(Math.max(1, s.count || 1), need);
      s.count -= take; need -= take; removed += take;
      if (s.count <= 0) st.inv[i] = null;
    }
    st.inv = normalizeSlots(st.inv, 36);
    return removed;
  };
  const clientMayAuthorInventory = (reason) => {
    reason = String(reason || '').toLowerCase();
    return /^(init|join|slot|drag|open|close|ui|manual|chest|craft|cursor)/.test(reason);
  };

  Object.assign(MP, {
    mcPlayerStates: MP.mcPlayerStates || new Map(),
    mcChunkRequests: MP.mcChunkRequests || new Set(),
    mcLastChunkSend: MP.mcLastChunkSend || new Map(),

    mcGetPlayerState(pid) {
      if (!pid) return null;
      if (!this.mcPlayerStates.has(pid)) this.mcPlayerStates.set(pid, { inv:new Array(36).fill(null), armor:new Array(5).fill(null), cursor:null, sel:0, hp:20, hunger:20, xp:0, level:0 });
      return this.mcPlayerStates.get(pid);
    },

    mcAcceptClientInventory(pid, snap, reason) {
      if (this.role !== 'host' || !pid || !snap) return;
      const exists = this.mcPlayerStates.has(pid);
      // Minecraft-style rule: normal gameplay rewards are NOT accepted from the client.
      // We only accept the spawn snapshot once and deliberate UI/container slot moves.
      if (!exists || clientMayAuthorInventory(reason)) {
        this.mcPlayerStates.set(pid, stateFromSnapshot(snap));
      }
      this.mcSendPlayerInventory(pid, 'server-canonical-' + (reason || 'sync'));
    },

    mcSendPlayerInventory(pid, reason) {
      // DISABLED: the host must never overwrite a client's OWN inventory with a full
      // snapshot of its mirror. The client is authoritative for its inventory — every
      // caller of this (periodic flush, post-drop, post-pickup, post-chest-edit) was
      // reverting the client's just-made change and duplicating/splitting items.
      // Host-initiated gains are delivered additively via give_item instead; the mirror
      // is refreshed the other direction by the client's mc_client_inventory sync.
      return;
    },

    mcPickupDropForClient(pid, dropId) {
      if (this.role !== 'host' || !pid || !dropId || typeof Drops === 'undefined') return;
      const peer = this.peers && this.peers.get(pid);
      const ps = peer && (peer.target || peer.state);
      if (!ps) return;
      const idx = Drops.list.findIndex(d => d && d.mpId === dropId);
      if (idx < 0) return;
      const d = Drops.list[idx], b = d.body;
      if (!b || Math.hypot(finite(ps.x,0) - b.x, (finite(ps.y,0) + 0.6) - b.y, finite(ps.z,0) - b.z) > 1.6) return;
      const id = idOf(d.id);
      const count = Math.max(1, d.count | 0);
      const dur = hasDur(d.dur) ? +d.dur : undefined;
      // Consume the whole drop authoritatively (removal syncs to everyone via the drop broadcast).
      Drops.remove(idx);
      // Update our mirror best-effort for host-side bookkeeping (never echoed as a full snapshot).
      const st = this.mcGetPlayerState(pid);
      if (st) addToStateInventory(st, id, count, dur);
      // Grant ADDITIVELY: the client stacks it into its own slots and re-drops any overflow.
      // Sending a full inventory_snapshot here double-counted the stack whenever the host mirror
      // was stale from a no-snapshot drop_request — that was the drop-and-pickup duplication.
      const conn = this.connections && this.connections.get(pid);
      if (conn) {
        this.sendTo(conn, { type:'give_item', item:id, count, ...(dur !== undefined ? { dur } : {}), ...(d.data !== undefined ? { data:d.data } : {}) });
        this.sendTo(conn, { type:'pickup_pop' });
      }
    },

    requestVehiclePickup(v) {
      if (this.role !== 'client' || !this.connected || !v) return false;
      if (this.ensureVehicleId) this.ensureVehicleId(v);
      if (!v.mpId) return false;
      if (v.mpRider && v.mpRider !== this.id) {
        if (typeof UI !== 'undefined') UI.chat('That vehicle is occupied.', '#ffb347');
        return false;
      }
      this.send({ type:'vehicle_pickup_request', vid:v.mpId });
      if (typeof UI !== 'undefined') UI.chat('Vehicle pickup requested...', '#aaa');
      return true;
    },

    hostHandleVehiclePickup(pid, msg) {
      if (this.role !== 'host' || !pid || !msg || typeof Vehicles === 'undefined') return;
      const v = this.findVehicleById ? this.findVehicleById(msg.vid) : null;
      if (!v || (v.mpRider && v.mpRider !== pid)) return;
      const peer = this.peers && this.peers.get(pid);
      const ps = peer && (peer.target || peer.state);
      if (!ps) return;
      const b = v.body || v;
      if (Math.hypot(finite(ps.x, 0) - b.x, (finite(ps.y, 0) + 0.8) - (b.y + 0.5), finite(ps.z, 0) - b.z) > 5.2) return;
      const item = idOf(v.item);
      if (!item) return;
      if (v.mpRider === pid) v.mpRider = '';
      if (this.clientMountedVehicleId === v.mpId) this.clientMountedVehicleId = null;
      Vehicles.remove(v);
      const st = this.mcGetPlayerState(pid);
      if (st) addToStateInventory(st, item, 1);
      const conn = this.connections && this.connections.get(pid);
      if (conn) {
        this.sendTo(conn, { type:'give_item', item, count:1 });
        this.sendTo(conn, { type:'vehicle_pickup_apply', vid:msg.vid, by:pid });
      }
      if (this.broadcast) this.broadcast({ type:'vehicle_pickup_apply', vid:msg.vid, by:pid }, pid);
    },

    mcDropFromClient(pid, msg) {
      if (this.role !== 'host' || !pid || !msg) return;
      const st = this.mcGetPlayerState(pid);
      // A drop packet carries the pre-drop slot snapshot. Accept it only as a UI/drop intent,
      // then remove the requested items from the host's normalized slots.
      if (msg.snapshot) this.mcAcceptClientInventory(pid, msg.snapshot, 'ui-drop-prestate');
      const live = this.mcGetPlayerState(pid);
      const id = idOf(msg.item);
      const want = Math.max(0, Math.floor(+msg.count || 0));
      if (!id || want <= 0) { this.mcSendPlayerInventory(pid, 'bad-drop'); return; }
      const removed = removeFromStateInventory(live, id, want, hasDur(msg.dur) ? +msg.dur : undefined);
      if (removed > 0 && typeof Drops !== 'undefined') {
        const vel = Array.isArray(msg.vel) ? msg.vel.map(v => finite(v, 0)) : null;
        Drops.spawn(finite(msg.x, 0), finite(msg.y, 64), finite(msg.z, 0), id, removed, vel, hasDur(msg.dur) ? +msg.dur : undefined, msg.data);
      }
      this.mcSendPlayerInventory(pid, 'drop');
    },

    mcSendClientInventory(reason, force) {
      if (this.role !== 'client' || !this.connected) return;
      const snap = snapshotFromLocal();
      if (!snap) return;
      const hash = JSON.stringify(snap) + '|' + String(reason || '');
      if (!force && this.__lastMcInvHash === hash && nowMs() - (this.__lastMcInvSent || 0) < 350) return;
      this.__lastMcInvHash = hash;
      this.__lastMcInvSent = nowMs();
      this.send({ type:'mc_client_inventory', reason:reason || 'ui', snapshot:snap });
    },

    // Full chunk snapshots: Minecraft sends authoritative chunk data to the client.
    // We do the same with light-weight RLE over the 16x16xH block array.
    mcEncodeBlocks(blocks) {
      const out = [];
      if (!blocks || !blocks.length) return out;
      let last = blocks[0] | 0, n = 1;
      for (let i = 1; i < blocks.length; i++) {
        const v = blocks[i] | 0;
        if (v === last && n < 65535) n++;
        else { out.push(last, n); last = v; n = 1; }
      }
      out.push(last, n);
      return out;
    },

    mcDecodeBlocks(rle) {
      const total = (typeof World !== 'undefined' ? 16 * 16 * World.H : 20480);
      const arr = new Uint16Array(total);
      let p = 0;
      for (let i = 0; i < (rle || []).length && p < total; i += 2) {
        const id = rle[i] | 0, n = Math.max(0, Math.floor(+rle[i + 1] || 0));
        for (let j = 0; j < n && p < total; j++) arr[p++] = id;
      }
      return arr;
    },

    mcHostSendChunk(pid, cx, cz) {
      if (this.role !== 'host' || typeof World === 'undefined') return;
      const conn = this.connections && this.connections.get(pid);
      if (!conn) return;
      cx |= 0; cz |= 0;
      const key = World.key(cx, cz);
      const throttleKey = pid + ':' + key;
      const t = nowMs();
      if ((this.mcLastChunkSend.get(throttleKey) || 0) + 250 > t) return;
      this.mcLastChunkSend.set(throttleKey, t);
      const ch = World.genChunk(cx, cz);
      if (!ch || !ch.blocks) return;
      const inChunk = (k) => {
        const p = String(k).split(',').map(Number);
        return p.length >= 3 && (World.chunkCoord ? World.chunkCoord(p[0]) : Math.floor(p[0] / 16)) === cx && (World.chunkCoord ? World.chunkCoord(p[2]) : Math.floor(p[2] / 16)) === cz;
      };
      const stacks = (slots) => (slots || []).map(pack);
      const meta = {
        diffs: [...World.diffs.entries()].filter(([k]) => inChunk(k)),
        signs: [...World.signs.entries()].filter(([k]) => inChunk(k)),
        signDirs: [...World.signDirs.entries()].filter(([k]) => inChunk(k)),
        chests: [...World.chests.entries()].filter(([k]) => inChunk(k)).map(([k, slots]) => [k, stacks(slots)]),
        furnaces: [...World.furnaces.entries()].filter(([k]) => inChunk(k)).map(([k, f]) => [k, { i:pack(f.in), f:pack(f.fuel), o:pack(f.out), burn:f.burn || 0, burnMax:f.burnMax || 0, cook:f.cook || 0 }]),
        crops: [...World.crops.entries()].filter(([k]) => inChunk(k)),
        spawners: [...World.spawners.entries()].filter(([k, sp]) => inChunk(k) && (!sp || sp.type !== 'jelly_house')).map(([k, sp]) => [k, {
          type: sp.type, roster: sp.roster || null, rank: sp.rank || '', remaining: sp.remaining,
          max: sp.max, spawned: sp.spawned, dungeonKey: sp.dungeonKey || '', liveCap: sp.liveCap,
          pool: Array.isArray(sp.pool) ? sp.pool.slice(0, 12) : undefined,
        }]),
        jellyHouses: (typeof Jelly !== 'undefined' ? Jelly.saveHouseEntries().filter(([k]) => inChunk(k)) : []),
        bedDirs: [...World.bedDirs.entries()].filter(([k]) => inChunk(k)),
        photoDirs: [...World.photoDirs.entries()].filter(([k]) => inChunk(k)),
        stairSideways: [...World.stairSideways.entries()].filter(([k]) => inChunk(k)),
        lore: [...World.loreMap.entries()].filter(([k]) => inChunk(k)),
      };
      this.sendTo(conn, { type:'mc_chunk_snapshot', cx, cz, h:World.H, blocks:this.mcEncodeBlocks(ch.blocks), meta });
    },

    mcClientApplyChunk(msg) {
      if (this.role !== 'client' || typeof World === 'undefined' || !msg) return;
      const cx = msg.cx | 0, cz = msg.cz | 0, key = World.key(cx, cz);
      let ch = World.chunks.get(key);
      if (!ch) {
        // Create local shell through existing generator, then overwrite it with server blocks.
        this.applyingRemote = true;
        try { ch = World.genChunk(cx, cz); }
        finally { this.applyingRemote = false; }
      }
      if (!ch) return;
      this.applyingRemote = true;
      try {
        ch.blocks = this.mcDecodeBlocks(msg.blocks || []);
        ch.light = null; ch.blockRGB = null; ch.hasMesh = false;
        const meta = msg.meta || {};
        const putEntries = (map, entries, transform) => {
          if (!map || !Array.isArray(entries)) return;
          for (const [k, v] of entries) map.set(String(k), transform ? transform(v) : v);
        };
        putEntries(World.diffs, meta.diffs);
        if (Array.isArray(meta.diffs)) {
          if (!ch.extraBlocks) ch.extraBlocks = null;
          for (const [dk, id] of meta.diffs) {
            const parts = String(dk).split(',').map(Number);
            if (parts.length < 3 || !Number.isFinite(parts[0] + parts[1] + parts[2])) continue;
            const x = Math.floor(parts[0]), y = Math.floor(parts[1]), z = Math.floor(parts[2]);
            const bkey = World.chunkKeyForBlock ? World.chunkKeyForBlock(x, z) : World.key(Math.floor(x / 16), Math.floor(z / 16));
            if (!World.diffIndex.has(bkey)) World.diffIndex.set(bkey, new Map());
            World.diffIndex.get(bkey).set(String(dk), id);
            if (bkey === key && y >= World.H && World.setExtraBlock) World.setExtraBlock(ch, x, y, z, id | 0);
          }
        }
        putEntries(World.signs, meta.signs);
        putEntries(World.signDirs, meta.signDirs);
        putEntries(World.loreMap, meta.lore);
        putEntries(World.bedDirs, meta.bedDirs);
        putEntries(World.photoDirs, meta.photoDirs);
        putEntries(World.stairSideways, meta.stairSideways);
        putEntries(World.crops, meta.crops);
        putEntries(World.spawners, (meta.spawners || []).filter(([k, val]) => !val || (val.type || val) !== 'jelly_house'), val => { const obj = (val && typeof val === 'object') ? val : { type: val }; return {
              type: obj.type, cd: Number.isFinite(+obj.cd) ? +obj.cd : 3,
              roster: Array.isArray(obj.roster) ? obj.roster.slice() : undefined,
              rank: obj.rank || '', remaining: Number.isFinite(+obj.remaining) ? +obj.remaining : undefined,
              max: Number.isFinite(+obj.max) ? +obj.max : undefined, spawned: Number.isFinite(+obj.spawned) ? +obj.spawned : undefined,
              dungeonKey: obj.dungeonKey || '', liveCap: Number.isFinite(+obj.liveCap) ? +obj.liveCap : undefined,
              pool: Array.isArray(obj.pool) ? obj.pool.slice(0, 12) : undefined,
            }; });
        if (typeof Jelly !== 'undefined' && Array.isArray(meta.jellyHouses)) {
          Jelly.ensureStorage();
          for (const [hk, hd] of meta.jellyHouses) Jelly.setHouse(String(hk), Jelly.unpackHouseRecord(String(hk), hd), { storedNormalized: true });
        }
        putEntries(World.chests, meta.chests, slots => (slots || []).map(unpack));
        putEntries(World.furnaces, meta.furnaces, f => ({ in:unpack(f && f.i), fuel:unpack(f && f.f), out:unpack(f && f.o), burn:(f && f.burn) || 0, burnMax:(f && f.burnMax) || 0, cook:(f && f.cook) || 0 }));
        if (World.dirty) {
          World.dirty.add(key);
          World.dirty.add(World.key(cx + 1, cz)); World.dirty.add(World.key(cx - 1, cz));
          World.dirty.add(World.key(cx, cz + 1)); World.dirty.add(World.key(cx, cz - 1));
        }
      } finally { this.applyingRemote = false; }
    },

    mcClientRequestChunk(cx, cz) {
      if (this.role !== 'client' || !this.connected) return;
      const key = Math.floor(+cx) + ',' + Math.floor(+cz);
      const t = nowMs();
      const prev = this.mcChunkRequests.has(key) ? (this.mcChunkRequests[key] || 0) : 0;
      if (prev && t - prev < 1000) return;
      this.mcChunkRequests.add(key); this.mcChunkRequests[key] = t;
      this.send({ type:'mc_chunk_request', cx:Math.floor(+cx), cz:Math.floor(+cz) });
      setTimeout(() => { this.mcChunkRequests.delete(key); delete this.mcChunkRequests[key]; }, 1800);
    },
  });

  // Final message gate. This sits after the older patch chain and prevents old
  // inventory/drop packets from becoming truth again.
  const previousHandle = MP.handleFullSyncMessage ? MP.handleFullSyncMessage.bind(MP) : function(){ return false; };
  MP.handleFullSyncMessage = function(msg, fromId, cameFromClient){
    if (!msg || !msg.type) return false;
    const sender = fromId || msg.id;
    if (msg.type === 'mc_client_inventory') { if (this.role === 'host' && cameFromClient) this.mcAcceptClientInventory(sender, msg.snapshot, msg.reason); return true; }
    if (msg.type === 'inventory_state') { if (this.role === 'host' && cameFromClient) this.mcAcceptClientInventory(sender, msg.snapshot, msg.reason); return true; }
    if (msg.type === 'inventory_snapshot') { if (this.role === 'client') applyLocalSnapshot(msg.snapshot); return true; }
    if (msg.type === 'mc_drop_request' || msg.type === 'inventory_drop_request' || msg.type === 'drop_request') { if (this.role === 'host' && cameFromClient) this.mcDropFromClient(sender, msg); return true; }
    if (msg.type === 'pickup_request') { if (this.role === 'host' && cameFromClient) this.mcPickupDropForClient(sender, msg.dropId); return true; }
    if (msg.type === 'vehicle_pickup_request') { if (this.role === 'host' && cameFromClient) this.hostHandleVehiclePickup(sender, msg); return true; }
    if (msg.type === 'vehicle_pickup_apply') {
      if (this.role === 'client' && this.findVehicleById && typeof Vehicles !== 'undefined') {
        const v = this.findVehicleById(msg.vid);
        if (v) Vehicles.remove(v);
      }
      return true;
    }
    if (msg.type === 'give_item') { if (this.role === 'client') { if (msg.snapshot) applyLocalSnapshot(msg.snapshot); else if (this.clientReceiveItem) this.clientReceiveItem(msg); } return true; }
    if (msg.type === 'mc_chunk_request') { if (this.role === 'host' && cameFromClient) this.mcHostSendChunk(sender, msg.cx, msg.cz); return true; }
    if (msg.type === 'mc_chunk_snapshot') { if (this.role === 'client') this.mcClientApplyChunk(msg); return true; }
    return previousHandle(msg, fromId, cameFromClient);
  };

  MP.hostHandlePickup = function(pid, dropId){ this.mcPickupDropForClient(pid, dropId); };
  MP.hostPickupIntoClientInventory = function(pid, dropId){ this.mcPickupDropForClient(pid, dropId); };
  MP.hostDropFromClientInventory = function(pid, msg){ this.mcDropFromClient(pid, msg); };
  MP.hostApplyClientInventoryState = function(pid, snap, echo){ this.mcAcceptClientInventory(pid, snap, echo ? 'ui-legacy' : 'legacy'); };
  MP.hostSendInventorySnapshot = function(pid, reason){ this.mcSendPlayerInventory(pid, reason || 'force'); };
  MP.clientSendInventoryState = function(force){
    if (this.role !== 'client' || !this.connected) return;
    const reason = this.__clientInvReason || (force ? 'ui-force' : 'periodic');
    if (!force && !clientMayAuthorInventory(reason)) return;
    this.__clientInvDirty = false; this.__clientInvReason = '';
    this.mcSendClientInventory(reason, !!force);
  };

  // On join, immediately register the guest's starting inventory with the host once.
  const oldFullSyncUpdate = MP.fullSyncUpdate ? MP.fullSyncUpdate.bind(MP) : function(){};
  MP.fullSyncUpdate = function(dt){
    oldFullSyncUpdate(dt || 0);
    if (this.role === 'client' && this.connected && typeof Player !== 'undefined' && !this.__mcSentInitialInventory) {
      this.__mcSentInitialInventory = true;
      this.mcSendClientInventory('init', true);
    }
    // (Removed the second periodic host->client inventory push for the same reason as
    // above: the client owns its own inventory; a full-snapshot overwrite duped/reverted
    // items. Host-initiated gains (pickups) are sent additively via give_item instead.)
  };

  // Prevent local client drop creation from accidentally becoming an entity before the host approves it.
  if (typeof Drops !== 'undefined' && Drops.spawn && !Drops.__mcAuthoritySpawnPatch) {
    Drops.__mcAuthoritySpawnPatch = true;
    const oldSpawn = Drops.spawn.bind(Drops);
    Drops.spawn = function(x, y, z, id, count, vel, dur, data){
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && Multiplayer.connected && !Multiplayer.applyingRemote && !Multiplayer.applyingRemoteState) {
        Multiplayer.send({ type:'mc_drop_request', x:+x, y:+y, z:+z, item:idOf(id), count:Math.max(1, Math.floor(+count || 1)), vel:vel || null, dur:hasDur(dur) ? +dur : undefined, data, snapshot:snapshotFromLocal() });
        Multiplayer.mcSendClientInventory('ui-drop-prestate', true);
        return null;
      }
      return oldSpawn(x, y, z, id, count, vel, hasDur(dur) ? +dur : undefined, data);
    };
  }

  // UI slot/cursor changes are the only client-originated inventory snapshots the host accepts.
  if (typeof UI !== 'undefined' && !UI.__mcAuthorityUiPatch) {
    UI.__mcAuthorityUiPatch = true;
    const oldSlotClick = UI.slotClick ? UI.slotClick.bind(UI) : null;
    if (oldSlotClick) UI.slotClick = function(get, set, button, shift, opts){
      const r = oldSlotClick(get, set, button, shift, opts);
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && Multiplayer.connected) Multiplayer.mcSendClientInventory('slot', true);
      return r;
    };
    const oldDragDeposit = UI.dragDeposit ? UI.dragDeposit.bind(UI) : null;
    if (oldDragDeposit) UI.dragDeposit = function(get, set, opts, el){
      const r = oldDragDeposit(get, set, opts, el);
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && Multiplayer.connected) Multiplayer.mcSendClientInventory('drag', true);
      return r;
    };
    const oldClose = UI.close ? UI.close.bind(UI) : null;
    if (oldClose) UI.close = function(reopening){
      const r = oldClose(reopening);
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && Multiplayer.connected) Multiplayer.mcSendClientInventory('close', true);
      return r;
    };
  }

  // Request Minecraft-style chunk snapshots when a client enters/generates chunks.
  if (typeof World !== 'undefined' && World.genChunk && !World.__mcAuthorityChunkPatch) {
    World.__mcAuthorityChunkPatch = true;
    const oldGenChunk = World.genChunk.bind(World);
    World.genChunk = function(cx, cz){
      const ch = oldGenChunk(cx, cz);
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && Multiplayer.connected && !Multiplayer.applyingRemote) Multiplayer.mcClientRequestChunk(Math.floor(+cx), Math.floor(+cz));
      return ch;
    };
  }
})();

// ============================================================
// Multiplayer driver-authoritative vehicle + reliable manual drop fix.
// Makes the mounted driver own vehicle movement locally for instant controls,
// while the host still owns block breaking, vehicle HP/damage, inventory removal,
// and real dropped-item entities.
// ============================================================
(function installFloopDriverAuthorityAndManualDropFix(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__driverAuthorityManualDropFixInstalled) return;
  Multiplayer.__driverAuthorityManualDropFixInstalled = true;

  const MP = Multiplayer;
  const finite = (v, fallback) => Number.isFinite(+v) ? +v : fallback;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hasDur = (d) => Number.isFinite(+d) && +d >= 0;
  const idOf = (v) => Math.max(0, Math.floor(+v || 0));
  const stackMax = (id) => (typeof Reg !== 'undefined' && Reg[idOf(id)] && Reg[idOf(id)].stack) ? Math.max(1, Reg[idOf(id)].stack | 0) : 64;
  const packStack = (s) => {
    if (!s || !idOf(s.id)) return 0;
    const id = idOf(s.id), count = Math.max(1, Math.floor(+s.count || 1));
    return hasDur(s.dur) ? [id, 1, +s.dur, s.data || null] : (s.data ? [id, count, null, s.data] : [id, count]);
  };
  const unpackStack = (v) => {
    if (!v) return null;
    if (Array.isArray(v)) {
      const id = idOf(v[0]); if (!id) return null;
      const s = { id, count: Math.max(1, Math.floor(+v[1] || 1)) };
      if (hasDur(v[2])) { s.dur = +v[2]; s.count = 1; }
      if (v.length > 3 && v[3] !== undefined && v[3] !== null) s.data = v[3];
      return s;
    }
    if (typeof v === 'object') {
      const id = idOf(v.id); if (!id) return null;
      const s = { id, count: Math.max(1, Math.floor(+v.count || 1)) };
      if (hasDur(v.dur)) { s.dur = +v.dur; s.count = 1; }
      if (v.data !== undefined && v.data !== null) s.data = v.data;
      return s;
    }
    return null;
  };
  const stackMatches = (s, id, dur) => {
    if (!s || idOf(s.id) !== idOf(id)) return false;
    if (hasDur(dur)) return hasDur(s.dur) && +s.dur === +dur;
    return true;
  };
  // POSITIONAL: preserve slot placement when building the client's OWN outgoing
  // inventory snapshot. Compacting here shipped a pre-scrambled layout to the host,
  // which then bounced back and snapped the client's items into the hotbar.
  const normalizeSlotsLoose = (slots, size) => {
    const out = new Array(size).fill(null);
    const src = Array.isArray(slots) ? slots : [];
    for (let i = 0; i < size; i++) {
      const s = unpackStack(src[i]);
      if (!s) { out[i] = null; continue; }
      const max = stackMax(s.id);
      if (hasDur(s.dur) || max <= 1) out[i] = { id:s.id, count:1, ...(hasDur(s.dur) ? { dur:+s.dur } : {}), ...(s.data ? { data:s.data } : {}) };
      else out[i] = { id:s.id, count: Math.max(1, Math.floor(+s.count || 1)), ...(s.data ? { data:s.data } : {}) };
    }
    return out;
  };
  const normalizeArmorLoose = (slots) => {
    const out = new Array(5).fill(null);
    const src = Array.isArray(slots) ? slots : [];
    for (let i = 0; i < 5; i++) {
      const s = unpackStack(src[i]);
      if (s && equipmentSlotAccepts(s.id, i)) out[i] = { id:s.id, count:1, ...(hasDur(s.dur) ? { dur:+s.dur } : {}), ...(s.data ? { data:s.data } : {}) };
    }
    return out;
  };
  const localInventorySnapshot = () => {
    if (typeof Player === 'undefined') return null;
    return {
      inv: normalizeSlotsLoose(Player.inv || [], 36).map(packStack),
      armor: normalizeArmorLoose(Player.armor || []).map(packStack),
      cursor: (typeof UI !== 'undefined' && UI.cursor) ? packStack(UI.cursor) : 0,
      sel: Math.max(0, Math.min(8, Math.floor(+Player.sel || 0))),
      hp: finite(Player.hp, 20), hunger: finite(Player.hunger, 20), xp: finite(Player.xp, 0), level: finite(Player.level, 0),
    };
  };
  const removeFromStateAny = (st, id, count, dur) => {
    if (!st) return 0;
    id = idOf(id); count = Math.max(0, Math.floor(+count || 0));
    if (!id || count <= 0) return 0;
    let need = count, removed = 0;

    // Cursor first fixes the "drag item out of inventory and it vanishes" bug.
    if (st.cursor && need > 0 && stackMatches(st.cursor, id, dur)) {
      const take = Math.min(Math.max(1, st.cursor.count || 1), need);
      st.cursor.count -= take; need -= take; removed += take;
      if (st.cursor.count <= 0) st.cursor = null;
    }

    // Armor slots next fixes Q/Ctrl+Q over worn armor slots.
    if (Array.isArray(st.armor) && need > 0) {
      for (let i = st.armor.length - 1; i >= 0 && need > 0; i--) {
        const s = st.armor[i];
        if (!stackMatches(s, id, dur)) continue;
        const take = Math.min(Math.max(1, s.count || 1), need);
        s.count -= take; need -= take; removed += take;
        if (s.count <= 0) st.armor[i] = null;
      }
    }

    // Normal inventory/hotbar slots.
    if (Array.isArray(st.inv) && need > 0) {
      st.inv = normalizeSlotsLoose(st.inv, 36);
      for (let i = st.inv.length - 1; i >= 0 && need > 0; i--) {
        const s = st.inv[i];
        if (!stackMatches(s, id, dur)) continue;
        const take = Math.min(Math.max(1, s.count || 1), need);
        s.count -= take; need -= take; removed += take;
        if (s.count <= 0) st.inv[i] = null;
      }
      st.inv = normalizeSlotsLoose(st.inv, 36);
    }
    return removed;
  };

  Object.assign(MP, {
    makeDriverVehicleState(v) {
      if (!v) return null;
      const body = v.body || v;
      if (this.ensureVehicleId) this.ensureVehicleId(v);
      return {
        vid: v.mpId || '',
        kind: v.kind || 'car', item: idOf(v.item),
        x:+finite(body.x, 0).toFixed(3), y:+finite(body.y, 0).toFixed(3), z:+finite(body.z, 0).toFixed(3),
        vx:+finite(body.vx, 0).toFixed(3), vy:+finite(body.vy, 0).toFixed(3), vz:+finite(body.vz, 0).toFixed(3),
        yaw:+finite(v.yaw, 0).toFixed(4), speed:+finite(v.speed, 0).toFixed(3),
        wheelSpin:+finite(v.wheelSpin, 0).toFixed(3),
        t: performance.now(),
      };
    },

    hostAdoptDriverVehicleState(pid, state) {
      if (this.role !== 'host' || !pid || !state || !state.vid) return false;
      const v = this.findVehicleById ? this.findVehicleById(state.vid) : null;
      if (!v || v.mpRider !== pid) return false;
      const b = v.body || v;
      const peer = this.peers && this.peers.get(pid);
      const ps = peer && (peer.target || peer.state);
      const sx = finite(state.x, b.x), sy = finite(state.y, b.y), sz = finite(state.z, b.z);
      // Keep it permissive for smooth HTML P2P play, but reject nonsense/teleport-to-infinity packets.
      if (!Number.isFinite(sx + sy + sz) || Math.abs(sx) > 100000 || Math.abs(sy) > 1000 || Math.abs(sz) > 100000) return false;
      if (ps && Number.isFinite(+ps.x) && Math.hypot(sx - finite(ps.x, sx), sz - finite(ps.z, sz)) > 180) return false;
      b.x = sx; b.y = sy; b.z = sz;
      b.vx = clamp(finite(state.vx, b.vx || 0), -80, 80);
      b.vy = clamp(finite(state.vy, b.vy || 0), -80, 80);
      b.vz = clamp(finite(state.vz, b.vz || 0), -80, 80);
      v.yaw = finite(state.yaw, v.yaw || 0);
      v.speed = clamp(finite(state.speed, v.speed || 0), v.kind === 'plane' ? -80 : -40, v.kind === 'plane' ? 80 : 40);
      v.wheelSpin = finite(state.wheelSpin, v.wheelSpin || 0);
      v.__driverAuthAt = performance.now();
      v.__driverAuthPid = pid;
      if (this.positionVehicleMesh) this.positionVehicleMesh(v);
      // Push the fresh state to other clients immediately instead of waiting for the slower host_state tick.
      if (this.broadcast) this.broadcast({ type:'vehicle_driver_state', id:this.id, vehicle:this.makeDriverVehicleState(v), rider:pid }, pid);
      return true;
    },

    hostHandleVehicleBlockBreak(pid, msg) {
      if (this.role !== 'host' || !pid || !msg || typeof World === 'undefined') return;
      const v = this.findVehicleById ? this.findVehicleById(msg.vid) : null;
      if (!v || v.mpRider !== pid) return;
      const b = v.body || v;
      const x = Math.floor(+msg.x), y = Math.floor(+msg.y), z = Math.floor(+msg.z);
      if (!Number.isFinite(x + y + z) || y < 0) return;
      if (Math.hypot((b.x || 0) - (x + 0.5), (b.y || 0) - y, (b.z || 0) - (z + 0.5)) > 6.5) return;
      const cur = World.getBlock(x, y, z);
      if (!cur || cur === B.AIR) return;
      const old = idOf(msg.old || cur);
      if (!(Reg[cur] && Reg[cur].weak) && !(old && Reg[old] && Reg[old].weak)) return;
      World.setBlock(x, y, z, B.AIR);
      if (typeof Particles !== 'undefined' && Particles.blockBurst) Particles.blockBurst(x, y, z, cur);
      if (typeof SFX !== 'undefined' && SFX.breakBlk) SFX.breakBlk();
    },

    applyImmediateDriverVehicleState(msg) {
      if (this.role !== 'client' || !msg || !msg.vehicle) return;
      const s = msg.vehicle;
      const v = this.vehicleFromState ? this.vehicleFromState(s) : null;
      if (!v) return;
      v.mpRider = msg.rider || v.mpRider || '';
      // Never let the server echo pull the current driver backward. The driver already has local truth.
      if (v.mpRider === this.id || v.mpId === this.clientMountedVehicleId) return;
      v.mpTarget = Object.assign({}, s, { rider:v.mpRider });
    },
  });

  const oldMakeVehicleInputMessage = MP.makeVehicleInputMessage ? MP.makeVehicleInputMessage.bind(MP) : null;
  MP.makeVehicleInputMessage = function(){
    const msg = oldMakeVehicleInputMessage ? (oldMakeVehicleInputMessage() || null) : null;
    if (!msg || typeof Vehicles === 'undefined') return msg;
    const v = (Vehicles.driving || Vehicles.boating) || (Player && Player.boarding ? this.findVehicleById(this.clientMountedVehicleId) : null);
    if (v && v.mpId) msg.driverState = this.makeDriverVehicleState(v);
    return msg;
  };

  const oldHostApplyVehicleInput2 = MP.hostApplyVehicleInput ? MP.hostApplyVehicleInput.bind(MP) : null;
  MP.hostApplyVehicleInput = function(pid, msg){
    if (oldHostApplyVehicleInput2) oldHostApplyVehicleInput2(pid, msg);
    if (msg && msg.driverState) this.hostAdoptDriverVehicleState(pid, msg.driverState);
  };

  const oldHandleDriverAuthority = MP.handleFullSyncMessage ? MP.handleFullSyncMessage.bind(MP) : function(){ return false; };
  MP.handleFullSyncMessage = function(msg, fromId, cameFromClient){
    if (!msg || !msg.type) return false;
    const sender = fromId || msg.id;
    if (msg.type === 'vehicle_block_break_request') { if (this.role === 'host' && cameFromClient) this.hostHandleVehicleBlockBreak(sender, msg); return true; }
    if (msg.type === 'vehicle_driver_state') { if (this.role === 'client') this.applyImmediateDriverVehicleState(msg); return true; }
    return oldHandleDriverAuthority(msg, fromId, cameFromClient);
  };

  // Keep client-side vehicle block breaking as prediction, but send it as a host request
  // instead of letting a generic client block packet become world truth.
  const oldLocalBlockChange = MP.onLocalBlockChange ? MP.onLocalBlockChange.bind(MP) : null;
  MP.onLocalBlockChange = function(x, y, z, id, opts, oldId){
    if (this.role === 'client' && this.connected && this.__driverVehicleBlockContext && idOf(id) === (typeof B !== 'undefined' ? B.AIR : 0)) {
      const old = idOf(oldId);
      if (old && typeof Reg !== 'undefined' && Reg[old] && Reg[old].weak) {
        const key = Math.floor(+x) + ',' + Math.floor(+y) + ',' + Math.floor(+z);
        const ctx = this.__driverVehicleBlockContext;
        if (!ctx.sent) ctx.sent = new Set();
        if (!ctx.sent.has(key)) {
          ctx.sent.add(key);
          this.send({ type:'vehicle_block_break_request', vid:ctx.vid || '', x:Math.floor(+x), y:Math.floor(+y), z:Math.floor(+z), old });
        }
        return;
      }
    }
    if (oldLocalBlockChange) return oldLocalBlockChange(x, y, z, id, opts, oldId);
  };

  // Wrap the actual vehicle physics once, after all older vehicle patches are installed.
  const installVehicleRuntimePatch = () => {
    if (typeof Vehicles === 'undefined' || !Vehicles.updateVehicleCommon || Vehicles.__driverAuthorityRuntimePatch) return;
    Vehicles.__driverAuthorityRuntimePatch = true;
    const oldCommon = Vehicles.updateVehicleCommon;
    Vehicles.updateVehicleCommon = function(v, dt, drivingThis, isBoat){
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'host' && v && v.mpRider && v.mpRider !== Multiplayer.id) {
        // The mounted remote client is the movement authority. Host keeps HP/world authority,
        // but does not re-simulate stale input and drag the vehicle behind the driver.
        if (performance.now() - (v.__driverAuthAt || 0) < 900) return;
      }
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client' && drivingThis && v && v.mpId && !isBoat && !Multiplayer.applyingRemoteState) {
        Multiplayer.__driverVehicleBlockContext = { vid:v.mpId, sent:new Set() };
        try { return oldCommon.call(this, v, dt || 0, drivingThis, isBoat); }
        finally { Multiplayer.__driverVehicleBlockContext = null; }
      }
      return oldCommon.call(this, v, dt || 0, drivingThis, isBoat);
    };
  };

  const oldInstallFullSyncHooks2 = MP.installFullSyncHooks ? MP.installFullSyncHooks.bind(MP) : function(){};
  MP.installFullSyncHooks = function(){
    oldInstallFullSyncHooks2();
    installVehicleRuntimePatch();
  };
  installVehicleRuntimePatch();

  // Replace the post-network client vehicle visual tick so the current driver is not reconciled
  // back to an older host packet. Vehicles.update already ran native local physics this frame.
  MP.clientVehicleVisualTick = function(dt){
    if (typeof Vehicles === 'undefined') return;
    const riding = this.clientMountedVehicleId ? this.findVehicleById(this.clientMountedVehicleId) : null;
    const interp = Math.min(1, 14 * (dt || 0));
    for (const v of this.allVehicles ? this.allVehicles() : []) {
      if (!v) continue;
      const t = v.mpTarget;
      const body = v.body || v;
      const selfRidden = !!(riding && v === riding);
      if (!selfRidden && t) {
        body.x += (finite(t.x, body.x) - body.x) * interp;
        body.y += (finite(t.y, body.y) - body.y) * interp;
        body.z += (finite(t.z, body.z) - body.z) * interp;
        body.vx = finite(t.vx, body.vx || 0);
        body.vy = finite(t.vy, body.vy || 0);
        body.vz = finite(t.vz, body.vz || 0);
        if (typeof this.positionVehicleMesh === 'function') {
          const sa = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
          v.yaw = finite(v.yaw, 0) + sa(finite(t.yaw, v.yaw || 0) - finite(v.yaw, 0)) * interp;
        } else v.yaw = finite(t.yaw, v.yaw || 0);
        v.speed = finite(t.speed, v.speed || 0);
        v.wheelSpin = finite(t.wheelSpin, v.wheelSpin || 0) || ((v.wheelSpin || 0) + (v.speed || 0) * (dt || 0) * 3);
        v.mpLightRGB = Array.isArray(t.lightRGB) ? t.lightRGB.slice(0, 3) : v.mpLightRGB;
        v.mpLight = Number.isFinite(+t.light) ? +t.light : v.mpLight;
      }
      if (this.positionVehicleMesh) this.positionVehicleMesh(v);
      if (Vehicles.applyFlash) Vehicles.applyFlash(v, dt || 0);
      if (Array.isArray(v.mpLightRGB) && this.applyVoxelLightToObject) this.applyVoxelLightToObject(v.group || v.mesh, v.mpLightRGB, 'vehicleBaseCol');
      else if (Number.isFinite(+v.mpLight) && this.applyVoxelLightToObject) this.applyVoxelLightToObject(v.group || v.mesh, v.mpLight, 'vehicleBaseCol');
      else if (Vehicles.tintVehicle) Vehicles.tintVehicle(v, dt || 0);
    }
    if (riding) {
      const b = riding.body || riding;
      Player.body.x = b.x;
      Player.body.y = b.y + (Vehicles.riderYOffset ? Vehicles.riderYOffset(riding) : (riding.kind === 'boat' ? 0.25 : riding.kind === 'board' ? 0.08 : 0.35));
      Player.body.z = b.z;
      Player.body.vx = Player.body.vy = Player.body.vz = 0;
      Player.fallDist = 0;
      if (riding.kind === 'boat') { Vehicles.boating = riding; Vehicles.driving = null; Player.boarding = false; }
      else if (riding.kind === 'board') { Vehicles.driving = null; Vehicles.boating = null; Player.boarding = true; }
      else { Vehicles.driving = riding; Vehicles.boating = null; Player.boarding = false; }
    }
    if (typeof UI !== 'undefined' && UI.setVehicleHud) UI.setVehicleHud(riding ? (Vehicles.vehicleHudLabel ? Vehicles.vehicleHudLabel(riding) : Math.max(0, Math.ceil(riding.hp || 0)) + ' HP') : null);
  };

  // Host-side inventory drop replacement. The previous host code removed only from inv slots;
  // this also removes from cursor and armor, which fixes drag-out, Q-hover, and Ctrl+Q cases.
  MP.mcDropFromClient = function(pid, msg){
    if (this.role !== 'host' || !pid || !msg) return;
    if (msg.snapshot && this.mcAcceptClientInventory) this.mcAcceptClientInventory(pid, msg.snapshot, 'manual-drop-prestate');
    const st = this.mcGetPlayerState ? this.mcGetPlayerState(pid) : null;
    const id = idOf(msg.item);
    const want = Math.max(0, Math.floor(+msg.count || 0));
    if (!st || !id || want <= 0) { if (this.mcSendPlayerInventory) this.mcSendPlayerInventory(pid, 'bad-drop'); return; }
    let removed = removeFromStateAny(st, id, want, hasDur(msg.dur) ? +msg.dur : undefined);
    // Manual UI drops can originate from cursor/chest/result widgets that older snapshots did not track.
    // In that exact manual case, do not eat the item: spawn the requested entity instead of sending it to the void.
    if (removed <= 0 && msg.manualDrop) removed = want;
    if (removed > 0 && typeof Drops !== 'undefined' && Drops.spawn) {
      const vel = Array.isArray(msg.vel) ? msg.vel.map(v => finite(v, 0)) : null;
      Drops.spawn(finite(msg.x, 0), finite(msg.y, 64), finite(msg.z, 0), id, removed, vel, hasDur(msg.dur) ? +msg.dur : undefined, msg.data);
    }
    if (this.mcSendPlayerInventory) this.mcSendPlayerInventory(pid, 'manual-drop');
  };

  // Outermost client drop interception. It tags true manual throw/drop actions so the host can
  // remove them from canonical cursor/armor/inventory and spawn a real shared drop.
  if (typeof Drops !== 'undefined' && Drops.spawn && !Drops.__driverAuthorityManualDropPatch) {
    Drops.__driverAuthorityManualDropPatch = true;
    const oldSpawn = Drops.spawn.bind(Drops);
    Drops.spawn = function(x, y, z, id, count, vel, dur, data){
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && Multiplayer.connected && !Multiplayer.applyingRemote && !Multiplayer.applyingRemoteState) {
        const p = (typeof Player !== 'undefined' && Player.body) ? Player.body : null;
        const manualVel = Array.isArray(vel) && Math.abs(finite(vel[1], 0) - 1.8) < 0.75;
        const nearPlayer = p ? Math.hypot(finite(x, p.x) - p.x, finite(y, p.y + 1.4) - (p.y + 1.4), finite(z, p.z) - p.z) < 3.0 : false;
        Multiplayer.send({
          type:'mc_drop_request', manualDrop: !!(manualVel && nearPlayer),
          x:+x, y:+y, z:+z, item:idOf(id), count:Math.max(1, Math.floor(+count || 1)),
          vel: Array.isArray(vel) ? vel : null,
          dur: hasDur(dur) ? +dur : undefined,
          data: data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined,
          snapshot: localInventorySnapshot(),
        });
        return null;
      }
      return oldSpawn(x, y, z, id, count, vel, hasDur(dur) ? +dur : undefined, data);
    };
  }
})();

// ============================================================
// Multiplayer hard-authority follow-up: reliable client drops,
// optimistic client vehicle driving, synced falling blocks,
// synced weather particles, and client sleep requests.
// ============================================================
(function installFloopMultiplayerHardAuthorityFollowup(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__hardAuthorityFollowupInstalled) return;
  Multiplayer.__hardAuthorityFollowupInstalled = true;
  const MP = Multiplayer;
  const finite = (v, fb) => Number.isFinite(+v) ? +v : fb;
  const idOf = (v) => Math.floor(+((v && typeof v === 'object') ? v.id : v) || 0);
  const hasDur = (v) => Number.isFinite(+v) && +v >= 0;
  const stackMax = (id) => (typeof Reg !== 'undefined' && Reg[idOf(id)] && Reg[idOf(id)].stack) ? Math.max(1, Reg[idOf(id)].stack|0) : 64;
  const stackMatches = (s, id, dur) => {
    if (!s || idOf(s.id) !== idOf(id)) return false;
    if (hasDur(dur)) return hasDur(s.dur) && +s.dur === +dur;
    return !hasDur(s.dur);
  };
  const pack = (s) => {
    if (!s) return 0;
    const id = idOf(s.id);
    const count = Math.max(1, Math.floor(+s.count || 1));
    const o = { id, count };
    if (hasDur(s.dur)) o.dur = +s.dur;
    if (s.data !== undefined) o.data = JSON.parse(JSON.stringify(s.data));
    return o;
  };
  const unpack = (s) => {
    if (!s) return null;
    if (typeof s === 'number') return s > 0 ? { id:idOf(s), count:1 } : null;
    const id = idOf(s.id);
    if (!id) return null;
    const o = { id, count:Math.max(1, Math.floor(+s.count || 1)) };
    if (hasDur(s.dur)) o.dur = +s.dur;
    if (s.data !== undefined) o.data = JSON.parse(JSON.stringify(s.data));
    return o;
  };
  const normalizeStackArray = (arr, size) => {
    const out = new Array(size).fill(null);
    const plain = new Map();
    const special = [];
    const src = Array.isArray(arr) ? arr : [];
    for (const raw of src) {
      const s = unpack(raw);
      if (!s) continue;
      const max = stackMax(s.id);
      if (hasDur(s.dur) || max <= 1) special.push(s);
      else plain.set(s.id, (plain.get(s.id) || 0) + s.count);
    }
    let i = 0;
    for (const s of special) if (i < size) out[i++] = { id:s.id, count:1, ...(hasDur(s.dur) ? { dur:+s.dur } : {}) };
    for (const [id, total] of plain.entries()) {
      let left = total;
      while (left > 0 && i < size) {
        const take = Math.min(stackMax(id), left);
        out[i++] = { id:idOf(id), count:take };
        left -= take;
      }
    }
    return out;
  };
  const makeLocalSnapshot = () => {
    if (typeof Player === 'undefined') return null;
    return {
      inv: normalizeStackArray(Player.inv || [], 36).map(pack),
      armor: (Player.armor || []).slice(0,5).map(pack),
      cursor: (typeof UI !== 'undefined' && UI.cursor) ? pack(UI.cursor) : 0,
      sel: Math.max(0, Math.min(8, Math.floor(+Player.sel || 0))),
      hp: finite(Player.hp, 20), hunger: finite(Player.hunger, 20), xp: finite(Player.xp, 0), level: finite(Player.level, 0),
    };
  };
  const stateFromSnapshot = (snap) => ({
    inv: normalizeStackArray(((snap && snap.inv) || []).map(unpack), 36),
    armor: new Array(5).fill(null).map((_, i) => unpack(snap && snap.armor && snap.armor[i])),
    cursor: unpack(snap && snap.cursor),
    sel: Math.max(0, Math.min(8, Math.floor(+((snap && snap.sel) || 0)))),
    hp: finite(snap && snap.hp, 20), hunger: finite(snap && snap.hunger, 20), xp: finite(snap && snap.xp, 0), level: finite(snap && snap.level, 0),
  });
  const snapshotHas = (snap, id, count, dur) => {
    const st = stateFromSnapshot(snap || {});
    let total = 0;
    const check = (s) => { if (stackMatches(s, id, dur)) total += Math.max(1, Math.floor(+s.count || 1)); };
    check(st.cursor);
    for (const s of st.armor || []) check(s);
    for (const s of st.inv || []) check(s);
    return total >= Math.max(1, Math.floor(+count || 1));
  };
  const removeFromStateAny = (st, id, count, dur) => {
    if (!st) return 0;
    id = idOf(id); let need = Math.max(1, Math.floor(+count || 1)), removed = 0;
    const takeFrom = (container, idx) => {
      const s = container[idx];
      if (!stackMatches(s, id, dur) || need <= 0) return;
      const take = Math.min(Math.max(1, Math.floor(+s.count || 1)), need);
      s.count -= take; need -= take; removed += take;
      if (s.count <= 0) container[idx] = null;
    };
    if (st.cursor && stackMatches(st.cursor, id, dur)) {
      const take = Math.min(Math.max(1, Math.floor(+st.cursor.count || 1)), need);
      st.cursor.count -= take; need -= take; removed += take;
      if (st.cursor.count <= 0) st.cursor = null;
    }
    if (Array.isArray(st.armor)) for (let i = st.armor.length - 1; i >= 0; i--) takeFrom(st.armor, i);
    if (Array.isArray(st.inv)) {
      st.inv = normalizeStackArray(st.inv, 36);
      for (let i = st.inv.length - 1; i >= 0; i--) takeFrom(st.inv, i);
      st.inv = normalizeStackArray(st.inv, 36);
    }
    return removed;
  };
  const ensureDropId = (d) => {
    if (!d) return '';
    if (!d.mpId) d.mpId = 'd' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36).slice(-4);
    return d.mpId;
  };
  const dropState = (d) => {
    const b = d && d.body;
    if (!d || !b) return null;
    const lightRGB = (MP.entityVoxelLightColor ? MP.entityVoxelLightColor(b.x, b.y + 0.3, b.z, 0.12) : [1, 1, 1]).map(v => +v.toFixed(3));
    return {
      did: ensureDropId(d), item:idOf(d.id), count:Math.max(1, Math.floor(+d.count || 1)),
      dur:hasDur(d.dur) ? +d.dur : undefined, data:d.data,
      x:+finite(b.x, 0).toFixed(3), y:+finite(b.y, 0).toFixed(3), z:+finite(b.z, 0).toFixed(3),
      vx:+finite(b.vx, 0).toFixed(3), vy:+finite(b.vy, 0).toFixed(3), vz:+finite(b.vz, 0).toFixed(3),
      age:+finite(d.age, 0).toFixed(2), pd:+finite(d.pickupDelay, 0).toFixed(2),
      light:+Math.max(...lightRGB).toFixed(3), lightRGB,
    };
  };

  MP.applyDropSpawnedReliable = function(msg) {
    if (this.role !== 'client' || typeof Drops === 'undefined' || !msg) return;
    const s = msg.drop || msg;
    if (!s || !s.did || !idOf(s.item)) return;
    let d = Drops.list.find(x => x && x.mpId === s.did);
    this.applyingRemoteState = true;
    try {
      if (!d) {
        const before = Drops.list.length;
        const rawSpawn = Drops.__mpReliableRawSpawn || Drops.__mpReliableOldSpawn || Drops.spawn;
        rawSpawn.call(Drops, finite(s.x, 0), finite(s.y, 64), finite(s.z, 0), idOf(s.item), Math.max(1, Math.floor(+s.count || 1)), [finite(s.vx, 0), finite(s.vy, 0), finite(s.vz, 0)], hasDur(s.dur) ? +s.dur : undefined, s.data);
        d = Drops.list[before];
        if (d) d.mpId = s.did;
      }
      if (d) {
        d.mpId = s.did; d.id = idOf(s.item); d.count = Math.max(1, Math.floor(+s.count || 1));
        d.dur = hasDur(s.dur) ? +s.dur : undefined;
        d.data = s.data;
        d.age = finite(s.age, d.age || 0); d.pickupDelay = finite(s.pd, d.pickupDelay || 0);
        const b = d.body; if (b) { b.x = finite(s.x, b.x); b.y = finite(s.y, b.y); b.z = finite(s.z, b.z); b.vx = finite(s.vx, b.vx || 0); b.vy = finite(s.vy, b.vy || 0); b.vz = finite(s.vz, b.vz || 0); }
        d.mpTarget = Object.assign({}, s);
        d.mpLightRGB = Array.isArray(s.lightRGB) ? s.lightRGB.slice(0, 3) : d.mpLightRGB;
        d.mpLight = Number.isFinite(+s.light) ? +s.light : d.mpLight;
        if (d.mesh && b) d.mesh.position.set(b.x, b.y + 0.18, b.z);
      }
    } finally { this.applyingRemoteState = false; }
  };

  MP.hostSpawnClientDropReliable = function(pid, msg) {
    if (this.role !== 'host' || typeof Drops === 'undefined' || !msg) return;
    const id = idOf(msg.item), want = Math.max(1, Math.floor(+msg.count || 1));
    if (!id || want <= 0) { if (this.mcSendPlayerInventory) this.mcSendPlayerInventory(pid, 'bad-drop'); return; }
    const dur = hasDur(msg.dur) ? +msg.dur : undefined;
    let st = this.mcGetPlayerState ? this.mcGetPlayerState(pid) : null;
    if (msg.snapshot && (!st || !snapshotHas({ inv:(st.inv||[]).map(pack), armor:(st.armor||[]).map(pack), cursor:pack(st.cursor) }, id, want, dur))) {
      // For manual drag/Q drops, the packet's snapshot is the pre-drop state.
      // Use it as intent, then remove on the host before spawning a real shared drop.
      if (this.mcPlayerStates && pid) this.mcPlayerStates.set(pid, stateFromSnapshot(msg.snapshot));
      st = this.mcGetPlayerState ? this.mcGetPlayerState(pid) : stateFromSnapshot(msg.snapshot);
    }
    let removed = removeFromStateAny(st, id, want, dur);
    // Last-resort safety: if the client sent a manual drop with a matching pre-drop snapshot,
    // spawn the item instead of deleting it into the void. This fixes cursor/Q/Ctrl-Q edge cases.
    if (removed <= 0 && msg.snapshot && snapshotHas(msg.snapshot, id, want, dur)) removed = want;
    if (removed <= 0 && msg.manualDrop) removed = want;
    if (removed <= 0) { if (this.mcSendPlayerInventory) this.mcSendPlayerInventory(pid, 'drop-rejected'); return; }
    const vel = Array.isArray(msg.vel) ? msg.vel.map(v => finite(v, 0)) : null;
    const before = Drops.list.length;
    Drops.spawn(finite(msg.x, 0), finite(msg.y, 64), finite(msg.z, 0), id, removed, vel, dur, msg.data);
    const d = Drops.list[before];
    if (d) {
      ensureDropId(d);
      const ds = dropState(d);
      if (ds) {
        this.broadcast({ type:'drop_spawned_reliable', id:this.id, drop:ds });
        const conn = this.connections && this.connections.get(pid);
        if (conn) this.sendTo(conn, { type:'drop_spawned_reliable', id:this.id, drop:ds });
      }
    }
    if (this.mcSendPlayerInventory) this.mcSendPlayerInventory(pid, 'drop');
  };

  // Strongest/latest message gate for drops, sleep, falling, and immediate drop spawn confirms.
  const prevHandle = MP.handleFullSyncMessage ? MP.handleFullSyncMessage.bind(MP) : function(){ return false; };
  MP.handleFullSyncMessage = function(msg, fromId, cameFromClient) {
    if (!msg || !msg.type) return false;
    const sender = fromId || msg.id;
    if (msg.type === 'mp_client_drop_request_v2' || msg.type === 'mc_drop_request' || msg.type === 'inventory_drop_request' || msg.type === 'drop_request') {
      if (this.role === 'host' && cameFromClient) this.hostSpawnClientDropReliable(sender, msg);
      return true;
    }
    if (msg.type === 'drop_spawned_reliable') { if (this.role === 'client') this.applyDropSpawnedReliable(msg); return true; }
    if (msg.type === 'sleep_request') { if (this.role === 'host' && cameFromClient) this.hostHandleSleepRequest(sender, msg); return true; }
    if (msg.type === 'sleep_apply') { if (this.role === 'client') this.applySleepFromHost(msg); return true; }
    return prevHandle(msg, fromId, cameFromClient);
  };

  // Final client-side drop wrapper: never create a local authoritative entity on a guest.
  // Send the pre-drop snapshot to the host and let the host spawn/broadcast the real drop.
  if (typeof Drops !== 'undefined' && Drops.spawn && !Drops.__mpReliableDropFinalPatch) {
    Drops.__mpReliableDropFinalPatch = true;
    Drops.__mpReliableOldSpawn = Drops.spawn.bind(Drops);
    Drops.spawn = function(x, y, z, id, count, vel, dur, data) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client' && !Multiplayer.applyingRemote && !Multiplayer.applyingRemoteState) {
        const p = (typeof Player !== 'undefined' && Player.body) ? Player.body : null;
        const nearPlayer = p ? Math.hypot(finite(x, p.x) - p.x, finite(y, p.y + 1.4) - (p.y + 1.4), finite(z, p.z) - p.z) < 4.5 : true;
        Multiplayer.send({
          type:'mp_client_drop_request_v2', manualDrop:nearPlayer,
          x:+x, y:+y, z:+z, item:idOf(id), count:Math.max(1, Math.floor(+count || 1)),
          vel:Array.isArray(vel) ? vel : null,
          dur:hasDur(dur) ? +dur : undefined,
          data:data,
          snapshot:makeLocalSnapshot(),
        });
        return null;
      }
      return Drops.__mpReliableOldSpawn(x, y, z, id, count, vel, hasDur(dur) ? +dur : undefined, data);
    };
  }

  // Optimistic client mounting: do not wait for a delayed host packet before local vehicle physics starts.
  if (typeof Vehicles !== 'undefined' && Vehicles.enter && !Vehicles.__mpOptimisticClientEnterPatch) {
    Vehicles.__mpOptimisticClientEnterPatch = true;
    const previousEnter = Vehicles.enter.bind(Vehicles);
    Vehicles.enter = function(v) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) {
        if (!v) return;
        if (Multiplayer.ensureVehicleId) Multiplayer.ensureVehicleId(v);
        if (v.mpRider && v.mpRider !== Multiplayer.id) { if (typeof UI !== 'undefined') UI.chat('That vehicle is already occupied.', '#ffb347'); return; }
        Multiplayer.clientMountedVehicleId = v.mpId;
        Multiplayer.clientMountPending = v.mpId;
        v.mpRider = Multiplayer.id;
        if (v.kind === 'boat') { this.boating = v; this.driving = null; Player.boarding = false; }
        else if (v.kind === 'board') { this.driving = null; this.boating = null; Player.boarding = true; }
        else { this.driving = v; this.boating = null; Player.boarding = false; }
        Multiplayer.send({ type:'vehicle_mount_request', vid:v.mpId });
        if (typeof UI !== 'undefined') UI.chat(v.kind === 'supercar' ? 'Blue Super Car! Shift to hop out.' : v.kind === 'boat' ? 'Boat mode. Shift to hop out.' : v.kind === 'board' ? 'Skateboard! Shift to hop off.' : 'Vroom. Shift to hop out.', '#ffd97a');
        return;
      }
      return previousEnter(v);
    };
  }

  // Send driver-owned vehicle state at a faster rate than old input packets.
  const prevFullSyncUpdate = MP.fullSyncUpdate ? MP.fullSyncUpdate.bind(MP) : function(){};
  MP.fullSyncUpdate = function(dt) {
    prevFullSyncUpdate(dt || 0);
    if (!Game.inWorld || !World.ready || this.role === 'solo') return;
    const now = performance.now();
    if (this.role === 'client' && this.connected && typeof Vehicles !== 'undefined') {
      const v = (Vehicles.driving || Vehicles.boating) || (Player && Player.boarding ? this.findVehicleById && this.findVehicleById(this.clientMountedVehicleId) : null);
      if (v && v.mpId && now - (this.__fastDriverSendAt || 0) > 33) {
        this.__fastDriverSendAt = now;
        const msg = this.makeVehicleInputMessage ? this.makeVehicleInputMessage() : null;
        if (msg) this.send(msg);
      }
      if (this.clientMountedVehicleId && this.findVehicleById) {
        const riding = this.findVehicleById(this.clientMountedVehicleId);
        if (riding) {
          if (riding.kind === 'boat') { Vehicles.boating = riding; Vehicles.driving = null; Player.boarding = false; }
          else if (riding.kind === 'board') { Vehicles.driving = null; Vehicles.boating = null; Player.boarding = true; }
          else { Vehicles.driving = riding; Vehicles.boating = null; Player.boarding = false; }
        }
      }
    }
  };

  // Weather particle fix: host sends weather; clients must rebuild rain/snow/sand points when it changes.
  if (typeof Dynamics !== 'undefined' && Dynamics.deserialize && !Dynamics.__mpWeatherParticleDeserializePatch) {
    Dynamics.__mpWeatherParticleDeserializePatch = true;
    const oldDeserialize = Dynamics.deserialize.bind(Dynamics);
    Dynamics.deserialize = function(d) {
      const before = this.weather;
      oldDeserialize(d);
      if (before !== this.weather && this.rebuildRain) this.rebuildRain();
      if (this.weather !== 'clear' && !this.rainMesh && this.rebuildRain) this.rebuildRain();
      if (this.rainMesh) this.rainMesh.visible = true;
    };
  }

  // Falling-block replication: host owns physics/landing; clients render/interpolate only.
  MP.serializeFallingLiveReliable = function() {
    if (typeof Dynamics === 'undefined') return [];
    return (Dynamics.falling || []).map(f => {
      if (!f.mpId) f.mpId = 'f' + Math.random().toString(36).slice(2, 9);
      const b = f.body || {};
      const c = (typeof World !== 'undefined' && World.getLightColor) ? World.getLightColor(Math.floor(finite(b.x,0)), Math.floor(finite(b.y,0) + 0.5), Math.floor(finite(b.z,0)), undefined, 0.12) : [1, 1, 1];
      const lightRGB = c.map(v => +v.toFixed(3));
      return { fid:f.mpId, id:idOf(f.id), x:+finite(b.x,0).toFixed(3), y:+finite(b.y,0).toFixed(3), z:+finite(b.z,0).toFixed(3), vx:+finite(b.vx,0).toFixed(3), vy:+finite(b.vy,0).toFixed(3), vz:+finite(b.vz,0).toFixed(3), light:+Math.max(...lightRGB).toFixed(3), lightRGB };
    });
  };
  MP.applyFallingLiveReliable = function(list) {
    if (this.role !== 'client' || typeof Dynamics === 'undefined' || typeof Drops === 'undefined') return;
    const keep = new Set();
    for (const s of list || []) {
      if (!s || !s.fid || !idOf(s.id)) continue;
      keep.add(s.fid);
      let f = (Dynamics.falling || []).find(x => x && x.mpId === s.fid);
      if (!f) {
        const mesh = Drops.makeBlockCube(idOf(s.id), 0.98);
        mesh.position.set(finite(s.x,0), finite(s.y,0) + 0.49, finite(s.z,0));
        Dynamics.scene.add(mesh);
        f = { mpId:s.fid, id:idOf(s.id), mesh, body:{ x:finite(s.x,0), y:finite(s.y,0), z:finite(s.z,0), vx:0, vy:0, vz:0, w:0.45, h:0.98, onGround:false, hitH:false } };
        Dynamics.falling.push(f);
      }
      f.id = idOf(s.id);
      f.mpTarget = Object.assign({}, s);
      f.mpLightRGB = Array.isArray(s.lightRGB) ? s.lightRGB.slice(0, 3) : f.mpLightRGB;
      f.mpLight = Number.isFinite(+s.light) ? +s.light : f.mpLight;
    }
    for (let i = Dynamics.falling.length - 1; i >= 0; i--) {
      const f = Dynamics.falling[i];
      if (f && f.mpId && !keep.has(f.mpId)) {
        if (f.mesh) { Dynamics.scene.remove(f.mesh); if (f.mesh.geometry) f.mesh.geometry.dispose(); if (f.mesh.material) f.mesh.material.dispose(); }
        Dynamics.falling.splice(i, 1);
      }
    }
  };
  const prevMakeHostLiveState = MP.makeHostLiveState ? MP.makeHostLiveState.bind(MP) : null;
  MP.makeHostLiveState = function() {
    const msg = prevMakeHostLiveState ? prevMakeHostLiveState() : { type:'host_state', id:this.id };
    msg.falling = this.serializeFallingLiveReliable();
    if (typeof Dynamics !== 'undefined' && Dynamics.serialize) msg.dynamics = Dynamics.serialize();
    msg.dim = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld'); // host's dimension
    return msg;
  };
  // Host live entities (mobs/drops/dynamics) belong to the host's dimension only. A client
  // in a DIFFERENT dimension must ignore them and clear any it already has, or it hallucinates
  // the host's mobs/items in the wrong world.
  const prevApplyHLS2 = MP.applyHostLiveState ? MP.applyHostLiveState.bind(MP) : null;
  MP.applyHostLiveState = function(msg) {
    if (this.role === 'client' && msg && msg.dim) {
      const cur = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
      // don't apply the host's mobs/drops when we're in a different dimension (the dim
      // switch already cleared local entities; this stops them repopulating as ghosts)
      if (msg.dim !== cur) return;
    }
    if (prevApplyHLS2) return prevApplyHLS2(msg);
  };
  const prevApplyHostLiveState = MP.applyHostLiveState ? MP.applyHostLiveState.bind(MP) : null;
  MP.applyHostLiveState = function(msg) {
    if (prevApplyHostLiveState) prevApplyHostLiveState(msg);
    if (this.role === 'client') {
      if (msg && msg.dynamics && typeof Dynamics !== 'undefined' && Dynamics.deserialize) Dynamics.deserialize(msg.dynamics);
      this.applyFallingLiveReliable(msg && msg.falling || []);
    }
  };
  if (typeof Dynamics !== 'undefined' && Dynamics.updateFalling && !Dynamics.__mpClientFallingVisualPatch) {
    Dynamics.__mpClientFallingVisualPatch = true;
    const oldUpdateFalling = Dynamics.updateFalling.bind(Dynamics);
    Dynamics.updateFalling = function(dt) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client') {
        const a = Math.min(1, 16 * (dt || 0));
        for (const f of this.falling || []) {
          const b = f.body; if (!b) continue;
          const t = f.mpTarget;
          if (t) {
            b.x += (finite(t.x, b.x) - b.x) * a;
            b.y += (finite(t.y, b.y) - b.y) * a;
            b.z += (finite(t.z, b.z) - b.z) * a;
            b.vx = finite(t.vx, b.vx || 0); b.vy = finite(t.vy, b.vy || 0); b.vz = finite(t.vz, b.vz || 0);
          }
          if (f.mesh) {
            f.mesh.position.set(b.x, b.y + 0.49, b.z);
            const c = Array.isArray(f.mpLightRGB) ? f.mpLightRGB : (Number.isFinite(+f.mpLight) ? [f.mpLight, f.mpLight, f.mpLight] : null);
            if (c && f.mesh.material && f.mesh.material.color) f.mesh.material.color.setRGB(c[0], c[1], c[2]);
          }
        }
        return;
      }
      return oldUpdateFalling(dt || 0);
    };
  }

  // Client sleep: clients request sleep; host changes the real clock and broadcasts the result.
  MP.hostHandleSleepRequest = function(pid, msg) {
    if (this.role !== 'host' || typeof Game === 'undefined') return;
    const toNight = !!(msg && msg.toNight);
    const stormSleep = !toNight && typeof Dynamics !== 'undefined' && Dynamics.weather === 'thunder';
    if (!toNight && !Game.isNight && !stormSleep) { const c = this.connections && this.connections.get(pid); if (c) this.sendTo(c, { type:'sleep_apply', rejected:true, text:'You can only sleep at night or during thunderstorms. The sun disapproves.' }); return; }
    if (toNight && Game.isNight) { const c = this.connections && this.connections.get(pid); if (c) this.sendTo(c, { type:'sleep_apply', rejected:true, text:'The SunBed only works in daylight. It runs on sun. Obviously.' }); return; }
    const frac = Game.time / Game.dayLen;
    if (toNight) {
      const t = frac - Math.floor(frac);
      Game.time += (t < 0.55 ? (0.55 - t) : (1 - t + 0.55)) * Game.dayLen;
    } else {
      Game.time = (Math.floor(frac) + 1) * Game.dayLen + Game.dayLen * 0.02;
      if (typeof Dynamics !== 'undefined' && Dynamics.clearSleepEvents) Dynamics.clearSleepEvents();
    }
    if (typeof UI !== 'undefined') UI.chat((pid ? 'A player slept. ' : '') + (toNight ? 'Night falls.' : 'Morning arrives.'), '#ffd97a');
    this.broadcast({ type:'sleep_apply', id:this.id, time:Game.time, dayCount:Game.dayCount, toNight, text:toNight ? 'You skip the daylight. The stars say hello.' : 'You sleep through the night. Merry morning!' });
  };
  MP.applySleepFromHost = function(msg) {
    if (msg && msg.rejected) { if (typeof UI !== 'undefined') UI.chat(msg.text || 'Cannot sleep right now.', '#ff8080'); return; }
    if (Number.isFinite(+msg.time) && typeof Game !== 'undefined') Game.time = +msg.time;
    if (Number.isFinite(+msg.dayCount) && typeof Game !== 'undefined') Game.dayCount = +msg.dayCount;
    if (msg && !msg.toNight && typeof Dynamics !== 'undefined' && Dynamics.clearSleepEvents) Dynamics.clearSleepEvents();
    if (typeof UI !== 'undefined') UI.chat((msg && msg.text) || 'Sleep accepted.', '#ffd97a');
    const overlay = document.getElementById('sleepOverlay');
    if (overlay) { overlay.style.opacity = 1; setTimeout(() => { overlay.style.opacity = 0; }, 300); }
  };
  if (typeof Game !== 'undefined' && Game.trySleep && !Game.__mpClientSleepRequestPatch) {
    Game.__mpClientSleepRequestPatch = true;
    const oldTrySleep = Game.trySleep.bind(Game);
    Game.trySleep = function(toNight, hit) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client') {
        if (this.sleepLock > 0 || this.cinematicPlaying) return;
        this.sleepLock = 1.5;
        if (typeof SFX !== 'undefined' && SFX.sleep) SFX.sleep();
        // Set the guest's local spawn point just like single player, then ask the host to advance time.
        if (hit && typeof World !== 'undefined' && typeof Physics !== 'undefined' && typeof Player !== 'undefined') {
          for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]]) {
            const sx = hit.bx + dx, sz = hit.bz + dz;
            const feet = World.getBlock(sx, hit.by, sz), head = World.getBlock(sx, hit.by + 1, sz);
            const floor = Physics.blockBoxes(World.getBlock(sx, hit.by - 1, sz), sx, hit.by - 1, sz);
            if (!Physics.blockBoxes(feet, sx, hit.by, sz) && !Physics.blockBoxes(head, sx, hit.by + 1, sz) && floor) { Player.spawn = { x:sx + 0.5, y:hit.by + 0.02, z:sz + 0.5, dim:(typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld') }; break; }
          }
        }
        Multiplayer.send({ type:'sleep_request', toNight:!!toNight, hit: hit ? { bx:Math.floor(hit.bx), by:Math.floor(hit.by), bz:Math.floor(hit.bz) } : null });
        if (typeof UI !== 'undefined') UI.chat('Sleep request sent to host...', '#ffd97a');
        return;
      }
      return oldTrySleep(toNight, hit);
    };
  }
  if (typeof Game !== 'undefined' && Game.finishSleep && !Game.__mpHostSleepBroadcastPatch) {
    Game.__mpHostSleepBroadcastPatch = true;
    const oldFinishSleep = Game.finishSleep.bind(Game);
    Game.finishSleep = function(toNight, spawnSet, afterFadeOut) {
      const ret = oldFinishSleep(toNight, spawnSet, afterFadeOut);
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'host') {
        Multiplayer.broadcast({ type:'sleep_apply', id:Multiplayer.id, time:this.time, dayCount:this.dayCount, toNight:!!toNight, text:toNight ? 'The host used a SunBed. Night falls.' : 'The host slept through the night. Morning arrives.' });
      }
      return ret;
    };
  }
})();

// ============================================================
// Fable/Minecraft-style multiplayer authority polish pass.
// This final wrapper fixes the cases Claude/Fable called out:
// client-local falling-block spawns, post-drop inventory packets,
// client driver physics being gated off, weather visuals on clients,
// and live block orientation metadata.
// ============================================================
(function installFloopFableAuthorityPolish(){
  if (typeof Multiplayer === 'undefined' || Multiplayer.__fableAuthorityPolishInstalled) return;
  Multiplayer.__fableAuthorityPolishInstalled = true;
  const MP = Multiplayer;
  const finite = (v, fb) => Number.isFinite(+v) ? +v : fb;
  const idOf = (v) => Math.floor(+((v && typeof v === 'object') ? v.id : v) || 0);
  const hasDur = (v) => Number.isFinite(+v) && +v >= 0;
  const pack = (s) => {
    if (!s) return 0;
    if (typeof Save !== 'undefined' && Save.packStack) return Save.packStack(s);
    const id = idOf(s.id); if (!id) return 0;
    return hasDur(s.dur) ? [id, Math.max(1, Math.floor(+s.count || 1)), +s.dur] : [id, Math.max(1, Math.floor(+s.count || 1))];
  };
  const unpack = (s) => {
    if (!s) return null;
    if (typeof Save !== 'undefined' && Save.unpackStack && Array.isArray(s)) return Save.unpackStack(s);
    if (typeof s === 'number') return s > 0 ? { id:idOf(s), count:1 } : null;
    if (Array.isArray(s)) {
      const id = idOf(s[0]); if (!id) return null;
      const o = { id, count:Math.max(1, Math.floor(+s[1] || 1)) };
      if (hasDur(s[2])) o.dur = +s[2];
      return o;
    }
    const id = idOf(s.id); if (!id) return null;
    const o = { id, count:Math.max(1, Math.floor(+s.count || 1)) };
    if (hasDur(s.dur)) o.dur = +s.dur;
    if (s.data !== undefined) o.data = JSON.parse(JSON.stringify(s.data));
    return o;
  };
  const stackMax = (id) => {
    id = idOf(id);
    const def = (typeof Reg !== 'undefined') ? Reg[id] : null;
    return Math.max(1, (def && def.stack) || 64);
  };
  const cleanStack = (s) => {
    s = unpack(s);
    if (!s) return null;
    const max = stackMax(s.id);
    if (max <= 1 || hasDur(s.dur)) s.count = 1;
    else s.count = Math.max(1, Math.floor(+s.count || 1));
    return s;
  };
  const sameStack = (s, id, dur) => {
    s = cleanStack(s); id = idOf(id);
    if (!s || s.id !== id) return false;
    if (hasDur(dur)) return hasDur(s.dur) && +s.dur === +dur;
    return !hasDur(s.dur);
  };
  // POSITIONAL: preserve each stack's slot index (see the other normalizeInvSlots
  // note). Compacting here was pulling client items into the hotbar on every sync.
  const normalizeInv = (slots, size) => {
    size = size || 36;
    const out = new Array(size).fill(null);
    const src = Array.isArray(slots) ? slots : [];
    for (let i = 0; i < size; i++) out[i] = cleanStack(src[i]);
    return out;
  };
  const normalizeArmor = (slots) => {
    const out = new Array(5).fill(null);
    const src = Array.isArray(slots) ? slots : [];
    for (let i = 0; i < 5; i++) {
      const s = cleanStack(src[i]);
      if (s && equipmentSlotAccepts(s.id, i)) out[i] = { id:s.id, count:1, ...(hasDur(s.dur) ? { dur:+s.dur } : {}), ...(s.data ? { data:s.data } : {}) };
    }
    return out;
  };
  const snapToState = (snap) => ({
    inv: normalizeInv(((snap && snap.inv) || []).map(unpack), 36),
    armor: normalizeArmor(((snap && snap.armor) || []).map(unpack)),
    cursor: cleanStack(snap && snap.cursor),
    sel: Math.max(0, Math.min(8, Math.floor(+((snap && snap.sel) || 0)))),
    hp: finite(snap && snap.hp, 20), hunger: finite(snap && snap.hunger, 20), xp: finite(snap && snap.xp, 0), level: finite(snap && snap.level, 0),
  });
  const stateToSnap = (st) => ({
    inv: normalizeInv((st && st.inv) || [], 36).map(pack),
    armor: normalizeArmor((st && st.armor) || []).map(pack),
    cursor: (st && st.cursor) ? pack(st.cursor) : 0,
    sel: Math.max(0, Math.min(8, Math.floor(+((st && st.sel) || 0)))),
    hp: finite(st && st.hp, 20), hunger: finite(st && st.hunger, 20), xp: finite(st && st.xp, 0), level: finite(st && st.level, 0),
  });
  const localSnapshot = () => {
    if (typeof Player === 'undefined') return null;
    return stateToSnap({ inv:Player.inv || [], armor:Player.armor || [], cursor:(typeof UI !== 'undefined' ? UI.cursor : null), sel:Player.sel, hp:Player.hp, hunger:Player.hunger, xp:Player.xp, level:Player.level });
  };
  const snapshotHas = (snap, id, count, dur) => {
    const st = snapToState(snap || {});
    let total = 0;
    const check = (s) => { if (sameStack(s, id, dur)) total += Math.max(1, Math.floor(+s.count || 1)); };
    check(st.cursor);
    for (const s of st.armor || []) check(s);
    for (const s of st.inv || []) check(s);
    return total >= Math.max(1, Math.floor(+count || 1));
  };
  const removeFromStateAny = (st, id, count, dur) => {
    if (!st) return 0;
    id = idOf(id);
    let need = Math.max(1, Math.floor(+count || 1));
    let removed = 0;
    const takeOne = (container, i) => {
      const s = container[i];
      if (!sameStack(s, id, dur) || need <= 0) return;
      const n = Math.min(Math.max(1, Math.floor(+s.count || 1)), need);
      s.count -= n; need -= n; removed += n;
      if (s.count <= 0) container[i] = null;
    };
    if (st.cursor && sameStack(st.cursor, id, dur)) {
      const n = Math.min(Math.max(1, Math.floor(+st.cursor.count || 1)), need);
      st.cursor.count -= n; need -= n; removed += n;
      if (st.cursor.count <= 0) st.cursor = null;
    }
    for (let i = (st.armor || []).length - 1; i >= 0; i--) takeOne(st.armor, i);
    st.inv = normalizeInv(st.inv || [], 36);
    for (let i = st.inv.length - 1; i >= 0; i--) takeOne(st.inv, i);
    st.inv = normalizeInv(st.inv, 36);
    st.armor = normalizeArmor(st.armor || []);
    return removed;
  };
  const ensureDropId = (d) => {
    if (!d) return '';
    if (!d.mpId) d.mpId = 'd' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36).slice(-4);
    return d.mpId;
  };
  const dropPacket = (d) => {
    if (!d || !d.body) return null;
    ensureDropId(d);
    return { did:d.mpId, item:idOf(d.id), count:Math.max(1, Math.floor(+d.count || 1)), dur:hasDur(d.dur) ? +d.dur : undefined, data:d.data,
      x:+finite(d.body.x,0).toFixed(3), y:+finite(d.body.y,64).toFixed(3), z:+finite(d.body.z,0).toFixed(3),
      vx:+finite(d.body.vx,0).toFixed(3), vy:+finite(d.body.vy,0).toFixed(3), vz:+finite(d.body.vz,0).toFixed(3),
      age:+finite(d.age,0).toFixed(2), pd:+finite(d.pickupDelay,0).toFixed(2) };
  };
  const sendInvSnapshot = (pid, reason) => {
    if (MP.role !== 'host' || !pid) return;
    const conn = MP.connections && MP.connections.get(pid);
    if (!conn) return;
    const st = MP.mcGetPlayerState ? MP.mcGetPlayerState(pid) : (MP.mcPlayerStates && MP.mcPlayerStates.get(pid));
    if (!st) return;
    MP.sendTo(conn, { type:'inventory_snapshot', reason:reason || 'force', snapshot:stateToSnap(st) });
  };

  // Do not let clients create unsupported local falling-block bodies that never tick.
  if (typeof Dynamics !== 'undefined' && Dynamics.startFall && !Dynamics.__mpFableStartFallGate) {
    Dynamics.__mpFableStartFallGate = true;
    const oldStartFall = Dynamics.startFall.bind(Dynamics);
    Dynamics.startFall = function(x, y, z, id) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client' && !Multiplayer.applyingRemoteState) return null;
      const before = this.falling ? this.falling.length : 0;
      const ret = oldStartFall(x, y, z, id);
      if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'host' && this.falling && this.falling.length > before) {
        for (let i = before; i < this.falling.length; i++) if (this.falling[i] && !this.falling[i].mpId) this.falling[i].mpId = 'f' + Math.random().toString(36).slice(2, 9);
      }
      return ret;
    };
  }

  // Client weather visuals: the host owns weather state, but clients still tick only the particle mesh.
  MP.clientWeatherVisualTick = function(dt) {
    if (typeof Dynamics === 'undefined' || typeof Player === 'undefined' || typeof World === 'undefined') return;
    if (Dynamics.weather === 'clear') {
      if (Dynamics.rainMesh) Dynamics.rainMesh.visible = false;
      return;
    }
    if (!Dynamics.rainMesh && Dynamics.rebuildRain) Dynamics.rebuildRain();
    if (!Dynamics.rainMesh || !Dynamics.rainMesh.geometry) return;
    const p = Player.body;
    const eyeSky = World.getSkyLight ? World.getSkyLight(Math.floor(p.x), Math.floor(Player.eyeY ? Player.eyeY() : p.y + 1.6), Math.floor(p.z)) : 15;
    Dynamics.rainMesh.visible = eyeSky >= 3;
    const attr = Dynamics.rainMesh.geometry.getAttribute('position');
    if (!attr) return;
    if (!Dynamics.rainPark || Dynamics.rainPark.length !== attr.count) Dynamics.rainPark = new Float32Array(attr.count);
    if (!Dynamics.rainVel || Dynamics.rainVel.length !== attr.count) Dynamics.rainVel = Array.from({ length:attr.count }, () => 0.5 + Math.random());
    const local = Dynamics.biomeWeatherName ? Dynamics.biomeWeatherName() : Dynamics.weather;
    const fall = local === 'snowfall' ? 4 : local === 'blizzard' ? 10 : local === 'sandstorm' ? 3 : 18;
    const side = local === 'sandstorm' ? 14 : local === 'blizzard' ? 7 : 1.5;
    for (let i = 0; i < attr.count; i++) {
      if (Dynamics.rainPark[i] > 0) { Dynamics.rainPark[i] -= dt || 0; continue; }
      let wx = attr.getX(i) + side * (dt || 0) * (Dynamics.rainVel[i] || 1);
      let wy = attr.getY(i) - fall * (dt || 0);
      let wz = attr.getZ(i);
      const dx = wx - p.x, dz = wz - p.z;
      const landed = wy < World.H && wy > 0 && World.getBlock && World.getBlock(Math.floor(wx), Math.floor(wy), Math.floor(wz)) !== B.AIR;
      if (landed || wy < p.y - 10 || dx * dx + dz * dz > 30 * 30) {
        let placed = false;
        for (let t = 0; t < 3 && !placed; t++) {
          const nx = p.x + (Math.random() - 0.5) * 48;
          const nz = p.z + (Math.random() - 0.5) * 48;
          const ny = Math.min(World.H - 1, p.y + 14 + Math.random() * 12);
          if (!World.getSkyLight || World.getSkyLight(Math.floor(nx), Math.floor(ny), Math.floor(nz)) >= 14) { wx = nx; wy = ny; wz = nz; placed = true; }
        }
        if (!placed) { Dynamics.rainPark[i] = 0.8 + Math.random(); wy = -999; }
      }
      attr.setXYZ(i, wx, wy, wz);
    }
    attr.needsUpdate = true;
    if (Dynamics.updateRainLighting) Dynamics.updateRainLighting(local);
  };

  // Client-authoritative drops. The client owns its OWN inventory and already removed
  // the dropped item locally. The host's only jobs are: (1) spawn the authoritative
  // world drop so every player sees it, and (2) keep a best-effort mirror for pickup/
  // PvP bookkeeping. It must NEVER echo an inventory_snapshot back to the acting client:
  // recomputing the removal here from a snapshot we can't tell is pre- or post-removal
  // is exactly what made dropped items vanish and then reappear in the client's hotbar.
  // The mirror self-heals from the client's periodic mc_client_inventory sync.
  MP.fableHostDropFromClient = function(pid, msg) {
    if (this.role !== 'host' || !pid || !msg || typeof Drops === 'undefined') return;
    const id = idOf(msg.item), want = Math.max(1, Math.floor(+msg.count || 1));
    if (!id || want <= 0) return; // malformed: ignore, do NOT revert the client
    const dur = hasDur(msg.dur) ? +msg.dur : undefined;
    // adopt the client's reported inventory into our mirror as-is (no re-removal, no echo)
    if (msg.snapshot && this.mcPlayerStates) this.mcPlayerStates.set(pid, snapToState(msg.snapshot));
    const vel = Array.isArray(msg.vel) ? msg.vel.map(v => finite(v, 0)) : null;
    const before = Drops.list.length;
    Drops.spawn(finite(msg.x, 0), finite(msg.y, 64), finite(msg.z, 0), id, want, vel, dur, msg.data);
    const d = Drops.list[before];
    if (d) {
      const pkt = dropPacket(d);
      if (pkt) {
        this.broadcast({ type:'drop_spawned_reliable', id:this.id, drop:pkt });
        const conn = this.connections && this.connections.get(pid);
        if (conn) this.sendTo(conn, { type:'drop_spawned_reliable', id:this.id, drop:pkt });
      }
    }
  };
  MP.mcDropFromClient = function(pid, msg) { return this.fableHostDropFromClient(pid, msg); };
  MP.hostSpawnClientDropReliable = function(pid, msg) { return this.fableHostDropFromClient(pid, msg); };

  // One final drop-spawn wrapper so every Q/ctrl-Q/drag-out path sends one authoritative request.
  if (typeof Drops !== 'undefined' && Drops.spawn && !Drops.__mpFableFinalDropWrapper) {
    Drops.__mpFableFinalDropWrapper = true;
    const oldSpawn = Drops.spawn.bind(Drops);
    Drops.spawn = function(x, y, z, id, count, vel, dur, data) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client' && !Multiplayer.applyingRemote && !Multiplayer.applyingRemoteState) {
        Multiplayer.send({ type:'fable_drop_item', manualDrop:true, x:+x, y:+y, z:+z, item:idOf(id), count:Math.max(1, Math.floor(+count || 1)), vel:Array.isArray(vel) ? vel : null, dur:hasDur(dur) ? +dur : undefined, data:data, snapshot:localSnapshot() });
        return null;
      }
      return oldSpawn(x, y, z, id, count, vel, hasDur(dur) ? +dur : undefined, data);
    };
  }

  // Driver authority: clients simulate the currently mounted car/boat locally even though the generic client update is gated.
  MP.fableRunClientVehiclePhysics = function(dt) {
    if (typeof Vehicles === 'undefined' || typeof Player === 'undefined') return;
    const active = Vehicles.driving || Vehicles.boating;
    if (active && active.mpId) {
      const isBoat = active.kind === 'boat';
      if (!isBoat) this.__driverVehicleBlockContext = { vid:active.mpId, sent:new Set() };
      try {
        if (Vehicles.updateVehicleCommon) Vehicles.updateVehicleCommon(active, dt || 0, true, isBoat);
      } finally { this.__driverVehicleBlockContext = null; }
      const b = active.body || active;
      if (active.wheels) {
        active.wheelSpin = (active.wheelSpin || 0) + (active.speed || 0) * (dt || 0) * 3;
        for (const w of active.wheels) if (w) w.rotation.x = active.wheelSpin;
      }
      if (active.propellers) {
        active.propSpin = (active.propSpin || 0) + Math.max(18, Math.abs(active.speed || 0) * 1.3) * (dt || 0);
        for (const p of active.propellers) if (p) p.rotation.z = active.propSpin;
      }
      if (active.group) { active.group.position.set(b.x, b.y, b.z); active.group.rotation.y = active.yaw || 0; }
      if (active.mesh) { active.mesh.position.set(b.x, b.y, b.z); active.mesh.rotation.y = active.yaw || 0; }
      if (Vehicles.applyFlash) Vehicles.applyFlash(active, dt || 0);
      if (Vehicles.tintVehicle) Vehicles.tintVehicle(active, dt || 0, true);
      Player.body.x = b.x; Player.body.y = b.y + (Vehicles.riderYOffset ? Vehicles.riderYOffset(active) : (isBoat ? 0.25 : 0.35)); Player.body.z = b.z;
      Player.body.vx = Player.body.vy = Player.body.vz = 0;
      Player.fallDist = 0;
      if (typeof UI !== 'undefined' && UI.setVehicleHud) UI.setVehicleHud(Vehicles.vehicleHudLabel ? Vehicles.vehicleHudLabel(active) : Math.max(0, Math.ceil(active.hp || 0)) + ' HP');
    }
    if (Player.boarding && Vehicles.updateBoard) {
      // updateBoard is patched below; this keeps skateboards responsive too.
      Vehicles.updateBoard(dt || 0);
    }
  };
  if (typeof Vehicles !== 'undefined' && Vehicles.update && !Vehicles.__mpFableClientVehicleUpdate) {
    Vehicles.__mpFableClientVehicleUpdate = true;
    const oldVehicleUpdate = Vehicles.update.bind(Vehicles);
    Vehicles.update = function(dt) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client') {
        Multiplayer.fableRunClientVehiclePhysics(dt || 0);
        return;
      }
      return oldVehicleUpdate(dt || 0);
    };
  }
  if (typeof Vehicles !== 'undefined' && Vehicles.updateBoard && !Vehicles.__mpFableClientBoardUpdate) {
    Vehicles.__mpFableClientBoardUpdate = true;
    const oldBoardUpdate = Vehicles.updateBoard.bind(Vehicles);
    Vehicles.updateBoard = function(dt) {
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'client') {
        if (!Player.boarding) return;
        if (!this.boardMesh) this.boardMesh = this.buildBoardMesh();
        if (this.boardMesh.parent !== this.scene) this.scene.add(this.boardMesh);
        const b = Player.body;
        if (this.boardTrick > 0) this.boardTrick -= dt || 0;
        const prog = this.boardTrick > 0 ? 1 - this.boardTrick / 0.45 : 0;
        this.boardMesh.position.set(b.x, b.y + 0.02, b.z);
        this.boardMesh.rotation.set(0, Player.yaw + Math.PI, 0);
        if (prog > 0) {
          if (this.boardTrickType === 1) this.boardMesh.rotation.z = prog * Math.PI * 2;
          else this.boardMesh.rotation.x = Math.sin(prog * Math.PI) * 0.5;
        }
        if (this.tintVehicle) this.tintVehicle({ kind:'board-riding', mesh:this.boardMesh, x:b.x, y:b.y, z:b.z }, dt || 0, true);
        return;
      }
      return oldBoardUpdate(dt || 0);
    };
  }

  // Add metadata maps to live block messages so beds/stairs/signs/photos keep orientation after placement.
  const metaForBlock = (x, y, z) => {
    if (typeof World === 'undefined') return null;
    const k = World.pkey(Math.floor(+x), Math.floor(+y), Math.floor(+z));
    const meta = {};
    if (World.bedDirs && World.bedDirs.has(k)) meta.bedDir = World.bedDirs.get(k);
    if (World.signDirs && World.signDirs.has(k)) meta.signDir = World.signDirs.get(k);
    if (World.photoDirs && World.photoDirs.has(k)) meta.photoDir = World.photoDirs.get(k);
    if (World.stairSideways && World.stairSideways.has(k)) meta.stairSide = World.stairSideways.get(k);
    const bid = World.getBlock ? World.getBlock(Math.floor(+x), Math.floor(+y), Math.floor(+z)) : 0;
    if (typeof canWaterlogBlock === 'function' && canWaterlogBlock(bid)) meta.waterlogged = World.waterlogged && World.waterlogged.has(k) ? 1 : 0;
    // Plantation Pot multiblock: carry the raised/slab metadata so the 3x3 planter renders
    // raised (and preserves the slabs beneath) for everyone, not just the placer.
    if (World.plantationOrigins && World.plantationOrigins.has(k)) meta.potOrigin = World.plantationOrigins.get(k);
    if (World.plantationUnderSlabs && World.plantationUnderSlabs.has(k)) meta.potUnderSlab = World.plantationUnderSlabs.get(k);
    if (typeof B !== 'undefined' && World.getBlock && World.getBlock(Math.floor(+x), Math.floor(+y), Math.floor(+z)) === B.JELLY_HOUSE && typeof Jelly !== 'undefined') {
      const h = Jelly.getHouseByKey(k);
      if (h) meta.jellyHouse = Jelly.packHouseRecord(h);
    }
    return Object.keys(meta).length ? meta : null;
  };
  const applyBlockMeta = (x, y, z, meta) => {
    if (!meta || typeof World === 'undefined') return;
    const k = World.pkey(Math.floor(+x), Math.floor(+y), Math.floor(+z));
    if (meta.bedDir !== undefined && World.bedDirs) World.bedDirs.set(k, meta.bedDir);
    if (meta.signDir !== undefined && World.signDirs) World.signDirs.set(k, meta.signDir);
    if (meta.photoDir !== undefined && World.photoDirs) World.photoDirs.set(k, meta.photoDir);
    if (meta.stairSide !== undefined && World.stairSideways) World.stairSideways.set(k, meta.stairSide);
    if (meta.waterlogged !== undefined && World.setWaterloggedAt) World.setWaterloggedAt(x, y, z, !!meta.waterlogged, { remote: true, silentNetwork: true, noUpdate: true });
    if (meta.potOrigin !== undefined && World.plantationOrigins) World.plantationOrigins.set(k, meta.potOrigin);
    if (meta.potUnderSlab !== undefined && World.plantationUnderSlabs) World.plantationUnderSlabs.set(k, meta.potUnderSlab);
    if ((meta.jellyHouse !== undefined || meta.jellyRoster !== undefined) && typeof B !== 'undefined' && typeof Jelly !== 'undefined' && World.getBlock && World.getBlock(Math.floor(+x), Math.floor(+y), Math.floor(+z)) === B.JELLY_HOUSE) {
      const house = meta.jellyHouse !== undefined ? Jelly.unpackHouseRecord(k, meta.jellyHouse) : Jelly.unpackHouseRecord(k, { stored: meta.jellyRoster });
      Jelly.setHouse(k, house, { storedNormalized: true });
    }
  };
  const oldLocalBlockChange = MP.onLocalBlockChange ? MP.onLocalBlockChange.bind(MP) : null;
  MP.onLocalBlockChange = function(x, y, z, id, opts, oldId) {
    if (this.connected && this.role !== 'solo' && !this.applyingRemote && World && World.ready) {
      const meta = metaForBlock(x, y, z);
      // tag every block change with the sender's dimension so it lands in the RIGHT
      // world for players who are elsewhere (host in Christmas dim, client in overworld…)
      const dim = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
      return this.send({ type:'block', x, y, z, block:id, old:oldId || 0, noUpdate:!!(opts && opts.noUpdate), skipPortalCheck:!!(opts && opts.skipPortalCheck), dim, ...(meta ? { meta } : {}) });
    }
    if (oldLocalBlockChange) return oldLocalBlockChange(x, y, z, id, opts, oldId);
  };
  const oldApplyRemoteBlock = MP.applyRemoteBlock ? MP.applyRemoteBlock.bind(MP) : null;
  MP.applyRemoteBlock = function(msg) {
    const curDim = (typeof Dimensions !== 'undefined' ? Dimensions.current : 'overworld');
    const msgDim = (msg && msg.dim) || 'overworld';
    if (typeof Dimensions !== 'undefined' && Dimensions.stashRemoteBlock && msgDim !== curDim) {
      // change happened in a dimension we're not in — stash it there, don't touch our world
      Dimensions.stashRemoteBlock(msgDim, Math.floor(+msg.x), Math.floor(+msg.y), Math.floor(+msg.z), msg.block | 0);
      return;
    }
    const ret = oldApplyRemoteBlock ? oldApplyRemoteBlock(msg) : undefined;
    if (msg && msg.block === B.AIR && msg.old && typeof SFX !== 'undefined' && SFX.breakBlk) SFX.breakBlk({ x: +msg.x + 0.5, y: +msg.y + 0.5, z: +msg.z + 0.5 });
    if (msg && msg.meta) applyBlockMeta(msg.x, msg.y, msg.z, msg.meta);
    if (typeof World !== 'undefined' && World.dirty) World.dirty.add(World.chunkKeyForBlock ? World.chunkKeyForBlock(msg.x, msg.z) : World.key(Math.floor(msg.x / 16), Math.floor(msg.z / 16))); 
    return ret;
  };

  // Final message gate for the new explicit packet names.
  const prevHandle = MP.handleFullSyncMessage ? MP.handleFullSyncMessage.bind(MP) : function(){ return false; };
  MP.handleFullSyncMessage = function(msg, fromId, cameFromClient) {
    if (!msg || !msg.type) return false;
    const sender = fromId || msg.id;
    if (msg.type === 'fable_drop_item' || msg.type === 'drop_item' || msg.type === 'mp_client_drop_request_v2' || msg.type === 'mc_drop_request' || msg.type === 'inventory_drop_request' || msg.type === 'drop_request') {
      if (this.role === 'host' && cameFromClient) this.fableHostDropFromClient(sender, msg);
      return true;
    }
    if (msg.type === 'drop_spawned_reliable') { if (this.role === 'client' && this.applyDropSpawnedReliable) this.applyDropSpawnedReliable(msg); return true; }
    return prevHandle(msg, fromId, cameFromClient);
  };

  // Attach visual weather tick to the existing update chain once, at the end.
  const prevFullSyncUpdate = MP.fullSyncUpdate ? MP.fullSyncUpdate.bind(MP) : function(){};
  MP.fullSyncUpdate = function(dt) {
    prevFullSyncUpdate(dt || 0);
    if (this.role === 'client' && this.connected) {
      if (typeof Dynamics !== 'undefined' && Dynamics.updateFalling) Dynamics.updateFalling(dt || 0);
      this.clientWeatherVisualTick(dt || 0);
    }
  };
})();

// ============================================================
// Player names + /bring + /goto (installFloopNamesAndSocialTp)
// The host owns the id->name table and rebroadcasts it on every
// join/leave/rename; clients adopt it wholesale. Nametags are
// canvas sprites parented to the remote player group.
// ============================================================
(function installFloopNamesAndSocialTp() {
  const MP = Multiplayer;

  const cleanName = (n) => String(n || '').replace(/[^\w \-\.]/g, '').trim().slice(0, 24);

  MP.setPeerName = function(id, name) {
    if (!id) return;
    const nm = cleanName(name) || ('Player-' + String(id).slice(-4));
    if (this.peerNames.get(id) === nm) return;
    this.peerNames.set(id, nm);
    const p = this.peers.get(id);
    if (p) this.updateNameTag(p, nm);
  };

  MP.broadcastNameTable = function() {
    if (this.role !== 'host' || !this.connected) return;
    this.peerNames.set(this.id, cleanName(this.localName) || 'Host');
    const names = {};
    for (const [pid, nm] of this.peerNames) names[pid] = nm;
    this.broadcast({ type: 'name_table', names, hostId: this.id });
  };

  // clients can re-announce (e.g. /whoami resolved after joining)
  MP.announceName = function() {
    if (!this.connected) return;
    if (this.role === 'host') { this.broadcastNameTable(); return; }
    this.send({ type: 'peer_name', id: this.id, name: this.localName });
  };

  // ---- floating nametags --------------------------------------------
  MP.updateNameTag = function(p, name) {
    if (!p || !p.group) return;
    if (p.nameTagText === name && p.nameTag) return;
    if (p.nameTag) { p.group.remove(p.nameTag); if (p.nameTag.material.map) p.nameTag.material.map.dispose(); p.nameTag.material.dispose(); }
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 56;
    const c = cv.getContext('2d');
    c.font = 'bold 30px Consolas, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = Math.min(248, c.measureText(name).width + 18);
    c.fillStyle = 'rgba(6,8,14,0.55)';
    c.fillRect(128 - w / 2, 6, w, 44);
    c.fillStyle = '#fff';
    c.fillText(name, 128, 29, 240);
    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(1.5, 0.33, 1);
    spr.position.set(0, 2.06, 0);
    p.group.add(spr);
    p.nameTag = spr;
    p.nameTagText = name;
  };

  const prevApplyPeerState = MP.applyPeerState.bind(MP);
  MP.applyPeerState = function(id, state) {
    prevApplyPeerState(id, state);
    const p = this.peers.get(id);
    if (p && !p.nameTag) {
      const nm = this.peerNames.get(id);
      if (nm) this.updateNameTag(p, nm);
    }
  };

  // ---- name helpers for commands -------------------------------------
  MP.findPeerByName = function(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return null;
    let prefix = null;
    for (const [pid, nm] of this.peerNames) {
      if (pid === this.id) continue;
      const n = nm.toLowerCase();
      if (n === q) return { id: pid, name: nm };
      if (!prefix && n.startsWith(q)) prefix = { id: pid, name: nm };
    }
    return prefix;
  };

  MP.peerPosition = function(pid) {
    const p = this.peers.get(pid);
    const s = p && (p.target || p.state);
    if (!s || !Number.isFinite(+s.x)) return null;
    return { x: +s.x, y: +s.y, z: +s.z, dim: s.dim };
  };

  // ---- /bring & /goto plumbing ---------------------------------------
  const localDim = () => (typeof Dimensions !== 'undefined' ? Dimensions.current : undefined);

  const applyForceTp = (msg) => {
    const from = msg.byName || 'Someone';
    const myDim = localDim();
    if (msg.dim !== undefined && myDim !== undefined && msg.dim !== myDim) {
      if (typeof UI !== 'undefined') UI.chat(from + ' tried to bring you, but you are in another dimension.', '#ff8080');
      return;
    }
    World.update(msg.x, msg.z, 8, msg.y);
    if (Player.body._farPos) delete Player.body._farPos;
    Player.body.x = +msg.x; Player.body.y = +msg.y + 0.2; Player.body.z = +msg.z;
    Player.body.vx = Player.body.vy = Player.body.vz = 0;
    if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(Player.body);
    if (typeof UI !== 'undefined') UI.chat(from + ' brought you to them.', '#7df5ec');
  };

  MP.bringPlayer = function(pid) {
    const msg = {
      type: 'mp_force_tp', target: pid,
      x: Player.body.x, y: Player.body.y, z: Player.body.z,
      dim: localDim(), byName: this.localName,
    };
    if (this.role === 'host') {
      const conn = this.connections.get(pid);
      if (conn) this.sendTo(conn, msg);
    } else {
      // route through the host: it applies locally or relays to the target
      this.send(Object.assign({}, msg, { type: 'mp_bring_request' }));
    }
  };

  // ---- dungeon deactivation replication -------------------------------
  // deactivateDungeonAt() writes raw chunk data, so the normal per-setBlock
  // 'block' packets never fire for it. Send one small message instead; the
  // receiving side re-runs the same deterministic flip on its own chunks.
  MP.onDungeonDeactivated = function(x, y, z) {
    if (!this.connected || this.role === 'solo') return;
    this.send({ type: 'dungeon_deactivated', x, y, z, dim: localDim(), id: this.id });
  };

  const applyRemoteDungeonDeactivation = (msg) => {
    const myDim = localDim();
    // wrong dimension: skip — the host's diffs bring the bricks over via the
    // normal dim_state flow when the player switches back
    if (msg.dim !== undefined && myDim !== undefined && msg.dim !== myDim) return;
    if (typeof World === 'undefined' || !World.ready || !World.deactivateDungeonAt) return;
    MP.applyingRemote = true;
    try { World.deactivateDungeonAt(Math.floor(+msg.x), Math.floor(+msg.y), Math.floor(+msg.z)); }
    finally { MP.applyingRemote = false; }
  };

  const prevReceive = MP.receiveNetworkMessage.bind(MP);
  MP.receiveNetworkMessage = function(msg, fromId, cameFromClient) {
    if (msg && msg.type === 'dungeon_deactivated') {
      if (msg.id !== this.id) applyRemoteDungeonDeactivation(msg);
      if (this.role === 'host' && cameFromClient) this.broadcast(msg, msg.id || fromId);
      return;
    }
    if (msg && msg.type === 'name_table') {
      if (this.role === 'client' && msg.names) {
        this.peerNames = new Map(Object.entries(msg.names));
        for (const [pid, p] of this.peers) {
          const nm = this.peerNames.get(pid);
          if (nm) this.updateNameTag(p, nm);
        }
      }
      return;
    }
    if (msg && msg.type === 'peer_name') {
      if (this.role === 'host') {
        this.setPeerName(msg.id || fromId, msg.name);
        this.broadcastNameTable();
      }
      return;
    }
    if (msg && msg.type === 'mp_force_tp') {
      applyForceTp(msg);
      return;
    }
    if (msg && msg.type === 'mp_bring_request') {
      if (this.role === 'host') {
        if (msg.target === this.id) {
          applyForceTp(msg);
        } else {
          const conn = this.connections.get(msg.target);
          if (conn) this.sendTo(conn, Object.assign({}, msg, { type: 'mp_force_tp' }));
        }
      }
      return;
    }
    return prevReceive(msg, fromId, cameFromClient);
  };
})();

// ============================================================
// Container edit guard (installFloopContainerEditGuard)
// Records which chest/furnace THIS client just touched, so the periodic
// host_world_state merge (applyHostWorldState) won't revert in-flight
// item moves — the root cause of chest item dupes/vanishes under ping.
// ============================================================
(function installFloopContainerEditGuard() {
  const MP = Multiplayer;
  const prevSend = MP.send.bind(MP);
  MP.send = function(msg) {
    if (msg && this.role === 'client') {
      const recent = this._recentContainerEdits || (this._recentContainerEdits = new Map());
      if ((msg.type === 'chest_state' || msg.type === 'chest_close') && msg.key) recent.set(String(msg.key), performance.now() + 5000);
      if (msg.chest && msg.chest.key) recent.set(String(msg.chest.key), performance.now() + 5000);
      if (msg.furnace && msg.furnace.key) recent.set(String(msg.furnace.key), performance.now() + 5000);
    }
    return prevSend(msg);
  };
})();

// ============================================================
// Furnace protocol (installFloopFurnaceSync)
// Chest-style authority for furnaces:
//  - one player per furnace (reuses the chest lock map with 'F'-prefixed
//    keys, so disconnect cleanup is inherited for free)
//  - the HOST owns burn/cook progress; clients send SLOT edits only
//    (the old channel echoed the client's stale scalars every 350ms,
//    perpetually rewinding the host's smelt progress — furnaces never
//    cooked for clients)
//  - while a client holds the lock, the host streams furnace_snapshot
//    every 400ms so the GUI shows live progress and finished smelts
// ============================================================
(function installFloopFurnaceSync() {
  const MP = Multiplayer;
  const FKEY = (k) => 'F' + String(k);
  const pack = (s) => (typeof Save !== 'undefined' && Save.packStack) ? Save.packStack(s) : (s ? { id: s.id, count: s.count, dur: s.dur } : null);
  const unpack = (s) => (typeof Save !== 'undefined' && Save.unpackStack) ? Save.unpackStack(s) : (s ? { id: s.id, count: s.count, dur: s.dur } : null);
  const furnaceEntry = (key) => {
    let f = World.furnaces.get(key);
    if (!f) { f = { in: null, fuel: null, out: null, burn: 0, burnMax: 0, cook: 0 }; World.furnaces.set(key, f); }
    return f;
  };
  const dirtyFurnaceChunk = (key) => {
    const p = String(key).split(',').map(Number);
    if (p.length >= 3) World.dirty.add(World.chunkKeyForBlock ? World.chunkKeyForBlock(p[0], p[2]) : World.key(Math.floor(p[0] / 16), Math.floor(p[2] / 16)));
  };
  const markRecent = (key) => {
    const recent = MP._recentContainerEdits || (MP._recentContainerEdits = new Map());
    recent.set(String(key), performance.now() + 5000);
  };

  // strip the furnace part from the legacy 350ms client echo — it fought the
  // host's cook progress; slot edits go through furnace_state now
  const oldMakeStorage = MP.makeClientStorageState ? MP.makeClientStorageState.bind(MP) : null;
  if (oldMakeStorage) MP.makeClientStorageState = function() {
    const msg = oldMakeStorage();
    if (msg && msg.furnace) { delete msg.furnace; if (!msg.chest) return null; }
    return msg;
  };
  // defense in depth: even if a furnace payload arrives on the old channel,
  // never let it rewind the host's progress scalars
  const oldApplyStorage = MP.hostApplyClientStorage ? MP.hostApplyClientStorage.bind(MP) : null;
  if (oldApplyStorage) MP.hostApplyClientStorage = function(msg) {
    if (msg && msg.furnace && msg.furnace.key) {
      const cur = World.furnaces.get(String(msg.furnace.key));
      const f = msg.furnace.f || {};
      if (cur) { f.burn = cur.burn; f.burnMax = cur.burnMax; f.cook = cur.cook; }
    }
    return oldApplyStorage(msg);
  };

  MP.hostSendFurnaceSnapshot = function(pid, key) {
    const conn = this.connections && this.connections.get(pid);
    if (!conn) return;
    const f = furnaceEntry(String(key));
    this.sendTo(conn, { type: 'furnace_snapshot', key: String(key), f: { i: pack(f.in), f: pack(f.fuel), o: pack(f.out), burn: f.burn || 0, burnMax: f.burnMax || 0, cook: f.cook || 0 } });
  };

  const prevReceive = MP.receiveNetworkMessage.bind(MP);
  MP.receiveNetworkMessage = function(msg, fromId, cameFromClient) {
    if (msg && msg.type === 'furnace_open_request') {
      if (this.role === 'host' && cameFromClient && msg.key) {
        if (!this.hostAcquireChestLock(FKEY(msg.key), fromId)) {
          const conn = this.connections && this.connections.get(fromId);
          if (conn) this.sendTo(conn, { type: 'furnace_busy', key: msg.key });
        } else {
          this.hostSendFurnaceSnapshot(fromId, msg.key);
        }
      }
      return;
    }
    if (msg && msg.type === 'furnace_state') {
      if (this.role === 'host' && cameFromClient && msg.key) {
        // slot edits only, and only from the lock holder; progress stays ours
        if (this.chestLockMap().get(FKEY(msg.key)) !== fromId) return;
        const f = furnaceEntry(String(msg.key));
        const pos = String(msg.key).split(',').map(Number);
        const bench = pos.length >= 3 && World.getBlock(pos[0], pos[1], pos[2]) === B.OXYGENATION_BENCH;
        const input = unpack(msg.i), fuel = unpack(msg.f), output = unpack(msg.o);
        if (bench && input && isOxygenTank(input.id)) {
          const def = Reg[input.id]; input.count = 1; input.dur = Math.max(0, Math.min(def.maxDur, input.dur === undefined ? def.maxDur : +input.dur || 0));
        }
        if (bench && fuel && fuel.id === I.DARK_FLOOPIUM) fuel.count = Math.max(1, Math.min(Reg[fuel.id].stack || 64, fuel.count | 0));
        f.in = bench ? (input && isOxygenTank(input.id) ? input : null) : input;
        f.fuel = bench ? (fuel && fuel.id === I.DARK_FLOOPIUM ? fuel : null) : fuel;
        f.out = bench ? null : output;
        dirtyFurnaceChunk(msg.key);
      }
      return;
    }
    if (msg && msg.type === 'oxygen_recharge_request') {
      if (this.role === 'host' && cameFromClient && msg.key) {
        const key = String(msg.key), conn = this.connections && this.connections.get(fromId);
        const pos = key.split(',').map(Number);
        let result = { ok:false, message:'Invalid oxygenation bench.' };
        if (this.chestLockMap().get(FKEY(key)) === fromId && pos.length >= 3 && World.getBlock(pos[0], pos[1], pos[2]) === B.OXYGENATION_BENCH) {
          const f = furnaceEntry(key);
          result = refillOxygenTankState(f);
          if (result.ok) dirtyFurnaceChunk(key);
          if (conn) this.sendTo(conn, { type:'oxygen_recharge_result', key, result, f:{ i:pack(f.in), f:pack(f.fuel), o:0, burn:0, burnMax:0, cook:0 } });
        } else if (conn) this.sendTo(conn, { type:'oxygen_recharge_result', key, result });
      }
      return;
    }
    if (msg && msg.type === 'oxygen_recharge_result') {
      if (this.role === 'client' && msg.key && typeof UI !== 'undefined') {
        if (msg.f) {
          const f = furnaceEntry(String(msg.key));
          f.in = unpack(msg.f.i); f.fuel = unpack(msg.f.f); f.out = null;
          const recent = this._recentContainerEdits;
          if (recent) recent.delete(String(msg.key));
          dirtyFurnaceChunk(msg.key);
        }
        if (UI.chat) UI.chat((msg.result && msg.result.message) || (msg.result && msg.result.ok ? 'Oxygen tank recharged.' : 'Unable to recharge tank.'), msg.result && msg.result.ok ? '#7df5ec' : '#ffb347');
        if (msg.result && msg.result.ok && typeof SFX !== 'undefined' && SFX.craft) SFX.craft();
        if (UI.screen === 'oxygenBench' && UI.furnaceKey === String(msg.key) && UI.refreshAll) UI.refreshAll();
      }
      return;
    }
    if (msg && msg.type === 'furnace_close') {
      if (this.role === 'host' && cameFromClient && msg.key) this.hostReleaseChestLock(FKEY(msg.key), fromId);
      return;
    }
    if (msg && msg.type === 'furnace_busy') {
      if (this.role === 'client' && typeof UI !== 'undefined') {
        if ((UI.screen === 'furnace' || UI.screen === 'oxygenBench') && UI.close) UI.close();
        if (UI.chat) UI.chat('That workstation is in use by another player.', '#ffb347');
      }
      return;
    }
    if (msg && msg.type === 'furnace_snapshot') {
      if (this.role === 'client' && msg.key && msg.f) {
        const recent = this._recentContainerEdits;
        const cur = furnaceEntry(String(msg.key));
        const editing = recent && (recent.get(String(msg.key)) || 0) > performance.now();
        if (!editing) { cur.in = unpack(msg.f.i); cur.fuel = unpack(msg.f.f); cur.out = unpack(msg.f.o); }
        cur.burn = msg.f.burn || 0; cur.burnMax = msg.f.burnMax || 0; cur.cook = msg.f.cook || 0;
        dirtyFurnaceChunk(msg.key);
        if (typeof UI !== 'undefined' && (UI.screen === 'furnace' || UI.screen === 'oxygenBench') && UI.furnaceKey === String(msg.key) && UI.refreshAll) UI.refreshAll();
      }
      return;
    }
    return prevReceive(msg, fromId, cameFromClient);
  };

  // open/close hooks: lock on open (host locally, client via request), release on close
  if (typeof UI !== 'undefined' && UI.open && !UI.__mpFurnacePatch) {
    UI.__mpFurnacePatch = true;
    const oldOpen = UI.open.bind(UI);
    UI.open = function(name, data) {
      const ret = oldOpen(name, data);
      if ((name === 'furnace' || name === 'oxygenBench') && data && MP.connected && MP.role !== 'solo' && typeof World !== 'undefined') {
        const key = World.pkey(data.bx, data.by, data.bz);
        if (MP.role === 'client') {
          MP.send({ type: 'furnace_open_request', key });
        } else if (!MP.hostAcquireChestLock(FKEY(key), MP.id)) {
          this.close && this.close();
          this.chat && this.chat('That workstation is in use by another player.', '#ffb347');
        }
      }
      return ret;
    };
    const oldClose = UI.close.bind(UI);
    UI.close = function(reopening) {
      const wasFurnace = this.screen === 'furnace' || this.screen === 'oxygenBench';
      const fKey = wasFurnace ? this.furnaceKey : null;
      const ret = oldClose(reopening);
      if (wasFurnace && fKey && MP.connected && MP.role !== 'solo') {
        if (MP.role === 'client') { MP.clientSendFurnaceState(true); MP.send({ type: 'furnace_close', key: fKey }); }
        else MP.hostReleaseChestLock(FKEY(fKey), MP.id);
      }
      return ret;
    };
  }

  // client slot edits: send only when the slots actually changed
  MP.clientSendFurnaceState = function(force) {
    if (this.role !== 'client' || !this.connected || typeof UI === 'undefined' || typeof World === 'undefined') return;
    if ((UI.screen !== 'furnace' && UI.screen !== 'oxygenBench') || !UI.furnaceKey) return;
    const f = World.furnaces.get(UI.furnaceKey);
    if (!f) return;
    const body = { i: pack(f.in), f: pack(f.fuel), o: pack(f.out) };
    const sig = JSON.stringify(body);
    if (!force && sig === this.__lastFurnaceSig) return;
    this.__lastFurnaceSig = sig;
    markRecent(UI.furnaceKey);
    this.send(Object.assign({ type: 'furnace_state', key: UI.furnaceKey }, body));
  };

  const prevTick = MP.fullSyncUpdate ? MP.fullSyncUpdate.bind(MP) : function(){};
  MP.fullSyncUpdate = function(dt) {
    prevTick(dt || 0);
    if (!this.connected || this.role === 'solo') return;
    const now = performance.now();
    if (this.role === 'client') {
      if (now - (this.__lastFurnaceEditCheck || 0) > 250) {
        this.__lastFurnaceEditCheck = now;
        this.clientSendFurnaceState(false);
      }
    } else if (this.role === 'host') {
      // live GUI for whoever holds each furnace lock
      if (now - (this.__lastFurnaceStream || 0) > 400) {
        this.__lastFurnaceStream = now;
        for (const [lk, holder] of this.chestLockMap()) {
          if (holder !== this.id && lk.charAt(0) === 'F' && this.connections.has(holder)) {
            this.hostSendFurnaceSnapshot(holder, lk.slice(1));
          }
        }
      }
    }
  };
})();


// ============================================================
// Container edit acknowledgements (installFloopContainerAcks)
// On a lossy connection a chest_state/furnace_state edit could vanish in
// transit: the host never learned you took the coal, its next broadcast put
// the coal back while you kept your copy — a dupe (or the mirror case, a
// loss). Edits are full-state and idempotent, so the fix is at-least-once
// delivery: every edit carries a seq, the host acks it, and the client
// RESENDS the newest unacked state every ~900ms (keeping the anti-stomp
// guard alive) until the ack lands.
// ============================================================
(function installFloopContainerAcks() {
  const MP = Multiplayer;
  let seqCounter = 0;
  const pending = () => MP._containerPending || (MP._containerPending = new Map()); // key -> {seq, msg, t0, last}

  const prevSend = MP.send.bind(MP);
  MP.send = function(msg) {
    if (msg && this.role === 'client' && (msg.type === 'chest_state' || msg.type === 'furnace_state') && msg.key && !msg.__resend) {
      msg.seq = ++seqCounter;
      pending().set(String(msg.key), { seq: msg.seq, msg: Object.assign({}, msg, { __resend: true }), t0: performance.now(), last: performance.now() });
    }
    return prevSend(msg);
  };

  const ackIfContainerEdit = (self, msg, fromId, cameFromClient) => {
    if (msg && self.role === 'host' && cameFromClient && msg.seq && msg.key && (msg.type === 'chest_state' || msg.type === 'furnace_state') && !msg.__acked) {
      msg.__acked = true; // both hooks may see the same message object — ack once
      const conn = self.connections && self.connections.get(fromId);
      if (conn) self.sendTo(conn, { type: 'container_ack', key: String(msg.key), seq: msg.seq });
    }
  };

  const prevReceive = MP.receiveNetworkMessage.bind(MP);
  MP.receiveNetworkMessage = function(msg, fromId, cameFromClient) {
    if (msg && msg.type === 'container_ack') {
      if (this.role === 'client' && msg.key) {
        const p = pending().get(String(msg.key));
        if (p && p.seq <= (msg.seq || 0)) pending().delete(String(msg.key));
      }
      return;
    }
    if (msg && msg.type === 'joined' && this.role !== 'host') pending().clear(); // fresh session: drop stale retries
    const r = prevReceive(msg, fromId, cameFromClient);
    ackIfContainerEdit(this, msg, fromId, cameFromClient);
    return r;
  };

  // chest_state is consumed by the init-time handleFullSyncMessage gate and
  // never falls through to the load-time receive chain — ack it there too
  const prevHandle = MP.handleFullSyncMessage ? MP.handleFullSyncMessage.bind(MP) : null;
  if (prevHandle) MP.handleFullSyncMessage = function(msg, fromId, cameFromClient) {
    const r = prevHandle(msg, fromId, cameFromClient);
    ackIfContainerEdit(this, msg, fromId, cameFromClient);
    return r;
  };

  const prevTick = MP.fullSyncUpdate ? MP.fullSyncUpdate.bind(MP) : function(){};
  MP.fullSyncUpdate = function(dt) {
    prevTick(dt || 0);
    if (this.role !== 'client' || !this.connected || !this._containerPending || !this._containerPending.size) return;
    const now = performance.now();
    const recent = this._recentContainerEdits || (this._recentContainerEdits = new Map());
    for (const [key, p] of this._containerPending) {
      if (now - p.t0 > 20000) {
        this._containerPending.delete(key);
        if (typeof UI !== 'undefined' && UI.chat) UI.chat('A container edit could not be confirmed by the host — reopen it to double-check.', '#ff8080');
        continue;
      }
      if (now - p.last > 900) {
        p.last = now;
        recent.set(key, now + 5000); // container stays stomp-guarded while unconfirmed
        this.send(p.msg);
      }
    }
  };
})();
