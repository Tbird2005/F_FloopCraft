// ============================================================
// F_Floop Craft — voxel AABB physics with sub-block shapes,
// stair corner derivation, and mesh-accurate ray targeting
// ============================================================
const Physics = {
  GRAV: 26,

  sidewaysStairBoxes(data) {
    const nx = data && data.nx ? Math.sign(data.nx) : 0;
    const nz = data && data.nz ? Math.sign(data.nz) : 0;
    const side = data && data.side === 2 ? 2 : 1;
    if (!nx && !nz) return null;

    // Sideways stairs are normal stair volume rotated onto a wall:
    // one full-height half-slab attached to the support face, plus one
    // full-height quarter on the far side. The clicked half of the wall face
    // chooses which side the quarter turns toward.
    const boxes = [];
    if (nx) {
      const x0 = nx > 0 ? 0 : 0.5, x1 = nx > 0 ? 0.5 : 1;
      const fx0 = nx > 0 ? 0.5 : 0, fx1 = nx > 0 ? 1 : 0.5;
      const pz = side === 1 ? nx : -nx;
      const z0 = pz > 0 ? 0.5 : 0, z1 = pz > 0 ? 1 : 0.5;
      boxes.push([x0, 0, 0, x1, 1, 1]);
      boxes.push([fx0, 0, z0, fx1, 1, z1]);
    } else {
      const z0 = nz > 0 ? 0 : 0.5, z1 = nz > 0 ? 0.5 : 1;
      const fz0 = nz > 0 ? 0.5 : 0, fz1 = nz > 0 ? 1 : 0.5;
      const px = side === 1 ? -nz : nz;
      const x0 = px > 0 ? 0.5 : 0, x1 = px > 0 ? 1 : 0.5;
      boxes.push([0, 0, z0, 1, 1, z1]);
      boxes.push([x0, 0, fz0, x1, 1, fz1]);
    }
    return boxes;
  },

  // --- stair shape derivation (MC-style corners, computed from neighbors) ---
  // returns array of local boxes
  stairBoxes(id, x, y, z) {
    const info = stairInfo(id);
    if (!info) return [[0, 0, 0, 1, 1, 1]];
    if (typeof World !== 'undefined' && x !== undefined && World.stairSideways && World.pkey) {
      const sideData = World.stairSideways.get(World.pkey(x, y, z));
      const sideBoxes = sideData ? this.sidewaysStairBoxes(sideData) : null;
      if (sideBoxes) return sideBoxes;
    }
    const d = info.dir;
    const top = info.top;
    const slabBox = top ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
    const yLo = top ? 0 : 0.5, yHi = top ? 0.5 : 1;
    const qBox = (dx, dz) => [ // quarter box in the given horizontal quadrant-direction
      dx === 1 ? 0.5 : 0, yLo, dz === 1 ? 0.5 : 0,
      dx === -1 ? 0.5 : 1, yHi, dz === -1 ? 0.5 : 1,
    ];
    const backBox = (dir) => dir[0] !== 0
      ? [dir[0] === 1 ? 0.5 : 0, yLo, 0, dir[0] === 1 ? 1 : 0.5, yHi, 1]
      : [0, yLo, dir[1] === 1 ? 0.5 : 0, 1, yHi, dir[1] === 1 ? 1 : 0.5];

    let shape = 'straight', otherDir = null;
    if (typeof World !== 'undefined' && x !== undefined && World.hasChunk && World.hasChunk(x, z)) {
      const perp = (a, b) => a[0] * b[0] + a[1] * b[1] === 0; // perpendicular, never 180°
      // outer corner: block BEHIND is a perpendicular same-half stair
      const behind = World.getBlock(x + d[0], y, z + d[1]);
      const bi = stairInfo(behind);
      if (bi && bi.top === top && perp(bi.dir, d)) { shape = 'outer'; otherDir = bi.dir; }
      else {
        // inner corner: block IN FRONT is a perpendicular same-half stair
        const front = World.getBlock(x - d[0], y, z - d[1]);
        const fi = stairInfo(front);
        if (fi && fi.top === top && perp(fi.dir, d)) { shape = 'inner'; otherDir = fi.dir; }
      }
    }
    if (shape === 'outer') {
      // just one quarter at the shared back corner
      return [slabBox, qBox(d[0] || otherDir[0], d[1] || otherDir[1])];
    }
    if (shape === 'inner') {
      // full back half + the quarter on the FRONT half toward the other stair's back
      // (previously this quarter was computed inside the back half, so inner corners
      //  rendered as plain straight stairs)
      const ex = d[0] !== 0 ? -d[0] : otherDir[0];
      const ez = d[1] !== 0 ? -d[1] : otherDir[1];
      return [slabBox, backBox(d), qBox(ex, ez)];
    }
    return [slabBox, backBox(d)];
  },

  // collision boxes (local space). Position-aware for stairs.
  blockBoxes(id, x, y, z) {
    const def = Reg[id];
    if (!def || !def.block || !def.solid) return null;
    switch (def.shape) {
      case 'cube': case 'dslab': case 'mega': return [[0, 0, 0, 1, 1, 1]];
      case 'slabB': return [[0, 0, 0, 1, 0.5, 1]];
      case 'slabT': return [[0, 0.5, 0, 1, 1, 1]];
      case 'vslab': return [slabBoxForId(id)];
      case 'slabCombo': return slabComboBoxes(id) || [[0, 0, 0, 1, 1, 1]];
      case 'stairs': return this.stairBoxes(id, x, y, z);
      case 'door':
        return isDoorX(id) ? [[0.36, 0, 0.02, 0.64, 1, 0.98]] : [[0.02, 0, 0.36, 0.98, 1, 0.64]];
      case 'doorOpen': return null; // walkable; the thin panel only matters for targeting
      case 'dungeonDoor':
        return dungeonDoorAxisAt(id, x, y, z) === 'x'
          ? [[0.38, 0, 0.02, 0.62, 1, 0.98]]
          : [[0.02, 0, 0.38, 0.98, 1, 0.62]];
      case 'bed': return [[0, 0, 0, 1, 0.56, 1]];
      case 'snow': {
        // a single sheet is just powder — walk right through it
        const lvl = snowSheetLevel(id);
        if (lvl <= 1) return null;
        return [[0, 0, 0, 1, (lvl - 1) / 8, 1]];
      }
      case 'cactus': return [[0.07, 0, 0.07, 0.93, 1, 0.93]];
      case 'planter': case 'crop': {
        const yOff = (typeof World !== 'undefined' && World && World.plantationYOffset) ? World.plantationYOffset(x, y, z) : 0;
        const boxes = [];
        if (yOff > 0) boxes.push([0, 0, 0, 1, 0.5, 1]);
        boxes.push([0, yOff, 0, 1, yOff + 0.36, 1]);
        return boxes;
      }
      case 'portalH': return null;
      case 'cross': case 'wtorch': case 'sign': case 'ladder': return null;
      default: return [[0, 0, 0, 1, 1, 1]];
    }
  },

  // Targeting boxes for the planter tray itself. These are intentionally the
  // real low tray/rim pieces, not a full invisible block-sized hitbox.
  planterRayBoxes(id, x, y, z) {
    const canCheckWorld = typeof World !== 'undefined' && World && World.getBlock;
    const yOff = (canCheckWorld && World.plantationYOffset) ? World.plantationYOffset(x, y, z) : 0;
    const boxes = [[0, yOff, 0, 1, yOff + 0.28, 1]]; // soil/tray base
    const potLike = (bid) => bid === B.PLANTATION_POT || (typeof isCrop === 'function' && isCrop(bid));
    const nb = (dx, dz) => canCheckWorld ? World.getBlock(x + dx, y, z + dz) : B.AIR;
    const sameLevelPot = (dx, dz) => canCheckWorld && potLike(nb(dx, dz)) && World.plantationYOffset(x + dx, y, z + dz) === yOff;
    if (!canCheckWorld || !sameLevelPot(0, -1)) boxes.push([0, yOff + 0.28, 0, 1, yOff + 0.42, 0.12]);
    if (!canCheckWorld || !sameLevelPot(0, 1)) boxes.push([0, yOff + 0.28, 0.88, 1, yOff + 0.42, 1]);
    if (!canCheckWorld || !sameLevelPot(-1, 0)) boxes.push([0, yOff + 0.28, 0.12, 0.12, yOff + 0.42, 0.88]);
    if (!canCheckWorld || !sameLevelPot(1, 0)) boxes.push([0.88, yOff + 0.28, 0.12, 1, yOff + 0.42, 0.88]);
    return boxes;
  },

  // A small target volume around the crossed crop planes. This keeps the crop
  // target separate from the pot target, without letting the whole planter cell
  // count as a plant hit.
  cropRayBoxes(id, x, y, z) {
    const st = (typeof isCrop === 'function' && isCrop(id) && typeof cropStage === 'function') ? cropStage(id) : 3;
    const scale = 0.46 + Math.max(0, st) * 0.17;
    const s = Math.max(0.16, scale * 0.34);
    const yOff = (typeof World !== 'undefined' && World && World.plantationYOffset) ? World.plantationYOffset(x, y, z) : 0;
    const y0 = yOff + 0.28;
    const y1 = Math.min(yOff + 1.24, y0 + scale);
    return [[0.5 - s, y0, 0.5 - s, 0.5 + s, y1, 0.5 + s]];
  },

  // targeting boxes: what the crosshair / mob line-of-sight can actually hit.
  // Matches the VISIBLE mesh (open doors = thin panel, torches = small stick...).
  rayBoxes(id, x, y, z) {
    const def = Reg[id];
    if (!def || !def.block || id === B.AIR || isFluid(id)) return null;
    switch (def.shape) {
      case 'dungeonDoor':
        return dungeonDoorAxisAt(id, x, y, z) === 'x'
          ? [[0.34, 0, 0, 0.66, 1, 1]]
          : [[0, 0, 0.34, 1, 1, 0.66]];
      case 'doorOpen':
        return isDoorX(id) ? [[0.02, 0, 0.02, 0.98, 1, 0.18]] : [[0.02, 0, 0.02, 0.18, 1, 0.98]];
      case 'cross':
        return [[0.25, 0, 0.25, 0.75, isTorch(id) ? 0.8 : 0.8, 0.75]];
      case 'wtorch': {
        const d = WTORCH_DIR[id];
        return [[0.5 - d[0] * 0.38 - 0.18, 0.1, 0.5 - d[2] * 0.38 - 0.18, 0.5 - d[0] * 0.38 + 0.18, 0.95, 0.5 - d[2] * 0.38 + 0.18]];
      }
      case 'sign': return [[0.4, 0, 0.4, 0.6, 0.55, 0.6], [0.06, 0.55, 0.32, 0.94, 1, 0.68]]; // post + board
      case 'snow': return [[0, 0, 0, 1, snowSheetLevel(id) / 8, 1]]; // full visual height for targeting
      case 'portalH': return [[0, -0.48, 0, 1, -0.42, 1]];
      case 'planter': return this.planterRayBoxes(id, x, y, z);
      case 'crop': return this.planterRayBoxes(id, x, y, z).concat(this.cropRayBoxes(id, x, y, z));
      case 'ladder': {
        const d = LADDER_DIR[id];
        return [[
          d[0] === 1 ? 0 : d[0] === -1 ? 0.85 : 0.05, 0, d[2] === 1 ? 0 : d[2] === -1 ? 0.85 : 0.05,
          d[0] === 1 ? 0.15 : d[0] === -1 ? 1 : 0.95, 1, d[2] === 1 ? 0.15 : d[2] === -1 ? 1 : 0.95,
        ]];
      }
      default: {
        const boxes = this.blockBoxes(id, x, y, z);
        return boxes || [[0.2, 0, 0.2, 0.8, 0.9, 0.8]]; // fallback for odd non-solids
      }
    }
  },

  // ray vs a set of local boxes at cell (bx,by,bz). Returns {t, nx,ny,nz} or null.
  rayVsBoxes(boxes, bx, by, bz, ox, oy, oz, dx, dy, dz, tMin, tMax) {
    let best = null;
    for (const bo of boxes) {
      const min = [bx + bo[0], by + bo[1], bz + bo[2]];
      const max = [bx + bo[3], by + bo[4], bz + bo[5]];
      const o = [ox, oy, oz], d = [dx, dy, dz];
      let t0 = tMin, t1 = tMax, axis = -1, sign = 0;
      let ok = true;
      for (let ax = 0; ax < 3 && ok; ax++) {
        if (Math.abs(d[ax]) < 1e-9) {
          if (o[ax] < min[ax] || o[ax] > max[ax]) ok = false;
        } else {
          let ta = (min[ax] - o[ax]) / d[ax], tb = (max[ax] - o[ax]) / d[ax];
          let sa = d[ax] > 0 ? -1 : 1;
          if (ta > tb) { const t = ta; ta = tb; tb = t; }
          if (ta > t0) { t0 = ta; axis = ax; sign = sa; }
          t1 = Math.min(t1, tb);
          if (t0 > t1) ok = false;
        }
      }
      if (ok && (!best || t0 < best.t)) {
        const n = [0, 0, 0];
        if (axis >= 0) n[axis] = sign;
        else n[1] = 1; // ray started inside: pretend top face
        best = { t: t0, nx: n[0], ny: n[1], nz: n[2] };
      }
    }
    return best;
  },

  boxHit(minX, minY, minZ, maxX, maxY, maxZ) {
    return this.boxesIn(minX, minY, minZ, maxX, maxY, maxZ).length > 0;
  },

  boxesIn(minX, minY, minZ, maxX, maxY, maxZ) {
    const eps = 0.001;
    const out = [];
    const x0 = Math.floor(minX), x1 = Math.floor(maxX - eps);
    const y0 = Math.floor(minY), y1 = Math.floor(maxY - eps);
    const z0 = Math.floor(minZ), z1 = Math.floor(maxZ - eps);
    for (let bx = x0; bx <= x1; bx++) for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) {
      const boxes = this.blockBoxes(World.getBlock(bx, by, bz), bx, by, bz);
      if (!boxes) continue;
      for (const bo of boxes) {
        const wb = [bx + bo[0], by + bo[1], bz + bo[2], bx + bo[3], by + bo[4], bz + bo[5]];
        if (minX < wb[3] && maxX > wb[0] && minY < wb[4] && maxY > wb[1] && minZ < wb[5] && maxZ > wb[2]) out.push(wb);
      }
    }
    return out;
  },

  boxKey(wb) { return wb[0].toFixed(2) + '|' + wb[1].toFixed(2) + '|' + wb[2].toFixed(2) + '|' + wb[4].toFixed(2); },

  solidAt(x, y, z) {
    return !!this.blockBoxes(World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)), Math.floor(x), Math.floor(y), Math.floor(z));
  },

  inWater(b, yOff) {
    const y = b.y + (yOff || 0.2);
    for (const [dx, dz] of [[0, 0], [b.w * 0.9, 0], [-b.w * 0.9, 0], [0, b.w * 0.9], [0, -b.w * 0.9]]) {
      if (isWater(World.getBlock(Math.floor(b.x + dx), Math.floor(y), Math.floor(b.z + dz)))) return true;
    }
    return false;
  },

  inLava(b, yOff) {
    const minX = Math.floor(b.x - b.w), maxX = Math.floor(b.x + b.w);
    const minZ = Math.floor(b.z - b.w), maxZ = Math.floor(b.z + b.w);
    const minY = Math.floor(b.y + (yOff || 0.05));
    const maxY = Math.floor(b.y + Math.max(yOff || 0.2, b.h * 0.65));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (isLava(World.getBlock(x, y, z))) return true;
    }
    return false;
  },

  moveAxis(b, axis, delta, preKeys) {
    const eps = 0.002;
    while (Math.abs(delta) > 0) {
      const step = Math.max(-0.45, Math.min(0.45, delta));
      delta -= step;
      if (axis === 0) b.x += step; else if (axis === 1) b.y += step; else b.z += step;

      const minX = b.x - b.w, maxX = b.x + b.w;
      const minY = b.y, maxY = b.y + b.h;
      const minZ = b.z - b.w, maxZ = b.z + b.w;
      let boxes = this.boxesIn(minX, minY, minZ, maxX, maxY, maxZ);
      // ignore boxes we already overlapped before moving (e.g. a door closed on us)
      if (preKeys && preKeys.size) boxes = boxes.filter(wb => !preKeys.has(this.boxKey(wb)));
      if (!boxes.length) continue;

      if (axis === 0) {
        if (step > 0) { let lim = Infinity; for (const wb of boxes) lim = Math.min(lim, wb[0]); b.x = lim - b.w - eps; }
        else { let lim = -Infinity; for (const wb of boxes) lim = Math.max(lim, wb[3]); b.x = lim + b.w + eps; }
        b.vx = 0; b.hitH = true;
      } else if (axis === 1) {
        if (step > 0) { let lim = Infinity; for (const wb of boxes) lim = Math.min(lim, wb[1]); b.y = lim - b.h - eps; b.vy = 0; }
        else { let lim = -Infinity; for (const wb of boxes) lim = Math.max(lim, wb[4]); b.y = lim + eps; b.vy = 0; b.onGround = true; }
      } else {
        if (step > 0) { let lim = Infinity; for (const wb of boxes) lim = Math.min(lim, wb[2]); b.z = lim - b.w - eps; }
        else { let lim = -Infinity; for (const wb of boxes) lim = Math.max(lim, wb[5]); b.z = lim + b.w + eps; }
        b.vz = 0; b.hitH = true;
      }
      return;
    }
  },

  groundBelow(b, depth) {
    return this.boxHit(b.x - b.w, b.y - depth, b.z - b.w, b.x + b.w, b.y + 0.01, b.z + b.w);
  },

  move(b, dt, opts) {
    opts = opts || {};
    const wasGround = b.onGround;
    b.hitH = false;
    b.onGround = false;
    let dx = b.vx * dt, dy = b.vy * dt, dz = b.vz * dt;

    // boxes we already intersect get a free pass (doors that closed on us, etc.)
    const preKeys = new Set();
    for (const wb of this.boxesIn(b.x - b.w, b.y, b.z - b.w, b.x + b.w, b.y + b.h, b.z + b.w)) {
      preKeys.add(this.boxKey(wb));
    }

    if (opts.sneakGuard && wasGround) {
      const ox = b.x, oz = b.z;
      b.x = ox + dx;
      if (!this.groundBelow(b, 0.6)) { dx = 0; b.vx = 0; }
      b.x = ox;
      b.z = oz + dz;
      if (!this.groundBelow(b, 0.6)) { dz = 0; b.vz = 0; }
      b.z = oz;
    }

    const startX = b.x, startY = b.y, startZ = b.z;
    const startVX = b.vx, startVZ = b.vz;
    this.moveAxis(b, 0, dx, preKeys);
    this.moveAxis(b, 2, dz, preKeys);
    this.moveAxis(b, 1, dy, preKeys);

    if (opts.stepUp && b.hitH && (wasGround || b.onGround)) {
      const r1 = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, onGround: b.onGround, hitH: b.hitH };
      b.x = startX; b.y = startY; b.z = startZ; b.vx = startVX; b.vz = startVZ;
      const lift = opts.stepLift || 0.55;
      if (!this.boxHit(b.x - b.w, b.y, b.z - b.w, b.x + b.w, b.y + b.h + lift, b.z + b.w)) {
        b.y += lift;
        b.hitH = false; b.onGround = false;
        this.moveAxis(b, 0, dx, preKeys);
        this.moveAxis(b, 2, dz, preKeys);
        this.moveAxis(b, 1, -lift - 0.01, preKeys);
        const gain2 = (b.x - startX) ** 2 + (b.z - startZ) ** 2;
        const gain1 = (r1.x - startX) ** 2 + (r1.z - startZ) ** 2;
        if (!(b.onGround && gain2 > gain1 + 1e-6)) {
          b.x = r1.x; b.y = r1.y; b.z = r1.z; b.vx = r1.vx; b.vy = r1.vy; b.vz = r1.vz;
          b.onGround = r1.onGround; b.hitH = r1.hitH;
        } else {
          b.vy = r1.vy < 0 ? 0 : r1.vy;
        }
      } else {
        b.x = r1.x; b.y = r1.y; b.z = r1.z; b.vx = r1.vx; b.vy = r1.vy; b.vz = r1.vz;
        b.onGround = r1.onGround; b.hitH = r1.hitH;
      }
    }
  },

  blockIntersects(bx, by, bz, b) {
    return bx + 1 > b.x - b.w && bx < b.x + b.w &&
           by + 1 > b.y && by < b.y + b.h &&
           bz + 1 > b.z - b.w && bz < b.z + b.w;
  },

  // do the actual collision boxes of a would-be-placed block hit this body?
  placementBlocked(placeId, bx, by, bz, body) {
    const boxes = this.blockBoxes(placeId, bx, by, bz);
    if (!boxes) return false;
    for (const bo of boxes) {
      if (bx + bo[3] > body.x - body.w && bx + bo[0] < body.x + body.w &&
          by + bo[4] > body.y && by + bo[1] < body.y + body.h &&
          bz + bo[5] > body.z - body.w && bz + bo[2] < body.z + body.w) return true;
    }
    return false;
  },
};
