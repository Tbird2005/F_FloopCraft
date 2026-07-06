// ============================================================
// F_Floop Craft — vehicles: Floopmobile, blue super car, skateboard, boat, obsidian boat.
// Vehicles have HP, can be attacked, and drop their item.
// ============================================================
const Vehicles = {
  scene: null,
  cars: [],
  boats: [],
  boards: [],
  driving: null,   // car object
  boating: null,   // boat object
  boardMesh: null,
  boardTrick: 0, boardTrickType: 0,

  init(scene) {
    this.scene = scene;
    this.cars = [];
    this.boats = [];
    this.boards = [];
    this.driving = null;
    this.boating = null;
    if (this.boardMesh) { scene.remove(this.boardMesh); this.boardMesh = null; }
  },

  isCarLike(v) { return v && (v.kind === 'car' || v.kind === 'supercar'); },
  isTreeLeaf(id) { return id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES || id === B.OASIS_LEAVES; },

  buildCarMesh() {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.6), mat(0xc22430));
    body.position.y = 0.55;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.55, 1.2), mat(0xbfe8f5));
    cabin.position.set(0, 1.05, -0.2);
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 0.1), mat(0xd4af37));
    grill.position.set(0, 0.5, 1.32);
    g.add(body, cabin, grill);
    const wheels = [];
    for (const [px, pz] of [[-0.8, 0.85], [0.8, 0.85], [-0.8, -0.85], [0.8, -0.85]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.5), mat(0x1a1a1a));
      w.position.set(px, 0.3, pz);
      g.add(w);
      wheels.push(w);
    }
    return { group: g, wheels };
  },


  buildSuperCarMesh() {
    const g = new THREE.Group();
    const mat = (c, emissive = 0) => new THREE.MeshLambertMaterial({ color: c, emissive, emissiveIntensity: emissive ? 0.12 : 0 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.42, 2.95), mat(0x116dff));
    body.position.y = 0.45;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 0.92), mat(0x0b4fd0));
    nose.position.set(0, 0.42, 1.12);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.34, 0.82), mat(0x0a3a9a));
    rear.position.set(0, 0.57, -1.08);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 0.9), mat(0x9eeeff));
    cabin.position.set(0, 0.88, -0.22);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.42), mat(0x63d8ff));
    windshield.position.set(0, 1.1, 0.28);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 2.85), mat(0xffffff));
    stripe.position.set(0, 0.68, 0);
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.15, 0.08), mat(0x111111));
    grill.position.set(0, 0.42, 1.52);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.18), mat(0x0b4fd0));
    spoiler.position.set(0, 0.93, -1.55);
    g.add(body, nose, rear, cabin, windshield, stripe, grill, spoiler);

    const wheels = [];
    for (const [px, pz] of [[-0.96, 1.02], [0.96, 1.02], [-0.96, -1.08], [0.96, -1.08]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.48, 0.52), mat(0x101014));
      w.position.set(px, 0.25, pz);
      g.add(w);
      wheels.push(w);
    }
    for (const [px, pz] of [[-0.48, 1.55], [0.48, 1.55]]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.10, 0.04), mat(0xd8f6ff, 0x4488ff));
      light.position.set(px, 0.5, pz);
      g.add(light);
    }
    return { group: g, wheels };
  },

  buildBoatMesh(obsidian) {
    const g = new THREE.Group();
    const root = new THREE.Group();
    // The old boat mesh was visually upside down. Flip only the model around
    // its side-to-side axis, then pre-mirror the bow piece so the tip still
    // points toward the boat's forward/yaw direction.
    root.rotation.x = Math.PI;
    root.position.y = 0.85;
    const mat = (c, emissive = 0) => new THREE.MeshLambertMaterial({ color: c, emissive, emissiveIntensity: emissive ? 0.08 : 0 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 2.2), mat(obsidian ? 0x211a2d : 0xa8814d));
    hull.position.y = 0.3;
    const bowPiece = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.5), mat(obsidian ? 0x15111f : 0x8a6a3c));
    bowPiece.position.set(0, 0.35, -1.25);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 1.8), mat(obsidian ? 0x3a294f : 0x7a5c36, obsidian ? 0x2a1744 : 0));
    inner.position.y = 0.55;
    root.add(hull, bowPiece, inner);
    g.add(root);
    return { group: g };
  },

  buildBoardMesh() {
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 1.0), new THREE.MeshLambertMaterial({ color: 0xa8814d }));
    deck.position.y = 0.12;
    g.add(deck);
    for (const [px, pz] of [[-0.12, 0.32], [0.12, 0.32], [-0.12, -0.32], [0.12, -0.32]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      w.position.set(px, 0.04, pz);
      g.add(w);
    }
    return g;
  },

  placeCar(x, y, z, yaw) {
    const { group, wheels } = this.buildCarMesh();
    group.position.set(x, y, z);
    this.scene.add(group);
    const car = {
      kind: 'car', hp: 40, item: I.CAR,
      x, y, z, yaw: yaw || 0, speed: 0, fallDist: 0,
      body: { x, y, z, vx: 0, vy: 0, vz: 0, w: 0.85, h: 1.3, onGround: false, hitH: false },
      group, wheels, wheelSpin: 0, smashT: 0,
    };
    this.cars.push(car);
    return car;
  },


  placeSuperCar(x, y, z, yaw) {
    const { group, wheels } = this.buildSuperCarMesh();
    group.position.set(x, y, z);
    this.scene.add(group);
    const car = {
      kind: 'supercar', hp: 60, item: I.SUPER_CAR,
      x, y, z, yaw: yaw || 0, speed: 0, fallDist: 0,
      body: { x, y, z, vx: 0, vy: 0, vz: 0, w: 0.92, h: 1.12, onGround: false, hitH: false },
      group, wheels, wheelSpin: 0, smashT: 0,
    };
    this.cars.push(car);
    return car;
  },

  placeBoat(x, y, z, yaw, obsidian) {
    const { group } = this.buildBoatMesh(!!obsidian);
    group.position.set(x, y, z);
    this.scene.add(group);
    const boat = {
      kind: 'boat', hp: obsidian ? 34 : 20, item: obsidian ? I.OBSIDIAN_BOAT : I.BOAT, lavaBoat: !!obsidian,
      x, y, z, yaw: yaw || 0, speed: 0, fallDist: 0,
      body: { x, y, z, vx: 0, vy: 0, vz: 0, w: 0.65, h: 0.8, onGround: false, hitH: false },
      group,
    };
    this.boats.push(boat);
    return boat;
  },

  placeBoard(x, y, z, yaw) {
    const mesh = this.buildBoardMesh();
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw || 0;
    this.scene.add(mesh);
    const board = { kind: 'board', hp: 12, item: I.SKATEBOARD, x, y, z, yaw: yaw || 0, mesh };
    this.boards.push(board);
    return board;
  },

  remove(v) {
    if (this.isCarLike(v)) {
      this.scene.remove(v.group);
      const i = this.cars.indexOf(v);
      if (i >= 0) this.cars.splice(i, 1);
      if (this.driving === v) this.driving = null;
    } else if (v.kind === 'boat') {
      this.scene.remove(v.group);
      const i = this.boats.indexOf(v);
      if (i >= 0) this.boats.splice(i, 1);
      if (this.boating === v) this.boating = null;
    } else {
      this.scene.remove(v.mesh);
      const i = this.boards.indexOf(v);
      if (i >= 0) this.boards.splice(i, 1);
    }
  },

  // vehicles take damage like mobs; destroyed -> item drop
  hurt(v, dmg, src) {
    v.hp -= dmg;
    v.flashT = 0.3; // orange damage flash
    SFX.mobHurt({ x: v.x, y: v.y + 0.8, z: v.z });
    const pos = v.body ? v.body : v;
    Particles.burst(pos.x, pos.y + 0.6, pos.z, [0.5, 0.5, 0.5], 6, 2);
    if (v.hp <= 0) {
      if (this.driving === v || this.boating === v) this.exit(true);
      this.remove(v);
      Drops.spawn(pos.x, pos.y + 0.5, pos.z, v.item, 1);
      UI.chat(Reg[v.item].name + ' broke apart!', '#ff8080');
    }
  },

  maxHp(v) { return v.kind === 'supercar' ? 60 : v.kind === 'car' ? 40 : v.kind === 'boat' ? (v.lavaBoat ? 34 : 20) : 12; },

  applyFlash(v, dt) {
    const obj = v.group || v.mesh;
    if (!obj) return;
    if (v.flashT > 0) v.flashT -= dt;
    const on = v.flashT > 0;
    if (on === v._flashOn) return; // only touch materials when the state flips
    v._flashOn = on;
    obj.traverse(o => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.emissive) {
            m.emissive.setHex(0xff7020);
            m.emissiveIntensity = on ? 0.7 : 0;
          }
        }
      }
    });
  },


  vehicleLightLevel(v) {
    const pos = v.body || v;
    const h = v.body ? (v.body.h || 1) : 0.4;
    const raw = World.getLightRaw(Math.floor(pos.x), Math.floor(pos.y + h * 0.55), Math.floor(pos.z));
    const sky = (raw >> 4) * World.dayFUniform.value;
    const block = raw & 15;
    return Math.max(0.06, Math.max(block, sky) / 15);
  },

  tintVehicle(v, dt, force) {
    const obj = v.group || v.mesh;
    if (!obj) return;
    v.tintT = (v.tintT || 0) - dt;
    if (!force && v.tintT > 0) return;
    v.tintT = 0.20;
    const l = this.vehicleLightLevel(v);
    if (!force && Math.abs(l - (v._light || -1)) < 0.035) return;
    v._light = l;
    obj.traverse(o => {
      if (!o.isMesh && !o.isSprite) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.color) continue;
        if (!m.userData.vehicleBaseCol) m.userData.vehicleBaseCol = m.color.clone();
        m.color.copy(m.userData.vehicleBaseCol).multiplyScalar(l);
      }
    });
  },

  applyExplosion(ex, ey, ez, range, maxDmg) {
    for (const v of [...this.cars, ...this.boats, ...this.boards]) {
      const pos = v.body ? v.body : v;
      const d = Math.sqrt((pos.x - ex) ** 2 + ((pos.y + 0.5) - ey) ** 2 + (pos.z - ez) ** 2);
      if (d < range) {
        const dmg = Math.round(maxDmg * (1 - d / range));
        if (dmg > 0) this.hurt(v, dmg);
      }
    }
  },

  rayAABB(min, max, ox, oy, oz, dx, dy, dz, maxDist) {
    const o = [ox, oy, oz], d = [dx, dy, dz];
    let t0 = 0, t1 = maxDist;
    for (let ax = 0; ax < 3; ax++) {
      if (Math.abs(d[ax]) < 1e-8) { if (o[ax] < min[ax] || o[ax] > max[ax]) return null; }
      else {
        let ta = (min[ax] - o[ax]) / d[ax], tb = (max[ax] - o[ax]) / d[ax];
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) return null;
      }
    }
    return t0;
  },

  // raycast against ALL vehicles; returns {v, dist} or null
  rayVehicle(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = null;
    for (const car of this.cars) {
      const b = car.body;
      const hw = car.kind === 'supercar' ? 1.25 : 1.1;
      const hl = car.kind === 'supercar' ? 1.55 : 1.4;
      const hh = car.kind === 'supercar' ? 1.25 : 1.5;
      const t = this.rayAABB([b.x - hw, b.y, b.z - hl], [b.x + hw, b.y + hh, b.z + hl], ox, oy, oz, dx, dy, dz, maxDist);
      if (t !== null && (!best || t < best.dist)) best = { v: car, dist: t };
    }
    for (const boat of this.boats) {
      const b = boat.body;
      const t = this.rayAABB([b.x - 0.8, b.y, b.z - 1.2], [b.x + 0.8, b.y + 1, b.z + 1.2], ox, oy, oz, dx, dy, dz, maxDist);
      if (t !== null && (!best || t < best.dist)) best = { v: boat, dist: t };
    }
    for (const board of this.boards) {
      const t = this.rayAABB([board.x - 0.5, board.y - 0.1, board.z - 0.7], [board.x + 0.5, board.y + 0.4, board.z + 0.7], ox, oy, oz, dx, dy, dz, maxDist);
      if (t !== null && (!best || t < best.dist)) best = { v: board, dist: t };
    }
    return best;
  },

  enter(v) {
    if (this.isCarLike(v)) {
      this.driving = v;
      UI.chat(v.kind === 'supercar' ? 'Blue Super Car! 2x speed, 60 HP. Shift to hop out.' : 'Vroom. Shift to hop out. (Floopmobile™ — crash responsibly)', '#ffd97a');
    } else if (v.kind === 'boat') {
      this.boating = v;
      UI.chat('Boat mode. W to paddle, A/D to steer, Shift to hop out.', '#ffd97a');
    } else {
      this.startBoard(v);
    }
  },

  exit(force) {
    const v = this.driving || this.boating;
    if (!v) return false;
    const spot = this.findSafeExitSpot(v);
    this.driving = null;
    this.boating = null;
    if (spot) {
      Player.body.x = spot.x; Player.body.y = spot.y; Player.body.z = spot.z;
    } else {
      // Still prefer a safe spot, but never trap the player inside a vehicle.
      // If the 4-block safety search fails, hop out at the normal side exit
      // with no extra safety refusal. This can be unsafe, but it is better
      // than soft-locking the player in a boat/car forever.
      const sx = v.body.x + Math.cos(v.yaw) * 1.6;
      const sz = v.body.z - Math.sin(v.yaw) * 1.6;
      Player.body.x = sx; Player.body.z = sz;
      Player.body.y = v.body.y + 0.2;
      if (!force) UI.chat('No safe exit spot — hopping out anyway.', '#ffd97a');
    }
    Player.body.vx = Player.body.vy = Player.body.vz = 0;
    return true;
  },

  exitCellSafe(x, y, z) {
    if (!World.hasChunk(x, z)) return false;
    const foot = World.getBlock(x, y, z);
    const head = World.getBlock(x, y + 1, z);
    const open = (id) => id === B.AIR || isWater(id);
    if (isLava(foot) || isLava(head)) return false;
    if (!open(foot) || !open(head)) return false;
    if (!Physics.solidAt(x + 0.5, y - 0.5, z + 0.5)) return false;
    const w = Player.body.w || 0.32;
    // Keep the actual player body from clipping into slabs, stairs, doors, etc.
    if (Physics.boxHit(x + 0.5 - w, y + 0.02, z + 0.5 - w, x + 0.5 + w, y + 1.78, z + 0.5 + w)) return false;
    return true;
  },

  findSafeExitSpot(v) {
    const b = v.body || Player.body;
    const yaw = v.yaw || Player.yaw || 0;
    const cx = Math.floor(b.x), cy = Math.floor(b.y), cz = Math.floor(b.z);
    const prefX = b.x + Math.cos(yaw) * 1.6;
    const prefZ = b.z - Math.sin(yaw) * 1.6;
    const candidates = [];
    // Search within four blocks of the vehicle/player.  This covers the requested
    // 4x4x4 nearby safety area while preferring the side you would normally exit on.
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
      const x = cx + dx, y = cy + dy, z = cz + dz;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4 || Math.abs(dz) > 4) continue;
      if (!this.exitCellSafe(x, y, z)) continue;
      const px = x + 0.5, pz = z + 0.5;
      const prefD = (px - prefX) * (px - prefX) + (pz - prefZ) * (pz - prefZ);
      const vehD = (px - b.x) * (px - b.x) + (pz - b.z) * (pz - b.z) + (y - b.y) * (y - b.y) * 0.35;
      candidates.push({ x: px, y: y + 0.02, z: pz, score: prefD * 0.72 + vehD * 0.28 + Math.abs(dy) * 0.06 });
    }
    candidates.sort((a, b2) => a.score - b2.score);
    return candidates[0] || null;
  },

  updateVehicleCommon(v, dt, drivingThis, isBoat) {
    const b = v.body;
    if (!World.hasChunk(Math.floor(b.x), Math.floor(b.z))) return;
    const inWater = Physics.inWater(b, 0.25);
    const inLava = Physics.inLava(b, 0.25);
    const goodBoatFluid = isBoat && (v.lavaBoat ? inLava : inWater);
    const wrongBoatFluid = isBoat && (v.lavaBoat ? inWater : inLava);

    if (drivingThis && !Player.dead) {
      const k = Player.keys;
      const isSuper = v.kind === 'supercar';
      const maxF = isBoat ? (goodBoatFluid ? (v.lavaBoat ? 8.4 : 9.5) : 1.5) : (isSuper ? 23.0 : 11.5);
      const reverseMax = isBoat ? -4.5 : (isSuper ? -7.0 : -4.5);
      const accel = k['KeyW'] ? (isBoat ? 10 : (isSuper ? 28 : 14)) : 0;
      const brake = k['KeyS'] ? (isBoat ? 8 : (isSuper ? 24 : 16)) : 0;
      v.speed += (accel - brake) * dt;
      v.speed = Math.max(reverseMax, Math.min(maxF, v.speed));
      if (!accel && !brake) v.speed *= (b.onGround || inWater || inLava ? (isSuper ? 0.99 : 0.985) : 0.999);
      const steer = (k['KeyA'] ? 1 : 0) - (k['KeyD'] ? 1 : 0);
      v.yaw += steer * dt * (isSuper ? 2.15 : 1.9) * Math.max(-1, Math.min(1, v.speed / 5));
    } else {
      v.speed *= 0.96;
    }

    b.vx = Math.sin(v.yaw + Math.PI) * -v.speed;
    b.vz = Math.cos(v.yaw + Math.PI) * -v.speed;

    if (isBoat && goodBoatFluid) {
      // float to the correct surface: normal boats on water, obsidian boats on lava
      b.vy += (v.lavaBoat ? 15 : 18) * dt;
      b.vy = Math.min(b.vy, v.lavaBoat ? 1.8 : 2.2);
      const headId = World.getBlock(Math.floor(b.x), Math.floor(b.y + 0.7), Math.floor(b.z));
      if (v.lavaBoat ? !isLava(headId) : !isWater(headId)) b.vy = Math.min(b.vy, 0); // don't pop out of the fluid
      b.vy -= (v.lavaBoat ? 7.5 : 9) * dt;
    } else {
      if (inWater || inLava) {
        v.speed *= wrongBoatFluid ? 0.88 : 0.94;
        if (isBoat && wrongBoatFluid) {
          // Wrong liquid: obsidian boats sink in water; wood boats sink in lava.
          const sneaking = Player.keys['ShiftLeft'] || Player.keys['ShiftRight'];
          b.vy -= (sneaking ? 20 : 8) * dt;
        } else if (inWater) b.vy += 6 * dt;
      }
      b.vy -= Physics.GRAV * dt;
    }
    b.vy = Math.max(b.vy, -36);

    // fast cars are mobile deforestation units: clear weak blocks around them
    // so edges and corners can't snag on stray leaves. Super cars shred tree leaves
    // in a 4x4 sweep with ZERO vehicle/player clank damage from those leaves.
    if (!isBoat && Math.abs(v.speed) > 4) {
      v.smashT = (v.smashT || 0) - dt;
      if (v.smashT <= 0) {
        v.smashT = v.kind === 'supercar' ? 0.075 : 0.1;
        let hitPlayer = false;
        const x0 = v.kind === 'supercar' ? -2 : -2, x1 = v.kind === 'supercar' ? 1 : 2;
        const z0 = v.kind === 'supercar' ? -2 : -2, z1 = v.kind === 'supercar' ? 1 : 2;
        for (let dx = x0; dx <= x1; dx++) {
          for (let dy = 0; dy <= 2; dy++) {
            for (let dz = z0; dz <= z1; dz++) {
              const bx = Math.floor(b.x + dx), by = Math.floor(b.y + dy), bz = Math.floor(b.z + dz);
              const id = World.getBlock(bx, by, bz);
              if (Reg[id] && Reg[id].weak) {
                const leaf = this.isTreeLeaf(id);
                World.setBlock(bx, by, bz, B.AIR);
                Particles.blockBurst(bx, by, bz, id);
                if (!(v.kind === 'supercar' && leaf)) {
                  this.hurt(v, 0.3);
                  if (!hitPlayer && drivingThis && Math.random() < 0.35) { Player.hurt(1, 0, 0); hitPlayer = true; }
                }
              }
            }
          }
        }
      }
    }
    // Lava melts normal vehicles, but obsidian boats are made for it.
    if (inLava && !(isBoat && v.lavaBoat)) {
      v.lavaT = (v.lavaT || 0) - dt;
      if (v.lavaT <= 0) { v.lavaT = 0.5; this.hurt(v, 2); }
    }

    const preSpeed = v.speed;
    const wasY = b.y, fallingBefore = b.vy < 0;
    Physics.move(b, dt, { stepUp: true, stepLift: isBoat ? 0.55 : 1.06 });

    // vehicle fall damage (lenient)
    if (!(isBoat ? goodBoatFluid : inWater)) {
      if (fallingBefore && wasY > b.y) v.fallDist += wasY - b.y;
      if (b.onGround) {
        if (v.fallDist > 7) {
          const dmg = Math.floor((v.fallDist - 6) * 0.6);
          if (dmg > 0) {
            this.hurt(v, dmg);
            if (drivingThis) Player.hurt(Math.max(1, Math.floor(dmg * 0.6)), 0, 0, { pierce: true });
          }
        }
        v.fallDist = 0;
      }
    } else v.fallDist = 0;

    if (b.hitH) {
      // did we hit something WEAK (leaves/glass)? then smash through it, no clunk
      let smashed = false;
      if (!isBoat && Math.abs(preSpeed) > 2) {
        const dirSign = Math.sign(preSpeed) || 1;
        const fx = Math.sin(v.yaw + Math.PI) * -dirSign;
        const fz = Math.cos(v.yaw + Math.PI) * -dirSign;
        for (let dy = 0; dy < 3; dy++) {
          for (let side = -1; side <= 1; side++) {
            const bx = Math.floor(b.x + fx * 1.3 + fz * side * 0.7);
            const by = Math.floor(b.y + 0.3 + dy * 0.8);
            const bz = Math.floor(b.z + fz * 1.3 - fx * side * 0.7);
            const id = World.getBlock(bx, by, bz);
            if (Reg[id] && Reg[id].weak) {
              const leaf = this.isTreeLeaf(id);
              World.setBlock(bx, by, bz, B.AIR);
              Particles.blockBurst(bx, by, bz, id);
              smashed = true;
              if (!(v.kind === 'supercar' && leaf)) {
                this.hurt(v, 0.4);
                if (drivingThis && Math.random() < 0.35) Player.hurt(1, 0, 0);
              }
            }
          }
        }
      }
      if (smashed) {
        v.speed = preSpeed * (v.kind === 'supercar' ? 0.97 : 0.92); // super car barely notices leaves/glass
        SFX.breakBlk();
      } else {
        if (Math.abs(preSpeed) > 6 && drivingThis) {
          SFX.hurt({ x: v.x, y: v.y + 0.8, z: v.z });
          UI.chat('*CLUNK*', '#aaa');
          this.hurt(v, 2);
          if (Math.random() < 0.5) Player.hurt(Math.max(1, Math.round(Math.abs(preSpeed) / 3)), 0, 0);
        }
        v.speed *= 0.3;
      }
    }

    // cars run over monsters
    if (!isBoat && Math.abs(v.speed) > 4 && drivingThis) {
      for (const m of Mobs.list) {
        if (m.dead) continue;
        const mb = m.body;
        if (Math.abs(mb.x - b.x) < 1.4 && Math.abs(mb.z - b.z) < 1.7 && Math.abs(mb.y - b.y) < 1.4) {
          Mobs.hurt(m, Math.round(Math.abs(v.speed) * 1.1),
            Math.sin(v.yaw + Math.PI) * -v.speed * 0.8, Math.cos(v.yaw + Math.PI) * -v.speed * 0.8, 'player');
          this.hurt(v, 1);
        }
      }
    }
  },

  update(dt) {
    for (const car of this.cars) {
      this.updateVehicleCommon(car, dt, this.driving === car, false);
      const b = car.body;
      car.wheelSpin += car.speed * dt * 3;
      car.group.position.set(b.x, b.y, b.z);
      car.group.rotation.y = car.yaw;
      for (const w of car.wheels) w.rotation.x = car.wheelSpin;
      this.applyFlash(car, dt);
      this.tintVehicle(car, dt);
      if (this.driving === car) {
        Player.body.x = b.x; Player.body.y = b.y + 0.35; Player.body.z = b.z;
        Player.body.vx = Player.body.vy = Player.body.vz = 0;
      }
    }
    for (const boat of this.boats) {
      this.updateVehicleCommon(boat, dt, this.boating === boat, true);
      const b = boat.body;
      boat.group.position.set(b.x, b.y, b.z);
      boat.group.rotation.y = boat.yaw;
      this.applyFlash(boat, dt);
      this.tintVehicle(boat, dt);
      if (this.boating === boat) {
        // Keep the rider at the normal boat height. Lava safety is handled by
        // the hazard check ignoring the rider's lower legs while mounted in an
        // obsidian boat, not by floating the player unrealistically high.
        Player.body.x = b.x; Player.body.y = b.y + 0.25; Player.body.z = b.z;
        Player.body.vx = Player.body.vy = Player.body.vz = 0;
      }
    }
    for (const board of this.boards) {
      this.applyFlash(board, dt);
      this.tintVehicle(board, dt);
    }

    // HP readout while riding
    const active = this.driving || this.boating;
    UI.setVehicleHud(active
      ? (active.kind === 'supercar' ? '🏎️ ' : active.kind === 'car' ? '🚗 ' : active.lavaBoat ? '🛶 ' : '⛵ ') + Math.max(0, Math.ceil(active.hp)) + '/' + this.maxHp(active) + ' HP'
      : null);
  },

  // ---------- skateboard ----------
  startBoard(boardEntity) {
    if (boardEntity) this.remove(boardEntity);
    if (!this.boardMesh) this.boardMesh = this.buildBoardMesh();
    this.scene.add(this.boardMesh);
    Player.boarding = true;
    this.boardTrick = 0;
    UI.chat('Skateboard! Space to ollie, space in the air to kickflip. Shift to hop off.', '#ffd97a');
  },

  stopBoard(placeDown, force) {
    if (!Player.boarding) return true;
    const oldX = Player.body.x, oldY = Player.body.y, oldZ = Player.body.z;
    const spot = this.findSafeExitSpot({ body: Player.body, yaw: Player.yaw + Math.PI });
    Player.boarding = false;
    if (this.boardMesh) this.scene.remove(this.boardMesh);
    if (spot) {
      Player.body.x = spot.x; Player.body.y = spot.y; Player.body.z = spot.z;
    } else if (!force) {
      // No safe landing found: dismount anyway instead of trapping the player
      // in skateboard mode. Keep the rider at the current spot and let normal
      // physics handle whatever happens next.
      UI.chat('No safe exit spot — hopping off anyway.', '#ffd97a');
    }
    Player.body.vx = Player.body.vy = Player.body.vz = 0;
    if (placeDown) {
      // Drop the board where it was being ridden, not on a random safe ledge.
      this.placeBoard(oldX, oldY + 0.02, oldZ, Player.yaw + Math.PI);
    }
    return true;
  },

  trick(type) {
    if (this.boardTrick <= 0) {
      this.boardTrick = 0.45;
      this.boardTrickType = type;
      if (type === 1) UI.chat('Kickflip!', '#7df5ec');
    }
  },

  updateBoard(dt) {
    if (!Player.boarding || !this.boardMesh) return;
    const b = Player.body;
    if (this.boardTrick > 0) this.boardTrick -= dt;
    const prog = this.boardTrick > 0 ? 1 - this.boardTrick / 0.45 : 0;
    this.boardMesh.position.set(b.x, b.y + 0.02, b.z);
    this.boardMesh.rotation.set(0, Player.yaw + Math.PI, 0);
    this.tintVehicle({ kind: 'board-riding', mesh: this.boardMesh, x: b.x, y: b.y, z: b.z }, dt);
    if (prog > 0) {
      if (this.boardTrickType === 1) this.boardMesh.rotation.z = prog * Math.PI * 2;
      else this.boardMesh.rotation.x = Math.sin(prog * Math.PI) * 0.5;
    }
  },

  serialize() {
    return this.cars.map(c => ({ kind: c.kind || 'car', item: c.item, x: +c.body.x.toFixed(1), y: +c.body.y.toFixed(1), z: +c.body.z.toFixed(1), yaw: +c.yaw.toFixed(2), hp: c.hp }));
  },
  serializeBoats() {
    return this.boats.map(c => ({ x: +c.body.x.toFixed(1), y: +c.body.y.toFixed(1), z: +c.body.z.toFixed(1), yaw: +c.yaw.toFixed(2), hp: c.hp, lavaBoat: !!c.lavaBoat, item: c.item }));
  },
  serializeBoards() {
    return this.boards.map(b => ({ x: +b.x.toFixed(1), y: +b.y.toFixed(1), z: +b.z.toFixed(1), yaw: +b.yaw.toFixed(2), hp: b.hp }));
  },

  deserialize(cars, boards, boats) {
    for (const c of cars || []) {
      const isSuper = c.kind === 'supercar' || c.item === I.SUPER_CAR;
      const v = isSuper ? this.placeSuperCar(c.x, c.y, c.z, c.yaw) : this.placeCar(c.x, c.y, c.z, c.yaw);
      if (c.hp) v.hp = c.hp;
    }
    for (const b of boards || []) { const v = this.placeBoard(b.x, b.y, b.z, b.yaw); if (b.hp) v.hp = b.hp; }
    for (const b of boats || []) { const v = this.placeBoat(b.x, b.y, b.z, b.yaw, !!(b.lavaBoat || b.item === I.OBSIDIAN_BOAT)); if (b.hp) v.hp = b.hp; }
  },
};
