// ============================================================
// F_Floop Craft — dropped item entities (pop out, magnet, pickup)
// ============================================================
const Drops = {
  list: [],
  scene: null,
  texCache: {},
  blockMat: null, // dedicated material: NO vertexColors (fixes pitch-black drops)

  init(scene) {
    this.scene = scene;
    if (!this.blockMat) {
      this.blockMat = new THREE.MeshLambertMaterial({ map: Atlas.texture });
    }
  },

  // textured cube of any size (dropped items, falling sand, viewmodels).
  // Each cube gets its OWN material so voxel-light tinting doesn't bleed across items.
  makeBlockCube(id, size) {
    if (typeof PhotoBlocks !== 'undefined' && PhotoBlocks.isPhotoBlock && PhotoBlocks.isPhotoBlock(id)) {
      return PhotoBlocks.makeCube(id, size);
    }
    const g = new THREE.BoxGeometry(size, size, size);
    const uvAttr = g.getAttribute('uv');
    const faceTex = ['side', 'side', 'top', 'bottom', 'side', 'side'];
    for (let f = 0; f < 6; f++) {
      const uvr = Atlas.uv(Atlas.texName(id, faceTex[f]));
      const remap = [[0, 1], [1, 1], [0, 0], [1, 0]];
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uvAttr.array[i * 2] = uvr.u0 + (uvr.u1 - uvr.u0) * remap[v][0];
        uvAttr.array[i * 2 + 1] = uvr.v0 + (uvr.v1 - uvr.v0) * remap[v][1];
      }
    }
    uvAttr.needsUpdate = true;
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: Atlas.texture }));
  },

  makeMesh(id) {
    const def = Reg[id];
    if (def && def.block && def.shape === 'cube' && (def.force3dIcon || (!def.cutout && def.opaque))) {
      return this.makeBlockCube(id, 0.3);
    }
    // sprite icon for items / non-cube blocks (own material per drop for tinting)
    if (!this.texCache[id]) {
      const tex = new THREE.CanvasTexture(Icons.get(id));
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      this.texCache[id] = tex;
    }
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texCache[id], transparent: true }));
    spr.scale.set(0.45, 0.45, 0.45);
    return spr;
  },

  // dim/brighten a drop to match the voxel light where it sits
  tint(d) {
    const b = d.body;
    const raw = World.getLightRaw(Math.floor(b.x), Math.floor(b.y + 0.3), Math.floor(b.z));
    const l = Math.max(0.12, Math.max(raw & 15, (raw >> 4) * World.dayFUniform.value) / 15);
    if (Math.abs(l - (d._light || -1)) < 0.06) return;
    d._light = l;
    const mat = d.mesh.material;
    if (mat && mat.color) mat.color.setRGB(l, l, l);
  },

  spawn(x, y, z, id, count, vel, dur, data) {
    if (!id || !count) return;
    const mesh = this.makeMesh(id);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.list.push({
      id, count, dur, data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)), mesh,
      body: {
        x, y, z,
        vx: vel ? vel[0] : (Math.random() - 0.5) * 2.4,
        vy: vel ? vel[1] : 3 + Math.random() * 1.5,
        vz: vel ? vel[2] : (Math.random() - 0.5) * 2.4,
        w: 0.13, h: 0.26, onGround: false, hitH: false,
      },
      age: 0, pickupDelay: vel ? 1.1 : 0.4, spin: Math.random() * Math.PI * 2,
    });
  },

  update(dt) {
    const p = Player.body;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.age += dt;
      if (d.age > 300) { this.remove(i); continue; }

      const b = d.body;
      if (World.hasChunk(Math.floor(b.x), Math.floor(b.z))) {
        const lavaSafeDrop = d.id === B.OBSIDIAN || d.id === I.OBSIDIAN_BOAT;
        const touchingLava = isLava(World.getBlock(Math.floor(b.x), Math.floor(b.y + 0.15), Math.floor(b.z))) || Physics.inLava(b, 0.1);
        // lava incinerates normal items; obsidian and obsidian boats survive and float on it
        if (touchingLava && !lavaSafeDrop) {
          Particles.burst(b.x, b.y + 0.3, b.z, [1, 0.55, 0.1], 8, 2);
          SFX.dig();
          this.remove(i);
          continue;
        }
        const inWater = Physics.inWater(b, 0.1);
        const inSafeLava = lavaSafeDrop && touchingLava;
        b.vy -= ((inWater || inSafeLava) ? 6 : 20) * dt;
        if (inWater || inSafeLava) {
          b.vy = Math.max(b.vy, inSafeLava ? -0.7 : -1.2);
          b.vy += (inSafeLava ? 7 : 8) * dt;
          b.vx *= inSafeLava ? 0.86 : 0.9;
          b.vz *= inSafeLava ? 0.86 : 0.9;
        }
        if (b.onGround) { b.vx *= 0.82; b.vz *= 0.82; }
        // magnet toward the NEAREST player — including remote clients in multiplayer,
        // so items gravitate to whoever is closest, not only the local/host player.
        // (host is authoritative: it pulls drops toward remote bodies and broadcasts the
        // motion; the remote client still does the actual pickup via pickup_request)
        if (d.age >= d.pickupDelay) {
          const remotes = (typeof Multiplayer !== 'undefined' && Multiplayer.connected
            && Multiplayer.role !== 'solo' && Multiplayer.remoteBodies) ? Multiplayer.remoteBodies() : [];
          let tx = 0, ty = 0, tz = 0, best = Infinity, localBest = false;
          if (!Player.dead && Player.canAccept(d.id)) {
            const dd = Math.hypot(p.x - b.x, (p.y + 0.6) - b.y, p.z - b.z);
            if (dd < best) { best = dd; tx = p.x; ty = p.y + 0.6; tz = p.z; localBest = true; }
          }
          for (const rb of remotes) {
            const dd = Math.hypot(rb.x - b.x, (rb.y + 0.6) - b.y, rb.z - b.z);
            if (dd < best) { best = dd; tx = rb.x; ty = rb.y + 0.6; tz = rb.z; localBest = false; }
          }
          if (best < 2.0 && best > 0.01) {
            const pull = 26 * dt / Math.max(best, 0.4);
            b.vx += (tx - b.x) * pull; b.vy += (ty - b.y) * pull; b.vz += (tz - b.z) * pull;
          }
          if (localBest && best < 0.7) {
            let leftover;
            // Only real durability (a positive number) forces the 1-per-slot path.
            // A network-serialized dur of null/0 must NOT be treated as durable, or
            // stackable blocks dropped by a client come back one-per-slot.
            if (Number.isFinite(d.dur) && d.dur > 0) {
              // durable item: keep its wear — no drop-and-pickup repairs
              leftover = d.count;
              for (let slot = 0; slot < 36 && leftover > 0; slot++) {
                if (!Player.inv[slot]) {
                  Player.inv[slot] = { id: d.id, count: 1, dur: d.dur, ...(d.data !== undefined ? { data: JSON.parse(JSON.stringify(d.data)) } : {}) };
                  leftover--;
                }
              }
            } else {
              leftover = Player.addItem(d.id, d.count, d.dur, d.data);
            }
            if (leftover < d.count) {
              SFX.pop();
              UI.updateHotbar();
              // refresh the open inventory/chest grid too, or a pickup only shows
              // in the hotbar until the menu is reopened
              if (UI.anyOpen && UI.anyOpen() && UI.refreshAll) UI.refreshAll();
              if (leftover === 0) { this.remove(i); continue; }
              d.count = leftover;
            }
          }
        }
        Physics.move(b, dt);
      }
      d.spin += dt * 2.5;
      const bob = Math.sin(d.age * 3) * 0.04;
      d.mesh.position.set(b.x, b.y + 0.18 + bob, b.z);
      if (d.mesh.isMesh) d.mesh.rotation.y = d.spin;
      this.tint(d);
    }
  },

  remove(i) {
    const d = this.list[i];
    this.scene.remove(d.mesh);
    if (d.mesh.isMesh) d.mesh.geometry.dispose();
    if (d.mesh.material) d.mesh.material.dispose();
    this.list.splice(i, 1);
  },

  dropTable(x, y, z, table) {
    let dropped = false;
    for (const [id, min, max, chance] of table) {
      if (Math.random() <= chance) {
        this.spawn(x, y, z, id, min + Math.floor(Math.random() * (max - min + 1)));
        dropped = true;
      }
    }
    return dropped;
  },

  dropFromBlock(bx, by, bz, blockId, toolOk) {
    if (blockId === B.JELLY_HOUSE && toolOk) {
      const key = World && World.pkey ? World.pkey(bx, by, bz) : (bx + ',' + by + ',' + bz);
      const preBreakItemData = (typeof Jelly !== 'undefined' && Jelly.itemDataForPlacedHouse) ? Jelly.itemDataForPlacedHouse(bx, by, bz) : null;
      const res = (typeof Jelly !== 'undefined') ? Jelly.onHouseBreak(key, { reason: 'drop_helper' }) : null;
      this.spawn(bx + 0.5, by + 0.4, bz + 0.5, blockId, 1, null, undefined, (res && res.itemData) || preBreakItemData || (typeof Jelly !== 'undefined' ? Jelly.serializeHouseItem([]) : { jellyRoster: [] }));
      return;
    }
    const def = Reg[blockId];
    if (def.drop === null) return;
    if (!toolOk) return;
    if (def.drop && def.drop.table) {
      this.dropTable(bx + 0.5, by + 0.4, bz + 0.5, def.drop.table);
      return;
    }
    let id = blockId, n = 1;
    if (def.drop) {
      if (def.drop.chance && Math.random() > def.drop.chance) return;
      id = def.drop.id;
      n = def.drop.min && def.drop.max
        ? def.drop.min + Math.floor(Math.random() * (def.drop.max - def.drop.min + 1))
        : (def.drop.min || 1);
    }
    this.spawn(bx + 0.5, by + 0.4, bz + 0.5, id, n);
  },
};
