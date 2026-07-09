// ============================================================
// F_Floop Craft — world dynamics: falling blocks, fire spread,
// weather (rain/thunder/sandstorm/blizzard), starfall, hazards
// ============================================================
const Dynamics = {
  scene: null,
  falling: [],       // {id, mesh, body}
  fireAcc: 0,
  snowAcc: 0,
  hazardAcc: 0,
  // weather
  weather: 'clear',  // clear | rain | thunder
  weatherT: 90,      // seconds until the next roll
  boltT: 0,
  rainMesh: null, rainVel: [],
  // starfall
  starfall: false, starfallT: 0, starSpawnT: 0,
  stars: [],         // falling star entities {mesh, x,y,z, vy}

  init(scene) {
    this.scene = scene;
    for (const f of this.falling) scene.remove(f.mesh);
    for (const s of this.stars) scene.remove(s.mesh);
    this.falling = [];
    this.stars = [];
    this.leafDecay.clear();
    this.weather = 'clear';
    this.weatherT = this.nextClearWeatherDelay ? this.nextClearWeatherDelay() : 900 + Math.random() * 1200;
    this.starfall = false;
    if (this.rainMesh) { scene.remove(this.rainMesh); this.rainMesh = null; }
  },

  // ---------------- falling blocks (sand / gravel) ----------------
  queueFallRelight(x, z) {
    if (!World || !World.relightQueue) return;
    const cx = x >> 4, cz = z >> 4;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        World.relightQueue.add(World.key(cx + dx, cz + dz));
      }
    }
  },

  startFall(x, y, z, id) {
    if (this.falling.length > 160) { return; } // hard cap: never loop the world to death
    if (World.getBlock(x, y, z) !== id) return;
    World.setBlock(x, y, z, B.AIR, { noUpdate: true });
    // Falling sand/gravel changes sky columns. Queue a full verification relight
    // around the source so no stale dark/bright cells remain after it starts.
    this.queueFallRelight(x, z);
    // waking neighbors manually (noUpdate skipped it) so stacked sand chains
    World.checkSupports(x, y, z, B.AIR);
    Water.schedule(x, y, z);
    const mesh = Drops.makeBlockCube(id, 0.98);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(mesh);
    this.falling.push({
      id, mesh,
      body: { x: x + 0.5, y, z: z + 0.5, vx: 0, vy: 0, vz: 0, w: 0.45, h: 0.98, onGround: false, hitH: false },
    });
  },

  updateFalling(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      const b = f.body;
      b.vy -= Physics.GRAV * dt;
      b.vy = Math.max(b.vy, -30);
      Physics.move(b, dt);
      f.mesh.position.set(b.x, b.y + 0.49, b.z);
      // falling blocks obey the light grid too (no more fullbright sand at night)
      f.tintT = (f.tintT || 0) - dt;
      if (f.tintT <= 0) {
        f.tintT = 0.2;
        const raw = World.getLightRaw(Math.floor(b.x), Math.floor(b.y + 0.5), Math.floor(b.z));
        const l = Math.max(0.12, Math.max(raw & 15, (raw >> 4) * World.dayFUniform.value) / 15);
        if (f.mesh.material && f.mesh.material.color) f.mesh.material.color.setRGB(l, l, l);
      }
      if (b.onGround || b.y < -5) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        this.falling.splice(i, 1);
        if (b.y < -5) continue;
        const bx = Math.floor(b.x), by = Math.round(b.y), bz = Math.floor(b.z);
        const here = World.getBlock(bx, by, bz);
        const hereDef = Reg[here];
        if (here === B.AIR || (hereDef && (hereDef.replaceable || !hereDef.solid))) {
          if (hereDef && hereDef.needsSupport) Drops.spawn(bx + 0.5, by + 0.4, bz + 0.5, here, 1);
          World.setBlock(bx, by, bz, f.id);
          // The landing cell may close a skylight shaft or cross a chunk border.
          // Incremental lighting handles most cases; this verification pass fixes
          // the sand/gravel ghost-light edge cases after the fall completes.
          this.queueFallRelight(bx, bz);
        } else {
          Drops.spawn(b.x, b.y + 0.4, b.z, f.id, 1); // landed somewhere occupied: drop as item
          this.queueFallRelight(bx, bz);
        }
      }
    }
  },

  // ---------------- fire ----------------
  tryIgniteNear(x, y, z) {
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
      const id = World.getBlock(x + dx, y + dy, z + dz);
      if (Reg[id] && Reg[id].flammable) {
        // fire appears in the air cell above the flammable block if free
        const ax = x + dx, ay = y + dy + 1, az = z + dz;
        if (World.getBlock(ax, ay, az) === B.AIR && World.fires.size < 300) {
          World.setBlock(ax, ay, az, B.FIRE);
        }
        return;
      }
    }
  },

  updateFire(dt) {
    this.fireAcc += dt;
    if (this.fireAcc < 1) return;
    this.fireAcc = 0;
    const toBurn = [];
    for (const [k, f] of World.fires) {
      const [x, y, z] = k.split(',').map(Number);
      if (!World.hasChunk(x, z)) continue;
      f.t -= 1;
      // spread: pick a random adjacent flammable block and set IT alight
      if (Math.random() < 0.4 && World.fires.size < 300) {
        const dirs = [[1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];
        const [dx, dy, dz] = dirs[(Math.random() * 6) | 0];
        const nid = World.getBlock(x + dx, y + dy, z + dz);
        if (Reg[nid] && Reg[nid].flammable) toBurn.push([x + dx, y + dy, z + dz]);
      }
      if (f.t <= 0) toBurn.push([x, y, z, 'out']);
    }
    for (const [x, y, z, out] of toBurn) {
      if (out) {
        if (World.getBlock(x, y, z) === B.FIRE) World.setBlock(x, y, z, B.AIR);
      } else {
        const oldId = World.getBlock(x, y, z);
        if (this.isLogId(oldId)) this.queueLeafDecay(x, y, z);
        World.setBlock(x, y, z, B.FIRE); // the block burns: replaced by fire
      }
    }
    // rain extinguishes exposed fire
    if (this.weather !== 'clear') {
      for (const [k] of World.fires) {
        const [x, y, z] = k.split(',').map(Number);
        if (World.skyExposed(x, y, z) && Math.random() < 0.5) {
          World.setBlock(x, y, z, B.AIR);
        }
      }
    }
  },

  // ---------------- contact hazards (fire / lava / cactus) ----------------
  hazardCheck(body, isPlayer, mob) {
    const minX = Math.floor(body.x - body.w - 0.08), maxX = Math.floor(body.x + body.w + 0.08);
    const minY = Math.floor(body.y + 0.05), maxY = Math.floor(body.y + Math.max(0.25, body.h - 0.05));
    const scanMinY = Math.floor(body.y - 0.10); // include cactus top contact below the feet
    const minZ = Math.floor(body.z - body.w - 0.08), maxZ = Math.floor(body.z + body.w + 0.08);
    let fire = false, lava = false, cactus = false;

    const boxOverlap = (ax0, ay0, az0, ax1, ay1, az1, bx0, by0, bz0, bx1, by1, bz1) =>
      ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0 && az0 < bz1 && az1 > bz0;
    const bx0 = body.x - body.w - 0.03, bx1 = body.x + body.w + 0.03;
    const by0 = body.y + 0.02, by1 = body.y + body.h - 0.02;
    const bz0 = body.z - body.w - 0.03, bz1 = body.z + body.w + 0.03;

    for (let y = scanMinY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const id = World.getBlock(x, y, z);
      if (y >= minY) {
        if (id === B.FIRE) fire = true;
        if (isLava(id)) lava = true;
      }
      if (id === B.CACTUS) {
        // Cactus collision is inset, but the needles should also hurt when
        // standing/jumping on the top face, not only when touching the sides.
        const xzOverlap = bx0 < x + 0.96 && bx1 > x + 0.04 && bz0 < z + 0.96 && bz1 > z + 0.04;
        const sideOverlap = boxOverlap(bx0, by0, bz0, bx1, by1, bz1, x + 0.04, y, z + 0.04, x + 0.96, y + 1, z + 0.96);
        const topContact = xzOverlap && by0 >= y + 0.92 && by0 <= y + 1.10;
        if (sideOverlap || topContact) cactus = true;
      }
    }
    return { fire, lava, cactus };
  },

  updateHazards(dt) {
    this.hazardAcc += dt;
    if (this.hazardAcc < 0.5) return;
    this.hazardAcc = 0;
    if (!Player.dead && Player.gamemode !== 'creative') {
      const h = this.hazardCheck(Player.body, true);
      const lavaBoatLegIgnore = typeof Vehicles !== 'undefined'
        && Vehicles.boating && Vehicles.boating.lavaBoat
        && Physics.inLava(Vehicles.boating.body, 0.25);
      if (lavaBoatLegIgnore) {
        // The obsidian boat can ride low in lava without raising the player.
        // Ignore lava touching only the lower leg/feet part of the rider's
        // collision body; still burn the player if the upper body/head is in lava.
        const cut = Math.min(0.95, Math.max(0.45, Player.body.h * 0.48));
        const upperBody = Object.assign({}, Player.body, {
          y: Player.body.y + cut,
          h: Math.max(0.25, Player.body.h - cut),
        });
        h.lava = this.hazardCheck(upperBody, true).lava;
      }
      if (h.lava) Player.hurt(4, 0, 0, { pierce: true, source: 'lava' });
      else if (h.fire) Player.hurt(1, 0, 0, { pierce: true });
      else if (h.cactus) Player.hurt(1, 0, 0);
    }
    // mobs are host-authoritative; a client must not damage them (it runs this only
    // for its own player hazard damage)
    if (typeof Multiplayer !== 'undefined' && Multiplayer.role === 'client' && Multiplayer.connected) return;
    for (const m of Mobs.list) {
      if (m.dead) continue;
      const h = this.hazardCheck(m.body, false, m);
      if (h.lava) Mobs.hurt(m, 4, 0, 0);
      else if (h.fire) Mobs.hurt(m, 1, 0, 0);
      else if (h.cactus) Mobs.hurt(m, 1, 0, 0);
    }
  },

  // ---------------- weather ----------------
  biomeWeatherName() {
    const b = World.biomeAt(Math.floor(Player.body.x), Math.floor(Player.body.z));
    if (this.weather === 'clear') return 'clear';
    if (b === 'desert') return 'sandstorm';
    if (b === 'snowy') return this.weather === 'thunder' ? 'blizzard' : 'snowfall';
    return this.weather;
  },

  updateWeather(dt) {
    this.weatherT -= dt;
    if (this.weatherT <= 0) {
      if (this.weather === 'clear') {
        this.weather = Math.random() < 0.22 ? 'thunder' : 'rain';
        this.weatherT = 120 + Math.random() * 210;
        const local = this.biomeWeatherName();
        UI.chat(local === 'sandstorm' ? 'A sandstorm rolls in...' :
          local === 'blizzard' || local === 'snowfall' ? 'Snow begins to fall...' :
          this.weather === 'thunder' ? 'A thunderstorm rolls in!' : 'It starts to rain.', '#9fb8d4');
      } else {
        this.weather = 'clear';
        this.weatherT = this.nextClearWeatherDelay();
        UI.chat('The sky clears up.', '#9fb8d4');
      }
      this.rebuildRain();
    }

    // rain particles live in WORLD SPACE (like real minecraft): they fall straight
    // down where they spawned; only NEW drops appear around the player's position
    if (this.weather !== 'clear') {
      if (!this.rainMesh) this.rebuildRain();
      const p = Player.body;
      // no rain indoors/underground
      const eyeSky = World.getSkyLight(Math.floor(p.x), Math.floor(Player.eyeY()), Math.floor(p.z));
      this.rainMesh.visible = eyeSky >= 3;

      const attr = this.rainMesh.geometry.getAttribute('position');
      if (!this.rainPark || this.rainPark.length !== attr.count) this.rainPark = new Float32Array(attr.count);
      const local = this.biomeWeatherName();
      const fall = local === 'snowfall' ? 4 : local === 'blizzard' ? 10 : local === 'sandstorm' ? 3 : 18;
      const side = local === 'sandstorm' ? 14 : local === 'blizzard' ? 7 : 1.5;
      for (let i = 0; i < attr.count; i++) {
        if (this.rainPark[i] > 0) { this.rainPark[i] -= dt; continue; }
        let wx = attr.getX(i) + side * dt * (this.rainVel[i] || 1);
        let wy = attr.getY(i) - fall * dt;
        let wz = attr.getZ(i);
        const dx = wx - p.x, dz = wz - p.z;
        // recycle when landed, sunk below view, or left the storm radius
        const landed = wy < World.H && wy > 0 &&
          World.getBlock(Math.floor(wx), Math.floor(wy), Math.floor(wz)) !== B.AIR;
        if (landed || wy < p.y - 10 || dx * dx + dz * dz > 30 * 30) {
          let placed = false;
          for (let t = 0; t < 2 && !placed; t++) {
            const nx = p.x + (Math.random() - 0.5) * 48;
            const nz = p.z + (Math.random() - 0.5) * 48;
            const ny = Math.min(World.H - 1, p.y + 14 + Math.random() * 12);
            // only spawn drops under open sky — nothing raining through cave roofs
            if (World.getSkyLight(Math.floor(nx), Math.floor(ny), Math.floor(nz)) >= 14) {
              wx = nx; wy = ny; wz = nz;
              placed = true;
            }
          }
          if (!placed) { this.rainPark[i] = 0.8 + Math.random(); wy = -999; }
        }
        attr.setXYZ(i, wx, wy, wz);
      }
      attr.needsUpdate = true;
      this.updateRainLighting(local);

      if (this.weather === 'thunder' && local !== 'sandstorm') {
        this.boltT -= dt;
        if (this.boltT <= 0) {
          this.boltT = 4 + Math.random() * 11;
          this.lightningStrike();
        }
      }
      if (local === 'snowfall' || local === 'blizzard') this.accumulateSnow(dt);
    }
  },

  weatherParticleBase(local) {
    if (local === 'sandstorm') return [0xd8 / 255, 0xc8 / 255, 0x90 / 255];
    if (local === 'snowfall' || local === 'blizzard') return [1, 1, 1];
    return [0x7d / 255, 0x9f / 255, 0xd4 / 255];
  },

  nextClearWeatherDelay() {
    return 900 + Math.random() * 1500;
  },

  clearWeather(reason) {
    if (this.weather === 'clear') {
      this.weatherT = Math.max(this.weatherT || 0, this.nextClearWeatherDelay());
      return false;
    }
    this.weather = 'clear';
    this.weatherT = this.nextClearWeatherDelay();
    if (this.rebuildRain) this.rebuildRain();
    if (reason && typeof UI !== 'undefined') UI.chat(reason, '#9fb8d4');
    return true;
  },

  clearStarfall(silent) {
    const had = !!this.starfall || (this.stars && this.stars.length);
    this.starfall = false;
    this.starfallT = 0;
    this.starSpawnT = 0;
    for (const s of this.stars || []) {
      if (s.mesh) {
        this.scene.remove(s.mesh);
        if (s.mesh.geometry) s.mesh.geometry.dispose();
      }
    }
    this.stars = [];
    if (had && !silent && typeof UI !== 'undefined') UI.chat('The starfall fades. The night feels ordinary again.', '#9fb8d4');
    return had;
  },

  clearSleepEvents() {
    this.clearStarfall(false);
    this.clearWeather('The storm passes while you sleep.');
  },

  updateRainLighting(local) {
    if (!this.rainMesh) return;
    const pos = this.rainMesh.geometry.getAttribute('position');
    let col = this.rainMesh.geometry.getAttribute('color');
    if (!pos) return;
    if (!col || col.count !== pos.count) {
      this.rainMesh.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
      col = this.rainMesh.geometry.getAttribute('color');
      this.rainMesh.material.vertexColors = true;
      this.rainMesh.material.color.setHex(0xffffff);
      this.rainMesh.material.needsUpdate = true;
    }
    const base = this.weatherParticleBase(local);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const l = (typeof Particles !== 'undefined' && Particles.sampleLight)
        ? Particles.sampleLight(x, y, z, 0.08)
        : 1;
      col.array[i * 3] = base[0] * l;
      col.array[i * 3 + 1] = base[1] * l;
      col.array[i * 3 + 2] = base[2] * l;
    }
    col.needsUpdate = true;
  },

  rebuildRain() {
    if (this.rainMesh) { this.scene.remove(this.rainMesh); this.rainMesh.geometry.dispose(); this.rainMesh.material.dispose(); this.rainMesh = null; }
    if (this.weather === 'clear') return;
    const n = 500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const p = Player.body;
    this.rainVel = [];
    this.rainPark = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = p.x + (Math.random() - 0.5) * 48;   // world coordinates
      pos[i * 3 + 1] = p.y + Math.random() * 24;
      pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 48;
      this.rainVel.push(0.5 + Math.random());
      this.rainPark[i] = Math.random() * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.rainMesh = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, vertexColors: true, size: 0.14, transparent: true, opacity: 0.7, sizeAttenuation: true,
    }));
    this.rainMesh.frustumCulled = false;
    this.scene.add(this.rainMesh);
    this.updateRainLighting(this.biomeWeatherName());
  },

  // ---------------- leaf decay ----------------
  leafDecay: new Map(), // "x,y,z" -> delay
  leafAcc: 0,

  isLeafId(id) {
    return id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES || id === B.OASIS_LEAVES;
  },

  isLogId(id) {
    return id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG || id === B.OASIS_LOG;
  },

  leafSpreadDirs(leafId) {
    if (leafId !== B.OASIS_LEAVES) return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const dirs = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      if (dx || dy || dz) dirs.push([dx, dy, dz]);
    }
    return dirs;
  },

  oasisLeafConnectedToLog(x, y, z) {
    // Oasis palms use diagonal fronds, so their leaf support must search diagonally too.
    // Search through connected oasis leaves using all 26 neighbors; any reached leaf that
    // touches an oasis log keeps the whole frond alive.
    const q = [[x, y, z, 0]];
    const seen = new Set([x + ',' + y + ',' + z]);
    const dirs = this.leafSpreadDirs(B.OASIS_LEAVES);
    const maxDepth = 8;
    const maxNodes = 220;
    for (let qi = 0; qi < q.length && qi < maxNodes; qi++) {
      const [cx, cy, cz, d] = q[qi];
      for (const [dx, dy, dz] of dirs) {
        const nx = cx + dx, ny = cy + dy, nz = cz + dz;
        const id = World.getBlock(nx, ny, nz);
        if (id === B.OASIS_LOG) return true;
        if (d >= maxDepth || id !== B.OASIS_LEAVES) continue;
        if (Math.max(Math.abs(nx - x), Math.abs(ny - y), Math.abs(nz - z)) > 8) continue;
        const nk = nx + ',' + ny + ',' + nz;
        if (!seen.has(nk)) {
          seen.add(nk);
          q.push([nx, ny, nz, d + 1]);
        }
      }
    }
    return false;
  },

  leafHasSupportingLog(x, y, z, leafId) {
    if (leafId === B.OASIS_LEAVES) return this.oasisLeafConnectedToLog(x, y, z);
    // Regular trees keep the older near-log behavior so old oak/birch/spruce canopies do not change.
    for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) {
      if (this.isLogId(World.getBlock(x + dx, y + dy, z + dz))) return true;
    }
    return false;
  },

  queueLeafDecay(lx, ly, lz, opts) {
    // a log was broken/burned: leaves nearby may now be orphaned.
    // Explosions can remove several logs in one frame, so callers may request
    // a wider/faster scan after the blast has finished deleting blocks.
    opts = opts || {};
    const range = opts.range || 6;
    const minDelay = opts.minDelay !== undefined ? opts.minDelay : 1;
    const maxDelay = opts.maxDelay !== undefined ? opts.maxDelay : 5;
    this.queueLeafDecayArea(lx, ly, lz, range, minDelay, maxDelay, opts.force);
  },

  queueLeafDecayArea(cx, cy, cz, range, minDelay, maxDelay, force) {
    if (!force && this.leafDecay.size > 900) return;
    range = Math.max(1, range || 6);
    minDelay = minDelay !== undefined ? minDelay : 1;
    maxDelay = Math.max(minDelay, maxDelay !== undefined ? maxDelay : 5);
    const r2 = range * range;
    for (let dx = -range; dx <= range; dx++) for (let dy = -range; dy <= range; dy++) for (let dz = -range; dz <= range; dz++) {
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      const x = cx + dx, y = cy + dy, z = cz + dz;
      if (!World.hasChunk(x, z)) continue;
      const id = World.getBlock(x, y, z);
      if (!this.isLeafId(id)) continue;
      const k = x + ',' + y + ',' + z;
      const delay = minDelay + Math.random() * Math.max(0, maxDelay - minDelay);
      // Keep the earliest decay time. This lets explosions wake leaves fast even
      // if a slower normal-log-break timer already queued the same leaf.
      if (!this.leafDecay.has(k) || this.leafDecay.get(k) > delay) this.leafDecay.set(k, delay);
    }
  },

  updateLeafDecay(dt) {
    this.leafAcc += dt;
    if (this.leafAcc < 0.5) return;
    this.leafAcc = 0;
    let processed = 0;
    for (const [k, delay] of this.leafDecay) {
      if (processed >= 24) break;
      const nd = delay - 0.5;
      if (nd > 0) { this.leafDecay.set(k, nd); continue; }
      processed++;
      this.leafDecay.delete(k);
      const [x, y, z] = k.split(',').map(Number);
      const id = World.getBlock(x, y, z);
      if (!this.isLeafId(id)) continue;
      if (!this.leafHasSupportingLog(x, y, z, id)) {
        World.setBlock(x, y, z, B.AIR);
        Particles.blockBurst(x, y, z, id);
        if (Math.random() < 0.6) Drops.dropFromBlock(x, y, z, id, true);
        // spread the decay outward through the canopy. Oasis palms use diagonal fronds,
        // so oasis leaves spread checks through diagonal neighbors too.
        for (const [ax, ay, az] of this.leafSpreadDirs(id)) {
          const nid = World.getBlock(x + ax, y + ay, z + az);
          if (this.isLeafId(nid) && this.leafDecay.size < 900) {
            const nk = (x + ax) + ',' + (y + ay) + ',' + (z + az);
            if (!this.leafDecay.has(nk)) this.leafDecay.set(nk, 0.5 + Math.random() * 3);
          }
        }
      }
    }
  },

  // ---------------- monster spawners ----------------
  normalizeSpawnerState(k, sp, blockId) {
    if (!sp) sp = {};
    const rank = (sp.rank || (typeof dungeonRankForSpawnerBlock === 'function' ? dungeonRankForSpawnerBlock(blockId) : '') || '').toLowerCase();
    if (rank) {
      const fresh = World.createDungeonSpawnerState ? World.createDungeonSpawnerState(rank, sp.dungeonKey || '') : { type: 'dungeon_spawner', rank, remaining: 4, max: 4, spawned: 0, liveCap: 2, pool: ['skeleton'] };
      sp.type = 'dungeon_spawner';
      sp.rank = rank;
      if (!Number.isFinite(+sp.max) || +sp.max <= 0) sp.max = fresh.max;
      if (!Number.isFinite(+sp.remaining)) sp.remaining = sp.max;
      sp.remaining = Math.max(0, Math.floor(+sp.remaining));
      sp.spawned = Math.max(0, Math.floor(+sp.spawned || 0));
      sp.liveCap = Math.max(1, Math.floor(+sp.liveCap || fresh.liveCap || 2));
      if (!Array.isArray(sp.pool) || !sp.pool.length) sp.pool = fresh.pool || ['skeleton'];
      if (!sp.dungeonKey) {
        const [x, y, z] = k.split(',').map(Number);
        const dg = World.dungeonAtBlock && World.dungeonAtBlock(x, y, z);
        sp.dungeonKey = dg && dg.key || '';
      }
    }
    if (!Number.isFinite(+sp.cd)) sp.cd = 3;
    return sp;
  },

  breakSpawner(k, x, y, z) {
    World.spawners.delete(k);
    if (World.getBlock(x, y, z) !== B.BROKEN_SPAWNER) World.setBlock(x, y, z, B.BROKEN_SPAWNER, { noUpdate: true, skipPortalCheck: true });
    if (typeof SFX !== 'undefined') {
      if (SFX.spawnerBreak) SFX.spawnerBreak({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      else if (SFX.breakBlk) SFX.breakBlk();
    }
    if (typeof Particles !== 'undefined') Particles.burst(x + 0.5, y + 0.7, z + 0.5, [0.45, 0.35, 0.7], 18, 3);
  },

  updateSpawners(dt) {
    this.spawnerAcc = (this.spawnerAcc || 0) + dt;
    if (this.spawnerAcc < 1) return;
    this.spawnerAcc = 0;
    if (typeof Jelly !== 'undefined') Jelly.updateHouses(dt);
    const p = Player.body;
    for (const [k, sp] of World.spawners) {
      const [x, y, z] = k.split(',').map(Number);
      if (!World.hasChunk(x, z)) continue;
      let blockId = World.getBlock(x, y, z);
      if (sp.type === 'jelly_house') { if (typeof Jelly !== 'undefined') Jelly.migrateLegacySpawners(); else World.spawners.delete(k); continue; }
      if (sp.type === 'spider') sp.type = Math.random() < 0.5 ? 'skeleton' : 'creeper';
      const ownedDungeon = World.dungeonAtBlock && World.dungeonAtBlock(x, y, z);
      if (blockId === B.SPAWNER && ownedDungeon && typeof dungeonSpawnerBlockForRank === 'function') {
        blockId = dungeonSpawnerBlockForRank(ownedDungeon.rank || 'green');
        World.setBlock(x, y, z, blockId, { noUpdate: true, skipPortalCheck: true, dungeonKey: ownedDungeon.key });
      }
      const isSpawner = typeof isSpawnerBlock === 'function' ? isSpawnerBlock(blockId) : blockId === B.SPAWNER;
      if (!isSpawner) { World.spawners.delete(k); continue; }
      this.normalizeSpawnerState(k, sp, blockId);
      if (sp.type === 'dungeon_spawner') {
        if (sp.remaining <= 0) { this.breakSpawner(k, x, y, z); continue; }
        const dg = ownedDungeon || (World.dungeonAtBlock && World.dungeonAtBlock(x, y, z));
        if (!dg || !World.playerInsideDungeon || !World.playerInsideDungeon(dg, p)) continue;
      }
      const d2 = (x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2;
      if (d2 > 16 * 16 || d2 < 2 * 2) continue;
      sp.cd -= 1;
      if (sp.cd > 0) continue;
      sp.cd = 4 + Math.random() * 4;
      let mine = 0;
      for (const m of Mobs.list) if (m.fromSpawner === k && !m.dead) mine++;
      if (mine >= (sp.liveCap || 3)) continue;
      const spawnType = World.spawnerMobForState ? World.spawnerMobForState(sp) : sp.type;
      for (let tries = 0; tries < 6; tries++) {
        const sx = x + ((Math.random() * 5) | 0) - 2, sz = z + ((Math.random() * 5) | 0) - 2, sy = y;
        if (World.getBlock(sx, sy, sz) === B.AIR && World.getBlock(sx, sy + 1, sz) === B.AIR &&
            Physics.solidAt(sx + 0.5, sy - 0.5, sz + 0.5) &&
            (!Mobs.spawnFits || Mobs.spawnFits(spawnType, sx + 0.5, sy + 0.02, sz + 0.5))) {
          const m = Mobs.spawn(spawnType, sx + 0.5, sy + 0.02, sz + 0.5, spawnType === 'humbug' ? Mobs.humbugGun() : null);
          m.fromSpawner = k;
          if (sp.type === 'dungeon_spawner') {
            sp.spawned = Math.max(0, (sp.spawned || 0) + 1);
            sp.remaining = Math.max(0, (sp.remaining || 0) - 1);
          }
          Particles.burst(sx + 0.5, sy + 1, sz + 0.5, [0.8, 0.2, 0.2], 10, 2);
          if (sp.type === 'dungeon_spawner' && sp.remaining <= 0) this.breakSpawner(k, x, y, z);
          break;
        }
      }
    }
  },

  lightningStrike() {
    const p = Player.body;
    const x = Math.floor(p.x + (Math.random() - 0.5) * 70);
    const z = Math.floor(p.z + (Math.random() - 0.5) * 70);
    if (!World.hasChunk(x, z)) return;
    let y = World.H - 2;
    while (y > 1 && World.getBlock(x, y, z) === B.AIR) y--;
    y++;
    // bolt visual
    const bolt = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, World.H, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    );
    bolt.position.set(x + 0.5, y + World.H / 2, z + 0.5);
    this.scene.add(bolt);
    setTimeout(() => { this.scene.remove(bolt); bolt.geometry.dispose(); }, 260);
    SFX.boom({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    // fire + damage
    if (Math.random() < 0.5) {
      const below = World.getBlock(x, y - 1, z);
      if (Reg[below] && Reg[below].block && World.getBlock(x, y, z) === B.AIR) World.setBlock(x, y, z, B.FIRE);
    }
    const hurtNear = (bx, by, bz, body, cb) => {
      const d = Math.sqrt((body.x - bx - 0.5) ** 2 + (body.y - by) ** 2 + (body.z - bz - 0.5) ** 2);
      if (d < 4) cb(Math.round(10 * (1 - d / 4)));
    };
    hurtNear(x, y, z, Player.body, (dmg) => { if (dmg > 0) Player.hurt(dmg, 0, 0); });
    for (const m of Mobs.list) if (!m.dead) hurtNear(x, y, z, m.body, (dmg) => { if (dmg > 0) Mobs.hurt(m, dmg, 0, 0); });
  },

  accumulateSnow(dt) {
    this.snowAcc += dt;
    if (this.snowAcc < 3) return;
    this.snowAcc = 0;
    const p = Player.body;
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * 40);
      const z = Math.floor(p.z + (Math.random() - 0.5) * 40);
      if (!World.hasChunk(x, z)) continue;
      if (World.biomeAt(x, z) !== 'snowy') continue;
      let y = World.H - 2;
      while (y > 1 && World.getBlock(x, y, z) === B.AIR) y--;
      const ground = World.getBlock(x, y, z);
      if (isSnowSheet(ground)) {
        if (ground < B.SNOW_SHEET_7) World.setBlock(x, y, z, ground + 1);
        else World.setBlock(x, y, z, B.SNOW);
      } else if (Reg[ground] && Reg[ground].block && Reg[ground].solid && Reg[ground].shape === 'cube' && !isFluid(ground)) {
        if (World.getBlock(x, y + 1, z) === B.AIR) World.setBlock(x, y + 1, z, B.SNOW_SHEET_1);
      }
    }
  },

  // ---------------- starfall ----------------
  maybeStartStarfall() {
    // called at each dusk
    if (this.starfall) return;
    if (Math.random() < 0.18) {
      this.starfall = true;
      this.starfallT = 50 + Math.random() * 30;
      this.starSpawnT = 1;
      UI.chat('✨ The sky shimmers... STARFALL! Catch them before they cool!', '#fff2ae');
      UI.chat('<Mr Floop> make a wish. make SEVERAL.', '#7CFC00');
    }
  },

  updateStarfall(dt) {
    if (this.starfall) {
      this.starfallT -= dt;
      this.starSpawnT -= dt;
      if (this.starSpawnT <= 0) {
        this.starSpawnT = 2 + Math.random() * 3;
        const p = Player.body;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshBasicMaterial({ color: 0xfff2ae })
        );
        const x = p.x + (Math.random() - 0.5) * 56;
        const z = p.z + (Math.random() - 0.5) * 56;
        mesh.position.set(x, World.H + 10, z);
        this.scene.add(mesh);
        this.stars.push({ mesh, x, y: World.H + 10, z, vy: -14 - Math.random() * 8, spin: Math.random() });
      }
      if (this.starfallT <= 0) {
        this.clearStarfall(false);
      }
    }
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.y += s.vy * dt;
      s.mesh.position.y = s.y;
      s.mesh.rotation.y += dt * 4;
      s.mesh.rotation.x += dt * 3;
      if (Math.random() < 0.4) Particles.burst(s.x, s.y, s.z, [1, 0.95, 0.6], 1, 0.5);
      const bx = Math.floor(s.x), by = Math.floor(s.y), bz = Math.floor(s.z);
      if (by <= 0 || World.getBlock(bx, by, bz) !== B.AIR && !isFluid(World.getBlock(bx, by, bz))) {
        // impact!
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        this.stars.splice(i, 1);
        const impactPos = { x: s.x, y: s.y + 0.5, z: s.z };
        Particles.burst(impactPos.x, impactPos.y, impactPos.z, [1, 0.95, 0.6], 20, 4);
        SFX.starImpact(impactPos);
        Drops.spawn(s.x, s.y + 1, s.z, I.STAR, 1);
        if (Math.random() < 0.3) {
          const id = World.getBlock(bx, by, bz);
          if (id !== B.AIR && id !== B.BEDROCK && !isFluid(id) && Reg[id].shape === 'cube') {
            World.setBlock(bx, by, bz, B.STARDUST);
          }
        }
      }
    }
  },

  update(dt) {
    this.updateFalling(dt);
    this.updateFire(dt);
    this.updateHazards(dt);
    this.updateWeather(dt);
    this.updateStarfall(dt);
    this.updateSpawners(dt);
    this.updateLeafDecay(dt);
  },

  serialize() {
    return { weather: this.weather, weatherT: +this.weatherT.toFixed(1) };
  },
  deserialize(d) {
    if (!d) return;
    this.weather = d.weather || 'clear';
    this.weatherT = d.weatherT || 90;
  },
};
