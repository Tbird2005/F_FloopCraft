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

  isCarLike(v) { return v && (v.kind === 'car' || v.kind === 'supercar' || v.kind === 'plane'); },
  isTreeLeaf(id) { return id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES || id === B.OASIS_LEAVES; },

  riderYOffset(v) {
    if (!v) return 0.35;
    return v.kind === 'plane' ? 0.62 : v.kind === 'boat' ? 0.25 : v.kind === 'board' ? 0.08 : 0.35;
  },

  ensureVehicleFarBody(b) {
    if (typeof Physics !== 'undefined' && Physics.ensureFarBody && b) Physics.ensureFarBody(b);
  },

  blockX(b, dx) {
    this.ensureVehicleFarBody(b);
    const st = b && b._farPos;
    return st ? st.ox + Math.floor(st.x + (dx || 0)) : Math.floor((b ? b.x : 0) + (dx || 0));
  },

  blockZ(b, dz) {
    this.ensureVehicleFarBody(b);
    const st = b && b._farPos;
    return st ? st.oz + Math.floor(st.z + (dz || 0)) : Math.floor((b ? b.z : 0) + (dz || 0));
  },

  blockY(b, dy) {
    this.ensureVehicleFarBody(b);
    const st = b && b._farPos;
    return st ? st.oy + Math.floor(st.y + (dy || 0)) : Math.floor((b ? b.y : 0) + (dy || 0));
  },

  copyVehicleBodyToPlayer(v, yOffset) {
    const b = v && v.body;
    if (!b || !Player || !Player.body) return;
    this.ensureVehicleFarBody(b);
    const st = b._farPos;
    if (st) Player.body._farPos = { ox: st.ox, oy: st.oy, oz: st.oz, x: st.x, y: st.y + (yOffset || 0), z: st.z };
    else if (Player.body._farPos) delete Player.body._farPos;
    Player.body.x = b.x; Player.body.y = b.y + (yOffset || 0); Player.body.z = b.z;
    Player.body.vx = Player.body.vy = Player.body.vz = 0;
    Player.fallDist = 0;
  },

  vehicleHudLabel(v) {
    if (!v) return null;
    const name = v.kind === 'plane' ? 'Plane ' : v.kind === 'supercar' ? 'Blue Super Car ' : v.kind === 'car' ? 'Floopmobile ' : v.kind === 'boat' ? (v.lavaBoat ? 'Obsidian Boat ' : 'Boat ') : 'Skateboard ';
    return name + Math.max(0, Math.ceil(v.hp || 0)) + '/' + this.maxHp(v) + ' HP';
  },

  planeTakeoffSpeed() { return 14.0; },

  planeThrottleAccel(v) {
    const s = Math.abs((v && v.speed) || 0);
    if (s < 6) return 3.8;
    if (s < this.planeTakeoffSpeed()) return 6.2;
    if (s < 22) return 11.0;
    if (s < 34) return 18.0;
    return 24.0;
  },

  vehicleDriveProfile(v, isBoat, goodBoatFluid) {
    const isSuper = v.kind === 'supercar';
    const isPlane = v.kind === 'plane';
    if (isBoat) {
      return {
        maxF: goodBoatFluid ? (v.lavaBoat ? 8.4 : 9.5) : 1.5,
        reverseMax: -4.5,
        accel: 10,
        brake: 8,
        idleDrag: 0.985,
        steerRate: 1.9,
      };
    }
    return {
      maxF: isPlane ? 46.0 : (isSuper ? 23.0 : 11.5),
      reverseMax: isPlane ? -3.5 : (isSuper ? -7.0 : -4.5),
      accel: isPlane ? this.planeThrottleAccel(v) : (isSuper ? 28 : 14),
      brake: isPlane ? 24 : (isSuper ? 24 : 16),
      idleDrag: isPlane ? 0.992 : (isSuper ? 0.99 : 0.985),
      steerRate: isPlane ? 1.55 : (isSuper ? 2.15 : 1.9),
    };
  },

  applyPlaneFlight(v, dt, drivingThis, inWater, inLava, keys) {
    if (!v || v.kind !== 'plane' || !v.body) return false;
    const b = v.body;
    const k = keys || {};
    const liftSpeed = Math.abs(v.speed || 0);
    const takeoff = this.planeTakeoffSpeed();
    const lift = Math.max(0, Math.min(1, (liftSpeed - takeoff) / (46 - takeoff)));
    if (drivingThis) {
      if (k.Space && liftSpeed >= takeoff) b.vy += (10 + lift * 14) * dt;
      else if (k.KeyW && liftSpeed > 20) b.vy += 3.5 * lift * dt;
      if (k.KeyS) b.vy -= (6 + lift * 2) * dt;
    }
    if (inWater || inLava) v.speed *= 0.90;
    b.vy -= Physics.GRAV * (drivingThis && liftSpeed >= takeoff ? 0.42 : 0.92) * dt;
    b.vy = Math.max(-26, Math.min(16, b.vy));
    return true;
  },

  // ---- vehicle pixel-art textures -------------------------------------
  // Canvas textures are cached and shared; materials stay per-instance
  // because tintVehicle() mutates material.color with the local light level.
  _vehTexCache: {},
  vehTex(key, draw, w = 16, h = 16) {
    let t = this._vehTexCache[key];
    if (t) return t;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    return (this._vehTexCache[key] = t);
  },
  vehMat(key, draw, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ map: this.vehTex(key, draw) }, opts || {}));
  },

  // shared painters
  _pxSpeck(c, cols, n, seed) {
    const r = NoiseGen.mulberry(seed || 777);
    for (let i = 0; i < n; i++) { c.fillStyle = cols[(r() * cols.length) | 0]; c.fillRect((r() * 16) | 0, (r() * 16) | 0, 1, 1); }
  },
  _drawWheelSide(c) {
    // tire with tread notches + bolted hub
    c.fillStyle = '#101013'; c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#2e2e35';
    for (let i = 1; i < 16; i += 3) { c.fillRect(i, 0, 1, 1); c.fillRect(i, 15, 1, 1); c.fillRect(0, i, 1, 1); c.fillRect(15, i, 1, 1); }
    c.fillStyle = '#8f939c'; c.fillRect(5, 5, 6, 6);
    c.fillStyle = '#5c5f66'; c.fillRect(5, 5, 6, 1); c.fillRect(5, 5, 1, 6);
    c.fillStyle = '#4a4d55'; c.fillRect(7, 7, 2, 2);
    c.fillStyle = '#c4c8d0';
    c.fillRect(6, 6, 1, 1); c.fillRect(9, 6, 1, 1); c.fillRect(6, 9, 1, 1); c.fillRect(9, 9, 1, 1);
  },
  _drawWheelTread(c) {
    c.fillStyle = '#141417'; c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#26262c';
    for (let yy = 1; yy < 16; yy += 3) c.fillRect(0, yy, 16, 1);
    c.fillStyle = '#000004';
    for (let yy = 2; yy < 16; yy += 6) { c.fillRect(3, yy, 2, 1); c.fillRect(11, yy + 3 > 15 ? 1 : yy + 3, 2, 1); }
  },
  wheelMats() {
    const side = () => this.vehMat('wheel_side', (c) => this._drawWheelSide(c));
    const tread = () => this.vehMat('wheel_tread', (c) => this._drawWheelTread(c));
    const s = side(), t = tread();
    return [s, s, t, t, t, t]; // +x,-x,+y,-y,+z,-z: hubs face outward on x
  },

  buildCarMesh() {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const bodySide = this.vehMat('car_body', (c) => {
      c.fillStyle = '#c22430'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#e04a56'; c.fillRect(0, 0, 16, 2);
      c.fillStyle = '#7d121b'; c.fillRect(0, 13, 16, 3);
      c.fillStyle = '#911722'; c.fillRect(5, 2, 1, 11); c.fillRect(10, 2, 1, 11);
      c.fillStyle = '#f2d8da'; c.fillRect(6, 6, 2, 1); c.fillRect(11, 6, 2, 1);
      this._pxSpeck(c, ['#b01e2a', '#cf2f3c'], 18, 11);
    });
    const roof = this.vehMat('car_roof', (c) => {
      c.fillStyle = '#c22430'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#e04a56'; c.fillRect(1, 1, 14, 14);
      c.fillStyle = '#c22430'; c.fillRect(3, 3, 10, 10);
      this._pxSpeck(c, ['#b01e2a', '#d84a55'], 12, 12);
    });
    const under = mat(0x2a1215);
    const windowTex = (key, glass, glassHi, pillar) => this.vehMat(key, (c) => {
      c.fillStyle = glass; c.fillRect(0, 0, 16, 16);
      c.fillStyle = glassHi; c.fillRect(0, 0, 16, 3);
      c.fillStyle = pillar; c.fillRect(0, 0, 2, 16); c.fillRect(14, 0, 2, 16); c.fillRect(0, 14, 16, 2);
      c.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 4; i < 10; i++) c.fillRect(i, 12 - i < 0 ? 0 : 12 - i, 1, 1);
    });
    const win = windowTex('car_window', '#9fd6ec', '#cdeef9', '#dfe3e8');
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.6), [bodySide, bodySide, roof, under, bodySide, bodySide]);
    body.position.y = 0.55;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.55, 1.2), [win, win, roof, under, win, win]);
    cabin.position.set(0, 1.05, -0.2);
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 0.1), this.vehMat('car_grill', (c) => {
      c.fillStyle = '#d4af37'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#8d6f17';
      for (let yy = 3; yy < 14; yy += 3) c.fillRect(2, yy, 12, 1);
      c.fillStyle = '#fff8dc'; c.fillRect(1, 6, 2, 3); c.fillRect(13, 6, 2, 3);
    }));
    grill.position.set(0, 0.5, 1.32);
    g.add(body, cabin, grill);
    const wheels = [];
    for (const [px, pz] of [[-0.8, 0.85], [0.8, 0.85], [-0.8, -0.85], [0.8, -0.85]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.5), this.wheelMats());
      w.position.set(px, 0.3, pz);
      g.add(w);
      wheels.push(w);
    }
    return { group: g, wheels };
  },


  buildSuperCarMesh() {
    const g = new THREE.Group();
    const mat = (c, emissive = 0) => new THREE.MeshLambertMaterial({ color: c, emissive, emissiveIntensity: emissive ? 0.12 : 0 });

    const bodySide = this.vehMat('super_body', (c) => {
      c.fillStyle = '#116dff'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#4f97ff'; c.fillRect(0, 0, 16, 2);
      c.fillStyle = '#0a2f66'; c.fillRect(0, 12, 16, 4);
      // angular intake slashes
      c.fillStyle = '#062a55';
      for (let i = 0; i < 5; i++) { c.fillRect(9 + i, 10 - i, 1, 3); c.fillRect(2 + i, 10 - i, 1, 3); }
      c.fillStyle = '#8fc1ff'; c.fillRect(1, 4, 4, 1);
      this._pxSpeck(c, ['#0e5cd8', '#2f83ff'], 14, 21);
    });
    const bodyTop = this.vehMat('super_top', (c) => {
      c.fillStyle = '#116dff'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#4f97ff'; c.fillRect(1, 1, 14, 14);
      c.fillStyle = '#116dff'; c.fillRect(2, 2, 12, 12);
      // hood vents
      c.fillStyle = '#0a2f66';
      c.fillRect(4, 4, 1, 8) ; c.fillRect(6, 4, 1, 8); c.fillRect(9, 4, 1, 8); c.fillRect(11, 4, 1, 8);
    });
    const accent = this.vehMat('super_accent', (c) => {
      c.fillStyle = '#0b4fd0'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#0a3a9a'; c.fillRect(0, 10, 16, 6);
      c.fillStyle = '#3f7fe8'; c.fillRect(0, 0, 16, 1);
      c.fillStyle = '#083a99';
      for (let i = 3; i < 14; i += 4) c.fillRect(i, 3, 1, 8);
    });
    const under = mat(0x0a0a12);
    const win = this.vehMat('super_window', (c) => {
      c.fillStyle = '#63d8ff'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#a8ecff'; c.fillRect(0, 0, 16, 3);
      c.fillStyle = '#0c1522'; c.fillRect(0, 0, 2, 16); c.fillRect(14, 0, 2, 16); c.fillRect(0, 14, 16, 2);
      c.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 3; i < 9; i++) c.fillRect(i, 11 - i, 1, 1);
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.42, 2.95), [bodySide, bodySide, bodyTop, under, bodySide, bodySide]);
    body.position.y = 0.45;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 0.92), accent);
    nose.position.set(0, 0.42, 1.12);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.34, 0.82), accent);
    rear.position.set(0, 0.57, -1.08);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 0.9), [win, win, bodyTop, under, win, win]);
    cabin.position.set(0, 0.88, -0.22);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.42), mat(0x63d8ff));
    windshield.position.set(0, 1.1, 0.28);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 2.85), mat(0xffffff));
    stripe.position.set(0, 0.68, 0);
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.15, 0.08), this.vehMat('super_grill', (c) => {
      c.fillStyle = '#111111'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#2c2c31';
      for (let i = 1; i < 16; i += 3) c.fillRect(i, 2, 1, 12);
    }));
    grill.position.set(0, 0.42, 1.52);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.18), accent);
    spoiler.position.set(0, 0.93, -1.55);
    g.add(body, nose, rear, cabin, windshield, stripe, grill, spoiler);

    const wheels = [];
    for (const [px, pz] of [[-0.96, 1.02], [0.96, 1.02], [-0.96, -1.08], [0.96, -1.08]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.48, 0.52), this.wheelMats());
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

  buildPlaneMesh() {
    const g = new THREE.Group();
    const mat = (c, emissive = 0) => new THREE.MeshLambertMaterial({ color: c, emissive, emissiveIntensity: emissive ? 0.12 : 0 });

    const fuselageSide = this.vehMat('plane_side', (c) => {
      c.fillStyle = '#dfe8f2'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#f4f8fc'; c.fillRect(0, 0, 16, 2);
      c.fillStyle = '#b9c4d2'; c.fillRect(0, 14, 16, 2);
      // rivet seams
      c.fillStyle = '#b9c4d2';
      for (let i = 0; i < 16; i += 2) { c.fillRect(i, 3, 1, 1); c.fillRect(i + 1, 12, 1, 1); }
      // passenger windows
      c.fillStyle = '#22344c';
      for (let i = 2; i < 15; i += 4) c.fillRect(i, 6, 2, 3);
      c.fillStyle = '#7fb2d8';
      for (let i = 2; i < 15; i += 4) c.fillRect(i, 6, 2, 1);
    });
    const fuselageTop = this.vehMat('plane_top', (c) => {
      c.fillStyle = '#dfe8f2'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#f4f8fc'; c.fillRect(1, 1, 14, 14);
      c.fillStyle = '#b9c4d2';
      for (let i = 0; i < 16; i += 2) { c.fillRect(i, 5, 1, 1); c.fillRect(i + 1, 10, 1, 1); }
    });
    const wingTex = this.vehMat('plane_wing', (c) => {
      c.fillStyle = '#2f75ff'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#dfe8f2'; c.fillRect(0, 0, 16, 1);
      c.fillStyle = '#1e55c4';
      for (let i = 3; i < 16; i += 4) c.fillRect(i, 1, 1, 15);
      c.fillStyle = '#6fa3ff';
      for (let i = 1; i < 16; i += 4) { c.fillRect(i, 4, 1, 1); c.fillRect(i, 11, 1, 1); }
    });
    const winTex = this.vehMat('plane_window', (c) => {
      c.fillStyle = '#9eeeff'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#d3f7ff'; c.fillRect(0, 0, 16, 4);
      c.fillStyle = '#dfe8f2'; c.fillRect(0, 0, 2, 16); c.fillRect(14, 0, 2, 16); c.fillRect(0, 14, 16, 2);
      c.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 4; i < 9; i++) c.fillRect(i, 12 - i, 1, 1);
    });

    const bellyMat = mat(0x6d7f94);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 3.35), [fuselageSide, fuselageSide, fuselageTop, bellyMat, fuselageTop, fuselageTop]);
    body.position.set(0, 0.62, 0);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 2.25), mat(0x6d7f94));
    belly.position.set(0, 0.38, -0.1);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.62), wingTex);
    nose.position.set(0, 0.62, 1.92);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.34, 0.72), [winTex, winTex, fuselageTop, bellyMat, winTex, winTex]);
    cabin.position.set(0, 0.98, 0.2);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 3.05), mat(0x174aaf));
    stripe.position.set(0, 0.88, -0.08);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.12, 0.92), wingTex);
    wing.position.set(0, 0.64, 0.05);
    const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.72), mat(0xdfe8f2));
    wingTipL.position.set(-2.3, 0.66, 0.05);
    const wingTipR = wingTipL.clone();
    wingTipR.position.x = 2.3;
    const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 1.15), [fuselageSide, fuselageSide, fuselageTop, bellyMat, fuselageTop, fuselageTop]);
    tailBoom.position.set(0, 0.72, -1.72);
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.10, 0.52), wingTex);
    tailWing.position.set(0, 0.82, -2.06);
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.52), wingTex);
    tailFin.position.set(0, 1.18, -2.14);
    g.add(body, belly, nose, cabin, stripe, wing, wingTipL, wingTipR, tailBoom, tailWing, tailFin);

    const propellers = [];
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.16), mat(0xff9d2e, 0x552200));
    hub.position.set(0, 0.62, 2.28);
    const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.06), mat(0x101014));
    bladeA.position.set(0, 0.62, 2.38);
    const bladeB = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 0.06), mat(0x101014));
    bladeB.position.set(0, 0.62, 2.39);
    g.add(hub, bladeA, bladeB);
    propellers.push(bladeA, bladeB);

    const wheels = [];
    for (const [px, py, pz] of [[-0.52, 0.18, 0.78], [0.52, 0.18, 0.78], [0, 0.18, -1.18]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.36), mat(0x101014));
      w.position.set(px, py, pz);
      g.add(w);
      wheels.push(w);
    }
    return { group: g, wheels, propellers };
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
    const hullMat = obsidian
      ? this.vehMat('boat_hull_obs', (c) => {
        c.fillStyle = '#211a2d'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#15111f'; c.fillRect(0, 12, 16, 4);
        // glassy diagonal streaks + faint floopium glints
        c.fillStyle = '#3a294f';
        for (let i = 0; i < 10; i++) { c.fillRect((i * 3) % 16, (i * 5 + 2) % 12, 1, 3); }
        c.fillStyle = '#7b4dff'; c.fillRect(3, 4, 1, 1); c.fillRect(12, 8, 1, 1);
        c.fillStyle = '#55407a'; c.fillRect(0, 0, 16, 1);
      })
      : this.vehMat('boat_hull_wood', (c) => {
        c.fillStyle = '#a8814d'; c.fillRect(0, 0, 16, 16);
        for (let row = 0; row < 4; row++) {
          c.fillStyle = row % 2 ? '#b58c55' : '#9a7544';
          c.fillRect(0, row * 4, 16, 3);
          c.fillStyle = '#6d4f2c'; c.fillRect(0, row * 4 + 3, 16, 1);
          c.fillStyle = '#5a4226'; c.fillRect((row * 5 + 2) % 15, row * 4 + 1, 1, 1);
        }
        c.fillStyle = '#7a5c36'; c.fillRect(0, 14, 16, 2);
      });
    const innerMat = obsidian
      ? this.vehMat('boat_inner_obs', (c) => {
        c.fillStyle = '#3a294f'; c.fillRect(0, 0, 16, 16);
        c.fillStyle = '#55407a';
        for (let i = 0; i < 8; i++) c.fillRect((i * 5 + 1) % 15, (i * 3) % 15, 2, 1);
        c.fillStyle = '#7b4dff'; c.fillRect(7, 7, 2, 2);
      }, { emissive: 0x2a1744, emissiveIntensity: 0.08 })
      : this.vehMat('boat_inner_wood', (c) => {
        c.fillStyle = '#c19a63'; c.fillRect(0, 0, 16, 16);
        for (let row = 0; row < 4; row++) {
          c.fillStyle = row % 2 ? '#b58c55' : '#cba76e';
          c.fillRect(0, row * 4, 16, 3);
          c.fillStyle = '#8a6a3c'; c.fillRect(0, row * 4 + 3, 16, 1);
        }
      });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 2.2), hullMat);
    hull.position.y = 0.3;
    const bowPiece = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.5), hullMat);
    bowPiece.position.set(0, 0.35, -1.25);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 1.8), innerMat);
    inner.position.y = 0.55;
    root.add(hull, bowPiece, inner);
    g.add(root);
    return { group: g };
  },

  buildBoardMesh() {
    const g = new THREE.Group();
    // deck: grip tape up top, Floop graphic underneath, wood plies on the rails
    const grip = this.vehMat('board_grip', (c) => {
      c.fillStyle = '#232327'; c.fillRect(0, 0, 16, 16);
      this._pxSpeck(c, ['#3a3a41', '#0f0f12', '#2c2c31'], 90, 31);
      c.fillStyle = '#ff5cc7'; c.fillRect(0, 7, 16, 2); // pink rail stripe
    });
    const graphic = this.vehMat('board_graphic', (c) => {
      c.fillStyle = '#c19a63'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#8a6a3c'; c.fillRect(0, 3, 16, 1); c.fillRect(0, 12, 16, 1);
      // Mr Floop swirl graphic
      c.fillStyle = '#ff5cc7'; c.fillRect(5, 5, 6, 6);
      c.fillStyle = '#6ee8ff'; c.fillRect(6, 6, 4, 4);
      c.fillStyle = '#ffe86e'; c.fillRect(7, 7, 2, 2);
      c.fillStyle = '#ff5cc7'; c.fillRect(2, 2, 2, 2); c.fillRect(12, 12, 2, 2);
    });
    const ply = this.vehMat('board_ply', (c) => {
      c.fillStyle = '#a8814d'; c.fillRect(0, 0, 16, 16);
      const cols = ['#d3b98c', '#8a6a3c', '#c19a63', '#a8814d', '#8a6a3c', '#d3b98c', '#a8814d'];
      for (let i = 0; i < 7; i++) { c.fillStyle = cols[i]; c.fillRect(0, 2 + i * 2, 16, 2); }
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 1.0), [ply, ply, grip, graphic, ply, ply]);
    deck.position.y = 0.12;
    g.add(deck);
    const wheelMat = () => this.vehMat('board_wheel', (c) => {
      c.fillStyle = '#e8e2d2'; c.fillRect(0, 0, 16, 16);
      c.fillStyle = '#c9c2ae'; c.fillRect(0, 12, 16, 4);
      c.fillStyle = '#8f8a78'; c.fillRect(6, 6, 4, 4);
      c.fillStyle = '#5c5850'; c.fillRect(7, 7, 2, 2);
    });
    for (const [px, pz] of [[-0.12, 0.32], [0.12, 0.32], [-0.12, -0.32], [0.12, -0.32]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), wheelMat());
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
    group.userData.farBody = car.body;
    if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(car.body);
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
    group.userData.farBody = car.body;
    if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(car.body);
    this.cars.push(car);
    return car;
  },

  placePlane(x, y, z, yaw) {
    const { group, wheels, propellers } = this.buildPlaneMesh();
    group.position.set(x, y, z);
    this.scene.add(group);
    const plane = {
      kind: 'plane', hp: 10, item: I.PLANE,
      x, y, z, yaw: yaw || 0, speed: 0, fallDist: 0,
      body: { x, y, z, vx: 0, vy: 0, vz: 0, w: 1.2, h: 1.18, onGround: false, hitH: false },
      group, wheels, propellers, wheelSpin: 0, propSpin: 0, smashT: 0,
    };
    group.userData.farBody = plane.body;
    if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(plane.body);
    this.cars.push(plane);
    return plane;
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
    group.userData.farBody = boat.body;
    if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(boat.body);
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
    if (!v || v.removed) return false;
    v.removed = true;
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
    return true;
  },

  // vehicles take damage like mobs; destroyed -> item drop
  hurt(v, dmg, src) {
    if (!v || v.removed || v.destroyed) return false;
    v.hp -= dmg;
    v.flashT = 0.3; // orange damage flash
    SFX.mobHurt({ x: v.x, y: v.y + 0.8, z: v.z });
    const pos = v.body ? v.body : v;
    Particles.burst(pos.x, pos.y + 0.6, pos.z, [0.5, 0.5, 0.5], 6, 2);
    if (v.hp <= 0) {
      v.destroyed = true;
      if (this.driving === v || this.boating === v) this.exit(true);
      this.remove(v);
      Drops.spawn(pos.x, pos.y + 0.5, pos.z, v.item, 1);
      UI.chat(Reg[v.item].name + ' broke apart!', '#ff8080');
    }
    return true;
  },

  maxHp(v) { return v.kind === 'plane' ? 10 : v.kind === 'supercar' ? 60 : v.kind === 'car' ? 40 : v.kind === 'boat' ? (v.lavaBoat ? 34 : 20) : 12; },

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
    const boomBody = { x: ex, y: ey, z: ez };
    for (const v of [...this.cars, ...this.boats, ...this.boards]) {
      const pos = v.body ? v.body : v;
      const dv = (typeof Physics !== 'undefined' && Physics.deltaBodies) ? Physics.deltaBodies(boomBody, pos) : { x: pos.x - ex, y: pos.y - ey, z: pos.z - ez };
      const d = Math.sqrt(dv.x * dv.x + (dv.y + 0.5) * (dv.y + 0.5) + dv.z * dv.z);
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
    let originX = 0, originY = 0, originZ = 0, rox = ox, roy = oy, roz = oz;
    const pf = (typeof Player !== 'undefined' && Player.body && typeof Physics !== 'undefined' && Physics.farState) ? Physics.farState(Player.body) : null;
    if (pf) {
      originX = pf.ox; originY = pf.oy; originZ = pf.oz; rox = pf.x; roy = pf.y + ((Player.eyeY ? Player.eyeY() : oy) - Player.body.y); roz = pf.z;
    } else if (typeof Physics !== 'undefined' && Physics._originFor && (Math.abs(ox) >= Physics.FAR_COORD_THRESHOLD || Math.abs(oy) >= Physics.FAR_COORD_THRESHOLD || Math.abs(oz) >= Physics.FAR_COORD_THRESHOLD)) {
      originX = Physics._originFor(ox); originY = Physics._originFor(oy); originZ = Physics._originFor(oz);
      rox = ox - originX; roy = oy - originY; roz = oz - originZ;
    }
    const bodyLocal = (b) => {
      const st = (b && typeof Physics !== 'undefined' && Physics.farState) ? Physics.farState(b) : null;
      return st ? { x: (st.ox - originX) + st.x, y: (st.oy - originY) + st.y, z: (st.oz - originZ) + st.z } : { x: b.x - originX, y: b.y - originY, z: b.z - originZ };
    };
    const staticLocal = (o) => ({ x: o.x - originX, y: o.y - originY, z: o.z - originZ });

    for (const car of this.cars) {
      const b = bodyLocal(car.body);
      const hw = car.kind === 'plane' ? 2.45 : car.kind === 'supercar' ? 1.25 : 1.1;
      const hl = car.kind === 'plane' ? 2.05 : car.kind === 'supercar' ? 1.55 : 1.4;
      const hh = car.kind === 'plane' ? 1.35 : car.kind === 'supercar' ? 1.25 : 1.5;
      const t = this.rayAABB([b.x - hw, b.y, b.z - hl], [b.x + hw, b.y + hh, b.z + hl], rox, roy, roz, dx, dy, dz, maxDist);
      if (t !== null && (!best || t < best.dist)) best = { v: car, dist: t };
    }
    for (const boat of this.boats) {
      const b = bodyLocal(boat.body);
      const t = this.rayAABB([b.x - 0.8, b.y, b.z - 1.2], [b.x + 0.8, b.y + 1, b.z + 1.2], rox, roy, roz, dx, dy, dz, maxDist);
      if (t !== null && (!best || t < best.dist)) best = { v: boat, dist: t };
    }
    for (const board of this.boards) {
      const b = staticLocal(board);
      const t = this.rayAABB([b.x - 0.5, b.y - 0.1, b.z - 0.7], [b.x + 0.5, b.y + 0.4, b.z + 0.7], rox, roy, roz, dx, dy, dz, maxDist);
      if (t !== null && (!best || t < best.dist)) best = { v: board, dist: t };
    }
    return best;
  },

  enter(v) {
    if (this.isCarLike(v)) {
      this.driving = v;
      UI.chat(v.kind === 'plane' ? 'Floop Plane! Hold W to build speed. Space climbs after takeoff speed, S descends/brakes, Shift hops out.' : v.kind === 'supercar' ? 'Blue Super Car! 2x speed, 60 HP. Shift to hop out.' : 'Vroom. Shift to hop out. (Floopmobile™ — crash responsibly)', '#ffd97a');
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
      if (Player.body._farPos) delete Player.body._farPos;
      Player.body.x = spot.x; Player.body.y = spot.y; Player.body.z = spot.z;
      if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(Player.body);
    } else {
      // Still prefer a safe spot, but never trap the player inside a vehicle.
      // If the 4-block safety search fails, hop out at the normal side exit
      // with no extra safety refusal. This can be unsafe, but it is better
      // than soft-locking the player in a boat/car forever.
      this.ensureVehicleFarBody(v.body);
      const st = v.body && v.body._farPos;
      const lx = (st ? st.x : v.body.x) + Math.cos(v.yaw) * 1.6;
      const lz = (st ? st.z : v.body.z) - Math.sin(v.yaw) * 1.6;
      if (st) Player.body._farPos = { ox: st.ox, oy: st.oy, oz: st.oz, x: lx, y: st.y + 0.2, z: lz };
      else if (Player.body._farPos) delete Player.body._farPos;
      Player.body.x = st ? st.ox + lx : lx; Player.body.z = st ? st.oz + lz : lz;
      Player.body.y = st ? st.oy + st.y + 0.2 : v.body.y + 0.2;
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
    this.ensureVehicleFarBody(b);
    const cx = this.blockX(b), cy = this.blockY(b), cz = this.blockZ(b);
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
    this.ensureVehicleFarBody(b);
    if (!World.hasChunk(this.blockX(b), this.blockZ(b))) return;
    const inWater = Physics.inWater(b, 0.25);
    const inLava = Physics.inLava(b, 0.25);
    const goodBoatFluid = isBoat && (v.lavaBoat ? inLava : inWater);
    const wrongBoatFluid = isBoat && (v.lavaBoat ? inWater : inLava);

    if (drivingThis && !Player.dead) {
      const k = Player.keys;
      const profile = this.vehicleDriveProfile(v, isBoat, goodBoatFluid);
      const maxF = profile.maxF;
      const reverseMax = profile.reverseMax;
      const accel = k['KeyW'] ? profile.accel : 0;
      const brake = k['KeyS'] ? profile.brake : 0;
      v.speed += (accel - brake) * dt;
      v.speed = Math.max(reverseMax, Math.min(maxF, v.speed));
      if (!accel && !brake) v.speed *= (b.onGround || inWater || inLava ? profile.idleDrag : 0.999);
      const steer = (k['KeyA'] ? 1 : 0) - (k['KeyD'] ? 1 : 0);
      v.yaw += steer * dt * profile.steerRate * Math.max(-1, Math.min(1, v.speed / 5));
    } else {
      v.speed *= 0.96;
    }

    b.vx = Math.sin(v.yaw + Math.PI) * -v.speed;
    b.vz = Math.cos(v.yaw + Math.PI) * -v.speed;

    const isPlane = v.kind === 'plane';

    if (isBoat && goodBoatFluid) {
      // float to the correct surface: normal boats on water, obsidian boats on lava
      b.vy += (v.lavaBoat ? 15 : 18) * dt;
      b.vy = Math.min(b.vy, v.lavaBoat ? 1.8 : 2.2);
      const headId = World.getBlock(this.blockX(b), this.blockY(b, 0.7), this.blockZ(b));
      if (v.lavaBoat ? !isLava(headId) : !isWater(headId)) b.vy = Math.min(b.vy, 0); // don't pop out of the fluid
      b.vy -= (v.lavaBoat ? 7.5 : 9) * dt;
    } else if (isPlane) {
      this.applyPlaneFlight(v, dt, drivingThis && !Player.dead, inWater, inLava, Player.keys);
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
    b.vy = isPlane ? Math.max(-26, Math.min(16, b.vy)) : Math.max(b.vy, -36);

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
              const bx = this.blockX(b, dx), by = this.blockY(b, dy), bz = this.blockZ(b, dz);
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
    const wasY = b.y, fallingBefore = b.vy < 0, landingVy = b.vy;
    Physics.move(b, dt, { stepUp: true, stepLift: isBoat ? 0.55 : isPlane ? 0.65 : 1.06 });
    v.x = b.x; v.y = b.y; v.z = b.z;

    // vehicle fall damage (lenient)
    if (!(isBoat ? goodBoatFluid : inWater)) {
      if (fallingBefore && wasY > b.y) v.fallDist += wasY - b.y;
      if (b.onGround) {
        if (isPlane) {
          const impact = fallingBefore ? Math.max(0, -landingVy) : 0;
          const landingSpeed = Math.abs(preSpeed || v.speed || 0);
          const safeImpact = drivingThis && landingSpeed >= this.planeTakeoffSpeed() ? 27 : 16;
          const hardLanding = impact > safeImpact;
          if (hardLanding) {
            const dmg = Math.max(1, Math.floor(Math.max(0, impact - safeImpact) * 1.1));
            this.hurt(v, dmg);
            if (drivingThis && dmg > 3) Player.hurt(Math.max(1, Math.floor(dmg * 0.2)), 0, 0, { pierce: true });
          }
          if (drivingThis) Player.fallDist = 0;
        } else if (v.fallDist > 7) {
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
            const bx = this.blockX(b, fx * 1.3 + fz * side * 0.7);
            const by = Math.floor(b.y + 0.3 + dy * 0.8);
            const bz = this.blockZ(b, fz * 1.3 - fx * side * 0.7);
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
      // and other players (multiplayer)
      if (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.vehicleRunOver) {
        Multiplayer.vehicleRunOver(v, Math.round(Math.abs(v.speed) * 1.1));
      }
    }
  },

  update(dt) {
    for (const car of this.cars) {
      if (!car || car.removed || car.destroyed) continue;
      this.updateVehicleCommon(car, dt, this.driving === car, false);
      const b = car.body;
      car.wheelSpin += car.speed * dt * 3;
      car.group.position.set(b.x, b.y, b.z);
      car.group.rotation.y = car.yaw;
      for (const w of car.wheels || []) w.rotation.x = car.wheelSpin;
      if (car.propellers) {
        car.propSpin = (car.propSpin || 0) + Math.max(18, Math.abs(car.speed || 0) * 1.3) * dt;
        for (const p of car.propellers) p.rotation.z = car.propSpin;
      }
      this.applyFlash(car, dt);
      this.tintVehicle(car, dt);
      if (this.driving === car) {
        this.copyVehicleBodyToPlayer(car, this.riderYOffset(car));
      }
    }
    for (const boat of this.boats) {
      if (!boat || boat.removed || boat.destroyed) continue;
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
        this.copyVehicleBodyToPlayer(boat, this.riderYOffset(boat));
      }
    }
    for (const board of this.boards) {
      if (!board || board.removed || board.destroyed) continue;
      this.applyFlash(board, dt);
      this.tintVehicle(board, dt);
    }

    // HP readout while riding
    const active = this.driving || this.boating;
    UI.setVehicleHud(active ? this.vehicleHudLabel(active) : null);
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
      if (Player.body._farPos) delete Player.body._farPos;
      Player.body.x = spot.x; Player.body.y = spot.y; Player.body.z = spot.z;
      if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(Player.body);
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
    this.boardMesh.userData.farBody = b;
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
      const isPlane = c.kind === 'plane' || c.item === I.PLANE;
      const isSuper = c.kind === 'supercar' || c.item === I.SUPER_CAR;
      const v = isPlane ? this.placePlane(c.x, c.y, c.z, c.yaw) : isSuper ? this.placeSuperCar(c.x, c.y, c.z, c.yaw) : this.placeCar(c.x, c.y, c.z, c.yaw);
      if (c.hp) v.hp = c.hp;
    }
    for (const b of boards || []) { const v = this.placeBoard(b.x, b.y, b.z, b.yaw); if (b.hp) v.hp = b.hp; }
    for (const b of boats || []) { const v = this.placeBoat(b.x, b.y, b.z, b.yaw, !!(b.lavaBoat || b.item === I.OBSIDIAN_BOAT)); if (b.hp) v.hp = b.hp; }
  },
};
