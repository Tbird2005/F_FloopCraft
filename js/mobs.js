// ============================================================
// F_Floop Craft — mobs: frog creepers, skeletons, spiders,
// sheep, chickens, camels, Humbugs, TUNG TUNG TUNG SAHUR,
// and Mr Floop (now with more attitude)
// ============================================================

const FLOOP_LINES_COMMON = ['Merry Christmas!', 'brrr brrr patapim'];
const FLOOP_LINES_CASUAL = [
  'Hey hey hey!', "No! I didn't say that!", 'No', 'Huh?',
  'Yeah ok bro what are you even on about?', 'Go home', '67', 'Good night',
  'Thats fake', 'Ok thats AI', 'Thats photoshopped', "Yeah buddy that's not real.",
];
const FLOOP_LINES_RARE = [
  'brrr brrr patapim...',
  'MERRY CHRISTMAS!!',
  'patapim patapim patapim',
  'the saucer is fine. everything is fine. merry christmas.',
  'have you visited my casino? the odds are... festive.',
  'on my planet every day is christmas. that is why i left.',
  'i am NOT an alien. merry christmas.',
  'the skeletons never say merry christmas back :(',
  'diamonds are my favorite snack. i mean currency. i mean... merry christmas.',
  'do not lick the purple ore. trust me. patapim.',
  'i saw what you did to that tree. merry christmas anyway.',
  'the humbugs are close. i can smell the disappointment.',
  'if a humbug asks: you never saw me. patapim.',
];
const FLOOP_LINES_HURT = [
  'ow!! why!! merry christmas??',
  'patapim?! that HURT.',
  'i am TELLING the humbugs about this.',
  'hey!! i felt that in my hat.',
  'rude. festive, but rude.',
  'my lawyer is a snowman.',
  'do not make me patapim you.',
  'that is NOT christmas behavior.',
  'i bruise green, you know.',
];
const HUMBUG_LINES = ['no.', 'bah.', 'christmas is CANCELLED.', 'patapim is propaganda.', 'hand over the diamonds.', 'joy detected. eliminating.'];

const MOB_XP = { creeper: 5, skeleton: 5, spider: 4, humbug: 8, sheep: 1, floop: 0, chicken: 1, camel: 2, tung: 12 };
const MOB_MAX_HP = { creeper: 20, skeleton: 20, floop: 40, humbug: 24, sheep: 10, spider: 16, chicken: 6, camel: 20, tung: 36 };
const HOSTILES = ['creeper', 'skeleton', 'spider', 'humbug', 'tung'];

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const Mobs = {
  list: [],
  arrows: [],
  scene: null,
  spawnTimer: 0,
  pathBudget: 0,

  init(scene) { this.scene = scene; this.list = []; this.arrows = []; },

  liveFloops() {
    return this.list.filter(m => m && !m.dead && m.type === 'floop');
  },

  despawnSilent(mob) {
    if (!mob) return;
    mob.dead = true;
    if (mob.bubble && this.scene) {
      this.scene.remove(mob.bubble);
      if (mob.bubble.material) {
        if (mob.bubble.material.map) mob.bubble.material.map.dispose();
        mob.bubble.material.dispose();
      }
      mob.bubble = null;
    }
    if (mob.group && this.scene) this.scene.remove(mob.group);
    const ix = this.list.indexOf(mob);
    if (ix >= 0) this.list.splice(ix, 1);
  },

  enforceSingleFloop() {
    const floops = this.liveFloops();
    if (floops.length <= 1) return;
    // Keep the closest loaded Mr. Floop to the player and silently despawn extras.
    const p = (typeof Player !== 'undefined' && Player.body) ? Player.body : { x: 0, y: 0, z: 0 };
    floops.sort((a, b) => {
      const da = (a.body.x - p.x) ** 2 + (a.body.z - p.z) ** 2 + ((a.body.y || 0) - (p.y || 0)) ** 2;
      const db = (b.body.x - p.x) ** 2 + (b.body.z - p.z) ** 2 + ((b.body.y || 0) - (p.y || 0)) ** 2;
      return da - db;
    });
    for (let i = 1; i < floops.length; i++) this.despawnSilent(floops[i]);
  },

  // ---------- model helpers ----------
  box(w, h, d, color, faceCanvas) {
    const g = new THREE.BoxGeometry(w, h, d);
    let mats;
    if (faceCanvas) {
      const tex = new THREE.CanvasTexture(faceCanvas);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      const plain = new THREE.MeshLambertMaterial({ color });
      const face = new THREE.MeshLambertMaterial({ map: tex });
      mats = [plain, plain, plain, plain, face, plain];
    } else {
      mats = new THREE.MeshLambertMaterial({ color });
    }
    return new THREE.Mesh(g, mats);
  },

  faceCanvas(draw) {
    const cv = document.createElement('canvas');
    cv.width = 8; cv.height = 8;
    draw(cv.getContext('2d'));
    return cv;
  },

  frogFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#4db843'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#8fdb84'; c.fillRect(1, 5, 6, 3); // pale throat
      c.fillStyle = '#1a1a1a'; c.fillRect(1, 4, 6, 1); // grim mouth line
    });
  },

  skeletonFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#c9c9c9'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#8a8a8a'; c.fillRect(0, 7, 8, 1);
      c.fillStyle = '#3a3a3a';
      c.fillRect(1, 3, 2, 1); c.fillRect(5, 3, 2, 1);
      c.fillRect(3, 5, 2, 1);
    });
  },

  floopFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#7ec48a'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#000';
      c.fillRect(1, 2, 2, 2); c.fillRect(5, 2, 2, 2);
      c.fillStyle = '#fff'; c.fillRect(1, 2, 1, 1); c.fillRect(5, 2, 1, 1);
      c.fillStyle = '#4a375c'; c.fillRect(2, 6, 4, 1);
    });
  },

  humbugFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#9aa0a6'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#000';
      c.fillRect(1, 2, 2, 3); c.fillRect(5, 2, 2, 3);
      c.fillRect(2, 6, 4, 1); c.fillRect(2, 5, 1, 1); c.fillRect(5, 5, 1, 1);
      c.fillStyle = '#6a7076'; c.fillRect(0, 0, 8, 1);
    });
  },

  sheepFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#d8b8a8'; c.fillRect(2, 4, 4, 4);
      c.fillStyle = '#000'; c.fillRect(1, 2, 2, 1); c.fillRect(5, 2, 2, 1);
    });
  },

  spiderFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#2a2028'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#c02020';
      c.fillRect(1, 2, 1, 1); c.fillRect(3, 1, 1, 1); c.fillRect(4, 1, 1, 1); c.fillRect(6, 2, 1, 1);
      c.fillRect(2, 3, 1, 1); c.fillRect(5, 3, 1, 1);
      c.fillStyle = '#555'; c.fillRect(3, 5, 2, 2);
    });
  },

  chickenFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#f5f5f5'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#000'; c.fillRect(1, 2, 1, 1); c.fillRect(6, 2, 1, 1);
      c.fillStyle = '#ff9d2e'; c.fillRect(3, 4, 2, 2); // beak
      c.fillStyle = '#c02020'; c.fillRect(3, 6, 2, 2); // wattle
    });
  },

  camelFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#d2a24c'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#000'; c.fillRect(1, 2, 1, 1); c.fillRect(6, 2, 1, 1);
      c.fillStyle = '#8a6a30'; c.fillRect(2, 5, 4, 2);
    });
  },

  tungFace() {
    return this.faceCanvas(c => {
      c.fillStyle = '#6b502e'; c.fillRect(0, 0, 8, 8);
      c.fillStyle = '#5a4226'; c.fillRect(0, 0, 8, 1); c.fillRect(0, 7, 8, 1);
      c.fillStyle = '#fff';
      c.fillRect(1, 2, 2, 3); c.fillRect(5, 2, 2, 3); // wide staring eyes
      c.fillStyle = '#000'; c.fillRect(2, 3, 1, 1); c.fillRect(6, 3, 1, 1);
      c.fillRect(2, 6, 4, 1);
    });
  },

  buildModel(type, gunId, color) {
    const g = new THREE.Group();
    const parts = { legs: [], wool: [] };
    if (type === 'creeper') {
      // weird explosive frog
      const green = 0x4db843;
      const body = this.box(0.8, 0.45, 0.7, green);
      body.position.y = 0.35;
      const belly = this.box(0.7, 0.2, 0.6, 0x8fdb84);
      belly.position.y = 0.18;
      const head = this.box(0.7, 0.35, 0.45, green, this.frogFace());
      head.position.set(0, 0.72, 0.2);
      g.add(body, belly, head);
      parts.head = head;
      for (const side of [-1, 1]) {
        const eye = this.box(0.18, 0.2, 0.18, 0xffffff);
        eye.position.set(side * 0.22, 0.95, 0.25);
        const pupil = this.box(0.09, 0.1, 0.06, 0x000000);
        pupil.position.set(side * 0.22, 0.97, 0.35);
        g.add(eye, pupil);
        const legBack = this.box(0.24, 0.3, 0.45, 0x3d9635);
        legBack.position.set(side * 0.45, 0.18, -0.25);
        legBack.rotation.x = -0.4;
        const legFront = this.box(0.14, 0.28, 0.14, 0x3d9635);
        legFront.position.set(side * 0.3, 0.15, 0.3);
        g.add(legBack, legFront);
        parts.legs.push(legBack, legFront);
      }
    } else if (type === 'skeleton') {
      const boneCol = 0xc9c9c9;
      const body = this.box(0.45, 0.75, 0.22, 0xa8a8a8);
      body.position.y = 1.05;
      const head = this.box(0.5, 0.5, 0.5, boneCol, this.skeletonFace());
      head.position.y = 1.7;
      g.add(body, head);
      parts.head = head;
      for (const px of [-0.13, 0.13]) {
        const leg = this.box(0.16, 0.7, 0.16, boneCol);
        leg.position.set(px, 0.35, 0);
        g.add(leg); parts.legs.push(leg);
      }
      for (const px of [-0.3, 0.3]) {
        const arm = this.box(0.14, 0.6, 0.14, boneCol);
        arm.position.set(px, 1.15, 0);
        g.add(arm); parts.legs.push(arm);
      }
      const bow = this.box(0.06, 0.5, 0.06, 0x7a5c36);
      bow.position.set(0.3, 1.1, 0.25);
      bow.rotation.x = 0.4;
      g.add(bow);
    } else if (type === 'sheep') {
      const woolCol = color ? COLOR_HEX[color] : 0xe8e8e8;
      const body = this.box(0.9, 0.65, 0.6, woolCol);
      body.position.y = 0.85;
      const head = this.box(0.42, 0.42, 0.42, 0xe8e8e8, this.sheepFace());
      head.position.set(0, 1.25, 0.5);
      g.add(body, head);
      parts.head = head;
      parts.wool.push(body);
      for (const [px, pz] of [[-0.25, 0.2], [0.25, 0.2], [-0.25, -0.2], [0.25, -0.2]]) {
        const leg = this.box(0.16, 0.55, 0.16, 0xd8d8d0);
        leg.position.set(px, 0.28, pz);
        g.add(leg); parts.legs.push(leg);
      }
    } else if (type === 'chicken') {
      const body = this.box(0.5, 0.45, 0.6, 0xf5f5f5);
      body.position.y = 0.5;
      const head = this.box(0.3, 0.35, 0.3, 0xf5f5f5, this.chickenFace());
      head.position.set(0, 0.95, 0.25);
      const tail = this.box(0.35, 0.3, 0.2, 0xe8e8e8);
      tail.position.set(0, 0.6, -0.3);
      g.add(body, head, tail);
      parts.head = head;
      for (const px of [-0.12, 0.12]) {
        const leg = this.box(0.08, 0.3, 0.08, 0xff9d2e);
        leg.position.set(px, 0.15, 0.05);
        g.add(leg); parts.legs.push(leg);
      }
      for (const side of [-1, 1]) {
        const wing = this.box(0.08, 0.3, 0.4, 0xe8e8e8);
        wing.position.set(side * 0.3, 0.55, 0);
        g.add(wing); parts.legs.push(wing);
      }
    } else if (type === 'camel') {
      const tan = 0xd2a24c;
      const body = this.box(0.8, 0.7, 1.5, tan);
      body.position.y = 1.15;
      const hump1 = this.box(0.5, 0.35, 0.45, 0xb8853c);
      hump1.position.set(0, 1.65, 0.35);
      const hump2 = this.box(0.5, 0.35, 0.45, 0xb8853c);
      hump2.position.set(0, 1.65, -0.35);
      const neck = this.box(0.3, 0.6, 0.3, tan);
      neck.position.set(0, 1.7, 0.75);
      const head = this.box(0.35, 0.35, 0.5, tan, this.camelFace());
      head.position.set(0, 2.05, 0.9);
      g.add(body, hump1, hump2, neck, head);
      parts.head = head;
      for (const [px, pz] of [[-0.28, 0.55], [0.28, 0.55], [-0.28, -0.55], [0.28, -0.55]]) {
        const leg = this.box(0.18, 0.8, 0.18, 0xb8853c);
        leg.position.set(px, 0.4, pz);
        g.add(leg); parts.legs.push(leg);
      }
    } else if (type === 'spider') {
      const dark = 0x2a2028;
      const body = this.box(0.85, 0.45, 0.85, dark);
      body.position.y = 0.45;
      const head = this.box(0.5, 0.4, 0.5, dark, this.spiderFace());
      head.position.set(0, 0.45, 0.6);
      g.add(body, head);
      parts.head = head;
      for (const side of [-1, 1]) {
        for (let l = 0; l < 4; l++) {
          const leg = this.box(0.5, 0.08, 0.08, 0x1a1418);
          leg.position.set(side * 0.6, 0.4, -0.3 + l * 0.2);
          leg.rotation.z = -side * 0.45; // outer tips point DOWN (spiders are no longer doing yoga)
          g.add(leg); parts.legs.push(leg);
        }
      }
    } else if (type === 'humbug') {
      const skin = 0x9aa0a6;
      const body = this.box(0.55, 0.85, 0.35, 0x3a3f45);
      body.position.y = 1.0;
      const head = this.box(0.58, 0.58, 0.58, skin, this.humbugFace());
      head.position.y = 1.85;
      const antenna = this.box(0.06, 0.35, 0.06, 0x6a7076);
      antenna.position.y = 2.3;
      const antennaTip = this.box(0.12, 0.12, 0.12, 0xc02020);
      antennaTip.position.y = 2.5;
      g.add(body, head, antenna, antennaTip);
      parts.head = head;
      for (const px of [-0.15, 0.15]) {
        const leg = this.box(0.2, 0.55, 0.2, 0x2a2f35);
        leg.position.set(px, 0.28, 0);
        g.add(leg); parts.legs.push(leg);
      }
      for (const px of [-0.38, 0.38]) {
        const arm = this.box(0.16, 0.6, 0.16, 0x3a3f45);
        arm.position.set(px, 1.15, 0);
        g.add(arm); parts.legs.push(arm);
      }
      if (gunId) {
        const gun = this.box(0.12, 0.12, 0.6, 0x3a3a40);
        gun.position.set(0.38, 0.95, 0.3);
        g.add(gun);
        parts.gun = gun;
      }
    } else if (type === 'tung') {
      // TUNG TUNG TUNG SAHUR: a log with terrible intentions and a baseball bat
      const wood = 0x6b502e;
      const body = this.box(0.7, 1.7, 0.7, wood, this.tungFace());
      body.position.y = 1.3;
      const rings = this.box(0.75, 0.12, 0.75, 0x5a4226);
      rings.position.y = 2.0;
      g.add(body, rings);
      parts.head = body;
      for (const px of [-0.2, 0.2]) {
        const leg = this.box(0.22, 0.45, 0.22, 0x5a4226);
        leg.position.set(px, 0.22, 0);
        g.add(leg); parts.legs.push(leg);
      }
      const arm = this.box(0.16, 0.7, 0.16, 0x5a4226);
      arm.position.set(0.45, 1.5, 0);
      g.add(arm); parts.legs.push(arm);
      const bat = this.box(0.14, 0.85, 0.14, 0xd2a24c);
      bat.position.set(0.45, 2.0, 0.25);
      bat.rotation.x = 0.6;
      g.add(bat);
      parts.bat = bat;
    } else { // Mr Floop
      const skin = 0x7ec48a;
      const body = this.box(0.55, 0.85, 0.35, 0x3d6b8f);
      body.position.y = 1.0;
      const head = this.box(0.6, 0.6, 0.6, skin, this.floopFace());
      head.position.y = 1.85;
      const nose = this.box(0.18, 0.18, 0.35, 0x5da36c);
      nose.position.set(0, 1.78, 0.42);
      const hat = this.box(0.65, 0.18, 0.65, 0xffffff);
      hat.position.y = 2.18;
      const hatTop = this.box(0.45, 0.3, 0.45, 0xc22430);
      hatTop.position.y = 2.4;
      const pom = this.box(0.16, 0.16, 0.16, 0xffffff);
      pom.position.set(0, 2.6, 0);
      g.add(body, head, nose, hat, hatTop, pom);
      parts.head = head;
      for (const px of [-0.15, 0.15]) {
        const leg = this.box(0.2, 0.55, 0.2, 0x2d4b66);
        leg.position.set(px, 0.28, 0);
        g.add(leg); parts.legs.push(leg);
      }
      for (const px of [-0.38, 0.38]) {
        const arm = this.box(0.16, 0.6, 0.16, 0x3d6b8f);
        arm.position.set(px, 1.15, 0);
        g.add(arm); parts.legs.push(arm);
      }
    }
    return { group: g, parts };
  },

  spawn(type, x, y, z, gunId, color) {
    if (type === 'floop') {
      const existing = this.liveFloops()[0];
      if (existing) return existing;
    }
    const { group, parts } = this.buildModel(type, gunId, color);
    group.position.set(x, y, z);
    this.scene.add(group);
    const heights = { creeper: 1.0, skeleton: 1.95, floop: 2.7, humbug: 2.55, sheep: 1.5, spider: 0.9, chicken: 1.0, camel: 2.3, tung: 2.4 };
    const widths = { creeper: 0.42, skeleton: 0.32, floop: 0.32, humbug: 0.32, sheep: 0.45, spider: 0.55, chicken: 0.28, camel: 0.5, tung: 0.4 };
    const hps = MOB_MAX_HP;
    const mob = {
      type, group, parts, gunId: gunId || null, color: color || null,
      body: { x, y, z, vx: 0, vy: 0, vz: 0, w: widths[type], h: heights[type], onGround: false, hitH: false },
      hp: hps[type],
      yaw: Math.random() * Math.PI * 2, targetYaw: 0,
      state: 'wander', stateT: 1 + Math.random() * 3,
      wanderDir: null, walkAnim: 0,
      fuse: 0, screeched: false, hopT: 0,
      shootT: 1 + Math.random(), burnT: 0, meleeT: 0, fleeT: 0,
      stuckT: 0, lastSX: x, lastSZ: z, detourT: 0, detourDir: null,
      path: null, pathT: 0, pathGoalKey: '', pathFailT: 0,
      pathUnreachableT: 0, pathRetryT: 0, pathSearchT: 0, pathSearchDir: null,
      kbT: 0, angryAt: null, angryPlayerT: 0,
      flash: 0, speechT: 6 + Math.random() * 16, bubble: null, bubbleT: 0,
      floopHurtVoiceCd: 0, recentFloopHurtLines: [],
      lastSrc: null, dead: false,
    };
    // Keep untinted material colors so night/cave lighting can be applied
    // repeatedly without frogs or other textured parts drifting bright.
    group.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) if (mat.color && !mat.userData.mobBaseCol) mat.userData.mobBaseCol = mat.color.clone();
    });
    mob.targetYaw = mob.yaw;
    this.list.push(mob);
    return mob;
  },

  dyeSheep(mob, color) {
    if (mob.type !== 'sheep') return false;
    mob.color = color;
    for (const w of mob.parts.wool) {
      const mats = Array.isArray(w.material) ? w.material : [w.material];
      for (const mt of mats) mt.color.setHex(COLOR_HEX[color]);
    }
    Particles.burst(mob.body.x, mob.body.y + 1, mob.body.z, [
      ((COLOR_HEX[color] >> 16) & 255) / 255, ((COLOR_HEX[color] >> 8) & 255) / 255, (COLOR_HEX[color] & 255) / 255,
    ], 10, 2);
    return true;
  },

  pickFloopHurtLine(mob) {
    const recent = Array.isArray(mob.recentFloopHurtLines) ? mob.recentFloopHurtLines : [];
    let pool = FLOOP_LINES_HURT.filter(line => !recent.includes(line));
    if (!pool.length) pool = FLOOP_LINES_HURT.slice();
    const line = pool[(Math.random() * pool.length) | 0];
    mob.recentFloopHurtLines = recent.concat(line).slice(-3);
    return line;
  },

  tryFloopHurtSpeech(mob, src) {
    // Mr Floop only complains when the PLAYER hurts him.
    // Environmental damage, explosions with no player source, and mob friendly-fire stay quiet.
    if (mob.type !== 'floop' || src !== 'player') return;
    mob.floopHurtVoiceCd = mob.floopHurtVoiceCd || 0;
    if (mob.floopHurtVoiceCd > 0) return;
    mob.floopHurtVoiceCd = 1.8 + Math.random() * 0.9;
    mob.speechT = Math.max(mob.speechT || 0, 2.5);
    this.say(mob, this.pickFloopHurtLine(mob));
  },

  say(mob, text, color) {
    const names = { floop: '<Mr Floop> ', humbug: '<Humbug> ', tung: '<???> ' };
    const colors = { floop: '#7CFC00', humbug: '#ff8080', tung: '#d2a24c' };
    UI.chat((names[mob.type] || '<mob> ') + text, color || colors[mob.type] || '#fff');
    const sb = mob.body || { x: 0, y: 0, z: 0 };
    const spos = { x: sb.x, y: sb.y + 1.1, z: sb.z };
    if (mob.type === 'floop') SFX.floop(spos);
    else if (mob.type === 'tung') SFX.tung(spos);
    else SFX.mobHurt(spos);
    if (mob.bubble) { this.scene.remove(mob.bubble); mob.bubble.material.map.dispose(); mob.bubble.material.dispose(); }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const c = cv.getContext('2d');
    c.font = 'bold 30px Consolas, monospace';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = Math.min(500, c.measureText(text).width + 24);
    c.fillRect(256 - tw / 2, 8, tw, 46);
    c.fillStyle = mob.type === 'floop' ? '#aaffaa' : mob.type === 'tung' ? '#ffd9a0' : '#ffb0b0';
    c.fillText(text, 256, 41, 490);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(4.4, 0.55, 1);
    this.scene.add(spr);
    mob.bubble = spr;
    mob.bubbleT = 3.2;
  },

  mobMaxHp(type) {
    return MOB_MAX_HP[type] || 10;
  },

  repairMobHealth(mob) {
    if (!mob) return 0;
    const maxHp = this.mobMaxHp(mob.type);
    if (!Number.isFinite(+mob.hp)) {
      // NaN/Infinity HP is an immortality bug. Restore the mob to a sane
      // damaged-but-killable value instead of letting <= 0 checks fail forever.
      mob.hp = Math.max(1, Math.ceil(maxHp * 0.5));
    }
    mob.hp = Math.max(-9999, Math.min(+mob.hp, maxHp));
    return mob.hp;
  },

  cleanDamage(dmg) {
    const n = +dmg;
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, 9999);
  },

  // src: 'player' | mob object | undefined
  hurt(mob, dmg, kx, kz, src) {
    if (!mob || mob.dead) return;
    this.repairMobHealth(mob);
    dmg = this.cleanDamage(dmg);
    if (dmg <= 0) return;
    mob.hp -= dmg;
    this.repairMobHealth(mob);
    mob.flash = 0.25;
    mob.lastSrc = src || null;
    // Hitting a daytime spider makes it hold a grudge for 10 minutes.
    // If the player leaves it alone, this counts down and it goes peaceful again.
    if (mob.type === 'spider' && src === 'player') mob.angryPlayerT = 600;
    // mob-on-mob violence starts feuds
    if (src && typeof src === 'object' && src !== mob && !src.dead) {
      mob.angryAt = src;
    }
    // knockback has a cooldown: rapid-fire can't juggle mobs into orbit
    mob.kbCd = mob.kbCd || 0;
    if (mob.kbCd <= 0 && (kx || kz)) {
      mob.kbCd = 0.9;
      mob.kbT = 0.38;
      mob.body.vx = (kx || 0) * 1.15;
      mob.body.vz = (kz || 0) * 1.15;
      mob.body.vy = Math.max(mob.body.vy, 5.2);
    }
    SFX.mobHurt({ x: mob.body.x, y: mob.body.y + mob.body.h * 0.7, z: mob.body.z });
    this.tryFloopHurtSpeech(mob, src);
    if (mob.type === 'sheep' || mob.type === 'chicken' || mob.type === 'camel') { mob.fleeT = 4; if (mob.type === 'sheep') SFX.sheep({ x: mob.body.x, y: mob.body.y + 0.8, z: mob.body.z }); }
    if (mob.hp <= 0) this.kill(mob);
  },

  kill(mob) {
    mob.dead = true;
    const b = mob.body;
    Particles.burst(b.x, b.y + 1, b.z, [0.8, 0.2, 0.2], 16, 3);
    if (mob.lastSrc === 'player') Player.addXp(MOB_XP[mob.type] || 0);
    if (mob.type === 'creeper') {
      Drops.spawn(b.x, b.y + 0.5, b.z, I.GUNPOWDER, 1 + ((Math.random() * 2) | 0));
    } else if (mob.type === 'skeleton') {
      Drops.spawn(b.x, b.y + 0.5, b.z, I.BONE, 1 + ((Math.random() * 2) | 0));
      if (Math.random() < 0.4) Drops.spawn(b.x, b.y + 0.5, b.z, I.ARROW, 1 + ((Math.random() * 3) | 0));
    } else if (mob.type === 'sheep') {
      const woolId = mob.color ? WOOL_COLOR_BLOCKS[mob.color] : B.WOOL;
      Drops.spawn(b.x, b.y + 0.5, b.z, woolId, 1 + ((Math.random() * 2) | 0));
      Drops.spawn(b.x, b.y + 0.5, b.z, I.RAW_MUTTON, 1 + ((Math.random() * 2) | 0));
    } else if (mob.type === 'chicken') {
      Drops.spawn(b.x, b.y + 0.5, b.z, I.FEATHER, 1 + ((Math.random() * 2) | 0));
      Drops.spawn(b.x, b.y + 0.5, b.z, I.RAW_CHICKEN, 1);
    } else if (mob.type === 'spider') {
      Drops.spawn(b.x, b.y + 0.5, b.z, I.STRING, (Math.random() * 3) | 0 || 1);
    } else if (mob.type === 'tung') {
      Drops.spawn(b.x, b.y + 0.5, b.z, B.LOG, 1 + ((Math.random() * 2) | 0));
      if (Math.random() < 0.25) Drops.spawn(b.x, b.y + 0.5, b.z, I.BAT, 1);
      UI.chat('TUNG TUNG TUNG SAHUR falls silent. For now.', '#d2a24c');
    } else if (mob.type === 'humbug') {
      Drops.spawn(b.x, b.y + 0.5, b.z, I.GUNPOWDER, (Math.random() * 3) | 0);
      if (Math.random() < 0.6) Drops.spawn(b.x, b.y + 0.5, b.z, I.LIGHT_AMMO, 1 + ((Math.random() * 4) | 0));
      if (Math.random() < 0.2) Drops.spawn(b.x, b.y + 0.5, b.z, I.DARK_FLOOPIUM, 1);
      if (mob.gunId && Math.random() < 0.12) Drops.spawn(b.x, b.y + 0.5, b.z, mob.gunId, 1);
    } else if (mob.type === 'floop') {
      UI.chat('Mr Floop has left this world. The casino dims its lights. Merry Christmas.', '#ff8080');
      Drops.spawn(b.x, b.y + 0.5, b.z, I.COOKIE, 3);
      Drops.spawn(b.x, b.y + 0.5, b.z, I.BERRY, 2);
    }
  },

  applyExplosion(ex, ey, ez, range, maxDmg, cover, src) {
    for (const m of this.list) {
      if (m.dead) continue;
      const b = m.body;
      const d = Math.sqrt((b.x - ex) ** 2 + (b.y + 0.8 - ey) ** 2 + (b.z - ez) ** 2);
      if (d < range) {
        const mult = cover ? cover(b.x, b.y + 0.8, b.z) : 1;
        const dmg = Math.round(maxDmg * (1 - d / range) * mult);
        if (dmg > 0) this.hurt(m, dmg, (b.x - ex) / (d + 0.01) * 8, (b.z - ez) / (d + 0.01) * 8, src || null);
      }
    }
  },

  // ---------- arrows (player + mob owned, friendly fire enabled) ----------
  shootArrow(x, y, z, tx, ty, tz, owner, opts) {
    opts = opts || {};
    const dx = tx - x, dy = ty - y, dz = tz - z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const speed = opts.speed || (owner === 'player' ? 24 : 17);
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xd8d8d8 })
    );
    g.position.set(x, y, z);
    this.scene.add(g);
    this.arrows.push({
      x, y, z,
      vx: dx / dist * speed,
      vy: (opts.straight || opts.aimed) ? (dy / dist * speed) : (dy / dist * speed + dist * 0.42),
      vz: dz / dist * speed,
      gravity: (opts.gravity !== undefined) ? opts.gravity : (opts.straight ? 0 : 18),
      mesh: g, life: opts.life || 5, stuck: 0, owner: owner || null,
    });
    SFX.arrow({ x, y, z });
  },

  updateArrows(dt) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      if (a.life <= 0 || (a.stuck && (a.stuck -= dt) <= 0)) {
        this.scene.remove(a.mesh); a.mesh.geometry.dispose();
        this.arrows.splice(i, 1);
        continue;
      }
      if (a.stuck) continue;
      a.vy -= (a.gravity !== undefined ? a.gravity : 18) * dt;
      a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
      let consumed = false;
      // hit the player? (mob arrows only; creative players are not targets)
      if (a.owner !== 'player' && !Player.dead && Player.gamemode !== 'creative') {
        const p = Player.body;
        if (a.x > p.x - p.w - 0.1 && a.x < p.x + p.w + 0.1 &&
            a.y > p.y && a.y < p.y + p.h && a.z > p.z - p.w - 0.1 && a.z < p.z + p.w + 0.1) {
          Player.hurt(3, a.vx * 0.25, a.vz * 0.25);
          consumed = true;
        }
      }
      // hit any mob that isn't the shooter? (friendly fire — feuds ahoy)
      if (!consumed) {
        for (const m of this.list) {
          if (m.dead || m === a.owner) continue;
          const b = m.body;
          if (a.x > b.x - b.w - 0.1 && a.x < b.x + b.w + 0.1 &&
              a.y > b.y && a.y < b.y + b.h && a.z > b.z - b.w - 0.1 && a.z < b.z + b.w + 0.1) {
            this.hurt(m, 3, a.vx * 0.25, a.vz * 0.25, a.owner === 'player' ? 'player' : a.owner);
            consumed = true;
            break;
          }
        }
      }
      if (consumed || Physics.solidAt(a.x, a.y, a.z)) {
        if (consumed) {
          this.scene.remove(a.mesh); a.mesh.geometry.dispose();
          this.arrows.splice(i, 1);
        } else {
          a.stuck = 1.2;
          a.x -= a.vx * dt; a.y -= a.vy * dt; a.z -= a.vz * dt;
        }
      }
    }
  },

  // ---------- ray helpers ----------
  rayBox(m, ox, oy, oz, dx, dy, dz, maxDist) {
    const b = m.body;
    const min = [b.x - b.w - 0.1, b.y, b.z - b.w - 0.1];
    const max = [b.x + b.w + 0.1, b.y + b.h, b.z + b.w + 0.1];
    const o = [ox, oy, oz], d = [dx, dy, dz];
    let t0 = 0, t1 = maxDist;
    for (let ax = 0; ax < 3; ax++) {
      if (Math.abs(d[ax]) < 1e-8) {
        if (o[ax] < min[ax] || o[ax] > max[ax]) return null;
      } else {
        let ta = (min[ax] - o[ax]) / d[ax], tb = (max[ax] - o[ax]) / d[ax];
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) return null;
      }
    }
    return t0;
  },

  hitTest(ox, oy, oz, dx, dy, dz, maxDist, exclude) {
    let best = null;
    for (const m of this.list) {
      if (m.dead || m === exclude) continue;
      const t = this.rayBox(m, ox, oy, oz, dx, dy, dz, maxDist);
      if (t !== null && (!best || t < best.dist)) best = { mob: m, dist: t };
    }
    return best;
  },

  rayAll(ox, oy, oz, dx, dy, dz, maxDist, exclude) {
    const out = [];
    for (const m of this.list) {
      if (m.dead || m === exclude) continue;
      const t = this.rayBox(m, ox, oy, oz, dx, dy, dz, maxDist);
      if (t !== null) out.push({ mob: m, dist: t });
    }
    return out;
  },

  // current target for a hostile mob: a feud rival, else the (non-creative) player
  targetOf(m) {
    if (m.angryAt) {
      if (m.angryAt.dead) m.angryAt = null;
      else {
        const b = m.angryAt.body;
        const d = Math.sqrt((b.x - m.body.x) ** 2 + (b.z - m.body.z) ** 2);
        if (d > 30) m.angryAt = null;
        else return { x: b.x, y: b.y, z: b.z, h: b.h, mob: m.angryAt, isPlayer: false };
      }
    }
    if (!Player.dead && Player.gamemode !== 'creative') {
      const p = Player.body;
      return { x: p.x, y: p.y, z: p.z, h: p.h, mob: null, isPlayer: true };
    }
    return null;
  },

  dmgTarget(tgt, dmg, kx, kz, src) {
    if (tgt.isPlayer) Player.hurt(dmg, kx, kz);
    else this.hurt(tgt.mob, dmg, kx, kz, src);
  },

  // ---------- basic grounded mob pathfinding ----------
  pathKey(x, y, z) { return x + ',' + y + ',' + z; },

  pathBodyDims(mob) {
    const b = mob && mob.body ? mob.body : {};
    // Use the real physics hitbox for path tests. Do NOT shrink wide/tall mobs
    // to a generic player-sized probe, or spiders/camels/Floop will try to route
    // through gaps their collision body can never physically enter.
    return {
      w: Math.max(0.12, b.w || 0.35),
      h: Math.max(0.6, b.h || 1.8),
    };
  },

  pathCanStand(mob, cx, y, cz) {
    if (typeof World === 'undefined' || !World.hasChunk || !World.hasChunk(cx, cz)) return false;
    if (y < 1 || y > World.H - 3) return false;
    const dims = this.pathBodyDims(mob);
    const w = dims.w, h = dims.h;
    const x = cx + 0.5, z = cz + 0.5;

    // Feet/body clearance. Keep a tiny vertical offset so standing exactly on a
    // floor does not count as clipping into that floor. This uses the mob's full
    // width and height, so a 1.1-block-wide spider rejects one-block doorways.
    if (Physics.boxesIn(x - w, y + 0.04, z - w, x + w, y + h - 0.04, z + w).length) return false;

    // No walking straight into lava cells on purpose.
    const footId = World.getBlock(cx, y, cz);
    const belowId = World.getBlock(cx, y - 1, cz);
    if ((typeof isLava === 'function') && (isLava(footId) || isLava(belowId))) return false;

    // Grounded mobs need something below them. Water counts because swimming mobs
    // can still move, and this keeps paths usable across ponds instead of failing.
    if ((typeof isWater === 'function') && (isWater(footId) || isWater(belowId))) return true;
    const supportW = Math.max(0.08, Math.min(w * 0.75, 0.48));
    return Physics.boxHit(x - supportW, y - 0.18, z - supportW, x + supportW, y + 0.03, z + supportW);
  },

  pathStandY(mob, cx, baseY, cz, fromY) {
    const startY = Number.isFinite(baseY) ? baseY : Math.floor(mob.body.y);
    const tries = fromY === undefined
      ? [startY, startY + 1, startY - 1, startY - 2, startY + 2]
      : [fromY, fromY + 1, fromY - 1, fromY - 2];
    const seen = new Set();
    for (const y of tries) {
      if (seen.has(y)) continue;
      seen.add(y);
      if (Math.abs(y - startY) > 3) continue;
      if (this.pathCanStand(mob, cx, y, cz)) return y;
    }
    return null;
  },

  pathGoalReach(mob) {
    // Melee mobs need a path to a cell where their body can actually get close
    // enough to use the attack. Without this, tall/wide mobs accept a "nearest"
    // edge cell, then run back and forth forever when the target is under a low
    // tree/ceiling or behind a gap they physically cannot enter.
    if (!mob) return 3.2;
    if (mob.type === 'tung') return 2.05;
    if (mob.type === 'spider') return 1.95;
    if (mob.type === 'creeper') return 3.2;
    if (mob.type === 'humbug' && !mob.gunId) return 1.95;
    if (mob.type === 'floop') return 2.1;
    return 3.4;
  },

  pathGoalClearanceScore(mob, x, y, z) {
    // Prefer goals with extra headroom for tall mobs. A just-barely-valid edge
    // next to a low ceiling is usually what causes Tung-style back-and-forth.
    const dims = this.pathBodyDims(mob);
    const w = dims.w;
    const cx = x + 0.5, cz = z + 0.5;
    let extra = 0;
    for (let step = 0; step < 3; step++) {
      const y0 = y + dims.h + 0.05 + step * 0.5;
      const y1 = y0 + 0.42;
      if (Physics.boxesIn(cx - w, y0, cz - w, cx + w, y1, cz + w).length) break;
      extra += 0.5;
    }
    return extra;
  },

  nearestPathGoal(mob, gx, gy, gz, tgt) {
    let best = null, bestScore = Infinity;
    const reach = this.pathGoalReach(mob);
    const searchR = Math.max(3, Math.ceil(reach + 2));
    const tx = tgt && Number.isFinite(tgt.x) ? tgt.x : gx + 0.5;
    const tz = tgt && Number.isFinite(tgt.z) ? tgt.z : gz + 0.5;
    const ty = tgt && Number.isFinite(tgt.y) ? tgt.y : gy;

    for (let r = 0; r <= searchR; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = gx + dx, z = gz + dz;
        const y = this.pathStandY(mob, x, gy, z);
        if (y === null) continue;

        const cx = x + 0.5, cz = z + 0.5;
        const hdist = Math.sqrt((cx - tx) ** 2 + (cz - tz) ** 2);
        const vdist = Math.abs((y + 0.5) - (ty + 0.5));
        // For melee-style mobs, do not accept a goal that is merely "near-ish"
        // but still outside usable reach. That cell would only make the mob run
        // to the edge of a low obstacle, turn around, and repeat.
        if (hdist > reach || vdist > 2.6) continue;

        const headBonus = this.pathGoalClearanceScore(mob, x, y, z);
        const score = hdist * hdist + Math.abs(y - gy) * 0.35 - headBonus * 0.22;
        if (score < bestScore) { bestScore = score; best = { x, y, z }; }
      }
      // As soon as a close-enough ring has at least one valid body-sized cell,
      // use the best candidate from that ring instead of picking a farther edge.
      if (best) return best;
    }
    return null;
  },

  pathSegmentClear(mob, fromX, fromY, fromZ, toX, toZ, maxRise, maxDrop) {
    if (!mob) return false;
    const b = mob.body;
    const dx = toX - fromX, dz = toZ - fromZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.min(48, Math.ceil(dist * 4)));
    const dims = this.pathBodyDims(mob);
    const w = dims.w, h = dims.h;
    let lastY = Math.floor(Number.isFinite(fromY) ? fromY : b.y);
    const riseLimit = maxRise === undefined ? 1 : maxRise;
    const dropLimit = maxDrop === undefined ? 1 : maxDrop;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = fromX + dx * t, z = fromZ + dz * t;
      const cx = Math.floor(x), cz = Math.floor(z);
      const sy = this.pathStandY(mob, cx, lastY, cz, lastY);
      if (sy === null) return false;
      if (sy > lastY + riseLimit || sy < lastY - dropLimit) return false;
      if (Physics.boxesIn(x - w, sy + 0.04, z - w, x + w, sy + h - 0.04, z + w).length) return false;
      const footId = World.getBlock(cx, sy, cz);
      const belowId = World.getBlock(cx, sy - 1, cz);
      if ((typeof isLava === 'function') && (isLava(footId) || isLava(belowId))) return false;
      const inWater = (typeof isWater === 'function') && (isWater(footId) || isWater(belowId));
      if (!inWater && !Physics.boxHit(x - w * 0.75, sy - 0.18, z - w * 0.75, x + w * 0.75, sy + 0.03, z + w * 0.75)) return false;
      lastY = sy;
    }
    return true;
  },

  buildPath(mob, tgt, maxRange) {
    if (!tgt) return null;
    const b = mob.body;
    const sx = Math.floor(b.x), sz = Math.floor(b.z), sy = this.pathStandY(mob, sx, Math.floor(b.y), sz);
    if (sy === null) return null;
    const rawGx = Math.floor(tgt.x), rawGz = Math.floor(tgt.z), rawGy = Math.floor(tgt.y || b.y);
    const goal = this.nearestPathGoal(mob, rawGx, rawGy, rawGz, tgt);
    if (!goal) return null;

    const startKey = this.pathKey(sx, sy, sz);
    const goalKey = this.pathKey(goal.x, goal.y, goal.z);
    if (startKey === goalKey) return [];

    const maxSteps = Math.max(8, Math.min(32, Math.ceil(maxRange || 20) + 8));
    const maxNodes = 320;
    // Octile distance matches 8-way movement, so open-ground paths prefer true
    // diagonals instead of doing square/grid-looking X then Z routes.
    const h = (x, y, z) => {
      const dx = Math.abs(x - goal.x), dz = Math.abs(z - goal.z);
      const mn = Math.min(dx, dz), mx = Math.max(dx, dz);
      return (mx - mn) + 1.414 * mn + Math.abs(y - goal.y) * 1.4;
    };
    const open = [{ x: sx, y: sy, z: sz, g: 0, f: h(sx, sy, sz), key: startKey }];
    const best = new Map([[startKey, 0]]);
    const came = new Map();
    let expanded = 0;

    while (open.length && expanded++ < maxNodes) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur.key === goalKey) {
        const nodes = [];
        let k = cur.key, n = cur;
        while (k !== startKey) {
          nodes.push({ x: n.x + 0.5, y: n.y, z: n.z + 0.5, cellX: n.x, cellY: n.y, cellZ: n.z });
          const prev = came.get(k);
          if (!prev) break;
          k = prev.key; n = prev;
        }
        nodes.reverse();
        // Keep paths short and refreshed, but let smoothing below skip the grid corners.
        return nodes.slice(0, 12);
      }
      if (cur.g > maxSteps) continue;
      const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
        .sort((a, b) => {
          const da = (goal.x - cur.x) * a[0] + (goal.z - cur.z) * a[1];
          const db = (goal.x - cur.x) * b[0] + (goal.z - cur.z) * b[1];
          return db - da;
        });
      for (const d of dirs) {
        const nx = cur.x + d[0], nz = cur.z + d[1];
        if (Math.max(Math.abs(nx - sx), Math.abs(nz - sz)) > maxSteps + 4) continue;
        const ny = this.pathStandY(mob, nx, cur.y, nz, cur.y);
        if (ny === null) continue;
        if (ny > cur.y + 1 || ny < cur.y - 1) continue;

        // Diagonal moves are allowed, but not through the corner of two blocking cells.
        const diag = d[0] !== 0 && d[1] !== 0;
        if (diag) {
          const yA = this.pathStandY(mob, cur.x + d[0], cur.y, cur.z, cur.y);
          const yB = this.pathStandY(mob, cur.x, cur.y, cur.z + d[1], cur.y);
          if (yA === null || yB === null) continue;
          if (yA > cur.y + 1 || yB > cur.y + 1) continue;
          if (yA < cur.y - 1 || yB < cur.y - 1) continue;
        }

        const nk = this.pathKey(nx, ny, nz);
        const base = diag ? 1.414 : 1;
        const stepCost = base + Math.max(0, ny - cur.y) * 0.85 + Math.max(0, cur.y - ny) * 0.2;
        const ng = cur.g + stepCost;
        if (best.has(nk) && best.get(nk) <= ng) continue;
        best.set(nk, ng);
        const nn = { x: nx, y: ny, z: nz, g: ng, f: ng + h(nx, ny, nz) * 1.001, key: nk };
        came.set(nk, cur);
        open.push(nn);
      }
    }
    return null;
  },

  unreachablePathMove(mob, tgt, dt) {
    // When A* proves there is physically no route to the target, do not let the
    // mob sit there forever in chase mode. It should search/wander for a bit and
    // periodically retry the path instead of freezing at the wall.
    if (!mob || !mob.body) return null;
    const b = mob.body;
    mob.pathSearchT = (mob.pathSearchT || 0) - dt;
    const needNew = !mob.pathSearchDir || mob.pathSearchT <= 0 || !this.safeMoveDir(mob, mob.pathSearchDir, 1.15);
    if (needNew) {
      const dirs = [];
      if (tgt) {
        const dx = tgt.x - b.x, dz = tgt.z - b.z;
        const dl = Math.sqrt(dx * dx + dz * dz) || 1;
        const tx = dx / dl, tz = dz / dl;
        // Search around the blockage first, then try away/nearby random patrols.
        dirs.push([-tz, tx], [tz, -tx], [tx * 0.45 - tz * 0.89, tz * 0.45 + tx * 0.89], [tx * 0.45 + tz * 0.89, tz * 0.45 - tx * 0.89], [-tx, -tz]);
      }
      if (mob.wanderDir) dirs.push(mob.wanderDir);
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        dirs.push([Math.cos(a), Math.sin(a)]);
      }
      mob.pathSearchDir = null;
      for (const d of dirs) {
        const safe = this.safeMoveDir(mob, d, 1.25);
        if (safe) { mob.pathSearchDir = safe; break; }
      }
      mob.pathSearchT = 0.7 + Math.random() * 0.7;
    }
    return mob.pathSearchDir || mob.wanderDir || null;
  },

  pathMove(mob, tgt, dt, maxRange, visible) {
    if (!mob || !tgt) return null;
    const b = mob.body;
    const goalKey = Math.floor(tgt.x) + ',' + Math.floor(tgt.y || b.y) + ',' + Math.floor(tgt.z);

    mob.pathT = (mob.pathT || 0) - dt;
    mob.pathFailT = Math.max(0, (mob.pathFailT || 0) - dt);
    mob.pathUnreachableT = Math.max(0, (mob.pathUnreachableT || 0) - dt);
    mob.pathRetryT = Math.max(0, (mob.pathRetryT || 0) - dt);
    mob.pathWantsJump = false;

    // Drop waypoints already reached.
    while (mob.path && mob.path.length) {
      const wp = mob.path[0];
      const dx = wp.x - b.x, dz = wp.z - b.z;
      if (dx * dx + dz * dz > 0.42 * 0.42) break;
      mob.path.shift();
    }

    const needPath = !mob.path || !mob.path.length || mob.pathGoalKey !== goalKey || mob.pathT <= 0;
    // If the last search failed completely, give up for a short window and do
    // a safe search/wander move. Retry periodically so mobs notice newly opened
    // doors, broken walls, or terrain changes without locking forever.
    const retryBlocked = mob.pathUnreachableT > 0 && mob.pathRetryT > 0 && mob.pathGoalKey === goalKey && (!mob.path || !mob.path.length);
    if (retryBlocked) return this.unreachablePathMove(mob, tgt, dt);

    if (needPath && mob.pathFailT <= 0 && this.pathBudget > 0) {
      this.pathBudget--;
      const path = this.buildPath(mob, tgt, maxRange || 20);
      mob.pathT = 0.55 + Math.random() * 0.30;
      mob.pathGoalKey = goalKey;
      if (path && path.length) {
        mob.path = path;
        mob.pathUnreachableT = 0;
        mob.pathRetryT = 0;
        mob.pathSearchT = 0;
        mob.pathSearchDir = null;
      } else {
        this.markPathUnreachable(mob);
        return this.unreachablePathMove(mob, tgt, dt);
      }
    }

    const directDx = tgt.x - b.x, directDz = tgt.z - b.z;
    const directLen = Math.sqrt(directDx * directDx + directDz * directDz) || 1;
    const direct = [directDx / directLen, directDz / directLen];

    // A straight diagonal chase is allowed only when the pathing safety checks say
    // every sampled cell has room and ground. This is not a blind LOS rush, so mobs
    // should not run off pit edges just because they can see the player.
    if (this.pathSegmentClear(mob, b.x, b.y, b.z, tgt.x, tgt.z, 1, 1)) {
      mob.pathWantsJump = Math.floor(tgt.y || b.y) > Math.floor(b.y + 0.05);
      mob.detourT = 0;
      mob.detourDir = null;
      return direct;
    }

    if (!mob.path || !mob.path.length) {
      if (mob.pathUnreachableT > 0) return this.unreachablePathMove(mob, tgt, dt);
      return null;
    }

    // Path smoothing: aim for the farthest near waypoint that the body can reach
    // directly instead of perfectly center-lining every grid square.
    let wp = mob.path[0];
    let wi = 0;
    const look = Math.min(mob.path.length - 1, 4);
    for (let i = 1; i <= look; i++) {
      const cand = mob.path[i];
      if (!this.pathSegmentClear(mob, b.x, b.y, b.z, cand.x, cand.z, 1)) break;
      wp = cand; wi = i;
    }
    if (wi > 0) mob.path.splice(0, wi);

    mob.pathWantsJump = wp.cellY !== undefined && wp.cellY > Math.floor(b.y + 0.05);
    const dx = wp.x - b.x, dz = wp.z - b.z;
    const dl = Math.sqrt(dx * dx + dz * dz) || 1;
    const pathDir = [dx / dl, dz / dl];

    // Follow the path direction without LOS blending. Blending toward the player
    // can pull mobs off the safe route and into holes/walls.
    return pathDir;
  },

  markPathUnreachable(mob, seconds) {
    if (!mob) return;
    mob.path = null;
    mob.pathT = 0;
    mob.pathFailT = 0.45 + Math.random() * 0.25;
    mob.pathUnreachableT = seconds || (2.8 + Math.random() * 2.2);
    mob.pathRetryT = 0.9 + Math.random() * 0.8;
    mob.detourT = 0;
    mob.detourDir = null;
  },

  safeMoveDir(mob, dir, probeDist) {
    if (!mob || !dir) return null;
    const b = mob.body;
    let dx = dir[0] || 0, dz = dir[1] || 0;
    const dl = Math.sqrt(dx * dx + dz * dz);
    if (dl < 0.001) return null;
    dx /= dl; dz /= dl;
    const dist = probeDist || 1.4;
    const turns = [0, 0.55, -0.55, 1.1, -1.1, Math.PI];
    for (const a of turns) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = dx * ca - dz * sa;
      const rz = dx * sa + dz * ca;
      if (this.pathSegmentClear(mob, b.x, b.y, b.z, b.x + rx * dist, b.z + rz * dist, 1, 1)) return [rx, rz];
    }
    return null;
  },


  mobJumpVelocity(mob) {
    // Match the player's jump strength closely enough that normal mobs can
    // clear a full 1-block ledge. The old 6.6 value peaked below one block
    // with this game's gravity, so most mobs could only bonk the wall.
    if (!mob) return 8.6;
    if (mob.type === 'chicken') return 8.2;
    if (mob.type === 'creeper') return 8.6;
    if (mob.type === 'camel' || mob.type === 'humbug' || mob.type === 'floop' || mob.type === 'tung') return 8.8;
    return 8.6;
  },

  mobJump(mob, multiplier) {
    if (!mob || !mob.body) return;
    const mul = multiplier || 1;
    mob.body.vy = Math.max(mob.body.vy || 0, this.mobJumpVelocity(mob) * mul);
  },

  mobShouldJump(mob, wantMove) {
    if (!mob || !wantMove) return false;
    const b = mob.body;
    if (!b.onGround || Physics.inWater(b, 0.3)) return false;
    if (mob.pathWantsJump) return true;
    if (!b.hitH) return false;
    const ml = Math.sqrt(wantMove[0] ** 2 + wantMove[1] ** 2) || 1;
    const dx = wantMove[0] / ml, dz = wantMove[1] / ml;
    const ax = b.x + dx * (b.w + 0.28), az = b.z + dz * (b.w + 0.28);
    const w = Math.min(0.32, Math.max(0.16, (b.w || 0.35) * 0.7));
    const lowHit = Physics.boxHit(ax - w, b.y + 0.05, az - w, ax + w, b.y + 1.05, az + w);
    const headClear = !Physics.boxHit(ax - w, b.y + 1.05, az - w, ax + w, b.y + b.h + 0.55, az + w);
    return lowHit && headClear;
  },

  // ---------- per-frame ----------
  update(dt) {
    this.updateArrows(dt);
    this.spawnTick(dt);
    this.enforceSingleFloop();
    const p = Player.body;
    this.pathBudget = 4; // cap A* searches per frame so mob brains stay cheap

    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      if (m.dead) {
        if (m.bubble) this.scene.remove(m.bubble);
        this.scene.remove(m.group);
        this.list.splice(i, 1);
        continue;
      }
      this.repairMobHealth(m);
      if (m.hp <= 0) { this.kill(m); continue; }
      const b = m.body;
      if (m.angryPlayerT > 0) m.angryPlayerT = Math.max(0, m.angryPlayerT - dt);
      const distPlayer = Math.sqrt((b.x - p.x) ** 2 + (b.z - p.z) ** 2);
      const nearAnyMultiplayerPlayer = (typeof Multiplayer !== 'undefined' && Multiplayer.connected && Multiplayer.role === 'host' && Multiplayer.isEntityNearAnyPlayer)
        ? Multiplayer.isEntityNearAnyPlayer(b.x, b.y, b.z, 80) : false;
      if (distPlayer > 80 && !nearAnyMultiplayerPlayer) { m.dead = true; continue; }
      if (m.floopHurtVoiceCd > 0) m.floopHurtVoiceCd = Math.max(0, m.floopHurtVoiceCd - dt);
      if (distPlayer > 52 || !World.hasChunk(Math.floor(b.x), Math.floor(b.z))) continue;

      m.stateT -= dt;
      if (m.stateT <= 0) {
        m.stateT = 2 + Math.random() * 3;
        m.wanderDir = Math.random() < 0.6
          ? [Math.cos(Math.random() * Math.PI * 2), Math.sin(Math.random() * Math.PI * 2)]
          : null;
      }

      const tgt = HOSTILES.includes(m.type) ? this.targetOf(m) : null;
      const distT = tgt ? Math.sqrt((b.x - tgt.x) ** 2 + (b.z - tgt.z) ** 2) : 999;
      const losT = () => tgt && World.lineOfSight(b.x, b.y + b.h * 0.85, b.z, tgt.x, tgt.y + tgt.h * 0.85, tgt.z);
      let losMemo;
      const hasTargetLOS = () => { if (losMemo === undefined) losMemo = !!losT(); return losMemo; };
      const smartChase = (range) => {
        if (!tgt || distT > range) return null;
        const visible = hasTargetLOS();
        const pd = this.pathMove(m, tgt, dt, range, visible);
        if (pd) return pd;
        return null;
      };

      let wantMove = null;
      let faceTarget = false;
      let speed = 1.3;
      let frogHop = false;

      if (m.type === 'creeper') {
        // explosive frog: hops in intervals, screeches, then boom.
        // Once it has screeched, it is COMMITTED — running breaks LOS, not its resolve.
        frogHop = true;
        m.hopT -= dt;
        if (m.screeched) {
          faceTarget = !!tgt;
          m.fuse += dt;
          if (m.fuse >= 1.0) {
            m.dead = true;
            World.explode(b.x, b.y + 0.5, b.z, 2.9, 16, 3); // +20% dmg, +50% hurt radius
            continue;
          }
        } else if (tgt && distT < 16) {
          faceTarget = true;
          const dy = Math.abs((tgt.y + 0.5) - (b.y + 0.5));
          const inRange = distT < 3 && dy < 2.5;
          if (inRange && losT()) {
            m.screeched = true;
            SFX.screech({ x: b.x, y: b.y + 1.2, z: b.z });
            this.say(m, 'SCREEEEEEEE', '#4db843');
          } else if (m.hopT <= 0 && b.onGround && distT > 1.5) {
            const hopDir = smartChase(18);
            if (hopDir) {
              b.vx = hopDir[0] * 4.6; b.vz = hopDir[1] * 4.6; this.mobJump(m, 1.0);
              m.hopT = 1.15 + Math.random() * 0.5;
            } else {
              m.hopT = 0.35; // blocked and no path yet; do not bunny-hop into the wall forever
            }
          }
        } else {
          if (m.hopT <= 0 && b.onGround && m.wanderDir && Math.random() < 0.5) {
            b.vx = m.wanderDir[0] * 3; b.vz = m.wanderDir[1] * 3; this.mobJump(m, 0.95);
            m.hopT = 1.6 + Math.random();
          }
        }
      } else if (m.type === 'skeleton') {
        const engaged = tgt && distT < 15 && hasTargetLOS();
        if (engaged) {
          faceTarget = true;
          const dx = (tgt.x - b.x) / (distT + 0.01), dz = (tgt.z - b.z) / (distT + 0.01);
          if (distT > 10) { wantMove = smartChase(22); speed = 2.2; }
          else if (distT < 6) { wantMove = this.safeMoveDir(m, [-dx, -dz], 1.6); speed = 1.8; }
          m.shootT -= dt;
          if (m.shootT <= 0 && distT > 2.5) {
            m.shootT = 2.1 + Math.random() * 0.7;
            this.shootArrow(b.x, b.y + 1.5, b.z, tgt.x, tgt.y + 1.2, tgt.z, m);
          }
        } else if (tgt && distT < 22) {
          wantMove = smartChase(22) || m.wanderDir;
          speed = 2.0;
          faceTarget = !!wantMove;
        } else {
          wantMove = m.wanderDir;
        }
        if (!Game.isNight && World.skyExposed(Math.floor(b.x), Math.floor(b.y + 1), Math.floor(b.z))) {
          m.burnT += dt;
          if (m.burnT > 1) {
            m.burnT = 0;
            m.hp -= 2; m.flash = 0.3;
            Particles.burst(b.x, b.y + 1.5, b.z, [1, 0.5, 0.1], 6, 2);
            if (m.hp <= 0) { this.kill(m); continue; }
          }
        }
      } else if (m.type === 'spider') {
        if (tgt && (Game.isNight || m.angryAt || m.angryPlayerT > 0) && distT < 14) {
          const dx = (tgt.x - b.x) / (distT + 0.01), dz = (tgt.z - b.z) / (distT + 0.01);
          wantMove = smartChase(16); speed = 3.1;
          faceTarget = distT < 3;
          m.meleeT -= dt;
          if (distT < 1.7 && Math.abs((b.y + 0.4) - (tgt.y + 0.9)) < 1.6 && m.meleeT <= 0) {
            m.meleeT = 1.1;
            this.dmgTarget(tgt, 3, dx * 4, dz * 4, m);
          }
        } else {
          wantMove = m.wanderDir;
          speed = 1.6;
        }
      } else if (m.type === 'tung') {
        // TUNG TUNG TUNG SAHUR: sprints at you with a bat
        if (tgt && distT < 24) {
          faceTarget = distT < 4;
          const dx = (tgt.x - b.x) / (distT + 0.01), dz = (tgt.z - b.z) / (distT + 0.01);
          wantMove = smartChase(26); speed = 5.0;
          m.meleeT -= dt;
          if (distT < 1.9 && m.meleeT <= 0) {
            m.meleeT = 1.2;
            this.dmgTarget(tgt, 7, dx * 12, dz * 12, m); // BAT. huge knockback
            if (m.parts.bat) { m.parts.bat.rotation.x = -1.4; setTimeout(() => { if (m.parts.bat) m.parts.bat.rotation.x = 0.6; }, 180); }
            SFX.tung({ x: b.x, y: b.y + 1.1, z: b.z });
          }
          m.speechT -= dt;
          if (m.speechT <= 0) {
            m.speechT = 5 + Math.random() * 6;
            this.say(m, 'TUNG TUNG TUNG SAHUR');
          }
        } else {
          wantMove = m.wanderDir;
          speed = 2;
        }
      } else if (m.type === 'sheep' || m.type === 'chicken' || m.type === 'camel') {
        if (m.fleeT > 0) {
          m.fleeT -= dt;
          const src = m.angryAt && !m.angryAt.dead ? m.angryAt.body : p;
          const d2 = Math.sqrt((b.x - src.x) ** 2 + (b.z - src.z) ** 2) + 0.01;
          wantMove = this.safeMoveDir(m, [(b.x - src.x) / d2, (b.z - src.z) / d2], 1.6);
          speed = m.type === 'camel' ? 3.4 : 2.8;
        } else {
          wantMove = m.wanderDir;
          speed = m.type === 'camel' ? 1.1 : 0.9;
          if (m.type === 'sheep' && distPlayer < 8 && Math.random() < 0.003) SFX.sheep({ x: b.x, y: b.y + 0.8, z: b.z });
          if (m.type === 'chicken' && distPlayer < 8 && Math.random() < 0.004) SFX.pop();
        }
      } else if (m.type === 'humbug') {
        const engaged = tgt && distT < 18 && hasTargetLOS();
        if (m.gunId) {
          if (engaged) {
            faceTarget = true;
            const dx = (tgt.x - b.x) / (distT + 0.01), dz = (tgt.z - b.z) / (distT + 0.01);
            if (distT > 13) { wantMove = smartChase(24); speed = 2.4; }
            else if (distT < 7) { wantMove = this.safeMoveDir(m, [-dx, -dz], 1.6); speed = 2.0; }
            m.shootT -= dt;
            if (m.shootT <= 0 && distT > 2) {
              m.shootT = 1.8 + Math.random() * 0.8;
              const acc = Math.min(0.8, 0.5 + Game.dayCount * 0.02);
              Guns.mobFire({ x: b.x, y: b.y + 1.6, z: b.z }, m.gunId, acc, tgt, m);
            }
          } else if (tgt && distT < 24) {
            wantMove = smartChase(24) || m.wanderDir;
            speed = 2.4;
            faceTarget = !!wantMove;
          } else wantMove = m.wanderDir;
        } else {
          if (tgt && distT < 16) {
            const dx = (tgt.x - b.x) / (distT + 0.01), dz = (tgt.z - b.z) / (distT + 0.01);
            wantMove = smartChase(18); speed = 2.7;
            faceTarget = distT < 2.5;
            m.meleeT -= dt;
            if (distT < 1.7 && m.meleeT <= 0) {
              m.meleeT = 1.0;
              this.dmgTarget(tgt, 4, dx * 4, dz * 4, m);
            }
          } else wantMove = m.wanderDir;
        }
        m.speechT -= dt;
        if (m.speechT <= 0 && distPlayer < 20) {
          m.speechT = 10 + Math.random() * 20;
          this.say(m, HUMBUG_LINES[(Math.random() * HUMBUG_LINES.length) | 0]);
        }
      } else { // Mr Floop
        if (m.angryAt && !m.angryAt.dead) {
          // Mr Floop has a temper
          const ab = m.angryAt.body;
          const d2 = Math.sqrt((b.x - ab.x) ** 2 + (b.z - ab.z) ** 2) + 0.01;
          if (d2 < 20) {
            const floopTgt = { x: ab.x, y: ab.y, z: ab.z, h: ab.h || 1.8 };
            const canSeeAngry = World.lineOfSight(b.x, b.y + b.h * 0.75, b.z, ab.x, ab.y + (ab.h || 1.8) * 0.75, ab.z);
            wantMove = this.pathMove(m, floopTgt, dt, 22, canSeeAngry);
            speed = 2.4;
            faceTarget = false;
            m.meleeT -= dt;
            if (d2 < 1.8 && m.meleeT <= 0) {
              m.meleeT = 1.0;
              this.hurt(m.angryAt, 5, (ab.x - b.x) / d2 * 8, (ab.z - b.z) / d2 * 8, m);
            }
          } else m.angryAt = null;
        } else if (m.state === 'approach') {
          if (distPlayer > 2.6) {
            const floopPlayerTgt = { x: p.x, y: p.y, z: p.z, h: p.h || 1.8 };
            const canSeePlayer = World.lineOfSight(b.x, b.y + b.h * 0.75, b.z, p.x, p.y + (p.h || 1.8) * 0.75, p.z);
            wantMove = this.pathMove(m, floopPlayerTgt, dt, 12, canSeePlayer);
            speed = 1.1;
          } else { m.state = 'chat'; m.stateT = 2 + Math.random() * 2; }
        } else if (m.state === 'chat') {
          m.targetYaw = Math.atan2(p.x - b.x, p.z - b.z);
          if (distPlayer > 7) m.state = 'wander';
        } else {
          wantMove = m.wanderDir;
          if (distPlayer < 8 && Math.random() < 0.006) { m.state = distPlayer > 3 ? 'approach' : 'chat'; m.stateT = 3; }
        }
        m.speechT -= dt;
        if (m.speechT <= 0 && distPlayer < 26) {
          m.speechT = 7 + Math.random() * 16;
          const roll = Math.random();
          let line;
          if (roll < 0.025) line = Math.random() < 0.5 ? 'STFU' : 'stfu'; // very rare temper
          else if (roll < 0.42) line = FLOOP_LINES_COMMON[(Math.random() * FLOOP_LINES_COMMON.length) | 0];
          else if (roll < 0.72) line = FLOOP_LINES_CASUAL[(Math.random() * FLOOP_LINES_CASUAL.length) | 0];
          else line = FLOOP_LINES_RARE[(Math.random() * FLOOP_LINES_RARE.length) | 0];
          this.say(m, line);
          if (distPlayer < 12) { m.state = 'chat'; m.stateT = 2.5; }
          if (Math.random() < 0.10) {
            Drops.spawn(b.x, b.y + 1.2, b.z, Math.random() < 0.6 ? I.COOKIE : I.BERRY, 1);
            this.say(m, 'a gift! merry christmas!!');
          }
        }
      }

      // ---- stuck detection + detour ----
      if (m.detourT > 0) {
        m.detourT -= dt;
        if (m.detourDir) wantMove = m.detourDir;
      }
      m.stuckT += dt;
      if (m.stuckT >= 0.6) {
        const moved = Math.sqrt((b.x - m.lastSX) ** 2 + (b.z - m.lastSZ) ** 2);
        if (wantMove && moved < 0.12) {
          m.stuckPathHits = (m.stuckPathHits || 0) + 1;
          m.pathT = 0;
          m.pathFailT = 0;
          if (this.mobShouldJump(m, wantMove)) this.mobJump(m);
          if (m.stuckPathHits >= 3 && tgt) {
            // Repeatedly pushing into the same impossible low/wide clearance is
            // usually a bad goal, not a detour problem. Give up/search briefly
            // instead of ping-ponging outside the player's shelter forever.
            this.markPathUnreachable(m, 2.4 + Math.random() * 1.8);
            wantMove = this.unreachablePathMove(m, tgt, dt);
            m.stuckPathHits = 0;
          } else {
            const sign = Math.random() < 0.5 ? 1 : -1;
            m.detourDir = [-wantMove[1] * sign, wantMove[0] * sign];
            m.detourT = 0.35 + Math.random() * 0.25;
          }
        } else if (moved >= 0.16) {
          m.stuckPathHits = 0;
        }
        m.stuckT = 0; m.lastSX = b.x; m.lastSZ = b.z;
      }

      // ---- movement/physics (knockback wins for a beat) ----
      if (m.kbCd > 0) m.kbCd -= dt;
      const inWater = Physics.inWater(b, 0.3);
      // lava cooks everyone, no exceptions. Route through hurt() so death,
      // drops, angry-state cleanup, and weird edge cases all use one path.
      if (Physics.inLava(b, 0.2)) {
        m.lavaT = (m.lavaT || 0) - dt;
        if (m.lavaT <= 0) {
          m.lavaT = 0.5;
          this.hurt(m, 3, 0, 0, 'lava');
          Particles.burst(b.x, b.y + 1, b.z, [1, 0.55, 0.1], 6, 2);
          if (m.dead) continue;
        }
      }
      if (m.kbT > 0) {
        m.kbT -= dt;
        b.vx *= 0.96; b.vz *= 0.96; // let the knockback carry them
      } else if (frogHop) {
        // frogs steer only mid-hop; on the ground they sit still
        if (b.onGround) { b.vx *= 0.6; b.vz *= 0.6; }
        m.walkAnim += dt * 4;
      } else if (wantMove) {
        const ml = Math.sqrt(wantMove[0] ** 2 + wantMove[1] ** 2) || 1;
        b.vx = wantMove[0] / ml * speed;
        b.vz = wantMove[1] / ml * speed;
        if (this.mobShouldJump(m, wantMove)) this.mobJump(m);
        m.walkAnim += dt * 7;
      } else {
        b.vx *= 0.8; b.vz *= 0.8;
      }
      if (inWater) {
        b.vy += (14 - Math.max(0, b.vy) * 6) * dt;
        b.vy = Math.min(b.vy, 2.5);
        b.vy -= 4 * dt;
      } else {
        b.vy -= Physics.GRAV * dt;
      }
      if (m.type === 'chicken') b.vy = Math.max(b.vy, -2.5); // flappy descent
      b.vy = Math.max(b.vy, -38);
      Physics.move(b, dt, { stepUp: m.type !== 'creeper', stepLift: 0.58 });
      if (b.y < -12) {
        this.kill(m);
        continue;
      }

      // ---- facing ----
      if (faceTarget && tgt) {
        m.targetYaw = Math.atan2(tgt.x - b.x, tgt.z - b.z);
      } else if (wantMove && (Math.abs(b.vx) > 0.05 || Math.abs(b.vz) > 0.05)) {
        m.targetYaw = Math.atan2(wantMove[0], wantMove[1]);
      } else if (frogHop && !b.onGround) {
        if (Math.abs(b.vx) + Math.abs(b.vz) > 0.5) m.targetYaw = Math.atan2(b.vx, b.vz);
      }
      const yawDiff = wrapAngle(m.targetYaw - m.yaw);
      m.yaw += yawDiff * Math.min(1, 7 * dt);

      // ---- visuals ----
      m.group.position.set(b.x, b.y, b.z);
      m.group.rotation.y = m.yaw;
      const swing = wantMove || (frogHop && !b.onGround) ? Math.sin(m.walkAnim) * 0.5 : 0;
      m.parts.legs.forEach((leg, li) => {
        if (m.type === 'spider') leg.rotation.y = swing * (li % 2 ? 0.4 : -0.4);
        else if (m.type !== 'creeper') leg.rotation.x = swing * (li % 2 ? 1 : -1);
      });
      if (m.type === 'creeper') {
        const fl = m.fuse > 0 ? (Math.sin(m.fuse * 26) > 0 ? 0.9 : 0) : 0;
        const sc = 1 + m.fuse * 0.2;
        m.group.scale.set(sc, sc, sc);
        this.setEmissive(m, Math.max(fl, m.flash > 0 ? 0.6 : 0), m.flash > 0 ? 0xff3333 : 0xffffff);
      } else {
        this.setEmissive(m, m.flash > 0 ? 0.6 : 0, 0xff3333);
      }
      if (m.flash > 0) m.flash -= dt;
      // match the voxel lighting (mobs in caves/at night are actually dark now)
      m.tintT = (m.tintT || 0) - dt;
      if (m.tintT <= 0) {
        m.tintT = 0.20;
        const raw = World.getLightRaw(Math.floor(b.x), Math.floor(b.y + b.h * 0.55), Math.floor(b.z));
        const l = Math.max(0.06, Math.max(raw & 15, (raw >> 4) * World.dayFUniform.value) / 15);
        m._light = l;
        m.group.traverse(o => {
          if (o.isMesh) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const mt of mats) {
              if (!mt.color) continue;
              if (!mt.userData.mobBaseCol) mt.userData.mobBaseCol = mt.color.clone();
              mt.color.copy(mt.userData.mobBaseCol).multiplyScalar(l);
            }
          }
        });
      }
      if (m.bubble) {
        m.bubbleT -= dt;
        m.bubble.position.set(b.x, b.y + b.h + 0.55, b.z);
        if (m.bubbleT <= 0) {
          this.scene.remove(m.bubble);
          m.bubble.material.map.dispose(); m.bubble.material.dispose();
          m.bubble = null;
        }
      }
    }
  },

  setEmissive(m, intensity, color) {
    m.group.traverse(o => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (mat.emissive) {
            mat.emissive.setHex(color);
            mat.emissiveIntensity = intensity;
          }
        }
      }
    });
  },

  humbugGun() {
    const day = Game.dayCount;
    const roll = Math.random();
    if (day >= 9 && roll < 0.10) return I.RIFLE;
    if (day >= 7 && roll < 0.28) return I.SMG;
    if (roll < 0.5) return I.PISTOL;
    return null;
  },

  // ---------- spawning ----------
  spawnTick(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = 1.6;
    const p = Player.body;
    if (!World.hasChunk(Math.floor(p.x), Math.floor(p.z))) return;

    const hostiles = this.list.filter(m => HOSTILES.includes(m.type)).length;
    const floops = this.list.filter(m => m.type === 'floop').length;
    const passive = this.list.filter(m => ['sheep', 'chicken', 'camel'].includes(m.type)).length;
    const tungs = this.list.filter(m => m.type === 'tung').length;

    if (typeof Dimensions !== 'undefined' && Dimensions.current === 'merry') {
      // The Merry Christmas Floop Dimension should not import overworld mob
      // ecology.  Only Mr. Floop may appear naturally here.
      if (floops < 1 && Math.random() < 0.08) {
        const pos = this.surfaceSpot(p, 14, 34);
        if (pos && World.spawnAllowedAt(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z))) {
          const m = this.spawn('floop', pos.x, pos.y, pos.z);
          m.speechT = 2 + Math.random() * 4;
        }
      }
      return;
    }

    if (Game.isNight && hostiles < 10 && Math.random() < 0.55) {
      const pos = this.surfaceSpot(p, 20, 38);
      if (pos && World.spawnAllowedAt(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z))) {
        const humbugsUnlocked = Game.dayCount >= 5;
        const roll = Math.random();
        if (tungs < 1 && roll < 0.05 && Game.dayCount >= 3) {
          this.spawn('tung', pos.x, pos.y, pos.z);
          UI.chat('You hear it in the distance... tung. tung. tung.', '#d2a24c');
        }
        else if (humbugsUnlocked && roll < 0.28) this.spawn('humbug', pos.x, pos.y, pos.z, this.humbugGun());
        else if (roll < 0.52) this.spawn('creeper', pos.x, pos.y, pos.z);
        else if (roll < 0.78) this.spawn('skeleton', pos.x, pos.y, pos.z);
        else this.spawn('spider', pos.x, pos.y, pos.z);
      }
    }
    // dark caves spawn monsters any time of day.  Do several candidate checks
    // instead of one random Y roll so daytime cave spawning is reliable.
    if (hostiles < 10 && Math.random() < (Game.isNight ? 0.18 : 0.42)) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const r2 = 14 + Math.random() * 24;
        const sx = Math.round(p.x + Math.cos(a) * r2), sz = Math.round(p.z + Math.sin(a) * r2);
        if (!World.hasChunk(sx, sz)) continue;
        const top = Math.max(8, Math.min(World.H - 4, World.heightAt(sx, sz) - 2));
        const sy = 4 + ((Math.random() * Math.max(5, top - 4)) | 0);
        const okCell = World.getBlock(sx, sy, sz) === B.AIR && World.getBlock(sx, sy + 1, sz) === B.AIR &&
          Physics.solidAt(sx + 0.5, sy - 0.5, sz + 0.5);
        if (!okCell || !World.spawnAllowedAt(sx, sy, sz)) continue;
        const raw = World.getLightRaw(sx, sy + 1, sz);
        const sky = raw >> 4, block = raw & 15;
        const effectiveLight = Math.max(block, Math.floor(sky * (Game.isNight ? 0.15 : 0.55)));
        if (effectiveLight > 7) continue;
        const roll = Math.random();
        const type = Game.dayCount >= 5 && roll < 0.3 ? 'humbug' : roll < 0.6 ? 'spider' : roll < 0.85 ? 'skeleton' : 'creeper';
        this.spawn(type, sx + 0.5, sy + 0.02, sz + 0.5, type === 'humbug' ? this.humbugGun() : null);
        break;
      }
    }
    if (p.y < 26 && hostiles < 12 && Math.random() < 0.25) {
      const near = World.dungeonSpots.filter(s =>
        Math.abs(s.x - p.x) < 26 && Math.abs(s.z - p.z) < 26 && Math.abs(s.y - p.y) < 12);
      if (near.length) {
        const s = near[(Math.random() * near.length) | 0];
        const d = Math.sqrt((s.x - p.x) ** 2 + (s.z - p.z) ** 2);
        if (d > 7 && World.getBlock(s.x, s.y, s.z) === B.AIR && World.spawnAllowedAt(s.x, s.y, s.z)) {
          const roll = Math.random();
          const type = Game.dayCount >= 5 && roll < 0.4 ? 'humbug' : roll < 0.7 ? 'spider' : 'skeleton';
          this.spawn(type, s.x + 0.5, s.y + 0.02, s.z + 0.5, type === 'humbug' ? this.humbugGun() : null);
        }
      }
    }
    if (!Game.isNight && passive < 7 && Math.random() < 0.09) {
      const pos = this.surfaceSpot(p, 16, 34);
      if (pos) {
        const biome = World.biomeAt(Math.floor(pos.x), Math.floor(pos.z));
        const ground = World.getBlock(Math.floor(pos.x), Math.floor(pos.y - 0.5), Math.floor(pos.z));
        if (biome === 'desert' && ground === B.SAND) this.spawn('camel', pos.x, pos.y, pos.z);
        else if (ground === B.GRASS || ground === B.SNOWY_GRASS) {
          this.spawn(Math.random() < 0.5 ? 'sheep' : 'chicken', pos.x, pos.y, pos.z);
        }
      }
    }
    if (floops < 1 && Math.random() < 0.09) {
      let pos = null;
      const spots = World.floopSpots.filter(s =>
        Math.abs(s.x - p.x) < 60 && Math.abs(s.z - p.z) < 60);
      if (spots.length && Math.random() < 0.5) {
        const s = spots[(Math.random() * spots.length) | 0];
        pos = this.surfaceSpotAt(s.x + (Math.random() * 8 - 4) | 0, s.z + (Math.random() * 8 - 4) | 0);
      } else {
        pos = this.surfaceSpot(p, 14, 30);
      }
      if (pos) {
        const m = this.spawn('floop', pos.x, pos.y, pos.z);
        m.speechT = 2 + Math.random() * 4;
      }
    }
  },

  surfaceSpot(p, minR, maxR) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    return this.surfaceSpotAt(Math.round(p.x + Math.cos(a) * r), Math.round(p.z + Math.sin(a) * r));
  },

  surfaceSpotAt(x, z) {
    if (!World.hasChunk(x, z)) return null;
    for (let y = World.H - 2; y > 1; y--) {
      const id = World.getBlock(x, y, z);
      if (id !== B.AIR) {
        if (isFluid(id)) return null;
        return { x: x + 0.5, y: y + 1.02, z: z + 0.5 };
      }
    }
    return null;
  },

  // ---------- save/load ----------
  serialize() {
    return this.list.filter(m => !m.dead).map(m => ({
      t: m.type, x: +m.body.x.toFixed(1), y: +m.body.y.toFixed(1), z: +m.body.z.toFixed(1),
      hp: Number.isFinite(+m.hp) ? +m.hp : this.mobMaxHp(m.type), g: m.gunId || 0, c: m.color || 0, apt: +(m.angryPlayerT || 0).toFixed(1),
    }));
  },

  deserialize(arr) {
    let loadedFloop = false;
    for (const s of arr || []) {
      if (typeof Dimensions !== 'undefined' && Dimensions.current === 'merry' && s.t !== 'floop') continue;
      if (s.t === 'floop') {
        if (loadedFloop || this.liveFloops().length > 0) continue;
        loadedFloop = true;
      }
      const m = this.spawn(s.t, s.x, s.y, s.z, s.g || null, s.c || null);
      m.hp = Number.isFinite(+s.hp) ? +s.hp : this.mobMaxHp(m.type);
      this.repairMobHealth(m);
      m.angryPlayerT = s.apt || 0;
    }
    this.enforceSingleFloop();
  },
};
