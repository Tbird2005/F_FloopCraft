// ============================================================
// F_Floop Craft — guns, bow, ammo, tracers, rockets, lasers
// ============================================================
const Guns = {
  scene: null,
  cooldown: 0,
  tracers: [],
  rockets: [],

  defs: {
    [I.PISTOL]: { dmg: 4, cd: 0.35, spread: 0.02, pellets: 1, auto: false, ammo: I.LIGHT_AMMO, ammoUse: 1, range: 40, color: 0xffd97a },
    [I.SMG]: { dmg: 3, cd: 0.13, spread: 0.055, pellets: 1, auto: true, ammo: I.LIGHT_AMMO, ammoUse: 1, range: 32, color: 0xffd97a },
    [I.RIFLE]: { dmg: 9, cd: 0.9, spread: 0.004, pellets: 1, auto: false, ammo: I.HEAVY_AMMO, ammoUse: 1, range: 85, color: 0xfff2ae },
    [I.SHOTGUN]: { dmg: 2.5, cd: 1.0, spread: 0.09, pellets: 8, auto: false, ammo: I.SHELLS, ammoUse: 1, range: 18, color: 0xffb060 },
    [I.BAZOOKA]: { dmg: 0, cd: 1.6, spread: 0.01, pellets: 1, auto: false, ammo: I.ROCKET, ammoUse: 1, range: 90, color: 0xff8040, rocket: true },
    [I.FLOOP_RAY]: { dmg: 14, cd: 0.5, spread: 0, pellets: 1, auto: true, ammo: I.CHARGE_CELL, ammoUse: 1, range: 90, color: 0x6ee814, laser: true },
    [I.PATAPIM_BEAM]: { dmg: 26, cd: 1.1, spread: 0, pellets: 1, auto: false, ammo: I.CHARGE_CELL, ammoUse: 2, range: 90, color: 0xc77dff, laser: true, explode: { r: 2.0, dmg: 9 } },
    [I.BOW]: { dmg: 5, cd: 0.75, spread: 0, pellets: 1, auto: false, ammo: I.ARROW, ammoUse: 1, range: 50, color: 0xd8d8d8, bow: true },
  },

  init(scene) {
    this.scene = scene;
    for (const id of Object.keys(this.defs)) Reg[id].gun = this.defs[id];
  },

  tracer(x0, y0, z0, x1, y1, z1, color, thick) {
    let ox = 0, oy = 0, oz = 0;
    if (typeof Physics !== 'undefined' && Physics._originFor) {
      const th = Physics.FAR_COORD_THRESHOLD || 1000000000;
      if (Math.abs(x0) >= th || Math.abs(y0) >= th || Math.abs(z0) >= th || Math.abs(x1) >= th || Math.abs(y1) >= th || Math.abs(z1) >= th) {
        ox = Physics._originFor(x0);
        oy = Physics._originFor(y0);
        oz = Physics._originFor(z0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0 - ox, y0 - oy, z0 - oz, x1 - ox, y1 - oy, z1 - oz], 3));
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const line = new THREE.Line(g, m);
    line.position.set(ox, oy, oz);
    this.scene.add(line);
    this.tracers.push({ line, life: thick ? 0.16 : 0.07, max: thick ? 0.16 : 0.07 });
  },

  tryFire(gunId, isHeld) {
    const d = this.defs[gunId];
    if (!d || this.cooldown > 0) return false;
    if (isHeld && !d.auto) return false;
    const creative = Player.gamemode === 'creative';
    if (!creative && Player.countItem(d.ammo) < d.ammoUse) {
      if (!isHeld) { UI.chat('Out of ' + Reg[d.ammo].name + '!', '#ff8080'); SFX.click(); }
      this.cooldown = 0.2;
      return false;
    }
    if (!creative) Player.removeItems(d.ammo, d.ammoUse);
    this.cooldown = d.cd;

    const eye = { x: Player.body.x, y: Player.eyeY(), z: Player.body.z };
    const look = Player.lookDir();
    SFX.gunshot(gunId, eye);
    Player.swingViewmodel();

    Player.damageHeld(1); // guns wear out too
    if (d.bow) {
      // player arrows launch exactly down the crosshair, then gravity pulls them into an arc
      Mobs.shootArrow(eye.x + look.x * 0.8, eye.y + look.y * 0.8, eye.z + look.z * 0.8, eye.x + look.x * 40, eye.y + look.y * 40, eye.z + look.z * 40, 'player', { aimed: true, gravity: 14, speed: 27, life: 4.2 });
      return true;
    }
    if (d.rocket) {
      this.spawnRocket(eye, look, 'player');
      return true;
    }
    for (let p = 0; p < d.pellets; p++) {
      const dir = this.spreadDir(look, d.spread);
      this.hitscan(eye, dir, d, 'player');
    }
    return true;
  },

  spreadDir(look, spread) {
    return {
      x: look.x + (Math.random() - 0.5) * 2 * spread,
      y: look.y + (Math.random() - 0.5) * 2 * spread,
      z: look.z + (Math.random() - 0.5) * 2 * spread,
    };
  },

  hitscan(from, dir, d, src) {
    const blockHit = World.raycast(from.x, from.y, from.z, dir.x, dir.y, dir.z, d.range);
    const blockDist = blockHit ? blockHit.dist : d.range;
    let endX = from.x + dir.x * blockDist, endY = from.y + dir.y * blockDist, endZ = from.z + dir.z * blockDist;

    if (d.laser) {
      const victims = Mobs.rayAll(from.x, from.y, from.z, dir.x, dir.y, dir.z, blockDist);
      for (const v of victims) Mobs.hurt(v.mob, d.dmg, dir.x * 1.5, dir.z * 1.5, src);
      if (d.explode && blockHit) World.explode(endX, endY, endZ, d.explode.r, d.explode.dmg, undefined, src);
      this.tracer(from.x, from.y - 0.12, from.z, endX, endY, endZ, d.color, true);
      Particles.burst(endX, endY, endZ, [0.6, 1, 0.4], 6, 2);
      return;
    }

    const mobHit = Mobs.hitTest(from.x, from.y, from.z, dir.x, dir.y, dir.z, blockDist);
    if (mobHit) {
      // firearms poke, they don't launch — no more SMG-to-orbit combos
      Mobs.hurt(mobHit.mob, d.dmg, dir.x * 0.8, dir.z * 0.8, src);
      endX = from.x + dir.x * mobHit.dist; endY = from.y + dir.y * mobHit.dist; endZ = from.z + dir.z * mobHit.dist;
      Particles.burst(endX, endY, endZ, [0.8, 0.2, 0.2], 5, 2);
    } else if (blockHit) {
      Particles.blockBurst(blockHit.bx, blockHit.by, blockHit.bz, blockHit.id);
    }
    this.tracer(from.x, from.y - 0.12, from.z, endX, endY, endZ, d.color, false);
  },

  // hostile mob fires at a target (player or another mob).
  // Bullets hit the FIRST thing in the way — infighting fuel.
  mobFire(from, gunId, accuracy, tgt, shooter) {
    const d = this.defs[gunId] || this.defs[I.PISTOL];
    const tx = tgt.x, ty = tgt.y + (tgt.h || 1.6) * 0.75, tz = tgt.z;
    let fox = 0, foy = 0, foz = 0;
    if (typeof Physics !== 'undefined' && Physics._originFor) {
      const th = Physics.FAR_COORD_THRESHOLD || 1000000000;
      if (Math.abs(from.x) >= th || Math.abs(from.y) >= th || Math.abs(from.z) >= th || Math.abs(tx) >= th || Math.abs(ty) >= th || Math.abs(tz) >= th) {
        fox = Physics._originFor(from.x); foy = Physics._originFor(from.y); foz = Physics._originFor(from.z);
      }
    }
    const dx = (tx - fox) - (from.x - fox), dy = (ty - foy) - (from.y - foy), dz = (tz - foz) - (from.z - foz);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const dir = this.spreadDir({ x: dx / dist, y: dy / dist, z: dz / dist }, d.spread + (1 - accuracy) * 0.09);
    SFX.gunshot(gunId, from);

    const blockHit = World.raycast(from.x, from.y, from.z, dir.x, dir.y, dir.z, d.range);
    const blockDist = blockHit ? blockHit.dist : d.range;

    // first mob in the way (not the shooter)
    const mobHit = Mobs.hitTest(from.x, from.y, from.z, dir.x, dir.y, dir.z, blockDist, shooter);

    // player proximity to the shot line
    let playerT = Infinity;
    if (!Player.dead && Player.gamemode !== 'creative') {
      const p = Player.body;
      const shotBody = { x: from.x, y: from.y, z: from.z };
      const pd = (typeof Physics !== 'undefined' && Physics.deltaBodies) ? Physics.deltaBodies(shotBody, p) : { x: p.x - from.x, y: p.y - from.y, z: p.z - from.z };
      const pdx = pd.x, pdy = pd.y + 1.3, pdz = pd.z;
      const t = Math.max(0, Math.min(blockDist, pdx * dir.x + pdy * dir.y + pdz * dir.z));
      const miss = Math.sqrt((dir.x * t - pdx) ** 2 + (dir.y * t - pdy) ** 2 + (dir.z * t - pdz) ** 2);
      if (miss < 0.75) playerT = t;
    }

    let endT = blockDist;
    if (mobHit && mobHit.dist < playerT) {
      endT = mobHit.dist;
      Mobs.hurt(mobHit.mob, Math.max(1, Math.round(d.dmg * 0.7)), dir.x * 3, dir.z * 3, shooter);
    } else if (playerT < Infinity) {
      endT = playerT;
      Player.hurt(Math.max(1, Math.round(d.dmg * 0.7)), dir.x * 3, dir.z * 3, { source: 'gun', attackerType: shooter && shooter.type || '', attackerName: shooter && shooter.peerName || '' });
    }
    const ex = from.x + dir.x * endT, ey = from.y + dir.y * endT, ez = from.z + dir.z * endT;
    this.tracer(from.x, from.y, from.z, ex, ey, ez, 0xff6060, false);
  },

  stepFarProjectile(p, dt) {
    if (typeof Physics === 'undefined' || !Physics.ensureFarBody || !Physics.ensureFarBody(p)) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      return;
    }
    const st = p._farPos;
    st.x += p.vx * dt;
    st.y += p.vy * dt;
    st.z += p.vz * dt;
    const sx = Math.floor(st.x / 16) * 16;
    const sy = Math.floor(st.y / 16) * 16;
    const sz = Math.floor(st.z / 16) * 16;
    st.ox += sx; st.oy += sy; st.oz += sz;
    st.x -= sx; st.y -= sy; st.z -= sz;
    p.x = st.ox + st.x; p.y = st.oy + st.y; p.z = st.oz + st.z;
  },

  farDelta(a, b) {
    if (typeof Physics !== 'undefined' && Physics.deltaBodies) return Physics.deltaBodies(a, b);
    return { x: (b.x || 0) - (a.x || 0), y: (b.y || 0) - (a.y || 0), z: (b.z || 0) - (a.z || 0) };
  },

  spawnRocket(from, dir, src) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xd8d8d8, emissive: 0xff8040, emissiveIntensity: 0.4 })
    );
    mesh.position.set(from.x + dir.x * 0.6, from.y + dir.y * 0.6, from.z + dir.z * 0.6);
    this.scene.add(mesh);
    const rocket = {
      x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
      vx: dir.x * 24, vy: dir.y * 24, vz: dir.z * 24,
      w: 0.12, h: 0.12, mesh, life: 5, src,
    };
    if (typeof Physics !== 'undefined' && Physics.ensureFarBody) Physics.ensureFarBody(rocket);
    mesh.userData.farBody = rocket;
    this.rockets.push(rocket);
    SFX.rocketLaunch(from);
  },

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.max);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose(); t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      r.vy -= 3 * dt;
      this.stepFarProjectile(r, dt);
      if (r._farPos) {
        r.mesh.position.set(r._farPos.x, r._farPos.y, r._farPos.z);
        r.mesh.lookAt(r._farPos.x + r.vx, r._farPos.y + r.vy, r._farPos.z + r.vz);
      } else {
        r.mesh.position.set(r.x, r.y, r.z);
        r.mesh.lookAt(r.x + r.vx, r.y + r.vy, r.z + r.vz);
      }
      if (Math.random() < 0.6) Particles.burst(r.x, r.y, r.z, [0.6, 0.6, 0.6], 1, 0.5);

      let boom = r.life <= 0 || Physics.solidAt(r.x, r.y, r.z);
      if (!boom) {
        for (const m of Mobs.list) {
          if (m.dead) continue;
          const b = m.body;
          const d = this.farDelta(b, r); // rocket relative to mob body
          if (d.x > -b.w - 0.2 && d.x < b.w + 0.2 && d.y > -0.2 && d.y < b.h + 0.2 &&
              d.z > -b.w - 0.2 && d.z < b.w + 0.2) { boom = true; break; }
        }
      }
      if (boom) {
        this.scene.remove(r.mesh); r.mesh.geometry.dispose();
        this.rockets.splice(i, 1);
        World.explode(r.x, r.y, r.z, 2.6, 12, undefined, r.src);
      }
    }
  },
};
