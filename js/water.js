// ============================================================
// F_Floop Craft — fluid sims. Water: MC-style source/flow (7).
// Lava: same idea, slower ticks, 3-block flow, and it makes
// cobble/obsidian when it argues with water.
// ============================================================

// water + lava meeting rules (both sims call this)
function fluidClash(x, y, z) {
  const id = World.getBlock(x, y, z);
  if (isLava(id)) {
    const src = id === B.LAVA;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
      if (isWaterCell(World.getBlock(x + dx, y + dy, z + dz))) {
        World.setBlock(x, y, z, src ? B.OBSIDIAN : B.COBBLE);
        SFX.splash();
        Particles.burst(x + 0.5, y + 1, z + 0.5, [0.3, 0.3, 0.35], 10, 2);
        return true;
      }
    }
  }
  return false;
}

const Water = {
  queue: new Set(),
  acc: 0,
  TICK: 0.25,
  MAX_PER_TICK: 600,

  schedule(x, y, z) {
    if (y < 0) return; // no H cap: fluids flow in the sparse zone above terrain too
    this.queue.add(x + ',' + y + ',' + z);
  },

  update(dt) {
    this.acc += dt;
    if (this.acc < this.TICK) return;
    this.acc = 0;
    if (!this.queue.size) return;
    const batch = [...this.queue].slice(0, this.MAX_PER_TICK);
    for (const k of batch) this.queue.delete(k);
    for (const k of batch) {
      const [x, y, z] = k.split(',').map(Number);
      if (!World.hasChunk(x, z)) continue;
      this.updateCell(x, y, z);
    }
  },

  washable(id) {
    return (isTorch(id) && !isSeaTorch(id)) || isSapling(id) || isFlower(id) || id === B.FIRE || isSnowSheet(id);
  },
  washDrop(id) {
    if (id === B.FIRE || isSnowSheet(id)) return 0;
    return isTorch(id) ? torchItemId(id) : id;
  },
  waterlogSeaTorch(x, y, z, id) {
    if (!isSeaTorch(id) || isWaterlogged(id)) return false;
    World.setBlock(x, y, z, waterloggedSeaTorchId(id), { noWaterRestore: true });
    return true;
  },

  updateCell(x, y, z) {
    const id = World.getBlock(x, y, z);
    if (!isWaterCell(id)) {
      if (isLava(id)) fluidClash(x, y, z);
      return;
    }
    const isSrc = isWaterSource(id);
    const lvl = waterCellLevel(id);

    if (!isSrc) {
      let expected = 0;
      if (isWaterCell(World.getBlock(x, y + 1, z))) expected = 8;
      let srcCount = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = World.getBlock(x + dx, y, z + dz);
        if (isWaterCell(n)) {
          if (isWaterSource(n)) srcCount++;
          expected = Math.max(expected, waterCellLevel(n) - 1);
        }
      }
      const belowId = World.getBlock(x, y - 1, z);
      const belowDef = Reg[belowId];
      const belowSolid = belowDef && belowDef.block && belowDef.solid;
      if (srcCount >= 2 && (belowSolid || isWaterSource(belowId))) {
        World.setBlock(x, y, z, B.WATER);
        this.spread(x, y, z, 8, true);
        return;
      }
      if (expected <= 0) {
        World.setBlock(x, y, z, B.AIR);
        this.wakeNeighbors(x, y, z);
        return;
      }
      const want = expected >= 8 ? B.WATER_FALL : flowIdFor(expected);
      if (want !== id) {
        World.setBlock(x, y, z, want);
        this.wakeNeighbors(x, y, z);
        this.spread(x, y, z, expected, false);
        return;
      }
    }
    this.spread(x, y, z, lvl, isSrc);
  },

  spread(x, y, z, lvl, isSource) {
    const below = World.getBlock(x, y - 1, z);
    const belowDef = Reg[below];
    // water onto lava below -> stone-ish outcomes
    if (isLava(below)) {
      World.setBlock(x, y - 1, z, below === B.LAVA ? B.OBSIDIAN : B.COBBLE);
      SFX.splash();
      return;
    }
    if (this.waterlogSeaTorch(x, y - 1, z, below)) return;
    const canFallInto = below === B.AIR || this.washable(below) ||
      (isWater(below) && below !== B.WATER && below !== B.WATER_FALL);
    if (canFallInto) {
      if (isSource && lvl > 1) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          const n = World.getBlock(nx, y, nz);
          if (this.waterlogSeaTorch(nx, y, nz, n)) continue;
          if (isLava(n)) {
            World.setBlock(nx, y, nz, n === B.LAVA ? B.OBSIDIAN : B.COBBLE);
            SFX.splash();
            continue;
          }
          const canFlow = n === B.AIR || this.washable(n) || (isWater(n) && n !== B.WATER && waterLevel(n) < lvl - 1);
          if (canFlow) {
            if (this.washable(n)) {
              const d = this.washDrop(n);
              if (d) Drops.spawn(nx + 0.5, y + 0.3, nz + 0.5, d, 1);
            }
            World.setBlock(nx, y, nz, flowIdFor(lvl - 1));
            this.schedule(nx, y, nz);
          }
        }
      }
      if (this.washable(below)) {
        const d = this.washDrop(below);
        if (d) Drops.spawn(x + 0.5, y - 0.7, z + 0.5, d, 1);
      }
      World.setBlock(x, y - 1, z, B.WATER_FALL);
      this.schedule(x, y - 1, z);
      return;
    }
    // only spread sideways when actually resting on something solid (or a source
    // pool surface) — falling water must fall STRAIGHT down, not staircase into a tsunami
    const belowBlocksFlow = (belowDef && belowDef.block && belowDef.solid) || isWaterSource(below);
    if (!belowBlocksFlow || lvl <= 1) return;

    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      const n = World.getBlock(nx, y, nz);
      if (this.waterlogSeaTorch(nx, y, nz, n)) continue;
      if (isLava(n)) {
        World.setBlock(nx, y, nz, n === B.LAVA ? B.OBSIDIAN : B.COBBLE);
        SFX.splash();
        continue;
      }
      const canFlow = n === B.AIR || this.washable(n) || (isWater(n) && n !== B.WATER && waterLevel(n) < lvl - 1);
      if (canFlow) {
        if (this.washable(n)) {
          const d = this.washDrop(n);
          if (d) Drops.spawn(nx + 0.5, y + 0.3, nz + 0.5, d, 1);
        }
        World.setBlock(nx, y, nz, flowIdFor(lvl - 1));
        this.schedule(nx, y, nz);
      }
    }
  },

  wakeNeighbors(x, y, z) {
    this.schedule(x + 1, y, z); this.schedule(x - 1, y, z);
    this.schedule(x, y + 1, z); this.schedule(x, y - 1, z);
    this.schedule(x, y, z + 1); this.schedule(x, y, z - 1);
  },
};

const Lava = {
  queue: new Set(),
  acc: 0,
  TICK: 0.7, // lava is slow and menacing
  MAX_PER_TICK: 300,

  schedule(x, y, z) {
    if (y < 0) return; // no H cap: fluids flow in the sparse zone above terrain too
    this.queue.add(x + ',' + y + ',' + z);
  },

  update(dt) {
    this.acc += dt;
    if (this.acc < this.TICK) return;
    this.acc = 0;
    if (!this.queue.size) return;
    const batch = [...this.queue].slice(0, this.MAX_PER_TICK);
    for (const k of batch) this.queue.delete(k);
    for (const k of batch) {
      const [x, y, z] = k.split(',').map(Number);
      if (!World.hasChunk(x, z)) continue;
      this.updateCell(x, y, z);
    }
  },

  updateCell(x, y, z) {
    const id = World.getBlock(x, y, z);
    if (!isLava(id)) return;
    if (fluidClash(x, y, z)) return;
    const isSrc = id === B.LAVA;
    const lvl = lavaLevel(id);

    if (!isSrc) {
      let expected = 0;
      if (isLava(World.getBlock(x, y + 1, z))) expected = 8;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = World.getBlock(x + dx, y, z + dz);
        if (isLava(n)) expected = Math.max(expected, Math.min(lavaLevel(n), 4) - 1);
      }
      if (expected <= 0) {
        World.setBlock(x, y, z, B.AIR);
        this.wakeNeighbors(x, y, z);
        return;
      }
      const want = expected >= 8 ? B.LAVA_FALL : lavaFlowIdFor(Math.min(expected, 3));
      if (want !== id) {
        World.setBlock(x, y, z, want);
        this.wakeNeighbors(x, y, z);
      }
    }
    this.spread(x, y, z, isSrc ? 4 : Math.min(lvl, 3), isSrc);
    // lava sets its neighborhood on fire, occasionally
    if (Math.random() < 0.06 && typeof Dynamics !== 'undefined') {
      Dynamics.tryIgniteNear(x, y, z);
    }
  },

  spread(x, y, z, lvl, isSource) {
    const below = World.getBlock(x, y - 1, z);
    const belowDef = Reg[below];
    if (isWater(below)) {
      // lava falling onto water -> cobble cap
      World.setBlock(x, y - 1, z, B.COBBLE);
      SFX.splash();
      return;
    }
    const canFallInto = below === B.AIR || below === B.FIRE ||
      (isLava(below) && below !== B.LAVA && below !== B.LAVA_FALL);
    if (canFallInto) {
      if (isSource && lvl > 1) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          const n = World.getBlock(nx, y, nz);
          if (isWater(n)) {
            World.setBlock(x, y, z, B.OBSIDIAN);
            SFX.splash();
            return;
          }
          const canFlow = n === B.AIR || n === B.FIRE || (isLava(n) && n !== B.LAVA && lavaLevel(n) < lvl - 1);
          if (canFlow) {
            World.setBlock(nx, y, nz, lavaFlowIdFor(Math.min(lvl - 1, 3)));
            this.schedule(nx, y, nz);
          }
        }
      }
      World.setBlock(x, y - 1, z, B.LAVA_FALL);
      this.schedule(x, y - 1, z);
      return;
    }
    // same rule as water: no sideways spread while falling
    const belowBlocks = (belowDef && belowDef.block && belowDef.solid) || below === B.LAVA;
    if (!belowBlocks || lvl <= 1) return;

    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      const n = World.getBlock(nx, y, nz);
      if (isWater(n)) {
        // flowing lava meets water -> the lava-side cell cobbles
        World.setBlock(x, y, z, isLava(World.getBlock(x, y, z)) && World.getBlock(x, y, z) === B.LAVA ? B.OBSIDIAN : B.COBBLE);
        SFX.splash();
        return;
      }
      const canFlow = n === B.AIR || n === B.FIRE || (isLava(n) && n !== B.LAVA && lavaLevel(n) < lvl - 1);
      if (canFlow) {
        World.setBlock(nx, y, nz, lavaFlowIdFor(Math.min(lvl - 1, 3)));
        this.schedule(nx, y, nz);
      }
    }
  },

  wakeNeighbors(x, y, z) {
    this.schedule(x + 1, y, z); this.schedule(x - 1, y, z);
    this.schedule(x, y + 1, z); this.schedule(x, y - 1, z);
    this.schedule(x, y, z + 1); this.schedule(x, y, z - 1);
  },
};
